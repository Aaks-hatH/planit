'use strict';

/**
 * services/configSync.js
 *
 * On startup, fetches shared environment variables from the router's
 * /mesh/config endpoint and writes them into process.env.
 *
 * This means you only need to set shared vars (e.g. Upstash Redis credentials,
 * FRONTEND_URL) on the ROUTER — every backend picks them up automatically at
 * boot and stores them in memory for the lifetime of the process.
 *
 * Call `await syncConfigFromRouter()` BEFORE any service that depends on
 * those env vars is initialized (i.e. before redisClient is first used).
 *
 * If the router is unreachable (e.g. local dev with no router), the function
 * warns and continues — locally-set env vars remain in effect as normal.
 *
 * Env vars required on every backend (these can't be self-bootstrapped):
 *   ROUTER_URL    — URL of the router (already needed for mesh)
 *   MESH_SECRET   — shared HMAC secret (already needed for mesh auth)
 */

const { meshGet } = require('../middleware/mesh');

const CALLER      = process.env.BACKEND_LABEL || 'Backend';
const MAX_RETRIES = 3;
const RETRY_MS    = 2000;

async function syncConfigFromRouter() {
  const routerUrl = process.env.ROUTER_URL;
  if (!routerUrl) {
    console.warn('[configSync] ROUTER_URL not set — skipping config sync, using local env vars');
    return;
  }

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const result = await meshGet(CALLER, `${routerUrl}/mesh/config`, { timeout: 8000 });

    if (result.ok && result.data?.config) {
      const config  = result.data.config;
      const applied = [];

      // These keys are always overwritten from the router — backends should NOT
      // set them in their own Render env vars (set them only on the router).
      const FORCE_FROM_ROUTER = new Set(['UPSTASH_REDIS_URL','UPSTASH_REDIS_TOKEN','FRONTEND_URL']);

      for (const [key, value] of Object.entries(config)) {
        if (FORCE_FROM_ROUTER.has(key) || !process.env[key]) {
          process.env[key] = value;
          applied.push(key);
        } else {
          console.log(`[configSync] ${key} — kept local override`);
        }
      }

      if (applied.length > 0) {
        console.log(`[configSync] Synced from router: ${applied.join(', ')}`);
        // Reset the Redis client lazy-config cache so it re-reads credentials
        // we just wrote into process.env. Without this, if any code touched
        // Redis before configSync finished (health check, first request, etc.)
        // the client would have cached a no-credentials state and stayed in
        // in-memory fallback mode for the entire process lifetime — silently
        // making all ban/warn operations non-persistent and non-shared.
        try {
          const redis = require('./redisClient');
          if (typeof redis._resetCfg === 'function') redis._resetCfg();
        } catch { /* no-op if redisClient doesn't export _resetCfg yet */ }
      } else {
        console.log('[configSync] Router config received — all keys already set locally');
      }
      return; // success
    }

    const reason = result.error || 'unexpected response';
    if (attempt < MAX_RETRIES) {
      console.warn(`[configSync] Attempt ${attempt}/${MAX_RETRIES} failed (${reason}) — retrying in ${RETRY_MS}ms`);
      await new Promise(r => setTimeout(r, RETRY_MS));
    } else {
      console.warn(`[configSync] All ${MAX_RETRIES} attempts failed — continuing with local env vars only`);
      console.warn(`[configSync] Last error: ${reason}`);
    }
  }
}

module.exports = { syncConfigFromRouter };
