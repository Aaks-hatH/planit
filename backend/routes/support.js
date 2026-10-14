const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');

const Support = require('../models/Support');
const Invoice = require('../models/Invoice');
const payments = require('../services/payments');
require('../services/payments/fulfillment');
const { realIp } = require('../middleware/realIp');

// ══════════════════════════════════════════════════════════════════════════
// PLANIT PAYMENTS (Bitcoin) — support & feature-request payments
//
// Amounts are validated here and converted to BTC on the server. The browser
// never supplies a BTC amount or an address, so neither can be tampered with.
// ══════════════════════════════════════════════════════════════════════════

const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => realIp(req) || 'unknown',
  message: { error: 'Too many payment attempts. Please try again later.' },
});

function fail(res, e, fallback) {
  if (e instanceof payments.PaymentError) return res.status(e.status).json({ error: e.message, code: e.code });
  console.error(fallback, e.message);
  return res.status(500).json({ error: 'Failed to create payment' });
}

// ── Create donation payment ──────────────────────────────────────────────
router.post('/create-payment', createLimiter,
  [
    body('amount').isInt({ min: 300, max: 500000 }).withMessage('Minimum $3'),
    body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
    body('name').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
    body('message').optional({ checkFalsy: true }).trim().isLength({ max: 500 }).withMessage('Message too long'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
      const { amount, email, name, message } = req.body;
      const inv = await payments.createInvoice({
        purpose: 'support',
        usdCents: Number(amount),
        pii: { email, name: name || '', message: message || '' },
        ip: realIp(req),
      });
      res.json({ invoiceId: inv.publicId, payUrl: `/pay/${inv.publicId}` });
    } catch (e) { fail(res, e, 'Payment creation error:'); }
  });

// ── Create feature-request payment ───────────────────────────────────────
router.post('/feature-request', createLimiter,
  [
    body('amount').isInt({ min: 500, max: 500000 }).withMessage('Minimum $5'),
    body('email').isEmail().withMessage('Valid email required').normalizeEmail(),
    body('name').optional({ checkFalsy: true }).trim().isLength({ max: 100 }),
    body('feature').trim().isLength({ min: 10, max: 500 }).withMessage('Feature description required'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    try {
      const { amount, email, name, feature } = req.body;
      const inv = await payments.createInvoice({
        purpose: 'feature_request',
        usdCents: Number(amount),
        pii: { email, name: name || '', feature },
        ip: realIp(req),
      });
      res.json({ invoiceId: inv.publicId, payUrl: `/pay/${inv.publicId}?type=feature` });
    } catch (e) { fail(res, e, 'Feature request error:'); }
  });

// ── Verify payment (success page) ────────────────────────────────────────
router.get('/verify-payment/:invoiceId', async (req, res) => {
  try {
    if (!/^[0-9a-f]{32}$/.test(req.params.invoiceId)) return res.status(404).json({ success: false });
    const inv = await Invoice.findOne({ publicId: req.params.invoiceId, purpose: { $in: ['support', 'feature_request'] } })
      .select('-ipHash').lean();
    if (!inv) return res.status(404).json({ success: false });
    if (inv.status !== 'confirmed') return res.json({ success: false, message: 'Payment not completed', status: inv.status });

    const rec = await Support.findOne({ invoiceId: inv.publicId }).select('type message featureRequest amount -_id').lean();
    res.json({
      success: true,
      amount: inv.usdCents / 100,
      type: inv.purpose === 'feature_request' ? 'feature_request' : 'support',
      message: rec?.message || rec?.featureRequest || '',
      fulfilled: inv.fulfillState === 'done',
    });
  } catch (error) {
    console.error('Verification error:', error.message);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

// ── Supporters wall ──────────────────────────────────────────────────────
router.get('/supporters', async (req, res) => {
  try {
    const supporters = await Support.find({ type: 'support' })
      .sort({ createdAt: -1 })
      .limit(50)
      .select('name amount message createdAt -_id')
      .lean();

    const total = await Support.aggregate([
      { $match: { type: 'support' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const totalCount = await Support.countDocuments({ type: 'support' });

    res.json({
      supporters: supporters.map(s => ({
        name: s.name || 'Anonymous',
        amount: s.amount / 100,
        message: s.message,
        date: s.createdAt,
      })),
      totalRaised: total[0]?.total / 100 || 0,
      supporterCount: totalCount,
    });
  } catch (error) {
    console.error('Supporters fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch supporters' });
  }
});

// ── Feature requests list ────────────────────────────────────────────────
router.get('/feature-requests', async (req, res) => {
  try {
    const requests = await Support.find({ type: 'feature_request' })
      .sort({ amount: -1, createdAt: -1 })
      .select('name featureRequest amount createdAt -_id')
      .lean();

    res.json({
      requests: requests.map(r => ({
        name: r.name || 'Anonymous',
        feature: r.featureRequest,
        amount: r.amount / 100,
        date: r.createdAt,
      })),
      totalRequests: requests.length,
    });
  } catch (error) {
    console.error('Feature requests fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch feature requests' });
  }
});

module.exports = router;
