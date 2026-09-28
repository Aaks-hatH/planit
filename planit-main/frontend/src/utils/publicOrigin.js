/**
 * publicOrigin.js
 *
 * Single source of truth for the origin used in shareable links
 * (QR pass, venue map, event links, invite links, RSVP links).
 *
 * Why this exists: links used to be built from window.location.origin, so
 * whichever host the page happened to be opened on (e.g. planitapp.vercel.app)
 * got baked into the link. Now:
 *   - Vercel hosts (production alias or previews)  -> canonical Render domain
 *   - White-label custom domains                   -> their own origin (kept on purpose)
 *   - localhost / everything else                  -> current origin (dev keeps working)
 *
 * Override the canonical domain at build time with VITE_PUBLIC_URL.
 */
const CANONICAL = (import.meta.env.VITE_PUBLIC_URL || 'https://planitapp.onrender.com').replace(/\/$/, '');

const REDIRECT_TO_CANONICAL = ['vercel.app'];

export function publicOrigin() {
  if (typeof window === 'undefined') return CANONICAL;
  const { hostname, origin } = window.location;
  const isAlias = REDIRECT_TO_CANONICAL.some((h) => hostname === h || hostname.endsWith('.' + h));
  return isAlias ? CANONICAL : origin;
}

export const CANONICAL_ORIGIN = CANONICAL;
