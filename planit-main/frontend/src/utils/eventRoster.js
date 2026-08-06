// ═══════════════════════════════════════════════════════════════════════════
// FACE TICKET — EVENT / ROSTER MODE (no React, no server here)
//
// Extends the one-ticket-at-a-time Face Ticket flow to "one event, many
// tickets, no ticket needed at the door": an organizer enrolls a roster of
// faces for an event, then a check-in station matches a live face against
// the *whole* roster (1:N) instead of a single QR-carried embedding (1:1).
//
// Deliberately kept inside the same "beta, all client-side" contract as
// faceTicket.js:
//   - No new backend routes, no database. The roster + check-in state lives
//     in this browser's localStorage only, keyed by event id.
//   - The only way roster data crosses devices is explicit, user-initiated
//     file export/import (a JSON file the organizer downloads and re-uploads
//     on the check-in device), or the optional per-attendee QR fallback
//     ticket (same idea as the original single-ticket QR, just tagged with
//     which event/attendee it belongs to).
//   - Face embeddings are still compressed to 128 bytes the same way as the
//     single-ticket flow (see quantizeEmbedding / dequantizeEmbedding in
//     faceTicket.js) before they're ever written to localStorage or a QR.
// ═══════════════════════════════════════════════════════════════════════════

import { bytesToBase64, base64ToBytes, dequantizeEmbedding, cosineSimilarity } from './faceTicket';

const STORAGE_KEY = 'planit_face_events_v1';
// 'ev2' = current lightweight format (no embedding — see packEventTicketPayload).
// 'ev1' still decodes below for anyone with an already-printed older ticket.
const EVENT_TICKET_VERSION = 'ev2';

// Same decision band as the single-ticket flow (MATCH_THRESHOLD in
// FaceTicket.jsx) — kept as an independent constant here rather than
// importing a value out of a page component.
export const DEFAULT_MATCH_THRESHOLD = 0.58;

// How much clearer the best match needs to be than the runner-up before
// we'll auto check someone in on face alone. A roster of a few hundred
// people will occasionally produce two candidates that both clear
// MATCH_THRESHOLD — this margin is what decides "confidently this one
// person" vs. "sus, better double-check with a ticket".
export const AMBIGUITY_MARGIN = 0.045;

// ─── Mobile detection ──────────────────────────────────────────────────────
// Best-effort UA + viewport heuristic, not a hard guarantee. Used purely to
// decide whether to show a "this works better on desktop" disclaimer, never
// to block functionality outright — some tablets/phones may work fine.
export function isLikelyMobile() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || navigator.vendor || '';
  const uaLooksMobile = /Android|iPhone|iPad|iPod|Mobile|Windows Phone|IEMobile/i.test(ua);
  const smallTouchViewport =
    typeof window !== 'undefined' &&
    (navigator.maxTouchPoints || 0) > 0 &&
    Math.min(window.innerWidth || 9999, window.innerHeight || 9999) < 820;
  return uaLooksMobile || smallTouchViewport;
}

// ─── localStorage plumbing ─────────────────────────────────────────────────

function genId(prefix) {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function readStore() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.error('Could not read Face Ticket event storage:', err);
    return {};
  }
}

function writeStore(store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    return true;
  } catch (err) {
    // Most likely quota exceeded — a roster of a few hundred 128-byte
    // embeddings is small (tens of KB), so this should be rare, but a
    // full localStorage from other app data is possible.
    console.error('Could not save Face Ticket event storage:', err);
    return false;
  }
}

function saveEvent(event) {
  const store = readStore();
  store[event.id] = event;
  const ok = writeStore(store);
  return ok ? event : null;
}

// ─── Event CRUD ─────────────────────────────────────────────────────────────

/** Summaries for the event picker screen — cheap, no embedding bytes. */
export function listEvents() {
  const store = readStore();
  return Object.values(store)
    .map((e) => ({
      id: e.id,
      name: e.name,
      createdAt: e.createdAt,
      settings: e.settings,
      attendeeCount: e.attendees.length,
      checkedInCount: e.attendees.filter((a) => a.checkedIn).length,
    }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function getEvent(id) {
  const store = readStore();
  return store[id] || null;
}

export function createEvent({ name, requireQR = 'auto' }) {
  const event = {
    id: genId('evt'),
    name: (name || 'Untitled event').trim().slice(0, 60),
    createdAt: Date.now(),
    settings: { requireQR }, // 'never' | 'auto' | 'always'
    attendees: [],
  };
  return saveEvent(event);
}

export function updateEventSettings(eventId, settings) {
  const event = getEvent(eventId);
  if (!event) return null;
  event.settings = { ...event.settings, ...settings };
  return saveEvent(event);
}

export function deleteEvent(eventId) {
  const store = readStore();
  delete store[eventId];
  return writeStore(store);
}

// ─── Attendee CRUD ──────────────────────────────────────────────────────────

/** `quantized` is the { bytes: Uint8Array, min, max } shape from
 *  quantizeEmbedding() — stored as a base64 string since Uint8Array doesn't
 *  round-trip through JSON.stringify. */
export function addAttendee(eventId, { name, seatId, quantized }) {
  const event = getEvent(eventId);
  if (!event) return null;
  const attendee = {
    id: genId('att'),
    name: (name || 'Guest').trim().slice(0, 40) || 'Guest',
    seatId: (seatId || '').trim().slice(0, 16),
    addedAt: Date.now(),
    checkedIn: false,
    checkedInAt: null,
    embedding: {
      d: bytesToBase64(quantized.bytes),
      min: quantized.min,
      max: quantized.max,
    },
  };
  event.attendees.push(attendee);
  const saved = saveEvent(event);
  return saved ? attendee : null;
}

export function removeAttendee(eventId, attendeeId) {
  const event = getEvent(eventId);
  if (!event) return null;
  event.attendees = event.attendees.filter((a) => a.id !== attendeeId);
  return saveEvent(event);
}

export function setCheckedIn(eventId, attendeeId, checkedIn) {
  const event = getEvent(eventId);
  if (!event) return null;
  const attendee = event.attendees.find((a) => a.id === attendeeId);
  if (!attendee) return null;
  attendee.checkedIn = checkedIn;
  attendee.checkedInAt = checkedIn ? Date.now() : null;
  saveEvent(event);
  return attendee;
}

/** Float32Array(128) descriptor for one attendee, decompressed on demand
 *  (kept compressed at rest, same as the single-ticket QR payload). */
export function attendeeDescriptor(attendee) {
  const bytes = base64ToBytes(attendee.embedding.d);
  return dequantizeEmbedding(bytes, attendee.embedding.min, attendee.embedding.max);
}

// ─── 1:N matching ───────────────────────────────────────────────────────────

/**
 * Compares one live face descriptor against every enrolled attendee in an
 * event and ranks them by similarity. Returns enough for the UI to decide
 * whether this is a confident, no-ticket-needed match or a "sus" case that
 * should fall back to asking for the QR ticket.
 */
export function matchAgainstRoster(liveDescriptor, attendees, {
  threshold = DEFAULT_MATCH_THRESHOLD,
  ambiguityMargin = AMBIGUITY_MARGIN,
} = {}) {
  const ranked = attendees
    .map((attendee) => ({ attendee, similarity: cosineSimilarity(attendeeDescriptor(attendee), liveDescriptor) }))
    .sort((a, b) => b.similarity - a.similarity);

  const top = ranked[0] || null;
  const second = ranked[1] || null;
  const clearsThreshold = !!top && top.similarity >= threshold;
  const clearsMargin = !second || (top.similarity - second.similarity) >= ambiguityMargin;

  return {
    ranked,
    top,
    second,
    confident: clearsThreshold && clearsMargin,
    reason: !top ? 'empty-roster' : !clearsThreshold ? 'below-threshold' : !clearsMargin ? 'too-close-to-call' : 'confident',
  };
}

// ─── Event ticket QR payload (per-attendee, optional fallback) ─────────────
// Unlike the single-ticket flow's QR (packTicketPayload/unpackTicketPayload
// in faceTicket.js), this one is only ever scanned back on a device that
// already has the full roster loaded locally (same machine, or another
// machine that imported the exported event file) — see the module banner
// above. Check-in only ever needs to know WHICH attendee this ticket is for
// (matched by aId against the local roster); it never compares embeddings
// out of the QR itself. So unlike the single-ticket QR, this one does NOT
// carry the face descriptor — including it would roughly quadruple the
// payload for no functional benefit, forcing a much higher-density QR
// (more, smaller modules) that's noticeably harder for a phone camera or
// handheld scanner to resolve. 'ev2' marks this lighter format explicitly
// so an older 'ev1' ticket (which does carry an embedding) still decodes.
export function packEventTicketPayload({ eventId, eventName, attendee }) {
  const obj = {
    v: EVENT_TICKET_VERSION,
    evId: eventId,
    aId: attendee.id,
    n: attendee.name,
    e: (eventName || '').trim().slice(0, 32),
    s: attendee.seatId,
  };
  return JSON.stringify(obj);
}

/** Renders one attendee's fallback ticket as a QR code data URL. Shared by
 *  the enrollment flow (so a QR is ready the moment a guest is signed up),
 *  the per-attendee ticket panel on the Manage screen, and the "all tickets"
 *  view. `width` is left adjustable since a single full-size ticket and a
 *  printable grid of dozens want different pixel sizes. */
export async function generateAttendeeQrDataUrl({ eventId, eventName, attendee, width = 320 }) {
  const QRCode = (await import('qrcode')).default;
  const payload = packEventTicketPayload({ eventId, eventName, attendee });
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'H',
    margin: 1,
    width,
    color: { dark: '#0a0714ff', light: '#ffffffff' },
  });
}

export function unpackEventTicketPayload(text) {
  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new Error('This QR code isn\u2019t a Face Ticket event payload.');
  }
  if (!obj || (obj.v !== 'ev1' && obj.v !== 'ev2')) {
    throw new Error('Unrecognized event ticket format \u2014 scan the ticket for this event.');
  }

  // 'ev1' tickets (pre-dating the payload slim-down) still carry an
  // embedding; decode it if present so an older printed ticket keeps
  // working, but it's optional now — 'ev2' tickets never include it since
  // check-in only ever needs the attendeeId to look the guest up in the
  // roster already stored on this device.
  let quantized = null;
  if (typeof obj.d === 'string') {
    const bytes = base64ToBytes(obj.d);
    if (bytes.length !== 128) {
      throw new Error('Ticket embedding is malformed.');
    }
    quantized = { bytes, min: obj.mn, max: obj.mx };
  }

  return {
    eventId: obj.evId,
    attendeeId: obj.aId,
    name: obj.n || 'Guest',
    eventName: obj.e || '',
    seatId: obj.s || '',
    quantized,
  };
}

// ─── Export / import (the only way roster data moves between devices) ──────

/** Triggers a browser download of the full event (roster + check-in state)
 *  as a JSON file. Bring this file to the check-in device and import it
 *  there if enrollment and check-in aren't happening on the same machine. */
export function exportEventFile(event) {
  const payload = { formatVersion: 1, exportedAt: Date.now(), event };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const slug = (event.name || 'event').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'event';
  a.href = url;
  a.download = `face-ticket-event-${slug}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Parses an exported event file's text content and saves it into this
 *  browser's localStorage. Always imports as a *new* event id so importing
 *  the same file twice (or importing on the device that already has it)
 *  can't silently clobber existing check-in state. */
export function importEventFile(text) {
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error('That file isn\u2019t valid JSON.');
  }
  const src = payload?.event;
  if (!src || !Array.isArray(src.attendees) || !src.name) {
    throw new Error('That doesn\u2019t look like a Face Ticket event export.');
  }
  const idMap = new Map();
  const attendees = src.attendees.map((a) => {
    const newId = genId('att');
    idMap.set(a.id, newId);
    return { ...a, id: newId };
  });
  const event = {
    id: genId('evt'),
    name: src.name,
    createdAt: Date.now(),
    settings: src.settings || { requireQR: 'auto' },
    attendees,
  };
  const saved = saveEvent(event);
  if (!saved) throw new Error('Could not save the imported event to this browser.');
  return saved;
}
