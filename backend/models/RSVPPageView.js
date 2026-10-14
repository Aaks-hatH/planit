'use strict';

const mongoose = require('mongoose');

/**
 * models/RSVPPageView.js
 *
 * One row per de-duplicated "open" of a public RSVP page — backs the
 * Analytics tab in RSVPEventDashboard.jsx ("X people opened it, Y RSVP'd").
 *
 * DEDUPLICATION
 * ─────────────
 * sessionHash is a salted, one-way hash of (ip + userAgent + calendar day),
 * built in routes/rsvp.js. Because the day is baked into the hash itself,
 * the same visitor reloading the page five times in one afternoon collapses
 * into a single row (unique index below), but still counts as a fresh open
 * the next day. The raw IP is never stored — only this hash.
 *
 * This deliberately does NOT try to be a general-purpose analytics event
 * store (see PlatformAnalytics.js for that, in the main app's audit DB) —
 * it exists only to answer "how many distinct people opened this RSVP
 * page", as plainly as possible.
 *
 * RETENTION
 * ─────────
 * TTL-purged 45 days after openedAt — comfortably past the app's existing
 * 7-day-post-event guest-data deletion window (see routes/
 * dataRetention7Days.js), since this is aggregate traffic data rather than
 * the guest PII itself, but there's no reason to keep it indefinitely.
 */
const rsvpPageViewSchema = new mongoose.Schema({
  eventId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, index: true },
  sessionHash: { type: String, required: true },
  openedAt:    { type: Date, default: Date.now },
});

// One row per (event, visitor, day) — a duplicate insert attempt for the
// same visitor on the same day throws E11000, which routes/rsvp.js treats
// as "already counted today" and silently ignores.
rsvpPageViewSchema.index({ eventId: 1, sessionHash: 1 }, { unique: true });

rsvpPageViewSchema.index({ openedAt: 1 }, { expireAfterSeconds: 45 * 24 * 60 * 60 });

module.exports = mongoose.model('RSVPPageView', rsvpPageViewSchema);
