// ═══════════════════════════════════════════════════════════════════════════
// DOOR COUNT — setup quality check
//
// Scores the camera view before counting starts: are people big enough, is
// there enough light, is motion blur low, is the line where people are fully
// visible, and is the camera pointed away from bright glare.
//
// The pixels are only sampled into a small off-screen canvas, reduced to a few
// numbers and thrown away. Nothing is stored or sent.
//
// THRESHOLDS: these are starting points. The blur one was checked only against
// synthetic images, and none of them has been tuned on real door footage. They
// guide a tester; they are not a guarantee of counting accuracy. That is what
// the Accuracy Lab is for.
// ═══════════════════════════════════════════════════════════════════════════

import { MIN_H, gateGeometry } from './doorCount';

export const THRESHOLDS = {
  heightOk: 0.25, heightWarn: 0.15,   // typical person height as a share of frame height
  lumaFail: 55, lumaWarn: 85, lumaHigh: 215, // mean brightness, 0..255
  satWarn: 0.08, satFail: 0.18,       // share of near-white pixels
  backlit: 0.6,                       // person brightness / frame brightness
  sharpOk: 1.2, sharpWarn: 0.9,       // edge steepness relative to contrast
  clipWarn: 0.15, clipFail: 0.35,     // share of people cut off by the frame edge at the line
};

const SW = 320, SH = 180;   // whole-frame sample for light and glare
const CROP = 128;           // torso crop, taken at native resolution so blur stays visible
const KEEP = 40;            // recent samples kept for each signal

const median = (a) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.floor(s.length / 2)];
};

// ─── Pixel sampling ────────────────────────────────────────────────────────
const toGray = (data, n) => {
  const g = new Float32Array(n);
  for (let i = 0; i < n; i++) g[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  return g;
};

/** Edge steepness relative to contrast: about 1.4 to 1.6 for crisp synthetic
 *  images and well under 1 once edges are smeared. Differences below sensor
 *  noise level (4 grey levels) are ignored. */
export function edgeSteepness(g, W, H) {
  let n = g.length, mean = 0;
  for (const v of g) mean += v;
  mean /= n;
  let varSum = 0;
  for (const v of g) varSum += (v - mean) ** 2;
  const std = Math.sqrt(varSum / n);
  let e1 = 0, e2 = 0;
  for (let y = 0; y < H - 1; y++) {
    for (let x = 0; x < W - 1; x++) {
      const i = y * W + x;
      for (const d of [g[i + 1] - g[i], g[i + W] - g[i]]) {
        const a = Math.abs(d);
        if (a >= 4) { e1 += a; e2 += a * a; }
      }
    }
  }
  return e1 ? e2 / e1 / (std + 4) : 0;
}

/** Sample the current frame. `boxes` are person boxes (normalised) to inspect.
 *  Returns { luma, sat, people: [{ sharp, luma }] }, or null if it cannot read pixels. */
export function measureFrame(video, canvas, boxes) {
  const vw = video.videoWidth, vh = video.videoHeight;
  if (!vw || !vh) return null;
  try {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    canvas.width = SW; canvas.height = SH;
    ctx.drawImage(video, 0, 0, SW, SH);
    const whole = toGray(ctx.getImageData(0, 0, SW, SH).data, SW * SH);
    let sum = 0, sat = 0;
    for (const v of whole) { sum += v; if (v >= 245) sat++; }

    const people = [];
    const tall = boxes.filter((b) => b.h >= MIN_H).sort((a, b) => b.h - a.h).slice(0, 3);
    for (const b of tall) {
      // centre of the box, native pixels, capped at CROP x CROP
      const w = Math.min(CROP, Math.floor(b.w * vw * 0.7)), h = Math.min(CROP, Math.floor(b.h * vh * 0.5));
      if (w < 16 || h < 16) continue;
      const sx = Math.max(0, Math.min(vw - w, Math.round((b.x + b.w / 2) * vw - w / 2)));
      const sy = Math.max(0, Math.min(vh - h, Math.round((b.y + b.h * 0.4) * vh - h / 2)));
      canvas.width = w; canvas.height = h;
      ctx.drawImage(video, sx, sy, w, h, 0, 0, w, h);
      const g = toGray(ctx.getImageData(0, 0, w, h).data, w * h);
      let m = 0;
      for (const v of g) m += v;
      people.push({ sharp: edgeSteepness(g, w, h), luma: m / g.length });
    }
    return { luma: sum / whole.length, sat: sat / whole.length, people };
  } catch {
    return null; // e.g. the canvas is blocked from reading this video
  }
}

// ─── Rolling monitor ───────────────────────────────────────────────────────
export function createQualityMonitor() {
  const m = { heights: [], sharp: [], ratio: [], near: [], frame: null };
  const push = (a, v) => { a.push(v); if (a.length > KEEP) a.shift(); };
  return {
    reset() { Object.assign(m, { heights: [], sharp: [], ratio: [], near: [], frame: null }); },

    /** Called with every measured detection pass. */
    onDetections(boxes, gate, twoLine, W, H) {
      const geo = gateGeometry(gate, W, H, twoLine);
      for (const b of boxes) {
        if (b.h < MIN_H) continue;
        push(m.heights, b.h);
        // Is this person at the line, and is any part of them cut off by the frame?
        const px = (b.x + b.w / 2) * W - geo.cx, py = (b.y + b.h / 2) * H - geo.cy;
        const s = px * geo.nx + py * geo.ny;
        const along = (px * geo.ux + py * geo.uy) / (2 * geo.half) + 0.5;
        if (along >= 0 && along <= 1 && Math.abs(s) <= geo.off + b.h * H * 0.6) {
          push(m.near, b.x < 0.005 || b.y < 0.005 || b.x + b.w > 0.995 || b.y + b.h > 0.995);
        }
      }
    },

    /** Called with the result of measureFrame (about twice a second). */
    onFrame(stats) {
      if (!stats) return;
      m.frame = { luma: stats.luma, sat: stats.sat };
      for (const p of stats.people) {
        push(m.sharp, p.sharp);
        if (stats.luma > 1) push(m.ratio, p.luma / stats.luma);
      }
    },

    snapshot(gate, twoLine, W, H) {
      return scoreSetup({
        frame: m.frame, height: median(m.heights), sharp: median(m.sharp), ratio: median(m.ratio),
        near: m.near, gate, twoLine, W, H,
      });
    },
  };
}

// ─── Scoring ───────────────────────────────────────────────────────────────
// state: 'ok' | 'warn' | 'fail' | 'wait' (not enough data yet)

export function scoreSetup({ frame, height, sharp, ratio, near, gate, twoLine, W, H }) {
  const T = THRESHOLDS;
  const checks = [];
  const add = (id, label, state, detail, fix) => checks.push({ id, label, state, detail, fix: state === 'ok' || state === 'wait' ? null : fix });

  // 1. People big enough
  if (height == null) {
    add('size', 'People are big enough', 'wait', 'Waiting for someone to walk into view.');
  } else {
    const state = height >= T.heightOk ? 'ok' : height >= T.heightWarn ? 'warn' : 'fail';
    add('size', 'People are big enough', state, `A typical person fills ${Math.round(height * 100)}% of the picture height.`,
      'Move the camera closer, zoom in, or use Set region to crop to the doorway. People shorter than 8% of the picture are ignored.');
  }

  // 2. Enough light
  if (!frame) {
    add('light', 'Enough light', 'wait', 'Waiting for the first picture.');
  } else {
    const dark = frame.luma < T.lumaWarn, bright = frame.luma > T.lumaHigh;
    const state = frame.luma < T.lumaFail ? 'fail' : dark || bright ? 'warn' : 'ok';
    add('light', 'Enough light', state, `Average brightness is ${Math.round((frame.luma / 255) * 100)}%.`,
      bright ? 'The picture is very bright. Shade the camera or reduce the exposure.'
        : 'Add light near the door. Dark video makes people harder to detect.');
  }

  // 3. Little motion blur. Capped at a warning: the threshold is untuned.
  if (sharp == null) {
    add('blur', 'Little motion blur', 'wait', 'Waiting for someone to walk into view.');
  } else {
    const state = sharp >= T.sharpOk ? 'ok' : 'warn';
    add('blur', 'Little motion blur', state, state === 'ok' ? 'People look sharp.' : 'People look soft or smeared.',
      'Add light so the camera can use a faster shutter, and clean the lens. If counts miss people who walk fast, this is a likely cause.');
  }

  // 4. Line where people are fully visible
  const g = gateGeometry(gate, W || 1, H || 1, twoLine);
  const inside = g.lines.every((l) => [[l.x1, l.y1], [l.x2, l.y2]].every(([x, y]) => x >= 0 && x <= (W || 1) && y >= 0 && y <= (H || 1)));
  const lineFix = 'Move the line toward the middle of the picture, where people show from head to feet, or re-aim the camera so nobody is cut off at the edge.';
  if (!inside) {
    add('line', 'Line placed where people are fully visible', 'fail', 'The line runs off the edge of the picture.', lineFix);
  } else if (near.length < 5) {
    add('line', 'Line placed where people are fully visible', 'wait', 'Walk a few people across the line to check they are not cut off.');
  } else {
    const cut = near.filter(Boolean).length / near.length;
    const state = cut > T.clipFail ? 'fail' : cut > T.clipWarn ? 'warn' : 'ok';
    add('line', 'Line placed where people are fully visible', state, `${Math.round(cut * 100)}% of people at the line are cut off by the picture edge.`, lineFix);
  }

  // 5. Not pointed into bright light
  if (!frame) {
    add('glare', 'Camera not pointing into bright light', 'wait', 'Waiting for the first picture.');
  } else {
    const backlit = ratio != null && frame.luma > 100 && ratio < T.backlit;
    const state = frame.sat > T.satFail ? 'fail' : frame.sat > T.satWarn || backlit ? 'warn' : 'ok';
    add('glare', 'Camera not pointing into bright light', state,
      backlit ? 'People are much darker than their background.' : `${Math.round(frame.sat * 100)}% of the picture is blown out to white.`,
      'Turn the camera away from windows and glass doors, or move it so bright light is out of the picture. People in front of a bright background turn into dark shapes.');
  }

  const scored = checks.filter((c) => c.state !== 'wait');
  const points = { ok: 1, warn: 0.5, fail: 0 };
  const score = scored.length ? Math.round((scored.reduce((s, c) => s + points[c.state], 0) / scored.length) * 100) : null;
  return { checks, score, measured: scored.length };
}
