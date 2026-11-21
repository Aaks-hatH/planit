import { useRef, useEffect } from 'react';
import { ACCENT } from '../utils/doorCountDraw';

/** Small step chart of [timeMs, value] points. `limit` draws a dashed red line. */
export default function DoorCountChart({ series, limit = 0, empty, height = 96, signed = false }) {
  const ref = useRef(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return undefined;
    const draw = () => {
      const d = window.devicePixelRatio || 1;
      const W = c.clientWidth, H = height;
      c.width = Math.round(W * d); c.height = Math.round(H * d);
      const x = c.getContext('2d');
      x.scale(d, d);
      x.clearRect(0, 0, W, H);
      x.font = '10px DM Mono, ui-monospace, monospace';
      x.fillStyle = '#8b95a5';
      if (series.length < 2) { x.fillText(empty, 8, H / 2); return; }

      const t0 = series[0][0], t1 = series[series.length - 1][0];
      const vals = series.map((p) => p[1]);
      const hi = Math.max(1, limit, ...vals), lo = signed ? Math.min(0, ...vals) : 0;
      const X = (t) => 2 + ((t - t0) / (t1 - t0 || 1)) * (W - 4);
      const Y = (v) => H - 14 - ((v - lo) / (hi - lo || 1)) * (H - 26);

      if (signed) { x.strokeStyle = 'rgba(255,255,255,0.15)'; x.beginPath(); x.moveTo(0, Y(0)); x.lineTo(W, Y(0)); x.stroke(); }
      if (limit > 0) {
        x.strokeStyle = '#ff5d5d'; x.setLineDash([4, 3]);
        x.beginPath(); x.moveTo(0, Y(limit)); x.lineTo(W, Y(limit)); x.stroke(); x.setLineDash([]);
      }
      x.strokeStyle = ACCENT; x.lineWidth = 2;
      x.beginPath();
      let py = Y(series[0][1]);
      x.moveTo(X(t0), py);
      for (const [t, v] of series) { x.lineTo(X(t), py); py = Y(v); x.lineTo(X(t), py); }
      x.stroke();
      const hm = (t) => new Date(t).toTimeString().slice(0, 5);
      x.fillStyle = '#8b95a5';
      x.fillText(hm(t0), 2, H - 2);
      x.fillText(hm(t1), W - 32, H - 2);
      x.fillText(`max ${hi}`, W - 52, 10);
      if (signed) x.fillText(`min ${lo}`, 2, 10);
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(c);
    return () => ro.disconnect();
  }, [series, limit, empty, height, signed]);

  return <canvas ref={ref} className="w-full block" style={{ height }} />;
}
