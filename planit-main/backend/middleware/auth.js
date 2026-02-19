'use strict';

const jwt   = require('jsonwebtoken');
const Event = require('../models/Event');
// JWT secret is derived from the license key — not read from JWT_SECRET env var.
// This means the app silently fails all auth if the wrong key is present.
const { secrets } = require('../keys');

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
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
};

// Verify event access (password protection)
const verifyEventAccess = async (req, res, next) => {
  try {
    const eventId = req.params.eventId || req.body.eventId;
    const event = await Event.findById(eventId);

    if (!event) {
      return res.status(404).json({ error: 'Event not found.' });
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

    if (!event.isPasswordProtected) {
      req.event = event;
      return next();
    }

    const token = req.headers['x-event-token'] || req.cookies?.[`event_${eventId}`] ||
                  req.headers['authorization']?.split(' ')[1];

    if (!token) {
      return res.status(403).json({
        error: 'This event is password protected.',
        requiresPassword: true
      });
    }

    try {
      const decoded = jwt.verify(token, secrets.jwt);
      const isAdminAccess = decoded.isAdminAccess === true;

      if (!isAdminAccess && decoded.eventId !== eventId && decoded.eventId !== eventId.toString()) {
        return res.status(403).json({
          error: 'Invalid event access token.',
          requiresPassword: true
        });
      }

      req.event = event;
      req.eventAccess = decoded;
      next();
    } catch (error) {
      res.status(403).json({
        error: 'Invalid or expired event access token.',
        requiresPassword: true
      });
    }
  } catch (error) {
    res.status(500).json({ error: 'Server error verifying event access.' });
  }
};

// Verify user is event organizer
const verifyOrganizer = async (req, res, next) => {
  try {
    const eventId = req.params.eventId || req.body.eventId;
    const event = await Event.findById(eventId);

    if (!event) {
      return res.status(404).json({ error: 'Event not found.' });
    }

    const token = req.headers.authorization?.split(' ')[1] ||
                  req.headers['x-event-token'] ||
                  req.cookies[`event_${eventId}`];

    if (!token) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    try {
      const decoded = jwt.verify(token, secrets.jwt);
      const username = decoded.username;

      const isOrganizerByJWT   = decoded.role === 'organizer';
      const participant        = event.participants.find(p => p.username === username);
      const isOrganizerByEvent = participant && participant.role === 'organizer';
      const isOrganizerByName  = event.organizerName === username;

      if (!isOrganizerByJWT && !isOrganizerByEvent && !isOrganizerByName) {
        return res.status(403).json({ error: 'Only organizers can perform this action.' });
      }

      req.event = event;
      req.eventAccess = decoded;
      next();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token.' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Server error verifying organizer status.' });
  }
};

// Verify admin access
const verifyAdmin = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1] || req.cookies.adminToken;

  if (!token) {
    return res.status(401).json({ error: 'Admin access denied.' });
  }

  try {
    const decoded = jwt.verify(token, secrets.jwt);

    if (!decoded.isAdmin) {
      return res.status(403).json({ error: 'Admin privileges required.' });
    }

    req.admin = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid admin token.' });
  }
};

module.exports = {
  verifyToken,
  verifyEventAccess,
  verifyOrganizer,
  verifyAdmin
};
