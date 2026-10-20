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

/* ─── Hero headline ─────────────────────────────────────────────────────────
   A normal, huge, stacked hero title: letters rise in with a stagger and the
   last line carries a slow shimmering gradient that leans toward the pointer.
   Nothing else moves, nothing gets in the way of reading it.

   Easter egg: the full stop at the very end ("flawlessly.") is secretly a
   button. Click it and a QR scanner beam sweeps down the headline, checking
   every letter in; then confetti and an "Event ready" toast. Replayable.
   A faint ring on the dot gives the curious a nudge after a few seconds.
   The loop only runs while on screen. Reduced motion: static title, no egg.
   ───────────────────────────────────────────────────────────────────────── */
const HEAD_LINES = ['Plan every', 'detail.', 'Execute', 'flawlessly.'];
const GRAD = 'linear-gradient(90deg,#818cf8 0%,#f472b6 25%,#fb923c 50%,#f472b6 75%,#818cf8 100%)';
const GOOD = '#34d399';

export function HeroHeadline({ start = true, lines = HEAD_LINES, className = '' }) {
  const reduce = useReducedMotion();
  const [toast, setToast] = useState(false);
  const [nudge, setNudge] = useState(false);
  const wrapRef = useRef(null);
  const h1Ref = useRef(null);
  const beamRef = useRef(null);
  const btnRef = useRef(null);
  const ringRef = useRef(null);
  const confettiRef = useRef(null);
  const letterRefs = useRef([]);
  const badgeRefs = useRef([]);
  const startRef = useRef(start);
  const runRef = useRef(null);
  const hoverRef = useRef(false);
  startRef.current = start;
  const lastLine = lines.length - 1;

  // a quiet nudge toward the dot, a few seconds after the headline lands
  useEffect(() => {
    if (reduce || !start) return undefined;
    const t = setTimeout(() => setNudge(true), 5200);
    return () => clearTimeout(t);
  }, [start, reduce]);

  useEffect(() => {
    const h1 = h1Ref.current;
    if (!h1) return undefined;
    const els = letterRefs.current.filter(Boolean);
    const badges = badgeRefs.current;
    const N = els.length;
    if (reduce) { els.forEach((e) => { e.style.opacity = '1'; }); return undefined; }

    const st = els.map(() => ({ y: 0, r: 0, s: 1, vy: 0, vr: 0, vs: 0 }));
    const isSp = els.map((e) => e.dataset.sp === '1');
    const real = []; els.forEach((_, k) => { if (!isSp[k]) real.push(k); });
    const T = real.length;
    const eggK = N - 1;
    const on = els.map(() => 0);
    const bs = els.map(() => 0);

    let F = 100; let W = 1; let H = 1; let cx = []; let cy = []; let gW = 1; let gLeft = []; let letterIdx = [];
    const measure = () => {
      F = parseFloat(getComputedStyle(h1).fontSize) || 100;
      W = h1.clientWidth; H = h1.clientHeight;
      cx = els.map((e) => e.offsetLeft + e.offsetWidth / 2);
      cy = els.map((e) => e.offsetTop + e.offsetHeight / 2);
      const g = els.filter((e) => e.dataset.grad === '1');
      if (g.length) {
        const l0 = g[0].offsetLeft; const l1 = g[g.length - 1].offsetLeft + g[g.length - 1].offsetWidth;
        gW = Math.max(1, l1 - l0); gLeft = g.map((e) => e.offsetLeft - l0);
      }
      letterIdx = els.map((e) => Number(e.dataset.i));
      // hit area + nudge ring sit on the final full stop
      const dotY = cy[eggK] + F * 0.3;
      if (btnRef.current) {
        const b = btnRef.current.style;
        b.left = `${cx[eggK] - F * 0.3}px`; b.top = `${dotY - F * 0.24}px`; b.width = `${F * 0.6}px`; b.height = `${F * 0.48}px`;
      }
      if (ringRef.current) {
        const r = ringRef.current.style; const d = F * 0.2;
        r.left = `${cx[eggK] - d / 2}px`; r.top = `${dotY - d / 2}px`; r.width = `${d}px`; r.height = `${d}px`;
      }
    };
    measure();
    window.addEventListener('resize', measure);
    if (document.fonts?.ready) document.fonts.ready.then(measure).catch(() => {});

    const ptr = { x: 0, in: false };
    let rect = h1.getBoundingClientRect();
    const onMove = (e) => { rect = h1.getBoundingClientRect(); ptr.x = e.clientX - rect.left; ptr.in = true; };
    const onLeave = () => { ptr.in = false; };
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);

    // confetti (short-lived, own loop)
    const cvs = confettiRef.current; let parts = []; let cfRaf = 0;
    const confetti = () => {
      if (!cvs || !wrapRef.current) return;
      const w = wrapRef.current.clientWidth; const hh = wrapRef.current.clientHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cvs.width = w * dpr; cvs.height = hh * dpr;
      const c = cvs.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
      const ox = cx[eggK] + h1.offsetLeft; const oy = h1.offsetTop + cy[eggK] + F * 0.3;
      const cols = ['#818cf8', '#a78bfa', '#f472b6', '#fb923c', '#34d399', '#ffffff'];
      parts = Array.from({ length: 140 }, () => {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4; const sp = 7 + Math.random() * 15;
        return { x: ox, y: oy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, w: 6 + Math.random() * 7, h: 3 + Math.random() * 5, col: cols[(Math.random() * cols.length) | 0], life: 0 };
      });
      cancelAnimationFrame(cfRaf);
      let lt = performance.now();
      const step = (now) => {
        const k = Math.min(2, (now - lt) / 16.67); lt = now;
        c.clearRect(0, 0, w, hh);
        let alive = 0;
        parts.forEach((p) => {
          p.life += k; p.vy += 0.4 * k; p.vx *= 0.99; p.x += p.vx * k; p.y += p.vy * k; p.rot += p.vr * k;
          const al = Math.max(0, 1 - p.life / 120);
          if (al > 0 && p.y < hh + 30) { alive += 1; c.save(); c.globalAlpha = al; c.translate(p.x, p.y); c.rotate(p.rot); c.fillStyle = p.col; c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); c.restore(); }
        });
        if (alive) cfRaf = requestAnimationFrame(step); else c.clearRect(0, 0, w, hh);
      };
      cfRaf = requestAnimationFrame(step);
    };

    // the egg
    let egg = { active: false, y: 0, hold: 0, phase: 'idle' };
    let toastTimer = 0;
    const pop = (k, p = 1) => { st[k].vy -= F * 4.2 * p; st[k].vs += 5 * p; st[k].vr += (Math.random() - 0.5) * 160 * p; };
    runRef.current = () => {
      if (egg.active) return;
      on.fill(0); egg = { active: true, y: -F * 0.1, hold: 0, phase: 'scan' };
      st[eggK].vs -= 9; // the dot gets pressed
      setNudge(false); setToast(false); clearTimeout(toastTimer);
    };

    let onScreen = true; let raf = 0; let last = performance.now();
    const io = new IntersectionObserver(([en]) => { onScreen = en.isIntersecting; if (onScreen && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }, { threshold: 0 });
    io.observe(h1);
    let tStart = null; let gx = 0; let gOff = 0;
    const STIFF = 190; const DAMP = 15;

    function frame(now) {
      raf = 0;
      if (!onScreen) return;
      const dt = Math.min(0.04, (now - last) / 1000); last = now;
      if (startRef.current && tStart == null) tStart = now;
      const te = tStart == null ? -1 : now - tStart;

      // scan -> hold -> release
      if (egg.active) {
        if (egg.phase === 'scan') {
          egg.y += dt * (H + F * 0.2) / 2.0;
          for (let j = 0; j < T; j += 1) {
            const k = real[j];
            if (!on[k] && cy[k] - F * 0.3 < egg.y) { on[k] = 1; pop(k, 0.45); }
          }
          if (egg.y > H + F * 0.2) { egg.phase = 'hold'; egg.hold = 0; confetti(); setToast(true); toastTimer = setTimeout(() => setToast(false), 3200); }
        } else if (egg.phase === 'hold') {
          egg.hold += dt;
          if (egg.hold > 1.7) { on.fill(0); egg.phase = 'idle'; egg.active = false; }
        }
      }
      if (beamRef.current) {
        beamRef.current.style.opacity = egg.active && egg.phase === 'scan' ? '1' : '0';
        beamRef.current.style.transform = `translate3d(0,${egg.y.toFixed(1)}px,0)`;
      }

      for (let k = 0; k < N; k += 1) {
        const i = letterIdx[k]; const q = st[k]; const el = els[k];
        const ts = k === eggK && hoverRef.current && !egg.active ? 1.28 : 1;
        q.vy += ((0 - q.y) * STIFF - q.vy * DAMP) * dt; q.y += q.vy * dt;
        q.vr += ((0 - q.r) * STIFF - q.vr * DAMP) * dt; q.r += q.vr * dt;
        q.vs += ((ts - q.s) * STIFF - q.vs * DAMP) * dt; q.s += q.vs * dt;

        const ek = clamp01((te - i * 26) / 820);
        const e = te < 0 ? 0 : easeOutBack(ek);
        const ey = (1 - e) * F * 0.55;
        bs[k] += (on[k] - bs[k]) * (1 - Math.exp(-dt / 0.09));
        const dim = egg.active && !isSp[k] ? 0.4 + 0.6 * bs[k] : 1;
        el.style.opacity = te < 0 ? '0' : (clamp01(ek * 2.4) * dim).toFixed(3);
        el.style.transform = `translate3d(0,${(q.y + ey).toFixed(2)}px,0) rotate(${q.r.toFixed(2)}deg) scale(${(q.s * (0.85 + 0.15 * e)).toFixed(4)})`;
        const b = badges[k];
        if (b) {
          if (bs[k] > 0.01) {
            b.style.opacity = clamp01(bs[k] * 2).toFixed(2);
            b.style.transform = `translate3d(${(cx[k] + F * 0.26).toFixed(1)}px,${(cy[k] + q.y - F * 0.36).toFixed(1)}px,0) scale(${easeOutBack(clamp01(bs[k])).toFixed(3)})`;
          } else b.style.opacity = '0';
        }
      }

      // gradient: drifts on its own, leans toward the pointer
      gOff += dt * gW * 0.09;
      const gTarget = ptr.in ? ((ptr.x / Math.max(1, rect.width)) - 0.5) * gW * 0.9 : 0;
      gx += (gTarget - gx) * (1 - Math.exp(-dt / 0.25));
      let gi = 0;
      for (let k = 0; k < N; k += 1) {
        if (els[k].dataset.grad !== '1') continue;
        els[k].style.backgroundPosition = `${(-gLeft[gi] + gOff + gx).toFixed(1)}px 0`;
        gi += 1;
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf); cancelAnimationFrame(cfRaf); clearTimeout(toastTimer); io.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      runRef.current = null;
    };
  }, [reduce, lines]);

  const full = lines.join(' ');
  let idx = 0;
  return (
    <div ref={wrapRef} className="relative mx-auto w-full" style={{ containerType: 'inline-size' }}>
      <style>{`@keyframes hh-ring { 0% { transform: scale(1); opacity: .55 } 70%,100% { transform: scale(3.4); opacity: 0 } }`}</style>
      <h1
        ref={h1Ref}
        aria-label={full}
        className={`lq-display relative mx-auto text-white ${className}`}
        style={{ fontSize: 'min(12cqw, 15.5vh)', lineHeight: 0.94, letterSpacing: '-0.045em', textAlign: 'center' }}
      >
        {lines.map((line, li) => (
          <span key={li} aria-hidden="true" className="block whitespace-nowrap">
            {[...line].map((ch, ci) => {
              const isGrad = li === lastLine;
              const i = idx; idx += 1;
              return (
                <span key={ci} ref={(e) => { letterRefs.current[i] = e; }} data-i={i} data-sp={ch === ' ' ? '1' : '0'} data-grad={isGrad ? '1' : '0'}
                  style={{
                    display: 'inline-block', opacity: 0, willChange: 'transform, opacity',
                    ...(isGrad ? { backgroundImage: GRAD, backgroundRepeat: 'repeat-x', backgroundSize: '100% 100%', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', WebkitTextFillColor: 'transparent', paddingRight: '0.03em' } : null),
                  }}
                >{ch === ' ' ? '\u00A0' : ch}</span>
              );
            })}
          </span>
        ))}

        {!reduce && (
          <>
            {/* check marks, in their own layer so the gradient text clip never touches them */}
            {(() => {
              let bi = 0;
              return lines.map((line) => [...line].map((ch, ci) => {
                const k = bi; bi += 1;
                if (ch === ' ') return null;
                return (
                  <span key={`k${k}-${ci}`} ref={(e) => { badgeRefs.current[k] = e; }} aria-hidden="true" className="pointer-events-none absolute left-0 top-0 flex items-center justify-center rounded-full"
                    style={{ opacity: 0, width: '0.3em', height: '0.3em', marginLeft: '-0.15em', marginTop: '-0.15em', background: GOOD, boxShadow: '0 0 16px rgba(52,211,153,.75)', zIndex: 4, willChange: 'transform, opacity' }}>
                    <svg viewBox="0 0 24 24" width="62%" height="62%" fill="none" stroke="#04210f" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
                  </span>
                );
              }));
            })()}
            <div ref={beamRef} aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0" style={{ opacity: 0, height: 3, zIndex: 3, background: `linear-gradient(90deg, transparent, ${GOOD}, #fff, ${GOOD}, transparent)`, boxShadow: '0 0 26px 8px rgba(52,211,153,.5), 0 -40px 60px -10px rgba(52,211,153,.18)' }} />
            <span ref={ringRef} aria-hidden="true" className="pointer-events-none absolute rounded-full" style={{ border: '2px solid rgba(251,146,60,.9)', opacity: 0, animation: nudge ? 'hh-ring 2.6s ease-out 3' : 'none', animationFillMode: 'none' }} />
            {/* the egg: invisible button over the final full stop */}
            <button
              ref={btnRef}
              type="button"
              aria-label="Easter egg: check everyone in"
              title="Psst. Click the dot."
              onClick={() => runRef.current?.()}
              onMouseEnter={() => { hoverRef.current = true; }}
              onMouseLeave={() => { hoverRef.current = false; }}
              onFocus={() => { hoverRef.current = true; }}
              onBlur={() => { hoverRef.current = false; }}
              className="absolute rounded-full outline-none focus-visible:ring-2 focus-visible:ring-orange-300/80"
              style={{ cursor: 'pointer', background: 'transparent', zIndex: 6, letterSpacing: 0 }}
            />
          </>
        )}
      </h1>

      <canvas ref={confettiRef} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" style={{ zIndex: 5 }} />

      {!reduce && (
        <div aria-live="polite" className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2" style={{ top: '100%', marginTop: -2 }}>
          <div className="lq-glass whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-medium text-white sm:text-sm"
            style={{ opacity: toast ? 1 : 0, transform: `translateY(${toast ? 0 : -6}px) scale(${toast ? 1 : 0.96})`, transition: 'opacity .35s ease, transform .45s cubic-bezier(.22,1,.36,1)' }}>
            <span style={{ color: GOOD }}>&#10003;</span> {toast ? 'Event ready. Everyone checked in.' : ''}
          </div>
        </div>
      )}
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
