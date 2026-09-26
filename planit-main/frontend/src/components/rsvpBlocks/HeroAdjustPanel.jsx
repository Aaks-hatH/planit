/**
 * frontend/src/components/rsvpBlocks/HeroAdjustPanel.jsx
 *
 * Lets an organizer fix a hero image that the auto-cover-crop cut too
 * aggressively, and move the overlaid title/date/location off of whatever
 * part of the photo it's covering up.
 *
 * - Drag directly on the photo (or use the arrow pad) to choose what part
 *   of the image stays in frame — this writes content.imagePosition (or
 *   content.imagePositionDesktop while the Desktop tab is active).
 * - The zoom slider/buttons scale the image — this writes content.imageZoom
 *   / content.imageZoomDesktop.
 * - The Fit toggle switches between cropping to fill (Cover) and showing
 *   the whole photo letterboxed (Full photo) — content.imageFit /
 *   content.imageFitDesktop.
 * - Drag the "T" handle (or use its arrow pad) to move where the title
 *   sits over the photo — this writes content.textPosition, shared by both
 *   breakpoints since it's a design choice about the overlay, not the photo.
 *
 * All of the above are optional on the content object. Undefined means "use
 * the old, un-adjusted rendering" (see HeroBlock in blocks.jsx), so existing
 * hero sections never shift on their own.
 *
 * DESKTOP VS MOBILE — two independent images:
 * The live page shows the hero at a DIFFERENT aspect ratio on desktop than
 * on mobile (see HeroBlock's `aspect-[4/5] md:aspect-[16/9]`), and an
 * organizer can now upload a completely separate photo for each (some
 * banners just don't translate across screen shapes — see the tooltip on
 * "Editing for" below). Each device tab therefore has its OWN image, zoom,
 * position and fit; whichever wasn't customized falls back to the other's
 * values so a hero with a single shared image behaves exactly as it always
 * has. The floating corner preview always shows the OTHER tab live so a
 * change made for one screen size doesn't accidentally break the other.
 */
import React, { useCallback, useRef, useState } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw, Monitor, Smartphone, Crop, Maximize } from 'lucide-react';
import InfoTooltip from './InfoTooltip';

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

// Must stay in sync with the aspect classes on HeroBlock in blocks.jsx —
// these are the two real breakpoints guests see.
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

export default function HeroAdjustPanel({
  imageUrl, imageZoom, imagePosition, imageFit,
  imageUrlDesktop, imageZoomDesktop, imagePositionDesktop, imageFitDesktop,
  textPosition, onChange,
}) {
  const frameRef = useRef(null);
  const [primary, setPrimary] = useState('desktop'); // which tab is the interactive one

  const textX = textPosition?.x ?? 50;
  const textY = textPosition?.y ?? 82;

  // Resolve a device's effective image/zoom/position/fit, falling back to
  // the other device's values when this one hasn't been customized — this
  // is what keeps a single shared image behaving exactly as before.
  const resolve = (device) => {
    const isDesktop = device === 'desktop';
    const url = isDesktop ? (imageUrlDesktop || imageUrl) : (imageUrl || imageUrlDesktop);
    const zoom = (isDesktop ? imageZoomDesktop : imageZoom) || (isDesktop ? imageZoom : imageZoomDesktop) || 100;
    const posSelf = isDesktop ? imagePositionDesktop : imagePosition;
    const posOther = isDesktop ? imagePosition : imagePositionDesktop;
    const x = posSelf?.x ?? posOther?.x ?? 50;
    const y = posSelf?.y ?? posOther?.y ?? 50;
    const fitSelf = isDesktop ? imageFitDesktop : imageFit;
    const fitOther = isDesktop ? imageFit : imageFitDesktop;
    const fit = (fitSelf || fitOther) === 'contain' ? 'contain' : 'cover';
    const hasCustomImage = isDesktop ? !!imageUrlDesktop : !!(imageUrlDesktop && imageUrl && imageUrl !== imageUrlDesktop);
    return { url, zoom, x, y, fit, hasCustomImage };
  };

  const isDesktop = primary === 'desktop';
  const zoomKey = isDesktop ? 'imageZoomDesktop' : 'imageZoom';
  const positionKey = isDesktop ? 'imagePositionDesktop' : 'imagePosition';
  const fitKey = isDesktop ? 'imageFitDesktop' : 'imageFit';

  const active = resolve(primary);

  const setFromPointer = useCallback((clientX, clientY, target) => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = clamp(((clientX - rect.left) / rect.width) * 100, 0, 100);
    const y = clamp(((clientY - rect.top) / rect.height) * 100, 0, 100);
    if (target === 'image') {
      onChange({ [positionKey]: { x: Math.round(x), y: Math.round(y) } });
    } else {
      onChange({ textPosition: { x: clamp(Math.round(x), 8, 92), y: clamp(Math.round(y), 8, 92) } });
    }
  }, [onChange, positionKey]);

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

  const nudgeImage = (dx, dy) => onChange({ [positionKey]: { x: clamp(active.x + dx, 0, 100), y: clamp(active.y + dy, 0, 100) } });
  const nudgeText = (dx, dy) => onChange({ textPosition: { x: clamp(textX + dx, 8, 92), y: clamp(textY + dy, 8, 92) } });
  // Floor used to stop at 100 — you could only ever zoom further IN past the
  // normal crop, never back OUT of it. That left no way to fix a photo (like
  // a tall poster/invite) that "cover" was already cropping too tightly.
  // 50 lets the photo shrink back down inside the frame instead.
  const setZoom = (z) => onChange({ [zoomKey]: clamp(z, 50, 250) });
  const setFit = (f) => onChange({ [fitKey]: f === 'cover' ? undefined : f });

  if (!imageUrl && !imageUrlDesktop) {
    return (
      <p className="text-xs opacity-50 italic">
        Choose or upload an image above — then you can crop and position it here.
      </p>
    );
  }

  const secondaryKey = isDesktop ? 'mobile' : 'desktop';
  const secondary = resolve(secondaryKey);
  const Primary = DEVICE[primary];
  const Secondary = DEVICE[secondaryKey];

  const styleFor = (d) => ({
    objectPosition: `${d.x}% ${d.y}%`,
    transform: d.zoom !== 100 ? `scale(${d.zoom / 100})` : undefined,
    transformOrigin: `${d.x}% ${d.y}%`,
  });

  return (
    <div className="flex flex-col gap-3">
      {/* device switch — each tab now has its own image + crop, not just a shared preview */}
      <div className="flex items-center justify-between">
        <ControlLabel hint="Desktop and mobile can each have their own image, zoom, and crop — handy since a banner that looks great on a phone (tall) can leave dead space or crop badly on a wide desktop screen, and vice versa. Upload a second image above ('Use a different image for desktop') if one photo doesn't work for both; otherwise adjustments here apply to whichever one is shared.">
          Editing for
        </ControlLabel>
        <div className="flex rounded-full bg-white/5 p-0.5">
          {Object.entries(DEVICE).map(([key, d]) => {
            const Icon = d.icon;
            const custom = resolve(key).hasCustomImage;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setPrimary(key)}
                className={`flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full transition-colors ${primary === key ? 'bg-white/15 text-white' : 'opacity-50 hover:opacity-80'}`}
              >
                <Icon size={11} /> {d.label}
                {custom && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Has its own image" />}
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
          {active.fit === 'contain' && (
            <img
              src={active.url}
              alt=""
              aria-hidden="true"
              draggable={false}
              className="absolute inset-0 w-full h-full object-cover scale-125 blur-2xl opacity-50 pointer-events-none"
            />
          )}
          <img
            src={active.url}
            alt=""
            draggable={false}
            className={`absolute inset-0 w-full h-full pointer-events-none ${active.fit === 'contain' ? 'object-contain' : 'object-cover'}`}
            style={styleFor(active)}
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

        {/* floating live preview of the OTHER breakpoint — its own image/crop */}
        <div className="absolute -bottom-2.5 -right-2.5 w-[30%] min-w-[64px] max-w-[92px] z-10">
          <div className={`relative w-full ${Secondary.aspect} rounded-md overflow-hidden border-2 border-[#0a0a12] shadow-lg ring-1 ring-white/15 bg-black/60`}>
            {secondary.fit === 'contain' && (
              <img
                src={secondary.url}
                alt=""
                aria-hidden="true"
                draggable={false}
                className="absolute inset-0 w-full h-full object-cover scale-125 blur-2xl opacity-50 pointer-events-none"
              />
            )}
            <img
              src={secondary.url}
              alt=""
              draggable={false}
              className={`absolute inset-0 w-full h-full pointer-events-none ${secondary.fit === 'contain' ? 'object-contain' : 'object-cover'}`}
              style={styleFor(secondary)}
            />
          </div>
          <div className="flex items-center justify-center gap-0.5 mt-0.5 text-[8px] uppercase tracking-wide opacity-50">
            <Secondary.icon size={8} /> {Secondary.label}
          </div>
        </div>
      </div>

      <p className="text-[11px] opacity-40 -mt-1">
        Drag the photo to choose what stays in frame. Drag the "T" to move the title. The small corner preview shows the other screen size live, with its own image if you set one.
      </p>

      <div className="flex items-center gap-2">
        <ControlLabel hint="Cover fills the whole banner and crops whatever doesn't fit — good for wide photos. Full photo shows the entire image with no cropping (letterboxed) — use this for a poster, invite, or anything where the whole image matters, like a portrait-shaped graphic.">
          <span className="w-auto">Fit ({Primary.label})</span>
        </ControlLabel>
        <div className="flex rounded-full bg-white/5 p-0.5">
          <button
            type="button"
            onClick={() => setFit('cover')}
            className={`flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full transition-colors ${active.fit === 'cover' ? 'bg-white/15 text-white' : 'opacity-50 hover:opacity-80'}`}
          >
            <Crop size={11} /> Cover
          </button>
          <button
            type="button"
            onClick={() => setFit('contain')}
            className={`flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full transition-colors ${active.fit === 'contain' ? 'bg-white/15 text-white' : 'opacity-50 hover:opacity-80'}`}
          >
            <Maximize size={11} /> Full photo
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <ControlLabel hint="Scales the photo. Above 100% pushes a distracting edge (like a stray head or a wall outlet) out of frame; below 100% pulls back if it's already cropped too tight. Doesn't affect image quality on upload, only how much of it is visible.">
          <span className="w-auto">Zoom ({Primary.label})</span>
        </ControlLabel>
        <button type="button" onClick={() => setZoom(active.zoom - 10)} className="p-1 rounded bg-white/5 hover:bg-white/10 shrink-0">
          <ZoomOut size={13} />
        </button>
        <input type="range" min={50} max={250} step={5} value={active.zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1" />
        <button type="button" onClick={() => setZoom(active.zoom + 10)} className="p-1 rounded bg-white/5 hover:bg-white/10 shrink-0">
          <ZoomIn size={13} />
        </button>
        <span className="text-[11px] opacity-50 w-9 text-right shrink-0">{active.zoom}%</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex flex-col items-center gap-0.5">
          <ControlLabel hint="Moves which part of this device's photo is visible, without changing where the title sits on top of it.">Photo</ControlLabel>
          <button type="button" onClick={() => nudgeImage(0, -5)} className="p-1 rounded bg-white/5 hover:bg-white/10"><ChevronUp size={13} /></button>
          <div className="flex gap-0.5">
            <button type="button" onClick={() => nudgeImage(-5, 0)} className="p-1 rounded bg-white/5 hover:bg-white/10"><ChevronLeft size={13} /></button>
            <button type="button" onClick={() => nudgeImage(5, 0)} className="p-1 rounded bg-white/5 hover:bg-white/10"><ChevronRight size={13} /></button>
          </div>
          <button type="button" onClick={() => nudgeImage(0, 5)} className="p-1 rounded bg-white/5 hover:bg-white/10"><ChevronDown size={13} /></button>
        </div>

        <div className="flex flex-col items-center gap-0.5">
          <ControlLabel hint="Moves the title, date and location text — the photo underneath stays put, and this is shared by both screen sizes. Try a corner that isn't covering a face or focal point.">Title</ControlLabel>
          <button type="button" onClick={() => nudgeText(0, -5)} className="p-1 rounded bg-white/5 hover:bg-white/10"><ChevronUp size={13} /></button>
          <div className="flex gap-0.5">
            <button type="button" onClick={() => nudgeText(-5, 0)} className="p-1 rounded bg-white/5 hover:bg-white/10"><ChevronLeft size={13} /></button>
            <button type="button" onClick={() => nudgeText(5, 0)} className="p-1 rounded bg-white/5 hover:bg-white/10"><ChevronRight size={13} /></button>
          </div>
          <button type="button" onClick={() => nudgeText(0, 5)} className="p-1 rounded bg-white/5 hover:bg-white/10"><ChevronDown size={13} /></button>
        </div>

        <button
          type="button"
          onClick={() => onChange({
            imageZoom: undefined, imagePosition: undefined, imageFit: undefined,
            imageZoomDesktop: undefined, imagePositionDesktop: undefined, imageFitDesktop: undefined,
            textPosition: undefined,
          })}
          className="ml-auto self-start flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-white/5 hover:bg-white/10 opacity-70 hover:opacity-100"
        >
          <RotateCcw size={11} /> Reset both
        </button>
      </div>
    </div>
  );
}
