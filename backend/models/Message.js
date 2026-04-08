const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true,
    index: true
  },
  username: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  content: {
    type: String,
    required: true,
    maxlength: 5000
  },
  type: {
    type: String,
    enum: ['text', 'system', 'file'],
    default: 'text'
  },
  metadata: {
    fileName: String,
    fileSize: Number,
    fileType: String,
    fileUrl: String
  },
  reactions: [{
    emoji: String,
    username: String,
    timestamp: { type: Date, default: Date.now }
  }],
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: Date,
  deletedAt: Date,
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes
messageSchema.index({ eventId: 1, createdAt: -1 });
messageSchema.index({ eventId: 1, isDeleted: 1, createdAt: -1 });

// Methods
messageSchema.methods.addReaction = function(emoji, username) {
  const existing = this.reactions.find(
    r => r.emoji === emoji && r.username === username
  );
  
  if (!existing) {
    this.reactions.push({ emoji, username });
  }
  return this.save();
};

messageSchema.methods.removeReaction = function(emoji, username) {
  this.reactions = this.reactions.filter(
    r => !(r.emoji === emoji && r.username === username)
  );
  return this.save();
};

messageSchema.methods.softDelete = function() {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.content = '[Message deleted]';
  return this.save();
};

// Statics
messageSchema.statics.getRecentMessages = function(eventId, limit = 50) {
  return this.find({ 
    eventId, 
    isDeleted: false 
  })
  .sort({ createdAt: -1 })
  .limit(limit)
  .exec();
};

module.exports = mongoose.model('Message', messageSchema);
