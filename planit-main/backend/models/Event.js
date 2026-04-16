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
  date:          { type: Date, required: false },
  timezone:      { type: String, required: true, default: 'UTC' },
  location:      { type: String, trim: true, maxlength: 500 },
  organizerName: { type: String, required: true, trim: true, maxlength: 100 },
  organizerEmail: {
    type: String, required: true, trim: true, lowercase: true,
    match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
  // White-label domain that owns this event (set at creation, used for scoped discovery)
  wlDomain: { type: String, trim: true, lowercase: true, default: null },
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
    // Servers on shift — assigned to tables by name
    servers: [{
      id:   { type: String },
      name: { type: String, trim: true, maxlength: 60 },
    }],
    // Billing defaults — used by auto-calculate bill
    taxRate:              { type: Number, default: 8.875, min: 0, max: 100 },
    autoGratuityPct:      { type: Number, default: 18,   min: 0, max: 100 },
    autoGratuityMinParty: { type: Number, default: 6,    min: 1, max: 99  },
    paymentNote:          { type: String, default: '', maxlength: 200 },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // RESTAURANT MENU — orderable items shown on guest & server tablets
  // priceCents stores price as integer cents to avoid float rounding.
  // ─────────────────────────────────────────────────────────────────────────
  restaurantMenu: {
    categories: [{
      id:   { type: String, required: true },
      name: { type: String, required: true, trim: true, maxlength: 60 },
      ord:  { type: Number, default: 0 },
      items: [{
        id:         { type: String, required: true },
        name:       { type: String, required: true, trim: true, maxlength: 100 },
        desc:       { type: String, default: '', trim: true, maxlength: 300 },
        priceCents: { type: Number, required: true, min: 0 },
        dietary:    [{ type: String, maxlength: 20 }],
        available:  { type: Boolean, default: true },
        ord:        { type: Number, default: 0 },
        courseType: { type: String, enum: ['appetizer','main','side','dessert','drink','other'], default: 'main' },
      }],
    }],
    updatedAt: { type: Date, default: null },
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

    // ── Guest tablet fields ──────────────────────────────────────────────
    // Controlled by server: which screen the guest tablet shows
    guestScreen:        { type: String, enum: ['idle', 'dining', 'bill', 'rating'], default: 'idle' },
    // Controlled by guest: alert type sent to server
    guestAlert:         { type: String, enum: ['call', 'order', 'quick:water', 'quick:napkins', 'quick:menu', 'quick:dessert', null], default: null },
    // Controlled by guest: dietary restrictions
    guestDietary:       [{ type: String, maxlength: 50 }],
    guestDietaryNotes:  { type: String, default: '', maxlength: 300 },
    // Controlled by server: bill amounts sent to guest tablet
    billSubtotal:       { type: Number, default: null },
    billTax:            { type: Number, default: null },
    billPaid:           { type: Boolean, default: false },
    // Controlled by guest: tip preference (informational only)
    tipPct:             { type: Number, default: null },
    // Controlled by guest: post-meal rating
    guestRating: {
      food:        { type: Number, min: 1, max: 5, default: null },
      service:     { type: Number, min: 1, max: 5, default: null },
      atmosphere:  { type: Number, min: 1, max: 5, default: null },
      comment:     { type: String, default: '', maxlength: 300 },
      submittedAt: { type: Date,   default: null },
    },
    // Orders placed by server for this table (cleared on table reset)
    orders: [{
      id:             { type: String, required: true },
      itemId:         { type: String, required: true },
      itemName:       { type: String, required: true, maxlength: 100 },
      priceCents:     { type: Number, required: true, min: 0 },
      qty:            { type: Number, default: 1, min: 1 },
      courseType:     { type: String, default: 'main' },
      dietary:        [{ type: String, maxlength: 20 }],
      specialRequest: { type: String, default: '', maxlength: 200 },
      serverName:     { type: String, default: '' },
      // pending→acknowledged→preparing→ready→delivered | cancelled
      status:         { type: String, enum: ['pending','acknowledged','preparing','ready','delivered','cancelled'], default: 'pending' },
      placedAt:       { type: Date, default: Date.now },
      updatedAt:      { type: Date, default: Date.now },
    }],
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

    // ── Menus — compact keys to minimise stored document size ────────────────
    // n = name, t = type (l=link, p=pdf, d=description-only)
    // u = url, d = description, c = category, clr = accent colour, ord = sort order
    menus: [{
      n:   { type: String, required: true, trim: true, maxlength: 60 },
      t:   { type: String, enum: ['l','p','d'], default: 'l' },
      u:   { type: String, default: '', maxlength: 500 },
      d:   { type: String, default: '', maxlength: 400 },
      c:   { type: String, default: '', maxlength: 40  },
      clr: { type: String, default: ''                 },
      ord: { type: Number, default: 0                  },
    }],

    // ── SEO / meta ──────────────────────────────────────────────────────────
    metaTitle:       { type: String, default: '', maxlength: 100 },
    metaDescription: { type: String, default: '', maxlength: 300 },

    // ── Walk-in / wait board ─────────────────────────────────────────────────
    // When true, the reservation page shows a walk-in queue instead of a booking form.
    walkInOnlyMode:          { type: Boolean, default: false },
    publicWaitBoardEnabled:  { type: Boolean, default: false },
    waitBoardTitle:          { type: String,  default: '', maxlength: 100 },
    waitBoardMessage:        { type: String,  default: '', maxlength: 500 },
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

  // ─────────────────────────────────────────────────────────────────────────
  // RSVP PAGE SETTINGS
  // Full configuration for the public-facing /e/:subdomain RSVP landing page.
  // Available in Enterprise and Standard event modes.
  // ─────────────────────────────────────────────────────────────────────────
  rsvpPage: {

    // ── Master toggles ────────────────────────────────────────────────────────
    enabled:          { type: Boolean, default: false },
    accessMode:       { type: String, enum: ['open', 'password', 'closed'], default: 'open' },
    rsvpPassword:     { type: String, default: '' },
    confirmationMode: { type: String, enum: ['auto_confirm', 'approval'], default: 'auto_confirm' },

    // ── Branding & appearance ─────────────────────────────────────────────────
    coverImageUrl:    { type: String, default: '' },
    logoUrl:          { type: String, default: '' },
    accentColor:      { type: String, default: '#6366f1' },
    backgroundStyle:  { type: String, enum: ['dark', 'light', 'gradient', 'frosted'], default: 'dark' },
    fontStyle:        { type: String, enum: ['modern', 'classic', 'elegant', 'bold'], default: 'modern' },
    bannerText:       { type: String, default: '', maxlength: 200 },
    bannerColor:      { type: String, default: '#f59e0b' },
    bannerEnabled:    { type: Boolean, default: false },
    hideBranding:     { type: Boolean, default: false },

    // ── Hero content ─────────────────────────────────────────────────────────
    heroTagline:      { type: String, default: '', maxlength: 200 },
    welcomeTitle:     { type: String, default: '', maxlength: 200 },
    welcomeMessage:   { type: String, default: '', maxlength: 3000 },

    // ── Deadline & capacity ───────────────────────────────────────────────────
    deadline:             { type: Date, default: null },
    deadlineMessage:      { type: String, default: '', maxlength: 200 },
    capacityLimit:        { type: Number, default: 0, min: 0 },
    enableWaitlist:       { type: Boolean, default: true },
    waitlistMessage:      { type: String, default: '', maxlength: 300 },

    // ── Response options ──────────────────────────────────────────────────────
    allowYes:             { type: Boolean, default: true },
    allowMaybe:           { type: Boolean, default: true },
    allowNo:              { type: Boolean, default: true },
    yesButtonLabel:       { type: String, default: 'Attending', maxlength: 50 },
    maybeButtonLabel:     { type: String, default: 'Maybe', maxlength: 50 },
    noButtonLabel:        { type: String, default: 'Not Attending', maxlength: 50 },

    // ── Guest information fields ──────────────────────────────────────────────
    requireFirstName:      { type: Boolean, default: true },
    requireLastName:       { type: Boolean, default: false },
    collectEmail:          { type: Boolean, default: true },
    requireEmail:          { type: Boolean, default: true },
    collectPhone:          { type: Boolean, default: false },
    requirePhone:          { type: Boolean, default: false },

    // ── Plus-ones ─────────────────────────────────────────────────────────────
    allowPlusOnes:         { type: Boolean, default: false },
    maxPlusOnes:           { type: Number, default: 5, min: 0, max: 50 },
    requirePlusOneNames:   { type: Boolean, default: false },
    collectPlusOneDietary: { type: Boolean, default: false },

    // ── Extra guest fields ────────────────────────────────────────────────────
    collectDietary:        { type: Boolean, default: false },
    dietaryLabel:          { type: String, default: 'Dietary requirements', maxlength: 100 },
    collectAccessibility:  { type: Boolean, default: false },
    accessibilityLabel:    { type: String, default: 'Accessibility needs', maxlength: 100 },
    allowGuestNote:        { type: Boolean, default: false },
    guestNoteLabel:        { type: String, default: 'Additional notes', maxlength: 100 },
    guestNotePlaceholder:  { type: String, default: '', maxlength: 200 },

    // ── Custom questions (stored as array of objects) ─────────────────────────
    // Schema per item: { id, label, type, required, options[], placeholder, helpText, order }
    customQuestions:       { type: mongoose.Schema.Types.Mixed, default: [] },

    // ── Confirmation screen ───────────────────────────────────────────────────
    confirmationTitle:       { type: String, default: '', maxlength: 200 },
    confirmationMessage:     { type: String, default: '', maxlength: 2000 },
    confirmationImageUrl:    { type: String, default: '' },
    showEventSpaceButton:    { type: Boolean, default: false },
    eventSpaceButtonLabel:   { type: String, default: 'View Event Details', maxlength: 80 },
    showAddToCalendar:        { type: Boolean, default: true },
    showShareButton:          { type: Boolean, default: true },

    // ── Email notifications ───────────────────────────────────────────────────
    sendGuestConfirmation:    { type: Boolean, default: false },
    confirmationEmailSubject: { type: String, default: '', maxlength: 200 },
    confirmationEmailBody:    { type: String, default: '', maxlength: 3000 },
    notifyOrganizerOnRsvp:    { type: Boolean, default: true },
    organizerNotifyEmail:     { type: String, default: '', maxlength: 200 },

    // ── Display options ───────────────────────────────────────────────────────
    showGuestCount:        { type: Boolean, default: true },
    showEventDate:         { type: Boolean, default: true },
    showEventLocation:     { type: Boolean, default: true },
    showEventDescription:  { type: Boolean, default: true },
    showHostName:          { type: Boolean, default: true },
    showCountdown:         { type: Boolean, default: false },
    allowGuestEdit:        { type: Boolean, default: true },
    editCutoffHours:       { type: Number, default: 24, min: 0 },

    // ── Security ──────────────────────────────────────────────────────────────
    rateLimitPerIp:        { type: Number, default: 5, min: 1, max: 100 },
    duplicateEmailPolicy:  { type: String, enum: ['allow', 'block', 'warn_organizer'], default: 'warn_organizer' },
    enableHoneypot:        { type: Boolean, default: true },

    // ── Metadata ─────────────────────────────────────────────────────────────
    updatedAt: { type: Date, default: null },
    updatedBy: { type: String, default: null },
  },

}, { timestamps: true });

eventSchema.index({ subdomain: 1 });
eventSchema.index({ organizerEmail: 1 });
eventSchema.index({ createdAt: -1 });
eventSchema.index({ wlDomain: 1 });

// Instance methods (unchanged from original)
eventSchema.methods.incrementViews = function () {
  return this.constructor.updateOne(
    { _id: this._id },
    {
      $inc: { 'metadata.views': 1 },
      $set: { 'metadata.lastActivity': new Date() },
    }
  );
};

eventSchema.methods.addParticipant = function (username, role = 'participant') {
  const exists = this.participants.some(p => p.username === username);
  if (!exists) {
    if (this.participants.length >= this.maxParticipants) {
      const err = new Error('This event is full and cannot accept new participants.');
      err.statusCode = 400;
      throw err;
    }
  }
  return this.constructor.updateOne(
    { _id: this._id },
    {
      $addToSet: { participants: { username, role } },
      $set: { 'metadata.lastActivity': new Date() },
    }
  );
};

eventSchema.methods.removeParticipant = function (username) {
  return this.constructor.updateOne(
    { _id: this._id },
    {
      $pull: { participants: { username } },
      $set: { 'metadata.lastActivity': new Date() },
    }
  );
};

eventSchema.methods.setRsvp = function (username, status) {
  const existing = this.rsvps.find(r => r.username === username);
  if (existing) {
    return this.constructor.updateOne(
      { _id: this._id, 'rsvps.username': username },
      { $set: { 'rsvps.$.status': status, 'rsvps.$.updatedAt': new Date() } }
    );
  }
  return this.constructor.updateOne(
    { _id: this._id },
    { $push: { rsvps: { username, status } } }
  );
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
