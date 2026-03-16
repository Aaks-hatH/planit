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
const bcrypt     = require('bcryptjs');

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

// ─── Admin: Get single white label ────────────────────────────────────────────

// ─── Stripe Webhook ───────────────────────────────────────────────────────────
// Stripe calls this endpoint when subscription events occur.
// IMPORTANT: This route must receive the raw request body (not JSON-parsed).
// In server.js the webhook path is registered with express.raw() BEFORE express.json().

router.post('/webhooks/stripe', async (req, res) => {
  const sig    = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    console.error('[whitelabel] STRIPE_WEBHOOK_SECRET not set — webhook rejected');
    return res.status(500).send('Webhook secret not configured');
  }

  let event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (err) {
    console.error('[whitelabel] Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  const obj  = event.data.object;
  const wlId = obj.metadata?.planit_wl_id || obj.subscription_details?.metadata?.planit_wl_id;

  try {
    switch (event.type) {

      // Payment collected — handles BOTH $299 setup fee AND subscription start
      case 'checkout.session.completed': {
        const discordUrl = process.env.DISCORD_WEBHOOK_URL;

        // ── One-time setup fee payment ($299) ─────────────────────────────────
        if (obj.mode === 'payment') {
          const leadId      = obj.metadata?.leadId;
          const bizName     = obj.metadata?.businessName || 'Unknown business';
          const custEmail   = obj.customer_details?.email || obj.customer_email || '';
          const amountPaid  = ((obj.amount_total || 0) / 100).toFixed(2);

          // Mark lead as "contacted" (already done at checkout creation, but ensure it)
          if (leadId) {
            await WLLead.findByIdAndUpdate(leadId, { status: 'contacted' }).catch(() => {});
          }

          console.log(`[whitelabel] ✓ Setup fee paid — ${bizName} <${custEmail}> $${amountPaid}`);

          // Discord notification to admin
          if (discordUrl) {
            await axios.post(discordUrl, {
              content: `💰 **Setup fee paid — $${amountPaid}**`,
              embeds: [{
                title: 'White Label Setup Fee Received',
                color: 0x22c55e,
                fields: [
                  { name: 'Business',    value: bizName,    inline: true },
                  { name: 'Email',       value: custEmail,  inline: true },
                  { name: 'Amount',      value: `$${amountPaid}`, inline: true },
                  { name: 'Next step',   value: 'Go to Admin → White Label → Leads → Convert to Client → set up their domain', inline: false },
                ],
                timestamp: new Date().toISOString(),
                footer: { text: 'PlanIt White Label — Stripe Webhook' },
              }],
            }, { headers: { 'Content-Type': 'application/json' } }).catch(e => {
              console.warn('[whitelabel] Discord setup fee notify failed:', e.message);
            });
          }
          break;
        }

        // ── Subscription checkout completed ───────────────────────────────────
        if (obj.mode === 'subscription') {
          const subscriptionId = obj.subscription;
          const update = {
            status:                         'active',
            'billing.stripeSubscriptionId': subscriptionId,
            'billing.billingStatus':        'active',
            'billing.mode':                 'live',
          };
          let clientName = '';
          if (wlId) {
            const updated = await WhiteLabel.findByIdAndUpdate(wlId, update, { new: true }).lean();
            clientName = updated?.clientName || wlId;
            console.log(`[whitelabel] ✓ Subscription activated ${wlId}`);
          } else {
            const updated = await WhiteLabel.findOneAndUpdate(
              { 'billing.stripeCustomerId': obj.customer }, update, { new: true }
            ).lean();
            clientName = updated?.clientName || obj.customer;
            console.log(`[whitelabel] ✓ Subscription activated by customer ${obj.customer}`);
          }

          // Discord notification
          if (discordUrl) {
            const custEmail = obj.customer_details?.email || '';
            const amountStr = obj.amount_total ? `$${(obj.amount_total / 100).toFixed(2)}/mo` : 'recurring';
            await axios.post(discordUrl, {
              content: `🎉 **New subscription started — ${clientName}**`,
              embeds: [{
                title: 'White Label Subscription Active',
                color: 0x6366f1,
                fields: [
                  { name: 'Client',    value: clientName, inline: true },
                  { name: 'Email',     value: custEmail,  inline: true },
                  { name: 'Amount',    value: amountStr,  inline: true },
                  { name: 'Sub ID',    value: subscriptionId || 'n/a', inline: false },
                ],
                timestamp: new Date().toISOString(),
                footer: { text: 'PlanIt White Label — Stripe Webhook' },
              }],
            }, { headers: { 'Content-Type': 'application/json' } }).catch(e => {
              console.warn('[whitelabel] Discord subscription notify failed:', e.message);
            });
          }
        }
        break;
      }

      // Subscription status changed (upgrade, downgrade, pause, etc.)
      case 'customer.subscription.updated': {
        const stripeStatus = obj.status; // active | past_due | canceled | paused | unpaid
        const billingStatus = stripeStatus === 'active' ? 'active' : stripeStatus === 'past_due' ? 'past_due' : 'cancelled';
        const platformStatus = billingStatus === 'active' ? 'active' : billingStatus === 'past_due' ? 'active' : 'suspended';
        const nextBillingDate = obj.current_period_end ? new Date(obj.current_period_end * 1000) : undefined;

        const update = {
          status: platformStatus,
          'billing.billingStatus':  billingStatus,
          ...(nextBillingDate && { 'billing.nextBillingDate': nextBillingDate }),
        };

        if (wlId) {
          await WhiteLabel.findByIdAndUpdate(wlId, update);
        } else {
          await WhiteLabel.findOneAndUpdate({ 'billing.stripeSubscriptionId': obj.id }, update);
        }
        console.log(`[whitelabel] Subscription updated: ${obj.id} → ${stripeStatus}`);
        break;
      }

      // Subscription cancelled (by client or admin)
      case 'customer.subscription.deleted': {
        const update = { status: 'cancelled', 'billing.billingStatus': 'cancelled' };
        if (wlId) {
          await WhiteLabel.findByIdAndUpdate(wlId, update);
        } else {
          await WhiteLabel.findOneAndUpdate({ 'billing.stripeSubscriptionId': obj.id }, update);
        }
        console.log(`[whitelabel] Subscription cancelled: ${obj.id}`);
        break;
      }

      // Payment failed — mark past_due but keep access briefly
      case 'invoice.payment_failed': {
        const subId = obj.subscription;
        if (!subId) break;
        await WhiteLabel.findOneAndUpdate(
          { 'billing.stripeSubscriptionId': subId },
          { 'billing.billingStatus': 'past_due' },
        );
        console.log(`[whitelabel] Payment failed for subscription ${subId}`);
        break;
      }

      // Invoice paid — ensure status is active (handles recovery from past_due)
      case 'invoice.payment_succeeded': {
        const subId = obj.subscription;
        if (!subId) break;
        await WhiteLabel.findOneAndUpdate(
          { 'billing.stripeSubscriptionId': subId },
          { status: 'active', 'billing.billingStatus': 'active' },
        );
        break;
      }

      default:
        // Unhandled event type — ignore silently
        break;
    }
  } catch (err) {
    console.error('[whitelabel] Webhook handler error:', err.message);
    // Still return 200 so Stripe doesn't retry
  }

  res.json({ received: true });
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

    console.log(`[wl-lead] New lead: ${businessName} <${email}> tier=${tierInterest}`);

    // Discord notification — reuse same webhook as support.js
    const discordUrl = process.env.DISCORD_WEBHOOK_URL;
    if (discordUrl) {
      const tierLabels = { basic: 'Basic ($149/mo)', pro: 'Pro ($249/mo)', enterprise: 'Enterprise ($499/mo)', unsure: 'Not sure yet' };
      const typeLabels = { restaurant: 'Restaurant', venue: 'Venue / Event Space', hotel: 'Hotel', corporate: 'Corporate', other: 'Other' };
      try {
        await axios.post(discordUrl, {
          content: `New white label inquiry from **${businessName}**`,
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
// ─── PUBLIC: Setup fee checkout ($299) ───────────────────────────────────────
// Called from /white-label/setup-fee page after a lead is confirmed.
// Requires a valid lead ID so we can pre-fill customer info.

router.post('/setup-fee/checkout', [
  body('leadId').notEmpty(),
  body('businessName').trim().notEmpty(),
  body('email').isEmail().normalizeEmail(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'validation' });

  try {
    const stripe = getStripe();
    const { leadId, businessName, email, contactName } = req.body;
    const frontendUrl = process.env.FRONTEND_URL || '';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: email,
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: 29900, // $299.00
          product_data: {
            name: 'PlanIt White Label — Setup Fee',
            description: 'One-time onboarding fee covering DNS configuration, SSL setup, branding, and launch testing. Your platform will be live within 48 hours of payment.',
            images: [],
          },
        },
        quantity: 1,
      }],
      metadata: { leadId, businessName, contactName: contactName || '' },
      success_url: `${frontendUrl}/white-label/setup-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${frontendUrl}/white-label`,
      payment_intent_data: {
        description: `Setup fee — ${businessName}`,
        metadata: { leadId, businessName },
      },
    });

    // Mark lead as contacted now that they've been sent to checkout
    await WLLead.findByIdAndUpdate(leadId, { status: 'contacted' }).catch(() => {});

    return res.json({ url: session.url });
  } catch (err) {
    console.error('[wl-setup-fee] checkout error', err);
    return res.status(500).json({ error: 'internal' });
  }
});

// ─── PUBLIC: Setup fee success verification ───────────────────────────────────

router.get('/setup-fee/verify', async (req, res) => {
  const { session_id } = req.query;
  if (!session_id) return res.status(400).json({ error: 'missing session_id' });
  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(session_id);
    if (session.payment_status !== 'paid') return res.status(402).json({ error: 'not_paid' });
    return res.json({
      ok: true,
      businessName: session.metadata?.businessName || '',
      email: session.customer_email || session.customer_details?.email || '',
      amount: session.amount_total,
    });
  } catch (err) {
    return res.status(500).json({ error: 'internal' });
  }
});



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
      'branding', 'pages', 'features', 'limits', 'notes', 'billing',
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

// ─── Stripe helpers ───────────────────────────────────────────────────────────
// Reuses the same STRIPE_SECRET_KEY already configured for support payments.
// Lazy singleton — same pattern as support.js.

let _stripe = null;
function getStripe() {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is not configured");
    _stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
  }
  return _stripe;
}

const TIER_PRICES = () => ({
  basic:      process.env.STRIPE_PRICE_BASIC,
  pro:        process.env.STRIPE_PRICE_PRO,
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE,
});

// ─── Create Stripe Checkout session ──────────────────────────────────────────
// Admin calls this → returns a Stripe-hosted checkout URL → send to client

router.post('/:id/create-checkout', verifyAdmin, demoGuard, async (req, res) => {
  try {
    const stripe = getStripe();
    const wl = await WhiteLabel.findById(req.params.id).lean();
    if (!wl) return res.status(404).json({ error: 'not_found' });

    const prices = TIER_PRICES();
    const priceId = prices[wl.tier];
    if (!priceId) return res.status(400).json({ error: `No Stripe price configured for tier: ${wl.tier}. Set STRIPE_PRICE_${wl.tier.toUpperCase()} in env.` });

    // Create or reuse Stripe customer
    let customerId = wl.billing?.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        name:  wl.clientName,
        email: wl.contactEmail || undefined,
        metadata: { planit_wl_id: String(wl._id), domain: wl.domain },
      });
      customerId = customer.id;
      await WhiteLabel.findByIdAndUpdate(wl._id, { 'billing.stripeCustomerId': customerId });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'https://planitapp.onrender.com';

    const session = await stripe.checkout.sessions.create({
      customer:   customerId,
      mode:       'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      metadata:   { planit_wl_id: String(wl._id) },
      success_url: `${frontendUrl}/admin?section=whitelabel&checkout=success&wl=${wl._id}`,
      cancel_url:  `${frontendUrl}/admin?section=whitelabel&checkout=cancelled&wl=${wl._id}`,
      subscription_data: {
        metadata: { planit_wl_id: String(wl._id), domain: wl.domain, tier: wl.tier },
      },
    });

    return res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('[whitelabel] create-checkout error', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Stripe Customer Portal (for client self-service) ────────────────────────
// Returns a Stripe-hosted portal URL where the client can update payment details or cancel

router.post('/:id/billing-portal', verifyAdmin, async (req, res) => {
  try {
    const stripe = getStripe();
    const wl = await WhiteLabel.findById(req.params.id).lean();
    if (!wl) return res.status(404).json({ error: 'not_found' });

    const customerId = wl.billing?.stripeCustomerId;
    if (!customerId) return res.status(400).json({ error: 'No Stripe customer linked to this client yet. Create a checkout session first.' });

    const frontendUrl = process.env.FRONTEND_URL || 'https://planitapp.onrender.com';

    const session = await stripe.billingPortal.sessions.create({
      customer:   customerId,
      return_url: `${frontendUrl}/admin?section=whitelabel`,
    });

    return res.json({ url: session.url });
  } catch (err) {
    console.error('[whitelabel] billing-portal error', err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
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
