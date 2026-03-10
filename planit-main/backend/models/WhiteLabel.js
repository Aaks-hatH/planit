const mongoose = require('mongoose');

const whiteLabelSchema = new mongoose.Schema({
  // ── Identity ────────────────────────────────────────────────────────────────
  clientName:  { type: String, required: true, trim: true, maxlength: 200 },
  domain:      { type: String, required: true, trim: true, lowercase: true, unique: true },
  // e.g. "reservations.latavernadayton.com" or "planit.theirvenue.com"

  // ── Tier ────────────────────────────────────────────────────────────────────
  tier: {
    type: String,
    enum: ['basic', 'pro', 'enterprise'],
    default: 'basic',
  },
  // basic     → custom domain + logo/colors, "Powered by PlanIt" shown
  // pro       → full white label, no PlanIt branding, custom email domain
  // enterprise → everything + SLA + dedicated infra + custom contract

  // ── Status ──────────────────────────────────────────────────────────────────
  status: {
    type: String,
    enum: ['trial', 'active', 'suspended', 'cancelled'],
    default: 'trial',
  },

  // ── License Key (HMAC-signed, domain-bound) ─────────────────────────────────
  licenseKey:    { type: String, unique: true, sparse: true },
  keyIssuedAt:   { type: Date },
  keyExpiresAt:  { type: Date },

  // ── Branding ────────────────────────────────────────────────────────────────
  branding: {
    companyName:    { type: String, trim: true, maxlength: 200 },
    logoUrl:        { type: String, trim: true },
    faviconUrl:     { type: String, trim: true },
    primaryColor:   { type: String, default: '#2563eb' },
    accentColor:    { type: String, default: '#1d4ed8' },
    fontFamily:     { type: String, default: 'Inter' },
    hidePoweredBy:  { type: Boolean, default: false }, // pro+ only
    customCss:      { type: String, maxlength: 10000 },  // enterprise only
  },

  // ── Contact ─────────────────────────────────────────────────────────────────
  contactName:  { type: String, trim: true, maxlength: 200 },
  contactEmail: { type: String, trim: true, lowercase: true },
  contactPhone: { type: String, trim: true, maxlength: 30 },

  // ── Billing (Stripe) ────────────────────────────────────────────────────────
  billing: {
    mode:                 { type: String, enum: ['sandbox', 'live'], default: 'sandbox' },
    stripeCustomerId:     { type: String },
    stripeSubscriptionId: { type: String },
    stripePriceId:        { type: String },
    billingStatus:        { type: String, enum: ['sandbox', 'active', 'past_due', 'cancelled'], default: 'sandbox' },
    monthlyAmount:        { type: Number, default: 0 }, // in cents
    currency:             { type: String, default: 'usd' },
    nextBillingDate:      { type: Date },
    trialEndsAt:          { type: Date },
  },

  // ── Limits per tier ─────────────────────────────────────────────────────────
  limits: {
    maxEvents:     { type: Number, default: 10 },
    maxGuestsPerEvent: { type: Number, default: 500 },
    maxAdminUsers: { type: Number, default: 3 },
  },

  // ── Heartbeat (tampering / self-hosting detection) ──────────────────────────
  lastHeartbeat:   { type: Date },
  heartbeatCount:  { type: Number, default: 0 },
  heartbeatFailed: { type: Number, default: 0 }, // consecutive misses

  // ── Misc ────────────────────────────────────────────────────────────────────
  notes:          { type: String, trim: true, maxlength: 2000 },
  suspendReason:  { type: String, trim: true, maxlength: 500 },
}, { timestamps: true });

// Indexes
whiteLabelSchema.index({ domain: 1 });
whiteLabelSchema.index({ status: 1 });
whiteLabelSchema.index({ licenseKey: 1 });

module.exports = mongoose.model('WhiteLabel', whiteLabelSchema);
