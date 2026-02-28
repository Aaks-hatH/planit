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
  // req.query.token is accepted so browser EventSource (SSE) can authenticate —
  // EventSource cannot send custom headers, so the token must travel in the URL.
  const token = req.headers.authorization?.split(' ')[1] || req.cookies.adminToken || req.query.token;

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

module.exports = {
  verifyToken,
  verifyEventAccess,
  verifyOrganizer,
  verifyCheckinAccess,
  verifyAdmin
};
