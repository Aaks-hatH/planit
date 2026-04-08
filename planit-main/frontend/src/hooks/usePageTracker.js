import { useEffect, useRef } from 'react';
import { useLocation }      from 'react-router-dom';
import { initTracker, trackPageChange, flushTracker } from '../services/tracker';

let _initialised = false;

/**
 * usePageTracker
 *
 * Drop this hook into a component that lives inside <Router> (e.g. a wrapper
 * component in App.jsx). It:
 *  - Initialises the tracker once on mount
 *  - Fires a page_view every time the pathname changes
 *  - Flushes the queue on unmount (rare, but good hygiene)
 *
 * Returns nothing — purely a side-effect hook.
 */
export function usePageTracker() {
  const { pathname } = useLocation();
  const prevPath = useRef(null);

  // Initialise once
  useEffect(() => {
    if (_initialised) return;
    _initialised = true;
    initTracker();
    return () => { flushTracker(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Track every navigation
  useEffect(() => {
    if (prevPath.current === pathname) return; // same page, no-op
    trackPageChange(pathname);
    prevPath.current = pathname;
  }, [pathname]);
}
