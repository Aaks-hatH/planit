/**
 * services/tracker.js
 *
 * PlanIt Platform Analytics Tracker
 * ───────────────────────────────────
 * Silently tracks all user interactions across the platform and sends them
 * to the backend in batches. 100% first-party — no third-party scripts,
 * no Set-Cookie headers, no document.cookie (uses localStorage instead
 * so browser privacy settings never block it).
 *
 * WHAT IT TRACKS
 * ──────────────
 * • Page views (pathname, referrer, UTM params)
 * • Time spent on each page (via visibilitychange + beforeunload)
 * • Click events (element tag, id snippet, text snippet) — event delegation
 * • Scroll depth (max % reached per page)
 * • Feature interactions (event_created, checkin, form_submit, search, etc.)
 * • Session start/end
 * • JS errors (unhandled)
 * • Outbound link clicks
 *
 * PRIVACY
 * ───────
 * No PII is ever collected. Visitor/session IDs are random opaque strings
 * stored in localStorage. All sensitive payload fields are encrypted
 * server-side (AES-256-GCM).
 */

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');
const TRACK_URL = `${API_BASE}/platform-analytics/track`;

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
    // localStorage blocked (private browsing or strict settings)
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

const visitorId  = getId('planit_vid', 'v');
let   sessionId  = getId('planit_sid', 's');
let   sessionStart = Date.now();

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
    // Only return the origin+pathname, strip query params from referrer for privacy
    const u = new URL(ref);
    if (u.hostname === window.location.hostname) return null; // internal nav — not a true referrer
    return `${u.hostname}${u.pathname}`.slice(0, 200);
  } catch { return null; }
}

// ─── Event queue ──────────────────────────────────────────────────────────────
const queue = [];
let flushTimer = null;
let isFlushing = false;

function enqueue(eventType, extra = {}) {
  refreshSession();
  const ev = {
    eventType,
    sessionId,
    visitorId,
    page: window.location.pathname,
    referrer: getReferrer(),
    ...getUtm(),
    ts: new Date().toISOString(),
    ...extra,
  };
  queue.push(ev);

  // Schedule flush in 5s (debounced) — or flush immediately for exits
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
      // sendBeacon survives page unload — the only reliable method on exit
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
let scrollPage = window.location.pathname;

function onScroll() {
  try {
    const el     = document.documentElement;
    const pct    = Math.round((el.scrollTop / (el.scrollHeight - el.clientHeight || 1)) * 100);
    if (pct > maxScroll) maxScroll = pct;
  } catch { /* ignore */ }
}

function flushScroll() {
  if (maxScroll > 0 && scrollPage === window.location.pathname) {
    enqueue('scroll_depth', {
      page: scrollPage,
      timeOnPageMs: maxScroll, // reuse timeOnPageMs field to store scroll %
    });
  }
}

// ─── Click tracking (event delegation) ───────────────────────────────────────
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

    // Detect outbound links
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
let currentPage   = window.location.pathname;

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
    // True browser exit
    enqueue('session_end', {
      page: currentPage,
      timeOnPageMs: Date.now() - sessionStart,
    });
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Call this from the App.jsx useEffect whenever the pathname changes */
export function trackPageChange(pathname) {
  if (pathname !== currentPage) {
    onPageExit(pathname);
  }
  onPageEnter(pathname);
}

/** Call this when the tracker first initialises (once) */
export function initTracker() {
  onPageEnter(window.location.pathname, true);
}

/**
 * Track a named feature interaction.
 * @param {string} feature  e.g. 'event_created', 'checkin_completed', 'invite_sent'
 * @param {object} [meta]   optional extra data (no PII)
 */
export function trackFeature(feature, meta = {}) {
  enqueue('feature_use', { payload: { feature, ...meta } });
}

/** Flush remaining events immediately (e.g. on error boundary) */
export function flushTracker() {
  flush(true);
}

// ─── Wire up global listeners ─────────────────────────────────────────────────
(function bootstrap() {
  if (typeof window === 'undefined') return;

  // Click delegation
  document.addEventListener('click', onDocClick, { capture: true, passive: true });

  // Scroll depth
  window.addEventListener('scroll', onScroll, { passive: true });

  // Search / input
  document.addEventListener('input', onInput, { passive: true });

  // JS errors
  window.addEventListener('error', onError);

  // Page exit / unload
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

  // Flush every 30s regardless
  setInterval(() => flush(), 30_000);
})();
