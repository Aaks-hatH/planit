'use strict';

const { meshPost } = require('../middleware/mesh');

async function verifyTurnstile(token, ip, options = {}) {
  const { failOpen = false, context = 'captcha' } = options;
  if (process.env.TURNSTILE_ENABLED !== 'true') return { ok: true, skipped: true };

  const routerUrl = (process.env.ROUTER_URL || '').replace(/\/$/, '');
  if (!routerUrl) {
    console.warn(`[${context}] TURNSTILE_ENABLED=true but ROUTER_URL is not set`);
    return failOpen ? { ok: true, skipped: true } : { ok: false, error: 'verification unavailable' };
  }
  if (!token) return { ok: false, error: 'verification required' };

  const result = await meshPost('backend', `${routerUrl}/mesh/turnstile`, { token, ip });
  if (!result.ok) {
    console.warn(`[${context}] Turnstile router unreachable:`, result.error);
    return failOpen ? { ok: true, skipped: true } : { ok: false, error: 'verification unavailable' };
  }
  return result.data;
}

module.exports = { verifyTurnstile };
