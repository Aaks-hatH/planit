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
  const fg   = dark ? 'rgba(255,255,255,0.85)' : '#171717';
  const sub  = dark ? 'rgba(255,255,255,0.35)' : '#a3a3a3';
  const ring = dark ? 'rgba(255,255,255,0.2)'  : '#a3a3a3';

  return (
    <div style={{ minHeight: '100vh', background: dark ? '#05050f' : '#fafafa', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, textAlign: 'center' }}>
      {brand?.logoUrl && (
        <img src={brand.logoUrl} alt="" style={{ width: 56, height: 56, borderRadius: 14, objectFit: 'cover' }} />
      )}
      {name && (
        <div style={{ fontSize: 18, fontWeight: 700, color: fg, maxWidth: 420, lineHeight: 1.3, wordBreak: 'break-word' }}>{name}</div>
      )}
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={brand?.accentColor || ring} strokeWidth="2" strokeLinecap="round">
        <path d="M21 12a9 9 0 11-6.219-8.56" style={{ animation: 'bl-spin 1s linear infinite', transformOrigin: 'center' }} />
      </svg>
      {name && <div style={{ fontSize: 12, color: sub }}>{label}</div>}
      <style>{`@keyframes bl-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
