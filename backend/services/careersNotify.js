'use strict';

/**
 * services/careersNotify.js
 *
 * New-application alerts -> Discord + ntfy (+ Slack), the same way every other
 * PlanIt alert works:
 *
 *   1. PRIMARY  - POST /mesh/alert (type "career") on the ROUTER, which owns
 *                 DISCORD_WEBHOOK_URL / NTFY_URL / NTFY_TOKEN / SLACK_WEBHOOK_URL.
 *   2. FALLBACK - no router (local dev) or it is unreachable: this backend posts
 *                 straight to Discord / ntfy with its own env vars.
 *
 * Best-effort: never throws, never blocks an application.
 * All applicant-supplied text is sanitised (no @mentions, no markdown injection).
 */

const axios = require('axios');

function clean(s, max = 200) {
  return String(s ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/@/g, '@\u200b')
    .replace(/[`*_~|>]/g, '')
    .trim()
    .slice(0, max);
}

const LEVEL_COLOR = { info: 0x10b981, medium: 0xf59e0b, high: 0xef4444 };
const ALERT_USER = process.env.DISCORD_ALERT_USER_ID || '1168575437723680850';

function frontendUrl(path = '') {
  const fe = (process.env.FRONTEND_URL || '').split(',')[0].trim().replace(/\/$/, '');
  return fe ? `${fe}${path}` : null;
}

async function directDiscord({ title, content, fields, level }) {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return false;
  const admin = frontendUrl('/admin');
  const f = fields.map((x) => ({ name: clean(x.name, 60), value: clean(x.value, 1000), inline: !!x.inline }));
  if (admin) f.push({ name: 'Admin', value: `[Open Careers](${admin})`, inline: true });
  try {
    await axios.post(url, {
      content: `<@${ALERT_USER}> ${clean(content || title, 240)}`,
      allowed_mentions: { users: [ALERT_USER] },
      embeds: [{
        title: clean(title, 100),
        color: LEVEL_COLOR[level] ?? LEVEL_COLOR.info,
        fields: f,
        timestamp: new Date().toISOString(),
        footer: { text: 'PlanIt Careers' },
      }],
    }, { headers: { 'Content-Type': 'application/json' }, timeout: 8000 });
    return true;
  } catch (e) {
    console.warn('[careers] Discord notify failed:', e.response?.status || e.message);
    return false;
  }
}

function parseNtfy(raw) {
  const v = String(raw || '').trim();
  if (!v) return null;
  if (!/^https?:\/\//i.test(v)) return { server: 'https://ntfy.sh', topic: v.replace(/^\/|\/$/g, '') };
  try {
    const u = new URL(v);
    const topic = u.pathname.replace(/^\/|\/$/g, '');
    return topic ? { server: u.origin, topic } : null;
  } catch { return null; }
}

async function directNtfy({ title, content, fields, clickUrl }) {
  const t = parseNtfy(process.env.NTFY_URL);
  if (!t) return false;
  const body = [content, ...fields.map((f) => `${f.name}: ${f.value}`)].filter(Boolean).join('\n');
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.NTFY_TOKEN) headers.Authorization = `Bearer ${process.env.NTFY_TOKEN}`;
  try {
    await axios.post(t.server, {
      topic: t.topic,
      title: clean(title, 120),
      message: clean(body, 3500) || clean(title, 120),
      priority: Math.min(5, Math.max(1, Number(process.env.NTFY_CAREER_PRIORITY) || 4)),
      tags: ['briefcase', 'raising_hand'],
      ...(clickUrl ? { click: clickUrl } : {}),
    }, { headers, timeout: 8000 });
    return true;
  } catch (e) {
    console.warn('[careers] ntfy notify failed:', e.response?.status || e.message);
    return false;
  }
}

/**
 * @param {object} a
 * @param {string} a.title
 * @param {string} [a.content]
 * @param {{name:string,value:any,inline?:boolean}[]} [a.fields]
 * @param {'info'|'medium'|'high'} [a.level]
 * @param {string} [a.applicationId]
 * @returns {Promise<{ok:boolean, via:'router'|'direct'|'none', channels?:object}>}
 */
async function alert({ title, content = '', fields = [], level = 'info', applicationId = '' }) {
  const payload = {
    title: clean(title, 100),
    content: clean(content, 300),
    fields: fields
      .filter((f) => f && f.value !== undefined && String(f.value).trim() !== '')
      .slice(0, 10)
      .map((f) => ({ name: clean(f.name, 60), value: clean(f.value, 1000), inline: !!f.inline })),
    level,
    applicationId: /^[0-9a-f]{24}$/.test(applicationId) ? applicationId : '',
  };

  // 1. Router (Discord + ntfy + Slack from one place)
  const routerUrl = process.env.ROUTER_URL;
  if (routerUrl) {
    try {
      const { meshPost } = require('../middleware/mesh');
      const r = await meshPost(process.env.BACKEND_LABEL || 'Backend', `${routerUrl}/mesh/alert`, { type: 'career', payload }, { timeout: 6000 });
      if (r.ok) return { ok: true, via: 'router', channels: r.data?.channels };
      console.warn('[careers] router alert failed, falling back to direct:', r.error);
    } catch (e) {
      console.warn('[careers] router alert error, falling back to direct:', e.message);
    }
  }

  // 2. Direct fallback
  const clickUrl = frontendUrl('/admin');
  const [d, n] = await Promise.all([directDiscord(payload), directNtfy({ ...payload, clickUrl })]);
  return { ok: d || n, via: d || n ? 'direct' : 'none', channels: { discord: d, ntfy: n } };
}

module.exports = { alert, clean };
