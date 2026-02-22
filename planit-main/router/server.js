require('dotenv').config();
const express      = require('express');
const cookieParser = require('cookie-parser');
const { createProxyMiddleware } = require('http-proxy-middleware');
const axios        = require('axios');
const http         = require('http');

// ─── Config ──────────────────────────────────────────────────────────────────
//
// BACKEND_URLS = comma-separated list of your Render backend URLs
// Example with 10 backends:
//   https://planit-be-1.onrender.com,https://planit-be-2.onrender.com,...
//
const BACKENDS = (process.env.BACKEND_URLS || '')
  .split(',')
  .map(u => u.trim())
  .filter(Boolean);

if (BACKENDS.length === 0) {
  console.error('\n  FATAL: BACKEND_URLS env var is not set.\n');
  process.exit(1);
}

const PORT              = process.env.PORT || 3000;
const COOKIE_NAME       = 'planit_route';
const COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours — covers full event sessions
const KEEPALIVE_MS      = 4 * 60 * 1000;        // ping every 4 min — Render sleeps at 15 min

console.log(`\n${'═'.repeat(60)}`);
console.log(` PlanIt Router — starting`);
console.log(`${'═'.repeat(60)}`);
console.log(` Backends (${BACKENDS.length}):`);
BACKENDS.forEach((b, i) => console.log(`   [${i}] ${b}`));
console.log(`${'═'.repeat(60)}\n`);

// ─── Track per-backend health & stats ────────────────────────────────────────

const backendStatus = BACKENDS.map((url) => ({
  url,
  alive:     true,
  latencyMs: null,
  lastPing:  null,
  requests:  0,
}));

// ─── Routing strategy — event-based sticky routing ───────────────────────────
//
// THE PROBLEM: Socket.IO rooms are in-memory per process. If user A connects
// to backend-3 and user B connects to backend-7 for the same event, they are
// in different rooms and cannot see each other's messages.
//
// THE SOLUTION: Hash the eventId (MongoDB ObjectId, 24 hex chars) to always
// pick the same backend for all users in the same event. Everyone in event X
// lands on the same instance → same socket room → chat works perfectly.
//
// Routing priority:
//   1. eventId in URL path  → hash(eventId) % numBackends  (covers all /api/events/:id routes)
//   2. planit_route cookie  → honour sticky assignment      (covers socket handshake + polling)
//   3. Client IP            → consistent per-device fallback
//

const OBJECTID_RE = /[a-f0-9]{24}/i; // MongoDB ObjectId

function djb2(str) {
  // Fast, well-distributed non-cryptographic hash
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
    h = h >>> 0; // keep unsigned 32-bit
  }
  return h % BACKENDS.length;
}

function pickBackendIndex(req) {
  // 1. EventId from URL — most reliable, covers all event-scoped requests
  const match = req.url.match(OBJECTID_RE);
  if (match) return djb2(match[0]);

  // 2. Sticky cookie — ensures socket reconnects hit the same backend
  const cookie = req.cookies?.[COOKIE_NAME];
  if (cookie !== undefined) {
    const idx = parseInt(cookie, 10);
    if (!isNaN(idx) && idx >= 0 && idx < BACKENDS.length) return idx;
  }

  // 3. IP-based fallback
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
           || req.socket?.remoteAddress
           || '0';
  return djb2(ip);
}

// ─── Keep-alive pinger ────────────────────────────────────────────────────────
//
// Render free tier sleeps after 15 minutes of inactivity. We ping every
// backend's /api/health every 4 minutes so none of them ever sleep.
// The router itself is kept alive by UptimeRobot pinging /health (see README).
//

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

// Stagger initial pings so Render doesn't get hit all at once on cold start
BACKENDS.forEach((_, i) => setTimeout(() => pingBackend(i), i * 2000));

// Then ping all every 4 minutes
setInterval(pingAll, KEEPALIVE_MS);

// ─── Express app ─────────────────────────────────────────────────────────────

const app = express();
app.use(cookieParser());

// ─── Router health endpoint ───────────────────────────────────────────────────
// Point UptimeRobot at GET /health so the router itself never sleeps.

app.get('/health', (_req, res) => {
  const allAlive = backendStatus.every(b => b.alive);
  res.status(allAlive ? 200 : 207).json({
    status: allAlive ? 'ok' : 'degraded',
    uptime:    Math.floor(process.uptime()),
    backends:  backendStatus.map((s, i) => ({ index: i, ...s })),
    timestamp: new Date().toISOString(),
  });
});

// ─── One proxy instance per backend ──────────────────────────────────────────
//
// Each proxy manages its own HTTP connection pool and WebSocket upgrade
// handler for its target. This is more efficient than a single proxy that
// switches targets per request.
//

const proxies = BACKENDS.map((target, index) =>
  createProxyMiddleware({
    target,
    changeOrigin: true,
    ws: true,
    proxyTimeout: 30000,
    timeout:      30000,

    on: {
      // Set the sticky cookie on every response so the browser always comes
      // back to the same backend for all subsequent requests & socket reconnects.
      proxyRes(_proxyRes, req, res) {
        backendStatus[index].requests++;
        res.cookie(COOKIE_NAME, String(index), {
          maxAge:   COOKIE_MAX_AGE_MS,
          httpOnly: true,
          sameSite: 'None',
          secure:   true,
        });
      },

      error(err, _req, res) {
        console.error(`  [router] proxy error → backend [${index}]: ${err.message}`);
        backendStatus[index].alive = false;
        if (res.headersSent) return;
        res.status(502).json({
          error:   'Backend unavailable',
          message: 'This backend is temporarily unavailable. Please retry in a moment.',
        });
      },
    },
  })
);

// ─── Main routing middleware ──────────────────────────────────────────────────

app.use((req, res, next) => {
  const index = pickBackendIndex(req);
  console.log(`  → [${index}] ${req.method} ${req.url.slice(0, 100)}`);
  proxies[index](req, res, next);
});

// ─── HTTP server ──────────────────────────────────────────────────────────────
// We need the raw http.Server to intercept WebSocket upgrade events.

const server = http.createServer(app);

// Forward WebSocket / Socket.IO upgrade handshakes to the correct backend.
// We can't use cookie-parser here (it's Express middleware), so we parse
// cookies from the raw upgrade request headers manually.
server.on('upgrade', (req, socket, head) => {
  const rawCookies = req.headers.cookie || '';
  const cookies = Object.fromEntries(
    rawCookies.split(';').map(c => {
      const [k, ...v] = c.trim().split('=');
      return [k?.trim() ?? '', v.join('=')?.trim() ?? ''];
    })
  );

  let index;

  // Cookie takes priority — this is the socket reconnect path
  const cookieVal = cookies[COOKIE_NAME];
  if (cookieVal !== undefined) {
    const parsed = parseInt(cookieVal, 10);
    index = (!isNaN(parsed) && parsed >= 0 && parsed < BACKENDS.length)
      ? parsed
      : djb2(req.socket?.remoteAddress || '0');
  } else {
    // EventId in socket upgrade URL (Socket.IO passes query params here)
    const match = req.url.match(OBJECTID_RE);
    index = match
      ? djb2(match[0])
      : djb2(req.socket?.remoteAddress || '0');
  }

  console.log(`  ↑ WS upgrade → backend [${index}] ${req.url.slice(0, 80)}`);
  proxies[index].upgrade(req, socket, head);
});

server.listen(PORT, () => {
  console.log(`\n  PlanIt Router listening on port ${PORT}`);
  console.log(`  Keeping ${BACKENDS.length} backends alive with pings every ${KEEPALIVE_MS / 1000}s\n`);
});
