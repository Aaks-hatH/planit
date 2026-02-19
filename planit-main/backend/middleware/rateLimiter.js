const rateLimit = require('express-rate-limit');

// ── Skip function for health checks ──────────────────────────────────────
const skipHealthCheck = (req) => req.path === '/health';

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: (process.env.RATE_LIMIT_WINDOW || 15) * 60 * 1000,
  max: process.env.RATE_LIMIT_MAX || 10000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipHealthCheck,
  // Use x-forwarded-for when available (Render sets trust proxy 1 in server.js)
  keyGenerator: (req) => {
    return req.ip || req.socket?.remoteAddress || 'unknown';
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many requests',
      message: 'You have exceeded the rate limit. Please try again later.',
      retryAfter: res.getHeader('Retry-After')
    });
  }
});

// Stricter limiter for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // increased slightly from 5 to reduce frustration while still protecting
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.ip || req.socket?.remoteAddress || 'unknown';
  },
  message: {
    error: 'Too many authentication attempts, please try again in 15 minutes.'
  }
});

// File upload limiter
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || req.socket?.remoteAddress || 'unknown',
  message: { error: 'Too many file uploads, please try again later.' }
});

// Event creation limiter
const createEventLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || req.socket?.remoteAddress || 'unknown',
  message: { error: 'Too many events created, please try again later.' }
});

// Chat message limiter
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    return `${ip}-${req.params.eventId || req.body?.eventId || 'none'}`;
  },
  message: { error: 'Too many messages, please slow down.' }
});

module.exports = {
  apiLimiter,
  authLimiter,
  uploadLimiter,
  createEventLimiter,
  chatLimiter
};
