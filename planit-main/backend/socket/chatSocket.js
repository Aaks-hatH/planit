const jwt = require('jsonwebtoken');
const { secrets } = require('../keys');
const Message = require('../models/Message');

// ─────────────────────────────────────────────────────────────────────────────
// SOCKET-LEVEL RATE LIMITER
// express-rate-limit only applies to HTTP routes.  Chat messages travel over
// the WebSocket connection (Socket.IO "send_message" events), so they bypass
// every HTTP middleware.  This in-memory limiter runs directly inside the
// socket event handlers where it can actually intercept the traffic.
//
// Design: sliding-window per socket.id
//   • Stores an array of timestamps for each socket
//   • On every message, prunes entries older than WINDOW_MS
//   • Rejects the event if the remaining count >= MAX_MESSAGES
//   • Emits a structured "rate_limited" event so the client can show a toast
//   • Cleans up the Map entry when the socket disconnects
// ─────────────────────────────────────────────────────────────────────────────

const WINDOW_MS    = 60 * 1000; // 1-minute rolling window
const MAX_MESSAGES = 30;        // max messages per socket per window
const WARN_AT      = 25;        // warn the user when getting close

// socketId → array of message timestamps (milliseconds)
const messageTimestamps = new Map();

/**
 * Returns { allowed, remaining, resetInMs }
 * Mutates the timestamps Map as a side-effect (prune + push).
 */
function checkSocketRateLimit(socketId) {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;

  // Get or initialise the window for this socket
  let timestamps = messageTimestamps.get(socketId) || [];

  // Prune timestamps outside the rolling window
  timestamps = timestamps.filter(ts => ts > cutoff);

  if (timestamps.length >= MAX_MESSAGES) {
    // Do NOT push — reject before recording
    messageTimestamps.set(socketId, timestamps);
    const oldestInWindow = timestamps[0];
    return {
      allowed:   false,
      remaining: 0,
      resetInMs: oldestInWindow + WINDOW_MS - now,
    };
  }

  // Allow and record
  timestamps.push(now);
  messageTimestamps.set(socketId, timestamps);

  return {
    allowed:   true,
    remaining: MAX_MESSAGES - timestamps.length,
    resetInMs: WINDOW_MS,
  };
}

// ─────────────────────────────────────────────────────────────────────────────

module.exports = (io) => {
  // Authenticate every socket connection via JWT
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;

    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    try {
      const decoded = jwt.verify(token, secrets.jwt);
      socket.user = decoded;
      next();
    } catch (error) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.username} (${socket.id})`);

    // Initialise a clean rate-limit window for this socket
    messageTimestamps.set(socket.id, []);

    // ── Join event room ──────────────────────────────────────────────────────
    socket.on('join_event', (eventId) => {
      const isAdminAccess = socket.user.isAdminAccess === true;

      if (!isAdminAccess && socket.user.eventId.toString() !== eventId.toString()) {
        console.warn(`join_event rejected: token.eventId=${socket.user.eventId} !== requested=${eventId}`);
        socket.emit('error', { message: 'Unauthorized access to event' });
        return;
      }

      socket.join(`event_${eventId}`);
      console.log(`${socket.user.username}${isAdminAccess ? ' (ADMIN)' : ''} joined event ${eventId}`);

      socket.to(`event_${eventId}`).emit('user_joined', {
        username:  socket.user.username,
        timestamp: new Date(),
      });

      io.in(`event_${eventId}`).allSockets().then(sockets => {
        socket.emit('room_info', { participants: sockets.size });
      });
    });

    // ── Leave event room ─────────────────────────────────────────────────────
    socket.on('leave_event', (eventId) => {
      socket.leave(`event_${eventId}`);
      console.log(`${socket.user.username} left event ${eventId}`);

      socket.to(`event_${eventId}`).emit('user_left', {
        username:  socket.user.username,
        timestamp: new Date(),
      });
    });

    // ── Send message (rate-limited) ──────────────────────────────────────────
    socket.on('send_message', async (data) => {
      try {
        const { eventId, content } = data;
        const isAdminAccess = socket.user.isAdminAccess === true;

        // Auth check
        if (!isAdminAccess && socket.user.eventId.toString() !== eventId.toString()) {
          socket.emit('error', { message: 'Unauthorized' });
          return;
        }

        // ── Rate limit check ─────────────────────────────────────────────────
        const limit = checkSocketRateLimit(socket.id);

        if (!limit.allowed) {
          const retryAfterSec = Math.ceil(limit.resetInMs / 1000);
          socket.emit('rate_limited', {
            message: `Too many messages. Slow down — try again in ${retryAfterSec}s.`,
            retryAfterMs: limit.resetInMs,
          });
          console.warn(
            `Rate limit hit: ${socket.user.username} (${socket.id}) — ` +
            `retry in ${retryAfterSec}s`
          );
          return; // Drop the message entirely — do NOT save or broadcast
        }

        // Warn the user when they are approaching the limit
        if (limit.remaining <= MAX_MESSAGES - WARN_AT) {
          socket.emit('rate_limit_warning', {
            message: `Slow down — you can send ${limit.remaining} more message${limit.remaining === 1 ? '' : 's'} in this minute.`,
            remaining: limit.remaining,
          });
        }
        // ────────────────────────────────────────────────────────────────────

        // Validate content
        if (!content || content.trim().length === 0 || content.length > 5000) {
          socket.emit('error', { message: 'Invalid message content' });
          return;
        }

        // Save and broadcast
        const message = new Message({
          eventId,
          username: socket.user.username,
          content:  content.trim(),
          type:     'text',
        });

        await message.save();
        io.to(`event_${eventId}`).emit('new_message', message);

      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // ── Typing indicators ────────────────────────────────────────────────────
    socket.on('typing_start', (eventId) => {
      const isAdminAccess = socket.user.isAdminAccess === true;
      if (!isAdminAccess && socket.user.eventId.toString() !== eventId.toString()) return;
      socket.to(`event_${eventId}`).emit('user_typing', { username: socket.user.username });
    });

    socket.on('typing_stop', (eventId) => {
      const isAdminAccess = socket.user.isAdminAccess === true;
      if (!isAdminAccess && socket.user.eventId.toString() !== eventId.toString()) return;
      socket.to(`event_${eventId}`).emit('user_stopped_typing', { username: socket.user.username });
    });

    // ── Edit message ─────────────────────────────────────────────────────────
    socket.on('edit_message', async (data) => {
      try {
        const { eventId, messageId, content } = data;
        const isAdminAccess = socket.user.isAdminAccess === true;

        if (!isAdminAccess && socket.user.eventId.toString() !== eventId.toString()) {
          socket.emit('error', { message: 'Unauthorized' });
          return;
        }

        const message = await Message.findOne({
          _id:      messageId,
          eventId,
          username: socket.user.username,
        });

        if (!message) {
          socket.emit('error', { message: 'Message not found or unauthorized' });
          return;
        }

        message.content  = content;
        message.isEdited = true;
        message.editedAt = new Date();
        await message.save();

        io.to(`event_${eventId}`).emit('message_edited', message);

      } catch (error) {
        console.error('Error editing message:', error);
        socket.emit('error', { message: 'Failed to edit message' });
      }
    });

    // ── Delete message ───────────────────────────────────────────────────────
    socket.on('delete_message', async (data) => {
      try {
        const { eventId, messageId } = data;
        const isAdminAccess = socket.user.isAdminAccess === true;

        if (!isAdminAccess && socket.user.eventId.toString() !== eventId.toString()) {
          socket.emit('error', { message: 'Unauthorized' });
          return;
        }

        const message = await Message.findOne({ _id: messageId, eventId });

        if (!message) {
          socket.emit('error', { message: 'Message not found' });
          return;
        }

        if (message.username !== socket.user.username && socket.user.role !== 'organizer') {
          socket.emit('error', { message: 'Unauthorized to delete this message' });
          return;
        }

        await message.softDelete();
        io.to(`event_${eventId}`).emit('message_deleted', { messageId });

      } catch (error) {
        console.error('Error deleting message:', error);
        socket.emit('error', { message: 'Failed to delete message' });
      }
    });

    // ── Reactions ────────────────────────────────────────────────────────────
    socket.on('add_reaction', async (data) => {
      try {
        const { eventId, messageId, emoji } = data;
        const isAdminAccess = socket.user.isAdminAccess === true;

        if (!isAdminAccess && socket.user.eventId.toString() !== eventId.toString()) {
          socket.emit('error', { message: 'Unauthorized' });
          return;
        }

        const message = await Message.findOne({ _id: messageId, eventId });
        if (!message) { socket.emit('error', { message: 'Message not found' }); return; }

        await message.addReaction(emoji, socket.user.username);

        io.to(`event_${eventId}`).emit('reaction_added', {
          messageId,
          emoji,
          username: socket.user.username,
        });

      } catch (error) {
        console.error('Error adding reaction:', error);
        socket.emit('error', { message: 'Failed to add reaction' });
      }
    });

    socket.on('remove_reaction', async (data) => {
      try {
        const { eventId, messageId, emoji } = data;
        const isAdminAccess = socket.user.isAdminAccess === true;

        if (!isAdminAccess && socket.user.eventId.toString() !== eventId.toString()) {
          socket.emit('error', { message: 'Unauthorized' });
          return;
        }

        const message = await Message.findOne({ _id: messageId, eventId });
        if (!message) { socket.emit('error', { message: 'Message not found' }); return; }

        await message.removeReaction(emoji, socket.user.username);

        io.to(`event_${eventId}`).emit('reaction_removed', {
          messageId,
          emoji,
          username: socket.user.username,
        });

      } catch (error) {
        console.error('Error removing reaction:', error);
        socket.emit('error', { message: 'Failed to remove reaction' });
      }
    });

    // ── Disconnect — clean up rate-limit state ───────────────────────────────
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user.username} (${socket.id})`);

      // Free memory — no need to keep timestamps for dead sockets
      messageTimestamps.delete(socket.id);

      const rooms = Array.from(socket.rooms).filter(r => r.startsWith('event_'));
      rooms.forEach(room => {
        socket.to(room).emit('user_disconnected', {
          username:  socket.user.username,
          timestamp: new Date(),
        });
      });
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });

  io.engine.on('connection_error', (err) => {
    console.error('Connection error:', err);
  });
};
