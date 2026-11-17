/* eslint-disable no-restricted-globals */
/**
 * sw-offline-shell.js
 *
 * Loaded by the generated service worker (workbox.importScripts in vite.config.js).
 *
 * WHY: PlanIt is a single-page app. Every URL (/invite/ABC123, /event/<id>/checkin, /e/<name>/checkin)
 * is the same index.html, but the old service worker only cached a page for the exact URLs the
 * device had already visited (5 at most), and never precached index.html. So a guest opening their
 * ticket link, or door staff reopening the check-in page, with no connection got the browser's
 * "You are offline" error even though every script the app needs was already cached.
 *
 * WHAT: for page navigations, try the network first (so online users always get the newest HTML),
 * but give up after a few seconds, or immediately when offline / the server answers 5xx, and serve
 * the precached app shell instead. The app then boots from cached scripts and reads the data it saved
 * on the device (guest list in IndexedDB, ticket in localStorage).
 *
 * This listener is registered before Workbox's own, so it answers navigations first. Anything it
 * does not handle (API calls, files with an extension, non-GET) falls through to the normal rules.
 */

const SHELL_URL = '/index.html';
const NAVIGATION_TIMEOUT_MS = 3500;

// Never answer these with the app shell.
const SKIP_PATH = /^\/(api|socket\.io|uploads)\//;
const HAS_FILE_EXTENSION = /\.[a-z0-9]{2,5}$/i;

async function appShell() {
  // Precache entries are stored as "/index.html?__WB_REVISION__=<hash>", hence ignoreSearch.
  const hit = await caches.match(SHELL_URL, { ignoreSearch: true });
  return hit || Response.error();
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.mode !== 'navigate' || request.method !== 'GET') return;

  const { pathname } = new URL(request.url);
  if (SKIP_PATH.test(pathname) || HAS_FILE_EXTENSION.test(pathname)) return;

  event.respondWith((async () => {
    // Known-offline: don't make the user wait for a request that cannot succeed.
    if (self.navigator && self.navigator.onLine === false) return appShell();

    const network = fetch(request);
    network.catch(() => { /* handled below; stops an unhandled-rejection if the timeout wins */ });
    try {
      const response = await Promise.race([
        network,
        new Promise((_, reject) => setTimeout(() => reject(new Error('navigation timeout')), NAVIGATION_TIMEOUT_MS)),
      ]);
      // A hosting proxy waking up / failing answers 5xx with a bare error page: the app shell is better.
      if (response && response.status >= 500) return appShell();
      return response;
    } catch {
      return appShell();
    }
  })());
});
