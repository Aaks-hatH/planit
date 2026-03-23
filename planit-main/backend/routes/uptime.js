const express      = require('express');
const router       = express.Router();
const { realIp }   = require('../middleware/realIp');
const mongoose     = require('mongoose');
const axios        = require('axios');
const rateLimit    = require('express-rate-limit');
const Incident     = require('../models/Incident');
const UptimeReport = require('../models/UptimeReport');
const { verifyAdmin } = require('../middleware/auth');

// ─── ntfy helper ─────────────────────────────────────────────────────────────

async function sendNtfy({ title, message, priority = 'high', tags = [] }) {
  const url = process.env.NTFY_URL;
  if (!url) return;

  try {
    const headers = {
      'Title':        title,
      'Priority':     priority,
      'Tags':         tags.join(','),
      'Content-Type': 'text/plain',
    };
    if (process.env.FRONTEND_URL) {
      headers['Actions'] = `view, Open Status Page, ${process.env.FRONTEND_URL}/status`;
    }
    await axios.post(url, message, { headers, timeout: 6000 });
    console.log(`[ntfy] Sent: "${title}"`);
  } catch (err) {
    console.error('[ntfy] Failed:', err.response?.status || err.message);
  }
}

// ─── Per-IP rate limiter for /report ─────────────────────────────────────────
//
// 3 reports per IP per 60 minutes, hard stop with a 429.
// This is the outermost guard — catches spam before any DB work happens.

const reportRateLimit = rateLimit({
  windowMs:         60 * 60 * 1000, // 60 minutes
  max:              3,              // max 3 submissions per IP
  standardHeaders:  true,
  legacyHeaders:    false,
  keyGenerator:     (req) => realIp(req),
  handler: (req, res) => {
    console.log(`[uptime] Rate limit hit for IP ${realIp(req)}`);
    res.status(429).json({
      error:  'Too many reports from this IP. You can submit up to 3 reports per hour.',
      retryAfter: Math.ceil(req.rateLimit.resetTime
        ? (req.rateLimit.resetTime - Date.now()) / 1000 / 60
        : 60
      ) + ' minutes',
    });
  },
});

// ─── In-memory dedup and threshold tracking ───────────────────────────────────
//
// Two in-memory structures, both keyed by service name, with 60-minute TTL:
//
//  reportersByService  Map<service → Set<ip>>
//    Tracks which unique IPs have reported each service in the current window.
//    Used for: per-service IP dedup, and the 10-unique-IP threshold check.
//
//  thresholdFiredAt    Map<service → Date>
//    Records when we last sent the "10 reporters" ntfy for a service.
//    Prevents the ntfy from firing on every report after the threshold is hit.
//
// Why in-memory instead of Redis?
//   The dedup/threshold is a safety valve, not business logic. Losing it on
//   server restart (rare) means at most one extra ntfy per restart — acceptable.
//   If the fleet grows to many backends, switch this to Upstash Redis.

const DEDUP_WINDOW_MS        = 60 * 60 * 1000; // 60 minutes
const NTFY_THRESHOLD         = 10;             // unique IPs before we alert
const NTFY_COOLDOWN_MS       = 60 * 60 * 1000; // re-alert at most once per 60 min per service

const reportersByService = new Map(); // service → { ips: Set<string>, windowStart: Date }
const thresholdFiredAt   = new Map(); // service → Date

/**
 * Returns the canonical (lowercased, trimmed) service name.
 */
function normaliseService(raw) {
  return (raw || 'general').trim().toLowerCase().slice(0, 100);
}

/**
 * Checks whether the given IP has already reported this service in the current
 * window. If not, records the report and returns false.
 * Returns true  → duplicate, reject.
 * Returns false → new unique report, accept.
 */
function isDuplicate(service, ip) {
  const now = Date.now();
  let entry = reportersByService.get(service);

  // Expire the window if it's older than DEDUP_WINDOW_MS
  if (entry && (now - entry.windowStart) > DEDUP_WINDOW_MS) {
    entry = null;
    reportersByService.delete(service);
    thresholdFiredAt.delete(service); // reset threshold for fresh window
  }

  if (!entry) {
    entry = { ips: new Set(), windowStart: now };
    reportersByService.set(service, entry);
  }

  if (entry.ips.has(ip)) {
    return true; // this IP already reported this service in this window
  }

  entry.ips.add(ip);
  return false;
}

/**
 * Returns the current unique reporter count for a service.
 */
function getReporterCount(service) {
  const entry = reportersByService.get(service);
  return entry ? entry.ips.size : 0;
}

/**
 * Returns true if the 10-reporter ntfy should fire (threshold just crossed,
 * and the cooldown has elapsed since last fire for this service).
 */
function shouldFireThresholdAlert(service) {
  const count = getReporterCount(service);
  if (count < NTFY_THRESHOLD) return false;

  const lastFired = thresholdFiredAt.get(service);
  const now       = Date.now();

  if (lastFired && (now - lastFired) < NTFY_COOLDOWN_MS) return false;

  // Record fire time so subsequent reports don't re-trigger within the cooldown
  thresholdFiredAt.set(service, now);
  return true;
}

// ─── Public: status ───────────────────────────────────────────────────────────

router.get('/status', async (req, res) => {
  try {
    const activeIncidents = await Incident.find({ status: { $ne: 'resolved' } })
      .sort({ createdAt: -1 });

    const recentResolved = await Incident.find({
      status:     'resolved',
      resolvedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    }).sort({ resolvedAt: -1 }).limit(10);

    const dbOk = mongoose.connection.readyState === 1;

    let overallStatus = 'operational';
    if (activeIncidents.some(i => i.severity === 'critical')) overallStatus = 'outage';
    else if (activeIncidents.length > 0)                       overallStatus = 'degraded';

    res.json({
      status: overallStatus,
      dbStatus:      dbOk ? 'connected' : 'disconnected',
      uptimeSeconds: Math.floor(process.uptime()),
      activeIncidents,
      recentResolved,
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[uptime] /status error:', err.message);
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

// ─── Public: ping (lightweight) ──────────────────────────────────────────────

router.head('/ping', (req, res) => {
  res.set({
    'X-Service': 'planit-backend',
    'X-Uptime':  Math.floor(process.uptime()).toString(),
    'X-DB':      mongoose.connection.readyState === 1 ? 'ok' : 'down',
  });
  res.sendStatus(200);
});

router.get('/ping', (req, res) => {
  res.json({
    ok:     true,
    db:     mongoose.connection.readyState === 1 ? 'ok' : 'down',
    uptime: Math.floor(process.uptime()),
    ts:     new Date().toISOString(),
  });
});

// ─── Public: submit report ────────────────────────────────────────────────────
//
// Guards in order:
//   1. express-rate-limit    — 3/IP/hour hard cap, 429 before any logic runs
//   2. isDuplicate()         — same IP + same service within the window → 409
//   3. input validation      — description must be non-trivial
//   4. DB write
//   5. ntfy at 10 unique IPs (non-blocking, no auto-incident)

router.post('/report', reportRateLimit, async (req, res) => {
  try {
    const { description, email, affectedService } = req.body;

    // ── Input validation ──────────────────────────────────────────────────
    if (!description || description.trim().length < 5) {
      return res.status(400).json({ error: 'Description is required (min 5 characters).' });
    }

    const service  = normaliseService(affectedService);
    const clientIp = realIp(req);

    // ── Per-service IP dedup ──────────────────────────────────────────────
    // If this IP already reported this service in the current 60-min window,
    // acknowledge the submission (200 not 4xx so the UI stays polite) but
    // don't write a duplicate to the DB.
    if (isDuplicate(service, clientIp)) {
      console.log(`[uptime] Duplicate report suppressed — IP ${clientIp}, service "${service}"`);
      return res.status(200).json({
        success:   true,
        duplicate: true,
        message:   'Your report for this service has already been recorded. We\'re aware of the issue.',
      });
    }

    // ── DB write ──────────────────────────────────────────────────────────
    const report = await UptimeReport.create({
      description:     description.trim().slice(0, 500),
      email:           (email || '').trim().slice(0, 200),
      affectedService: service,
      status:          'pending',
      // Note: incidentId is intentionally left null.
      // Reports are NOT automatically linked to incidents.
      // Only an admin action (POST /admin/incidents) can create an incident.
    });

    const reporterCount = getReporterCount(service);
    console.log(`[uptime] Report saved (${report._id}) — service="${service}", reporters this window: ${reporterCount}`);

    // ── ntfy: every new unique report (low-priority heads-up) ─────────────
    // This is informational only — NOT an incident alert.
    // Fires on every accepted unique report so you have awareness.
    const isAutoDetect = description.startsWith('[AUTO]');
    sendNtfy({
      title:    isAutoDetect
                  ? 'AUTO-DETECT: API unreachable'
                  : `Report #${reporterCount} — ${service}`,
      message:  `${description.trim().slice(0, 300)}\n\nUnique reporters this hour: ${reporterCount}\nThis is NOT an incident yet. Review at /status if needed.`,
      priority: isAutoDetect ? 'urgent' : 'default',
      tags:     isAutoDetect ? ['rotating_light', 'server'] : ['bar_chart'],
    }).catch(() => {});

    // ── ntfy: threshold alert at 10 unique IPs ────────────────────────────
    // Fires at most once per 60-minute window per service.
    // Explicitly worded to NOT suggest an auto-incident was created.
    if (shouldFireThresholdAlert(service)) {
      sendNtfy({
        title:    `⚠️ ${reporterCount} users reporting "${service}" issues`,
        message:  [
          `${reporterCount} unique users have reported issues with "${service}" in the last 60 minutes.`,
          '',
          'ACTION NEEDED: Review reports in the admin panel and decide whether to create an incident.',
          '',
          'No incident has been created automatically. You must create one manually if confirmed.',
          '',
          `Admin panel: ${process.env.FRONTEND_URL || ''}/admin`,
          `Status page: ${process.env.FRONTEND_URL || ''}/status`,
        ].join('\n'),
        priority: 'high',
        tags:     ['warning', 'eyes'],
      }).catch(() => {});

      console.log(`[uptime] Threshold alert fired — service="${service}", reporters=${reporterCount}`);
    }

    res.status(201).json({ success: true, reportId: report._id });

  } catch (err) {
    console.error('[uptime] /report error:', err.message);
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

// ─── Admin: reports ───────────────────────────────────────────────────────────

router.get('/admin/reports', verifyAdmin, async (req, res) => {
  try {
    const reports = await UptimeReport.find().sort({ createdAt: -1 }).limit(100);
    res.json({ reports });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

router.patch('/admin/reports/:id', verifyAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    const report = await UptimeReport.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.json({ report });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update report' });
  }
});

// ─── Admin: report volume stats (for admin dashboard) ────────────────────────
// Returns current in-memory window stats so the admin panel can show
// "X unique reporters for Y service in the last hour" without a DB query.

router.get('/admin/report-volume', verifyAdmin, (req, res) => {
  const services = [];
  for (const [service, entry] of reportersByService.entries()) {
    const windowAgeMs  = Date.now() - entry.windowStart;
    const remainingMs  = Math.max(0, DEDUP_WINDOW_MS - windowAgeMs);
    services.push({
      service,
      uniqueReporters:   entry.ips.size,
      windowStartedAt:   new Date(entry.windowStart).toISOString(),
      windowResetsIn:    Math.ceil(remainingMs / 60000) + ' minutes',
      thresholdReached:  entry.ips.size >= NTFY_THRESHOLD,
      lastAlertFiredAt:  thresholdFiredAt.has(service)
                           ? new Date(thresholdFiredAt.get(service)).toISOString()
                           : null,
    });
  }
  res.json({ services, threshold: NTFY_THRESHOLD, windowMinutes: 60 });
});

// ─── Admin: incidents ─────────────────────────────────────────────────────────

router.get('/admin/incidents', verifyAdmin, async (req, res) => {
  try {
    const incidents = await Incident.find().sort({ createdAt: -1 }).limit(50);
    res.json({ incidents });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch incidents' });
  }
});

router.post('/admin/incidents', verifyAdmin, async (req, res) => {
  try {
    const { title, description, severity, affectedServices, reportIds, initialMessage } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ error: 'Title required' });

    const timeline = [];
    if (initialMessage) {
      timeline.push({ status: 'investigating', message: initialMessage.trim() });
    }

    const incident = await Incident.create({
      title:            title.trim(),
      description:      (description || '').trim(),
      severity:         severity || 'minor',
      affectedServices: affectedServices || [],
      timeline,
      reportIds:        reportIds || [],
    });

    if (reportIds?.length > 0) {
      await UptimeReport.updateMany(
        { _id: { $in: reportIds } },
        { status: 'confirmed', incidentId: incident._id }
      );
    }

    sendNtfy({
      title:    `Incident Created: ${incident.title}`,
      message:  `Severity: ${incident.severity}\nServices: ${(affectedServices || []).join(', ') || 'General'}\n${initialMessage || ''}`,
      priority: incident.severity === 'critical' ? 'urgent' : 'high',
      tags:     ['memo'],
    }).catch(() => {});

    res.status(201).json({ incident });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create incident' });
  }
});

router.post('/admin/incidents/:id/timeline', verifyAdmin, async (req, res) => {
  try {
    const { status, message } = req.body;
    if (!status || !message) return res.status(400).json({ error: 'Status and message required' });

    const incident = await Incident.findById(req.params.id);
    if (!incident) return res.status(404).json({ error: 'Incident not found' });

    incident.timeline.push({ status, message: message.trim() });
    incident.status = status;

    if (status === 'resolved') {
      incident.resolvedAt      = new Date();
      incident.downtimeMinutes = Math.round((incident.resolvedAt - incident.createdAt) / 60000);
    }

    await incident.save();

    sendNtfy({
      title:    `Incident Update: ${status.toUpperCase()}`,
      message:  `${incident.title}\n\n${message.trim()}`,
      priority: status === 'resolved' ? 'default' : 'high',
      tags:     status === 'resolved' ? ['white_check_mark'] : ['memo'],
    }).catch(() => {});

    res.json({ incident });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add timeline update' });
  }
});

router.patch('/admin/incidents/:id', verifyAdmin, async (req, res) => {
  try {
    const { title, description, severity, affectedServices } = req.body;
    const incident = await Incident.findByIdAndUpdate(
      req.params.id,
      { title, description, severity, affectedServices },
      { new: true }
    );
    if (!incident) return res.status(404).json({ error: 'Incident not found' });
    res.json({ incident });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update incident' });
  }
});

router.delete('/admin/incidents/:id', verifyAdmin, async (req, res) => {
  try {
    await Incident.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete incident' });
  }
});

module.exports = router;
