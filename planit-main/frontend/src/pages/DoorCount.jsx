import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Camera, Users, Move, ClipboardCheck, ChevronDown, Maximize, X,
  Play, Square, Upload, Download, Copy, Plus, Minus, Eye, EyeOff, Undo2, Check, HelpCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { BetaBar } from '../components/BetaBar';
import LabLanding from '../components/LabLanding';

// ═══════════════════════════════════════════════════════════════════════════
// Door Count — on-device doorway people counter (PlanIt Labs beta).
// Frames never leave the browser: no upload, no recording, no saved images.
// ═══════════════════════════════════════════════════════════════════════════
const ACCENT = '#2F6BFF';
const CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21';
const MODELS = {
  lite: { size: 320, name: 'EfficientDet-Lite0', url: 'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite' },
  large: { size: 448, name: 'EfficientDet-Lite2', url: 'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite2/float16/1/efficientdet_lite2.tflite' },
};
const MIN_H = 0.08, MIN_HITS = 3, TRACK_TTL = 700, MAX_PRED = 300, DEADBAND = 0.015;
const KEY = 'planit_doorcount_v1';
const MIN_TAPS = 10, MATCH_MS = 1500;
const DEFAULTS = { n: 3, conf: 0.4, model: 'lite', flip: false, cap: 0, door: '', live: false, guide: true };
const GUIDE = [
  { t: 'Choose a source', b: 'Point a camera at a doorway, or try a video file first: a 1 to 2 minute clip from a fixed camera, with people walking through a door in both directions, works well.' },
  { t: 'Place the line', b: 'Drag the two white dots so the line spans the doorway and people must cross it fully. The arrow points toward IN. If it points the wrong way, tap Flip direction.' },
  { t: 'Watch it count', b: 'Let people walk through. Each crossing adds to IN or OUT. If nothing counts, check that whole bodies are visible and the line is across their path, then try a lower confidence or the larger model.' },
  { t: 'Test your accuracy', b: 'Turn on Test accuracy, then tap Real IN or Real OUT each time a person really crosses. After 10 taps you get a result. With a video file, watch the video and tap in time with it.' },
];
const LV_COLOR = ['#3ecf8e', '#f5b942', '#ff5d5d'];

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const push = (a, v) => { a.push(v); if (a.length > 30) a.shift(); };
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const fmt = (v, d = 1) => (v ? v.toFixed(d) : '-');
const lvOf = (occ, cap) => (cap > 0 ? (occ >= cap ? 2 : occ >= cap * 0.85 ? 1 : 0) : 0);

function loadSaved() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; } }
function save(e) {
  try {
    const { cfg, line, roi, events, series, start } = e;
    localStorage.setItem(KEY, JSON.stringify({ ...cfg, line, roi, events: events.slice(-5000), series: series.slice(-2000), start }));
  } catch { /* storage full or blocked: counting still works */ }
}
function recount(e) {
  let i = 0, o = 0, pk = 0, pt = 0;
  for (const ev of e.events) { if (ev.dir === 'in') i++; else o++; if (i - o > pk) { pk = i - o; pt = ev.t; } }
  e.C = { in: i, out: o, peak: pk, pt };
}
const pred = (t, now) => { const dt = Math.min(now - t.t, MAX_PRED); return { x: t.x + t.vx * dt, y: t.y + t.vy * dt, w: t.w, h: t.h }; };
function iou(a, b) {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (w <= 0 || h <= 0) return 0;
  const i = w * h; return i / (a.w * a.h + b.w * b.h - i);
}

// Accuracy matcher: per direction, pair each real tap with the nearest unused automatic count within MATCH_MS.
function matchTaps(taps, auto) {
  const r = {};
  for (const dir of ['in', 'out']) {
    const T = taps.filter((x) => x.dir === dir), A = auto.filter((x) => x.dir === dir), pr = [];
    T.forEach((t, i) => A.forEach((a, j) => { const d = Math.abs(a.t - t.t); if (d <= MATCH_MS) pr.push([d, i, j]); }));
    pr.sort((x, y) => x[0] - y[0]);
    const ut = new Set(), ua = new Set();
    for (const [, i, j] of pr) { if (ut.has(i) || ua.has(j)) continue; ut.add(i); ua.add(j); }
    r[dir] = { real: T.length, counted: A.length, matched: ut.size, extra: A.length - ut.size };
  }
  const real = r.in.real + r.out.real, counted = r.in.counted + r.out.counted, matched = r.in.matched + r.out.matched;
  return { ...r, real, counted, matched, missed: real - matched, extra: counted - matched, recall: matched / real, precision: counted ? matched / counted : null };
}
function verdict(r) {
  const part = (label, d) => (!d.real && !d.extra ? null : `Caught ${d.matched} of ${d.real} ${label}${d.extra ? `, ${d.extra} extra` : ''}`);
  return `${[part('entries', r.in), part('exits', r.out)].filter(Boolean).join('. ')}.`;
}
const pct = (v) => (v == null ? 'n/a' : `${Math.round(v * 100)}%`);

function report(e) {
  const B = 300000, b = {};
  for (const ev of e.events) { const k = Math.floor(ev.t / B) * B; (b[k] ??= { start: new Date(k).toISOString(), in: 0, out: 0 })[ev.dir]++; }
  let run = 0;
  const buckets = Object.values(b).map((x) => (run += x.in - x.out, { ...x, occupancyEnd: run }));
  const { C } = e;
  return {
    door: e.cfg.door, sessionStart: new Date(e.start).toISOString(), exported: new Date().toISOString(),
    totals: { in: C.in, out: C.out, inside: C.in - C.out }, capacity: e.cfg.cap || null,
    peak: { occupancy: C.peak, at: C.pt ? new Date(C.pt).toISOString() : null }, bucketMinutes: 5, buckets,
    events: e.events.map((ev) => ({ time: new Date(ev.t).toISOString(), direction: ev.dir, source: ev.src })),
  };
}
function download(name, type, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const btn = 'min-h-11 px-4 rounded-xl border border-white/15 text-sm font-semibold text-white hover:bg-white/5 active:bg-white/10 transition-colors disabled:opacity-40 disabled:pointer-events-none';
const field = 'min-h-11 w-full rounded-xl bg-black/40 border border-white/15 px-3 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-[#2F6BFF]';

function Section({ title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02]">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between px-4 min-h-12 text-left">
        <span className="font-display font-semibold text-sm">{title}</span>
        <ChevronDown className={`w-4 h-4 text-neutral-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange }) {
  return (
    <label className="block">
      <span className="flex justify-between text-xs text-neutral-400 mb-1"><span>{label}</span><span className="font-mono text-white">{value}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(ev) => onChange(+ev.target.value)} className="w-full h-8 accent-[#2F6BFF]" />
    </label>
  );
}

function OccChart({ e, snap }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current; if (!c) return;
    const d = devicePixelRatio || 1, W = c.clientWidth, H = 100;
    c.width = W * d; c.height = H * d;
    const x = c.getContext('2d'); x.setTransform(d, 0, 0, d, 0, 0); x.clearRect(0, 0, W, H);
    x.font = '10px "DM Mono", monospace'; x.fillStyle = '#8b95a5';
    const s = e.series;
    if (s.length < 2) { x.fillText('Occupancy appears here as people cross.', 8, H / 2); return; }
    const t0 = s[0][0], t1 = s[s.length - 1][0], ym = Math.max(1, e.cfg.cap, e.C.peak);
    const X = (t) => 2 + ((t - t0) / (t1 - t0 || 1)) * (W - 4), Y = (o) => H - 14 - (o / ym) * (H - 24);
    if (e.cfg.cap > 0) { x.strokeStyle = '#ff5d5d'; x.setLineDash([4, 3]); x.beginPath(); x.moveTo(0, Y(e.cfg.cap)); x.lineTo(W, Y(e.cfg.cap)); x.stroke(); x.setLineDash([]); }
    x.strokeStyle = ACCENT; x.lineWidth = 2; x.beginPath();
    let py = Y(s[0][1]); x.moveTo(X(t0), py);
    for (const [t, o] of s) { x.lineTo(X(t), py); py = Y(o); x.lineTo(X(t), py); }
    x.stroke();
    const hm = (t) => new Date(t).toTimeString().slice(0, 5);
    x.fillStyle = '#8b95a5'; x.fillText(hm(t0), 2, H - 2); x.fillText(hm(t1), W - 30, H - 2); x.fillText(`max ${ym}`, W - 48, 10);
  }, [e, snap]);
  return <canvas ref={ref} className="w-full h-[100px] block" />;
}

// ═══════════════════════════════════════════════════════════════════════════
// COUNTER (the tool)
// ═══════════════════════════════════════════════════════════════════════════
function Counter() {
  const videoRef = useRef(null), ovRef = useRef(null), stageRef = useRef(null), wrapRef = useRef(null), fileRef = useRef(null);
  const E = useRef(null);
  if (!E.current) {
    const s = loadSaved(), cfg = { ...DEFAULTS };
    for (const k of Object.keys(DEFAULTS)) if (typeof s[k] === typeof DEFAULTS[k]) cfg[k] = s[k];
    E.current = {
      cfg, line: s.line || { a: [0.1, 0.55], b: [0.9, 0.55] }, roi: s.roi || null,
      events: Array.isArray(s.events) ? s.events : [], series: Array.isArray(s.series) ? s.series : [], start: s.start || Date.now(),
      autoLog: [], autoN: 0, tracks: [], nextId: 1, running: false, flash: null, C: { in: 0, out: 0, peak: 0, pt: 0 },
      P: { inf: [], lat: [], fps: 0, latLast: 0 }, lastT: -1, fc: 0, ff: 0, fpsT: performance.now(), lastTs: 0, tick: 0,
      det: null, vision: null, fileset: null, loadId: 0, work: null, h: 0, hk: '', wl: null, ac: null, fileUrl: null,
      prevLv: null, roiMode: false, drag: null, display: false,
    };
    recount(E.current);
  }
  const e = E.current;

  const [cfg, setCfg] = useState(e.cfg);
  e.cfg = cfg;
  const patch = (p) => setCfg((c) => ({ ...c, ...p }));
  const [modelState, setModelState] = useState('loading'); // loading | ready | failed
  const [err, setErr] = useState(null);
  const [gpuWarn, setGpuWarn] = useState(false);
  const [info, setInfo] = useState('');
  const [running, setRunning] = useState(false);
  const [display, setDisplay] = useState(false);
  const [roiOn, setRoiOn] = useState(false);
  const [cams, setCams] = useState([]);
  const [camId, setCamId] = useState('');
  const [ar, setAr] = useState(16 / 9);
  const [snap, setSnap] = useState({ in: 0, out: 0, peak: 0, occ: 0, lv: 0, fps: 0, infL: 0, infA: 0, latL: 0, latA: 0, nAuto: 0, nEv: 0, nSer: 0 });
  const [testOn, setTestOn] = useState(false);
  const [testStart, setTestStart] = useState(0);
  const [taps, setTaps] = useState([]);
  e.display = display;
  const [gs, setGs] = useState(0);
  useEffect(() => { if (running && gs === 0) setGs(1); }, [running, gs]);

  useEffect(() => { save(e); }, [cfg, e]);

  // ---------- model ----------
  const nextTs = () => (e.lastTs = Math.max(performance.now(), e.lastTs + 1));
  const warm = (det, key) => {
    const M = MODELS[key].size, w = e.work || (e.work = document.createElement('canvas'));
    w.width = w.height = M; w.getContext('2d').fillRect(0, 0, M, M);
    for (let i = 0; i < 3; i++) det.detectForVideo(w, nextTs());
  };
  const loadModel = async (key) => {
    const id = ++e.loadId;
    setModelState('loading'); setErr(null);
    try {
      if (!e.vision) {
        const v = await import(/* @vite-ignore */ `${CDN}/vision_bundle.mjs`);
        e.fileset = await v.FilesetResolver.forVisionTasks(`${CDN}/wasm`); e.vision = v;
      }
    } catch {
      if (id === e.loadId) { setModelState('failed'); setErr({ text: 'Could not load the MediaPipe library from the CDN. Check your connection and retry.' }); }
      return;
    }
    const m = MODELS[key];
    const create = (d) => e.vision.ObjectDetector.createFromOptions(e.fileset, {
      baseOptions: { modelAssetPath: m.url, delegate: d }, runningMode: 'VIDEO', scoreThreshold: e.cfg.conf, categoryAllowlist: ['person'],
    });
    let det = null, del = 'GPU';
    try {
      try { det = await create('GPU'); warm(det, key); } catch { det?.close(); del = 'CPU'; det = await create('CPU'); warm(det, key); }
    } catch {
      if (id === e.loadId) { setModelState('failed'); setErr({ text: 'The detection model failed to load. Check your connection, or try the other model.' }); }
      return;
    }
    if (id !== e.loadId) { det.close(); return; }
    e.det?.close(); e.det = det;
    setGpuWarn(del === 'CPU'); setInfo(`${m.name}, ${m.size}px, ${del}`); setModelState('ready');
  };
  useEffect(() => { loadModel(cfg.model); }, [cfg.model]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- audio, wake lock ----------
  const unlockAudio = () => { try { e.ac ??= new (window.AudioContext || window.webkitAudioContext)(); e.ac.resume(); } catch { /* audio blocked */ } };
  const beep = (n) => {
    try {
      unlockAudio();
      for (let i = 0; i < n; i++) {
        const o = e.ac.createOscillator(), g = e.ac.createGain(), t = e.ac.currentTime + i * 0.22;
        o.connect(g); g.connect(e.ac.destination); o.frequency.value = n > 1 ? 880 : 660;
        g.gain.setValueAtTime(0.15, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18); o.start(t); o.stop(t + 0.2);
      }
    } catch { /* audio blocked */ }
  };
  const wake = async () => {
    try {
      if ('wakeLock' in navigator && e.running && !e.wl) {
        e.wl = await navigator.wakeLock.request('screen');
        e.wl.addEventListener('release', () => { e.wl = null; });
      }
    } catch { /* wake lock refused */ }
  };

  // ---------- frame loop ----------
  const cancelFrame = (v = videoRef.current) => {
    if (e.hk === 'v') v?.cancelVideoFrameCallback?.(e.h); else if (e.hk === 'r') cancelAnimationFrame(e.h);
    e.hk = '';
  };
  const schedule = () => {
    const v = videoRef.current;
    if (!e.running || !v) return;
    if ('requestVideoFrameCallback' in v) { e.hk = 'v'; e.h = v.requestVideoFrameCallback(loop); } else { e.hk = 'r'; e.h = requestAnimationFrame(loop); }
  };
  const loop = () => {
    const tF = performance.now(), v = videoRef.current;
    schedule();
    if (!v || v.currentTime === e.lastT || !v.videoWidth) return;   // no new frame
    e.lastT = v.currentTime; e.fc++; e.ff++;
    if (tF - e.fpsT >= 1000) { e.P.fps = (e.ff * 1000) / (tF - e.fpsT); e.ff = 0; e.fpsT = tF; }
    if (e.det && e.fc % e.cfg.n === 0) detect(tF);   // detect every N frames, track in between
    draw(tF);
  };

  // ---------- detection ----------
  const detect = (tF) => {
    const v = videoRef.current, vw = v.videoWidth, vh = v.videoHeight, M = MODELS[e.cfg.model].size, r = e.roi || { x: 0, y: 0, w: 1, h: 1 };
    const cx = r.x * vw, cy = r.y * vh, cw = r.w * vw, ch = r.h * vh, sc = M / Math.max(cw, ch);   // native-size input, aspect kept, ROI crop only
    const w = e.work || (e.work = document.createElement('canvas')), ctx = w.getContext('2d');
    if (w.width !== M) w.width = w.height = M;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, M, M); ctx.drawImage(v, cx, cy, cw, ch, 0, 0, cw * sc, ch * sc);
    let res; const t0 = performance.now();
    try { res = e.det.detectForVideo(w, nextTs()); } catch { return; }
    push(e.P.inf, performance.now() - t0);
    track(res.detections.map((d) => { const b = d.boundingBox; return { x: (cx + b.originX / sc) / vw, y: (cy + b.originY / sc) / vh, w: b.width / sc / vw, h: b.height / sc / vh }; }), tF);
  };

  // Tracker: greedy IoU matching against velocity-extrapolated boxes.
  const track = (boxes, tF) => {
    const T = e.tracks, pairs = [];
    T.forEach((t, i) => boxes.forEach((b, j) => { const v = iou(pred(t, tF), b); if (v > 0.15) pairs.push([v, i, j]); }));
    pairs.sort((a, b) => b[0] - a[0]);
    const ut = new Set(), ub = new Set();
    for (const [, i, j] of pairs) { if (ut.has(i) || ub.has(j)) continue; ut.add(i); ub.add(j); update(T[i], boxes[j], tF); }
    boxes.forEach((b, j) => { if (!ub.has(j)) T.push({ id: e.nextId++, ...b, vx: 0, vy: 0, t: tF, hits: 1, side: 0 }); });
    e.tracks = T.filter((t) => tF - t.t < TRACK_TTL);
  };
  const update = (t, b, tF) => {
    const dt = tF - t.t;   // smoothed velocity (per ms) from measured positions only
    if (dt > 0) { t.vx = 0.5 * t.vx + (0.5 * (b.x - t.x)) / dt; t.vy = 0.5 * t.vy + (0.5 * (b.y - t.y)) / dt; }
    Object.assign(t, b, { t: tF, hits: t.hits + 1 });
    cross(t, tF);   // crossings are judged on measured detections only, never on extrapolated boxes
  };

  // Crossing: signed distance to the line with a dead-band; a count needs a side flip while inside the segment.
  const cross = (t, tF) => {
    if (t.hits < MIN_HITS || t.h < MIN_H) return;
    const v = videoRef.current, vw = v.videoWidth, vh = v.videoHeight, { a, b } = e.line;
    const ax = a[0] * vw, ay = a[1] * vh, dx = b[0] * vw - ax, dy = b[1] * vh - ay, L = Math.hypot(dx, dy) || 1;
    const px = (t.x + t.w / 2) * vw - ax, py = (t.y + t.h / 2) * vh - ay;
    const d = (dx * py - dy * px) / L, u = (px * dx + py * dy) / (L * L), band = DEADBAND * vh;
    const ns = d > band ? 1 : d < -band ? -1 : 0;
    if (!ns) return;   // inside the dead-band: keep the previous side
    if (t.side && ns !== t.side && u >= 0 && u <= 1) {
      const dir = (ns > 0) !== e.cfg.flip ? 'in' : 'out';
      e.autoLog.push({ t: Date.now(), dir }); e.autoN++;   // every automatic crossing, for the accuracy check
      if (e.autoLog.length > 2000) e.autoLog.shift();
      record(dir, 'auto', performance.now() - tF);
    }
    t.side = ns;
  };
  const resetSides = () => e.tracks.forEach((t) => { t.side = 0; });

  const record = (dir, src, lat) => {
    if (dir === 'out' && e.C.in - e.C.out <= 0) return;   // occupancy never goes below zero
    e.events.push({ t: Date.now(), dir, src }); recount(e);
    e.series.push([Date.now(), e.C.in - e.C.out]);
    if (lat != null) { push(e.P.lat, lat); e.P.latLast = lat; }
    e.flash = { dir, t: performance.now() }; save(e);
    draw(performance.now()); setTimeout(() => draw(performance.now()), 420);
  };

  // ---------- drawing (imperative, no React per frame) ----------
  const draw = (now) => {
    const c = ovRef.current; if (!c) return;
    const x = c.getContext('2d'), W = c.width, H = c.height;
    x.clearRect(0, 0, W, H); x.lineWidth = Math.max(2, W / 500); x.font = `${Math.max(12, W / 60)}px "DM Mono", monospace`;
    if (e.roi) { const r = e.roi; x.setLineDash([8, 6]); x.strokeStyle = '#f5b942'; x.strokeRect(r.x * W, r.y * H, r.w * W, r.h * H); x.setLineDash([]); }
    x.strokeStyle = x.fillStyle = ACCENT;
    for (const t of e.tracks) { if (now - t.t > TRACK_TTL) continue; const p = pred(t, now); x.strokeRect(p.x * W, p.y * H, p.w * W, p.h * H); x.fillText(`#${t.id}`, p.x * W + 3, p.y * H - 4); }
    const { a, b } = e.line, fl = e.flash && now - e.flash.t < 400 ? e.flash.dir : null;
    const col = fl === 'in' ? '#3ecf8e' : fl === 'out' ? '#f5b942' : '#ffffff';
    const x1 = a[0] * W, y1 = a[1] * H, x2 = b[0] * W, y2 = b[1] * H;
    x.strokeStyle = x.fillStyle = col; x.lineWidth *= 1.5; x.beginPath(); x.moveTo(x1, y1); x.lineTo(x2, y2); x.stroke();
    const L = Math.hypot(x2 - x1, y2 - y1) || 1, s = e.cfg.flip ? -1 : 1, nx = (-(y2 - y1) / L) * s, ny = ((x2 - x1) / L) * s, mx = (x1 + x2) / 2, my = (y1 + y2) / 2, k = Math.max(18, W / 40);
    x.beginPath(); x.moveTo(mx, my); x.lineTo(mx + nx * k * 1.6, my + ny * k * 1.6); x.stroke();   // arrow points toward IN
    x.fillText('IN', mx + nx * k * 2.1 - 8, my + ny * k * 2.1 + 4);
    for (const [px, py] of [[x1, y1], [x2, y2]]) { x.beginPath(); x.arc(px, py, Math.max(8, W / 100), 0, 7); x.fill(); }
  };
  useEffect(() => {
    const ro = new ResizeObserver(() => {
      const c = ovRef.current, s = stageRef.current, d = devicePixelRatio || 1;
      if (!c || !s) return;
      c.width = Math.round(s.clientWidth * d); c.height = Math.round(s.clientHeight * d); draw(performance.now());
    });
    ro.observe(stageRef.current);
    return () => ro.disconnect();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- sources ----------
  const stopSrc = () => {
    e.running = false; cancelFrame();
    const v = videoRef.current;
    v.srcObject?.getTracks().forEach((t) => t.stop()); v.srcObject = null; v.removeAttribute('src'); v.load();
    if (e.fileUrl) { URL.revokeObjectURL(e.fileUrl); e.fileUrl = null; }
    try { e.wl?.release(); } catch { /* already released */ }
    e.wl = null; e.tracks = []; setRunning(false); draw(performance.now());
  };
  const begin = () => {
    e.running = true; e.lastT = -1; setRunning(true); setErr(null); wake(); schedule();
  };
  const listCams = async () => {
    try { setCams((await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput')); } catch { /* labels unavailable */ }
  };
  const camError = (x) => {
    const m = {
      NotAllowedError: 'Camera permission was denied. Allow camera access in the browser settings and try again.',
      NotFoundError: 'No camera was found on this device.', DevicesNotFoundError: 'No camera was found on this device.',
      NotReadableError: 'The camera is in use by another app.', OverconstrainedError: 'The selected camera is unavailable.',
    };
    setErr({ text: m[x.name] || `Camera error: ${x.message}` });
  };
  const startCam = async (id) => {
    unlockAudio();
    if (!navigator.mediaDevices?.getUserMedia) { setErr({ text: 'Camera access needs https or localhost.' }); return; }
    stopSrc();
    try {
      const v = videoRef.current;
      v.srcObject = await navigator.mediaDevices.getUserMedia({ video: { deviceId: id ? { exact: id } : undefined, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      v.loop = false; await v.play(); listCams(); begin();
    } catch (x) { camError(x); }
  };
  const startFile = (f) => {
    if (!f || !e.det) return;
    unlockAudio(); stopSrc();
    const v = videoRef.current;
    e.fileUrl = URL.createObjectURL(f); v.src = e.fileUrl; v.loop = true; v.muted = true;
    v.play().then(begin).catch(() => setErr({ text: 'This video file could not be played by the browser.' }));
  };

  // ---------- lifecycle ----------
  useEffect(() => {
    const v = videoRef.current;
    const onVis = () => { if (document.visibilityState === 'visible') wake(); };
    const onFs = () => { if (!document.fullscreenElement) setDisplay(false); };
    document.addEventListener('visibilitychange', onVis); document.addEventListener('fullscreenchange', onFs);
    const timer = setInterval(() => {
      const { C, P } = e;
      if (e.running && ++e.tick % 40 === 0) e.series.push([Date.now(), C.in - C.out]);   // occupancy sample every 10 s
      const occ = C.in - C.out, lv = lvOf(occ, e.cfg.cap);
      if (e.prevLv != null && lv > e.prevLv) beep(lv === 2 ? 2 : 1);
      e.prevLv = lv;
      const next = {
        in: C.in, out: C.out, peak: C.peak, occ, lv, fps: P.fps, infL: P.inf.at(-1) || 0, infA: avg(P.inf),
        latL: P.lat.length ? P.latLast : 0, latA: avg(P.lat), nAuto: e.autoN, nEv: e.events.length, nSer: e.series.length,
      };
      const k = JSON.stringify(next);
      if (k !== e.snapKey) { e.snapKey = k; setSnap(next); }   // at most 4 React updates per second
    }, 250);
    return () => {
      document.removeEventListener('visibilitychange', onVis); document.removeEventListener('fullscreenchange', onFs);
      clearInterval(timer); e.running = false; e.loadId++; cancelFrame(v);
      v?.srcObject?.getTracks().forEach((t) => t.stop());
      if (e.fileUrl) URL.revokeObjectURL(e.fileUrl);
      try { e.wl?.release(); } catch { /* already released */ }
      try { e.det?.close(); } catch { /* already closed */ }
      e.det = null; e.wl = null;
      try { e.ac?.close(); } catch { /* already closed */ }
      e.ac = null;
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- accuracy check ----------
  const tap = (dir) => { navigator.vibrate?.(15); setTaps((t) => [...t, { t: Date.now(), dir }]); };
  useEffect(() => {
    const onKey = (ev) => {
      if (ev.key === 'Escape' && display) setDisplay(false);
      if (testOn && ev.key === 'ArrowRight') tap('in');
      if (testOn && ev.key === 'ArrowLeft') tap('out');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [testOn, display]);
  const acc = useMemo(
    () => (taps.length >= MIN_TAPS ? matchTaps(taps, e.autoLog.filter((a) => a.t >= testStart)) : null),
    [taps, testStart, snap.nAuto, e], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const toggleTest = () => { if (!testOn) { setTaps([]); setTestStart(Date.now()); } setTestOn(!testOn); };
  const copyResult = async () => {
    const m = MODELS[cfg.model];
    const text = [
      `Door Count accuracy check${cfg.door ? ` - ${cfg.door}` : ''} (${new Date().toLocaleString()})`, verdict(acc),
      `Real total ${acc.real}, counted total ${acc.counted}, missed ${acc.missed}, extra ${acc.extra}, recall ${pct(acc.recall)}, precision ${pct(acc.precision)}`,
      `Settings: ${m.name}, confidence ${cfg.conf}, detect every ${cfg.n} frames`,
    ].join('\n');
    try { await navigator.clipboard.writeText(text); toast.success('Result copied'); } catch { toast.error('Could not copy. Select and copy the result manually.'); }
  };

  // ---------- pointer: line ends and region ----------
  const pt = (ev) => { const r = ovRef.current.getBoundingClientRect(); return [clamp((ev.clientX - r.left) / r.width, 0, 1), clamp((ev.clientY - r.top) / r.height, 0, 1)]; };
  const onDown = (ev) => {
    if (e.display) return;
    const p = pt(ev), r = ovRef.current.getBoundingClientRect();
    ev.currentTarget.setPointerCapture(ev.pointerId);
    if (e.roiMode) { e.drag = { k: 'roi', o: p }; e.roi = { x: p[0], y: p[1], w: 0, h: 0 }; return; }
    const near = (k) => Math.hypot((e.line[k][0] - p[0]) * r.width, (e.line[k][1] - p[1]) * r.height) < 36;
    e.drag = near('a') ? { k: 'a' } : near('b') ? { k: 'b' } : null;
  };
  const onMove = (ev) => {
    if (!e.drag) return;
    const p = pt(ev);
    if (e.drag.k === 'roi') { const o = e.drag.o; e.roi = { x: Math.min(o[0], p[0]), y: Math.min(o[1], p[1]), w: Math.abs(p[0] - o[0]), h: Math.abs(p[1] - o[1]) }; } else e.line[e.drag.k] = p;
    draw(performance.now());
  };
  const onUp = () => {
    if (!e.drag) return;
    if (e.drag.k === 'roi') { if (e.roi.w < 0.1 || e.roi.h < 0.1) e.roi = null; e.roiMode = false; setRoiOn(false); e.tracks = []; }
    resetSides(); e.drag = null; save(e); draw(performance.now());
  };

  // ---------- controls ----------
  const toggleDisplay = (on) => {
    setDisplay(on);
    if (on) wrapRef.current?.requestFullscreen?.().catch(() => {});   // iOS Safari: falls back to the full-viewport layout
    else if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  };
  const resetSession = () => {
    if (!window.confirm('Clear all counts and history for this session?')) return;
    e.events = []; e.series = []; e.autoLog = []; e.autoN = 0; e.start = Date.now(); e.tracks = []; recount(e); save(e);
    setTaps([]); setTestStart(Date.now());
  };
  const fname = (ext) => `${(cfg.door || 'session').replace(/[^\w-]+/g, '_')}.${ext}`;

  const status = err ? 'error' : modelState === 'loading' ? 'loading' : running ? 'counting' : 'ready';
  const dot = { error: 'bg-red-500', loading: 'bg-amber-400 animate-pulse', counting: 'bg-emerald-400 animate-pulse', ready: 'bg-neutral-400' }[status];
  const label = { error: 'Error', loading: 'Loading model', counting: 'Counting', ready: 'Ready' }[status];
  const showVideo = !display || cfg.live;
  const lvc = LV_COLOR[snap.lv];
  const capTxt = cfg.cap > 0 ? `of ${cfg.cap}${snap.lv === 2 ? ' - FULL' : ''}` : '';

  const g = GUIDE[gs];
  const gBtn = `${btn} flex items-center gap-2`;
  const guideCard = cfg.guide ? (
    <div className="rounded-2xl border border-[#2F6BFF]/40 bg-[#2F6BFF]/[0.06] p-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] tracking-widest uppercase" style={{ color: ACCENT }}>Guide - step {gs + 1} of {GUIDE.length}</span>
        <button onClick={() => patch({ guide: false })} aria-label="Hide guide" className="w-10 h-10 -mr-2 flex items-center justify-center text-neutral-400 hover:text-white"><X className="w-4 h-4" /></button>
      </div>
      <div className="flex gap-1.5 my-2">{GUIDE.map((x, i) => <span key={x.t} className="h-1 flex-1 rounded-full" style={{ background: i <= gs ? ACCENT : 'rgba(255,255,255,0.12)' }} />)}</div>
      <h3 className="font-display font-bold text-lg mb-1">{g.t}</h3>
      <p className="text-sm text-neutral-300 leading-relaxed mb-3">{g.b}</p>
      {gs === 2 && <p className="font-mono text-xs text-neutral-400 mb-3">Counted so far: IN {snap.in}, OUT {snap.out}{snap.in + snap.out === 0 && running ? ' (nothing yet)' : ''}</p>}
      {gs === 3 && testOn && <p className="font-mono text-xs text-neutral-400 mb-3">{acc ? verdict(acc) : `${taps.length} of ${MIN_TAPS} taps. Keep tapping as people cross.`}</p>}
      <div className="flex flex-wrap gap-2">
        {gs > 0 && <button className={gBtn} onClick={() => setGs(gs - 1)}>Back</button>}
        {gs === 0 && <button className={gBtn} disabled={modelState !== 'ready'} onClick={() => startCam(camId)}><Camera className="w-4 h-4" />Start camera</button>}
        {gs === 0 && <button className={gBtn} disabled={modelState !== 'ready'} onClick={() => fileRef.current.click()}><Upload className="w-4 h-4" />Choose video file</button>}
        {gs === 0 && running && <button className={gBtn} onClick={() => setGs(1)}>Next</button>}
        {gs === 1 && <button className={gBtn} onClick={() => { patch({ flip: !cfg.flip }); resetSides(); }}>Flip direction</button>}
        {gs === 1 && <button className={gBtn} style={{ borderColor: ACCENT }} onClick={() => setGs(2)}><Check className="w-4 h-4" />Line is set</button>}
        {gs === 2 && <button className={gBtn} style={{ borderColor: ACCENT }} onClick={() => setGs(3)}>Next</button>}
        {gs === 3 && !testOn && <button className={gBtn} style={{ borderColor: ACCENT }} onClick={toggleTest}><ClipboardCheck className="w-4 h-4" />Turn on Test accuracy</button>}
        {gs === 3 && acc && <button className={gBtn} onClick={copyResult}><Copy className="w-4 h-4" />Copy result</button>}
        {gs === 3 && acc && <button className={gBtn} style={{ borderColor: ACCENT }} onClick={() => patch({ guide: false })}><Check className="w-4 h-4" />Finish</button>}
      </div>
    </div>
  ) : (
    <button onClick={() => { patch({ guide: true }); setGs(0); }} className="min-h-11 flex items-center gap-2 text-xs font-mono text-neutral-400 hover:text-white"><HelpCircle className="w-4 h-4" />Show guide</button>
  );

  return (
    <div className={display ? '' : 'max-w-3xl mx-auto px-4 sm:px-6 py-5 space-y-4'}>
      <div ref={wrapRef} className={display ? 'fixed inset-0 z-50 flex items-center justify-center bg-[#05050f]' : ''}>
        <div
          ref={stageRef}
          onDragOver={(ev) => ev.preventDefault()}
          onDrop={(ev) => { ev.preventDefault(); const f = ev.dataTransfer.files[0]; if (f?.type.startsWith('video/')) startFile(f); }}
          className={`relative overflow-hidden bg-[#05050f] mx-auto ${display ? '' : 'rounded-2xl border border-white/10'}`}
          style={{ aspectRatio: ar, width: display ? `min(100vw, calc(100dvh * ${ar}))` : `min(100%, calc(65dvh * ${ar}))` }}
        >
          <video
            ref={videoRef} muted playsInline
            onLoadedMetadata={(ev) => setAr(ev.currentTarget.videoWidth / ev.currentTarget.videoHeight)}
            className="absolute inset-0 w-full h-full" style={{ objectFit: 'fill', opacity: showVideo ? 1 : 0 }}
          />
          <canvas
            ref={ovRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
            className={`absolute inset-0 w-full h-full touch-none ${display ? 'pointer-events-none' : 'cursor-crosshair'}`}
          />
          {!running && modelState === 'ready' && !err && (
            <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-neutral-400 pointer-events-none">
              <span className="max-w-xs">Start the camera or choose a video file. Drag the line ends to place the counting line across the doorway.</span>
            </div>
          )}
          {modelState === 'loading' && (
            <div className="absolute inset-0 grid place-items-center bg-[#05050f]/80 pointer-events-none" aria-live="polite">
              <div className="w-3/5 max-w-xs space-y-3 animate-pulse">
                <div className="h-3 rounded bg-white/10" /><div className="h-3 w-4/5 rounded bg-white/10" /><div className="h-3 w-2/5 rounded bg-white/10" />
                <p className="pt-2 font-mono text-[11px] tracking-widest uppercase text-neutral-500">Loading model</p>
              </div>
            </div>
          )}
          {!display && (
            <div className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 backdrop-blur-sm pointer-events-none">
              <span className={`w-2 h-2 rounded-full ${dot}`} />
              <span className="font-mono text-[11px] tracking-widest uppercase text-neutral-200">{label}</span>
            </div>
          )}
        </div>

        {display && (
          <div className="absolute inset-0 pointer-events-none" style={{ padding: 'max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))' }}>
            <div className="flex items-start justify-between">
              <span className="rounded-full bg-black/60 px-3 py-1.5 font-mono text-[11px] tracking-widest uppercase text-neutral-300">
                {cfg.live ? 'Live video' : 'Privacy view - no video shown'}
              </span>
              <button onClick={() => toggleDisplay(false)} aria-label="Exit display mode" className="pointer-events-auto w-12 h-12 rounded-full bg-black/60 border border-white/20 flex items-center justify-center text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="absolute left-4 bottom-4 rounded-2xl bg-black/70 px-6 py-3 text-center" style={{ bottom: 'max(16px, env(safe-area-inset-bottom))', left: 'max(16px, env(safe-area-inset-left))' }}>
              <div className="font-mono font-medium leading-none tabular-nums" style={{ fontSize: 'min(22vw, 160px)', color: snap.lv ? lvc : '#fff' }}>{snap.occ}</div>
              <div className="mt-1 font-mono text-xs tracking-widest uppercase text-neutral-400">Inside {capTxt}</div>
            </div>
          </div>
        )}
      </div>

      {!display && (
        <>
          {err && (
            <div role="alert" className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200 flex flex-wrap items-center gap-3">
              <span className="flex-1 min-w-[12rem]">{err.text}</span>
              {modelState === 'failed' && <button className={btn} onClick={() => loadModel(cfg.model)}>Retry</button>}
            </div>
          )}
          {gpuWarn && modelState === 'ready' && (
            <div role="status" className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm text-amber-100">GPU unavailable: running on the CPU, which is slower.</div>
          )}

          {guideCard}

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => (running ? stopSrc() : startCam(camId))} disabled={modelState !== 'ready'}
              className="min-h-14 rounded-2xl font-bold text-base text-white flex items-center justify-center gap-2 disabled:opacity-40"
              style={{ background: running ? '#27272a' : ACCENT }}
            >
              {running ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {modelState === 'loading' ? 'Loading model...' : running ? 'Stop' : 'Start camera'}
            </button>
            <button onClick={() => fileRef.current.click()} disabled={modelState !== 'ready'} className={`${btn} min-h-14 flex items-center justify-center gap-2`}>
              <Upload className="w-4 h-4" />Video file
            </button>
            <input ref={fileRef} type="file" accept="video/*" hidden onChange={(ev) => { startFile(ev.target.files[0]); ev.target.value = ''; }} />
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {[['In', snap.in, '#fff'], ['Out', snap.out, '#fff'], ['Inside', snap.occ, snap.lv ? lvc : '#fff']].map(([k, v, c]) => (
              <div key={k} className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-4 text-center">
                <div className="font-mono font-medium text-5xl sm:text-7xl leading-none tabular-nums" style={{ color: c }}>{v}</div>
                <div className="mt-2 font-mono text-[11px] tracking-[0.15em] uppercase text-neutral-500">{k}</div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="h-3 rounded-full bg-black/60 border border-white/10 overflow-hidden">
              <div className="h-full transition-all duration-200" style={{ width: cfg.cap > 0 ? `${Math.min(100, (snap.occ / cfg.cap) * 100)}%` : 0, background: lvc }} />
            </div>
            <div className="mt-2 flex justify-between font-mono text-xs text-neutral-400">
              <span>{cfg.cap > 0 ? `${snap.occ} / ${cfg.cap}${snap.lv === 2 ? ' - FULL' : snap.lv === 1 ? ' - nearly full' : ''}` : 'No capacity limit set'}</span>
              <span>Peak {snap.peak}</span>
            </div>
          </div>

          <button onClick={toggleTest} aria-pressed={testOn} className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 min-h-12">
            <span className="flex items-center gap-2 font-display font-semibold text-sm"><ClipboardCheck className="w-4 h-4" style={{ color: ACCENT }} />Test accuracy</span>
            <span className={`w-11 h-6 rounded-full p-0.5 transition-colors ${testOn ? 'bg-[#2F6BFF]' : 'bg-white/15'}`}>
              <span className={`block w-5 h-5 rounded-full bg-white transition-transform ${testOn ? 'translate-x-5' : ''}`} />
            </span>
          </button>

          {testOn && (
            <div className="rounded-2xl border border-[#2F6BFF]/40 bg-[#2F6BFF]/[0.06] p-4">
              <p className="text-sm text-neutral-300 mb-3">Tap each time a person really crosses. Keyboard: Right arrow = Real IN, Left arrow = Real OUT.</p>
              <div className="grid grid-cols-2 gap-3">
                {[['in', 'Real IN', 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300'], ['out', 'Real OUT', 'border-amber-400/40 bg-amber-400/10 text-amber-300']].map(([d, l, c]) => (
                  <button key={d} onClick={() => tap(d)} className={`min-h-24 rounded-2xl border font-display font-bold text-xl active:scale-[0.98] transition-transform ${c}`}>
                    {l}<span className="block mt-1 font-mono text-xs font-normal opacity-70">{taps.filter((x) => x.dir === d).length} tapped</span>
                  </button>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between font-mono text-xs text-neutral-400">
                <span>{taps.length} of {MIN_TAPS} taps needed</span>
                <button onClick={() => setTaps((t) => t.slice(0, -1))} disabled={!taps.length} className="flex items-center gap-1 min-h-9 px-2 disabled:opacity-40"><Undo2 className="w-3.5 h-3.5" />Undo last</button>
              </div>
              {acc && (
                <div className="mt-4 border-t border-white/10 pt-4">
                  <p className="font-display font-bold text-lg mb-3">{verdict(acc)}</p>
                  <div className="grid grid-cols-3 gap-2 font-mono text-center">
                    {[['Real total', acc.real], ['Counted total', acc.counted], ['Missed', acc.missed], ['Extra', acc.extra], ['Recall', pct(acc.recall)], ['Precision', pct(acc.precision)]].map(([k, v]) => (
                      <div key={k} className="rounded-xl bg-black/30 py-2"><div className="text-xl tabular-nums">{v}</div><div className="text-[10px] tracking-widest uppercase text-neutral-500">{k}</div></div>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-neutral-500">Automatic counts are matched to taps within 1.5 s, one match per tap. Manual +1/-1 are not included.</p>
                  <button onClick={copyResult} className={`${btn} mt-3 flex items-center gap-2`}><Copy className="w-4 h-4" />Copy result</button>
                </div>
              )}
            </div>
          )}

          <div className="rounded-xl border border-white/10 px-4 py-3 font-mono text-xs text-neutral-500">
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              <span>FPS <b className="text-neutral-300 font-medium">{fmt(snap.fps, 0)}</b></span>
              <span>Inference <b className="text-neutral-300 font-medium">{fmt(snap.infL)}</b> / avg <b className="text-neutral-300 font-medium">{fmt(snap.infA)}</b> ms</span>
              <span>Detect to count <b className="text-neutral-300 font-medium">{fmt(snap.latL)}</b> / avg <b className="text-neutral-300 font-medium">{fmt(snap.latA)}</b> ms</span>
            </div>
            <div className="mt-1.5 text-[11px] text-neutral-600">{info ? `Model: ${info}. ` : ''}Measured live on this device. Detect to count runs from frame arrival to count registered and leaves out camera and display delay.</div>
          </div>

          <div className="space-y-2">
            <Section title="Source" defaultOpen>
              <input className={field} placeholder="Session / door name" value={cfg.door} onChange={(ev) => patch({ door: ev.target.value.slice(0, 60) })} />
              <select
                className={field} value={camId} aria-label="Camera"
                onChange={(ev) => { setCamId(ev.target.value); if (running && !videoRef.current.src) startCam(ev.target.value); }}
              >
                <option value="">Default camera</option>
                {cams.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${i + 1}`}</option>)}
              </select>
              <p className="text-xs text-neutral-500">Camera names appear after you allow camera access once. A video file plays on a loop on this device and is never uploaded.</p>
            </Section>

            <Section title="Counting line and detection">
              <div className="grid grid-cols-3 gap-2">
                <button className={btn} onClick={() => { patch({ flip: !cfg.flip }); resetSides(); }}>Flip direction</button>
                <button className={`${btn} ${roiOn ? '!border-amber-400 !text-amber-300' : ''}`} onClick={() => { e.roiMode = !e.roiMode; setRoiOn(e.roiMode); }}>{roiOn ? 'Drag region' : 'Set region'}</button>
                <button className={btn} onClick={() => { e.roi = null; e.tracks = []; save(e); draw(performance.now()); }}>Clear region</button>
              </div>
              <Slider label="Confidence" value={cfg.conf} min={0.2} max={0.9} step={0.05} onChange={(v) => { patch({ conf: v }); e.det?.setOptions({ scoreThreshold: v }); }} />
              <Slider label="Detect every N frames" value={cfg.n} min={1} max={6} step={1} onChange={(v) => patch({ n: v })} />
              <select className={field} aria-label="Model" value={cfg.model} onChange={(ev) => { e.tracks = []; patch({ model: ev.target.value }); }}>
                <option value="lite">Lite0 (320px, lighter)</option>
                <option value="large">Lite2 (448px, larger model)</option>
              </select>
              <p className="text-xs text-neutral-500">The arrow on the line points toward IN. Drag either white dot to move the line. A region limits detection to part of the picture.</p>
            </Section>

            <Section title="Capacity and manual correction">
              <label className="block text-xs text-neutral-400">Limit (0 = off)
                <input className={`${field} mt-1`} type="number" inputMode="numeric" min="0" value={cfg.cap || ''} placeholder="0" onChange={(ev) => patch({ cap: Math.max(0, +ev.target.value || 0) })} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button className={`${btn} min-h-14 flex items-center justify-center gap-2`} onClick={() => record('in', 'manual+')}><Plus className="w-4 h-4" />1 manual</button>
                <button className={`${btn} min-h-14 flex items-center justify-center gap-2`} onClick={() => record('out', 'manual-')}><Minus className="w-4 h-4" />1 manual</button>
              </div>
              <p className="text-xs text-neutral-500">A beep sounds at 85% and again at 100% of the limit. Manual corrections count toward IN and OUT and are marked in the export.</p>
            </Section>

            <Section title="Display and privacy">
              <button className={`${btn} min-h-14 w-full flex items-center justify-center gap-2`} onClick={() => toggleDisplay(true)}><Maximize className="w-4 h-4" />Display mode (door-side screen)</button>
              <button onClick={() => patch({ live: !cfg.live })} aria-pressed={cfg.live} className={`${btn} w-full flex items-center justify-between`}>
                <span className="flex items-center gap-2">{cfg.live ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}Show live video in display mode</span>
                <span className="font-mono text-xs text-neutral-400">{cfg.live ? 'On' : 'Off'}</span>
              </button>
              <p className="text-xs text-neutral-500">
                Display mode starts as a privacy view: dark screen with boxes and the counting line, no live video. All processing stays on this device.
                No video, frame or image is uploaded or saved. Only the detection library and model file are downloaded when the page loads.
              </p>
            </Section>

            <Section title="History and export">
              <OccChart e={e} snap={snap} />
              <div className="grid grid-cols-2 gap-3">
                <button className={`${btn} flex items-center justify-center gap-2`} onClick={() => download(fname('json'), 'application/json', JSON.stringify(report(e), null, 2))}><Download className="w-4 h-4" />Report (JSON)</button>
                <button className={`${btn} flex items-center justify-center gap-2`} onClick={() => download(fname('csv'), 'text/csv', `timestamp,direction,source\n${e.events.map((ev) => `${new Date(ev.t).toISOString()},${ev.dir},${ev.src}`).join('\n')}`)}><Download className="w-4 h-4" />Crossings (CSV)</button>
              </div>
              <button className={`${btn} w-full !text-red-300`} onClick={resetSession}>Reset session</button>
            </Section>
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LANDING PREVIEW — decorative loop, shows no measurements
// ═══════════════════════════════════════════════════════════════════════════
function DoorPreview() {
  return (
    <div className="rounded-2xl border border-white/10 bg-black p-3">
      <svg viewBox="0 0 320 200" className="w-full" role="img" aria-label="Illustration: a tracked person box crossing the counting line">
        <rect width="320" height="200" fill="#07070f" />
        <line x1="30" y1="100" x2="290" y2="100" stroke="#fff" strokeWidth="3">
          <animate attributeName="stroke" values="#fff;#fff;#3ecf8e;#fff;#fff" keyTimes="0;0.5;0.55;0.7;1" dur="5s" repeatCount="indefinite" />
        </line>
        <circle cx="30" cy="100" r="7" fill="#fff" /><circle cx="290" cy="100" r="7" fill="#fff" />
        <path d="M60 100 v-24 m-6 8 l6 -8 l6 8" stroke="#fff" strokeWidth="2" fill="none" />
        <text x="72" y="82" fill="#fff" fontFamily="DM Mono, monospace" fontSize="11">IN</text>
        <g>
          <rect x="-24" y="-44" width="48" height="88" rx="3" fill="none" stroke={ACCENT} strokeWidth="2.5" />
          <text x="-20" y="-50" fill={ACCENT} fontFamily="DM Mono, monospace" fontSize="11">#1</text>
          <animateTransform attributeName="transform" type="translate" values="180 175;180 25" dur="5s" repeatCount="indefinite" />
        </g>
        <text x="312" y="192" textAnchor="end" fill="#52525b" fontFamily="DM Mono, monospace" fontSize="9">ILLUSTRATION</text>
      </svg>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════════
export default function DoorCount() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('landing'); // landing | tool

  return (
    <div className="min-h-screen bg-[#05050f] text-white" style={{ paddingTop: 'var(--safe-top, 0px)', paddingBottom: 'var(--safe-bottom, 0px)' }}>
      <BetaBar
        featureId="door-count"
        title="BETA DEMO — counts bodies in a camera view, not identities"
        description="Door Count detects people in the camera picture on this device and counts them crossing a line you draw. Crowds, low light and steep camera angles reduce accuracy, so test it at your real door before relying on it. Video is processed on this device and is never uploaded or saved."
      />
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-white/[0.06]">
        <button onClick={() => (mode === 'tool' ? setMode('landing') : navigate('/'))} className="flex items-center gap-2 text-neutral-400 hover:text-white text-sm -ml-2 px-2 min-h-11 rounded-lg">
          <ArrowLeft className="w-4 h-4" />Back
        </button>
        <div className="flex items-center gap-2 font-display font-bold tracking-tight text-sm"><Users className="w-4 h-4" style={{ color: ACCENT }} />Door Count</div>
        <div className="w-16" />
      </div>

      {mode === 'landing' ? (
        <LabLanding
          accent={ACCENT}
          headline={<>Headcount you<br />can measure on<br />your own door.</>}
          body="Point a phone at a doorway, draw a line, and count people in and out right on the device. Then check the count against real people at your real door."
          primary={{ label: 'Open the counter', icon: Camera, onClick: () => setMode('tool') }}
          footnote="Nothing leaves your device"
          preview={<DoorPreview />}
          steps={[
            { title: 'Set the line', body: 'Drag the two ends of the counting line across the doorway and point the arrow toward IN.', icon: Move },
            { title: 'Count', body: 'People are detected and tracked on the device. Each crossing adds to IN or OUT, with a capacity bar and beeps.', icon: Users },
            { title: 'Test your accuracy', body: 'Tap Real IN and Real OUT as people actually cross, then see how many the counter caught and how many were extra.', icon: ClipboardCheck },
          ]}
          notes={[
            'Crowds and people walking close together are undercounted.',
            'Low light and steep camera angles hurt accuracy.',
            'It counts bodies, not identities. It cannot tell who anyone is.',
            'Test at the real door, with the real camera position, before relying on the numbers.',
            'The detection library and model file are downloaded from public CDNs when the counter opens. No video, frame or image is uploaded or saved.',
          ]}
        />
      ) : (
        <Counter />
      )}
    </div>
  );
}
