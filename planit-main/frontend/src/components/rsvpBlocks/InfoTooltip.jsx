/**
 * frontend/src/components/rsvpBlocks/InfoTooltip.jsx
 *
 * Small "i" affordance that sits next to a label/control and reveals a short
 * explanation on hover (desktop) or tap (mobile/touch). Used throughout the
 * Hero block's builder UI so nothing relies on the organizer already knowing
 * how the generate/upload/crop system works.
 *
 * Usage: <InfoTooltip text="Explain the thing here." />
 * Optional `side` ('top' | 'bottom' | 'left' | 'right', default 'top')
 * controls which way the popover opens, for controls near an edge.
 */
import React, { useState, useRef, useEffect } from 'react';
import { Info } from 'lucide-react';

const SIDE_CLASSES = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

export default function InfoTooltip({ text, side = 'top' }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDocPointerDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onDocPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDocPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!text) return null;

  return (
    <span className="relative inline-flex" ref={wrapRef}>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o); }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-label="More info"
        aria-expanded={open}
        className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-white/35 hover:text-white/90 focus:text-white/90 hover:bg-white/10 focus:bg-white/10 outline-none transition-colors shrink-0"
      >
        <Info size={12} strokeWidth={2.25} />
      </button>
      {open && (
        <span
          role="tooltip"
          className={`absolute z-50 w-56 rounded-lg border border-white/10 bg-[#16161f] px-2.5 py-2 text-[11px] leading-relaxed text-white/75 shadow-2xl pointer-events-none ${SIDE_CLASSES[side] || SIDE_CLASSES.top}`}
        >
          {text}
        </span>
      )}
    </span>
  );
}
