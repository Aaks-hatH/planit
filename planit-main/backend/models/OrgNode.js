'use strict';

/*
 * OrgNode - one box on the Admin -> Careers -> Org Chart.
 *
 * A node is a POSITION. It is either filled (a person holds it) or open
 * (hiring / vacant). Reporting lines are parentId -> child; `level` is the
 * horizontal swim-lane (0 = top). Invariant enforced by the routes:
 *   parent.level < child.level, and no cycles.
 *
 * Everything on a node is visible to every logged-in employee EXCEPT the
 * `private*` fields (phone, notes), which are only returned to super admins.
 */

const mongoose = require('mongoose');

const linkSchema = new mongoose.Schema({
  label: { type: String, trim: true, maxlength: 40, default: '' },
  url:   { type: String, trim: true, maxlength: 300, required: true },
}, { _id: false });

const orgNodeSchema = new mongoose.Schema({
  title:      { type: String, required: true, trim: true, maxlength: 120 },   // role title, e.g. "Head of Engineering"
  department: { type: String, trim: true, maxlength: 80, default: '' },
  status:     { type: String, enum: ['filled', 'open'], default: 'open', index: true },

  // ── Structure ─────────────────────────────────────────────────────────────
  level:    { type: Number, default: 0, min: 0, max: 9, index: true },
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'OrgNode', default: null, index: true },
  order:    { type: Number, default: 0 },

  // ── Who holds it (status === 'filled') ───────────────────────────────────
  personName:   { type: String, trim: true, maxlength: 100, default: '' },
  personEmail:  { type: String, trim: true, lowercase: true, maxlength: 160, default: '' },
  employeeId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null, index: true }, // optional link to a login account
  avatar:       { type: String, trim: true, maxlength: 400, default: '' },
  bio:          { type: String, trim: true, maxlength: 1200, default: '' },
  location:     { type: String, trim: true, maxlength: 100, default: '' },
  timezone:     { type: String, trim: true, maxlength: 60, default: '' },
  startDate:    { type: Date, default: null },
  skills:       { type: [String], default: [] },
  links:        { type: [linkSchema], default: [] },
  owner:        { type: Boolean, default: false },   // the root-login super admin's own box (no Employee account behind it)
  accent:       { type: String, enum: ['slate', 'indigo', 'emerald', 'amber', 'rose', 'sky', 'violet', 'teal'], default: 'slate' },

  // ── Open-position extras ─────────────────────────────────────────────────
  description:  { type: String, trim: true, maxlength: 1500, default: '' },   // what the role is for
  seats:        { type: Number, default: 1, min: 1, max: 99 },   // how many people this open role is hiring for
  jobSlug:      { type: String, trim: true, lowercase: true, maxlength: 90, default: '' }, // link to a JobListing

  // ── Super-admin only ─────────────────────────────────────────────────────
  privatePhone: { type: String, trim: true, maxlength: 30, default: '' },
  privateNotes: { type: String, trim: true, maxlength: 1500, default: '' },

  updatedBy:    { type: String, default: '' },
}, { timestamps: true });

orgNodeSchema.index({ level: 1, order: 1 });

module.exports = mongoose.models.OrgNode || mongoose.model('OrgNode', orgNodeSchema);
