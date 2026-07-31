// Generates a branded, personalized "share card" image for an event —
// a portrait PNG sized for Instagram/X/iMessage that guests can post or
// send. Pure Canvas 2D, no extra dependency. Every generated card carries
// the PlanIt wordmark, so every share is a small ad for the platform.

const CARD_W = 1080;
const CARD_H = 1350;

const ACCENTS = ['#6366f1', '#f97316', '#10b981', '#f59e0b', '#ec4899', '#3b82f6'];

function pickAccent(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return ACCENTS[hash % ACCENTS.length];
}

async function ensureFontsLoaded() {
  try {
    await Promise.all([
      document.fonts.load("800 90px 'Syne'"),
      document.fonts.load("700 90px 'Syne'"),
      document.fonts.load("500 32px 'DM Sans'"),
      document.fonts.load("400 28px 'DM Sans'"),
      document.fonts.load("500 26px 'DM Mono'"),
    ]);
    await document.fonts.ready;
  } catch { /* fonts API not fully supported — canvas falls back to system fonts */ }
}

function wrapLines(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Draws the share card onto the given canvas element.
 * @param {HTMLCanvasElement} canvas
 * @param {{eventTitle:string, dateLabel:string, location?:string, guestName?:string, goingCount?:number, siteUrl?:string}} info
 */
export async function drawShareCard(canvas, info) {
  const { eventTitle, dateLabel, location, guestName, goingCount, siteUrl } = info;
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  const accent = pickAccent(eventTitle || 'planit');

  await ensureFontsLoaded();

  // Background
  ctx.fillStyle = '#05050f';
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Subtle accent corner block (flat, no gradients/blur — keeps it crisp when re-compressed by social apps)
  ctx.fillStyle = accent;
  ctx.globalAlpha = 0.12;
  ctx.fillRect(0, 0, CARD_W, 10);
  ctx.globalAlpha = 1;

  const padX = 90;
  let y = 150;

  // Eyebrow: "I'm going to" / "You're invited to"
  ctx.fillStyle = '#8a8880';
  ctx.font = "500 26px 'DM Mono', monospace";
  ctx.textBaseline = 'alphabetic';
  const eyebrow = guestName ? "I'M GOING TO" : "YOU'RE INVITED TO";
  ctx.fillText(eyebrow, padX, y);

  y += 90;

  // Event title (Syne, wraps up to 3 lines)
  ctx.fillStyle = '#ffffff';
  ctx.font = "800 82px 'Syne', sans-serif";
  const titleLines = wrapLines(ctx, eventTitle || 'Untitled event', CARD_W - padX * 2).slice(0, 3);
  for (const line of titleLines) {
    y += 84;
    ctx.fillText(line, padX, y);
  }

  y += 70;

  // Date + location (DM Sans)
  ctx.fillStyle = '#c9c7bd';
  ctx.font = "500 34px 'DM Sans', sans-serif";
  ctx.fillText(dateLabel || '', padX, y);
  if (location) {
    y += 46;
    ctx.fillStyle = '#8a8880';
    ctx.font = "400 30px 'DM Sans', sans-serif";
    ctx.fillText(location, padX, y);
  }

  // Guest count pill, bottom third
  const pillY = CARD_H - 320;
  if (goingCount) {
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.roundRect(padX, pillY, 340, 74, 37);
    ctx.fill();
    ctx.fillStyle = accent;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(padX + 40 + i * 34, pillY + 37, 22, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#e8e6de';
    ctx.font = "500 28px 'DM Sans', sans-serif";
    ctx.fillText(`${goingCount} going`, padX + 150, pillY + 47);
  }

  // Divider
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX, CARD_H - 180);
  ctx.lineTo(CARD_W - padX, CARD_H - 180);
  ctx.stroke();

  // Footer: guest name (if any) + PlanIt wordmark + url
  ctx.fillStyle = '#f5f4f0';
  ctx.font = "500 32px 'DM Sans', sans-serif";
  if (guestName) ctx.fillText(guestName, padX, CARD_H - 128);

  ctx.fillStyle = '#5f5e58';
  ctx.font = "400 24px 'DM Mono', monospace";
  ctx.fillText((siteUrl || 'planit.app').replace(/^https?:\/\//, ''), padX, CARD_H - 80);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff';
  ctx.font = "700 30px 'Syne', sans-serif";
  ctx.fillText('PlanIt', CARD_W - padX, CARD_H - 78);
  ctx.textAlign = 'left';

  return canvas;
}

export function downloadCanvasAsPng(canvas, filename) {
  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png');
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function canvasToBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}