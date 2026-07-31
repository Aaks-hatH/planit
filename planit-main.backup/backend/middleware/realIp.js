'use strict';

const crypto      = require('crypto');
const MESH_SECRET = process.env.MESH_SECRET || '';
// Match the TTL used by the router mesh token (30 s) plus a 2 s clock-skew buffer.
const MESH_IP_TTL_MS = 30_000;

// IS_EDGE_SERVICE=true  → this service sits directly behind Cloudflare (the router).
//                         CF-Connecting-IP is set by Cloudflare to the real client IP.
// IS_EDGE_SERVICE=false → this is a backend behind the router.
//                         CF-Connecting-IP is set by Cloudflare to the *router's* IP,
//                         NOT the real client. Trusting it here would ban the router.
//
// Set IS_EDGE_SERVICE=true ONLY on the router service in Render env vars.
// Leave it unset (or false) on all backend services.
const IS_EDGE_SERVICE = process.env.IS_EDGE_SERVICE === 'true';

/**
 * Verify the HMAC signature stamped on X-Planit-Client-IP-Sig by the router.
 * Format: "<timestamp>:<ip>:<sha256-hex>"
 * Returns true only when the signature is valid and the timestamp is fresh.
 */
function verifyClientIpSig(ip, sigHeader) {
  if (!MESH_SECRET || !sigHeader) return false;
  try {
    const parts = sigHeader.split(':');
    if (parts.length < 3) return false;
    const sig     = parts[parts.length - 1];
    const payload = parts.slice(0, -1).join(':'); // everything before the last ':'
    const ts      = parseInt(parts[0], 10);
    const age     = Date.now() - ts;
    if (isNaN(age) || age < -2000 || age > MESH_IP_TTL_MS) return false;
    const expected = crypto.createHmac('sha256', MESH_SECRET).update(payload).digest('hex');
    const b1 = Buffer.from(expected, 'hex');
    const b2 = Buffer.from(sig,      'hex');
    if (b1.length !== b2.length) return false;
    if (!crypto.timingSafeEqual(b1, b2)) return false;
    // Ensure the IP in the signature matches the header value
    const sigIp = parts[1];
    return sigIp === ip.trim();
  } catch {
    return false;
  }
}

/**
 * middleware/realIp.js
 *
 * Single source of truth for resolving the real client IP address.
 *
 * Priority order (backend services, IS_EDGE_SERVICE=false):
 *  0a. X-Planit-Client-IP + HMAC sig  — stamped and signed by the router.
 *                                        Requires MESH_SECRET to be set on this
 *                                        service. This is the authoritative path.
 *  0b. X-Planit-Client-IP (unsigned)  — fallback when MESH_SECRET is missing,
 *                                        only trusted when the socket is private
 *                                        (Render internal hop = came from our router).
 *  1.  x-forwarded-for                — Leftmost public IP, skipping private ranges.
 *  2.  req.ip                         — Express trust-proxy resolved value.
 *  3.  socket address                 — Last resort (dev/direct connections only).
 *
 * Priority order (router / edge service, IS_EDGE_SERVICE=true):
 *  0a/0b. Same as above (not usually reached on the router itself).
 *  1.  CF-Connecting-IP               — Cloudflare sets this to the real client IP
 *                                        on the edge service. Safe to trust here.
 *  2-3. Same fallback chain.
 *
 * WHY CF-Connecting-IP is SKIPPED on backends
 * ────────────────────────────────────────────
 * Every *.onrender.com URL is proxied through Render's built-in Cloudflare CDN.
 * When the router makes an internal HTTP call to a backend URL, Cloudflare sees
 * the router as the connecting client and sets CF-Connecting-IP = router's IP.
 *
 * If a backend trusts CF-Connecting-IP, every ban targets the router instead of
 * the actual attacker — blocking ALL legitimate users simultaneously.
 *
 * CF-Connecting-IP is only trustworthy on the outermost edge service (the router),
 * where Cloudflare truly sees the end user's IP as the connecting client.
 * IS_EDGE_SERVICE=true gates this behaviour to the router only.
 *
 * WHY MESH_SECRET MUST BE SET ON ALL SERVICES
 * ─────────────────────────────────────────────
 * Without MESH_SECRET, step 0a is skipped. Step 0b then falls through when the
 * socket is private but X-Planit-Client-IP is absent, and the code reaches the
 * XFF/req.ip fallbacks — which may resolve to the router IP, not the real client.
 * Set MESH_SECRET to the same value on every service in Render env vars.
 *
 * Usage:
 *   const { realIp } = require('../middleware/realIp');   // from routes/
 *   const { realIp } = require('./realIp');               // from middleware/
 *
 *   const ip = realIp(req);   // always returns a non-empty string
 */

// Private / non-routable CIDR ranges that must never be used as a "client" IP.
// Checked as simple string prefixes — good enough for these well-known ranges
// and avoids pulling in a CIDR library.
const PRIVATE_PREFIXES = [
  '10.',
  '172.16.', '172.17.', '172.18.', '172.19.',
  '172.20.', '172.21.', '172.22.', '172.23.',
  '172.24.', '172.25.', '172.26.', '172.27.',
  '172.28.', '172.29.', '172.30.', '172.31.',
  '192.168.',
  '127.',
  '::1',
  '::ffff:10.',
  '::ffff:192.168.',
  '::ffff:127.',
  'fc', 'fd',   // ULA IPv6 (fc00::/7)
];

/**
 * Returns true if the address looks like a private / internal address that
 * should NOT be used as the real client IP.
 *
 * @param {string} addr
 * @returns {boolean}
 */
function isPrivate(addr) {
  if (!addr || typeof addr !== 'string') return true;
  const a = addr.trim().toLowerCase();
  if (!a || a === 'unknown') return true;
  return PRIVATE_PREFIXES.some(prefix => a.startsWith(prefix));
}

/**
 * Extract the first public IP from an X-Forwarded-For header value.
 * XFF is a comma-separated list; the leftmost entry is the original client.
 * We skip any entries that are private/internal.
 *
 * @param {string|undefined} xff
 * @returns {string|null}
 */
function firstPublicFromXff(xff) {
  if (!xff || typeof xff !== 'string') return null;
  const parts = xff.split(',');
  for (const part of parts) {
    const candidate = part.trim();
    if (candidate && !isPrivate(candidate)) return candidate;
  }
  return null;
}

/**
 * Resolve the real client IP from an Express request object.
 *
 * Never returns an empty string — falls back to 'unknown' if nothing
 * usable can be found (which should not happen in practice).
 *
 * @param {import('express').Request} req
 * @returns {string}
 */
function realIp(req) {
  if (!req) return 'unknown';

  // 0a. HMAC-signed X-Planit-Client-IP — trusted regardless of socket source.
  //
  // The router stamps every proxied request with:
  //   X-Planit-Client-IP:     <real client IP>
  //   X-Planit-Client-IP-Sig: <timestamp>:<ip>:<sha256-hmac(MESH_SECRET)>
  //
  // Because the signature requires MESH_SECRET (only known to our services),
  // an external attacker cannot forge it — even if they connect directly to the
  // backend over a public IP. The timestamp makes replays expire after 30 s.
  // This path works whether the router connects via private or public networking.
  if (MESH_SECRET) {
    const sigHeader = req.headers?.['x-planit-client-ip-sig'];
    const claimedIp = req.headers?.['x-planit-client-ip'];
    if (sigHeader && claimedIp) {
      const cleaned = claimedIp.trim();
      if (cleaned && !isPrivate(cleaned) && verifyClientIpSig(cleaned, sigHeader)) {
        return cleaned;
      }
    }
  }

  // 0b. Unsigned X-Planit-Client-IP — fallback when MESH_SECRET is not set.
  //
  // Only trusted when the TCP socket itself is from a private/internal address,
  // which means the request physically came from our router (Render private
  // networking). An external attacker hitting the backend directly would have a
  // public socket address so this branch is skipped and their header ignored.
  const rawSocket  = req.socket?.remoteAddress || req.connection?.remoteAddress || '';
  const socketAddr = rawSocket.replace(/^::ffff:/, '');
  if (isPrivate(socketAddr) || socketAddr === '') {
    const routerIp = req.headers?.['x-planit-client-ip'];
    if (routerIp && typeof routerIp === 'string') {
      const cleaned = routerIp.trim();
      if (cleaned && !isPrivate(cleaned)) return cleaned;
    }
    // Socket is private (internal Render hop from our router) but
    // X-Planit-Client-IP is absent. This almost always means MESH_SECRET
    // is not set on the router — the signed header never gets stamped.
    // Without it every ban will target the router IP, not the real client.
    if (!MESH_SECRET) {
      console.warn(
        '[realIp] CRITICAL: private socket but X-Planit-Client-IP missing. ' +
        'Ensure MESH_SECRET is set on ALL services in Render env vars. ' +
        'Bans will target the router IP until this is fixed.'
      );
    }
  }

  // 1. Cloudflare-guaranteed header.
  //
  // ONLY trusted on the edge service (the router, IS_EDGE_SERVICE=true).
  // On backends, Cloudflare sees the *router* as the connecting client and
  // sets CF-Connecting-IP to the router's IP — NOT the real user's IP.
  // Trusting it on a backend would cause every ban to hit the router,
  // taking down the service for all users. Skip it entirely on backends.
  if (IS_EDGE_SERVICE) {
    const cf = req.headers?.['cf-connecting-ip'];
    if (cf && typeof cf === 'string' && cf.trim() && !isPrivate(cf.trim())) {
      return cf.trim();
    }
  }

  // 2. X-Forwarded-For leftmost public entry.
  const xffPublic = firstPublicFromXff(req.headers?.['x-forwarded-for']);
  if (xffPublic) return xffPublic;

  // 3. Express trust-proxy resolved req.ip — skip if private.
  if (req.ip && !isPrivate(req.ip)) return req.ip;

  // 4. Raw socket address — last resort.
  const sock = req.socket?.remoteAddress || req.connection?.remoteAddress;
  if (sock && !isPrivate(sock)) return sock;

  // All candidates were private/internal — this typically means a direct
  // local connection (dev environment). Return whatever we have rather than
  // an empty string so callers always get a non-empty key.
  return req.ip || sock || 'unknown';
}

module.exports = { realIp, isPrivate };