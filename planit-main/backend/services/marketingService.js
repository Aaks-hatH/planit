'use strict';

/**
 * services/marketingService.js
 *
 * Marketing email system. Sends campaigns via the router mesh endpoint
 * (/mesh/email) so RESEND_API_KEY stays on the router only.
 *
 * Templates available (referenced by template ID string):
 *   event_planners       - For professional event coordinators
 *   schools              - For schools and universities
 *   temples              - For temples and religious organizations
 *   corporate            - For businesses and enterprise teams
 *   community            - For community groups and non-profits
 *   weddings             - For wedding planners and special occasions
 *
 * Called from: backend/routes/admin.js (POST /admin/marketing/send)
 *
 * Rate limiting: max 1 marketing email per address per calendar day.
 * Sends are batched in groups of 10 with a 1-second delay between
 * batches to avoid overwhelming the Resend API on free tier.
 *
 * No env vars required on backends beyond ROUTER_URL (already needed).
 */

const redis        = require('./redisClient');
const { meshPost } = require('../middleware/mesh');

const CALLER    = process.env.BACKEND_LABEL || 'Backend';
const BATCH_SIZE  = 10;
const BATCH_DELAY = 1200; // ms between batches

// ─── Helpers ──────────────────────────────────────────────────────────────────

const h = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// 1 marketing email per address per day (separate key from transactional)
async function isMarketingAllowed(email) {
  const day = new Date().toISOString().slice(0, 10);
  const key = `mktlimit:${email}:${day}`;
  // Check first, then increment - marketing is intentional, not per-trigger
  const existing = await redis.get(key);
  if (existing) return false;
  const secUntilMidnight = Math.max(60, Math.floor((
    new Date(Date.UTC(
      new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() + 1
    )) - new Date()
  ) / 1000));
  await redis.set(key, '1', secUntilMidnight);
  return true;
}

// ─── Shared CSS (same design system as emailService.js) ───────────────────────

const BASE_CSS = `
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    background:#f0f0f4;
    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;
    color:#111827; padding:40px 16px; -webkit-font-smoothing:antialiased;
  }
  .w { max-width:580px; margin:0 auto; }
  .card { background:#fff; border-radius:12px; overflow:hidden;
          box-shadow:0 4px 32px rgba(0,0,0,.10); border:1px solid #e2e2e8; }
  .hdr { background:#0f0f11; padding:28px 36px 24px; border-bottom:1px solid rgba(255,255,255,.06); }
  .wordmark { font-size:20px; font-weight:800; color:#fff; letter-spacing:-.5px; }
  .wordmark span { color:#8b5cf6; }
  .tagline { font-size:11px; color:rgba(255,255,255,.35); letter-spacing:.8px; text-transform:uppercase; margin-top:3px; }
  .mkt-hero { padding:32px 36px 28px; border-bottom:1px solid #ebebef; }
  .pill { display:inline-block; font-size:10px; font-weight:700; letter-spacing:.9px; text-transform:uppercase;
          padding:4px 10px; border-radius:20px; margin-bottom:12px; }
  .hero-title { font-size:22px; font-weight:700; color:#0f0f11; letter-spacing:-.4px; line-height:1.25; }
  .hero-sub { font-size:14px; color:#6b7280; line-height:1.6; margin-top:6px; }
  .bd { padding:28px 36px; }
  .slabel { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#9ca3af; margin-bottom:14px; }
  table.feat { width:100%; border-collapse:separate; border-spacing:8px; margin:0 -8px 12px; }
  td.feat { width:50%; background:#f7f7fa; border:1px solid #ebebef; border-radius:8px;
             padding:14px 16px; vertical-align:top; }
  .feat-title { font-size:13px; font-weight:700; color:#111827; margin-bottom:4px; }
  .feat-desc { font-size:12px; color:#6b7280; line-height:1.5; }
  .ideal { background:#f7f7fa; border:1px solid #ebebef; border-radius:8px; padding:14px 18px; margin:16px 0; }
  .ideal-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.8px; color:#9ca3af; margin-bottom:6px; }
  .ideal-text { font-size:14px; color:#374151; line-height:1.8; }
  .quote { border-left:3px solid #8b5cf6; border-radius:0 8px 8px 0;
           background:#f7f7fa; padding:14px 18px; margin:16px 0; }
  .quote-text { font-size:14px; color:#374151; line-height:1.7; font-style:italic; }
  .quote-attr { font-size:12px; color:#9ca3af; margin-top:6px; }
  .cta-strip { background:#0f0f11; border-radius:8px; padding:20px 22px;
               margin:20px 0; display:flex; align-items:center; justify-content:space-between; }
  .cta-label { font-size:12px; color:rgba(255,255,255,.45); margin-bottom:2px; }
  .cta-val { font-size:17px; font-weight:800; color:#fff; }
  .cta-sub { font-size:11px; margin-top:2px; }
  .btn { display:inline-block; padding:12px 24px; color:#fff; text-decoration:none;
         border-radius:8px; font-size:14px; font-weight:600; letter-spacing:-.1px; white-space:nowrap; }
  .sig { margin-top:24px; padding-top:20px; border-top:1px solid #f0f0f4; }
  .sig-copy { font-size:14px; color:#374151; line-height:1.75; }
  .sig-name { font-size:14px; font-weight:700; color:#0f0f11; margin-top:14px; }
  .sig-title { font-size:12px; color:#9ca3af; margin-top:2px; }
  .footer { background:#f7f7fa; border-top:1px solid #ebebef; padding:18px 36px; }
  .footer p { font-size:11px; color:#b4b4bc; line-height:1.6; }
`;

// ─── Shell ────────────────────────────────────────────────────────────────────

function shell(title, preheader, heroHtml, bodyHtml, accentColor, footerNote) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <meta name="color-scheme" content="light"/>
  <title>${h(title)}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style>${BASE_CSS}</style>
</head>
<body>
  <div class="w">
    <div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${h(preheader)}&nbsp;&zwnj;&nbsp;</div>
    <div class="card">
      <div class="hdr">
        <div class="wordmark">Plan<span>It</span></div>
        <div class="tagline">Event Management Platform</div>
      </div>
      ${heroHtml}
      <div class="bd">
        ${bodyHtml}
        <div class="sig">
          <div class="sig-copy">${h(bodyHtml._sigCopy || '')}</div>
          <div class="sig-name">Aakshat Hariharan</div>
          <div class="sig-title">Founder, PlanIt</div>
        </div>
      </div>
      <div class="footer">
        <p>${h(footerNote)} To stop receiving these emails, reply with "unsubscribe" and we will remove you immediately.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// Cleaner shell - body is a plain string, sigCopy passed separately
function buildEmail(title, preheader, heroHtml, mainHtml, sigCopy, accentColor, footerNote) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <meta name="color-scheme" content="light"/>
  <title>${h(title)}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style>${BASE_CSS}</style>
</head>
<body>
  <div class="w">
    <div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${h(preheader)}&nbsp;&zwnj;&nbsp;</div>
    <div class="card">
      <div class="hdr">
        <div class="wordmark">Plan<span>It</span></div>
        <div class="tagline">Event Management Platform</div>
      </div>
      ${heroHtml}
      <div class="bd">
        ${mainHtml}
        <div class="sig">
          <div class="sig-copy">${h(sigCopy)}</div>
          <div class="sig-name">Aakshat Hariharan</div>
          <div class="sig-title">Founder, PlanIt</div>
        </div>
      </div>
      <div class="footer">
        <p>${h(footerNote)} To stop receiving these emails, reply with "unsubscribe" and we will remove you immediately.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function featureTable(features) {
  const rows = [];
  for (let i = 0; i < features.length; i += 2) {
    const a = features[i];
    const b = features[i + 1];
    rows.push(`<tr>
      <td class="feat"><div class="feat-title">${h(a.title)}</div><div class="feat-desc">${h(a.desc)}</div></td>
      ${b ? `<td class="feat"><div class="feat-title">${h(b.title)}</div><div class="feat-desc">${h(b.desc)}</div></td>` : '<td></td>'}
    </tr>`);
  }
  return `<table class="feat" role="presentation" width="100%"><tbody>${rows.join('')}</tbody></table>`;
}

function idealFor(text) {
  return `<div class="ideal"><div class="ideal-label">Ideal for</div><div class="ideal-text">${h(text)}</div></div>`;
}

function ctaStrip(sub, btnLabel, btnColor, ctaUrl, accentColor) {
  const url = ctaUrl || 'https://planit.app';
  return `<div class="cta-strip">
    <div>
      <div class="cta-label">Free to start</div>
      <div class="cta-val">No credit card required</div>
      <div class="cta-sub" style="color:${h(accentColor)}">${h(sub)}</div>
    </div>
    <a href="${h(url)}" class="btn" style="background:${h(btnColor)}">${h(btnLabel)}</a>
  </div>`;
}

// ─── Template builders ────────────────────────────────────────────────────────

function buildEventPlanners(ctaUrl) {
  const hero = `<div class="mkt-hero" style="background:#f7f7fa;">
    <span class="pill" style="background:#ede9fe;color:#5b21b6;">For Event Professionals</span>
    <div class="hero-title">Run events your clients will talk about.</div>
    <div class="hero-sub">PlanIt gives event professionals a single platform to manage guests, check-ins, files, and communications. No spreadsheets. No chaos.</div>
  </div>`;

  const body = `
    <div class="slabel">What PlanIt Does for You</div>
    ${featureTable([
      { title: 'Guest Management', desc: 'Import your list, assign QR codes, and check guests in from any device in seconds.' },
      { title: 'Real-Time Chat', desc: 'Keep your team and attendees connected during the event with built-in messaging.' },
      { title: 'File Sharing', desc: 'Share schedules, menus, and documents with attendees without leaving the platform.' },
      { title: 'Live Polls', desc: 'Run audience polls and Q&A sessions that keep the energy high.' },
    ])}
    <div class="quote">
      <div class="quote-text">We used to spend hours on day-of logistics. PlanIt cut that in half. Check-in that used to take 20 minutes now takes 4.</div>
      <div class="quote-attr">Event coordinator, 500-person corporate conference</div>
    </div>
    ${ctaStrip('Upgrade when you are ready', 'Get Started Free', '#7c3aed', ctaUrl, '#8b5cf6')}
  `;

  return buildEmail(
    'Run better events with PlanIt',
    'PlanIt gives event professionals a single platform for guests, check-ins, files, and more.',
    hero, body,
    'I built PlanIt because I watched talented event planners drown in logistics. You deserve tools that work as hard as you do. I hope PlanIt earns a place in your workflow.',
    '#7c3aed',
    'You are receiving this because you expressed interest in event management tools.'
  );
}

function buildSchools(ctaUrl) {
  const hero = `<div class="mkt-hero" style="background:#f0fdf4;border-bottom:1px solid #dcfce7;">
    <span class="pill" style="background:#dcfce7;color:#166534;">For Schools and Universities</span>
    <div class="hero-title">Student events, handled properly.</div>
    <div class="hero-sub">From orientations to graduations, PlanIt gives your institution a professional, secure platform built for high-attendance events.</div>
  </div>`;

  const body = `
    <div class="slabel">Built for Campus Events</div>
    ${featureTable([
      { title: 'Safe Check-in', desc: 'QR-based check-in means no paper lists, no confusion, and full attendance records in real time.' },
      { title: 'Role-Based Access', desc: 'Give students, faculty, and staff exactly the access they need. Organizers stay in control.' },
      { title: 'Announcements', desc: 'Send instant updates to all attendees during the event. No separate messaging app required.' },
      { title: 'Event Archive', desc: 'Every event, every attendee list, every file. Stored and searchable for your records.' },
    ])}
    ${idealFor('Student orientation events, graduation ceremonies, open days, club fairs, alumni gatherings, exam result announcements, sports days, and parent-teacher meetings.')}
    ${ctaStrip('Education pricing available on request', 'Get Started Free', '#16a34a', ctaUrl, '#22c55e')}
  `;

  return buildEmail(
    'PlanIt for schools and universities',
    'A professional event platform for campus events, from orientations to graduations.',
    hero, body,
    'School events deserve the same care as any professional conference. PlanIt is free to use, and we want to make every campus event run without a hitch.',
    '#16a34a',
    'You are receiving this because your institution was identified as a potential PlanIt user.'
  );
}

function buildTemples(ctaUrl) {
  const hero = `<div class="mkt-hero" style="background:#fffbeb;border-bottom:1px solid #fef3c7;">
    <span class="pill" style="background:#fef3c7;color:#92400e;">For Religious Organizations</span>
    <div class="hero-title">Bring your congregation together, seamlessly.</div>
    <div class="hero-sub">Whether it is a weekly service, a festival, or a large ceremony, PlanIt helps you focus on what matters most: your community.</div>
  </div>`;

  const body = `
    <div class="slabel">How PlanIt Helps Your Community</div>
    ${featureTable([
      { title: 'Easy Invitations', desc: 'Send personal digital invitations to congregation members with a single click.' },
      { title: 'Orderly Check-in', desc: 'QR codes eliminate queues and paper lists. Volunteers can check in attendees from any phone.' },
      { title: 'Multilingual Friendly', desc: 'PlanIt works in any browser with no language barriers for your attendees.' },
      { title: 'Private and Secure', desc: 'Your congregation data stays private. No advertising, no data selling, ever.' },
    ])}
    ${idealFor('Weekly services, Diwali and Navratri celebrations, Eid gatherings, Christmas and Easter services, Hanukkah events, charity fundraisers, annual general meetings, and community dinners.')}
    ${ctaStrip('Free for community and religious use', 'Get Started Free', '#d97706', ctaUrl, '#f59e0b')}
  `;

  return buildEmail(
    'PlanIt for temples and religious organizations',
    'A simple, dignified platform for congregation events, festivals, and community gatherings.',
    hero, body,
    'Community gatherings matter. I built PlanIt to make organizing them simpler so that organizers can spend their energy on people, not paperwork.',
    '#d97706',
    'You are receiving this because your organization was recommended as a potential PlanIt user.'
  );
}

function buildCorporate(ctaUrl) {
  const hero = `<div class="mkt-hero" style="background:#0f0f11;border-bottom:1px solid #1f1f23;">
    <span class="pill" style="background:rgba(139,92,246,.18);color:#a78bfa;">For Corporate Teams</span>
    <div class="hero-title" style="color:#fff;">Enterprise-grade events without enterprise-grade pricing.</div>
    <div class="hero-sub" style="color:rgba(255,255,255,.5);">PlanIt handles conferences, company retreats, product launches, and team-building events with the reliability your business demands.</div>
  </div>`;

  const body = `
    <div class="slabel">Enterprise Features</div>
    ${featureTable([
      { title: 'Subdomain Events', desc: 'Each event gets its own secure subdomain. Professional presentation for every client.' },
      { title: 'Auto-Scaling', desc: 'PlanIt scales for high attendance automatically. 50 or 5,000 attendees, same experience.' },
      { title: 'Audit Trail', desc: 'Full check-in logs, message history, and file access records. Compliance-ready.' },
      { title: 'Admin Dashboard', desc: 'Super admin controls with full visibility across all events, staff, and participants.' },
    ])}
    ${idealFor('Annual general meetings, product launches, company-wide conferences, client entertainment events, team-building days, trade shows, board retreats, and onboarding days.')}
    ${ctaStrip('Enterprise plans available on request', 'Book a Demo', '#7c3aed', ctaUrl, '#8b5cf6')}
  `;

  return buildEmail(
    'PlanIt for corporate events',
    'Enterprise-grade event management without the enterprise price tag.',
    hero, body,
    'Large company events have too many moving parts to manage with spreadsheets. PlanIt was built to handle the complexity so your team can focus on the experience.',
    '#7c3aed',
    'You are receiving this because your company was identified as a potential PlanIt enterprise client.'
  );
}

function buildCommunity(ctaUrl) {
  const hero = `<div class="mkt-hero" style="background:#f0f9ff;border-bottom:1px solid #bae6fd;">
    <span class="pill" style="background:#bae6fd;color:#075985;">For Community Groups</span>
    <div class="hero-title">Great communities deserve great tools.</div>
    <div class="hero-sub">PlanIt is free for community organizers. Stop fighting spreadsheets and group chats. Run your events from one simple place.</div>
  </div>`;

  const body = `
    <div class="slabel">Everything You Need</div>
    ${featureTable([
      { title: 'Simple Sign-Up', desc: 'Attendees join with just a name. No accounts, no passwords, no friction.' },
      { title: 'QR Check-in', desc: 'Print or share QR codes. Volunteers check people in from their phone with no training needed.' },
      { title: 'Group Chat', desc: 'Keep everyone connected before and during the event with built-in messaging.' },
      { title: 'Zero Cost', desc: 'PlanIt is free to use. No hidden fees for community and non-profit events.' },
    ])}
    ${idealFor('Neighborhood meetups, charity fundraisers, volunteer coordination, sports leagues, book clubs, cultural events, awareness walks, and local festivals.')}
    ${ctaStrip('Always free for community use', 'Get Started Free', '#0284c7', ctaUrl, '#0ea5e9')}
  `;

  return buildEmail(
    'PlanIt is free for your community',
    'A free, simple event platform for community groups and non-profits.',
    hero, body,
    'Community organizers work incredibly hard, often without any budget. PlanIt will always be free for community use. That is a commitment from me personally.',
    '#0284c7',
    'You are receiving this because your group was recommended as a potential PlanIt community user.'
  );
}

function buildWeddings(ctaUrl) {
  const hero = `<div class="mkt-hero" style="background:#fdf2f8;border-bottom:1px solid #fbcfe8;">
    <span class="pill" style="background:#fbcfe8;color:#9d174d;">For Special Occasions</span>
    <div class="hero-title">For the events that have to be perfect.</div>
    <div class="hero-sub">Weddings, engagements, milestone birthdays, anniversaries. PlanIt keeps the guest experience smooth so you can focus on making the day unforgettable.</div>
  </div>`;

  const body = `
    <div class="slabel">Made for Special Days</div>
    ${featureTable([
      { title: 'Personal Invitations', desc: 'Send each guest a personal digital invite with their own QR code. No generic links.' },
      { title: 'Guest List Control', desc: 'Track RSVPs, plus-ones, and notes all in one place. No spreadsheet needed.' },
      { title: 'Day-of Check-in', desc: 'Arrival is smooth and dignified. No paper lists, no confusion at the door.' },
      { title: 'Memory Sharing', desc: 'Share photos and documents with all guests through the event space after the day.' },
    ])}
    <div class="quote">
      <div class="quote-text">Guest check-in at our wedding used to be the one thing I was anxious about. With PlanIt it was the smoothest part of the entire day.</div>
      <div class="quote-attr">Bride, 200-person wedding reception</div>
    </div>
    ${ctaStrip('Your special day, at no extra cost', 'Get Started Free', '#db2777', ctaUrl, '#ec4899')}
  `;

  return buildEmail(
    'PlanIt for weddings and special occasions',
    'Keep your guest experience smooth and dignified, from invitation to check-in.',
    hero, body,
    'Special occasions deserve a platform built with care. I hope PlanIt plays a small part in making your day exactly what you imagined.',
    '#db2777',
    'You are receiving this because you expressed interest in event planning tools.'
  );
}

// ─── Template registry ────────────────────────────────────────────────────────

const TEMPLATES = {
  event_planners: {
    id:          'event_planners',
    name:        'Event Planners and Professionals',
    description: 'For professional event coordinators and agencies.',
    defaultSubject: 'Run better events with PlanIt',
    build:       buildEventPlanners,
  },
  schools: {
    id:          'schools',
    name:        'Schools and Universities',
    description: 'For educational institutions managing student events.',
    defaultSubject: 'PlanIt for schools and universities',
    build:       buildSchools,
  },
  temples: {
    id:          'temples',
    name:        'Temples and Religious Organizations',
    description: 'For religious organizations and congregations.',
    defaultSubject: 'Bring your congregation together with PlanIt',
    build:       buildTemples,
  },
  corporate: {
    id:          'corporate',
    name:        'Corporate and Business',
    description: 'For companies running conferences, retreats, and launches.',
    defaultSubject: 'Enterprise event management, without the enterprise price',
    build:       buildCorporate,
  },
  community: {
    id:          'community',
    name:        'Community Groups and Non-Profits',
    description: 'For community organizers. Free forever.',
    defaultSubject: 'PlanIt is free for your community',
    build:       buildCommunity,
  },
  weddings: {
    id:          'weddings',
    name:        'Weddings and Special Occasions',
    description: 'For wedding planners and milestone events.',
    defaultSubject: 'PlanIt for weddings and special occasions',
    build:       buildWeddings,
  },
};

// ─── Public API ───────────────────────────────────────────────────────────────

function listTemplates() {
  return Object.values(TEMPLATES).map(({ id, name, description, defaultSubject }) =>
    ({ id, name, description, defaultSubject })
  );
}

function previewTemplate(templateId, ctaUrl) {
  const tpl = TEMPLATES[templateId];
  if (!tpl) return null;
  return tpl.build(ctaUrl || 'https://planit.app');
}

/**
 * sendCampaign({ templateId, recipients, subject, ctaUrl })
 *
 * recipients: string[] of email addresses
 * Returns: { sent, skipped, failed, total }
 */
async function sendCampaign({ templateId, recipients, subject, ctaUrl }) {
  const tpl = TEMPLATES[templateId];
  if (!tpl) throw new Error(`Unknown template: ${templateId}`);

  const routerUrl = process.env.ROUTER_URL;
  if (!routerUrl) throw new Error('ROUTER_URL not set');

  const html      = tpl.build(ctaUrl || 'https://planit.app');
  const finalSubj = subject || tpl.defaultSubject;

  const results = { sent: 0, skipped: 0, failed: 0, total: recipients.length };

  for (let i = 0; i < recipients.length; i++) {
    const to = (recipients[i] || '').trim().toLowerCase();
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      results.skipped++;
      continue;
    }

    const allowed = await isMarketingAllowed(to);
    if (!allowed) {
      console.log(`[marketing] SKIP ${to} - already received marketing today`);
      results.skipped++;
      continue;
    }

    const r = await meshPost(
      CALLER,
      `${routerUrl}/mesh/email`,
      { to, subject: finalSubj, html },
      { timeout: 15000 }
    );

    if (r.ok) {
      results.sent++;
    } else {
      console.error(`[marketing] Failed -> ${to}:`, r.error || 'unknown');
      results.failed++;
    }

    // Batch delay: pause every BATCH_SIZE sends to stay within rate limits
    if ((i + 1) % BATCH_SIZE === 0 && i + 1 < recipients.length) {
      await sleep(BATCH_DELAY);
    }
  }

  console.log(`[marketing] Campaign "${templateId}": sent=${results.sent} skipped=${results.skipped} failed=${results.failed}`);
  return results;
}

module.exports = { listTemplates, previewTemplate, sendCampaign };
