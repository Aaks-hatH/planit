/**
 * frontend/src/components/liquid/LiquidScenes.jsx
 *
 * Three hand-built "hero footage" scenes, drawn in SVG/CSS so they ship with the site (no video files to host):
 *   CrystalLotus   a glassy pink lotus that blooms petal by petal, with petals drifting around it
 *   FloatingIsland a mossy rock island with crystals, cosmos and roses, bobbing in warm light
 *   GlassOrb       an iridescent liquid-glass bubble with a bright rim, slowly morphing
 *
 * All animation is CSS-driven so it pauses cleanly under reduced motion and on the "low" performance tier.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import '../../styles/liquid.css';

function rng(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function useOnce(ref) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const n = ref.current; if (!n) return undefined;
    if (typeof IntersectionObserver === 'undefined') { setOn(true); return undefined; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } }, { threshold: 0.15 });
    io.observe(n);
    return () => io.disconnect();
  }, [ref]);
  return on;
}
const f = (n) => Number(n.toFixed(1));

/* ═══════════════════════════════ Crystal lotus ═══════════════════════════════ */
const petalPath = (L, W) => `M0 0 C${f(-W * 0.95)} ${f(-L * 0.2)} ${f(-W * 0.85)} ${f(-L * 0.82)} 0 ${-L} C${f(W * 0.85)} ${f(-L * 0.82)} ${f(W * 0.95)} ${f(-L * 0.2)} 0 0Z`;

const LOTUS = (() => {
  const out = [];
  const ring = (n, spread, L, W, tint, delay) => {
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : i / (n - 1) - 0.5;
      const a = t * 2 * spread;
      out.push({ a, L: L * (1 - Math.abs(t) * 0.16), W, tint, d: delay + Math.abs(t) * 0.22 + (i % 2) * 0.05 });
    }
  };
  ring(9, 84, 168, 36, 0, 0.1);
  ring(8, 64, 148, 38, 1, 0.5);
  ring(6, 42, 124, 36, 2, 0.9);
  ring(4, 20, 98, 32, 3, 1.3);
  ring(3, 8, 70, 28, 4, 1.7);
  return out;
})();

const DRIFT = [
  { x: 9, y: 36, s: 1.05, r: -20, dur: 17, dl: 0 }, { x: 80, y: 22, s: 0.8, r: 28, dur: 21, dl: -6 },
  { x: 88, y: 52, s: 1.1, r: 160, dur: 19, dl: -3 }, { x: 18, y: 74, s: 0.9, r: 200, dur: 23, dl: -11 },
  { x: 72, y: 80, s: 0.7, r: 120, dur: 18, dl: -8 }, { x: 34, y: 18, s: 0.65, r: 60, dur: 25, dl: -14 },
];

export function CrystalLotus({ className = '', size = 'min(92vw, 780px)' }) {
  const ref = useRef(null);
  const on = useOnce(ref);
  const stars = useMemo(() => {
    const r = rng(5);
    return Array.from({ length: 46 }, () => ({ x: r() * 100, y: r() * 100, s: 0.6 + r() * 1.4, d: r() * 5 }));
  }, []);
  return (
    <div ref={ref} aria-hidden="true" className={`lq-lotus pointer-events-none absolute left-1/2 ${on ? 'on' : ''} ${className}`} style={{ width: size, aspectRatio: '1', top: '50%', transform: 'translate(-50%, -48%)' }}>
      <div className="lq-lotus-glow" />
      {stars.map((s, i) => <i key={i} className="lq-lotus-star" style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, animationDelay: `${s.d}s` }} />)}
      <svg viewBox="0 0 400 400" className="lq-lotus-svg">
        <defs>
          {[['#c7b8ff', '#ff9ec4', '#ffb27a'], ['#ffb3d1', '#ff8fb4', '#ffc89a'], ['#ffd1b3', '#ff9fbf', '#ffb88a'], ['#fff0e2', '#ffbdd2', '#ffc9a0'], ['#fff7ee', '#ffd6e4', '#ffd9b8']].map((c, i) => (
            <linearGradient key={i} id={`lt-g${i}`} x1="0" y1="1" x2="0.15" y2="0">
              <stop offset="0" stopColor={c[2]} stopOpacity="0.95" />
              <stop offset="0.55" stopColor={c[1]} stopOpacity="0.8" />
              <stop offset="1" stopColor={c[0]} stopOpacity="0.55" />
            </linearGradient>
          ))}
          <linearGradient id="lt-rim" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor="#fff" stopOpacity="0.15" /><stop offset="1" stopColor="#fff" stopOpacity="0.95" /></linearGradient>
          <radialGradient id="lt-core" cx="50%" cy="50%" r="50%"><stop offset="0" stopColor="#fff6d6" /><stop offset="0.5" stopColor="#ffc46b" /><stop offset="1" stopColor="#ff8a4a" stopOpacity="0" /></radialGradient>
        </defs>
        <g className="lq-lotus-breathe">
          {LOTUS.map((p, i) => (
            <g key={i} transform={`translate(200 292) rotate(${f(p.a)})`}>
              <g className="lq-lp" style={{ '--d': `${f(p.d)}s` }}>
                <path d={petalPath(p.L, p.W)} fill={`url(#lt-g${p.tint})`} style={{ mixBlendMode: 'screen' }} />
                <path d={petalPath(p.L, p.W)} fill="none" stroke="url(#lt-rim)" strokeWidth="1.1" />
                <path d={`M0 ${f(-p.L * 0.12)} C${f(-p.W * 0.38)} ${f(-p.L * 0.36)} ${f(-p.W * 0.32)} ${f(-p.L * 0.7)} 0 ${f(-p.L * 0.93)}`} fill="none" stroke="#fff" strokeOpacity="0.28" strokeWidth="1.2" strokeLinecap="round" />
                <path d={`M0 ${f(-p.L * 0.1)} L0 ${f(-p.L * 0.82)}`} stroke="#fff" strokeOpacity="0.12" strokeWidth="0.8" />
              </g>
            </g>
          ))}
          <g className="lq-lp" style={{ '--d': '2.1s' }}>
            <ellipse cx="200" cy="224" rx="34" ry="20" fill="url(#lt-core)" opacity="0.85" />
            {Array.from({ length: 22 }).map((_, i) => {
              const a = (i / 22) * Math.PI * 2; const rr = 0.4 + ((i * 37) % 10) / 14;
              return <circle key={i} cx={200 + Math.cos(a) * 24 * rr} cy={224 + Math.sin(a) * 12 * rr} r="2.3" fill="#ffe9a8" opacity="0.9" />;
            })}
          </g>
        </g>
      </svg>
      {DRIFT.map((d, i) => (
        <svg key={i} viewBox="-20 -60 40 70" className="lq-drift-petal" style={{ left: `${d.x}%`, top: `${d.y}%`, width: `${d.s * 9}%`, animationDuration: `${d.dur}s`, animationDelay: `${d.dl}s`, '--r': `${d.r}deg` }}>
          <path d={petalPath(54, 15)} fill="url(#lt-g1)" />
          <path d={petalPath(54, 15)} fill="none" stroke="url(#lt-rim)" strokeWidth="1" />
          <path d="M-6 -8 C-4 -22 -2 -36 0 -46" stroke="#a5b4fc" strokeOpacity="0.55" strokeWidth="5" fill="none" strokeLinecap="round" />
        </svg>
      ))}
    </div>
  );
}

/* ═══════════════════════════════ Floating island ═══════════════════════════════ */
const MOSS = ['#6d8a1f', '#88a52f', '#a6bd3e', '#566f19', '#7d9a2a'];
const PINK = ['#f7b6c8', '#f08fa8', '#e86f93', '#fbd0dc'];

function buildIsland() {
  const r = rng(21);
  const CX = 320; const HW = 270;
  const topY = (x) => 258 + Math.pow(Math.abs(x - CX) / HW, 2.4) * 46 + Math.sin(x * 0.045) * 5;
  const top = []; for (let x = 52; x <= 588; x += 17) top.push([x, topY(x) + (r() - 0.5) * 7]);
  const bot = [];
  for (let x = 588; x >= 52; x -= 24) {
    const t = Math.abs(x - CX) / HW;
    bot.push([x + (r() - 0.5) * 16, 296 + Math.pow(1 - t * t, 0.9) * 138 + (r() - 0.5) * 30]);
  }
  const body = `M${top.map((p) => `${f(p[0])} ${f(p[1])}`).join(' L')} L${bot.map((p) => `${f(p[0])} ${f(p[1])}`).join(' L')} Z`;
  const poly = [...top, ...bot];
  const facets = Array.from({ length: 46 }, () => {
    const a = poly[Math.floor(r() * poly.length)]; const b = poly[Math.floor(r() * poly.length)];
    const c = [CX + (r() - 0.5) * 360, 300 + r() * 90];
    return { d: `M${f(a[0])} ${f(a[1])} L${f(b[0])} ${f(b[1])} L${f(c[0])} ${f(c[1])}Z`, light: r() > 0.55, o: 0.05 + r() * 0.13 };
  });
  const moss = [];
  top.forEach(([x, y], i) => {
    const n = 3 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) moss.push({ x: x + (r() - 0.5) * 22, y: y - 2 + (r() - 0.7) * 9, r: 5 + r() * 9, c: MOSS[Math.floor(r() * 5)], o: 0.85 + r() * 0.15 });
    if (i % 2 === 0) for (let k = 0; k < 3; k++) moss.push({ x: x + (r() - 0.5) * 18, y: y + 8 + k * 7 + r() * 6, r: 3 + r() * 5, c: MOSS[Math.floor(r() * 5)], o: 0.9 });
  });
  for (let k = 0; k < 24; k++) { const t = r(); moss.push({ x: 120 + t * 380, y: 300 + r() * 56, r: 3 + r() * 6, c: MOSS[Math.floor(r() * 5)], o: 0.55 + r() * 0.4 }); }
  const buds = [];
  for (let k = 0; k < 60; k++) { const x = 70 + r() * 500; buds.push({ x, y: topY(x) - 4 - r() * 20, r: 1.6 + r() * 2.6, c: PINK[Math.floor(r() * 4)] }); }
  const crystals = [
    { x: 214, h: 78, w: 22, a: -22 }, { x: 246, h: 62, w: 18, a: -9 }, { x: 410, h: 108, w: 28, a: 9 },
    { x: 452, h: 70, w: 20, a: 24 }, { x: 524, h: 50, w: 17, a: 30 }, { x: 150, h: 46, w: 16, a: -34 },
  ].map((c) => ({ ...c, y: topY(c.x) + 6 }));
  const cosmos = [{ x: 262, h: 112, s: 1.15, l: -10 }, { x: 330, h: 86, s: 1.0, l: 6 }, { x: 468, h: 70, s: 1.25, l: 12 }].map((c) => ({ ...c, y: topY(c.x) + 4 }));
  const roses = [{ x: 118, s: 1.15 }, { x: 188, s: 0.8 }, { x: 498, s: 1.0 }, { x: 554, s: 0.7 }].map((c) => ({ ...c, y: topY(c.x) - 4 }));
  const gems = [{ x: 236, y: 330, rx: 26, ry: 12, c: '#3f8cff' }, { x: 288, y: 318, rx: 18, ry: 9, c: '#79c4ff' }, { x: 196, y: 344, rx: 14, ry: 8, c: '#2f6fe0' }];
  const specks = Array.from({ length: 22 }, () => ({ x: r() * 640, y: 120 + r() * 300, r: 0.8 + r() * 1.5, d: r() * 6 }));
  return { body, facets, moss, buds, crystals, cosmos, roses, gems, specks };
}

function Cosmos({ x, y, h, s, l }) {
  return (
    <g transform={`translate(${f(x)} ${f(y)})`}>
      <g className="lq-sway-s" style={{ animationDelay: `${(x % 7) * -0.6}s` }}>
        <path d={`M0 0 C${l * 0.2} ${-h * 0.4} ${l} ${-h * 0.75} ${l} ${-h}`} fill="none" stroke="#a8c04a" strokeWidth="2" strokeLinecap="round" />
        <g transform={`translate(${l} ${-h}) scale(${s}) rotate(${l * 2})`}>
          {Array.from({ length: 9 }).map((_, i) => (
            <path key={i} transform={`rotate(${i * 40})`} d="M0 -3 C-6 -8 -7 -21 0 -26 C7 -21 6 -8 0 -3Z" fill="url(#is-cos)" stroke="#fff" strokeOpacity="0.35" strokeWidth="0.5" />
          ))}
          <circle r="4.2" fill="#e9a93a" /><circle r="2.2" cx="-0.8" cy="-0.8" fill="#ffd36b" />
        </g>
      </g>
    </g>
  );
}
function Rose({ x, y, s }) {
  return (
    <g transform={`translate(${f(x)} ${f(y)}) scale(${s})`}>
      <circle r="16" fill="url(#is-rose)" />
      {[13, 9.5, 6.5, 3.5].map((rr, i) => <path key={i} d={`M${-rr} 0 A${rr} ${rr} 0 0 1 ${rr} ${i % 2 ? 2 : -2}`} fill="none" stroke="#fff" strokeOpacity={0.5 - i * 0.07} strokeWidth="1.1" transform={`rotate(${i * 70})`} />)}
      <path d="M-12 6 C-6 14 6 14 12 6" fill="none" stroke="#c7456b" strokeOpacity="0.5" strokeWidth="1.4" />
    </g>
  );
}
function Crystal({ x, y, h, w, a }) {
  const sh = h * 0.78;
  return (
    <g transform={`translate(${f(x)} ${f(y)}) rotate(${a})`}>
      <path d={`M${-w / 2} 0 L${-w / 2} ${-sh} L0 ${-h} L${w / 2} ${-sh} L${w / 2} 0Z`} fill="url(#is-cry)" stroke="#fff" strokeOpacity="0.55" strokeWidth="0.9" />
      <path d={`M${w * 0.06} 0 L${w * 0.06} ${-sh} L0 ${-h} L${w / 2} ${-sh} L${w / 2} 0Z`} fill="#fff" fillOpacity="0.12" />
      <path d={`M${-w * 0.28} ${-h * 0.08} L${-w * 0.28} ${-sh * 0.92}`} stroke="#fff" strokeOpacity="0.55" strokeWidth="1.4" strokeLinecap="round" />
      <path d={`M${-w / 2} ${-sh} L${w / 2} ${-sh}`} stroke="#fff" strokeOpacity="0.4" strokeWidth="0.8" />
    </g>
  );
}

export function FloatingIsland({ className = '' }) {
  const ref = useRef(null);
  const on = useOnce(ref);
  const I = useMemo(buildIsland, []);
  return (
    <div ref={ref} aria-hidden="true" className={`lq-island pointer-events-none ${on ? 'on' : ''} ${className}`}>
      <div className="lq-island-light" />
      <svg viewBox="0 0 640 470" className="lq-island-svg">
        <defs>
          <linearGradient id="is-rock" x1="0" y1="0" x2="1" y2="0.4"><stop offset="0" stopColor="#7b5a40" /><stop offset="0.35" stopColor="#3a2c26" /><stop offset="1" stopColor="#0e0b0c" /></linearGradient>
          <linearGradient id="is-shade" x1="0" y1="0" x2="0" y2="1"><stop offset="0.45" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.7" /></linearGradient>
          <linearGradient id="is-cry" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#ffe3a8" stopOpacity="0.85" /><stop offset="0.5" stopColor="#fff5df" stopOpacity="0.55" /><stop offset="1" stopColor="#cfe6ff" stopOpacity="0.5" /></linearGradient>
          <radialGradient id="is-cos" cx="50%" cy="100%" r="100%"><stop offset="0" stopColor="#f08fb0" /><stop offset="1" stopColor="#fde6ee" /></radialGradient>
          <radialGradient id="is-rose" cx="40%" cy="35%" r="70%"><stop offset="0" stopColor="#ffe0e8" /><stop offset="1" stopColor="#e47a9c" /></radialGradient>
          {I.gems.map((g, i) => <radialGradient key={i} id={`is-gem${i}`}><stop offset="0" stopColor="#bfe6ff" /><stop offset="1" stopColor={g.c} /></radialGradient>)}
        </defs>
        <g className="lq-island-bob">
          <path d={I.body} fill="url(#is-rock)" />
          {I.facets.map((t, i) => <path key={i} d={t.d} fill={t.light ? '#ffd9b0' : '#000'} fillOpacity={t.o} />)}
          <path d={I.body} fill="url(#is-shade)" />
          {I.gems.map((g, i) => <ellipse key={i} cx={g.x} cy={g.y} rx={g.rx} ry={g.ry} fill={`url(#is-gem${i})`} opacity="0.92" transform={`rotate(${-12 + i * 9} ${g.x} ${g.y})`} />)}
          {I.moss.map((m, i) => <circle key={i} cx={f(m.x)} cy={f(m.y)} r={f(m.r)} fill={m.c} opacity={m.o} />)}
          {I.moss.filter((_, i) => i % 5 === 0).map((m, i) => <circle key={i} cx={f(m.x - m.r * 0.25)} cy={f(m.y - m.r * 0.3)} r={f(m.r * 0.5)} fill="#d8e87a" opacity="0.35" />)}
          {I.crystals.map((c, i) => <Crystal key={i} {...c} />)}
          {I.cosmos.map((c, i) => <Cosmos key={i} {...c} />)}
          {I.roses.map((c, i) => <Rose key={i} {...c} />)}
          {I.buds.map((b, i) => <circle key={i} cx={f(b.x)} cy={f(b.y)} r={f(b.r)} fill={b.c} />)}
        </g>
        {I.specks.map((s, i) => <circle key={i} className="lq-pollen" cx={f(s.x)} cy={f(s.y)} r={f(s.r)} fill="#ffe2b0" style={{ animationDelay: `${f(s.d)}s` }} />)}
      </svg>
    </div>
  );
}

/* ═══════════════════════════════ Glass orb ═══════════════════════════════ */
export function GlassOrb({ className = '', size = 'min(64vw, 560px)' }) {
  const stars = useMemo(() => { const r = rng(9); return Array.from({ length: 30 }, () => ({ x: r() * 100, y: r() * 100, s: 0.6 + r() * 1.2, d: r() * 5 })); }, []);
  return (
    <div aria-hidden="true" className={`lq-orb3 pointer-events-none ${className}`} style={{ width: size, aspectRatio: '1.25' }}>
      <div className="lq-orb3-haze" />
      {stars.map((s, i) => <i key={i} className="lq-lotus-star" style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, animationDelay: `${s.d}s` }} />)}
      <div className="lq-orb3-float">
        <div className="lq-orb3-body">
          <i className="lq-orb3-blue" /><i className="lq-orb3-amber" /><i className="lq-orb3-film" /><i className="lq-orb3-spec" />
        </div>
      </div>
    </div>
  );
}
