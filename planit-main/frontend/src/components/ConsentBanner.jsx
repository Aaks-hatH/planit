import { useState, useEffect } from 'react';

const CONSENT_KEY = 'planit_cookie_consent';
const CONSENT_VERSION = '1';

// NOTE: This banner is an acknowledgment notice, not an opt-out control.
// Analytics (GA4 and PlanIt's backend pipeline) run for every visitor
// regardless of whether this notice has been seen or dismissed. See
// Privacy Policy Section 9 and Terms of Service Section 12.2.

function hasAcknowledged() {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return parsed.v === CONSENT_VERSION && parsed.acknowledged === true;
  } catch {
    return false;
  }
}

function storeAcknowledgment() {
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({
      v: CONSENT_VERSION,
      acknowledged: true,
      ts: Date.now(),
    }));
  } catch {}
}

export default function ConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [out, setOut] = useState(false);

  useEffect(() => {
    if (!hasAcknowledged()) {
      const t = setTimeout(() => setVisible(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  function dismiss() {
    storeAcknowledgment();
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
          background: '#ffffff',
          
          
          border: '2px solid #0d0e1c',
          borderRadius: 10,
          boxShadow: '4px 4px 0 #0d0e1c',
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
          We use cookies and platform analytics to run and improve the site.{' '}
          <a
            href="/privacy"
            style={{ color: '#5a5d70', textDecoration: 'underline', textUnderlineOffset: 2 }}
            target="_blank"
            rel="noopener noreferrer"
          >
            Learn more
          </a>
        </p>

        {/* Acknowledgment — informational only, does not opt out of analytics */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button
            onClick={() => dismiss()}
            style={{
              background: '#ffffff',
              border: '2px solid #2236ff',
              borderRadius: 6,
              padding: '5px 12px',
              fontSize: 11,
              fontWeight: 600,
              color: '#0d0e1c',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              lineHeight: 1, boxShadow: '3px 3px 0 #0d0e1c',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#374151'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#111827'; }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
