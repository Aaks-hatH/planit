import { useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';

/* ── Scroll progress ── */
function useScrollPct() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const h = () => {
      const d = document.documentElement;
      setP(d.scrollHeight > d.clientHeight ? (d.scrollTop / (d.scrollHeight - d.clientHeight)) * 100 : 0);
    };
    window.addEventListener('scroll', h, { passive: true });
    return () => window.removeEventListener('scroll', h);
  }, []);
  return p;
}

/* ── Active TOC section ── */
function useActiveSection(ids) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const obs = ids.map(id => {
      const el = document.getElementById(id);
      if (!el) return null;
      const o = new IntersectionObserver(
        ([e]) => { if (e.isIntersecting) setActive(id); },
        { rootMargin: '-10% 0px -80% 0px' }
      );
      o.observe(el);
      return o;
    });
    return () => obs.forEach(o => o?.disconnect());
  }, []);
  return active;
}

/* ── Scroll-reveal ── */
function useReveal() {
  const ref = useRef(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVis(true); o.disconnect(); } }, { threshold: 0.05 });
    o.observe(ref.current);
    return () => o.disconnect();
  }, []);
  return [ref, vis];
}
function Reveal({ children, delay = 0 }) {
  const [ref, vis] = useReveal();
  return (
    <div ref={ref} style={{ opacity: vis ? 1 : 0, transform: vis ? 'none' : 'translateY(16px)', transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms` }}>
      {children}
    </div>
  );
}

/* ── TOC sections ── */
const TOC = [
  { id: 'overview',       label: 'Overview' },
  { id: 'part-one',       label: 'Platform Overview' },
  { id: 'part-two',       label: 'Master Terms' },
  { id: 'sec-ownership',  label: '· Ownership' },
  { id: 'sec-scope',      label: '· Scope' },
  { id: 'sec-grant',      label: '· License Grant' },
  { id: 'sec-restrict',   label: '· Restrictions' },
  { id: 'sec-nooss',      label: '· No Open Source' },
  { id: 'sec-disclaim',   label: '· Disclaimers' },
  { id: 'sec-law',        label: '· Governing Law' },
  { id: 'sec-contact',    label: '· Contact' },
  { id: 'part-three',     label: 'Frontend License' },
  { id: 'part-four',      label: 'Backend License' },
  { id: 'part-five',      label: 'Router License' },
  { id: 'part-six',       label: 'Watchdog License' },
  { id: 'part-seven',     label: 'Closing Provisions' },
];

/* ── Lex chatbot ── */
const LEX_INTRO = "Hi, I'm **Lex** — PlanIt's legal assistant. Ask me anything about this license and I'll explain it in plain language.";

function LexChat() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([{ role: 'assistant', content: LEX_INTRO }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [dots, setDots] = useState('');
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  const SUGGESTIONS = ['Can I fork this repo?', 'What is permitted for free?', 'Can I use this commercially?', 'What is the Cryptographic License System?'];

  useEffect(() => {
    if (!loading) { setDots(''); return; }
    const t = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 380);
    return () => clearInterval(t);
  }, [loading]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, loading]);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 250); }, [open]);

  const send = async (text) => {
    const q = (text ?? input).trim();
    if (!q || loading) return;
    setInput('');
    const next = [...msgs, { role: 'user', content: q }];
    setMsgs(next);
    setLoading(true);
    try {
      const ROUTER = (import.meta?.env?.VITE_ROUTER_URL || '').replace(/\/$/, '');
      // Gemini requires conversation to start with 'user' — strip leading assistant messages and error strings
      let payload = next.filter(m => (m.role === 'user' || m.role === 'assistant') && !m.content.includes('Something went wrong') && !m.content.includes('Please try again'));
      while (payload.length && payload[0].role !== 'user') payload.shift();
      const r = await fetch(`${ROUTER}/api/lex/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: payload }),
      });
      const data = await r.json();
      setMsgs(p => [...p, { role: 'assistant', content: data.reply || "I couldn't process that. Try rephrasing." }]);
    } catch {
      setMsgs(p => [...p, { role: 'assistant', content: 'Something went wrong. Please try again.' }]);
    } finally { setLoading(false); }
  };

  const renderMsg = (text) =>
    text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>');

  return (
    <>
      {/* Floating button */}
      <button onClick={() => setOpen(o => !o)}
        title="Ask Lex — PlanIt Legal Assistant"
        style={{ position: 'fixed', bottom: '1.75rem', right: '1.75rem', zIndex: 999, width: '52px', height: '52px', borderRadius: '50%', background: '#1e293b', border: '2px solid #334155', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.2)', transition: 'all 0.2s ease', animation: open ? 'none' : 'lexPulse 3s infinite' }}
        onMouseEnter={e => { e.currentTarget.style.background = '#334155'; e.currentTarget.style.transform = 'scale(1.06)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = '#1e293b'; e.currentTarget.style.transform = 'scale(1)'; }}>
        {open
          ? <svg width="18" height="18" fill="none" stroke="#94a3b8" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"/></svg>
          : <svg width="20" height="20" fill="none" stroke="#94a3b8" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
        }
      </button>

      {/* Chat panel */}
      <div style={{ position: 'fixed', bottom: '5.25rem', right: '1.75rem', zIndex: 998, width: '360px', height: '480px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.12)', transform: open ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.97)', opacity: open ? 1 : 0, pointerEvents: open ? 'all' : 'none', transition: 'all 0.25s cubic-bezier(0.16,1,0.3,1)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '1rem 1.1rem', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '0.65rem', background: '#f8fafc', flexShrink: 0 }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="15" height="15" fill="none" stroke="#94a3b8" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>Lex</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#22c55e' }} />
              <p style={{ fontSize: '0.7rem', color: '#64748b', margin: 0 }}>PlanIt Legal Assistant</p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {msgs.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', gap: '0.5rem' }}>
              {m.role === 'assistant' && (
                <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '0.1rem' }}>
                  <svg width="10" height="10" fill="none" stroke="#94a3b8" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                </div>
              )}
              <div style={{ maxWidth: '80%', padding: '0.6rem 0.85rem', borderRadius: m.role === 'user' ? '12px 12px 2px 12px' : '2px 12px 12px 12px', background: m.role === 'user' ? '#1e293b' : '#f8fafc', border: m.role === 'assistant' ? '1px solid #e2e8f0' : 'none', fontSize: '0.83rem', color: m.role === 'user' ? '#f1f5f9' : '#334155', lineHeight: 1.65 }}
                dangerouslySetInnerHTML={{ __html: renderMsg(m.content) }} />
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="10" height="10" fill="none" stroke="#94a3b8" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <div style={{ padding: '0.6rem 0.85rem', borderRadius: '2px 12px 12px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', fontSize: '0.83rem', color: '#94a3b8' }}>
                Thinking{dots}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Suggestions */}
        {msgs.length === 1 && (
          <div style={{ padding: '0 0.85rem 0.65rem', display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            {SUGGESTIONS.map(s => (
              <button key={s} onClick={() => send(s)} style={{ all: 'unset', cursor: 'pointer', fontSize: '0.71rem', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '999px', padding: '0.28rem 0.65rem', background: '#f8fafc', transition: 'all 0.15s', fontFamily: 'inherit' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0'; }}>
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div style={{ padding: '0.65rem 0.85rem', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '0.45rem', flexShrink: 0 }}>
          <input ref={inputRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Ask about this license..."
            style={{ flex: 1, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.55rem 0.8rem', color: '#0f172a', fontSize: '0.83rem', outline: 'none', fontFamily: 'inherit', transition: 'border-color 0.15s' }}
            onFocus={e => e.target.style.borderColor = '#94a3b8'}
            onBlur={e => e.target.style.borderColor = '#e2e8f0'} />
          <button onClick={() => send()} disabled={!input.trim() || loading}
            style={{ width: '34px', height: '34px', borderRadius: '8px', background: input.trim() && !loading ? '#1e293b' : '#f1f5f9', border: 'none', cursor: input.trim() && !loading ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.15s' }}>
            <svg width="14" height="14" fill="none" stroke={input.trim() && !loading ? '#f1f5f9' : '#94a3b8'} strokeWidth="2.5" viewBox="0 0 24 24"><path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z"/></svg>
          </button>
        </div>
      </div>
    </>
  );
}

/* ── Shared text styles ── */
const P  = { fontSize: '0.9rem', color: '#374151', lineHeight: 1.85, margin: '0 0 0.85rem' };
const SM = { fontSize: '0.82rem', color: '#374151', lineHeight: 1.85, margin: '0 0 0.75rem' };

/* ── Clause row ── */
function Clause({ code, children }) {
  const [hov, setHov] = useState(false);
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: 'flex', gap: '1.1rem', padding: '0.55rem 0.75rem', borderRadius: '6px', background: hov ? '#f9fafb' : 'transparent', transition: 'background 0.15s', cursor: 'default', margin: '0 -0.75rem' }}>
      <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#9ca3af', flexShrink: 0, paddingTop: '0.25rem', minWidth: '3.25rem' }}>{code}</span>
      <span style={{ ...SM, margin: 0 }}>{children}</span>
    </div>
  );
}

/* ── Definition list ── */
function DefList({ items }) {
  return (
    <dl style={{ margin: '0.75rem 0 0', display: 'flex', flexDirection: 'column', gap: 0, border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
      {items.map(([term, def], i) => (
        <div key={term} style={{ display: 'flex', borderBottom: i < items.length - 1 ? '1px solid #f3f4f6' : 'none' }}
          onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <dt style={{ width: '9.5rem', flexShrink: 0, padding: '0.75rem 1rem', borderRight: '1px solid #f3f4f6', fontFamily: 'monospace', fontSize: '0.75rem', color: '#4b5563', fontWeight: 600 }}>"{term}"</dt>
          <dd style={{ flex: 1, padding: '0.75rem 1rem', ...SM, margin: 0 }}>{def}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ── Restriction list ── */
function RestrictList({ items }) {
  return (
    <ol style={{ margin: '0.6rem 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
      {items.map((t, i) => (
        <li key={i} style={{ display: 'flex', gap: '0.85rem', padding: '0.45rem 0.75rem', borderRadius: '6px', alignItems: 'flex-start' }}
          onMouseEnter={e => e.currentTarget.style.background = '#fafafa'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#9ca3af', flexShrink: 0, paddingTop: '0.25rem' }}>({String.fromCharCode(97 + i)})</span>
          <span style={{ ...SM, margin: 0 }}>{t}</span>
        </li>
      ))}
    </ol>
  );
}

/* ── Callout box ── */
function Callout({ type = 'note', children }) {
  const styles = {
    note:    { bg: '#fffbeb', border: '#fcd34d', text: '#92400e' },
    warning: { bg: '#fef2f2', border: '#fca5a5', text: '#7f1d1d' },
    info:    { bg: '#f0f9ff', border: '#7dd3fc', text: '#0c4a6e' },
  };
  const s = styles[type];
  return (
    <div style={{ background: s.bg, border: `1px solid ${s.border}`, borderRadius: '8px', padding: '0.85rem 1.1rem', margin: '1.1rem 0' }}>
      <p style={{ ...SM, color: s.text, margin: 0 }}>{children}</p>
    </div>
  );
}

/* ── Section heading within a part ── */
function SubHeading({ code, title }) {
  return (
    <h4 style={{ fontFamily: "'Georgia', 'Times New Roman', serif", fontSize: '1rem', fontWeight: 700, color: '#111827', margin: '2rem 0 0.6rem', display: 'flex', alignItems: 'baseline', gap: '0.65rem' }}>
      {code && <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#9ca3af', fontWeight: 400 }}>{code}</span>}
      {title}
    </h4>
  );
}

/* ── Part divider heading ── */
function PartHead({ id, partLabel, title, subtitle }) {
  return (
    <div id={id} style={{ scrollMarginTop: '72px', borderBottom: '1px solid #e5e7eb', paddingBottom: '1.25rem', marginBottom: '1.75rem' }}>
      <p style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 0.4rem' }}>{partLabel}</p>
      <h2 style={{ fontFamily: "'Georgia', 'Times New Roman', serif", fontSize: 'clamp(1.25rem, 2.5vw, 1.65rem)', fontWeight: 700, color: '#111827', margin: '0 0 0.5rem', lineHeight: 1.25 }}>{title}</h2>
      {subtitle && <p style={{ ...SM, color: '#6b7280', margin: 0 }}>{subtitle}</p>}
    </div>
  );
}

/* ── Component card (collapsible) ── */
function ComponentCard({ letter, title, accent, description, points, proprietary }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ border: '1px solid #e5e7eb', borderLeft: `3px solid ${accent}`, borderRadius: '8px', marginBottom: '1rem', overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{ all: 'unset', display: 'flex', width: '100%', alignItems: 'center', gap: '0.85rem', padding: '0.9rem 1.1rem', cursor: 'pointer', background: open ? '#fafafa' : '#fff', transition: 'background 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
        onMouseLeave={e => e.currentTarget.style.background = open ? '#fafafa' : '#fff'}>
        <span style={{ width: '1.75rem', height: '1.75rem', borderRadius: '5px', background: accent, color: '#fff', fontWeight: 700, fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{letter}</span>
        <span style={{ fontFamily: "'Georgia', 'Times New Roman', serif", fontSize: '0.95rem', fontWeight: 700, color: '#111827', flex: 1, textAlign: 'left' }}>{title}</span>
        <svg width="14" height="14" fill="none" stroke="#9ca3af" strokeWidth="2" viewBox="0 0 24 24" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s', flexShrink: 0 }}><path d="M6 9l6 6 6-6"/></svg>
      </button>
      <div style={{ maxHeight: open ? '2400px' : 0, overflow: 'hidden', transition: 'max-height 0.4s cubic-bezier(0.16,1,0.3,1)' }}>
        <div style={{ padding: '0 1.1rem 1.1rem', borderTop: '1px solid #f3f4f6' }}>
          <p style={{ ...SM, marginTop: '0.85rem' }}>{description}</p>
          <p style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '1rem 0 0.4rem' }}>Encompasses</p>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {points.map((pt, i) => (
              <li key={i} style={{ display: 'flex', gap: '0.6rem', ...SM, margin: 0 }}>
                <span style={{ color: accent, flexShrink: 0, fontSize: '0.55rem', marginTop: '0.45rem' }}>▸</span>
                <span>{pt}</span>
              </li>
            ))}
          </ul>
          <p style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '1rem 0 0.4rem' }}>Why It's Proprietary</p>
          <p style={{ ...SM, margin: 0, color: '#4b5563' }}>{proprietary}</p>
        </div>
      </div>
    </div>
  );
}

/* ── Permission summary ── */
function PermSummary() {
  const yes = ['Reading source code for personal educational reference', 'Using the hosted service at planitapp.onrender.com as an end-user', 'Discussing the platform publicly in factual, non-misleading terms', 'Reporting security vulnerabilities responsibly to the Author'];
  const no  = ['Deploying any component on any infrastructure', 'Copying, cloning, or forking any component', 'Distributing any component to any third party', 'Creating any Derivative Work from any component', 'Using any component for Commercial Use', 'Removing copyright notices or "Powered by PlanIt" attributions', 'Using the PlanIt name or logo without consent', 'Reverse engineering any security or cryptographic mechanism', 'Using source code in ML or AI training datasets', 'Conducting penetration testing of the Hosted Service'];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.1rem', marginTop: '0.75rem' }}>
      {[{ label: 'Permitted without permission', icon: '✓', items: yes, color: '#15803d', bg: '#f0fdf4', border: '#bbf7d0' },
        { label: 'Requires written permission', icon: '✕', items: no,  color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' }].map(({ label, icon, items, color, bg, border }) => (
        <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderRadius: '8px', padding: '1rem 1.1rem' }}>
          <p style={{ fontSize: '0.7rem', fontFamily: 'monospace', fontWeight: 700, color, letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 0.75rem' }}>{label}</p>
          {items.map((t, i) => (
            <div key={i} style={{ display: 'flex', gap: '0.5rem', ...SM, color, margin: '0 0 0.35rem' }}>
              <span style={{ flexShrink: 0 }}>{icon}</span><span>{t}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/* ── Full component license block ── */
function CompLicense({ id, partLabel, title, accent, coverage, defs, grantLines, restrictItems, specialTitle, specialClauses, closingNote, extraNotes }) {
  return (
    <section id={id} style={{ scrollMarginTop: '72px', paddingBottom: '3rem', marginBottom: '3rem', borderBottom: '1px solid #e5e7eb' }}>
      <Reveal>
        <PartHead id={id} partLabel={partLabel} title={`${title} — License Agreement`} subtitle={coverage} />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {[['Version', 'v2.0 — January 2026'], ['Copyright', '© 2026 Aakshat Hariharan'], ['Status', 'Proprietary · All Rights Reserved']].map(([k, v]) => (
            <div key={k} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '7px', padding: '0.65rem 0.85rem' }}>
              <p style={{ fontSize: '0.62rem', fontFamily: 'monospace', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 0.2rem' }}>{k}</p>
              <p style={{ fontSize: '0.8rem', color: '#374151', fontWeight: 500, margin: 0 }}>{v}</p>
            </div>
          ))}
        </div>

        <Callout type="note">
          <strong>IMPORTANT</strong> — Read this entire agreement before accessing, viewing, downloading, cloning, compiling, executing, or otherwise interacting with the {title} or any portion thereof. This Agreement takes effect at the earliest moment You interact with this software in any form.
        </Callout>

        <SubHeading code="§ 1" title="Definitions" />
        <DefList items={defs} />

        <SubHeading code="§ 2" title="Grant of Limited License" />
        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '0.85rem 1.1rem' }}>
          {grantLines.map((l, i) => <p key={i} style={{ ...SM, margin: i < grantLines.length - 1 ? '0 0 0.55rem' : 0 }}>{l}</p>)}
        </div>

        <SubHeading code="§ 3" title="Restrictions on Use" />
        <p style={{ ...SM, color: '#6b7280' }}>Without prior explicit written permission from the Author, You must NOT:</p>
        <RestrictList items={restrictItems} />

        <SubHeading code="§ 4" title={specialTitle} />
        <div style={{ borderLeft: `3px solid ${accent}`, paddingLeft: '1rem' }}>
          {specialClauses.map(([code, text]) => <Clause key={code} code={code}>{text}</Clause>)}
        </div>

        {extraNotes && <>
          <SubHeading code="§ 5" title="Data, Privacy & Security Obligations" />
          {extraNotes.map((t, i) => <p key={i} style={P}>{t}</p>)}
        </>}

        <SubHeading code={extraNotes ? '§ 6–11' : '§ 5–11'} title="Confidentiality, Warranties, Liability, Indemnification, Termination & General Provisions" />
        <p style={P}>{closingNote}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '0.6rem', marginTop: '0.5rem' }}>
          {[['Warranty', 'Provided "AS IS" without warranty of any kind. All warranties disclaimed to the maximum extent permitted by law.'], ['Liability Cap', "The Author's total liability shall not exceed USD $100.00 under any circumstances."], ['Indemnification', 'You agree to indemnify and hold harmless the Author from any claims arising from Your breach.'], ['Termination', 'Effective from first access. Breach causes immediate termination. You must cease all use and delete all copies.'], ['Injunctive Relief', 'The Author is entitled to seek injunctive relief without bond for any unauthorized use.'], ['Governing Law', "Governed by the laws of the jurisdiction of the Author's residence."]].map(([t, d]) => (
            <div key={t} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '7px', padding: '0.75rem 0.9rem' }}>
              <p style={{ fontSize: '0.62rem', fontFamily: 'monospace', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 0.3rem' }}>{t}</p>
              <p style={{ ...SM, margin: 0 }}>{d}</p>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

/* ═══════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════ */
export default function License() {
  const navigate = useNavigate();
  const pct = useScrollPct();
  const active = useActiveSection(TOC.map(t => t.id));

  return (
    <div style={{ minHeight: '100vh', background: '#fff', color: '#111827', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        html{scroll-behavior:smooth;}
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-track{background:#f9fafb;}
        ::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:99px;}
        ::-webkit-scrollbar-thumb:hover{background:#9ca3af;}
        @keyframes lexPulse{0%,100%{box-shadow:0 4px 20px rgba(0,0,0,0.15),0 0 0 0 rgba(30,41,59,0.25);}60%{box-shadow:0 4px 20px rgba(0,0,0,0.15),0 0 0 10px rgba(30,41,59,0);}}
        @media(max-width:900px){.lic-sidebar{display:none!important;}.lic-main{max-width:100%!important;}}
        @media(max-width:600px){.perm-grid{grid-template-columns:1fr!important;}.meta-grid{grid-template-columns:1fr 1fr!important;}.liab-grid{grid-template-columns:1fr!important;}}
      `}</style>

      {/* Slim progress bar */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '2px', zIndex: 1001, background: '#f3f4f6' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: '#374151', transition: 'width 0.1s linear' }} />
      </div>

      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(255,255,255,0.97)', backdropFilter: 'blur(8px)', borderBottom: '1px solid #e5e7eb', padding: '0 2rem', height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
          <button onClick={() => navigate('/')} style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: '#6b7280', fontFamily: 'inherit', padding: '0.3rem 0.6rem', borderRadius: '6px', border: '1px solid #e5e7eb', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.color = '#111827'; e.currentTarget.style.borderColor = '#d1d5db'; }}
            onMouseLeave={e => { e.currentTarget.style.color = '#6b7280'; e.currentTarget.style.borderColor = '#e5e7eb'; }}>
            <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
            Back
          </button>
          <div style={{ width: 1, height: '1rem', background: '#e5e7eb' }} />
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#374151' }}>PlanIt · License Agreement</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span style={{ fontSize: '0.72rem', fontFamily: 'monospace', color: '#9ca3af' }}>v2.0 · Jan 2026</span>
          <span style={{ fontSize: '0.65rem', fontFamily: 'monospace', background: '#f3f4f6', color: '#6b7280', padding: '0.2rem 0.6rem', borderRadius: '4px', border: '1px solid #e5e7eb' }}>ALL RIGHTS RESERVED</span>
        </div>
      </header>

      <div style={{ maxWidth: '1160px', margin: '0 auto', padding: '0 2rem', display: 'flex', gap: '3.5rem' }}>

        {/* Sidebar TOC */}
        <aside className="lic-sidebar" style={{ width: '196px', flexShrink: 0, position: 'sticky', top: '52px', height: 'calc(100vh - 52px)', overflowY: 'auto', padding: '2rem 0', paddingRight: '1.25rem', borderRight: '1px solid #f3f4f6' }}>
          <p style={{ fontSize: '0.62rem', fontFamily: 'monospace', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 0.5rem' }}>On this page</p>
          <nav style={{ display: 'flex', flexDirection: 'column' }}>
            {TOC.map(({ id, label }) => {
              const isActive = active === id;
              const isNested = label.startsWith('·');
              return (
                <button key={id} onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })}
                  style={{ all: 'unset', cursor: 'pointer', fontSize: isNested ? '0.76rem' : '0.79rem', padding: isNested ? '0.22rem 0.6rem 0.22rem 1rem' : '0.28rem 0.6rem', borderRadius: '5px', color: isActive ? '#111827' : '#6b7280', fontWeight: isActive ? 600 : 400, background: isActive ? '#f3f4f6' : 'transparent', borderLeft: `2px solid ${isActive ? '#374151' : 'transparent'}`, transition: 'all 0.15s', fontFamily: 'inherit', textAlign: 'left', lineHeight: 1.45 }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = '#374151'; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = '#6b7280'; }}>
                  {isNested ? label.slice(2) : label}
                </button>
              );
            })}
          </nav>

          {/* Ask Lex hint */}
          <div style={{ marginTop: '1.75rem', padding: '0.75rem 0.85rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
            <p style={{ fontSize: '0.68rem', fontWeight: 600, color: '#374151', margin: '0 0 0.3rem' }}>Have a question?</p>
            <p style={{ fontSize: '0.68rem', color: '#6b7280', lineHeight: 1.5, margin: 0 }}>Ask <strong>Lex</strong>, PlanIt's legal assistant — bottom right ↘</p>
          </div>
        </aside>

        {/* Main content */}
        <main style={{ flex: 1, minWidth: 0, paddingTop: '2.5rem', paddingBottom: '5rem' }}>

          {/* ── Overview ── */}
          <section id="overview" style={{ scrollMarginTop: '72px', paddingBottom: '3rem', marginBottom: '3rem', borderBottom: '1px solid #e5e7eb' }}>
            <Reveal>
              <p style={{ fontSize: '0.7rem', fontFamily: 'monospace', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 0.75rem' }}>Master License Agreement</p>
              <h1 style={{ fontFamily: "'Georgia', 'Times New Roman', serif", fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 700, color: '#111827', lineHeight: 1.2, margin: '0 0 0.75rem' }}>
                PlanIt Platform — Consolidated Intellectual Property Declaration
              </h1>
              <p style={{ ...SM, color: '#6b7280', maxWidth: '620px', margin: '0 0 1.5rem' }}>
                This Master License Agreement is the single authoritative legal instrument governing all intellectual property rights in and to the PlanIt platform — a proprietary event management and white-label SaaS platform created, owned, and operated solely by Aakshat Hariharan.
              </p>

              <div className="meta-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.6rem', marginBottom: '1.5rem' }}>
                {[['Version', 'v2.0'], ['Date', 'January 2026'], ['Author', 'Aakshat Hariharan'], ['Contact', 'planit.userhelp@gmail.com']].map(([k, v]) => (
                  <div key={k} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '7px', padding: '0.65rem 0.8rem' }}>
                    <p style={{ fontSize: '0.62rem', fontFamily: 'monospace', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 0.2rem' }}>{k}</p>
                    <p style={{ fontSize: '0.8rem', color: '#374151', fontWeight: 500, margin: 0, wordBreak: 'break-word' }}>{v}</p>
                  </div>
                ))}
              </div>

              <Callout type="warning">
                <strong>BY ACCESSING THE REPOSITORY CONTAINING ANY COMPONENT OF THE PLANIT PLATFORM, VIEWING ANY SOURCE CODE FILE, CLONING OR FORKING THE REPOSITORY, RUNNING ANY COMPONENT LOCALLY, OR USING THE HOSTED SERVICE AT PLANITAPP.ONRENDER.COM, YOU AGREE TO BE LEGALLY BOUND BY THIS MASTER AGREEMENT.</strong> If you do not agree, immediately cease all interaction with the PlanIt platform in any form.
              </Callout>

              <p style={P}>This document serves three purposes:</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
                {[['FIRST', 'It explains in plain terms what each component of the PlanIt platform is, what it does, and why it is protected.'], ['SECOND', 'It sets out the overarching licensing terms that apply across all components of the platform as a unified whole.'], ['THIRD', 'It reproduces in full each individual component license agreement, so the complete legal terms for every part of the platform are accessible in a single place.']].map(([label, text]) => (
                  <div key={label} style={{ display: 'flex', gap: '0.85rem', padding: '0.65rem 0.85rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '7px' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.65rem', color: '#9ca3af', flexShrink: 0, paddingTop: '0.15rem', minWidth: '3rem' }}>{label}</span>
                    <span style={{ ...SM, margin: 0 }}>{text}</span>
                  </div>
                ))}
              </div>
            </Reveal>
          </section>

          {/* ── Part One: Platform Overview ── */}
          <section id="part-one" style={{ scrollMarginTop: '72px', paddingBottom: '3rem', marginBottom: '3rem', borderBottom: '1px solid #e5e7eb' }}>
            <Reveal>
              <PartHead id="part-one" partLabel="Part One" title="The PlanIt Platform — An Overview"
                subtitle="The PlanIt platform is not a single application. It is a multi-service distributed system comprising four distinct software components, each separately developed, separately deployed, and separately owned by the Author. This section explains each component before the formal legal terms begin." />

              <ComponentCard letter="A" title="The Frontend Application" accent="#3b82f6"
                description="The client-side web application built with React and Vite, served as a single-page application at planitapp.onrender.com. It is the primary interface through which users, organizers, and white-label clients interact with the platform."
                points={['Public-facing homepage: event creation form, venue mode, branch selector, and all publicly accessible marketing pages.', 'EventSpace: the rich, real-time event dashboard through which organizers manage attendees, run chat, conduct polls, share files, manage seating charts, track budgets, post announcements, and view analytics.', 'Admin Panel: a password-protected multi-section administrative interface for managing all events, white-label clients, billing, employees, incident reporting, system settings, and security monitoring.', 'White-Label Client Portal (/dashboard): accessible on white-label custom domains, allowing paying clients to customize branding, page content, feature flags, and security settings.', 'White-Label Theming System: a dynamic CSS variable injection architecture that transforms the application\'s visual identity at runtime based on a white-label client\'s branding configuration.', 'WLHome: a branded landing page served at the root URL of white-label custom domains, showing the client\'s own hero content, event discovery feed scoped to their tenant, and contact information.', 'Reservation System: the ReservePage and associated flows through which guests discover, reserve, and receive confirmation for event spots.', 'Additional flows: public ticket pages, waitlist signup, organizer login, table service interfaces, check-in kiosks, QR-code-based guest invite flows, invitation badge and card generators, and support flows.', 'Complete proprietary Visual Design System: dark-mode first, built on a near-black base, with blue-to-indigo gradients, ambient radial glow orbs, glassmorphism card treatments, and a distinctive micro-interaction vocabulary — constituting protectable trade dress.', 'WhiteLabelContext: a React context provider that wraps the entire application, performing domain detection, branding resolution via /api/whitelabel/resolve, and cryptographic heartbeat verification via /api/whitelabel/heartbeat.']}
                proprietary="The Frontend Application's value lies not just in the code, but in the decisions: which components to build, how they interact, what the user experience flows feel like, how the white-label system works architecturally, and what the visual design language communicates. Taken as a whole it constitutes both a copyrighted work and protectable trade dress. Individual components, when extracted, still carry the Author's copyright."
              />

              <ComponentCard letter="B" title="The Backend Application" accent="#7c3aed"
                description="The server-side engine built on Node.js and Express.js, deployed as a fleet of five identical instances named Maverick, Goose, Iceman, Slider, and Viper. It is the authoritative source of truth for all platform data and business logic."
                points={['Event Management Engine: full CRUD for events, participants, RSVP flows, file uploads to Cloudinary, real-time chat via Socket.IO, and polls.', 'JWT-based authentication with per-role authorization (organizer, staff, guest, admin), bcrypt password hashing, and secure token generation.', 'White-Label Management API: /resolve endpoint (identifies a custom domain and returns branding configuration) and /heartbeat endpoint (verifies license validity).', 'Cryptographic License Key System: HMAC-SHA256-based license key generation and verification with the format WL-{TIER}-{DOMAIN_HASH_8}-{EXPIRY_HEX}-{HMAC_12}.', 'White-Label Client Portal API (/api/wl-portal/*): login, branding update, page content customization, feature flag toggling, password change, and login audit log.', 'trafficGuard Security Middleware: IP-based rate limiting, suspicious request pattern detection, automated attack mitigation, honeypot endpoint detection, and bot signature identification.', 'Email Service: integration with Brevo (primary) and Mailjet (fallback) for transactional email delivery.', 'Distributed Maintenance System: coordinates across Router and all Backend instances with carefully engineered exemptions.', 'Mongoose data models: Event, WhiteLabel, WLLead, EventParticipant, Incident, and MaintenanceSchedule — with indexes, validation rules, and field-level access controls.', 'Socket.IO real-time layer: room-based event broadcasting, live participant state synchronization, table service order notifications, and organizer announcements.']}
                proprietary="The Backend's value lies in three things: (1) the completeness and correctness of its data models; (2) the security architecture, particularly trafficGuard and the white-label license enforcement system; and (3) the Cryptographic License Key System — a novel invention enabling offline-verifiable, tamper-evident license enforcement at scale. None of these may be copied, adapted, or used as a reference implementation without the Author's permission."
              />

              <ComponentCard letter="C" title="The Router Service" accent="#059669"
                description="The intelligent HTTP traffic orchestration layer deployed at planit-router.onrender.com. It sits between the public internet and the Backend Fleet and coordinates all traffic using a proprietary scoring algorithm — not simple round-robin."
                points={['Proprietary scoring algorithm for backend instance selection based on real-time health status, consecutive alive/dead transitions, request history, and configured backend weights.', 'Health-aware orchestration: continuously polling all backend instances and dynamically removing unhealthy instances from the routing pool without dropping in-flight requests.', 'Boost mode: a system that temporarily expands the active backend count during high-traffic periods, with configurable thresholds, duration, and reversion logic.', 'Maintenance coordination: distributed maintenance enforcement with 503 responses during maintenance windows and carefully engineered exemptions for critical paths.', 'Dynamic CORS management across all white-label custom domains, pulling the current list from the Backend Fleet periodically.', 'HMAC-based Mesh Authentication for all inter-service communication between the Router and the Backend Fleet.', 'Short-TTL response caching for frequently-requested read-only API endpoints.', 'WebSocket proxying with sticky session behavior for Socket.IO long-polling connections.']}
                proprietary="The Router Service's value is entirely in its Routing Intelligence — the specific algorithm by which it selects backend instances. This is not publicly known and is not reproducible from first principles without the Author's specific engineering decisions. It also contains the Mesh Protocol, a custom security protocol designed specifically for the PlanIt platform. Both constitute trade secrets in addition to copyrighted works."
              />

              <ComponentCard letter="D" title="The Watchdog Service" accent="#d97706"
                description="An autonomous infrastructure monitoring daemon that operates independently of all other platform components, ensuring continuous platform health awareness and coordinated incident response."
                points={['Continuous health polling of the PlanIt Router Service, Backend Fleet instances, and all other monitored infrastructure components at configurable intervals.', 'Incident lifecycle management: detecting incidents based on consecutive health check failures, creating incident records, and tracking their progression through open/investigating/resolved states.', 'Real-time alert routing and delivery via ntfy.sh and Discord webhooks with alert deduplication and suppression logic to prevent notification flooding.', 'Rolling uptime percentage aggregation for all monitored services, providing historical availability data to the public status page at planitapp.onrender.com/status.', '/watchdog/status (mesh-authenticated) and /api/uptime/status (public) endpoints for the frontend status page.', 'Auto-promotion of scheduled maintenance windows: polling for upcoming windows and automatically promoting them to active maintenance mode, coordinating across all Router and Backend instances.']}
                proprietary="The Watchdog's value lies in its Monitoring Intelligence — the specific configuration of polling intervals, failure thresholds, incident severity rules, alert routing logic, and uptime aggregation methodology developed through operational experience. These are not derivable from generic monitoring best practices and constitute trade secrets."
              />
            </Reveal>
          </section>

          {/* ── Part Two: Master Terms ── */}
          <section id="part-two" style={{ scrollMarginTop: '72px', paddingBottom: '3rem', marginBottom: '3rem', borderBottom: '1px solid #e5e7eb' }}>
            <Reveal>
              <PartHead id="part-two" partLabel="Part Two" title="Overarching Terms — Applicable to All Components"
                subtitle="The following terms apply to the PlanIt platform as a unified whole, in addition to the individual component license terms set out in Parts Three through Six below." />

              <div id="sec-ownership" style={{ scrollMarginTop: '72px' }}>
                <SubHeading code="M-1" title="Unified Ownership Declaration" />
                <Clause code="M-1.1">The Author is the sole and exclusive owner of all intellectual property rights in and to the PlanIt platform as a whole and in each individual component thereof, including all copyrights, trade secrets, trade dress, and any other proprietary rights recognized under applicable law.</Clause>
                <Clause code="M-1.2">The PlanIt platform, considered as a whole, constitutes a collective work under copyright law in addition to the individual copyrights subsisting in each component. The Author owns the copyright in the collective work in addition to the component copyrights.</Clause>
                <Clause code="M-1.3">The architectural decisions that govern how the four components interact — the CORS scheme, the mesh authentication protocol, the white-label domain flow from frontend resolution through backend heartbeat to Router-level CORS registration, the maintenance exemption hierarchy — together constitute a proprietary system design that is itself a trade secret and copyrighted work of the Author, separate from and in addition to the individual component copyrights.</Clause>
              </div>

              <div id="sec-scope" style={{ scrollMarginTop: '72px' }}>
                <SubHeading code="M-2" title="Scope of the Master Agreement" />
                <Clause code="M-2.1">This Master Agreement governs any and all access to and use of the PlanIt platform, regardless of which component or components You interact with.</Clause>
                <Clause code="M-2.2">Where a more specific individual component license agreement addresses a particular topic, that specific provision takes precedence over any general provision in this Master Agreement with respect to that specific topic.</Clause>
                <Clause code="M-2.3">Interaction with any single component of the PlanIt platform subjects You to the Master Agreement AND to the individual license agreement for that component.</Clause>
              </div>

              <div id="sec-grant" style={{ scrollMarginTop: '72px' }}>
                <SubHeading code="M-3" title="Unified Grant of Limited License" />
                <Clause code="M-3.1">Subject to Your full and continuous compliance with this Master Agreement and all applicable individual component license agreements, the Author grants You a limited, personal, non-exclusive, non-transferable, non-sublicensable, revocable license to: (a) View the source code of any component solely for personal, non-commercial educational and reference purposes; and (b) Access and use the Hosted Service as an end-user for its intended purpose of event planning and management, subject to the Terms of Service at planitapp.onrender.com.</Clause>
                <Clause code="M-3.2">White-label clients with executed white-label agreements hold additional rights as specified in those agreements only.</Clause>
                <Clause code="M-3.3">All rights not expressly granted are reserved by the Author.</Clause>
              </div>

              <div id="sec-restrict" style={{ scrollMarginTop: '72px' }}>
                <SubHeading code="M-4" title="Unified Restrictions" />
                <p style={{ ...SM, color: '#6b7280' }}>Without explicit prior written permission from the Author, You must NOT:</p>
                <RestrictList items={['Deploy any component of the platform on any infrastructure;', 'Copy, clone, or reproduce any component in any form;', 'Distribute any component to any third party;', 'Create any Derivative Work from any component;', 'Use any component for any Commercial Use;', 'Reverse engineer any security or enforcement mechanism;', 'Use any component\'s source code in any ML training dataset;', 'Remove any copyright notice or proprietary marking.']} />
              </div>

              <div id="sec-nooss" style={{ scrollMarginTop: '72px' }}>
                <SubHeading code="M-5" title="No Open Source" />
                <Callout type="note">
                  <strong>The PlanIt platform is NOT open source software.</strong> No component is released under any open-source license, including MIT, Apache 2.0, GNU GPL, GNU LGPL, BSD, Creative Commons, or any other license that would permit copying, modification, or redistribution.
                </Callout>
                <Clause code="M-5.2">The presence of this source code in a publicly accessible repository does not, under any interpretation, constitute: (a) an open-source release; (b) a public domain dedication; (c) an implied license of any kind; (d) a waiver of any copyright or other proprietary right; or (e) consent to any use beyond viewing for educational reference.</Clause>
                <Clause code="M-5.3">The Author has chosen to make this source code publicly visible solely to demonstrate technical capability and for reference purposes. This choice is made expressly without waiving any intellectual property right.</Clause>
              </div>

              <div id="sec-disclaim" style={{ scrollMarginTop: '72px' }}>
                <SubHeading code="M-6" title="Unified Disclaimers and Limitations" />
                <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '0.25rem 0.5rem' }}>
                  <Clause code="M-6.1">THE ENTIRE PLANIT PLATFORM IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED. THE AUTHOR DISCLAIMS ALL WARRANTIES TO THE MAXIMUM EXTENT PERMITTED BY LAW.</Clause>
                  <Clause code="M-6.2">THE AUTHOR'S TOTAL LIABILITY UNDER THIS MASTER AGREEMENT AND ALL INDIVIDUAL COMPONENT LICENSES COMBINED SHALL NOT EXCEED USD $100.00.</Clause>
                  <Clause code="M-6.3">IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY INDIRECT, CONSEQUENTIAL, INCIDENTAL, SPECIAL, OR PUNITIVE DAMAGES ARISING FROM ANY COMPONENT OF THE PLATFORM.</Clause>
                </div>
              </div>

              <div id="sec-law" style={{ scrollMarginTop: '72px' }}>
                <SubHeading code="M-7" title="Governing Law and Dispute Resolution" />
                <Clause code="M-7.1">This Master Agreement and all individual component license agreements shall be governed by the laws of the jurisdiction in which the Author resides, without regard to conflict of law principles.</Clause>
                <Clause code="M-7.2">Any dispute that cannot be resolved by direct negotiation shall be submitted to binding arbitration under rules mutually agreed by the parties, except that the Author shall always be entitled to seek emergency injunctive relief from any court of competent jurisdiction without first submitting to arbitration.</Clause>
                <Clause code="M-7.3">Each party irrevocably waives any objection to the venue or personal jurisdiction of courts in the Author's jurisdiction for any proceeding that escapes arbitration.</Clause>
              </div>

              <div id="sec-contact" style={{ scrollMarginTop: '72px' }}>
                <SubHeading code="M-8" title="Contact and Permissions" />
                <Clause code="M-8.1">All requests for permissions beyond those granted — including commercial license inquiries, white-label partnership inquiries, academic use requests, and security vulnerability reports — must be directed to:</Clause>
                <div style={{ display: 'flex', gap: '2rem', padding: '0.85rem 1rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', margin: '0.6rem 0', flexWrap: 'wrap' }}>
                  {[['Email', 'planit.userhelp@gmail.com', 'mailto:planit.userhelp@gmail.com'], ['Web', 'https://planitapp.onrender.com', 'https://planitapp.onrender.com']].map(([k, v, href]) => (
                    <div key={k}>
                      <p style={{ fontSize: '0.62rem', fontFamily: 'monospace', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 0.2rem' }}>{k}</p>
                      <a href={href} style={{ fontSize: '0.84rem', color: '#374151', fontWeight: 500, textDecoration: 'none', borderBottom: '1px solid #d1d5db' }}
                        onMouseEnter={e => e.currentTarget.style.color = '#111827'}
                        onMouseLeave={e => e.currentTarget.style.color = '#374151'}>{v}</a>
                    </div>
                  ))}
                </div>
                <Clause code="M-8.2">Permission requests must be made in writing, must identify the requestor and their intended use in detail, and will be evaluated at the Author's sole discretion. Permission is never implied, deemed, or constructively granted.</Clause>
              </div>
            </Reveal>
          </section>

          {/* ── Parts Three–Six: Component Licenses ── */}
          <CompLicense id="part-three" partLabel="Part Three" title="PlanIt Frontend Application"
            accent="#3b82f6"
            coverage="Governs all access to and use of the PlanIt client-side React application. Covers every .jsx, .tsx, .css, .html, .json, and .js file in /frontend/src/ and its subdirectories, the Vite configuration, PWA configuration, all design assets, and the complete Visual Design System."
            defs={[['"Frontend Application" or "Software"','The PlanIt client-side web application in its entirety, encompassing all React component source files, context providers, consumer hooks, service modules, API client files, UI components, design tokens, Tailwind CSS configuration, custom CSS stylesheets, animation definitions, the Vite build configuration, PWA manifest, public/ directory assets, the complete Visual Design System, the white-label theming architecture, and all documentation and code comments.'],['"Author"','Aakshat Hariharan, the sole designer, architect, developer, and intellectual property owner of the Frontend Application.'],['"You" or "Licensee"','Any individual, developer, designer, engineer, researcher, student, company, organization, or other legal or natural person that accesses, views, reads, downloads, clones, compiles, executes, deploys, or otherwise interacts with the Frontend Application.'],['"Hosted Service"','The production deployment at planitapp.onrender.com and all associated white-label custom domains.'],['"Visual Design System"','The complete proprietary visual language including dark color palette, gradient definitions, glassmorphism treatments, ambient glow patterns, typography hierarchy, micro-interaction patterns, icon usage conventions, and overall aesthetic system.'],['"Derivative Work"','Any work derived from, copying, adapting, or substantially similar to the Frontend Application in code, design, architecture, or user experience.'],['"Commercial Use"','Any use in connection with any revenue-generating activity.'],['"Deploy"','To serve, host, publish, or make operational the Frontend Application on any infrastructure.'],['"Distribute"','To share, transfer, publish, or make available the Frontend Application to any third party.']]}
            grantLines={['2.1 The Author grants You a limited, personal, non-exclusive, non-transferable, non-sublicensable, revocable license to: (a) view the source code for personal educational reference; and (b) access and use the Hosted Service as an end-user.','2.2 White-label clients with executed agreements hold additional rights per those agreements only.','2.3 All rights not expressly granted are reserved by the Author.','2.4 The Author may revoke this license at any time without notice.']}
            restrictItems={['Copy, clone, mirror, or reproduce the Frontend Application;','Deploy the Frontend Application on any infrastructure;','Distribute the Frontend Application to any third party;','Modify or create any Derivative Work;','Reverse engineer any compiled or minified portion;','Use the Visual Design System for any other product\'s design;','Use any portion for Commercial Use;','Remove any copyright notices, license notices, or attributions;','Use "PlanIt" or "Aakshat Hariharan" without written consent;','Use automated tools to extract source code or content at scale;','Use source code in ML training datasets or code generation models;','Frame or embed the Hosted Service to misrepresent its origin;','Circumvent any technical enforcement mechanism.']}
            specialTitle="Intellectual Property Ownership"
            specialClauses={[['4.1','The Frontend Application and all constituent elements are the sole and exclusive property of the Author.'],['4.2','The Visual Design System constitutes protectable trade dress and confidential trade secret information of the Author.'],['4.3','The white-label theming architecture, including the WhiteLabelContext, heartbeat verification, and CSS variable injection, constitutes a proprietary technical system and trade secret.'],['4.4','Any feedback or input You provide is assigned to the Author in full without compensation.'],['4.5','Third-party open-source dependency copyrights remain with their respective owners. The Author\'s rights extend to original creative expression in how those dependencies are assembled and used.']]}
            closingNote="You agree to treat the source code, design decisions, component architecture, and all non-public aspects as strictly confidential and not to disclose any Confidential Information to any third party without the Author's prior written consent. Contact for permissions: planit.userhelp@gmail.com."
          />

          <CompLicense id="part-four" partLabel="Part Four" title="PlanIt Backend Application"
            accent="#7c3aed"
            coverage="Governs all access to and use of the PlanIt server-side Node.js/Express application. Covers every .js file in /backend/ and its subdirectories, including all route handlers, data models, middleware, service modules, configuration files, and the proprietary Cryptographic License Key System."
            defs={[['"Backend Application" or "Software"','The PlanIt server-side application in its entirety, including the main Express.js server, all route handlers (/routes/), all Mongoose data models (/models/), all middleware (/middleware/), all service modules (/services/), the Cryptographic License Key System, the white-label resolution and heartbeat enforcement system, the Socket.IO real-time layer, all configuration files, and all documentation and comments.'],['"Author"','Aakshat Hariharan, the sole architect, developer, and intellectual property owner of the Backend Application.'],['"You"','Any individual or entity interacting with the Backend Application in any way.'],['"Cryptographic License System"','The HMAC-SHA256-based license key generation and verification system, including the key format WL-{TIER}-{DOMAIN_HASH_8}-{EXPIRY_HEX}-{HMAC_12}, algorithm, domain hash function, expiry encoding scheme, and HMAC construction.'],['"Data Models"','All Mongoose schema definitions and associated business logic, constituting trade secrets of the Author.'],['"Derivative Work"','Any work derived from, reimplementing, or substantially similar to the Backend Application.'],['"Deploy"','To execute, run, or host the Backend Application on any computing infrastructure.'],['"Commercial Use"','Any use in connection with commercial activity.']]}
            grantLines={['2.1 The Author grants You a limited, personal, non-exclusive, non-transferable, non-sublicensable, revocable license to: (a) view the source code for personal educational reference; and (b) access the API Surface through the official frontend only, or as explicitly authorized in writing.','2.2 No right to Deploy, modify, distribute, or commercially exploit the Backend Application is granted.','2.3 All rights not expressly granted are reserved.']}
            restrictItems={['Deploy, execute, or host the Backend Application;','Copy, clone, or reproduce the Backend Application;','Distribute the Backend Application to any third party;','Modify or create any Derivative Work, including reimplementing the Data Models or Cryptographic License System;','Reverse engineer the Cryptographic License System;','Access the API Surface through any means other than the official frontend, except as explicitly authorized in writing;','Conduct penetration testing or vulnerability assessment without written authorization;','Access, extract, or aggregate any user data;','Use source code in ML training datasets or AI code generation models;','Circumvent any security mechanism;','Use Data Models as basis for a competing platform;','Use for Commercial Use without written license.']}
            specialTitle="Cryptographic License System — Special Provisions"
            specialClauses={[['4.1','The Cryptographic License System is the Author\'s proprietary invention and most sensitive trade secret. It constitutes both a copyrighted work and a trade secret under applicable law.'],['4.2','Any attempt to reverse engineer, bypass, spoof, or circumvent the Cryptographic License System constitutes trade secret misappropriation and may result in criminal liability under applicable computer fraud and abuse statutes.'],['4.3','The WL_LICENSE_SECRET and all related cryptographic secrets are inaccessible to You under any circumstance. Any known or suspected exposure must be reported immediately to planit.userhelp@gmail.com.']]}
            extraNotes={['5.1 Unauthorized access to the Backend Application or its databases constitutes a serious privacy violation and may trigger breach notification obligations under applicable data protection law including GDPR, CCPA, and similar statutes.','5.2 Security vulnerability reports must be submitted to planit.userhelp@gmail.com without public disclosure. Unauthorized public disclosure may constitute tortious interference.','5.3 You agree to comply with all applicable export control laws and regulations.']}
            closingNote="You agree not to use knowledge gained from accessing this source code to harm the Author, the PlanIt platform, its users, or any third party."
          />

          <CompLicense id="part-five" partLabel="Part Five" title="PlanIt Router Service"
            accent="#059669"
            coverage="Governs all access to and use of the PlanIt intelligent HTTP traffic orchestration layer. Covers every source file in the /router/ directory, the entire Routing Intelligence, the Mesh Protocol implementation, and all configuration and operational tooling."
            defs={[['"Router Service" or "Software"','The PlanIt HTTP routing and orchestration layer in its entirety, including all backend selection algorithms, health-check polling logic, maintenance intercept middleware, CORS management system, mesh authentication protocol, response caching layer, rate limiting configuration, health check aggregation, deploy hook configuration, backend fleet registry, WebSocket proxying configuration, and all documentation and comments.'],['"Author"','Aakshat Hariharan, the sole architect and owner.'],['"You"','Any individual or entity interacting with the Router Service.'],['"Routing Intelligence"','The proprietary scoring algorithm, health heuristics, boost mode logic, and all decision-making code governing backend instance selection — constituting trade secrets of the Author.'],['"Mesh Protocol"','The HMAC-based inter-service authentication system used for all communication between the Router Service and the Backend Fleet.'],['"Derivative Work"','Any work derived from or reimplementing any portion of the Router Service.'],['"Deploy"','To execute or host the Router Service on any infrastructure.'],['"Commercial Use"','Any use in connection with commercial activity.']]}
            grantLines={['2.1 The Author grants You a limited, personal, non-exclusive, non-transferable, non-sublicensable, revocable license to view the source code for personal educational reference only.','2.2 No deployment, modification, distribution, or commercial exploitation right is granted.','2.3 All rights not expressly granted are reserved.']}
            restrictItems={['Deploy or host the Router Service;','Copy or reproduce the Router Service;','Distribute the Router Service to any third party;','Modify or create any Derivative Work, including reimplementing the Routing Intelligence;','Benchmark or reverse engineer the Routing Intelligence for building a competing system;','Disclose any Confidential Information to any third party;','Probe, stress-test, or conduct load testing against the Hosted Infrastructure without written authorization;','Forge or bypass Mesh Protocol authentication headers;','Use source code in ML training datasets;','Remove copyright notices;','Use for Commercial Use without written license.']}
            specialTitle="Routing Intelligence as Trade Secret"
            specialClauses={[['4.1','The Routing Intelligence constitutes a proprietary system developed through substantial engineering investment. The specific combination of health-check scoring weights, backend alive-state hysteresis logic, boost mode thresholds, and maintenance exemption categorization are not publicly known and provide the Author with a competitive advantage.'],['4.2','Your obligation to maintain the confidentiality of the Routing Intelligence survives termination of this Agreement indefinitely.']]}
            closingNote="You agree not to take any action that could degrade, disrupt, or damage the Hosted Infrastructure or Backend Fleet, including DDoS attacks, traffic flooding, or manipulation of load-balancing behavior."
          />

          <CompLicense id="part-six" partLabel="Part Six" title="PlanIt Watchdog Service"
            accent="#d97706"
            coverage="Governs all access to and use of the PlanIt autonomous infrastructure monitoring daemon. Covers every source file in the /watchdog/ directory, the Monitoring Intelligence, alert routing logic, uptime aggregation system, and all operational data generated by the Watchdog Service."
            defs={[['"Watchdog Service" or "Software"','The PlanIt autonomous monitoring daemon in its entirety, including all health-check polling logic, incident lifecycle management, alert routing and deduplication system, uptime history aggregation, status page data API, mesh-authenticated endpoints, auto-promotion of scheduled maintenance, and all configuration, operational documentation, and comments.'],['"Author"','Aakshat Hariharan, the sole designer and owner.'],['"You"','Any individual or entity interacting with the Watchdog Service.'],['"Monitoring Intelligence"','The proprietary heuristics, thresholds, timing parameters, and decision logic governing incident detection, severity classification, alert routing, and uptime aggregation — constituting trade secrets of the Author.'],['"Operational Data"','Uptime records, incident logs, and alert histories generated during operation, owned exclusively by the Author.'],['"Derivative Work"','Any monitoring tool derived from or reimplementing the Watchdog Service.'],['"Deploy"','To execute or host the Watchdog Service on any infrastructure.'],['"Commercial Use"','Any use in connection with commercial activity.']]}
            grantLines={['2.1 The Author grants You a limited, personal, non-exclusive, non-transferable, non-sublicensable, revocable license to view the source code for personal educational reference only.','2.2 No deployment, modification, distribution, or commercial exploitation right is granted.','2.3 All rights not expressly granted are reserved.']}
            restrictItems={['Deploy or operate the Watchdog Service;','Copy or reproduce the Watchdog Service;','Distribute the Watchdog Service;','Modify or create any Derivative Work, including adapting the Monitoring Intelligence;','Disclose Monitoring Intelligence to any third party;','Access status API endpoints except through the official status page;','Interfere with, disable, or circumvent the Watchdog Service;','Generate false health signals or corrupt monitoring data;','Use source code in ML training datasets;','Remove copyright notices;','Access, export, or aggregate Operational Data without authorization;','Use for Commercial Use without written license.']}
            specialTitle="Monitoring Intelligence as Trade Secret"
            specialClauses={[['4.1','The Monitoring Intelligence — polling intervals, failure thresholds, incident severity rules, alert suppression cooldowns, uptime aggregation methodology — constitutes trade secrets developed through operational experience running the PlanIt platform. These parameters are not derivable from generic monitoring best practices.'],['4.2','Your confidentiality obligation with respect to the Monitoring Intelligence survives termination of this Agreement indefinitely.']]}
            closingNote="You agree not to flood or abuse the ntfy.sh or Discord alert channels used by the Watchdog Service, and not to take any action designed to suppress, delay, or corrupt incident detection or alert delivery."
          />

          {/* ── Part Seven: Closing ── */}
          <section id="part-seven" style={{ scrollMarginTop: '72px', paddingBottom: '3rem' }}>
            <Reveal>
              <PartHead id="part-seven" partLabel="Part Seven" title="Consolidated Closing Provisions"
                subtitle="This Master Agreement, together with the four individual component license agreements reproduced in Parts Three through Six above, constitutes the complete and exclusive statement of the intellectual property rights and licensing terms governing the PlanIt platform and all of its components." />

              <SubHeading title="Consolidated Ownership Statement" />
              <p style={P}>Every line of source code, every design decision, every data model, every algorithm, every configuration file, every comment, and every architectural choice across all four components of the PlanIt platform is the original creative work and exclusive property of Aakshat Hariharan. No co-author, contributor, employer, client, or third party holds any ownership interest in any portion of the PlanIt platform. The Author created this platform independently, owns it outright, and licenses it exclusively on the terms set out above.</p>

              <SubHeading title="Summary — What Is and Is Not Permitted" />
              <p style={{ ...SM, color: '#6b7280' }}>Convenience summary only — does not supersede or limit the full terms above:</p>
              <PermSummary />

              <SubHeading title="Violation Reporting" />
              <p style={P}>If You become aware of any violation of this Master Agreement or any individual component license — including unauthorized forks, deployments, or distributions of any PlanIt component — please report it to:</p>
              <a href="mailto:planit.userhelp@gmail.com" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '0.65rem 0.9rem', textDecoration: 'none', fontSize: '0.84rem', color: '#374151', fontWeight: 500, transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.borderColor = '#d1d5db'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#f9fafb'; e.currentTarget.style.borderColor = '#e5e7eb'; }}>
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                planit.userhelp@gmail.com — Subject: License Violation Report
              </a>
              <p style={{ ...SM, color: '#6b7280', marginTop: '0.75rem' }}>The Author takes intellectual property violations seriously and will pursue all available legal remedies against unauthorized uses of the PlanIt platform.</p>

              <SubHeading title="Acknowledgment" />
              <p style={{ ...SM, color: '#6b7280' }}>By accessing any component of the PlanIt platform, You acknowledge that:</p>
              <ol style={{ margin: '0.5rem 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {['You have read this Master Agreement in its entirety;', 'You understand its terms;', 'You agree to be legally bound by all of its provisions;', 'You have the legal capacity and authority to enter into this Agreement;', 'If You are accessing on behalf of an organization, You have authority to bind that organization to these terms; and', 'You acknowledge that this Agreement is enforceable against You.'].map((text, i) => (
                  <li key={i} style={{ display: 'flex', gap: '0.85rem', padding: '0.45rem 0.75rem', background: '#f9fafb', borderRadius: '6px', alignItems: 'flex-start' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#9ca3af', flexShrink: 0, paddingTop: '0.22rem' }}>({i + 1})</span>
                    <span style={{ ...SM, margin: 0 }}>{text}</span>
                  </li>
                ))}
              </ol>

              {/* Footer */}
              <div style={{ marginTop: '3rem', paddingTop: '1.5rem', borderTop: '1px solid #e5e7eb', textAlign: 'center' }}>
                <p style={{ fontSize: '0.84rem', fontWeight: 600, color: '#374151', margin: '0 0 0.35rem' }}>Copyright © 2026 Aakshat Hariharan. All Rights Reserved.</p>
                <p style={{ fontSize: '0.78rem', color: '#9ca3af', lineHeight: 1.7, maxWidth: '480px', margin: '0 auto 1.25rem' }}>All four components — Frontend, Backend, Router, and Watchdog — are protected by copyright law and trade secret law. Unauthorized use, copying, deployment, or distribution is strictly prohibited.</p>
                <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'center' }}>
                  {[['planitapp.onrender.com', 'https://planitapp.onrender.com'], ['planit.userhelp@gmail.com', 'mailto:planit.userhelp@gmail.com']].map(([label, href]) => (
                    <a key={label} href={href} style={{ fontSize: '0.78rem', color: '#6b7280', textDecoration: 'none', borderBottom: '1px solid #e5e7eb', paddingBottom: '1px', transition: 'color 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.color = '#374151'}
                      onMouseLeave={e => e.currentTarget.style.color = '#6b7280'}>{label}</a>
                  ))}
                </div>
              </div>
            </Reveal>
          </section>

        </main>
      </div>

      <LexChat />
    </div>
  );
}
