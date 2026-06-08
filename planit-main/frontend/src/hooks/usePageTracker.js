import { useEffect, useRef } from 'react';
import { useLocation }      from 'react-router-dom';
import { initTracker, trackPageChange, flushTracker } from '../services/tracker';

let _initialised = false;

/**
 * usePageTracker
 *
 * Drop this hook into a component that lives inside <Router> (e.g. the
 * PageTrackerMount component in App.jsx). It:
 *  - Initialises the tracker once on mount (tracker checks consent internally)
 *  - Fires a page_view every time the pathname changes — but only if consent
 *    was granted (enqueue() is a no-op when _trackingEnabled is false)
 *  - Flushes the queue on unmount (good hygiene)
 *
 * Returns nothing — purely a side-effect hook.
 *
 * CONSENT NOTE
 * ────────────
 * This hook does NOT need to check consent itself. The tracker service
 * handles consent internally:
 *   • initTracker() reads localStorage and either starts tracking or waits
 *     for the `planit:consent` event fired by ConsentBanner.
 *   • All enqueue() calls in tracker.js are gated on _trackingEnabled.
 *   • Calling trackPageChange() when tracking is disabled is a safe no-op.
 */
export function usePageTracker() {
  const { pathname } = useLocation();
  const prevPath = useRef(null);

  // Initialise once — tracker.js handles the consent logic internally
  useEffect(() => {
    if (_initialised) return;
    _initialised = true;
    initTracker();
    return () => { flushTracker(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Track every navigation — safe to call even if tracking is disabled,
  // because trackPageChange() → enqueue() → returns early if !_trackingEnabled
  useEffect(() => {
    if (prevPath.current === pathname) return; // same page, no-op
    trackPageChange(pathname);
    prevPath.current = pathname;
  }, [pathname]);
}
