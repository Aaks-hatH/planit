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
    const value = JSON.stringify({ ...meta, id: String(meta.id), savedAt: Date.now() });
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
