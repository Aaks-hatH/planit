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
 *
 * IMPORTANT — why there are two preview frames:
 * The live page shows the hero at a DIFFERENT aspect ratio on desktop than
 * on mobile (see HeroBlock's `aspect-[4/5] md:aspect-[16/9]` — a tall 4:5
 * box on phones, a wide 16:9 box on desktop). A single fixed-ratio preview
 * here would only ever match one of those, so a crop that looked perfect
 * while editing could come out badly framed on the other. Both frames below
 * are kept in exact sync with those two live breakpoints, share the same
 * position/zoom values, and update together — drag on the larger "editing"
 * frame, keep an eye on the smaller one so the crop works on both.
 */
import React, { useCallback, useRef, useState } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw, Monitor, Smartphone } from 'lucide-react';
import InfoTooltip from './InfoTooltip';

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

// Must stay in sync with the `cover ? ... : ...` aspect classes on HeroBlock
// in blocks.jsx — these are the two real breakpoints guests see.
const DEVICE = {
  desktop: { label: 'Desktop', aspect: 'aspect-[16/9]', icon: Monitor },
  mobile: { label: 'Mobile', aspect: 'aspect-[4/5]', icon: Smartphone },
};

function ControlLabel({ children, hint }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide opacity-50">
      {children}
      {hint && <InfoTooltip text={hint} />}
    </span>
  );
}

export default function HeroAdjustPanel({ imageUrl, imageZoom, imagePosition, textPosition, onChange }) {
  const frameRef = useRef(null);
  const [primary, setPrimary] = useState('desktop'); // which frame is the interactive one

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
    return (
      <p className="text-xs opacity-50 italic">
        Choose or upload an image above — then you can crop and position it here.
      </p>
    );
  }

  const secondaryKey = primary === 'desktop' ? 'mobile' : 'desktop';
  const Primary = DEVICE[primary];
  const Secondary = DEVICE[secondaryKey];

  const imgStyle = {
    objectPosition: `${imgX}% ${imgY}%`,
    transform: zoom !== 100 ? `scale(${zoom / 100})` : undefined,
    transformOrigin: `${imgX}% ${imgY}%`,
  };

  return (
    <div className="flex flex-col gap-3">
      {/* device switch — which breakpoint is the interactive/drag frame */}
      <div className="flex items-center justify-between">
        <ControlLabel hint="Position and zoom are shared by both breakpoints — this only chooses which preview you drag on. Watch the smaller preview to make sure the crop still works there too.">
          Editing for
        </ControlLabel>
        <div className="flex rounded-full bg-white/5 p-0.5">
          {Object.entries(DEVICE).map(([key, d]) => {
            const Icon = d.icon;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setPrimary(key)}
                className={`flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full transition-colors ${primary === key ? 'bg-white/15 text-white' : 'opacity-50 hover:opacity-80'}`}
              >
                <Icon size={11} /> {d.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* main interactive frame */}
      <div className="relative">
        <div
          ref={frameRef}
          className={`relative w-full ${Primary.aspect} rounded-lg overflow-hidden border border-white/10 bg-black/40 cursor-crosshair select-none`}
          onPointerDown={startDrag('image')}
        >
          <img
            src={imageUrl}
            alt=""
            draggable={false}
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            style={imgStyle}
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

        {/* floating live preview of the OTHER breakpoint, same position/zoom */}
        <div className="absolute -bottom-2.5 -right-2.5 w-[30%] min-w-[64px] max-w-[92px] z-10">
          <div className={`relative w-full ${Secondary.aspect} rounded-md overflow-hidden border-2 border-[#0a0a12] shadow-lg ring-1 ring-white/15 bg-black/60`}>
            <img
              src={imageUrl}
              alt=""
              draggable={false}
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              style={imgStyle}
            />
          </div>
          <div className="flex items-center justify-center gap-0.5 mt-0.5 text-[8px] uppercase tracking-wide opacity-50">
            <Secondary.icon size={8} /> {Secondary.label}
          </div>
        </div>
      </div>

      <p className="text-[11px] opacity-40 -mt-1">
        Drag the photo to choose what stays in frame. Drag the "T" to move the title. The small corner preview shows the other screen size live.
      </p>

      <div className="flex items-center gap-2">
        <ControlLabel hint="Zooms the photo in past its normal crop so you can push a distracting edge (like a stray head or a wall outlet) out of frame. Doesn't affect image quality on upload, only how much of it is visible.">
          <span className="w-auto">Zoom</span>
        </ControlLabel>
        <button type="button" onClick={() => setZoom(zoom - 10)} className="p-1 rounded bg-white/5 hover:bg-white/10 shrink-0">
          <ZoomOut size={13} />
        </button>
        <input type="range" min={100} max={250} step={5} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1" />
        <button type="button" onClick={() => setZoom(zoom + 10)} className="p-1 rounded bg-white/5 hover:bg-white/10 shrink-0">
          <ZoomIn size={13} />
        </button>
        <span className="text-[11px] opacity-50 w-9 text-right shrink-0">{zoom}%</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex flex-col items-center gap-0.5">
          <ControlLabel hint="Moves which part of the photo is visible, without changing where the title sits on top of it.">Photo</ControlLabel>
          <button type="button" onClick={() => nudgeImage(0, -5)} className="p-1 rounded bg-white/5 hover:bg-white/10"><ChevronUp size={13} /></button>
          <div className="flex gap-0.5">
            <button type="button" onClick={() => nudgeImage(-5, 0)} className="p-1 rounded bg-white/5 hover:bg-white/10"><ChevronLeft size={13} /></button>
            <button type="button" onClick={() => nudgeImage(5, 0)} className="p-1 rounded bg-white/5 hover:bg-white/10"><ChevronRight size={13} /></button>
          </div>
          <button type="button" onClick={() => nudgeImage(0, 5)} className="p-1 rounded bg-white/5 hover:bg-white/10"><ChevronDown size={13} /></button>
        </div>

        <div className="flex flex-col items-center gap-0.5">
          <ControlLabel hint="Moves the title, date and location text — the photo underneath stays put. Try a corner that isn't covering a face or focal point.">Title</ControlLabel>
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
