'use strict';

/**
 * services/emailService.js
 *
 * Sends transactional emails by calling the router's /mesh/email endpoint.
 * The router holds the RESEND_API_KEY — the backend never needs it.
 * This keeps secrets isolated to one service and email works across all
 * backend instances without any per-backend configuration.
 *
 * Per-address daily limit: 3 emails. Counters stored in Redis (if configured)
 * or in-memory. TTL is set to seconds-until-UTC-midnight so the counter
 * automatically resets without a cron job.
 *
 * Email types:
 *   sendEventConfirmation(event)
 *     - Sent to organizer after event creation
 *     - Includes event details + branded QR code from /api/events/:id/qr.svg
 *
 *   sendGuestInviteConfirmation(event, guestName, guestEmail)
 *     - Sent to individual guest when organizer creates an enterprise invite
 *     - Only fires when guestEmail is provided
 *
 *   sendEventReminder(event)
 *     - Called by cleanupJob.js N hours before the event
 *     - EMAIL_REMINDER_HOURS env var controls timing (default: 24)
 *
 *   sendEventThankyou(event)
 *     - Called by cleanupJob.js after event ends
 *     - Includes optional SURVEY_URL placeholder
 *
 * Env vars (only on the ROUTER — backend never needs them):
 *   RESEND_API_KEY     re_xxxxxxxx
 *   EMAIL_FROM         PlanIt <notifications@yourdomain.com>
 *
 * Env vars on the backend (with safe defaults):
 *   ROUTER_URL         URL of the router service (already needed for mesh)
 *   EMAIL_REMINDER_HOURS  hours before event to send reminder (default: 24)
 *   SURVEY_URL         optional URL included in thank-you emails
 *   FRONTEND_URL       used to build join links in emails
 */

const redis        = require('./redisClient');
const { meshPost } = require('../middleware/mesh');

const CALLER           = process.env.BACKEND_LABEL || 'Backend';
const EMAIL_LIMIT      = 3;   // max emails per address per UTC day
const REMINDER_HOURS   = parseInt(process.env.EMAIL_REMINDER_HOURS || '24', 10);

// How many seconds remain until the next UTC midnight
function secUntilMidnight() {
  const now = new Date();
  const midnight = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1,
  ));
  return Math.max(60, Math.floor((midnight - now) / 1000));
}

// Returns true if the address is allowed to receive another email today.
// Increments the counter atomically; returns false if already at limit.
async function checkLimit(address) {
  if (!address) return false;
  const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
  const key = `emlimit:${address}:${day}`;
  const cnt = await redis.incrWithExpiry(key, secUntilMidnight());
  if (cnt > EMAIL_LIMIT) {
    console.log(`[email] SKIP ${address} — already sent ${cnt - 1} emails today (limit ${EMAIL_LIMIT})`);
    return false;
  }
  return true;
}

// Build an absolute join URL for the event
function joinUrl(event) {
  const base = (process.env.FRONTEND_URL || '').split(',')[0].trim().replace(/\/$/, '');
  const id   = event._id || event.id || '';
  return base ? `${base}/event/${id}` : `#event-${id}`;
}

// The QR code is served by the backend's own endpoint (no external service).
// We embed the URL as an <img src="..."> in the email. Resend will fetch it
// at send time if image embedding is enabled; otherwise the recipient's client
// fetches it. Either way no external QR generator is ever called.
function qrUrl(event) {
  const base = (process.env.ROUTER_URL || '').replace(/\/$/, '');
  const id   = event._id || event.id || '';
  return base && id ? `${base}/api/events/${id}/qr.svg` : null;
}

// ─── HTML templates ───────────────────────────────────────────────────────────
const h = (s) => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function fmtDate(d) {
  try {
    return new Date(d).toLocaleString('en-GB', {
      weekday:'long', day:'numeric', month:'long', year:'numeric',
      hour:'2-digit', minute:'2-digit', timeZone:'UTC',
    }) + ' UTC';
  } catch { return String(d || ''); }
}

function shell(title, body) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>${h(title)}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#f4f4f5;font-family:system-ui,-apple-system,sans-serif;color:#374151;padding:32px 16px}
  .w{max-width:540px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.09)}
  .hdr{background:linear-gradient(135deg,#7c3aed 0%,#5b21b6 100%);padding:28px 32px}
  .hdr h1{color:#fff;font-size:20px;font-weight:700;letter-spacing:-.3px}
  .hdr p{color:rgba(255,255,255,.75);font-size:12px;margin-top:4px}
  .bd{padding:28px 32px}
  .ttl{font-size:17px;font-weight:700;color:#111827;margin-bottom:18px}
  .row{margin-bottom:12px}
  .lbl{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.6px;color:#9ca3af;margin-bottom:2px}
  .val{font-size:14px;color:#111827}
  hr{border:none;border-top:1px solid #f0f0f0;margin:20px 0}
  .btn{display:inline-block;padding:11px 26px;background:#7c3aed;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;margin-top:20px}
  .qr{text-align:center;margin:20px 0}
  .qr img{border:1px solid #e5e7eb;border-radius:8px;max-width:200px}
  .ft{padding:18px 32px;border-top:1px solid #f3f4f6;font-size:11px;color:#9ca3af;text-align:center}
</style></head><body>
<div class="w">
  <div class="hdr"><h1>PlanIt</h1><p>Event management platform</p></div>
  <div class="bd">${body}</div>
  <div class="ft">This is a transactional notification. You received it because you created or were invited to an event on PlanIt.</div>
</div></body></html>`;
}

function row(label, value) {
  if (!value) return '';
  return `<div class="row"><div class="lbl">${h(label)}</div><div class="val">${h(String(value))}</div></div>`;
}

function eventRows(event) {
  return row('Event', event.title)
       + row('Date', event.date ? fmtDate(event.date) : null)
       + row('Location', event.location)
       + row('Organizer', event.organizerName);
}

// ─── Template: confirmation (sent to organizer after create) ──────────────────
function buildConfirmation(event) {
  const link = joinUrl(event);
  const qr   = qrUrl(event);
  return shell(`Event created: ${event.title}`, `
    <div class="ttl">Your event has been created.</div>
    <p style="font-size:14px;color:#6b7280;margin-bottom:20px">Here are your event details. Share the QR code or join link with attendees.</p>
    ${eventRows(event)}
    <hr/>
    <div class="row"><div class="lbl">Join Link</div><div class="val" style="word-break:break-all">${h(link)}</div></div>
    ${qr ? `<div class="qr"><img src="${h(qr)}" alt="Event QR Code" width="200" height="246"/></div>` : ''}
    <a href="${h(link)}" class="btn">Open Event</a>
  `);
}

// ─── Template: guest invite confirmation ──────────────────────────────────────
function buildGuestConfirmation(event, guestName) {
  const link = joinUrl(event);
  const qr   = qrUrl(event);
  return shell(`You are invited: ${event.title}`, `
    <div class="ttl">You have been invited to an event.</div>
    <p style="font-size:14px;color:#6b7280;margin-bottom:20px">Hi ${h(guestName)}, you have been personally invited. Use the link or QR code below to join.</p>
    ${eventRows(event)}
    <hr/>
    ${qr ? `<div class="qr"><img src="${h(qr)}" alt="Event QR Code" width="200" height="246"/></div>` : ''}
    <a href="${h(link)}" class="btn">View Invitation</a>
  `);
}

// ─── Template: reminder ───────────────────────────────────────────────────────
function buildReminder(event) {
  const link = joinUrl(event);
  return shell(`Reminder: ${event.title} is coming up`, `
    <div class="ttl">Your event starts in about ${REMINDER_HOURS} hours.</div>
    ${eventRows(event)}
    <hr/>
    <a href="${h(link)}" class="btn">Open Event</a>
  `);
}

// ─── Template: thank-you ──────────────────────────────────────────────────────
function buildThankyou(event) {
  const survey = process.env.SURVEY_URL || null;
  return shell(`Thank you for using PlanIt: ${event.title}`, `
    <div class="ttl">Your event has concluded.</div>
    <p style="font-size:14px;color:#6b7280;margin-bottom:20px">Thank you for using PlanIt. We hope your event went smoothly.</p>
    ${eventRows(event)}
    ${survey ? `<hr/><p style="font-size:14px;color:#6b7280;margin-bottom:8px">We would appreciate your feedback:</p><a href="${h(survey)}" class="btn">Share Feedback</a>` : ''}
  `);
}

// ─── Core send (via router mesh) ──────────────────────────────────────────────
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
  await _send(to, `Event created: ${event.title}`, buildConfirmation(event));
}

async function sendGuestInviteConfirmation(event, guestName, guestEmail) {
  if (!guestEmail) return;
  if (!(await checkLimit(guestEmail))) return;
  await _send(guestEmail, `You are invited: ${event.title}`, buildGuestConfirmation(event, guestName));
}

async function sendEventReminder(event) {
  const to = event.organizerEmail;
  if (!to) return;
  if (!(await checkLimit(to))) return;
  await _send(to, `Reminder: ${event.title} starts soon`, buildReminder(event));
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