/*
 * PLANIT PROPRIETARY LICENSE
 * Copyright (c) 2026 Aakshat Hariharan. All rights reserved.
 *
 * PlanIt Payments — public status endpoints + admin tools.
 *
 * Invoices are created by the purchase-specific routes (support.js,
 * whitelabel.js) so the amount is always decided server-side.
 *
 * Admin endpoints (all behind verifyAdmin):
 *   GET  /admin/list          invoices + revenue stats (filter: status, purpose, q, refId)
 *   GET  /admin/health        is everything wired up? (wallet, chain API, price, alerts, backlog)
 *   POST /admin/test-alert    send a test alert through Discord / ntfy / Slack
 *   GET  /admin/:id           one invoice with its full event timeline
 *   POST /admin/:id/recheck   force an immediate chain check
 *   POST /admin/:id/retry-fulfill   re-run fulfilment for a confirmed-but-not-fulfilled invoice
 *   POST /admin/:id/resolve   accept / reject an invoice sitting in "review"
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const Invoice = require('../models/Invoice');
const payments = require('../services/payments');
const btc = require('../services/payments/bitcoin');
const chain = require('../services/payments/chainApi');
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
const adminTestLimiter = limiter(60_000, 6);

router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

// ── Public ───────────────────────────────────────────────────────────────────

router.get('/config', (_req, res) => {
  const ok = btc.isConfigured();
  const net = ok ? btc.networkName() : null;
  res.json({ enabled: ok, network: net, testMode: ok && net !== 'mainnet' });
});

// ── Admin ────────────────────────────────────────────────────────────────────
// Declared before /:id so "admin" is never treated as an invoice id.

const SAFE = '-pii -ipHash -lockUntil';
const isDemo = (req) => !!req.admin?.isDemo;

function explorerUrl(inv, txid) {
  if (!txid) return null;
  const prefix = inv.network === 'mainnet' ? '' : `${inv.network}/`;
  return `https://mempool.space/${prefix}tx/${txid}`;
}
function addressUrl(inv) {
  const prefix = inv.network === 'mainnet' ? '' : `${inv.network}/`;
  return `https://mempool.space/${prefix}address/${inv.address}`;
}

function adminView(inv) {
  return {
    id: inv.publicId,
    purpose: inv.purpose,
    refId: inv.refId || '',
    label: inv.label || '',
    emailHint: inv.emailHint || '',
    status: inv.status,
    network: inv.network,
    usd: inv.usdCents / 100,
    usdCents: inv.usdCents,
    btc: btc.satsToBtcString(inv.btcSats),
    sats: inv.btcSats,
    rateUsd: inv.rateUsd,
    address: inv.address,
    seenSats: inv.seenSats || 0,
    confirmedSats: inv.confirmedSats || 0,
    confirmations: inv.confirmations || 0,
    requiredConf: inv.requiredConf,
    txids: inv.txids || [],
    txUrl: explorerUrl(inv, inv.txids?.[0]),
    addressUrl: addressUrl(inv),
    fulfillState: inv.fulfillState,
    fulfillTries: inv.fulfillTries || 0,
    createdAt: inv.createdAt,
    expiresAt: inv.expiresAt,
    paidAt: inv.paidAt || null,
    lastCheckedAt: inv.lastCheckedAt || null,
    events: (inv.events || []).slice(-50),
  };
}

router.get('/admin/list', verifyAdmin, async (req, res) => {
  try {
    if (isDemo(req)) {
      return res.json({ items: [], stats: { confirmedUsdCents: 0, confirmedCount: 0, confirmedSats: 0, last30UsdCents: 0, byStatus: {}, byPurpose: {} }, network: null, demo: true });
    }
    const q = {};
    if (req.query.status && /^[a-z]+$/.test(req.query.status)) q.status = req.query.status;
    if (req.query.purpose && /^[a-z_]+$/.test(req.query.purpose)) q.purpose = req.query.purpose;
    if (req.query.refId && /^[0-9a-fA-F]{24}$/.test(req.query.refId)) q.refId = req.query.refId;
    // Search by invoice id prefix, address prefix, or business label.
    const term = String(req.query.q || '').trim().slice(0, 64);
    if (term) {
      const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      q.$or = [
        { publicId: { $regex: `^${esc.toLowerCase()}` } },
        { address: { $regex: `^${esc}`, $options: 'i' } },
        { label: { $regex: esc, $options: 'i' } },
      ];
    }
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 100));

    const since30 = new Date(Date.now() - 30 * 864e5);
    const [items, totals, byStatus, byPurpose, last30] = await Promise.all([
      Invoice.find(q).select(SAFE).sort({ createdAt: -1 }).limit(limit).lean(),
      Invoice.aggregate([
        { $match: { status: 'confirmed' } },
        { $group: { _id: null, usdCents: { $sum: '$usdCents' }, sats: { $sum: '$confirmedSats' }, n: { $sum: 1 } } },
      ]),
      Invoice.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
      Invoice.aggregate([
        { $match: { status: 'confirmed' } },
        { $group: { _id: '$purpose', usdCents: { $sum: '$usdCents' }, n: { $sum: 1 } } },
      ]),
      Invoice.aggregate([
        { $match: { status: 'confirmed', paidAt: { $gte: since30 } } },
        { $group: { _id: null, usdCents: { $sum: '$usdCents' } } },
      ]),
    ]);

    res.json({
      items: items.map(adminView),
      stats: {
        confirmedUsdCents: totals[0]?.usdCents || 0,
        confirmedCount: totals[0]?.n || 0,
        confirmedSats: totals[0]?.sats || 0,
        last30UsdCents: last30[0]?.usdCents || 0,
        byStatus: Object.fromEntries(byStatus.map(r => [r._id, r.n])),
        byPurpose: Object.fromEntries(byPurpose.map(r => [r._id, { usdCents: r.usdCents, n: r.n }])),
      },
      network: btc.isConfigured() ? btc.networkName() : null,
    });
  } catch (e) {
    console.error('[payments] admin list', e.message);
    res.status(500).json({ error: 'internal' });
  }
});

// Is everything wired up? Safe to poll; every external lookup is time-boxed.
router.get('/admin/health', verifyAdmin, async (req, res) => {
  try {
    if (isDemo(req)) return res.json({ demo: true, configured: false });
    const configured = btc.isConfigured();
    let configError = null;
    if (!configured) { try { btc.assertConfigured(); } catch (e) { configError = e.message; } }

    const now = new Date();
    const [overdue, review, unfulfilled, open, lastPaid] = await Promise.all([
      Invoice.countDocuments({ status: { $in: ['pending', 'detected'] }, nextCheckAt: { $lt: new Date(now - 5 * 60_000) } }),
      Invoice.countDocuments({ status: 'review' }),
      Invoice.countDocuments({ status: 'confirmed', fulfillState: { $ne: 'done' } }),
      Invoice.countDocuments({ status: { $in: ['pending', 'detected'] }, expiresAt: { $gt: now } }),
      Invoice.findOne({ status: 'confirmed' }).sort({ paidAt: -1 }).select('paidAt').lean(),
    ]);

    const timebox = (p) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 6000))]);
    let tip = null, rate = null, chainError = null, priceError = null;
    if (configured) {
      [tip, rate] = await Promise.all([
        timebox(chain.tipHeight()).catch((e) => { chainError = e.message; return null; }),
        timebox(chain.btcUsd()).catch((e) => { priceError = e.message; return null; }),
      ]);
    }

    res.json({
      configured, configError,
      network: configured ? btc.networkName() : null,
      encKeySet: /^[0-9a-fA-F]{64}$/.test(process.env.PAYMENTS_ENC_KEY || ''),
      testRateActive: !!process.env.BTC_TEST_RATE_USD && configured && btc.networkName() !== 'mainnet',
      chain: { ok: tip !== null, tip, error: chainError },
      price: { ok: rate !== null, usd: rate, error: priceError },
      alerts: {
        viaRouter: !!process.env.ROUTER_URL,
        localDiscord: !!process.env.DISCORD_WEBHOOK_URL,
        localNtfy: !!process.env.NTFY_URL,
      },
      queue: { open, overdueChecks: overdue, review, unfulfilled },
      lastPaidAt: lastPaid?.paidAt || null,
      frontendUrlSet: !!process.env.FRONTEND_URL,
    });
  } catch (e) {
    console.error('[payments] admin health', e.message);
    res.status(500).json({ error: 'internal' });
  }
});

// Sends a real test through the same path as production alerts.
router.post('/admin/test-alert', verifyAdmin, demoGuard, adminTestLimiter, async (req, res) => {
  try {
    const who = req.admin?.username || req.admin?.email || 'admin';
    const r = await notify.alert({
      title: 'PlanIt Payments - test alert',
      content: `Test sent by ${who}. If you can read this, payment alerts are working.`,
      level: 'info',
      fields: [
        { name: 'Network', value: btc.isConfigured() ? btc.networkName() : 'not configured', inline: true },
        { name: 'Sent', value: new Date().toISOString(), inline: true },
      ],
    });
    res.json({ ok: r.ok, via: r.via, channels: r.channels || null });
  } catch (e) {
    console.error('[payments] test-alert', e.message);
    res.status(500).json({ error: 'internal' });
  }
});

router.get('/admin/:id', verifyAdmin, async (req, res) => {
  try {
    if (!ID_RE.test(req.params.id)) return res.status(404).json({ error: 'not_found' });
    if (isDemo(req)) return res.status(404).json({ error: 'not_found' });
    const inv = await Invoice.findOne({ publicId: req.params.id }).select(SAFE).lean();
    if (!inv) return res.status(404).json({ error: 'not_found' });
    res.json(adminView(inv));
  } catch (e) {
    console.error('[payments] admin get', e.message);
    res.status(500).json({ error: 'internal' });
  }
});

router.post('/admin/:id/recheck', verifyAdmin, demoGuard, adminTestLimiter, async (req, res) => {
  try {
    if (!ID_RE.test(req.params.id)) return res.status(404).json({ error: 'not_found' });
    const found = await Invoice.findOne({ publicId: req.params.id }).select('_id').lean();
    if (!found) return res.status(404).json({ error: 'not_found' });
    const inv = await checkNow(found._id);
    if (!inv) return res.status(409).json({ error: 'busy', message: 'Another server is checking this invoice - try again in a few seconds' });
    res.json(adminView(inv.toObject ? inv.toObject() : inv));
  } catch (e) {
    console.error('[payments] recheck', e.message);
    res.status(502).json({ error: 'chain_unavailable' });
  }
});

router.post('/admin/:id/retry-fulfill', verifyAdmin, demoGuard, adminTestLimiter, async (req, res) => {
  try {
    if (!ID_RE.test(req.params.id)) return res.status(404).json({ error: 'not_found' });
    const inv = await Invoice.findOneAndUpdate(
      { publicId: req.params.id, status: 'confirmed', fulfillState: { $ne: 'done' } },
      { $set: { fulfillState: 'none', nextCheckAt: new Date() } },
      { new: true },
    );
    if (!inv) return res.status(409).json({ error: 'not_retryable', message: 'Only confirmed, not-yet-fulfilled invoices can be retried' });
    const ok = await payments.fulfill(inv);
    const fresh = await Invoice.findById(inv._id).select(SAFE).lean();
    res.json({ ok, invoice: adminView(fresh) });
  } catch (e) {
    console.error('[payments] retry-fulfill', e.message);
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
    await notify.alert({
      title: 'PlanIt Payments - manual resolution',
      content: `Invoice ${action}ed by ${who}`,
      level: 'info',
      invoiceId: inv.publicId,
      fields: [{ name: 'Invoice', value: inv.publicId }, { name: 'Amount', value: notify.usd(inv.usdCents), inline: true }, { name: 'Note', value: note }],
    });
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
