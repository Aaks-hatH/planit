const express  = require('express');
const router   = express.Router();
const mongoose = require('mongoose');
const axios    = require('axios');
const Incident     = require('../models/Incident');
const UptimeReport = require('../models/UptimeReport');
const { verifyAdmin } = require('../middleware/auth');

// ─── ntfy helper ──────────────────────────────────────────────────────────────
// Set NTFY_URL in your .env, e.g. https://ntfy.sh/your-topic
// or a self-hosted ntfy server URL.
async function sendNtfy(report) {
  const url = process.env.NTFY_URL;
  if (!url) return; // silently skip if not configured

  const isAuto   = report.description?.startsWith('[AUTO]');
  const priority = isAuto ? 'urgent' : 'high';
  const title    = isAuto
    ? '🔴 AUTO-DETECTED: API unreachable'
    : `⚠️ New Issue Report: ${report.affectedService}`;

  try {
    await axios.post(url, report.description, {
      timeout: 5000,
      headers: {
        'Title':    title,
        'Priority': priority,
        'Tags':     isAuto ? 'rotating_light,server' : 'warning,loudspeaker',
        'Content-Type': 'text/plain',
      },
    });
  } catch (err) {
    // Non-critical — log but don't fail the request
    console.error('[ntfy] Failed to send notification:', err.message);
  }
}

// ─── Public: get current status + active incidents ────────────────────────────
router.get('/status', async (req, res) => {
  try {
    const activeIncidents = await Incident.find({ status: { $ne: 'resolved' } }).sort({ createdAt: -1 });
    const recentResolved  = await Incident.find({
      status: 'resolved',
      resolvedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    }).sort({ resolvedAt: -1 }).limit(10);

    const dbOk = mongoose.connection.readyState === 1;

    let overallStatus = 'operational';
    if (activeIncidents.some(i => i.severity === 'critical')) overallStatus = 'outage';
    else if (activeIncidents.length > 0) overallStatus = 'degraded';

    res.json({
      status: overallStatus,
      dbStatus: dbOk ? 'connected' : 'disconnected',
      uptimeSeconds: Math.floor(process.uptime()),
      activeIncidents,
      recentResolved,
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

// ─── Public: ping (lightweight) ──────────────────────────────────────────────
// HEAD /api/uptime/ping  — UptimeRobot / external monitors
router.head('/ping', (req, res) => {
  res.set({
    'X-Service': 'planit-backend',
    'X-Uptime':  Math.floor(process.uptime()).toString(),
    'X-DB':      mongoose.connection.readyState === 1 ? 'ok' : 'down',
  });
  res.sendStatus(200);
});

// GET /api/uptime/ping  — used by the frontend for live latency display
router.get('/ping', (req, res) => {
  res.json({
    ok: true,
    db: mongoose.connection.readyState === 1 ? 'ok' : 'down',
    uptime: Math.floor(process.uptime()),
  });
});

// ─── Public: submit an issue report ──────────────────────────────────────────
// Saves the report and fires a ntfy push notification to the admin.
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
    });

    // Fire-and-forget ntfy notification
    sendNtfy(report);

    res.status(201).json({ success: true, reportId: report._id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit report' });
  }
});

// ─── Admin: get all reports ───────────────────────────────────────────────────
router.get('/admin/reports', verifyAdmin, async (req, res) => {
  try {
    const reports = await UptimeReport.find().sort({ createdAt: -1 }).limit(100);
    res.json({ reports });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reports' });
  }
});

// ─── Admin: update report status ─────────────────────────────────────────────
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

// ─── Admin: get all incidents ─────────────────────────────────────────────────
router.get('/admin/incidents', verifyAdmin, async (req, res) => {
  try {
    const incidents = await Incident.find().sort({ createdAt: -1 }).limit(50);
    res.json({ incidents });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch incidents' });
  }
});

// ─── Admin: create incident ───────────────────────────────────────────────────
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

    // Mark associated reports as confirmed
    if (reportIds?.length > 0) {
      await UptimeReport.updateMany(
        { _id: { $in: reportIds } },
        { status: 'confirmed', incidentId: incident._id }
      );
    }

    res.status(201).json({ incident });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create incident' });
  }
});

// ─── Admin: add timeline update ───────────────────────────────────────────────
router.post('/admin/incidents/:id/timeline', verifyAdmin, async (req, res) => {
  try {
    const { status, message } = req.body;
    if (!status || !message) return res.status(400).json({ error: 'Status and message required' });

    const incident = await Incident.findById(req.params.id);
    if (!incident) return res.status(404).json({ error: 'Incident not found' });

    incident.timeline.push({ status, message: message.trim() });
    incident.status = status;

    if (status === 'resolved') {
      incident.resolvedAt     = new Date();
      incident.downtimeMinutes = Math.round((incident.resolvedAt - incident.createdAt) / 60000);
    }

    await incident.save();
    res.json({ incident });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add timeline update' });
  }
});

// ─── Admin: update incident meta ─────────────────────────────────────────────
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

// ─── Admin: delete incident ───────────────────────────────────────────────────
router.delete('/admin/incidents/:id', verifyAdmin, async (req, res) => {
  try {
    await Incident.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete incident' });
  }
});

module.exports = router;