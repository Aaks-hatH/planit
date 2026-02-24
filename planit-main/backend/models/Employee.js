const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true, maxlength: 100 },
  email:       { type: String, required: true, trim: true, lowercase: true },
  role:        { type: String, required: true, enum: ['super_admin', 'admin', 'support', 'moderator', 'analyst', 'developer'], default: 'support' },
  department:  { type: String, trim: true, maxlength: 100 },
  phone:       { type: String, trim: true, maxlength: 30 },
  notes:       { type: String, trim: true, maxlength: 1000 },
  status:      { type: String, enum: ['active', 'inactive', 'suspended'], default: 'active' },
  permissions: {
    canDeleteEvents:     { type: Boolean, default: false },
    canManageUsers:      { type: Boolean, default: false },
    canViewLogs:         { type: Boolean, default: false },
    canManageIncidents:  { type: Boolean, default: true  },
    canExportData:       { type: Boolean, default: false },
    canRunCleanup:       { type: Boolean, default: false },
  },
  avatar:      { type: String }, // initials or URL
  startDate:   { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Employee', employeeSchema);
