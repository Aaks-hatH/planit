const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const Event = require('../models/Event');
const EventParticipant = require('../models/EventParticipant');
const { verifyEventAccess, verifyOrganizer, verifyCheckinAccess } = require('../middleware/auth');
const { createEventLimiter, authLimiter, reservationLimiter, availabilityLimiter } = require('../middleware/rateLimiter');
const { secrets } = require('../keys');
const crypto = require('crypto');

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
    body('date').if(body('isTableServiceMode').not().equals('true')).if(body('isTableServiceMode').not().equals(true)).isISO8601().withMessage('Valid date is required'),
    body('organizerName').trim().isLength({ min: 1, max: 100 }).withMessage('Organizer name is required'),
    body('organizerEmail').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').optional({ values: 'falsy' }).isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    validate
  ],
  async (req, res, next) => {
    try {
      const { subdomain, title, description, date, location, organizerName, organizerEmail, password, accountPassword, staffPassword, isEnterpriseMode, isTableServiceMode, settings, maxParticipants } = req.body;

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
        isTableServiceMode: isTableServiceMode || false,
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

      // For table service: create a default "staff" account using the staffPassword if provided
      if (isTableServiceMode && staffPassword && String(staffPassword).length >= 4) {
        const hashed = await bcrypt.hash(String(staffPassword), 10);
        await EventParticipant.create({
          eventId: event._id,
          username: 'staff',
          role: 'staff',
          password: hashed,
          hasPassword: true,
        });
      }

      const token = jwt.sign(
        { eventId: event._id.toString(), username: organizerName, role: 'organizer' },
        secrets.jwt,
        { expiresIn: '30d' }
      );

      // Fire confirmation email non-blocking (organizer email)
      const { sendEventConfirmation } = require('../services/emailService');
      sendEventConfirmation(event).catch(() => {});

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
        status: event.status, rsvpSummary: event.getRsvpSummary(),
        isTableServiceMode: !!event.isTableServiceMode,
        isEnterpriseMode: !!event.isEnterpriseMode,
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
        maxParticipants: event.maxParticipants, participantCount: event.participants.length,
        isTableServiceMode: !!event.isTableServiceMode,
        isEnterpriseMode: !!event.isEnterpriseMode,
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

      //  Status checks 
      if (event.status === 'cancelled') {
        return res.status(403).json({ error: 'This event has been cancelled and is no longer accepting participants.' });
      }
      if (event.status === 'completed') {
        return res.status(403).json({ error: 'This event has ended and is no longer accepting new participants.' });
      }

      //  Require approval (must be checked even for password-protected events) 
      if (event.settings?.requireApproval) {
        const trimmedUsername = (req.body.username || '').trim();
        if (trimmedUsername) {
          const alreadyParticipant = event.participants?.some(p => p.username === trimmedUsername);
          if (!alreadyParticipant) {
            const alreadyQueued = event.approvalQueue?.some(q => q.username === trimmedUsername);
            if (!alreadyQueued) {
              await Event.findByIdAndUpdate(req.params.eventId, {
                $push: { approvalQueue: { username: trimmedUsername, requestedAt: new Date() } }
              });
              const io = req.app.get('io');
              if (io) io.to(`event_${req.params.eventId}`).emit('approval_request', { username: trimmedUsername });
            }
            return res.status(403).json({
              requiresApproval: true,
              pending: true,
              message: 'Your request has been sent to the organizer. You will be able to join once approved.',
            });
          }
          // Already approved — fall through to verify password and issue token.
        }
      }

      const isMatch = await bcrypt.compare(req.body.password, event.password);
      if (!isMatch) return res.status(401).json({ error: 'Incorrect event password.' });

      const { username, accountPassword } = req.body;

      const existing = await EventParticipant.findOne({ eventId: req.params.eventId, username }).select('+password');
      if (existing && existing.hasPassword) {
        if (!accountPassword) return res.status(400).json({ error: 'This name has an account — enter your account password.', requiresAccountPassword: true });
        const accountMatch = await bcrypt.compare(accountPassword, existing.password);
        if (!accountMatch) return res.status(401).json({ error: 'Incorrect account password.' });
        await EventParticipant.updateOne({ _id: existing._id }, { $set: { lastSeenAt: new Date() } });
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

      // Fire webhooks non-blocking
      fireWebhooks(req.params.eventId, 'participant_joined', { username }).catch(() => {});

      // Organizer role is only granted when the user is a known participant
      // who has already SET an account password AND has just proven they know it.
      // Username-match alone is NOT sufficient — anyone could type the organizer name.
      const participantRecord = await EventParticipant.findOne({ eventId: req.params.eventId, username }).select('+password');
      const verifiedOrganizerByPassword = participantRecord?.hasPassword && accountPassword &&
        event.participants.some(p => p.username === username && p.role === 'organizer');

      const role = verifiedOrganizerByPassword ? 'organizer' : 'participant';
      const token = jwt.sign(
        { eventId: event._id.toString(), username, role },
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

      //  Require approval 
      if (event.settings?.requireApproval) {
        const { username: reqUsername, message: reqMessage } = req.body;
        const trimmedUsername = (reqUsername || '').trim();
        if (!trimmedUsername) {
          return res.status(400).json({ error: 'Please provide your name to request access.' });
        }

        // If already an approved participant, skip the queue and issue a token normally
        const alreadyParticipant = event.participants?.some(p => p.username === trimmedUsername);
        if (!alreadyParticipant) {
          // Don't add duplicates to the queue
          const alreadyQueued = event.approvalQueue?.some(q => q.username === trimmedUsername);
          if (!alreadyQueued) {
            await Event.findByIdAndUpdate(req.params.eventId, {
              $push: { approvalQueue: { username: trimmedUsername, message: (reqMessage || '').trim().slice(0, 300), requestedAt: new Date() } }
            });
            const io = req.app.get('io');
            if (io) {
              io.to(`event_${req.params.eventId}`).emit('approval_request', { username: trimmedUsername });
            }
          }
          // Return 403 (NOT 202) so Axios treats it as an error and the frontend
          // catch block reliably intercepts it. HTTP 202 is 2xx — Axios resolves it
          // as success and the token-save + onJoined() call would run, bypassing the gate.
          return res.status(403).json({
            requiresApproval: true,
            pending: true,
            message: 'Your request has been sent to the organizer. You will be able to join once approved.',
          });
        }
        // alreadyParticipant == true: they were approved — fall through to issue token.
      }

      //  Status checks 
      if (event.status === 'cancelled') {
        return res.status(403).json({ error: 'This event has been cancelled and is no longer accepting participants.' });
      }
      if (event.status === 'completed') {
        return res.status(403).json({ error: 'This event has ended and is no longer accepting new participants.' });
      }

      const { username, accountPassword } = req.body;

      const existing = await EventParticipant.findOne({ eventId: req.params.eventId, username }).select('+password');
      if (existing && existing.hasPassword) {
        if (!accountPassword) return res.status(400).json({ error: 'This name has an account — enter your account password.', requiresAccountPassword: true });
        const accountMatch = await bcrypt.compare(accountPassword, existing.password);
        if (!accountMatch) return res.status(401).json({ error: 'Incorrect account password.' });
        await EventParticipant.updateOne({ _id: existing._id }, { $set: { lastSeenAt: new Date() } });
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

      // Fire webhooks non-blocking
      fireWebhooks(req.params.eventId, 'participant_joined', { username }).catch(() => {});

      // Organizer role is only granted when the user has proven they know their
      // account password AND they are recorded as organizer in the participants list.
      // Username-match alone is NOT sufficient.
      const joinParticipantRecord = await EventParticipant.findOne({ eventId: req.params.eventId, username }).select('+password');
      const verifiedOrganizerByPassword = joinParticipantRecord?.hasPassword && accountPassword &&
        event.participants.some(p => p.username === username && p.role === 'organizer');

      const joinRole = verifiedOrganizerByPassword ? 'organizer' : 'participant';
      const token = jwt.sign(
        { eventId: event._id.toString(), username, role: joinRole },
        secrets.jwt, { expiresIn: '30d' }
      );
      res.json({ message: 'Joined successfully', token, event: { id: event._id, title: event.title } });
    } catch (error) { next(error); }
  }
);

//  PUBLIC EVENTS LISTING 
// IMPORTANT: This MUST appear before router.get('/:eventId', ...) otherwise
// Express matches "public" as an eventId and verifyEventAccess throws an error.
router.get('/public', async (req, res, next) => {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const skip  = (page - 1) * limit;

    const query = {
      'settings.isPublic': true,
      status: 'active',
      date: { $gte: new Date() }
    };

    const events = await Event.find(query)
      .select('subdomain title description date location participants maxParticipants coverImage themeColor tags createdAt')
      .sort({ date: 1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Event.countDocuments(query);

    res.json({
      events: events.map(ev => ({
        ...ev,
        participantCount: (ev.participants || []).length,
        participants: undefined,
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) { next(error); }
});

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
        isTableServiceMode: !!event.isTableServiceMode,
        rsvps: event.rsvps, rsvpSummary: event.getRsvpSummary(),
        agenda: event.agenda ? [...event.agenda].sort((a, b) => a.order - b.order) : [],
        createdAt: event.createdAt
      }
    });
  } catch (error) { next(error); }
});

//  RSVP 
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

      //  RSVP deadline enforcement 
      if (event.settings?.rsvpEnabled === false) {
        return res.status(403).json({ error: 'RSVPs are not enabled for this event.' });
      }
      if (event.settings?.rsvpDeadline && new Date() > new Date(event.settings.rsvpDeadline)) {
        return res.status(403).json({
          error: 'The RSVP deadline has passed.',
          deadline: event.settings.rsvpDeadline,
        });
      }
      if (req.body.status === 'maybe' && event.settings?.rsvpAllowMaybe === false) {
        return res.status(400).json({ error: 'Maybe responses are not allowed for this event.' });
      }
      // 

      await event.setRsvp(req.body.username, req.body.status);

      const io = req.app.get('io');
      if (io) {
        io.to(`event_${req.params.eventId}`).emit('rsvp_updated', {
          username: req.body.username,
          status:   req.body.status,
          rsvps:    event.rsvps,
          summary:  event.getRsvpSummary()
        });
      }

      // Fire webhooks non-blocking
      fireWebhooks(req.params.eventId, 'rsvp_updated', { username: req.body.username, rsvp: req.body.status }).catch(() => {});

      res.json({ message: 'RSVP recorded', rsvpSummary: event.getRsvpSummary() });
    } catch (error) { next(error); }
  }
);

//  RSVP settings (organizer only) 
router.patch('/:eventId/rsvp-settings',
  verifyOrganizer,
  async (req, res, next) => {
    try {
      const event = req.event;
      const { rsvpEnabled, rsvpDeadline, rsvpAllowMaybe, rsvpShowCount, rsvpMessage } = req.body;

      if (rsvpEnabled      !== undefined) event.settings.rsvpEnabled      = rsvpEnabled;
      if (rsvpDeadline     !== undefined) event.settings.rsvpDeadline     = rsvpDeadline ? new Date(rsvpDeadline) : null;
      if (rsvpAllowMaybe   !== undefined) event.settings.rsvpAllowMaybe   = rsvpAllowMaybe;
      if (rsvpShowCount    !== undefined) event.settings.rsvpShowCount    = rsvpShowCount;
      if (rsvpMessage      !== undefined) event.settings.rsvpMessage      = rsvpMessage.slice(0, 500);

      await event.save();

      const io = req.app.get('io');
      if (io) {
        io.to(`event_${req.params.eventId}`).emit('event_settings_updated', {
          settings: event.settings,
        });
      }

      res.json({ message: 'RSVP settings updated', settings: event.settings });
    } catch (error) { next(error); }
  }
);

//  RSVP summary — public, no auth needed 
// Used by the guest invite page to show counts without requiring login
router.get('/:eventId/rsvp-summary', async (req, res, next) => {
  try {
    const Event = require('../models/Event');
    const event = await Event.findById(req.params.eventId).select('rsvps settings title date').lean();
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const summary = { yes: 0, maybe: 0, no: 0 };
    event.rsvps.forEach(r => { if (summary[r.status] !== undefined) summary[r.status]++; });

    res.json({
      summary,
      total:        event.rsvps.length,
      deadline:     event.settings?.rsvpDeadline || null,
      deadlinePast: event.settings?.rsvpDeadline ? new Date() > new Date(event.settings.rsvpDeadline) : false,
      showCount:    event.settings?.rsvpShowCount !== false,
      message:      event.settings?.rsvpMessage || '',
    });
  } catch (error) { next(error); }
});

//  TASKS 
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

//  ANNOUNCEMENTS 
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

//  EXPENSES 
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

//  NOTES 
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

//  ANALYTICS 
// Get analytics (organizer only) - UPDATED WITH CHECK-IN STATS
router.get('/:eventId/analytics', verifyEventAccess, async (req, res, next) => {
  try {
    const isOrg = req.event.participants.some(p => 
      p.username === req.eventAccess.username && p.role === 'organizer'
    );
    if (!isOrg) return res.status(403).json({ error: 'Only organizers can view analytics' });

    
// 
// PUBLIC RESERVATION API  (/api/events/public/reserve/...)
// No auth required. Aggressively rate-limited.
// 


//  Availability helper 

// Convert a wall-clock date+time string in a given IANA timezone to a UTC Date.
// e.g. wallClockToUTC('2026-03-04', '09:30', 'America/New_York') => Date(2026-03-04T14:30:00Z)
// Uses only Date.UTC + Intl.DateTimeFormat — never new Date(localeString), which is
// server-timezone-dependent and throws on some Node builds.
function wallClockToUTC(dateStr, timeStr, tz) {
  if (!tz) return new Date(`${dateStr}T${timeStr}:00`);
  try {
    const [Y, M, D] = dateStr.split('-').map(Number);
    const [h, m]    = timeStr.split(':').map(Number);
    const target = Date.UTC(Y, M - 1, D, h, m, 0);

    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    });

    // Iteratively converge: start with the naive UTC value and adjust by the
    // difference between what that UTC time *looks like* in tz vs what we want.
    // Two iterations are always enough (DST transition edge cases need 3 max).
    let utcMs = target;
    for (let i = 0; i < 3; i++) {
      const parts = Object.fromEntries(
        fmt.formatToParts(new Date(utcMs)).map(p => [p.type, p.value])
      );
      const localMs = Date.UTC(
        +parts.year, +parts.month - 1, +parts.day,
        +parts.hour === 24 ? 0 : +parts.hour,
        +parts.minute, +parts.second
      );
      const diff = target - localMs;
      if (diff === 0) break;
      utcMs += diff;
    }
    return new Date(utcMs);
  } catch (_) {
    return new Date(`${dateStr}T${timeStr}:00`);
  }
}

function buildSlots(dateStr, openTime, closeTime, intervalMin, lastBookingBuffer, tz) {
  const slots = [];
  const [oh, om] = openTime.split(':').map(Number);
  const [ch, cm] = closeTime.split(':').map(Number);

  let cur = oh * 60 + om;
  const end = ch * 60 + cm - (lastBookingBuffer || 0);

  while (cur <= end) {
    const h = Math.floor(cur / 60);
    const m = cur % 60;
    const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    const dt = wallClockToUTC(dateStr, timeStr, tz);
    slots.push({ time: timeStr, datetime: dt });
    cur += intervalMin;
  }
  return slots;
}

function getDayKey(date) {
  const days = ['sun','mon','tue','wed','thu','fri','sat'];
  return days[new Date(date).getDay()];
}

function computeAvailability(dateStr, partySize, event, tz) {
  const rps = event.reservationPageSettings || {};
  const tss = event.tableServiceSettings || {};

  // Check if this day is open
  const dayKey = getDayKey(dateStr + 'T12:00:00');
  const dayConfig = rps.operatingDays?.[dayKey];
  if (dayConfig && dayConfig.open === false) return [];

  // Blackout check
  if ((rps.blackoutDates || []).some(b => b.date === dateStr)) return [];

  const openTime  = dayConfig?.openTime  || tss.operatingHoursOpen  || '11:00';
  const closeTime = dayConfig?.closeTime || tss.operatingHoursClose || '22:00';
  const interval  = rps.slotIntervalMinutes || 30;
  const duration  = tss.reservationDurationMinutes || 90;
  const buffer    = rps.lastBookingBeforeCloseMinutes || 30;
  const maxPerSlot = rps.maxReservationsPerSlot || 0;

  const slots = buildSlots(dateStr, openTime, closeTime, interval, buffer, tz);

  // Tables that can seat this party
  const tables = (event.seatingMap?.objects || []).filter(t =>
    t.type !== 'zone' && t.capacity >= partySize
  );

  // Reservations for this day — use UTC day window covering the full local day
  const dayStart = tz ? wallClockToUTC(dateStr, '00:00', tz) : new Date(dateStr + 'T00:00:00');
  const dayEnd   = tz ? wallClockToUTC(dateStr, '23:59', tz) : new Date(dateStr + 'T23:59:59');
  const dayRes   = (event.restaurantReservations || []).filter(r =>
    (r.status === 'confirmed' || r.status === 'pending') &&
    new Date(r.dateTime) >= dayStart &&
    new Date(r.dateTime) <= dayEnd
  );

  // Min advance enforcement
  const minAdvanceMs = (rps.minAdvanceHours ?? 1) * 3600000;
  const now = Date.now();

  return slots.map(slot => {
    // Past or too soon?
    if (slot.datetime.getTime() - now < minAdvanceMs) {
      return { time: slot.time, status: 'unavailable', reason: 'past' };
    }

    const slotEnd = new Date(slot.datetime.getTime() + duration * 60000);

    // Which of our suitable tables already have a reservation overlapping this window?
    const bookedTableIds = new Set();
    dayRes.forEach(res => {
      if (!res.tableId) return;
      const rStart = new Date(res.dateTime);
      const rEnd   = new Date(rStart.getTime() + duration * 60000);
      if (rStart < slotEnd && rEnd > slot.datetime) {
        bookedTableIds.add(res.tableId);
      }
    });
    const freeTables = tables.filter(t => !bookedTableIds.has(t.id));

    // Per-slot cap check (counts all reservations starting within ±interval/2)
    let slotCount = 0;
    if (maxPerSlot > 0) {
      slotCount = dayRes.filter(r => {
        const diff = Math.abs(new Date(r.dateTime).getTime() - slot.datetime.getTime());
        return diff < (interval * 60000) / 2;
      }).length;
    }

    let status = 'available';
    if (tables.length > 0) {
      if (freeTables.length === 0) status = 'full';
      else if (freeTables.length === 1) status = 'limited';
    } else {
      // No floor map yet — fall back to slot cap only
      if (maxPerSlot > 0 && slotCount >= maxPerSlot) status = 'full';
      else if (maxPerSlot > 0 && slotCount >= maxPerSlot * 0.7) status = 'limited';
    }

    if (maxPerSlot > 0 && slotCount >= maxPerSlot) status = 'full';

    return {
      time: slot.time,
      status,
      freeCount: freeTables.length,
    };
  });
}

//  GET /public/reserve/:subdomain 
// Returns public restaurant info and reservation config.
router.get('/public/reserve/:subdomain', availabilityLimiter, async (req, res, next) => {
  try {
    const event = await Event.findOne({ subdomain: req.params.subdomain })
      .select('title isTableServiceMode tableServiceSettings reservationPageSettings seatingMap tableStates tableServiceWaitlist')
      .lean();
    if (!event) return res.status(404).json({ error: 'Not found' });
    if (!event.isTableServiceMode) return res.status(404).json({ error: 'Not found' });

    const rps = event.reservationPageSettings || {};
    const tss = event.tableServiceSettings   || {};

    // Live wait times per common party sizes (1-2, 3-4, 5-8)
    let waitTimes = null;
    if (rps.showLiveWaitTime !== false) {
      const objects = event.seatingMap?.objects || [];
      const states  = event.tableStates || [];
      const activeWait = (event.tableServiceWaitlist || []).filter(w => w.status === 'waiting' || w.status === 'notified');

      const avgDining = tss.avgDiningMinutes || 75;
      const buffer    = tss.cleaningBufferMinutes || 10;

      const calcWait = (sz) => {
        const tables = objects.filter(o => o.type !== 'zone' && o.capacity >= sz);
        if (!tables.length) return null;
        const avail = tables.some(t => {
          const s = states.find(st => st.tableId === t.id);
          return !s || s.status === 'available';
        });
        if (avail) return 0;
        const times = tables.map(t => {
          const s = states.find(st => st.tableId === t.id);
          if (!s || s.status !== 'occupied' || !s.occupiedAt) return null;
          const seatedMs = Date.now() - new Date(s.occupiedAt).getTime();
          return Math.max(0, Math.round((avgDining * 60000 - seatedMs) / 60000));
        }).filter(t => t !== null);
        if (!times.length) return null;
        return Math.min(...times) + buffer;
      };

      waitTimes = { forTwo: calcWait(2), forFour: calcWait(4), forEight: calcWait(8) };
    }

    res.json({
      name:             tss.restaurantName || event.title,
      tagline:          rps.headerTagline || '',
      description:      rps.publicDescription || '',
      cuisine:          rps.cuisine || '',
      priceRange:       rps.priceRange || '',
      dressCode:        rps.dressCode || '',
      parkingInfo:      rps.parkingInfo || '',
      accessibilityInfo:rps.accessibilityInfo || '',
      address:          rps.address || '',
      phone:            rps.phone || '',
      websiteUrl:       rps.websiteUrl || '',
      instagramHandle:  rps.instagramHandle || '',
      facebookUrl:      rps.facebookUrl || '',
      googleMapsUrl:    rps.googleMapsUrl || '',
      heroImageUrl:     rps.heroImageUrl || '',
      logoUrl:          rps.logoUrl || '',
      accentColor:      rps.accentColor || '#f97316',
      backgroundStyle:  rps.backgroundStyle || 'dark',
      fontStyle:        rps.fontStyle || 'modern',
      announcementBanner:        rps.announcementBannerEnabled ? rps.announcementBanner : '',
      announcementBannerColor:   rps.announcementBannerColor || '#f59e0b',
      operatingHoursOpen:  tss.operatingHoursOpen  || '11:00',
      operatingHoursClose: tss.operatingHoursClose || '22:00',
      operatingDays:    rps.operatingDays || {},
      blackoutDates:    (rps.blackoutDates || []).map(b => b.date),
      acceptingReservations: rps.acceptingReservations || false,
      confirmationMode:      rps.confirmationMode || 'auto_confirm',
      slotIntervalMinutes:   rps.slotIntervalMinutes || 30,
      maxAdvanceDays:        rps.maxAdvanceDays || 30,
      minAdvanceHours:       rps.minAdvanceHours ?? 1,
      maxPartySizePublic:    rps.maxPartySizePublic || 12,
      minPartySizePublic:    rps.minPartySizePublic || 1,
      requirePhone:          rps.requirePhone !== false,
      requireEmail:          rps.requireEmail || false,
      allowSpecialRequests:  rps.allowSpecialRequests !== false,
      allowDietaryNeeds:     rps.allowDietaryNeeds !== false,
      allowOccasionSelect:   rps.allowOccasionSelect !== false,
      occasionOptions:       rps.occasionOptions?.length ? rps.occasionOptions : ['Birthday','Anniversary','Business Dinner','Date Night','Family Gathering','Other'],
      showLiveWaitTime:      rps.showLiveWaitTime !== false,
      showAvailabilityStatus:rps.showAvailabilityStatus !== false,
      showTableCount:        rps.showTableCount || false,
      availabilityDisplayMode: rps.availabilityDisplayMode || 'slots',
      confirmationMessage:   rps.confirmationMessage || '',
      depositRequired:       rps.depositRequired || false,
      depositAmount:         rps.depositAmount || 0,
      depositNote:           rps.depositNote || '',
      cancellationPolicy:    rps.cancellationPolicy || '',
      cancelCutoffHours:     rps.cancelCutoffHours || 2,
      faqItems:              rps.faqItems || [],
      termsUrl:              rps.termsUrl || '',
      privacyUrl:            rps.privacyUrl || '',
      showPoweredBy:         rps.showPoweredBy !== false,
      metaTitle:             rps.metaTitle || '',
      metaDescription:       rps.metaDescription || '',
      waitTimes,
    });
  } catch (err) { next(err); }
});

//  GET /public/reserve/:subdomain/availability 
// ?date=YYYY-MM-DD&partySize=N
router.get('/public/reserve/:subdomain/availability', availabilityLimiter, async (req, res, next) => {
  try {
    const { date, partySize, tz } = req.query;
    if (!date || !partySize) return res.status(400).json({ error: 'date and partySize required' });

    const sz = parseInt(partySize);
    if (isNaN(sz) || sz < 1 || sz > 100) return res.status(400).json({ error: 'Invalid party size' });

    const event = await Event.findOne({ subdomain: req.params.subdomain })
      .select('isTableServiceMode tableServiceSettings reservationPageSettings seatingMap restaurantReservations')
      .lean();
    if (!event || !event.isTableServiceMode) return res.status(404).json({ error: 'Not found' });

    const rps = event.reservationPageSettings || {};
    if (!rps.acceptingReservations) return res.json({ slots: [], closed: true });

    // Blackout / day closed
    const dayKey = getDayKey(date + 'T12:00:00');
    const dayConfig = rps.operatingDays?.[dayKey];
    if (dayConfig && dayConfig.open === false) return res.json({ slots: [], closed: true });
    if ((rps.blackoutDates || []).some(b => b.date === date)) {
      return res.json({ slots: [], closed: true, reason: 'Closed this date' });
    }

    // Max per day cap
    const maxPerDay = rps.maxReservationsPerDay || 0;
    if (maxPerDay > 0) {
      const dayStart = tz ? wallClockToUTC(date, '00:00', tz) : new Date(date + 'T00:00:00');
      const dayEnd   = tz ? wallClockToUTC(date, '23:59', tz) : new Date(date + 'T23:59:59');
      const dayCount = (event.restaurantReservations || []).filter(r =>
        (r.status === 'confirmed' || r.status === 'pending') &&
        new Date(r.dateTime) >= dayStart && new Date(r.dateTime) <= dayEnd
      ).length;
      if (dayCount >= maxPerDay) return res.json({ slots: [], closed: true, reason: 'Fully booked for this day' });
    }

    const slots = computeAvailability(date, sz, event, tz);
    res.json({ slots });
  } catch (err) { next(err); }
});

//  POST /public/reserve/:subdomain 
// Create a public reservation. Rate limited.
router.post('/public/reserve/:subdomain', reservationLimiter, async (req, res, next) => {
  try {
    const { partyName, partySize, phone, email, date, timeSlot, occasion, specialRequests, dietaryNeeds, tz } = req.body;

    if (!partyName?.trim()) return res.status(400).json({ error: 'Name is required' });
    if (!partySize || partySize < 1) return res.status(400).json({ error: 'Party size is required' });
    if (!date || !timeSlot) return res.status(400).json({ error: 'Date and time are required' });

    const event = await Event.findOne({ subdomain: req.params.subdomain })
      .select('+restaurantReservations tableServiceSettings reservationPageSettings seatingMap isTableServiceMode');
    if (!event || !event.isTableServiceMode) return res.status(404).json({ error: 'Not found' });

    const rps = event.reservationPageSettings || {};
    if (!rps.acceptingReservations) return res.status(403).json({ error: 'Online reservations are not currently being accepted.' });

    if (rps.requirePhone && !phone?.trim()) return res.status(400).json({ error: 'Phone number is required' });
    if (rps.requireEmail && !email?.trim()) return res.status(400).json({ error: 'Email address is required' });

    const sz = parseInt(partySize);
    if (sz < (rps.minPartySizePublic || 1)) return res.status(400).json({ error: `Minimum party size is ${rps.minPartySizePublic || 1}` });
    if (sz > (rps.maxPartySizePublic || 12)) return res.status(400).json({ error: `Maximum party size for online bookings is ${rps.maxPartySizePublic || 12}` });

    // Build datetime in guest's local timezone → store as correct UTC
    const dateTime = tz ? wallClockToUTC(date, timeSlot, tz) : new Date(`${date}T${timeSlot}:00`);
    if (isNaN(dateTime.getTime())) return res.status(400).json({ error: 'Invalid date/time' });

    // Min advance check
    const minAdvanceMs = (rps.minAdvanceHours ?? 1) * 3600000;
    if (dateTime.getTime() - Date.now() < minAdvanceMs) {
      return res.status(400).json({ error: `Reservations must be made at least ${rps.minAdvanceHours ?? 1} hour(s) in advance` });
    }

    // Max advance check
    const maxAdvanceMs = (rps.maxAdvanceDays || 30) * 86400000;
    if (dateTime.getTime() - Date.now() > maxAdvanceMs) {
      return res.status(400).json({ error: `Reservations can only be made up to ${rps.maxAdvanceDays || 30} days in advance` });
    }

    // Re-check availability
    const slots = computeAvailability(date, sz, event, tz);
    const targetSlot = slots.find(s => s.time === timeSlot);
    if (!targetSlot || targetSlot.status === 'full') {
      return res.status(409).json({ error: 'This time slot is no longer available. Please choose another time.' });
    }

    // Per-day cap re-check
    const maxPerDay = rps.maxReservationsPerDay || 0;
    if (maxPerDay > 0) {
      const dayStart = tz ? wallClockToUTC(date, '00:00', tz) : new Date(date + 'T00:00:00');
      const dayEnd   = tz ? wallClockToUTC(date, '23:59', tz) : new Date(date + 'T23:59:59');
      const dayCount = event.restaurantReservations.filter(r =>
        (r.status === 'confirmed' || r.status === 'pending') &&
        new Date(r.dateTime) >= dayStart && new Date(r.dateTime) <= dayEnd
      ).length;
      if (dayCount >= maxPerDay) return res.status(409).json({ error: 'Sorry, this day is now fully booked.' });
    }

    // Generate tokens
    const resId      = `res_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
    const qrToken    = crypto.randomBytes(24).toString('hex');
    const cancelToken= crypto.randomBytes(24).toString('hex');

    const tss = event.tableServiceSettings || {};
    const qrExpiryMin = tss.reservationQrExpiryMinutes || 45;
    const qrExpiresAt = new Date(dateTime.getTime() + qrExpiryMin * 60000);

    const status = (rps.confirmationMode === 'manual') ? 'pending' : 'confirmed';

    const reservation = {
      id:              resId,
      partyName:       partyName.trim(),
      partySize:       sz,
      phone:           phone?.trim() || '',
      email:           email?.trim() || '',
      dateTime,
      tableId:         null,
      qrToken,
      qrExpiresAt,
      cancelToken,
      status,
      source:          'public',
      occasion:        occasion || '',
      specialRequests: specialRequests?.trim() || '',
      dietaryNeeds:    dietaryNeeds?.trim() || '',
      notes:           '',
      createdAt:       new Date(),
    };

    // Use findOneAndUpdate + $push to avoid Mongoose 8 partial-select validation errors
    // (event was fetched with .select() so required fields like title/subdomain are absent
    //  from the in-memory doc — calling event.save() throws ValidationError on those paths)
    await Event.findOneAndUpdate(
      { subdomain: req.params.subdomain },
      { $push: { restaurantReservations: reservation }, $set: { keepForever: true } },
      { runValidators: false }
    );

    // Fire confirmation email non-blocking
    if (rps.sendConfirmationEmail !== false && email?.trim()) {
      try {
        const { sendReservationConfirmation } = require('../services/emailService');
        sendReservationConfirmation(event, reservation).catch(() => {});
      } catch (_) {}
    }

    const cancelUrl = `${process.env.FRONTEND_URL || 'https://planit.events'}/reserve/cancel/${cancelToken}`;

    res.status(201).json({
      reservationId: resId,
      status,
      partyName:     reservation.partyName,
      partySize:     reservation.partySize,
      dateTime:      reservation.dateTime,
      qrToken,
      qrExpiresAt,
      cancelUrl,
      confirmationMessage: rps.confirmationMessage || '',
      depositRequired:     rps.depositRequired || false,
      depositAmount:       rps.depositAmount || 0,
      depositNote:         rps.depositNote || '',
      isPending: status === 'pending',
    });
  } catch (err) { next(err); }
});

//  DELETE /public/reserve/cancel/:cancelToken 
// Self-service cancellation via the token in the confirmation email.
router.delete('/public/reserve/cancel/:cancelToken', reservationLimiter, async (req, res, next) => {
  try {
    const { cancelToken } = req.params;
    if (!cancelToken || cancelToken.length < 10) return res.status(400).json({ error: 'Invalid cancel token' });

    // Search across all table-service events for this token
    const event = await Event.findOne({
      isTableServiceMode: true,
      'restaurantReservations.cancelToken': cancelToken,
    });
    if (!event) return res.status(404).json({ error: 'Reservation not found or already cancelled.' });

    const res_ = event.restaurantReservations.find(r => r.cancelToken === cancelToken);
    if (!res_) return res.status(404).json({ error: 'Reservation not found.' });
    if (res_.status === 'cancelled') return res.status(400).json({ error: 'This reservation is already cancelled.' });
    if (res_.status === 'seated') return res.status(400).json({ error: 'This reservation cannot be cancelled — the party is already seated.' });

    const rps = event.reservationPageSettings || {};
    const cutoffMs = (rps.cancelCutoffHours || 2) * 3600000;
    if (new Date(res_.dateTime).getTime() - Date.now() < cutoffMs) {
      return res.status(403).json({
        error: `Reservations can only be cancelled at least ${rps.cancelCutoffHours || 2} hour(s) before the booking time. Please call us directly.`,
        phone: rps.phone || '',
      });
    }

    res_.status = 'cancelled';
    await event.save();

    // Notify organizer
    if (rps.notifyOrganizerOnCancel && rps.notifyOrganizerEmail) {
      try {
        const { sendReservationCancellation } = require('../services/emailService');
        sendReservationCancellation(event, res_).catch(() => {});
      } catch (_) {}
    }

    res.json({ success: true, message: 'Your reservation has been cancelled.' });
  } catch (err) { next(err); }
});

//  PATCH /:eventId/table-service/reservation-page-settings 
// Organizer updates the full reservation page config.
router.patch('/:eventId/table-service/reservation-page-settings', verifyOrganizer, async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (!event.isTableServiceMode) return res.status(403).json({ error: 'Not a table service event' });

    const ALLOWED_KEYS = [
      'acceptingReservations','confirmationMode','heroImageUrl','logoUrl','accentColor',
      'backgroundStyle','fontStyle','headerTagline','showPoweredBy','hidePlanitBranding',
      'announcementBanner','announcementBannerColor','announcementBannerEnabled',
      'publicDescription','cuisine','priceRange','dressCode','parkingInfo','accessibilityInfo',
      'address','phone','websiteUrl','instagramHandle','facebookUrl','googleMapsUrl',
      'operatingDays','blackoutDates',
      'slotIntervalMinutes','maxAdvanceDays','minAdvanceHours','cancelCutoffHours',
      'maxPartySizePublic','minPartySizePublic','maxReservationsPerDay','maxReservationsPerSlot',
      'lastBookingBeforeCloseMinutes',
      'requirePhone','requireEmail','allowSpecialRequests','allowDietaryNeeds',
      'allowOccasionSelect','occasionOptions',
      'showLiveWaitTime','showAvailabilityStatus','showTableCount','showPartySizeWaitTimes',
      'availabilityDisplayMode',
      'confirmationMessage','confirmationEmailSubject','sendConfirmationEmail',
      'sendReminderEmail','reminderHoursBefore','sendCancellationEmail',
      'notifyOrganizerOnBooking','notifyOrganizerOnCancel','notifyOrganizerEmail',
      'cancellationPolicy','depositRequired','depositAmount','depositNote',
      'termsUrl','privacyUrl','faqItems',
      'metaTitle','metaDescription',
    ];

    if (!event.reservationPageSettings) event.reservationPageSettings = {};
    ALLOWED_KEYS.forEach(k => {
      if (req.body[k] !== undefined) event.reservationPageSettings[k] = req.body[k];
    });
    event.keepForever = true;
    event.markModified('reservationPageSettings');
    await event.save();

    res.json({ success: true, settings: event.reservationPageSettings, reservationPageSettings: event.reservationPageSettings });
  } catch (err) { next(err); }
});

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

//  UTILITIES 
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

//  Agenda 
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
      const { title, description, date, location, settings, maxParticipants, status, coverImage, themeColor, tags } = req.body;
      const event = req.event;
      if (title) event.title = title;
      if (description !== undefined) event.description = description;
      if (date) event.date = date;
      if (location !== undefined) event.location = location;
      if (settings) {
        event.settings = { ...event.settings, ...settings };
        event.markModified('settings'); // required for Mongoose to detect nested object changes
      }
      if (maxParticipants) event.maxParticipants = maxParticipants;
      if (status && ['active', 'completed', 'cancelled'].includes(status)) event.status = status;
      if (coverImage !== undefined) event.coverImage = coverImage;
      if (themeColor !== undefined) event.themeColor = themeColor;
      if (tags !== undefined) event.tags = Array.isArray(tags) ? tags.slice(0, 5) : [];
      await event.save();

      const io = req.app.get('io');
      if (io) {
        io.to(`event_${req.params.eventId}`).emit('event_settings_updated', {
          settings: event.settings,
          status:   event.status,
          title:    event.title,
          maxParticipants: event.maxParticipants,
        });
      }

      res.json({ message: 'Event updated', event });
    } catch (error) { next(error); }
  }
);

// Upload cover image for event (organizer only)
router.post('/:eventId/cover', verifyOrganizer, async (req, res, next) => {
  const multer     = require('multer');
  const cloudinary = require('cloudinary').v2;
  const fs         = require('fs');
  const os         = require('os');
  const path       = require('path');

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure:     true,
  });

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_, file, cb) => {
      ['image/jpeg','image/png','image/webp','image/gif'].includes(file.mimetype)
        ? cb(null, true)
        : cb(new Error('Only images are allowed for cover photos'));
    },
  }).single('cover');

  upload(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      return res.status(503).json({ error: 'Image storage is not configured' });
    }

    const safeName = `cover-${req.params.eventId}`;
    const tmpPath  = path.join(os.tmpdir(), `planit-cover-${Date.now()}`);
    fs.writeFileSync(tmpPath, req.file.buffer);

    try {
      const result = await cloudinary.uploader.upload(tmpPath, {
        folder:        'planit-covers',
        resource_type: 'image',
        public_id:     safeName,
        overwrite:     true,
        transformation: [{ width: 1200, height: 400, crop: 'fill', quality: 'auto' }],
        secure:        true,
      });

      req.event.coverImage = result.secure_url;
      await req.event.save();

      res.json({ coverImage: result.secure_url });
    } catch (uploadErr) {
      next(uploadErr);
    } finally {
      try { fs.unlinkSync(tmpPath); } catch (_) {}
    }
  });
});

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

        // Guest invite confirmation emails disabled (free email tier)
      }
      
      res.status(201).json({ message: 'Invites created', invites });
    } catch (error) { next(error); }
  }
);

// Get all invites for event
router.get('/:eventId/invites', verifyCheckinAccess, async (req, res, next) => {
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

    //  Normalise and validate the incoming status 
    // GuestInvite.jsx sends 'yes'/'maybe'/'no'; the model stores
    // 'confirmed'/'maybe'/'declined'.  Accept both conventions.
    const normalise = { yes: 'confirmed', confirmed: 'confirmed',
                        no: 'declined',   declined:  'declined',
                        maybe: 'maybe' };
    const normalisedStatus = normalise[status];
    if (!normalisedStatus) {
      return res.status(400).json({ error: 'Invalid RSVP response. Choose "Going", "Maybe", or "Can\'t make it".' });
    }

    //  Load invite 
    const invite = await Invite.findOne({
      eventId:    req.params.eventId,
      inviteCode: req.params.inviteCode,
    });
    if (!invite) return res.status(404).json({ error: 'Invite not found' });

    //  Load event settings 
    const event = await Event.findById(req.params.eventId).select('settings').lean();
    if (!event) return res.status(404).json({ error: 'Event not found' });
    const settings = event.settings || {};

    //  Enforce rsvpEnabled 
    if (settings.rsvpEnabled === false) {
      return res.status(403).json({ error: 'RSVPs are not enabled for this event.' });
    }

    //  Enforce rsvpDeadline 
    if (settings.rsvpDeadline && new Date() > new Date(settings.rsvpDeadline)) {
      const fmt = new Date(settings.rsvpDeadline).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
      });
      return res.status(403).json({
        error: `The RSVP deadline passed on ${fmt}. No further changes can be made.`,
        deadline: settings.rsvpDeadline,
        deadlinePast: true,
      });
    }

    //  Enforce rsvpAllowMaybe 
    if (normalisedStatus === 'maybe' && settings.rsvpAllowMaybe === false) {
      return res.status(400).json({ error: '"Maybe" responses are not allowed for this event. Please choose Going or Can\'t make it.' });
    }

    invite.status = normalisedStatus;
    await invite.save();

    res.json({ message: 'RSVP updated', invite });
  } catch (error) { next(error); }
});

// 
// SECURE CHECK-IN SYSTEM
// 

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
  enforceBlocks,           //  Check emergency lockdown, blocks, trust scores
  detectDuplicates,        //  Check for duplicate guests
  detectSuspiciousPatterns, //  Check for rapid scans, multiple devices
  enforceCapacity,         //  Check max attendees limit
  enforceTimeWindow,       //  Check time restrictions
  auditLog,                //  Log all scan attempts
  async (req, res, next) => {
  try {
    const Invite = require('../models/Invite');
    const { eventId, inviteCode } = req.params;
    const ip = req.ip || req.connection.remoteAddress || '';
    const staffUser = req.eventAccess?.username || 'staff';

    //  Cross-event security: invite must belong to THIS event 
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

    //  Collect security warnings from middleware 
    const warnings = req.securityWarnings || [];
    const flags = invite.securityFlags || [];
    
    // Calculate trust score
    const trustScore = invite.calculateTrustScore();

    //  Return the full guest profile for staff to review 
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
  preventReentrancy,  //  Prevent simultaneous check-ins
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

    //  FINAL CAPACITY CHECK before committing
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

    // Fire webhooks non-blocking
    fireWebhooks(eventId, 'checkin', {
      username:       invite.guestName,
      guestName:      invite.guestName,
      inviteCode:     invite.inviteCode,
      actualCount:    invite.actualAttendees,
    }).catch(() => {});

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
router.get('/:eventId/checkin-stats', verifyCheckinAccess, async (req, res, next) => {
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
router.get('/:eventId/checkin-settings', verifyCheckinAccess, async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.eventId).select('checkinSettings').lean();
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json({ settings: event.checkinSettings || {} });
  } catch (error) { next(error); }
});

router.patch('/:eventId/checkin-settings', verifyOrganizer, async (req, res, next) => {
  try {
    // 
    // COMPREHENSIVE SECURITY SETTINGS - CORRECT MIDDLEWARE NAMES
    // 
    const allowed = [
      // General Security
      'requirePin',
      'requireCodeConfirm',
      'blockCrossEvent',
      'maxFailedAttempts',
      'lockoutMinutes',
      'allowManualOverride',
      'staffNote',
      
      // Duplicate Prevention -  CORRECT NAMES
      'enableDuplicateDetection',
      'duplicateDetectionMode',
      'autoBlockDuplicates',
      'allowMultipleTickets',
      
      // Pattern Detection -  CORRECT NAMES
      'enablePatternDetection',
      'rapidScanThreshold',
      'rapidScanWindowSeconds',
      'multiDeviceThreshold',
      
      // Trust Scoring -  CORRECT NAMES
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
    body('guestRole').optional().isIn(['GUEST', 'VIP', 'SPEAKER']),
    body('adults').optional().isInt({ min: 0 }),
    body('children').optional().isInt({ min: 0 }),
    body('groupSize').optional().isInt({ min: 1 }),
    body('plusOnes').optional().isInt({ min: 0 }),
    body('securityPin').optional().trim().isLength({ max: 6 }),
    body('notes').optional().trim(),
    body('seatNumber').optional({ nullable: true }).isString().isLength({ max: 20 }),
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
      
      // Update fields — guestRole IS included so VIP/SPEAKER assignments save correctly
      const allowedFields = ['guestName', 'guestEmail', 'guestPhone', 'guestRole', 'adults', 'children', 'groupSize', 'plusOnes', 'securityPin', 'notes', 'seatNumber'];
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

// 
// STAFF CHECK-IN ACCOUNTS
// Organizers create staff accounts with PINs; staff use them to log into
// the check-in page without getting full organizer privileges.
// 

// POST /:eventId/staff-login  — public, no auth, used on check-in login screen
router.post('/:eventId/staff-login', authLimiter, async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const { username, pin } = req.body;

    if (!username || !pin) {
      return res.status(400).json({ error: 'Username and PIN are required' });
    }

    const staff = await EventParticipant
      .findOne({ eventId, username: username.trim(), role: 'staff' })
      .select('+password');

    if (!staff || !staff.password) {
      return res.status(401).json({ error: 'Invalid username or PIN' });
    }

    const valid = await bcrypt.compare(String(pin), staff.password);
    if (!valid) {
      console.log(`[STAFF-LOGIN] Failed attempt: ${username} for event ${eventId}`);
      return res.status(401).json({ error: 'Invalid username or PIN' });
    }

    await EventParticipant.updateOne({ _id: staff._id }, { $set: { lastSeenAt: new Date() } });

    const token = jwt.sign(
      { eventId: eventId.toString(), username: staff.username, role: 'staff' },
      secrets.jwt,
      { expiresIn: '12h' }
    );

    console.log(`[STAFF-LOGIN] Success: ${username} for event ${eventId}`);
    res.json({ success: true, token, username: staff.username, role: 'staff' });

  } catch (error) {
    next(error);
  }
});

// GET /:eventId/staff — list all staff accounts (organizer only)
router.get('/:eventId/staff', verifyOrganizer, async (req, res, next) => {
  try {
    const staff = await EventParticipant
      .find({ eventId: req.params.eventId, role: 'staff' })
      .select('username hasPassword createdAt lastSeenAt')
      .sort({ createdAt: -1 });

    res.json({ staff });
  } catch (error) { next(error); }
});

// POST /:eventId/staff — create a staff account (organizer only)
router.post('/:eventId/staff', verifyOrganizer, async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const { username, pin } = req.body;

    if (!username || !username.trim()) {
      return res.status(400).json({ error: 'Username is required' });
    }
    if (!pin || String(pin).length < 4 || String(pin).length > 8) {
      return res.status(400).json({ error: 'PIN must be 4–8 digits' });
    }
    if (!/^\d+$/.test(String(pin))) {
      return res.status(400).json({ error: 'PIN must contain only numbers' });
    }

    // Prevent duplicate username within this event (any role)
    const existing = await EventParticipant.findOne({ eventId, username: username.trim(), role: 'staff' });
    if (existing) {
      return res.status(409).json({ error: 'A staff account with that username already exists for this event' });
    }

    const hashed = await bcrypt.hash(String(pin), 10);
    const staff = await EventParticipant.create({
      eventId,
      username: username.trim(),
      password: hashed,
      hasPassword: true,
      role: 'staff',
    });

    console.log(`[STAFF] Created staff account: ${username} for event ${eventId}`);
    res.status(201).json({
      success: true,
      staff: { username: staff.username, createdAt: staff.createdAt }
    });

  } catch (error) {
    next(error);
  }
});

// DELETE /:eventId/staff/:username — remove a staff account (organizer only)
router.delete('/:eventId/staff/:staffUsername', verifyOrganizer, async (req, res, next) => {
  try {
    const { eventId, staffUsername } = req.params;
    const deleted = await EventParticipant.findOneAndDelete({ eventId, username: staffUsername, role: 'staff' });
    if (!deleted) {
      return res.status(404).json({ error: 'Staff account not found' });
    }
    res.json({ success: true, message: 'Staff account removed' });
  } catch (error) { next(error); }
});

// PATCH /:eventId/staff/:username/pin — update staff PIN (organizer only)
router.patch('/:eventId/staff/:staffUsername/pin', verifyOrganizer, async (req, res, next) => {
  try {
    const { eventId, staffUsername } = req.params;
    const { pin } = req.body;

    if (!pin || String(pin).length < 4 || String(pin).length > 8 || !/^\d+$/.test(String(pin))) {
      return res.status(400).json({ error: 'PIN must be 4–8 digits' });
    }

    const staff = await EventParticipant.findOne({ eventId, username: staffUsername, role: 'staff' });
    if (!staff) {
      return res.status(404).json({ error: 'Staff account not found' });
    }

    staff.password = await bcrypt.hash(String(pin), 10);
    staff.hasPassword = true;
    await staff.save();

    res.json({ success: true, message: 'PIN updated' });
  } catch (error) { next(error); }
});

// 
// BRANDED QR CODE
// 

// GET /:eventId/qr.svg — no auth required, encodes the public join URL
router.get('/:eventId/qr.svg', async (req, res, next) => {
  try {
    const QRCode = require('qrcode');
    const event = await Event.findById(req.params.eventId).select('title subdomain').lean();
    if (!event) return res.status(404).send('Event not found');

    const protocol = process.env.NODE_ENV === 'production' ? 'https' : req.protocol;
    const host = process.env.BASE_DOMAIN || req.get('host');
    const joinUrl = `${protocol}://${host}/event/${req.params.eventId}`;

    // Clean QR — NO overlay on the QR modules. BarcodeDetector (used by
    // html5-qrcode) rejects any QR with pixels painted over it, including
    // the previously used centre logo. PLANIT branding goes BELOW the QR.
    // Using level M (15%) is sufficient; H was only needed for the overlay.
    const dataUrl = await QRCode.toDataURL(joinUrl, {
      width: 260,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    });

    const safeTitle = event.title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').slice(0, 32);

    // Card dimensions — same proportions as the invite QR card
    const W = 300, H = 400;
    const QX = 20, QY = 20, QS = 260;

    const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <filter id="glow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="4" stdDeviation="10" flood-color="#000" flood-opacity="0.55"/>
    </filter>
    <clipPath id="qrclip">
      <rect x="${QX}" y="${QY}" width="${QS}" height="${QS}" rx="10"/>
    </clipPath>
  </defs>

  <!-- Dark card -->
  <rect width="${W}" height="${H}" rx="20" fill="#0a0a0a" filter="url(#glow)"/>

  <!-- White QR backing (no overlay on top of QR modules) -->
  <rect x="${QX - 4}" y="${QY - 4}" width="${QS + 8}" height="${QS + 8}" rx="14" fill="#ffffff"/>

  <!-- Clean QR — nothing painted on top -->
  <image x="${QX}" y="${QY}" width="${QS}" height="${QS}"
         href="${dataUrl}" clip-path="url(#qrclip)"/>

  <!-- Divider -->
  <line x1="20" y1="${QY + QS + 18}" x2="${W - 20}" y2="${QY + QS + 18}"
        stroke="#1f1f1f" stroke-width="1"/>

  <!-- PLANIT brand -->
  <text x="${W / 2}" y="${QY + QS + 40}" text-anchor="middle"
        fill="#ffffff"
        font-family="system-ui,-apple-system,'Segoe UI',Helvetica,Arial,sans-serif"
        font-size="13" font-weight="800" letter-spacing="5">PLANIT</text>

  <!-- Event title -->
  <text x="${W / 2}" y="${QY + QS + 62}" text-anchor="middle"
        fill="#e5e5e5"
        font-family="system-ui,-apple-system,'Segoe UI',Helvetica,Arial,sans-serif"
        font-size="12" font-weight="600">${safeTitle}</text>

  <!-- Sub-label -->
  <text x="${W / 2}" y="${QY + QS + 82}" text-anchor="middle"
        fill="#555555"
        font-family="system-ui,-apple-system,'Segoe UI',Helvetica,Arial,sans-serif"
        font-size="10" letter-spacing="1.5">SCAN TO JOIN</text>
</svg>`;

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(svg);
  } catch (error) { next(error); }
});

// 
// WAITLIST
// 

// POST /:eventId/waitlist — join the waitlist when event is full
router.post('/:eventId/waitlist',
  [body('username').trim().isLength({ min: 1, max: 100 }), body('email').optional().isEmail(), validate],
  async (req, res, next) => {
    try {
      const event = await Event.findById(req.params.eventId);
      if (!event) return res.status(404).json({ error: 'Event not found' });

      // Only allow if event is actually full
      if (event.participants.length < event.maxParticipants) {
        return res.status(400).json({ error: 'Event is not full — join directly instead' });
      }

      const { username, email } = req.body;
      const alreadyOn = event.waitlist.some(w => w.username.toLowerCase() === username.toLowerCase());
      if (alreadyOn) return res.status(409).json({ error: 'Already on the waitlist' });

      const alreadyIn = event.participants.some(p => p.username.toLowerCase() === username.toLowerCase());
      if (alreadyIn) return res.status(400).json({ error: 'Already a participant' });

      event.waitlist.push({ username, email: email || '' });
      await event.save();

      res.status(201).json({
        message: 'Added to waitlist',
        position: event.waitlist.length,
      });
    } catch (error) { next(error); }
  }
);

// GET /:eventId/waitlist — organizer only
router.get('/:eventId/waitlist', verifyOrganizer, async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.eventId).select('waitlist').lean();
    if (!event) return res.status(404).json({ error: 'Event not found' });
    res.json({ waitlist: event.waitlist || [], count: (event.waitlist || []).length });
  } catch (error) { next(error); }
});

// DELETE /:eventId/waitlist/:username — leave the waitlist
router.delete('/:eventId/waitlist/:username', async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    event.waitlist = event.waitlist.filter(w => w.username !== req.params.username);
    await event.save();
    res.json({ message: 'Removed from waitlist' });
  } catch (error) { next(error); }
});

// 
// RECURRING EVENTS — clone with a new date
// 

router.post('/:eventId/clone', verifyOrganizer,
  [body('date').isISO8601().withMessage('Valid date required'), validate],
  async (req, res, next) => {
    try {
      const source = await Event.findById(req.params.eventId).select('+password').lean();
      if (!source) return res.status(404).json({ error: 'Event not found' });

      const { date, title } = req.body;

      // Generate a unique subdomain based on original + timestamp
      const baseSubdomain = source.subdomain.replace(/-\d+$/, '');
      const newSubdomain = `${baseSubdomain}-${Date.now().toString(36)}`;

      const cloned = new Event({
        subdomain:          newSubdomain,
        title:              (title || source.title).trim(),
        description:        source.description,
        date:               new Date(date),
        timezone:           source.timezone,
        location:           source.location,
        organizerName:      source.organizerName,
        organizerEmail:     source.organizerEmail,
        password:           source.password,
        isPasswordProtected: source.isPasswordProtected,
        isEnterpriseMode:   source.isEnterpriseMode,
        maxParticipants:    source.maxParticipants,
        settings:           source.settings,
        agenda:             source.agenda || [],
        status:             'active',
        participants:       [{ username: source.organizerName, role: 'organizer' }],
      });

      await cloned.save();

      // Re-create organizer's EventParticipant record
      await EventParticipant.create({
        eventId:  cloned._id,
        username: source.organizerName,
        role:     'organizer',
      });

      const token = jwt.sign(
        { eventId: cloned._id.toString(), username: source.organizerName, role: 'organizer' },
        secrets.jwt,
        { expiresIn: '30d' }
      );

      res.status(201).json({
        message:   'Event cloned successfully',
        event:     { id: cloned._id, subdomain: cloned.subdomain, title: cloned.title },
        token,
      });
    } catch (error) { next(error); }
  }
);

// 
// WEBHOOKS
// 

// Utility: fire all active webhooks for a given event + event type
async function fireWebhooks(eventId, eventType, payload) {
  try {
    const crypto = require('crypto');
    const event = await Event.findById(eventId)
      .select('webhooks title subdomain organizerName date location status maxParticipants participants settings')
      .lean();
    if (!event || !event.webhooks?.length) return;

    const active = event.webhooks.filter(wh => wh.active && wh.events.includes(eventType));
    if (!active.length) return;

    const body = JSON.stringify({
      event:     eventType,
      eventId:   eventId.toString(),
      eventName: event.title,
      subdomain: event.subdomain,
      timestamp: new Date().toISOString(),
      data:      payload,
    });

    const isDiscordUrl = (url) => url.toLowerCase().includes('discord.com/api/webhooks/');
    const isSlackUrl   = (url) => url.toLowerCase().includes('hooks.slack.com');

    const titleMap = {
      participant_joined: 'New participant joined',
      rsvp_updated:       'RSVP updated',
      checkin:            'Guest checked in',
      message_sent:       'New message',
    };

    // Build a Discord embed. ALL field values must be non-empty strings — Discord
    // rejects the entire embed with 400 if any field is missing its value.
    const safeStr = (v, fallback = 'N/A') => (v !== undefined && v !== null && String(v).trim() !== '') ? String(v) : fallback;

    // BUG FIX: builders now return a plain JS object, NOT a JSON string.
    // Previously they returned JSON.stringify(...) which axios then serialised
    // again, producing double-encoded JSON. Discord received a string literal
    // instead of an object and showed an empty message body.
    const buildDiscordPayload = (evType, planItPayload, eventName) => {
      const parsed = JSON.parse(planItPayload);
      const colorMap = {
        participant_joined: 0x10b981,
        rsvp_updated:       0x3b82f6,
        checkin:            0x6366f1,
        message_sent:       0x8b5cf6,
      };

      const d = parsed.data || {};
      let description = '';
      if (evType === 'message_sent' && d.message) {
        description = `**${safeStr(d.username, 'Someone')}:** ${String(d.message).slice(0, 500)}`;
      } else if (evType === 'participant_joined' && d.username) {
        description = `**${d.username}** joined the event.`;
      } else if (evType === 'rsvp_updated' && d.username) {
        description = `**${d.username}** responded: **${safeStr(d.rsvp)}**`;
      } else if (evType === 'checkin' && d.guestName) {
        description = `**${d.guestName}** checked in.`;
      }

      const fields = [];
      if (parsed.data?.username)                    fields.push({ name: 'Participant', value: safeStr(parsed.data.username),                inline: true });
      if (parsed.data?.rsvp)                        fields.push({ name: 'RSVP',        value: safeStr(parsed.data.rsvp),                   inline: true });
      if (parsed.data?.message)                     fields.push({ name: 'Message',     value: safeStr(parsed.data.message).slice(0, 1024), inline: false });
      if (parsed.data?.actualCount !== undefined)   fields.push({ name: 'Attendees',   value: safeStr(parsed.data.actualCount, '0'),        inline: true });
      if (parsed.data?.guestName && parsed.data.guestName !== parsed.data.username)
                                                    fields.push({ name: 'Guest',       value: safeStr(parsed.data.guestName),              inline: true });
      if (parsed.data?.inviteCode)                  fields.push({ name: 'Invite',      value: safeStr(parsed.data.inviteCode),             inline: true });
      fields.push({ name: 'Event', value: safeStr(eventName, 'PlanIt Event'), inline: true });
      fields.push({ name: 'Time',  value: new Date(parsed.timestamp).toLocaleString(), inline: true });

      const embed = {
        title:     titleMap[evType] || evType,
        color:     colorMap[evType] || 0x6366f1,
        fields,
        footer:    { text: 'PlanIt' },
        timestamp: parsed.timestamp,
      };
      if (description) embed.description = description;

      // Top-level `content` is the plain text Discord shows as the message body.
      // Without it the notification preview and message body appear completely blank —
      // the embed description alone is hidden until the user clicks to expand it.
      let topContent = '';
      if (evType === 'message_sent' && d.username && d.message) {
        topContent = `**${safeStr(d.username)}:** ${String(d.message).slice(0, 500)}`;
      } else if (evType === 'participant_joined' && d.username) {
        topContent = `${safeStr(d.username)} joined ${safeStr(eventName)}`;
      } else if (evType === 'rsvp_updated' && d.username) {
        topContent = `${safeStr(d.username)} updated their RSVP: ${safeStr(d.rsvp)}`;
      } else if (evType === 'checkin' && d.guestName) {
        topContent = `${safeStr(d.guestName)} checked in to ${safeStr(eventName)}`;
      }

      // Return plain object — axios handles serialisation
      const out = { embeds: [embed] };
      if (topContent) out.content = topContent;
      return out;
    };

    // Slack incoming webhooks require {"text":"..."} — anything else is silently dropped.
    const buildSlackPayload = (evType, planItPayload, eventName) => {
      const parsed = JSON.parse(planItPayload);
      const d      = parsed.data || {};
      const evLabel = titleMap[evType] || evType;
      let text = `*${evLabel}* — ${eventName}`;
      if (d.username)                  text += `
*Who:* ${d.username}`;
      if (d.rsvp)                      text += `
*RSVP:* ${d.rsvp}`;
      if (d.message)                   text += `
*Message:* ${String(d.message).slice(0, 200)}`;
      if (d.actualCount !== undefined) text += `
*Attendees:* ${d.actualCount}`;
      text += `
_${new Date(parsed.timestamp).toLocaleString()}_`;
      return { text }; // plain object — axios serialises, don't stringify
    };

    for (const wh of active) {
      try {
        const urlLower = wh.url.toLowerCase();
        const discord  = isDiscordUrl(urlLower);
        const slack    = isSlackUrl(urlLower);

        // All three builders now return plain objects — axios serialises them.
        // Generic webhooks receive the raw PlanIt payload parsed back to object.
        const outBody = discord ? buildDiscordPayload(eventType, body, event.title)
                      : slack   ? buildSlackPayload(eventType, body, event.title)
                      : JSON.parse(body);

        const headers = { 'Content-Type': 'application/json' };
        if (!discord && !slack) {
          headers['X-PlanIt-Event']   = eventType;
          headers['X-PlanIt-EventId'] = eventId.toString();
        }
        if (wh.secret && !discord && !slack) {
          const sig = crypto.createHmac('sha256', wh.secret).update(body).digest('hex');
          headers['X-PlanIt-Signature'] = 'sha256=' + sig;
        }
        await axios.post(wh.url, outBody, { headers, timeout: 5000 });
        console.log(`[webhook] Fired ${eventType} → ${discord ? 'discord' : slack ? 'slack' : 'generic'} (${wh._id})`);
      } catch (whErr) {
        const status = whErr.response?.status;
        const detail = whErr.response?.data ? JSON.stringify(whErr.response.data).slice(0, 200) : whErr.message;
        console.error(`[webhook] FAILED ${eventType} → ${wh._id}: HTTP ${status || 'network'} — ${detail}`);
      }
    }
  } catch (_) {}
}

// GET /:eventId/webhooks — list webhooks (organizer only)
router.get('/:eventId/webhooks', verifyOrganizer, async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.eventId).select('webhooks').lean();
    if (!event) return res.status(404).json({ error: 'Event not found' });
    // Never expose the secret in list view
    const safe = (event.webhooks || []).map(({ _id, url, events, active, createdAt }) => ({ _id, url, events, active, createdAt }));
    res.json({ webhooks: safe });
  } catch (error) { next(error); }
});

// POST /:eventId/webhooks — create webhook (organizer only)
router.post('/:eventId/webhooks', verifyOrganizer,
  [
    body('url').isURL({ require_protocol: true }).withMessage('Valid URL required'),
    body('events').isArray({ min: 1 }).withMessage('At least one event type required'),
    body('secret').optional().isLength({ max: 200 }),
    validate,
  ],
  async (req, res, next) => {
    try {
      const event = await Event.findById(req.params.eventId);
      if (!event) return res.status(404).json({ error: 'Event not found' });

      if ((event.webhooks || []).length >= 5) {
        return res.status(400).json({ error: 'Maximum 5 webhooks per event' });
      }

      const VALID_EVENTS = ['participant_joined', 'rsvp_updated', 'checkin', 'message_sent'];
      const filteredEvents = (req.body.events || []).filter(e => VALID_EVENTS.includes(e));

      event.webhooks.push({
        url:    req.body.url.trim(),
        events: filteredEvents,
        secret: req.body.secret?.trim() || '',
        active: true,
      });

      await event.save();
      const wh = event.webhooks[event.webhooks.length - 1];

      // Send a config confirmation message to the webhook immediately
      try {
        const isDiscord = wh.url.toLowerCase().includes('discord.com/api/webhooks/');
        const isSlack   = wh.url.toLowerCase().includes('hooks.slack.com');
        const triggerLabels = {
          participant_joined: 'Participant joined',
          rsvp_updated: 'RSVP updated',
          checkin: 'Guest checked in',
          message_sent: 'New message sent',
        };
        const triggersText = wh.events.map(e => triggerLabels[e] || e).join(', ');
        const eventDate = event.date ? new Date(event.date).toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short' }) : 'Not set';
        const participantCount = (event.participants || []).length;
        const maxP = event.maxParticipants || 'Unlimited';

        if (isDiscord) {
          const configPayload = {
            embeds: [{
              title: 'PlanIt Webhook Connected',
              description: 'This channel will now receive live notifications from your PlanIt event.',
              color: 0x10b981,
              fields: [
                { name: 'Event', value: event.title, inline: true },
                { name: 'Subdomain', value: event.subdomain || 'N/A', inline: true },
                { name: 'Status', value: event.status || 'active', inline: true },
                { name: 'Date', value: eventDate, inline: false },
                { name: 'Location', value: event.location || 'Not set', inline: true },
                { name: 'Participants', value: `${participantCount} / ${maxP}`, inline: true },
                { name: 'Organizer', value: event.organizerName, inline: true },
                { name: 'Triggers', value: triggersText, inline: false },
                { name: 'Chat', value: event.settings?.allowChat !== false ? 'Enabled' : 'Disabled', inline: true },
                { name: 'Polls', value: event.settings?.allowPolls !== false ? 'Enabled' : 'Disabled', inline: true },
                { name: 'File Sharing', value: event.settings?.allowFileSharing !== false ? 'Enabled' : 'Disabled', inline: true },
                { name: 'RSVP', value: event.settings?.rsvpEnabled !== false ? 'Enabled' : 'Disabled', inline: true },
                { name: 'Public Event', value: event.settings?.isPublic ? 'Yes' : 'No', inline: true },
                { name: 'Require Approval', value: event.settings?.requireApproval ? 'Yes' : 'No', inline: true },
                { name: 'Webhook ID', value: wh._id.toString(), inline: false },
                { name: 'Signing Secret', value: wh.secret ? 'Configured' : 'None', inline: true },
              ],
              footer: { text: 'PlanIt — You will receive a notification for each selected trigger.' },
              timestamp: new Date().toISOString(),
            }]
          };
          await axios.post(wh.url, configPayload, { headers: { 'Content-Type': 'application/json' }, timeout: 5000 });
        } else if (isSlack) {
          // Slack requires { text: "..." } — plain object, NOT a pre-stringified string
          const slackPayload = {
            text: `*PlanIt Webhook Connected* — ${event.title}\nTriggers: ${triggersText}\nParticipants: ${participantCount} / ${maxP}\nDate: ${eventDate}`,
          };
          await axios.post(wh.url, slackPayload, { headers: { 'Content-Type': 'application/json' }, timeout: 5000 });
        } else {
          const configPayload = {
            event: 'webhook_configured',
            eventId: event._id.toString(),
            eventName: event.title,
            subdomain: event.subdomain,
            timestamp: new Date().toISOString(),
            webhook: {
              id: wh._id.toString(),
              triggers: wh.events,
              triggerLabels: triggersText,
              hasSecret: !!wh.secret,
            },
            eventDetails: {
              date: event.date,
              location: event.location || null,
              organizer: event.organizerName,
              status: event.status,
              participants: participantCount,
              maxParticipants: maxP,
              settings: {
                allowChat: event.settings?.allowChat !== false,
                allowPolls: event.settings?.allowPolls !== false,
                allowFileSharing: event.settings?.allowFileSharing !== false,
                rsvpEnabled: event.settings?.rsvpEnabled !== false,
                isPublic: event.settings?.isPublic === true,
                requireApproval: event.settings?.requireApproval === true,
              },
            },
          };
          await axios.post(wh.url, configPayload, {
            headers: { 'Content-Type': 'application/json', 'X-PlanIt-Event': 'webhook_configured', 'X-PlanIt-EventId': event._id.toString() },
            timeout: 5000,
          });
        }
      } catch (cfgErr) {
        // Config ping is best-effort — don't block webhook creation, but DO log so we can debug.
        const cfgStatus = cfgErr.response?.status;
        const cfgDetail = cfgErr.response?.data ? JSON.stringify(cfgErr.response.data).slice(0, 300) : cfgErr.message;
        console.error(`[webhook] Config ping FAILED for ${wh._id}: HTTP ${cfgStatus || 'network'} — ${cfgDetail}`);
      }

      res.status(201).json({ webhook: { _id: wh._id, url: wh.url, events: wh.events, active: wh.active, createdAt: wh.createdAt } });
    } catch (error) { next(error); }
  }
);

// PATCH /:eventId/webhooks/:webhookId — toggle active (organizer only)
router.patch('/:eventId/webhooks/:webhookId', verifyOrganizer, async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    const wh = event.webhooks.id(req.params.webhookId);
    if (!wh) return res.status(404).json({ error: 'Webhook not found' });
    if (req.body.active !== undefined) wh.active = req.body.active;
    await event.save();
    res.json({ webhook: { _id: wh._id, url: wh.url, events: wh.events, active: wh.active } });
  } catch (error) { next(error); }
});

// DELETE /:eventId/webhooks/:webhookId — delete webhook (organizer only)
router.delete('/:eventId/webhooks/:webhookId', verifyOrganizer, async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    event.webhooks = event.webhooks.filter(w => w._id.toString() !== req.params.webhookId);
    await event.save();
    res.json({ message: 'Webhook deleted' });
  } catch (error) { next(error); }
});

// 
// APPROVAL QUEUE — organizer approve/reject pending join requests
// 

// GET  /:eventId/approval-status — unauthenticated polling endpoint for pending users
// A user waiting for approval polls this to learn when the organizer approves them.
// Returns { pending: true } while in the queue, or { approved: true, token } once approved.
// Rate-limited by the standard API limiter; username is required in query string.
router.get('/:eventId/approval-status', async (req, res, next) => {
  try {
    const { eventId } = req.params;
    const username = (req.query.username || '').trim();
    if (!username) return res.status(400).json({ error: 'username query param required' });

    const event = await Event.findById(eventId).select('approvalQueue participants settings title');
    if (!event) return res.status(404).json({ error: 'Event not found.' });
    if (!event.settings?.requireApproval) return res.status(400).json({ error: 'This event does not require approval.' });

    const inQueue      = event.approvalQueue?.some(q => q.username === username);
    const isParticipant = event.participants?.some(p => p.username === username);

    if (isParticipant) {
      // They've been approved — ensure their participant record exists and issue a token
      await EventParticipant.findOneAndUpdate(
        { eventId, username },
        { role: 'participant', lastSeenAt: new Date() },
        { upsert: true, new: true }
      );
      const token = jwt.sign(
        { eventId: eventId.toString(), username, role: 'participant' },
        secrets.jwt, { expiresIn: '30d' }
      );
      return res.json({ approved: true, token, event: { id: event._id, title: event.title } });
    }

    if (inQueue) {
      return res.json({ pending: true, message: 'Your request is still pending organizer approval.' });
    }

    // Not in queue and not a participant — they haven't requested yet or were rejected
    return res.json({ notRequested: true });
  } catch (err) { next(err); }
});

// GET  /:eventId/approval-queue  — list pending requests (organizer only)
router.get('/:eventId/approval-queue', verifyOrganizer, async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.eventId).select('approvalQueue');
    if (!event) return res.status(404).json({ error: 'Event not found.' });
    res.json({ queue: event.approvalQueue || [] });
  } catch (err) { next(err); }
});

// POST /:eventId/approval-queue/:username/approve
router.post('/:eventId/approval-queue/:username/approve', verifyOrganizer, async (req, res, next) => {
  try {
    const { eventId, username } = req.params;
    const event = await Event.findById(eventId).select('+password');
    if (!event) return res.status(404).json({ error: 'Event not found.' });

    const inQueue = event.approvalQueue?.some(q => q.username === username);
    if (!inQueue) return res.status(404).json({ error: 'No pending request for that username.' });

    // Remove from queue
    await Event.findByIdAndUpdate(eventId, { $pull: { approvalQueue: { username } } });

    // Create participant record and add to event
    await EventParticipant.findOneAndUpdate(
      { eventId, username },
      { role: 'participant', lastSeenAt: new Date() },
      { upsert: true, new: true }
    );
    await event.addParticipant(username);

    // Issue a token for them to use
    const token = jwt.sign(
      { eventId: eventId.toString(), username, role: 'participant' },
      secrets.jwt, { expiresIn: '30d' }
    );

    const io = req.app.get('io');
    if (io) {
      io.to(`event_${eventId}`).emit('approval_approved', { username, token });
    }
    res.json({ message: `${username} approved.`, token });
  } catch (err) { next(err); }
});

// POST /:eventId/approval-queue/:username/reject
router.post('/:eventId/approval-queue/:username/reject', verifyOrganizer, async (req, res, next) => {
  try {
    const { eventId, username } = req.params;
    await Event.findByIdAndUpdate(eventId, { $pull: { approvalQueue: { username } } });
    const io = req.app.get('io');
    if (io) {
      io.to(`event_${eventId}`).emit('approval_rejected', { username });
    }
    res.json({ message: `${username} rejected.` });
  } catch (err) { next(err); }
});

//  GET /invite/:inviteCode/qr.svg 
// Returns a branded PlanIt QR card for a specific guest invite.
// No auth required — the invite code IS the credential (same as the invite page).
// Matches the dark-card aesthetic of the event QR already used in EventSpace.
router.get('/invite/:inviteCode/qr.svg', async (req, res, next) => {
  try {
    const QRCode = require('qrcode');
    const Invite = require('../models/Invite');
    const invite = await Invite.findOne({ inviteCode: req.params.inviteCode.toUpperCase() }).lean();
    if (!invite) return res.status(404).send('Invite not found');

    const event = await Event.findById(invite.eventId).select('title').lean();
    if (!event) return res.status(404).send('Event not found');

    // Use FRONTEND_URL - req.get('host') behind Render proxy returns backend hostname, not the frontend
    const frontendBase = (process.env.FRONTEND_URL || process.env.BASE_DOMAIN || '').replace(/\/$/, '');
    const inviteUrl = frontendBase
      ? `${frontendBase}/invite/${invite.inviteCode}`
      : `${req.protocol}://${req.get('host')}/invite/${invite.inviteCode}`;

    // Clean QR - no center overlay. BarcodeDetector rejects QRs with anything layered on top.
    // PLANIT branding goes below the QR area instead.
    const dataUrl = await QRCode.toDataURL(inviteUrl, {
      width: 260,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    });

    const safeTitle    = (event.title || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').slice(0, 30);
    const safeName     = (invite.guestName || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').slice(0, 28);
    const safeCode     = invite.inviteCode.replace(/[^A-Z0-9]/g, '');

    const W = 300, H = 430;
    const QX = 20, QY = 20, QS = 260;

    const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <filter id="glow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="4" stdDeviation="10" flood-color="#000" flood-opacity="0.55"/>
    </filter>
    <clipPath id="qrclip"><rect x="${QX}" y="${QY}" width="${QS}" height="${QS}" rx="10"/></clipPath>
  </defs>
  <rect width="${W}" height="${H}" rx="20" fill="#0a0a0a" filter="url(#glow)"/>
  <rect x="${QX - 4}" y="${QY - 4}" width="${QS + 8}" height="${QS + 8}" rx="14" fill="#ffffff"/>
  <image x="${QX}" y="${QY}" width="${QS}" height="${QS}" href="${dataUrl}" clip-path="url(#qrclip)"/>
  <line x1="20" y1="${QY + QS + 18}" x2="${W - 20}" y2="${QY + QS + 18}" stroke="#1f1f1f" stroke-width="1"/>
  <text x="${W / 2}" y="${QY + QS + 40}" text-anchor="middle"
        fill="#ffffff" font-family="system-ui,-apple-system,'Segoe UI',Helvetica,Arial,sans-serif"
        font-size="13" font-weight="800" letter-spacing="5">PLANIT</text>
  <text x="${W / 2}" y="${QY + QS + 62}" text-anchor="middle"
        fill="#e5e5e5" font-family="system-ui,-apple-system,'Segoe UI',Helvetica,Arial,sans-serif"
        font-size="12" font-weight="600">${safeTitle}</text>
  <text x="${W / 2}" y="${QY + QS + 80}" text-anchor="middle"
        fill="#888" font-family="system-ui,-apple-system,'Segoe UI',Helvetica,Arial,sans-serif"
        font-size="11">${safeName}</text>
  <text x="${W / 2}" y="${QY + QS + 100}" text-anchor="middle"
        fill="#444" font-family="'Courier New',Courier,monospace"
        font-size="11" font-weight="700" letter-spacing="3">${safeCode}</text>
</svg>`;

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(svg);
  } catch (err) { next(err); }
});

//  GET /:eventId/checkin-cache 
// Returns a lightweight snapshot of all invites for offline PWA check-in.
// Staff/organizer devices call this on page load and store it in IndexedDB.
// When offline, the device checks invites against this cache and queues scans.
// Excludes sensitive fields (actual PIN value is never sent — only hasPin flag).
router.get('/:eventId/checkin-cache', verifyCheckinAccess, async (req, res, next) => {
  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId).select('title checkinSettings').lean();
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const Invite = require('../models/Invite');
    const invites = await Invite.find({ eventId })
      .select('inviteCode guestName guestEmail groupSize adults children checkedIn securityPin isBlocked status notes tableId tableLabel')
      .lean();

    const snapshot = invites.map(inv => ({
      code:       inv.inviteCode,
      name:       inv.guestName,
      email:      inv.guestEmail       || '',
      groupSize:  inv.groupSize        || 1,
      adults:     inv.adults           || 1,
      children:   inv.children         || 0,
      checkedIn:  !!inv.checkedIn,
      hasPin:     !!(inv.securityPin),
      isBlocked:  !!(inv.isBlocked),
      status:     inv.status           || 'active',
      notes:      inv.notes            || '',
      tableId:    inv.tableId          || null,
      tableLabel: inv.tableLabel       || null,
    }));

    res.json({
      snapshot,
      total:    snapshot.length,
      builtAt:  new Date().toISOString(),
      event:    { title: event.title },
    });
  } catch (err) { next(err); }
});

module.exports = router;
module.exports.fireWebhooks = fireWebhooks;

// 
// TABLE SERVICE MODE — Restaurant & Venue Floor Management Routes
// Data is NEVER auto-wiped (keepForever enforced in settings PATCH).
// 

// GET  /:eventId/table-service/floor  — full floor state
// Strictly table-service events only. Enterprise events use /checkin for seating.
router.get('/:eventId/table-service/floor', verifyCheckinAccess, async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.eventId)
      .select('title tableServiceSettings reservationPageSettings tableStates restaurantReservations tableServiceWaitlist seatingMap isTableServiceMode isEnterpriseMode')
      .lean();
    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (!event.isTableServiceMode) {
      return res.status(403).json({
        error: 'Floor plan is not available for this event.',
        isEnterpriseMode: !!event.isEnterpriseMode,
        eventTitle: event.title,
      });
    }
    res.json({
      seatingMap:              event.seatingMap || { enabled: false, objects: [] },
      tableStates:             event.tableStates || [],
      settings:                event.tableServiceSettings || {},
      reservations:            (event.restaurantReservations || []).filter(r => r.status !== 'cancelled'),
      waitlist:                (event.tableServiceWaitlist || []).filter(w => w.status === 'waiting' || w.status === 'notified'),
      restaurantName:          event.tableServiceSettings?.restaurantName || event.title,
      reservationPageSettings: event.reservationPageSettings || {},
      isTableServiceMode:      true,
      isEnterpriseMode:        false,
    });
  } catch (err) { next(err); }
});

// PATCH /:eventId/table-service/table/:tableId  — update a single table state
router.patch('/:eventId/table-service/table/:tableId', verifyCheckinAccess, async (req, res, next) => {
  try {
    const { eventId, tableId } = req.params;
    const { status, partyName, partySize, serverName, notes, reservationId } = req.body;
    const ALLOWED_STATUSES = ['available', 'occupied', 'reserved', 'cleaning', 'unavailable'];
    if (status && !ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be: ${ALLOWED_STATUSES.join(', ')}` });
    }
    const event = await Event.findById(eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });

    let existing = event.tableStates.find(s => s.tableId === tableId);
    if (!existing) { event.tableStates.push({ tableId, status: 'available' }); existing = event.tableStates[event.tableStates.length - 1]; }

    const prevStatus = existing.status;
    if (status !== undefined)        existing.status        = status;
    if (partyName !== undefined)     existing.partyName     = partyName;
    if (partySize !== undefined)     existing.partySize     = partySize;
    if (serverName !== undefined)    existing.serverName    = serverName;
    if (notes !== undefined)         existing.notes         = notes;
    if (reservationId !== undefined) existing.reservationId = reservationId;
    if (status === 'occupied' && prevStatus !== 'occupied') existing.occupiedAt = new Date();
    if (status === 'available' || status === 'cleaning') {
      existing.occupiedAt = null; existing.partyName = partyName || ''; existing.partySize = partySize || 0; existing.reservationId = null;
    }
    existing.updatedAt = new Date();
    await event.save();

    const io = req.app.get('io');
    if (io) io.to(`event_${eventId}`).emit('table_state_update', { tableId, ...existing.toObject() });
    res.json({ success: true, tableState: existing });
  } catch (err) { next(err); }
});

// POST /:eventId/table-service/waitlist
router.post('/:eventId/table-service/waitlist', verifyCheckinAccess, async (req, res, next) => {
  try {
    const { partyName, partySize, phone, notes } = req.body;
    if (!partyName?.trim()) return res.status(400).json({ error: 'Party name is required' });
    if (!partySize || partySize < 1) return res.status(400).json({ error: 'Party size must be at least 1' });
    const event = await Event.findById(req.params.eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    const entry = { id: require('crypto').randomUUID(), partyName: partyName.trim(), partySize: parseInt(partySize), phone: phone?.trim() || '', notes: notes?.trim() || '', addedAt: new Date(), status: 'waiting' };
    event.tableServiceWaitlist.push(entry);
    await event.save();
    const io = req.app.get('io');
    if (io) io.to(`event_${req.params.eventId}`).emit('waitlist_update', { action: 'add', entry });
    res.status(201).json({ success: true, entry });
  } catch (err) { next(err); }
});

// PATCH /:eventId/table-service/waitlist/:partyId
router.patch('/:eventId/table-service/waitlist/:partyId', verifyCheckinAccess, async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['waiting','notified','seated','left'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const event = await Event.findById(req.params.eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    const entry = event.tableServiceWaitlist.find(w => w.id === req.params.partyId);
    if (!entry) return res.status(404).json({ error: 'Not found' });
    entry.status = status;
    if (status === 'notified') entry.notifiedAt = new Date();
    await event.save();
    const io = req.app.get('io');
    if (io) io.to(`event_${req.params.eventId}`).emit('waitlist_update', { action: 'update', entry });
    res.json({ success: true, entry });
  } catch (err) { next(err); }
});

// DELETE /:eventId/table-service/waitlist/:partyId
router.delete('/:eventId/table-service/waitlist/:partyId', verifyCheckinAccess, async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    event.tableServiceWaitlist = event.tableServiceWaitlist.filter(w => w.id !== req.params.partyId);
    await event.save();
    res.json({ success: true });
  } catch (err) { next(err); }
});

// POST /:eventId/table-service/reservations
router.post('/:eventId/table-service/reservations', verifyCheckinAccess, async (req, res, next) => {
  try {
    const { partyName, partySize, phone, email, dateTime, tableId, notes } = req.body;
    if (!partyName?.trim()) return res.status(400).json({ error: 'Party name is required' });
    if (!partySize || partySize < 1) return res.status(400).json({ error: 'Party size must be at least 1' });
    if (!dateTime) return res.status(400).json({ error: 'Date/time is required' });
    const event = await Event.findById(req.params.eventId).select('restaurantReservations tableServiceSettings title');
    if (!event) return res.status(404).json({ error: 'Event not found' });
    const id = require('crypto').randomUUID();
    const expiryMins = event.tableServiceSettings?.reservationQrExpiryMinutes || 45;
    const resDateTime = new Date(dateTime);
    const qrExpiresAt = new Date(resDateTime.getTime() + expiryMins * 60000);
    const secsUntilExpiry = Math.max(3600, Math.ceil((qrExpiresAt.getTime() - Date.now()) / 1000));
    const qrToken = jwt.sign(
      { type: 'table_reservation', reservationId: id, eventId: req.params.eventId, partyName: partyName.trim(), partySize: parseInt(partySize) },
      secrets.jwt, { expiresIn: `${secsUntilExpiry}s` }
    );
    const reservation = { id, partyName: partyName.trim(), partySize: parseInt(partySize), phone: phone?.trim() || '', email: email?.trim() || '', dateTime: resDateTime, tableId: tableId || null, qrToken, qrExpiresAt, status: 'confirmed', notes: notes?.trim() || '', createdAt: new Date() };
    event.restaurantReservations.push(reservation);
    await event.save();
    res.status(201).json({ success: true, reservation });
  } catch (err) { next(err); }
});

// PATCH /:eventId/table-service/reservations/:reservationId
router.patch('/:eventId/table-service/reservations/:reservationId', verifyCheckinAccess, async (req, res, next) => {
  try {
    const { status, tableId, notes } = req.body;
    if (status && !['confirmed','seated','cancelled','no_show'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const event = await Event.findById(req.params.eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    const r = event.restaurantReservations.find(r => r.id === req.params.reservationId);
    if (!r) return res.status(404).json({ error: 'Reservation not found' });
    if (status !== undefined)  r.status  = status;
    if (tableId !== undefined) r.tableId = tableId;
    if (notes !== undefined)   r.notes   = notes;
    await event.save();
    res.json({ success: true, reservation: r });
  } catch (err) { next(err); }
});

// GET /:eventId/table-service/reservations/verify/:token  — QR scan verification
router.get('/:eventId/table-service/reservations/verify/:token', verifyCheckinAccess, async (req, res, next) => {
  try {
    let decoded;
    try { decoded = jwt.verify(req.params.token, secrets.jwt); } catch (e) {
      return res.status(401).json({ valid: false, error: e.name === 'TokenExpiredError' ? 'This QR code has expired.' : 'Invalid QR code.' });
    }
    if (decoded.type !== 'table_reservation' || decoded.eventId !== req.params.eventId) {
      return res.status(400).json({ valid: false, error: 'QR code is not for this venue.' });
    }
    const event = await Event.findById(req.params.eventId).select('restaurantReservations');
    const reservation = event?.restaurantReservations?.find(r => r.id === decoded.reservationId);
    if (!reservation) return res.status(404).json({ valid: false, error: 'Reservation not found.' });
    if (reservation.status === 'cancelled') return res.status(400).json({ valid: false, error: 'This reservation was cancelled.' });
    if (reservation.status === 'seated')    return res.status(400).json({ valid: false, error: 'This party is already seated.' });
    res.json({ valid: true, reservation });
  } catch (err) { next(err); }
});

// PATCH /:eventId/table-service/settings
router.patch('/:eventId/table-service/settings', verifyOrganizer, async (req, res, next) => {
  try {
    const ALLOWED = ['restaurantName','avgDiningMinutes','cleaningBufferMinutes','reservationDurationMinutes','reservationQrExpiryMinutes','maxPartySizeWalkIn','operatingHoursOpen','operatingHoursClose','currency','welcomeMessage','sizeOverrides'];
    const event = await Event.findById(req.params.eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    ALLOWED.forEach(k => { if (req.body[k] !== undefined) event.tableServiceSettings[k] = req.body[k]; });
    event.keepForever = true; // Table Service data is never auto-wiped
    await event.save();
    res.json({ success: true, settings: event.tableServiceSettings });
  } catch (err) { next(err); }
});
// 


router.get('/public/reserve/:subdomain', availabilityLimiter, async (req, res, next) => {
  try {
    const event = await Event.findOne({ subdomain: req.params.subdomain })
      .select('title isTableServiceMode tableServiceSettings reservationPageSettings seatingMap tableStates tableServiceWaitlist')
      .lean();
    if (!event) return res.status(404).json({ error: 'Not found' });
    if (!event.isTableServiceMode) return res.status(404).json({ error: 'Not found' });

    const rps = event.reservationPageSettings || {};
    const tss = event.tableServiceSettings   || {};

    // Live wait times per common party sizes (1-2, 3-4, 5-8)
    let waitTimes = null;
    if (rps.showLiveWaitTime !== false) {
      const objects = event.seatingMap?.objects || [];
      const states  = event.tableStates || [];
      const activeWait = (event.tableServiceWaitlist || []).filter(w => w.status === 'waiting' || w.status === 'notified');

      const avgDining = tss.avgDiningMinutes || 75;
      const buffer    = tss.cleaningBufferMinutes || 10;

      const calcWait = (sz) => {
        const tables = objects.filter(o => o.type !== 'zone' && o.capacity >= sz);
        if (!tables.length) return null;
        const avail = tables.some(t => {
          const s = states.find(st => st.tableId === t.id);
          return !s || s.status === 'available';
        });
        if (avail) return 0;
        const times = tables.map(t => {
          const s = states.find(st => st.tableId === t.id);
          if (!s || s.status !== 'occupied' || !s.occupiedAt) return null;
          const seatedMs = Date.now() - new Date(s.occupiedAt).getTime();
          return Math.max(0, Math.round((avgDining * 60000 - seatedMs) / 60000));
        }).filter(t => t !== null);
        if (!times.length) return null;
        return Math.min(...times) + buffer;
      };

      waitTimes = { forTwo: calcWait(2), forFour: calcWait(4), forEight: calcWait(8) };
    }

    res.json({
      name:             tss.restaurantName || event.title,
      tagline:          rps.headerTagline || '',
      description:      rps.publicDescription || '',
      cuisine:          rps.cuisine || '',
      priceRange:       rps.priceRange || '',
      dressCode:        rps.dressCode || '',
      parkingInfo:      rps.parkingInfo || '',
      accessibilityInfo:rps.accessibilityInfo || '',
      address:          rps.address || '',
      phone:            rps.phone || '',
      websiteUrl:       rps.websiteUrl || '',
      instagramHandle:  rps.instagramHandle || '',
      facebookUrl:      rps.facebookUrl || '',
      googleMapsUrl:    rps.googleMapsUrl || '',
      heroImageUrl:     rps.heroImageUrl || '',
      logoUrl:          rps.logoUrl || '',
      accentColor:      rps.accentColor || '#f97316',
      backgroundStyle:  rps.backgroundStyle || 'dark',
      fontStyle:        rps.fontStyle || 'modern',
      announcementBanner:        rps.announcementBannerEnabled ? rps.announcementBanner : '',
      announcementBannerColor:   rps.announcementBannerColor || '#f59e0b',
      operatingHoursOpen:  tss.operatingHoursOpen  || '11:00',
      operatingHoursClose: tss.operatingHoursClose || '22:00',
      operatingDays:    rps.operatingDays || {},
      blackoutDates:    (rps.blackoutDates || []).map(b => b.date),
      acceptingReservations: rps.acceptingReservations || false,
      confirmationMode:      rps.confirmationMode || 'auto_confirm',
      slotIntervalMinutes:   rps.slotIntervalMinutes || 30,
      maxAdvanceDays:        rps.maxAdvanceDays || 30,
      minAdvanceHours:       rps.minAdvanceHours ?? 1,
      maxPartySizePublic:    rps.maxPartySizePublic || 12,
      minPartySizePublic:    rps.minPartySizePublic || 1,
      requirePhone:          rps.requirePhone !== false,
      requireEmail:          rps.requireEmail || false,
      allowSpecialRequests:  rps.allowSpecialRequests !== false,
      allowDietaryNeeds:     rps.allowDietaryNeeds !== false,
      allowOccasionSelect:   rps.allowOccasionSelect !== false,
      occasionOptions:       rps.occasionOptions?.length ? rps.occasionOptions : ['Birthday','Anniversary','Business Dinner','Date Night','Family Gathering','Other'],
      showLiveWaitTime:      rps.showLiveWaitTime !== false,
      showAvailabilityStatus:rps.showAvailabilityStatus !== false,
      showTableCount:        rps.showTableCount || false,
      availabilityDisplayMode: rps.availabilityDisplayMode || 'slots',
      confirmationMessage:   rps.confirmationMessage || '',
      depositRequired:       rps.depositRequired || false,
      depositAmount:         rps.depositAmount || 0,
      depositNote:           rps.depositNote || '',
      cancellationPolicy:    rps.cancellationPolicy || '',
      cancelCutoffHours:     rps.cancelCutoffHours || 2,
      faqItems:              rps.faqItems || [],
      termsUrl:              rps.termsUrl || '',
      privacyUrl:            rps.privacyUrl || '',
      showPoweredBy:         rps.showPoweredBy !== false,
      metaTitle:             rps.metaTitle || '',
      metaDescription:       rps.metaDescription || '',
      waitTimes,
    });
  } catch (err) { next(err); }
});

//  GET /public/reserve/:subdomain/availability 
// ?date=YYYY-MM-DD&partySize=N
router.get('/public/reserve/:subdomain/availability', availabilityLimiter, async (req, res, next) => {
  try {
    const { date, partySize, tz } = req.query;
    if (!date || !partySize) return res.status(400).json({ error: 'date and partySize required' });

    const sz = parseInt(partySize);
    if (isNaN(sz) || sz < 1 || sz > 100) return res.status(400).json({ error: 'Invalid party size' });

    const event = await Event.findOne({ subdomain: req.params.subdomain })
      .select('isTableServiceMode tableServiceSettings reservationPageSettings seatingMap restaurantReservations')
      .lean();
    if (!event || !event.isTableServiceMode) return res.status(404).json({ error: 'Not found' });

    const rps = event.reservationPageSettings || {};
    if (!rps.acceptingReservations) return res.json({ slots: [], closed: true });

    // Blackout / day closed
    const dayKey = getDayKey(date + 'T12:00:00');
    const dayConfig = rps.operatingDays?.[dayKey];
    if (dayConfig && dayConfig.open === false) return res.json({ slots: [], closed: true });
    if ((rps.blackoutDates || []).some(b => b.date === date)) {
      return res.json({ slots: [], closed: true, reason: 'Closed this date' });
    }

    // Max per day cap
    const maxPerDay = rps.maxReservationsPerDay || 0;
    if (maxPerDay > 0) {
      const dayStart = tz ? wallClockToUTC(date, '00:00', tz) : new Date(date + 'T00:00:00');
      const dayEnd   = tz ? wallClockToUTC(date, '23:59', tz) : new Date(date + 'T23:59:59');
      const dayCount = (event.restaurantReservations || []).filter(r =>
        (r.status === 'confirmed' || r.status === 'pending') &&
        new Date(r.dateTime) >= dayStart && new Date(r.dateTime) <= dayEnd
      ).length;
      if (dayCount >= maxPerDay) return res.json({ slots: [], closed: true, reason: 'Fully booked for this day' });
    }

    const slots = computeAvailability(date, sz, event, tz);
    res.json({ slots });
  } catch (err) { next(err); }
});

//  POST /public/reserve/:subdomain 
// Create a public reservation. Rate limited.
router.post('/public/reserve/:subdomain', reservationLimiter, async (req, res, next) => {
  try {
    const { partyName, partySize, phone, email, date, timeSlot, occasion, specialRequests, dietaryNeeds, tz } = req.body;

    if (!partyName?.trim()) return res.status(400).json({ error: 'Name is required' });
    if (!partySize || partySize < 1) return res.status(400).json({ error: 'Party size is required' });
    if (!date || !timeSlot) return res.status(400).json({ error: 'Date and time are required' });

    const event = await Event.findOne({ subdomain: req.params.subdomain })
      .select('+restaurantReservations tableServiceSettings reservationPageSettings seatingMap isTableServiceMode');
    if (!event || !event.isTableServiceMode) return res.status(404).json({ error: 'Not found' });

    const rps = event.reservationPageSettings || {};
    if (!rps.acceptingReservations) return res.status(403).json({ error: 'Online reservations are not currently being accepted.' });

    if (rps.requirePhone && !phone?.trim()) return res.status(400).json({ error: 'Phone number is required' });
    if (rps.requireEmail && !email?.trim()) return res.status(400).json({ error: 'Email address is required' });

    const sz = parseInt(partySize);
    if (sz < (rps.minPartySizePublic || 1)) return res.status(400).json({ error: `Minimum party size is ${rps.minPartySizePublic || 1}` });
    if (sz > (rps.maxPartySizePublic || 12)) return res.status(400).json({ error: `Maximum party size for online bookings is ${rps.maxPartySizePublic || 12}` });

    // Build datetime in guest's local timezone → store as correct UTC
    const dateTime = tz ? wallClockToUTC(date, timeSlot, tz) : new Date(`${date}T${timeSlot}:00`);
    if (isNaN(dateTime.getTime())) return res.status(400).json({ error: 'Invalid date/time' });

    // Min advance check
    const minAdvanceMs = (rps.minAdvanceHours ?? 1) * 3600000;
    if (dateTime.getTime() - Date.now() < minAdvanceMs) {
      return res.status(400).json({ error: `Reservations must be made at least ${rps.minAdvanceHours ?? 1} hour(s) in advance` });
    }

    // Max advance check
    const maxAdvanceMs = (rps.maxAdvanceDays || 30) * 86400000;
    if (dateTime.getTime() - Date.now() > maxAdvanceMs) {
      return res.status(400).json({ error: `Reservations can only be made up to ${rps.maxAdvanceDays || 30} days in advance` });
    }

    // Re-check availability
    const slots = computeAvailability(date, sz, event, tz);
    const targetSlot = slots.find(s => s.time === timeSlot);
    if (!targetSlot || targetSlot.status === 'full') {
      return res.status(409).json({ error: 'This time slot is no longer available. Please choose another time.' });
    }

    // Per-day cap re-check
    const maxPerDay = rps.maxReservationsPerDay || 0;
    if (maxPerDay > 0) {
      const dayStart = tz ? wallClockToUTC(date, '00:00', tz) : new Date(date + 'T00:00:00');
      const dayEnd   = tz ? wallClockToUTC(date, '23:59', tz) : new Date(date + 'T23:59:59');
      const dayCount = event.restaurantReservations.filter(r =>
        (r.status === 'confirmed' || r.status === 'pending') &&
        new Date(r.dateTime) >= dayStart && new Date(r.dateTime) <= dayEnd
      ).length;
      if (dayCount >= maxPerDay) return res.status(409).json({ error: 'Sorry, this day is now fully booked.' });
    }

    // Generate tokens
    const resId      = `res_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
    const qrToken    = crypto.randomBytes(24).toString('hex');
    const cancelToken= crypto.randomBytes(24).toString('hex');

    const tss = event.tableServiceSettings || {};
    const qrExpiryMin = tss.reservationQrExpiryMinutes || 45;
    const qrExpiresAt = new Date(dateTime.getTime() + qrExpiryMin * 60000);

    const status = (rps.confirmationMode === 'manual') ? 'pending' : 'confirmed';

    const reservation = {
      id:              resId,
      partyName:       partyName.trim(),
      partySize:       sz,
      phone:           phone?.trim() || '',
      email:           email?.trim() || '',
      dateTime,
      tableId:         null,
      qrToken,
      qrExpiresAt,
      cancelToken,
      status,
      source:          'public',
      occasion:        occasion || '',
      specialRequests: specialRequests?.trim() || '',
      dietaryNeeds:    dietaryNeeds?.trim() || '',
      notes:           '',
      createdAt:       new Date(),
    };

    // Use findOneAndUpdate + $push to avoid Mongoose 8 partial-select validation errors
    // (event was fetched with .select() so required fields like title/subdomain are absent
    //  from the in-memory doc — calling event.save() throws ValidationError on those paths)
    await Event.findOneAndUpdate(
      { subdomain: req.params.subdomain },
      { $push: { restaurantReservations: reservation }, $set: { keepForever: true } },
      { runValidators: false }
    );

    // Fire confirmation email non-blocking
    if (rps.sendConfirmationEmail !== false && email?.trim()) {
      try {
        const { sendReservationConfirmation } = require('../services/emailService');
        sendReservationConfirmation(event, reservation).catch(() => {});
      } catch (_) {}
    }

    const cancelUrl = `${process.env.FRONTEND_URL || 'https://planit.events'}/reserve/cancel/${cancelToken}`;

    res.status(201).json({
      reservationId: resId,
      status,
      partyName:     reservation.partyName,
      partySize:     reservation.partySize,
      dateTime:      reservation.dateTime,
      qrToken,
      qrExpiresAt,
      cancelToken,   // frontend redirects to /reservation/:cancelToken ticket page
      cancelUrl,
      confirmationMessage: rps.confirmationMessage || '',
      depositRequired:     rps.depositRequired || false,
      depositAmount:       rps.depositAmount || 0,
      depositNote:         rps.depositNote || '',
      isPending: status === 'pending',
    });
  } catch (err) { next(err); }
});


//  GET /public/reserve/confirmation/:cancelToken 
// Returns reservation details for the guest confirmation/ticket page.
// Uses cancelToken (sent in POST response) — safe to expose publicly.
router.get('/public/reserve/confirmation/:cancelToken', availabilityLimiter, async (req, res, next) => {
  try {
    const { cancelToken } = req.params;
    if (!cancelToken || cancelToken.length < 10) return res.status(400).json({ error: 'Invalid token' });

    const event = await Event.findOne({
      isTableServiceMode: true,
      'restaurantReservations.cancelToken': cancelToken,
    }).select('title subdomain restaurantReservations reservationPageSettings');

    if (!event) return res.status(404).json({ error: 'Reservation not found.' });

    const r = event.restaurantReservations.find(x => x.cancelToken === cancelToken);
    if (!r) return res.status(404).json({ error: 'Reservation not found.' });

    const rps = event.reservationPageSettings || {};

    res.json({
      restaurantName: event.title,
      subdomain: event.subdomain,
      accentColor: rps.accentColor || '#f97316',
      logoUrl: rps.logoUrl || '',
      address: rps.address || '',
      phone: rps.phone || '',
      reservation: {
        id: r.id,
        partyName: r.partyName,
        partySize: r.partySize,
        dateTime: r.dateTime,
        status: r.status,
        qrToken: r.qrToken,
        qrExpiresAt: r.qrExpiresAt,
        occasion: r.occasion || '',
        specialRequests: r.specialRequests || '',
        dietaryNeeds: r.dietaryNeeds || '',
      },
      cancelUrl: `${process.env.FRONTEND_URL || 'https://planit.events'}/reservation/${cancelToken}`,
      confirmationMessage: rps.confirmationMessage || '',
      cancelCutoffHours: rps.cancelCutoffHours || 2,
    });
  } catch (err) { next(err); }
});

//  DELETE /public/reserve/cancel/:cancelToken 
// Self-service cancellation via the token in the confirmation email.
router.delete('/public/reserve/cancel/:cancelToken', reservationLimiter, async (req, res, next) => {
  try {
    const { cancelToken } = req.params;
    if (!cancelToken || cancelToken.length < 10) return res.status(400).json({ error: 'Invalid cancel token' });

    // Search across all table-service events for this token
    const event = await Event.findOne({
      isTableServiceMode: true,
      'restaurantReservations.cancelToken': cancelToken,
    });
    if (!event) return res.status(404).json({ error: 'Reservation not found or already cancelled.' });

    const res_ = event.restaurantReservations.find(r => r.cancelToken === cancelToken);
    if (!res_) return res.status(404).json({ error: 'Reservation not found.' });
    if (res_.status === 'cancelled') return res.status(400).json({ error: 'This reservation is already cancelled.' });
    if (res_.status === 'seated') return res.status(400).json({ error: 'This reservation cannot be cancelled — the party is already seated.' });

    const rps = event.reservationPageSettings || {};
    const cutoffMs = (rps.cancelCutoffHours || 2) * 3600000;
    if (new Date(res_.dateTime).getTime() - Date.now() < cutoffMs) {
      return res.status(403).json({
        error: `Reservations can only be cancelled at least ${rps.cancelCutoffHours || 2} hour(s) before the booking time. Please call us directly.`,
        phone: rps.phone || '',
      });
    }

    res_.status = 'cancelled';
    await event.save();

    // Notify organizer
    if (rps.notifyOrganizerOnCancel && rps.notifyOrganizerEmail) {
      try {
        const { sendReservationCancellation } = require('../services/emailService');
        sendReservationCancellation(event, res_).catch(() => {});
      } catch (_) {}
    }

    res.json({ success: true, message: 'Your reservation has been cancelled.' });
  } catch (err) { next(err); }
});

//  PATCH /:eventId/table-service/reservation-page-settings 
// Organizer updates the full reservation page config.
router.patch('/:eventId/table-service/reservation-page-settings', verifyOrganizer, async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (!event.isTableServiceMode) return res.status(403).json({ error: 'Not a table service event' });

    const ALLOWED_KEYS = [
      'acceptingReservations','confirmationMode','heroImageUrl','logoUrl','accentColor',
      'backgroundStyle','fontStyle','headerTagline','showPoweredBy','hidePlanitBranding',
      'announcementBanner','announcementBannerColor','announcementBannerEnabled',
      'publicDescription','cuisine','priceRange','dressCode','parkingInfo','accessibilityInfo',
      'address','phone','websiteUrl','instagramHandle','facebookUrl','googleMapsUrl',
      'operatingDays','blackoutDates',
      'slotIntervalMinutes','maxAdvanceDays','minAdvanceHours','cancelCutoffHours',
      'maxPartySizePublic','minPartySizePublic','maxReservationsPerDay','maxReservationsPerSlot',
      'lastBookingBeforeCloseMinutes',
      'requirePhone','requireEmail','allowSpecialRequests','allowDietaryNeeds',
      'allowOccasionSelect','occasionOptions',
      'showLiveWaitTime','showAvailabilityStatus','showTableCount','showPartySizeWaitTimes',
      'availabilityDisplayMode',
      'confirmationMessage','confirmationEmailSubject','sendConfirmationEmail',
      'sendReminderEmail','reminderHoursBefore','sendCancellationEmail',
      'notifyOrganizerOnBooking','notifyOrganizerOnCancel','notifyOrganizerEmail',
      'cancellationPolicy','depositRequired','depositAmount','depositNote',
      'termsUrl','privacyUrl','faqItems',
      'metaTitle','metaDescription',
    ];

    if (!event.reservationPageSettings) event.reservationPageSettings = {};
    ALLOWED_KEYS.forEach(k => {
      if (req.body[k] !== undefined) event.reservationPageSettings[k] = req.body[k];
    });
    event.keepForever = true;
    event.markModified('reservationPageSettings');
    await event.save();

    res.json({ success: true, settings: event.reservationPageSettings, reservationPageSettings: event.reservationPageSettings });
  } catch (err) { next(err); }
});

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
        ? `This event will be automatically deleted in ${daysUntilDeletion} day(s). Download a backup now.`
        : hasOccurred
        ? 'This event has occurred. It will be deleted 7 days after the event date.'
        : 'Your event data is safe. Automatic deletion happens 7 days after the event date.'
    });

  } catch (error) {
    next(error);
  }
});
