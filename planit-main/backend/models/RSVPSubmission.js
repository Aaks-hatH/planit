'use strict';

const mongoose = require('mongoose');

// ─────────────────────────────────────────────────────────────────────────────
// RSVPSubmission
//
// Stores each individual RSVP response collected through the public RSVP page.
// This is separate from the legacy event.rsvps[] array (which only stores
// username + status for in-app participants) so that:
//   • Guest RSVPs can carry rich data (email, phone, custom answers, plus-ones)
//   • They do not require a PlanIt account
//   • Organizers can manage, export, and approve them independently
// ─────────────────────────────────────────────────────────────────────────────

const customAnswerSchema = new mongoose.Schema(
  {
    questionId: { type: String, required: true },
    question:   { type: String, required: true },
    answer:     { type: mongoose.Schema.Types.Mixed, default: '' },  // string | string[]
  },
  { _id: false }
);

const plusOneSchema = new mongoose.Schema(
  {
    firstName: { type: String, trim: true, maxlength: 100, default: '' },
    lastName:  { type: String, trim: true, maxlength: 100, default: '' },
    dietary:   { type: String, trim: true, maxlength: 300, default: '' },
  },
  { _id: false }
);

const rsvpSubmissionSchema = new mongoose.Schema(
  {
    // ── Parent event ─────────────────────────────────────────────────────────
    eventId: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'Event',
      required: true,
      index:    true,
    },

    // ── Response ─────────────────────────────────────────────────────────────
    response: {
      type:     String,
      enum:     ['yes', 'maybe', 'no'],
      required: true,
    },

    // ── Primary guest ────────────────────────────────────────────────────────
    firstName: { type: String, required: true, trim: true, maxlength: 100 },
    lastName:  { type: String, trim: true, maxlength: 100, default: '' },
    email:     { type: String, trim: true, lowercase: true, maxlength: 200, default: '' },
    phone:     { type: String, trim: true, maxlength: 30, default: '' },

    // ── Plus-ones ─────────────────────────────────────────────────────────────
    plusOnes:      { type: Number, default: 0, min: 0, max: 50 },
    plusOneDetails: { type: [plusOneSchema], default: [] },

    // ── Dietary / accessibility ───────────────────────────────────────────────
    dietaryRestrictions: { type: String, trim: true, maxlength: 500, default: '' },
    accessibilityNeeds:  { type: String, trim: true, maxlength: 500, default: '' },

    // ── Custom question answers ───────────────────────────────────────────────
    customAnswers: { type: [customAnswerSchema], default: [] },

    // ── Free-text note from guest ─────────────────────────────────────────────
    guestNote: { type: String, trim: true, maxlength: 1000, default: '' },

    // ── Status ────────────────────────────────────────────────────────────────
    // pending   = submitted, awaiting organizer approval
    // confirmed = accepted / auto-confirmed
    // waitlisted = capacity reached, on waitlist
    // declined  = organizer declined
    status: {
      type:    String,
      enum:    ['pending', 'confirmed', 'waitlisted', 'declined'],
      default: 'confirmed',
      index:   true,
    },

    // ── Check-in ──────────────────────────────────────────────────────────────
    checkedIn:   { type: Boolean, default: false },
    checkedInAt: { type: Date, default: null },

    // ── Unique guest edit/cancel token ────────────────────────────────────────
    editToken: {
      type:   String,
      unique: true,
      sparse: true,
      index:  true,
    },

    // ── Organizer annotation ──────────────────────────────────────────────────
    organizerNotes: { type: String, trim: true, maxlength: 1000, default: '' },
    tags:           [{ type: String, trim: true, maxlength: 50 }],
    starred:        { type: Boolean, default: false },

    // ── Confirmation email tracking ───────────────────────────────────────────
    confirmationEmailSent:   { type: Boolean, default: false },
    confirmationEmailSentAt: { type: Date, default: null },

    // ── Security / audit ─────────────────────────────────────────────────────
    ipAddress:   { type: String, default: '' },
    userAgent:   { type: String, default: '' },
    duplicateFlag: { type: Boolean, default: false }, // true when warn_organizer policy detected a duplicate email
    submittedAt: { type: Date, default: Date.now, index: true },
    updatedAt:   { type: Date, default: Date.now },

    // ── Soft-delete ───────────────────────────────────────────────────────────
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
  }
);

// ─── Compound indexes ─────────────────────────────────────────────────────────
rsvpSubmissionSchema.index({ eventId: 1, status: 1 });
rsvpSubmissionSchema.index({ eventId: 1, response: 1 });
rsvpSubmissionSchema.index({ eventId: 1, email: 1 });
rsvpSubmissionSchema.index({ eventId: 1, submittedAt: -1 });

// ─── Virtual: full name ───────────────────────────────────────────────────────
rsvpSubmissionSchema.virtual('fullName').get(function () {
  return [this.firstName, this.lastName].filter(Boolean).join(' ');
});

// ─── Total attendees (primary guest + plus-ones) ──────────────────────────────
rsvpSubmissionSchema.virtual('totalAttendees').get(function () {
  return 1 + (this.plusOnes || 0);
});

rsvpSubmissionSchema.set('toJSON', { virtuals: true });
rsvpSubmissionSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('RSVPSubmission', rsvpSubmissionSchema);
