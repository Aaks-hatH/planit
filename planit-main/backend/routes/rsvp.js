'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// RSVP Routes  —  /api/rsvp
//
// Public endpoints (no auth required):
//   GET  /api/rsvp/:eventIdOrSlug/page          — public event info for the RSVP page
//   POST /api/rsvp/:eventIdOrSlug/submit         — submit an RSVP
//   GET  /api/rsvp/submission/:editToken         — guest views their own RSVP
//   PATCH /api/rsvp/submission/:editToken        — guest edits their own RSVP
//
// Organizer-only endpoints:
//   GET    /api/rsvp/:eventId/submissions        — list all submissions
//   PATCH  /api/rsvp/:eventId/submissions/:id    — update a submission
//   DELETE /api/rsvp/:eventId/submissions/:id    — delete a submission
//   POST   /api/rsvp/:eventId/submissions/:id/checkin  — check in a guest
//   GET    /api/rsvp/:eventId/export.csv         — CSV export
//   PATCH  /api/rsvp/:eventId/settings           — update RSVP page settings
//   GET    /api/rsvp/:eventId/stats              — submission stats
// ─────────────────────────────────────────────────────────────────────────────

const express  = require('express');
const router   = express.Router();
const crypto   = require('crypto');
const Event    = require('../models/Event');
const RSVPSubmission = require('../models/RSVPSubmission');
const { verifyOrganizer } = require('../middleware/auth');

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Resolve event by MongoDB ObjectId OR subdomain slug
async function resolveEvent(idOrSlug, selectExtra = '') {
  const isId = /^[0-9a-f]{24}$/i.test(idOrSlug);
  const query = isId
    ? Event.findById(idOrSlug)
    : Event.findOne({ subdomain: idOrSlug.toLowerCase() });
  if (selectExtra) query.select(selectExtra);
  return query.lean();
}

// Safe IP extraction
function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    ''
  );
}

// Generate a secure edit token
function generateEditToken() {
  return crypto.randomBytes(32).toString('hex');
}

// ─── Per-IP-per-event rate limiter ────────────────────────────────────────────
// Tracks submission timestamps keyed on `${eventId}:${ip}`.
// Entries older than RATE_WINDOW_MS are pruned every PRUNE_INTERVAL_MS.
const RATE_WINDOW_MS    = 60 * 60 * 1000; // 1 hour
const PRUNE_INTERVAL_MS =  5 * 60 * 1000; // 5 minutes
const _rateLimitMap = new Map(); // key → number[] (timestamps)

function checkRateLimit(eventId, ip, maxPerWindow) {
  const key  = `${eventId}:${ip}`;
  const now  = Date.now();
  const hits = (_rateLimitMap.get(key) || []).filter(t => now - t < RATE_WINDOW_MS);
  if (hits.length >= maxPerWindow) return false;
  hits.push(now);
  _rateLimitMap.set(key, hits);
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, hits] of _rateLimitMap) {
    const fresh = hits.filter(t => now - t < RATE_WINDOW_MS);
    if (fresh.length === 0) _rateLimitMap.delete(key);
    else _rateLimitMap.set(key, fresh);
  }
}, PRUNE_INTERVAL_MS).unref();

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/rsvp/:eventIdOrSlug/page
// Public — returns all info needed to render the RSVP page
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:eventIdOrSlug/page', async (req, res, next) => {
  try {
    const event = await resolveEvent(req.params.eventIdOrSlug);
    if (!event) return res.status(404).json({ error: 'Event not found.' });

    const rsvpPage = event.rsvpPage || {};

    // Build submission counts for display
    const submissionCounts = await RSVPSubmission.aggregate([
      { $match: { eventId: event._id, deletedAt: null, status: { $in: ['confirmed', 'pending'] } } },
      { $group: { _id: '$response', count: { $sum: 1 }, totalAttendees: { $sum: { $add: ['$plusOnes', 1] } } } },
    ]);

    const counts = { yes: 0, maybe: 0, no: 0, totalAttendees: 0 };
    submissionCounts.forEach(({ _id, count, totalAttendees }) => {
      counts[_id] = count;
      if (_id === 'yes') counts.totalAttendees = totalAttendees;
    });

    // Determine capacity status
    const capacityLimit = rsvpPage.capacityLimit || 0;
    const yesCount = counts.yes;
    const isFull = capacityLimit > 0 && yesCount >= capacityLimit;
    const spotsLeft = capacityLimit > 0 ? Math.max(0, capacityLimit - yesCount) : null;

    // Determine deadline status
    const deadlinePast = rsvpPage.deadline ? new Date() > new Date(rsvpPage.deadline) : false;

    // If closed, return minimal info
    if (rsvpPage.accessMode === 'closed') {
      return res.json({
        eventId:     event._id,
        subdomain:   event.subdomain,
        title:       event.title,
        rsvpPage:    { enabled: false, accessMode: 'closed' },
        closed:      true,
      });
    }

    // Return public-safe event info + RSVP page config
    // Never return rsvpPassword in this endpoint
    const { rsvpPassword: _pw, ...safePage } = rsvpPage;

    res.json({
      eventId:       event._id,
      subdomain:     event.subdomain,
      title:         rsvpPage.welcomeTitle || event.title,
      rawTitle:      event.title,
      description:   event.description,
      date:          event.date,
      timezone:      event.timezone,
      location:      event.location,
      organizerName: event.organizerName,
      isEnterpriseMode: event.isEnterpriseMode,
      rsvpPage:      safePage,
      counts:        rsvpPage.showGuestCount !== false ? counts : null,
      spotsLeft,
      isFull,
      deadlinePast,
      requiresPassword: rsvpPage.accessMode === 'password',
    });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/rsvp/:eventIdOrSlug/submit
// Public — submit an RSVP
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:eventIdOrSlug/submit', async (req, res, next) => {
  try {
    const event = await resolveEvent(
      req.params.eventIdOrSlug,
      '+rsvpPage.rsvpPassword'
    );
    if (!event) return res.status(404).json({ error: 'Event not found.' });

    const rsvpPage = event.rsvpPage || {};

    if (!rsvpPage.enabled) {
      return res.status(403).json({ error: 'RSVP is not enabled for this event.' });
    }
    if (rsvpPage.accessMode === 'closed') {
      return res.status(403).json({ error: 'This event is no longer accepting RSVPs.' });
    }

    // Password check
    if (rsvpPage.accessMode === 'password') {
      const { pagePassword } = req.body;
      if (!pagePassword || pagePassword !== rsvpPage.rsvpPassword) {
        return res.status(403).json({ error: 'Incorrect password.', requiresPassword: true });
      }
    }

    // Deadline check
    if (rsvpPage.deadline && new Date() > new Date(rsvpPage.deadline)) {
      return res.status(403).json({ error: rsvpPage.deadlineMessage || 'The RSVP deadline has passed.' });
    }

    // Honeypot check (bot trap field must be empty)
    if (rsvpPage.enableHoneypot !== false && req.body._hp) {
      // Silently accept but do not store
      return res.json({ success: true, editToken: generateEditToken() });
    }

    // Per-IP rate limit
    const ip         = getClientIp(req);
    const maxPerHour = rsvpPage.rateLimitPerIp ?? 5;
    if (maxPerHour > 0 && !checkRateLimit(event._id.toString(), ip, maxPerHour)) {
      return res.status(429).json({ error: 'Too many RSVP submissions from your network. Please try again later.' });
    }

    const {
      response,
      firstName,
      lastName,
      email,
      phone,
      plusOnes,
      plusOneDetails,
      dietaryRestrictions,
      accessibilityNeeds,
      customAnswers,
      guestNote,
    } = req.body;

    // Validate response
    const allowed = [];
    if (rsvpPage.allowYes !== false) allowed.push('yes');
    if (rsvpPage.allowMaybe !== false) allowed.push('maybe');
    if (rsvpPage.allowNo !== false) allowed.push('no');
    if (!allowed.includes(response)) {
      return res.status(400).json({ error: 'Invalid RSVP response.' });
    }

    // Required field validation
    if (!firstName?.trim()) {
      return res.status(400).json({ error: 'First name is required.' });
    }
    if (rsvpPage.requireLastName && !lastName?.trim()) {
      return res.status(400).json({ error: 'Last name is required.' });
    }
    if (rsvpPage.requireEmail && !email?.trim()) {
      return res.status(400).json({ error: 'Email address is required.' });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }
    if (rsvpPage.requirePhone && !phone?.trim()) {
      return res.status(400).json({ error: 'Phone number is required.' });
    }

    // Capacity check (only for 'yes' responses)
    if (response === 'yes') {
      const capacityLimit = rsvpPage.capacityLimit || 0;
      if (capacityLimit > 0) {
        const yesCount = await RSVPSubmission.countDocuments({
          eventId:  event._id,
          response: 'yes',
          status:   { $in: ['confirmed', 'pending'] },
          deletedAt: null,
        });
        if (yesCount >= capacityLimit) {
          if (rsvpPage.enableWaitlist !== false) {
            // Put on waitlist
            const editToken = generateEditToken();
            const submission = await RSVPSubmission.create({
              eventId:   event._id,
              response,
              firstName: firstName.trim(),
              lastName:  lastName?.trim() || '',
              email:     email?.trim().toLowerCase() || '',
              phone:     phone?.trim() || '',
              plusOnes:  Number(plusOnes) || 0,
              plusOneDetails: Array.isArray(plusOneDetails) ? plusOneDetails.slice(0, rsvpPage.maxPlusOnes || 5) : [],
              dietaryRestrictions: dietaryRestrictions?.trim() || '',
              accessibilityNeeds:  accessibilityNeeds?.trim() || '',
              customAnswers:       Array.isArray(customAnswers) ? customAnswers : [],
              guestNote:           guestNote?.trim() || '',
              status:    'waitlisted',
              editToken,
              ipAddress: getClientIp(req),
              userAgent: req.headers['user-agent'] || '',
            });
            return res.json({
              success:   true,
              waitlisted: true,
              message:   rsvpPage.waitlistMessage || 'You have been added to the waitlist.',
              editToken,
              submissionId: submission._id,
            });
          }
          return res.status(409).json({ error: 'This event has reached capacity.' });
        }
      }
    }

    // Duplicate email check
    let isDuplicateSubmission = false;
    if (email && rsvpPage.duplicateEmailPolicy !== 'allow') {
      const existing = await RSVPSubmission.findOne({
        eventId: event._id,
        email:   email.trim().toLowerCase(),
        deletedAt: null,
      }).lean();
      if (existing) {
        if (rsvpPage.duplicateEmailPolicy === 'block') {
          return res.status(409).json({
            error: 'An RSVP from this email address already exists.',
            existingToken: existing.editToken,
          });
        }
        // warn_organizer — continue but flag the submission as a duplicate
        isDuplicateSubmission = true;
      }
    }

    // Determine initial status
    // Accept both legacy 'approval' and current UI value 'manual_approval'
    const requiresApproval = rsvpPage.confirmationMode === 'approval' || rsvpPage.confirmationMode === 'manual_approval';
    const status = requiresApproval ? 'pending' : 'confirmed';

    const editToken = generateEditToken();
    const submission = await RSVPSubmission.create({
      eventId:   event._id,
      response,
      firstName: firstName.trim(),
      lastName:  lastName?.trim() || '',
      email:     email?.trim().toLowerCase() || '',
      phone:     phone?.trim() || '',
      plusOnes:  Number(plusOnes) || 0,
      plusOneDetails: Array.isArray(plusOneDetails) ? plusOneDetails.slice(0, rsvpPage.maxPlusOnes || 5) : [],
      dietaryRestrictions: dietaryRestrictions?.trim() || '',
      accessibilityNeeds:  accessibilityNeeds?.trim() || '',
      customAnswers:       Array.isArray(customAnswers) ? customAnswers : [],
      guestNote:           guestNote?.trim() || '',
      status,
      editToken,
      duplicateFlag: isDuplicateSubmission,
      ipAddress: getClientIp(req),
      userAgent: req.headers['user-agent'] || '',
    });

    res.status(201).json({
      success:     true,
      submissionId: submission._id,
      editToken,
      status,
      isPending:   status === 'pending',
      message:     status === 'pending'
        ? 'Your RSVP has been submitted and is awaiting approval.'
        : (rsvpPage.confirmationMessage || 'Your RSVP has been confirmed.'),
    });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/rsvp/submission/:editToken
// Public — guest views their own RSVP
// ─────────────────────────────────────────────────────────────────────────────
router.get('/submission/:editToken', async (req, res, next) => {
  try {
    const submission = await RSVPSubmission.findOne({
      editToken: req.params.editToken,
      deletedAt: null,
    }).lean();
    if (!submission) return res.status(404).json({ error: 'RSVP not found.' });

    const event = await Event.findById(submission.eventId)
      .select('title date timezone location rsvpPage')
      .lean();

    res.json({ submission, event });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/rsvp/submission/:editToken
// Public — guest edits their own RSVP
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/submission/:editToken', async (req, res, next) => {
  try {
    const submission = await RSVPSubmission.findOne({
      editToken: req.params.editToken,
      deletedAt: null,
    });
    if (!submission) return res.status(404).json({ error: 'RSVP not found.' });

    // Check edit cutoff
    const event = await Event.findById(submission.eventId).select('rsvpPage').lean();
    const rsvpPage = event?.rsvpPage || {};
    const cutoffHours = rsvpPage.editCutoffHours ?? 24;
    if (rsvpPage.allowGuestEdit === false) {
      return res.status(403).json({ error: 'Editing RSVPs is not allowed for this event.' });
    }
    if (event?.date && cutoffHours > 0) {
      const cutoff = new Date(event.date);
      cutoff.setHours(cutoff.getHours() - cutoffHours);
      if (new Date() > cutoff) {
        return res.status(403).json({ error: 'The edit window for this RSVP has closed.' });
      }
    }

    const allowed = [];
    if (rsvpPage.allowYes !== false) allowed.push('yes');
    if (rsvpPage.allowMaybe !== false) allowed.push('maybe');
    if (rsvpPage.allowNo !== false) allowed.push('no');

    const {
      response, firstName, lastName, email, phone,
      plusOnes, plusOneDetails, dietaryRestrictions,
      accessibilityNeeds, customAnswers, guestNote,
    } = req.body;

    if (response && !allowed.includes(response)) {
      return res.status(400).json({ error: 'Invalid RSVP response.' });
    }
    if (response) submission.response = response;
    if (firstName !== undefined) submission.firstName = firstName.trim();
    if (lastName  !== undefined) submission.lastName  = lastName.trim();
    if (email     !== undefined) submission.email     = email.trim().toLowerCase();
    if (phone     !== undefined) submission.phone     = phone.trim();
    if (plusOnes  !== undefined) submission.plusOnes  = Number(plusOnes) || 0;
    if (Array.isArray(plusOneDetails)) submission.plusOneDetails = plusOneDetails.slice(0, rsvpPage.maxPlusOnes || 5);
    if (dietaryRestrictions !== undefined) submission.dietaryRestrictions = dietaryRestrictions.trim();
    if (accessibilityNeeds  !== undefined) submission.accessibilityNeeds  = accessibilityNeeds.trim();
    if (Array.isArray(customAnswers))      submission.customAnswers        = customAnswers;
    if (guestNote !== undefined)           submission.guestNote            = guestNote.trim();
    submission.updatedAt = new Date();

    await submission.save();
    res.json({ success: true, submission });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/rsvp/:eventId/verify-password
// Public — verify RSVP page password
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:eventId/verify-password', async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.eventId)
      .select('+rsvpPage.rsvpPassword rsvpPage.accessMode')
      .lean();
    if (!event) return res.status(404).json({ error: 'Event not found.' });

    const { password } = req.body;
    const stored = event.rsvpPage?.rsvpPassword;

    if (!stored || password === stored) {
      return res.json({ success: true });
    }
    res.status(403).json({ error: 'Incorrect password.' });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// ─── ORGANIZER-ONLY ROUTES ────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/rsvp/:eventId/settings
// Organizer — get current RSVP page settings (with password)
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:eventId/settings', verifyOrganizer, async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.eventId)
      .select('rsvpPage subdomain title')
      .lean();
    if (!event) return res.status(404).json({ error: 'Event not found.' });

    res.json({
      rsvpPage:  event.rsvpPage || {},
      subdomain: event.subdomain,
      title:     event.title,
    });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/rsvp/:eventId/settings
// Organizer — update RSVP page settings
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:eventId/settings', verifyOrganizer, async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event) return res.status(404).json({ error: 'Event not found.' });

    const ALLOWED = [
      'enabled', 'accessMode', 'rsvpPassword', 'confirmationMode',
      'coverImageUrl', 'logoUrl', 'backgroundImageUrl', 'accentColor', 'backgroundStyle', 'fontStyle',
      'bannerText', 'bannerColor', 'bannerEnabled', 'hideBranding',
      'heroTagline', 'welcomeTitle', 'welcomeMessage',
      'deadline', 'deadlineMessage', 'capacityLimit', 'enableWaitlist', 'waitlistMessage',
      'allowYes', 'allowMaybe', 'allowNo', 'yesButtonLabel', 'maybeButtonLabel', 'noButtonLabel',
      'requireFirstName', 'requireLastName',
      'collectEmail', 'requireEmail', 'collectPhone', 'requirePhone',
      'allowPlusOnes', 'maxPlusOnes', 'requirePlusOneNames', 'collectPlusOneDietary',
      'collectDietary', 'dietaryLabel', 'collectAccessibility', 'accessibilityLabel',
      'allowGuestNote', 'guestNoteLabel', 'guestNotePlaceholder',
      'customQuestions',
      'confirmationTitle', 'confirmationMessage', 'confirmationImageUrl',
      'showEventSpaceButton', 'eventSpaceButtonLabel', 'showAddToCalendar', 'showShareButton',
      'sendGuestConfirmation', 'confirmationEmailSubject', 'confirmationEmailBody',
      'notifyOrganizerOnRsvp', 'organizerNotifyEmail',
      'showGuestCount', 'showEventDate', 'showEventLocation', 'showEventDescription',
      'showHostName', 'showCountdown', 'allowGuestEdit', 'editCutoffHours',
      'rateLimitPerIp', 'duplicateEmailPolicy', 'enableHoneypot',
    ];

    if (!event.rsvpPage) event.rsvpPage = {};

    ALLOWED.forEach(key => {
      if (req.body[key] !== undefined) {
        event.rsvpPage[key] = req.body[key];
      }
    });

    // Coerce deadline
    if (req.body.deadline !== undefined) {
      event.rsvpPage.deadline = req.body.deadline ? new Date(req.body.deadline) : null;
    }

    event.rsvpPage.updatedAt = new Date();
    event.rsvpPage.updatedBy = req.eventAccess?.username || '';
    event.markModified('rsvpPage');
    await event.save();

    const { rsvpPassword: _pw, ...safePage } = event.rsvpPage.toObject
      ? event.rsvpPage.toObject()
      : event.rsvpPage;

    res.json({ success: true, rsvpPage: safePage });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/rsvp/:eventId/submissions
// Organizer — list all submissions with filtering + pagination
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:eventId/submissions', verifyOrganizer, async (req, res, next) => {
  try {
    const {
      status, response, search, starred,
      page = 1, limit = 50, sort = '-submittedAt',
    } = req.query;

    const filter = {
      eventId:   req.params.eventId,
      deletedAt: null,
    };

    if (status)   filter.status   = status;
    if (response) filter.response = response;
    if (starred === 'true') filter.starred = true;

    if (search) {
      const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { firstName: re },
        { lastName:  re },
        { email:     re },
        { phone:     re },
      ];
    }

    const total = await RSVPSubmission.countDocuments(filter);
    const submissions = await RSVPSubmission
      .find(filter)
      .sort(sort)
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .lean();

    // Aggregate stats
    const stats = await RSVPSubmission.aggregate([
      { $match: { eventId: require('mongoose').Types.ObjectId.createFromHexString
          ? require('mongoose').Types.ObjectId.createFromHexString(req.params.eventId)
          : new (require('mongoose').Types.ObjectId)(req.params.eventId),
        deletedAt: null } },
      { $group: {
          _id: null,
          totalYes:   { $sum: { $cond: [{ $eq: ['$response', 'yes'] }, 1, 0] } },
          totalMaybe: { $sum: { $cond: [{ $eq: ['$response', 'maybe'] }, 1, 0] } },
          totalNo:    { $sum: { $cond: [{ $eq: ['$response', 'no'] }, 1, 0] } },
          totalAttendees: { $sum: { $cond: [{ $eq: ['$response', 'yes'] }, { $add: ['$plusOnes', 1] }, 0] } },
          pending:    { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          waitlisted: { $sum: { $cond: [{ $eq: ['$status', 'waitlisted'] }, 1, 0] } },
          checkedIn:  { $sum: { $cond: ['$checkedIn', 1, 0] } },
      }},
    ]);

    res.json({
      submissions,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      stats: stats[0] || { totalYes: 0, totalMaybe: 0, totalNo: 0, totalAttendees: 0, pending: 0, waitlisted: 0, checkedIn: 0 },
    });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/rsvp/:eventId/submissions/:submissionId
// Organizer — update a submission (status, notes, tags, starred)
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:eventId/submissions/:submissionId', verifyOrganizer, async (req, res, next) => {
  try {
    const submission = await RSVPSubmission.findOne({
      _id:     req.params.submissionId,
      eventId: req.params.eventId,
    });
    if (!submission) return res.status(404).json({ error: 'Submission not found.' });

    const EDITABLE = [
      'status', 'response', 'organizerNotes', 'tags', 'starred',
      'firstName', 'lastName', 'email', 'phone',
      'plusOnes', 'plusOneDetails', 'dietaryRestrictions',
      'accessibilityNeeds', 'guestNote',
    ];

    EDITABLE.forEach(key => {
      if (req.body[key] !== undefined) submission[key] = req.body[key];
    });
    submission.updatedAt = new Date();
    await submission.save();

    res.json({ success: true, submission });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/rsvp/:eventId/submissions/:submissionId
// Organizer — soft-delete a submission
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:eventId/submissions/:submissionId', verifyOrganizer, async (req, res, next) => {
  try {
    const submission = await RSVPSubmission.findOne({
      _id:     req.params.submissionId,
      eventId: req.params.eventId,
    });
    if (!submission) return res.status(404).json({ error: 'Submission not found.' });

    submission.deletedAt = new Date();
    await submission.save();
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/rsvp/:eventId/submissions/:submissionId/checkin
// Organizer — mark a guest as checked in
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:eventId/submissions/:submissionId/checkin', verifyOrganizer, async (req, res, next) => {
  try {
    const submission = await RSVPSubmission.findOne({
      _id:     req.params.submissionId,
      eventId: req.params.eventId,
    });
    if (!submission) return res.status(404).json({ error: 'Submission not found.' });

    submission.checkedIn   = true;
    submission.checkedInAt = new Date();
    await submission.save();

    res.json({ success: true, submission });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/rsvp/:eventId/submissions/:submissionId/undo-checkin
// Organizer — undo check-in
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:eventId/submissions/:submissionId/undo-checkin', verifyOrganizer, async (req, res, next) => {
  try {
    const submission = await RSVPSubmission.findOne({
      _id:     req.params.submissionId,
      eventId: req.params.eventId,
    });
    if (!submission) return res.status(404).json({ error: 'Submission not found.' });

    submission.checkedIn   = false;
    submission.checkedInAt = null;
    await submission.save();

    res.json({ success: true, submission });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/rsvp/:eventId/submissions/bulk-approve
// Organizer — approve multiple pending submissions at once
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:eventId/submissions/bulk-approve', verifyOrganizer, async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No submission IDs provided.' });
    }
    await RSVPSubmission.updateMany(
      { _id: { $in: ids }, eventId: req.params.eventId, status: 'pending' },
      { $set: { status: 'confirmed', updatedAt: new Date() } }
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/rsvp/:eventId/submissions/bulk-decline
// Organizer — decline multiple submissions at once
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:eventId/submissions/bulk-decline', verifyOrganizer, async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No submission IDs provided.' });
    }
    await RSVPSubmission.updateMany(
      { _id: { $in: ids }, eventId: req.params.eventId },
      { $set: { status: 'declined', updatedAt: new Date() } }
    );
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/rsvp/:eventId/export.csv
// Organizer — export all submissions as CSV
// Auth: accepts token via Authorization header OR ?token= query param
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:eventId/export.csv', async (req, res, next) => {
  try {
    // Allow token in query string for download links
    const jwt   = require('jsonwebtoken');
    const { secrets } = require('../keys');
    const token = req.headers.authorization?.split(' ')[1] ||
                  req.headers['x-event-token'] ||
                  req.query.token;
    if (!token) return res.status(401).json({ error: 'Unauthorized.' });

    let decoded;
    try { decoded = jwt.verify(token, secrets.jwt); }
    catch { return res.status(401).json({ error: 'Invalid or expired token.' }); }

    const eventId = req.params.eventId;
    if (!decoded.isAdminAccess && decoded.eventId !== eventId && decoded.eventId !== eventId?.toString()) {
      return res.status(403).json({ error: 'Token does not match this event.' });
    }
    if (decoded.role !== 'organizer' && !decoded.isAdminAccess) {
      // Check participant role in event
      const Event = require('../models/Event');
      const ev = await Event.findById(eventId).select('participants').lean();
      if (!ev) return res.status(404).json({ error: 'Event not found.' });
      const part = ev.participants.find(p => p.username === decoded.username);
      if (!part || part.role !== 'organizer') {
        return res.status(403).json({ error: 'Only organizers can export RSVPs.' });
      }
    }
    const event = await Event.findById(req.params.eventId).select('title rsvpPage').lean();
    if (!event) return res.status(404).json({ error: 'Event not found.' });

    const submissions = await RSVPSubmission.find({
      eventId:   req.params.eventId,
      deletedAt: null,
    }).sort('-submittedAt').lean();

    const customQuestions = (event.rsvpPage?.customQuestions || []);

    const escape = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const headers = [
      'First Name', 'Last Name', 'Email', 'Phone',
      'Response', 'Status', 'Plus Ones', 'Total Attendees',
      'Dietary', 'Accessibility', 'Guest Note',
      'Starred', 'Tags', 'Organizer Notes',
      'Checked In', 'Checked In At', 'Submitted At',
      ...customQuestions.map(q => q.label || q.question || `Q${q.id}`),
    ];

    const rows = submissions.map(s => {
      const customCols = customQuestions.map(q => {
        const ans = (s.customAnswers || []).find(a => a.questionId === q.id);
        if (!ans) return '';
        return Array.isArray(ans.answer) ? ans.answer.join('; ') : String(ans.answer || '');
      });
      return [
        s.firstName, s.lastName, s.email, s.phone,
        s.response, s.status,
        s.plusOnes, 1 + (s.plusOnes || 0),
        s.dietaryRestrictions, s.accessibilityNeeds, s.guestNote,
        s.starred ? 'Yes' : 'No',
        (s.tags || []).join('; '),
        s.organizerNotes,
        s.checkedIn ? 'Yes' : 'No',
        s.checkedInAt ? new Date(s.checkedInAt).toISOString() : '',
        new Date(s.submittedAt).toISOString(),
        ...customCols,
      ].map(escape).join(',');
    });

    const csv = [headers.map(escape).join(','), ...rows].join('\r\n');
    const filename = `rsvps-${event.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${Date.now()}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csv); // BOM for Excel compatibility
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/rsvp/:eventId/stats
// Organizer — detailed statistics
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:eventId/stats', verifyOrganizer, async (req, res, next) => {
  try {
    const mongoose = require('mongoose');
    const eventObjectId = mongoose.Types.ObjectId.createFromHexString
      ? mongoose.Types.ObjectId.createFromHexString(req.params.eventId)
      : new mongoose.Types.ObjectId(req.params.eventId);

    const [summary, byDay, byTag] = await Promise.all([
      RSVPSubmission.aggregate([
        { $match: { eventId: eventObjectId, deletedAt: null } },
        { $group: {
          _id: null,
          totalYes:      { $sum: { $cond: [{ $eq: ['$response', 'yes']   }, 1, 0] } },
          totalMaybe:    { $sum: { $cond: [{ $eq: ['$response', 'maybe'] }, 1, 0] } },
          totalNo:       { $sum: { $cond: [{ $eq: ['$response', 'no']    }, 1, 0] } },
          totalAttendees:{ $sum: { $cond: [{ $eq: ['$response', 'yes']   }, { $add: ['$plusOnes', 1] }, 0] } },
          pending:       { $sum: { $cond: [{ $eq: ['$status', 'pending']    }, 1, 0] } },
          waitlisted:    { $sum: { $cond: [{ $eq: ['$status', 'waitlisted'] }, 1, 0] } },
          declined:      { $sum: { $cond: [{ $eq: ['$status', 'declined']   }, 1, 0] } },
          checkedIn:     { $sum: { $cond: ['$checkedIn', 1, 0] } },
          withEmail:     { $sum: { $cond: [{ $gt: [{ $strLenCP: { $ifNull: ['$email', ''] } }, 0] }, 1, 0] } },
          withPhone:     { $sum: { $cond: [{ $gt: [{ $strLenCP: { $ifNull: ['$phone', ''] } }, 0] }, 1, 0] } },
          hasDietary:    { $sum: { $cond: [{ $gt: [{ $strLenCP: { $ifNull: ['$dietaryRestrictions', ''] } }, 0] }, 1, 0] } },
          starred:       { $sum: { $cond: ['$starred', 1, 0] } },
        }},
      ]),
      RSVPSubmission.aggregate([
        { $match: { eventId: eventObjectId, deletedAt: null } },
        { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$submittedAt' } },
          count: { $sum: 1 },
        }},
        { $sort: { _id: 1 } },
        { $limit: 90 },
      ]),
      RSVPSubmission.aggregate([
        { $match: { eventId: eventObjectId, deletedAt: null } },
        { $unwind: { path: '$tags', preserveNullAndEmptyArrays: false } },
        { $group: { _id: '$tags', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 20 },
      ]),
    ]);

    res.json({
      summary: summary[0] || {},
      byDay:   byDay.map(d => ({ date: d._id, count: d.count })),
      byTag:   byTag.map(t => ({ tag: t._id, count: t.count })),
    });
  } catch (err) { next(err); }
});

module.exports = router;
