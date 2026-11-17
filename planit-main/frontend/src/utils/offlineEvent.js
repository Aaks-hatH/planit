/**
 * offlineEvent.js — keeps a small copy of an event on the device so the event page can open with no
 * internet. Every call is wrapped: storage can be blocked or full, and that must never break the page.
 *
 *  meta     = { id, eventType, title, subdomain, savedAt }   (saved under both the id and the subdomain)
 *  snapshot = the event object the event page shows (participants, agenda, RSVPs, settings)
 */
const META = 'planit_event_meta_';
const SNAP = 'planit_event_snap_';

// "No response at all" = the request never reached the server (offline, dead wifi, DNS, timeout).
export const isNetworkFailure = (err) => !!err && !err.response;

export function saveEventMeta(key, meta) {
  if (!key || !meta?.id) return;
  try {
    let previous = {};
    try { previous = JSON.parse(localStorage.getItem(META + String(meta.id)) || '{}') || {}; } catch { /* ignore */ }
    const clean = Object.fromEntries(Object.entries(meta).filter(([, v]) => v !== '' && v !== undefined && v !== null));
    const value = JSON.stringify({ ...previous, ...clean, id: String(meta.id), savedAt: Date.now() });
    localStorage.setItem(META + key, value);
    localStorage.setItem(META + String(meta.id), value);
    if (meta.subdomain) localStorage.setItem(META + meta.subdomain, value);
  } catch { /* storage full or blocked */ }
}

export function readEventMeta(key) {
  if (!key) return null;
  try {
    const raw = localStorage.getItem(META + key);
    if (raw) return JSON.parse(raw);
    // The check-in page saved the subdomain → id mapping earlier; reuse it.
    const legacy = localStorage.getItem(`checkin_subdomain_${key}`);
    if (legacy) return { id: legacy, eventType: 'standard' };
  } catch { /* ignore */ }
  return null;
}

const KEEP_MS = 30 * 24 * 60 * 60 * 1000;   // events are deleted a week after the date; don't list ancient ones

/** Events this device has opened, newest first. Works with no internet. */
export function listSavedEvents(limit = 8) {
  const byId = new Map();
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(META)) continue;
      let m = null;
      try { m = JSON.parse(localStorage.getItem(key)); } catch { /* skip */ }
      if (!m?.id || (m.savedAt && Date.now() - m.savedAt > KEEP_MS)) continue;
      const prev = byId.get(m.id);
      if (!prev || (m.savedAt || 0) > (prev.savedAt || 0)) byId.set(m.id, m);
    }
  } catch { /* storage blocked */ }
  return [...byId.values()].sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0)).slice(0, limit);
}

/** Match what someone typed (link, name, id or event title) against the saved events. */
export function findSavedEvent(query) {
  const q = String(query || '').trim().toLowerCase().replace(/^https?:\/\/[^/]+/, '').replace(/^\/?(rsvp\/|e\/|event\/)?/, '').replace(/\/.*$/, '');
  if (!q) return null;
  const all = listSavedEvents(50);
  return all.find((m) => String(m.id).toLowerCase() === q || String(m.subdomain || '').toLowerCase() === q)
    || all.find((m) => String(m.title || '').toLowerCase() === q)
    || all.find((m) => String(m.title || '').toLowerCase().includes(q) || String(m.subdomain || '').toLowerCase().includes(q))
    || null;
}

export function forgetSavedEvent(id) {
  try {
    const m = JSON.parse(localStorage.getItem(META + id) || 'null');
    localStorage.removeItem(META + id);
    if (m?.subdomain) localStorage.removeItem(META + m.subdomain);
  } catch { /* ignore */ }
}

export function saveEventSnapshot(eventId, ev) {
  if (!eventId || !ev) return;
  try { localStorage.setItem(SNAP + eventId, JSON.stringify(ev)); } catch { /* storage full: skip */ }
  saveEventMeta(eventId, { id: eventId, eventType: ev.eventType || 'standard', title: ev.title || ev.name || '', subdomain: ev.subdomain || '' });
}

export function readEventSnapshot(eventId) {
  if (!eventId) return null;
  try {
    const raw = localStorage.getItem(SNAP + eventId) || localStorage.getItem(`checkin_event_cache_${eventId}`);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
