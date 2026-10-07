/*
 * PLANIT PROPRIETARY LICENSE
 * Copyright (c) 2026 Aakshat Hariharan. All rights reserved.
 *
 * White Label Management Routes
 * ─────────────────────────────
 * Admin-only CRUD for white label tenants.
 * Also exposes a public /resolve endpoint used by the frontend router
 * to look up branding config for a given domain.
 *
 * License Key Format
 * ──────────────────
 * WL-{TIER_PREFIX}-{DOMAIN_HASH_8}-{EXPIRY_EPOCH_HEX}-{HMAC_12}
 * e.g. WL-PRO-A3F72C1B-67AB3200-9F2E8C4D1A3B
 *
 * The HMAC is computed over: domain + tier + expiryEpoch
 * using process.env.WL_LICENSE_SECRET as the key.
 * Any tampering (wrong domain, wrong tier, expired) invalidates the HMAC.
 */

const express   = require('express');
const router    = express.Router();
const crypto    = require('crypto');
const WhiteLabel = require('../models/WhiteLabel');
const { verifyAdmin, requireSuperAdminRole, demoGuard } = require('../middleware/auth');
const axios      = require('axios');
const { body, validationResult } = require('express-validator');
const WLLead     = require('../models/WLLead');
const { recordIdentity } = require('../services/identityService');
const bcrypt     = require('bcryptjs');
const rateLimit  = require('express-rate-limit');
const Invoice    = require('../models/Invoice');
const payments   = require('../services/payments');
require('../services/payments/fulfillment');
const { realIp: resolveIp } = require('../middleware/realIp');

const setupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 8, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => resolveIp(req) || 'unknown',
  message: { error: 'rate_limited' },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const WL_SECRET = () => {
  const s = process.env.WL_LICENSE_SECRET;
  if (!s && process.env.NODE_ENV === 'production') {
    console.error('[FATAL] WL_LICENSE_SECRET not set in production!');
    process.exit(1);
  }
  return s || 'wl-dev-secret-change-in-prod';
};

const TIER_PREFIX = { basic: 'BSC', pro: 'PRO', enterprise: 'ENT' };

/**
 * Generate a signed, domain-bound license key.
 * Valid for `days` days from now (default 365).
 */
function generateLicenseKey(domain, tier, days = 365) {
  const expiresAt  = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const expiryEpoch = Math.floor(expiresAt.getTime() / 1000).toString(16).toUpperCase();

  // 8-char domain hash
  const domainHash = crypto
    .createHash('sha256')
    .update(domain.toLowerCase())
    .digest('hex')
    .slice(0, 8)
    .toUpperCase();

  // 12-char HMAC for integrity
  const payload  = `${domain.toLowerCase()}:${tier}:${expiryEpoch}`;
  const hmac     = crypto
    .createHmac('sha256', WL_SECRET())
    .update(payload)
    .digest('hex')
    .slice(0, 12)
    .toUpperCase();

  const key = `WL-${TIER_PREFIX[tier] || 'BSC'}-${domainHash}-${expiryEpoch}-${hmac}`;
  return { key, expiresAt };
}

/**
 * Verify a license key.
 * Returns { valid, reason } — used by the router middleware.
 */
function verifyLicenseKey(key, domain, tier) {
  try {
    const parts = key.split('-');
    if (parts.length !== 5 || parts[0] !== 'WL') return { valid: false, reason: 'malformed' };

    const [, tierPrefix, domainHash, expiryHex, hmac] = parts;

    // Expiry check
    const expiryEpoch = parseInt(expiryHex, 16);
    if (isNaN(expiryEpoch) || Date.now() / 1000 > expiryEpoch) {
      return { valid: false, reason: 'expired' };
    }

    // Tier prefix check
    if (TIER_PREFIX[tier] !== tierPrefix) return { valid: false, reason: 'tier_mismatch' };

    // Domain hash check
    const expectedDomainHash = crypto
      .createHash('sha256')
      .update(domain.toLowerCase())
      .digest('hex')
      .slice(0, 8)
      .toUpperCase();
    if (expectedDomainHash !== domainHash) return { valid: false, reason: 'domain_mismatch' };

    // HMAC integrity check
    const payload = `${domain.toLowerCase()}:${tier}:${expiryHex}`;
    const expectedHmac = crypto
      .createHmac('sha256', WL_SECRET())
      .update(payload)
      .digest('hex')
      .slice(0, 12)
      .toUpperCase();
    if (expectedHmac !== hmac) return { valid: false, reason: 'invalid_signature' };

    return { valid: true, expiresAt: new Date(expiryEpoch * 1000) };
  } catch {
    return { valid: false, reason: 'parse_error' };
  }
}

// ─── Internal: CORS domain list (called by router every 5 min) ───────────────
// No auth — only returns domains, no sensitive data. Router uses this to
// automatically allow any active/trial white-label domain without env var changes.

router.get('/cors-domains', async (req, res) => {
  try {
    // Include suspended/cancelled so the browser can still reach /resolve
    // and get a proper 403 suspended response instead of a CORS error
    const items = await WhiteLabel.find(
      { status: { $in: ['active', 'trial', 'suspended', 'cancelled'] } },
      { domain: 1, _id: 0 },
    ).lean();

    const domains = items.map(wl => `https://${wl.domain}`);
    return res.json({ domains });
  } catch (err) {
    console.error('[whitelabel] cors-domains error', err);
    return res.status(500).json({ error: 'internal' });
  }
});

// ─── Public: Resolve domain → branding ───────────────────────────────────────
// Called by the frontend to detect if a custom domain has white-label branding.
// Returns 404 if not found or suspended.

router.get('/resolve', async (req, res) => {
  // ── Explicit CORS for this public endpoint ────────────────────────────────
  // This route is called cross-origin from every WL domain on every page load.
  // We set the header explicitly here so the browser can always read the
  // response — even if the CORS middleware hasn't run (e.g. during a deploy
  // where not all backend instances are on the latest server.js).
  // Without this, a suspended-domain 403 arrives without CORS headers and the
  // browser silently swallows it, causing the JS catch block to fire and the
  // normal PlanIt app to render instead of the suspended page.
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }

  try {
    const { domain } = req.query;
    if (!domain) return res.status(400).json({ error: 'domain required' });

    const wl = await WhiteLabel.findOne({
      domain: domain.toLowerCase().trim(),
    }).lean();

    if (!wl) return res.status(404).json({ error: 'not_found' });

    // Suspended/cancelled — return 403 WITH branding so the suspended page
    // can be styled with the client's brand colors and logo.
    if (wl.status === 'suspended' || wl.status === 'cancelled') {
      return res.status(403).json({
        error:      'suspended',
        status:     wl.status,
        clientName: wl.clientName,
        branding:   wl.branding,
      });
    }

    // If the client linked a homepage event, resolve its mode server-side so
    // the frontend knows whether to route to the table-service reservation
    // flow or the standard event space — without an extra client round trip.
    // linkedEventKind: 'table_service' | 'standard' | null (null = not found/unset)
    let linkedEventKind = null;
    const linkedSubdomain = wl.pages?.home?.tableServiceEventId?.trim();
    if (linkedSubdomain) {
      const Event = require('../models/Event');
      const linked = await Event.findOne({ subdomain: linkedSubdomain.toLowerCase(), wlDomain: wl.domain, status: 'active' })
        .select('isTableServiceMode')
        .lean();
      if (linked) linkedEventKind = linked.isTableServiceMode ? 'table_service' : 'standard';
    }

    return res.json({
      clientName:      wl.clientName,
      tier:            wl.tier,
      status:          wl.status,
      branding:        wl.branding,
      pages:           wl.pages   || {},
      features:        wl.features || {},
      licenseKey:      wl.licenseKey,
      keyExpiresAt:    wl.keyExpiresAt,
      portalEnabled:   wl.portal?.enabled || false,
      linkedEventKind,
    });
  } catch (err) {
    console.error('[whitelabel] resolve error', err);
    return res.status(500).json({ error: 'internal' });
  }
});

// ─── Public: Heartbeat (called by white-label instances) ─────────────────────
// Client sends only the domain — backend looks up the stored key and verifies
// it internally. This keeps the licenseKey off the wire after initial setup.
//
// Response codes:
//   200  { ok: true,  status, tier, expiresAt }  — valid, let them through
//   403  { ok: false, reason: 'suspended' }       — admin manually suspended
//   403  { ok: false, reason: 'expired'   }       — key past expiry date
//   403  { ok: false, reason: ... }               — tampered / invalid key
//   404  { error:  'not_found' }                  — domain not registered

router.post('/heartbeat', async (req, res) => {
  try {
    const { domain } = req.body;
    if (!domain) return res.status(400).json({ error: 'domain required' });

    const wl = await WhiteLabel.findOne({ domain: domain.toLowerCase().trim() }).lean();
    if (!wl) return res.status(404).json({ error: 'not_found' });

    // Admin suspension takes priority
    if (wl.status === 'suspended') {
      await WhiteLabel.updateOne({ _id: wl._id }, { $inc: { heartbeatFailed: 1 } });
      return res.status(403).json({ ok: false, reason: 'suspended' });
    }

    // Cryptographic verification of the stored license key
    const check = verifyLicenseKey(wl.licenseKey, domain, wl.tier);
    if (!check.valid) {
      await WhiteLabel.updateOne({ _id: wl._id }, { $inc: { heartbeatFailed: 1 } });
      return res.status(403).json({ ok: false, reason: check.reason });
    }

    // All good — record the heartbeat
    await WhiteLabel.updateOne({ _id: wl._id }, {
      $set: { lastHeartbeat: new Date(), heartbeatFailed: 0 },
      $inc: { heartbeatCount: 1 },
    });

    return res.json({ ok: true, status: wl.status, tier: wl.tier, expiresAt: check.expiresAt });
  } catch (err) {
    console.error('[whitelabel] heartbeat error', err);
    return res.status(500).json({ error: 'internal' });
  }
});

// ─── Admin: Verify a key (utility endpoint) ───────────────────────────────────

router.post('/verify-key', verifyAdmin, async (req, res) => {
  try {
    const { key, domain, tier } = req.body;
    if (!key || !domain || !tier) return res.status(400).json({ error: 'key, domain and tier required' });
    const result = verifyLicenseKey(key, domain, tier);
    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: 'internal' });
  }
});

// ─── Admin: List all white labels ─────────────────────────────────────────────

router.get('/', verifyAdmin, async (req, res) => {
  try {
    const { status, tier, search } = req.query;
    const query = {};
    if (status) query.status = status;
    if (tier)   query.tier   = tier;
    if (search) {
      const re = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      query.$or = [{ clientName: re }, { domain: re }, { contactEmail: re }];
    }

    const items = await WhiteLabel.find(query)
      .sort({ createdAt: -1 })
      .lean();

    // Compute key validity for each without exposing raw key
    const enriched = items.map(wl => ({
      ...wl,
      keyStatus: wl.licenseKey
        ? verifyLicenseKey(wl.licenseKey, wl.domain, wl.tier)
        : { valid: false, reason: 'no_key' },
    }));

    return res.json({ items: enriched, total: enriched.length });
  } catch (err) {
    console.error('[whitelabel] list error', err);
    return res.status(500).json({ error: 'internal' });
  }
});

// ─── Payments ─────────────────────────────────────────────────────────────────
// Billing runs on PlanIt Payments (self-hosted Bitcoin invoicing — see
// services/payments). There are no inbound webhooks: jobs/paymentWatcher.js
// watches the chain and calls the fulfillment handlers in
// services/payments/fulfillment.js when an invoice confirms.

// ─── Admin: Stats summary ─────────────────────────────────────────────────────

router.get('/meta/stats', verifyAdmin, async (req, res) => {
  try {
    const [total, active, trial, suspended, tierCounts] = await Promise.all([
      WhiteLabel.countDocuments(),
      WhiteLabel.countDocuments({ status: 'active' }),
      WhiteLabel.countDocuments({ status: 'trial' }),
      WhiteLabel.countDocuments({ status: 'suspended' }),
      WhiteLabel.aggregate([
        { $group: { _id: '$tier', count: { $sum: 1 } } },
      ]),
    ]);

    // Revenue: sum of monthlyAmount where billingStatus = 'active'
    const revenueAgg = await WhiteLabel.aggregate([
      { $match: { 'billing.billingStatus': 'active' } },
      { $group: { _id: null, mrr: { $sum: '$billing.monthlyAmount' } } },
    ]);

    const mrr = revenueAgg[0]?.mrr || 0;
    const tiers = {};
    for (const t of tierCounts) tiers[t._id] = t.count;

    return res.json({ total, active, trial, suspended, mrr, tiers });
  } catch (err) {
    return res.status(500).json({ error: 'internal' });
  }
});

// ─── PUBLIC: Sign-up / Lead request ──────────────────────────────────────────
// No auth. Called from the /white-label marketing page.

router.post('/request', [
  body('businessName').trim().notEmpty().isLength({ max: 200 }),
  body('contactName').trim().notEmpty().isLength({ max: 200 }),
  body('email').isEmail().normalizeEmail(),
  body('businessType').isIn(['restaurant', 'venue', 'hotel', 'corporate', 'other']),
  body('tierInterest').optional().isIn(['basic', 'pro', 'enterprise', 'unsure']),
  body('phone').optional().trim().isLength({ max: 30 }),
  body('website').optional().trim().isLength({ max: 300 }),
  body('message').optional().trim().isLength({ max: 2000 }),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'validation', details: errors.array() });

  try {
    const { businessName, contactName, email, businessType, tierInterest, phone, website, message } = req.body;

    // Deduplicate by email — update existing or create new
    const lead = await WLLead.findOneAndUpdate(
      { email },
      { businessName, contactName, email, businessType, tierInterest: tierInterest || 'unsure', phone, website, message },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    recordIdentity(req, { source: 'wl_lead', name: contactName, email, phone });

    console.log(`[wl-lead] New lead: ${businessName} <${email}> tier=${tierInterest}`);

    // Discord notification — reuse same webhook as support.js
    const discordUrl = process.env.DISCORD_WEBHOOK_URL;
    if (discordUrl) {
      const tierLabels = { basic: 'Basic ($149/mo)', pro: 'Pro ($249/mo)', enterprise: 'Enterprise ($499/mo)', unsure: 'Not sure yet' };
      const typeLabels = { restaurant: 'Restaurant', venue: 'Venue / Event Space', hotel: 'Hotel', corporate: 'Corporate', other: 'Other' };
      try {
        const alertUser = process.env.DISCORD_ALERT_USER_ID || '1168575437723680850';
        await axios.post(discordUrl, {
          content: `<@${alertUser}> New white label inquiry from **${String(businessName).replace(/[@*_`~|>]/g, '')}**`,
          allowed_mentions: { users: [alertUser] },
          embeds: [{
            title: 'White Label Sign-up Request',
            color: 0x6366f1,
            fields: [
              { name: 'Business', value: businessName, inline: true },
              { name: 'Type', value: typeLabels[businessType] || businessType, inline: true },
              { name: 'Contact', value: `${contactName} — ${email}`, inline: false },
              { name: 'Tier Interest', value: tierLabels[tierInterest] || 'Not specified', inline: true },
              ...(phone ? [{ name: 'Phone', value: phone, inline: true }] : []),
              ...(website ? [{ name: 'Website', value: website, inline: true }] : []),
              ...(message ? [{ name: 'Message', value: message.substring(0, 1024) }] : []),
            ],
            timestamp: new Date().toISOString(),
            footer: { text: 'PlanIt White Label' },
          }],
        }, { headers: { 'Content-Type': 'application/json' } });
      } catch (e) {
        console.warn('[wl-lead] Discord notify failed:', e.message);
      }
    }

    return res.json({ ok: true, id: lead._id });
  } catch (err) {
    console.error('[wl-lead] request error', err);
    return res.status(500).json({ error: 'internal' });
  }
});

// ─── Admin: List leads ────────────────────────────────────────────────────────

router.get('/leads', verifyAdmin, async (req, res) => {
  try {
    const { status, limit = 50, skip = 0 } = req.query;
    const filter = status ? { status } : {};
    const [leads, total] = await Promise.all([
      WLLead.find(filter).sort({ createdAt: -1 }).limit(Number(limit)).skip(Number(skip)).lean(),
      WLLead.countDocuments(filter),
    ]);
    const counts = await WLLead.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]);
    const bystatus = {};
    for (const c of counts) bystatus[c._id] = c.n;
    return res.json({ leads, total, bystatus });
  } catch (err) {
    return res.status(500).json({ error: 'internal' });
  }
});

// ─── Admin: Update lead status / notes ───────────────────────────────────────

router.patch('/leads/:id', verifyAdmin, async (req, res) => {
  try {
    const { status, notes, convertedToId } = req.body;
    const update = {};
    if (status) update.status = status;
    if (notes !== undefined) update.notes = notes;
    if (convertedToId) update.convertedToId = convertedToId;
    const lead = await WLLead.findByIdAndUpdate(req.params.id, update, { new: true }).lean();
    if (!lead) return res.status(404).json({ error: 'not_found' });
    return res.json(lead);
  } catch (err) {
    return res.status(500).json({ error: 'internal' });
  }
});

// ─── Admin: Delete lead ───────────────────────────────────────────────────────

router.delete('/leads/:id', verifyAdmin, requireSuperAdminRole, async (req, res) => {
  try {
    await WLLead.findByIdAndDelete(req.params.id);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'internal' });
  }
});
// ─── PUBLIC: Setup fee payment ($299) ────────────────────────────────────────
// Called from /white-label/setup-fee after a lead is confirmed.
// The price and the buyer details come from the SERVER (the lead record) —
// nothing the browser sends can change the amount.

const SETUP_FEE_CENTS = 29900;

router.post('/setup-fee/checkout', setupLimiter, [
  body('leadId').isMongoId(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'validation' });

  try {
    const lead = await WLLead.findById(req.body.leadId).lean();
    if (!lead) return res.status(404).json({ error: 'not_found' });
    if (lead.setupFeePaid) return res.status(409).json({ error: 'already_paid' });

    const inv = await payments.createInvoice({
      purpose: 'wl_setup',
      refId: String(lead._id),
      usdCents: SETUP_FEE_CENTS,
      label: lead.businessName,
      pii: { email: lead.email, businessName: lead.businessName, contactName: lead.contactName || '' },
      ip: resolveIp(req),
      reuseOpen: true,
    });

    return res.json({ invoiceId: inv.publicId, payUrl: `/pay/${inv.publicId}?next=setup` });
  } catch (err) {
    if (err instanceof payments.PaymentError) return res.status(err.status).json({ error: err.code, message: err.message });
    console.error('[wl-setup-fee] checkout error', err.message);
    return res.status(500).json({ error: 'internal' });
  }
});

// ─── PUBLIC: Setup fee success verification ───────────────────────────────────

router.get('/setup-fee/verify', async (req, res) => {
  const id = String(req.query.invoice || '');
  if (!/^[0-9a-f]{32}$/.test(id)) return res.status(400).json({ error: 'missing invoice' });
  try {
    const inv = await Invoice.findOne({ publicId: id, purpose: 'wl_setup' }).select('status label emailHint usdCents').lean();
    if (!inv) return res.status(404).json({ error: 'not_found' });
    if (inv.status !== 'confirmed') return res.status(402).json({ error: 'not_paid', status: inv.status });
    return res.json({ ok: true, businessName: inv.label, email: inv.emailHint, amount: inv.usdCents });
  } catch (err) {
    return res.status(500).json({ error: 'internal' });
  }
});

// ─── Admin: Get single white label ────────────────────────────────────────────

router.get('/:id', verifyAdmin, async (req, res) => {
  try {
    const wl = await WhiteLabel.findById(req.params.id).lean();
    if (!wl) return res.status(404).json({ error: 'not_found' });
    const keyStatus = wl.licenseKey
      ? verifyLicenseKey(wl.licenseKey, wl.domain, wl.tier)
      : { valid: false, reason: 'no_key' };
    return res.json({ ...wl, keyStatus });
  } catch (err) {
    return res.status(500).json({ error: 'internal' });
  }
});

// ─── Admin: Create white label ────────────────────────────────────────────────

router.post('/', verifyAdmin, demoGuard, async (req, res) => {
  try {
    const {
      clientName, domain, tier = 'basic',
      contactName, contactEmail, contactPhone,
      branding = {}, limits = {}, notes,
      billing = {},
      portalPassword,
      keyValidDays = 365,
    } = req.body;

    if (!clientName || !domain) {
      return res.status(400).json({ error: 'clientName and domain are required' });
    }
    if (typeof portalPassword !== 'string' || portalPassword.trim().length < 12 || portalPassword.trim().length > 200) {
      return res.status(400).json({ error: 'A client portal password of at least 12 characters is required.' });
    }

    const normalDomain = domain.toLowerCase().trim();

    // Check uniqueness
    const existing = await WhiteLabel.findOne({ domain: normalDomain });
    if (existing) return res.status(409).json({ error: 'domain_taken' });

    // Generate license key
    const { key, expiresAt } = generateLicenseKey(normalDomain, tier, keyValidDays);

    const portalPasswordHash = await bcrypt.hash(portalPassword, 12);
    const wl = await WhiteLabel.create({
      clientName,
      domain: normalDomain,
      tier,
      status:       'trial',
      licenseKey:   key,
      keyIssuedAt:  new Date(),
      keyExpiresAt: expiresAt,
      contactName,
      contactEmail,
      contactPhone,
      branding: {
        companyName:   branding.companyName   || clientName,
        logoUrl:       branding.logoUrl       || '',
        faviconUrl:    branding.faviconUrl    || '',
        primaryColor:  branding.primaryColor  || '#2563eb',
        accentColor:   branding.accentColor   || '#1d4ed8',
        fontFamily:    branding.fontFamily    || 'Inter',
        hidePoweredBy: tier !== 'basic' ? (branding.hidePoweredBy ?? false) : false,
        customCss:     tier === 'enterprise'  ? (branding.customCss || '') : '',
      },
      limits: {
        maxEvents:         limits.maxEvents         || (tier === 'basic' ? 10 : tier === 'pro' ? 50 : 999),
        maxGuestsPerEvent: limits.maxGuestsPerEvent || (tier === 'basic' ? 500 : tier === 'pro' ? 2000 : 99999),
        maxAdminUsers:     limits.maxAdminUsers     || (tier === 'basic' ? 3 : tier === 'pro' ? 10 : 999),
      },
      billing: {
        mode:           'sandbox',
        billingStatus:  'sandbox',
        monthlyAmount:  billing.monthlyAmount || 0,
        currency:       'usd',
      },
      portal: { enabled: true, passwordHash: portalPasswordHash },
      notes,
    });

    console.log(`[whitelabel] Created ${wl._id} — ${clientName} (${normalDomain}) tier=${tier}`);
    const result = wl.toObject();
    if (result.portal) delete result.portal.passwordHash;
    return res.status(201).json(result);
  } catch (err) {
    console.error('[whitelabel] create error', err);
    if (err.code === 11000) return res.status(409).json({ error: 'domain_taken' });
    return res.status(500).json({ error: 'internal' });
  }
});

// ─── Admin: Update white label ────────────────────────────────────────────────

router.patch('/:id', verifyAdmin, demoGuard, async (req, res) => {
  try {
    const allowed = [
      'clientName', 'tier', 'status',
      'contactName', 'contactEmail', 'contactPhone',
      'branding', 'pages', 'features', 'limits', 'notes', 'billing',
    ];

    const updates = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) {
        if (typeof req.body[k] === 'object' && !Array.isArray(req.body[k])) {
          // Merge nested objects — go two levels deep for pages.home, pages.contact etc.
          for (const [subKey, val] of Object.entries(req.body[k])) {
            if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
              for (const [leafKey, leafVal] of Object.entries(val)) {
                updates[`${k}.${subKey}.${leafKey}`] = leafVal;
              }
            } else {
              updates[`${k}.${subKey}`] = val;
            }
          }
        } else {
          updates[k] = req.body[k];
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'no valid fields to update' });
    }

    if (req.body.features?.showSeatingChart === true) {
      const currentTier = req.body.tier || (await WhiteLabel.findById(req.params.id).select('tier').lean())?.tier;
      if (currentTier === 'basic') return res.status(400).json({ error: 'Seating chart requires Pro or Enterprise tier.' });
    }

    const requestedHomepageEvent = req.body.pages?.home?.tableServiceEventId;
    if (requestedHomepageEvent) {
      const current = await WhiteLabel.findById(req.params.id).select('domain').lean();
      if (!current) return res.status(404).json({ error: 'not_found' });
      const event = await require('../models/Event').findOne({
        subdomain: String(requestedHomepageEvent).trim().toLowerCase(),
        wlDomain: current.domain,
        status: 'active',
      }).select('_id').lean();
      if (!event) return res.status(400).json({ error: 'Homepage event must belong to this client.' });
    }

    const wl = await WhiteLabel.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true },
    ).lean();

    if (!wl) return res.status(404).json({ error: 'not_found' });

    console.log(`[whitelabel] Updated ${wl._id} — ${JSON.stringify(Object.keys(updates))}`);
    return res.json(wl);
  } catch (err) {
    console.error('[whitelabel] update error', err);
    return res.status(500).json({ error: 'internal' });
  }
});

// ─── Admin: Suspend / Unsuspend ───────────────────────────────────────────────

router.patch('/:id/suspend', verifyAdmin, demoGuard, async (req, res) => {
  try {
    const { suspend, reason } = req.body;
    const wl = await WhiteLabel.findById(req.params.id);
    if (!wl) return res.status(404).json({ error: 'not_found' });

    wl.status        = suspend ? 'suspended' : 'active';
    wl.suspendReason = suspend ? (reason || 'Suspended by admin') : '';
    await wl.save();

    console.log(`[whitelabel] ${suspend ? 'Suspended' : 'Unsuspended'} ${wl._id} (${wl.domain})`);
    return res.json({ status: wl.status, suspendReason: wl.suspendReason });
  } catch (err) {
    return res.status(500).json({ error: 'internal' });
  }
});

// ─── Admin: Regenerate license key ────────────────────────────────────────────

router.post('/:id/regenerate-key', verifyAdmin, demoGuard, async (req, res) => {
  try {
    const { keyValidDays = 365 } = req.body;
    const wl = await WhiteLabel.findById(req.params.id);
    if (!wl) return res.status(404).json({ error: 'not_found' });

    const { key, expiresAt } = generateLicenseKey(wl.domain, wl.tier, keyValidDays);
    wl.licenseKey   = key;
    wl.keyIssuedAt  = new Date();
    wl.keyExpiresAt = expiresAt;
    await wl.save();

    console.log(`[whitelabel] Key regenerated for ${wl._id} (${wl.domain})`);
    return res.json({ licenseKey: key, keyExpiresAt: expiresAt });
  } catch (err) {
    console.error('[whitelabel] regen error', err);
    return res.status(500).json({ error: 'internal' });
  }
});

// ─── Admin: Delete white label ────────────────────────────────────────────────

router.delete('/:id', verifyAdmin, requireSuperAdminRole, demoGuard, async (req, res) => {
  try {
    const wl = await WhiteLabel.findByIdAndDelete(req.params.id).lean();
    if (!wl) return res.status(404).json({ error: 'not_found' });
    console.log(`[whitelabel] Deleted ${wl._id} (${wl.domain})`);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: 'internal' });
  }
});

// ─── Subscription pricing (USD cents / month) ────────────────────────────────
// Uses the amount the admin set for this client (billing.monthlyAmount); falls
// back to the public list price for the tier. Override with WL_PRICE_*_CENTS.

const TIER_DEFAULT_CENTS = () => ({
  basic:      Number(process.env.WL_PRICE_BASIC_CENTS      || 4900),
  pro:        Number(process.env.WL_PRICE_PRO_CENTS        || 9999),
  enterprise: Number(process.env.WL_PRICE_ENTERPRISE_CENTS || 14999),
});

// ─── Create a Bitcoin payment link for a client's monthly bill ───────────────
// Admin calls this → returns a pay-page URL → send it to the client.

router.post('/:id/create-checkout', verifyAdmin, demoGuard, async (req, res) => {
  try {
    const wl = await WhiteLabel.findById(req.params.id).lean();
    if (!wl) return res.status(404).json({ error: 'not_found' });

    const usdCents = wl.billing?.monthlyAmount > 0 ? wl.billing.monthlyAmount : TIER_DEFAULT_CENTS()[wl.tier];
    if (!usdCents) return res.status(400).json({ error: `No price configured for tier: ${wl.tier}` });

    const inv = await payments.createInvoice({
      purpose: 'wl_subscription',
      refId: String(wl._id),
      usdCents,
      label: wl.clientName,
      pii: { email: wl.contactEmail || '', businessName: wl.clientName },
      reuseOpen: true,
    });

    const frontendUrl = (process.env.FRONTEND_URL || 'https://planitapp.onrender.com').split(',')[0].trim().replace(/\/$/, '');
    return res.json({ url: `${frontendUrl}/pay/${inv.publicId}`, invoiceId: inv.publicId, expiresAt: inv.expiresAt });
  } catch (err) {
    if (err instanceof payments.PaymentError) return res.status(err.status).json({ error: err.message });
    console.error('[whitelabel] create-checkout error', err.message);
    return res.status(500).json({ error: 'internal' });
  }
});

// ─── Latest invoice for a client (replaces the Stripe billing portal) ────────

router.get('/:id/latest-invoice', verifyAdmin, async (req, res) => {
  try {
    const inv = await Invoice.findOne({ purpose: 'wl_subscription', refId: String(req.params.id) })
      .sort({ createdAt: -1 }).select('publicId status usdCents expiresAt paidAt').lean();
    if (!inv) return res.status(404).json({ error: 'No invoices yet for this client — create a payment link first.' });
    const frontendUrl = (process.env.FRONTEND_URL || 'https://planitapp.onrender.com').split(',')[0].trim().replace(/\/$/, '');
    return res.json({ url: `${frontendUrl}/pay/${inv.publicId}`, status: inv.status, usd: inv.usdCents / 100, expiresAt: inv.expiresAt, paidAt: inv.paidAt });
  } catch (err) {
    console.error('[whitelabel] latest-invoice error', err.message);
    return res.status(500).json({ error: 'internal' });
  }
});

// ─── Admin: List events owned by a WL client ─────────────────────────────────
// GET /api/whitelabel/:id/events
// Events are linked via Event.wlDomain === WhiteLabel.domain (see events.js
// create route, which stamps wlDomain from a validated x-wl-domain header).
// Used by the client view modal to show what's already been created and to
// enforce limits.maxEvents before opening the create-event wizard.

router.get('/:id/events', verifyAdmin, async (req, res) => {
  try {
    const wl = await WhiteLabel.findById(req.params.id).select('domain limits pages.home.tableServiceEventId').lean();
    if (!wl) return res.status(404).json({ error: 'not_found' });

    const Event = require('../models/Event');
    const events = await Event.find({ wlDomain: wl.domain })
      .select('subdomain title date location status isTableServiceMode isEnterpriseMode eventType settings.isPublic createdAt participants')
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      events: events.map(e => ({
        id: e._id, subdomain: e.subdomain, title: e.title, date: e.date,
        location: e.location, status: e.status,
        isTableServiceMode: e.isTableServiceMode, isEnterpriseMode: e.isEnterpriseMode,
        eventType: e.eventType, isPublic: e.settings?.isPublic === true,
        createdAt: e.createdAt, participantCount: e.participants?.length || 0,
      })),
      count: events.length,
      maxEvents: wl.limits?.maxEvents ?? null,
      homepageEventSubdomain: wl.pages?.home?.tableServiceEventId || '',
    });
  } catch (err) {
    console.error('[whitelabel] list events error', err.message);
    return res.status(500).json({ error: 'internal' });
  }
});

// ─── Admin: Link a tenant-owned event as the white-label homepage ────────────
router.patch('/:id/home-event', verifyAdmin, demoGuard, async (req, res) => {
  try {
    const wl = await WhiteLabel.findById(req.params.id).select('domain').lean();
    if (!wl) return res.status(404).json({ error: 'not_found' });
    const subdomain = String(req.body?.subdomain || '').trim().toLowerCase();
    if (subdomain) {
      const event = await require('../models/Event').findOne({ subdomain, wlDomain: wl.domain, status: 'active' }).select('_id').lean();
      if (!event) return res.status(404).json({ error: 'event_not_found_or_not_owned' });
    }
    const updated = await WhiteLabel.findByIdAndUpdate(
      wl._id,
      { $set: { 'pages.home.tableServiceEventId': subdomain || null } },
      { new: true, runValidators: true },
    ).select('pages.home').lean();
    return res.json({ ok: true, homepageEventSubdomain: updated?.pages?.home?.tableServiceEventId || '' });
  } catch (err) {
    console.error('[whitelabel] homepage event link error', err.message);
    return res.status(500).json({ error: 'internal' });
  }
});

// ─── Admin: Create an event on behalf of a WL client ─────────────────────────
// POST /api/whitelabel/:id/create-event
// Skips the public self-serve flow entirely (no CAPTCHA/abuse scoring — this
// is an authenticated admin action). Stamps wlDomain so the event is owned by
// this client the same way self-serve WL events are, and enforces
// limits.maxEvents since nothing else in the codebase does.

router.post('/:id/create-event', verifyAdmin, demoGuard, [
  body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Title is required'),
  body('organizerName').trim().isLength({ min: 1, max: 100 }).withMessage('Organizer name is required'),
  body('organizerEmail').isEmail().normalizeEmail().withMessage('Valid organizer email is required'),
  body('accountPassword').isString().isLength({ min: 4, max: 200 }).withMessage('Organizer account password must be at least 4 characters.'),
  body('password').optional({ values: 'falsy' }).isString().isLength({ min: 6, max: 200 }).withMessage('Event password must be at least 6 characters.'),
  body('staffPassword').optional({ values: 'falsy' }).isString().isLength({ min: 4, max: 200 }).withMessage('Staff password must be at least 4 characters.'),
  body('date').optional({ nullable: true }).isISO8601().withMessage('Date must be a valid ISO date'),
  body('isTableServiceMode').optional().isBoolean(),
  body('isEnterpriseMode').optional().isBoolean(),
  body('showOnHome').optional().isBoolean(),
  body('eventType').optional().isIn(['standard', 'rsvpOnly']),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg, fields: errors.array() });

  try {
    const wl = await WhiteLabel.findById(req.params.id).lean();
    if (!wl) return res.status(404).json({ error: 'not_found' });
    if (wl.status === 'suspended') return res.status(400).json({ error: 'This client is suspended. Reactivate before creating events.' });

    const Event = require('../models/Event');
    const EventParticipant = require('../models/EventParticipant');

    // Enforce limits.maxEvents — nothing else in the codebase checks this today.
    const maxEvents = wl.limits?.maxEvents ?? 10;
    const currentCount = await Event.countDocuments({ wlDomain: wl.domain });
    if (currentCount >= maxEvents) {
      return res.status(400).json({ error: `This client has reached its event limit (${currentCount}/${maxEvents}). Raise limits.maxEvents to create more.` });
    }

    const {
      title, description = '', date = null, location = '',
      organizerName, organizerEmail,
      isTableServiceMode = false, isEnterpriseMode = false,
      eventType = 'standard', accountPassword, password, staffPassword,
      showOnHome = true,
      maxParticipants = 100,
    } = req.body;

    // Slugify the title into a subdomain and retry on collision, same shape
    // the public wizard produces client-side but done server-side here since
    // there's no shared helper and the admin shouldn't have to think about it.
    const base = String(title).toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'event';
    let subdomain = base;
    let suffix = 0;
    while (await Event.exists({ subdomain })) {
      suffix += 1;
      subdomain = `${base}-${suffix}`;
      if (suffix > 50) return res.status(500).json({ error: 'Could not generate a unique subdomain, try a different title.' });
    }

    const event = new Event({
      subdomain, title, description, date: date || undefined, location,
      organizerName, organizerEmail,
      password: password ? await bcrypt.hash(password, 10) : null,
      isPasswordProtected: !!password,
      isEnterpriseMode: !!isEnterpriseMode,
      isTableServiceMode: !!isTableServiceMode,
      eventType,
      ...(eventType === 'rsvpOnly' ? { rsvpPage: { enabled: true } } : {}),
      settings: { isPublic: !!showOnHome },
      maxParticipants,
      participants: [{ username: organizerName, role: 'organizer' }],
      wlDomain: wl.domain,
    });
    await event.save();

    await EventParticipant.create({
      eventId: event._id, username: organizerName, role: 'organizer',
      password: await bcrypt.hash(accountPassword, 10), hasPassword: true,
    });
    if (isTableServiceMode && staffPassword) {
      await EventParticipant.create({
        eventId: event._id, username: 'staff', role: 'staff',
        password: await bcrypt.hash(staffPassword, 10), hasPassword: true,
      });
    }

    const { sendEventConfirmation } = require('../services/emailService');
    sendEventConfirmation(event).catch(() => {});

    return res.status(201).json({
      message: 'Event created',
      event: { id: event._id, subdomain: event.subdomain, title: event.title },
    });
  } catch (err) {
    if (err?.code === 11000) return res.status(409).json({ error: 'Subdomain already in use, try again.' });
    console.error('[whitelabel] create-event error', err.message);
    return res.status(500).json({ error: 'internal' });
  }
});

// ─── Admin: Set / reset portal password for a WL client ──────────────────────
// POST /api/whitelabel/:id/portal/set-password
// Only super-admin or root admin. Enables portal access and sets the password.

router.post('/:id/portal/set-password', verifyAdmin, requireSuperAdminRole, demoGuard, [
  require('express-validator').body('password')
    .isString().trim()
    .isLength({ min: 12, max: 200 })
    .withMessage('Password must be at least 12 characters.'),
], async (req, res) => {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

  const wl = await WhiteLabel.findById(req.params.id);
  if (!wl) return res.status(404).json({ error: 'Client not found.' });

  const hash = await bcrypt.hash(req.body.password.trim(), 12);

  await WhiteLabel.updateOne({ _id: wl._id }, {
    $set: {
      'portal.enabled':       true,
      'portal.passwordHash':  hash,
      'portal.loginAttempts': 0,
      'portal.lockedUntil':   null,
    },
  });

  console.log(`[wl-portal] Admin set portal password for ${wl.domain} (id=${wl._id})`);
  res.json({ ok: true, portalUrl: `https://${wl.domain}/dashboard` });
});

// POST /api/whitelabel/:id/portal/disable
router.post('/:id/portal/disable', verifyAdmin, requireSuperAdminRole, demoGuard, async (req, res) => {
  const wl = await WhiteLabel.findById(req.params.id);
  if (!wl) return res.status(404).json({ error: 'Client not found.' });
  await WhiteLabel.updateOne({ _id: wl._id }, { $set: { 'portal.enabled': false } });
  res.json({ ok: true });
});

// GET /api/whitelabel/:id/portal/status
router.get('/:id/portal/status', verifyAdmin, async (req, res) => {
  const wl = await WhiteLabel.findById(req.params.id)
    .select('portal.enabled portal.lastLoginAt portal.lastLoginIp portal.loginAttempts portal.lockedUntil portal.loginLog domain')
    .lean();
  if (!wl) return res.status(404).json({ error: 'Client not found.' });
  res.json({
    enabled:       wl.portal?.enabled || false,
    lastLoginAt:   wl.portal?.lastLoginAt,
    lastLoginIp:   wl.portal?.lastLoginIp,
    loginAttempts: wl.portal?.loginAttempts || 0,
    lockedUntil:   wl.portal?.lockedUntil,
    recentLogins:  (wl.portal?.loginLog || []).reverse().slice(0, 20),
    portalUrl:     `https://${wl.domain}/dashboard`,
  });
});

module.exports = router;
