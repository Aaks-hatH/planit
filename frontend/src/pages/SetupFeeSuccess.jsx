import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../services/api';

export default function SetupFeeSuccess() {
  const [params] = useSearchParams();
  const sessionId = params.get('session_id');
  const [state, setState] = useState('loading');
  const [data, setData] = useState(null);

  useEffect(() => {
    document.title = 'Payment Confirmed — PlanIt';
    if (!sessionId) { setState('error'); return; }
    api.get(`/whitelabel/setup-fee/verify?session_id=${sessionId}`)
      .then(r => { setData(r.data); setState('success'); })
      .catch(() => setState('error'));
  }, [sessionId]);

  const font = { fontFamily: "'Inter', -apple-system, sans-serif" };

  return (
    <div style={{ ...font, background: '#f9fafb', minHeight: '100vh', color: '#111827' }}>
      <nav style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '0 2rem', height: '56px', display: 'flex', alignItems: 'center' }}>
        <Link to="/" style={{ fontWeight: 700, fontSize: '1rem', color: '#111827', textDecoration: 'none' }}>PlanIt</Link>
      </nav>

      <div style={{ maxWidth: '560px', margin: '0 auto', padding: '6rem 2rem', textAlign: 'center' }}>
        {state === 'loading' && (
          <div style={{ color: '#9ca3af', fontSize: '0.9rem' }}>Confirming your payment...</div>
        )}

        {state === 'success' && (
          <>
            <div style={{ width: '56px', height: '56px', background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.75rem' }}>
              <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
                <path d="M5 13L10.5 18.5L21 8" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#111827', margin: '0 0 0.75rem', letterSpacing: '-0.03em' }}>Payment confirmed.</h1>
            <p style={{ fontSize: '1rem', color: '#6b7280', lineHeight: 1.7, margin: '0 0 2.5rem' }}>
              {data?.businessName ? `Thank you, ${data.businessName}.` : 'Thank you.'} Your setup fee has been received. We will reach out to <strong style={{ color: '#374151' }}>{data?.email}</strong> within 24 hours to begin your configuration.
            </p>

            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '1.5rem', marginBottom: '2rem', textAlign: 'left' }}>
              <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#111827', marginBottom: '1rem' }}>What happens next</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                {[
                  { n: '1', text: 'We review your request and prepare your configuration.' },
                  { n: '2', text: 'We email you DNS instructions — one CNAME record to add.' },
                  { n: '3', text: 'We configure your branding, domain, and booking system.' },
                  { n: '4', text: 'We test everything and hand you the keys. Usually within 48 hours.' },
                ].map(({ n, text }) => (
                  <div key={n} style={{ display: 'flex', gap: '0.875rem', alignItems: 'flex-start' }}>
                    <div style={{ width: '22px', height: '22px', borderRadius: '6px', background: '#eff6ff', color: '#2563eb', fontWeight: 700, fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{n}</div>
                    <div style={{ fontSize: '0.85rem', color: '#374151', lineHeight: 1.55, paddingTop: '2px' }}>{text}</div>
                  </div>
                ))}
              </div>
            </div>

            <Link to="/" style={{ fontSize: '0.85rem', color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}>← Back to PlanIt</Link>
          </>
        )}

        {state === 'error' && (
          <>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#111827', margin: '0 0 0.75rem' }}>Something went wrong.</h1>
            <p style={{ fontSize: '0.95rem', color: '#6b7280', lineHeight: 1.7, margin: '0 0 1.5rem' }}>
              We could not verify your payment. If you were charged, please contact us and we will sort it out immediately.
            </p>
            <a href="mailto:planit.userhelp@gmail.com" style={{ fontSize: '0.9rem', color: '#2563eb', fontWeight: 600 }}>planit.userhelp@gmail.com</a>
          </>
        )}
      </div>
    </div>
  );
}
