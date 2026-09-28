// ═══════════════════════════════════════════════════════════════════════════
// QR PASS — signed, rotating check-in codes (no network, no API calls)
//
// Model (TOTP-style, per guest):
//   eventSecret  — random 256-bit value that never leaves the host/staff device
//   guestKey     — HMAC(eventSecret, "guest:" + guestId)   (given to ONE guest)
//   token        — PQ1.<eventId>.<guestId>.<slot>.<mac>
//                  slot = floor(unixMs / 30s), mac = HMAC(guestKey, event|guest|slot)[0..8]
//
// A screenshot of the QR is only valid for its own slot (±1 for clock skew),
// so it dies within ~60s. A token can also only be accepted once.
// ═══════════════════════════════════════════════════════════════════════════

export const SLOT_MS = 30000;
const EVENTS_KEY = 'planit_qrpass_events_v1';
const WALLET_KEY = 'planit_qrpass_wallet_v1';

const enc = new TextEncoder();

export const b64u = {
  fromBytes(bytes) {
    let s = '';
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  toBytes(str) {
    const p = str.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(p + '='.repeat((4 - (p.length % 4)) % 4));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  },
  fromText: (t) => b64u.fromBytes(enc.encode(t)),
  toText: (s) => new TextDecoder().decode(b64u.toBytes(s)),
};

export function randomId(len = 6) {
  const a = new Uint8Array(len);
  crypto.getRandomValues(a);
  return b64u.fromBytes(a).replace(/[-_]/g, 'x').slice(0, len);
}

async function hmac(keyBytes, message) {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
}

export function newEventSecret() {
  const a = new Uint8Array(32);
  crypto.getRandomValues(a);
  return b64u.fromBytes(a);
}

export async function deriveGuestKey(eventSecret, guestId) {
  return b64u.fromBytes(await hmac(b64u.toBytes(eventSecret), 'guest:' + guestId));
}

export const slotFor = (now = Date.now()) => Math.floor(now / SLOT_MS);

/** Builds the token a guest's phone displays for the given time. */
export async function makeToken({ eventId, guestId, guestKey }, now = Date.now()) {
  const slot = slotFor(now);
  const mac = await hmac(b64u.toBytes(guestKey), `${eventId}|${guestId}|${slot}`);
  return `PQ1.${eventId}.${guestId}.${slot}.${b64u.fromBytes(mac.slice(0, 8))}`;
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/** Verifies a scanned token against a host event.
 *  Returns { ok, reason, guest?, at? } — reason ∈ bad_format | wrong_event | unknown_guest |
 *  bad_signature | expired | future | replay | already_in */
export async function verifyToken(text, event, now = Date.now()) {
  const parts = String(text || '').trim().split('.');
  if (parts.length !== 5 || parts[0] !== 'PQ1') return { ok: false, reason: 'bad_format' };
  const [, eventId, guestId, slotStr, mac] = parts;
  const slot = Number(slotStr);
  if (!Number.isInteger(slot)) return { ok: false, reason: 'bad_format' };
  if (eventId !== event.id) return { ok: false, reason: 'wrong_event' };
  const guest = event.guests.find((g) => g.id === guestId);
  if (!guest) return { ok: false, reason: 'unknown_guest' };

  const guestKey = await deriveGuestKey(event.secret, guestId);
  const expect = b64u.fromBytes((await hmac(b64u.toBytes(guestKey), `${eventId}|${guestId}|${slot}`)).slice(0, 8));
  if (!safeEqual(expect, mac)) return { ok: false, reason: 'bad_signature', guest };

  const cur = slotFor(now);
  if (slot < cur - 1) return { ok: false, reason: 'expired', guest };
  if (slot > cur + 1) return { ok: false, reason: 'future', guest };
  if ((event.usedTokens || []).includes(`${guestId}.${slot}`)) return { ok: false, reason: 'replay', guest };
  if (guest.checkedInAt) return { ok: false, reason: 'already_in', guest, at: guest.checkedInAt };
  return { ok: true, guest, slot };
}

export const REASON_TEXT = {
  bad_format: 'Not a PlanIt QR Pass code.',
  wrong_event: 'This pass is for a different event.',
  unknown_guest: 'Guest isn\u2019t on this event\u2019s list.',
  bad_signature: 'Signature invalid \u2014 forged or altered code.',
  expired: 'Code expired \u2014 ask the guest to show their live pass (screenshots stop working).',
  future: 'Code is from the future \u2014 the guest\u2019s clock is off.',
  replay: 'This exact code was already used.',
  already_in: 'Already checked in.',
};

// ─── Storage (localStorage, all wrapped) ────────────────────────────────────
function read(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; }
}
function write(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch { return false; }
}
export const loadEvents = () => read(EVENTS_KEY, []);
export const saveEvents = (list) => write(EVENTS_KEY, list);
export const loadWallet = () => read(WALLET_KEY, []);
export const saveWallet = (list) => write(WALLET_KEY, list);

// ─── Share links (fragment only — never sent to any server) ────────────────
export const passLink = (pass) =>
  `${window.location.origin}/beta/qr-pass#pass=${b64u.fromText(JSON.stringify(pass))}`;
export const staffLink = (event) =>
  `${window.location.origin}/beta/qr-pass#staff=${b64u.fromText(JSON.stringify({
    id: event.id, name: event.name, secret: event.secret,
    guests: event.guests.map((g) => ({ id: g.id, name: g.name })),
  }))}`;

export function parseHash(hash) {
  const m = /^#(pass|staff)=(.+)$/.exec(hash || '');
  if (!m) return null;
  try { return { kind: m[1], data: JSON.parse(b64u.toText(m[2])) }; } catch { return null; }
}
