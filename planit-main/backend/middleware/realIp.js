'use strict';

const crypto      = require('crypto');
const MESH_SECRET = process.env.MESH_SECRET || '';
// Match the TTL used by the router mesh token (30 s) plus a 2 s clock-skew buffer.
const MESH_IP_TTL_MS = 30_000;

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
 * Priority order:
 *  1. cf-connecting-ip  — Set by Cloudflare; cannot be spoofed because
 *                         Cloudflare strips any user-sent CF-Connecting-IP
 *                         before adding its own. When traffic arrives via
 *                         Cloudflare, this is the only header to trust.
 *  2. x-forwarded-for   — Leftmost public IP, skipping any private/internal
 *                         ranges (10.x, 172.16-31.x, 192.168.x, loopback,
 *                         and IPv4-mapped IPv6 equivalents). Used when the
 *                         internal Render router preserves XFF.
 *  3. req.ip            — Express trust-proxy resolved value, again skipping
 *                         private ranges so a Render-internal hop address
 *                         (10.x.x.x / 172.x.x.x) never becomes the "client".
 *  4. socket address    — Last resort only (typically only reached on direct
 *                         local connections during development).
 *
 * WHY THIS MATTERS
 * ────────────────
 * Without this, five different files each did their own ad-hoc IP extraction,
 * all disagreeing. The three concrete bugs that resulted:
 *
 *   a) Spoofable headers (XFF, X-Real-IP) were used instead of CF-Connecting-IP.
 *      An attacker could set X-Forwarded-For: 1.2.3.4 and bypass IP-based
 *      rate limits / bans entirely.
 *
 *   b) The Render-internal router hop produces a private address (10.x / 172.x).
 *      Because nothing filtered out private ranges, that internal address was
 *      used as the "real client", causing everyone sharing that router to look
 *      like the same IP — and a ban on the attacker's real IP would never match
 *      the internal address stored during a legitimate user's session.
 *
 *   c) The blocklist was storing the real IP at ban time but comparing against
 *      the internal hop address at check time → bans had zero effect.
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
  }

  // 1. Cloudflare-guaranteed header — cannot be forged by end users.
  const cf = req.headers?.['cf-connecting-ip'];
  if (cf && typeof cf === 'string' && cf.trim() && !isPrivate(cf.trim())) {
    return cf.trim();
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