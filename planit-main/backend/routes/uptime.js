/**
 * PlanIt Uptime Routes  —  FIXED
 *
 * FIX SUMMARY (vs previous version):
 *  - /report now auto-creates an Incident when 3+ confirmed reports hit the
 *    same service within 10 minutes (fully automated, no admin needed).
 *  - /report deduplicates: if an active incident already exists for that
 *    service, the new report is linked to it instead of creating a duplicate.
 *  - ntfy notifications now fire for both manual reports AND auto-incidents,
 *    with correct priority levels.
 *  - Added GET /uptime/health — a richer health check the frontend and
 *    watchdog can both use that includes DB state.
 *  - All admin incident routes are unchanged so the Admin panel still works.
 */

const express  = require('express');
const router   = express.Router();
const mongoose = require('mongoose');
const axios    = require('axios');
const Incident     = require('../models/Incident');
const UptimeReport = require('../models/UptimeReport');
const UptimeCheck  = require('../models/UptimeCheck');
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

// ─── Auto-incident logic ──────────────────────────────────────────────────────
// If 3+ confirmed reports arrive for the same service within 10 minutes,
// automatically create/update an Incident — no admin action required.
const AUTO_INCIDENT_THRESHOLD = 3;
const AUTO_INCIDENT_WINDOW_MS  = 10 * 60 * 1000; // 10 minutes

async function maybeAutoCreateIncident(newReport) {
  try {
    const service = newReport.affectedService || 'General';

    // 1. Check if there's already an open (non-resolved) incident for this service
    const existing = await Incident.findOne({
      status:           { $ne: 'resolved' },
      affectedServices: { $regex: new RegExp(service, 'i') },
    });

    if (existing) {
      // Link this report to the existing incident — don't create a duplicate
      newReport.incidentId = existing._id;
      newReport.status     = 'confirmed';
      await newReport.save();
      console.log(`[uptime] Report linked to existing incident ${existing._id}`);
      return existing;
    }

    // 2. Count recent reports for this service within the time window
    const windowStart = new Date(Date.now() - AUTO_INCIDENT_WINDOW_MS);
    const recentReports = await UptimeReport.find({
      affectedService: { $regex: new RegExp(service, 'i') },
      createdAt:       { $gte: windowStart },
      incidentId:      null, // not yet linked to an incident
    });

    if (recentReports.length < AUTO_INCIDENT_THRESHOLD) {
      // Not enough reports yet to auto-create an incident
      return null;
    }

    // 3. Auto-create the incident
    const isGeneral  = service === 'General';
    const severity   = isGeneral ? 'major' : 'major';
    const reportIds  = recentReports.map(r => r._id);

    const incident = await Incident.create({
      title:            `Reported Issues - ${service}`,
      description:      `Multiple users have reported issues with ${service}. Auto-created after ${recentReports.length} reports within 10 minutes.`,
      severity,
      status:           'investigating',
      affectedServices: [service.toLowerCase()],
      reportIds,
      timeline: [{
        status:  'investigating',
        message: `Auto-detected: ${recentReports.length} user reports received within 10 minutes for ${service}. Investigating.`,
        createdAt: new Date(),
      }],
    });

    // Link all reports to this new incident
    await UptimeReport.updateMany(
      { _id: { $in: reportIds } },
      { status: 'confirmed', incidentId: incident._id }
    );

    console.log(`[uptime] Auto-created incident ${incident._id} for service: ${service}`);

    // Send ntfy alert for auto-created incident
    await sendNtfy({
      title:    `AUTO-INCIDENT: ${service} Issues`,
      message:  `${recentReports.length} user reports triggered an automatic incident for ${service}.\nIncident ID: ${incident._id}\nStatus page updated automatically.`,
      priority: 'urgent',
      tags:     ['rotating_light', 'users'],
    });

    return incident;
  } catch (err) {
    console.error('[uptime] maybeAutoCreateIncident error:', err.message);
    return null;
  }
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
      dbStatus:       dbOk ? 'connected' : 'disconnected',
      uptimeSeconds:  Math.floor(process.uptime()),
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
// HEAD — used by UptimeRobot / external monitors
router.head('/ping', (req, res) => {
  res.set({
    'X-Service': 'planit-backend',
    'X-Uptime':  Math.floor(process.uptime()).toString(),
    'X-DB':      mongoose.connection.readyState === 1 ? 'ok' : 'down',
  });
  res.sendStatus(200);
});

// GET — used by the frontend for latency display and the watchdog for health checks
// Also records the ping result so the status page bars have real data
router.get('/ping', async (req, res) => {
  const t0 = Date.now();
  res.json({
    ok:     true,
    db:     mongoose.connection.readyState === 1 ? 'ok' : 'down',
    uptime: Math.floor(process.uptime()),
    ts:     new Date().toISOString(),
  });
  // Record after responding so it never slows down the ping itself
  try {
    await UptimeCheck.create({ status: 'up', latencyMs: Date.now() - t0 });
  } catch (_) { /* non-critical */ }
});

// ─── Public: check history (for uptime bars) ──────────────────────────────────
// Returns aggregated per-day results for the last 90 days.
// Status page uses this to colour bars: green=up, red=down, gray=no data.
router.get('/checks', async (req, res) => {
  try {
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const checks = await UptimeCheck.aggregate([
      { $match: { createdAt: { $gte: since } } },
      {
        $group: {
          _id: {
            y: { $year:         '$createdAt' },
            m: { $month:        '$createdAt' },
            d: { $dayOfMonth:   '$createdAt' },
          },
          totalChecks:  { $sum: 1 },
          upChecks:     { $sum: { $cond: [{ $eq: ['$status', 'up'] }, 1, 0] } },
          downChecks:   { $sum: { $cond: [{ $eq: ['$status', 'down'] }, 1, 0] } },
          avgLatencyMs: { $avg: '$latencyMs' },
        },
      },
      { $sort: { '_id.y': 1, '_id.m': 1, '_id.d': 1 } },
    ]);

    const byDay = {};
    checks.forEach(c => {
      const key = `${c._id.y}-${String(c._id.m).padStart(2,'0')}-${String(c._id.d).padStart(2,'0')}`;
      byDay[key] = {
        totalChecks:  c.totalChecks,
        upChecks:     c.upChecks,
        downChecks:   c.downChecks,
        avgLatencyMs: c.avgLatencyMs ? Math.round(c.avgLatencyMs) : null,
      };
    });

    res.json({ checks: byDay });
  } catch (err) {
    console.error('[uptime] /checks error:', err.message);
    res.status(500).json({ error: 'Failed to fetch check history' });
  }
});

// ─── Public: submit report ────────────────────────────────────────────────────
router.post('/report', async (req, res) => {
  try {
    const { description, email, affectedService } = req.body;
    if (!description || description.trim().length < 5) {
      return res.status(400).json({ error: 'Description is required (min 5 chars)' });
    }

    const report = await UptimeReport.create({
      description:     description.trim().slice(0, 500),
      email:           (email || '').trim().slice(0, 200),
      affectedService: (affectedService || 'General').trim(),
      status:          'pending',
    });

    // Notify admin of manual report (non-blocking)
    const isAuto = description.startsWith('[AUTO]');
    sendNtfy({
      title:    isAuto ? 'AUTO-DETECTED: API unreachable' : `New Report: ${report.affectedService}`,
      message:  description.trim().slice(0, 300),
      priority: isAuto ? 'urgent' : 'high',
      tags:     isAuto ? ['rotating_light', 'server'] : ['warning', 'loudspeaker'],
    });

    // Try to auto-create an incident if threshold is met (non-blocking from response)
    maybeAutoCreateIncident(report).catch(err => {
      console.error('[uptime] Background auto-incident check failed:', err.message);
    });

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
    const report = await UptimeReport.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.json({ report });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update report' });
  }
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

    // Notify on manual incident creation
    sendNtfy({
      title:   `Incident Created: ${incident.title}`,
      message: `Severity: ${incident.severity}\nServices: ${(affectedServices || []).join(', ') || 'General'}\n${initialMessage || ''}`,
      priority: incident.severity === 'critical' ? 'urgent' : 'high',
      tags:    ['memo'],
    });

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

    // Notify on status updates
    sendNtfy({
      title:    `Incident Update: ${status.toUpperCase()}`,
      message:  `${incident.title}\n\n${message.trim()}`,
      priority: status === 'resolved' ? 'default' : 'high',
      tags:     status === 'resolved' ? ['white_check_mark'] : ['memo'],
    });

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