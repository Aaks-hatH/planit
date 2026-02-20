/*
Copyright (C) 2026 Aakshat Hariharan 

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, version 3.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.
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
const supportRoutes = require('./routes/support');

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
  }
});

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

const { apiLimiter } = require('./middleware/rateLimiter');
const { errorHandler } = require('./middleware/errorHandler');
const { attachResponseSignature } = require('./middleware/responseSigning');

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
app.use('/api/', apiLimiter);
app.use('/api/', attachResponseSignature); // Sign every API response with the license-derived key
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Mount routes
app.use('/api/events', eventRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/polls', pollRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/support', supportRoutes);
app.use('/api', publicRoutes);
app.use('/api/events', checkinRoutes);
app.use('/api/events', dataRetentionRoutes);

// Health check endpoint
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

// ─── UptimeRobot HEAD requests ────────────────────────────────────────────
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


app.get('*', (req, res) => {
  res.redirect(301, 'FRONTEND_URL' + req.path);
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

connectDB().then(() => {
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => {
    console.log('\n' + '═'.repeat(70));
    console.log(' PlanIt Server Started');
    console.log('═'.repeat(70));
    console.log(`  Port:        ${PORT}`);
    console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`  CORS Origin: ${process.env.CORS_ORIGIN || 'http://localhost:5173'}`);
    console.log(`  Storage:     ${process.env.CLOUDINARY_CLOUD_NAME ? 'Cloudinary ' : 'Local'}`);
    console.log('═'.repeat(70));
    console.log('\nServer ready to accept connections! \n');
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
process.on('unhandledRejection', (err) => {
  console.error(' Unhandled Promise Rejection:', err);
  console.error('   Stack:', err.stack);
  // Close server & exit process
  server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error(' Uncaught Exception:', err);
  console.error('   Stack:', err.stack);
  // Close server & exit process
  server.close(() => process.exit(1));
});

module.exports = { app, server, io };
