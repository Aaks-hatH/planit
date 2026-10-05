'use strict';

const axios = require('axios');

// User-controlled text (names, messages) must never be able to ping @everyone
// or inject markdown/links into the admin channel.
function clean(s, max = 200) {
  return String(s ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/@/g, '@\u200b')
    .replace(/[`*_~|>]/g, '')
    .trim()
    .slice(0, max);
}

async function discord({ content, title, color = 0x10b981, fields = [] }) {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return;
  try {
    await axios.post(url, {
      content: clean(content, 300),
      allowed_mentions: { parse: [] },
      embeds: [{
        title: clean(title, 100),
        color,
        fields: fields
          .filter(f => f && f.value !== undefined && String(f.value).trim() !== '')
          .slice(0, 10)
          .map(f => ({ name: clean(f.name, 60), value: clean(f.value, 1000), inline: !!f.inline })),
        timestamp: new Date().toISOString(),
        footer: { text: 'PlanIt Payments' },
      }],
    }, { headers: { 'Content-Type': 'application/json' }, timeout: 8000 });
  } catch (e) {
    console.warn('[payments] Discord notify failed:', e.response?.status || e.message);
  }
}

const usd = (cents) => `$${(cents / 100).toFixed(2)}`;

module.exports = { discord, clean, usd };
