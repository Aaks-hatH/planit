import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const ROLE_CONFIG = {
  VIP:     { label: 'VIP',     accent: '#f59e0b', accentDark: '#92400e' },
  SPEAKER: { label: 'SPEAKER', accent: '#8b5cf6', accentDark: '#4c1d95' },
  GUEST:   { label: 'GUEST',   accent: '#6b7280', accentDark: '#374151' },
};

export default function InviteCard() {
  const { inviteCode } = useParams();
  const [invite, setInvite]   = useState(null);
  const [event,  setEvent]    = useState(null);
  const [error,  setError]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied,  setCopied]  = useState(false);

  useEffect(() => {
    if (!inviteCode) return;
    fetch(`${API}/events/invite/${inviteCode.toUpperCase()}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); return; }
        setInvite(data.invite || data);
        setEvent(data.event  || null);
      })
      .catch(() => setError('Failed to load invite'))
      .finally(() => setLoading(false));
  }, [inviteCode]);

  const qrUrl  = `${API}/events/invite/${(inviteCode || '').toUpperCase()}/qr.svg`;
  const role   = invite?.guestRole || 'GUEST';
  const cfg    = ROLE_CONFIG[role] || ROLE_CONFIG.GUEST;

  const handleCopy = () => {
    if (!invite?.inviteCode) return;
    navigator.clipboard?.writeText(window.location.href).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fmtDate = (d) => {
    if (!d) return '';
    try {
      return new Date(d).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return ''; }
  };

  const fmtTime = (d) => {
    if (!d) return '';
    try {
      return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch { return ''; }
  };

  if (loading) return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)',
      fontFamily: 'system-ui', color: '#9ca3af' }}>
      Loading…
    </div>
  );

  if (error) return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)',
      fontFamily: 'system-ui', color: '#ef4444', textAlign: 'center', padding: 24 }}>
      <div>
        <div style={{ fontSize: 48, marginBottom: 12 }}>&#x2715;</div>
        <p style={{ fontSize: 16, fontWeight: 600 }}>Invite not found</p>
        <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 6 }}>{error}</p>
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { height: 100%; }
        body {
          font-family: system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif;
          background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%);
          min-height: 100dvh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }
      `}</style>

      <div style={{
        width: '100%',
        maxWidth: 400,
        background: 'linear-gradient(145deg, #18181b 0%, #0f0f14 100%)',
        borderRadius: 24,
        overflow: 'hidden',
        boxShadow: '0 32px 64px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.06)',
        userSelect: 'none',
      }}>

        {/* ── Coloured top stripe ── */}
        <div style={{ height: 4, background: `linear-gradient(90deg, ${cfg.accent}, ${cfg.accentDark})` }} />

        {/* ── Header ── */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ color: '#fff', fontSize: 13, fontWeight: 800, letterSpacing: 5 }}>PLANIT</span>
          {/* Role badge */}
          <span style={{
            display: 'inline-block',
            padding: '3px 10px',
            borderRadius: 999,
            background: 'rgba(255,255,255,0.06)',
            border: `1px solid ${cfg.accent}44`,
            color: cfg.accent,
            fontSize: 10,
            fontWeight: 800,
            letterSpacing: 2,
          }}>{cfg.label}</span>
        </div>

        {/* ── Event info ── */}
        {event && (
          <div style={{ padding: '16px 24px 0' }}>
            <p style={{ color: '#6b7280', fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>Event</p>
            <p style={{ color: '#f3f4f6', fontSize: 17, fontWeight: 800, lineHeight: 1.3 }}>{event.title}</p>
            {event.date && (
              <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
                <div>
                  <p style={{ color: '#6b7280', fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Date</p>
                  <p style={{ color: '#d1d5db', fontSize: 12, fontWeight: 600 }}>{fmtDate(event.date)}</p>
                </div>
                <div>
                  <p style={{ color: '#6b7280', fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Time</p>
                  <p style={{ color: '#d1d5db', fontSize: 12, fontWeight: 600 }}>{fmtTime(event.date)}</p>
                </div>
                {event.location && (
                  <div style={{ flex: 1 }}>
                    <p style={{ color: '#6b7280', fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Location</p>
                    <p style={{ color: '#d1d5db', fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.location}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Dashed divider (ticket tear-off look) ── */}
        <div style={{
          margin: '16px 0',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
        }}>
          <div style={{ position: 'absolute', left: -12, width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg, #0a0a0a, #1a1a2e)', zIndex: 1 }} />
          <div style={{ flex: 1, borderTop: '1.5px dashed rgba(255,255,255,0.08)' }} />
          <div style={{ position: 'absolute', right: -12, width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg, #0a0a0a, #1a1a2e)', zIndex: 1 }} />
        </div>

        {/* ── Guest info + QR ── */}
        <div style={{ padding: '0 24px 24px', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <p style={{ color: '#6b7280', fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>Guest</p>
            <p style={{ color: '#fff', fontSize: 22, fontWeight: 900, lineHeight: 1.15, wordBreak: 'break-word' }}>{invite?.guestName}</p>

            {/* Group size */}
            {(invite?.adults > 1 || invite?.children > 0) && (
              <p style={{ color: '#9ca3af', fontSize: 11, fontWeight: 600, marginTop: 6 }}>
                {invite.adults} adult{invite.adults !== 1 ? 's' : ''}
                {invite.children > 0 ? ` + ${invite.children} child${invite.children !== 1 ? 'ren' : ''}` : ''}
              </p>
            )}

            {/* Table assignment */}
            {invite?.tableLabel && (
              <div style={{
                marginTop: 10,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 8,
                background: 'rgba(16,185,129,0.12)',
                border: '1px solid rgba(16,185,129,0.25)',
              }}>
                <span style={{ fontSize: 10, color: "#34d399" }}>&#x25CF;</span>
                <span style={{ color: '#34d399', fontSize: 11, fontWeight: 700 }}>{invite.tableLabel}</span>
              </div>
            )}

            {/* Confirmation code */}
            <p style={{ marginTop: 14, color: '#4b5563', fontSize: 11, fontFamily: 'Courier New, monospace', fontWeight: 700, letterSpacing: 3 }}>
              {invite?.inviteCode}
            </p>
          </div>

          {/* QR code */}
          <div style={{
            background: '#fff',
            borderRadius: 12,
            padding: 6,
            flexShrink: 0,
            width: 100,
          }}>
            <img src={qrUrl} alt="QR Code" style={{ width: 88, height: 'auto', display: 'block' }} />
          </div>
        </div>

        {/* ── Footer ── */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <p style={{ color: '#4b5563', fontSize: 10, fontWeight: 600, letterSpacing: 0.5 }}>
            Present this at check-in
          </p>
          <button
            onClick={handleCopy}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              padding: '5px 12px',
              color: copied ? '#34d399' : '#9ca3af',
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {copied ? 'Copied' : 'Share'}
          </button>
        </div>
      </div>
    </>
  );
}
