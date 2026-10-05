'use strict';

/**
 * services/payments/fulfillment.js
 *
 * What happens once an invoice is confirmed. Each handler is idempotent
 * (upserts / conditional updates) AND is only invoked once per invoice by
 * payments.fulfill(), so a retry after a crash can never double-grant anything.
 */

const payments = require('./index');
const { encrypt } = require('./fieldCrypto');
const notify = require('./notify');
const Support   = require('../../models/Support');
const WLLead    = require('../../models/WLLead');
const WhiteLabel = require('../../models/WhiteLabel');

// ── Donations & feature requests ─────────────────────────────────────────────
async function fulfillSupport(inv, pii) {
  const isFeature = inv.purpose === 'feature_request';
  const res = await Support.updateOne(
    { invoiceId: inv.publicId },
    {
      $setOnInsert: {
        invoiceId: inv.publicId,
        emailEnc: encrypt(pii.email || '', `support:${inv.publicId}`),
        name: (pii.name || '').slice(0, 100) || 'Anonymous',
        amount: inv.usdCents,
        message: isFeature ? undefined : (pii.message || '').slice(0, 500),
        featureRequest: isFeature ? (pii.feature || '').slice(0, 500) : undefined,
        type: isFeature ? 'feature_request' : 'support',
        btcTxid: inv.txids?.[0],
        createdAt: new Date(),
      },
    },
    { upsert: true },
  );
  if (res.upsertedCount === 1) {
    await notify.discord({
      content: isFeature
        ? `New feature request from ${pii.name || 'Anonymous'} — ${notify.usd(inv.usdCents)}`
        : `New donation from ${pii.name || 'Anonymous'} — ${notify.usd(inv.usdCents)}`,
      title: isFeature ? 'New Feature Request' : 'New Donation',
      color: isFeature ? 0x3b82f6 : 0x10b981,
      fields: [
        { name: 'From', value: pii.name || 'Anonymous', inline: true },
        { name: 'Amount', value: `${notify.usd(inv.usdCents)} (${(inv.btcSats / 1e8).toFixed(8)} BTC)`, inline: true },
        isFeature ? { name: 'Feature Request', value: pii.feature } : { name: 'Message', value: pii.message },
        { name: 'Network', value: inv.network, inline: true },
      ],
    });
  }
}

// ── White-label $299 setup fee ───────────────────────────────────────────────
async function fulfillSetup(inv, pii) {
  if (inv.refId) {
    await WLLead.updateOne(
      { _id: inv.refId, setupFeePaid: { $ne: true } },
      { $set: { status: 'contacted', setupFeePaid: true, setupFeePaidAt: new Date(), setupInvoiceId: inv.publicId } },
    ).catch(() => {});
  }
  await notify.discord({
    content: `Setup fee paid — ${notify.usd(inv.usdCents)}`,
    title: 'White Label Setup Fee Received',
    color: 0x22c55e,
    fields: [
      { name: 'Business', value: pii.businessName || inv.label || 'Unknown', inline: true },
      { name: 'Email', value: pii.email || '', inline: true },
      { name: 'Amount', value: `${notify.usd(inv.usdCents)} (${(inv.btcSats / 1e8).toFixed(8)} BTC)`, inline: true },
      { name: 'Next step', value: 'Admin → White Label → Leads → Convert to Client → set up their domain' },
    ],
  });
}

// ── White-label subscription (monthly) ───────────────────────────────────────
const DAY = 864e5;

async function fulfillSubscription(inv) {
  const wl = await WhiteLabel.findById(inv.refId).lean();
  if (!wl) throw new Error(`white label ${inv.refId} not found`);
  if (wl.billing?.lastInvoiceId === inv.publicId) return;   // already applied

  const base = wl.billing?.nextBillingDate && wl.billing.nextBillingDate > new Date() ? wl.billing.nextBillingDate : new Date();
  const next = new Date(base.getTime() + 30 * DAY);

  await WhiteLabel.updateOne(
    { _id: wl._id, 'billing.lastInvoiceId': { $ne: inv.publicId } },
    { $set: {
      status: 'active',
      'billing.billingStatus': 'active',
      'billing.mode': 'live',
      'billing.provider': 'planit-btc',
      'billing.lastInvoiceId': inv.publicId,
      'billing.lastPaidAt': new Date(),
      'billing.nextBillingDate': next,
    } },
  );
  await notify.discord({
    content: `Subscription payment received — ${wl.clientName}`,
    title: 'White Label Subscription Paid',
    color: 0x6366f1,
    fields: [
      { name: 'Client', value: wl.clientName, inline: true },
      { name: 'Tier', value: wl.tier, inline: true },
      { name: 'Amount', value: notify.usd(inv.usdCents), inline: true },
      { name: 'Paid through', value: next.toISOString().slice(0, 10) },
    ],
  });
}

payments.registerFulfillment('support', fulfillSupport);
payments.registerFulfillment('feature_request', fulfillSupport);
payments.registerFulfillment('wl_setup', fulfillSetup);
payments.registerFulfillment('wl_subscription', fulfillSubscription);

module.exports = {};
