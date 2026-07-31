import { useEffect, useRef } from 'react';
import { useLocation }      from 'react-router-dom';
import { initGA, trackPageView } from '../services/analytics';
// trackFeature / trackGuestAction for business events still go to the backend
import { trackPageChange, flushTracker } from '../services/tracker';

let _initialised = false;

/**
 * usePageTracker
 *
 * Initialises Google Analytics 4 (consent-gated) and fires a page_view on
 * every SPA route change. Backend feature-event tracking (trackFeature) is
 * unchanged — only the page/session tracking has moved to GA4.
 *
 * Both GA4 and the backend tracker run for every visitor regardless of the
 * cookie banner acknowledgment — see Privacy Policy Section 9.
 */
export function usePageTracker() {
  const { pathname } = useLocation();
  const prevPath = useRef(null);

  // Initialise both analytics sinks once on mount
  useEffect(() => {
    if (_initialised) return;
    _initialised = true;
    initGA();          // Google Analytics 4 — consent-gated
    trackPageChange(pathname); // backend tracker — also consent-gated
    return () => { flushTracker(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fire page_view on every navigation
  useEffect(() => {
    if (prevPath.current === pathname) return;
    trackPageView(pathname);   // → GA4
    trackPageChange(pathname); // → backend (feature events only)
    prevPath.current = pathname;
  }, [pathname]);
}
