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
  status: { type: String, enum: ['pending', 'confirmed', 'declined', 'checked-in'], default: 'pending' },

  // Audit log: every failed scan attempt
  scanAttempts: [{
    attemptedAt: { type: Date, default: Date.now },
    reason:      { type: String },
    attemptedBy: { type: String },
    ipAddress:   { type: String },
  }],
}, { timestamps: true });

inviteSchema.index({ eventId: 1, inviteCode: 1 });
inviteSchema.index({ inviteCode: 1 });

module.exports = mongoose.model('Invite', inviteSchema);
