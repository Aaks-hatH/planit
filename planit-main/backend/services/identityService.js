'use strict';

/**
 * services/identityService.js
 *
 * Admin-only identity resolution helpers used by /api/platform-analytics/pii-lookup.
 *
 *  - recordGuestIdentity(): called when a GUEST submits an RSVP. Ties the guest's
 *    name/email/phone to the browser's visitor ID + session ID (sent as _vid/_sid
 *    query params by the frontend) by writing one encrypted analytics row.
 *  - findFootprint(): searches every collection that stores a person's contact
 *    details (RSVPs, invites, event participants, white-label leads, staff) and
 *    reports where that person appears, with a confidence label per match.
 *
 * Nothing here is exposed to non-admins; the only caller of findFootprint is the
 * verifyAdmin + canExportData route, and every lookup is written to the audit log.
 */

const RSVPSubmission   = require('../models/RSVPSubmission');
const Invite           = require('../models/Invite');
const EventParticipant = require('../models/EventParticipant');
const WLLead           = require('../models/WLLead');
const Employee         = require('../models/Employee');
const Event            = require('../models/Event');
const { ingestBatch, normEmail, normPhone, nameTokens } = require('../models/PlatformAnalytics');

const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const VID_RE = /^v_[a-z0-9_]{6,60}$/i;
const SID_RE = /^s_[a-z0-9_]{6,60}$/i;

// ── Matchers ─────────────────────────────────────────────────────────────────
// Email: matches gmail dot / +tag aliases (a.b+x@gmail.com == ab@gmail.com).
function emailRegex(canon) {
  const at = canon.lastIndexOf('@');
  const local = canon.slice(0, at), domain = canon.slice(at + 1);
  const isGmail = domain === 'gmail.com';
  const localPat = isGmail ? local.split('').map(esc).join('\\.?') : esc(local);
  const domPat   = isGmail ? '(gmail|googlemail)\\.com' : esc(domain);
  return new RegExp(`^${isGmail ? '\\.?' : ''}${localPat}(\\+[^@]*)?@${domPat}$`, 'i');
}
// Phone: same last-10 digits, ignoring any punctuation / country code in storage.
function phoneRegex(d10) { return new RegExp(d10.split('').join('\\D*') + '\\D*$'); }
// Name: every query token must start a word in the field.
const wordStart = (t) => new RegExp('(^|\\s)' + esc(t), 'i');

// ── Guest identity capture (RSVP submit) ─────────────────────────────────────
function recordGuestIdentity(req, { event, firstName, lastName, email, phone, rsvpStatus, feature = 'rsvp_submitted' } = {}) {
  try {
    const vid = String(req?.query?._vid || '');
    const sid = String(req?.query?._sid || '');
    if (!VID_RE.test(vid) || !SID_RE.test(sid)) return; // not a browser with a tracker
    const name = [firstName, lastName].filter(Boolean).join(' ').trim() || null;
    if (!name && !email && !phone) return;
    ingestBatch([{
      eventType: 'feature_use',
      visitorId: vid,
      sessionId: sid,
      page: '/rsvp',
      ts: new Date().toISOString(),
      linkedEventId: event?._id ? String(event._id) : null,
      linkedEventSubdomain: event?.subdomain || null,
      rsvpStatus: rsvpStatus || null,
      payload: { feature },
      pii: { name, email: email || null, phone: phone || null },
    }], req).catch(() => {});
  } catch { /* never break an RSVP over analytics */ }
}

// ── Footprint search ─────────────────────────────────────────────────────────
/**
 * seed: { emails:[canonical], phones:[last10], names:[string] }
 * Only seed.names that the caller passes are used for name matching, and every
 * name-only hit is labelled matchedOn:'name' (possible, not certain).
 */
async function findFootprint(seed, { limit = 40 } = {}) {
  const emails = [...new Set((seed.emails || []).filter(Boolean))];
  const phones = [...new Set((seed.phones || []).filter(Boolean))];
  const names  = [...new Set((seed.names  || []).filter(Boolean))];
  const nameTok = names.map((n) => nameTokens(n)).filter((t) => t.length > 0);

  const emailRes = emails.map(emailRegex);
  const phoneRes = phones.map(phoneRegex);

  const orFor = (emailField, phoneField, nameBuilder) => {
    const c = [];
    emailRes.forEach((r) => c.push({ [emailField]: r }));
    if (phoneField) phoneRes.forEach((r) => c.push({ [phoneField]: r }));
    if (nameBuilder) nameTok.forEach((t) => c.push(nameBuilder(t)));
    return c;
  };

  const matchedOn = (rowEmail, rowPhone) => {
    const ne = normEmail(rowEmail), np = normPhone(rowPhone);
    if (ne && emails.includes(ne)) return 'email';
    if (np && phones.includes(np)) return 'phone';
    return 'name';
  };

  const [rsvps, invites, participants, leads, staff] = await Promise.all([
    (async () => {
      const or = orFor('email', 'phone', (t) => ({ $and: t.map((x) => ({ $or: [{ firstName: new RegExp('^' + esc(x), 'i') }, { lastName: new RegExp('^' + esc(x), 'i') }] })) }));
      if (!or.length) return [];
      return RSVPSubmission.find({ $or: or })
        .select('eventId firstName lastName email phone response status plusOnes checkedIn checkedInAt submittedAt deletedAt')
        .sort({ submittedAt: -1 }).limit(limit).lean();
    })(),
    (async () => {
      const or = orFor('guestEmail', 'guestPhone', (t) => ({ $and: t.map((x) => ({ guestName: wordStart(x) })) }));
      if (!or.length) return [];
      return Invite.find({ $or: or })
        .select('eventId guestName guestEmail guestPhone status type checkedIn checkedInAt tableLabel createdAt')
        .sort({ createdAt: -1 }).limit(limit).lean();
    })(),
    (async () => {
      // Participants only have a display name, so this is always a name-only (possible) match.
      if (!nameTok.length) return [];
      const or = nameTok.map((t) => ({ $and: t.map((x) => ({ username: wordStart(x) })) }));
      return EventParticipant.find({ $or: or })
        .select('eventId username role joinedAt lastSeenAt hasPassword')
        .sort({ lastSeenAt: -1 }).limit(limit).lean();
    })(),
    (async () => {
      const or = orFor('email', 'phone', (t) => ({ $and: t.map((x) => ({ contactName: wordStart(x) })) }));
      if (!or.length) return [];
      return WLLead.find({ $or: or }).select('businessName contactName email phone status createdAt').sort({ createdAt: -1 }).limit(limit).lean();
    })(),
    (async () => {
      const or = orFor('email', 'phone', (t) => ({ $and: t.map((x) => ({ name: wordStart(x) })) }));
      if (!or.length) return [];
      return Employee.find({ $or: or }).select('name email phone role department status createdAt').limit(limit).lean();
    })(),
  ]);

  // Event titles for everything that references an event.
  const evIds = [...new Set([...rsvps, ...invites, ...participants].map((r) => r.eventId && String(r.eventId)).filter(Boolean))];
  const evDocs = evIds.length ? await Event.find({ _id: { $in: evIds } }).select('title subdomain').lean() : [];
  const evIndex = Object.fromEntries(evDocs.map((e) => [String(e._id), { id: String(e._id), title: e.title, subdomain: e.subdomain }]));
  const ev = (id) => (id && evIndex[String(id)]) || (id ? { id: String(id) } : null);

  const out = {
    rsvps: rsvps.map((r) => ({
      id: String(r._id), event: ev(r.eventId), name: [r.firstName, r.lastName].filter(Boolean).join(' '),
      email: r.email || null, phone: r.phone || null, response: r.response, status: r.status, plusOnes: r.plusOnes || 0,
      checkedIn: !!r.checkedIn, checkedInAt: r.checkedInAt || null, submittedAt: r.submittedAt, deleted: !!r.deletedAt,
      matchedOn: matchedOn(r.email, r.phone),
    })),
    invites: invites.map((r) => ({
      id: String(r._id), event: ev(r.eventId), name: r.guestName, email: r.guestEmail || null, phone: r.guestPhone || null,
      status: r.status, type: r.type, table: r.tableLabel || null, checkedIn: !!r.checkedIn, checkedInAt: r.checkedInAt || null,
      createdAt: r.createdAt, matchedOn: matchedOn(r.guestEmail, r.guestPhone),
    })),
    participants: participants.map((r) => ({
      id: String(r._id), event: ev(r.eventId), username: r.username, role: r.role,
      joinedAt: r.joinedAt, lastSeenAt: r.lastSeenAt, hasAccountPassword: !!r.hasPassword, matchedOn: 'name',
    })),
    leads: leads.map((r) => ({
      id: String(r._id), business: r.businessName, name: r.contactName, email: r.email || null, phone: r.phone || null,
      status: r.status, createdAt: r.createdAt, matchedOn: matchedOn(r.email, r.phone),
    })),
    staff: staff.map((r) => ({
      id: String(r._id), name: r.name, email: r.email || null, phone: r.phone || null, role: r.role,
      department: r.department || null, status: r.status, matchedOn: matchedOn(r.email, r.phone),
    })),
  };

  // Certain identifiers (email/phone matches only) that can be used to widen the search.
  const idEmails = new Set(), idPhones = new Set();
  const harvest = (email, phone, m) => {
    if (m === 'name') return;
    const ne = normEmail(email), np = normPhone(phone);
    if (ne) idEmails.add(ne);
    if (np) idPhones.add(np);
  };
  out.rsvps.forEach((r) => harvest(r.email, r.phone, r.matchedOn));
  out.invites.forEach((r) => harvest(r.email, r.phone, r.matchedOn));
  out.leads.forEach((r) => harvest(r.email, r.phone, r.matchedOn));
  out.staff.forEach((r) => harvest(r.email, r.phone, r.matchedOn));
  out.identifiers = { emails: [...idEmails], phones: [...idPhones] };

  // Events this person is connected to, with how.
  const byEvent = new Map();
  const touch = (e, key, val) => {
    if (!e) return;
    const cur = byEvent.get(e.id) || { ...e, rsvp: null, invite: null, participantRole: null };
    cur[key] = val; byEvent.set(e.id, cur);
  };
  out.rsvps.forEach((r) => touch(r.event, 'rsvp', `${r.response || '?'} / ${r.status || '?'}${r.checkedIn ? ' / checked in' : ''}`));
  out.invites.forEach((r) => touch(r.event, 'invite', `${r.status || '?'}${r.checkedIn ? ' / checked in' : ''}`));
  out.participants.forEach((r) => touch(r.event, 'participantRole', r.role));
  out.events = [...byEvent.values()];
  return out;
}

module.exports = { recordGuestIdentity, findFootprint };
