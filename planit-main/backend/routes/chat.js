const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Message = require('../models/Message');
const { verifyEventAccess } = require('../middleware/auth');
const { fireWebhooks } = require('./events');
const { chatLimiter } = require('../middleware/rateLimiter');

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Get messages for an event (cursor-paginated, newest page first)
// ?limit=<1-100, default 50>&before=<message _id>
// Uses an _id cursor so older pages are a single indexed range scan
// (no extra findById round-trip, no skip()).
router.get('/:eventId/messages', verifyEventAccess, async (req, res, next) => {
  try {
    const limit  = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);
    const before = req.query.before;

    const query = { eventId: req.params.eventId, isDeleted: false };
    if (before) {
      if (!mongoose.Types.ObjectId.isValid(before)) {
        return res.status(400).json({ error: 'Invalid cursor' });
      }
      query._id = { $lt: before };
    }

    // Fetch one extra row so hasMore is exact (no empty "load more" at the end)
    const rows = await Message.find(query)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .select('-__v -deletedAt')
      .lean();

    const hasMore = rows.length > limit;
    if (hasMore) rows.pop();

    res.json({ messages: rows.reverse(), hasMore });
  } catch (error) {
    next(error);
  }
});

// Post a message
router.post('/:eventId/messages',
  verifyEventAccess,
  chatLimiter,
  [
    body('content').trim().isLength({ min: 1, max: 5000 }).withMessage('Message must be 1-5000 characters'),
    body('username').trim().isLength({ min: 1, max: 100 }).withMessage('Username is required'),
    validate
  ],
  async (req, res, next) => {
    try {
      const { content, username } = req.body;

      const message = new Message({
        eventId: req.params.eventId,
        username,
        content,
        type: 'text'
      });

      await message.save();

      // Emit via Socket.IO (handled in socket handler)
      const io = req.app.get('io');
      if (io) {
        io.to(`event_${req.params.eventId}`).emit('new_message', message);
      }

      // Fire webhooks non-blocking
      fireWebhooks(req.params.eventId, 'message_sent', {
        username: message.username,
        message:  message.content,
        messageId: message._id.toString(),
      }).catch(() => {});

      res.status(201).json(message);
    } catch (error) {
      next(error);
    }
  }
);

// Edit a message
router.put('/:eventId/messages/:messageId',
  verifyEventAccess,
  [
    body('content').trim().isLength({ min: 1, max: 5000 }).withMessage('Message must be 1-5000 characters'),
    body('username').trim().notEmpty().withMessage('Username is required'),
    validate
  ],
  async (req, res, next) => {
    try {
      const message = await Message.findOne({
        _id: req.params.messageId,
        eventId: req.params.eventId
      });

      if (!message) {
        return res.status(404).json({ error: 'Message not found' });
      }

      // Only the author can edit
      if (message.username !== req.body.username) {
        return res.status(403).json({ error: 'You can only edit your own messages' });
      }

      message.content = req.body.content;
      message.isEdited = true;
      message.editedAt = new Date();
      await message.save();

      // Emit update via Socket.IO
      const io = req.app.get('io');
      if (io) {
        io.to(`event_${req.params.eventId}`).emit('message_edited', message);
      }

      res.json(message);
    } catch (error) {
      next(error);
    }
  }
);

// Delete a message
router.delete('/:eventId/messages/:messageId',
  verifyEventAccess,
  [
    body('username').trim().notEmpty().withMessage('Username is required'),
    validate
  ],
  async (req, res, next) => {
    try {
      const message = await Message.findOne({
        _id: req.params.messageId,
        eventId: req.params.eventId
      });

      if (!message) {
        return res.status(404).json({ error: 'Message not found' });
      }

      // Only the author or organizer can delete
      const event = req.event;
      const isOrganizer = event.participants.some(
        p => p.username === req.body.username && p.role === 'organizer'
      );

      if (message.username !== req.body.username && !isOrganizer) {
        return res.status(403).json({ error: 'You can only delete your own messages' });
      }

      await message.softDelete();

      // Emit deletion via Socket.IO
      const io = req.app.get('io');
      if (io) {
        io.to(`event_${req.params.eventId}`).emit('message_deleted', { 
          messageId: message._id 
        });
      }

      res.json({ message: 'Message deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
);

// Add reaction to message
router.post('/:eventId/messages/:messageId/reactions',
  verifyEventAccess,
  [
    body('emoji').trim().notEmpty().withMessage('Emoji is required'),
    body('username').trim().notEmpty().withMessage('Username is required'),
    validate
  ],
  async (req, res, next) => {
    try {
      const message = await Message.findOne({
        _id: req.params.messageId,
        eventId: req.params.eventId
      });

      if (!message) {
        return res.status(404).json({ error: 'Message not found' });
      }

      await message.addReaction(req.body.emoji, req.body.username);

      // Emit via Socket.IO
      const io = req.app.get('io');
      if (io) {
        io.to(`event_${req.params.eventId}`).emit('reaction_added', {
          messageId: message._id,
          emoji: req.body.emoji,
          username: req.body.username
        });
      }

      res.json(message);
    } catch (error) {
      next(error);
    }
  }
);

// Remove reaction from message
router.delete('/:eventId/messages/:messageId/reactions',
  verifyEventAccess,
  [
    body('emoji').trim().notEmpty().withMessage('Emoji is required'),
    body('username').trim().notEmpty().withMessage('Username is required'),
    validate
  ],
  async (req, res, next) => {
    try {
      const message = await Message.findOne({
        _id: req.params.messageId,
        eventId: req.params.eventId
      });

      if (!message) {
        return res.status(404).json({ error: 'Message not found' });
      }

      await message.removeReaction(req.body.emoji, req.body.username);

      // Emit via Socket.IO
      const io = req.app.get('io');
      if (io) {
        io.to(`event_${req.params.eventId}`).emit('reaction_removed', {
          messageId: message._id,
          emoji: req.body.emoji,
          username: req.body.username
        });
      }

      res.json(message);
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
