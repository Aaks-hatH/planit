import { useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'platform', label: 'Platform Overview' },
  { id: 'component-a', label: '↳ Frontend' },
  { id: 'component-b', label: '↳ Backend' },
  { id: 'component-c', label: '↳ Router' },
  { id: 'component-d', label: '↳ Watchdog' },
  { id: 'overarching', label: 'Overarching Terms' },
  { id: 'ownership', label: '↳ Ownership' },
  { id: 'scope', label: '↳ Scope' },
  { id: 'license-grant', label: '↳ License Grant' },
  { id: 'restrictions', label: '↳ Restrictions' },
  { id: 'no-open-source', label: '↳ No Open Source' },
  { id: 'disclaimers', label: '↳ Disclaimers' },
  { id: 'governing-law', label: '↳ Governing Law' },
  { id: 'contact', label: '↳ Contact' },
  { id: 'frontend-license', label: 'Frontend License' },
  { id: 'backend-license', label: 'Backend License' },
  { id: 'router-license', label: 'Router License' },
  { id: 'watchdog-license', label: 'Watchdog License' },
  { id: 'closing', label: 'Closing Provisions' },
];

function useScrollProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const el = document.documentElement;
      const scrolled = el.scrollTop;
      const total = el.scrollHeight - el.clientHeight;
      setProgress(total > 0 ? (scrolled / total) * 100 : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return progress;
}

function useActiveSection(ids) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const map = new Map();
    const observers = ids.map(id => {
      const el = document.getElementById(id);
      if (!el) return null;
      const obs = new IntersectionObserver(
        ([entry]) => {
          map.set(id, entry.intersectionRatio);
          let best = null, bestRatio = -1;
          map.forEach((ratio, key) => { if (ratio > bestRatio) { bestRatio = ratio; best = key; } });
          if (best) setActive(best);
        },
        { rootMargin: '-20% 0px -60% 0px', threshold: [0, 0.1, 0.5, 1] }
      );
      obs.observe(el);
      return obs;
    });
    return () => observers.forEach(o => o && o.disconnect());
  }, []);
  return active;
}

function useReveal() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.07 }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return [ref, visible];
}

function Reveal({ children, delay = 0, className = '' }) {
  const [ref, visible] = useReveal();
  return (
    <div ref={ref} className={className} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(24px)',
      transition: `opacity 0.6s ease ${delay}ms, transform 0.6s cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
    }}>
      {children}
    </div>
  );
}

function Anchor({ id }) {
  return <div id={id} style={{ scrollMarginTop: '88px' }} />;
}

function PartHeader({ part, title, subtitle, accent }) {
  return (
    <Reveal>
      <div style={{ marginBottom: '2.5rem', paddingBottom: '1.75rem', borderBottom: `3px solid ${accent}` }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', background: accent + '15', border: `1px solid ${accent}40`, borderRadius: '999px', padding: '0.3rem 0.9rem' }}>
          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: accent }} />
          <span style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: accent }}>Part {part}</span>
        </div>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(1.5rem, 3vw, 2.2rem)', fontWeight: 700, color: '#0f172a', lineHeight: 1.2, margin: '0 0 0.6rem' }}>{title}</h2>
        {subtitle && <p style={{ fontSize: '0.875rem', color: '#64748b', lineHeight: 1.7, maxWidth: '680px', margin: 0 }}>{subtitle}</p>}
      </div>
    </Reveal>
  );
}

function SectionHead({ code, title }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', margin: '2.75rem 0 1rem' }}>
      {code && <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.68rem', color: '#94a3b8', background: '#f1f5f9', padding: '0.25rem 0.6rem', borderRadius: '5px', flexShrink: 0 }}>{code}</span>}
      <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.2rem', fontWeight: 700, color: '#1e293b', margin: 0 }}>{title}</h3>
    </div>
  );
}

function Callout({ variant = 'info', children }) {
  const v = {
    warning: { bg: '#fffbeb', border: '#fde68a', left: '#f59e0b', icon: '⚠', text: '#92400e' },
    danger:  { bg: '#fef2f2', border: '#fecaca', left: '#ef4444', icon: '!', text: '#7f1d1d' },
    info:    { bg: '#eff6ff', border: '#bfdbfe', left: '#3b82f6', icon: 'i', text: '#1e3a5f' },
    neutral: { bg: '#f8fafc', border: '#e2e8f0', left: '#94a3b8', icon: '§', text: '#334155' },
  }[variant];
  return (
    <div style={{ background: v.bg, border: `1px solid ${v.border}`, borderLeft: `4px solid ${v.left}`, borderRadius: '10px', padding: '1rem 1.25rem', display: 'flex', gap: '0.85rem', margin: '1.25rem 0' }}>
      <span style={{ color: v.left, fontSize: '0.75rem', fontWeight: 900, flexShrink: 0, marginTop: '0.1rem', width: '1.1rem', height: '1.1rem', background: v.left + '20', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{v.icon}</span>
      <div style={{ fontSize: '0.86rem', color: v.text, lineHeight: 1.75 }}>{children}</div>
    </div>
  );
}

function Clause({ code, children }) {
  const [hov, setHov] = useState(false);
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{ display: 'flex', gap: '1rem', padding: '0.7rem 0.9rem', borderRadius: '8px', background: hov ? '#f8fafc' : 'transparent', transition: 'background 0.18s', cursor: 'default' }}>
      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.68rem', color: '#94a3b8', flexShrink: 0, paddingTop: '0.22rem', minWidth: '3.8rem' }}>{code}</span>
      <span style={{ fontSize: '0.875rem', color: '#334155', lineHeight: 1.8 }}>{children}</span>
    </div>
  );
}

function RestrictList({ items }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.75rem' }}>
      {items.map((text, i) => (
        <div key={i} style={{ display: 'flex', gap: '0.85rem', padding: '0.55rem 0.9rem', borderRadius: '7px', alignItems: 'flex-start' }}
          onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.68rem', color: '#94a3b8', flexShrink: 0, paddingTop: '0.25rem' }}>({String.fromCharCode(97 + i)})</span>
          <span style={{ fontSize: '0.875rem', color: '#334155', lineHeight: 1.75 }}>{text}</span>
        </div>
      ))}
    </div>
  );
}

function DefItem({ term, children }) {
  return (
    <div style={{ display: 'flex', gap: '1.25rem', padding: '0.9rem 0', borderBottom: '1px solid #f1f5f9' }}>
      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '0.76rem', fontWeight: 500, color: '#6366f1', minWidth: '9rem', flexShrink: 0, paddingTop: '0.15rem' }}>"{term}"</span>
      <span style={{ fontSize: '0.875rem', color: '#334155', lineHeight: 1.75 }}>{children}</span>
    </div>
  );
}

function ComponentCard({ anchor, letter, title, accent, bg, description, points, proprietary }) {
  const [hov, setHov] = useState(false);
  return (
    <>
      <Anchor id={anchor} />
      <Reveal>
        <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{
          background: hov ? '#fff' : bg,
          border: `1px solid ${accent}30`,
          borderLeft: `5px solid ${accent}`,
          borderRadius: '16px',
          padding: '2rem',
          marginBottom: '1.5rem',
          boxShadow: hov ? `0 8px 32px ${accent}18` : '0 1px 4px rgba(0,0,0,0.04)',
          transition: 'all 0.3s cubic-bezier(0.16,1,0.3,1)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.1rem' }}>
            <div style={{ width: '2.4rem', height: '2.4rem', borderRadius: '10px', background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: '1rem', flexShrink: 0, boxShadow: `0 4px 14px ${accent}45` }}>{letter}</div>
            <div>
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', margin: 0, lineHeight: 1.2 }}>{title}</h3>
              <span style={{ fontSize: '0.7rem', color: accent, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Component {letter}</span>
            </div>
          </div>
          <p style={{ fontSize: '0.875rem', color: '#475569', lineHeight: 1.8, marginBottom: '1.25rem' }}>{description}</p>
          <ul style={{ margin: '0 0 1.25rem', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            {points.map((p, i) => (
              <li key={i} style={{ display: 'flex', gap: '0.7rem', fontSize: '0.84rem', color: '#475569', lineHeight: 1.7 }}>
                <span style={{ color: accent, flexShrink: 0, fontSize: '0.55rem', marginTop: '0.4rem' }}>◆</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
          <div style={{ borderTop: `1px solid ${accent}20`, paddingTop: '1.1rem' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: accent }}>Why It's Proprietary</span>
            <p style={{ fontSize: '0.84rem', color: '#475569', lineHeight: 1.75, margin: '0.4rem 0 0' }}>{proprietary}</p>
          </div>
        </div>
      </Reveal>
    </>
  );
}

function PermGrid() {
  const yes = ['Reading source code for personal educational reference', 'Using the Hosted Service at planitapp.onrender.com as an end-user', 'Discussing the platform publicly in factual, non-misleading terms', 'Reporting security vulnerabilities responsibly to the Author'];
  const no = ['Deploying any component on any infrastructure', 'Copying, cloning, or forking any component', 'Distributing any component to any third party', 'Creating any Derivative Work from any component', 'Using any component for Commercial Use', 'Removing copyright or "Powered by PlanIt" attributions', 'Using the PlanIt name or logo without consent', 'Reverse engineering any security or cryptographic mechanism', 'Using source code in ML or AI training datasets', 'Conducting penetration testing of the Hosted Service'];
  return (
    <Reveal>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginTop: '1.25rem' }}>
        {[{ label: '✓ Permitted Without Permission', color: '#16a34a', bg: '#f0fdf4', border: '#86efac', items: yes, icon: '✓', iconBg: '#22c55e' },
          { label: '✕ Requires Written Permission', color: '#dc2626', bg: '#fef2f2', border: '#fca5a5', items: no, icon: '✕', iconBg: '#ef4444' }].map(({ label, color, bg, border, items, icon, iconBg }) => (
          <div key={label} style={{ background: bg, border: `1px solid ${border}`, borderRadius: '14px', padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.1rem' }}>
              <span style={{ background: iconBg, color: '#fff', borderRadius: '50%', width: '1.5rem', height: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800, flexShrink: 0 }}>{icon}</span>
              <span style={{ fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color }}>{label.replace(/^[✓✕] /, '')}</span>
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
              {items.map((t, i) => (
                <li key={i} style={{ display: 'flex', gap: '0.55rem', fontSize: '0.84rem', color, lineHeight: 1.55 }}>
                  <span style={{ flexShrink: 0 }}>{icon}</span><span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Reveal>
  );
}

function CompLicense({ id, partNum, title, accent, coverage, defs, grantLines, restrictItems, specialTitle, specialItems, closingText, extraItems }) {
  return (
    <section id={id} style={{ marginBottom: '6rem' }}>
      <Anchor id={id} />
      <PartHeader part={partNum} title={`${title} — License Agreement`} subtitle={coverage} accent={accent} />

      <Reveal>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '1rem', marginBottom: '2rem' }}>
          {[['License Version', 'v2.0 — January 2026'], ['Copyright', '© 2026 Aakshat Hariharan'], ['Status', 'Proprietary — All Rights Reserved']].map(([k, v]) => (
            <div key={k} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.9rem 1.1rem' }}>
              <p style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#94a3b8', margin: '0 0 0.25rem' }}>{k}</p>
              <p style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1e293b', margin: 0 }}>{v}</p>
            </div>
          ))}
        </div>
      </Reveal>

      <Callout variant="warning">
        <strong>IMPORTANT — READ THIS ENTIRE AGREEMENT CAREFULLY</strong> before accessing, viewing, downloading, cloning, compiling, executing, or otherwise interacting with the {title} or any portion thereof. This Agreement takes effect at the earliest moment You interact with this software in any form — including the act of reading this source code. The public availability of this source code does NOT constitute an open-source release, a public domain dedication, an implied license, or consent to use for any purpose beyond the narrow rights expressly granted.
      </Callout>

      <Reveal delay={40}><SectionHead code="§ 1" title="Definitions" />
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '0.5rem 1.25rem 0.5rem' }}>
          {defs.map(([t, d]) => <DefItem key={t} term={t}>{d}</DefItem>)}
        </div>
      </Reveal>

      <Reveal delay={60}><SectionHead code="§ 2" title="Grant of Limited License" />
        <div style={{ background: '#f8fafc', borderRadius: '10px', padding: '1.25rem 1.5rem', fontSize: '0.875rem', color: '#334155', lineHeight: 1.85 }}>
          {grantLines.map((line, i) => <p key={i} style={{ margin: i < grantLines.length - 1 ? '0 0 0.65rem' : 0 }}>{line}</p>)}
        </div>
      </Reveal>

      <Reveal delay={80}><SectionHead code="§ 3" title="Restrictions on Use" />
        <p style={{ fontSize: '0.875rem', color: '#475569', marginLeft: '0.9rem', marginBottom: '0.25rem' }}>Without prior explicit written permission from the Author, You must NOT:</p>
        <RestrictList items={restrictItems} />
      </Reveal>

      <Reveal delay={100}><SectionHead code="§ 4" title={specialTitle} />
        <div style={{ background: '#fff8f0', border: `1px solid ${accent}30`, borderLeft: `4px solid ${accent}`, borderRadius: '10px', padding: '0.5rem 0.5rem 0.5rem 1rem' }}>
          {specialItems.map(([code, text]) => <Clause key={code} code={code}>{text}</Clause>)}
        </div>
      </Reveal>

      {extraItems && (
        <Reveal delay={110}><SectionHead code="§ 5" title="Data, Privacy & Security Obligations" />
          <div style={{ fontSize: '0.875rem', color: '#334155', lineHeight: 1.8 }}>
            {extraItems.map((t, i) => <p key={i} style={{ marginBottom: i < extraItems.length - 1 ? '0.65rem' : 0 }}>{t}</p>)}
          </div>
        </Reveal>
      )}

      <Reveal delay={120}><SectionHead code={extraItems ? '§ 6–11' : '§ 5–11'} title="Confidentiality, Warranties, Liability, Indemnification, Termination, Enforcement & General Provisions" />
        <div style={{ fontSize: '0.875rem', color: '#475569', lineHeight: 1.8, marginBottom: '1rem' }}>{closingText}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '0.75rem' }}>
          {[['Warranty Disclaimer', 'Provided "AS IS" without warranty of any kind. The Author disclaims all warranties to the maximum extent permitted by applicable law.'], ['Liability Cap', "The Author's total liability shall not exceed USD $100.00 under any circumstances whatsoever."], ['Indemnification', 'You agree to indemnify and hold harmless the Author from any claims arising from Your breach of this Agreement.'], ['Termination', 'Effective from first access. Breach causes immediate termination. You must cease all use and permanently delete all copies upon termination.'], ['Injunctive Relief', 'The Author is entitled to seek injunctive relief without bond for any unauthorized use of the Software.'], ['Governing Law', "Governed by the laws of the jurisdiction of the Author's residence. No assignment without Author's written consent."]].map(([t, d]) => (
            <div key={t} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem 1.1rem' }}>
              <p style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#94a3b8', margin: '0 0 0.35rem' }}>{t}</p>
              <p style={{ fontSize: '0.82rem', color: '#475569', lineHeight: 1.65, margin: 0 }}>{d}</p>
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

export default function License() {
  const navigate = useNavigate();
  const progress = useScrollProgress();
  const activeSection = useActiveSection(SECTIONS.map(s => s.id));

  const scrollTo = id => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,900;1,400&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        html{scroll-behavior:smooth;}
        ::-webkit-scrollbar{width:5px;}
        ::-webkit-scrollbar-track{background:#f1f5f9;}
        ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:99px;}
        ::-webkit-scrollbar-thumb:hover{background:#94a3b8;}
        @keyframes fadeIn{from{opacity:0;transform:translateY(-10px);}to{opacity:1;transform:translateY(0);}}
        @media(max-width:1080px){.lic-sidebar{display:none!important;}.lic-main{margin-left:0!important;}}
        @media(max-width:660px){.perm-grid{grid-template-columns:1fr!important;}.meta-row{grid-template-columns:1fr 1fr!important;}.comp-meta{grid-template-columns:1fr!important;}}
      `}</style>

      {/* Progress bar */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: '3px', zIndex: 1001, background: '#e2e8f0' }}>
        <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg,#3b82f6,#6366f1,#8b5cf6)', transition: 'width 0.1s linear', boxShadow: '0 0 12px rgba(99,102,241,0.5)' }} />
      </div>

      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(14px)', borderBottom: '1px solid #e2e8f0', padding: '0.8rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 16px rgba(0,0,0,0.05)', animation: 'fadeIn 0.4s ease' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.42rem 0.85rem', cursor: 'pointer', fontSize: '0.82rem', color: '#475569', fontWeight: 500, transition: 'all 0.18s', fontFamily: 'inherit' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#e2e8f0'; e.currentTarget.style.color = '#1e293b'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.color = '#475569'; }}>
            <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
            Back
          </button>
          <div style={{ width: 1, height: '1.2rem', background: '#e2e8f0' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <svg width="15" height="15" fill="none" stroke="#6366f1" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>License Agreement</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500, letterSpacing: '0.03em' }}>v2.0 · January 2026</span>
          <span style={{ background: 'linear-gradient(135deg,#1e293b,#334155)', color: '#e2e8f0', fontSize: '0.65rem', fontWeight: 800, padding: '0.28rem 0.75rem', borderRadius: '999px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>All Rights Reserved</span>
        </div>
      </header>

      <div style={{ display: 'flex', maxWidth: '1300px', margin: '0 auto', padding: '0 1.5rem' }}>

        {/* Sidebar */}
        <aside className="lic-sidebar" style={{ width: '220px', flexShrink: 0, position: 'sticky', top: '74px', height: 'calc(100vh - 74px)', overflowY: 'auto', padding: '2.5rem 1.25rem 2.5rem 0' }}>
          <p style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: '0.6rem' }}>Contents</p>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.05rem' }}>
            {SECTIONS.map(({ id, label }) => {
              const active = activeSection === id;
              const nested = label.startsWith('↳');
              return (
                <button key={id} onClick={() => scrollTo(id)} style={{ all: 'unset', display: 'block', padding: nested ? '0.28rem 0.7rem 0.28rem 1.2rem' : '0.35rem 0.7rem', borderRadius: '0 7px 7px 0', borderLeft: `2px solid ${active ? '#6366f1' : 'transparent'}`, background: active ? 'linear-gradient(90deg,#eff6ff,#eef2ff)' : 'transparent', fontSize: nested ? '0.75rem' : '0.8rem', color: active ? '#4338ca' : nested ? '#94a3b8' : '#475569', fontWeight: active ? 600 : nested ? 400 : 500, cursor: 'pointer', transition: 'all 0.18s', lineHeight: 1.5, fontFamily: "'DM Sans', sans-serif" }}
                  onMouseEnter={e => !active && (e.currentTarget.style.color = '#1d4ed8')}
                  onMouseLeave={e => !active && (e.currentTarget.style.color = nested ? '#94a3b8' : '#475569')}>
                  {nested ? label.replace('↳ ', '') : label}
                </button>
              );
            })}
          </nav>
          <div style={{ marginTop: '2rem', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem' }}>
            <p style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#94a3b8', margin: '0 0 0.45rem' }}>Contact</p>
            <a href="mailto:planit.userhelp@gmail.com" style={{ fontSize: '0.76rem', color: '#6366f1', textDecoration: 'none', lineHeight: 1.5, wordBreak: 'break-all', display: 'block' }}>planit.userhelp@gmail.com</a>
          </div>
        </aside>

        {/* Main */}
        <main className="lic-main" style={{ flex: 1, minWidth: 0, marginLeft: '2.5rem', paddingTop: '3.5rem', paddingBottom: '6rem' }}>

          {/* ═══ HERO ═══ */}
          <Anchor id="overview" />
          <div style={{ marginBottom: '4rem' }}>
            <div style={{ position: 'relative', background: 'linear-gradient(135deg,#eff6ff 0%,#eef2ff 55%,#faf5ff 100%)', border: '1px solid #c7d2fe', borderRadius: '22px', padding: '3.5rem', overflow: 'hidden', animation: 'fadeIn 0.7s ease' }}>
              <div style={{ position: 'absolute', top: '-80px', right: '-80px', width: '280px', height: '280px', background: 'radial-gradient(circle,#bfdbfe35,transparent)', borderRadius: '50%', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', bottom: '-60px', left: '-60px', width: '200px', height: '200px', background: 'radial-gradient(circle,#c7d2fe28,transparent)', borderRadius: '50%', pointerEvents: 'none' }} />
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '1.75rem' }}>
                  {[['Master License Agreement', '#6366f1', '#fff'], ['Consolidated IP Declaration', '#e0e7ff', '#4338ca'], ['Version 2.0', '#f0fdf4', '#15803d'], ['January 2026', '#fafafa', '#475569']].map(([t, bg, color]) => (
                    <span key={t} style={{ background: bg, color, fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.1em', padding: '0.3rem 0.85rem', borderRadius: '999px', textTransform: 'uppercase', border: `1px solid ${color}22` }}>{t}</span>
                  ))}
                </div>
                <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(2rem,5vw,3.6rem)', fontWeight: 900, lineHeight: 1.08, color: '#0f172a', marginBottom: '1rem', letterSpacing: '-0.01em' }}>
                  PlanIt Platform<br />
                  <span style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1,#8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>License &amp; IP Declaration</span>
                </h1>
                <p style={{ fontSize: '0.95rem', color: '#475569', lineHeight: 1.8, maxWidth: '600px', marginBottom: '2.25rem' }}>
                  This Master License Agreement is the single authoritative legal instrument governing all intellectual property rights in and to the PlanIt platform — a proprietary event management and white-label SaaS platform created, owned, and operated solely by Aakshat Hariharan.
                </p>
                <div className="meta-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.85rem' }}>
                  {[['📋 Copyright', '© 2026 Aakshat Hariharan'], ['🧩 Components', '4 (Frontend, Backend, Router, Watchdog)'], ['✉ Contact', 'planit.userhelp@gmail.com']].map(([k, v]) => (
                    <div key={k} style={{ background: 'rgba(255,255,255,0.82)', borderRadius: '10px', padding: '0.85rem 1rem', border: '1px solid rgba(255,255,255,0.95)', backdropFilter: 'blur(8px)' }}>
                      <p style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#94a3b8', margin: '0 0 0.25rem' }}>{k}</p>
                      <p style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1e293b', margin: 0, wordBreak: 'break-word' }}>{v}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <Callout variant="danger">
              <strong>BY ACCESSING THE REPOSITORY CONTAINING ANY COMPONENT OF THE PLANIT PLATFORM, VIEWING ANY SOURCE CODE FILE, CLONING OR FORKING THE REPOSITORY, RUNNING ANY COMPONENT LOCALLY, OR USING THE HOSTED SERVICE AT PLANITAPP.ONRENDER.COM, YOU AGREE TO BE LEGALLY BOUND BY THIS MASTER AGREEMENT AND BY EACH INDIVIDUAL COMPONENT LICENSE THAT APPLIES TO THE PORTION OF THE SOFTWARE YOU ARE ACCESSING.</strong> IF YOU DO NOT AGREE TO THESE TERMS, IMMEDIATELY CEASE ALL INTERACTION WITH THE PLANIT PLATFORM IN ANY FORM.
            </Callout>

            <Reveal delay={80}>
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '1.5rem 1.75rem', marginTop: '1.25rem' }}>
                <p style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: '1rem' }}>This Document Serves Three Purposes</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
                  {[['FIRST', '#3b82f6', 'It explains in plain terms what each component of the PlanIt platform is, what it does, and why it is protected.'], ['SECOND', '#6366f1', 'It sets out the overarching licensing terms that apply across all components of the platform as a unified whole.'], ['THIRD', '#8b5cf6', 'It reproduces in full each individual component license agreement, so that the complete legal terms for every part of the platform are accessible in a single place.']].map(([label, color, text]) => (
                    <div key={label} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                      <span style={{ background: `linear-gradient(135deg,${color},${color}aa)`, color: '#fff', fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.08em', padding: '0.25rem 0.65rem', borderRadius: '999px', flexShrink: 0, marginTop: '0.2rem', textTransform: 'uppercase' }}>{label}</span>
                      <p style={{ fontSize: '0.875rem', color: '#475569', lineHeight: 1.75, margin: 0 }}>{text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>

          {/* ═══ PART ONE: Platform Overview ═══ */}
          <section style={{ marginBottom: '5rem' }}>
            <Anchor id="platform" />
            <PartHeader part="One" title="The PlanIt Platform — An Overview" subtitle="Understanding what you are licensing before reading the terms. The PlanIt platform is not a single application — it is a multi-service distributed system comprising four distinct software components, each separately developed, separately deployed, and separately owned by the Author." accent="#3b82f6" />

            <ComponentCard anchor="component-a" letter="A" title="The Frontend Application" accent="#3b82f6" bg="#eff6ff"
              description="The PlanIt Frontend Application is the client-side web application that users interact with directly. Built with React and Vite, served as a single-page application at planitapp.onrender.com."
              points={['THE PUBLIC-FACING EXPERIENCE: The PlanIt homepage (event creation form, venue mode, branch selector), the event discovery page, and all publicly accessible marketing and informational pages.', 'THE EVENT MANAGEMENT INTERFACE: The EventSpace — the rich, real-time event dashboard through which organizers manage attendees, run chat, conduct polls, share files, manage seating charts, track budgets, post announcements, and view analytics.', 'THE ADMIN PANEL: A password-protected multi-section administrative interface through which the Author manages all events, white-label clients, billing, employees, incident reporting, system settings, and security monitoring across the entire platform.', 'THE WHITE-LABEL CLIENT PORTAL: A self-service portal (/dashboard) accessible on white-label custom domains, allowing paying white-label clients to customize their platform\'s branding, page content, feature flags, and security settings.', 'THE WHITE-LABEL THEMING SYSTEM: A dynamic CSS variable injection architecture that transforms the application\'s visual identity at runtime based on a white-label client\'s branding configuration (colors, fonts, logo, company name), allowing a single React application to serve hundreds of differently-branded instances.', 'THE WHITE-LABEL HOME PAGE (WLHome): A branded landing page served at the root URL of white-label custom domains, showing the client\'s own hero content, event discovery feed scoped to their tenant, and contact information — without any PlanIt branding where the client has configured hidePoweredBy.', 'THE RESERVATION SYSTEM: The ReservePage and associated flows through which guests discover, reserve, and receive confirmation for event spots, with white-label customizable messaging throughout.', 'ADDITIONAL FLOWS: Public ticket pages, waitlist signup, organizer login, table service interfaces for venue mode, check-in kiosks, QR-code-based guest invite flows, invitation badge and card generators, and support flows.', 'THE DESIGN SYSTEM: A complete, proprietary visual language — dark-mode first, built on a near-black (#080810) base, with blue-to-indigo gradients, ambient radial glow orbs as decorative backgrounds, glassmorphism card treatments, and a distinctive micro-interaction vocabulary — that constitutes protectable trade dress.', 'THE WHITE-LABEL CONTEXT: A React context provider (WhiteLabelContext) that wraps the entire application, performing domain detection, branding resolution via /api/whitelabel/resolve, cryptographic heartbeat verification via /api/whitelabel/heartbeat, and periodic re-enforcement — all at application startup and continuously while the app is running.']}
              proprietary="The Frontend Application is the product of an enormous amount of creative design and engineering work. Its value lies not just in the code, but in the decisions: which components to build, how they interact, what the user experience flows feel like, how the white-label system works architecturally, and what the visual design language communicates. Taken as a whole, the Frontend Application constitutes both a copyrighted work and protectable trade dress. Individual components, when extracted, still carry the Author's copyright and may not be used without permission."
            />

            <ComponentCard anchor="component-b" letter="B" title="The Backend Application" accent="#8b5cf6" bg="#faf5ff"
              description="The PlanIt Backend Application is the server-side engine of the platform, built on Node.js and Express.js and deployed as a fleet of five identical instances named Maverick, Goose, Iceman, Slider, and Viper."
              points={['THE EVENT MANAGEMENT ENGINE: All API endpoints for creating, reading, updating, and deleting events; managing participants; handling RSVP flows; processing file uploads to Cloudinary; managing real-time chat via Socket.IO; conducting polls; and executing all other event-related business operations.', 'THE AUTHENTICATION AND AUTHORIZATION SYSTEM: JWT-based authentication with per-role authorization (organizer, staff, guest, admin), bcrypt password hashing, secure token generation, and the admin credential verification system.', 'THE WHITE-LABEL MANAGEMENT API: All endpoints for creating, managing, suspending, renewing, and configuring white-label client accounts, including the /resolve endpoint (which identifies a custom domain and returns its branding configuration) and the /heartbeat endpoint (which verifies that a white-label license is currently valid and active).', 'THE CRYPTOGRAPHIC LICENSE KEY SYSTEM: A proprietary HMAC-SHA256-based license key generation and verification system with the format WL-{TIER}-{DOMAIN_HASH_8}-{EXPIRY_HEX}-{HMAC_12}. This system allows the backend to issue tamper-evident license keys to white-label clients and to verify their authenticity without a database lookup.', 'THE WHITE-LABEL CLIENT PORTAL API: Authenticated endpoints (/api/wl-portal/*) for white-label clients to log in, update branding configuration, customize page content, toggle feature flags, change their portal password, and review their login audit log.', 'THE SECURITY MIDDLEWARE LAYER (trafficGuard): A comprehensive request inspection and traffic management middleware providing IP-based rate limiting, suspicious request pattern detection, automated attack mitigation, honeypot endpoint detection, bot signature identification, and integration with the platform\'s security monitoring system.', 'THE EMAIL SERVICE: Integration with Brevo (primary) and Mailjet (fallback) for transactional email delivery, including event confirmation emails, participant join notifications, organizer alerts, and white-label billing communications.', 'THE MAINTENANCE SYSTEM: A distributed maintenance mode implementation that coordinates across the Router Service and all Backend instances to enforce platform-wide maintenance windows, with carefully engineered exemptions that keep white-label client sites, uptime monitoring, and UptimeRobot health checks functioning even during PlanIt maintenance.', 'THE DATA MODELS: A comprehensive set of Mongoose schemas defining the Event, WhiteLabel, WLLead, EventParticipant, Incident, and MaintenanceSchedule entities, with carefully designed indexes, validation rules, and field-level access controls.', 'THE REAL-TIME LAYER: Socket.IO integration providing room-based event broadcasting, live participant state synchronization, real-time chat delivery, table service order notifications, and organizer announcements.']}
              proprietary="The Backend Application's value lies in three things: (1) the completeness and correctness of its data models, which encode all the Author's thinking about what an event management platform needs to track and how; (2) the security architecture, particularly the trafficGuard middleware and the white-label license enforcement system; and (3) the Cryptographic License Key System, which is a novel invention that enables offline-verifiable, tamper-evident license enforcement at scale. None of these may be copied, adapted, or used as a reference implementation without the Author's permission."
            />

            <ComponentCard anchor="component-c" letter="C" title="The Router Service" accent="#059669" bg="#f0fdf4"
              description="The PlanIt Router Service is the intelligent HTTP traffic orchestration layer deployed at planit-router.onrender.com. It sits between the public internet and the Backend Fleet and coordinates all traffic intelligently."
              points={['INTELLIGENT LOAD DISTRIBUTION: Routing incoming HTTP requests to the most appropriate backend instance using a proprietary scoring algorithm that factors in: real-time health status; consecutive alive/dead transitions; request history; and configured backend weights — not simple round-robin.', 'HEALTH-AWARE ORCHESTRATION: Continuously polling all backend instances, maintaining their alive/dead state, and dynamically removing unhealthy instances from the routing pool without dropping in-flight requests.', 'ADAPTIVE SCALING: A boost mode system that temporarily expands the active backend count during high-traffic periods, with configurable thresholds, duration, and reversion logic.', 'MAINTENANCE COORDINATION: A distributed maintenance enforcement system that returns appropriate 503 responses during maintenance windows, with a carefully engineered list of exemptions that keep critical paths (white-label resolution, uptime monitoring, UptimeRobot health checks) accessible at all times.', 'CORS MANAGEMENT: Dynamic CORS header injection that allows the Router to serve the PlanIt frontend, all white-label custom domains, and authorized development origins, pulling the current list of white-label domains from the Backend Fleet periodically.', 'MESH AUTHENTICATION: An HMAC-based mutual authentication protocol for all inter-service communication between the Router and the Backend Fleet, preventing unauthorized services from calling internal mesh endpoints.', 'RESPONSE CACHING: A short-TTL response cache for frequently-requested read-only API endpoints, reducing Backend Fleet load for common data fetches.', 'WEBSOCKET PROXYING: Pass-through of WebSocket upgrade requests and Socket.IO long-polling connections to the appropriate backend instance with sticky session behavior.']}
              proprietary="The Router Service's value is entirely in its Routing Intelligence — the specific algorithm by which it selects backend instances. This is not publicly known and is not reproducible from first principles without the Author's specific engineering decisions. It also contains the Mesh Protocol, which is a custom security protocol designed specifically for the PlanIt platform. Both constitute trade secrets in addition to copyrighted works."
            />

            <ComponentCard anchor="component-d" letter="D" title="The Watchdog Service" accent="#f59e0b" bg="#fffbeb"
              description="The PlanIt Watchdog Service is an autonomous infrastructure monitoring daemon that operates independently of all other platform components, ensuring continuous platform health awareness."
              points={['REAL-TIME HEALTH MONITORING: Continuously polling the PlanIt Router Service, Backend Fleet instances, and all other monitored infrastructure components at configurable intervals, interpreting their health responses, and maintaining a live operational status picture.', 'INCIDENT LIFECYCLE MANAGEMENT: Detecting incidents (service degradations or outages) based on consecutive health check failures, creating incident records, tracking their progression through open/investigating/resolved states, and auto-resolving incidents when services recover.', 'ALERT ROUTING AND DELIVERY: Sending real-time push notifications via ntfy.sh and Discord webhooks when incidents are detected, when severity changes, and when incidents resolve — with alert deduplication and suppression logic to prevent notification flooding.', 'UPTIME HISTORY AGGREGATION: Computing and storing rolling uptime percentages for all monitored services, providing historical availability data to the public PlanIt status page at planitapp.onrender.com/status.', 'STATUS PAGE DATA API: Providing the /watchdog/status endpoint (mesh-authenticated) and the /api/uptime/status endpoint (public) through which the frontend status page retrieves current platform health information.', 'AUTO-PROMOTION OF SCHEDULED MAINTENANCE: Polling for upcoming maintenance windows defined in the database and automatically promoting them to active maintenance mode at the correct time, coordinating across all Router and Backend instances.']}
              proprietary="The Watchdog Service's value lies in its Monitoring Intelligence — the specific configuration of polling intervals, failure thresholds, incident severity rules, alert routing logic, and uptime aggregation methodology that the Author has developed through operational experience running the PlanIt platform. These are not publicly known, are not derivable from generic monitoring best practices, and constitute trade secrets."
            />
          </section>

          {/* ═══ PART TWO: Overarching Terms ═══ */}
          <section style={{ marginBottom: '5rem' }}>
            <Anchor id="overarching" />
            <PartHeader part="Two" title="Overarching Terms Applicable to All Components" subtitle="The following terms apply to the PlanIt platform as a unified whole, in addition to the individual component license terms set out in Parts Three through Six below." accent="#6366f1" />

            <Anchor id="ownership" />
            <Reveal><SectionHead code="M-1" title="Unified Ownership Declaration" />
              <Clause code="M-1.1">The Author is the sole and exclusive owner of all intellectual property rights in and to the PlanIt platform as a whole and in each individual component thereof, including all copyrights, trade secrets, trade dress, and any other proprietary rights recognized under applicable law.</Clause>
              <Clause code="M-1.2">The PlanIt platform, considered as a whole, constitutes a collective work under copyright law in addition to the individual copyrights subsisting in each component. The Author owns the copyright in the collective work in addition to the component copyrights.</Clause>
              <Clause code="M-1.3">The architectural decisions that govern how the four components interact — the CORS scheme, the mesh authentication protocol, the white-label domain flow from frontend resolution through backend heartbeat to Router-level CORS registration, the maintenance exemption hierarchy — together constitute a proprietary system design that is itself a trade secret and copyrighted work of the Author, separate from and in addition to the individual component copyrights.</Clause>
            </Reveal>

            <Anchor id="scope" />
            <Reveal delay={60}><SectionHead code="M-2" title="Scope of the Master Agreement" />
              <Clause code="M-2.1">This Master Agreement governs any and all access to and use of the PlanIt platform, regardless of which component or components You interact with.</Clause>
              <Clause code="M-2.2">Where a more specific individual component license agreement addresses a particular topic (e.g., the Cryptographic License System in the Backend License, or the Routing Intelligence in the Router License), that specific provision takes precedence over any general provision in this Master Agreement with respect to that specific topic.</Clause>
              <Clause code="M-2.3">Interaction with any single component of the PlanIt platform (e.g., reading only the Router source code) subjects You to the Master Agreement AND to the individual license agreement for that component.</Clause>
            </Reveal>

            <Anchor id="license-grant" />
            <Reveal delay={60}><SectionHead code="M-3" title="Unified Grant of Limited License" />
              <Clause code="M-3.1">Subject to Your full and continuous compliance with this Master Agreement and all applicable individual component license agreements, the Author grants You a limited, personal, non-exclusive, non-transferable, non-sublicensable, revocable license to: (a) View the source code of any component of the PlanIt platform solely for personal, non-commercial educational and reference purposes; and (b) Access and use the Hosted Service as an end-user for its intended purpose of event planning and event management, subject to the Terms of Service at planitapp.onrender.com.</Clause>
              <Clause code="M-3.2">White-label clients with executed white-label agreements hold additional rights as specified in those agreements only.</Clause>
              <Clause code="M-3.3">All rights not expressly granted are reserved by the Author.</Clause>
            </Reveal>

            <Anchor id="restrictions" />
            <Reveal delay={60}><SectionHead code="M-4" title="Unified Restrictions" />
              <p style={{ fontSize: '0.875rem', color: '#475569', marginLeft: '0.9rem', marginBottom: '0.25rem' }}>Across the entire PlanIt platform, without explicit prior written permission from the Author, You must NOT:</p>
              <RestrictList items={['Deploy any component of the platform on any infrastructure;', 'Copy, clone, or reproduce any component in any form;', 'Distribute any component to any third party;', 'Create any Derivative Work from any component;', 'Use any component for any Commercial Use;', 'Reverse engineer any security or enforcement mechanism;', 'Use any component\'s source code in any ML training dataset;', 'Remove any copyright notice or proprietary marking.']} />
            </Reveal>

            <Anchor id="no-open-source" />
            <Reveal delay={60}><SectionHead code="M-5" title="No Open Source" />
              <Callout variant="warning"><strong>The PlanIt platform is NOT open source software.</strong> No component of the platform is released under any open-source license, including but not limited to the MIT License, Apache 2.0, GNU GPL, GNU LGPL, BSD licenses, Creative Commons licenses, or any other license that would permit copying, modification, or redistribution.</Callout>
              <Clause code="M-5.2">The presence of this source code in a publicly accessible repository does not, under any interpretation, constitute: (a) an open-source release; (b) a public domain dedication; (c) an implied license of any kind; (d) a waiver of any copyright or other proprietary right; or (e) consent to any use beyond viewing for educational reference.</Clause>
              <Clause code="M-5.3">The Author has chosen to make this source code publicly visible solely to demonstrate technical capability and for reference purposes. This choice is made expressly without waiving any intellectual property right.</Clause>
            </Reveal>

            <Anchor id="disclaimers" />
            <Reveal delay={60}><SectionHead code="M-6" title="Unified Disclaimers and Limitations" />
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '0.5rem' }}>
                <Clause code="M-6.1">THE ENTIRE PLANIT PLATFORM IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED. THE AUTHOR DISCLAIMS ALL WARRANTIES TO THE MAXIMUM EXTENT PERMITTED BY LAW.</Clause>
                <Clause code="M-6.2">THE AUTHOR'S TOTAL LIABILITY UNDER THIS MASTER AGREEMENT AND ALL INDIVIDUAL COMPONENT LICENSES COMBINED SHALL NOT EXCEED USD $100.00.</Clause>
                <Clause code="M-6.3">IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY INDIRECT, CONSEQUENTIAL, INCIDENTAL, SPECIAL, OR PUNITIVE DAMAGES ARISING FROM ANY COMPONENT OF THE PLATFORM.</Clause>
              </div>
            </Reveal>

            <Anchor id="governing-law" />
            <Reveal delay={60}><SectionHead code="M-7" title="Governing Law and Dispute Resolution" />
              <Clause code="M-7.1">This Master Agreement and all individual component license agreements shall be governed by the laws of the jurisdiction in which the Author resides, without regard to conflict of law principles.</Clause>
              <Clause code="M-7.2">Any dispute arising under this Master Agreement that cannot be resolved by direct negotiation between the parties shall be submitted to binding arbitration under rules mutually agreed by the parties, except that the Author shall always be entitled to seek emergency injunctive relief from any court of competent jurisdiction without first submitting to arbitration.</Clause>
              <Clause code="M-7.3">Each party irrevocably waives any objection to the venue or personal jurisdiction of courts in the Author's jurisdiction for any proceeding that escapes arbitration.</Clause>
            </Reveal>

            <Anchor id="contact" />
            <Reveal delay={60}><SectionHead code="M-8" title="Contact and Permissions" />
              <Clause code="M-8.1">All requests for permissions beyond those granted in this Master Agreement — including commercial license inquiries, white-label partnership inquiries, academic use requests, and security vulnerability reports — must be directed to:</Clause>
              <div style={{ margin: '0.75rem 0.9rem 0.75rem', padding: '1.25rem 1.5rem', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', display: 'flex', gap: '2.5rem', flexWrap: 'wrap' }}>
                {[['Email', 'planit.userhelp@gmail.com', 'mailto:planit.userhelp@gmail.com'], ['Web', 'https://planitapp.onrender.com', 'https://planitapp.onrender.com']].map(([k, v, href]) => (
                  <div key={k}>
                    <p style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#94a3b8', margin: '0 0 0.3rem' }}>{k}</p>
                    <a href={href} style={{ fontSize: '0.88rem', color: '#6366f1', textDecoration: 'none', fontWeight: 500 }}>{v}</a>
                  </div>
                ))}
              </div>
              <Clause code="M-8.2">Permission requests must be made in writing, must identify the requestor and their intended use in detail, and will be evaluated at the Author's sole discretion. Permission is never implied, deemed, or constructively granted.</Clause>
            </Reveal>
          </section>

          {/* ═══ COMPONENT LICENSES ═══ */}
          <CompLicense
            id="frontend-license" partNum="Three" title="PlanIt Frontend Application" accent="#3b82f6"
            coverage="Governs all access to and use of the PlanIt client-side React application. Covers every .jsx, .tsx, .css, .html, .json, and .js file in /frontend/src/ and its subdirectories, the Vite configuration, PWA configuration, all design assets, and the complete Visual Design System."
            defs={[
              ['"Frontend Application" or "Software"', 'The PlanIt client-side web application in its entirety, encompassing all React component source files, all context providers and consumer hooks, all service modules and API client files, all UI components, design tokens, Tailwind CSS configuration, custom CSS stylesheets, animation definitions, the Vite build configuration, PWA manifest, public/ directory assets, the complete Visual Design System, the white-label theming architecture, and all documentation and code comments.'],
              ['"Author"', 'Aakshat Hariharan, the sole designer, architect, developer, and intellectual property owner of the Frontend Application.'],
              ['"You" or "Licensee"', 'Any individual, developer, designer, engineer, researcher, student, company, organization, or other legal or natural person that accesses, views, reads, downloads, clones, compiles, executes, deploys, or otherwise interacts with the Frontend Application.'],
              ['"Hosted Service"', 'The production deployment at planitapp.onrender.com and all associated white-label custom domains.'],
              ['"Visual Design System"', 'The complete proprietary visual language including dark color palette, gradient definitions, glassmorphism treatments, ambient glow patterns, typography hierarchy, micro-interaction patterns, icon usage conventions, and overall aesthetic system.'],
              ['"Derivative Work"', 'Any work derived from, copying, adapting, or substantially similar to the Frontend Application in code, design, architecture, or user experience.'],
              ['"Commercial Use"', 'Any use in connection with any revenue-generating activity.'],
              ['"Deploy"', 'To serve, host, publish, or make operational the Frontend Application on any infrastructure.'],
              ['"Distribute"', 'To share, transfer, publish, or make available the Frontend Application to any third party.'],
            ]}
            grantLines={[
              '2.1 The Author grants You a limited, personal, non-exclusive, non-transferable, non-sublicensable, revocable license to: (a) view the source code for personal educational reference; and (b) access and use the Hosted Service as an end-user.',
              '2.2 White-label clients with executed agreements hold additional rights per those agreements only.',
              '2.3 All rights not expressly granted are reserved by the Author.',
              '2.4 The Author may revoke this license at any time without notice.',
            ]}
            restrictItems={['Copy, clone, mirror, or reproduce the Frontend Application;', 'Deploy the Frontend Application on any infrastructure;', 'Distribute the Frontend Application to any third party;', 'Modify or create any Derivative Work;', 'Reverse engineer any compiled or minified portion;', 'Use the Visual Design System for any other product\'s design;', 'Use any portion for Commercial Use;', 'Remove any copyright notices, license notices, or attributions;', 'Use "PlanIt" or "Aakshat Hariharan" without written consent;', 'Use automated tools to extract source code or content at scale;', 'Use source code in ML training datasets or code generation models;', 'Frame or embed the Hosted Service to misrepresent its origin;', 'Circumvent any technical enforcement mechanism.']}
            specialTitle="Intellectual Property Ownership"
            specialItems={[['4.1', 'The Frontend Application and all constituent elements are the sole and exclusive property of the Author.'], ['4.2', 'The Visual Design System constitutes protectable trade dress and confidential trade secret information of the Author.'], ['4.3', 'The white-label theming architecture, including the WhiteLabelContext, heartbeat verification, and CSS variable injection, constitutes a proprietary technical system and trade secret.'], ['4.4', 'Any feedback or input You provide is assigned to the Author in full without compensation.'], ['4.5', 'Third-party open-source dependency copyrights remain with their respective owners. The Author\'s rights extend to original creative expression in how those dependencies are assembled and used.']]}
            closingText="You agree to treat the source code, design decisions, component architecture, and all non-public aspects as strictly confidential and not to disclose any Confidential Information to any third party without the Author's prior written consent."
          />

          <CompLicense
            id="backend-license" partNum="Four" title="PlanIt Backend Application" accent="#8b5cf6"
            coverage="Governs all access to and use of the PlanIt server-side Node.js/Express application. Covers every .js file in /backend/ and its subdirectories, including all route handlers, data models, middleware, service modules, configuration files, and the proprietary Cryptographic License Key System."
            defs={[
              ['"Backend Application" or "Software"', 'The PlanIt server-side application in its entirety, including the main Express.js server, all route handlers (/routes/), all Mongoose data models (/models/), all middleware (/middleware/), all service modules (/services/), the Cryptographic License Key System, the white-label resolution and heartbeat enforcement system, the Socket.IO real-time layer, all configuration files, and all documentation and comments.'],
              ['"Author"', 'Aakshat Hariharan, the sole architect, developer, and intellectual property owner of the Backend Application.'],
              ['"You"', 'Any individual or entity interacting with the Backend Application in any way.'],
              ['"Cryptographic License System"', 'The HMAC-SHA256-based license key generation and verification system, including the key format WL-{TIER}-{DOMAIN_HASH_8}-{EXPIRY_HEX}-{HMAC_12}, the algorithm, the domain hash function, the expiry encoding scheme, and the HMAC construction.'],
              ['"Data Models"', 'All Mongoose schema definitions and associated business logic, constituting trade secrets of the Author.'],
              ['"Derivative Work"', 'Any work derived from, reimplementing, or substantially similar to the Backend Application.'],
              ['"Deploy"', 'To execute, run, or host the Backend Application on any computing infrastructure.'],
              ['"Commercial Use"', 'Any use in connection with commercial activity.'],
            ]}
            grantLines={[
              '2.1 The Author grants You a limited, personal, non-exclusive, non-transferable, non-sublicensable, revocable license to: (a) view the source code for personal educational reference; and (b) access the API Surface through the official frontend only, or as explicitly authorized in writing.',
              '2.2 No right to Deploy, modify, distribute, or commercially exploit the Backend Application is granted.',
              '2.3 All rights not expressly granted are reserved.',
            ]}
            restrictItems={['Deploy, execute, or host the Backend Application;', 'Copy, clone, or reproduce the Backend Application;', 'Distribute the Backend Application to any third party;', 'Modify or create any Derivative Work, including reimplementing the Data Models or Cryptographic License System;', 'Reverse engineer the Cryptographic License System or attempt to reconstruct the WL_LICENSE_SECRET;', 'Access the API Surface through any means other than the official frontend, except as explicitly authorized in writing by the Author;', 'Conduct penetration testing or vulnerability assessment without the Author\'s explicit written authorization;', 'Access, extract, or aggregate any user data stored in any database associated with the platform;', 'Use source code in ML training datasets or AI code generation models;', 'Circumvent any security mechanism, rate limit, or access control;', 'Use the Data Models as the basis for designing a competing platform;', 'Use for Commercial Use without a written license from the Author.']}
            specialTitle="Cryptographic License System — Special Provisions"
            specialItems={[['4.1', 'The Cryptographic License System is the Author\'s proprietary invention and most sensitive trade secret. It constitutes both a copyrighted work and a trade secret under applicable law.'], ['4.2', 'Any attempt to reverse engineer, bypass, spoof, or circumvent the Cryptographic License System constitutes trade secret misappropriation and may result in criminal liability under applicable computer fraud and abuse statutes.'], ['4.3', 'The WL_LICENSE_SECRET and all related cryptographic secrets are inaccessible to You under any circumstance. Any known or suspected exposure of these secrets must be reported immediately to planit.userhelp@gmail.com.']]}
            extraItems={['5.1 Unauthorized access to the Backend Application or its databases constitutes a serious privacy violation and may trigger breach notification obligations under applicable data protection law including but not limited to GDPR, CCPA, and similar statutes.', '5.2 Security vulnerability reports must be submitted to planit.userhelp@gmail.com without public disclosure. Responsible disclosure is appreciated; unauthorized public disclosure may constitute tortious interference.', '5.3 You agree to comply with all applicable export control laws and regulations in connection with Your use of this software.']}
            closingText="You agree not to use knowledge gained from accessing this source code to harm the Author, the PlanIt platform, its users, or any third party. You agree not to facilitate, encourage, or enable any other person to violate this Agreement."
          />

          <CompLicense
            id="router-license" partNum="Five" title="PlanIt Router Service" accent="#059669"
            coverage="Governs all access to and use of the PlanIt intelligent HTTP traffic orchestration layer. Covers every source file in the /router/ directory, the entire Routing Intelligence, the Mesh Protocol implementation, and all configuration and operational tooling associated with the Router Service."
            defs={[
              ['"Router Service" or "Software"', 'The PlanIt HTTP routing and orchestration layer in its entirety, including all backend selection algorithms, health-check polling logic, maintenance intercept middleware, CORS management system, mesh authentication protocol, response caching layer, rate limiting configuration, health check aggregation, deploy hook configuration, backend fleet registry, WebSocket proxying configuration, and all documentation and comments.'],
              ['"Author"', 'Aakshat Hariharan, the sole architect and owner.'],
              ['"You"', 'Any individual or entity interacting with the Router Service.'],
              ['"Routing Intelligence"', 'The proprietary scoring algorithm, health heuristics, boost mode logic, and all decision-making code governing backend instance selection — constituting trade secrets of the Author.'],
              ['"Mesh Protocol"', 'The HMAC-based inter-service authentication system used for all communication between the Router Service and the Backend Fleet.'],
              ['"Derivative Work"', 'Any work derived from or reimplementing any portion of the Router Service.'],
              ['"Deploy"', 'To execute or host the Router Service on any infrastructure.'],
              ['"Commercial Use"', 'Any use in connection with commercial activity.'],
            ]}
            grantLines={['2.1 The Author grants You a limited, personal, non-exclusive, non-transferable, non-sublicensable, revocable license to view the source code for personal educational reference only.', '2.2 No deployment, modification, distribution, or commercial exploitation right is granted.', '2.3 All rights not expressly granted are reserved.']}
            restrictItems={['Deploy or host the Router Service on any infrastructure;', 'Copy or reproduce the Router Service in any form;', 'Distribute the Router Service to any third party;', 'Modify or create any Derivative Work, including reimplementing the Routing Intelligence;', 'Benchmark or reverse engineer the Routing Intelligence for the purpose of building a competing system;', 'Disclose any Confidential Information, including Routing Intelligence parameters, to any third party;', 'Probe, stress-test, or conduct load testing against the Hosted Infrastructure without written authorization;', 'Forge or bypass Mesh Protocol authentication headers;', 'Use source code in ML training datasets or AI code generation models;', 'Remove copyright notices or proprietary markings;', 'Use for Commercial Use without a written license.']}
            specialTitle="Routing Intelligence as Trade Secret"
            specialItems={[['4.1', 'The Routing Intelligence constitutes a proprietary system developed through substantial engineering investment. The specific combination of health-check scoring weights, backend alive-state hysteresis logic, boost mode thresholds, and maintenance exemption categorization are not publicly known and provide the Author with a competitive advantage.'], ['4.2', 'Your obligation to maintain the confidentiality of the Routing Intelligence survives termination of this Agreement indefinitely. This obligation is independent of and survives any finding that any other provision of this Agreement is unenforceable.']]}
            closingText="You agree not to take any action that could degrade, disrupt, or damage the Hosted Infrastructure or Backend Fleet, including but not limited to distributed denial of service attacks, traffic flooding, or manipulation of load-balancing behavior. Infrastructure integrity is an obligation that survives termination of this Agreement."
          />

          <CompLicense
            id="watchdog-license" partNum="Six" title="PlanIt Watchdog Service" accent="#f59e0b"
            coverage="Governs all access to and use of the PlanIt autonomous infrastructure monitoring daemon. Covers every source file in the /watchdog/ directory, the Monitoring Intelligence, alert routing logic, uptime aggregation system, and all configuration and operational data generated by the Watchdog Service."
            defs={[
              ['"Watchdog Service" or "Software"', 'The PlanIt autonomous monitoring daemon in its entirety, including all health-check polling logic, incident lifecycle management, alert routing and deduplication system, uptime history aggregation, status page data API, mesh-authenticated endpoints, auto-promotion of scheduled maintenance, and all configuration, operational documentation, and comments.'],
              ['"Author"', 'Aakshat Hariharan, the sole designer and owner.'],
              ['"You"', 'Any individual or entity interacting with the Watchdog Service.'],
              ['"Monitoring Intelligence"', 'The proprietary heuristics, thresholds, timing parameters, and decision logic governing incident detection, severity classification, alert routing, and uptime aggregation — constituting trade secrets of the Author.'],
              ['"Operational Data"', 'Uptime records, incident logs, and alert histories generated during operation of the Watchdog Service, owned exclusively by the Author.'],
              ['"Derivative Work"', 'Any monitoring tool derived from or reimplementing the Watchdog Service.'],
              ['"Deploy"', 'To execute or host the Watchdog Service on any infrastructure.'],
              ['"Commercial Use"', 'Any use in connection with commercial activity.'],
            ]}
            grantLines={['2.1 The Author grants You a limited, personal, non-exclusive, non-transferable, non-sublicensable, revocable license to view the source code for personal educational reference only.', '2.2 No deployment, modification, distribution, or commercial exploitation right is granted.', '2.3 All rights not expressly granted are reserved.']}
            restrictItems={['Deploy or operate the Watchdog Service on any infrastructure;', 'Copy or reproduce the Watchdog Service in any form;', 'Distribute the Watchdog Service to any third party;', 'Modify or create any Derivative Work, including adapting the Monitoring Intelligence for any other monitoring system;', 'Disclose the Monitoring Intelligence or its specific parameters to any third party;', 'Access status API endpoints except through the official PlanIt status page at planitapp.onrender.com/status;', 'Interfere with, disable, or circumvent the Watchdog Service in any way;', 'Generate false health signals, suppress legitimate alerts, or corrupt monitoring data;', 'Use source code in ML training datasets or AI code generation models;', 'Remove copyright notices or proprietary markings;', 'Access, export, or aggregate Operational Data without written authorization from the Author;', 'Use for Commercial Use without a written license.']}
            specialTitle="Monitoring Intelligence as Trade Secret"
            specialItems={[['4.1', 'The Monitoring Intelligence — polling intervals, failure thresholds, incident severity rules, alert suppression cooldowns, uptime aggregation methodology — constitutes trade secrets developed through operational experience running the PlanIt platform. These parameters are not derivable from generic monitoring best practices and provide the Author with a competitive advantage.'], ['4.2', 'Your confidentiality obligation with respect to the Monitoring Intelligence survives termination of this Agreement indefinitely.']]}
            closingText="You agree not to flood or abuse the ntfy.sh or Discord alert channels used by the Watchdog Service. You agree not to take any action designed to suppress, delay, or corrupt incident detection or alert delivery. Doing so may constitute unauthorized interference with computer systems under applicable law."
          />

          {/* ═══ PART SEVEN: Closing ═══ */}
          <section style={{ marginBottom: '5rem' }}>
            <Anchor id="closing" />
            <PartHeader part="Seven" title="Consolidated Closing Provisions" subtitle="This Master Agreement, together with the four individual component license agreements reproduced in Parts Three through Six above, constitutes the complete and exclusive statement of the intellectual property rights and licensing terms governing the PlanIt platform and all of its components." accent="#0f172a" />

            <Reveal>
              <SectionHead code="" title="Consolidated Ownership Statement" />
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '14px', padding: '1.75rem', fontSize: '0.9rem', color: '#334155', lineHeight: 1.9 }}>
                Every line of source code, every design decision, every data model, every algorithm, every configuration file, every comment, and every architectural choice across all four components of the PlanIt platform is the original creative work and exclusive property of Aakshat Hariharan. No co-author, contributor, employer, client, or third party holds any ownership interest in any portion of the PlanIt platform. The Author created this platform independently, owns it outright, and licenses it exclusively on the terms set out above.
              </div>
            </Reveal>

            <Reveal delay={60}>
              <SectionHead code="" title="Summary — What Is and Is Not Permitted" />
              <p style={{ fontSize: '0.84rem', color: '#64748b', marginLeft: '0.2rem', marginBottom: '0.25rem' }}>For the avoidance of doubt and as a convenience summary only. This summary does not supersede or limit the full terms above:</p>
              <PermGrid />
            </Reveal>

            <Reveal delay={80}>
              <SectionHead code="" title="Violation Reporting" />
              <p style={{ fontSize: '0.875rem', color: '#334155', lineHeight: 1.8, marginBottom: '1rem' }}>If You become aware of any violation of this Master Agreement or any individual component license — including unauthorized forks, deployments, or distributions of any PlanIt component — please report it to:</p>
              <a href="mailto:planit.userhelp@gmail.com" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.6rem', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.85rem 1.25rem', textDecoration: 'none', fontSize: '0.85rem', color: '#6366f1', fontWeight: 500, transition: 'all 0.2s ease' }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 18px rgba(99,102,241,0.15)'; e.currentTarget.style.borderColor = '#a5b4fc'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.borderColor = '#e2e8f0'; }}>
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>
                planit.userhelp@gmail.com — Subject: License Violation Report
              </a>
              <p style={{ fontSize: '0.84rem', color: '#64748b', marginTop: '1rem', lineHeight: 1.7 }}>The Author takes intellectual property violations seriously and will pursue all available legal remedies against unauthorized uses of the PlanIt platform.</p>
            </Reveal>

            <Reveal delay={100}>
              <SectionHead code="" title="Acknowledgment" />
              <p style={{ fontSize: '0.875rem', color: '#475569', marginBottom: '0.75rem' }}>By accessing any component of the PlanIt platform, You acknowledge that:</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {['You have read this Master Agreement in its entirety;', 'You understand its terms;', 'You agree to be legally bound by all of its provisions;', 'You have the legal capacity and authority to enter into this Agreement;', 'If You are accessing on behalf of an organization, You have authority to bind that organization to these terms; and', 'You acknowledge that this Agreement is enforceable against You.'].map((text, i) => (
                  <div key={i} style={{ display: 'flex', gap: '1rem', padding: '0.7rem 1rem', background: '#f8fafc', borderRadius: '9px', alignItems: 'flex-start' }}>
                    <span style={{ width: '1.5rem', height: '1.5rem', background: '#1e293b', color: '#fff', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800, flexShrink: 0 }}>{i + 1}</span>
                    <span style={{ fontSize: '0.875rem', color: '#334155', lineHeight: 1.7 }}>{text}</span>
                  </div>
                ))}
              </div>
            </Reveal>
          </section>

          {/* Footer */}
          <Reveal>
            <div style={{ background: 'linear-gradient(135deg,#0f172a 0%,#1e293b 100%)', borderRadius: '20px', padding: '3.5rem', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: '-80px', right: '-80px', width: '250px', height: '250px', background: 'radial-gradient(circle,#6366f120,transparent)', borderRadius: '50%', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', bottom: '-60px', left: '-60px', width: '200px', height: '200px', background: 'radial-gradient(circle,#3b82f615,transparent)', borderRadius: '50%', pointerEvents: 'none' }} />
              <div style={{ position: 'relative' }}>
                <p style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.9rem', fontWeight: 900, color: '#fff', marginBottom: '0.4rem', letterSpacing: '-0.01em' }}>PlanIt Platform</p>
                <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1.5rem' }}>Copyright © 2026 Aakshat Hariharan. All Rights Reserved.</p>
                <p style={{ fontSize: '0.84rem', color: '#475569', lineHeight: 1.8, maxWidth: '500px', margin: '0 auto 2.25rem' }}>All four components — Frontend, Backend, Router, and Watchdog — are protected by copyright law and trade secret law. Unauthorized use, copying, deployment, or distribution is strictly prohibited and will be vigorously enforced.</p>
                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  {[['Website', 'https://planitapp.onrender.com'], ['Email', 'mailto:planit.userhelp@gmail.com']].map(([label, href]) => (
                    <a key={label} href={href} style={{ color: '#93c5fd', fontSize: '0.84rem', textDecoration: 'none', fontWeight: 500, padding: '0.45rem 1rem', border: '1px solid #1e3a5f', borderRadius: '8px', transition: 'all 0.2s ease' }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#1e3a5f'; e.currentTarget.style.borderColor = '#3b82f6'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#1e3a5f'; }}>
                      {label}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>

        </main>
      </div>
    </div>
  );
}
