const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Message = require('../models/Message');
const { verifyEventAccess } = require('../middleware/auth');
const { chatLimiter } = require('../middleware/rateLimiter');

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Get messages for an event
router.get('/:eventId/messages', verifyEventAccess, async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const before = req.query.before; // Message ID for pagination

    let query = { 
      eventId: req.params.eventId,
      isDeleted: false
    };

    if (before) {
      const beforeMessage = await Message.findById(before);
      if (beforeMessage) {
        query.createdAt = { $lt: beforeMessage.createdAt };
      }
    }

    const messages = await Message.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json({
      messages: messages.reverse(),
      hasMore: messages.length === limit
    });
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
