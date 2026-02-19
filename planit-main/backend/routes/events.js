const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const Event = require('../models/Event');
const EventParticipant = require('../models/EventParticipant');
const { verifyEventAccess, verifyOrganizer } = require('../middleware/auth');
const { createEventLimiter, authLimiter } = require('../middleware/rateLimiter');
const { secrets } = require('../keys');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

// Create event
router.post('/',
  createEventLimiter,
  [
    body('subdomain').trim().isLength({ min: 3, max: 50 }).matches(/^[a-z0-9-]+$/).withMessage('Invalid subdomain format'),
    body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Title is required'),
    body('date').isISO8601().withMessage('Valid date is required'),
    body('organizerName').trim().isLength({ min: 1, max: 100 }).withMessage('Organizer name is required'),
    body('organizerEmail').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').optional({ values: 'falsy' }).isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    validate
  ],
  async (req, res, next) => {
    try {
      const { subdomain, title, description, date, location, organizerName, organizerEmail, password, accountPassword, isEnterpriseMode, settings, maxParticipants } = req.body;

      const existing = await Event.findOne({ subdomain });
      if (existing) return res.status(409).json({ error: 'This event link is already taken.' });

      let hashedPassword = null;
      let isPasswordProtected = false;
      if (password) {
        hashedPassword = await bcrypt.hash(password, 10);
        isPasswordProtected = true;
      }

      const event = new Event({
        subdomain, title, description, date, location, organizerName, organizerEmail,
        password: hashedPassword, isPasswordProtected,
        isEnterpriseMode: isEnterpriseMode || false,
        settings: settings || {}, maxParticipants: maxParticipants || 100,
        participants: [{ username: organizerName, role: 'organizer' }]
      });

      await event.save();

      const participantData = { eventId: event._id, username: organizerName, role: 'organizer' };
      if (accountPassword) {
        participantData.password = await bcrypt.hash(accountPassword, 10);
        participantData.hasPassword = true;
      }
      await EventParticipant.create(participantData);

      const token = jwt.sign(
        { eventId: event._id.toString(), username: organizerName, role: 'organizer' },
        secrets.jwt,
        { expiresIn: '30d' }
      );

      res.status(201).json({
        message: 'Event created successfully',
        event: { id: event._id, subdomain: event.subdomain, title: event.title, isPasswordProtected: event.isPasswordProtected },
        token
      });
    } catch (error) { next(error); }
  }
);

// Get existing participant names for an event (for join gate dropdown)
router.get('/participants/:eventId', async (req, res, next) => {
  try {
    const participants = await EventParticipant.find({ eventId: req.params.eventId })
      .select('username hasPassword role')
      .sort({ lastSeenAt: -1 })
      .lean();
    res.json({ participants: participants.map(p => ({ username: p.username, hasPassword: p.hasPassword, role: p.role })) });
  } catch (error) { next(error); }
});

// Public info (no auth) — for join gate
router.get('/public/:eventId', async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event) return res.status(404).json({ error: 'Event not found.' });

    res.json({
      event: {
        id: event._id, subdomain: event.subdomain, title: event.title,
        description: event.description, date: event.date, location: event.location,
        organizerName: event.organizerName, isPasswordProtected: event.isPasswordProtected,
        maxParticipants: event.maxParticipants, participantCount: event.participants.length,
        status: event.status, rsvpSummary: event.getRsvpSummary()
      }
    });
  } catch (error) { next(error); }
});

// Get by subdomain
router.get('/subdomain/:subdomain', async (req, res, next) => {
  try {
    const event = await Event.findOne({ subdomain: req.params.subdomain });
    if (!event) return res.status(404).json({ error: 'Event not found.' });
    await event.incrementViews();
    res.json({
      event: {
        id: event._id, subdomain: event.subdomain, title: event.title, date: event.date,
        organizerName: event.organizerName, isPasswordProtected: event.isPasswordProtected,
        requiresPassword: event.isPasswordProtected,
        description: event.isPasswordProtected ? undefined : event.description,
        location: event.isPasswordProtected ? undefined : event.location,
        maxParticipants: event.maxParticipants, participantCount: event.participants.length
      }
    });
  } catch (error) { next(error); }
});

// Verify password + join
router.post('/verify-password/:eventId', authLimiter,
  [body('password').notEmpty(), body('username').trim().isLength({ min: 1, max: 100 }), body('accountPassword').optional(), validate],
  async (req, res, next) => {
    try {
      const event = await Event.findById(req.params.eventId).select('+password');
      if (!event) return res.status(404).json({ error: 'Event not found.' });
      if (!event.isPasswordProtected) return res.status(400).json({ error: 'Event is not password protected.' });

      const isMatch = await bcrypt.compare(req.body.password, event.password);
      if (!isMatch) return res.status(401).json({ error: 'Incorrect event password.' });

      const { username, accountPassword } = req.body;

      const existing = await EventParticipant.findOne({ eventId: req.params.eventId, username }).select('+password');
      if (existing && existing.hasPassword) {
        if (!accountPassword) return res.status(400).json({ error: 'This name has an account — enter your account password.', requiresAccountPassword: true });
        const accountMatch = await bcrypt.compare(accountPassword, existing.password);
        if (!accountMatch) return res.status(401).json({ error: 'Incorrect account password.' });
        existing.lastSeenAt = new Date();
        await existing.save();
      } else {
        const updateData = { role: 'participant', lastSeenAt: new Date() };
        if (accountPassword) {
          updateData.password = await bcrypt.hash(accountPassword, 10);
          updateData.hasPassword = true;
        }
        await EventParticipant.findOneAndUpdate(
          { eventId: req.params.eventId, username },
          updateData,
          { upsert: true, new: true }
        );
      }

      await event.addParticipant(username);

      const io = req.app.get('io');
      if (io) {
        io.to(`event_${req.params.eventId}`).emit('participant_joined', {
          username, role: 'participant', joinedAt: new Date(), participants: event.participants
        });
      }

      // Preserve organizer role if this is the organizer logging back in
      const isOrganizer = event.organizerName === username ||
        event.participants.some(p => p.username === username && p.role === 'organizer');

      const token = jwt.sign(
        { eventId: event._id.toString(), username, role: isOrganizer ? 'organizer' : 'participant' },
        secrets.jwt, { expiresIn: '30d' }
      );
      res.json({ message: 'Access granted', token, event: { id: event._id, title: event.title } });
    } catch (error) { next(error); }
  }
);

// Join (no password)
router.post('/join/:eventId',
  [body('username').trim().isLength({ min: 1, max: 100 }), body('accountPassword').optional(), validate],
  async (req, res, next) => {
    try {
      const event = await Event.findById(req.params.eventId);
      if (!event) return res.status(404).json({ error: 'Event not found.' });
      if (event.isPasswordProtected) return res.status(403).json({ error: 'This event requires a password.' });

      const { username, accountPassword } = req.body;

      const existing = await EventParticipant.findOne({ eventId: req.params.eventId, username }).select('+password');
      if (existing && existing.hasPassword) {
        if (!accountPassword) return res.status(400).json({ error: 'This name has an account — enter your account password.', requiresAccountPassword: true });
        const accountMatch = await bcrypt.compare(accountPassword, existing.password);
        if (!accountMatch) return res.status(401).json({ error: 'Incorrect account password.' });
        existing.lastSeenAt = new Date();
        await existing.save();
      } else {
        const updateData = { role: 'participant', lastSeenAt: new Date() };
        if (accountPassword) {
          updateData.password = await bcrypt.hash(accountPassword, 10);
          updateData.hasPassword = true;
        }
        await EventParticipant.findOneAndUpdate(
          { eventId: req.params.eventId, username },
          updateData,
          { upsert: true, new: true }
        );
      }

      await event.addParticipant(username);

      const io = req.app.get('io');
      if (io) {
        io.to(`event_${req.params.eventId}`).emit('participant_joined', {
          username, role: 'participant', joinedAt: new Date(), participants: event.participants
        });
      }

      // Preserve organizer role if this is the organizer logging back in
      const isOrganizer = event.organizerName === username || 
        event.participants.some(p => p.username === username && p.role === 'organizer');
      
      const token = jwt.sign(
        { eventId: event._id.toString(), username, role: isOrganizer ? 'organizer' : 'participant' },
        secrets.jwt, { expiresIn: '30d' }
      );
      res.json({ message: 'Joined successfully', token, event: { id: event._id, title: event.title } });
    } catch (error) { next(error); }
  }
);

// Get full event details (authenticated)
router.get('/:eventId', verifyEventAccess, async (req, res, next) => {
  try {
    const event = req.event;
    res.json({
      event: {
        id: event._id, subdomain: event.subdomain, title: event.title,
        description: event.description, date: event.date, location: event.location,
        organizerName: event.organizerName, settings: event.settings,
        participants: event.participants, maxParticipants: event.maxParticipants,
        status: event.status, isPasswordProtected: event.isPasswordProtected,
        isEnterpriseMode: event.isEnterpriseMode,
        rsvps: event.rsvps, rsvpSummary: event.getRsvpSummary(),
        agenda: event.agenda ? [...event.agenda].sort((a, b) => a.order - b.order) : [],
        createdAt: event.createdAt
      }
    });
  } catch (error) { next(error); }
});

// ── RSVP ──────────────────────────────────────────────────────────────────
router.post('/:eventId/rsvp',
  verifyEventAccess,
  [
    body('username').trim().isLength({ min: 1, max: 100 }).withMessage('Username required'),
    body('status').isIn(['yes', 'maybe', 'no']).withMessage('Status must be yes, maybe, or no'),
    validate
  ],
  async (req, res, next) => {
    try {
      const event = req.event;
      await event.setRsvp(req.body.username, req.body.status);

      // ── FIX: Emit complete RSVP data including rsvps array ──
      const io = req.app.get('io');
      if (io) {
        io.to(`event_${req.params.eventId}`).emit('rsvp_updated', {
          username: req.body.username,
          status: req.body.status,
          rsvps: event.rsvps,
          summary: event.getRsvpSummary()
        });
      }

      res.json({ message: 'RSVP recorded', rsvpSummary: event.getRsvpSummary() });
    } catch (error) { next(error); }
  }
);

// ── TASKS ─────────────────────────────────────────────────────────────────
// Get tasks
router.get('/:eventId/tasks', verifyEventAccess, async (req, res, next) => {
  try {
    const tasks = req.event.tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ tasks, stats: req.event.getTaskStats() });
  } catch (error) { next(error); }
});

// Create task
router.post('/:eventId/tasks', verifyEventAccess,
  [
    body('title').trim().isLength({ min: 1, max: 200 }),
    body('description').optional().trim().isLength({ max: 500 }),
    body('assignedTo').optional().trim().isLength({ max: 100 }),
    body('dueDate').optional().isISO8601(),
    body('priority').optional().isIn(['low', 'medium', 'high']),
    validate
  ],
  async (req, res, next) => {
    try {
      const { title, description, assignedTo, dueDate, priority } = req.body;
      const task = {
        id: uuidv4(),
        title, description: description || '', assignedTo, dueDate,
        priority: priority || 'medium',
        createdBy: req.eventAccess.username,
        completed: false
      };
      req.event.tasks.push(task);
      await req.event.save();

      const io = req.app.get('io');
      if (io) io.to(`event_${req.params.eventId}`).emit('tasks_updated', { tasks: req.event.tasks });

      res.status(201).json({ message: 'Task created', task });
    } catch (error) { next(error); }
  }
);

// Toggle task completion
router.patch('/:eventId/tasks/:taskId/toggle', verifyEventAccess, async (req, res, next) => {
  try {
    const task = req.event.tasks.find(t => t.id === req.params.taskId);
    if (!task) return res.status(404).json({ error: 'Task not found' });

    task.completed = !task.completed;
    if (task.completed) {
      task.completedBy = req.eventAccess.username;
      task.completedAt = new Date();
    } else {
      task.completedBy = undefined;
      task.completedAt = undefined;
    }
    await req.event.save();

    const io = req.app.get('io');
    if (io) io.to(`event_${req.params.eventId}`).emit('tasks_updated', { tasks: req.event.tasks });

    res.json({ message: 'Task updated', task });
  } catch (error) { next(error); }
});

// Delete task
router.delete('/:eventId/tasks/:taskId', verifyEventAccess, async (req, res, next) => {
  try {
    req.event.tasks = req.event.tasks.filter(t => t.id !== req.params.taskId);
    await req.event.save();

    const io = req.app.get('io');
    if (io) io.to(`event_${req.params.eventId}`).emit('tasks_updated', { tasks: req.event.tasks });

    res.json({ message: 'Task deleted' });
  } catch (error) { next(error); }
});

// ── ANNOUNCEMENTS ─────────────────────────────────────────────────────────
// Get announcements
router.get('/:eventId/announcements', verifyEventAccess, async (req, res, next) => {
  try {
    const announcements = [...req.event.announcements].sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );
    res.json({ announcements });
  } catch (error) { next(error); }
});

// Create announcement (organizer only)
router.post('/:eventId/announcements', verifyEventAccess,
  [
    body('title').trim().isLength({ min: 1, max: 200 }),
    body('content').trim().isLength({ min: 1, max: 2000 }),
    body('important').optional().isBoolean(),
    validate
  ],
  async (req, res, next) => {
    try {
      const isOrg = req.event.participants.some(p => 
        p.username === req.eventAccess.username && p.role === 'organizer'
      );
      if (!isOrg) return res.status(403).json({ error: 'Only organizers can create announcements' });

      const announcement = {
        id: uuidv4(),
        title: req.body.title,
        content: req.body.content,
        important: req.body.important || false,
        author: req.eventAccess.username,
        createdAt: new Date()
      };
      req.event.announcements.push(announcement);
      await req.event.save();

      const io = req.app.get('io');
      if (io) io.to(`event_${req.params.eventId}`).emit('announcement_created', { announcement });

      res.status(201).json({ message: 'Announcement created', announcement });
    } catch (error) { next(error); }
  }
);

// Delete announcement (organizer only)
router.delete('/:eventId/announcements/:announcementId', verifyEventAccess, async (req, res, next) => {
  try {
    const isOrg = req.event.participants.some(p => 
      p.username === req.eventAccess.username && p.role === 'organizer'
    );
    if (!isOrg) return res.status(403).json({ error: 'Only organizers can delete announcements' });

    req.event.announcements = req.event.announcements.filter(a => a.id !== req.params.announcementId);
    await req.event.save();

    const io = req.app.get('io');
    if (io) io.to(`event_${req.params.eventId}`).emit('announcements_updated', { announcements: req.event.announcements });

    res.json({ message: 'Announcement deleted' });
  } catch (error) { next(error); }
});

// ── EXPENSES ──────────────────────────────────────────────────────────────
// Get expenses
router.get('/:eventId/expenses', verifyEventAccess, async (req, res, next) => {
  try {
    const expenses = [...req.event.expenses].sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json({ expenses, summary: req.event.getExpenseSummary(), budget: req.event.budget });
  } catch (error) { next(error); }
});

// Add expense
router.post('/:eventId/expenses', verifyEventAccess,
  [
    body('title').trim().isLength({ min: 1, max: 200 }),
    body('amount').isFloat({ min: 0 }),
    body('category').optional().trim().isLength({ max: 100 }),
    body('paidBy').optional().trim().isLength({ max: 100 }),
    body('notes').optional().trim().isLength({ max: 500 }),
    validate
  ],
  async (req, res, next) => {
    try {
      const { title, amount, category, paidBy, notes } = req.body;
      const expense = {
        id: uuidv4(),
        title, amount, category, paidBy, notes,
        createdBy: req.eventAccess.username,
        date: new Date()
      };
      req.event.expenses.push(expense);
      await req.event.save();

      const io = req.app.get('io');
      if (io) io.to(`event_${req.params.eventId}`).emit('expenses_updated', { 
        expenses: req.event.expenses,
        summary: req.event.getExpenseSummary()
      });

      res.status(201).json({ message: 'Expense added', expense });
    } catch (error) { next(error); }
  }
);

// Update budget (organizer only)
router.patch('/:eventId/budget', verifyEventAccess,
  [body('budget').isFloat({ min: 0 }), validate],
  async (req, res, next) => {
    try {
      const isOrg = req.event.participants.some(p => 
        p.username === req.eventAccess.username && p.role === 'organizer'
      );
      if (!isOrg) return res.status(403).json({ error: 'Only organizers can set budget' });

      req.event.budget = req.body.budget;
      await req.event.save();

      res.json({ message: 'Budget updated', budget: req.event.budget });
    } catch (error) { next(error); }
  }
);

// Delete expense
router.delete('/:eventId/expenses/:expenseId', verifyEventAccess, async (req, res, next) => {
  try {
    req.event.expenses = req.event.expenses.filter(e => e.id !== req.params.expenseId);
    await req.event.save();

    const io = req.app.get('io');
    if (io) io.to(`event_${req.params.eventId}`).emit('expenses_updated', { 
      expenses: req.event.expenses,
      summary: req.event.getExpenseSummary()
    });

    res.json({ message: 'Expense deleted' });
  } catch (error) { next(error); }
});

// ── NOTES ─────────────────────────────────────────────────────────────────
// Get notes
router.get('/:eventId/notes', verifyEventAccess, async (req, res, next) => {
  try {
    const notes = [...req.event.notes].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    res.json({ notes });
  } catch (error) { next(error); }
});

// Create note
router.post('/:eventId/notes', verifyEventAccess,
  [
    body('title').trim().isLength({ min: 1, max: 200 }),
    body('content').trim().isLength({ min: 1, max: 5000 }),
    body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/),
    validate
  ],
  async (req, res, next) => {
    try {
      const { title, content, color } = req.body;
      const note = {
        id: uuidv4(),
        title, content,
        color: color || '#fef3c7',
        author: req.eventAccess.username,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      req.event.notes.push(note);
      await req.event.save();

      const io = req.app.get('io');
      if (io) io.to(`event_${req.params.eventId}`).emit('notes_updated', { notes: req.event.notes });

      res.status(201).json({ message: 'Note created', note });
    } catch (error) { next(error); }
  }
);

// Update note
router.put('/:eventId/notes/:noteId', verifyEventAccess,
  [
    body('title').optional().trim().isLength({ min: 1, max: 200 }),
    body('content').optional().trim().isLength({ min: 1, max: 5000 }),
    body('color').optional().matches(/^#[0-9A-Fa-f]{6}$/),
    validate
  ],
  async (req, res, next) => {
    try {
      const note = req.event.notes.find(n => n.id === req.params.noteId);
      if (!note) return res.status(404).json({ error: 'Note not found' });

      if (req.body.title) note.title = req.body.title;
      if (req.body.content) note.content = req.body.content;
      if (req.body.color) note.color = req.body.color;
      note.updatedAt = new Date();
      
      await req.event.save();

      const io = req.app.get('io');
      if (io) io.to(`event_${req.params.eventId}`).emit('notes_updated', { notes: req.event.notes });

      res.json({ message: 'Note updated', note });
    } catch (error) { next(error); }
  }
);

// Delete note
router.delete('/:eventId/notes/:noteId', verifyEventAccess, async (req, res, next) => {
  try {
    req.event.notes = req.event.notes.filter(n => n.id !== req.params.noteId);
    await req.event.save();

    const io = req.app.get('io');
    if (io) io.to(`event_${req.params.eventId}`).emit('notes_updated', { notes: req.event.notes });

    res.json({ message: 'Note deleted' });
  } catch (error) { next(error); }
});

// ── ANALYTICS ─────────────────────────────────────────────────────────────
// Get analytics (organizer only) - UPDATED WITH CHECK-IN STATS
router.get('/:eventId/analytics', verifyEventAccess, async (req, res, next) => {
  try {
    const isOrg = req.event.participants.some(p => 
      p.username === req.eventAccess.username && p.role === 'organizer'
    );
    if (!isOrg) return res.status(403).json({ error: 'Only organizers can view analytics' });

    const Message = require('../models/Message');
    const Poll = require('../models/Poll');
    const File = require('../models/File');
    const Invite = require('../models/Invite');

    const promises = [
      Message.countDocuments({ eventId: req.params.eventId }).catch(() => 0),
      Poll.countDocuments({ eventId: req.params.eventId }).catch(() => 0),
      File.countDocuments({ eventId: req.params.eventId }).catch(() => 0)
    ];

    // Add check-in analytics for enterprise events
    if (req.event.isEnterpriseMode) {
      promises.push(
        Invite.find({ eventId: req.params.eventId }).catch(() => [])
      );
    }

    const results = await Promise.all(promises);
    const [messageCount, pollCount, fileCount, invites] = results;

    const baseAnalytics = req.event.getAnalytics ? req.event.getAnalytics() : {
      views: req.event.metadata?.views || 0,
      participants: req.event.participants?.length || 0,
      rsvps: req.event.getRsvpSummary ? req.event.getRsvpSummary() : { yes: 0, maybe: 0, no: 0 },
      tasks: req.event.getTaskStats ? req.event.getTaskStats() : { total: 0, completed: 0, pending: 0 },
      expenses: req.event.getExpenseSummary ? req.event.getExpenseSummary() : { total: 0, count: 0, byCategory: {} },
      lastActivity: req.event.metadata?.lastActivity || new Date()
    };

    const analytics = {
      ...baseAnalytics,
      messages: messageCount,
      polls: pollCount,
      files: fileCount
    };

    // Add enterprise check-in analytics
    if (req.event.isEnterpriseMode && invites) {
      const checkedInInvites = invites.filter(i => i.checkedIn);
      const totalInvites = invites.length;
      const totalExpectedGuests = invites.reduce((sum, i) => {
        return sum + (i.adults || 1) + (i.children || 0);
      }, 0);
      const totalCheckedIn = checkedInInvites.reduce((sum, i) => {
        return sum + (i.actualAttendees || (i.adults || 1) + (i.children || 0));
      }, 0);

      analytics.checkins = {
        totalInvites,
        checkedInInvites: checkedInInvites.length,
        pendingInvites: totalInvites - checkedInInvites.length,
        totalExpectedGuests,
        totalCheckedIn,
        checkInRate: totalInvites > 0 ? Math.round((checkedInInvites.length / totalInvites) * 100) : 0,
        attendanceRate: totalExpectedGuests > 0 ? Math.round((totalCheckedIn / totalExpectedGuests) * 100) : 0
      };
    }

    res.json({ analytics });
  } catch (error) { 
    console.error('Analytics error:', error);
    next(error); 
  }
});

// ── UTILITIES ─────────────────────────────────────────────────────────────
// Generate ICS calendar file
router.get('/:eventId/calendar.ics', verifyEventAccess, async (req, res, next) => {
  try {
    const event = req.event;
    const startDate = new Date(event.date);
    const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000); // +2 hours default

    const formatDate = (date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };

    const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//PlanIt//Event//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:${event._id}@planit.app
DTSTAMP:${formatDate(new Date())}
DTSTART:${formatDate(startDate)}
DTEND:${formatDate(endDate)}
SUMMARY:${event.title}
DESCRIPTION:${event.description || ''}
LOCATION:${event.location || ''}
ORGANIZER;CN=${event.organizerName}:mailto:${event.organizerEmail}
URL:${req.protocol}://${req.get('host')}/e/${event.subdomain}
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;

    res.setHeader('Content-Type', 'text/calendar');
    res.setHeader('Content-Disposition', `attachment; filename="${event.subdomain}.ics"`);
    res.send(ics);
  } catch (error) { next(error); }
});

// Export participants as CSV
router.get('/:eventId/participants.csv', verifyEventAccess, async (req, res, next) => {
  try {
    const isOrg = req.event.participants.some(p => 
      p.username === req.eventAccess.username && p.role === 'organizer'
    );
    if (!isOrg) return res.status(403).json({ error: 'Only organizers can export participants' });

    let csv = 'Username,Role,Joined At,RSVP Status\n';
    req.event.participants.forEach(p => {
      const rsvp = req.event.rsvps.find(r => r.username === p.username);
      csv += `"${p.username}","${p.role}","${p.joinedAt.toISOString()}","${rsvp ? rsvp.status : 'no response'}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${req.event.subdomain}-participants.csv"`);
    res.send(csv);
  } catch (error) { next(error); }
});

// ── Agenda ────────────────────────────────────────────────────────────────
// Get agenda
router.get('/:eventId/agenda', verifyEventAccess, async (req, res, next) => {
  try {
    const event = req.event;
    const sorted = event.agenda ? [...event.agenda].sort((a, b) => a.order - b.order) : [];
    res.json({ agenda: sorted });
  } catch (error) { next(error); }
});

// Add agenda item (organizer only)
router.post('/:eventId/agenda',
  verifyEventAccess,
  [
    body('title').trim().isLength({ min: 1, max: 200 }).withMessage('Title required'),
    body('time').optional().trim().isLength({ max: 20 }),
    body('description').optional().trim().isLength({ max: 500 }),
    body('duration').optional().isInt({ min: 0 }),
    validate
  ],
  async (req, res, next) => {
    try {
      const event = req.event;
      // Only organizer can manage agenda
      const username = req.eventAccess?.username;
      const isOrg = event.participants.some(p => p.username === username && p.role === 'organizer');
      if (!isOrg) return res.status(403).json({ error: 'Only organizers can manage the agenda' });

      const { title, time, description, duration } = req.body;
      const item = {
        id: uuidv4(),
        title, time: time || '', description: description || '',
        duration: duration || 0,
        order: event.agenda.length
      };

      event.agenda.push(item);
      await event.save();

      const io = req.app.get('io');
      if (io) io.to(`event_${req.params.eventId}`).emit('agenda_updated', { agenda: event.agenda });

      res.status(201).json({ message: 'Agenda item added', item });
    } catch (error) { next(error); }
  }
);

// Delete agenda item (organizer only)
router.delete('/:eventId/agenda/:itemId',
  verifyEventAccess,
  async (req, res, next) => {
    try {
      const event = req.event;
      const username = req.eventAccess?.username;
      const isOrg = event.participants.some(p => p.username === username && p.role === 'organizer');
      if (!isOrg) return res.status(403).json({ error: 'Only organizers can manage the agenda' });

      event.agenda = event.agenda.filter(a => a.id !== req.params.itemId);
      await event.save();

      const io = req.app.get('io');
      if (io) io.to(`event_${req.params.eventId}`).emit('agenda_updated', { agenda: event.agenda });

      res.json({ message: 'Agenda item removed' });
    } catch (error) { next(error); }
  }
);

// Update event (organizer only)
router.put('/:eventId', verifyOrganizer,
  [
    body('title').optional().trim().isLength({ min: 1, max: 200 }),
    body('description').optional().trim().isLength({ max: 2000 }),
    body('date').optional().isISO8601(),
    body('location').optional().trim().isLength({ max: 500 }),
    validate
  ],
  async (req, res, next) => {
    try {
      const { title, description, date, location, settings, maxParticipants, status } = req.body;
      const event = req.event;
      if (title) event.title = title;
      if (description !== undefined) event.description = description;
      if (date) event.date = date;
      if (location !== undefined) event.location = location;
      if (settings) event.settings = { ...event.settings, ...settings };
      if (maxParticipants) event.maxParticipants = maxParticipants;
      if (status && ['active', 'completed', 'cancelled'].includes(status)) event.status = status;
      await event.save();
      res.json({ message: 'Event updated', event });
    } catch (error) { next(error); }
  }
);

// Delete event (organizer only)
router.delete('/:eventId', verifyOrganizer, async (req, res, next) => {
  try {
    await Event.findByIdAndDelete(req.params.eventId);
    res.json({ message: 'Event deleted successfully' });
  } catch (error) { next(error); }
});

// Enterprise Mode: Create personalized invites
router.post('/:eventId/invites', verifyOrganizer, 
  [
    body('guests').isArray().withMessage('Guests must be an array'),
    body('guests.*.guestName').trim().isLength({ min: 1, max: 100 }),
    body('guests.*.guestEmail').optional().isEmail(),
    body('guests.*.groupSize').optional().isInt({ min: 1 }),
    body('guests.*.adults').optional().isInt({ min: 0 }),
    body('guests.*.children').optional().isInt({ min: 0 }),
    validate
  ],
  async (req, res, next) => {
    try {
      const Invite = require('../models/Invite');
      const { guests } = req.body;
      
      const invites = [];
      for (const guest of guests) {
        const inviteCode = Math.random().toString(36).substring(2, 10).toUpperCase();
        
        // Calculate adults and children with proper defaults
        const adults = parseInt(guest.adults) >= 0 ? parseInt(guest.adults) : 1;
        const children = parseInt(guest.children) >= 0 ? parseInt(guest.children) : 0;
        const calculatedGroupSize = adults + children;
        
        const invite = await Invite.create({
          eventId: req.params.eventId,
          inviteCode,
          guestName: guest.guestName,
          guestEmail: guest.guestEmail || '',
          guestPhone: guest.guestPhone || '',
          adults: adults,
          children: children,
          groupSize: guest.groupSize || calculatedGroupSize,
          plusOnes: parseInt(guest.plusOnes) || 0,
          securityPin: guest.securityPin || '',
          notes: guest.notes || ''
        });
        invites.push(invite);
      }
      
      res.status(201).json({ message: 'Invites created', invites });
    } catch (error) { next(error); }
  }
);

// Get all invites for event
router.get('/:eventId/invites', verifyOrganizer, async (req, res, next) => {
  try {
    const Invite = require('../models/Invite');
    const invites = await Invite.find({ eventId: req.params.eventId }).sort({ createdAt: -1 });
    res.json({ invites });
  } catch (error) { next(error); }
});

// Get invite by code (public)
router.get('/invite/:inviteCode', async (req, res, next) => {
  try {
    const Invite = require('../models/Invite');
    const invite = await Invite.findOne({ inviteCode: req.params.inviteCode });
    if (!invite) return res.status(404).json({ error: 'Invite not found' });
    
    const event = await Event.findById(invite.eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    
    res.json({ 
      invite: {
        code: invite.inviteCode,
        inviteCode: invite.inviteCode,
        guestName: invite.guestName,
        guestEmail: invite.guestEmail,
        guestPhone: invite.guestPhone,
        adults: invite.adults,
        children: invite.children,
        groupSize: invite.groupSize,
        plusOnes: invite.plusOnes,
        checkedIn: invite.checkedIn,
        checkedInAt: invite.checkedInAt,
        status: invite.status,
        notes: invite.notes,
        email: invite.guestEmail
      },
      event: {
        id: event._id,
        title: event.title,
        date: event.date,
        location: event.location,
        description: event.description,
        organizerName: event.organizerName,
        timezone: event.timezone || 'UTC'
      }
    });
  } catch (error) { next(error); }
});

router.post('/:eventId/invites/:inviteCode/rsvp', async (req, res, next) => {
  try {
    const Invite = require('../models/Invite');
    const { status } = req.body;
    
    if (!['confirmed', 'declined'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const invite = await Invite.findOne({ 
      eventId: req.params.eventId, 
      inviteCode: req.params.inviteCode 
    });
    
    if (!invite) return res.status(404).json({ error: 'Invite not found' });
    
    invite.status = status;
    await invite.save();
    
    res.json({ message: 'RSVP updated', invite });
  } catch (error) { next(error); }
});

// ═══════════════════════════════════════════════════════════════════════════
// SECURE CHECK-IN SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

// STEP 1: Scan / lookup — returns full guest profile WITHOUT committing check-in
// Used by scanner UI to show the "boarding pass" before staff taps Admit
const {
  detectDuplicates,
  preventReentrancy,
  detectSuspiciousPatterns,
  enforceBlocks,
  enforceTimeWindow,
  enforceCapacity,
  auditLog,
} = require('../middleware/antifraud');

router.get('/:eventId/verify-scan/:inviteCode', 
  verifyEventAccess,
  enforceBlocks,           // ✅ Check emergency lockdown, blocks, trust scores
  detectDuplicates,        // ✅ Check for duplicate guests
  detectSuspiciousPatterns, // ✅ Check for rapid scans, multiple devices
  enforceCapacity,         // ✅ Check max attendees limit
  enforceTimeWindow,       // ✅ Check time restrictions
  auditLog,                // ✅ Log all scan attempts
  async (req, res, next) => {
  try {
    const Invite = require('../models/Invite');
    const { eventId, inviteCode } = req.params;
    const ip = req.ip || req.connection.remoteAddress || '';
    const staffUser = req.eventAccess?.username || 'staff';

    // ── Cross-event security: invite must belong to THIS event ──
    const invite = await Invite.findOne({ inviteCode: inviteCode.toUpperCase().trim() });

    if (!invite) {
      return res.status(404).json({
        valid: false,
        reason: 'not_found',
        message: 'QR code not recognised. Deny entry.',
      });
    }

    if (invite.eventId.toString() !== eventId) {
      // Log the cross-event attempt on the invite it actually belongs to
      invite.scanAttempts.push({ reason: 'wrong_event', attemptedBy: staffUser, ipAddress: ip });
      await invite.save();
      return res.status(403).json({
        valid: false,
        reason: 'wrong_event',
        message: 'This ticket belongs to a DIFFERENT event. Deny entry.',
      });
    }

    if (invite.checkedIn) {
      invite.scanAttempts.push({ reason: 'already_checked_in', attemptedBy: staffUser, ipAddress: ip });
      await invite.save();

      // Check if this event allows manual override for already-used tickets
      const eventForOverride = await Event.findById(eventId).select('checkinSettings').lean();
      const allowOverride = eventForOverride?.checkinSettings?.allowManualOverride || false;

      return res.status(400).json({
        valid: false,
        reason: 'already_checked_in',
        severity: 'high',
        message: 'This ticket has already been used.',
        displayMessage: 'TICKET ALREADY USED',
        blockedReason: 'already_checked_in',
        inviteCode: invite.inviteCode,
        guestName: invite.guestName,
        groupSize: invite.groupSize,
        checkedInAt: invite.checkedInAt,
        checkedInBy: invite.checkedInBy,
        requiresOverride: allowOverride,
      });
    }

    // Get event checkin settings
    const event = await Event.findById(eventId).select('checkinSettings title').lean();
    const settings = event?.checkinSettings || {};

    // ── Collect security warnings from middleware ──
    const warnings = req.securityWarnings || [];
    const flags = invite.securityFlags || [];
    
    // Calculate trust score
    const trustScore = invite.calculateTrustScore();

    // ── Return the full guest profile for staff to review ──
    res.json({
      valid: true,
      requiresPin: settings.requirePin && !!invite.securityPin,
      guest: {
        id:          invite._id,
        inviteCode:  invite.inviteCode,
        guestName:   invite.guestName,
        guestEmail:  invite.guestEmail,
        guestPhone:  invite.guestPhone,
        adults:      invite.adults,
        children:    invite.children,
        groupSize:   invite.groupSize,
        plusOnes:    invite.plusOnes,
        status:      invite.status,
        notes:       invite.notes,
        // Only expose PIN hint — never the actual PIN value over the wire
        hasPin:      !!(invite.securityPin),
      },
      security: {
        trustScore:  trustScore,
        warnings:    warnings,
        flags:       flags,
      },
      event: { title: event?.title },
      staffNote: settings.staffNote || '',
    });
  } catch (error) { next(error); }
});

// STEP 2: Verify PIN (called if requiresPin === true, before committing admission)
router.post('/:eventId/verify-pin/:inviteCode', verifyEventAccess, async (req, res, next) => {
  try {
    const Invite = require('../models/Invite');
    const { eventId, inviteCode } = req.params;
    const { pin } = req.body;
    const ip = req.ip || req.connection.remoteAddress || '';
    const staffUser = req.eventAccess?.username || 'staff';

    const invite = await Invite.findOne({ inviteCode: inviteCode.toUpperCase().trim(), eventId });
    if (!invite) return res.status(404).json({ valid: false, message: 'Invite not found.' });

    if (!invite.securityPin || invite.securityPin.trim() === '') {
      return res.json({ valid: true, message: 'No PIN required.' });
    }

    if (!pin || pin.trim() !== invite.securityPin.trim()) {
      invite.scanAttempts.push({ reason: 'wrong_pin', attemptedBy: staffUser, ipAddress: ip });
      await invite.save();

      const event = await Event.findById(eventId).select('checkinSettings').lean();
      const maxAttempts = event?.checkinSettings?.maxFailedAttempts || 3;
      const pinAttempts = invite.scanAttempts.filter(a => a.reason === 'wrong_pin').length;
      const remaining = Math.max(0, maxAttempts - pinAttempts);

      return res.status(401).json({
        valid: false,
        message: remaining > 0
          ? `Incorrect PIN. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`
          : 'PIN locked — too many failed attempts. Escalate to organizer.',
        locked: remaining === 0,
      });
    }

    res.json({ valid: true, message: 'PIN verified.' });
  } catch (error) { next(error); }
});

// STEP 3: Commit check-in — only called after staff reviews profile (and PIN if required)
router.post('/:eventId/checkin/:inviteCode', 
  verifyEventAccess,
  preventReentrancy,  // ✅ Prevent simultaneous check-ins
  async (req, res, next) => {
  try {
    const Invite = require('../models/Invite');
    const { eventId, inviteCode } = req.params;
    const { actualAttendees, pinVerified } = req.body;
    const ip = req.ip || req.connection.remoteAddress || '';
    const staffUser = req.eventAccess?.username || 'staff';

    // Re-verify event ownership on commit (belt-and-suspenders)
    const invite = await Invite.findOne({ inviteCode: inviteCode.toUpperCase().trim() });
    if (!invite) return res.status(404).json({ error: 'Invite not found' });

    if (invite.eventId.toString() !== eventId) {
      invite.scanAttempts.push({ reason: 'wrong_event', attemptedBy: staffUser, ipAddress: ip });
      await invite.save();
      return res.status(403).json({ error: 'Cross-event ticket — access denied.' });
    }

    if (invite.checkedIn) {
      return res.status(400).json({
        error: 'Already checked in',
        checkedInAt: invite.checkedInAt,
        checkedInBy: invite.checkedInBy,
      });
    }

    const event = await Event.findById(eventId).select('checkinSettings').lean();
    const settings = event?.checkinSettings || {};

    // If PIN is required and wasn't verified, block commit
    if (settings.requirePin && invite.securityPin && !pinVerified) {
      return res.status(403).json({ error: 'PIN verification required before check-in.' });
    }

    // ✅ FINAL CAPACITY CHECK before committing
    if (settings.enableCapacityLimits && settings.maxTotalAttendees) {
      const checkedInInvites = await Invite.find({ eventId, checkedIn: true });
      const currentAttendees = checkedInInvites.reduce((sum, inv) => sum + (inv.actualAttendees || 0), 0);
      const newTotal = currentAttendees + (actualAttendees || invite.groupSize);
      
      if (newTotal > settings.maxTotalAttendees) {
        return res.status(403).json({
          error: 'Capacity limit reached',
          message: 'Cannot check in - venue at maximum capacity',
          currentCapacity: currentAttendees,
          maxCapacity: settings.maxTotalAttendees
        });
      }
    }

    invite.checkedIn    = true;
    invite.checkedInAt  = new Date();
    invite.checkedInBy  = staffUser;
    invite.status       = 'checked-in';
    invite.actualAttendees = (actualAttendees !== undefined && actualAttendees !== null)
      ? parseInt(actualAttendees)
      : (invite.adults + invite.children) || invite.groupSize;
    
    // Add to check-in history
    invite.checkInHistory.push({
      checkedInAt: new Date(),
      checkedInBy: staffUser,
      actualAttendees: invite.actualAttendees,
    });

    await invite.save();

    // Release reentrancy lock
    if (req.checkInInvite) {
      await req.checkInInvite.releaseCheckInLock();
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`event_${eventId}`).emit('guest_checked_in', {
        inviteCode:       invite.inviteCode,
        guestName:        invite.guestName,
        adults:           invite.adults,
        children:         invite.children,
        actualAttendees:  invite.actualAttendees,
        checkedInAt:      invite.checkedInAt,
      });
    }

    res.json({
      message: 'Guest checked in successfully',
      invite: {
        id:              invite._id,
        inviteCode:      invite.inviteCode,
        guestName:       invite.guestName,
        adults:          invite.adults,
        children:        invite.children,
        groupSize:       invite.groupSize,
        actualAttendees: invite.actualAttendees,
        checkedInAt:     invite.checkedInAt,
        checkedInBy:     invite.checkedInBy,
        notes:           invite.notes,
      },
    });
  } catch (error) { next(error); }
});

// Get check-in analytics
router.get('/:eventId/checkin-stats', verifyOrganizer, async (req, res, next) => {
  try {
    const Invite = require('../models/Invite');
    const invites = await Invite.find({ eventId: req.params.eventId });

    const total       = invites.length;
    const checkedIn   = invites.filter(i => i.checkedIn).length;
    const pending     = invites.filter(i => i.status === 'pending').length;
    const confirmed   = invites.filter(i => i.status === 'confirmed').length;
    const declined    = invites.filter(i => i.status === 'declined').length;

    const totalExpectedAdults    = invites.reduce((s, i) => s + (i.adults   || 0), 0);
    const totalExpectedChildren  = invites.reduce((s, i) => s + (i.children || 0), 0);
    const totalExpectedAttendees = invites.reduce((s, i) => s + i.groupSize, 0);
    const totalActualAttendees   = invites.reduce((s, i) => s + i.actualAttendees, 0);
    const totalFailedScans       = invites.reduce((s, i) => s + i.scanAttempts.length, 0);

    res.json({
      stats: {
        total, checkedIn, pending, confirmed, declined,
        noShow: Math.max(0, confirmed - checkedIn),
        totalExpectedAdults,
        totalExpectedChildren,
        totalExpectedAttendees,
        totalActualAttendees,
        totalFailedScans,
      }
    });
  } catch (error) { next(error); }
});

// Get / update checkin security settings (organizer only)
router.get('/:eventId/checkin-settings', verifyOrganizer, async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.eventId).select('checkinSettings').lean();
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json({ settings: event.checkinSettings || {} });
  } catch (error) { next(error); }
});

router.patch('/:eventId/checkin-settings', verifyOrganizer, async (req, res, next) => {
  try {
    // ══════════════════════════════════════════════════════════════════
    // COMPREHENSIVE SECURITY SETTINGS - CORRECT MIDDLEWARE NAMES
    // ══════════════════════════════════════════════════════════════════
    const allowed = [
      // General Security
      'requirePin',
      'requireCodeConfirm',
      'blockCrossEvent',
      'maxFailedAttempts',
      'lockoutMinutes',
      'allowManualOverride',
      'staffNote',
      
      // Duplicate Prevention - ✅ CORRECT NAMES
      'enableDuplicateDetection',
      'duplicateDetectionMode',
      'autoBlockDuplicates',
      'allowMultipleTickets',
      
      // Pattern Detection - ✅ CORRECT NAMES
      'enablePatternDetection',
      'rapidScanThreshold',
      'rapidScanWindowSeconds',
      'multiDeviceThreshold',
      
      // Trust Scoring - ✅ CORRECT NAMES
      'enableTrustScore',
      'minimumTrustScore',
      'autoBlockLowTrust',
      
      // Reentrancy Protection
      'enableReentrancyProtection',
      
      // Time Restrictions
      'enableTimeRestrictions',
      'checkInWindowStart',
      'checkInWindowEnd',
      'allowLateCheckIn',
      
      // Advanced Settings
      'detailedAuditLogging',
      'logIPAddresses',
      'logDeviceInfo',
      'enableCapacityLimits',
      'maxTotalAttendees',
      
      // Emergency Controls
      'emergencyLockdown',
      'emergencyLockdownReason',
      'emergencyLockdownAt',
    ];
    
    console.log('[SETTINGS] Incoming request body:', req.body);
    
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates[`checkinSettings.${key}`] = req.body[key];
      }
    }
    
    console.log('[SETTINGS] Updates to apply:', updates);
    
    const event = await Event.findByIdAndUpdate(
      req.params.eventId, 
      { $set: updates }, 
      { new: true, runValidators: false }
    ).select('checkinSettings');
    
    if (!event) return res.status(404).json({ error: 'Event not found' });
    
    console.log('[SETTINGS] Saved settings:', event.checkinSettings);
    
    res.json({ settings: event.checkinSettings });
  } catch (error) { 
    console.error('[SETTINGS] Error saving:', error);
    next(error); 
  }
});

router.put('/:eventId/invites/:inviteId', verifyOrganizer, 
  [
    body('guestName').optional().trim().isLength({ min: 1, max: 100 }),
    body('guestEmail').optional().isEmail(),
    body('guestPhone').optional().trim(),
    body('adults').optional().isInt({ min: 0 }),
    body('children').optional().isInt({ min: 0 }),
    body('groupSize').optional().isInt({ min: 1 }),
    body('plusOnes').optional().isInt({ min: 0 }),
    body('securityPin').optional().trim().isLength({ max: 6 }),
    body('notes').optional().trim(),
    validate
  ],
  async (req, res, next) => {
    try {
      const Invite = require('../models/Invite');
      const { inviteId, eventId } = req.params;
      
      // Verify invite belongs to this event
      const invite = await Invite.findById(inviteId);
      if (!invite) {
        return res.status(404).json({ error: 'Invite not found' });
      }
      
      if (invite.eventId.toString() !== eventId) {
        return res.status(403).json({ error: 'Invite does not belong to this event' });
      }
      
      // Don't allow updating checked-in invites
      if (invite.checkedIn) {
        return res.status(400).json({ error: 'Cannot update checked-in invite' });
      }
      
      // Update fields
      const allowedFields = ['guestName', 'guestEmail', 'guestPhone', 'adults', 'children', 'groupSize', 'plusOnes', 'securityPin', 'notes'];
      const updates = {};
      
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      }
      
      // Recalculate groupSize if adults or children changed
      if (updates.adults !== undefined || updates.children !== undefined) {
        const adults = updates.adults !== undefined ? parseInt(updates.adults) : invite.adults;
        const children = updates.children !== undefined ? parseInt(updates.children) : invite.children;
        updates.groupSize = adults + children;
      }
      
      Object.assign(invite, updates);
      await invite.save();
      
      res.json({ 
        message: 'Invite updated successfully', 
        invite 
      });
    } catch (error) { 
      next(error); 
    }
  }
);





// Delete invite
router.delete('/:eventId/invites/:inviteId', verifyOrganizer, async (req, res, next) => {
  try {
    const Invite = require('../models/Invite');
    await Invite.findByIdAndDelete(req.params.inviteId);
    res.json({ message: 'Invite deleted' });
  } catch (error) { next(error); }
});

module.exports = router;

// ═══════════════════════════════════════════════════════════════════════════
// BACKUP & DATA EXPORT ROUTES
// ═══════════════════════════════════════════════════════════════════════════

const Message = require('../models/Message');
const Poll = require('../models/Poll');
const File = require('../models/File');

/**
 * GET /api/events/:eventId/backup
 * 
 * Download complete backup of event data
 * Returns JSON file with all event information
 * Users should download this before their event date
 */
router.get('/:eventId/backup', verifyOrganizer, async (req, res, next) => {
  try {
    const { eventId } = req.params;

    // Get the event
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Gather all event data
    const [messages, polls, files, participants, invites] = await Promise.all([
      Message.find({ eventId, isDeleted: false })
        .select('-__v')
        .lean(),
      Poll.find({ eventId })
        .select('-__v')
        .lean(),
      File.find({ eventId, isDeleted: false })
        .select('-__v')
        .lean(),
      EventParticipant.find({ eventId })
        .select('-password -__v')
        .lean(),
      (() => {
        try {
          const Invite = require('../models/Invite');
          return Invite.find({ eventId }).select('-__v').lean();
        } catch {
          return Promise.resolve([]);
        }
      })()
    ]);

    // Create comprehensive backup object
    const backup = {
      metadata: {
        exportDate: new Date().toISOString(),
        eventId: event._id,
        planItVersion: '1.0.0',
        format: 'JSON'
      },
      event: {
        id: event._id,
        title: event.title,
        description: event.description,
        date: event.date,
        location: event.location,
        organizerName: event.organizerName,
        organizerEmail: event.organizerEmail,
        isEnterpriseMode: event.isEnterpriseMode,
        subdomain: event.subdomain,
        status: event.status,
        createdAt: event.createdAt,
        tasks: event.tasks || [],
        announcements: event.announcements || [],
        expenses: event.expenses || [],
        budget: event.budget || 0,
        notes: event.notes || [],
        agenda: event.agenda || [],
        rsvps: event.rsvps || []
      },
      statistics: {
        totalParticipants: participants.length,
        totalMessages: messages.length,
        totalPolls: polls.length,
        totalFiles: files.length,
        totalInvites: invites.length,
        totalExpenses: event.expenses?.length || 0,
        totalTasks: event.tasks?.length || 0,
        totalBudget: event.budget || 0
      },
      participants: participants.map(p => ({
        username: p.username,
        role: p.role,
        joinedAt: p.joinedAt,
        hasPassword: p.hasPassword,
        rsvp: event.rsvps?.find(r => r.username === p.username)
      })),
      messages: messages.map(m => ({
        id: m._id,
        username: m.username,
        content: m.content,
        createdAt: m.createdAt,
        editedAt: m.editedAt,
        reactions: m.reactions || []
      })),
      polls: polls.map(p => ({
        id: p._id,
        question: p.question,
        options: p.options || [],
        createdBy: p.createdBy,
        createdAt: p.createdAt,
        closedAt: p.closedAt,
        allowMultiple: p.allowMultiple
      })),
      files: files.map(f => ({
        id: f._id,
        filename: f.filename,
        originalName: f.originalName,
        size: f.size,
        mimetype: f.mimetype,
        url: f.cloudinaryUrl || f.url, // Support both old and new file systems
        uploadedBy: f.uploadedBy,
        uploadedAt: f.uploadedAt
      })),
      invites: invites.map(i => ({
        guestName: i.guestName,
        guestEmail: i.guestEmail,
        inviteCode: i.inviteCode,
        groupSize: i.groupSize,
        plusOnes: i.plusOnes,
        status: i.status,
        checkedIn: i.checkedIn,
        checkedInAt: i.checkedInAt,
        actualAttendees: i.actualAttendees
      })),
      importantNotice: {
        dataRetention: 'This event will be automatically deleted 7 days after the event date to save storage space.',
        fileAccess: 'File URLs in this backup will remain accessible as they are hosted externally (Cloudinary).',
        privacy: 'Keep this backup file secure as it contains all event data including participant information.',
        howToUse: 'This is a complete backup in JSON format. You can view it in any text editor or JSON viewer.'
      }
    };

    // Set headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="planit-backup-${event.subdomain}-${Date.now()}.json"`);
    
    res.json(backup);

  } catch (error) {
    console.error('Backup error:', error);
    next(error);
  }
});

/**
 * GET /api/events/:eventId/backup-info
 * 
 * Get information about when the event will be deleted
 * Shows countdown and backup status
 */
router.get('/:eventId/backup-info', verifyEventAccess, async (req, res, next) => {
  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const eventDate = new Date(event.date);
    const deletionDate = new Date(eventDate);
    deletionDate.setDate(deletionDate.getDate() + 7);

    const now = new Date();
    const daysUntilDeletion = Math.ceil((deletionDate - now) / (1000 * 60 * 60 * 24));
    const hasOccurred = now > eventDate;
    const willBeDeleted = daysUntilDeletion <= 7 && hasOccurred;

    res.json({
      eventDate: eventDate,
      deletionDate: deletionDate,
      daysUntilDeletion: daysUntilDeletion,
      hasOccurred: hasOccurred,
      willBeDeleted: willBeDeleted,
      warningLevel: daysUntilDeletion <= 3 && hasOccurred ? 'critical' :
                    daysUntilDeletion <= 5 && hasOccurred ? 'warning' : 'normal',
      message: willBeDeleted 
        ? `⚠️ This event will be automatically deleted in ${daysUntilDeletion} day(s). Download a backup now!`
        : hasOccurred
        ? 'This event has occurred. It will be deleted 7 days after the event date.'
        : 'Your event data is safe. Automatic deletion happens 7 days after the event date.'
    });

  } catch (error) {
    next(error);
  }
});
