/**
 * utils/betaTeaserRotation.js
 *
 * One shared, deliberately rare "promo slot" for all PlanIt Labs betas.
 *
 * Rules (all enforced here so no teaser can break them):
 *  - At most ONE teaser is ever in play per browser session, and it appears on
 *    ONE page only — the first eligible page it lands on. Navigating away ends it.
 *  - Each session only has a SHOW_CHANCE probability of showing anything at all,
 *    and after a teaser is shown there's a COOLDOWN_DAYS quiet period.
 *  - Teasers take turns (ORDER). Each showing hands the slot to the next lab.
 *  - Closing a teaser with the X, or clicking through it, retires THAT lab's
 *    teaser permanently on this browser. Nothing brings it back.
 *
 * All storage access is wrapped: if storage is unavailable, teasers stay hidden.
 */

const ROTATION_KEY = 'planit_beta_teaser_rotation_v1';
const DISMISSED_KEY = 'planit_beta_teasers_dismissed_v1';
const LAST_SHOWN_KEY = 'planit_beta_teaser_last_shown_v1';
const SESSION_KEY = 'planit_beta_teaser_session_v1';

// Add new lab teaser ids here as they ship.
export const TEASER_ORDER = ['face-ticket', 'venue-walk', 'qr-pass', 'venue-map'];

const SHOW_CHANCE = 0.25;   // share of sessions that show any teaser at all
const COOLDOWN_DAYS = 4;    // quiet period after a teaser has been shown

const readJSON = (store, key, fallback) => {
  try { const v = JSON.parse(store.getItem(key)); return v ?? fallback; } catch { return fallback; }
};

function getDismissed() {
  const d = readJSON(localStorage, DISMISSED_KEY, []);
  return Array.isArray(d) ? d : [];
}

/** Permanently retires a lab's teaser on this browser. */
export function dismissTeaserForever(id) {
  try {
    const d = getDismissed();
    if (!d.includes(id)) localStorage.setItem(DISMISSED_KEY, JSON.stringify([...d, id]));
  } catch { /* best-effort */ }
}

export const isTeaserDismissed = (id) => {
  try { return getDismissed().includes(id); } catch { return true; }
};

function rotationIndex() {
  try {
    const raw = Number(localStorage.getItem(ROTATION_KEY));
    if (Number.isInteger(raw) && raw >= 0 && raw < TEASER_ORDER.length) return raw;
  } catch { /* fall through */ }
  return 0;
}

function advanceRotationPast(id) {
  try {
    const i = TEASER_ORDER.indexOf(id);
    localStorage.setItem(ROTATION_KEY, String((i + 1) % TEASER_ORDER.length));
  } catch { /* best-effort */ }
}

function nextAvailableId() {
  const dismissed = getDismissed();
  const start = rotationIndex();
  for (let k = 0; k < TEASER_ORDER.length; k++) {
    const id = TEASER_ORDER[(start + k) % TEASER_ORDER.length];
    if (!dismissed.includes(id)) return id;
  }
  return null;
}

/** Decided once per session. Returns the id allowed to show this session, or null. */
export function teaserForThisSession() {
  try {
    const existing = readJSON(sessionStorage, SESSION_KEY, null);
    if (existing) return existing.id || null;

    let id = null;
    const last = Number(localStorage.getItem(LAST_SHOWN_KEY)) || 0;
    const cooledDown = Date.now() - last > COOLDOWN_DAYS * 86400000;
    if (cooledDown && Math.random() < SHOW_CHANCE) id = nextAvailableId();

    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id, path: null }));
    return id;
  } catch {
    return null;
  }
}

/** Called when a teaser is about to appear. The first page to claim wins;
 *  every other page in the session gets false. Also starts the cooldown and
 *  hands the rotation slot to the next lab. */
export function claimTeaserPage(id, pathname) {
  try {
    const s = readJSON(sessionStorage, SESSION_KEY, null);
    if (!s || s.id !== id) return false;
    if (s.path === null) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id, path: pathname }));
      localStorage.setItem(LAST_SHOWN_KEY, String(Date.now()));
      advanceRotationPast(id);
      return true;
    }
    return s.path === pathname;
  } catch {
    return false;
  }
}
