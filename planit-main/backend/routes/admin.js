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

  const MAX = 2000;
  const push = (level, args) => {
    const entry = {
      ts:    new Date().toISOString(),
      level,
      msg:   args
        .map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a)))
        .join(' '),
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

// GET /admin/logs  — last N log lines
router.get('/logs', verifyAdmin, (req, res) => {
  const n   = Math.min(parseInt(req.query.n || '200'), 2000);
  const lvl = req.query.level;
  let entries = global.__adminLogBuffer.slice(-n);
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
    ];
    const updates = {};
    for (const field of allowed) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
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

    await Promise.all([
      Message.deleteMany({ eventId: event._id }),
      Poll.deleteMany({ eventId: event._id }),
      EventParticipant.deleteMany({ eventId: event._id }),
      Invite ? Invite.deleteMany({ eventId: event._id }) : Promise.resolve(),
      File.updateMany({ eventId: event._id }, { isDeleted: true, deletedAt: new Date() }),
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

    const empData = { name, email, role, department, phone, notes, permissions, startDate, status };
    if (req.body.password) {
      empData.passwordHash = await bcrypt.hash(req.body.password, 10);
    }
    const emp = await Employee.create(empData);
    res.status(201).json({ employee: emp, message: 'Employee created' });
  } catch (error) { next(error); }
});

router.patch('/employees/:id', verifyAdmin, async (req, res, next) => {
  try {
    const updateData = { ...req.body };
    if (updateData.password) {
      updateData.passwordHash = await bcrypt.hash(updateData.password, 10);
      delete updateData.password;
    }
    const emp = await Employee.findByIdAndUpdate(
      req.params.id,
      updateData,
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
    const { manualCleanup } = require('../jobs/cleanupJob');

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

    res.json({
      success: true,
      message: 'Manual cleanup completed',
      results: { deleted: successCount, failed: failCount, total: successCount + failCount },
      logs: logs.map(l => l.message).filter(m => !m.includes('===')),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;