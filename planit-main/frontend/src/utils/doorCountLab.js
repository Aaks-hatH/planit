// ═══════════════════════════════════════════════════════════════════════════
// DOOR COUNT — Accuracy Lab
//
// The tester labels real crossings on their own clip (ground truth). The lab
// then replays that clip once per preset and compares each preset's automatic
// counts to the labels. Every number it reports is measured on that clip.
//
// How a replay works:
//   - The clip is stepped through at EVAL_FPS with seeks, so every preset sees
//     the same frames and the replay runs as fast as the device can decode.
//   - Each model decodes and runs each needed frame once. A preset then replays
//     the measured detections for the frames its interval selects. Detection
//     does not depend on the gate or the interval, so this gives each preset
//     exactly the detections it would have produced on its own.
// ═══════════════════════════════════════════════════════════════════════════

import { createTracker, detectCrossings } from './doorCount';
import { DoorDetector, MODELS } from './doorCountModel';

export const TOLERANCE_S = 1.5; // a count matches a tap if they are within +/- this many seconds
export const EVAL_FPS = 30;     // frame grid used for replay, like a typical camera

const SEEK_TIMEOUT_MS = 10000;

// ─── Presets ───────────────────────────────────────────────────────────────
export const INTERVALS = [2, 3, 4];
export const GATES = [{ id: 'one', label: 'One line' }, { id: 'two', label: 'Two-line gate' }];

export function buildPresets(modelIds, intervals, gateIds) {
  const out = [];
  for (const model of modelIds) for (const n of intervals) for (const gate of gateIds) {
    out.push({
      id: `${model}-${n}-${gate}`, model, n, gate,
      label: `${MODELS[model].label}, every ${n}, ${gate === 'two' ? 'two-line gate' : 'one line'}`,
    });
  }
  return out;
}

// ─── Matching and metrics ──────────────────────────────────────────────────
// auto and truth are [{ dir: 'in' | 'out', tm: seconds }].

/** One match per tap and one per automatic count. A pair must agree on
 *  direction and be within the tolerance; closest pairs are matched first. */
export function matchEvents(auto, truth, tol = TOLERANCE_S) {
  const pairs = [];
  auto.forEach((a, i) => truth.forEach((t, j) => {
    const dt = Math.abs(a.tm - t.tm);
    if (a.dir === t.dir && dt <= tol) pairs.push({ i, j, dt });
  }));
  pairs.sort((p, q) => p.dt - q.dt);
  const usedA = new Set(), usedT = new Set(), matches = [];
  for (const p of pairs) {
    if (usedA.has(p.i) || usedT.has(p.j)) continue;
    usedA.add(p.i); usedT.add(p.j); matches.push(p);
  }
  return matches;
}

const net = (list) => list.reduce((n, e) => n + (e.dir === 'in' ? 1 : -1), 0);
const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

export function percentile(values, p) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.max(0, Math.ceil((p / 100) * s.length) - 1)];
}

/** Metrics for one preset. Precision is null when nothing was counted. */
export function scorePreset(auto, truth, latencies, inferMs) {
  const tp = matchEvents(auto, truth).length;
  const precision = auto.length ? tp / auto.length : null;
  const recall = truth.length ? tp / truth.length : null;
  const f1 = precision != null && recall != null && precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  return {
    counted: auto.length, tp, precision, recall, f1,
    netError: net(auto) - net(truth), // automatic net minus labeled net; negative = undercount
    latMean: mean(latencies), latP95: percentile(latencies, 95),
    inferAvg: mean(inferMs),
  };
}

/** Best first: higher F1, then smaller net error, then lower latency. */
export function rankRows(rows) {
  return [...rows].sort((a, b) =>
    b.f1 - a.f1
    || Math.abs(a.netError) - Math.abs(b.netError)
    || (a.latMean ?? Infinity) - (b.latMean ?? Infinity));
}

// ─── Clips ─────────────────────────────────────────────────────────────────
export class LabError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

const once = (el, ok, bad) => new Promise((resolve, reject) => {
  const done = () => { clean(); resolve(); };
  const fail = () => { clean(); reject(new LabError('CLIP', 'This clip could not be played by the browser. Try an MP4 (H.264) or WebM file.')); };
  const clean = () => { el.removeEventListener(ok, done); el.removeEventListener(bad, fail); };
  el.addEventListener(ok, done);
  el.addEventListener(bad, fail);
});

/** Wait until a <video> has metadata, a decodable first frame and a real duration.
 *  Browser recordings often report an infinite duration until the end is seen. */
export async function prepareClip(video) {
  if (video.readyState < 2) await once(video, 'loadeddata', 'error');
  if (!Number.isFinite(video.duration)) {
    video.currentTime = 1e101; // forces the browser to find the real end
    await once(video, 'timeupdate', 'error');
    video.currentTime = 0;
    await once(video, 'seeked', 'error');
  }
  if (!video.videoWidth || !(video.duration > 0)) throw new LabError('CLIP', 'This clip has no readable video.');
  return { seconds: video.duration, w: video.videoWidth, h: video.videoHeight };
}

/** Hidden element used for replay so the visible player is never disturbed. */
export function openClip(url) {
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.preload = 'auto';
  v.src = url;
  return v;
}

function seekTo(video, t) {
  if (Math.abs(video.currentTime - t) < 0.0005) return Promise.resolve(); // 'seeked' would not fire
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { clean(); reject(new LabError('CLIP', 'The clip stopped responding while it was being replayed.')); }, SEEK_TIMEOUT_MS);
    const done = () => { clean(); resolve(); };
    const clean = () => { clearTimeout(timer); video.removeEventListener('seeked', done); };
    video.addEventListener('seeked', done);
    video.currentTime = Math.min(t, Math.max(0, video.duration - 0.001));
  });
}

const aborted = () => new DOMException('Cancelled', 'AbortError');

// ─── Replay ────────────────────────────────────────────────────────────────
/** Replays `url` for every preset and returns one scored row per preset.
 *  base = { conf, roi, gate, flip } as set on the Count screen.
 *  onProgress({ done, total, phase }) is throttled; signal cancels the run. */
export async function runLab({ url, truth, presets, base, onProgress, signal }) {
  const video = openClip(url);
  const clip = await prepareClip(video);
  const frames = Math.floor(clip.seconds * EVAL_FPS);
  const models = [...new Set(presets.map((p) => p.model))];

  const needed = (modelId) => {
    const ns = presets.filter((p) => p.model === modelId).map((p) => p.n);
    return (k) => ns.some((n) => k % n === 0);
  };
  const total = models.reduce((sum, m) => {
    const need = needed(m);
    let c = 0;
    for (let k = 0; k < frames; k++) if (need(k)) c++;
    return sum + c;
  }, 0);

  let done = 0, lastReport = 0;
  const report = (phase, force) => {
    const now = performance.now();
    if (force || now - lastReport > 80) { lastReport = now; onProgress?.({ done, total, phase }); }
  };

  const rows = [];
  const delegates = {};
  try {
    for (const modelId of models) {
      const detector = new DoorDetector();
      report(`Loading ${MODELS[modelId].label}`, true);
      delegates[modelId] = (await detector.load(modelId, base.conf)).delegate;

      // Decode and detect each needed frame once for this model.
      const need = needed(modelId);
      const cache = new Map(); // frame index -> measured detections (insertion order = time order)
      try {
        for (let k = 0; k < frames; k++) {
          if (!need(k)) continue;
          if (signal?.aborted) throw aborted();
          await seekTo(video, k / EVAL_FPS);
          cache.set(k, { ...detector.detect(video, base.roi), t: (k / EVAL_FPS) * 1000 });
          done++;
          report(`Detecting with ${MODELS[modelId].label}`);
        }
      } finally {
        detector.close();
      }

      for (const preset of presets.filter((p) => p.model === modelId)) {
        rows.push({ preset, ...replayPreset(preset, cache, base, clip, truth) });
      }
    }
  } finally {
    video.removeAttribute('src');
    video.load();
  }
  report('Done', true);
  return { rows: rankRows(rows), clip, delegates };
}

/** Feed one preset the detections its interval selects, through the same
 *  tracker and crossing rules the live page uses. */
function replayPreset(preset, cache, base, clip, truth) {
  const tracker = createTracker();
  const cfg = { gate: base.gate, twoLine: preset.gate === 'two', flip: base.flip };
  const auto = [], latencies = [], inferMs = [];
  for (const [k, f] of cache) {
    if (k % preset.n) continue;
    inferMs.push(f.inferMs);
    const t0 = performance.now();
    const matched = tracker.update(f.boxes, f.t);
    const events = detectCrossings(matched, f.t, clip.w, clip.h, cfg);
    const trackMs = performance.now() - t0;
    for (const e of events) {
      auto.push({ dir: e.dir, tm: f.t / 1000 });
      latencies.push(f.prepMs + f.inferMs + trackMs); // frame ready -> count: crop + inference + tracking
    }
  }
  return scorePreset(auto, truth, latencies, inferMs);
}
