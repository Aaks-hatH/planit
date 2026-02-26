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

// ── Join endpoint limiter ─────────────────────────────────────────────────
// Keyed on IP + eventId so a single attacker cannot bulk-register fake guests
// across a single event even by rotating user agents.
// 30 joins per IP per 10 minutes is generous for a real user but expensive to
// abuse at scale.
const joinLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,  // 10 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const eventId = req.params.eventId || 'none';
    return `join:${ip}:${eventId}`;
  },
  handler: (req, res) => {
    res.status(429).json({
      error: 'Too many join attempts from this network. Please try again later.',
      retryAfter: res.getHeader('Retry-After'),
    });
  },
});

// ── Honeypot middleware ───────────────────────────────────────────────────
// Expects the join body to NOT contain a field called `_confirm`.
// Legitimate frontend never sends it; bots filling all fields often will.
// Silent rejection — no indication to the bot that it was caught.
function honeypotCheck(req, res, next) {
  if (req.body && req.body._confirm !== undefined) {
    // Return a plausible success so bots don't retry
    return res.status(200).json({ message: 'Joined successfully', token: null, event: {} });
  }
  next();
}

module.exports = {
  apiLimiter,
  authLimiter,
  uploadLimiter,
  createEventLimiter,
  chatLimiter,
  joinLimiter,
  honeypotCheck,
};
