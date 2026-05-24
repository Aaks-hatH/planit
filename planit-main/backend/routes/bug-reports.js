'use strict';

const express   = require('express');
const router    = express.Router();
const { realIp } = require('../middleware/realIp');
const { body, validationResult } = require('express-validator');
const mongoose  = require('mongoose');
const rateLimit = require('express-rate-limit');
const axios     = require('axios');

// ══════════════════════════════════════════════════════════════════════════
// RATE LIMITER
// 5 reports per IP per hour — enough for a legitimate user to report a few
// bugs but prevents spam flooding.
// ══════════════════════════════════════════════════════════════════════════

const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => realIp(req),
  message: {
    error: 'Too many reports submitted from this IP. Please wait before submitting again.',
    retryAfter: 3600,
  },
});

// ══════════════════════════════════════════════════════════════════════════
// MODEL
// ══════════════════════════════════════════════════════════════════════════

const bugReportSchema = new mongoose.Schema({
  name:        { type: String, trim: true, default: 'Anonymous' },
  email:       { type: String, trim: true, required: true },
  category:    {
    type: String,
    enum: ['bug', 'error', 'feature', 'account', 'checkin', 'other'],
    default: 'bug',
  },
  summary:     { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  eventLink:   { type: String, trim: true, default: '' },
  browser:     { type: String, trim: true, default: '' },
  severity:    {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
  },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'resolved', 'closed'],
    default: 'open',
  },
  adminNotes:  { type: String, default: '' },
  ip:          { type: String, default: '' },
  createdAt:   { type: Date, default: Date.now },
  updatedAt:   { type: Date, default: Date.now },
});

bugReportSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

const BugReport = mongoose.model('BugReport', bugReportSchema);

// ══════════════════════════════════════════════════════════════════════════
// CENTRALIZED ALERT DISPATCH
// All alert channels (Discord, ntfy, Slack) are configured on the router
// only. This backend calls POST /mesh/alert on the router and returns
// immediately — the router handles fan-out to every channel.
//
// Required router env vars (set once, never on backends):
//   DISCORD_WEBHOOK_URL
//   NTFY_URL  +  NTFY_TOKEN  (optional)
//   SLACK_WEBHOOK_URL
// ══════════════════════════════════════════════════════════════════════════

async function sendAlert(report) {
  const routerUrl = process.env.ROUTER_URL;
  if (!routerUrl) {
    console.warn('[bug-reports] ROUTER_URL not set — skipping centralized alert');
    return;
  }
  try {
    const { meshPost } = require('../middleware/mesh');
    await meshPost(
      process.env.BACKEND_LABEL || 'Backend',
      `${routerUrl}/mesh/alert`,
      {
        type: 'bug_report',
        payload: {
          _id:         report._id?.toString(),
          name:        report.name,
          email:       report.email,
          category:    report.category,
          summary:     report.summary,
          description: report.description,
          eventLink:   report.eventLink,
          browser:     report.browser,
          severity:    report.severity,
          ip:          report.ip,
        },
      },
      { timeout: 5000 },
    );
  } catch (err) {
    // Never let alert failure affect the user's submission response
    console.error('[bug-reports] Centralized alert dispatch failed:', err.message);
  }
}

// ══════════════════════════════════════════════════════════════════════════
// ADMIN AUTH — reuse the same JWT verify from admin route
// ══════════════════════════════════════════════════════════════════════════

const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const { secrets } = require('../keys');

function verifyAdmin(req, res, next) {
  const auth = req.headers.authorization || '';
  // Support both Authorization header and ?token= query param (used by SSE/iframe)
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : (req.query.token || null);
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, secrets.jwt);
    if (!decoded.isAdmin) return res.status(403).json({ error: 'Admin access required' });
    req.admin = decoded;

    // Alert quick-access tokens are read-only — block mutations so the admin
    // panel always requires a full login before making any changes.
    if (decoded.readOnly && req.method !== 'GET') {
      return res.status(403).json({
        error:   'This quick-access session is read-only. Log in to the admin panel to make changes.',
        code:    'READ_ONLY_SESSION',
        readOnly: true,
      });
    }

    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ══════════════════════════════════════════════════════════════════════════
// ALERT QUICK-ACCESS — exchange HMAC token for a read-only JWT
// GET /api/bug-reports/admin/quick-access?token=...&report=...
//
// The alerting service embeds a signed 30-min link in every bug report alert.
// When clicked, this endpoint validates the HMAC token (signed with MESH_SECRET,
// shared between the router and backend) and redirects to the admin panel
// with a short-lived read-only JWT in the URL.
//
// The read-only JWT lets you VIEW the report without logging in.
// Any write action (status change, notes, delete) returns 403 READ_ONLY_SESSION
// — the admin panel should detect this and prompt for a full login.
// ══════════════════════════════════════════════════════════════════════════

router.get('/admin/quick-access', async (req, res) => {
  const { token, report: reportId } = req.query;

  if (!token || !reportId) {
    return res.status(400).json({ error: 'token and report params are required' });
  }

  // Decode base64url → "reportId:expUnixSec:hmac32hex"
  let rawPayload;
  try {
    rawPayload = Buffer.from(token, 'base64url').toString('utf8');
  } catch {
    return res.status(401).json({ error: 'Invalid token format' });
  }

  const parts = rawPayload.split(':');
  if (parts.length !== 3) {
    return res.status(401).json({ error: 'Invalid token structure' });
  }
  const [tokenReportId, expStr, sig] = parts;

  // Confirm the token is for the requested report
  if (tokenReportId !== reportId) {
    return res.status(401).json({ error: 'Token does not match report' });
  }

  // Check expiry
  const exp = parseInt(expStr, 10);
  if (isNaN(exp) || Math.floor(Date.now() / 1000) > exp) {
    return res.status(401).json({ error: 'Quick-access link has expired. Check the alert for a newer one.', expired: true });
  }

  // Verify HMAC signature (MESH_SECRET shared between router and backend)
  const meshSecret = process.env.MESH_SECRET;
  if (!meshSecret) {
    console.error('[quick-access] MESH_SECRET not set — cannot validate quick-access token');
    return res.status(503).json({ error: 'Server not configured for quick access' });
  }

  const expectedSig = crypto
    .createHmac('sha256', meshSecret)
    .update(`${tokenReportId}:${expStr}`)
    .digest('hex')
    .slice(0, 32);

  if (sig !== expectedSig) {
    return res.status(401).json({ error: 'Invalid token signature' });
  }

  // Issue a short-lived read-only JWT (30 min, matches token expiry)
  const minsLeft    = Math.max(1, Math.floor((exp - Date.now() / 1000) / 60));
  const readOnlyJwt = jwt.sign(
    { isAdmin: true, readOnly: true, reportId, alertAccess: true },
    secrets.jwt,
    { expiresIn: `${minsLeft}m` },
  );

  // Redirect to the admin panel — frontend reads authToken from the URL
  const frontendUrl = (process.env.FRONTEND_URL || '').split(',')[0].trim().replace(/\/$/, '');
  const destination = frontendUrl
    ? `${frontendUrl}/admin/bug-reports?report=${encodeURIComponent(reportId)}&authToken=${encodeURIComponent(readOnlyJwt)}`
    : null;

  if (!destination) {
    // No frontend URL configured — just return the token so the caller can use it
    return res.json({ ok: true, token: readOnlyJwt, reportId, readOnly: true });
  }

  res.redirect(302, destination);
});

// ══════════════════════════════════════════════════════════════════════════
// PUBLIC — SUBMIT BUG REPORT
// POST /api/bug-reports
// ══════════════════════════════════════════════════════════════════════════

router.post('/',
  reportLimiter,
  [
    body('email')
      .isEmail().withMessage('A valid email address is required')
      .normalizeEmail(),
    body('summary')
      .trim().isLength({ min: 5, max: 150 })
      .withMessage('Summary must be 5–150 characters'),
    body('description')
      .trim().isLength({ min: 10, max: 2000 })
      .withMessage('Description must be 10–2000 characters'),
    body('category')
      .optional()
      .isIn(['bug', 'error', 'feature', 'account', 'checkin', 'other']),
    body('severity')
      .optional()
      .isIn(['low', 'medium', 'high', 'critical']),
    body('name').optional().trim().isLength({ max: 80 }),
    body('eventLink').optional().trim().isLength({ max: 200 }),
    body('browser').optional().trim().isLength({ max: 200 }),
  ],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { name, email, category, summary, description, eventLink, browser, severity } = req.body;

      const report = new BugReport({
        name:        name || 'Anonymous',
        email,
        category:    category  || 'bug',
        summary,
        description,
        eventLink:   eventLink || '',
        browser:     browser   || '',
        severity:    severity  || 'medium',
        ip: realIp(req),
      });

      await report.save();

      // Fire and forget — router handles all alert channels in background
      sendAlert(report);

      res.status(201).json({
        success: true,
        message: 'Report submitted successfully. We\'ll email you when it\'s resolved.',
        id: report._id,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ══════════════════════════════════════════════════════════════════════════
// ADMIN — GET ALL REPORTS
// GET /api/bug-reports/admin?status=open&page=1&limit=20
// ══════════════════════════════════════════════════════════════════════════

router.get('/admin', verifyAdmin, async (req, res, next) => {
  try {
    const { status, category, severity, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (status)   filter.status   = status;
    if (category) filter.category = category;
    if (severity) filter.severity = severity;

    const [reports, total] = await Promise.all([
      BugReport.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .lean(),
      BugReport.countDocuments(filter),
    ]);

    const counts = await BugReport.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    const statusCounts = { open: 0, in_progress: 0, resolved: 0, closed: 0 };
    counts.forEach(c => { statusCounts[c._id] = c.count; });

    res.json({ reports, total, statusCounts });
  } catch (err) {
    next(err);
  }
});

// ══════════════════════════════════════════════════════════════════════════
// ADMIN — UPDATE REPORT (status + admin notes)
// PATCH /api/bug-reports/admin/:id
// ══════════════════════════════════════════════════════════════════════════

router.patch('/admin/:id', verifyAdmin, async (req, res, next) => {
  try {
    const { status, adminNotes } = req.body;
    const update = { updatedAt: new Date() };
    if (status)     update.status     = status;
    if (adminNotes !== undefined) update.adminNotes = adminNotes;

    const report = await BugReport.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true }
    );

    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.json({ success: true, report });
  } catch (err) {
    next(err);
  }
});

// ══════════════════════════════════════════════════════════════════════════
// ADMIN — DELETE REPORT
// DELETE /api/bug-reports/admin/:id
// ══════════════════════════════════════════════════════════════════════════

router.delete('/admin/:id', verifyAdmin, async (req, res, next) => {
  try {
    const report = await BugReport.findByIdAndDelete(req.params.id);
    if (!report) return res.status(404).json({ error: 'Report not found' });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;