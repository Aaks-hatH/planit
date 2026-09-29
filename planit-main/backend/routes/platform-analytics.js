'use strict';

/**
 * routes/platform-analytics.js
 *
 * POST /api/platform-analytics/track   — public ingest (no auth required)
 * GET  /api/platform-analytics/dashboard?window=30  — admin only
 */

const express   = require('express');
const router    = express.Router();
const { ingestBatch, getDashboardData, getModel, decryptPayload, blind, normEmail, normPhone, nameTokens } = require('../models/PlatformAnalytics');
const { resolveVisitor, visitorsForIdentity } = require('../services/identityService');
const { verifyAdmin, requirePermission } = require('../middleware/auth');
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

    // PII is only ever written server-side (identityService.recordIdentity).
    // Strip anything a client tries to attach so nobody can poison identities.
    for (const ev of batch) { delete ev.pii; delete ev.ipAddress; }
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

// ─── GET /pii-lookup ──────────────────────────────────────────────────────────
// Data-subject-request tool. Given a session ID, visitor ID, or an email /
// phone / name that was captured on an RSVP or enterprise check-in, returns
// exactly when that person was on the site and what they did, session by
// session. Every lookup is written to the audit log.
//
//   ?q=<session id | visitor id | email | phone | name>
//
// Requires the canExportData permission (super admins always pass).
const MAX_EVENTS       = 5000;   // hard cap on timeline rows returned
const MAX_PII_SCAN     = 20000;  // hard cap on encrypted PII rows we will decrypt
const MAX_VISITORS     = 10;     // cap on distinct visitors a single lookup may resolve

// The frontend's session ID lives in localStorage and never rotates, so one
// "session" is really every visit that browser ever made. To show exact visit
// times we split each session ID into separate visits at gaps of this length.
const VISIT_GAP_MS = 30 * 60 * 1000;

const digitsOnly = (s) => String(s || '').replace(/\D/g, '');

function detailOf(payload) {
  if (payload == null) return null;
  if (typeof payload === 'string') return payload.slice(0, 500);
  try {
    const s = JSON.stringify(payload);
    return s.length > 1000 ? { truncated: true, preview: s.slice(0, 1000) } : payload;
  } catch { return null; }
}

router.get('/pii-lookup', verifyAdmin, requirePermission('canExportData'), async (req, res) => {
  try {
    const q = String(req.query.q || '').trim().slice(0, 200);
    if (q.length < 3) return res.status(400).json({ error: 'Enter at least 3 characters.' });

    const Model = getModel();
    if (!Model) return res.status(503).json({ error: 'Analytics database unavailable' });

    const matchedSessionIds = new Set();
    const visitorIds        = new Set();
    let matchedBy  = null;
    let piiTruncated = false;

    // 1) Direct ID match (session or visitor id) — indexed, fast.
    if (!/\s/.test(q) && !q.includes('@')) {
      const idHits = await Model.find({ $or: [{ sessionId: q }, { visitorId: q }] })
        .select('sessionId visitorId').limit(MAX_EVENTS).lean();
      for (const d of idHits) {
        visitorIds.add(d.visitorId);
        if (d.sessionId === q) matchedSessionIds.add(d.sessionId);
      }
      if (visitorIds.size) matchedBy = matchedSessionIds.size ? 'session_id' : 'visitor_id';
    }

    // 2) PII match (email / phone / name). PII is AES-encrypted at rest so it
    //    can't be queried in Mongo — scan newest records and decrypt in memory.
    // 2a) Blind-index match (fast, no decrypting). Falls through to the scan below if empty.
    if (!visitorIds.size) {
      const looksEmail = q.includes('@');
      const dq = digitsOnly(q);
      const looksPhone = !looksEmail && dq.length >= 7 && dq.length >= q.replace(/[\s()+-]/g, '').length - 1;
      let idxQuery = null;
      if (looksEmail && normEmail(q))      idxQuery = { piiEmailIdx: blind('email', normEmail(q)) };
      else if (looksPhone && normPhone(q)) idxQuery = { piiPhoneIdx: blind('phone', normPhone(q)) };
      else if (!looksEmail && !looksPhone) {
        const toks = nameTokens(q).map((t) => blind('name', t)).filter(Boolean);
        if (toks.length) idxQuery = { piiNameIdx: { $all: toks } };
      }
      if (idxQuery && Object.values(idxQuery)[0]) {
        const vids = await Model.distinct('visitorId', idxQuery);
        vids.slice(0, MAX_VISITORS).forEach((v) => visitorIds.add(v));
        if (visitorIds.size) matchedBy = looksEmail ? 'email' : looksPhone ? 'phone' : 'name';
      }
    }

    // 2b) Fallback: decrypt-and-scan (no blind-index key configured, or substring name match).
    if (!visitorIds.size) {
      const qLower  = q.toLowerCase();
      const qDigits = digitsOnly(q);
      const isEmail = q.includes('@');
      const isPhone = !isEmail && qDigits.length >= 7 && qDigits.length >= q.replace(/[\s()+-]/g, '').length - 1;
      let scanned = 0;
      const cursor = Model.find({ pii: { $ne: null } })
        .select('visitorId sessionId pii').sort({ ts: -1 }).lean().cursor();
      for await (const d of cursor) {
        if (++scanned > MAX_PII_SCAN) { piiTruncated = true; break; }
        if (visitorIds.has(d.visitorId)) continue;
        const pii = decryptPayload(d.pii);
        if (!pii || typeof pii !== 'object') continue;
        const email = String(pii.email || '').toLowerCase();
        const name  = String(pii.name  || '').toLowerCase();
        const phone = digitsOnly(pii.phone);
        const hit = isEmail ? email === qLower
                  : isPhone ? (phone && (phone === qDigits || phone.endsWith(qDigits) || qDigits.endsWith(phone)))
                  : (name && name.includes(qLower)) || (email && email === qLower);
        if (hit) {
          visitorIds.add(d.visitorId);
          if (visitorIds.size >= MAX_VISITORS) break;
        }
      }
      if (visitorIds.size) matchedBy = isEmail ? 'email' : isPhone ? 'phone' : 'name';
    }

    // 2c) Stitch: whoever these visitor IDs turned out to be, add every OTHER browser/device
    //     that submitted the same email or phone. Exact matches only — never name-based.
    let stitchedFrom = 0;
    if (visitorIds.size && matchedBy !== 'name') {
      for (const vid of [...visitorIds]) {
        if (visitorIds.size >= MAX_VISITORS) break;
        const who = await resolveVisitor(vid);
        if (!who) continue;
        for (const other of await visitorsForIdentity(who, { max: MAX_VISITORS })) {
          if (!visitorIds.has(other) && visitorIds.size < MAX_VISITORS) { visitorIds.add(other); stitchedFrom++; }
        }
      }
    }

    await audit('pii_lookup', {
      req, actor: req.admin,
      targetType: 'visitor',
      targetId: [...visitorIds][0] || null,
      details: { query: q, matchedBy, visitorsFound: visitorIds.size, stitchedFrom },
    });

    if (!visitorIds.size) {
      return res.json({ query: q, matchedBy: null, visitors: [], sessions: [], truncated: false, piiTruncated });
    }

    // 3) Full activity for every matched visitor, oldest → newest.
    const docs = await Model.find({ visitorId: { $in: [...visitorIds] } })
      .sort({ ts: 1 }).limit(MAX_EVENTS + 1).lean();
    const truncated = docs.length > MAX_EVENTS;
    if (truncated) docs.length = MAX_EVENTS;

    // Event titles for linked events
    const linkedIds = [...new Set(docs.map(d => d.linkedEventId).filter(v => v && /^[0-9a-f]{24}$/i.test(v)))];
    const evDocs = linkedIds.length
      ? await Event.find({ _id: { $in: linkedIds } }).select('title subdomain').lean() : [];
    const evIndex = Object.fromEntries(evDocs.map(e => [String(e._id), e]));

    const visitors = new Map();
    const sessions = new Map();
    const lastTsBySession = new Map(); // sessionId -> { ts, n }
    for (const d of docs) {
      // visitor rollup
      let v = visitors.get(d.visitorId);
      if (!v) {
        v = { visitorId: d.visitorId, pii: null, firstSeen: d.ts, lastSeen: d.ts, eventCount: 0,
              sessionIds: new Set(), devices: new Set(), browsers: new Set(), countries: new Set(), isSuspected: false };
        visitors.set(d.visitorId, v);
      }
      v.lastSeen = d.ts; v.eventCount++; v.sessionIds.add(d.sessionId);
      if (d.deviceType) v.devices.add(d.deviceType);
      if (d.browser)    v.browsers.add(d.browser);
      if (d.ipCountry)  v.countries.add(d.ipCountry);
      if (d.isSuspected) v.isSuspected = true;
      if (!v.pii && d.pii) { const p = decryptPayload(d.pii); if (p && typeof p === 'object') v.pii = p; }

      // visit rollup (a session ID split on 30-minute gaps; docs are ts-ascending)
      const t = new Date(d.ts).getTime();
      const prev = lastTsBySession.get(d.sessionId);
      const n = !prev ? 1 : (t - prev.ts > VISIT_GAP_MS ? prev.n + 1 : prev.n);
      lastTsBySession.set(d.sessionId, { ts: t, n });
      const visitKey = `${d.sessionId}#${n}`;
      let s = sessions.get(visitKey);
      if (!s) {
        s = { key: visitKey, visit: n, sessionId: d.sessionId, visitorId: d.visitorId, start: d.ts, end: d.ts,
              deviceType: d.deviceType, browser: d.browser, ipCountry: d.ipCountry, ipCity: d.ipCity,
              referrer: d.referrer, utmSource: d.utmSource, utmMedium: d.utmMedium, utmCampaign: d.utmCampaign,
              matched: matchedSessionIds.has(d.sessionId), pageViews: 0, events: [] };
        sessions.set(visitKey, s);
      }
      s.end = d.ts;
      if (d.eventType === 'page_view') s.pageViews++;
      if (!s.referrer && d.referrer) s.referrer = d.referrer;
      const ev = d.linkedEventId ? evIndex[d.linkedEventId] : null;
      s.events.push({
        ts: d.ts,
        eventType: d.eventType,
        page: d.page,
        timeOnPageMs: d.timeOnPageMs,
        detail: detailOf(decryptPayload(d.payload)),
        linkedEvent: ev ? { id: String(ev._id), title: ev.title, subdomain: ev.subdomain } : (d.linkedEventId ? { id: d.linkedEventId } : null),
        rsvpStatus: d.rsvpStatus || null,
        checkedIn: !!d.checkedIn,
      });
    }

    const visitorList = [...visitors.values()].map(v => ({
      ...v,
      sessionCount: v.sessionIds.size,
      sessionIds: undefined,
      devices: [...v.devices], browsers: [...v.browsers], countries: [...v.countries],
    }));
    const sessionList = [...sessions.values()]
      .map(s => ({ ...s, visitsInSession: lastTsBySession.get(s.sessionId)?.n || 1, durationMs: new Date(s.end) - new Date(s.start) }))
      .sort((a, b) => new Date(b.start) - new Date(a.start)); // newest session first

    res.json({
      query: q, matchedBy,
      visitors: visitorList, sessions: sessionList,
      totalEvents: docs.length, truncated, piiTruncated,
      retentionDays: parseInt(process.env.ANALYTICS_RETENTION_DAYS || '90', 10),
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[analytics/pii-lookup] error:', err);
    res.status(500).json({ error: 'Lookup failed' });
  }
});

// ─── POST /pii-lookup/export-log ──────────────────────────────────────────────
// The admin UI builds the downloadable data-request package client-side; this
// records in the audit log that a package for this query was exported.
router.post('/pii-lookup/export-log', verifyAdmin, requirePermission('canExportData'), async (req, res) => {
  try {
    const q = String(req.body?.query || '').slice(0, 200);
    await audit('pii_export', { req, actor: req.admin, targetType: 'visitor',
      details: { query: q, format: String(req.body?.format || 'json').slice(0, 10) } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to log export' });
  }
});

module.exports = router;
