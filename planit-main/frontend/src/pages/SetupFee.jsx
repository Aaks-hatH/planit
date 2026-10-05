import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../services/api';

const inp = {
  width: '100%', boxSizing: 'border-box',
  border: '1px solid #d1d5db', borderRadius: '6px',
  padding: '0.625rem 0.875rem', fontSize: '0.875rem',
  color: '#111827', background: '#fff', outline: 'none',
  transition: 'border-color 0.15s, box-shadow 0.15s',
  fontFamily: 'inherit',
};
const lbl = { display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: '0.375rem' };
const iFocus = e => { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; };
const iBlur  = e => { e.target.style.borderColor = '#d1d5db'; e.target.style.boxShadow = 'none'; };

export default function SetupFee() {
  const [params] = useSearchParams();
  const prefillLead   = params.get('lead')     || '';
  const prefillBiz    = params.get('business') || '';
  const prefillEmail  = params.get('email')    || '';
  const prefillName   = params.get('name')     || '';

  const [form, setForm] = useState({
    leadId:       prefillLead,
    businessName: prefillBiz,
    email:        prefillEmail,
    contactName:  prefillName,
  });
  const [state, setState] = useState('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Setup Fee — PlanIt White Label';
  }, []);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handlePay = async () => {
    if (!form.leadId) { setError('Please use the payment link from your sign-up confirmation.'); return; }
    setState('loading');
    setError('');
    try {
      // Price and buyer details are decided by the server from your sign-up record.
      const r = await api.post('/whitelabel/setup-fee/checkout', { leadId: form.leadId });
      window.location.href = r.data.payUrl;
    } catch (e) {
      setState('idle');
      const code = e?.response?.data?.error;
      setError(
        code === 'already_paid' ? 'This setup fee has already been paid — thank you!'
        : code === 'validation' || code === 'not_found' ? 'We could not find your sign-up. Please use the link from your confirmation.'
        : e?.response?.data?.message || 'Something went wrong. Please try again or contact us.'
      );
    }
  };

  return (
    <div className="font-sans" style={{ background: '#f9fafb', minHeight: '100vh', color: '#111827' }}>
      {/* Nav */}
      <nav style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '0 2rem', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link to="/" style={{ fontWeight: 700, fontSize: '1rem', color: '#111827', textDecoration: 'none' }}>PlanIt</Link>
        <Link to="/white-label" style={{ fontSize: '0.82rem', color: '#6b7280', textDecoration: 'none' }}>← Back to White Label</Link>
      </nav>

      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '4rem 2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '3rem', alignItems: 'start' }}>

        {/* Left — What you get */}
        <div>
          <div style={{ display: 'inline-block', fontSize: '0.72rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#2563eb', background: '#eff6ff', padding: '0.25rem 0.625rem', borderRadius: '4px', marginBottom: '1rem' }}>
            One-time payment
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, letterSpacing: '-0.03em', color: '#111827', margin: '0 0 0.5rem' }}>Setup Fee</h1>
          <div style={{ fontSize: '2.5rem', fontWeight: 800, color: '#2563eb', letterSpacing: '-0.03em', margin: '0 0 1.5rem' }}>$299</div>
          <p style={{ fontSize: '0.95rem', color: '#6b7280', lineHeight: 1.7, marginBottom: '2.5rem' }}>
            Paid once before we begin your setup. After payment, our team will reach out within 24 hours to start configuration. Your platform will be live within 48 hours.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[
              { title: 'DNS & SSL configuration', body: 'We handle CNAME setup and SSL certificate provisioning for your custom domain.' },
              { title: 'Branding setup', body: 'Logo, colors, fonts, and email templates configured to your brand guidelines.' },
              { title: 'Full launch testing', body: 'We test the complete booking flow on your domain before handing it over.' },
              { title: 'Onboarding walkthrough', body: 'A live session showing you how to manage events, reservations, and staff.' },
            ].map(({ title, body }) => (
              <div key={title} style={{ display: 'flex', gap: '0.875rem', alignItems: 'flex-start' }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M1.5 5L4 7.5L8.5 2.5" stroke="#2563eb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#111827', marginBottom: '0.1rem' }}>{title}</div>
                  <div style={{ fontSize: '0.78rem', color: '#9ca3af', lineHeight: 1.5 }}>{body}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '2rem', padding: '1rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#15803d', marginBottom: '0.25rem' }}>Pay with Bitcoin</div>
            <div style={{ fontSize: '0.75rem', color: '#16a34a' }}>No card details, no account. A unique address is generated for your order and funds go straight to PlanIt's wallet.</div>
          </div>
        </div>

        {/* Right — Payment form */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '2rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#111827', margin: '0 0 1.5rem' }}>Your details</h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label style={lbl}>Business Name <span style={{ color: '#ef4444' }}>*</span></label>
              <input style={inp} value={form.businessName} onChange={e => set('businessName', e.target.value)}
                placeholder="The Grand Ballroom" onFocus={iFocus} onBlur={iBlur} />
            </div>
            <div>
              <label style={lbl}>Contact Name</label>
              <input style={inp} value={form.contactName} onChange={e => set('contactName', e.target.value)}
                placeholder="Alex Smith" onFocus={iFocus} onBlur={iBlur} />
            </div>
            <div>
              <label style={lbl}>Email <span style={{ color: '#ef4444' }}>*</span></label>
              <input style={inp} type="email" value={form.email} onChange={e => set('email', e.target.value)}
                placeholder="alex@yourbusiness.com" onFocus={iFocus} onBlur={iBlur} />
            </div>
          </div>

          {error && <p style={{ fontSize: '0.8rem', color: '#ef4444', margin: '0.75rem 0 0' }}>{error}</p>}

          <button onClick={handlePay} disabled={state === 'loading'} style={{
            marginTop: '1.5rem', width: '100%',
            fontWeight: 700, fontSize: '0.9rem', fontFamily: 'inherit',
            background: state === 'loading' ? '#93c5fd' : '#2563eb',
            color: '#fff', border: 'none', borderRadius: '6px',
            padding: '0.875rem', cursor: state === 'loading' ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
          }}>
            {state === 'loading' ? 'Creating your invoice...' : 'Pay $299 with Bitcoin'}
          </button>

          <p style={{ fontSize: '0.72rem', color: '#9ca3af', textAlign: 'center', margin: '0.875rem 0 0', lineHeight: 1.5 }}>
            You'll get a Bitcoin invoice with the amount locked at the current rate for 60 minutes. By paying you agree to our{' '}
            <Link to="/terms" style={{ color: '#6b7280' }}>Terms of Service</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}
