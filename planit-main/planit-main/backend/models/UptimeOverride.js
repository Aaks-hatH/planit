'use strict';
const { Schema, model, models } = require('mongoose');

// Stores admin-set uptime overrides persistently in MongoDB.
// Both whole-service overrides (pct applied to every day) and
// per-day point overrides are stored here.
const uptimeOverrideSchema = new Schema({
  // The service key, e.g. "Iceman", "homepage", "table-management"
  service:   { type: String, required: true },
  // If date is null → whole-service override (all days get this pct).
  // If date is set  → single-day point override (YYYY-MM-DD).
  date:      { type: String, default: null },
  pct:       { type: Number, required: true, min: 0, max: 100 },
  label:     { type: String, default: null },
  setBy:     { type: String, default: 'admin' },
  setAt:     { type: Date,   default: Date.now },
});

// Unique constraint: one override per service+date combo
// (date=null = whole-service, date='2026-03-27' = that specific day)
uptimeOverrideSchema.index({ service: 1, date: 1 }, { unique: true });

module.exports = models.UptimeOverride || model('UptimeOverride', uptimeOverrideSchema);