import { useState, useEffect, useMemo } from 'react';
import { QrCode, Timer } from 'lucide-react';

const N = 21;
function cells(seed) {
  let s = seed >>> 0 || 1;
  const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const inFinder = (x, y) => (x < 8 && y < 8) || (x > N - 9 && y < 8) || (x < 8 && y > N - 9);
  const out = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!inFinder(x, y) && rnd() > 0.52) out.push([x, y]);
  return out;
}
const Finder = ({ x, y }) => (
  <g>
    <rect x={x} y={y} width="7" height="7" fill="#fff" />
    <rect x={x + 1} y={y + 1} width="5" height="5" fill="#0a0a18" />
    <rect x={x + 2} y={y + 2} width="3" height="3" fill="#fff" />
  </g>
);

/** Decorative landing preview: a pass whose code visibly reshuffles as the timer runs out. */
export default function QRPassPreview() {
  const [tick, setTick] = useState(0);
  const [left, setLeft] = useState(30);
  useEffect(() => {
    const id = setInterval(() => {
      setLeft((l) => {
        if (l <= 1) { setTick((t) => t + 1); return 30; }
        return l - 1;
      });
    }, 100); // sped up ~10x so the rotation is visible on the landing
    return () => clearInterval(id);
  }, []);
  const pts = useMemo(() => cells(0x9e3779b1 * (tick + 3)), [tick]);
  const frac = left / 30;

  return (
    <div className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-5">
        <span className="font-mono text-[10px] tracking-widest text-neutral-500 uppercase">Live pass</span>
        <QrCode className="w-4 h-4 text-neutral-600" />
      </div>
      <div className="flex gap-5 items-center">
        <div className="p-2.5 rounded-xl bg-white shrink-0">
          <svg viewBox={`0 0 ${N} ${N}`} className="w-28 h-28" shapeRendering="crispEdges" aria-hidden="true">
            <rect width={N} height={N} fill="#fff" />
            <g fill="#05050f" style={{ transition: 'opacity .2s' }}>
              {pts.map(([x, y]) => <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />)}
            </g>
            <g>
              <Finder x={0} y={0} /><Finder x={N - 7} y={0} /><Finder x={0} y={N - 7} />
            </g>
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display font-bold text-lg truncate">Maya Chen</div>
          <div className="text-neutral-500 text-xs mb-4">Founders&rsquo; Night &middot; signed pass</div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-2">
            <div className="h-full" style={{ width: `${frac * 100}%`, background: frac < 0.25 ? '#FB7185' : '#5EEAD4' }} />
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-teal-400/80">
            <Timer className="w-3 h-3" />
            new code every 30s
          </div>
        </div>
      </div>
      <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between font-mono text-[10px] text-neutral-500">
        <span>HMAC(guest key, slot) &rarr; code</span>
        <span className="text-teal-400/80">screenshots expire</span>
      </div>
    </div>
  );
}
