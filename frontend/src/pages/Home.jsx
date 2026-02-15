import { useState, useEffect, useRef } from 'react';
import { getUserTimezone, localDateTimeToUTC, getTimezoneOptions } from '../utils/timezoneUtils';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, Users, MessageSquare, BarChart3, FileText, Shield, Copy, Check, Lock,
  ArrowRight, Link, Eye, EyeOff, ChevronRight, Sparkles, Zap, Clock,
  CheckCircle2, Star, TrendingUp, Gift,
  Heart, Coffee, ListChecks, Timer,
  Brain, ArrowUpRight
} from 'lucide-react';
import { eventAPI } from '../services/api';
import toast from 'react-hot-toast';

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 40);
}

function makeSubdomain(title) {
  const slug = slugify(title);
  if (!slug) return '';
  const suffix = Math.random().toString(36).substring(2, 6);
  return `${slug}-${suffix}`;
}

// Scroll-reveal hook
function useScrollReveal(threshold = 0.1) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.unobserve(el); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}

// Animated counter
function AnimatedCounter({ end, duration = 2000, suffix = '' }) {
  const [count, setCount] = useState(0);
  const [ref, visible] = useScrollReveal(0.1);
  useEffect(() => {
    if (!visible) return;
    let startTime;
    let raf;
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

// Feature card
function FeatureCard({ icon: Icon, title, description, delay = 0 }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setTimeout(() => setVisible(true), delay); obs.unobserve(el); } },
      { threshold: 0.08 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [delay]);
  return (
    <div ref={ref} className={`group relative p-8 rounded-3xl border border-neutral-200 bg-white hover:border-neutral-300 transition-all duration-700 ease-out hover:shadow-xl ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-neutral-50/60 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="relative mb-5">
        <div className="w-14 h-14 rounded-2xl bg-neutral-100 flex items-center justify-center group-hover:bg-neutral-900 transition-all duration-500 group-hover:scale-110">
          <Icon className="w-7 h-7 text-neutral-600 group-hover:text-white transition-colors duration-500" />
        </div>
        <div className="absolute inset-0 w-14 h-14 rounded-2xl border-2 border-neutral-300 opacity-0 group-hover:opacity-20 group-hover:scale-125 transition-all duration-700" />
      </div>
      <h3 className="relative text-lg font-semibold text-neutral-900 mb-3">{title}</h3>
      <p className="relative text-sm text-neutral-600 leading-relaxed">{description}</p>
    </div>
  );
}

// Testimonial card
function TestimonialCard({ quote, author, role, event, delay = 0 }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setTimeout(() => setVisible(true), delay); obs.unobserve(el); } },
      { threshold: 0.08 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [delay]);
  return (
    <div ref={ref} className={`p-8 rounded-3xl bg-white border border-neutral-200 hover:border-neutral-300 hover:shadow-xl transition-all duration-700 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      <div className="flex items-start gap-4 mb-5">
        <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-neutral-900 flex items-center justify-center shadow-sm">
          <span className="text-base font-bold text-white">{author.charAt(0)}</span>
        </div>
        <div>
          <p className="text-base font-semibold text-neutral-900">{author}</p>
          <p className="text-xs text-neutral-500">{role}</p>
          <p className="text-xs text-neutral-400 mt-0.5">{event}</p>
        </div>
      </div>
      <p className="text-sm text-neutral-600 leading-relaxed mb-4">"{quote}"</p>
      <div className="flex items-center gap-1">
        {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />)}
      </div>
    </div>
  );
}

// Copy link box
function CopyLinkBox({ eventId, subdomain }) {
  const [copied, setCopied] = useState(false);
  const link = subdomain ? `${window.location.origin}/e/${subdomain}` : `${window.location.origin}/event/${eventId}`;
  const handleCopy = () => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success('Link copied');
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="mt-3 rounded-2xl border border-neutral-200 overflow-hidden bg-neutral-50 hover:border-neutral-300 transition-all duration-300 hover:shadow-md">
      <div className="flex items-center gap-3 px-5 py-4">
        <Link className="w-4 h-4 text-neutral-400 flex-shrink-0" />
        <span className="flex-1 text-sm text-neutral-700 font-mono truncate">{link}</span>
        <button onClick={handleCopy} className={`flex-shrink-0 flex items-center gap-2 px-5 py-2.5 text-xs font-medium rounded-xl transition-all duration-300 ${copied ? 'bg-emerald-500 text-white scale-105' : 'bg-neutral-900 text-white hover:bg-black hover:scale-105'}`}>
          {copied ? <><Check className="w-3.5 h-3.5" />Copied</> : <><Copy className="w-3.5 h-3.5" />Copy</>}
        </button>
      </div>
    </div>
  );
}

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
    e.preventDefault();
    setLoading(true);
    const dateValue = formData.date ? localDateTimeToUTC(formData.date, formData.timezone) : formData.date;
    const payload = { ...formData, date: dateValue, timezone: formData.timezone, subdomain: formData.subdomain || makeSubdomain(formData.title) || `event-${Date.now()}`, isEnterpriseMode: mode === 'enterprise' };
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
    <div className="min-h-screen bg-white">
      <style>{`
        @keyframes float-dot {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.18; }
          50%       { transform: translateY(-14px) scale(1.25); opacity: 0.30; }
        }
        @keyframes orb-breathe {
          0%, 100% { transform: scale(1);    }
          50%       { transform: scale(1.09); }
        }
        @keyframes orb-breathe-b {
          0%, 100% { transform: scale(1);    }
          50%       { transform: scale(1.06); }
        }
        @keyframes ring-expand {
          0%, 100% { transform: scale(1);    opacity: 0.07; }
          50%       { transform: scale(1.04); opacity: 0.14; }
        }
        @keyframes shimmer-slide {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(26px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes logo-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(0,0,0,0.06); }
          50%       { box-shadow: 0 0 18px 4px rgba(0,0,0,0.03); }
        }

        .logo-glow  { animation: logo-glow 3s ease-in-out infinite; }
        .orb-a      { animation: orb-breathe   11s ease-in-out infinite; }
        .orb-b      { animation: orb-breathe-b 15s ease-in-out infinite 2s; }
        .orb-c      { animation: orb-breathe   13s ease-in-out infinite 4s; }
        .ring-inner { animation: ring-expand 7s ease-in-out infinite; }
        .ring-outer { animation: ring-expand 9s ease-in-out infinite 1.5s; }
        .dot        { animation: float-dot var(--dur, 10s) ease-in-out infinite var(--delay, 0s); }

        .text-shimmer {
          background: linear-gradient(90deg, #0a0a0a 15%, #555 42%, #0a0a0a 68%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmer-slide 4s ease-in-out infinite;
        }
        .word-effortless {
          background: linear-gradient(120deg, #111 0%, #6b7280 48%, #111 90%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmer-slide 5s ease-in-out infinite;
        }

        /* Hero entrance — each element staggers in */
        .he1 { animation: fade-up 0.9s cubic-bezier(0.22,1,0.36,1) 0.05s both; }
        .he2 { animation: fade-up 0.9s cubic-bezier(0.22,1,0.36,1) 0.20s both; }
        .he3 { animation: fade-up 0.9s cubic-bezier(0.22,1,0.36,1) 0.35s both; }
        .he4 { animation: fade-up 0.9s cubic-bezier(0.22,1,0.36,1) 0.50s both; }
        .he5 { animation: fade-up 0.9s cubic-bezier(0.22,1,0.36,1) 0.65s both; }
      `}</style>

      {/* ── Nav ── */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-2xl border-b border-neutral-200/60 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-9 h-9 rounded-2xl bg-neutral-900 flex items-center justify-center logo-glow">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white animate-pulse" />
            </div>
            <span className="text-xl font-bold text-shimmer">PlanIt</span>
          </div>
          <nav className="flex items-center gap-1">
            {['Terms|/terms','Privacy|/privacy','Admin|/admin'].map(s => {
              const [label, href] = s.split('|');
              return <a key={label} href={href} className="px-3 py-2 text-sm text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl transition-all duration-200">{label}</a>;
            })}
            <a href="/support" className="ml-2 px-5 py-2.5 text-sm font-medium text-white bg-neutral-900 hover:bg-black rounded-xl transition-all duration-200 shadow-md hover:scale-105 flex items-center gap-2">
              <Heart className="w-4 h-4" fill="currentColor" />Support
            </a>
          </nav>
        </div>
      </header>

      <main>

        {/* ══════════════ HERO ══════════════ */}
        <section className="relative overflow-hidden min-h-[92vh] flex items-center bg-[#f8f8f8]">

          {/* Layered aura — no hard edges, everything blends */}
          <div className="absolute inset-0 pointer-events-none" style={{
            background: [
              'radial-gradient(ellipse 75% 55% at 18% 28%, rgba(148,158,255,0.11) 0%, transparent 58%)',
              'radial-gradient(ellipse 65% 48% at 82% 68%, rgba(175,205,255,0.09) 0%, transparent 54%)',
              'radial-gradient(ellipse 55% 70% at 52%  8%, rgba(210,218,255,0.07) 0%, transparent 48%)',
            ].join(',')
          }} />

          {/* Animated orbs */}
          <div className="orb-a absolute pointer-events-none" style={{ top:'16%', left:'7%', width:'680px', height:'680px', background:'radial-gradient(circle, rgba(138,152,255,0.12) 0%, rgba(168,188,255,0.05) 42%, transparent 68%)', filter:'blur(72px)' }} />
          <div className="orb-b absolute pointer-events-none" style={{ top:'50%', right:'5%', width:'540px', height:'540px', background:'radial-gradient(circle, rgba(188,208,255,0.09) 0%, transparent 66%)', filter:'blur(64px)' }} />
          <div className="orb-c absolute pointer-events-none" style={{ bottom:'10%', left:'36%', width:'460px', height:'460px', background:'radial-gradient(circle, rgba(152,172,255,0.07) 0%, transparent 62%)', filter:'blur(56px)' }} />

          {/* Concentric rings */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="ring-inner rounded-full border border-neutral-400/18" style={{ width:'560px', height:'560px' }} />
            <div className="ring-outer absolute rounded-full border border-neutral-300/12" style={{ width:'840px', height:'840px' }} />
          </div>

          {/* Floating dots */}
          {[
            [8,14,'11s','0s'],[22,72,'14s','1.2s'],[38,28,'9s','0.4s'],[55,85,'13s','2.1s'],
            [68,18,'12s','0.8s'],[80,60,'10s','1.7s'],[92,40,'15s','0.2s'],[14,52,'11s','3.0s'],
            [47,45,'16s','1.5s'],[76,80,'12s','0.6s'],
          ].map(([x,y,dur,delay], i) => (
            <div key={i} className="dot absolute rounded-full pointer-events-none"
              style={{ left:`${x}%`, top:`${y}%`, width: i%3===0?'3px':'2px', height: i%3===0?'3px':'2px',
                background:`rgba(${110+i*9},${128+i*6},210,0.26)`, '--dur':dur, '--delay':delay }} />
          ))}

          {/* ── Hero content — perfectly centred ── */}
          <div className="relative w-full">
            <div className="max-w-4xl mx-auto px-6 py-28 text-center">

              {/* Badge */}
              <div className="he1 inline-flex items-center gap-2 px-5 py-2.5 bg-white/95 backdrop-blur-md rounded-full text-xs font-medium text-neutral-500 mb-10 border border-neutral-200/90 shadow-sm hover:shadow-md hover:scale-105 transition-all duration-400 cursor-default">
                <Sparkles className="w-3.5 h-3.5 text-neutral-400" />
                The planning hub teams swear by
              </div>

              {/* Headline */}
              <h1 className="he2 font-black text-neutral-900 leading-[0.93] tracking-tight mb-7"
                style={{ fontSize: 'clamp(3rem, 7.5vw, 5.5rem)' }}>
                Make it{' '}
                <span className="word-effortless">Effortless</span>
                ,{' '}
                <span className="text-shimmer">by design.</span>
              </h1>

              {/* Subtitle */}
              <p className="he3 text-lg md:text-xl text-neutral-500 max-w-lg mx-auto leading-relaxed font-light mb-12">
                The all-in-one workspace for event teams — from first idea to final wrap-up.
              </p>

              {/* CTAs */}
              <div className="he4 flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
                <a href="#create" className="group inline-flex items-center gap-3 px-9 py-4 bg-neutral-900 text-white text-base font-semibold rounded-2xl hover:bg-black hover:scale-105 transition-all duration-400 shadow-lg hover:shadow-xl">
                  Start planning
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-300" />
                </a>
                <a href="#features" className="inline-flex items-center gap-2 px-9 py-4 bg-white/80 backdrop-blur-sm border border-neutral-200 text-neutral-600 text-base font-medium rounded-2xl hover:border-neutral-400 hover:bg-white hover:scale-105 transition-all duration-400 shadow-sm hover:shadow-md">
                  See features <ChevronRight className="w-4 h-4" />
                </a>
              </div>

              {/* Stats */}
              <div className="he5 grid grid-cols-3 gap-4 max-w-md mx-auto">
                {[
                  { value:50000, suffix:'+',  label:'Events planned'   },
                  { value:500,   suffix:'k+', label:'Teams organized'  },
                  { value:100,   suffix:'%',  label:'Success rate'     },
                ].map((stat, i) => (
                  <div key={i} className="text-center p-5 bg-white/70 backdrop-blur-sm rounded-2xl border border-neutral-200/80 hover:border-neutral-300 hover:bg-white hover:shadow-lg transition-all duration-400 cursor-default hover:scale-105">
                    <div className="text-3xl font-black text-neutral-900 mb-1">
                      <AnimatedCounter end={stat.value} suffix={stat.suffix} />
                    </div>
                    <div className="text-xs font-medium text-neutral-500">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom fade */}
          <div className="absolute bottom-0 inset-x-0 h-28 bg-gradient-to-t from-white to-transparent pointer-events-none" />
        </section>

        {/* ══════════════ HOW IT WORKS ══════════════ */}
        <section className="py-20 bg-white">
          <div className="max-w-5xl mx-auto px-6">
            <SectionHeader eyebrow="How teams use it" title="Your event, every step" subtitle="Built for the full arc — months of prep to the final goodbye." />
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { icon:Brain,        phase:'Before', num:'01', title:'Coordinate your team',  desc:'Assign tasks, split expenses, finalize the guest list, share files, and get every detail locked in before the big day.' },
                { icon:Zap,          phase:'During', num:'02', title:'Stay on top of it',     desc:'Quick check-ins, QR guest arrivals, last-minute updates. Your team stays synced while the event runs itself.' },
                { icon:CheckCircle2, phase:'After',  num:'03', title:'Wrap it up right',      desc:'Close expenses, share memories, collect feedback. Every loose end, tied.' },
              ].map((item, i) => (
                <RevealCard key={i} delay={i * 120}>
                  <div className="flex items-start justify-between mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-neutral-100 group-hover:bg-neutral-900 flex items-center justify-center transition-all duration-500">
                      <item.icon className="w-6 h-6 text-neutral-500 group-hover:text-white transition-colors duration-500" />
                    </div>
                    <span className="text-3xl font-black text-neutral-100 group-hover:text-neutral-200 transition-colors duration-500 select-none">{item.num}</span>
                  </div>
                  <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2">{item.phase}</p>
                  <h3 className="text-lg font-bold text-neutral-900 mb-3">{item.title}</h3>
                  <p className="text-sm text-neutral-500 leading-relaxed">{item.desc}</p>
                </RevealCard>
              ))}
            </div>
          </div>
        </section>

        {/* ══════════════ FEATURES ══════════════ */}
        <section id="features" className="py-28 bg-neutral-50">
          <div className="max-w-7xl mx-auto px-6">
            <SectionHeader eyebrow="Features" title="Everything you need" subtitle="Powerful tools for seamless event planning and coordination" />
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <FeatureCard icon={MessageSquare} title="Real-time team chat"     description="Instant messaging with typing indicators, reactions, and threaded conversations. Keep your planning team connected and aligned." delay={0}   />
              <FeatureCard icon={ListChecks}   title="Task management"         description="Create checklists, assign tasks, set deadlines, and track completion. Never miss a critical planning milestone."                  delay={80}  />
              <FeatureCard icon={BarChart3}    title="Quick polls and voting"   description="Make team decisions faster with live polls. Vote on venues, dates, menus, and more — see results instantly."                      delay={160} />
              <FeatureCard icon={FileText}     title="Unlimited file sharing"  description="Share contracts, floor plans, schedules, and more. Everything your team needs in one organized space."                            delay={240} />
              <FeatureCard icon={Clock}        title="Timeline and scheduling" description="Build your event timeline, coordinate arrival times, and manage your run-of-show with precision."                                  delay={320} />
              <FeatureCard icon={Users}        title="Unlimited participants"  description="No limits on team size. Bring your entire planning committee, vendors, volunteers — everyone who needs to be involved."            delay={400} />
            </div>
          </div>
        </section>

        {/* ══════════════ ENTERPRISE ══════════════ */}
        <section className="py-28 bg-white">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <RevealDiv>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-100 rounded-full text-xs font-bold text-neutral-700 mb-8">
                  <Zap className="w-4 h-4" />Enterprise Mode
                </div>
                <h2 className="text-5xl font-black text-neutral-900 mb-6 leading-tight">Built for large-scale events</h2>
                <p className="text-xl text-neutral-500 mb-10 leading-relaxed">
                  Hosting a wedding, conference, or corporate event? Enterprise Mode gives you professional-grade tools for managing hundreds of guests.
                </p>
                <div className="space-y-4">
                  {[
                    { icon:CheckCircle2, text:'QR code-based guest check-in system' },
                    { icon:Users,        text:'Personalized digital invitations for each guest' },
                    { icon:TrendingUp,   text:'Real-time attendance analytics dashboard' },
                    { icon:Timer,        text:'Track check-in times and flow metrics' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-4 p-4 bg-neutral-50 rounded-2xl border border-neutral-200 hover:border-neutral-300 hover:shadow-md transition-all duration-300 hover:scale-[1.02]">
                      <div className="w-10 h-10 rounded-xl bg-neutral-900 flex items-center justify-center flex-shrink-0">
                        <item.icon className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-neutral-700 font-medium">{item.text}</span>
                    </div>
                  ))}
                </div>
              </RevealDiv>

              <RevealDiv delay={140} className="relative">
                <div className="bg-white rounded-3xl border border-neutral-200 p-10 shadow-xl hover:shadow-2xl transition-all duration-500 hover:scale-[1.02]">
                  <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-full text-sm font-bold text-emerald-800 mb-6 animate-pulse">
                      <CheckCircle2 className="w-4 h-4" />Guest Check-in Active
                    </div>
                    <h3 className="text-2xl font-bold text-neutral-900 mb-1">Sarah Johnson</h3>
                    <p className="text-neutral-500 text-sm">Party of 4 · Table 12</p>
                  </div>
                  <div className="bg-neutral-50 rounded-2xl p-8 border border-neutral-200">
                    <div className="w-52 h-52 mx-auto bg-white rounded-2xl grid grid-cols-8 grid-rows-8 gap-1 p-3 shadow-inner">
                      {[...Array(64)].map((_, i) => <div key={i} className={`rounded-sm ${Math.random()>0.5?'bg-neutral-900':'bg-white'}`} />)}
                    </div>
                  </div>
                  <div className="mt-8 text-center space-y-3">
                    <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">Invite Code</p>
                    <p className="text-2xl font-mono font-black text-neutral-900 tracking-wider">AB12CD34</p>
                    <button className="px-6 py-3 bg-neutral-900 text-white rounded-xl font-medium hover:bg-black transition-all hover:scale-105 shadow-md">Scan to Check In</button>
                  </div>
                </div>
                <div className="absolute -top-6 -right-6 w-28 h-28 bg-indigo-100 rounded-full blur-3xl opacity-50 animate-pulse" />
                <div className="absolute -bottom-6 -left-6 w-36 h-36 bg-blue-100 rounded-full blur-3xl opacity-40 animate-pulse" style={{ animationDelay:'1s' }} />
              </RevealDiv>
            </div>
          </div>
        </section>

        {/* ══════════════ TESTIMONIALS ══════════════ */}
        <section className="py-28 bg-neutral-50">
          <div className="max-w-7xl mx-auto px-6">
            <SectionHeader eyebrow="Testimonials" title="Trusted by event planners" subtitle="See how teams are using PlanIt to execute flawless events" />
            <div className="grid md:grid-cols-3 gap-6">
              <TestimonialCard quote="PlanIt transformed how we coordinated our annual company conference. The task management kept our 15-person planning team organized for 6 months of prep. The QR check-in on event day was seamless for our 300 attendees. We saved countless hours compared to email chains and spreadsheets." author="Michael Chen" role="Senior Event Coordinator" event="Tech Summit 2025" delay={0} />
              <TestimonialCard quote="As a wedding planner, I've used every tool out there. PlanIt stands out because it doesn't require my couples or vendors to create accounts — huge win. We used it for 4 months of planning: coordinating with 8 vendors, managing 200+ guest invites, tracking deposits and payments." author="Sarah Williams" role="Lead Wedding Planner" event="Williams-Martinez Wedding" delay={120} />
              <TestimonialCard quote="Our nonprofit used PlanIt to coordinate a 500-person fundraising gala. The unlimited participant feature meant we could include our entire board, 30 volunteers, all vendors, and staff. We planned for 3 months using the chat, polls for decision-making, and task lists." author="David Martinez" role="Development Director" event="Charity Gala 2025" delay={240} />
            </div>
          </div>
        </section>

        {/* ══════════════ CREATE EVENT ══════════════ */}
        <section id="create" className="py-28 bg-white">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid lg:grid-cols-2 gap-20 items-start">

              {/* Left */}
              <div className="lg:sticky lg:top-24">
                <div className="mb-10">
                  <h2 className="text-5xl font-black text-neutral-900 mb-6 tracking-tight leading-tight">
                    {created ? 'Event created!' : 'Start planning your event'}
                  </h2>
                  <p className="text-xl text-neutral-500 leading-relaxed">
                    {created
                      ? 'Your planning hub is ready. Share the link with your team and get started.'
                      : 'Create your event workspace in 60 seconds. No credit card, no hassle, just start planning.'}
                  </p>
                </div>

                {!created && (
                  <>
                    <div className="grid grid-cols-3 gap-4 mb-10">
                      {[{icon:Clock,label:'60 seconds'},{icon:Shield,label:'Secure'},{icon:Gift,label:'Free forever'}].map((item,i) => (
                        <div key={i} className="text-center p-5 bg-neutral-50 rounded-2xl border border-neutral-200 hover:border-neutral-300 hover:shadow-md transition-all duration-300 hover:scale-105">
                          <item.icon className="w-6 h-6 text-neutral-600 mx-auto mb-2" />
                          <p className="text-sm font-semibold text-neutral-700">{item.label}</p>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-3 p-8 bg-neutral-50 rounded-3xl border border-neutral-200">
                      <p className="text-base font-bold text-neutral-900 mb-4">Everything included:</p>
                      {['Private event space with custom branded URL','Unlimited team members — no caps','Real-time chat with file sharing','Task lists and deadline tracking','Polls, voting, and decision tools','RSVP management and tracking','Expense splitting and budgets','QR check-in for large events','Timeline and scheduling tools','Post-event photo sharing'].map((item,i) => (
                        <div key={i} className="flex items-start gap-3 text-sm text-neutral-700">
                          <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                          <span className="leading-relaxed">{item}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {created && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-center p-10 bg-emerald-50 rounded-3xl border border-emerald-200">
                      <div className="text-center">
                        <div className="w-20 h-20 mx-auto mb-5 rounded-full bg-emerald-500 flex items-center justify-center animate-bounce shadow-lg">
                          <Check className="w-10 h-10 text-white" />
                        </div>
                        <p className="text-lg font-bold text-emerald-900">{mode==='enterprise'?'Enterprise event created!':'Your planning hub is live!'}</p>
                      </div>
                    </div>
                    {mode==='enterprise' ? (
                      <div className="p-8 bg-neutral-50 border border-neutral-200 rounded-3xl">
                        <div className="flex items-start gap-4">
                          <Zap className="w-6 h-6 text-neutral-700 flex-shrink-0 mt-1" />
                          <div>
                            <p className="text-base font-bold text-neutral-900 mb-4">Next steps for Enterprise Mode:</p>
                            <ol className="text-sm text-neutral-700 space-y-3 list-decimal ml-5">
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
                        <p className="text-sm font-bold text-neutral-700 mb-3">Your event link:</p>
                        <CopyLinkBox eventId={created.id} subdomain={created.subdomain} />
                        <p className="text-xs text-neutral-500 mt-3">Share this link with your planning team to get started</p>
                      </div>
                    )}
                    <button onClick={() => navigate(created.subdomain?`/e/${created.subdomain}`:`/event/${created.id}`)}
                      className="w-full px-8 py-5 bg-neutral-900 text-white rounded-2xl font-bold hover:scale-105 hover:bg-black transition-all duration-300 shadow-xl flex items-center justify-center gap-3 text-lg">
                      {mode==='enterprise'?'Set Up Guest Invites':'Enter your planning hub'}
                      <ArrowUpRight className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Right — form */}
              {!created && (
                <div className="bg-white rounded-3xl border border-neutral-200 p-10 shadow-xl sticky top-24 hover:shadow-2xl transition-shadow duration-500">
                  <div className="mb-8 p-5 bg-neutral-50 rounded-2xl border border-neutral-200">
                    <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-4">Event Type</label>
                    <div className="grid grid-cols-2 gap-3">
                      {[{val:'standard',label:'Standard',sub:'Team planning'},{val:'enterprise',label:'Enterprise',sub:'Full Execution'}].map(({val,label,sub}) => (
                        <button key={val} type="button" onClick={() => setMode(val)}
                          className={`px-5 py-4 text-sm font-bold rounded-2xl border-2 transition-all duration-300 ${mode===val?'bg-neutral-900 text-white border-neutral-900 shadow-lg scale-[1.03]':'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400 hover:scale-[1.02]'}`}>
                          <div className="font-bold mb-1">{label}</div>
                          <div className="text-xs opacity-70">{sub}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                      <label className="block text-sm font-bold text-neutral-700 mb-2">Event title <span className="text-red-500">*</span></label>
                      <input type="text" required className="input text-base" placeholder="Summer Company Retreat 2025" value={formData.title} onChange={handleTitleChange} />
                      {formData.title && formData.subdomain && (
                        <div className="mt-2 flex items-center gap-2 text-xs text-neutral-500 bg-neutral-50 px-3 py-2 rounded-lg">
                          <Link className="w-3 h-3 flex-shrink-0" />
                          <span className="font-mono truncate">{window.location.origin}/e/<span className="text-neutral-800 font-bold">{formData.subdomain}</span></span>
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-neutral-700 mb-2">Description</label>
                      <textarea className="input resize-none text-base" rows="3" placeholder="What's this event about? Add details to help your team understand the scope..." value={formData.description} onChange={update('description')} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-neutral-700 mb-2">Date and time <span className="text-red-500">*</span></label>
                        <input type="datetime-local" required className="input" value={formData.date} onChange={update('date')} />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-neutral-700 mb-2">Timezone <span className="text-red-500">*</span></label>
                        <select required className="input" value={formData.timezone} onChange={update('timezone')}>
                          {getTimezoneOptions().map(tz => (
                            <option key={tz.value} value={tz.value}>{tz.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-neutral-700 mb-2">Location</label>
                      <input type="text" className="input" placeholder="Central Park, NYC" value={formData.location} onChange={update('location')} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-neutral-700 mb-2">Your name <span className="text-red-500">*</span></label>
                        <input type="text" required className="input" placeholder="Alex Smith" value={formData.organizerName} onChange={update('organizerName')} />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-neutral-700 mb-2">Your email <span className="text-red-500">*</span></label>
                        <input type="email" required className="input" placeholder="alex@company.com" value={formData.organizerEmail} onChange={update('organizerEmail')} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-neutral-700 mb-2">
                        <span className="flex items-center gap-2"><Lock className="w-4 h-4 text-neutral-400" />Account Password <span className="text-red-500">*</span></span>
                      </label>
                      <div className="relative">
                        <input type={showAccountPassword?'text':'password'} required className="input pr-12" placeholder="Create a secure password (min 4 characters)" value={formData.accountPassword} onChange={update('accountPassword')} minLength={4} />
                        <button type="button" onClick={() => setShowAccountPassword(!showAccountPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 transition-colors">
                          {showAccountPassword?<EyeOff className="w-5 h-5" />:<Eye className="w-5 h-5" />}
                        </button>
                      </div>
                      <p className="text-xs text-neutral-500 mt-2">Required to access this event from other devices or browsers</p>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-neutral-700 mb-2">
                        <span className="flex items-center gap-2"><Shield className="w-4 h-4 text-neutral-400" />Event Password <span className="text-neutral-400 font-normal text-xs">(optional)</span></span>
                      </label>
                      <div className="relative">
                        <input type={showPassword?'text':'password'} className="input pr-12" placeholder={mode==='enterprise'?'Add layer of security':'Leave empty for open access'} value={formData.password} onChange={update('password')} />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 transition-colors">
                          {showPassword?<EyeOff className="w-5 h-5" />:<Eye className="w-5 h-5" />}
                        </button>
                      </div>
                      {mode==='enterprise' && <p className="text-xs text-neutral-500 mt-2">Enterprise uses QR invites — this adds an extra security layer</p>}
                    </div>
                    <button type="submit" disabled={loading}
                      className="w-full px-8 py-5 bg-neutral-900 text-white rounded-2xl font-bold hover:scale-105 hover:bg-black transition-all duration-300 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-3 text-lg">
                      {loading ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating your hub...</> : <>Create event<ArrowRight className="w-5 h-5" /></>}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ══════════════ FOOTER ══════════════ */}
        <footer className="border-t border-neutral-200 bg-neutral-50">
          <div className="max-w-7xl mx-auto px-6 py-16">
            <div className="grid md:grid-cols-4 gap-12 mb-12">
              <div>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-2xl bg-neutral-900 flex items-center justify-center"><Calendar className="w-5 h-5 text-white" /></div>
                  <span className="font-black text-xl text-neutral-900">PlanIt</span>
                </div>
                <p className="text-sm text-neutral-500 leading-relaxed mb-4">The ultimate planning hub for event teams. Plan smart, execute flawlessly.</p>
                <p className="text-xs text-neutral-400">Made with <Coffee className="w-4 h-4 inline" /> not ❤️</p>
              </div>
              <div>
                <h3 className="text-xs font-bold text-neutral-900 mb-5 uppercase tracking-wider">Product</h3>
                <ul className="space-y-3 text-sm text-neutral-500">
                  {[['Features','#features'],['Get Started','#create'],['Support','/support']].map(([l,h]) => <li key={l}><a href={h} className="hover:text-neutral-900 transition-colors">{l}</a></li>)}
                </ul>
              </div>
              <div>
                <h3 className="text-xs font-bold text-neutral-900 mb-5 uppercase tracking-wider">Company</h3>
                <ul className="space-y-3 text-sm text-neutral-500">
                  {[['Terms of Service','/terms'],['Privacy Policy','/privacy'],['Admin Login','/admin']].map(([l,h]) => <li key={l}><a href={h} className="hover:text-neutral-900 transition-colors">{l}</a></li>)}
                </ul>
              </div>
              <div>
                <h3 className="text-xs font-bold text-neutral-900 mb-5 uppercase tracking-wider">Connect</h3>
                <ul className="space-y-3 text-sm text-neutral-500">
                  {[['Contact Us','/support'],['Wall of Supporters','/support/wall']].map(([l,h]) => <li key={l}><a href={h} className="hover:text-neutral-900 transition-colors">{l}</a></li>)}
                </ul>
              </div>
            </div>
            <div className="pt-8 border-t border-neutral-200 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-neutral-400">
              <span>© 2026 PlanIt. All rights reserved.</span>
              <span className="font-medium">By Aakshat Hariharan</span>
            </div>
          </div>
        </footer>

      </main>
    </div>
  );
}

/* ──────────────────────────────────────────────────
   Helper components (defined after default export
   so hooks still work fine in same module scope)
────────────────────────────────────────────────── */

function useScrollRevealInner(threshold = 0.1) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.unobserve(el); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, visible];
}

function SectionHeader({ eyebrow, title, subtitle }) {
  const [ref, visible] = useScrollRevealInner(0.1);
  return (
    <div ref={ref} className={`text-center mb-16 transition-all duration-900 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
      {eyebrow && <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-3">{eyebrow}</p>}
      <h2 className="text-5xl md:text-6xl font-black text-neutral-900 mb-5">{title}</h2>
      {subtitle && <p className="text-xl text-neutral-500 max-w-xl mx-auto">{subtitle}</p>}
    </div>
  );
}

function RevealCard({ children, delay = 0 }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setTimeout(() => setVisible(true), delay); obs.unobserve(el); } },
      { threshold: 0.08 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [delay]);
  return (
    <div ref={ref} className={`group relative p-8 bg-white rounded-3xl border border-neutral-200 hover:border-neutral-300 hover:shadow-xl transition-all duration-700 ease-out hover:scale-[1.03] ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      {children}
    </div>
  );
}

function RevealDiv({ children, delay = 0, className = '' }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setTimeout(() => setVisible(true), delay); obs.unobserve(el); } },
      { threshold: 0.08 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [delay]);
  return (
    <div ref={ref} className={`${className} transition-all duration-900 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
      {children}
    </div>
  );
}
