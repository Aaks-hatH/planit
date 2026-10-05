/*
 * PLANIT PROPRIETARY LICENSE
 * Copyright (c) 2026 Aakshat Hariharan. All rights reserved.
 *
 * PlanIt Payments — public status endpoints + admin tools.
 *
 * Invoices are created by the purchase-specific routes (support.js,
 * whitelabel.js) so the amount is always decided server-side.
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const Invoice = require('../models/Invoice');
const payments = require('../services/payments');
const btc = require('../services/payments/bitcoin');
const notify = require('../services/payments/notify');
const { checkNow } = require('../jobs/paymentWatcher');
const { verifyAdmin, demoGuard } = require('../middleware/auth');
const { realIp } = require('../middleware/realIp');

const ID_RE = /^[0-9a-f]{32}$/;

const limiter = (windowMs, max) => rateLimit({
  windowMs, max, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => realIp(req) || 'unknown',
  message: { error: 'rate_limited' },
});
const readLimiter    = limiter(60_000, 90);
const refreshLimiter = limiter(60_000, 12);
const requoteLimiter = limiter(60 * 60_000, 10);

router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

// ── Public ───────────────────────────────────────────────────────────────────

router.get('/config', (_req, res) => {
  res.json({ enabled: btc.isConfigured(), network: btc.isConfigured() ? btc.networkName() : null });
});

// ── Admin (declared before /:id so "admin" is never treated as an invoice id) ─

const SAFE = '-pii -ipHash -lockUntil';

router.get('/admin/list', verifyAdmin, async (req, res) => {
  try {
    const q = {};
    if (req.query.status && /^[a-z]+$/.test(req.query.status)) q.status = req.query.status;
    if (req.query.purpose && /^[a-z_]+$/.test(req.query.purpose)) q.purpose = req.query.purpose;
    if (req.query.refId && /^[0-9a-fA-F]{24}$/.test(req.query.refId)) q.refId = req.query.refId;
    const items = await Invoice.find(q).select(SAFE).sort({ createdAt: -1 }).limit(100).lean();
    const paid = await Invoice.aggregate([
      { $match: { status: 'confirmed' } },
      { $group: { _id: null, usdCents: { $sum: '$usdCents' }, sats: { $sum: '$confirmedSats' }, n: { $sum: 1 } } },
    ]);
    res.json({ items, totals: paid[0] || { usdCents: 0, sats: 0, n: 0 }, network: btc.isConfigured() ? btc.networkName() : null });
  } catch (e) {
    console.error('[payments] admin list', e.message);
    res.status(500).json({ error: 'internal' });
  }
});

// Resolve an invoice that landed in "review" (late / partial / odd payment).
router.post('/admin/:id/resolve', verifyAdmin, demoGuard, async (req, res) => {
  try {
    const { action, note } = req.body || {};
    if (!ID_RE.test(req.params.id) || !['accept', 'reject'].includes(action)) return res.status(400).json({ error: 'validation' });
    const inv = await Invoice.findOne({ publicId: req.params.id });
    if (!inv) return res.status(404).json({ error: 'not_found' });

    const who = req.admin?.username || req.admin?.email || 'admin';
    const detail = `${action} by ${who}: ${String(note || '').slice(0, 150)}`;
    const now = new Date();

    const next = action === 'accept'
      ? await payments.transition(inv, ['review', 'expired', 'pending', 'detected'],
          { status: 'confirmed', paidAt: now, purgeAt: new Date(now.getTime() + 2 * 365 * 864e5), nextCheckAt: now },
          { type: 'manual_accept', detail })
      : await payments.transition(inv, ['review', 'expired', 'pending', 'detected'],
          { status: 'rejected', purgeAt: new Date(now.getTime() + 90 * 864e5) },
          { type: 'manual_reject', detail });

    if (!next) return res.status(409).json({ error: 'state_changed' });
    payments.emit(next);
    await notify.discord({ content: `Invoice ${action}ed by ${who}`, title: 'PlanIt Payments — manual resolution', color: 0x64748b, fields: [{ name: 'Invoice', value: inv.publicId }, { name: 'Note', value: note }] });
    res.json({ ok: true, status: next.status });
  } catch (e) {
    console.error('[payments] resolve', e.message);
    res.status(500).json({ error: 'internal' });
  }
});

// ── Per-invoice (capability URL: the 128-bit id is the credential) ───────────

router.get('/:id', readLimiter, async (req, res) => {
  if (!ID_RE.test(req.params.id)) return res.status(404).json({ error: 'not_found' });
  const inv = await Invoice.findOne({ publicId: req.params.id }).select(SAFE).lean();
  if (!inv) return res.status(404).json({ error: 'not_found' });
  res.json(payments.publicView(inv));
});

// "I've paid" — forces an immediate chain check (throttled).
router.post('/:id/refresh', refreshLimiter, async (req, res) => {
  try {
    if (!ID_RE.test(req.params.id)) return res.status(404).json({ error: 'not_found' });
    let inv = await Invoice.findOne({ publicId: req.params.id });
    if (!inv) return res.status(404).json({ error: 'not_found' });
    if (['pending', 'detected'].includes(inv.status) && (!inv.lastCheckedAt || Date.now() - inv.lastCheckedAt.getTime() > 6000)) {
      inv = (await checkNow(inv._id)) || inv;
    }
    res.json(payments.publicView(inv));
  } catch (e) {
    console.error('[payments] refresh', e.message);
    res.status(502).json({ error: 'chain_unavailable' });
  }
});

// Expired quote → fresh quote, same purchase.
router.post('/:id/requote', requoteLimiter, async (req, res) => {
  try {
    if (!ID_RE.test(req.params.id)) return res.status(404).json({ error: 'not_found' });
    const inv = await Invoice.findOne({ publicId: req.params.id });
    if (!inv) return res.status(404).json({ error: 'not_found' });
    const fresh = await payments.requote(inv, realIp(req));
    res.json(payments.publicView(fresh));
  } catch (e) {
    if (e instanceof payments.PaymentError) return res.status(e.status).json({ error: e.code, message: e.message });
    console.error('[payments] requote', e.message);
    res.status(500).json({ error: 'internal' });
  }
});

module.exports = router;
