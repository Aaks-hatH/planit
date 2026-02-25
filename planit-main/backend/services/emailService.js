'use strict';

const https     = require('https');
const urlMod    = require('url');
const redis     = require('./redisClient');
const { meshPost } = require('../middleware/mesh');

const CALLER         = process.env.BACKEND_LABEL || 'Backend';
const EMAIL_LIMIT    = 3;
const REMINDER_HOURS = parseInt(process.env.EMAIL_REMINDER_HOURS || '24', 10);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function secUntilMidnight() {
  const now      = new Date();
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return Math.max(60, Math.floor((midnight - now) / 1000));
}

async function checkLimit(address) {
  if (!address) return false;
  const day = new Date().toISOString().slice(0, 10);
  const key = `emlimit:${address}:${day}`;
  const cnt = await redis.incrWithExpiry(key, secUntilMidnight());
  if (cnt > EMAIL_LIMIT) {
    console.log(`[email] SKIP ${address} - already sent ${cnt - 1} emails today (limit ${EMAIL_LIMIT})`);
    return false;
  }
  return true;
}

function joinUrl(event) {
  const base = (process.env.FRONTEND_URL || '').split(',')[0].trim().replace(/\/$/, '');
  const sub  = event.subdomain;
  const id   = event._id || event.id || '';
  if (!base) return `#event-${id}`;
  return sub ? `${base}/e/${sub}` : `${base}/event/${id}`;
}

const h = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function fmtDate(d) {
  try {
    return new Date(d).toLocaleString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
    }) + ' UTC';
  } catch { return String(d || ''); }
}

// ─── QR fetching ──────────────────────────────────────────────────────────────

function fetchQrAsBase64(event) {
  return new Promise((resolve) => {
    const routerUrl = (process.env.ROUTER_URL || '').replace(/\/$/, '');
    const id        = event._id || event.id || '';
    if (!routerUrl || !id) return resolve(null);
    const url = `${routerUrl}/api/events/${id}/qr.svg`;
    try {
      const parsed = urlMod.parse(url);
      const lib    = parsed.protocol === 'https:' ? https : require('http');
      const req    = lib.get(url, { timeout: 8000 }, (res) => {
        if (res.statusCode !== 200) return resolve(null);
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end',  () => resolve(`data:image/svg+xml;base64,${Buffer.concat(chunks).toString('base64')}`));
        res.on('error', () => resolve(null));
      });
      req.on('error',   () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
    } catch { resolve(null); }
  });
}

// ─── Shared CSS ───────────────────────────────────────────────────────────────

const CSS = `
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
img{border:0;display:block;max-width:100%}
table{border-collapse:collapse;mso-table-lspace:0;mso-table-rspace:0}
a{color:inherit;text-decoration:none}
body{margin:0;padding:0;background:#eeeef3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;color:#1a1a2e;-webkit-text-size-adjust:100%}
.outer{width:100%;background:#eeeef3;padding:36px 16px}
.card{max-width:580px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.07),0 8px 40px rgba(0,0,0,.09)}
.mast{background:#0b0b13;padding:26px 36px}
.mast-wm{font-size:19px;font-weight:700;color:#fff;letter-spacing:-.4px;line-height:1}
.mast-wm b{color:#7b68f5}
.mast-tag{font-size:9px;font-weight:500;letter-spacing:1.1px;text-transform:uppercase;color:rgba(255,255,255,.28);margin-top:4px}
.mast-pill{display:inline-block;font-size:9.5px;font-weight:600;letter-spacing:.6px;text-transform:uppercase;padding:5px 12px;border-radius:20px;float:right;margin-top:-2px}
.hero{padding:34px 36px 28px;border-bottom:1px solid #eaeaf2}
.eyebrow{display:inline-block;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:4px 11px;border-radius:4px;margin-bottom:14px}
.h1{font-size:23px;font-weight:700;color:#0b0b13;letter-spacing:-.5px;line-height:1.22}
.hero-p{font-size:14px;color:#5c5c7a;line-height:1.68;margin-top:9px}
.bd{padding:32px 36px}
.cap{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#b0b0c8;margin-bottom:14px;padding-bottom:9px;border-bottom:1px solid #f0f0f7}
.drow{display:table;width:100%;margin-bottom:9px}
.dk{display:table-cell;font-size:11.5px;font-weight:600;color:#b0b0c8;width:80px;vertical-align:top;padding-top:1px}
.dv{display:table-cell;font-size:13.5px;color:#1a1a2e;line-height:1.45;padding-left:10px}
.rule{height:1px;background:#f0f0f7;margin:26px 0;border:none}
.link-box{background:#f7f7fb;border:1px solid #e8e8f2;border-radius:7px;padding:14px 16px;margin-top:14px}
.link-cap{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#b0b0c8;margin-bottom:6px}
.link-url{font-size:12.5px;color:#4338ca;word-break:break-all;font-weight:600}
.qr-block{background:#f7f7fb;border:1px solid #e8e8f2;border-radius:9px;padding:30px 20px;text-align:center;margin-top:22px}
.qr-cap{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#b0b0c8;margin-bottom:18px}
.qr-inner{display:inline-block;background:#fff;border:1px solid #e0e0ec;border-radius:7px;padding:14px}
.qr-note{font-size:12px;color:#9090b0;margin-top:14px;line-height:1.55}
.qr-fb{font-size:11px;color:#9090b0;margin-top:7px}
.qr-fb a{color:#4338ca;font-weight:600}
.cta-wrap{margin-top:24px}
.cta{display:block;padding:14px 30px;border-radius:7px;font-size:14px;font-weight:600;letter-spacing:-.1px;text-decoration:none;text-align:center;color:#fff;background:#0b0b13}
.chk{width:100%;border-collapse:collapse;margin-bottom:6px}
.chk td{padding:10px 0;border-bottom:1px solid #f2f2f8;font-size:13.5px;color:#2a2a48;line-height:1.5;vertical-align:top}
.cdot-td{width:18px;padding-top:5px}
.cdot{width:5px;height:5px;border-radius:50%}
.sig{margin-top:30px;padding-top:22px;border-top:1px solid #f0f0f7}
.sig-copy{font-size:13.5px;color:#3a3a58;line-height:1.78}
.sig-name{font-size:14px;font-weight:700;color:#0b0b13;margin-top:14px}
.sig-role{font-size:11.5px;color:#b0b0c8;margin-top:2px}
.foot{background:#f7f7fb;border-top:1px solid #eaeaf2;padding:18px 36px}
.foot p{font-size:10.5px;color:#c0c0d2;line-height:1.6}
@media only screen and (max-width:600px){
  .outer{padding:0!important}
  .card{border-radius:0!important;box-shadow:none!important}
  .mast{padding:20px!important}
  .mast-pill{display:none!important}
  .hero{padding:24px 20px 20px!important}
  .h1{font-size:20px!important}
  .bd{padding:24px 20px!important}
  .drow{display:block!important;margin-bottom:12px!important}
  .dk{display:block!important;width:auto!important;font-size:10px!important;margin-bottom:3px!important}
  .dv{display:block!important;padding-left:0!important}
  .ds-btn-td{display:block!important;text-align:left!important;padding:0 24px 20px!important}
  .ds-cta{display:block!important;text-align:center!important}
  .cta{padding:14px!important}
  .foot{padding:16px 20px!important}
}
`;

// ─── Reusable fragments ───────────────────────────────────────────────────────

function shell(title, preheader, pillLabel, pillColor, heroHtml, bodyHtml, sigCopy, footerNote) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <meta name="color-scheme" content="light only"/>
  <title>${h(title)}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style>${CSS}</style>
</head>
<body>
  <div class="outer">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td>
    <div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${h(preheader)}&nbsp;&zwnj;&nbsp;</div>
    <div class="card">
      <div class="mast">
        <div class="mast-wm">Plan<b>It</b></div>
        <div class="mast-tag">Event Management Platform</div>
        <div class="mast-pill" style="border:1px solid ${pillColor};color:${pillColor}">${h(pillLabel)}</div>
      </div>
      ${heroHtml}
      <div class="bd">
        ${bodyHtml}
        <div class="sig">
          <div class="sig-copy">${sigCopy}</div>
          <div class="sig-name">Aakshat Hariharan</div>
          <div class="sig-role">Founder, PlanIt</div>
        </div>
      </div>
      <div class="foot"><p>${footerNote}</p></div>
    </div>
    </td></tr></table>
  </div>
</body>
</html>`;
}

function detailRows(event) {
  const rows = [
    ['Event',     event.title],
    ['Date',      event.date ? fmtDate(event.date) : null],
    ['Location',  event.location],
    ['Organiser', event.organizerName],
  ];
  return rows.filter(([, v]) => v).map(([k, v]) =>
    `<div class="drow"><div class="dk">${h(k)}</div><div class="dv">${h(String(v))}</div></div>`
  ).join('');
}

function qrBlock(qrDataUri, link) {
  if (!qrDataUri) return '';
  return `<div class="qr-block">
    <div class="qr-cap">QR Code for Attendees</div>
    <div class="qr-inner">
      <img src="${qrDataUri}" alt="Event QR Code" width="156" height="156" style="display:block;border-radius:4px"/>
    </div>
    <p class="qr-note">Works with any smartphone camera. Print it, embed it in your materials, or display it on screen at the venue.</p>
    <p class="qr-fb">QR code not rendering? <a href="${h(link)}">Open the event link directly</a></p>
  </div>`;
}

// ─── Templates ────────────────────────────────────────────────────────────────

function buildConfirmation(event, qrDataUri) {
  const url = joinUrl(event);

  const hero = `<div class="hero">
    <span class="eyebrow" style="background:#f0eeff;color:#4338ca">Event Created</span>
    <h1 class="h1">Your event is live and ready.</h1>
    <p class="hero-p">Everything is set. Share the link below or show the QR code to give attendees instant access — no account required on their end.</p>
  </div>`;

  const body = `
    <div class="cap">Event Details</div>
    ${detailRows(event)}
    <hr class="rule"/>
    <div class="link-box">
      <div class="link-cap">Shareable Join Link</div>
      <div class="link-url">${h(url)}</div>
    </div>
    ${qrBlock(qrDataUri, url)}
    <div class="cta-wrap"><a href="${h(url)}" class="cta">Open Event Dashboard</a></div>`;

  return shell(
    `Event created: ${event.title}`,
    `Your event "${event.title}" is live and ready.`,
    'Confirmation', 'rgba(99,85,240,.55)',
    hero, body,
    'Glad to have you on PlanIt. Your event dashboard is ready when you are. If anything is unclear, reply to this email and I will sort it out personally.',
    'You received this because you created an event on PlanIt. This is an automated confirmation. Please do not reply directly to this email.'
  );
}

function buildReminder(event) {
  const url      = joinUrl(event);
  const timeStr  = REMINDER_HOURS === 24 ? 'tomorrow' : `in approximately ${REMINDER_HOURS} hours`;

  const hero = `<div class="hero">
    <span class="eyebrow" style="background:#fff8ed;color:#b45309">
      ${REMINDER_HOURS}-Hour Reminder
    </span>
    <h1 class="h1">Your event starts ${timeStr}.</h1>
    <p class="hero-p">A quick summary to keep close. Everything on PlanIt is ready on your end.</p>
  </div>`;

  const checklist = [
    'Confirm your team knows their roles and arrival times',
    'Test the QR check-in flow on your event dashboard before heading in',
    'Share the event link with any attendees who have not yet joined',
    'Keep a screenshot of the guest list as a backup in case of connectivity issues on the day',
  ];

  const body = `
    <div class="cap">Event Details</div>
    ${detailRows(event)}
    <hr class="rule"/>
    <div class="cap" style="margin-top:20px">Day-of Checklist</div>
    <table class="chk" role="presentation">
      ${checklist.map(t => `
        <tr>
          <td class="cdot-td"><div class="cdot" style="background:#b45309"></div></td>
          <td>${h(t)}</td>
        </tr>`).join('')}
    </table>
    <div class="cta-wrap"><a href="${h(url)}" class="cta">Open Event Dashboard</a></div>`;

  return shell(
    `Reminder: ${event.title} starts ${timeStr}`,
    `Your event "${event.title}" is coming up soon.`,
    `${REMINDER_HOURS}-Hour Reminder`, 'rgba(180,83,9,.55)',
    hero, body,
    'You are nearly there. Wishing you a smooth and memorable event. PlanIt is here if anything comes up.',
    'You received this reminder because you are the organizer of this event on PlanIt.'
  );
}

function buildThankyou(event) {
  const url = joinUrl(event);

  const hero = `<div class="hero" style="background:#0b0b13;border-bottom:1px solid #1a1a28">
    <span class="eyebrow" style="background:rgba(123,104,245,.15);color:#9d8cfc">Event Concluded</span>
    <h1 class="h1" style="color:#ffffff">That is a wrap. Well done.</h1>
    <p class="hero-p" style="color:rgba(255,255,255,.42)">${h(event.title)} — a personal note from the founder.</p>
  </div>`;

  const body = `
    <div class="cap">Event Summary</div>
    ${detailRows(event)}
    <hr class="rule"/>
    <p style="font-size:14px;color:#3a3a58;line-height:1.82;margin-bottom:16px">
      I wanted to take a moment to personally thank you for using PlanIt.
    </p>
    <p style="font-size:14px;color:#3a3a58;line-height:1.82;margin-bottom:16px">
      Every event organised on this platform matters to me — it is the reason it was built.
      I hope the people who attended left with something memorable, and that the logistics
      stayed firmly in the background.
    </p>
    <p style="font-size:14px;color:#3a3a58;line-height:1.82">
      If you have feedback — positive or critical — I read every message. Just hit reply.
    </p>
    <div class="cta-wrap"><a href="${h(url)}" class="cta">View Event Summary</a></div>`;

  return shell(
    `Thank you for using PlanIt: ${event.title}`,
    `Your event "${event.title}" has concluded. A personal note from the founder.`,
    'Event Concluded', 'rgba(157,140,252,.55)',
    hero, body,
    'With gratitude,',
    'You received this because you organised an event on PlanIt.'
  );
}

// ─── Core send ────────────────────────────────────────────────────────────────

async function _send(to, subject, html) {
  const routerUrl = process.env.ROUTER_URL;
  if (!routerUrl) {
    console.warn('[email] ROUTER_URL not set - cannot relay email');
    return false;
  }
  const r = await meshPost(CALLER, `${routerUrl}/mesh/email`, { to, subject, html }, { timeout: 15000 });
  if (r.ok) {
    console.log(`[email] Sent "${subject}" -> ${to}`);
    return true;
  }
  console.error(`[email] Send failed "${subject}" -> ${to}:`, r.error || 'unknown');
  return false;
}

// ─── Public API ───────────────────────────────────────────────────────────────

async function sendEventConfirmation(event) {
  const to = event.organizerEmail;
  if (!to) return;
  if (!(await checkLimit(to))) return;
  const qr = await fetchQrAsBase64(event);
  await _send(to, `Event created: ${event.title}`, buildConfirmation(event, qr));
}

async function sendEventReminder(event) {
  const to = event.organizerEmail;
  if (!to) return;
  if (!(await checkLimit(to))) return;
  const timeStr = REMINDER_HOURS === 24 ? 'tomorrow' : `in ${REMINDER_HOURS} hours`;
  await _send(to, `Reminder: ${event.title} starts ${timeStr}`, buildReminder(event));
}

async function sendEventThankyou(event) {
  const to = event.organizerEmail;
  if (!to) return;
  if (!(await checkLimit(to))) return;
  await _send(to, `Thank you for using PlanIt: ${event.title}`, buildThankyou(event));
}

module.exports = {
  sendEventConfirmation,
  sendEventReminder,
  sendEventThankyou,
};
