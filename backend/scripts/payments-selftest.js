#!/usr/bin/env node
'use strict';

/**
 * scripts/payments-selftest.js — PlanIt Payments self-test.
 *
 * Needs NO database, NO wallet, NO network and NO env vars. Run:
 *     cd backend && node scripts/payments-selftest.js
 *
 * It proves, with throw-away keys and an in-memory fake database/blockchain:
 *   1. address derivation matches an independent derivation (Proton/Sparrow, bare, and Electrum-style keys)
 *   2. the wrong-network guard and "refuse private keys" guard work
 *   3. money math is exact and rounds up
 *   4. buyer-data encryption round-trips and rejects tampering / transplanting
 *   5. the payment state machine: pending → detected → confirmed, exactly-once fulfilment,
 *      partial/late → review, dropped transaction → back to pending, address recycling
 */

const crypto = require('crypto');
const Module = require('module');
const path = require('path');
const ecc = require('tiny-secp256k1');
const bitcoin = require('bitcoinjs-lib');
const { BIP32Factory } = require('bip32');
const bip32 = BIP32Factory(ecc);

let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) { pass++; console.log(`  ✓ ${name}`); } else { fail++; console.log(`  ✗ ${name}`); } };
const section = (t) => console.log(`\n${t}`);
const fresh = (rel) => { const p = path.join(__dirname, '..', rel); delete require.cache[require.resolve(p)]; return require(p); };

process.env.NODE_ENV = 'test';
process.env.PAYMENTS_ENC_KEY = crypto.randomBytes(32).toString('hex');
process.env.BTC_NETWORK = 'testnet';

// ── throw-away wallet (test keys only) ──────────────────────────────────────
const NET = bitcoin.networks.testnet;
const root = bip32.fromSeed(crypto.randomBytes(32), NET);
const expectAddr = (node, i) => bitcoin.payments.p2wpkh({ pubkey: Buffer.from(node.derive(i).publicKey), network: NET }).address;

const bip84Chain = root.derivePath("m/84'/1'/0'/0");
const bip84Acct  = root.derivePath("m/84'/1'/0'");
const electrum   = root.derivePath("m/0'");           // Electrum native-segwit master key
const tpubAcct   = bip84Acct.neutered().toBase58();
const tpubChain  = bip84Chain.neutered().toBase58();
const tpubElec   = electrum.neutered().toBase58();

// ── 1. derivation ───────────────────────────────────────────────────────────
section('1. Address derivation');
{
  process.env.BTC_XPUB = `wpkh([deadbeef/84'/1'/0']${tpubAcct}/0/*)#abcdefgh`;
  let b = fresh('services/payments/bitcoin');
  ok(b.assertConfigured() === 'testnet', 'accepts a full descriptor (Proton / Sparrow style)');
  ok([0, 1, 7].every(i => b.deriveAddress(i) === expectAddr(bip84Chain, i)), 'descriptor addresses match independent derivation');

  process.env.BTC_XPUB = tpubAcct;
  b = fresh('services/payments/bitcoin');
  ok(b.deriveAddress(3) === expectAddr(bip84Chain, 3), 'bare account-level key uses the receive chain (/0)');

  process.env.BTC_XPUB = tpubChain;
  b = fresh('services/payments/bitcoin');
  ok(b.deriveAddress(3) === expectAddr(bip84Chain, 3), 'key already at chain level is used directly');

  process.env.BTC_XPUB = tpubElec;
  b = fresh('services/payments/bitcoin');
  ok(b.deriveAddress(2) === expectAddr(electrum.derive(0), 2), 'Electrum-style key (m/0\') derives m/0\'/0/i');

  ok(/^tb1q/.test(b.deriveAddress(0)), 'test networks give tb1q… addresses');

  process.env.BTC_XPUB = root.toBase58();
  b = fresh('services/payments/bitcoin');
  ok(!b.isConfigured(), 'refuses a PRIVATE key (xprv/tprv)');

  const main = bip32.fromSeed(crypto.randomBytes(32));
  process.env.BTC_XPUB = main.neutered().toBase58();
  b = fresh('services/payments/bitcoin');
  ok(!b.isConfigured(), 'refuses a mainnet key while BTC_NETWORK=testnet');

  process.env.BTC_XPUB = tpubAcct;
  fresh('services/payments/bitcoin');
}

// ── 2. money math ───────────────────────────────────────────────────────────
section('2. Money math');
{
  const b = fresh('services/payments/bitcoin');
  ok(b.usdCentsToSats(29900, 60000) === 498334, '$299 @ $60,000 = 498,334 sats (rounded up)');
  ok(b.usdCentsToSats(300, 100000) === 3000, '$3 @ $100,000 = 3,000 sats');
  ok(b.satsToBtcString(1) === '0.00000001' && b.satsToBtcString(123456789) === '1.23456789', 'sats → BTC string is exact');
  ok(b.bip21('tb1qabc', 5000).startsWith('bitcoin:tb1qabc?amount=0.00005000'), 'BIP21 payment URI');
}

// ── 3. encryption ───────────────────────────────────────────────────────────
section('3. Buyer-data encryption');
{
  const c = fresh('services/payments/fieldCrypto');
  const e = c.encrypt('buyer@example.com', 'inv-1');
  ok(e.startsWith('v1.') && !e.includes('buyer'), 'ciphertext does not contain the plaintext');
  ok(c.decrypt(e, 'inv-1') === 'buyer@example.com', 'round-trips');
  ok(c.decrypt(e, 'inv-2') === '', 'fails when moved to a different invoice');
  const parts = e.split('.'); parts[3] = Buffer.from('tampered').toString('base64url');
  ok(c.decrypt(parts.join('.'), 'inv-1') === '', 'detects tampering');
  ok(c.encrypt('x', 'a') !== c.encrypt('x', 'a'), 'fresh IV every time');
}

// ── 4. state machine (fake DB + fake chain) ─────────────────────────────────
section('4. Payment state machine');
const docs = []; let nextId = 0;
const matchVal = (val, v) => {
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    if ('$in' in v) return v.$in.includes(val);
    if ('$ne' in v) return val !== v.$ne;
    if ('$lt' in v) return val != null && new Date(val) < v.$lt;
    if ('$lte' in v) return new Date(val) <= v.$lte;
    if ('$gt' in v) return new Date(val) > v.$gt;
  }
  return val === v || (v === null && val == null);
};
const match = (d, q) => Object.entries(q).every(([k, v]) => k === '$or' ? v.some(x => match(d, x)) : k === '$and' ? v.every(x => match(d, x)) : matchVal(d[k], v));
const apply = (d, u) => {
  Object.assign(d, u.$set || {});
  for (const k in (u.$inc || {})) d[k] = (d[k] || 0) + u.$inc[k];
  if (u.$push?.events) d.events.push(...u.$push.events.$each);
};
const Inv = {
  create: async (d) => { const o = { ...d, _id: ++nextId, createdAt: new Date(), fulfillState: 'none', status: 'pending', seenSats: 0, events: d.events || [] }; docs.push(o); return o; },
  countDocuments: async () => 0,
  findOne: async (q) => docs.find(d => match(d, q)) || null,
  findById: async (id) => docs.find(d => d._id === id),
  findOneAndUpdate: async (q, u) => { const d = docs.find(x => match(x, q)); if (!d) return null; apply(d, u); return d; },
  updateOne: async (q, u) => { const d = docs.find(x => match(x, q)); if (d) apply(d, u); return {}; },
};
const slots = [];
const Slot = {
  create: async (d) => { const s = { ...d, _id: slots.length + 1 }; slots.push(s); return s; },
  findOneAndUpdate: async (q) => {
    const s = slots.find(x => x.network === q.network && x.status === 'free'); if (!s) return null;
    s.status = 'assigned'; return s;
  },
  updateOne: async (q, u) => { const s = slots.find(x => x.address === q.address || x._id === q._id); if (s) { Object.assign(s, u.$set || {}); } return {}; },
};
Slot.Counter = { findOneAndUpdate: async () => ({ seq: slots.length + 1 }) };

const origLoad = Module._load;
Module._load = function (req, parent, ...rest) {
  if (/models[\\/]Invoice$/.test(req)) return Inv;
  if (/models[\\/]AddressSlot$/.test(req)) return Slot;
  return origLoad.call(this, req, parent, ...rest);
};

(async () => {
  const chain = fresh('services/payments/chainApi');
  let receipts = { txs: [] }; const tip = 900000; let isFresh = true;
  chain.addressIsFresh = async () => isFresh;
  chain.btcUsd = async () => 60000;
  chain.tipHeight = async () => tip;
  chain.addressReceipts = async () => receipts;

  const P = fresh('services/payments');
  let fulfilled = 0;
  P.registerFulfillment('support', async () => { fulfilled++; });
  const tx = (id, sats, confirmed) => ({ txid: id.repeat(64).slice(0, 64), sats, confirmed, height: confirmed ? tip : null });

  // a) happy path
  let inv = await P.createInvoice({ purpose: 'support', usdCents: 5000, pii: { email: 'a@b.com' }, ip: '1.2.3.4' });
  ok(/^tb1q/.test(inv.address) && inv.btcSats === 83334 && inv.requiredConf === 1, 'invoice created: unique address, $50 = 83,334 sats, needs 1 confirmation');
  ok(!inv.pii.includes('a@b.com'), 'buyer email stored encrypted');
  let cur = await P.checkInvoice(inv);
  ok(cur.status === 'pending', 'no payment → stays pending');
  receipts = { txs: [tx('a', inv.btcSats, false)] };
  cur = await P.checkInvoice(cur);
  ok(cur.status === 'detected', 'payment in mempool → detected');
  receipts = { txs: [tx('a', inv.btcSats, true)] };
  cur = await P.checkInvoice(cur);
  ok(cur.status === 'confirmed', '1 confirmation → confirmed');
  const first = await P.fulfill(cur); const second = await P.fulfill(cur);
  ok(first === true && second === false && fulfilled === 1, 'fulfilment runs exactly once');

  // b) underpay is NOT accepted; slightly short (within 1%) IS
  receipts = { txs: [] };
  const i2 = await P.createInvoice({ purpose: 'support', usdCents: 5000, pii: { email: 'a@b.com' } });
  receipts = { txs: [tx('b', Math.floor(i2.btcSats * 0.995), true)] };
  cur = await P.checkInvoice(i2);
  ok(cur.status === 'confirmed', 'within 1% tolerance is accepted');
  receipts = { txs: [] };
  const i3 = await P.createInvoice({ purpose: 'support', usdCents: 5000, pii: { email: 'a@b.com' } });
  receipts = { txs: [tx('c', Math.floor(i3.btcSats / 2), true)] };
  cur = await P.checkInvoice(i3);
  ok(cur.status === 'pending' && cur.seenSats === Math.floor(i3.btcSats / 2), 'half payment is NOT accepted (stays pending, partial shown)');
  i3.expiresAt = new Date(Date.now() - 1000);
  cur = await P.checkInvoice(i3);
  ok(cur.status === 'review', 'partial payment + expiry → manual review');

  // c) unpaid expiry; late payment
  receipts = { txs: [] };
  const i4 = await P.createInvoice({ purpose: 'support', usdCents: 5000, pii: { email: 'a@b.com' } });
  i4.expiresAt = new Date(Date.now() - 1000);
  cur = await P.checkInvoice(i4);
  ok(cur.status === 'expired', 'unpaid past expiry → expired');
  receipts = { txs: [tx('d', i4.btcSats, true)] };
  cur = await P.checkInvoice(cur);
  ok(cur.status === 'review', 'payment arriving after expiry → manual review (never auto-accepted)');

  // d) dropped / replaced transaction
  receipts = { txs: [] };
  const i5 = await P.createInvoice({ purpose: 'support', usdCents: 5000, pii: { email: 'a@b.com' } });
  receipts = { txs: [tx('e', i5.btcSats, false)] };
  cur = await P.checkInvoice(i5);
  receipts = { txs: [] };
  cur = await P.checkInvoice(cur);
  ok(cur.status === 'pending', 'mempool transaction that disappears → back to pending');

  // e) bounds
  let err = null; try { await P.createInvoice({ purpose: 'support', usdCents: 50, pii: {} }); } catch (e) { err = e; }
  ok(err && err.code === 'bad_amount', 'rejects amounts under $1');
  err = null; try { await P.createInvoice({ purpose: 'support', usdCents: 99999999, pii: {} }); } catch (e) { err = e; }
  ok(err && err.code === 'bad_amount', 'rejects amounts over the cap');

  // f) address that already has history is skipped
  receipts = { txs: [] }; isFresh = false;
  err = null; try { await P.createInvoice({ purpose: 'support', usdCents: 5000, pii: {} }); } catch (e) { err = e; }
  ok(err && err.code === 'no_address', 'refuses to hand out addresses that were already used');
  isFresh = true;

  Module._load = origLoad;
  console.log(`\n${fail === 0 ? 'ALL PASSED' : 'FAILURES'} — ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((e) => { console.error('\nSelf-test crashed:', e); process.exit(1); });
