const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true, maxlength: 100 },
  email:       { type: String, required: true, trim: true, lowercase: true },
  role: {
    type: String,
    required: true,
    enum: ['super_admin', 'admin', 'support', 'moderator', 'analyst', 'developer', 'demo'],
    default: 'support',
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
  permissions: {
    // ── Events ──────────────────────────────────────────────
    canDeleteEvents:      { type: Boolean, default: false },
    canEditEvents:        { type: Boolean, default: false },
    canCreateEvents:      { type: Boolean, default: false },

    // ── Users / participants ─────────────────────────────────
    canManageUsers:       { type: Boolean, default: false },
    canBanUsers:          { type: Boolean, default: false },
    canViewUserProfiles:  { type: Boolean, default: false },

    // ── Invites & check-in ───────────────────────────────────
    canManageInvites:     { type: Boolean, default: false },
    canCheckinGuests:     { type: Boolean, default: false },

    // ── Polls & seating ──────────────────────────────────────
    canManagePolls:       { type: Boolean, default: false },
    canManageSeating:     { type: Boolean, default: false },

    // ── Files ────────────────────────────────────────────────
    canManageFiles:       { type: Boolean, default: false },

    // ── Internal tooling ─────────────────────────────────────
    canViewLogs:          { type: Boolean, default: false },
    canViewSystem:        { type: Boolean, default: false },
    canAccessAPI:         { type: Boolean, default: false },

    // ── Data & analytics ─────────────────────────────────────
    canExportData:        { type: Boolean, default: false },
    canRunCleanup:        { type: Boolean, default: false },
    canViewAnalytics:     { type: Boolean, default: false },
    canViewFinancials:    { type: Boolean, default: false },

    // ── Incidents (safe to give to support agents) ───────────
    canManageIncidents:   { type: Boolean, default: true  },
    canSendNotifications: { type: Boolean, default: false },

    // ── Marketing ────────────────────────────────────────────
    canSendMarketing:     { type: Boolean, default: false },
    canViewMarketing:     { type: Boolean, default: false },

    // ── Blocklist / security ─────────────────────────────────
    canManageBlocklist:   { type: Boolean, default: false },
    canViewSecurityLogs:  { type: Boolean, default: false },

    // ── Maintenance mode — very destructive, tread carefully ──
    canToggleMaintenance: { type: Boolean, default: false },

    // ── Content management ───────────────────────────────────
    canEditContent:       { type: Boolean, default: false },
    canPublishContent:    { type: Boolean, default: false },

    // ── White-label ──────────────────────────────────────────
    canManageWhiteLabel:  { type: Boolean, default: false },

    // ── Team management ──────────────────────────────────────
    canViewEmployees:     { type: Boolean, default: false },
  },

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
  loginCount:        { type: Number, default: 0 },
  twoFactorEnabled:  { type: Boolean, default: false },
  forcePasswordReset:{ type: Boolean, default: false },

  // ── Access scope ──────────────────────────────────────────────────────────
  // Optional list of event IDs this employee is restricted to. Empty = all events.
  accessibleEvents:  [{ type: String }],
}, { timestamps: true });

module.exports = mongoose.model('Employee', employeeSchema);
