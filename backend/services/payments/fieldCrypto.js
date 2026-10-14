'use strict';

/**
 * services/payments/fieldCrypto.js
 *
 * AES-256-GCM field-level encryption for payment PII (email, name, notes).
 *
 * Format:  v1.<iv b64url>.<tag b64url>.<ciphertext b64url>
 *   - 96-bit random IV per value (never reused)
 *   - 128-bit auth tag → tampering is detected on decrypt
 *   - `aad` (additional authenticated data) binds a ciphertext to its record,
 *     so a value copied from one invoice into another fails to decrypt.
 *
 * Key: PAYMENTS_ENC_KEY = 32 random bytes, hex (64 chars) or base64.
 *   Generate with:  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * Key rotation: set PAYMENTS_ENC_KEY_PREV to the old key; values encrypted
 * with it still decrypt, and new writes use PAYMENTS_ENC_KEY.
 */

const crypto = require('crypto');

function parseKey(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  let buf = null;
  if (/^[0-9a-fA-F]{64}$/.test(s)) buf = Buffer.from(s, 'hex');
  else {
    try { buf = Buffer.from(s, 'base64'); } catch { buf = null; }
  }
  return buf && buf.length === 32 ? buf : null;
}

let _keys = null;
function keys() {
  if (_keys) return _keys;
  const current = parseKey(process.env.PAYMENTS_ENC_KEY);
  const prev    = parseKey(process.env.PAYMENTS_ENC_KEY_PREV);

  if (!current) {
    if (process.env.NODE_ENV === 'production') {
      // Fail closed: never store payment PII unencrypted in production.
      throw new Error('PAYMENTS_ENC_KEY must be set to 32 random bytes (hex or base64) in production');
    }
    console.warn('[payments] PAYMENTS_ENC_KEY not set — using an ephemeral dev key (data will not survive a restart)');
    _keys = { current: crypto.randomBytes(32), prev };
  } else {
    _keys = { current, prev };
  }
  return _keys;
}

const b64u = (b) => b.toString('base64url');
const unb64u = (s) => Buffer.from(s, 'base64url');

function encrypt(plaintext, aad = '') {
  if (plaintext === undefined || plaintext === null || plaintext === '') return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keys().current, iv);
  cipher.setAAD(Buffer.from(String(aad)));
  const ct  = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1.${b64u(iv)}.${b64u(tag)}.${b64u(ct)}`;
}

function decrypt(payload, aad = '') {
  if (!payload) return '';
  const parts = String(payload).split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') return '';
  const [, ivS, tagS, ctS] = parts;
  const { current, prev } = keys();
  for (const key of [current, prev].filter(Boolean)) {
    try {
      const d = crypto.createDecipheriv('aes-256-gcm', key, unb64u(ivS));
      d.setAAD(Buffer.from(String(aad)));
      d.setAuthTag(unb64u(tagS));
      return Buffer.concat([d.update(unb64u(ctS)), d.final()]).toString('utf8');
    } catch { /* try next key */ }
  }
  return '';
}

/** Keyed hash for abuse limiting — lets us count per-IP without storing the IP. */
function hmac(value) {
  return crypto.createHmac('sha256', keys().current).update(String(value)).digest('hex').slice(0, 32);
}

module.exports = { encrypt, decrypt, hmac };
