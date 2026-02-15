const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  subdomain: {
    type: String, required: true, unique: true, lowercase: true, trim: true,
    match: /^[a-z0-9-]+$/, minlength: 3, maxlength: 50
  },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, trim: true, maxlength: 2000 },
  date: { type: Date, required: true },
  // Store the timezone identifier (e.g., 'America/New_York', 'Europe/London', 'UTC')
  timezone: { type: String, required: true, default: 'UTC' },
  location: { type: String, trim: true, maxlength: 500 },
  organizerName: { type: String, required: true, trim: true, maxlength: 100 },
  organizerEmail: { type: String, required: true, trim: true, lowercase: true, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  password: { type: String, select: false },
  isPasswordProtected: { type: Boolean, default: false },
  maxParticipants: { type: Number, default: 100, min: 1, max: 1000000 },
  isEnterpriseMode: { type: Boolean, default: false },
  checkinSettings: {
    requirePin:            { type: Boolean, default: false },
    requireCodeConfirm:    { type: Boolean, default: true  },
    blockCrossEvent:       { type: Boolean, default: true  },
    maxFailedAttempts:     { type: Number,  default: 3     },
    lockoutMinutes:        { type: Number,  default: 15    },
    allowManualOverride:   { type: Boolean, default: false },
    requireAttendeeCount:  { type: Boolean, default: false }, // FIXED: Added new setting for attendee verification
    staffNote:             { type: String,  default: '' },
  },
  settings: {
    allowChat: { type: Boolean, default: true },
    allowPolls: { type: Boolean, default: true },
    allowFileSharing: { type: Boolean, default: true },
    requireApproval: { type: Boolean, default: false },
    isPublic: { type: Boolean, default: false }
  },
  participants: [{
    username: { type: String, required: true },
    joinedAt: { type: Date, default: Date.now },
    role: { type: String, enum: ['organizer', 'participant'], default: 'participant' }
  }],

  // ── RSVP ──────────────────────────────────────────────────────────────────
  rsvps: [{
    username: { type: String, required: true },
    status: { type: String, enum: ['yes', 'maybe', 'no'], required: true },
    updatedAt: { type: Date, default: Date.now }
  }],

  // ── Agenda ────────────────────────────────────────────────────────────────
  agenda: [{
    id: { type: String, required: true },
    time: { type: String, trim: true, maxlength: 20 },   // e.g. "9:00 AM"
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 500 },
    duration: { type: Number, default: 0 },               // minutes
    order: { type: Number, default: 0 }
  }],

  // ── Tasks/Checklist ───────────────────────────────────────────────────────
  tasks: [{
    id: { type: String, required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 500 },
    completed: { type: Boolean, default: false },
    assignedTo: { type: String, trim: true, maxlength: 100 },
    dueDate: { type: Date },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    createdBy: { type: String, required: true },
    completedBy: { type: String },
    completedAt: { type: Date },
    createdAt: { type: Date, default: Date.now }
  }],

  // ── Announcements ─────────────────────────────────────────────────────────
  announcements: [{
    id: { type: String, required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    content: { type: String, required: true, trim: true, maxlength: 2000 },
    author: { type: String, required: true },
    important: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
  }],

  // ── Expenses/Budget ───────────────────────────────────────────────────────
  expenses: [{
    id: { type: String, required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    amount: { type: Number, required: true, min: 0 },
    category: { type: String, trim: true, maxlength: 100 },
    paidBy: { type: String, trim: true, maxlength: 100 },
    notes: { type: String, trim: true, maxlength: 500 },
    date: { type: Date, default: Date.now },
    createdBy: { type: String, required: true }
  }],
  budget: { type: Number, default: 0 },

  // ── Notes ─────────────────────────────────────────────────────────────────
  notes: [{
    id: { type: String, required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    content: { type: String, required: true, trim: true, maxlength: 5000 },
    author: { type: String, required: true },
    color: { type: String, default: '#fef3c7' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  }],

  status: { type: String, enum: ['draft', 'active', 'completed', 'cancelled'], default: 'active' },
  metadata: {
    views: { type: Number, default: 0 },
    lastActivity: { type: Date, default: Date.now }
  }
}, { timestamps: true });

eventSchema.index({ subdomain: 1 });
eventSchema.index({ organizerEmail: 1 });
eventSchema.index({ createdAt: -1 });

eventSchema.methods.incrementViews = function () {
  this.metadata.views += 1;
  this.metadata.lastActivity = new Date();
  return this.save();
};

eventSchema.methods.addParticipant = function (username, role = 'participant') {
  if (this.participants.length >= this.maxParticipants) throw new Error('Event is full');
  const exists = this.participants.some(p => p.username === username);
  if (!exists) {
    this.participants.push({ username, role });
    this.metadata.lastActivity = new Date();
  }
  return this.save();
};

eventSchema.methods.removeParticipant = function (username) {
  this.participants = this.participants.filter(p => p.username !== username);
  this.metadata.lastActivity = new Date();
  return this.save();
};

// RSVP methods
eventSchema.methods.setRsvp = function (username, status) {
  const existing = this.rsvps.find(r => r.username === username);
  if (existing) {
    existing.status = status;
    existing.updatedAt = new Date();
  } else {
    this.rsvps.push({ username, status });
  }
  return this.save();
};

eventSchema.methods.getRsvpSummary = function () {
  const counts = { yes: 0, maybe: 0, no: 0 };
  this.rsvps.forEach(r => counts[r.status]++);
  return counts;
};

// Task methods
eventSchema.methods.getTaskStats = function () {
  const total = this.tasks.length;
  const completed = this.tasks.filter(t => t.completed).length;
  const byPriority = { low: 0, medium: 0, high: 0 };
  this.tasks.forEach(t => byPriority[t.priority]++);
  return { total, completed, pending: total - completed, byPriority };
};

// Expense methods
eventSchema.methods.getExpenseSummary = function () {
  const total = this.expenses.reduce((sum, e) => sum + e.amount, 0);
  const byCategory = {};
  this.expenses.forEach(e => {
    const cat = e.category || 'Uncategorized';
    byCategory[cat] = (byCategory[cat] || 0) + e.amount;
  });
  return { total, count: this.expenses.length, byCategory, remaining: this.budget - total };
};

// Analytics methods
eventSchema.methods.getAnalytics = function () {
  return {
    views: this.metadata.views,
    participants: this.participants.length,
    messages: 0, // Would need to query Message model
    polls: 0, // Would need to query Poll model
    files: 0, // Would need to query File model
    rsvps: this.getRsvpSummary(),
    tasks: this.getTaskStats(),
    expenses: this.getExpenseSummary(),
    lastActivity: this.metadata.lastActivity
  };
};

module.exports = mongoose.model('Event', eventSchema);
