/**
 * frontend/src/components/liquid/CityScene3D.jsx
 *
 * A real-time 3D render of the PlanIt "event city": a skyline of lit towers with a concert stage and sweeping
 * spotlights, a rotating ferris wheel, a big-top tent, an arena, balloons, string lights and confetti.
 *
 *   mood="night"   Home hero, deep indigo sky, cool windows, pink + violet stage light
 *   mood="dusk"    Home skyline band, warm horizon, amber windows
 *   mood="dawn"    Careers, sunrise over a city that is still being built: tower cranes, skeleton towers
 *
 * three.js is loaded lazily. The scene sleeps off-screen, freezes for reduced motion, and falls back to a flat
 * silhouette (CityFallback) when WebGL is unavailable, the page is on the "low" perf tier, or the context is lost.
 */
import { useEffect, useRef, useState } from 'react';

let threePromise;
function loadThree() {
  if (!threePromise) {
    threePromise = Promise.all([
      import('three'),
      import('three/examples/jsm/environments/RoomEnvironment.js'),
    ]).then(([THREE, env]) => ({ THREE, RoomEnvironment: env.RoomEnvironment }));
  }
  return threePromise;
}

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const easeOut = (x) => 1 - Math.pow(1 - x, 3);
function rng(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MOODS = {
  night: {
    sky: ['#04040d', '#0a0b2c', '#1b1a5e', '#4a2a8a'], fog: 0x14124a, fogD: 0.0105,
    lit: 0.33, warm: ['#ffd48a', '#ffe9b8', '#9fc4ff', '#ffb0d6'], hemi: [0x7a7cff, 0x0a0a22, 0.9],
    rim: 0xff5fae, stars: true, cranes: 0, exposure: 1.12,
  },
  dusk: {
    sky: ['#06061a', '#241553', '#6a2f7e', '#ff9a6a'], fog: 0x3b2160, fogD: 0.0095,
    lit: 0.38, warm: ['#ffc873', '#ffe0a3', '#ffa56b', '#ffd2f0'], hemi: [0xb18cff, 0x1a0f33, 1.0],
    rim: 0xff8a5c, stars: true, cranes: 0, exposure: 1.15,
  },
  dawn: {
    sky: ['#090d27', '#2f2866', '#a45a8c', '#ffc08e'], fog: 0x6a4a86, fogD: 0.0088,
    lit: 0.16, warm: ['#ffe2a6', '#fff0cc', '#ffc08e'], hemi: [0xffd6b0, 0x2a1d4a, 1.05],
    rim: 0xffb36b, stars: false, cranes: 3, exposure: 1.18,
  },
};

const BRAND = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#22d3ee', '#34d399'];

function glowTexture(THREE, stops, size = 128) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); const h = size / 2;
  const gr = g.createRadialGradient(h, h, 0, h, h, h);
  stops.forEach(([o, col]) => gr.addColorStop(o, col));
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function skyTexture(THREE, stops) {
  const c = document.createElement('canvas'); c.width = 4; c.height = 512;
  const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, stops[0]); gr.addColorStop(0.45, stops[1]); gr.addColorStop(0.78, stops[2]); gr.addColorStop(1, stops[3]);
  g.fillStyle = gr; g.fillRect(0, 0, 4, 512);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function windowTextures(THREE, rnd, mood) {
  const N = 16; const S = 256; const cell = S / N;
  const a = document.createElement('canvas'); a.width = a.height = S;
  const b = document.createElement('canvas'); b.width = b.height = S;
  const ga = a.getContext('2d'); const gb = b.getContext('2d');
  ga.fillStyle = '#0a0d27'; ga.fillRect(0, 0, S, S);
  gb.fillStyle = '#000'; gb.fillRect(0, 0, S, S);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const px = x * cell + 2; const py = y * cell + 3;
      ga.fillStyle = '#141c47'; ga.fillRect(px, py, cell - 4, cell - 6);
      if (rnd() < mood.lit) {
        const col = mood.warm[Math.floor(rnd() * mood.warm.length)];
        ga.fillStyle = col; ga.fillRect(px, py, cell - 4, cell - 6);
        gb.fillStyle = col; gb.globalAlpha = 0.55 + rnd() * 0.45; gb.fillRect(px, py, cell - 4, cell - 6); gb.globalAlpha = 1;
      }
    }
  }
  // floor lines
  ga.fillStyle = 'rgba(120,140,255,0.16)';
  for (let y = 0; y < N; y += 4) ga.fillRect(0, y * cell, S, 1.5);
  const mk = (cv, srgb) => {
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.SRGBColorSpace;
    t.anisotropy = 4; return t;
  };
  return { map: mk(a), emissive: mk(b) };
}

function stripeTexture(THREE) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 8;
  const g = c.getContext('2d');
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f4f1ff' : '#6d5cf0'; g.fillRect(i * 32, 0, 32, 8); }
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.repeat.set(2, 1); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function ledTexture(THREE) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 512, 0);
  gr.addColorStop(0, '#ff4fa3'); gr.addColorStop(0.33, '#8b5cf6'); gr.addColorStop(0.66, '#22d3ee'); gr.addColorStop(1, '#ff4fa3');
  g.fillStyle = gr; g.fillRect(0, 0, 512, 128);
  g.fillStyle = 'rgba(0,0,0,0.35)';
  for (let x = 0; x < 512; x += 8) g.fillRect(x, 0, 1.5, 128);
  for (let y = 0; y < 128; y += 8) g.fillRect(0, y, 512, 1.5);
  const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}

/* ───────────────────────────── scene builder ───────────────────────────── */
function buildCity({ THREE, scene, camera, renderer, seed, mood: moodKey, view }) {
  const CAM = view === 'close' ? { y: 3.4, z: 18, ly: 7.4, lz: -14, fov: 44 } : { y: 6.2, z: 27, ly: 9.5, lz: -22, fov: 36 };
  const M = MOODS[moodKey] || MOODS.night;
  const rnd = rng(seed);
  const disposables = [];
  const keep = (x) => { disposables.push(x); return x; };

  renderer.toneMappingExposure = M.exposure;
  scene.background = keep(skyTexture(THREE, M.sky));
  scene.fog = new THREE.FogExp2(M.fog, M.fogD);
  scene.environmentIntensity = 0.4;

  scene.add(new THREE.HemisphereLight(M.hemi[0], M.hemi[1], M.hemi[2]));
  const rim = new THREE.DirectionalLight(M.rim, 2.2); rim.position.set(-18, 16, -30); scene.add(rim);
  const fill = new THREE.DirectionalLight(0x6a8cff, 0.9); fill.position.set(20, 10, 14); scene.add(fill);

  /* stars */
  if (M.stars) {
    const n = 420; const p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      p[i * 3] = (rnd() - 0.5) * 260; p[i * 3 + 1] = 30 + rnd() * 70; p[i * 3 + 2] = -120 - rnd() * 40;
    }
    const g = keep(new THREE.BufferGeometry()); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const sm = keep(new THREE.PointsMaterial({ color: 0xffffff, size: 0.55, sizeAttenuation: true, transparent: true, opacity: 0.8, fog: false }));
    scene.add(new THREE.Points(g, sm));
  }

  /* ground */
  const groundMat = keep(new THREE.MeshStandardMaterial({ color: 0x060720, metalness: 0.6, roughness: 0.55 }));
  const ground = new THREE.Mesh(keep(new THREE.PlaneGeometry(320, 200)), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, -50); scene.add(ground);
  const roadMat = keep(new THREE.MeshBasicMaterial({ color: M.rim, transparent: true, opacity: 0.35 }));
  [-12, -22, -34, -48].forEach((z) => {
    const r = new THREE.Mesh(keep(new THREE.PlaneGeometry(260, 0.12)), roadMat);
    r.rotation.x = -Math.PI / 2; r.position.set(0, 0.02, z); scene.add(r);
  });

  /* buildings */
  const tex = windowTextures(THREE, rnd, M);
  const sideMats = [0.55, 0.8, 1.05].map((ei, i) => keep(new THREE.MeshStandardMaterial({
    map: tex.map, emissiveMap: tex.emissive, emissive: 0xffffff, emissiveIntensity: ei,
    color: [0xb8c0ff, 0xd0c4ff, 0xa8b4f0][i], metalness: 0.55, roughness: 0.34, envMapIntensity: 0.9,
  })));
  const roofMat = keep(new THREE.MeshStandardMaterial({ color: 0x1a1e45, metalness: 0.7, roughness: 0.4 }));
  const trimMat = keep(new THREE.MeshStandardMaterial({ color: 0x8a90d8, metalness: 0.9, roughness: 0.25 }));
  const blinkMat = keep(new THREE.MeshBasicMaterial({ color: 0xff3b3b }));
  const blinkers = [];
  const risers = [];

  const SU = 13; const SV = 17;
  function sideGeo(w, h, d) {
    const g = new THREE.BoxGeometry(w, h, d);
    const uv = g.attributes.uv; const ou = rnd(); const ov = rnd();
    for (let f = 0; f < 6; f++) {
      const ww = f < 2 ? d : w;
      for (let k = 0; k < 4; k++) {
        const i = f * 4 + k;
        if (f === 2 || f === 3) continue;
        uv.setXY(i, uv.getX(i) * ww / SU + ou, uv.getY(i) * h / SV + ov);
      }
    }
    g.translate(0, h / 2, 0); return g;
  }
  function tower(x, z, w, h, d, opts = {}) {
    const grp = new THREE.Group(); grp.position.set(x, 0, z);
    const sm = sideMats[Math.floor(rnd() * sideMats.length)];
    const body = new THREE.Mesh(keep(sideGeo(w, h, d)), [sm, sm, roofMat, roofMat, sm, sm]);
    grp.add(body);
    let top = h;
    const lip = new THREE.Mesh(keep(new THREE.BoxGeometry(w + 0.18, 0.22, d + 0.18)), trimMat);
    lip.position.y = h + 0.11; grp.add(lip);
    if (opts.steps && h > 10) {
      const w2 = w * 0.64; const d2 = d * 0.64; const h2 = h * (0.16 + rnd() * 0.14);
      const s = new THREE.Mesh(keep(sideGeo(w2, h2, d2)), [sm, sm, roofMat, roofMat, sm, sm]);
      s.position.y = h + 0.22; grp.add(s); top = h + 0.22 + h2;
      const l2 = new THREE.Mesh(keep(new THREE.BoxGeometry(w2 + 0.14, 0.18, d2 + 0.14)), trimMat);
      l2.position.y = top + 0.09; grp.add(l2);
    }
    if (opts.antenna) {
      const a = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.05, 0.1, 4 + rnd() * 3, 6)), trimMat);
      a.position.y = top + 2.4; grp.add(a);
      const b = new THREE.Mesh(keep(new THREE.SphereGeometry(0.16, 8, 8)), blinkMat);
      b.position.y = top + 4.4 + 0.6; grp.add(b); blinkers.push({ m: b, ph: rnd() * 6 });
    }
    scene.add(grp); risers.push({ g: grp, delay: opts.delay || 0 });
    return grp;
  }
  function roundTower(x, z, r, h) {
    const grp = new THREE.Group(); grp.position.set(x, 0, z);
    const g = keep(new THREE.CylinderGeometry(r, r, h, 28, 1, false));
    const uv = g.attributes.uv; const ou = rnd();
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (Math.PI * 2 * r) / SU + ou, uv.getY(i) * h / SV);
    g.translate(0, h / 2, 0);
    const sm = sideMats[1];
    const body = new THREE.Mesh(g, [sm, roofMat, roofMat]); grp.add(body);
    const cap = new THREE.Mesh(keep(new THREE.CylinderGeometry(r + 0.12, r + 0.12, 0.25, 28)), trimMat); cap.position.y = h + 0.12; grp.add(cap);
    const spire = new THREE.Mesh(keep(new THREE.ConeGeometry(r * 0.5, h * 0.22, 20)), trimMat); spire.position.y = h + h * 0.11 + 0.25; grp.add(spire);
    scene.add(grp); risers.push({ g: grp, delay: rnd() * 1.2 });
  }
  function skeleton(x, z, w, d, floors, built) {
    const grp = new THREE.Group(); grp.position.set(x, 0, z);
    const fh = 1.5; const slabG = keep(new THREE.BoxGeometry(w, 0.14, d));
    const colG = keep(new THREE.BoxGeometry(0.16, fh, 0.16));
    const slabM = keep(new THREE.MeshStandardMaterial({ color: 0xcfc3e8, metalness: 0.3, roughness: 0.6, emissive: 0x3a2a5a, emissiveIntensity: 0.4 }));
    for (let f = 0; f < floors; f++) {
      const slab = new THREE.Mesh(slabG, slabM); slab.position.y = f * fh + 0.07; grp.add(slab);
      if (f < floors - 1 || built) {
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
          const c = new THREE.Mesh(colG, trimMat); c.position.set(sx * (w / 2 - 0.1), f * fh + fh / 2, sz * (d / 2 - 0.1)); grp.add(c);
        });
      }
    }
    scene.add(grp); risers.push({ g: grp, delay: 0.6 + rnd() }); return grp;
  }

  const clear = []; // footprints of landmarks to keep clear: [x, z, r]
  const LAND = { stage: [-9.5, -7, 8], wheel: [12, -10, 7], tent: [3.2, -5.5, 4.2], arena: [-24, -17, 6.5] };
  Object.values(LAND).forEach((l) => clear.push(l));
  const blocked = (x, z, w) => clear.some(([cx, cz, r]) => Math.hypot(x - cx, (z - cz) * 0.8) < r + w * 0.5);

  for (let row = 0; row < 12; row++) {
    const z = -25 - row * 4.6 - rnd() * 1.5;
    let x = -72 - rnd() * 6;
    while (x < 72) {
      const w = 2.6 + rnd() * 3.6; const d = 2.6 + rnd() * 3.2;
      const cx = x + w / 2;
      if (!blocked(cx, z, w)) {
        const center = 1 - Math.min(1, Math.abs(cx) / 70);
        const farBoost = Math.min(1, row / 8);
        const h = (row < 2 ? 9 : 10) + rnd() * (10 + farBoost * 14) + center * farBoost * 22;
        const roll = rnd();
        if (roll < 0.14 && row > 1) roundTower(cx, z, Math.min(w, d) * 0.55, h * 0.95);
        else if (moodKey === 'dawn' && roll > 0.8 && row > 1) skeleton(cx, z, w, d, 5 + Math.floor(rnd() * 8), rnd() > 0.5);
        else tower(cx, z, w, h, d, { steps: rnd() < 0.55, antenna: h > 24 && rnd() < 0.5, delay: rnd() * 1.2 + row * 0.03 });
      }
      x += w + 0.5 + rnd() * 1.6;
    }
  }

  /* ───── stage ───── */
  const stage = new THREE.Group(); stage.position.set(LAND.stage[0], 0, LAND.stage[1]); scene.add(stage);
  const deck = new THREE.Mesh(keep(new THREE.BoxGeometry(9, 0.7, 4.6)), keep(new THREE.MeshStandardMaterial({ color: 0x1a1a3c, metalness: 0.6, roughness: 0.35 })));
  deck.position.y = 0.35; stage.add(deck);
  const led = ledTexture(THREE); keep(led);
  const screen = new THREE.Mesh(keep(new THREE.PlaneGeometry(6.2, 2.7)), keep(new THREE.MeshBasicMaterial({ map: led, toneMapped: false })));
  screen.position.set(0, 3.1, -1.9); stage.add(screen);
  const archMat = keep(new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: M.rim, emissiveIntensity: 2.2, metalness: 0.2, roughness: 0.3 }));
  const arch = new THREE.Mesh(keep(new THREE.TorusGeometry(4.2, 0.14, 12, 48, Math.PI)), archMat); arch.position.set(0, 1.0, -1.3); stage.add(arch);
  const arch2 = new THREE.Mesh(keep(new THREE.TorusGeometry(3.5, 0.08, 10, 48, Math.PI)), keep(new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x8b5cf6, emissiveIntensity: 2.4 })));
  arch2.position.set(0, 1.0, -1.3); stage.add(arch2);
  [-4.4, 4.4].forEach((sx) => {
    const col = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.1, 0.1, 5.4, 8)), trimMat); col.position.set(sx, 3.2, -1.3); stage.add(col);
    for (let k = 0; k < 3; k++) {
      const sp = new THREE.Mesh(keep(new THREE.BoxGeometry(0.9, 1.1, 0.9)), roofMat); sp.position.set(sx * 1.12, 0.55 + 1.1 * k + 0.7, 0.6); sp.scale.setScalar(1 - k * 0.12); stage.add(sp);
    }
  });
  const truss = new THREE.Mesh(keep(new THREE.BoxGeometry(9.2, 0.22, 0.22)), trimMat); truss.position.set(0, 5.4, -0.2); stage.add(truss);
  const beamMat = [0xff4fa3, 0x8b5cf6, 0x22d3ee, 0xff4fa3, 0x8b5cf6].map((c) => keep(new THREE.MeshBasicMaterial({
    color: c, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false,
  })));
  const beamGeo = keep(new THREE.ConeGeometry(1.3, 26, 24, 1, true)); beamGeo.rotateX(Math.PI); beamGeo.translate(0, 13, 0);
  const beams = beamMat.map((m, i) => {
    const b = new THREE.Mesh(beamGeo, m); b.position.set(-3.6 + i * 1.8, 5.3, -0.2); stage.add(b); return b;
  });
  const stageGlow = new THREE.Sprite(keep(new THREE.SpriteMaterial({
    map: keep(glowTexture(THREE, [[0, 'rgba(255,90,180,0.9)'], [0.4, 'rgba(139,92,246,0.35)'], [1, 'rgba(0,0,0,0)']])),
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false,
  })));
  stageGlow.scale.set(16, 9, 1); stageGlow.position.set(0, 3, 0.2); stage.add(stageGlow);
  const stageLight = new THREE.PointLight(M.rim, 60, 26, 1.6); stageLight.position.set(0, 4, 3); stage.add(stageLight);
  // crowd
  {
    const n = 240; const p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { p[i * 3] = (rnd() - 0.5) * 12; p[i * 3 + 1] = 0.3 + rnd() * 0.5; p[i * 3 + 2] = 3.5 + rnd() * 4.5; }
    const g = keep(new THREE.BufferGeometry()); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const cm = keep(new THREE.PointsMaterial({ color: 0xffd9b0, size: 0.12, transparent: true, opacity: 0.85 }));
    stage.add(new THREE.Points(g, cm));
  }

  /* ───── ferris wheel ───── */
  const wheelRoot = new THREE.Group(); wheelRoot.position.set(LAND.wheel[0], 0, LAND.wheel[1]); scene.add(wheelRoot);
  const R = 5.4; const hubY = R + 1.4;
  const wheel = new THREE.Group(); wheel.position.y = hubY; wheelRoot.add(wheel);
  const rimMat = keep(new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x8b5cf6, emissiveIntensity: 1.8, metalness: 0.3, roughness: 0.3 }));
  [-0.55, 0.55].forEach((zz) => { const t = new THREE.Mesh(keep(new THREE.TorusGeometry(R, 0.07, 8, 72)), rimMat); t.position.z = zz; wheel.add(t); });
  const spokeG = keep(new THREE.BoxGeometry(R * 2, 0.05, 0.05));
  for (let i = 0; i < 8; i++) [-0.55, 0.55].forEach((zz) => { const s = new THREE.Mesh(spokeG, trimMat); s.rotation.z = (i / 8) * Math.PI; s.position.z = zz; wheel.add(s); });
  const hub = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.35, 0.35, 1.5, 16)), trimMat); hub.rotation.x = Math.PI / 2; wheel.add(hub);
  const gondolas = [];
  const gG = keep(new THREE.BoxGeometry(0.75, 0.6, 0.7));
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const holder = new THREE.Group(); holder.position.set(Math.cos(a) * R, Math.sin(a) * R, 0);
    const c = new THREE.Color(BRAND[i % BRAND.length]);
    const gm = keep(new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.9, metalness: 0.2, roughness: 0.4 }));
    const g = new THREE.Mesh(gG, gm); g.position.y = -0.42; holder.add(g); wheel.add(holder); gondolas.push(holder);
  }
  {
    const n = 48; const p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; p[i * 3] = Math.cos(a) * R; p[i * 3 + 1] = Math.sin(a) * R; p[i * 3 + 2] = 0.62; }
    const g = keep(new THREE.BufferGeometry()); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const lm = keep(new THREE.PointsMaterial({
      size: 0.5, map: keep(glowTexture(THREE, [[0, 'rgba(255,255,255,1)'], [0.35, 'rgba(255,214,150,0.7)'], [1, 'rgba(0,0,0,0)']], 64)),
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, color: 0xffe0b0,
    }));
    wheel.add(new THREE.Points(g, lm));
  }
  [-1, 1].forEach((s) => {
    const len = Math.hypot(2.6, hubY);
    const leg = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.1, 0.16, len, 8)), trimMat);
    leg.position.set(s * 1.3, hubY / 2, 0); leg.rotation.z = -s * Math.atan2(2.6, hubY); wheelRoot.add(leg);
  });

  /* ───── big-top tent ───── */
  const tentRoot = new THREE.Group(); tentRoot.position.set(LAND.tent[0], 0, LAND.tent[1]); scene.add(tentRoot);
  const st = keep(stripeTexture(THREE));
  const tentMat = keep(new THREE.MeshStandardMaterial({ map: st, emissive: 0x7a66ff, emissiveMap: st, emissiveIntensity: 0.32, roughness: 0.7, metalness: 0 }));
  const tb = new THREE.Mesh(keep(new THREE.CylinderGeometry(2.5, 2.5, 1.6, 32, 1, true)), tentMat); tb.position.y = 0.8; tentRoot.add(tb);
  const tc = new THREE.Mesh(keep(new THREE.ConeGeometry(2.8, 2.0, 32, 1, true)), tentMat); tc.position.y = 2.6; tentRoot.add(tc);
  const pole = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.04, 0.04, 1.6, 6)), trimMat); pole.position.y = 4.4; tentRoot.add(pole);
  const flag = new THREE.Mesh(keep(new THREE.PlaneGeometry(0.9, 0.5)), keep(new THREE.MeshBasicMaterial({ color: 0xff4fa3, side: THREE.DoubleSide })));
  flag.position.set(0.45, 4.9, 0); tentRoot.add(flag);
  const door = new THREE.Sprite(keep(new THREE.SpriteMaterial({
    map: keep(glowTexture(THREE, [[0, 'rgba(255,200,130,1)'], [0.5, 'rgba(255,150,100,0.35)'], [1, 'rgba(0,0,0,0)']])),
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false,
  })));
  door.scale.set(4.5, 3.2, 1); door.position.set(0, 0.9, 2.4); tentRoot.add(door);
  const tentLight = new THREE.PointLight(0xffb070, 22, 14, 1.8); tentLight.position.set(0, 1.4, 1.5); tentRoot.add(tentLight);

  /* ───── arena ───── */
  const arena = new THREE.Group(); arena.position.set(LAND.arena[0], 0, LAND.arena[1]); scene.add(arena);
  const abody = new THREE.Mesh(keep(new THREE.CylinderGeometry(5.6, 6.2, 3.2, 40)), keep(new THREE.MeshStandardMaterial({ color: 0x262c68, metalness: 0.6, roughness: 0.4, emissive: 0x1a2070, emissiveIntensity: 0.18 })));
  abody.position.y = 1.6; arena.add(abody);
  const aring = new THREE.Mesh(keep(new THREE.TorusGeometry(5.7, 0.12, 8, 72)), keep(new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x22d3ee, emissiveIntensity: 2.4 })));
  aring.rotation.x = Math.PI / 2; aring.position.y = 3.2; arena.add(aring);
  const adome = new THREE.Mesh(keep(new THREE.SphereGeometry(5.0, 36, 16, 0, Math.PI * 2, 0, Math.PI / 2)), keep(new THREE.MeshPhysicalMaterial({
    color: 0x9ab0ff, metalness: 0.2, roughness: 0.1, transmission: 0, transparent: true, opacity: 0.55, emissive: 0x4c58ff, emissiveIntensity: 0.4, envMapIntensity: 1.4,
  })));
  adome.scale.y = 0.55; adome.position.y = 3.2; arena.add(adome);

  /* ───── balloons ───── */
  const balloons = [];
  const bGeo = keep(new THREE.SphereGeometry(0.5, 20, 16));
  const anchor = new THREE.Vector3(-2.3, 0.4, -3.2);
  const strGeo = keep(new THREE.BufferGeometry());
  const strPos = new Float32Array(16 * 6);
  for (let i = 0; i < 16; i++) {
    const c = new THREE.Color(BRAND[i % BRAND.length]);
    const m = new THREE.Mesh(bGeo, keep(new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.35, roughness: 0.22, metalness: 0.05 })));
    m.scale.set(1, 1.18, 1);
    const len = 4.5 + rnd() * 4; const ang = (rnd() - 0.5) * 0.9; const ph = rnd() * 6;
    balloons.push({ m, len, ang, ph, zz: (rnd() - 0.5) * 1.6 }); scene.add(m);
  }
  strGeo.setAttribute('position', new THREE.BufferAttribute(strPos, 3));
  const strings = new THREE.LineSegments(strGeo, keep(new THREE.LineBasicMaterial({ color: 0xcfd2ff, transparent: true, opacity: 0.5 })));
  strings.frustumCulled = false; scene.add(strings);

  /* ───── string lights across the foreground ───── */
  {
    const pts = []; const cols = [];
    const poleG = keep(new THREE.CylinderGeometry(0.06, 0.08, 5.4, 6));
    const xs = []; for (let x = -34; x <= 34; x += 8.5) xs.push(x);
    xs.forEach((x) => { const pl = new THREE.Mesh(poleG, trimMat); pl.position.set(x, 2.7, 3.2); scene.add(pl); });
    for (let i = 0; i < xs.length - 1; i++) {
      for (let k = 0; k <= 14; k++) {
        const u = k / 14; const x = xs[i] + (xs[i + 1] - xs[i]) * u;
        pts.push(x, 5.3 - Math.sin(u * Math.PI) * 0.95, 3.2);
        const c = new THREE.Color(M.warm[(i + k) % M.warm.length]); cols.push(c.r, c.g, c.b);
      }
    }
    const n = pts.length / 3;
    const bulbGeo = keep(new THREE.SphereGeometry(0.11, 8, 8));
    var bulbMat = keep(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
    var stringLights = new THREE.InstancedMesh(bulbGeo, bulbMat, n);
    const m4 = new THREE.Matrix4(); const col = new THREE.Color();
    for (let i = 0; i < n; i++) {
      m4.makeTranslation(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]); stringLights.setMatrixAt(i, m4);
      col.setRGB(cols[i * 3], cols[i * 3 + 1], cols[i * 3 + 2]).multiplyScalar(1.6); stringLights.setColorAt(i, col);
    }
    stringLights.frustumCulled = false; scene.add(stringLights);
    const wire = new THREE.Line(keep(new THREE.BufferGeometry().setFromPoints(Array.from({ length: n }, (_, i) => new THREE.Vector3(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2])))), keep(new THREE.LineBasicMaterial({ color: 0x20224a })));
    scene.add(wire);
    var halo = new THREE.Points(keep(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)).setAttribute('color', new THREE.Float32BufferAttribute(cols, 3))), keep(new THREE.PointsMaterial({
      size: 1.4, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55,
      map: keep(glowTexture(THREE, [[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(255,255,255,0.5)'], [1, 'rgba(0,0,0,0)']], 64)),
    })));
    scene.add(halo);
  }

  /* ───── confetti ───── */
  const CN = 170; const cp = new Float32Array(CN * 3); const cc = new Float32Array(CN * 3); const cv = [];
  for (let i = 0; i < CN; i++) {
    cp[i * 3] = -16 + rnd() * 26; cp[i * 3 + 1] = rnd() * 14; cp[i * 3 + 2] = -9 + rnd() * 10;
    const c = new THREE.Color(BRAND[i % BRAND.length]); cc[i * 3] = c.r; cc[i * 3 + 1] = c.g; cc[i * 3 + 2] = c.b;
    cv.push({ vy: 0.35 + rnd() * 0.6, ph: rnd() * 6, amp: 0.2 + rnd() * 0.5 });
  }
  const cg = keep(new THREE.BufferGeometry());
  cg.setAttribute('position', new THREE.BufferAttribute(cp, 3)); cg.setAttribute('color', new THREE.BufferAttribute(cc, 3));
  const confetti = new THREE.Points(cg, keep(new THREE.PointsMaterial({ size: 0.15, vertexColors: true, transparent: true, opacity: 0.95 })));
  scene.add(confetti);

  /* ───── searchlights ───── */
  const slMat = keep(new THREE.MeshBasicMaterial({ color: 0xaec4ff, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  const slGeo = keep(new THREE.ConeGeometry(1.8, 70, 20, 1, true)); slGeo.rotateX(Math.PI); slGeo.translate(0, 35, 0);
  const searchlights = [[-26, -34], [30, -40]].map(([x, z]) => { const s = new THREE.Mesh(slGeo, slMat); s.position.set(x, 18, z); scene.add(s); return s; });

  /* ───── tower cranes (dawn) ───── */
  const cranes = [];
  const craneMat = keep(new THREE.MeshStandardMaterial({ color: 0xffb02e, metalness: 0.35, roughness: 0.5, emissive: 0x6a3a00, emissiveIntensity: 0.35 }));
  for (let i = 0; i < M.cranes; i++) {
    const cx = [-30, 20, 40][i]; const cz = [-24, -28, -20][i]; const ch = 22 + i * 4;
    const root = new THREE.Group(); root.position.set(cx, 0, cz); scene.add(root);
    const mast = new THREE.Mesh(keep(new THREE.BoxGeometry(0.5, ch, 0.5)), craneMat); mast.position.y = ch / 2; root.add(mast);
    for (let k = 0; k < ch; k += 2) {
      const x1 = new THREE.Mesh(keep(new THREE.BoxGeometry(0.9, 0.08, 0.08)), craneMat); x1.position.set(0, k, 0); x1.rotation.z = (k % 4 ? 1 : -1) * 0.6; root.add(x1);
    }
    const top = new THREE.Group(); top.position.y = ch; root.add(top);
    const jib = new THREE.Mesh(keep(new THREE.BoxGeometry(18, 0.35, 0.35)), craneMat); jib.position.x = 5; top.add(jib);
    const cj = new THREE.Mesh(keep(new THREE.BoxGeometry(6, 0.35, 0.35)), craneMat); cj.position.x = -6; top.add(cj);
    const wgt = new THREE.Mesh(keep(new THREE.BoxGeometry(1.6, 1.2, 1.2)), roofMat); wgt.position.set(-8.4, -0.7, 0); top.add(wgt);
    const cab = new THREE.Mesh(keep(new THREE.BoxGeometry(1.2, 1, 1)), craneMat); cab.position.set(0.8, 0.8, 0); top.add(cab);
    const cable = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.03, 0.03, 8, 4)), trimMat); cable.position.set(11, -4, 0); top.add(cable);
    const hook = new THREE.Mesh(keep(new THREE.BoxGeometry(0.8, 0.5, 0.8)), craneMat); hook.position.set(11, -8.2, 0); top.add(hook);
    const bl = new THREE.Mesh(keep(new THREE.SphereGeometry(0.22, 8, 8)), blinkMat); bl.position.y = 1.6; top.add(bl); blinkers.push({ m: bl, ph: i });
    cranes.push({ top, ph: i * 2, sp: 0.07 + i * 0.015 });
  }

  /* ───── camera ───── */
  camera.position.set(0, CAM.y, CAM.z); camera.lookAt(0, CAM.ly, CAM.lz);
  const look = new THREE.Vector3(0, CAM.ly, CAM.lz);
  const dummy = new THREE.Vector3();

  return {
    camera,
    resize(w, h) {
      const a = w / h; camera.fov = a < 1 ? CAM.fov + 26 : a < 1.5 ? CAM.fov + 12 : CAM.fov; camera.updateProjectionMatrix();
    },
    update(t, dt, { pointer, progress, reduce }) {
      // growth: the city rises on load
      risers.forEach((r) => { const k = easeOut(clamp((t - 0.15 - r.delay) / 1.8)); r.g.scale.y = Math.max(0.001, k); r.g.visible = k > 0.001; });
      // camera drift + dolly with scroll
      const drift = reduce ? 0 : Math.sin(t * 0.07) * 3.2;
      camera.position.x += ((drift + pointer.x * 3.2) - camera.position.x) * 0.06;
      camera.position.y += ((CAM.y + pointer.y * 0.8 + progress * 1.2) - camera.position.y) * 0.06;
      camera.position.z = CAM.z - progress * 4;
      dummy.set(look.x + camera.position.x * -0.15, look.y, look.z); camera.lookAt(dummy);
      // wheel
      wheel.rotation.z = -t * 0.1;
      gondolas.forEach((g) => { g.rotation.z = t * 0.1; });
      // stage
      led.offset.x = (t * 0.06) % 1;
      beams.forEach((b, i) => { b.rotation.z = Math.sin(t * 0.55 + i * 1.2) * 0.45 + (i - 2) * 0.12; b.rotation.x = Math.cos(t * 0.4 + i) * 0.18; });
      beamMat.forEach((m, i) => { m.opacity = 0.11 + Math.sin(t * 1.3 + i * 1.7) * 0.05; });
      stageLight.intensity = 55 + Math.sin(t * 2.2) * 8;
      archMat.emissiveIntensity = 2.1 + Math.sin(t * 1.8) * 0.4;
      // balloons
      for (let i = 0; i < balloons.length; i++) {
        const b = balloons[i];
        const sway = Math.sin(t * 0.6 + b.ph) * 0.35;
        const bx = anchor.x + Math.sin(b.ang + sway) * b.len * 0.45;
        const by = anchor.y + Math.cos(b.ang * 0.6) * b.len + Math.sin(t * 0.9 + b.ph) * 0.18;
        b.m.position.set(bx, by, anchor.z + b.zz);
        strPos[i * 6] = anchor.x; strPos[i * 6 + 1] = anchor.y; strPos[i * 6 + 2] = anchor.z + b.zz * 0.3;
        strPos[i * 6 + 3] = bx; strPos[i * 6 + 4] = by - 0.55; strPos[i * 6 + 5] = anchor.z + b.zz;
      }
      strGeo.attributes.position.needsUpdate = true;
      // confetti
      for (let i = 0; i < CN; i++) {
        const v = cv[i];
        cp[i * 3 + 1] -= v.vy * dt; cp[i * 3] += Math.sin(t * 1.3 + v.ph) * v.amp * dt;
        if (cp[i * 3 + 1] < 0.2) cp[i * 3 + 1] = 14;
      }
      cg.attributes.position.needsUpdate = true;
      // lights, blinkers, searchlights
      halo.material.opacity = 0.5 + Math.sin(t * 2.6) * 0.1;
      blinkers.forEach((b) => { b.m.visible = Math.sin(t * 2.2 + b.ph * 3) > -0.2; });
      searchlights.forEach((s, i) => { s.rotation.z = Math.sin(t * 0.35 + i * 2) * 0.5 * (i ? -1 : 1); s.rotation.x = Math.cos(t * 0.3 + i) * 0.25; });
      cranes.forEach((c) => { c.top.rotation.y = Math.sin(t * c.sp + c.ph) * 0.7; });
      flag.rotation.y = Math.sin(t * 3) * 0.4;
    },
    dispose() {
      disposables.forEach((d) => d.dispose?.());
      tex.map.dispose(); tex.emissive.dispose();
    },
  };
}

/* ───────────────────────────── flat fallback ───────────────────────────── */
export function CityFallback({ mood = 'night' }) {
  const M = MOODS[mood] || MOODS.night; const r = rng(11);
  const bars = []; let x = 0;
  while (x < 1200) { const w = 18 + r() * 38; const h = 50 + r() * 190 * (1 - Math.abs(x - 600) / 900); bars.push({ x, w, h }); x += w + 3; }
  return (
    <svg viewBox="0 0 1200 320" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full">
      <defs><linearGradient id={`cf-${mood}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={M.sky[0]} /><stop offset="0.6" stopColor={M.sky[2]} /><stop offset="1" stopColor={M.sky[3]} /></linearGradient></defs>
      <rect width="1200" height="320" fill={`url(#cf-${mood})`} />
      {bars.map((b, i) => <rect key={i} x={b.x} y={320 - b.h} width={b.w} height={b.h} fill="#0b0d2c" />)}
    </svg>
  );
}

/* ───────────────────────────── host component ───────────────────────────── */
export default function CityScene3D({ mood = 'night', view = 'wide', seed = 7, className = '', style, minWidth = 0, dpr = 1.6 }) {
  const hostRef = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    let disposed = false; let raf = 0; let cleanup = () => {};
    const tier = () => document.documentElement.getAttribute('data-perf');
    const reduce = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (tier() === 'low' || window.innerWidth < minWidth) { setFailed(true); return undefined; }

    (async () => {
      let lib;
      try { lib = await loadThree(); } catch { if (!disposed) setFailed(true); return; }
      if (disposed) return;
      const { THREE, RoomEnvironment } = lib;
      let renderer;
      try { renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); } catch { setFailed(true); return; }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dpr));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      const canvas = renderer.domElement;
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none';
      host.appendChild(canvas);

      const scene = new THREE.Scene();
      const pm = new THREE.PMREMGenerator(renderer);
      const envScene = new RoomEnvironment();
      const envTex = pm.fromScene(envScene, 0.04).texture;
      scene.environment = envTex;
      const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 400);
      const api = buildCity({ THREE, scene, camera, renderer, seed, mood, view }) || {};

      const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
      const onMove = (e) => {
        const r = host.getBoundingClientRect();
        pointer.tx = clamp((e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2), -1, 1);
        pointer.ty = clamp(-((e.clientY - (r.top + r.height / 2)) / (window.innerHeight / 2)), -1, 1);
      };
      window.addEventListener('pointermove', onMove, { passive: true });

      let w = 0; let h = 0;
      const resize = () => {
        w = host.clientWidth; h = host.clientHeight; if (!w || !h) return;
        renderer.setSize(w, h, false); camera.aspect = w / h; api.resize?.(w, h);
        camera.updateProjectionMatrix();
      };
      const ro = new ResizeObserver(() => { resize(); if (!raf) draw(performance.now()); });
      ro.observe(host); resize();

      let visible = true; const t0 = performance.now(); let last = t0;
      const progress = () => { const r = host.getBoundingClientRect(); return clamp((window.innerHeight - r.top) / (window.innerHeight + r.height)); };
      function draw(now) {
        raf = 0; if (disposed) return;
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        const t = reduce ? 30 : (now - t0) / 1000;
        pointer.x += (pointer.tx - pointer.x) * 0.06; pointer.y += (pointer.ty - pointer.y) * 0.06;
        if (w && h) { api.update?.(t, dt, { pointer, progress: progress(), reduce }); renderer.render(scene, camera); }
        if (visible && !document.hidden && !reduce && tier() !== 'low') raf = requestAnimationFrame(draw);
      }
      const io = new IntersectionObserver(([e]) => {
        visible = e.isIntersecting;
        if (visible && !raf) { last = performance.now(); raf = requestAnimationFrame(draw); }
      }, { rootMargin: '120px' });
      io.observe(host);
      const onPerf = () => { if (tier() === 'low') setFailed(true); };
      const onLost = (e) => { e.preventDefault(); setFailed(true); };
      window.addEventListener('perfchange', onPerf);
      canvas.addEventListener('webglcontextlost', onLost);
      draw(performance.now());

      cleanup = () => {
        cancelAnimationFrame(raf); raf = 0; io.disconnect(); ro.disconnect();
        window.removeEventListener('pointermove', onMove); window.removeEventListener('perfchange', onPerf);
        canvas.removeEventListener('webglcontextlost', onLost);
        api.dispose?.();
        scene.traverse((o) => { o.geometry?.dispose?.(); });
        envTex.dispose(); pm.dispose(); renderer.dispose();
        try { renderer.forceContextLoss(); } catch { /* ignore */ }
        canvas.remove();
      };
      if (disposed) cleanup();
    })();

    return () => { disposed = true; cleanup(); };
  }, [mood, view, seed, dpr, minWidth]);

  return (
    <div ref={hostRef} aria-hidden="true" className={className} style={{ position: 'absolute', pointerEvents: 'none', ...style }}>
      {failed ? <CityFallback mood={mood} /> : null}
    </div>
  );
}
