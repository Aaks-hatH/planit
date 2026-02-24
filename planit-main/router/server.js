require('dotenv').config();
const express      = require('express');
const cors         = require('cors');
const cookieParser = require('cookie-parser');
const { createProxyMiddleware } = require('http-proxy-middleware');
const axios        = require('axios');
const http         = require('http');
const { meshAuth, meshGet, meshPost } = require('./mesh');

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
const PORT         = process.env.PORT || 3000;
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
  const avgLoad = totalLoad / activeHealthy.length;
  const loadLabel = activeHealthy.some(b => b.socketConnections > 0) ? 'avg sockets' : 'req/window';

  // Scale up
  if (avgLoad >= SCALE_UP_THRESHOLD && activeBackendCount < BACKENDS.length) {
    scaleDownStreak = 0;
    const next = backendStatus[activeBackendCount];
    if (next && !next.circuitTripped && !next.coldStart) {
      activeBackendCount++;
      updateActiveSet();
      logScale(`↑ Scale up`, `${avgLoad.toFixed(1)} ${loadLabel} ≥ ${SCALE_UP_THRESHOLD}`);
    } else if (next) {
      console.log(`  [scale] Deferred — ${next.name} is ${next.coldStart ? 'cold' : 'tripped'}`);
    }
    return;
  }

  // Scale down (suppressed during boost)
  if (!boost && avgLoad <= SCALE_DOWN_THRESHOLD && activeBackendCount > 1) {
    scaleDownStreak++;
    if (scaleDownStreak >= SCALE_DOWN_PATIENCE) {
      activeBackendCount--;
      scaleDownStreak = 0;
      updateActiveSet();
      logScale(`↓ Scale down`, `avg ${avgLoad.toFixed(1)} ${loadLabel} ≤ ${SCALE_DOWN_THRESHOLD} for ${SCALE_DOWN_PATIENCE} checks`);
    }
  } else if (!boost) {
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
  { pattern: /^\/api\/events\/public\//,       ttl: 60_000 },
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
  if (!rule) return next();
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
