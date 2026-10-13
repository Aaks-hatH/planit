'use strict';

/*
 * JobApplication - one submission from /careers.
 * Holds what the applicant typed plus attribution (where they came from),
 * device context and on-page engagement, so the team can see which channels
 * (LinkedIn, Handshake, Discord...) actually produce good volunteers.
 */

const mongoose = require('mongoose');

const SOURCES = [
  'linkedin', 'indeed', 'handshake', 'glassdoor', 'wellfound', 'ziprecruiter',
  'github', 'devpost', 'discord', 'reddit', 'twitter', 'instagram', 'tiktok',
  'youtube', 'facebook', 'google', 'school', 'friend', 'planit', 'other',
];

const touchSchema = new mongoose.Schema({
  source:    { type: String, default: '' },
  medium:    { type: String, default: '' },
  campaign:  { type: String, default: '' },
  content:   { type: String, default: '' },
  term:      { type: String, default: '' },
  ref:       { type: String, default: '' },     // ?ref= / ?src= value
  referrer:  { type: String, default: '' },     // document.referrer (host + path)
  landing:   { type: String, default: '' },     // first URL that brought them in
  at:        { type: Date,   default: null },
}, { _id: false });

const answerSchema = new mongoose.Schema({
  label:  { type: String, default: '' },
  answer: { type: String, default: '' },
}, { _id: false });

const historySchema = new mongoose.Schema({
  status: { type: String, default: '' },
  by:     { type: String, default: '' },
  at:     { type: Date,   default: Date.now },
}, { _id: false });

const sizeSchema = new mongoose.Schema({
  w:   { type: Number, default: 0 },
  h:   { type: Number, default: 0 },
  dpr: { type: Number, default: 0 },
}, { _id: false });

const jobApplicationSchema = new mongoose.Schema({
  // ── Which role ──────────────────────────────────────────────────────────
  jobId:     { type: mongoose.Schema.Types.ObjectId, ref: 'JobListing', default: null, index: true },
  jobSlug:   { type: String, default: 'general', index: true },
  jobTitle:  { type: String, default: 'General application' },   // snapshot, survives listing deletion
  jobTeam:   { type: String, default: '' },

  // ── Who ─────────────────────────────────────────────────────────────────
  fullName:  { type: String, required: true, trim: true, maxlength: 120 },
  email:     { type: String, required: true, trim: true, lowercase: true, maxlength: 200, index: true },
  phone:     { type: String, trim: true, maxlength: 40, default: '' },
  location:  { type: String, trim: true, maxlength: 120, default: '' },
  timezone:  { type: String, trim: true, maxlength: 60, default: '' },
  ageConfirmed: { type: Boolean, default: false },       // "I am 16 or older"

  // ── Links ───────────────────────────────────────────────────────────────
  linkedin:  { type: String, trim: true, maxlength: 300, default: '' },
  github:    { type: String, trim: true, maxlength: 300, default: '' },
  portfolio: { type: String, trim: true, maxlength: 300, default: '' },
  resumeUrl: { type: String, trim: true, maxlength: 400, default: '' },

  // ── Background / fit ────────────────────────────────────────────────────
  currentStatus: { type: String, enum: ['', 'student', 'working', 'between', 'freelance', 'other'], default: '' },
  organization:  { type: String, trim: true, maxlength: 140, default: '' },   // school or employer
  experienceLevel: { type: String, enum: ['', 'beginner', 'intermediate', 'advanced', 'expert'], default: '' },
  skills:    { type: [String], default: [] },
  whyYou:    { type: String, trim: true, maxlength: 3000, default: '' },
  proudestWork: { type: String, trim: true, maxlength: 2000, default: '' },
  hoursPerWeek: { type: Number, min: 0, max: 80, default: null },
  startDate: { type: String, trim: true, maxlength: 40, default: '' },
  answers:   { type: [answerSchema], default: [] },

  // ── "Where did you find us?" ────────────────────────────────────────────
  source:       { type: String, enum: SOURCES, default: 'other', index: true },   // what they selected
  sourceDetail: { type: String, trim: true, maxlength: 200, default: '' },        // free text / referrer's name
  detectedSource: { type: String, default: '' },                                  // what we detected automatically
  firstTouch: { type: touchSchema, default: () => ({}) },
  lastTouch:  { type: touchSchema, default: () => ({}) },

  // ── Acknowledgements ────────────────────────────────────────────────────
  ackVolunteer: { type: Boolean, default: false },   // understands role is unpaid
  ackDataUse:   { type: Boolean, default: false },   // consents to data being stored
  ackedAt:      { type: Date, default: Date.now },

  // ── Device / context ────────────────────────────────────────────────────
  ip:        { type: String, default: '' },
  country:   { type: String, default: '' },
  userAgent: { type: String, default: '' },
  deviceType:{ type: String, enum: ['desktop', 'mobile', 'tablet', 'unknown'], default: 'unknown' },
  language:  { type: String, default: '' },
  platform:  { type: String, default: '' },
  screen:    { type: sizeSchema, default: () => ({}) },
  viewport:  { type: sizeSchema, default: () => ({}) },
  colorScheme: { type: String, default: '' },
  reducedMotion: { type: Boolean, default: false },

  // ── Engagement ──────────────────────────────────────────────────────────
  visitorId: { type: String, default: '', index: true },
  sessionId: { type: String, default: '' },
  scrollDepthMax: { type: Number, min: 0, max: 100, default: 0 },
  secondsOnPage:  { type: Number, min: 0, max: 86400, default: 0 },
  secondsOnForm:  { type: Number, min: 0, max: 86400, default: 0 },
  rolesViewed:    { type: [String], default: [] },
  pageViewsInSession: { type: Number, default: 0 },
  returningVisitor: { type: Boolean, default: false },

  // ── Hiring workflow (admin) ─────────────────────────────────────────────
  status: {
    type: String,
    enum: ['new', 'reviewing', 'interview', 'trial', 'accepted', 'waitlist', 'rejected', 'withdrawn'],
    default: 'new', index: true,
  },
  rating:     { type: Number, min: 0, max: 5, default: 0 },
  tags:       { type: [String], default: [] },
  adminNotes: { type: String, default: '', maxlength: 4000 },
  statusHistory: { type: [historySchema], default: [] },
  lastReviewedAt: { type: Date, default: null },
}, { timestamps: true });

jobApplicationSchema.index({ createdAt: -1 });
jobApplicationSchema.index({ jobSlug: 1, email: 1 });

module.exports = mongoose.models.JobApplication || mongoose.model('JobApplication', jobApplicationSchema);
module.exports.SOURCES = SOURCES;
