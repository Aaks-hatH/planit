import { useState, useEffect } from 'react';
import { Shield, X, Check } from 'lucide-react';

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
  // Also poll via custom event dispatched by ConsentBanner
  const domHandler = (e) => {
    document.removeEventListener('planit:consent', domHandler);
    cb(e.detail?.accepted === true);
  };
  document.addEventListener('planit:consent', domHandler);
}

export default function ConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const stored = getStoredConsent();
    if (stored === null) {
      // Short delay so the page content loads first
      const t = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  function accept() {
    storeConsent(true);
    document.dispatchEvent(new CustomEvent('planit:consent', { detail: { accepted: true } }));
    setDismissed(true);
    setTimeout(() => setVisible(false), 400);
  }

  function decline() {
    storeConsent(false);
    document.dispatchEvent(new CustomEvent('planit:consent', { detail: { accepted: false } }));
    setDismissed(true);
    setTimeout(() => setVisible(false), 400);
  }

  if (!visible) return null;

  return (
    <div
      aria-live="polite"
      aria-label="Cookie consent"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        display: 'flex',
        justifyContent: 'center',
        padding: '0 16px 20px',
        pointerEvents: 'none',
        transform: dismissed ? 'translateY(120%)' : 'translateY(0)',
        transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      <div
        style={{
          pointerEvents: 'auto',
          background: '#ffffff',
          border: '1px solid #e5e7eb',
          borderRadius: '14px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)',
          maxWidth: '640px',
          width: '100%',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '14px',
        }}
      >
        {/* Icon */}
        <div style={{
          flexShrink: 0,
          width: 36,
          height: 36,
          borderRadius: 9,
          background: '#f3f4f6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 1,
        }}>
          <Shield size={17} style={{ color: '#374151' }} />
        </div>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            margin: 0,
            fontSize: 13,
            color: '#374151',
            lineHeight: 1.55,
          }}>
            We use cookies and local storage to keep you signed in and to understand how PlanIt is used — helping us improve reliability and security.{' '}
            <a
              href="/privacy"
              style={{ color: '#111827', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 2 }}
              target="_blank"
              rel="noopener noreferrer"
            >
              Privacy Policy
            </a>
          </p>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, paddingTop: 1 }}>
          <button
            onClick={decline}
            style={{
              background: 'none',
              border: '1px solid #d1d5db',
              borderRadius: 8,
              padding: '7px 14px',
              fontSize: 13,
              fontWeight: 600,
              color: '#6b7280',
              cursor: 'pointer',
              lineHeight: 1,
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f9fafb'; e.currentTarget.style.color = '#374151'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#6b7280'; }}
          >
            Decline
          </button>
          <button
            onClick={accept}
            style={{
              background: '#111827',
              border: '1px solid #111827',
              borderRadius: 8,
              padding: '7px 14px',
              fontSize: 13,
              fontWeight: 600,
              color: '#ffffff',
              cursor: 'pointer',
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#1f2937'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#111827'; }}
          >
            <Check size={13} strokeWidth={2.5} />
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}