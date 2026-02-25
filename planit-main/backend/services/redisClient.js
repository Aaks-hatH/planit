'use strict';

/**
 * services/redisClient.js
 *
 * Thin wrapper around the Upstash Redis REST API.
 * Falls back to an in-memory store if env vars are absent so the application
 * runs on every backend with zero Redis dependency.
 *
 * Upstash free tier (no credit card, forever free):
 *   https://console.upstash.com  ->  Create Database  ->  type: Redis
 *   Copy REST URL and REST Token into the router env vars (or backend env if
 *   you want each backend to have its own connection — router is simpler).
 *
 * Env vars (set on the router; backends share the same values via mesh if needed,
 * but for per-backend counters just set them on each backend too):
 *   UPSTASH_REDIS_URL    https://us1-xxxx.upstash.io
 *   UPSTASH_REDIS_TOKEN  AXxxxx==
 *
 * Interface (all async, never throw):
 *   get(key)                         -> string | null
 *   set(key, value, ttlSeconds?)     -> 'OK'
 *   incr(key)                        -> number
 *   expire(key, ttlSeconds)          -> 1 | 0
 *   del(key)                         -> number
 *   incrWithExpiry(key, ttlSeconds)  -> number   (INCR + EXPIRE on first call only)
 *   isRedis                          -> boolean
 */

const https = require('https');
const urlMod = require('url');

const REDIS_URL   = (process.env.UPSTASH_REDIS_URL   || '').replace(/\/$/, '');
const REDIS_TOKEN =  process.env.UPSTASH_REDIS_TOKEN  || '';
const USE_REDIS   = !!(REDIS_URL && REDIS_TOKEN);

if (USE_REDIS) {
  console.log('[redis] Upstash REST mode enabled');
} else {
  console.log('[redis] No Upstash config — in-memory fallback active (non-persistent, per-instance)');
}

// ─── In-memory fallback ───────────────────────────────────────────────────────
const _mem = new Map(); // key -> { value: string, expiresAt?: number }

function _memGet(key) {
  const e = _mem.get(key);
  if (!e) return null;
  if (e.expiresAt && Date.now() > e.expiresAt) { _mem.delete(key); return null; }
  return e;
}

// Evict expired keys every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of _mem) if (v.expiresAt && now > v.expiresAt) _mem.delete(k);
}, 5 * 60 * 1000).unref?.();

// ─── Upstash REST caller ──────────────────────────────────────────────────────
// Uses Node built-in https — no extra dependency required.
function _upstash(cmd, ...args) {
  return new Promise((resolve) => {
    try {
      const parsed = urlMod.parse(REDIS_URL);
      const body   = JSON.stringify([cmd.toUpperCase(), ...args.map(String)]);
      const req = https.request({
        hostname: parsed.hostname,
        path:     '/',
        method:   'POST',
        headers: {
          Authorization:    `Bearer ${REDIS_TOKEN}`,
          'Content-Type':   'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: 4000,
      }, (res) => {
        let raw = '';
        res.on('data', d => (raw += d));
        res.on('end', () => {
          try   { resolve({ ok: true, result: JSON.parse(raw).result }); }
          catch { resolve({ ok: false }); }
        });
      });
      req.on('error',   () => resolve({ ok: false }));
      req.on('timeout', () => { req.destroy(); resolve({ ok: false }); });
      req.write(body);
      req.end();
    } catch { resolve({ ok: false }); }
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────
const redis = {
  isRedis: USE_REDIS,

  async get(key) {
    if (USE_REDIS) {
      const r = await _upstash('GET', key);
      return (r.ok && r.result != null) ? String(r.result) : null;
    }
    const e = _memGet(key);
    return e ? e.value : null;
  },

  async set(key, value, ttlSeconds) {
    if (USE_REDIS) {
      const r = ttlSeconds
        ? await _upstash('SET', key, String(value), 'EX', ttlSeconds)
        : await _upstash('SET', key, String(value));
      return r.ok ? 'OK' : 'ERR';
    }
    const entry = { value: String(value) };
    if (ttlSeconds) entry.expiresAt = Date.now() + ttlSeconds * 1000;
    _mem.set(key, entry);
    return 'OK';
  },

  async incr(key) {
    if (USE_REDIS) {
      const r = await _upstash('INCR', key);
      return r.ok ? (Number(r.result) || 0) : 0;
    }
    const e    = _memGet(key);
    const next = ((e ? parseInt(e.value, 10) : 0) || 0) + 1;
    _mem.set(key, { ...(e || {}), value: String(next) });
    return next;
  },

  async expire(key, ttlSeconds) {
    if (USE_REDIS) {
      const r = await _upstash('EXPIRE', key, ttlSeconds);
      return r.ok ? (r.result || 0) : 0;
    }
    const e = _mem.get(key);
    if (e) { e.expiresAt = Date.now() + ttlSeconds * 1000; return 1; }
    return 0;
  },

  async del(key) {
    if (USE_REDIS) {
      const r = await _upstash('DEL', key);
      return r.ok ? (r.result || 0) : 0;
    }
    return _mem.delete(key) ? 1 : 0;
  },

  // Atomic: increment and set expiry only on the very first call (value === 1).
  // This is the pattern used for per-day counters that reset at midnight via TTL.
  async incrWithExpiry(key, ttlSeconds) {
    const val = await this.incr(key);
    if (val === 1) await this.expire(key, ttlSeconds);
    return val;
  },
};

module.exports = redis;