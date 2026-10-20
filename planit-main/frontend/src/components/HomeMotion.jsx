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
import { UserCheck, ScanLine, LayoutGrid, BarChart3 } from 'lucide-react';

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

/* ─── Hero headline: the letters are your event ─────────────────────────────
   Huge stacked headline, every letter its own element on a small spring
   system (one rAF loop, transforms + opacity only). On top of the hover swell
   and click shockwave, the letters play event-planning tools:

     RSVP      tap or drag across letters to mark guests "going"
     Check-in  a QR scanner beam sweeps down; letters light up as they check in
     Seating   the letters sit down at four round tables
     Live poll each line is an option; tap to vote while other votes trickle in

   Finishing RSVP or Check-in fires confetti. The loop only runs on screen.
   Reduced motion: static headline, no tools.
   ───────────────────────────────────────────────────────────────────────── */
const HEAD_LINES = ['Plan every', 'detail.', 'Execute', 'flawlessly.'];
const GRAD = 'linear-gradient(90deg,#818cf8 0%,#f472b6 25%,#fb923c 50%,#f472b6 75%,#818cf8 100%)';
const GOOD = '#34d399';
const TOOL_MODES = [
  { id: 'rsvp', label: 'RSVP', Icon: UserCheck, hint: 'Tap or drag across the letters to RSVP them' },
  { id: 'checkin', label: 'Check-in', Icon: ScanLine, hint: 'Scanning QR codes... tap to scan again' },
  { id: 'seating', label: 'Seating', Icon: LayoutGrid, hint: 'Every guest gets a seat. Tap a mode to change it' },
  { id: 'poll', label: 'Live poll', Icon: BarChart3, hint: 'Tap a line to vote. Other votes keep arriving' },
];

export function HeroHeadline({ start = true, lines = HEAD_LINES, className = '' }) {
  const reduce = useReducedMotion();
  const [mode, setMode] = useState('rsvp');
  const [status, setStatus] = useState('');
  const modeRef = useRef('rsvp');
  const h1Ref = useRef(null);
  const wrapRef = useRef(null);
  const glowRef = useRef(null);
  const beamRef = useRef(null);
  const confettiRef = useRef(null);
  const letterRefs = useRef([]);
  const badgeRefs = useRef([]);
  const tableRefs = useRef([]);
  const barRefs = useRef([]);
  const pctRefs = useRef([]);
  const startRef = useRef(start);
  startRef.current = start;
  modeRef.current = mode;

  const lastLine = lines.length - 1;

  useEffect(() => {
    const h1 = h1Ref.current;
    const glow = glowRef.current;
    if (!h1) return undefined;
    const els = letterRefs.current.filter(Boolean);
    const badges = badgeRefs.current;
    const N = els.length;
    const st = els.map(() => ({ x: 0, y: 0, r: 0, s: 1, vx: 0, vy: 0, vr: 0, vs: 0 }));
    if (reduce) { els.forEach((e) => { e.style.opacity = '1'; }); return undefined; }

    const isSp = els.map((e) => e.dataset.sp === '1');
    const lineOf = els.map((e) => Number(e.dataset.li));
    const real = []; els.forEach((_, k) => { if (!isSp[k]) real.push(k); });
    const T = real.length;
    const on = els.map(() => 0);
    const bs = els.map(() => 0);

    let F = 100; let W = 1; let H = 1;
    let cx = []; let cy = []; let gW = 1; let gLeft = []; let letterIdx = [];
    let seat = []; let seatRot = []; let tableC = []; let tableR = 0;
    let lineL = []; let lineW = []; let lineY = [];
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
      // per-line geometry for the poll bars
      lineL = []; lineW = []; lineY = [];
      for (let li = 0; li < lines.length; li += 1) {
        const ks = real.filter((k) => lineOf[k] === li);
        if (!ks.length) continue;
        const a = els[ks[0]]; const z = els[ks[ks.length - 1]];
        lineL[li] = a.offsetLeft; lineW[li] = z.offsetLeft + z.offsetWidth - a.offsetLeft;
        lineY[li] = a.offsetTop + a.offsetHeight * 0.93;
      }
      // seating layout: four round tables
      const nT = 4; const per = Math.ceil(T / nT);
      const tcx = [0.27, 0.73, 0.27, 0.73].map((v) => v * W);
      const tcy = [0.26, 0.26, 0.74, 0.74].map((v) => v * H);
      tableR = Math.min(W * 0.14, H * 0.2);
      tableC = tcx.map((x, i) => ({ x, y: tcy[i] }));
      seat = els.map(() => null); seatRot = els.map(() => 0);
      real.forEach((k, j) => {
        const t = Math.floor(j / per); const idx = j % per;
        const cnt = Math.min(per, T - t * per);
        const ang = -Math.PI / 2 + (idx / cnt) * Math.PI * 2;
        seat[k] = { x: tcx[t] + Math.cos(ang) * tableR, y: tcy[t] + Math.sin(ang) * tableR };
        seatRot[k] = (ang * 180) / Math.PI + 90;
      });
      tableRefs.current.forEach((el, i) => {
        if (!el || !tableC[i]) return;
        const r = tableR * 0.58;
        el.style.width = `${r * 2}px`; el.style.height = `${r * 2}px`;
        el.style.left = `${tableC[i].x - r}px`; el.style.top = `${tableC[i].y - r}px`;
      });
    };
    measure();
    window.addEventListener('resize', measure);
    if (document.fonts?.ready) document.fonts.ready.then(measure).catch(() => {});

    const ptr = { x: 0, y: 0, in: false, glow: 0, down: false, mouse: true };
    let rect = h1.getBoundingClientRect();
    const rel = (e) => { rect = h1.getBoundingClientRect(); ptr.x = e.clientX - rect.left; ptr.y = e.clientY - rect.top; };
    const inside = (m = 0) => ptr.x > -m && ptr.x < W + m && ptr.y > -m && ptr.y < H + m;
    const nearest = (maxD) => {
      let best = -1; let bd = maxD;
      for (let j = 0; j < T; j += 1) {
        const k = real[j];
        const d = Math.hypot(cx[k] + st[k].x - ptr.x, cy[k] + st[k].y - ptr.y);
        if (d < bd) { bd = d; best = k; }
      }
      return best;
    };

    // tool state
    let prevMode = null;
    let beam = { y: 0, active: false, done: false };
    let tableAmt = 0; let pollAmt = 0;
    const votes = [3, 5, 2, 4];
    const pctShown = [-1, -1, -1, -1];
    let celebrated = false;
    let lastStatus = '';

    // confetti (own short-lived loop)
    const cvs = confettiRef.current;
    let parts = []; let cfRaf = 0;
    const confetti = () => {
      if (!cvs || !wrapRef.current) return;
      const w = wrapRef.current.clientWidth; const hh = wrapRef.current.clientHeight;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      cvs.width = w * dpr; cvs.height = hh * dpr;
      const c = cvs.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
      const ox = w / 2; const oy = h1.offsetTop + H * 0.45;
      const cols = ['#818cf8', '#a78bfa', '#f472b6', '#fb923c', '#34d399', '#ffffff'];
      parts = Array.from({ length: 130 }, () => {
        const a = Math.random() * Math.PI * 2; const sp = 6 + Math.random() * 14;
        return { x: ox, y: oy, vx: Math.cos(a) * sp * 1.2, vy: Math.sin(a) * sp - 6, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, w: 6 + Math.random() * 7, h: 3 + Math.random() * 5, col: cols[(Math.random() * cols.length) | 0], life: 0 };
      });
      cancelAnimationFrame(cfRaf);
      let lt = performance.now();
      const step = (now) => {
        const k = Math.min(2, (now - lt) / 16.67); lt = now;
        c.clearRect(0, 0, w, hh);
        let alive = 0;
        parts.forEach((p) => {
          p.life += k; p.vy += 0.38 * k; p.vx *= 0.992; p.x += p.vx * k; p.y += p.vy * k; p.rot += p.vr * k;
          const al = Math.max(0, 1 - p.life / 110);
          if (al > 0 && p.y < hh + 30) {
            alive += 1; c.save(); c.globalAlpha = al; c.translate(p.x, p.y); c.rotate(p.rot);
            c.fillStyle = p.col; c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); c.restore();
          }
        });
        if (alive) cfRaf = requestAnimationFrame(step); else c.clearRect(0, 0, w, hh);
      };
      cfRaf = requestAnimationFrame(step);
    };

    const kickAll = (px, py, power = 7, radius = 1.4) => {
      for (let i = 0; i < N; i += 1) {
        const dx = cx[i] + st[i].x - px; const dy = cy[i] + st[i].y - py;
        const d = Math.hypot(dx, dy) || 1;
        const f = Math.exp(-Math.pow(d / (F * 1.15 * radius), 2));
        st[i].vx += (dx / d) * f * F * power; st[i].vy += (dy / d) * f * F * power;
        st[i].vr += (dx / d) * f * 260; st[i].vs += f * 5;
      }
    };
    const pop = (k, p = 1) => { st[k].vy -= F * 5 * p; st[k].vs += 6 * p; st[k].vr += (Math.random() - 0.5) * 220; };

    const handleTool = (e, isDown) => {
      const m = modeRef.current;
      if (!inside(0)) return;
      if (m === 'rsvp') {
        const k = nearest(F * 0.55);
        if (k < 0) return;
        if (isDown) { on[k] = on[k] ? 0 : 1; pop(k); ptr.last = k; }
        else if (ptr.down && ptr.mouse && ptr.last !== k) { if (!on[k]) { on[k] = 1; pop(k, 0.7); } ptr.last = k; }
      } else if (m === 'checkin' && isDown && beam.done) {
        on.fill(0); beam = { y: -F * 0.1, active: true, done: false }; celebrated = false;
      } else if (m === 'poll' && isDown) {
        const k = nearest(F * 0.7);
        if (k < 0) return;
        votes[lineOf[k]] += 1;
        real.forEach((q) => { if (lineOf[q] === lineOf[k]) pop(q, 0.55); });
      }
    };
    const onMove = (e) => {
      ptr.mouse = e.pointerType === 'mouse'; rel(e); ptr.in = true;
      if (ptr.down) handleTool(e, false);
    };
    const onDown = (e) => {
      ptr.mouse = e.pointerType === 'mouse'; rel(e); ptr.in = true; ptr.down = true;
      if (inside(F)) kickAll(ptr.x, ptr.y);
      handleTool(e, true);
    };
    const onUp = (e) => { ptr.down = false; ptr.last = -1; if (e.pointerType !== 'mouse') ptr.in = false; };
    const onLeave = () => { ptr.in = false; ptr.down = false; };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    window.addEventListener('pointercancel', onUp, { passive: true });
    document.addEventListener('pointerleave', onLeave);

    // other guests keep voting
    const sim = setInterval(() => {
      if (modeRef.current !== 'poll') return;
      const r = Math.random();
      votes[r < 0.38 ? 1 : r < 0.62 ? 3 : r < 0.84 ? 0 : 2] += 1;
    }, 650);

    let onScreen = true;
    let raf = 0;
    const io = new IntersectionObserver(([en]) => { onScreen = en.isIntersecting; if (onScreen && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }, { threshold: 0 });
    io.observe(h1);
    let last = performance.now();
    let tStart = null; let gx = 0; let gOff = 0;
    const STIFF = 190; const DAMP = 15;
    const easeBack = easeOutBack;

    function frame(now) {
      raf = 0;
      if (!onScreen) return;
      const dt = Math.min(0.04, (now - last) / 1000); last = now;
      if (startRef.current && tStart == null) tStart = now;
      const te = tStart == null ? -1 : now - tStart;
      const m = modeRef.current;

      // mode change: reset tool state
      if (m !== prevMode) {
        prevMode = m; on.fill(0); celebrated = false; beam = { y: -F * 0.1, active: m === 'checkin', done: false };
        if (m === 'checkin') els.forEach((_, k) => { bs[k] = 0; });
      }

      // check-in: the QR beam sweeps down, checking in whatever it crosses
      if (beam.active) {
        beam.y += dt * (H + F * 0.2) / 2.3;
        for (let j = 0; j < T; j += 1) {
          const k = real[j];
          if (!on[k] && cy[k] + st[k].y - F * 0.3 < beam.y) { on[k] = 1; pop(k, 0.5); }
        }
        if (beam.y > H + F * 0.2) { beam.active = false; beam.done = true; confetti(); }
      }
      if (beamRef.current) {
        const show = beam.active ? 1 : 0;
        beamRef.current.style.opacity = String(show);
        beamRef.current.style.transform = `translate3d(0,${beam.y.toFixed(1)}px,0)`;
      }

      tableAmt += ((m === 'seating' ? 1 : 0) - tableAmt) * (1 - Math.exp(-dt / 0.16));
      pollAmt += ((m === 'poll' ? 1 : 0) - pollAmt) * (1 - Math.exp(-dt / 0.16));

      let count = 0;
      for (let j = 0; j < T; j += 1) count += on[real[j]];
      if (m === 'rsvp') {
        if (count === T && !celebrated) { celebrated = true; confetti(); }
        if (count < T) celebrated = false;
      }

      for (let k = 0; k < N; k += 1) {
        const i = letterIdx[k]; const q = st[k]; const el = els[k];
        let tx = 0; let ty = 0; let tr = 0; let ts = 1;
        if (m === 'seating' && seat[k]) {
          tx = seat[k].x - cx[k]; ty = seat[k].y - cy[k]; ts = 0.5; tr = seatRot[k];
        } else if (ptr.in) {
          const dx = cx[k] - ptr.x; const dy = cy[k] - ptr.y;
          const d = Math.hypot(dx, dy) || 1;
          const f = Math.exp(-Math.pow(d / (F * 1.15), 2));
          tx = (dx / d) * f * F * 0.075; ty = (dy / d) * f * F * 0.075 - f * F * 0.03;
          tr = (dx / F) * f * -10; ts = 1 + 0.13 * f;
        }
        q.vx += ((tx - q.x) * STIFF - q.vx * DAMP) * dt; q.x += q.vx * dt;
        q.vy += ((ty - q.y) * STIFF - q.vy * DAMP) * dt; q.y += q.vy * dt;
        q.vr += ((tr - q.r) * STIFF - q.vr * DAMP) * dt; q.r += q.vr * dt;
        q.vs += ((ts - q.s) * STIFF - q.vs * DAMP) * dt; q.s += q.vs * dt;

        const ek = clamp01((te - i * 26) / 820);
        const e = te < 0 ? 0 : easeBack(ek);
        const ey = (1 - e) * F * 0.55;
        // check-in dims guests who haven't been scanned yet
        bs[k] += (on[k] - bs[k]) * (1 - Math.exp(-dt / 0.09));
        const dim = m === 'checkin' && !isSp[k] ? 0.38 + 0.62 * bs[k] : 1;
        el.style.opacity = te < 0 ? '0' : String((clamp01(ek * 2.4) * dim).toFixed(3));
        el.style.transform = `translate3d(${q.x.toFixed(2)}px,${(q.y + ey).toFixed(2)}px,0) rotate(${q.r.toFixed(2)}deg) scale(${(q.s * (0.85 + 0.15 * e)).toFixed(4)})`;

        // tick badge
        const b = badges[k];
        if (b) {
          const vis = m !== 'seating' && m !== 'poll' ? bs[k] : 0;
          if (vis > 0.01) {
            const sc = easeBack(clamp01(vis));
            b.style.opacity = String(clamp01(vis * 2).toFixed(2));
            b.style.transform = `translate3d(${(cx[k] + q.x + F * 0.26).toFixed(1)}px,${(cy[k] + q.y - F * 0.36).toFixed(1)}px,0) scale(${sc.toFixed(3)})`;
          } else b.style.opacity = '0';
        }
      }

      // gradient on the last line
      gOff += dt * gW * 0.09;
      const gTarget = ptr.in ? ((ptr.x / Math.max(1, rect.width)) - 0.5) * gW * 0.9 : 0;
      gx += (gTarget - gx) * (1 - Math.exp(-dt / 0.25));
      let gi = 0;
      for (let k = 0; k < N; k += 1) {
        if (els[k].dataset.grad !== '1') continue;
        els[k].style.backgroundPosition = `${(-gLeft[gi] + gOff + gx).toFixed(1)}px 0`;
        gi += 1;
      }

      // tables
      tableRefs.current.forEach((el) => { if (el) { el.style.opacity = tableAmt.toFixed(3); el.style.transform = `scale(${(0.6 + 0.4 * tableAmt).toFixed(3)})`; } });

      // poll bars
      const total = votes.reduce((a, c) => a + c, 0);
      for (let li = 0; li < lines.length; li += 1) {
        const bar = barRefs.current[li]; const lab = pctRefs.current[li];
        if (!bar || lineW[li] == null) continue;
        const share = votes[li] / total;
        bar.style.opacity = pollAmt.toFixed(3);
        bar.style.left = `${lineL[li]}px`; bar.style.top = `${lineY[li]}px`;
        bar.style.transform = `scaleX(${(share * pollAmt).toFixed(4)})`;
        bar.style.width = `${lineW[li]}px`;
        if (lab) {
          lab.style.opacity = pollAmt.toFixed(3);
          lab.style.left = `${lineL[li] + lineW[li] * share + 10}px`; lab.style.top = `${lineY[li] - F * 0.1}px`;
          const pc = Math.round(share * 100);
          if (pc !== pctShown[li]) { pctShown[li] = pc; lab.textContent = `${pc}%`; }
        }
      }

      if (glow) {
        ptr.glow += ((ptr.in ? 1 : 0) - ptr.glow) * (1 - Math.exp(-dt / 0.18));
        glow.style.opacity = ptr.glow.toFixed(3);
        glow.style.transform = `translate3d(${(ptr.x - F * 1.6).toFixed(1)}px,${(ptr.y - F * 1.6).toFixed(1)}px,0)`;
      }

      const s2 = m === 'rsvp' ? `${count} / ${T} going`
        : m === 'checkin' ? `${count} / ${T} checked in`
          : m === 'seating' ? `${T} guests, 4 tables`
            : `${total} votes`;
      if (s2 !== lastStatus) { lastStatus = s2; setStatus(s2); }

      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf); cancelAnimationFrame(cfRaf); clearInterval(sim); io.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      document.removeEventListener('pointerleave', onLeave);
    };
  }, [reduce, lines]);

  const full = lines.join(' ');
  let idx = 0;
  const active = TOOL_MODES.find((t) => t.id === mode) || TOOL_MODES[0];
  return (
    <div ref={wrapRef} className="relative mx-auto w-full" style={{ containerType: 'inline-size' }}>
      <h1
        ref={h1Ref}
        aria-label={full}
        className={`lq-display relative mx-auto text-white ${className}`}
        style={{ fontSize: 'min(12cqw, 13vh)', lineHeight: 0.94, letterSpacing: '-0.045em', textAlign: 'center', touchAction: 'manipulation', userSelect: 'none', WebkitUserSelect: 'none' }}
      >
        <div ref={glowRef} aria-hidden="true" className="pointer-events-none absolute left-0 top-0"
          style={{ width: '3.2em', height: '3.2em', opacity: 0, borderRadius: '50%', background: 'radial-gradient(circle, rgba(129,140,248,.34), rgba(244,114,182,.14) 45%, rgba(0,0,0,0) 70%)', willChange: 'transform, opacity', zIndex: -1 }} />
        {/* seating: four round tables */}
        {[0, 1, 2, 3].map((t) => (
          <div key={t} ref={(e) => { tableRefs.current[t] = e; }} aria-hidden="true" className="pointer-events-none absolute flex items-center justify-center rounded-full"
            style={{ opacity: 0, border: '1.5px solid rgba(165,180,252,.45)', background: 'radial-gradient(circle, rgba(129,140,248,.18), rgba(129,140,248,.04))', fontSize: '0.2em', color: 'rgba(255,255,255,.7)', fontFamily: "'DM Sans', system-ui, sans-serif", letterSpacing: '0.1em', zIndex: -1 }}>
            T{t + 1}
          </div>
        ))}
        {/* poll bars */}
        {lines.map((_, li) => (
          <div key={`b${li}`}>
            <div ref={(e) => { barRefs.current[li] = e; }} aria-hidden="true" className="pointer-events-none absolute"
              style={{ opacity: 0, height: '0.07em', borderRadius: 999, transformOrigin: '0 50%', background: 'linear-gradient(90deg,#818cf8,#f472b6,#fb923c)', boxShadow: '0 0 18px rgba(244,114,182,.5)', zIndex: 2 }} />
            <span ref={(e) => { pctRefs.current[li] = e; }} aria-hidden="true" className="pointer-events-none absolute"
              style={{ opacity: 0, fontSize: '0.2em', fontFamily: "'DM Sans', system-ui, sans-serif", letterSpacing: 0, fontWeight: 700, color: '#fff', zIndex: 2 }}>0%</span>
          </div>
        ))}
        {/* check-in scanner beam */}
        <div ref={beamRef} aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0" style={{ opacity: 0, height: 3, zIndex: 3, background: `linear-gradient(90deg, transparent, ${GOOD}, #fff, ${GOOD}, transparent)`, boxShadow: `0 0 26px 8px rgba(52,211,153,.5), 0 -40px 60px -10px rgba(52,211,153,.18)` }} />

        {lines.map((line, li) => (
          <span key={li} aria-hidden="true" className="block whitespace-nowrap">
            {[...line].map((ch, ci) => {
              const isGrad = li === lastLine;
              const i = idx; idx += 1;
              return (
                <span key={ci} ref={(e) => { letterRefs.current[i] = e; }} data-i={i} data-li={li} data-sp={ch === ' ' ? '1' : '0'} data-grad={isGrad ? '1' : '0'}
                  style={{
                    display: 'inline-block', opacity: 0, willChange: 'transform, opacity',
                    ...(isGrad ? { backgroundImage: GRAD, backgroundRepeat: 'repeat-x', backgroundSize: '100% 100%', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', WebkitTextFillColor: 'transparent', paddingRight: '0.03em' } : null),
                  }}
                >{ch === ' ' ? '\u00A0' : ch}</span>
              );
            })}
          </span>
        ))}
        {/* tick badges (own layer so the gradient text clip never touches them) */}
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
      </h1>

      <canvas ref={confettiRef} aria-hidden="true" className="pointer-events-none absolute inset-0 h-full w-full" style={{ zIndex: 5 }} />

      {!reduce && (
        <div className="mt-5 flex flex-col items-center gap-2.5 sm:mt-6">
          <div role="tablist" aria-label="Try the planning tools" className="flex flex-wrap items-center justify-center gap-2">
            {TOOL_MODES.map(({ id, label, Icon }) => {
              const on2 = id === mode;
              return (
                <button key={id} type="button" role="tab" aria-selected={on2} onClick={() => setMode(id)}
                  className="lq-glass inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-medium text-white transition-transform active:scale-95 sm:px-4 sm:py-2 sm:text-sm"
                  style={on2 ? { background: 'linear-gradient(135deg, rgba(129,140,248,.55), rgba(244,114,182,.42))' } : { color: 'rgba(255,255,255,.78)' }}>
                  <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={2} />{label}
                </button>
              );
            })}
          </div>
          <p className="min-h-[1.25rem] text-xs text-white/60 sm:text-sm" aria-live="polite">
            <span className="mr-2 inline-block rounded-full bg-white/10 px-2 py-0.5 font-medium tabular-nums text-white/90">{status}</span>
            {active.hint}
          </p>
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
