const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  subdomain: {
    type: String, required: true, unique: true, lowercase: true, trim: true,
    match: /^[a-z0-9-]+$/, minlength: 3, maxlength: 50
  },
  title: { type: String, required: true, trim: true, maxlength: 200 },
  description: { type: String, trim: true, maxlength: 2000 },
  date: { type: Date, required: true },
  timezone: { type: String, required: true, default: 'UTC' },
  location: { type: String, trim: true, maxlength: 500 },
  organizerName: { type: String, required: true, trim: true, maxlength: 100 },
  organizerEmail: { type: String, required: true, trim: true, lowercase: true, match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ },
  password: { type: String, select: false },
  isPasswordProtected: { type: Boolean, default: false },
  maxParticipants: { type: Number, default: 100, min: 1, max: 1000000 },
  isEnterpriseMode: { type: Boolean, default: false },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // COMPREHENSIVE ENTERPRISE CHECK-IN SECURITY SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════
  checkinSettings: {
    // Basic Security
    requirePin:            { type: Boolean, default: false },
    requireCodeConfirm:    { type: Boolean, default: true  },
    blockCrossEvent:       { type: Boolean, default: true  },
    requireAttendeeCount:  { type: Boolean, default: false },
    
    // Rate Limiting & Lockout
    maxFailedAttempts:     { type: Number,  default: 3     },
    lockoutMinutes:        { type: Number,  default: 15    },
    allowManualOverride:   { type: Boolean, default: false },
    
    // Duplicate Detection
    enableDuplicateDetection: { type: Boolean, default: true },
    duplicateDetectionMode: { 
      type: String, 
      enum: ['strict', 'moderate', 'lenient'], 
      default: 'moderate' 
    }, // strict: name+email+phone, moderate: name+email OR name+phone, lenient: name only
    autoBlockDuplicates: { type: Boolean, default: false }, // Auto-block or just warn
    allowMultipleTickets: { type: Boolean, default: false }, // Allow same person with multiple valid tickets
    
    // Reentrancy Protection
    enableReentrancyProtection: { type: Boolean, default: true },
    checkInLockTimeout: { type: Number, default: 30 }, // seconds before lock expires
    
    // Suspicious Pattern Detection
    enablePatternDetection: { type: Boolean, default: true },
    rapidScanThreshold: { type: Number, default: 3 }, // Number of scans within time window
    rapidScanWindowSeconds: { type: Number, default: 10 }, // Time window for rapid scan detection
    multiDeviceThreshold: { type: Number, default: 3 }, // Different devices/IPs for same ticket
    
    // Geographic Security
    enableGeofencing: { type: Boolean, default: false },
    allowedRadius: { type: Number, default: 1000 }, // meters from venue
    venueLocation: {
      latitude: { type: Number },
      longitude: { type: Number },
    },
    
    // Trust Score Based Access
    enableTrustScore: { type: Boolean, default: true },
    minimumTrustScore: { type: Number, default: 50, min: 0, max: 100 },
    autoBlockLowTrust: { type: Boolean, default: false },
    
    // Time-Based Restrictions
    enableTimeRestrictions: { type: Boolean, default: false },
    checkInWindowStart: { type: Number, default: 120 }, // minutes before event
    checkInWindowEnd: { type: Number, default: 30 }, // minutes after event starts
    allowLateCheckIn: { type: Boolean, default: true },
    
    // Capacity Management
    enableCapacityLimits: { type: Boolean, default: false },
    maxTotalAttendees: { type: Number },
    maxSimultaneousCheckIns: { type: Number, default: 10 }, // Prevent stampede
    
    // Audit & Logging
    detailedAuditLogging: { type: Boolean, default: true },
    logIPAddresses: { type: Boolean, default: true },
    logDeviceInfo: { type: Boolean, default: true },
    logGeolocation: { type: Boolean, default: false },
    
    // Staff Notes & Instructions
    staffNote: { type: String, default: '' },
    securityInstructions: { type: String, default: '' },
    
    // Emergency Controls
    emergencyLockdown: { type: Boolean, default: false }, // Stop all check-ins immediately
    emergencyLockdownReason: { type: String },
    emergencyLockdownBy: { type: String },
    emergencyLockdownAt: { type: Date },
    
    // QR Code Security
    requireQRCodeRotation: { type: Boolean, default: false }, // Rotate QR codes periodically
    qrCodeExpiryMinutes: { type: Number, default: 0 }, // 0 = never expires
    
    // Photo Verification
    requirePhotoVerification: { type: Boolean, default: false },
    allowPhotoUpload: { type: Boolean, default: false },
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

  rsvps: [{
    username: { type: String, required: true },
    status: { type: String, enum: ['yes', 'maybe', 'no'], required: true },
    updatedAt: { type: Date, default: Date.now }
  }],

  agenda: [{
    id: { type: String, required: true },
    time: { type: String, trim: true, maxlength: 20 },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 500 },
    duration: { type: Number, default: 0 },
    order: { type: Number, default: 0 }
  }],

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

  announcements: [{
    id: { type: String, required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    content: { type: String, required: true, trim: true, maxlength: 2000 },
    author: { type: String, required: true },
    important: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
  }],

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
  },
  
  // ═══════════════════════════════════════════════════════════════════════════
  // DATA RETENTION & DELETION SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════
  dataRetentionDays: { type: Number, default: 30 }, // Days after event before deletion
  scheduledDeletionDate: { type: Date }, // Calculated: eventDate + retentionDays
  keepForever: { type: Boolean, default: false }, // Prevent automatic deletion
  deletionPostponedUntil: { type: Date }, // If organizer postponed deletion
  deletionPostponements: { type: Number, default: 0 }, // How many times postponed
  deletionWarnings: [{
    sentAt: { type: Date },
    daysUntilDeletion: { type: Number },
    emailSent: { type: Boolean, default: false },
  }],
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

eventSchema.methods.getTaskStats = function () {
  const total = this.tasks.length;
  const completed = this.tasks.filter(t => t.completed).length;
  const byPriority = { low: 0, medium: 0, high: 0 };
  this.tasks.forEach(t => byPriority[t.priority]++);
  return { total, completed, pending: total - completed, byPriority };
};

eventSchema.methods.getExpenseSummary = function () {
  const total = this.expenses.reduce((sum, e) => sum + e.amount, 0);
  const byCategory = {};
  this.expenses.forEach(e => {
    const cat = e.category || 'Uncategorized';
    byCategory[cat] = (byCategory[cat] || 0) + e.amount;
  });
  return { total, count: this.expenses.length, byCategory, remaining: this.budget - total };
};

eventSchema.methods.getAnalytics = function () {
  return {
    views: this.metadata.views,
    participants: this.participants.length,
    messages: 0,
    polls: 0,
    files: 0,
    rsvps: this.getRsvpSummary(),
    tasks: this.getTaskStats(),
    expenses: this.getExpenseSummary(),
    lastActivity: this.metadata.lastActivity
  };
};

module.exports = mongoose.model('Event', eventSchema);
