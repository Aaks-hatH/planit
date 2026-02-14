const jwt = require('jsonwebtoken');
const Message = require('../models/Message');

module.exports = (io) => {
  // Middleware to authenticate socket connections
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (error) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.username} (${socket.id})`);

    // Join event room
    socket.on('join_event', (eventId) => {
      // Verify user has access to this event — compare as strings to avoid ObjectId mismatch
      if (socket.user.eventId.toString() !== eventId.toString()) {
        console.warn(`join_event rejected: token.eventId=${socket.user.eventId} !== requested=${eventId}`);
        socket.emit('error', { message: 'Unauthorized access to event' });
        return;
      }

      socket.join(`event_${eventId}`);
      console.log(`${socket.user.username} joined event ${eventId}`);

      // Notify others
      socket.to(`event_${eventId}`).emit('user_joined', {
        username: socket.user.username,
        timestamp: new Date()
      });

      // Send room info
      io.in(`event_${eventId}`).allSockets().then(sockets => {
        socket.emit('room_info', {
          participants: sockets.size
        });
      });
    });

    // Leave event room
    socket.on('leave_event', (eventId) => {
      socket.leave(`event_${eventId}`);
      console.log(`${socket.user.username} left event ${eventId}`);

      socket.to(`event_${eventId}`).emit('user_left', {
        username: socket.user.username,
        timestamp: new Date()
      });
    });

    // Send message
    socket.on('send_message', async (data) => {
      try {
        const { eventId, content } = data;

        // Verify access
        if (socket.user.eventId.toString() !== eventId.toString()) {
          socket.emit('error', { message: 'Unauthorized' });
          return;
        }

        // Validate content
        if (!content || content.trim().length === 0 || content.length > 5000) {
          socket.emit('error', { message: 'Invalid message content' });
          return;
        }

        // Save message
        const message = new Message({
          eventId,
          username: socket.user.username,
          content: content.trim(),
          type: 'text'
        });

        await message.save();

        // Broadcast to room
        io.to(`event_${eventId}`).emit('new_message', message);
      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Typing indicator
    socket.on('typing_start', (eventId) => {
      if (socket.user.eventId.toString() !== eventId.toString()) return;
      
      socket.to(`event_${eventId}`).emit('user_typing', {
        username: socket.user.username
      });
    });

    socket.on('typing_stop', (eventId) => {
      if (socket.user.eventId.toString() !== eventId.toString()) return;
      
      socket.to(`event_${eventId}`).emit('user_stopped_typing', {
        username: socket.user.username
      });
    });

    // Edit message
    socket.on('edit_message', async (data) => {
      try {
        const { eventId, messageId, content } = data;

        if (socket.user.eventId.toString() !== eventId.toString()) {
          socket.emit('error', { message: 'Unauthorized' });
          return;
        }

        const message = await Message.findOne({
          _id: messageId,
          eventId,
          username: socket.user.username
        });

        if (!message) {
          socket.emit('error', { message: 'Message not found or unauthorized' });
          return;
        }

        message.content = content;
        message.isEdited = true;
        message.editedAt = new Date();
        await message.save();

        io.to(`event_${eventId}`).emit('message_edited', message);
      } catch (error) {
        console.error('Error editing message:', error);
        socket.emit('error', { message: 'Failed to edit message' });
      }
    });

    // Delete message
    socket.on('delete_message', async (data) => {
      try {
        const { eventId, messageId } = data;

        if (socket.user.eventId.toString() !== eventId.toString()) {
          socket.emit('error', { message: 'Unauthorized' });
          return;
        }

        const message = await Message.findOne({
          _id: messageId,
          eventId
        });

        if (!message) {
          socket.emit('error', { message: 'Message not found' });
          return;
        }

        // Only author or organizer can delete
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

    // React to message
    socket.on('add_reaction', async (data) => {
      try {
        const { eventId, messageId, emoji } = data;

        if (socket.user.eventId.toString() !== eventId.toString()) {
          socket.emit('error', { message: 'Unauthorized' });
          return;
        }

        const message = await Message.findOne({ _id: messageId, eventId });

        if (!message) {
          socket.emit('error', { message: 'Message not found' });
          return;
        }

        await message.addReaction(emoji, socket.user.username);

        io.to(`event_${eventId}`).emit('reaction_added', {
          messageId,
          emoji,
          username: socket.user.username
        });
      } catch (error) {
        console.error('Error adding reaction:', error);
        socket.emit('error', { message: 'Failed to add reaction' });
      }
    });

    socket.on('remove_reaction', async (data) => {
      try {
        const { eventId, messageId, emoji } = data;

        if (socket.user.eventId.toString() !== eventId.toString()) {
          socket.emit('error', { message: 'Unauthorized' });
          return;
        }

        const message = await Message.findOne({ _id: messageId, eventId });

        if (!message) {
          socket.emit('error', { message: 'Message not found' });
          return;
        }

        await message.removeReaction(emoji, socket.user.username);

        io.to(`event_${eventId}`).emit('reaction_removed', {
          messageId,
          emoji,
          username: socket.user.username
        });
      } catch (error) {
        console.error('Error removing reaction:', error);
        socket.emit('error', { message: 'Failed to remove reaction' });
      }
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user.username} (${socket.id})`);
      
      // Notify all rooms this user was in
      const rooms = Array.from(socket.rooms).filter(room => room.startsWith('event_'));
      rooms.forEach(room => {
        socket.to(room).emit('user_disconnected', {
          username: socket.user.username,
          timestamp: new Date()
        });
      });
    });

    // Error handling
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });

  // Handle socket errors
  io.engine.on('connection_error', (err) => {
    console.error('Connection error:', err);
  });
};
