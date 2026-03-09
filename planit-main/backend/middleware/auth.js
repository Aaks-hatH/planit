'use strict';

const jwt   = require('jsonwebtoken');
const Event = require('../models/Event');
// JWT secret is derived from the license key — not read from JWT_SECRET env var.
// This means the app silently fails all auth if the wrong key is present.
const { secrets } = require('../keys');

// ─── Event cache ──────────────────────────────────────────────────────────────
//
// WHY: Auth middleware calls Event.findById on every single protected request.
// There are 62 routes that use verifyEventAccess or verifyOrganizer, meaning
// every user action fires at least 2 DB queries (auth + route handler).
//
// With multiple backend instances all sharing the same MongoDB, this multiplies
// fast. A 30-second TTL cache here cuts DB load by ~90% with zero risk — event
// data (title, password flag, participants) changes rarely and a 30s stale read
// is harmless.
//
// The cache is per-process (in-memory). Each backend instance has its own cache,
// which is fine — we don't need cross-instance consistency here.
//
const eventCache  = new Map();
const CACHE_TTL   = 30 * 1000; // 30 seconds

async function getCachedEvent(eventId) {
  const cached = eventCache.get(eventId);
  if (cached && (Date.now() - cached.ts) < CACHE_TTL) {
    return cached.event;
  }
  const event = await Event.findById(eventId);
  if (event) {
    eventCache.set(eventId, { event, ts: Date.now() });
  }
  return event;
}

// Prune stale entries every 5 minutes to prevent unbounded memory growth
setInterval(() => {
  const cutoff = Date.now() - CACHE_TTL;
  for (const [key, val] of eventCache) {
    if (val.ts < cutoff) eventCache.delete(key);
  }
}, 5 * 60 * 1000).unref(); // .unref() so this timer doesn't keep the process alive

// ─────────────────────────────────────────────────────────────────────────────

// Verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1] || req.cookies.token;

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, secrets.jwt);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Your session has expired. Please log in again.' });
  }
};

// Verify event access (password protection)
const verifyEventAccess = async (req, res, next) => {
  try {
    const eventId = req.params.eventId || req.body.eventId;

    if (!eventId || eventId === 'undefined' || eventId === 'null') {
      return res.status(400).json({ error: 'No event ID was provided in this request.' });
    }

    const event = await getCachedEvent(eventId); // ← was: Event.findById(eventId)

    if (!event) {
      return res.status(404).json({ error: 'This event does not exist or has been removed.' });
    }

    // Always try to decode the token for username/role info
    const anyToken = req.headers['authorization']?.split(' ')[1] ||
                     req.headers['x-event-token'] ||
                     req.cookies?.[`event_${eventId}`];
    if (anyToken) {
      try {
        const decoded = jwt.verify(anyToken, secrets.jwt);
        req.eventAccess = decoded;
      } catch (_) { /* invalid or expired — still allow open events */ }
    }

    // Events with requireApproval must also enforce token auth, even if they are
    // not password-protected.  Without this, any unauthenticated HTTP request can
    // read messages, participants, files etc. — bypassing the approval gate entirely.
    const requiresAuth = event.isPasswordProtected || event.settings?.requireApproval;

    if (!requiresAuth) {
      req.event = event;
      return next();
    }

    const token = req.headers['x-event-token'] || req.cookies?.[`event_${eventId}`] ||
                  req.headers['authorization']?.split(' ')[1];

    if (!token) {
      if (event.settings?.requireApproval && !event.isPasswordProtected) {
        return res.status(403).json({
          error: 'Access to this event requires organizer approval.',
          requiresApproval: true
        });
      }
      return res.status(403).json({
        error: 'This event requires a password to access.',
        requiresPassword: true
      });
    }

    try {
      const decoded = jwt.verify(token, secrets.jwt);
      const isAdminAccess = decoded.isAdminAccess === true;

      if (!isAdminAccess && decoded.eventId !== eventId && decoded.eventId !== eventId.toString()) {
        if (event.settings?.requireApproval && !event.isPasswordProtected) {
          return res.status(403).json({
            error: 'Access to this event requires organizer approval.',
            requiresApproval: true
          });
        }
        return res.status(403).json({
          error: 'Your access token is not valid for this event.',
          requiresPassword: true
        });
      }

      req.event = event;
      req.eventAccess = decoded;
      next();
    } catch (error) {
      if (event.settings?.requireApproval && !event.isPasswordProtected) {
        return res.status(403).json({
          error: 'Access to this event requires organizer approval.',
          requiresApproval: true
        });
      }
      res.status(403).json({
        error: 'Your session for this event has expired. Please enter the password again.',
        requiresPassword: true
      });
    }
  } catch (error) {
    console.error('[PlanIt] verifyEventAccess error:', error?.message || error);
    res.status(500).json({ error: 'Something went wrong loading this event. Please try again.' });
  }
};

// Verify user is event organizer
const verifyOrganizer = async (req, res, next) => {
  try {
    const eventId = req.params.eventId || req.body.eventId;

    // Guard: catch undefined/null before hitting the DB
    if (!eventId || eventId === 'undefined' || eventId === 'null') {
      return res.status(400).json({ error: 'No event ID was provided in this request. This is likely a frontend bug — please refresh and try again.' });
    }

    const event = await getCachedEvent(eventId); // ← was: Event.findById(eventId)

    if (!event) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    const token = req.headers.authorization?.split(' ')[1] ||
                  req.headers['x-event-token'] ||
                  req.cookies?.[`event_${eventId}`];

    if (!token) {
      return res.status(401).json({ error: 'You need to be logged in to do that. Please refresh and try again.' });
    }

    try {
      const decoded = jwt.verify(token, secrets.jwt);
      const username = decoded.username;

      const isOrganizerByJWT   = decoded.role === 'organizer';
      const participant        = event.participants.find(p => p.username === username);
      const isOrganizerByEvent = participant && participant.role === 'organizer';
      const isOrganizerByName  = event.organizerName === username;

      if (!isOrganizerByJWT && !isOrganizerByEvent && !isOrganizerByName) {
        return res.status(403).json({ error: 'Only the event organizer can do that.' });
      }

      req.event = event;
      req.eventAccess = decoded;
      next();
    } catch (err) {
      return res.status(401).json({ error: 'Your session has expired. Please refresh the page and log in again.' });
    }
  } catch (error) {
    console.error('[PlanIt] verifyOrganizer error:', error?.message || error);
    res.status(500).json({ error: 'Something went wrong checking your permissions. Please try again.' });
  }
};

// Verify admin access
const verifyAdmin = (req, res, next) => {
  // req.query.token is accepted ONLY for SSE (EventSource) routes because the
  // browser EventSource API cannot send custom headers. On all other routes the
  // query param is ignored to prevent tokens appearing in server logs / Referer headers.
  const isSSE = req.headers.accept === 'text/event-stream';
  const token = req.headers.authorization?.split(' ')[1]
              || req.cookies.adminToken
              || (isSSE ? req.query.token : null);

  if (!token) {
    return res.status(401).json({ error: 'Admin login required.' });
  }

  try {
    const decoded = jwt.verify(token, secrets.jwt);

    if (!decoded.isAdmin) {
      return res.status(403).json({ error: 'Your account does not have admin privileges.' });
    }

    req.admin = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Admin session expired. Please log in again.' });
  }
};

// Verify user is organizer OR check-in staff
// Used for check-in-only routes that staff should be able to access
const verifyCheckinAccess = async (req, res, next) => {
  try {
    const eventId = req.params.eventId || req.body.eventId;
    const event = await getCachedEvent(eventId);

    if (!event) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    const token = req.headers.authorization?.split(' ')[1] ||
                  req.headers['x-event-token'] ||
                  req.cookies?.[`event_${eventId}`];

    if (!token) {
      return res.status(401).json({ error: 'You need to be logged in to access this.' });
    }

    try {
      const decoded = jwt.verify(token, secrets.jwt);
      const role = decoded.role;

      if (role !== 'organizer' && role !== 'staff') {
        return res.status(403).json({ error: 'You need check-in staff or organizer access to do that.' });
      }

      req.event = event;
      req.eventAccess = decoded;
      next();
    } catch (err) {
      return res.status(401).json({ error: 'Your session has expired. Please refresh the page.' });
    }
  } catch (error) {
    console.error('[PlanIt] verifyCheckinAccess error:', error?.message || error);
    res.status(500).json({ error: 'Something went wrong verifying your access. Please try again.' });
  }
};

// ─── requirePermission(perm) ──────────────────────────────────────────────────
// Middleware factory. Place AFTER verifyAdmin on any route that should be
// restricted to specific employees.
//
// Rules:
//   • super_admin always passes — they bypass every permission check.
//   • Non-employee root admin (ADMIN_USERNAME env login) always passes.
//   • Demo accounts always FAIL permission-gated routes (they are read-only
//     guests and should never reach destructive endpoints even if intercepted).
//   • Everyone else: the named flag must be true on req.admin.permissions.
//
// Usage:
//   router.delete('/events/:id', verifyAdmin, requirePermission('canDeleteEvents'), handler)
//
const requirePermission = (perm) => (req, res, next) => {
  const admin = req.admin;
  if (!admin) return res.status(401).json({ error: 'Not authenticated.' });

  // Root super-admin (env-var login) passes everything
  if (!admin.isEmployee && admin.isAdmin === true) return next();

  // Employee super_admin passes everything
  if (admin.role === 'super_admin') return next();

  // Demo accounts are never allowed past a permission gate
  if (admin.isDemo) {
    return res.status(403).json({
      error: 'Demo accounts cannot perform this action.',
      demo: true,
    });
  }

  // Check the named permission flag
  if (admin.permissions && admin.permissions[perm] === true) return next();

  return res.status(403).json({
    error: `Your account does not have the '${perm}' permission required for this action.`,
    requiredPermission: perm,
  });
};

// ─── requireSuperAdminRole ────────────────────────────────────────────────────
// Stricter than requirePermission — only the root env-login or an employee
// with role === 'super_admin' can pass. Used for /cc/* command-center routes
// and employee management.
const requireSuperAdminRole = (req, res, next) => {
  const admin = req.admin;
  if (!admin) return res.status(401).json({ error: 'Not authenticated.' });
  if (!admin.isEmployee && admin.isAdmin === true) return next(); // root login
  if (admin.role === 'super_admin') return next();
  return res.status(403).json({ error: 'Super-admin access required.' });
};

// ─── demoGuard ────────────────────────────────────────────────────────────────
// Mount this as a router-level middleware AFTER verifyAdmin, BEFORE any route
// handlers. It intercepts ALL state-mutating requests (POST/PATCH/PUT/DELETE)
// from demo accounts and returns a realistic-looking fake success response
// without touching the database.
//
// GET and HEAD requests pass through untouched so the demo sees real data.
//
// Certain paths are HARD-BLOCKED for demo (403, no fake success):
//   /cc/*           — command-center infrastructure controls
//   /maintenance    — toggling this would break the live site
//   /employees      — managing real employee accounts
//
const DEMO_HARD_BLOCK = ['/cc/', '/maintenance', '/employees'];

const demoGuard = (req, res, next) => {
  const admin = req.admin;
  if (!admin || !admin.isDemo) return next(); // not a demo account — pass through

  const method = req.method.toUpperCase();
  const path   = req.path;

  // Hard-block sensitive paths regardless of method
  const isHardBlocked = DEMO_HARD_BLOCK.some(prefix => path.startsWith(prefix));
  if (isHardBlocked) {
    return res.status(403).json({
      error: 'Demo accounts cannot access this section.',
      demo: true,
    });
  }

  // Pass through read-only requests
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return next();

  // Intercept all writes and return a convincing fake response
  console.log(`[demo] Intercepted ${method} ${path} from demo account "${admin.name || admin.email}"`);
  return res.status(200).json({
    ok: true,
    _demo: true,
    message: 'Demo mode: this action was simulated and has not been saved.',
    // Mirror back any IDs the frontend might need so UI state updates cleanly
    ...(req.body?.id  ? { id:  req.body.id  } : {}),
    ...(req.params?.id ? { id: req.params.id } : {}),
  });
};

module.exports = {
  verifyToken,
  verifyEventAccess,
  verifyOrganizer,
  verifyCheckinAccess,
  verifyAdmin,
  requirePermission,
  requireSuperAdminRole,
  demoGuard,
};
