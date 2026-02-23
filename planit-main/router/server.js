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
// We can't spin Render instances up/down, but we CAN concentrate traffic onto
// fewer backends when load is low. This keeps most backends at zero real load
// (just keepalive pings) while 1-2 handle all actual users. As traffic grows,
// the router automatically spreads load across more backends.
//
// How it works:
//   - Each backend tracks active connections (requests in flight)
//   - activeBackendCount = how many backends are currently accepting real traffic
//   - When all active backends are busy (avg connections > SCALE_UP_THRESHOLD),
//     activeBackendCount increases to include another backend
//   - When active backends are mostly idle (avg < SCALE_DOWN_THRESHOLD for
//     SCALE_DOWN_PATIENCE consecutive checks), activeBackendCount decreases
//   - Inactive backends still get keepalive pings so they never sleep —
//     they're warm and ready instantly when needed
//
const SCALE_UP_THRESHOLD   = parseInt(process.env.SCALE_UP_THRESHOLD   || '20', 10); // avg active connections
const SCALE_DOWN_THRESHOLD = parseInt(process.env.SCALE_DOWN_THRESHOLD || '5',  10); // avg active connections
const SCALE_DOWN_PATIENCE  = parseInt(process.env.SCALE_DOWN_PATIENCE  || '3',  10); // consecutive checks before scaling down
const SCALE_CHECK_MS       = 30 * 1000; // check every 30 seconds

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
  alive:             true,
  latencyMs:         null,
  lastPing:          null,
  requests:          0,           // total lifetime requests
  activeConnections: 0,           // currently in-flight requests
  active:            false,       // is this backend currently receiving real traffic?
}));

// Start with just 1 active backend — scale up from there
let activeBackendCount  = 1;
let scaleDownStreak     = 0; // consecutive checks below SCALE_DOWN_THRESHOLD

// Mark initial active backends
function updateActiveSet() {
  const count = Math.min(activeBackendCount, BACKENDS.length);
  backendStatus.forEach((b, i) => { b.active = i < count; });
  console.log(`  [scale] Active backends: ${count}/${BACKENDS.length} — [${backendStatus.filter(b => b.active).map((_, i) => i).join(', ')}]`);
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
  // IMPORTANT: hash within active backends only, not all backends
  // This ensures sticky routing still works when activeBackendCount changes —
  // existing cookies are re-mapped to the active set
  return h % activeBackendCount;
}

function pickBackendIndex(req) {
  // 1. EventId in URL — hashed to active set
  const match = req.url.match(OBJECTID_RE);
  if (match) return djb2(match[0]);

  // 2. Sticky cookie — validate it's still in active set
  const cookie = req.cookies?.[COOKIE_NAME];
  if (cookie !== undefined) {
    const idx = parseInt(cookie, 10);
    if (!isNaN(idx) && idx >= 0 && idx < activeBackendCount) return idx;
    // Cookie points to an inactive backend — reroute via IP
  }

  // 3. IP-based fallback within active set
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
           || req.socket?.remoteAddress || '0';
  return djb2(ip);
}

// ─── Auto-scaling logic ───────────────────────────────────────────────────────
function checkAndScale() {
  const active = backendStatus.slice(0, activeBackendCount);
  const avgConnections = active.reduce((sum, b) => sum + b.activeConnections, 0) / active.length;

  // Scale UP — if active backends are getting busy and we have more available
  if (avgConnections >= SCALE_UP_THRESHOLD && activeBackendCount < BACKENDS.length) {
    activeBackendCount++;
    scaleDownStreak = 0;
    updateActiveSet();
    console.log(`  [scale] ↑ Scaled UP to ${activeBackendCount} backends (avg ${avgConnections.toFixed(1)} connections)`);
    return;
  }

  // Scale DOWN — only if consistently quiet AND we have more than 1 active
  if (avgConnections <= SCALE_DOWN_THRESHOLD && activeBackendCount > 1) {
    scaleDownStreak++;
    if (scaleDownStreak >= SCALE_DOWN_PATIENCE) {
      activeBackendCount--;
      scaleDownStreak = 0;
      updateActiveSet();
      console.log(`  [scale] ↓ Scaled DOWN to ${activeBackendCount} backends (avg ${avgConnections.toFixed(1)} connections)`);
    }
  } else {
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
    backendStatus[index].alive     = true;
    backendStatus[index].latencyMs = Date.now() - start;
    backendStatus[index].lastPing  = new Date().toISOString();
  } catch {
    backendStatus[index].alive     = false;
    backendStatus[index].latencyMs = null;
    backendStatus[index].lastPing  = new Date().toISOString();
    console.warn(`  [router] ⚠ backend [${index}] ${url} is not responding`);
  }
}

async function pingAll() {
  await Promise.all(BACKENDS.map((_, i) => pingBackend(i)));
}

BACKENDS.forEach((_, i) => setTimeout(() => pingBackend(i), i * 2000));
setInterval(pingAll, KEEPALIVE_MS);

// ─── Express app ──────────────────────────────────────────────────────────────
const app = express();
app.use(cookieParser());

// ─── Health endpoint ──────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  const allActiveAlive = backendStatus.slice(0, activeBackendCount).every(b => b.alive);
  res.status(allActiveAlive ? 200 : 207).json({
    status:             allActiveAlive ? 'ok' : 'degraded',
    uptime:             Math.floor(process.uptime()),
    activeBackendCount,
    totalBackends:      BACKENDS.length,
    backends:           backendStatus.map((s, i) => ({ index: i, ...s })),
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
        backendStatus[index].alive = false;
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
