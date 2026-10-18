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

/* ─── Preloader ────────────────────────────────────────────────────────────── */
const LOAD_WORDS = ['Setting the stage', 'Seating the guests', 'Scanning the door', 'Doors open'];

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
    const minMs = reduce ? 300 : 1300;
    const tick = (t) => {
      const el = t - t0;
      const dt = Math.min(64, t - last); last = t;
      const ok = readyRef.current || el > 3500;
      const target = ok && el > minMs ? 100 : Math.min(ok ? 96 : 86, (1 - Math.exp(-el / 700)) * 100);
      val += (target - val) * (1 - Math.exp(-dt / 110));
      if (target === 100 && val > 99.4) val = 100;
      setP(Math.round(val));
      if (val >= 100 && !fired) {
        fired = true;
        setTimeout(() => { setPhase('exit'); onReveal?.(); }, 320);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onReveal, reduce]);

  const exit = phase === 'exit';
  const word = LOAD_WORDS[Math.min(LOAD_WORDS.length - 1, Math.floor(p / 26))];
  const curtain = { duration: reduce ? 0.2 : 1.0, ease: [0.76, 0, 0.24, 1], delay: reduce ? 0 : 0.34 };

  return (
    <div className="fixed inset-0" style={{ zIndex: 1100 }} role="status" aria-label="Loading PlanIt">
      <motion.div
        className="absolute inset-x-0 top-0 h-1/2"
        style={{ background: '#04040a' }}
        animate={{ y: exit ? '-101%' : 0 }}
        transition={curtain}
      >
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-indigo-400/40 to-transparent" />
      </motion.div>
      <motion.div
        className="absolute inset-x-0 bottom-0 h-1/2"
        style={{ background: '#04040a' }}
        animate={{ y: exit ? '101%' : 0 }}
        transition={curtain}
        onAnimationComplete={() => exit && onDone?.()}
      />
      <motion.div
        className="absolute inset-0 flex flex-col justify-between p-6 sm:p-10"
        animate={{ opacity: exit ? 0 : 1, scale: exit ? 1.04 : 1, filter: exit ? 'blur(10px)' : 'blur(0px)' }}
        transition={{ duration: 0.55, ease: EASE }}
      >
        <div className="flex items-start justify-between text-[11px] tracking-[0.3em] text-neutral-500">
          <span><b className="lq-display text-base font-medium text-white">PlanIt</b> / EVENTS</span>
          <span>&copy; {new Date().getFullYear()}</span>
        </div>
        <div className="mx-auto w-full max-w-3xl text-center">
          <div className="lq-display text-[clamp(5rem,24vw,15rem)] leading-none tracking-[-0.04em] text-white tabular-nums">
            {String(p).padStart(2, '0')}
            <span
              className="inline-block pr-[0.14em] align-top text-[0.28em]"
              style={{
                background: 'linear-gradient(90deg,#6366f1,#8b5cf6)',
                WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
              }}
            >%</span>
          </div>
          <div className="relative mx-auto mt-6 h-px w-full max-w-md bg-white/10">
            <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-500 to-violet-500" style={{ width: `${p}%` }} />
            <span className="absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-white" style={{ left: `${p}%` }} />
          </div>
          <div className="mt-5 h-4 text-[11px] uppercase tracking-[0.3em] text-indigo-300/70">{word}</div>
        </div>
        <div className="flex items-end justify-between text-[10px] tracking-[0.3em] text-neutral-600">
          <span>PLAN &middot; INVITE &middot; CHECK IN</span>
          <span className="hidden sm:block">LOADING FONTS &amp; DEMOS</span>
        </div>
      </motion.div>
    </div>
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
