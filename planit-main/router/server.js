require('dotenv').config();
const express      = require('express');
const cookieParser = require('cookie-parser');
const { createProxyMiddleware } = require('http-proxy-middleware');
const axios        = require('axios');
const http         = require('http');

// ─── Config ───────────────────────────────────────────────────────────────────
const BACKENDS = (process.env.BACKEND_URLS || '')
  .split(',').map(u => u.trim()).filter(Boolean);

if (BACKENDS.length === 0) {
  console.error('\n  FATAL: BACKEND_URLS env var is not set.\n');
  process.exit(1);
}

const PORT              = process.env.PORT || 3000;
const COOKIE_NAME       = 'planit_route';
const COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const KEEPALIVE_MS      = 4 * 60 * 1000;

// ── Auto-scaling thresholds ───────────────────────────────────────────────────
//
// HOW THE SCALING WORKS (plain English):
//
// Render free tier gives you several idle instances. Rather than routing traffic
// to all of them at once (which dilutes the warm connection pool and makes each
// backend do very little), we concentrate real traffic onto as few backends as
// possible and only expand when those backends are actually getting busy.
//
// Think of it like a restaurant opening extra sections only when needed:
//   - Start with 1 server station (1 active backend)
//   - When that station gets busy (>SCALE_UP_THRESHOLD avg requests in flight),
//     open another station (promote 1 more backend into the active set)
//   - When stations are quiet again for a sustained period, consolidate back down
//   - Closed stations still have staff on standby (keepalive pings) — they can
//     be opened instantly, no cold start delay
//
// CIRCUIT BREAKER:
//   If a backend starts returning errors or becomes unreachable, it gets marked
//   as "tripped" and removed from the active routing set immediately, regardless
//   of scaling state. Traffic fails over to remaining healthy backends. The tripped
//   backend gets periodic recovery probes — once it responds healthily for
//   CIRCUIT_RECOVERY_CHECKS consecutive checks, it re-enters the active pool.
//
// CONFIGURABLE via env vars:
//   SCALE_UP_THRESHOLD   — avg in-flight requests per active backend to trigger scale-up   (default: 20)
//   SCALE_DOWN_THRESHOLD — avg in-flight requests to allow scale-down                      (default: 5)
//   SCALE_DOWN_PATIENCE  — consecutive quiet checks before scaling down                    (default: 5)
//   CIRCUIT_TRIP_ERRORS  — consecutive errors before tripping circuit breaker              (default: 3)
//   CIRCUIT_RECOVERY_CHECKS — healthy pings needed to restore a tripped backend           (default: 2)
//
const SCALE_UP_THRESHOLD      = parseInt(process.env.SCALE_UP_THRESHOLD      || '20', 10);
const SCALE_DOWN_THRESHOLD    = parseInt(process.env.SCALE_DOWN_THRESHOLD    || '5',  10);
const SCALE_DOWN_PATIENCE     = parseInt(process.env.SCALE_DOWN_PATIENCE     || '5',  10); // raised from 3 — less jittery
const CIRCUIT_TRIP_ERRORS     = parseInt(process.env.CIRCUIT_TRIP_ERRORS     || '3',  10);
const CIRCUIT_RECOVERY_CHECKS = parseInt(process.env.CIRCUIT_RECOVERY_CHECKS || '2',  10);
const SCALE_CHECK_MS          = 30 * 1000;

console.log(`\n${'═'.repeat(60)}`);
console.log(` PlanIt Router — Smart Scaling — starting`);
console.log(`${'═'.repeat(60)}`);
console.log(` Total backends : ${BACKENDS.length}`);
BACKENDS.forEach((b, i) => console.log(`   [${i}] ${b}`));
console.log(` Scale up at    : ${SCALE_UP_THRESHOLD} avg connections`);
console.log(` Scale down at  : ${SCALE_DOWN_THRESHOLD} avg connections`);
console.log(`${'═'.repeat(60)}\n`);

// ─── Per-backend state ────────────────────────────────────────────────────────
const backendStatus = BACKENDS.map((url) => ({
  url,
  alive:              true,
  latencyMs:          null,
  lastPing:           null,
  requests:           0,            // total lifetime requests
  activeConnections:  0,            // currently in-flight requests
  active:             false,        // is this backend in the active routing set?
  // Circuit breaker state
  circuitTripped:     false,        // true = backend removed from routing due to errors
  consecutiveErrors:  0,            // errors since last success
  recoveryProbes:     0,            // successful health checks while tripped
}));

// ── Scaling state ─────────────────────────────────────────────────────────────
let activeBackendCount = 1;   // start with 1 — expand as load grows
let scaleDownStreak    = 0;   // consecutive quiet checks — must reach SCALE_DOWN_PATIENCE

// scalingLog: keep last 20 scaling decisions for the /health endpoint
const scalingLog = [];
function logScale(action, reason) {
  const entry = { time: new Date().toISOString(), action, reason, activeBackendCount };
  scalingLog.unshift(entry);
  if (scalingLog.length > 20) scalingLog.pop();
  console.log(`  [scale] ${action} → ${activeBackendCount} active — ${reason}`);
}

// Mark which backends are in the active set
// Active = index < activeBackendCount AND circuit not tripped
function updateActiveSet() {
  backendStatus.forEach((b, i) => {
    b.active = i < activeBackendCount && !b.circuitTripped;
  });
  const activeList = backendStatus
    .map((b, i) => b.active ? i : null).filter(i => i !== null);
  console.log(`  [scale] Active set: [${activeList.join(', ')}] of ${BACKENDS.length} total`);
}
updateActiveSet();

// ─── Routing ──────────────────────────────────────────────────────────────────
const OBJECTID_RE = /[a-f0-9]{24}/i;

function djb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
    h = h >>> 0;
  }
  return h % activeBackendCount;
}

// Pick a backend — skips tripped (circuit-broken) backends automatically
function pickHealthyBackend(preferredIndex) {
  // If preferred is healthy, use it
  if (!backendStatus[preferredIndex]?.circuitTripped) return preferredIndex;
  // Otherwise find next healthy backend in the active set
  for (let i = 0; i < activeBackendCount; i++) {
    if (!backendStatus[i].circuitTripped) return i;
  }
  // All active backends are tripped — try any backend as last resort
  for (let i = 0; i < BACKENDS.length; i++) {
    if (!backendStatus[i].circuitTripped) return i;
  }
  // Truly all tripped — return preferred anyway (will fail, but cleanly)
  return preferredIndex;
}

function pickBackendIndex(req) {
  let preferred;

  // 1. EventId in URL — deterministic hash ensures all users in same event → same backend
  const match = req.url.match(OBJECTID_RE);
  if (match) {
    preferred = djb2(match[0]);
    return pickHealthyBackend(preferred);
  }

  // 2. Sticky cookie — honour previous assignment if still valid
  const cookie = req.cookies?.[COOKIE_NAME];
  if (cookie !== undefined) {
    const idx = parseInt(cookie, 10);
    if (!isNaN(idx) && idx >= 0 && idx < activeBackendCount) {
      return pickHealthyBackend(idx);
    }
  }

  // 3. IP-based fallback
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
           || req.socket?.remoteAddress || '0';
  preferred = djb2(ip);
  return pickHealthyBackend(preferred);
}

// ─── Circuit breaker ─────────────────────────────────────────────────────────
// Records an error for a backend. If errors reach the trip threshold, the
// backend is removed from routing immediately regardless of scaling state.
function recordBackendError(index) {
  const b = backendStatus[index];
  b.consecutiveErrors++;
  b.alive = false;

  if (!b.circuitTripped && b.consecutiveErrors >= CIRCUIT_TRIP_ERRORS) {
    b.circuitTripped = true;
    b.recoveryProbes = 0;
    updateActiveSet();
    logScale(`⚡ Circuit tripped on backend [${index}]`,
      `${b.consecutiveErrors} consecutive errors — removed from routing`);
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
      logScale(`✅ Circuit restored on backend [${index}]`,
        `${CIRCUIT_RECOVERY_CHECKS} consecutive healthy probes — re-added to routing`);
    }
  }
}

// ─── Auto-scaling logic ───────────────────────────────────────────────────────
function checkAndScale() {
  // Only consider non-tripped backends in the active set for load measurement
  const activeHealthy = backendStatus
    .slice(0, activeBackendCount)
    .filter(b => !b.circuitTripped);

  if (activeHealthy.length === 0) {
    // All active backends are tripped — emergency: expand to include next backend
    if (activeBackendCount < BACKENDS.length) {
      activeBackendCount++;
      scaleDownStreak = 0;
      updateActiveSet();
      logScale('🚨 Emergency scale-up', 'All active backends tripped — promoting next backend');
    }
    return;
  }

  const totalConnections = activeHealthy.reduce((sum, b) => sum + b.activeConnections, 0);
  const avgConnections   = totalConnections / activeHealthy.length;

  // Scale UP — active backends are busy AND we have more available AND they're healthy
  if (avgConnections >= SCALE_UP_THRESHOLD && activeBackendCount < BACKENDS.length) {
    // Only scale up to a backend that isn't tripped
    const nextIndex = activeBackendCount;
    if (!backendStatus[nextIndex]?.circuitTripped) {
      activeBackendCount++;
      scaleDownStreak = 0;
      updateActiveSet();
      logScale(`↑ Scale up`, `avg ${avgConnections.toFixed(1)} connections ≥ threshold ${SCALE_UP_THRESHOLD}`);
    }
    return;
  }

  // Scale DOWN — quiet for sustained period AND minimum 1 active
  if (avgConnections <= SCALE_DOWN_THRESHOLD && activeBackendCount > 1) {
    scaleDownStreak++;
    if (scaleDownStreak >= SCALE_DOWN_PATIENCE) {
      activeBackendCount--;
      scaleDownStreak = 0;
      updateActiveSet();
      logScale(`↓ Scale down`,
        `avg ${avgConnections.toFixed(1)} connections ≤ threshold ${SCALE_DOWN_THRESHOLD} for ${SCALE_DOWN_PATIENCE} checks`);
    }
    // else: quiet but not yet patient enough — log progress
    else if (scaleDownStreak === 1) {
      console.log(`  [scale] Quiet (${avgConnections.toFixed(1)} avg) — will scale down after ${SCALE_DOWN_PATIENCE - scaleDownStreak} more quiet checks`);
    }
  } else if (avgConnections > SCALE_DOWN_THRESHOLD) {
    if (scaleDownStreak > 0) {
      console.log(`  [scale] Load increased (${avgConnections.toFixed(1)} avg) — reset scale-down streak`);
    }
    scaleDownStreak = 0;
  }
}

setInterval(checkAndScale, SCALE_CHECK_MS);

// ─── Keep-alive pinger ────────────────────────────────────────────────────────
// ALL backends get pinged — not just active ones. Inactive backends must stay
// warm so they can be promoted instantly when load increases.
async function pingBackend(index) {
  const url   = BACKENDS[index];
  const start = Date.now();
  try {
    await axios.get(`${url}/api/health`, { timeout: 10000 });
    backendStatus[index].latencyMs = Date.now() - start;
    backendStatus[index].lastPing  = new Date().toISOString();
    recordBackendSuccess(index);
  } catch (err) {
    backendStatus[index].latencyMs = null;
    backendStatus[index].lastPing  = new Date().toISOString();
    recordBackendError(index);
    console.warn(`  [router] ⚠ backend [${index}] ${url} — ${err.message}`);
  }
}

async function pingAll() {
  await Promise.all(BACKENDS.map((_, i) => pingBackend(i)));
}

BACKENDS.forEach((_, i) => setTimeout(() => pingBackend(i), i * 2000));
setInterval(pingAll, KEEPALIVE_MS);

// ─── Response Cache ───────────────────────────────────────────────────────────
// Caches GET responses for routes that change infrequently.
// Bypassed for non-GET requests, non-200 responses, and non-JSON content.
// Each rule has its own TTL — shorter for live data, longer for stable data.
//
const responseCache = new Map(); // key → { body, status, headers, expiresAt }

const CACHE_RULES = [
  { pattern: /^\/api\/uptime\/status$/,        ttl: 30_000 }, // 30s — platform status
  { pattern: /^\/api\/uptime\/ping$/,          ttl: 10_000 }, // 10s — lightweight ping
  { pattern: /^\/api\/events\/public\//,       ttl: 60_000 }, // 60s — public event info (join gate)
  { pattern: /^\/api\/events\/subdomain\//,    ttl: 60_000 }, // 60s — subdomain → event ID lookup
  { pattern: /^\/api\/events\/participants\//, ttl: 30_000 }, // 30s — participant name list (join gate)
];

// Purge expired entries every 2 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of responseCache) {
    if (entry.expiresAt <= now) responseCache.delete(key);
  }
}, 2 * 60_000).unref?.();

function getCacheRule(path) {
  return CACHE_RULES.find(r =>
    r.pattern instanceof RegExp ? r.pattern.test(path) : path.startsWith(r.pattern)
  ) || null;
}

function cacheKey(req) {
  return req.method + ':' + req.url; // include query string so ?foo=bar is separate
}

// Middleware: serve from cache on HIT, or intercept & store response on MISS
function cacheMiddleware(req, res, next) {
  if (req.method !== 'GET') return next();

  const rule = getCacheRule(req.path);
  if (!rule) return next();

  const key = cacheKey(req);
  const now  = Date.now();

  const cached = responseCache.get(key);
  if (cached && cached.expiresAt > now) {
    // Cache HIT — respond immediately, backend not touched
    res.set(cached.headers);
    res.set('X-Cache', 'HIT');
    res.set('X-Cache-Age', String(Math.floor((now - (cached.expiresAt - rule.ttl)) / 1000)));
    return res.status(cached.status).send(cached.body);
  }

  // Cache MISS — intercept the proxied response to capture and store it
  const chunks = [];
  const originalWrite = res.write.bind(res);
  const originalEnd   = res.end.bind(res);

  res.write = (chunk, encoding, callback) => {
    if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding || 'utf8'));
    return originalWrite(chunk, encoding, callback);
  };

  res.end = (chunk, encoding, callback) => {
    if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding || 'utf8'));

    // Only cache successful JSON responses
    if (res.statusCode === 200) {
      const contentType = res.getHeader('content-type') || '';
      if (contentType.includes('application/json')) {
        const body = Buffer.concat(chunks);
        const headers = {};
        (res.getHeaderNames?.() || []).forEach(h => {
          if (h !== 'x-cache' && h !== 'x-cache-age') headers[h] = res.getHeader(h);
        });
        responseCache.set(key, { body, status: 200, headers, expiresAt: now + rule.ttl });
      }
    }

    // Set header BEFORE calling originalEnd — headers cannot be set after response is sent
    if (!res.headersSent) res.set('X-Cache', 'MISS');
    return originalEnd(chunk, encoding, callback);
  };

  next();
}

// ─── Express app ──────────────────────────────────────────────────────────────
const app = express();
app.use(cookieParser());

// ─── Health endpoint ──────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  const activeBackends  = backendStatus.filter(b => b.active);
  const trippedBackends = backendStatus.filter(b => b.circuitTripped);
  const allActiveAlive  = activeBackends.every(b => b.alive);

  res.status(allActiveAlive ? 200 : 207).json({
    status:             allActiveAlive ? 'ok' : 'degraded',
    uptime:             Math.floor(process.uptime()),
    scaling: {
      activeBackendCount,
      totalBackends:    BACKENDS.length,
      trippedCount:     trippedBackends.length,
      scaleDownStreak,
      scaleDownPatience: SCALE_DOWN_PATIENCE,
      thresholds: {
        scaleUp:   SCALE_UP_THRESHOLD,
        scaleDown: SCALE_DOWN_THRESHOLD,
      },
    },
    scalingLog:         scalingLog.slice(0, 10),
    backends:           backendStatus.map((s, i) => ({
      index: i, url: s.url, active: s.active,
      alive: s.alive, latencyMs: s.latencyMs, lastPing: s.lastPing,
      requests: s.requests, activeConnections: s.activeConnections,
      circuitTripped: s.circuitTripped, consecutiveErrors: s.consecutiveErrors,
    })),
    timestamp:          new Date().toISOString(),
  });
});

// ─── Proxy instances ──────────────────────────────────────────────────────────
const proxies = BACKENDS.map((target, index) =>
  createProxyMiddleware({
    target,
    changeOrigin: true,
    ws:           true,
    proxyTimeout: 60000,
    timeout:      60000,

    on: {
      proxyReq(_proxyReq, _req, _res) {
        backendStatus[index].activeConnections++;
      },

      proxyRes(_proxyRes, req, res) {
        backendStatus[index].activeConnections = Math.max(0, backendStatus[index].activeConnections - 1);
        backendStatus[index].requests++;
        res.cookie(COOKIE_NAME, String(index), {
          maxAge:   COOKIE_MAX_AGE_MS,
          httpOnly: true,
          sameSite: 'None',
          secure:   true,
        });
      },

      error(err, _req, res) {
        backendStatus[index].activeConnections = Math.max(0, backendStatus[index].activeConnections - 1);
        recordBackendError(index);
        console.error(`  [router] proxy error → backend [${index}]: ${err.message}`);
        if (res.headersSent) return;
        res.status(502).json({
          error:   'Backend unavailable',
          message: 'This backend is temporarily unavailable. Please retry.',
        });
      },
    },
  })
);

// ─── Cache middleware (runs before proxy) ────────────────────────────────────
app.use(cacheMiddleware);

// ─── Main routing middleware ──────────────────────────────────────────────────
app.use((req, res, next) => {
  const index = pickBackendIndex(req);
  console.log(`  → [${index}${backendStatus[index].active ? '' : '!'}] ${req.method} ${req.url.slice(0, 100)}`);
  proxies[index](req, res, next);
});

// ─── HTTP server + WebSocket upgrade ─────────────────────────────────────────
const server = http.createServer(app);

server.on('upgrade', (req, socket, head) => {
  const rawCookies = req.headers.cookie || '';
  const cookies = Object.fromEntries(
    rawCookies.split(';').map(c => {
      const [k, ...v] = c.trim().split('=');
      return [k?.trim() ?? '', v.join('=')?.trim() ?? ''];
    })
  );

  let index;
  const cookieVal = cookies[COOKIE_NAME];
  if (cookieVal !== undefined) {
    const parsed = parseInt(cookieVal, 10);
    // If cookie points to active backend, use it. Otherwise re-route.
    index = (!isNaN(parsed) && parsed >= 0 && parsed < activeBackendCount)
      ? parsed
      : djb2(req.socket?.remoteAddress || '0');
  } else {
    const match = req.url.match(OBJECTID_RE);
    index = match ? djb2(match[0]) : djb2(req.socket?.remoteAddress || '0');
  }

  console.log(`  ↑ WS upgrade → backend [${index}] ${req.url.slice(0, 80)}`);
  proxies[index].upgrade(req, socket, head);
});

server.listen(PORT, () => {
  console.log(`\n  PlanIt Router listening on port ${PORT}`);
  console.log(`  ${BACKENDS.length} backends registered, 1 active to start\n`);
});