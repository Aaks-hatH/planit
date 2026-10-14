/*
 * PLANIT PROPRIETARY LICENSE
 * Copyright (c) 2026 Aakshat Hariharan. All rights reserved.
 *
 * Invoice — one PlanIt Payments (Bitcoin) charge.
 *
 * Immutable after creation: purpose, usdCents, btcSats, rateUsd, address.
 * Only the payment-state fields are ever updated, and only by the watcher or
 * an authenticated admin.
 */

const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  at:     { type: Date, default: Date.now },
  type:   { type: String, maxlength: 40 },
  detail: { type: String, maxlength: 300 },
}, { _id: false });

const invoiceSchema = new mongoose.Schema({
  // Unguessable 128-bit ID — this is the only handle the public ever sees.
  publicId: { type: String, required: true, unique: true, match: /^[0-9a-f]{32}$/ },

  purpose:  { type: String, required: true, enum: ['support', 'feature_request', 'wl_setup', 'wl_subscription'] },
  refId:    { type: String, default: '' },              // lead / white-label id

  usdCents: { type: Number, required: true, min: 100 },
  btcSats:  { type: Number, required: true, min: 1000 },
  rateUsd:  { type: Number, required: true },
  network:  { type: String, required: true, enum: ['mainnet', 'testnet', 'signet'] },

  address:    { type: String, required: true },
  slotIndex:  { type: Number, required: true },

  status: {
    type: String,
    enum: ['pending', 'detected', 'confirmed', 'expired', 'review', 'rejected'],
    default: 'pending',
    index: true,
  },

  requiredConf:  { type: Number, default: 1 },
  seenSats:      { type: Number, default: 0 },   // paid, incl. unconfirmed
  confirmedSats: { type: Number, default: 0 },   // paid with >= requiredConf
  confirmations: { type: Number, default: 0 },
  txids:         [{ type: String }],

  expiresAt: { type: Date, required: true },
  paidAt:    { type: Date },

  // Non-sensitive display fields (shown on the pay page / receipt)
  label:     { type: String, default: '', maxlength: 200 },   // e.g. business name
  emailHint: { type: String, default: '', maxlength: 100 },   // masked: a***@gmail.com

  // Encrypted PII blob (AES-256-GCM): { email, name, message, feature, businessName }
  pii: { type: String, default: '' },

  // Abuse limiting without storing raw IPs
  ipHash: { type: String, index: true },

  // Watcher scheduling / multi-instance lease
  nextCheckAt: { type: Date, default: Date.now, index: true },
  lockUntil:   { type: Date },
  lastCheckedAt: { type: Date },

  // Exactly-once fulfillment
  fulfillState:  { type: String, enum: ['none', 'running', 'done'], default: 'none' },
  fulfillAt:     { type: Date },
  fulfillTries:  { type: Number, default: 0 },

  events: { type: [eventSchema], default: [] },

  // TTL: Mongo deletes the document at this time (set when terminal)
  purgeAt: { type: Date, index: { expireAfterSeconds: 0 } },
}, { timestamps: true });

invoiceSchema.index({ status: 1, nextCheckAt: 1 });
invoiceSchema.index({ purpose: 1, refId: 1, status: 1 });
invoiceSchema.index({ address: 1 });

invoiceSchema.methods.log = function (type, detail = '') {
  this.events.push({ type, detail: String(detail).slice(0, 300) });
  if (this.events.length > 50) this.events = this.events.slice(-50);
};

module.exports = mongoose.model('Invoice', invoiceSchema);
