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
};
