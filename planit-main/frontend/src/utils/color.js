// Contrast helpers so brand colours never produce unreadable text.
// readableOn(bg)   → '#0a0a0a' or '#ffffff', whichever reads better ON that colour (buttons, badges).
// textOnLight(hex) → the colour, darkened just enough to read on a white background (links, labels).
const parse = (hex) => {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
};
const lum = ([r, g, b]) => {
  const [R, G, B] = [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
};
const toHex = (rgb) => '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

export function readableOn(bg, fallback = '#ffffff') {
  const rgb = parse(bg);
  return rgb ? (lum(rgb) > 0.179 ? '#0a0a0a' : '#ffffff') : fallback;
}

export function textOnLight(hex) {
  const rgb = parse(hex);
  if (!rgb) return null;
  for (let t = 0; t <= 0.9; t += 0.05) {
    const mixed = rgb.map((v) => v * (1 - t));
    if (1.05 / (lum(mixed) + 0.05) >= 4.5) return toHex(mixed);
  }
  return '#0a0a0a';
}
