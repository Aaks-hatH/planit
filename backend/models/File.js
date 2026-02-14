const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  eventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true,
    index: true
  },
  uploadedBy: {
    type: String,
    required: true,
    trim: true
  },
  originalName: {
    type: String,
    required: true,
    trim: true
  },
  filename: {
    type: String,
    required: true
  },
  path: {
    type: String,
    required: true
  },
  mimetype: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  url: {
    type: String,
    required: true
  },
  metadata: {
    downloads: { type: Number, default: 0 },
    lastDownloaded: Date
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: Date
}, {
  timestamps: true
});

// Indexes
fileSchema.index({ eventId: 1, createdAt: -1 });
fileSchema.index({ eventId: 1, isDeleted: 1 });

// Virtual for file extension
fileSchema.virtual('extension').get(function() {
  return this.originalName.split('.').pop().toLowerCase();
});

// Virtual for human-readable size
fileSchema.virtual('readableSize').get(function() {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (this.size === 0) return '0 Bytes';
  const i = Math.floor(Math.log(this.size) / Math.log(1024));
  return Math.round(this.size / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
});

// Methods
fileSchema.methods.incrementDownloads = function() {
  this.metadata.downloads += 1;
  this.metadata.lastDownloaded = new Date();
  return this.save();
};

fileSchema.methods.softDelete = function() {
  this.isDeleted = true;
  this.deletedAt = new Date();
  return this.save();
};

// Statics
fileSchema.statics.getEventFiles = function(eventId) {
  return this.find({ 
    eventId, 
    isDeleted: false 
  })
  .sort({ createdAt: -1 })
  .exec();
};

fileSchema.statics.getTotalSize = function(eventId) {
  return this.aggregate([
    { $match: { eventId: mongoose.Types.ObjectId(eventId), isDeleted: false } },
    { $group: { _id: null, totalSize: { $sum: '$size' } } }
  ]);
};

module.exports = mongoose.model('File', fileSchema);
