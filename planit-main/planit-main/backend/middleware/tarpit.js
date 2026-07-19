'use strict';
/*
 * PLANIT PROPRIETARY LICENSE
 * Copyright (c) 2026 Aakshat Hariharan. All rights reserved.
 */

/**
 * middleware/tarpit.js
 * ────────────────────
 * Silent exponential-delay tarpitting for suspicious IPs.
 *
 * WHAT IT DOES
 * ─────────────
 * After each warn from trafficGuard, future requests from that IP are
 * silently held open for increasing durations before being passed to the
 * next handler. No error is ever returned — the request eventually resolves
 * normally, just very slowly.
 *
 * From the attacker's perspective, the site "is just slow."
 * They don't know they are flagged, so they keep retrying — wasting their
 * own time and compute resources.
 *
 * DELAY LADDER
 * ─────────────
 *   0 violations  →     0 ms  (every normal request, exits instantly)
 *   1–2 violations →    1 s
 *   3–5 violations →    5 s
 *   6–9 violations →   30 s
 *   10+ violations →  120 s  (capped by TARPIT_MAX_DELAY_S)
 *
 * WHY REAL USERS ARE NEVER AFFECTED
 * ───────────────────────────────────
 * Tarpit level only increments when addWarn() fires inside trafficGuard.
 * addWarn() only fires on: scanner UAs (sqlmap, nikto, etc.), path fuzzing
 * (/.env, /wp-admin, etc.), oversized payloads, or rapid identical requests.
 * Normal browsing, clicking links, submitting forms, or using the app
 * normally does not trigger a single warn. A real user's tarpit level is
 * always 0, so they always exit this middleware in ~0ms.
 *
 * EXPORTS
 * ────────
 *   tarpit           — Express middleware. Mount BEFORE trafficGuard in server.js.
 *   tarpitIncrement  — Call from addWarn() and ban() in security.js.
 *   tarpitReset      — Call from unbanIp() in security.js to reset on unban.
 *   getTarpitLevel   — Returns current level (0-4) for an IP.
 *
 * ENV VARS (all optional)
 *   TARPIT_ENABLED      'true'  (set 'false' to disable entirely)
 *   TARPIT_MAX_DELAY_S  120     (maximum delay in seconds, default 120)
 */

const redis              = require('../services/redisClient');
const { realIp: resolveRealIp, isPrivate } = require('./realIp');

// ─── Configuration ────────────────────────────────────────────────────────────

const ENABLED     = process.env.TARPIT_ENABLED !== 'false';
const MAX_DELAY_S = parseInt(process.env.TARPIT_MAX_DELAY_S || '120', 10);

// Redis key TTL — tarpit state persists for 24 hours.
// This means a scanner who got tarpitted yesterday is still tarpitted today
// if they come back (assuming the 24h window hasn't elapsed).
const STATE_TTL_S = 86400; // 24 hours

// Paths that are NEVER tarpitted regardless of tarpit level.
// These must match the exempt paths in security.js / trafficGuard.
const EXEMPT_EXACT = new Set([
  '/health', '/api/health',
  '/ping',   '/api/ping',
  '/status', '/api/status',
  '/uptime/ping', '/api/uptime/ping',
]);

const EXEMPT_PREFIXES = ['/socket.io', '/api/mesh', '/mesh/'];

// ─── Delay ladder ─────────────────────────────────────────────────────────────
// Index = level (0–4). Value = delay in milliseconds.
const DELAY_MS = [
  0,       // level 0 — no delay, fast path for all normal traffic
  1_000,   // level 1 — 1 second
  5_000,   // level 2 — 5 seconds
  30_000,  // level 3 — 30 seconds
  120_000, // level 4 — 2 minutes (capped by MAX_DELAY_S)
];

// Minimum violation count to reach each level.
// A single bad request → level 1. Each cluster of warns pushes higher.
const LEVEL_THRESHOLDS = [0, 1, 3, 6, 10];

// ─── In-memory state ─────────────────────────────────────────────────────────
// Mirrors Redis in memory so we don't need a Redis round-trip on every
// request from a known-clean IP (which is ~99.9% of all traffic).
// The memory cache is always populated on the first Redis read, and updated
// on every tarpitIncrement call. It never leads — Redis is authoritative.
const _cache = new Map(); // ip → { level: number, ts: number }
const CACHE_TTL_MS = 30 * 60 * 1000; // evict cache entries after 30 min

// Clean stale cache entries every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - CACHE_TTL_MS;
  for (const [ip, v] of _cache) {
    if (v.ts < cutoff) _cache.delete(ip);
  }
}, 5 * 60 * 1000).unref?.();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function violationCountToLevel(count) {
  // Walk from highest threshold downward, return first level whose threshold is met
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (count >= LEVEL_THRESHOLDS[i]) return i;
  }
  return 0;
}

function levelToDelayMs(level) {
  const raw = DELAY_MS[Math.min(level, DELAY_MS.length - 1)] ?? 0;
  return Math.min(raw, MAX_DELAY_S * 1000);
}

function shouldSkip(ip, path) {
  if (!ENABLED) return true;
  if (!ip || ip === 'unknown') return true;
  if (isPrivate(ip)) return true;
  if (EXEMPT_EXACT.has(path)) return true;
  if (EXEMPT_PREFIXES.some(p => path.startsWith(p))) return true;
  return false;
}

// ─── Redis helpers ────────────────────────────────────────────────────────────

async function _getCount(ip) {
  try {
    const raw = await redis.get(`tarpit:count:${ip}`);
    return parseInt(raw || '0', 10);
  } catch {
    return 0;
  }
}

async function _setCount(ip, count) {
  try {
    // incrWithExpiry is atomic — only sets TTL on the very first call
    // so subsequent increments don't reset the clock.
    // We don't use it here because we need to set an arbitrary value;
    // instead we set directly and ensure expiry is always refreshed.
    await redis.set(`tarpit:count:${ip}`, String(count), STATE_TTL_S);
  } catch {
    // Non-critical — in-memory cache still maintains state within this instance
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the current tarpit level (0–4) for an IP.
 * Fast path: reads from in-memory cache if available.
 */
async function getTarpitLevel(ip) {
  if (!ENABLED || !ip || ip === 'unknown') return 0;

  // Check in-memory cache first (no Redis latency for known-clean IPs)
  const cached = _cache.get(ip);
  if (cached && (Date.now() - cached.ts) < CACHE_TTL_MS) {
    return cached.level;
  }

  // Cache miss — read from Redis
  const count = await _getCount(ip);
  const level = violationCountToLevel(count);

  // Populate cache
  _cache.set(ip, { level, ts: Date.now() });

  return level;
}

/**
 * Increments the violation count for an IP and returns the new tarpit level.
 *
 * Call this from security.js inside addWarn() and ban():
 *   const { tarpitIncrement } = require('./tarpit');
 *   await tarpitIncrement(ip); // inside addWarn()
 */
async function tarpitIncrement(ip) {
  if (!ENABLED || !ip || ip === 'unknown' || isPrivate(ip)) return 0;

  let newCount;
  try {
    // incrWithExpiry: atomic increment, sets TTL only on first call
    newCount = await redis.incrWithExpiry(`tarpit:count:${ip}`, STATE_TTL_S);
  } catch {
    // Redis unavailable — use in-memory count
    const existing = _cache.get(ip);
    newCount = (existing?.count || 0) + 1;
  }

  const level = violationCountToLevel(newCount);

  // Always update in-memory cache so next request doesn't need a Redis round-trip
  _cache.set(ip, { level, ts: Date.now() });

  return level;
}

/**
 * Resets tarpit state for an IP.
 * Call this from security.js inside unbanIp():
 *   const { tarpitReset } = require('./tarpit');
 *   await tarpitReset(ip); // inside unbanIp()
 */
async function tarpitReset(ip) {
  if (!ip) return;
  try {
    await redis.del(`tarpit:count:${ip}`);
  } catch {
    // Non-critical
  }
  _cache.delete(ip);
}

// ─── Express Middleware ───────────────────────────────────────────────────────

/**
 * tarpit(req, res, next)
 *
 * Mount this BEFORE trafficGuard in server.js:
 *   app.use(tarpit);
 *   app.use(trafficGuard);
 *
 * For level-0 IPs (all normal traffic), this middleware is essentially free:
 * one Map lookup, no Redis call, no setTimeout, immediate next().
 */
async function tarpit(req, res, next) {
  const path = req.path;
  const ip   = resolveRealIp(req);

  // Fast exit for all traffic that should never be tarpitted
  if (shouldSkip(ip, path)) return next();

  // Fast in-memory check first — avoids Redis latency for clean IPs
  const cached = _cache.get(ip);
  const level  = cached && (Date.now() - cached.ts) < CACHE_TTL_MS
    ? cached.level
    : await getTarpitLevel(ip);

  // Level 0 = normal user, exits here with zero overhead
  if (level === 0) return next();

  const delayMs = levelToDelayMs(level);

  // Log when adding a meaningful delay (level 1 = 1s is common enough to not log)
  if (level >= 2) {
    console.warn(
      `[tarpit] IP ${ip} at level ${level} — holding ${delayMs}ms before ${req.method} ${path.slice(0, 60)}`
    );
  }

  // The core: simply wait, then continue.
  // setTimeout releases the Node.js event loop — other requests process normally
  // while this one waits. Thousands of concurrent tarpitted connections are fine.
  // The attacker's request eventually resolves normally — they just wasted 2 minutes.
  await new Promise(resolve => setTimeout(resolve, delayMs));

  // If the client disconnected while waiting, skip processing entirely.
  // This saves your DB and app from work the attacker will never see.
  if (res.destroyed) return;

  next();
}

module.exports = { tarpit, tarpitIncrement, tarpitReset, getTarpitLevel };
