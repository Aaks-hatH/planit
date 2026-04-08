'use strict';

const mongoose = require('mongoose');

/**
 * Blocklist — permanent or time-limited bans managed by admins.
 *
 * type:
 *   'ip'    — block an IP address at the trafficGuard middleware layer
 *   'event' — block a specific event subdomain from being accessed
 *   'name'  — block a display name pattern (checked on workspace join)
 *
 * expiresAt null = permanent (never expires).
 * expiresAt set  = lifted automatically after that date.
 */
const blocklistSchema = new mongoose.Schema({
  type: {
    type:     String,
    enum:     ['ip', 'event', 'name'],
    required: true,
    index:    true,
  },
  value: {
    type:     String,
    required: true,
    trim:     true,
    index:    true,
  },
  reason: {
    type:    String,
    default: '',
    trim:    true,
    maxlength: 500,
  },
  permanent: {
    type:    Boolean,
    default: true,
  },
  expiresAt: {
    type:    Date,
    default: null,  // null = permanent
  },
  addedBy: {
    type:    String,
    default: 'admin',
  },
  createdAt: {
    type:    Date,
    default: Date.now,
    index:   true,
  },
});

// Compound index for fast lookup during request handling
blocklistSchema.index({ type: 1, value: 1 });

// TTL index — MongoDB automatically removes documents with a non-null expiresAt
// once that date passes. Permanent entries (expiresAt: null) are never removed.
blocklistSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, partialFilterExpression: { expiresAt: { $type: 'date' } } });

module.exports = mongoose.model('Blocklist', blocklistSchema);
