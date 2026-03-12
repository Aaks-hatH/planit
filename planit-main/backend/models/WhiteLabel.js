/*
 * PLANIT PROPRIETARY LICENSE
 * Copyright (c) 2026 Aakshat Hariharan. All rights reserved.
 *
 * White Label Mongoose Model
 */

const mongoose = require('mongoose');

const WhiteLabelSchema = new mongoose.Schema(
  {
    clientName:   { type: String, required: true, trim: true },
    domain:       { type: String, required: true, unique: true, lowercase: true, trim: true },
    tier:         { type: String, enum: ['basic', 'pro', 'enterprise'], default: 'basic' },
    status:       { type: String, enum: ['trial', 'active', 'suspended', 'cancelled'], default: 'trial' },

    // License key
    licenseKey:   { type: String },
    keyIssuedAt:  { type: Date },
    keyExpiresAt: { type: Date },

    // Contact info
    contactName:  { type: String, trim: true },
    contactEmail: { type: String, trim: true, lowercase: true },
    contactPhone: { type: String, trim: true },

    // Branding config
    branding: {
      companyName:   { type: String, default: '' },
      logoUrl:       { type: String, default: '' },
      faviconUrl:    { type: String, default: '' },
      primaryColor:  { type: String, default: '#2563eb' },
      accentColor:   { type: String, default: '#1d4ed8' },
      fontFamily:    { type: String, default: 'Inter' },
      hidePoweredBy: { type: Boolean, default: false },
      customCss:     { type: String, default: '' },
    },

    // Usage limits
    limits: {
      maxEvents:         { type: Number, default: 10 },
      maxGuestsPerEvent: { type: Number, default: 500 },
      maxAdminUsers:     { type: Number, default: 3 },
    },

    // Billing
    billing: {
      mode:                 { type: String, default: 'sandbox' },
      billingStatus:        { type: String, default: 'sandbox' },
      monthlyAmount:        { type: Number, default: 0 },
      currency:             { type: String, default: 'usd' },
      stripeCustomerId:     { type: String },
      stripeSubscriptionId: { type: String },
      nextBillingDate:      { type: Date },
    },

    notes:         { type: String, default: '' },
    suspendReason: { type: String, default: '' },

    // Heartbeat tracking
    lastHeartbeat:   { type: Date },
    heartbeatFailed: { type: Number, default: 0 },
    heartbeatCount:  { type: Number, default: 0 },
  },
  { timestamps: true },
);

module.exports = mongoose.model('WhiteLabel', WhiteLabelSchema);
