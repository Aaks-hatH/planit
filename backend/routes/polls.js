const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Poll = require('../models/Poll');
const { verifyEventAccess } = require('../middleware/auth');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

// Get all polls for an event
router.get('/:eventId', verifyEventAccess, async (req, res, next) => {
  try {
    const polls = await Poll.find({ eventId: req.params.eventId }).sort({ createdAt: -1 }).lean();
    res.json({ polls });
  } catch (error) {
    next(error);
  }
});

// Create a new poll — anyone in the event can create
router.post('/:eventId',
  verifyEventAccess,
  [
    body('question').trim().isLength({ min: 1, max: 500 }).withMessage('Question is required'),
    body('options').isArray({ min: 2, max: 10 }).withMessage('Must provide 2-10 options'),
    body('options.*').trim().isLength({ min: 1, max: 200 }).withMessage('Each option must be 1-200 characters'),
    // createdBy is now optional in body — falls back to token username
    validate
  ],
  async (req, res, next) => {
    try {
      const { question, options, settings } = req.body;
      // Get username from JWT decoded in verifyEventAccess
      const createdBy = req.eventAccess?.username || req.body.createdBy || 'anonymous';

      const poll = new Poll({
        eventId: req.params.eventId,
        createdBy,
        question,
        options: options.map(text => ({ text, votes: [] })),
        settings: settings || {}
      });

      await poll.save();

      const io = req.app.get('io');
      if (io) io.to(`event_${req.params.eventId}`).emit('poll_created', poll);

      res.status(201).json(poll);
    } catch (error) {
      next(error);
    }
  }
);

// Vote on a poll — frontend sends { option: index, username }
router.post('/:eventId/polls/:pollId/vote',
  verifyEventAccess,
  [
    // Accept both 'option' and 'optionIndex' for compatibility
    body('option').optional().isInt({ min: 0 }).withMessage('Valid option index is required'),
    body('optionIndex').optional().isInt({ min: 0 }).withMessage('Valid option index is required'),
    body('username').trim().notEmpty().withMessage('Username is required'),
    validate
  ],
  async (req, res, next) => {
    try {
      // Normalise: accept either field name
      const optionIndex = req.body.option ?? req.body.optionIndex;
      if (optionIndex === undefined || optionIndex === null) {
        return res.status(400).json({ error: 'Option index is required' });
      }

      const poll = await Poll.findOne({ _id: req.params.pollId, eventId: req.params.eventId });
      if (!poll) return res.status(404).json({ error: 'Poll not found' });

      await poll.vote(parseInt(optionIndex), req.body.username);

      const io = req.app.get('io');
      if (io) io.to(`event_${req.params.eventId}`).emit('poll_updated', poll);

      res.json({ message: 'Vote recorded', poll, results: poll.getResults() });
    } catch (error) {
      if (['Poll is closed', 'Poll deadline has passed', 'You have already voted', 'Invalid option'].includes(error.message)) {
        return res.status(400).json({ error: error.message });
      }
      next(error);
    }
  }
);

// Get poll results
router.get('/:eventId/polls/:pollId/results', verifyEventAccess, async (req, res, next) => {
  try {
    const poll = await Poll.findOne({ _id: req.params.pollId, eventId: req.params.eventId });
    if (!poll) return res.status(404).json({ error: 'Poll not found' });

    res.json({ results: poll.getResults(), totalVotes: poll.totalVotes, status: poll.status });
  } catch (error) {
    next(error);
  }
});

// Close a poll
router.post('/:eventId/polls/:pollId/close',
  verifyEventAccess,
  [body('username').trim().notEmpty().withMessage('Username is required'), validate],
  async (req, res, next) => {
    try {
      const poll = await Poll.findOne({ _id: req.params.pollId, eventId: req.params.eventId });
      if (!poll) return res.status(404).json({ error: 'Poll not found' });

      const event = req.event;
      const isOrganizer = event.participants.some(p => p.username === req.body.username && p.role === 'organizer');

      if (poll.createdBy !== req.body.username && !isOrganizer) {
        return res.status(403).json({ error: 'Only the poll creator or event organizer can close this poll' });
      }

      await poll.close();

      const io = req.app.get('io');
      if (io) io.to(`event_${req.params.eventId}`).emit('poll_updated', poll);

      res.json({ message: 'Poll closed', poll, results: poll.getResults() });
    } catch (error) {
      next(error);
    }
  }
);

// Delete a poll
router.delete('/:eventId/polls/:pollId',
  verifyEventAccess,
  [body('username').trim().notEmpty().withMessage('Username is required'), validate],
  async (req, res, next) => {
    try {
      const poll = await Poll.findOne({ _id: req.params.pollId, eventId: req.params.eventId });
      if (!poll) return res.status(404).json({ error: 'Poll not found' });

      const event = req.event;
      const isOrganizer = event.participants.some(p => p.username === req.body.username && p.role === 'organizer');

      if (poll.createdBy !== req.body.username && !isOrganizer) {
        return res.status(403).json({ error: 'Only the poll creator or organizer can delete this poll' });
      }

      await Poll.findByIdAndDelete(poll._id);

      const io = req.app.get('io');
      if (io) io.to(`event_${req.params.eventId}`).emit('poll_deleted', { pollId: poll._id });

      res.json({ message: 'Poll deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
