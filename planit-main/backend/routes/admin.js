const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const Event = require('../models/Event');
const Message = require('../models/Message');
const Poll = require('../models/Poll');
const File = require('../models/File');
const EventParticipant = require('../models/EventParticipant');
const Invite = require('../models/Invite');
const { verifyAdmin } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');
// JWT secret is derived from the license key — must match what verifyAdmin uses
const { secrets } = require('../keys');

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// ═══════════════════════════════════════════════════════════════════════════
// AUTHENTICATION
// ═══════════════════════════════════════════════════════════════════════════

// Admin login
router.post('/login',
  authLimiter,
  [
    body('username').trim().notEmpty().withMessage('Username is required'),
    body('password').notEmpty().withMessage('Password is required'),
    validate
  ],
  async (req, res) => {
    try {
      const { username, password } = req.body;

      // Check credentials against environment variables
      const adminUsername = process.env.ADMIN_USERNAME || 'admin';
      const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

      if (username !== adminUsername || password !== adminPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Generate admin token
      const token = jwt.sign(
        { username, isAdmin: true, role: 'super_admin' },
        secrets.jwt,
        { expiresIn: '24h' }
      );

      res.json({
        message: 'Admin login successful',
        token,
        user: { username, role: 'super_admin' }
      });
    } catch (error) {
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD & STATISTICS
// ═══════════════════════════════════════════════════════════════════════════

// Get dashboard statistics
router.get('/stats', verifyAdmin, async (req, res, next) => {
  try {
    const [
      totalEvents,
      activeEvents,
      totalMessages,
      totalPolls,
      totalFiles
    ] = await Promise.all([
      Event.countDocuments(),
      Event.countDocuments({ status: 'active' }),
      Message.countDocuments({ isDeleted: false }),
      Poll.countDocuments(),
      File.countDocuments({ isDeleted: false })
    ]);

    // Get events created in last 24 hours
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentEvents = await Event.countDocuments({ 
      createdAt: { $gte: yesterday } 
    });

    // Get total participants
    const events = await Event.find({}, 'participants');
    const totalParticipants = events.reduce(
      (sum, event) => sum + event.participants.length, 
      0
    );

    // Calculate total file storage used
    const fileStats = await File.aggregate([
      { $match: { isDeleted: false } },
      { $group: { _id: null, totalSize: { $sum: '$size' } } }
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
      averageParticipantsPerEvent: totalEvents > 0 
        ? Math.round(totalParticipants / totalEvents) 
        : 0
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// EVENT MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

// Get all events with pagination and filtering
router.get('/events', verifyAdmin, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status && req.query.status !== 'all') {
      filter.status = req.query.status;
    }
    if (req.query.search) {
      filter.$or = [
        { title: { $regex: req.query.search, $options: 'i' } },
        { subdomain: { $regex: req.query.search, $options: 'i' } },
        { organizerEmail: { $regex: req.query.search, $options: 'i' } },
        { organizerName: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const [events, total] = await Promise.all([
      Event.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Event.countDocuments(filter)
    ]);

    res.json({
      events,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
});

// Get single event details
router.get('/events/:eventId', verifyAdmin, async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.eventId);

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Get related statistics
    const [messageCount, pollCount, fileCount, participantCount] = await Promise.all([
      Message.countDocuments({ eventId: event._id, isDeleted: false }),
      Poll.countDocuments({ eventId: event._id }),
      File.countDocuments({ eventId: event._id, isDeleted: false }),
      EventParticipant.countDocuments({ eventId: event._id })
    ]);

    res.json({
      event,
      stats: {
        messages: messageCount,
        polls: pollCount,
        files: fileCount,
        participants: participantCount
      }
    });
  } catch (error) {
    next(error);
  }
});

// Update event (full edit capabilities)
router.patch('/events/:eventId', verifyAdmin, async (req, res, next) => {
  try {
    const allowedFields = [
      'title', 'description', 'date', 'location', 
      'organizerName', 'organizerEmail', 'maxParticipants',
      'isPasswordProtected', 'isEnterpriseMode', 'subdomain', 'status'
    ];

    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    const event = await Event.findByIdAndUpdate(
      req.params.eventId,
      updates,
      { new: true, runValidators: true }
    );

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json({
      message: 'Event updated successfully',
      event
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Subdomain already taken' });
    }
    next(error);
  }
});

// Update event status
router.patch('/events/:eventId/status', 
  verifyAdmin,
  [
    body('status')
      .isIn(['draft', 'active', 'completed', 'cancelled'])
      .withMessage('Invalid status'),
    validate
  ],
  async (req, res, next) => {
    try {
      const event = await Event.findByIdAndUpdate(
        req.params.eventId,
        { status: req.body.status },
        { new: true }
      );

      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      res.json({
        message: 'Event status updated',
        event
      });
    } catch (error) {
      next(error);
    }
  }
);

// Delete event and all related data
router.delete('/events/:eventId', verifyAdmin, async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.eventId);

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Delete all related data
    await Promise.all([
      Message.deleteMany({ eventId: event._id }),
      Poll.deleteMany({ eventId: event._id }),
      EventParticipant.deleteMany({ eventId: event._id }),
      Invite ? Invite.deleteMany({ eventId: event._id }) : Promise.resolve(),
      File.updateMany(
        { eventId: event._id },
        { isDeleted: true, deletedAt: new Date() }
      ),
      Event.findByIdAndDelete(event._id)
    ]);

    res.json({ message: 'Event and all related data deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// MESSAGES MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

// Get all messages for an event
router.get('/events/:eventId/messages', verifyAdmin, async (req, res, next) => {
  try {
    const messages = await Message.find({ 
      eventId: req.params.eventId, 
      isDeleted: false 
    })
      .sort({ createdAt: 1 })
      .lean();
    res.json({ messages });
  } catch (error) { next(error); }
});

// Delete a specific message
router.delete('/events/:eventId/messages/:messageId', verifyAdmin, async (req, res, next) => {
  try {
    await Message.findByIdAndUpdate(
      req.params.messageId, 
      { isDeleted: true, deletedAt: new Date() }
    );
    res.json({ message: 'Message deleted' });
  } catch (error) { next(error); }
});

// Bulk delete messages
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

// ═══════════════════════════════════════════════════════════════════════════
// PARTICIPANTS MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

// Get all participants for an event
router.get('/events/:eventId/participants', verifyAdmin, async (req, res, next) => {
  try {
    const participants = await EventParticipant.find({ eventId: req.params.eventId })
      .select('-password')
      .sort({ joinedAt: 1 })
      .lean();
    res.json({ participants });
  } catch (error) { next(error); }
});

// Remove a participant from an event
router.delete('/events/:eventId/participants/:username', verifyAdmin, async (req, res, next) => {
  try {
    await EventParticipant.deleteOne({ 
      eventId: req.params.eventId, 
      username: req.params.username 
    });
    await Event.findByIdAndUpdate(req.params.eventId, {
      $pull: { participants: { username: req.params.username } }
    });
    res.json({ message: 'Participant removed' });
  } catch (error) { next(error); }
});

// Reset a participant's account password
router.delete('/events/:eventId/participants/:username/password', verifyAdmin, async (req, res, next) => {
  try {
    await EventParticipant.findOneAndUpdate(
      { eventId: req.params.eventId, username: req.params.username },
      { $unset: { password: '' }, hasPassword: false }
    );
    res.json({ message: 'Password reset successfully' });
  } catch (error) { next(error); }
});

// Bulk remove participants
router.post('/events/:eventId/participants/bulk-remove', verifyAdmin, async (req, res, next) => {
  try {
    const { usernames } = req.body;
    await EventParticipant.deleteMany({
      eventId: req.params.eventId,
      username: { $in: usernames }
    });
    await Event.findByIdAndUpdate(req.params.eventId, {
      $pull: { participants: { username: { $in: usernames } } }
    });
    res.json({ message: `${usernames.length} participants removed` });
  } catch (error) { next(error); }
});

// ═══════════════════════════════════════════════════════════════════════════
// POLLS MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

// Get all polls for an event
router.get('/events/:eventId/polls', verifyAdmin, async (req, res, next) => {
  try {
    const polls = await Poll.find({ eventId: req.params.eventId })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ polls });
  } catch (error) { next(error); }
});

// Delete a poll
router.delete('/events/:eventId/polls/:pollId', verifyAdmin, async (req, res, next) => {
  try {
    await Poll.findByIdAndDelete(req.params.pollId);
    res.json({ message: 'Poll deleted' });
  } catch (error) { next(error); }
});

// ═══════════════════════════════════════════════════════════════════════════
// FILES MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

// Get all files for an event
router.get('/events/:eventId/files', verifyAdmin, async (req, res, next) => {
  try {
    const files = await File.find({ 
      eventId: req.params.eventId,
      isDeleted: false
    })
      .sort({ uploadedAt: -1 })
      .lean();
    res.json({ files });
  } catch (error) { next(error); }
});

// Delete a file
router.delete('/events/:eventId/files/:fileId', verifyAdmin, async (req, res, next) => {
  try {
    await File.findByIdAndUpdate(
      req.params.fileId,
      { isDeleted: true, deletedAt: new Date() }
    );
    res.json({ message: 'File deleted' });
  } catch (error) { next(error); }
});

// ═══════════════════════════════════════════════════════════════════════════
// INVITES MANAGEMENT (Enterprise Mode)
// ═══════════════════════════════════════════════════════════════════════════

// Get all invites for an event
router.get('/events/:eventId/invites', verifyAdmin, async (req, res, next) => {
  try {
    // Check if Invite model exists (enterprise feature)
    if (!Invite) {
      return res.json({ invites: [] });
    }
    
    const invites = await Invite.find({ eventId: req.params.eventId })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ invites });
  } catch (error) { next(error); }
});

// Check in a guest manually
router.post('/events/:eventId/invites/:inviteCode/checkin', verifyAdmin, async (req, res, next) => {
  try {
    if (!Invite) {
      return res.status(404).json({ error: 'Invite system not available' });
    }

    const invite = await Invite.findOneAndUpdate(
      { eventId: req.params.eventId, inviteCode: req.params.inviteCode },
      {
        checkedIn: true,
        checkedInAt: new Date(),
        actualAttendees: req.body.actualAttendees || invite.groupSize,
        status: 'checked-in'
      },
      { new: true }
    );

    if (!invite) {
      return res.status(404).json({ error: 'Invite not found' });
    }

    res.json({ message: 'Guest checked in', invite });
  } catch (error) { next(error); }
});

// Delete an invite
router.delete('/events/:eventId/invites/:inviteId', verifyAdmin, async (req, res, next) => {
  try {
    if (!Invite) {
      return res.status(404).json({ error: 'Invite system not available' });
    }

    await Invite.findByIdAndDelete(req.params.inviteId);
    res.json({ message: 'Invite deleted' });
  } catch (error) { next(error); }
});

// ═══════════════════════════════════════════════════════════════════════════
// SEARCH & ACTIVITY
// ═══════════════════════════════════════════════════════════════════════════

// Global search across all data
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
          { title: regex },
          { subdomain: regex },
          { description: regex },
          { organizerName: regex },
          { organizerEmail: regex }
        ]
      }).limit(20).lean(),
      Message.find({
        content: regex,
        isDeleted: false
      })
      .limit(20)
      .populate('eventId', 'title subdomain')
      .lean(),
      Poll.find({ question: regex })
        .limit(20)
        .populate('eventId', 'title subdomain')
        .lean(),
      EventParticipant.find({ username: regex })
        .limit(20)
        .populate('eventId', 'title subdomain')
        .select('-password')
        .lean()
    ]);

    res.json({
      results: {
        events,
        messages,
        polls,
        participants
      },
      total: events.length + messages.length + polls.length + participants.length
    });
  } catch (error) {
    next(error);
  }
});

// Get recent activity
router.get('/activity', verifyAdmin, async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 50;

    // Get recent events, messages, and polls
    const [recentEvents, recentMessages, recentPolls] = await Promise.all([
      Event.find()
        .sort({ createdAt: -1 })
        .limit(limit)
        .select('title subdomain organizerName createdAt status')
        .lean(),
      Message.find({ isDeleted: false })
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('eventId', 'title subdomain')
        .lean(),
      Poll.find()
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('eventId', 'title subdomain')
        .lean()
    ]);

    // Combine and sort by date
    const activity = [
      ...recentEvents.map(e => ({ type: 'event', data: e, timestamp: e.createdAt })),
      ...recentMessages.map(m => ({ type: 'message', data: m, timestamp: m.createdAt })),
      ...recentPolls.map(p => ({ type: 'poll', data: p, timestamp: p.createdAt }))
    ]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);

    res.json({ activity });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// DATA EXPORT
// ═══════════════════════════════════════════════════════════════════════════

// Export data
router.get('/export', verifyAdmin, async (req, res, next) => {
  try {
    const type = req.query.type || 'events';
    const eventId = req.query.eventId;

    let data;
    let filter = eventId ? { eventId } : {};

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
        if (Invite) {
          data = await Invite.find(filter).lean();
        } else {
          data = [];
        }
        break;
      case 'all':
        // Export everything for an event
        if (!eventId) {
          return res.status(400).json({ error: 'Event ID required for full export' });
        }
        const [events, messages, polls, files, participants, invites] = await Promise.all([
          Event.findById(eventId).lean(),
          Message.find({ eventId, isDeleted: false }).lean(),
          Poll.find({ eventId }).lean(),
          File.find({ eventId, isDeleted: false }).lean(),
          EventParticipant.find({ eventId }).select('-password').lean(),
          Invite ? Invite.find({ eventId }).lean() : Promise.resolve([])
        ]);
        data = { event: events, messages, polls, files, participants, invites };
        break;
      default:
        return res.status(400).json({ error: 'Invalid export type' });
    }

    res.json({ data, exportedAt: new Date(), type });
  } catch (error) {
    next(error);
  }
});

// Export system statistics
router.get('/export/stats', verifyAdmin, async (req, res, next) => {
  try {
    const stats = await Promise.all([
      Event.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 }
          }
        }
      ]),
      Event.aggregate([
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: -1 } },
        { $limit: 12 }
      ]),
      Message.aggregate([
        { $match: { isDeleted: false } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 }
          }
        },
        { $sort: { _id: -1 } },
        { $limit: 30 }
      ])
    ]);

    res.json({
      eventsByStatus: stats[0],
      eventsByMonth: stats[1],
      messagesByDay: stats[2],
      generatedAt: new Date()
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN EVENT ACCESS - BYPASS PASSWORD
// ═══════════════════════════════════════════════════════════════════════════

// Generate admin access token for any event (bypasses password)
router.post('/events/:eventId/access', verifyAdmin, async (req, res, next) => {
  try {
    const { eventId } = req.params;
    
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Generate a special admin access token with elevated permissions
    const token = jwt.sign(
      { 
        eventId: event._id.toString(),
        username: 'ADMIN',
        role: 'admin_viewer',
        isAdminAccess: true,
        canBypassPassword: true
      },
      secrets.jwt,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      event: {
        _id: event._id,
        title: event.title,
        subdomain: event.subdomain,
        date: event.date,
        location: event.location,
        description: event.description,
        organizerName: event.organizerName,
        organizerEmail: event.organizerEmail,
        isPasswordProtected: event.isPasswordProtected,
        isEnterpriseMode: event.isEnterpriseMode,
        status: event.status,
        participants: event.participants,
        createdAt: event.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// MANUAL CLEANUP - Run the 7-day cleanup job on demand
// ═══════════════════════════════════════════════════════════════════════════

router.post('/cleanup', verifyAdmin, async (req, res, next) => {
  try {
    const { manualCleanup } = require('../jobs/cleanupJob');
    
    // Capture console output to return results to the admin
    const logs = [];
    const originalLog = console.log;
    const originalError = console.error;
    
    console.log = (...args) => {
      logs.push({ level: 'info', message: args.join(' ') });
      originalLog(...args);
    };
    console.error = (...args) => {
      logs.push({ level: 'error', message: args.join(' ') });
      originalError(...args);
    };

    await manualCleanup();

    console.log = originalLog;
    console.error = originalError;

    // Parse success/fail counts from logs
    const successLine = logs.find(l => l.message.includes('Successfully deleted:'));
    const failLine = logs.find(l => l.message.includes('Failed to delete:'));
    const successCount = successLine ? parseInt(successLine.message.match(/\d+/)?.[0] || '0') : 0;
    const failCount = failLine ? parseInt(failLine.message.match(/\d+/)?.[0] || '0') : 0;

    res.json({
      success: true,
      message: 'Manual cleanup completed',
      results: {
        deleted: successCount,
        failed: failCount,
        total: successCount + failCount,
      },
      logs: logs.map(l => l.message).filter(m => !m.includes('==='))
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
