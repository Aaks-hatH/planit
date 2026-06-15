import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bot, Lock, Hash, CheckCircle, AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';

export default function ClaudeConnect() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

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
      const res = await fetch('/mcp/connect/verify', {
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

      {/* How to get started card */}
      <div style={styles.howToCard}>
        <h2 style={styles.howToTitle}>New here? How to get started</h2>

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
              pre-filling, just paste this URL into the <strong style={{ color: '#c4b5fd' }}>Remote MCP server URL</strong>{' '}
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
              Enter your <strong style={{ color: '#c4b5fd' }}>Event ID</strong> and{' '}
              <strong style={{ color: '#c4b5fd' }}>Organiser Password</strong> to authorise Claude.
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
          Your Event ID is shown on your event dashboard. Your Organiser Password was set when you
          created the event.
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
    backgroundColor: '#0f172a',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.5rem',
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  },
  card: {
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '1rem',
    padding: '2rem',
    width: '100%',
    maxWidth: '420px',
    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
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
    backgroundColor: '#312e81',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: '0.875rem',
    fontWeight: 600,
    color: '#c4b5fd',
    letterSpacing: '0.02em',
  },
  title: {
    fontSize: '1.375rem',
    fontWeight: 700,
    color: '#f1f5f9',
    margin: '0 0 0.5rem 0',
    lineHeight: 1.3,
  },
  subtitle: {
    fontSize: '0.875rem',
    color: '#94a3b8',
    margin: '0 0 1.75rem 0',
    lineHeight: 1.6,
  },
  body: {
    fontSize: '0.9rem',
    color: '#94a3b8',
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
    color: '#94a3b8',
  },
  input: {
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '0.5rem',
    padding: '0.625rem 0.875rem',
    fontSize: '0.9375rem',
    color: '#f1f5f9',
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
    backgroundColor: '#7c3aed',
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
    backgroundColor: '#4c1d95',
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  footerNote: {
    fontSize: '0.75rem',
    color: '#475569',
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
    color: '#f1f5f9',
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
    color: '#94a3b8',
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
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '0.25rem',
    padding: '0.1rem 0.4rem',
    fontSize: '0.8125rem',
    fontFamily: 'monospace',
    color: '#c4b5fd',
  },
  // How to get started section
  howToCard: {
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '1rem',
    padding: '2rem',
    width: '100%',
    maxWidth: '420px',
    marginTop: '1.25rem',
    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
  },
  howToTitle: {
    fontSize: '1rem',
    fontWeight: 700,
    color: '#f1f5f9',
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
    backgroundColor: '#312e81',
    color: '#c4b5fd',
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
    color: '#94a3b8',
    margin: '0 0 0.5rem 0',
    lineHeight: 1.6,
  },
  link: {
    color: '#a78bfa',
    textDecoration: 'none',
  },
  mcpLink: {
    display: 'inline-block',
    backgroundColor: '#312e81',
    color: '#c4b5fd',
    borderRadius: '0.375rem',
    padding: '0.375rem 0.75rem',
    fontSize: '0.8125rem',
    fontWeight: 600,
    textDecoration: 'none',
    marginTop: '0.25rem',
  },
  codeBlock: {
    display: 'inline-block',
    backgroundColor: '#0f172a',
    border: '1px solid #334155',
    borderRadius: '0.375rem',
    padding: '0.375rem 0.75rem',
    fontSize: '0.8125rem',
    fontFamily: 'monospace',
    color: '#c4b5fd',
    margin: '0.25rem 0 0.5rem 0',
  },
  examplePrompts: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.375rem',
    marginTop: '0.375rem',
  },
  prompt: {
    backgroundColor: '#0f172a',
    border: '1px solid #1e3a5f',
    borderRadius: '0.375rem',
    padding: '0.375rem 0.75rem',
    fontSize: '0.8rem',
    fontFamily: 'monospace',
    color: '#7dd3fc',
  },
  howToFooter: {
    fontSize: '0.75rem',
    color: '#475569',
    marginTop: '1rem',
    lineHeight: 1.5,
    borderTop: '1px solid #1e293b',
    paddingTop: '1rem',
  },
};
