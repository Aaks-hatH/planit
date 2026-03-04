const mongoose = require('mongoose');

// --------------------------------------------------------------------------
// Seating map object sub-document
//
// Each object represents one physical item on the venue floor plan.
// Coordinates use a logical 1000x700 canvas regardless of screen size;
// the SVG viewBox is fixed so all clients see the same layout.
//
// Fields
//   id       — client-generated UUID stable across saves
//   x, y     — centre of the object in logical canvas units
//   type     — 'round' | 'rect' | 'stage' | 'bar'
//   label    — display text shown on the map ("Table 1", "VIP Area", …)
//   rotation — degrees, applied around the centre point
//   capacity — maximum guests that can be seated here
//   color    — optional hex override; null = use type default
//   width    — override for rect/stage/bar tables (logical units)
//   height   — override for rect/stage/bar tables
// --------------------------------------------------------------------------
const seatingObjectSchema = new mongoose.Schema(
  {
    id:       { type: String, required: true },
    x:        { type: Number, required: true, min: 0 },
    y:        { type: Number, required: true, min: 0 },
    type:     {
      type:    String,
      enum:    ['round', 'rect', 'stage', 'bar', 'sofa', 'vip', 'zone', 'auditorium'],
      default: 'round',
    },
    label:    { type: String, trim: true, maxlength: 50, default: '' },
    rotation: { type: Number, default: 0 },
    capacity: { type: Number, default: 0, min: 0, max: 9999 },
    color:    { type: String, default: null },
    width:    { type: Number, default: 80 },
    height:   { type: Number, default: 80 },
    // Auditorium: rows × seatsPerRow layout config
    rowConfig: {
      rows:          { type: Number, default: 5 },
      seatsPerRow:   { type: Number, default: 10 },
      rowSpacing:    { type: Number, default: 36 },
      seatSpacing:   { type: Number, default: 28 },
      rowLabelStyle: { type: String, enum: ['alpha', 'numeric'], default: 'alpha' },
    },
  },
  { _id: false }
);

const eventSchema = new mongoose.Schema({
  subdomain: {
    type: String, required: true, unique: true, lowercase: true, trim: true,
    match: /^[a-z0-9-]+$/, minlength: 3, maxlength: 50,
  },
  title:         { type: String, required: true, trim: true, maxlength: 200 },
  description:   { type: String, trim: true, maxlength: 2000 },
  date:          { type: Date, required: true },
  timezone:      { type: String, required: true, default: 'UTC' },
  location:      { type: String, trim: true, maxlength: 500 },
  organizerName: { type: String, required: true, trim: true, maxlength: 100 },
  organizerEmail: {
    type: String, required: true, trim: true, lowercase: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
  password:            { type: String, select: false },
  isPasswordProtected: { type: Boolean, default: false },
  maxParticipants:     { type: Number, default: 100, min: 1, max: 1000000 },
  isEnterpriseMode:    { type: Boolean, default: false },

  // --------------------------------------------------------------------------
  // Visual seating map
  //
  // enabled   — false by default; organizer turns it on in the seating editor
  // objects   — array of tables/stage items placed on the floor plan
  // canvasW/H — logical dimensions of the SVG canvas (fixed at 1000x700)
  // --------------------------------------------------------------------------
  seatingMap: {
    enabled:   { type: Boolean, default: false },
    objects:   { type: [seatingObjectSchema], default: [] },
    canvasW:   { type: Number, default: 1000 },
    canvasH:   { type: Number, default: 700 },
    updatedAt: { type: Date, default: null },
    updatedBy: { type: String, default: null },
  },

  // --------------------------------------------------------------------------
  // Enterprise check-in security settings
  // --------------------------------------------------------------------------
  checkinSettings: {
    requirePin:             { type: Boolean, default: false },
    requireCodeConfirm:     { type: Boolean, default: true  },
    blockCrossEvent:        { type: Boolean, default: true  },
    requireAttendeeCount:   { type: Boolean, default: false },
    maxFailedAttempts:      { type: Number,  default: 3     },
    lockoutMinutes:         { type: Number,  default: 15    },
    allowManualOverride:    { type: Boolean, default: false },
    enableDuplicateDetection: { type: Boolean, default: true },
    duplicateDetectionMode: {
      type: String,
      enum: ['strict', 'moderate', 'lenient'],
      default: 'moderate',
    },
    autoBlockDuplicates:    { type: Boolean, default: false },
    allowMultipleTickets:   { type: Boolean, default: false },
    enableReentrancyProtection: { type: Boolean, default: true  },
    checkInLockTimeout:     { type: Number, default: 30 },
    enablePatternDetection: { type: Boolean, default: true  },
    rapidScanThreshold:     { type: Number, default: 3  },
    rapidScanWindowSeconds: { type: Number, default: 10 },
    multiDeviceThreshold:   { type: Number, default: 3  },
    enableGeofencing:       { type: Boolean, default: false },
    allowedRadius:          { type: Number,  default: 1000 },
    venueLocation: {
      latitude:  { type: Number },
      longitude: { type: Number },
    },
    enableTrustScore:       { type: Boolean, default: true  },
    minimumTrustScore:      { type: Number, default: 50, min: 0, max: 100 },
    autoBlockLowTrust:      { type: Boolean, default: false },
    enableTimeRestrictions: { type: Boolean, default: false },
    checkInWindowStart:     { type: Number, default: 120 },
    checkInWindowEnd:       { type: Number, default: 30  },
    allowLateCheckIn:       { type: Boolean, default: true },
    enableCapacityLimits:   { type: Boolean, default: false },
    maxTotalAttendees:      { type: Number },
    maxSimultaneousCheckIns: { type: Number, default: 10 },
    detailedAuditLogging:   { type: Boolean, default: true  },
    logIPAddresses:         { type: Boolean, default: true  },
    logDeviceInfo:          { type: Boolean, default: true  },
    logGeolocation:         { type: Boolean, default: false },
    staffNote:              { type: String, default: '' },
    securityInstructions:   { type: String, default: '' },
    emergencyLockdown:      { type: Boolean, default: false },
    emergencyLockdownReason: { type: String },
    emergencyLockdownBy:    { type: String },
    emergencyLockdownAt:    { type: Date },
    requireQRCodeRotation:  { type: Boolean, default: false },
    qrCodeExpiryMinutes:    { type: Number, default: 0 },
    requirePhotoVerification: { type: Boolean, default: false },
    allowPhotoUpload:       { type: Boolean, default: false },
  },

  settings: {
    allowChat:        { type: Boolean, default: true  },
    allowPolls:       { type: Boolean, default: true  },
    allowFileSharing: { type: Boolean, default: true  },
    requireApproval:  { type: Boolean, default: false },
    isPublic:         { type: Boolean, default: false },
    rsvpEnabled:      { type: Boolean, default: true  },
    rsvpDeadline:     { type: Date,    default: null  },
    rsvpAllowMaybe:   { type: Boolean, default: true  },
    rsvpShowCount:    { type: Boolean, default: true  },
    rsvpMessage:      { type: String,  default: ''    },
  },

  participants: [{
    username: { type: String, required: true },
    joinedAt: { type: Date, default: Date.now },
    role:     { type: String, enum: ['organizer', 'participant'], default: 'participant' },
  }],

  rsvps: [{
    username:  { type: String, required: true },
    status:    { type: String, enum: ['yes', 'maybe', 'no'], required: true },
    updatedAt: { type: Date, default: Date.now },
  }],

  waitlist: [{
    username: { type: String, required: true },
    email:    { type: String, default: '' },
    joinedAt: { type: Date, default: Date.now },
  }],

  webhooks: [{
    url:       { type: String, required: true, trim: true },
    events:    [{ type: String }],
    secret:    { type: String, default: '' },
    active:    { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
  }],

  agenda: [{
    id:          { type: String, required: true },
    time:        { type: String, trim: true, maxlength: 20 },
    title:       { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 500 },
    duration:    { type: Number, default: 0 },
    order:       { type: Number, default: 0 },
  }],

  tasks: [{
    id:          { type: String, required: true },
    title:       { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 500 },
    completed:   { type: Boolean, default: false },
    assignedTo:  { type: String, trim: true, maxlength: 100 },
    dueDate:     { type: Date },
    priority:    { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    createdBy:   { type: String, required: true },
    completedBy: { type: String },
    completedAt: { type: Date },
    createdAt:   { type: Date, default: Date.now },
  }],

  announcements: [{
    id:        { type: String, required: true },
    title:     { type: String, required: true, trim: true, maxlength: 200 },
    content:   { type: String, required: true, trim: true, maxlength: 2000 },
    author:    { type: String, required: true },
    important: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
  }],

  expenses: [{
    id:        { type: String, required: true },
    title:     { type: String, required: true, trim: true, maxlength: 200 },
    amount:    { type: Number, required: true, min: 0 },
    category:  { type: String, trim: true, maxlength: 100 },
    paidBy:    { type: String, trim: true, maxlength: 100 },
    notes:     { type: String, trim: true, maxlength: 500 },
    date:      { type: Date, default: Date.now },
    createdBy: { type: String, required: true },
  }],
  budget: { type: Number, default: 0 },

  notes: [{
    id:        { type: String, required: true },
    title:     { type: String, required: true, trim: true, maxlength: 200 },
    content:   { type: String, required: true, trim: true, maxlength: 5000 },
    author:    { type: String, required: true },
    color:     { type: String, default: '#fef3c7' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  }],

  coverImage: { type: String, default: null },
  themeColor: { type: String, default: null },
  tags:       [{ type: String, trim: true, maxlength: 30 }],

  status: {
    type: String,
    enum: ['draft', 'active', 'completed', 'cancelled'],
    default: 'active',
  },
  metadata: {
    views:        { type: Number, default: 0 },
    lastActivity: { type: Date, default: Date.now },
  },

  dataRetentionDays:      { type: Number, default: 30 },
  scheduledDeletionDate:  { type: Date },
  keepForever:            { type: Boolean, default: false },
  deletionPostponedUntil: { type: Date },
  deletionPostponements:  { type: Number, default: 0 },
  deletionWarnings: [{
    sentAt:             { type: Date },
    daysUntilDeletion:  { type: Number },
    emailSent:          { type: Boolean, default: false },
  }],

  approvalQueue: [{
    username:    { type: String, required: true },
    requestedAt: { type: Date, default: Date.now },
    message:     { type: String, maxlength: 300 },
  }],

  activityLog: [{
    action:    { type: String, required: true },
    actor:     { type: String, required: true },
    actorRole: { type: String },
    target:    { type: String },
    details:   { type: String },
    timestamp: { type: Date, default: Date.now },
  }],

  // ─────────────────────────────────────────────────────────────────────────
  // TABLE SERVICE MODE — Restaurant & Venue Floor Management
  // Data in this section is NEVER auto-wiped (keepForever enforced in routes).
  // ─────────────────────────────────────────────────────────────────────────
  isTableServiceMode: { type: Boolean, default: false },

  tableServiceSettings: {
    restaurantName:              { type: String, default: '' },
    avgDiningMinutes:            { type: Number, default: 75 },
    cleaningBufferMinutes:       { type: Number, default: 10 },
    reservationDurationMinutes:  { type: Number, default: 90 },
    reservationQrExpiryMinutes:  { type: Number, default: 45 },
    maxPartySizeWalkIn:          { type: Number, default: 20 },
    operatingHoursOpen:          { type: String, default: '11:00' },
    operatingHoursClose:         { type: String, default: '22:00' },
    currency:                    { type: String, default: 'USD' },
    welcomeMessage:              { type: String, default: '' },
    // Per-party-size average dining overrides (optional; falls back to avgDiningMinutes)
    sizeOverrides: [{
      minParty: { type: Number },
      maxParty: { type: Number },
      avgMinutes: { type: Number },
    }],
  },

  // Live table occupancy state — one entry per seatingMap object id
  tableStates: [{
    tableId:       { type: String, required: true },
    status:        { type: String, enum: ['available', 'occupied', 'reserved', 'cleaning', 'unavailable'], default: 'available' },
    partyName:     { type: String, default: '' },
    partySize:     { type: Number, default: 0 },
    serverName:    { type: String, default: '' },
    notes:         { type: String, default: '' },
    occupiedAt:    { type: Date,   default: null },
    reservationId: { type: String, default: null },
    updatedAt:     { type: Date,   default: Date.now },
  }],

  // Reservation queue — QR-based time-slotted bookings
  restaurantReservations: [{
    id:              { type: String, required: true },
    partyName:       { type: String, required: true, trim: true, maxlength: 100 },
    partySize:       { type: Number, required: true, min: 1 },
    phone:           { type: String, default: '', trim: true, maxlength: 30 },
    email:           { type: String, default: '', trim: true, maxlength: 200 },
    dateTime:        { type: Date,   required: true },
    tableId:         { type: String, default: null },
    qrToken:         { type: String, default: null },
    qrExpiresAt:     { type: Date,   default: null },
    cancelToken:     { type: String, default: null },   // for self-service cancellation link
    status:          { type: String, enum: ['confirmed', 'pending', 'seated', 'cancelled', 'no_show'], default: 'confirmed' },
    source:          { type: String, enum: ['staff', 'public'], default: 'staff' },
    occasion:        { type: String, default: '', maxlength: 50 },
    specialRequests: { type: String, default: '', maxlength: 1000 },
    dietaryNeeds:    { type: String, default: '', maxlength: 500 },
    notes:           { type: String, default: '', maxlength: 500 },
    createdAt:       { type: Date,   default: Date.now },
  }],

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC RESERVATION PAGE SETTINGS
  // Full config for the /e/:subdomain/reserve public-facing booking page.
  // ─────────────────────────────────────────────────────────────────────────
  reservationPageSettings: {

    // ── Master toggle ───────────────────────────────────────────────────────
    acceptingReservations:    { type: Boolean, default: false },
    // 'auto_confirm' = instant booking; 'manual' = staff must approve first
    confirmationMode:         { type: String, enum: ['auto_confirm', 'manual'], default: 'auto_confirm' },

    // ── Branding & appearance ───────────────────────────────────────────────
    heroImageUrl:             { type: String, default: '' },
    logoUrl:                  { type: String, default: '' },
    accentColor:              { type: String, default: '#f97316' },   // brand colour (hex)
    backgroundStyle:          { type: String, enum: ['dark', 'light', 'auto'], default: 'dark' },
    fontStyle:                { type: String, enum: ['modern', 'classic', 'playful'], default: 'modern' },
    headerTagline:            { type: String, default: '', maxlength: 120 },
    showPoweredBy:            { type: Boolean, default: true },
    hidePlanitBranding:       { type: Boolean, default: false },
    announcementBanner:       { type: String, default: '', maxlength: 200 },
    announcementBannerColor:  { type: String, default: '#f59e0b' },
    announcementBannerEnabled:{ type: Boolean, default: false },

    // ── Restaurant info shown on the page ───────────────────────────────────
    publicDescription:        { type: String, default: '', maxlength: 1000 },
    cuisine:                  { type: String, default: '', maxlength: 100 },
    priceRange:               { type: String, enum: ['$', '$$', '$$$', '$$$$', ''], default: '' },
    dressCode:                { type: String, default: '', maxlength: 200 },
    parkingInfo:              { type: String, default: '', maxlength: 300 },
    accessibilityInfo:        { type: String, default: '', maxlength: 300 },
    address:                  { type: String, default: '', maxlength: 300 },
    phone:                    { type: String, default: '', maxlength: 30 },
    websiteUrl:               { type: String, default: '' },
    instagramHandle:          { type: String, default: '' },
    facebookUrl:              { type: String, default: '' },
    googleMapsUrl:            { type: String, default: '' },

    // ── Operating schedule ──────────────────────────────────────────────────
    // Per-day open/close overrides. If a day has no override the global
    // tableServiceSettings hours are used. Setting a day to closed hides it.
    operatingDays: {
      mon: { open: { type: Boolean, default: true }, openTime: { type: String, default: '' }, closeTime: { type: String, default: '' } },
      tue: { open: { type: Boolean, default: true }, openTime: { type: String, default: '' }, closeTime: { type: String, default: '' } },
      wed: { open: { type: Boolean, default: true }, openTime: { type: String, default: '' }, closeTime: { type: String, default: '' } },
      thu: { open: { type: Boolean, default: true }, openTime: { type: String, default: '' }, closeTime: { type: String, default: '' } },
      fri: { open: { type: Boolean, default: true }, openTime: { type: String, default: '' }, closeTime: { type: String, default: '' } },
      sat: { open: { type: Boolean, default: true }, openTime: { type: String, default: '' }, closeTime: { type: String, default: '' } },
      sun: { open: { type: Boolean, default: true }, openTime: { type: String, default: '' }, closeTime: { type: String, default: '' } },
    },
    // Blackout dates — specific days completely closed
    blackoutDates: [{
      date:   { type: String },   // 'YYYY-MM-DD'
      reason: { type: String, default: '', maxlength: 100 },
    }],

    // ── Booking window rules ────────────────────────────────────────────────
    slotIntervalMinutes:      { type: Number, default: 30, min: 15, max: 120 },
    maxAdvanceDays:           { type: Number, default: 30, min: 1, max: 365 },
    minAdvanceHours:          { type: Number, default: 1,  min: 0, max: 72  },
    cancelCutoffHours:        { type: Number, default: 2,  min: 0, max: 168 },
    maxPartySizePublic:       { type: Number, default: 12, min: 1, max: 100 },
    minPartySizePublic:       { type: Number, default: 1,  min: 1, max: 20  },
    maxReservationsPerDay:    { type: Number, default: 0   },  // 0 = unlimited
    maxReservationsPerSlot:   { type: Number, default: 0   },  // 0 = unlimited
    // Block the last N minutes of service from being bookable (kitchen closes early)
    lastBookingBeforeCloseMinutes: { type: Number, default: 30, min: 0, max: 120 },

    // ── Required guest fields ───────────────────────────────────────────────
    requirePhone:             { type: Boolean, default: true  },
    requireEmail:             { type: Boolean, default: false },
    allowSpecialRequests:     { type: Boolean, default: true  },
    allowDietaryNeeds:        { type: Boolean, default: true  },
    allowOccasionSelect:      { type: Boolean, default: true  },
    // Custom occasions list shown in the dropdown
    occasionOptions:          [{ type: String, maxlength: 50 }],

    // ── Availability display ────────────────────────────────────────────────
    showLiveWaitTime:         { type: Boolean, default: true  },
    showAvailabilityStatus:   { type: Boolean, default: true  },  // 'Available / Limited / Full' labels
    showTableCount:           { type: Boolean, default: false },  // show exact free table count
    showPartySizeWaitTimes:   { type: Boolean, default: true  },  // "For 2: ~15 min, for 4: ~30 min"
    availabilityDisplayMode:  { type: String, enum: ['slots', 'calendar', 'both'], default: 'slots' },

    // ── Post-booking settings ───────────────────────────────────────────────
    confirmationMessage:      { type: String, default: '', maxlength: 500 },
    confirmationEmailSubject: { type: String, default: '', maxlength: 100 },
    sendConfirmationEmail:    { type: Boolean, default: true  },
    sendReminderEmail:        { type: Boolean, default: false },
    reminderHoursBefore:      { type: Number, default: 24, enum: [2, 4, 12, 24, 48, 72] },
    sendCancellationEmail:    { type: Boolean, default: true  },

    // ── Organizer notifications ─────────────────────────────────────────────
    notifyOrganizerOnBooking:   { type: Boolean, default: true  },
    notifyOrganizerOnCancel:    { type: Boolean, default: true  },
    notifyOrganizerEmail:       { type: String,  default: ''    },  // if blank, uses organizerEmail

    // ── Legal / policies ────────────────────────────────────────────────────
    cancellationPolicy:       { type: String, default: '', maxlength: 1000 },
    depositRequired:          { type: Boolean, default: false },
    depositAmount:            { type: Number,  default: 0     },
    depositNote:              { type: String,  default: '', maxlength: 200 },
    termsUrl:                 { type: String,  default: ''    },
    privacyUrl:               { type: String,  default: ''    },

    // ── Custom FAQ ──────────────────────────────────────────────────────────
    faqItems: [{
      question: { type: String, maxlength: 200 },
      answer:   { type: String, maxlength: 1000 },
    }],

    // ── SEO / meta ──────────────────────────────────────────────────────────
    metaTitle:       { type: String, default: '', maxlength: 100 },
    metaDescription: { type: String, default: '', maxlength: 300 },
  },

  // Walk-in waitlist (separate from the event waitlist)
  tableServiceWaitlist: [{
    id:        { type: String, required: true },
    partyName: { type: String, required: true, trim: true, maxlength: 100 },
    partySize: { type: Number, required: true, min: 1 },
    phone:     { type: String, default: '', trim: true, maxlength: 30 },
    notes:     { type: String, default: '', maxlength: 300 },
    addedAt:   { type: Date,   default: Date.now },
    notifiedAt:{ type: Date,   default: null },
    status:    { type: String, enum: ['waiting', 'notified', 'seated', 'left'], default: 'waiting' },
  }],

}, { timestamps: true });

eventSchema.index({ subdomain: 1 });
eventSchema.index({ organizerEmail: 1 });
eventSchema.index({ createdAt: -1 });

// Instance methods (unchanged from original)
eventSchema.methods.incrementViews = function () {
  this.metadata.views += 1;
  this.metadata.lastActivity = new Date();
  return this.save();
};

eventSchema.methods.addParticipant = function (username, role = 'participant') {
  const exists = this.participants.some(p => p.username === username);
  if (!exists) {
    if (this.participants.length >= this.maxParticipants) {
      const err = new Error('This event is full and cannot accept new participants.');
      err.statusCode = 400;
      throw err;
    }
    this.participants.push({ username, role });
    this.metadata.lastActivity = new Date();
  }
  return this.save();
};

eventSchema.methods.removeParticipant = function (username) {
  this.participants = this.participants.filter(p => p.username !== username);
  this.metadata.lastActivity = new Date();
  return this.save();
};

eventSchema.methods.setRsvp = function (username, status) {
  const existing = this.rsvps.find(r => r.username === username);
  if (existing) {
    existing.status    = status;
    existing.updatedAt = new Date();
  } else {
    this.rsvps.push({ username, status });
  }
  return this.save();
};

eventSchema.methods.getRsvpSummary = function () {
  const counts = { yes: 0, maybe: 0, no: 0 };
  this.rsvps.forEach(r => counts[r.status]++);
  return counts;
};

eventSchema.methods.getTaskStats = function () {
  const total     = this.tasks.length;
  const completed = this.tasks.filter(t => t.completed).length;
  const byPriority = { low: 0, medium: 0, high: 0 };
  this.tasks.forEach(t => byPriority[t.priority]++);
  return { total, completed, pending: total - completed, byPriority };
};

eventSchema.methods.getExpenseSummary = function () {
  const total = this.expenses.reduce((s, e) => s + e.amount, 0);
  const byCategory = {};
  this.expenses.forEach(e => {
    const cat = e.category || 'Uncategorized';
    byCategory[cat] = (byCategory[cat] || 0) + e.amount;
  });
  return { total, count: this.expenses.length, byCategory, remaining: this.budget - total };
};

eventSchema.methods.getAnalytics = function () {
  return {
    views:        this.metadata.views,
    participants: this.participants.length,
    messages:     0,
    polls:        0,
    files:        0,
    rsvps:        this.getRsvpSummary(),
    tasks:        this.getTaskStats(),
    expenses:     this.getExpenseSummary(),
    lastActivity: this.metadata.lastActivity,
  };
};

module.exports = mongoose.model('Event', eventSchema);
