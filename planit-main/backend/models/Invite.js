const mongoose = require('mongoose');

const inviteSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  inviteCode: { type: String, required: true, unique: true },
  guestName: { type: String, required: true, trim: true },
  guestEmail: { type: String, trim: true },
  guestPhone: { type: String, trim: true },

  // Group composition — set by organizer, shown to staff at scan
  adults:    { type: Number, default: 1, min: 0 },
  children:  { type: Number, default: 0, min: 0 },
  groupSize: { type: Number, default: 1, min: 1 },

  actualAttendees: { type: Number, default: 0 },
  plusOnes:        { type: Number, default: 0 },

  // Optional per-guest security PIN that staff must confirm at check-in
  securityPin: { type: String, trim: true, default: '' },

  checkedIn:   { type: Boolean, default: false },
  checkedInAt: { type: Date },
  checkedInBy: { type: String },

  notes:  { type: String, trim: true, maxlength: 500 },
  status: { type: String, enum: ['pending', 'confirmed', 'declined', 'checked-in', 'blocked'], default: 'pending' },

  // ═══════════════════════════════════════════════════════════════════════════
  // ANTI-FRAUD & SECURITY FEATURES
  // ═══════════════════════════════════════════════════════════════════════════

  // Duplicate Detection - prevent same person with multiple tickets
  duplicateCheckFingerprint: { type: String, index: true }, // Hash of name+email+phone
  markedAsDuplicate: { type: Boolean, default: false },
  duplicateOf: { type: mongoose.Schema.Types.ObjectId, ref: 'Invite' }, // Reference to original invite

  // Reentrancy Protection - prevent simultaneous check-in attempts
  checkInLock: {
    isLocked: { type: Boolean, default: false },
    lockedAt: { type: Date },
    lockedBy: { type: String }, // Staff member who initiated check-in
    sessionId: { type: String }, // Unique session identifier
  },

  // Rate Limiting & Suspicious Activity
  scanAttempts: [{
    attemptedAt: { type: Date, default: Date.now },
    reason:      { type: String }, // 'wrong_event', 'already_checked_in', 'wrong_pin', 'duplicate', 'too_many_attempts', 'suspicious_pattern'
    attemptedBy: { type: String },
    ipAddress:   { type: String },
    deviceInfo:  { type: String }, // User agent or device fingerprint
    location:    { type: String }, // Geolocation if available
  }],

  // Blocking & Lockout
  isBlocked: { type: Boolean, default: false },
  blockedReason: { type: String }, // 'too_many_attempts', 'fraudulent_activity', 'manual_block', 'duplicate_detected'
  blockedAt: { type: Date },
  blockedBy: { type: String },
  blockedUntil: { type: Date }, // Temporary block expiration

  // Security Alerts
  securityFlags: [{
    flag: { type: String }, // 'rapid_scans', 'multiple_devices', 'cross_event_attempt', 'suspicious_pattern'
    flaggedAt: { type: Date, default: Date.now },
    severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    autoResolved: { type: Boolean, default: false },
    resolvedAt: { type: Date },
    resolvedBy: { type: String },
    notes: { type: String },
  }],

  // Verification History - track all successful check-ins and reversals
  checkInHistory: [{
    checkedInAt: { type: Date },
    checkedInBy: { type: String },
    actualAttendees: { type: Number },
    reversed: { type: Boolean, default: false },
    reversedAt: { type: Date },
    reversedBy: { type: String },
    reversalReason: { type: String },
    // Manager Override Tracking
    overrideUsed: { type: Boolean, default: false },
    overrideBy: { type: String }, // Manager who authorized override
    overrideReason: { type: String }, // Why override was needed
    originalBlockReason: { type: String }, // What was being overridden
  }],

  // Trust Score - calculated based on behavior patterns (0-100)
  trustScore: { type: Number, default: 100, min: 0, max: 100 },
  
  // Last scan metadata for pattern detection
  lastScanMetadata: {
    scannedAt: { type: Date },
    ipAddress: { type: String },
    deviceInfo: { type: String },
    location: { type: String },
  },

}, { timestamps: true });

// Indexes for performance and fraud detection
inviteSchema.index({ eventId: 1, inviteCode: 1 });
inviteSchema.index({ inviteCode: 1 });
inviteSchema.index({ duplicateCheckFingerprint: 1, eventId: 1 });
inviteSchema.index({ isBlocked: 1, eventId: 1 });
inviteSchema.index({ 'checkInLock.isLocked': 1 });
inviteSchema.index({ trustScore: 1 });

// Virtual for active lockout status
inviteSchema.virtual('isCurrentlyBlocked').get(function() {
  if (!this.isBlocked) return false;
  if (!this.blockedUntil) return true; // Permanent block
  return new Date() < this.blockedUntil;
});

// Method to generate duplicate check fingerprint
inviteSchema.methods.generateDuplicateFingerprint = function() {
  const crypto = require('crypto');
  const data = [
    (this.guestName || '').toLowerCase().trim(),
    (this.guestEmail || '').toLowerCase().trim(),
    (this.guestPhone || '').replace(/\D/g, '') // Remove non-digits
  ].filter(Boolean).join('|');
  
  if (!data) return null;
  return crypto.createHash('sha256').update(data).digest('hex');
};

// Method to acquire check-in lock (reentrancy protection)
inviteSchema.methods.acquireCheckInLock = async function(staffUser, sessionId) {
  // Check if already locked
  if (this.checkInLock.isLocked) {
    // If locked by same session, allow
    if (this.checkInLock.sessionId === sessionId) {
      return true;
    }
    
    // Check if lock is stale (older than 30 seconds)
    const lockAge = Date.now() - new Date(this.checkInLock.lockedAt).getTime();
    if (lockAge > 30000) {
      // Release stale lock and acquire new one
      this.checkInLock.isLocked = true;
      this.checkInLock.lockedAt = new Date();
      this.checkInLock.lockedBy = staffUser;
      this.checkInLock.sessionId = sessionId;
      await this.save();
      return true;
    }
    
    // Lock held by another active session
    return false;
  }
  
  // Acquire lock
  this.checkInLock.isLocked = true;
  this.checkInLock.lockedAt = new Date();
  this.checkInLock.lockedBy = staffUser;
  this.checkInLock.sessionId = sessionId;
  await this.save();
  return true;
};

// Method to release check-in lock
inviteSchema.methods.releaseCheckInLock = async function() {
  this.checkInLock.isLocked = false;
  this.checkInLock.lockedAt = null;
  this.checkInLock.lockedBy = null;
  this.checkInLock.sessionId = null;
  await this.save();
};

// Method to calculate trust score based on behavior
inviteSchema.methods.calculateTrustScore = function() {
  let score = 100;
  
  // Deduct for failed scan attempts
  const failedAttempts = this.scanAttempts.length;
  score -= Math.min(failedAttempts * 10, 50); // Max 50 point deduction
  
  // Deduct for security flags
  const activeFlags = this.securityFlags.filter(f => !f.autoResolved);
  score -= activeFlags.length * 15;
  
  // Severe deductions for critical flags
  const criticalFlags = activeFlags.filter(f => f.severity === 'critical');
  score -= criticalFlags.length * 25;
  
  // Deduct if marked as duplicate
  if (this.markedAsDuplicate) score -= 30;
  
  // Ensure score stays within bounds
  this.trustScore = Math.max(0, Math.min(100, score));
  return this.trustScore;
};

// Method to add security flag
inviteSchema.methods.addSecurityFlag = async function(flag, severity, notes) {
  this.securityFlags.push({
    flag,
    severity: severity || 'medium',
    notes: notes || '',
    flaggedAt: new Date(),
  });
  this.calculateTrustScore();
  await this.save();
};

// Pre-save hook to auto-generate duplicate fingerprint
inviteSchema.pre('save', function(next) {
  if (this.isModified('guestName') || this.isModified('guestEmail') || this.isModified('guestPhone')) {
    this.duplicateCheckFingerprint = this.generateDuplicateFingerprint();
  }
  next();
});

module.exports = mongoose.model('Invite', inviteSchema);
