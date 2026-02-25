'use strict';

/**
 * services/marketingService.js
 *
 * Marketing email campaigns. Sends via the router mesh endpoint (/mesh/email)
 * so RESEND_API_KEY stays on the router only.
 *
 * Templates:
 *   planners   - Professional event coordinators and agencies
 *   schools    - Schools and universities
 *   temples    - All places of worship (multi-faith)
 *   corporate  - Corporate and enterprise teams
 *   community  - Community groups and non-profits
 *   weddings   - Weddings and special occasions
 *
 * Rate limiting: max 1 marketing email per address per calendar day.
 * Sends are batched in groups of 10 with a 1.2s delay between batches.
 */

const redis        = require('./redisClient');
const { meshPost } = require('../middleware/mesh');

const CALLER      = process.env.BACKEND_LABEL || 'Backend';
const BATCH_SIZE  = 10;
const BATCH_DELAY = 1200;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const h = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function isMarketingAllowed(email) {
  const day = new Date().toISOString().slice(0, 10);
  const key = `mktlimit:${email}:${day}`;
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
.feat-outer{width:100%;border-collapse:separate;border-spacing:6px;margin:-6px 0}
.feat-cell{background:#f7f7fb;border:1px solid #e8e8f2;border-radius:7px;padding:15px 16px;vertical-align:top;width:50%}
.ft{font-size:12.5px;font-weight:700;color:#0b0b13;margin-bottom:5px}
.fd{font-size:11.5px;color:#6a6a8a;line-height:1.55}
.ideal{border-left:3px solid;border-radius:0 7px 7px 0;padding:15px 18px;margin:18px 0}
.ideal-cap{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#b0b0c8;margin-bottom:7px}
.ideal-body{font-size:13px;color:#3a3a58;line-height:1.72}
.pquote{border-left:3px solid #e0e0ec;padding:13px 18px;margin:18px 0;background:#fafafa;border-radius:0 7px 7px 0}
.pquote-text{font-size:13.5px;color:#3a3a58;line-height:1.7;font-style:italic}
.pquote-attr{font-size:11px;color:#b0b0c8;margin-top:8px;font-style:normal}
.stat-outer{width:100%;border-collapse:separate;border-spacing:6px;margin:18px 0}
.stat-cell{background:#f7f7fb;border:1px solid #e8e8f2;border-radius:7px;padding:16px 10px;text-align:center;vertical-align:top}
.stat-n{font-size:22px;font-weight:700;letter-spacing:-.5px}
.stat-l{font-size:9.5px;color:#b0b0c8;margin-top:4px;text-transform:uppercase;letter-spacing:.8px}
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
  .feat-outer,.stat-outer{border-spacing:4px!important}
  .feat-cell{display:block!important;width:100%!important;margin-bottom:4px}
  .stat-cell{display:block!important;width:100%!important;margin-bottom:4px}
  .ds-btn-td{display:block!important;text-align:left!important;padding:0 24px 20px!important}
  .ds-cta{display:block!important;text-align:center!important}
  .foot{padding:16px 20px!important}
}
`;

// ─── Shell ────────────────────────────────────────────────────────────────────

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

// ─── Shared fragments ─────────────────────────────────────────────────────────

function featGrid(items) {
  let rows = '';
  for (let i = 0; i < items.length; i += 2) {
    const a = items[i], b = items[i + 1];
    rows += `<tr>
      <td class="feat-cell"><div class="ft">${a.t}</div><div class="fd">${a.d}</div></td>
      ${b ? `<td class="feat-cell"><div class="ft">${b.t}</div><div class="fd">${b.d}</div></td>` : '<td></td>'}
    </tr>`;
  }
  return `<table class="feat-outer" role="presentation"><tbody>${rows}</tbody></table>`;
}

/**
 * darkStrip — uses proper <table> markup for reliable rendering
 * in all email clients, webviews, and iframes.
 */
function darkStrip(cap, head, sub, btnLabel, btnColor, ctaUrl) {
  const url = ctaUrl || process.env.FRONTEND_URL || 'https://planitapp.onrender.com';
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:9px;overflow:hidden;margin:22px 0">
  <tr>
    <td style="background:#0b0b13;padding:22px 24px;vertical-align:middle;border-radius:9px 0 0 9px">
      <div style="font-size:9.5px;color:rgba(255,255,255,.32);letter-spacing:.8px;text-transform:uppercase;margin-bottom:4px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">${h(cap)}</div>
      <div style="font-size:17px;font-weight:700;color:#ffffff;letter-spacing:-.3px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">${h(head)}</div>
      <div style="font-size:11px;color:${btnColor};margin-top:3px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">${h(sub)}</div>
    </td>
    <td class="ds-btn-td" style="background:#0b0b13;padding:22px 24px 22px 0;vertical-align:middle;text-align:right;white-space:nowrap;border-radius:0 9px 9px 0">
      <a href="${h(url)}" class="ds-cta" style="display:inline-block;padding:12px 22px;border-radius:6px;font-size:13px;font-weight:600;text-decoration:none;color:#ffffff;background:${btnColor};letter-spacing:-.1px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;white-space:nowrap">${h(btnLabel)}</a>
    </td>
  </tr>
</table>`;
}

// ─── Template builders ────────────────────────────────────────────────────────

function buildPlanners(ctaUrl) {
  const hero = `<div class="hero">
    <span class="eyebrow" style="background:#eff0ff;color:#3730a3">For Event Professionals</span>
    <h1 class="h1">Your clients remember the experience. Not the effort behind it.</h1>
    <p class="hero-p">PlanIt gives professional event coordinators a single workspace for guest management, day-of check-in, team communication, and post-event wrap-up. It looks polished to clients. It saves hours in practice.</p>
  </div>`;

  const body = `
    <div class="cap">What Changes When You Use PlanIt</div>
    ${featGrid([
      { t: 'Branded Event Links',       d: 'Every event gets its own clean URL. Share with clients and attendees without exposing your internal tooling.' },
      { t: 'QR Check-in, Any Device',   d: 'Any team member with a smartphone can check guests in. No app download, no morning-of training required.' },
      { t: 'Real-Time Guest Tracking',  d: 'Watch arrivals as they happen. Know exactly who has checked in and who has not, from anywhere.' },
      { t: 'Built-in Team Chat',        d: 'Keep venue staff, caterers, AV teams, and your coordinators aligned without juggling separate group threads.' },
      { t: 'Live Polls and Q&amp;A',    d: 'Run audience decisions mid-event. Venue vote, session preference, speaker Q&amp;A — all inside PlanIt.' },
      { t: 'File and Document Hub',     d: 'Floor plans, run sheets, vendor contracts, seating charts. One organised place for everything your team needs.' },
    ])}
    <div class="pquote" style="border-left-color:#3730a3;margin-top:26px">
      <div class="pquote-text">Check-in used to be our most stressful forty minutes. With PlanIt it was running before I even reached the registration desk. The client noticed. They hired us for the next two.</div>
      <div class="pquote-attr">Senior Event Coordinator, 400-person corporate conference, London</div>
    </div>
    ${darkStrip('Free to start, no credit card required', 'Built for people who do this professionally.', 'Upgrade plans available for high-volume teams', 'Get Started Free', '#3730a3', ctaUrl)}`;

  return shell(
    'The event platform your clients will notice',
    'PlanIt gives event professionals a single workspace for guests, check-in, team chat, and more.',
    'For Event Professionals', 'rgba(55,48,163,.55)',
    hero, body,
    'I built PlanIt because I watched skilled coordinators lose time to tools that were not designed for this work. You deserve a platform that keeps pace with you.',
    'You are receiving this because you were identified as an event management professional. To stop receiving these emails, reply with "unsubscribe."'
  );
}

function buildSchools(ctaUrl) {
  const hero = `<div class="hero">
    <span class="eyebrow" style="background:#f0fdf5;color:#166534">For Schools and Universities</span>
    <h1 class="h1">Campus events deserve more than a spreadsheet and a hope.</h1>
    <p class="hero-p">From Freshers' Week and open days to graduation ceremonies and cultural festivals, PlanIt gives educational institutions a structured, accountable way to run student-facing events at any scale.</p>
  </div>`;

  const body = `
    <div class="cap">Designed for Institutional Events</div>
    ${featGrid([
      { t: 'Attendance Records',     d: 'Real-time check-in produces a full attendance log — useful for welfare, access control, and institutional compliance.' },
      { t: 'Role Access Control',    d: 'Give student union officers, faculty coordinators, and venue staff the exact level of access each role requires.' },
      { t: 'Bulk Guest Management',  d: 'Import your entire guest list and assign QR codes in bulk. 1,200 students is as straightforward as 50.' },
      { t: 'Instant Announcements',  d: 'Push updates to all attendees mid-event without relying on a separate messaging app or PA system.' },
      { t: 'Multi-Event Capacity',   d: 'Run orientation, sports day, and a departmental showcase simultaneously from the same administrative view.' },
      { t: 'Secure by Default',      d: "No attendee data is sold or profiled for advertising. Your institution's records stay with your institution." },
    ])}
    <div class="ideal" style="border-left-color:#166534;background:#f0fdf5">
      <div class="ideal-cap">Common Use Cases</div>
      <div class="ideal-body">Freshers' and orientation weeks, graduation and convocation ceremonies, university open days, student union elections and AGMs, inter-college cultural fests, sports days, alumni networking events, department welcome evenings, and parent information sessions.</div>
    </div>
    ${darkStrip('No charge for educational use', 'Professional-grade tools at a student-union budget.', 'Education pricing available for larger institutions', 'Get Started Free', '#15803d', ctaUrl)}`;

  return shell(
    'Event management built for campus life',
    'A free, professional event platform for schools and universities.',
    'For Educational Institutions', 'rgba(21,128,61,.55)',
    hero, body,
    'Schools and universities should not have to pay enterprise prices to run a well-organised event. PlanIt is free to use, and that is not a trial period.',
    'You are receiving this because your institution was identified as a potential PlanIt user. To stop receiving these emails, reply with "unsubscribe."'
  );
}

function buildTemples(ctaUrl) {
  const hero = `<div class="hero">
    <span class="eyebrow" style="background:#fefce8;color:#92400e">For Places of Worship</span>
    <h1 class="h1">Your community gathers with purpose. The tools behind it should support that.</h1>
    <p class="hero-p">Whether your congregation is Hindu, Muslim, Christian, Jewish, Sikh, or of any other faith, the administration of bringing people together should never overshadow the occasion itself. PlanIt handles the logistics so your leaders and volunteers can give their full attention to what matters.</p>
  </div>`;

  const body = `
    <div class="cap">How PlanIt Serves Religious Congregations</div>
    ${featGrid([
      { t: 'Respectful Check-in',     d: 'QR-based arrival eliminates paper lists and door queues. Dignified, orderly, and manageable by any volunteer with a smartphone.' },
      { t: 'Personal Invitations',    d: 'Send each congregation member their own invite. Appropriate for occasions where the guest list carries personal meaning.' },
      { t: 'Private and Ad-Free',     d: "Congregation data is never sold, shared with advertisers, or used for profiling. Your community's trust is not a revenue stream." },
      { t: 'No Account for Guests',   d: 'Attendees join with a name only. No registration form, no password, no barrier for elderly or less technical members.' },
      { t: 'Multi-Language Ready',    d: 'PlanIt renders correctly in Devanagari, Arabic, Hebrew, Gurmukhi, and all other scripts in modern browsers.' },
      { t: 'Volunteer Coordination',  d: 'Assign duties and timing to volunteers before the event. Keep the whole team aligned without a chain of phone calls.' },
    ])}
    <div class="ideal" style="border-left-color:#b45309;background:#fffbeb">
      <div class="ideal-cap">Events This Is Designed For</div>
      <div class="ideal-body">
        <strong style="color:#92400e">Hindu:</strong> Diwali puja, Navratri garba, Dussehra, Ram Navami, Janmashtami, Ganesh Chaturthi, havan and yagna events, classical music and cultural programmes<br/><br/>
        <strong style="color:#92400e">Muslim:</strong> Eid al-Fitr and Eid al-Adha gatherings, Ramadan iftar, Laylat al-Qadr programmes, Jumuah overflow management, milad and nasheed events, nikah receptions<br/><br/>
        <strong style="color:#92400e">Christian:</strong> Christmas and Easter services, Good Friday observances, baptism and confirmation celebrations, church fundraisers, harvest festivals, carol concerts<br/><br/>
        <strong style="color:#92400e">Jewish:</strong> Rosh Hashanah and Yom Kippur services, Hanukkah evenings, Passover seders, bar and bat mitzvah receptions, Purim celebrations, Shabbat dinners<br/><br/>
        <strong style="color:#92400e">Sikh:</strong> Gurpurab commemorations, Vaisakhi celebrations, Akhand Path programmes, langar coordination, community seva drives<br/><br/>
        <strong style="color:#92400e">All faiths:</strong> Charity fundraisers, interfaith dialogue events, annual general meetings, community dinners, memorial services
      </div>
    </div>
    ${darkStrip('Free for community and religious organisations', 'Every gathering, managed with care.', 'No fees, no advertisements, no conditions', 'Get Started Free', '#b45309', ctaUrl)}`;

  return shell(
    "Organise your community's events with dignity and ease",
    'A free platform for places of worship — dignified check-in, personal invitations, volunteer coordination.',
    'For Places of Worship', 'rgba(180,83,9,.55)',
    hero, body,
    'Community gatherings have always required careful organisation. I built PlanIt so that those doing the organising can give their energy to the occasion rather than the administration.',
    'You are receiving this because your organisation was recommended as a potential PlanIt user. To stop receiving these emails, reply with "unsubscribe."'
  );
}

function buildCorporate(ctaUrl) {
  const hero = `<div class="hero" style="background:#0b0b13;border-bottom:1px solid #1a1a28">
    <span class="eyebrow" style="background:rgba(99,85,240,.15);color:#9d8cfc">For Corporate Teams</span>
    <h1 class="h1" style="color:#ffffff">Your events represent your organisation. The platform behind them should too.</h1>
    <p class="hero-p" style="color:rgba(255,255,255,.44)">PlanIt gives enterprise teams the structure, auditability, and scale to run conferences, AGMs, product launches, and internal events — without relying on a patchwork of tools that do not talk to each other.</p>
  </div>`;

  const body = `
    <div class="cap">Enterprise Capabilities</div>
    ${featGrid([
      { t: 'Custom Subdomain per Event',   d: 'Every event lives at its own branded URL. Consistent, professional, and distinct from every other event.' },
      { t: 'Scales to Any Attendance',     d: 'PlanIt handles 50 or 5,000 attendees without configuration changes or per-head pricing surprises.' },
      { t: 'Full Audit Trail',             d: 'Complete check-in logs, message history, file access records, and poll results — ready for compliance and reporting.' },
      { t: 'Enterprise Access Controls',   d: 'Super-admin visibility across all events. Role permissions for organisers, moderators, and read-only stakeholders.' },
      { t: 'Integrated Task Management',   d: 'Assign pre-event deliverables to internal teams with deadlines and status tracking. No separate project tool needed.' },
      { t: 'Expense Tracking',             d: 'Log and split event expenses against a budget. Export records for finance sign-off without additional software.' },
    ])}
    <table class="stat-outer" role="presentation">
      <tr>
        <td class="stat-cell"><div class="stat-n" style="color:#6355f0">50,000+</div><div class="stat-l">Events Managed</div></td>
        <td class="stat-cell"><div class="stat-n" style="color:#6355f0">500k+</div><div class="stat-l">Attendees Tracked</div></td>
        <td class="stat-cell"><div class="stat-n" style="color:#6355f0">99.9%</div><div class="stat-l">Platform Uptime</div></td>
      </tr>
    </table>
    <div class="ideal" style="border-left-color:#6355f0;background:#f5f4ff">
      <div class="ideal-cap">Typical Enterprise Use Cases</div>
      <div class="ideal-body">Annual general meetings, all-hands and town halls, product launches and press events, client conferences, trade show presence management, team off-sites and leadership retreats, onboarding cohort events, and compliance training sessions.</div>
    </div>
    ${darkStrip('No credit card required to start', 'Built for teams that cannot afford a bad event.', 'Enterprise and volume pricing available on request', 'Request a Demo', '#4f46e5', ctaUrl)}`;

  return shell(
    'Enterprise event infrastructure, without the enterprise cost',
    'PlanIt gives corporate teams the structure, auditability, and scale for professional events.',
    'For Corporate Teams', 'rgba(99,85,240,.55)',
    hero, body,
    'Large-scale events have too many moving parts to manage with spreadsheets and email threads. PlanIt was built specifically to handle the complexity so your team can focus on what the event is actually for.',
    'You are receiving this because your company was identified as a potential PlanIt enterprise client. To stop receiving these emails, reply with "unsubscribe."'
  );
}

function buildCommunity(ctaUrl) {
  const hero = `<div class="hero">
    <span class="eyebrow" style="background:#eff6ff;color:#1e40af">For Community Groups</span>
    <h1 class="h1">The people doing the most important work rarely have the largest budgets.</h1>
    <p class="hero-p">PlanIt is free for community organisers, charities, and non-profits. Not free for fourteen days. Not free with a credit card on file. Free, because those running local events should not have to justify a tool cost to a volunteer committee.</p>
  </div>`;

  const body = `
    <div class="cap">What You Get at No Cost</div>
    ${featGrid([
      { t: 'No Attendee Accounts',          d: 'Participants join with just a name. Nothing to sign up for, nothing to download — no barrier to entry for any age group.' },
      { t: 'QR Check-in Without Hardware',  d: "Any volunteer's smartphone becomes a check-in scanner. Print QR codes or let attendees show them on screen." },
      { t: 'Group Communication',           d: 'Keep volunteers, committee members, and staff aligned with built-in messaging throughout planning and on the day.' },
      { t: 'Task and Rota Management',      d: 'Assign volunteering slots and pre-event responsibilities. Track completion without chasing people over WhatsApp.' },
      { t: 'Fundraising Tracking',          d: 'Log targets and contributions against your event budget. Useful for charity events and grant reporting requirements.' },
      { t: 'Unlimited Participants',        d: 'No cap on team size or attendee numbers. 2,000 visitors at a street festival costs the same as a book club of 15: nothing.' },
    ])}
    <div class="pquote" style="border-left-color:#1d4ed8">
      <div class="pquote-text">We used PlanIt for our annual community health fair — over 800 attendees, 40 volunteers, three venues running simultaneously. The check-in system alone saved us eight hours of manual data entry that week.</div>
      <div class="pquote-attr">Community coordinator, non-profit health organisation, Birmingham</div>
    </div>
    <div class="ideal" style="border-left-color:#1d4ed8;background:#eff6ff">
      <div class="ideal-cap">Who This Is For</div>
      <div class="ideal-body">Neighbourhood associations, local charities, youth clubs and sports leagues, food banks and community kitchens, cultural and arts organisations, mutual aid groups, residents' associations, awareness campaigns, and local government outreach events.</div>
    </div>
    ${darkStrip('Always free for community use', 'Good tools should be accessible to good people.', 'No advertisements, no data selling, no upsell pressure', 'Get Started Free', '#1d4ed8', ctaUrl)}`;

  return shell(
    'PlanIt is free for community organisers — genuinely, no conditions',
    'Free event management for community groups, charities, and non-profits.',
    'For Community Groups', 'rgba(29,78,216,.55)',
    hero, body,
    'Community organisers work harder than almost anyone, usually without recognition and rarely with adequate resources. PlanIt will always be free for community use. That is a personal commitment, not a marketing line.',
    'You are receiving this because your group was recommended as a potential PlanIt community user. To stop receiving these emails, reply with "unsubscribe."'
  );
}

function buildWeddings(ctaUrl) {
  const hero = `<div class="hero">
    <span class="eyebrow" style="background:#fdf4ff;color:#86198f">For Weddings and Special Occasions</span>
    <h1 class="h1">One day. Every detail matters. Nothing should go wrong at the door.</h1>
    <p class="hero-p">PlanIt is used by couples and wedding coordinators to manage the guest experience from personalised invitation through to seamless arrival and check-in. It handles the administration so the day can be exactly what you imagined.</p>
  </div>`;

  const body = `
    <div class="cap">Guest Experience From Invitation to Arrival</div>
    ${featGrid([
      { t: 'Individual Guest Invitations', d: 'Each guest receives their own personal invite with a unique QR code — not a generic link forwarded around a group chat.' },
      { t: 'Seating and Table Management', d: 'Assign guests to tables. Track RSVPs, dietary requirements, and plus-ones in one place, without a separate spreadsheet.' },
      { t: 'Dignified Check-in',           d: 'Guests show their QR code on arrival. No paper list, no names being called out, no queue forming at the entrance.' },
      { t: 'Planner and Vendor Access',    d: "Give your wedding planner, on-site coordinator, and venue manager the access they need without sharing a personal login." },
      { t: 'Post-Event Memory Sharing',    d: 'Share photographs, a video recording, and thank-you notes with all guests through the same event space, after the day.' },
      { t: 'Multi-Language Guest Support', d: 'Your guest list may span multiple countries. PlanIt works in any browser with no translation barriers for international attendees.' },
    ])}
    <div class="pquote" style="border-left-color:#a21caf">
      <div class="pquote-text">We had guests arriving from four countries, two family groups meeting for the first time, and a coordinator managing remotely. Check-in was the one moment I was genuinely anxious about. It took less than three minutes to clear the entire arrivals queue.</div>
      <div class="pquote-attr">Bride, 180-person wedding reception, New York</div>
    </div>
    <div class="ideal" style="border-left-color:#a21caf;background:#fdf4ff">
      <div class="ideal-cap">Occasions PlanIt Is Used For</div>
      <div class="ideal-body">
        <strong style="color:#86198f">Western weddings:</strong> ceremony, rehearsal dinner, reception, morning-after brunch<br/><br/>
        <strong style="color:#86198f">South Asian celebrations:</strong> sangeet, mehendi, haldi, baraat, shaadi, walima, and reception<br/><br/>
        <strong style="color:#86198f">Other milestone events:</strong> engagement parties, anniversary celebrations, milestone birthdays, naming ceremonies, graduation parties, and retirement dinners
      </div>
    </div>
    ${darkStrip('No charge for personal occasions', 'One day. Done properly.', 'Use it for your celebration at no cost', 'Get Started Free', '#a21caf', ctaUrl)}`;

  return shell(
    'For the events that have to be perfect',
    'PlanIt for weddings and special occasions — dignified check-in, personal invitations, seamless arrivals.',
    'For Special Occasions', 'rgba(162,28,175,.55)',
    hero, body,
    'Special occasions deserve tools built with the same care that goes into the occasion itself. I hope PlanIt earns a small place in making your day exactly what you envisioned.',
    'You are receiving this because you expressed interest in event planning tools. To stop receiving these emails, reply with "unsubscribe."'
  );
}

// ─── Template registry ────────────────────────────────────────────────────────

const TEMPLATES = {
  planners: {
    id: 'planners',
    name: 'Event Planners and Professionals',
    description: 'For professional event coordinators and agencies.',
    defaultSubject: 'The event platform your clients will notice',
    build: buildPlanners,
  },
  schools: {
    id: 'schools',
    name: 'Schools and Universities',
    description: 'For educational institutions managing student and campus events.',
    defaultSubject: 'Event management built for campus life',
    build: buildSchools,
  },
  temples: {
    id: 'temples',
    name: 'Places of Worship',
    description: 'For religious organisations and congregations of all faiths.',
    defaultSubject: "Organise your community's events with dignity and ease",
    build: buildTemples,
  },
  corporate: {
    id: 'corporate',
    name: 'Corporate and Business',
    description: 'For companies running conferences, retreats, and launches.',
    defaultSubject: 'Enterprise event infrastructure, without the enterprise cost',
    build: buildCorporate,
  },
  community: {
    id: 'community',
    name: 'Community Groups and Non-Profits',
    description: 'For community organisers. Free forever.',
    defaultSubject: 'PlanIt is free for community organisers — genuinely, no conditions',
    build: buildCommunity,
  },
  weddings: {
    id: 'weddings',
    name: 'Weddings and Special Occasions',
    description: 'For couples, wedding planners, and milestone events.',
    defaultSubject: 'For the events that have to be perfect',
    build: buildWeddings,
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
  return tpl.build(ctaUrl || process.env.FRONTEND_URL || 'https://planitapp.onrender.com');
}

/**
 * sendCampaign({ templateId, recipients, subject, ctaUrl })
 * Returns: { sent, skipped, failed, total }
 */
async function sendCampaign({ templateId, recipients, subject, ctaUrl }) {
  const tpl = TEMPLATES[templateId];
  if (!tpl) throw new Error(`Unknown template: ${templateId}`);

  const routerUrl = process.env.ROUTER_URL;
  if (!routerUrl) throw new Error('ROUTER_URL not set');

  const resolvedCtaUrl = ctaUrl || process.env.FRONTEND_URL || 'https://planitapp.onrender.com';
  const html           = tpl.build(resolvedCtaUrl);
  const finalSubj      = subject || tpl.defaultSubject;

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

    if ((i + 1) % BATCH_SIZE === 0 && i + 1 < recipients.length) {
      await sleep(BATCH_DELAY);
    }
  }

  console.log(`[marketing] Campaign "${templateId}": sent=${results.sent} skipped=${results.skipped} failed=${results.failed}`);
  return results;
}

module.exports = { listTemplates, previewTemplate, sendCampaign };
