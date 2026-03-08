require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const cookieParser = require('cookie-parser');
const { createProxyMiddleware } = require('http-proxy-middleware');
const axios        = require('axios');
const http         = require('http');
const https        = require('https');
const { meshAuth, meshGet, meshPost } = require('./mesh');



const EMAIL_FROM             = process.env.EMAIL_FROM || 'PlanIt <notifications@planit.app>';
const RATE_LIMIT_COOLDOWN_MS = parseInt(process.env.EMAIL_COOLDOWN_MS || String(60 * 60 * 1000), 10);

// ── Shared helpers ────────────────────────────────────────────────────────────

// Build a key pool from numbered env vars  (PREFIX_1, PREFIX_2, …)
// plus an optional legacy single-key var.
function _buildPool(prefix, legacyKey) {
  const pool = [];
  for (let i = 1; i <= 50; i++) {
    const k = process.env[`${prefix}_${i}`];
    if (k && k.trim()) pool.push({ key: k.trim(), suspendedUntil: null, useCount: 0 });
  }
  if (legacyKey && legacyKey.trim() && !pool.some(e => e.key === legacyKey.trim())) {
    pool.push({ key: legacyKey.trim(), suspendedUntil: null, useCount: 0 });
  }
  return pool;
}

const _pools = {
  brevo:   { name: 'Brevo',   freePerMonth: 9000, cursor: 0, keys: _buildPool('BREVO_API_KEY', process.env.BREVO_API_KEY)  },
  mailjet: { name: 'Mailjet', freePerMonth: 6000, cursor: 0, keys: _buildPool('MAILJET_KEY',   process.env.MAILJET_KEY)    },
};

// Startup summary
console.log('[email] Provider pool:');
let _totalMonthlyFree = 0;
Object.values(_pools).forEach(p => {
  if (p.keys.length === 0) return;
  const m = p.keys.length * p.freePerMonth;
  _totalMonthlyFree += m;
  console.log(`  ${p.name.padEnd(10)} ${p.keys.length} key(s)  →  ${m.toLocaleString()} / month free`);
});
if (_totalMonthlyFree > 0) {
  console.log(`  ────────────────────────────────────────`);
  console.log(`  TOTAL      ${_totalMonthlyFree.toLocaleString()} / month free`);
} else {
  console.warn('[email] WARNING: No API keys found — emails disabled.');
  console.warn('[email] Set BREVO_API_KEY_1 and/or MAILJET_KEY_1 in Render env vars.');
}

// Pick the next active (non-suspended) key from a pool using round-robin.
// Returns null if all keys are currently suspended.
function _pickKey(pool) {
  const now = Date.now();
  pool.keys.forEach(e => { if (e.suspendedUntil && e.suspendedUntil <= now) e.suspendedUntil = null; });
  const active = pool.keys.filter(e => !e.suspendedUntil);
  if (active.length === 0) return null;
  pool.cursor = pool.cursor % active.length;
  const chosen = active[pool.cursor];
  pool.cursor  = (pool.cursor + 1) % active.length;
  chosen.useCount++;
  return chosen;
}

// ── Brevo ─────────────────────────────────────────────────────────────────────
function _sendViaBrevo(keyEntry, to, subject, html) {
  return new Promise((resolve) => {
    try {
      const senderEmail = EMAIL_FROM.replace(/.*<(.+)>.*/, '$1').trim() || 'notifications@planit.app';
      const body = JSON.stringify({
        sender:      { name: 'PlanIt', email: senderEmail },
        to:          [{ email: to }],
        subject,
        htmlContent: html,
      });
      const req = https.request({
        hostname: 'api.brevo.com',
        path:     '/v3/smtp/email',
        method:   'POST',
        headers:  {
          'api-key':       keyEntry.key,
          'Content-Type':  'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: 12000,
      }, (res) => {
        let raw = '';
        res.on('data', d => (raw += d));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) return resolve({ ok: true });
          if (res.statusCode === 429) {
            keyEntry.suspendedUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
            console.warn(`[email] Brevo key …${keyEntry.key.slice(-6)} hit 429, suspended 1h`);
            return resolve({ ok: false, rateLimited: true });
          }
          console.error(`[email] Brevo HTTP ${res.statusCode}: ${raw.slice(0, 200)}`);
          resolve({ ok: false, rateLimited: false, reason: `Brevo HTTP ${res.statusCode}` });
        });
      });
      req.on('error',   e => resolve({ ok: false, rateLimited: false, reason: e.message }));
      req.on('timeout', () => { req.destroy(); resolve({ ok: false, rateLimited: false, reason: 'timeout' }); });
      req.write(body);
      req.end();
    } catch (e) { resolve({ ok: false, rateLimited: false, reason: e.message }); }
  });
}

// ── Mailjet ───────────────────────────────────────────────────────────────────
function _sendViaMailjet(keyEntry, to, subject, html) {
  return new Promise((resolve) => {
    try {
      const [pub, sec] = keyEntry.key.split(':');
      if (!pub || !sec) {
        console.error('[email] Mailjet key format wrong — expected PUBLIC:SECRET');
        return resolve({ ok: false, rateLimited: false, reason: 'bad_mailjet_key_format' });
      }
      const fromEmail = EMAIL_FROM.replace(/.*<(.+)>.*/, '$1').trim() || 'notifications@planit.app';
      const fromName  = EMAIL_FROM.replace(/<.*>/, '').trim()         || 'PlanIt';
      const body = JSON.stringify({
        Messages: [{
          From: { Email: fromEmail, Name: fromName },
          To:   [{ Email: to }],
          Subject: subject,
          HTMLPart: html,
        }],
      });
      const auth = Buffer.from(`${pub}:${sec}`).toString('base64');
      const req  = https.request({
        hostname: 'api.mailjet.com',
        path:     '/v3.1/send',
        method:   'POST',
        headers:  {
          Authorization:    `Basic ${auth}`,
          'Content-Type':   'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
        timeout: 12000,
      }, (res) => {
        let raw = '';
        res.on('data', d => (raw += d));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) return resolve({ ok: true });
          if (res.statusCode === 429) {
            keyEntry.suspendedUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
            console.warn(`[email] Mailjet key …${keyEntry.key.slice(-6)} hit 429, suspended 1h`);
            return resolve({ ok: false, rateLimited: true });
          }
          console.error(`[email] Mailjet HTTP ${res.statusCode}: ${raw.slice(0, 200)}`);
          resolve({ ok: false, rateLimited: false, reason: `Mailjet HTTP ${res.statusCode}` });
        });
      });
      req.on('error',   e => resolve({ ok: false, rateLimited: false, reason: e.message }));
      req.on('timeout', () => { req.destroy(); resolve({ ok: false, rateLimited: false, reason: 'timeout' }); });
      req.write(body);
      req.end();
    } catch (e) { resolve({ ok: false, rateLimited: false, reason: e.message }); }
  });
}

// ── Dispatch map ──────────────────────────────────────────────────────────────
const _providerSend = {
  brevo:   (key, to, subj, html) => _sendViaBrevo(key, to, subj, html),
  mailjet: (key, to, subj, html) => _sendViaMailjet(key, to, subj, html),
};

// ── Main send function (name kept for internal API compatibility) ──────────────
// Tries Brevo first, falls back to Mailjet. Within each provider, rotates keys.
async function sendViaResend(to, subject, html) {
  const providerOrder = ['brevo', 'mailjet'];

  for (const providerName of providerOrder) {
    const pool = _pools[providerName];
    if (pool.keys.length === 0) continue;

    const tried = new Set();
    for (let attempt = 0; attempt < pool.keys.length; attempt++) {
      const key = _pickKey(pool);
      if (!key || tried.has(key.key)) break;
      tried.add(key.key);

      const result = await _providerSend[providerName](key, to, subject, html);
      if (result.ok) {
        return { ok: true, provider: providerName };
      }
      if (!result.rateLimited) {
        // Hard error — skip to next provider, won't help to retry here
        console.warn(`[email] ${pool.name} hard error (${result.reason}) — trying next provider`);
        break;
      }
      // 429 — try next key in this provider
      console.log(`[email] ${pool.name} key rate-limited, trying next key (attempt ${attempt + 2}/${pool.keys.length})`);
    }
    // This provider exhausted — fall through to next
  }

  console.error('[email] All providers exhausted — email was NOT sent.');
  return { ok: false, reason: 'all_providers_exhausted' };
}

// ── Pool stats endpoint helper ────────────────────────────────────────────────
function _keyPoolStats() {
  const now = Date.now();
  const result = {};
  let totalMonthlyFree = 0;
  Object.entries(_pools).forEach(([name, pool]) => {
    const keys = pool.keys.map((e, i) => ({
      index:     i + 1,
      keySuffix: '…' + e.key.slice(-6),
      status:    (!e.suspendedUntil || e.suspendedUntil <= now) ? 'active' : 'suspended',
      resumesAt: (e.suspendedUntil && e.suspendedUntil > now)
                   ? new Date(e.suspendedUntil).toISOString() : null,
      useCount:  e.useCount,
    }));
    const monthly = pool.keys.length * pool.freePerMonth;
    totalMonthlyFree += monthly;
    result[name] = {
      provider:    pool.name,
      totalKeys:   pool.keys.length,
      activeKeys:  keys.filter(k => k.status === 'active').length,
      monthlyFree: monthly,
      keys,
    };
  });
  result._summary = { totalMonthlyFree };
  return result;
}

// ─── Log ring-buffer ──────────────────────────────────────────────────────────
// Captures every console.log/warn/error into an in-memory buffer (last 2000
// entries) so the admin panel can fetch router logs via /mesh/logs.
const ROUTER_LOG_BUFFER = [];
const ROUTER_LOG_MAX    = 2000;

function pushRouterLog(level, args) {
  const entry = {
    ts:     new Date().toISOString(),
    level,
    msg:    args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '),
    source: 'router',
  };
  ROUTER_LOG_BUFFER.push(entry);
  if (ROUTER_LOG_BUFFER.length > ROUTER_LOG_MAX) ROUTER_LOG_BUFFER.shift();
}

const _rLog   = console.log.bind(console);
const _rWarn  = console.warn.bind(console);
const _rError = console.error.bind(console);
console.log   = (...a) => { pushRouterLog('info',  a); _rLog(...a);   };
console.warn  = (...a) => { pushRouterLog('warn',  a); _rWarn(...a);  };
console.error = (...a) => { pushRouterLog('error', a); _rError(...a); };

// ─── Config ───────────────────────────────────────────────────────────────────
const BACKENDS = (process.env.BACKEND_URLS || '')
  .split(',').map(u => u.trim()).filter(Boolean);

if (BACKENDS.length === 0) {
  console.error('\n  FATAL: BACKEND_URLS env var is not set.\n');
  process.exit(1);
}

const FALLBACK_NAMES = ['Alpha','Bravo','Charlie','Delta','Echo','Foxtrot','Golf','Hotel'];
const customLabels   = (process.env.BACKEND_LABELS || '').split(',').map(s => s.trim()).filter(Boolean);
function backendName(i) {
  return customLabels[i] || FALLBACK_NAMES[i] || `Backend-${i + 1}`;
}

const SERVICE_NAME  = process.env.SERVICE_NAME  || 'Router';
const PORT          = process.env.PORT          || 3000;
const WATCHDOG_URL  = (process.env.WATCHDOG_URL || '').replace(/\/$/, '');
const COOKIE_NAME  = 'planit_route';
const COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

// Render free tier spins down after 15 minutes of inactivity.
// Ping every 4 minutes to keep all backends warm.
const KEEPALIVE_MS = 4 * 60 * 1000;

const SCALE_UP_THRESHOLD      = parseInt(process.env.SCALE_UP_THRESHOLD      || '20', 10);
const SCALE_DOWN_THRESHOLD    = parseInt(process.env.SCALE_DOWN_THRESHOLD    || '5',  10);
const SCALE_DOWN_PATIENCE     = parseInt(process.env.SCALE_DOWN_PATIENCE     || '5',  10);
const CIRCUIT_TRIP_ERRORS     = parseInt(process.env.CIRCUIT_TRIP_ERRORS     || '3',  10);
const CIRCUIT_RECOVERY_CHECKS = parseInt(process.env.CIRCUIT_RECOVERY_CHECKS || '2',  10);
const SCALE_CHECK_MS          = 30 * 1000;

console.log(`\n${'═'.repeat(60)}`);
console.log(` PlanIt Router — starting`);
console.log(`${'═'.repeat(60)}`);
BACKENDS.forEach((b, i) => console.log(`   [${i}] ${backendName(i)}`));
console.log(` Scale up at : ${SCALE_UP_THRESHOLD} req/backend/30s`);
console.log(` Keepalive   : every ${KEEPALIVE_MS / 60000} minutes`);
console.log(`${'═'.repeat(60)}\n`);

// ─── Per-backend state ────────────────────────────────────────────────────────
const backendStatus = BACKENDS.map((url, i) => ({
  url,
  name:              backendName(i),
  alive:             true,
  latencyMs:         null,
  lastPing:          null,
  requests:          0,
  activeConnections: 0,
  windowRequests:    0,   // requests in current 30s window — primary scale signal
  active:            false,
  coldStart:         false,
  socketConnections: 0,
  memoryPct:         null,
  circuitTripped:    false,
  consecutiveErrors: 0,
  recoveryProbes:    0,
  // Smart routing: per-backend event affinity map (eventId → this backend)
  // Populated when events are pinned to a specific backend via boost
  pinnedEvents:      new Set(),
}));

const dynamicBackends = [];

// ─── Scaling + boost state ────────────────────────────────────────────────────
let activeBackendCount = 1;
let scaleDownStreak    = 0;

// Boost mode: forces full fleet active for a duration, ignores scale-down.
// boostConfig holds the current active boost or null.
let boostConfig = null;
// { activeUntil: Date, reason: string, minBackends: number, pinnedEventIds: Set }

const scalingLog = [];
function logScale(action, reason) {
  const entry = { time: new Date().toISOString(), action, reason, activeBackendCount };
  scalingLog.unshift(entry);
  if (scalingLog.length > 50) scalingLog.pop();
  console.log(`  [scale] ${action} → ${activeBackendCount} active — ${reason}`);
}

function updateActiveSet() {
  backendStatus.forEach((b, i) => {
    b.active = i < activeBackendCount && !b.circuitTripped;
  });
}

updateActiveSet();

// ─── Boost mode ───────────────────────────────────────────────────────────────
function activateBoost(opts) {
  // opts: { durationMinutes, reason, minBackends, pinnedEventIds }
  const durationMs  = (opts.durationMinutes || 60) * 60 * 1000;
  const minBackends = Math.min(opts.minBackends || BACKENDS.length, BACKENDS.length);

  boostConfig = {
    activeUntil:   new Date(Date.now() + durationMs),
    reason:        opts.reason || 'Manual boost',
    minBackends,
    pinnedEventIds: new Set(opts.pinnedEventIds || []),
    activatedAt:   new Date().toISOString(),
  };

  // Clear any existing boost timeout
  if (boostConfig._timer) clearTimeout(boostConfig._timer);
  boostConfig._timer = setTimeout(() => {
    boostConfig = null;
    logScale('⚡ Boost ended', 'Boost window expired — returning to auto-scaling');
  }, durationMs);

  // Immediately expand fleet to minBackends
  const prev = activeBackendCount;
  if (activeBackendCount < minBackends) {
    activeBackendCount = minBackends;
    updateActiveSet();
  }

  logScale(`⚡ Boost ON`, `${opts.reason} — fleet ${prev}→${activeBackendCount} backends, holds until ${boostConfig.activeUntil.toISOString()}`);
}

function cancelBoost() {
  if (!boostConfig) return false;
  if (boostConfig._timer) clearTimeout(boostConfig._timer);
  boostConfig = null;
  logScale('⚡ Boost cancelled', 'Manual cancellation');
  return true;
}

function isBoostActive() {
  if (!boostConfig) return false;
  if (Date.now() > boostConfig.activeUntil.getTime()) {
    boostConfig = null;
    return false;
  }
  return true;
}

// ─── Routing ──────────────────────────────────────────────────────────────────
const OBJECTID_RE = /[a-f0-9]{24}/i;

// Hash to full fleet size (not active count) so assignments are stable when scaling
function djb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
    h = h >>> 0;
  }
  return h % BACKENDS.length;
}

function pickHealthyBackend(preferredIndex) {
  const clamped = preferredIndex % Math.max(activeBackendCount, 1);
  if (!backendStatus[clamped]?.circuitTripped) return clamped;
  for (let i = 0; i < activeBackendCount; i++) {
    if (!backendStatus[i]?.circuitTripped) return i;
  }
  for (let i = 0; i < BACKENDS.length; i++) {
    if (!backendStatus[i]?.circuitTripped) return i;
  }
  return clamped;
}

function pickBackendIndex(req) {
  const url = req.url || '';

  // Smart routing: if boost has pinned specific event IDs, route them to backend 0
  // (the primary) to concentrate load where extra resources are guaranteed.
  // For all other requests during boost, use normal routing across full active fleet.
  if (isBoostActive() && boostConfig.pinnedEventIds.size > 0) {
    const match = url.match(OBJECTID_RE);
    if (match && boostConfig.pinnedEventIds.has(match[0])) {
      // Pinned event — always goes to backend 0 (guaranteed active during boost)
      return pickHealthyBackend(0);
    }
  }

  // Smart routing: non-message API calls (admin, analytics, static assets)
  // go to backend 0 to avoid polluting event backends with background requests.
  // Message/socket/event calls get normal sticky routing.
  const isBackgroundCall = /^\/(api\/admin|api\/uptime|api\/export|health|mesh)/.test(url);
  if (isBackgroundCall && activeBackendCount > 1) {
    // Route background API calls to the last active backend, keeping backend 0
    // free for real user traffic
    return pickHealthyBackend(activeBackendCount - 1);
  }

  // Normal routing:
  // 1. EventId in URL → deterministic hash (all users of same event hit same backend)
  const eventMatch = url.match(OBJECTID_RE);
  if (eventMatch) return pickHealthyBackend(djb2(eventMatch[0]));

  // 2. Sticky cookie
  const cookie = req.cookies?.[COOKIE_NAME];
  if (cookie !== undefined) {
    const idx = parseInt(cookie, 10);
    if (!isNaN(idx) && idx >= 0 && idx < activeBackendCount) {
      return pickHealthyBackend(idx);
    }
  }

  // 3. IP hash
  const ip = req.headers?.['x-forwarded-for']?.split(',')[0]?.trim()
           || req.socket?.remoteAddress || '0';
  return pickHealthyBackend(djb2(ip));
}

// ─── Circuit breaker ──────────────────────────────────────────────────────────
function recordBackendError(index) {
  const b = backendStatus[index];
  b.consecutiveErrors++;
  b.alive = false;
  if (!b.circuitTripped && b.consecutiveErrors >= CIRCUIT_TRIP_ERRORS) {
    b.circuitTripped = true;
    b.recoveryProbes = 0;
    updateActiveSet();
    logScale(`⚡ Circuit tripped: ${b.name}`, `${b.consecutiveErrors} errors`);
  }
}

function recordBackendSuccess(index) {
  const b = backendStatus[index];
  b.consecutiveErrors = 0;
  b.alive = true;
  if (b.circuitTripped) {
    b.recoveryProbes++;
    if (b.recoveryProbes >= CIRCUIT_RECOVERY_CHECKS) {
      b.circuitTripped = false;
      b.recoveryProbes = 0;
      updateActiveSet();
      logScale(`✓ Circuit restored: ${b.name}`, `${CIRCUIT_RECOVERY_CHECKS} clean probes`);
    }
  }
}

// ─── Holt-Winters predictive scaling ─────────────────────────────────────────
// Extends reactive scaling with a predictive layer using double exponential
// smoothing (Holt's method — handles trend without requiring a seasonal period).
//
// Stores the last 30 observed window loads. Every check interval it fits a
// level + trend model and forecasts the next window. If the forecast exceeds
// the scale-up threshold AND the trend has been positive for at least 3
// consecutive windows (sustained ramp, not a one-off spike), it pre-scales.
//
// Alpha: smoothing factor for level   (0 = lag heavily, 1 = no smoothing)
// Beta:  smoothing factor for trend   (0 = ignore trend, 1 = fully reactive)
const HW_ALPHA      = parseFloat(process.env.HW_ALPHA      || '0.4');
const HW_BETA       = parseFloat(process.env.HW_BETA       || '0.3');
const HW_HISTORY    = 30;   // max window samples to keep
const HW_MIN_RAMP   = 3;    // minimum consecutive positive-trend windows before pre-scaling
const HW_HEADROOM   = parseFloat(process.env.HW_HEADROOM   || '0.85'); // pre-scale at 85% of threshold

const hwHistory   = [];   // { load, level, trend } — ring buffer
let   hwLevel     = 0;
let   hwTrend     = 0;
let   hwRampCount = 0;    // consecutive windows with positive trend

// Returns { forecast, trend, rampCount, willPreScale }
function hwUpdate(currentLoad) {
  if (hwHistory.length === 0) {
    // Bootstrap
    hwLevel = currentLoad;
    hwTrend = 0;
  } else {
    const prevLevel = hwLevel;
    hwLevel = HW_ALPHA * currentLoad + (1 - HW_ALPHA) * (hwLevel + hwTrend);
    hwTrend = HW_BETA  * (hwLevel - prevLevel) + (1 - HW_BETA) * hwTrend;
  }
  if (hwTrend > 0) { hwRampCount++; } else { hwRampCount = 0; }

  const forecast = hwLevel + hwTrend;
  const willPreScale = hwRampCount >= HW_MIN_RAMP
    && forecast >= getEffectiveThresholds().up * HW_HEADROOM
    && forecast < getEffectiveThresholds().up; // threshold not yet breached (reactive handles that)

  hwHistory.push({ load: currentLoad, level: hwLevel, trend: hwTrend });
  if (hwHistory.length > HW_HISTORY) hwHistory.shift();

  return { forecast, trend: hwTrend, rampCount: hwRampCount, willPreScale };
}

// ─── PID Controller ───────────────────────────────────────────────────────────
// Replaces the hard "avgLoad >= threshold → scale up by 1" with a continuous
// control signal. The setpoint is 70% of the scale-up threshold — we want to
// keep load at 70% headroom, not wait until we're already overloaded.
//
// Output is a floating-point "scale pressure" value:
//   > +1.0  → strong scale-up pressure (add a backend)
//   < -1.0  → sustained scale-down pressure (remove a backend)
//   between → no action (system is near steady state)
//
// Anti-windup: integral is clamped to ±15 so a long idle period doesn't
// cause a massive overshoot when traffic suddenly returns.
const PID_KP       = parseFloat(process.env.PID_KP || '0.08');  // proportional gain
const PID_KI       = parseFloat(process.env.PID_KI || '0.015'); // integral gain
const PID_KD       = parseFloat(process.env.PID_KD || '0.04');  // derivative gain
const PID_SETPOINT = parseFloat(process.env.PID_SETPOINT || '0.70'); // target: 70% of threshold

let pidIntegral  = 0;
let pidLastError = 0;
let pidLastLoad  = 0;

function pidControl(avgLoad) {
  const setpoint = (getEffectiveThresholds().up) * PID_SETPOINT;
  const error    = avgLoad - setpoint;
  pidIntegral    = Math.max(-15, Math.min(15, pidIntegral + error)); // anti-windup clamp
  const derivative = error - pidLastError;
  pidLastError   = error;
  pidLastLoad    = avgLoad;
  const output   = PID_KP * error + PID_KI * pidIntegral + PID_KD * derivative;
  return { output, error, integral: pidIntegral, derivative, setpoint };
}

// ─── Anomaly detection (EWMSD) ────────────────────────────────────────────────
// Maintains an exponentially weighted mean and variance of the load signal.
// A spike that is > ANOMALY_Z_SIGMA standard deviations from the mean is
// classified as an anomaly — a one-off burst (DDoS, viral moment, bot wave)
// rather than organic growth.
//
// Anomalies get a DIFFERENT scaling response:
//   • We still scale UP fast (don't wait) — we need capacity now.
//   • We do NOT feed the anomalous sample into the HW model — it would corrupt
//     the trend and cause phantom pre-scaling long after the spike is gone.
//   • We set a short-lived anomaly hold that prevents early scale-down while
//     the anomalous load decays.
//
// EWMSD alpha: how fast the baseline adapts (low = slow, stable baseline)
const ANOMALY_ALPHA    = parseFloat(process.env.ANOMALY_ALPHA   || '0.12');
// Raised from 2.5 -> 4.0: a fresh baseline with few samples was flagging
// normal login bursts as anomalies. 4.0 requires a much more extreme deviation.
const ANOMALY_Z_SIGMA  = parseFloat(process.env.ANOMALY_Z_SIGMA || '4.0');
const ANOMALY_HOLD_MS  = parseInt(process.env.ANOMALY_HOLD_MS   || '180000', 10); // 3min hold
// Minimum windows before anomaly detection activates (baseline warm-up guard)
const ANOMALY_WARMUP_WINDOWS = parseInt(process.env.ANOMALY_WARMUP_WINDOWS || '5', 10);

let ewmMean        = 0;
let ewmVariance    = 0;
let anomalyHoldAt  = 0; // timestamp when last anomaly was detected
let anomalyWindows = 0; // sample count - anomaly disabled during warm-up

function anomalyUpdate(load) {
  anomalyWindows++;
  if (ewmMean === 0 && ewmVariance === 0) {
    ewmMean     = load;
    // Higher initial variance (std >= 3) so the first few login requests
    // don't look like an 8-sigma spike against a near-zero baseline.
    ewmVariance = Math.max(load * 0.5, 9);
    return { isAnomaly: false, zScore: 0, mean: ewmMean, std: Math.sqrt(ewmVariance) };
  }
  const std    = Math.sqrt(ewmVariance);
  const zScore = std > 0.5 ? Math.abs(load - ewmMean) / std : 0;
  // Suppress classification until we have enough windows to trust the baseline
  const isAnomaly = anomalyWindows > ANOMALY_WARMUP_WINDOWS && zScore > ANOMALY_Z_SIGMA;

  // Always update baseline — even during anomalies, just much more slowly.
  // This prevents hold-chaining: after a spike the baseline gradually rises
  // to meet the new post-spike normal so it stops flagging it as anomalous.
  const alpha = isAnomaly ? ANOMALY_ALPHA * 0.15 : ANOMALY_ALPHA;
  const delta = load - ewmMean;
  ewmMean     = ewmMean + alpha * delta;
  ewmVariance = (1 - alpha) * (ewmVariance + alpha * delta * delta);

  if (isAnomaly) anomalyHoldAt = Date.now();

  return { isAnomaly, zScore: +zScore.toFixed(2), mean: +ewmMean.toFixed(2), std: +std.toFixed(2) };
}

function isInAnomalyHold() {
  return Date.now() - anomalyHoldAt < ANOMALY_HOLD_MS;
}
// ─── Scale-up cooldown ────────────────────────────────────────────────────────
// After any scale-up event, block scale-down for SCALE_UP_COOLDOWN_MS.
// This is the single most effective fix for the thrashing pattern visible in
// your logs (scale-up at 9:34, scale-down at 9:35, scale-up at 9:37, repeat).
//
// New backends need ~30-60s to warm up on Render free tier. Scaling them down
// before they're even warm is pure waste and causes the re-scale immediately.
const SCALE_UP_COOLDOWN_MS = parseInt(process.env.SCALE_UP_COOLDOWN_MS || '150000', 10); // 2.5min

let lastScaleUpAt   = 0;
let lastScaleAction = null; // 'up' | 'down' | 'predictive' | 'anomaly' | 'pid' | 'circadian'

function isInScaleUpCooldown() {
  return Date.now() - lastScaleUpAt < SCALE_UP_COOLDOWN_MS;
}

// ─── Manual override ──────────────────────────────────────────────────────────
// manualCount: if non-null, auto-scaling is paused and this exact count is held.
// efficiencyMode: adjusts effective thresholds without changing env vars.
//   performance → scale-up at 50% of threshold, scale-down disabled
//   balanced    → defaults
//   economy     → scale-up at 180% of threshold, aggressive scale-down
let manualCount    = null;
let efficiencyMode = 'balanced';

function getEffectiveThresholds() {
  switch (efficiencyMode) {
    case 'performance': return { up: Math.round(SCALE_UP_THRESHOLD * 0.5), down: 0 };
    case 'economy':     return { up: Math.round(SCALE_UP_THRESHOLD * 1.8), down: SCALE_DOWN_THRESHOLD * 2 };
    default:            return { up: SCALE_UP_THRESHOLD, down: SCALE_DOWN_THRESHOLD };
  }
}

// ─── Circadian floor ─────────────────────────────────────────────────────────
// Learns your traffic pattern over time. Tracks the average load observed in
// each hour-of-day slot (0-23). When the current hour historically requires
// more than 1 backend, it sets a MINIMUM floor — so you never scale all the
// way down to 1 replica right before your known peak window, only to scramble
// to scale up again at 9:30 PM every single night.
//
// It takes ~24h to populate. Until then, it has zero effect.
//
// The floor is soft: it only blocks scale-DOWN, not scale-UP. The PID and HW
// systems can still scale above the floor freely.
const circadianSlots = Array.from({ length: 24 }, () => ({ sumLoad: 0, count: 0, peakBackends: 1 }));
let   circadianFloor = 1; // minimum active backends right now (recomputed each interval)

function circadianRecord(hour, avgLoad, currentBackends) {
  const slot = circadianSlots[hour];
  slot.sumLoad += avgLoad;
  slot.count++;
  // Only record peak backends from NON-anomalous windows — an anomaly scaling
  // to 5 backends must not permanently raise the floor to 4
  // (caller skips this fn during anomaly windows — extra safety here too)
  slot.peakBackends = Math.max(slot.peakBackends, Math.min(currentBackends, 2));
}

function circadianComputeFloor(hour) {
  const thisSlot = circadianSlots[hour];
  const prevSlot = circadianSlots[(hour + 23) % 24];
  if (thisSlot.count < 3 && prevSlot.count < 3) return 1;
  const thisAvg  = thisSlot.count > 0 ? thisSlot.sumLoad / thisSlot.count : 0;
  const prevAvg  = prevSlot.count  > 0 ? prevSlot.sumLoad / prevSlot.count : 0;
  const combined = Math.max(thisAvg, prevAvg);
  // Floor is max 2 — it prevents idle-time thrashing, NOT permanent over-provisioning
  if (combined >= SCALE_UP_THRESHOLD * 0.5) return 2;
  if (combined >= SCALE_UP_THRESHOLD * 0.3) return 2;
  return 1;
}

// ─── Auto-scaling ─────────────────────────────────────────────────────────────
function checkAndScale() {
  const boost = isBoostActive();

  // During boost: force fleet up to minBackends, suppress scale-down
  if (boost) {
    if (activeBackendCount < boostConfig.minBackends) {
      activeBackendCount = boostConfig.minBackends;
      updateActiveSet();
      logScale('⚡ Boost hold', `Maintaining ${activeBackendCount} active backends`);
    }
    // Still allow scale-UP beyond minBackends if load demands it (fall through)
  }

  // ── Manual override: if admin pinned a count, hold it and skip all auto-scaling
  if (manualCount !== null) {
    const clamped = Math.max(1, Math.min(manualCount, BACKENDS.length));
    if (activeBackendCount !== clamped) {
      activeBackendCount = clamped;
      updateActiveSet();
      logScale('🎛 Manual override', `Admin set backend count to ${clamped}`);
    }
    // Still reset window counters so we don't accumulate stale data
    backendStatus.forEach(b => { b.windowRequests = 0; });
    return;
  }

  const activeHealthy = backendStatus
    .slice(0, activeBackendCount)
    .filter(b => !b.circuitTripped);

  if (activeHealthy.length === 0) {
    if (activeBackendCount < BACKENDS.length) {
      activeBackendCount++;
      scaleDownStreak = 0;
      updateActiveSet();
      logScale('🚨 Emergency scale-up', 'All active backends tripped');
    }
    return;
  }

  // Snapshot and reset window counters
  const windowSnapshot = backendStatus.map(b => { const v = b.windowRequests; b.windowRequests = 0; return v; });

  const totalLoad = activeHealthy.reduce((sum, b) => {
    const idx = backendStatus.indexOf(b);
    return sum + (b.socketConnections > 0 ? b.socketConnections : windowSnapshot[idx] || 0);
  }, 0);
  const avgLoad   = totalLoad / activeHealthy.length;
  const loadLabel = activeHealthy.some(b => b.socketConnections > 0) ? 'avg sockets' : 'req/window';
  const nowHour   = new Date().getUTCHours();

  const { up: effectiveUpThreshold, down: effectiveDownThreshold } = getEffectiveThresholds();

  // ── Anomaly detection (runs BEFORE circadian so spikes don't poison the floor)
  const anomaly = anomalyUpdate(avgLoad);

  // ── Circadian: skip anomalous windows — a 73-req spike must NOT record
  //    peakBackends=5, otherwise circadianComputeFloor returns 4 forever ──────
  if (!anomaly.isAnomaly) {
    circadianRecord(nowHour, avgLoad, activeBackendCount);
  }
  circadianFloor = circadianComputeFloor(nowHour);

  // ── PID control signal ─────────────────────────────────────────────────────
  // Hard-reset integral on anomaly: the spike drove it to +15 (max windup).
  // Without this, PID keeps outputting scale-up pressure for minutes after
  // the spike clears because it's still paying back the accumulated integral.
  if (anomaly.isAnomaly) pidIntegral = 0;
  const pid = pidControl(avgLoad);

  // ── Holt-Winters predictive pre-scale ──────────────────────────────────────
  // Only feed non-anomalous samples to HW — anomalous spikes would corrupt trend
  const hw = hwUpdate(anomaly.isAnomaly ? ewmMean : avgLoad);

  // ── SCALE-UP LOGIC (priority order) ───────────────────────────────────────

  // 1. Anomaly fast-path: spike detected → scale up immediately, no HW/PID
  if (anomaly.isAnomaly && activeBackendCount < BACKENDS.length) {
    const next = backendStatus[activeBackendCount];
    if (next && !next.circuitTripped && !next.coldStart) {
      activeBackendCount++;
      scaleDownStreak = 0;
      lastScaleUpAt   = Date.now();
      lastScaleAction = 'anomaly';
      updateActiveSet();
      logScale(
        `🔴 Anomaly scale-up`,
        `load ${avgLoad.toFixed(1)} is z=${anomaly.zScore}σ above baseline ${anomaly.mean} — classified as spike not growth`
      );
      return;
    }
  }

  // 2. PID: output > 1.0 means we're clearly above the comfort setpoint
  if (pid.output > 1.0 && activeBackendCount < BACKENDS.length) {
    const next = backendStatus[activeBackendCount];
    if (next && !next.circuitTripped && !next.coldStart) {
      activeBackendCount++;
      scaleDownStreak = 0;
      lastScaleUpAt   = Date.now();
      lastScaleAction = 'pid';
      updateActiveSet();
      logScale(
        `⚙️  PID scale-up`,
        `control output ${pid.output.toFixed(2)} (err=${pid.error.toFixed(1)}, I=${pid.integral.toFixed(1)}, D=${pid.derivative.toFixed(1)})`
      );
      return;
    }
  }

  // 3. HW predictive: trend sustained, forecast approaching threshold
  if (hw.willPreScale && activeBackendCount < BACKENDS.length) {
    const next = backendStatus[activeBackendCount];
    if (next && !next.circuitTripped && !next.coldStart) {
      activeBackendCount++;
      scaleDownStreak = 0;
      lastScaleUpAt   = Date.now();
      lastScaleAction = 'predictive';
      updateActiveSet();
      logScale(
        `~ Predictive scale-up`,
        `forecast ${hw.forecast.toFixed(1)} ${loadLabel} approaching threshold ${SCALE_UP_THRESHOLD} ` +
        `(ramp ${hw.rampCount} windows, trend +${hw.trend.toFixed(1)})`
      );
      return;
    }
  }

  // 4. Hard reactive: raw threshold breached (safety net)
  if (avgLoad >= effectiveUpThreshold && activeBackendCount < BACKENDS.length) {
    const next = backendStatus[activeBackendCount];
    if (next && !next.circuitTripped && !next.coldStart) {
      activeBackendCount++;
      scaleDownStreak = 0;
      lastScaleUpAt   = Date.now();
      lastScaleAction = 'up';
      updateActiveSet();
      logScale(`↑ Scale up`, `${avgLoad.toFixed(1)} ${loadLabel} ≥ ${effectiveUpThreshold}${efficiencyMode !== "balanced" ? " (" + efficiencyMode + ")" : ""}`);
    } else if (next) {
      console.log(`  [scale] Deferred — ${next.name} is ${next.coldStart ? 'cold' : 'tripped'}`);
    }
    return;
  }

  // ── SCALE-DOWN LOGIC ───────────────────────────────────────────────────────
  // Suppressed by: boost, scale-up cooldown, anomaly hold, circadian floor

  const scaleDownBlocked =
    boost ||
    isInScaleUpCooldown() ||
    isInAnomalyHold() ||
    activeBackendCount <= circadianFloor;

  if (!scaleDownBlocked && effectiveDownThreshold > 0 && avgLoad <= effectiveDownThreshold && activeBackendCount > 1) {
    scaleDownStreak++;
    if (scaleDownStreak >= SCALE_DOWN_PATIENCE) {
      activeBackendCount--;
      scaleDownStreak    = 0;
      lastScaleAction    = 'down';
      updateActiveSet();
      logScale(
        `↓ Scale down`,
        `avg ${avgLoad.toFixed(1)} ${loadLabel} ≤ ${SCALE_DOWN_THRESHOLD} for ${SCALE_DOWN_PATIENCE} checks` +
        (circadianFloor > 1 ? ` (floor=${circadianFloor})` : '')
      );
    }
  } else if (!boost) {
    if (isInScaleUpCooldown()) {
      // log once every ~5 checks to avoid spam
      if (scaleDownStreak === 0) {
        const secsLeft = Math.round((SCALE_UP_COOLDOWN_MS - (Date.now() - lastScaleUpAt)) / 1000);
        console.log(`  [scale] Scale-down blocked by cooldown (${secsLeft}s remaining)`);
      }
    }
    if (activeBackendCount <= circadianFloor && activeBackendCount > 1) {
      console.log(`  [scale] Scale-down blocked by circadian floor (floor=${circadianFloor}, hour=${nowHour})`);
    }
    scaleDownStreak = 0;
  }
}

setInterval(checkAndScale, SCALE_CHECK_MS);

// ─── Keep-alive pinger ────────────────────────────────────────────────────────
async function pingBackend(index) {
  const b     = backendStatus[index];
  const start = Date.now();
  const meshResult = await meshGet(SERVICE_NAME, `${b.url}/api/mesh/health`, { timeout: 10000 });
  b.latencyMs = Date.now() - start;
  b.lastPing  = new Date().toISOString();

  if (meshResult.ok) {
    const d = meshResult.data;
    b.socketConnections = d.socketConnections ?? 0;
    b.memoryPct         = d.memory?.pct       ?? null;
    b.coldStart         = d.coldStart          ?? false;
    recordBackendSuccess(index);
    meshPost(SERVICE_NAME, `${b.url}/api/mesh/seen`, {
      registeredAs:  b.name,
      activeInFleet: backendStatus.filter(s => s.active).length,
    }).catch(() => {});
  } else {
    try {
      await axios.get(`${b.url}/api/health`, { timeout: 10000 });
      b.socketConnections = 0;
      recordBackendSuccess(index);
    } catch (err) {
      b.latencyMs = null;
      recordBackendError(index);
      console.warn(`  [${b.name}] ping failed — ${err.message}`);
    }
  }
}

async function pingAll() {
  await Promise.all(BACKENDS.map((_, i) => pingBackend(i)));
}

// Stagger initial pings so they don't all fire at once
BACKENDS.forEach((_, i) => setTimeout(() => pingBackend(i), i * 2000));
setInterval(pingAll, KEEPALIVE_MS);

// ─── Response cache ───────────────────────────────────────────────────────────
const responseCache = new Map();
const CACHE_RULES = [
  { pattern: /^\/api\/uptime\/status$/,        ttl: 30_000 },
  { pattern: /^\/api\/uptime\/ping$/,          ttl: 10_000 },
  // Availability and reserve config are time-sensitive — never cache them.
  // The broader /public/ pattern below intentionally excludes these paths.
  { pattern: /^\/api\/events\/public\/reserve\//,  ttl: 0 },
  { pattern: /^\/api\/events\/public\/(?!reserve)/, ttl: 60_000 },
  { pattern: /^\/api\/events\/subdomain\//,    ttl: 60_000 },
  { pattern: /^\/api\/events\/participants\//, ttl: 30_000 },
];

setInterval(() => {
  const now = Date.now();
  for (const [k, e] of responseCache) if (e.expiresAt <= now) responseCache.delete(k);
}, 2 * 60_000).unref?.();

function getCacheRule(path) {
  return CACHE_RULES.find(r => r.pattern instanceof RegExp ? r.pattern.test(path) : path.startsWith(r.pattern)) || null;
}

function cacheMiddleware(req, res, next) {
  if (req.method !== 'GET') return next();
  const rule = getCacheRule(req.path);
  if (!rule || rule.ttl === 0) return next(); // ttl:0 means explicitly bypass cache
  const key = req.method + ':' + req.url;
  const now = Date.now();
  const cached = responseCache.get(key);
  if (cached && cached.expiresAt > now) {
    res.set(cached.headers);
    res.set('X-Cache', 'HIT');
    res.set('X-Cache-Age', String(Math.floor((now - (cached.expiresAt - rule.ttl)) / 1000)));
    return res.status(cached.status).send(cached.body);
  }
  const chunks = [];
  const ow = res.write.bind(res), oe = res.end.bind(res);
  res.write = (c, enc, cb) => { if (c) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c, enc || 'utf8')); return ow(c, enc, cb); };
  res.end   = (c, enc, cb) => {
    if (c) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c, enc || 'utf8'));
    if (res.statusCode === 200 && (res.getHeader('content-type') || '').includes('application/json')) {
      const body = Buffer.concat(chunks), headers = {};
      (res.getHeaderNames?.() || []).forEach(h => { if (h !== 'x-cache' && h !== 'x-cache-age') headers[h] = res.getHeader(h); });
      responseCache.set(key, { body, status: 200, headers, expiresAt: now + rule.ttl });
    }
    if (!res.headersSent) res.set('X-Cache', 'MISS');
    return oe(c, enc, cb);
  };
  next();
}

// ─── App ──────────────────────────────────────────────────────────────────────
const app = express();
app.use(cookieParser());

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || origin === 'null') return cb(null, true);
    if (ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','x-mesh-token','x-mesh-caller','x-mesh-version','x-event-token'],
}));

// ─── Maintenance mode ─────────────────────────────────────────────────────────
// Single source of truth. MAINTENANCE_MODE=true in router env activates on boot.
// Toggle live via POST /mesh/maintenance (mesh-auth only — admin panel uses this).
// Frontend polls GET /maintenance every 30s.
// Backend polls this same endpoint every 15s and refuses non-exempt requests.

let _maintenance = {
  active:   process.env.MAINTENANCE_MODE === 'true',
  upcoming: false,
  type:     process.env.MAINTENANCE_TYPE || 's',   // 's'|'i'|'d'
  message:  process.env.MAINTENANCE_MESSAGE || 'PlanIt is undergoing scheduled maintenance. We\'ll be back shortly.',
  eta:      process.env.MAINTENANCE_ETA     || null,
  setAt:    process.env.MAINTENANCE_MODE === 'true' ? new Date().toISOString() : null,
  setBy:    process.env.MAINTENANCE_MODE === 'true' ? 'env'                   : null,
};

if (_maintenance.active) {
  console.log(`[maintenance] ⚠  MAINTENANCE MODE ACTIVE (set by env)`);
}

// Public read — frontend + backend both poll this
app.get('/maintenance', (_req, res) => res.json(_maintenance));

// Mesh-protected toggle — only the backend admin route calls this
app.post('/mesh/maintenance', meshAuth(SERVICE_NAME), express.json(), (req, res) => {
  const prev = _maintenance.active;
  _maintenance = {
    active:   !!req.body.active,
    upcoming: !req.body.active && !!req.body.upcoming,
    type:     req.body.type    || _maintenance.type || 's',
    message:  req.body.message || _maintenance.message,
    eta:      req.body.eta     != null ? req.body.eta : null,
    setAt:    new Date().toISOString(),
    setBy:    req.meshCaller || 'admin',
  };
  console.log(`[maintenance] ${_maintenance.active ? '⚠  ENABLED' : _maintenance.upcoming ? '⏰  UPCOMING' : '✓  DISABLED'} by ${_maintenance.setBy} (was: ${prev})`);
  res.json({ ok: true, ..._maintenance });
});

// Maintenance intercept — fires on EVERY proxied request before cache/proxy.
// Exempt: health, /maintenance read, all /mesh/* (mesh auth handles those),
//         /api/admin (admin must stay accessible to toggle maintenance off),
//         /api/mesh/* (backend mesh routes),
//         socket.io (WebSocket upgrades go through server.on('upgrade') separately),
//         OPTIONS preflight.
function _maintenanceExempt(req) {
  if (req.method === 'OPTIONS') return true;
  const p = req.path;
  if (p === '/health' || p === '/maintenance') return true;
  if (p.startsWith('/mesh/'))      return true;   // router mesh endpoints
  if (p.startsWith('/api/mesh'))   return true;   // backend mesh endpoints
  if (p.startsWith('/api/admin'))  return true;   // admin panel stays alive
  if (p.startsWith('/socket.io'))  return true;   // socket polling
  return false;
}

// ─── Health endpoint ──────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  const active  = backendStatus.filter(b => b.active);
  const healthy = active.every(b => b.alive);
  res.status(healthy ? 200 : 207).json({
    status:  healthy ? 'ok' : 'degraded',
    uptime:  Math.floor(process.uptime()),
    boost:   isBoostActive() ? {
      active:      true,
      activeUntil: boostConfig.activeUntil.toISOString(),
      reason:      boostConfig.reason,
      minBackends: boostConfig.minBackends,
    } : { active: false },
    scaling: { activeCount: activeBackendCount, totalCount: BACKENDS.length },
    backends: backendStatus.map(s => ({
      name: s.name, active: s.active, alive: s.alive,
      latencyMs: s.latencyMs, circuitTripped: s.circuitTripped, coldStart: s.coldStart,
    })),
    timestamp: new Date().toISOString(),
  });
});

// ─── Mesh status ──────────────────────────────────────────────────────────────
app.get('/mesh/status', meshAuth(SERVICE_NAME), (_req, res) => {
  res.json({
    service: SERVICE_NAME,
    uptime:  Math.floor(process.uptime()),
    boost: isBoostActive() ? {
      active:        true,
      activeUntil:   boostConfig.activeUntil.toISOString(),
      reason:        boostConfig.reason,
      minBackends:   boostConfig.minBackends,
      activatedAt:   boostConfig.activatedAt,
      pinnedEvents:  [...(boostConfig.pinnedEventIds || [])],
    } : { active: false },
    scaling: {
      activeBackendCount,
      totalBackends: BACKENDS.length + dynamicBackends.length,
      trippedCount:  backendStatus.filter(b => b.circuitTripped).length,
      scaleDownStreak,
      thresholds: { scaleUp: SCALE_UP_THRESHOLD, scaleDown: SCALE_DOWN_THRESHOLD },
      predictive: {
        level:     parseFloat(hwLevel.toFixed(2)),
        trend:     parseFloat(hwTrend.toFixed(2)),
        rampCount: hwRampCount,
        forecast:  parseFloat((hwLevel + hwTrend).toFixed(2)),
        headroom:  HW_HEADROOM,
        historyLen: hwHistory.length,
      },
      pid: {
        integral:   parseFloat(pidIntegral.toFixed(2)),
        lastError:  parseFloat(pidLastError.toFixed(2)),
        lastLoad:   parseFloat(pidLastLoad.toFixed(2)),
        setpoint:   parseFloat((SCALE_UP_THRESHOLD * PID_SETPOINT).toFixed(1)),
        gains:      { kp: PID_KP, ki: PID_KI, kd: PID_KD },
      },
      anomaly: {
        mean:          parseFloat(ewmMean.toFixed(2)),
        std:           parseFloat(Math.sqrt(ewmVariance).toFixed(2)),
        zThreshold:    ANOMALY_Z_SIGMA,
        holdMs:        ANOMALY_HOLD_MS,
        inHold:        isInAnomalyHold(),
        holdSecsLeft:  isInAnomalyHold() ? Math.round((ANOMALY_HOLD_MS - (Date.now() - anomalyHoldAt)) / 1000) : 0,
      },
      cooldown: {
        ms:           SCALE_UP_COOLDOWN_MS,
        active:       isInScaleUpCooldown(),
        secsLeft:     isInScaleUpCooldown() ? Math.round((SCALE_UP_COOLDOWN_MS - (Date.now() - lastScaleUpAt)) / 1000) : 0,
        lastAction:   lastScaleAction,
      },
      circadian: {
        floor:        circadianFloor,
        currentHour:  new Date().getUTCHours(),
        slots:        circadianSlots.map((s, i) => ({
          hour:        i,
          avgLoad:     s.count > 0 ? parseFloat((s.sumLoad / s.count).toFixed(1)) : null,
          peakBackends: s.peakBackends,
          samples:     s.count,
        })),
      },
    },
    manual: {
      active:        manualCount !== null,
      count:         manualCount,
      efficiencyMode,
      effectiveThresholds: getEffectiveThresholds(),
    },
    scalingLog: scalingLog.slice(0, 20),
    backends: backendStatus.map((s, i) => ({
      index: i, name: s.name, active: s.active, alive: s.alive,
      latencyMs: s.latencyMs, lastPing: s.lastPing,
      requests: s.requests, windowRequests: s.windowRequests,
      activeConnections: s.activeConnections, socketConnections: s.socketConnections,
      memoryPct: s.memoryPct, coldStart: s.coldStart,
      circuitTripped: s.circuitTripped, consecutiveErrors: s.consecutiveErrors,
    })),
    dynamicBackends: dynamicBackends.map(d => ({ name: d.name, region: d.region, registeredAt: d.registeredAt })),
    timestamp: new Date().toISOString(),
  });
});

// ─── Mesh logs endpoint ───────────────────────────────────────────────────────
// Returns the full router log buffer. Called by the backend admin log aggregator.
app.get('/mesh/logs', meshAuth(SERVICE_NAME), (_req, res) => {
  res.json({
    source:   'router',
    name:     'Router',
    logs:     ROUTER_LOG_BUFFER.slice(),
    total:    ROUTER_LOG_BUFFER.length,
    uptime:   Math.floor(process.uptime()),
    ts:       new Date().toISOString(),
  });
});

// ─── Mesh fleet-logs aggregator ───────────────────────────────────────────────
// Single endpoint that fans out to:
//   - this router's own log buffer
//   - every registered backend via GET /api/mesh/logs
//   - the watchdog via GET /mesh/logs  (if WATCHDOG_URL is set)
// The admin panel calls this once and gets every log from every service,
// merged and sorted by timestamp. Failures are soft — partial results returned.
app.get('/mesh/fleet-logs', meshAuth(SERVICE_NAME), async (_req, res) => {
  const results = [
    // Always include router's own logs
    {
      source:   'router',
      name:     'Router',
      ok:       true,
      logs:     ROUTER_LOG_BUFFER.slice().map(e => ({ ...e, source: 'router', sourceName: 'Router' })),
    },
  ];

  const fetches = [];

  // Fan out to every known backend
  backendStatus.forEach(b => {
    fetches.push(
      meshGet(SERVICE_NAME, `${b.url}/api/mesh/logs`, { timeout: 8000 })
        .then(r => {
          if (r.ok && r.data?.logs) {
            results.push({ source: r.data.source || b.name.toLowerCase(), name: r.data.name || b.name, ok: true, logs: r.data.logs });
          } else {
            results.push({ source: b.name.toLowerCase(), name: b.name, ok: false, error: r.error || 'no logs returned' });
          }
        })
        .catch(err => results.push({ source: b.name.toLowerCase(), name: b.name, ok: false, error: err.message }))
    );
  });

  // Fan out to watchdog if configured
  if (WATCHDOG_URL) {
    fetches.push(
      meshGet(SERVICE_NAME, `${WATCHDOG_URL}/mesh/logs`, { timeout: 8000 })
        .then(r => {
          if (r.ok && r.data?.logs) {
            results.push({ source: 'watchdog', name: r.data.name || 'Watchdog', ok: true, logs: r.data.logs });
          } else {
            results.push({ source: 'watchdog', name: 'Watchdog', ok: false, error: r.error || 'no logs returned' });
          }
        })
        .catch(err => results.push({ source: 'watchdog', name: 'Watchdog', ok: false, error: err.message }))
    );
  }

  await Promise.all(fetches);

  // Merge and sort all logs by timestamp ascending
  const allLogs = results
    .filter(r => r.ok && r.logs)
    .flatMap(r => r.logs.map(e => ({ ...e, source: e.source || r.source, sourceName: e.sourceName || r.name })));
  allLogs.sort((a, b) => (a.ts > b.ts ? 1 : a.ts < b.ts ? -1 : 0));

  const sources = results.map(r => ({
    source: r.source,
    name:   r.name,
    ok:     r.ok,
    count:  r.ok ? r.logs.length : 0,
    error:  r.error || null,
  }));

  res.json({ logs: allLogs, total: allLogs.length, sources, fetchedAt: new Date().toISOString() });
});

// ─── Boost API ────────────────────────────────────────────────────────────────
// POST /mesh/boost — activate boost mode
// Body: { durationMinutes, reason, minBackends, pinnedEventIds[] }
app.post('/mesh/boost', meshAuth(SERVICE_NAME), express.json(), (req, res) => {
  const { durationMinutes = 60, reason = 'Admin boost', minBackends, pinnedEventIds } = req.body;
  activateBoost({ durationMinutes, reason, minBackends, pinnedEventIds });
  res.json({
    ok: true,
    boost: {
      active:      true,
      activeUntil: boostConfig.activeUntil.toISOString(),
      reason:      boostConfig.reason,
      minBackends: boostConfig.minBackends,
    },
  });
});

// DELETE /mesh/boost — cancel boost
app.delete('/mesh/boost', meshAuth(SERVICE_NAME), (_req, res) => {
  const cancelled = cancelBoost();
  res.json({ ok: true, cancelled });
});

// ─── Manual scale control ────────────────────────────────────────────────────
// POST /mesh/scale
// Body: { count?: number|null, efficiencyMode?: 'performance'|'balanced'|'economy' }
// count: null = return to auto-scaling, number = pin to that many backends
app.post('/mesh/scale', meshAuth(SERVICE_NAME), express.json(), (req, res) => {
  const { count, efficiencyMode: mode } = req.body || {};

  if (mode !== undefined) {
    if (!['performance','balanced','economy'].includes(mode)) {
      return res.status(400).json({ error: 'efficiencyMode must be performance | balanced | economy' });
    }
    efficiencyMode = mode;
    console.log(`[scale] Efficiency mode set to ${mode} by admin`);
  }

  if (count !== undefined) {
    if (count === null) {
      manualCount = null;
      console.log('[scale] Manual override cleared — returning to auto-scaling');
      logScale('🎛 Auto-scaling restored', 'Admin released manual override');
    } else {
      const n = parseInt(count, 10);
      if (isNaN(n) || n < 1 || n > BACKENDS.length) {
        return res.status(400).json({ error: `count must be 1–${BACKENDS.length}` });
      }
      manualCount = n;
      // Apply immediately — don't wait for next checkAndScale interval
      activeBackendCount = Math.max(1, Math.min(n, BACKENDS.length));
      updateActiveSet();
      logScale(`🎛 Manual override`, `Admin pinned fleet to ${n} backend${n !== 1 ? 's' : ''}`);
      console.log(`[scale] Manual override: ${n} backends`);
    }
  }

  res.json({
    ok: true,
    manual: { active: manualCount !== null, count: manualCount, efficiencyMode, effectiveThresholds: getEffectiveThresholds() },
    activeBackendCount,
  });
});

// ─── Mesh email relay ─────────────────────────────────────────────────────────
// POST /mesh/email
// Backends call this to send transactional emails (via Brevo / Mailjet)
// without ever holding the provider API keys. Only reachable via mesh-auth.
// Body: { to: string, subject: string, html: string }
app.post('/mesh/email', meshAuth(SERVICE_NAME), express.json({ limit: '512kb' }), async (req, res) => {
  const { to, subject, html } = req.body || {};
  if (!to || !subject || !html) {
    return res.status(400).json({ error: 'to, subject, and html are required' });
  }
  const result = await sendViaResend(String(to), String(subject), String(html));
  if (result.ok) {
    res.json({ ok: true });
  } else {
    console.error(`[email] Relay failed: ${result.reason}`);
    res.status(502).json({ ok: false, reason: result.reason || 'send failed' });
  }
});

// POST /mesh/email/test — sends a test email to a given address (admin UI only)
app.post('/mesh/email/test', meshAuth(SERVICE_NAME), express.json(), async (req, res) => {
  const { to } = req.body || {};
  if (!to) return res.status(400).json({ error: 'to is required' });
  const html = `<div style="font-family:system-ui;padding:24px;max-width:520px">
    <h2 style="color:#7c3aed">PlanIt — Test Email</h2>
    <p>This is a test email from your PlanIt router. If you received this, your Resend integration is working correctly.</p>
    <p style="color:#9ca3af;font-size:12px;margin-top:24px">Sent at ${new Date().toUTCString()}</p>
  </div>`;
  const result = await sendViaResend(String(to), 'PlanIt — Test Email', html);
  if (result.ok) {
    res.json({ ok: true });
  } else {
    res.status(502).json({ ok: false, reason: result.reason });
  }
});

// GET /mesh/email/status — returns all-provider key pool health
app.get('/mesh/email/status', meshAuth(SERVICE_NAME), (_req, res) => {
  res.json(_keyPoolStats());
});

// GET /mesh/email/pool — detailed key pool for command center (same data, aliased)
app.get('/mesh/email/pool', meshAuth(SERVICE_NAME), (_req, res) => {
  res.json({ ok: true, pool: _keyPoolStats(), fetchedAt: new Date().toISOString() });
});

// POST /mesh/exec — execute a named command on the router itself
// Supported commands: flush-logs, ping, stats, gc, clear-key-suspension
app.post('/mesh/exec', meshAuth(SERVICE_NAME), express.json(), (req, res) => {
  const { command, params = {} } = req.body || {};
  if (!command) return res.status(400).json({ error: 'command required' });

  switch (command) {
    case 'ping':
      return res.json({ ok: true, result: { pong: true, ts: new Date().toISOString(), pid: process.pid, uptime: Math.floor(process.uptime()) } });

    case 'stats': {
      const mem = process.memoryUsage();
      return res.json({ ok: true, result: {
        pid:      process.pid,
        uptime:   Math.floor(process.uptime()),
        memMB: {
          rss:       +(mem.rss       / 1048576).toFixed(1),
          heapUsed:  +(mem.heapUsed  / 1048576).toFixed(1),
          heapTotal: +(mem.heapTotal / 1048576).toFixed(1),
        },
        backends:     BACKENDS.length,
        logBufferLen: ROUTER_LOG_BUFFER.length,
        emailPool:    _keyPoolStats()._summary,
        nodeVersion:  process.version,
      }});
    }

    case 'flush-logs': {
      const count = ROUTER_LOG_BUFFER.length;
      ROUTER_LOG_BUFFER.length = 0;
      console.log(`[cc] Router log buffer flushed by command center (${count} entries cleared)`);
      return res.json({ ok: true, result: { flushed: count } });
    }

    case 'gc': {
      let ran = false;
      if (global.gc) { global.gc(); ran = true; }
      return res.json({ ok: true, result: { gcRan: ran, note: ran ? 'GC triggered' : 'gc() not exposed — start node with --expose-gc to enable' } });
    }

    case 'clear-key-suspension': {
      const provider = params.provider || 'brevo';
      const pool = _pools[provider];
      if (!pool) return res.status(400).json({ error: `Unknown provider: ${provider}` });
      let cleared = 0;
      pool.keys.forEach(k => { if (k.suspendedUntil) { k.suspendedUntil = null; cleared++; } });
      console.log(`[cc] Cleared ${cleared} suspended ${provider} key(s) via command center`);
      return res.json({ ok: true, result: { provider, cleared } });
    }

    case 'list-backends':
      return res.json({ ok: true, result: { backends: BACKENDS, count: BACKENDS.length } });

    default:
      return res.status(400).json({ error: `Unknown command: ${command}` });
  }
});

// ─── Mesh config relay ───────────────────────────────────────────────────────
// GET /mesh/config
// Backends call this once on startup to pull shared env vars so you only need
// to set them on the router — not on every backend individually.
// Add any future shared secrets to SHARED_CONFIG_KEYS and they'll auto-propagate.
const SHARED_CONFIG_KEYS = [
  'UPSTASH_REDIS_URL',
  'UPSTASH_REDIS_TOKEN',
  'SURVEY_URL',
  'EMAIL_REMINDER_HOURS',
  'FRONTEND_URL',
  'WATCHDOG_URL',   // propagated to backends so they can reference it if needed
];
app.get('/mesh/config', meshAuth(SERVICE_NAME), (_req, res) => {
  const config = {};
  for (const key of SHARED_CONFIG_KEYS) {
    if (process.env[key]) config[key] = process.env[key];
  }
  res.json({ ok: true, config });
});

// ─── Mesh register ────────────────────────────────────────────────────────────
app.post('/mesh/register', meshAuth(SERVICE_NAME), express.json(), (req, res) => {
  const { url, name, region } = req.body;
  if (!url) return res.status(400).json({ error: 'url required' });

  const existingIdx = BACKENDS.findIndex(b => b === url || b === url.replace(/\/$/, ''));
  if (existingIdx >= 0) {
    if (name)   backendStatus[existingIdx].name   = name;
    if (region) backendStatus[existingIdx].region = region;
    return res.json({ ok: true, joined: false, reason: 'already registered', index: existingIdx });
  }

  const already = dynamicBackends.find(d => d.url === url);
  if (already) {
    already.name = name || already.name;
    already.region = region || already.region;
    already.lastSeenAt = new Date().toISOString();
    return res.json({ ok: true, joined: false, reason: 'already in dynamic pool' });
  }

  const entry = { url, name: name || `Dynamic-${dynamicBackends.length + 1}`, region: region || null, registeredAt: new Date().toISOString(), lastSeenAt: new Date().toISOString() };
  dynamicBackends.push(entry);
  BACKENDS.push(url);

  const capturedIndex = backendStatus.length;
  backendStatus.push({
    url, name: entry.name, alive: true, latencyMs: null, lastPing: null,
    requests: 0, activeConnections: 0, windowRequests: 0,
    active: false, coldStart: true, socketConnections: 0, memoryPct: null,
    circuitTripped: false, consecutiveErrors: 0, recoveryProbes: 0, pinnedEvents: new Set(),
  });

  proxies.push(createProxyMiddleware({
    target: url, changeOrigin: true, ws: true, proxyTimeout: 60000, timeout: 60000,
    on: {
      proxyReq(_p, req) {
        backendStatus[capturedIndex].activeConnections++;
        backendStatus[capturedIndex].windowRequests++;
        req._proxyFinished = false;
        req.on('close', () => { if (!req._proxyFinished) backendStatus[capturedIndex].activeConnections = Math.max(0, backendStatus[capturedIndex].activeConnections - 1); });
      },
      proxyRes(_p, req) {
        req._proxyFinished = true;
        backendStatus[capturedIndex].activeConnections = Math.max(0, backendStatus[capturedIndex].activeConnections - 1);
        backendStatus[capturedIndex].requests++;
      },
      error(_e, req, res) {
        req._proxyFinished = true;
        backendStatus[capturedIndex].activeConnections = Math.max(0, backendStatus[capturedIndex].activeConnections - 1);
        recordBackendError(capturedIndex);
        if (!res.headersSent) res.status(502).json({ error: 'Backend unavailable' });
      },
    },
  }));

  pingBackend(capturedIndex);
  logScale(`+ Dynamic join: ${entry.name}`, url.split('/')[2]);
  res.json({ ok: true, joined: true, name: entry.name, totalBackends: BACKENDS.length });
});

// ─── Proxy instances ──────────────────────────────────────────────────────────
const proxies = BACKENDS.map((target, index) =>
  createProxyMiddleware({
    target, changeOrigin: true, ws: true, proxyTimeout: 60000, timeout: 60000,
    on: {
      proxyReq(_p, req) {
        backendStatus[index].activeConnections++;
        backendStatus[index].windowRequests++;
        req._proxyFinished = false;
        req.on('close', () => { if (!req._proxyFinished) backendStatus[index].activeConnections = Math.max(0, backendStatus[index].activeConnections - 1); });
      },
      proxyRes(_p, req, res) {
        req._proxyFinished = true;
        backendStatus[index].activeConnections = Math.max(0, backendStatus[index].activeConnections - 1);
        backendStatus[index].requests++;
        res.cookie(COOKIE_NAME, String(index), { maxAge: COOKIE_MAX_AGE_MS, httpOnly: true, sameSite: 'None', secure: true });
      },
      error(err, req, res) {
        req._proxyFinished = true;
        backendStatus[index].activeConnections = Math.max(0, backendStatus[index].activeConnections - 1);
        recordBackendError(index);
        console.error(`  [router] proxy error → [${index}]: ${err.message}`);
        if (res.headersSent) return;
        res.status(502).json({ error: 'Backend unavailable', message: 'Temporarily unavailable, please retry.' });
      },
    },
  })
);

// ─── Maintenance intercept (before cache + proxy) ─────────────────────────────
app.use((req, res, next) => {
  if (!_maintenance.active) return next();
  if (_maintenanceExempt(req)) return next();
  res.status(503).json({
    maintenance: true,
    message:     _maintenance.message,
    eta:         _maintenance.eta,
  });
});

app.use(cacheMiddleware);

app.use((req, res, next) => {
  const index = pickBackendIndex(req);
  const b = backendStatus[index];
  console.log(`  → [${b.name}] ${req.method} ${req.url.slice(0, 100)}`);
  proxies[index](req, res, next);
});

// ─── HTTP + WebSocket ─────────────────────────────────────────────────────────
const server = http.createServer(app);

server.on('upgrade', (req, socket, head) => {
  const rawCookies = req.headers.cookie || '';
  req.cookies = Object.fromEntries(
    rawCookies.split(';').map(c => { const [k, ...v] = c.trim().split('='); return [k?.trim() ?? '', v.join('=')?.trim() ?? '']; })
  );
  const index = pickBackendIndex(req);
  console.log(`  ↑ WS → ${backendStatus[index]?.name} ${req.url.slice(0, 80)}`);
  proxies[index].upgrade(req, socket, head);
});

server.listen(PORT, () => {
  console.log(`\n  Router on port ${PORT} — ${BACKENDS.length} backends\n`);
});
