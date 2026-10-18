/**
 * frontend/src/components/liquid/Scenes3D.jsx
 *
 * Real-time WebGL (three.js) renders for the Home and Careers pages. three is loaded lazily, so nothing here
 * costs the first paint; each scene sleeps when off-screen, freezes for reduced motion, and falls back to the
 * hand-drawn SVG/CSS scene when WebGL is unavailable or the page is on the "low" performance tier.
 *
 *   Blob3D        liquid-glass bubble: transmission + iridescence, morphing, pointer-reactive
 *   Lotus3D       translucent lotus that blooms petal by petal, with drifting petals + stamen glow
 *   Island3D      mossy floating rock with crystals, cosmos and roses in warm light
 *   PageFloaters  gems / rings / bubbles that float in the page margins and move with the scroll
 */
import { useEffect, useMemo, useRef, useState } from 'react';

let threePromise;
function loadThree() {
  if (!threePromise) {
    threePromise = Promise.all([
      import('three'),
      import('three/examples/jsm/environments/RoomEnvironment.js'),
      import('three/examples/jsm/utils/BufferGeometryUtils.js'),
    ]).then(([THREE, env, utils]) => ({ THREE, RoomEnvironment: env.RoomEnvironment, mergeVertices: utils.mergeVertices }));
  }
  return threePromise;
}

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (x) => 1 - Math.pow(1 - x, 3);
const backOut = (x) => { const c1 = 1.4; const c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
function rng(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function glowTexture(THREE, stops) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  stops.forEach(([o, col]) => gr.addColorStop(o, col));
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/* ───────────────────────── shared canvas host ───────────────────────── */
export function Scene3D({ build, fallback = null, className = '', style, fov = 32, dpr = 1.75, minWidth = 0 }) {
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
      const { THREE, RoomEnvironment, mergeVertices } = lib;
      let renderer;
      try {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      } catch { setFailed(true); return; }
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dpr));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.setClearColor(0x000000, 0);
      const canvas = renderer.domElement;
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none';
      host.appendChild(canvas);

      const scene = new THREE.Scene();
      const pm = new THREE.PMREMGenerator(renderer);
      const envScene = new RoomEnvironment();
      const envTex = pm.fromScene(envScene, 0.04).texture;
      scene.environment = envTex;
      let camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 200);
      const api = build({ THREE, scene, camera, renderer, env: envTex, mergeVertices, host }) || {};
      if (api.camera) camera = api.camera;

      const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
      const onMove = (e) => {
        const r = host.getBoundingClientRect();
        pointer.tx = clamp(((e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2)), -1, 1);
        pointer.ty = clamp(-((e.clientY - (r.top + r.height / 2)) / (window.innerHeight / 2)), -1, 1);
      };
      window.addEventListener('pointermove', onMove, { passive: true });

      let w = 0; let h = 0;
      const resize = () => {
        w = host.clientWidth; h = host.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        if (camera.isPerspectiveCamera) { camera.aspect = w / h; camera.updateProjectionMatrix(); }
        api.resize?.(w, h, camera);
      };
      const ro = new ResizeObserver(() => { resize(); if (!raf) draw(performance.now()); });
      ro.observe(host);
      resize();

      let visible = true; const t0 = performance.now(); let last = t0;
      const progress = () => {
        const r = host.getBoundingClientRect();
        return clamp((window.innerHeight - r.top) / (window.innerHeight + r.height));
      };
      function draw(now) {
        raf = 0;
        if (disposed) return;
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        const t = reduce ? 30 : (now - t0) / 1000;
        pointer.x += (pointer.tx - pointer.x) * 0.06; pointer.y += (pointer.ty - pointer.y) * 0.06;
        if (w && h) {
          const active = api.update?.(t, dt, { pointer, progress: progress(), reduce, w, h });
          if (active !== false) renderer.render(scene, camera);
        }
        if (visible && !document.hidden && !reduce && tier() !== 'low') raf = requestAnimationFrame(draw);
      }
      const io = new IntersectionObserver(([e]) => {
        visible = e.isIntersecting;
        if (visible && !raf) { last = performance.now(); raf = requestAnimationFrame(draw); }
      }, { rootMargin: '120px' });
      io.observe(host);
      const onPerf = () => { if (tier() === 'low') { setFailed(true); } };
      const onLost = (e) => { e.preventDefault(); setFailed(true); };
      window.addEventListener('perfchange', onPerf);
      canvas.addEventListener('webglcontextlost', onLost);
      draw(performance.now());

      cleanup = () => {
        cancelAnimationFrame(raf); raf = 0;
        io.disconnect(); ro.disconnect();
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('perfchange', onPerf);
        canvas.removeEventListener('webglcontextlost', onLost);
        api.dispose?.();
        scene.traverse((o) => {
          o.geometry?.dispose?.();
          const m = o.material; if (m) (Array.isArray(m) ? m : [m]).forEach((x) => { x.map?.dispose?.(); x.dispose?.(); });
        });
        envTex.dispose(); pm.dispose(); envScene.dispose?.();
        renderer.dispose();
        try { renderer.forceContextLoss(); } catch { /* ignore */ }
        canvas.remove();
      };
      if (disposed) cleanup();
    })();

    return () => { disposed = true; cleanup(); };
  }, [build, fov, dpr, minWidth]);

  return <div ref={hostRef} aria-hidden="true" className={className} style={{ position: 'absolute', pointerEvents: 'none', ...style }}>{failed ? fallback : null}</div>;
}

/* ───────────────────────── Blob (liquid glass bubble) ───────────────────────── */
function buildBlob({ THREE, scene, camera, mergeVertices }) {
  camera.position.set(0, 0, 9.4);
  let geo = new THREE.IcosahedronGeometry(1.5, 28);
  geo.deleteAttribute('normal'); geo.deleteAttribute('uv');
  geo = mergeVertices(geo, 1e-4);
  const pos = geo.attributes.position;
  const base = pos.array.slice();
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x161c3a, roughness: 0.05, metalness: 0, transmission: 1, thickness: 2.2, ior: 1.45,
    iridescence: 1, iridescenceIOR: 1.6, iridescenceThicknessRange: [180, 820], clearcoat: 1, clearcoatRoughness: 0.04,
    attenuationColor: new THREE.Color(0x3446b8), attenuationDistance: 2.4, envMapIntensity: 2.6, specularIntensity: 1,
  });
  // thin-film colour: iridescent fresnel (blue / violet / amber) painted into the emissive term
  const uTime = { value: 0 };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = uTime;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      {
        vec3 nv = normalize(vNormal); vec3 vv = normalize(vViewPosition);
        float fr = pow(1.0 - abs(dot(nv, vv)), 2.2);
        vec3 film = 0.5 + 0.5 * cos(6.28318 * (fr * 1.1 + vec3(0.0, 0.33, 0.67) + uTime * 0.03 + nv.y * 0.25));
        float below = smoothstep(0.1, -0.7, nv.y);
        float above = smoothstep(0.0, 0.85, nv.y) * smoothstep(0.4, -0.6, nv.x);
        totalEmissiveRadiance += film * fr * 1.25;
        totalEmissiveRadiance += vec3(0.12, 0.34, 1.0) * below * 0.5 * (0.35 + fr);
        totalEmissiveRadiance += vec3(1.0, 0.68, 0.28) * above * 0.55 * (0.3 + fr);
        totalEmissiveRadiance += vec3(1.0, 0.92, 0.8) * pow(fr, 5.0) * 1.6;
      }`);
  };
  const mesh = new THREE.Mesh(geo, mat);
  scene.add(mesh);

  // a soft blue-to-amber core inside the glass for it to refract
  const back = new THREE.Group(); scene.add(back);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.78, 40, 40), new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color(1.7, 1.7, 1.7), toneMapped: false }));
  const cp = core.geometry.attributes.position; const cc = new Float32Array(cp.count * 3); const ca = new THREE.Color(0x2f6bff); const cb = new THREE.Color(0xffb04a); const cm = new THREE.Color();
  for (let i = 0; i < cp.count; i++) { const k = clamp((cp.getY(i) + cp.getX(i) * 0.6) / 1.6 + 0.5); cm.copy(ca).lerp(cb, k * k); cc[i * 3] = cm.r; cc[i * 3 + 1] = cm.g; cc[i * 3 + 2] = cm.b; }
  core.geometry.setAttribute('color', new THREE.BufferAttribute(cc, 3)); core.position.set(0.05, -0.1, 0); back.add(core);
  const rs = rng(3); const sp = new Float32Array(420 * 3);
  for (let i = 0; i < 420; i++) { sp[i * 3] = (rs() - 0.5) * 18; sp[i * 3 + 1] = (rs() - 0.5) * 11; sp[i * 3 + 2] = -3 - rs() * 5; }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  back.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.035, transparent: true, opacity: 0.85, depthWrite: false })));

  scene.environmentIntensity = 0.9;
  const key = new THREE.DirectionalLight(0xffc27a, 3.2); key.position.set(-4, 3, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0x7aa2ff, 2.4); rim.position.set(4, -2, 3); scene.add(rim);
  const top = new THREE.DirectionalLight(0xffffff, 1.6); top.position.set(0, 5, 2); scene.add(top);

  return {
    update(t, dt, { pointer }) {
      uTime.value = t;
      const a = pos.array;
      for (let i = 0; i < pos.count; i++) {
        const x = base[i * 3] / 1.5; const y = base[i * 3 + 1] / 1.5; const z = base[i * 3 + 2] / 1.5;
        const d = 0.16 * Math.sin(x * 2.1 + t * 0.55) * Math.cos(y * 2.4 - t * 0.45) + 0.11 * Math.sin(z * 3.1 + t * 0.7 + x) + 0.045 * Math.sin(y * 5 + t * 1.1 + z * 2);
        const r = 1.5 * (1 + d);
        a[i * 3] = x * r; a[i * 3 + 1] = y * r; a[i * 3 + 2] = z * r;
      }
      pos.needsUpdate = true; geo.computeVertexNormals();
      mesh.rotation.y = t * 0.1 + pointer.x * 0.5; mesh.rotation.x = Math.sin(t * 0.3) * 0.12 + pointer.y * 0.3;
      mesh.position.y = Math.sin(t * 0.7) * 0.12;
      back.rotation.y = t * 0.2; back.position.y = mesh.position.y;
    },
  };
}
export function Blob3D({ className = '', style, fallback }) {
  return <Scene3D build={buildBlob} fov={30} className={className} style={style} fallback={fallback} />;
}

/* ───────────────────────── Lotus ───────────────────────── */
function petalGeometry(THREE, L, W) {
  const g = new THREE.PlaneGeometry(1, 1, 8, 18);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) * 2; const s = p.getY(i) + 0.5;
    const wp = Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(s, 0.62))), 0.85) * W;
    p.setXYZ(i, u * wp, s * L, -(u * u) * 0.2 * wp + Math.pow(s, 2.5) * L * 0.12);
  }
  g.computeVertexNormals();
  return g;
}

function buildLotus({ THREE, scene, camera }) {
  camera.position.set(0, 1.7, 8.6); camera.lookAt(0, 0.65, 0);
  scene.environmentIntensity = 0.7;
  const flower = new THREE.Group(); flower.position.y = -0.4; scene.add(flower);
  const rings = [
    { n: 8, tilt: 1.42, L: 1.7, W: 0.52, col: 0xb69cff, em: 0x5b3fd0 }, { n: 7, tilt: 1.05, L: 1.55, W: 0.54, col: 0xff8fbd, em: 0xd0407a },
    { n: 6, tilt: 0.74, L: 1.36, W: 0.52, col: 0xff7aa8, em: 0xd0507a }, { n: 5, tilt: 0.46, L: 1.15, W: 0.48, col: 0xffa98a, em: 0xd0703a },
    { n: 4, tilt: 0.2, L: 0.92, W: 0.42, col: 0xffd0ae, em: 0xd0a070 },
  ];
  const pivots = [];
  rings.forEach((r, ri) => {
    const geo = petalGeometry(THREE, r.L, r.W);
    const mat = new THREE.MeshPhysicalMaterial({
      color: r.col, emissive: r.em, emissiveIntensity: 0.06, roughness: 0.3, metalness: 0, transmission: 0.25, thickness: 0.5, ior: 1.3,
      iridescence: 0.9, iridescenceIOR: 1.3, iridescenceThicknessRange: [120, 520], side: THREE.DoubleSide, envMapIntensity: 0.7, clearcoat: 0.5,
    });
    for (let i = 0; i < r.n; i++) {
      const pv = new THREE.Object3D(); pv.rotation.order = 'YXZ'; pv.rotation.y = (i / r.n) * Math.PI * 2 + ri * 0.4;
      pv.position.y = ri * 0.025;
      pv.add(new THREE.Mesh(geo, mat));
      pv.userData = { tilt: r.tilt, delay: 0.3 + ri * 0.3 + i * 0.035, ph: Math.random() * 6 };
      pv.rotation.x = 0.04; flower.add(pv); pivots.push(pv);
    }
  });
  // stamens
  const gold = new THREE.MeshStandardMaterial({ color: 0xffd27a, emissive: 0xffb43a, emissiveIntensity: 1.4, roughness: 0.4 });
  const pistil = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.36, 14), gold); pistil.position.y = 0.32; flower.add(pistil);
  const sr = rng(11); const stamens = new THREE.Group(); flower.add(stamens);
  for (let i = 0; i < 34; i++) {
    const a = sr() * Math.PI * 2; const rr = 0.14 + sr() * 0.3;
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 10), gold);
    s.position.set(Math.cos(a) * rr, 0.22 + sr() * 0.26, Math.sin(a) * rr); stamens.add(s);
  }
  const glowTex = glowTexture(THREE, [[0, 'rgba(255,170,120,0.9)'], [0.35, 'rgba(255,110,170,0.35)'], [1, 'rgba(255,110,170,0)']]);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 }));
  glow.scale.set(4.6, 4.6, 1); glow.position.set(0, 0.6, -0.8); scene.add(glow);
  const inner = new THREE.PointLight(0xff9a80, 8, 6, 1.6); inner.position.set(0, 0.7, 0); flower.add(inner);
  const key = new THREE.DirectionalLight(0xffe0d0, 1.0); key.position.set(-3, 5, 5); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fb0ff, 1.4); rim.position.set(4, 2, -3); scene.add(rim);

  // drifting loose petals
  const loose = []; const lg = petalGeometry(THREE, 0.62, 0.22);
  const lm = new THREE.MeshPhysicalMaterial({ color: 0xffa8c8, emissive: 0xd0407a, emissiveIntensity: 0.25, roughness: 0.2, transmission: 0.3, thickness: 0.3, side: THREE.DoubleSide, iridescence: 0.8, envMapIntensity: 1.2 });
  for (let i = 0; i < 9; i++) {
    const m = new THREE.Mesh(lg, lm); const q = rng(40 + i);
    m.userData = { x: (q() - 0.5) * 5.6, z: (q() - 0.3) * 3, sp: 0.16 + q() * 0.14, off: q() * 10, sw: 0.4 + q() * 0.7, rs: 0.4 + q() * 0.9, sc: 0.7 + q() * 0.6 };
    m.scale.setScalar(m.userData.sc); scene.add(m); loose.push(m);
  }
  const rs = rng(5); const sp = new Float32Array(160 * 3);
  for (let i = 0; i < 160; i++) { sp[i * 3] = (rs() - 0.5) * 11; sp[i * 3 + 1] = (rs() - 0.5) * 8 + 0.6; sp[i * 3 + 2] = -2 - rs() * 5; }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.04, transparent: true, opacity: 0.75, depthWrite: false })));

  return {
    update(t, dt, { pointer }) {
      for (const pv of pivots) {
        const k = backOut(clamp((t - pv.userData.delay) / 1.9));
        pv.rotation.x = 0.04 + (pv.userData.tilt - 0.04) * k + Math.sin(t * 0.8 + pv.userData.ph) * 0.012 * k;
      }
      const open = clamp((t - 1.2) / 2);
      stamens.scale.setScalar(0.3 + 0.7 * ease(open)); pistil.scale.setScalar(0.3 + 0.7 * ease(open));
      inner.intensity = 3 + 5 * ease(open) + Math.sin(t * 1.4) * 0.8;
      glow.material.opacity = 0.2 + 0.32 * ease(open) + Math.sin(t * 1.1) * 0.04;
      flower.rotation.y = t * 0.09 + pointer.x * 0.5; flower.rotation.x = 0.12 + pointer.y * 0.16;
      flower.position.y = -0.4 + Math.sin(t * 0.8) * 0.05;
      for (const m of loose) {
        const u = m.userData; const f = ((t * u.sp + u.off) % 1);
        m.position.set(u.x + Math.sin(t * u.sw + u.off) * 0.5, 2.9 - f * 5.6, u.z);
        m.rotation.set(t * u.rs, t * u.rs * 0.7 + u.off, t * u.rs * 0.4);
        m.material.opacity = 1;
      }
    },
  };
}
export function Lotus3D({ className = '', style, fallback }) {
  return <Scene3D build={buildLotus} fov={32} className={className} style={style} fallback={fallback} />;
}

/* ───────────────────────── Floating island ───────────────────────── */
function buildIsland({ THREE, scene, camera, mergeVertices }) {
  camera.position.set(0.3, 1.5, 7.4); camera.lookAt(0, -0.15, 0);
  scene.environmentIntensity = 0.55;
  const group = new THREE.Group(); scene.add(group);
  const R = 1.6;

  let rg = new THREE.IcosahedronGeometry(R, 5);
  rg.deleteAttribute('normal'); rg.deleteAttribute('uv'); rg = mergeVertices(rg, 1e-4);
  const rp = rg.attributes.position; const colors = new Float32Array(rp.count * 3);
  const c1 = new THREE.Color(0x54443a); const c2 = new THREE.Color(0x15100f); const c = new THREE.Color();
  for (let i = 0; i < rp.count; i++) {
    let x = rp.getX(i); let y = rp.getY(i); let z = rp.getZ(i);
    let y2 = y;
    if (y >= 0) y2 = y * 0.32;
    else { const k = -y / R; const tp = 1 - 0.8 * Math.pow(k, 0.85); x *= tp; z *= tp; y2 = y * 1.6; }
    const n = (Math.sin(x * 3.1 + z * 2.3) + Math.sin(y * 4.2 + x * 2.7) * 0.7 + Math.sin(z * 5.3 - y * 3)) * 0.05 * (y < 0.1 ? 1.6 : 0.4);
    rp.setXYZ(i, x * (1 + n), y2 * (1 + n * 0.5), z * (1 + n));
    c.copy(c1).lerp(c2, clamp(-y2 / 1.9 + 0.25 + (Math.sin(x * 9 + z * 7) * 0.5 + 0.5) * 0.25));
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  rg.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  rg.computeVertexNormals();
  group.add(new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0.05, flatShading: true })));
  const topY = (x, z) => 0.32 * Math.sqrt(Math.max(0, R * R - x * x - z * z));
  const r = rng(17);
  const ring = () => { const a = r() * Math.PI * 2; const d = Math.sqrt(r()) * 1.42; return [Math.cos(a) * d, Math.sin(a) * d]; };

  // moss
  const MOSS = [0x6d8a1f, 0x88a52f, 0xa6bd3e, 0x566f19, 0x7d9a2a].map((h) => new THREE.Color(h));
  const mossGeo = new THREE.IcosahedronGeometry(1, 2);
  const moss = new THREE.InstancedMesh(mossGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 }), 1100);
  const dm = new THREE.Object3D();
  for (let i = 0; i < 1100; i++) {
    let x; let z; let y; let s;
    if (i < 800) { [x, z] = ring(); y = topY(x, z) + 0.005; s = 0.022 + r() * 0.05; }
    else { const a = r() * Math.PI * 2; const d = 1.3 + r() * 0.32; x = Math.cos(a) * d; z = Math.sin(a) * d; y = topY(x, z) - r() * 0.34; s = 0.03 + r() * 0.05; }
    dm.position.set(x, y, z); dm.scale.setScalar(s); dm.scale.y *= 0.8; dm.rotation.set(r() * 3, r() * 3, r() * 3); dm.updateMatrix();
    moss.setMatrixAt(i, dm.matrix); moss.setColorAt(i, MOSS[Math.floor(r() * 5)]);
  }
  moss.instanceColor.needsUpdate = true; group.add(moss);

  // crystals
  const cMat = new THREE.MeshPhysicalMaterial({ color: 0xffe9bd, roughness: 0.04, transmission: 0.9, thickness: 0.7, ior: 1.5, iridescence: 0.5, attenuationColor: new THREE.Color(0xffc470), attenuationDistance: 1.6, envMapIntensity: 1.6, transparent: true });
  [[-0.55, 0.0, 0.7, 0.2, 0.2, 0.15], [-0.25, 0.3, 0.52, 0.16, -0.08, -0.12], [0.5, -0.1, 0.95, 0.24, 0.12, 0.1], [0.8, 0.25, 0.6, 0.17, 0.3, -0.2], [1.05, -0.45, 0.42, 0.14, 0.4, 0.2], [-0.95, -0.35, 0.4, 0.13, -0.4, 0.1]].forEach(([x, z, h, rr, tz, tx]) => {
    const pts = [new THREE.Vector2(0, 0), new THREE.Vector2(rr, 0), new THREE.Vector2(rr, h * 0.72), new THREE.Vector2(0, h)];
    const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 6), cMat);
    m.position.set(x, topY(x, z) - 0.04, z); m.rotation.set(tx, r() * 3, tz); group.add(m);
  });
  // blue stones
  const gem = new THREE.MeshPhysicalMaterial({ color: 0x4a90ff, roughness: 0.05, transmission: 0.8, thickness: 0.6, ior: 1.6, iridescence: 0.6, emissive: 0x1a4fb0, emissiveIntensity: 0.35 });
  [[-0.2, 0.95, 0.22], [0.2, 1.0, 0.15], [-0.7, 0.8, 0.13]].forEach(([x, z, s]) => {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 1), gem); m.scale.y = 0.6; m.position.set(x, topY(x, z) + 0.02, z); group.add(m);
  });

  // cosmos
  const petalMat = new THREE.MeshStandardMaterial({ color: 0xf7b8cf, roughness: 0.55, side: THREE.DoubleSide, emissive: 0x7a2a46, emissiveIntensity: 0.12 });
  const petalG = petalGeometry(THREE, 0.3, 0.2);
  const stemMat = new THREE.MeshStandardMaterial({ color: 0x86a63c, roughness: 0.7 });
  const centerMat = new THREE.MeshStandardMaterial({ color: 0xe9a93a, emissive: 0xc07a10, emissiveIntensity: 0.5, roughness: 0.5 });
  const flowers = [];
  [[-0.3, -0.3, 1.0, 0.3], [0.1, 0.35, 0.85, -0.25], [0.85, 0.25, 0.7, 0.2], [-0.8, 0.2, 0.6, -0.3], [0.35, -0.7, 0.62, 0.35]].forEach(([x, z, h, lean], k) => {
    const g = new THREE.Group(); g.position.set(x, topY(x, z) - 0.02, z);
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(lean * 0.3, h * 0.5, 0), new THREE.Vector3(lean, h, 0.05));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 14, 0.012, 6), stemMat));
    const head = new THREE.Group(); head.position.copy(curve.getPoint(1)); head.rotation.set(-0.5, 0.3, -lean * 0.8);
    for (let i = 0; i < 10; i++) {
      const pv = new THREE.Object3D(); pv.rotation.order = 'YXZ'; pv.rotation.y = (i / 10) * Math.PI * 2 + (k % 2) * 0.3; pv.rotation.x = 1.3;
      const pm = new THREE.Mesh(petalG, petalMat); pv.add(pm); head.add(pv);
    }
    head.add(new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), centerMat));
    head.scale.setScalar(0.9 + (k % 3) * 0.15);
    g.add(head); g.userData = { ph: k * 1.3 }; group.add(g); flowers.push(g);
  });
  // roses + buds
  const roseMat = new THREE.MeshStandardMaterial({ color: 0xe87aa0, roughness: 0.5, flatShading: true });
  const roseIn = new THREE.MeshStandardMaterial({ color: 0xffc2d4, roughness: 0.5, flatShading: true });
  [[-1.05, 0.2, 0.17], [-0.9, -0.5, 0.12], [1.0, 0.35, 0.15], [0.55, 0.85, 0.12], [-0.1, -1.0, 0.13]].forEach(([x, z, s]) => {
    const g = new THREE.Group(); g.position.set(x, topY(x, z) + s * 0.5, z);
    g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(s, 1), roseMat));
    const a = new THREE.Mesh(new THREE.IcosahedronGeometry(s * 0.72, 1), roseIn); a.position.y = s * 0.28; g.add(a);
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(s * 0.4, 1), roseMat); b.position.y = s * 0.55; g.add(b);
    group.add(g);
  });
  const buds = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }), 120);
  const BC = [0xf7b6c8, 0xf08fa8, 0xe86f93, 0xfbd0dc].map((h) => new THREE.Color(h));
  for (let i = 0; i < 120; i++) { const [x, z] = ring(); dm.position.set(x, topY(x, z) + 0.04 + r() * 0.12, z); dm.scale.setScalar(0.018 + r() * 0.03); dm.rotation.set(0, 0, 0); dm.updateMatrix(); buds.setMatrixAt(i, dm.matrix); buds.setColorAt(i, BC[Math.floor(r() * 4)]); }
  buds.instanceColor.needsUpdate = true; group.add(buds);

  // warm light + haze
  const key = new THREE.DirectionalLight(0xffbe80, 3.4); key.position.set(-5, 2.5, 3); scene.add(key);
  const rim = new THREE.DirectionalLight(0x90b0ff, 1.5); rim.position.set(4, 1, -3); scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xffe0c0, 0x201010, 0.35));
  const warm = new THREE.PointLight(0xffa860, 40, 9, 1.8); warm.position.set(-3.2, 0.8, 1.5); scene.add(warm);
  const beam = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(THREE, [[0, 'rgba(255,214,170,0.85)'], [0.18, 'rgba(255,175,105,0.32)'], [0.42, 'rgba(255,150,80,0)'], [1, 'rgba(255,150,80,0)']]), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 }));
  beam.scale.set(3.4, 3.4, 1); beam.position.set(-1.4, 1.0, -1); scene.add(beam);
  const sd = new Float32Array(90 * 3); const q = rng(8);
  for (let i = 0; i < 90; i++) { sd[i * 3] = (q() - 0.5) * 9; sd[i * 3 + 1] = (q() - 0.4) * 5; sd[i * 3 + 2] = (q() - 0.5) * 5; }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sd, 3));
  const dust = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffe2b0, size: 0.03, transparent: true, opacity: 0.7, depthWrite: false })); scene.add(dust);

  return {
    update(t, dt, { pointer }) {
      group.position.y = Math.sin(t * 0.7) * 0.13;
      group.rotation.y = Math.sin(t * 0.22) * 0.35 + pointer.x * 0.45; group.rotation.x = pointer.y * 0.12 + Math.sin(t * 0.5) * 0.02; group.rotation.z = Math.sin(t * 0.4) * 0.025;
      flowers.forEach((f) => { f.rotation.z = Math.sin(t * 0.9 + f.userData.ph) * 0.05; });
      dust.rotation.y = t * 0.02; dust.position.y = Math.sin(t * 0.3) * 0.1;
    },
  };
}
export function Island3D({ className = '', style, fallback }) {
  return <Scene3D build={buildIsland} fov={30} className={className} style={style} fallback={fallback} />;
}

/* ───────────────────────── Page floaters (gems in the margins) ───────────────────────── */
const FLOAT_KINDS = {
  crystal: (T) => new T.IcosahedronGeometry(1, 0),
  knot: (T) => new T.TorusKnotGeometry(0.62, 0.22, 140, 18),
  ring: (T) => new T.TorusGeometry(0.78, 0.26, 28, 72),
  gem: (T) => new T.OctahedronGeometry(1, 0),
  bubble: (T) => new T.SphereGeometry(1, 48, 48),
  dodeca: (T) => new T.DodecahedronGeometry(1, 0),
};
export function PageFloaters({ items, className = '' }) {
  const build = useMemo(() => ({ THREE, scene, renderer }) => {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -2000, 2000); camera.position.z = 600;
    scene.environmentIntensity = 1.2;
    const key = new THREE.DirectionalLight(0xffd2a0, 2.6); key.position.set(-300, 400, 500); scene.add(key);
    const fill = new THREE.DirectionalLight(0x88a0ff, 1.8); fill.position.set(400, -200, 300); scene.add(fill);
    const mats = {
      glass: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.04, transmission: 1, thickness: 90, ior: 1.45, iridescence: 1, iridescenceIOR: 1.5, iridescenceThicknessRange: [200, 760], attenuationColor: new THREE.Color(0x8a9bff), attenuationDistance: 260, envMapIntensity: 1.6 }),
      amber: new THREE.MeshPhysicalMaterial({ color: 0xffe3b0, roughness: 0.05, transmission: 0.9, thickness: 80, ior: 1.5, attenuationColor: new THREE.Color(0xffa850), attenuationDistance: 160, envMapIntensity: 1.6 }),
      rose: new THREE.MeshPhysicalMaterial({ color: 0xff9dc0, roughness: 0.1, transmission: 0.55, thickness: 70, iridescence: 0.9, emissive: 0xc03a70, emissiveIntensity: 0.18, envMapIntensity: 1.5 }),
      chrome: new THREE.MeshStandardMaterial({ color: 0xdfe6ff, roughness: 0.12, metalness: 1, envMapIntensity: 1.7 }),
      gold: new THREE.MeshStandardMaterial({ color: 0xffd08a, roughness: 0.18, metalness: 1, envMapIntensity: 1.6 }),
    };
    const objs = items.map((it) => {
      const m = new THREE.Mesh(FLOAT_KINDS[it.kind](THREE), mats[it.mat || 'glass']); m.scale.setScalar(it.size / 2);
      m.rotation.set(it.rx || 0.4, it.ry || 0.6, 0); scene.add(m); return { it, m };
    });
    let W = 1; let H = 1;
    return {
      camera,
      resize(w, h) { W = w; H = h; camera.left = -w / 2; camera.right = w / 2; camera.top = h / 2; camera.bottom = -h / 2; camera.updateProjectionMatrix(); },
      update(t) {
        const sy = window.scrollY; const dh = document.documentElement.scrollHeight; let any = false;
        for (const { it, m } of objs) {
          const y = it.y * dh - sy + Math.sin(t * 0.6 + it.x * 9) * 12;
          const vis = y > -it.size && y < H + it.size;
          m.visible = vis; if (!vis) continue; any = true;
          m.position.set((it.x - 0.5) * W, H / 2 - y, 0);
          m.rotation.x += (it.spin || 0.004); m.rotation.y += (it.spin || 0.004) * 1.4;
        }
        return any;
      },
    };
  }, [items]);
  return <Scene3D build={build} dpr={1.25} minWidth={1100} className={`hidden lg:block ${className}`} style={{ position: 'fixed', inset: 0, zIndex: 6 }} />;
}
