'use strict';

/**
 * services/payments/chainApi.js
 *
 * Read-only blockchain + price lookups over HTTPS (Esplora-compatible APIs).
 * Primary: mempool.space.  Fallback: blockstream.info.  Override with
 * BTC_API_BASE to point at your own self-hosted mempool/electrs node.
 *
 * Nothing here can move money — it only reads public data. Every response is
 * shape-checked before use, so a malformed or hostile response is rejected
 * rather than trusted.
 */

const axios = require('axios');
const { networkName } = require('./bitcoin');

const BASES = {
  mainnet: ['https://mempool.space/api', 'https://blockstream.info/api'],
  testnet: ['https://mempool.space/testnet/api', 'https://blockstream.info/testnet/api'],
  signet:  ['https://mempool.space/signet/api',  'https://blockstream.info/signet/api'],
};

function bases() {
  const custom = (process.env.BTC_API_BASE || '').trim().replace(/\/$/, '');
  if (custom) {
    if (!/^https:\/\//i.test(custom)) throw new Error('BTC_API_BASE must be https://');
    return [custom];
  }
  return BASES[networkName()];
}

const http = axios.create({
  timeout: 8000,
  maxContentLength: 2 * 1024 * 1024,
  maxRedirects: 0,
  headers: { 'User-Agent': 'PlanIt-Payments/1.0', Accept: 'application/json' },
  validateStatus: (s) => s >= 200 && s < 300,
});

async function getJson(path) {
  let lastErr;
  for (const base of bases()) {
    try {
      const r = await http.get(base + path);
      return r.data;
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`chain API unavailable: ${lastErr?.message || 'unknown'}`);
}

async function getText(path) {
  let lastErr;
  for (const base of bases()) {
    try {
      const r = await http.get(base + path, { responseType: 'text', transformResponse: (d) => d });
      return String(r.data).trim();
    } catch (e) { lastErr = e; }
  }
  throw new Error(`chain API unavailable: ${lastErr?.message || 'unknown'}`);
}

async function tipHeight() {
  const n = Number(await getText('/blocks/tip/height'));
  if (!Number.isInteger(n) || n < 1) throw new Error('bad tip height');
  return n;
}

/**
 * Everything the address has received, summarised.
 * Returns { totalTxCount, txs: [{ txid, sats, confirmed, height }] }
 * `sats` = value of outputs in that tx paying THIS address.
 */
async function addressReceipts(address) {
  if (!/^(bc1|tb1)[a-z0-9]{20,90}$/i.test(address)) throw new Error('bad address');

  const [info, txs] = await Promise.all([
    getJson(`/address/${address}`),
    getJson(`/address/${address}/txs`),
  ]);
  if (!info?.chain_stats || !info?.mempool_stats || !Array.isArray(txs)) throw new Error('bad address response');

  const out = [];
  for (const tx of txs) {
    if (!tx || typeof tx.txid !== 'string' || !/^[0-9a-f]{64}$/.test(tx.txid) || !Array.isArray(tx.vout)) continue;
    let sats = 0;
    for (const v of tx.vout) {
      if (v && v.scriptpubkey_address === address && Number.isSafeInteger(v.value) && v.value > 0) sats += v.value;
    }
    if (sats > 0) {
      out.push({
        txid: tx.txid,
        sats,
        confirmed: !!tx.status?.confirmed,
        height: tx.status?.confirmed ? Number(tx.status.block_height) : null,
      });
    }
  }
  const totalTxCount = (info.chain_stats.tx_count || 0) + (info.mempool_stats.tx_count || 0);
  return { totalTxCount, txs: out };
}

/** True when this address has never appeared on-chain or in the mempool. */
async function addressIsFresh(address) {
  const info = await getJson(`/address/${address}`);
  if (!info?.chain_stats || !info?.mempool_stats) throw new Error('bad address response');
  return (info.chain_stats.tx_count || 0) + (info.mempool_stats.tx_count || 0) === 0;
}

// ── Price ────────────────────────────────────────────────────────────────────

let _price = { usd: 0, at: 0 };

function sane(p) { return Number.isFinite(p) && p > 1000 && p < 10_000_000; }

/**
 * BTC/USD. Cached 60 s in-process. Tries mempool.space, then Coinbase, then Kraken.
 * Testnet/signet coins have no market value — a fixed demo rate is used there.
 */
async function btcUsd() {
  if (networkName() !== 'mainnet') return Number(process.env.BTC_TEST_RATE_USD || 60000);

  if (Date.now() - _price.at < 60_000 && sane(_price.usd)) return _price.usd;

  const sources = [
    async () => (await http.get('https://mempool.space/api/v1/prices')).data?.USD,
    async () => Number((await http.get('https://api.coinbase.com/v2/prices/BTC-USD/spot')).data?.data?.amount),
    async () => Number(Object.values((await http.get('https://api.kraken.com/0/public/Ticker?pair=XBTUSD')).data?.result || {})[0]?.c?.[0]),
  ];

  for (const src of sources) {
    try {
      const p = Number(await src());
      if (sane(p)) { _price = { usd: p, at: Date.now() }; return p; }
    } catch { /* next source */ }
  }
  // Stale-but-recent beats failing checkout; refuse if older than 10 minutes.
  if (sane(_price.usd) && Date.now() - _price.at < 10 * 60_000) return _price.usd;
  throw new Error('price unavailable');
}

module.exports = { tipHeight, addressReceipts, addressIsFresh, btcUsd };
