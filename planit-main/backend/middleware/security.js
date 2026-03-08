'use strict';

/**
 * middleware/security.js
 *
 * Two exported items:
 *
 * 1.  trafficGuard  — Express middleware, mount globally in server.js.
 *     Detects malicious traffic patterns with progressive enforcement:
 *       WARN threshold  → logged only
 *       BAN threshold   → temporary IP block (default 30 minutes)
 *     Never blocks on a single event. Designed so that no real user
 *     browsing normally will ever be affected.
 *
 *     Detection categories:
 *       - Rapid identical requests  (same IP + path, X times in 10s)
 *       - Path fuzzing              (/etc/passwd, /../.., /.env, etc.)
 *       - Suspicious user-agents    (sqlmap, nikto, masscan, etc.)
 *       - Oversized payload probe   (Content-Length > limit without a file upload)
 *
 * 2.  scanUpload(file) — call before every Cloudinary upload.
 *     Returns { ok: true } or { ok: false, reason: string }.
 *     Blocks:
 *       - Executable / scripting extensions
 *       - MIME type mismatches (extension says .jpg but MIME says text/html, etc.)
 *
 * Env vars (all optional, safe defaults):
 *   SECURITY_ENABLED        'true' (set to 'false' to disable entirely)
 *   SECURITY_BAN_MINUTES    30
 *   SECURITY_WARN_WINDOW_S  10    (seconds window for rapid-request detection)
 *   SECURITY_WARN_THRESHOLD 25    (identical requests in window before WARN)
 *   SECURITY_BAN_THRESHOLD   5    (WARNs before temporary BAN)
 */

const redis     = require('../services/redisClient');
const Blocklist = require('../models/Blocklist');

const ENABLED        = process.env.SECURITY_ENABLED !== 'false';
const BAN_MINUTES    = parseInt(process.env.SECURITY_BAN_MINUTES    || '30',  10);
const WARN_WINDOW_S  = parseInt(process.env.SECURITY_WARN_WINDOW_S  || '10',  10);
const WARN_THRESHOLD = parseInt(process.env.SECURITY_WARN_THRESHOLD || '25',  10);
const BAN_THRESHOLD  = parseInt(process.env.SECURITY_BAN_THRESHOLD  || '5',   10);
const BAN_TTL        = BAN_MINUTES * 60;

// ─── Known scanner / exploit user-agent fragments ─────────────────────────────
// Intentionally short list to avoid false-positives.
const BAD_UA_PATTERNS = [
  'sqlmap', 'nikto', 'masscan', 'nmap', 'zgrab', 'dirbuster',
  'gobuster', 'wfuzz', 'acunetix', 'netsparker', 'appscan',
  'openvas', 'hydra', 'medusa', 'python-requests/2.1',
];

// ─── Path patterns that real users never send ─────────────────────────────────
const FUZZ_PATTERNS = [
  /\.\.(\/|\\)/,          // path traversal
  /\/etc\/(passwd|shadow|hosts)/i,
  /\.(env|git|svn|htaccess|htpasswd|DS_Store)/i,
  /\/(wp-admin|wp-login|phpmyadmin|adminer|manager\/html)/i,
  /<script|onerror=/i,    // basic XSS probe in URL
  /union.*select|or.*1=1/i, // SQL injection probe in URL
];

// ─── In-process state (falls back to this if Redis is unavailable) ────────────
const _mem = {
  bans:   new Map(), // ip -> expiresAt timestamp
  warns:  new Map(), // ip -> { count, expiresAt }
  rapid:  new Map(), // `${ip}:${path}` -> { count, expiresAt }
};

function _memClean() {
  const now = Date.now();
  for (const [k, v] of _mem.bans)   if (now > v)            _mem.bans.delete(k);
  for (const [k, v] of _mem.warns)  if (now > v.expiresAt)  _mem.warns.delete(k);
  for (const [k, v] of _mem.rapid)  if (now > v.expiresAt)  _mem.rapid.delete(k);
}
setInterval(_memClean, 60_000).unref?.();

// ─── Ban helpers ──────────────────────────────────────────────────────────────
async function isBanned(ip) {
  const key = `sec:ban:${ip}`;
  const v   = await redis.get(key);
  if (v) return true;
  // Permanent / long-term blocklist stored in MongoDB
  try {
    const entry = await Blocklist.findOne({
      type:  'ip',
      value: ip,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    }).lean();
    if (entry) return true;
  } catch { /* DB unavailable — fall through to in-memory */ }
  // in-memory fallback
  const e = _mem.bans.get(ip);
  return e && Date.now() < e;
}

async function ban(ip, reason) {
  const key = `sec:ban:${ip}`;
  await redis.set(key, '1', BAN_TTL);
  _mem.bans.set(ip, Date.now() + BAN_TTL * 1000);
  console.warn(`[security] BANNED ${ip} for ${BAN_MINUTES}min — ${reason}`);
}

// ─── Warn counter ─────────────────────────────────────────────────────────────
async function addWarn(ip, reason) {
  const key  = `sec:warn:${ip}`;
  const cnt  = await redis.incrWithExpiry(key, 3600); // warns reset after 1h
  // in-memory mirror
  const prev = _mem.warns.get(ip) || { count: 0, expiresAt: Date.now() + 3600_000 };
  prev.count++;
  _mem.warns.set(ip, prev);
  console.warn(`[security] WARN (${cnt}/${BAN_THRESHOLD}) ${ip} — ${reason}`);
  if (cnt >= BAN_THRESHOLD) {
    await ban(ip, `${reason} (warn limit reached)`);
    return true; // banned
  }
  return false;
}

// ─── Rapid identical request detector ────────────────────────────────────────
async function checkRapid(ip, path) {
  const key  = `sec:rapid:${ip}:${path.slice(0, 80)}`;
  const cnt  = await redis.incrWithExpiry(key, WARN_WINDOW_S);
  if (cnt >= WARN_THRESHOLD) return true;
  return false;
}

// ─── Extract real IP ──────────────────────────────────────────────────────────
function realIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
      || req.socket?.remoteAddress
      || '0.0.0.0';
}

// ─── trafficGuard middleware ──────────────────────────────────────────────────
async function trafficGuard(req, res, next) {
  if (!ENABLED) return next();

  // Skip internal mesh calls (they use HMAC auth already)
  if (req.path.startsWith('/api/mesh') || req.path === '/health') return next();

  const ip = realIp(req);
  const ua = (req.headers['user-agent'] || '').toLowerCase();

  // 1. Check if already banned
  if (await isBanned(ip)) {
    return res.status(429).json({
      error:   'Too many requests',
      message: 'Your IP has been temporarily blocked. Please try again later.',
      retryAfterMinutes: BAN_MINUTES,
    });
  }

  // 2. Suspicious user-agent
  const badUa = BAD_UA_PATTERNS.some(p => ua.includes(p));
  if (badUa) {
    const banned = await addWarn(ip, `bad UA: ${ua.slice(0, 60)}`);
    if (banned) return res.status(403).json({ error: 'Forbidden' });
  }

  // 3. Path fuzzing
  const fuzz = FUZZ_PATTERNS.some(p => p.test(req.url));
  if (fuzz) {
    const banned = await addWarn(ip, `path fuzz: ${req.url.slice(0, 80)}`);
    if (banned) return res.status(403).json({ error: 'Forbidden' });
    // Even on first fuzz attempt return 404 to not reveal what exists
    return res.status(404).json({ error: 'Not found' });
  }

  // 4. Rapid identical requests
  if (req.method === 'GET' && req.path.length > 1) {
    const rapid = await checkRapid(ip, req.path);
    if (rapid) {
      const banned = await addWarn(ip, `rapid: ${req.method} ${req.path.slice(0, 60)}`);
      if (banned) return res.status(429).json({ error: 'Too many requests' });
    }
  }

  // 5. Oversized payload probe on non-upload routes
  const cl = parseInt(req.headers['content-length'] || '0', 10);
  const isUpload = req.path.includes('/upload') || req.path.includes('/cover');
  if (!isUpload && cl > 2 * 1024 * 1024) { // 2 MB on non-upload routes
    const banned = await addWarn(ip, `oversized: ${cl} bytes on ${req.path.slice(0, 60)}`);
    if (banned) return res.status(413).json({ error: 'Payload too large' });
  }

  next();
}

// ─── Upload file scanner ──────────────────────────────────────────────────────
// Extensions that are dangerous regardless of declared MIME type
const BLOCKED_EXTENSIONS = new Set([
  'exe','bat','cmd','com','scr','pif','vbs','vbe','js','jse','ws','wsh',
  'msi','msp','msc','ps1','ps2','psm1','psd1','ps1xml','ps2xml',
  'psc1','psc2','msh','msh1','msh2','mshxml','msh1xml','msh2xml',
  'sh','bash','zsh','csh','ksh','fish','py','pyc','pyw','rb','pl',
  'php','php3','php4','php5','php7','phtml','phar','asp','aspx',
  'jsp','cfm','htaccess','jar','class','war','dll','so','dylib',
]);

// MIME types that must not appear for image/document uploads
const DANGEROUS_MIMES = new Set([
  'application/x-msdownload','application/x-executable',
  'application/x-dosexec','application/x-sh','application/x-shellscript',
  'text/x-shellscript','text/x-php','application/x-php',
  'application/java-archive','application/x-java-class',
]);

// Expected MIME prefixes by extension group
const MIME_MAP = {
  jpg:  'image/', jpeg: 'image/', png:  'image/', gif:  'image/',
  webp: 'image/', svg: 'image/', bmp:  'image/',
  pdf:  'application/pdf',
  doc:  'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml',
  xls:  'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml',
  ppt:  'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml',
  txt:  'text/plain',
  csv:  'text/csv',
  zip:  'application/zip',
};

function scanUpload(file) {
  if (!file) return { ok: false, reason: 'No file provided' };

  const name      = (file.originalname || file.filename || '').toLowerCase();
  const ext       = name.split('.').pop() || '';
  const mime      = (file.mimetype || '').toLowerCase();

  // 1. Block dangerous extensions
  if (BLOCKED_EXTENSIONS.has(ext)) {
    return { ok: false, reason: `File extension .${ext} is not allowed` };
  }

  // 2. Block dangerous MIME types
  if (DANGEROUS_MIMES.has(mime)) {
    return { ok: false, reason: `MIME type ${mime} is not allowed` };
  }

  // 3. Check MIME vs extension mismatch for known types
  const expectedMimePrefix = MIME_MAP[ext];
  if (expectedMimePrefix && !mime.startsWith(expectedMimePrefix)) {
    // Allow application/octet-stream as a generic fallback from browsers
    if (mime !== 'application/octet-stream') {
      return {
        ok:     false,
        reason: `MIME mismatch: .${ext} file declared as ${mime}`,
      };
    }
  }

  return { ok: true };
}

module.exports = { trafficGuard, scanUpload };
