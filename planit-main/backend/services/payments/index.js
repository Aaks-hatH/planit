'use strict';

/**
 * services/payments/index.js — PlanIt Payments core.
 *
 * Self-hosted Bitcoin invoicing:
 *   createInvoice()  → locks a USD→BTC quote, hands out a unique address
 *   checkInvoice()   → reads the chain, advances the state machine
 *   fulfill()        → runs the purchase-specific "you're paid" logic, exactly once
 *
 * Money safety rules enforced here:
 *   • amounts are computed server-side from USD cents; the client never supplies sats or an address
 *   • integer math only
 *   • every address is verified never-used before it is handed out
 *   • state transitions are atomic (findOneAndUpdate with a status guard)
 *   • late / partial / odd payments go to `review` for a human, never auto-accepted
 */

const crypto = require('crypto');
const Invoice     = require('../../models/Invoice');
const AddressSlot = require('../../models/AddressSlot');
const { Counter } = AddressSlot;
const btc    = require('./bitcoin');
const chain  = require('./chainApi');
const { encrypt, decrypt, hmac } = require('./fieldCrypto');
const notify = require('./notify');

class PaymentError extends Error {
  constructor(code, status = 400, message) { super(message || code); this.code = code; this.status = status; }
}

// ── Config ───────────────────────────────────────────────────────────────────
const num = (v, d) => (Number.isFinite(Number(v)) && v !== undefined && v !== '' ? Number(v) : d);

const CFG = () => ({
  quoteMinutes: { support: num(process.env.BTC_QUOTE_MIN_SUPPORT, 20), wl: num(process.env.BTC_QUOTE_MIN_WL, 60) },
  toleranceBps: num(process.env.BTC_TOLERANCE_BPS, 100),           // 1% underpay tolerance
  minSats:      num(process.env.BTC_MIN_SATS, 2000),
  maxUsdCents:  num(process.env.BTC_MAX_USD_CENTS, 500000),        // $5,000
  maxOpenPerIp: num(process.env.BTC_MAX_OPEN_PER_IP, 4),
  maxOpenTotal: num(process.env.BTC_MAX_OPEN_TOTAL, 300),
  graceHours:   num(process.env.BTC_GRACE_HOURS, 24),
});

function requiredConfirmations(usdCents) {
  if (usdCents < 2000)  return num(process.env.BTC_CONF_SMALL, 0);   // < $20
  if (usdCents < 10000) return num(process.env.BTC_CONF_MEDIUM, 1);  // < $100
  return num(process.env.BTC_CONF_LARGE, 2);                          // $100+
}

const minAccepted = (sats) => sats - Math.floor((sats * CFG().toleranceBps) / 10000);

let _io = null;
const setIo = (io) => { _io = io; };

function emit(inv) {
  try { _io?.of('/pay').to(`invoice:${inv.publicId}`).emit('invoice:update', publicView(inv)); } catch { /* best effort */ }
}

// ── Public view (the ONLY shape ever sent to browsers) ───────────────────────
function publicView(inv) {
  const min = minAccepted(inv.btcSats);
  const remaining = Math.max(0, min - (inv.seenSats || 0));
  const partial = (inv.seenSats || 0) > 0 && remaining > 0;
  const payAmount = partial ? remaining : inv.btcSats;
  return {
    id: inv.publicId,
    purpose: inv.purpose,
    status: inv.status,
    network: inv.network,
    usd: inv.usdCents / 100,
    btc: btc.satsToBtcString(inv.btcSats),
    sats: inv.btcSats,
    rateUsd: inv.rateUsd,
    address: inv.address,
    uri: btc.bip21(inv.address, payAmount),
    partial,
    remainingBtc: partial ? btc.satsToBtcString(remaining) : null,
    requiredConf: inv.requiredConf,
    confirmations: inv.confirmations || 0,
    seenSats: inv.seenSats || 0,
    expiresAt: inv.expiresAt,
    paidAt: inv.paidAt || null,
    label: inv.label || '',
    emailHint: inv.emailHint || '',
    txid: inv.txids?.[0] || null,
  };
}

function maskEmail(e) {
  const m = String(e || '').match(/^(.)[^@]*(@.+)$/);
  return m ? `${m[1]}***${m[2]}` : '';
}

// ── Address allocation ───────────────────────────────────────────────────────
async function allocateSlot(publicId) {
  const net = btc.networkName();
  for (let attempt = 0; attempt < 8; attempt++) {
    // Prefer recycling the lowest never-used index → keeps the wallet's scan window tight.
    let slot = await AddressSlot.findOneAndUpdate(
      { network: net, status: 'free' },
      { $set: { status: 'assigned', invoiceId: publicId } },
      { sort: { index: 1 }, new: true },
    );
    if (!slot) {
      const c = await Counter.findOneAndUpdate({ _id: `slot:${net}` }, { $inc: { seq: 1 } }, { upsert: true, new: true });
      const index = c.seq - 1;
      slot = await AddressSlot.create({ index, address: btc.deriveAddress(index), network: net, status: 'assigned', invoiceId: publicId });
    }
    let fresh;
    try {
      fresh = await chain.addressIsFresh(slot.address);
    } catch (e) {
      await AddressSlot.updateOne({ _id: slot._id }, { $set: { status: 'free' }, $unset: { invoiceId: 1 } });
      throw new PaymentError('chain_unavailable', 503, 'Bitcoin network lookup unavailable — please retry shortly');
    }
    if (fresh) return slot;
    // Someone (or the owner's own wallet) already used it — retire it and try the next.
    await AddressSlot.updateOne({ _id: slot._id }, { $set: { status: 'used' } });
  }
  throw new PaymentError('no_address', 503, 'Could not allocate a payment address');
}

async function setSlot(inv, status) {
  await AddressSlot.updateOne(
    { network: inv.network, address: inv.address },
    status === 'free' ? { $set: { status }, $unset: { invoiceId: 1 } } : { $set: { status } },
  );
}

// ── Create ───────────────────────────────────────────────────────────────────
async function createInvoice({ purpose, refId = '', usdCents, pii = {}, label = '', ip = '', reuseOpen = false }) {
  const cfg = CFG();
  if (!btc.isConfigured()) throw new PaymentError('not_configured', 503, 'Payments are not configured');
  if (!Number.isInteger(usdCents) || usdCents < 100 || usdCents > cfg.maxUsdCents) {
    throw new PaymentError('bad_amount', 400, 'Invalid amount');
  }

  const ipHash = ip ? hmac(ip) : undefined;
  const now = new Date();

  // Re-use an identical open invoice (double-click / refresh must not burn addresses).
  if (reuseOpen && refId) {
    const existing = await Invoice.findOne({
      purpose, refId, usdCents, status: { $in: ['pending', 'detected'] }, expiresAt: { $gt: now },
    });
    if (existing) return existing;
  }

  if (ipHash) {
    const open = await Invoice.countDocuments({ ipHash, status: { $in: ['pending', 'detected'] }, expiresAt: { $gt: now } });
    if (open >= cfg.maxOpenPerIp) throw new PaymentError('too_many_open', 429, 'Too many open payments — finish or wait for one to expire');
  }
  const totalOpen = await Invoice.countDocuments({ status: { $in: ['pending', 'detected'] }, expiresAt: { $gt: now } });
  if (totalOpen >= cfg.maxOpenTotal) throw new PaymentError('busy', 503, 'Payments are busy — please try again in a few minutes');

  let rate;
  try { rate = await chain.btcUsd(); } catch { throw new PaymentError('price_unavailable', 503, 'Exchange rate unavailable — please retry shortly'); }
  const btcSats = btc.usdCentsToSats(usdCents, rate);
  if (btcSats < cfg.minSats) throw new PaymentError('bad_amount', 400, 'Amount too small');

  const publicId = crypto.randomBytes(16).toString('hex');
  const slot = await allocateSlot(publicId);

  const minutes = purpose.startsWith('wl_') ? cfg.quoteMinutes.wl : cfg.quoteMinutes.support;
  try {
    const inv = await Invoice.create({
      publicId, purpose, refId: String(refId || ''), usdCents, btcSats, rateUsd: rate,
      network: btc.networkName(), address: slot.address, slotIndex: slot.index,
      requiredConf: requiredConfirmations(usdCents),
      expiresAt: new Date(now.getTime() + minutes * 60_000),
      label: String(label || '').slice(0, 200),
      emailHint: maskEmail(pii.email),
      pii: encrypt(JSON.stringify(pii), publicId),
      ipHash,
      nextCheckAt: new Date(now.getTime() + 10_000),
      events: [{ type: 'created', detail: `${usdCents}c @ ${rate} → ${btcSats} sats` }],
    });
    return inv;
  } catch (e) {
    await AddressSlot.updateOne({ _id: slot._id }, { $set: { status: 'free' }, $unset: { invoiceId: 1 } }).catch(() => {});
    throw e;
  }
}

function readPii(inv) {
  try { return JSON.parse(decrypt(inv.pii, inv.publicId) || '{}'); } catch { return {}; }
}

/** Fresh quote for an expired, never-paid invoice — same purpose/amount, same buyer details. */
async function requote(inv, ip) {
  if (!['expired'].includes(inv.status) || inv.seenSats > 0) throw new PaymentError('not_requotable', 409, 'This payment cannot be re-quoted');
  return createInvoice({
    purpose: inv.purpose, refId: inv.refId, usdCents: inv.usdCents, pii: readPii(inv), label: inv.label, ip, reuseOpen: true,
  });
}

// ── Chain check / state machine ──────────────────────────────────────────────
async function transition(inv, from, set, evt) {
  const update = { $set: set };
  if (evt) update.$push = { events: { $each: [{ at: new Date(), type: evt.type, detail: String(evt.detail || '').slice(0, 300) }], $slice: -50 } };
  return Invoice.findOneAndUpdate({ _id: inv._id, status: { $in: from } }, update, { new: true });
}

const ACTIVE = ['pending', 'detected'];

async function checkInvoice(inv) {
  const cfg = CFG();
  const now = new Date();
  const [{ txs }, tip] = await Promise.all([chain.addressReceipts(inv.address), chain.tipHeight()]);

  let seen = 0, confirmedSum = 0;
  const confs = [];
  for (const t of txs) {
    const c = t.confirmed ? Math.max(1, tip - t.height + 1) : 0;
    seen += t.sats;
    confs.push(c);
    if (c >= inv.requiredConf) confirmedSum += t.sats;
  }
  const counters = {
    seenSats: seen,
    confirmedSats: confirmedSum,
    confirmations: confs.length ? Math.min(...confs) : 0,
    txids: txs.map(t => t.txid).slice(0, 20),
    lastCheckedAt: now,
  };
  const min = minAccepted(inv.btcSats);
  const age = now - inv.createdAt;
  let next = inv;
  let wait = 20_000;

  if (seen > 0) await setSlot(inv, 'used');   // an address that saw funds is never recycled

  if (ACTIVE.includes(inv.status)) {
    if (confirmedSum >= min) {
      next = await transition(inv, ACTIVE, { ...counters, status: 'confirmed', paidAt: now, purgeAt: new Date(now.getTime() + 2 * 365 * 864e5), nextCheckAt: now },
        { type: 'confirmed', detail: `${confirmedSum} sats, ${counters.confirmations} conf` });
      wait = 0;
    } else if (seen >= min && (now <= inv.expiresAt || inv.status === 'detected')) {
      next = await transition(inv, ACTIVE, { ...counters, status: 'detected' },
        inv.status === 'pending' ? { type: 'detected', detail: `${seen} sats in mempool/chain` } : null);
      wait = 20_000;
    } else if (now > inv.expiresAt && inv.status === 'pending') {
      if (seen > 0) {
        next = await transition(inv, ['pending'], { ...counters, status: 'review' }, { type: 'review', detail: `late/partial payment: ${seen} of ${inv.btcSats} sats` });
        await notify.discord({
          content: `Payment needs review — ${notify.usd(inv.usdCents)} (${inv.purpose})`, title: 'PlanIt Payments — review needed', color: 0xf59e0b,
          fields: [
            { name: 'Invoice', value: inv.publicId },
            { name: 'Received', value: `${seen} sats of ${inv.btcSats}`, inline: true },
            { name: 'Why', value: 'Paid after the quote expired, or only part of the amount', inline: false },
          ],
        });
      } else {
        next = await transition(inv, ['pending'], { ...counters, status: 'expired' }, { type: 'expired', detail: 'quote expired unpaid' });
      }
      wait = 10 * 60_000;
    } else {
      // Still waiting. A payment that was replaced/dropped from the mempool demotes back to pending.
      const set = { ...counters, status: seen > 0 && seen >= min ? 'detected' : 'pending' };
      const evt = inv.status === 'detected' && set.status === 'pending' ? { type: 'dropped', detail: 'payment no longer visible (replaced or dropped)' } : null;
      next = await transition(inv, ACTIVE, set, evt);
      wait = age < 10 * 60_000 ? 15_000 : 30_000;
    }
  } else if (inv.status === 'expired') {
    const graceEnd = new Date(inv.expiresAt.getTime() + cfg.graceHours * 3600_000);
    if (seen > 0) {
      next = await transition(inv, ['expired'], { ...counters, status: 'review' }, { type: 'review', detail: `late payment after expiry: ${seen} sats` });
      await notify.discord({
        content: `Late payment received — ${notify.usd(inv.usdCents)} (${inv.purpose})`, title: 'PlanIt Payments — review needed', color: 0xf59e0b,
        fields: [{ name: 'Invoice', value: inv.publicId }, { name: 'Received', value: `${seen} sats`, inline: true }],
      });
      wait = 60 * 60_000;
    } else if (now > graceEnd) {
      const fresh = await chain.addressIsFresh(inv.address).catch(() => false);
      await setSlot(inv, fresh ? 'free' : 'used');
      next = await Invoice.findOneAndUpdate({ _id: inv._id, status: 'expired' },
        { $set: { ...counters, purgeAt: new Date(now.getTime() + 7 * 864e5), nextCheckAt: new Date('2999-01-01') } }, { new: true });
      wait = -1;
    } else {
      wait = 10 * 60_000;
    }
  } else if (inv.status === 'review') {
    next = await Invoice.findOneAndUpdate({ _id: inv._id, status: 'review' }, { $set: counters }, { new: true });
    wait = 60 * 60_000;
  }

  next = next || (await Invoice.findById(inv._id));
  if (wait >= 0) {
    await Invoice.updateOne({ _id: inv._id }, { $set: { nextCheckAt: new Date(Date.now() + wait + Math.floor(Math.random() * 3000)) } });
  }
  emit(next);
  return next;
}

// ── Fulfillment (exactly once) ───────────────────────────────────────────────
const handlers = {};
const registerFulfillment = (purpose, fn) => { handlers[purpose] = fn; };

async function fulfill(inv) {
  const stale = new Date(Date.now() - 5 * 60_000);
  const claimed = await Invoice.findOneAndUpdate(
    { _id: inv._id, status: 'confirmed', $or: [{ fulfillState: 'none' }, { fulfillState: 'running', fulfillAt: { $lt: stale } }] },
    { $set: { fulfillState: 'running', fulfillAt: new Date() }, $inc: { fulfillTries: 1 } },
    { new: true },
  );
  if (!claimed) return false;   // someone else has it, or it's done

  try {
    const fn = handlers[claimed.purpose];
    if (!fn) throw new Error(`no fulfillment handler for ${claimed.purpose}`);
    await fn(claimed, readPii(claimed));
    const done = await Invoice.findOneAndUpdate(
      { _id: claimed._id },
      { $set: { fulfillState: 'done', fulfillAt: new Date(), pii: '' }, $push: { events: { $each: [{ at: new Date(), type: 'fulfilled', detail: claimed.purpose }], $slice: -50 } } },
      { new: true },
    );
    emit(done);
    return true;
  } catch (e) {
    console.error('[payments] fulfillment failed', claimed.publicId, e.message);
    await Invoice.updateOne({ _id: claimed._id }, {
      $set: { fulfillState: 'none', nextCheckAt: new Date(Date.now() + Math.min(60_000 * 2 ** claimed.fulfillTries, 3600_000)) },
      $push: { events: { $each: [{ at: new Date(), type: 'fulfill_error', detail: e.message.slice(0, 200) }], $slice: -50 } },
    });
    if (claimed.fulfillTries === 3) {
      await notify.discord({
        content: `Paid invoice failed to fulfil — ${claimed.purpose}`, title: 'PlanIt Payments — action needed', color: 0xef4444,
        fields: [{ name: 'Invoice', value: claimed.publicId }, { name: 'Error', value: e.message }],
      });
    }
    return false;
  }
}

module.exports = {
  PaymentError, setIo, emit, publicView, readPii,
  createInvoice, requote, checkInvoice, fulfill, registerFulfillment, transition,
  requiredConfirmations, minAccepted,
};
