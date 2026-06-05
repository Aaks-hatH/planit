'use strict';

/**
 * routes/platform-analytics.js
 *
 * POST /api/platform-analytics/track   — public ingest (no auth required)
 * GET  /api/platform-analytics/dashboard?window=30  — admin only
 */

const express   = require('express');
const router    = express.Router();
const { ingestBatch, getDashboardData, getModel, decryptPayload } = require('../models/PlatformAnalytics');
const { verifyAdmin }                   = require('../middleware/auth');
const Event                             = require('../models/Event');
const { audit }                         = require('../models/AuditLog');

// ─── POST /track ──────────────────────────────────────────────────────────────
// Receives a batch of tracking events from the frontend.
// Public — no auth. Rate-limited by the global apiLimiter (already applied).
// Silently drops invalid events rather than returning errors so a bad payload
// never breaks the user's page interaction.
router.post('/track', async (req, res) => {
  // Respond immediately — analytics should never block the user
  res.status(202).json({ ok: true });

  // Process asynchronously so the response is already sent
  try {
    const { events } = req.body || {};
    if (!Array.isArray(events) || events.length === 0) return;

    // Safety cap — never accept more than 50 events per batch
    const batch = events.slice(0, 50).filter(ev => {
      const VALID_TYPES = [
        'page_view', 'page_exit', 'click', 'scroll_depth',
        'feature_use', 'session_start', 'session_end',
        'error', 'outbound_link', 'search',
      ];
      return ev && typeof ev.eventType === 'string' && VALID_TYPES.includes(ev.eventType);
    });

    await ingestBatch(batch, req);
  } catch (err) {
    // Fire-and-forget — never surface to client
    console.error('[analytics/track] non-fatal:', err.message);
  }
});

// ─── GET /dashboard ───────────────────────────────────────────────────────────
// Admin-only. Returns aggregated analytics for the requested window.
router.get('/dashboard', verifyAdmin, async (req, res) => {
  try {
    const windowDays = Math.min(Math.max(parseInt(req.query.window || '30', 10), 1), 365);
    const data = await getDashboardData(windowDays);
    if (!data) return res.status(503).json({ error: 'Analytics database unavailable' });
    res.json(data);
  } catch (err) {
    console.error('[analytics/dashboard] error:', err);
    res.status(500).json({ error: 'Failed to load analytics' });
  }
});

// ─── GET /by-event/:eventId ───────────────────────────────────────────────────
// Per-event visitor profiles, grouped in application code.
router.get('/by-event/:eventId', verifyAdmin, async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await Event.findById(eventId).lean();
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const Model = getModel();
    if (!Model) return res.status(503).json({ error: 'Analytics unavailable' });

    const rawDocs = await Model.find({ linkedEventId: eventId }).sort({ ts: 1 }).lean();

    // Group by visitorId in application code
    const profileMap = new Map();
    for (const doc of rawDocs) {
      const vid = doc.visitorId || 'unknown';
      if (!profileMap.has(vid)) {
        profileMap.set(vid, {
          visitorId:        vid,
          pii:              null,
          firstSeen:        doc.ts,
          lastSeen:         doc.ts,
          sessionCount:     0,
          eventTypes:       [],
          rsvpStatus:       null,
          checkedIn:        false,
          checkedInAt:      null,
          ipHash:           null,
          ipCountry:        null,
          ipCity:           null,
          guestReturnCount: 0,
          isSuspected:      false,
          spamRiskSignal:   null,
        });
      }
      const p = profileMap.get(vid);
      p.sessionCount++;
      if (doc.ts < p.firstSeen) p.firstSeen = doc.ts;
      if (doc.ts > p.lastSeen)  p.lastSeen  = doc.ts;
      if (!p.pii && doc.pii) p.pii = decryptPayload(doc.pii);
      if (!p.eventTypes.includes(doc.eventType)) p.eventTypes.push(doc.eventType);
      if (doc.rsvpStatus) p.rsvpStatus = doc.rsvpStatus;
      if (doc.checkedIn)  { p.checkedIn = true; p.checkedInAt = p.checkedInAt || doc.checkedInAt; }
      if (doc.ipHash)    p.ipHash    = doc.ipHash;
      if (doc.ipCountry) p.ipCountry = doc.ipCountry;
      if (doc.ipCity)    p.ipCity    = doc.ipCity;
      if ((doc.guestReturnCount || 0) > p.guestReturnCount) p.guestReturnCount = doc.guestReturnCount;
      if (doc.isSuspected)  p.isSuspected = true;
      if (doc.spamRiskSignal != null) p.spamRiskSignal = Math.max(p.spamRiskSignal ?? 0, doc.spamRiskSignal);
    }

    let profiles = Array.from(profileMap.values());

    // Sorting
    const sortBy = req.query.sort;
    if (sortBy === 'spamRiskSignal') {
      profiles.sort((a, b) => (b.spamRiskSignal ?? 0) - (a.spamRiskSignal ?? 0));
    } else if (sortBy === 'guestReturnCount') {
      profiles.sort((a, b) => b.guestReturnCount - a.guestReturnCount);
    } else if (sortBy === 'checkedIn') {
      profiles.sort((a, b) => (b.checkedIn ? 1 : 0) - (a.checkedIn ? 1 : 0));
    } else {
      profiles.sort((a, b) => new Date(b.firstSeen) - new Date(a.firstSeen));
    }

    // Aggregates
    const rsvpBreakdown = { yes: 0, maybe: 0, no: 0, waitlist: 0 };
    let totalCheckedIn = 0, suspectedCount = 0;
    for (const p of profiles) {
      if (p.rsvpStatus) rsvpBreakdown[p.rsvpStatus] = (rsvpBreakdown[p.rsvpStatus] || 0) + 1;
      if (p.checkedIn)  totalCheckedIn++;
      if (p.isSuspected) suspectedCount++;
    }

    res.json({
      event,
      profiles,
      aggregates: {
        totalSessions:    rawDocs.length,
        uniqueVisitors:   profiles.length,
        totalCheckedIn,
        rsvpBreakdown,
        suspectedCount,
      },
    });
  } catch (err) {
    console.error('[analytics/by-event] error:', err);
    res.status(500).json({ error: 'Failed to load event analytics' });
  }
});

// ─── GET /guest/:visitorId ────────────────────────────────────────────────────
// Full cross-event profile for a single visitor.
router.get('/guest/:visitorId', verifyAdmin, async (req, res) => {
  try {
    const { visitorId } = req.params;
    const Model = getModel();
    if (!Model) return res.status(503).json({ error: 'Analytics unavailable' });

    const allDocs = await Model.find({ visitorId }).sort({ ts: 1 }).lean();
    if (!allDocs.length) return res.status(404).json({ error: 'Visitor not found' });

    // Decrypt PII from first doc that has it
    let globalPii = null;
    for (const d of allDocs) {
      if (d.pii) { globalPii = decryptPayload(d.pii); break; }
    }

    // Group by linkedEventId
    const eventMap = new Map();
    for (const doc of allDocs) {
      const eid = doc.linkedEventId || '__unknown__';
      if (!eventMap.has(eid)) eventMap.set(eid, []);
      eventMap.get(eid).push(doc);
    }

    // Fetch event details for each unique event ID
    const eventIds = [...eventMap.keys()].filter(e => e !== '__unknown__');
    const eventDocs = await Event.find({ _id: { $in: eventIds } })
      .select('title date subdomain organizerName organizerEmail').lean();
    const eventIndex = Object.fromEntries(eventDocs.map(e => [String(e._id), e]));

    const allEvents = [];
    for (const [eid, docs] of eventMap.entries()) {
      const ev = eventIndex[eid] || null;
      const firstDoc = docs[0];
      let rsvpStatus = null, checkedIn = false, spamRiskSignal = null;
      const timeline = [];
      for (const d of docs) {
        timeline.push({ eventType: d.eventType, ts: d.ts });
        if (d.rsvpStatus) rsvpStatus = d.rsvpStatus;
        if (d.checkedIn)  checkedIn  = true;
        if (d.spamRiskSignal != null) spamRiskSignal = Math.max(spamRiskSignal ?? 0, d.spamRiskSignal);
      }
      allEvents.push({
        eventId:      eid,
        eventDetails: ev,
        firstSeen:    firstDoc.ts,
        timeline,
        rsvpStatus,
        checkedIn,
        spamRiskSignal,
      });
    }

    allEvents.sort((a, b) => new Date(b.firstSeen) - new Date(a.firstSeen));

    const totalFlagged  = allDocs.filter(d => d.isSuspected).length;
    const isSuspected   = allDocs.some(d => d.isSuspected);

    res.json({
      visitorId,
      pii: globalPii,
      globalStats: {
        distinctEvents:  allEvents.length,
        totalSessions:   allDocs.length,
        flaggedCount:    totalFlagged,
        isSuspected,
      },
      allEvents,
    });
  } catch (err) {
    console.error('[analytics/guest] error:', err);
    res.status(500).json({ error: 'Failed to load guest profile' });
  }
});

// ─── POST /flag-visitor ───────────────────────────────────────────────────────
// Admin: flag or unflag all analytics documents for a visitor.
router.post('/flag-visitor', verifyAdmin, async (req, res) => {
  try {
    const { visitorId, isSuspected, reason } = req.body || {};
    if (!visitorId) return res.status(400).json({ error: 'visitorId required' });
    if (typeof isSuspected !== 'boolean') return res.status(400).json({ error: 'isSuspected must be boolean' });

    const Model = getModel();
    if (!Model) return res.status(503).json({ error: 'Analytics unavailable' });

    const result = await Model.updateMany(
      { visitorId },
      { $set: { isSuspected, adminFlagReason: reason ? String(reason).slice(0, 500) : null } }
    );

    await audit({
      action:   'visitor_flagged',
      actorId:  req.admin?.id,
      actorName: req.admin?.username,
      details:  { visitorId, isSuspected, reason },
    });

    res.json({ modifiedCount: result.modifiedCount });
  } catch (err) {
    console.error('[analytics/flag-visitor] error:', err);
    res.status(500).json({ error: 'Failed to flag visitor' });
  }
});

module.exports = router;