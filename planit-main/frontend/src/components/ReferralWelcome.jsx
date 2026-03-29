import { useState, useEffect, useCallback } from 'react';

/* ── CSS injection ─────────────────────────────────────────────────────────── */
const RAW_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400;1,500&family=Syne:wght@400;500;600;700&display=swap');

  @keyframes _rw_pl_backdrop {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes _rw_pl_in {
    from { opacity: 0; transform: translate(-50%, -50%) scale(0.96) translateY(18px); }
    to   { opacity: 1; transform: translate(-50%, -50%) scale(1)    translateY(0);    }
  }
  @keyframes _rw_pl_out {
    from { opacity: 1; transform: translate(-50%, -50%) scale(1);    }
    to   { opacity: 0; transform: translate(-50%, -50%) scale(0.97) translateY(8px); }
  }
  @keyframes _rw_pl_fade_up {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0);    }
  }
`;

if (typeof document !== 'undefined' && !document.getElementById('_rw_pl_css')) {
  const s = document.createElement('style');
  s.id = '_rw_pl_css';
  s.textContent = RAW_CSS;
  document.head.appendChild(s);
}

/* ── Component ─────────────────────────────────────────────────────────────── */
export default function ReferralWelcome() {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('from') === 'privy') {
      const t = setTimeout(() => setVisible(true), 500);
      return () => clearTimeout(t);
    }
  }, []);

  const dismiss = useCallback(() => {
    setClosing(true);
    setTimeout(() => setVisible(false), 300);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const h = (e) => e.key === 'Escape' && dismiss();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [visible, dismiss]);

  if (!visible) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={dismiss}
        style={{
          position: 'fixed', inset: 0, zIndex: 9996,
          background: 'rgba(2, 2, 10, 0.86)',
          backdropFilter: 'blur(18px) saturate(1.6)',
          WebkitBackdropFilter: 'blur(18px) saturate(1.6)',
          animation: '_rw_pl_backdrop .35s ease forwards',
        }}
      />

      {/* Card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Welcome from PrivyNotes"
        style={{
          position: 'fixed', top: '50%', left: '50%',
          zIndex: 9997,
          width: 'min(500px, 92vw)',
          background: '#07070e',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 20,
          boxShadow: '0 70px 140px rgba(0,0,0,0.95), 0 0 0 1px rgba(255,255,255,0.03)',
          overflow: 'hidden',
          fontFamily: "'Syne', system-ui, sans-serif",
          animation: closing
            ? '_rw_pl_out .3s ease forwards'
            : '_rw_pl_in .5s cubic-bezier(.16,1,.3,1) forwards',
        }}
      >
        {/* Top rule: PrivyNotes green */}
        <div style={{
          height: 1,
          background: 'linear-gradient(90deg, transparent 0%, rgba(16,185,129,0.7) 40%, rgba(16,185,129,0.4) 70%, transparent 100%)',
        }} />

        {/* Ambient glow behind card */}
        <div style={{
          position: 'absolute', top: -60, right: -60,
          width: 200, height: 200, borderRadius: '50%',
          background: 'rgba(16,185,129,0.06)',
          filter: 'blur(60px)', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -40, left: -40,
          width: 160, height: 160, borderRadius: '50%',
          background: 'rgba(99,102,241,0.07)',
          filter: 'blur(50px)', pointerEvents: 'none',
        }} />

        <div style={{ padding: '38px 42px 34px', position: 'relative' }}>

          {/* "Arriving from" badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '4px 11px 4px 8px', borderRadius: 99,
            background: 'rgba(16,185,129,0.07)',
            border: '1px solid rgba(16,185,129,0.18)',
            marginBottom: 30,
            animation: '_rw_pl_fade_up .55s .05s ease both',
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round">
              <path d="M12 3L4 7v6c0 5.25 3.5 9.75 8 11 4.5-1.25 8-5.75 8-11V7L12 3z" />
            </svg>
            <span style={{
              fontSize: 10, fontWeight: 700, color: '#10b981',
              letterSpacing: '.1em', textTransform: 'uppercase',
            }}>
              Arriving from PrivyNotes
            </span>
          </div>

          {/* Headline */}
          <div style={{ marginBottom: 26, animation: '_rw_pl_fade_up .55s .15s ease both' }}>
            <div style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: 'clamp(40px, 8vw, 54px)',
              fontWeight: 400, lineHeight: 1.08,
              letterSpacing: '-0.025em', color: '#eeeef8',
            }}>
              Welcome
            </div>
            <div style={{
              fontFamily: "'Cormorant Garamond', Georgia, serif",
              fontSize: 'clamp(40px, 8vw, 54px)',
              fontWeight: 400, lineHeight: 1.08,
              letterSpacing: '-0.025em',
              color: '#6366f1', fontStyle: 'italic',
            }}>
              to PlanIT.
            </div>
          </div>

          {/* Rule */}
          <div style={{
            height: 1, background: 'rgba(255,255,255,0.055)',
            marginBottom: 24,
            animation: '_rw_pl_fade_up .55s .22s ease both',
          }} />

          {/* Body copy */}
          <p style={{
            fontSize: 13, color: '#585880', lineHeight: 1.82,
            fontWeight: 400, margin: '0 0 26px',
            animation: '_rw_pl_fade_up .55s .28s ease both',
          }}>
            Thank you for using PrivyNotes. I built both platforms to work in tandem — your notes stay completely private in Privy, and when you are ready to bring people together, PlanIT handles everything from RSVPs to real-time check-in.
          </p>

          {/* Signature */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 13,
            paddingTop: 20, paddingBottom: 28,
            borderTop: '1px solid rgba(255,255,255,0.05)',
            animation: '_rw_pl_fade_up .55s .34s ease both',
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, rgba(99,102,241,0.22), rgba(99,102,241,0.07))',
              border: '1px solid rgba(99,102,241,0.22)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{
                fontFamily: "'Cormorant Garamond', Georgia, serif",
                fontSize: 16, fontWeight: 500, color: '#818cf8',
              }}>A</span>
            </div>
            <div>
              <div style={{
                fontSize: 12, fontWeight: 600, color: '#c4c4e4',
                letterSpacing: '-0.01em', marginBottom: 3,
              }}>
                Aakshat Hariharan
              </div>
              <div style={{
                fontSize: 10, color: '#36364e',
                letterSpacing: '.05em', textTransform: 'uppercase',
              }}>
                Founder &amp; CEO, PrivyNotes &amp; PlanIT
              </div>
            </div>
          </div>

          {/* CTA */}
          <div style={{ animation: '_rw_pl_fade_up .55s .42s ease both' }}>
            <button
              onClick={dismiss}
              style={{
                width: '100%', padding: '13px 20px', borderRadius: 11,
                background: 'linear-gradient(135deg, #4f52cc 0%, #6828d4 100%)',
                border: 'none', color: '#fff',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                fontFamily: "'Syne', system-ui, sans-serif",
                letterSpacing: '.03em',
                boxShadow: '0 4px 24px rgba(99,102,241,0.28)',
                transition: 'all .16s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)';
                e.currentTarget.style.boxShadow = '0 6px 32px rgba(99,102,241,0.45)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'linear-gradient(135deg, #4f52cc 0%, #6828d4 100%)';
                e.currentTarget.style.boxShadow = '0 4px 24px rgba(99,102,241,0.28)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              Continue to PlanIT
            </button>
          </div>

        </div>

        {/* Bottom rule: PlanIT indigo */}
        <div style={{
          height: 1,
          background: 'linear-gradient(90deg, transparent 0%, rgba(99,102,241,0.5) 50%, transparent 100%)',
        }} />
      </div>
    </>
  );
}
