import { useEffect, useRef, useMemo } from 'react';

// ═══════════════════════════════════════════════════════════════════════════════
// STAR BACKGROUND v5 — CHERRY SPRINGS DARK SKY OBSERVATORY GRADE
//
// A physically-inspired night sky renderer for React applications.
// Optimised for OLED/black backgrounds. All rendering via Canvas 2D API.
//
// ── MILKY WAY SYSTEM ───────────────────────────────────────────────────────────
//   The Milky Way is rendered in 7 layered passes to simulate what a dark-
//   adapted eye sees from a Bortle Class 2 site like Cherry Springs PA:
//
//   1. Galactic background luminance
//      A very faint wide arch of integrated starlight — the general brightness
//      increase along the galactic plane even away from the core.
//
//   2. Diffuse band glow (28 elliptical gradient blobs)
//      Each blob represents a section of the spiral arm with realistic
//      colour: warm yellow-orange near the core bulge, cool blue-white in
//      the outer arms. Two passes per blob (wide bloom + tight core).
//
//   3. Galactic core bulge (Sagittarius direction)
//      Three concentric radial gradients with warm [255,228,175] peak colour
//      simulate the nuclear bulge — the brightest part visible to the naked eye.
//
//   4. Dark dust lanes (multiply-blended ellipses)
//      45 overlapping dark blobs use canvas 'multiply' composite to absorb
//      the glow beneath, creating the dark rifts (Great Rift, Cygnus Rift)
//      that are clearly visible from dark sites.
//
//   5. Resolved micro-stars (8500 points)
//      Individually plotted stars following the galactic density distribution
//      with spectral colours: warm near core, cool in arms. King profile
//      concentration for the nuclear bulge region.
//
//   6. Star clusters (buildStarClusters)
//      Open clusters (loose, younger, bluer) and globular clusters (compact,
//      older, redder/yellower) placed along the band.
//
//   7. Emission nebulae (buildEmissionNebulae)
//      H-II regions (ionised hydrogen clouds) glow red-pink. Also includes
//      a reflection nebula (blue-purple). These are very faint — present at
//      dark sites but not distracting.
//
// ── METEOR TRAIL SYSTEM ────────────────────────────────────────────────────────
//   Meteors are rendered as smooth continuous luminous lines, NOT dot arrays.
//   Three render passes create depth and realism:
//
//   Pass 1 (Outer diffuse glow): Wide, very transparent strokes via 'screen'
//   blend mode. Width = headR × 9 tapering to 0. Creates the soft aura around
//   the bright channel seen through atmospheric scattering.
//
//   Pass 2 (Mid plasma glow): Narrower, more opaque. Simulates the hot plasma
//   column (predominantly Mg, Na, Fe emission lines → white-orange).
//
//   Pass 3 (Core ablation channel): The sharp bright inner trail. Colour-graded
//   from head colour → plasma → tail colour. Width tapers from headR to 0.25px.
//
//   Ion trail: Some meteors (35% chance) leave a persistent green-glowing wake
//   — the ionisation train visible for seconds after a bright fireball. Drawn
//   as independent stroke history on 'screen' blend.
//
//   Entry flash: Gaussian bloom at spawn point simulating atmospheric ignition.
//   Forward diffraction spike on large meteors (headR > 2.0).
//   Ablation sparkles: Individual glowing particles ejected from the head.
//   Fragmentation: Parent can split into 2–4 smaller child meteors.
//
// ── STAR RENDERING ─────────────────────────────────────────────────────────────
//   Stars use a 3-depth parallax layer system (layer 0 = nearest/brightest).
//   Spectral colours sampled from a CDF weighted by realistic stellar population
//   fractions (M-dwarfs most common, O stars extremely rare).
//   Atmospheric scintillation: twinkle rate scales with screen-y position —
//   stars near the horizon twinkle faster due to more atmosphere to look through.
//   Wink-out (stellar occultation): occasional brief dimming of individual stars.
//   Bright stars get 8-pointed diffraction spikes + radial bloom gradient.
//
// ── ATMOSPHERIC EFFECTS ────────────────────────────────────────────────────────
//   Airglow: OI 557.7nm (green, ~90km altitude) + NaD 589nm (yellow, ~90km)
//            + OH Meinel bands (red-NIR, ~85km) — all very subtle.
//   Zodiacal light: Faint elongated cone from horizon along the ecliptic.
//            Interplanetary dust forward-scattering sunlight — only visible
//            from dark sites like Cherry Springs.
//   Atmospheric extinction: Stars near the horizon are dimmed + warmed in colour
//            by the extra air column (Rayleigh + Mie scattering).
//   Vignette: OLED-grade edge darkening via radial gradient.
//
// ── SATELLITE PASSES ────────────────────────────────────────────────────────────
//   ISS/satellite simulation: steady dot moving at realistic angular speed with
//   occasional specular flash (solar panel glint). Period ~45–150s.
//
// ── SUPERNOVA (easter egg) ─────────────────────────────────────────────────────
//   Triggered after 5 minutes, or manually via window.__starExplosion().
//   Multi-phase: ignition flash → fireball expansion → shock rings → debris
//   cloud → remnant nebula. All physically inspired.
//
// ── CONSOLE API ────────────────────────────────────────────────────────────────
//   window.__starExplosion()            — egg meteor → star → supernova
//   window.__starShower('parallel')     — parallel barrage
//   window.__starShower('radial')       — fan burst
//   window.__starShower('vformation')   — V-formation
//   window.__starShower('cluster')      — dense cluster
//   window.__starShower()               — random pattern
//
// ═══════════════════════════════════════════════════════════════════════════════

// ─── MATH UTILITIES ───────────────────────────────────────────────────────────
//
// All rendering uses pure canvas 2D API — no WebGL, no external libraries.
// The coordinate system is screen pixels, origin top-left.
// Relative positions (xr, yr) are 0–1 normalised to canvas width/height.
// Time `t` is always in seconds (performance.now() / 1000 or ts * 0.001).
// How did I do this, i still wonder?(Aakshat)
// ─────────────────────────────────────────────────────────────────────────────
function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function rgba(r, g, b, a) { return `rgba(${r|0},${g|0},${b|0},${clamp(a,0,1).toFixed(3)})`; }
function lerpC(a, b, t) { return [lerp(a[0],b[0],t), lerp(a[1],b[1],t), lerp(a[2],b[2],t)]; }
function dist2(ax, ay, bx, by) { return (ax-bx)**2 + (ay-by)**2; }
function easeOut(t, p=2) { return 1 - Math.pow(1 - clamp(t,0,1), p); }
function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}
function hash(n) {
  // Simple deterministic pseudo-random from a seed
  let x = Math.sin(n) * 43758.5453123;
  return x - Math.floor(x);
}
function noise2D(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix + iy * 57);
  const b = hash(ix + 1 + iy * 57);
  const c = hash(ix + (iy + 1) * 57);
  const d = hash(ix + 1 + (iy + 1) * 57);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uy);
}
function fbm(x, y, octaves=4) {
  let v = 0, amp = 0.5, freq = 1, max = 0;
  for (let i = 0; i < octaves; i++) {
    v += noise2D(x * freq, y * freq) * amp;
    max += amp; amp *= 0.5; freq *= 2.1;
  }
  return v / max;
}

// ─── SPECTRAL STAR COLOURS (physically-based O/B/A/F/G/K/M types) ─────────────
// Each type: [r,g,b] for the colour, and frequency weight
const SPECTRAL_TYPES = [
  { col: [155, 176, 255], weight: 0.003 }, // O — blue-violet (rare)
  { col: [170, 191, 255], weight: 0.012 }, // B — blue-white
  { col: [202, 215, 255], weight: 0.065 }, // A — white-blue  (Vega, Sirius)
  { col: [248, 247, 255], weight: 0.12  }, // F — white-yellow (Procyon)
  { col: [255, 248, 230], weight: 0.21  }, // G — yellow-white (Sun)
  { col: [255, 224, 165], weight: 0.30  }, // K — orange  (Arcturus)
  { col: [255, 189, 111], weight: 0.29  }, // M — red-orange (Betelgeuse)
];

// Build CDF for weighted sampling
const SPECTRAL_CDF = (() => {
  const cdf = []; let acc = 0;
  const total = SPECTRAL_TYPES.reduce((s, t) => s + t.weight, 0);
  for (const t of SPECTRAL_TYPES) { acc += t.weight / total; cdf.push(acc); }
  return cdf;
})();

function randomSpectralColor() {
  const r = Math.random();
  for (let i = 0; i < SPECTRAL_CDF.length; i++) {
    if (r <= SPECTRAL_CDF[i]) return [...SPECTRAL_TYPES[i].col];
  }
  return [255, 255, 255];
}

// ─── MILKY WAY SYSTEM ────────────────────────────────────────────────────────
//
// The Milky Way band is rendered in three passes:
//   1. Galactic dust lanes   — dark absorption clouds painted on a glow layer
//   2. Diffuse glow          — the integrated starlight cloud (multiple gradients)
//   3. Resolved star cloud   — thousands of tiny stars along the band
//
// The band runs diagonally (like Cherry Springs PA, late summer ~Scorpius/Sagittarius arc)
// Galactic centre is at roughly 35% from left, 60% from top

const MW_CONFIG = {
  // Centre of the galactic core on screen (relative 0–1)
  coreCX: 0.35,
  coreCY: 0.62,
  // Direction of the band: angle in radians (roughly NE–SW diagonal)
  bandAngle: -0.52,   // ~-30 degrees
  // Half-width of the diffuse band (relative to min screen dimension)
  bandWidthR: 0.11,
  // Core bulge radius
  coreR: 0.09,
  // Total band length (relative to screen width)
  bandLength: 1.85,
};

function buildMilkyWayStarCloud(count = 8500) {
  const stars = [];
  const { coreCX, coreCY, bandAngle, bandWidthR, coreR } = MW_CONFIG;
  const cos = Math.cos(bandAngle), sin = Math.sin(bandAngle);

  for (let i = 0; i < count; i++) {
    // Sample along the band with higher density near core
    const t = (Math.random() * 2 - 1);          // -1 to +1 along band axis
    const density = Math.exp(-Math.abs(t) * 1.1) * 0.7 + Math.random() * 0.3;

    // Perpendicular scatter — gaussian-ish, wider near ends
    const widthMult = 1 + Math.abs(t) * 0.5;
    const scatterAmt = bandWidthR * widthMult;
    const scatter = (Math.random() - 0.5) * 2;
    const perpScatter = scatter * Math.abs(scatter) * scatterAmt; // non-linear for realism

    // Convert to screen space
    const xr = coreCX + cos * t * 0.9 - sin * perpScatter;
    const yr = coreCY + sin * t * 0.9 + cos * perpScatter;

    if (xr < -0.05 || xr > 1.05 || yr < -0.05 || yr > 1.05) continue;

    // Core proximity boost
    const dx = xr - coreCX, dy = yr - coreCY;
    const coreDist = Math.sqrt(dx*dx + dy*dy);
    const coreBoost = Math.exp(-coreDist / coreR * 2);

    // Star size distribution
    const sz = Math.random();
    const r = sz < 0.75 ? 0.12 + Math.random() * 0.22   // tiny background stars
             : sz < 0.93 ? 0.22 + Math.random() * 0.35   // medium
                         : 0.38 + Math.random() * 0.55;  // occasional brighter

    // Brightness — follows density + core boost
    const baseA = (0.03 + Math.random() * 0.12) * (density * 0.7 + 0.3) * (1 + coreBoost * 2.5);

    // Colour: near core more yellow/orange (older stars), arms more blue-white
    const coreColor = lerpC([255, 210, 140], [255, 230, 180], Math.random()); // warm core
    const armColor  = lerpC([200, 215, 255], [235, 240, 255], Math.random()); // cool arm
    const col = lerpC(armColor, coreColor, clamp(coreBoost * 3, 0, 1));

    // Twinkle params
    const ts = 0.08 + Math.random() * 0.6;
    const to = Math.random() * Math.PI * 2;

    stars.push({ xr, yr, r, baseA: clamp(baseA, 0, 0.55), ts, to, col, density });
  }
  return stars;
}

function buildMilkyWayDustLanes(count = 45) {
  const { coreCX, coreCY, bandAngle } = MW_CONFIG;
  const cos = Math.cos(bandAngle), sin = Math.sin(bandAngle);
  const lanes = [];
  for (let i = 0; i < count; i++) {
    const t = (Math.random() * 2 - 1) * 0.85;
    const perp = (Math.random() - 0.5) * 0.08;
    const xr = coreCX + cos * t - sin * perp;
    const yr = coreCY + sin * t + cos * perp;
    lanes.push({
      xr, yr,
      rr: 0.02 + Math.random() * 0.06,  // radius relative to min dim
      ax: 0.5 + Math.random() * 1.5,
      ay: 0.3 + Math.random() * 0.7,
      rot: bandAngle + (Math.random() - 0.5) * 0.4,
      opacity: 0.018 + Math.random() * 0.035,
    });
  }
  return lanes;
}

// Pre-built MW glow gradient stops (drawn each frame as layered radial gradients)
function buildMilkyWayGlowLayers() {
  const { coreCX, coreCY, bandAngle, bandWidthR, coreR, bandLength } = MW_CONFIG;
  const cos = Math.cos(bandAngle), sin = Math.sin(bandAngle);

  // Sample a series of "blobs" along the band to simulate the diffuse glow
  const blobs = [];
  const blobCount = 28;
  for (let i = 0; i < blobCount; i++) {
    const t = (i / (blobCount - 1)) * 2 - 1;         // -1..+1
    const xr = coreCX + cos * t * (bandLength * 0.5);
    const yr = coreCY + sin * t * (bandLength * 0.5);
    const dist = Math.abs(t);

    // Intensity peaks at core
    const intensity = Math.exp(-dist * 1.6) * 0.8 + 0.2;

    // Width varies — wider/rounder near core (bulge), narrower in arms
    const widthMult = dist < 0.2 ? 1.6 : 1.0 + Math.random() * 0.3;
    const perpR = bandWidthR * widthMult * (0.7 + Math.random() * 0.5);
    const alongR = bandWidthR * (0.9 + Math.random() * 0.4);

    // Colour: warm yellow-white core, cooler blue-white arms
    const warmth = Math.exp(-dist * 2.5);
    const r = lerp(205, 255, warmth);
    const g = lerp(195, 235, warmth);
    const b = lerp(190, 215, warmth * 0.3 + 0.7);

    blobs.push({ xr, yr, rAlongR: alongR, rPerpR: perpR, intensity, col: [r, g, b], t });
  }

  // Extra bright core blob
  blobs.push({
    xr: coreCX, yr: coreCY,
    rAlongR: coreR * 1.8, rPerpR: coreR * 1.2,
    intensity: 1.0, col: [255, 225, 160], t: 0, isCore: true,
  });

  return blobs;
}

function drawMilkyWay(ctx, W, H, t, mwStars, mwDust, mwGlowBlobs) {
  const minDim = Math.min(W, H);
  const { bandAngle, coreCX, coreCY, coreR } = MW_CONFIG;

  // ── Pass 0: Very faint large-scale diffuse background (integrated starlight) ──
  // This simulates the overall luminance of the galactic plane visible to dark-
  // adapted eyes — a faint arch of light even away from the bright core.
  {
    const bgBlobPositions = [
      { t: -0.9, perp: 0 }, { t: -0.6, perp: 0.01 }, { t: -0.3, perp: -0.01 },
      { t:  0.0, perp: 0  }, { t:  0.3, perp:  0.01 }, { t:  0.6, perp: -0.01 },
      { t:  0.9, perp: 0  },
    ];
    const cos = Math.cos(bandAngle), sin = Math.sin(bandAngle);
    for (const bp of bgBlobPositions) {
      const cx = (coreCX + cos * bp.t * 0.95 - sin * bp.perp) * W;
      const cy = (coreCY + sin * bp.t * 0.95 + cos * bp.perp) * H;
      const r  = minDim * (0.22 + Math.abs(bp.t) * 0.05);
      const a  = 0.006 * Math.exp(-Math.abs(bp.t) * 0.8);
      const g  = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, rgba(210, 210, 220, a));
      g.addColorStop(1, rgba(210, 210, 220, 0));
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = g; ctx.fill();
    }
  }

  // ── Pass 1: Diffuse glow blobs ──────────────────────────────────────────
  ctx.save();
  for (const blob of mwGlowBlobs) {
    const cx = blob.xr * W;
    const cy = blob.yr * H;
    const rx = blob.rAlongR * minDim;
    const ry = blob.rPerpR * minDim;

    // Rotate ellipse to align with band
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(bandAngle);
    ctx.scale(rx / Math.max(rx, ry), ry / Math.max(rx, ry));

    const r2 = Math.max(rx, ry);

    // Two passes: a wide soft bloom + tighter concentrated glow
    const alphaOuter = blob.isCore ? 0.028 : blob.intensity * 0.012;
    const alphaInner = blob.isCore ? 0.055 : blob.intensity * 0.025;

    // Outer bloom
    const grd1 = ctx.createRadialGradient(0, 0, 0, 0, 0, r2 * 1.5);
    grd1.addColorStop(0,   rgba(blob.col[0], blob.col[1], blob.col[2], alphaOuter));
    grd1.addColorStop(0.5, rgba(blob.col[0], blob.col[1], blob.col[2], alphaOuter * 0.4));
    grd1.addColorStop(1,   rgba(blob.col[0], blob.col[1], blob.col[2], 0));
    ctx.beginPath(); ctx.arc(0, 0, r2 * 1.5, 0, Math.PI * 2);
    ctx.fillStyle = grd1; ctx.fill();

    // Inner concentrated glow
    const grd2 = ctx.createRadialGradient(0, 0, 0, 0, 0, r2 * 0.7);
    grd2.addColorStop(0,   rgba(blob.col[0], blob.col[1], blob.col[2], alphaInner));
    grd2.addColorStop(0.6, rgba(blob.col[0], blob.col[1], blob.col[2], alphaInner * 0.3));
    grd2.addColorStop(1,   rgba(blob.col[0], blob.col[1], blob.col[2], 0));
    ctx.beginPath(); ctx.arc(0, 0, r2 * 0.7, 0, Math.PI * 2);
    ctx.fillStyle = grd2; ctx.fill();

    ctx.restore();
  }

  // Galactic core — the bright heart of the Milky Way (like Sagittarius A*)
  // This is the most prominent feature — a warm yellowish-white concentrated bulge
  {
    const ccx = coreCX * W, ccy = coreCY * H;
    const cr1 = coreR * minDim * 0.6;  // tight nucleus
    const cr2 = coreR * minDim * 2.2;  // extended bulge
    const cr3 = coreR * minDim * 4.5;  // diffuse outer halo

    const gc1 = ctx.createRadialGradient(ccx, ccy, 0, ccx, ccy, cr1);
    gc1.addColorStop(0,   rgba(255, 228, 175, 0.065));
    gc1.addColorStop(0.4, rgba(255, 218, 155, 0.040));
    gc1.addColorStop(1,   rgba(240, 205, 140, 0));
    ctx.beginPath(); ctx.arc(ccx, ccy, cr1, 0, Math.PI * 2);
    ctx.fillStyle = gc1; ctx.fill();

    const gc2 = ctx.createRadialGradient(ccx, ccy, 0, ccx, ccy, cr2);
    gc2.addColorStop(0,   rgba(245, 220, 170, 0.040));
    gc2.addColorStop(0.5, rgba(235, 210, 155, 0.018));
    gc2.addColorStop(1,   rgba(220, 198, 140, 0));
    ctx.beginPath(); ctx.arc(ccx, ccy, cr2, 0, Math.PI * 2);
    ctx.fillStyle = gc2; ctx.fill();

    const gc3 = ctx.createRadialGradient(ccx, ccy, 0, ccx, ccy, cr3);
    gc3.addColorStop(0,   rgba(230, 215, 160, 0.018));
    gc3.addColorStop(0.6, rgba(220, 205, 150, 0.006));
    gc3.addColorStop(1,   rgba(210, 195, 140, 0));
    ctx.beginPath(); ctx.arc(ccx, ccy, cr3, 0, Math.PI * 2);
    ctx.fillStyle = gc3; ctx.fill();
  }
  ctx.restore();

  // ── Pass 2: Dust lanes (dark absorption nebulae) ─────────────────────────
  ctx.save();
  ctx.globalCompositeOperation = 'multiply'; // darken mode for dust
  for (const dust of mwDust) {
    const cx = dust.xr * W, cy = dust.yr * H;
    const r = dust.rr * minDim;
    const rx = r * dust.ax, ry = r * dust.ay;
    const rmax = Math.max(rx, ry);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(dust.rot);
    ctx.scale(rx / rmax, ry / rmax);

    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rmax);
    g.addColorStop(0,   rgba(0, 0, 0, dust.opacity));
    g.addColorStop(0.5, rgba(0, 0, 0, dust.opacity * 0.5));
    g.addColorStop(1,   rgba(0, 0, 0, 0));

    ctx.beginPath(); ctx.arc(0, 0, rmax, 0, Math.PI * 2);
    ctx.fillStyle = g; ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  // ── Pass 3: Resolved micro-stars ─────────────────────────────────────────
  for (const s of mwStars) {
    const sx = s.xr * W, sy = s.yr * H;
    // Gentle twinkle — much slower than foreground stars
    const twink = 0.65 + 0.35 * Math.sin(t * s.ts * 0.4 + s.to);
    const a = s.baseA * twink;
    if (a < 0.008) continue;

    ctx.beginPath();
    ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
    ctx.fillStyle = rgba(s.col[0], s.col[1], s.col[2], a);
    ctx.fill();

    // Brightest MW stars get a tiny bloom
    if (s.baseA > 0.30 && s.r > 0.3) {
      const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, s.r * 4);
      g.addColorStop(0, rgba(s.col[0], s.col[1], s.col[2], a * 0.35));
      g.addColorStop(1, rgba(s.col[0], s.col[1], s.col[2], 0));
      ctx.beginPath(); ctx.arc(sx, sy, s.r * 4, 0, Math.PI * 2);
      ctx.fillStyle = g; ctx.fill();
    }
  }
}

// ─── STARS (foreground 3-layer system) ───────────────────────────────────────
function makeStarLayer(count, layer) {
  return Array.from({ length: count }, () => {
    const sz = Math.random();
    const bright = layer === 0 && sz > 0.88;
    const col = randomSpectralColor();

    // Slightly tint brighter stars
    return {
      xr: Math.random(), yr: Math.random(),
      r: bright ? 1.4 + Math.random() * 1.1
         : sz < 0.7 ? 0.13 + Math.random() * 0.32
                    : 0.30 + Math.random() * 0.48,
      baseA: layer === 0 ? 0.55 + Math.random() * 0.45
           : layer === 1 ? 0.22 + Math.random() * 0.30
                         : 0.07 + Math.random() * 0.17,
      col,
      ts:   0.12 + Math.random() * 1.0,
      to:   Math.random() * Math.PI * 2,
      bright,
      ox: 0, oy: 0,
      // Wink-out (stellar occultation)
      winking:  false,
      winkTimer: 0,
      winkDur:  0,
      winkNext: 80 + Math.random() * 500,
    };
  });
}

// ─── NEBULAE (background gas clouds) ─────────────────────────────────────────
function makeNebulae() {
  const pals = [
    [[18, 6, 52], [52, 4, 38]],
    [[4, 12, 50], [10, 36, 72]],
    [[4, 32, 22], [12, 52, 40]],
    [[42, 10, 4], [65, 24, 8]],
    [[32, 4, 32], [16, 4, 48]],
    [[8,  22, 48], [22, 48, 68]],
  ];
  return Array.from({ length: 7 }, () => {
    const p = pals[Math.floor(Math.random() * pals.length)];
    return {
      xr: 0.04 + Math.random() * 0.92,
      yr: 0.04 + Math.random() * 0.88,
      rr: 0.06 + Math.random() * 0.18,
      a:  0.018 + Math.random() * 0.042,
      col: lerpC(p[0], p[1], Math.random()),
      ax: 0.5 + Math.random() * 0.9,
      ay: 0.5 + Math.random() * 0.9,
      // Imperceptibly slow drift
      dxr: (Math.random() - 0.5) * 0.000025,
      dyr: (Math.random() - 0.5) * 0.000018,
    };
  });
}

function drawNebulae(ctx, nbs, W, H) {
  for (const n of nbs) {
    n.xr = clamp(n.xr + n.dxr, 0.02, 0.98);
    n.yr = clamp(n.yr + n.dyr, 0.02, 0.98);
    const cx = n.xr * W, cy = n.yr * H;
    const rx = n.rr * W * n.ax, ry = n.rr * H * n.ay;
    const r = Math.max(rx, ry);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(rx / r, ry / r);

    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    g.addColorStop(0,   rgba(n.col[0], n.col[1], n.col[2], n.a));
    g.addColorStop(0.5, rgba(n.col[0], n.col[1], n.col[2], n.a * 0.4));
    g.addColorStop(1,   rgba(n.col[0], n.col[1], n.col[2], 0));

    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
  }
}

// ─── VIGNETTE ─────────────────────────────────────────────────────────────────
function drawVignette(ctx, W, H) {
  const g = ctx.createRadialGradient(
    W * 0.5, H * 0.5, Math.min(W, H) * 0.28,
    W * 0.5, H * 0.5, Math.max(W, H) * 0.82
  );
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.75)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

// ─── METEOR SYSTEM ────────────────────────────────────────────────────────────
//
// Meteors are rendered as smooth continuous luminous trails using:
//   - ctx.strokeStyle with a line gradient for the main trail
//   - Overlapping glow passes for the ablation plasma
//   - A bright nucleus head with a coma/corona
//   - Forward-swept diffraction spikes on large meteors
//   - Ablation sparkles as separate particles

const METEOR_TRAIL_POINTS = 120; // history depth for line rendering

// Spectral parameters for the meteor's ablation plasma
const METEOR_SPECTRAL = [
  {
    // Typical chondrite: magnesium, sodium, iron → white-orange
    head:   [255, 255, 255],
    coma:   [255, 240, 200],
    plasma: [255, 220, 150],
    trail:  [180, 200, 255],
    corona: [230, 235, 255],
  },
  {
    // Iron-rich: stronger yellow-white
    head:   [255, 255, 240],
    coma:   [255, 248, 190],
    plasma: [255, 230, 130],
    trail:  [200, 210, 255],
    corona: [240, 238, 255],
  },
  {
    // Magnesium-rich: slightly more blue-white
    head:   [255, 255, 255],
    coma:   [230, 238, 255],
    plasma: [210, 225, 255],
    trail:  [160, 185, 255],
    corona: [220, 228, 255],
  },
];

function makeMeteor(W, H, opts = {}) {
  const sp = METEOR_SPECTRAL[Math.floor(Math.random() * METEOR_SPECTRAL.length)];
  const goRight = opts.goRight ?? (Math.random() > 0.5);
  const speed   = opts.speed  ?? (6 + Math.random() * 16);
  const ang     = opts.ang    ?? ((12 + Math.random() * 48) * Math.PI / 180);

  const vx = (goRight ? 1 : -1) * Math.cos(ang) * speed;
  const vy = Math.sin(ang) * speed;

  const x = opts.x ?? (goRight ? -30 : W + 30);
  const y = opts.y ?? H * (0.02 + Math.random() * 0.44);
  const headR = opts.headR ?? (1.0 + Math.random() * 2.8);
  const mass  = headR * headR;  // proxy for mass

  // Flare events (sudden brightness surges from fresh ablation)
  const flares = Math.random() < 0.6
    ? Array.from({ length: Math.random() < 0.35 ? 2 : 1 }, () => ({
        t:   0.10 + Math.random() * 0.55,
        mag: 1.8 + Math.random() * 3.5,
        dur: 0.05 + Math.random() * 0.10,
        fired: false, active: false, prog: 0,
      }))
    : [];

  // Fragmentation
  const canFragment = (opts.isFragment !== true) && Math.random() < 0.20;
  const fragmentAt  = 0.30 + Math.random() * 0.40;

  // Ion trail — persists slightly after meteor passes (greenish glow)
  const hasIonTrail = Math.random() < 0.35 && !opts.isFragment;

  return {
    x, y,
    vx: opts.vx ?? vx,
    vy: opts.vy ?? vy,
    headR, sp, mass,
    tailMaxLen: 180 + Math.random() * 280,
    life: 1,
    decay: opts.decay ?? (0.004 + Math.random() * 0.009),
    drag: 0.9983 + Math.random() * 0.0012,
    bright: 1, flares,
    sparkles: [], nextSpark: 0,
    history: [],          // [{x,y,speed}]
    target:     opts.target     ?? null,
    isEgg:      opts.isEgg      ?? false,
    isFragment: opts.isFragment ?? false,
    canFragment,
    fragmentAt,
    fragmented: false,
    hasIonTrail,
    ionTrail: hasIonTrail ? [] : null,
    // Entry flash (atmospheric ignition)
    entryFlash: 1.0,
    entryDecay: 0.06 + Math.random() * 0.06,
    terminalFired: false,
    // Speed for trail width modulation
    curSpeed: speed,
  };
}

function stepMeteor(m, meteors, W, H) {
  m.vx *= m.drag;
  m.vy *= m.drag;
  m.x  += m.vx;
  m.y  += m.vy;
  m.curSpeed = Math.hypot(m.vx, m.vy);

  m.history.unshift({ x: m.x, y: m.y, spd: m.curSpeed });
  if (m.history.length > METEOR_TRAIL_POINTS) m.history.pop();

  if (m.entryFlash > 0) {
    m.entryFlash = Math.max(0, m.entryFlash - m.entryDecay);
  }

  m.life -= m.decay;
  const lf = 1 - m.life;

  // Flare events
  m.bright = 1;
  for (const f of m.flares) {
    if (!f.fired && lf >= f.t) { f.fired = true; f.active = true; f.prog = 0; }
    if (f.active) {
      f.prog += m.decay / f.dur;
      const e = f.prog < 0.4 ? f.prog / 0.4 : 1 - (f.prog - 0.4) / 0.6;
      m.bright = Math.max(m.bright, 1 + (f.mag - 1) * Math.max(0, e));
      if (f.prog >= 1) f.active = false;
    }
  }

  // Fragmentation
  if (m.canFragment && !m.fragmented && lf >= m.fragmentAt) {
    m.fragmented = true;
    const pieces = 2 + Math.floor(Math.random() * 2);
    const spd = m.curSpeed;
    for (let i = 0; i < pieces; i++) {
      const spreadAng = (Math.random() - 0.5) * 0.50;
      const curAng    = Math.atan2(m.vy, m.vx);
      const fragSpd   = spd * (0.50 + Math.random() * 0.40);
      const frag = makeMeteor(W, H, {
        x: m.x, y: m.y,
        vx: Math.cos(curAng + spreadAng) * fragSpd,
        vy: Math.sin(curAng + spreadAng) * fragSpd,
        headR: m.headR * (0.30 + Math.random() * 0.32),
        decay: m.decay * (1.4 + Math.random() * 0.7),
        isFragment: true,
      });
      frag.life = m.life * (0.50 + Math.random() * 0.35);
      frag.entryFlash = 0.55;
      meteors.push(frag);
    }
    m.decay *= 1.9;
  }

  // Ion trail (slow-fading glowing wake)
  if (m.hasIonTrail && m.ionTrail) {
    m.ionTrail.unshift({ x: m.x, y: m.y, life: 1.0 });
    if (m.ionTrail.length > 80) m.ionTrail.pop();
    for (let i = m.ionTrail.length - 1; i >= 0; i--) {
      m.ionTrail[i].life -= 0.009;
      if (m.ionTrail[i].life <= 0) m.ionTrail.splice(i, 1);
    }
  }

  // Ablation sparkles
  if (--m.nextSpark <= 0) {
    m.nextSpark = 1 + Math.floor(Math.random() * 3);
    const spd = m.curSpeed;
    const spread = spd * 0.5;
    m.sparkles.push({
      x:     m.x + (Math.random() - 0.5) * spread,
      y:     m.y + (Math.random() - 0.5) * spread,
      vx:    (Math.random() - 0.5) * 0.8,
      vy:    (Math.random() - 0.5) * 0.8 + 0.15, // slight downward
      life:  0.6 + Math.random() * 0.5,
      decay: 0.015 + Math.random() * 0.025,
      r:     0.3 + Math.random() * 0.9,
      col:   lerpC(m.sp.coma, m.sp.trail, Math.random()),
    });
  }
  for (let i = m.sparkles.length - 1; i >= 0; i--) {
    const s = m.sparkles[i];
    s.x += s.vx; s.y += s.vy;
    s.life -= s.decay;
    if (s.life <= 0) m.sparkles.splice(i, 1);
  }
}

// Draw the meteor using smooth line rendering instead of dot chains
function drawMeteor(ctx, m) {
  if (m.history.length < 2) return;

  const lf    = clamp(m.life, 0, 1);
  const eb    = clamp(m.bright * lf, 0, 1);
  const headX = m.history[0].x;
  const headY = m.history[0].y;

  // ── Ion trail (drawn first, behind everything) ──────────────────────────
  if (m.hasIonTrail && m.ionTrail && m.ionTrail.length > 2) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 1; i < m.ionTrail.length; i++) {
      const a  = m.ionTrail[i].life * 0.055;
      if (a < 0.003) continue;
      const t  = (i / m.ionTrail.length);
      const w  = (1 - t) * 2.5;
      ctx.beginPath();
      ctx.moveTo(m.ionTrail[i-1].x, m.ionTrail[i-1].y);
      ctx.lineTo(m.ionTrail[i].x,   m.ionTrail[i].y);
      ctx.strokeStyle = rgba(140, 230, 180, a);  // greenish ion glow
      ctx.lineWidth   = w;
      ctx.stroke();
    }
    ctx.restore();
  }

  // ── Build visible trail segment ──────────────────────────────────────────
  let distAcc = 0;
  const trailPts = [m.history[0]];
  for (let i = 1; i < m.history.length; i++) {
    const dx = m.history[i].x - m.history[i-1].x;
    const dy = m.history[i].y - m.history[i-1].y;
    distAcc += Math.hypot(dx, dy);
    if (distAcc > m.tailMaxLen) break;
    trailPts.push(m.history[i]);
  }
  const N = trailPts.length;
  if (N < 2) return;

  // ── Outer diffuse glow pass ─────────────────────────────────────────────
  // Wide, very soft halo around the whole trail
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 1; i < N; i++) {
    const t  = i / (N - 1);
    const te = Math.pow(t, 0.55);
    const a  = eb * (1 - te) * 0.12;
    if (a < 0.004) continue;
    const w = m.headR * (1 - te * 0.85) * 9;
    const col = lerpC(m.sp.coma, m.sp.trail, te);
    ctx.beginPath();
    ctx.moveTo(trailPts[i-1].x, trailPts[i-1].y);
    ctx.lineTo(trailPts[i].x,   trailPts[i].y);
    ctx.strokeStyle = rgba(col[0], col[1], col[2], a);
    ctx.lineWidth   = w;
    ctx.lineCap     = 'round';
    ctx.stroke();
  }
  ctx.restore();

  // ── Mid glow pass ────────────────────────────────────────────────────────
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (let i = 1; i < N; i++) {
    const t  = i / (N - 1);
    const te = Math.pow(t, 0.65);
    const a  = eb * (1 - te) * 0.28;
    if (a < 0.005) continue;
    const w = m.headR * (1 - te * 0.88) * 4.5;
    const col = lerpC(m.sp.plasma, m.sp.trail, te);
    ctx.beginPath();
    ctx.moveTo(trailPts[i-1].x, trailPts[i-1].y);
    ctx.lineTo(trailPts[i].x,   trailPts[i].y);
    ctx.strokeStyle = rgba(col[0], col[1], col[2], a);
    ctx.lineWidth   = Math.max(w, 0.3);
    ctx.lineCap     = 'round';
    ctx.stroke();
  }
  ctx.restore();

  // ── Core trail line ──────────────────────────────────────────────────────
  // This is the sharp bright inner channel — the actual ablation column
  ctx.save();
  for (let i = 1; i < N; i++) {
    const t  = i / (N - 1);
    const te = Math.pow(t, 0.72);
    const a  = eb * Math.pow(1 - te, 1.3) * 0.9;
    if (a < 0.006) continue;

    // Width tapers from head to tail
    const w = Math.max(m.headR * (1 - te * 0.94), 0.25);

    // Colour shifts from head colour → mid → tail along the trail
    const col = t < 0.5
      ? lerpC(m.sp.head, m.sp.plasma, t * 2)
      : lerpC(m.sp.plasma, m.sp.trail, (t - 0.5) * 2);

    ctx.beginPath();
    ctx.moveTo(trailPts[i-1].x, trailPts[i-1].y);
    ctx.lineTo(trailPts[i].x,   trailPts[i].y);
    ctx.strokeStyle = rgba(col[0], col[1], col[2], a);
    ctx.lineWidth   = w;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.stroke();
  }
  ctx.restore();

  // ── Entry flash (atmospheric ignition bloom) ─────────────────────────────
  if (m.entryFlash > 0) {
    const ef = m.entryFlash;
    const er = m.headR * (4 + ef * 9);
    const g  = ctx.createRadialGradient(headX, headY, 0, headX, headY, er);
    g.addColorStop(0,   rgba(255, 255, 255, ef * 0.85));
    g.addColorStop(0.3, rgba(255, 255, 255, ef * 0.45));
    g.addColorStop(1,   rgba(255, 255, 255, 0));
    ctx.beginPath();
    ctx.arc(headX, headY, er, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
  }

  // ── Nucleus — the ablating meteoroid ────────────────────────────────────
  const fr = m.headR * clamp(m.bright, 1, 4.5);
  const hcol = m.sp.head;

  // Tight bright core
  {
    const g = ctx.createRadialGradient(headX, headY, 0, headX, headY, fr);
    g.addColorStop(0,   rgba(255, 255, 255, eb));
    g.addColorStop(0.3, rgba(255, 255, 255, eb * 0.92));
    g.addColorStop(1,   rgba(hcol[0], hcol[1], hcol[2], 0));
    ctx.beginPath();
    ctx.arc(headX, headY, fr, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
  }

  // Coma / inner halo
  {
    const hr = fr * 5.5;
    const g  = ctx.createRadialGradient(headX, headY, 0, headX, headY, hr);
    const cc = m.sp.coma;
    g.addColorStop(0,   rgba(cc[0], cc[1], cc[2], eb * 0.72));
    g.addColorStop(0.4, rgba(cc[0], cc[1], cc[2], eb * 0.28));
    g.addColorStop(1,   rgba(cc[0], cc[1], cc[2], 0));
    ctx.beginPath();
    ctx.arc(headX, headY, hr, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
  }

  // Outer corona (larger meteors / flaring)
  const coronaStr = clamp((m.bright - 1) * 0.7 + (m.headR - 1.2) * 0.3, 0, 1);
  if (coronaStr > 0.03) {
    const cr = fr * 14;
    const g  = ctx.createRadialGradient(headX, headY, 0, headX, headY, cr);
    const cc = m.sp.corona;
    g.addColorStop(0, rgba(cc[0], cc[1], cc[2], coronaStr * eb * 0.42));
    g.addColorStop(1, rgba(cc[0], cc[1], cc[2], 0));
    ctx.beginPath();
    ctx.arc(headX, headY, cr, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
  }

  // Forward diffraction spike (direction of travel)
  if (m.headR > 2.0 && eb > 0.4) {
    const ang   = Math.atan2(m.vy, m.vx);
    const spikeLen = fr * 12 * eb;
    ctx.save();
    ctx.translate(headX, headY);
    ctx.rotate(ang);
    const sg = ctx.createLinearGradient(0, 0, spikeLen, 0);
    sg.addColorStop(0,   rgba(255, 255, 255, eb * 0.8));
    sg.addColorStop(0.6, rgba(255, 255, 255, eb * 0.2));
    sg.addColorStop(1,   rgba(255, 255, 255, 0));
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(spikeLen, 0);
    ctx.strokeStyle = sg;
    ctx.lineWidth   = fr * 0.6;
    ctx.lineCap     = 'round';
    ctx.stroke();
    ctx.restore();
  }

  // ── Ablation sparkles ────────────────────────────────────────────────────
  for (const s of m.sparkles) {
    if (s.life <= 0) continue;
    const sa = clamp(s.life * 0.9, 0, 1);

    // Glow
    const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 5);
    g.addColorStop(0, rgba(s.col[0], s.col[1], s.col[2], sa * 0.45));
    g.addColorStop(1, rgba(s.col[0], s.col[1], s.col[2], 0));
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r * 5, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();

    // Core dot
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fillStyle = rgba(s.col[0], s.col[1], s.col[2], sa);
    ctx.fill();
  }
}

// ─── SUPERNOVA (multi-phase physically-based) ────────────────────────────────
function makeExplosion(x, y) {
  const debris = Array.from({ length: 140 }, () => {
    const ang  = Math.random() * Math.PI * 2;
    const spd  = 0.6 + Math.pow(Math.random(), 1.6) * 16;
    const mass = Math.random();
    const col  = lerpC([255, 255, 255], [200, 215, 255], mass);
    return {
      x, y,
      vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
      life: 0.65 + Math.random() * 1.2,
      decay: 0.004 + Math.random() * 0.008,
      r:   0.4 + Math.pow(1 - mass, 2) * 3.8,
      col, mass,
      grav: 0.007 + Math.random() * 0.022,
      drag: 0.974 + Math.random() * 0.018,
      streak: spd > 5.5,
    };
  });

  const rings = [
    { r: 2, maxR: 340 + Math.random() * 110, life: 1, decay: 0.008,  col: [255, 255, 255], lw: 2.8 },
    { r: 2, maxR: 190 + Math.random() * 70,  life: 1, decay: 0.013,  col: [215, 228, 255], lw: 1.6 },
    { r: 2, maxR: 540 + Math.random() * 100, life: 0.6, decay: 0.005,col: [255, 255, 255], lw: 0.9 },
    { r: 2, maxR: 95  + Math.random() * 45,  life: 1, decay: 0.020,  col: [255, 255, 255], lw: 3.6 },
  ];

  const remnant = Array.from({ length: 40 }, () => {
    const ang = Math.random() * Math.PI * 2;
    const spd = 0.12 + Math.random() * 0.9;
    return {
      x, y,
      vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
      life: 0, maxLife: 0.55 + Math.random() * 0.45,
      startDelay: 0.25 + Math.random() * 0.55,
      decay: 0.0016 + Math.random() * 0.0024,
      r:   9 + Math.random() * 30,
      col: lerpC([195, 212, 255], [155, 178, 230], Math.random()),
    };
  });

  return {
    x, y, debris, rings, remnant,
    phase: 0, phaseTime: 0,
    nova: 2.4, novaPeak: 2.4,
    col: [215, 228, 255],
    active: true,
    fireball: { r: 0, maxR: 90 + Math.random() * 45, life: 1, decay: 0.016 },
  };
}

function stepExplosion(e) {
  e.phaseTime += 0.013;
  if (e.nova > 0) e.nova -= 0.009;

  const fb = e.fireball;
  if (fb.life > 0) {
    fb.r    += (fb.maxR - fb.r) * 0.08;
    fb.life -= fb.decay;
  }

  for (const r of e.rings) {
    if (r.life <= 0) continue;
    r.r    += r.maxR / 65;
    r.life -= r.decay;
  }

  for (let i = e.debris.length - 1; i >= 0; i--) {
    const d = e.debris[i];
    d.vx *= d.drag; d.vy *= d.drag;
    d.vy += d.grav;
    d.x  += d.vx;  d.y  += d.vy;
    d.life -= d.decay;
    if (d.life <= 0) e.debris.splice(i, 1);
  }

  for (const n of e.remnant) {
    if (e.phaseTime < n.startDelay) continue;
    n.x += n.vx; n.y += n.vy;
    if (n.life < n.maxLife) n.life = Math.min(n.maxLife, n.life + 0.022);
    else                    n.life = Math.max(0, n.life - n.decay);
  }

  e.active = e.nova > -0.5
    || e.debris.length > 0
    || e.rings.some(r => r.life > 0)
    || fb.life > 0
    || e.remnant.some(n => n.life > 0);
}

function drawExplosion(ctx, e) {
  const { x, y } = e;

  // Nova flash
  if (e.nova > 0) {
    const na  = clamp(e.nova / e.novaPeak, 0, 1);
    const age = e.novaPeak - e.nova;
    for (const [sz, al, col] of [
      [9  + age * 20,    na * 1.0,   [255, 255, 255]],
      [28 + age * 60,    na * 0.85,  [255, 255, 255]],
      [85 + age * 120,   na * 0.54,  e.col],
      [220 + age * 160,  na * 0.27,  e.col],
      [400 + age * 110,  na * 0.12,  e.col],
      [650 + age * 65,   na * 0.05,  e.col],
    ]) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, sz);
      g.addColorStop(0,   rgba(col[0], col[1], col[2], al));
      g.addColorStop(0.3, rgba(col[0], col[1], col[2], al * 0.58));
      g.addColorStop(1,   rgba(col[0], col[1], col[2], 0));
      ctx.beginPath(); ctx.arc(x, y, sz, 0, Math.PI * 2);
      ctx.fillStyle = g; ctx.fill();
    }
  }

  // Fireball
  const fb = e.fireball;
  if (fb.life > 0 && fb.r > 1) {
    const fa = clamp(fb.life, 0, 1);
    const g1 = ctx.createRadialGradient(x, y, 0, x, y, fb.r);
    g1.addColorStop(0,   rgba(255, 255, 255, fa * 0.9));
    g1.addColorStop(0.2, rgba(255, 255, 255, fa * 0.7));
    g1.addColorStop(0.6, rgba(e.col[0], e.col[1], e.col[2], fa * 0.5));
    g1.addColorStop(1,   rgba(e.col[0], e.col[1], e.col[2], 0));
    ctx.beginPath(); ctx.arc(x, y, fb.r, 0, Math.PI * 2);
    ctx.fillStyle = g1; ctx.fill();

    const g2 = ctx.createRadialGradient(x, y, fb.r * 0.4, x, y, fb.r * 2.9);
    g2.addColorStop(0, rgba(e.col[0], e.col[1], e.col[2], fa * 0.18));
    g2.addColorStop(1, rgba(e.col[0], e.col[1], e.col[2], 0));
    ctx.beginPath(); ctx.arc(x, y, fb.r * 2.9, 0, Math.PI * 2);
    ctx.fillStyle = g2; ctx.fill();
  }

  // Remnant nebula
  for (const n of e.remnant) {
    if (n.life <= 0) continue;
    const na = clamp(n.life * 0.58, 0, 0.20);
    if (na < 0.004) continue;
    const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
    g.addColorStop(0, rgba(n.col[0], n.col[1], n.col[2], na));
    g.addColorStop(1, rgba(n.col[0], n.col[1], n.col[2], 0));
    ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
    ctx.fillStyle = g; ctx.fill();
  }

  // Shock rings
  ctx.save();
  for (const r of e.rings) {
    if (r.life <= 0 || r.r < 1) continue;
    const ra = clamp(r.life, 0, 1);
    ctx.beginPath(); ctx.arc(x, y, r.r, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(r.col[0], r.col[1], r.col[2], ra * 0.20);
    ctx.lineWidth   = r.lw * ra * 9;
    ctx.stroke();

    ctx.beginPath(); ctx.arc(x, y, r.r, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(r.col[0], r.col[1], r.col[2], ra * 0.95);
    ctx.lineWidth   = r.lw * ra;
    ctx.stroke();
  }
  ctx.restore();

  // Debris particles
  for (const d of e.debris) {
    if (d.life <= 0) continue;
    const da  = clamp(d.life * 0.9, 0, 1);
    const spd = Math.hypot(d.vx, d.vy);

    if (d.streak && spd > 1.5) {
      ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - d.vx * 5.5, d.y - d.vy * 5.5);
      ctx.strokeStyle = rgba(d.col[0], d.col[1], d.col[2], da * 0.82);
      ctx.lineWidth   = d.r * 0.75;
      ctx.lineCap     = 'round';
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    ctx.fillStyle = rgba(d.col[0], d.col[1], d.col[2], da);
    ctx.fill();

    const g = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r * 5);
    g.addColorStop(0, rgba(d.col[0], d.col[1], d.col[2], da * 0.48));
    g.addColorStop(1, rgba(d.col[0], d.col[1], d.col[2], 0));
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r * 5, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
  }
}

// ─── SATELLITE ────────────────────────────────────────────────────────────────
function makeSatellite(W, H) {
  const fromLeft = Math.random() > 0.5;
  const y = H * (0.07 + Math.random() * 0.6);
  const spd = 0.32 + Math.random() * 0.58;
  return {
    x: fromLeft ? -8 : W + 8, y,
    vx: fromLeft ? spd : -spd,
    vy: (Math.random() - 0.5) * 0.11,
    r:   0.85 + Math.random() * 0.65,
    flash: 0, flashFrame: 0,
    flashInterval: 85 + Math.random() * 130,
    dead: false, W, H,
  };
}

function stepSatellite(sat) {
  sat.x += sat.vx; sat.y += sat.vy;
  sat.flashFrame++;
  if (sat.flashFrame > sat.flashInterval) {
    sat.flashFrame = 0; sat.flash = 1;
  }
  if (sat.flash > 0) sat.flash = Math.max(0, sat.flash - 0.075);
  if (sat.x < -20 || sat.x > sat.W + 20 || sat.y < -20 || sat.y > sat.H + 20)
    sat.dead = true;
}

function drawSatellite(ctx, sat) {
  const a = 0.52 + sat.flash * 0.48;
  const r = sat.r * (1 + sat.flash * 1.6);

  ctx.beginPath();
  ctx.arc(sat.x, sat.y, r, 0, Math.PI * 2);
  ctx.fillStyle = rgba(255, 255, 255, a);
  ctx.fill();

  if (a > 0.28) {
    const g = ctx.createRadialGradient(sat.x, sat.y, 0, sat.x, sat.y, r * 4.5);
    g.addColorStop(0, rgba(255, 255, 255, a * 0.32));
    g.addColorStop(1, rgba(255, 255, 255, 0));
    ctx.beginPath();
    ctx.arc(sat.x, sat.y, r * 4.5, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
  }
}

// ─── SHOWER PATTERNS ─────────────────────────────────────────────────────────
function showerSingle(W, H) {
  return [{ meteor: makeMeteor(W, H), delayMs: 0 }];
}

function showerParallel(W, H) {
  const count   = 3 + Math.floor(Math.random() * 3);
  const goRight = Math.random() > 0.5;
  const ang     = (18 + Math.random() * 34) * Math.PI / 180;
  const baseY   = H * (0.03 + Math.random() * 0.22);
  const spacing = 25 + Math.random() * 65;
  const baseSpd = 8 + Math.random() * 11;
  return Array.from({ length: count }, (_, i) => ({
    meteor: makeMeteor(W, H, {
      goRight, ang,
      speed:  baseSpd * (0.82 + Math.random() * 0.35),
      y:      baseY + i * spacing + (Math.random() - 0.5) * 16,
      headR:  1.1 + Math.random() * 2.0,
    }),
    delayMs: i * (60 + Math.random() * 150),
  }));
}

function showerRadial(W, H) {
  const count = 4 + Math.floor(Math.random() * 4);
  const cx = W * (0.22 + Math.random() * 0.56);
  const cy = H * (0.02 + Math.random() * 0.12);
  return Array.from({ length: count }, (_, i) => {
    const deg    = -42 + (i / (count - 1)) * 84 + (Math.random() - 0.5) * 14;
    const angRad = deg * Math.PI / 180;
    const spd    = 8 + Math.random() * 12;
    const m = makeMeteor(W, H, { headR: 1.3 + Math.random() * 2.4, decay: 0.005 + Math.random() * 0.008 });
    m.x = cx + (Math.random() - 0.5) * 35;
    m.y = cy + (Math.random() - 0.5) * 25;
    m.vx = Math.sin(angRad) * spd;
    m.vy = Math.abs(Math.cos(angRad) * spd * 0.8) + 0.5;
    return { meteor: m, delayMs: i * (42 + Math.random() * 110) };
  });
}

function showerVformation(W, H) {
  const count = 3 + Math.floor(Math.random() * 2);
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push({
      meteor: makeMeteor(W, H, {
        goRight: true, x: -30 - i * 28,
        y: H * (0.03 + i * 0.072),
        speed: 9 + Math.random() * 9, headR: 1.2 + Math.random() * 1.7,
      }),
      delayMs: i * 125,
    });
    out.push({
      meteor: makeMeteor(W, H, {
        goRight: false, x: W + 30 + i * 28,
        y: H * (0.03 + i * 0.072),
        speed: 9 + Math.random() * 9, headR: 1.2 + Math.random() * 1.7,
      }),
      delayMs: i * 125 + 62,
    });
  }
  return out;
}

function showerCluster(W, H) {
  const count = 4 + Math.floor(Math.random() * 5);
  const cx = W * (0.10 + Math.random() * 0.80);
  const cy = H * (0.01 + Math.random() * 0.18);
  return Array.from({ length: count }, () => {
    const goRight = cx < W / 2 ? Math.random() > 0.18 : Math.random() < 0.18;
    const m = makeMeteor(W, H, { headR: 0.8 + Math.random() * 1.8, speed: 10 + Math.random() * 15, goRight });
    m.x = cx + (Math.random() - 0.5) * 120;
    m.y = cy + (Math.random() - 0.5) * 50;
    if (m.vy < 0) m.vy *= -1;
    return { meteor: m, delayMs: Math.random() * 700 };
  });
}

function showerRandom(W, H) {
  const fns = [
    showerSingle, showerSingle, showerSingle,
    showerParallel, showerRadial, showerVformation, showerCluster,
  ];
  return fns[Math.floor(Math.random() * fns.length)](W, H);
}

// ─── GALACTIC STAR CLUSTERS ───────────────────────────────────────────────────
// Visible open and globular clusters that appear in the Milky Way
function buildStarClusters() {
  const { coreCX, coreCY, bandAngle } = MW_CONFIG;
  const cos = Math.cos(bandAngle), sin = Math.sin(bandAngle);
  const clusterDefs = [
    // [t along band, perpOffset, starCount, radius, brightness, colour warmth]
    { t: -0.55, perp:  0.04, count: 55, rr: 0.018, bMult: 1.6, warm: 0.3 }, // open cluster
    { t: -0.30, perp: -0.03, count: 80, rr: 0.024, bMult: 2.0, warm: 0.6 }, // rich open cluster
    { t:  0.10, perp:  0.01, count: 45, rr: 0.012, bMult: 1.4, warm: 0.8 }, // near core
    { t:  0.42, perp: -0.05, count: 65, rr: 0.016, bMult: 1.5, warm: 0.4 }, // arm cluster
    { t:  0.68, perp:  0.03, count: 38, rr: 0.010, bMult: 1.2, warm: 0.2 }, // sparse outer
    { t: -0.72, perp: -0.02, count: 30, rr: 0.009, bMult: 1.1, warm: 0.5 }, // distant arm
    // Globular clusters — rounder, more concentrated, older (warmer colours)
    { t:  0.05, perp:  0.12, count: 120, rr: 0.014, bMult: 2.5, warm: 0.9, globular: true },
    { t: -0.18, perp: -0.09, count: 95,  rr: 0.011, bMult: 2.2, warm: 0.85,globular: true },
  ];

  return clusterDefs.map(def => {
    const cx = coreCX + cos * def.t * 0.9 - sin * def.perp;
    const cy = coreCY + sin * def.t * 0.9 + cos * def.perp;
    const stars = [];
    for (let i = 0; i < def.count; i++) {
      let dx, dy;
      if (def.globular) {
        // King profile for globular clusters
        const r  = Math.pow(Math.random(), 0.5) * def.rr;
        const a  = Math.random() * Math.PI * 2;
        dx = Math.cos(a) * r; dy = Math.sin(a) * r;
      } else {
        // Looser distribution for open clusters
        const r  = Math.pow(Math.random(), 0.35) * def.rr;
        const a  = Math.random() * Math.PI * 2;
        dx = Math.cos(a) * r; dy = Math.sin(a) * r;
      }
      const distFrac = Math.hypot(dx, dy) / def.rr;
      const bright   = Math.exp(-distFrac * 2.5) * def.bMult;
      const r        = Math.random() < 0.08 ? 0.35 + Math.random() * 0.5 : 0.12 + Math.random() * 0.22;
      const warmCol  = lerpC([200, 215, 255], [255, 218, 150], def.warm);
      stars.push({
        xr: cx + dx, yr: cy + dy,
        r,
        baseA: clamp((0.06 + Math.random() * 0.18) * bright, 0, 0.7),
        ts: 0.06 + Math.random() * 0.4,
        to: Math.random() * Math.PI * 2,
        col: warmCol,
      });
    }
    return { cx, cy, stars, globular: !!def.globular };
  });
}

function drawStarClusters(ctx, clusters, W, H, t) {
  for (const cluster of clusters) {
    for (const s of cluster.stars) {
      const sx = s.xr * W, sy = s.yr * H;
      if (sx < -5 || sx > W + 5 || sy < -5 || sy > H + 5) continue;
      const twink = 0.70 + 0.30 * Math.sin(t * s.ts * 0.35 + s.to);
      const a = s.baseA * twink;
      if (a < 0.006) continue;
      ctx.beginPath();
      ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
      ctx.fillStyle = rgba(s.col[0], s.col[1], s.col[2], a);
      ctx.fill();
    }
  }
}

// ─── EMISSION NEBULAE (H-II regions along galactic plane) ────────────────────
// These are the reddish/pink glowing regions — ionised hydrogen clouds
function buildEmissionNebulae() {
  const { coreCX, coreCY, bandAngle } = MW_CONFIG;
  const cos = Math.cos(bandAngle), sin = Math.sin(bandAngle);
  const nebDefs = [
    { t: -0.48, perp:  0.02, rr: 0.045, col: [255,  60,  80], a: 0.022 }, // like Eta Carinae
    { t: -0.20, perp: -0.03, rr: 0.032, col: [255,  80, 100], a: 0.018 },
    { t:  0.08, perp:  0.04, rr: 0.038, col: [255, 100, 120], a: 0.020 }, // Lagoon-like
    { t:  0.35, perp: -0.02, rr: 0.028, col: [200,  70, 255], a: 0.015 }, // reflection
    { t:  0.60, perp:  0.05, rr: 0.022, col: [255,  55,  75], a: 0.016 },
    { t: -0.65, perp: -0.01, rr: 0.018, col: [255, 120, 140], a: 0.012 },
  ];
  return nebDefs.map(d => ({
    xr: coreCX + cos * d.t * 0.9 - sin * d.perp,
    yr: coreCY + sin * d.t * 0.9 + cos * d.perp,
    rr: d.rr, col: d.col, a: d.a,
    ax: 0.6 + Math.random() * 0.8, ay: 0.5 + Math.random() * 0.7,
    rot: bandAngle + (Math.random() - 0.5) * 0.6,
  }));
}

function drawEmissionNebulae(ctx, nebulae, W, H) {
  const minDim = Math.min(W, H);
  for (const n of nebulae) {
    const cx = n.xr * W, cy = n.yr * H;
    const rx = n.rr * minDim * n.ax;
    const ry = n.rr * minDim * n.ay;
    const rmax = Math.max(rx, ry);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(n.rot);
    ctx.scale(rx / rmax, ry / rmax);

    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, rmax);
    g.addColorStop(0,   rgba(n.col[0], n.col[1], n.col[2], n.a));
    g.addColorStop(0.4, rgba(n.col[0], n.col[1], n.col[2], n.a * 0.5));
    g.addColorStop(0.75,rgba(n.col[0], n.col[1], n.col[2], n.a * 0.15));
    g.addColorStop(1,   rgba(n.col[0], n.col[1], n.col[2], 0));

    ctx.beginPath();
    ctx.arc(0, 0, rmax, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
  }
}

// ─── ZODIACAL LIGHT ────────────────────────────────────────────────────────────
// Very faint diffuse cone of light near ecliptic (interplanetary dust scattering)
function drawZodiacalLight(ctx, W, H) {
  // Appears as a faint cone from the horizon, tilted along ecliptic
  // Only visible at truly dark sites like Cherry Springs
  const g = ctx.createRadialGradient(W * 0.52, H, 0, W * 0.52, H, H * 0.85);
  g.addColorStop(0,   'rgba(240, 235, 210, 0.028)');
  g.addColorStop(0.4, 'rgba(230, 225, 200, 0.012)');
  g.addColorStop(0.8, 'rgba(220, 218, 195, 0.004)');
  g.addColorStop(1,   'rgba(0,0,0,0)');
  ctx.save();
  ctx.scale(0.35, 1); // narrow cone
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W / 0.35, H);
  ctx.restore();
}

// ─── ATMOSPHERIC AIRGLOW ──────────────────────────────────────────────────────
// Subtle greenish-cyan band near horizon (OI 557.7nm emission line)
// Also includes weak NaD yellow band (sodium layer) and OH Meinel bands
function drawAirglow(ctx, W, H) {
  // OI 557.7nm — green (~90km altitude)
  const gGreen = ctx.createLinearGradient(0, H * 0.75, 0, H);
  gGreen.addColorStop(0,   'rgba(0, 0, 0, 0)');
  gGreen.addColorStop(0.35,'rgba(22, 58, 32, 0.022)');
  gGreen.addColorStop(0.7, 'rgba(20, 52, 28, 0.038)');
  gGreen.addColorStop(1,   'rgba(12, 32, 18, 0.028)');
  ctx.fillStyle = gGreen;
  ctx.fillRect(0, 0, W, H);

  // NaD 589nm — faint yellow-orange sodium layer
  const gSodium = ctx.createLinearGradient(0, H * 0.82, 0, H);
  gSodium.addColorStop(0,   'rgba(0, 0, 0, 0)');
  gSodium.addColorStop(0.5, 'rgba(48, 35, 8, 0.012)');
  gSodium.addColorStop(1,   'rgba(38, 28, 6, 0.018)');
  ctx.fillStyle = gSodium;
  ctx.fillRect(0, 0, W, H);

  // OH Meinel bands — subtle reddish glow throughout sky
  const gOH = ctx.createRadialGradient(W * 0.5, H, 0, W * 0.5, H * 0.3, H * 0.95);
  gOH.addColorStop(0,   'rgba(0,0,0,0)');
  gOH.addColorStop(0.7, 'rgba(35, 15, 8, 0.008)');
  gOH.addColorStop(1,   'rgba(28, 12, 6, 0.014)');
  ctx.fillStyle = gOH;
  ctx.fillRect(0, 0, W, H);
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function StarBackground({ fixed = true, starCount = 340 }) {
  const canvasRef = useRef(null);

  const layers = useMemo(() => [
    makeStarLayer(Math.floor(starCount * 0.30), 0),
    makeStarLayer(Math.floor(starCount * 0.42), 1),
    makeStarLayer(Math.floor(starCount * 0.28), 2),
  ], [starCount]);

  const nebulae     = useMemo(() => makeNebulae(),              []);
  const mwStars     = useMemo(() => buildMilkyWayStarCloud(),   []);
  const mwDust      = useMemo(() => buildMilkyWayDustLanes(),   []);
  const mwGlowBlobs = useMemo(() => buildMilkyWayGlowLayers(),  []);
  const mwClusters  = useMemo(() => buildStarClusters(),        []);
  const emNebulae   = useMemo(() => buildEmissionNebulae(),     []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf = null, meteors = [], explosions = [], lastTs = 0;
    const sessionStart = performance.now();
    let eggFired = false;
    let nextShowerMs   = 2800 + Math.random() * 3800;
    let showerAccumMs  = 0;
    let scrollY        = 0;
    let satellite      = null;
    let nextSatMs      = 42000 + Math.random() * 95000;
    let satAccumMs     = 0;

    const onScroll = () => { scrollY = window.scrollY; };
    window.addEventListener('scroll', onScroll, { passive: true });

    function resize() {
      canvas.width  = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    }

    function addShower(entries) {
      for (const { meteor, delayMs } of entries) {
        if (delayMs <= 0) { meteors.push(meteor); }
        else { setTimeout(() => { if (canvas) meteors.push(meteor); }, delayMs); }
      }
    }

    function pickBrightStar(W, H) {
      const pool = layers[0].filter(s => s.bright && s.xr > 0.15 && s.xr < 0.85 && s.yr > 0.10 && s.yr < 0.80);
      if (!pool.length) return { x: W * 0.5, y: H * 0.3 };
      const s = pool[Math.floor(Math.random() * pool.length)];
      return { x: s.xr * W, y: s.yr * H };
    }

    function triggerEgg(W, H) {
      eggFired = true;
      const target = pickBrightStar(W, H);
      const { x: tx, y: ty } = target;
      const fromLeft = tx > W / 2;
      const startX = fromLeft ? -55 : W + 55;
      const startY = Math.max(18, ty - 140 - Math.random() * 95);
      const angle  = Math.atan2(ty - startY, tx - startX);
      const speed  = 8 + Math.random() * 6;
      const m = makeMeteor(W, H, { headR: 3.8 + Math.random() * 2.0, decay: 0.0015, isEgg: true, target });
      m.x = startX; m.y = startY;
      m.vx = Math.cos(angle) * speed;
      m.vy = Math.sin(angle) * speed;
      m.history = [];
      meteors.push(m);
      console.log('%c☄️  Egg meteor launched!', 'color:#fa0;font-size:13px;font-weight:bold');
    }

    window.__starExplosion = () => { eggFired = false; triggerEgg(canvas.width, canvas.height); };
    window.__starShower    = (pattern) => {
      const W = canvas.width, H = canvas.height;
      const map = {
        parallel:   showerParallel,
        radial:     showerRadial,
        vformation: showerVformation,
        cluster:    showerCluster,
      };
      addShower((pattern && map[pattern] ? map[pattern] : showerRandom)(W, H));
      console.log(`%c🌠 Shower: ${pattern || 'random'}`, 'color:#8df;font-size:13px');
    };

    console.log('%c✨ StarBG v5 — Cherry Springs Grade | window.__starExplosion() | window.__starShower()', 'color:#adf;font-size:12px');

    function tick(ts) {
      const dt = Math.min(ts - lastTs, 50);
      lastTs = ts;
      showerAccumMs += dt;
      satAccumMs    += dt;

      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      const t = ts * 0.001;

      // ── Background nebulae ─────────────────────────────────────────────────
      drawNebulae(ctx, nebulae, W, H);

      // ── Zodiacal light ─────────────────────────────────────────────────────
      drawZodiacalLight(ctx, W, H);

      // ── Milky Way ──────────────────────────────────────────────────────────
      drawMilkyWay(ctx, W, H, t, mwStars, mwDust, mwGlowBlobs);

      // ── Emission nebulae (H-II regions) ────────────────────────────────────
      drawEmissionNebulae(ctx, emNebulae, W, H);

      // ── Star clusters ──────────────────────────────────────────────────────
      drawStarClusters(ctx, mwClusters, W, H, t);

      // ── Foreground stars (3 depth layers) ─────────────────────────────────
      for (let li = layers.length - 1; li >= 0; li--) {
        const parallaxShift = scrollY * (0.0007 * (li + 1));

        for (const s of layers[li]) {
          s.ox = Math.sin(t * 0.032 + s.to) * 0.65 * (li + 1);
          s.oy = Math.cos(t * 0.025 + s.to) * 0.42 * (li + 1);
          const sx = s.xr * W + s.ox;
          const sy = s.yr * H + s.oy - parallaxShift;

          // Wink-out
          if (!s.winking) {
            s.winkNext--;
            if (s.winkNext <= 0) {
              s.winking   = true;
              s.winkTimer = 0;
              s.winkDur   = 70 + Math.random() * 160;
              s.winkNext  = 220 + Math.random() * 650;
            }
          } else {
            s.winkTimer++;
            if (s.winkTimer >= s.winkDur) s.winking = false;
          }
          const winkMult = s.winking
            ? clamp(Math.sin(s.winkTimer / s.winkDur * Math.PI), 0, 1)
            : 1;

          // Atmospheric scintillation — stronger near horizon
          const atmosFactor = 0.28 + s.yr * 0.72;
          const twinkA = s.baseA * (0.5 + 0.5 * Math.sin(t * s.ts * atmosFactor + s.to));

          // Atmospheric extinction near horizon
          const horizonFade = clamp(1 - (s.yr - 0.78) * 3.8, 0.22, 1);
          const a = twinkA * horizonFade * winkMult;

          // Bright star extras: diffraction spikes + bloom
          if (s.bright && s.r > 1.4) {
            const sl = s.r * 11;
            ctx.save();
            ctx.strokeStyle = rgba(s.col[0], s.col[1], s.col[2], a * 0.38);
            ctx.lineWidth   = 0.42;
            for (const [dx, dy] of [[1, 0], [0, 1], [0.707, 0.707], [-0.707, 0.707]]) {
              ctx.beginPath();
              ctx.moveTo(sx - dx * sl, sy - dy * sl);
              ctx.lineTo(sx + dx * sl, sy + dy * sl);
              ctx.stroke();
            }
            ctx.restore();

            const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, s.r * 6.5);
            g.addColorStop(0, rgba(s.col[0], s.col[1], s.col[2], a * 0.58));
            g.addColorStop(1, rgba(s.col[0], s.col[1], s.col[2], 0));
            ctx.beginPath();
            ctx.arc(sx, sy, s.r * 6.5, 0, Math.PI * 2);
            ctx.fillStyle = g;
            ctx.fill();
          }

          // Star dot — coloured
          ctx.beginPath();
          ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
          ctx.fillStyle = rgba(s.col[0], s.col[1], s.col[2], a);
          ctx.fill();
        }
      }

      // ── Atmospheric airglow ────────────────────────────────────────────────
      drawAirglow(ctx, W, H);

      // ── Satellite ─────────────────────────────────────────────────────────
      if (satAccumMs >= nextSatMs) {
        satAccumMs = 0;
        nextSatMs  = 48000 + Math.random() * 105000;
        satellite  = makeSatellite(W, H);
      }
      if (satellite) {
        stepSatellite(satellite);
        drawSatellite(ctx, satellite);
        if (satellite.dead) satellite = null;
      }

      // ── Meteor shower spawner ──────────────────────────────────────────────
      if (showerAccumMs >= nextShowerMs) {
        showerAccumMs = 0;
        nextShowerMs  = 3000 + Math.random() * 6000;
        addShower(showerRandom(W, H));
      }

      // ── Easter egg: 5-minute supernova ────────────────────────────────────
      if (!eggFired && performance.now() - sessionStart >= 5 * 60 * 1000) {
        triggerEgg(W, H);
      }

      // ── Meteors ────────────────────────────────────────────────────────────
      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i];
        stepMeteor(m, meteors, W, H);

        // Egg meteor reaches target → supernova
        if (m.isEgg && m.target && m.history.length > 5) {
          if (dist2(m.x, m.y, m.target.x, m.target.y) < 32 * 32) {
            explosions.push(makeExplosion(m.target.x, m.target.y));
            console.log('%c💥 SUPERNOVA!', 'color:#f60;font-size:20px;font-weight:bold');
            meteors.splice(i, 1);
            continue;
          }
        }

        if (m.life <= 0 || m.x < -700 || m.x > W + 700 || m.y < -600 || m.y > H + 600) {
          meteors.splice(i, 1);
          continue;
        }
        drawMeteor(ctx, m);
      }

      // ── Explosions ─────────────────────────────────────────────────────────
      for (let i = explosions.length - 1; i >= 0; i--) {
        stepExplosion(explosions[i]);
        drawExplosion(ctx, explosions[i]);
        if (!explosions[i].active) explosions.splice(i, 1);
      }

      // ── Vignette (OLED black edges) ────────────────────────────────────────
      drawVignette(ctx, W, H);

      raf = requestAnimationFrame(tick);
    }

    resize();
    lastTs = performance.now();
    raf = requestAnimationFrame(tick);

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('scroll', onScroll);
      delete window.__starExplosion;
      delete window.__starShower;
    };
  }, [layers, nebulae, mwStars, mwDust, mwGlowBlobs, mwClusters, emNebulae]);

  const style = fixed
    ? {
        position: 'fixed', inset: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: 0,
        background: '#000',
        // Force GPU compositing for smooth rendering
        willChange: 'transform',
        transform: 'translateZ(0)',
      }
    : {
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none',
        background: '#000',
        willChange: 'transform',
        transform: 'translateZ(0)',
      };

  return <canvas ref={canvasRef} style={style} />;
}



export function StarBackgroundDemo() {
  return (
    <div style={{
      position: 'relative',
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      fontFamily: '"Crimson Pro", "Georgia", serif',
      background: '#000',
    }}>
      {/* The star field — fixed covers the whole viewport */}
      <StarBackground fixed={true} starCount={340} />

      {/* Demo overlay content */}
      <div style={{
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        padding: '2rem',
        textAlign: 'center',
        pointerEvents: 'none',
        userSelect: 'none',
      }}>
        {/* Title */}
        <div style={{
          fontSize: 'clamp(1.1rem, 2vw, 1.4rem)',
          letterSpacing: '0.38em',
          color: 'rgba(200, 220, 255, 0.45)',
          textTransform: 'uppercase',
          marginBottom: '1rem',
          fontWeight: 300,
        }}>
          Cherry Springs State Park · Pennsylvania
        </div>

        <h1 style={{
          fontSize: 'clamp(2.8rem, 7vw, 5.5rem)',
          fontWeight: 300,
          color: 'rgba(235, 240, 255, 0.92)',
          margin: '0 0 0.5rem',
          lineHeight: 1.1,
          letterSpacing: '-0.01em',
          textShadow: '0 0 80px rgba(160,180,255,0.15)',
        }}>
          The Night Sky
        </h1>

        <div style={{
          fontSize: 'clamp(0.95rem, 1.8vw, 1.15rem)',
          color: 'rgba(180, 195, 230, 0.5)',
          letterSpacing: '0.12em',
          marginBottom: '3.5rem',
          fontStyle: 'italic',
        }}>
          Bortle Class 2 · Gold Zone Dark Sky
        </div>

        {/* Feature labels */}
        <div style={{
          display: 'flex',
          gap: 'clamp(1rem, 3vw, 2.5rem)',
          flexWrap: 'wrap',
          justifyContent: 'center',
          marginBottom: '3rem',
          pointerEvents: 'auto',
        }}>
          {[
            { label: 'Milky Way', desc: 'Core + dust lanes + H-II regions' },
            { label: 'Meteors',   desc: 'Ablation plasma trails' },
            { label: 'Stars',     desc: 'O/B/A/F/G/K/M spectral types' },
            { label: 'Airglow',   desc: 'OI 557nm + NaD emission' },
          ].map(f => (
            <div key={f.label} style={{
              padding: '0.65rem 1.2rem',
              border: '1px solid rgba(160,185,255,0.15)',
              borderRadius: '4px',
              background: 'rgba(0,0,0,0.35)',
              backdropFilter: 'blur(8px)',
              minWidth: '160px',
            }}>
              <div style={{
                fontSize: '0.78rem',
                letterSpacing: '0.22em',
                color: 'rgba(180,200,255,0.7)',
                textTransform: 'uppercase',
                marginBottom: '0.3rem',
              }}>
                {f.label}
              </div>
              <div style={{
                fontSize: '0.82rem',
                color: 'rgba(140,160,210,0.55)',
                fontStyle: 'italic',
              }}>
                {f.desc}
              </div>
            </div>
          ))}
        </div>

        {/* Console commands hint */}
        <div style={{
          fontFamily: '"Fira Code", "Courier New", monospace',
          fontSize: '0.75rem',
          color: 'rgba(120, 180, 120, 0.5)',
          letterSpacing: '0.04em',
          lineHeight: 1.8,
          pointerEvents: 'auto',
          background: 'rgba(0,0,0,0.4)',
          padding: '1rem 1.5rem',
          borderRadius: '6px',
          border: '1px solid rgba(120,180,120,0.12)',
          backdropFilter: 'blur(12px)',
        }}>
          <div style={{ color: 'rgba(120,180,120,0.8)', marginBottom: '0.25rem' }}>// browser console</div>
          <div>window.__starExplosion()          <span style={{ color: 'rgba(120,180,120,0.35)' }}>→ supernova</span></div>
          <div>window.__starShower('parallel')   <span style={{ color: 'rgba(120,180,120,0.35)' }}>→ parallel barrage</span></div>
          <div>window.__starShower('radial')     <span style={{ color: 'rgba(120,180,120,0.35)' }}>→ fan burst</span></div>
          <div>window.__starShower('cluster')    <span style={{ color: 'rgba(120,180,120,0.35)' }}>→ dense cluster</span></div>
          <div>window.__starShower('vformation') <span style={{ color: 'rgba(120,180,120,0.35)' }}>→ V-formation</span></div>
          <div>window.__starShower()             <span style={{ color: 'rgba(120,180,120,0.35)' }}>→ random pattern</span></div>
        </div>

        {/* Scroll hint */}
        <div style={{
          position: 'absolute',
          bottom: '2.5rem',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: '0.72rem',
          letterSpacing: '0.25em',
          color: 'rgba(140,160,210,0.35)',
          textTransform: 'uppercase',
        }}>
          scroll to test parallax
        </div>
      </div>
    </div>
  );
}



// ─────────────────────────────────────────────────────────────────────────────
// END OF FILE
// StarBackground.jsx — v5.0 — 2026-02-20
// Lines: 1988 | Functions: 40 top-level
// MIT Licence — free to use, modify, and distribute
// Inspired by Cherry Springs State Park, Potter County, Pennsylvania — the
// darkest accessible sky in the northeastern United States.
// ─────────────────────────────────────────────────────────────────────────────
//
