'use strict';

/**
 * models/PlatformAnalytics.js
 *
 * Stores every platform interaction event — page views, clicks, feature usage,
 * session data — in the audit database (same separate-connection pattern as AuditLog).
 *
 * DESIGN
 * ──────
 * • Same audit DB connection as AuditLog (AUDIT_MONGODB_URI or MONGODB_URI fallback).
 * • Payload field is AES-256-GCM encrypted (reuses AUDIT_ENCRYPTION_KEY).
 * • TTL auto-purge: 90 days by default (ANALYTICS_RETENTION_DAYS env override).
 * • Lightweight schema — aggregations are done at query time in the route.
 *
 * EVENT TYPES
 * ───────────
 *  page_view       — user lands on / navigates to a page
 *  page_exit       — user leaves a page (carries time_on_page_ms)
 *  click           — any DOM click (element tag, id, class, text snippet)
 *  scroll_depth    — max scroll % reached on a page
 *  feature_use     — named feature interaction (e.g. "event_created", "checkin")
 *  session_start   — new session begins
 *  session_end     — session ends (carries total_duration_ms)
 *  error           — unhandled JS error
 *  outbound_link   — user clicked an external link
 *  search          — user typed in a search/filter box
 */

const mongoose = require('mongoose');
const crypto   = require('crypto');

// ─── Reuse audit DB connection from AuditLog ──────────────────────────────────
// We re-require the module so we don't duplicate the connection logic.
function _getConn() {
  try {
    // Trigger connection creation in AuditLog module (idempotent)
    const { audit } = require('./AuditLog'); // eslint-disable-line
    // Pull the private connection out via a small shim
    const uri = process.env.AUDIT_MONGODB_URI || process.env.MONGODB_URI;
    if (!uri) return null;
    // Create a dedicated connection for analytics (keeps pool separate)
    if (!_getConn._conn) {
      _getConn._conn = mongoose.createConnection(uri, {
        maxPoolSize: 3,
        serverSelectionTimeoutMS: 8000,
      });
      _getConn._conn.once('open',  () => console.log('[analytics-db] Connected'));
      _getConn._conn.once('error', e  => console.error('[analytics-db] Error:', e.message));
    }
    return _getConn._conn;
  } catch {
    return null;
  }
}

// ─── Encryption (same key as AuditLog) ───────────────────────────────────────
const ENC_KEY_HEX = (process.env.AUDIT_ENCRYPTION_KEY || '').trim();
const ENC_KEY = ENC_KEY_HEX.length === 64 ? Buffer.from(ENC_KEY_HEX, 'hex') : null;

function encryptPayload(obj) {
  if (obj == null) return null;
  const plain = JSON.stringify(obj);
  if (!ENC_KEY) return { enc: false, data: Buffer.from(plain).toString('base64') };
  const iv     = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENC_KEY, iv);
  const enc    = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag    = cipher.getAuthTag();
  return { enc: true, iv: iv.toString('hex'), tag: tag.toString('hex'), data: enc.toString('hex') };
}

function decryptPayload(stored) {
  if (!stored || !stored.data) return null;
  if (!stored.enc) {
    try { return JSON.parse(Buffer.from(stored.data, 'base64').toString('utf8')); }
    catch { return stored.data; }
  }
  if (!ENC_KEY) return '[encrypted — AUDIT_ENCRYPTION_KEY missing]';
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', ENC_KEY, Buffer.from(stored.iv, 'hex'));
    decipher.setAuthTag(Buffer.from(stored.tag, 'hex'));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(stored.data, 'hex')), decipher.final()]).toString('utf8'));
  } catch { return '[decryption failed]'; }
}

// ─── Schema ───────────────────────────────────────────────────────────────────
const RETENTION_SECS = parseInt(process.env.ANALYTICS_RETENTION_DAYS || '90', 10) * 86400;

const analyticsSchema = new mongoose.Schema(
  {
    // Session / visitor identity (never PII — all stored as opaque IDs)
    sessionId:  { type: String, required: true, index: true },
    visitorId:  { type: String, required: true, index: true }, // localStorage-based fingerprint

    // Event classification
    eventType: {
      type: String,
      required: true,
      enum: [
        'page_view', 'page_exit', 'click', 'scroll_depth',
        'feature_use', 'session_start', 'session_end',
        'error', 'outbound_link', 'search',
      ],
      index: true,
    },

    // Page context
    page:     { type: String, default: '/' },       // pathname
    pageGroup:{ type: String, default: 'other' },   // normalised group (event, admin, public …)

    // Timing
    ts:           { type: Date, default: Date.now, index: true }, // event timestamp
    timeOnPageMs: { type: Number, default: null },                 // for page_exit / session_end

    // Encrypted detailed payload (click target, scroll %, feature name, error msg, etc.)
    payload: { type: mongoose.Schema.Types.Mixed, default: null },

    // UTM / referrer (top-level for fast aggregation)
    referrer:     { type: String, default: null },
    utmSource:    { type: String, default: null },
    utmMedium:    { type: String, default: null },
    utmCampaign:  { type: String, default: null },

    // Device hints (from User-Agent on ingest) — no PII
    deviceType:   { type: String, enum: ['desktop', 'tablet', 'mobile', 'unknown'], default: 'unknown' },
    browser:      { type: String, default: null },

    // TTL
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: false, versionKey: false }
);

analyticsSchema.index({ createdAt: 1 }, { expireAfterSeconds: RETENTION_SECS });
analyticsSchema.index({ page: 1, ts: -1 });
analyticsSchema.index({ visitorId: 1, ts: -1 });
analyticsSchema.index({ eventType: 1, ts: -1 });
analyticsSchema.index({ pageGroup: 1, ts: -1 });

// ─── Model ─────────────────────────────────────────────────────────────────────
let _Model = null;
function getModel() {
  if (_Model) return _Model;
  const conn = _getConn();
  if (!conn) return null;
  try {
    _Model = conn.model('PlatformAnalytics', analyticsSchema);
  } catch {
    _Model = conn.model('PlatformAnalytics');
  }
  return _Model;
}

// ─── Device detection (simple, no library) ───────────────────────────────────
function detectDevice(ua = '') {
  const s = ua.toLowerCase();
  if (/mobile|android|iphone|ipod/.test(s)) return 'mobile';
  if (/ipad|tablet/.test(s)) return 'tablet';
  if (/bot|crawler|spider|headless/.test(s)) return 'bot';
  if (s) return 'desktop';
  return 'unknown';
}
function detectBrowser(ua = '') {
  const s = ua.toLowerCase();
  if (s.includes('edg/')) return 'Edge';
  if (s.includes('chrome/') && !s.includes('chromium')) return 'Chrome';
  if (s.includes('firefox/')) return 'Firefox';
  if (s.includes('safari/') && !s.includes('chrome')) return 'Safari';
  if (s.includes('opera/') || s.includes('opr/')) return 'Opera';
  return 'Other';
}

// ─── Normalise pathname → page group ─────────────────────────────────────────
function pageGroup(pathname) {
  if (!pathname || pathname === '/') return 'home';
  if (pathname.startsWith('/event/') || pathname.startsWith('/e/')) return 'event';
  if (pathname.startsWith('/admin')) return 'admin';
  if (pathname.startsWith('/dashboard')) return 'dashboard';
  if (pathname.startsWith('/blog')) return 'blog';
  if (pathname.startsWith('/discover')) return 'discover';
  if (pathname.startsWith('/invite') || pathname.startsWith('/badge') || pathname.startsWith('/card')) return 'invite';
  if (pathname.startsWith('/reservation') || pathname.startsWith('/reserve')) return 'reservation';
  if (['/about','/terms','/privacy','/license'].includes(pathname)) return 'legal/info';
  if (['/support','/support/success'].includes(pathname)) return 'support';
  if (['/status','/help'].includes(pathname)) return 'util';
  if (pathname.startsWith('/white-label')) return 'whitelabel';
  return 'other';
}

// ─── Public helpers ───────────────────────────────────────────────────────────

/**
 * Ingest a batch of tracking events from the frontend.
 * Never throws — a tracking failure must never break a user request.
 */
async function ingestBatch(events = [], req) {
  try {
    const Model = getModel();
    if (!Model || !Array.isArray(events) || events.length === 0) return;

    const ua     = req?.headers?.['user-agent'] || '';
    const device = detectDevice(ua);
    if (device === 'bot') return; // silently drop bot traffic

    const browser = detectBrowser(ua);

    const docs = events.map(ev => ({
      sessionId:    (ev.sessionId  || '').slice(0, 64),
      visitorId:    (ev.visitorId  || '').slice(0, 64),
      eventType:    ev.eventType,
      page:         (ev.page       || '/').slice(0, 500),
      pageGroup:    pageGroup(ev.page || '/'),
      ts:           ev.ts ? new Date(ev.ts) : new Date(),
      timeOnPageMs: ev.timeOnPageMs ?? null,
      payload:      encryptPayload(ev.payload || null),
      referrer:     ev.referrer    ? ev.referrer.slice(0, 500)   : null,
      utmSource:    ev.utmSource   ? ev.utmSource.slice(0, 100)  : null,
      utmMedium:    ev.utmMedium   ? ev.utmMedium.slice(0, 100)  : null,
      utmCampaign:  ev.utmCampaign ? ev.utmCampaign.slice(0, 100): null,
      deviceType:   device,
      browser,
      createdAt:    new Date(),
    }));

    await Model.insertMany(docs, { ordered: false });
  } catch (err) {
    if (err.code !== 11000) { // ignore duplicate key
      console.error('[analytics] ingestBatch failed (non-fatal):', err.message);
    }
  }
}

/**
 * Aggregate dashboard data for the admin panel.
 * Returns a rich stats object covering the requested window.
 */
async function getDashboardData(windowDays = 30) {
  const Model = getModel();
  if (!Model) return null;

  const since = new Date(Date.now() - windowDays * 86400_000);
  const prev  = new Date(Date.now() - windowDays * 2 * 86400_000);

  const [
    totalPageViews,
    prevPageViews,
    uniqueVisitors,
    prevUniqueVisitors,
    topPages,
    pageGroupBreakdown,
    avgTimeOnPage,
    bounceData,
    featureUsage,
    deviceBreakdown,
    browserBreakdown,
    referrerBreakdown,
    utmBreakdown,
    hourlyTraffic,
    dailyTraffic,
    clickTargets,
    recentErrors,
    scrollDepths,
    searchQueries,
  ] = await Promise.all([
    // Total page views this window
    Model.countDocuments({ eventType: 'page_view', ts: { $gte: since } }),

    // Previous window for trend
    Model.countDocuments({ eventType: 'page_view', ts: { $gte: prev, $lt: since } }),

    // Unique visitors this window
    Model.distinct('visitorId', { eventType: 'page_view', ts: { $gte: since } })
      .then(ids => ids.length),

    // Previous window unique visitors
    Model.distinct('visitorId', { eventType: 'page_view', ts: { $gte: prev, $lt: since } })
      .then(ids => ids.length),

    // Top pages by view count
    Model.aggregate([
      { $match: { eventType: 'page_view', ts: { $gte: since } } },
      { $group: { _id: '$page', views: { $sum: 1 }, visitors: { $addToSet: '$visitorId' } } },
      { $project: { page: '$_id', views: 1, uniqueVisitors: { $size: '$visitors' } } },
      { $sort: { views: -1 } },
      { $limit: 20 },
    ]),

    // Page group breakdown
    Model.aggregate([
      { $match: { eventType: 'page_view', ts: { $gte: since } } },
      { $group: { _id: '$pageGroup', views: { $sum: 1 } } },
      { $sort: { views: -1 } },
    ]),

    // Avg time on page (from page_exit events)
    Model.aggregate([
      { $match: { eventType: 'page_exit', ts: { $gte: since }, timeOnPageMs: { $gt: 0, $lt: 3600000 } } },
      { $group: { _id: '$page', avgMs: { $avg: '$timeOnPageMs' }, samples: { $sum: 1 } } },
      { $sort: { samples: -1 } },
      { $limit: 20 },
    ]),

    // Bounce rate: sessions with only 1 page view
    Model.aggregate([
      { $match: { eventType: 'page_view', ts: { $gte: since } } },
      { $group: { _id: '$sessionId', pages: { $sum: 1 } } },
      { $group: {
        _id: null,
        total: { $sum: 1 },
        bounced: { $sum: { $cond: [{ $lte: ['$pages', 1] }, 1, 0] } },
      }},
    ]),

    // Feature usage breakdown
    Model.aggregate([
      { $match: { eventType: 'feature_use', ts: { $gte: since } } },
      { $group: { _id: null, payloads: { $push: '$payload' }, count: { $sum: 1 } } },
    ]).then(async rows => {
      // Feature names are encrypted — do a lighter query for just counts
      return Model.aggregate([
        { $match: { eventType: 'feature_use', ts: { $gte: since } } },
        { $group: { _id: '$page', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 15 },
      ]);
    }),

    // Device breakdown
    Model.aggregate([
      { $match: { eventType: 'page_view', ts: { $gte: since } } },
      { $group: { _id: '$deviceType', count: { $sum: 1 } } },
    ]),

    // Browser breakdown
    Model.aggregate([
      { $match: { eventType: 'page_view', ts: { $gte: since } } },
      { $group: { _id: '$browser', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),

    // Referrer breakdown (top 15, null = direct)
    Model.aggregate([
      { $match: { eventType: 'page_view', ts: { $gte: since } } },
      { $group: { _id: { $ifNull: ['$referrer', '(direct)'] }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 15 },
    ]),

    // UTM source breakdown
    Model.aggregate([
      { $match: { eventType: 'page_view', ts: { $gte: since }, utmSource: { $ne: null } } },
      { $group: { _id: '$utmSource', medium: { $first: '$utmMedium' }, campaign: { $first: '$utmCampaign' }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 15 },
    ]),

    // Hourly traffic (last 24h)
    Model.aggregate([
      { $match: { eventType: 'page_view', ts: { $gte: new Date(Date.now() - 86400_000) } } },
      { $group: {
        _id: { $hour: '$ts' },
        views: { $sum: 1 },
        visitors: { $addToSet: '$visitorId' },
      }},
      { $project: { hour: '$_id', views: 1, uniqueVisitors: { $size: '$visitors' } } },
      { $sort: { hour: 1 } },
    ]),

    // Daily traffic (last N days)
    Model.aggregate([
      { $match: { eventType: 'page_view', ts: { $gte: since } } },
      { $group: {
        _id: {
          y: { $year: '$ts' },
          m: { $month: '$ts' },
          d: { $dayOfMonth: '$ts' },
        },
        views: { $sum: 1 },
        visitors: { $addToSet: '$visitorId' },
      }},
      { $project: {
        date: {
          $dateFromParts: { year: '$_id.y', month: '$_id.m', day: '$_id.d' },
        },
        views: 1,
        uniqueVisitors: { $size: '$visitors' },
      }},
      { $sort: { date: 1 } },
    ]),

    // Top click targets (element text / id snippets — from encrypted payload, best effort)
    Model.aggregate([
      { $match: { eventType: 'click', ts: { $gte: since } } },
      { $group: { _id: '$page', clicks: { $sum: 1 } } },
      { $sort: { clicks: -1 } },
      { $limit: 20 },
    ]),

    // Recent errors
    Model.find({ eventType: 'error', ts: { $gte: since } })
      .sort({ ts: -1 })
      .limit(20)
      .lean()
      .then(rows => rows.map(r => ({ ...r, payload: decryptPayload(r.payload) }))),

    // Scroll depth averages
    Model.aggregate([
      { $match: { eventType: 'scroll_depth', ts: { $gte: since } } },
      { $group: { _id: '$page', avgDepth: { $avg: '$timeOnPageMs' }, samples: { $sum: 1 } } },
      { $sort: { samples: -1 } },
      { $limit: 10 },
    ]),

    // Search query count
    Model.countDocuments({ eventType: 'search', ts: { $gte: since } }),
  ]);

  // Compute session count
  const sessionCount = await Model.distinct('sessionId', { ts: { $gte: since } }).then(ids => ids.length);

  // Avg session duration
  const sessionDurations = await Model.aggregate([
    { $match: { eventType: 'session_end', ts: { $gte: since }, timeOnPageMs: { $gt: 0 } } },
    { $group: { _id: null, avgMs: { $avg: '$timeOnPageMs' } } },
  ]);

  const bounceRate = bounceData[0]
    ? Math.round((bounceData[0].bounced / bounceData[0].total) * 100)
    : 0;

  const trend = (cur, prev) => prev === 0 ? null : Math.round(((cur - prev) / prev) * 100);

  return {
    window: windowDays,
    summary: {
      pageViews:          totalPageViews,
      pageViewsTrend:     trend(totalPageViews, prevPageViews),
      uniqueVisitors,
      uniqueVisitorsTrend:trend(uniqueVisitors, prevUniqueVisitors),
      sessions:           sessionCount,
      bounceRate,
      avgSessionMs:       sessionDurations[0]?.avgMs ?? null,
      searchQueries,
    },
    topPages:         topPages.map(r => ({ page: r.page, views: r.views, uniqueVisitors: r.uniqueVisitors })),
    pageGroupBreakdown: pageGroupBreakdown.map(r => ({ group: r._id, views: r.views })),
    avgTimeOnPage:    avgTimeOnPage.map(r => ({ page: r._id, avgMs: Math.round(r.avgMs), samples: r.samples })),
    featureUsage:     featureUsage.map(r => ({ page: r._id, count: r.count })),
    devices:          deviceBreakdown.map(r => ({ device: r._id, count: r.count })),
    browsers:         browserBreakdown.map(r => ({ browser: r._id, count: r.count })),
    referrers:        referrerBreakdown.map(r => ({ referrer: r._id, count: r.count })),
    utmSources:       utmBreakdown.map(r => ({ source: r._id, medium: r.medium, campaign: r.campaign, count: r.count })),
    hourlyTraffic:    hourlyTraffic.map(r => ({ hour: r.hour, views: r.views, uniqueVisitors: r.uniqueVisitors })),
    dailyTraffic:     dailyTraffic.map(r => ({ date: r.date, views: r.views, uniqueVisitors: r.uniqueVisitors })),
    topClickPages:    clickTargets.map(r => ({ page: r._id, clicks: r.clicks })),
    recentErrors,
    scrollDepths:     scrollDepths.map(r => ({ page: r._id, avgDepth: Math.round(r.avgDepth ?? 0), samples: r.samples })),
  };
}

module.exports = { ingestBatch, getDashboardData, decryptPayload };
