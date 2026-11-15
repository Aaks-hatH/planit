import { useState, useEffect } from 'react';
import { Map as MapIcon } from 'lucide-react';

const STOPS = [
  { from: 'Entrance', table: '7', text: 'Table 7 is about 24 m ahead and to your right.' },
  { from: 'Bar', table: '3', text: 'Table 3 is about 11 m to your left.' },
  { from: 'Stage', table: '12', text: 'Table 12 is about 16 m behind you to the right.' },
];
const LM = { Entrance: [12, 46], Bar: [50, 8], Stage: [88, 46] };
const TB = { 3: [26, 24], 7: [70, 20], 12: [62, 42] };
const OTHER = [[38, 38], [78, 34], [46, 24], [20, 40]];

/** Decorative landing preview: cycles through "I'm at X → Table Y" with a drawn route. */
export default function VenueMapPreview() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % STOPS.length), 3200);
    return () => clearInterval(id);
  }, []);
  const s = STOPS[i];
  const [ax, ay] = LM[s.from];
  const [tx, ty] = TB[s.table];

  return (
    <div className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <span className="font-mono text-[10px] tracking-widest text-neutral-500 uppercase">I&rsquo;m at the {s.from}</span>
        <MapIcon className="w-4 h-4 text-neutral-600" />
      </div>
      <svg viewBox="0 0 100 54" className="w-full rounded-xl border border-white/10 bg-[#0a0a18]" aria-hidden="true">
        <defs>
          <pattern id="vmp-grid" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M10 0H0V10" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="0.3" />
          </pattern>
        </defs>
        <rect width="100" height="54" fill="url(#vmp-grid)" />
        {OTHER.map(([x, y], k) => <circle key={k} cx={x} cy={y} r="3.4" fill="rgba(139,127,255,0.14)" stroke="rgba(139,127,255,0.4)" strokeWidth="0.4" />)}
        {Object.entries(TB).map(([label, [x, y]]) => {
          const hit = label === s.table;
          return (
            <g key={label}>
              <circle cx={x} cy={y} r="4" fill={hit ? '#5EEAD4' : 'rgba(139,127,255,0.22)'} stroke={hit ? '#5EEAD4' : '#8B7FFF'} strokeWidth="0.5" style={{ transition: 'fill .4s' }} />
              <text x={x} y={y + 1.2} textAnchor="middle" fontSize="3.4" fontWeight="700" fill={hit ? '#05050f' : '#fff'}>{label}</text>
            </g>
          );
        })}
        <line key={i} x1={ax} y1={ay} x2={tx} y2={ty} stroke="#5EEAD4" strokeWidth="0.8" strokeDasharray="2 1.6" pathLength="1">
          <animate attributeName="stroke-dashoffset" from="0" to="-7" dur="1.2s" repeatCount="indefinite" />
        </line>
        {Object.entries(LM).map(([label, [x, y]]) => {
          const on = label === s.from;
          return (
            <g key={label}>
              <rect x={x - 2.8} y={y - 2.8} width="5.6" height="5.6" rx="1" transform={`rotate(45 ${x} ${y})`}
                fill={on ? '#F0B429' : 'rgba(240,180,41,0.14)'} stroke="#F0B429" strokeWidth="0.5" style={{ transition: 'fill .4s' }} />
              <text x={x} y={y + 6.6} textAnchor="middle" fontSize="2.6" fill={on ? '#F0B429' : 'rgba(255,255,255,0.7)'}>{label}</text>
            </g>
          );
        })}
      </svg>
      <p className="mt-4 text-[13px] text-neutral-200 leading-snug min-h-[2.5rem]">{s.text}</p>
      <div className="mt-3 pt-4 border-t border-white/10 flex items-center justify-between font-mono text-[10px] text-neutral-500">
        <span>landmark + table &rarr; directions</span>
        <span className="text-teal-400/80">no sensors</span>
      </div>
    </div>
  );
}
