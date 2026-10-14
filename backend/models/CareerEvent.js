'use strict';

/*
 * CareerEvent - lightweight funnel events from /careers
 * (viewed page, opened a role, started the form, reached step N, submitted).
 * Auto-expires after 180 days so it never grows unbounded.
 */

const mongoose = require('mongoose');

const EVENTS = ['page_view', 'role_open', 'apply_start', 'step_2', 'step_3', 'apply_submit', 'apply_abandon', 'link_copy'];

const careerEventSchema = new mongoose.Schema({
  event:     { type: String, enum: EVENTS, required: true, index: true },
  jobSlug:   { type: String, default: '', index: true },
  source:    { type: String, default: '' },
  visitorId: { type: String, default: '' },
  sessionId: { type: String, default: '' },
  scrollDepth: { type: Number, default: 0 },
  seconds:   { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 180, index: true },
});

module.exports = mongoose.models.CareerEvent || mongoose.model('CareerEvent', careerEventSchema);
module.exports.EVENTS = EVENTS;
