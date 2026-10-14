import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { eventAPI } from '../services/api';

/* ── Password strength bar ─────────────────────────────────────────────── */
function strengthScore(pwd) {
  if (!pwd) return 0;
  let score = 0;
  if (pwd.length >= 8)  score++;
  if (pwd.length >= 12) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  return score;
}

const STRENGTH_LABELS = ['', 'Weak', 'Weak', 'Fair', 'Good', 'Strong'];
const STRENGTH_COLORS = ['', '#ef4444', '#f97316', '#f59e0b', '#22c55e', '#16a34a'];

function StrengthBar({ password }) {
  const score = strengthScore(password);
  if (!password) return null;
  return (
    <div style={{ marginTop: '0.5rem' }}>
      <div style={{ display: 'flex', gap: '3px', marginBottom: '0.25rem' }}>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{
            flex: 1, height: '3px', borderRadius: '9999px',
            background: i <= score ? STRENGTH_COLORS[score] : 'rgba(255,255,255,0.1)',
            transition: 'background 0.3s',
          }} />
        ))}
      </div>
      <p style={{ fontSize: '0.7rem', color: STRENGTH_COLORS[score], margin: 0, fontWeight: 600 }}>
        {STRENGTH_LABELS[score]}
      </p>
    </div>
  );
}

/* ── Eye icon ───────────────────────────────────────────────────────────── */
function EyeToggle({ show, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      tabIndex={-1}
      style={{
        position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)',
        background: 'none', border: 'none', cursor: 'pointer',
        color: 'rgba(255,255,255,0.35)', padding: 0, lineHeight: 1,
      }}
    >
      {show ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      )}
    </button>
  );
}

/* ── Shared input style ─────────────────────────────────────────────────── */
const inputStyle = {
  width: '100%', boxSizing: 'border-box',
  padding: '0.7rem 0.875rem',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '0.5rem',
  color: '#fff', fontSize: '0.875rem',
  outline: 'none',
  transition: 'border-color 0.2s',
};

const labelStyle = {
  display: 'block',
  fontSize: '0.7rem', fontWeight: 700,
  letterSpacing: '0.08em', textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.45)',
  marginBottom: '0.4rem',
};

const errorBoxStyle = {
  background: 'rgba(239,68,68,0.1)',
  border: '1px solid rgba(239,68,68,0.3)',
  borderRadius: '0.5rem',
  padding: '0.625rem 0.75rem',
  fontSize: '0.8rem', color: '#fca5a5',
  lineHeight: 1.5,
};

/* ═══════════════════════════════════════════════════════════════════════ */
export default function ForgotPassword() {
  const [searchParams] = useSearchParams();
  const navigate        = useNavigate();

  // Three steps: 'find' | 'reset' | 'success'
  const [step, setStep]               = useState('find');
  const [transitioning, setTransitioning] = useState(false);

  // Step 1
  const [slugInput, setSlugInput]     = useState(searchParams.get('event') || '');
  const [findLoading, setFindLoading] = useState(false);
  const [findError, setFindError]     = useState('');
  const [foundEvent, setFoundEvent]   = useState(null); // { id, subdomain, title }

  // Step 2
  const [username, setUsername]       = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError]   = useState('');
  const [locked, setLocked]           = useState(false);
  const [lockMinutes, setLockMinutes] = useState(0);

  const slugRef = useRef(null);

  useEffect(() => {
    if (slugRef.current) slugRef.current.focus();
  }, []);

  /* animated step transition */
  const goToStep = (nextStep) => {
    setTransitioning(true);
    setTimeout(() => {
      setStep(nextStep);
      setTransitioning(false);
    }, 220);
  };

  /* ── Step 1: find event ─────────────────────────────────────────── */
  const handleFind = async (e) => {
    e.preventDefault();
    setFindError('');
    let slug = slugInput.trim();
    if (!slug) { setFindError('Please enter your event link or slug.'); return; }

    // Accept full URLs like https://planit.app/e/my-event or just my-event
    try {
      const url = new URL(slug.startsWith('http') ? slug : `https://x/${slug}`);
      const parts = url.pathname.replace(/^\//, '').split('/').filter(Boolean);
      // /e/slug or /event/id — take last meaningful segment
      if (parts.length >= 2 && (parts[0] === 'e' || parts[0] === 'event')) slug = parts[1];
      else if (parts.length === 1) slug = parts[0];
    } catch {}

    setFindLoading(true);
    try {
      const res = await eventAPI.getEventBySlug(slug);
      setFoundEvent(res.data.event);
      goToStep('reset');
    } catch (err) {
      setFindError(err?.response?.data?.error || 'Event not found. Check the link and try again.');
    } finally {
      setFindLoading(false);
    }
  };

  /* ── Step 2: reset password ─────────────────────────────────────── */
  const handleReset = async (e) => {
    e.preventDefault();
    setResetError('');

    if (!username.trim()) { setResetError('Please enter your display name or username.'); return; }
    if (!recoveryCode.trim()) { setResetError('Please enter your recovery code.'); return; }
    if (!newPassword) { setResetError('Please enter a new password.'); return; }
    if (newPassword.length < 4) { setResetError('Password must be at least 4 characters.'); return; }
    if (newPassword !== confirmPassword) { setResetError('Passwords do not match.'); return; }

    setResetLoading(true);
    try {
      await eventAPI.resetPassword({
        slug: foundEvent.subdomain,
        username: username.trim(),
        recoveryCode: recoveryCode.trim(),
        newPassword,
      });
      goToStep('success');
    } catch (err) {
      const data = err?.response?.data;
      if (data?.locked) {
        setLocked(true);
        setLockMinutes(data.minutesLeft || 60);
        setResetError(data.error || 'Too many attempts. Please try again later.');
      } else {
        setResetError(data?.error || 'Reset failed. Please check your details and try again.');
      }
    } finally {
      setResetLoading(false);
    }
  };

  /* ── Shared container / card ────────────────────────────────────── */
  const cardStyle = {
    opacity: transitioning ? 0 : 1,
    transform: transitioning ? 'translateY(10px)' : 'translateY(0)',
    transition: 'opacity 0.22s ease, transform 0.22s ease',
  };

  /* ════════════════════════════════════════════════════════════════ */
  return (
    <div style={{
      minHeight: '100vh',
      background: '#05050f',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '2rem 1rem',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#fff',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Subtle grid background */}
      <svg style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }} aria-hidden="true">
        <defs>
          <pattern id="fp-grid" width="64" height="64" patternUnits="userSpaceOnUse">
            <path d="M 64 0 L 0 0 0 64" fill="none" stroke="rgba(255,255,255,0.025)" strokeWidth="1"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#fp-grid)"/>
      </svg>

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '440px' }}>

        {/* Logo + back link */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '48px', height: '48px', borderRadius: '12px',
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1rem',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.18)', marginBottom: '0.25rem' }}>
            PlanIt
          </div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 0.25rem', letterSpacing: '-0.02em' }}>
            Reset account password
          </h1>
          <p style={{ fontSize: '0.8125rem', color: 'rgba(255,255,255,0.4)', margin: 0 }}>
            Use your recovery code to set a new password
          </p>
        </div>

        {/* Step indicator */}
        <div style={{ display: 'flex', gap: '0.375rem', justifyContent: 'center', marginBottom: '1.75rem' }}>
          {['find', 'reset', 'success'].map((s, i) => (
            <div key={s} style={{
              width: step === s ? '24px' : '8px', height: '4px',
              borderRadius: '9999px',
              background: step === s ? '#f59e0b' : (
                (['find', 'reset', 'success'].indexOf(step) > i ? 'rgba(245,158,11,0.35)' : 'rgba(255,255,255,0.1)')
              ),
              transition: 'all 0.3s',
            }} />
          ))}
        </div>

        {/* ── Step 1: Find event ──────────────────────────────────── */}
        {step === 'find' && (
          <div style={cardStyle}>
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '0.875rem',
              padding: '1.5rem',
            }}>
              <h2 style={{ margin: '0 0 0.25rem', fontSize: '0.9375rem', fontWeight: 700 }}>
                Find your event
              </h2>
              <p style={{ margin: '0 0 1.25rem', fontSize: '0.8125rem', color: 'rgba(255,255,255,0.45)' }}>
                Enter your event slug or paste the full event URL.
              </p>

              <form onSubmit={handleFind}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={labelStyle}>Event link or slug</label>
                  <input
                    ref={slugRef}
                    type="text"
                    placeholder="e.g. my-team-retreat or planit.app/e/my-team-retreat"
                    value={slugInput}
                    onChange={e => { setSlugInput(e.target.value); setFindError(''); }}
                    style={inputStyle}
                    autoComplete="off"
                  />
                </div>

                {findError && <div style={{ ...errorBoxStyle, marginBottom: '1rem' }}>{findError}</div>}

                <button
                  type="submit"
                  disabled={findLoading}
                  style={{
                    width: '100%', padding: '0.75rem',
                    borderRadius: '0.5rem', border: 'none',
                    background: '#f59e0b', color: '#000',
                    fontWeight: 700, fontSize: '0.875rem',
                    cursor: findLoading ? 'not-allowed' : 'pointer',
                    opacity: findLoading ? 0.7 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                    transition: 'opacity 0.2s',
                  }}
                >
                  {findLoading && (
                    <span style={{
                      width: '14px', height: '14px',
                      border: '2px solid rgba(0,0,0,0.3)',
                      borderTopColor: '#000',
                      borderRadius: '50%',
                      animation: 'fp-spin 0.7s linear infinite',
                      display: 'inline-block',
                    }} />
                  )}
                  {findLoading ? 'Looking up...' : 'Find event'}
                </button>
              </form>
            </div>

            <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.8rem', color: 'rgba(255,255,255,0.3)' }}>
              <a href="/" style={{ color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}>Back to home</a>
            </p>
          </div>
        )}

        {/* ── Step 2: Reset password ──────────────────────────────── */}
        {step === 'reset' && foundEvent && (
          <div style={cardStyle}>
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '0.875rem',
              padding: '1.5rem',
            }}>
              {/* Event badge */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.375rem 0.625rem',
                background: 'rgba(245,158,11,0.1)',
                border: '1px solid rgba(245,158,11,0.2)',
                borderRadius: '0.375rem',
                marginBottom: '1.125rem',
              }}>
                <span style={{ fontSize: '0.7rem', color: '#fcd34d', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  Event:
                </span>
                <span style={{ fontSize: '0.8rem', color: '#fef3c7', fontWeight: 600 }}>
                  {foundEvent.title}
                </span>
              </div>

              <h2 style={{ margin: '0 0 0.25rem', fontSize: '0.9375rem', fontWeight: 700 }}>
                Enter your details
              </h2>
              <p style={{ margin: '0 0 1.25rem', fontSize: '0.8125rem', color: 'rgba(255,255,255,0.45)' }}>
                Use the name you joined the workspace with and the recovery code you were shown when you set your password.
              </p>

              <form onSubmit={handleReset}>
                {/* Username */}
                <div style={{ marginBottom: '1rem' }}>
                  <label style={labelStyle}>Your display name or username</label>
                  <input
                    type="text"
                    placeholder="Exactly as it appears in the workspace"
                    value={username}
                    onChange={e => { setUsername(e.target.value); setResetError(''); }}
                    style={inputStyle}
                    autoComplete="username"
                    autoFocus
                  />
                </div>

                {/* Recovery code explanation */}
                <div style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '0.5rem',
                  padding: '0.75rem',
                  marginBottom: '0.75rem',
                }}>
                  <p style={{ margin: '0 0 0.25rem', fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    What is a recovery code?
                  </p>
                  <p style={{ margin: 0, fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.55 }}>
                    A <span style={{ fontFamily: 'monospace', color: 'rgba(255,255,255,0.6)' }}>XXXX-XXXX-XXXX-XXXX-XXXX</span> code
                    shown to you once when you first set your account password. It was displayed in a dialog at that time.
                    If you do not have it, log back in with your current password and generate a new one from the event workspace.
                  </p>
                </div>

                {/* Recovery code */}
                <div style={{ marginBottom: '1rem' }}>
                  <label style={labelStyle}>Recovery code</label>
                  <input
                    type="text"
                    placeholder="XXXX-XXXX-XXXX-XXXX-XXXX"
                    value={recoveryCode}
                    onChange={e => { setRecoveryCode(e.target.value.toUpperCase()); setResetError(''); }}
                    style={{ ...inputStyle, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', letterSpacing: '0.08em' }}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </div>

                {/* New password */}
                <div style={{ marginBottom: '1rem' }}>
                  <label style={labelStyle}>New password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showNew ? 'text' : 'password'}
                      placeholder="Min 4 characters"
                      value={newPassword}
                      onChange={e => { setNewPassword(e.target.value); setResetError(''); }}
                      style={{ ...inputStyle, paddingRight: '2.5rem' }}
                      autoComplete="new-password"
                    />
                    <EyeToggle show={showNew} onToggle={() => setShowNew(v => !v)} />
                  </div>
                  <StrengthBar password={newPassword} />
                </div>

                {/* Confirm password */}
                <div style={{ marginBottom: '1.25rem' }}>
                  <label style={labelStyle}>Confirm new password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      placeholder="Repeat your new password"
                      value={confirmPassword}
                      onChange={e => { setConfirmPassword(e.target.value); setResetError(''); }}
                      style={{
                        ...inputStyle, paddingRight: '2.5rem',
                        borderColor: confirmPassword && newPassword !== confirmPassword
                          ? 'rgba(239,68,68,0.5)' : inputStyle.borderColor,
                      }}
                      autoComplete="new-password"
                    />
                    <EyeToggle show={showConfirm} onToggle={() => setShowConfirm(v => !v)} />
                  </div>
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p style={{ fontSize: '0.72rem', color: '#f87171', marginTop: '0.25rem' }}>
                      Passwords do not match
                    </p>
                  )}
                </div>

                {resetError && (
                  <div style={{ ...errorBoxStyle, marginBottom: '1rem' }}>
                    {resetError}
                    {locked && (
                      <p style={{ margin: '0.375rem 0 0', fontWeight: 700 }}>
                        Try again in {lockMinutes >= 60 ? `${Math.ceil(lockMinutes / 60)} hour(s)` : `${lockMinutes} minute(s)`}.
                      </p>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={resetLoading || locked}
                  style={{
                    width: '100%', padding: '0.75rem',
                    borderRadius: '0.5rem', border: 'none',
                    background: locked ? 'rgba(255,255,255,0.05)' : '#f59e0b',
                    color: locked ? 'rgba(255,255,255,0.2)' : '#000',
                    fontWeight: 700, fontSize: '0.875rem',
                    cursor: (resetLoading || locked) ? 'not-allowed' : 'pointer',
                    opacity: resetLoading ? 0.7 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                    transition: 'opacity 0.2s',
                  }}
                >
                  {resetLoading && (
                    <span style={{
                      width: '14px', height: '14px',
                      border: '2px solid rgba(0,0,0,0.3)',
                      borderTopColor: '#000',
                      borderRadius: '50%',
                      animation: 'fp-spin 0.7s linear infinite',
                      display: 'inline-block',
                    }} />
                  )}
                  {resetLoading ? 'Resetting...' : 'Reset password'}
                </button>
              </form>
            </div>

            <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.8rem' }}>
              <button
                onClick={() => goToStep('find')}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.8rem' }}
              >
                Wrong event? Go back
              </button>
            </p>
          </div>
        )}

        {/* ── Step 3: Success ─────────────────────────────────────── */}
        {step === 'success' && (
          <div style={cardStyle}>
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '0.875rem',
              padding: '2rem 1.5rem',
              textAlign: 'center',
            }}>
              {/* Green check */}
              <div style={{
                width: '52px', height: '52px',
                borderRadius: '50%',
                background: 'rgba(16,185,129,0.12)',
                border: '1px solid rgba(16,185,129,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 1.25rem',
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#6ee7b7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>

              <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.0625rem', fontWeight: 800 }}>
                Password reset successfully
              </h2>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
                Your account password has been updated. Your recovery code has been invalidated — a new one will be generated the next time you log in and trigger it.
              </p>
              {foundEvent && (
                <p style={{ margin: '0 0 1.5rem', fontSize: '0.8125rem', color: 'rgba(255,255,255,0.35)' }}>
                  Event: <strong style={{ color: 'rgba(255,255,255,0.6)' }}>{foundEvent.title}</strong>
                </p>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                {foundEvent && (
                  <a
                    href={`/e/${foundEvent.subdomain}`}
                    style={{
                      display: 'block', padding: '0.7rem',
                      borderRadius: '0.5rem', textDecoration: 'none',
                      background: '#f59e0b', color: '#000',
                      fontWeight: 700, fontSize: '0.875rem',
                      transition: 'opacity 0.2s',
                    }}
                  >
                    Go to {foundEvent.title}
                  </a>
                )}
                <a
                  href="/"
                  style={{
                    display: 'block', padding: '0.7rem',
                    borderRadius: '0.5rem', textDecoration: 'none',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: 'rgba(255,255,255,0.6)',
                    fontWeight: 600, fontSize: '0.875rem',
                  }}
                >
                  Back to home
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fp-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}