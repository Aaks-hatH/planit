import { useState, useEffect } from 'react';
import { ScanLine } from 'lucide-react';
import { ACCENT } from '../utils/doorCountDraw';

// Decorative landing illustration: a simulated walk-through of a two-line gate.
// It shows the idea, not a measurement, and says so.
const STEPS = 24;

export default function DoorCountPreview() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 140);
    return () => clearInterval(id);
  }, []);

  const cycle = tick % (STEPS * 2);          // down (IN), then back up (OUT)
  const p = (cycle < STEPS ? cycle : STEPS * 2 - 1 - cycle) / (STEPS - 1);
  const y = 18 + p * 134;
  const full = Math.floor(tick / (STEPS * 2));   // completed round trips
  const ins = full + (cycle >= STEPS * 0.7 ? 1 : 0);   // counted once the second line is passed
  const outs = full + (cycle >= STEPS * 1.7 ? 1 : 0);

  return (
    <div className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <span className="font-mono text-[10px] tracking-widest text-neutral-500 uppercase">Illustration, not a measurement</span>
        <ScanLine className="w-4 h-4 text-neutral-600" />
      </div>
      <div className="flex items-center gap-6">
        <svg viewBox="0 0 140 170" className="w-36 h-44 shrink-0 rounded-lg bg-[#05050f] border border-white/10" aria-hidden="true">
          <line x1="10" y1="68" x2="130" y2="68" stroke="#fff" strokeWidth="2" />
          <line x1="10" y1="102" x2="130" y2="102" stroke="#fff" strokeWidth="2" />
          <text x="12" y="62" fill="#8b95a5" fontSize="8" fontFamily="DM Mono, monospace">line 1</text>
          <text x="12" y="116" fill="#8b95a5" fontSize="8" fontFamily="DM Mono, monospace">line 2</text>
          <g fill={ACCENT} opacity="0.55" style={{ transition: 'transform 140ms linear' }} transform={`translate(0 ${y - 18})`}>
            <circle cx="70" cy="24" r="6" />
            <rect x="60" y="32" width="20" height="26" rx="8" />
          </g>
        </svg>
        <div>
          <div className="flex gap-6 mb-3">
            <div><div className="font-display font-extrabold text-3xl tabular-nums">{ins}</div><div className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">In</div></div>
            <div><div className="font-display font-extrabold text-3xl tabular-nums">{outs}</div><div className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">Out</div></div>
          </div>
          <p className="text-xs text-neutral-500 leading-snug max-w-[11rem]">Cross both lines in order and it counts once. The order is the direction.</p>
        </div>
      </div>
    </div>
  );
}
