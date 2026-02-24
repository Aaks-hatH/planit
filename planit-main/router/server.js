require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const cookieParser = require('cookie-parser');
const { createProxyMiddleware } = require('http-proxy-middleware');
const axios        = require('axios');
const http         = require('http');
const { meshAuth, meshGet, meshPost, meshHeaders } = require('./mesh');

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

const SERVICE_NAME = process.env.SERVICE_NAME || 'Router';

const PORT              = process.env.PORT || 3000;
const COOKIE_NAME       = 'planit_route';
const COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const KEEPALIVE_MS      = 4 * 60 * 1000;

// ── Scaling thresholds ────────────────────────────────────────────────────────
// SCALE_UP_THRESHOLD / SCALE_DOWN_THRESHOLD now mean:
//   "requests received per backend in the 30s check window"
//   OR "avg socket connections" if the backend reports real Socket.IO sessions.
//
// Why the change from "concurrent connections":
//   The old metric sampled activeConnections at the moment the 30s timer fired.
//   Short HTTP requests (including 403s from antifraud) complete in ~100ms, so
//   they are always gone before the check fires and the counter was always 0.
//   windowRequests is a counter that increments on arrival and only resets at
//   the top of checkAndScale — it captures every request regardless of speed.
//
// Defaults: scale up at 20 req/backend/30s, scale down at 5 req/backend/30s.
const SCALE_UP_THRESHOLD      = parseInt(process.env.SCALE_UP_THRESHOLD      || '20', 10);
const SCALE_DOWN_THRESHOLD    = parseInt(process.env.SCALE_DOWN_THRESHOLD    || '5',  10);
const SCALE_DOWN_PATIENCE     = parseInt(process.env.SCALE_DOWN_PATIENCE     || '5',  10);
const CIRCUIT_TRIP_ERRORS     = parseInt(process.env.CIRCUIT_TRIP_ERRORS     || '3',  10);
const CIRCUIT_RECOVERY_CHECKS = parseInt(process.env.CIRCUIT_RECOVERY_CHECKS || '2',  10);
const SCALE_CHECK_MS          = 30 * 1000;

console.log(`\n${'═'.repeat(60)}`);
console.log(` PlanIt Router — Smart Scaling — starting`);
console.log(`${'═'.repeat(60)}`);
console.log(` Total backends : ${BACKENDS.length}`);
BACKENDS.forEach((b, i) => console.log(`   [${i}] ${backendName(i)}`));
console.log(` Scale up at    : ${SCALE_UP_THRESHOLD} requests/backend/30s  (or avg socket connections)`);
console.log(` Scale down at  : ${SCALE_DOWN_THRESHOLD} requests/backend/30s`);
console.log(`${'═'.repeat(60)}\n`);

// ─── Per-backend state ────────────────────────────────────────────────────────
const backendStatus = BACKENDS.map((url, i) => ({
  url,
  name:               backendName(i),
  alive:              true,
  latencyMs:          null,
  lastPing:           null,
  requests:           0,   // total lifetime requests (never resets)
  activeConnections:  0,   // point-in-time in-flight count (display only)
  // windowRequests: requests that ARRIVED in the current 30s check window.
  // Incremented on every proxyReq, reset at the top of every checkAndScale.
  // This catches all traffic including fast 403s that drain before any timer.
  windowRequests:     0,
  active:             false,
  coldStart:          false,
  socketConnections:  0,
  memoryPct:          null,
  circuitTripped:     false,
  consecutiveErrors:  0,
  recoveryProbes:     0,
}));

// ── Dynamic backend registry ───────────────────────────────────────────────────
const dynamicBackends = [];

// ── Scaling state ─────────────────────────────────────────────────────────────
let activeBackendCount = 1;
let scaleDownStreak    = 0;

const scalingLog = [];
function logScale(action, reason) {
  const entry = { time: new Date().toISOString(), action, reason, activeBackendCount };
  scalingLog.unshift(entry);
  if (scalingLog.length > 20) scalingLog.pop();
  console.log(`  [scale] ${action} → ${activeBackendCount} active — ${reason}`);
}

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

// FIX 2 — consistent hash: modulo BACKENDS.length (full fleet size), not
// activeBackendCount. The raw hash never changes when backends are added.
// pickHealthyBackend clamps into the active window so existing assignments
// stay on the same backend after a scale event — sticky routing survives scaling.
function djb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
    h = h >>> 0;
  }
  return h % BACKENDS.length;
}

function pickHealthyBackend(preferredIndex) {
  const clamped = preferredIndex % activeBackendCount;
  if (!backendStatus[clamped]?.circuitTripped) return clamped;
  for (let i = 0; i < activeBackendCount; i++) {
    if (!backendStatus[i].circuitTripped) return i;
  }
  for (let i = 0; i < BACKENDS.length; i++) {
    if (!backendStatus[i].circuitTripped) return i;
  }
  return clamped;
}

function pickBackendIndex(req) {
  const match = req.url.match(OBJECTID_RE);
  if (match) return pickHealthyBackend(djb2(match[0]));

  const cookie = req.cookies?.[COOKIE_NAME];
  if (cookie !== undefined) {
    const idx = parseInt(cookie, 10);
    if (!isNaN(idx) && idx >= 0 && idx < activeBackendCount) {
      return pickHealthyBackend(idx);
    }
  }

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
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
    logScale(`Circuit tripped: ${b.name}`,
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
      logScale(`Circuit restored: ${b.name}`,
        `${CIRCUIT_RECOVERY_CHECKS} consecutive healthy probes — re-added to routing`);
    }
  }
}

// ─── Auto-scaling logic ───────────────────────────────────────────────────────
// Load signal priority:
//   1. socketConnections  — real Socket.IO sessions from mesh health (production).
//   2. windowRequests     — requests proxied in this 30s window (catches everything,
//                           including fast 403s that drain before any sampler fires).
function checkAndScale() {
  const activeHealthy = backendStatus
    .slice(0, activeBackendCount)
    .filter(b => !b.circuitTripped);

  // Snapshot and reset windowRequests NOW so the next window starts clean
  // regardless of what scaling decision we make.
  const windowSnapshot = backendStatus.map(b => {
    const v = b.windowRequests;
    b.windowRequests = 0;
    return v;
  });

  if (activeHealthy.length === 0) {
    if (activeBackendCount < BACKENDS.length) {
      activeBackendCount++;
      scaleDownStreak = 0;
      updateActiveSet();
      logScale('🚨 Emergency scale-up', 'All active backends tripped — promoting next backend');
    }
    return;
  }

  const totalLoad = activeHealthy.reduce((sum, b) => {
    const idx     = backendStatus.indexOf(b);
    const sockets = b.socketConnections || 0;
    const reqs    = windowSnapshot[idx]  || 0;
    return sum + (sockets > 0 ? sockets : reqs);
  }, 0);
  const avgLoad = totalLoad / activeHealthy.length;

  const loadLabel = activeHealthy.some(b => b.socketConnections > 0)
    ? 'avg socket connections'
    : 'req/backend/window';

  // FIX 3 — reset scaleDownStreak BEFORE the early return so a blocked
  // scale-up (cold/tripped next backend) can't let a stale streak survive
  // and trigger a scale-down under high load.
  if (avgLoad >= SCALE_UP_THRESHOLD && activeBackendCount < BACKENDS.length) {
    scaleDownStreak = 0;
    const nextIndex = activeBackendCount;
    if (!backendStatus[nextIndex]?.circuitTripped && !backendStatus[nextIndex]?.coldStart) {
      activeBackendCount++;
      updateActiveSet();
      logScale(`↑ Scale up`,
        `${avgLoad.toFixed(1)} ${loadLabel} ≥ threshold ${SCALE_UP_THRESHOLD}`);
    } else {
      const why = backendStatus[nextIndex]?.coldStart ? 'cold-starting' : 'tripped';
      console.log(`  [scale] Scale-up deferred — ${backendStatus[nextIndex]?.name} is ${why}`);
    }
    return;
  }

  if (avgLoad <= SCALE_DOWN_THRESHOLD && activeBackendCount > 1) {
    scaleDownStreak++;
    if (scaleDownStreak >= SCALE_DOWN_PATIENCE) {
      activeBackendCount--;
      scaleDownStreak = 0;
      updateActiveSet();
      logScale(`↓ Scale down`,
        `avg ${avgLoad.toFixed(1)} ${loadLabel} ≤ threshold ${SCALE_DOWN_THRESHOLD} for ${SCALE_DOWN_PATIENCE} checks`);
    } else if (scaleDownStreak === 1) {
      console.log(`  [scale] Quiet (${avgLoad.toFixed(1)} avg) — will scale down after ${SCALE_DOWN_PATIENCE - scaleDownStreak} more quiet checks`);
    }
  } else if (avgLoad > SCALE_DOWN_THRESHOLD) {
    if (scaleDownStreak > 0) {
      console.log(`  [scale] Load increased (${avgLoad.toFixed(1)} avg) — reset scale-down streak`);
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

BACKENDS.forEach((_, i) => setTimeout(() => pingBackend(i), i * 2000));
setInterval(pingAll, KEEPALIVE_MS);

// ─── Response Cache ───────────────────────────────────────────────────────────
const responseCache = new Map();

const CACHE_RULES = [
  { pattern: /^\/api\/uptime\/status$/,        ttl: 30_000 },
  { pattern: /^\/api\/uptime\/ping$/,          ttl: 10_000 },
  { pattern: /^\/api\/events\/public\//,       ttl: 60_000 },
  { pattern: /^\/api\/events\/subdomain\//,    ttl: 60_000 },
  { pattern: /^\/api\/events\/participants\//, ttl: 30_000 },
];

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
  return req.method + ':' + req.url;
}

function cacheMiddleware(req, res, next) {
  if (req.method !== 'GET') return next();
  const rule = getCacheRule(req.path);
  if (!rule) return next();

  const key = cacheKey(req);
  const now = Date.now();

  const cached = responseCache.get(key);
  if (cached && cached.expiresAt > now) {
    res.set(cached.headers);
    res.set('X-Cache', 'HIT');
    res.set('X-Cache-Age', String(Math.floor((now - (cached.expiresAt - rule.ttl)) / 1000)));
    return res.status(cached.status).send(cached.body);
  }

  const chunks = [];
  const originalWrite = res.write.bind(res);
  const originalEnd   = res.end.bind(res);

  res.write = (chunk, encoding, callback) => {
    if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding || 'utf8'));
    return originalWrite(chunk, encoding, callback);
  };

  res.end = (chunk, encoding, callback) => {
    if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding || 'utf8'));
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
    if (!res.headersSent) res.set('X-Cache', 'MISS');
    return originalEnd(chunk, encoding, callback);
  };

  next();
}

// ─── Express app ──────────────────────────────────────────────────────────────
const app = express();
app.use(cookieParser());

// ─── CORS ─────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map(o => o.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-mesh-secret', 'x-event-token'],
}));

// ─── Public health endpoint ───────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  const activeBackends  = backendStatus.filter(b => b.active);
  const trippedBackends = backendStatus.filter(b => b.circuitTripped);
  const allActiveAlive  = activeBackends.every(b => b.alive);

  res.status(allActiveAlive ? 200 : 207).json({
    status:  allActiveAlive ? 'ok' : 'degraded',
    uptime:  Math.floor(process.uptime()),
    scaling: {
      activeCount:  activeBackendCount,
      totalCount:   BACKENDS.length,
      trippedCount: trippedBackends.length,
    },
    backends: backendStatus.map(s => ({
      name:           s.name,
      active:         s.active,
      alive:          s.alive,
      latencyMs:      s.latencyMs,
      circuitTripped: s.circuitTripped,
      coldStart:      s.coldStart,
    })),
    timestamp: new Date().toISOString(),
  });
});

app.get('/mesh/status', meshAuth(SERVICE_NAME), (_req, res) => {
  res.json({
    service: SERVICE_NAME,
    uptime:  Math.floor(process.uptime()),
    scaling: {
      activeBackendCount,
      totalBackends:     BACKENDS.length + dynamicBackends.length,
      trippedCount:      backendStatus.filter(b => b.circuitTripped).length,
      scaleDownStreak,
      scaleDownPatience: SCALE_DOWN_PATIENCE,
      thresholds: {
        scaleUp:   SCALE_UP_THRESHOLD,
        scaleDown: SCALE_DOWN_THRESHOLD,
        unit:      'requests per backend per 30s window (or socket connections if > 0)',
      },
    },
    scalingLog: scalingLog.slice(0, 20),
    backends: backendStatus.map((s, i) => ({
      index:              i,
      name:               s.name,
      active:             s.active,
      alive:              s.alive,
      latencyMs:          s.latencyMs,
      lastPing:           s.lastPing,
      requests:           s.requests,
      activeConnections:  s.activeConnections,
      windowRequests:     s.windowRequests,
      socketConnections:  s.socketConnections,
      memoryPct:          s.memoryPct,
      coldStart:          s.coldStart,
      circuitTripped:     s.circuitTripped,
      consecutiveErrors:  s.consecutiveErrors,
    })),
    dynamicBackends: dynamicBackends.map(d => ({
      name:         d.name,
      region:       d.region,
      registeredAt: d.registeredAt,
    })),
    timestamp: new Date().toISOString(),
  });
});

app.post('/mesh/register', meshAuth(SERVICE_NAME), express.json(), (req, res) => {
  const { url, name, region } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });

  const existingIdx = BACKENDS.findIndex(b => b === url || b === url.replace(/\/$/, ''));
  if (existingIdx >= 0) {
    if (name)   backendStatus[existingIdx].name   = name;
    if (region) backendStatus[existingIdx].region = region;
    console.log(`[mesh] Register: ${name || backendStatus[existingIdx].name} — already in fleet at index ${existingIdx}`);
    return res.json({ ok: true, joined: false, reason: 'already registered', index: existingIdx });
  }

  const already = dynamicBackends.find(d => d.url === url);
  if (already) {
    already.name       = name || already.name;
    already.region     = region || already.region;
    already.lastSeenAt = new Date().toISOString();
    console.log(`[mesh] Register: ${already.name} re-announced (dynamic pool)`);
    return res.json({ ok: true, joined: false, reason: 'already in dynamic pool' });
  }

  const entry = {
    url,
    name:         name || `Dynamic-${dynamicBackends.length + 1}`,
    region:       region || null,
    registeredAt: new Date().toISOString(),
    lastSeenAt:   new Date().toISOString(),
  };
  dynamicBackends.push(entry);
  BACKENDS.push(url);
  backendStatus.push({
    url,
    name:               entry.name,
    alive:              true,
    latencyMs:          null,
    lastPing:           null,
    requests:           0,
    activeConnections:  0,
    windowRequests:     0,
    active:             false,
    coldStart:          true,
    socketConnections:  0,
    memoryPct:          null,
    circuitTripped:     false,
    consecutiveErrors:  0,
    recoveryProbes:     0,
  });

  // FIX 4 — capture index at creation time, not at callback invocation time.
  const capturedIndex = backendStatus.length - 1;

  proxies.push(createProxyMiddleware({
    target: url,
    changeOrigin: true,
    ws: true,
    proxyTimeout: 60000,
    timeout: 60000,
    on: {
      proxyReq(_pReq, req, _res) {
        backendStatus[capturedIndex].activeConnections++;
        backendStatus[capturedIndex].windowRequests++;
        req._proxyFinished = false;
        req.on('close', () => {
          if (!req._proxyFinished) {
            backendStatus[capturedIndex].activeConnections =
              Math.max(0, backendStatus[capturedIndex].activeConnections - 1);
          }
        });
      },
      proxyRes(_pRes, req, _res) {
        req._proxyFinished = true;
        backendStatus[capturedIndex].activeConnections =
          Math.max(0, backendStatus[capturedIndex].activeConnections - 1);
        backendStatus[capturedIndex].requests++;
      },
      error(_err, req, res) {
        req._proxyFinished = true;
        backendStatus[capturedIndex].activeConnections =
          Math.max(0, backendStatus[capturedIndex].activeConnections - 1);
        recordBackendError(capturedIndex);
        if (!res.headersSent) res.status(502).json({ error: 'Backend unavailable' });
      },
    },
  }));

  pingBackend(capturedIndex);
  logScale(`+ Dynamic join: ${entry.name}`, `backend announced itself from ${url.split('/')[2]}`);
  console.log(`[mesh] Fleet now: ${backendStatus.map(b => b.name).join(', ')}`);
  res.json({ ok: true, joined: true, name: entry.name, totalBackends: BACKENDS.length });
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
      proxyReq(_proxyReq, req, _res) {
        backendStatus[index].activeConnections++;
        // FIX 1 — core scaling fix: count arrival, not in-flight duration.
        // windowRequests resets every 30s in checkAndScale, so even requests
        // that complete in 50ms are counted. The old activeConnections counter
        // was always 0 by the time the timer fired.
        backendStatus[index].windowRequests++;

        // FIX 6 — prevent activeConnections leaking on early client disconnect.
        req._proxyFinished = false;
        req.on('close', () => {
          if (!req._proxyFinished) {
            backendStatus[index].activeConnections =
              Math.max(0, backendStatus[index].activeConnections - 1);
          }
        });
      },

      proxyRes(_proxyRes, req, res) {
        req._proxyFinished = true;
        backendStatus[index].activeConnections =
          Math.max(0, backendStatus[index].activeConnections - 1);
        backendStatus[index].requests++;
        res.cookie(COOKIE_NAME, String(index), {
          maxAge:   COOKIE_MAX_AGE_MS,
          httpOnly: true,
          sameSite: 'None',
          secure:   true,
        });
      },

      error(err, req, res) {
        req._proxyFinished = true;
        backendStatus[index].activeConnections =
          Math.max(0, backendStatus[index].activeConnections - 1);
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

// ─── Cache middleware (runs before proxy) ─────────────────────────────────────
app.use(cacheMiddleware);

// ─── Main routing middleware ──────────────────────────────────────────────────
app.use((req, res, next) => {
  const index = pickBackendIndex(req);
  const b = backendStatus[index];
  console.log(`  → [${b.name}${b.active ? '' : '!'}] ${req.method} ${req.url.slice(0, 100)}`);
  proxies[index](req, res, next);
});

// ─── HTTP server + WebSocket upgrade ─────────────────────────────────────────
const server = http.createServer(app);

server.on('upgrade', (req, socket, head) => {
  // FIX 5 — reuse pickBackendIndex so WebSocket upgrades go through the same
  // circuit-breaker aware routing as HTTP requests. The old code called djb2
  // directly and never checked circuitTripped, so tripped backends still got WS.
  const rawCookies = req.headers.cookie || '';
  req.cookies = Object.fromEntries(
    rawCookies.split(';').map(c => {
      const [k, ...v] = c.trim().split('=');
      return [k?.trim() ?? '', v.join('=')?.trim() ?? ''];
    })
  );

  const index = pickBackendIndex(req);
  console.log(`  ↑ WS upgrade → ${backendStatus[index]?.name || index} ${req.url.slice(0, 80)}`);
  proxies[index].upgrade(req, socket, head);
});

server.listen(PORT, () => {
  console.log(`\n  PlanIt Router listening on port ${PORT}`);
  console.log(`  ${BACKENDS.length} backends registered, 1 active to start\n`);
});
