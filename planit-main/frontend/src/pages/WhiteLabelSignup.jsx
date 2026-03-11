import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

/* ─── Animations ─────────────────────────────────────────────────────────── */
const useReveal = () => {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.1 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return [ref, visible];
};

/* ─── Constants ──────────────────────────────────────────────────────────── */
const TIERS = [
  {
    name: 'Basic',
    price: '$149',
    period: '/month',
    tagline: 'Your brand, fully managed.',
    description: 'Custom domain, logo and colors, reservation system, waitlist, and ongoing support. The fastest way to launch a branded booking experience.',
    features: ['Custom domain & SSL', 'Logo, colors, font', 'Full reservation system', 'Live waitlist', 'Up to 10 events', 'Up to 500 guests per event', 'Onboarding included', 'Ongoing support'],
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$249',
    period: '/month',
    tagline: 'Completely invisible. Completely yours.',
    description: 'Everything in Basic, plus complete removal of PlanIt attribution. Guests see only your brand — from the first page to the confirmation email.',
    features: ['Everything in Basic', 'Remove all PlanIt branding', 'White-labeled confirmation emails', 'Priority support', 'Higher usage limits', 'Staff management tools'],
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: '$499',
    period: '/month',
    tagline: 'Built exactly to your brand standards.',
    description: 'Everything in Pro, plus custom CSS injection for total visual control. Built for properties with a design team and strict brand guidelines.',
    features: ['Everything in Pro', 'Custom CSS injection', 'Extended usage limits', 'Multi-location support', 'Dedicated account management', 'SLA guarantee'],
    highlighted: false,
  },
];

const BUSINESS_TYPES = [
  { value: 'restaurant', label: 'Restaurant or Cafe' },
  { value: 'venue', label: 'Venue or Event Space' },
  { value: 'hotel', label: 'Hotel or Hospitality Group' },
  { value: 'corporate', label: 'Corporate or Enterprise' },
  { value: 'other', label: 'Other' },
];

const TIER_OPTIONS = [
  { value: 'basic', label: 'Basic — $149/month' },
  { value: 'pro', label: 'Pro — $249/month' },
  { value: 'enterprise', label: 'Enterprise — $499/month' },
  { value: 'unsure', label: 'Not sure yet' },
];

/* ─── Nav ─────────────────────────────────────────────────────────────────── */
function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', h);
    return () => window.removeEventListener('scroll', h);
  }, []);
  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      padding: '0 2.5rem',
      height: '64px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: scrolled ? 'rgba(8,8,8,0.92)' : 'transparent',
      backdropFilter: scrolled ? 'blur(12px)' : 'none',
      borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : 'none',
      transition: 'all 0.3s ease',
    }}>
      <Link to="/" style={{ textDecoration: 'none' }}>
        <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.25rem', fontWeight: 600, color: '#f5f0e8', letterSpacing: '0.02em' }}>
          PlanIt
        </span>
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
        <a href="#pricing" style={{ color: '#9a9590', fontSize: '0.8rem', letterSpacing: '0.08em', textTransform: 'uppercase', textDecoration: 'none', fontFamily: "'Mulish', sans-serif" }}>
          Pricing
        </a>
        <a href="#request" style={{ color: '#9a9590', fontSize: '0.8rem', letterSpacing: '0.08em', textTransform: 'uppercase', textDecoration: 'none', fontFamily: "'Mulish', sans-serif" }}>
          Request Access
        </a>
        <Link to="/admin" style={{
          fontSize: '0.78rem', letterSpacing: '0.06em', textTransform: 'uppercase',
          color: '#f5f0e8', textDecoration: 'none', fontFamily: "'Mulish', sans-serif",
          border: '1px solid rgba(245,240,232,0.2)', padding: '0.4rem 1rem', borderRadius: '2px',
          transition: 'all 0.2s',
        }}>
          Sign In
        </Link>
      </div>
    </nav>
  );
}

/* ─── Hero ────────────────────────────────────────────────────────────────── */
function Hero() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setTimeout(() => setMounted(true), 60); }, []);
  return (
    <section style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '8rem 2.5rem 6rem',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Background grain + gradient */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0,
        background: 'radial-gradient(ellipse 80% 60% at 50% 20%, rgba(200,169,110,0.06) 0%, transparent 70%), radial-gradient(ellipse 60% 40% at 80% 80%, rgba(200,169,110,0.04) 0%, transparent 60%)',
      }} />
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0, opacity: 0.025,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'repeat', backgroundSize: '128px',
      }} />

      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: '900px' }}>
        <p style={{
          fontFamily: "'Mulish', sans-serif", fontSize: '0.72rem', letterSpacing: '0.2em',
          textTransform: 'uppercase', color: '#c8a96e', marginBottom: '2rem',
          opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(12px)',
          transition: 'all 0.7s ease 0.1s',
        }}>
          White Label Platform
        </p>

        <h1 style={{
          fontFamily: "'Cormorant Garamond', Georgia, serif",
          fontSize: 'clamp(3.2rem, 8vw, 7rem)',
          fontWeight: 300, lineHeight: 1.05,
          color: '#f5f0e8', margin: '0 0 1rem',
          letterSpacing: '-0.01em',
          opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(20px)',
          transition: 'all 0.8s ease 0.2s',
        }}>
          Your brand.<br />
          <em style={{ fontStyle: 'italic', color: '#c8a96e' }}>Our platform.</em>
        </h1>

        <p style={{
          fontFamily: "'Mulish', sans-serif", fontSize: 'clamp(0.95rem, 1.8vw, 1.1rem)',
          color: '#9a9590', lineHeight: 1.7, maxWidth: '560px', margin: '0 auto 3rem',
          opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(16px)',
          transition: 'all 0.8s ease 0.35s',
        }}>
          A fully managed reservation and event platform that operates entirely under your brand.
          Your guests never know we exist.
        </p>

        <div style={{
          display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap',
          opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(12px)',
          transition: 'all 0.8s ease 0.5s',
        }}>
          <a href="#request" style={{
            fontFamily: "'Mulish', sans-serif", fontSize: '0.8rem', letterSpacing: '0.1em',
            textTransform: 'uppercase', textDecoration: 'none',
            background: '#c8a96e', color: '#080808',
            padding: '0.9rem 2.2rem', borderRadius: '2px', fontWeight: 700,
            transition: 'opacity 0.2s',
          }}
            onMouseEnter={e => e.target.style.opacity = '0.85'}
            onMouseLeave={e => e.target.style.opacity = '1'}
          >
            Request Access
          </a>
          <a href="#pricing" style={{
            fontFamily: "'Mulish', sans-serif", fontSize: '0.8rem', letterSpacing: '0.1em',
            textTransform: 'uppercase', textDecoration: 'none',
            border: '1px solid rgba(245,240,232,0.2)', color: '#f5f0e8',
            padding: '0.9rem 2.2rem', borderRadius: '2px', fontWeight: 500,
            transition: 'border-color 0.2s',
          }}
            onMouseEnter={e => e.target.style.borderColor = 'rgba(245,240,232,0.5)'}
            onMouseLeave={e => e.target.style.borderColor = 'rgba(245,240,232,0.2)'}
          >
            View Pricing
          </a>
        </div>

        {/* Stats bar */}
        <div style={{
          display: 'flex', gap: '3rem', justifyContent: 'center', marginTop: '6rem',
          paddingTop: '3rem', borderTop: '1px solid rgba(255,255,255,0.06)',
          flexWrap: 'wrap',
          opacity: mounted ? 1 : 0, transition: 'opacity 0.8s ease 0.7s',
        }}>
          {[
            { n: '$299', label: 'One-time setup' },
            { n: '5 min', label: 'To go live after DNS' },
            { n: '100%', label: 'Managed for you' },
          ].map(({ n, label }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2rem', fontWeight: 600, color: '#c8a96e', lineHeight: 1 }}>{n}</div>
              <div style={{ fontFamily: "'Mulish', sans-serif", fontSize: '0.72rem', color: '#6b6560', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '0.4rem' }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── How it works ────────────────────────────────────────────────────────── */
function HowItWorks() {
  const [ref, visible] = useReveal();
  const steps = [
    { num: '01', title: 'You sign up', body: 'Tell us about your business and the tier you need. We handle all the technical setup — DNS, SSL, branding configuration, and testing.' },
    { num: '02', title: 'We configure everything', body: 'Your logo, colors, domain, and booking rules are applied. We test the full reservation flow under your domain before handing it over.' },
    { num: '03', title: 'Guests book through your brand', body: 'Your guests visit your domain, see only your brand, complete a reservation, and receive a confirmation. PlanIt is never visible.' },
  ];
  return (
    <section ref={ref} style={{ padding: '8rem 2.5rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <p style={{
          fontFamily: "'Mulish', sans-serif", fontSize: '0.72rem', letterSpacing: '0.2em',
          textTransform: 'uppercase', color: '#c8a96e', marginBottom: '1.5rem',
          opacity: visible ? 1 : 0, transition: 'all 0.6s ease',
        }}>How it works</p>
        <h2 style={{
          fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(2.2rem, 5vw, 3.5rem)',
          fontWeight: 300, color: '#f5f0e8', margin: '0 0 5rem', lineHeight: 1.1,
          opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(16px)',
          transition: 'all 0.7s ease 0.1s',
        }}>
          Three steps from signup<br />to live bookings.
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0' }}>
          {steps.map((s, i) => (
            <div key={s.num} style={{
              padding: '2.5rem',
              borderLeft: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.06)',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              opacity: visible ? 1 : 0,
              transform: visible ? 'none' : 'translateY(20px)',
              transition: `all 0.7s ease ${0.2 + i * 0.15}s`,
            }}>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '3.5rem', fontWeight: 300, color: 'rgba(200,169,110,0.25)', lineHeight: 1, marginBottom: '1.5rem' }}>{s.num}</div>
              <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.5rem', fontWeight: 500, color: '#f5f0e8', margin: '0 0 0.75rem' }}>{s.title}</h3>
              <p style={{ fontFamily: "'Mulish', sans-serif", fontSize: '0.9rem', color: '#7a7570', lineHeight: 1.7, margin: 0 }}>{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Pricing ─────────────────────────────────────────────────────────────── */
function Pricing() {
  const [ref, visible] = useReveal();
  return (
    <section id="pricing" ref={ref} style={{ padding: '8rem 2.5rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        <p style={{
          fontFamily: "'Mulish', sans-serif", fontSize: '0.72rem', letterSpacing: '0.2em',
          textTransform: 'uppercase', color: '#c8a96e', marginBottom: '1.5rem',
          opacity: visible ? 1 : 0, transition: 'opacity 0.6s ease',
        }}>Pricing</p>
        <h2 style={{
          fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(2.2rem, 5vw, 3.5rem)',
          fontWeight: 300, color: '#f5f0e8', margin: '0 0 1rem', lineHeight: 1.1,
          opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(16px)',
          transition: 'all 0.7s ease 0.1s',
        }}>
          Managed pricing.<br />No hidden fees.
        </h2>
        <p style={{
          fontFamily: "'Mulish', sans-serif", fontSize: '0.9rem', color: '#7a7570',
          margin: '0 0 4rem', lineHeight: 1.6,
          opacity: visible ? 1 : 0, transition: 'opacity 0.7s ease 0.2s',
        }}>
          Every plan includes a one-time $299 setup fee covering onboarding, DNS configuration, branding setup, and launch testing.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1px', background: 'rgba(255,255,255,0.06)' }}>
          {TIERS.map((tier, i) => (
            <div key={tier.name} style={{
              background: tier.highlighted ? 'rgba(200,169,110,0.05)' : '#0a0a0a',
              padding: '2.5rem',
              opacity: visible ? 1 : 0,
              transform: visible ? 'none' : 'translateY(20px)',
              transition: `all 0.7s ease ${0.2 + i * 0.12}s`,
              position: 'relative',
            }}>
              {tier.highlighted && (
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0,
                  height: '2px', background: '#c8a96e',
                }} />
              )}
              <div style={{ marginBottom: '2rem' }}>
                {tier.highlighted && (
                  <span style={{
                    fontFamily: "'Mulish', sans-serif", fontSize: '0.65rem', letterSpacing: '0.15em',
                    textTransform: 'uppercase', color: '#c8a96e', display: 'block', marginBottom: '0.75rem',
                  }}>Most popular</span>
                )}
                <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.6rem', fontWeight: 500, color: '#f5f0e8', margin: '0 0 0.25rem' }}>{tier.name}</h3>
                <p style={{ fontFamily: "'Mulish', sans-serif", fontSize: '0.82rem', color: '#6b6560', margin: 0, fontStyle: 'italic' }}>{tier.tagline}</p>
              </div>

              <div style={{ marginBottom: '2rem' }}>
                <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '3rem', fontWeight: 600, color: tier.highlighted ? '#c8a96e' : '#f5f0e8' }}>{tier.price}</span>
                <span style={{ fontFamily: "'Mulish', sans-serif", fontSize: '0.82rem', color: '#6b6560' }}>{tier.period}</span>
              </div>

              <p style={{ fontFamily: "'Mulish', sans-serif", fontSize: '0.85rem', color: '#7a7570', lineHeight: 1.65, marginBottom: '2rem' }}>{tier.description}</p>

              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 2.5rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {tier.features.map(f => (
                  <li key={f} style={{ fontFamily: "'Mulish', sans-serif", fontSize: '0.82rem', color: '#9a9590', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#c8a96e', flexShrink: 0 }} />
                    {f}
                  </li>
                ))}
              </ul>

              <a href="#request" style={{
                display: 'block', textAlign: 'center',
                fontFamily: "'Mulish', sans-serif", fontSize: '0.78rem', letterSpacing: '0.1em',
                textTransform: 'uppercase', textDecoration: 'none', fontWeight: 700,
                padding: '0.85rem', borderRadius: '2px',
                background: tier.highlighted ? '#c8a96e' : 'transparent',
                color: tier.highlighted ? '#080808' : '#f5f0e8',
                border: tier.highlighted ? 'none' : '1px solid rgba(245,240,232,0.15)',
                transition: 'all 0.2s',
              }}
                onMouseEnter={e => { e.target.style.opacity = '0.8'; }}
                onMouseLeave={e => { e.target.style.opacity = '1'; }}
              >
                Request {tier.name}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Signup Form ─────────────────────────────────────────────────────────── */
function SignupForm() {
  const [ref, visible] = useReveal();
  const [form, setForm] = useState({
    businessName: '', contactName: '', email: '', phone: '', website: '',
    businessType: '', tierInterest: 'unsure', message: '',
  });
  const [state, setState] = useState('idle'); // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState('');

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async () => {
    if (!form.businessName || !form.contactName || !form.email || !form.businessType) {
      setErrorMsg('Please fill in all required fields.');
      return;
    }
    setState('loading');
    setErrorMsg('');
    try {
      await api.post('/whitelabel/request', form);
      setState('success');
    } catch (e) {
      setState('error');
      setErrorMsg(e?.response?.data?.error === 'validation' ? 'Please check your inputs and try again.' : 'Something went wrong. Please email us directly.');
    }
  };

  const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '2px', padding: '0.85rem 1rem',
    fontFamily: "'Mulish', sans-serif", fontSize: '0.9rem',
    color: '#f5f0e8', outline: 'none',
    transition: 'border-color 0.2s',
  };
  const labelStyle = {
    fontFamily: "'Mulish', sans-serif", fontSize: '0.7rem', letterSpacing: '0.12em',
    textTransform: 'uppercase', color: '#6b6560', display: 'block', marginBottom: '0.4rem',
  };

  if (state === 'success') {
    return (
      <section id="request" ref={ref} style={{ padding: '8rem 2.5rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: '580px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ width: '48px', height: '1px', background: '#c8a96e', margin: '0 auto 2.5rem' }} />
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.5rem', fontWeight: 300, color: '#f5f0e8', margin: '0 0 1rem' }}>
            Request received.
          </h2>
          <p style={{ fontFamily: "'Mulish', sans-serif", fontSize: '0.9rem', color: '#7a7570', lineHeight: 1.7 }}>
            We will review your request and be in touch within one business day to discuss your setup, timeline, and any questions.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section id="request" ref={ref} style={{ padding: '8rem 2.5rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '6rem', alignItems: 'start' }}>

        {/* Left copy */}
        <div style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(16px)', transition: 'all 0.7s ease' }}>
          <p style={{ fontFamily: "'Mulish', sans-serif", fontSize: '0.72rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: '#c8a96e', marginBottom: '1.5rem' }}>
            Request Access
          </p>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: 300, color: '#f5f0e8', margin: '0 0 1.5rem', lineHeight: 1.15 }}>
            Let's get your brand live.
          </h2>
          <p style={{ fontFamily: "'Mulish', sans-serif", fontSize: '0.9rem', color: '#7a7570', lineHeight: 1.7, margin: '0 0 2.5rem' }}>
            Fill in the form and we'll be in touch within one business day. Once confirmed, most clients are fully live within 48 hours.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {[
              { title: 'Setup fee', body: '$299 one-time, covers everything from DNS to launch.' },
              { title: 'Monthly billing', body: 'Charged on the first of each month. Cancel any time.' },
              { title: 'Support included', body: 'You have a direct line. No ticket queue.' },
            ].map(({ title, body }) => (
              <div key={title}>
                <div style={{ fontFamily: "'Mulish', sans-serif", fontSize: '0.78rem', letterSpacing: '0.06em', color: '#f5f0e8', fontWeight: 700, marginBottom: '0.2rem' }}>{title}</div>
                <div style={{ fontFamily: "'Mulish', sans-serif", fontSize: '0.82rem', color: '#6b6560', lineHeight: 1.5 }}>{body}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right form */}
        <div style={{ opacity: visible ? 1 : 0, transform: visible ? 'none' : 'translateY(20px)', transition: 'all 0.7s ease 0.15s' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Business Name <span style={{ color: '#c8a96e' }}>*</span></label>
              <input style={inputStyle} value={form.businessName} onChange={e => set('businessName', e.target.value)}
                placeholder="The Grand Ballroom"
                onFocus={e => e.target.style.borderColor = 'rgba(200,169,110,0.5)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
            </div>

            <div>
              <label style={labelStyle}>Your Name <span style={{ color: '#c8a96e' }}>*</span></label>
              <input style={inputStyle} value={form.contactName} onChange={e => set('contactName', e.target.value)}
                placeholder="Alex Smith"
                onFocus={e => e.target.style.borderColor = 'rgba(200,169,110,0.5)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
            </div>

            <div>
              <label style={labelStyle}>Email <span style={{ color: '#c8a96e' }}>*</span></label>
              <input style={inputStyle} type="email" value={form.email} onChange={e => set('email', e.target.value)}
                placeholder="alex@venue.com"
                onFocus={e => e.target.style.borderColor = 'rgba(200,169,110,0.5)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
            </div>

            <div>
              <label style={labelStyle}>Phone</label>
              <input style={inputStyle} value={form.phone} onChange={e => set('phone', e.target.value)}
                placeholder="+1 (555) 000-0000"
                onFocus={e => e.target.style.borderColor = 'rgba(200,169,110,0.5)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
            </div>

            <div>
              <label style={labelStyle}>Website</label>
              <input style={inputStyle} value={form.website} onChange={e => set('website', e.target.value)}
                placeholder="yourvenue.com"
                onFocus={e => e.target.style.borderColor = 'rgba(200,169,110,0.5)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
            </div>

            <div>
              <label style={labelStyle}>Business Type <span style={{ color: '#c8a96e' }}>*</span></label>
              <select style={{ ...inputStyle, cursor: 'pointer' }}
                value={form.businessType} onChange={e => set('businessType', e.target.value)}
                onFocus={e => e.target.style.borderColor = 'rgba(200,169,110,0.5)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              >
                <option value="" disabled>Select one</option>
                {BUSINESS_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Interested in</label>
              <select style={{ ...inputStyle, cursor: 'pointer' }}
                value={form.tierInterest} onChange={e => set('tierInterest', e.target.value)}
                onFocus={e => e.target.style.borderColor = 'rgba(200,169,110,0.5)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              >
                {TIER_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Message <span style={{ color: '#6b6560', textTransform: 'lowercase', letterSpacing: 0 }}>(optional)</span></label>
              <textarea style={{ ...inputStyle, resize: 'vertical', minHeight: '100px', lineHeight: 1.6 }}
                value={form.message} onChange={e => set('message', e.target.value)}
                placeholder="Tell us about your setup, timeline, or any specific requirements..."
                onFocus={e => e.target.style.borderColor = 'rgba(200,169,110,0.5)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
              />
            </div>

          </div>

          {errorMsg && (
            <p style={{ fontFamily: "'Mulish', sans-serif", fontSize: '0.82rem', color: '#e87070', marginTop: '1rem' }}>{errorMsg}</p>
          )}

          <button
            onClick={handleSubmit}
            disabled={state === 'loading'}
            style={{
              marginTop: '1.5rem', width: '100%',
              fontFamily: "'Mulish', sans-serif", fontSize: '0.8rem', letterSpacing: '0.1em',
              textTransform: 'uppercase', fontWeight: 700,
              background: state === 'loading' ? 'rgba(200,169,110,0.5)' : '#c8a96e',
              color: '#080808', border: 'none', borderRadius: '2px',
              padding: '1rem', cursor: state === 'loading' ? 'default' : 'pointer',
              transition: 'opacity 0.2s',
            }}
            onMouseEnter={e => { if (state !== 'loading') e.target.style.opacity = '0.85'; }}
            onMouseLeave={e => { e.target.style.opacity = '1'; }}
          >
            {state === 'loading' ? 'Sending...' : 'Submit Request'}
          </button>

          <p style={{ fontFamily: "'Mulish', sans-serif", fontSize: '0.75rem', color: '#4a4540', textAlign: 'center', marginTop: '1rem', lineHeight: 1.5 }}>
            By submitting you agree to our{' '}
            <Link to="/terms" style={{ color: '#6b6560', textDecoration: 'underline' }}>Terms</Link>
            {' '}and{' '}
            <Link to="/privacy" style={{ color: '#6b6560', textDecoration: 'underline' }}>Privacy Policy</Link>.
          </p>
        </div>

      </div>
    </section>
  );
}

/* ─── Footer ──────────────────────────────────────────────────────────────── */
function Footer() {
  return (
    <footer style={{
      borderTop: '1px solid rgba(255,255,255,0.06)',
      padding: '3rem 2.5rem',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1.5rem',
    }}>
      <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem', fontWeight: 500, color: 'rgba(245,240,232,0.4)' }}>
        PlanIt
      </span>
      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        {[
          { label: 'Home', href: '/' },
          { label: 'Terms', href: '/terms' },
          { label: 'Privacy', href: '/privacy' },
          { label: 'Support', href: '/support' },
        ].map(({ label, href }) => (
          <Link key={label} to={href} style={{ fontFamily: "'Mulish', sans-serif", fontSize: '0.75rem', letterSpacing: '0.08em', color: '#4a4540', textDecoration: 'none', textTransform: 'uppercase' }}>
            {label}
          </Link>
        ))}
      </div>
    </footer>
  );
}

/* ─── Page ────────────────────────────────────────────────────────────────── */
export default function WhiteLabelSignup() {
  useEffect(() => {
    document.title = 'White Label — PlanIt';
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=Mulish:wght@400;500;600;700&display=swap';
    document.head.appendChild(link);
    return () => { document.head.removeChild(link); document.title = 'PlanIt'; };
  }, []);

  return (
    <div style={{ background: '#080808', minHeight: '100vh', color: '#f5f0e8', overflowX: 'hidden' }}>
      <Nav />
      <Hero />
      <HowItWorks />
      <Pricing />
      <SignupForm />
      <Footer />
    </div>
  );
}
