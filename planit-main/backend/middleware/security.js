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
 *   SECURITY_WHITELIST_IPS        Comma-separated IPs to bypass all checks
 *   SECURITY_MONITOR_PATHS        Comma-separated extra paths that skip UA/fuzz
 *                                 checks (e.g. '/ping,/status'). /health, /ping,
 *                                 and /status are always included.
 */

const redis     = require('../services/redisClient');
const Blocklist = require('../models/Blocklist');

const ENABLED        = process.env.SECURITY_ENABLED !== 'false';
// Comma-separated list of IPs to completely bypass trafficGuard.
// Set SECURITY_WHITELIST_IPS in Render env vars to unblock yourself.
// e.g. SECURITY_WHITELIST_IPS=1.2.3.4,5.6.7.8
const WHITELIST_IPS  = new Set(
  (process.env.SECURITY_WHITELIST_IPS || '').split(',').map(s => s.trim()).filter(Boolean)
);
const BAN_MINUTES    = parseInt(process.env.SECURITY_BAN_MINUTES    || '30',  10);
const WARN_WINDOW_S  = parseInt(process.env.SECURITY_WARN_WINDOW_S  || '10',  10);
const WARN_THRESHOLD = parseInt(process.env.SECURITY_WARN_THRESHOLD || '25',  10);
const BAN_THRESHOLD  = parseInt(process.env.SECURITY_BAN_THRESHOLD  || '5',   10);
const BAN_TTL        = BAN_MINUTES * 60;

// ─── Loopback addresses — always bypass all checks ────────────────────────────
// Covers self-pings and internal health checks originating from the same process
// or the same host (e.g. your own API calling itself).
const LOOPBACK_IPS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

// ─── Paths that skip UA / fuzz / rapid / payload checks ──────────────────────
// These paths still respect the ban list, but are otherwise unchecked so that
// uptime monitors hitting /health, /ping, or /status are never penalised.
// Add your own via SECURITY_MONITOR_PATHS env var (comma-separated).
const MONITOR_PATHS = new Set([
  '/health', '/ping', '/status',
  ...(process.env.SECURITY_MONITOR_PATHS || '')
    .split(',').map(s => s.trim()).filter(Boolean),
]);

// ─── Legitimate monitoring / uptime-bot UA substrings ────────────────────────
// Checked BEFORE the bad-UA list so that services whose UA contains 'bot'
// (e.g. UptimeRobot) are never accidentally warned or banned.
const GOOD_UA_PATTERNS = [
  'uptimerobot',   // UptimeRobot/2.0; +https://uptimerobot.com
  'pingdom',       // Pingdom.com_bot
  'statuscake',    // StatusCake
  'freshping',     // Freshping
  'site24x7',      // Site24x7
  'hetrixtools',   // HetrixTools
  'betteruptime',  // BetterUptime
  'hyperping',     // Hyperping
  'updown.io',     // updown.io daemon
  'checkly',       // Checkly
  'nodeping',      // NodePing
  'nodebing',
  'datadog',       // Datadog synthetics
  'newrelic',      // New Relic synthetics
  'googlebot',     // Google crawler
  'bingbot',       // Bing crawler
  'applebot',      // Apple crawler
];

// ─── Known scanner / exploit user-agent fragments ─────────────────────────────
// Covers version-agnostic prefixes so new releases are blocked automatically.
// NOTE: 'bot' is intentionally kept here — legitimate monitoring bots are
// caught by GOOD_UA_PATTERNS above and bypass this list entirely.
const BAD_UA_PATTERNS = [
  // scanners / fuzzers
  'sqlmap', 'nikto', 'masscan', 'nmap', 'zgrab', 'zmap',
  'dirbuster', 'dirb', 'gobuster', 'wfuzz', 'ffuf',
  'acunetix', 'netsparker', 'appscan', 'openvas', 'nessus',
  'burpsuite', 'arachni', 'wpscan', 'whatweb', 'nuclei',

  // bruteforce tools
  'hydra', 'medusa', 'patator', 'crowbar', 'ncrack',

  // scripting / http clients
  'python-requests', 'python-urllib', 'urllib', 'urllib3',
  'httpx/', 'aiohttp/', 'libwww-perl', 'lwp-useragent',
  'go-http-client', 'okhttp/', 'okhttp',
  'curl/', 'wget/', 'libcurl', 'pycurl',
  'node-fetch', 'axios/', 'got/', 'unirest',

  // languages (sometimes noisy — use carefully)
  'java/', 'php/', 'perl',

  // scraping / bots
  'scrapy/', 'mechanize', 'crawler', 'spider', 'bot',

  // security / proxy tools
  'burp', 'zaproxy', 'owasp-zap', 'mitmproxy', 'mitm',
  'fiddler', 'metasploit',

  // recon / misc
  'recon', 'recon-ng', 'theharvester', 'fierce',
  'blackwidow', 'uniscan', 'havij',

  // generic suspicious terms
  'scanner', 'scan', 'fuzz', 'fuzzer', 'pentest'
];

// ─── Path patterns that real users never send ─────────────────────────────────
const FUZZ_PATTERNS = [
  // traversal / encoding tricks
  /\.\.(\/|\\)/,
  /%2e%2e|%252e%252e/i,

  // sensitive dirs / dotfiles
  /\/(\.git|\.svn|\.hg|CVS)\/?/i,
  /\/\.env\b/i,
  /\/\.(htaccess|htpasswd|DS_Store|bash_history)\b/i,

  // project / config leaks
  /\/(composer\.json|composer\.lock|package\.json|package-lock\.json)\b/i,
  /\/(config\.php|wp-config\.php|\.user\.ini)\b/i,

  // admin panels
  /\/(phpmyadmin|pma|adminer|sqladmin)\b/i,
  /\/wp-admin\/|\/wp-login\.php/i,
  /\/manager\/html\b/i,

  // debug/info files
  /\/(phpinfo\.php|info\.php)\b/i,

  // backups / archives
  /\/(backup|backups|bak|old|archive)\/?/i,
  /\.(bak|old|orig|save|sql|tar|gz|zip|7z|rar)$/i,

  // webshell / RCE indicators
  /(cmd|shell|r57|c99|wso)\.php/i,
  /eval\(|base64_decode\(|system\(|exec\(|passthru\(|shell_exec\(|popen\(/i,

  // SQLi
  /union(\s+all)?\s+select/i,
  /select\s+.*\s+from\s+/i,
  /information_schema/i,
  /concat\(|group_concat\(/i,
  /load_file\(|into\s+outfile/i,
  /(or|and)\s+1\s*=\s*1\b/i,
  /benchmark\(|sleep\(|pg_sleep\(|WAITFOR\s+DELAY/i,
  /xp_cmdshell\b/i,
  /--\s*$/i,
  /\/\*!\d+/i,

  // XSS
  /<script\b/i,
  /<iframe\b/i,
  /<svg\b.*onload\b/i,
  /onerror=|onload=|onmouseover=|onfocus=/i,
  /javascript:\s*alert\(/i,
  /document\.cookie/i,

  // system file access
  /\/etc\/(passwd|shadow|hosts)/i,
  /\/proc\/self\/environ/i,

  // sensitive dirs
  /\/(vendor|node_modules|\.idea|\.vscode)\/?/i,
  /(\.git\/HEAD|\.git\/config|\.git\/index)$/i,

  // SSRF / file inclusion
  /(https?:\/\/|ftp:\/\/)[^\s'"]+/i,
  /(\.\.\/|\.\.\\).*(http|ftp|php|data):/i,
  /php:\/\/input/i,

  // dangerous params
  /(\?|&)(cmd|command|exec|system|eval|file|path|phpinfo|download|sql)=/i,
  /(\?|&)(GLOBALS|_REQUEST|_SESSION|_GET|_POST)=/i,
  /(\?|&)(base64|data)=[A-Za-z0-9+/=]{16,}/i,
  /(\?|&)redirect=(http|https):/i,

  // more file leaks
  /\.(sql|env|ini|conf|pem|key|pfx|crt)$/i,

  // scanner fingerprints
  /(dirsearch|dirb|gobuster|ffuf|wfuzz|nuclei|nmap|masscan|zgrab)/i,

  // prototype pollution / template injection
  /__proto__|constructor\.prototype|prototype\./i,
  /\{\{.*\}\}|\{\%.*\%\}|\<\?php/i,

  // command execution hints
  /\b(sh|bash|pwsh|powershell|cmd\.exe)\b/i,
  /(curl|wget)\s+http/i,

  // generic suspicious query
  /\/\?.*=/i
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
  const key = `sec:rapid:${ip}:${path.slice(0, 80)}`;
  const cnt = await redis.incrWithExpiry(key, WARN_WINDOW_S);
  if (cnt >= WARN_THRESHOLD) return true;
  return false;
}

// ─── Extract real IP ──────────────────────────────────────────────────────────
// Use req.ip which is already normalised by Express's trust-proxy logic.
// Never read X-Forwarded-For directly — it is fully spoofable by attackers.
function realIp(req) {
  return req.ip || req.socket?.remoteAddress || '0.0.0.0';
}

// ─── trafficGuard middleware ──────────────────────────────────────────────────
async function trafficGuard(req, res, next) {
  if (!ENABLED) return next();

  // Skip internal mesh calls (they use HMAC auth already)
  if (req.path.startsWith('/api/mesh')) return next();

  const ip = realIp(req);

  // ── Loopback: self-pings and internal health checks ───────────────────────
  // 127.0.0.1 / ::1 are never subject to any security checks.
  if (LOOPBACK_IPS.has(ip)) return next();

  // ── Explicit IP whitelist ─────────────────────────────────────────────────
  if (WHITELIST_IPS.size > 0 && WHITELIST_IPS.has(ip)) return next();

  // ── Ban list: always enforced, even for monitor paths ─────────────────────
  if (await isBanned(ip)) {
    return res.status(429).json({
      error:   'Too many requests',
      message: 'Your IP has been temporarily blocked. Please try again later.',
      retryAfterMinutes: BAN_MINUTES,
    });
  }

  // ── Monitor / health paths: skip all further checks ──────────────────────
  // Uptime monitors (UptimeRobot, Pingdom, etc.) typically hit /health or
  // /ping on a fixed interval. Skipping UA + fuzz + rapid checks here means
  // they can never accumulate warns regardless of their user-agent string.
  if (MONITOR_PATHS.has(req.path)) return next();

  const ua = (req.headers['user-agent'] || '').toLowerCase();

  // 2. Suspicious user-agent — allow known legitimate monitors first so that
  //    services whose UA contains 'bot' (UptimeRobot, Googlebot, etc.) are
  //    never accidentally warned or banned.
  const goodUa = GOOD_UA_PATTERNS.some(p => ua.includes(p));
  if (!goodUa) {
    const badUa = BAD_UA_PATTERNS.some(p => ua.includes(p));
    if (badUa) {
      const banned = await addWarn(ip, `bad UA: ${ua.slice(0, 60)}`);
      if (banned) return res.status(403).json({ error: 'Forbidden' });
    }

    // Warn on missing / suspiciously short User-Agent (strong bot signal)
    if (!ua || ua.length < 5) {
      const banned = await addWarn(ip, 'missing/empty user-agent');
      if (banned) return res.status(403).json({ error: 'Forbidden' });
    }
  }

  // 3. Path fuzzing — check both raw URL and percent-decoded URL
  const decodedUrl = (() => { try { return decodeURIComponent(req.url); } catch { return req.url; } })();
  const fuzz = FUZZ_PATTERNS.some(p => p.test(req.url) || p.test(decodedUrl));
  if (fuzz) {
    const banned = await addWarn(ip, `path fuzz: ${req.url.slice(0, 80)}`);
    if (banned) return res.status(403).json({ error: 'Forbidden' });
    // Return 404 on first fuzz attempt to not reveal what exists
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

  const name = (file.originalname || file.filename || '').toLowerCase();
  const ext  = name.split('.').pop() || '';
  const mime = (file.mimetype || '').toLowerCase();

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
