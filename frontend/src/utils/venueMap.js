import { publicOrigin } from './publicOrigin';
// Venue Map — shared floor plan + landmark anchors. Pure client-side.
// A layout is a small JSON document. It travels between phones inside a URL
// fragment (#v=…), which browsers never send to any server.

export const LANDMARK_TYPES = {
  entrance: 'Entrance', bar: 'Bar', stage: 'Stage', restroom: 'Restrooms',
  buffet: 'Buffet', dance: 'Dance floor', exit: 'Exit', other: 'Landmark',
};

const DRAFT_KEY = 'planit_venuemap_draft_v1';
const GUEST_KEY = 'planit_venuemap_guest_v1';

export const emptyLayout = () => ({
  name: 'My venue', wM: 30, dM: 20, // room size in metres
  tables: [], landmarks: [], guests: [],
});

const rd = (n) => Math.round(n * 10) / 10;
let idc = 0;
export const uid = () => `${Date.now().toString(36)}${(idc++).toString(36)}`;

// ─── compact wire format ───────────────────────────────────────────────────
const toWire = (l) => ({
  n: l.name, w: l.wM, d: l.dM,
  t: l.tables.map((t) => [t.label, rd(t.x), rd(t.y), t.seats || 0]),
  l: l.landmarks.map((m) => [m.type, m.label, rd(m.x), rd(m.y)]),
  g: l.guests.map((g) => [g.name, l.tables.findIndex((t) => t.id === g.tableId)]),
});
const fromWire = (w) => {
  const tables = (w.t || []).map((t) => ({ id: uid(), label: String(t[0]), x: +t[1], y: +t[2], seats: +t[3] || 0 }));
  return {
    name: String(w.n || 'Venue'), wM: +w.w || 30, dM: +w.d || 20, tables,
    landmarks: (w.l || []).map((m) => ({ id: uid(), type: m[0] in LANDMARK_TYPES ? m[0] : 'other', label: String(m[1]), x: +m[2], y: +m[3] })),
    guests: (w.g || []).filter((g) => g[1] >= 0 && tables[g[1]]).map((g) => ({ id: uid(), name: String(g[0]), tableId: tables[g[1]].id })),
  };
};

const b64u = (bytes) => {
  let s = '';
  bytes.forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64u = (str) => {
  const p = str.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(p + '='.repeat((4 - (p.length % 4)) % 4)), (c) => c.charCodeAt(0));
};

async function pipe(bytes, stream) {
  const out = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export async function encodeLayout(layout) {
  const raw = new TextEncoder().encode(JSON.stringify(toWire(layout)));
  if (typeof CompressionStream !== 'undefined') {
    try { return 'z' + b64u(await pipe(raw, new CompressionStream('deflate-raw'))); } catch { /* fall through */ }
  }
  return 'r' + b64u(raw);
}

export async function decodeLayout(str) {
  const kind = str[0];
  let bytes = unb64u(str.slice(1));
  if (kind === 'z') bytes = await pipe(bytes, new DecompressionStream('deflate-raw'));
  else if (kind !== 'r') throw new Error('Unknown layout format');
  return fromWire(JSON.parse(new TextDecoder().decode(bytes)));
}

export const shareLink = async (layout) =>
  `${publicOrigin()}/beta/venue-map#v=${await encodeLayout(layout)}`;

export const layoutFromHash = async (hash) => {
  const m = /^#v=(.+)$/.exec(hash || '');
  return m ? decodeLayout(m[1]) : null;
};

// ─── storage ───────────────────────────────────────────────────────────────
const read = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* full/unavailable */ } };
export const loadDraft = () => read(DRAFT_KEY) || emptyLayout();
export const saveDraft = (l) => write(DRAFT_KEY, l);
export const loadGuestLayout = () => read(GUEST_KEY);
export const saveGuestLayout = (l) => write(GUEST_KEY, l);

// ─── directions from an anchor to a table ─────────────────────────────────
// Plan coordinates: x 0..100 across, y 0..H down, where H = 100 * dM / wM.
export const planH = (l) => (100 * l.dM) / l.wM;
const toMetres = (l, dx, dy) => Math.hypot((dx * l.wM) / 100, (dy * l.wM) / 100);

/** from/facing are landmarks (facing optional), to is a table. */
export function directions(layout, from, to, facing) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const metres = Math.round(toMetres(layout, dx, dy));
  if (metres < 2) return `You\u2019re right next to Table ${to.label}.`;

  const bearing = Math.atan2(dx, -dy) * 180 / Math.PI; // 0 = plan-up, +90 = plan-right
  let phrase;
  if (facing) {
    const fb = Math.atan2(facing.x - from.x, -(facing.y - from.y)) * 180 / Math.PI;
    let rel = ((bearing - fb + 540) % 360) - 180; // -180..180, + = right
    const a = Math.abs(rel);
    if (a < 20) phrase = 'straight ahead';
    else if (a < 70) phrase = rel > 0 ? 'ahead and to your right' : 'ahead and to your left';
    else if (a < 110) phrase = rel > 0 ? 'to your right' : 'to your left';
    else if (a < 160) phrase = rel > 0 ? 'behind you to the right' : 'behind you to the left';
    else phrase = 'directly behind you';
  } else {
    const names = ['toward the top of the plan', 'toward the top-right', 'toward the right', 'toward the bottom-right',
      'toward the bottom', 'toward the bottom-left', 'toward the left', 'toward the top-left'];
    phrase = names[Math.round(((bearing + 360) % 360) / 45) % 8];
  }

  let near = null;
  let best = Infinity;
  layout.landmarks.forEach((m) => {
    if (m.id === from.id) return;
    const d = Math.hypot(m.x - to.x, m.y - to.y);
    if (d < best) { best = d; near = m; }
  });
  const nearTxt = near && toMetres(layout, near.x - to.x, near.y - to.y) < 8 ? ` It\u2019s close to the ${near.label}.` : '';
  return `Table ${to.label} is about ${metres} m ${phrase} from the ${from.label}.${nearTxt}`;
}
