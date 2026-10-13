import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  motion, AnimatePresence, useScroll, useTransform, useSpring, useInView,
  useMotionValue, useReducedMotion, useAnimationFrame, useVelocity,
} from 'framer-motion';
import {
  ArrowRight, ArrowLeft, ArrowUpRight, Check, CheckCircle2, ChevronDown, Clock, Copy, Globe,
  Heart, Layers, Link2, Loader2, Lock, MapPin, Rocket, Search, Share2, Shield, Sparkles,
  Star, Users, X, Zap, AlertCircle, Briefcase, Award, Calendar, Linkedin, Github,
} from 'lucide-react';
import api from '../services/api';
import { getIdentity } from '../services/tracker';
import StarBackground from '../components/StarBackground';
import TurnstileWidget from '../components/TurnstileWidget';

/* ════════════════════════════════════════════════════════════════════════════
   PlanIt Careers  ·  /careers  and  /careers/:slug
   Volunteer roles. Scroll-driven hero, depth rail, timeline, 3D role cards,
   slide-over role details with a 3-step apply flow, and full attribution
   capture ("where did you come from?") for LinkedIn and every recruiting site.
   ════════════════════════════════════════════════════════════════════════════ */

const EASE = [0.22, 1, 0.36, 1];
const cx = (...a) => a.filter(Boolean).join(' ');

/* ─── "Where did you find us?" ──────────────────────────────────────────────
   Keys MUST match SOURCES in backend/models/JobApplication.js                 */
const SOURCE_OPTIONS = [
  { key: 'linkedin',     label: 'LinkedIn',      color: '#0a66c2' },
  { key: 'indeed',       label: 'Indeed',        color: '#2164f3' },
  { key: 'handshake',    label: 'Handshake',     color: '#d7263d' },
  { key: 'glassdoor',    label: 'Glassdoor',     color: '#0caa41' },
  { key: 'wellfound',    label: 'Wellfound',     color: '#ef4444' },
  { key: 'ziprecruiter', label: 'ZipRecruiter',  color: '#3b82f6' },
  { key: 'github',       label: 'GitHub',        color: '#a3a3a3' },
  { key: 'devpost',      label: 'Devpost',       color: '#38bdf8' },
  { key: 'discord',      label: 'Discord',       color: '#5865f2' },
  { key: 'reddit',       label: 'Reddit',        color: '#ff4500' },
  { key: 'twitter',      label: 'X / Twitter',   color: '#e5e5e5' },
  { key: 'instagram',    label: 'Instagram',     color: '#e1306c' },
  { key: 'tiktok',       label: 'TikTok',        color: '#25f4ee' },
  { key: 'youtube',      label: 'YouTube',       color: '#ff0033' },
  { key: 'facebook',     label: 'Facebook',      color: '#1877f2' },
  { key: 'google',       label: 'Google search', color: '#fbbc05' },
  { key: 'school',       label: 'School / club', color: '#34d399' },
  { key: 'friend',       label: 'A friend',      color: '#f472b6' },
  { key: 'planit',       label: 'PlanIt itself', color: '#a78bfa' },
  { key: 'other',        label: 'Somewhere else', color: '#94a3b8' },
];
const SOURCE_KEYS = SOURCE_OPTIONS.map((s) => s.key);
const ALIASES = {
  li: 'linkedin', lnkd: 'linkedin', hs: 'handshake', gd: 'glassdoor', zip: 'ziprecruiter',
  angellist: 'wellfound', angel: 'wellfound', x: 'twitter', tw: 'twitter', ig: 'instagram',
  fb: 'facebook', yt: 'youtube', gh: 'github', dp: 'devpost', gg: 'google', bing: 'google',
  share: 'friend', referral: 'friend', copy: 'friend',
};
const HOST_RULES = [
  [/(^|\.)linkedin\.com$|(^|\.)lnkd\.in$/, 'linkedin'],
  [/(^|\.)indeed\.com$/, 'indeed'],
  [/joinhandshake\.com$/, 'handshake'],
  [/glassdoor\./, 'glassdoor'],
  [/wellfound\.com$|(^|\.)angel\.co$/, 'wellfound'],
  [/ziprecruiter\.com$/, 'ziprecruiter'],
  [/(^|\.)github\.com$/, 'github'],
  [/devpost\.com$/, 'devpost'],
  [/discord\.(com|gg)$|discordapp\.com$/, 'discord'],
  [/(^|\.)reddit\.com$|(^|\.)redd\.it$/, 'reddit'],
  [/(^|\.)t\.co$|twitter\.com$|(^|\.)x\.com$/, 'twitter'],
  [/instagram\.com$/, 'instagram'],
  [/tiktok\.com$/, 'tiktok'],
  [/youtube\.com$|youtu\.be$/, 'youtube'],
  [/facebook\.com$|(^|\.)fb\.com$|(^|\.)fb\.me$/, 'facebook'],
  [/(^|\.)google\.[a-z.]+$|bing\.com$|duckduckgo\.com$|search\.brave\.com$/, 'google'],
];
const normKey = (v) => {
  const k = String(v || '').toLowerCase().trim().replace(/[^a-z]/g, '');
  if (!k) return '';
  if (SOURCE_KEYS.includes(k)) return k;
  return ALIASES[k] || '';
};
const hostKey = (host) => { for (const [rx, key] of HOST_RULES) if (rx.test(host)) return key; return ''; };

const FIRST_TOUCH_KEY = 'planit_careers_first_touch';

/** Reads UTM / ?src= / document.referrer once per page load. First touch is persisted. */
function readAttribution() {
  const out = { first: {}, last: {}, detected: '', returning: false };
  try {
    const q = new URLSearchParams(window.location.search);
    const ref = document.referrer || '';
    let refHost = '', refPath = '';
    try { const u = new URL(ref); refHost = u.hostname.replace(/^www\./, ''); refPath = u.pathname; } catch { /* no referrer */ }
    const internal = refHost && refHost === window.location.hostname.replace(/^www\./, '');
    const fromParam = normKey(q.get('src') || q.get('ref') || q.get('source') || q.get('utm_source'));
    const fromHost = refHost ? (internal ? 'planit' : hostKey(refHost)) : '';
    const detected = fromParam || fromHost;
    const touch = {
      source: q.get('utm_source') || q.get('src') || '', medium: q.get('utm_medium') || '',
      campaign: q.get('utm_campaign') || '', content: q.get('utm_content') || '', term: q.get('utm_term') || '',
      ref: q.get('ref') || q.get('src') || '', referrer: refHost ? `${refHost}${refPath}` : '',
      landing: `${window.location.pathname}${window.location.search}`.slice(0, 300), at: new Date().toISOString(),
    };
    let first = null;
    try { first = JSON.parse(localStorage.getItem(FIRST_TOUCH_KEY) || 'null'); } catch { /* ignore */ }
    if (!first) {
      first = { ...touch, detected };
      try { localStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(first)); } catch { /* ignore */ }
    } else { out.returning = true; }
    out.first = first; out.last = touch;
    // A later internal navigation shouldn't overwrite a real external source.
    out.detected = (detected && detected !== 'planit') ? detected : (first.detected && first.detected !== 'planit' ? first.detected : detected);
  } catch { /* attribution must never break the page */ }
  return out;
}

/* ─── Engagement capture: scroll depth, time on page, roles viewed ─────────── */
function useEngagement() {
  const ref = useRef({ maxScroll: 0, seconds: 0, formStart: 0, roles: new Set(), pageViews: 0 });
  useEffect(() => {
    const e = ref.current;
    try {
      e.pageViews = (parseInt(sessionStorage.getItem('planit_careers_pv') || '0', 10) || 0) + 1;
      sessionStorage.setItem('planit_careers_pv', String(e.pageViews));
    } catch { /* ignore */ }
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const d = document.documentElement;
        const pct = Math.min(100, Math.round(((window.scrollY + window.innerHeight) / Math.max(1, d.scrollHeight)) * 100));
        if (pct > e.maxScroll) e.maxScroll = pct;
      });
    };
    const timer = setInterval(() => { if (!document.hidden) e.seconds += 1; }, 1000);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => { clearInterval(timer); window.removeEventListener('scroll', onScroll); };
  }, []);
  return ref;
}

/** Fire-and-forget funnel beacon. */
function ping(event, extra = {}) {
  try {
    const { visitorId, sessionId } = getIdentity();
    api.post('/careers/funnel', { event, visitorId, sessionId, ...extra }).catch(() => {});
  } catch { /* ignore */ }
}

/* ─── Fonts, helpers, hooks ────────────────────────────────────────────────── */
// Unbounded (wide, sci-fi display) + Instrument Serif italic (accent) + DM Mono (labels).
// Loaded only on this route so the rest of the app is unaffected.
const FONT_HREF = 'https://fonts.googleapis.com/css2?family=Unbounded:wght@400;600;700;800;900&family=Instrument+Serif:ital@0;1&family=DM+Mono:wght@400;500&display=swap';

const wrap = (min, max, v) => { const r = max - min; return ((((v - min) % r) + r) % r) + min; };
const hueFor = (s = '') => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };
const TEAM_COLOR = {
  Engineering: '#818cf8', Design: '#f472b6', Security: '#34d399', Marketing: '#fbbf24', Community: '#22d3ee',
  Growth: '#a3e635', Operations: '#c4b5fd', Leadership: '#fb923c', People: '#f9a8d4', Partnerships: '#5eead4',
};
const teamColor = (t) => TEAM_COLOR[t] || `hsl(${hueFor(t)} 80% 72%)`;

function usePointerFine() {
  const [fine, setFine] = useState(false);
  useEffect(() => { setFine(!!window.matchMedia?.('(pointer: fine)').matches); }, []);
  return fine;
}

/** Injects the careers fonts once and resolves when they are actually usable. */
function useCareersFonts() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    const done = () => { if (alive) setReady(true); };
    const timer = setTimeout(done, 3000);   // never block the page on a slow font CDN
    const load = () => Promise.all([
      document.fonts.load('800 1em Unbounded'), document.fonts.load('italic 1em "Instrument Serif"'), document.fonts.load('500 1em "DM Mono"'),
    ]).then(done, done);
    let link = document.getElementById('careers-fonts');
    if (!link) {
      link = document.createElement('link');
      link.id = 'careers-fonts'; link.rel = 'stylesheet'; link.href = FONT_HREF;
      link.addEventListener('load', load); link.addEventListener('error', done);
      document.head.appendChild(link);
    } else load();
    return () => { alive = false; clearTimeout(timer); };
  }, []);
  return ready;
}

const GLYPHS = '!<>-_\\/[]{}=+*^?#';
function useScramble(text, run, delay = 0) {
  const reduce = useReducedMotion();
  const [out, setOut] = useState(reduce ? text : '');
  useEffect(() => {
    if (!run) return undefined;
    if (reduce) { setOut(text); return undefined; }
    let raf; let start = 0;
    const total = 800;
    const tick = (t) => {
      if (!start) start = t + delay;
      const p = Math.max(0, Math.min(1, (t - start) / total));
      const reveal = Math.floor(p * text.length);
      let s = '';
      for (let i = 0; i < text.length; i++) s += (i < reveal || text[i] === ' ') ? text[i] : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      setOut(p === 0 ? '' : s);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text, run, delay, reduce]);
  return out;
}

/* ─── Animation primitives ─────────────────────────────────────────────────── */
function Reveal({ children, delay = 0, y = 28, className = '', as = 'div' }) {
  const reduce = useReducedMotion();
  const Tag = motion[as] || motion.div;
  return (
    <Tag
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.75, delay, ease: EASE }}
    >
      {children}
    </Tag>
  );
}

/** Word-by-word masked rise. `accent` words render in the serif italic with a moving gradient. */
function Words({ text, className = '', delay = 0, accent = [], inView = false }) {
  const reduce = useReducedMotion();
  const trigger = inView ? { whileInView: { y: 0, rotate: 0 }, viewport: { once: true, margin: '-12%' } } : { animate: { y: 0, rotate: 0 } };
  return (
    <span className={className} aria-label={text}>
      {text.split(' ').map((w, i) => (
        <span key={i} className="inline-block overflow-hidden align-bottom pb-[0.18em] -mb-[0.18em] pr-[0.18em] -mr-[0.18em] pl-[0.04em] -ml-[0.04em]" aria-hidden="true">
          <motion.span
            className={cx('inline-block', accent.includes(i) && 'font-serif-i careers-shine text-[1.16em] leading-[0.8]')}
            initial={reduce ? false : { y: '115%', rotate: 4 }}
            {...trigger}
            transition={{ duration: 1, delay: delay + i * 0.07, ease: EASE }}
          >
            {w}
          </motion.span>
          {'\u00A0'}
        </span>
      ))}
    </span>
  );
}

/** Per-character kinetic headline. Words flagged `serif` rise as a single unit so the gradient stays smooth. */
function Kinetic({ lines, go = true, delay = 0, className = '' }) {
  const reduce = useReducedMotion();
  let k = 0;
  const hidden = { y: '118%', rotate: 7, opacity: 0 };
  const shown = { y: 0, rotate: 0, opacity: 1 };
  const box = { padding: '0.12em 0.2em 0.2em', margin: '-0.12em -0.2em -0.2em' };
  return (
    <h1 className={className} aria-label={lines.map((l) => l.map((w) => w.t).join(' ')).join(' ')}>
      {lines.map((line, li) => (
        <span key={li} className="block" aria-hidden="true">
          {line.map((w, wi) => (
            <span key={wi}>
              <span className="inline-block whitespace-nowrap align-bottom">
                {w.serif ? (
                  <span className="inline-block overflow-hidden align-bottom" style={box}>
                    <motion.span
                      className="font-serif-i careers-shine inline-block text-[1.2em] leading-[0.82]"
                      initial={reduce ? false : hidden} animate={go ? shown : hidden}
                      transition={{ duration: 1.1, delay: delay + (k++) * 0.04, ease: EASE }}
                    >{w.t}</motion.span>
                  </span>
                ) : [...w.t].map((ch, ci) => (
                  <span key={ci} className="inline-block overflow-hidden align-bottom" style={box}>
                    <motion.span
                      className="inline-block" initial={reduce ? false : hidden} animate={go ? shown : hidden}
                      transition={{ duration: 1, delay: delay + (k++) * 0.04, ease: EASE }}
                    >{ch}</motion.span>
                  </span>
                ))}
              </span>
              {wi < line.length - 1 ? ' ' : null}
            </span>
          ))}
        </span>
      ))}
    </h1>
  );
}

function Counter({ to, suffix = '', run = true }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-10%' });
  const reduce = useReducedMotion();
  const [v, setV] = useState(reduce ? to : 0);
  useEffect(() => {
    if (!inView || !run) return undefined;
    if (reduce) { setV(to); return undefined; }
    let raf; const t0 = performance.now(); const dur = 1600;
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      setV(Math.round(to * (1 - Math.pow(1 - p, 4))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [inView, run, to, reduce]);
  return <span ref={ref}>{v}{suffix}</span>;
}

/** Pulls its children toward the cursor. */
function Magnetic({ children, strength = 0.32, className = '' }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const fine = usePointerFine();
  const x = useMotionValue(0); const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 240, damping: 16, mass: 0.4 }); const sy = useSpring(y, { stiffness: 240, damping: 16, mass: 0.4 });
  const move = (e) => {
    if (!fine || reduce || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * strength); y.set((e.clientY - (r.top + r.height / 2)) * strength);
  };
  const leave = () => { x.set(0); y.set(0); };
  return <motion.div ref={ref} style={{ x: sx, y: sy }} onMouseMove={move} onMouseLeave={leave} className={cx('inline-block', className)}>{children}</motion.div>;
}

/** Card with a cursor-following spotlight. */
function Spotlight({ children, className = '', color = 'rgba(99,102,241,0.20)' }) {
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
  };
  return (
    <div
      onMouseMove={onMove}
      className={cx('group relative overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.025] backdrop-blur-sm transition-colors duration-500 hover:border-white/[0.18]', className)}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: `radial-gradient(420px circle at var(--mx,50%) var(--my,50%), ${color}, transparent 45%)` }}
      />
      <div className="relative h-full">{children}</div>
    </div>
  );
}

/** Mono section label: (01) ——— SCRAMBLING TEXT */
function Eyebrow({ n, children, className = '' }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-10%' });
  const txt = useScramble(String(children).toUpperCase(), inView);
  return (
    <div ref={ref} className={cx('flex items-center gap-3 font-mono text-[11px] font-medium tracking-[0.28em] text-cyan-300', className)} aria-label={String(children)}>
      <span className="text-neutral-500" aria-hidden="true">({n})</span>
      <motion.span aria-hidden="true" className="h-px bg-gradient-to-r from-cyan-300/70 to-transparent" initial={{ width: 0 }} animate={inView ? { width: 48 } : {}} transition={{ duration: 0.9, ease: EASE }} />
      <span aria-hidden="true">{txt || '\u00A0'}</span>
    </div>
  );
}

/* ─── Page chrome: grain, cursor, preloader ────────────────────────────────── */
const GRAIN = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .6 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")";

function Grain() {
  return <div aria-hidden="true" className="careers-grain pointer-events-none fixed -inset-1/2 z-[3] opacity-[0.055]" style={{ backgroundImage: GRAIN }} />;
}

/** Soft cursor follower. Reads data-cursor="Label" from whatever is under the pointer. */
function Cursor() {
  const fine = usePointerFine();
  const reduce = useReducedMotion();
  const x = useMotionValue(-100); const y = useMotionValue(-100);
  const dx = useSpring(x, { stiffness: 900, damping: 50, mass: 0.2 }); const dy = useSpring(y, { stiffness: 900, damping: 50, mass: 0.2 });
  const rx = useSpring(x, { stiffness: 170, damping: 22, mass: 0.5 }); const ry = useSpring(y, { stiffness: 170, damping: 22, mass: 0.5 });
  const [mode, setMode] = useState({ kind: 'idle', label: '' });
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!fine || reduce) return undefined;
    const move = (e) => { x.set(e.clientX); y.set(e.clientY); setVisible(true); };
    const over = (e) => {
      const el = e.target.closest?.('[data-cursor],a,button,input,textarea,select,summary');
      const label = el?.getAttribute?.('data-cursor') || '';
      const kind = !el ? 'idle' : label ? 'label' : 'link';
      setMode((m) => (m.kind === kind && m.label === label ? m : { kind, label }));
    };
    const leave = () => setVisible(false);
    window.addEventListener('mousemove', move, { passive: true });
    window.addEventListener('mouseover', over, { passive: true });
    document.documentElement.addEventListener('mouseleave', leave);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseover', over); document.documentElement.removeEventListener('mouseleave', leave); };
  }, [fine, reduce, x, y]);
  if (!fine || reduce) return null;
  const size = mode.kind === 'label' ? 84 : mode.kind === 'link' ? 52 : 30;
  return (
    <>
      <motion.div aria-hidden="true" className="pointer-events-none fixed left-0 top-0 z-[250]" style={{ x: dx, y: dy, opacity: visible ? 1 : 0 }}>
        <span className={cx('absolute block h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white transition-opacity duration-200', mode.kind === 'label' && 'opacity-0')} />
      </motion.div>
      <motion.div aria-hidden="true" className="pointer-events-none fixed left-0 top-0 z-[249]" style={{ x: rx, y: ry, opacity: visible ? 1 : 0 }}>
        <motion.div
          className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border"
          animate={{ width: size, height: size, backgroundColor: mode.kind === 'label' ? 'rgba(255,255,255,1)' : mode.kind === 'link' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0)', borderColor: mode.kind === 'label' ? 'rgba(255,255,255,1)' : 'rgba(255,255,255,0.32)' }}
          transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        >
          <AnimatePresence>
            {mode.kind === 'label' && <motion.span key={mode.label} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-900">{mode.label}</motion.span>}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </>
  );
}

const LOAD_WORDS = ['Compiling roles', 'Warming up the crew', 'Aligning pixels', 'Almost there'];

/** Counter + hairline progress, then a two-panel curtain. Progress follows real readiness (fonts + roles). */
function Preloader({ ready, onReveal, onDone }) {
  const [p, setP] = useState(0);
  const [phase, setPhase] = useState('count');
  const readyRef = useRef(ready);
  readyRef.current = ready;
  useEffect(() => {
    let raf; const t0 = performance.now(); let last = t0; let val = 0; let fired = false;
    const tick = (t) => {
      const el = t - t0; const dt = Math.min(64, t - last); last = t;
      const ok = readyRef.current || el > 3800;
      const target = ok && el > 1500 ? 100 : Math.min(ok ? 96 : 86, (1 - Math.exp(-el / 800)) * 100);
      val += (target - val) * (1 - Math.exp(-dt / 120));
      if (target === 100 && val > 99.4) val = 100;
      setP(Math.round(val));
      if (val >= 100 && !fired) { fired = true; setTimeout(() => { setPhase('exit'); onReveal(); }, 380); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onReveal]);
  const exit = phase === 'exit';
  const word = LOAD_WORDS[Math.min(LOAD_WORDS.length - 1, Math.floor(p / 26))];
  const curtain = { duration: 1.05, ease: [0.76, 0, 0.24, 1], delay: 0.38 };
  return (
    <div className="fixed inset-0 z-[300]" role="status" aria-label="Loading careers">
      <motion.div className="absolute inset-x-0 top-0 h-1/2 bg-[#05050f]" animate={{ y: exit ? '-101%' : 0 }} transition={curtain}>
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-cyan-300/50 to-transparent" />
      </motion.div>
      <motion.div className="absolute inset-x-0 bottom-0 h-1/2 bg-[#05050f]" animate={{ y: exit ? '101%' : 0 }} transition={curtain} onAnimationComplete={() => exit && onDone()} />
      <motion.div className="absolute inset-0 flex flex-col justify-between p-6 sm:p-10" animate={{ opacity: exit ? 0 : 1, scale: exit ? 1.04 : 1, filter: exit ? 'blur(10px)' : 'blur(0px)' }} transition={{ duration: 0.55, ease: EASE }}>
        <div className="flex items-start justify-between font-mono text-[11px] tracking-[0.3em] text-neutral-500">
          <span><b className="font-display text-sm font-extrabold tracking-tight text-white">PlanIt</b> / CAREERS</span>
          <span>© {new Date().getFullYear()}</span>
        </div>
        <div className="mx-auto w-full max-w-3xl text-center">
          <div className="font-display text-[clamp(5rem,24vw,15rem)] font-black leading-none tracking-[-0.06em] text-white tabular-nums">
            {String(p).padStart(2, '0')}<span className="careers-shine inline-block pr-[0.14em] align-top text-[0.28em]">%</span>
          </div>
          <div className="relative mx-auto mt-6 h-px w-full max-w-md bg-white/10">
            <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-400 via-cyan-300 to-emerald-300" style={{ width: `${p}%` }} />
            <span className="absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-white shadow-[0_0_16px_4px_rgba(103,232,249,0.9)]" style={{ left: `${p}%` }} />
          </div>
          <div className="mt-5 h-4 font-mono text-[11px] uppercase tracking-[0.3em] text-cyan-300/80">{word}</div>
        </div>
        <div className="flex items-end justify-between font-mono text-[10px] tracking-[0.3em] text-neutral-600">
          <span>VOLUNTEER · REMOTE · ASYNC-FIRST</span>
          <span className="hidden sm:block">LOADING FONTS &amp; ROLES</span>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── Scroll progress + depth rail + nav ───────────────────────────────────── */
const RAIL = [
  { id: 'top', label: 'Intro' }, { id: 'why', label: 'Why join' }, { id: 'how', label: 'Process' },
  { id: 'roles', label: 'Open roles' }, { id: 'faq', label: 'FAQ' },
];

function ScrollChrome() {
  const { scrollYProgress } = useScroll();
  const bar = useSpring(scrollYProgress, { stiffness: 140, damping: 28, mass: 0.3 });
  const [pct, setPct] = useState(0);
  const [active, setActive] = useState('top');
  useEffect(() => scrollYProgress.on('change', (v) => setPct(Math.round(v * 100))), [scrollYProgress]);
  useEffect(() => {
    const els = RAIL.map((r) => document.getElementById(r.id)).filter(Boolean);
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) setActive(en.target.id); });
    }, { rootMargin: '-40% 0px -50% 0px' });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  const go = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return (
    <>
      <motion.div
        style={{ scaleX: bar }}
        className="fixed left-0 right-0 top-0 z-[90] h-[3px] origin-left bg-gradient-to-r from-indigo-400 via-cyan-300 to-emerald-300 shadow-[0_0_14px_rgba(99,102,241,0.8)]"
      />
      <div className="fixed right-5 top-1/2 z-[60] hidden -translate-y-1/2 flex-col items-end gap-3 xl:flex">
        <div className="mb-1 font-mono text-[11px] tabular-nums text-neutral-500">{String(pct).padStart(2, '0')}%</div>
        {RAIL.map((r) => (
          <button key={r.id} onClick={() => go(r.id)} className="group flex items-center gap-3" aria-label={`Jump to ${r.label}`}>
            <span className={cx('font-mono text-[10px] font-medium uppercase tracking-[0.22em] transition-all duration-300', active === r.id ? 'translate-x-0 text-white opacity-100' : 'translate-x-2 text-neutral-500 opacity-0 group-hover:translate-x-0 group-hover:opacity-100')}>{r.label}</span>
            <span className={cx('block rounded-full transition-all duration-300', active === r.id ? 'h-2.5 w-2.5 bg-cyan-300 shadow-[0_0_12px_rgba(103,232,249,0.9)]' : 'h-1.5 w-1.5 bg-white/25 group-hover:bg-white/60')} />
          </button>
        ))}
      </div>
    </>
  );
}

function Nav({ onApply, openRoles, go }) {
  const [solid, setSolid] = useState(false);
  useEffect(() => {
    const on = () => setSolid(window.scrollY > 24);
    on(); window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  return (
    <motion.header
      initial={{ opacity: 0, y: -24 }} animate={{ opacity: go ? 1 : 0, y: go ? 0 : -24 }} transition={{ duration: 0.9, delay: 0.5, ease: EASE }}
      className={cx('fixed inset-x-0 top-[3px] z-[70] transition-[background,border-color,backdrop-filter] duration-500', solid ? 'border-b border-white/[0.06] bg-[#05050f]/70 backdrop-blur-xl' : 'border-b border-transparent')}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
        <a href="/" className="group flex items-center gap-2.5 text-white">
          <ArrowLeft className="h-4 w-4 text-neutral-500 transition-transform group-hover:-translate-x-1" />
          <span className="font-display text-base font-extrabold tracking-tight">PlanIt</span>
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-400">Careers</span>
        </a>
        <div className="flex items-center gap-2">
          <a href="/about" className="hidden rounded-lg px-3 py-2 text-sm text-neutral-400 transition hover:text-white sm:block">About</a>
          <a href="/blog" className="hidden rounded-lg px-3 py-2 text-sm text-neutral-400 transition hover:text-white sm:block">Blog</a>
          <Magnetic strength={0.25}>
            <button onClick={onApply} className="group flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-neutral-900 transition hover:bg-neutral-200">
              {openRoles > 0 ? `${openRoles} open role${openRoles === 1 ? '' : 's'}` : 'Apply'}
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </button>
          </Magnetic>
        </div>
      </div>
    </motion.header>
  );
}

/* ─── Hero ─────────────────────────────────────────────────────────────────── */
const HERO_LINES = [
  [{ t: 'Help' }, { t: 'us' }, { t: 'build' }],
  [{ t: 'the' }, { t: 'future', serif: true }],
  [{ t: 'of' }, { t: 'events.' }],
];
const CHIPS = [
  { t: 'React', x: '5%', y: '23%', d: 30, c: '#818cf8', s: 5.2 },
  { t: 'Figma', x: '11%', y: '67%', d: 46, c: '#f472b6', s: 6.4 },
  { t: 'Node.js', x: '90%', y: '27%', d: 38, c: '#34d399', s: 5.8 },
  { t: 'SEO', x: '84%', y: '71%', d: 24, c: '#fbbf24', s: 6.9 },
  { t: 'Security', x: '2.5%', y: '45%', d: 20, c: '#22d3ee', s: 7.3 },
  { t: 'Video', x: '94%', y: '49%', d: 52, c: '#fb7185', s: 5.5 },
];

function FloatChip({ chip, mx, my, go }) {
  const px = useTransform(mx, [-0.5, 0.5], [chip.d, -chip.d]);
  const py = useTransform(my, [-0.5, 0.5], [chip.d, -chip.d]);
  return (
    <motion.div style={{ left: chip.x, top: chip.y, x: px, y: py }} className="pointer-events-none absolute hidden xl:block">
      <motion.div
        initial={{ opacity: 0, scale: 0.6 }} animate={go ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.6 }} transition={{ duration: 0.9, delay: 1.2 + chip.d / 100, ease: EASE }}
      >
        <motion.div animate={{ y: [0, -12, 0] }} transition={{ duration: chip.s, repeat: Infinity, ease: 'easeInOut' }}
          className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 font-mono text-[11px] text-neutral-300 shadow-[0_8px_30px_rgba(0,0,0,0.35)] backdrop-blur-md">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: chip.c, boxShadow: `0 0 10px ${chip.c}` }} />{chip.t}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

function Hero({ openRoles, teams, accepting, onBrowse, onGeneral, go }) {
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [0, 180]);
  const op = useTransform(scrollYProgress, [0, 0.75], [1, 0]);
  const blobA = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [0, -220]);
  const blobB = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [0, 140]);
  const ringRot = useTransform(scrollYProgress, [0, 1], [0, 140]);
  const mxRaw = useMotionValue(0); const myRaw = useMotionValue(0);
  const mx = useSpring(mxRaw, { stiffness: 50, damping: 18 }); const my = useSpring(myRaw, { stiffness: 50, damping: 18 });
  const gxRaw = useMotionValue(-800); const gyRaw = useMotionValue(-800);
  const gx = useSpring(gxRaw, { stiffness: 90, damping: 24, mass: 0.7 }); const gy = useSpring(gyRaw, { stiffness: 90, damping: 24, mass: 0.7 });
  const onMove = (e) => {
    if (reduce || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    mxRaw.set((e.clientX - r.left) / r.width - 0.5); myRaw.set((e.clientY - r.top) / r.height - 0.5);
    gxRaw.set(e.clientX - r.left - 260); gyRaw.set(e.clientY - r.top - 260);
  };
  const hide = { opacity: 0, y: 24 }; const show = { opacity: 1, y: 0 };
  const stats = [
    { n: openRoles, s: '', l: 'Open roles' },
    { n: teams, s: '', l: 'Teams' },
    { n: 100, s: '%', l: 'Remote' },
    { alt: 'Async-first', l: 'By default' },
  ];

  return (
    <section id="top" ref={ref} onMouseMove={onMove} className="relative flex min-h-[100svh] items-center overflow-hidden px-5 pb-24 pt-32">
      {/* depth layers */}
      <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.045) 1px,transparent 1px)', backgroundSize: '72px 72px', maskImage: 'radial-gradient(ellipse 62% 56% at 50% 46%, #000 25%, transparent 78%)', WebkitMaskImage: 'radial-gradient(ellipse 62% 56% at 50% 46%, #000 25%, transparent 78%)' }} />
      <motion.div style={{ y: blobA }} className="pointer-events-none absolute -left-40 top-10 h-[34rem] w-[34rem] rounded-full bg-indigo-600/25 blur-[120px]" />
      <motion.div style={{ y: blobB }} className="pointer-events-none absolute -right-32 top-1/3 h-[30rem] w-[30rem] rounded-full bg-cyan-500/15 blur-[120px]" />
      <motion.div aria-hidden="true" style={{ x: gx, y: gy }} className="pointer-events-none absolute left-0 top-0 hidden h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(129,140,248,0.22),rgba(34,211,238,0.08)_45%,transparent_70%)] md:block" />
      <motion.div style={{ rotate: ringRot }} className="pointer-events-none absolute left-1/2 top-1/2 hidden h-[900px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.05] md:block">
        <span className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300 shadow-[0_0_20px_rgba(103,232,249,1)]" />
        <span className="absolute bottom-[14%] right-[6%] h-1.5 w-1.5 rounded-full bg-indigo-300 shadow-[0_0_14px_rgba(165,180,252,1)]" />
      </motion.div>
      <motion.div style={{ rotate: useTransform(ringRot, (v) => -v * 1.6) }} className="pointer-events-none absolute left-1/2 top-1/2 hidden h-[620px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-white/[0.06] md:block">
        <span className="absolute right-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 translate-x-1/2 rounded-full bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,1)]" />
      </motion.div>
      {CHIPS.map((c) => <FloatChip key={c.t} chip={c} mx={mx} my={my} go={go} />)}
      <div aria-hidden="true" className="pointer-events-none absolute left-6 top-1/2 hidden -translate-y-1/2 rotate-180 font-mono text-[10px] tracking-[0.4em] text-neutral-600 [writing-mode:vertical-rl] lg:block">VOLUNTEER CREW · REMOTE · ASYNC-FIRST · {new Date().getFullYear()}</div>

      <motion.div style={{ y, opacity: op }} className="relative mx-auto w-full max-w-5xl text-center">
        <Kinetic
          lines={HERO_LINES} go={go} delay={0.15}
          className="font-display text-[clamp(2.1rem,7vw,5.4rem)] font-extrabold leading-[1.04] tracking-[-0.035em] text-white"
        />

        <motion.p
          initial={reduce ? false : hide} animate={go ? show : hide} transition={{ duration: 0.9, delay: 1.0, ease: EASE }}
          className="mx-auto mt-8 max-w-2xl text-base leading-relaxed text-neutral-400 sm:text-lg"
        >
          PlanIt is a live, growing event platform and we&apos;re building a volunteer crew around it. Real product, real users, real ownership.
          These roles are unpaid, flexible, and entirely remote.
        </motion.p>

        <motion.div
          initial={reduce ? false : hide} animate={go ? show : hide} transition={{ duration: 0.9, delay: 1.15, ease: EASE }}
          className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <Magnetic>
            <button onClick={onBrowse} data-cursor="Go" className="group relative flex items-center gap-2 overflow-hidden rounded-2xl bg-white px-7 py-3.5 text-sm font-extrabold text-neutral-900 shadow-[0_0_40px_rgba(255,255,255,0.18)] transition hover:shadow-[0_0_70px_rgba(255,255,255,0.32)]">
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-cyan-200/70 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
              <span className="relative">See open roles</span>
              <ArrowRight className="relative h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
          </Magnetic>
          {accepting && (
            <Magnetic>
              <button onClick={onGeneral} className="flex items-center gap-2 rounded-2xl border border-white/15 bg-white/[0.04] px-7 py-3.5 text-sm font-bold text-white backdrop-blur transition hover:border-white/30 hover:bg-white/[0.08]">
                Don&apos;t see yours? Pitch us <Sparkles className="h-4 w-4 text-cyan-300" />
              </button>
            </Magnetic>
          )}
        </motion.div>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 30 }} animate={go ? show : { opacity: 0, y: 30 }} transition={{ duration: 1, delay: 1.35, ease: EASE }}
          className="mx-auto mt-16 grid max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.06] shadow-[0_30px_80px_rgba(0,0,0,0.4)] sm:grid-cols-4"
        >
          {stats.map((x) => (
            <div key={x.l} className="group relative bg-[#07070f]/85 px-4 py-5 backdrop-blur transition-colors hover:bg-[#0b0b18]">
              <span className="absolute inset-x-0 top-0 h-px origin-left scale-x-0 bg-gradient-to-r from-cyan-300 to-transparent transition-transform duration-500 group-hover:scale-x-100" />
              <div className="font-display text-3xl font-extrabold text-white">
                {x.alt ? <span className="text-lg sm:text-xl">{x.alt}</span> : <Counter to={x.n} suffix={x.s} run={go} />}
              </div>
              <div className="mt-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-500">{x.l}</div>
            </div>
          ))}
        </motion.div>
      </motion.div>

      <motion.button
        onClick={onBrowse} aria-label="Scroll down"
        initial={{ opacity: 0 }} animate={{ opacity: go ? 1 : 0 }} transition={{ delay: 2.1 }}
        className="absolute bottom-7 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-3 text-neutral-500 transition hover:text-white sm:flex"
      >
        <span className="font-mono text-[10px] font-medium uppercase tracking-[0.4em]">Scroll</span>
        <span className="relative block h-10 w-px overflow-hidden bg-white/15"><span className="careers-drip absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-transparent to-cyan-300" /></span>
      </motion.button>
    </section>
  );
}

/* ─── Velocity-driven marquee ──────────────────────────────────────────────── */
function MarqueeRow({ words, dir = 1, outline = false, base = 3.4, factor }) {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const dirRef = useRef(dir);
  useAnimationFrame((_, delta) => {
    if (reduce) return;
    const v = factor.get();
    if (v < -0.02) dirRef.current = -dir; else if (v > 0.02) dirRef.current = dir;
    x.set(wrap(-50, 0, x.get() + dirRef.current * base * (delta / 1000) * (1 + Math.abs(v))));
  });
  const tx = useTransform(x, (v) => `${v}%`);
  const track = [...words, ...words, ...words, ...words];
  return (
    <motion.div style={{ x: tx }} className="flex w-max gap-10 whitespace-nowrap py-1">
      {track.map((w, i) => (
        <span key={i} className={cx('flex items-center gap-10', outline ? 'font-serif-i text-[clamp(2.4rem,5.4vw,4.4rem)] leading-none text-transparent' : 'font-display text-[clamp(1.6rem,4vw,3rem)] font-extrabold uppercase tracking-[-0.03em] text-white/[0.16]')} style={outline ? { WebkitTextStroke: '1px rgba(255,255,255,0.3)' } : undefined}>
          {w}<Sparkles className={cx('h-5 w-5', outline ? 'text-indigo-300/60' : 'text-cyan-300/50')} />
        </span>
      ))}
    </motion.div>
  );
}

function Marquee({ words }) {
  const { scrollY } = useScroll();
  const vel = useVelocity(scrollY);
  const sm = useSpring(vel, { damping: 50, stiffness: 400 });
  const factor = useTransform(sm, [0, 1000], [0, 4], { clamp: false });
  const skew = useTransform(sm, [-2000, 2000], [-9, 9]);
  return (
    <div className="relative overflow-hidden border-y border-white/[0.06] bg-white/[0.015] py-6" aria-hidden="true">
      <motion.div style={{ skewX: skew }} className="space-y-1">
        <MarqueeRow words={words} dir={1} factor={factor} />
        <MarqueeRow words={[...words].reverse()} dir={-1} outline base={2.6} factor={factor} />
      </motion.div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[#05050f] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-[#05050f] to-transparent" />
    </div>
  );
}

/* ─── Why join (bento) ─────────────────────────────────────────────────────── */
function Terminal() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-15%' });
  const reduce = useReducedMotion();
  const LINES = [['$', 'git checkout -b feat/guest-checkin'], ['$', 'npm run build'], ['✓', 'build passed'], ['$', 'git push origin main'], ['✓', 'deployed to production']];
  const [n, setN] = useState(reduce ? LINES.length : 0);
  useEffect(() => {
    if (!inView || reduce) return undefined;
    let i = 0;
    const id = setInterval(() => { i += 1; setN(i); if (i >= LINES.length) clearInterval(id); }, 620);
    return () => clearInterval(id);
  }, [inView, reduce]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div ref={ref} className="mt-6 overflow-hidden rounded-xl border border-white/10 bg-black/40 font-mono text-[12px]">
      <div className="flex items-center gap-1.5 border-b border-white/[0.06] px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-rose-400/70" /><span className="h-2 w-2 rounded-full bg-amber-300/70" /><span className="h-2 w-2 rounded-full bg-emerald-400/70" />
        <span className="ml-2 text-[10px] tracking-widest text-neutral-600">~/planit</span>
      </div>
      <div className="min-h-[132px] space-y-1 p-3.5">
        {LINES.slice(0, n).map(([k, t], i) => (
          <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="flex gap-2">
            <span className={k === '✓' ? 'text-emerald-300' : 'text-cyan-300'}>{k}</span>
            <span className={k === '✓' ? 'text-emerald-200/90' : 'text-neutral-300'}>{t}</span>
          </motion.div>
        ))}
        {n < LINES.length && <span className="careers-blink inline-block h-3.5 w-1.5 translate-y-0.5 bg-cyan-300/80" />}
      </div>
    </div>
  );
}

function WeekBars() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-15%' });
  const days = [['M', 40], ['T', 70], ['W', 25], ['T', 55], ['F', 35], ['S', 85], ['S', 15]];
  return (
    <div ref={ref} className="mt-5 flex h-16 items-end gap-1.5">
      {days.map(([d, h], i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
          <motion.div className="w-full rounded-md bg-gradient-to-t from-pink-400/20 to-pink-300/70" initial={{ height: 0 }} animate={inView ? { height: `${h}%` } : {}} transition={{ duration: 0.9, delay: 0.2 + i * 0.07, ease: EASE }} />
          <span className="font-mono text-[9px] text-neutral-600">{d}</span>
        </div>
      ))}
    </div>
  );
}

const WHY = [
  { icon: Rocket, title: 'Ship real software', body: 'PlanIt is live with real users. Work in a React + Node + MongoDB codebase that is actually deployed, not a tutorial project.', span: 'lg:col-span-2', color: 'rgba(99,102,241,0.22)', viz: 'terminal' },
  { icon: Layers, title: 'Own something', body: 'Take a feature, campaign or area end to end. No busywork, no coffee runs.', span: '', color: 'rgba(34,211,238,0.18)' },
  { icon: Award, title: 'Portfolio + references', body: 'Real shipped work to point at, plus LinkedIn recommendations and reference letters for people who deliver.', span: '', color: 'rgba(52,211,153,0.18)' },
  { icon: Clock, title: 'Your schedule', body: 'A few hours a week, async-first, no mandatory meetings. Life comes first.', span: 'lg:col-span-2', color: 'rgba(244,114,182,0.18)', viz: 'week' },
  { icon: Heart, title: 'Upside, if it happens', body: 'These roles are unpaid. If PlanIt starts making money, contributors may get a cut, agreed in writing first. No promises, just an honest seat at the table.', span: 'lg:col-span-2', color: 'rgba(251,191,36,0.18)' },
];

function Why() {
  return (
    <section id="why" className="relative px-5 py-28">
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 max-w-3xl">
          <Eyebrow n="01" className="mb-5">Why join</Eyebrow>
          <h2 className="font-display text-4xl font-extrabold leading-[1.08] tracking-[-0.04em] text-white sm:text-5xl">
            <Words inView text="Small team. Real product. Zero fluff." accent={[5]} />
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {WHY.map((w, i) => (
            <Reveal key={w.title} delay={i * 0.07} className={w.span}>
              <Spotlight color={w.color} className="h-full">
                <div className="flex h-full flex-col p-7">
                  <div className="mb-5 flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110">
                      <w.icon className="h-5 w-5 text-white" />
                    </div>
                    <span className="font-mono text-[11px] tracking-[0.2em] text-neutral-600">0{i + 1}</span>
                  </div>
                  <h3 className="font-display text-lg font-bold tracking-[-0.03em] text-white">{w.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-neutral-400">{w.body}</p>
                  {w.viz === 'terminal' && <Terminal />}
                  {w.viz === 'week' && <WeekBars />}
                </div>
              </Spotlight>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── How it works: line draws with scroll ─────────────────────────────────── */
const STEPS = [
  { t: 'Apply in ~5 minutes', d: 'Tell us who you are, link your work, and pick a role. No cover-letter essay required.' },
  { t: 'We read every application', d: 'A real person reads it. If it looks like a fit, we set up a short, casual chat.' },
  { t: 'Small trial project', d: 'A scoped, real task so we can both see how working together feels, with no marathon take-home.' },
  { t: 'Join the crew', d: 'Get access, get a clear area to own, and start shipping. Step away any time.' },
];

function How() {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 70%', 'end 55%'] });
  const line = useSpring(scrollYProgress, { stiffness: 120, damping: 26 });
  const head = useTransform(line, (v) => `${v * 100}%`);
  return (
    <section id="how" className="relative px-5 py-28">
      <div className="mx-auto max-w-4xl">
        <div className="mb-16 flex flex-col items-center text-center">
          <Eyebrow n="02" className="mb-5">The process</Eyebrow>
          <h2 className="font-display text-4xl font-extrabold leading-[1.08] tracking-[-0.04em] text-white sm:text-5xl">
            <Words inView text="From hello to shipping." accent={[2]} />
          </h2>
        </div>
        <div ref={ref} className="relative pl-12 sm:pl-0">
          <div className="absolute bottom-3 left-[19px] top-3 w-px bg-white/10 sm:left-1/2" />
          <motion.div style={{ scaleY: reduce ? 1 : line }} className="absolute bottom-3 left-[19px] top-3 w-px origin-top bg-gradient-to-b from-indigo-400 via-cyan-300 to-emerald-300 shadow-[0_0_12px_rgba(103,232,249,0.7)] sm:left-1/2" />
          <motion.span aria-hidden="true" style={{ top: head }} className="absolute left-[19px] z-10 hidden h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_24px_6px_rgba(103,232,249,0.8)] sm:left-1/2 sm:block" />
          <div className="space-y-16">
            {STEPS.map((s, i) => (
              <motion.div
                key={s.t}
                initial={reduce ? false : { opacity: 0, x: i % 2 ? 50 : -50 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-120px' }}
                transition={{ duration: 0.9, ease: EASE }}
                className={cx('relative sm:w-1/2', i % 2 ? 'sm:ml-auto sm:pl-14' : 'sm:pr-14 sm:text-right')}
              >
                <span aria-hidden="true" className={cx('pointer-events-none absolute -top-10 select-none font-serif-i text-[8.5rem] leading-none text-transparent', i % 2 ? 'right-0 sm:right-6' : 'right-0 sm:left-0 sm:right-auto')} style={{ WebkitTextStroke: '1px rgba(255,255,255,0.1)' }}>0{i + 1}</span>
                <span className={cx('absolute top-1 flex h-10 w-10 items-center justify-center rounded-full border border-cyan-300/40 bg-[#07070f] font-mono text-sm font-medium text-cyan-200 shadow-[0_0_24px_rgba(34,211,238,0.35)]', '-left-12', i % 2 ? 'sm:-left-5' : 'sm:left-auto sm:-right-5')}>
                  {i + 1}
                </span>
                <h3 className="relative font-display text-xl font-bold tracking-[-0.03em] text-white sm:text-2xl">{s.t}</h3>
                <p className="relative mt-2 text-sm leading-relaxed text-neutral-400 sm:text-base">{s.d}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Roles ────────────────────────────────────────────────────────────────── */
function daysLeft(deadline) {
  if (!deadline) return null;
  const d = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
  return d > 0 && d <= 21 ? d : null;
}

function RoleCard({ job, index, onOpen }) {
  const reduce = useReducedMotion();
  const rx = useMotionValue(0); const ry = useMotionValue(0);
  const sx = useSpring(rx, { stiffness: 220, damping: 20 }); const sy = useSpring(ry, { stiffness: 220, damping: 20 });
  const onMove = (e) => {
    if (reduce || window.matchMedia?.('(pointer: coarse)').matches) return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5; const py = (e.clientY - r.top) / r.height - 0.5;
    ry.set(px * 9); rx.set(-py * 9);
    e.currentTarget.style.setProperty('--mx', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--my', `${e.clientY - r.top}px`);
  };
  const reset = () => { rx.set(0); ry.set(0); };
  const left = daysLeft(job.deadline);
  const color = teamColor(job.team);
  const isNew = job.open && job.postedAt && Date.now() - new Date(job.postedAt).getTime() < 7 * 86400000;
  return (
    <motion.div
      layout
      initial={reduce ? false : { opacity: 0, y: 40, scale: 0.97 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: '-60px' }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ duration: 0.7, delay: (index % 3) * 0.09, ease: EASE }}
      style={{ rotateX: sx, rotateY: sy, transformPerspective: 1000 }}
      onMouseMove={onMove} onMouseLeave={reset}
    >
      <button
        onClick={() => onOpen(job.slug)} data-cursor={job.open ? 'Open' : 'View'}
        className={cx(
          'group relative flex h-full w-full flex-col overflow-hidden rounded-3xl border p-6 text-left transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/60',
          job.open ? 'border-white/10 bg-white/[0.035] hover:border-white/25' : 'border-white/[0.06] bg-white/[0.015] opacity-70 hover:opacity-100',
          job.featured && job.open && 'border-cyan-300/30 shadow-[0_0_50px_rgba(34,211,238,0.10)]',
        )}
      >
        <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100" style={{ background: `radial-gradient(360px circle at var(--mx,50%) var(--my,0%), ${color}2e, transparent 45%)` }} />
        <span aria-hidden="true" className="absolute inset-x-0 top-0 h-px origin-left scale-x-0 transition-transform duration-700 ease-out group-hover:scale-x-100" style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />
        <span aria-hidden="true" className="pointer-events-none absolute right-4 -top-2 select-none font-serif-i text-[5.5rem] leading-none text-transparent opacity-70 transition-opacity duration-500 group-hover:opacity-100" style={{ WebkitTextStroke: `1px ${color}55` }}>{String(index + 1).padStart(2, '0')}</span>
        <div className="relative mb-5 flex items-center gap-2.5">
          <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-neutral-300">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />{job.team}
          </span>
          {isNew && <span className="rounded-full bg-cyan-300 px-2 py-0.5 font-mono text-[9px] font-medium uppercase tracking-[0.18em] text-neutral-900">New</span>}
        </div>
        <h3 className="relative font-display text-xl font-bold leading-[1.15] tracking-[-0.035em] text-white">{job.title}</h3>
        {job.tagline && <p className="relative mt-2.5 line-clamp-2 text-sm leading-relaxed text-neutral-400">{job.tagline}</p>}
        <div className="relative mt-5 flex flex-wrap gap-x-4 gap-y-1.5 font-mono text-[11px] text-neutral-500">
          <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{job.location}</span>
          <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" />{job.hoursPerWeek}</span>
        </div>
        {job.skills?.length > 0 && (
          <div className="relative mt-4 flex flex-wrap gap-1.5">
            {job.skills.slice(0, 4).map((s) => <span key={s} className="rounded-md bg-white/[0.05] px-2 py-1 text-[11px] font-medium text-neutral-300">{s}</span>)}
            {job.skills.length > 4 && <span className="rounded-md px-1 py-1 text-[11px] text-neutral-600">+{job.skills.length - 4}</span>}
          </div>
        )}
        <div className="relative mt-auto flex items-center justify-between pt-6 text-sm font-bold text-white">
          <span className="flex items-center gap-3">
            {job.open ? (
              <span className="flex items-center gap-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-emerald-300">
                <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" /><span className="relative h-1.5 w-1.5 rounded-full bg-emerald-400" /></span>
                {left ? `${left}d left` : 'Open'}
              </span>
            ) : (
              <span className="flex items-center gap-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-neutral-500"><Lock className="h-3 w-3" />Closed</span>
            )}
            <span className="text-neutral-500">·</span>
            <span>{job.open ? 'View & apply' : 'View details'}</span>
          </span>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition-all duration-300 group-hover:bg-white group-hover:text-neutral-900">
            <ArrowUpRight className="h-4 w-4 transition-transform duration-300 group-hover:rotate-12" />
          </span>
        </div>
      </button>
    </motion.div>
  );
}

function GeneralCard({ onOpen, accepting }) {
  return (
    <Reveal>
      <button
        onClick={() => onOpen('general')} disabled={!accepting} data-cursor="Pitch"
        className="group relative h-full w-full overflow-hidden rounded-3xl p-px text-left disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="absolute inset-[-100%] careers-spin bg-[conic-gradient(from_0deg,transparent_0_60%,#6366f1_75%,#22d3ee_88%,transparent_100%)] opacity-70" />
        <span className="relative flex h-full min-h-[18rem] flex-col rounded-[calc(1.5rem-1px)] bg-[#07070f] p-6">
          <Sparkles className="mb-4 h-6 w-6 text-cyan-300 transition-transform duration-500 group-hover:rotate-12 group-hover:scale-125" />
          <h3 className="font-display text-xl font-bold leading-[1.15] tracking-[-0.035em] text-white">Don&apos;t see <span className="font-serif-i careers-shine text-[1.2em] leading-none">your</span> role?</h3>
          <p className="mt-3 text-sm leading-relaxed text-neutral-400">Tell us what you&apos;d build, write, design or grow. Some of our best ideas start as a pitch nobody posted a job for.</p>
          <span className="mt-auto flex items-center gap-2 pt-6 text-sm font-bold text-white">General application <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
        </span>
      </button>
    </Reveal>
  );
}

function Roles({ state, onOpen, reload }) {
  const { jobs, loading, error, accepting, pausedMessage } = state;
  const [q, setQ] = useState('');
  const [team, setTeam] = useState('All');
  const teams = useMemo(() => ['All', ...Array.from(new Set(jobs.map((j) => j.team).filter(Boolean)))], [jobs]);
  const counts = useMemo(() => jobs.reduce((m, j) => ({ ...m, [j.team]: (m[j.team] || 0) + 1 }), { All: jobs.length }), [jobs]);
  const shown = useMemo(() => jobs.filter((j) => {
    if (team !== 'All' && j.team !== team) return false;
    const t = q.trim().toLowerCase();
    return !t || [j.title, j.team, j.tagline, ...(j.skills || [])].join(' ').toLowerCase().includes(t);
  }), [jobs, q, team]);

  return (
    <section id="roles" className="relative px-5 py-28">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <Eyebrow n="03" className="mb-5">Open roles</Eyebrow>
            <h2 className="font-display text-4xl font-extrabold leading-[1.08] tracking-[-0.04em] text-white sm:text-5xl">
              <Words inView text="Find your seat." accent={[2]} />
            </h2>
          </div>
          <Reveal delay={0.1} className="relative w-full md:w-72">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search roles or skills" aria-label="Search roles" className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-10 pr-3 text-sm text-white outline-none transition placeholder:text-neutral-600 focus:border-indigo-400/70 focus:shadow-[0_0_0_4px_rgba(99,102,241,0.15)]" />
          </Reveal>
        </div>

        {!accepting && !loading && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8 flex items-start gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/[0.07] p-4 text-sm text-amber-100">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-300" />
            <div><b className="font-bold">Applications are paused.</b> {pausedMessage || 'Check back soon.'}</div>
          </motion.div>
        )}

        {teams.length > 2 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {teams.map((t) => (
              <button key={t} onClick={() => setTeam(t)} className={cx('relative flex items-center gap-2 rounded-full px-4 py-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.14em] transition-colors', team === t ? 'text-neutral-900' : 'text-neutral-400 hover:text-white')}>
                {team === t && <motion.span layoutId="careers-team-pill" className="absolute inset-0 rounded-full bg-white" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
                <span className="relative">{t}</span>
                <span className={cx('relative text-[10px]', team === t ? 'text-neutral-500' : 'text-neutral-600')}>{counts[t] || 0}</span>
              </button>
            ))}
          </div>
        )}
        {!loading && !error && jobs.length > 0 && (
          <div className="mb-7 font-mono text-[10px] uppercase tracking-[0.24em] text-neutral-600" aria-live="polite">Showing {shown.length} of {jobs.length}</div>
        )}

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="careers-shimmer relative h-72 overflow-hidden rounded-3xl border border-white/[0.06] bg-white/[0.03] p-6" style={{ animationDelay: `${i * 0.15}s` }}>
                <div className="h-5 w-24 rounded-full bg-white/[0.06]" />
                <div className="mt-6 h-6 w-3/4 rounded-lg bg-white/[0.07]" />
                <div className="mt-3 h-3 w-full rounded bg-white/[0.04]" /><div className="mt-2 h-3 w-2/3 rounded bg-white/[0.04]" />
                <div className="mt-8 flex gap-2"><div className="h-6 w-14 rounded-md bg-white/[0.05]" /><div className="h-6 w-16 rounded-md bg-white/[0.05]" /><div className="h-6 w-12 rounded-md bg-white/[0.05]" /></div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-10 text-center">
            <p className="text-neutral-300">We couldn&apos;t load the roles right now.</p>
            <button onClick={reload} className="mt-4 rounded-xl bg-white px-5 py-2 text-sm font-bold text-neutral-900">Try again</button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {shown.map((j, i) => <RoleCard key={j.slug} job={j} index={i} onOpen={onOpen} />)}
            </AnimatePresence>
            <GeneralCard onOpen={onOpen} accepting={accepting} />
          </div>
        )}
        {!loading && !error && jobs.length > 0 && shown.length === 0 && (
          <Reveal className="mt-6 text-center text-sm text-neutral-500">
            Nothing matches that search. <button onClick={() => { setQ(''); setTeam('All'); }} className="font-bold text-cyan-300 hover:underline">Clear filters</button>
          </Reveal>
        )}
        {!loading && !error && jobs.length === 0 && (
          <Reveal className="mt-6 text-center text-sm text-neutral-500">No roles are posted right now. A general application is the best way to get on our radar.</Reveal>
        )}
      </div>
    </section>
  );
}

/* ─── FAQ ──────────────────────────────────────────────────────────────────── */
const FAQ = [
  { q: 'Are these roles paid?', a: 'No. Every role here is an unpaid volunteer position. If PlanIt earns revenue in the future, contributors may be offered a share. That would be discussed and agreed in writing before anything is owed, and nothing is guaranteed.' },
  { q: 'How much time does it take?', a: 'Each role lists its expected hours, usually a few per week. Work is async, so you can fit it around school, a job, or life.' },
  { q: 'Do I need experience?', a: 'Not always. We care about what you can show: projects, writing, designs, or a clear plan. Beginners are welcome on roles that say so.' },
  { q: 'What will I get out of it?', a: 'Real shipped work for your portfolio, hands-on experience on a live product, and LinkedIn recommendations or reference letters for people who deliver.' },
  { q: 'How will I hear back?', a: 'We email everyone we move forward with. Check your spam folder, and use an email you actually read.' },
  { q: 'What do you do with my information?', a: 'We store what you submit, plus basic technical details like device type, language, timezone and where you found us, to run recruiting. See our Privacy Policy.' },
];

function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className="relative px-5 py-28">
      <div className="mx-auto max-w-3xl">
        <div className="mb-12 flex flex-col items-center text-center">
          <Eyebrow n="04" className="mb-5">Good to know</Eyebrow>
          <h2 className="font-display text-4xl font-extrabold leading-[1.08] tracking-[-0.04em] text-white sm:text-5xl">
            <Words inView text="Straight answers." accent={[1]} />
          </h2>
        </div>
        <div className="space-y-3">
          {FAQ.map((f, i) => (
            <Reveal key={f.q} delay={i * 0.05}>
              <div className={cx('relative overflow-hidden rounded-2xl border transition-colors duration-300', open === i ? 'border-white/20 bg-white/[0.05]' : 'border-white/[0.08] bg-white/[0.025] hover:border-white/15')}>
                <motion.span aria-hidden="true" className="absolute inset-y-0 left-0 w-0.5 origin-top bg-gradient-to-b from-indigo-400 to-cyan-300" initial={false} animate={{ scaleY: open === i ? 1 : 0 }} transition={{ duration: 0.4, ease: EASE }} />
                <button onClick={() => setOpen(open === i ? -1 : i)} className="flex w-full items-center justify-between gap-4 p-5 text-left" aria-expanded={open === i}>
                  <span className="flex items-baseline gap-4">
                    <span className="font-mono text-[11px] tracking-[0.2em] text-neutral-600">0{i + 1}</span>
                    <span className="font-display text-sm font-bold tracking-[-0.02em] text-white sm:text-base">{f.q}</span>
                  </span>
                  <ChevronDown className={cx('h-5 w-5 flex-shrink-0 text-neutral-400 transition-transform duration-300', open === i && 'rotate-180 text-cyan-300')} />
                </button>
                <AnimatePresence initial={false}>
                  {open === i && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.4, ease: EASE }}>
                      <p className="px-5 pb-5 pl-14 text-sm leading-relaxed text-neutral-400 sm:text-base">{f.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta({ onBrowse }) {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const bx = useTransform(scrollYProgress, [0, 1], ['6%', '-14%']);
  return (
    <section ref={ref} className="relative px-5 pb-28 pt-10">
      <Reveal className="mx-auto max-w-5xl">
        <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-indigo-500/20 via-white/[0.03] to-cyan-400/15 p-10 text-center sm:p-20">
          <div className="pointer-events-none absolute -top-24 left-1/2 h-56 w-[36rem] -translate-x-1/2 rounded-full bg-indigo-500/30 blur-[90px]" />
          <motion.div aria-hidden="true" style={{ x: bx }} className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 select-none whitespace-nowrap font-serif-i text-[clamp(7rem,24vw,19rem)] leading-none text-transparent">
            <span style={{ WebkitTextStroke: '1px rgba(255,255,255,0.13)' }}>Let&apos;s build · Let&apos;s build</span>
          </motion.div>
          <h2 className="relative font-display text-4xl font-extrabold leading-[1.08] tracking-[-0.04em] text-white sm:text-6xl">
            Your next project<br />starts <span className="font-serif-i careers-shine text-[1.2em] leading-none">here.</span>
          </h2>
          <p className="relative mx-auto mt-6 max-w-lg text-neutral-300">Pick a role, tell us what you&apos;d bring, and let&apos;s build something people actually use.</p>
          <div className="relative mt-9">
            <Magnetic>
              <button onClick={onBrowse} data-cursor="Go" className="group relative inline-flex items-center gap-2 overflow-hidden rounded-2xl bg-white px-8 py-4 text-sm font-extrabold text-neutral-900 transition hover:shadow-[0_0_60px_rgba(255,255,255,0.3)]">
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-cyan-200/70 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
                <span className="relative">Browse open roles</span><ArrowRight className="relative h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
            </Magnetic>
          </div>
        </div>
      </Reveal>
      <footer className="mx-auto mt-14 flex max-w-6xl flex-col items-center justify-between gap-4 border-t border-white/[0.06] pt-8 font-mono text-[11px] tracking-wide text-neutral-500 sm:flex-row">
        <span>© {new Date().getFullYear()} PlanIt. Volunteer roles are unpaid.</span>
        <span className="flex gap-5">
          <a href="/about" className="hover:text-white">About</a><a href="/blog" className="hover:text-white">Blog</a>
          <a href="/privacy" className="hover:text-white">Privacy</a><a href="/terms" className="hover:text-white">Terms</a>
        </span>
      </footer>
    </section>
  );
}

/* ─── Apply form ───────────────────────────────────────────────────────────── */
const inputCls = (err) => cx(
  'w-full rounded-xl border bg-white/[0.04] px-3.5 py-2.5 text-sm text-white outline-none transition placeholder:text-neutral-600',
  'focus:border-indigo-400/70 focus:bg-white/[0.07] focus:shadow-[0_0_0_4px_rgba(99,102,241,0.15)]',
  err ? 'border-rose-500/60' : 'border-white/10',
);

function Field({ label, hint, error, optional, children, as = 'label' }) {
  const Tag = as;
  return (
    <Tag className="block">
      <span className="mb-1.5 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-400">
        {label}{optional && <span className="font-medium normal-case tracking-normal text-neutral-600">optional</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-neutral-500">{hint}</span>}
      <AnimatePresence>
        {error && <motion.span initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-1 block text-xs text-rose-400">{error}</motion.span>}
      </AnimatePresence>
    </Tag>
  );
}

const STATUS_OPTS = [['student', 'Student'], ['working', 'Working'], ['between', 'Between jobs'], ['freelance', 'Freelance'], ['other', 'Other']];
const LEVEL_OPTS = [['beginner', 'Beginner'], ['intermediate', 'Intermediate'], ['advanced', 'Advanced'], ['expert', 'Expert']];
const START_OPTS = ['Right away', 'Within 2 weeks', 'Within a month', 'Flexible'];
const URL_RX = /^(https?:\/\/)?[^\s/$.?#]+\.[^\s]{2,}$/i;

function Segmented({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([k, l]) => (
        <button type="button" key={k} onClick={() => onChange(value === k ? '' : k)}
          className={cx('rounded-lg border px-3.5 py-2 text-xs font-bold transition', value === k ? 'border-white bg-white text-neutral-900' : 'border-white/10 bg-white/[0.03] text-neutral-300 hover:border-white/30')}>
          {l}
        </button>
      ))}
    </div>
  );
}

function SkillPicker({ value, onChange, suggestions }) {
  const [draft, setDraft] = useState('');
  const add = (s) => {
    const t = s.trim().slice(0, 40);
    if (t && !value.some((v) => v.toLowerCase() === t.toLowerCase()) && value.length < 15) onChange([...value, t]);
    setDraft('');
  };
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {value.map((s) => (
          <motion.span layout key={s} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-1.5 rounded-lg bg-indigo-400/15 px-2.5 py-1 text-xs font-semibold text-indigo-100">
            {s}<button type="button" onClick={() => onChange(value.filter((x) => x !== s))} aria-label={`Remove ${s}`}><X className="h-3 w-3 opacity-70 hover:opacity-100" /></button>
          </motion.span>
        ))}
      </div>
      <input
        value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Type a skill, press Enter" className={inputCls()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(draft); } else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1)); }}
      />
      {suggestions.filter((s) => !value.includes(s)).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {suggestions.filter((s) => !value.includes(s)).slice(0, 8).map((s) => (
            <button type="button" key={s} onClick={() => add(s)} className="rounded-md border border-dashed border-white/15 px-2 py-1 text-[11px] text-neutral-400 transition hover:border-white/40 hover:text-white">+ {s}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function SourcePicker({ value, onChange, detected }) {
  return (
    <div>
      {detected && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-cyan-300/20 bg-cyan-300/[0.06] px-3 py-2 text-xs text-cyan-100">
          <Sparkles className="h-3.5 w-3.5 flex-shrink-0 text-cyan-300" />
          Looks like you came from <b className="font-bold">{SOURCE_OPTIONS.find((s) => s.key === detected)?.label || detected}</b>. Change it below if that&apos;s wrong.
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {SOURCE_OPTIONS.map((s, i) => {
          const on = value === s.key;
          return (
            <motion.button
              type="button" key={s.key} onClick={() => onChange(s.key)}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.015 }}
              whileTap={{ scale: 0.96 }}
              className={cx('relative flex items-center gap-2 overflow-hidden rounded-xl border px-3 py-2.5 text-left text-xs font-bold transition', on ? 'border-transparent text-white' : 'border-white/10 bg-white/[0.03] text-neutral-300 hover:border-white/30')}
              style={on ? { background: `linear-gradient(135deg, ${s.color}55, ${s.color}22)`, boxShadow: `0 0 0 1px ${s.color}99, 0 0 22px ${s.color}33` } : undefined}
            >
              <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: s.color, boxShadow: on ? `0 0 8px ${s.color}` : 'none' }} />
              <span className="truncate">{s.label}</span>
              {on && <Check className="ml-auto h-3.5 w-3.5 flex-shrink-0" />}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

const EMPTY = {
  fullName: '', email: '', phone: '', location: '', ageConfirmed: false,
  linkedin: '', github: '', portfolio: '', resumeUrl: '',
  currentStatus: '', organization: '', experienceLevel: '', skills: [],
  whyYou: '', proudestWork: '', hoursPerWeek: 4, startDate: 'Flexible', answers: {},
  source: '', sourceDetail: '', ackVolunteer: false, ackDataUse: false, company: '',
};

function Confetti() {
  const bits = useMemo(() => Array.from({ length: 34 }, (_, i) => ({
    id: i, x: (Math.random() - 0.5) * 520, y: -(120 + Math.random() * 300), r: Math.random() * 540 - 270,
    c: ['#6366f1', '#22d3ee', '#34d399', '#f472b6', '#fbbf24', '#ffffff'][i % 6], s: 5 + Math.random() * 7,
  })), []);
  return (
    <div className="pointer-events-none absolute left-1/2 top-24 h-0 w-0">
      {bits.map((b) => (
        <motion.span key={b.id} className="absolute rounded-[2px]" style={{ width: b.s, height: b.s * 0.5, background: b.c }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
          animate={{ x: b.x, y: [0, b.y, b.y + 380], opacity: [1, 1, 0], rotate: b.r }}
          transition={{ duration: 1.9, ease: 'easeOut', times: [0, 0.4, 1] }} />
      ))}
    </div>
  );
}

function ApplyForm({ job, attribution, engagement, onDone, onBack }) {
  const draftKey = `planit_careers_draft_${job.slug}`;
  const [step, setStep] = useState(1);
  const [dir, setDir] = useState(1);
  const [f, setF] = useState(() => {
    let draft = {};
    try { draft = JSON.parse(localStorage.getItem(draftKey) || '{}'); } catch { /* ignore */ }
    return { ...EMPTY, ...draft, ackVolunteer: false, ackDataUse: false, ageConfirmed: false, company: '', source: draft.source || attribution.detected || '' };
  });
  const [err, setErr] = useState({});
  const [serverErr, setServerErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [ts, setTs] = useState('');
  const [tsKey, setTsKey] = useState(0);
  const set = (k, v) => { setF((p) => ({ ...p, [k]: v })); if (err[k]) setErr((p) => ({ ...p, [k]: undefined })); };

  useEffect(() => {
    engagement.current.formStart = engagement.current.formStart || Date.now();
    ping('apply_start', { jobSlug: job.slug, source: attribution.detected, scrollDepth: engagement.current.maxScroll, seconds: engagement.current.seconds });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Autosave so nobody loses a half-written application.
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const { ackVolunteer, ackDataUse, ageConfirmed, company, ...keep } = f; // eslint-disable-line no-unused-vars
        localStorage.setItem(draftKey, JSON.stringify(keep));
      } catch { /* ignore */ }
    }, 500);
    return () => clearTimeout(t);
  }, [f, draftKey]);

  // Tell the funnel if they leave mid-form.
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden' && !busy) ping('apply_abandon', { jobSlug: job.slug, source: attribution.detected, seconds: engagement.current.seconds }); };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [busy, job.slug, attribution.detected, engagement]);

  const validate = (s) => {
    const e = {};
    if (s === 1) {
      if (f.fullName.trim().length < 2) e.fullName = 'Please enter your full name';
      if (!/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = 'Enter a valid email';
      if (!f.ageConfirmed) e.ageConfirmed = 'You must be 13 or older to volunteer';
    }
    if (s === 2) {
      ['linkedin', 'github', 'portfolio', 'resumeUrl'].forEach((k) => { if (f[k] && !URL_RX.test(f[k].trim())) e[k] = 'Enter a valid link'; });
    }
    if (s === 3) {
      if (f.whyYou.trim().length < 30) e.whyYou = `A little more, please (${f.whyYou.trim().length}/30)`;
      if (!f.source) e.source = 'Pick where you found us';
      (job.questions || []).forEach((q) => { if (q.required && !(f.answers[q.label] || '').trim()) e[`q:${q.label}`] = 'Required'; });
      if (!f.ackVolunteer) e.ackVolunteer = 'Please confirm';
      if (!f.ackDataUse) e.ackDataUse = 'Please agree';
    }
    setErr(e);
    return Object.keys(e).length === 0;
  };

  const go = (n) => { setDir(n > step ? 1 : -1); setStep(n); if (n > step) ping(n === 2 ? 'step_2' : 'step_3', { jobSlug: job.slug, source: attribution.detected, seconds: engagement.current.seconds }); };
  const next = () => { if (validate(step)) go(step + 1); };

  const submit = async () => {
    if (!validate(3)) return;
    setBusy(true); setServerErr('');
    const e = engagement.current;
    const { visitorId, sessionId } = getIdentity();
    const mq = (q) => window.matchMedia?.(q).matches;
    try {
      const r = await api.post('/careers/apply', {
        ...f, hoursPerWeek: Number(f.hoursPerWeek) || null, jobSlug: job.slug, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
        answers: (job.questions || []).map((q) => ({ label: q.label, answer: f.answers[q.label] || '' })),
        detectedSource: attribution.detected, firstTouch: attribution.first, lastTouch: attribution.last,
        device: {
          language: navigator.language, platform: navigator.platform, screenW: window.screen?.width, screenH: window.screen?.height,
          dpr: window.devicePixelRatio, viewportW: window.innerWidth, viewportH: window.innerHeight,
          colorScheme: mq('(prefers-color-scheme: dark)') ? 'dark' : 'light', reducedMotion: !!mq('(prefers-reduced-motion: reduce)'),
        },
        engagement: {
          scrollDepthMax: e.maxScroll, secondsOnPage: e.seconds, secondsOnForm: e.formStart ? Math.round((Date.now() - e.formStart) / 1000) : 0,
          rolesViewed: Array.from(e.roles), pageViews: e.pageViews, returning: attribution.returning,
        },
        turnstileToken: ts, visitorId, sessionId,
      });
      try { localStorage.removeItem(draftKey); } catch { /* ignore */ }
      onDone(r.data?.ref || '');
    } catch (ex) {
      const d = ex?.response?.data;
      setServerErr(d?.error || 'Something went wrong. Please try again.');
      setTs(''); setTsKey((k) => k + 1);
    } finally { setBusy(false); }
  };

  const bar = (
    <div className="mb-7">
      <div className="mb-3 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-500">
        <span>Step {step} of 3</span>
        <span className="text-neutral-300">{['About you', 'Your work', 'Your fit'][step - 1]}</span>
      </div>
      <div className="flex gap-1.5">
        {[1, 2, 3].map((n) => (
          <div key={n} className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
            <motion.div className="h-full bg-gradient-to-r from-indigo-400 to-cyan-300" initial={false} animate={{ width: step >= n ? '100%' : '0%' }} transition={{ duration: 0.5, ease: EASE }} />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div>
      <button onClick={onBack} className="mb-5 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-neutral-500 transition hover:text-white"><ArrowLeft className="h-3.5 w-3.5" />Back to role</button>
      {bar}
      <AnimatePresence mode="wait" custom={dir}>
        <motion.div key={step} custom={dir}
          initial={{ opacity: 0, x: dir * 36 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir * -36 }} transition={{ duration: 0.3, ease: EASE }}
          className="space-y-5">
          {step === 1 && (<>
            <Field label="Full name" error={err.fullName}><input className={inputCls(err.fullName)} value={f.fullName} onChange={(e) => set('fullName', e.target.value)} autoComplete="name" placeholder="Ada Lovelace" /></Field>
            <Field label="Email" error={err.email} hint="We'll only use this to reach you about PlanIt."><input type="email" className={inputCls(err.email)} value={f.email} onChange={(e) => set('email', e.target.value)} autoComplete="email" placeholder="you@example.com" /></Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Location" optional><input className={inputCls()} value={f.location} onChange={(e) => set('location', e.target.value)} placeholder="City, Country" autoComplete="address-level2" /></Field>
              <Field label="Phone" optional><input type="tel" className={inputCls()} value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+1 555 000 0000" autoComplete="tel" /></Field>
            </div>
            <label className={cx('flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 text-sm transition', f.ageConfirmed ? 'border-emerald-400/40 bg-emerald-400/[0.06]' : err.ageConfirmed ? 'border-rose-500/60' : 'border-white/10 bg-white/[0.03]')}>
              <input type="checkbox" checked={f.ageConfirmed} onChange={(e) => set('ageConfirmed', e.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-400" />
              <span className="text-neutral-300">I&apos;m at least 13 years old.{err.ageConfirmed && <span className="ml-2 text-xs text-rose-400">{err.ageConfirmed}</span>}</span>
            </label>
          </>)}

          {step === 2 && (<>
            <p className="text-sm text-neutral-400">Show us what you&apos;ve done. At least one link helps a lot, but none are required.</p>
            <Field label="LinkedIn" optional error={err.linkedin}><div className="relative"><Linkedin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" /><input className={cx(inputCls(err.linkedin), 'pl-10')} value={f.linkedin} onChange={(e) => set('linkedin', e.target.value)} placeholder="linkedin.com/in/you" /></div></Field>
            <Field label="GitHub" optional error={err.github}><div className="relative"><Github className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" /><input className={cx(inputCls(err.github), 'pl-10')} value={f.github} onChange={(e) => set('github', e.target.value)} placeholder="github.com/you" /></div></Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Portfolio / website" optional error={err.portfolio}><input className={inputCls(err.portfolio)} value={f.portfolio} onChange={(e) => set('portfolio', e.target.value)} placeholder="yoursite.com" /></Field>
              <Field label="Resume link" optional error={err.resumeUrl} hint="Drive, Dropbox, etc."><input className={inputCls(err.resumeUrl)} value={f.resumeUrl} onChange={(e) => set('resumeUrl', e.target.value)} placeholder="Link to your resume" /></Field>
            </div>
            <Field label="Right now I'm" as="div" optional><Segmented options={STATUS_OPTS} value={f.currentStatus} onChange={(v) => set('currentStatus', v)} /></Field>
            {f.currentStatus && <Field label={f.currentStatus === 'student' ? 'School' : 'Company / organization'} optional><input className={inputCls()} value={f.organization} onChange={(e) => set('organization', e.target.value)} /></Field>}
            <Field label="Experience with this kind of work" as="div" optional><Segmented options={LEVEL_OPTS} value={f.experienceLevel} onChange={(v) => set('experienceLevel', v)} /></Field>
            <Field label="Skills" as="div" optional><SkillPicker value={f.skills} onChange={(v) => set('skills', v)} suggestions={job.skills || []} /></Field>
          </>)}

          {step === 3 && (<>
            <Field label="Why do you want to join?" error={err.whyYou} hint={`${f.whyYou.trim().length}/3000`}>
              <textarea rows={5} maxLength={3000} className={inputCls(err.whyYou)} value={f.whyYou} onChange={(e) => set('whyYou', e.target.value)} placeholder="What draws you to PlanIt, and what would you bring?" />
            </Field>
            <Field label="Something you're proud of" optional><textarea rows={3} maxLength={2000} className={inputCls()} value={f.proudestWork} onChange={(e) => set('proudestWork', e.target.value)} placeholder="A project, post, design, anything" /></Field>
            {(job.questions || []).map((q) => (
              <Field key={q.label} label={q.label} optional={!q.required} error={err[`q:${q.label}`]}>
                <textarea rows={3} maxLength={1500} className={inputCls(err[`q:${q.label}`])} value={f.answers[q.label] || ''} onChange={(e) => set('answers', { ...f.answers, [q.label]: e.target.value })} />
              </Field>
            ))}
            <Field label={`Hours per week you can give: ${f.hoursPerWeek}`} as="div">
              <input type="range" min={1} max={20} value={f.hoursPerWeek} onChange={(e) => set('hoursPerWeek', e.target.value)} className="w-full accent-cyan-300" />
              <div className="mt-1 flex justify-between text-[10px] text-neutral-600"><span>1</span><span>10</span><span>20+</span></div>
            </Field>
            <Field label="When could you start?" as="div"><Segmented options={START_OPTS.map((s) => [s, s])} value={f.startDate} onChange={(v) => set('startDate', v || 'Flexible')} /></Field>

            <Field label="Where did you find us?" as="div" error={err.source}>
              <SourcePicker value={f.source} onChange={(v) => set('source', v)} detected={attribution.detected && attribution.detected !== 'planit' ? attribution.detected : ''} />
            </Field>
            {(f.source === 'friend' || f.source === 'school' || f.source === 'other') && (
              <Field label={f.source === 'friend' ? 'Who told you about us?' : f.source === 'school' ? 'Which school or club?' : 'Tell us where'} optional>
                <input className={inputCls()} value={f.sourceDetail} onChange={(e) => set('sourceDetail', e.target.value)} maxLength={200} />
              </Field>
            )}

            {/* Honeypot: real people never see or fill this. */}
            <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
              <label>Company<input tabIndex={-1} autoComplete="off" value={f.company} onChange={(e) => set('company', e.target.value)} /></label>
            </div>

            <div className="space-y-2.5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <label className="flex cursor-pointer items-start gap-3 text-sm text-neutral-300">
                <input type="checkbox" checked={f.ackVolunteer} onChange={(e) => set('ackVolunteer', e.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-400" />
                <span>I understand this is an <b className="text-white">unpaid volunteer role</b>. Any future revenue share isn&apos;t guaranteed and would be agreed in writing.{err.ackVolunteer && <span className="ml-2 text-xs text-rose-400">{err.ackVolunteer}</span>}</span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 text-sm text-neutral-300">
                <input type="checkbox" checked={f.ackDataUse} onChange={(e) => set('ackDataUse', e.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-400" />
                <span>I agree PlanIt may store my application and basic technical info (device, language, timezone, referral source, page activity) for recruiting. <a href="/privacy" target="_blank" rel="noreferrer" className="text-cyan-300 underline-offset-2 hover:underline">Privacy Policy</a>{err.ackDataUse && <span className="ml-2 text-xs text-rose-400">{err.ackDataUse}</span>}</span>
              </label>
            </div>
            <TurnstileWidget onToken={setTs} resetKey={tsKey} theme="dark" />
          </>)}
        </motion.div>
      </AnimatePresence>

      {serverErr && <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} className="mt-5 flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200"><AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />{serverErr}</motion.div>}

      <div className="mt-7 flex items-center justify-between gap-3">
        {step > 1 ? <button onClick={() => go(step - 1)} className="rounded-xl border border-white/10 px-5 py-3 text-sm font-bold text-neutral-300 transition hover:border-white/30 hover:text-white">Back</button> : <span />}
        {step < 3 ? (
          <button onClick={next} className="group flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-extrabold text-neutral-900 transition hover:bg-neutral-200">Continue <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></button>
        ) : (
          <button onClick={submit} disabled={busy} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-400 to-cyan-300 px-7 py-3 text-sm font-extrabold text-neutral-900 shadow-[0_0_30px_rgba(99,102,241,0.45)] transition hover:brightness-110 disabled:opacity-60">
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" />Sending…</> : <>Submit application <Zap className="h-4 w-4" /></>}
          </button>
        )}
      </div>
    </div>
  );
}

function Done({ job, refCode, onClose }) {
  const share = () => {
    const url = `${window.location.origin}/careers?src=friend`;
    if (navigator.share) navigator.share({ title: 'Volunteer with PlanIt', url }).catch(() => {});
    else navigator.clipboard?.writeText(url);
  };
  return (
    <div className="relative py-6 text-center">
      <Confetti />
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 16 }} className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-400/15 shadow-[0_0_60px_rgba(52,211,153,0.4)] ring-1 ring-emerald-300/40">
        <CheckCircle2 className="h-10 w-10 text-emerald-300" />
      </motion.div>
      <h3 className="font-display text-3xl font-extrabold text-white">You&apos;re in the pile.</h3>
      <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-neutral-400">Thanks for applying for <b className="text-white">{job.title}</b>. We read every application and will email you if it&apos;s a fit.</p>
      {refCode && <div className="mx-auto mt-5 inline-block rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 font-mono text-xs tracking-widest text-neutral-300">REF {refCode}</div>}
      <div className="mx-auto mt-8 max-w-sm space-y-2.5 text-left text-sm text-neutral-400">
        {['We review your application', 'If it fits, we email you for a quick chat', 'Then a small trial project, then you join'].map((t, i) => (
          <motion.div key={t} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.12 }} className="flex items-center gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-bold text-white">{i + 1}</span>{t}
          </motion.div>
        ))}
      </div>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <button onClick={share} className="flex items-center justify-center gap-2 rounded-xl border border-white/15 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/[0.06]"><Share2 className="h-4 w-4" />Tell a friend</button>
        <button onClick={onClose} className="rounded-xl bg-white px-5 py-3 text-sm font-extrabold text-neutral-900 transition hover:bg-neutral-200">Back to roles</button>
      </div>
    </div>
  );
}

/* ─── Role drawer ──────────────────────────────────────────────────────────── */
function Section({ title, items, icon: Icon = Check }) {
  if (!items?.length) return null;
  return (
    <div className="mt-8">
      <h4 className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-neutral-500">{title}</h4>
      <ul className="space-y-2.5">
        {items.map((t, i) => (
          <motion.li key={i} initial={{ opacity: 0, x: -8 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: Math.min(i, 6) * 0.04 }} className="flex gap-3 text-sm leading-relaxed text-neutral-300">
            <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-cyan-300" />{t}
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

function Drawer({ job, accepting, pausedMessage, attribution, engagement, onClose }) {
  const [mode, setMode] = useState('detail');
  const [refCode, setRefCode] = useState('');
  const [copied, setCopied] = useState(false);
  const scroller = useRef(null);
  const { scrollYProgress } = useScroll({ container: scroller });
  const canApply = accepting && job.open;

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [onClose]);

  useEffect(() => { scroller.current?.scrollTo({ top: 0, behavior: 'smooth' }); }, [mode]);

  const copyLink = () => {
    const url = `${window.location.origin}/careers/${job.slug}?src=friend`;
    navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); ping('link_copy', { jobSlug: job.slug }); }).catch(() => {});
  };

  return (
    <motion.div className="fixed inset-0 z-[100]" initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: 1 }}>
      <motion.div className="absolute inset-0 bg-black/70 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.aside
        role="dialog" aria-modal="true" aria-label={job.title}
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 280, damping: 32 }}
        className="absolute right-0 top-0 flex h-full w-full max-w-[640px] flex-col border-l border-white/10 bg-[#07070f] shadow-[-30px_0_80px_rgba(0,0,0,0.6)]"
      >
        <motion.div style={{ scaleX: scrollYProgress }} className="absolute left-0 right-0 top-0 z-10 h-[2px] origin-left bg-gradient-to-r from-indigo-400 to-cyan-300" />
        <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-500">{mode === 'form' ? 'Application' : mode === 'done' ? 'Submitted' : job.team}</span>
          <div className="flex items-center gap-1.5">
            <button onClick={copyLink} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-neutral-400 transition hover:bg-white/[0.06] hover:text-white">
              {copied ? <><Check className="h-3.5 w-3.5 text-emerald-300" />Copied</> : <><Link2 className="h-3.5 w-3.5" />Share</>}
            </button>
            <button onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-neutral-400 transition hover:bg-white/[0.06] hover:text-white"><X className="h-5 w-5" /></button>
          </div>
        </div>

        <div ref={scroller} className="flex-1 overflow-y-auto overscroll-contain px-6 pb-10 pt-7">
          <AnimatePresence mode="wait">
            {mode === 'detail' && (
              <motion.div key="detail" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  {job.open
                    ? <span className="flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Accepting applications</span>
                    : <span className="flex items-center gap-1.5 rounded-full bg-white/[0.06] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-neutral-400"><Lock className="h-3 w-3" />Closed{job.closedReason ? ` · ${job.closedReason}` : ''}</span>}
                  {job.openings > 1 && job.open && <span className="rounded-full bg-white/[0.06] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-neutral-300">{job.openings} spots</span>}
                </div>
                <h2 className="font-display text-4xl font-extrabold leading-tight tracking-tight text-white">{job.title}</h2>
                {job.tagline && <p className="mt-3 text-base leading-relaxed text-neutral-400">{job.tagline}</p>}
                <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
                  {[[MapPin, 'Where', job.location], [Clock, 'Time', job.hoursPerWeek], [Calendar, 'Length', job.duration], [Briefcase, 'Type', 'Volunteer']].map(([I, l, v]) => (
                    <div key={l} className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3.5">
                      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-neutral-500"><I className="h-3 w-3" />{l}</div>
                      <div className="font-semibold text-white">{v}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex gap-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.05] p-4 text-sm leading-relaxed text-amber-100/90">
                  <Heart className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-300" />{job.compensationNote}
                </div>
                {job.description && <p className="mt-7 whitespace-pre-line text-[15px] leading-relaxed text-neutral-300">{job.description}</p>}
                <Section title="What you'll do" items={job.responsibilities} />
                <Section title="What we're looking for" items={job.requirements} />
                <Section title="Bonus points" items={job.niceToHave} icon={Star} />
                <Section title="What you get" items={job.perks} icon={Sparkles} />
                {job.skills?.length > 0 && (
                  <div className="mt-8 flex flex-wrap gap-2">{job.skills.map((s) => <span key={s} className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-neutral-300">{s}</span>)}</div>
                )}
              </motion.div>
            )}
            {mode === 'form' && (
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <h3 className="mb-1 font-display text-2xl font-extrabold text-white">Apply: {job.title}</h3>
                <p className="mb-6 text-sm text-neutral-500">Your progress is saved on this device as you go.</p>
                <ApplyForm job={job} attribution={attribution} engagement={engagement} onBack={() => setMode('detail')} onDone={(code) => { setRefCode(code); setMode('done'); }} />
              </motion.div>
            )}
            {mode === 'done' && (
              <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><Done job={job} refCode={refCode} onClose={onClose} /></motion.div>
            )}
          </AnimatePresence>
        </div>

        {mode === 'detail' && (
          <div className="border-t border-white/[0.06] bg-[#07070f]/95 px-6 py-4 backdrop-blur">
            {canApply ? (
              <button onClick={() => setMode('form')} className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-4 text-sm font-extrabold text-neutral-900 transition hover:bg-neutral-200">
                Apply for this role <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
            ) : (
              <div className="text-center text-sm text-neutral-400">
                {!accepting ? (pausedMessage || 'Applications are paused right now.') : 'This role is closed.'}
                {!job.open && accepting && <button onClick={() => { onClose('general'); }} className="ml-2 font-bold text-cyan-300 hover:underline">Send a general application</button>}
              </div>
            )}
          </div>
        )}
      </motion.aside>
    </motion.div>
  );
}

/* ─── Page ─────────────────────────────────────────────────────────────────── */
const GENERAL_JOB = {
  slug: 'general', title: 'General application', team: 'Talent pool', open: true, openings: 1,
  tagline: "Don't see a role that fits? Tell us what you'd build, write, design or grow.",
  location: 'Remote (anywhere)', hoursPerWeek: 'You decide', duration: 'Ongoing, flexible',
  description: "No matching listing? No problem. Tell us about yourself and the kind of work you'd love to do for PlanIt. When a role opens up that matches, we'll reach out.",
  responsibilities: [], requirements: [], niceToHave: [], perks: ['Real, shipped work for your portfolio', 'LinkedIn recommendations and references for people who deliver'],
  skills: [], questions: [], closedReason: '',
  compensationNote: 'Unpaid volunteer role. If PlanIt earns revenue in the future, contributors may be offered a share, to be agreed in writing. Nothing is guaranteed.',
};

export default function Careers() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { search } = useLocation();
  const engagement = useEngagement();
  const attribution = useMemo(() => readAttribution(), []);
  const [state, setState] = useState({ jobs: [], loading: true, error: false, accepting: true, pausedMessage: '' });
  const [extra, setExtra] = useState(null);   // role opened by deep-link that isn't in the list

  // Intro: plays once per session, never on a deep-linked role or with reduced motion.
  const [intro, setIntro] = useState(() => {
    try { return !slug && !window.matchMedia('(prefers-reduced-motion: reduce)').matches && !sessionStorage.getItem('planit_careers_intro'); } catch { return false; }
  });
  const [revealed, setRevealed] = useState(!intro);
  const fontsReady = useCareersFonts();
  const onReveal = useCallback(() => { setRevealed(true); try { sessionStorage.setItem('planit_careers_intro', '1'); } catch { /* ignore */ } }, []);
  const onIntroDone = useCallback(() => setIntro(false), []);
  useEffect(() => {
    if (!intro) return undefined;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    window.scrollTo(0, 0);
    return () => { document.documentElement.style.overflow = prev; };
  }, [intro]);

  const load = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: false }));
    api.get('/careers/jobs')
      .then((r) => setState({ jobs: r.data.jobs || [], accepting: r.data.accepting !== false, pausedMessage: r.data.pausedMessage || '', loading: false, error: false }))
      .catch(() => setState((s) => ({ ...s, loading: false, error: true })));
  }, []);

  useEffect(() => {
    load();
    document.title = 'Careers · Volunteer with PlanIt';
    const meta = document.querySelector('meta[name="description"]');
    const prev = meta?.getAttribute('content');
    meta?.setAttribute('content', 'Volunteer with PlanIt. Remote, flexible, unpaid roles in engineering, design, growth and community. Real product, real ownership.');
    ping('page_view', { source: attribution.detected, scrollDepth: 0 });
    return () => { if (meta && prev != null) meta.setAttribute('content', prev); };
  }, [load, attribution.detected]);

  // Resolve the role in the URL
  const selected = useMemo(() => {
    if (!slug) return null;
    if (slug === 'general') return GENERAL_JOB;
    return state.jobs.find((j) => j.slug === slug) || (extra?.slug === slug ? extra : null);
  }, [slug, state.jobs, extra]);

  useEffect(() => {
    if (!slug || slug === 'general' || state.loading || state.jobs.some((j) => j.slug === slug) || extra?.slug === slug) return;
    api.get(`/careers/jobs/${encodeURIComponent(slug)}`)
      .then((r) => setExtra(r.data.job))
      .catch(() => navigate(`/careers${search}`, { replace: true }));
  }, [slug, state.loading, state.jobs, extra, navigate, search]);

  useEffect(() => {
    if (!selected) return;
    engagement.current.roles.add(selected.slug);
    ping('role_open', { jobSlug: selected.slug, source: attribution.detected, scrollDepth: engagement.current.maxScroll, seconds: engagement.current.seconds });
  }, [selected?.slug]); // eslint-disable-line react-hooks/exhaustive-deps

  // Google-for-Jobs structured data for the open role
  useEffect(() => {
    if (!selected || !selected.open || selected.slug === 'general') return undefined;
    const el = document.createElement('script');
    el.type = 'application/ld+json';
    el.text = JSON.stringify({
      '@context': 'https://schema.org/', '@type': 'JobPosting', title: selected.title,
      description: selected.description || selected.tagline || selected.title, datePosted: selected.postedAt,
      ...(selected.deadline ? { validThrough: selected.deadline } : {}), employmentType: 'VOLUNTEER',
      hiringOrganization: { '@type': 'Organization', name: 'PlanIt', sameAs: window.location.origin },
      ...(selected.workMode === 'remote' ? { jobLocationType: 'TELECOMMUTE' } : {}),
    });
    document.head.appendChild(el);
    return () => el.remove();
  }, [selected]);

  const openRole = useCallback((s) => navigate(`/careers/${s}${search}`), [navigate, search]);
  const closeRole = useCallback((next) => navigate(typeof next === 'string' ? `/careers/${next}${search}` : `/careers${search}`), [navigate, search]);
  const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const openRoles = state.jobs.filter((j) => j.open).length;
  const teams = new Set(state.jobs.filter((j) => j.open).map((j) => j.team)).size;
  const marquee = useMemo(() => {
    const t = Array.from(new Set(state.jobs.map((j) => j.team).filter(Boolean)));
    return t.length >= 3 ? t : ['Engineering', 'Design', 'Community', 'Growth', 'Writing', 'Security', 'QA'];
  }, [state.jobs]);

  return (
    <div className="careers-root relative min-h-screen overflow-x-clip bg-[#05050f] font-sans text-white selection:bg-cyan-300/30">
      <style>{`
        .careers-root .font-display { font-family: 'Unbounded', 'Syne', system-ui, sans-serif; }
        .careers-root .font-serif-i { font-family: 'Instrument Serif', Georgia, serif; font-style: italic; font-weight: 400; letter-spacing: -0.01em; }
        .careers-root .font-mono { font-family: 'DM Mono', ui-monospace, 'Courier New', monospace; }
        .careers-shine { background: linear-gradient(100deg, #a5b4fc 0%, #67e8f9 28%, #ffffff 50%, #6ee7b7 72%, #a5b4fc 100%); background-size: 250% 100%; -webkit-background-clip: text; background-clip: text; color: transparent; -webkit-text-fill-color: transparent; animation: careers-shine 6s linear infinite; }
        @keyframes careers-shine { to { background-position: -250% 0; } }
        @keyframes careers-spin { to { transform: rotate(360deg); } }
        @keyframes careers-grain { 0%,100% { transform: translate(0,0); } 20% { transform: translate(-3%,2%); } 40% { transform: translate(2%,-3%); } 60% { transform: translate(-2%,-1%); } 80% { transform: translate(3%,3%); } }
        @keyframes careers-drip { 0% { transform: translateY(-100%); } 100% { transform: translateY(260%); } }
        @keyframes careers-blink { 50% { opacity: 0; } }
        @keyframes careers-shimmer { 100% { transform: translateX(100%); } }
        .careers-spin { animation: careers-spin 7s linear infinite; }
        .careers-grain { animation: careers-grain 1.2s steps(5) infinite; }
        .careers-drip { animation: careers-drip 1.8s cubic-bezier(.6,0,.2,1) infinite; }
        .careers-blink { animation: careers-blink 1s steps(2) infinite; }
        .careers-shimmer::after { content: ''; position: absolute; inset: 0; transform: translateX(-100%); background: linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent); animation: careers-shimmer 1.6s infinite; }
        @media (prefers-reduced-motion: reduce) { .careers-spin, .careers-shine, .careers-grain, .careers-drip, .careers-blink, .careers-shimmer::after { animation: none !important; } }
      `}</style>
      <StarBackground fixed starCount={150} />
      <div className="pointer-events-none fixed inset-0 z-[1] bg-[radial-gradient(ellipse_at_top,rgba(99,102,241,0.10),transparent_55%)]" />
      <div className="pointer-events-none fixed inset-0 z-[2] bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.55))]" />
      <Grain />
      <Cursor />
      {intro && <Preloader ready={fontsReady && !state.loading} onReveal={onReveal} onDone={onIntroDone} />}
      <div className="relative z-10">
        <ScrollChrome />
        <Nav openRoles={openRoles} go={revealed} onApply={() => scrollTo('roles')} />
        <Hero openRoles={openRoles} teams={teams} accepting={state.accepting} go={revealed} onBrowse={() => scrollTo('roles')} onGeneral={() => openRole('general')} />
        <Marquee words={marquee} />
        <Why />
        <How />
        <Roles state={state} onOpen={openRole} reload={load} />
        <Faq />
        <FinalCta onBrowse={() => scrollTo('roles')} />
      </div>
      <AnimatePresence>
        {selected && (
          <Drawer key={selected.slug} job={selected} accepting={state.accepting} pausedMessage={state.pausedMessage}
            attribution={attribution} engagement={engagement} onClose={closeRole} />
        )}
      </AnimatePresence>
    </div>
  );
}
