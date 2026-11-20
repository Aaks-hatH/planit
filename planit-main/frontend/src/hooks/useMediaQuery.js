import { useState, useEffect } from 'react';

/**
 * useMediaQuery: live `matchMedia` result. Reads the real value on the first render (no flash of
 * the wrong layout) and stays in sync when the window is resized or the phone is rotated.
 */
export function useMediaQuery(query, fallback = false) {
  const read = () => {
    try {
      if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') return window.matchMedia(query).matches;
    } catch { /* ignore */ }
    return fallback;
  };
  const [matches, setMatches] = useState(read);

  useEffect(() => {
    let mq;
    try { mq = window.matchMedia(query); } catch { return undefined; }
    const on = () => setMatches(mq.matches);
    on();
    if (mq.addEventListener) mq.addEventListener('change', on); else mq.addListener?.(on);
    return () => { if (mq.removeEventListener) mq.removeEventListener('change', on); else mq.removeListener?.(on); };
  }, [query]);

  return matches;
}

/** Matches Tailwind's `sm` breakpoint. Below it we show bottom sheets, at or above it popovers and dialogs. */
export const useIsDesktop = () => useMediaQuery('(min-width: 640px)', true);

export default useMediaQuery;
