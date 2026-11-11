'use strict';
const { Schema, model, models } = require('mongoose');

// One document per service per UTC day. Written by watchdog/uptimeRollup.js, which squashes
// that day's raw UptimeCheck documents into this one and deletes them (keeps MongoDB small).
// The backend only reads it (and "fixes" it from the admin uptime-fix routes).
// Keep in sync with the schema in watchdog/uptimeRollup.js.
const uptimeDailySchema = new Schema({
  service:      { type: String, required: true },
  day:          { type: String, required: true },          // 'YYYY-MM-DD' (UTC)
  total:        { type: Number, default: 0 },
  up:           { type: Number, default: 0 },
  latencySum:   { type: Number, default: 0 },
  latencyCount: { type: Number, default: 0 },
  latencyMax:   { type: Number, default: null },
  firstDownAt:  { type: Date,   default: null },
  lastDownAt:   { type: Date,   default: null },
  lastError:    { type: String, default: null },
  dayDate:      { type: Date,   required: true },
  rolledAt:     { type: Date,   default: Date.now },
}, { versionKey: false, collection: 'uptime_daily' });

uptimeDailySchema.index({ service: 1, day: 1 }, { unique: true });
uptimeDailySchema.index({ dayDate: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 }); // keep 1 year

module.exports = models.UptimeDaily || model('UptimeDaily', uptimeDailySchema);
