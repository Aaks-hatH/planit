// ═══════════════════════════════════════════════════════════════════════════
// BETA DIAGNOSTICS — local, DevTools-only event log for beta features
//
// Nothing here ever leaves the browser. Any beta feature (Venue Walk today,
// others later) calls logBetaEvent() at key lifecycle moments — permission
// changes, sensor errors, threshold crossings, whatever helps debug it — and
// this module fans that out to two places, both purely local:
//   1. A readable console.groupCollapsed line, so you can watch DevTools live
//      while testing on a phone over remote debugging
//   2. A per-feature ring buffer under window.__planItBeta[featureId], so you
//      can inspect recent history at any point, not just scroll back through
//      logs — and so BetaBar's "Copy diagnostics" button has something to grab
//
// This is intentionally NOT wired to any network call today. It's the seed
// for a future upload pipeline (most likely Sentry breadcrumbs, tagged
// beta.<featureId>) — but that's a separate, deliberate follow-up, not
// something that should happen implicitly by adding logging calls.
//
// Fully inert unless explicitly turned on — see enable()/disable() below —
// so it never fires for a normal user and never costs them anything.
// ═══════════════════════════════════════════════════════════════════════════

const DEBUG_FLAG_KEY = 'planit_beta_debug';
const RING_BUFFER_SIZE = 200;

function debugEnabled() {
  try {
    return typeof window !== 'undefined' && window.localStorage?.getItem(DEBUG_FLAG_KEY) === '1';
  } catch {
    return false;
  }
}

function enable() {
  try {
    window.localStorage.setItem(DEBUG_FLAG_KEY, '1');
  } catch {
    /* localStorage unavailable — debug mode just won't persist across reloads */
  }
  console.info(
    '%c[planit-beta]%c diagnostics ON — logging is local only, nothing is sent anywhere. ' +
      'Run window.__planItBeta.dump() any time to see everything captured so far.',
    'color:#8B7FFF;font-weight:bold',
    'color:inherit',
  );
}

function disable() {
  try {
    window.localStorage.removeItem(DEBUG_FLAG_KEY);
  } catch {
    /* nothing to clean up if storage was never reachable */
  }
  console.info('%c[planit-beta]%c diagnostics OFF', 'color:#8B7FFF;font-weight:bold', 'color:inherit');
}

function dump() {
  const store = ensureStore();
  const { dump: _d, clear: _c, enable: _e, disable: _di, ...features } = store;
  console.log(JSON.stringify(features, null, 2));
  return features;
}

function clear() {
  const store = ensureStore();
  Object.keys(store).forEach((k) => {
    if (!['dump', 'clear', 'enable', 'disable'].includes(k)) delete store[k];
  });
  console.info('[planit-beta] diagnostics cleared');
}

/** Lazily attaches the window.__planItBeta console surface, so anyone can
 *  type __planItBeta.enable() / .dump() / .clear() directly in DevTools
 *  without needing to know an import path. */
function ensureStore() {
  if (typeof window === 'undefined') return {};
  if (!window.__planItBeta) {
    window.__planItBeta = { dump, clear, enable, disable };
  }
  return window.__planItBeta;
}

/** Log one diagnostic event for a beta feature. Cheap no-op when debug mode
 *  is off, so it's safe to sprinkle liberally through hook internals —
 *  callers don't need to guard calls with isBetaDebugEnabled() themselves. */
export function logBetaEvent(featureId, eventType, payload = {}) {
  if (!debugEnabled()) return;

  const store = ensureStore();
  if (!store[featureId]) store[featureId] = [];
  const entry = { t: Date.now(), eventType, ...payload };
  store[featureId].push(entry);
  if (store[featureId].length > RING_BUFFER_SIZE) store[featureId].shift();

  console.groupCollapsed(
    `%c[${featureId}]%c ${eventType}`,
    'color:#8B7FFF;font-weight:bold',
    'color:inherit',
  );
  console.log(entry);
  console.groupEnd();
}

/** Returns a copy of one feature's current ring buffer — used by BetaBar's
 *  "Copy diagnostics" button so a person can grab exactly what's logged for
 *  the feature they're looking at without hunting through the full dump. */
export function dumpFeatureLog(featureId) {
  if (typeof window === 'undefined' || !window.__planItBeta) return [];
  return [...(window.__planItBeta[featureId] || [])];
}

export function isBetaDebugEnabled() {
  return debugEnabled();
}

// Make sure __planItBeta.enable()/.dump()/etc. exist as soon as this module
// loads, even before any feature has logged its first event.
ensureStore();
