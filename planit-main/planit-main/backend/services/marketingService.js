'use strict';



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

function emailShell(title, preheader, pillLabel, pillStyle, headerRowHtml, bodyHtml, sigCopy, footerNote) {
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
      .fc{display:block!important;width:100%!important;padding:0 0 6px 0!important}
      .sc{display:block!important;width:100%!important;padding:0 0 6px 0!important}
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
                    <span style="display:inline-block;font-size:10px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;${pillStyle};border-radius:20px;padding:5px 14px;font-family:${FONT};">${h(pillLabel)}</span>
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
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:36px;padding-top:24px;border-top:1px solid ${RULE};">
                <tr>
                  <td>
                    <p style="margin:0 0 18px 0;font-size:15px;color:#4B5563;line-height:1.75;font-family:${FONT};">${sigCopy}</p>
                    <p style="margin:0 0 2px 0;font-size:15px;font-weight:700;color:${DARK};font-family:${FONT};">Aakshat Hariharan</p>
                    <p style="margin:0;font-size:12px;color:${FAINT};font-family:${FONT};">Founder, PlanIt</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td class="ep" style="background:${PANEL};border-top:1px solid ${RULE};padding:20px 40px;" bgcolor="${PANEL}">
              <p style="margin:0 0 4px 0;font-size:11px;color:${FAINT};line-height:1.6;font-family:${FONT};">${h(footerNote)}</p>
              <p style="margin:0;font-size:11px;color:${FAINT};line-height:1.6;font-family:${FONT};">Reply with "unsubscribe" to be removed from this list immediately</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function sectionCap(label) {
  return `<p style="margin:0 0 16px 0;font-size:10px;font-weight:700;letter-spacing:1.3px;text-transform:uppercase;color:${FAINT};padding-bottom:10px;border-bottom:1px solid ${RULE};font-family:${FONT};">${h(label)}</p>`;
}

function hrule() {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="height:1px;background:${RULE};font-size:0;line-height:0;padding:16px 0 0 0;"></td></tr></table>`;
}

function ctaButton(label, url, color) {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:28px;width:100%;">
      <tr>
        <td align="center">
          <!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${h(url)}" style="height:50px;v-text-anchor:middle;width:260px;" arcsize="12%" stroke="f" fillcolor="${color}"><w:anchorlock/><center style="color:#ffffff;font-family:${FONT};font-size:15px;font-weight:700;">${h(label)}</center></v:roundrect><![endif]-->
          <!--[if !mso]><!-->
          <a href="${h(url)}" style="background:${color};color:#ffffff;display:inline-block;font-family:${FONT};font-size:15px;font-weight:700;line-height:50px;text-align:center;text-decoration:none;width:260px;border-radius:8px;letter-spacing:-0.2px;mso-hide:all;">${h(label)}</a>
          <!--<![endif]-->
        </td>
      </tr>
    </table>`;
}

function featGrid(items) {
  let rows = '';
  for (let i = 0; i < items.length; i += 2) {
    const a = items[i], b = items[i + 1];
    rows += `
      <tr>
        <td class="fc" style="width:50%;padding:0 6px 6px 0;vertical-align:top;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PANEL};border:1px solid #E5E7EB;border-radius:8px;">
            <tr><td style="padding:16px 18px;">
              <p style="margin:0 0 5px 0;font-size:13px;font-weight:700;color:${DARK};font-family:${FONT};">${a.t}</p>
              <p style="margin:0;font-size:13px;color:${MUTED};line-height:1.55;font-family:${FONT};">${a.d}</p>
            </td></tr>
          </table>
        </td>
        <td class="fc" style="width:50%;padding:0 0 6px 6px;vertical-align:top;">
          ${b ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PANEL};border:1px solid #E5E7EB;border-radius:8px;">
            <tr><td style="padding:16px 18px;">
              <p style="margin:0 0 5px 0;font-size:13px;font-weight:700;color:${DARK};font-family:${FONT};">${b.t}</p>
              <p style="margin:0;font-size:13px;color:${MUTED};line-height:1.55;font-family:${FONT};">${b.d}</p>
            </td></tr>
          </table>` : ''}
        </td>
      </tr>`;
  }
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>`;
}

function pullQuote(text, attr, accentColor) {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
      <tr>
        <td style="border-left:3px solid ${accentColor};padding:14px 18px;background:${PANEL};border-radius:0 8px 8px 0;">
          <p style="margin:0 0 8px 0;font-size:14px;color:${MID};line-height:1.7;font-style:italic;font-family:${FONT};">${text}</p>
          <p style="margin:0;font-size:11px;color:${FAINT};font-family:${FONT};">${attr}</p>
        </td>
      </tr>
    </table>`;
}

function idealFor(label, content, accentColor, bgColor) {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
      <tr>
        <td style="border-left:3px solid ${accentColor};padding:14px 18px;background:${bgColor};border-radius:0 8px 8px 0;">
          <p style="margin:0 0 6px 0;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${FAINT};font-family:${FONT};">${h(label)}</p>
          <p style="margin:0;font-size:14px;color:${MID};line-height:1.75;font-family:${FONT};">${content}</p>
        </td>
      </tr>
    </table>`;
}

function darkStrip(capText, headText, subText, subColor, btnLabel, btnColor, ctaUrl) {
  const url = ctaUrl || process.env.FRONTEND_URL || 'https://planitapp.onrender.com';
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;border-radius:8px;overflow:hidden;">
      <tr>
        <td style="background:${DARK};padding:24px 28px;" bgcolor="${DARK}">
          <p style="margin:0 0 3px 0;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:rgba(255,255,255,0.28);font-family:${FONT};">${h(capText)}</p>
          <p style="margin:0 0 3px 0;font-size:16px;font-weight:700;color:${WHITE};font-family:${FONT};">${h(headText)}</p>
          <p style="margin:0 0 18px 0;font-size:11px;color:${subColor};font-family:${FONT};">${h(subText)}</p>
          <a href="${h(url)}" style="display:inline-block;background:${btnColor};color:${WHITE};font-family:${FONT};font-size:13px;font-weight:700;text-decoration:none;padding:12px 28px;border-radius:6px;">${h(btnLabel)}</a>
        </td>
      </tr>
    </table>`;
}

function statsRow(items) {
  const cells = items.map((item, i) => `
    <td class="sc" style="width:${Math.floor(100/items.length)}%;padding:0 ${i < items.length - 1 ? '4px' : '0'} 0 ${i > 0 ? '4px' : '0'};vertical-align:top;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PANEL};border:1px solid #E5E7EB;border-radius:8px;text-align:center;">
        <tr><td style="padding:18px 12px;">
          <p style="margin:0 0 4px 0;font-size:22px;font-weight:800;color:${DARK};letter-spacing:-0.5px;font-family:${FONT};">${h(item.n)}</p>
          <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:0.8px;text-transform:uppercase;color:${FAINT};font-family:${FONT};">${h(item.l)}</p>
        </td></tr>
      </table>
    </td>`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;"><tr>${cells}</tr></table>`;
}

// ─── Personalisation helpers ──────────────────────────────────────────────────

function firstName(fullName) {
  if (!fullName) return '';
  return fullName.trim().split(/\s+/)[0];
}

function greetingLine(recipient) {
  const fn = firstName(recipient.name);
  if (fn) return `Hi ${h(fn)},`;
  return 'Hi there,';
}

function companyLine(recipient) {
  if (recipient.company) return ` at <strong>${h(recipient.company)}</strong>`;
  return '';
}

function personalizedOpener(recipient, templateContext) {
  const fn = firstName(recipient.name);
  const company = recipient.company ? `${h(recipient.company)}` : null;
  const role = recipient.role ? `${h(recipient.role)}` : null;

  let lines = [];
  if (fn && company) {
    lines.push(`<p style="margin:0 0 20px 0;font-size:16px;color:${DARK};line-height:1.7;font-family:${FONT};">Hi <strong>${h(fn)}</strong>,</p>`);
    lines.push(`<p style="margin:0 0 20px 0;font-size:14px;color:${MID};line-height:1.75;font-family:${FONT};">I came across <strong>${company}</strong>${role ? ` and noticed you work in <em>${role}</em>` : ''} - I wanted to reach out because I think PlanIt could genuinely help with how you manage ${templateContext}.</p>`);
  } else if (fn) {
    lines.push(`<p style="margin:0 0 20px 0;font-size:16px;color:${DARK};line-height:1.7;font-family:${FONT};">Hi <strong>${h(fn)}</strong>,</p>`);
    lines.push(`<p style="margin:0 0 20px 0;font-size:14px;color:${MID};line-height:1.75;font-family:${FONT};">I wanted to reach out directly because I think PlanIt could genuinely help with how you manage ${templateContext}.</p>`);
  } else if (company) {
    lines.push(`<p style="margin:0 0 20px 0;font-size:16px;color:${DARK};line-height:1.7;font-family:${FONT};">Hi,</p>`);
    lines.push(`<p style="margin:0 0 20px 0;font-size:14px;color:${MID};line-height:1.75;font-family:${FONT};">I came across <strong>${company}</strong> and wanted to reach out because I think PlanIt could genuinely help with how you manage ${templateContext}.</p>`);
  } else {
    lines.push(`<p style="margin:0 0 20px 0;font-size:16px;color:${DARK};line-height:1.7;font-family:${FONT};">Hi,</p>`);
    lines.push(`<p style="margin:0 0 20px 0;font-size:14px;color:${MID};line-height:1.75;font-family:${FONT};">I wanted to reach out because I think PlanIt could genuinely help with how you manage ${templateContext}.</p>`);
  }
  return lines.join('\n');
}

// ─── Template builders ────────────────────────────────────────────────────────

function buildPlanners(ctaUrl, recipient = {}) {
  const url = ctaUrl || process.env.FRONTEND_URL || 'https://planitapp.onrender.com';

  const headerRow = `
    <tr>
      <td class="ep" style="padding:36px 40px 30px 40px;border-bottom:1px solid ${RULE};">
        <span style="display:inline-block;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#3730A3;background:#EEF2FF;padding:5px 12px;border-radius:5px;margin-bottom:16px;font-family:${FONT};">For Event Professionals</span>
        <h1 style="margin:0 0 12px 0;font-size:24px;font-weight:800;color:${DARK};letter-spacing:-0.5px;line-height:1.2;font-family:${FONT};">Your clients remember the experience. Not the effort behind it.</h1>
        <p style="margin:0;font-size:15px;color:${MUTED};line-height:1.65;font-family:${FONT};">PlanIt gives professional event coordinators a single workspace for guest management, day-of check-in, team communication, and post-event wrap-up. It looks polished to clients. It saves hours in practice.</p>
      </td>
    </tr>`;

  const body = `
    ${personalizedOpener(recipient, 'events')}
    ${sectionCap('What Changes When You Use PlanIt')}
    ${featGrid([
      { t: 'Branded Event Links',      d: 'Every event gets its own clean URL. Share with clients and attendees without exposing your internal tooling.' },
      { t: 'QR Check-in, Any Device',  d: 'Any team member with a smartphone can check guests in. No app download, no morning-of training required.' },
      { t: 'Real-Time Guest Tracking', d: 'Watch arrivals as they happen. Know exactly who has checked in and who has not, from anywhere.' },
      { t: 'Built-in Team Chat',       d: 'Keep venue staff, caterers, AV teams, and coordinators aligned without juggling separate group threads.' },
      { t: 'Live Polls and Q&amp;A',   d: 'Run audience decisions mid-event. Venue vote, session preference, speaker Q&amp;A  all inside PlanIt.' },
      { t: 'File and Document Hub',    d: 'Floor plans, run sheets, vendor contracts, seating charts. One organised place for everything your team needs.' },
    ])}
    
    ${darkStrip('Free to start, no credit card required', 'Built for people who do this professionally.', 'Upgrade plans available for high-volume teams', '#818CF8', 'Get Started Free', '#3730A3', url)}`;

  return emailShell(
    'The event platform your clients will notice',
    'PlanIt gives event professionals a single workspace for guests, check-in, team chat, and more.',
    'For Event Professionals',
    `color:rgba(167,163,247,0.85);border:1px solid rgba(99,85,240,0.4)`,
    headerRow,
    body,
    'I built PlanIt because I watched skilled coordinators lose time to tools that were not designed for this work. You deserve a platform that keeps pace with you.',
    `You are receiving this because ${recipient.company ? `${h(recipient.company)} was identified` : 'you were identified'} as an event management professional.`
  );
}

function buildSchools(ctaUrl, recipient = {}) {
  const url = ctaUrl || process.env.FRONTEND_URL || 'https://planitapp.onrender.com';

  const headerRow = `
    <tr>
      <td class="ep" style="padding:36px 40px 30px 40px;border-bottom:1px solid ${RULE};">
        <span style="display:inline-block;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#166534;background:#F0FDF4;padding:5px 12px;border-radius:5px;margin-bottom:16px;font-family:${FONT};">For Schools and Universities</span>
        <h1 style="margin:0 0 12px 0;font-size:24px;font-weight:800;color:${DARK};letter-spacing:-0.5px;line-height:1.2;font-family:${FONT};">Campus events deserve more than a spreadsheet and a hope.</h1>
        <p style="margin:0;font-size:15px;color:${MUTED};line-height:1.65;font-family:${FONT};">From Freshers' Week and open days to graduation ceremonies and cultural festivals, PlanIt gives educational institutions a structured, accountable way to run student-facing events at any scale.</p>
      </td>
    </tr>`;

  const body = `
    ${personalizedOpener(recipient, 'campus and institutional events')}
    ${sectionCap('Designed for Institutional Events')}
    ${featGrid([
      { t: 'Attendance Records',    d: 'Real-time check-in produces a full attendance log for welfare, access control, and institutional compliance.' },
      { t: 'Role Access Control',   d: 'Give student officers, faculty coordinators, and venue staff the exact access level each role requires.' },
      { t: 'Bulk Guest Management', d: 'Import your entire guest list and assign QR codes in bulk. 1,200 students is as straightforward as 50.' },
      { t: 'Instant Announcements', d: 'Push updates to all attendees mid-event without relying on a separate messaging app or PA system.' },
      { t: 'Multi-Event Capacity',  d: 'Run orientation, sports day, and a departmental showcase simultaneously from the same administrative view.' },
      { t: 'Secure by Default',     d: "No attendee data is sold or profiled for advertising. Your institution's records stay with your institution." },
    ])}
    ${idealFor(
      'Common Use Cases',
      "Freshers' and orientation weeks, graduation and convocation ceremonies, university open days, student union elections and AGMs, inter-college cultural fests, sports days, alumni networking events, department welcome evenings, and parent information sessions.",
      '#166534',
      '#F0FDF4'
    )}
    ${darkStrip('No charge for educational use', 'Professional-grade tools at a student-union budget.', 'Education pricing available for larger institutions', '#4ADE80', 'Get Started Free', '#15803D', url)}`;

  return emailShell(
    'Event management built for campus life',
    'A free, professional event platform for schools and universities.',
    'For Educational Institutions',
    `color:rgba(134,239,172,0.85);border:1px solid rgba(21,128,61,0.5)`,
    headerRow,
    body,
    'Schools and universities should not have to pay enterprise prices to run a well-organised event. PlanIt is free to use, and that is not a trial period.',
    `You are receiving this because ${recipient.company || 'your institution'} was identified as a potential PlanIt user.`
  );
}

function buildTemples(ctaUrl, recipient = {}) {
  const url = ctaUrl || process.env.FRONTEND_URL || 'https://planitapp.onrender.com';

  const headerRow = `
    <tr>
      <td class="ep" style="padding:36px 40px 30px 40px;border-bottom:1px solid ${RULE};">
        <span style="display:inline-block;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#92400E;background:#FFFBEB;padding:5px 12px;border-radius:5px;margin-bottom:16px;font-family:${FONT};">For Places of Worship</span>
        <h1 style="margin:0 0 12px 0;font-size:24px;font-weight:800;color:${DARK};letter-spacing:-0.5px;line-height:1.2;font-family:${FONT};">Your community gathers with purpose. The tools behind it should support that.</h1>
        <p style="margin:0;font-size:15px;color:${MUTED};line-height:1.65;font-family:${FONT};">Whether your congregation is Hindu, Muslim, Christian, Jewish, Sikh, or of any other faith, the administration of bringing people together should never overshadow the occasion itself. PlanIt handles the logistics so your leaders and volunteers can give their full attention to what matters.</p>
      </td>
    </tr>`;

  const body = `
    ${personalizedOpener(recipient, 'community and religious gatherings')}
    ${sectionCap('How PlanIt Serves Religious Congregations')}
    ${featGrid([
      { t: 'Respectful Check-in',    d: 'QR-based arrival eliminates paper lists and door queues. Dignified, orderly, and manageable by any volunteer with a smartphone.' },
      { t: 'Personal Invitations',   d: 'Send each congregation member their own invite. Appropriate for occasions where the guest list carries personal meaning.' },
      { t: 'Private and Ad-Free',    d: "Congregation data is never sold, shared with advertisers, or used for profiling. Your community's trust is not a revenue stream." },
      { t: 'No Account for Guests',  d: 'Attendees join with a name only. No registration form, no password, no barrier for elderly or less technical members.' },
      { t: 'Multi-Language Ready',   d: 'PlanIt renders correctly in Devanagari, Arabic, Hebrew, Gurmukhi, and all other scripts in modern browsers.' },
      { t: 'Volunteer Coordination', d: 'Assign duties and timing to volunteers before the event. Keep the whole team aligned without a chain of phone calls.' },
    ])}
    ${idealFor(
      'Events This Is Designed For',
      `<strong style="color:#92400E;">Hindu:</strong> Diwali puja, Navratri garba, Dussehra, Ram Navami, Janmashtami, Ganesh Chaturthi, havan and yagna events<br/><br/><strong style="color:#92400E;">Muslim:</strong> Eid al-Fitr and Eid al-Adha gatherings, Ramadan iftar, Laylat al-Qadr programmes, Jumuah overflow, milad events, nikah receptions<br/><br/><strong style="color:#92400E;">Christian:</strong> Christmas and Easter services, Good Friday observances, baptism and confirmation celebrations, church fundraisers, carol concerts<br/><br/><strong style="color:#92400E;">Jewish:</strong> Rosh Hashanah and Yom Kippur services, Hanukkah evenings, Passover seders, bar and bat mitzvah receptions, Purim celebrations<br/><br/><strong style="color:#92400E;">Sikh:</strong> Gurpurab commemorations, Vaisakhi celebrations, Akhand Path programmes, langar coordination, community seva drives`,
      '#B45309',
      '#FFFBEB'
    )}
    ${darkStrip('Free for community and religious organisations', 'Every gathering, managed with care.', 'No fees, no advertisements, no conditions', '#FCD34D', 'Get Started Free', '#B45309', url)}`;

  return emailShell(
    "Organise your community's events with dignity and ease",
    'A free platform for places of worship, dignified check-in, personal invitations, volunteer coordination.',
    'For Places of Worship',
    `color:rgba(253,186,116,0.85);border:1px solid rgba(180,83,9,0.4)`,
    headerRow,
    body,
    'Community gatherings have always required careful organisation. I built PlanIt so that those doing the organising can give their energy to the occasion rather than the administration.',
    `You are receiving this because ${recipient.company || 'your organisation'} was recommended as a potential PlanIt user.`
  );
}

function buildCorporate(ctaUrl, recipient = {}) {
  const url = ctaUrl || process.env.FRONTEND_URL || 'https://planitapp.onrender.com';

  const headerRow = `
    <tr>
      <td class="ep" style="background:${DARK};padding:36px 40px 30px 40px;border-bottom:1px solid #1F2937;" bgcolor="${DARK}">
        <span style="display:inline-block;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:rgba(167,163,247,0.8);background:rgba(99,85,240,0.12);padding:5px 12px;border-radius:5px;margin-bottom:16px;font-family:${FONT};">For Corporate Teams</span>
        <h1 style="margin:0 0 12px 0;font-size:24px;font-weight:800;color:${WHITE};letter-spacing:-0.5px;line-height:1.2;font-family:${FONT};">Your events represent your organisation. The platform behind them should too.</h1>
        <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.4);line-height:1.65;font-family:${FONT};">PlanIt gives enterprise teams the structure, auditability, and scale to run conferences, AGMs, product launches, and internal events without relying on a patchwork of tools that do not talk to each other.</p>
      </td>
    </tr>`;

  const body = `
    ${personalizedOpener(recipient, 'corporate events and conferences')}
    ${sectionCap('Enterprise Capabilities')}
    ${featGrid([
      { t: 'Custom Subdomain per Event',  d: 'Every event lives at its own branded URL. Consistent, professional, and distinct from every other event.' },
      { t: 'Scales to Any Attendance',    d: 'PlanIt handles 50 or 5,000 attendees without configuration changes or per-head pricing surprises.' },
      { t: 'Full Audit Trail',            d: 'Complete check-in logs, message history, file access records, and poll results ready for compliance and reporting.' },
      { t: 'Enterprise Access Controls',  d: 'Super-admin visibility across all events. Role permissions for organisers, moderators, and read-only stakeholders.' },
      { t: 'Integrated Task Management',  d: 'Assign pre-event deliverables to internal teams with deadlines and status tracking. No separate project tool needed.' },
      { t: 'Expense Tracking',            d: 'Log and split event expenses against a budget. Export records for finance sign-off without additional software.' },
    ])}
    ${statsRow([
      { n: 'Real-time', l: 'Check-in Sync' },
      { n: 'Any Scale', l: 'No Per-Head Cost' },
      { n: 'Free',      l: 'To Start' },
    ])}
    ${idealFor(
      'Typical Enterprise Use Cases',
      'Annual general meetings, all-hands and town halls, product launches and press events, client conferences, trade show presence management, team off-sites and leadership retreats, onboarding cohort events, and compliance training sessions.',
      '#4F46E5',
      '#F5F4FF'
    )}
    ${darkStrip('No credit card required to start', 'Built for teams that cannot afford a bad event.', 'Enterprise and volume pricing available on request', '#A5B4FC', 'Request a Demo', '#4F46E5', url)}`;

  return emailShell(
    'Enterprise event infrastructure, without the enterprise cost',
    'PlanIt gives corporate teams the structure, auditability, and scale for professional events.',
    'For Corporate Teams',
    `color:rgba(167,163,247,0.85);border:1px solid rgba(99,85,240,0.4)`,
    headerRow,
    body,
    'Large-scale events have too many moving parts to manage with spreadsheets and email threads. PlanIt was built specifically to handle the complexity so your team can focus on what the event is actually for.',
    `You are receiving this because ${recipient.company || 'your company'} was identified as a potential PlanIt enterprise client.`
  );
}

function buildCommunity(ctaUrl, recipient = {}) {
  const url = ctaUrl || process.env.FRONTEND_URL || 'https://planitapp.onrender.com';

  const headerRow = `
    <tr>
      <td class="ep" style="padding:36px 40px 30px 40px;border-bottom:1px solid ${RULE};">
        <span style="display:inline-block;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#1E40AF;background:#EFF6FF;padding:5px 12px;border-radius:5px;margin-bottom:16px;font-family:${FONT};">For Community Groups</span>
        <h1 style="margin:0 0 12px 0;font-size:24px;font-weight:800;color:${DARK};letter-spacing:-0.5px;line-height:1.2;font-family:${FONT};">The people doing the most important work rarely have the largest budgets.</h1>
        <p style="margin:0;font-size:15px;color:${MUTED};line-height:1.65;font-family:${FONT};">PlanIt is free for community organisers, charities, and non-profits. Not free for fourteen days. Not free with a credit card on file. Free, because those running local events should not have to justify a tool cost to a volunteer committee.</p>
      </td>
    </tr>`;

  const body = `
    ${personalizedOpener(recipient, 'community events and activities')}
    ${sectionCap('What You Get at No Cost')}
    ${featGrid([
      { t: 'No Attendee Accounts',         d: 'Participants join with just a name. Nothing to sign up for, nothing to download. No barrier to entry for any age group.' },
      { t: 'QR Check-in Without Hardware', d: "Any volunteer's smartphone becomes a check-in scanner. Print QR codes or let attendees show them on screen." },
      { t: 'Group Communication',          d: 'Keep volunteers, committee members, and staff aligned with built-in messaging throughout planning and on the day.' },
      { t: 'Task and Rota Management',     d: 'Assign volunteering slots and pre-event responsibilities. Track completion without chasing people over WhatsApp.' },
      { t: 'Fundraising Tracking',         d: 'Log targets and contributions against your event budget. Useful for charity events and grant reporting requirements.' },
      { t: 'Unlimited Participants',       d: 'No cap on team size or attendee numbers. 2,000 visitors at a street festival costs the same as a book club of 15: nothing.' },
    ])}
    
    ${idealFor(
      'Who This Is For',
      'Neighbourhood associations, local charities, youth clubs and sports leagues, food banks and community kitchens, cultural and arts organisations, mutual aid groups, residents\' associations, awareness campaigns, and local government outreach events.',
      '#1D4ED8',
      '#EFF6FF'
    )}
    ${darkStrip('Always free for community use', 'Good tools should be accessible to good people.', 'No advertisements, no data selling, no upsell pressure', '#93C5FD', 'Get Started Free', '#1D4ED8', url)}`;

  return emailShell(
    'PlanIt is free for community organisers. Genuinely, no conditions',
    'Free event management for community groups, charities, and non-profits.',
    'For Community Groups',
    `color:rgba(147,197,253,0.85);border:1px solid rgba(29,78,216,0.4)`,
    headerRow,
    body,
    'Community organisers work harder than almost anyone, usually without recognition and rarely with adequate resources. PlanIt will always be free for community use. That is a personal commitment, not a marketing line.',
    'You are receiving this because your group was recommended as a potential PlanIt community user.'
  );
}

function buildWeddings(ctaUrl, recipient = {}) {
  const url = ctaUrl || process.env.FRONTEND_URL || 'https://planitapp.onrender.com';

  const headerRow = `
    <tr>
      <td class="ep" style="padding:36px 40px 30px 40px;border-bottom:1px solid ${RULE};">
        <span style="display:inline-block;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#86198F;background:#FDF4FF;padding:5px 12px;border-radius:5px;margin-bottom:16px;font-family:${FONT};">For Weddings and Special Occasions</span>
        <h1 style="margin:0 0 12px 0;font-size:24px;font-weight:800;color:${DARK};letter-spacing:-0.5px;line-height:1.2;font-family:${FONT};">One day. Every detail matters. Nothing should go wrong at the door.</h1>
        <p style="margin:0;font-size:15px;color:${MUTED};line-height:1.65;font-family:${FONT};">PlanIt is used by couples and wedding coordinators to manage the guest experience from personalised invitation through to seamless arrival and check-in. It handles the administration so the day can be exactly what you imagined.</p>
      </td>
    </tr>`;

  const body = `
    ${personalizedOpener(recipient, 'weddings and special occasions')}
    ${sectionCap('Guest Experience From Invitation to Arrival')}
    ${featGrid([
      { t: 'Individual Guest Invitations',  d: 'Each guest receives their own personal invite with a unique QR code, not a generic link forwarded around a group chat.' },
      { t: 'Seating and Table Management',  d: 'Assign guests to tables. Track RSVPs, dietary requirements, and plus-ones in one place, without a separate spreadsheet.' },
      { t: 'Dignified Check-in',            d: 'Guests show their QR code on arrival. No paper list, no names being called out, no queue forming at the entrance.' },
      { t: 'Planner and Vendor Access',     d: "Give your wedding planner, on-site coordinator, and venue manager the access they need without sharing a personal login." },
      { t: 'Post-Event Memory Sharing',     d: 'Share photographs, a video recording, and thank-you notes with all guests through the same event space after the day.' },
      { t: 'Multi-Language Guest Support',  d: 'Your guest list may span multiple countries. PlanIt works in any browser with no translation barriers for international attendees.' },
    ])}
    
    ${idealFor(
      'Occasions PlanIt Is Used For',
      `<strong style="color:#86198F;">Western weddings:</strong> ceremony, rehearsal dinner, reception, morning-after brunch<br/><br/><strong style="color:#86198F;">South Asian celebrations:</strong> sangeet, mehendi, haldi, baraat, shaadi, walima, and reception<br/><br/><strong style="color:#86198F;">Other milestone events:</strong> engagement parties, anniversary celebrations, milestone birthdays, naming ceremonies, graduation parties, and retirement dinners`,
      '#A21CAF',
      '#FDF4FF'
    )}
    ${darkStrip('No charge for personal occasions', 'One day. Done properly.', 'Use it for your celebration at no cost', '#E879F9', 'Get Started Free', '#A21CAF', url)}`;

  return emailShell(
    'For the events that have to be perfect',
    'PlanIt for weddings and special occasions, dignified check-in, personal invitations, seamless arrivals.',
    'For Special Occasions',
    `color:rgba(240,171,252,0.85);border:1px solid rgba(162,28,175,0.4)`,
    headerRow,
    body,
    'Special occasions deserve tools built with the same care that goes into the occasion itself. I hope PlanIt earns a small place in making your day exactly what you envisioned.',
    'You are receiving this because you expressed interest in event planning tools.'
  );
}

function buildPersonalized(ctaUrl, recipient = {}) {
  const url = ctaUrl || process.env.FRONTEND_URL || 'https://planitapp.onrender.com';

  const headerRow = `
    <tr>
      <td class="ep" style="padding:36px 40px 30px 40px;border-bottom:1px solid ${RULE};">
        <span style="display:inline-block;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#0F172A;background:#F1F5F9;padding:5px 12px;border-radius:5px;margin-bottom:16px;font-family:${FONT};">Built for What You Actually Run</span>
        <h1 style="margin:0 0 12px 0;font-size:24px;font-weight:800;color:${DARK};letter-spacing:-0.5px;line-height:1.2;font-family:${FONT};">Most event platforms were built for the people who built them, not for you.</h1>
        <p style="margin:0;font-size:15px;color:${MUTED};line-height:1.65;font-family:${FONT};">PlanIt started from a different place: watching real organisers work. The result is a platform shaped around how events actually run, not around a product roadmap designed to justify a subscription price.</p>
      </td>
    </tr>`;

  const body = `
    ${personalizedOpener(recipient, 'your events')}
    ${sectionCap('What Organisers Actually Told Us They Needed')
    }
    <p style="margin:0 0 20px 0;font-size:14px;color:${MID};line-height:1.8;font-family:${FONT};">We spoke to coordinators, venue managers, charity leads, university student unions, and wedding planners before writing a single line of PlanIt. These are the five things they said every time, in almost the same words.</p>
    ${featGrid([
      { t: 'Check-in that does not require a specialist', d: 'Any volunteer with a smartphone, no prior training, should be able to clear 200 guests in the first 20 minutes. PlanIt QR check-in is exactly that.' },
      { t: 'Guest communication without a third app',     d: 'Announcements, emergency updates, schedule changes. Pushed directly to every attendee, inside the event space, no download required.' },
      { t: 'A single source of truth for the team',      d: 'Chat, tasks, files, expenses, seating, and schedule in one place. Not six tools open in six browser tabs across three people.' },
      { t: 'Something that looks professional to clients', d: 'A branded event URL, clean guest invitation emails with QR codes, and a polished experience from first contact to check-in.' },
      { t: 'No per-attendee pricing surprises',           d: 'A 300-person event and an 800-person event should not cost different amounts to run. PlanIt does not charge per head.' },
      { t: 'Data that belongs to the organiser',          d: 'Guest lists, attendance records, message history. Yours. Not sold, not profiled, not used to train anything.' },
    ])}
    
    ${sectionCap('The Technical Reality')}
    <p style="margin:0 0 16px 0;font-size:14px;color:${MID};line-height:1.8;font-family:${FONT};">PlanIt runs on a distributed architecture with real-time socket communication, automated uptime monitoring, a mesh-networked fleet of services, and a 99.9% uptime SLA. It handles 50 or 5,000 attendees without configuration changes. The backend does the heavy lifting so the event team can focus on the event.</p>
    ${statsRow([
      { n: 'Real-time', l: 'Guest Tracking' },
      { n: 'Any Scale', l: 'No Caps' },
      { n: 'Free',      l: 'Always' },
    ])}
    ${darkStrip('No credit card. No trial period. No catch.', 'PlanIt is free because good tools should be accessible.', 'Upgrade plans available for high-volume organisations', '#94A3B8', 'Get Started Free', '#0F172A', url)}`;

  return emailShell(
    'The event platform built around how events actually run',
    'PlanIt is free, professional, and built around the real needs of event organisers.',
    'For Every Organiser',
    `color:rgba(148,163,184,0.85);border:1px solid rgba(15,23,42,0.25)`,
    headerRow,
    body,
    'Every feature in PlanIt exists because an organiser said they needed it. That philosophy does not change.',
    'You are receiving this because you were identified as someone who organises events professionally or regularly.'
  );
}


// ─── PlanIt Venue template ────────────────────────────────────────────────────

function buildVenue(ctaUrl, recipient = {}) {
  const url    = ctaUrl || process.env.FRONTEND_URL || 'https://planitapp.onrender.com';
  const ORANGE       = '#EA580C';
  const ORANGE_LIGHT = '#FFF7ED';
  const ORANGE_PALE  = '#FED7AA';

  const headerRow = `
    <tr>
      <td class="ep" style="padding:36px 40px 30px 40px;border-bottom:1px solid ${RULE};">
        <span style="display:inline-block;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${ORANGE};background:${ORANGE_LIGHT};padding:5px 12px;border-radius:5px;margin-bottom:16px;font-family:${FONT};">PlanIt Venue</span>
        <h1 style="margin:0 0 12px 0;font-size:24px;font-weight:800;color:${DARK};letter-spacing:-0.5px;line-height:1.2;font-family:${FONT};">Your floor runs on instinct. Give your team a tool that keeps up.</h1>
        <p style="margin:0;font-size:15px;color:${MUTED};line-height:1.65;font-family:${FONT};">PlanIt Venue is a free real-time floor management platform for restaurants and hospitality venues. Your whole front-of-house team sees the same live floor map on their phones. No app to install, no hardware to buy.</p>
      </td>
    </tr>`;

  const body = `
    ${personalizedOpener(recipient, 'your restaurant floor')}
    ${sectionCap('What PlanIt Venue Does')}
    ${featGrid([
      { t: 'Live Floor Map',              d: 'Every table shows its current status - available, occupied, reserved, or being cleaned - updated in real time across every device.' },
      { t: 'Guest Signals at the Table',  d: 'Guests scan a QR code at their table to flag ready to order, need water, want the bill, or need assistance. It shows instantly on your floor map.' },
      { t: 'Waitlist Management',         d: 'Add walk-ins to a digital waitlist. Seat them with one tap when a table clears. No paper list, no shouting across the floor.' },
      { t: 'QR Reservations at the Door', d: 'Guests scan a QR code at your entrance to make or check in to a reservation. Your host sees it immediately on the floor view.' },
      { t: 'Drag-and-Drop Floor Editor',  d: 'Build your floor plan once. Drag tables into position, label them, and save. Change it any time without calling support.' },
      { t: 'No Hardware, No App',         d: 'Every device your team already owns becomes a floor management terminal. Works on any smartphone browser.' },
    ])}
    ${idealFor('Who This Is For',
      'Independent casual dining restaurants, cafes and brunch spots, bars and cocktail lounges, hotel restaurants, event caterers managing seated dinners, and any hospitality venue where table turnover and guest satisfaction matter.',
      ORANGE, ORANGE_LIGHT)}
    ${hrule()}
    <p style="margin:24px 0 16px 0;font-size:14px;color:${MID};line-height:1.75;font-family:${FONT};">PlanIt Venue is completely free to use. You can set up your floor plan and have your team running it on the same day. No subscription, no per-table fees, no contract.</p>
    ${darkStrip('Free for restaurants and hospitality venues', 'Your floor, always under control.', 'Set up in under 30 minutes, free forever', ORANGE_PALE, 'Set Up Your Venue Free', ORANGE, url)}`;

  return emailShell(
    'Free floor management for your restaurant',
    'PlanIt Venue - live floor map, table signals, waitlist, and QR reservations. Free for restaurants.',
    'PlanIt Venue',
    `color:rgba(253,186,116,0.9);border:1px solid rgba(234,88,12,0.45)`,
    headerRow,
    body,
    'Running a floor well is one of the hardest jobs in hospitality. I built PlanIt Venue to make the information side of it invisible so your team can focus on the guests. It is free because it should be.',
    `You are receiving this because ${recipient.company ? h(recipient.company) + ' was identified' : 'your venue was identified'} as a potential PlanIt Venue user.`
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
    defaultSubject: 'PlanIt is free for community organisers. Genuinely, no conditions',
    build: buildCommunity,
  },
  weddings: {
    id: 'weddings',
    name: 'Weddings and Special Occasions',
    description: 'For couples, wedding planners, and milestone events.',
    defaultSubject: 'For the events that have to be perfect',
    build: buildWeddings,
  },
  personalized: {
    id: 'personalized',
    name: 'Universal Outreach - Personalized',
    description: 'Direct, persuasive outreach for any event organiser. Built around real organiser feedback. Highest conversion messaging.',
    defaultSubject: 'The event platform built around how events actually run',
    build: buildPersonalized,
  },
  venue: {
    id: 'venue',
    name: 'PlanIt Venue - Restaurants and Hospitality',
    description: 'For independent restaurants, cafes, bars, and hospitality venues. Covers live floor map, table signals, waitlist, and QR reservations.',
    defaultSubject: 'Free floor management for your restaurant',
    build: buildVenue,
  },
};

// ─── Public API ───────────────────────────────────────────────────────────────

function listTemplates() {
  return Object.values(TEMPLATES).map(({ id, name, description, defaultSubject }) =>
    ({ id, name, description, defaultSubject })
  );
}

function previewTemplate(templateId, ctaUrl, recipient) {
  const tpl = TEMPLATES[templateId];
  if (!tpl) return null;
  return tpl.build(ctaUrl || process.env.FRONTEND_URL || 'https://planitapp.onrender.com', recipient || {});
}

/**
 * sendCampaign({ templateId, recipients, subject, ctaUrl })
 * recipients: Array of { email, name?, company?, role?, website? } OR plain email strings
 * Returns: { sent, skipped, failed, total }
 */
async function sendCampaign({ templateId, recipients, subject, ctaUrl }) {
  const tpl = TEMPLATES[templateId];
  if (!tpl) throw new Error(`Unknown template: ${templateId}`);

  const routerUrl = process.env.ROUTER_URL;
  if (!routerUrl) throw new Error('ROUTER_URL not set');

  const resolvedCtaUrl = ctaUrl || process.env.FRONTEND_URL || 'https://planitapp.onrender.com';
  const finalSubj      = subject || tpl.defaultSubject;

  const results = { sent: 0, skipped: 0, failed: 0, total: recipients.length };

  for (let i = 0; i < recipients.length; i++) {
    // Normalise recipient - accept plain string or object
    const raw = recipients[i];
    const recipient = typeof raw === 'string'
      ? { email: raw.trim().toLowerCase(), name: '', company: '', role: '' }
      : { email: (raw.email || '').trim().toLowerCase(), name: raw.name || '', company: raw.company || '', role: raw.role || '', website: raw.website || '' };

    const to = recipient.email;

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

    // Build a personalised HTML email for this recipient
    const html = tpl.build(resolvedCtaUrl, recipient);

    // Personalise subject line with first name if we have it
    const fn = recipient.name ? recipient.name.trim().split(/\s+/)[0] : '';
    const personalSubj = fn
      ? finalSubj.replace(/^(Hi|Hello)?/i, '').trim() // subject stays clean
      : finalSubj;

    const r = await meshPost(
      CALLER,
      `${routerUrl}/mesh/email`,
      { to, subject: personalSubj, html },
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

// ─── Scheduled campaign runner ────────────────────────────────────────────────
// Call this from a cron job or setInterval to dispatch due campaigns.

async function runScheduled() {
  let dispatched = 0;
  try {
    const listRaw = await redis.get('mktschedlist').catch(() => null);
    if (!listRaw) return dispatched;
    const ids  = JSON.parse(listRaw);
    const now  = Date.now();
    const keep = [];

    for (const id of ids) {
      const raw = await redis.get(id).catch(() => null);
      if (!raw) continue;
      const job = JSON.parse(raw);
      if (job.status !== 'pending' || new Date(job.sendAt).getTime() > now) {
        keep.push(id);
        continue;
      }
      job.status = 'running';
      await redis.set(id, JSON.stringify(job), 3600).catch(() => {});
      console.log(`[marketing] Running scheduled campaign ${id} (${job.recipients.length} recipients)`);
      try {
        const results = await sendCampaign({ templateId: job.templateId, recipients: job.recipients, subject: job.subject || undefined, ctaUrl: job.ctaUrl || undefined });
        job.status    = 'done';
        job.results   = results;
        job.finishedAt = new Date().toISOString();
        await redis.set(id, JSON.stringify(job), 86400).catch(() => {});
        dispatched++;
        console.log(`[marketing] Scheduled campaign ${id} done: sent=${results.sent} skipped=${results.skipped} failed=${results.failed}`);
      } catch (err) {
        job.status = 'error';
        job.error  = err.message;
        await redis.set(id, JSON.stringify(job), 86400).catch(() => {});
        console.error(`[marketing] Scheduled campaign ${id} error:`, err.message);
        keep.push(id);
      }
    }

    await redis.set('mktschedlist', JSON.stringify(keep), 7 * 86400).catch(() => {});
  } catch (err) {
    console.error('[marketing] runScheduled error:', err.message);
  }
  return dispatched;
}

// Boot the scheduler - checks every 60 seconds
if (process.env.MARKETING_SCHEDULER !== 'off') {
  setInterval(runScheduled, 60000);
  runScheduled().catch(() => {});
}

module.exports = { listTemplates, previewTemplate, sendCampaign, runScheduled };