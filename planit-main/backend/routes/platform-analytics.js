'use strict';

/**
 * routes/platform-analytics.js
 *
 * POST /api/platform-analytics/track   — public ingest (no auth required)
 * GET  /api/platform-analytics/dashboard?window=30  — admin only
 */

const express   = require('express');
const router    = express.Router();
const { ingestBatch, getDashboardData } = require('../models/PlatformAnalytics');
const { verifyAdmin }                   = require('../middleware/auth');

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

module.exports = router;
