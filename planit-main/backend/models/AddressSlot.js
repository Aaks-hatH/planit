/*
 * PLANIT PROPRIETARY LICENSE
 * Copyright (c) 2026 Aakshat Hariharan. All rights reserved.
 *
 * AddressSlot — bookkeeping for derived receive addresses.
 *
 * Wallets (Proton, Sparrow, …) only scan ~20 addresses past the last one that
 * received funds. If we burned a fresh index for every abandoned checkout, a
 * later real payment could land beyond that window and look "missing" in the
 * wallet. So: addresses that never saw a single transaction are recycled;
 * addresses that did are retired forever (privacy + clean accounting).
 */

const mongoose = require('mongoose');

const slotSchema = new mongoose.Schema({
  index:   { type: Number, required: true },
  address: { type: String, required: true, unique: true },
  network: { type: String, required: true },
  status:  { type: String, enum: ['free', 'assigned', 'used'], default: 'assigned', index: true },
  invoiceId: { type: String },
}, { timestamps: true });

slotSchema.index({ network: 1, index: 1 }, { unique: true });
slotSchema.index({ network: 1, status: 1, index: 1 });

const counterSchema = new mongoose.Schema({
  _id: String,
  seq: Number,
});

const Counter = mongoose.models.PaymentCounter || mongoose.model('PaymentCounter', counterSchema);

module.exports = mongoose.models.AddressSlot || mongoose.model('AddressSlot', slotSchema);
module.exports.Counter = Counter;
