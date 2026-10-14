'use strict';

/**
 * services/eventCreation.js
 *
 * ONE implementation of "create an event + its organizer account", used by both
 *   • POST /api/events                          (public wizard, incl. white-label domains)
 *   • POST /api/whitelabel/:id/create-event     (admin creating on behalf of a client)
 *
 * Everything that makes an event safe lives here so the two paths can never drift:
 *   • subdomain uniqueness + blocklist checks
 *   • event password hashing (optional, min 6)
 *   • organizer ACCOUNT password (required, min 4) -> hashed, with a one-time recovery code
 *   • table-service staff account
 *   • organizer JWT
 *   • confirmation email
 *
 * An event can never be created with an organizer record that has no password,
 * so there is no "unclaimed organizer" for a stranger to take over.
 */

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Event = require('../models/Event');
const EventParticipant = require('../models/EventParticipant');
const Blocklist = require('../models/Blocklist');
const { secrets } = require('../keys');

class EventCreationError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.name = 'EventCreationError';
    this.status = status;
    this.extra = extra;
  }
}

const MIN_ACCOUNT_PASSWORD = 4;
const MIN_EVENT_PASSWORD = 6;
const MIN_STAFF_PIN = 4;
const SUBDOMAIN_RE = /^[a-z0-9-]{3,50}$/;

const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const activeBan = { $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] };

function isValidTimezone(tz) {
  if (!tz || typeof tz !== 'string' || tz.length > 64) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
}

/** XXXX-XXXX-XXXX-XXXX-XXXX — shown to the organizer once, only the hash is stored. */
function newRecoveryCode() {
  return Array.from({ length: 5 }, () => crypto.randomBytes(2).toString('hex').toUpperCase()).join('-');
}
const hashRecoveryCode = (code) => bcrypt.hash(code.replace(/-/g, '').toLowerCase(), 10);

/** Cheap rejections that should happen before any expensive work (spam scoring, captcha). */
async function precheck({ subdomain, organizerName }) {
  if (!SUBDOMAIN_RE.test(String(subdomain || ''))) throw new EventCreationError(400, 'Invalid subdomain format');
  if (await Event.findOne({ subdomain })) throw new EventCreationError(409, 'This event link is already taken.');

  const now = new Date();
  const live = { $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] };
  const [subBanned, nameBanned] = await Promise.all([
    Blocklist.findOne({ type: 'event', value: subdomain, ...live }).lean(),
    Blocklist.findOne({ type: 'name', value: { $regex: new RegExp(`^${escapeRe(organizerName)}$`, 'i') }, ...live }).lean(),
  ]);
  if (subBanned) throw new EventCreationError(403, 'This event link is not available.');
  if (nameBanned) throw new EventCreationError(403, 'This display name is not allowed.');
}

/**
 * Create the event and its organizer account.
 * Returns { event, token, recoveryCode }.
 */
async function createEventWithOrganizer(input, opts = {}) {
  const {
    subdomain, title, description = '', date, timezone, location = '',
    organizerName, organizerEmail,
    password, accountPassword, staffPassword,
    isEnterpriseMode = false, isTableServiceMode = false, eventType,
    settings, maxParticipants,
    wlDomain = null,
    creator = {},          // { ip, userAgent, fingerprint } — omitted for admin-created events
    legalAcceptance,       // { acceptedAt, version } — omitted when the organizer hasn't accepted yet
  } = input;

  // ── Validation (applies no matter which route called us) ──
  if (typeof accountPassword !== 'string' || accountPassword.length < MIN_ACCOUNT_PASSWORD) {
    throw new EventCreationError(400, `Account password is required (at least ${MIN_ACCOUNT_PASSWORD} characters).`);
  }
  if (password && String(password).length < MIN_EVENT_PASSWORD) {
    throw new EventCreationError(400, `Event password must be at least ${MIN_EVENT_PASSWORD} characters.`);
  }
  if (isTableServiceMode && staffPassword && String(staffPassword).length < MIN_STAFF_PIN) {
    throw new EventCreationError(400, `Staff PIN must be at least ${MIN_STAFF_PIN} characters.`);
  }

  if (!opts.skipPrecheck) await precheck({ subdomain, organizerName });

  const resolvedEventType = eventType === 'rsvpOnly' ? 'rsvpOnly' : 'standard';

  let hashedPassword = null;
  let isPasswordProtected = false;
  if (password) {
    hashedPassword = await bcrypt.hash(password, 10);
    isPasswordProtected = true;
  }

  const event = new Event({
    subdomain, title, description, date,
    timezone: isValidTimezone(timezone) ? timezone : 'UTC',
    location, organizerName, organizerEmail,
    password: hashedPassword, isPasswordProtected,
    isEnterpriseMode: !!isEnterpriseMode,
    isTableServiceMode: !!isTableServiceMode,
    eventType: resolvedEventType,
    ...(resolvedEventType === 'rsvpOnly' ? { rsvpPage: { enabled: true } } : {}),
    settings: settings || {},
    maxParticipants: maxParticipants || 100,
    participants: [{ username: organizerName, role: 'organizer' }],
    wlDomain,
    ...(creator.ip ? { creatorIp: creator.ip } : {}),
    ...(creator.userAgent ? { creatorUserAgent: creator.userAgent } : {}),
    ...(creator.fingerprint ? { creatorFingerprint: creator.fingerprint } : {}),
    ...(legalAcceptance ? { legalAcceptance } : {}),
  });

  try {
    await event.save();
  } catch (e) {
    if (e?.code === 11000) throw new EventCreationError(409, 'This event link is already taken.');
    throw e;
  }

  // Organizer account — always has a password and a recovery code.
  const recoveryCode = newRecoveryCode();
  try {
    await EventParticipant.create({
      eventId: event._id,
      username: organizerName,
      role: 'organizer',
      password: await bcrypt.hash(accountPassword, 10),
      hasPassword: true,
      recoveryCodeHash: await hashRecoveryCode(recoveryCode),
      recoveryCodeGeneratedAt: new Date(),
    });

    if (isTableServiceMode && staffPassword) {
      await EventParticipant.create({
        eventId: event._id,
        username: 'staff',
        role: 'staff',
        password: await bcrypt.hash(String(staffPassword), 10),
        hasPassword: true,
      });
    }
  } catch (e) {
    // Never leave an event behind without a usable organizer account.
    await EventParticipant.deleteMany({ eventId: event._id }).catch(() => {});
    await Event.deleteOne({ _id: event._id }).catch(() => {});
    throw e;
  }

  const token = jwt.sign(
    { eventId: event._id.toString(), username: organizerName, role: 'organizer' },
    secrets.jwt,
    { expiresIn: '24h' },
  );

  require('./emailService').sendEventConfirmation(event).catch(() => {});

  return { event, token, recoveryCode };
}

/**
 * Give an existing event's organizer a password + fresh one-time recovery code.
 * Used by admin to repair events that were created before accounts were mandatory,
 * or to hand access back to a client who lost it.
 */
async function setOrganizerAccess(eventId, accountPassword) {
  if (typeof accountPassword !== 'string' || accountPassword.length < MIN_ACCOUNT_PASSWORD) {
    throw new EventCreationError(400, `Password must be at least ${MIN_ACCOUNT_PASSWORD} characters.`);
  }
  const event = await Event.findById(eventId).select('participants').lean();
  if (!event) throw new EventCreationError(404, 'Event not found.');
  const organizer = event.participants?.find((p) => p.role === 'organizer');
  if (!organizer) throw new EventCreationError(409, 'This event has no organizer.');

  const recoveryCode = newRecoveryCode();
  await EventParticipant.findOneAndUpdate(
    { eventId, username: organizer.username },
    {
      $set: {
        role: 'organizer',
        password: await bcrypt.hash(accountPassword, 10),
        hasPassword: true,
        recoveryCodeHash: await hashRecoveryCode(recoveryCode),
        recoveryCodeGeneratedAt: new Date(),
      },
    },
    { upsert: true },
  );
  return { username: organizer.username, recoveryCode };
}

module.exports = {
  EventCreationError, precheck, createEventWithOrganizer, setOrganizerAccess,
  isValidTimezone, SUBDOMAIN_RE,
};
