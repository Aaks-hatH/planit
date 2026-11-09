import { useState, useEffect } from 'react';

/**
 * RecoveryCodeModal
 *
 * Shown exactly once when a user first sets an account password (at event
 * creation, at join, or when generating a code manually from the banner).
 *
 * Props:
 *   code        — the plain-text XXXX-XXXX-XXXX-XXXX-XXXX code (string)
 *   onDismiss   — called when the user confirms they have saved the code
 *   eventSlug   — optional, used to populate the /forgot-password link
 */
export default function RecoveryCodeModal({ code, onDismiss, eventSlug }) {
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied]       = useState(false);

  // Block scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // Prevent Escape from closing
  useEffect(() => {
    const block = (e) => { if (e.key === 'Escape') e.preventDefault(); };
    window.addEventListener('keydown', block, true);
    return () => window.removeEventListener('keydown', block, true);
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    // No onClick on backdrop — intentionally non-dismissible
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#ffffff', 
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        style={{
          background: '#ffffff',
          border: '2px solid #0d0e1c',
          borderRadius: '8px',
          padding: '2rem',
          maxWidth: '480px',
          width: '100%',
          boxShadow: '4px 4px 0 #0d0e1c',
        }}
      >
        {/* Amber warning header */}
        <div style={{
          background: '#fff6c2',
          border: '2px solid #6e5400',
          borderRadius: '0.625rem',
          padding: '0.875rem 1rem',
          marginBottom: '1.25rem',
        }}>
          <p style={{
            fontSize: '0.8rem', fontWeight: 800, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: '#6e5400', marginBottom: '0.375rem',
          }}>
            Shown exactly once — save this now
          </p>
          <p style={{ fontSize: '0.8125rem', color: '#6e5400', lineHeight: 1.55, margin: 0 }}>
            This recovery code is displayed <strong>one time only</strong> and cannot
            be retrieved again. If you lose it and forget your account password, you will
            not be able to self-serve reset it.
          </p>
        </div>

        <h2 style={{
          fontSize: '1rem', fontWeight: 700, color: '#0d0e1c',
          marginBottom: '0.5rem', marginTop: 0,
        }}>
          Your account recovery code
        </h2>

        {/* The code itself */}
        <div style={{
          background: '#ffffff',
          border: '2px solid #0d0e1c',
          borderRadius: '0.625rem',
          padding: '1.25rem 1rem',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '0.75rem',
        }}>
          <span style={{
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontSize: '1.1rem', fontWeight: 700, color: '#0d0e1c',
            letterSpacing: '0.08em', wordBreak: 'break-all',
          }}>
            {code}
          </span>
          <button
            onClick={handleCopy}
            style={{
              background: copied ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.07)',
              border: `1px solid ${copied ? 'rgba(16,185,129,0.35)' : 'rgba(255,255,255,0.12)'}`,
              borderRadius: '0.375rem',
              color: copied ? '#6ee7b7' : 'rgba(255,255,255,0.6)',
              cursor: 'pointer',
              fontSize: '0.7rem', fontWeight: 700,
              letterSpacing: '0.05em', textTransform: 'uppercase',
              padding: '0.375rem 0.625rem',
              flexShrink: 0,
              transition: 'all 0.2s',
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        {/* Three mandatory bullet points */}
        <ul style={{
          margin: '0 0 1.25rem', padding: '0 0 0 1.125rem',
          listStyle: 'disc',
        }}>
          {[
            'This code lets you reset your account password at /forgot-password without needing email.',
            'Save it somewhere safe — a password manager, a note, or written down — before dismissing this dialog.',
            'It is one-time use: once used to reset your password it is immediately invalidated.',
          ].map((item, i) => (
            <li key={i} style={{
              fontSize: '0.8125rem', color: '#5a5d70',
              lineHeight: 1.55, marginBottom: i < 2 ? '0.5rem' : 0,
            }}>
              {item}
            </li>
          ))}
        </ul>

        {/* Confirmation checkbox */}
        <label style={{
          display: 'flex', alignItems: 'flex-start', gap: '0.625rem',
          cursor: 'pointer', marginBottom: '1.125rem',
        }}>
          <input
            type="checkbox"
            checked={confirmed}
            onChange={e => setConfirmed(e.target.checked)}
            style={{ marginTop: '0.15rem', accentColor: '#f59e0b', flexShrink: 0 }}
          />
          <span style={{ fontSize: '0.8125rem', color: '#0d0e1c', lineHeight: 1.5 }}>
            I have saved my recovery code and understand I cannot retrieve it again.
          </span>
        </label>

        {/* Dismiss button — disabled until confirmed */}
        <button
          onClick={() => confirmed && onDismiss()}
          disabled={!confirmed}
          style={{
            width: '100%',
            padding: '0.75rem',
            borderRadius: '0.5rem',
            border: 'none',
            cursor: confirmed ? 'pointer' : 'not-allowed',
            fontWeight: 700, fontSize: '0.875rem',
            background: confirmed ? '#f59e0b' : 'rgba(255,255,255,0.06)',
            color: confirmed ? '#000' : 'rgba(255,255,255,0.25)',
            transition: 'all 0.2s',
          }}
        >
          I have saved my recovery code — continue
        </button>
      </div>
    </div>
  );
}