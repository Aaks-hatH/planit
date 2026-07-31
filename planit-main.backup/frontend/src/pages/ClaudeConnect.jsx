import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bot, Lock, Hash, CheckCircle, AlertCircle, Eye, EyeOff, Loader2, ShieldCheck, Zap, Users, MessageSquare, ArrowRight, ChevronDown } from 'lucide-react';

export default function ClaudeConnect() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');

  const [eventId, setEventId]           = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');
  const [success, setSuccess]           = useState(null);
  const [mounted, setMounted]           = useState(false);
  const [focused, setFocused]           = useState('');
  const eventIdRef                      = useRef(null);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { if (error) setError(''); }, [eventId, password]);

  const noToken = !token;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!eventId.trim() || !password) return;
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/mcp/connect/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, eventId: eventId.trim().toLowerCase(), organizerPassword: password }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccess({ eventName: data.eventName });
      } else if (res.status === 429) {
        setError('Too many attempts. Please wait a few minutes and try again.');
      } else {
        setError(data.error || 'Connection failed. Please check your details and try again.');
      }
    } catch {
      setError('Unable to reach PlanIt. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  // ─── Success screen ───────────────────────────────────────────────────────────
  if (success) {
    return (
      <div style={s.root}>
        <style>{keyframes}</style>
        <div style={{ ...s.successWrap, ...(mounted ? s.fadeIn : {}) }}>
          <div style={s.successRing}>
            <CheckCircle size={32} color="#10b981" strokeWidth={2} />
          </div>
          <h1 style={s.successTitle}>You're connected</h1>
          {success.eventName && <p style={s.successEvent}>{success.eventName}</p>}
          <p style={s.successBody}>
            Claude now has access to your event. Head back to Claude and start managing in plain English.
          </p>
          <div style={s.successPill}>
            <Bot size={13} />
            <span>You can close this tab</span>
          </div>
        </div>
      </div>
    );
  }

  // ─── Invalid token screen ─────────────────────────────────────────────────────
  if (noToken) {
    return (
      <div style={s.root}>
        <style>{keyframes}</style>
        <div style={{ ...s.successWrap, ...(mounted ? s.fadeIn : {}) }}>
          <div style={{ ...s.successRing, background: 'rgba(239,68,68,0.1)' }}>
            <AlertCircle size={32} color="#ef4444" strokeWidth={2} />
          </div>
          <h1 style={s.successTitle}>Invalid link</h1>
          <p style={s.successBody}>
            This connection link is invalid or has already been used. Return to Claude and ask for a new link.
          </p>
          <div style={{ ...s.successPill, background: 'rgba(239,68,68,0.07)', color: '#ef4444' }}>
            <MessageSquare size={13} />
            <span>Type "Connect my PlanIt event" in Claude</span>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main form ────────────────────────────────────────────────────────────────
  return (
    <div style={s.root}>
      <style>{keyframes}</style>

      <div style={{ ...s.shell, ...(mounted ? s.fadeIn : {}) }}>

        {/* ── Left hero panel ── */}
        <div style={s.hero}>
          <div style={s.heroInner}>
            <div style={s.badge}>
              <span style={s.badgeDot} />
              PlanIt connector
            </div>

            <h1 style={s.heroTitle}>
              Manage your event<br />
              <span style={s.heroAccent}>through conversation.</span>
            </h1>

            <p style={s.heroCopy}>
              Connect once, then control guest lists, announcements, check-ins, seating, and more — all in plain English inside Claude.
            </p>

            <div style={s.featureList}>
              {[
                { icon: <ShieldCheck size={15} strokeWidth={2} />, label: 'Scoped to one event only' },
                { icon: <Lock size={15} strokeWidth={2} />,       label: 'Organizer password required' },
                { icon: <Zap size={15} strokeWidth={2} />,        label: 'Expires in 10 minutes' },
              ].map(({ icon, label }) => (
                <div key={label} style={s.featureItem}>
                  <span style={s.featureIcon}>{icon}</span>
                  <span style={s.featureLabel}>{label}</span>
                </div>
              ))}
            </div>
          </div>

          <a href="#setup" style={s.heroFooterLink}>
            Setup instructions
            <ChevronDown size={13} strokeWidth={2.5} style={{ marginLeft: 4, opacity: 0.6 }} />
          </a>
        </div>

        {/* ── Right form card ── */}
        <div style={s.card}>
          {/* Card header */}
          <div style={s.cardHeader}>
            <div style={s.logoMark}>
              <Bot size={18} color="#a78bfa" strokeWidth={2} />
            </div>
            <div>
              <p style={s.cardEyebrow}>PlanIt × Claude</p>
              <h2 style={s.cardTitle}>Connect your event</h2>
            </div>
          </div>

          <p style={s.cardSubtitle}>
            Enter your Event ID and Organizer Password to authorize Claude.
          </p>

          {/* Form */}
          <div style={s.form}>
            {/* Event ID */}
            <div style={s.fieldWrap}>
              <label style={s.label} htmlFor="eventId">
                <Hash size={12} strokeWidth={2.5} />
                Event ID
              </label>
              <div style={{ ...s.inputWrap, ...(focused === 'eventId' ? s.inputFocused : {}) }}>
                <input
                  id="eventId"
                  type="text"
                  placeholder="e.g. summer-gala-2026"
                  value={eventId}
                  onChange={e => setEventId(e.target.value)}
                  onFocus={() => setFocused('eventId')}
                  onBlur={() => setFocused('')}
                  disabled={loading}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  style={s.input}
                  ref={eventIdRef}
                />
              </div>
            </div>

            {/* Password */}
            <div style={s.fieldWrap}>
              <label style={s.label} htmlFor="password">
                <Lock size={12} strokeWidth={2.5} />
                Organizer Password
              </label>
              <div style={{ ...s.inputWrap, ...(focused === 'password' ? s.inputFocused : {}) }}>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Your organizer password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onFocus={() => setFocused('password')}
                  onBlur={() => setFocused('')}
                  disabled={loading}
                  autoComplete="current-password"
                  style={{ ...s.input, paddingRight: '2.75rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  style={s.eyeBtn}
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword
                    ? <EyeOff size={15} strokeWidth={2} />
                    : <Eye size={15} strokeWidth={2} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={s.errorBox}>
                <AlertCircle size={14} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={loading || !eventId.trim() || !password}
              style={{
                ...s.submitBtn,
                ...(loading || !eventId.trim() || !password ? s.submitDisabled : {}),
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={15} strokeWidth={2} style={{ animation: 'spin 0.8s linear infinite' }} />
                  Connecting…
                </>
              ) : (
                <>
                  Connect
                  <ArrowRight size={15} strokeWidth={2.5} style={{ marginLeft: 4, transition: 'transform 0.2s' }} />
                </>
              )}
            </button>
          </div>

          <p style={s.cardFooter}>
            Link expires in 10 min · single use only
          </p>
        </div>
      </div>

      {/* ── Setup instructions ── */}
      <div id="setup" style={{ ...s.setupCard, ...(mounted ? s.fadeInDelay : {}) }}>
        <h2 style={s.setupTitle}>Setup instructions</h2>
        <div style={s.setupGrid}>
          {[
            {
              num: '1',
              title: 'Add PlanIt to Claude',
              body: (
                <>
                  Go to{' '}
                  <a href="https://claude.ai" target="_blank" rel="noopener noreferrer" style={s.link}>claude.ai</a>
                  {' '}and install the PlanIt connector, or paste{' '}
                  <span style={s.inlineCode}>https://planit-mcp.onrender.com/mcp</span>
                  {' '}into the Remote MCP server URL field.
                </>
              ),
              cta: (
                <a
                  href="https://claude.ai/customize/connectors?modal=add-custom-connector&mcpName=PlanIt&mcpServerUrl=https://planit-mcp.onrender.com/mcp"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={s.ctaLink}
                >
                  Add PlanIt to Claude <ArrowRight size={12} strokeWidth={2.5} style={{ marginLeft: 3 }} />
                </a>
              ),
            },
            {
              num: '2',
              title: 'Ask Claude for a link',
              body: 'In Claude, say:',
              code: '"Connect my PlanIt event"',
              codeNote: 'Claude generates a one-time link and sends it to you.',
            },
            {
              num: '3',
              title: 'Enter your credentials',
              body: 'Open the link, enter your Event ID and Organizer Password. Your Event ID is the slug from your event URL — e.g. summer-gala-2026.',
            },
            {
              num: '4',
              title: 'Start managing',
              body: 'Once connected, talk to Claude naturally:',
              prompts: [
                '"How many guests have checked in?"',
                '"Add Sarah Jones to the guest list"',
                '"Send a staff announcement"',
                '"Show me the seating map"',
              ],
            },
          ].map(step => (
            <div key={step.num} style={s.step}>
              <div style={s.stepNum}>{step.num}</div>
              <div style={s.stepContent}>
                <p style={s.stepTitle}>{step.title}</p>
                <p style={s.stepBody}>{step.body}</p>
                {step.cta && step.cta}
                {step.code && (
                  <>
                    <div style={s.codeBlock}>{step.code}</div>
                    <p style={{ ...s.stepBody, marginTop: 6 }}>{step.codeNote}</p>
                  </>
                )}
                {step.prompts && (
                  <div style={s.promptList}>
                    {step.prompts.map(p => (
                      <div key={p} style={s.prompt}>{p}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
        <p style={s.setupNote}>
          Tip: Your organizer password is the account password set when the event was created.
        </p>
      </div>
    </div>
  );
}

// ─── Keyframes ────────────────────────────────────────────────────────────────
const keyframes = `
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(16px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`;

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = {
  root: {
    minHeight: '100vh',
    backgroundColor: '#f8f7f5',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-start',
    padding: 'clamp(1.5rem, 4vw, 3rem) 1.25rem',
    fontFamily: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
    WebkitFontSmoothing: 'antialiased',
  },

  // Animations
  fadeIn: {
    animation: 'fadeUp 0.5s cubic-bezier(0.22,1,0.36,1) both',
  },
  fadeInDelay: {
    animation: 'fadeUp 0.5s cubic-bezier(0.22,1,0.36,1) 0.15s both',
  },

  // ── Shell / two-column layout
  shell: {
    width: '100%',
    maxWidth: 960,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
    gap: '1rem',
    alignItems: 'stretch',
  },

  // ── Hero panel
  hero: {
    background: '#0f1117',
    borderRadius: '1.25rem',
    padding: 'clamp(1.75rem, 4vw, 2.5rem)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    minHeight: 420,
    position: 'relative',
    overflow: 'hidden',
  },
  heroInner: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 999,
    padding: '5px 12px',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.55)',
    width: 'fit-content',
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#10b981',
    display: 'inline-block',
    boxShadow: '0 0 6px #10b981',
  },
  heroTitle: {
    margin: 0,
    fontSize: 'clamp(1.85rem, 4vw, 2.75rem)',
    fontWeight: 800,
    lineHeight: 1.1,
    letterSpacing: '-0.04em',
    color: '#ffffff',
  },
  heroAccent: {
    color: '#a78bfa',
  },
  heroCopy: {
    margin: 0,
    fontSize: '0.9375rem',
    lineHeight: 1.65,
    color: 'rgba(255,255,255,0.5)',
    maxWidth: '34ch',
  },
  featureList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    marginTop: 4,
  },
  featureItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  featureIcon: {
    display: 'flex',
    alignItems: 'center',
    color: 'rgba(255,255,255,0.35)',
    flexShrink: 0,
  },
  featureLabel: {
    fontSize: '0.825rem',
    color: 'rgba(255,255,255,0.45)',
    fontWeight: 450,
  },
  heroFooterLink: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: 'rgba(255,255,255,0.35)',
    textDecoration: 'none',
    marginTop: '2rem',
    transition: 'color 0.15s',
  },

  // ── Form card
  card: {
    background: '#ffffff',
    border: '1px solid rgba(0,0,0,0.07)',
    borderRadius: '1.25rem',
    padding: 'clamp(1.75rem, 4vw, 2.25rem)',
    boxShadow: '0 4px 24px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
    display: 'flex',
    flexDirection: 'column',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.875rem',
    marginBottom: '1.25rem',
  },
  logoMark: {
    width: 40,
    height: 40,
    borderRadius: '0.625rem',
    background: '#faf5ff',
    border: '1px solid rgba(167,139,250,0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  cardEyebrow: {
    margin: 0,
    fontSize: '0.6875rem',
    fontWeight: 700,
    letterSpacing: '0.09em',
    textTransform: 'uppercase',
    color: '#a78bfa',
  },
  cardTitle: {
    margin: 0,
    fontSize: '1.1875rem',
    fontWeight: 700,
    letterSpacing: '-0.02em',
    color: '#0f1117',
    lineHeight: 1.2,
  },
  cardSubtitle: {
    margin: '0 0 1.5rem 0',
    fontSize: '0.875rem',
    color: '#6b7280',
    lineHeight: 1.55,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    flex: 1,
  },

  // ── Fields
  fieldWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
  },
  label: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    fontSize: '0.75rem',
    fontWeight: 600,
    letterSpacing: '0.04em',
    color: '#374151',
    textTransform: 'uppercase',
  },
  inputWrap: {
    position: 'relative',
    border: '1.5px solid #e5e7eb',
    borderRadius: '0.625rem',
    background: '#fafafa',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  },
  inputFocused: {
    borderColor: '#a78bfa',
    boxShadow: '0 0 0 3px rgba(167,139,250,0.12)',
    background: '#ffffff',
  },
  input: {
    width: '100%',
    border: 'none',
    background: 'transparent',
    outline: 'none',
    padding: '0.6875rem 0.875rem',
    fontSize: '0.9375rem',
    color: '#0f1117',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    letterSpacing: '-0.01em',
  },
  eyeBtn: {
    position: 'absolute',
    right: '0.75rem',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 4,
    color: '#9ca3af',
    display: 'flex',
    alignItems: 'center',
    borderRadius: 4,
    transition: 'color 0.15s',
  },

  // ── Error
  errorBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    background: 'rgba(239,68,68,0.06)',
    border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: '0.5rem',
    padding: '0.625rem 0.875rem',
    fontSize: '0.8125rem',
    color: '#dc2626',
    lineHeight: 1.5,
  },

  // ── Submit button
  submitBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    background: '#0f1117',
    color: '#ffffff',
    border: 'none',
    borderRadius: '0.625rem',
    padding: '0.75rem 1.25rem',
    fontSize: '0.9375rem',
    fontWeight: 700,
    letterSpacing: '-0.01em',
    cursor: 'pointer',
    marginTop: '0.25rem',
    transition: 'background 0.15s, transform 0.1s',
    fontFamily: 'inherit',
  },
  submitDisabled: {
    background: '#d1d5db',
    color: '#9ca3af',
    cursor: 'not-allowed',
  },
  cardFooter: {
    margin: '1.25rem 0 0',
    fontSize: '0.75rem',
    color: '#9ca3af',
    textAlign: 'center',
    letterSpacing: '0.01em',
  },

  // ── Success / error screens
  successWrap: {
    background: '#ffffff',
    border: '1px solid rgba(0,0,0,0.07)',
    borderRadius: '1.25rem',
    padding: 'clamp(2rem, 5vw, 3rem)',
    maxWidth: 440,
    width: '100%',
    boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '1rem',
  },
  successRing: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    background: 'rgba(16,185,129,0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    margin: 0,
    fontSize: '1.5rem',
    fontWeight: 800,
    color: '#0f1117',
    letterSpacing: '-0.03em',
  },
  successEvent: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: 600,
    color: '#a78bfa',
  },
  successBody: {
    margin: 0,
    fontSize: '0.9rem',
    color: '#6b7280',
    lineHeight: 1.6,
    maxWidth: '32ch',
  },
  successPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: 'rgba(0,0,0,0.04)',
    borderRadius: 999,
    padding: '7px 14px',
    fontSize: '0.8125rem',
    color: '#6b7280',
    fontWeight: 500,
    marginTop: 4,
  },

  // ── Setup section
  setupCard: {
    width: '100%',
    maxWidth: 960,
    marginTop: '1.25rem',
    background: '#ffffff',
    border: '1px solid rgba(0,0,0,0.07)',
    borderRadius: '1.25rem',
    padding: 'clamp(1.5rem, 4vw, 2.25rem)',
    boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
  },
  setupTitle: {
    margin: '0 0 1.5rem',
    fontSize: '0.8rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: '#9ca3af',
  },
  setupGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
    gap: '1.25rem 2rem',
  },
  step: {
    display: 'flex',
    gap: '0.875rem',
    alignItems: 'flex-start',
  },
  stepNum: {
    flexShrink: 0,
    width: 24,
    height: 24,
    borderRadius: '50%',
    background: '#f3f4f6',
    color: '#374151',
    fontSize: '0.6875rem',
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  stepTitle: {
    margin: 0,
    fontSize: '0.875rem',
    fontWeight: 700,
    color: '#111827',
    letterSpacing: '-0.01em',
  },
  stepBody: {
    margin: 0,
    fontSize: '0.8125rem',
    color: '#6b7280',
    lineHeight: 1.6,
  },
  codeBlock: {
    background: '#f3f4f6',
    border: '1px solid #e5e7eb',
    borderRadius: '0.375rem',
    padding: '6px 10px',
    fontSize: '0.8rem',
    fontFamily: "'SF Mono', 'Fira Code', monospace",
    color: '#111827',
    marginTop: 4,
  },
  ctaLink: {
    display: 'inline-flex',
    alignItems: 'center',
    marginTop: 6,
    fontSize: '0.8125rem',
    fontWeight: 700,
    color: '#0f1117',
    background: '#f3f4f6',
    borderRadius: '0.375rem',
    padding: '5px 10px',
    textDecoration: 'none',
    transition: 'background 0.15s',
  },
  promptList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
    marginTop: 4,
  },
  prompt: {
    background: '#f8f7f5',
    border: '1px solid #e5e7eb',
    borderRadius: '0.375rem',
    padding: '5px 10px',
    fontSize: '0.75rem',
    fontFamily: "'SF Mono', 'Fira Code', monospace",
    color: '#374151',
  },
  inlineCode: {
    background: '#f3f4f6',
    border: '1px solid #e5e7eb',
    borderRadius: '0.25rem',
    padding: '1px 5px',
    fontSize: '0.8em',
    fontFamily: "'SF Mono', 'Fira Code', monospace",
    color: '#111827',
  },
  link: {
    color: '#a78bfa',
    textDecoration: 'none',
    fontWeight: 600,
  },
  setupNote: {
    margin: '1.5rem 0 0',
    paddingTop: '1rem',
    borderTop: '1px solid #f3f4f6',
    fontSize: '0.75rem',
    color: '#9ca3af',
    lineHeight: 1.6,
  },
};
