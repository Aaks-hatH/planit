import { useState, useEffect } from 'react';
import { Laptop, X } from 'lucide-react';
import { isLikelyMobile } from '../utils/eventRoster';

/**
 * FaceModeMobileNotice — shown above any camera step that actually runs
 * face-api.js detection (enroll selfie, 1:1 verify, event roster capture,
 * event face check-in). Mobile browsers are where face detection is most
 * likely to silently fail to find a face, run out the detection timeout, or
 * behave inconsistently between camera hardware — this doesn't block
 * anything, it just sets expectations up front and points people at a
 * desktop/laptop camera instead.
 */
export default function FaceModeMobileNotice({ className = '' }) {
  const [dismissed, setDismissed] = useState(false);
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    setMobile(isLikelyMobile());
  }, []);

  if (!mobile || dismissed) return null;

  return (
    <div className={`flex items-start gap-2.5 rounded-xl border border-amber-400/25 bg-amber-400/[0.07] px-3.5 py-3 text-xs text-amber-200/90 leading-relaxed ${className}`}>
      <Laptop className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
      <span className="flex-1">
        You&rsquo;re on a phone or tablet. Face detection in this beta is built and tested for a
        desktop/laptop webcam &mdash; on mobile it may fail to find a face, time out, or just not
        work at all. For the best chance of success, open this page on a computer.
      </span>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 text-amber-400/60 hover:text-amber-300"
        aria-label="Dismiss"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
