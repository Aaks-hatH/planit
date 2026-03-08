const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const os = require('os');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const Event = require('../models/Event');
const Message = require('../models/Message');
const Poll = require('../models/Poll');
const File = require('../models/File');
const EventParticipant = require('../models/EventParticipant');
const Invite = require('../models/Invite');
const Employee = require('../models/Employee');
const { verifyAdmin } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
const { secrets } = require('../keys');
const Blocklist = require('../models/Blocklist');
const redis     = require('../services/redisClient');

// ─── Validation middleware ────────────────────────────────────────────────────
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// ─── Global in-memory log ring-buffer (2 000 entries) ────────────────────────
// Patched once at first require; survives hot-reloads because the object lives
// on `global`.  All console.log / warn / error calls on the server are captured
// and broadcast to SSE clients in real time.
if (!global.__adminLogBuffer) {
  global.__adminLogBuffer  = [];
  global.__adminLogClients = [];

  const MAX = 10000;
  const push = (level, args) => {
    const entry = {
      ts:    new Date().toISOString(),
      level,
      msg:   args
        .map(a => (typeof a === 'object' ? JSON.stringify(a, null, 0) : String(a)))
        .join(' '),
      pid:   process.pid,
    };
    global.__adminLogBuffer.push(entry);
    if (global.__adminLogBuffer.length > MAX) global.__adminLogBuffer.shift();
    global.__adminLogClients.forEach(send => { try { send(entry); } catch {} });
  };

  const _log   = console.log.bind(console);
  const _warn  = console.warn.bind(console);
  const _error = console.error.bind(console);
  console.log   = (...a) => { push('info',  a); _log(...a);   };
  console.warn  = (...a) => { push('warn',  a); _warn(...a);  };
  console.error = (...a) => { push('error', a); _error(...a); };
}

// ═══════════════════════════════════════════════════════════════════════════════
// AUTHENTICATION
// ═══════════════════════════════════════════════════════════════════════════════

router.post(
  '/login',
  authLimiter,
  [
    body('username').trim().notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required'),
    validate,
  ],
  async (req, res) => {
    try {
      const { username, password } = req.body;

      const adminUsername = process.env.ADMIN_USERNAME || 'admin';
      const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

      if (username !== adminUsername || password !== adminPassword) {
        // Super admin check failed — try employee login (email + password)
        const employee = await Employee.findOne({ email: username.toLowerCase().trim(), status: 'active' });
        if (!employee || !employee.passwordHash) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }
        const match = await bcrypt.compare(password, employee.passwordHash);
        if (!match) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }
        const empToken = jwt.sign(
          { employeeId: employee._id, name: employee.name, email: employee.email,
            role: employee.role, isAdmin: true, isEmployee: true,
            permissions: employee.permissions },
          secrets.jwt,
          { expiresIn: '24h' }
        );
        return res.json({
          message: 'Employee login successful',
          token: empToken,
          user: { username: employee.name, email: employee.email, role: employee.role, isEmployee: true, permissions: employee.permissions },
        });
      }

      const token = jwt.sign(
        { username, isAdmin: true, role: 'super_admin' },
        secrets.jwt,
        { expiresIn: '24h' }
      );

      res.json({
        message: 'Admin login successful',
        token,
        user: { username, role: 'super_admin' },
      });
    } catch (error) {
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD & STATISTICS
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/stats', verifyAdmin, async (req, res, next) => {
  try {
    const [
      totalEvents,
      activeEvents,
      totalMessages,
      totalPolls,
      totalFiles,
    ] = await Promise.all([
      Event.countDocuments(),
      Event.countDocuments({ status: 'active' }),
      Message.countDocuments({ isDeleted: false }),
      Poll.countDocuments(),
      File.countDocuments({ isDeleted: false }),
    ]);

    const yesterday   = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentEvents = await Event.countDocuments({ createdAt: { $gte: yesterday } });

    const events = await Event.find({}, 'participants');
    const totalParticipants = events.reduce((sum, e) => sum + e.participants.length, 0);

    const fileStats   = await File.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: null, totalSize: { $sum: '$size' } } },
    ]);
    const totalStorage = fileStats.length > 0 ? fileStats[0].totalSize : 0;

    res.json({
      totalEvents,
      activeEvents,
      totalMessages,
      totalPolls,
      totalFiles,
      totalParticipants,
      recentEvents,
      totalStorage,
      averageParticipantsPerEvent:
        totalEvents > 0 ? Math.round(totalParticipants / totalEvents) : 0,
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SYSTEM INFO  —  GET /admin/system
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/system', verifyAdmin, async (req, res, next) => {
  try {
    const mem      = process.memoryUsage();
    const load     = os.loadavg();
    const totalMem = os.totalmem();
    const freeMem  = os.freemem();

    const [evCount, msgCount, partCount, pollCount, fileCount, incCount, empCount] =
      await Promise.all([
        Event.countDocuments(),
        Message.countDocuments(),
        EventParticipant.countDocuments(),
        Poll.countDocuments(),
        File.countDocuments(),
        mongoose.connection.db
          ?.collection('incidents')
          .countDocuments()
          .catch(() => 0) ?? Promise.resolve(0),
        Employee.countDocuments(),
      ]);

    res.json({
      process: {
        pid:         process.pid,
        nodeVersion: process.version,
        platform:    process.platform,
        arch:        process.arch,
        uptime:      Math.floor(process.uptime()),
        env:         process.env.NODE_ENV || 'production',
        memoryMB: {
          rss:       +(mem.rss       / 1024 / 1024).toFixed(1),
          heapUsed:  +(mem.heapUsed  / 1024 / 1024).toFixed(1),
          heapTotal: +(mem.heapTotal / 1024 / 1024).toFixed(1),
          external:  +(mem.external  / 1024 / 1024).toFixed(1),
        },
      },
      os: {
        hostname:   os.hostname(),
        type:       os.type(),
        release:    os.release(),
        cpus:       os.cpus().length,
        loadAvg:    load.map(l => +l.toFixed(2)),
        totalMemMB: +(totalMem / 1024 / 1024).toFixed(0),
        freeMemMB:  +(freeMem  / 1024 / 1024).toFixed(0),
        usedMemPct: +(((totalMem - freeMem) / totalMem) * 100).toFixed(1),
      },
      db: {
        state:     mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        stateCode: mongoose.connection.readyState,
        host:      mongoose.connection.host,
        name:      mongoose.connection.name,
      },
      collections: {
        events:       evCount,
        messages:     msgCount,
        participants: partCount,
        polls:        pollCount,
        files:        fileCount,
        incidents:    incCount,
        employees:    empCount,
      },
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// LIVE LOGS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /admin/logs/fleet — fetches logs from every fleet service via the router.
// The router fans out to itself, every known backend, and the watchdog, then
// returns everything merged by timestamp. Only ROUTER_URL needs to be set here —
// WATCHDOG_URL and backend URLs are all managed on the router side.
router.get('/logs/fleet', verifyAdmin, async (req, res) => {
  const { meshGet } = require('../middleware/mesh');
  const CALLER    = process.env.BACKEND_LABEL || 'Backend';
  const routerUrl = process.env.ROUTER_URL    || '';

  if (!routerUrl) {
    // No router configured — return this backend's logs only as fallback
    const name = CALLER;
    const logs = (global.__adminLogBuffer || []).slice().map(e => ({ ...e, source: name.toLowerCase(), sourceName: name }));
    return res.json({
      logs,
      total:     logs.length,
      sources:   [{ source: name.toLowerCase(), name, ok: true, count: logs.length }],
      fetchedAt: new Date().toISOString(),
      note:      'ROUTER_URL not set — showing this backend only',
    });
  }

  const result = await meshGet(CALLER, `${routerUrl}/mesh/fleet-logs`, { timeout: 15000 });

  if (result.ok && result.data) {
    return res.json(result.data);
  }

  // Router unreachable — fall back to local logs only
  console.warn(`[admin] Fleet logs: router fetch failed — ${result.error}`);
  const name = CALLER;
  const logs = (global.__adminLogBuffer || []).slice().map(e => ({ ...e, source: name.toLowerCase(), sourceName: name }));
  res.json({
    logs,
    total:     logs.length,
    sources:   [
      { source: name.toLowerCase(), name, ok: true,  count: logs.length },
      { source: 'router',           name: 'Router',  ok: false, error: result.error },
    ],
    fetchedAt: new Date().toISOString(),
    note:      'Router unreachable — showing this backend only',
  });
});

// GET /admin/logs  — last N log lines (n=all returns everything)
router.get('/logs', verifyAdmin, (req, res) => {
  const raw = req.query.n;
  const n   = raw === 'all' ? Infinity : (parseInt(raw) || 500);
  const lvl = req.query.level;
  let entries = n === Infinity ? global.__adminLogBuffer.slice() : global.__adminLogBuffer.slice(-n);
  if (lvl) entries = entries.filter(e => e.level === lvl);
  res.json({ logs: entries, total: global.__adminLogBuffer.length });
});

// GET /admin/logs/stream  — Server-Sent Events real-time log stream
router.get('/logs/stream', verifyAdmin, (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();

  // Send the last 50 lines immediately so the client sees context
  global.__adminLogBuffer.slice(-50).forEach(entry =>
    res.write(`data: ${JSON.stringify(entry)}\n\n`)
  );

  const send = entry => res.write(`data: ${JSON.stringify(entry)}\n\n`);
  global.__adminLogClients.push(send);

  const hb = setInterval(() => res.write(': heartbeat\n\n'), 20000);

  req.on('close', () => {
    clearInterval(hb);
    const idx = global.__adminLogClients.indexOf(send);
    if (idx !== -1) global.__adminLogClients.splice(idx, 1);
  });
});

// GET /admin/logs/full — complete system snapshot: ALL logs + full system state
// No pagination, no limits. Intended for debugging and incident investigation.
router.get('/logs/full', verifyAdmin, async (req, res, next) => {
  try {
    const mem      = process.memoryUsage();
    const load     = os.loadavg();
    const totalMem = os.totalmem();
    const freeMem  = os.freemem();
    const cpus     = os.cpus();

    const [evCount, msgCount, partCount, pollCount, fileCount, empCount] =
      await Promise.all([
        Event.countDocuments(),
        Message.countDocuments(),
        EventParticipant.countDocuments(),
        Poll.countDocuments(),
        File.countDocuments(),
        Employee.countDocuments(),
      ]);

    const errorCount = global.__adminLogBuffer.filter(e => e.level === 'error').length;
    const warnCount  = global.__adminLogBuffer.filter(e => e.level === 'warn').length;

    res.json({
      generatedAt: new Date().toISOString(),
      summary: {
        totalLogs:     global.__adminLogBuffer.length,
        errors:        errorCount,
        warnings:      warnCount,
        liveClients:   global.__adminLogClients.length,
      },
      process: {
        pid:         process.pid,
        nodeVersion: process.version,
        platform:    process.platform,
        arch:        process.arch,
        uptime:      Math.floor(process.uptime()),
        uptimeHuman: `${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m ${Math.floor(process.uptime() % 60)}s`,
        env:         process.env.NODE_ENV || 'production',
        memory: {
          rss:        `${(mem.rss       / 1024 / 1024).toFixed(1)} MB`,
          heapUsed:   `${(mem.heapUsed  / 1024 / 1024).toFixed(1)} MB`,
          heapTotal:  `${(mem.heapTotal / 1024 / 1024).toFixed(1)} MB`,
          external:   `${(mem.external  / 1024 / 1024).toFixed(1)} MB`,
        },
      },
      os: {
        hostname:    os.hostname(),
        type:        os.type(),
        release:     os.release(),
        cpuCount:    cpus.length,
        cpuModel:    cpus[0]?.model || 'unknown',
        loadAvg1m:   os.loadavg()[0].toFixed(2),
        loadAvg5m:   os.loadavg()[1].toFixed(2),
        loadAvg15m:  os.loadavg()[2].toFixed(2),
        totalMemMB:  (totalMem / 1024 / 1024).toFixed(0),
        freeMemMB:   (freeMem  / 1024 / 1024).toFixed(0),
        usedMemPct:  (((totalMem - freeMem) / totalMem) * 100).toFixed(1) + '%',
      },
      database: {
        state:       mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        host:        mongoose.connection.host,
        name:        mongoose.connection.name,
        port:        mongoose.connection.port,
      },
      collections: {
        events:       evCount,
        messages:     msgCount,
        participants: partCount,
        polls:        pollCount,
        files:        fileCount,
        employees:    empCount,
      },
      config: {
        corsOrigin:      process.env.CORS_ORIGIN || 'not set',
        cloudinarySet:   !!(process.env.CLOUDINARY_CLOUD_NAME),
        licenseSet:      !!(process.env.PLANIT_LICENSE_KEY),
        adminUserSet:    !!(process.env.ADMIN_USERNAME),
      },
      // ALL log entries — no limit
      logs: global.__adminLogBuffer.slice(),
    });
  } catch (error) { next(error); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

// Get all events (paginated + filterable)
router.get('/events', verifyAdmin, async (req, res, next) => {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip  = (page - 1) * limit;

    const filter = {};
    if (req.query.status && req.query.status !== 'all') {
      filter.status = req.query.status;
    }
    if (req.query.search) {
      filter.$or = [
        { title:          { $regex: req.query.search, $options: 'i' } },
        { subdomain:      { $regex: req.query.search, $options: 'i' } },
        { organizerEmail: { $regex: req.query.search, $options: 'i' } },
        { organizerName:  { $regex: req.query.search, $options: 'i' } },
      ];
    }

    const [events, total] = await Promise.all([
      Event.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Event.countDocuments(filter),
    ]);

    res.json({
      events,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
});

// Get single event details
router.get('/events/:eventId', verifyAdmin, async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const [messageCount, pollCount, fileCount, participantCount] = await Promise.all([
      Message.countDocuments({ eventId: event._id, isDeleted: false }),
      Poll.countDocuments({ eventId: event._id }),
      File.countDocuments({ eventId: event._id, isDeleted: false }),
      EventParticipant.countDocuments({ eventId: event._id }),
    ]);

    res.json({ event, stats: { messages: messageCount, polls: pollCount, files: fileCount, participants: participantCount } });
  } catch (error) {
    next(error);
  }
});

// Update event (full edit)
router.patch('/events/:eventId', verifyAdmin, async (req, res, next) => {
  try {
    const allowed = [
      'title', 'description', 'date', 'location',
      'organizerName', 'organizerEmail', 'maxParticipants',
      'isPasswordProtected', 'isEnterpriseMode', 'subdomain', 'status',
      'themeColor', 'tags', 'coverImage',
    ];
    const updates = {};
    for (const field of allowed) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    // Allow patching nested settings fields
    if (req.body.settings && typeof req.body.settings === 'object') {
      for (const [k, v] of Object.entries(req.body.settings)) {
        updates[`settings.${k}`] = v;
      }
    }

    const event = await Event.findByIdAndUpdate(
      req.params.eventId,
      updates,
      { new: true, runValidators: true }
    );
    if (!event) return res.status(404).json({ error: 'Event not found' });

    res.json({ message: 'Event updated successfully', event });
  } catch (error) {
    if (error.code === 11000) return res.status(400).json({ error: 'Subdomain already taken' });
    next(error);
  }
});

// Update event status
router.patch(
  '/events/:eventId/status',
  verifyAdmin,
  [
    body('status')
      .isIn(['draft', 'active', 'completed', 'cancelled'])
      .withMessage('Invalid status'),
    validate,
  ],
  async (req, res, next) => {
    try {
      const event = await Event.findByIdAndUpdate(
        req.params.eventId,
        { status: req.body.status },
        { new: true }
      );
      if (!event) return res.status(404).json({ error: 'Event not found' });
      res.json({ message: 'Event status updated', event });
    } catch (error) {
      next(error);
    }
  }
);

// Delete event + all related data
router.delete('/events/:eventId', verifyAdmin, async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    // Delete all File attachments from Cloudinary before wiping DB records
    const files = await File.find({ eventId: event._id });
    for (const file of files) {
      try { await file.deleteFromCloudinary(); } catch (_) {}
    }

    // Delete cover image from Cloudinary (stored as planit-covers/cover-{eventId})
    if (event.coverImage) {
      try {
        const cloudinary = require('cloudinary').v2;
        cloudinary.config({
          cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
          api_key:    process.env.CLOUDINARY_API_KEY,
          api_secret: process.env.CLOUDINARY_API_SECRET,
        });
        await cloudinary.uploader.destroy(`planit-covers/cover-${event._id}`, { resource_type: 'image' });
      } catch (_) {}
    }

    await Promise.all([
      Message.deleteMany({ eventId: event._id }),
      Poll.deleteMany({ eventId: event._id }),
      EventParticipant.deleteMany({ eventId: event._id }),
      Invite ? Invite.deleteMany({ eventId: event._id }) : Promise.resolve(),
      File.deleteMany({ eventId: event._id }),
      Event.findByIdAndDelete(event._id),
    ]);

    res.json({ message: 'Event and all related data deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGES MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/events/:eventId/messages', verifyAdmin, async (req, res, next) => {
  try {
    const messages = await Message.find({ eventId: req.params.eventId, isDeleted: false })
      .sort({ createdAt: 1 })
      .lean();
    res.json({ messages });
  } catch (error) { next(error); }
});

router.delete('/events/:eventId/messages/:messageId', verifyAdmin, async (req, res, next) => {
  try {
    await Message.findByIdAndUpdate(req.params.messageId, { isDeleted: true, deletedAt: new Date() });
    res.json({ message: 'Message deleted' });
  } catch (error) { next(error); }
});

router.post('/events/:eventId/messages/bulk-delete', verifyAdmin, async (req, res, next) => {
  try {
    const { messageIds } = req.body;
    await Message.updateMany(
      { _id: { $in: messageIds }, eventId: req.params.eventId },
      { isDeleted: true, deletedAt: new Date() }
    );
    res.json({ message: `${messageIds.length} messages deleted` });
  } catch (error) { next(error); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PARTICIPANTS MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/events/:eventId/participants', verifyAdmin, async (req, res, next) => {
  try {
    const participants = await EventParticipant.find({ eventId: req.params.eventId })
      .select('-password')
      .sort({ joinedAt: 1 })
      .lean();
    res.json({ participants });
  } catch (error) { next(error); }
});

router.delete('/events/:eventId/participants/:username', verifyAdmin, async (req, res, next) => {
  try {
    await EventParticipant.deleteOne({ eventId: req.params.eventId, username: req.params.username });
    await Event.findByIdAndUpdate(req.params.eventId, {
      $pull: { participants: { username: req.params.username } },
    });
    res.json({ message: 'Participant removed' });
  } catch (error) { next(error); }
});

router.delete('/events/:eventId/participants/:username/password', verifyAdmin, async (req, res, next) => {
  try {
    await EventParticipant.findOneAndUpdate(
      { eventId: req.params.eventId, username: req.params.username },
      { $unset: { password: '' }, hasPassword: false }
    );
    res.json({ message: 'Password reset successfully' });
  } catch (error) { next(error); }
});

router.post('/events/:eventId/participants/bulk-remove', verifyAdmin, async (req, res, next) => {
  try {
    const { usernames } = req.body;
    await EventParticipant.deleteMany({
      eventId: req.params.eventId,
      username: { $in: usernames },
    });
    await Event.findByIdAndUpdate(req.params.eventId, {
      $pull: { participants: { username: { $in: usernames } } },
    });
    res.json({ message: `${usernames.length} participants removed` });
  } catch (error) { next(error); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// POLLS MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/events/:eventId/polls', verifyAdmin, async (req, res, next) => {
  try {
    const polls = await Poll.find({ eventId: req.params.eventId }).sort({ createdAt: -1 }).lean();
    res.json({ polls });
  } catch (error) { next(error); }
});

router.delete('/events/:eventId/polls/:pollId', verifyAdmin, async (req, res, next) => {
  try {
    await Poll.findByIdAndDelete(req.params.pollId);
    res.json({ message: 'Poll deleted' });
  } catch (error) { next(error); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// FILES MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/events/:eventId/files', verifyAdmin, async (req, res, next) => {
  try {
    const files = await File.find({ eventId: req.params.eventId, isDeleted: false })
      .sort({ uploadedAt: -1 })
      .lean();
    res.json({ files });
  } catch (error) { next(error); }
});

router.delete('/events/:eventId/files/:fileId', verifyAdmin, async (req, res, next) => {
  try {
    await File.findByIdAndUpdate(req.params.fileId, { isDeleted: true, deletedAt: new Date() });
    res.json({ message: 'File deleted' });
  } catch (error) { next(error); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// INVITES MANAGEMENT (Enterprise Mode)
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/events/:eventId/invites', verifyAdmin, async (req, res, next) => {
  try {
    if (!Invite) return res.json({ invites: [] });
    const invites = await Invite.find({ eventId: req.params.eventId })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ invites });
  } catch (error) { next(error); }
});

router.post('/events/:eventId/invites/:inviteCode/checkin', verifyAdmin, async (req, res, next) => {
  try {
    if (!Invite) return res.status(404).json({ error: 'Invite system not available' });
    const invite = await Invite.findOneAndUpdate(
      { eventId: req.params.eventId, inviteCode: req.params.inviteCode },
      { checkedIn: true, checkedInAt: new Date(), actualAttendees: req.body.actualAttendees, status: 'checked-in' },
      { new: true }
    );
    if (!invite) return res.status(404).json({ error: 'Invite not found' });
    res.json({ message: 'Guest checked in', invite });
  } catch (error) { next(error); }
});

router.delete('/events/:eventId/invites/:inviteId', verifyAdmin, async (req, res, next) => {
  try {
    if (!Invite) return res.status(404).json({ error: 'Invite system not available' });
    await Invite.findByIdAndDelete(req.params.inviteId);
    res.json({ message: 'Invite deleted' });
  } catch (error) { next(error); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SEARCH & ACTIVITY
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/search', verifyAdmin, async (req, res, next) => {
  try {
    const query = req.query.q;
    if (!query || query.length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    const regex = { $regex: query, $options: 'i' };

    const [events, messages, polls, participants] = await Promise.all([
      Event.find({
        $or: [
          { title: regex }, { subdomain: regex }, { description: regex },
          { organizerName: regex }, { organizerEmail: regex },
        ],
      }).limit(20).lean(),
      Message.find({ content: regex, isDeleted: false })
        .limit(20)
        .populate('eventId', 'title subdomain')
        .lean(),
      Poll.find({ question: regex })
        .limit(20)
        .populate('eventId', 'title subdomain')
        .lean(),
      EventParticipant.find({ username: regex })
        .limit(20)
        .select('-password')
        .lean(),
    ]);

    res.json({
      results: { events, messages, polls, participants },
      total: events.length + messages.length + polls.length + participants.length,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/activity', verifyAdmin, async (req, res, next) => {
  try {
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const [recentEvents, recentMessages, recentParticipants] = await Promise.all([
      Event.find({ createdAt: { $gte: since } }).sort({ createdAt: -1 }).limit(10).lean(),
      Message.find({ createdAt: { $gte: since }, isDeleted: false }).sort({ createdAt: -1 }).limit(20).lean(),
      EventParticipant.find({ joinedAt: { $gte: since } }).select('-password').sort({ joinedAt: -1 }).limit(20).lean(),
    ]);
    res.json({ recentEvents, recentMessages, recentParticipants });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ORGANIZERS  —  GET /admin/organizers
// Aggregates unique organizers from the events collection.
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/organizers', verifyAdmin, async (req, res, next) => {
  try {
    const organizers = await Event.aggregate([
      {
        $group: {
          _id:               '$organizerEmail',
          name:              { $last: '$organizerName' },
          email:             { $first: '$organizerEmail' },
          totalEvents:       { $sum: 1 },
          activeEvents:      { $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] } },
          firstEvent:        { $min: '$createdAt' },
          lastEvent:         { $max: '$createdAt' },
          totalParticipants: { $sum: { $size: { $ifNull: ['$participants', []] } } },
          isEnterprise:      { $max: { $cond: ['$isEnterpriseMode', 1, 0] } },
        },
      },
      { $sort: { totalEvents: -1 } },
      { $limit: 500 },
    ]);
    res.json({ organizers, total: organizers.length });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ALL STAFF  —  GET /admin/staff
// Returns every staff-role EventParticipant enriched with event title.
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/staff', verifyAdmin, async (req, res, next) => {
  try {
    const staff = await EventParticipant.find({ role: 'staff' })
      .select('-password')
      .sort({ createdAt: -1 })
      .lean();

    const eventIds = [...new Set(staff.map(s => s.eventId?.toString()))];
    const events   = await Event.find({ _id: { $in: eventIds } }).select('title subdomain').lean();
    const evMap    = Object.fromEntries(events.map(e => [e._id.toString(), e]));

    const enriched = staff.map(s => ({
      ...s,
      eventTitle:     evMap[s.eventId?.toString()]?.title     || 'Unknown Event',
      eventSubdomain: evMap[s.eventId?.toString()]?.subdomain || '',
    }));

    res.json({ staff: enriched, total: enriched.length });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ALL PARTICIPANTS  —  GET /admin/all-participants
// Every participant (non-staff) across all events, paginated.
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/all-participants', verifyAdmin, async (req, res, next) => {
  try {
    const page   = parseInt(req.query.page  || '1');
    const limit  = parseInt(req.query.limit || '50');
    const skip   = (page - 1) * limit;
    const search = req.query.search;

    const filter = { role: { $ne: 'staff' } };
    if (search) filter.username = { $regex: search, $options: 'i' };

    const [participants, total] = await Promise.all([
      EventParticipant.find(filter)
        .select('-password')
        .sort({ joinedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      EventParticipant.countDocuments(filter),
    ]);

    const eventIds = [...new Set(participants.map(p => p.eventId?.toString()))];
    const events   = await Event.find({ _id: { $in: eventIds } }).select('title subdomain').lean();
    const evMap    = Object.fromEntries(events.map(e => [e._id.toString(), e]));

    const enriched = participants.map(p => ({
      ...p,
      eventTitle:     evMap[p.eventId?.toString()]?.title     || '',
      eventSubdomain: evMap[p.eventId?.toString()]?.subdomain || '',
    }));

    res.json({ participants: enriched, total, pages: Math.ceil(total / limit), page });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// EMPLOYEE MANAGEMENT  —  /admin/employees
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/employees', verifyAdmin, async (req, res, next) => {
  try {
    const employees = await Employee.find().sort({ createdAt: -1 }).lean();
    res.json({ employees });
  } catch (error) { next(error); }
});

router.post('/employees', verifyAdmin, async (req, res, next) => {
  try {
    const { name, email, role, department, phone, notes, permissions, startDate, status } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'Name and email required' });

    const existing = await Employee.findOne({ email: email.toLowerCase().trim() });
    if (existing) return res.status(400).json({ error: 'Email already registered' });

    const empData = { name, email, role: role || 'support', department, phone, notes, permissions, status };
    if (startDate && startDate.trim()) {
      const d = new Date(startDate);
      if (!isNaN(d.getTime())) empData.startDate = d;
    }
    if (req.body.password && req.body.password.trim()) {
      empData.passwordHash = await bcrypt.hash(req.body.password.trim(), 10);
    }
    const emp = await Employee.create(empData);
    res.status(201).json({ employee: emp, message: 'Employee created' });
  } catch (error) { next(error); }
});

router.patch('/employees/:id', verifyAdmin, async (req, res, next) => {
  try {
    const { password, startDate, ...rest } = req.body;
    const updateData = { ...rest };

    // Hash new password if provided
    if (password && password.trim()) {
      updateData.passwordHash = await bcrypt.hash(password.trim(), 10);
    }

    // Only set startDate if it's a valid non-empty value
    if (startDate && startDate.trim()) {
      updateData.startDate = new Date(startDate);
      if (isNaN(updateData.startDate.getTime())) {
        return res.status(400).json({ error: 'Invalid start date format.' });
      }
    }

    // Prevent accidental overwrite of _id or passwordHash from client
    delete updateData._id;
    delete updateData.__v;
    delete updateData.passwordHash; // only set via password field above

    const emp = await Employee.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    res.json({ employee: emp, message: 'Employee updated' });
  } catch (error) { next(error); }
});

router.delete('/employees/:id', verifyAdmin, async (req, res, next) => {
  try {
    await Employee.findByIdAndDelete(req.params.id);
    res.json({ message: 'Employee deleted' });
  } catch (error) { next(error); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// DATA EXPORT
// ═══════════════════════════════════════════════════════════════════════════════

router.get('/export', verifyAdmin, async (req, res, next) => {
  try {
    const type    = req.query.type || 'events';
    const eventId = req.query.eventId;
    const filter  = eventId ? { eventId } : {};
    let data;

    switch (type) {
      case 'events':
        data = await Event.find(filter).lean();
        break;
      case 'messages':
        data = await Message.find({ ...filter, isDeleted: false }).lean();
        break;
      case 'polls':
        data = await Poll.find(filter).lean();
        break;
      case 'files':
        data = await File.find({ ...filter, isDeleted: false }).lean();
        break;
      case 'participants':
        data = await EventParticipant.find(filter).select('-password').lean();
        break;
      case 'invites':
        data = Invite ? await Invite.find(filter).lean() : [];
        break;
      case 'all': {
        if (!eventId) return res.status(400).json({ error: 'Event ID required for full export' });
        const [ev, msgs, pls, fls, parts, invs] = await Promise.all([
          Event.findById(eventId).lean(),
          Message.find({ eventId, isDeleted: false }).lean(),
          Poll.find({ eventId }).lean(),
          File.find({ eventId, isDeleted: false }).lean(),
          EventParticipant.find({ eventId }).select('-password').lean(),
          Invite ? Invite.find({ eventId }).lean() : Promise.resolve([]),
        ]);
        data = { event: ev, messages: msgs, polls: pls, files: fls, participants: parts, invites: invs };
        break;
      }
      default:
        return res.status(400).json({ error: 'Invalid export type' });
    }

    res.json({ data, exportedAt: new Date(), type });
  } catch (error) {
    next(error);
  }
});

router.get('/export/stats', verifyAdmin, async (req, res, next) => {
  try {
    const [eventsByStatus, eventsByMonth, messagesByDay] = await Promise.all([
      Event.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Event.aggregate([
        { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: -1 } },
        { $limit: 12 },
      ]),
      Message.aggregate([
        { $match: { isDeleted: false } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: -1 } },
        { $limit: 30 },
      ]),
    ]);

    res.json({ eventsByStatus, eventsByMonth, messagesByDay, generatedAt: new Date() });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN EVENT ACCESS — bypass password
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/events/:eventId/access', verifyAdmin, async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const token = jwt.sign(
      {
        eventId:          event._id.toString(),
        username:         'ADMIN',
        role:             'admin_viewer',
        isAdminAccess:    true,
        canBypassPassword: true,
      },
      secrets.jwt,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      event: {
        _id:                 event._id,
        title:               event.title,
        subdomain:           event.subdomain,
        date:                event.date,
        location:            event.location,
        description:         event.description,
        organizerName:       event.organizerName,
        organizerEmail:      event.organizerEmail,
        isPasswordProtected: event.isPasswordProtected,
        isEnterpriseMode:    event.isEnterpriseMode,
        status:              event.status,
        participants:        event.participants,
        createdAt:           event.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// MANUAL CLEANUP — run the 7-day cleanup job on demand
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/cleanup', verifyAdmin, async (req, res, next) => {
  try {
    const { manualCleanup, cleanupOrphanedCloudinaryAssets } = require('../jobs/cleanupJob');

    const logs        = [];
    const originalLog  = console.log;
    const originalError = console.error;

    console.log   = (...args) => { logs.push({ level: 'info',  message: args.join(' ') }); originalLog(...args);   };
    console.error = (...args) => { logs.push({ level: 'error', message: args.join(' ') }); originalError(...args); };

    await manualCleanup();

    console.log   = originalLog;
    console.error = originalError;

    const successLine  = logs.find(l => l.message.includes('Successfully deleted:'));
    const failLine     = logs.find(l => l.message.includes('Failed to delete:'));
    const successCount = successLine ? parseInt(successLine.message.match(/\d+/)?.[0] || '0') : 0;
    const failCount    = failLine    ? parseInt(failLine.message.match(/\d+/)?.[0]    || '0') : 0;

    // Run Cloudinary orphan sweep
    const cloudinaryResult = await cleanupOrphanedCloudinaryAssets();

    res.json({
      success: true,
      message: 'Manual cleanup completed',
      results: { deleted: successCount, failed: failCount, total: successCount + failCount },
      cloudinary: cloudinaryResult,
      logs: logs.map(l => l.message).filter(m => !m.includes('===')),
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// MARKETING EMAIL
// ═══════════════════════════════════════════════════════════════════════════════

// GET /admin/marketing/templates
// Returns the list of available marketing email templates.
router.get('/marketing/templates', verifyAdmin, (_req, res) => {
  const { listTemplates } = require('../services/marketingService');
  res.json({ templates: listTemplates() });
});

// GET /admin/marketing/preview/:templateId
// Returns the rendered HTML of a template for previewing in an iframe.
router.get('/marketing/preview/:templateId', verifyAdmin, (req, res) => {
  const { previewTemplate } = require('../services/marketingService');
  const { ctaUrl, recipientName, recipientCompany, recipientRole } = req.query;
  const recipient = {
    name:    recipientName    || '',
    company: recipientCompany || '',
    role:    recipientRole    || '',
  };
  const html = previewTemplate(req.params.templateId, ctaUrl, recipient);
  if (!html) return res.status(404).json({ error: 'Template not found' });
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

// POST /admin/marketing/send is defined after the discovery routes below.

// ═══════════════════════════════════════════════════════════════════════════════
// COMMAND CENTER  —  super_admin only
// ═══════════════════════════════════════════════════════════════════════════════

function requireSuperAdmin(req, res, next) {
  // verifyAdmin sets req.admin — never req.user
  const admin = req.admin;
  if (!admin) return res.status(403).json({ error: 'Command Center is restricted to super_admin.' });
  // Allow super_admin JWT role, or non-employee admins (the root admin login)
  const ok = admin.role === 'super_admin' || (!admin.isEmployee && admin.isAdmin === true);
  if (!ok) return res.status(403).json({ error: 'Command Center is restricted to super_admin.' });
  next();
}

// GET /admin/cc/fleet — full fleet metrics from all services
router.get('/cc/fleet', verifyAdmin, requireSuperAdmin, async (req, res) => {
  const { meshGet, meshPost } = require('../middleware/mesh');
  const CALLER    = process.env.BACKEND_LABEL || 'Backend';
  const routerUrl = process.env.ROUTER_URL    || '';

  const localMem  = process.memoryUsage();
  const localSnap = {
    service:  CALLER,
    type:     'backend',
    pid:      process.pid,
    uptime:   Math.floor(process.uptime()),
    node:     process.version,
    memMB: {
      rss:       +(localMem.rss       / 1048576).toFixed(1),
      heapUsed:  +(localMem.heapUsed  / 1048576).toFixed(1),
      heapTotal: +(localMem.heapTotal / 1048576).toFixed(1),
    },
    logEntries:   global.__adminLogBuffer?.length || 0,
    liveClients:  global.__adminLogClients?.length || 0,
    errors24h:    (global.__adminLogBuffer || []).filter(e => e.level === 'error' && new Date(e.ts) > new Date(Date.now() - 86400000)).length,
    warns24h:     (global.__adminLogBuffer || []).filter(e => e.level === 'warn'  && new Date(e.ts) > new Date(Date.now() - 86400000)).length,
    ok: true,
  };

  if (!routerUrl) {
    return res.json({ services: [localSnap], fetchedAt: new Date().toISOString(), note: 'ROUTER_URL not set' });
  }

  const [routerR, watchdogR] = await Promise.all([
    meshPost(CALLER, `${routerUrl}/mesh/exec`, { command: 'stats' }, { timeout: 8000 })
      .catch(() => ({ ok: false })),
    meshGet(CALLER, `${(process.env.WATCHDOG_URL || '').replace(/\/$/, '')}/mesh/status`, { timeout: 8000 })
      .catch(() => ({ ok: false })),
  ]);

  const services = [localSnap];

  if (routerR.ok && routerR.data?.result) {
    const r = routerR.data.result;
    services.push({ service: 'Router', type: 'router', pid: r.pid, uptime: r.uptime, node: r.nodeVersion, memMB: r.memMB, logEntries: r.logBufferLen, backends: r.backends, emailPool: r.emailPool, ok: true });
  } else {
    services.push({ service: 'Router', type: 'router', ok: false, error: 'unreachable' });
  }

  if (watchdogR.ok && watchdogR.data) {
    const d = watchdogR.data;
    services.push({ service: 'Watchdog', type: 'watchdog', pid: d.pid, uptime: d.uptime, node: d.nodeVersion || d.version, ok: true, monitoredServices: d.services?.length || 0 });
  } else {
    services.push({ service: 'Watchdog', type: 'watchdog', ok: false, error: 'unreachable' });
  }

  res.json({ services, fetchedAt: new Date().toISOString() });
});

// POST /admin/cc/command — dispatch a command to a specific service
router.post('/cc/command', verifyAdmin, requireSuperAdmin, async (req, res) => {
  const { target, command, params = {} } = req.body || {};
  if (!target || !command) return res.status(400).json({ error: 'target and command required' });

  const { meshPost, meshGet } = require('../middleware/mesh');
  const CALLER    = process.env.BACKEND_LABEL || 'Backend';
  const routerUrl = (process.env.ROUTER_URL || '').replace(/\/$/, '');
  const watchdogUrl = (process.env.WATCHDOG_URL || '').replace(/\/$/, '');

  const BACKEND_COMMANDS = ['flush-logs', 'gc', 'ping', 'stats', 'cache-clear'];
  const ROUTER_COMMANDS  = ['flush-logs', 'gc', 'ping', 'stats', 'clear-key-suspension', 'list-backends'];

  if (target === 'backend') {
    switch (command) {
      case 'ping':
        return res.json({ ok: true, result: { pong: true, ts: new Date().toISOString(), pid: process.pid } });
      case 'stats': {
        const m = process.memoryUsage();
        return res.json({ ok: true, result: { pid: process.pid, uptime: Math.floor(process.uptime()), memMB: { rss: +(m.rss/1048576).toFixed(1), heapUsed: +(m.heapUsed/1048576).toFixed(1), heapTotal: +(m.heapTotal/1048576).toFixed(1) }, logBuffer: global.__adminLogBuffer?.length || 0, node: process.version } });
      }
      case 'flush-logs': {
        const count = global.__adminLogBuffer?.length || 0;
        if (global.__adminLogBuffer) global.__adminLogBuffer.length = 0;
        console.log(`[cc] Backend log buffer flushed (${count} entries)`);
        return res.json({ ok: true, result: { flushed: count } });
      }
      case 'gc': {
        let ran = false;
        if (global.gc) { global.gc(); ran = true; }
        return res.json({ ok: true, result: { gcRan: ran } });
      }
      case 'cache-clear': {
        console.log('[cc] Cache clear requested via command center — use flush-logs for log buffer or clear-key-suspension for email keys');
        return res.json({ ok: true, result: { note: 'Cache clear acknowledged. Use clear-key-suspension on the router to unsuspend rate-limited email keys.' } });
      }
      default:
        if (!BACKEND_COMMANDS.includes(command)) return res.status(400).json({ error: `Unknown backend command: ${command}` });
    }
  }

  if (target === 'router') {
    if (!routerUrl) return res.status(503).json({ error: 'ROUTER_URL not set' });
    if (!ROUTER_COMMANDS.includes(command)) return res.status(400).json({ error: `Unknown router command: ${command}` });
    const r = await meshPost(CALLER, `${routerUrl}/mesh/exec`, { command, params }, { timeout: 10000 });
    if (r.ok) return res.json({ ok: true, result: r.data?.result });
    return res.status(502).json({ ok: false, error: r.error || 'Router unreachable' });
  }

  if (target === 'watchdog') {
    if (!watchdogUrl) return res.status(503).json({ error: 'WATCHDOG_URL not set' });
    if (command === 'ping') {
      const r = await meshGet(CALLER, `${watchdogUrl}/watchdog/ping`, { timeout: 8000 });
      return res.json({ ok: r.ok, result: r.data || { error: r.error } });
    }
    if (command === 'status') {
      const r = await meshGet(CALLER, `${watchdogUrl}/watchdog/status`, { timeout: 8000 });
      return res.json({ ok: r.ok, result: r.data || { error: r.error } });
    }
    if (command === 'stats') {
      const r = await meshGet(CALLER, `${watchdogUrl}/mesh/status`, { timeout: 8000 });
      return res.json({ ok: r.ok, result: r.data || { error: r.error } });
    }
    return res.status(400).json({ error: `Unknown watchdog command: ${command}` });
  }

  res.status(400).json({ error: `Unknown target: ${target}. Must be backend, router, or watchdog.` });
});

// GET /admin/cc/email-pool — Brevo and Mailjet key pool from router
router.get('/cc/email-pool', verifyAdmin, requireSuperAdmin, async (req, res) => {
  const { meshGet } = require('../middleware/mesh');
  const CALLER    = process.env.BACKEND_LABEL || 'Backend';
  const routerUrl = (process.env.ROUTER_URL || '').replace(/\/$/, '');
  if (!routerUrl) return res.status(503).json({ error: 'ROUTER_URL not set' });
  const r = await meshGet(CALLER, `${routerUrl}/mesh/email/pool`, { timeout: 8000 });
  if (r.ok) return res.json(r.data);
  res.status(502).json({ ok: false, error: r.error || 'Router unreachable' });
});

// GET /admin/cc/db — live database collection sizes and index info
router.get('/cc/db', verifyAdmin, requireSuperAdmin, async (req, res, next) => {
  try {
    const db = mongoose.connection.db;
    if (!db) return res.status(503).json({ error: 'Database not connected' });
    const collections = await db.listCollections().toArray();
    const stats = await Promise.all(
      collections.map(async (col) => {
        try {
          const s = await db.collection(col.name).stats();
          return { name: col.name, count: s.count, sizeMB: +(s.size / 1048576).toFixed(3), indexSizeMB: +(s.totalIndexSize / 1048576).toFixed(3), avgObjSize: s.avgObjSize || 0 };
        } catch { return { name: col.name, count: 0, sizeMB: 0, error: true }; }
      })
    );
    res.json({ collections: stats.sort((a, b) => b.sizeMB - a.sizeMB), dbName: mongoose.connection.name, state: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected', fetchedAt: new Date().toISOString() });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// MARKETING — SCHEDULING
// ═══════════════════════════════════════════════════════════════════════════════

router.post('/marketing/schedule', verifyAdmin, async (req, res, next) => {
  try {
    const redis = require('../services/redisClient');
    const { templateId, recipients, subject, ctaUrl, sendAt, label } = req.body || {};
    if (!templateId || !Array.isArray(recipients) || recipients.length === 0 || !sendAt)
      return res.status(400).json({ error: 'templateId, recipients, and sendAt required' });

    const id  = `sched:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
    const job = { id, templateId, recipients, subject: subject || '', ctaUrl: ctaUrl || '', sendAt, label: label || templateId, createdAt: new Date().toISOString(), status: 'pending' };
    const ttl = Math.max(86400, Math.ceil((new Date(sendAt) - Date.now()) / 1000) + 3600);
    await redis.set(id, JSON.stringify(job), ttl);

    const listRaw = await redis.get('mktschedlist').catch(() => null);
    const list    = listRaw ? JSON.parse(listRaw) : [];
    list.push(id);
    await redis.set('mktschedlist', JSON.stringify(list), 7 * 86400);

    console.log(`[marketing] Scheduled campaign "${id}" (${recipients.length} recipients) for ${sendAt}`);
    res.status(201).json({ ok: true, id, job });
  } catch (err) { next(err); }
});

router.get('/marketing/scheduled', verifyAdmin, async (req, res, next) => {
  try {
    const redis = require('../services/redisClient');
    const listRaw = await redis.get('mktschedlist').catch(() => null);
    const ids     = listRaw ? JSON.parse(listRaw) : [];
    const jobs    = (await Promise.all(ids.map(id => redis.get(id).then(r => r ? JSON.parse(r) : null).catch(() => null)))).filter(Boolean);
    res.json({ scheduled: jobs, total: jobs.length });
  } catch (err) { next(err); }
});

router.delete('/marketing/schedule/:id', verifyAdmin, async (req, res, next) => {
  try {
    const redis = require('../services/redisClient');
    const id    = req.params.id;
    await redis.del(id).catch(() => {});
    const listRaw = await redis.get('mktschedlist').catch(() => null);
    if (listRaw) {
      const list = JSON.parse(listRaw).filter(x => x !== id);
      await redis.set('mktschedlist', JSON.stringify(list), 7 * 86400);
    }
    console.log(`[marketing] Cancelled scheduled campaign ${id}`);
    res.json({ ok: true, cancelled: id });
  } catch (err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// MARKETING — CONTACT DISCOVERY  (live, SSE-streamed)
// ═══════════════════════════════════════════════════════════════════════════════

// POST /admin/marketing/discover  — start a discovery run, streams results via SSE
router.get('/marketing/discover', verifyAdmin, async (req, res) => {
  const { query, industry, location, limit } = req.query;
  if (!query && !industry) return res.status(400).json({ error: 'query or industry required' });

  const { discoverLeads } = require('../services/discoveryService');

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (type, data) => {
    try { res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`); } catch {}
  };

  const redis = require('../services/redisClient');
  const contactedRaw = await redis.get('mkt:contacted').catch(() => null);
  const contacted = new Set(contactedRaw ? JSON.parse(contactedRaw) : []);

  let stopped = false;
  req.on('close', () => { stopped = true; });

  try {
    await discoverLeads({
      query: query || '',
      industry: industry || '',
      location: location || '',
      limit: Math.min(parseInt(limit) || 30, 100),
      contacted,
      onProgress: (msg) => { if (!stopped) send('progress', { msg }); },
      onLead: (lead) => {
        if (!stopped) {
          const alreadyContacted = contacted.has((lead.email || '').toLowerCase());
          send('lead', { lead: { ...lead, alreadyContacted } });
        }
      },
      isStopped: () => stopped,
    });
  } catch (err) {
    send('error', { msg: err.message });
  }

  send('done', { msg: 'Discovery complete' });
  res.end();
});

// GET /admin/marketing/contacted  — list of already-emailed addresses
router.get('/marketing/contacted', verifyAdmin, async (req, res, next) => {
  try {
    const redis = require('../services/redisClient');
    const raw = await redis.get('mkt:contacted').catch(() => null);
    const list = raw ? JSON.parse(raw) : [];
    res.json({ contacted: list, total: list.length });
  } catch (err) { next(err); }
});

// POST /admin/marketing/contacted/add  — manually mark emails as contacted
router.post('/marketing/contacted/add', verifyAdmin, async (req, res, next) => {
  try {
    const redis = require('../services/redisClient');
    const { emails } = req.body;
    if (!Array.isArray(emails)) return res.status(400).json({ error: 'emails array required' });
    const raw = await redis.get('mkt:contacted').catch(() => null);
    const set = new Set(raw ? JSON.parse(raw) : []);
    emails.forEach(e => { if (e) set.add(e.toLowerCase().trim()); });
    await redis.set('mkt:contacted', JSON.stringify([...set]), 365 * 86400);
    res.json({ ok: true, total: set.size });
  } catch (err) { next(err); }
});

// DELETE /admin/marketing/contacted/:email  — remove from contacted list
router.delete('/marketing/contacted/:email', verifyAdmin, async (req, res, next) => {
  try {
    const redis = require('../services/redisClient');
    const email = decodeURIComponent(req.params.email).toLowerCase();
    const raw = await redis.get('mkt:contacted').catch(() => null);
    const arr = (raw ? JSON.parse(raw) : []).filter(e => e !== email);
    await redis.set('mkt:contacted', JSON.stringify(arr), 365 * 86400);
    res.json({ ok: true, total: arr.length });
  } catch (err) { next(err); }
});

// Override sendCampaign to auto-track sent emails
const _origSend = router.stack; // just a reference; we patch via middleware below
router.post('/marketing/send', verifyAdmin, async (req, res, next) => {
  try {
    const { templateId, recipients, subject, ctaUrl } = req.body || {};

    if (!templateId) return res.status(400).json({ error: 'templateId is required' });
    if (!Array.isArray(recipients) || recipients.length === 0)
      return res.status(400).json({ error: 'recipients must be a non-empty array' });
    if (recipients.length > 1000)
      return res.status(400).json({ error: 'Maximum 1,000 recipients per send.' });

    const { sendCampaign } = require('../services/marketingService');

    // Normalise: accept both plain strings and {email,name,company,role} objects
    const normalised = recipients.map(r =>
      typeof r === 'string' ? { email: r.trim().toLowerCase(), name: '', company: '', role: '' } :
      { email: (r.email || '').trim().toLowerCase(), name: r.name || '', company: r.company || '', role: r.role || '', website: r.website || '' }
    );

    const results = await sendCampaign({ templateId, recipients: normalised, subject, ctaUrl });

    // Track every successfully sent address
    try {
      const redis = require('../services/redisClient');
      const raw = await redis.get('mkt:contacted').catch(() => null);
      const set = new Set(raw ? JSON.parse(raw) : []);
      normalised.forEach(r => { if (r.email) set.add(r.email); });
      await redis.set('mkt:contacted', JSON.stringify([...set]), 365 * 86400);
    } catch {}

    res.json({ ok: true, results });
  } catch (err) {
    if (err.message?.startsWith('Unknown template')) return res.status(400).json({ error: err.message });
    if (err.message?.includes('ROUTER_URL not set')) return res.status(503).json({ error: 'Email delivery not configured. Set ROUTER_URL.' });
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// COMMAND CENTER — PLATFORM INTELLIGENCE
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/cc/platform-metrics', verifyAdmin, requireSuperAdmin, async (req, res, next) => {
  try {
    const now = new Date(), d30 = new Date(now - 30*86400000), d7 = new Date(now - 7*86400000);

    const [eventsPerDay, messagesPerDay, eventsByStatus, withPolls, withFiles, withEnterprise, withSeating] = await Promise.all([
      Event.aggregate([{ $match:{ createdAt:{ $gte:d30 } } },{ $group:{ _id:{ $dateToString:{ format:'%Y-%m-%d', date:'$createdAt' } }, count:{ $sum:1 } } },{ $sort:{ _id:1 } }]),
      Message.aggregate([{ $match:{ createdAt:{ $gte:d7 }, isDeleted:false } },{ $group:{ _id:{ $dateToString:{ format:'%Y-%m-%d', date:'$createdAt' } }, count:{ $sum:1 } } },{ $sort:{ _id:1 } }]),
      Event.aggregate([{ $group:{ _id:'$status', count:{ $sum:1 } } }]),
      Poll.distinct('eventId').then(ids => ids.length).catch(() => 0),
      File.distinct('eventId').then(ids => ids.length).catch(() => 0),
      Event.countDocuments({ isEnterpriseMode:true }),
      Event.countDocuments({ 'settings.seatingEnabled':true }),
    ]);

    const totalEvents = await Event.countDocuments();
    const mao         = await Event.distinct('organizerEmail', { createdAt:{ $gte:d30 } });
    const newOrgsThisWeek = await Event.distinct('organizerEmail', { createdAt:{ $gte:d7 } });
    const newOrgsLastWeek = await Event.distinct('organizerEmail', { createdAt:{ $gte:new Date(now-14*86400000), $lt:d7 } });

    const eventsWithParticipants = await Event.countDocuments({ 'participants.0':{ $exists:true } });
    const checkedInEvents = await EventParticipant.distinct('eventId', { checkedIn:true }).then(ids => ids.length).catch(() => 0);
    const completedEvents = await Event.countDocuments({ status:'completed' });

    const powerUsers = await Event.aggregate([
      { $group:{ _id:'$organizerEmail', name:{ $last:'$organizerName' }, events:{ $sum:1 }, lastActive:{ $max:'$createdAt' } } },
      { $sort:{ events:-1 } },{ $limit:10 },
    ]);

    const adopt = n => totalEvents > 0 ? Math.round((n/totalEvents)*100) : 0;
    res.json({
      eventsPerDay, messagesPerDay, eventsByStatus,
      maoCount: mao.length,
      newOrgsThisWeek: newOrgsThisWeek.length,
      newOrgsLastWeek: newOrgsLastWeek.length,
      featureAdoption: {
        polls:      { count:withPolls,      pct:adopt(withPolls) },
        files:      { count:withFiles,      pct:adopt(withFiles) },
        enterprise: { count:withEnterprise, pct:adopt(withEnterprise) },
        seating:    { count:withSeating,    pct:adopt(withSeating) },
      },
      conversionFunnel: { created:totalEvents, hasParticipants:eventsWithParticipants, hadCheckin:checkedInEvents, completed:completedEvents },
      powerUsers,
      generatedAt: new Date().toISOString(),
    });
  } catch(err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// COMMAND CENTER — SECURITY INTELLIGENCE
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/cc/security-intel', verifyAdmin, requireSuperAdmin, async (req, res, next) => {
  try {
    const logs = global.__adminLogBuffer || [];
    const now  = Date.now();

    const failedLogins = logs.filter(e => e.level==='error' && (e.msg.includes('Invalid credentials')||e.msg.includes('401'))).slice(-50).map(e => ({ ts:e.ts, msg:e.msg.slice(0,120) }));
    const rateLimitHits = logs.filter(e => e.msg.toLowerCase().includes('rate')||e.msg.includes('429')).slice(-30).map(e => ({ ts:e.ts, msg:e.msg.slice(0,120) }));
    const errLast1h  = logs.filter(e => e.level==='error' && new Date(e.ts) > new Date(now-3600000)).length;
    const errLast24h = logs.filter(e => e.level==='error' && new Date(e.ts) > new Date(now-86400000)).length;
    const errSpike   = errLast1h > (errLast24h/24)*3;

    const suspiciousParticipants = await EventParticipant.aggregate([
      { $match:{ joinedAt:{ $gte:new Date(now-86400000) }, role:{ $ne:'staff' } } },
      { $group:{ _id:'$username', count:{ $sum:1 } } },
      { $match:{ count:{ $gte:5 } } },
      { $sort:{ count:-1 } },{ $limit:20 },
    ]);

    const largeFiles = await File.find({ isDeleted:false }).sort({ size:-1 }).limit(10).select('name size eventId uploadedAt').lean();

    const busyEvents = await Event.find({ 'participants.10':{ $exists:true } })
      .select('title subdomain participants status createdAt organizerEmail').sort({ createdAt:-1 }).limit(10).lean()
      .then(evs => evs.map(e => ({ ...e, participantCount:e.participants?.length||0, participants:undefined })));

    const errorPatterns = {};
    logs.filter(e => e.level==='error').slice(-300).forEach(e => {
      const k = e.msg.slice(0,60); errorPatterns[k] = (errorPatterns[k]||0)+1;
    });
    const topErrors = Object.entries(errorPatterns).map(([msg,count]) => ({ msg,count })).sort((a,b) => b.count-a.count).slice(0,10);

    res.json({ failedLogins, rateLimitHits, errLast1h, errLast24h, errSpike, suspiciousParticipants, largeFiles, busyEvents, topErrors, generatedAt:new Date().toISOString() });
  } catch(err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// COMMAND CENTER — RUNTIME / WS / REDIS / CONFIG
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/cc/ws-stats', verifyAdmin, requireSuperAdmin, async (req, res, next) => {
  try {
    let wsStats = { connected:0, rooms:0, note:'socket not accessible' };
    try {
      const { io } = require('../server');
      if (io) {
        const sockets = await io.fetchSockets();
        const rooms   = io.sockets.adapter.rooms;
        wsStats = { connected:sockets.length, rooms:rooms?rooms.size:0, note:'live' };
      }
    } catch {}

    const redis = require('../services/redisClient');
    let redisHealth = { mode:redis.isRedis?'upstash':'in-memory', connected:redis.isRedis };
    if (redis.isRedis) {
      const t0 = Date.now();
      try { await redis.set('cc:ping','1',10); redisHealth.pingMs = Date.now()-t0; redisHealth.pingOk = (await redis.get('cc:ping'))==='1'; }
      catch { redisHealth.pingOk = false; }
    }

    const config = [
      { label:'MongoDB URI',          set:!!(process.env.MONGO_URI||process.env.MONGODB_URI) },
      { label:'JWT / License Key',    set:!!(process.env.JWT_SECRET||process.env.PLANIT_LICENSE_KEY) },
      { label:'Router URL',           set:!!process.env.ROUTER_URL },
      { label:'Cloudinary',           set:!!process.env.CLOUDINARY_CLOUD_NAME },
      { label:'Upstash Redis',        set:!!(process.env.UPSTASH_REDIS_URL&&process.env.UPSTASH_REDIS_TOKEN) },
      { label:'Admin Credentials',    set:!!process.env.ADMIN_USERNAME },
      { label:'CORS Origin',          set:!!process.env.CORS_ORIGIN },
      { label:'Frontend URL',         set:!!process.env.FRONTEND_URL },
      { label:'Hunter.io',            set:!!process.env.HUNTER_API_KEY },
      { label:'Google CSE',           set:!!(process.env.GOOGLE_CSE_KEY&&process.env.GOOGLE_CSE_CX) },
      { label:'Watchdog URL',         set:!!process.env.WATCHDOG_URL },
    ];
    const configScore = Math.round((config.filter(c=>c.set).length/config.length)*100);

    const mem = process.memoryUsage();
    res.json({
      wsStats, redisHealth, config, configScore,
      process: {
        uptime:   Math.floor(process.uptime()), pid:process.pid, node:process.version,
        memMB:    { rss:+(mem.rss/1048576).toFixed(1), heapUsed:+(mem.heapUsed/1048576).toFixed(1), heapTotal:+(mem.heapTotal/1048576).toFixed(1) },
        cpuCount: os.cpus().length, loadAvg:os.loadavg().map(l=>+l.toFixed(2)),
        freeMemMB:+(os.freemem()/1048576).toFixed(0), totalMemMB:+(os.totalmem()/1048576).toFixed(0),
      },
      generatedAt: new Date().toISOString(),
    });
  } catch(err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// COMMAND CENTER — EVENT INTELLIGENCE
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/cc/event-intel', verifyAdmin, requireSuperAdmin, async (req, res, next) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const pastEvents = await Event.find({ date:{ $lt:now }, status:{ $nin:['completed','cancelled'] } })
      .select('title subdomain organizerEmail date participants status createdAt').limit(50).lean();
    const pastIds = pastEvents.map(e => e._id);
    const checkedInIds = await EventParticipant.distinct('eventId', { eventId:{ $in:pastIds }, checkedIn:true }).catch(() => []);
    const checkedSet   = new Set(checkedInIds.map(String));
    const abandonedEvents = pastEvents.filter(e => !checkedSet.has(String(e._id)))
      .map(e => ({ ...e, participantCount:e.participants?.length||0, participants:undefined }));

    const activeEvents = await Event.find({ status:'active' }).select('title subdomain date participants').limit(20).lean();
    const activeVelocity = await Promise.all(activeEvents.map(async evt => {
      const last5  = new Date(now-5*60000);
      const [total, recent] = await Promise.all([
        EventParticipant.countDocuments({ eventId:evt._id, checkedIn:true }).catch(() => 0),
        EventParticipant.countDocuments({ eventId:evt._id, checkedIn:true, checkedInAt:{ $gte:last5 } }).catch(() => 0),
      ]);
      return { id:evt._id, title:evt.title, subdomain:evt.subdomain, total:evt.participants?.length||0, checkedIn:total, last5min:recent, pct:evt.participants?.length>0?Math.round((total/evt.participants.length)*100):0 };
    }));

    const cleanupTarget = new Date(now-7*86400000);
    const cleanupCandidates = await Event.find({ status:'completed', updatedAt:{ $lt:cleanupTarget } })
      .select('title subdomain date organizerEmail updatedAt').limit(30).lean();

    const [todayCount, ystdCount] = await Promise.all([
      Event.countDocuments({ createdAt:{ $gte:todayStart } }),
      Event.countDocuments({ createdAt:{ $gte:new Date(todayStart-86400000), $lt:todayStart } }),
    ]);

    res.json({ abandonedEvents, activeVelocity, cleanupCandidates, todayCount, ystdCount, generatedAt:new Date().toISOString() });
  } catch(err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// COMMAND CENTER — GLOBAL SEARCH
// ═══════════════════════════════════════════════════════════════════════════════
router.get('/cc/global-search', verifyAdmin, requireSuperAdmin, async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.status(400).json({ error: 'Query must be at least 2 characters' });
    const rx = { $regex:q, $options:'i' };
    const [participants, events, organizers] = await Promise.all([
      EventParticipant.find({ $or:[{ username:rx }] }).select('-password').sort({ joinedAt:-1 }).limit(30).lean(),
      Event.find({ $or:[{ title:rx },{ subdomain:rx },{ organizerEmail:rx },{ organizerName:rx }] })
        .select('title subdomain organizerName organizerEmail status date participants').limit(20).lean(),
      Event.aggregate([{ $match:{ organizerEmail:rx } },{ $group:{ _id:'$organizerEmail', name:{ $last:'$organizerName' }, events:{ $sum:1 } } },{ $limit:10 }]),
    ]);
    const eIds = [...new Set(participants.map(p => p.eventId?.toString()))];
    const eMap = await Event.find({ _id:{ $in:eIds } }).select('title subdomain').lean()
      .then(evs => Object.fromEntries(evs.map(e => [e._id.toString(), e])));
    const enriched = participants.map(p => ({ ...p, eventTitle:eMap[p.eventId?.toString()]?.title||'', eventSubdomain:eMap[p.eventId?.toString()]?.subdomain||'' }));
    res.json({
      participants: enriched,
      events: events.map(e => ({ ...e, participantCount:e.participants?.length||0, participants:undefined })),
      organizers,
      total: enriched.length+events.length+organizers.length,
    });
  } catch(err) { next(err); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// COMMAND CENTER — BULK EVENT OPS
// ═══════════════════════════════════════════════════════════════════════════════
router.post('/cc/bulk-events', verifyAdmin, requireSuperAdmin, async (req, res, next) => {
  try {
    const { action, filter = {} } = req.body;
    if (!action) return res.status(400).json({ error: 'action required' });
    let result = {};
    if (action === 'force-complete-old') {
      const cutoff = new Date(Date.now()-(parseInt(filter.days)||7)*86400000);
      const r = await Event.updateMany({ date:{ $lt:cutoff }, status:{ $in:['active','draft'] } }, { $set:{ status:'completed' } });
      result = { modified:r.modifiedCount };
    } else if (action === 'delete-empty-drafts') {
      const cutoff = new Date(Date.now()-(parseInt(filter.days)||3)*86400000);
      const targets = await Event.find({ status:'draft', createdAt:{ $lt:cutoff }, 'participants.0':{ $exists:false } }).select('_id').lean();
      const ids = targets.map(e => e._id);
      if (ids.length) await Promise.all([Event.deleteMany({ _id:{ $in:ids } }), Message.deleteMany({ eventId:{ $in:ids } }), Poll.deleteMany({ eventId:{ $in:ids } }), EventParticipant.deleteMany({ eventId:{ $in:ids } })]);
      result = { deleted:ids.length };
    } else if (action === 'cancel-abandoned') {
      const cutoff = new Date(Date.now()-86400000);
      const past   = await Event.find({ date:{ $lt:cutoff }, status:'active' }).select('_id').lean();
      const ids    = past.map(e => e._id);
      const withCI = await EventParticipant.distinct('eventId', { eventId:{ $in:ids }, checkedIn:true });
      const toCancel = ids.filter(id => !withCI.map(String).includes(String(id)));
      if (toCancel.length) await Event.updateMany({ _id:{ $in:toCancel } }, { $set:{ status:'cancelled' } });
      result = { cancelled:toCancel.length };
    } else { return res.status(400).json({ error:`Unknown action: ${action}` }); }
    res.json({ ok:true, result:{ ...result, action } });
  } catch(err) { next(err); }
});

// ─── Blocklist routes ──────────────────────────────────────────────────────────

// GET /admin/blocklist — list all entries, optional ?type= filter
router.get('/blocklist', verifyAdmin, async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.type) filter.type = req.query.type;
    const entries = await Blocklist.find(filter).sort({ createdAt: -1 }).lean();
    res.json({ entries });
  } catch (err) { next(err); }
});

// POST /admin/blocklist — add an entry
// body: { type, value, reason?, permanent?, expiresAt? }
router.post('/blocklist', verifyAdmin, async (req, res, next) => {
  try {
    const { type, value, reason = '', permanent = true, expiresAt = null } = req.body;
    if (!type || !['ip', 'event', 'name'].includes(type))
      return res.status(400).json({ error: 'type must be ip, event, or name' });
    if (!value || !value.trim())
      return res.status(400).json({ error: 'value is required' });

    // Prevent duplicates
    const existing = await Blocklist.findOne({ type, value: value.trim() });
    if (existing) return res.status(409).json({ error: 'Entry already exists', entry: existing });

    const entry = await Blocklist.create({
      type,
      value:     value.trim(),
      reason:    reason.trim(),
      permanent: permanent && !expiresAt,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      addedBy:   req.admin?.username || 'admin',
    });

    // Also write to Redis so the in-memory / Redis ban check catches it immediately
    // without waiting for the next DB query (which has a try/catch that can fail)
    if (type === 'ip') {
      const ttl = expiresAt ? Math.floor((new Date(expiresAt) - Date.now()) / 1000) : 0;
      if (ttl > 0) {
        await redis.set(`sec:ban:${value.trim()}`, '1', ttl);
      } else if (!expiresAt) {
        // Permanent — write with very long TTL (10 years) so Redis also catches it
        await redis.set(`sec:ban:${value.trim()}`, '1', 60 * 60 * 24 * 365 * 10);
      }
    }

    res.status(201).json({ entry });
  } catch (err) { next(err); }
});

// DELETE /admin/blocklist/:id — remove an entry
router.delete('/blocklist/:id', verifyAdmin, async (req, res, next) => {
  try {
    const entry = await Blocklist.findByIdAndDelete(req.params.id).lean();
    if (!entry) return res.status(404).json({ error: 'Not found' });
    // Also remove from Redis if it was an IP ban
    if (entry.type === 'ip') {
      await redis.del(`sec:ban:${entry.value}`);
    }
    res.json({ ok: true, entry });
  } catch (err) { next(err); }
});

// PATCH /admin/blocklist/:id — update reason or expiry
router.patch('/blocklist/:id', verifyAdmin, async (req, res, next) => {
  try {
    const allowed = ['reason', 'expiresAt', 'permanent'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    if (updates.expiresAt !== undefined) {
      updates.expiresAt = updates.expiresAt ? new Date(updates.expiresAt) : null;
      updates.permanent = !updates.expiresAt;
    }
    const entry = await Blocklist.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true }).lean();
    if (!entry) return res.status(404).json({ error: 'Not found' });
    res.json({ entry });
  } catch (err) { next(err); }
});

module.exports = router;
