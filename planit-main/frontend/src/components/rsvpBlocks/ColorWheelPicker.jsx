/**
 * frontend/src/components/rsvpBlocks/ColorWheelPicker.jsx
 *
 * A small, dependency-free color picker: a draggable hue ring ("the wheel")
 * plus saturation/lightness sliders and a hex field for exact entry. Used
 * for the hero banner's optional background color override.
 *
 * `value` is a hex string (e.g. "#6366f1") or null/undefined, meaning "no
 * override — use the theme default". `defaultColor` is that theme default,
 * shown as the wheel's starting position so the picker opens somewhere
 * sensible instead of at an arbitrary color. onChange(hex | null) is called
 * with a hex string on every pick, or null when the person clears it via
 * "Reset to theme gradient".
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';

function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

function hexToHsl(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
  if (!m) return { h: 235, s: 70, l: 55 }; // a reasonable indigo-ish fallback
  const r = parseInt(m[1], 16) / 255;
  const g = parseInt(m[2], 16) / 255;
  const b = parseInt(m[3], 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h *= 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

export default function ColorWheelPicker({ value, defaultColor = '#6366f1', onChange }) {
  const ringRef = useRef(null);
  const start = hexToHsl(value || defaultColor);
  const [hue, setHue] = useState(start.h);
  const [sat, setSat] = useState(start.s);
  const [light, setLight] = useState(start.l);
  const [hexInput, setHexInput] = useState(value || '');

  // If the stored value changes from outside this component (Reset button,
  // or a page loaded with an existing color), pick up the ring/sliders to
  // match it rather than silently drifting out of sync.
  useEffect(() => {
    setHexInput(value || '');
    if (value) {
      const parsed = hexToHsl(value);
      setHue(parsed.h);
      setSat(parsed.s);
      setLight(parsed.l);
    }
  }, [value]);

  const commit = (nh, ns, nl) => onChange(hslToHex(nh, ns, nl));

  const setFromPointer = useCallback((clientX, clientY) => {
    const rect = ringRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let angle = Math.atan2(clientY - cy, clientX - cx) * (180 / Math.PI);
    angle = (angle + 360) % 360;
    setHue(angle);
    commit(angle, sat, light);
  }, [sat, light]);

  const startDrag = (e) => {
    e.preventDefault();
    setFromPointer(e.clientX, e.clientY);
    const move = (ev) => setFromPointer(ev.clientX, ev.clientY);
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  const angleRad = (hue * Math.PI) / 180;
  const handleLeft = 50 + 42 * Math.cos(angleRad);
  const handleTop = 50 + 42 * Math.sin(angleRad);
  const currentHex = value || hslToHex(hue, sat, light);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-3">
        {/* the wheel */}
        <div
          ref={ringRef}
          onPointerDown={startDrag}
          className="relative w-16 h-16 rounded-full cursor-crosshair shrink-0 shadow-inner select-none"
          style={{ background: 'conic-gradient(from 90deg, red, yellow, lime, cyan, blue, magenta, red)' }}
        >
          <div
            className="absolute inset-[22%] rounded-full pointer-events-none"
            style={{ background: currentHex, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.25)' }}
          />
          <div
            className="absolute w-3.5 h-3.5 -ml-[7px] -mt-[7px] rounded-full border-2 border-white shadow pointer-events-none"
            style={{ left: `${handleLeft}%`, top: `${handleTop}%`, background: currentHex }}
          />
        </div>

        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          <label className="flex items-center gap-2 text-[10px] uppercase tracking-wide opacity-50">
            <span className="w-14 shrink-0">Saturation</span>
            <input
              type="range" min={0} max={100} value={Math.round(sat)}
              onChange={(e) => { const v = Number(e.target.value); setSat(v); commit(hue, v, light); }}
              className="flex-1"
            />
          </label>
          <label className="flex items-center gap-2 text-[10px] uppercase tracking-wide opacity-50">
            <span className="w-14 shrink-0">Lightness</span>
            <input
              type="range" min={0} max={100} value={Math.round(light)}
              onChange={(e) => { const v = Number(e.target.value); setLight(v); commit(hue, sat, v); }}
              className="flex-1"
            />
          </label>
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 rounded border border-white/20 shrink-0" style={{ background: currentHex }} />
            <input
              type="text"
              placeholder={defaultColor}
              value={hexInput}
              onChange={(e) => {
                const v = e.target.value;
                setHexInput(v);
                if (HEX_RE.test(v)) {
                  const parsed = hexToHsl(v);
                  setHue(parsed.h); setSat(parsed.s); setLight(parsed.l);
                  onChange(v);
                }
              }}
              className="flex-1 min-w-0 text-xs rounded bg-white/5 border border-white/10 px-2 py-1 font-mono"
            />
          </div>
        </div>
      </div>

      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="self-start text-[11px] opacity-60 hover:opacity-100 underline"
        >
          Reset to theme gradient
        </button>
      )}
    </div>
  );
}
