const mongoose = require('mongoose');

const timelineUpdateSchema = new mongoose.Schema({
  status: {
    type: String,
    enum: ['investigating', 'identified', 'monitoring', 'resolved'],
    required: true
  },
  message: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const incidentSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  severity: {
    type: String,
    enum: ['minor', 'major', 'critical'],
    default: 'minor'
  },
  status: {
    type: String,
    enum: ['investigating', 'identified', 'monitoring', 'resolved'],
    default: 'investigating'
  },
  affectedServices: [{ type: String }],
  timeline: [timelineUpdateSchema],
  resolvedAt: { type: Date, default: null },
  downtimeMinutes: { type: Number, default: null },
  reportIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'UptimeReport' }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

incidentSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('Incident', incidentSchema);