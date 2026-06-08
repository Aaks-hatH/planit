/**
 * services/tracker.js
 *
 * PlanIt Platform Analytics Tracker
 * ───────────────────────────────────
 * Silently tracks all user interactions across the platform and sends them
 * to the backend in batches. 100% first-party — no third-party scripts,
 * no Set-Cookie headers, no document.cookie (uses localStorage instead).
 *
 * CONSENT
 * ───────
 * Tracking ONLY starts after the user accepts the consent banner.
 * If the user declines — or has not yet decided — nothing is tracked.
 * This is enforced by:
 *   1. A `_trackingEnabled` flag gating every enqueue() call.
 *   2. `initTracker()` reading localStorage before attaching any listeners.
 *   3. Listening for the `planit:consent` DOM event fired by ConsentBanner.
 *
 * WHAT IT TRACKS (only if consented)
 * ──────────────────────────────────
 * • Page views (pathname, referrer, UTM params)
 * • Time spent on each page (via visibilitychange + beforeunload)
 * • Click events (element tag, id snippet, text snippet) — event delegation
 * • Scroll depth (max % reached per page)
 * • Feature interactions (event_created, checkin, form_submit, search, etc.)
 * • Session start/end
 * • JS errors (unhandled)
 * • Outbound link clicks
 */

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');
const TRACK_URL = `${API_BASE}/platform-analytics/track`;

// ─── Consent check ────────────────────────────────────────────────────────────
const CONSENT_KEY     = 'planit_cookie_consent';
const CONSENT_VERSION = '1';

function getStoredConsent() {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null; // no decision yet
    const parsed = JSON.parse(raw);
    if (parsed.v !== CONSENT_VERSION) return null;
    return parsed.accepted === true; // true = accepted, false = declined
  } catch { return null; }
}

// ─── Tracking gate ────────────────────────────────────────────────────────────
// ALL event recording is gated behind this flag.
// It defaults to false — nothing is ever tracked without explicit consent.
let _trackingEnabled  = false;
let _listenersAttached = false;

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

const visitorId  = getId('planit_vid', 'v');
let   sessionId  = getId('planit_sid', 's');
let   sessionStart = Date.now();

// ─── Event context (set by EventSpace / RSVPPage when a specific event loads) ─
let _linkedEventId        = null;
let _linkedEventSubdomain = null;

// Refresh session if inactive > 30 min
function refreshSession() {
  try {
    const lastActive = parseInt(localStorage.getItem('planit_last_active') || '0', 10);
    if (lastActive && Date.now() - lastActive > 30 * 60 * 1000) {
      sessionId = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem('planit_sid', sessionId);
      sessionStart = Date.now();
    }
    localStorage.setItem('planit_last_active', String(Date.now()));
  } catch { /* ignore */ }
}

// ─── UTM / referrer ───────────────────────────────────────────────────────────
function getUtm() {
  try {
    const p = new URLSearchParams(window.location.search);
    return {
      utmSource:   p.get('utm_source')   || null,
      utmMedium:   p.get('utm_medium')   || null,
      utmCampaign: p.get('utm_campaign') || null,
    };
  } catch { return {}; }
}

function getReferrer() {
  try {
    const ref = document.referrer;
    if (!ref) return null;
    const u = new URL(ref);
    if (u.hostname === window.location.hostname) return null;
    return `${u.hostname}${u.pathname}`.slice(0, 200);
  } catch { return null; }
}

// ─── Event queue ──────────────────────────────────────────────────────────────
const queue = [];
let flushTimer = null;
let isFlushing = false;

function enqueue(eventType, extra = {}) {
  // ► CONSENT GATE — nothing is tracked if the user has not accepted
  if (!_trackingEnabled) return;

  refreshSession();
  const ev = {
    eventType,
    sessionId,
    visitorId,
    page: window.location.pathname,
    referrer: getReferrer(),
    ...getUtm(),
    ts: new Date().toISOString(),
    ...(_linkedEventId ? { linkedEventId: _linkedEventId, linkedEventSubdomain: _linkedEventSubdomain } : {}),
    ...extra,
  };
  queue.push(ev);

  if (eventType === 'page_exit' || eventType === 'session_end') {
    flush(true);
  } else {
    scheduleFlush();
  }
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
      await fetch(TRACK_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
      });
    }
  } catch { /* never surface tracking errors */ } finally {
    isFlushing = false;
    if (queue.length > 0) scheduleFlush();
  }
}

// ─── Scroll depth tracking ─────────────────────────────────────────────────────
let maxScroll  = 0;
let scrollPage = typeof window !== 'undefined' ? window.location.pathname : '/';

function onScroll() {
  try {
    const el  = document.documentElement;
    const pct = Math.round((el.scrollTop / (el.scrollHeight - el.clientHeight || 1)) * 100);
    if (pct > maxScroll) maxScroll = pct;
  } catch { /* ignore */ }
}

function flushScroll() {
  if (maxScroll > 0 && scrollPage === window.location.pathname) {
    enqueue('scroll_depth', { page: scrollPage, timeOnPageMs: maxScroll });
  }
}

// ─── Click tracking ───────────────────────────────────────────────────────────
function onDocClick(e) {
  try {
    const target = e.target?.closest('a,button,[role="button"],[data-track]') || e.target;
    if (!target) return;
    const tag  = target.tagName?.toLowerCase() || 'unknown';
    const id   = (target.id || '').slice(0, 50);
    const text = (target.innerText || target.value || target.getAttribute('aria-label') || '')
      .trim().slice(0, 80);
    const cls  = (target.className && typeof target.className === 'string')
      ? target.className.split(' ').filter(Boolean).slice(0, 3).join(' ')
      : '';
    if (tag === 'a') {
      const href = target.getAttribute('href') || '';
      if (href.startsWith('http') && !href.includes(window.location.hostname)) {
        enqueue('outbound_link', { payload: { href: href.slice(0, 200), text } });
        return;
      }
    }
    enqueue('click', { payload: { tag, id, text, cls } });
  } catch { /* ignore */ }
}

// ─── Search tracking ──────────────────────────────────────────────────────────
let searchTimer = null;
function onInput(e) {
  try {
    const el = e.target;
    if (!el || !['input', 'textarea'].includes(el.tagName?.toLowerCase())) return;
    const type = el.type?.toLowerCase();
    if (!['text', 'search', ''].includes(type || '')) return;
    if (!(el.placeholder || el.id || el.name || '').toLowerCase().match(/search|filter|find|query/)) return;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      enqueue('search', { payload: { query_length: (el.value || '').length } });
    }, 1500);
  } catch { /* ignore */ }
}

// ─── Error tracking ───────────────────────────────────────────────────────────
function onError(e) {
  try {
    enqueue('error', {
      payload: {
        message: (e.message || '').slice(0, 200),
        source:  (e.filename || '').slice(0, 200).replace(/https?:\/\/[^/]+/, ''),
        line:    e.lineno,
        col:     e.colno,
      },
    });
  } catch { /* ignore */ }
}

// ─── Page lifecycle ───────────────────────────────────────────────────────────
let pageEnterTime = Date.now();
let currentPage   = typeof window !== 'undefined' ? window.location.pathname : '/';

function onPageEnter(path, isFirst = false) {
  currentPage   = path;
  pageEnterTime = Date.now();
  maxScroll     = 0;
  scrollPage    = path;
  if (isFirst) {
    enqueue('session_start', { page: path });
  }
  enqueue('page_view', { page: path });
}

function onPageExit(nextPath) {
  const timeOnPageMs = Date.now() - pageEnterTime;
  flushScroll();
  enqueue('page_exit', { page: currentPage, timeOnPageMs });
  if (!nextPath) {
    enqueue('session_end', {
      page: currentPage,
      timeOnPageMs: Date.now() - sessionStart,
    });
  }
}

// ─── Attach DOM/window listeners ──────────────────────────────────────────────
// Called once, only after consent is confirmed.
function attachListeners() {
  if (_listenersAttached) return;
  _listenersAttached = true;

  document.addEventListener('click', onDocClick, { capture: true, passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });
  document.addEventListener('input', onInput, { passive: true });
  window.addEventListener('error', onError);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      onPageExit(null);
      flush(true);
    } else if (document.visibilityState === 'visible') {
      refreshSession();
    }
  });

  window.addEventListener('beforeunload', () => {
    onPageExit(null);
    flush(true);
  });

  setInterval(() => flush(), 30_000);
}

// ─── Start tracking (after consent confirmed) ─────────────────────────────────
function startTracking(isFirstSession = true) {
  _trackingEnabled = true;
  attachListeners();
  onPageEnter(window.location.pathname, isFirstSession);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * initTracker — call once from usePageTracker (inside <Router>).
 *
 * Behaviour:
 *  • Consent already accepted → start tracking immediately.
 *  • Consent already declined → do nothing. Ever.
 *  • No decision yet         → wait for the `planit:consent` DOM event
 *                              fired by ConsentBanner when the user clicks.
 */
export function initTracker() {
  if (typeof window === 'undefined') return;

  const consent = getStoredConsent();

  if (consent === true) {
    // User already accepted in a previous session — start immediately.
    startTracking(true);
    return;
  }

  if (consent === false) {
    // User already declined — never track them.
    return;
  }

  // consent === null: user hasn't decided yet. Wait for their choice.
  // ConsentBanner dispatches `planit:consent` with { detail: { accepted: bool } }.
  document.addEventListener('planit:consent', (e) => {
    if (e.detail?.accepted === true) {
      // User just accepted — start tracking from this moment.
      startTracking(false); // false = this is not a brand-new session_start
      enqueue('session_start', { page: window.location.pathname }); // record it now
    }
    // If declined, _trackingEnabled stays false — zero tracking, forever.
  }, { once: true }); // only fire once per page load
}

/** Call whenever the pathname changes (already called by usePageTracker). */
export function trackPageChange(pathname) {
  // enqueue() guards on _trackingEnabled — safe to call unconditionally.
  if (pathname !== currentPage) {
    onPageExit(pathname);
  }
  if (_trackingEnabled) {
    onPageEnter(pathname);
  }
}

/**
 * Track a named feature interaction.
 * @param {string} feature  e.g. 'event_created', 'checkin_completed', 'invite_sent'
 * @param {object} [meta]   optional extra data (no PII)
 */
export function trackFeature(feature, meta = {}) {
  enqueue('feature_use', { payload: { feature, ...meta } });
}

/**
 * Track a guest-level action that carries PII and/or RSVP status.
 * These fields are stored at the top level of the analytics document so they
 * can be queried and aggregated — NOT buried inside the encrypted payload.
 */
export function trackGuestAction(feature, { pii, rsvpStatus, ...meta } = {}) {
  enqueue('feature_use', {
    payload: { feature, ...meta },
    ...(pii        ? { pii }        : {}),
    ...(rsvpStatus ? { rsvpStatus } : {}),
  });
}

/**
 * Set the current event context. Call from EventSpace/RSVPPage once the
 * event ID is known. Every event fired after this carries linkedEventId.
 * Pass (null, null) when navigating away from an event page.
 */
export function setEventContext(eventId, subdomain) {
  _linkedEventId        = eventId   ? String(eventId)   : null;
  _linkedEventSubdomain = subdomain ? String(subdomain) : null;
}

/** Flush remaining events immediately (e.g. on error boundary). */
export function flushTracker() {
  flush(true);
}

/**
 * Returns whether tracking is currently active (consent given + listeners up).
 * Useful for debugging or showing a "tracking active" indicator.
 */
export function isTrackingActive() {
  return _trackingEnabled;
}

// ─── NO auto-bootstrap ────────────────────────────────────────────────────────
// The original tracker.js ran bootstrap() immediately on import, attaching all
// DOM listeners before any consent check. That meant tracking started the
// instant the module loaded, regardless of what the user chose.
//
// The fix: nothing runs until initTracker() is explicitly called (from
// usePageTracker), and initTracker() gates everything on consent.
