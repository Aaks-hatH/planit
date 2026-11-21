import { useState, useRef, useEffect, useCallback } from 'react';
import { Video, FileVideo, Square, Play, Pause, Maximize, EyeOff, Eye, Download, RotateCcw, Loader2, AlertTriangle, X } from 'lucide-react';
import useDoorLive from '../hooks/useDoorLive';
import { buildReport, buildCsv, exportName, capacityLevel } from '../utils/doorCount';
import { ACCENT } from '../utils/doorCountDraw';
import DoorCountStage from './DoorCountStage';
import DoorCountChart from './DoorCountChart';
import DoorCountReconcile from './DoorCountReconcile';
import { Card, CountersCard, PerformanceCard, SetupCheck, ControlsCard, btn, btnPrimary } from './DoorCountPanels';

function download(name, type, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const Banner = ({ tone, children, action }) => {
  const tones = {
    error: 'border-rose-400/40 bg-rose-400/10 text-rose-200',
    warn: 'border-amber-400/40 bg-amber-400/10 text-amber-200',
    info: 'border-sky-400/40 bg-sky-400/10 text-sky-200',
  };
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${tones[tone]}`}>
      <span className="flex-1">{children}</span>
      {action}
    </div>
  );
};

const LEVEL_COLOR = ['#FFFFFF', '#F5B942', '#FF5D5D'];

/** The Count tab: setup check, live counting, display mode, reconciliation, export. */
export default function DoorCountLive({ settings, patch, perfRef }) {
  const L = useDoorLive({ settings, perfRef });
  const [roiMode, setRoiMode] = useState(false);
  const [display, setDisplay] = useState(false);
  const [previewPrivacy, setPreviewPrivacy] = useState(false);
  const fileRef = useRef(null);
  const reconRef = useRef(null);

  const running = L.phase !== 'idle';
  const occ = L.counts.in - L.counts.out;
  const lv = capacityLevel(occ, settings.cap);
  const privacy = display ? settings.displayView === 'privacy' : previewPrivacy;

  // Display mode: try real fullscreen; where it is unavailable (iOS Safari) the
  // overlay still fills the viewport. Escape or the Exit button leaves it.
  const enterDisplay = () => {
    setDisplay(true);
    document.documentElement.requestFullscreen?.().catch(() => {});
  };
  const exitDisplay = useCallback(() => {
    setDisplay(false);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }, []);
  useEffect(() => {
    if (!display) return undefined;
    const onFs = () => { if (!document.fullscreenElement) setDisplay(false); };
    const onKey = (e) => { if (e.key === 'Escape') exitDisplay(); };
    document.addEventListener('fullscreenchange', onFs);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('fullscreenchange', onFs); document.removeEventListener('keydown', onKey); };
  }, [display, exitDisplay]);

  const model = L.model;
  const modelReady = model.state === 'ready';
  const exportJson = () => download(exportName(settings.door, 'json'), 'application/json',
    JSON.stringify(buildReport(L.session, settings, reconRef.current), null, 2));
  const exportCsv = () => download(exportName(settings.door, 'csv'), 'text/csv', buildCsv(L.session.data.events));

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 grid lg:grid-cols-[minmax(0,1fr)_380px] gap-5">
      <div className="space-y-3 min-w-0">
        <div className={display ? 'fixed inset-0 z-[80] bg-[#05050f] flex items-center' : ''}
          style={display ? { paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' } : undefined}>
          <DoorCountStage
            videoRef={L.videoRef} liveRef={L.live} settings={settings} mode={settings.gateMode}
            privacy={privacy} interactive={!display} fit={display ? 'screen' : 'width'}
            roiMode={roiMode} onRoiDone={() => { setRoiMode(false); L.clearTracks(); }}
            onChange={patch} onGateCommit={L.resetSides}
            idle={!running && 'Start the camera or load a video file. Drag the dots to place the counting line.'}
          />
          {display && (
            <div className="absolute inset-0 pointer-events-none text-white" style={{ padding: 'max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right)) max(1rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left))' }}>
              <div className="font-display font-extrabold leading-none tabular-nums" style={{ fontSize: 'min(34vw, 40vh)', color: LEVEL_COLOR[lv] }}>{occ}</div>
              <div className="font-mono uppercase tracking-widest text-neutral-400 text-sm sm:text-xl mt-2">
                inside{settings.cap > 0 ? ` of ${settings.cap}${lv === 2 ? ', full' : ''}` : ''}
              </div>
              <div className="absolute bottom-4 left-4 font-mono text-xs text-neutral-500">
                {settings.displayView === 'privacy' ? 'Privacy view: no video is shown' : 'Live video'}
                {L.phase !== 'counting' && ' \u00b7 not counting'}
              </div>
              <button onClick={exitDisplay} aria-label="Exit display mode"
                className="pointer-events-auto absolute top-4 right-4 min-w-[48px] min-h-[48px] rounded-full border border-white/20 bg-black/60 grid place-items-center">
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>

        {L.error && <Banner tone="error">{L.error}</Banner>}
        {model.state === 'loading' && <Banner tone="info"><Loader2 className="inline w-4 h-4 mr-1.5 animate-spin" />{model.message}. The library comes from the CDN, so this needs a connection.</Banner>}
        {model.state === 'error' && <Banner tone="error" action={<button className="underline shrink-0" onClick={L.retryModel}>Retry</button>}>{model.message}</Banner>}
        {modelReady && model.info.delegate === 'CPU' && (
          <Banner tone="warn"><AlertTriangle className="inline w-4 h-4 mr-1.5" />GPU unavailable: running on the CPU, which is slower. Counting still works, but expect fewer detections per second.</Banner>
        )}

        <div className="flex flex-wrap gap-2">
          {!running && (
            <>
              <button className={`${btnPrimary} flex-1 sm:flex-none`} style={{ background: ACCENT }} disabled={!modelReady} onClick={L.startCamera}><Video className="inline w-4 h-4 mr-2" />Start camera</button>
              <button className={btn} disabled={!modelReady} onClick={() => fileRef.current?.click()}><FileVideo className="inline w-4 h-4 mr-2" />Video file</button>
              <input ref={fileRef} type="file" accept="video/*" hidden onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) L.startFile(f); }} />
              {L.cams.length > 1 && (
                <select aria-label="Camera" className="min-h-[44px] rounded-lg bg-black/40 border border-white/15 px-3 text-sm" value={L.camId} onChange={(e) => L.setCamId(e.target.value)}>
                  <option value="">Default camera</option>
                  {L.cams.map((c) => <option key={c.id} value={c.id}>{c.label.replace(/</g, '')}</option>)}
                </select>
              )}
            </>
          )}
          {L.phase === 'setup' && <button className={`${btnPrimary} flex-1 sm:flex-none`} style={{ background: ACCENT }} onClick={L.startCounting}><Play className="inline w-4 h-4 mr-2" />Start counting</button>}
          {L.phase === 'counting' && <button className={btn} onClick={L.pauseCounting}><Pause className="inline w-4 h-4 mr-2" />Pause counting</button>}
          {running && <button className={btn} onClick={L.stopSource}><Square className="inline w-4 h-4 mr-2" />Stop camera</button>}
          {running && <button className={btn} onClick={enterDisplay}><Maximize className="inline w-4 h-4 mr-2" />Display mode</button>}
          <button className={btn} onClick={() => setPreviewPrivacy((p) => !p)} aria-pressed={previewPrivacy}>
            {previewPrivacy ? <Eye className="inline w-4 h-4 mr-2" /> : <EyeOff className="inline w-4 h-4 mr-2" />}{previewPrivacy ? 'Show video' : 'Preview privacy view'}
          </button>
        </div>
        {L.phase === 'setup' && <p className="text-xs text-neutral-500">Setup: people are detected and checked, but nothing is counted until you press Start counting.</p>}

        <CountersCard counts={L.counts} cap={settings.cap} onCap={(cap) => patch({ cap })} onManual={(dir) => L.record(dir, dir === 'in' ? 'manual+' : 'manual-')} />
      </div>

      <div className="space-y-3 min-w-0">
        <SetupCheck setup={L.setup} running={running} />
        <ControlsCard settings={settings} patch={patch} roiMode={roiMode} onRoiMode={setRoiMode} onGateChange={L.resetSides}
          onClearRegion={() => { patch({ roi: null }); L.clearTracks(); }} />
        <PerformanceCard stats={L.stats} model={model} />
        <DoorCountReconcile walkedIn={L.counts.in} reconRef={reconRef} />
        <Card title="Occupancy over time">
          <DoorCountChart series={[...L.session.data.series]} limit={settings.cap} empty="Occupancy appears here as people cross." />
          <div className="grid grid-cols-2 gap-2 mt-3">
            <button className={btn} onClick={exportJson}><Download className="inline w-4 h-4 mr-1.5" />Report (JSON)</button>
            <button className={btn} onClick={exportCsv}><Download className="inline w-4 h-4 mr-1.5" />Crossings (CSV)</button>
          </div>
          <button className={`${btn} w-full mt-2`} onClick={() => { if (window.confirm('Clear all counts and history for this session?')) L.resetSession(); }}>
            <RotateCcw className="inline w-4 h-4 mr-1.5" />Reset session
          </button>
        </Card>
        <Card title="What leaves this device">
          <p className="text-xs text-neutral-400 leading-relaxed">
            Nothing. Video is processed on this device and is never uploaded or recorded. What still needs the network:
            the MediaPipe library and its WASM from cdn.jsdelivr.net, on every cold load, and the detection model once
            on first load. After that the model is read from this device&rsquo;s cache, so only the library needs a
            connection.
          </p>
        </Card>
      </div>
    </div>
  );
}
