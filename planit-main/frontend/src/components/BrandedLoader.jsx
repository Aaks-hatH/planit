/**
 * frontend/src/components/BrandedLoader.jsx
 *
 * Full-screen loading state that shows the event's own name (and logo, if it
 * has one) while a page loads, instead of an anonymous spinner. The name comes
 * from the server-injected preload / session cache (see utils/eventBrand.js),
 * so on event URLs it's visible on the very first paint.
 *
 * Props
 *   dark   true for the dark PlanIt shell (default), false for light pages
 *   label  optional small text under the name (e.g. "Loading…")
 */
import { useEffect, useState } from 'react';
import { currentBrandFromLocation, parseEventPath, fetchBrand } from '../utils/eventBrand';

export default function BrandedLoader({ dark = true, label = 'Loading…' }) {
  const [brand, setBrand] = useState(() => currentBrandFromLocation());

  useEffect(() => {
    if (brand) return;
    const parsed = parseEventPath(window.location.pathname);
    if (!parsed) return;
    let live = true;
    fetchBrand(parsed.key).then((b) => { if (live && b) setBrand(b); });
    return () => { live = false; };
  }, [brand]);

  const name = brand?.name || brand?.title;
  const fg   = dark ? 'rgba(255,255,255,0.9)' : '#0f0f14';
  const sub  = dark ? 'rgba(255,255,255,0.45)' : '#6a6a76';
  const accent = brand?.accentColor || (dark ? '#5f84ff' : '#2f5bff');

  return (
    <div
      role="status" aria-live="polite" aria-label={name ? `Loading ${name}` : 'Loading'}
      style={{ minHeight: '100dvh', background: dark ? '#05050f' : '#f7f6f2', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center' }}
    >
      {brand?.logoUrl
        ? <img src={brand.logoUrl} alt="" style={{ width: 56, height: 56, borderRadius: 12, objectFit: 'cover' }} />
        : !name && (
          <span aria-hidden="true" style={{ width: 44, height: 44, borderRadius: 10, background: dark ? '#fff' : '#0f0f14', color: dark ? '#07070b' : '#fff', display: 'grid', placeItems: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 24, letterSpacing: '-0.05em', animation: 'bl-breathe 1.6s ease-in-out infinite' }}>P</span>
        )}
      {name && (
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', color: fg, maxWidth: 420, lineHeight: 1.25, wordBreak: 'break-word' }}>{name}</div>
      )}
      <span aria-hidden="true" style={{ position: 'relative', width: 96, height: 2, borderRadius: 2, background: dark ? 'rgba(255,255,255,0.12)' : 'rgba(15,15,20,0.1)', overflow: 'hidden' }}>
        <span style={{ position: 'absolute', inset: 0, width: '40%', background: accent, borderRadius: 2, animation: 'bl-slide 1.1s var(--ease-in-out, ease-in-out) infinite' }} />
      </span>
      {name && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: sub }}>{label}</div>}
      <style>{`
        @keyframes bl-slide{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}
        @keyframes bl-breathe{0%,100%{transform:scale(1)}50%{transform:scale(0.94)}}
        @media (prefers-reduced-motion: reduce){ [aria-label^="Loading"] span{ animation:none !important } }
      `}</style>
    </div>
  );
}
