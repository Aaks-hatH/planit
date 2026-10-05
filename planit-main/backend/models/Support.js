const mongoose = require('mongoose');

// Support / donation / feature-request ledger.
// `email` is legacy (pre-Bitcoin rows). New rows store only `emailEnc`
// (AES-256-GCM, see services/payments/fieldCrypto.js).
const supportSchema = new mongoose.Schema({
  email:    { type: String },
  emailEnc: { type: String },
  name:     String,
  amount:   { type: Number, required: true },        // USD cents
  message:  String,
  type:     { type: String, enum: ['support', 'feature_request'], default: 'support' },
  featureRequest: String,
  invoiceId: { type: String, unique: true, sparse: true },
  btcTxid:   String,
  stripePaymentId: String,                           // legacy
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.models.Support || mongoose.model('Support', supportSchema);
