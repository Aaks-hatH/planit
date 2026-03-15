import { useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState, useCallback } from 'react';

/* ─────────────────────────────────────────
   SCROLL HOOKS
───────────────────────────────────────── */
function useScrollPct() {
  const [pct, setPct] = useState(0);
  useEffect(() => {
    const h = () => {
      const d = document.documentElement;
      setPct(d.scrollHeight > d.clientHeight ? (d.scrollTop / (d.scrollHeight - d.clientHeight)) * 100 : 0);
    };
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);
  return pct;
}

function useReveal(threshold = 0.08) {
  const ref = useRef(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVis(true); o.disconnect(); } }, { threshold });
    o.observe(ref.current);
    return () => o.disconnect();
  }, []);
  return [ref, vis];
}

function Reveal({ children, from = 'bottom', delay = 0 }) {
  const [ref, vis] = useReveal();
  const transforms = { bottom: 'translateY(32px)', left: 'translateX(-28px)', right: 'translateX(28px)', fade: 'scale(0.97)' };
  return (
    <div ref={ref} style={{
      opacity: vis ? 1 : 0,
      transform: vis ? 'none' : transforms[from],
      transition: `opacity 0.7s ease ${delay}ms, transform 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
    }}>{children}</div>
  );
}

/* ─────────────────────────────────────────
   NAV SECTIONS
───────────────────────────────────────── */
const NAV = [
  { id: 'hero', label: 'Overview' },
  { id: 'part1', label: 'Platform' },
  { id: 'part2', label: 'Master Terms' },
  { id: 'part3', label: 'Frontend' },
  { id: 'part4', label: 'Backend' },
  { id: 'part5', label: 'Router' },
  { id: 'part6', label: 'Watchdog' },
  { id: 'part7', label: 'Closing' },
];

/* ─────────────────────────────────────────
   LICENSE KNOWLEDGE BASE (for AI chatbot)
───────────────────────────────────────── */
const LICENSE_CONTEXT = `
You are Lex, the PlanIt Legal Assistant — a sharp, knowledgeable assistant embedded in the PlanIt platform's license page. You help visitors understand the PlanIt Master License Agreement quickly and clearly.

Persona rules:
- You are Lex. Never say you are Claude, an AI model, or mention Anthropic.
- If asked what you are, say you're PlanIt's built-in legal assistant.
- Be confident, professional but approachable — like a knowledgeable paralegal, not a stiff robot.
- Keep answers concise and plain-language. Use bullet points where it helps.
- If someone asks something outside the license, gently redirect: "I'm here to help with the PlanIt license specifically."

Key facts about the PlanIt License:
- Author/Owner: Aakshat Hariharan (planit.userhelp@gmail.com)
- Platform: https://planitapp.onrender.com
- Version: 2.0, January 2026
- NOT open source — no MIT, Apache, GPL, BSD, or Creative Commons license applies.
- Four components: Frontend (React/Vite), Backend (Node.js/Express, 5-instance fleet), Router Service (traffic orchestration), Watchdog Service (monitoring daemon).

WHAT IS PERMITTED without permission:
- Reading source code for personal educational reference
- Using the hosted service as an end-user at planitapp.onrender.com
- Discussing the platform publicly in factual terms
- Reporting security vulnerabilities responsibly to planit.userhelp@gmail.com

WHAT IS NOT PERMITTED without explicit written permission:
- Deploying any component on any infrastructure
- Copying, cloning, or forking any component
- Distributing any component
- Creating derivative works
- Any commercial use
- Removing copyright notices or "Powered by PlanIt" attributions
- Using the PlanIt name or logo
- Reverse engineering security or cryptographic mechanisms
- Using source code in ML/AI training datasets
- Penetration testing the hosted service

Special systems:
- Cryptographic License Key System: HMAC-SHA256-based, format WL-{TIER}-{DOMAIN_HASH_8}-{EXPIRY_HEX}-{HMAC_12}. Reverse engineering this is trade secret misappropriation and potentially criminal.
- White-label system: Paying clients get additional rights via executed agreements.
- trafficGuard: Security middleware — cannot be studied for circumvention.
- Routing Intelligence (Router): Proprietary trade secret, confidentiality obligation survives termination.
- Monitoring Intelligence (Watchdog): Proprietary trade secret, confidentiality obligation survives termination.

Liability: Total liability capped at USD $100. No consequential, indirect, or punitive damages.
Governing law: Jurisdiction of the Author's residence.
Disputes: Binding arbitration, except Author can seek injunctive relief at any time.
Contact for permissions: planit.userhelp@gmail.com

White-label clients: Have separate executed agreements with additional rights.
Public repo ≠ open source: The code being publicly visible does NOT grant any rights beyond viewing.
`;

/* ─────────────────────────────────────────
   AI CHAT BOT
───────────────────────────────────────── */
function LexChat() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([
    { role: 'assistant', content: "Hi, I'm **Lex** — PlanIt's legal assistant. Ask me anything about this license agreement and I'll break it down for you." }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [dots, setDots] = useState('');
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const suggestions = [
    'Can I fork this repo?',
    'What is permitted for free?',
    'Can I use this commercially?',
    'What is the Cryptographic License System?',
    'What happens if I violate this?',
  ];

  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 400);
    return () => clearInterval(t);
  }, [loading]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open]);

  const send = useCallback(async (text) => {
    const q = (text || input).trim();
    if (!q || loading) return;
    setInput('');
    const newMsgs = [...msgs, { role: 'user', content: q }];
    setMsgs(newMsgs);
    setLoading(true);

    try {
      const apiMsgs = newMsgs
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role, content: m.content }));

      const ROUTER = (import.meta?.env?.VITE_ROUTER_URL || '').replace(/\/$/, '');
      const res = await fetch(`${ROUTER}/api/lex/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMsgs }),
      });

      const data = await res.json();
      const reply = data?.reply || "I couldn't process that. Try rephrasing your question.";
      setMsgs(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch {
      setMsgs(prev => [...prev, { role: 'assistant', content: "Something went wrong on my end. Please try again." }]);
    } finally {
      setLoading(false);
    }
  }, [input, msgs, loading]);

  function renderMsg(content) {
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/•/g, '•')
      .split('\n')
      .map((line, i) => `<span key="${i}">${line}</span>`)
      .join('<br/>');
  }

  return (
    <>
      {/* Floating trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 999,
          width: '60px', height: '60px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
          border: '2px solid rgba(212,175,55,0.4)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 32px rgba(0,0,0,0.35), 0 0 0 0 rgba(212,175,55,0.4)',
          animation: open ? 'none' : 'lexPulse 2.5s infinite',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
        title="Ask Lex — PlanIt Legal Assistant"
      >
        {open ? (
          <svg width="22" height="22" fill="none" stroke="#d4af37" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="#d4af37" opacity="0.15"/>
            <path d="M9 12h.01M12 12h.01M15 12h.01" stroke="#d4af37" strokeWidth="2.5" strokeLinecap="round"/>
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" stroke="#d4af37" strokeWidth="2" fill="none"/>
          </svg>
        )}
      </button>

      {/* Chat panel */}
      <div style={{
        position: 'fixed', bottom: '6rem', right: '2rem', zIndex: 998,
        width: '380px', height: '540px',
        background: 'rgba(10, 10, 20, 0.97)',
        backdropFilter: 'blur(24px)',
        border: '1px solid rgba(212,175,55,0.25)',
        borderRadius: '20px',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 32px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
        transform: open ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.95)',
        opacity: open ? 1 : 0,
        pointerEvents: open ? 'all' : 'none',
        transition: 'all 0.35s cubic-bezier(0.16,1,0.3,1)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '1.1rem 1.25rem', borderBottom: '1px solid rgba(212,175,55,0.15)', background: 'linear-gradient(135deg,rgba(20,20,40,0.9),rgba(10,10,25,0.9))', display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'linear-gradient(135deg,#d4af37,#f0c850)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(212,175,55,0.3)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#1a1a2e" strokeWidth="2.5" fill="#1a1a2e" opacity="0.3"/><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#1a1a2e" strokeWidth="2"/></svg>
          </div>
          <div>
            <p style={{ color: '#f0c850', fontWeight: 700, fontSize: '0.9rem', margin: 0, letterSpacing: '0.02em' }}>Lex</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }} />
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7rem', margin: 0 }}>PlanIt Legal Assistant</p>
            </div>
          </div>
          <div style={{ marginLeft: 'auto', fontSize: '0.65rem', color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>v2.0</div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {msgs.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              {m.role === 'assistant' && (
                <div style={{ width: '26px', height: '26px', borderRadius: '8px', background: 'linear-gradient(135deg,#d4af37,#f0c850)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginRight: '0.5rem', marginTop: '0.1rem' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#1a1a2e" strokeWidth="2.5"/></svg>
                </div>
              )}
              <div style={{
                maxWidth: '78%',
                padding: '0.7rem 0.95rem',
                borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '4px 14px 14px 14px',
                background: m.role === 'user'
                  ? 'linear-gradient(135deg,#1e3a5f,#2563eb)'
                  : 'rgba(255,255,255,0.07)',
                border: m.role === 'assistant' ? '1px solid rgba(255,255,255,0.08)' : 'none',
                fontSize: '0.84rem',
                color: 'rgba(255,255,255,0.9)',
                lineHeight: 1.65,
              }} dangerouslySetInnerHTML={{ __html: renderMsg(m.content) }} />
            </div>
          ))}

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ width: '26px', height: '26px', borderRadius: '8px', background: 'linear-gradient(135deg,#d4af37,#f0c850)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#1a1a2e" strokeWidth="2.5"/></svg>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px 14px 14px 14px', padding: '0.7rem 1rem', fontSize: '0.84rem', color: 'rgba(255,255,255,0.5)', minWidth: '60px' }}>
                Lex is thinking{dots}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Suggestions (only show if just started) */}
        {msgs.length === 1 && (
          <div style={{ padding: '0 1rem 0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {suggestions.map(s => (
              <button key={s} onClick={() => send(s)} style={{ all: 'unset', cursor: 'pointer', fontSize: '0.72rem', color: '#d4af37', border: '1px solid rgba(212,175,55,0.3)', borderRadius: '999px', padding: '0.3rem 0.7rem', transition: 'all 0.18s', background: 'rgba(212,175,55,0.05)', fontFamily: 'inherit' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(212,175,55,0.15)'; e.currentTarget.style.borderColor = 'rgba(212,175,55,0.6)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(212,175,55,0.05)'; e.currentTarget.style.borderColor = 'rgba(212,175,55,0.3)'; }}>
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: '0.5rem', flexShrink: 0, background: 'rgba(0,0,0,0.2)' }}>
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Ask about the license..."
            style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '0.6rem 0.9rem', color: '#fff', fontSize: '0.84rem', outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.2s' }}
            onFocus={e => e.target.style.borderColor = 'rgba(212,175,55,0.4)'}
            onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
          />
          <button onClick={() => send()} disabled={!input.trim() || loading} style={{ width: '38px', height: '38px', borderRadius: '10px', background: input.trim() && !loading ? 'linear-gradient(135deg,#d4af37,#f0c850)' : 'rgba(255,255,255,0.06)', border: 'none', cursor: input.trim() && !loading ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s', }}>
            <svg width="16" height="16" fill="none" stroke={input.trim() && !loading ? '#1a1a2e' : 'rgba(255,255,255,0.3)'} strokeWidth="2.5" viewBox="0 0 24 24"><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"/></svg>
          </button>
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────
   SECTION WRAPPER  (big number watermark)
───────────────────────────────────────── */
function Section({ id, num, children }) {
  return (
    <section id={id} style={{ position: 'relative', padding: '5rem 0', borderBottom: '1px solid rgba(212,175,55,0.12)' }}>
      {num && (
        <div style={{ position: 'absolute', top: '2rem', right: '-1rem', fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(6rem,12vw,10rem)', color: 'rgba(212,175,55,0.04)', lineHeight: 1, userSelect: 'none', pointerEvents: 'none', letterSpacing: '-0.02em', zIndex: 0 }}>
          {String(num).padStart(2, '0')}
        </div>
      )}
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </section>
  );
}

/* ─────────────────────────────────────────
   HEADING ROW — left accent line + title
───────────────────────────────────────── */
function SectionTitle({ part, title, subtitle, accent = '#d4af37' }) {
  return (
    <Reveal from="left">
      <div style={{ marginBottom: '3rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          <div style={{ width: '3px', height: '2.5rem', background: `linear-gradient(to bottom, ${accent}, transparent)`, borderRadius: '2px', flexShrink: 0 }} />
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.68rem', color: accent, letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 500 }}>Part {part}</span>
        </div>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(1.8rem,3.5vw,2.8rem)', fontWeight: 700, color: '#f0ece4', lineHeight: 1.15, margin: '0 0 0.8rem', letterSpacing: '-0.01em' }}>{title}</h2>
        {subtitle && <p style={{ fontSize: '0.9rem', color: 'rgba(240,236,228,0.5)', lineHeight: 1.75, maxWidth: '680px', margin: 0 }}>{subtitle}</p>}
      </div>
    </Reveal>
  );
}

/* ─────────────────────────────────────────
   CLAUSE ITEM
───────────────────────────────────────── */
function Clause({ code, children }) {
  const [hov, setHov] = useState(false);
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{ display: 'flex', gap: '1.25rem', padding: '0.8rem 1rem', borderRadius: '8px', background: hov ? 'rgba(212,175,55,0.04)' : 'transparent', borderLeft: hov ? '2px solid rgba(212,175,55,0.3)' : '2px solid transparent', transition: 'all 0.2s', cursor: 'default', marginLeft: '-1rem' }}>
      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.68rem', color: 'rgba(212,175,55,0.6)', flexShrink: 0, paddingTop: '0.25rem', minWidth: '3.5rem' }}>{code}</span>
      <span style={{ fontSize: '0.9rem', color: 'rgba(240,236,228,0.75)', lineHeight: 1.85 }}>{children}</span>
    </div>
  );
}

/* ─────────────────────────────────────────
   RESTRICT LIST
───────────────────────────────────────── */
function RestrictList({ items }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginTop: '1rem' }}>
      {items.map((t, i) => (
        <div key={i} style={{ display: 'flex', gap: '0.75rem', padding: '0.65rem 0.9rem', borderRadius: '8px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.1)', alignItems: 'flex-start' }}>
          <span style={{ color: '#ef4444', fontSize: '0.65rem', flexShrink: 0, marginTop: '0.3rem' }}>✕</span>
          <span style={{ fontSize: '0.82rem', color: 'rgba(240,236,228,0.65)', lineHeight: 1.65 }}>{t}</span>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────
   DEFINITION TABLE
───────────────────────────────────────── */
function DefTable({ items }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(212,175,55,0.1)', borderRadius: '14px', overflow: 'hidden', marginTop: '1rem' }}>
      {items.map(([term, def], i) => (
        <div key={term} style={{ display: 'flex', gap: 0, borderBottom: i < items.length - 1 ? '1px solid rgba(212,175,55,0.07)' : 'none' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(212,175,55,0.03)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <div style={{ width: '11rem', flexShrink: 0, padding: '1rem 1.25rem', borderRight: '1px solid rgba(212,175,55,0.07)', display: 'flex', alignItems: 'flex-start' }}>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.72rem', color: '#d4af37', fontWeight: 500, lineHeight: 1.5 }}>"{term}"</span>
          </div>
          <div style={{ flex: 1, padding: '1rem 1.25rem' }}>
            <span style={{ fontSize: '0.86rem', color: 'rgba(240,236,228,0.65)', lineHeight: 1.75 }}>{def}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────
   COMPONENT BLOCK  (A/B/C/D)
───────────────────────────────────────── */
function ComponentBlock({ letter, title, accent, description, points, proprietary }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Reveal from="bottom" delay={50}>
      <div style={{ borderRadius: '16px', border: `1px solid ${accent}22`, overflow: 'hidden', marginBottom: '1.5rem', transition: 'box-shadow 0.3s', background: 'rgba(255,255,255,0.015)' }}
        onMouseEnter={e => e.currentTarget.style.boxShadow = `0 8px 40px ${accent}18`}
        onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
        <div style={{ display: 'flex', alignItems: 'stretch' }}>
          {/* Color accent strip */}
          <div style={{ width: '4px', background: `linear-gradient(to bottom, ${accent}, ${accent}55)`, flexShrink: 0 }} />
          <div style={{ flex: 1, padding: '1.75rem 2rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '10px', background: `linear-gradient(135deg,${accent},${accent}88)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Cormorant Garamond', serif", fontSize: '1.2rem', fontWeight: 700, color: '#0a0f1e', flexShrink: 0 }}>{letter}</div>
              <div>
                <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.3rem', fontWeight: 700, color: '#f0ece4', margin: 0 }}>{title}</h3>
                <span style={{ fontSize: '0.65rem', color: accent, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 600 }}>Component {letter}</span>
              </div>
              <button onClick={() => setExpanded(x => !x)} style={{ all: 'unset', marginLeft: 'auto', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: 'rgba(240,236,228,0.4)', fontFamily: 'inherit', transition: 'color 0.2s', borderRadius: '6px', padding: '0.3rem 0.6rem', border: '1px solid rgba(255,255,255,0.06)' }}
                onMouseEnter={e => e.currentTarget.style.color = accent}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(240,236,228,0.4)'}>
                {expanded ? 'Collapse' : 'Full Details'}
                <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.3s' }}><path d="M6 9l6 6 6-6"/></svg>
              </button>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'rgba(240,236,228,0.6)', lineHeight: 1.8, margin: 0 }}>{description}</p>
          </div>
        </div>

        {/* Expandable detail */}
        <div style={{ maxHeight: expanded ? '2000px' : 0, overflow: 'hidden', transition: 'max-height 0.5s cubic-bezier(0.16,1,0.3,1)' }}>
          <div style={{ borderTop: `1px solid ${accent}15`, padding: '1.5rem 2rem 1.75rem 2rem' }}>
            <p style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: accent, marginBottom: '1rem' }}>What It Encompasses</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1.5rem' }}>
              {points.map((p, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.6rem', fontSize: '0.82rem', color: 'rgba(240,236,228,0.6)', lineHeight: 1.65, padding: '0.4rem 0', alignItems: 'flex-start' }}>
                  <span style={{ color: accent, flexShrink: 0, fontSize: '0.5rem', marginTop: '0.45rem' }}>◆</span>
                  <span>{p}</span>
                </div>
              ))}
            </div>
            <div style={{ background: `${accent}08`, border: `1px solid ${accent}18`, borderRadius: '10px', padding: '1rem 1.25rem' }}>
              <p style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: accent, marginBottom: '0.5rem' }}>Why It's Proprietary</p>
              <p style={{ fontSize: '0.84rem', color: 'rgba(240,236,228,0.6)', lineHeight: 1.75, margin: 0 }}>{proprietary}</p>
            </div>
          </div>
        </div>
      </div>
    </Reveal>
  );
}

/* ─────────────────────────────────────────
   CALLOUT
───────────────────────────────────────── */
function Callout({ variant = 'warn', children }) {
  const v = {
    warn:    { bg: 'rgba(245,158,11,0.07)', b: 'rgba(245,158,11,0.3)', l: '#f59e0b', icon: '⚠' },
    danger:  { bg: 'rgba(239,68,68,0.07)',  b: 'rgba(239,68,68,0.3)',  l: '#ef4444', icon: '!' },
    info:    { bg: 'rgba(99,102,241,0.07)', b: 'rgba(99,102,241,0.3)', l: '#6366f1', icon: 'i' },
  }[variant];
  return (
    <div style={{ background: v.bg, border: `1px solid ${v.b}`, borderLeft: `3px solid ${v.l}`, borderRadius: '10px', padding: '1rem 1.25rem', display: 'flex', gap: '0.85rem', margin: '1.5rem 0' }}>
      <span style={{ color: v.l, fontWeight: 900, fontSize: '0.7rem', flexShrink: 0, marginTop: '0.1rem' }}>{v.icon}</span>
      <div style={{ fontSize: '0.875rem', color: 'rgba(240,236,228,0.75)', lineHeight: 1.75 }}>{children}</div>
    </div>
  );
}

/* ─────────────────────────────────────────
   MINI SECTION HEAD (within a part)
───────────────────────────────────────── */
function SubHead({ code, title }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', margin: '2.5rem 0 0.85rem' }}>
      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.65rem', background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.2)', color: '#d4af37', padding: '0.2rem 0.55rem', borderRadius: '5px' }}>{code}</span>
      <h4 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.1rem', fontWeight: 700, color: '#f0ece4', margin: 0 }}>{title}</h4>
    </div>
  );
}

/* ─────────────────────────────────────────
   PERMISSION GRID
───────────────────────────────────────── */
function PermGrid() {
  const yes = ['Reading source code for personal educational reference', 'Using the Hosted Service at planitapp.onrender.com as an end-user', 'Discussing the platform publicly in factual, non-misleading terms', 'Reporting security vulnerabilities responsibly to planit.userhelp@gmail.com'];
  const no  = ['Deploying any component on any infrastructure', 'Copying, cloning, or forking any component', 'Distributing any component to any third party', 'Creating any Derivative Work from any component', 'Using any component for Commercial Use', 'Removing copyright or "Powered by PlanIt" attributions', 'Using the PlanIt name or logo without consent', 'Reverse engineering any security or cryptographic mechanism', 'Using source code in ML or AI training datasets', 'Conducting penetration testing of the Hosted Service'];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginTop: '1.5rem' }}>
      <div style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: '14px', padding: '1.5rem' }}>
        <p style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#22c55e', marginBottom: '1.1rem' }}>✓ Permitted Without Permission</p>
        {yes.map((t, i) => <div key={i} style={{ display: 'flex', gap: '0.6rem', fontSize: '0.84rem', color: 'rgba(240,236,228,0.6)', lineHeight: 1.65, marginBottom: '0.55rem' }}><span style={{ color: '#22c55e', flexShrink: 0 }}>✓</span>{t}</div>)}
      </div>
      <div style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '14px', padding: '1.5rem' }}>
        <p style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#ef4444', marginBottom: '1.1rem' }}>✕ Requires Written Permission</p>
        {no.map((t, i) => <div key={i} style={{ display: 'flex', gap: '0.6rem', fontSize: '0.84rem', color: 'rgba(240,236,228,0.6)', lineHeight: 1.65, marginBottom: '0.55rem' }}><span style={{ color: '#ef4444', flexShrink: 0 }}>✕</span>{t}</div>)}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   LIABILITY CARDS
───────────────────────────────────────── */
function LiabilityCards() {
  const items = [
    ['Warranty Disclaimer', 'Provided "AS IS" without warranty of any kind. All warranties disclaimed to the maximum extent permitted by law.'],
    ['Liability Cap', "The Author's total liability shall not exceed USD $100.00 under any circumstances."],
    ['No Consequential Damages', 'In no event shall the Author be liable for any indirect, consequential, incidental, special, or punitive damages.'],
    ['Indemnification', 'You agree to indemnify and hold harmless the Author from any claims arising from Your breach.'],
    ['Termination', 'Breach causes immediate termination. You must cease all use and permanently delete all copies.'],
    ['Injunctive Relief', 'The Author is entitled to seek injunctive relief without bond for any unauthorized use.'],
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.75rem', marginTop: '1rem' }}>
      {items.map(([t, d]) => (
        <div key={t} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(212,175,55,0.1)', borderRadius: '10px', padding: '1.1rem' }}>
          <p style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(212,175,55,0.6)', margin: '0 0 0.4rem' }}>{t}</p>
          <p style={{ fontSize: '0.82rem', color: 'rgba(240,236,228,0.55)', lineHeight: 1.65, margin: 0 }}>{d}</p>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────
   FULL COMPONENT LICENSE SECTION
───────────────────────────────────────── */
function CompLicSection({ id, partNum, partLabel, title, accent, coverage, defs, grantLines, restrictItems, specialTitle, specialClauses, closingNote, extraNotes }) {
  return (
    <Section id={id} num={partLabel}>
      <SectionTitle part={partNum} title={`${title} — License`} subtitle={coverage} accent={accent} />

      <Reveal delay={40}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem', marginBottom: '2rem' }}>
          {[['Version', 'v2.0 — January 2026'], ['Copyright', '© 2026 Aakshat Hariharan'], ['Status', 'Proprietary']].map(([k, v]) => (
            <div key={k} style={{ background: 'rgba(212,175,55,0.04)', border: `1px solid ${accent}20`, borderRadius: '10px', padding: '0.85rem 1rem' }}>
              <p style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(212,175,55,0.5)', margin: '0 0 0.25rem' }}>{k}</p>
              <p style={{ fontSize: '0.84rem', color: '#f0ece4', margin: 0, fontWeight: 500 }}>{v}</p>
            </div>
          ))}
        </div>
      </Reveal>

      <Callout variant="warn">
        <strong>IMPORTANT</strong> — Read this entire agreement before accessing, viewing, downloading, cloning, compiling, executing, or otherwise interacting with the {title} or any portion thereof. This Agreement takes effect at the earliest moment You interact with this software in any form.
      </Callout>

      <Reveal delay={60}>
        <SubHead code="§ 1" title="Definitions" />
        <DefTable items={defs} />
      </Reveal>

      <Reveal delay={80}>
        <SubHead code="§ 2" title="Grant of Limited License" />
        <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: '10px', padding: '1.25rem 1.5rem' }}>
          {grantLines.map((l, i) => <p key={i} style={{ fontSize: '0.875rem', color: 'rgba(240,236,228,0.7)', lineHeight: 1.85, margin: i < grantLines.length - 1 ? '0 0 0.65rem' : 0 }}>{l}</p>)}
        </div>
      </Reveal>

      <Reveal delay={90}>
        <SubHead code="§ 3" title="Restrictions on Use" />
        <p style={{ fontSize: '0.875rem', color: 'rgba(240,236,228,0.5)', marginBottom: '0.25rem' }}>Without prior explicit written permission from the Author, You must NOT:</p>
        <RestrictList items={restrictItems} />
      </Reveal>

      <Reveal delay={100}>
        <SubHead code="§ 4" title={specialTitle} />
        <div style={{ background: `${accent}06`, border: `1px solid ${accent}18`, borderLeft: `3px solid ${accent}`, borderRadius: '10px', padding: '0.5rem 0.75rem' }}>
          {specialClauses.map(([code, text]) => <Clause key={code} code={code}>{text}</Clause>)}
        </div>
      </Reveal>

      {extraNotes && (
        <Reveal delay={110}>
          <SubHead code="§ 5" title="Data, Privacy & Security Obligations" />
          {extraNotes.map((t, i) => <p key={i} style={{ fontSize: '0.875rem', color: 'rgba(240,236,228,0.65)', lineHeight: 1.85, marginBottom: '0.65rem' }}>{t}</p>)}
        </Reveal>
      )}

      <Reveal delay={120}>
        <SubHead code={extraNotes ? '§ 6–11' : '§ 5–11'} title="Confidentiality, Warranties, Liability, Indemnification, Termination, Enforcement & General" />
        <p style={{ fontSize: '0.875rem', color: 'rgba(240,236,228,0.6)', lineHeight: 1.85, marginBottom: '1.25rem' }}>{closingNote}</p>
        <LiabilityCards />
      </Reveal>
    </Section>
  );
}

/* ─────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────── */
export default function License() {
  const navigate = useNavigate();
  const pct = useScrollPct();
  const [activeNav, setActiveNav] = useState('hero');
  const navRef = useRef(null);

  // Active nav via scroll
  useEffect(() => {
    const handler = () => {
      const offsets = NAV.map(n => {
        const el = document.getElementById(n.id);
        if (!el) return { id: n.id, top: Infinity };
        return { id: n.id, top: Math.abs(el.getBoundingClientRect().top - 120) };
      });
      const closest = offsets.reduce((a, b) => b.top < a.top ? b : a);
      setActiveNav(closest.id);
    };
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  // Scroll active nav pill into view
  useEffect(() => {
    const el = navRef.current?.querySelector(`[data-id="${activeNav}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeNav]);

  const scrollTo = id => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div style={{ minHeight: '100vh', background: '#0a0f1e', color: '#f0ece4', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;0,900;1,400&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=DM+Mono:wght@400;500&family=Bebas+Neue&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        html{scroll-behavior:smooth;}
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-track{background:#050810;}
        ::-webkit-scrollbar-thumb{background:rgba(212,175,55,0.3);border-radius:99px;}
        ::-webkit-scrollbar-thumb:hover{background:rgba(212,175,55,0.6);}
        @keyframes lexPulse{0%,100%{box-shadow:0 8px 32px rgba(0,0,0,0.35),0 0 0 0 rgba(212,175,55,0.35);}60%{box-shadow:0 8px 32px rgba(0,0,0,0.35),0 0 0 14px rgba(212,175,55,0);}}
        @keyframes heroSlide{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:translateY(0);}}
        @keyframes lineGrow{from{transform:scaleX(0);}to{transform:scaleX(1);}}
        @media(max-width:700px){
          .restrict-grid{grid-template-columns:1fr!important;}
          .perm-grid{grid-template-columns:1fr!important;}
          .comp-grid{grid-template-columns:1fr!important;}
          .meta-bar{grid-template-columns:1fr 1fr!important;}
          .liab-grid{grid-template-columns:1fr 1fr!important;}
        }
      `}</style>

      {/* Progress bar */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '2px', zIndex: 1001, background: 'rgba(255,255,255,0.05)' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#d4af37,#f0c850,#d4af37)', backgroundSize: '200% 100%', transition: 'width 0.12s linear', boxShadow: '0 0 8px rgba(212,175,55,0.6)' }} />
      </div>

      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(10,15,30,0.95)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(212,175,55,0.1)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 2rem' }}>
          {/* Top bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '56px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button onClick={() => navigate('/')} style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: 'rgba(240,236,228,0.5)', fontFamily: 'inherit', transition: 'color 0.2s', padding: '0.35rem 0.6rem', borderRadius: '7px', border: '1px solid rgba(255,255,255,0.07)' }}
                onMouseEnter={e => e.currentTarget.style.color = '#f0ece4'}
                onMouseLeave={e => e.currentTarget.style.color = 'rgba(240,236,228,0.5)'}>
                <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
                Back
              </button>
              <div style={{ width: 1, height: '1rem', background: 'rgba(255,255,255,0.08)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '5px', background: 'linear-gradient(135deg,#d4af37,#f0c850)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#0a0f1e" strokeWidth="2.5"/></svg>
                </div>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f0ece4', letterSpacing: '0.01em' }}>PlanIt License</span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '0.7rem', color: 'rgba(240,236,228,0.3)', fontFamily: 'DM Mono, monospace' }}>v2.0 · Jan 2026</span>
              <div style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.25)', color: '#d4af37', fontSize: '0.6rem', fontWeight: 800, padding: '0.25rem 0.7rem', borderRadius: '999px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Proprietary</div>
            </div>
          </div>

          {/* Pill nav */}
          <div ref={navRef} style={{ display: 'flex', gap: '0.25rem', overflowX: 'auto', paddingBottom: '0.6rem', scrollbarWidth: 'none' }}>
            {NAV.map(({ id, label }) => {
              const active = activeNav === id;
              return (
                <button key={id} data-id={id} onClick={() => scrollTo(id)} style={{ all: 'unset', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '0.75rem', padding: '0.3rem 0.85rem', borderRadius: '999px', fontFamily: 'inherit', transition: 'all 0.2s', background: active ? 'rgba(212,175,55,0.15)' : 'transparent', color: active ? '#d4af37' : 'rgba(240,236,228,0.4)', border: `1px solid ${active ? 'rgba(212,175,55,0.35)' : 'transparent'}`, fontWeight: active ? 600 : 400 }}
                  onMouseEnter={e => !active && (e.currentTarget.style.color = 'rgba(240,236,228,0.75)')}
                  onMouseLeave={e => !active && (e.currentTarget.style.color = 'rgba(240,236,228,0.4)')}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 2rem' }}>

        {/* ═══ HERO ═══ */}
        <section id="hero" style={{ padding: '6rem 0 5rem', borderBottom: '1px solid rgba(212,175,55,0.12)', position: 'relative', overflow: 'hidden' }}>
          {/* Background decorative elements */}
          <div style={{ position: 'absolute', top: 0, right: '-5rem', width: '500px', height: '500px', background: 'radial-gradient(circle at center, rgba(212,175,55,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: '2rem', right: '2rem', fontFamily: "'Bebas Neue', sans-serif", fontSize: '18rem', color: 'rgba(212,175,55,0.025)', lineHeight: 1, userSelect: 'none', pointerEvents: 'none' }}>IP</div>

          <div style={{ position: 'relative', animation: 'heroSlide 0.8s cubic-bezier(0.16,1,0.3,1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: '999px', padding: '0.35rem 1rem' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#d4af37' }} />
                <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#d4af37' }}>Master License Agreement</span>
              </div>
              <span style={{ fontSize: '0.68rem', color: 'rgba(240,236,228,0.3)', fontFamily: 'DM Mono, monospace' }}>Consolidated IP Declaration · v2.0</span>
            </div>

            <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(3rem,7vw,6rem)', fontWeight: 900, lineHeight: 0.95, letterSpacing: '-0.02em', marginBottom: '1.75rem' }}>
              <span style={{ display: 'block', color: '#f0ece4' }}>PlanIt</span>
              <span style={{ display: 'block', background: 'linear-gradient(135deg,#d4af37 0%,#f0c850 50%,#d4af37 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Intellectual</span>
              <span style={{ display: 'block', color: 'rgba(240,236,228,0.2)' }}>Property</span>
            </h1>

            <p style={{ fontSize: '1rem', color: 'rgba(240,236,228,0.55)', lineHeight: 1.8, maxWidth: '560px', marginBottom: '2.5rem' }}>
              The single authoritative legal instrument governing all intellectual property rights in and to the PlanIt platform — a proprietary event management and white-label SaaS platform created, owned, and operated solely by Aakshat Hariharan.
            </p>

            {/* Meta strip */}
            <div className="meta-bar" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '1px', background: 'rgba(212,175,55,0.1)', borderRadius: '14px', overflow: 'hidden', border: '1px solid rgba(212,175,55,0.1)' }}>
              {[['Author', 'Aakshat Hariharan'], ['Version', '2.0 — January 2026'], ['Components', '4 (Frontend, Backend, Router, Watchdog)'], ['Contact', 'planit.userhelp@gmail.com']].map(([k, v]) => (
                <div key={k} style={{ background: '#0a0f1e', padding: '1.1rem 1.25rem' }}>
                  <p style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(212,175,55,0.5)', margin: '0 0 0.3rem' }}>{k}</p>
                  <p style={{ fontSize: '0.82rem', color: '#f0ece4', margin: 0, fontWeight: 500 }}>{v}</p>
                </div>
              ))}
            </div>
          </div>

          <Callout variant="danger">
            <strong style={{ color: '#f0ece4' }}>BY ACCESSING THE REPOSITORY CONTAINING ANY COMPONENT OF THE PLANIT PLATFORM, VIEWING ANY SOURCE CODE FILE, CLONING OR FORKING THE REPOSITORY, RUNNING ANY COMPONENT LOCALLY, OR USING THE HOSTED SERVICE AT PLANITAPP.ONRENDER.COM, YOU AGREE TO BE LEGALLY BOUND BY THIS MASTER AGREEMENT.</strong> If you do not agree, immediately cease all interaction with the PlanIt platform in any form.
          </Callout>

          <Reveal from="bottom" delay={200}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem', marginTop: '2rem' }}>
              {[['FIRST', 'Explains in plain terms what each component is, what it does, and why it is protected.'], ['SECOND', 'Sets out the overarching licensing terms that apply across all components as a unified whole.'], ['THIRD', 'Reproduces in full each individual component license agreement for completeness.']].map(([label, text]) => (
                <div key={label} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(212,175,55,0.1)', borderRadius: '12px', padding: '1.25rem' }}>
                  <div style={{ fontFamily: 'DM Mono, monospace', fontSize: '0.6rem', fontWeight: 700, color: '#d4af37', letterSpacing: '0.15em', marginBottom: '0.6rem' }}>{label}</div>
                  <p style={{ fontSize: '0.84rem', color: 'rgba(240,236,228,0.55)', lineHeight: 1.7, margin: 0 }}>{text}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </section>

        {/* ═══ PART ONE: Platform Overview ═══ */}
        <Section id="part1" num={1}>
          <SectionTitle part="One" title="The PlanIt Platform — An Overview" subtitle="The PlanIt platform is not a single application. It is a multi-service distributed system comprising four distinct software components, each separately developed, separately deployed, and separately owned by the Author. This section explains each component before the formal legal terms begin." />

          <ComponentBlock letter="A" title="The Frontend Application" accent="#3b82f6"
            description="The PlanIt Frontend Application is the client-side web application built with React and Vite, served as a single-page application at planitapp.onrender.com. It is the primary interface through which users, organizers, and white-label clients interact with the platform."
            points={['Public-facing homepage (event creation, venue mode, branch selector)', 'EventSpace real-time event management dashboard (chat, polls, files, seating, budgets, analytics)', 'Password-protected Admin Panel for platform-wide management', 'White-Label Client Portal (/dashboard) for tenant self-service', 'White-Label Theming System — dynamic CSS variable injection architecture', 'WLHome branded landing page for white-label custom domains', 'ReservePage — guest discovery, reservation, and confirmation flows', 'Additional flows: ticket pages, waitlist, organizer login, table service, check-in kiosks, QR invite flows', 'Complete proprietary Visual Design System with glassmorphism, glow orbs, micro-interactions', 'WhiteLabelContext provider — domain detection, branding resolution, cryptographic heartbeat verification']}
            proprietary="The Frontend Application's value lies not just in the code, but in the decisions: which components to build, how they interact, what the user experience flows feel like, how the white-label system works architecturally, and what the visual design language communicates. Taken as a whole, the Frontend Application constitutes both a copyrighted work and protectable trade dress."
          />

          <ComponentBlock letter="B" title="The Backend Application" accent="#8b5cf6"
            description="The server-side engine of the platform, built on Node.js and Express.js and deployed as a fleet of five identical instances named Maverick, Goose, Iceman, Slider, and Viper. It is the authoritative source of truth for all platform data and business logic."
            points={['Event Management Engine — full CRUD, RSVP, file uploads (Cloudinary), polls, Socket.IO chat', 'JWT-based auth with per-role authorization (organizer, staff, guest, admin)', 'White-Label Management API — /resolve endpoint, /heartbeat endpoint', 'Cryptographic License Key System — HMAC-SHA256, format: WL-{TIER}-{DOMAIN_HASH_8}-{EXPIRY_HEX}-{HMAC_12}', 'White-Label Client Portal API (/api/wl-portal/*) — branding, feature flags, audit logs', 'trafficGuard Security Middleware — IP rate limiting, attack mitigation, bot detection, honeypots', 'Email via Brevo (primary) + Mailjet (fallback)', 'Distributed Maintenance System with carefully engineered exemptions', 'Mongoose data models (Event, WhiteLabel, WLLead, EventParticipant, Incident, MaintenanceSchedule)', 'Socket.IO real-time layer — room broadcasting, state sync, table service, announcements']}
            proprietary="The Backend's value lies in three things: (1) the completeness and correctness of its data models; (2) the security architecture, particularly trafficGuard and the white-label license enforcement system; and (3) the Cryptographic License Key System — a novel invention enabling offline-verifiable, tamper-evident license enforcement at scale."
          />

          <ComponentBlock letter="C" title="The Router Service" accent="#059669"
            description="The intelligent HTTP traffic orchestration layer deployed at planit-router.onrender.com. It sits between the public internet and the Backend Fleet and is responsible for coordinating all traffic using a proprietary scoring algorithm."
            points={['Proprietary scoring algorithm for backend instance selection (NOT round-robin)', 'Health-aware orchestration — continuous polling, alive/dead state management', 'Boost mode system — adaptive scaling during high-traffic periods', 'Distributed maintenance coordination with carefully engineered exemptions', 'Dynamic CORS management across all white-label custom domains', 'HMAC-based Mesh Authentication for all inter-service communication', 'Short-TTL response caching for read-only endpoints', 'WebSocket proxying with sticky session behavior']}
            proprietary="The Router Service's value is entirely in its Routing Intelligence — the specific algorithm by which it selects backend instances. It also contains the Mesh Protocol, a custom security protocol designed specifically for the PlanIt platform. Both constitute trade secrets in addition to copyrighted works."
          />

          <ComponentBlock letter="D" title="The Watchdog Service" accent="#f59e0b"
            description="An autonomous infrastructure monitoring daemon that operates independently of all other platform components, ensuring continuous platform health awareness and incident response."
            points={['Continuous health polling of Router and all Backend Fleet instances', 'Incident lifecycle management: open → investigating → resolved states', 'Real-time alerts via ntfy.sh and Discord webhooks with deduplication', 'Rolling uptime percentage aggregation for the public status page', '/watchdog/status (mesh-authenticated) and /api/uptime/status (public) endpoints', 'Auto-promotion of scheduled maintenance windows at the correct time']}
            proprietary="The Watchdog's value lies in its Monitoring Intelligence — the specific configuration of polling intervals, failure thresholds, incident severity rules, alert routing logic, and uptime aggregation methodology developed through operational experience. These are not derivable from generic monitoring best practices and constitute trade secrets."
          />
        </Section>

        {/* ═══ PART TWO: Overarching Terms ═══ */}
        <Section id="part2" num={2}>
          <SectionTitle part="Two" title="Overarching Terms — Applicable to All Components" subtitle="The following terms apply to the PlanIt platform as a unified whole, in addition to the individual component license terms set out in Parts Three through Six below." />

          <Reveal><SubHead code="M-1" title="Unified Ownership Declaration" />
            <Clause code="M-1.1">The Author is the sole and exclusive owner of all intellectual property rights in and to the PlanIt platform as a whole and in each individual component thereof, including all copyrights, trade secrets, trade dress, and any other proprietary rights recognized under applicable law.</Clause>
            <Clause code="M-1.2">The PlanIt platform, considered as a whole, constitutes a collective work under copyright law in addition to the individual copyrights subsisting in each component. The Author owns the copyright in the collective work in addition to the component copyrights.</Clause>
            <Clause code="M-1.3">The architectural decisions that govern how the four components interact — the CORS scheme, the mesh authentication protocol, the white-label domain flow from frontend resolution through backend heartbeat to Router-level CORS registration, the maintenance exemption hierarchy — together constitute a proprietary system design that is itself a trade secret and copyrighted work of the Author.</Clause>
          </Reveal>

          <Reveal delay={40}><SubHead code="M-2" title="Scope of the Master Agreement" />
            <Clause code="M-2.1">This Master Agreement governs any and all access to and use of the PlanIt platform, regardless of which component or components You interact with.</Clause>
            <Clause code="M-2.2">Where a more specific individual component license agreement addresses a particular topic, that specific provision takes precedence over any general provision in this Master Agreement with respect to that specific topic.</Clause>
            <Clause code="M-2.3">Interaction with any single component of the PlanIt platform subjects You to the Master Agreement AND to the individual license agreement for that component.</Clause>
          </Reveal>

          <Reveal delay={50}><SubHead code="M-3" title="Unified Grant of Limited License" />
            <Clause code="M-3.1">Subject to Your full and continuous compliance with this Master Agreement and all applicable individual component license agreements, the Author grants You a limited, personal, non-exclusive, non-transferable, non-sublicensable, revocable license to: (a) View the source code of any component solely for personal, non-commercial educational and reference purposes; and (b) Access and use the Hosted Service as an end-user for its intended purpose of event planning and management.</Clause>
            <Clause code="M-3.2">White-label clients with executed white-label agreements hold additional rights as specified in those agreements only.</Clause>
            <Clause code="M-3.3">All rights not expressly granted are reserved by the Author.</Clause>
          </Reveal>

          <Reveal delay={60}><SubHead code="M-4" title="Unified Restrictions" />
            <p style={{ fontSize: '0.875rem', color: 'rgba(240,236,228,0.5)', marginBottom: '0.5rem' }}>Without explicit prior written permission from the Author, You must NOT:</p>
            <RestrictList items={['Deploy any component on any infrastructure;', 'Copy, clone, or reproduce any component;', 'Distribute any component to any third party;', 'Create any Derivative Work from any component;', 'Use any component for any Commercial Use;', 'Reverse engineer any security or enforcement mechanism;', 'Use any component\'s source code in any ML training dataset;', 'Remove any copyright notice or proprietary marking.']} />
          </Reveal>

          <Reveal delay={70}>
            <SubHead code="M-5" title="No Open Source" />
            <Callout variant="warn"><strong>The PlanIt platform is NOT open source software.</strong> No component is released under any open-source license, including MIT, Apache 2.0, GNU GPL, GNU LGPL, BSD, Creative Commons, or any other license that would permit copying, modification, or redistribution. The presence of this source code in a publicly accessible repository does NOT constitute an open-source release, a public domain dedication, an implied license of any kind, or consent to any use beyond viewing for educational reference. The Author has chosen to make this source code publicly visible solely to demonstrate technical capability — expressly without waiving any intellectual property right.</Callout>
          </Reveal>

          <Reveal delay={80}><SubHead code="M-6" title="Unified Disclaimers and Limitations" />
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(212,175,55,0.08)', borderRadius: '12px', padding: '0.5rem' }}>
              <Clause code="M-6.1">THE ENTIRE PLANIT PLATFORM IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED. THE AUTHOR DISCLAIMS ALL WARRANTIES TO THE MAXIMUM EXTENT PERMITTED BY LAW.</Clause>
              <Clause code="M-6.2">THE AUTHOR'S TOTAL LIABILITY UNDER THIS MASTER AGREEMENT AND ALL INDIVIDUAL COMPONENT LICENSES COMBINED SHALL NOT EXCEED USD $100.00.</Clause>
              <Clause code="M-6.3">IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY INDIRECT, CONSEQUENTIAL, INCIDENTAL, SPECIAL, OR PUNITIVE DAMAGES ARISING FROM ANY COMPONENT OF THE PLATFORM.</Clause>
            </div>
          </Reveal>

          <Reveal delay={90}><SubHead code="M-7" title="Governing Law and Dispute Resolution" />
            <Clause code="M-7.1">This Master Agreement and all individual component license agreements shall be governed by the laws of the jurisdiction in which the Author resides, without regard to conflict of law principles.</Clause>
            <Clause code="M-7.2">Any dispute that cannot be resolved by direct negotiation shall be submitted to binding arbitration under rules mutually agreed by the parties, except that the Author shall always be entitled to seek emergency injunctive relief from any court of competent jurisdiction without first submitting to arbitration.</Clause>
            <Clause code="M-7.3">Each party irrevocably waives any objection to the venue or personal jurisdiction of courts in the Author's jurisdiction for any proceeding that escapes arbitration.</Clause>
          </Reveal>

          <Reveal delay={100}><SubHead code="M-8" title="Contact and Permissions" />
            <Clause code="M-8.1">All requests for permissions beyond those granted — including commercial license inquiries, white-label partnership inquiries, academic use requests, and security vulnerability reports — must be directed to:</Clause>
            <div style={{ display: 'flex', gap: '2rem', padding: '1.25rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(212,175,55,0.1)', borderRadius: '12px', margin: '0.75rem 0.9rem', flexWrap: 'wrap' }}>
              {[['Email', 'planit.userhelp@gmail.com', 'mailto:planit.userhelp@gmail.com'], ['Web', 'https://planitapp.onrender.com', 'https://planitapp.onrender.com']].map(([k, v, href]) => (
                <div key={k}>
                  <p style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(212,175,55,0.5)', margin: '0 0 0.3rem' }}>{k}</p>
                  <a href={href} style={{ fontSize: '0.9rem', color: '#d4af37', textDecoration: 'none', fontWeight: 500 }}>{v}</a>
                </div>
              ))}
            </div>
            <Clause code="M-8.2">Permission requests must be made in writing, must identify the requestor and their intended use in detail, and will be evaluated at the Author's sole discretion. Permission is never implied, deemed, or constructively granted.</Clause>
          </Reveal>
        </Section>

        {/* ═══ COMPONENT LICENSES ═══ */}
        <CompLicSection
          id="part3" partNum="Three" partLabel={3} title="PlanIt Frontend Application" accent="#3b82f6"
          coverage="Governs all access to and use of the PlanIt client-side React application. Covers every .jsx, .tsx, .css, .html, .json, and .js file in /frontend/src/ and its subdirectories, the Vite configuration, PWA configuration, all design assets, and the complete Visual Design System."
          defs={[['"Frontend Application" or "Software"','The PlanIt client-side web application in its entirety, encompassing all React component source files, context providers, consumer hooks, service modules, API client files, UI components, design tokens, Tailwind CSS configuration, custom CSS stylesheets, animation definitions, the Vite build configuration, PWA manifest, public/ directory assets, the complete Visual Design System, the white-label theming architecture, and all documentation and code comments.'],['"Author"','Aakshat Hariharan, the sole designer, architect, developer, and intellectual property owner of the Frontend Application.'],['"You" or "Licensee"','Any individual, developer, designer, engineer, researcher, student, company, organization, or other legal or natural person that accesses, views, reads, downloads, clones, compiles, executes, deploys, or otherwise interacts with the Frontend Application.'],['"Hosted Service"','The production deployment at planitapp.onrender.com and all associated white-label custom domains.'],['"Visual Design System"','The complete proprietary visual language including dark color palette, gradient definitions, glassmorphism treatments, ambient glow patterns, typography hierarchy, micro-interaction patterns, icon usage conventions, and overall aesthetic system.'],['"Derivative Work"','Any work derived from, copying, adapting, or substantially similar to the Frontend Application in code, design, architecture, or user experience.'],['"Commercial Use"','Any use in connection with any revenue-generating activity.'],['"Deploy"','To serve, host, publish, or make operational the Frontend Application on any infrastructure.'],['"Distribute"','To share, transfer, publish, or make available the Frontend Application to any third party.']]}
          grantLines={['2.1 The Author grants You a limited, personal, non-exclusive, non-transferable, non-sublicensable, revocable license to: (a) view the source code for personal educational reference; and (b) access and use the Hosted Service as an end-user.','2.2 White-label clients with executed agreements hold additional rights per those agreements only.','2.3 All rights not expressly granted are reserved by the Author.','2.4 The Author may revoke this license at any time without notice.']}
          restrictItems={['Copy, clone, mirror, or reproduce the Frontend Application;','Deploy the Frontend Application on any infrastructure;','Distribute the Frontend Application to any third party;','Modify or create any Derivative Work;','Reverse engineer any compiled or minified portion;','Use the Visual Design System for any other product\'s design;','Use any portion for Commercial Use;','Remove any copyright notices, license notices, or attributions;','Use "PlanIt" or "Aakshat Hariharan" without written consent;','Use automated tools to extract source code or content at scale;','Use source code in ML training datasets or code generation models;','Frame or embed the Hosted Service to misrepresent its origin;','Circumvent any technical enforcement mechanism.']}
          specialTitle="Intellectual Property Ownership"
          specialClauses={[['4.1','The Frontend Application and all constituent elements are the sole and exclusive property of the Author.'],['4.2','The Visual Design System constitutes protectable trade dress and confidential trade secret information of the Author.'],['4.3','The white-label theming architecture, including the WhiteLabelContext, heartbeat verification, and CSS variable injection, constitutes a proprietary technical system and trade secret.'],['4.4','Any feedback or input You provide is assigned to the Author in full without compensation.'],['4.5','Third-party open-source dependency copyrights remain with their respective owners. The Author\'s rights extend to original creative expression in how those dependencies are assembled and used.']]}
          closingNote="You agree to treat the source code, design decisions, component architecture, and all non-public aspects as strictly confidential and not to disclose any Confidential Information to any third party without the Author's prior written consent."
        />

        <CompLicSection
          id="part4" partNum="Four" partLabel={4} title="PlanIt Backend Application" accent="#8b5cf6"
          coverage="Governs all access to and use of the PlanIt server-side Node.js/Express application. Covers every .js file in /backend/ and its subdirectories, including all route handlers, data models, middleware, service modules, configuration files, and the proprietary Cryptographic License Key System."
          defs={[['"Backend Application" or "Software"','The PlanIt server-side application in its entirety, including the main Express.js server, all route handlers (/routes/), all Mongoose data models (/models/), all middleware (/middleware/), all service modules (/services/), the Cryptographic License Key System, the white-label resolution and heartbeat enforcement system, the Socket.IO real-time layer, all configuration files, and all documentation and comments.'],['"Author"','Aakshat Hariharan, the sole architect, developer, and intellectual property owner of the Backend Application.'],['"You"','Any individual or entity interacting with the Backend Application in any way.'],['"Cryptographic License System"','The HMAC-SHA256-based license key generation and verification system, including the key format WL-{TIER}-{DOMAIN_HASH_8}-{EXPIRY_HEX}-{HMAC_12}, algorithm, domain hash function, expiry encoding scheme, and HMAC construction.'],['"Data Models"','All Mongoose schema definitions and associated business logic, constituting trade secrets of the Author.'],['"Derivative Work"','Any work derived from, reimplementing, or substantially similar to the Backend Application.'],['"Deploy"','To execute, run, or host the Backend Application on any computing infrastructure.'],['"Commercial Use"','Any use in connection with commercial activity.']]}
          grantLines={['2.1 The Author grants You a limited, personal, non-exclusive, non-transferable, non-sublicensable, revocable license to: (a) view the source code for personal educational reference; and (b) access the API Surface through the official frontend only, or as explicitly authorized in writing.','2.2 No right to Deploy, modify, distribute, or commercially exploit the Backend Application is granted.','2.3 All rights not expressly granted are reserved.']}
          restrictItems={['Deploy, execute, or host the Backend Application;','Copy, clone, or reproduce the Backend Application;','Distribute the Backend Application to any third party;','Modify or create any Derivative Work, including reimplementing the Data Models or Cryptographic License System;','Reverse engineer the Cryptographic License System;','Access the API Surface through any means other than the official frontend;','Conduct penetration testing or vulnerability assessment without written authorization;','Access, extract, or aggregate any user data;','Use source code in ML training datasets or AI code generation models;','Circumvent any security mechanism;','Use Data Models as basis for a competing platform;','Use for Commercial Use without written license.']}
          specialTitle="Cryptographic License System — Special Provisions"
          specialClauses={[['4.1','The Cryptographic License System is the Author\'s proprietary invention and most sensitive trade secret. It constitutes both a copyrighted work and a trade secret under applicable law.'],['4.2','Any attempt to reverse engineer, bypass, spoof, or circumvent the Cryptographic License System constitutes trade secret misappropriation and may result in criminal liability under applicable computer fraud and abuse statutes.'],['4.3','The WL_LICENSE_SECRET and all related cryptographic secrets are inaccessible to You under any circumstance. Any known or suspected exposure must be reported immediately to planit.userhelp@gmail.com.']]}
          extraNotes={['5.1 Unauthorized access to the Backend Application or its databases constitutes a serious privacy violation and may trigger breach notification obligations under applicable data protection law including GDPR, CCPA, and similar statutes.','5.2 Security vulnerability reports must be submitted to planit.userhelp@gmail.com without public disclosure. Unauthorized public disclosure may constitute tortious interference.','5.3 You agree to comply with all applicable export control laws and regulations.']}
          closingNote="You agree not to use knowledge gained from accessing this source code to harm the Author, the PlanIt platform, its users, or any third party."
        />

        <CompLicSection
          id="part5" partNum="Five" partLabel={5} title="PlanIt Router Service" accent="#059669"
          coverage="Governs all access to and use of the PlanIt intelligent HTTP traffic orchestration layer. Covers every source file in the /router/ directory, the entire Routing Intelligence, the Mesh Protocol implementation, and all configuration and operational tooling."
          defs={[['"Router Service" or "Software"','The PlanIt HTTP routing and orchestration layer in its entirety, including all backend selection algorithms, health-check polling logic, maintenance intercept middleware, CORS management system, mesh authentication protocol, response caching layer, rate limiting configuration, health check aggregation, deploy hook configuration, backend fleet registry, WebSocket proxying configuration, and all documentation and comments.'],['"Author"','Aakshat Hariharan, the sole architect and owner.'],['"You"','Any individual or entity interacting with the Router Service.'],['"Routing Intelligence"','The proprietary scoring algorithm, health heuristics, boost mode logic, and all decision-making code governing backend instance selection — constituting trade secrets of the Author.'],['"Mesh Protocol"','The HMAC-based inter-service authentication system used for all communication between the Router Service and the Backend Fleet.'],['"Derivative Work"','Any work derived from or reimplementing any portion of the Router Service.'],['"Deploy"','To execute or host the Router Service on any infrastructure.'],['"Commercial Use"','Any use in connection with commercial activity.']]}
          grantLines={['2.1 The Author grants You a limited, personal, non-exclusive, non-transferable, non-sublicensable, revocable license to view the source code for personal educational reference only.','2.2 No deployment, modification, distribution, or commercial exploitation right is granted.','2.3 All rights not expressly granted are reserved.']}
          restrictItems={['Deploy or host the Router Service;','Copy or reproduce the Router Service;','Distribute the Router Service to any third party;','Modify or create any Derivative Work, including reimplementing the Routing Intelligence;','Benchmark or reverse engineer the Routing Intelligence for building a competing system;','Disclose any Confidential Information to any third party;','Probe, stress-test, or conduct load testing against the Hosted Infrastructure;','Forge or bypass Mesh Protocol authentication headers;','Use source code in ML training datasets;','Remove copyright notices;','Use for Commercial Use without written license.']}
          specialTitle="Routing Intelligence as Trade Secret"
          specialClauses={[['4.1','The Routing Intelligence constitutes a proprietary system developed through substantial engineering investment. The specific combination of health-check scoring weights, backend alive-state hysteresis logic, boost mode thresholds, and maintenance exemption categorization are not publicly known and provide the Author with a competitive advantage.'],['4.2','Your obligation to maintain the confidentiality of the Routing Intelligence survives termination of this Agreement indefinitely.']]}
          closingNote="You agree not to take any action that could degrade, disrupt, or damage the Hosted Infrastructure or Backend Fleet, including DDoS attacks, traffic flooding, or manipulation of load-balancing behavior."
        />

        <CompLicSection
          id="part6" partNum="Six" partLabel={6} title="PlanIt Watchdog Service" accent="#f59e0b"
          coverage="Governs all access to and use of the PlanIt autonomous infrastructure monitoring daemon. Covers every source file in the /watchdog/ directory, the Monitoring Intelligence, alert routing logic, uptime aggregation system, and all operational data generated by the Watchdog Service."
          defs={[['"Watchdog Service" or "Software"','The PlanIt autonomous monitoring daemon in its entirety, including all health-check polling logic, incident lifecycle management, alert routing and deduplication system, uptime history aggregation, status page data API, mesh-authenticated endpoints, auto-promotion of scheduled maintenance, and all configuration, operational documentation, and comments.'],['"Author"','Aakshat Hariharan, the sole designer and owner.'],['"You"','Any individual or entity interacting with the Watchdog Service.'],['"Monitoring Intelligence"','The proprietary heuristics, thresholds, timing parameters, and decision logic governing incident detection, severity classification, alert routing, and uptime aggregation — constituting trade secrets of the Author.'],['"Operational Data"','Uptime records, incident logs, and alert histories generated during operation, owned exclusively by the Author.'],['"Derivative Work"','Any monitoring tool derived from or reimplementing the Watchdog Service.'],['"Deploy"','To execute or host the Watchdog Service on any infrastructure.'],['"Commercial Use"','Any use in connection with commercial activity.']]}
          grantLines={['2.1 The Author grants You a limited, personal, non-exclusive, non-transferable, non-sublicensable, revocable license to view the source code for personal educational reference only.','2.2 No deployment, modification, distribution, or commercial exploitation right is granted.','2.3 All rights not expressly granted are reserved.']}
          restrictItems={['Deploy or operate the Watchdog Service;','Copy or reproduce the Watchdog Service;','Distribute the Watchdog Service;','Modify or create any Derivative Work, including adapting the Monitoring Intelligence;','Disclose Monitoring Intelligence to any third party;','Access status API endpoints except through the official status page;','Interfere with, disable, or circumvent the Watchdog Service;','Generate false health signals or corrupt monitoring data;','Use source code in ML training datasets;','Remove copyright notices;','Access, export, or aggregate Operational Data without authorization;','Use for Commercial Use without written license.']}
          specialTitle="Monitoring Intelligence as Trade Secret"
          specialClauses={[['4.1','The Monitoring Intelligence — polling intervals, failure thresholds, incident severity rules, alert suppression cooldowns, uptime aggregation methodology — constitutes trade secrets developed through operational experience. These parameters are not derivable from generic monitoring best practices and provide the Author with a competitive advantage.'],['4.2','Your confidentiality obligation with respect to the Monitoring Intelligence survives termination of this Agreement indefinitely.']]}
          closingNote="You agree not to flood or abuse the ntfy.sh or Discord alert channels used by the Watchdog Service, and not to take any action designed to suppress, delay, or corrupt incident detection or alert delivery."
        />

        {/* ═══ PART SEVEN: Closing ═══ */}
        <Section id="part7" num={7}>
          <SectionTitle part="Seven" title="Consolidated Closing Provisions" subtitle="This Master Agreement, together with the four individual component license agreements reproduced in Parts Three through Six above, constitutes the complete and exclusive statement of the intellectual property rights and licensing terms governing the PlanIt platform and all of its components." />

          <Reveal>
            <SubHead code="" title="Consolidated Ownership Statement" />
            <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(212,175,55,0.1)', borderRadius: '14px', padding: '1.75rem', fontSize: '0.9rem', color: 'rgba(240,236,228,0.65)', lineHeight: 1.95 }}>
              Every line of source code, every design decision, every data model, every algorithm, every configuration file, every comment, and every architectural choice across all four components of the PlanIt platform is the original creative work and exclusive property of Aakshat Hariharan. No co-author, contributor, employer, client, or third party holds any ownership interest in any portion of the PlanIt platform. The Author created this platform independently, owns it outright, and licenses it exclusively on the terms set out above.
            </div>
          </Reveal>

          <Reveal delay={60}>
            <SubHead code="" title="What Is and Is Not Permitted" />
            <p style={{ fontSize: '0.84rem', color: 'rgba(240,236,228,0.4)', marginBottom: '0.5rem' }}>Convenience summary only — does not supersede or limit the full terms above:</p>
            <PermGrid />
          </Reveal>

          <Reveal delay={80}>
            <SubHead code="" title="Violation Reporting" />
            <p style={{ fontSize: '0.875rem', color: 'rgba(240,236,228,0.6)', lineHeight: 1.8, marginBottom: '1rem' }}>If You become aware of any violation of this Master Agreement — including unauthorized forks, deployments, or distributions of any PlanIt component — please report it to:</p>
            <a href="mailto:planit.userhelp@gmail.com" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: '10px', padding: '0.85rem 1.25rem', textDecoration: 'none', fontSize: '0.85rem', color: '#d4af37', fontWeight: 500, transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(212,175,55,0.12)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(212,175,55,0.15)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(212,175,55,0.06)'; e.currentTarget.style.boxShadow = 'none'; }}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
              planit.userhelp@gmail.com · Subject: License Violation Report
            </a>
            <p style={{ fontSize: '0.84rem', color: 'rgba(240,236,228,0.4)', marginTop: '1rem', lineHeight: 1.7 }}>The Author takes intellectual property violations seriously and will pursue all available legal remedies.</p>
          </Reveal>

          <Reveal delay={100}>
            <SubHead code="" title="Acknowledgment" />
            <p style={{ fontSize: '0.875rem', color: 'rgba(240,236,228,0.5)', marginBottom: '0.75rem' }}>By accessing any component of the PlanIt platform, You acknowledge that:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {['You have read this Master Agreement in its entirety;', 'You understand its terms;', 'You agree to be legally bound by all of its provisions;', 'You have the legal capacity and authority to enter into this Agreement;', 'If You are accessing on behalf of an organization, You have authority to bind that organization to these terms; and', 'You acknowledge that this Agreement is enforceable against You.'].map((text, i) => (
                <div key={i} style={{ display: 'flex', gap: '1rem', padding: '0.7rem 1rem', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '9px', alignItems: 'flex-start' }}>
                  <span style={{ width: '1.5rem', height: '1.5rem', background: 'rgba(212,175,55,0.15)', border: '1px solid rgba(212,175,55,0.25)', color: '#d4af37', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800, flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ fontSize: '0.875rem', color: 'rgba(240,236,228,0.6)', lineHeight: 1.7 }}>{text}</span>
                </div>
              ))}
            </div>
          </Reveal>
        </Section>

        {/* Footer */}
        <Reveal>
          <footer style={{ padding: '4rem 0', textAlign: 'center', borderTop: '1px solid rgba(212,175,55,0.12)' }}>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '2.5rem', fontWeight: 900, background: 'linear-gradient(135deg,#d4af37,#f0c850)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', marginBottom: '0.5rem' }}>PlanIt</div>
            <p style={{ fontSize: '0.84rem', color: 'rgba(240,236,228,0.3)', marginBottom: '1.5rem' }}>Copyright © 2026 Aakshat Hariharan. All Rights Reserved.</p>
            <p style={{ fontSize: '0.82rem', color: 'rgba(240,236,228,0.25)', lineHeight: 1.8, maxWidth: '480px', margin: '0 auto 2rem' }}>All four components — Frontend, Backend, Router, and Watchdog — are protected by copyright law and trade secret law. Unauthorized use, copying, deployment, or distribution is strictly prohibited.</p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              {[['Website', 'https://planitapp.onrender.com'], ['Email', 'mailto:planit.userhelp@gmail.com']].map(([label, href]) => (
                <a key={label} href={href} style={{ color: 'rgba(212,175,55,0.6)', fontSize: '0.84rem', textDecoration: 'none', fontWeight: 500, padding: '0.4rem 1rem', border: '1px solid rgba(212,175,55,0.15)', borderRadius: '8px', transition: 'all 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#d4af37'; e.currentTarget.style.borderColor = 'rgba(212,175,55,0.4)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'rgba(212,175,55,0.6)'; e.currentTarget.style.borderColor = 'rgba(212,175,55,0.15)'; }}>
                  {label}
                </a>
              ))}
            </div>
          </footer>
        </Reveal>
      </div>

      {/* AI Chatbot */}
      <LexChat />
    </div>
  );
}
