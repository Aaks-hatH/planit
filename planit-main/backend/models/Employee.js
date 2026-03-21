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
    // Events
    canDeleteEvents:    { type: Boolean, default: false },
    canEditEvents:      { type: Boolean, default: false },

    // Users / participants
    canManageUsers:     { type: Boolean, default: false },

    // Internal tooling
    canViewLogs:        { type: Boolean, default: false },
    canViewSystem:      { type: Boolean, default: false },

    // Data
    canExportData:      { type: Boolean, default: false },
    canRunCleanup:      { type: Boolean, default: false },

    // Incidents (safe to give to support agents)
    canManageIncidents: { type: Boolean, default: true  },

    // Marketing
    canSendMarketing:   { type: Boolean, default: false },
    canViewMarketing:   { type: Boolean, default: false },

    // Blocklist / security
    canManageBlocklist: { type: Boolean, default: false },

    // Maintenance mode — very destructive, tread carefully
    canToggleMaintenance: { type: Boolean, default: false },

    // Blog / content management
    canEditContent:       { type: Boolean, default: false },
  },

  // ── Demo flag ─────────────────────────────────────────────────────────────
  // When true, ALL write operations (POST/PATCH/PUT/DELETE) are intercepted
  // and return a fake success response. The account can still read everything
  // so it looks real and is useful for demos / sandbox access.
  isDemo:      { type: Boolean, default: false },

  avatar:       { type: String },
  passwordHash: { type: String }, // bcrypt hash — set by super_admin
  startDate:    { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Employee', employeeSchema);
