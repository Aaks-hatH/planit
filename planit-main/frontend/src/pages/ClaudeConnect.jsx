import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bot, Lock, Hash, CheckCircle, AlertCircle, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';

export default function ClaudeConnect() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const MCP_BASE_URL = import.meta.env.VITE_MCP_BASE_URL || 'https://planit-mcp.onrender.com';

  const [eventId, setEventId]         = useState('');
  const [password, setPassword]       = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');
  const [success, setSuccess]         = useState(null); // { eventName }

  // If no token in URL, show error immediately
  const noToken = !token;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!eventId.trim() || !password) return;

    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${MCP_BASE_URL}/mcp/connect/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          eventId: eventId.trim().toLowerCase(),
          organizerPassword: password,
        }),
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

  // ─── Success screen ───────────────────────────────────────────────────────
  if (success) {
    return (
      <div style={styles.root}>
        <div style={styles.card}>
          <div style={styles.successIcon}>
            <CheckCircle size={48} color="#10b981" />
          </div>
          <h1 style={styles.successTitle}>Connected!</h1>
          <p style={styles.successEventName}>{success.eventName}</p>
          <p style={styles.successBody}>
            Claude now has access to your event. You can return to Claude and start managing your
            event through conversation.
          </p>
          <div style={styles.successHint}>
            <Bot size={16} color="#6b7280" />
            <span style={styles.successHintText}>You can close this tab.</span>
          </div>
        </div>
      </div>
    );
  }

  // ─── Invalid / missing token ──────────────────────────────────────────────
  if (noToken) {
    return (
      <div style={styles.root}>
        <div style={styles.card}>
          <div style={styles.errorIcon}>
            <AlertCircle size={40} color="#f87171" />
          </div>
          <h1 style={styles.title}>Invalid Link</h1>
          <p style={styles.subtitle}>
            This connection link is invalid or has already been used.
          </p>
          <p style={styles.body}>
            Return to Claude and ask for a new connection link by typing{' '}
            <span style={styles.code}>"Connect my PlanIt event"</span>.
          </p>
        </div>
      </div>
    );
  }

  // ─── Main form ────────────────────────────────────────────────────────────
  return (
    <div style={styles.root}>
      <div style={styles.shell}>
        <div style={styles.heroPanel}>
          <div style={styles.kicker}>PlanIt connector</div>
          <h1 style={styles.heroTitle}>Connect one event to Claude, then manage it in plain English.</h1>
          <p style={styles.heroCopy}>Use Claude to add guests, check live attendance, send announcements, review RSVPs, and work through event-day operations without digging through tabs.</p>
          <div style={styles.trustGrid}>
            <span style={styles.trustPill}><ShieldCheck size={14} /> One-event scoped</span>
            <span style={styles.trustPill}><Lock size={14} /> Organizer password required</span>
            <span style={styles.trustPill}><Bot size={14} /> MCP tools for Claude</span>
          </div>
          <a href="#instructions" style={styles.secondaryLink}>Need setup instructions?</a>
        </div>

        <div style={styles.card}>
        {/* Header */}
        <div style={styles.logoRow}>
          <div style={styles.logoBox}>
            <Bot size={22} color="#a78bfa" />
          </div>
          <span style={styles.logoText}>PlanIt × Claude</span>
        </div>

        <h1 style={styles.title}>Connect PlanIt to Claude</h1>
        <p style={styles.subtitle}>
          Enter your Event ID and Organiser Password to give Claude access to manage your event.
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} style={styles.form}>
          {/* Event ID */}
          <label style={styles.label}>
            <span style={styles.labelText}>
              <Hash size={14} style={{ marginRight: 5 }} />
              Event ID
            </span>
            <input
              type="text"
              placeholder="e.g. summer-gala-2026"
              value={eventId}
              onChange={e => setEventId(e.target.value)}
              disabled={loading}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              style={styles.input}
            />
          </label>

          {/* Organiser Password */}
          <label style={styles.label}>
            <span style={styles.labelText}>
              <Lock size={14} style={{ marginRight: 5 }} />
              Organiser Password
            </span>
            <div style={styles.passwordWrapper}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Your organiser password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                disabled={loading}
                autoComplete="current-password"
                style={{ ...styles.input, paddingRight: '2.75rem' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                style={styles.eyeBtn}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} color="#9ca3af" /> : <Eye size={16} color="#9ca3af" />}
              </button>
            </div>
          </label>

          {/* Error message */}
          {error && (
            <div style={styles.errorBox}>
              <AlertCircle size={15} color="#f87171" style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !eventId.trim() || !password}
            style={{
              ...styles.submitBtn,
              ...(loading || !eventId.trim() || !password ? styles.submitBtnDisabled : {}),
            }}
          >
            {loading ? (
              <>
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                Connecting…
              </>
            ) : (
              'Connect'
            )}
          </button>
        </form>

        {/* Footer note */}
        <p style={styles.footerNote}>
          This link expires in 10 minutes and can only be used once.
          If it has expired, ask Claude for a new link.
        </p>
        </div>
      </div>

      {/* How to get started card */}
      <div id="instructions" style={styles.howToCard}>
        <h2 style={styles.howToTitle}>Setup instructions</h2>

        <div style={styles.howToStep}>
          <span style={styles.howToNum}>1</span>
          <div>
            <p style={styles.howToStepTitle}>Add PlanIt to Claude</p>
            <p style={styles.howToStepBody}>
              Go to{' '}
              <a href="https://claude.ai" target="_blank" rel="noopener noreferrer" style={styles.link}>
                claude.ai
              </a>{' '}
              and click the{' '}
              <span style={styles.code}>Connect</span> button on the PlanIt site,
              or visit the link below to install the PlanIt tools into Claude:
            </p>
            <a
              href="https://claude.ai/customize/connectors?modal=add-custom-connector&mcpName=PlanIt&mcpServerUrl=https://planit-mcp.onrender.com/mcp"
              target="_blank"
              rel="noopener noreferrer"
              style={styles.mcpLink}
            >
              Add PlanIt to Claude →
            </a>
            <p style={{ ...styles.howToStepBody, marginTop: '0.5rem' }}>
              If that link opens an empty "Add custom connector" form instead of
              pre-filling, just paste this URL into the <strong style={{ color: '#111827' }}>Remote MCP server URL</strong>{' '}
              field: <span style={styles.code}>https://planit-mcp.onrender.com/mcp</span>
            </p>
          </div>
        </div>

        <div style={styles.howToStep}>
          <span style={styles.howToNum}>2</span>
          <div>
            <p style={styles.howToStepTitle}>Tell Claude to connect your event</p>
            <p style={styles.howToStepBody}>
              In Claude, type:
            </p>
            <span style={styles.codeBlock}>"Connect my PlanIt event"</span>
            <p style={styles.howToStepBody}>
              Claude will generate a one-time link and send it to you.
            </p>
          </div>
        </div>

        <div style={styles.howToStep}>
          <span style={styles.howToNum}>3</span>
          <div>
            <p style={styles.howToStepTitle}>Open the link and enter your details</p>
            <p style={styles.howToStepBody}>
              Click the link Claude gives you — it brings you to this page.
              Enter your <strong style={{ color: '#111827' }}>Event ID</strong> and{' '}
              <strong style={{ color: '#111827' }}>Organiser Password</strong> to authorise Claude.
            </p>
          </div>
        </div>

        <div style={styles.howToStep}>
          <span style={styles.howToNum}>4</span>
          <div>
            <p style={styles.howToStepTitle}>Start managing your event</p>
            <p style={styles.howToStepBody}>
              Once connected, go back to Claude and start talking. Try:
            </p>
            <div style={styles.examplePrompts}>
              <span style={styles.prompt}>"How many guests have checked in?"</span>
              <span style={styles.prompt}>"Add Sarah Jones to the guest list"</span>
              <span style={styles.prompt}>"Send an announcement to all staff"</span>
              <span style={styles.prompt}>"Show me the seating map"</span>
            </div>
          </div>
        </div>

        <p style={styles.howToFooter}>
          Tip: your Event ID is the slug in your event URL, for example planitapp.onrender.com/e/summer-gala-2026 uses summer-gala-2026. Your organiser password is the account password set when the event was created.
        </p>
      </div>

      {/* Spin keyframe */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// ─── Inline styles — dark aesthetic matching PlanIt ──────────────────────────
const styles = {
  root: {
    minHeight: '100vh',
    backgroundColor: '#f5f5f4',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.5rem',
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  },
  shell: {
    width: '100%',
    maxWidth: '1040px',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))',
    gap: '1rem',
    alignItems: 'stretch',
  },
  heroPanel: {
    backgroundColor: '#111827',
    color: '#fff',
    borderRadius: '1.25rem',
    padding: '2.25rem',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    boxShadow: '0 24px 60px rgba(17,24,39,0.16)',
  },
  kicker: {
    fontSize: '0.75rem',
    fontWeight: 800,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: '#d6d3d1',
    marginBottom: '1rem',
  },
  heroTitle: {
    margin: 0,
    fontSize: 'clamp(2rem, 5vw, 3.65rem)',
    lineHeight: 0.96,
    letterSpacing: '-0.06em',
    fontWeight: 900,
  },
  heroCopy: {
    color: '#d6d3d1',
    fontSize: '1rem',
    lineHeight: 1.7,
    margin: '1.25rem 0',
    maxWidth: '34rem',
  },
  trustGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
    marginBottom: '1rem',
  },
  trustPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    border: '1px solid rgba(255,255,255,0.18)',
    borderRadius: '999px',
    color: '#f5f5f4',
    padding: '0.45rem 0.7rem',
    fontSize: '0.78rem',
    fontWeight: 700,
  },
  secondaryLink: {
    color: '#fff',
    fontWeight: 800,
    textUnderlineOffset: '4px',
  },
  card: {
    backgroundColor: '#ffffff',
    border: '1px solid #d6d3d1',
    borderRadius: '1rem',
    padding: '2rem',
    width: '100%',
    maxWidth: 'none',
    boxShadow: '0 24px 60px rgba(17,24,39,0.08)',
  },
  logoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.625rem',
    marginBottom: '1.5rem',
  },
  logoBox: {
    width: 36,
    height: 36,
    borderRadius: '0.5rem',
    backgroundColor: '#f5f5f4',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#111827',
    letterSpacing: '0.02em',
  },
  title: {
    fontSize: '1.375rem',
    fontWeight: 700,
    color: '#111827',
    margin: '0 0 0.5rem 0',
    lineHeight: 1.3,
  },
  subtitle: {
    fontSize: '0.875rem',
    color: '#57534e',
    margin: '0 0 1.75rem 0',
    lineHeight: 1.6,
  },
  body: {
    fontSize: '0.9rem',
    color: '#57534e',
    lineHeight: 1.6,
    margin: '0',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.125rem',
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
  },
  labelText: {
    display: 'flex',
    alignItems: 'center',
    fontSize: '0.8125rem',
    fontWeight: 500,
    color: '#57534e',
  },
  input: {
    backgroundColor: '#f5f5f4',
    border: '1px solid #d6d3d1',
    borderRadius: '0.5rem',
    padding: '0.625rem 0.875rem',
    fontSize: '0.9375rem',
    color: '#111827',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  },
  passwordWrapper: {
    position: 'relative',
  },
  eyeBtn: {
    position: 'absolute',
    right: '0.75rem',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    display: 'flex',
    alignItems: 'center',
  },
  errorBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.5rem',
    backgroundColor: 'rgba(248,113,113,0.08)',
    border: '1px solid rgba(248,113,113,0.25)',
    borderRadius: '0.5rem',
    padding: '0.625rem 0.875rem',
    fontSize: '0.8125rem',
    color: '#fca5a5',
    lineHeight: 1.5,
  },
  submitBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    backgroundColor: '#111827',
    color: '#fff',
    border: 'none',
    borderRadius: '0.5rem',
    padding: '0.75rem 1rem',
    fontSize: '0.9375rem',
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: '0.25rem',
    transition: 'background-color 0.15s',
  },
  submitBtnDisabled: {
    backgroundColor: '#78716c',
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  footerNote: {
    fontSize: '0.75rem',
    color: '#78716c',
    marginTop: '1.25rem',
    lineHeight: 1.5,
    textAlign: 'center',
  },
  // Success screen
  successIcon: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '1rem',
  },
  successTitle: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#111827',
    textAlign: 'center',
    margin: '0 0 0.375rem 0',
  },
  successEventName: {
    fontSize: '1.0625rem',
    fontWeight: 600,
    color: '#a78bfa',
    textAlign: 'center',
    margin: '0 0 1rem 0',
  },
  successBody: {
    fontSize: '0.875rem',
    color: '#57534e',
    textAlign: 'center',
    lineHeight: 1.6,
    margin: '0 0 1.5rem 0',
  },
  successHint: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.375rem',
  },
  successHintText: {
    fontSize: '0.8125rem',
    color: '#6b7280',
  },
  // Error screen
  errorIcon: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '1rem',
  },
  code: {
    backgroundColor: '#f5f5f4',
    border: '1px solid #d6d3d1',
    borderRadius: '0.25rem',
    padding: '0.1rem 0.4rem',
    fontSize: '0.8125rem',
    fontFamily: 'monospace',
    color: '#111827',
  },
  // How to get started section
  howToCard: {
    backgroundColor: '#ffffff',
    border: '1px solid #d6d3d1',
    borderRadius: '1rem',
    padding: '2rem',
    width: '100%',
    maxWidth: '1040px',
    marginTop: '1.25rem',
    boxShadow: '0 24px 60px rgba(17,24,39,0.08)',
  },
  howToTitle: {
    fontSize: '1rem',
    fontWeight: 700,
    color: '#111827',
    margin: '0 0 1.5rem 0',
  },
  howToStep: {
    display: 'flex',
    gap: '0.875rem',
    marginBottom: '1.25rem',
    alignItems: 'flex-start',
  },
  howToNum: {
    flexShrink: 0,
    width: 24,
    height: 24,
    borderRadius: '50%',
    backgroundColor: '#f5f5f4',
    color: '#111827',
    fontSize: '0.75rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '0.125rem',
  },
  howToStepTitle: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#e2e8f0',
    margin: '0 0 0.25rem 0',
  },
  howToStepBody: {
    fontSize: '0.8125rem',
    color: '#57534e',
    margin: '0 0 0.5rem 0',
    lineHeight: 1.6,
  },
  link: {
    color: '#a78bfa',
    textDecoration: 'none',
  },
  mcpLink: {
    display: 'inline-block',
    backgroundColor: '#f5f5f4',
    color: '#111827',
    borderRadius: '0.375rem',
    padding: '0.375rem 0.75rem',
    fontSize: '0.8125rem',
    fontWeight: 600,
    textDecoration: 'none',
    marginTop: '0.25rem',
  },
  codeBlock: {
    display: 'inline-block',
    backgroundColor: '#f5f5f4',
    border: '1px solid #d6d3d1',
    borderRadius: '0.375rem',
    padding: '0.375rem 0.75rem',
    fontSize: '0.8125rem',
    fontFamily: 'monospace',
    color: '#111827',
    margin: '0.25rem 0 0.5rem 0',
  },
  examplePrompts: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
    marginTop: '0.375rem',
  },
  prompt: {
    backgroundColor: '#f5f5f4',
    border: '1px solid #d6d3d1',
    borderRadius: '0.375rem',
    padding: '0.375rem 0.75rem',
    fontSize: '0.8rem',
    fontFamily: 'monospace',
    color: '#111827',
  },
  howToFooter: {
    fontSize: '0.75rem',
    color: '#78716c',
    marginTop: '1rem',
    lineHeight: 1.5,
    borderTop: '1px solid #e7e5e4',
    paddingTop: '1rem',
  },
};
