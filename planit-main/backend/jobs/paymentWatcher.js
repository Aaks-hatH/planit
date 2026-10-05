'use strict';

/**
 * jobs/paymentWatcher.js
 *
 * Runs on EVERY backend instance. Instances cooperate through a per-invoice
 * lease (`lockUntil`), so each invoice is checked by exactly one instance at a
 * time and no payment is ever processed twice.
 */

const cron = require('node-cron');
const Invoice = require('../models/Invoice');
const WhiteLabel = require('../models/WhiteLabel');
const payments = require('../services/payments');
require('../services/payments/fulfillment');
const btc = require('../services/payments/bitcoin');
const notify = require('../services/payments/notify');

const TICK_MS = 10_000;
const PER_TICK = 8;
const LEASE_MS = 45_000;
let running = false;

async function claimNext() {
  const now = new Date();
  return Invoice.findOneAndUpdate(
    {
      nextCheckAt: { $lte: now },
      $and: [
        { $or: [{ lockUntil: null }, { lockUntil: { $lt: now } }] },
        { $or: [
          { status: { $in: ['pending', 'detected', 'expired', 'review'] } },
          { status: 'confirmed', fulfillState: { $ne: 'done' } },
        ] },
      ],
    },
    { $set: { lockUntil: new Date(now.getTime() + LEASE_MS) } },
    { sort: { nextCheckAt: 1 }, new: true },
  );
}

async function processOne(inv) {
  try {
    let cur = inv;
    if (['pending', 'detected', 'expired', 'review'].includes(cur.status)) cur = await payments.checkInvoice(cur);
    if (cur && cur.status === 'confirmed' && cur.fulfillState !== 'done') await payments.fulfill(cur);
  } catch (e) {
    console.error('[payments] check failed', inv.publicId, e.message);
    await Invoice.updateOne({ _id: inv._id }, { $set: { nextCheckAt: new Date(Date.now() + 60_000) } }).catch(() => {});
  } finally {
    await Invoice.updateOne({ _id: inv._id }, { $set: { lockUntil: null } }).catch(() => {});
  }
}

async function tick() {
  if (running) return;
  running = true;
  try {
    for (let i = 0; i < PER_TICK; i++) {
      const inv = await claimNext();
      if (!inv) break;
      await processOne(inv);
      await new Promise(r => setTimeout(r, 150));   // be polite to the public API
    }
  } finally { running = false; }
}

/** On-demand check from the "I've paid" button (throttled by the caller). */
async function checkNow(invoiceId) {
  const now = new Date();
  const inv = await Invoice.findOneAndUpdate(
    { _id: invoiceId, $or: [{ lockUntil: null }, { lockUntil: { $lt: now } }] },
    { $set: { lockUntil: new Date(now.getTime() + 20_000) } },
    { new: true },
  );
  if (!inv) return null;
  try {
    let cur = inv;
    if (['pending', 'detected', 'expired', 'review'].includes(cur.status)) cur = await payments.checkInvoice(cur);
    if (cur?.status === 'confirmed' && cur.fulfillState !== 'done') await payments.fulfill(cur);
    return await Invoice.findById(invoiceId);
  } finally {
    await Invoice.updateOne({ _id: invoiceId }, { $set: { lockUntil: null } }).catch(() => {});
  }
}

/** Daily: flag renewals that are due soon / overdue. Admin sends the pay link. */
async function renewalSweep() {
  try {
    const soon = new Date(Date.now() + 7 * 864e5);
    const due = await WhiteLabel.find({
      status: { $in: ['active', 'trial'] },
      'billing.billingStatus': { $in: ['active', 'past_due'] },
      'billing.monthlyAmount': { $gt: 0 },
      'billing.nextBillingDate': { $lte: soon },
    }).select('clientName tier billing').lean();

    for (const wl of due) {
      const overdue = wl.billing.nextBillingDate < new Date();
      if (overdue && wl.billing.billingStatus === 'active') {
        await WhiteLabel.updateOne({ _id: wl._id, 'billing.billingStatus': 'active' }, { $set: { 'billing.billingStatus': 'past_due' } });
      }
      const open = await Invoice.countDocuments({ purpose: 'wl_subscription', refId: String(wl._id), status: { $in: ['pending', 'detected', 'review'] } });
      if (open) continue;
      await notify.discord({
        content: overdue ? `Renewal OVERDUE — ${wl.clientName}` : `Renewal due soon — ${wl.clientName}`,
        title: 'White Label Renewal',
        color: overdue ? 0xef4444 : 0xf59e0b,
        fields: [
          { name: 'Client', value: wl.clientName, inline: true },
          { name: 'Amount', value: notify.usd(wl.billing.monthlyAmount), inline: true },
          { name: 'Due', value: new Date(wl.billing.nextBillingDate).toISOString().slice(0, 10), inline: true },
          { name: 'Action', value: 'Admin → White Label → client → Create Payment Link' },
        ],
      });
    }
  } catch (e) { console.error('[payments] renewal sweep failed', e.message); }
}

function startPaymentWatcher() {
  try {
    const net = btc.assertConfigured();
    console.log(`[payments] PlanIt Payments active — Bitcoin ${net}`);
  } catch (e) {
    console.error(`[payments] NOT ACTIVE: ${e.message}`);
    return;
  }
  setInterval(() => { tick().catch(e => console.error('[payments] tick', e.message)); }, TICK_MS).unref?.();
  cron.schedule('0 9 * * *', () => { renewalSweep(); });
}

module.exports = { startPaymentWatcher, checkNow, tick };
