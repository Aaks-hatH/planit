/*
 * PLANIT PROPRIETARY LICENSE
 * Copyright (c) 2026 Aakshat Hariharan. All rights reserved.
 *
 * WLLead — White Label Sign-up Requests
 * ─────────────────────────────────────
 * Stores inbound leads from the /white-label signup page.
 * Managed via the Admin panel WL section.
 */

const mongoose = require('mongoose');

const wlLeadSchema = new mongoose.Schema({
  // ── Contact ────────────────────────────────────────────────────────────────
  businessName:  { type: String, required: true, trim: true, maxlength: 200 },
  contactName:   { type: String, required: true, trim: true, maxlength: 200 },
  email:         { type: String, required: true, trim: true, lowercase: true, maxlength: 200 },
  phone:         { type: String, trim: true, maxlength: 30 },
  website:       { type: String, trim: true, maxlength: 300 },

  // ── Intent ─────────────────────────────────────────────────────────────────
  businessType:  {
    type: String,
    enum: ['restaurant', 'venue', 'hotel', 'corporate', 'other'],
    required: true,
  },
  tierInterest: {
    type: String,
    enum: ['basic', 'pro', 'enterprise', 'unsure'],
    default: 'unsure',
  },
  message: { type: String, trim: true, maxlength: 2000 },

  // ── Workflow ───────────────────────────────────────────────────────────────
  status: {
    type: String,
    enum: ['new', 'contacted', 'converted', 'rejected'],
    default: 'new',
  },
  notes:         { type: String, trim: true, maxlength: 2000 },  // admin notes
  convertedToId: { type: mongoose.Schema.Types.ObjectId, ref: 'WhiteLabel' }, // set on convert

}, { timestamps: true });

wlLeadSchema.index({ status: 1, createdAt: -1 });
wlLeadSchema.index({ email: 1 });

module.exports = mongoose.model('WLLead', wlLeadSchema);
