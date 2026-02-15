import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar, Users, MessageSquare, BarChart3, FileText, Shield, Copy, Check, Lock, 
  ArrowRight, Link, Eye, EyeOff, ChevronRight, Sparkles, Zap, Clock, 
  CheckCircle2, Star, TrendingUp, Globe, Smartphone, Award, Target, Gift,
  Code, Palette, Rocket, Heart, Coffee
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
      className={`group relative p-6 rounded-2xl border border-neutral-200 bg-white hover:border-neutral-300 transition-all duration-700 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
      }`}
    >
      {/* Subtle gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-neutral-50/50 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      
      {/* Icon container with animation */}
      <div className="relative mb-4">
        <div className="w-12 h-12 rounded-xl bg-neutral-100 flex items-center justify-center group-hover:bg-neutral-900 transition-all duration-500 group-hover:scale-110 group-hover:rotate-3">
          <Icon className="w-6 h-6 text-neutral-600 group-hover:text-white transition-colors duration-500" />
        </div>
        {/* Animated ring on hover */}
        <div className="absolute inset-0 w-12 h-12 rounded-xl border-2 border-neutral-300 opacity-0 group-hover:opacity-100 group-hover:scale-125 transition-all duration-500" />
      </div>

      <h3 className="relative text-base font-semibold text-neutral-900 mb-2 group-hover:text-neutral-900 transition-colors duration-300">
        {title}
      </h3>
      <p className="relative text-sm text-neutral-500 leading-relaxed">
        {description}
      </p>
    </div>
  );
}

// Testimonial card with elegant design
function TestimonialCard({ quote, author, role, delay = 0 }) {
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
      className={`p-6 rounded-2xl bg-white border border-neutral-200 transition-all duration-700 ${
        isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'
      }`}
    >
      <div className="flex items-start gap-3 mb-4">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-neutral-900 flex items-center justify-center">
          <span className="text-sm font-bold text-white">{author.charAt(0)}</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-neutral-900">{author}</p>
          <p className="text-xs text-neutral-500">{role}</p>
        </div>
      </div>
      <p className="text-sm text-neutral-600 leading-relaxed italic">"{quote}"</p>
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
    <div className="mt-3 rounded-xl border border-neutral-200 overflow-hidden bg-neutral-50/50 hover:border-neutral-300 transition-all duration-300">
      <div className="flex items-center gap-3 px-4 py-3">
        <Link className="w-4 h-4 text-neutral-400 flex-shrink-0" />
        <span className="flex-1 text-sm text-neutral-700 font-mono truncate">{link}</span>
        <button
          onClick={handleCopy}
          className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 text-xs font-medium rounded-lg transition-all duration-300 ${
            copied 
              ? 'bg-emerald-500 text-white' 
              : 'bg-neutral-900 text-white hover:bg-neutral-800'
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

// Floating particles animation
function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(15)].map((_, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 bg-neutral-300 rounded-full animate-float"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 5}s`,
            animationDuration: `${10 + Math.random() * 10}s`,
            opacity: 0.3,
          }}
        />
      ))}
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
    maxParticipants: 100
  });
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showAccountPassword, setShowAccountPassword] = useState(false);
  const [activeFeatureIndex, setActiveFeatureIndex] = useState(0);

  // Rotate featured features
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveFeatureIndex((prev) => (prev + 1) % 5);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

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
    <div className="min-h-screen bg-gradient-to-b from-white via-neutral-50 to-white">
      {/* Add custom animations CSS */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) translateX(0); }
          25% { transform: translateY(-20px) translateX(10px); }
          50% { transform: translateY(-10px) translateX(-10px); }
          75% { transform: translateY(-30px) translateX(5px); }
        }
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes slideInLeft {
          from {
            opacity: 0;
            transform: translateX(-30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes pulse-subtle {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        .animate-float {
          animation: float linear infinite;
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.8s ease-out forwards;
        }
        .animate-slide-in-left {
          animation: slideInLeft 0.6s ease-out forwards;
        }
        .animate-pulse-subtle {
          animation: pulse-subtle 3s ease-in-out infinite;
        }
      `}</style>

      {/* Navigation */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-neutral-200/50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-9 h-9 rounded-xl bg-neutral-900 flex items-center justify-center shadow-lg">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white animate-pulse-subtle" />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-neutral-900 to-neutral-600 bg-clip-text text-transparent">
              PlanIt
            </span>
          </div>
          <nav className="flex items-center gap-1">
            <a href="/terms" className="px-3 py-2 text-sm text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-all">
              Terms
            </a>
            <a href="/privacy" className="px-3 py-2 text-sm text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-all">
              Privacy
            </a>
            <a href="/admin" className="px-3 py-2 text-sm text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-all">
              Admin
            </a>
            <a href="/support" className="ml-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-neutral-800 to-neutral-900 hover:from-neutral-900 hover:to-black rounded-lg transition-all shadow-lg hover:shadow-xl flex items-center gap-2">
              <Heart className="w-4 h-4" fill="currentColor" />
              Support Us
            </a>
          </nav>
        </div>
      </header>

      <main className="relative">
        {/* Hero Section */}
        <section className="relative overflow-hidden">
          <FloatingParticles />
          
          <div className="max-w-7xl mx-auto px-6 pt-20 pb-32">
            <div className="text-center max-w-4xl mx-auto">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-100 rounded-full text-xs font-medium text-neutral-700 mb-6 animate-fade-in-up border border-neutral-200">
                <Sparkles className="w-3.5 h-3.5" />
                No accounts • No friction • Free forever
              </div>

              {/* Main heading with gradient */}
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-neutral-900 mb-6 tracking-tight leading-tight animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
                Private event spaces
                <br />
                <span className="bg-gradient-to-r from-neutral-600 to-neutral-900 bg-clip-text text-transparent">
                  for groups
                </span>
              </h1>

              {/* Subtitle */}
              <p className="text-xl text-neutral-600 mb-10 max-w-2xl mx-auto leading-relaxed animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
                Create a shared space for your event. Real-time chat, polls, file sharing, and more.
                <span className="block mt-2 text-neutral-500">All in one place, no sign-up required.</span>
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
                <a href="#create" className="group px-8 py-4 bg-neutral-900 text-white rounded-xl font-medium hover:bg-black transition-all shadow-lg hover:shadow-2xl flex items-center gap-2">
                  Create an event
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </a>
                <a href="#features" className="px-8 py-4 bg-white border border-neutral-300 text-neutral-700 rounded-xl font-medium hover:border-neutral-400 hover:bg-neutral-50 transition-all flex items-center gap-2">
                  See features
                  <ChevronRight className="w-4 h-4" />
                </a>
              </div>

              {/* Stats */}
              <div className="mt-16 grid grid-cols-3 gap-8 max-w-2xl mx-auto animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
                <div className="text-center">
                  <div className="text-3xl font-bold text-neutral-900 mb-1">
                    <AnimatedCounter end={10000} suffix="+" />
                  </div>
                  <div className="text-sm text-neutral-500">Events created</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-neutral-900 mb-1">
                    <AnimatedCounter end={100} suffix="k+" />
                  </div>
                  <div className="text-sm text-neutral-500">Happy users</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-neutral-900 mb-1">
                    <AnimatedCounter end={99} suffix="%" />
                  </div>
                  <div className="text-sm text-neutral-500">Satisfaction</div>
                </div>
              </div>
            </div>
          </div>

          {/* Decorative gradient blur */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-neutral-200 rounded-full blur-3xl opacity-20 pointer-events-none" />
        </section>

        {/* Features Section */}
        <section id="features" className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold text-neutral-900 mb-4">
                Everything you need
              </h2>
              <p className="text-lg text-neutral-600 max-w-2xl mx-auto">
                Powerful features designed for seamless event coordination
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <FeatureCard
                icon={MessageSquare}
                title="Real-time chat"
                description="Instant messaging with typing indicators, reactions, and message editing. Keep everyone in the loop."
                delay={0}
              />
              <FeatureCard
                icon={BarChart3}
                title="Live polls"
                description="Create polls and vote together instantly. Make group decisions easier with real-time results."
                delay={100}
              />
              <FeatureCard
                icon={FileText}
                title="File sharing"
                description="Share documents, images, and files securely. Everything in one place for easy access."
                delay={200}
              />
              <FeatureCard
                icon={Shield}
                title="Password protection"
                description="Keep your events private with optional password protection. Control who can join."
                delay={300}
              />
              <FeatureCard
                icon={Users}
                title="Up to 100 participants"
                description="Host events with up to 100 participants by default. Perfect for small to medium gatherings."
                delay={400}
              />
              <FeatureCard
                icon={Calendar}
                title="Event management"
                description="Track RSVPs, manage tasks, split expenses, and keep everyone organized in one space."
                delay={500}
              />
            </div>
          </div>
        </section>

        {/* Enterprise Mode Section */}
        <section className="py-24 bg-gradient-to-b from-neutral-50 to-white">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-100 rounded-full text-xs font-medium text-blue-900 mb-6">
                  <Zap className="w-3.5 h-3.5" />
                  Enterprise Mode
                </div>
                <h2 className="text-4xl font-bold text-neutral-900 mb-6">
                  Built for large events
                </h2>
                <p className="text-lg text-neutral-600 mb-8 leading-relaxed">
                  Hosting a wedding, conference, or corporate event? Enterprise Mode gives you professional tools for seamless guest management.
                </p>
                
                <div className="space-y-4 mb-8">
                  {[
                    { icon: CheckCircle2, text: 'QR code check-in system' },
                    { icon: Users, text: 'Personalized guest invites' },
                    { icon: TrendingUp, text: 'Attendance analytics' },
                    { icon: Clock, text: 'Real-time tracking dashboard' },
                  ].map((item, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-neutral-900 flex items-center justify-center flex-shrink-0">
                        <item.icon className="w-4 h-4 text-white" />
                      </div>
                      <span className="text-neutral-700">{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative">
                {/* Mock QR Code Display */}
                <div className="relative bg-white rounded-2xl border border-neutral-200 p-8 shadow-xl">
                  <div className="text-center mb-6">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-100 rounded-full text-xs font-medium text-emerald-900 mb-4">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Guest Check-in
                    </div>
                    <h3 className="text-xl font-semibold text-neutral-900 mb-2">Sarah Johnson</h3>
                    <p className="text-sm text-neutral-500">Party of 4</p>
                  </div>
                  
                  {/* QR Code Mockup */}
                  <div className="bg-neutral-50 rounded-xl p-8 border border-neutral-200">
                    <div className="w-48 h-48 mx-auto bg-white rounded-lg grid grid-cols-8 grid-rows-8 gap-1 p-2">
                      {[...Array(64)].map((_, i) => (
                        <div 
                          key={i} 
                          className={`rounded-sm ${Math.random() > 0.5 ? 'bg-neutral-900' : 'bg-white'}`}
                        />
                      ))}
                    </div>
                  </div>
                  
                  <div className="mt-6 text-center">
                    <p className="text-xs text-neutral-500 mb-2">Invite Code</p>
                    <p className="text-lg font-mono font-bold text-neutral-900">AB12CD34</p>
                  </div>
                </div>

                {/* Decorative elements */}
                <div className="absolute -top-4 -right-4 w-24 h-24 bg-neutral-200 rounded-full blur-2xl opacity-50" />
                <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-neutral-300 rounded-full blur-3xl opacity-30" />
              </div>
            </div>
          </div>
        </section>

        {/* Social Proof / Testimonials */}
        <section className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-neutral-900 mb-4">
                Loved by event organizers
              </h2>
              <p className="text-lg text-neutral-600">
                See what people are saying about PlanIt
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <TestimonialCard
                quote="PlanIt made organizing our company retreat so much easier. The QR check-in saved us hours!"
                author="Michael Chen"
                role="HR Manager"
                delay={0}
              />
              <TestimonialCard
                quote="Finally, an event tool that doesn't require everyone to create accounts. Our guests loved it."
                author="Sarah Williams"
                role="Wedding Planner"
                delay={100}
              />
              <TestimonialCard
                quote="The real-time polls and chat features made it easy to plan our conference. Brilliant!"
                author="David Martinez"
                role="Event Coordinator"
                delay={200}
              />
            </div>
          </div>
        </section>

        {/* Create Event Section */}
        <section id="create" className="py-24 bg-gradient-to-b from-neutral-50 to-white">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid lg:grid-cols-2 gap-16 items-start">
              
              {/* Left side - Info */}
              <div className="lg:sticky lg:top-24">
                <div className="mb-8">
                  <h2 className="text-4xl font-bold text-neutral-900 mb-4 tracking-tight">
                    {created ? 'Event created!' : 'Create an event'}
                  </h2>
                  <p className="text-lg text-neutral-600 leading-relaxed">
                    {created 
                      ? 'Your event is ready. Share the link below with your guests.'
                      : 'Set up your event space in under a minute. No credit card required.'
                    }
                  </p>
                </div>

                {!created && (
                  <>
                    {/* Trust indicators */}
                    <div className="grid grid-cols-3 gap-4 mb-8">
                      <div className="text-center p-4 bg-white rounded-xl border border-neutral-200">
                        <Clock className="w-6 h-6 text-neutral-400 mx-auto mb-2" />
                        <p className="text-xs text-neutral-600">60 seconds</p>
                      </div>
                      <div className="text-center p-4 bg-white rounded-xl border border-neutral-200">
                        <Shield className="w-6 h-6 text-neutral-400 mx-auto mb-2" />
                        <p className="text-xs text-neutral-600">Secure</p>
                      </div>
                      <div className="text-center p-4 bg-white rounded-xl border border-neutral-200">
                        <Gift className="w-6 h-6 text-neutral-400 mx-auto mb-2" />
                        <p className="text-xs text-neutral-600">Free</p>
                      </div>
                    </div>

                    {/* What you get */}
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-neutral-700 mb-3">What you get:</p>
                      {[
                        'Private event space with custom URL',
                        'Real-time chat and messaging for planing',
                        'Polls and voting for democracy',
                        'File sharing up to 10MB',
                        'RSVP tracking',
                        'Task management'
                      ].map((item, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm text-neutral-600">
                          <CheckCircle2 className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {created && (
                  <div className="space-y-6">
                    {/* Success animation */}
                    <div className="flex items-center justify-center p-8 bg-emerald-50 rounded-2xl border border-emerald-200">
                      <div className="text-center">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500 flex items-center justify-center animate-bounce">
                          <Check className="w-8 h-8 text-white" />
                        </div>
                        <p className="text-sm font-medium text-emerald-900">
                          {mode === 'enterprise' ? 'Enterprise event created!' : 'Your event is live!'}
                        </p>
                      </div>
                    </div>

                    {mode === 'enterprise' ? (
                      <div className="p-6 bg-blue-50 border border-blue-200 rounded-xl">
                        <div className="flex items-start gap-3 mb-4">
                          <Zap className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-semibold text-blue-900 mb-2">Next Steps for Enterprise Mode:</p>
                            <ol className="text-sm text-blue-800 space-y-2 list-decimal ml-4">
                              <li>Enter your event and click "Manage Invites"</li>
                              <li>Add guests with their names and group sizes</li>
                              <li>Send personalized invite links to each guest</li>
                              <li>On event day, scan QR codes to check in guests</li>
                            </ol>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-medium text-neutral-700 mb-2">Your event link:</p>
                        <CopyLinkBox eventId={created.id} subdomain={created.subdomain} />
                      </div>
                    )}

                    <button
                      onClick={() => navigate(created.subdomain ? `/e/${created.subdomain}` : `/event/${created.id}`)}
                      className="w-full px-6 py-4 bg-neutral-900 text-white rounded-xl font-medium hover:bg-black transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                    >
                      {mode === 'enterprise' ? 'Set Up Invites' : 'Enter your event'}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Right side - Form */}
              {!created && (
                <div className="bg-white rounded-2xl border border-neutral-200 p-8 shadow-xl sticky top-24">
                  {/* Mode selector */}
                  <div className="mb-6 p-4 bg-neutral-50 rounded-xl border border-neutral-200">
                    <label className="block text-xs font-semibold text-neutral-600 uppercase tracking-wide mb-3">
                      Event Type
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setMode('standard')}
                        className={`px-4 py-3 text-sm font-medium rounded-xl border transition-all ${
                          mode === 'standard' 
                            ? 'bg-neutral-900 text-white border-neutral-900 shadow-lg' 
                            : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'
                        }`}
                      >
                        <div className="font-semibold mb-1">Standard</div>
                        <div className="text-xs opacity-80">Planning & collaboration</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setMode('enterprise')}
                        className={`px-4 py-3 text-sm font-medium rounded-xl border transition-all ${
                          mode === 'enterprise' 
                            ? 'bg-neutral-900 text-white border-neutral-900 shadow-lg' 
                            : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'
                        }`}
                      >
                        <div className="font-semibold mb-1">Enterprise</div>
                        <div className="text-xs opacity-80">QR check-in & invites</div>
                      </button>
                    </div>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Title */}
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        Event title <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        className="input"
                        placeholder="Summer BBQ 2025"
                        value={formData.title}
                        onChange={handleTitleChange}
                      />
                      {formData.title && formData.subdomain && (
                        <div className="mt-2 flex items-center gap-2 text-xs text-neutral-500">
                          <Link className="w-3 h-3" />
                          <span className="font-mono truncate">
                            {window.location.origin}/e/<span className="text-neutral-700 font-medium">{formData.subdomain}</span>
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        Description
                      </label>
                      <textarea
                        className="input resize-none"
                        rows="2"
                        placeholder="What's this event about?"
                        value={formData.description}
                        onChange={update('description')}
                      />
                    </div>

                    {/* Date + Location */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-2">
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
                        <label className="block text-sm font-medium text-neutral-700 mb-2">
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
                        <label className="block text-sm font-medium text-neutral-700 mb-2">
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
                        <label className="block text-sm font-medium text-neutral-700 mb-2">
                          Your email <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="email"
                          required
                          className="input"
                          placeholder="alex@example.com"
                          value={formData.organizerEmail}
                          onChange={update('organizerEmail')}
                        />
                      </div>
                    </div>

                    {/* Account Password */}
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        <span className="flex items-center gap-2">
                          <Lock className="w-4 h-4 text-neutral-400" />
                          Your Account Password <span className="text-red-500">*</span>
                        </span>
                      </label>
                      <div className="relative">
                        <input
                          type={showAccountPassword ? 'text' : 'password'}
                          required
                          className="input pr-10"
                          placeholder="Create a password (min 4 characters)"
                          value={formData.accountPassword}
                          onChange={update('accountPassword')}
                          minLength={4}
                        />
                        <button
                          type="button"
                          onClick={() => setShowAccountPassword(!showAccountPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                        >
                          {showAccountPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <p className="text-xs text-neutral-500 mt-2">
                        You'll need this to access the event from other devices
                      </p>
                    </div>

                    {/* Event Password */}
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-2">
                        <span className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-neutral-400" />
                          Event Password <span className="text-neutral-400 font-normal">(optional)</span>
                        </span>
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          className="input pr-10"
                          placeholder={mode === 'enterprise' ? 'Add extra security' : 'Leave empty for public event'}
                          value={formData.password}
                          onChange={update('password')}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {mode === 'enterprise' && (
                        <p className="text-xs text-neutral-500 mt-2">
                          Enterprise mode uses personalized QR invites. This password adds extra security.
                        </p>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full px-6 py-4 bg-neutral-900 text-white rounded-xl font-medium hover:bg-black transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          Create event
                          <ArrowRight className="w-4 h-4" />
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
        <footer className="border-t border-neutral-200 bg-white">
          <div className="max-w-7xl mx-auto px-6 py-12">
            <div className="grid md:grid-cols-4 gap-8 mb-12">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-neutral-900 flex items-center justify-center">
                    <Calendar className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-bold text-neutral-900">PlanIt</span>
                </div>
                <p className="text-sm text-neutral-600 leading-relaxed">
                  Private event spaces for groups. No accounts, no friction.
                </p>
              </div>
              
              <div>
                <h3 className="text-sm font-semibold text-neutral-900 mb-4">Product</h3>
                <ul className="space-y-2 text-sm text-neutral-600">
                  <li><a href="#features" className="hover:text-neutral-900 transition-colors">Features</a></li>
                  <li><a href="#create" className="hover:text-neutral-900 transition-colors">Pricing</a></li>
                  <li><a href="/support" className="hover:text-neutral-900 transition-colors">Support</a></li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-sm font-semibold text-neutral-900 mb-4">Company</h3>
                <ul className="space-y-2 text-sm text-neutral-600">
                  <li><a href="/terms" className="hover:text-neutral-900 transition-colors">Terms</a></li>
                  <li><a href="/privacy" className="hover:text-neutral-900 transition-colors">Privacy</a></li>
                  <li><a href="/admin" className="hover:text-neutral-900 transition-colors">Admin</a></li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-sm font-semibold text-neutral-900 mb-4">Connect</h3>
                <ul className="space-y-2 text-sm text-neutral-600">
                  <li><a href="/support" className="hover:text-neutral-900 transition-colors">Contact</a></li>
                  <li><a href="/support/wall" className="hover:text-neutral-900 transition-colors">Supporters</a></li>
                </ul>
              </div>
            </div>
            
            <div className="pt-8 border-t border-neutral-200 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-neutral-500">
              <span>© 2026 PlanIt. Made with <Coffee className="w-4 h-4 inline" /> not ❤️</span>
              <span>By Aakshat Hariharan</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}