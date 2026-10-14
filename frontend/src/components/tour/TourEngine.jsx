/**
 * frontend/src/components/tour/TourEngine.jsx
 *
 * Shared spotlight engine for the full-screen feature tours (see
 * FeatureTour.jsx). Not a modal-with-slides — it drives a sequence of
 * `data-tour="<id>"` targets rendered by a recreated mock screen behind it,
 * dims everything else, draws a highlight ring around the current real
 * element, and explains it from a fixed bottom dock. Clicking the
 * highlighted element itself also advances, since these are mock/inert
 * elements (no real navigation happens) and tapping the thing you're
 * reading about is the most natural way to move on.
 *
 * Each variant screen (StandardTour, EnterpriseTour, RsvpTour,
 * TableServiceTour) owns its own recreated layout + `steps` array; this
 * file only owns positioning, dimming, and step navigation.
 */
import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { X, ArrowRight, ArrowLeft, SkipForward } from 'lucide-react';

const PAD = 10;

export default function TourEngine({ steps, onClose, accent = '#6366f1', dark = false, eyebrow }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);
  const rafRef = useRef(null);
  const step = steps[i];

  const measure = useCallback(() => {
    if (!step) return;
    const el = document.querySelector(`[data-tour="${step.id}"]`);
    if (!el) { setRect(null); return; }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, right: r.right, bottom: r.bottom, width: r.width, height: r.height });
  }, [step]);

  useLayoutEffect(() => {
    const el = step ? document.querySelector(`[data-tour="${step.id}"]`) : null;
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    // measure now, then again after the smooth-scroll has had time to settle
    measure();
    const t1 = setTimeout(measure, 120);
    const t2 = setTimeout(measure, 360);
    return () => { clearTimeout(t1); clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  useEffect(() => {
    const onScrollOrResize = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(measure);
    };
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);
    return () => {
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [measure]);

  const next = useCallback(() => { setI(n => (n < steps.length - 1 ? n + 1 : n)); }, [steps.length]);
  const back = useCallback(() => setI(n => Math.max(0, n - 1)), []);
  const isLast = i === steps.length - 1;

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') (isLast ? onClose() : next());
      else if (e.key === 'ArrowLeft') back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [next, back, isLast, onClose]);

  // Click on the real (inert) element itself also advances the tour.
  useEffect(() => {
    if (!step) return;
    const el = document.querySelector(`[data-tour="${step.id}"]`);
    if (!el) return;
    const handler = (e) => { e.preventDefault(); e.stopPropagation(); (isLast ? onClose() : next()); };
    el.addEventListener('click', handler, true);
    return () => el.removeEventListener('click', handler, true);
  }, [step, next, isLast, onClose]);

  if (!step) return null;

  const hasRect = !!rect;
  const dockText = dark ? 'text-white' : 'text-neutral-900';
  const dockSub = dark ? 'text-neutral-400' : 'text-neutral-500';
  const dockBg = dark ? '#15151d' : '#ffffff';
  const dockBorder = dark ? 'border-white/10' : 'border-neutral-200';

  return (
    <div className="fixed inset-0 z-[300]" aria-modal="true" role="dialog">
      <style>{`
        @keyframes tourPulse { 0%,100% { box-shadow: 0 0 0 0 ${accent}66, 0 0 0 3px ${accent}; } 50% { box-shadow: 0 0 0 8px ${accent}00, 0 0 0 3px ${accent}; } }
        .tour-ring { animation: tourPulse 1.8s ease-in-out infinite; }
      `}</style>

      {/* Dim + cutout */}
      {hasRect ? (
        <>
          <div className="fixed left-0 right-0 top-0 transition-all duration-300 pointer-events-auto" style={{ height: Math.max(0, rect.top - PAD), background: 'rgba(0,0,0,0.72)' }} onClick={onClose} />
          <div className="fixed left-0 right-0 bottom-0 transition-all duration-300 pointer-events-auto" style={{ top: rect.bottom + PAD, background: 'rgba(0,0,0,0.72)' }} onClick={onClose} />
          <div className="fixed top-0 bottom-0 left-0 transition-all duration-300 pointer-events-auto" style={{ top: rect.top - PAD, height: rect.height + PAD * 2, width: Math.max(0, rect.left - PAD), background: 'rgba(0,0,0,0.72)' }} onClick={onClose} />
          <div className="fixed top-0 bottom-0 right-0 transition-all duration-300 pointer-events-auto" style={{ top: rect.top - PAD, height: rect.height + PAD * 2, left: rect.right + PAD, background: 'rgba(0,0,0,0.72)' }} onClick={onClose} />
          <div
            className="fixed rounded-xl pointer-events-none transition-all duration-300 tour-ring"
            style={{ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }}
          />
          {/* step-number badge pinned to the highlighted target */}
          <div
            className="fixed flex items-center justify-center rounded-full text-[11px] font-black text-white transition-all duration-300 pointer-events-none"
            style={{ top: rect.top - PAD - 12, left: rect.left - PAD - 12, width: 24, height: 24, background: accent, boxShadow: '0 2px 8px rgba(0,0,0,0.35)' }}
          >
            {i + 1}
          </div>
        </>
      ) : (
        <div className="fixed inset-0 pointer-events-auto" style={{ background: 'rgba(0,0,0,0.72)' }} onClick={onClose} />
      )}

      {/* Close */}
      <button
        onClick={onClose}
        className="fixed top-4 right-4 sm:top-6 sm:right-6 z-[310] w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center backdrop-blur-sm transition-colors"
        title="Close tour"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Bottom dock */}
      <div className="fixed left-0 right-0 bottom-0 z-[310] flex justify-center px-3 pb-3 sm:pb-6 pointer-events-none">
        <div
          className={`pointer-events-auto w-full max-w-lg rounded-2xl border shadow-2xl overflow-hidden ${dockBorder}`}
          style={{ background: dockBg }}
        >
          {/* progress */}
          <div className="h-1 w-full bg-black/10 dark:bg-white/10 flex">
            {steps.map((_, idx) => (
              <div key={idx} className="flex-1 h-full mx-[1px] first:ml-0 last:mr-0 rounded-full overflow-hidden bg-neutral-500/20">
                <div className="h-full rounded-full transition-all duration-300" style={{ width: idx <= i ? '100%' : '0%', background: accent }} />
              </div>
            ))}
          </div>

          <div className="p-4 sm:p-5">
            {eyebrow && (
              <p className="text-[10px] font-black uppercase tracking-widest mb-1.5" style={{ color: accent }}>{eyebrow}</p>
            )}
            <h3 className={`font-display text-lg sm:text-xl font-black mb-1.5 ${dockText}`}>{step.title}</h3>
            <p className={`text-sm leading-snug mb-4 ${dockSub}`}>{step.body}</p>

            <div className="flex items-center justify-between gap-3">
              <button
                onClick={onClose}
                className={`flex items-center gap-1.5 text-xs font-semibold transition-colors ${dark ? 'text-neutral-500 hover:text-neutral-300' : 'text-neutral-400 hover:text-neutral-600'}`}
              >
                <SkipForward className="w-3.5 h-3.5" /> Skip tour
              </button>

              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold mr-1 ${dockSub}`}>{i + 1} / {steps.length}</span>
                {i > 0 && (
                  <button
                    onClick={back}
                    className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-colors ${dark ? 'border-white/15 text-neutral-300 hover:bg-white/10' : 'border-neutral-200 text-neutral-600 hover:bg-neutral-100'}`}
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={isLast ? onClose : next}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-transform hover:scale-105"
                  style={{ background: accent }}
                >
                  {isLast ? 'Done' : 'Next'}
                  {!isLast && <ArrowRight className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
