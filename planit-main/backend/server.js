/*
 * PLANIT PROPRIETARY LICENSE
 * Copyright (c) 2026 Aakshat Hariharan. All rights reserved.
 *
 * This software is proprietary and confidential. Unauthorized copying,
 * deployment, distribution, or creation of derivative works is strictly
 * prohibited. Viewing the source code does not grant any rights to use,
 * copy, or deploy this software. See the LICENSE file for full terms.
 */

// ── Load env and verify license key before anything else boots ───────────────
require('dotenv').config();
const { verifyIntegrity, scheduleReverification } = require('./keys');
verifyIntegrity();
scheduleReverification(); // Re-checks every 4 hours — tampered process cannot run indefinitely
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const supportRoutes    = require('./routes/support');
const bugReportRoutes  = require('./routes/bug-reports');
const uptimeRoutes = require('./routes/uptime');

// ═══════════════════════════════════════════════════════════════════════════
// IMPORT CLEANUP SCHEDULER
// ═══════════════════════════════════════════════════════════════════════════
const { startCleanupScheduler } = require('./jobs/cleanupJob');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  },
  // Accept both transports — client starts with polling (instant, always works
  // through Render's proxy) then Socket.IO upgrades to WebSocket automatically.
  transports:    ['polling', 'websocket'],
  allowUpgrades: true,
  // Give the WebSocket upgrade handshake enough time to succeed through the router proxy.
  upgradeTimeout: 15000,
  // Detect dead connections faster. Default pingTimeout of 20s means a dropped
  // connection isn't noticed for 20s — keeping it but lowering pingInterval so
  // the server pings more frequently and notices drops sooner.
  pingTimeout:     20000,
  pingInterval:    10000,
  httpCompression: true,
});

const FRONTEND_URL = process.env.FRONTEND_URL?.split(',')

// ── CRITICAL FIX: make io accessible in all route handlers ──
app.set('io', io);

const eventRoutes = require('./routes/events');
const chatRoutes = require('./routes/chat');
const pollRoutes = require('./routes/polls');
const fileRoutes = require('./routes/files');
const adminRoutes = require('./routes/admin');
const publicRoutes = require('./routes/public');
const checkinRoutes = require('./routes/checkin-with-override');
const dataRetentionRoutes = require('./routes/dataRetention7Days');
const meshRoutes = require('./routes/mesh');

const { apiLimiter } = require('./middleware/rateLimiter');
const { errorHandler } = require('./middleware/errorHandler');
const { attachResponseSignature } = require('./middleware/responseSigning');
const { trafficGuard } = require('./middleware/security');

// ── Trust proxy for Render / any reverse-proxy hosting ──
// Required so express-rate-limit can read X-Forwarded-For correctly
app.set('trust proxy', 1);

// Enhanced security headers with HSTS
app.use(helmet({
  // HSTS - Force HTTPS for 2 years
  hsts: {
    maxAge: 63072000,        // 2 years in seconds
    includeSubDomains: true, // Apply to all subdomains
    preload: true            // Allow browser preload list
  },
  
  // Content Security Policy
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],  // Allow inline scripts for React
      styleSrc: ["'self'", "'unsafe-inline'"],   // Allow inline styles
      imgSrc: ["'self'", "data:", "https:", "http:"],  // Allow external images (Cloudinary)
      connectSrc: ["'self'", "wss:", "ws:", "https:", "http:"],  // Allow WebSocket
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'", "https:"],  // Allow Cloudinary media
      frameSrc: ["'none'"],
    },
  },
  
  // Cross-Origin policies
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false,  // Allow embedding
  
  // Additional security headers
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  noSniff: true,              // Prevent MIME sniffing
  hidePoweredBy: true,        // Hide X-Powered-By header
  frameguard: {               // Prevent clickjacking
    action: 'deny'
  }
}));

app.use(compression());

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || origin.includes('onrender.com') || origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return callback(null, true);
    }
    const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || [];
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-event-token'],
  exposedHeaders: ['Content-Type', 'Authorization'],
  preflightContinue: false,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(trafficGuard); // application-layer malicious traffic detection
app.use('/api/', apiLimiter);
app.use('/api/', attachResponseSignature); // Sign every API response with the license-derived key
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── Health check endpoints — MUST be registered before all other routes ─────
// Registered early so no other middleware or catch-all can intercept them.
//
// GET  /api/health — full JSON status for browsers / curl / reqbin
// HEAD /api/health — explicit handler for the watchdog (axios.head) and
//                    UptimeRobot. Without an explicit HEAD route, Express
//                    falls through to the app.get('*') catch-all which returns
//                    404 for any /api path — causing false-positive outage alerts.
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    features: {
      cloudinaryStorage: !!process.env.CLOUDINARY_CLOUD_NAME,
      autoCleanup: true
    }
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

// ─── UptimeRobot HEAD / ping ──────────────────────────────────────────────────
// UptimeRobot pings HEAD / to check if the server is alive.
// Respond 200 with lightweight status headers — no body needed.
app.head('/', (req, res) => {
  res.set({
    'X-Service': 'planit-backend',
    'X-Uptime':  Math.floor(process.uptime()).toString(),
    'X-Status':  mongoose.connection.readyState === 1 ? 'db-ok' : 'db-down',
  });
  res.sendStatus(200);
});

// Mount routes
app.use('/api/events', eventRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/polls', pollRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/bug-reports', bugReportRoutes);
app.use('/api/uptime', uptimeRoutes);
app.use('/api/mesh', meshRoutes);
app.use('/api', publicRoutes);
app.use('/api/events', checkinRoutes);
app.use('/api/events', dataRetentionRoutes);

const frontendUrls = (process.env.FRONTEND_URL || '')
  .split(',')
  .map(url => url.trim())
  .filter(Boolean);

app.get('*', (req, res) => {
  // Never redirect API routes
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Not found' });
  }

  const requestHost = req.hostname;

  // Try to match exact hostname
  const match = frontendUrls.find(url => {
    try {
      return new URL(url).hostname === requestHost;
    } catch {
      return false;
    }
  });

  // Fallback to first frontend as canonical
  const target = match || frontendUrls[0];

  if (!target) {
    return res.status(500).send('Frontend URL not configured');
  }

  return res.redirect(301, target + req.originalUrl);
});

app.use(errorHandler);

// ═══════════════════════════════════════════════════════════════════════════
// ENHANCED MongoDB CONNECTION WITH CLEANUP SCHEDULER
// ═══════════════════════════════════════════════════════════════════════════

const connectDB = async () => {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    // Enable mongoose debugging in development
    if (process.env.NODE_ENV === 'development') {
      mongoose.set('debug', true);
    }

    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log('✓ MongoDB connected successfully');
    console.log(`  Database: ${mongoose.connection.name}`);
    console.log(`  Host: ${mongoose.connection.host}`);
    console.log(`  Port: ${mongoose.connection.port}`);

    // ═══════════════════════════════════════════════════════════════════════
    // START AUTOMATIC CLEANUP SCHEDULER
    // ═══════════════════════════════════════════════════════════════════════
    console.log('\n  Initializing automatic event cleanup...');
    startCleanupScheduler();
    console.log('✓ Cleanup scheduler started');
    console.log('  Events will be deleted 7 days after they occur');
    console.log('  Cleanup runs daily at 2:00 AM\n');

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected. Attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB reconnected successfully');
    });

  } catch (err) {
    console.error(' MongoDB connection failed:');
    console.error('  Error:', err.message);
    if (process.env.MONGODB_URI) {
      // Hide credentials in logs
      const sanitizedURI = process.env.MONGODB_URI.replace(/\/\/.*@/, '//***:***@');
      console.error('  URI:', sanitizedURI);
    }
    console.error('\nPlease check:');
    console.error('  1. MongoDB is running');
    console.error('  2. MONGODB_URI in .env is correct');
    console.error('  3. Network connectivity');
    console.error('  4. Database user has proper permissions');
    process.exit(1);
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════════════════════

// ─── Mesh startup announcement ───────────────────────────────────────────────
// When this backend starts, it announces itself to the router so the router
// can enrich its fleet state — even if BACKEND_URLS was not updated.
async function announceToRouter() {
  const routerUrl = process.env.ROUTER_URL;
  if (!routerUrl) return;
  const { meshPost } = require('./middleware/mesh');
  const name    = process.env.BACKEND_LABEL  || 'Backend';
  const region  = process.env.BACKEND_REGION || null;
  // SELF_URL must be set on Render to this backend's own URL
  const selfUrl = process.env.SELF_URL || '';
  if (!selfUrl) {
    console.warn(`[${name}] [mesh] SELF_URL not set — skipping router announcement`);
    return;
  }
  for (let attempt = 1; attempt <= 4; attempt++) {
    const result = await meshPost(name, `${routerUrl}/mesh/register`, { url: selfUrl, name, region });
    if (result.ok) {
      console.log(`[${name}] [mesh] Announced to router — joined fleet (attempt ${attempt})`);
      return;
    }
    if (attempt < 4) await new Promise(r => setTimeout(r, attempt * 3000));
  }
  console.warn(`[${process.env.BACKEND_LABEL || 'Backend'}] [mesh] Could not announce to router — will be discovered on next keepalive`);
}

connectDB().then(() => {
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => {
    const name   = process.env.BACKEND_LABEL  || 'Backend';
    const region = process.env.BACKEND_REGION ? ` — ${process.env.BACKEND_REGION}` : '';
    console.log('\n' + '═'.repeat(70));
    console.log(` PlanIt Backend — ${name}${region}`);
    console.log('═'.repeat(70));
    console.log(`  Port:        ${PORT}`);
    console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`  CORS Origin: ${process.env.CORS_ORIGIN || 'http://localhost:5173'}`);
    console.log(`  Storage:     ${process.env.CLOUDINARY_CLOUD_NAME ? 'Cloudinary' : 'Local'}`);
    console.log('═'.repeat(70));
    console.log('\nServer ready. Announcing to mesh...\n');

    // Announce to router after a short delay to let process fully settle
    setTimeout(announceToRouter, 4000);
  });
});

// Initialize WebSocket chat
require('./socket/chatSocket')(io);


process.on('SIGTERM', () => {
  console.log('\n SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('✓ HTTP server closed');
    mongoose.connection.close(false, () => {
      console.log('✓ MongoDB connection closed');
      console.log(' Server shutdown complete');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('\n SIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('✓ HTTP server closed');
    mongoose.connection.close(false, () => {
      console.log('✓ MongoDB connection closed');
      console.log(' Server shutdown complete');
      process.exit(0);
    });
  });
});

// Handle unhandled promise rejections
//
// FIX: The original handler called server.close() + process.exit(1) here.
// That means any single unhandled rejection — e.g. a network blip on a file
// upload — would kill the entire server, drop all active connections, and make
// the uptime monitor report a 503 until the process restarted.
//
// The correct approach is to LOG the error so it can be diagnosed, but keep the
// server running. Legitimate reasons to exit (out of memory, corrupted state)
// will surface through other means. An upload failing is not one of them.
process.on('unhandledRejection', (err) => {
  console.error('[PlanIt] Unhandled Promise Rejection (server kept alive):', err);
  console.error('   Stack:', err?.stack);
});

// Handle uncaught exceptions
//
// FIX: Same issue as above. The original handler exited the process on any
// uncaught exception. A stream 'error' event with no listener (e.g. from the
// Cloudinary upload stream on a network failure) becomes an uncaughtException
// in Node.js — which was crashing the whole server on every failed upload.
//
// Fatal system errors (ENOMEM, etc.) will still surface here and can be
// identified in logs, but routine runtime errors no longer take the server down.
process.on('uncaughtException', (err) => {
  console.error('[PlanIt] Uncaught Exception (server kept alive):', err);
  console.error('   Stack:', err?.stack);
});

module.exports = { app, server, io };
