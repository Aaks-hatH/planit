'use strict';

/*
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  PlanIt  ·  Centralized Alerting Service  ·  router/services/alerting  ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * THREE alert channels, all configured via router env vars only:
 *
 *   DISCORD_WEBHOOK_URL   — Rich embedded Discord notification (team channel)
 *   NTFY_URL              — Push to phone via ntfy.sh or self-hosted ntfy
 *   NTFY_TOKEN            — Optional bearer token if your ntfy topic is private
 *   SLACK_WEBHOOK_URL     — Block Kit Slack notification (enterprise workspace)
 *
 * Fires for:
 *   • Bug reports submitted via POST /api/bug-reports
 *   • Status page user reports via POST /api/uptime/report
 *   • Incidents created/updated via /api/uptime/admin/incidents
 *
 * Anti-spam:
 *   • Per-key deduplication window — identical events are collapsed
 *   • Threshold alerts (many users reporting same service) have a 1h cooldown
 *   • Auto-detect probe failures have a 5min cooldown
 *   • Bug reports deduplicated by report ID — never fires twice for same report
 *
 * All three channels fire in parallel (Promise.allSettled) — one channel
 * failing never blocks the others.
 */

// ─── Severity mappings ────────────────────────────────────────────────────────

const SEVERITY_COLOR = {
  critical:    0xEF4444,  // red
  high:        0xF97316,  // orange
  medium:      0xEAB308,  // yellow
  low:         0x3B82F6,  // blue
  info:        0x6366F1,  // indigo (used for maintenance / resolved)
  resolved:    0x22C55E,  // green
};

const SEVERITY_EMOJI = {
  critical: '🔴',
  high:     '🟠',
  medium:   '🟡',
  low:      '🔵',
  info:     'ℹ️',
  resolved: '✅',
};

const NTFY_PRIORITY = {
  critical: 'urgent',
  high:     'high',
  medium:   'default',
  low:      'low',
  info:     'min',
  resolved: 'default',
};

// ─── Deduplication ────────────────────────────────────────────────────────────

const _dedupMap = new Map();      // dedupKey → timestamp last fired

function _isDuplicate(key, windowMs) {
  const now  = Date.now();
  const last = _dedupMap.get(key);
  if (last && (now - last) < windowMs) return true;
  _dedupMap.set(key, now);
  return false;
}

// Clean stale entries every 15 minutes so the Map never grows unbounded
setInterval(() => {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000; // 2 h
  for (const [k, v] of _dedupMap) {
    if (v < cutoff) _dedupMap.delete(k);
  }
}, 15 * 60 * 1000).unref?.();

// ─── Discord ──────────────────────────────────────────────────────────────────

async function _sendDiscord(payload) {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return;
  try {
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
      signal:  AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[alert:discord] HTTP ${res.status} — ${body.slice(0, 200)}`);
    }
  } catch (err) {
    console.error('[alert:discord] Error:', err.message);
  }
}

// ─── ntfy ─────────────────────────────────────────────────────────────────────

async function _sendNtfy({ title, body, priority, tags, actions }) {
  const rawUrl = process.env.NTFY_URL;
  if (!rawUrl) return;

  const endpoint = rawUrl.startsWith('http') ? rawUrl : `https://ntfy.sh/${rawUrl}`;
  const headers  = {
    // ntfy supports percent-encoded UTF-8 in the Title header.
    // Raw emoji exceed the Latin-1 ByteString limit (max 255) and crash fetch().
    'Title':        encodeURIComponent(String(title).slice(0, 150)),
    'Priority':     priority || 'default',
    'Tags':         Array.isArray(tags) ? tags.join(',') : (tags || ''),
    'Content-Type': 'text/plain',
  };
  if (actions)                   headers['Actions']       = actions;
  if (process.env.NTFY_TOKEN)    headers['Authorization'] = `Bearer ${process.env.NTFY_TOKEN}`;

  try {
    const res = await fetch(endpoint, {
      method:  'POST',
      headers,
      body:    String(body).slice(0, 1000),
      signal:  AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`[alert:ntfy] HTTP ${res.status} — ${text.slice(0, 200)}`);
    }
  } catch (err) {
    console.error('[alert:ntfy] Error:', err.message);
  }
}

// ─── Slack ────────────────────────────────────────────────────────────────────

async function _sendSlack(payload) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return;
  try {
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
      signal:  AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`[alert:slack] HTTP ${res.status} — ${text.slice(0, 200)}`);
    }
  } catch (err) {
    console.error('[alert:slack] Error:', err.message);
  }
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

const APP_ICON_URL  = 'https://planitapp.onrender.com/favicon.ico';
const BRAND_NAME    = 'PlanIt';

function _ts() {
  return new Date().toISOString();
}

function _adminUrl() {
  const fe = (process.env.FRONTEND_URL || '').split(',')[0].trim().replace(/\/$/, '');
  return fe ? `${fe}/admin` : null;
}

function _statusUrl() {
  const fe = (process.env.FRONTEND_URL || '').split(',')[0].trim().replace(/\/$/, '');
  return fe ? `${fe}/status` : null;
}

// Safe HTML escape for ntfy body text (not needed for ntfy but used in logs)
function _esc(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── Bug Report Alert ─────────────────────────────────────────────────────────
//
// Called when a user submits a new bug report via POST /api/bug-reports.
// payload: { _id, name, email, category, summary, description, eventLink, browser, severity, ip }

async function alertBugReport(report) {
  // Deduplicate by report ID — never fires twice for the same submission
  const dedupKey = `bug:${report._id || `${report.email}:${report.summary?.slice(0, 40)}`}`;
  if (_isDuplicate(dedupKey, 10 * 60 * 1000)) {
    console.log(`[alert] Bug report deduped — ${dedupKey}`);
    return;
  }

  const severity = report.severity || 'medium';
  const emoji    = SEVERITY_EMOJI[severity] || '🔵';
  const color    = SEVERITY_COLOR[severity]  || SEVERITY_COLOR.medium;
  const adminUrl = _adminUrl();
  const statusUrl = _statusUrl();

  const categoryLabel = {
    bug:     'Bug',
    error:   'Error',
    feature: 'Feature Request',
    account: 'Account Issue',
    checkin: 'Check-in Issue',
    other:   'Other',
  }[report.category] || (report.category || 'Unknown');

  // ── Discord embed ─────────────────────────────────────────────────────────

  const discordFields = [
    { name: '⚡ Severity',  value: `\`${severity.toUpperCase()}\``,  inline: true  },
    { name: '🏷️ Category',  value: categoryLabel,                    inline: true  },
    { name: '📋 Status',    value: '`OPEN`',                         inline: true  },
    { name: '👤 Reporter',  value: `${report.name || 'Anonymous'}\n${report.email}`, inline: false },
    { name: '📝 Summary',   value: report.summary || '—',            inline: false },
    { name: '🔍 Description', value: (report.description || '—').slice(0, 400), inline: false },
  ];
  if (report.browser)    discordFields.push({ name: '🌐 Browser',    value: report.browser,    inline: true });
  if (report.eventLink)  discordFields.push({ name: '🔗 Event Link', value: report.eventLink,  inline: false });
  if (report.ip)         discordFields.push({ name: '🖥️ IP',         value: `\`${report.ip}\``, inline: true });

  await _sendDiscord({
    username:   `${BRAND_NAME} Alerts`,
    avatar_url: APP_ICON_URL,
    // Discord only fires a push notification when `content` is present;
    // embed-only messages render in the channel but are silent on mobile.
    content:    `${emoji} **[${severity.toUpperCase()}] Bug Report** — ${(report.summary || '').slice(0, 100)}`,
    embeds: [{
      title:     `${emoji} Bug Report — ${(report.summary || '').slice(0, 100)}`,
      color,
      fields:    discordFields,
      footer:    { text: `${BRAND_NAME}  ·  Bug Reports  ·  ID: ${report._id || 'N/A'}` },
      timestamp: _ts(),
    }],
  });

  // ── ntfy push ─────────────────────────────────────────────────────────────

  const ntfyBody = [
    `From: ${report.name || 'Anonymous'} <${report.email}>`,
    `Category: ${categoryLabel}`,
    `Severity: ${severity}`,
    report.browser   ? `Browser: ${report.browser}`   : null,
    report.eventLink ? `Event: ${report.eventLink}`   : null,
    '',
    (report.description || '').slice(0, 400),
  ].filter(v => v !== null).join('\n');

  await _sendNtfy({
    title:    `${emoji} [${severity.toUpperCase()}] ${(report.summary || '').slice(0, 100)}`,
    body:     ntfyBody,
    priority: NTFY_PRIORITY[severity] || 'default',
    tags:     `bug,${report.category || 'bug'}`,
    actions:  adminUrl ? `view, Open Admin, ${adminUrl}` : undefined,
  });

  // ── Slack Block Kit ───────────────────────────────────────────────────────

  const slackBlocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `${emoji} Bug Report — ${severity.toUpperCase()}`, emoji: true },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*${(report.summary || '').slice(0, 150)}*` },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Category:*\n${categoryLabel}` },
        { type: 'mrkdwn', text: `*Reporter:*\n${report.name || 'Anonymous'} · ${report.email}` },
        ...(report.browser ? [{ type: 'mrkdwn', text: `*Browser:*\n${report.browser}` }] : []),
        ...(report.ip      ? [{ type: 'mrkdwn', text: `*IP:*\n\`${report.ip}\`` }]       : []),
      ],
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: `*Description:*\n${(report.description || '—').slice(0, 300)}` },
    },
  ];

  if (adminUrl) {
    slackBlocks.push({
      type: 'actions',
      elements: [{
        type:  'button',
        text:  { type: 'plain_text', text: '🛠 Open Admin Panel', emoji: true },
        url:   adminUrl,
        style: 'primary',
      }],
    });
  }

  slackBlocks.push({
    type: 'divider',
  }, {
    type: 'context',
    elements: [{
      type: 'mrkdwn',
      text: `*${BRAND_NAME}*  ·  Bug Reports  ·  ID: \`${report._id || 'N/A'}\`  ·  ${new Date().toUTCString()}`,
    }],
  });

  await _sendSlack({
    username:    `${BRAND_NAME} Alerts`,
    icon_emoji:  ':bug:',
    blocks:      slackBlocks,
  });

  console.log(`[alert] Bug report alerts dispatched — ${report.email} — severity: ${severity}`);
}

// ─── Status Page Report Alert ─────────────────────────────────────────────────
//
// Called from the uptime route for:
//   • Individual user reports  (type: 'report')
//   • Threshold breaches       (type: 'threshold')  — 10+ unique reporters/hr
//   • Auto-detect probe fails  (type: 'auto')
//
// payload: { report: { description, email, affectedService }, count, service, type }

async function alertStatusReport({ report, count, service, type }) {
  const isAuto      = type === 'auto';
  const isThreshold = type === 'threshold';

  const severity = isAuto ? 'critical' : isThreshold ? 'high' : 'medium';
  const emoji    = SEVERITY_EMOJI[severity];
  const color    = SEVERITY_COLOR[severity];
  const adminUrl = _adminUrl();
  const statusUrl = _statusUrl();

  let title, ntfyTags;
  if (isAuto) {
    title    = `AUTO-DETECT: Service unreachable — ${service}`;
    ntfyTags = 'rotating_light,warning';
  } else if (isThreshold) {
    title    = `${count} users reporting issues — ${service}`;
    ntfyTags = 'warning,bar_chart';
  } else {
    title    = `Status Report #${count} — ${service}`;
    ntfyTags = 'bar_chart';
  }

  // Different dedup windows per type
  const dedupWindow = isThreshold ? 60 * 60 * 1000 : isAuto ? 5 * 60 * 1000 : 2 * 60 * 1000;
  const dedupKey    = `status:${service}:${type}`;
  if (_isDuplicate(dedupKey, dedupWindow)) {
    console.log(`[alert] Status report deduped — ${dedupKey}`);
    return;
  }

  const description = (report?.description || '').slice(0, 400);
  const reporter    = report?.email || '';

  // ── Discord embed ─────────────────────────────────────────────────────────

  const discordFields = [
    { name: '🔧 Service',           value: `\`${service}\``, inline: true  },
    { name: '👥 Unique Reporters',  value: String(count),    inline: true  },
    { name: '📡 Alert Type',        value: isAuto ? 'Auto-Detect Probe' : isThreshold ? 'Threshold Breach' : 'User Report', inline: true },
    { name: '📝 Description',       value: description || '—', inline: false },
  ];
  if (reporter) discordFields.push({ name: '📧 Reporter', value: reporter, inline: true });

  await _sendDiscord({
    username:   `${BRAND_NAME} Alerts`,
    avatar_url: APP_ICON_URL,
    content:    `${emoji} **${title.slice(0, 130)}**`,
    embeds: [{
      title:     `${emoji} ${title}`,
      color,
      fields:    discordFields,
      footer:    { text: `${BRAND_NAME}  ·  Status Page` },
      timestamp: _ts(),
    }],
  });

  // ── ntfy push ─────────────────────────────────────────────────────────────

  const ntfyBody = [
    `Service: ${service}`,
    `Unique reporters this hour: ${count}`,
    '',
    description,
    reporter ? `\nReporter: ${reporter}` : '',
  ].join('\n').trim();

  const ntfyActions = [];
  if (statusUrl) ntfyActions.push(`view, Status Page, ${statusUrl}`);
  if (adminUrl)  ntfyActions.push(`view, Admin, ${adminUrl}`);

  await _sendNtfy({
    title:    `${emoji} ${title.slice(0, 130)}`,
    body:     ntfyBody,
    priority: NTFY_PRIORITY[severity],
    tags:     ntfyTags,
    actions:  ntfyActions.length ? ntfyActions.join('; ') : undefined,
  });

  // ── Slack Block Kit ───────────────────────────────────────────────────────

  const slackBlocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `${emoji} ${title.slice(0, 150)}`, emoji: true },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Service:*\n\`${service}\`` },
        { type: 'mrkdwn', text: `*Unique Reporters:*\n${count}` },
        { type: 'mrkdwn', text: `*Alert Type:*\n${isAuto ? '🤖 Auto-Detect' : isThreshold ? '⚠️ Threshold Breach' : '👤 User Report'}` },
      ],
    },
    ...(description ? [{
      type: 'section',
      text: { type: 'mrkdwn', text: `*Details:*\n${description.slice(0, 300)}` },
    }] : []),
  ];

  const slackActions = [];
  if (statusUrl) slackActions.push({ type: 'button', text: { type: 'plain_text', text: '📊 Status Page', emoji: true }, url: statusUrl, style: 'danger' });
  if (adminUrl)  slackActions.push({ type: 'button', text: { type: 'plain_text', text: '🛠 Admin Panel',  emoji: true }, url: adminUrl  });
  if (slackActions.length) slackBlocks.push({ type: 'actions', elements: slackActions });

  slackBlocks.push({ type: 'divider' }, {
    type: 'context',
    elements: [{ type: 'mrkdwn', text: `*${BRAND_NAME}*  ·  Status Page  ·  ${new Date().toUTCString()}` }],
  });

  await _sendSlack({
    username:   `${BRAND_NAME} Alerts`,
    icon_emoji: isAuto ? ':rotating_light:' : isThreshold ? ':warning:' : ':bar_chart:',
    blocks:     slackBlocks,
  });

  console.log(`[alert] Status report alerts dispatched — ${service} — type: ${type}`);
}

// ─── Incident Alert ───────────────────────────────────────────────────────────
//
// Called when an admin creates an incident or adds a timeline update.
//
// For creation:   alertIncident({ incident, type: 'created' })
// For updates:    alertIncident({ incident, update: { status, message }, type: 'update' })

async function alertIncident({ incident, update, type = 'created' }) {
  const isResolved  = type === 'update' && update?.status === 'resolved';
  const isCreated   = type === 'created';

  const severityColorMap = {
    critical:    SEVERITY_COLOR.critical,
    major:       SEVERITY_COLOR.high,
    minor:       SEVERITY_COLOR.medium,
    maintenance: 0x6366F1,
  };

  const severity = incident.severity || 'minor';
  const color    = isResolved ? SEVERITY_COLOR.resolved : (severityColorMap[severity] || SEVERITY_COLOR.medium);
  const adminUrl = _adminUrl();
  const statusUrl = _statusUrl();

  let emoji, titlePrefix, ntfyTags;
  if (isCreated) {
    emoji       = '🚨';
    titlePrefix = 'Incident Created';
    ntfyTags    = 'rotating_light,memo';
  } else if (isResolved) {
    emoji       = '✅';
    titlePrefix = 'Incident Resolved';
    ntfyTags    = 'white_check_mark';
  } else {
    emoji       = '📋';
    titlePrefix = `Incident ${(update?.status || 'Updated').toUpperCase()}`;
    ntfyTags    = 'memo';
  }

  const fullTitle = `${titlePrefix}: ${incident.title}`;

  const dedupKey    = `incident:${incident._id}:${type}:${update?.status || ''}`;
  const dedupWindow = 2 * 60 * 1000;
  if (_isDuplicate(dedupKey, dedupWindow)) {
    console.log(`[alert] Incident alert deduped — ${dedupKey}`);
    return;
  }

  const services = (incident.affectedServices || []).join(', ') || 'General';
  const message  = (update?.message || incident.description || '').slice(0, 400);

  // ── Discord embed ─────────────────────────────────────────────────────────

  const discordFields = [
    { name: '⚡ Severity',          value: `\`${severity.toUpperCase()}\``, inline: true  },
    { name: '📡 Status',            value: `\`${(update?.status || incident.status || 'investigating').toUpperCase()}\``, inline: true },
    { name: '🔧 Affected Services', value: services, inline: false },
    ...(message ? [{ name: isCreated ? '📝 Initial Message' : '🔄 Update', value: message, inline: false }] : []),
    ...(isResolved && incident.downtimeMinutes ? [{ name: '⏱ Downtime', value: `${incident.downtimeMinutes} minutes`, inline: true }] : []),
  ];

  await _sendDiscord({
    username:   `${BRAND_NAME} Alerts`,
    avatar_url: APP_ICON_URL,
    content:    `${emoji} **${fullTitle.slice(0, 150)}**`,
    embeds: [{
      title:     `${emoji} ${fullTitle}`,
      color,
      fields:    discordFields,
      footer:    { text: `${BRAND_NAME}  ·  Incident Management  ·  ID: ${incident._id || 'N/A'}` },
      timestamp: _ts(),
    }],
  });

  // ── ntfy push ─────────────────────────────────────────────────────────────

  const ntfyBody = [
    `Severity: ${severity}`,
    `Affected: ${services}`,
    message ? `\n${message}` : '',
    isResolved && incident.downtimeMinutes ? `\nTotal downtime: ${incident.downtimeMinutes} min` : '',
  ].join('\n').trim();

  const ntfyActions = [];
  if (statusUrl) ntfyActions.push(`view, Status Page, ${statusUrl}`);
  if (adminUrl)  ntfyActions.push(`view, Admin, ${adminUrl}`);

  await _sendNtfy({
    title:    `${emoji} ${fullTitle.slice(0, 130)}`,
    body:     ntfyBody,
    priority: isCreated
      ? (severity === 'critical' ? 'urgent' : severity === 'major' ? 'high' : 'default')
      : (isResolved ? 'default' : 'high'),
    tags:    ntfyTags,
    actions: ntfyActions.length ? ntfyActions.join('; ') : undefined,
  });

  // ── Slack Block Kit ───────────────────────────────────────────────────────

  const slackFields = [
    { type: 'mrkdwn', text: `*Severity:*\n\`${severity.toUpperCase()}\`` },
    { type: 'mrkdwn', text: `*Affected Services:*\n${services}` },
  ];
  if (isResolved && incident.downtimeMinutes) {
    slackFields.push({ type: 'mrkdwn', text: `*Total Downtime:*\n${incident.downtimeMinutes} min` });
  }

  const slackBlocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `${emoji} ${fullTitle.slice(0, 150)}`, emoji: true },
    },
    { type: 'section', fields: slackFields },
    ...(message ? [{
      type: 'section',
      text: { type: 'mrkdwn', text: `*${isCreated ? 'Initial Message' : 'Update'}:*\n${message.slice(0, 300)}` },
    }] : []),
  ];

  const slackActions = [];
  if (statusUrl) slackActions.push({ type: 'button', text: { type: 'plain_text', text: '📊 Status Page', emoji: true }, url: statusUrl, style: isResolved ? 'primary' : 'danger' });
  if (adminUrl)  slackActions.push({ type: 'button', text: { type: 'plain_text', text: '🛠 Admin Panel',  emoji: true }, url: adminUrl });
  if (slackActions.length) slackBlocks.push({ type: 'actions', elements: slackActions });

  slackBlocks.push({ type: 'divider' }, {
    type: 'context',
    elements: [{ type: 'mrkdwn', text: `*${BRAND_NAME}*  ·  Incident Management  ·  ID: \`${incident._id || 'N/A'}\`  ·  ${new Date().toUTCString()}` }],
  });

  await _sendSlack({
    username:   `${BRAND_NAME} Alerts`,
    icon_emoji: isResolved ? ':white_check_mark:' : isCreated ? ':rotating_light:' : ':memo:',
    blocks:     slackBlocks,
  });

  console.log(`[alert] Incident alerts dispatched — ${fullTitle}`);
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = { alertBugReport, alertStatusReport, alertIncident };