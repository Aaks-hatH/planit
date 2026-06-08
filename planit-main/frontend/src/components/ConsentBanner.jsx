import { useState, useEffect } from 'react';

const CONSENT_KEY = 'planit_cookie_consent';
const CONSENT_VERSION = '1';

function getStoredConsent() {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.v !== CONSENT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

function storeConsent(accepted) {
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({
      v: CONSENT_VERSION,
      accepted,
      ts: Date.now(),
    }));
  } catch {}
}

export function hasAnalyticsConsent() {
  const stored = getStoredConsent();
  return stored?.accepted === true;
}

export function waitForConsent(cb) {
  const stored = getStoredConsent();
  if (stored !== null) { cb(stored.accepted); return; }
  const handler = (e) => {
    if (e.key === CONSENT_KEY) {
      window.removeEventListener('storage', handler);
      const v = getStoredConsent();
      cb(v?.accepted === true);
    }
  };
  window.addEventListener('storage', handler);
  const domHandler = (e) => {
    document.removeEventListener('planit:consent', domHandler);
    cb(e.detail?.accepted === true);
  };
  document.addEventListener('planit:consent', domHandler);
}

export default function ConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [out, setOut] = useState(false);

  useEffect(() => {
    const stored = getStoredConsent();
    if (stored === null) {
      const t = setTimeout(() => setVisible(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  function dismiss(accepted) {
    storeConsent(accepted);
    document.dispatchEvent(new CustomEvent('planit:consent', { detail: { accepted } }));
    setOut(true);
    setTimeout(() => setVisible(false), 300);
  }

  if (!visible) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Cookie preferences"
      style={{
        position: 'fixed',
        bottom: 16,
        left: '50%',
        transform: out
          ? 'translateX(-50%) translateY(20px)'
          : 'translateX(-50%) translateY(0)',
        opacity: out ? 0 : 1,
        transition: 'opacity 0.25s ease, transform 0.25s ease',
        zIndex: 9999,
        pointerEvents: out ? 'none' : 'auto',
        width: 'calc(100% - 32px)',
        maxWidth: 520,
      }}
    >
      <div
        style={{
          background: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: '1px solid rgba(0,0,0,0.08)',
          borderRadius: 10,
          boxShadow: '0 2px 16px rgba(0,0,0,0.07)',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        {/* Text */}
        <p style={{
          flex: 1,
          margin: 0,
          fontSize: 12,
          color: '#6b7280',
          lineHeight: 1.5,
        }}>
          We use cookies to keep you signed in and improve the platform.{' '}
          <a
            href="/privacy"
            style={{ color: '#9ca3af', textDecoration: 'underline', textUnderlineOffset: 2 }}
            target="_blank"
            rel="noopener noreferrer"
          >
            Learn more
          </a>
        </p>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button
            onClick={() => dismiss(false)}
            style={{
              background: 'none',
              border: '1px solid #e5e7eb',
              borderRadius: 6,
              padding: '5px 10px',
              fontSize: 11,
              fontWeight: 600,
              color: '#9ca3af',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              lineHeight: 1,
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#6b7280'; e.currentTarget.style.borderColor = '#d1d5db'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#9ca3af'; e.currentTarget.style.borderColor = '#e5e7eb'; }}
          >
            Decline
          </button>
          <button
            onClick={() => dismiss(true)}
            style={{
              background: '#111827',
              border: '1px solid #111827',
              borderRadius: 6,
              padding: '5px 12px',
              fontSize: 11,
              fontWeight: 600,
              color: '#fff',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              lineHeight: 1,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#374151'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#111827'; }}
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}