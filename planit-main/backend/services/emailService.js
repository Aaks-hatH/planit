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

// ─── Shared inline style tokens ───────────────────────────────────────────────

const FONT  = `-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif`;
const BG    = `#EDEDF2`;
const WHITE = `#ffffff`;
const DARK  = `#111827`;
const MID   = `#374151`;
const MUTED = `#6B7280`;
const FAINT = `#9CA3AF`;
const RULE  = `#E9EAEF`;
const PANEL = `#F9FAFB`;

// ─── Shared fragments ─────────────────────────────────────────────────────────

function emailShell(title, preheader, pillLabel, headerRowHtml, bodyHtml, footerNote) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <meta name="color-scheme" content="light only"/>
  <meta name="x-apple-disable-message-reformatting"/>
  <title>${h(title)}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style>
    body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
    table,td{mso-table-lspace:0pt;mso-table-rspace:0pt}
    img{border:0;height:auto;line-height:100%;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic}
    @media only screen and (max-width:620px){
      .card{border-radius:0!important}
      .ep{padding-left:20px!important;padding-right:20px!important}
      .pill{display:none!important}
    }
  </style>
</head>
<body style="margin:0;padding:0;background:${BG};font-family:${FONT};-webkit-font-smoothing:antialiased;" bgcolor="${BG}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BG};" bgcolor="${BG}">
    <tr>
      <td align="center" style="padding:40px 16px;">

        <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;color:${BG};line-height:1px;">${h(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;</div>

        <table role="presentation" class="card" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${WHITE};border-radius:12px;overflow:hidden;" bgcolor="${WHITE}">

          <!-- MASTHEAD -->
          <tr>
            <td style="background:${DARK};padding:28px 40px;" bgcolor="${DARK}">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-size:20px;font-weight:800;color:${WHITE};letter-spacing:-0.5px;font-family:${FONT};">Plan<span style="color:${FAINT};">It</span></span><br/>
                    <span style="font-size:10px;font-weight:500;letter-spacing:1.2px;text-transform:uppercase;color:rgba(255,255,255,0.28);font-family:${FONT};">Event Management Platform</span>
                  </td>
                  <td align="right" valign="middle" class="pill">
                    <span style="display:inline-block;font-size:10px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:rgba(255,255,255,0.55);border:1px solid rgba(255,255,255,0.18);border-radius:20px;padding:5px 14px;font-family:${FONT};">${h(pillLabel)}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${headerRowHtml}

          <!-- BODY -->
          <tr>
            <td class="ep" style="padding:32px 40px;">
              ${bodyHtml}
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td class="ep" style="background:${PANEL};border-top:1px solid ${RULE};padding:20px 40px;" bgcolor="${PANEL}">
              <p style="margin:0 0 4px 0;font-size:11px;color:${FAINT};line-height:1.6;font-family:${FONT};">${h(footerNote)}</p>
              <p style="margin:0;font-size:11px;color:${FAINT};line-height:1.6;font-family:${FONT};"><a href="#unsubscribe" style="color:#6B7280;text-decoration:underline;font-family:${FONT};">Unsubscribe</a> &nbsp;&middot;&nbsp; <a href="#preferences" style="color:#6B7280;text-decoration:underline;font-family:${FONT};">Manage preferences</a></p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
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
  return rows.filter(([, v]) => v).map(([k, v]) => `
    <tr>
      <td style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:${FAINT};width:90px;padding:8px 0;vertical-align:top;font-family:${FONT};">${h(k)}</td>
      <td style="font-size:15px;color:${MID};padding:8px 0 8px 12px;line-height:1.45;font-family:${FONT};">${h(String(v))}</td>
    </tr>`).join('');
}

function sectionCap(label) {
  return `<p style="margin:0 0 16px 0;font-size:10px;font-weight:700;letter-spacing:1.3px;text-transform:uppercase;color:${FAINT};padding-bottom:10px;border-bottom:1px solid ${RULE};font-family:${FONT};">${h(label)}</p>`;
}

function hrule() {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="height:1px;background:${RULE};font-size:0;line-height:0;padding:16px 0 0 0;"></td></tr></table>`;
}

function ctaButton(label, url) {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:28px;width:100%;">
      <tr>
        <td align="center">
          <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${h(url)}" style="height:50px;v-text-anchor:middle;width:260px;" arcsize="12%" stroke="f" fillcolor="${DARK}"><w:anchorlock/><center style="color:#ffffff;font-family:${FONT};font-size:15px;font-weight:700;">${h(label)}</center></v:roundrect><![endif]-->
          <!--[if !mso]><!-->
          <a href="${h(url)}" style="background:${DARK};color:#ffffff;display:inline-block;font-family:${FONT};font-size:15px;font-weight:700;line-height:50px;text-align:center;text-decoration:none;width:260px;border-radius:8px;letter-spacing:-0.2px;mso-hide:all;">${h(label)}</a>
          <!--<![endif]-->
        </td>
      </tr>
    </table>`;
}

function signature(copy) {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:36px;padding-top:24px;border-top:1px solid ${RULE};">
      <tr>
        <td>
          <p style="margin:0 0 18px 0;font-size:15px;color:#4B5563;line-height:1.75;font-family:${FONT};">${copy}</p>
          <p style="margin:0 0 2px 0;font-size:15px;font-weight:700;color:${DARK};font-family:${FONT};">Aakshat Hariharan</p>
          <p style="margin:0;font-size:12px;color:${FAINT};font-family:${FONT};">Founder, PlanIt</p>
        </td>
      </tr>
    </table>`;
}

function qrBlock(qrDataUri, link) {
  if (!qrDataUri) return '';
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;background:${PANEL};border:1px solid #E5E7EB;border-radius:10px;">
      <tr>
        <td style="padding:24px;text-align:center;">
          <p style="margin:0 0 16px 0;font-size:10px;font-weight:700;letter-spacing:1.3px;text-transform:uppercase;color:${FAINT};font-family:${FONT};">QR Code for Attendees</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
            <tr>
              <td style="background:${WHITE};border:1px solid #D1D5DB;border-radius:8px;padding:14px;line-height:0;">
                <img src="${qrDataUri}" alt="Event QR Code" width="160" height="160" style="display:block;border-radius:4px;"/>
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 6px 0;font-size:13px;color:${MUTED};line-height:1.6;font-family:${FONT};">Works with any smartphone camera. Print it, embed it in your materials, or display it on screen at the venue.</p>
          <p style="margin:0;font-size:12px;color:${FAINT};font-family:${FONT};">QR code not rendering? <a href="${h(link)}" style="color:${DARK};font-weight:600;text-decoration:underline;font-family:${FONT};">Open the event link directly</a></p>
        </td>
      </tr>
    </table>`;
}

// ─── Template builders ────────────────────────────────────────────────────────

function buildConfirmation(event, qrDataUri) {
  const url = joinUrl(event);

  const headerRow = `
    <tr>
      <td class="ep" style="padding:36px 40px 30px 40px;border-bottom:1px solid ${RULE};">
        <span style="display:inline-block;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${MID};background:#F3F4F6;padding:5px 12px;border-radius:5px;margin-bottom:16px;font-family:${FONT};">Event Created</span>
        <h1 style="margin:0 0 12px 0;font-size:24px;font-weight:800;color:${DARK};letter-spacing:-0.5px;line-height:1.2;font-family:${FONT};">Your event is live and ready.</h1>
        <p style="margin:0;font-size:15px;color:${MUTED};line-height:1.65;font-family:${FONT};">Everything is set. Share the link below or display the QR code at your venue to give attendees instant access &mdash; no account required on their end.</p>
      </td>
    </tr>`;

  const body = `
    ${sectionCap('Event Details')}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${detailRows(event)}
    </table>
    ${hrule()}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;background:${PANEL};border:1px solid #E5E7EB;border-radius:8px;">
      <tr>
        <td style="padding:16px 20px;">
          <p style="margin:0 0 6px 0;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${FAINT};font-family:${FONT};">Shareable Join Link</p>
          <p style="margin:0;font-size:13px;color:${DARK};word-break:break-all;font-weight:600;font-family:${FONT};">${h(url)}</p>
        </td>
      </tr>
    </table>
    ${qrBlock(qrDataUri, url)}
    ${ctaButton('Open Event Dashboard', url)}
    ${signature('Glad to have you on PlanIt. Your event dashboard is ready when you are. If anything is unclear, reply to this email and I will sort it out personally.')}`;

  return emailShell(
    `Event created: ${event.title}`,
    `Your event "${event.title}" is live and ready for attendees.`,
    'Confirmation',
    headerRow,
    body,
    'You received this because you created an event on PlanIt. This is an automated confirmation.'
  );
}

function buildReminder(event) {
  const url     = joinUrl(event);
  const timeStr = REMINDER_HOURS === 24 ? 'tomorrow' : `in approximately ${REMINDER_HOURS} hours`;
  const label   = REMINDER_HOURS === 24 ? 'Coming Up Tomorrow' : 'Coming Up Soon';

  const headerRow = `
    <tr>
      <td class="ep" style="padding:36px 40px 30px 40px;border-bottom:1px solid ${RULE};">
        <span style="display:inline-block;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${MID};background:#F3F4F6;padding:5px 12px;border-radius:5px;margin-bottom:16px;font-family:${FONT};">${h(label)}</span>
        <h1 style="margin:0 0 12px 0;font-size:24px;font-weight:800;color:${DARK};letter-spacing:-0.5px;line-height:1.2;font-family:${FONT};">Your event starts ${timeStr}.</h1>
        <p style="margin:0;font-size:15px;color:${MUTED};line-height:1.65;font-family:${FONT};">A quick summary to keep close. Everything on PlanIt is ready on your end &mdash; here is a brief checklist to help the day run smoothly.</p>
      </td>
    </tr>`;

  const checklist = [
    'Confirm your team knows their roles and arrival times',
    'Test the QR check-in flow on your event dashboard before heading in',
    'Share the event link with any attendees who have not yet joined',
    'Keep a screenshot of the guest list as a backup in case of connectivity issues on the day',
  ];

  const checkRows = checklist.map((text, i) => `
    <tr>
      <td style="padding:10px 0;${i < checklist.length - 1 ? 'border-bottom:1px solid #F3F4F6;' : ''}vertical-align:top;width:20px;">
        <div style="width:5px;height:5px;background:${MID};border-radius:50%;margin-top:6px;"></div>
      </td>
      <td style="padding:10px 0 10px 12px;${i < checklist.length - 1 ? 'border-bottom:1px solid #F3F4F6;' : ''}font-size:15px;color:${MID};line-height:1.55;font-family:${FONT};">${h(text)}</td>
    </tr>`).join('');

  const body = `
    ${sectionCap('Event Details')}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${detailRows(event)}
    </table>
    ${hrule()}
    <p style="margin:24px 0 14px 0;font-size:10px;font-weight:700;letter-spacing:1.3px;text-transform:uppercase;color:${FAINT};font-family:${FONT};">Day-of Checklist</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${checkRows}
    </table>
    ${ctaButton('Open Event Dashboard', url)}
    ${signature('You are nearly there. Wishing you a smooth and memorable event. PlanIt is here if anything comes up.')}`;

  return emailShell(
    `Reminder: ${event.title} starts ${timeStr}`,
    `Your event "${event.title}" is coming up ${timeStr}.`,
    `${REMINDER_HOURS}-Hour Reminder`,
    headerRow,
    body,
    'You received this reminder because you are the organiser of this event on PlanIt.'
  );
}

function buildThankyou(event) {
  const url = joinUrl(event);

  const headerRow = `
    <tr>
      <td class="ep" style="background:${DARK};padding:36px 40px 30px 40px;border-bottom:1px solid #1F2937;" bgcolor="${DARK}">
        <span style="display:inline-block;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,0.4);background:rgba(255,255,255,0.08);padding:5px 12px;border-radius:5px;margin-bottom:16px;font-family:${FONT};">That is a wrap</span>
        <h1 style="margin:0 0 12px 0;font-size:24px;font-weight:800;color:${WHITE};letter-spacing:-0.5px;line-height:1.2;font-family:${FONT};">Well done. Truly.</h1>
        <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.4);line-height:1.65;font-family:${FONT};">${h(event.title)} &mdash; a personal note from the founder.</p>
      </td>
    </tr>`;

  const body = `
    ${sectionCap('Event Summary')}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${detailRows(event)}
    </table>
    ${hrule()}
    <p style="margin:24px 0 16px 0;font-size:15px;color:${MID};line-height:1.78;font-family:${FONT};">I wanted to take a moment to personally thank you for using PlanIt.</p>
    <p style="margin:0 0 16px 0;font-size:15px;color:${MID};line-height:1.78;font-family:${FONT};">Every event organised on this platform matters to me &mdash; it is the reason it was built. I hope the people who attended left with something memorable, and that the logistics stayed firmly in the background.</p>
    <p style="margin:0;font-size:15px;color:${MID};line-height:1.78;font-family:${FONT};">If you have feedback &mdash; positive or critical &mdash; I read every message. Just hit reply.</p>
    ${ctaButton('View Event Summary', url)}
    ${signature('With gratitude,')}`;

  return emailShell(
    `Thank you for using PlanIt: ${event.title}`,
    `Your event "${event.title}" has concluded. A personal note from the founder.`,
    'Event Concluded',
    headerRow,
    body,
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