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

const FALLBACK_NAMES  = ['Alpha','Bravo','Charlie','Delta','Echo','Foxtrot','Golf','Hotel'];
const customLabels    = (process.env.BACKEND_LABELS || '').split(',').map(s => s.trim()).filter(Boolean);
function backendName(i) {
  return customLabels[i] || FALLBACK_NAMES[i] || `Backend-${i + 1}`;
}

// SERVICE_NAME identifies this router in mesh logs
const SERVICE_NAME = process.env.SERVICE_NAME || 'Router';

const PORT              = process.env.PORT || 3000;
const COOKIE_NAME       = 'planit_route';
const COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const KEEPALIVE_MS      = 4 * 60 * 1000;

const SCALE_UP_THRESHOLD      = parseInt(process.env.SCALE_UP_THRESHOLD      || '20', 10);
const SCALE_DOWN_THRESHOLD    = parseInt(process.env.SCALE_DOWN_THRESHOLD    || '5',  10);
const SCALE_DOWN_PATIENCE     = parseInt(process.env.SCALE_DOWN_PATIENCE     || '5',  10);
const CIRCUIT_TRIP_ERRORS     = parseInt(process.env.CIRCUIT_TRIP_ERRORS     || '3',  10);
const CIRCUIT_RECOVERY_CHECKS = parseInt(process.env.CIRCUIT_RECOVERY_CHECKS || '2',  10);
const SCALE_CHECK_MS          = 30 * 1000;

// How many samples to keep in the rolling window for activeConnections.
// Sampled every 2s → 15 samples covers the full 30s check interval.
const CONN_SAMPLE_INTERVAL_MS = 2_000;
const CONN_SAMPLE_WINDOW      = Math.ceil(SCALE_CHECK_MS / CONN_SAMPLE_INTERVAL_MS); // 15

console.log(`\n${'═'.repeat(60)}`);
console.log(` PlanIt Router — Smart Scaling — starting`);
console.log(`${'═'.repeat(60)}`);
console.log(` Total backends : ${BACKENDS.length}`);
BACKENDS.forEach((b, i) => console.log(`   [${i}] ${backendName(i)}`));
console.log(` Scale up at    : ${SCALE_UP_THRESHOLD} avg connections`);
console.log(` Scale down at  : ${SCALE_DOWN_THRESHOLD} avg connections`);
console.log(`${'═'.repeat(60)}\n`);

// ─── Per-backend state ────────────────────────────────────────────────────────
const backendStatus = BACKENDS.map((url, i) => ({
  url,
  name:               backendName(i),
  alive:              true,
  latencyMs:          null,
  lastPing:           null,
  requests:           0,            // total lifetime requests
  activeConnections:  0,            // currently in-flight requests (point-in-time)
  // FIX 1: rolling window of activeConnections samples taken every 2s.
  // checkAndScale uses the window average instead of a single point-in-time
  // snapshot, so short-lived requests that finish in <500ms are captured even
  // though they're all gone by the time the 30s check fires.
  connSamples:        [],
  active:             false,        // is this backend in the active routing set?
  coldStart:          false,        // true for first 90s after backend restart
  socketConnections:  0,            // live socket.io connections (from mesh health)
  memoryPct:          null,         // heap usage pct (from mesh health)
  // Circuit breaker state
  circuitTripped:     false,        // true = backend removed from routing due to errors
  consecutiveErrors:  0,            // errors since last success
  recoveryProbes:     0,            // successful health checks while tripped
}));

// ── Dynamic backend registry ───────────────────────────────────────────────────
const dynamicBackends = [];

// ── Scaling state ─────────────────────────────────────────────────────────────
let activeBackendCount = 1;
let scaleDownStreak    = 0;

// scalingLog: keep last 20 scaling decisions for the /health endpoint
const scalingLog = [];
function logScale(action, reason) {
  const entry = { time: new Date().toISOString(), action, reason, activeBackendCount };
  scalingLog.unshift(entry);
  if (scalingLog.length > 20) scalingLog.pop();
  console.log(`  [scale] ${action} → ${activeBackendCount} active — ${reason}`);
}

// Mark which backends are in the active set
function updateActiveSet() {
  backendStatus.forEach((b, i) => {
    b.active = i < activeBackendCount && !b.circuitTripped;
  });
  const activeList = backendStatus
    .map((b, i) => b.active ? i : null).filter(i => i !== null);
  console.log(`  [scale] Active set: [${activeList.join(', ')}] of ${BACKENDS.length} total`);
}
updateActiveSet();

// ─── FIX 1: Rolling connection sampler ───────────────────────────────────────
// Snapshot activeConnections for every backend every 2 seconds into a sliding
// window. checkAndScale reads the window average rather than the live counter,
// so bursts of short-lived requests are seen even after they've all finished.
setInterval(() => {
  backendStatus.forEach(b => {
    b.connSamples.push(b.activeConnections);
    if (b.connSamples.length > CONN_SAMPLE_WINDOW) b.connSamples.shift();
  });
}, CONN_SAMPLE_INTERVAL_MS).unref?.();

function rollingAvgConnections(b) {
  if (b.connSamples.length === 0) return b.activeConnections;
  return b.connSamples.reduce((s, v) => s + v, 0) / b.connSamples.length;
}

// ─── FIX 2: Consistent hash — modulo BACKENDS.length, not activeBackendCount ─
// Using activeBackendCount as the modulus meant every event ID and IP remapped
// to a different backend on each scale event, breaking sticky routing entirely.
// Hashing to the full fleet size and then clamping into the active window keeps
// existing assignments stable when new backends are added.
function djb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
    h = h >>> 0;
  }
  // Always modulo the TOTAL backend count so the raw hash never changes.
  // pickHealthyBackend then handles clamping into the active window.
  return h % BACKENDS.length;
}

// Pick a backend — skips tripped (circuit-broken) backends automatically.
// If the preferred index is outside the active window, wraps into it.
function pickHealthyBackend(preferredIndex) {
  // Clamp into the active window first
  const clamped = preferredIndex % activeBackendCount;

  // If clamped backend is healthy, use it
  if (!backendStatus[clamped]?.circuitTripped) return clamped;

  // Otherwise find the next healthy backend in the active set
  for (let i = 0; i < activeBackendCount; i++) {
    if (!backendStatus[i].circuitTripped) return i;
  }
  // All active backends are tripped — try any backend as last resort
  for (let i = 0; i < BACKENDS.length; i++) {
    if (!backendStatus[i].circuitTripped) return i;
  }
  // Truly all tripped — return clamped anyway (will fail, but cleanly)
  return clamped;
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
function checkAndScale() {
  const activeHealthy = backendStatus
    .slice(0, activeBackendCount)
    .filter(b => !b.circuitTripped);

  if (activeHealthy.length === 0) {
    if (activeBackendCount < BACKENDS.length) {
      activeBackendCount++;
      scaleDownStreak = 0;
      updateActiveSet();
      logScale('🚨 Emergency scale-up', 'All active backends tripped — promoting next backend');
    }
    return;
  }

  // FIX 1 (continued): use rolling window average instead of live snapshot.
  // This catches load from short-lived requests that finished before this check.
  const totalConnections = activeHealthy.reduce((sum, b) => {
    const sockets = b.socketConnections || 0;
    // Prefer real socket count; fall back to rolling window avg of proxy counter
    return sum + (sockets > 0 ? sockets : rollingAvgConnections(b));
  }, 0);
  const avgConnections = totalConnections / activeHealthy.length;

  // FIX 3: Reset scaleDownStreak BEFORE the early return so that a blocked
  // scale-up (next backend is cold/tripped) doesn't let a stale streak survive
  // into the scale-down check and trigger a scale-down under load.
  if (avgConnections >= SCALE_UP_THRESHOLD && activeBackendCount < BACKENDS.length) {
    scaleDownStreak = 0; // ← moved outside the inner if
    const nextIndex = activeBackendCount;
    if (!backendStatus[nextIndex]?.circuitTripped && !backendStatus[nextIndex]?.coldStart) {
      activeBackendCount++;
      updateActiveSet();
      logScale(`↑ Scale up`, `avg ${avgConnections.toFixed(1)} connections ≥ threshold ${SCALE_UP_THRESHOLD}`);
    } else {
      console.log(`  [scale] Scale-up deferred — backend [${nextIndex}] is ${backendStatus[nextIndex]?.coldStart ? 'cold-starting' : 'tripped'}`);
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
    } else if (scaleDownStreak === 1) {
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

  const key  = cacheKey(req);
  const now  = Date.now();

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

// ─── ObjectId regex ───────────────────────────────────────────────────────────
const OBJECTID_RE = /[a-f0-9]{24}/i;

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
      rollingAvgConn:     Math.round(rollingAvgConnections(s) * 10) / 10,
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

  if (!url) {
    return res.status(400).json({ error: 'url is required' });
  }

  const existingIdx = BACKENDS.findIndex(b => b === url || b === url.replace(/\/$/, ''));
  if (existingIdx >= 0) {
    if (name)   backendStatus[existingIdx].name   = name;
    if (region) backendStatus[existingIdx].region = region;
    console.log(`[mesh] Register: ${name || backendStatus[existingIdx].name} (${region || 'no region'}) — already in fleet at index ${existingIdx}`);
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
    connSamples:        [],           // FIX 1: rolling window for new dynamic backends
    active:             false,
    coldStart:          true,
    socketConnections:  0,
    memoryPct:          null,
    circuitTripped:     false,
    consecutiveErrors:  0,
    recoveryProbes:     0,
  });

  // FIX 4: Capture the index at creation time so proxy callbacks always
  // reference the correct backend even if more dynamic backends join later.
  // The old code used `backendStatus[backendStatus.length - 1]` at call time,
  // which would point to a different (newer) backend after another join.
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
        // FIX 6: decrement on early client disconnect
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
        // FIX 6: If the client disconnects before the backend responds,
        // neither proxyRes nor error fires — decrement here to prevent the
        // counter from leaking upward and causing phantom scale-up signals.
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
        backendStatus[index].activeConnections = Math.max(0, backendStatus[index].activeConnections - 1);
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
  // FIX 5: The old upgrade handler duplicated routing logic manually and never
  // called pickHealthyBackend, so WebSocket upgrades could land on tripped
  // backends. Now we reuse pickBackendIndex (which calls pickHealthyBackend
  // internally) exactly like the HTTP path does.
  //
  // We fake a minimal req-like object because the raw upgrade req doesn't have
  // cookies parsed yet — parse them inline.
  const rawCookies = req.headers.cookie || '';
  const cookieMap = Object.fromEntries(
    rawCookies.split(';').map(c => {
      const [k, ...v] = c.trim().split('=');
      return [k?.trim() ?? '', v.join('=')?.trim() ?? ''];
    })
  );

  // Attach parsed cookies so pickBackendIndex can read them
  req.cookies = cookieMap;

  const index = pickBackendIndex(req);

  console.log(`  ↑ WS upgrade → ${backendStatus[index]?.name || index} ${req.url.slice(0, 80)}`);
  proxies[index].upgrade(req, socket, head);
});

server.listen(PORT, () => {
  console.log(`\n  PlanIt Router listening on port ${PORT}`);
  console.log(`  ${BACKENDS.length} backends registered, 1 active to start\n`);
});
