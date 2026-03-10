/**
 * WhiteLabelContext.jsx
 *
 * Detects whether the app is running on a custom (white-label) domain and,
 * if so, fetches the branding config from the PlanIt backend.
 *
 * Usage:
 *   const { wl, isWL, resolved } = useWhiteLabel();
 *
 * wl shape (when active):
 *   {
 *     clientName: 'La Taverna Dayton',
 *     tier: 'pro',           // basic | pro | enterprise
 *     branding: {
 *       companyName: 'La Taverna',
 *       logoUrl: '...',
 *       faviconUrl: '...',
 *       primaryColor: '#b45309',
 *       accentColor: '#92400e',
 *       fontFamily: 'Inter',
 *       hidePoweredBy: true,
 *       customCss: '',
 *     },
 *     status: 'active',      // active | trial | suspended
 *   }
 *
 * Heartbeat:
 *   Sends POST /api/whitelabel/heartbeat at most once every 23 hours.
 *   Stores last-sent time in localStorage under "wl_hb".
 *   A failed heartbeat is silently swallowed — it only affects the admin
 *   dashboard counters, not the guest experience.
 */

import { createContext, useContext, useEffect, useState } from 'react';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');

// Domains that are "native" PlanIt — never attempt WL resolution on these.
const NATIVE_HOSTS = [
  'localhost',
  '127.0.0.1',
  'planitapp.onrender.com',
  // Add your main prod domain here if it differs, e.g. 'app.planit.com'
  ...(import.meta.env.VITE_MAIN_DOMAIN ? [import.meta.env.VITE_MAIN_DOMAIN] : []),
];

function isCustomDomain(hostname) {
  return !NATIVE_HOSTS.some(h => hostname === h || hostname.endsWith('.' + h));
}

const WhiteLabelContext = createContext({
  wl:       null,    // branding object or null
  isWL:     false,   // true if on a custom domain and resolved successfully
  resolved: false,   // true once the lookup has finished (success or not)
  suspended: false,  // true if this domain's WL is suspended
});

export function useWhiteLabel() {
  return useContext(WhiteLabelContext);
}

async function sendHeartbeat(domain, licenseKey) {
  // Throttle: once per 23 hours
  const KEY = 'wl_hb';
  try {
    const last = parseInt(localStorage.getItem(KEY) || '0', 10);
    if (Date.now() - last < 23 * 60 * 60 * 1000) return;
    await fetch(`${API_URL}/whitelabel/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain, licenseKey }),
    });
    localStorage.setItem(KEY, String(Date.now()));
  } catch {
    // Silent — heartbeat failure doesn't affect the guest experience
  }
}

export function WhiteLabelProvider({ children }) {
  const [state, setState] = useState({ wl: null, isWL: false, resolved: false, suspended: false });

  useEffect(() => {
    const hostname = window.location.hostname;

    if (!isCustomDomain(hostname)) {
      setState({ wl: null, isWL: false, resolved: true, suspended: false });
      return;
    }

    // Custom domain — resolve branding
    fetch(`${API_URL}/whitelabel/resolve?domain=${encodeURIComponent(hostname)}`, { cache: 'no-store' })
      .then(async r => {
        if (r.status === 404) {
          // Domain not registered — just run normally, no branding
          setState({ wl: null, isWL: false, resolved: true, suspended: false });
          return;
        }
        if (!r.ok) throw new Error('resolve failed');
        const data = await r.json();
        setState({ wl: data, isWL: true, resolved: true, suspended: false });
        // Fire heartbeat (throttled)
        sendHeartbeat(hostname, null);
      })
      .catch(() => {
        // Network error — run as normal PlanIt, don't block the page
        setState({ wl: null, isWL: false, resolved: true, suspended: false });
      });
  }, []);

  return (
    <WhiteLabelContext.Provider value={state}>
      {children}
    </WhiteLabelContext.Provider>
  );
}
