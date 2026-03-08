/*
 * PLANIT PROPRIETARY LICENSE
 * Copyright (c) 2026 Aakshat Hariharan. All rights reserved.
 */

require('dotenv').config();
const { verifyIntegrity, scheduleReverification } = require('./keys');
verifyIntegrity();
scheduleReverification();

const express    = require('express');
const mongoose   = require('mongoose');
const cors       = require('cors');
const mongoSanitize = require('express-mongo-sanitize');
const helmet     = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const http       = require('http');
const socketIo   = require('socket.io');
const path       = require('path');

const supportRoutes   = require('./routes/support');
const bugReportRoutes = require('./routes/bug-reports');
const uptimeRoutes    = require('./routes/uptime');
const { startCleanupScheduler } = require('./jobs/cleanupJob');

const app    = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin:      process.env.CORS_ORIGIN?.split(',') || 'http://localhost:5173',
    credentials: true,
    methods:     ['GET', 'POST', 'PUT', 'DELETE'],
  },
  transports:     ['polling', 'websocket'],
  allowUpgrades:  true,
  upgradeTimeout: 15000,
  pingTimeout:    20000,
  pingInterval:   10000,
  httpCompression: true,
});

app.set('io', io);

const eventRoutes       = require('./routes/events');
const chatRoutes        = require('./routes/chat');
const pollRoutes        = require('./routes/polls');
const fileRoutes        = require('./routes/files');
const adminRoutes       = require('./routes/admin');
const publicRoutes      = require('./routes/public');
const checkinRoutes     = require('./routes/checkin-with-override');
const dataRetentionRoutes = require('./routes/dataRetention7Days');
const meshRoutes        = require('./routes/mesh');
const seatingRoutes     = require('./routes/seating');   // NEW

const { apiLimiter }             = require('./middleware/rateLimiter');
const { errorHandler }           = require('./middleware/errorHandler');
const { attachResponseSignature } = require('./middleware/responseSigning');
const { trafficGuard }           = require('./middleware/security');

// ─── Maintenance state cache ───────────────────────────────────────────────────
// Polls router GET /maintenance every 15s.
// On each request, blocks non-exempt paths when active.
// This is a defence-in-depth layer — the router already blocks at the edge,
// but if a request somehow bypasses the router (direct backend hit, internal
// tool, etc.) the backend refuses it too.
let _backendMaintenance = { active: false, message: '', eta: null };

async function _pollMaintenanceState() {
  const routerUrl = process.env.ROUTER_URL;

  // ── Auto-promote upcoming → active when start time has passed ───────────────
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

  // ── Poll router for current state ─────────────────────────────────────────
  if (!routerUrl) {
    // No router configured — read DB directly so the guard still works
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
    const r = await axios.get(`${routerUrl}/maintenance`, { timeout: 5000 });
    _backendMaintenance = r.data || { active: false };
  } catch (_) {
    // Router unreachable — stay in last known state
  }
}

// On boot: load any active/upcoming record from DB and sync to router
// so state survives router restarts without needing env vars.
async function _syncDbStateToRouter() {
  try {
    const Mnt = require('./models/Mnt');
    const { meshPost } = require('./middleware/mesh');
    const routerUrl = process.env.ROUTER_URL;
    if (!routerUrl) return;
    const rec = await Mnt.findOne({ s: { $in: ['upcoming','active'] } }).sort({ ca: -1 }).lean();
    // Always explicitly push state to router — even if no active record.
    // Without this, a backend restart after resolve would leave the router
    // in whatever state it was last set to (possibly still active from a
    // previous boot-sync), never clearing it.
    const payload = rec
      ? { active: rec.s === 'active', upcoming: rec.s === 'upcoming', message: rec.msg || '', eta: rec.eta ? rec.eta.toISOString() : null, type: rec.t }
      : { active: false, upcoming: false, message: '', eta: null, type: null };
    await meshPost(
      process.env.BACKEND_LABEL || 'Backend',
      `${routerUrl}/mesh/maintenance`,
      payload,
    );
    console.log(`[maintenance] Synced DB state to router → active=${payload.active} (${rec ? `s=${rec.s} t=${rec.t}` : 'no active record in DB'})`);
  } catch (err) {
    console.warn('[maintenance] Could not sync DB state to router:', err.message);
  }
}

function maintenanceGuard(req, res, next) {
  if (!_backendMaintenance.active) return next();
  const p = req.path;
  // Always let through: health checks, mesh routes, admin routes, socket.io
  if (p === '/api/health' || p.startsWith('/api/mesh') || p.startsWith('/api/admin') || p.startsWith('/socket.io')) return next();
  return res.status(503).json({
    maintenance: true,
    message: _backendMaintenance.message || 'Maintenance in progress.',
    eta:     _backendMaintenance.eta || null,
  });
}

app.set('trust proxy', 1);

app.use(helmet({
  hsts: { maxAge: 63072000, includeSubDomains: true, preload: true },
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'self'"],
      scriptSrc:   ["'self'", "'unsafe-inline'"],
      styleSrc:    ["'self'", "'unsafe-inline'"],
      imgSrc:      ["'self'", 'data:', 'https:', 'http:'],
      connectSrc:  ["'self'", 'wss:', 'ws:', 'https:', 'http:'],
      fontSrc:     ["'self'", 'data:'],
      objectSrc:   ["'none'"],
      mediaSrc:    ["'self'", 'https:'],
      frameSrc:    ["'none'"],
    },
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  noSniff:     true,
  hidePoweredBy: true,
  frameguard:  { action: 'deny' },
}));

app.use(compression());

const _corsAllowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',').map(o => o.trim()).filter(Boolean);

if (_corsAllowedOrigins.length === 0) {
  console.warn('[CORS] WARNING: CORS_ORIGIN not set — localhost only in dev.');
}

const _localhostOrigins = [
  'http://localhost:5173', 'http://localhost:3000',
  'http://127.0.0.1:5173', 'http://127.0.0.1:3000',
];

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (_corsAllowedOrigins.includes(origin)) return callback(null, true);
    if (process.env.NODE_ENV !== 'production' && _localhostOrigins.includes(origin)) {
      return callback(null, true);
    }
    console.warn(`[CORS] Rejected: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials:      true,
  methods:          ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders:   ['Content-Type', 'Authorization', 'x-event-token'],
  exposedHeaders:   ['Content-Type', 'Authorization'],
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(mongoSanitize());
app.use(trafficGuard);
app.use(maintenanceGuard);       // blocks all non-exempt paths during maintenance
app.use('/api/', apiLimiter);
app.use('/api/', attachResponseSignature);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// --------------------------------------------------------------------------
// Health endpoints
// --------------------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({
    status:    'ok',
    timestamp: new Date().toISOString(),
    uptime:    process.uptime(),
    mongodb:   mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    redis:     !!process.env.REDIS_URL,
    features:  { cloudinaryStorage: !!process.env.CLOUDINARY_CLOUD_NAME, autoCleanup: true },
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

// --------------------------------------------------------------------------
// Routes
// --------------------------------------------------------------------------
app.use('/api/events',    eventRoutes);
app.use('/api/chat',      chatRoutes);
app.use('/api/polls',     pollRoutes);
app.use('/api/files',     fileRoutes);
app.use('/api/admin',     adminRoutes);
app.use('/api/support',   supportRoutes);
app.use('/api/bug-reports', bugReportRoutes);
app.use('/api/uptime',    uptimeRoutes);
app.use('/api/mesh',      meshRoutes);
app.use('/api',           publicRoutes);
app.use('/api/events',    checkinRoutes);
app.use('/api/events',    dataRetentionRoutes);
app.use('/api/events',    seatingRoutes);     // NEW: seating map CRUD

const frontendUrls = (process.env.FRONTEND_URL || '')
  .split(',').map(u => u.trim()).filter(Boolean);

// /qr/:inviteCode — direct image URL shorthand for invite QR codes
// Works as a plain <img src="..."> in emails, PDFs, and external pages
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

// --------------------------------------------------------------------------
// Redis adapter for Socket.IO
//
// Set REDIS_URL in your environment to route signaling across all 5 backend
// instances. Upstash provides a native Redis URL in the format:
//   rediss://default:<token>@<host>:<port>
//
// Without REDIS_URL the server operates correctly in single-instance mode;
// walkie-talkie still works as long as all staff connect to the same instance.
//
// Required packages (add to package.json):
//   "ioredis": "^5.3.2"
//   "@socket.io/redis-adapter": "^8.3.0"
// --------------------------------------------------------------------------
async function initRedisAdapter() {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    console.log('[io] No REDIS_URL — in-memory adapter (single-instance mode)');
    return;
  }

  try {
    const Redis            = require('ioredis');
    const { createAdapter } = require('@socket.io/redis-adapter');

    const tlsOptions = redisUrl.startsWith('rediss://')
      ? { tls: { rejectUnauthorized: false } }
      : {};

    const pubClient = new Redis(redisUrl, {
      ...tlsOptions,
      maxRetriesPerRequest: 3,
      enableReadyCheck:     false,
      lazyConnect:          false,
    });

    const subClient = pubClient.duplicate();

    // Wait for both connections before attaching
    await Promise.all([
      new Promise((resolve, reject) => {
        pubClient.once('ready', resolve);
        pubClient.once('error', reject);
        setTimeout(() => reject(new Error('pub timeout')), 10_000);
      }),
      new Promise((resolve, reject) => {
        subClient.once('ready', resolve);
        subClient.once('error', reject);
        setTimeout(() => reject(new Error('sub timeout')), 10_000);
      }),
    ]);

    io.adapter(createAdapter(pubClient, subClient));

    console.log('[io] Redis adapter active — all 5 instances share signaling bus');

    // Graceful shutdown
    const shutdown = async () => {
      await pubClient.quit().catch(() => {});
      await subClient.quit().catch(() => {});
    };
    process.once('SIGTERM', shutdown);
    process.once('SIGINT',  shutdown);

  } catch (err) {
    console.error('[io] Redis adapter init failed, using in-memory fallback:', err.message);
  }
}

// --------------------------------------------------------------------------
// MongoDB + server startup
// --------------------------------------------------------------------------
const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI not defined');

    if (process.env.NODE_ENV === 'development') mongoose.set('debug', true);

    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser:    true,
      useUnifiedTopology: true,
    });

    console.log('MongoDB connected');
    console.log(`  Database: ${mongoose.connection.name}`);

    startCleanupScheduler();

    mongoose.connection.on('error',       err  => console.error('MongoDB error:', err));
    mongoose.connection.on('disconnected', ()   => console.warn('MongoDB disconnected'));
    mongoose.connection.on('reconnected',  ()   => console.log('MongoDB reconnected'));

  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  }
};

async function announceToRouter() {
  const routerUrl = process.env.ROUTER_URL;
  if (!routerUrl) return;

  const { meshPost } = require('./middleware/mesh');
  const name    = process.env.BACKEND_LABEL  || 'Backend';
  const selfUrl = process.env.SELF_URL       || '';

  if (!selfUrl) {
    console.warn(`[${name}] [mesh] SELF_URL not set — skipping announcement`);
    return;
  }

  for (let i = 1; i <= 4; i++) {
    const result = await meshPost(name, `${routerUrl}/mesh/register`, {
      url: selfUrl, name, region: process.env.BACKEND_REGION || null,
    });
    if (result.ok) {
      console.log(`[${name}] [mesh] Announced to router (attempt ${i})`);
      return;
    }
    if (i < 4) await new Promise(r => setTimeout(r, i * 3000));
  }
  console.warn(`[${process.env.BACKEND_LABEL || 'Backend'}] [mesh] Could not announce to router`);
}

connectDB().then(async () => {
  // Attach Redis adapter before any connection is accepted
  await initRedisAdapter();

  // Start polling router for maintenance state (defence-in-depth)
  await _syncDbStateToRouter();          // restore any persisted state into router
  await _pollMaintenanceState();
  setInterval(_pollMaintenanceState, 5_000);

  // Register all Socket.IO handlers
  require('./socket/chatSocket')(io);
  require('./socket/walkieTalkieSocket')(io);  // NEW

  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => {
    const name   = process.env.BACKEND_LABEL  || 'Backend';
    const region = process.env.BACKEND_REGION ? ` — ${process.env.BACKEND_REGION}` : '';
    console.log('\n' + '='.repeat(70));
    console.log(` PlanIt Backend — ${name}${region}`);
    console.log('='.repeat(70));
    console.log(`  Port:        ${PORT}`);
    console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`  CORS Origin: ${process.env.CORS_ORIGIN || 'http://localhost:5173'}`);
    console.log(`  Storage:     ${process.env.CLOUDINARY_CLOUD_NAME ? 'Cloudinary' : 'Local'}`);
    console.log(`  Redis:       ${process.env.REDIS_URL ? 'Adapter active' : 'In-memory'}`);
    console.log('='.repeat(70));
    setTimeout(announceToRouter, 4000);
  });
});

process.on('SIGTERM', () => {
  server.close(() => {
    mongoose.connection.close(false, () => process.exit(0));
  });
});

process.on('SIGINT', () => {
  server.close(() => {
    mongoose.connection.close(false, () => process.exit(0));
  });
});

process.on('unhandledRejection', err => {
  console.error('[PlanIt] Unhandled Rejection:', err?.stack || err);
});

process.on('uncaughtException', err => {
  console.error('[PlanIt] Uncaught Exception:', err?.stack || err);
});

module.exports = { app, server, io };
