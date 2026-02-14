import { io } from 'socket.io-client';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:5000';

class SocketService {
  constructor() {
    this.socket = null;
    this.connected = false;
    this._currentEventId = null;
    this._currentToken = null;
  }

  connect(token) {
    if (this.socket?.connected) {
      return this.socket;
    }

    this._currentToken = token;

    this.socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    });

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket.id);
      this.connected = true;
      // Rejoin event room automatically after reconnect
      if (this._currentEventId) {
        this.socket.emit('join_event', this._currentEventId);
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      this.connected = false;
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });

    this.socket.on('connect_error', (error) => {
      console.error('Connection error:', error.message);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
    }
  }

  joinEvent(eventId) {
    this._currentEventId = eventId;
    if (this.socket?.connected) {
      this.socket.emit('join_event', eventId);
    }
  }

  leaveEvent(eventId) {
    this._currentEventId = null;
    if (this.socket?.connected) {
      this.socket.emit('leave_event', eventId);
    }
  }

  sendMessage(eventId, content) {
    if (this.socket?.connected) {
      this.socket.emit('send_message', { eventId, content });
    }
  }

  editMessage(eventId, messageId, content) {
    if (this.socket?.connected) {
      this.socket.emit('edit_message', { eventId, messageId, content });
    }
  }

  deleteMessage(eventId, messageId) {
    if (this.socket?.connected) {
      this.socket.emit('delete_message', { eventId, messageId });
    }
  }

  startTyping(eventId) {
    if (this.socket?.connected) {
      this.socket.emit('typing_start', eventId);
    }
  }

  stopTyping(eventId) {
    if (this.socket?.connected) {
      this.socket.emit('typing_stop', eventId);
    }
  }

  addReaction(eventId, messageId, emoji) {
    if (this.socket?.connected) {
      this.socket.emit('add_reaction', { eventId, messageId, emoji });
    }
  }

  removeReaction(eventId, messageId, emoji) {
    if (this.socket?.connected) {
      this.socket.emit('remove_reaction', { eventId, messageId, emoji });
    }
  }

  on(event, callback) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event, callback) {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }

  isConnected() {
    return this.connected && this.socket?.connected;
  }
}

const socketService = new SocketService();

export default socketService;
