'use strict';
/*
 * PLANIT PROPRIETARY LICENSE
 * Copyright (c) 2026 Aakshat Hariharan. All rights reserved.
 */

/**
 * middleware/abuseipdb.js
 * ───────────────────────
 * AbuseIPDB integration — pre-bans known-malicious IPs before they do
 * anything on the platform, and reports your own bans back to the community.
 *
 * FREE TIER
 * ─────────
 *   Sign up:   https://www.abuseipdb.com/register  (no credit card)
 *   API key:   https://www.abuseipdb.com/account/api
 *   Limits:    1,000 checks/day,  1,000 reports/day
 *
 *   This module stays well under those limits via:
 *     - Redis caching: each IP is checked once, result cached 1 hour
 *     - Daily quota guard: hard-caps API calls at 900/day, leaving 100 buffer
 *     - Private IP skip: never wastes a quota call on 127.0.0.1 or 10.x.x.x
 *
 * HOW THE CHECK WORKS
 * ────────────────────
 * On the very first request from any IP, checkAbuseIPDB(ip) fires.
 * It asks AbuseIPDB: "has this IP been reported in the last 90 days?"
 * AbuseIPDB returns a confidence score from 0–100.
 *
 *   0–74:  No action. IP passes through normally.
 *   75+:   Pre-ban immediately, before the IP even sends a request body.
 *
 * The score reflects reports from thousands of sites globally. A score of
 * 75+ means this IP has been consistently reported for abuse — bots,
 * scanners, SSH brute-forcers, spam senders. Residential ISP IPs used by
 * real people virtually never appear in AbuseIPDB at all, let alone at 75+.
 *
 * WHY REAL USERS ARE NEVER AFFECTED
 * ───────────────────────────────────
 * Residential internet IPs (home broadband, mobile carriers) are almost
 * never in AbuseIPDB at meaningful scores. The database primarily contains
 * datacenter IPs, VPS servers, and known botnet nodes. If a user's ISP has
 * been reported, the cache TTL is 1 hour — you can always manually clear
 * a specific IP's cache entry via: redis.del('abuseipdb:check:<ip>')
 *
 * EXPORTS
 * ────────
 *   checkAbuseIPDB(ip)                         → result object (see JSDoc)
 *   reportToAbuseIPDB(ip, categories, comment) → void (fire-and-forget)
 *   reasonToCategories(reason)                 → number[] (AbuseIPDB category IDs)
 *
 * ENV VARS
 *   ABUSEIPDB_API_KEY      Your API key (if unset, module is a no-op)
 *   ABUSEIPDB_BLOCK_SCORE  Confidence threshold to pre-ban (default: 75)
 *   ABUSEIPDB_CACHE_TTL_S  Seconds to cache each result (default: 3600 = 1hr)
 *   ABUSEIPDB_ENABLED      Set to 'false' to disable (default: enabled)
 */

const https = require('https');
const redis = require('../services/redisClient');

// ─── Configuration ────────────────────────────────────────────────────────────

const ENABLED     = process.env.ABUSEIPDB_ENABLED !== 'false';
const API_KEY     = process.env.ABUSEIPDB_API_KEY || '';
const BLOCK_SCORE = parseInt(process.env.ABUSEIPDB_BLOCK_SCORE || '75', 10);
const CACHE_TTL_S = parseInt(process.env.ABUSEIPDB_CACHE_TTL_S || '3600', 10);

// Free tier daily limits — we stay 10% under to avoid surprises
const DAILY_CHECK_LIMIT  = 900;
const DAILY_REPORT_LIMIT = 900;

// ─── Empty/skip result object ────────────────────────────────────────────────
// Returned whenever we skip the check (no API key, private IP, quota hit, etc.)
// Callers always get a consistent shape.
function _empty() {
  return {
    skip:           true,   // true means "we didn't actually check"
    blocked:        false,  // never pre-ban when skipping
    score:          0,
    cached:         false,
    totalReports:   0,
    lastReportedAt: null,
    countryCode:    null,
    isp:            null,
    usageType:      null,
    domain:         null,
  };
}

// ─── Quota guard ──────────────────────────────────────────────────────────────
// Uses a Redis counter per calendar day. Key resets automatically via TTL.
// Returns true if we are within the daily quota and can make a call.

async function _withinQuota(type) {
  const today = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
  const key   = `abuseipdb:quota:${type}:${today}`;
  const limit = type === 'check' ? DAILY_CHECK_LIMIT : DAILY_REPORT_LIMIT;

  try {
    // incrWithExpiry: increment, and on first call of the day set TTL to 25h
    // (25h instead of 24h so a key created at 23:59 survives past midnight)
    const count = await redis.incrWithExpiry(key, 90000);
    return count <= limit;
  } catch {
    // If Redis is down we can't track quota — allow the call (fail open for quota only)
    return true;
  }
}

// ─── Private IP detection ─────────────────────────────────────────────────────
// We import isPrivate from realIp.js which already handles all the RFC-1918
// and loopback ranges. Duplicated here so this module is self-contained.

function _isPrivateIp(ip) {
  if (!ip || ip === 'unknown') return true;
  if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') return true;
  // RFC-1918
  if (/^10\./.test(ip)) return true;
  if (/^192\.168\./.test(ip)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  // Render internal / Cloudflare
  if (/^100\./.test(ip)) return true;
  return false;
}

// ─── checkAbuseIPDB ───────────────────────────────────────────────────────────

/**
 * Checks an IP against AbuseIPDB.
 *
 * Returns a result object:
 * {
 *   skip:           boolean  — true if check was skipped (no key, private, quota)
 *   blocked:        boolean  — true if IP should be pre-banned (score >= threshold)
 *   score:          number   — 0–100 abuse confidence score
 *   cached:         boolean  — true if result came from Redis cache
 *   totalReports:   number   — how many times this IP has been reported
 *   lastReportedAt: string|null
 *   countryCode:    string|null
 *   isp:            string|null
 *   usageType:      string|null  — 'Data Center/Web Hosting/Transit', 'Residential', etc.
 *   domain:         string|null
 * }
 */
async function checkAbuseIPDB(ip) {
  // ── Pre-flight guards ──────────────────────────────────────────────────────
  if (!ENABLED)                return _empty();
  if (!API_KEY)                return _empty();
  if (_isPrivateIp(ip))        return _empty();

  const cacheKey = `abuseipdb:check:${ip}`;

  // ── Redis cache lookup ─────────────────────────────────────────────────────
  // The vast majority of calls for repeat IPs hit cache and return in < 5ms
  // with zero AbuseIPDB API calls consumed.
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return { ...JSON.parse(cached), cached: true };
    }
  } catch {
    // Redis unavailable — fall through to live API call
  }

  // ── Quota guard ────────────────────────────────────────────────────────────
  if (!(await _withinQuota('check'))) {
    console.warn(`[abuseipdb] Daily check quota reached — skipping check for ${ip}`);
    return _empty();
  }

  // ── Live API call ──────────────────────────────────────────────────────────
  try {
    const data = await _apiGet(
      `/api/v2/check?ipAddress=${encodeURIComponent(ip)}&maxAgeInDays=90&verbose`
    );

    if (!data?.data) {
      return _empty();
    }

    const d = data.data;
    const score         = d.abuseConfidenceScore ?? 0;
    const isWhitelisted = d.isWhitelisted ?? false;
    const blocked       = !isWhitelisted && score >= BLOCK_SCORE;

    const result = {
      skip:           false,
      blocked,
      score,
      cached:         false,
      totalReports:   d.totalReports   ?? 0,
      lastReportedAt: d.lastReportedAt ?? null,
      countryCode:    d.countryCode    ?? null,
      isp:            d.isp            ?? null,
      usageType:      d.usageType      ?? null,
      domain:         d.domain         ?? null,
    };

    // Cache the result so this IP doesn't consume quota again for CACHE_TTL_S
    try {
      await redis.set(cacheKey, JSON.stringify(result), CACHE_TTL_S);
    } catch {
      // Non-critical — we'll just re-check next time
    }

    if (blocked) {
      console.warn(
        `[abuseipdb] Pre-banning ${ip} — score=${score}, ` +
        `reports=${result.totalReports}, isp=${result.isp}, type=${result.usageType}`
      );
    }

    return result;

  } catch (err) {
    // API call failed (timeout, 5xx, network issue) — fail open (don't pre-ban)
    if (!err.message?.includes('quota')) {
      console.error(`[abuseipdb] Check failed for ${ip}: ${err.message}`);
    }
    return _empty();
  }
}

// ─── reportToAbuseIPDB ────────────────────────────────────────────────────────

/**
 * Reports an IP to AbuseIPDB after your system bans it.
 *
 * This is fire-and-forget — never throws, never blocks the ban flow.
 * The community database benefits from your reports.
 *
 * @param {string}   ip          The IP address to report
 * @param {number[]} categories  AbuseIPDB category IDs (see reasonToCategories)
 * @param {string}   comment     Human-readable description (max 1024 chars)
 */
async function reportToAbuseIPDB(ip, categories = [21], comment = '') {
  if (!ENABLED || !API_KEY)  return;
  if (_isPrivateIp(ip))      return;

  // Dedup: don't report the same IP more than once per 15 minutes
  const dedupKey = `abuseipdb:reported:${ip}`;
  try {
    const already = await redis.get(dedupKey);
    if (already) return;
  } catch {
    // Redis unavailable — proceed anyway
  }

  // Quota guard
  if (!(await _withinQuota('report'))) {
    console.warn(`[abuseipdb] Daily report quota reached — not reporting ${ip}`);
    return;
  }

  const body = new URLSearchParams({
    ip,
    categories: categories.join(','),
    comment: (comment || 'Automated threat detection by PlanIT TrafficGuard').slice(0, 1024),
  }).toString();

  try {
    await _apiPost('/api/v2/report', body);

    // Mark as recently reported (15-min cooldown)
    await redis.set(dedupKey, '1', 900).catch(() => {});

    console.log(`[abuseipdb] Reported ${ip} — categories=[${categories.join(',')}]`);
  } catch (err) {
    // Non-critical — don't let report failure affect the ban
    console.error(`[abuseipdb] Report failed for ${ip}: ${err.message}`);
  }
}

// ─── reasonToCategories ───────────────────────────────────────────────────────

/**
 * Maps a trafficGuard ban reason string to AbuseIPDB category codes.
 * Full category list: https://www.abuseipdb.com/categories
 *
 * @param {string} reason  The reason string from security.js ban()
 * @returns {number[]}     Array of AbuseIPDB category IDs
 */
function reasonToCategories(reason) {
  const r    = (reason || '').toLowerCase();
  const cats = new Set([21]); // 21 = Web App Attack — always included

  if (r.includes('brute') || r.includes('login') || r.includes('password') || r.includes('auth')) {
    cats.add(18); // Brute Force
  }
  if (r.includes('scan') || r.includes('fuzz') || r.includes('probe') || r.includes('php')) {
    cats.add(14); // Port Scan
  }
  if (r.includes('honeypot')) {
    cats.add(14); // Port Scan (automated probe)
    cats.add(19); // Web Spam
  }
  if (r.includes('sql') || r.includes('union') || r.includes('inject')) {
    cats.add(17); // SQL Injection
  }
  if (r.includes('rapid') || r.includes('ddos') || r.includes('flood')) {
    cats.add(4);  // DDoS Attack
  }
  if (r.includes('ua') || r.includes('user-agent') || r.includes('bot')) {
    cats.add(21); // Web App Attack (scanner bot)
  }

  return [...cats];
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────
// Using Node's built-in https — no extra dependency needed.

function _apiGet(path) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.abuseipdb.com',
        path,
        method:   'GET',
        headers: {
          'Key':    API_KEY,
          'Accept': 'application/json',
        },
        timeout: 6000,
      },
      (res) => {
        let data = '';
        res.on('data', c => (data += c));
        res.on('end', () => {
          if (res.statusCode === 429) {
            reject(new Error('AbuseIPDB rate limit hit (quota)'));
            return;
          }
          if (res.statusCode === 401) {
            reject(new Error('AbuseIPDB API key invalid'));
            return;
          }
          if (res.statusCode !== 200) {
            reject(new Error(`AbuseIPDB GET ${res.statusCode}`));
            return;
          }
          try   { resolve(JSON.parse(data)); }
          catch { reject(new Error('AbuseIPDB response parse error')); }
        });
      }
    );
    req.on('error',   reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('AbuseIPDB timeout')); });
    req.end();
  });
}

function _apiPost(path, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.abuseipdb.com',
        path,
        method:   'POST',
        headers: {
          'Key':            API_KEY,
          'Accept':         'application/json',
          'Content-Type':   'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: 6000,
      },
      (res) => {
        res.resume(); // drain body
        if (res.statusCode === 429) { reject(new Error('AbuseIPDB rate limit hit')); return; }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`AbuseIPDB POST ${res.statusCode}`));
          return;
        }
        resolve();
      }
    );
    req.on('error',   reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('AbuseIPDB timeout')); });
    req.write(body);
    req.end();
  });
}

module.exports = { checkAbuseIPDB, reportToAbuseIPDB, reasonToCategories };
