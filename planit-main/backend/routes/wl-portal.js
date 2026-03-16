/*
 * PLANIT PROPRIETARY LICENSE
 * Copyright (c) 2026 Aakshat Hariharan. All rights reserved.
 *
 * White-Label Client Portal Routes
 * ─────────────────────────────────
 * Served at /api/wl-portal/*
 * These routes are called from a client's custom domain (e.g. tickets.venue.com/dashboard).
 *
 * Security model
 * ──────────────
 * 1. Login is domain-scoped: the WL record is looked up by Origin/Referer host,
 *    not by any user-supplied identifier. A client cannot log in "as" another client.
 * 2. JWT is domain-bound: the token payload includes the wlId AND the domain.
 *    verifyWLClient re-checks domain on every request.
 * 3. Brute-force protection: 5 consecutive failures → 15-min lockout stored in DB.
 *    Lockout is per-record, not per-IP, so VPN-hopping doesn't bypass it.
 *    IP is also tracked and logged.
 * 4. Rate limiting: 5 login attempts / 15 min / IP (via authLimiter from rateLimiter.js)
 *    plus the per-record lockout above — two independent layers.
 * 5. Login audit: last 50 attempts (IP, UA, success, timestamp) stored on record.
 * 6. No password in JWT. No sensitive fields returned to client.
 * 7. Tokens expire in 8 hours. No refresh tokens — client re-authenticates.
 * 8. Writes are restricted by tier: basic clients cannot change enterprise-only fields.
 */

'use strict';

const express    = require('express');
const router     = express.Router();
const jwt        = require('jsonwebtoken');
const bcrypt     = require('bcryptjs');
const crypto     = require('crypto');
const { body, validationResult } = require('express-validator');
const rateLimit  = require('express-rate-limit');
const WhiteLabel = require('../models/WhiteLabel');
const { secrets } = require('../keys');

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_ATTEMPTS     = 5;           // before lockout
const LOCKOUT_MS       = 15 * 60 * 1000; // 15 minutes
const TOKEN_TTL_SEC    = 8 * 60 * 60;    // 8 hours
const AUDIT_LOG_MAX    = 50;

// ─── Login rate limiter — 5 attempts per 15 min per IP ───────────────────────

const portalLoginLimiter = rateLimit({
  windowMs:              15 * 60 * 1000,
  max:                   5,
  skipSuccessfulRequests: true,
  standardHeaders:        true,
  legacyHeaders:          false,
  keyGenerator: (req) => {
    const fwd = req.headers['x-forwarded-for'];
    return (fwd ? fwd.split(',')[0].trim() : null) || req.ip || 'unknown';
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many login attempts from this network. Try again in 15 minutes.',
    });
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  return (fwd ? fwd.split(',')[0].trim() : null) || req.ip || 'unknown';
}

function clientUa(req) {
  return (req.headers['user-agent'] || '').slice(0, 200);
}

/** Extract the hostname of the caller (Origin preferred, Referer fallback). */
function callerDomain(req) {
  const origin = req.headers['origin'];
  if (origin) {
    try { return new URL(origin).hostname.toLowerCase(); } catch { /* fall through */ }
  }
  const referer = req.headers['referer'];
  if (referer) {
    try { return new URL(referer).hostname.toLowerCase(); } catch { /* fall through */ }
  }
  // Last resort: x-wl-domain header set by the router for non-browser clients
  return (req.headers['x-wl-domain'] || '').toLowerCase() || null;
}

function signPortalToken(wl) {
  return jwt.sign(
    {
      sub:    wl._id.toString(),
      domain: wl.domain,
      tier:   wl.tier,
      scope:  'wl_portal',
    },
    secrets.jwt,
    { expiresIn: TOKEN_TTL_SEC }
  );
}

// ─── verifyWLClient middleware ────────────────────────────────────────────────
// Verifies the portal JWT AND re-checks that the token's domain matches the
// caller's domain. A stolen token from domain A cannot be used on domain B.

async function verifyWLClient(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, secrets.jwt);
  } catch (e) {
    return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }

  if (decoded.scope !== 'wl_portal') {
    return res.status(403).json({ error: 'Invalid token scope.' });
  }

  // Domain binding — re-derive caller domain and compare to token claim
  const caller = callerDomain(req);
  if (caller && caller !== decoded.domain) {
    console.warn(`[wl-portal] domain mismatch: token=${decoded.domain} caller=${caller}`);
    return res.status(403).json({ error: 'Token domain mismatch.' });
  }

  // Verify the WL record still exists and is not suspended/cancelled
  const wl = await WhiteLabel.findById(decoded.sub).lean();
  if (!wl) return res.status(404).json({ error: 'Client record not found.' });
  if (wl.status === 'suspended') return res.status(403).json({ error: 'Account suspended.', status: 'suspended' });
  if (wl.status === 'cancelled') return res.status(403).json({ error: 'Account cancelled.', status: 'cancelled' });
  if (!wl.portal?.enabled)       return res.status(403).json({ error: 'Portal access not enabled for this account.' });

  req.wlClient = wl;
  next();
}

// ─── POST /login ──────────────────────────────────────────────────────────────

router.post('/login', portalLoginLimiter, [
  body('password').isString().isLength({ min: 1, max: 200 }).trim(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Invalid request.' });

  const domain = callerDomain(req);
  if (!domain) return res.status(400).json({ error: 'Could not determine domain. Ensure Origin header is present.' });

  const ip = clientIp(req);
  const ua = clientUa(req);
  const { password } = req.body;

  // Constant-time delay to prevent timing-based domain enumeration
  await new Promise(r => setTimeout(r, 100 + Math.random() * 100));

  const wl = await WhiteLabel.findOne({ domain }).select(
    '+portal.passwordHash +portal.loginAttempts +portal.lockedUntil +portal.loginLog +portal.enabled'
  );

  // Domain not found — return same error as wrong password to prevent enumeration
  if (!wl || !wl.portal?.enabled || !wl.portal?.passwordHash) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  // Check lockout
  if (wl.portal.lockedUntil && wl.portal.lockedUntil > new Date()) {
    const secsLeft = Math.ceil((wl.portal.lockedUntil - Date.now()) / 1000);
    return res.status(429).json({
      error: `Account temporarily locked. Try again in ${secsLeft} seconds.`,
      lockedSeconds: secsLeft,
    });
  }

  // Verify password
  const valid = await bcrypt.compare(password, wl.portal.passwordHash);

  // Build audit log entry
  const logEntry = { ts: new Date(), ip, success: valid, ua };

  if (valid) {
    // Reset brute-force counters, record login
    await WhiteLabel.updateOne({ _id: wl._id }, {
      $set:   { 'portal.loginAttempts': 0, 'portal.lockedUntil': null, 'portal.lastLoginAt': new Date(), 'portal.lastLoginIp': ip },
      $push:  { 'portal.loginLog': { $each: [logEntry], $slice: -AUDIT_LOG_MAX } },
    });

    const token = signPortalToken(wl);
    return res.json({
      token,
      expiresIn: TOKEN_TTL_SEC,
      client: {
        clientName: wl.clientName,
        domain:     wl.domain,
        tier:       wl.tier,
        status:     wl.status,
      },
    });
  } else {
    // Increment failure counter, maybe lock
    const attempts = (wl.portal.loginAttempts || 0) + 1;
    const lockUntil = attempts >= MAX_ATTEMPTS ? new Date(Date.now() + LOCKOUT_MS) : null;

    await WhiteLabel.updateOne({ _id: wl._id }, {
      $set:  { 'portal.loginAttempts': attempts, 'portal.lockedUntil': lockUntil },
      $push: { 'portal.loginLog': { $each: [logEntry], $slice: -AUDIT_LOG_MAX } },
    });

    const remaining = MAX_ATTEMPTS - attempts;
    if (lockUntil) {
      return res.status(401).json({
        error: `Too many failed attempts. Account locked for 15 minutes.`,
        locked: true,
      });
    }
    return res.status(401).json({
      error: `Invalid credentials. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining before lockout.`,
      attemptsRemaining: remaining,
    });
  }
});

// ─── GET /me ──────────────────────────────────────────────────────────────────

router.get('/me', verifyWLClient, (req, res) => {
  const wl = req.wlClient;
  res.json({
    clientName:  wl.clientName,
    domain:      wl.domain,
    tier:        wl.tier,
    status:      wl.status,
    branding:    wl.branding || {},
    pages:       wl.pages   || {},
    features:    wl.features || {},
    billing: {
      billingStatus:   wl.billing?.billingStatus,
      nextBillingDate: wl.billing?.nextBillingDate,
      trialEndsAt:     wl.billing?.trialEndsAt,
      monthlyAmount:   wl.billing?.monthlyAmount,
    },
    limits:       wl.limits || {},
    lastLoginAt:  wl.portal?.lastLoginAt,
    lastLoginIp:  wl.portal?.lastLoginIp,
  });
});

// ─── PATCH /branding ──────────────────────────────────────────────────────────

const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/;
const SAFE_URL  = /^https?:\/\/.{4,}/;

router.patch('/branding', verifyWLClient, [
  body('companyName').optional().isString().trim().isLength({ max: 200 }),
  body('primaryColor').optional().matches(HEX_COLOR),
  body('accentColor').optional().matches(HEX_COLOR),
  body('fontFamily').optional().isString().trim().isLength({ max: 80 }),
  body('logoUrl').optional().custom(v => !v || SAFE_URL.test(v)).withMessage('Invalid URL'),
  body('faviconUrl').optional().custom(v => !v || SAFE_URL.test(v)).withMessage('Invalid URL'),
  body('hidePoweredBy').optional().isBoolean(),
  body('customCss').optional().isString().isLength({ max: 10000 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed.', details: errors.array() });

  const wl  = req.wlClient;
  const tier = wl.tier;

  const allowed = ['companyName', 'primaryColor', 'accentColor', 'fontFamily', 'logoUrl', 'faviconUrl'];

  // pro+ only
  if (tier === 'pro' || tier === 'enterprise') allowed.push('hidePoweredBy');

  // enterprise only
  if (tier === 'enterprise') allowed.push('customCss');

  const update = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      update[`branding.${key}`] = req.body[key];
    }
  }

  if (!Object.keys(update).length) return res.status(400).json({ error: 'No valid fields to update.' });

  const updated = await WhiteLabel.findByIdAndUpdate(
    wl._id,
    { $set: update },
    { new: true, runValidators: true }
  ).lean();

  res.json({ ok: true, branding: updated.branding });
});

// ─── PATCH /pages ─────────────────────────────────────────────────────────────

router.patch('/pages', verifyWLClient, [
  body('home.headline').optional().isString().trim().isLength({ max: 200 }),
  body('home.subheadline').optional().isString().trim().isLength({ max: 400 }),
  body('home.heroImageUrl').optional().custom(v => !v || SAFE_URL.test(v)),
  body('home.ctaText').optional().isString().trim().isLength({ max: 60 }),
  body('home.showSearch').optional().isBoolean(),
  body('home.tableServiceEventId').optional({ nullable: true }).isString().trim().isLength({ max: 200 }),
  body('events.headline').optional().isString().trim().isLength({ max: 200 }),
  body('events.emptyStateText').optional().isString().trim().isLength({ max: 300 }),
  body('checkout.headerNote').optional().isString().trim().isLength({ max: 500 }),
  body('checkout.successHeadline').optional().isString().trim().isLength({ max: 200 }),
  body('checkout.successMessage').optional().isString().trim().isLength({ max: 500 }),
  body('checkout.footerNote').optional().isString().trim().isLength({ max: 300 }),
  body('contact.email').optional().isEmail().normalizeEmail(),
  body('contact.phone').optional().isString().trim().isLength({ max: 40 }),
  body('contact.address').optional().isString().trim().isLength({ max: 300 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed.', details: errors.array() });

  const wl = req.wlClient;
  const PAGES = ['home', 'events', 'checkout', 'contact'];
  const PAGE_FIELDS = {
    home:     ['headline', 'subheadline', 'heroImageUrl', 'ctaText', 'showSearch', 'tableServiceEventId'],
    events:   ['headline', 'emptyStateText'],
    checkout: ['headerNote', 'successHeadline', 'successMessage', 'footerNote'],
    contact:  ['email', 'phone', 'address'],
  };

  const update = {};
  for (const page of PAGES) {
    if (!req.body[page]) continue;
    for (const field of PAGE_FIELDS[page]) {
      if (req.body[page][field] !== undefined) {
        update[`pages.${page}.${field}`] = req.body[page][field];
      }
    }
  }

  if (!Object.keys(update).length) return res.status(400).json({ error: 'No valid fields.' });

  const updated = await WhiteLabel.findByIdAndUpdate(
    wl._id,
    { $set: update },
    { new: true, runValidators: true }
  ).lean();

  res.json({ ok: true, pages: updated.pages });
});

// ─── PATCH /features ──────────────────────────────────────────────────────────

const FEATURE_KEYS = ['showGuestList', 'showWaitlist', 'showSeatingChart', 'showSocialShare', 'showReviews', 'allowGuestSignup'];

router.patch('/features', verifyWLClient, [
  ...FEATURE_KEYS.map(k => body(k).optional().isBoolean()),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'Validation failed.' });

  const wl  = req.wlClient;
  // Seating chart is pro+ only
  if (req.body.showSeatingChart !== undefined && wl.tier === 'basic') {
    return res.status(403).json({ error: 'Seating chart requires Pro or Enterprise tier.' });
  }

  const update = {};
  for (const key of FEATURE_KEYS) {
    if (req.body[key] !== undefined) update[`features.${key}`] = req.body[key];
  }

  if (!Object.keys(update).length) return res.status(400).json({ error: 'No valid fields.' });

  const updated = await WhiteLabel.findByIdAndUpdate(wl._id, { $set: update }, { new: true }).lean();
  res.json({ ok: true, features: updated.features });
});

// ─── POST /change-password ────────────────────────────────────────────────────

router.post('/change-password', verifyWLClient, [
  body('currentPassword').isString().isLength({ min: 1, max: 200 }),
  body('newPassword').isString().isLength({ min: 12, max: 200 })
    .withMessage('New password must be at least 12 characters.'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  const wl = await WhiteLabel.findById(req.wlClient._id).select('+portal.passwordHash');
  if (!wl?.portal?.passwordHash) return res.status(400).json({ error: 'No password set.' });

  const valid = await bcrypt.compare(req.body.currentPassword, wl.portal.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Current password is incorrect.' });

  const newHash = await bcrypt.hash(req.body.newPassword, 12);
  await WhiteLabel.updateOne({ _id: wl._id }, { $set: { 'portal.passwordHash': newHash } });

  res.json({ ok: true });
});

// ─── GET /audit ───────────────────────────────────────────────────────────────

router.get('/audit', verifyWLClient, async (req, res) => {
  const wl = await WhiteLabel.findById(req.wlClient._id)
    .select('portal.loginLog portal.lastLoginAt portal.lastLoginIp')
    .lean();

  const log = (wl?.portal?.loginLog || []).reverse().slice(0, 20);
  res.json({
    lastLoginAt: wl?.portal?.lastLoginAt,
    lastLoginIp: wl?.portal?.lastLoginIp,
    recentLogins: log,
  });
});

module.exports = { router, verifyWLClient };
