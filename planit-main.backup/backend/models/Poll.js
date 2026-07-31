const mongoose = require('mongoose');

const pollSchema = new mongoose.Schema({
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true,
    index: true
  },
  createdBy: {
    type: String,
    required: true,
    trim: true
  },
  question: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  options: [{
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200
    },
    votes: [{
      username: String,
      timestamp: { type: Date, default: Date.now }
    }]
  }],
  settings: {
    allowMultipleVotes: { type: Boolean, default: false },
    showResults: { type: Boolean, default: true },
    anonymous: { type: Boolean, default: false },
    deadline: Date
  },
  status: {
    type: String,
    enum: ['active', 'closed'],
    default: 'active'
  }
}, {
  timestamps: true
});

// Indexes
pollSchema.index({ eventId: 1, createdAt: -1 });
pollSchema.index({ eventId: 1, status: 1 });

// Virtual for total votes
pollSchema.virtual('totalVotes').get(function() {
  return this.options.reduce((sum, option) => sum + option.votes.length, 0);
});

// Methods
pollSchema.methods.vote = function(optionIndex, username) {
  if (this.status === 'closed') {
    throw new Error('Poll is closed');
  }

  if (this.settings.deadline && new Date() > this.settings.deadline) {
    this.status = 'closed';
    this.save();
    throw new Error('Poll deadline has passed');
  }

  // Check if user already voted
  const hasVoted = this.options.some(option =>
    option.votes.some(vote => vote.username === username)
  );

  if (hasVoted && !this.settings.allowMultipleVotes) {
    throw new Error('You have already voted');
  }

  // Remove previous votes if not allowing multiple
  if (!this.settings.allowMultipleVotes) {
    this.options.forEach(option => {
      option.votes = option.votes.filter(vote => vote.username !== username);
    });
  }

  // Add new vote
  if (optionIndex >= 0 && optionIndex < this.options.length) {
    this.options[optionIndex].votes.push({ username });
  } else {
    throw new Error('Invalid option');
  }

  return this.save();
};

pollSchema.methods.close = function() {
  this.status = 'closed';
  return this.save();
};

pollSchema.methods.getResults = function() {
  return this.options.map((option, index) => ({
    index,
    text: option.text,
    votes: option.votes.length,
    percentage: this.totalVotes > 0 
      ? ((option.votes.length / this.totalVotes) * 100).toFixed(1)
      : 0,
    voters: this.settings.anonymous ? [] : option.votes.map(v => v.username)
  }));
};

// Statics
pollSchema.statics.getActivePolls = function(eventId) {
  return this.find({ 
    eventId, 
    status: 'active' 
  })
  .sort({ createdAt: -1 })
  .exec();
};

module.exports = mongoose.model('Poll', pollSchema);
