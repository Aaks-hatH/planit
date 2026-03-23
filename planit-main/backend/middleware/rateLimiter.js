const rateLimit = require('express-rate-limit');
const { realIp: resolveRealIp, isPrivate } = require('./realIp');

// ── Real-IP resolver ──────────────────────────────────────────────────────────
// Delegates to the shared realIp module (CF-Connecting-IP → XFF → req.ip)
// which correctly skips all private/internal ranges (10.x, 172.16-31.x, etc.).
// If the resolved IP is private/unknown (internal Render hop without Cloudflare),
// return a per-request unique key so we never rate-limit one user as all users.
function realIp(req) {
  const ip = resolveRealIp(req);
  // If we can't determine a real public IP, derive a key from the Authorization
  // token or a unique request ID so limits don't collapse all traffic onto one key.
  if (isPrivate(ip) || ip === 'unknown') {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7, 47) : null;
    if (token) return `tok:${token}`;
    // Absolute last resort: let it through ungrouped
    return `priv:${Math.random()}`;
  }
  return ip;
}

// ── Skip helpers ──────────────────────────────────────────────────────────────
// Health-check and internal mesh routes must NEVER be rate-limited.
// The router pings /api/mesh/health and /api/mesh/seen every 4 minutes.
// The watchdog pings /api/health every 60 s.
// Counting these against user-facing quotas causes false "backend down" alerts.
const skipInternal = (req) => {
  const p = req.path;
  // req.path is stripped of the /api/ prefix by the time it reaches the
  // middleware mounted via app.use('/api/', apiLimiter).
  return (
    p === '/health'       ||   // watchdog + healthcheck probes
    p.startsWith('/mesh') ||   // router keepalive / mesh protocol
    p === '/uptime/ping'       // uptime reporting ping
  );
};

// General API rate limiter — applied to all /api/* except internal paths above.
const apiLimiter = rateLimit({
  windowMs: (process.env.RATE_LIMIT_WINDOW || 15) * 60 * 1000,
  max:      process.env.RATE_LIMIT_MAX || 10000,
  standardHeaders: true,
  legacyHeaders:   false,
  skip:            skipInternal,
  keyGenerator:    realIp,
  handler: (req, res) => {
    res.status(429).json({
      error:       'Too many requests',
      message:     'You have exceeded the rate limit. Please try again later.',
      retryAfter:  res.getHeader('Retry-After'),
    });
  },
});

// Stricter limiter for authentication endpoints
const authLimiter = rateLimit({
  windowMs:              15 * 60 * 1000,
  max:                   20,
  skipSuccessfulRequests: true,
  standardHeaders:        true,
  legacyHeaders:          false,
  keyGenerator:           realIp,
  message: {
    error: 'Too many authentication attempts, please try again in 15 minutes.',
  },
});

// File upload limiter
const uploadLimiter = rateLimit({
  windowMs:        60 * 60 * 1000,
  max:             20,
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator:    realIp,
  message:         { error: 'Too many file uploads, please try again later.' },
});

// Event creation limiter
const createEventLimiter = rateLimit({
  windowMs:        60 * 60 * 1000,
  max:             10,
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator:    realIp,
  message:         { error: 'Too many events created, please try again later.' },
});

// Chat message limiter
const chatLimiter = rateLimit({
  windowMs:        60 * 1000,
  max:             30,
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator: (req) => {
    const ip      = realIp(req);
    const eventId = req.params.eventId || req.body?.eventId || 'none';
    return `${ip}-${eventId}`;
  },
  message: { error: 'Too many messages, please slow down.' },
});

// Join endpoint limiter
const joinLimiter = rateLimit({
  windowMs:        10 * 60 * 1000,
  max:             30,
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator: (req) => {
    const ip      = realIp(req);
    const eventId = req.params.eventId || 'none';
    return `join:${ip}:${eventId}`;
  },
  handler: (req, res) => {
    res.status(429).json({
      error:       'Too many join attempts from this network. Please try again later.',
      retryAfter:  res.getHeader('Retry-After'),
    });
  },
});

// Honeypot middleware
function honeypotCheck(req, res, next) {
  if (req.body && req.body._confirm !== undefined) {
    return res.status(200).json({ message: 'Joined successfully', token: null, event: {} });
  }
  next();
}

// Public reservation limiter
const reservationLimiter = rateLimit({
  windowMs:        60 * 60 * 1000,
  max:             10,
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator: (req) => {
    const ip        = realIp(req);
    const subdomain = req.params.subdomain || 'none';
    return `reserve:${ip}:${subdomain}`;
  },
  handler: (req, res) => {
    res.status(429).json({
      error:      'Too many reservation attempts from this connection. Please try again in an hour.',
      retryAfter: res.getHeader('Retry-After'),
    });
  },
});

// Reservation availability check limiter
const availabilityLimiter = rateLimit({
  windowMs:        60 * 1000,
  max:             60,
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator:    realIp,
  message:         { error: 'Too many availability requests, please slow down.' },
});

module.exports = {
  apiLimiter,
  authLimiter,
  uploadLimiter,
  createEventLimiter,
  chatLimiter,
  joinLimiter,
  honeypotCheck,
  reservationLimiter,
  availabilityLimiter,
};
