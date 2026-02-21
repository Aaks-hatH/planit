import { useState, useEffect, useRef } from 'react';
import { getUserTimezone, localDateTimeToUTC, getTimezoneOptions } from '../utils/timezoneUtils';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, Users, MessageSquare, BarChart3, FileText, Shield, Copy, Check, Lock,
  ArrowRight, Link, Eye, EyeOff, ChevronRight, Sparkles, Zap, Clock,
  CheckCircle2, Star, TrendingUp, Gift, Heart, Coffee, ListChecks, Timer,
  Brain, ArrowUpRight
} from 'lucide-react';
import { eventAPI } from '../services/api';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import StarBackground from '../components/StarBackground';

/*
Copyright (C) 2026 Aakshat Hariharan 

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, version 3.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.
*/

// ─────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────

function slugify(text) {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 40);
}
function makeSubdomain(title) {
  const slug = slugify(title);
  if (!slug) return '';
  return `${slug}-${Math.random().toString(36).substring(2, 6)}`;
}

function useScrollReveal(threshold = 0.1) {
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

function CopyLinkBox({ eventId, subdomain }) {
  const [copied, setCopied] = useState(false);
  const link = subdomain ? `${window.location.origin}/e/${subdomain}` : `${window.location.origin}/event/${eventId}`;
  const handleCopy = () => {
    navigator.clipboard.writeText(link);
    setCopied(true); toast.success('Link copied');
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="mt-3 rounded-2xl border border-neutral-700 overflow-hidden bg-neutral-900 hover:border-neutral-600 transition-all duration-300">
      <div className="flex items-center gap-3 px-5 py-4">
        <Link className="w-4 h-4 text-neutral-500 flex-shrink-0" />
        <span className="flex-1 text-sm text-neutral-300 font-mono truncate">{link}</span>
        <button onClick={handleCopy} className={`flex-shrink-0 flex items-center gap-2 px-5 py-2.5 text-xs font-medium rounded-xl transition-all duration-300 ${copied ? 'bg-emerald-500 text-white' : 'bg-white text-neutral-900 hover:bg-neutral-100'}`}>
          {copied ? <><Check className="w-3.5 h-3.5" />Copied</> : <><Copy className="w-3.5 h-3.5" />Copy</>}
        </button>
      </div>
    </div>
  );
}

function Reveal({ children, delay = 0, className = '' }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setTimeout(() => setVisible(true), delay); obs.unobserve(el); } },
      { threshold: 0.08 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [delay]);
  return (
    <div ref={ref} className={`${className} transition-all duration-700 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      {children}
    </div>
  );
}

function SectionHeader({ eyebrow, title, subtitle }) {
  return (
    <Reveal className="text-center mb-16">
      {eyebrow && <p className="text-xs font-semibold text-neutral-500 uppercase tracking-widest mb-3">{eyebrow}</p>}
      <h2 className="text-5xl md:text-6xl font-black text-white mb-5">{title}</h2>
      {subtitle && <p className="text-xl text-neutral-400 max-w-xl mx-auto">{subtitle}</p>}
    </Reveal>
  );
}

function FeatureCard({ icon: Icon, title, description, delay = 0 }) {
  return (
    <Reveal delay={delay}>
      <div className="group relative p-8 rounded-3xl border border-neutral-800 bg-neutral-900/50 hover:border-neutral-600 hover:bg-neutral-800/50 transition-all duration-500 h-full">
        <div className="mb-5">
          <div className="w-14 h-14 rounded-2xl bg-neutral-800 flex items-center justify-center group-hover:bg-white transition-all duration-500 group-hover:scale-110">
            <Icon className="w-7 h-7 text-neutral-400 group-hover:text-neutral-900 transition-colors duration-500" />
          </div>
        </div>
        <h3 className="text-lg font-semibold text-white mb-3">{title}</h3>
        <p className="text-sm text-neutral-400 leading-relaxed">{description}</p>
      </div>
    </Reveal>
  );
}

function TestimonialCard({ quote, author, role, event, delay = 0 }) {
  return (
    <Reveal delay={delay}>
      <div className="p-8 rounded-3xl border border-neutral-800 bg-neutral-900/50 hover:border-neutral-700 hover:bg-neutral-800/50 transition-all duration-500 h-full">
        <div className="flex items-start gap-4 mb-5">
          <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-white flex items-center justify-center">
            <span className="text-base font-bold text-neutral-900">{author.charAt(0)}</span>
          </div>
          <div>
            <p className="text-base font-semibold text-white">{author}</p>
            <p className="text-xs text-neutral-500">{role}</p>
            <p className="text-xs text-neutral-600 mt-0.5">{event}</p>
          </div>
        </div>
        <p className="text-sm text-neutral-300 leading-relaxed mb-4">"{quote}"</p>
        <div className="flex items-center gap-1">
          {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />)}
        </div>
      </div>
    </Reveal>
  );
}

// ─────────────────────────────────────────────
// COSMIC AMBIENT LAYER — soft nebulae, aurora
// These sit between the star canvas and page content.
// opacity is intentionally low so they don't compete.
// ─────────────────────────────────────────────

function CosmicAmbient() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 1, transform: 'translateZ(0)', WebkitTransform: 'translateZ(0)' }}>
      {/* Slow-drifting nebula blobs */}
      <div className="cosmic-orb cosmic-orb-1" />
      <div className="cosmic-orb cosmic-orb-2" />
      <div className="cosmic-orb cosmic-orb-3" />
      {/* Horizon aurora shimmer */}
      <div className="cosmic-aurora" />
    </div>
  );
}

// ─────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────

export default function Home() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('standard');
  const [formData, setFormData] = useState({
    subdomain: '', title: '', description: '', date: '', timezone: getUserTimezone(), location: '',
    organizerName: '', organizerEmail: '', accountPassword: '', password: '',
    isEnterpriseMode: false, maxParticipants: 10000,
  });
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showAccountPassword, setShowAccountPassword] = useState(false);

  const handleTitleChange = (e) => {
    const title = e.target.value;
    setFormData(prev => ({ ...prev, title, subdomain: prev._subdomainTouched ? prev.subdomain : makeSubdomain(title) }));
  };
  const update = (field) => (e) =>
    setFormData(prev => ({ ...prev, [field]: e.target.value, ...(field === 'subdomain' ? { _subdomainTouched: true } : {}) }));

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true);
    const dateValue = formData.date ? localDateTimeToUTC(formData.date, formData.timezone) : formData.date;
    const payload = {
      ...formData,
      date: dateValue,
      timezone: formData.timezone,
      subdomain: formData.subdomain || makeSubdomain(formData.title) || `event-${Date.now()}`,
      isEnterpriseMode: mode === 'enterprise'
    };
    delete payload._subdomainTouched;
    try {
      const response = await eventAPI.create(payload);
      localStorage.setItem('eventToken', response.data.token);
      localStorage.setItem('username', formData.organizerName);
      setCreated(response.data.event);
    } catch (error) {
      const msg = error.response?.data?.error || 'Failed to create event';
      if (msg.includes('already taken')) setFormData(prev => ({ ...prev, subdomain: makeSubdomain(prev.title) }));
      toast.error(msg);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen text-white relative" style={{ background: '#06060c' }}>
      <StarBackground fixed={true} starCount={220} />
      <CosmicAmbient />

      <style>{`
        /* ── Cosmic orbs ─────────────────────────────────────────── */
        .cosmic-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(90px);
          opacity: 0;
          animation: orb-breathe 0s linear infinite;
        }
        .cosmic-orb-1 {
          width: 580px; height: 380px;
          top: -8%; left: -10%;
          background: radial-gradient(ellipse, rgba(80,60,180,0.18) 0%, rgba(40,20,100,0.06) 55%, transparent 75%);
          animation: orb-drift-1 32s ease-in-out infinite;
          animation-delay: 0s;
        }
        .cosmic-orb-2 {
          width: 480px; height: 520px;
          top: 20%; right: -8%;
          background: radial-gradient(ellipse, rgba(20,80,160,0.14) 0%, rgba(10,40,90,0.05) 55%, transparent 75%);
          animation: orb-drift-2 44s ease-in-out infinite;
          animation-delay: -14s;
        }
        .cosmic-orb-3 {
          width: 420px; height: 300px;
          bottom: 12%; left: 30%;
          background: radial-gradient(ellipse, rgba(100,40,140,0.12) 0%, rgba(50,15,80,0.04) 55%, transparent 75%);
          animation: orb-drift-3 38s ease-in-out infinite;
          animation-delay: -8s;
        }

        /* ── Aurora shimmer at bottom ────────────────────────────── */
        .cosmic-aurora {
          position: absolute;
          bottom: 0; left: 0; right: 0;
          height: 280px;
          background: linear-gradient(
            to top,
            rgba(20, 60, 40, 0.06) 0%,
            rgba(30, 80, 80, 0.04) 40%,
            transparent 100%
          );
          animation: aurora-pulse 18s ease-in-out infinite;
        }

        @keyframes orb-drift-1 {
          0%   { opacity: 1; transform: translate(0px, 0px) scale(1); }
          25%  { transform: translate(45px, 30px) scale(1.06); }
          50%  { transform: translate(20px, 60px) scale(0.95); }
          75%  { transform: translate(-25px, 25px) scale(1.03); }
          100% { opacity: 1; transform: translate(0px, 0px) scale(1); }
        }
        @keyframes orb-drift-2 {
          0%   { opacity: 1; transform: translate(0px, 0px) scale(1); }
          33%  { transform: translate(-40px, 50px) scale(1.08); }
          66%  { transform: translate(30px, -20px) scale(0.94); }
          100% { opacity: 1; transform: translate(0px, 0px) scale(1); }
        }
        @keyframes orb-drift-3 {
          0%   { opacity: 1; transform: translate(0px, 0px) scale(1); }
          40%  { transform: translate(30px, -40px) scale(1.05); }
          80%  { transform: translate(-20px, 20px) scale(0.97); }
          100% { opacity: 1; transform: translate(0px, 0px) scale(1); }
        }
        @keyframes aurora-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        /* ── Shimmer text ─────────────────────────────────────────── */
        @keyframes shimmer-slide {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        .shimmer-white {
          background: linear-gradient(90deg, #94a3b8 15%, #ffffff 42%, #94a3b8 68%);
          background-size: 200% auto;
          -webkit-background-clip: text; background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmer-slide 4s ease-in-out infinite;
        }
        .shimmer-slate {
          background: linear-gradient(120deg, #64748b 0%, #cbd5e1 48%, #64748b 90%);
          background-size: 200% auto;
          -webkit-background-clip: text; background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmer-slide 5s ease-in-out infinite;
        }

        /* ── Cosmic glow ring — hero badge pulse ─────────────────── */
        @keyframes ring-pulse {
          0%, 100% { box-shadow: 0 0 0 0px rgba(148,163,184,0), 0 0 28px 4px rgba(100,116,139,0.10); }
          50%       { box-shadow: 0 0 0 8px rgba(148,163,184,0.04), 0 0 40px 8px rgba(100,116,139,0.18); }
        }
        .hero-badge { animation: ring-pulse 5s ease-in-out infinite; }

        /* ── Floating constellation dots — hero section ──────────── */
        @keyframes float-dot {
          0%, 100% { transform: translateY(0px) scale(1);   opacity: 0.35; }
          50%       { transform: translateY(-14px) scale(1.2); opacity: 0.65; }
        }
        .constellate {
          position: absolute;
          width: 3px; height: 3px;
          background: white;
          border-radius: 50%;
          pointer-events: none;
        }
        .constellate:nth-child(1)  { top:18%; left:8%;  animation: float-dot 7.2s ease-in-out infinite 0.0s; }
        .constellate:nth-child(2)  { top:12%; left:22%; animation: float-dot 8.8s ease-in-out infinite 1.2s; }
        .constellate:nth-child(3)  { top:28%; left:5%;  animation: float-dot 6.5s ease-in-out infinite 2.4s; }
        .constellate:nth-child(4)  { top:8%;  left:72%; animation: float-dot 9.1s ease-in-out infinite 0.6s; }
        .constellate:nth-child(5)  { top:22%; left:85%; animation: float-dot 7.7s ease-in-out infinite 3.0s; }
        .constellate:nth-child(6)  { top:35%; left:91%; animation: float-dot 8.3s ease-in-out infinite 1.8s; }
        .constellate:nth-child(7)  { top:55%; left:4%;  animation: float-dot 7.0s ease-in-out infinite 2.1s; }
        .constellate:nth-child(8)  { top:62%; left:94%; animation: float-dot 9.4s ease-in-out infinite 0.9s; }

        /* ── Pulsing hero glow disc ──────────────────────────────── */
        @keyframes hero-disc-pulse {
          0%, 100% { opacity: 0.07; transform: scale(1); }
          50%       { opacity: 0.13; transform: scale(1.04); }
        }
        .hero-disc {
          position: absolute;
          left: 50%; top: 42%;
          transform: translate(-50%, -50%);
          width: 680px; height: 340px;
          border-radius: 50%;
          background: radial-gradient(ellipse, rgba(120,100,200,0.35) 0%, transparent 70%);
          filter: blur(60px);
          animation: hero-disc-pulse 8s ease-in-out infinite;
          pointer-events: none;
        }

        /* ── Scan-line sweep on stat cards ──────────────────────── */
        @keyframes scan-sweep {
          0%   { transform: translateX(-120%); }
          100% { transform: translateX(220%);  }
        }
        .stat-card { position: relative; overflow: hidden; }
        .stat-card::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%);
          transform: translateX(-120%);
          animation: scan-sweep 5s ease-in-out infinite;
          pointer-events: none;
        }
        .stat-card:nth-child(2)::after { animation-delay: 1.6s; }
        .stat-card:nth-child(3)::after { animation-delay: 3.2s; }

        /* ── Input styles ─────────────────────────────────────────── */
        .dark-input {
          width: 100%;
          padding: 0.75rem 1rem;
          background: rgba(15,15,25,0.8);
          border: 1px solid #334155;
          border-radius: 0.75rem;
          color: white;
          font-size: 0.875rem;
          outline: none;
          transition: border-color 0.2s;
        }
        .dark-input:focus { border-color: #64748b; }
        .dark-input::placeholder { color: #475569; }
        .dark-input option { background: #0f172a; color: white; }

        /* ── Respect reduced motion ──────────────────────────────── */
        @media (prefers-reduced-motion: reduce) {
          .cosmic-orb, .cosmic-aurora, .hero-badge,
          .constellate, .hero-disc, .stat-card::after,
          .shimmer-white, .shimmer-slate { animation: none !important; }
        }
      `}</style>

      {/* Nav */}
      <header
        className="sticky top-0 z-50 border-b border-neutral-800/60"
        style={{ background: 'rgba(6,6,12,0.96)' }}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-9 h-9 rounded-2xl bg-neutral-800 border border-neutral-700 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-neutral-300" />
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#06060c] animate-pulse" />
            </div>
            <span className="text-xl font-bold text-white">PlanIt</span>
          </div>
          <nav className="flex items-center gap-1">
            {['Terms|/terms', 'Privacy|/privacy', 'Admin|/admin'].map(s => {
              const [label, href] = s.split('|');
              return <a key={label} href={href} className="px-3 py-2 text-sm text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800/50 rounded-xl transition-all duration-200">{label}</a>;
            })}
            <a href="/support" className="ml-2 px-5 py-2.5 text-sm font-medium text-white bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-xl transition-all duration-200 flex items-center gap-2">
              <Heart className="w-4 h-4" fill="currentColor" />Support
            </a>
          </nav>
        </div>
      </header>

      <main className="relative overflow-x-hidden" style={{ zIndex: 2 }}>
        {/* HERO */}
        <section className="relative min-h-[92vh] flex items-center overflow-hidden">
          {/* Constellation dots floating in hero periphery */}
          <div className="constellate" />
          <div className="constellate" />
          <div className="constellate" />
          <div className="constellate" />
          <div className="constellate" />
          <div className="constellate" />
          <div className="constellate" />
          <div className="constellate" />
          {/* Central glow disc */}
          <div className="hero-disc" />

          <div className="w-full">
            <div className="max-w-4xl mx-auto px-6 py-28 text-center">

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.15 }}
                className="hero-badge inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-medium text-neutral-400 mb-10 border border-neutral-700/60 cursor-default"
                style={{ background: 'rgba(255,255,255,0.04)' }}
              >
                <Sparkles className="w-3.5 h-3.5 text-neutral-500" />
                The planning hub teams swear by
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, delay: 0.28, ease: [0.22, 1, 0.36, 1] }}
                className="font-black leading-[0.93] tracking-tight mb-7"
                style={{ fontSize: 'clamp(3rem, 7.5vw, 5.5rem)' }}
              >
                Make it{' '}
                <span className="shimmer-slate">Effortless</span>
                ,{' '}
                <span className="shimmer-white">by design.</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.42 }}
                className="text-lg md:text-xl text-neutral-400 max-w-lg mx-auto leading-relaxed font-light mb-12"
              >
                The all-in-one workspace for event teams. From first idea to final wrap-up.
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.55 }}
                className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
              >
                <a href="#create" className="group inline-flex items-center gap-3 px-9 py-4 bg-white text-neutral-900 text-base font-bold rounded-2xl hover:bg-neutral-100 hover:scale-105 transition-all duration-300 shadow-2xl">
                  Start planning
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
                </a>
                <a href="#features"
                  className="inline-flex items-center gap-2 px-9 py-4 border border-neutral-700 text-neutral-300 text-base font-medium rounded-2xl hover:border-neutral-500 hover:text-white hover:scale-105 transition-all duration-300"
                  style={{ background: 'rgba(255,255,255,0.04)' }}>
                  See features <ChevronRight className="w-4 h-4" />
                </a>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.68 }}
                className="grid grid-cols-3 gap-4 max-w-md mx-auto"
              >
                {[
                  { value: 50000, suffix: '+', label: 'Events planned' },
                  { value: 500,   suffix: 'k+', label: 'Teams organized' },
                  { value: 100,   suffix: '%',  label: 'Success rate' },
                ].map((stat, i) => (
                  <div key={i}
                    className="stat-card text-center p-5 rounded-2xl border border-neutral-800 hover:border-neutral-600 transition-all duration-400 cursor-default hover:scale-105"
                    style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <div className="text-3xl font-black text-white mb-1">
                      <AnimatedCounter end={stat.value} suffix={stat.suffix} />
                    </div>
                    <div className="text-xs font-medium text-neutral-500">{stat.label}</div>
                  </div>
                ))}
              </motion.div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="py-20 border-t border-neutral-800/40">
          <div className="max-w-5xl mx-auto px-6">
            <SectionHeader eyebrow="How teams use it" title="Your event, every step" subtitle="Built for the full arc. Months of prep to the final goodbye." />
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { icon: Brain,        phase: 'Before', num: '01', title: 'Coordinate your team',  desc: 'Assign tasks, split expenses, finalize the guest list, share files, and get every detail locked in before the big day.' },
                { icon: Zap,          phase: 'During', num: '02', title: 'Stay on top of it',     desc: 'Quick check-ins, QR guest arrivals, last-minute updates. Your team stays synced while the event runs itself.' },
                { icon: CheckCircle2, phase: 'After',  num: '03', title: 'Wrap it up right',      desc: 'Close expenses, share memories, collect feedback. Every loose end, tied.' },
              ].map((item, i) => (
                <Reveal key={i} delay={i * 120}>
                  <div className="group relative p-8 bg-neutral-900/50 rounded-3xl border border-neutral-800 hover:border-neutral-600 hover:bg-neutral-800/50 transition-all duration-500">
                    <div className="flex items-start justify-between mb-6">
                      <div className="w-12 h-12 rounded-2xl bg-neutral-800 group-hover:bg-white flex items-center justify-center transition-all duration-500">
                        <item.icon className="w-6 h-6 text-neutral-400 group-hover:text-neutral-900 transition-colors duration-500" />
                      </div>
                      <span className="text-3xl font-black text-neutral-800 group-hover:text-neutral-700 transition-colors select-none">{item.num}</span>
                    </div>
                    <p className="text-xs font-bold text-neutral-600 uppercase tracking-widest mb-2">{item.phase}</p>
                    <h3 className="text-lg font-bold text-white mb-3">{item.title}</h3>
                    <p className="text-sm text-neutral-400 leading-relaxed">{item.desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section id="features" className="py-28 border-t border-neutral-800/40">
          <div className="max-w-7xl mx-auto px-6">
            <SectionHeader eyebrow="Features" title="Everything you need" subtitle="Powerful tools for seamless event planning and coordination" />
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <FeatureCard icon={MessageSquare} title="Real-time team chat"       description="Instant messaging with typing indicators, reactions, and threaded conversations. Keep your planning team connected and aligned." delay={0} />
              <FeatureCard icon={ListChecks}    title="Task management"           description="Create checklists, assign tasks, set deadlines, and track completion. Never miss a critical planning milestone." delay={80} />
              <FeatureCard icon={BarChart3}     title="Quick polls and voting"    description="Make team decisions faster with live polls. Vote on venues, dates, menus, and more. See results instantly." delay={160} />
              <FeatureCard icon={FileText}      title="Unlimited file sharing"    description="Share contracts, floor plans, schedules, and more. Everything your team needs in one organized space." delay={240} />
              <FeatureCard icon={Clock}         title="Timeline and scheduling"   description="Build your event timeline, coordinate arrival times, and manage your run-of-show with precision." delay={320} />
              <FeatureCard icon={Users}         title="Unlimited participants"    description="No limits on team size. Bring your entire planning committee, vendors, volunteers, everyone who needs to be involved." delay={400} />
            </div>
          </div>
        </section>

        {/* ENTERPRISE */}
        <section className="py-28 border-t border-neutral-800/40">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <Reveal>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-full text-xs font-bold text-neutral-300 mb-8">
                  <Zap className="w-4 h-4" />Enterprise Mode
                </div>
                <h2 className="text-5xl font-black text-white mb-6 leading-tight">Built for large-scale events</h2>
                <p className="text-xl text-neutral-400 mb-10 leading-relaxed">
                  Hosting a wedding, conference, or corporate event? Enterprise Mode gives you professional-grade tools for managing hundreds of guests.
                </p>
                <div className="space-y-4">
                  {[
                    { icon: CheckCircle2, text: 'QR code-based guest check-in system' },
                    { icon: Users,        text: 'Personalized digital invitations for each guest' },
                    { icon: TrendingUp,   text: 'Real-time attendance analytics dashboard' },
                    { icon: Timer,        text: 'Track check-in times and flow metrics' },
                  ].map((item, i) => (
                    <Reveal key={i} delay={i * 80}>
                      <div className="flex items-center gap-4 p-4 bg-neutral-900/50 rounded-2xl border border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800/50 transition-all duration-300">
                        <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center flex-shrink-0">
                          <item.icon className="w-5 h-5 text-neutral-900" />
                        </div>
                        <span className="text-neutral-300 font-medium">{item.text}</span>
                      </div>
                    </Reveal>
                  ))}
                </div>
              </Reveal>

              <Reveal delay={140}>
                <div className="bg-neutral-900/60 rounded-3xl border border-neutral-800 p-10 hover:border-neutral-700 transition-all duration-500">
                  <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-sm font-bold text-emerald-400 mb-6 animate-pulse">
                      <CheckCircle2 className="w-4 h-4" />Guest Check-in Active
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-1">Sarah Johnson</h3>
                    <p className="text-neutral-500 text-sm">Party of 4 · Table 12</p>
                  </div>
                  <div className="bg-neutral-950 rounded-2xl p-8 border border-neutral-800">
                    <div className="w-52 h-52 mx-auto bg-white rounded-2xl grid grid-cols-8 grid-rows-8 gap-1 p-3">
                      {[...Array(64)].map((_, i) => <div key={i} className={`rounded-sm ${Math.random() > 0.5 ? 'bg-neutral-900' : 'bg-white'}`} />)}
                    </div>
                  </div>
                  <div className="mt-8 text-center space-y-3">
                    <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wider">Invite Code</p>
                    <p className="text-2xl font-mono font-black text-white tracking-wider">AB12CD34</p>
                    <button className="px-6 py-3 bg-white text-neutral-900 rounded-xl font-bold hover:bg-neutral-100 transition-all hover:scale-105">Scan to Check In</button>
                  </div>
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section className="py-28 border-t border-neutral-800/40">
          <div className="max-w-7xl mx-auto px-6">
            <SectionHeader eyebrow="Testimonials" title="Trusted by event planners" subtitle="See how teams are using PlanIt to execute flawless events" />
            <div className="grid md:grid-cols-3 gap-6">
              <TestimonialCard quote="PlanIt transformed how we coordinated our annual company conference. The task management kept our 15-person planning team organized for 6 months of prep. The QR check-in on event day was seamless for 300 attendees." author="Michael Chen" role="Senior Event Coordinator" event="Tech Summit 2025" delay={0} />
              <TestimonialCard quote="As a wedding planner, I've used every tool out there. PlanIt stands out because it doesn't require my couples or vendors to create accounts. We used it for 4 months of planning." author="Sarah Williams" role="Lead Wedding Planner" event="Williams-Martinez Wedding" delay={120} />
              <TestimonialCard quote="Our nonprofit used PlanIt to coordinate a 500-person fundraising gala. The unlimited participant feature meant we could include our entire board, 30 volunteers, all vendors, and staff." author="David Martinez" role="Development Director" event="Charity Gala 2025" delay={240} />
            </div>
          </div>
        </section>

        {/* CREATE EVENT */}
        <section id="create" className="py-28 border-t border-neutral-800/40">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid lg:grid-cols-2 gap-20 items-start">

              <div className="lg:sticky lg:top-24">
                <Reveal>
                  <div className="mb-10">
                    <h2 className="text-5xl font-black text-white mb-6 tracking-tight leading-tight">
                      {created ? 'Event created!' : 'Start planning your event'}
                    </h2>
                    <p className="text-xl text-neutral-400 leading-relaxed">
                      {created
                        ? 'Your planning hub is ready. Share the link with your team and get started.'
                        : 'Create your event workspace in 60 seconds. No credit card, no hassle, just start planning.'}
                    </p>
                  </div>
                </Reveal>

                {!created && (
                  <Reveal delay={100}>
                    <div className="grid grid-cols-3 gap-4 mb-10">
                      {[{ icon: Clock, label: '60 seconds' }, { icon: Shield, label: 'Secure' }, { icon: Gift, label: 'Free forever' }].map((item, i) => (
                        <div key={i} className="text-center p-5 bg-neutral-900/50 rounded-2xl border border-neutral-800 hover:border-neutral-700 hover:bg-neutral-800/50 transition-all duration-300 hover:scale-105">
                          <item.icon className="w-6 h-6 text-neutral-400 mx-auto mb-2" />
                          <p className="text-sm font-semibold text-neutral-300">{item.label}</p>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-3 p-8 bg-neutral-900/50 rounded-3xl border border-neutral-800">
                      <p className="text-base font-bold text-white mb-4">Everything included:</p>
                      {['Private event space with custom branded URL', 'Unlimited team members, no caps', 'Real-time chat with file sharing', 'Task lists and deadline tracking', 'Polls, voting, and decision tools', 'RSVP management and tracking', 'Expense splitting and budgets', 'QR check-in for large events', 'Timeline and scheduling tools'].map((item, i) => (
                        <div key={i} className="flex items-start gap-3 text-sm text-neutral-400">
                          <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                          <span className="leading-relaxed">{item}</span>
                        </div>
                      ))}
                    </div>
                  </Reveal>
                )}

                {created && (
                  <Reveal delay={100}>
                    <div className="space-y-6">
                      <div className="flex items-center justify-center p-10 bg-emerald-500/10 rounded-3xl border border-emerald-500/20">
                        <div className="text-center">
                          <div className="w-20 h-20 mx-auto mb-5 rounded-full bg-emerald-500 flex items-center justify-center animate-bounce shadow-lg">
                            <Check className="w-10 h-10 text-white" />
                          </div>
                          <p className="text-lg font-bold text-emerald-400">{mode === 'enterprise' ? 'Enterprise event created!' : 'Your planning hub is live!'}</p>
                        </div>
                      </div>
                      {mode === 'enterprise' ? (
                        <div className="p-8 bg-neutral-900/50 border border-neutral-800 rounded-3xl">
                          <div className="flex items-start gap-4">
                            <Zap className="w-6 h-6 text-neutral-400 flex-shrink-0 mt-1" />
                            <div>
                              <p className="text-base font-bold text-white mb-4">Next steps for Enterprise Mode:</p>
                              <ol className="text-sm text-neutral-400 space-y-3 list-decimal ml-5">
                                <li>Enter your event and click "Manage Guest Invites"</li>
                                <li>Add all guests with names, email, and group sizes</li>
                                <li>Send personalized invite links with QR codes to each guest</li>
                                <li>On event day, use the check-in dashboard to scan QR codes</li>
                                <li>View real-time attendance analytics as guests arrive</li>
                              </ol>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm font-bold text-neutral-300 mb-3">Your event link:</p>
                          <CopyLinkBox eventId={created.id} subdomain={created.subdomain} />
                          <p className="text-xs text-neutral-600 mt-3">Share this link with your planning team to get started</p>
                        </div>
                      )}
                      <button
                        onClick={() => navigate(created.subdomain ? `/e/${created.subdomain}` : `/event/${created.id}`)}
                        className="w-full px-8 py-5 bg-white text-neutral-900 rounded-2xl font-bold hover:scale-105 hover:bg-neutral-100 transition-all duration-300 shadow-xl flex items-center justify-center gap-3 text-lg"
                      >
                        {mode === 'enterprise' ? 'Set Up Guest Invites' : 'Enter your planning hub'}
                        <ArrowUpRight className="w-5 h-5" />
                      </button>
                    </div>
                  </Reveal>
                )}
              </div>

              {!created && (
                <Reveal delay={80}>
                  <div className="bg-neutral-900/60 rounded-3xl border border-neutral-800 p-10 hover:border-neutral-700 transition-all duration-500 sticky top-24">
                    <div className="mb-8 p-5 bg-neutral-950/80 rounded-2xl border border-neutral-800">
                      <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-4">Event Type</label>
                      <div className="grid grid-cols-2 gap-3">
                        {[{ val: 'standard', label: 'Standard', sub: 'Team planning' }, { val: 'enterprise', label: 'Enterprise', sub: 'Full Execution' }].map(({ val, label, sub }) => (
                          <button key={val} type="button" onClick={() => setMode(val)}
                            className={`px-5 py-4 text-sm font-bold rounded-2xl border-2 transition-all duration-300 ${mode === val ? 'bg-white text-neutral-900 border-white shadow-lg scale-[1.03]' : 'bg-neutral-900 text-neutral-400 border-neutral-700 hover:border-neutral-500 hover:scale-[1.02]'}`}>
                            <div className="font-bold mb-1">{label}</div>
                            <div className="text-xs opacity-70">{sub}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                      <div>
                        <label className="block text-sm font-bold text-neutral-300 mb-2">Event title <span className="text-red-400">*</span></label>
                        <input type="text" required className="dark-input" placeholder="Summer Company Retreat 2025" value={formData.title} onChange={handleTitleChange} />
                        {formData.title && formData.subdomain && (
                          <div className="mt-3 space-y-1.5">
                            <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-widest">
                              Event URL
                              {formData._subdomainTouched && (
                                <span className="ml-2 text-neutral-600 normal-case tracking-normal font-normal">custom</span>
                              )}
                            </label>
                            <div className="flex items-center bg-neutral-950/60 border border-neutral-800 rounded-lg overflow-hidden focus-within:border-neutral-600 transition-colors">
                              <span className="pl-3 pr-1 text-xs text-neutral-600 font-mono whitespace-nowrap flex-shrink-0">/e/</span>
                              <input
                                type="text"
                                value={formData.subdomain}
                                onChange={(e) => {
                                  const cleaned = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-{2,}/g, '-');
                                  setFormData(prev => ({ ...prev, subdomain: cleaned, _subdomainTouched: true }));
                                }}
                                className="flex-1 bg-transparent text-xs text-neutral-300 font-mono font-bold py-2 pr-3 outline-none min-w-0"
                                spellCheck={false}
                                autoComplete="off"
                              />
                              {formData._subdomainTouched && (
                                <button
                                  type="button"
                                  onClick={() => setFormData(prev => ({ ...prev, subdomain: makeSubdomain(prev.title), _subdomainTouched: false }))}
                                  className="px-3 py-2 text-xs text-neutral-600 hover:text-neutral-400 transition-colors border-l border-neutral-800 flex-shrink-0"
                                  title="Reset to auto-generated"
                                >
                                  Reset
                                </button>
                              )}
                            </div>
                            <p className="text-xs text-neutral-700">Only lowercase letters, numbers, and hyphens.</p>
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-neutral-300 mb-2">Description</label>
                        <textarea className="dark-input resize-none" rows="3" placeholder="What's this event about?" value={formData.description} onChange={update('description')} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-bold text-neutral-300 mb-2">Date and time <span className="text-red-400">*</span></label>
                          <input type="datetime-local" required className="dark-input" value={formData.date} onChange={update('date')} />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-neutral-300 mb-2">Timezone <span className="text-red-400">*</span></label>
                          <select required className="dark-input" value={formData.timezone} onChange={update('timezone')}>
                            {getTimezoneOptions().map(tz => (
                              <option key={tz.value} value={tz.value}>{tz.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-neutral-300 mb-2">Location</label>
                        <input type="text" className="dark-input" placeholder="Central Park, NYC" value={formData.location} onChange={update('location')} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-bold text-neutral-300 mb-2">Your name <span className="text-red-400">*</span></label>
                          <input type="text" required className="dark-input" placeholder="Alex Smith" value={formData.organizerName} onChange={update('organizerName')} />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-neutral-300 mb-2">Your email <span className="text-red-400">*</span></label>
                          <input type="email" required className="dark-input" placeholder="alex@company.com" value={formData.organizerEmail} onChange={update('organizerEmail')} />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-neutral-300 mb-2">
                          <span className="flex items-center gap-2"><Lock className="w-4 h-4 text-neutral-500" />Account Password <span className="text-red-400">*</span></span>
                        </label>
                        <div className="relative">
                          <input type={showAccountPassword ? 'text' : 'password'} required className="dark-input pr-12" placeholder="Create a secure password (min 4 characters)" value={formData.accountPassword} onChange={update('accountPassword')} minLength={4} />
                          <button type="button" onClick={() => setShowAccountPassword(!showAccountPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors">
                            {showAccountPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                        <p className="text-xs text-neutral-600 mt-2">Required to access this event from other devices or browsers</p>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-neutral-300 mb-2">
                          <span className="flex items-center gap-2"><Shield className="w-4 h-4 text-neutral-500" />Event Password <span className="text-neutral-600 font-normal text-xs">(optional)</span></span>
                        </label>
                        <div className="relative">
                          <input type={showPassword ? 'text' : 'password'} className="dark-input pr-12" placeholder={mode === 'enterprise' ? 'Add layer of security' : 'Leave empty for open access'} value={formData.password} onChange={update('password')} />
                          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition-colors">
                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>
                      <button type="submit" disabled={loading}
                        className="w-full px-8 py-5 bg-white text-neutral-900 rounded-2xl font-bold hover:scale-105 hover:bg-neutral-100 transition-all duration-300 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-3 text-lg">
                        {loading ? <><div className="w-5 h-5 border-2 border-neutral-400 border-t-neutral-900 rounded-full animate-spin" />Creating your hub...</> : <>Create event<ArrowRight className="w-5 h-5" /></>}
                      </button>
                    </form>
                  </div>
                </Reveal>
              )}
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="border-t border-neutral-800/50" style={{ background: 'rgba(6,6,12,0.95)' }}>
          <div className="max-w-7xl mx-auto px-6 py-16">
            <div className="grid md:grid-cols-4 gap-12 mb-12">
              <div>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-2xl bg-neutral-800 border border-neutral-700 flex items-center justify-center"><Calendar className="w-5 h-5 text-neutral-300" /></div>
                  <span className="font-black text-xl text-white">PlanIt</span>
                </div>
                <p className="text-sm text-neutral-500 leading-relaxed mb-4">The ultimate planning hub for event teams. Plan smart, execute flawlessly.</p>
                <p className="text-xs text-neutral-600">Made with <Coffee className="w-4 h-4 inline" /> not love</p>
              </div>
              <div>
                <h3 className="text-xs font-bold text-neutral-500 mb-5 uppercase tracking-wider">Product</h3>
                <ul className="space-y-3 text-sm text-neutral-500">
                  {[['Features', '#features'], ['Get Started', '#create'], ['Support', '/support']].map(([l, h]) => (
                    <li key={l}><a href={h} className="hover:text-neutral-200 transition-colors">{l}</a></li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-xs font-bold text-neutral-500 mb-5 uppercase tracking-wider">Company</h3>
                <ul className="space-y-3 text-sm text-neutral-500">
                  {[['Terms of Service', '/terms'], ['Privacy Policy', '/privacy'], ['Admin Login', '/admin']].map(([l, h]) => (
                    <li key={l}><a href={h} className="hover:text-neutral-200 transition-colors">{l}</a></li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-xs font-bold text-neutral-500 mb-5 uppercase tracking-wider">Connect</h3>
                <ul className="space-y-3 text-sm text-neutral-500">
                  {[['Contact Us', '/support'], ['Wall of Supporters', '/support/wall'], ['About PlanIt', '/about']].map(([l, h]) => (
                    <li key={l}><a href={h} className="hover:text-neutral-200 transition-colors">{l}</a></li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="pt-8 border-t border-neutral-800 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-neutral-600">
              <span>© 2026 PlanIt. All rights reserved.</span>
              <span className="font-medium">By Aakshat Hariharan</span>
            </div>
          </div>
        </footer>

      </main>
    </div>
  );
}