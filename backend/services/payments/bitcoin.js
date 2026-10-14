'use strict';

/**
 * services/payments/bitcoin.js
 *
 * Watch-only address derivation. The server only ever holds an extended PUBLIC
 * key (BTC_XPUB). It can generate receive addresses but can never spend —
 * a full server compromise cannot move funds out of your wallet.
 *
 * BTC_XPUB accepts any of:
 *   - a bare key:            xpub6D... / zpub... / tpub... / vpub...
 *   - an output descriptor:  wpkh([18bb8423/84'/0'/0']xpub6D.../0/*)#checksum
 *     (what Proton Wallet / Sparrow export)
 *
 * BTC_NETWORK = mainnet (default) | testnet | signet
 */

const bitcoin  = require('bitcoinjs-lib');
const ecc      = require('tiny-secp256k1');
const { BIP32Factory } = require('bip32');
const bs58check = require('bs58check');

const bip32 = BIP32Factory(ecc);
bitcoin.initEccLib(ecc);

const NETWORKS = {
  mainnet: bitcoin.networks.bitcoin,
  testnet: bitcoin.networks.testnet,
  signet:  bitcoin.networks.testnet, // signet shares testnet address encoding (tb1…)
};

// SLIP-132 version bytes → normalise everything to xpub/tpub for bip32
const VERSION = {
  xpub: 0x0488b21e, zpub: 0x04b24746, // mainnet
  tpub: 0x043587cf, vpub: 0x045f1cf6, // testnet/signet
};
const MAINNET_PREFIX = new Set(['xpub', 'zpub']);

const KEY_RE = /\b([xztv]pub)[1-9A-HJ-NP-Za-km-z]{100,120}\b/;

function networkName() {
  const n = String(process.env.BTC_NETWORK || 'mainnet').toLowerCase();
  if (!NETWORKS[n]) throw new Error(`BTC_NETWORK must be one of: ${Object.keys(NETWORKS).join(', ')}`);
  return n;
}

let _ctx = null;
function ctx() {
  if (_ctx) return _ctx;

  const raw = String(process.env.BTC_XPUB || '').trim();
  if (!raw) throw new Error('BTC_XPUB is not configured');

  const m = raw.match(KEY_RE);
  if (!m) throw new Error('BTC_XPUB does not contain a valid extended public key');
  const prefix = m[1];
  const keyStr = m[0];

  const net = networkName();
  const mainnetKey = MAINNET_PREFIX.has(prefix);
  if ((net === 'mainnet') !== mainnetKey) {
    throw new Error(`BTC_XPUB (${prefix}) does not match BTC_NETWORK=${net}`);
  }

  // Normalise zpub/vpub → xpub/tpub so bip32 accepts it
  const data = bs58check.decode(keyStr);
  const target = mainnetKey ? VERSION.xpub : VERSION.tpub;
  data.writeUInt32BE(target, 0);
  const normalised = bs58check.encode(data);

  const node = bip32.fromBase58(normalised, NETWORKS[net]);
  if (!node.isNeutered()) throw new Error('BTC_XPUB must be a PUBLIC key — refusing to start with a private key');

  // Chain: descriptor says /0/* (receive) or /1/* (change). Default: receive.
  let chain = 0;
  const d = raw.match(/\/([01])\/\*/);
  if (d) chain = Number(d[1]);

  // Where is this key in the tree?
  //   descriptor with /0/*      → use the chain the descriptor names
  //   depth 4 (m/84'/0'/0'/0)   → already at receive-chain level, derive indexes directly
  //   anything else             → account-level key (Proton/Sparrow depth 3, Electrum depth 1):
  //                               step to the receive chain (/0) first
  const base = d ? node.derive(chain) : (node.depth === 4 ? node : node.derive(0));

  _ctx = { net, network: NETWORKS[net], base, fingerprint: raw.match(/\[([0-9a-f]{8})/i)?.[1] || null };
  return _ctx;
}

/** Native SegWit (bc1q… / tb1q…) address at `index`. */
function deriveAddress(index) {
  if (!Number.isInteger(index) || index < 0 || index >= 0x80000000) throw new Error('bad address index');
  const { base, network } = ctx();
  const child = base.derive(index);
  const { address } = bitcoin.payments.p2wpkh({ pubkey: Buffer.from(child.publicKey), network });
  return address;
}

/** Validate configuration at boot so a bad env var fails loudly, not at first checkout. */
function assertConfigured() {
  const { net } = ctx();
  deriveAddress(0);
  return net;
}

function isConfigured() {
  try { assertConfigured(); return true; } catch { return false; }
}

// ── Amount helpers (integer math only — never floats for money) ──────────────

/** USD cents → satoshis at `rateUsd` (USD per BTC), rounded UP so we never under-collect. */
function usdCentsToSats(usdCents, rateUsd) {
  const rateCents = BigInt(Math.round(Number(rateUsd) * 100));
  if (rateCents <= 0n) throw new Error('bad rate');
  const num = BigInt(usdCents) * 100_000_000n;
  return Number((num + rateCents - 1n) / rateCents);
}

function satsToBtcString(sats) {
  const s = BigInt(sats);
  const whole = s / 100_000_000n;
  const frac  = (s % 100_000_000n).toString().padStart(8, '0');
  return `${whole}.${frac}`;
}

/** BIP21 payment URI — scanned by every Bitcoin wallet app. */
function bip21(address, sats, label = 'PlanIt') {
  const q = new URLSearchParams({ amount: satsToBtcString(sats), label });
  return `bitcoin:${address}?${q.toString()}`;
}

module.exports = {
  networkName, deriveAddress, assertConfigured, isConfigured,
  usdCentsToSats, satsToBtcString, bip21,
};
