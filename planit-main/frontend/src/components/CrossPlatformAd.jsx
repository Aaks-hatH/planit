import { useState, useEffect, useCallback, useRef } from 'react';

const ADS = {
  post_event_create: {
    kicker: 'From the same team',
    headline: ['Your event is live.', 'Keep your notes', 'just as private.'],
    body: 'PrivyNotes gives you end-to-end encrypted notes that only you can read. Perfect for guest details, budgets, and anything that stays off the record.',
    cta: 'Try PrivyNotes',
  },
  casual_a: {
    kicker: 'Also built by us',
    headline: ['Your plans.', 'Your eyes only.'],
    body: 'PrivyNotes encrypts everything in your browser before it ever leaves. RSA key pairs generated locally — zero knowledge by design, not just by policy.',
    cta: 'Start writing privately',
  },
  casual_b: {
    kicker: 'You might like this',
    headline: ['What happens in', 'PrivyNotes, stays', 'in PrivyNotes.'],
    body: "No one reads your notes. Not even the server. 2048-bit RSA key pairs generated entirely in your browser — private by architecture.",
    cta: 'Get PrivyNotes',
  },
  casual_c: {
    kicker: 'Built to work together',
    headline: ['Organized events.', 'Private notes.'],
    body: 'Manage your events in PlanIT, keep sensitive planning details in PrivyNotes. Same team, two tools built to complement each other.',
    cta: 'Visit PrivyNotes',
  },
};

const CASUAL_POOL = ['casual_a', 'casual_b', 'casual_c'];
const pick = () => CASUAL_POOL[Math.floor(Math.random() * CASUAL_POOL.length)];

const FEATURES = [
  '2048-bit RSA key pairs',
  'Keys generated in your browser',
  'Zero-knowledge architecture',
  'Encrypted before it leaves your device',
  'Secure note sharing via QR',
];

/* ── CSS injection ────────────────────────────────────────────────────────── */
const RAW_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@400;500;600&display=swap');
  @keyframes _xpb_backdrop { from{opacity:0}to{opacity:1} }
  @keyframes _xpb_in {
    from{opacity:0;transform:translate(-50%,-50%) scale(.94) translateY(14px)}
    to{opacity:1;transform:translate(-50%,-50%) scale(1) translateY(0)}
  }
  @keyframes _xpb_out {
    from{opacity:1;transform:translate(-50%,-50%) scale(1)}
    to{opacity:0;transform:translate(-50%,-50%) scale(.95) translateY(8px)}
  }
  @keyframes _xpb_float {
    0%,100%{transform:rotate(2deg) translateY(0)}
    50%{transform:rotate(2deg) translateY(-5px)}
  }
  @keyframes _xpb_cursor {
    0%,100%{opacity:1}50%{opacity:0}
  }
`;
if (!document.getElementById('_xpb_planit_css')) {
  const s = document.createElement('style');
  s.id = '_xpb_planit_css';
  s.textContent = RAW_CSS;
  document.head.appendChild(s);
}

/* ── PrivyNotes Fake Mockup ───────────────────────────────────────────────── */
function PrivyNotesMockup() {
  return (
    <div style={{
      width:'100%', height:'100%', minHeight: 260,
      background:'#0C0C0F',
      borderRadius:10, overflow:'hidden', display:'flex', flexDirection:'column',
      fontFamily:"'Plus Jakarta Sans',system-ui,sans-serif", fontSize:9,
    }}>
      {/* accent line */}
      <div style={{height:2,background:'linear-gradient(90deg,#34d399,#10b981,#059669)'}}/>

      {/* header */}
      <div style={{
        padding:'7px 10px',display:'flex',alignItems:'center',
        justifyContent:'space-between',borderBottom:'1px solid #1a1a22',
      }}>
        <div style={{display:'flex',alignItems:'center',gap:5}}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2">
            <path d="M12 3L4 7v6c0 5.25 3.5 9.75 8 11 4.5-1.25 8-5.75 8-11V7L12 3z"/>
          </svg>
          <span style={{fontWeight:700,color:'#ebebf5',letterSpacing:'-0.03em',fontSize:10}}>
            Privy<span style={{color:'#34d399'}}>Notes</span>
          </span>
        </div>
        <div style={{
          display:'flex',alignItems:'center',gap:3,
          padding:'2px 5px',borderRadius:3,
          background:'rgba(52,211,153,.08)',border:'1px solid rgba(52,211,153,.18)',
          color:'#34d399',fontSize:7,fontWeight:600,
        }}>
          <svg width="6" height="6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          Encrypted
        </div>
      </div>

      {/* body: sidebar + editor */}
      <div style={{flex:1,display:'flex',overflow:'hidden'}}>
        {/* sidebar */}
        <div style={{
          width:80,borderRight:'1px solid #1a1a22',
          display:'flex',flexDirection:'column',padding:'6px 0',
          background:'#0e0e14',
        }}>
          <div style={{padding:'0 6px',marginBottom:4}}>
            <div style={{
              padding:'3px 6px',borderRadius:4,
              background:'rgba(52,211,153,.08)',border:'1px solid rgba(52,211,153,.15)',
              fontSize:8,fontWeight:600,color:'#34d399',
              display:'flex',alignItems:'center',gap:3,
            }}>
              <svg width="6" height="6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              New note
            </div>
          </div>

          {/* note list items */}
          {[
            {title:'Event budget',active:true},
            {title:'Guest list draft',active:false},
            {title:'Venue contacts',active:false},
            {title:'Catering notes',active:false},
          ].map((n,i) => (
            <div key={i} style={{
              padding:'4px 6px',margin:'0 4px',borderRadius:4,
              background:n.active?'rgba(255,255,255,.05)':'transparent',
              borderLeft:n.active?'2px solid #34d399':'2px solid transparent',
              marginBottom:1,cursor:'default',
            }}>
              <div style={{
                color:n.active?'#d4d4ec':'#404060',
                fontSize:8,fontWeight:n.active?600:400,
                overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',
              }}>{n.title}</div>
              <div style={{color:'#2e2e42',fontSize:7,marginTop:1}}>just now</div>
            </div>
          ))}
        </div>

        {/* editor */}
        <div style={{flex:1,padding:'8px 10px',display:'flex',flexDirection:'column',overflow:'hidden'}}>
          <div style={{
            color:'#e0e0f0',fontSize:11,fontWeight:700,
            letterSpacing:'-0.02em',marginBottom:6,lineHeight:1.2,
          }}>Event budget</div>

          {/* encrypted badge */}
          <div style={{
            display:'inline-flex',alignItems:'center',gap:4,
            padding:'2px 5px',borderRadius:3,
            background:'rgba(52,211,153,.06)',border:'1px solid rgba(52,211,153,.12)',
            fontSize:7,color:'#22a06b',fontWeight:600,marginBottom:8,
            alignSelf:'flex-start',
          }}>
            <svg width="6" height="6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            E2E encrypted · only you can read this
          </div>

          {/* note content lines */}
          {[
            {w:'85%',color:'#4a4a72'},
            {w:'70%',color:'#3e3e60'},
            {w:'90%',color:'#4a4a72'},
            {w:'55%',color:'#3e3e60'},
            {w:'78%',color:'#4a4a72'},
          ].map((l,i)=>(
            <div key={i} style={{
              height:7,width:l.w,background:l.color,
              borderRadius:2,marginBottom:5,opacity:.7,
            }}/>
          ))}

          {/* blinking cursor */}
          <div style={{
            display:'inline-flex',alignItems:'center',gap:2,marginTop:2,
          }}>
            <div style={{height:7,width:20,background:'#3a3a5a',borderRadius:2}}/>
            <div style={{
              width:1,height:9,background:'#34d399',
              animation:'_xpb_cursor 1.1s ease-in-out infinite',
            }}/>
          </div>
        </div>
      </div>

      {/* footer */}
      <div style={{
        padding:'4px 10px',borderTop:'1px solid #14141e',
        display:'flex',alignItems:'center',gap:4,
      }}>
        <svg width="7" height="7" viewBox="0 0 24 24" fill="none" stroke="#22a06b" strokeWidth="2">
          <path d="M12 3L4 7v6c0 5.25 3.5 9.75 8 11 4.5-1.25 8-5.75 8-11V7L12 3z"/>
        </svg>
        <span style={{fontSize:7,color:'#282840'}}>RSA-2048 · private key never leaves this device</span>
      </div>
    </div>
  );
}

/* ── Main Ad Component ────────────────────────────────────────────────────── */
export default function CrossPlatformAd({ trigger = 'casual', onClose }) {
  const [visible,  setVisible]  = useState(false);
  const [closing,  setClosing]  = useState(false);
  const [ctaHover, setCtaHover] = useState(false);
  const adKey = useRef(trigger === 'post_event_create' ? 'post_event_create' : pick()).current;
  const ad = ADS[adKey];

  useEffect(() => {
    if (localStorage.getItem('xpa_planit_hidden')) return;
    const t = setTimeout(() => setVisible(true), trigger === 'post_event_create' ? 600 : 0);
    return () => clearTimeout(t);
  }, [trigger]);

  const dismiss = useCallback((dontShow = false) => {
    if (dontShow) localStorage.setItem('xpa_planit_hidden', '1');
    setClosing(true);
    setTimeout(() => { setVisible(false); onClose?.(); }, 260);
  }, [onClose]);

  useEffect(() => {
    if (!visible) return;
    const h = (e) => e.key === 'Escape' && dismiss();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [visible, dismiss]);

  if (!visible || localStorage.getItem('xpa_planit_hidden')) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => dismiss()}
        style={{
          position:'fixed',inset:0,zIndex:9998,
          background:'rgba(5,5,15,.7)',
          backdropFilter:'blur(12px)',
          animation:'_xpb_backdrop .2s ease forwards',
        }}
      />

      {/* Card */}
      <div
        role="dialog" aria-modal="true" aria-label="Discover PrivyNotes"
        style={{
          position:'fixed',top:'50%',left:'50%',
          zIndex:9999,
          width:'min(620px,94vw)',
          background:'#ffffff',
          border:'1px solid #e8e8ed',
          borderRadius:18,
          boxShadow:'0 32px 90px rgba(0,0,0,.18),0 2px 8px rgba(0,0,0,.08)',
          overflow:'hidden',
          display:'flex',
          animation: closing ? '_xpb_out .26s ease forwards' : '_xpb_in .38s cubic-bezier(.16,1,.3,1) forwards',
          fontFamily:"'DM Sans',system-ui,sans-serif",
        }}
      >
        {/* LEFT: copy */}
        <div style={{
          width:'52%',flexShrink:0,
          padding:'26px 22px 24px 26px',
          display:'flex',flexDirection:'column',
          borderRight:'1px solid #f0f0f4',
        }}>
          {/* kicker + close */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:18}}>
            <div style={{
              display:'flex',alignItems:'center',gap:5,
              padding:'3px 8px 3px 5px',borderRadius:99,
              background:'#f0fdf8',border:'1px solid rgba(16,185,129,.2)',
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                <path d="M12 3L4 7v6c0 5.25 3.5 9.75 8 11 4.5-1.25 8-5.75 8-11V7L12 3z"/>
              </svg>
              <span style={{fontSize:9,fontWeight:600,color:'#059669',letterSpacing:'.06em',textTransform:'uppercase'}}>
                {ad.kicker}
              </span>
            </div>
            <button
              onClick={() => dismiss()} aria-label="Close"
              style={{
                width:26,height:26,borderRadius:7,
                border:'1px solid #e5e7eb',background:'#f9fafb',
                display:'flex',alignItems:'center',justifyContent:'center',
                cursor:'pointer',color:'#c0c0cc',transition:'all .13s',
              }}
              onMouseEnter={e=>{e.currentTarget.style.background='#f3f4f6';e.currentTarget.style.color='#6b7280';}}
              onMouseLeave={e=>{e.currentTarget.style.background='#f9fafb';e.currentTarget.style.color='#c0c0cc';}}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>

          {/* Headline */}
          <div style={{marginBottom:12}}>
            {ad.headline.map((line, i) => (
              <div key={i} style={{
                fontFamily:"'Instrument Serif',Georgia,serif",
                fontSize:24,fontWeight:400,lineHeight:1.18,
                color: i === ad.headline.length - 1 ? '#10b981' : '#0a0a14',
                fontStyle: i === ad.headline.length - 1 ? 'italic' : 'normal',
                letterSpacing:'-0.02em',
              }}>{line}</div>
            ))}
          </div>

          {/* Body */}
          <p style={{
            fontSize:12,color:'#6b7280',lineHeight:1.68,
            marginBottom:18,fontWeight:400,
          }}>{ad.body}</p>

          {/* Feature mini-list */}
          <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:22}}>
            {FEATURES.map(f => (
              <div key={f} style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{
                  width:13,height:13,borderRadius:4,flexShrink:0,
                  background:'#f0fdf8',border:'1px solid rgba(16,185,129,.25)',
                  display:'flex',alignItems:'center',justifyContent:'center',
                }}>
                  <svg width="6" height="6" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5"/>
                  </svg>
                </div>
                <span style={{fontSize:11,color:'#6b7280',fontWeight:500}}>{f}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <a
            href="https://privyweb.onrender.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display:'inline-flex',alignItems:'center',justifyContent:'center',gap:6,
              padding:'9px 14px',borderRadius:9,
              background: ctaHover
                ? 'linear-gradient(135deg,#059669,#047857)'
                : 'linear-gradient(135deg,#10b981,#059669)',
              color:'#fff',fontSize:12,fontWeight:600,
              textDecoration:'none',
              boxShadow: ctaHover ? '0 6px 22px rgba(16,185,129,.45)' : '0 3px 12px rgba(16,185,129,.28)',
              transform: ctaHover ? 'translateY(-1px)' : 'translateY(0)',
              transition:'all .16s ease',
              marginBottom:8,
            }}
            onMouseEnter={() => setCtaHover(true)}
            onMouseLeave={() => setCtaHover(false)}
          >
            {ad.cta}
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17 17 7M7 7h10v10"/>
            </svg>
          </a>

          <button
            onClick={() => dismiss(true)}
            style={{
              background:'none',border:'none',cursor:'pointer',
              fontSize:10,color:'#d1d5db',fontFamily:'inherit',
              letterSpacing:'.01em',transition:'color .13s',
              textAlign:'left',
            }}
            onMouseEnter={e=>{e.currentTarget.style.color='#9ca3af';}}
            onMouseLeave={e=>{e.currentTarget.style.color='#d1d5db';}}
          >
            Don't show again
          </button>
        </div>

        {/* RIGHT: mockup */}
        <div style={{
          flex:1,
          background:'linear-gradient(160deg,#f8f8fc,#f2f2f8)',
          padding:'18px 14px',
          display:'flex',flexDirection:'column',
          position:'relative',overflow:'hidden',
        }}>
          {/* subtle grid pattern */}
          <div style={{
            position:'absolute',inset:0,
            backgroundImage:'radial-gradient(circle,#c8c8dc 1px,transparent 1px)',
            backgroundSize:'18px 18px',
            opacity:.3,pointerEvents:'none',
          }}/>
          {/* ambient glow */}
          <div style={{
            position:'absolute',bottom:-30,right:-30,
            width:120,height:120,borderRadius:'50%',
            background:'rgba(16,185,129,.12)',filter:'blur(40px)',pointerEvents:'none',
          }}/>

          <div style={{
            fontSize:8,fontWeight:700,color:'#c0c0d0',
            letterSpacing:'.1em',textTransform:'uppercase',marginBottom:10,
            position:'relative',
          }}>Preview</div>

          <div style={{
            flex:1,
            animation:'_xpb_float 4.5s ease-in-out infinite',
            borderRadius:10,
            border:'1px solid rgba(0,0,0,.08)',
            boxShadow:'0 20px 60px rgba(0,0,0,.14),0 4px 16px rgba(0,0,0,.08)',
            overflow:'hidden',
            position:'relative',
          }}>
            <PrivyNotesMockup />
          </div>
        </div>
      </div>
    </>
  );
}
