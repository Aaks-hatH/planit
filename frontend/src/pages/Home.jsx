import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar, Users, MessageSquare, BarChart3, FileText, Shield, Copy, Check, Lock, 
  ArrowRight, Link, Eye, EyeOff, ChevronRight, Sparkles, Zap, Clock, 
  CheckCircle2, Star, TrendingUp, Globe, Smartphone, Award, Target, Gift,
  Code, Palette, Rocket, Heart, Coffee, ListChecks, Timer, ClipboardList,
  Brain, Lightbulb, ArrowUpRight
} from 'lucide-react';
import { eventAPI } from '../services/api';
import toast from 'react-hot-toast';

// Auto-generate a URL-safe slug from a title
function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 40);
}

// Add a short random suffix to avoid collisions
function makeSubdomain(title) {
  const slug = slugify(title);
  if (!slug) return '';
  const suffix = Math.random().toString(36).substring(2, 6);
  return `${slug}-${suffix}`;
}

// Animated gradient background that responds to scroll
function AnimatedGradientBackground() {
  const [scrollY, setScrollY] = useState(0);
  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    const handleMouseMove = (e) => {
      setMouseX(e.clientX);
      setMouseY(e.clientY);
    };

    window.addEventListener('scroll', handleScroll);
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  const gradientOpacity = Math.min(scrollY / 500, 0.6);
  const hue = (scrollY / 10) % 360;
  const mouseXPercent = (mouseX / window.innerWidth) * 100;
  const mouseYPercent = (mouseY / window.innerHeight) * 100;

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Animated gradient orbs */}
      <div 
        className="absolute transition-all duration-1000 ease-out"
        style={{
          top: `${20 + scrollY * 0.05}%`,
          left: `${10 + mouseXPercent * 0.2}%`,
          width: '600px',
          height: '600px',
          background: `radial-gradient(circle, hsla(${hue}, 70%, 60%, ${0.15 + gradientOpacity}) 0%, transparent 70%)`,
          filter: 'blur(60px)',
          transform: `translate(-50%, -50%) scale(${1 + scrollY * 0.0005})`,
        }}
      />
      <div 
        className="absolute transition-all duration-1000 ease-out"
        style={{
          top: `${60 - scrollY * 0.03}%`,
          right: `${10 + mouseYPercent * 0.15}%`,
          width: '500px',
          height: '500px',
          background: `radial-gradient(circle, hsla(${(hue + 120) % 360}, 70%, 60%, ${0.1 + gradientOpacity}) 0%, transparent 70%)`,
          filter: 'blur(60px)',
          transform: `translate(50%, -50%) scale(${1 + scrollY * 0.0003})`,
        }}
      />
      <div 
        className="absolute transition-all duration-1000 ease-out"
        style={{
          bottom: `${10 + scrollY * 0.02}%`,
          left: `${50 + mouseXPercent * 0.1}%`,
          width: '400px',
          height: '400px',
          background: `radial-gradient(circle, hsla(${(hue + 240) % 360}, 70%, 60%, ${0.12 + gradientOpacity}) 0%, transparent 70%)`,
          filter: 'blur(60px)',
          transform: `translate(-50%, 50%) scale(${1 + scrollY * 0.0004})`,
        }}
      />
      
      {/* Floating particles with animation */}
      {[...Array(25)].map((_, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 bg-neutral-400 rounded-full"
          style={{
            left: `${(i * 13 + mouseXPercent * 0.1) % 100}%`,
            top: `${(i * 17 + scrollY * 0.1) % 100}%`,
            opacity: 0.15 + Math.sin(scrollY * 0.01 + i) * 0.1,
            animation: `float-particle ${8 + i % 5}s ease-in-out infinite`,
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
    </div>
  );
}

// Animated number counter
function AnimatedCounter({ end, duration = 2000, suffix = '' }) {
  const [count, setCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    let startTime;
    let animationFrame;

    const animate = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const progress = timestamp - startTime;
      const percentage = Math.min(progress / duration, 1);
      
      setCount(Math.floor(end * percentage));

      if (percentage < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [isVisible, end, duration]);

  return (
    <span ref={ref} className="tabular-nums">
      {count}{suffix}
    </span>
  );
}

// Animated feature card with intersection observer
function FeatureCard({ icon: Icon, title, description, delay = 0 }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setIsVisible(true), delay);
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, [delay]);

  return (
    <div 
      ref={ref}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`group relative p-8 rounded-3xl border border-neutral-200 bg-white/80 backdrop-blur-sm hover:border-neutral-300 transition-all duration-700 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
      } ${isHovered ? 'shadow-2xl scale-105' : 'shadow-sm'}`}
    >
      {/* Animated gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-neutral-50/50 to-transparent rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      {/* Icon container with complex animation */}
      <div className="relative mb-5">
        <div className="w-14 h-14 rounded-2xl bg-neutral-100 flex items-center justify-center group-hover:bg-neutral-900 transition-all duration-500 group-hover:scale-110 group-hover:rotate-6">
          <Icon className="w-7 h-7 text-neutral-600 group-hover:text-white transition-colors duration-500" />
        </div>
        {/* Multiple animated rings on hover */}
        <div className="absolute inset-0 w-14 h-14 rounded-2xl border-2 border-neutral-300 opacity-0 group-hover:opacity-30 group-hover:scale-125 transition-all duration-700" />
        <div className="absolute inset-0 w-14 h-14 rounded-2xl border-2 border-neutral-400 opacity-0 group-hover:opacity-20 group-hover:scale-150 transition-all duration-1000" />
      </div>

      <h3 className="relative text-lg font-semibold text-neutral-900 mb-3 group-hover:text-neutral-900 transition-colors duration-300">
        {title}
      </h3>
      <p className="relative text-sm text-neutral-600 leading-relaxed">
        {description}
      </p>
    </div>
  );
}

// Enhanced testimonial card with longer reviews
function TestimonialCard({ quote, author, role, event, delay = 0 }) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setIsVisible(true), delay);
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (ref.current) {
        observer.unobserve(ref.current);
      }
    };
  }, [delay]);

  return (
    <div
      ref={ref}
      className={`p-8 rounded-3xl bg-white/90 backdrop-blur-sm border border-neutral-200 hover:border-neutral-300 hover:shadow-2xl transition-all duration-700 ${
        isVisible ? 'opacity-100 translate-x-0 rotate-0' : 'opacity-0 translate-x-8 rotate-2'
      }`}
    >
      <div className="flex items-start gap-4 mb-5">
        <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-neutral-800 to-neutral-900 flex items-center justify-center shadow-lg">
          <span className="text-base font-bold text-white">{author.charAt(0)}</span>
        </div>
        <div>
          <p className="text-base font-semibold text-neutral-900">{author}</p>
          <p className="text-xs text-neutral-500">{role}</p>
          <p className="text-xs text-neutral-400 mt-0.5">{event}</p>
        </div>
      </div>
      <p className="text-sm text-neutral-700 leading-relaxed mb-4">"{quote}"</p>
      <div className="flex items-center gap-1">
        {[...Array(5)].map((_, i) => (
          <Star key={i} className="w-4 h-4 text-amber-400 fill-amber-400" />
        ))}
      </div>
    </div>
  );
}

// Copy link box with animation
function CopyLinkBox({ eventId, subdomain }) {
  const [copied, setCopied] = useState(false);
  const link = subdomain
    ? `${window.location.origin}/e/${subdomain}`
    : `${window.location.origin}/event/${eventId}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success('Link copied');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-3 rounded-2xl border border-neutral-200 overflow-hidden bg-neutral-50/50 hover:border-neutral-300 transition-all duration-300 hover:shadow-lg">
      <div className="flex items-center gap-3 px-5 py-4">
        <Link className="w-4 h-4 text-neutral-400 flex-shrink-0" />
        <span className="flex-1 text-sm text-neutral-700 font-mono truncate">{link}</span>
        <button
          onClick={handleCopy}
          className={`flex-shrink-0 flex items-center gap-2 px-5 py-2.5 text-xs font-medium rounded-xl transition-all duration-300 ${
            copied 
              ? 'bg-emerald-500 text-white scale-105' 
              : 'bg-neutral-900 text-white hover:bg-black hover:scale-105'
          }`}
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5" />
              Copied
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              Copy
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('standard');
  const [formData, setFormData] = useState({
    subdomain: '',
    title: '',
    description: '',
    date: '',
    location: '',
    organizerName: '',
    organizerEmail: '',
    accountPassword: '',
    password: '',
    isEnterpriseMode: false,
    maxParticipants: 10000 // Removed limit - set to high default
  });
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showAccountPassword, setShowAccountPassword] = useState(false);

  const handleTitleChange = (e) => {
    const title = e.target.value;
    setFormData(prev => ({
      ...prev,
      title,
      subdomain: prev._subdomainTouched ? prev.subdomain : makeSubdomain(title)
    }));
  };

  const update = (field) => (e) =>
    setFormData(prev => ({
      ...prev,
      [field]: e.target.value,
      ...(field === 'subdomain' ? { _subdomainTouched: true } : {})
    }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const dateValue = formData.date ? new Date(formData.date).toISOString() : formData.date;

    const payload = {
      ...formData,
      date: dateValue,
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
      if (msg.includes('already taken')) {
        setFormData(prev => ({ ...prev, subdomain: makeSubdomain(prev.title) }));
      }
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Custom animations CSS */}
      <style>{`
        @keyframes float-particle {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.08; }
          33% { transform: translate(12px, -18px) scale(1.4); opacity: 0.18; }
          66% { transform: translate(-8px, -28px) scale(0.8); opacity: 0.12; }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(0, 0, 0, 0.08); }
          50% { box-shadow: 0 0 24px 6px rgba(0, 0, 0, 0.04); }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes hero-fade-up {
          0% { opacity: 0; transform: translateY(32px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes orb-drift {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50% { transform: translate(-50%, -50%) scale(1.12); }
        }
        @keyframes orb-drift-2 {
          0%, 100% { transform: translate(50%, -50%) scale(1); }
          50% { transform: translate(50%, -50%) scale(1.08); }
        }
        @keyframes orb-drift-3 {
          0%, 100% { transform: translate(-50%, 50%) scale(1); }
          50% { transform: translate(-50%, 50%) scale(1.15); }
        }
        @keyframes ring-pulse {
          0%, 100% { opacity: 0.06; transform: scale(1); }
          50% { opacity: 0.16; transform: scale(1.05); }
        }
        .animate-pulse-glow {
          animation: pulse-glow 3s ease-in-out infinite;
        }
        .text-shimmer {
          background: linear-gradient(90deg, #0a0a0a 20%, #6b7280 45%, #0a0a0a 70%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmer 4s ease-in-out infinite;
        }
        .hero-aura {
          position: absolute;
          inset: 0;
          background: 
            radial-gradient(ellipse 80% 60% at 20% 30%, rgba(160,170,255,0.10) 0%, transparent 60%),
            radial-gradient(ellipse 70% 50% at 80% 70%, rgba(180,210,255,0.08) 0%, transparent 55%),
            radial-gradient(ellipse 60% 80% at 50% 5%, rgba(210,220,255,0.07) 0%, transparent 50%);
          pointer-events: none;
        }
        .hero-enter-1 { animation: hero-fade-up 1s cubic-bezier(0.22, 1, 0.36, 1) 0.1s both; }
        .hero-enter-2 { animation: hero-fade-up 1s cubic-bezier(0.22, 1, 0.36, 1) 0.28s both; }
        .hero-enter-3 { animation: hero-fade-up 1s cubic-bezier(0.22, 1, 0.36, 1) 0.46s both; }
        .hero-enter-4 { animation: hero-fade-up 1s cubic-bezier(0.22, 1, 0.36, 1) 0.62s both; }
        .hero-enter-5 { animation: hero-fade-up 1s cubic-bezier(0.22, 1, 0.36, 1) 0.78s both; }
        .hero-enter-6 { animation: hero-fade-up 1s cubic-bezier(0.22, 1, 0.36, 1) 0.94s both; }
        .orb-1 { animation: orb-drift 10s ease-in-out infinite; }
        .orb-2 { animation: orb-drift-2 14s ease-in-out infinite; }
        .orb-3 { animation: orb-drift-3 17s ease-in-out infinite; }
        .hero-ring { animation: ring-pulse 7s ease-in-out infinite; }
        .hero-ring-2 { animation: ring-pulse 9s ease-in-out infinite 1.5s; }
        .effortless-word {
          background: linear-gradient(135deg, #1a1a1a 0%, #4a5568 40%, #1a1a1a 80%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: shimmer 5s ease-in-out infinite;
        }
      `}</style>

      {/* Navigation */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-2xl border-b border-neutral-200/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-neutral-800 to-neutral-900 flex items-center justify-center shadow-lg animate-pulse-glow">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white animate-pulse" />
            </div>
            <span className="text-xl font-bold text-shimmer">
              PlanIt
            </span>
          </div>
          <nav className="flex items-center gap-1">
            <a href="/terms" className="px-3 py-2 text-sm text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl transition-all">
              Terms
            </a>
            <a href="/privacy" className="px-3 py-2 text-sm text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl transition-all">
              Privacy
            </a>
            <a href="/admin" className="px-3 py-2 text-sm text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl transition-all">
              Admin
            </a>
            <a href="/support" className="ml-2 px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-neutral-800 to-neutral-900 hover:from-neutral-900 hover:to-black rounded-xl transition-all shadow-lg hover:shadow-2xl hover:scale-105 flex items-center gap-2">
              <Heart className="w-4 h-4" fill="currentColor" />
              Support
            </a>
          </nav>
        </div>
      </header>

      <main className="relative">
        {/* Hero Section — Aura Edition */}
        <section className="relative overflow-hidden min-h-[92vh] flex items-center bg-[#fafafa]">
          {/* Deep ambient aura layer */}
          <div className="hero-aura" />

          {/* Soft grain texture */}
          <div 
            className="absolute inset-0 pointer-events-none opacity-[0.025]"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'repeat',
            }}
          />

          {/* Large glowing orbs — softly animated, seamlessly blended */}
          <div 
            className="absolute orb-1 pointer-events-none"
            style={{
              top: '22%', left: '12%',
              width: '700px', height: '700px',
              background: 'radial-gradient(circle, rgba(148,163,255,0.13) 0%, rgba(180,200,255,0.06) 40%, transparent 70%)',
              filter: 'blur(80px)',
            }}
          />
          <div 
            className="absolute orb-2 pointer-events-none"
            style={{
              top: '55%', right: '8%',
              width: '560px', height: '560px',
              background: 'radial-gradient(circle, rgba(200,215,255,0.10) 0%, rgba(210,225,255,0.04) 40%, transparent 70%)',
              filter: 'blur(70px)',
            }}
          />
          <div 
            className="absolute orb-3 pointer-events-none"
            style={{
              bottom: '10%', left: '40%',
              width: '480px', height: '480px',
              background: 'radial-gradient(circle, rgba(160,180,255,0.08) 0%, transparent 65%)',
              filter: 'blur(60px)',
            }}
          />

          {/* Subtle concentric ring auras centered on heading */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div 
              className="hero-ring rounded-full border border-neutral-300/40"
              style={{ width: '600px', height: '600px' }}
            />
            <div 
              className="absolute hero-ring-2 rounded-full border border-neutral-200/30"
              style={{ width: '900px', height: '900px' }}
            />
          </div>

          {/* Floating particles — subtle, eased */}
          {[...Array(18)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full pointer-events-none"
              style={{
                left: `${(i * 17 + 5) % 95}%`,
                top: `${(i * 23 + 8) % 88}%`,
                width: i % 3 === 0 ? '3px' : '2px',
                height: i % 3 === 0 ? '3px' : '2px',
                background: `rgba(${100 + i * 8}, ${120 + i * 5}, ${200 + i * 2}, 0.25)`,
                animation: `float-particle ${10 + (i % 6) * 2}s ease-in-out infinite`,
                animationDelay: `${i * 0.6}s`,
              }}
            />
          ))}

          <div className="relative max-w-7xl mx-auto px-6 py-32 w-full">
            <div className="text-center max-w-5xl mx-auto">

              {/* Badge */}
              <div className="hero-enter-1 inline-flex items-center gap-2 px-5 py-2.5 bg-white/90 backdrop-blur-md rounded-full text-xs font-medium text-neutral-500 mb-10 border border-neutral-200/80 shadow-sm hover:shadow-md hover:scale-105 transition-all duration-500 cursor-default">
                <Sparkles className="w-3.5 h-3.5 text-neutral-400" style={{ animation: 'ring-pulse 3s ease-in-out infinite' }} />
                <span>The planning hub teams swear by</span>
              </div>

              {/* Main heading */}
              <h1 className="hero-enter-2 text-6xl md:text-7xl lg:text-[5.5rem] font-black text-neutral-900 mb-6 tracking-tight leading-[0.93]">
                <span className="block mb-2">Plan it right,</span>
                <span className="block text-shimmer">Execute it bright</span>
              </h1>

              {/* Tagline — "Effortless, by design." */}
              <p className="hero-enter-3 text-2xl md:text-3xl font-light tracking-wide mb-6" style={{ color: '#6b7280', letterSpacing: '0.04em' }}>
                <span className="effortless-word font-semibold">Effortless</span>
                <span className="text-neutral-300 mx-2">,</span>
                <span className="text-neutral-400">by design.</span>
              </p>

              {/* Subtitle */}
              <p className="hero-enter-4 text-lg md:text-xl text-neutral-500 mb-12 max-w-2xl mx-auto leading-relaxed font-light">
                The all-in-one workspace for event teams — from first idea to final wrap-up.
              </p>

              {/* CTA Buttons */}
              <div className="hero-enter-5 flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
                <a href="#create" className="group px-10 py-4.5 bg-neutral-900 text-white rounded-2xl font-semibold hover:scale-105 hover:bg-black transition-all duration-500 shadow-xl hover:shadow-neutral-900/30 flex items-center gap-3 text-base" style={{ paddingTop: '1.1rem', paddingBottom: '1.1rem' }}>
                  Start planning
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1.5 transition-transform duration-300" />
                </a>
                <a href="#features" className="px-10 py-4.5 bg-white/70 backdrop-blur-sm border border-neutral-200 text-neutral-600 rounded-2xl font-medium hover:border-neutral-400 hover:bg-white hover:scale-105 transition-all duration-500 shadow-sm hover:shadow-md flex items-center gap-3 text-base" style={{ paddingTop: '1.1rem', paddingBottom: '1.1rem' }}>
                  See features
                  <ChevronRight className="w-4 h-4" />
                </a>
              </div>

              {/* Stats */}
              <div className="hero-enter-6 grid grid-cols-3 gap-5 max-w-2xl mx-auto">
                {[
                  { value: 50000, suffix: '+', label: 'Events planned' },
                  { value: 500, suffix: 'k+', label: 'Teams organized' },
                  { value: 100, suffix: '%', label: 'Success rate' },
                ].map((stat, idx) => (
                  <div 
                    key={idx}
                    className="text-center p-5 bg-white/60 backdrop-blur-sm rounded-2xl border border-neutral-200/70 hover:border-neutral-300 hover:scale-105 hover:bg-white/90 hover:shadow-lg transition-all duration-500 cursor-default"
                  >
                    <div className="text-3xl md:text-4xl font-black text-neutral-900 mb-1">
                      <AnimatedCounter end={stat.value} suffix={stat.suffix} />
                    </div>
                    <div className="text-xs font-medium text-neutral-500">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom gradient fade to white */}
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent pointer-events-none" />
        </section>

        {/* How It Works — naturally integrated, no harsh disclaimer */}
        <section className="py-20 bg-white relative">
          <div className="max-w-5xl mx-auto px-6">
            <div className="text-center mb-14">
              <p className="text-xs font-semibold text-neutral-400 uppercase tracking-widest mb-4">How teams use it</p>
              <h2 className="text-4xl md:text-5xl font-black text-neutral-900 mb-5">
                Your event, every step
              </h2>
              <p className="text-lg text-neutral-500 max-w-2xl mx-auto leading-relaxed">
                Built for the full arc — from months-out planning to the final goodbye.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  icon: Brain,
                  phase: 'Before',
                  label: '01',
                  title: 'Coordinate your team',
                  description: 'Assign tasks, split expenses, finalize the guest list, share files, and get every detail locked in before the big day.'
                },
                {
                  icon: Zap,
                  phase: 'During',
                  label: '02',
                  title: 'Stay on top of it',
                  description: 'Quick check-ins, QR guest arrivals, last-minute updates. Your team stays synced while the event runs itself.'
                },
                {
                  icon: CheckCircle2,
                  phase: 'After',
                  label: '03',
                  title: 'Wrap it up right',
                  description: 'Close expenses, share memories, collect feedback. Every loose end, tied.'
                }
              ].map((item, idx) => (
                <div 
                  key={idx}
                  className="group relative p-8 bg-neutral-50 rounded-3xl border border-neutral-200 hover:border-neutral-300 hover:bg-white hover:shadow-xl transition-all duration-500 hover:scale-105"
                >
                  <div className="flex items-start justify-between mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-neutral-100 group-hover:bg-neutral-900 flex items-center justify-center transition-all duration-500">
                      <item.icon className="w-6 h-6 text-neutral-500 group-hover:text-white transition-colors duration-500" />
                    </div>
                    <span className="text-3xl font-black text-neutral-100 group-hover:text-neutral-200 transition-colors duration-500">{item.label}</span>
                  </div>
                  <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2">{item.phase}</p>
                  <h3 className="text-lg font-bold text-neutral-900 mb-3">{item.title}</h3>
                  <p className="text-sm text-neutral-500 leading-relaxed">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-28 bg-white relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(0,0,0,0.02),transparent_50%)]" />
          <div className="relative max-w-7xl mx-auto px-6">
            <div className="text-center mb-20">
              <h2 className="text-5xl md:text-6xl font-black text-neutral-900 mb-6">
                Everything you need
              </h2>
              <p className="text-xl text-neutral-600 max-w-2xl mx-auto">
                Powerful tools for seamless event planning and coordination
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              <FeatureCard
                icon={MessageSquare}
                title="Real-time team chat"
                description="Instant messaging with typing indicators, reactions, and threaded conversations. Keep your planning team connected and aligned."
                delay={0}
              />
              <FeatureCard
                icon={ListChecks}
                title="Task management"
                description="Create checklists, assign tasks, set deadlines, and track completion. Never miss a critical planning milestone."
                delay={100}
              />
              <FeatureCard
                icon={BarChart3}
                title="Quick polls & voting"
                description="Make team decisions faster with live polls. Vote on venues, dates, menus, and more — see results instantly."
                delay={200}
              />
              <FeatureCard
                icon={FileText}
                title="Unlimited file sharing"
                description="Share contracts, floor plans, schedules, and more. Everything your team needs in one organized space."
                delay={300}
              />
              <FeatureCard
                icon={Clock}
                title="Timeline & scheduling"
                description="Build your event timeline, coordinate arrival times, and manage your run-of-show with precision."
                delay={400}
              />
              <FeatureCard
                icon={Users}
                title="Unlimited participants"
                description="No limits on team size. Bring your entire planning committee, vendors, volunteers — everyone who needs to be involved."
                delay={500}
              />
            </div>
          </div>
        </section>

        {/* Enterprise Mode Section */}
        <section className="py-28 bg-gradient-to-b from-blue-50/30 via-white to-white relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(59,130,246,0.03),transparent_50%)]" />
          <div className="relative max-w-7xl mx-auto px-6">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 rounded-full text-xs font-bold text-blue-900 mb-8 hover:scale-105 transition-transform">
                  <Zap className="w-4 h-4" />
                  Enterprise Mode
                </div>
                <h2 className="text-5xl font-black text-neutral-900 mb-6 leading-tight">
                  Built for large-scale events
                </h2>
                <p className="text-xl text-neutral-600 mb-10 leading-relaxed">
                  Hosting a wedding, conference, or corporate event? Enterprise Mode gives you professional-grade tools for managing hundreds of guests.
                </p>
                
                <div className="space-y-5 mb-10">
                  {[
                    { icon: CheckCircle2, text: 'QR code-based guest check-in system' },
                    { icon: Users, text: 'Personalized digital invitations for each guest' },
                    { icon: TrendingUp, text: 'Real-time attendance analytics dashboard' },
                    { icon: Timer, text: 'Track check-in times and flow metrics' },
                  ].map((item, index) => (
                    <div key={index} className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-neutral-200 hover:border-blue-300 hover:shadow-lg transition-all duration-300 hover:scale-105">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-neutral-800 to-neutral-900 flex items-center justify-center flex-shrink-0 shadow-lg">
                        <item.icon className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-neutral-800 font-medium">{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative">
                {/* Enhanced QR Code Display with animations */}
                <div className="relative bg-white rounded-3xl border-2 border-neutral-200 p-10 shadow-2xl hover:shadow-neutral-500/20 transition-all duration-500 hover:scale-105">
                  <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-100 rounded-full text-sm font-bold text-emerald-900 mb-6 animate-pulse">
                      <CheckCircle2 className="w-4 h-4" />
                      Guest Check-in Active
                    </div>
                    <h3 className="text-2xl font-bold text-neutral-900 mb-2">Sarah Johnson</h3>
                    <p className="text-neutral-600">Party of 4 • Table 12</p>
                  </div>
                  
                  {/* Animated QR Code Mockup */}
                  <div className="bg-gradient-to-br from-neutral-50 to-neutral-100 rounded-2xl p-10 border-2 border-neutral-200 hover:border-neutral-400 transition-all duration-300">
                    <div className="w-56 h-56 mx-auto bg-white rounded-2xl grid grid-cols-8 grid-rows-8 gap-1.5 p-3 shadow-inner">
                      {[...Array(64)].map((_, i) => (
                        <div 
                          key={i} 
                          className={`rounded transition-all duration-300 hover:scale-110 ${Math.random() > 0.5 ? 'bg-neutral-900' : 'bg-white'}`}
                        />
                      ))}
                    </div>
                  </div>
                  
                  <div className="mt-8 text-center space-y-3">
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Invite Code</p>
                    <p className="text-2xl font-mono font-black text-neutral-900 tracking-wider">AB12CD34</p>
                    <button className="px-6 py-3 bg-neutral-900 text-white rounded-xl font-medium hover:bg-black transition-all hover:scale-105 shadow-lg">
                      Scan to Check In
                    </button>
                  </div>
                </div>

                {/* Decorative animated elements */}
                <div className="absolute -top-6 -right-6 w-32 h-32 bg-blue-200 rounded-full blur-3xl opacity-40 animate-pulse" />
                <div className="absolute -bottom-6 -left-6 w-40 h-40 bg-purple-200 rounded-full blur-3xl opacity-30 animate-pulse" style={{ animationDelay: '1s' }} />
              </div>
            </div>
          </div>
        </section>

        {/* Enhanced Testimonials with longer reviews */}
        <section className="py-28 bg-white relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,0,0,0.02),transparent_70%)]" />
          <div className="relative max-w-7xl mx-auto px-6">
            <div className="text-center mb-20">
              <h2 className="text-5xl font-black text-neutral-900 mb-6">
                Trusted by event planners
              </h2>
              <p className="text-xl text-neutral-600">
                See how teams are using PlanIt to execute flawless events
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <TestimonialCard
                quote="PlanIt transformed how we coordinated our annual company conference. The task management kept our 15-person planning team organized for 6 months of prep. The QR check-in on event day was seamless for our 300 attendees. We saved countless hours compared to email chains and spreadsheets. Highly recommend for any multi-month event planning cycle!"
                author="Michael Chen"
                role="Senior Event Coordinator"
                event="Tech Summit 2025"
                delay={0}
              />
              <TestimonialCard
                quote="As a wedding planner, I've used every tool out there. PlanIt stands out because it doesn't require my couples or vendors to create accounts — huge win. We used it for 4 months of planning: coordinating with 8 vendors, managing 200+ guest invites, tracking deposits and payments. The file sharing meant all our contracts and floor plans lived in one place. The day-of check-in was butter smooth. Game changer!"
                author="Sarah Williams"
                role="Lead Wedding Planner"
                event="Williams-Martinez Wedding"
                delay={100}
              />
              <TestimonialCard
                quote="Our nonprofit used PlanIt to coordinate a 500-person fundraising gala. The unlimited participant feature meant we could include our entire board, 30 volunteers, all vendors, and staff. We planned for 3 months using the chat, polls for decision-making, and task lists. Enterprise mode's analytics helped us understand arrival patterns. Raised $250k+ and the event ran like clockwork. Worth every penny (it's free!)."
                author="David Martinez"
                role="Development Director"
                event="Charity Gala 2025"
                delay={200}
              />
            </div>
          </div>
        </section>

        {/* Create Event Section */}
        <section id="create" className="py-28 bg-gradient-to-b from-neutral-50 to-white relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_40%_60%,rgba(0,0,0,0.03),transparent_50%)]" />
          <div className="relative max-w-6xl mx-auto px-6">
            <div className="grid lg:grid-cols-2 gap-20 items-start">
              
              {/* Left side - Info */}
              <div className="lg:sticky lg:top-24">
                <div className="mb-10">
                  <h2 className="text-5xl font-black text-neutral-900 mb-6 tracking-tight leading-tight">
                    {created ? 'Event created! 🎉' : 'Start planning your event'}
                  </h2>
                  <p className="text-xl text-neutral-600 leading-relaxed">
                    {created 
                      ? 'Your planning hub is ready. Share the link with your team and get started.'
                      : 'Create your event workspace in 60 seconds. No credit card, no hassle, just start planning.'
                    }
                  </p>
                </div>

                {!created && (
                  <>
                    {/* Trust indicators */}
                    <div className="grid grid-cols-3 gap-5 mb-10">
                      {[
                        { icon: Clock, label: '60 seconds', color: 'blue' },
                        { icon: Shield, label: 'Secure', color: 'emerald' },
                        { icon: Gift, label: 'Free forever', color: 'purple' },
                      ].map((item, idx) => (
                        <div key={idx} className="text-center p-5 bg-white rounded-2xl border-2 border-neutral-200 hover:border-neutral-400 hover:shadow-xl transition-all duration-300 hover:scale-110">
                          <item.icon className={`w-7 h-7 text-${item.color}-500 mx-auto mb-3`} />
                          <p className="text-sm font-semibold text-neutral-700">{item.label}</p>
                        </div>
                      ))}
                    </div>

                    {/* What you get */}
                    <div className="space-y-4 p-8 bg-gradient-to-br from-neutral-50 to-white rounded-3xl border border-neutral-200">
                      <p className="text-base font-bold text-neutral-900 mb-5">Everything included:</p>
                      {[
                        'Private event space with custom branded URL',
                        'Unlimited team members — no caps!',
                        'Real-time chat with file sharing',
                        'Task lists and deadline tracking',
                        'Polls, voting, and decision tools',
                        'RSVP management and tracking',
                        'Expense splitting and budgets',
                        'QR check-in for large events',
                        'Timeline and scheduling tools',
                        'Post-event photo sharing'
                      ].map((item, index) => (
                        <div key={index} className="flex items-start gap-3 text-sm text-neutral-700 hover:text-neutral-900 transition-colors">
                          <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                          <span className="leading-relaxed">{item}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {created && (
                  <div className="space-y-6">
                    {/* Success animation */}
                    <div className="flex items-center justify-center p-10 bg-emerald-50 rounded-3xl border-2 border-emerald-200 hover:scale-105 transition-transform duration-300">
                      <div className="text-center">
                        <div className="w-20 h-20 mx-auto mb-5 rounded-full bg-emerald-500 flex items-center justify-center animate-bounce shadow-xl">
                          <Check className="w-10 h-10 text-white" />
                        </div>
                        <p className="text-lg font-bold text-emerald-900">
                          {mode === 'enterprise' ? 'Enterprise event created!' : 'Your planning hub is live!'}
                        </p>
                      </div>
                    </div>

                    {mode === 'enterprise' ? (
                      <div className="p-8 bg-blue-50 border-2 border-blue-200 rounded-3xl">
                        <div className="flex items-start gap-4 mb-5">
                          <Zap className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
                          <div>
                            <p className="text-base font-bold text-blue-900 mb-4">Next Steps for Enterprise Mode:</p>
                            <ol className="text-sm text-blue-800 space-y-3 list-decimal ml-5">
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

                    <button
                      onClick={() => navigate(created.subdomain ? `/e/${created.subdomain}` : `/event/${created.id}`)}
                      className="w-full px-8 py-5 bg-gradient-to-r from-neutral-900 to-black text-white rounded-2xl font-bold hover:scale-105 transition-all duration-300 shadow-2xl hover:shadow-neutral-500/50 flex items-center justify-center gap-3 text-lg"
                    >
                      {mode === 'enterprise' ? 'Set Up Guest Invites' : 'Enter your planning hub'}
                      <ArrowUpRight className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Right side - Form */}
              {!created && (
                <div className="bg-white rounded-3xl border-2 border-neutral-200 p-10 shadow-2xl sticky top-24 hover:shadow-neutral-500/20 transition-shadow duration-500">
                  {/* Mode selector */}
                  <div className="mb-8 p-5 bg-neutral-50 rounded-2xl border border-neutral-200">
                    <label className="block text-xs font-bold text-neutral-600 uppercase tracking-wider mb-4">
                      Event Type
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        type="button"
                        onClick={() => setMode('standard')}
                        className={`px-5 py-4 text-sm font-bold rounded-2xl border-2 transition-all duration-300 ${
                          mode === 'standard' 
                            ? 'bg-neutral-900 text-white border-neutral-900 shadow-xl scale-105' 
                            : 'bg-white text-neutral-600 border-neutral-300 hover:border-neutral-500 hover:scale-105'
                        }`}
                      >
                        <div className="font-bold mb-1.5">Standard</div>
                        <div className="text-xs opacity-80">Team planning</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setMode('enterprise')}
                        className={`px-5 py-4 text-sm font-bold rounded-2xl border-2 transition-all duration-300 ${
                          mode === 'enterprise' 
                            ? 'bg-neutral-900 text-white border-neutral-900 shadow-xl scale-105' 
                            : 'bg-white text-neutral-600 border-neutral-300 hover:border-neutral-500 hover:scale-105'
                        }`}
                      >
                        <div className="font-bold mb-1.5">Enterprise</div>
                        <div className="text-xs opacity-80">QR check-in</div>
                      </button>
                    </div>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Title */}
                    <div>
                      <label className="block text-sm font-bold text-neutral-700 mb-2">
                        Event title <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        className="input text-base"
                        placeholder="Summer Company Retreat 2025"
                        value={formData.title}
                        onChange={handleTitleChange}
                      />
                      {formData.title && formData.subdomain && (
                        <div className="mt-2 flex items-center gap-2 text-xs text-neutral-500 bg-neutral-50 px-3 py-2 rounded-lg">
                          <Link className="w-3 h-3" />
                          <span className="font-mono truncate">
                            {window.location.origin}/e/<span className="text-neutral-800 font-bold">{formData.subdomain}</span>
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-sm font-bold text-neutral-700 mb-2">
                        Description
                      </label>
                      <textarea
                        className="input resize-none text-base"
                        rows="3"
                        placeholder="What's this event about? Add details to help your team understand the scope..."
                        value={formData.description}
                        onChange={update('description')}
                      />
                    </div>

                    {/* Date + Location */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-neutral-700 mb-2">
                          Date & time <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="datetime-local"
                          required
                          className="input"
                          value={formData.date}
                          onChange={update('date')}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-neutral-700 mb-2">
                          Location
                        </label>
                        <input
                          type="text"
                          className="input"
                          placeholder="Central Park, NYC"
                          value={formData.location}
                          onChange={update('location')}
                        />
                      </div>
                    </div>

                    {/* Name + Email */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-neutral-700 mb-2">
                          Your name <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          className="input"
                          placeholder="Alex Smith"
                          value={formData.organizerName}
                          onChange={update('organizerName')}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-neutral-700 mb-2">
                          Your email <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="email"
                          required
                          className="input"
                          placeholder="alex@company.com"
                          value={formData.organizerEmail}
                          onChange={update('organizerEmail')}
                        />
                      </div>
                    </div>

                    {/* Account Password */}
                    <div>
                      <label className="block text-sm font-bold text-neutral-700 mb-2">
                        <span className="flex items-center gap-2">
                          <Lock className="w-4 h-4 text-neutral-400" />
                          Your Account Password <span className="text-red-500">*</span>
                        </span>
                      </label>
                      <div className="relative">
                        <input
                          type={showAccountPassword ? 'text' : 'password'}
                          required
                          className="input pr-12"
                          placeholder="Create a secure password (min 4 characters)"
                          value={formData.accountPassword}
                          onChange={update('accountPassword')}
                          minLength={4}
                        />
                        <button
                          type="button"
                          onClick={() => setShowAccountPassword(!showAccountPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 transition-colors"
                        >
                          {showAccountPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                      <p className="text-xs text-neutral-500 mt-2">
                        Required to access this event from other devices or browsers
                      </p>
                    </div>

                    {/* Event Password */}
                    <div>
                      <label className="block text-sm font-bold text-neutral-700 mb-2">
                        <span className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-neutral-400" />
                          Event Password <span className="text-neutral-400 font-normal text-xs">(optional)</span>
                        </span>
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          className="input pr-12"
                          placeholder={mode === 'enterprise' ? 'Add layer of security' : 'Leave empty for open access'}
                          value={formData.password}
                          onChange={update('password')}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                      {mode === 'enterprise' && (
                        <p className="text-xs text-neutral-500 mt-2">
                          Enterprise uses QR invites — this adds an extra security layer
                        </p>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full px-8 py-5 bg-gradient-to-r from-neutral-900 to-black text-white rounded-2xl font-bold hover:scale-105 transition-all duration-300 shadow-2xl hover:shadow-neutral-500/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center justify-center gap-3 text-lg"
                    >
                      {loading ? (
                        <>
                          <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                          Creating your hub...
                        </>
                      ) : (
                        <>
                          Create event
                          <ArrowRight className="w-5 h-5" />
                        </>
                      )}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t-2 border-neutral-200 bg-gradient-to-b from-white to-neutral-50">
          <div className="max-w-7xl mx-auto px-6 py-16">
            <div className="grid md:grid-cols-4 gap-12 mb-12">
              <div>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-neutral-800 to-neutral-900 flex items-center justify-center shadow-lg">
                    <Calendar className="w-5 h-5 text-white" />
                  </div>
                  <span className="font-black text-xl text-neutral-900">PlanIt</span>
                </div>
                <p className="text-sm text-neutral-600 leading-relaxed mb-4">
                  The ultimate planning hub for event teams. Plan smart, execute flawlessly.
                </p>
                <p className="text-xs text-neutral-500">
                  Made with <Coffee className="w-4 h-4 inline" /> not ❤️
                </p>
              </div>
              
              <div>
                <h3 className="text-sm font-bold text-neutral-900 mb-5 uppercase tracking-wider">Product</h3>
                <ul className="space-y-3 text-sm text-neutral-600">
                  <li><a href="#features" className="hover:text-neutral-900 transition-colors hover:translate-x-1 inline-block">Features</a></li>
                  <li><a href="#create" className="hover:text-neutral-900 transition-colors hover:translate-x-1 inline-block">Get Started</a></li>
                  <li><a href="/support" className="hover:text-neutral-900 transition-colors hover:translate-x-1 inline-block">Support</a></li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-sm font-bold text-neutral-900 mb-5 uppercase tracking-wider">Company</h3>
                <ul className="space-y-3 text-sm text-neutral-600">
                  <li><a href="/terms" className="hover:text-neutral-900 transition-colors hover:translate-x-1 inline-block">Terms of Service</a></li>
                  <li><a href="/privacy" className="hover:text-neutral-900 transition-colors hover:translate-x-1 inline-block">Privacy Policy</a></li>
                  <li><a href="/admin" className="hover:text-neutral-900 transition-colors hover:translate-x-1 inline-block">Admin Login</a></li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-sm font-bold text-neutral-900 mb-5 uppercase tracking-wider">Connect</h3>
                <ul className="space-y-3 text-sm text-neutral-600">
                  <li><a href="/support" className="hover:text-neutral-900 transition-colors hover:translate-x-1 inline-block">Contact Us</a></li>
                  <li><a href="/support/wall" className="hover:text-neutral-900 transition-colors hover:translate-x-1 inline-block">Wall of Supporters</a></li>
                </ul>
              </div>
            </div>
            
            <div className="pt-8 border-t-2 border-neutral-200 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-neutral-500">
              <span>© 2026 PlanIt. All rights reserved.</span>
              <span className="font-medium">By Aakshat Hariharan</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
