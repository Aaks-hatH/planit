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
 *
 * QUICK-ACCESS LINKS
 *   Bug report alerts include a signed 30-minute link that auto-authenticates
 *   you into a read-only view of that specific report, no login required.
 *   The link points to the backend quick-access endpoint which validates the
 *   HMAC token and redirects to the frontend with a short-lived read-only JWT.
 *   Write actions (status changes, notes) require full admin login.
 *   Requires MESH_SECRET to be set on both router and backend.
 *   Requires BACKEND_URLS to be set on the router (uses the first URL).
 */

const crypto = require('crypto');

// ─── Severity mappings ────────────────────────────────────────────────────────

const SEVERITY_COLOR = {
  // Black/white PlanIt brand theme — severity shown via emoji + text, not color alone.
  // Discord embed color is the left sidebar strip.
  critical:    0x000000,  // pure black — maximum urgency
  high:        0x1A1A1A,  // near-black
  medium:      0x3D3D3D,  // dark grey
  low:         0x6B6B6B,  // mid grey
  info:        0x9B9B9B,  // light grey
  resolved:    0xFFFFFF,  // white — it's over
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

// Discord user to mention on every alert — set this to your Discord user ID
const DISCORD_ALERT_USER = '1168575437723680850';

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

// ─── Quick-access token ───────────────────────────────────────────────────────
// Generates a short-lived HMAC-signed token embedded in alert links.
// The backend validates the token at GET /api/bug-reports/admin/quick-access
// and issues a read-only JWT — no full login required for 30 minutes.
//
// Format (base64url): {reportId}:{expUnixSec}:{hmac32hex}
// Secret: MESH_SECRET (already shared between router and backend)
// TTL: 30 minutes

function _generateQuickToken(reportId) {
  const secret = process.env.MESH_SECRET;
  if (!secret || !reportId) return null;
  const exp     = Math.floor(Date.now() / 1000) + 30 * 60;
  const payload = `${reportId}:${exp}`;
  const sig     = crypto.createHmac('sha256', secret).update(payload).digest('hex').slice(0, 32);
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}

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
// Uses the ntfy JSON publishing API so emoji are fully supported in the title
// and body — no HTTP header encoding restrictions.
//
// The JSON API requires posting to the SERVER ROOT with "topic" in the body:
//   POST https://ntfy.sh
//   { "topic": "mytopic", "title": "...", "message": "...", ... }
//
// Posting JSON to the topic URL (https://ntfy.sh/mytopic) makes ntfy treat
// the whole JSON blob as raw message text — that's the bug this fixes.
//
// NTFY_URL formats accepted:
//   "my-topic"                       → server=https://ntfy.sh  topic=my-topic
//   "https://ntfy.sh/my-topic"       → server=https://ntfy.sh  topic=my-topic
//   "https://self.example.com/topic" → server=https://self.example.com  topic=topic

function _parseNtfyUrl(rawUrl) {
  if (!rawUrl) return null;
  if (!rawUrl.startsWith('http')) {
    // Plain topic name — use ntfy.sh as the server
    const topic = rawUrl.replace(/\/$/, '');
    return { serverUrl: 'https://ntfy.sh', topic };
  }
  try {
    const u     = new URL(rawUrl);
    const topic = u.pathname.replace(/^\//, '').replace(/\/$/, '');
    if (!topic) {
      console.error('[alert:ntfy] NTFY_URL has no topic path — e.g. https://ntfy.sh/my-topic');
      return null;
    }
    return { serverUrl: u.origin, topic };
  } catch {
    console.error('[alert:ntfy] NTFY_URL is not a valid URL:', rawUrl);
    return null;
  }
}

async function _sendNtfy({ title, body, priority, tags, actions, iconUrl, clickUrl }) {
  const parsed = _parseNtfyUrl(process.env.NTFY_URL);
  if (!parsed) return;

  const { serverUrl, topic } = parsed;

  // Build the JSON payload.
  // POST to the SERVER ROOT with "topic" in the body — this is the correct
  // ntfy JSON API. Posting to the topic URL causes ntfy to display the raw
  // JSON blob as the notification message instead of parsing the fields.
  const ntfyPayload = {
    topic,
    title,
    message:  String(body).slice(0, 4096),
    priority: priority || 'default',
  };

  if (tags)     ntfyPayload.tags  = Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim());
  if (iconUrl)  ntfyPayload.icon  = iconUrl;
  // click makes the whole notification tappable — opens this URL when tapped
  if (clickUrl) ntfyPayload.click = clickUrl;

  // Parse "view, Label, URL; view, Label2, URL2" → action button objects
  if (actions) {
    const actionList = actions.split(';').map(a => {
      const [type, label, url] = a.split(',').map(s => s.trim());
      return { action: type || 'view', label: label || 'Open', url: url || '' };
    }).filter(a => a.url);
    if (actionList.length) ntfyPayload.actions = actionList;
  }

  const headers = { 'Content-Type': 'application/json' };
  if (process.env.NTFY_TOKEN) headers['Authorization'] = `Bearer ${process.env.NTFY_TOKEN}`;

  try {
    const res = await fetch(serverUrl, {
      method:  'POST',
      headers,
      body:    JSON.stringify(ntfyPayload),
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

// PlanIt branding — black/white theme
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

// Returns the first backend API base URL from BACKEND_URLS.
// Used to build the quick-access link — the link goes to the backend endpoint
// which validates the HMAC token then redirects to the frontend with a JWT.
function _backendUrl() {
  const be = (process.env.BACKEND_URLS || '').split(',')[0].trim().replace(/\/$/, '');
  return be || null;
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

  // Build a signed 30-min quick-access link.
  // The link points to the BACKEND quick-access endpoint, which validates the
  // HMAC token and 302-redirects to the frontend admin panel with a read-only
  // JWT in the URL. This is the correct flow — the frontend URL alone cannot
  // exchange the HMAC token; only the backend endpoint can.
  const quickToken = _generateQuickToken(report._id);
  const backendUrl = _backendUrl();
  const reportUrl  = quickToken && backendUrl
    ? `${backendUrl}/api/bug-reports/admin/quick-access?token=${encodeURIComponent(quickToken)}&report=${encodeURIComponent(report._id)}`
    : adminUrl;

  const categoryLabel = {
    bug:     'Bug',
    error:   'Error',
    feature: 'Feature Request',
    account: 'Account Issue',
    checkin: 'Check-in Issue',
    other:   'Other',
  }[report.category] || (report.category || 'Unknown');

  // ── Discord ────────────────────────────────────────────────────────────────
  // Regular incoming webhooks do NOT support `components` (link buttons) —
  // they are silently dropped. Use markdown hyperlinks in embed fields instead.

  const isCritical = severity === 'critical' || severity === 'high';

  const discordFields = [
    { name: 'Severity',    value: `\`${severity.toUpperCase()}\``, inline: true  },
    { name: 'Category',    value: categoryLabel,                     inline: true  },
    { name: 'Status',      value: '`OPEN`',                          inline: true  },
    { name: 'Reporter',    value: `${report.name || 'Anonymous'} · ${report.email}`, inline: false },
    { name: 'Summary',     value: report.summary || '—',             inline: false },
    { name: 'Description', value: (report.description || '—').slice(0, 400), inline: false },
  ];
  if (report.browser)   discordFields.push({ name: 'Browser',    value: report.browser,        inline: true  });
  if (report.eventLink) discordFields.push({ name: 'Event Link', value: report.eventLink,       inline: false });
  if (report.ip)        discordFields.push({ name: 'IP',         value: `\`${report.ip}\``,   inline: true  });
  // Markdown hyperlinks work in embed field values — the correct way to add links on regular webhooks
  if (reportUrl)        discordFields.push({ name: '🔓 Quick Access', value: `[Open Report (30 min read-only)](${reportUrl})`, inline: false });

  await _sendDiscord({
    username:   BRAND_NAME,
    avatar_url: APP_ICON_URL,
    content: isCritical
      ? `<@${DISCORD_ALERT_USER}> **URGENT — ${severity.toUpperCase()} BUG REPORT**`
      : `<@${DISCORD_ALERT_USER}> New bug report — ${severity.toUpperCase()}`,
    embeds: [{
      color,
      author: {
        name:     `${BRAND_NAME} · Bug Reports`,
        icon_url: APP_ICON_URL,
      },
      title: (report.summary || 'New Bug Report').slice(0, 100),
      description: isCritical
        ? `**This requires immediate attention.**\nSeverity: \`${severity.toUpperCase()}\` · Category: ${categoryLabel}`
        : `Severity: \`${severity.toUpperCase()}\` · Category: ${categoryLabel}`,
      fields:    discordFields,
      thumbnail: { url: APP_ICON_URL },
      footer:    { text: `${BRAND_NAME}  ·  Bug Reports  ·  ID: ${report._id || 'N/A'}`, icon_url: APP_ICON_URL },
      timestamp: _ts(),
    }],
  });

  // ── ntfy ──────────────────────────────────────────────────────────────────
  // clickUrl makes the notification itself tappable — opens the quick-access
  // link directly. Tapping the notification → backend validates token → frontend
  // opens with read-only JWT already set. No manual login needed for 30 min.

  const ntfyBody = [
    `From: ${report.name || 'Anonymous'} <${report.email}>`,
    `Category: ${categoryLabel}`,
    `Severity: ${severity.toUpperCase()}`,
    report.browser   ? `Browser: ${report.browser}` : null,
    report.eventLink ? `Event: ${report.eventLink}` : null,
    '',
    (report.description || '').slice(0, 400),
  ].filter(v => v !== null).join('\n');

  const ntfyActions = [];
  if (reportUrl) ntfyActions.push(`view, Open Report (30 min), ${reportUrl}`);
  else if (adminUrl) ntfyActions.push(`view, Open Admin, ${adminUrl}`);

  await _sendNtfy({
    title:    `[${severity.toUpperCase()}] ${(report.summary || '').slice(0, 100)}`,
    body:     ntfyBody,
    priority: NTFY_PRIORITY[severity] || 'default',
    tags:     ['bug', report.category || 'bug'],
    actions:  ntfyActions.join('; ') || undefined,
    iconUrl:  APP_ICON_URL,
    // tap the notification → backend quick-access → frontend with read-only JWT
    clickUrl: reportUrl || adminUrl || undefined,
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

  const slackActions = [];
  if (reportUrl) slackActions.push({ type: 'button', text: { type: 'plain_text', text: '🔓 Open Report (30 min)', emoji: true }, url: reportUrl, style: 'primary' });
  else if (adminUrl) slackActions.push({ type: 'button', text: { type: 'plain_text', text: '🛠 Open Admin Panel', emoji: true }, url: adminUrl, style: 'primary' });
  if (slackActions.length) slackBlocks.push({ type: 'actions', elements: slackActions });

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
    ntfyTags = ['rotating_light', 'warning'];
  } else if (isThreshold) {
    title    = `${count} users reporting issues — ${service}`;
    ntfyTags = ['warning', 'bar_chart'];
  } else {
    title    = `Status Report #${count} — ${service}`;
    ntfyTags = ['bar_chart'];
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
  const isCritical  = isAuto || isThreshold;

  // ── Discord ───────────────────────────────────────────────────────────────

  const discordFields = [
    { name: '🔧 Service',           value: `\`${service}\``, inline: true  },
    { name: '👥 Unique Reporters',  value: String(count),    inline: true  },
    { name: '📡 Alert Type',        value: isAuto ? 'Auto-Detect Probe' : isThreshold ? 'Threshold Breach' : 'User Report', inline: true },
    { name: '📝 Description',       value: description || '—', inline: false },
  ];
  if (reporter) discordFields.push({ name: '📧 Reporter', value: reporter, inline: true });

  // Links via markdown hyperlinks in fields — components not supported on regular webhooks
  if (statusUrl) discordFields.push({ name: 'Status Page', value: `[View Status Page](${statusUrl})`, inline: true });
  if (adminUrl)  discordFields.push({ name: 'Admin',       value: `[Open Admin Panel](${adminUrl})`,  inline: true });

  await _sendDiscord({
    username:   BRAND_NAME,
    avatar_url: APP_ICON_URL,
    content: isCritical
      ? `<@${DISCORD_ALERT_USER}> **${title.slice(0, 130)}**`
      : `<@${DISCORD_ALERT_USER}> ${title.slice(0, 130)}`,
    embeds: [{
      color,
      author: { name: `${BRAND_NAME} · Status`, icon_url: APP_ICON_URL },
      title,
      description: isCritical ? '**Immediate attention may be required.**' : undefined,
      fields:    discordFields,
      thumbnail: { url: APP_ICON_URL },
      footer:    { text: `${BRAND_NAME}  ·  Status Page`, icon_url: APP_ICON_URL },
      timestamp: _ts(),
    }],
  });

  // ── ntfy ──────────────────────────────────────────────────────────────────

  const ntfyBody = [
    `Service: ${service}`,
    `Unique reporters this hour: ${count}`,
    '',
    description,
    reporter ? `\nReporter: ${reporter}` : '',
  ].join('\n').trim();

  const ntfyActionParts = [];
  if (statusUrl) ntfyActionParts.push(`view, Status Page, ${statusUrl}`);
  if (adminUrl)  ntfyActionParts.push(`view, Admin, ${adminUrl}`);

  await _sendNtfy({
    title:    title.slice(0, 130),
    body:     ntfyBody,
    priority: NTFY_PRIORITY[severity],
    tags:     ntfyTags,
    actions:  ntfyActionParts.join('; ') || undefined,
    iconUrl:  APP_ICON_URL,
    clickUrl: statusUrl || adminUrl || undefined,
  });

  // ── Slack ─────────────────────────────────────────────────────────────────

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

  const slackBtns = [];
  if (statusUrl) slackBtns.push({ type: 'button', text: { type: 'plain_text', text: '📊 Status Page', emoji: true }, url: statusUrl, style: 'danger' });
  if (adminUrl)  slackBtns.push({ type: 'button', text: { type: 'plain_text', text: '🛠 Admin Panel',  emoji: true }, url: adminUrl  });
  if (slackBtns.length) slackBlocks.push({ type: 'actions', elements: slackBtns });

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
    maintenance: 0x4B4B4B,
  };

  const severity = incident.severity || 'minor';
  const color    = isResolved ? SEVERITY_COLOR.resolved : (severityColorMap[severity] || SEVERITY_COLOR.medium);
  const adminUrl = _adminUrl();
  const statusUrl = _statusUrl();

  let emoji, titlePrefix, ntfyTags;
  if (isCreated) {
    emoji       = '🚨';
    titlePrefix = 'Incident Created';
    ntfyTags    = ['rotating_light', 'memo'];
  } else if (isResolved) {
    emoji       = '✅';
    titlePrefix = 'Incident Resolved';
    ntfyTags    = ['white_check_mark'];
  } else {
    emoji       = '📋';
    titlePrefix = `Incident ${(update?.status || 'Updated').toUpperCase()}`;
    ntfyTags    = ['memo'];
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
  const isCritical = isCreated && (severity === 'critical' || severity === 'major');

  // ── Discord ───────────────────────────────────────────────────────────────

  const discordFields = [
    { name: '⚡ Severity',          value: `\`${severity.toUpperCase()}\``, inline: true  },
    { name: '📡 Status',            value: `\`${(update?.status || incident.status || 'investigating').toUpperCase()}\``, inline: true },
    { name: '🔧 Affected Services', value: services, inline: false },
    ...(message ? [{ name: isCreated ? '📝 Initial Message' : '🔄 Update', value: message, inline: false }] : []),
    ...(isResolved && incident.downtimeMinutes ? [{ name: '⏱ Downtime', value: `${incident.downtimeMinutes} minutes`, inline: true }] : []),
  ];

  if (statusUrl) discordFields.push({ name: 'Status Page', value: `[View Status Page](${statusUrl})`, inline: true });
  if (adminUrl)  discordFields.push({ name: 'Admin',       value: `[Open Admin Panel](${adminUrl})`,  inline: true });

  await _sendDiscord({
    username:   BRAND_NAME,
    avatar_url: APP_ICON_URL,
    content: isCritical
      ? `<@${DISCORD_ALERT_USER}> **INCIDENT — ${severity.toUpperCase()}**`
      : `<@${DISCORD_ALERT_USER}> ${fullTitle.slice(0, 100)}`,
    embeds: [{
      color,
      author: { name: `${BRAND_NAME} · Incidents`, icon_url: APP_ICON_URL },
      title: fullTitle,
      description: isCritical ? '**A critical incident has been declared.**' : undefined,
      fields:    discordFields,
      thumbnail: { url: APP_ICON_URL },
      footer:    { text: `${BRAND_NAME}  ·  Incident Management  ·  ID: ${incident._id || 'N/A'}`, icon_url: APP_ICON_URL },
      timestamp: _ts(),
    }],
  });

  // ── ntfy ──────────────────────────────────────────────────────────────────

  const ntfyBody = [
    `Severity: ${severity}`,
    `Affected: ${services}`,
    message ? `\n${message}` : '',
    isResolved && incident.downtimeMinutes ? `\nTotal downtime: ${incident.downtimeMinutes} min` : '',
  ].join('\n').trim();

  const incNtfyActions = [];
  if (statusUrl) incNtfyActions.push(`view, Status Page, ${statusUrl}`);
  if (adminUrl)  incNtfyActions.push(`view, Admin, ${adminUrl}`);

  await _sendNtfy({
    title:    fullTitle.slice(0, 130),
    body:     ntfyBody,
    priority: isCreated
      ? (severity === 'critical' ? 'urgent' : severity === 'major' ? 'high' : 'default')
      : (isResolved ? 'default' : 'high'),
    tags:    ntfyTags,
    actions: incNtfyActions.join('; ') || undefined,
    iconUrl: APP_ICON_URL,
    clickUrl: statusUrl || adminUrl || undefined,
  });

  // ── Slack ─────────────────────────────────────────────────────────────────

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

  const slackBtns2 = [];
  if (statusUrl) slackBtns2.push({ type: 'button', text: { type: 'plain_text', text: '📊 Status Page', emoji: true }, url: statusUrl, style: isResolved ? 'primary' : 'danger' });
  if (adminUrl)  slackBtns2.push({ type: 'button', text: { type: 'plain_text', text: '🛠 Admin Panel',  emoji: true }, url: adminUrl });
  if (slackBtns2.length) slackBlocks.push({ type: 'actions', elements: slackBtns2 });

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
