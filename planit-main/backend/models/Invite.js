const mongoose = require('mongoose');

const inviteSchema = new mongoose.Schema({
  eventId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  inviteCode: { type: String, required: true, unique: true },
  guestName:  { type: String, required: true, trim: true },
  guestEmail: { type: String, trim: true },
  guestPhone: { type: String, trim: true },

  guestRole: {
    type:      String,
    enum:      ['GUEST', 'VIP', 'SPEAKER'],
    default:   'GUEST',
    uppercase: true,
  },

  adults:    { type: Number, default: 1, min: 0 },
  children:  { type: Number, default: 0, min: 0 },
  groupSize: { type: Number, default: 1, min: 1 },

  actualAttendees: { type: Number, default: 0 },
  plusOnes:        { type: Number, default: 0 },

  securityPin: { type: String, trim: true, default: '' },

  checkedIn:   { type: Boolean, default: false },
  checkedInAt: { type: Date },
  checkedInBy: { type: String },

  notes:  { type: String, trim: true, maxlength: 500 },
  status: {
    type:    String,
    enum:    ['pending', 'confirmed', 'maybe', 'declined', 'checked-in', 'blocked'],
    default: 'pending',
  },

  // --------------------------------------------------------------------------
  // Seating assignment
  //
  // tableId references the `id` field of a seatingObject in Event.seatingMap.objects.
  // tableLabel is a denormalised copy of the table label stored for fast display
  // in the boarding pass without an extra Event fetch.
  //
  // When tableId is set and the QR code is scanned successfully:
  //   1. EnterpriseCheckin switches to the seating map view
  //   2. The map auto-pans/zooms to the table
  //   3. The table pulses green for 3 seconds
  // --------------------------------------------------------------------------
  tableId:    { type: String, default: null },
  tableLabel: { type: String, default: null },
  seatNumber: { type: String, default: null },   // e.g. "A3", "Row 2 Seat 5", "14"

  // --------------------------------------------------------------------------
  // Anti-fraud and security
  // --------------------------------------------------------------------------
  duplicateCheckFingerprint: { type: String, index: true },
  markedAsDuplicate:         { type: Boolean, default: false },
  duplicateOf:               { type: mongoose.Schema.Types.ObjectId, ref: 'Invite' },

  checkInLock: {
    isLocked:  { type: Boolean, default: false },
    lockedAt:  { type: Date },
    lockedBy:  { type: String },
    sessionId: { type: String },
  },

  scanAttempts: [{
    attemptedAt: { type: Date, default: Date.now },
    reason:      { type: String },
    attemptedBy: { type: String },
    ipAddress:   { type: String },
    deviceInfo:  { type: String },
    location:    { type: String },
  }],

  isBlocked:    { type: Boolean, default: false },
  blockedReason: { type: String },
  blockedAt:    { type: Date },
  blockedBy:    { type: String },
  blockedUntil: { type: Date },

  securityFlags: [{
    flag:         { type: String },
    flaggedAt:    { type: Date, default: Date.now },
    severity:     { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
    autoResolved: { type: Boolean, default: false },
    resolvedAt:   { type: Date },
    resolvedBy:   { type: String },
    notes:        { type: String },
  }],

  checkInHistory: [{
    checkedInAt:          { type: Date },
    checkedInBy:          { type: String },
    actualAttendees:      { type: Number },
    reversed:             { type: Boolean, default: false },
    reversedAt:           { type: Date },
    reversedBy:           { type: String },
    reversalReason:       { type: String },
    overrideUsed:         { type: Boolean, default: false },
    overrideBy:           { type: String },
    overrideReason:       { type: String },
    originalBlockReason:  { type: String },
  }],

  trustScore: { type: Number, default: 100, min: 0, max: 100 },

  lastScanMetadata: {
    scannedAt:  { type: Date },
    ipAddress:  { type: String },
    deviceInfo: { type: String },
    location:   { type: String },
  },
}, { timestamps: true });

// Indexes
inviteSchema.index({ eventId: 1, inviteCode: 1 });
inviteSchema.index({ inviteCode: 1 });
inviteSchema.index({ duplicateCheckFingerprint: 1, eventId: 1 });
inviteSchema.index({ isBlocked: 1, eventId: 1 });
inviteSchema.index({ 'checkInLock.isLocked': 1 });
inviteSchema.index({ trustScore: 1 });
inviteSchema.index({ eventId: 1, tableId: 1 });   // used by seating editor guest counts

inviteSchema.virtual('isCurrentlyBlocked').get(function () {
  if (!this.isBlocked) return false;
  if (!this.blockedUntil) return true;
  return new Date() < this.blockedUntil;
});

inviteSchema.methods.generateDuplicateFingerprint = function () {
  const crypto = require('crypto');
  const data = [
    (this.guestName  || '').toLowerCase().trim(),
    (this.guestEmail || '').toLowerCase().trim(),
    (this.guestPhone || '').replace(/\D/g, ''),
  ].filter(Boolean).join('|');
  if (!data) return null;
  return crypto.createHash('sha256').update(data).digest('hex');
};

inviteSchema.methods.acquireCheckInLock = async function (staffUser, sessionId) {
  if (this.checkInLock.isLocked) {
    if (this.checkInLock.sessionId === sessionId) return true;
    const lockAge = Date.now() - new Date(this.checkInLock.lockedAt).getTime();
    if (lockAge > 30000) {
      Object.assign(this.checkInLock, { isLocked: true, lockedAt: new Date(), lockedBy: staffUser, sessionId });
      await this.save();
      return true;
    }
    return false;
  }
  Object.assign(this.checkInLock, { isLocked: true, lockedAt: new Date(), lockedBy: staffUser, sessionId });
  await this.save();
  return true;
};

inviteSchema.methods.releaseCheckInLock = async function () {
  Object.assign(this.checkInLock, { isLocked: false, lockedAt: null, lockedBy: null, sessionId: null });
  await this.save();
};

inviteSchema.methods.calculateTrustScore = function () {
  let score = 100;
  score -= Math.min(this.scanAttempts.length * 10, 50);
  const active   = this.securityFlags.filter(f => !f.autoResolved);
  score -= active.length * 15;
  score -= active.filter(f => f.severity === 'critical').length * 25;
  if (this.markedAsDuplicate) score -= 30;
  this.trustScore = Math.max(0, Math.min(100, score));
  return this.trustScore;
};

inviteSchema.methods.addSecurityFlag = async function (flag, severity, notes) {
  this.securityFlags.push({ flag, severity: severity || 'medium', notes: notes || '', flaggedAt: new Date() });
  this.calculateTrustScore();
  await this.save();
};

inviteSchema.pre('save', function (next) {
  if (this.isModified('guestName') || this.isModified('guestEmail') || this.isModified('guestPhone')) {
    this.duplicateCheckFingerprint = this.generateDuplicateFingerprint();
  }
  next();
});

module.exports = mongoose.model('Invite', inviteSchema);
