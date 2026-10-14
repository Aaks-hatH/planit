/**
 * frontend/src/utils/eventBrand.js
 *
 * Event branding for the browser tab title and loading screens.
 *
 * Every event page (workspace, RSVP dashboard, builder, check-in, floor,
 * kitchen, reserve, ...) lives under /e/:subdomain/* or /event/:id/*. This
 * module turns such a path into a branded title like
 *   "Maya's Birthday · RSVP Dashboard · PlanIt"
 * and keeps a tiny cache of the event name so it can be shown instantly:
 *
 *   1. server.js bakes `window.__PLANIT_PRELOAD__` into the HTML on first load
 *      (so the very first paint already has the branded <title> + name).
 *   2. Otherwise the name is read from sessionStorage (event seen earlier in
 *      this tab), and finally fetched from /events/public/brand/:key.
 */
import { eventAPI } from '../services/api';

const CACHE_PREFIX = 'planit:brand:';

// Section label per sub-route. `null` = the event's home page (name only).
const SECTIONS = [
  [/^rsvp-dashboard$/, 'RSVP Dashboard'],
  [/^rsvp-builder$/,   'RSVP Page Builder'],
  [/^checkin$/,        'Check-In'],
  [/^floor$/,          'Floor Management'],
  [/^server$/,         'Server View'],
  [/^kitchen$/,        'Kitchen Display'],
  [/^table\//,         'Table Ordering'],
  [/^(login|waitlist)$/, 'Sign In'],
  [/^wait$/,           'Live Waitlist'],
  [/^reserve$/,        'Reserve'],
];

/** '/e/my-party/checkin' -> { key: 'my-party', section: 'Check-In', sub: 'checkin' } */
export function parseEventPath(pathname) {
  const m = /^\/(?:e|event)\/([^/]+)(?:\/(.*?))?\/?$/.exec(pathname || '');
  if (!m) return null;
  const sub = m[2] || '';
  const hit = SECTIONS.find(([re]) => re.test(sub));
  return { key: decodeURIComponent(m[1]), sub, section: hit ? hit[1] : null };
}

/** Build the tab title. `siteName` is 'PlanIt' or the white-label company. */
export function brandedTitle(brand, section, siteName = 'PlanIt', sub = '') {
  const name = brand?.name || brand?.title;
  if (!name) return null;
  if (sub === 'reserve') {
    return brand.isTableServiceMode
      ? `Reserve a Table at ${name} · ${siteName}`
      : `Reserve Your Spot · ${name} · ${siteName}`;
  }
  return section ? `${name} · ${section} · ${siteName}` : `${name} · ${siteName}`;
}

/** Server-injected preload data for this exact path (first page load only). */
export function getPreload(pathname) {
  try {
    const p = window.__PLANIT_PRELOAD__;
    if (p && p.path === pathname) return p;
  } catch { /* ignore */ }
  return null;
}

export function getCachedBrand(key) {
  if (!key) return null;
  try {
    const p = window.__PLANIT_PRELOAD__;
    if (p?.brand && (p.brand.subdomain === key || String(p.brand.id) === key)) return p.brand;
  } catch { /* ignore */ }
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function cacheBrand(key, brand) {
  try {
    const raw = JSON.stringify(brand);
    sessionStorage.setItem(CACHE_PREFIX + key, raw);
    if (brand.subdomain) sessionStorage.setItem(CACHE_PREFIX + brand.subdomain, raw);
    if (brand.id) sessionStorage.setItem(CACHE_PREFIX + brand.id, raw);
  } catch { /* storage full / blocked — fine */ }
}

const inflight = new Map();

/** Fetch (and cache) the brand for a subdomain or event id. Resolves null on failure. */
export function fetchBrand(key) {
  if (!key) return Promise.resolve(null);
  if (inflight.has(key)) return inflight.get(key);
  const p = eventAPI.getBrand(key)
    .then((res) => { cacheBrand(key, res.data); return res.data; })
    .catch(() => null)
    .finally(() => { setTimeout(() => inflight.delete(key), 5000); });
  inflight.set(key, p);
  return p;
}

/** Best-effort event name for the current URL, synchronously (for loaders). */
export function currentBrandFromLocation() {
  if (typeof window === 'undefined') return null;
  const parsed = parseEventPath(window.location.pathname);
  return parsed ? getCachedBrand(parsed.key) : null;
}
