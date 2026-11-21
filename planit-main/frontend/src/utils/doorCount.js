// ═══════════════════════════════════════════════════════════════════════════
// DOOR COUNT — core logic (no React, no DOM)
//
// Everything here runs on the device. Nothing in this file touches the
// network, and no frame or image is ever passed to it: it only sees person
// boxes (numbers) produced by the detector.
//
//   boxes -> tracker (who is who between detections)
//         -> crossing rules (one line, or a two-line gate)
//         -> events -> counts
//
// The live page and the Accuracy Lab both run this same code, so a lab result
// describes the exact logic that counts at the door.
// ═══════════════════════════════════════════════════════════════════════════

export const FEATURE_ID = 'door-count';

// ─── Tuning constants ──────────────────────────────────────────────────────
export const MIN_H = 0.08;        // ignore tracks shorter than 8% of the frame height
export const MIN_HITS = 3;        // measured detections a track needs before it may count
export const TRACK_TTL = 700;     // ms without a measured detection before a track is dropped
export const MAX_PRED = 300;      // ms cap on how far a drawn box is extrapolated
export const BAND_ONE = 0.015;    // single-line dead-band, as a fraction of frame height
export const BAND_GATE = 0;       // two-line gate: the crossing order replaces the dead-band
export const GATE_WINDOW = 4000;  // ms allowed between crossing the first and second line

export const DEFAULT_GATE = { cx: 0.5, cy: 0.55, ang: 0, len: 0.8, gap: 0.12 };

export const DEFAULT_SETTINGS = {
  model: 'lite',          // 'lite' | 'large'
  n: 3,                   // detect every N frames
  conf: 0.4,              // detector confidence threshold
  gateMode: 'one',        // 'one' | 'two'
  flip: false,            // swap which direction is IN
  gate: DEFAULT_GATE,
  roi: null,              // {x,y,w,h} crop, normalised, or null
  cap: 0,                 // capacity limit, 0 = off
  door: '',
  displayView: 'privacy', // what display mode shows: 'privacy' | 'video'
};

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const num = (v, d) => (Number.isFinite(v) ? v : d);

// ─── Persistence (settings and session are kept in this browser only) ──────
const SETTINGS_KEY = 'planit_doorcount_v1';
const SESSION_KEY = 'planit_doorcount_session_v1';

const readJSON = (key) => {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
};
const writeJSON = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
};

/** Saved settings merged over the defaults, with every field range-checked. */
export function loadSettings() {
  const s = readJSON(SETTINGS_KEY) || {};
  const g = s.gate || {};
  const r = s.roi;
  return {
    model: s.model === 'large' ? 'large' : 'lite',
    n: clamp(Math.round(num(s.n, DEFAULT_SETTINGS.n)), 1, 6),
    conf: clamp(num(s.conf, DEFAULT_SETTINGS.conf), 0.2, 0.9),
    gateMode: s.gateMode === 'two' ? 'two' : 'one',
    flip: !!s.flip,
    gate: {
      cx: clamp(num(g.cx, DEFAULT_GATE.cx), 0, 1),
      cy: clamp(num(g.cy, DEFAULT_GATE.cy), 0, 1),
      ang: clamp(num(g.ang, DEFAULT_GATE.ang), -Math.PI / 2, Math.PI / 2),
      len: clamp(num(g.len, DEFAULT_GATE.len), 0.15, 1),
      gap: clamp(num(g.gap, DEFAULT_GATE.gap), 0.03, 0.5),
    },
    roi: r && [r.x, r.y, r.w, r.h].every(Number.isFinite) ? r : null,
    cap: Math.max(0, Math.round(num(s.cap, 0))),
    door: typeof s.door === 'string' ? s.door.slice(0, 60) : '',
    displayView: s.displayView === 'video' ? 'video' : 'privacy',
  };
}
export const saveSettings = (s) => writeJSON(SETTINGS_KEY, s);

export const loadSession = () => readJSON(SESSION_KEY) || {};
export const saveSession = (s) => writeJSON(SESSION_KEY, {
  start: s.start,
  events: s.events.slice(-5000),
  series: s.series.slice(-2000),
});

// ─── Gate geometry ─────────────────────────────────────────────────────────
// A gate is a centre, an angle, a length and (for two lines) a gap. All values
// are normalised so the gate survives a resolution change. u runs along the
// lines; n is the normal that points toward IN before the flip is applied.
// With ang = 0, n points down the screen, so people walking down are IN.

/** Pixel geometry for a W x H frame. Two lines sit at -off and +off along n. */
export function gateGeometry(g, W, H, twoLine) {
  const ux = Math.cos(g.ang), uy = Math.sin(g.ang);
  const nx = -uy, ny = ux;
  const cx = g.cx * W, cy = g.cy * H, half = (g.len * W) / 2;
  const off = twoLine ? (g.gap * H) / 2 : 0;
  const line = (o) => ({
    x1: cx - ux * half + nx * o, y1: cy - uy * half + ny * o,
    x2: cx + ux * half + nx * o, y2: cy + uy * half + ny * o,
  });
  return { cx, cy, ux, uy, nx, ny, half, off, lines: twoLine ? [line(-off), line(off)] : [line(0)] };
}

/** Keep u pointing rightward so the IN side does not jump while rotating. */
function normaliseAngle(a) {
  let x = ((a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  if (x > Math.PI / 2) x -= Math.PI;
  if (x < -Math.PI / 2) x += Math.PI;
  return x;
}

const distToSegment = (px, py, l) => {
  const dx = l.x2 - l.x1, dy = l.y2 - l.y1;
  const t = clamp(((px - l.x1) * dx + (py - l.y1) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(px - (l.x1 + t * dx), py - (l.y1 + t * dy));
};

/** Where a pointer landed: the centre handle, an end handle, the spacing
 *  handle, or anywhere close to a line (which also moves the gate). */
export function gateHandles(geo, twoLine) {
  const h = {
    move: { x: geo.cx, y: geo.cy },
    end: { x: geo.cx + geo.ux * geo.half, y: geo.cy + geo.uy * geo.half },
  };
  if (twoLine) h.gap = { x: geo.cx + geo.nx * geo.off + geo.ux * geo.half * 0.5, y: geo.cy + geo.ny * geo.off + geo.uy * geo.half * 0.5 };
  return h;
}

export function gateHit(geo, twoLine, px, py, reach) {
  const handles = gateHandles(geo, twoLine);
  for (const kind of ['end', 'gap', 'move']) {
    const p = handles[kind];
    if (p && Math.hypot(px - p.x, py - p.y) <= reach) return kind;
  }
  return geo.lines.some((l) => distToSegment(px, py, l) <= reach * 0.8) ? 'move' : null;
}

/** New gate after dragging `kind` to pixel point (px,py). `grab` is the offset
 *  between the pointer and the gate centre when a 'move' drag began. */
export function gateDrag(kind, g, px, py, W, H, grab = { x: 0, y: 0 }) {
  const cx = g.cx * W, cy = g.cy * H;
  if (kind === 'move') {
    return { ...g, cx: clamp((px + grab.x) / W, 0.02, 0.98), cy: clamp((py + grab.y) / H, 0.02, 0.98) };
  }
  if (kind === 'end') {
    const dx = px - cx, dy = py - cy;
    return { ...g, ang: normaliseAngle(Math.atan2(dy, dx)), len: clamp((2 * Math.hypot(dx, dy)) / W, 0.15, 1) };
  }
  // 'gap': distance of the pointer from the centre line, measured along n
  const nx = -Math.sin(g.ang), ny = Math.cos(g.ang);
  const s = Math.abs((px - cx) * nx + (py - cy) * ny);
  return { ...g, gap: clamp((2 * s) / H, 0.03, 0.5) };
}

// ─── Tracker ───────────────────────────────────────────────────────────────
// Greedy IoU matching with a smoothed velocity. Tracks are matched against
// where they are predicted to be, so a person moving between detections still
// keeps one id. Predicted boxes are for drawing only: the crossing rules below
// run on measured detections, never on extrapolated positions.

export const predictBox = (t, now) => {
  const dt = Math.min(now - t.t, MAX_PRED);
  return { x: t.x + t.vx * dt, y: t.y + t.vy * dt, w: t.w, h: t.h };
};

function iou(a, b) {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (w <= 0 || h <= 0) return 0;
  const i = w * h;
  return i / (a.w * a.h + b.w * b.h - i);
}

export function createTracker() {
  let tracks = [];
  let nextId = 1;
  return {
    get tracks() { return tracks; },
    clear() { tracks = []; },
    /** Forget which side of each line every track was on (after the gate moves). */
    resetSides() { tracks.forEach((t) => { t.side = [0, 0]; t.pend = null; }); },
    /** Match measured boxes to tracks. Returns the tracks updated by a measurement. */
    update(boxes, tMs) {
      const pairs = [];
      tracks.forEach((t, i) => boxes.forEach((b, j) => {
        const v = iou(predictBox(t, tMs), b);
        if (v > 0.15) pairs.push([v, i, j]);
      }));
      pairs.sort((a, b) => b[0] - a[0]);
      const usedT = new Set(), usedB = new Set(), matched = [];
      for (const [, i, j] of pairs) {
        if (usedT.has(i) || usedB.has(j)) continue;
        usedT.add(i); usedB.add(j);
        const t = tracks[i], b = boxes[j], dt = tMs - t.t;
        if (dt > 0) { // velocity (per ms) from measured positions only
          t.vx = 0.5 * t.vx + (0.5 * (b.x - t.x)) / dt;
          t.vy = 0.5 * t.vy + (0.5 * (b.y - t.y)) / dt;
        }
        Object.assign(t, b, { t: tMs, hits: t.hits + 1 });
        matched.push(t);
      }
      boxes.forEach((b, j) => {
        if (!usedB.has(j)) tracks.push({ id: nextId++, ...b, vx: 0, vy: 0, t: tMs, hits: 1, side: [0, 0], pend: null });
      });
      tracks = tracks.filter((t) => tMs - t.t < TRACK_TTL);
      return matched;
    },
  };
}

// ─── Crossing rules ────────────────────────────────────────────────────────
// Each matched track is placed relative to the gate: s is its signed distance
// from the gate centre along n (positive toward IN), along is where it sits
// between the line ends (0..1).
//
// One line:  a track flips from one side of the line to the other.
//            A small dead-band around the line absorbs jitter.
// Two lines: a count registers only when a track crosses the FIRST line and
//            then the SECOND, in that order, within GATE_WINDOW. The order
//            gives the direction. A track that wobbles back over the first
//            line cancels its pending crossing, so jitter cannot count.
//
// cfg = { gate, twoLine, flip }. Returns [{ dir: 'in' | 'out', id }].

export function detectCrossings(matched, tMs, W, H, cfg) {
  const geo = gateGeometry(cfg.gate, W, H, cfg.twoLine);
  const band = (cfg.twoLine ? BAND_GATE : BAND_ONE) * H;
  const offsets = cfg.twoLine ? [-geo.off, geo.off] : [0];
  const events = [];
  const label = (dir) => ((dir > 0) !== cfg.flip ? 'in' : 'out');

  for (const t of matched) {
    if (t.hits < MIN_HITS || t.h < MIN_H) continue;
    const px = (t.x + t.w / 2) * W - geo.cx;
    const py = (t.y + t.h / 2) * H - geo.cy;
    const s = px * geo.nx + py * geo.ny;
    const along = (px * geo.ux + py * geo.uy) / (2 * geo.half) + 0.5;
    const inSpan = along >= 0 && along <= 1;

    // Which lines changed side on this measurement?
    const flips = [];
    offsets.forEach((o, k) => {
      const d = s - o;
      const ns = d > band ? 1 : d < -band ? -1 : 0;
      if (!ns) return; // inside the dead-band: keep the previous side
      if (t.side[k] && ns !== t.side[k] && inSpan) flips.push({ k, dir: ns });
      t.side[k] = ns;
    });

    if (!cfg.twoLine) {
      if (flips.length) events.push({ dir: label(flips[0].dir), id: t.id });
      continue;
    }

    // Apply flips in the order the track physically met the lines.
    const reverse = flips.length > 0 && flips.every((f) => f.dir < 0);
    flips.sort((a, b) => (reverse ? b.k - a.k : a.k - b.k));
    for (const f of flips) {
      const first = f.dir > 0 ? 0 : 1;
      if (f.k === first) {
        t.pend = { dir: f.dir, t: tMs };
      } else if (t.pend && t.pend.dir === f.dir && tMs - t.pend.t <= GATE_WINDOW) {
        events.push({ dir: label(f.dir), id: t.id });
        t.pend = null;
      } else {
        t.pend = null; // wrong order, or too slow: no count
      }
    }
  }
  return events;
}

// ─── Session: events and counts ────────────────────────────────────────────
// An event is { t (ms epoch), dir: 'in' | 'out', src: 'auto' | 'manual+' | 'manual-' }.

export function tally(events) {
  let i = 0, o = 0, peak = 0, peakT = 0;
  for (const e of events) {
    if (e.dir === 'in') i++; else o++;
    if (i - o > peak) { peak = i - o; peakT = e.t; }
  }
  return { in: i, out: o, peak, peakT };
}

export function createSession(saved = {}) {
  const s = {
    start: saved.start || Date.now(),
    events: Array.isArray(saved.events) ? saved.events : [],
    series: Array.isArray(saved.series) ? saved.series : [],
  };
  let counts = tally(s.events);
  return {
    data: s,
    get counts() { return counts; },
    /** Occupancy never goes below zero: an OUT with nobody inside is ignored. */
    add(dir, src, t = Date.now()) {
      if (dir === 'out' && counts.in - counts.out <= 0) return false;
      s.events.push({ t, dir, src });
      counts = tally(s.events);
      s.series.push([t, counts.in - counts.out]);
      return true;
    },
    sample(t = Date.now()) { s.series.push([t, counts.in - counts.out]); },
    reset() {
      s.events = []; s.series = []; s.start = Date.now();
      counts = tally(s.events);
    },
  };
}

// ─── Reports ───────────────────────────────────────────────────────────────
export function buildReport(session, settings, reconciliation = null) {
  const { events, start } = session.data;
  const c = session.counts;
  const BUCKET = 300000; // 5 minutes
  const buckets = {};
  for (const e of events) {
    const k = Math.floor(e.t / BUCKET) * BUCKET;
    (buckets[k] ??= { start: new Date(k).toISOString(), in: 0, out: 0 })[e.dir]++;
  }
  let run = 0;
  return {
    door: settings.door,
    sessionStart: new Date(start).toISOString(),
    exported: new Date().toISOString(),
    totals: { in: c.in, out: c.out, inside: c.in - c.out },
    capacity: settings.cap || null,
    peak: { occupancy: c.peak, at: c.peakT ? new Date(c.peakT).toISOString() : null },
    settings: { model: settings.model, detectEvery: settings.n, confidence: settings.conf, gateMode: settings.gateMode },
    bucketMinutes: 5,
    buckets: Object.values(buckets).map((b) => ({ ...b, occupancyEnd: (run += b.in - b.out) })),
    events: events.map((e) => ({ time: new Date(e.t).toISOString(), direction: e.dir, source: e.src })),
    ...(reconciliation ? { reconciliation } : {}),
  };
}

export const buildCsv = (events) =>
  'timestamp,direction,source\n' +
  events.map((e) => `${new Date(e.t).toISOString()},${e.dir},${e.src}`).join('\n');

export const exportName = (door, ext) => `${(door || 'session').replace(/[^\w-]+/g, '_')}.${ext}`;

/** Plain-language reason for a camera failure. */
export function cameraMessage(err) {
  if (err?.message === 'INSECURE') return 'Camera access needs a secure connection. Open this page over https or on localhost.';
  if (err?.message === 'UNSUPPORTED') return 'This browser does not support camera access. Try the latest Chrome or Safari.';
  const m = {
    NotAllowedError: 'Camera permission was denied. Allow camera access in the browser settings and try again.',
    NotFoundError: 'No camera was found on this device.',
    NotReadableError: 'The camera is in use by another app. Close it and try again.',
    OverconstrainedError: 'The selected camera is unavailable. Pick another one.',
  };
  return m[err?.name] || `Camera error: ${err?.message || 'unknown problem'}`;
}

/** 0 = fine, 1 = within 15% of the limit, 2 = at or over the limit. */
export const capacityLevel = (occupancy, cap) =>
  cap > 0 ? (occupancy >= cap ? 2 : occupancy >= cap * 0.85 ? 1 : 0) : 0;
