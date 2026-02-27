'use strict';

const express   = require('express');
const router    = express.Router();
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
  keyGenerator: (req) => req.ip || req.socket?.remoteAddress || 'unknown',
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
// NTFY NOTIFICATION
// Set NTFY_TOPIC in your environment (e.g. "planit-bug-reports").
// Optionally set NTFY_TOKEN if your topic requires auth.
// Subscribe to your topic at https://ntfy.sh/<your-topic> or in the
// ntfy app (iOS / Android).
// ══════════════════════════════════════════════════════════════════════════
// TODO fix
async function sendNtfyNotification(report) {
  const topic = process.env.NTFY_URL;
  if (!topic) {
    console.warn('[bug-reports] NTFY_URL not set — skipping push notification');
    return;
  }

  const severityPrefix = {
    low: '[LOW]', medium: '[MEDIUM]', high: '[HIGH]', critical: '[CRITICAL]',
  };
  const categoryLabel = {
    bug: 'Bug', error: 'Error', feature: 'Feature Request',
    account: 'Account Issue', checkin: 'Check-in Issue', other: 'Other',
  };

  // Title must be ASCII-safe — emoji in HTTP headers causes "Illegal header value" errors
  const title = `${severityPrefix[report.severity] || '[REPORT]'} ${report.summary}`.slice(0, 150);
  const body  = [
    `From: ${report.name} <${report.email}>`,
    `Category: ${categoryLabel[report.category] || report.category}`,
    `Severity: ${report.severity}`,
    report.eventLink ? `Event: ${report.eventLink}` : null,
    report.browser   ? `Browser: ${report.browser}`   : null,
    '',
    report.description.slice(0, 400),
  ].filter(v => v !== null).join('\n');

  const headers = {
    'Title':    title,
    'Priority': report.severity === 'critical' ? 'urgent'
               : report.severity === 'high'    ? 'high'
               : 'default',
    'Tags':     `bug,${report.category}`,
    'Content-Type': 'text/plain',
  };

  if (process.env.NTFY_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.NTFY_TOKEN}`;
  }

  try {
    await axios.post(`https://ntfy.sh/${topic}`, body, { headers, timeout: 8000 });
    console.log(`[bug-reports] ntfy notification sent for report from ${report.email}`);
  } catch (err) {
    // Never let notification failure break the user's submission
    console.error('[bug-reports] ntfy notification failed:', err.message);
  }
}

// ══════════════════════════════════════════════════════════════════════════
// ADMIN AUTH — reuse the same JWT verify from admin route
// ══════════════════════════════════════════════════════════════════════════

const jwt = require('jsonwebtoken');
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
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

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
        ip: req.ip || req.socket?.remoteAddress || '',
      });

      await report.save();

      // Fire and forget — don't await so user gets instant response
      sendNtfyNotification(report);

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
