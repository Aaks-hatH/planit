/**
 * services/analytics.js
 *
 * Google Analytics 4 — No-consent-mode wrapper (testing)
 * ───────────────────────────────────────────────────────
 * GA4 measurement ID: G-4H00MP64BG
 *
 * Consent mode is currently disabled for testing. gtag('config') fires in
 * index.html immediately on load, so all hits are sent unconditionally.
 * activateGA() is still called by initGA() on mount to keep _gaInitialised
 * in sync and avoid double-config, but the consent/update step is skipped.
 *
 * PAGE TRACKING
 * ─────────────
 * Auto page_view collection is disabled ('send_page_view': false) so that
 * usePageTracker can fire views at the right moment for the SPA router,
 * preventing double-counting on the initial load.
 */

let _gaInitialised = false;

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
  // Consent mode disabled — gtag('config') already fired in index.html.
  // Nothing else needed here; _gaInitialised just gates trackPageView/trackGAEvent.
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * initGA — call once from usePageTracker on mount.
 *
 * Consent mode disabled: activates GA immediately on mount so
 * trackPageView and trackGAEvent fire from the first navigation.
 * The consent banner still shows; if the user declines, their
 * preference is stored but GA continues to run in this testing mode.
 */
export function initGA() {
  if (typeof window === 'undefined') return;
  activateGA();
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