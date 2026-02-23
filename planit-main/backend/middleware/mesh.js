'use strict';


const crypto = require('crypto');
const axios  = require('axios');

const MESH_SECRET      = process.env.MESH_SECRET || '';
const MESH_TOKEN_TTL_MS = 30_000; // reject tokens older than 30 seconds — blocks replay attacks

if (!MESH_SECRET) {
  console.warn('[mesh] WARNING: MESH_SECRET is not set — all mesh calls will be rejected.');
}

// ─── Token generation ─────────────────────────────────────────────────────────

function signToken(callerName) {
  const timestamp = Date.now().toString();
  const payload   = `${timestamp}:${callerName}`;
  const hmac      = crypto
    .createHmac('sha256', MESH_SECRET)
    .update(payload)
    .digest('hex');
  return `${payload}:${hmac}`;
}

// Returns the headers object to attach to outgoing internal HTTP calls
function meshHeaders(callerName) {
  return {
    'X-Mesh-Token':   signToken(callerName),
    'X-Mesh-Caller':  callerName,
    'X-Mesh-Version': '1',
  };
}

// ─── Token verification ───────────────────────────────────────────────────────

function verifyToken(tokenStr) {
  if (!tokenStr) return { ok: false, reason: 'missing token' };

  const parts = tokenStr.split(':');
  // Format: timestamp:callerName:hmac  (callerName can contain colons — hmac is always last 64 chars)
  if (parts.length < 3) return { ok: false, reason: 'malformed token' };

  const hmacReceived = parts[parts.length - 1];
  const payload      = parts.slice(0, parts.length - 1).join(':');
  const [timestamp, ...nameParts] = payload.split(':');
  const callerName   = nameParts.join(':');

  // Check timestamp freshness
  const age = Date.now() - parseInt(timestamp, 10);
  if (isNaN(age) || age < 0 || age > MESH_TOKEN_TTL_MS) {
    return { ok: false, reason: `token expired (age: ${age}ms)` };
  }

  // Verify HMAC — use timingSafeEqual to prevent timing attacks
  const expected = crypto
    .createHmac('sha256', MESH_SECRET)
    .update(payload)
    .digest('hex');

  const safeExpected = Buffer.from(expected,      'hex');
  const safeReceived = Buffer.from(hmacReceived,  'hex');

  if (safeExpected.length !== safeReceived.length) {
    return { ok: false, reason: 'bad signature' };
  }

  if (!crypto.timingSafeEqual(safeExpected, safeReceived)) {
    return { ok: false, reason: 'bad signature' };
  }

  return { ok: true, callerName, age };
}

// ─── Express middleware ───────────────────────────────────────────────────────

// Use on any endpoint that should only accept calls from mesh members
function meshAuth(serviceName) {
  return (req, res, next) => {
    const token  = req.headers['x-mesh-token'];
    const caller = req.headers['x-mesh-caller'] || 'unknown';
    const result = verifyToken(token);

    if (!result.ok) {
      console.log(`[mesh] REJECTED  ${caller} → ${serviceName}  ${req.method} ${req.path}  — ${result.reason}`);
      return res.status(401).json({ error: 'Mesh auth failed', reason: result.reason });
    }

    // Attach caller info to request for route handlers
    req.meshCaller = result.callerName;
    console.log(`[mesh] ${result.callerName} → ${serviceName}  ${req.method} ${req.path}`);
    next();
  };
}

// ─── Authenticated HTTP helpers ───────────────────────────────────────────────

// These wrap axios with mesh headers + timing logs + consistent error handling

async function meshGet(callerName, url, opts = {}) {
  const t0 = Date.now();
  try {
    const res = await axios.get(url, {
      timeout: opts.timeout || 10000,
      headers: { ...meshHeaders(callerName), ...(opts.headers || {}) },
      validateStatus: opts.validateStatus,
    });
    const ms = Date.now() - t0;
    const path = new URL(url).pathname;
    console.log(`[mesh] ${callerName} → mesh call  GET ${path} — ${ms}ms`);
    return { ok: true, data: res.data, status: res.status, ms };
  } catch (err) {
    const ms = Date.now() - t0;
    return { ok: false, error: err.message, ms };
  }
}

async function meshPost(callerName, url, body = {}, opts = {}) {
  const t0 = Date.now();
  try {
    const res = await axios.post(url, body, {
      timeout: opts.timeout || 10000,
      headers: { ...meshHeaders(callerName), ...(opts.headers || {}) },
      validateStatus: opts.validateStatus,
    });
    const ms = Date.now() - t0;
    const path = new URL(url).pathname;
    console.log(`[mesh] ${callerName} → mesh call  POST ${path} — ${ms}ms`);
    return { ok: true, data: res.data, status: res.status, ms };
  } catch (err) {
    const ms = Date.now() - t0;
    return { ok: false, error: err.message, ms };
  }
}

module.exports = { meshHeaders, meshAuth, meshGet, meshPost, signToken, verifyToken };
