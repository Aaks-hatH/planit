const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Per-event participant accounts.
// A "username" is unique within an event — the same person can use the
// same name across different events and their password will work in each.
const eventParticipantSchema = new mongoose.Schema({
  eventId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
  username:     { type: String, required: true, trim: true, maxlength: 100 },
  // bcrypt-hashed account password (optional — guests can still join without one)
  password:     { type: String, select: false },
  hasPassword:  { type: Boolean, default: false },
  role:         { type: String, enum: ['organizer', 'participant'], default: 'participant' },
  joinedAt:     { type: Date, default: Date.now },
  lastSeenAt:   { type: Date, default: Date.now },
}, { timestamps: true });

// username must be unique per event
eventParticipantSchema.index({ eventId: 1, username: 1 }, { unique: true });

eventParticipantSchema.methods.verifyPassword = async function (plain) {
  if (!this.hasPassword || !this.password) return false;
  return bcrypt.compare(plain, this.password);
};

eventParticipantSchema.statics.findOrCreate = async function (eventId, username, role = 'participant') {
  let participant = await this.findOne({ eventId, username });
  if (!participant) {
    participant = await this.create({ eventId, username, role });
  }
  return participant;
};

module.exports = mongoose.model('EventParticipant', eventParticipantSchema);
