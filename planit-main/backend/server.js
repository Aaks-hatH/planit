/*
 * PLANIT PROPRIETARY LICENSE
 * Copyright (c) 2026 Aakshat Hariharan. All rights reserved.
 */

require('dotenv').config();

const VERSION = '1.1.0'; // bump this on every deploy so ntfy alerts show which build is running
const { verifyIntegrity, scheduleReverification } = require('./keys');
verifyIntegrity();
scheduleReverification();

const express       = require('express');
const mongoose      = require('mongoose');
const cors          = require('cors');
const mongoSanitize = require('express-mongo-sanitize');
const helmet        = require('helmet');
const compression   = require('compression');
const cookieParser  = require('cookie-parser');
const http          = require('http');
const socketIo      = require('socket.io');
const path          = require('path');

const supportRoutes       = require('./routes/support');
const bugReportRoutes     = require('./routes/bug-reports');
const uptimeRoutes        = require('./routes/uptime');
const { startCleanupScheduler } = require('./jobs/cleanupJob');
const { seedBlogPosts }         = require('./services/blogSeeder');

const app    = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin:      process.env.CORS_ORIGIN?.split(',') || 'http://localhost:5173',
    credentials: true,
    methods:     ['GET', 'POST', 'PUT', 'DELETE'],
  },
  transports:      ['polling', 'websocket'],
  allowUpgrades:   true,
  upgradeTimeout:  15000,
  pingTimeout:     20000,
  pingInterval:    10000,
  httpCompression: true,
});

app.set('io', io);

const eventRoutes         = require('./routes/events');
const chatRoutes          = require('./routes/chat');
const pollRoutes          = require('./routes/polls');
const fileRoutes          = require('./routes/files');
const adminRoutes         = require('./routes/admin');
const publicRoutes        = require('./routes/public');
const blogRoutes          = require('./routes/blog');
const checkinRoutes       = require('./routes/checkin-with-override');
const dataRetentionRoutes = require('./routes/dataRetention7Days');
const meshRoutes          = require('./routes/mesh');
const seatingRoutes       = require('./routes/seating');
const whiteLabelRoutes    = require('./routes/whitelabel');
const { router: wlPortalRoutes } = require('./routes/wl-portal');
const platformAnalyticsRoutes  = require('./routes/platform-analytics');

// ── Cat-4: New routes ─────────────────────────────────────────────────────────
const honeypotRoutes = require('./routes/honeypot');

const { apiLimiter }              = require('./middleware/rateLimiter');
const { errorHandler }            = require('./middleware/errorHandler');
const { attachResponseSignature } = require('./middleware/responseSigning');
const { trafficGuard }            = require('./middleware/security');

// ── Cat-4: Tarpit middleware ──────────────────────────────────────────────────
const { tarpit } = require('./middleware/tarpit');

// ─── Maintenance state cache ──────────────────────────────────────────────────
let _backendMaintenance = { active: false, message: '', eta: null };

async function _pollMaintenanceState() {
  const routerUrl = process.env.ROUTER_URL;

  try {
    const Mnt = require('./models/Mnt');
    const { meshPost } = require('./middleware/mesh');
    const due = await Mnt.findOne({ s: 'upcoming', start: { $lte: new Date() } }).lean();
    if (due) {
      await Mnt.updateOne({ _id: due._id }, { $set: { s: 'active' } });
      console.log(`[maintenance] Auto-promoted ${due._id} upcoming→active (start=${due.start})`);
      if (routerUrl) {
        await meshPost(
          process.env.BACKEND_LABEL || 'Backend',
          `${routerUrl}/mesh/maintenance`,
          { active: true, message: due.msg || '', eta: due.eta ? due.eta.toISOString() : null, type: due.t },
        ).catch(e => console.warn('[maintenance] Router sync failed on auto-promote:', e.message));
      }
      _backendMaintenance = { active: true, message: due.msg || '', eta: due.eta || null };
      return;
    }
  } catch (err) {
    console.warn('[maintenance] Auto-promote check failed:', err.message);
  }

  if (!process.env.ROUTER_URL) {
    try {
      const Mnt = require('./models/Mnt');
      const rec = await Mnt.findOne({ s: 'active' }).sort({ ca: -1 }).lean();
      _backendMaintenance = rec
        ? { active: true, message: rec.msg || '', eta: rec.eta || null }
        : { active: false, message: '', eta: null };
    } catch (_) {}
    return;
  }
  try {
    const axios = require('axios');
    const r = await axios.get(`${process.env.ROUTER_URL}/maintenance`, { timeout: 5000 });
    _backendMaintenance = r.data || { active: false };
  } catch (_) {
    // Router unreachable — stay in last known state
  }
}

async function _syncDbStateToRouter() {
  try {
    const Mnt = require('./models/Mnt');
    const { meshPost } = require('./middleware/mesh');
    const routerUrl = process.env.ROUTER_URL;
    if (!routerUrl) return;
    const rec = await Mnt.findOne({ s: { $in: ['upcoming','active'] } }).sort({ ca: -1 }).lean();
    const payload = rec
      ? { active: rec.s === 'active', upcoming: rec.s === 'upcoming', message: rec.msg || '', eta: rec.eta ? rec.eta.toISOString() : null, type: rec.t }
      : { active: false, upcoming: false, message: '', eta: null, type: null };
    await meshPost(
      process.env.BACKEND_LABEL || 'Backend',
      `${routerUrl}/mesh/maintenance`,
      payload,
    );
    console.log(`[maintenance] Synced DB state to router → active=${payload.active}`);
  } catch (err) {
    console.warn('[maintenance] Could not sync DB state to router:', err.message);
  }
}

function maintenanceGuard(req, res, next) {
  if (!_backendMaintenance.active) return next();
  const p = req.path;
  if (p === '/api/health' || p.startsWith('/api/mesh') || p.startsWith('/api/admin') || p.startsWith('/socket.io')) return next();
  if (p.startsWith('/api/whitelabel/resolve'))   return next();
  if (p.startsWith('/api/whitelabel/heartbeat')) return next();
  if (p.startsWith('/api/whitelabel/cors'))      return next();
  if (p.startsWith('/api/wl-portal'))            return next();
  if (p.startsWith('/api/uptime'))               return next();
  if (p === '/' && (req.method === 'HEAD' || req.method === 'GET')) return next();
  return res.status(503).json({
    maintenance: true,
    message: _backendMaintenance.message || 'Maintenance in progress.',
    eta:     _backendMaintenance.eta || null,
  });
}

// Trust exactly one upstream proxy hop (the Render load balancer).
app.set('trust proxy', 1);

// ─── Helmet — complete security header configuration ──────────────────────────
// The backend is a pure JSON API — it never serves HTML to end users.
// These headers are maximally restrictive because of that.
app.use(helmet({
  // ── HSTS ─────────────────────────────────────────────────────────────────
  // 2-year max-age. includeSubDomains and preload are set for when you move
  // to a custom domain. They are harmless on .onrender.com.
  hsts: {
    maxAge:            63072000,
    includeSubDomains: true,
    preload:           true,
  },

  // ── Content Security Policy ──────────────────────────────────────────────
  // The backend serves JSON only. No HTML, no scripts, no styles.
  // defaultSrc: 'none' means "block everything not explicitly allowed".
  // Since the backend never intentionally serves page content, all these
  // are set to 'none'. The one exception is connectSrc 'self' for health
  // check pages if you ever add an HTML status page.
  contentSecurityPolicy: {
    directives: {
      defaultSrc:     ["'none'"],
      scriptSrc:      ["'none'"],
      styleSrc:       ["'none'"],
      imgSrc:         ["'none'"],
      connectSrc:     ["'self'"],
      fontSrc:        ["'none'"],
      objectSrc:      ["'none'"],
      mediaSrc:       ["'none'"],
      frameSrc:       ["'none'"],
      frameAncestors: ["'none'"],   // No site can embed a backend response in an iframe
      formAction:     ["'none'"],   // No forms can submit to/from the backend
      baseUri:        ["'none'"],   // No <base> tag overrides
    },
  },

  // ── Cross-Origin Policies ────────────────────────────────────────────────
  // crossOriginResourcePolicy 'cross-origin': required for the API to be
  // callable from the React frontend on a different origin.
  crossOriginResourcePolicy: { policy: 'cross-origin' },

  // crossOriginOpenerPolicy 'same-origin': prevents attackers from opening
  // your backend in a popup and accessing its window object.
  // This is a Spectre/cross-site leak mitigation.
  crossOriginOpenerPolicy: { policy: 'same-origin' },

  // crossOriginEmbedderPolicy false: would require every resource the
  // frontend loads to opt-in with CORP headers. Too restrictive for
  // Cloudinary CDN images — leave off.
  crossOriginEmbedderPolicy: false,

  // ── Other headers ────────────────────────────────────────────────────────
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  noSniff:        true,       // X-Content-Type-Options: nosniff
  hidePoweredBy:  true,       // Remove X-Powered-By: Express
  frameguard:     { action: 'deny' }, // X-Frame-Options: DENY
  xssFilter:      true,       // X-XSS-Protection: 1; mode=block (legacy IE)
  permittedCrossDomainPolicies: { permittedPolicies: 'none' },
}));

// ── Permissions-Policy — not yet in Helmet 7, added manually ─────────────────
// Disables browser APIs your backend never needs:
// camera, microphone, geolocation, payment, USB, interest-cohort (FLoC).
// This header only has an effect if the backend ever serves an HTML page,
// but it's cheap to set and correct to include.
app.use((_req, res, next) => {
  res.setHeader(
    'Permissions-Policy',
    'accelerometer=(), camera=(), geolocation=(), gyroscope=(), ' +
    'magnetometer=(), microphone=(), payment=(), usb=(), interest-cohort=()'
  );
  next();
});

app.use(compression());

// ─── CORS ─────────────────────────────────────────────────────────────────────
const _corsAllowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',').map(o => o.trim()).filter(Boolean);

if (_corsAllowedOrigins.length === 0) {
  console.warn('[CORS] WARNING: CORS_ORIGIN not set — localhost only in dev.');
}

const _localhostOrigins = [
  'http://localhost:5173', 'http://localhost:3000',
  'http://127.0.0.1:5173', 'http://127.0.0.1:3000',
];

const _wlOriginCache = new Map();
const _WL_CACHE_TTL  = 5 * 60 * 1000;

async function _isWLOrigin(origin) {
  const cached = _wlOriginCache.get(origin);
  if (cached && (Date.now() - cached.ts) < _WL_CACHE_TTL) return cached.allowed;
  try {
    const hostname   = new URL(origin).hostname;
    const WhiteLabel = require('./models/WhiteLabel');
    const wl = await WhiteLabel.findOne(
      { domain: hostname, status: { $in: ['active', 'trial', 'suspended', 'cancelled'] } },
      { _id: 1 }
    ).lean();
    const allowed = !!wl;
    _wlOriginCache.set(origin, { allowed, ts: Date.now() });
    if (allowed) console.log(`[CORS] WL origin allowed (cached 5 min): ${origin}`);
    return allowed;
  } catch (err) {
    console.error('[CORS] WL origin DB lookup failed:', err.message);
    const stale = _wlOriginCache.get(origin);
    if (stale) return stale.allowed;
    return false;
  }
}

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (_corsAllowedOrigins.includes(origin)) return callback(null, true);
    if (process.env.NODE_ENV !== 'production' && _localhostOrigins.includes(origin)) {
      return callback(null, true);
    }
    _isWLOrigin(origin)
      .then(allowed => {
        if (allowed) return callback(null, true);
        console.warn(`[CORS] Rejected: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      })
      .catch(() => callback(new Error('Not allowed by CORS')));
  },
  credentials:          true,
  methods:              ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders:       ['Content-Type', 'Authorization', 'x-event-token'],
  exposedHeaders:       ['Content-Type', 'Authorization'],
  preflightContinue:    false,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

// ─── Body parsers — per-route size limits (Cat-4) ────────────────────────────
//
// WHY: The previous global '2mb' limit lets attackers send 2MB JSON bodies
// to login endpoints, crashing the body parser with an OOM spike.
// A login body is {"email":"x","password":"y"} — about 50 bytes.
// 50KB is already 1000x more than needed. 2MB on auth routes is negligent.
//
// Express applies the FIRST matching parser and skips subsequent ones once
// req.body is populated, so specific routes must come BEFORE the general one.
//
// Stripe webhooks: raw body required for signature verification — no JSON parser.
app.use('/api/whitelabel/webhooks/stripe', express.raw({ type: 'application/json' }));

// Auth / login routes: 50KB max
// Covers staff login, event password verify, WL portal login, password changes.
app.use(
  [
    '/api/wl-portal/login',
    '/api/wl-portal/change-password',
  ],
  express.json({ limit: '50kb' })
);

// File metadata routes: 512KB
// Actual file bytes go via multipart; JSON here is metadata only.
app.use('/api/files', express.json({ limit: '512kb' }));

// Admin routes: 500KB
// May send configuration objects, employee lists, etc.
app.use('/api/admin', express.json({ limit: '500kb' }));

// Seating maps: 1MB
// Large events can have complex seating JSON with hundreds of objects.
app.use('/api/events', express.json({ limit: '1mb' }));

// White-label management routes: 500KB
app.use(['/api/whitelabel', '/api/wl-portal'], express.json({ limit: '500kb' }));

// Everything else: 100KB
// Generous for normal API payloads, restrictive for attack bodies.
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

app.use(cookieParser());
app.use(mongoSanitize());

// ─── Security middleware stack ────────────────────────────────────────────────
//
// Order matters:
//
//   1. tarpit      — Silently delays suspicious IPs BEFORE trafficGuard runs.
//                    Level-0 IPs (all normal traffic) exit in ~0ms — no overhead.
//                    Tarpitted IPs are slowed, then trafficGuard still processes them.
//
//   2. trafficGuard — Detects and bans malicious traffic. Now also calls
//                    tarpitIncrement on every warn and AbuseIPDB on every ban.
//
//   3. maintenanceGuard — Blocks traffic during maintenance windows.
//
//   4. honeypotRoutes — 30 trap endpoints. Mounted AFTER trafficGuard (so
//                    already-banned IPs hit the ban check first) and BEFORE
//                    /api/* routes (so fake /api/debug, /api/config etc. are caught).
//
//   5. apiLimiter — Rate limiting on real /api/ routes.
//
app.use(tarpit);          // Cat-4: exponential delay for suspicious IPs
app.use(trafficGuard);    // existing: UA/path/rapid/oversized detection
app.use(maintenanceGuard);
app.use(honeypotRoutes);  // Cat-4: 30 trap routes → instant ban + alert
app.use('/api/', apiLimiter);
app.use('/api/', attachResponseSignature);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── Health endpoints ─────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  const internalKey = req.headers['x-health-key'];
  const isInternal  = internalKey && internalKey === process.env.HEALTH_KEY;
  res.json({
    status:    'ok',
    timestamp: new Date().toISOString(),
    ...(isInternal ? {
      uptime:  process.uptime(),
      mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      redis:   !!process.env.REDIS_URL,
      features: { cloudinaryStorage: !!process.env.CLOUDINARY_CLOUD_NAME, autoCleanup: true },
    } : {}),
  });
});

app.head('/api/health', (req, res) => {
  res.set({
    'X-Service': 'planit-backend',
    'X-Uptime':  Math.floor(process.uptime()).toString(),
    'X-Status':  mongoose.connection.readyState === 1 ? 'db-ok' : 'db-down',
  });
  res.sendStatus(200);
});

app.head('/', (req, res) => {
  res.set({
    'X-Service': 'planit-backend',
    'X-Uptime':  Math.floor(process.uptime()).toString(),
    'X-Status':  mongoose.connection.readyState === 1 ? 'db-ok' : 'db-down',
  });
  res.sendStatus(200);
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/events',      eventRoutes);
app.use('/api/chat',        chatRoutes);
app.use('/api/polls',       pollRoutes);
app.use('/api/files',       fileRoutes);
app.use('/api/admin',       adminRoutes);
app.use('/api/blog',        blogRoutes);
app.use('/api/support',     supportRoutes);
app.use('/api/bug-reports', bugReportRoutes);
app.use('/api/uptime',      uptimeRoutes);
app.use('/api/mesh',        meshRoutes);
app.use('/api',             publicRoutes);
app.use('/api/events',      checkinRoutes);
app.use('/api/events',      dataRetentionRoutes);
app.use('/api/events',      seatingRoutes);
app.use('/api/whitelabel',  whiteLabelRoutes);
app.use('/api/wl-portal',   wlPortalRoutes);
app.use('/api/platform-analytics', express.json({ limit: '200kb' }), platformAnalyticsRoutes);

const frontendUrls = (process.env.FRONTEND_URL || '')
  .split(',').map(u => u.trim()).filter(Boolean);

app.get('/qr/:inviteCode', (req, res) => {
  const code = req.params.inviteCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!code) return res.status(400).send('Invalid code');
  res.redirect(301, `/api/events/invite/${code}/qr.svg`);
});

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
  const requestHost = req.hostname;
  const match = frontendUrls.find(u => {
    try { return new URL(u).hostname === requestHost; } catch { return false; }
  });
  const target = match || frontendUrls[0];
  if (!target) return res.status(500).send('Frontend URL not configured');
  return res.redirect(301, target + req.originalUrl);
});

app.use(errorHandler);

// ─── Redis adapter for Socket.IO ──────────────────────────────────────────────
async function initRedisAdapter() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.log('[io] No REDIS_URL — in-memory adapter (single-instance mode)');
    return;
  }
  let pubClient, subClient;
  try {
    const Redis             = require('ioredis');
    const { createAdapter } = require('@socket.io/redis-adapter');
    const tlsOptions = redisUrl.startsWith('rediss://') ? { tls: { rejectUnauthorized: false } } : {};
    pubClient = new Redis(redisUrl, { ...tlsOptions, maxRetriesPerRequest: 3, enableReadyCheck: false, lazyConnect: false });
    subClient = pubClient.duplicate();

    // Persistent error handlers — attached IMMEDIATELY after client creation,
    // BEFORE any await. ioredis emits 'error' on connection drops (network
    // blip, Upstash idle eviction, TLS reset, etc.). Without these, Node.js
    // treats the emitted error as an unhandled EventEmitter error and crashes
    // the process → Render 502.
    //
    // Previously these were attached AFTER the ready handshake await, which
    // meant a timeout or early error could orphan the clients with no handler—
    // the next reconnect attempt would then crash the process.
    pubClient.on('error', err => console.error('[io] Redis pub error (non-fatal):', err.message));
    subClient.on('error', err => console.error('[io] Redis sub error (non-fatal):', err.message));

    await Promise.all([
      new Promise((resolve, reject) => { pubClient.once('ready', resolve); setTimeout(() => reject(new Error('pub timeout')), 10_000); }),
      new Promise((resolve, reject) => { subClient.once('ready', resolve); setTimeout(() => reject(new Error('sub timeout')), 10_000); }),
    ]);

    io.adapter(createAdapter(pubClient, subClient));
    console.log('[io] Redis adapter active — all 5 instances share signaling bus');
    const shutdown = async () => { await pubClient.quit().catch(() => {}); await subClient.quit().catch(() => {}); };
    process.once('SIGTERM', shutdown);
    process.once('SIGINT',  shutdown);
  } catch (err) {
    console.error('[io] Redis adapter init failed, using in-memory fallback:', err.message);
    // Disconnect orphaned clients so they stop retrying and cannot emit
    // errors with no listener after we have fallen back to in-memory mode.
    if (pubClient) pubClient.disconnect().catch(() => {});
    if (subClient) subClient.disconnect().catch(() => {});
  }
}

// ─── MongoDB + server startup ──────────────────────────────────────────────────
const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI not defined');
    if (process.env.NODE_ENV === 'development') mongoose.set('debug', true);
    await mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('MongoDB connected');
    console.log(`  Database: ${mongoose.connection.name}`);
    startCleanupScheduler();
    seedBlogPosts();
    mongoose.connection.on('error',        err => console.error('MongoDB error:', err));
    mongoose.connection.on('disconnected', ()  => console.warn('MongoDB disconnected'));
    mongoose.connection.on('reconnected',  ()  => console.log('MongoDB reconnected'));
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  }
};

async function announceToRouter() {
  const routerUrl = process.env.ROUTER_URL;
  if (!routerUrl) return;
  const { meshPost } = require('./middleware/mesh');
  const name    = process.env.BACKEND_LABEL || 'Backend';
  const selfUrl = process.env.SELF_URL      || '';
  if (!selfUrl) { console.warn(`[${name}] [mesh] SELF_URL not set — skipping announcement`); return; }
  for (let i = 1; i <= 4; i++) {
    const result = await meshPost(name, `${routerUrl}/mesh/register`, { url: selfUrl, name, region: process.env.BACKEND_REGION || null });
    if (result.ok) { console.log(`[${name}] [mesh] Announced to router (attempt ${i})`); return; }
    if (i < 4) await new Promise(r => setTimeout(r, i * 3000));
  }
  console.warn(`[${process.env.BACKEND_LABEL || 'Backend'}] [mesh] Could not announce to router`);
}

connectDB().then(async () => {
  const { syncConfigFromRouter } = require('./services/configSync');
  await syncConfigFromRouter();
  await initRedisAdapter();
  await _syncDbStateToRouter();
  await _pollMaintenanceState();
  setInterval(_pollMaintenanceState, 5_000);
  require('./socket/chatSocket')(io);
  require('./socket/walkieTalkieSocket')(io);

  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => {
    const name   = process.env.BACKEND_LABEL  || 'Backend';
    const region = process.env.BACKEND_REGION ? ` — ${process.env.BACKEND_REGION}` : '';
    console.log('\n' + '='.repeat(70));
    console.log(` PlanIt Backend — ${name}${region}  [v${VERSION}]`);
    console.log('='.repeat(70));
    console.log(`  Version:     ${VERSION}`);
    console.log(`  Port:        ${PORT}`);
    console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`  CORS Origin: ${process.env.CORS_ORIGIN || 'http://localhost:5173'}`);
    console.log(`  Storage:     ${process.env.CLOUDINARY_CLOUD_NAME ? 'Cloudinary' : 'Local'}`);
    console.log(`  Redis:       ${process.env.REDIS_URL ? 'Adapter active' : 'In-memory'}`);
    console.log(`  Tarpit:      ${process.env.TARPIT_ENABLED !== 'false' ? 'enabled' : 'disabled'}`);
    console.log(`  AbuseIPDB:   ${process.env.ABUSEIPDB_API_KEY ? 'enabled' : 'disabled (set ABUSEIPDB_API_KEY)'}`);
    console.log(`  Honeypots:   30 trap routes active`);
    const _au = (process.env.ADMIN_USERNAME || '').trim();
    const _ap = (process.env.ADMIN_PASSWORD || '').trim();
    if (!_au || !_ap || _au === 'admin' || _ap === 'admin123') {
      console.log(`  Admin creds: ⚠  using defaults — set ADMIN_USERNAME / ADMIN_PASSWORD`);
    } else {
      console.log(`  Admin creds: ✓  configured`);
    }
    console.log('='.repeat(70));
    setTimeout(announceToRouter, 4000);
  });
});

process.on('SIGTERM', () => { server.close(() => { mongoose.connection.close(false, () => process.exit(0)); }); });
process.on('SIGINT',  () => { server.close(() => { mongoose.connection.close(false, () => process.exit(0)); }); });
process.on('unhandledRejection', err => { console.error('[PlanIt] Unhandled Rejection:', err?.stack || err); });
process.on('uncaughtException',  err => { console.error('[PlanIt] Uncaught Exception:',  err?.stack || err); });

module.exports = { app, server, io };