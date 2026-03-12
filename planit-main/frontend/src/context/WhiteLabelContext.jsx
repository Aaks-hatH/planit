/**
 * WhiteLabelContext.jsx
 *
 * Detects whether the app is running on a custom (white-label) domain and,
 * if so, fetches the branding config AND verifies the license is valid.
 *
 * Enforcement flow:
 *   1. /resolve  — fetches branding, confirms the domain is registered
 *   2. /heartbeat — verifies the license key cryptographically (domain only,
 *                   backend does the key lookup internally)
 *   3. If heartbeat returns 403 for any reason (suspended, expired, tampered)
 *      sets blocked: true with a reason, App.jsx renders the blocked page.
 *
 * Heartbeat cache:
 *   Passes are cached in localStorage for 1 hour so repeated page loads
 *   don't hammer the API. Blocks are NOT cached — every visit re-checks
 *   so a re-activation takes effect immediately.
 */

import { createContext, useContext, useEffect, useState } from 'react';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');

const NATIVE_HOSTS = [
  'localhost',
  '127.0.0.1',
  'planitapp.onrender.com',
  'planit-router.onrender.com',
  ...(import.meta.env.VITE_MAIN_DOMAIN ? [import.meta.env.VITE_MAIN_DOMAIN] : []),
];

function isCustomDomain(hostname) {
  return !NATIVE_HOSTS.some(h => hostname === h || hostname.endsWith('.' + h));
}

const HB_KEY = 'wl_hb_v2';
const HB_TTL = 60 * 60 * 1000; // 1 hour

function getCachedHB(domain) {
  try {
    const raw = localStorage.getItem(HB_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    if (c.domain !== domain) return null;
    if (Date.now() - c.ts > HB_TTL) return null;
    return c;
  } catch { return null; }
}

function setCachedHB(domain, ok) {
  try {
    localStorage.setItem(HB_KEY, JSON.stringify({ domain, ts: Date.now(), ok }));
  } catch { /* ignore */ }
}

const WhiteLabelContext = createContext({
  wl: null, isWL: false, resolved: false,
  blocked: false, blockReason: null,
});

export function useWhiteLabel() {
  return useContext(WhiteLabelContext);
}

export function WhiteLabelProvider({ children }) {
  const [state, setState] = useState({
    wl: null, isWL: false, resolved: false, blocked: false, blockReason: null,
  });

  useEffect(() => {
    const hostname = window.location.hostname;

    if (!isCustomDomain(hostname)) {
      setState({ wl: null, isWL: false, resolved: true, blocked: false, blockReason: null });
      return;
    }

    let cancelled = false;

    async function run() {
      // 1. Fetch branding
      let branding = null;
      try {
        const r = await fetch(
          `${API_URL}/whitelabel/resolve?domain=${encodeURIComponent(hostname)}`,
          { cache: 'no-store' }
        );
        if (r.status === 404) {
          // Not a registered WL domain at all — render as normal PlanIt
          if (!cancelled) setState({ wl: null, isWL: false, resolved: true, blocked: false, blockReason: null });
          return;
        }
        if (r.status === 403) {
          // Domain is registered but suspended/cancelled — show suspended page
          // We still get branding back so the page can look branded
          const data = await r.json().catch(() => ({}));
          if (!cancelled) setState({
            wl: data,
            isWL: true,
            resolved: true,
            blocked: true,
            blockReason: data.status || 'suspended',
          });
          return;
        }
        if (!r.ok) throw new Error('resolve failed');
        branding = await r.json();
      } catch {
        // Network error — fail open so a blip doesn't kill a live site
        if (!cancelled) setState({ wl: null, isWL: false, resolved: true, blocked: false, blockReason: null });
        return;
      }

      // 2. Check cache — only trust cached PASSES (ok: true)
      const cached = getCachedHB(hostname);
      if (cached && cached.ok) {
        if (!cancelled) setState({ wl: branding, isWL: true, resolved: true, blocked: false, blockReason: null });
        return;
      }

      // 3. Live heartbeat — real enforcement
      try {
        const r = await fetch(`${API_URL}/whitelabel/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ domain: hostname }),
        });
        const data = await r.json().catch(() => ({}));

        if (r.status === 403) {
          // Blocked — don't cache, force re-check every visit
          if (!cancelled) setState({
            wl: branding, isWL: true, resolved: true,
            blocked: true, blockReason: data.reason || 'invalid',
          });
          return;
        }

        if (r.status === 404) {
          if (!cancelled) setState({ wl: null, isWL: false, resolved: true, blocked: false, blockReason: null });
          return;
        }

        if (!r.ok) {
          // Server error — fail open, don't kill a live site over a blip
          console.warn('[WL] heartbeat server error', r.status, '— failing open');
          setCachedHB(hostname, true);
          if (!cancelled) setState({ wl: branding, isWL: true, resolved: true, blocked: false, blockReason: null });
          return;
        }

        // Valid
        setCachedHB(hostname, true);
        if (!cancelled) setState({ wl: branding, isWL: true, resolved: true, blocked: false, blockReason: null });

      } catch {
        // Network error — fail open
        console.warn('[WL] heartbeat network error — failing open');
        if (!cancelled) setState({ wl: branding, isWL: true, resolved: true, blocked: false, blockReason: null });
      }
    }

    run();
    return () => { cancelled = true; };
  }, []);

  return (
    <WhiteLabelContext.Provider value={state}>
      {children}
    </WhiteLabelContext.Provider>
  );
}
