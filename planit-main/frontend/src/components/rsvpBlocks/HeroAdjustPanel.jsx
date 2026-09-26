/**
 * frontend/src/components/rsvpBlocks/HeroAdjustPanel.jsx
 *
 * Lets an organizer fix a hero image that the auto-cover-crop cut too
 * aggressively, and move the overlaid title/date/location off of whatever
 * part of the photo it's covering up.
 *
 * - Drag directly on the photo (or use the arrow pad) to choose what part
 *   of the image stays in frame — this writes content.imagePosition.
 * - The zoom slider/buttons scale the image in past its normal
 *   object-fit:cover crop, so you can push distracting edges out of frame —
 *   this writes content.imageZoom.
 * - Drag the "T" handle (or use its arrow pad) to move where the title
 *   sits over the photo — this writes content.textPosition.
 *
 * All three are optional on the content object. Undefined means "use the
 * old, un-adjusted rendering" (see HeroBlock in blocks.jsx), so existing
 * hero sections render exactly as before until someone opens this panel.
 */
import React, { useCallback, useRef } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

export default function HeroAdjustPanel({ imageUrl, imageZoom, imagePosition, textPosition, onChange }) {
  const frameRef = useRef(null);

  const zoom = imageZoom || 100;
  const imgX = imagePosition?.x ?? 50;
  const imgY = imagePosition?.y ?? 50;
  const textX = textPosition?.x ?? 50;
  const textY = textPosition?.y ?? 82;

  const setFromPointer = useCallback((clientX, clientY, target) => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = clamp(((clientX - rect.left) / rect.width) * 100, 0, 100);
    const y = clamp(((clientY - rect.top) / rect.height) * 100, 0, 100);
    if (target === 'image') {
      onChange({ imagePosition: { x: Math.round(x), y: Math.round(y) } });
    } else {
      onChange({ textPosition: { x: clamp(Math.round(x), 8, 92), y: clamp(Math.round(y), 8, 92) } });
    }
  }, [onChange]);

  const startDrag = (target) => (e) => {
    e.preventDefault();
    setFromPointer(e.clientX, e.clientY, target);
    const move = (ev) => setFromPointer(ev.clientX, ev.clientY, target);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const nudgeImage = (dx, dy) => onChange({ imagePosition: { x: clamp(imgX + dx, 0, 100), y: clamp(imgY + dy, 0, 100) } });
  const nudgeText = (dx, dy) => onChange({ textPosition: { x: clamp(textX + dx, 8, 92), y: clamp(textY + dy, 8, 92) } });
  const setZoom = (z) => onChange({ imageZoom: clamp(z, 100, 250) });

  if (!imageUrl) {
    return <p className="text-xs opacity-50 italic">Choose or upload an image above — then you can crop and position it here.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={frameRef}
        className="relative w-full aspect-video rounded-lg overflow-hidden border border-white/10 bg-black/40 cursor-crosshair select-none"
        onPointerDown={startDrag('image')}
      >
        <img
          src={imageUrl}
          alt=""
          draggable={false}
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          style={{
            objectPosition: `${imgX}% ${imgY}%`,
            transform: zoom !== 100 ? `scale(${zoom / 100})` : undefined,
            transformOrigin: `${imgX}% ${imgY}%`,
          }}
        />
        {/* title placement handle */}
        <div
          role="button"
          aria-label="Drag to move the title"
          className="absolute w-6 h-6 -ml-3 -mt-3 rounded-full border-2 border-white bg-black/60 flex items-center justify-center text-[9px] font-semibold text-white cursor-move shadow"
          style={{ left: `${textX}%`, top: `${textY}%` }}
          onPointerDown={(e) => { e.stopPropagation(); startDrag('text')(e); }}
          title="Drag to move the title"
        >
          T
        </div>
      </div>
      <p className="text-[11px] opacity-40 -mt-1">Drag the photo to choose what stays in frame. Drag the "T" to move the title.</p>

      <div className="flex items-center gap-2">
        <span className="text-[11px] uppercase tracking-wide opacity-50 w-14 shrink-0">Zoom</span>
        <button type="button" onClick={() => setZoom(zoom - 10)} className="p-1 rounded bg-white/5 hover:bg-white/10">
          <ZoomOut size={13} />
        </button>
        <input type="range" min={100} max={250} step={5} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1" />
        <button type="button" onClick={() => setZoom(zoom + 10)} className="p-1 rounded bg-white/5 hover:bg-white/10">
          <ZoomIn size={13} />
        </button>
        <span className="text-[11px] opacity-50 w-9 text-right shrink-0">{zoom}%</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[10px] uppercase tracking-wide opacity-50 mb-0.5">Photo</span>
          <button type="button" onClick={() => nudgeImage(0, -5)} className="p-1 rounded bg-white/5 hover:bg-white/10"><ChevronUp size={13} /></button>
          <div className="flex gap-0.5">
            <button type="button" onClick={() => nudgeImage(-5, 0)} className="p-1 rounded bg-white/5 hover:bg-white/10"><ChevronLeft size={13} /></button>
            <button type="button" onClick={() => nudgeImage(5, 0)} className="p-1 rounded bg-white/5 hover:bg-white/10"><ChevronRight size={13} /></button>
          </div>
          <button type="button" onClick={() => nudgeImage(0, 5)} className="p-1 rounded bg-white/5 hover:bg-white/10"><ChevronDown size={13} /></button>
        </div>

        <div className="flex flex-col items-center gap-0.5">
          <span className="text-[10px] uppercase tracking-wide opacity-50 mb-0.5">Title</span>
          <button type="button" onClick={() => nudgeText(0, -5)} className="p-1 rounded bg-white/5 hover:bg-white/10"><ChevronUp size={13} /></button>
          <div className="flex gap-0.5">
            <button type="button" onClick={() => nudgeText(-5, 0)} className="p-1 rounded bg-white/5 hover:bg-white/10"><ChevronLeft size={13} /></button>
            <button type="button" onClick={() => nudgeText(5, 0)} className="p-1 rounded bg-white/5 hover:bg-white/10"><ChevronRight size={13} /></button>
          </div>
          <button type="button" onClick={() => nudgeText(0, 5)} className="p-1 rounded bg-white/5 hover:bg-white/10"><ChevronDown size={13} /></button>
        </div>

        <button
          type="button"
          onClick={() => onChange({ imageZoom: undefined, imagePosition: undefined, textPosition: undefined })}
          className="ml-auto self-start flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-white/5 hover:bg-white/10 opacity-70 hover:opacity-100"
        >
          <RotateCcw size={11} /> Reset
        </button>
      </div>
    </div>
  );
}
