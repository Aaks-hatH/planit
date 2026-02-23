require('dotenv').config();
const express      = require('express');
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
const SCALE_DOWN_PATIENCE     = parseInt(process.env.SCALE_DOWN_PATIENCE     || '5',  10); // raised from 3 — less jittery
const CIRCUIT_TRIP_ERRORS     = parseInt(process.env.CIRCUIT_TRIP_ERRORS     || '3',  10);
const CIRCUIT_RECOVERY_CHECKS = parseInt(process.env.CIRCUIT_RECOVERY_CHECKS || '2',  10);
const SCALE_CHECK_MS          = 30 * 1000;

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
  activeConnections:  0,            // currently in-flight requests
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
// Backends can announce themselves on startup via POST /mesh/register.
// This allows adding new backends without restarting the router.
// dynamicBackends: array of { url, name, region, registeredAt }
const dynamicBackends = [];

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

  // Use real socketConnections from mesh health if available, else fall back to
  // the proxy-tracked activeConnections counter.
  const totalConnections = activeHealthy.reduce((sum, b) => {
    const sockets = b.socketConnections || 0;
    const proxy   = b.activeConnections || 0;
    return sum + (sockets > 0 ? sockets : proxy);
  }, 0);
  const avgConnections   = totalConnections / activeHealthy.length;

  // Scale UP — active backends are busy AND we have more available AND they're healthy
  if (avgConnections >= SCALE_UP_THRESHOLD && activeBackendCount < BACKENDS.length) {
    // Only scale up to a backend that isn't tripped and isn't cold-starting
    const nextIndex = activeBackendCount;
    if (!backendStatus[nextIndex]?.circuitTripped && !backendStatus[nextIndex]?.coldStart) {
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
// ALL backends get pinged via the mesh health endpoint — not just active ones.
// Inactive backends must stay warm so they can be promoted instantly.
// We use the mesh endpoint to get real socket counts + memory for scaling decisions.
async function pingBackend(index) {
  const b     = backendStatus[index];
  const start = Date.now();

  // Try the rich mesh health endpoint first — falls back to public /api/health
  const meshResult = await meshGet(SERVICE_NAME, `${b.url}/api/mesh/health`, { timeout: 10000 });

  b.latencyMs = Date.now() - start;
  b.lastPing  = new Date().toISOString();

  if (meshResult.ok) {
    const d = meshResult.data;
    // Enrich backend status with real data from the backend itself
    b.socketConnections = d.socketConnections ?? 0;
    b.memoryPct         = d.memory?.pct       ?? null;
    b.coldStart         = d.coldStart          ?? false;
    recordBackendSuccess(index);

    // Confirm back to the backend that we've seen it (non-blocking)
    meshPost(SERVICE_NAME, `${b.url}/api/mesh/seen`, {
      registeredAs: b.name,
      activeInFleet: backendStatus.filter(s => s.active).length,
    }).catch(() => {}); // fire-and-forget
  } else {
    // Mesh ping failed — try public health as fallback
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

// ─── Public health endpoint ───────────────────────────────────────────────────
// URLs are NEVER exposed here. Only names, status, and aggregate counts.
// For full internal state use GET /mesh/status (mesh auth required).
app.get('/health', (_req, res) => {
  const activeBackends  = backendStatus.filter(b => b.active);
  const trippedBackends = backendStatus.filter(b => b.circuitTripped);
  const allActiveAlive  = activeBackends.every(b => b.alive);

  res.status(allActiveAlive ? 200 : 207).json({
    status:     allActiveAlive ? 'ok' : 'degraded',
    uptime:     Math.floor(process.uptime()),
    scaling: {
      activeCount:  activeBackendCount,
      totalCount:   BACKENDS.length,
      trippedCount: trippedBackends.length,
    },
    // Names and health only — no URLs ever exposed publicly
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
    service:    SERVICE_NAME,
    uptime:     Math.floor(process.uptime()),
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
    // Full backend detail — names, status, metrics, no URLs
    backends: backendStatus.map((s, i) => ({
      index:              i,
      name:               s.name,
      active:             s.active,
      alive:              s.alive,
      latencyMs:          s.latencyMs,
      lastPing:           s.lastPing,
      requests:           s.requests,
      activeConnections:  s.activeConnections,
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

  // Check if this backend is already known from env config
  const existingIdx = BACKENDS.findIndex(b => b === url || b === url.replace(/\/$/, ''));
  if (existingIdx >= 0) {
    // Known backend — update its display name and region if provided
    if (name)   backendStatus[existingIdx].name   = name;
    if (region) backendStatus[existingIdx].region = region;
    console.log(`[mesh] Register: ${name || backendStatus[existingIdx].name} (${region || 'no region'}) — already in fleet at index ${existingIdx}`);
    return res.json({ ok: true, joined: false, reason: 'already registered', index: existingIdx });
  }

  // New backend — not in BACKEND_URLS env. Add to dynamic pool.
  const already = dynamicBackends.find(d => d.url === url);
  if (already) {
    already.name       = name || already.name;
    already.region     = region || already.region;
    already.lastSeenAt = new Date().toISOString();
    console.log(`[mesh] Register: ${already.name} re-announced (dynamic pool)`);
    return res.json({ ok: true, joined: false, reason: 'already in dynamic pool' });
  }

  // First-time join
  const entry = { url, name: name || `Dynamic-${dynamicBackends.length + 1}`, region: region || null, registeredAt: new Date().toISOString(), lastSeenAt: new Date().toISOString() };
  dynamicBackends.push(entry);

  // Add to BACKENDS array and create a status entry so routing + pinging works
  BACKENDS.push(url);
  backendStatus.push({
    url,
    name:               entry.name,
    alive:              true,
    latencyMs:          null,
    lastPing:           null,
    requests:           0,
    activeConnections:  0,
    active:             false,
    coldStart:          true,
    socketConnections:  0,
    memoryPct:          null,
    circuitTripped:     false,
    consecutiveErrors:  0,
    recoveryProbes:     0,
  });

  // Create a proxy for the new backend
  const { createProxyMiddleware } = require('http-proxy-middleware');
  proxies.push(createProxyMiddleware({
    target: url,
    changeOrigin: true,
    ws: true,
    proxyTimeout: 60000,
    timeout: 60000,
    on: {
      proxyReq(_pReq, _req, _res) { backendStatus[backendStatus.length - 1].activeConnections++; },
      proxyRes(_pRes, _req, _res) { const b = backendStatus[backendStatus.length - 1]; b.activeConnections = Math.max(0, b.activeConnections - 1); b.requests++; },
      error(_err, _req, res)     { const b = backendStatus[backendStatus.length - 1]; b.activeConnections = Math.max(0, b.activeConnections - 1); recordBackendError(backendStatus.length - 1); if (!res.headersSent) res.status(502).json({ error: 'Backend unavailable' }); },
    },
  }));

  // Immediately ping the new backend to warm it up
  pingBackend(backendStatus.length - 1);

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
  const b = backendStatus[index];
  console.log(`  → [${b.name}${b.active ? '' : '!'}] ${req.method} ${req.url.slice(0, 100)}`);
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

  console.log(`  ↑ WS upgrade → ${backendStatus[index]?.name || index} ${req.url.slice(0, 80)}`);
  proxies[index].upgrade(req, socket, head);
});

server.listen(PORT, () => {
  console.log(`\n  PlanIt Router listening on port ${PORT}`);
  console.log(`  ${BACKENDS.length} backends registered, 1 active to start\n`);
});
