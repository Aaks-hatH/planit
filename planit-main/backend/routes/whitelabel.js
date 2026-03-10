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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const WL_SECRET = () => process.env.WL_LICENSE_SECRET || 'wl-dev-secret-change-in-prod';

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
    const items = await WhiteLabel.find(
      { status: { $in: ['active', 'trial'] } },
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
  try {
    const { domain } = req.query;
    if (!domain) return res.status(400).json({ error: 'domain required' });

    const wl = await WhiteLabel.findOne({
      domain: domain.toLowerCase().trim(),
      status: { $in: ['active', 'trial'] },
    }).lean();

    if (!wl) return res.status(404).json({ error: 'not_found' });

    // Only return branding — never internal billing/key data
    return res.json({
      clientName:   wl.clientName,
      tier:         wl.tier,
      branding:     wl.branding,
    });
  } catch (err) {
    console.error('[whitelabel] resolve error', err);
    return res.status(500).json({ error: 'internal' });
  }
});

// ─── Public: Heartbeat (called by white-label instances) ─────────────────────

router.post('/heartbeat', async (req, res) => {
  try {
    const { domain, licenseKey } = req.body;
    if (!domain || !licenseKey) return res.status(400).json({ error: 'missing fields' });

    const wl = await WhiteLabel.findOne({ domain: domain.toLowerCase(), licenseKey });
    if (!wl) return res.status(404).json({ error: 'not_found' });

    const check = verifyLicenseKey(licenseKey, domain, wl.tier);
    if (!check.valid) {
      await WhiteLabel.updateOne({ _id: wl._id }, { $inc: { heartbeatFailed: 1 } });
      return res.status(403).json({ error: 'invalid_key', reason: check.reason });
    }

    await WhiteLabel.updateOne({ _id: wl._id }, {
      $set:  { lastHeartbeat: new Date(), heartbeatFailed: 0 },
      $inc:  { heartbeatCount: 1 },
    });

    return res.json({ ok: true, status: wl.status, tier: wl.tier });
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
      keyValidDays = 365,
    } = req.body;

    if (!clientName || !domain) {
      return res.status(400).json({ error: 'clientName and domain are required' });
    }

    const normalDomain = domain.toLowerCase().trim();

    // Check uniqueness
    const existing = await WhiteLabel.findOne({ domain: normalDomain });
    if (existing) return res.status(409).json({ error: 'domain_taken' });

    // Generate license key
    const { key, expiresAt } = generateLicenseKey(normalDomain, tier, keyValidDays);

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
      notes,
    });

    console.log(`[whitelabel] Created ${wl._id} — ${clientName} (${normalDomain}) tier=${tier}`);
    return res.status(201).json(wl);
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
      'branding', 'limits', 'notes', 'billing',
    ];

    const updates = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) {
        if (typeof req.body[k] === 'object' && !Array.isArray(req.body[k])) {
          // Merge nested objects
          for (const [subKey, val] of Object.entries(req.body[k])) {
            updates[`${k}.${subKey}`] = val;
          }
        } else {
          updates[k] = req.body[k];
        }
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'no valid fields to update' });
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

module.exports = router;
