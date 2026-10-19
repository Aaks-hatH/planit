/**
 * frontend/src/components/HomeMotion.jsx
 *
 * Motion layer for the PlanIt home page. Additive only: nothing here changes
 * fonts, copy, demos or layout.
 *
 *   HomePreloader    counter + hairline progress, then a two-panel curtain.
 *                    Progress follows real readiness (fonts + window load).
 *   HomeScrollChrome scroll percentage + depth rail that jumps between sections.
 *   ScrollFloat      scroll-linked parallax / scale wrapper for big visuals.
 *   MotionReveal     spring-in-view reveal (opacity + offset).
 *
 * All pieces respect prefers-reduced-motion.
 */
import { useEffect, useRef, useState } from 'react';
import {
  motion, useScroll, useSpring, useTransform, useReducedMotion,
} from 'framer-motion';

const EASE = [0.22, 1, 0.36, 1];
const cx = (...a) => a.filter(Boolean).join(' ');

/* ─── Readiness: fonts + window load ───────────────────────────────────────── */
export function useSiteReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    const fonts = document.fonts?.ready ?? Promise.resolve();
    const load = document.readyState === 'complete'
      ? Promise.resolve()
      : new Promise((res) => window.addEventListener('load', res, { once: true }));
    Promise.all([fonts, load]).then(() => { if (live) setReady(true); });
    return () => { live = false; };
  }, []);
  return ready;
}

/* ─── Preloader: a guy shoves the plan aside to reveal PlanIt ───────────────── */
const LOAD_WORDS = ['Setting the stage', 'Seating the guests', 'Scanning the door', 'Doors open'];
const PLAN_ROWS = ['09:00  LOAD IN', '10:30  DOORS', '12:00  KEYNOTE', '13:30  LUNCH', '15:00  BREAKOUTS', '18:00  GALA', '21:00  AFTER PARTY', '23:30  WRAP'];

function Pusher() {
  const ink = '#c7d2fe';
  return (
    <svg viewBox="0 0 140 170" className="h-full w-full overflow-visible" aria-hidden="true">
      <style>{`
        @keyframes pl-legA { 0% { transform: rotate(-34deg) } 100% { transform: rotate(30deg) } }
        @keyframes pl-legB { 0% { transform: rotate(30deg) } 100% { transform: rotate(-34deg) } }
        @keyframes pl-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-3px) } }
        .pl-legA, .pl-legB { transform-box: view-box; animation-duration: .42s; animation-timing-function: ease-in-out; animation-iteration-count: infinite; animation-direction: alternate; }
        .pl-legA { animation-name: pl-legA } .pl-legB { animation-name: pl-legB }
        .pl-body { animation: pl-bob .42s ease-in-out infinite }
        @media (prefers-reduced-motion: reduce) { .pl-legA, .pl-legB, .pl-body { animation: none } }
      `}</style>
      <g transform="rotate(10 60 160)">
        {/* back leg */}
        <g className="pl-legB" style={{ transformOrigin: '56px 112px' }}>
          <path d="M56 112 L50 138 L58 160" stroke={ink} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M58 160 l16 1 c3 0 4 4 0 5 l-22 1 z" fill="#e0e7ff" stroke={ink} strokeWidth="3" strokeLinejoin="round" />
        </g>
        <g className="pl-body">
          {/* back arm */}
          <path d="M70 56 L100 62 L122 58" stroke={ink} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          {/* torso */}
          <path d="M44 50 Q62 42 80 52 L84 96 Q62 108 46 100 Z" fill="#6366f1" stroke={ink} strokeWidth="3" strokeLinejoin="round" />
          {[[58, 64], [70, 72], [56, 82], [68, 90], [76, 62]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.2" fill="#e0e7ff" />)}
          {/* shorts */}
          <path d="M46 100 Q62 108 84 96 L86 120 L66 122 L62 112 L58 123 L44 121 Z" fill="#2dd4bf" stroke={ink} strokeWidth="3" strokeLinejoin="round" />
          {/* head + cap */}
          <circle cx="66" cy="30" r="14" fill="#e0e7ff" stroke={ink} strokeWidth="3" />
          <path d="M52 27 Q54 10 70 12 Q82 14 80 26 Z" fill="#818cf8" stroke={ink} strokeWidth="3" strokeLinejoin="round" />
          <path d="M78 24 L96 28 L78 31 Z" fill="#818cf8" stroke={ink} strokeWidth="3" strokeLinejoin="round" />
          <circle cx="72" cy="33" r="1.8" fill={ink} /><path d="M70 40 q6 3 10 -1" stroke={ink} strokeWidth="2.4" fill="none" strokeLinecap="round" />
          <path d="M84 40 q3 5 0 8 q-3 -3 0 -8" fill="#2dd4bf" stroke={ink} strokeWidth="1.4" />
          {/* front arm */}
          <path d="M74 58 L104 70 L126 66" stroke={ink} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <circle cx="127" cy="66" r="5.5" fill="#e0e7ff" stroke={ink} strokeWidth="3" />
          <circle cx="123" cy="58" r="5.5" fill="#e0e7ff" stroke={ink} strokeWidth="3" />
        </g>
        {/* front leg */}
        <g className="pl-legA" style={{ transformOrigin: '64px 112px' }}>
          <path d="M64 112 L74 136 L66 160" stroke={ink} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M66 160 l16 1 c3 0 4 4 0 5 l-22 1 z" fill="#e0e7ff" stroke={ink} strokeWidth="3" strokeLinejoin="round" />
        </g>
      </g>
    </svg>
  );
}

export function HomePreloader({ ready, onReveal, onDone }) {
  const reduce = useReducedMotion();
  const [p, setP] = useState(0);
  const [phase, setPhase] = useState('count');
  const readyRef = useRef(ready);
  readyRef.current = ready;

  useEffect(() => {
    let raf;
    const t0 = performance.now();
    let last = t0; let val = 0; let fired = false;
    const minMs = reduce ? 300 : 2100;
    const tick = (t) => {
      const el = t - t0;
      const dt = Math.min(64, t - last); last = t;
      const ok = readyRef.current || el > 4200;
      const target = ok && el > minMs ? 100 : Math.min(ok ? 96 : 86, (1 - Math.exp(-el / 900)) * 100);
      val += (target - val) * (1 - Math.exp(-dt / 120));
      if (target === 100 && val > 99.4) val = 100;
      setP(Math.round(val * 10) / 10);
      if (val >= 100 && !fired) {
        fired = true;
        setTimeout(() => { setPhase('exit'); onReveal?.(); }, 380);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onReveal, reduce]);

  const exit = phase === 'exit';
  const word = LOAD_WORDS[Math.min(LOAD_WORDS.length - 1, Math.floor(p / 26))];
  const edge = 6 + p * 0.94; // % from the left where the plan sheet starts

  return (
    <motion.div
      className="fixed inset-0 overflow-hidden"
      style={{ zIndex: 1100, background: '#0b1024' }}
      role="status" aria-label="Loading PlanIt"
      animate={{ y: exit ? '-100%' : 0 }}
      transition={{ duration: reduce ? 0.2 : 0.95, ease: [0.76, 0, 0.24, 1], delay: reduce ? 0 : 0.25 }}
      onAnimationComplete={() => exit && onDone?.()}
    >
      {/* the word, revealed as the plan is shoved aside */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="lq-display select-none whitespace-nowrap text-[clamp(3rem,17vw,17rem)] leading-none tracking-[-0.05em]" style={{ color: '#a5b4fc' }}>PlanIt</div>
      </div>

      {/* the plan: a dark schedule sheet that gets pushed off to the right */}
      <div
        className="absolute inset-y-0 right-0 overflow-hidden"
        style={{ left: `${edge}%`, background: '#03040a', willChange: 'left' }}
      >
        <div className="absolute inset-0 opacity-[0.16]" style={{ backgroundImage: 'linear-gradient(rgba(165,180,252,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(165,180,252,.5) 1px, transparent 1px)', backgroundSize: '48px 48px' }} />
        <div className="absolute left-8 top-1/2 hidden -translate-y-1/2 space-y-3 font-mono text-[11px] tracking-[0.2em] text-white/55 sm:block">
          <div className="mb-5 text-white/90">THE PLAN</div>
          {PLAN_ROWS.map((r) => <div key={r}>{r}</div>)}
        </div>
      </div>

      {/* the guy doing the pushing */}
      <div
        className="absolute"
        style={{ left: `${edge}%`, top: '50%', height: 'clamp(150px, 24vw, 260px)', aspectRatio: '140 / 170', transform: 'translate(-92%, -34%)', willChange: 'left' }}
      >
        <Pusher />
      </div>

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-6 font-mono text-[11px] uppercase tracking-[0.25em] text-white/65 sm:p-10">
        <span>{word}</span>
        <span className="text-[clamp(1.6rem,4vw,3rem)] tracking-normal tabular-nums text-emerald-300">{String(Math.min(100, Math.round(p))).padStart(2, '0')}%</span>
      </div>
      <div className="absolute left-6 top-6 font-mono text-[11px] uppercase tracking-[0.25em] text-white/65 sm:left-10 sm:top-8">PlanIt / Events</div>
    </motion.div>
  );
}

/* ─── Scroll percentage + depth rail ───────────────────────────────────────── */
const RAIL = [
  { id: 'hero-top', label: 'Intro' },
  { id: 'showcase', label: 'Demos' },
  { id: 'features', label: 'Features' },
  { id: 'create', label: 'Create' },
];

export function HomeScrollChrome({ rail = true }) {
  const { scrollYProgress } = useScroll();
  const bar = useSpring(scrollYProgress, { stiffness: 140, damping: 28, mass: 0.3 });
  const [pct, setPct] = useState(0);
  const [active, setActive] = useState('hero-top');
  const [items, setItems] = useState([]);

  useEffect(() => scrollYProgress.on('change', (v) => setPct(Math.round(v * 100))), [scrollYProgress]);

  // Only list sections that actually exist and are visible on this view.
  useEffect(() => {
    const found = RAIL.filter((r) => {
      const el = document.getElementById(r.id);
      return el && el.offsetParent !== null;
    });
    setItems(found);
    if (!found.length) return undefined;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) setActive(en.target.id); });
    }, { rootMargin: '-40% 0px -50% 0px' });
    found.forEach((r) => io.observe(document.getElementById(r.id)));
    return () => io.disconnect();
  }, []);

  const go = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <>
      <motion.div
        aria-hidden="true"
        style={{ scaleX: bar, zIndex: 9998, boxShadow: '0 0 8px rgba(99,102,241,0.5)' }}
        className="pointer-events-none fixed left-0 right-0 top-0 h-[3px] origin-left bg-gradient-to-r from-indigo-500 to-violet-500"
      />
      {rail && items.length > 1 && (
        <div className="fixed right-5 top-1/2 z-[60] hidden -translate-y-1/2 flex-col items-end gap-3 xl:flex">
          <div className="mb-1 text-[11px] tabular-nums text-neutral-500">{String(pct).padStart(2, '0')}%</div>
          {items.map((r) => (
            <button key={r.id} onClick={() => go(r.id)} className="group flex items-center gap-3" aria-label={`Jump to ${r.label}`}>
              <span className={cx(
                'text-[10px] font-medium uppercase tracking-[0.22em] transition-all duration-300',
                active === r.id
                  ? 'translate-x-0 text-white opacity-100'
                  : 'translate-x-2 text-neutral-500 opacity-0 group-hover:translate-x-0 group-hover:opacity-100',
              )}>{r.label}</span>
              <span className={cx(
                'block rounded-full transition-all duration-300',
                active === r.id ? 'h-2.5 w-2.5 bg-violet-400' : 'h-1.5 w-1.5 bg-white/25 group-hover:bg-white/60',
              )} />
            </button>
          ))}
        </div>
      )}
    </>
  );
}

/* ─── Scroll-linked parallax wrapper ───────────────────────────────────────── */
export function ScrollFloat({ children, className = '', distance = 60, scale = true }) {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [distance, -distance]);
  const s = useTransform(scrollYProgress, [0, 0.35, 0.65, 1], [0.94, 1, 1, 0.97]);
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div ref={ref} className={className} style={{ y, scale: scale ? s : 1, willChange: 'transform' }}>
      {children}
    </motion.div>
  );
}

/* ─── In-view reveal (drop-in for Home's Reveal: delay in ms, direction) ───── */
const HIDDEN = {
  up:    { y: 36 },
  left:  { x: -44 },
  right: { x: 44 },
  scale: { scale: 0.92 },
};

export function MotionReveal({ children, delay = 0, className = '', direction = 'up' }) {
  const reduce = useReducedMotion();
  const off = HIDDEN[direction] || HIDDEN.up;
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, ...off }}
      whileInView={{ opacity: 1, x: 0, y: 0, scale: 1 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.85, delay: delay / 1000, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}
