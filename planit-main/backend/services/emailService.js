'use strict';

/**
 * services/emailService.js
 *
 * Sends transactional emails by calling the router's /mesh/email endpoint.
 * The router holds the RESEND_API_KEY — the backend never needs it.
 *
 * QR codes are fetched server-side before sending and embedded as base64
 * data URIs so they render in every email client without external requests.
 *
 * Per-address daily limit: 3 emails. Counters stored in Redis (if configured)
 * or in-memory. TTL resets automatically at UTC midnight.
 *
 * Email types:
 *   sendEventConfirmation(event)       → organizer after event creation
 *   sendGuestInviteConfirmation(...)   → guest when personally invited
 *   sendEventReminder(event)           → organizer N hours before event
 *   sendEventThankyou(event)           → organizer after event ends
 *
 * Env vars (set on ROUTER only — backends receive via configSync):
 *   RESEND_API_KEY, EMAIL_FROM, FRONTEND_URL, SURVEY_URL, EMAIL_REMINDER_HOURS
 */

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
    console.log(`[email] SKIP ${address} — already sent ${cnt - 1} emails today (limit ${EMAIL_LIMIT})`);
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

// ─── QR fetching ─────────────────────────────────────────────────────────────
// Fetches the QR SVG from the backend and returns a base64 data URI.
// Embedding inline means it renders in every email client — no external request
// needed from the recipient's side.
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

// ─── Design system ────────────────────────────────────────────────────────────
// Clean, minimal, professional — inspired by Stripe / Linear / Vercel emails.
// No purple gradients. Dark header, white body, clear typography.

function shell(title, preheader, body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <meta name="color-scheme" content="light"/>
  <title>${h(title)}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      background:#f4f4f5;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #111827;
      padding: 40px 16px;
      -webkit-font-smoothing: antialiased;
    }
    .wrap    { max-width: 560px; margin: 0 auto; }
    .card    { background: #ffffff; border-radius: 8px; overflow: hidden; border: 1px solid #e5e7eb; }
    .header  { background: #111827; padding: 24px 32px; }
    .logo    { font-size: 16px; font-weight: 700; color: #ffffff; letter-spacing: -0.2px; }
    .logo span { color: #9ca3af; font-weight: 400; margin-left: 6px; font-size: 13px; }
    .body    { padding: 32px; }
    .heading { font-size: 18px; font-weight: 600; color: #111827; margin-bottom: 6px; }
    .sub     { font-size: 14px; color: #6b7280; margin-bottom: 28px; line-height: 1.5; }
    .divider { border: none; border-top: 1px solid #f3f4f6; margin: 24px 0; }
    .field   { margin-bottom: 16px; }
    .label   { font-size: 11px; font-weight: 600; text-transform: uppercase;
               letter-spacing: 0.7px; color: #9ca3af; margin-bottom: 3px; }
    .value   { font-size: 14px; color: #111827; line-height: 1.4; }
    .link-box {
      background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px;
      padding: 12px 14px; font-size: 13px; color: #374151;
      word-break: break-all; margin-top: 16px;
    }
    .btn {
      display: inline-block; margin-top: 24px;
      padding: 11px 24px; background: #111827; color: #ffffff;
      text-decoration: none; border-radius: 6px;
      font-size: 14px; font-weight: 500; letter-spacing: -0.1px;
    }
    .qr-wrap { text-align: center; margin: 24px 0 8px; }
    .qr-wrap img { max-width: 200px; width: 100%; border-radius: 8px; border: 1px solid #e5e7eb; }
    .qr-hint { text-align: center; font-size: 12px; color: #9ca3af; margin-bottom: 8px; }
    .footer  {
      padding: 20px 32px; border-top: 1px solid #f3f4f6;
      font-size: 12px; color: #9ca3af; line-height: 1.5;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <!-- Preheader (hidden preview text) -->
    <div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${h(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>
    <div class="card">
      <div class="header">
        <div class="logo">PlanIt <span>Event Management</span></div>
      </div>
      <div class="body">${body}</div>
      <div class="footer">
        You received this because you created or were invited to an event on PlanIt.
        This is an automated notification — please do not reply to this email.
      </div>
    </div>
  </div>
</body>
</html>`;
}

function field(label, value) {
  if (!value) return '';
  return `<div class="field">
    <div class="label">${h(label)}</div>
    <div class="value">${h(String(value))}</div>
  </div>`;
}

function eventFields(event) {
  return field('Event', event.title)
       + field('Date', event.date ? fmtDate(event.date) : null)
       + field('Location', event.location)
       + field('Organizer', event.organizerName);
}

// ─── Templates ────────────────────────────────────────────────────────────────

function buildConfirmation(event, qrDataUri) {
  const link = joinUrl(event);
  return shell(
    `Event created: ${event.title}`,
    `Your event "${event.title}" has been created. Here are your details and QR code.`,
    `
    <div class="heading">Your event is ready.</div>
    <div class="sub">Here are your event details. Share the join link or QR code with your attendees.</div>
    ${eventFields(event)}
    <hr class="divider"/>
    <div class="field">
      <div class="label">Join Link</div>
      <div class="link-box">${h(link)}</div>
    </div>
    ${qrDataUri ? `
    <hr class="divider"/>
    <div class="field"><div class="label">QR Code</div></div>
    <div class="qr-wrap"><img src="${qrDataUri}" alt="Event QR Code" width="200" height="246"/></div>
    <div class="qr-hint">Attendees can scan this to join your event</div>
    ` : ''}
    <a href="${h(link)}" class="btn">Open Event →</a>
  `);
}

function buildGuestConfirmation(event, guestName, qrDataUri) {
  const link = joinUrl(event);
  return shell(
    `You're invited: ${event.title}`,
    `Hi ${guestName}, you've been personally invited to ${event.title}.`,
    `
    <div class="heading">You've been invited.</div>
    <div class="sub">Hi ${h(guestName)}, you have been personally invited to the following event. Use the link or QR code below to join.</div>
    ${eventFields(event)}
    ${qrDataUri ? `
    <hr class="divider"/>
    <div class="field"><div class="label">Your QR Code</div></div>
    <div class="qr-wrap"><img src="${qrDataUri}" alt="Event QR Code" width="200" height="246"/></div>
    <div class="qr-hint">Show this at check-in</div>
    ` : ''}
    <a href="${h(link)}" class="btn">View Invitation →</a>
  `);
}

function buildReminder(event) {
  const link = joinUrl(event);
  return shell(
    `Reminder: ${event.title} starts in ${REMINDER_HOURS} hours`,
    `Your event "${event.title}" is coming up soon.`,
    `
    <div class="heading">Your event is coming up.</div>
    <div class="sub">This is a reminder that your event starts in approximately ${REMINDER_HOURS} hours.</div>
    ${eventFields(event)}
    <a href="${h(link)}" class="btn">Open Event →</a>
  `);
}

function buildThankyou(event) {
  const link   = joinUrl(event);
  const survey = process.env.SURVEY_URL || null;
  return shell(
    `Thanks for using PlanIt — ${event.title}`,
    `Your event "${event.title}" has concluded. Thanks for using PlanIt.`,
    `
    <div class="heading">Your event has concluded.</div>
    <div class="sub">Thanks for using PlanIt. We hope everything went smoothly.</div>
    ${eventFields(event)}
    ${survey ? `
    <hr class="divider"/>
    <div class="sub" style="margin-bottom:0">How did it go? We'd love to hear your feedback — it takes less than a minute.</div>
    <a href="${h(survey)}" class="btn">Share Feedback →</a>
    ` : `<a href="${h(link)}" class="btn">View Event Summary →</a>`}
  `);
}

// ─── Core send ────────────────────────────────────────────────────────────────

async function _send(to, subject, html) {
  const routerUrl = process.env.ROUTER_URL;
  if (!routerUrl) {
    console.warn('[email] ROUTER_URL not set — cannot relay email');
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
  await _send(guestEmail, `You're invited: ${event.title}`, buildGuestConfirmation(event, guestName, qr));
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
  await _send(to, `Thanks for using PlanIt — ${event.title}`, buildThankyou(event));
}

module.exports = {
  sendEventConfirmation,
  sendGuestInviteConfirmation,
  sendEventReminder,
  sendEventThankyou,
};