'use strict';

const jwt   = require('jsonwebtoken');
const Event = require('../models/Event');
// JWT secret is derived from the license key — not read from JWT_SECRET env var.
// This means the app silently fails all auth if the wrong key is present.
const { secrets } = require('../keys');
// Redis for session revocation checks (brute-force lockout keys also live here)
const redis = require('../services/redisClient');

// ─── Session revocation key helpers ───────────────────────────────────────────
// When an employee is suspended or deleted, their employee-level revocation key
// is set in Redis with a 25-hour TTL (24h token max-age + 1h buffer).
// verifyAdmin checks this key and rejects tokens issued before the revocation.
//
// Key format:  revoked:emp:{employeeId}  →  unix-ms timestamp of revocation
// Any token whose iat (issued-at) is earlier than that timestamp is invalid.
const REVOCATION_KEY = (empId) => `revoked:emp:${empId}`;
const REVOCATION_TTL = 25 * 60 * 60; // 25 hours

// Exported so admin.js can call them on suspend/delete/force-reset
async function revokeEmployeeSessions(employeeId) {
  try {
    await redis.set(REVOCATION_KEY(employeeId), Date.now().toString(), REVOCATION_TTL);
  } catch (e) {
    console.error('[auth] revokeEmployeeSessions failed (non-fatal):', e.message);
  }
}

async function clearEmployeeRevocation(employeeId) {
  try {
    await redis.del(REVOCATION_KEY(employeeId));
  } catch (e) {
    console.error('[auth] clearEmployeeRevocation failed (non-fatal):', e.message);
  }
}

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

      // SECURITY FIX: isOrganizerByName removed — it did not verify the JWT's
      // eventId matched the current event, allowing cross-event privilege escalation
      // (any organiser token for event A granted organiser access to event B, C, D…
      // as long as organizerName matched). isOrganizerByJWT + isOrganizerByEvent are
      // sufficient and do not have this flaw.

      // Enforce that the JWT was issued for THIS event (unless it's an admin override)
      const isAdminAccess = decoded.isAdminAccess === true;
      const tokenEventId  = decoded.eventId;
      const eventIdMatch  = isAdminAccess ||
                            tokenEventId === eventId ||
                            tokenEventId === eventId.toString();

      if (!eventIdMatch) {
        return res.status(403).json({ error: 'Only the event organizer can do that.' });
      }

      if (!isOrganizerByJWT && !isOrganizerByEvent) {
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
// ─── IMPORTANT: now async — it checks Redis for session revocation. ───────────
// Suspended or deleted employees have a `revoked:emp:{id}` key in Redis.
// Any token issued BEFORE the revocation timestamp is rejected, even if the JWT
// signature is still valid. This closes the gap where a suspended employee's
// 24-hour token would otherwise continue to work until natural expiry.
const verifyAdmin = async (req, res, next) => {
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

  let decoded;
  try {
    decoded = jwt.verify(token, secrets.jwt);
  } catch (error) {
    return res.status(401).json({ error: 'Admin session expired. Please log in again.' });
  }

  if (!decoded.isAdmin) {
    return res.status(403).json({ error: 'Your account does not have admin privileges.' });
  }

  // ── Restricted tokens (forcePasswordReset) must not access normal routes ──
  if (decoded.restricted) {
    return res.status(403).json({
      error: 'You must change your password before continuing.',
      forcePasswordReset: true,
    });
  }

  // ── Session revocation check (for employee tokens only) ───────────────────
  // Root admin (env-login) tokens have no employeeId — skip revocation check.
  if (decoded.isEmployee && decoded.employeeId) {
    try {
      const revokedAt = await redis.get(REVOCATION_KEY(decoded.employeeId));
      if (revokedAt) {
        const revokedTs  = parseInt(revokedAt, 10);
        const issuedAtMs = (decoded.iat || 0) * 1000; // JWT iat is in seconds
        if (issuedAtMs < revokedTs) {
          return res.status(401).json({
            error: 'Your session has been revoked. Please log in again.',
            revoked: true,
          });
        }
      }
    } catch (redisErr) {
      // Redis unavailable — fail OPEN to avoid locking everyone out on Redis downtime.
      // Log the error so ops can investigate.
      console.error('[auth] Redis revocation check failed (fail-open):', redisErr.message);
    }
  }

  req.admin = decoded;
  next();
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
  revokeEmployeeSessions,
  clearEmployeeRevocation,
};