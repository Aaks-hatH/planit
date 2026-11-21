import { useRef, useState, useEffect, useCallback } from 'react';
import {
  FEATURE_ID, createTracker, createSession, detectCrossings, loadSession, saveSession, cameraMessage, capacityLevel,
} from '../utils/doorCount';
import { DoorDetector, DoorCountError } from '../utils/doorCountModel';
import { createQualityMonitor, measureFrame } from '../utils/doorCountQuality';
import { logBetaEvent } from '../utils/betaDiagnostics';

const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const keep = (a, v) => { a.push(v); if (a.length > 30) a.shift(); };

/**
 * Live counting: camera or video file -> detector -> tracker -> crossing rules.
 * phase: 'idle' (no source) | 'setup' (source on, quality check, not counting) | 'counting'.
 * Frames only ever go to the local detector; nothing here uses the network
 * except the model load in utils/doorCountModel.js.
 */
export default function useDoorLive({ settings, perfRef }) {
  const videoRef = useRef(null);
  const live = useRef({ tracks: [], flash: null });     // read by the stage's draw loop
  const sRef = useRef(settings);
  sRef.current = settings;
  const det = useRef(null);
  const phaseRef = useRef('idle');
  const wl = useRef(null);
  const audio = useRef(null);
  const saveTimer = useRef(0);
  const loadToken = useRef(0);
  const lastBoxes = useRef([]);
  const P = useRef({ inf: [], lat: [], fps: 0, latLast: null }).current;
  const L = useRef({ raf: 0, lastT: -1, frameNo: 0, fpsFrames: 0, fpsT: 0 }).current;

  const [tracker] = useState(createTracker);
  const [session] = useState(() => createSession(loadSession()));
  const [quality] = useState(createQualityMonitor);
  const [qCanvas] = useState(() => document.createElement('canvas'));

  const [counts, setCounts] = useState(session.counts);
  const [phase, setPhaseState] = useState('idle');
  const [error, setError] = useState('');
  const [model, setModel] = useState({ state: 'loading', message: 'Loading', info: null });
  const [stats, setStats] = useState({ fps: null, inferLast: null, inferAvg: null, latLast: null, latAvg: null });
  const [setup, setSetup] = useState(null);
  const [cams, setCams] = useState([]);
  const [camId, setCamId] = useState('');

  const setPhase = (p) => { phaseRef.current = p; setPhaseState(p); };

  // ─── Wake lock and audio ─────────────────────────────────────────────────
  const wake = useCallback(async () => {
    try {
      if ('wakeLock' in navigator && phaseRef.current !== 'idle') wl.current = await navigator.wakeLock.request('screen');
    } catch { /* not supported or refused: the screen may dim */ }
  }, []);
  const unlockAudio = useCallback(() => {
    try { audio.current ??= new AudioContext(); audio.current.resume(); } catch { /* no audio */ }
  }, []);
  const beep = useCallback((n) => {
    try {
      unlockAudio();
      const ac = audio.current;
      for (let i = 0; i < n; i++) {
        const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + i * 0.22;
        o.connect(g); g.connect(ac.destination);
        o.frequency.value = n > 1 ? 880 : 660;
        g.gain.setValueAtTime(0.15, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        o.start(t); o.stop(t + 0.2);
      }
    } catch { /* audio blocked */ }
  }, [unlockAudio]);

  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') wake(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [wake]);

  // Capacity alert: one beep when entering the warning band, two when full.
  const prevLevel = useRef(0);
  useEffect(() => {
    const lv = capacityLevel(counts.in - counts.out, settings.cap);
    if (lv > prevLevel.current) beep(lv === 2 ? 2 : 1);
    prevLevel.current = lv;
  }, [counts, settings.cap, beep]);

  // ─── Session ─────────────────────────────────────────────────────────────
  const persistSoon = useCallback(() => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveSession(session.data), 500);
  }, [session]);

  const record = useCallback((dir, src, latency) => {
    if (!session.add(dir, src)) return;
    setCounts({ ...session.counts });
    live.current.flash = { dir, t: performance.now() };
    if (latency != null) { keep(P.lat, latency); P.latLast = latency; }
    persistSoon();
  }, [session, persistSoon, P]);

  const resetSession = useCallback(() => {
    session.reset();
    setCounts({ ...session.counts });
    persistSoon();
  }, [session, persistSoon]);

  // ─── Model ───────────────────────────────────────────────────────────────
  const loadModel = useCallback(async (modelId) => {
    const token = ++loadToken.current;
    det.current?.close();
    det.current = null;
    setModel({ state: 'loading', message: 'Loading', info: null });
    const d = new DoorDetector();
    try {
      const info = await d.load(modelId, sRef.current.conf, (message) => {
        if (token === loadToken.current) setModel((m) => ({ ...m, message }));
      });
      if (token !== loadToken.current) { d.close(); return; }
      det.current = d;
      tracker.clear();
      setModel({ state: 'ready', message: '', info });
      logBetaEvent(FEATURE_ID, 'model-ready', { model: modelId, delegate: info.delegate, source: info.source });
    } catch (e) {
      if (token !== loadToken.current) return;
      const message = e instanceof DoorCountError ? e.message : 'The detection model could not be loaded.';
      setModel({ state: 'error', message, info: null });
      logBetaEvent(FEATURE_ID, 'model-error', { model: modelId, code: e.code || 'UNKNOWN' });
    }
  }, [tracker]);

  useEffect(() => { loadModel(settings.model); }, [settings.model, loadModel]);
  useEffect(() => { det.current?.setConf(settings.conf); }, [settings.conf]);

  // ─── Frame loop: detect every N frames, track in between ─────────────────
  const detectStep = useCallback((d, v, tF) => {
    const s = sRef.current;
    let res;
    try { res = d.detect(v, s.roi); } catch { return; }
    keep(P.inf, res.inferMs);
    const twoLine = s.gateMode === 'two';
    const matched = tracker.update(res.boxes, tF);
    live.current.tracks = tracker.tracks;
    lastBoxes.current = res.boxes;
    quality.onDetections(res.boxes, s.gate, twoLine, v.videoWidth, v.videoHeight);
    if (phaseRef.current !== 'counting') return;
    const events = detectCrossings(matched, tF, v.videoWidth, v.videoHeight, { gate: s.gate, twoLine, flip: s.flip });
    for (const e of events) record(e.dir, 'auto', performance.now() - tF);
  }, [tracker, quality, record, P]);

  const loop = useCallback(() => {
    L.raf = requestAnimationFrame(loop);
    const v = videoRef.current;
    if (!v || !v.videoWidth || v.currentTime === L.lastT) return; // no new frame
    const tF = performance.now();
    if (v.currentTime < L.lastT - 0.5) tracker.clear();           // a clip file looped
    L.lastT = v.currentTime;
    L.frameNo++; L.fpsFrames++;
    if (tF - L.fpsT >= 1000) { P.fps = (L.fpsFrames * 1000) / (tF - L.fpsT); L.fpsFrames = 0; L.fpsT = tF; }
    if (det.current && L.frameNo % sRef.current.n === 0) detectStep(det.current, v, tF);
  }, [L, P, tracker, detectStep]);

  // ─── Sources ─────────────────────────────────────────────────────────────
  const stopSource = useCallback(() => {
    cancelAnimationFrame(L.raf);
    const v = videoRef.current;
    if (v) {
      v.srcObject?.getTracks().forEach((t) => t.stop());
      v.srcObject = null;
      if (v.src) URL.revokeObjectURL(v.src);
      v.removeAttribute('src');
      v.load();
    }
    try { wl.current?.release(); } catch { /* already released */ }
    wl.current = null;
    tracker.clear();
    live.current.tracks = [];
    quality.reset();
    setSetup(null);
    setPhase('idle');
  }, [L, tracker, quality]);

  const begin = useCallback(() => {
    setPhase('setup');
    L.lastT = -1; L.frameNo = 0; L.fpsFrames = 0; L.fpsT = performance.now();
    wake();
    cancelAnimationFrame(L.raf);
    L.raf = requestAnimationFrame(loop);
  }, [L, loop, wake]);

  const listCams = useCallback(async () => {
    try {
      const all = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
      setCams(all.map((d, i) => ({ id: d.deviceId, label: d.label || `Camera ${i + 1}` })));
    } catch { /* the list is optional */ }
  }, []);

  const startCamera = useCallback(async () => {
    setError('');
    if (!window.isSecureContext) { setError(cameraMessage(new Error('INSECURE'))); return; }
    if (!navigator.mediaDevices?.getUserMedia) { setError(cameraMessage(new Error('UNSUPPORTED'))); return; }
    unlockAudio();
    stopSource();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: camId ? { exact: camId } : undefined,
          facingMode: camId ? undefined : { ideal: 'environment' },
          width: { ideal: 1280 }, height: { ideal: 720 },
        },
        audio: false,
      });
      const v = videoRef.current;
      v.srcObject = stream;
      v.loop = false;
      await v.play();
      listCams();
      begin();
    } catch (e) {
      setError(cameraMessage(e));
      logBetaEvent(FEATURE_ID, 'camera-error', { name: e?.name });
    }
  }, [camId, begin, listCams, stopSource, unlockAudio]);

  const startFile = useCallback((file) => {
    setError('');
    unlockAudio();
    stopSource();
    const v = videoRef.current;
    v.src = URL.createObjectURL(file);
    v.loop = true;
    v.muted = true;
    v.play().then(begin).catch(() => setError('This video file could not be played by the browser. Try an MP4 (H.264) or WebM file.'));
  }, [begin, stopSource, unlockAudio]);

  const startCounting = useCallback(() => { unlockAudio(); setPhase('counting'); }, [unlockAudio]);
  const pauseCounting = useCallback(() => setPhase('setup'), []);

  // ─── Timers: stats panel, quality check, occupancy samples ───────────────
  useEffect(() => {
    const statsId = setInterval(() => {
      const v = {
        fps: P.fps || null, inferLast: P.inf.length ? P.inf[P.inf.length - 1] : null, inferAvg: avg(P.inf),
        latLast: P.latLast, latAvg: avg(P.lat),
      };
      setStats(v);
      perfRef.current = { inferAvg: v.inferAvg, fps: v.fps, delegate: det.current?.info?.delegate ?? null };
    }, 250);
    let tick = 0;
    const qualityId = setInterval(() => {
      const v = videoRef.current;
      if (phaseRef.current === 'idle' || !v) return;
      quality.onFrame(measureFrame(v, qCanvas, lastBoxes.current));
      if (++tick % 2 === 0) setSetup(quality.snapshot(sRef.current.gate, sRef.current.gateMode === 'two', v.videoWidth, v.videoHeight));
    }, 500);
    const sampleId = setInterval(() => {
      if (phaseRef.current === 'counting') { session.sample(); persistSoon(); }
    }, 10000);
    return () => { clearInterval(statsId); clearInterval(qualityId); clearInterval(sampleId); };
  }, [P, perfRef, quality, qCanvas, session, persistSoon]);

  useEffect(() => () => {
    loadToken.current++;
    stopSource();
    det.current?.close();
    clearTimeout(saveTimer.current);
    saveSession(session.data);
    try { audio.current?.close(); } catch { /* already closed */ }
  }, [stopSource, session]);

  return {
    videoRef, live, session, counts, phase, error, setError, model, stats, setup, cams, camId, setCamId,
    startCamera, startFile, stopSource, startCounting, pauseCounting, record, resetSession,
    retryModel: () => loadModel(sRef.current.model),
    resetSides: () => tracker.resetSides(),
    clearTracks: () => { tracker.clear(); live.current.tracks = []; },
  };
}
