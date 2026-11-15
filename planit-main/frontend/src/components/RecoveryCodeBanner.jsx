import { useState, useEffect } from 'react';
import { eventAPI } from '../services/api';
import RecoveryCodeModal from './RecoveryCodeModal';

/**
 * RecoveryCodeBanner
 *
 * Shown at the top of the event space for any authenticated user who has an
 * account password but no recovery code on file. Non-dismissible except via
 * snooze (session-only) or by actually generating a code.
 *
 * Props:
 *   eventId       — the current event ID
 *   participantId — the participant's _id string (for the sessionStorage snooze key)
 */
export default function RecoveryCodeBanner({ eventId, participantId }) {
  const [status, setStatus]           = useState(null);   // null = loading
  const [snoozed, setSnoozed]         = useState(false);
  const [generating, setGenerating]   = useState(false);
  const [recoveryCode, setRecoveryCode] = useState(null); // plain code for modal
  const [error, setError]             = useState('');

  const snoozeKey = participantId ? `snoozed_recovery_${participantId}` : null;

  useEffect(() => {
    if (!eventId) return;
    // Check snooze first (session-only)
    if (snoozeKey && sessionStorage.getItem(snoozeKey)) {
      setSnoozed(true);
      return;
    }
    eventAPI.getRecoveryCodeStatus(eventId)
      .then(res => setStatus(res.data))
      .catch(() => setStatus({ hasPassword: false, hasRecoveryCode: false }));
  }, [eventId, snoozeKey]);

  // Don't render until we know the status
  if (status === null || snoozed) return null;
  // Only show if user has a password but no recovery code
  if (!status.hasPassword || status.hasRecoveryCode) return null;

  const handleSnooze = () => {
    if (snoozeKey) sessionStorage.setItem(snoozeKey, '1');
    setSnoozed(true);
  };

  const handleGenerate = async () => {
    setError('');
    setGenerating(true);
    try {
      const res = await eventAPI.generateRecoveryCode(eventId);
      setRecoveryCode(res.data.recoveryCode);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to generate recovery code. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleModalDismiss = () => {
    setRecoveryCode(null);
    // Clear the snooze key and mark as having a code so banner disappears permanently
    if (snoozeKey) sessionStorage.removeItem(snoozeKey);
    setStatus(prev => ({ ...prev, hasRecoveryCode: true }));
  };

  return (
    <>
      {recoveryCode && (
        <RecoveryCodeModal
          code={recoveryCode}
          onDismiss={handleModalDismiss}
          eventSlug={null}
        />
      )}

      <div style={{
        width: '100%',
        background: 'rgba(245,158,11,0.09)',
        borderBottom: '1px solid rgba(245,158,11,0.25)',
        padding: '0.6rem 1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        flexWrap: 'wrap',
      }}>
        {/* Amber dot */}
        <span style={{
          width: '7px', height: '7px', borderRadius: '50%',
          background: '#f59e0b', flexShrink: 0,
          boxShadow: '0 0 6px #f59e0b',
        }} />

        <p style={{
          flex: 1, minWidth: 0,
          fontSize: '0.8125rem', color: '#92400e', lineHeight: 1.5, margin: 0,
        }}>
          <strong style={{ fontWeight: 700 }}>Your account has no recovery code.</strong>{' '}
          Recovery codes let you reset your account password at{' '}
          <a href="/forgot-password" style={{ color: '#b45309', fontWeight: 600 }}>/forgot-password</a>{' '}
          without email. Your account was created before this feature existed. Without a code,
          losing your password means losing access — you cannot self-serve reset it.
        </p>

        {error && (
          <span style={{ fontSize: '0.75rem', color: '#b91c1c', fontWeight: 500 }}>{error}</span>
        )}

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={generating}
          style={{
            background: '#f59e0b',
            border: 'none',
            borderRadius: '0.375rem',
            color: '#000',
            cursor: generating ? 'not-allowed' : 'pointer',
            fontWeight: 700, fontSize: '0.75rem',
            letterSpacing: '0.03em',
            padding: '0.375rem 0.75rem',
            flexShrink: 0,
            opacity: generating ? 0.7 : 1,
            transition: 'opacity 0.2s',
          }}
        >
          {generating ? 'Generating...' : 'Generate Recovery Code'}
        </button>

        {/* Snooze link */}
        <button
          onClick={handleSnooze}
          style={{
            background: 'none', border: 'none',
            color: '#b45309', cursor: 'pointer',
            fontSize: '0.75rem', textDecoration: 'underline',
            padding: '0.25rem 0', flexShrink: 0,
          }}
        >
          Remind me later
        </button>
      </div>
    </>
  );
}
