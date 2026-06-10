/**
 * services/tracker.js
 *
 * PlanIt Backend Feature-Event Tracker
 * ─────────────────────────────────────
 * Sends named business events (feature_use, guest actions) to the PlanIt
 * backend analytics endpoint. Google Analytics 4 now handles all page/session/
 * click/scroll tracking — this module is limited to custom business events that
 * are specific to PlanIt's platform (e.g. event_created, checkin_completed).
 *
 * CONSENT
 * ───────
 * All enqueue() calls are gated on _trackingEnabled. Nothing is sent until the
 * user accepts the consent banner (planit:consent DOM event) or we detect a
 * stored acceptance from a previous session.
 */

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');
const TRACK_URL = `${API_BASE}/platform-analytics/track`;

const CONSENT_KEY     = 'planit_cookie_consent';
const CONSENT_VERSION = '1';

function getStoredConsent() {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.v !== CONSENT_VERSION) return null;
    return parsed.accepted === true;
  } catch { return null; }
}

// ─── Tracking gate ────────────────────────────────────────────────────────────
let _trackingEnabled = false;

// ─── Event context ────────────────────────────────────────────────────────────
let _linkedEventId        = null;
let _linkedEventSubdomain = null;

// ─── Identity ─────────────────────────────────────────────────────────────────
function getId(key, prefix) {
  try {
    let id = localStorage.getItem(key);
    if (!id) {
      id = `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

const visitorId = getId('planit_vid', 'v');
let   sessionId = getId('planit_sid', 's');

// ─── Queue / flush ────────────────────────────────────────────────────────────
const queue = [];
let flushTimer = null;
let isFlushing = false;

function enqueue(eventType, extra = {}) {
  if (!_trackingEnabled) return;
  queue.push({
    eventType,
    sessionId,
    visitorId,
    page: window.location.pathname,
    ts: new Date().toISOString(),
    ...(_linkedEventId ? { linkedEventId: _linkedEventId, linkedEventSubdomain: _linkedEventSubdomain } : {}),
    ...extra,
  });
  scheduleFlush();
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => { flushTimer = null; flush(); }, 5000);
}

async function flush(sync = false) {
  if (isFlushing || queue.length === 0) return;
  isFlushing = true;
  const batch = queue.splice(0, 50);
  const body  = JSON.stringify({ events: batch });
  try {
    if (sync && navigator.sendBeacon) {
      navigator.sendBeacon(TRACK_URL, new Blob([body], { type: 'application/json' }));
    } else {
      await fetch(TRACK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true });
    }
  } catch { /* never surface tracking errors */ } finally {
    isFlushing = false;
    if (queue.length > 0) scheduleFlush();
  }
}

// ─── Initialise consent ───────────────────────────────────────────────────────
function startTracking() {
  _trackingEnabled = true;
}

/**
 * Called once by usePageTracker on mount. Mirrors the initGA() consent flow.
 * Also used by usePageTracker to pass the current path on navigation.
 */
export function trackPageChange(pathname) {
  // No-op for page tracking — GA4 handles that.
  // This function is kept so usePageTracker imports remain stable.
  if (!_trackingEnabled) return;
}

// Initialise consent on first import
(function bootstrap() {
  if (typeof window === 'undefined') return;
  const consent = getStoredConsent();
  if (consent === true) { startTracking(); return; }
  if (consent === false) return;
  document.addEventListener('planit:consent', (e) => {
    if (e.detail?.accepted === true) startTracking();
  }, { once: true });
})();

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Track a named feature interaction (backend only).
 * @param {string} feature  e.g. 'event_created', 'checkin_completed'
 * @param {object} [meta]   optional extra data (no PII)
 */
export function trackFeature(feature, meta = {}) {
  enqueue('feature_use', { payload: { feature, ...meta } });
}

/**
 * Track a guest-level action that carries PII and/or RSVP status.
 */
export function trackGuestAction(feature, { pii, rsvpStatus, ...meta } = {}) {
  enqueue('feature_use', {
    payload: { feature, ...meta },
    ...(pii        ? { pii }        : {}),
    ...(rsvpStatus ? { rsvpStatus } : {}),
  });
}

/**
 * Set the current event context. Call from EventSpace/RSVPPage.
 * Pass (null, null) when navigating away.
 */
export function setEventContext(eventId, subdomain) {
  _linkedEventId        = eventId   ? String(eventId)   : null;
  _linkedEventSubdomain = subdomain ? String(subdomain) : null;
}

/** Flush remaining events immediately (e.g. on unmount). */
export function flushTracker() {
  flush(true);
}

/** Returns whether backend feature tracking is active. */
export function isTrackingActive() {
  return _trackingEnabled;
}

// Legacy alias — initTracker was imported in some places
export function initTracker() {
  // No-op: bootstrapped automatically on import; consent handled inline.
}
