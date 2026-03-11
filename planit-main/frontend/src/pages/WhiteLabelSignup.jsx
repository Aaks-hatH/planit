import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

const BUSINESS_TYPES = [
  { value: 'restaurant', label: 'Restaurant or Cafe' },
  { value: 'venue', label: 'Venue or Event Space' },
  { value: 'hotel', label: 'Hotel or Hospitality Group' },
  { value: 'corporate', label: 'Corporate or Enterprise' },
  { value: 'other', label: 'Other' },
];

const TIER_OPTIONS = [
  { value: 'basic',      label: 'Basic — $49/month' },
  { value: 'pro',        label: 'Pro — $99/month' },
  { value: 'enterprise', label: 'Enterprise — $149/month' },
  { value: 'unsure',     label: 'Not sure yet' },
];

const TIERS = [
  {
    name: 'Basic', price: '$49.99',
    tagline: 'Launch fast with your brand.',
    features: ['Custom domain and SSL','Logo, colors, and font','Full reservation system','Live waitlist management','Up to 10 events','Up to 500 guests per event','Onboarding and setup included','Ongoing support'],
    highlight: false,
  },
  {
    name: 'Pro', price: '$99.99',
    tagline: 'No PlanIt branding, anywhere.',
    features: ['Everything in Basic','Full PlanIt branding removal','White-labeled confirmation emails','Staff management tools','Higher limits','Priority support'],
    highlight: true,
  },
  {
    name: 'Enterprise', price: '$149.99',
    tagline: 'Total visual control.',
    features: ['Everything in Pro','Custom CSS injection','Multi-location support','Extended limits','Dedicated account manager','SLA guarantee'],
    highlight: false,
  },
];

function useInView() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.08 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return [ref, visible];
}

const inp = {
  width: '100%', boxSizing: 'border-box',
  border: '1px solid #d1d5db', borderRadius: '6px',
  padding: '0.625rem 0.875rem', fontSize: '0.875rem',
  color: '#111827', background: '#fff', outline: 'none',
  transition: 'border-color 0.15s, box-shadow 0.15s',
  fontFamily: 'inherit',
};
const lbl = {
  display: 'block', fontSize: '0.75rem', fontWeight: 600,
  color: '#374151', marginBottom: '0.375rem',
};
const tag = {
  display: 'inline-block', fontSize: '0.72rem', fontWeight: 600,
  letterSpacing: '0.06em', textTransform: 'uppercase',
  color: '#2563eb', background: '#eff6ff',
  padding: '0.25rem 0.625rem', borderRadius: '4px', marginBottom: '1rem',
};
const iFocus = e => { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; };
const iBlur  = e => { e.target.style.borderColor = '#d1d5db'; e.target.style.boxShadow = 'none'; };

function Nav() {
  return (
    <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #e5e7eb', padding: '0 2rem', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'inherit' }}>
      <Link to="/" style={{ fontWeight: 700, fontSize: '1rem', color: '#111827', textDecoration: 'none' }}>PlanIt</Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <a href="#pricing" style={{ fontSize: '0.85rem', color: '#6b7280', textDecoration: 'none', fontWeight: 500 }}>Pricing</a>
        <a href="#request" style={{ fontSize: '0.85rem', fontWeight: 600, textDecoration: 'none', background: '#2563eb', color: '#fff', padding: '0.5rem 1.1rem', borderRadius: '6px' }}>Get Started</a>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '5rem 2rem 4rem' }}>
      <div style={{ maxWidth: '1080px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '4rem', alignItems: 'center' }}>
        <div>
          <div style={tag}>White Label Platform</div>
          <h1 style={{ fontSize: 'clamp(2rem, 4vw, 2.75rem)', fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.03em', color: '#111827', margin: '0 0 1.25rem' }}>
            Your reservation platform. Your brand.
          </h1>
          <p style={{ fontSize: '1rem', color: '#6b7280', lineHeight: 1.7, margin: '0 0 2rem', maxWidth: '460px' }}>
            A fully managed booking and event platform that runs entirely under your domain. Guests never know PlanIt is involved.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <a href="#request" style={{ fontWeight: 600, fontSize: '0.875rem', textDecoration: 'none', background: '#2563eb', color: '#fff', padding: '0.75rem 1.5rem', borderRadius: '6px' }}>Request Access</a>
            <a href="#pricing" style={{ fontWeight: 600, fontSize: '0.875rem', textDecoration: 'none', background: '#f3f4f6', color: '#374151', padding: '0.75rem 1.5rem', borderRadius: '6px' }}>View Pricing</a>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          {[
            { label: 'Custom domain and SSL', sub: 'Your guests visit your domain, not ours.' },
            { label: 'Full reservation system', sub: 'Bookings, waitlists, confirmations — all yours.' },
            { label: 'Fully managed', sub: 'We handle setup, updates, and ongoing support.' },
            { label: 'Live within 48 hours', sub: 'From confirmed agreement to live booking page.' },
          ].map(({ label, sub }) => (
            <div key={label} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '1rem 1.25rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, marginTop: '2px' }}>
                <circle cx="8" cy="8" r="8" fill="#eff6ff" />
                <path d="M4.5 8L7 10.5L11.5 5.5" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#111827', marginBottom: '0.1rem' }}>{label}</div>
                <div style={{ fontSize: '0.78rem', color: '#9ca3af' }}>{sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const [ref, v] = useInView();
  return (
    <section ref={ref} style={{ padding: '5rem 2rem', background: '#f9fafb' }}>
      <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
        <div style={{ marginBottom: '2.5rem' }}>
          <div style={tag}>How it works</div>
          <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2.1rem)', fontWeight: 700, color: '#111827', margin: 0, letterSpacing: '-0.02em' }}>Three steps from sign-up to live bookings.</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
          {[
            { n: '1', title: 'Submit a request', body: 'Fill in the form with your business details and the plan you are interested in. We will be in touch within one business day.' },
            { n: '2', title: 'We configure everything', body: 'Our team sets up your domain, SSL, branding, and email templates. No technical work required from you.' },
            { n: '3', title: 'Go live', body: 'Your guests book through your branded domain. Confirmations arrive from your brand. PlanIt is never visible.' },
          ].map((step, i) => (
            <div key={step.n} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '1.75rem', opacity: v ? 1 : 0, transform: v ? 'none' : 'translateY(14px)', transition: `opacity 0.45s ease ${i * 0.1}s, transform 0.45s ease ${i * 0.1}s` }}>
              <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: '#eff6ff', color: '#2563eb', fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>{step.n}</div>
              <h3 style={{ fontWeight: 700, fontSize: '0.9rem', color: '#111827', margin: '0 0 0.5rem' }}>{step.title}</h3>
              <p style={{ fontSize: '0.82rem', color: '#6b7280', lineHeight: 1.65, margin: 0 }}>{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const [ref, v] = useInView();
  return (
    <section id="pricing" ref={ref} style={{ padding: '5rem 2rem', background: '#fff', borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}>
      <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
        <div style={{ marginBottom: '3rem' }}>
          <div style={tag}>Pricing</div>
          <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2.1rem)', fontWeight: 700, color: '#111827', margin: '0 0 0.75rem', letterSpacing: '-0.02em' }}>Simple, transparent pricing.</h2>
          <p style={{ fontSize: '0.95rem', color: '#6b7280', lineHeight: 1.65, marginBottom: '0.5rem' }}>All plans include a one-time $299 setup fee for onboarding, DNS, branding, and launch testing.</p>
          <p style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Cancel any time. No lock-in contracts.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '1.25rem' }}>
          {TIERS.map((tier, i) => (
            <div key={tier.name} style={{ background: tier.highlight ? '#1d4ed8' : '#fff', border: tier.highlight ? '2px solid #1d4ed8' : '1px solid #e5e7eb', borderRadius: '10px', padding: '2rem', opacity: v ? 1 : 0, transform: v ? 'none' : 'translateY(14px)', transition: `opacity 0.45s ease ${i * 0.1}s, transform 0.45s ease ${i * 0.1}s` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: tier.highlight ? '#fff' : '#111827' }}>{tier.name}</span>
                {tier.highlight && <span style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', background: 'rgba(255,255,255,0.2)', color: '#fff', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>Most Popular</span>}
              </div>
              <p style={{ fontSize: '0.78rem', color: tier.highlight ? 'rgba(255,255,255,0.65)' : '#9ca3af', margin: '0 0 1.5rem' }}>{tier.tagline}</p>
              <div style={{ marginBottom: '1.75rem' }}>
                <span style={{ fontSize: '2.25rem', fontWeight: 800, letterSpacing: '-0.03em', color: tier.highlight ? '#fff' : '#111827' }}>{tier.price}</span>
                <span style={{ fontSize: '0.82rem', color: tier.highlight ? 'rgba(255,255,255,0.55)' : '#9ca3af' }}>/month</span>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 2rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {tier.features.map(f => (
                  <li key={f} style={{ fontSize: '0.82rem', color: tier.highlight ? 'rgba(255,255,255,0.85)' : '#374151', display: 'flex', gap: '0.6rem', alignItems: 'flex-start', lineHeight: 1.5 }}>
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0, marginTop: '1px' }}>
                      <path d="M2.5 7L5.5 10L11.5 4" stroke={tier.highlight ? 'rgba(255,255,255,0.75)' : '#2563eb'} strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <a href="#request" style={{ display: 'block', textAlign: 'center', fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none', padding: '0.7rem', borderRadius: '6px', background: tier.highlight ? '#fff' : '#2563eb', color: tier.highlight ? '#1d4ed8' : '#fff' }}>
                Get started with {tier.name}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function RequestForm() {
  const [ref, v] = useInView();
  const [form, setForm] = useState({ businessName: '', contactName: '', email: '', phone: '', website: '', businessType: '', tierInterest: 'unsure', message: '' });
  const [state, setState] = useState('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const set = (k, val) => setForm(p => ({ ...p, [k]: val }));

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
      setErrorMsg(e?.response?.data?.error === 'validation' ? 'Please check your entries and try again.' : 'Something went wrong. Please email us directly.');
    }
  };

  if (state === 'success') {
    return (
      <section id="request" style={{ padding: '5rem 2rem', background: '#fff', borderTop: '1px solid #e5e7eb' }}>
        <div style={{ maxWidth: '500px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M4.5 11L9 15.5L17.5 7" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#111827', margin: '0 0 0.75rem', letterSpacing: '-0.02em' }}>Request received.</h2>
          <p style={{ fontSize: '0.95rem', color: '#6b7280', lineHeight: 1.65 }}>We will review your details and follow up within one business day to discuss your setup and timeline.</p>
        </div>
      </section>
    );
  }

  return (
    <section id="request" ref={ref} style={{ padding: '5rem 2rem', background: '#fff', borderTop: '1px solid #e5e7eb' }}>
      <div style={{ maxWidth: '1080px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '4rem', alignItems: 'start' }}>
        <div style={{ opacity: v ? 1 : 0, transition: 'opacity 0.45s ease' }}>
          <div style={tag}>Request Access</div>
          <h2 style={{ fontSize: 'clamp(1.5rem, 3vw, 2.1rem)', fontWeight: 700, color: '#111827', margin: '0 0 0.75rem', letterSpacing: '-0.02em' }}>Ready to get started?</h2>
          <p style={{ fontSize: '0.95rem', color: '#6b7280', lineHeight: 1.65, marginBottom: '2.5rem' }}>Fill in your details and we will reach out within one business day. Most clients are live within 48 hours of confirmation.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {[
              { title: 'One-time setup fee', body: '$299 covers DNS, SSL, branding, and launch testing.' },
              { title: 'Monthly billing', body: 'Billed on the first of each month. Cancel any time.' },
              { title: 'Support included', body: 'Direct access — no support tickets, no queue.' },
            ].map(({ title, body }) => (
              <div key={title} style={{ borderLeft: '3px solid #e5e7eb', paddingLeft: '1rem' }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827', marginBottom: '0.2rem' }}>{title}</div>
                <div style={{ fontSize: '0.8rem', color: '#9ca3af', lineHeight: 1.5 }}>{body}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '2rem', opacity: v ? 1 : 0, transform: v ? 'none' : 'translateY(14px)', transition: 'opacity 0.45s ease 0.1s, transform 0.45s ease 0.1s' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>Business Name <span style={{ color: '#ef4444' }}>*</span></label>
              <input style={inp} value={form.businessName} onChange={e => set('businessName', e.target.value)} placeholder="The Grand Ballroom" onFocus={iFocus} onBlur={iBlur} />
            </div>
            <div>
              <label style={lbl}>Your Name <span style={{ color: '#ef4444' }}>*</span></label>
              <input style={inp} value={form.contactName} onChange={e => set('contactName', e.target.value)} placeholder="Alex Smith" onFocus={iFocus} onBlur={iBlur} />
            </div>
            <div>
              <label style={lbl}>Email <span style={{ color: '#ef4444' }}>*</span></label>
              <input style={inp} type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="alex@yourbusiness.com" onFocus={iFocus} onBlur={iBlur} />
            </div>
            <div>
              <label style={lbl}>Phone <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span></label>
              <input style={inp} value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+1 (555) 000-0000" onFocus={iFocus} onBlur={iBlur} />
            </div>
            <div>
              <label style={lbl}>Website <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span></label>
              <input style={inp} value={form.website} onChange={e => set('website', e.target.value)} placeholder="yourbusiness.com" onFocus={iFocus} onBlur={iBlur} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>Business Type <span style={{ color: '#ef4444' }}>*</span></label>
              <select style={{ ...inp, cursor: 'pointer', color: form.businessType ? '#111827' : '#9ca3af' }} value={form.businessType} onChange={e => set('businessType', e.target.value)} onFocus={iFocus} onBlur={iBlur}>
                <option value="" disabled>Select type...</option>
                {BUSINESS_TYPES.map(t => <option key={t.value} value={t.value} style={{ color: '#111827' }}>{t.label}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>Plan interest</label>
              <select style={{ ...inp, cursor: 'pointer' }} value={form.tierInterest} onChange={e => set('tierInterest', e.target.value)} onFocus={iFocus} onBlur={iBlur}>
                {TIER_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>Additional notes <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span></label>
              <textarea style={{ ...inp, resize: 'vertical', minHeight: '80px', lineHeight: 1.6 }} value={form.message} onChange={e => set('message', e.target.value)} placeholder="Timeline, specific requirements, number of locations..." onFocus={iFocus} onBlur={iBlur} />
            </div>
          </div>
          {errorMsg && <p style={{ fontSize: '0.8rem', color: '#ef4444', marginTop: '0.75rem', marginBottom: 0 }}>{errorMsg}</p>}
          <button onClick={handleSubmit} disabled={state === 'loading'} style={{ marginTop: '1.25rem', width: '100%', fontWeight: 600, fontSize: '0.875rem', background: state === 'loading' ? '#93c5fd' : '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', padding: '0.8rem', cursor: state === 'loading' ? 'default' : 'pointer', fontFamily: 'inherit' }}>
            {state === 'loading' ? 'Sending...' : 'Submit Request'}
          </button>
          <p style={{ fontSize: '0.72rem', color: '#9ca3af', textAlign: 'center', marginTop: '0.75rem', marginBottom: 0 }}>
            By submitting you agree to our <Link to="/terms" style={{ color: '#6b7280' }}>Terms</Link> and <Link to="/privacy" style={{ color: '#6b7280' }}>Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer style={{ borderTop: '1px solid #e5e7eb', background: '#fff', padding: '1.75rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
      <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#9ca3af' }}>PlanIt</span>
      <div style={{ display: 'flex', gap: '1.5rem' }}>
        {[['Home', '/'], ['Terms', '/terms'], ['Privacy', '/privacy'], ['Support', '/support']].map(([label, href]) => (
          <Link key={label} to={href} style={{ fontSize: '0.8rem', color: '#9ca3af', textDecoration: 'none' }}>{label}</Link>
        ))}
      </div>
    </footer>
  );
}

export default function WhiteLabelSignup() {
  useEffect(() => {
    document.title = 'White Label — PlanIt';
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap';
    document.head.appendChild(link);
    return () => { try { document.head.removeChild(link); } catch {} document.title = 'PlanIt'; };
  }, []);

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", background: '#f9fafb', minHeight: '100vh', color: '#111827' }}>
      <Nav />
      <Hero />
      <HowItWorks />
      <Pricing />
      <RequestForm />
      <Footer />
    </div>
  );
}
