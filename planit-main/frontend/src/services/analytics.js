/**
 * services/analytics.js
 *
 * Google Analytics 4 — Consent-Gated Wrapper
 * ───────────────────────────────────────────
 * GA4 measurement ID: G-4H00MP64BG
 *
 * CONSENT MODEL
 * ─────────────
 * gtag.js is loaded via index.html with analytics_storage='denied' by default.
 * No hits are sent to Google until the user accepts the consent banner.
 * When accepted:
 *   1. We update the GA consent state to 'granted'.
 *   2. We call gtag('config', ...) which activates the measurement stream.
 *   3. We fire an initial page_view for the current page.
 * When declined: analytics_storage stays 'denied'; gtag is a no-op for hits.
 *
 * PAGE TRACKING
 * ─────────────
 * Auto page_view collection is disabled ('send_page_view': false) so that
 * usePageTracker can fire views at the right moment for the SPA router,
 * preventing double-counting on the initial load.
 */

const GA_ID = 'G-4H00MP64BG';
const CONSENT_KEY = 'planit_cookie_consent';
const CONSENT_VERSION = '1';

let _gaInitialised = false;

// ─── Consent helpers ──────────────────────────────────────────────────────────
function getStoredConsent() {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.v !== CONSENT_VERSION) return null;
    return parsed.accepted === true;
  } catch { return null; }
}

// ─── gtag shim (safe to call even before the script loads) ───────────────────
function gtag(...args) {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(args);
}

// ─── Core initialisation ─────────────────────────────────────────────────────
function activateGA() {
  if (_gaInitialised) return;
  _gaInitialised = true;

  // Upgrade consent state in the GA consent API
  gtag('consent', 'update', { analytics_storage: 'granted' });

  // Configure the stream — disable auto page_view so the SPA router controls it
  gtag('config', GA_ID, { send_page_view: false });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * initGA — call once from usePageTracker on mount.
 *
 * Behaviour mirrors initTracker() in tracker.js:
 *  • Already accepted → activate GA immediately.
 *  • Already declined → do nothing.
 *  • No decision yet → listen for the planit:consent DOM event.
 */
export function initGA() {
  if (typeof window === 'undefined') return;

  const consent = getStoredConsent();

  if (consent === true) {
    activateGA();
    return;
  }
  if (consent === false) {
    return; // never track declined users
  }

  // Waiting for the user's choice
  document.addEventListener(
    'planit:consent',
    (e) => {
      if (e.detail?.accepted === true) activateGA();
      // If declined, analytics_storage stays 'denied'
    },
    { once: true },
  );
}

/**
 * trackPageView — call on every SPA route change.
 * Safe to call before GA is initialised; hits are queued by gtag.js.
 * @param {string} path  e.g. '/event/my-party'
 */
export function trackPageView(path) {
  if (!_gaInitialised) return; // don't queue views before consent
  gtag('event', 'page_view', {
    page_location: window.location.origin + path,
    page_path: path,
    page_title: document.title,
  });
}

/**
 * trackGAEvent — send a custom GA4 event.
 * Only fires after consent is granted.
 * @param {string} eventName   GA4 event name (snake_case)
 * @param {object} [params]    Optional event parameters
 */
export function trackGAEvent(eventName, params = {}) {
  if (!_gaInitialised) return;
  gtag('event', eventName, params);
}

/** Returns true if GA has been activated (consent granted + config called). */
export function isGAActive() {
  return _gaInitialised;
}
