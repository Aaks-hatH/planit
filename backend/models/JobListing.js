'use strict';

/*
 * JobListing - volunteer role posted on /careers
 * Managed from Admin -> Careers.
 */

const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  label:    { type: String, trim: true, maxlength: 240, required: true },
  required: { type: Boolean, default: false },
}, { _id: false });

const jobListingSchema = new mongoose.Schema({
  slug:      { type: String, required: true, unique: true, index: true, trim: true, lowercase: true, maxlength: 90 },
  title:     { type: String, required: true, trim: true, maxlength: 120 },
  team:      { type: String, trim: true, maxlength: 60, default: 'General' },
  tagline:   { type: String, trim: true, maxlength: 200, default: '' },

  // Always volunteer for now - kept as a field so it can change later.
  type:      { type: String, enum: ['volunteer'], default: 'volunteer' },
  workMode:  { type: String, enum: ['remote', 'hybrid', 'onsite'], default: 'remote' },
  location:  { type: String, trim: true, maxlength: 120, default: 'Remote (anywhere)' },
  hoursPerWeek: { type: String, trim: true, maxlength: 40, default: '3-6 hrs / week' },
  duration:  { type: String, trim: true, maxlength: 60, default: 'Ongoing, flexible' },

  description:      { type: String, trim: true, maxlength: 6000, default: '' },
  responsibilities: { type: [String], default: [] },
  requirements:     { type: [String], default: [] },
  niceToHave:       { type: [String], default: [] },
  perks:            { type: [String], default: [] },
  skills:           { type: [String], default: [] },
  questions:        { type: [questionSchema], default: [] },   // custom screening questions

  // Shown on the listing so nobody is misled about compensation.
  compensationNote: {
    type: String, trim: true, maxlength: 600,
    default: 'Unpaid volunteer role. If PlanIt earns revenue in the future, contributors may be offered a share, to be agreed in writing. Nothing is guaranteed.',
  },

  openings:  { type: Number, default: 1, min: 1, max: 99 },
  status:    { type: String, enum: ['draft', 'open', 'closed'], default: 'draft', index: true },
  closedReason: { type: String, trim: true, maxlength: 200, default: '' },
  closedAt:  { type: Date, default: null },
  deadline:  { type: Date, default: null },
  featured:  { type: Boolean, default: false },
  sortOrder: { type: Number, default: 100 },
  views:     { type: Number, default: 0 },

  createdBy: { type: String, default: '' },
}, { timestamps: true });

// A listing counts as open only when status is open AND the deadline (if any) has not passed.
jobListingSchema.methods.isOpenNow = function () {
  if (this.status !== 'open') return false;
  if (this.deadline && this.deadline.getTime() < Date.now()) return false;
  return true;
};

module.exports = mongoose.models.JobListing || mongoose.model('JobListing', jobListingSchema);
