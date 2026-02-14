const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const Event = require('../models/Event');
const Message = require('../models/Message');
const Poll = require('../models/Poll');
const File = require('../models/File');
const EventParticipant = require('../models/EventParticipant');
const { verifyAdmin } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

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
        { username, isAdmin: true },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );

      res.json({
        message: 'Admin login successful',
        token
      });
    } catch (error) {
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

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

// Get all events with pagination
router.get('/events', verifyAdmin, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status) {
      filter.status = req.query.status;
    }
    if (req.query.search) {
      filter.$or = [
        { title: { $regex: req.query.search, $options: 'i' } },
        { subdomain: { $regex: req.query.search, $options: 'i' } },
        { organizerEmail: { $regex: req.query.search, $options: 'i' } }
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

// Get event details
router.get('/events/:eventId', verifyAdmin, async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.eventId);

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Get related statistics
    const [messageCount, pollCount, fileCount] = await Promise.all([
      Message.countDocuments({ eventId: event._id, isDeleted: false }),
      Poll.countDocuments({ eventId: event._id }),
      File.countDocuments({ eventId: event._id, isDeleted: false })
    ]);

    res.json({
      event,
      stats: {
        messages: messageCount,
        polls: pollCount,
        files: fileCount
      }
    });
  } catch (error) {
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

// Get recent activity
router.get('/activity', verifyAdmin, async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 20;

    // Get recent events, messages, and polls
    const [recentEvents, recentMessages, recentPolls] = await Promise.all([
      Event.find()
        .sort({ createdAt: -1 })
        .limit(limit)
        .select('title subdomain organizerName createdAt')
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

// Search across all data
router.get('/search', verifyAdmin, async (req, res, next) => {
  try {
    const query = req.query.q;
    if (!query || query.length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters' });
    }

    const regex = { $regex: query, $options: 'i' };

    const [events, messages, polls] = await Promise.all([
      Event.find({
        $or: [
          { title: regex },
          { subdomain: regex },
          { description: regex },
          { organizerName: regex },
          { organizerEmail: regex }
        ]
      }).limit(10).lean(),
      Message.find({
        content: regex,
        isDeleted: false
      })
      .limit(10)
      .populate('eventId', 'title subdomain')
      .lean(),
      Poll.find({ question: regex })
        .limit(10)
        .populate('eventId', 'title subdomain')
        .lean()
    ]);

    res.json({
      results: {
        events,
        messages,
        polls
      }
    });
  } catch (error) {
    next(error);
  }
});

// Export data
router.get('/export', verifyAdmin, async (req, res, next) => {
  try {
    const type = req.query.type || 'events';

    let data;
    switch (type) {
      case 'events':
        data = await Event.find().lean();
        break;
      case 'messages':
        data = await Message.find({ isDeleted: false }).lean();
        break;
      case 'polls':
        data = await Poll.find().lean();
        break;
      case 'files':
        data = await File.find({ isDeleted: false }).lean();
        break;
      default:
        return res.status(400).json({ error: 'Invalid export type' });
    }

    res.json({ data });
  } catch (error) {
    next(error);
  }
});

// Get all messages for an event
router.get('/events/:eventId/messages', verifyAdmin, async (req, res, next) => {
  try {
    const messages = await Message.find({ eventId: req.params.eventId, isDeleted: false })
      .sort({ createdAt: 1 })
      .lean();
    res.json({ messages });
  } catch (error) { next(error); }
});

// Delete a specific message
router.delete('/events/:eventId/messages/:messageId', verifyAdmin, async (req, res, next) => {
  try {
    await Message.findByIdAndUpdate(req.params.messageId, { isDeleted: true, deletedAt: new Date() });
    res.json({ message: 'Message deleted' });
  } catch (error) { next(error); }
});

// Get all participants for an event (with account info)
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
    await EventParticipant.deleteOne({ eventId: req.params.eventId, username: req.params.username });
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
    res.json({ message: 'Password reset' });
  } catch (error) { next(error); }
});

// Get all polls for an event
router.get('/events/:eventId/polls', verifyAdmin, async (req, res, next) => {
  try {
    const polls = await Poll.find({ eventId: req.params.eventId }).lean();
    res.json({ polls });
  } catch (error) { next(error); }
});

module.exports = router;
