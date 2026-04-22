import { useState, useEffect, useRef } from 'react';
import { getUserTimezone, localDateTimeToUTC, getTimezoneOptions } from '../utils/timezoneUtils';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, Users, MessageSquare, BarChart3, FileText, Shield, Copy, Check, Lock,
  ArrowRight, Link, Eye, EyeOff, ChevronRight, Zap, Clock,
  CheckCircle2, TrendingUp, ListChecks, Timer,
  Brain, ArrowUpRight, AlertCircle, UtensilsCrossed, MapPin, QrCode, Layers, Search, CornerDownRight
} from 'lucide-react';
import { eventAPI } from '../services/api';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { useWhiteLabel } from '../context/WhiteLabelContext';

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL CSS — Bricolage Grotesque (display) + Instrument Sans (body)
// ─────────────────────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,200..800&family=Instrument+Sans:ital,wght@0,400..700;1,400..700&display=swap');

  :root {
    --bg-base:    #05050d;
    --bg-surface: #080812;
    --bg-venue:   #090808;
    --accent-1:   #7c7dff;
    --accent-2:   #ff7a45;
    --text-dim:   rgba(255,255,255,0.38);
    --border:     rgba(255,255,255,0.07);
    --border-strong: rgba(255,255,255,0.12);
  }

  *, *::before, *::after { box-sizing: border-box; }

  .font-display { font-family: 'Bricolage Grotesque', system-ui, sans-serif; }
  .font-body    { font-family: 'Instrument Sans', system-ui, sans-serif; }

  body { font-family: 'Instrument Sans', system-ui, sans-serif; }

  /* ── Keyframes ── */
  @keyframes fade-up   { from { opacity:0; transform:translateY(18px); } to { opacity:1; transform:translateY(0); } }
  @keyframes shimmer   { 0%,100% { opacity:0.6; } 50% { opacity:1; } }
  @keyframes orb-a     { 0%,100% { transform:translate(0,0) scale(1); } 50% { transform:translate(40px,-30px) scale(1.08); } }
  @keyframes orb-b     { 0%,100% { transform:translate(0,0) scale(1); } 50% { transform:translate(-50px,40px) scale(0.95); } }
  @keyframes scan      { from { top:0; } to { top:100%; } }
  @keyframes load-bar  { from { width:0; } to { width:100%; } }
  @keyframes pulse-dot { 0%,100% { opacity:1; } 50% { opacity:0.25; } }
  @keyframes bounce-y  { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-6px); } }
  @keyframes glow-border { 0%,100% { box-shadow: 0 0 0 0 rgba(124,125,255,0); } 50% { box-shadow: 0 0 0 3px rgba(124,125,255,0.12); } }
  @keyframes hero-word { from { opacity:0; transform:translateY(20px) skewY(3deg); } to { opacity:1; transform:translateY(0) skewY(0); } }
  @keyframes float-subtle { 0%,100% { transform:translateY(0px); } 50% { transform:translateY(-5px); } }
  @keyframes scroll-hint { 0%,100% { opacity:0.3; transform:translateY(0); } 50% { opacity:0.7; transform:translateY(4px); } }

  /* ── Hero word animation ── */
  .hw { display:inline-block; opacity:0; animation:hero-word 0.7s cubic-bezier(0.22,1,0.36,1) forwards; }

  /* ── Loading bar ── */
  .load-bar { animation: load-bar 1.8s cubic-bezier(0.4,0,0.2,1) forwards; }

  /* ── Card hover ── */
  .card-lift { transition: transform 0.32s cubic-bezier(0.22,1,0.36,1), box-shadow 0.32s ease, border-color 0.32s ease; }
  .card-lift:hover { transform: translateY(-4px); }

  .feature-card-events:hover {
    border-color: rgba(124,125,255,0.3) !important;
    box-shadow: 0 20px 48px rgba(0,0,0,0.5), 0 0 32px rgba(124,125,255,0.08);
  }
  .feature-card-venue:hover {
    border-color: rgba(255,122,69,0.3) !important;
    box-shadow: 0 20px 48px rgba(0,0,0,0.5), 0 0 32px rgba(255,122,69,0.08);
  }
  .feature-card-neutral:hover {
    border-color: rgba(255,255,255,0.16) !important;
    box-shadow: 0 20px 48px rgba(0,0,0,0.4);
  }

  /* ── Nav link underline ── */
  .nav-item { position:relative; }
  .nav-item::after {
    content:''; position:absolute; bottom:-2px; left:50%; right:50%;
    height:1px; background:var(--accent-1);
    transition: left 0.28s ease, right 0.28s ease;
  }
  .nav-item:hover::after { left:0; right:0; }

  /* ── Glass panel ── */
  .glass {
    background: rgba(255,255,255,0.035);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border: 1px solid var(--border);
  }

  /* ── Shimmer text ── */
  .shimmer-text {
    background: linear-gradient(115deg, #fff 20%, #a5b4fc 50%, #fff 80%);
    background-size: 250% auto;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: shimmer 3.5s ease-in-out infinite;
  }

  /* ── Dark input ── */
  .dark-input {
    width:100%;
    padding:12px 16px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 12px;
    color: #fff;
    font-family: 'Instrument Sans', sans-serif;
    font-size: 14px;
    transition: border-color 0.2s, box-shadow 0.2s;
    outline: none;
  }
  .dark-input:focus {
    border-color: rgba(124,125,255,0.5);
    box-shadow: 0 0 0 3px rgba(124,125,255,0.1);
  }
  .dark-input::placeholder { color: rgba(255,255,255,0.2); }

  /* ── Select ── */
  select.dark-input {
    -webkit-appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='rgba(255,255,255,0.3)' strokeWidth='1.5' fill='none' strokeLinecap='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 14px center;
    background-size: 10px;
    padding-right: 36px;
    cursor: pointer;
  }
  select.dark-input option { background: #0d0d1a; color: #fff; }

  /* ── Branch cards ── */
  .branch-card { transition: all 0.45s cubic-bezier(0.22,1,0.36,1); }
  .branch-card:hover { transform: translateY(-3px); }
  .branch-events:hover { box-shadow: 0 40px 80px rgba(0,0,0,0.6), 0 0 60px rgba(124,125,255,0.07); }
  .branch-venue:hover  { box-shadow: 0 40px 80px rgba(0,0,0,0.6), 0 0 60px rgba(255,122,69,0.07); }

  /* ── Typing dots ── */
  .typing-dot { animation: pulse-dot 1.2s ease-in-out infinite; }
  .typing-dot:nth-child(2) { animation-delay: 0.2s; }
  .typing-dot:nth-child(3) { animation-delay: 0.4s; }

  /* ── Table pulse ── */
  @keyframes tpulse { 0%,100% { opacity:0.3; transform:scale(1); } 50% { opacity:0.7; transform:scale(1.05); } }
  .table-ring { animation: tpulse 2.4s ease-in-out infinite; }

  /* ── Shake ── */
  @keyframes shake { 0%,100% { transform:translateX(0); } 20%,60% { transform:translateX(-5px); } 40%,80% { transform:translateX(5px); } }
  .animate-shake { animation: shake 0.4s ease; }

  /* ── Scroll indicator ── */
  .scroll-indicator { animation: scroll-hint 2.2s ease-in-out infinite; }

  /* ── CTA button ── */
  .btn-primary {
    position: relative;
    overflow: hidden;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  .btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 16px 48px rgba(0,0,0,0.5), 0 0 28px rgba(124,125,255,0.2);
  }
  .btn-primary::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 60%);
    pointer-events: none;
  }
  .btn-venue {
    transition: transform 0.2s ease, border-color 0.2s ease, background 0.2s ease;
  }
  .btn-venue:hover {
    transform: translateY(-2px);
    border-color: rgba(255,122,69,0.6) !important;
    background: rgba(255,122,69,0.1) !important;
  }

  /* ── Section grid bg ── */
  .section-grid {
    background-image:
      linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
    background-size: 48px 48px;
  }

  /* ── Highlight pill ── */
  .highlight-pill {
    background: rgba(124,125,255,0.1);
    border: 1px solid rgba(124,125,255,0.2);
    color: #a5b4fc;
    animation: glow-border 4s ease-in-out infinite;
  }

  /* ── Testimonial card ── */
  .testimonial-card {
    transition: transform 0.3s ease, box-shadow 0.3s ease;
  }
  .testimonial-card:hover {
    transform: translateY(-3px);
    box-shadow: 0 24px 60px rgba(0,0,0,0.5);
  }

  /* ── Prose nav links ── */
  @media (max-width: 767px) {
    .mobile-menu-enter { animation: fade-up 0.2s ease; }
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// INJECT GLOBAL CSS
// ─────────────────────────────────────────────────────────────────────────────
function InjectGlobalCSS() {
  useEffect(() => {
    const id = 'planit-home-styles-v2';
    if (!document.getElementById(id)) {
      const s = document.createElement('style');
      s.id = id; s.textContent = GLOBAL_CSS;
      document.head.appendChild(s);
    }
    return () => { const el = document.getElementById(id); if (el) el.remove(); };
  }, []);
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// LOADING SCREEN
// ─────────────────────────────────────────────────────────────────────────────
function LoadingScreen({ onDone }) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 1800);
    const t2 = setTimeout(() => onDone(), 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#05050d',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        transition: 'opacity 0.5s ease',
        opacity: phase === 1 ? 0 : 1,
        pointerEvents: phase === 1 ? 'none' : 'all',
      }}
    >
      {/* Scan line */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
        background: 'linear-gradient(90deg, transparent, rgba(124,125,255,0.5), transparent)',
        animation: 'scan 1.8s linear 1', pointerEvents: 'none' }} />

      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 12,
          background: 'rgba(124,125,255,0.1)',
          border: '1px solid rgba(124,125,255,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 20px rgba(124,125,255,0.15)'
        }}>
          <Calendar style={{ width: 20, height: 20, color: '#a5b4fc' }} />
        </div>
        <span style={{
          fontFamily: "'Bricolage Grotesque', sans-serif",
          fontSize: 24, fontWeight: 700, color: '#fff', letterSpacing: '-0.04em'
        }}>PlanIt</span>
      </div>

      {/* Progress line */}
      <div style={{ width: 180, height: 1, background: 'rgba(255,255,255,0.06)', borderRadius: 1, overflow: 'hidden' }}>
        <div className="load-bar" style={{ height: '100%', background: 'linear-gradient(90deg, #7c7dff, #a5b4fc)' }} />
      </div>
      <p style={{
        marginTop: 18, fontSize: 10, letterSpacing: '0.2em',
        textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)',
        fontFamily: "'Instrument Sans', sans-serif"
      }}>
        Event &amp; venue management
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AMBIENT BACKGROUND
// ─────────────────────────────────────────────────────────────────────────────
function AmbientBG() {
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
      {/* Dot grid */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id="dots" width="32" height="32" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.8" fill="rgba(255,255,255,0.06)" />
          </pattern>
          <radialGradient id="dot-fade" cx="50%" cy="45%" r="55%">
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
          <mask id="dm"><rect width="100%" height="100%" fill="url(#dot-fade)" /></mask>
        </defs>
        <rect width="100%" height="100%" fill="url(#dots)" mask="url(#dm)" />
      </svg>

      {/* Glow orbs */}
      <div style={{
        position: 'absolute', top: '10%', left: '8%', width: 560, height: 560, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(124,125,255,0.09) 0%, transparent 70%)',
        filter: 'blur(50px)', animation: 'orb-a 20s ease-in-out infinite'
      }} />
      <div style={{
        position: 'absolute', bottom: '8%', right: '6%', width: 420, height: 420, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(124,125,255,0.06) 0%, transparent 70%)',
        filter: 'blur(60px)', animation: 'orb-b 26s ease-in-out infinite'
      }} />
      <div style={{
        position: 'absolute', top: '50%', left: '50%', width: 300, height: 300, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,122,69,0.04) 0%, transparent 70%)',
        filter: 'blur(70px)', animation: 'orb-a 32s ease-in-out infinite reverse'
      }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────
function slugify(text) {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 40);
}
function makeSubdomain(title) {
  const slug = slugify(title);
  if (!slug) return '';
  return `${slug}-${Math.random().toString(36).substring(2, 6)}`;
}

function useScrollReveal(threshold = 0.08) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.unobserve(el); } }, { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}

function Reveal({ children, delay = 0, className = '' }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setTimeout(() => setVisible(true), delay); obs.unobserve(el); } },
      { threshold: 0.06 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [delay]);
  return (
    <div
      ref={ref}
      className={className}
      style={{
        transition: 'opacity 0.65s ease, transform 0.65s cubic-bezier(0.22,1,0.36,1)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(20px)',
      }}
    >
      {children}
    </div>
  );
}

function AnimatedCounter({ end, duration = 2000, suffix = '' }) {
  const [count, setCount] = useState(0);
  const [ref, visible] = useScrollReveal(0.1);
  useEffect(() => {
    if (!visible) return;
    let startTime, raf;
    const animate = (ts) => {
      if (!startTime) startTime = ts;
      const pct = Math.min((ts - startTime) / duration, 1);
      setCount(Math.floor(end * pct));
      if (pct < 1) raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [visible, end, duration]);
  return <span ref={ref} className="tabular-nums">{count}{suffix}</span>;
}

// ─────────────────────────────────────────────────────────────────────────────
// COPY LINK BOX
// ─────────────────────────────────────────────────────────────────────────────
function CopyLinkBox({ eventId, subdomain, mode }) {
  const [copiedRsvp, setCopiedRsvp] = useState(false);
  const [copiedEvent, setCopiedEvent] = useState(false);
  const rsvpLink  = subdomain ? `${window.location.origin}/rsvp/${subdomain}` : null;
  const eventLink = subdomain ? `${window.location.origin}/e/${subdomain}` : `${window.location.origin}/event/${eventId}`;
  const showRsvp = mode !== 'table-service' && rsvpLink;

  const copyRsvp = () => {
    navigator.clipboard.writeText(rsvpLink);
    setCopiedRsvp(true); toast.success('RSVP link copied');
    setTimeout(() => setCopiedRsvp(false), 2000);
  };
  const copyEvent = () => {
    navigator.clipboard.writeText(eventLink);
    setCopiedEvent(true); toast.success('Event link copied');
    setTimeout(() => setCopiedEvent(false), 2000);
  };

  return (
    <div className="mt-4 space-y-2">
      {showRsvp && (
        <div style={{ borderRadius: 14, border: '1px solid rgba(124,125,255,0.25)', background: 'rgba(124,125,255,0.06)', overflow: 'hidden', transition: 'border-color 0.2s' }}>
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider" style={{ minWidth: 40 }}>RSVP</span>
            <span className="flex-1 text-xs font-mono truncate" style={{ color: 'rgba(165,180,252,0.7)' }}>{rsvpLink}</span>
            <button onClick={copyRsvp} style={{
              flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
              fontSize: 11, fontWeight: 600, borderRadius: 8, transition: 'all 0.2s',
              background: copiedRsvp ? '#10b981' : 'rgba(124,125,255,0.8)', color: '#fff', border: 'none', cursor: 'pointer'
            }}>
              {copiedRsvp ? <><Check size={12} />Copied</> : <><Copy size={12} />Copy</>}
            </button>
          </div>
        </div>
      )}
      <div style={{ borderRadius: 14, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', overflow: 'hidden' }}>
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)', minWidth: 40 }}>Space</span>
          <span className="flex-1 text-xs font-mono truncate" style={{ color: 'rgba(255,255,255,0.5)' }}>{eventLink}</span>
          <button onClick={copyEvent} style={{
            flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
            fontSize: 11, fontWeight: 600, borderRadius: 8, transition: 'all 0.2s',
            background: copiedEvent ? '#10b981' : '#fff', color: copiedEvent ? '#fff' : '#09090b', border: 'none', cursor: 'pointer'
          }}>
            {copiedEvent ? <><Check size={12} />Copied</> : <><Copy size={12} />Copy</>}
          </button>
        </div>
      </div>
      {showRsvp && (
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', paddingLeft: 4 }}>
          The RSVP link is the primary shareable link. Enable the RSVP page in Event Settings to activate it.
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SLUG FINDER
// ─────────────────────────────────────────────────────────────────────────────
function SlugFinder({ compact = false }) {
  const navigate = useNavigate();
  const [value, setValue] = useState('');
  const [shaking, setShaking] = useState(false);

  const handleGo = () => {
    const raw = value.trim();
    if (!raw) return;
    let slug = raw;
    try {
      const url = new URL(raw.startsWith('http') ? raw : `https://x.com/${raw}`);
      const rsvpMatch  = url.pathname.match(/\/rsvp\/([^/?#]+)/);
      const eventMatch = url.pathname.match(/\/e\/([^/?#]+)/);
      if (rsvpMatch)       slug = rsvpMatch[1];
      else if (eventMatch) slug = eventMatch[1];
      else                 slug = url.pathname.replace(/^\/+|\/+$/g, '');
    } catch {}
    slug = slug.replace(/^\/?(rsvp\/|e\/)?/, '').replace(/\/+$/, '');
    if (!slug) {
      setShaking(true); setTimeout(() => setShaking(false), 500); return;
    }
    navigate(`/e/${slug}`);
  };

  const handleKey = (e) => { if (e.key === 'Enter') handleGo(); };

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${shaking ? 'animate-shake' : ''}`}>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(255,255,255,0.25)', pointerEvents: 'none' }} />
          <input
            type="text" value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Paste an event link or slug…"
            className="dark-input"
            style={{ paddingLeft: 40, height: 42 }}
          />
        </div>
        <button onClick={handleGo} style={{
          flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
          height: 42, padding: '0 16px', borderRadius: 12, fontSize: 13, fontWeight: 600,
          background: '#fff', color: '#09090b', border: 'none', cursor: 'pointer',
          transition: 'transform 0.15s, background 0.15s',
        }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          Go <CornerDownRight size={13} />
        </button>
      </div>
    );
  }

  return (
    <div className={`max-w-lg mx-auto ${shaking ? 'animate-shake' : ''}`}>
      <div className="flex gap-3 p-2 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'rgba(255,255,255,0.25)', pointerEvents: 'none' }} />
          <input
            type="text" value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Paste an event link or slug…"
            style={{
              width: '100%', height: 44, paddingLeft: 40, paddingRight: 12,
              background: 'transparent', border: 'none', outline: 'none',
              color: '#fff', fontSize: 14, fontFamily: "'Instrument Sans', sans-serif",
            }}
          />
        </div>
        <button onClick={handleGo} style={{
          flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6,
          height: 44, padding: '0 18px', borderRadius: 12, fontSize: 13, fontWeight: 700,
          background: 'rgba(255,255,255,0.9)', color: '#09090b', border: 'none', cursor: 'pointer',
          transition: 'transform 0.15s, background 0.15s',
        }}
          onMouseEnter={e => e.currentTarget.style.background = '#fff'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.9)'}
        >
          Find event <CornerDownRight size={13} />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTIMONIAL CARD
// ─────────────────────────────────────────────────────────────────────────────
function TestimonialCard({ quote, author, role, event, delay = 0 }) {
  return (
    <Reveal delay={delay}>
      <article
        className="testimonial-card h-full flex flex-col"
        style={{
          padding: '28px 28px 24px',
          borderRadius: 20,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        {/* Quote mark */}
        <div style={{ fontSize: 48, lineHeight: 1, color: 'rgba(124,125,255,0.25)', fontFamily: 'Georgia, serif', marginBottom: 12 }}>"</div>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, lineHeight: 1.75, flex: 1, marginBottom: 20 }}>{quote}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{
            width: 38, height: 38, borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(124,125,255,0.3), rgba(124,125,255,0.08))',
            border: '1px solid rgba(124,125,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color: '#a5b4fc', flexShrink: 0,
          }}>
            {author[0]}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{author}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>{role} · {event}</div>
          </div>
        </div>
      </article>
    </Reveal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ENTERPRISE CHECK-IN DEMO
// ─────────────────────────────────────────────────────────────────────────────
const DEMO_GUESTS = [
  { id: 1, name: 'Jordan Lee',     role: 'VIP',      tickets: 1, status: 'normal',  checkedIn: false, checking: false, checkedAt: null, scanCount: 0 },
  { id: 2, name: 'Morgan Chen',    role: 'Speaker',   tickets: 1, status: 'normal',  checkedIn: false, checking: false, checkedAt: null, scanCount: 0 },
  { id: 3, name: 'Taylor Rivera',  role: 'Attendee',  tickets: 2, status: 'blocked', checkedIn: false, checking: false, checkedAt: null, scanCount: 0, blockReason: 'Payment declined on file' },
  { id: 4, name: 'Casey Kim',      role: 'Sponsor',   tickets: 1, status: 'normal',  checkedIn: false, checking: false, checkedAt: null, scanCount: 0 },
  { id: 5, name: 'Alex Patel',     role: 'Attendee',  tickets: 1, status: 'flagged', checkedIn: false, checking: false, checkedAt: null, scanCount: 0, flagReason: 'Duplicate ticket detected' },
  { id: 6, name: 'Sam Johnson',    role: 'Attendee',  tickets: 1, status: 'normal',  checkedIn: false, checking: false, checkedAt: null, scanCount: 0 },
];

function EnterpriseDemo() {
  const [guests, setGuests] = useState(DEMO_GUESTS.map(g => ({ ...g })));
  const [tab, setTab] = useState('guests');
  const [securityLog, setSecurityLog] = useState([]);
  const [lastChecked, setLastChecked] = useState(null);
  const [scanning, setScanning] = useState(null);
  const [overrideTarget, setOverrideTarget] = useState(null);
  const [overridePin, setOverridePin] = useState('');
  const [overrideError, setOverrideError] = useState('');
  const [overrideSuccess, setOverrideSuccess] = useState(false);
  const [simulating, setSimulating] = useState(false);

  const totalGuests = guests.reduce((a, g) => a + g.tickets, 0);
  const checkedInGuests = guests.filter(g => g.checkedIn).reduce((a, g) => a + g.tickets, 0);
  const pct = Math.round((checkedInGuests / totalGuests) * 100) || 0;

  const addLog = (entry) => setSecurityLog(prev => [{ ...entry, id: Date.now(), time: new Date() }, ...prev].slice(0, 20));

  const handleScan = (guest) => {
    if (guest.checkedIn || guest.checking || scanning) return;
    setScanning(guest.id);
    setGuests(prev => prev.map(g => g.id === guest.id ? { ...g, checking: true } : g));
    setTimeout(() => {
      if (guest.status === 'blocked') {
        addLog({ type: 'blocked', severity: 'high', name: guest.name, msg: `Check-in blocked — ${guest.blockReason}` });
        setGuests(prev => prev.map(g => g.id === guest.id ? { ...g, checking: false } : g));
        setOverrideTarget(guest);
      } else if (guest.status === 'flagged') {
        addLog({ type: 'flagged', severity: 'medium', name: guest.name, msg: `Flagged — ${guest.flagReason}` });
        setGuests(prev => prev.map(g => g.id === guest.id ? { ...g, checking: false } : g));
        setOverrideTarget(guest);
      } else if (guest.scanCount >= 1) {
        addLog({ type: 'duplicate', severity: 'high', name: guest.name, msg: `Duplicate scan #${guest.scanCount + 1} — ticket already used` });
        setGuests(prev => prev.map(g => g.id === guest.id ? { ...g, checking: false, scanCount: g.scanCount + 1 } : g));
      } else {
        const now = new Date();
        addLog({ type: 'success', severity: 'ok', name: guest.name, msg: `Checked in successfully · ${guest.role}` });
        setGuests(prev => prev.map(g => g.id === guest.id ? { ...g, checkedIn: true, checking: false, checkedAt: now, scanCount: 1 } : g));
        setLastChecked({ name: guest.name, role: guest.role, time: now });
      }
      setScanning(null);
    }, 750);
  };

  const handleOverride = () => {
    if (overridePin !== '1234') { setOverrideError('Incorrect PIN'); return; }
    setOverrideSuccess(true);
    const target = overrideTarget;
    setTimeout(() => {
      const now = new Date();
      setGuests(prev => prev.map(g => g.id === target.id ? { ...g, checkedIn: true, checking: false, checkedAt: now, status: 'normal' } : g));
      addLog({ type: 'override', severity: 'medium', name: target.name, msg: `Manager override approved — ${target.name} manually checked in` });
      setOverrideTarget(null); setOverridePin(''); setOverrideSuccess(false);
    }, 1000);
  };

  const simulateUnauthorized = () => {
    if (simulating) return;
    setSimulating(true);
    const fakeCodes = ['XX99-ZZ', 'FAKE-001', 'HACK-123'];
    const code = fakeCodes[Math.floor(Math.random() * fakeCodes.length)];
    addLog({ type: 'unauthorized', severity: 'critical', name: 'Unknown', msg: `UNAUTHORIZED: Code "${code}" not found — possible forged ticket` });
    setTimeout(() => {
      addLog({ type: 'ratelimit', severity: 'medium', name: 'System', msg: `Rate limit triggered — IP blocked for 60s after 3 failed attempts` });
      setSimulating(false);
    }, 1200);
    if (tab !== 'security') setTab('security');
  };

  const handleReset = () => {
    setGuests(DEMO_GUESTS.map(g => ({ ...g, checkedIn: false, checking: false, checkedAt: null, scanCount: 0 })));
    setSecurityLog([]); setLastChecked(null); setScanning(null);
    setOverrideTarget(null); setOverridePin(''); setOverrideError('');
  };

  const roleColors = {
    VIP: 'text-amber-400 bg-amber-400/10',
    Speaker: 'text-blue-400 bg-blue-400/10',
    Sponsor: 'text-purple-400 bg-purple-400/10',
    Attendee: 'text-neutral-400 bg-neutral-800',
  };
  const logColors = {
    ok: 'text-emerald-400 border-emerald-800/40 bg-emerald-950/20',
    high: 'text-amber-400 border-amber-800/40 bg-amber-950/20',
    critical: 'text-red-400 border-red-800/40 bg-red-950/20',
    medium: 'text-blue-400 border-blue-800/40 bg-blue-950/20',
  };

  return (
    <div
      className="relative"
      style={{ borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden', background: 'rgba(8,8,18,0.95)' }}
    >
      {/* Manager override modal */}
      {overrideTarget && !overrideSuccess && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', borderRadius: 20 }}>
          <div style={{ width: '100%', maxWidth: 280, margin: '0 16px', background: '#0d0d1a', borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)', padding: 24 }}>
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold mb-4 ${overrideTarget.status === 'blocked' ? 'bg-red-950/50 border border-red-800/50 text-red-400' : 'bg-amber-950/50 border border-amber-800/50 text-amber-400'}`}>
              {overrideTarget.status === 'blocked' ? 'Guest Blocked' : 'Guest Flagged'}
            </div>
            <p className="text-sm font-bold text-white mb-1">{overrideTarget.name}</p>
            <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.4)' }}>{overrideTarget.blockReason || overrideTarget.flagReason}</p>
            <p className="text-xs font-bold mb-2" style={{ color: 'rgba(255,255,255,0.4)' }}>Manager PIN required to override</p>
            <input
              type="password" maxLength={4} value={overridePin}
              onChange={e => { setOverridePin(e.target.value); setOverrideError(''); }}
              placeholder="Enter PIN (hint: 1234)"
              className="dark-input text-center text-lg font-mono tracking-widest mb-2"
              autoFocus
            />
            {overrideError && <p className="text-xs text-red-400 mb-2">{overrideError}</p>}
            <div className="flex gap-2 mt-3">
              <button onClick={() => { setOverrideTarget(null); setOverridePin(''); setOverrideError(''); }}
                style={{ flex: 1, padding: '8px 0', fontSize: 12, fontWeight: 600, borderRadius: 10, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)', border: 'none', cursor: 'pointer' }}>
                Cancel
              </button>
              <button onClick={handleOverride}
                style={{ flex: 1, padding: '8px 0', fontSize: 12, fontWeight: 600, borderRadius: 10, background: 'rgba(255,255,255,0.1)', color: '#fff', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer' }}>
                Override
              </button>
            </div>
          </div>
        </div>
      )}
      {overrideTarget && overrideSuccess && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', borderRadius: 20 }}>
          <div className="text-center">
            <div className="w-14 h-14 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-3 animate-bounce">
              <Check className="w-7 h-7 text-white" />
            </div>
            <p className="text-sm font-bold text-emerald-400">Override approved</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="px-5 pt-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 99, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', marginBottom: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block', animation: 'pulse-dot 2s ease-in-out infinite' }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Live Check-in Demo</span>
            </div>
            <div className="text-sm font-bold text-white">Tech Summit 2026</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>{DEMO_GUESTS.length} invites · {totalGuests} guests</div>
          </div>
          {/* Progress ring */}
          <div style={{ position: 'relative', width: 48, height: 48, flexShrink: 0 }}>
            <svg width="48" height="48" viewBox="0 0 48 48" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="24" cy="24" r="18" fill="none" stroke="#1a1a2e" strokeWidth="4" />
              <circle cx="24" cy="24" r="18" fill="none" stroke="#10b981" strokeWidth="4"
                strokeDasharray={`${2 * Math.PI * 18}`}
                strokeDashoffset={`${2 * Math.PI * 18 * (1 - pct / 100)}`}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff' }}>{pct}%</div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          {['guests', 'security', 'analytics'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '8px 12px', fontSize: 11, fontWeight: 700, textTransform: 'capitalize',
              borderBottom: `2px solid ${tab === t ? '#fff' : 'transparent'}`,
              marginBottom: -1,
              color: tab === t ? '#fff' : 'rgba(255,255,255,0.35)',
              background: tab === t ? 'rgba(255,255,255,0.05)' : 'transparent',
              border: 'none', cursor: 'pointer', borderRadius: '8px 8px 0 0',
              display: 'flex', alignItems: 'center', gap: 6, transition: 'color 0.2s',
            }}>
              {t === 'security' && securityLog.length > 0 && (
                <span style={{ width: 16, height: 16, borderRadius: '50%', background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 900, color: '#fff' }}>
                  {securityLog.filter(l => l.severity === 'critical' || l.severity === 'high').length}
                </span>
              )}
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* GUESTS TAB */}
      {tab === 'guests' && (
        <div style={{ padding: 12, minHeight: 280, maxHeight: 340, overflowY: 'auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {guests.map(guest => {
              const isBlocked = guest.status === 'blocked' && !guest.checkedIn;
              const isFlagged = guest.status === 'flagged' && !guest.checkedIn;
              return (
                <div key={guest.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12,
                  border: `1px solid ${guest.checkedIn ? 'rgba(16,185,129,0.25)' : guest.checking ? 'rgba(255,255,255,0.15)' : isBlocked ? 'rgba(239,68,68,0.25)' : isFlagged ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.06)'}`,
                  background: guest.checkedIn ? 'rgba(16,185,129,0.06)' : isBlocked ? 'rgba(239,68,68,0.04)' : isFlagged ? 'rgba(245,158,11,0.04)' : 'rgba(255,255,255,0.02)',
                  transition: 'all 0.3s ease',
                }}>
                  {/* QR/status icon */}
                  <div style={{ flexShrink: 0 }}>
                    {guest.checking ? (
                      <div style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.15)', borderTopColor: '#fff', animation: 'spin 0.8s linear infinite' }} />
                      </div>
                    ) : guest.checkedIn ? (
                      <div style={{ width: 34, height: 34, borderRadius: 8, background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Check size={16} color="#fff" />
                      </div>
                    ) : isBlocked ? (
                      <div style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <AlertCircle size={15} color="#ef4444" />
                      </div>
                    ) : isFlagged ? (
                      <div style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid rgba(245,158,11,0.3)', background: 'rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <AlertCircle size={15} color="#f59e0b" />
                      </div>
                    ) : (
                      <div style={{ width: 34, height: 34, borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <QrCode size={15} color="rgba(255,255,255,0.3)" />
                      </div>
                    )}
                  </div>

                  {/* Name + role */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: guest.checkedIn ? '#6ee7b7' : isBlocked ? '#fca5a5' : '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{guest.name}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}
                        className={roleColors[guest.role]}>{guest.role}</span>
                      {guest.checkedIn && guest.checkedAt && (
                        <span style={{ fontSize: 9, color: 'rgba(110,231,183,0.5)' }}>{guest.checkedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      )}
                      {isBlocked && <span style={{ fontSize: 9, color: 'rgba(252,165,165,0.6)' }}>{guest.blockReason}</span>}
                      {isFlagged && <span style={{ fontSize: 9, color: 'rgba(251,191,36,0.6)' }}>{guest.flagReason}</span>}
                    </div>
                  </div>

                  {/* Scan button */}
                  {!guest.checkedIn && !guest.checking && (
                    <button onClick={() => handleScan(guest)} disabled={!!scanning} style={{
                      flexShrink: 0, fontSize: 10, fontWeight: 700, padding: '5px 10px', borderRadius: 7,
                      border: `1px solid ${isBlocked ? 'rgba(239,68,68,0.3)' : isFlagged ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.1)'}`,
                      background: isBlocked ? 'rgba(239,68,68,0.1)' : isFlagged ? 'rgba(245,158,11,0.1)' : 'rgba(255,255,255,0.05)',
                      color: isBlocked ? '#fca5a5' : isFlagged ? '#fcd34d' : 'rgba(255,255,255,0.6)',
                      cursor: scanning ? 'not-allowed' : 'pointer', opacity: scanning ? 0.4 : 1,
                      transition: 'all 0.2s',
                    }}>
                      {isBlocked ? 'Override' : isFlagged ? 'Review' : 'Scan'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
            <button onClick={simulateUnauthorized} disabled={simulating} style={{
              flex: 1, padding: '8px 0', fontSize: 10, fontWeight: 700, borderRadius: 9,
              border: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.06)', color: '#fca5a5',
              cursor: simulating ? 'not-allowed' : 'pointer', opacity: simulating ? 0.5 : 1, transition: 'all 0.2s',
            }}>
              {simulating ? 'Simulating…' : 'Simulate Forged Ticket'}
            </button>
            <button onClick={handleReset} style={{
              padding: '8px 14px', fontSize: 10, fontWeight: 700, borderRadius: 9,
              border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)',
              cursor: 'pointer', transition: 'all 0.2s',
            }}>
              Reset
            </button>
          </div>
        </div>
      )}

      {/* SECURITY TAB */}
      {tab === 'security' && (
        <div style={{ padding: 12, minHeight: 280, maxHeight: 340, overflowY: 'auto' }}>
          {securityLog.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 8 }}>
              <Shield size={28} color="rgba(255,255,255,0.1)" />
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>No security events yet</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.15)' }}>Scan a guest or simulate an attack</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {securityLog.map(log => (
                <div key={log.id} className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs ${logColors[log.severity]}`}>
                  <div style={{ flexShrink: 0, marginTop: 1, fontSize: 9, fontWeight: 900, width: 14, height: 14, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: log.severity === 'ok' ? '#10b981' : log.severity === 'critical' ? '#ef4444' : log.severity === 'high' ? '#f59e0b' : '#60a5fa',
                    color: '#fff' }}>
                    {log.severity === 'ok' ? '✓' : log.severity === 'critical' ? '!' : log.severity === 'high' ? '!' : 'i'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, marginBottom: 1 }}>{log.name}</div>
                    <div style={{ opacity: 0.75, fontSize: 10 }}>{log.msg}</div>
                  </div>
                  <div style={{ fontSize: 9, opacity: 0.5, flexShrink: 0, marginTop: 1 }}>{log.time?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ANALYTICS TAB */}
      {tab === 'analytics' && (
        <div style={{ padding: 16, minHeight: 280 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            {[
              { label: 'Total Guests', value: totalGuests, color: '#7c7dff' },
              { label: 'Checked In', value: checkedInGuests, color: '#10b981' },
              { label: 'Remaining', value: totalGuests - checkedInGuests, color: '#f59e0b' },
              { label: 'Blocked', value: guests.filter(g => g.status === 'blocked').length, color: '#ef4444' },
            ].map(s => (
              <div key={s.label} style={{ padding: '14px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.color, marginBottom: 4 }}>{s.value}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
              </div>
            ))}
          </div>
          {/* Mini progress bar */}
          <div style={{ padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>Attendance Rate</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{pct}%</span>
            </div>
            <div style={{ height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #7c7dff, #10b981)', borderRadius: 4, transition: 'width 0.6s ease' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN HOME COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function Home() {
  const { wl, isWL } = useWhiteLabel();
  const wlName    = isWL ? (wl?.branding?.companyName || wl?.clientName || '') : '';
  const wlLogo    = isWL ? (wl?.branding?.logoUrl    || '') : '';
  const wlPrimary = isWL ? (wl?.branding?.primaryColor || '') : '';
  const wlPages   = isWL ? (wl?.pages  || {}) : {};
  const wlFeatures= isWL ? (wl?.features || {}) : {};
  const heroHeadline    = wlPages?.home?.headline    || '';
  const heroSubheadline = wlPages?.home?.subheadline || '';
  const heroCta         = wlPages?.home?.ctaText     || '';
  const heroImage       = wlPages?.home?.heroImageUrl|| '';

  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mode, setMode] = useState('standard');
  const [formData, setFormData] = useState({
    subdomain: '', title: '', description: '', date: '', timezone: getUserTimezone(), location: '',
    organizerName: '', organizerEmail: '', accountPassword: '', password: '', staffPassword: '',
    isEnterpriseMode: false, maxParticipants: 10000,
  });
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(null);
  const [showAd, setShowAd] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showAccountPassword, setShowAccountPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [loadingDone, setLoadingDone] = useState(false);

  useEffect(() => { if (isWL) { setSelectedBranch('events'); setLoadingDone(true); } }, [isWL]);

  const selectBranch = (branch) => {
    setSelectedBranch(branch);
    setMode(branch === 'venue' ? 'table-service' : 'standard');
    setTimeout(() => {
      document.getElementById(branch === 'venue' ? 'planit-venue' : 'planit-events')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const handleTitleChange = (e) => {
    const title = e.target.value;
    setFormData(prev => ({ ...prev, title, subdomain: prev._subdomainTouched ? prev.subdomain : makeSubdomain(title) }));
  };
  const update = (field) => (e) =>
    setFormData(prev => ({ ...prev, [field]: e.target.value, ...(field === 'subdomain' ? { _subdomainTouched: true } : {}) }));
  const sanitize = (str) => (str || '').trim().replace(/\s+/g, ' ');

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = {};
    const isTS = mode === 'table-service';
    if (!formData.title.trim())            errs.title          = isTS ? 'Restaurant name is required.' : 'Event title is required.';
    if (!isTS && !formData.date)           errs.date           = 'Date and time is required.';
    if (!isTS && !formData.timezone)       errs.timezone       = 'Timezone is required.';
    if (!formData.organizerName.trim())    errs.organizerName  = isTS ? 'Manager name is required.' : 'Your name is required.';
    if (!formData.organizerEmail.trim())   errs.organizerEmail = isTS ? 'Manager email is required.' : 'Your email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.organizerEmail.trim()))
                                           errs.organizerEmail = 'Please enter a valid email address.';
    if (!formData.accountPassword)         errs.accountPassword = 'Account password is required.';
    else if (formData.accountPassword.length < 4)
                                           errs.accountPassword = 'Password must be at least 4 characters.';
    if (isTS && formData.staffPassword && formData.staffPassword.length < 4)
                                           errs.staffPassword  = 'Staff PIN must be at least 4 characters.';
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      const firstField = document.querySelector('.field-error');
      if (firstField) firstField.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setFieldErrors({});
    setLoading(true);

    const dateValue = (!isTS && formData.date) ? localDateTimeToUTC(formData.date, formData.timezone) : undefined;
    const payload = {
      title:          sanitize(formData.title),
      description:    sanitize(formData.description),
      ...(dateValue ? { date: dateValue, timezone: formData.timezone } : {}),
      location:       sanitize(formData.location),
      organizerName:  sanitize(formData.organizerName),
      organizerEmail: sanitize(formData.organizerEmail),
      accountPassword:formData.accountPassword,
      password:       formData.password || undefined,
      staffPassword:  (isTS && formData.staffPassword) ? formData.staffPassword : undefined,
      subdomain:      formData.subdomain || makeSubdomain(formData.title) || `event-${Date.now()}`,
      isEnterpriseMode: mode === 'enterprise',
      isTableServiceMode: isTS,
      maxParticipants: formData.maxParticipants,
    };
    try {
      const response = await eventAPI.create(payload);
      localStorage.setItem('eventToken', response.data.token);
      localStorage.setItem('username', sanitize(formData.organizerName));
      setCreated(response.data.event);
      setShowAd(true);
    } catch (error) {
      const data = error.response?.data;
      const FIELD_LABELS = {
        date: 'Date and time', timezone: 'Timezone',
        title: mode === 'table-service' ? 'Restaurant name' : 'Event title',
        organizerName: mode === 'table-service' ? 'Manager name' : 'Your name',
        organizerEmail: mode === 'table-service' ? 'Manager email' : 'Your email',
        accountPassword: 'Account password',
        password: mode === 'table-service' ? 'Staff PIN' : 'Event password',
        subdomain: mode === 'table-service' ? 'Restaurant URL' : 'Event URL',
      };
      if (data?.errors && Array.isArray(data.errors)) {
        const serverErrs = {};
        const toastMsgs = [];
        data.errors.forEach(e => {
          const path = e.path || e.param || '';
          const label = FIELD_LABELS[path] || path;
          const msg = e.msg || e.message || 'Invalid value';
          if (path === 'date' && mode === 'table-service') return;
          serverErrs[path] = `${label}: ${msg}`;
          toastMsgs.push(`${label} — ${msg}`);
        });
        setFieldErrors(serverErrs);
        if (toastMsgs.length === 1) toast.error(toastMsgs[0]);
        else if (toastMsgs.length > 1) toast.error(`${toastMsgs.length} fields need attention`);
      } else {
        toast.error(data?.message || 'Failed to create event. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const timezoneOptions = getTimezoneOptions();
  const isVenue = mode === 'table-service';

  if (!loadingDone && !isWL) {
    return (
      <>
        <InjectGlobalCSS />
        <LoadingScreen onDone={() => setLoadingDone(true)} />
      </>
    );
  }

  // ── Shared label style ──
  const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.6)', marginBottom: 8 };
  const labelIconStyle = { display: 'flex', alignItems: 'center', gap: 6 };
  const errorStyle = { fontSize: 11, color: '#f87171', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 };

  return (
    <div style={{ background: 'var(--bg-base)', minHeight: '100vh', color: '#fff', fontFamily: "'Instrument Sans', sans-serif" }}>
      <InjectGlobalCSS />

      {/* ══════════════════════════════════════════════════════
          NAVBAR
      ══════════════════════════════════════════════════════ */}
      <header
        style={{
          position: 'sticky', top: 0, zIndex: 50,
          background: 'rgba(5,5,13,0.82)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
        role="banner"
      >
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px' }}>
          <nav
            style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            aria-label="Main navigation"
          >
            {/* Logo */}
            <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }} aria-label="PlanIt home">
              {isWL && wlLogo ? (
                <img src={wlLogo} alt={wlName} style={{ height: 28, objectFit: 'contain' }} />
              ) : (
                <>
                  <div style={{
                    width: 34, height: 34, borderRadius: 10,
                    background: 'rgba(124,125,255,0.1)',
                    border: '1px solid rgba(124,125,255,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Calendar size={16} color="#a5b4fc" />
                  </div>
                  <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 18, fontWeight: 700, color: '#fff', letterSpacing: '-0.03em' }}>
                    {isWL ? wlName : 'PlanIt'}
                  </span>
                </>
              )}
            </a>

            {/* Desktop nav links */}
            <div className="hidden md:flex items-center gap-1" style={{ flex: 1, justifyContent: 'center' }}>
              {!isWL && (
                <>
                  <a href="#features" className="nav-item" style={{ padding: '6px 12px', fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.55)', textDecoration: 'none', borderRadius: 8, transition: 'color 0.2s, background 0.2s' }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; e.currentTarget.style.background = 'transparent'; }}>
                    Features
                  </a>
                  <a href="#planit-venue" onClick={e => { e.preventDefault(); selectBranch('venue'); }} className="nav-item" style={{ padding: '6px 12px', fontSize: 13, fontWeight: 500, color: 'rgba(255,122,69,0.7)', textDecoration: 'none', borderRadius: 8, transition: 'color 0.2s, background 0.2s' }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#ff7a45'; e.currentTarget.style.background = 'rgba(255,122,69,0.07)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,122,69,0.7)'; e.currentTarget.style.background = 'transparent'; }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><UtensilsCrossed size={13} /> Venue</span>
                  </a>
                  <a href="/discover" className="nav-item" style={{ padding: '6px 12px', fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.55)', textDecoration: 'none', borderRadius: 8, transition: 'color 0.2s, background 0.2s' }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; e.currentTarget.style.background = 'transparent'; }}>
                    Discover
                  </a>
                  <a href="/blog" className="nav-item" style={{ padding: '6px 12px', fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.55)', textDecoration: 'none', borderRadius: 8, transition: 'color 0.2s, background 0.2s' }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; e.currentTarget.style.background = 'transparent'; }}>
                    Blog
                  </a>
                  <a href="/status" className="nav-item" style={{ padding: '6px 12px', fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.55)', textDecoration: 'none', borderRadius: 8, transition: 'color 0.2s, background 0.2s', display: 'flex', alignItems: 'center', gap: 5 }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; e.currentTarget.style.background = 'transparent'; }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />Status
                  </a>
                </>
              )}
            </div>

            {/* CTA */}
            <div className="hidden md:flex items-center gap-3">
              <a href="/help" style={{ fontSize: 13, fontWeight: 500, color: 'rgba(255,255,255,0.45)', textDecoration: 'none', padding: '6px 10px', transition: 'color 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.45)'}>
                Help
              </a>
              <a
                href="#create"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '8px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                  background: '#fff', color: '#09090b', textDecoration: 'none',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.4)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.3)'; }}
              >
                Get started free <ArrowRight size={13} />
              </a>
            </div>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileMenuOpen(v => !v)}
              className="md:hidden"
              style={{ width: 38, height: 38, borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              aria-label="Toggle menu" aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen
                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M3 12h18M3 6h18M3 18h18" /></svg>
              }
            </button>
          </nav>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div
            className="md:hidden mobile-menu-enter"
            style={{ borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(5,5,13,0.98)', padding: '12px 16px' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {[
                { href: '#planit-venue', label: 'PlanIt Venue', icon: <UtensilsCrossed size={14} />, accent: true, onClick: (e) => { e.preventDefault(); selectBranch('venue'); setMobileMenuOpen(false); } },
                { href: '/discover', label: 'Discover', icon: <Zap size={14} color="rgba(255,255,255,0.35)" /> },
                { href: '/blog', label: 'Blog' },
                { href: '/status', label: 'Status', icon: <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} /> },
                { href: '/help', label: 'Help' },
                { href: '/about', label: 'About' },
              ].map(({ href, label, icon, accent, onClick }) => (
                <a key={label} href={href}
                  onClick={onClick || (() => setMobileMenuOpen(false))}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
                    borderRadius: 10, fontSize: 14, fontWeight: 500, textDecoration: 'none',
                    color: accent ? '#ff7a45' : 'rgba(255,255,255,0.65)',
                    transition: 'background 0.15s, color 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = accent ? '#ff9966' : '#fff'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = accent ? '#ff7a45' : 'rgba(255,255,255,0.65)'; }}
                >
                  {icon}{label}
                </a>
              ))}
              <div style={{ paddingTop: 8, marginTop: 4, borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                <a href="#create" onClick={() => setMobileMenuOpen(false)} style={{
                  display: 'block', textAlign: 'center', padding: '11px 0', borderRadius: 10,
                  fontSize: 14, fontWeight: 600, background: '#fff', color: '#09090b', textDecoration: 'none',
                }}>
                  Get started free
                </a>
              </div>
            </div>
          </div>
        )}
      </header>

      <main style={{ position: 'relative', zIndex: 2, overflowX: 'hidden' }}>

        {/* ══════════════════════════════════════════════════════
            HERO SECTION
        ══════════════════════════════════════════════════════ */}
        <section
          id="hero-top"
          role="region"
          aria-label="Hero"
          style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', overflow: 'hidden' }}
        >
          {isWL && heroImage
            ? <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${heroImage})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.15 }} />
            : <AmbientBG />
          }
          {/* Radial overlays */}
          <div aria-hidden="true" style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
            background: 'radial-gradient(ellipse 80% 55% at 50% 0%, rgba(124,125,255,0.06) 0%, transparent 60%), radial-gradient(ellipse 50% 35% at 80% 90%, rgba(255,122,69,0.04) 0%, transparent 50%)',
          }} />

          <div style={{ width: '100%', position: 'relative', zIndex: 2 }}>
            <div style={{ maxWidth: 1100, margin: '0 auto', padding: '80px 24px 100px', textAlign: 'center' }}>

              {/* Eyebrow badges */}
              <motion.div
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 44 }}
              >
                <span className="highlight-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 99, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  <Calendar size={11} /> {isWL ? 'Events' : 'PlanIt Events'}
                </span>
                <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'inline-block' }} />
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 14px', borderRadius: 99, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', background: 'rgba(255,122,69,0.08)', border: '1px solid rgba(255,122,69,0.2)', color: '#ff9a70' }}>
                  <UtensilsCrossed size={11} /> {isWL ? 'Venue' : 'PlanIt Venue'}
                </span>
              </motion.div>

              {/* Main headline */}
              {isWL && heroHeadline ? (
                <motion.h1
                  initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.25 }}
                  style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 'clamp(2.6rem,8.5vw,6.5rem)', lineHeight: 0.93, letterSpacing: '-0.04em', color: '#fff', marginBottom: 28 }}
                >
                  {heroHeadline}
                </motion.h1>
              ) : (
                <h1 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 'clamp(2.6rem,8.5vw,6.5rem)', lineHeight: 0.93, letterSpacing: '-0.04em', marginBottom: 28 }}>
                  <span className="hw" style={{ color: '#fff', animationDelay: '0.2s' }}>Plan every</span>{' '}
                  <span className="hw" style={{ color: '#fff', animationDelay: '0.35s' }}>detail.</span>
                  <br />
                  <span className="hw shimmer-text" style={{ animationDelay: '0.5s' }}>Execute flawlessly.</span>
                </h1>
              )}

              {/* Subheadline */}
              <motion.p
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.75 }}
                style={{ fontSize: 'clamp(15px,2.2vw,18px)', color: 'rgba(255,255,255,0.5)', maxWidth: 560, margin: '0 auto 48px', lineHeight: 1.7, fontWeight: 400 }}
              >
                {isWL
                  ? (heroSubheadline || wlName || 'Your event platform')
                  : <>The complete workspace for events &amp; hospitality —{' '}
                      <span style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>team chat, tasks, RSVP, QR check-in</span>
                      {' '}and a live floor manager for restaurants.</>
                }
              </motion.p>

              {/* CTA buttons */}
              <motion.div
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.9 }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 56 }}
                className="sm:flex-row sm:justify-center"
              >
                <a
                  href="#planit-events"
                  onClick={e => { e.preventDefault(); selectBranch('events'); }}
                  className="btn-primary"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '14px 28px', borderRadius: 14, fontSize: 14, fontWeight: 700,
                    background: '#fff', color: '#09090b', textDecoration: 'none',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)', width: '100%', maxWidth: 240, justifyContent: 'center',
                  }}
                >
                  <Calendar size={15} />
                  {isWL && heroCta ? heroCta : 'Start with Events'}
                  <ArrowRight size={14} />
                </a>
                <a
                  href="#planit-venue"
                  onClick={e => { e.preventDefault(); selectBranch('venue'); }}
                  className="btn-venue"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '14px 28px', borderRadius: 14, fontSize: 14, fontWeight: 700,
                    border: '1px solid rgba(255,122,69,0.28)', background: 'rgba(255,122,69,0.07)',
                    color: '#ff9a70', textDecoration: 'none', width: '100%', maxWidth: 240, justifyContent: 'center',
                  }}
                >
                  <UtensilsCrossed size={15} /> Explore Venue <ArrowRight size={14} />
                </a>
              </motion.div>

              {/* Slug finder */}
              <motion.div
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 1.05 }}
                style={{ marginBottom: 52 }}
              >
                <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'rgba(255,255,255,0.2)', marginBottom: 10 }}>
                  Already have an event link?
                </p>
                <SlugFinder />
              </motion.div>

              {/* Trust stats */}
              <motion.div
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 1.2 }}
                style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, maxWidth: 480, margin: '0 auto' }}
              >
                {[
                  { tag: 'Free forever', desc: 'No credit card required', symbol: '✦' },
                  { tag: 'Zero accounts', desc: 'Guests join by name', symbol: '◈' },
                  { tag: 'Unlimited team', desc: 'Every member included', symbol: '◉' },
                ].map(item => (
                  <div key={item.tag} style={{
                    padding: '16px 12px', borderRadius: 16, textAlign: 'center',
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                    backdropFilter: 'blur(12px)', transition: 'border-color 0.2s, transform 0.2s',
                    cursor: 'default',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(124,125,255,0.2)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.transform = ''; }}
                  >
                    <div style={{ fontSize: 18, color: '#a5b4fc', marginBottom: 6 }}>{item.symbol}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 3 }}>{item.tag}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.32)' }}>{item.desc}</div>
                  </div>
                ))}
              </motion.div>

              {/* Scroll hint */}
              <div className="scroll-indicator" style={{ marginTop: 56, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.2)' }}>Scroll</span>
                <div style={{ width: 1, height: 32, background: 'linear-gradient(to bottom, rgba(124,125,255,0.5), transparent)' }} />
              </div>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════
            BRANCH GATEWAY
        ══════════════════════════════════════════════════════ */}
        <section
          style={{ display: (selectedBranch || isWL) ? 'none' : 'block', borderTop: '1px solid rgba(255,255,255,0.05)', position: 'relative', overflow: 'hidden' }}
          aria-label="Product branches"
        >
          <div style={{ textAlign: 'center', padding: '56px 24px 32px', position: 'relative', zIndex: 2 }}>
            <Reveal>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, padding: '8px 20px', borderRadius: 99, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                {!isWL && <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.7)' }}>The PlanIt Family</span>}
                <span style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.12)', display: 'inline-block' }} />
                <span style={{ fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.06em' }}>Two branches, one platform</span>
              </div>
            </Reveal>
          </div>

          {/* Split grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '1px', background: 'rgba(255,255,255,0.05)' }}>

            {/* Events branch */}
            <Reveal>
              <a
                href="#planit-events"
                onClick={e => { e.preventDefault(); selectBranch('events'); }}
                className="branch-card branch-events group relative flex flex-col"
                style={{ minHeight: 480, background: '#07070f', display: 'flex', flexDirection: 'column', padding: '48px 48px', overflow: 'hidden', position: 'relative', cursor: 'pointer', textDecoration: 'none' }}
              >
                {/* Hover glow */}
                <div style={{ position: 'absolute', inset: 0, opacity: 0, background: 'radial-gradient(ellipse 70% 60% at 0% 50%, rgba(124,125,255,0.07) 0%, transparent 70%)', transition: 'opacity 0.6s' }}
                  onMouseEnter={e => e.currentTarget.style.opacity = 1} />
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(124,125,255,0.4), transparent)', opacity: 0, transition: 'opacity 0.5s' }} />

                <div style={{ position: 'relative', marginBottom: 36 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 99, border: '1px solid rgba(124,125,255,0.2)', background: 'rgba(124,125,255,0.07)' }}>
                    <Calendar size={12} color="#a5b4fc" />
                    <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.18em', color: '#a5b4fc' }}>{isWL ? (wlName || 'Events') : 'PlanIt Events'}</span>
                  </div>
                </div>

                <div style={{ flex: 1, position: 'relative' }}>
                  <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'rgba(255,255,255,0.2)', marginBottom: 14 }}>Branch 01</p>
                  <h3 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 'clamp(2rem,3.5vw,3.2rem)', fontWeight: 800, lineHeight: 0.94, letterSpacing: '-0.04em', color: '#fff', marginBottom: 20 }}>
                    For anyone<br />who runs<br /><span style={{ color: 'rgba(255,255,255,0.35)' }}>events.</span>
                  </h3>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.75, maxWidth: 300, marginBottom: 28 }}>
                    Weddings, corporate retreats, galas, conferences. The complete planning workspace — tasks, team chat, RSVP, QR check-in, expenses. Built for the whole arc.
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 28 }}>
                    {['Chat', 'Tasks', 'RSVP', 'QR check-in', 'Polls', 'Files', 'Budget'].map(t => (
                      <span key={t} style={{ padding: '3px 10px', fontSize: 10, fontWeight: 600, borderRadius: 6, background: 'rgba(124,125,255,0.07)', border: '1px solid rgba(124,125,255,0.15)', color: 'rgba(165,180,252,0.65)' }}>{t}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.4)', transition: 'color 0.3s' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#a5b4fc'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}>
                    Explore Events <ArrowRight size={14} />
                  </div>
                </div>

                {/* Mini mockup decoration */}
                <div style={{ position: 'absolute', bottom: 32, right: 32, width: 160, opacity: 0.12, transition: 'opacity 0.5s' }}
                  className="hidden lg:block"
                  onMouseEnter={e => { const p = e.currentTarget.closest('a'); if(p) e.currentTarget.style.opacity = '0.4'; }}
                >
                  <div style={{ borderRadius: 12, border: '1px solid rgba(124,125,255,0.15)', overflow: 'hidden', background: 'rgba(8,8,20,0.95)' }}>
                    <div style={{ padding: '6px 10px', borderBottom: '1px solid rgba(124,125,255,0.08)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
                      <span style={{ fontSize: 8, color: 'rgba(165,180,252,0.4)', fontFamily: 'monospace' }}>team-chat</span>
                    </div>
                    <div style={{ padding: '8px 10px' }}>
                      {[['A', 'Venue confirmed!', '#818cf8'], ['S', 'Floor plan attached', '#a5b4fc'], ['Y', 'All set ✓', '#e2e8f0']].map(([n, m, c]) => (
                        <div key={n} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                          <div style={{ width: 14, height: 14, borderRadius: '50%', background: 'rgba(124,125,255,0.2)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, fontWeight: 700, color: '#a5b4fc' }}>{n}</div>
                          <div><div style={{ fontSize: 7, fontWeight: 700, color: c }}>{n === 'Y' ? 'You' : n === 'A' ? 'Alex' : 'Sam'}</div><div style={{ fontSize: 7, color: 'rgba(255,255,255,0.5)', marginTop: 1 }}>{m}</div></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </a>
            </Reveal>

            {/* Venue branch */}
            <Reveal delay={80}>
              <a
                href="#planit-venue"
                onClick={e => { e.preventDefault(); selectBranch('venue'); }}
                className="branch-card branch-venue group relative flex flex-col"
                style={{ minHeight: 480, background: '#090806', display: 'flex', flexDirection: 'column', padding: '48px 48px', overflow: 'hidden', position: 'relative', cursor: 'pointer', textDecoration: 'none' }}
              >
                <div style={{ position: 'absolute', inset: 0, opacity: 0.4, background: 'radial-gradient(ellipse 70% 60% at 100% 50%, rgba(255,122,69,0.07) 0%, transparent 70%)', transition: 'opacity 0.6s' }} />
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,122,69,0.5), transparent)', opacity: 0, transition: 'opacity 0.5s' }} />

                <div style={{ position: 'relative', marginBottom: 36 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 99, border: '1px solid rgba(255,122,69,0.22)', background: 'rgba(255,122,69,0.07)' }}>
                    <UtensilsCrossed size={12} color="#ff9a70" />
                    <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.18em', color: '#ff9a70' }}>PlanIt Venue</span>
                  </div>
                </div>

                <div style={{ flex: 1, position: 'relative' }}>
                  <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'rgba(255,122,69,0.25)', marginBottom: 14 }}>Branch 02</p>
                  <h3 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 'clamp(2rem,3.5vw,3.2rem)', fontWeight: 800, lineHeight: 0.94, letterSpacing: '-0.04em', color: '#fff', marginBottom: 20 }}>
                    For every<br />busy Friday<br /><span style={{ color: 'rgba(255,122,69,0.45)' }}>night floor.</span>
                  </h3>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.75, maxWidth: 300, marginBottom: 28 }}>
                    Live floor map. Walk-in waitlist. Public wait board. QR reservations. One-tap seating. Everything your front-of-house needs, every night.
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 28 }}>
                    {['Floor map', 'Waitlist', 'Wait board', 'QR reserve', 'Seat next', 'Servers'].map(t => (
                      <span key={t} style={{ padding: '3px 10px', fontSize: 10, fontWeight: 600, borderRadius: 6, background: 'rgba(255,122,69,0.07)', border: '1px solid rgba(255,122,69,0.18)', color: 'rgba(255,154,112,0.6)' }}>{t}</span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'rgba(255,122,69,0.4)', transition: 'color 0.3s' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#ff9a70'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,122,69,0.4)'}>
                    Explore Venue <ArrowRight size={14} />
                  </div>
                </div>

                {/* Mini floor map decoration */}
                <div style={{ position: 'absolute', bottom: 32, right: 32, width: 160, opacity: 0.12, transition: 'opacity 0.5s' }} className="hidden lg:block">
                  <div style={{ borderRadius: 12, border: '1px solid rgba(255,122,69,0.15)', overflow: 'hidden', background: 'rgba(14,10,6,0.95)' }}>
                    <div style={{ padding: '6px 10px', borderBottom: '1px solid rgba(255,122,69,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 8, color: 'rgba(255,154,112,0.4)', fontFamily: 'monospace' }}>floor</span>
                      <div style={{ display: 'flex', gap: 3 }}>
                        {['#22c55e', '#ef4444', '#f59e0b'].map(c => <div key={c} style={{ width: 5, height: 5, borderRadius: '50%', background: c, opacity: 0.7 }} />)}
                      </div>
                    </div>
                    <div style={{ padding: 8 }}>
                      <svg viewBox="0 0 120 70" style={{ width: '100%' }}>
                        {[[20, 35, 12, '#22c55e'], [50, 25, 14, '#ef4444'], [80, 35, 12, '#ef4444'], [100, 50, 10, '#f59e0b']].map(([cx, cy, r, c], i) => (
                          <g key={i}>
                            <circle cx={cx} cy={cy} r={r} fill={`${c}22`} stroke={c} strokeWidth="1.5" opacity="0.8" />
                            <text x={cx} y={cy + 3} textAnchor="middle" fill={c} fontSize="6" fontWeight="bold">T{i + 1}</text>
                          </g>
                        ))}
                      </svg>
                    </div>
                  </div>
                </div>
              </a>
            </Reveal>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════
            PLANIT EVENTS SECTION
        ══════════════════════════════════════════════════════ */}
        <section
          id="planit-events"
          role="region"
          aria-label="PlanIt Events"
          style={{ display: selectedBranch === 'events' ? 'block' : 'none', position: 'relative', overflow: 'hidden', background: 'var(--bg-surface)' }}
        >
          {/* Top border */}
          <div style={{ height: 2, background: 'linear-gradient(90deg, transparent, rgba(124,125,255,0.15) 20%, rgba(124,125,255,0.5) 50%, rgba(124,125,255,0.15) 80%, transparent)' }} />

          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(circle at 80% 20%, rgba(124,125,255,0.04) 0%, transparent 50%), radial-gradient(circle at 15% 70%, rgba(124,125,255,0.03) 0%, transparent 40%)' }} />

          {/* Page header */}
          <div style={{ maxWidth: 1280, margin: '0 auto', padding: '64px 24px 0' }}>
            <Reveal>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Calendar size={16} color="rgba(255,255,255,0.6)" />
                </div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.25em', color: 'rgba(255,255,255,0.25)' }}>{isWL ? '' : 'PlanIt'}</div>
                  <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 16, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1 }}>Events</div>
                </div>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)', marginLeft: 8 }} />
                <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'rgba(255,255,255,0.2)' }}>Branch 01</span>
              </div>
            </Reveal>
          </div>

          {/* Hero headline */}
          <div style={{ maxWidth: 1280, margin: '0 auto', padding: '48px 24px 80px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 80, alignItems: 'center' }} className="grid-cols-1 lg:grid-cols-2">
              <Reveal>
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'rgba(255,255,255,0.35)', marginBottom: 20 }}>
                  For event teams who actually have a lot going on
                </p>
                <h2 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 'clamp(2rem,4.5vw,3.8rem)', lineHeight: 0.93, letterSpacing: '-0.04em', color: '#fff', marginBottom: 28 }}>
                  Everything your<br />team needs.<br />
                  <span style={{ color: 'rgba(255,255,255,0.28)' }}>Nothing you don't.</span>
                </h2>
                <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.45)', lineHeight: 1.75, marginBottom: 36, maxWidth: 420 }}>
                  From 6 months out to the final wrap-up. {isWL ? (wlName || 'Your platform') : 'PlanIt Events'} is the workspace for the whole team — organizers, vendors, volunteers, everyone.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <a href="#create" style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '11px 22px',
                    borderRadius: 12, fontSize: 13, fontWeight: 700, background: '#fff', color: '#09090b',
                    textDecoration: 'none', transition: 'transform 0.15s, box-shadow 0.15s',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                  }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(0,0,0,0.4)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.3)'; }}
                  >
                    Start planning free <ArrowRight size={13} />
                  </a>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>No credit card · No account needed</span>
                </div>
              </Reveal>

              {/* Workspace mockup */}
              <Reveal delay={100}>
                <div style={{ borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden', background: 'rgba(10,10,20,0.96)' }}>
                  {/* Chrome */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(8,8,16,0.98)' }}>
                    <div style={{ display: 'flex', gap: 5 }}>
                      {['#404040', '#404040', '#404040'].map((c, i) => <div key={i} style={{ width: 9, height: 9, borderRadius: '50%', background: c }} />)}
                    </div>
                    <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 12px', borderRadius: 7, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981', animation: 'pulse-dot 2s infinite' }} />
                        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace' }}>Summer Gala 2026</span>
                      </div>
                    </div>
                  </div>
                  {/* Two-panel layout */}
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 3fr', minHeight: 300, divideX: '1px solid rgba(255,255,255,0.07)' }}>
                    {/* Sidebar */}
                    <div style={{ padding: 14, borderRight: '1px solid rgba(255,255,255,0.07)' }}>
                      {[['Chat', true], ['Tasks', false], ['Guests', false], ['Polls', false], ['Budget', false]].map(([label, active]) => (
                        <div key={label} style={{
                          display: 'flex', alignItems: 'center', gap: 7, padding: '7px 10px', borderRadius: 8, marginBottom: 2,
                          background: active ? 'rgba(255,255,255,0.06)' : 'transparent',
                          fontSize: 11, fontWeight: 600, color: active ? '#fff' : 'rgba(255,255,255,0.3)',
                          cursor: 'pointer',
                        }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', flexShrink: 0, background: active ? 'rgba(255,255,255,0.5)' : '#2a2a3a' }} />
                          {label}
                        </div>
                      ))}
                    </div>
                    {/* Chat panel */}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                        <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.3)' }}># planning-team</span>
                      </div>
                      <div style={{ flex: 1, padding: '12px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {[{ avatar: 'A', color: '#7c7dff', name: 'Alex', msg: 'Venue deposit confirmed ✓' },
                          { avatar: 'S', color: '#60a5fa', name: 'Sam', msg: 'Floor plan uploaded to files' },
                          { self: true, msg: 'On it! Creating checklist now' }].map((m, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, justifyContent: m.self ? 'flex-end' : 'flex-start' }}>
                            {!m.self && (
                              <div style={{ width: 20, height: 20, borderRadius: '50%', background: `${m.color}30`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, fontWeight: 700, color: m.color }}>
                                {m.avatar}
                              </div>
                            )}
                            <div>
                              {!m.self && <div style={{ fontSize: 8, fontWeight: 700, color: m.color, marginBottom: 3 }}>{m.name}</div>}
                              <div style={{ fontSize: 9, color: m.self ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.5)', background: m.self ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.05)', padding: '5px 8px', borderRadius: m.self ? '8px 8px 2px 8px' : '2px 8px 8px 8px' }}>
                                {m.msg}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* Typing */}
                      <div style={{ padding: '0 12px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '6px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                          <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.25)' }}>Alex is typing</span>
                          <div style={{ display: 'flex', gap: 2 }}>
                            {[0, 0.15, 0.3].map((d, i) => <div key={i} className="typing-dot" style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,0.35)', animationDelay: `${d}s` }} />)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>

          {/* FEATURES GRID — Events */}
          <div
            id="features"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
            role="region"
            aria-label="Events features"
          >
            <div style={{ maxWidth: 1280, margin: '0 auto', padding: '64px 24px' }}>
              <Reveal style={{ marginBottom: 40 }}>
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>What's included</p>
                <h3 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 'clamp(1.4rem,3vw,2.2rem)', fontWeight: 800, letterSpacing: '-0.03em', color: '#fff' }}>
                  Every tool. One workspace.
                </h3>
              </Reveal>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px,1fr))', gap: 12 }}>
                {[
                  { icon: MessageSquare, label: 'Real-time team chat', desc: 'Typing indicators, reactions, threads. Your team stays in sync, always.', color: '#7c7dff' },
                  { icon: ListChecks, label: 'Task management', desc: 'Assign tasks, set deadlines, track completion down to the wire.', color: '#10b981' },
                  { icon: BarChart3, label: 'Polls & voting', desc: 'Vote on venues, dates, menus. Live results update instantly.', color: '#f59e0b' },
                  { icon: FileText, label: 'File sharing', desc: 'Contracts, floor plans, schedules — all in one organized place.', color: '#60a5fa' },
                  { icon: Users, label: 'Unlimited team', desc: 'No caps. Every organizer, vendor, and volunteer is included free.', color: '#c084fc' },
                  { icon: QrCode, label: 'QR check-in', desc: 'Professional guest check-in with real-time attendance tracking.', color: '#34d399' },
                ].map((f, i) => (
                  <Reveal key={f.label} delay={i * 50}>
                    <div
                      className="card-lift feature-card-events"
                      style={{ padding: '22px 20px', borderRadius: 16, background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', height: '100%' }}
                    >
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: `${f.color}14`, border: `1px solid ${f.color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                        <f.icon size={16} color={f.color} />
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 6 }}>{f.label}</div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', lineHeight: 1.7 }}>{f.desc}</div>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>

          {/* Enterprise strip */}
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ maxWidth: 1280, margin: '0 auto', padding: '40px 24px' }}>
              <Reveal>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '24px 28px', borderRadius: 18, border: '1px solid rgba(124,125,255,0.15)', background: 'rgba(124,125,255,0.04)', alignItems: 'flex-start' }} className="sm:flex-row sm:items-center sm:justify-between">
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, border: '1px solid rgba(124,125,255,0.2)', background: 'rgba(124,125,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Zap size={18} color="#a5b4fc" />
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Enterprise Mode</div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', lineHeight: 1.6, maxWidth: 480 }}>
                        Personalized QR invites, check-in dashboard, real-time attendance analytics. For 100+ guest events.
                      </div>
                    </div>
                  </div>
                  <a href="#create" style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 18px', borderRadius: 10, fontSize: 12, fontWeight: 700,
                    border: '1px solid rgba(124,125,255,0.25)', background: 'rgba(124,125,255,0.1)', color: '#a5b4fc',
                    textDecoration: 'none', whiteSpace: 'nowrap', transition: 'border-color 0.2s, background 0.2s',
                    flexShrink: 0,
                  }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(124,125,255,0.5)'; e.currentTarget.style.background = 'rgba(124,125,255,0.2)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(124,125,255,0.25)'; e.currentTarget.style.background = 'rgba(124,125,255,0.1)'; }}
                  >
                    Set up Enterprise <ArrowRight size={13} />
                  </a>
                </div>
              </Reveal>
            </div>
          </div>

          <div style={{ height: 2, background: 'linear-gradient(90deg, transparent, rgba(124,125,255,0.08) 20%, rgba(124,125,255,0.2) 50%, rgba(124,125,255,0.08) 80%, transparent)' }} />
        </section>

        {/* ══════════════════════════════════════════════════════
            BRANCH DIVIDER
        ══════════════════════════════════════════════════════ */}
        <div style={{ display: selectedBranch ? 'none' : 'flex', justifyContent: 'center', padding: '40px 24px', background: 'var(--bg-base)', position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 50%, rgba(255,122,69,0.03) 0%, transparent 60%)', pointerEvents: 'none' }} />
          <Reveal>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ height: 1, width: 48, background: 'rgba(255,255,255,0.07)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 20px', borderRadius: 99, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'rgba(255,255,255,0.25)' }}>
                  <Calendar size={11} /> Events
                </div>
                <div style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,0.15)' }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'rgba(255,255,255,0.25)' }}>
                  <UtensilsCrossed size={11} /> Venue
                </div>
              </div>
              <div style={{ height: 1, width: 48, background: 'rgba(255,255,255,0.07)' }} />
            </div>
          </Reveal>
        </div>

        {/* ══════════════════════════════════════════════════════
            PLANIT VENUE SECTION
        ══════════════════════════════════════════════════════ */}
        <section
          id="planit-venue"
          role="region"
          aria-label="PlanIt Venue"
          style={{ display: selectedBranch === 'venue' ? 'block' : 'none', position: 'relative', overflow: 'hidden', background: 'var(--bg-venue)' }}
        >
          <div style={{ height: 2, background: 'linear-gradient(90deg, transparent, rgba(255,122,69,0.15) 20%, rgba(255,122,69,0.5) 50%, rgba(255,122,69,0.15) 80%, transparent)' }} />
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(circle at 85% 40%, rgba(255,122,69,0.05) 0%, transparent 50%), radial-gradient(circle at 15% 80%, rgba(234,88,12,0.025) 0%, transparent 40%)' }} />

          {/* Page header */}
          <div style={{ maxWidth: 1280, margin: '0 auto', padding: '64px 24px 0' }}>
            <Reveal>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 6 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,122,69,0.1)', border: '1px solid rgba(255,122,69,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <UtensilsCrossed size={16} color="#ff9a70" />
                </div>
                <div>
                  <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.25em', color: 'rgba(255,122,69,0.35)' }}>PlanIt</div>
                  <div style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 16, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em', lineHeight: 1 }}>Venue</div>
                </div>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,122,69,0.1)', marginLeft: 8 }} />
                <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'rgba(255,122,69,0.25)' }}>Branch 02</span>
              </div>
            </Reveal>
          </div>

          {/* Venue hero */}
          <div style={{ maxWidth: 1280, margin: '0 auto', padding: '48px 24px 80px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 80, alignItems: 'center' }} className="grid-cols-1 lg:grid-cols-2">
              <Reveal>
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'rgba(255,122,69,0.4)', marginBottom: 20 }}>
                  For restaurants that run a real floor every night
                </p>
                <h2 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 'clamp(2rem,4.5vw,3.8rem)', lineHeight: 0.93, letterSpacing: '-0.04em', color: '#fff', marginBottom: 28 }}>
                  Run your floor.<br />Know your wait.<br />
                  <span style={{ color: 'rgba(255,122,69,0.45)' }}>Seat every table.</span>
                </h2>
                <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.4)', lineHeight: 1.75, marginBottom: 36, maxWidth: 420 }}>
                  Live table states. Walk-in waitlist with a public wait board guests scan at the door. One-tap seating. Your floor data never expires.
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <a href="#create"
                    onClick={() => setTimeout(() => document.querySelector('[data-mode="table-service"]')?.click(), 100)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 7, padding: '11px 22px',
                      borderRadius: 12, fontSize: 13, fontWeight: 700, background: '#ff7a45', color: '#fff',
                      textDecoration: 'none', transition: 'transform 0.15s, box-shadow 0.15s',
                      boxShadow: '0 4px 20px rgba(255,122,69,0.25)',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(255,122,69,0.35)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 4px 20px rgba(255,122,69,0.25)'; }}
                  >
                    Set up your venue <ArrowRight size={13} />
                  </a>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>Free · Data never expires</span>
                </div>
              </Reveal>

              {/* Floor map mockup */}
              <Reveal delay={100}>
                <div style={{ borderRadius: 20, border: '1px solid rgba(255,122,69,0.12)', overflow: 'hidden', background: 'rgba(12,9,5,0.97)' }}>
                  {/* App chrome */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: '1px solid rgba(255,122,69,0.08)', background: 'rgba(10,7,3,0.99)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 22, height: 22, borderRadius: 7, border: '1px solid rgba(255,122,69,0.18)', background: 'rgba(255,122,69,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <UtensilsCrossed size={11} color="#ff9a70" />
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>Taverna Roma</span>
                      <span style={{ fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(255,154,112,0.35)' }}>PlanIt Venue</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {[['#22c55e', '3 Free'], ['#ef4444', '4 Occ'], ['#8b5cf6', '1 Cln']].map(([c, l]) => (
                        <span key={l} style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 6, background: 'rgba(255,255,255,0.04)', fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: c, display: 'inline-block' }} />{l}
                        </span>
                      ))}
                    </div>
                  </div>
                  {/* Floor plan */}
                  <div style={{ padding: 16 }}>
                    <svg viewBox="0 0 520 260" style={{ width: '100%', height: 200 }}>
                      <defs>
                        <pattern id="venue-grid" width="28" height="28" patternUnits="userSpaceOnUse">
                          <path d="M 28 0 L 0 0 0 28" fill="none" stroke="rgba(255,122,69,0.035)" strokeWidth="0.5" />
                        </pattern>
                      </defs>
                      <rect width="520" height="260" fill="url(#venue-grid)" />
                      <rect x="18" y="10" width="155" height="90" rx="8" fill="rgba(255,122,69,0.015)" stroke="rgba(255,122,69,0.07)" strokeDasharray="6 3" />
                      <text x="95" y="58" textAnchor="middle" fill="rgba(255,122,69,0.18)" fontSize="11" fontWeight="700" letterSpacing="2">MAIN ROOM</text>
                      {[
                        { x: 65,  y: 155, r: 26, status: 'available', label: 'T1', cap: '4' },
                        { x: 145, y: 155, r: 26, status: 'occupied',  label: 'T2', cap: '4', time: '38m' },
                        { x: 215, y: 135, r: 30, status: 'occupied',  label: 'T3', cap: '6', time: '19m' },
                        { x: 300, y: 155, r: 26, status: 'cleaning',  label: 'T4', cap: '4' },
                        { x: 370, y: 135, r: 30, status: 'available', label: 'T5', cap: '6' },
                        { x: 455, y: 155, r: 26, status: 'reserved',  label: 'T6', cap: '4' },
                      ].map(t => {
                        const c = t.status === 'available' ? '#22c55e' : t.status === 'occupied' ? '#ef4444' : t.status === 'cleaning' ? '#8b5cf6' : '#f59e0b';
                        const pulse = t.status === 'available';
                        return (
                          <g key={t.label}>
                            <circle cx={t.x} cy={t.y} r={t.r + 4} fill="none" stroke={c} strokeWidth="1.5" opacity={pulse ? undefined : '0.4'} className={pulse ? 'table-ring' : ''} />
                            <circle cx={t.x} cy={t.y} r={t.r} fill={`${c}16`} stroke={c} strokeWidth="1" />
                            <text x={t.x} y={t.y - 3} textAnchor="middle" fill="rgba(255,255,255,0.9)" fontSize="9" fontWeight="800">{t.label}</text>
                            <text x={t.x} y={t.y + 8} textAnchor="middle" fill={c} fontSize="8">{t.cap}</text>
                            {t.time && <text x={t.x + t.r - 2} y={t.y - t.r + 4} textAnchor="middle" fill="white" fontSize="7.5" fontWeight="700" opacity="0.8">{t.time}</text>}
                          </g>
                        );
                      })}
                      <rect x="18" y="178" width="130" height="60" rx="8" fill="rgba(245,158,11,0.05)" stroke="rgba(245,158,11,0.16)" />
                      <text x="30" y="196" fill="#f59e0b" fontSize="8" fontWeight="800" letterSpacing="1">WAITLIST</text>
                      <text x="90" y="196" fill="rgba(245,158,11,0.5)" fontSize="8" fontWeight="700">·3</text>
                      <text x="30" y="212" fill="rgba(255,255,255,0.35)" fontSize="8">Martinez · 4 · ~14m</text>
                      <text x="30" y="226" fill="rgba(255,255,255,0.35)" fontSize="8">Taylor · 2 · ~8m</text>
                    </svg>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>

          {/* FEATURES GRID — Venue */}
          <div style={{ borderTop: '1px solid rgba(255,122,69,0.06)' }} role="region" aria-label="Venue features">
            <div style={{ maxWidth: 1280, margin: '0 auto', padding: '64px 24px' }}>
              <Reveal style={{ marginBottom: 40 }}>
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.18em', color: 'rgba(255,122,69,0.35)', marginBottom: 8 }}>What's included</p>
                <h3 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 'clamp(1.4rem,3vw,2.2rem)', fontWeight: 800, letterSpacing: '-0.03em', color: '#fff' }}>
                  Your whole floor, in one screen.
                </h3>
              </Reveal>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px,1fr))', gap: 12 }}>
                {[
                  { icon: Layers,       label: 'Visual floor editor',  desc: 'Drag tables to match your exact layout. Zones, shapes, labels.', color: '#ff9a70' },
                  { icon: Users,        label: 'Walk-in waitlist',     desc: 'Add parties instantly. Estimated wait times update as tables clear.', color: '#f59e0b' },
                  { icon: QrCode,       label: 'Public wait board',    desc: 'Guests scan the door QR, see the queue, and join from their phone.', color: '#a78bfa' },
                  { icon: MapPin,       label: 'Live sync',            desc: 'Every status update hits all staff screens in real time.', color: '#34d399' },
                  { icon: CheckCircle2, label: 'One-tap seat next',    desc: 'Auto-picks the tightest-fit table and seats the next waiting party.', color: '#60a5fa' },
                  { icon: Clock,        label: 'Data never expires',   desc: 'Your floor plan and history persist forever. No cleanup, no resets.', color: '#fb7185' },
                ].map((f, i) => (
                  <Reveal key={f.label} delay={i * 50}>
                    <div
                      className="card-lift feature-card-venue"
                      style={{ padding: '22px 20px', borderRadius: 16, background: 'rgba(255,122,69,0.02)', border: '1px solid rgba(255,122,69,0.08)', height: '100%' }}
                    >
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: `${f.color}14`, border: `1px solid ${f.color}28`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                        <f.icon size={16} color={f.color} />
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 6 }}>{f.label}</div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', lineHeight: 1.7 }}>{f.desc}</div>
                    </div>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>

          <div style={{ height: 2, background: 'linear-gradient(90deg, transparent, rgba(255,122,69,0.08) 20%, rgba(255,122,69,0.25) 50%, rgba(255,122,69,0.08) 80%, transparent)' }} />
        </section>

        {/* ══════════════════════════════════════════════════════
            TESTIMONIALS
        ══════════════════════════════════════════════════════ */}
        <section
          style={{ display: selectedBranch ? 'block' : 'none', padding: '96px 24px', borderTop: '1px solid rgba(255,255,255,0.06)' }}
          aria-label="Testimonials"
        >
          <div style={{ maxWidth: 1280, margin: '0 auto' }}>
            <Reveal style={{ textAlign: 'center', marginBottom: 56 }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.28)', marginBottom: 12 }}>Testimonials</p>
              <h2 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 'clamp(1.8rem,4vw,3rem)', letterSpacing: '-0.04em', color: '#fff', marginBottom: 14 }}>
                Trusted by event planners
              </h2>
              <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.38)', maxWidth: 480, margin: '0 auto' }}>
                See how teams use PlanIt to execute flawless events
              </p>
            </Reveal>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px,1fr))', gap: 16 }}>
              <TestimonialCard
                quote="PlanIt transformed how we coordinated our annual company conference. The task management kept our 15-person planning team organized for 6 months of prep. The QR check-in on event day was seamless for 300 attendees."
                author="Michael Chen" role="Senior Event Coordinator" event="Tech Summit 2025" delay={0}
              />
              <TestimonialCard
                quote="As a wedding planner, I've used every tool out there. PlanIt stands out because it doesn't require my couples or vendors to create accounts. We used it for 4 months of planning without a single friction point."
                author="Sarah Williams" role="Lead Wedding Planner" event="Williams-Martinez Wedding" delay={100}
              />
              <TestimonialCard
                quote="Our nonprofit used PlanIt to coordinate a 500-person fundraising gala. The unlimited participant feature meant we could include our entire board, 30 volunteers, all vendors, and staff — all in one workspace."
                author="David Martinez" role="Development Director" event="Charity Gala 2025" delay={200}
              />
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════
            DISCOVER + STATUS CARDS
        ══════════════════════════════════════════════════════ */}
        <section
          style={{ display: selectedBranch ? 'block' : 'none', padding: '0 24px 96px', borderTop: '1px solid rgba(255,255,255,0.06)' }}
          aria-label="Explore more"
        >
          <div style={{ maxWidth: 1280, margin: '0 auto', paddingTop: 96 }}>
            <Reveal style={{ textAlign: 'center', marginBottom: 48 }}>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.28)', marginBottom: 12 }}>Explore more</p>
              <h2 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 'clamp(1.8rem,4vw,3rem)', letterSpacing: '-0.04em', color: '#fff', marginBottom: 12 }}>
                Everything you need
              </h2>
              <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.38)', maxWidth: 380, margin: '0 auto' }}>
                Find public events and check service health — all in one place.
              </p>
            </Reveal>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px,1fr))', gap: 16 }}>
              {/* Discover */}
              <Reveal delay={0}>
                <a href="/discover" style={{ display: 'block', padding: '32px 32px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)', overflow: 'hidden', position: 'relative', textDecoration: 'none', transition: 'border-color 0.3s, transform 0.3s', height: '100%' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)'; e.currentTarget.style.transform = 'translateY(-3px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.transform = ''; }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at top left, rgba(80,60,200,0.08) 0%, transparent 65%)', pointerEvents: 'none' }} />
                  <div style={{ position: 'relative' }}>
                    <div style={{ width: 48, height: 48, borderRadius: 14, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                      <Zap size={22} color="rgba(255,255,255,0.6)" />
                    </div>
                    <h3 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em', marginBottom: 10 }}>Discover Events</h3>
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.7, marginBottom: 24 }}>Browse public events happening right now. Find meetups, workshops, and gatherings open to everyone.</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>
                      Browse events <ArrowUpRight size={14} />
                    </div>
                  </div>
                </a>
              </Reveal>

              {/* Status */}
              <Reveal delay={80}>
                <a href="/status" style={{ display: 'block', padding: '32px 32px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)', overflow: 'hidden', position: 'relative', textDecoration: 'none', transition: 'border-color 0.3s, transform 0.3s', height: '100%' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)'; e.currentTarget.style.transform = 'translateY(-3px)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.transform = ''; }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at top right, rgba(20,180,80,0.06) 0%, transparent 65%)', pointerEvents: 'none' }} />
                  <div style={{ position: 'relative' }}>
                    <div style={{ width: 48, height: 48, borderRadius: 14, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                      <TrendingUp size={22} color="rgba(255,255,255,0.6)" />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                      <h3 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' }}>System Status</h3>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 99, fontSize: 10, fontWeight: 700, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#34d399' }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981', display: 'inline-block', animation: 'pulse-dot 2s ease-in-out infinite' }} />
                        Operational
                      </span>
                    </div>
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.7, marginBottom: 24 }}>Monitor real-time uptime, API performance, and incident history. Stay informed about service health.</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.5)' }}>
                      View status <ArrowUpRight size={14} />
                    </div>
                  </div>
                </a>
              </Reveal>
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════
            CREATE / PRICING SECTION
        ══════════════════════════════════════════════════════ */}
        <section
          id="create"
          role="region"
          aria-label="Create event or venue"
          style={{
            borderTop: '1px solid rgba(255,255,255,0.06)',
            background: 'var(--bg-base)',
            position: 'relative',
          }}
        >
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(circle at 50% 0%, rgba(124,125,255,0.04) 0%, transparent 55%)' }} />

          <div style={{ maxWidth: 1280, margin: '0 auto', padding: '80px 24px', display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 80, alignItems: 'start', position: 'relative', zIndex: 1 }} className="grid-cols-1 lg:grid-cols-2">

            {/* Left: info */}
            <div>
              <Reveal>
                <div style={{ marginBottom: 40 }}>
                  <h2 style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800, fontSize: 'clamp(2rem,4vw,3.4rem)', letterSpacing: '-0.04em', lineHeight: 0.95, color: '#fff', marginBottom: 18 }}>
                    {created
                      ? isVenue ? 'Venue created!' : 'Event created!'
                      : isVenue ? 'Set up your venue' : 'Start planning your event'}
                  </h2>
                  <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.42)', lineHeight: 1.75 }}>
                    {created
                      ? isVenue
                        ? 'Your floor management system is live. Set up your seating layout and go.'
                        : 'Your planning hub is ready. Share the link with your team and get started.'
                      : isVenue
                        ? 'Create your restaurant workspace in 60 seconds. Your data never expires.'
                        : 'Create your event workspace in 60 seconds. No credit card, no hassle, just start planning.'}
                  </p>
                </div>
              </Reveal>

              {!created && (
                <>
                  <Reveal delay={80}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 32 }}>
                      {[{ icon: Clock, label: '60 seconds' }, { icon: Shield, label: 'Secure' }, { icon: CheckCircle2, label: 'Free forever' }].map(item => (
                        <div key={item.label} style={{ textAlign: 'center', padding: '18px 12px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.025)', transition: 'border-color 0.2s, transform 0.2s', cursor: 'default' }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.transform = ''; }}>
                          <item.icon size={20} color="rgba(255,255,255,0.4)" style={{ margin: '0 auto 8px' }} />
                          <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textAlign: 'center' }}>{item.label}</p>
                        </div>
                      ))}
                    </div>
                  </Reveal>

                  <Reveal delay={120}>
                    <div style={{ padding: '24px 24px', borderRadius: 18, border: `1px solid ${isVenue ? 'rgba(255,122,69,0.12)' : 'rgba(255,255,255,0.07)'}`, background: `${isVenue ? 'rgba(255,122,69,0.025)' : 'rgba(255,255,255,0.025)'}` }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                        Everything included {isVenue ? 'in Table Service:' : ':'}
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {(isVenue
                          ? ['Visual floor plan editor — drag & drop tables anywhere', 'Live table states: available, occupied, cleaning, reserved', 'Walk-in waitlist with real-time estimated wait times', 'QR code reservations with configurable expiry windows', 'Per-restaurant timing config: dining duration, buffer, hours', 'Instant sync across all staff devices via live socket', 'Data never auto-deleted — your floor plan persists forever', 'Party size tracking and server assignment per table', 'Occupancy overview and turn time estimates at a glance']
                          : ['Private event space with custom branded URL', 'Unlimited team members, no caps', 'Real-time chat with file sharing', 'Task lists and deadline tracking', 'Polls, voting, and decision tools', 'RSVP management and tracking', 'Expense splitting and budgets', 'QR check-in for large events', 'Timeline and scheduling tools']
                        ).map((item, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
                            <CheckCircle2 size={14} color={isVenue ? '#ff9a70' : '#34d399'} style={{ flexShrink: 0, marginTop: 1 }} />
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  </Reveal>
                </>
              )}

              {created && (
                <Reveal delay={80}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40, borderRadius: 20, border: '1px solid rgba(16,185,129,0.2)', background: 'rgba(16,185,129,0.06)' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 8px 32px rgba(16,185,129,0.35)', animation: 'bounce-y 1.2s ease-in-out infinite' }}>
                          <Check size={32} color="#fff" />
                        </div>
                        <p style={{ fontSize: 16, fontWeight: 700, color: '#34d399' }}>
                          {isVenue ? 'Venue created!' : mode === 'enterprise' ? 'Enterprise event created!' : 'Your planning hub is live!'}
                        </p>
                      </div>
                    </div>

                    {isVenue && (
                      <div style={{ padding: '24px 24px', borderRadius: 18, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                          <UtensilsCrossed size={18} color="#ff9a70" style={{ flexShrink: 0, marginTop: 2 }} />
                          <div style={{ width: '100%' }}>
                            <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 14 }}>Your venue is live!</p>
                            {formData.staffPassword && (
                              <div style={{ marginBottom: 14, padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                                <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>Default staff login</p>
                                {[['Username', 'staff'], ['Password', formData.staffPassword]].map(([k, v]) => (
                                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{k}</span>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>{v}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            <ol style={{ listStyle: 'decimal', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
                              <li>Open your floor dashboard and click "Edit Layout"</li>
                              <li>Drag and drop tables to match your restaurant's floor plan</li>
                              <li>Set each table's capacity and label</li>
                              <li>Open Settings to configure dining time and operating hours</li>
                              <li>Staff log in at <code style={{ color: 'rgba(255,255,255,0.35)' }}>/login</code> and go straight to the floor</li>
                            </ol>
                          </div>
                        </div>
                      </div>
                    )}

                    {!isVenue && created && (
                      <div style={{ padding: '24px 24px', borderRadius: 18, border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.03)' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                          <Calendar size={18} color="rgba(255,255,255,0.5)" style={{ flexShrink: 0, marginTop: 2 }} />
                          <div style={{ width: '100%' }}>
                            <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 12 }}>Your event is live!</p>
                            <ol style={{ listStyle: 'decimal', paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
                              <li>Copy the link below and share it with your planning team</li>
                              <li>Add tasks and assign them to team members</li>
                              <li>Enable RSVP in Event Settings to start collecting responses</li>
                              <li>Use QR check-in on event day for seamless guest management</li>
                            </ol>
                          </div>
                        </div>
                      </div>
                    )}

                    <CopyLinkBox eventId={created._id || created.id} subdomain={created.subdomain} mode={mode} />

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <a href={`/e/${created.subdomain || created._id || created.id}`} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '13px 0', borderRadius: 12,
                        fontSize: 14, fontWeight: 700, background: '#fff', color: '#09090b', textDecoration: 'none',
                        transition: 'transform 0.15s',
                      }}
                        onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                        onMouseLeave={e => e.currentTarget.style.transform = ''}>
                        Open your {isVenue ? 'venue' : 'event'} <ArrowRight size={14} />
                      </a>
                    </div>
                  </div>
                </Reveal>
              )}
            </div>

            {/* Right: form */}
            <div>
              {!created && (
                <Reveal delay={60}>
                  {/* Mode selector */}
                  {!isWL && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 24 }}>
                      {[
                        { value: 'standard', label: 'Standard Event', sub: 'Any event, free', icon: <Calendar size={14} />, color: '#7c7dff' },
                        { value: 'enterprise', label: 'Enterprise Event', sub: 'QR invites, analytics', icon: <Zap size={14} />, color: '#a5b4fc' },
                        { value: 'table-service', label: 'Restaurant Venue', sub: 'Floor management', icon: <UtensilsCrossed size={14} />, color: '#ff9a70' },
                      ].slice(0, 2).map(opt => (
                        <button key={opt.value} data-mode={opt.value} onClick={() => setMode(opt.value)} style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 14,
                          border: `1px solid ${mode === opt.value ? `${opt.color}40` : 'rgba(255,255,255,0.07)'}`,
                          background: mode === opt.value ? `${opt.color}0d` : 'rgba(255,255,255,0.025)',
                          cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left',
                        }}>
                          <div style={{ color: mode === opt.value ? opt.color : 'rgba(255,255,255,0.3)', transition: 'color 0.2s' }}>{opt.icon}</div>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: mode === opt.value ? '#fff' : 'rgba(255,255,255,0.5)' }}>{opt.label}</div>
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>{opt.sub}</div>
                          </div>
                        </button>
                      ))}
                      <button key="table-service" data-mode="table-service" onClick={() => setMode('table-service')} style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 14,
                        border: `1px solid ${mode === 'table-service' ? 'rgba(255,154,112,0.35)' : 'rgba(255,255,255,0.07)'}`,
                        background: mode === 'table-service' ? 'rgba(255,122,69,0.07)' : 'rgba(255,255,255,0.025)',
                        cursor: 'pointer', transition: 'all 0.2s', textAlign: 'left', gridColumn: 'span 2',
                      }}>
                        <div style={{ color: mode === 'table-service' ? '#ff9a70' : 'rgba(255,255,255,0.3)', transition: 'color 0.2s' }}><UtensilsCrossed size={14} /></div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: mode === 'table-service' ? '#fff' : 'rgba(255,255,255,0.5)' }}>Restaurant Venue</div>
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>Floor management</div>
                        </div>
                      </button>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    {/* Title */}
                    <div>
                      <label style={labelStyle}>
                        <span style={labelIconStyle}>
                          {isVenue ? <UtensilsCrossed size={13} color="rgba(255,255,255,0.4)" /> : <Calendar size={13} color="rgba(255,255,255,0.4)" />}
                          {isVenue ? 'Restaurant Name' : 'Event Title'} <span style={{ color: '#f87171' }}>*</span>
                        </span>
                      </label>
                      <input
                        type="text" required
                        className={`dark-input ${fieldErrors.title ? 'border-red-500' : ''}`}
                        placeholder={isVenue ? 'e.g. Bella Taverna' : 'e.g. Annual Leadership Summit 2026'}
                        value={formData.title}
                        onChange={e => { handleTitleChange(e); setFieldErrors(p => ({ ...p, title: '' })); }}
                        style={fieldErrors.title ? { borderColor: '#ef4444' } : {}}
                      />
                      {fieldErrors.title && <p className="field-error" style={errorStyle}><AlertCircle size={11} />{fieldErrors.title}</p>}
                    </div>

                    {/* Custom URL */}
                    <div>
                      <label style={labelStyle}>
                        <span style={labelIconStyle}>
                          <Link size={13} color="rgba(255,255,255,0.4)" />
                          {isVenue ? 'Venue URL' : 'Event URL'} <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, fontWeight: 400 }}>(auto-generated)</span>
                        </span>
                      </label>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'rgba(255,255,255,0.2)', pointerEvents: 'none', fontFamily: 'monospace' }}>
                          {window.location.origin}/e/
                        </span>
                        <input
                          type="text" className="dark-input" placeholder="your-event-slug"
                          value={formData.subdomain}
                          onChange={e => { update('subdomain')(e); setFieldErrors(p => ({ ...p, subdomain: '' })); }}
                          style={{ paddingLeft: `${window.location.origin.length * 7.8 + 28}px`, fontFamily: 'monospace', fontSize: 12 }}
                        />
                      </div>
                    </div>

                    {/* Description */}
                    <div>
                      <label style={labelStyle}>
                        <span style={labelIconStyle}>
                          <FileText size={13} color="rgba(255,255,255,0.4)" />
                          Description <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, fontWeight: 400 }}>(optional)</span>
                        </span>
                      </label>
                      <textarea
                        className="dark-input" rows={2}
                        placeholder={isVenue ? 'A note about your restaurant…' : 'A brief description of your event…'}
                        value={formData.description}
                        onChange={update('description')}
                        style={{ resize: 'vertical', minHeight: 64 }}
                      />
                    </div>

                    {/* Date + Timezone (events only) */}
                    {!isVenue && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div>
                          <label style={labelStyle}>
                            <span style={labelIconStyle}><Clock size={13} color="rgba(255,255,255,0.4)" />Date &amp; Time <span style={{ color: '#f87171' }}>*</span></span>
                          </label>
                          <input type="datetime-local" required className="dark-input" value={formData.date}
                            onChange={e => { update('date')(e); setFieldErrors(p => ({ ...p, date: '' })); }}
                            style={fieldErrors.date ? { borderColor: '#ef4444' } : {}} />
                          {fieldErrors.date && <p className="field-error" style={errorStyle}><AlertCircle size={11} />{fieldErrors.date}</p>}
                        </div>
                        <div>
                          <label style={labelStyle}>
                            <span style={labelIconStyle}><Clock size={13} color="rgba(255,255,255,0.4)" />Timezone <span style={{ color: '#f87171' }}>*</span></span>
                          </label>
                          <select className="dark-input" value={formData.timezone}
                            onChange={e => { update('timezone')(e); setFieldErrors(p => ({ ...p, timezone: '' })); }}
                            style={fieldErrors.timezone ? { borderColor: '#ef4444' } : {}}>
                            {timezoneOptions.map(tz => (
                              <option key={tz.value} value={tz.value}>{tz.label}</option>
                            ))}
                          </select>
                          {fieldErrors.timezone && <p className="field-error" style={errorStyle}><AlertCircle size={11} />{fieldErrors.timezone}</p>}
                        </div>
                      </div>
                    )}

                    {/* Location */}
                    <div>
                      <label style={labelStyle}>
                        <span style={labelIconStyle}>
                          <MapPin size={13} color="rgba(255,255,255,0.4)" />
                          Location <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, fontWeight: 400 }}>(optional)</span>
                        </span>
                      </label>
                      <input type="text" className="dark-input"
                        placeholder={isVenue ? 'Restaurant address…' : 'Address or virtual link…'}
                        value={formData.location} onChange={update('location')} />
                    </div>

                    {/* Organizer name */}
                    <div>
                      <label style={labelStyle}>
                        <span style={labelIconStyle}>
                          <Users size={13} color="rgba(255,255,255,0.4)" />
                          {isVenue ? 'Manager Name' : 'Your Name'} <span style={{ color: '#f87171' }}>*</span>
                        </span>
                      </label>
                      <input type="text" required className="dark-input"
                        placeholder={isVenue ? 'Your name' : 'Full name'}
                        value={formData.organizerName}
                        onChange={e => { update('organizerName')(e); setFieldErrors(p => ({ ...p, organizerName: '' })); }}
                        style={fieldErrors.organizerName ? { borderColor: '#ef4444' } : {}} />
                      {fieldErrors.organizerName && <p className="field-error" style={errorStyle}><AlertCircle size={11} />{fieldErrors.organizerName}</p>}
                    </div>

                    {/* Organizer email */}
                    <div>
                      <label style={labelStyle}>
                        <span style={labelIconStyle}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                          {isVenue ? 'Manager Email' : 'Your Email'} <span style={{ color: '#f87171' }}>*</span>
                        </span>
                      </label>
                      <input type="email" required className="dark-input"
                        placeholder="you@example.com"
                        value={formData.organizerEmail}
                        onChange={e => { update('organizerEmail')(e); setFieldErrors(p => ({ ...p, organizerEmail: '' })); }}
                        style={fieldErrors.organizerEmail ? { borderColor: '#ef4444' } : {}} />
                      {fieldErrors.organizerEmail && <p className="field-error" style={errorStyle}><AlertCircle size={11} />{fieldErrors.organizerEmail}</p>}
                    </div>

                    {/* Account password */}
                    <div>
                      <label style={labelStyle}>
                        <span style={labelIconStyle}>
                          <Lock size={13} color="rgba(255,255,255,0.4)" />
                          {isVenue ? 'Organizer Password' : 'Account Password'} <span style={{ color: '#f87171' }}>*</span>
                        </span>
                      </label>
                      <div style={{ position: 'relative' }}>
                        <input type={showAccountPassword ? 'text' : 'password'} required className="dark-input"
                          placeholder="Create a secure password (min 4 characters)"
                          value={formData.accountPassword} minLength={4}
                          onChange={e => { update('accountPassword')(e); setFieldErrors(p => ({ ...p, accountPassword: '' })); }}
                          style={{ paddingRight: 44, ...(fieldErrors.accountPassword ? { borderColor: '#ef4444' } : {}) }} />
                        <button type="button" onClick={() => setShowAccountPassword(!showAccountPassword)} style={{
                          position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                          background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: 0, lineHeight: 0,
                          transition: 'color 0.2s',
                        }}
                          onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.7)'}
                          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}>
                          {showAccountPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      {fieldErrors.accountPassword
                        ? <p className="field-error" style={errorStyle}><AlertCircle size={11} />{fieldErrors.accountPassword}</p>
                        : <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 5 }}>
                            {isVenue ? 'Your personal password to manage the venue settings' : 'Required to access this event from other devices or browsers'}
                          </p>
                      }
                    </div>

                    {/* Staff password (venue only) */}
                    {isVenue && (
                      <div>
                        <label style={labelStyle}>
                          <span style={labelIconStyle}>
                            <Shield size={13} color="rgba(255,255,255,0.4)" />
                            Staff Password <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, fontWeight: 400 }}>(optional — shared with floor staff)</span>
                          </span>
                        </label>
                        <div style={{ position: 'relative' }}>
                          <input type={showPassword ? 'text' : 'password'} className="dark-input"
                            placeholder="PIN or password staff use to log in to the floor"
                            value={formData.staffPassword}
                            onChange={e => { update('staffPassword')(e); setFieldErrors(p => ({ ...p, staffPassword: '' })); }}
                            style={{ paddingRight: 44, ...(fieldErrors.staffPassword ? { borderColor: '#ef4444' } : {}) }} />
                          <button type="button" onClick={() => setShowPassword(!showPassword)} style={{
                            position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                            background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: 0, lineHeight: 0,
                          }}>
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                        {fieldErrors.staffPassword
                          ? <p className="field-error" style={errorStyle}><AlertCircle size={11} />{fieldErrors.staffPassword}</p>
                          : <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', marginTop: 5 }}>Leave empty if you'll create individual staff accounts from the floor settings</p>
                        }
                      </div>
                    )}

                    {/* Event password (non-venue) */}
                    {!isVenue && (
                      <div>
                        <label style={labelStyle}>
                          <span style={labelIconStyle}>
                            <Shield size={13} color="rgba(255,255,255,0.4)" />
                            Event Password <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 10, fontWeight: 400 }}>(optional)</span>
                          </span>
                        </label>
                        <div style={{ position: 'relative' }}>
                          <input type={showPassword ? 'text' : 'password'} className="dark-input"
                            placeholder={mode === 'enterprise' ? 'Add layer of security' : 'Leave empty for open access'}
                            value={formData.password} onChange={update('password')}
                            style={{ paddingRight: 44 }} />
                          <button type="button" onClick={() => setShowPassword(!showPassword)} style={{
                            position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                            background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: 0, lineHeight: 0,
                          }}>
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Submit */}
                    <button type="submit" disabled={loading} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                      width: '100%', padding: '15px 0', borderRadius: 14, fontSize: 15, fontWeight: 700,
                      background: isVenue ? '#ff7a45' : '#fff',
                      color: isVenue ? '#fff' : '#09090b',
                      border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                      boxShadow: isVenue ? '0 8px 28px rgba(255,122,69,0.3)' : '0 8px 28px rgba(0,0,0,0.4)',
                      opacity: loading ? 0.65 : 1,
                      transition: 'transform 0.15s, box-shadow 0.15s',
                    }}
                      onMouseEnter={e => { if (!loading) { e.currentTarget.style.transform = 'translateY(-2px)'; } }}
                      onMouseLeave={e => e.currentTarget.style.transform = ''}
                    >
                      {loading ? (
                        <><div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid rgba(0,0,0,0.2)', borderTopColor: isVenue ? '#fff' : '#09090b', animation: 'spin 0.8s linear infinite' }} />Creating…</>
                      ) : isVenue ? (
                        <>Create venue <UtensilsCrossed size={16} /></>
                      ) : (
                        <>Create event <ArrowRight size={16} /></>
                      )}
                    </button>
                  </form>
                </Reveal>
              )}
            </div>
          </div>
        </section>

        {/* ══════════════════════════════════════════════════════
            FOOTER
        ══════════════════════════════════════════════════════ */}
        <footer
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(4,4,11,0.98)' }}
          role="contentinfo"
        >
          <div style={{ maxWidth: 1280, margin: '0 auto', padding: '64px 24px 40px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '32px 48px', marginBottom: 48 }} className="grid-cols-2 sm:grid-cols-4">

              {/* Brand */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  {isWL && wlLogo ? (
                    <img src={wlLogo} alt={wlName} style={{ height: 28, objectFit: 'contain' }} />
                  ) : (
                    <>
                      <div style={{ width: 32, height: 32, borderRadius: 9, background: 'rgba(124,125,255,0.1)', border: '1px solid rgba(124,125,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Calendar size={15} color="#a5b4fc" />
                      </div>
                      <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 16, fontWeight: 700, color: '#fff', letterSpacing: '-0.03em' }}>
                        {isWL ? wlName : 'PlanIt'}
                      </span>
                    </>
                  )}
                </div>
                {!isWL && <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)', lineHeight: 1.7, marginBottom: 10 }}>
                  The ultimate planning hub for event teams. Plan smart, execute flawlessly.
                </p>}
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.18)' }}>Built by Aakshat Hariharan</p>
              </div>

              {/* Product */}
              <div>
                <h3 style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.25)', marginBottom: 16 }}>Product</h3>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[['Features', '#features'], ['Discover', '/discover'], ['Blog', '/blog'], ['Status', '/status'], ['Help', '/help'], ['Get Started', '#create'], ['License', '/license']].map(([label, href]) => (
                    <li key={label}>
                      <a href={href} style={{ fontSize: 12, color: 'rgba(255,255,255,0.32)', textDecoration: 'none', transition: 'color 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.8)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.32)'}>
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Company */}
              <div>
                <h3 style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.25)', marginBottom: 16 }}>Company</h3>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[['About PlanIt', '/about'], ['Blog & Guides', '/blog'], ['Terms of Service', '/terms'], ['Privacy Policy', '/privacy'], ['License', '/license']].map(([label, href]) => (
                    <li key={label}>
                      <a href={href} style={{ fontSize: 12, color: 'rgba(255,255,255,0.32)', textDecoration: 'none', transition: 'color 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.8)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.32)'}>
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Connect */}
              <div>
                <h3 style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.25)', marginBottom: 16 }}>Connect</h3>
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[['Contact / Support us', '/support'], ['Wall of Supporters', '/support/wall'], ['System Status', '/status'], ['Help Center', '/help']].map(([label, href]) => (
                    <li key={label}>
                      <a href={href} style={{ fontSize: 12, color: 'rgba(255,255,255,0.32)', textDecoration: 'none', transition: 'color 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.8)'}
                        onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.32)'}>
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Bottom bar */}
            <div style={{ paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center', justifyContent: 'space-between' }} className="sm:flex-row">
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)' }}>© 2026 PlanIt. All rights reserved.</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.2)' }}>By Aakshat Hariharan</span>
            </div>
          </div>
        </footer>

      </main>
    </div>
  );
}