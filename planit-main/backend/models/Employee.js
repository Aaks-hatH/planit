const mongoose = require('mongoose');
const { ROLE_IDS, PERMISSION_KEYS } = require('../utils/permissions');

// Every permission flag comes from utils/permissions.js, so the stored shape can never drift from the
// catalog the Team page shows. All flags default to false (least privilege).
const permissionShape = Object.fromEntries(PERMISSION_KEYS.map((k) => [k, { type: Boolean, default: false }]));

const employeeSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true, maxlength: 100 },
  email:       { type: String, required: true, trim: true, lowercase: true },
  role: {
    type: String,
    required: true,
    enum: ROLE_IDS,
    default: 'volunteer',
  },
  department:  { type: String, trim: true, maxlength: 100 },
  phone:       { type: String, trim: true, maxlength: 30 },
  notes:       { type: String, trim: true, maxlength: 1000 },
  status:      { type: String, enum: ['active', 'inactive', 'suspended'], default: 'active' },

  // ── Granular permissions ──────────────────────────────────────────────────
  // Each flag is independent of role. A super_admin bypasses ALL permission
  // checks. For all other roles, only the flags explicitly set to true are
  // granted. This lets you create a "read-only analyst" or a "support agent
  // who can block users but not delete events" without changing their role.
  permissions: permissionShape,

  // ── Demo flag ─────────────────────────────────────────────────────────────
  // When true, ALL write operations (POST/PATCH/PUT/DELETE) are intercepted
  // and return a fake success response. The account can still read everything
  // so it looks real and is useful for demos / sandbox access.
  isDemo:      { type: Boolean, default: false },

  avatar:       { type: String },
  passwordHash: { type: String }, // bcrypt hash — set by super_admin
  startDate:    { type: Date, default: Date.now },

  // ── Extended profile fields ───────────────────────────────────────────────
  timezone:          { type: String, trim: true, maxlength: 60 },
  location:          { type: String, trim: true, maxlength: 100 },
  emergencyContact:  { type: String, trim: true, maxlength: 200 },
  employeeId:        { type: String, trim: true, maxlength: 50 },

  // ── Security & access tracking ────────────────────────────────────────────
  lastLogin:         { type: Date },
  previousLogin:     { type: Date },   // the login before lastLogin, so "last time you were here" is available
  loginCount:        { type: Number, default: 0 },
  twoFactorEnabled:  { type: Boolean, default: false },
  forcePasswordReset:{ type: Boolean, default: false },

  // ── TOTP (Time-based One-Time Password) ───────────────────────────────────
  // totpSecret is the base32-encoded TOTP seed stored encrypted at rest.
  // totpEnabled mirrors twoFactorEnabled but is the canonical flag — both are
  // kept in sync so existing code reading twoFactorEnabled still works.
  totpSecret:        { type: String, select: false }, // never returned by default
  totpEnabled:       { type: Boolean, default: false },

  // ── Access scope ──────────────────────────────────────────────────────────
  // Optional list of event IDs this employee is restricted to. Empty = all events.
  accessibleEvents:  [{ type: String }],

  // ── GitHub repo access (personal repo, no org) ────────────────────────────
  // Only set for employees who need to touch the code. On a personal repo a
  // collaborator is added or removed by username; there are no teams.
  githubUsername:    { type: String, trim: true, maxlength: 39 },
  githubAccess:      { type: String, enum: ['none', 'read', 'write'], default: 'none' },
  githubId:          { type: Number },   // GitHub's permanent numeric id, saved when linked from Team -> GitHub, so renames don't break PR matching
}, { timestamps: true });

module.exports = mongoose.model('Employee', employeeSchema);
