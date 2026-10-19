/**
 * frontend/src/components/HomeMotion.jsx
 *
 * Motion layer for the PlanIt home page. Additive only: nothing here changes
 * fonts, copy, demos or layout.
 *
 *   HomePreloader    branded progress indicator and a smooth curtain reveal.
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

/* ─── Branded loading curtain ──────────────────────────────────────────────── */
const LOAD_WORDS = ['Getting everything in place', 'Bringing the details together', 'Almost ready', 'Welcome to PlanIt'];

export function HomePreloader({ ready, onReveal, onDone }) {
  const reduce = useReducedMotion();
  const [p, setP] = useState(0);
  const [phase, setPhase] = useState('count');
  const readyRef = useRef(ready);
  readyRef.current = ready;

  useEffect(() => {
    let raf = 0;
    let exitTimer = 0;
    const t0 = performance.now();
    let last = t0;
    let value = 0;
    let fired = false;
    const minMs = reduce ? 250 : 1050;

    const tick = (now) => {
      const elapsed = now - t0;
      const dt = Math.min(64, now - last);
      last = now;
      const isReady = readyRef.current || elapsed > 4200;
      const target = isReady && elapsed > minMs
        ? 100
        : Math.min(isReady ? 96 : 88, (1 - Math.exp(-elapsed / 820)) * 100);
      value += (target - value) * (1 - Math.exp(-dt / (reduce ? 65 : 105)));
      if (target === 100 && value > 99.35) value = 100;
      setP(Math.round(value * 10) / 10);

      if (value >= 100 && !fired) {
        fired = true;
        exitTimer = window.setTimeout(() => {
          setPhase('exit');
          onReveal?.();
        }, reduce ? 20 : 130);
        return;
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(exitTimer);
    };
  }, [onReveal, reduce]);

  const exit = phase === 'exit';
  const word = LOAD_WORDS[Math.min(LOAD_WORDS.length - 1, Math.floor(p / 26))];

  return (
    <motion.div
      className="fixed inset-0 overflow-hidden"
      style={{ zIndex: 1100, background: '#05050f', color: '#f8fafc' }}
      role="status"
      aria-label="Loading PlanIt"
      animate={{ y: exit ? '-100%' : 0, opacity: 1 }}
      transition={{ duration: reduce ? 0.18 : 0.72, ease: [0.76, 0, 0.24, 1] }}
      onAnimationComplete={() => exit && onDone?.()}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{
        background: 'radial-gradient(ellipse at 50% 28%, rgba(99,102,241,.22) 0%, rgba(99,102,241,.08) 28%, transparent 62%), radial-gradient(ellipse at 82% 86%, rgba(45,212,191,.09) 0%, transparent 42%), linear-gradient(180deg, #08091b 0%, #05050f 72%)',
      }} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-40" style={{
        backgroundImage: 'linear-gradient(rgba(165,180,252,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(165,180,252,.055) 1px, transparent 1px)',
        backgroundSize: '72px 72px',
        maskImage: 'radial-gradient(ellipse at center, black 0%, transparent 78%)',
        WebkitMaskImage: 'radial-gradient(ellipse at center, black 0%, transparent 78%)',
      }} />

      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 pb-14 text-center">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: reduce ? 0.12 : 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative flex flex-col items-center"
        >
          <div aria-hidden="true" className="relative mb-6 flex h-[68px] w-[68px] items-center justify-center rounded-full border border-white/15 bg-white/[0.045] shadow-[0_0_70px_rgba(99,102,241,0.2)]">
            <span className="lq-display select-none text-[2.2rem] leading-none text-white">P</span>
            <span className="absolute right-[11px] top-[10px] h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,0.75)]" />
            {!reduce && <motion.span
              aria-hidden="true"
              className="absolute -inset-[7px] rounded-full border border-indigo-300/20"
              animate={{ scale: [0.98, 1.05, 0.98], opacity: [0.45, 0.9, 0.45] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
            />}
          </div>
          <div className="lq-display text-4xl font-extrabold tracking-[-0.06em] sm:text-5xl">PlanIt</div>
          <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.28em] text-indigo-200/65 sm:text-xs">Every detail, in sync</p>
        </motion.div>
      </div>

      <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-2xl px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:px-10 sm:pb-9">
        <div className="mb-3 flex min-h-5 items-center justify-between gap-4 text-[10px] font-medium uppercase tracking-[0.19em] text-white/55 sm:text-[11px] sm:tracking-[0.22em]">
          <motion.span key={word} initial={reduce ? false : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduce ? 0.1 : 0.28 }}>
            {word}
          </motion.span>
          <span className="shrink-0 tabular-nums text-white/75">{String(Math.min(100, Math.round(p))).padStart(2, '0')}%</span>
        </div>
        <div className="h-[3px] overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full" style={{
            width: `${Math.min(100, p)}%`,
            background: 'linear-gradient(90deg, #818cf8 0%, #a78bfa 52%, #6ee7b7 100%)',
            boxShadow: '0 0 18px rgba(129,140,248,.38)',
            transition: reduce ? 'width 90ms linear' : 'width 120ms linear',
          }} />
        </div>
      </div>
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
