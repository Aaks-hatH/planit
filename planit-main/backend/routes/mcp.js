/*
 * PLANIT PROPRIETARY LICENSE
 * Copyright (c) 2026 Aakshat Hariharan. All rights reserved.
 *
 * backend/routes/mcp.js
 *
 * Single MCP proxy endpoint. All tool calls from the MCP npm package flow
 * through POST /mcp/action. Internal routes, models, and business logic are
 * never exposed to the public package.
 *
 * Register in backend/server.js:
 *   app.use('/mcp', require('./routes/mcp'));
 */

'use strict';

const express = require('express');
const crypto  = require('crypto');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');

const router = express.Router();

const redis   = require('../services/redisClient');
const Event   = require('../models/Event');
const Invite  = require('../models/Invite');
const Poll    = require('../models/Poll');
const EventParticipant = require('../models/EventParticipant');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Verify the shared MCP secret on every route. */
function verifySecret(req, res, next) {
  const secret = process.env.MCP_SERVER_SECRET;
  if (!secret) {
    // Fail closed — if the env var is missing, reject everything
    return res.status(503).json({ error: 'MCP integration is not configured on this server.' });
  }
  const provided = req.headers['x-mcp-secret'] || '';
  // Constant-time comparison to prevent timing attacks
  try {
    const match = crypto.timingSafeEqual(
      Buffer.from(provided.padEnd(64, '\0').slice(0, 64)),
      Buffer.from(secret.padEnd(64, '\0').slice(0, 64))
    ) && provided === secret;
    if (!match) return res.status(401).json({ error: 'Unauthorised.' });
  } catch {
    return res.status(401).json({ error: 'Unauthorised.' });
  }
  next();
}

/** Generic error returned to MCP for all auth/validation failures. */
const GENERIC_ERROR = { error: 'Connection failed. Please check your details and try again.' };

/** Sanitise a session ID string. */
function sanitiseSessionId(s) {
  if (typeof s !== 'string') return '';
  return s.replace(/[^a-zA-Z0-9\-_]/g, '').slice(0, 128);
}

/** Resolve a session JWT from Redis and return the decoded payload, or null. */
async function resolveSession(mcpSessionId) {
  if (!mcpSessionId) return null;
  const jwtString = await redis.get(`mcp:session:${mcpSessionId}`);
  if (!jwtString) return null;
  try {
    const mcpJwtSecret = process.env.MCP_JWT_SECRET;
    if (!mcpJwtSecret) return null;
    return jwt.verify(jwtString, mcpJwtSecret);
  } catch {
    return null;
  }
}

/**
 * Sign a scoped MCP session JWT for `event` and store it in Redis under
 * `mcpSessionId`, exactly as connect/verify does. Shared so create_event
 * can self-authenticate a brand-new event without a separate connect step.
 * Returns true on success, false if MCP_JWT_SECRET is missing (caller
 * should treat that as a non-fatal "session wasn't minted" case — the
 * event itself is still created either way).
 */
async function mintMcpSession(mcpSessionId, event) {
  const mcpJwtSecret = process.env.MCP_JWT_SECRET;
  if (!mcpJwtSecret) return false;

  await redis.del(`mcp:session:${mcpSessionId}`);

  let expUnix;
  if (event.date) {
    expUnix = Math.floor(event.date.getTime() / 1000) + 7 * 24 * 60 * 60;
  } else {
    expUnix = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
  }
  const minExp = Math.floor(Date.now() / 1000) + 60 * 60; // at least 1h from now
  if (expUnix < minExp) expUnix = minExp;

  const payload = {
    eventId: event._id.toString(),
    subdomain: event.subdomain,
    role: 'mcp-organizer',
    sessionId: mcpSessionId,
  };

  const signedJwt = jwt.sign(payload, mcpJwtSecret, { expiresIn: expUnix - Math.floor(Date.now() / 1000) });
  const ttlSeconds = expUnix - Math.floor(Date.now() / 1000);
  await redis.set(`mcp:session:${mcpSessionId}`, signedJwt, ttlSeconds);
  return true;
}

// ─── Rate limiters ────────────────────────────────────────────────────────────

// 10 init requests per IP per hour
const initLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({ error: 'Too many requests. Please try again later.' }),
});

// 5 verify attempts per IP per 15 minutes
const verifyIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => res.status(429).json(GENERIC_ERROR),
});

// 3 verify attempts per event ID per 15 minutes (tracked in Redis to survive restarts)
async function verifyEventIdLimiter(req, res, next) {
  const eventId = (req.body?.eventId || '').toLowerCase().trim();
  if (!eventId) return next();

  const key = `mcp:rl:verify:event:${eventId}`;
  try {
    const current = await redis.incrWithExpiry(key, 15 * 60);
    if (current > 3) {
      return res.status(429).json(GENERIC_ERROR);
    }
  } catch {
    // Non-fatal — allow through if Redis is unavailable
  }
  next();
}

// 60 action requests per session per minute (tracked in Redis)
async function actionRateLimiter(req, res, next) {
  const sessionId = sanitiseSessionId(req.headers['x-mcp-session-id'] || '');
  if (!sessionId) return next();

  const key = `mcp:rl:action:${sessionId}`;
  try {
    const current = await redis.incrWithExpiry(key, 60);
    if (current > 60) {
      return res.status(429).json({ error: 'Too many requests. Please slow down and try again.' });
    }
  } catch {
    // Non-fatal
  }
  next();
}

// 10 event creations per IP per hour. create_event is reachable without a
// prior authenticated session (see /action below), so it needs its own
// IP-scoped limiter on top of actionRateLimiter's per-session one — a
// caller can otherwise mint a fresh session ID per request and bypass
// the per-session limit entirely.
const createEventLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({ error: 'Too many events created from this network. Please try again later.' }),
});

// ─── POST /mcp/connect/init ───────────────────────────────────────────────────

router.post('/connect/init', verifySecret, initLimiter, async (req, res) => {
  const { mcpSessionId } = req.body;

  if (typeof mcpSessionId !== 'string' || !mcpSessionId.trim() || mcpSessionId.length > 128) {
    return res.status(400).json({ error: 'Invalid session ID.' });
  }

  const sanitised = sanitiseSessionId(mcpSessionId);
  if (!sanitised) return res.status(400).json({ error: 'Invalid session ID.' });

  const token = crypto.randomBytes(32).toString('hex'); // 64 hex chars
  await redis.set(`mcp:init:${token}`, sanitised, 600); // 10-minute TTL

  const baseUrl = process.env.PLANIT_FRONTEND_URL || 'https://planitapp.onrender.com';
  return res.json({ connectUrl: `${baseUrl}/claude-connect?token=${token}` });
});

// ─── POST /mcp/connect/verify ─────────────────────────────────────────────────

router.post(
  '/connect/verify',
  verifyIpLimiter,
  verifyEventIdLimiter,
  async (req, res) => {
    const { token, eventId, organizerPassword } = req.body;

    // Step 1: Look up init token in Redis
    let mcpSessionId = null;
    if (typeof token === 'string' && token.length === 64) {
      mcpSessionId = await redis.get(`mcp:init:${token}`);
    }

    // Step 2: Burn token immediately (success OR failure)
    if (typeof token === 'string' && token.length === 64) {
      await redis.del(`mcp:init:${token}`);
    }

    // If token not found (expired or already used)
    if (!mcpSessionId) return res.status(400).json(GENERIC_ERROR);

    // Step 3: Validate inputs
    const subdomain = (typeof eventId === 'string' ? eventId : '').toLowerCase().trim();
    const password  = typeof organizerPassword === 'string' ? organizerPassword : '';
    if (!subdomain || !password) return res.status(400).json(GENERIC_ERROR);

    // Step 4: Find event by subdomain
    let event;
    try {
      event = await Event.findOne({ subdomain });
    } catch {
      return res.status(400).json(GENERIC_ERROR);
    }
    if (!event) return res.status(400).json(GENERIC_ERROR);

    // Step 5: Find organizer participant and verify password
    // The organizer is the first participant with role = 'organizer'
    const organizerRecord = event.participants.find(p => p.role === 'organizer');
    if (!organizerRecord) return res.status(400).json(GENERIC_ERROR);

    let participantDoc;
    try {
      participantDoc = await EventParticipant.findOne({
        eventId: event._id,
        username: organizerRecord.username,
      }).select('+password');
    } catch {
      return res.status(400).json(GENERIC_ERROR);
    }

    if (!participantDoc || !participantDoc.hasPassword || !participantDoc.password) {
      return res.status(400).json(GENERIC_ERROR);
    }

    let passwordMatch = false;
    try {
      passwordMatch = await bcrypt.compare(password, participantDoc.password);
    } catch {
      return res.status(400).json(GENERIC_ERROR);
    }
    if (!passwordMatch) return res.status(400).json(GENERIC_ERROR);

    // Step 6-8: mint and store the scoped session JWT (shared with create_event)
    if (!process.env.MCP_JWT_SECRET) return res.status(503).json({ error: 'Server configuration error.' });
    try {
      await mintMcpSession(mcpSessionId, event);
    } catch {
      return res.status(500).json({ error: 'Failed to issue session token.' });
    }

    return res.json({ success: true, eventName: event.title });
  }
);

// ─── GET /mcp/session/check ───────────────────────────────────────────────────

router.get('/session/check', verifySecret, async (req, res) => {
  const sessionId = sanitiseSessionId(req.headers['x-mcp-session-id'] || '');
  if (!sessionId) return res.json({ authenticated: false });

  const payload = await resolveSession(sessionId);
  if (!payload) return res.json({ authenticated: false });

  // Optionally fetch event name for response
  let eventName = payload.subdomain || payload.eventId;
  try {
    const event = await Event.findById(payload.eventId).select('title').lean();
    if (event) eventName = event.title;
  } catch { /* non-fatal */ }

  return res.json({
    authenticated: true,
    eventId: payload.subdomain || payload.eventId,
    eventName,
  });
});

// ─── POST /mcp/action ─────────────────────────────────────────────────────────

router.post('/action', verifySecret, actionRateLimiter, async (req, res) => {
  const { tool, params = {} } = req.body || {};
  if (typeof tool !== 'string' || !tool) {
    return res.status(400).json({ error: 'Tool name is required.' });
  }

  // create_event is the one tool that legitimately runs with no prior
  // session — there's no event to be "connected" to yet. It gets its own
  // IP rate limit (see createEventLimiter) and self-authenticates the
  // session at the end instead of requiring one up front.
  if (tool === 'create_event') {
    return createEventLimiter(req, res, () => handleCreateEvent(req, res, params));
  }

  const sessionId = sanitiseSessionId(req.headers['x-mcp-session-id'] || '');
  if (!sessionId) return res.status(401).json({ error: 'No session ID provided.' });

  const payload = await resolveSession(sessionId);
  if (!payload) return res.status(401).json({ error: 'Session not authenticated. Please connect your PlanIt event first.' });

  // Load the event once — most handlers need it
  let event;
  try {
    event = await Event.findById(payload.eventId);
    if (!event) return res.status(404).json({ error: 'Event not found. It may have been deleted.' });
  } catch {
    return res.status(500).json({ error: 'Failed to load event data.' });
  }

  try {
    const result = await routeTool(tool, params, event);
    return res.json(result);
  } catch (err) {
    // Never expose raw errors
    const msg = err.isUserFacing ? err.message : 'An error occurred. Please try again.';
    return res.status(500).json({ error: msg });
  }
});

// ─── Tool routing ─────────────────────────────────────────────────────────────

/** Throw a user-facing error */
function userError(message) {
  const err = new Error(message);
  err.isUserFacing = true;
  throw err;
}

/**
 * Handles create_event specifically. Unlike every other tool, this one
 * runs with no authenticated session — it creates one. After the event
 * and organizer participant are saved, it mints a session JWT for the MCP
 * session ID making the request (the transport-level ID, always present
 * even pre-auth) so the very next tool call in the same conversation is
 * already authenticated as that event's organizer. No separate
 * connect-link round trip required.
 */
async function handleCreateEvent(req, res, params) {
  const sessionId = sanitiseSessionId(req.headers['x-mcp-session-id'] || '');
  // sessionId may legitimately be absent (e.g. a bare HTTP client testing
  // this endpoint outside the MCP transport) — event creation still
  // succeeds, it just won't auto-authenticate anything afterward.

  try {
    const { name, date, time, timezone, organizerName, organizerEmail, organizerPassword,
            eventPassword, description, maxGuests, location } = params;

    if (!name || !date || !time || !timezone || !organizerName || !organizerEmail || !organizerPassword) {
      userError('Missing required fields: name, date, time, timezone, organizerName, organizerEmail, organizerPassword.');
    }
    if (organizerPassword.length < 6) userError('Organiser password must be at least 6 characters.');

    const rawSubdomain = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
    const suffix = crypto.randomBytes(3).toString('hex');
    const subdomain = `${rawSubdomain}-${suffix}`;

    const existing = await Event.findOne({ subdomain });
    if (existing) userError('Could not generate a unique event link. Please try again.');

    const dateTime = new Date(`${date}T${time}:00`);

    let hashedEventPassword = null;
    let isPasswordProtected = false;
    if (eventPassword) {
      hashedEventPassword = await bcrypt.hash(eventPassword, 10);
      isPasswordProtected = true;
    }

    const newEvent = new Event({
      subdomain,
      title: name,
      description: description || '',
      date: dateTime,
      timezone,
      location: location || '',
      organizerName,
      organizerEmail,
      password: hashedEventPassword,
      isPasswordProtected,
      maxParticipants: maxGuests || 100,
      participants: [{ username: organizerName, role: 'organizer' }],
    });

    await newEvent.save();

    const hashedOrgPassword = await bcrypt.hash(organizerPassword, 10);
    await EventParticipant.create({
      eventId: newEvent._id,
      username: organizerName,
      password: hashedOrgPassword,
      hasPassword: true,
      role: 'organizer',
    });

    // Self-authenticate this MCP session as the new event's organizer,
    // skipping the separate connect-link step entirely.
    let sessionMinted = false;
    if (sessionId) {
      try {
        sessionMinted = await mintMcpSession(sessionId, newEvent);
      } catch {
        sessionMinted = false; // non-fatal — event is still created either way
      }
    }

    return res.json({
      success: true,
      eventId: subdomain,
      eventName: name,
      eventUrl: `https://planitapp.onrender.com/e/${subdomain}`,
      authenticated: sessionMinted,
      message: sessionMinted
        ? `Event "${name}" created and connected — you're all set to manage it from here.`
        : `Event "${name}" created successfully. Event ID: ${subdomain}`,
    });
  } catch (err) {
    const msg = err.isUserFacing ? err.message : 'An error occurred. Please try again.';
    return res.status(err.isUserFacing ? 400 : 500).json({ error: msg });
  }
}

async function routeTool(tool, params, event) {
  switch (tool) {

    // ── Events ────────────────────────────────────────────────────────────────
    // Note: create_event is handled by handleCreateEvent() before routeTool
    // is ever called — it runs pre-auth and needs different inputs (no
    // existing `event`), so it can't live in this switch.

    case 'get_event': {
      const inviteCount = await Invite.countDocuments({ eventId: event._id });
      const checkedIn   = await Invite.countDocuments({ eventId: event._id, checkedIn: true });
      return {
        id: event.subdomain,
        name: event.title,
        description: event.description,
        date: event.date,
        timezone: event.timezone,
        location: event.location,
        organizerName: event.organizerName,
        organizerEmail: event.organizerEmail,
        maxGuests: event.maxParticipants,
        totalGuests: inviteCount,
        checkedIn,
        isPasswordProtected: event.isPasswordProtected,
        seatingEnabled: event.seatingMap?.enabled || false,
        status: event.status,
        eventUrl: `https://planitapp.onrender.com/e/${event.subdomain}`,
      };
    }

    case 'update_event': {
      const updates = {};
      if (params.name)        updates.title       = params.name;
      if (params.description !== undefined) updates.description = params.description;
      if (params.location !== undefined)    updates.location    = params.location;
      if (params.timezone)    updates.timezone    = params.timezone;
      if (params.maxGuests)   updates.maxParticipants = params.maxGuests;
      if (params.date && params.time) {
        updates.date = new Date(`${params.date}T${params.time}:00`);
      } else if (params.date) {
        const t = event.date ? event.date.toISOString().split('T')[1] : '00:00:00.000Z';
        updates.date = new Date(`${params.date}T${t}`);
      }
      await Event.findByIdAndUpdate(event._id, updates);
      return { success: true, message: 'Event updated successfully.' };
    }

    case 'get_event_status': {
      const totalGuests = await Invite.countDocuments({ eventId: event._id });
      const checkedIn   = await Invite.countDocuments({ eventId: event._id, checkedIn: true });
      const pending     = totalGuests - checkedIn;
      const tables      = event.seatingMap?.objects || [];
      const tableCount  = tables.length;
      const staffCount  = event.participants.filter(p => p.role === 'staff').length;

      let timeUntil = null;
      if (event.date) {
        const diffMs = event.date.getTime() - Date.now();
        if (diffMs > 0) {
          const hours = Math.floor(diffMs / 3600000);
          const mins  = Math.floor((diffMs % 3600000) / 60000);
          timeUntil = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
        } else {
          timeUntil = 'Event has started';
        }
      }

      return {
        totalGuests,
        checkedIn,
        pending,
        checkinPercentage: totalGuests > 0 ? Math.round((checkedIn / totalGuests) * 100) : 0,
        tables: tableCount,
        activeStaff: staffCount,
        timeUntilEvent: timeUntil,
        eventName: event.title,
        eventDate: event.date,
      };
    }

    // ── Guests ────────────────────────────────────────────────────────────────

    case 'add_guest': {
      const { name, email, phone, notes, tableId } = params;
      if (!name) userError('Guest name is required.');

      const inviteCode = crypto.randomBytes(16).toString('hex');
      const invite = new Invite({
        eventId: event._id,
        inviteCode,
        guestName: name,
        guestEmail: email || '',
        guestPhone: phone || '',
        notes: notes || '',
        tableId: tableId || null,
      });

      if (tableId) {
        const table = (event.seatingMap?.objects || []).find(t => t.id === tableId);
        if (table) invite.tableLabel = table.label;
      }

      await invite.save();

      return {
        success: true,
        guestId: invite._id.toString(),
        name: invite.guestName,
        inviteCode,
        inviteUrl: `https://planitapp.onrender.com/invite/${inviteCode}`,
      };
    }

    case 'import_guests': {
      const { guests } = params;
      if (!Array.isArray(guests) || guests.length === 0) userError('Guest list is empty.');

      const docs = guests.map(g => ({
        eventId: event._id,
        inviteCode: crypto.randomBytes(16).toString('hex'),
        guestName: g.name || 'Guest',
        guestEmail: g.email || '',
        guestPhone: g.phone || '',
        notes: g.notes || '',
      }));

      const created = await Invite.insertMany(docs);
      return {
        success: true,
        imported: created.length,
        message: `Successfully added ${created.length} guest${created.length !== 1 ? 's' : ''}.`,
      };
    }

    case 'get_guest_list': {
      const { filter = 'all' } = params;
      let query = { eventId: event._id };
      if (filter === 'checked-in') query.checkedIn = true;
      if (filter === 'pending')    query = { ...query, checkedIn: false, status: { $ne: 'blocked' } };
      if (filter === 'no-show')    query = { eventId: event._id, checkedIn: false };

      const guests = await Invite.find(query)
        .select('guestName guestEmail guestPhone checkedIn checkedInAt tableLabel notes status inviteCode')
        .lean();

      return {
        total: guests.length,
        filter,
        guests: guests.map(g => ({
          id: g._id.toString(),
          name: g.guestName,
          email: g.guestEmail,
          phone: g.guestPhone,
          checkedIn: g.checkedIn,
          checkedInAt: g.checkedInAt,
          table: g.tableLabel,
          notes: g.notes,
          status: g.status,
        })),
      };
    }

    case 'find_guest': {
      const { query } = params;
      if (!query) userError('Search query is required.');

      const q = query.toLowerCase();
      const guests = await Invite.find({
        eventId: event._id,
        $or: [
          { guestName:  { $regex: query, $options: 'i' } },
          { guestEmail: { $regex: query, $options: 'i' } },
          { guestPhone: { $regex: query, $options: 'i' } },
        ],
      }).select('guestName guestEmail guestPhone checkedIn tableLabel status notes').lean();

      return {
        found: guests.length,
        guests: guests.map(g => ({
          id: g._id.toString(),
          name: g.guestName,
          email: g.guestEmail,
          phone: g.guestPhone,
          checkedIn: g.checkedIn,
          table: g.tableLabel,
          status: g.status,
          notes: g.notes,
        })),
      };
    }

    case 'update_guest': {
      const { guestId, ...updates } = params;
      if (!guestId) userError('guestId is required.');

      const setFields = {};
      if (updates.name)  setFields.guestName  = updates.name;
      if (updates.email !== undefined) setFields.guestEmail = updates.email;
      if (updates.phone !== undefined) setFields.guestPhone = updates.phone;
      if (updates.notes !== undefined) setFields.notes = updates.notes;
      if (updates.tableId !== undefined) {
        setFields.tableId = updates.tableId;
        if (updates.tableId) {
          const table = (event.seatingMap?.objects || []).find(t => t.id === updates.tableId);
          setFields.tableLabel = table ? table.label : '';
        } else {
          setFields.tableLabel = null;
        }
      }

      await Invite.findOneAndUpdate({ _id: guestId, eventId: event._id }, setFields);
      return { success: true, message: 'Guest updated.' };
    }

    case 'remove_guest': {
      const { guestId } = params;
      if (!guestId) userError('guestId is required.');
      await Invite.findOneAndDelete({ _id: guestId, eventId: event._id });
      return { success: true, message: 'Guest removed from the event.' };
    }

    case 'get_checkin_stats': {
      const total     = await Invite.countDocuments({ eventId: event._id });
      const checkedIn = await Invite.countDocuments({ eventId: event._id, checkedIn: true });
      const pending   = total - checkedIn;

      const lastEntry = await Invite.findOne({ eventId: event._id, checkedIn: true })
        .sort({ checkedInAt: -1 })
        .select('checkedInAt')
        .lean();

      return {
        totalInvited: total,
        checkedIn,
        pending,
        noShow: 0, // determined post-event
        percentage: total > 0 ? Math.round((checkedIn / total) * 100) : 0,
        lastCheckinTime: lastEntry?.checkedInAt || null,
      };
    }

    // ── Seating ───────────────────────────────────────────────────────────────

    case 'create_table': {
      const { name, capacity, shape = 'round' } = params;
      if (!name)     userError('Table name is required.');
      if (!capacity) userError('Table capacity is required.');

      const tableObj = {
        id:       uuidv4(),
        x:        200 + Math.floor(Math.random() * 600),
        y:        200 + Math.floor(Math.random() * 300),
        type:     shape === 'rectangle' ? 'rect' : 'round',
        label:    name,
        capacity: Number(capacity),
        rotation: 0,
        width:    80,
        height:   80,
      };

      await Event.findByIdAndUpdate(event._id, {
        $push: { 'seatingMap.objects': tableObj },
        $set:  { 'seatingMap.enabled': true },
      });

      return { success: true, tableId: tableObj.id, name, capacity };
    }

    case 'get_tables': {
      const tables = event.seatingMap?.objects || [];
      const guests = await Invite.find({ eventId: event._id, tableId: { $ne: null } })
        .select('guestName tableId tableLabel')
        .lean();

      const guestsByTable = {};
      guests.forEach(g => {
        if (!guestsByTable[g.tableId]) guestsByTable[g.tableId] = [];
        guestsByTable[g.tableId].push(g.guestName);
      });

      return {
        tables: tables.map(t => ({
          id: t.id,
          name: t.label,
          capacity: t.capacity,
          type: t.type,
          assignedGuests: guestsByTable[t.id] || [],
          occupancy: (guestsByTable[t.id] || []).length,
        })),
      };
    }

    case 'assign_guest_to_table': {
      const { guestId, tableId } = params;
      if (!guestId || !tableId) userError('Both guestId and tableId are required.');

      const table = (event.seatingMap?.objects || []).find(t => t.id === tableId);
      if (!table) userError('Table not found in this event\'s seating map.');

      await Invite.findOneAndUpdate(
        { _id: guestId, eventId: event._id },
        { tableId, tableLabel: table.label }
      );

      return { success: true, message: `Guest assigned to ${table.label}.` };
    }

    case 'remove_guest_from_table': {
      const { guestId } = params;
      if (!guestId) userError('guestId is required.');

      await Invite.findOneAndUpdate(
        { _id: guestId, eventId: event._id },
        { tableId: null, tableLabel: null }
      );

      return { success: true, message: 'Guest removed from their table.' };
    }

    case 'get_seating_map': {
      const tables = event.seatingMap?.objects || [];
      const guests = await Invite.find({ eventId: event._id })
        .select('guestName guestEmail tableId tableLabel checkedIn')
        .lean();

      const guestsByTable = {};
      guests.forEach(g => {
        const key = g.tableId || '__unseated__';
        if (!guestsByTable[key]) guestsByTable[key] = [];
        guestsByTable[key].push({ id: g._id.toString(), name: g.guestName, checkedIn: g.checkedIn });
      });

      return {
        seatingEnabled: event.seatingMap?.enabled || false,
        tables: tables.map(t => ({
          id: t.id,
          name: t.label,
          capacity: t.capacity,
          type: t.type,
          guests: guestsByTable[t.id] || [],
        })),
        unseatedGuests: guestsByTable['__unseated__'] || [],
      };
    }

    case 'suggest_seating': {
      const tables = event.seatingMap?.objects || [];
      const guests = await Invite.find({ eventId: event._id, tableId: null })
        .select('guestName _id')
        .lean();

      if (tables.length === 0) return { suggestion: null, message: 'No tables have been created yet. Create tables first, then I can suggest seating.' };
      if (guests.length === 0) return { suggestion: null, message: 'All guests are already assigned to tables.' };

      // Simple round-robin assignment suggestion
      const plan = [];
      let guestIdx = 0;
      for (const table of tables) {
        const seatsAvailable = table.capacity;
        const assignees = [];
        while (assignees.length < seatsAvailable && guestIdx < guests.length) {
          assignees.push(guests[guestIdx].guestName);
          guestIdx++;
        }
        if (assignees.length > 0) {
          plan.push({ tableId: table.id, tableName: table.label, capacity: table.capacity, guests: assignees });
        }
      }

      return {
        plan,
        totalAssigned: guestIdx,
        totalUnseated: guests.length - guestIdx,
        message: `Suggested arrangement for ${guestIdx} guests across ${plan.length} tables.`,
      };
    }

    // ── Check-in ──────────────────────────────────────────────────────────────

    case 'get_checkin_feed': {
      const { limit = 20 } = params;
      const entries = await Invite.find({ eventId: event._id, checkedIn: true })
        .sort({ checkedInAt: -1 })
        .limit(Math.min(Number(limit) || 20, 100))
        .select('guestName checkedInAt checkedInBy')
        .lean();

      return {
        entries: entries.map(e => ({
          name: e.guestName,
          time: e.checkedInAt,
          method: e.checkedInBy || 'QR scan',
        })),
      };
    }

    case 'manual_checkin': {
      const { guestId } = params;
      if (!guestId) userError('guestId is required.');

      const invite = await Invite.findOne({ _id: guestId, eventId: event._id });
      if (!invite) userError('Guest not found.');
      if (invite.checkedIn) return { success: true, message: `${invite.guestName} is already checked in.` };

      invite.checkedIn   = true;
      invite.checkedInAt = new Date();
      invite.checkedInBy = 'Claude (manual)';
      invite.status      = 'checked-in';
      await invite.save();

      return { success: true, message: `${invite.guestName} has been manually checked in.` };
    }

    case 'override_checkin': {
      const { guestId, reason } = params;
      if (!guestId) userError('guestId is required.');
      if (!reason)  userError('A reason is required for manager overrides.');

      const invite = await Invite.findOne({ _id: guestId, eventId: event._id });
      if (!invite) userError('Guest not found.');

      invite.checkedIn   = true;
      invite.checkedInAt = new Date();
      invite.checkedInBy = `Claude override: ${reason}`;
      invite.status      = 'checked-in';
      await invite.save();

      return { success: true, message: `Override applied for ${invite.guestName}. Reason logged.` };
    }

    case 'get_security_alerts': {
      // Look for guests with blocked status or duplicate check-in attempts
      const blocked = await Invite.find({ eventId: event._id, status: 'blocked' })
        .select('guestName guestEmail notes')
        .lean();

      return {
        alerts: blocked.map(g => ({
          type: 'blocked_guest',
          guestName: g.guestName,
          guestEmail: g.guestEmail,
          notes: g.notes,
        })),
        totalAlerts: blocked.length,
        message: blocked.length === 0 ? 'No active security alerts.' : `${blocked.length} guest(s) are blocked.`,
      };
    }

    // ── Announcements ─────────────────────────────────────────────────────────

    case 'send_announcement': {
      const { message, audience } = params;
      if (!message)  userError('Message is required.');
      if (!audience) userError('Audience is required (all, guests, or staff).');

      const announcement = {
        id:        uuidv4(),
        title:     audience === 'staff' ? '[Staff]' : '[Announcement]',
        content:   message,
        author:    'Claude',
        important: false,
        createdAt: new Date(),
      };

      await Event.findByIdAndUpdate(event._id, { $push: { announcements: announcement } });

      // Emit via socket.io if available — the app will pick it up in real-time
      // The io instance is set on the express app; we access it via the route's req object
      // but we don't have req here. This is acceptable — the push happens via socket.io
      // in the full app, but here we at least persist it.

      return { success: true, message: `Announcement sent to ${audience}.`, announcementId: announcement.id };
    }

    case 'get_announcements': {
      const announcements = (event.announcements || [])
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      return {
        total: announcements.length,
        announcements: announcements.map(a => ({
          id: a.id,
          title: a.title,
          message: a.content,
          author: a.author,
          sentAt: a.createdAt,
        })),
      };
    }

    // ── RSVP ──────────────────────────────────────────────────────────────────

    case 'get_rsvp_settings': {
      const s = event.settings || {};
      return {
        rsvpEnabled:  s.rsvpEnabled !== false,
        cutoffDate:   s.rsvpDeadline,
        allowMaybe:   s.rsvpAllowMaybe,
        showCount:    s.rsvpShowCount,
        message:      s.rsvpMessage,
        maxGuests:    event.maxParticipants,
        rsvpPage:     event.rsvpPage || {},
      };
    }

    case 'update_rsvp_settings': {
      const setFields = {};
      if (params.rsvpEnabled !== undefined)    setFields['settings.rsvpEnabled']  = params.rsvpEnabled;
      if (params.cutoffDate !== undefined)      setFields['settings.rsvpDeadline'] = params.cutoffDate ? new Date(params.cutoffDate) : null;
      if (params.maxGuests !== undefined)       setFields.maxParticipants          = params.maxGuests;
      if (params.rsvpMessage !== undefined)     setFields['settings.rsvpMessage']  = params.rsvpMessage;
      if (params.allowPlusOne !== undefined)    setFields['rsvpPage.allowPlusOne'] = params.allowPlusOne;
      if (params.requireEmail !== undefined)    setFields['rsvpPage.requireEmail'] = params.requireEmail;
      if (params.questions !== undefined)       setFields['rsvpPage.customQuestions'] = params.questions;

      await Event.findByIdAndUpdate(event._id, { $set: setFields });
      return { success: true, message: 'RSVP settings updated.' };
    }

    case 'get_rsvp_responses': {
      const { filter = 'all' } = params;
      let rsvps = event.rsvps || [];

      if (filter === 'confirmed') rsvps = rsvps.filter(r => r.status === 'yes');
      if (filter === 'declined')  rsvps = rsvps.filter(r => r.status === 'no');

      return {
        total: rsvps.length,
        confirmed: (event.rsvps || []).filter(r => r.status === 'yes').length,
        declined:  (event.rsvps || []).filter(r => r.status === 'no').length,
        maybe:     (event.rsvps || []).filter(r => r.status === 'maybe').length,
        responses: rsvps.map(r => ({
          username: r.username,
          status:   r.status,
          updatedAt: r.updatedAt,
        })),
      };
    }

    // ── Table service ─────────────────────────────────────────────────────────

    case 'get_waitlist': {
      const waitlist = event.waitlist || [];
      return {
        total: waitlist.length,
        entries: waitlist.map((w, i) => ({
          id: w._id?.toString() || String(i),
          name: w.username,
          email: w.email,
          position: i + 1,
          joinedAt: w.joinedAt,
        })),
      };
    }

    case 'add_to_waitlist': {
      const { name, partySize, phone } = params;
      if (!name)      userError('Party name is required.');
      if (!partySize) userError('Party size is required.');

      const entry = { username: name, email: phone || '', joinedAt: new Date() };
      await Event.findByIdAndUpdate(event._id, { $push: { waitlist: entry } });

      return { success: true, message: `${name} (party of ${partySize}) added to the waitlist.` };
    }

    case 'seat_from_waitlist': {
      const { waitlistId, tableId } = params;
      if (!waitlistId || !tableId) userError('Both waitlistId and tableId are required.');

      // Find the waitlist entry
      const entry = (event.waitlist || []).find(w => w._id?.toString() === waitlistId);
      if (!entry) userError('Waitlist entry not found.');

      // Update table state
      await Event.findByIdAndUpdate(event._id, {
        $pull: { waitlist: { _id: entry._id } },
        $set: {
          'tableStates.$[el].status': 'occupied',
          'tableStates.$[el].partyName': entry.username,
        },
      }, { arrayFilters: [{ 'el.tableId': tableId }] });

      return { success: true, message: `${entry.username} has been seated.` };
    }

    case 'get_table_occupancy': {
      const tableStates = event.tableStates || [];
      const tables      = event.seatingMap?.objects || [];

      return {
        tables: tables.map(t => {
          const state = tableStates.find(s => s.tableId === t.id) || {};
          return {
            id: t.id,
            name: t.label,
            capacity: t.capacity,
            status: state.status || 'available',
            partyName: state.partyName || '',
            partySize: state.partySize || 0,
            server: state.serverName || '',
            notes: state.notes || '',
          };
        }),
      };
    }

    case 'update_table_status': {
      const { tableId, status } = params;
      if (!tableId) userError('tableId is required.');
      if (!['available', 'occupied', 'reserved', 'cleaning'].includes(status)) {
        userError('Status must be one of: available, occupied, reserved, cleaning.');
      }

      // Check if a tableState entry already exists for this table
      const existingState = (event.tableStates || []).find(s => s.tableId === tableId);

      if (existingState) {
        await Event.findByIdAndUpdate(
          event._id,
          { $set: { 'tableStates.$[el].status': status } },
          { arrayFilters: [{ 'el.tableId': tableId }] }
        );
      } else {
        await Event.findByIdAndUpdate(event._id, {
          $push: { tableStates: { tableId, status } },
        });
      }

      return { success: true, message: `Table status updated to "${status}".` };
    }

    // ── Budget / tasks / polls ─────────────────────────────────────────────────

    case 'get_budget': {
      const budgetSummary = event.getExpenseSummary ? event.getExpenseSummary() : {
        total: (event.expenses || []).reduce((s, e) => s + (e.amount || 0), 0),
        count: (event.expenses || []).length,
        byCategory: {},
        remaining: event.budget - (event.expenses || []).reduce((s, e) => s + (e.amount || 0), 0),
      };

      return {
        totalBudget: event.budget || 0,
        totalSpent: budgetSummary.total,
        remaining: budgetSummary.remaining,
        expenseCount: budgetSummary.count,
        byCategory: budgetSummary.byCategory,
        expenses: (event.expenses || []).map(e => ({
          id: e.id,
          title: e.title,
          amount: e.amount,
          category: e.category,
          paidBy: e.paidBy,
          notes: e.notes,
          date: e.date,
        })),
      };
    }

    case 'update_budget': {
      const { category, amount, notes } = params;
      if (!category) userError('Category is required.');
      if (amount === undefined) userError('Amount is required.');

      const expense = {
        id:        uuidv4(),
        title:     category,
        amount:    Number(amount),
        category,
        paidBy:    'Organiser',
        notes:     notes || '',
        date:      new Date(),
        createdBy: 'Claude',
      };

      await Event.findByIdAndUpdate(event._id, { $push: { expenses: expense } });
      return { success: true, message: `Budget entry added: ${category} — ${amount}.` };
    }

    case 'get_tasks': {
      const { filter = 'all' } = params;
      let tasks = event.tasks || [];
      if (filter === 'pending')  tasks = tasks.filter(t => !t.completed);
      if (filter === 'complete') tasks = tasks.filter(t => t.completed);

      return {
        total: tasks.length,
        tasks: tasks.map(t => ({
          id: t.id,
          title: t.title,
          completed: t.completed,
          dueDate: t.dueDate,
          assignedTo: t.assignedTo,
          priority: t.priority,
          createdAt: t.createdAt,
        })),
      };
    }

    case 'add_task': {
      const { title, dueDate, assignee } = params;
      if (!title) userError('Task title is required.');

      const task = {
        id:         uuidv4(),
        title,
        completed:  false,
        assignedTo: assignee || '',
        dueDate:    dueDate ? new Date(dueDate) : undefined,
        priority:   'medium',
        createdBy:  'Claude',
        createdAt:  new Date(),
      };

      await Event.findByIdAndUpdate(event._id, { $push: { tasks: task } });
      return { success: true, taskId: task.id, message: `Task added: "${title}"` };
    }

    case 'complete_task': {
      const { taskId } = params;
      if (!taskId) userError('taskId is required.');

      await Event.findOneAndUpdate(
        { _id: event._id, 'tasks.id': taskId },
        {
          $set: {
            'tasks.$.completed':   true,
            'tasks.$.completedBy': 'Claude',
            'tasks.$.completedAt': new Date(),
          },
        }
      );

      return { success: true, message: 'Task marked as complete.' };
    }

    case 'create_poll': {
      const { question, options } = params;
      if (!question) userError('Poll question is required.');
      if (!Array.isArray(options) || options.length < 2) userError('At least 2 options are required.');

      const poll = new Poll({
        eventId:   event._id,
        createdBy: 'Claude',
        question,
        options:   options.map(text => ({ text, votes: [] })),
        isActive:  true,
      });

      await poll.save();
      return { success: true, pollId: poll._id.toString(), message: `Poll created: "${question}"` };
    }

    case 'get_poll_results': {
      const { pollId } = params;
      if (!pollId) userError('pollId is required.');

      const poll = await Poll.findOne({ _id: pollId, eventId: event._id }).lean();
      if (!poll) userError('Poll not found.');

      const totalVotes = poll.options.reduce((s, o) => s + (o.votes?.length || 0), 0);

      return {
        question: poll.question,
        totalVotes,
        isActive: poll.isActive,
        options: poll.options.map(o => ({
          text: o.text,
          votes: o.votes?.length || 0,
          percentage: totalVotes > 0 ? Math.round(((o.votes?.length || 0) / totalVotes) * 100) : 0,
        })),
      };
    }

    default:
      return { error: `Unknown tool: ${tool}` };
  }
}

module.exports = router;
