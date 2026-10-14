'use strict';

/*
 * LoginRecord - one row per successful admin / employee sign-in.
 * Powers "when did they log on" for the super admin (who has no Employee document), for each person's
 * own history, and for managers looking at their reports. Auto-deleted after 180 days.
 */

const mongoose = require('mongoose');

const loginRecordSchema = new mongoose.Schema({
  actorId:   { type: String, required: true, index: true },   // Employee _id, or 'root' for the env-login super admin
  actorType: { type: String, enum: ['employee', 'root'], default: 'employee' },
  name:      { type: String, default: '', maxlength: 100 },
  email:     { type: String, default: '', maxlength: 160 },
  role:      { type: String, default: '', maxlength: 40 },
  ip:        { type: String, default: '', maxlength: 64 },
  device:    { type: String, default: '', maxlength: 160 },     // short "Browser on OS" summary, never the raw UA
  totp:      { type: Boolean, default: false },
  at:        { type: Date, default: Date.now, index: true },
}, { versionKey: false });

loginRecordSchema.index({ actorId: 1, at: -1 });
loginRecordSchema.index({ at: 1 }, { expireAfterSeconds: 180 * 24 * 3600 });

module.exports = mongoose.models.LoginRecord || mongoose.model('LoginRecord', loginRecordSchema);
