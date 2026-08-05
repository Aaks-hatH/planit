/**
 * utils/betaTeaserRotation.js
 *
 * With more than one beta feature now running (Face Ticket, Venue Walk, and
 * whatever comes next), letting every teaser pill mount at once would stack
 * floating widgets in the same corner and read as spam rather than "look
 * what's new." Instead, all teasers share a single rotation slot: only the
 * teaser whose turn it is renders at all. Engaging with (or dismissing) a
 * teaser hands the slot to the next one in line, so across a session a
 * person is advertised one beta at a time, not all of them at once.
 *
 * This is a tiny, dependency-free rotation — not a scheduler — so it stays
 * simple: an index into ORDER, persisted in localStorage, advanced whenever
 * a teaser is dismissed or acted on.
 */

const ROTATION_KEY = 'planit_beta_teaser_rotation_v1';

// Add new beta teaser ids here as they ship. Order is just the starting
// rotation — it advances from wherever the last visit left off.
const ORDER = ['face-ticket', 'venue-walk'];

function currentIndex() {
  try {
    const raw = Number(localStorage.getItem(ROTATION_KEY));
    if (Number.isInteger(raw) && raw >= 0 && raw < ORDER.length) return raw;
  } catch {
    /* localStorage unavailable — fall through to default */
  }
  return 0;
}

/** True if `id` currently holds the shared teaser slot — call this before
 *  rendering any beta teaser pill. */
export function isTeaserTurn(id) {
  return ORDER[currentIndex()] === id;
}

/** Hands the slot to the next teaser in rotation. Call this whenever the
 *  current teaser is dismissed or engaged with (navigated from) — never on
 *  a timer, since that could rotate a pill away mid-read. */
export function advanceTeaserRotation() {
  try {
    const next = (currentIndex() + 1) % ORDER.length;
    localStorage.setItem(ROTATION_KEY, String(next));
  } catch {
    /* best-effort only */
  }
}
