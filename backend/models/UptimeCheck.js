'use strict';
const { Schema, model, models } = require('mongoose');

// Mirrors the schema the Watchdog service writes to every minute.
// The backend reads this collection to build accurate uptime graphs.
const uptimeCheckSchema = new Schema({
  service:   { type: String, required: true },           // e.g. "Iceman", "Maverick", "Load Balancer"
  status:    { type: String, enum: ['up', 'down'], required: true },
  latencyMs: { type: Number, default: null },
  error:     { type: String, default: null },
  createdAt: { type: Date,   default: Date.now },
});

uptimeCheckSchema.index({ createdAt: 1 }, { expireAfterSeconds: 1296000 }); // 15-day TTL
uptimeCheckSchema.index({ service: 1, createdAt: -1 });

module.exports = models.UptimeCheck || model('UptimeCheck', uptimeCheckSchema);