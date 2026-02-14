const rateLimit = require('express-rate-limit');

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: (process.env.RATE_LIMIT_WINDOW || 15) * 60 * 1000, // 15 minutes default
  max: process.env.RATE_LIMIT_MAX || 10000, // 100 requests per window
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: 'Check the Retry-After header'
  },
  standardHeaders: true,
  legacyHeaders: false,
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
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
  skipSuccessfulRequests: true,
  message: {
    error: 'Too many authentication attempts, please try again later.'
  }
});

// File upload limiter
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 uploads per hour
  message: {
    error: 'Too many file uploads, please try again later.'
  }
});

// Event creation limiter
const createEventLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 events per hour
  message: {
    error: 'Too many events created, please try again later.'
  }
});

// Chat message limiter (per event)
const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 messages per minute
  keyGenerator: (req) => {
    // Rate limit per IP + event combination
    return `${req.ip}-${req.params.eventId || req.body.eventId}`;
  },
  message: {
    error: 'Too many messages, please slow down.'
  }
});

module.exports = {
  apiLimiter,
  authLimiter,
  uploadLimiter,
  createEventLimiter,
  chatLimiter
};
