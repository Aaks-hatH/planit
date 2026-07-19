'use strict';
const { Schema, model } = require('mongoose');

// Maintenance record — ultra-compressed field names to minimise storage.
// t  = type:    's' scheduled | 'i' incident | 'd' degraded
// s  = status:  'upcoming' | 'active' | 'resolved'
// msg = message shown to users (≤ 280 chars)
// eta = estimated resolution time
// start = when maintenance starts (or started)
// end   = when it was resolved
// by    = who triggered it (admin username, ≤ 40 chars)
// ca    = createdAt (indexed for quick "latest active" query)

const MntSchema = new Schema({
  t:     { type: String, enum: ['s','i','d'], required: true },
  s:     { type: String, enum: ['upcoming','active','resolved'], default: 'active' },
  msg:   { type: String, maxlength: 280, default: '' },
  eta:   { type: Date,   default: null },
  start: { type: Date,   default: null },
  end:   { type: Date,   default: null },
  by:    { type: String, maxlength: 40, default: 'admin' },
  ca:    { type: Date,   default: Date.now, index: true },
}, { versionKey: false, _id: true });

// Only ever need the latest non-resolved record
MntSchema.index({ s: 1, ca: -1 });

module.exports = model('Mnt', MntSchema, 'mnt');
