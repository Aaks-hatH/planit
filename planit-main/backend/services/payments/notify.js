'use strict';

/**
 * services/payments/notify.js
 *
 * Payment alerts -> Discord + ntfy (+ Slack), the same way every other PlanIt
 * alert works:
 *
 *   1. PRIMARY  - POST /mesh/alert (type "payment") on the ROUTER. The router
 *                 owns DISCORD_WEBHOOK_URL / NTFY_URL / NTFY_TOKEN /
 *                 SLACK_WEBHOOK_URL and fans out to every channel.
 *   2. FALLBACK - if there is no router (local dev) or it is unreachable, this
 *                 backend posts straight to Discord / ntfy using its own env
 *                 vars, so alerts are never silently lost.
 *
 * Alerts are best-effort: they NEVER throw and never block a payment.
 * All user-supplied text is sanitised (no @mentions, no markdown/link injection).
 */

const axios = require('axios');

// -- Sanitising -----------------------------------------------------------------

function clean(s, max = 200) {
  return String(s ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/@/g, '@\u200b')
    .replace(/[`*_~|>]/g, '')
    .trim()
    .slice(0, max);
}

const usd = (cents) => `$${(cents / 100).toFixed(2)}`;

// -- Severity -------------------------------------------------------------------
// level: info | medium | high | critical   (matches the router's alerting levels)

const LEVEL_COLOR = { info: 0x10b981, medium: 0xf59e0b, high: 0xef4444, critical: 0xb91c1c };
const NTFY_PRIORITY = { info: 3, medium: 4, high: 4, critical: 5 };
const NTFY_TAGS = {
  info: ['moneybag'],
  medium: ['warning', 'eyes'],
  high: ['rotating_light'],
  critical: ['rotating_light', 'sos'],
};

// Legacy callers pass an embed colour instead of a level.
function levelFromColor(color) {
  if (color === 0xef4444) return 'high';
  if (color === 0xf59e0b) return 'medium';
  return 'info';
}

function frontendUrl(path = '') {
  const fe = (process.env.FRONTEND_URL || '').split(',')[0].trim().replace(/\/$/, '');
  return fe ? `${fe}${path}` : null;
}

// -- Direct (fallback) senders --------------------------------------------------

async function directDiscord({ title, content, fields, level }) {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return false;
  try {
    await axios.post(url, {
      content: clean(content, 300),
      allowed_mentions: { parse: [] },
      embeds: [{
        title: clean(title, 100),
        color: LEVEL_COLOR[level] ?? LEVEL_COLOR.info,
        fields: fields.map((f) => ({ name: clean(f.name, 60), value: clean(f.value, 1000), inline: !!f.inline })),
        timestamp: new Date().toISOString(),
        footer: { text: 'PlanIt Payments' },
      }],
    }, { headers: { 'Content-Type': 'application/json' }, timeout: 8000 });
    return true;
  } catch (e) {
    console.warn('[payments] Discord notify failed:', e.response?.status || e.message);
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

async function directNtfy({ title, content, fields, level, clickUrl }) {
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
      priority: NTFY_PRIORITY[level] || 3,
      tags: NTFY_TAGS[level] || NTFY_TAGS.info,
      ...(clickUrl ? { click: clickUrl } : {}),
    }, { headers, timeout: 8000 });
    return true;
  } catch (e) {
    console.warn('[payments] ntfy notify failed:', e.response?.status || e.message);
    return false;
  }
}

// -- Public API -----------------------------------------------------------------

/**
 * @param {object}  a
 * @param {string}  a.title     short headline
 * @param {string} [a.content]  one-line summary
 * @param {{name:string,value:any,inline?:boolean}[]} [a.fields]
 * @param {'info'|'medium'|'high'|'critical'} [a.level]
 * @param {string} [a.invoiceId] public invoice id (adds an admin deep-link)
 * @returns {Promise<{ok:boolean, via:'router'|'direct'|'none', channels?:object}>}
 */
async function alert({ title, content = '', fields = [], level = 'info', invoiceId = '' }) {
  const cleaned = fields
    .filter((f) => f && f.value !== undefined && String(f.value).trim() !== '')
    .slice(0, 10)
    .map((f) => ({ name: clean(f.name, 60), value: clean(f.value, 1000), inline: !!f.inline }));
  const payload = {
    title: clean(title, 100),
    content: clean(content, 300),
    fields: cleaned,
    level,
    invoiceId: /^[0-9a-f]{32}$/.test(invoiceId) ? invoiceId : '',
  };

  // 1. Router (Discord + ntfy + Slack from one place)
  const routerUrl = process.env.ROUTER_URL;
  if (routerUrl) {
    try {
      const { meshPost } = require('../../middleware/mesh');
      const r = await meshPost(process.env.BACKEND_LABEL || 'Backend', `${routerUrl}/mesh/alert`, { type: 'payment', payload }, { timeout: 6000 });
      if (r.ok) return { ok: true, via: 'router', channels: r.data?.channels };
      console.warn('[payments] router alert failed, falling back to direct:', r.error);
    } catch (e) {
      console.warn('[payments] router alert error, falling back to direct:', e.message);
    }
  }

  // 2. Direct fallback
  const clickUrl = payload.invoiceId ? frontendUrl('/admin') : frontendUrl('/admin');
  const [d, n] = await Promise.all([
    directDiscord({ ...payload }),
    directNtfy({ ...payload, clickUrl }),
  ]);
  return { ok: d || n, via: d || n ? 'direct' : 'none', channels: { discord: d, ntfy: n } };
}

/** Back-compat shim: older call-sites pass { content, title, color, fields }. */
async function discord({ content, title, color, fields = [], level, invoiceId }) {
  try {
    return await alert({ title, content, fields, level: level || levelFromColor(color), invoiceId });
  } catch (e) {
    console.warn('[payments] notify failed:', e.message);
    return { ok: false, via: 'none' };
  }
}

module.exports = { alert, discord, clean, usd };
