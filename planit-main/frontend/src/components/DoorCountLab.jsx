import { useState, useRef, useEffect, useCallback } from 'react';
import { FileVideo, Circle, Square, Play, Pause, Undo2, Trash2, ArrowRight, ArrowLeft, Loader2, X } from 'lucide-react';
import toast from '../utils/toast';
import { cameraMessage, FEATURE_ID } from '../utils/doorCount';
import { MODELS } from '../utils/doorCountModel';
import { buildPresets, runLab, prepareClip, INTERVALS, GATES, TOLERANCE_S } from '../utils/doorCountLab';
import { ACCENT } from '../utils/doorCountDraw';
import { logBetaEvent } from '../utils/betaDiagnostics';
import DoorCountStage from './DoorCountStage';
import DoorCountLabResults from './DoorCountLabResults';
import { Card, btn, btnPrimary } from './DoorCountPanels';

const MAX_RECORD_S = 90; // recordings live in memory only, so keep them short
const NO_LIVE = { current: { tracks: [], flash: null } };

const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// Chips that toggle one option in a set, never leaving the set empty.
function Chips({ label, options, value, onChange, disabled }) {
  const toggle = (id) => {
    const next = value.includes(id) ? value.filter((v) => v !== id) : [...value, id];
    if (next.length) onChange(next);
  };
  return (
    <div className="mb-3">
      <div className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value.includes(o.id);
          return (
            <button key={o.id} disabled={disabled} onClick={() => toggle(o.id)} aria-pressed={on}
              className={`min-h-[44px] px-4 rounded-full border text-sm ${on ? 'text-[#05050f] font-semibold border-transparent' : 'border-white/15 text-neutral-300'} disabled:opacity-40`}
              style={on ? { background: ACCENT } : undefined}>{o.label}</button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Accuracy Lab: label real crossings on a clip, replay the clip once per preset,
 * and compare each preset's counts with the labels. Clips stay in this tab's
 * memory: nothing is uploaded, and recordings are never saved to disk.
 */
export default function DoorCountLab({ settings, patch, onResult }) {
  const videoRef = useRef(null);
  const previewRef = useRef(null);
  const recorder = useRef(null);
  const abort = useRef(null);
  const urlRef = useRef(null);
  const tapSeq = useRef(0);               // order labels were added, so Undo removes the newest one

  const [clip, setClip] = useState(null);      // { url, name, seconds, w, h }
  const [taps, setTaps] = useState([]);        // ground truth: [{ tm (s), dir }]
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState(1);
  const [rec, setRec] = useState(null);        // { elapsed } while recording
  const [err, setErr] = useState('');
  const [models, setModels] = useState(['lite', 'large']);
  const [intervals, setIntervals] = useState(INTERVALS);
  const [gates, setGates] = useState(['one', 'two']);
  const [run, setRun] = useState({ status: 'idle', done: 0, total: 1, phase: '' });
  const [result, setResult] = useState(null);

  const running = run.status === 'running';
  const nIn = taps.filter((t) => t.dir === 'in').length;
  const nOut = taps.length - nIn;
  const presetCount = models.length * intervals.length * gates.length;
  const base = { conf: settings.conf, roi: settings.roi, gate: settings.gate, flip: settings.flip };
  const stale = !!result && (JSON.stringify(result.base) !== JSON.stringify(base) || result.taps !== taps.length);

  const dropClip = useCallback(() => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    const v = videoRef.current;
    if (v) { v.pause(); v.removeAttribute('src'); v.load(); }
    setClip(null); setTaps([]); setResult(null); setTime(0); setPlaying(false);
    onResult(null);
  }, [onResult]);

  const loadClip = useCallback(async (url, name) => {
    dropClip();
    setErr('');
    urlRef.current = url;
    const v = videoRef.current;
    v.src = url;
    try {
      const meta = await prepareClip(v);
      setClip({ url, name, ...meta });
    } catch (e) {
      URL.revokeObjectURL(url);
      urlRef.current = null;
      v.removeAttribute('src');
      setErr(e.message);
    }
  }, [dropClip]);

  // ─── Recording (kept in memory only) ─────────────────────────────────────
  const stopRecording = useCallback(() => recorder.current?.state === 'recording' && recorder.current.stop(), []);

  const startRecording = async () => {
    setErr('');
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { setErr(cameraMessage(new Error(window.isSecureContext ? 'UNSUPPORTED' : 'INSECURE'))); return; }
    if (typeof MediaRecorder === 'undefined') { setErr('This browser cannot record video. Load a video file instead.'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false,
      });
      previewRef.current.srcObject = stream;
      await previewRef.current.play();
      const mime = ['video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t));
      const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks = [];
      const started = Date.now();
      const timer = setInterval(() => {
        const elapsed = (Date.now() - started) / 1000;
        setRec({ elapsed });
        if (elapsed >= MAX_RECORD_S) stopRecording();
      }, 250);
      mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      mr.onstop = () => {
        clearInterval(timer);
        stream.getTracks().forEach((t) => t.stop());
        previewRef.current.srcObject = null;
        setRec(null);
        loadClip(URL.createObjectURL(new Blob(chunks, { type: mr.mimeType || mime })), 'Recorded clip');
      };
      mr.onerror = () => { setErr('Recording failed. Try again, or load a video file.'); };
      recorder.current = mr;
      mr.start(1000);
      setRec({ elapsed: 0 });
    } catch (e) {
      setErr(cameraMessage(e));
    }
  };

  // ─── Labeling ────────────────────────────────────────────────────────────
  const tap = useCallback((dir) => {
    const v = videoRef.current;
    if (!v || !v.src) return;
    setTaps((t) => [...t, { tm: v.currentTime, dir, id: ++tapSeq.current }].sort((a, b) => a.tm - b.tm));
  }, []);

  useEffect(() => {
    if (!clip || running) return undefined;
    const onKey = (e) => {
      if (e.repeat || (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft')) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      e.preventDefault();
      tap(e.key === 'ArrowRight' ? 'in' : 'out');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [clip, running, tap]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return undefined;
    const onTime = () => setTime(v.currentTime);
    const onPlay = () => setPlaying(true), onPause = () => setPlaying(false);
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('ended', onPause);
    return () => { v.removeEventListener('timeupdate', onTime); v.removeEventListener('play', onPlay); v.removeEventListener('pause', onPause); v.removeEventListener('ended', onPause); };
  }, []);

  useEffect(() => { if (videoRef.current) videoRef.current.playbackRate = rate; }, [rate, clip]);

  // Leaving the tab releases the clip, the camera and any running replay.
  useEffect(() => () => {
    abort.current?.abort();
    if (recorder.current?.state === 'recording') { recorder.current.onstop = null; recorder.current.stop(); recorder.current.stream.getTracks().forEach((t) => t.stop()); }
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
  }, []);

  // ─── Replay ──────────────────────────────────────────────────────────────
  const start = async () => {
    if (!clip || !taps.length) return;
    videoRef.current.pause();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setErr('');
    setRun({ status: 'running', done: 0, total: 1, phase: 'Starting' });
    try {
      const out = await runLab({
        url: clip.url, truth: taps, presets: buildPresets(models, intervals, gates), base, signal: ctrl.signal,
        onProgress: (p) => setRun({ status: 'running', ...p }),
      });
      const full = { ...out, base, taps: taps.length, nIn, nOut };
      setResult(full);
      onResult(full);
      setRun({ status: 'done', done: 0, total: 1, phase: '' });
      logBetaEvent(FEATURE_ID, 'lab-complete', { presets: out.rows.length, taps: taps.length });
    } catch (e) {
      if (e.name === 'AbortError') { setRun({ status: 'idle', done: 0, total: 1, phase: '' }); toast('Replay cancelled'); return; }
      setErr(e.code ? e.message : 'The replay failed. Reload the page and try a shorter clip.');
      setRun({ status: 'error', done: 0, total: 1, phase: '' });
      logBetaEvent(FEATURE_ID, 'lab-error', { code: e.code || 'UNKNOWN' });
    }
  };

  const apply = (preset) => {
    patch({ model: preset.model, n: preset.n, gateMode: preset.gate });
    toast.success(`Applied: ${preset.label}`);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5">
    <div className="grid lg:grid-cols-[minmax(0,1fr)_380px] gap-5">
      <div className="space-y-3 min-w-0">
        <div className="relative">
          <DoorCountStage
            videoRef={videoRef} liveRef={NO_LIVE} settings={settings} onChange={patch} mode="both"
            interactive={!running && !!clip}
            idle={!clip && !rec && 'Load a video file or record a short clip, then label each real crossing.'}
          />
          <video ref={previewRef} muted playsInline className={`absolute inset-0 w-full h-full rounded-xl bg-black ${rec ? '' : 'hidden'}`} style={{ objectFit: 'contain' }} />
          {rec && (
            <div className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-black/70 px-3 py-1.5 font-mono text-xs">
              <Circle className="w-3 h-3 fill-rose-500 text-rose-500 animate-pulse" />Recording {mmss(rec.elapsed)} of {mmss(MAX_RECORD_S)}, kept in memory only
            </div>
          )}
        </div>

        {err && <div role="alert" className="rounded-lg border border-rose-400/40 bg-rose-400/10 px-3 py-2.5 text-sm text-rose-200">{err}</div>}

        <div className="flex flex-wrap gap-2">
          {!rec && (
            <>
              <label className={`${btn} inline-flex items-center cursor-pointer ${running ? 'opacity-40 pointer-events-none' : ''}`}>
                <FileVideo className="w-4 h-4 mr-2" />Load video file
                <input type="file" accept="video/*" hidden onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) loadClip(URL.createObjectURL(f), f.name); }} />
              </label>
              <button className={btn} disabled={running} onClick={startRecording}><Circle className="inline w-4 h-4 mr-2 text-rose-400" />Record a short clip</button>
            </>
          )}
          {rec && <button className={btnPrimary} style={{ background: ACCENT }} onClick={stopRecording}><Square className="inline w-4 h-4 mr-2" />Stop recording</button>}
          {clip && !rec && <button className={btn} disabled={running} onClick={dropClip}><Trash2 className="inline w-4 h-4 mr-2" />Remove clip</button>}
        </div>

        {clip && (
          <Card title={`Step 1: label real crossings (${clip.name}, ${mmss(clip.seconds)})`}>
            <p className="text-xs text-neutral-400 mb-3">
              Play the clip and tap IN or OUT at each real crossing. Keyboard: Right arrow is IN, Left arrow is OUT.
              Tap as the person crosses the line; a short reaction delay is fine, since matching allows +/- {TOLERANCE_S} s.
              Label every crossing, including the ones you expect the counter to miss.
            </p>
            <div className="flex items-center gap-2 mb-2">
              <button className={btn} onClick={() => { const v = videoRef.current; if (v.paused) v.play(); else v.pause(); }} disabled={running} aria-label={playing ? 'Pause' : 'Play'}>
                {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              <input type="range" min="0" max={clip.seconds} step="0.01" value={time} disabled={running} aria-label="Position in clip"
                onChange={(e) => { videoRef.current.currentTime = +e.target.value; }} className="flex-1 min-h-[44px]" />
              <span className="font-mono text-xs tabular-nums w-12 text-right">{mmss(time)}</span>
              <button className={btn} onClick={() => setRate((r) => (r === 1 ? 0.5 : 1))} aria-label="Playback speed">{rate}x</button>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <button className="min-h-[56px] rounded-xl font-bold text-[#05050f] bg-emerald-400 disabled:opacity-40" disabled={running} onClick={() => tap('in')}>
                <ArrowRight className="inline w-5 h-5 mr-1.5" />IN
              </button>
              <button className="min-h-[56px] rounded-xl font-bold text-[#05050f] bg-amber-400 disabled:opacity-40" disabled={running} onClick={() => tap('out')}>
                <ArrowLeft className="inline w-5 h-5 mr-1.5" />OUT
              </button>
            </div>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="font-mono tabular-nums">{taps.length} labeled ({nIn} in, {nOut} out)</span>
              <span className="flex gap-2">
                <button className={btn} disabled={!taps.length || running} onClick={() => setTaps((t) => { const newest = Math.max(...t.map((x) => x.id)); return t.filter((x) => x.id !== newest); })}><Undo2 className="inline w-4 h-4 mr-1" />Undo</button>
                <button className={btn} disabled={!taps.length || running} onClick={() => setTaps([])}>Clear</button>
              </span>
            </div>
            {taps.length > 0 && (
              <ul className="max-h-40 overflow-y-auto divide-y divide-white/5 text-sm font-mono">
                {taps.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 py-1">
                    <button className="flex-1 text-left min-h-[40px]" onClick={() => { videoRef.current.currentTime = Math.max(0, t.tm - 1); }}>
                      {mmss(t.tm)}.{String(Math.floor((t.tm % 1) * 10))} <span className={t.dir === 'in' ? 'text-emerald-400' : 'text-amber-400'}>{t.dir.toUpperCase()}</span>
                    </button>
                    <button aria-label="Delete label" className="min-w-[40px] min-h-[40px] grid place-items-center text-neutral-500" onClick={() => setTaps((all) => all.filter((x) => x.id !== t.id))}><X className="w-4 h-4" /></button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>

      <div className="space-y-3 min-w-0">
        <Card title="Step 2: replay and compare">
          <p className="text-xs text-neutral-400 mb-3">
            Place the gate on the video: drag the dots and the diamond. The solid lines are the two-line gate; the dotted center line is the one-line setting.
            Each preset below is replayed on your clip as fast as this device can decode it.
          </p>
          <Chips label="Models" value={models} onChange={setModels} disabled={running} options={Object.values(MODELS).map((m) => ({ id: m.id, label: m.label }))} />
          <Chips label="Detect every N frames" value={intervals} onChange={setIntervals} disabled={running} options={INTERVALS.map((n) => ({ id: n, label: String(n) }))} />
          <Chips label="Counting method" value={gates} onChange={setGates} disabled={running} options={GATES} />

          {!taps.length && <p className="text-sm text-amber-300 mb-3">No crossings labeled yet, so there is nothing to measure against and no accuracy will be shown. Label the crossings in step 1 first.</p>}

          {running ? (
            <>
              <div className="h-2.5 rounded-full bg-black/40 border border-white/10 overflow-hidden mb-2" role="progressbar" aria-valuenow={run.done} aria-valuemax={run.total}>
                <div className="h-full" style={{ width: `${Math.min(100, (run.done / run.total) * 100)}%`, background: ACCENT }} />
              </div>
              <p className="text-xs text-neutral-400 mb-3"><Loader2 className="inline w-3.5 h-3.5 mr-1 animate-spin" />{run.phase}: {run.done} of {run.total} frames. Keep this tab open.</p>
              <button className={`${btn} w-full`} onClick={() => abort.current?.abort()}>Cancel</button>
            </>
          ) : (
            <button className={`${btnPrimary} w-full`} style={{ background: ACCENT }} disabled={!clip || !taps.length || !!rec} onClick={start}>
              Run {presetCount} {presetCount === 1 ? 'preset' : 'presets'}
            </button>
          )}
          <p className="text-xs text-neutral-600 mt-3">Time depends on the clip length and this device. The detection library and model load first.</p>
        </Card>
      </div>
    </div>
    {result && <div className="mt-5"><DoorCountLabResults result={result} stale={stale} onApply={apply} /></div>}
    </div>
  );
}
