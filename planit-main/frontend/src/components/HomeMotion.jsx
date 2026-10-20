/**
 * frontend/src/components/HomeMotion.jsx
 *
 * Motion layer for the PlanIt home page. Additive only: nothing here changes
 * fonts, copy, demos or layout.
 *
 *   HomePreloader    a bouncing-ball character piece that writes "PlanIt" and
 *                    bursts open as an iris. Holds until fonts + load are ready.
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

/* ─── Preloader ─────────────────────────────────────────────────────────────
   A character walks in from the left and shoves a big colour panel across the
   screen, uncovering the PlanIt wordmark. Then the panel and the character
   leave together and the loader dissolves onto the hero.

   Built to stay smooth on phones:
     - one requestAnimationFrame loop, zero React re-renders while it plays
     - only transforms and opacity are animated (compositor-friendly):
       no masks, filters, blur, canvas or layout-changing properties
     - the walk cycle is tied to the distance travelled, so feet never skate
     - the position eases toward its target, so a slow frame never causes a jump
   It holds near the end until fonts + window load are ready. Tap to fast-forward.
   prefers-reduced-motion gets a plain fade. Colours are the site's own.
   ───────────────────────────────────────────────────────────────────────── */
const WORD = ['P', 'l', 'a', 'n', 'I', 't'];
const INK = '#0b0b1c';
const LOAD_WORDS = ['Setting the stage', 'Seating the guests', 'Scanning the door', 'Doors open'];

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutBack = (t) => { const c1 = 1.9; const c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };

// A limb drawn as an outlined stroke: ink underneath, fill on top.
function Limb({ d, w, fill }) {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} stroke={INK} strokeWidth={w + 7} />
      <path d={d} stroke={fill} strokeWidth={w} />
    </g>
  );
}

function Shoe({ x, y, refEl }) {
  return (
    <g ref={refEl}>
      <path d={`M${x - 10} ${y - 4} L${x + 8} ${y - 6} Q${x + 24} ${y - 4} ${x + 26} ${y + 5} L${x + 26} ${y + 8} L${x - 12} ${y + 8} Z`} fill="#f5f6ff" stroke={INK} strokeWidth="3.4" strokeLinejoin="round" />
      <path d={`M${x - 2} ${y - 3} Q${x + 8} ${y + 1} ${x + 18} ${y - 2}`} stroke="#f472b6" strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d={`M${x - 12} ${y + 5} L${x + 26} ${y + 5}`} stroke={INK} strokeWidth="2.4" />
    </g>
  );
}

function Pusher({ refs }) {
  const skin = '#fcd9b6';
  const dots = [[76, 82], [96, 76], [112, 90], [84, 104], [104, 112], [120, 108], [74, 124], [94, 130]];
  return (
    <svg viewBox="0 0 200 240" className="h-full w-full" style={{ overflow: 'visible', display: 'block' }} aria-hidden="true">
      <g ref={refs.body}>
        {/* far arm */}
        <Limb d="M104 78 L142 92 L178 84" w={10} fill="#e9b98f" />
        {/* far leg (behind) */}
        <g ref={refs.legB}>
          <Limb d="M90 150 L84 190 L72 222" w={14} fill="#e9b98f" />
          <path d="M74 200 L72 222" stroke="#fff" strokeWidth="14" strokeLinecap="round" opacity="0.95" />
          <Shoe x={72} y={226} refEl={refs.shoeB} />
        </g>
        {/* torso: floral shirt */}
        <path d="M66 70 Q94 58 124 72 L128 132 Q96 146 68 136 Z" fill="#8b5cf6" stroke={INK} strokeWidth="3.4" strokeLinejoin="round" />
        {dots.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="4.6" fill="#f5f6ff" />)}
        {/* shorts */}
        <path d="M68 136 Q96 146 128 132 L132 170 L100 174 L96 156 L90 174 L66 170 Z" fill="#c7d2fe" stroke={INK} strokeWidth="3.4" strokeLinejoin="round" />
        {/* near leg */}
        <g ref={refs.legF}>
          <Limb d="M98 156 L108 192 L98 222" w={14} fill={skin} />
          <path d="M100 202 L98 222" stroke="#fff" strokeWidth="14" strokeLinecap="round" />
          <Shoe x={98} y={226} refEl={refs.shoeF} />
        </g>
        {/* head */}
        <circle cx="94" cy="44" r="20" fill={skin} stroke={INK} strokeWidth="3.4" />
        <path d="M72 40 Q72 14 96 14 Q118 16 114 38 Z" fill="#818cf8" stroke={INK} strokeWidth="3.4" strokeLinejoin="round" />
        <path d="M112 32 L140 40 L112 44 Z" fill="#818cf8" stroke={INK} strokeWidth="3.4" strokeLinejoin="round" />
        <circle cx="104" cy="46" r="2.6" fill={INK} />
        <path d="M98 40 L110 38" stroke={INK} strokeWidth="3" strokeLinecap="round" />
        <path d="M100 58 q6 4 12 -1" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M78 46 q4 7 0 11 q-4 -4 0 -11" fill="#7dd3fc" stroke={INK} strokeWidth="1.8" />
        {/* near arm */}
        <Limb d="M112 84 L146 102 L180 94" w={10} fill={skin} />
        <circle cx="184" cy="94" r="7.5" fill={skin} stroke={INK} strokeWidth="3.2" />
        <circle cx="181" cy="82" r="7.5" fill={skin} stroke={INK} strokeWidth="3.2" />
      </g>
    </svg>
  );
}

export function HomePreloader({ ready, onReveal, onDone }) {
  const reduce = useReducedMotion();
  const rootRef = useRef(null);
  const panelRef = useRef(null);
  const charRef = useRef(null);
  const wordRef = useRef(null);
  const letterRefs = useRef([]);
  const capRef = useRef(null);
  const pctRef = useRef(null);
  const partRefs = useRef({});
  const readyRef = useRef(ready);
  const speedRef = useRef(1);
  const cbRef = useRef({ onReveal, onDone });
  readyRef.current = ready;
  cbRef.current = { onReveal, onDone };

  useEffect(() => {
    const root = rootRef.current;
    const panel = panelRef.current;
    const charEl = charRef.current;
    const word = wordRef.current;
    const letters = letterRefs.current;
    const P = partRefs.current;
    if (!root || !panel || !charEl || !word) return undefined;

    let seen = false;
    try { seen = !!localStorage.getItem('planit_preloader_seen'); } catch { /* storage blocked */ }
    speedRef.current = seen ? 1.6 : 1;

    // geometry (re-measured on resize only)
    let vw = window.innerWidth;
    let charH = 200; let charW = 167; let travel = vw + charW;
    let lefts = [];
    const measure = () => {
      vw = window.innerWidth;
      charH = Math.max(170, Math.min(330, vw * 0.22 + 60));
      charW = charH * (200 / 240);
      charEl.style.height = `${charH}px`;
      charEl.style.width = `${charW}px`;
      charEl.style.marginTop = `${(-charH * 0.5).toFixed(1)}px`;
      travel = vw + charW;
      const wr = word.getBoundingClientRect();
      lefts = letters.map((el) => wr.left + el.offsetLeft);
    };
    measure();
    window.addEventListener('resize', measure);
    if (document.fonts?.ready) document.fonts.ready.then(measure).catch(() => {});

    let raf = 0;
    const t0 = performance.now();
    let last = t0;
    let el = 0;
    let pos = 0;
    let prevEdge = 0;
    let phase = 0;
    let revealed = false;
    let fadeAt = null;
    let finished = false;
    let lastPct = -1;
    let lastWord = '';
    const popAt = letters.map(() => null);
    const popDone = letters.map(() => false);

    const setLegs = (angF, angB) => {
      P.legF.setAttribute('transform', `rotate(${angF.toFixed(2)} 98 156)`);
      P.legB.setAttribute('transform', `rotate(${angB.toFixed(2)} 90 150)`);
      P.shoeF.setAttribute('transform', `rotate(${(-angF * 0.85).toFixed(2)} 98 226)`);
      P.shoeB.setAttribute('transform', `rotate(${(-angB * 0.85).toFixed(2)} 72 226)`);
    };

    const startFade = () => {
      if (fadeAt != null) return;
      fadeAt = el;
      root.style.transition = 'opacity 620ms cubic-bezier(.4,0,.2,1)';
      root.style.opacity = '0';
      word.style.transition = 'transform 620ms cubic-bezier(.22,1,.36,1)';
      word.style.transform = 'scale(1.06)';
    };

    const frame = (now) => {
      const rdt = Math.min(50, now - last); last = now;
      const dt = rdt * speedRef.current;
      el += dt;
      const canGo = readyRef.current || (now - t0) > 4800;

      // target progress: slow heave to start, steady shove, holds near the end until ready
      const u = clamp01((el - 250) / 2300);
      const base = easeInOutCubic(u);
      const target = Math.min(base, canGo ? 1 : 0.8);
      pos += (target - pos) * (1 - Math.exp(-dt / 110));
      if (target === 1 && pos > 0.9992) pos = 1;

      const edge = pos * travel;
      const dEdge = edge - prevEdge; prevEdge = edge;

      // the panel + the character share one edge, and only transform changes
      panel.style.transform = `translate3d(${edge.toFixed(1)}px,0,0)`;

      // walk cycle tied to distance, so feet don't skate; small idle strain when held
      const s = charH / 240;
      phase += (dEdge * Math.PI) / (80 * s) + (dEdge < 0.15 ? dt * 0.006 : 0);
      const sw = Math.sin(phase);
      const strain = (1 - u) * 0.9 + 0.1;
      setLegs(-6 + 26 * sw, 14 - 26 * sw);
      const bob = Math.abs(Math.cos(phase)) * 3 * s + Math.sin(el * 0.05) * 0.8 * strain;
      const lean = 11 + 3 * Math.sin(el * 0.02) * strain;
      P.body.setAttribute('transform', `translate(0 ${(-bob).toFixed(2)}) rotate(${lean.toFixed(2)} 96 232)`);
      charEl.style.transform = `translate3d(${(edge - charW * 0.97).toFixed(1)}px,0,0)`;

      // letters rise + fade in as the panel uncovers them
      for (let i = 0; i < letters.length; i += 1) {
        if (popDone[i]) continue;
        if (popAt[i] == null && edge > lefts[i]) popAt[i] = el;
        if (popAt[i] == null) continue;
        const k = clamp01((el - popAt[i]) / 520);
        const e = easeOutBack(k);
        letters[i].style.opacity = String(clamp01(k * 2.2));
        letters[i].style.transform = `translate3d(0,${((1 - e) * 0.14).toFixed(3)}em,0) scale(${(0.9 + 0.1 * e).toFixed(3)})`;
        if (k >= 1) { popDone[i] = true; letters[i].style.opacity = '1'; letters[i].style.transform = 'none'; }
      }

      // caption + percent only touch the DOM when they change
      const pct = Math.round(pos * 100);
      if (pct !== lastPct && pctRef.current) { lastPct = pct; pctRef.current.textContent = String(pct).padStart(2, '0'); }
      const w = LOAD_WORDS[Math.min(LOAD_WORDS.length - 1, Math.floor(pos * LOAD_WORDS.length))];
      if (w !== lastWord && capRef.current) { lastWord = w; capRef.current.textContent = w; }

      if (!revealed && edge > vw * 0.86) { revealed = true; cbRef.current.onReveal?.(); }
      if (fadeAt == null && edge > vw * 1.02) startFade();
      if (fadeAt != null && el - fadeAt > 640 && !finished) {
        finished = true;
        try { localStorage.setItem('planit_preloader_seen', '1'); } catch { /* storage blocked */ }
        cbRef.current.onDone?.();
        return;
      }
      raf = requestAnimationFrame(frame);
    };

    const frameReduced = (now) => {
      letters.forEach((l) => { l.style.opacity = '1'; });
      panel.style.display = 'none'; charEl.style.display = 'none';
      const e = now - t0;
      if (!revealed && (readyRef.current || e > 4000) && e > 450) {
        revealed = true; cbRef.current.onReveal?.();
        root.style.transition = 'opacity 320ms ease'; root.style.opacity = '0';
        setTimeout(() => { if (!finished) { finished = true; cbRef.current.onDone?.(); } }, 340);
      }
      if (!finished) raf = requestAnimationFrame(frameReduced);
    };

    raf = requestAnimationFrame(reduce ? frameReduced : frame);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', measure); };
  }, [reduce]);

  const legsRef = (k) => (el) => { partRefs.current[k] = el; };
  const refs = { body: legsRef('body'), legF: legsRef('legF'), legB: legsRef('legB'), shoeF: legsRef('shoeF'), shoeB: legsRef('shoeB') };

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 overflow-hidden"
      style={{ zIndex: 1100, background: '#05050f', touchAction: 'manipulation' }}
      role="status"
      aria-label="Loading PlanIt"
      onPointerDown={() => { speedRef.current = Math.max(speedRef.current, 3); }}
    >
      {/* the site's own atmosphere under the wordmark */}
      <div aria-hidden="true" className="absolute inset-0" style={{ background: 'radial-gradient(60% 55% at 28% 42%, rgba(99,102,241,.28), rgba(99,102,241,0) 70%), radial-gradient(50% 50% at 78% 70%, rgba(244,114,182,.15), rgba(244,114,182,0) 70%)' }} />

      <div className="absolute inset-0 flex items-center justify-center">
        <div
          ref={wordRef}
          aria-hidden="true"
          className="lq-display select-none whitespace-nowrap leading-none"
          style={{ fontSize: 'clamp(4rem, 21vw, 15rem)', letterSpacing: '-0.045em', color: '#f1f3ff', willChange: 'transform' }}
        >
          {WORD.map((ch, i) => (
            <span
              key={i}
              ref={(e) => { letterRefs.current[i] = e; }}
              style={{
                display: 'inline-block', opacity: 0, willChange: 'transform, opacity',
                ...(i >= 4 ? { background: 'linear-gradient(180deg,#a5b4fc 0%,#f472b6 70%,#fb923c 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', WebkitTextFillColor: 'transparent' } : null),
              }}
            >{ch}</span>
          ))}
        </div>
      </div>

      {/* the panel being shoved: solid black, starts covering the whole screen, ends off to the right */}
      <div
        ref={panelRef}
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-full"
        style={{ willChange: 'transform', background: '#000', boxShadow: '-1px 0 0 rgba(165,180,252,.55), -36px 0 70px -18px rgba(129,140,248,.40)' }}
      />

      {/* the character, hands on the panel's edge */}
      <div
        ref={charRef}
        aria-hidden="true"
        className="pointer-events-none absolute left-0"
        style={{ top: '50%', willChange: 'transform' }}
      >
        <div style={{ position: 'absolute', inset: 0, transform: 'translateY(0)' }}>
          <Pusher refs={refs} />
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-6 text-[11px] uppercase tracking-[0.25em] text-white/70 sm:p-10" style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
        <span ref={capRef}>Setting the stage</span>
        <span className="text-[clamp(1.4rem,4vw,2.6rem)] tracking-normal tabular-nums text-white/90"><span ref={pctRef}>00</span>%</span>
      </div>
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
