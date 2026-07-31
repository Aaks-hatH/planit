/**
 * services/tracker.js
 *
 * PlanIt Backend Analytics Tracker
 * ─────────────────────────────────────
 * Sends both automatic site-wide events (page_view, session_start/end, click,
 * scroll_depth, outbound_link) and named business events (feature_use, guest
 * actions) to the PlanIt backend analytics endpoint. Runs for every visitor —
 * this is not gated on the cookie banner choice; see Privacy Policy Section 9.
 */

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');
const TRACK_URL = `${API_BASE}/platform-analytics/track`;

// ─── Tracking gate ────────────────────────────────────────────────────────────
// Always on — collection is not conditional on the cookie banner choice.
let _trackingEnabled = true;

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

// ─── Automatic event wiring ───────────────────────────────────────────────────
let _sessionStarted = false;
let _lastScrollMilestone = 0;

function startSession() {
  if (_sessionStarted) return;
  _sessionStarted = true;
  enqueue('session_start');
}

/** Called on mount and on every SPA route change. */
export function trackPageChange(pathname) {
  startSession();
  enqueue('page_view', { payload: { path: pathname } });
}

function handleClick(e) {
  const target = e.target.closest('a, button, [role="button"]');
  if (!target) return;
  enqueue('click', {
    payload: {
      tag: target.tagName.toLowerCase(),
      text: (target.innerText || target.getAttribute('aria-label') || '').slice(0, 80),
    },
  });
  if (target.tagName.toLowerCase() === 'a') {
    const href = target.getAttribute('href') || '';
    if (/^https?:\/\//i.test(href) && !href.includes(window.location.hostname)) {
      enqueue('outbound_link', { payload: { href } });
    }
  }
}

function handleScroll() {
  const doc = document.documentElement;
  const scrolled = doc.scrollTop + window.innerHeight;
  const pct = Math.min(100, Math.round((scrolled / doc.scrollHeight) * 100));
  const milestone = Math.floor(pct / 25) * 25; // 0, 25, 50, 75, 100
  if (milestone > _lastScrollMilestone) {
    _lastScrollMilestone = milestone;
    enqueue('scroll_depth', { payload: { depth: milestone } });
  }
}

function handleUnload() {
  if (_sessionStarted) enqueue('session_end');
  flush(true);
}

// Wire global listeners once on import.
(function bootstrap() {
  if (typeof window === 'undefined') return;
  document.addEventListener('click', handleClick, { capture: true, passive: true });
  window.addEventListener('scroll', handleScroll, { passive: true });
  window.addEventListener('beforeunload', handleUnload);
  window.addEventListener('pagehide', handleUnload);
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
