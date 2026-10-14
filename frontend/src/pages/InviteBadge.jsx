import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const ROLE_STYLES = {
  VIP:     { bg: '#fef3c7', text: '#92400e', border: '#fcd34d', label: 'VIP' },
  SPEAKER: { bg: '#ede9fe', text: '#5b21b6', border: '#a78bfa', label: 'SPEAKER' },
  GUEST:   { bg: '#f3f4f6', text: '#374151', border: '#d1d5db', label: 'GUEST' },
};

export default function InviteBadge() {
  const { inviteCode } = useParams();
  const [invite, setInvite]   = useState(null);
  const [event,  setEvent]    = useState(null);
  const [error,  setError]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!inviteCode) return;
    fetch(`${API}/events/invite/${inviteCode.toUpperCase()}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); return; }
        setInvite(data.invite || data);
        setEvent(data.event || null);
      })
      .catch(() => setError('Failed to load invite'))
      .finally(() => setLoading(false));
  }, [inviteCode]);

  const qrUrl = `${API}/events/invite/${(inviteCode || '').toUpperCase()}/qr.svg`;
  const role  = invite?.guestRole || 'GUEST';
  const style = ROLE_STYLES[role] || ROLE_STYLES.GUEST;

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui' }}>
      <p style={{ color: '#6b7280' }}>Loading…</p>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui' }}>
      <p style={{ color: '#ef4444' }}>Error: {error}</p>
    </div>
  );

  return (
    <>
      {/* ── Global styles including print ── */}
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f9fafb; font-family: system-ui, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; }

        .screen-wrapper {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 24px;
          gap: 20px;
        }

        .print-hint {
          text-align: center;
          color: #6b7280;
          font-size: 13px;
        }
        .print-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          background: #111827;
          color: #fff;
          border: none;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          margin-top: 8px;
        }
        .print-btn:hover { background: #000; }

        /* ── Badge card ── */
        .badge {
          width: 148mm;    /* A6 width */
          min-height: 105mm;
          background: #fff;
          border: 1.5px solid #e5e7eb;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 24px rgba(0,0,0,0.08);
          display: flex;
          flex-direction: column;
        }

        .badge-header {
          background: #111827;
          padding: 10px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .badge-brand {
          color: #fff;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 4px;
        }
        .badge-event-name {
          color: #9ca3af;
          font-size: 10px;
          font-weight: 600;
          max-width: 200px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          text-align: right;
        }

        .badge-body {
          flex: 1;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 0;
        }

        .badge-info {
          padding: 16px 16px 16px 16px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .badge-role-pill {
          display: inline-flex;
          align-items: center;
          padding: 3px 10px;
          border-radius: 999px;
          border: 1.5px solid;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          width: fit-content;
          margin-bottom: 8px;
        }
        .badge-guest-name {
          font-size: 26px;
          font-weight: 900;
          color: #111827;
          line-height: 1.1;
          word-break: break-word;
        }
        .badge-group-info {
          margin-top: 10px;
          font-size: 11px;
          color: #6b7280;
          font-weight: 600;
          display: flex;
          gap: 12px;
        }
        .badge-code {
          margin-top: 8px;
          font-family: 'Courier New', monospace;
          font-size: 11px;
          font-weight: 700;
          color: #9ca3af;
          letter-spacing: 2px;
        }
        .badge-table {
          margin-top: 6px;
          font-size: 11px;
          font-weight: 700;
          color: #059669;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .badge-qr {
          padding: 12px 16px 12px 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .badge-qr img {
          width: 88px;
          height: auto;
        }

        .badge-footer {
          background: #f9fafb;
          border-top: 1px solid #e5e7eb;
          padding: 7px 16px;
          font-size: 9px;
          color: #9ca3af;
          text-align: center;
          letter-spacing: 0.5px;
        }

        @media print {
          .screen-wrapper { background: #fff !important; padding: 0 !important; }
          .print-hint, .print-btn, .no-print { display: none !important; }
          body { background: #fff !important; }
          .badge {
            box-shadow: none !important;
            border-color: #000 !important;
            page-break-inside: avoid;
          }
        }
      `}</style>

      <div className="screen-wrapper">
        {/* Screen-only controls */}
        <div className="print-hint no-print">
          <p>Print on A6 paper (148 × 105 mm) or an Avery label sheet</p>
          <button className="print-btn" onClick={() => window.print()}>
            Print Badge
          </button>
        </div>

        {/* ── Badge ── */}
        <div className="badge">
          {/* Dark header bar */}
          <div className="badge-header">
            <span className="badge-brand">PLANIT</span>
            {event?.title && (
              <span className="badge-event-name">{event.title}</span>
            )}
          </div>

          {/* Main body: info + QR */}
          <div className="badge-body">
            <div className="badge-info">
              {/* Role pill */}
              <div>
                <span
                  className="badge-role-pill"
                  style={{ backgroundColor: style.bg, color: style.text, borderColor: style.border }}
                >
                  {style.label}
                </span>

                {/* Guest name — the biggest element */}
                <div className="badge-guest-name">{invite?.guestName}</div>

                {/* Group size */}
                {(invite?.adults > 1 || invite?.children > 0) && (
                  <div className="badge-group-info">
                    <span>{invite.adults} adult{invite.adults !== 1 ? 's' : ''}</span>
                    {invite.children > 0 && <span>{invite.children} child{invite.children !== 1 ? 'ren' : ''}</span>}
                  </div>
                )}

                {/* Table assignment */}
                {invite?.tableLabel && (
                  <div className="badge-table">
                    {invite.tableLabel}
                  </div>
                )}
              </div>

              <div className="badge-code">{invite?.inviteCode}</div>
            </div>

            {/* QR code */}
            <div className="badge-qr">
              <img src={qrUrl} alt="QR Code" />
            </div>
          </div>

          <div className="badge-footer">
            Scan QR code at check-in · planit
          </div>
        </div>
      </div>
    </>
  );
}
