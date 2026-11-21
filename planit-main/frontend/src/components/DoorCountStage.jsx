import { useRef, useState, useEffect } from 'react';
import { gateGeometry, gateHit, gateDrag } from '../utils/doorCount';
import { drawOverlay } from '../utils/doorCountDraw';

/**
 * Video, overlay canvas and pointer handling for a counting stage.
 * The <video> belongs to the parent (videoRef). With `privacy` it is kept
 * playing but invisible, and the canvas draws an abstract view instead.
 * mode: 'one' | 'two' | 'both' (the lab shows both so every preset can be placed).
 * fit: 'width' fills the column; 'screen' fits the whole picture inside the viewport.
 */
export default function DoorCountStage({
  videoRef, liveRef, settings, onChange, onGateCommit, mode = 'one', privacy = false,
  interactive = true, roiMode = false, onRoiDone, idle, fit = 'width',
}) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const drag = useRef(null);
  const latest = useRef({});
  latest.current = { settings, mode, privacy, interactive, roiMode, liveRef };
  const [aspect, setAspect] = useState(16 / 9);

  // Match the box to the video's real shape so overlay coordinates line up.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return undefined;
    const sync = () => { if (v.videoWidth) setAspect(v.videoWidth / v.videoHeight); };
    sync();
    v.addEventListener('loadedmetadata', sync);
    v.addEventListener('resize', sync);
    return () => { v.removeEventListener('loadedmetadata', sync); v.removeEventListener('resize', sync); };
  }, [videoRef]);

  // Draw loop at display rate. It only reads refs, so it never fights React.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const c = canvasRef.current, w = wrapRef.current;
      if (!c || !w) return;
      const d = window.devicePixelRatio || 1;
      const W = Math.round(w.clientWidth * d), H = Math.round(w.clientHeight * d);
      if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
      const { settings: s, mode: m, privacy: p, interactive: i, liveRef: lr } = latest.current;
      drawOverlay(c.getContext('2d'), W, H, {
        tracks: lr?.current.tracks, flash: lr?.current.flash, now: performance.now(),
        gate: s.gate, mode: m, flip: s.flip, roi: s.roi, privacy: p, handles: i && !p,
      });
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const point = (e) => {
    const c = canvasRef.current, r = c.getBoundingClientRect();
    const k = c.width / r.width;
    return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k, k };
  };

  const down = (e) => {
    const { settings: s, mode: m, interactive: i, roiMode: rm } = latest.current;
    if (!i) return;
    const c = canvasRef.current, p = point(e);
    if (rm) {
      drag.current = { kind: 'roi', ox: p.x / c.width, oy: p.y / c.height };
      onChange({ roi: { x: drag.current.ox, y: drag.current.oy, w: 0, h: 0 } });
    } else {
      const geo = gateGeometry(s.gate, c.width, c.height, m !== 'one');
      const kind = gateHit(geo, m !== 'one', p.x, p.y, 30 * p.k);
      if (!kind) return;
      drag.current = { kind, grab: { x: geo.cx - p.x, y: geo.cy - p.y } };
    }
    c.setPointerCapture(e.pointerId);
  };

  const move = (e) => {
    const d = drag.current;
    if (!d) return;
    const c = canvasRef.current, p = point(e), s = latest.current.settings;
    if (d.kind === 'roi') {
      const x = Math.min(1, Math.max(0, p.x / c.width)), y = Math.min(1, Math.max(0, p.y / c.height));
      onChange({ roi: { x: Math.min(d.ox, x), y: Math.min(d.oy, y), w: Math.abs(x - d.ox), h: Math.abs(y - d.oy) } });
    } else {
      onChange({ gate: gateDrag(d.kind, s.gate, p.x, p.y, c.width, c.height, d.grab) });
    }
  };

  const up = () => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    if (d.kind === 'roi') {
      const r = latest.current.settings.roi;
      onChange({ roi: r && r.w >= 0.1 && r.h >= 0.1 ? r : null });
      onRoiDone?.();
    }
    onGateCommit?.();
  };

  return (
    <div
      ref={wrapRef}
      className={`relative overflow-hidden bg-black ${fit === 'screen' ? 'mx-auto' : 'w-full rounded-xl'}`}
      style={fit === 'screen'
        ? { aspectRatio: aspect, width: `min(100%, calc(100dvh * ${aspect}))` } // whole picture, never stretched
        : { aspectRatio: aspect }}
    >
      <video
        ref={videoRef} muted playsInline
        className={`absolute inset-0 w-full h-full ${privacy ? 'opacity-0' : ''}`}
        style={{ objectFit: 'fill' }}
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ touchAction: interactive ? 'none' : 'auto', cursor: roiMode ? 'crosshair' : 'default' }}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
      />
      {idle && (
        <div className="absolute inset-0 grid place-items-center text-center p-5 text-neutral-500 text-sm pointer-events-none">
          {idle}
        </div>
      )}
    </div>
  );
}
