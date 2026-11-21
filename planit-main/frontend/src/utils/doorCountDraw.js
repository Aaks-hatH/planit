// ═══════════════════════════════════════════════════════════════════════════
// DOOR COUNT — overlay drawing (canvas)
//
// Two looks over the same data:
//   - normal view: boxes and ids drawn over the live video (staff setup only)
//   - privacy view: a dark background with abstract silhouettes, no video, so
//     nothing identifiable is ever shown on a door-side screen
// ═══════════════════════════════════════════════════════════════════════════

import { gateGeometry, gateHandles, predictBox } from './doorCount';

export const ACCENT = '#4DA3FF';
const IN_COLOR = '#3ECF8E', OUT_COLOR = '#F5B942';

function silhouette(ctx, x, y, w, h) {
  // head circle on top, rounded body below: a person-shaped blob, not a face
  const head = Math.min(w, h * 0.22);
  ctx.beginPath();
  ctx.arc(x + w / 2, y + head / 2, head / 2, 0, Math.PI * 2);
  ctx.fill();
  const r = Math.min(w * 0.4, 18);
  const by = y + head * 1.1, bh = h - head * 1.1;
  ctx.beginPath();
  ctx.moveTo(x + r, by);
  ctx.arcTo(x + w, by, x + w, by + bh, r);
  ctx.arcTo(x + w, by + bh, x, by + bh, r);
  ctx.arcTo(x, by + bh, x, by, r);
  ctx.arcTo(x, by, x + w, by, r);
  ctx.fill();
}

/** o = { tracks, now, gate, mode: 'one' | 'two' | 'both', flip, roi, flash, privacy, handles } */
export function drawOverlay(ctx, W, H, o) {
  ctx.clearRect(0, 0, W, H);
  if (o.privacy) { ctx.fillStyle = '#05050f'; ctx.fillRect(0, 0, W, H); }
  const unit = Math.max(2, W / 500);
  ctx.lineWidth = unit;
  ctx.font = `${Math.max(12, W / 60)}px DM Mono, ui-monospace, monospace`;

  if (o.roi && !o.privacy) {
    const r = o.roi;
    ctx.setLineDash([8, 6]); ctx.strokeStyle = OUT_COLOR;
    ctx.strokeRect(r.x * W, r.y * H, r.w * W, r.h * H);
    ctx.setLineDash([]);
  }

  for (const t of o.tracks || []) {
    if (o.now - t.t > 700) continue;
    const p = predictBox(t, o.now);
    if (o.privacy) {
      ctx.fillStyle = 'rgba(77,163,255,0.28)';
      silhouette(ctx, p.x * W, p.y * H, p.w * W, p.h * H);
    } else {
      ctx.strokeStyle = ctx.fillStyle = ACCENT;
      ctx.strokeRect(p.x * W, p.y * H, p.w * W, p.h * H);
      ctx.fillText(`#${t.id}`, p.x * W + 3, p.y * H - 4);
    }
  }

  const two = o.mode !== 'one';
  const geo = gateGeometry(o.gate, W, H, two);
  const fl = o.flash && o.now - o.flash.t < 400 ? o.flash.dir : null;
  const color = fl === 'in' ? IN_COLOR : fl === 'out' ? OUT_COLOR : '#FFFFFF';
  ctx.strokeStyle = ctx.fillStyle = color;
  ctx.lineWidth = unit * 1.5;
  for (const l of geo.lines) { ctx.beginPath(); ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2); ctx.stroke(); }
  if (o.mode === 'both') { // lab view: the centre line is what the one-line presets use
    const c = gateGeometry(o.gate, W, H, false).lines[0];
    ctx.setLineDash([4, 6]); ctx.lineWidth = unit;
    ctx.beginPath(); ctx.moveTo(c.x1, c.y1); ctx.lineTo(c.x2, c.y2); ctx.stroke();
    ctx.setLineDash([]);
  }

  // Arrow from the gate centre toward IN
  const sgn = o.flip ? -1 : 1, k = Math.max(18, W / 40);
  const ax = geo.cx + geo.nx * sgn * (geo.off + k * 0.4), ay = geo.cy + geo.ny * sgn * (geo.off + k * 0.4);
  const bx = ax + geo.nx * sgn * k * 1.4, by = ay + geo.ny * sgn * k * 1.4;
  ctx.lineWidth = unit * 1.5;
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
  ctx.fillText('IN', bx + geo.nx * sgn * 6 - 8, by + geo.ny * sgn * 14 + 4);

  if (o.handles) {
    const h = gateHandles(geo, two);
    const r = Math.max(8, W / 100);
    ctx.fillStyle = ACCENT;
    for (const kind of Object.keys(h)) {
      ctx.beginPath();
      if (kind === 'gap') { // diamond: spacing handle
        ctx.moveTo(h.gap.x, h.gap.y - r); ctx.lineTo(h.gap.x + r, h.gap.y);
        ctx.lineTo(h.gap.x, h.gap.y + r); ctx.lineTo(h.gap.x - r, h.gap.y); ctx.closePath();
      } else ctx.arc(h[kind].x, h[kind].y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
