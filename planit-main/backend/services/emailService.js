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
  const id   = event._id || event.id || '';
  return base ? `${base}/event/${id}` : `#event-${id}`;
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
// Fetches the QR SVG from the backend and returns a base64 data URI.
// Embedding inline means it renders in every email client without any
// external request from the recipient's mail app.
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
        res.on('end', () => {
          const b64 = Buffer.concat(chunks).toString('base64');
          resolve(`data:image/svg+xml;base64,${b64}`);
        });
        res.on('error', () => resolve(null));
      });
      req.on('error',   () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
    } catch { resolve(null); }
  });
}

// ─── Shared CSS ───────────────────────────────────────────────────────────────

const CSS = `
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    background: #f0f0f4;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    color: #111827;
    padding: 40px 16px;
    -webkit-font-smoothing: antialiased;
  }
  .wrap    { max-width: 580px; margin: 0 auto; }
  .card    { background: #ffffff; border-radius: 12px; overflow: hidden;
             box-shadow: 0 4px 32px rgba(0,0,0,0.10); border: 1px solid #e2e2e8; }
  .hdr           { background: #0f0f11; padding: 28px 36px 24px;
                   border-bottom: 1px solid rgba(255,255,255,0.06); }
  .wordmark      { font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; }
  .wordmark span { color: #8b5cf6; }
  .tagline       { font-size: 11px; color: rgba(255,255,255,0.35); letter-spacing: 0.8px;
                   text-transform: uppercase; margin-top: 3px; }
  .hero          { background: #f7f7fa; border-bottom: 1px solid #ebebef;
                   padding: 28px 36px 24px; }
  .eyebrow       { font-size: 11px; font-weight: 700; letter-spacing: 0.9px;
                   text-transform: uppercase; color: #8b5cf6; margin-bottom: 8px; }
  .hero-title    { font-size: 22px; font-weight: 700; color: #0f0f11;
                   letter-spacing: -0.4px; line-height: 1.25; }
  .hero-sub      { font-size: 14px; color: #6b7280; line-height: 1.6; margin-top: 6px; }
  .bd            { padding: 28px 36px; }
  .section-label { font-size: 10px; font-weight: 700; text-transform: uppercase;
                   letter-spacing: 1px; color: #9ca3af; margin-bottom: 14px; }
  .detail-row    { display: flex; gap: 14px; align-items: flex-start; margin-bottom: 12px; }
  .detail-key    { font-size: 12px; font-weight: 600; color: #9ca3af;
                   width: 88px; flex-shrink: 0; padding-top: 1px; }
  .detail-val    { font-size: 14px; color: #1f2937; line-height: 1.4; }
  .divider       { border: none; border-top: 1px solid #f0f0f4; margin: 24px 0; }
  .link-block    { background: #f7f7fa; border: 1px solid #e5e5eb;
                   border-radius: 8px; padding: 14px 16px; margin-top: 16px; }
  .link-label    { font-size: 10px; font-weight: 700; text-transform: uppercase;
                   letter-spacing: 0.8px; color: #9ca3af; margin-bottom: 6px; }
  .link-url      { font-size: 13px; color: #4f46e5; word-break: break-all; font-weight: 500; }
  .qr-section    { background: #f7f7fa; border: 1px solid #e5e5eb; border-radius: 10px;
                   padding: 24px; text-align: center; margin-top: 24px; }
  .qr-label      { font-size: 10px; font-weight: 700; text-transform: uppercase;
                   letter-spacing: 0.9px; color: #9ca3af; margin-bottom: 16px; }
  .qr-box        { display: inline-block; background: #fff; border: 1px solid #e0e0e8;
                   border-radius: 8px; padding: 12px; }
  .qr-box img    { display: block; width: 176px; height: 176px; border-radius: 4px; }
  .qr-hint       { font-size: 12px; color: #9ca3af; margin-top: 12px; line-height: 1.5; }
  .qr-fallback   { font-size: 12px; color: #6b7280; margin-top: 6px; }
  .qr-fallback a { color: #4f46e5; text-decoration: none; font-weight: 500; }
  .btn-wrap      { margin-top: 24px; }
  .btn           { display: inline-block; padding: 13px 28px; background: #0f0f11;
                   color: #ffffff; text-decoration: none; border-radius: 8px;
                   font-size: 14px; font-weight: 600; letter-spacing: -0.1px; }
  .sig           { margin-top: 28px; padding-top: 20px; border-top: 1px solid #f0f0f4; }
  .sig-copy      { font-size: 14px; color: #374151; line-height: 1.75; }
  .sig-name      { font-size: 14px; font-weight: 700; color: #0f0f11; margin-top: 14px; }
  .sig-title     { font-size: 12px; color: #9ca3af; margin-top: 2px; }
  .footer        { background: #f7f7fa; border-top: 1px solid #ebebef;
                   padding: 20px 36px; }
  .footer-text   { font-size: 11px; color: #b4b4bc; line-height: 1.6; }
  /* Thank-you specific */
  .ty-hero       { background: #0f0f11; padding: 44px 36px 36px; text-align: center; }
  .ty-kicker     { font-size: 11px; font-weight: 700; letter-spacing: 0.9px;
                   text-transform: uppercase; color: #8b5cf6; margin-bottom: 14px; }
  .ty-title      { font-size: 26px; font-weight: 800; color: #ffffff;
                   letter-spacing: -0.5px; line-height: 1.2; }
  .ty-event      { font-size: 14px; color: rgba(255,255,255,0.45); margin-top: 10px; }
`;

// ─── Shell ────────────────────────────────────────────────────────────────────

function shell(title, preheader, headerHtml, bodyHtml, footerNote) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <meta name="color-scheme" content="light"/>
  <title>${h(title)}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style>${CSS}</style>
</head>
<body>
  <div class="wrap">
    <div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${h(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</div>
    <div class="card">
      <div class="hdr">
        <div class="wordmark">Plan<span>It</span></div>
        <div class="tagline">Event Management Platform</div>
      </div>
      ${headerHtml}
      <div class="bd">
        ${bodyHtml}
        <div class="sig">
          <div class="sig-copy">${footerNote}</div>
          <div class="sig-name">Aakshat Hariharan</div>
          <div class="sig-title">Founder, PlanIt</div>
        </div>
      </div>
      <div class="footer">
        <div class="footer-text">
          You received this because you created or were invited to an event on PlanIt.
          This is an automated transactional notification. Please do not reply to this email.
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ─── Reusable fragments ───────────────────────────────────────────────────────

function standardHero(eyebrow, title, sub) {
  return `<div class="hero">
    <div class="eyebrow">${h(eyebrow)}</div>
    <div class="hero-title">${h(title)}</div>
    ${sub ? `<div class="hero-sub">${h(sub)}</div>` : ''}
  </div>`;
}

function detailRows(event) {
  const rows = [
    ['Event',     event.title],
    ['Date',      event.date ? fmtDate(event.date) : null],
    ['Location',  event.location],
    ['Organizer', event.organizerName],
  ];
  return rows.filter(([, v]) => v).map(([k, v]) =>
    `<div class="detail-row">
      <div class="detail-key">${h(k)}</div>
      <div class="detail-val">${h(String(v))}</div>
    </div>`
  ).join('');
}

function qrBlock(qrDataUri, link, label, hint) {
  if (!qrDataUri) return '';
  return `<div class="qr-section">
    <div class="qr-label">${h(label)}</div>
    <div class="qr-box">
      <img src="${qrDataUri}" alt="Event QR Code" width="176" height="176"/>
    </div>
    <div class="qr-hint">${h(hint)}</div>
    <div class="qr-fallback">
      If the QR code is not visible, <a href="${h(link)}">open the event link here</a>.
    </div>
  </div>`;
}

function ctaButton(label, link) {
  return `<div class="btn-wrap"><a href="${h(link)}" class="btn">${h(label)}</a></div>`;
}

// ─── Templates ────────────────────────────────────────────────────────────────

function buildConfirmation(event, qrDataUri) {
  const link = joinUrl(event);
  const hero = standardHero(
    'Event Created',
    'Your event is live and ready.',
    'Here are your event details. Share the join link or QR code with your attendees and they can join instantly.'
  );
  const body = `
    <div class="section-label">Event Details</div>
    ${detailRows(event)}
    <div class="divider" style="margin:20px 0"></div>
    <div class="link-block">
      <div class="link-label">Join Link</div>
      <div class="link-url">${h(link)}</div>
    </div>
    ${qrBlock(qrDataUri, link, 'QR Code for Attendees', 'Scan to join instantly. Works with any camera app.')}
    ${ctaButton('Open Event Dashboard', link)}
  `;
  return shell(
    `Event created: ${event.title}`,
    `Your event "${event.title}" is live. Here are your details and QR code.`,
    hero,
    body,
    'Glad to have you building with PlanIt. If you ever need anything, we are always here. Wishing your event every success.'
  );
}

function buildGuestConfirmation(event, guestName, qrDataUri) {
  const link = joinUrl(event);
  const hero = standardHero(
    'Personal Invitation',
    `You have been invited, ${guestName}.`,
    'The organizer has personally invited you. Your QR code is below. Show it at check-in to get in quickly.'
  );
  const body = `
    <div class="section-label">Event Details</div>
    ${detailRows(event)}
    ${qrBlock(qrDataUri, link, 'Your Personal QR Code', 'Show this at check-in. Screenshot or print it to keep offline.')}
    ${ctaButton('View Invitation', link)}
  `;
  return shell(
    `You are invited: ${event.title}`,
    `Hi ${guestName}, you have been personally invited to ${event.title}.`,
    hero,
    body,
    'Looking forward to seeing you there. This event was organised on PlanIt and we hope to make every gathering effortless.'
  );
}

function buildReminder(event) {
  const link    = joinUrl(event);
  const timeStr = REMINDER_HOURS === 24 ? 'tomorrow' : `in approximately ${REMINDER_HOURS} hours`;
  const hero = standardHero(
    `Reminder: ${REMINDER_HOURS} Hours to Go`,
    `Your event starts ${timeStr}.`,
    `Just a heads-up. "${event.title}" is coming up and everything is ready on your end.`
  );
  const body = `
    <div class="section-label">Event Details</div>
    ${detailRows(event)}
    ${ctaButton('Open Event Dashboard', link)}
  `;
  return shell(
    `Reminder: ${event.title} starts in ${REMINDER_HOURS} hours`,
    `Your event "${event.title}" is coming up soon.`,
    hero,
    body,
    'You are almost there. Wishing you a smooth and memorable event. PlanIt is here if you need anything.'
  );
}

function buildThankyou(event) {
  const link   = joinUrl(event);
  const survey = process.env.SURVEY_URL || null;

  // Thank-you gets a bespoke dark hero rather than the standard band
  const hero = `
    <div class="ty-hero">
      <div class="ty-kicker">Event Concluded</div>
      <div class="ty-title">That is a wrap.<br/>Thank you.</div>
      <div class="ty-event">${h(event.title)}</div>
    </div>
  `;

  const body = `
    <div class="section-label">Event Summary</div>
    ${detailRows(event)}
    <div class="divider" style="margin:20px 0"></div>
    <div style="font-size:14px; color:#374151; line-height:1.85;">
      I wanted to take a moment to personally thank you for using PlanIt.<br/><br/>
      Every event organised on this platform means a great deal to me. It is exactly why we built this.
      I hope your event was everything you envisioned and that the people who attended left with something memorable.<br/><br/>
      We are constantly working to make PlanIt better, and your trust in us is what drives that.
      If you have any feedback at all, good or critical, I read every message.
    </div>
    ${survey
      ? `<div class="divider" style="margin:24px 0"></div>
         <div style="font-size:13px;color:#6b7280;margin-bottom:4px">How did it go? Your feedback takes less than a minute.</div>
         ${ctaButton('Share Feedback', survey)}`
      : ctaButton('View Event Summary', link)
    }
  `;

  return shell(
    `Thank you for using PlanIt: ${event.title}`,
    `Your event "${event.title}" has concluded. A personal note from the founder.`,
    hero,
    body,
    'With gratitude,'
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

async function sendGuestInviteConfirmation(event, guestName, guestEmail) {
  if (!guestEmail) return;
  if (!(await checkLimit(guestEmail))) return;
  const qr = await fetchQrAsBase64(event);
  await _send(guestEmail, `You are invited: ${event.title}`, buildGuestConfirmation(event, guestName, qr));
}

async function sendEventReminder(event) {
  const to = event.organizerEmail;
  if (!to) return;
  if (!(await checkLimit(to))) return;
  await _send(to, `Reminder: ${event.title} starts in ${REMINDER_HOURS} hours`, buildReminder(event));
}

async function sendEventThankyou(event) {
  const to = event.organizerEmail;
  if (!to) return;
  if (!(await checkLimit(to))) return;
  await _send(to, `Thank you for using PlanIt: ${event.title}`, buildThankyou(event));
}

module.exports = {
  sendEventConfirmation,
  sendGuestInviteConfirmation,
  sendEventReminder,
  sendEventThankyou,
};
