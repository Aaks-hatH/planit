'use strict';
/*
 * PLANIT PROPRIETARY LICENSE
 * Copyright (c) 2026 Aakshat Hariharan. All rights reserved.
 */

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
 *       - AbuseIPDB pre-check       (score >= threshold → immediate ban)
 *
 * 2.  scanUpload(file) — call before every Cloudinary upload.
 *     Returns { ok: true } or { ok: false, reason: string }.
 *     Blocks:
 *       - Executable / scripting extensions
 *       - MIME type mismatches
 *
 * Cat-4 additions (2026):
 *   - tarpitIncrement() called on every warn and ban so suspicious IPs
 *     get progressively slower responses even before the hard ban fires.
 *   - checkAbuseIPDB() called after the ban-list check so known-malicious
 *     IPs are pre-banned before they do anything on the platform.
 *   - reportToAbuseIPDB() called inside ban() so every ban contributes
 *     to the community threat database.
 *   - ban() and isBanned() now exported so honeypot.js can call them directly.
 *
 * Env vars (all optional, safe defaults):
 *   SECURITY_ENABLED        'true' (set to 'false' to disable entirely)
 *   SECURITY_BAN_MINUTES    30
 *   SECURITY_WARN_WINDOW_S  10    (seconds window for rapid-request detection)
 *   SECURITY_WARN_THRESHOLD 25    (identical requests in window before WARN)
 *   SECURITY_BAN_THRESHOLD   5    (WARNs before temporary BAN)
 *   SECURITY_WHITELIST_IPS        Comma-separated IPs to bypass all checks
 *   SECURITY_MONITOR_PATHS        Comma-separated extra paths that skip ALL checks
 *   ABUSEIPDB_API_KEY             API key — if unset, pre-check is a no-op
 *   ABUSEIPDB_BLOCK_SCORE         Confidence % to pre-ban on (default: 75)
 */

const redis     = require('../services/redisClient');
const Blocklist = require('../models/Blocklist');
const { realIp: resolveRealIp, isPrivate } = require('./realIp');

// ── Cat-4 integrations ────────────────────────────────────────────────────────
// Both modules degrade gracefully if their env vars are not set.
const { tarpitIncrement, tarpitReset }          = require('./tarpit');
const { checkAbuseIPDB, reportToAbuseIPDB, reasonToCategories } = require('./abuseipdb');

const ENABLED        = process.env.SECURITY_ENABLED !== 'false';
const WHITELIST_IPS  = new Set(
  (process.env.SECURITY_WHITELIST_IPS || '').split(',').map(s => s.trim()).filter(Boolean)
);
const BAN_MINUTES    = parseInt(process.env.SECURITY_BAN_MINUTES    || '30',  10);
const WARN_WINDOW_S  = parseInt(process.env.SECURITY_WARN_WINDOW_S  || '10',  10);
const WARN_THRESHOLD = parseInt(process.env.SECURITY_WARN_THRESHOLD || '25',  10);
const BAN_THRESHOLD  = parseInt(process.env.SECURITY_BAN_THRESHOLD  || '5',   10);
const BAN_TTL        = BAN_MINUTES * 60;

// ─── Loopback addresses ───────────────────────────────────────────────────────
const LOOPBACK_IPS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

// ─── Paths exempt from every check including ban list ─────────────────────────
// Watchdog pings /api/health every 30 s. Banning its IP would mark the backend
// down, create incidents, and spam ntfy. These paths bypass everything.
const MONITOR_PATHS = new Set([
  '/health',      '/api/health',
  '/ping',        '/api/ping',
  '/status',      '/api/status',
  '/uptime/ping', '/api/uptime/ping',
  ...(process.env.SECURITY_MONITOR_PATHS || '')
    .split(',').map(s => s.trim()).filter(Boolean),
]);

// ─── Path prefixes exempt from all checks ─────────────────────────────────────
// Socket.IO long-polling sends GET /socket.io/?EIO=4&transport=polling every
// 1-2 s per connected client. Without this exemption:
//   - The query-string fuzz check fires on every poll (matches /?param=value)
//   - The rapid-request detector fires (25+ identical GETs per 10 s is normal)
// Both would accumulate warns and ban every user with an active event tab.
// Mesh calls are HMAC-authenticated — exempt here as belt-and-suspenders.
const EXEMPT_PREFIXES = [
  '/socket.io',
  '/api/mesh',
  '/mesh/',
];

// ─── Legitimate monitoring UA substrings ─────────────────────────────────────
const GOOD_UA_PATTERNS = [
  'uptimerobot', 'axios/', 'pingdom', 'statuscake', 'freshping',
  'site24x7', 'hetrixtools', 'betteruptime', 'hyperping', 'updown.io',
  'checkly', 'nodeping', 'nodebing', 'datadog', 'newrelic',
  'googlebot', 'bingbot', 'applebot',
];

// ─── Known scanner / exploit UA fragments ────────────────────────────────────
const BAD_UA_PATTERNS = [
  'sqlmap', 'nikto', 'masscan', 'nmap', 'zgrab', 'zmap',
  'dirbuster', 'dirb', 'gobuster', 'wfuzz', 'ffuf',
  'acunetix', 'netsparker', 'appscan', 'openvas', 'nessus',
  'burpsuite', 'arachni', 'wpscan', 'whatweb', 'nuclei',
  'hydra', 'medusa', 'patator', 'crowbar', 'ncrack',
  'python-requests', 'python-urllib', 'urllib', 'urllib3',
  'httpx/', 'aiohttp/', 'libwww-perl', 'lwp-useragent',
  'go-http-client', 'okhttp/', 'okhttp',
  'curl/', 'wget/', 'libcurl', 'pycurl',
  'node-fetch', 'got/', 'unirest',
  'java/', 'php/', 'perl',
  'scrapy/', 'mechanize', 'crawler', 'spider', 'bot',
  'burp', 'zaproxy', 'owasp-zap', 'mitmproxy', 'mitm',
  'fiddler', 'metasploit',
  'recon', 'recon-ng', 'theharvester', 'fierce',
  'blackwidow', 'uniscan', 'havij',
  'scanner', 'scan', 'fuzz', 'fuzzer', 'pentest',
];

// ─── Path fuzz patterns ───────────────────────────────────────────────────────
//
// REMOVED patterns that caused false bans:
//
//   /\/\?.*=/i  — matched /socket.io/?EIO=4&transport=polling → banned every
//                 user with an open event tab. GONE.
//
//   file|path|download in params pattern — matched legitimate upload/download
//                 API routes. GONE.
//
//   _GET|_POST|_REQUEST — too broad, appeared in legit debug output. GONE.
//
//   redirect=(http|https): — now requires a path separator after the colon so
//                 relative redirects like ?redirect=/dashboard don't match.
//
const FUZZ_PATTERNS = [
  // traversal
  /\.\.(\\/|\\)/,
  /%2e%2e|%252e%252e/i,

  // sensitive dotfiles / dirs
  /(\/\.git|\/\.svn|\/\.hg|\/CVS)\/?/i,
  /\/\.env\b/i,
  /\/(\.htaccess|\.htpasswd|\.DS_Store|\.bash_history)\b/i,

  // project / config leaks
  /\/(composer\.json|composer\.lock|package\.json|package-lock\.json)\b/i,
  /\/(config\.php|wp-config\.php|\.user\.ini)\b/i,

  // non-planit admin panels
  /\/(phpmyadmin|pma|adminer|sqladmin)\b/i,
  /\/wp-admin\/|\/wp-login\.php/i,
  /\/manager\/html\b/i,

  // debug / info files
  /\/(phpinfo\.php|info\.php)\b/i,

  // backups / archives
  /\/(backup|backups|bak|old|archive)\/?/i,
  /\.(bak|old|orig|save|sql|tar|gz|zip|7z|rar)$/i,

  // webshell / RCE
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
  /(\.\.\/)|(\.\.\\).*(http|ftp|php|data):/i,
  /php:\/\/input/i,

  // dangerous params (surgical — no broad terms like file/path/download)
  /(\?|&)(cmd|command|exec|system|eval|phpinfo|sql)=/i,
  /(\?|&)(GLOBALS|_SESSION)=/i,
  /(\?|&)(base64|data)=[A-Za-z0-9+/=]{20,}/i,
  // open-redirect: only absolute external URLs (requires :// or :\\ after scheme)
  /(\?|&)redirect=(https?|ftp|javascript):[/\\]/i,

  // file leaks via extension
  /\.(sql|env|ini|conf|pem|key|pfx|crt)$/i,

  // scanner fingerprints in URL
  /(dirsearch|dirb|gobuster|ffuf|wfuzz|nuclei|nmap|masscan|zgrab)/i,

  // prototype pollution / template injection
  /__proto__|constructor\.prototype|prototype\./i,
  /\{\{.*\}\}|\{\%.*\%\}|\<\?php/i,

  // command execution hints
  /\b(sh|bash|pwsh|powershell|cmd\.exe)\b/i,
  /(curl|wget)\s+http/i,
];

// ─── In-process state (fallback when Redis unavailable) ──────────────────────
const _mem = {
  bans:   new Map(), // ip -> expiresAt ms
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
  // 1. Redis
  const v = await redis.get(`sec:ban:${ip}`);
  if (v) return true;

  // 2. MongoDB permanent blocklist
  try {
    const entry = await Blocklist.findOne({
      type:  'ip',
      value: ip,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    }).lean();
    if (entry) return true;
  } catch { /* DB unavailable */ }

  // 3. In-memory fallback
  const e = _mem.bans.get(ip);
  return !!(e && Date.now() < e);
}

async function ban(ip, reason) {
  await redis.set(`sec:ban:${ip}`, '1', BAN_TTL);
  _mem.bans.set(ip, Date.now() + BAN_TTL * 1000);
  console.warn(`[security] BANNED ${ip} for ${BAN_MINUTES}min — ${reason}`);

  // ── Cat-4: Push tarpit to max level ─────────────────────────────────────────
  // Even if somehow the ban check is bypassed (Redis outage, etc.), the
  // attacker's requests are slowed to 120s each. Increment multiple times
  // to guarantee reaching level 4 regardless of starting state.
  tarpitIncrement(ip).catch(() => {});
  tarpitIncrement(ip).catch(() => {});

  // ── Cat-4: Report to AbuseIPDB ──────────────────────────────────────────────
  // Fire-and-forget — never let this block or delay the ban.
  const cats = reasonToCategories(reason);
  reportToAbuseIPDB(
    ip,
    cats,
    `PlanIT TrafficGuard ban: ${reason.slice(0, 300)}`
  ).catch(() => {});
}

// ─── Warn counter ─────────────────────────────────────────────────────────────
async function addWarn(ip, reason) {
  const cnt = await redis.incrWithExpiry(`sec:warn:${ip}`, 3600);
  const prev = _mem.warns.get(ip) || { count: 0, expiresAt: Date.now() + 3600_000 };
  prev.count++;
  _mem.warns.set(ip, prev);
  console.warn(`[security] WARN (${cnt}/${BAN_THRESHOLD}) ${ip} — ${reason}`);

  // ── Cat-4: Increment tarpit on every warn ───────────────────────────────────
  // This makes suspicious IPs progressively slower BEFORE the hard ban fires.
  // At warn 1: +1s delay. At warn 3: +5s. At warn 6: +30s.
  // A normal user never gets a single warn, so they never get any delay.
  tarpitIncrement(ip).catch(() => {});

  if (cnt >= BAN_THRESHOLD) {
    await ban(ip, `${reason} (warn limit reached)`);
    return true;
  }
  return false;
}

// ─── Rapid identical request detector ────────────────────────────────────────
async function checkRapid(ip, path) {
  const cnt = await redis.incrWithExpiry(`sec:rapid:${ip}:${path.slice(0, 80)}`, WARN_WINDOW_S);
  return cnt >= WARN_THRESHOLD;
}

// ─── trafficGuard middleware ──────────────────────────────────────────────────
async function trafficGuard(req, res, next) {
  if (!ENABLED) return next();

  const p = req.path;

  // ── 1. Exempt path prefixes (socket.io, mesh) — checked before anything else
  if (EXEMPT_PREFIXES.some(prefix => p.startsWith(prefix))) return next();

  // ── 2. Monitor / health paths — exempt including ban list ────────────────
  // Must be before isBanned: a banned IP must still pass health checks or the
  // watchdog marks the backend down and triggers incident/alert spam.
  if (MONITOR_PATHS.has(p)) return next();

  // ── 3. Resolve real client IP ─────────────────────────────────────────────
  const ip = resolveRealIp(req);

  // ── 4. Private / unresolvable IP — never ban an internal address ──────────
  if (isPrivate(ip) || ip === 'unknown') return next();

  // ── 5. Loopback ───────────────────────────────────────────────────────────
  if (LOOPBACK_IPS.has(ip)) return next();

  // ── 6. Explicit allowlist ─────────────────────────────────────────────────
  if (WHITELIST_IPS.size > 0 && WHITELIST_IPS.has(ip)) return next();

  // ── 7. Ban check ──────────────────────────────────────────────────────────
  if (await isBanned(ip)) {
    return res.status(429).json({
      error:             'Too many requests',
      message:           'Your IP has been temporarily blocked. Please try again later.',
      retryAfterMinutes: BAN_MINUTES,
    });
  }

  // ── 7b. AbuseIPDB pre-check (Cat-4) ──────────────────────────────────────
  // Runs only on the first request from any new IP (result cached 1 hour).
  // For all subsequent requests from the same IP, this resolves from Redis
  // cache in ~5ms with no external API call and no quota consumed.
  // If ABUSEIPDB_API_KEY is not set, checkAbuseIPDB returns {skip:true}
  // immediately and this entire block is a no-op.
  {
    const abuse = await checkAbuseIPDB(ip);
    if (!abuse.skip && abuse.blocked) {
      await ban(ip, `abuseipdb:score=${abuse.score}:reports=${abuse.totalReports}:isp=${abuse.isp}`);
      return res.status(429).json({
        error:             'Too many requests',
        message:           'Your IP has been temporarily blocked. Please try again later.',
        retryAfterMinutes: BAN_MINUTES,
      });
    }
  }

  const ua = (req.headers['user-agent'] || '').toLowerCase();

  // ── 8. User-agent check ───────────────────────────────────────────────────
  const goodUa = GOOD_UA_PATTERNS.some(pat => ua.includes(pat));
  if (!goodUa) {
    if (BAD_UA_PATTERNS.some(pat => ua.includes(pat))) {
      const banned = await addWarn(ip, `bad UA: ${ua.slice(0, 60)}`);
      if (banned) return res.status(403).json({ error: 'Forbidden' });
    }
    if (!ua || ua.length < 5) {
      const banned = await addWarn(ip, 'missing/empty user-agent');
      if (banned) return res.status(403).json({ error: 'Forbidden' });
    }
  }

  // ── 9. Path fuzzing ───────────────────────────────────────────────────────
  const decodedUrl = (() => { try { return decodeURIComponent(req.url); } catch { return req.url; } })();
  if (FUZZ_PATTERNS.some(pat => pat.test(req.url) || pat.test(decodedUrl))) {
    const banned = await addWarn(ip, `path fuzz: ${req.url.slice(0, 80)}`);
    if (banned) return res.status(403).json({ error: 'Forbidden' });
    return res.status(404).json({ error: 'Not found' });
  }

  // ── 10. Rapid identical requests ─────────────────────────────────────────
  // Socket.IO already exited at step 1 so this never fires on polling.
  if (req.method === 'GET' && p.length > 1) {
    const rapid = await checkRapid(ip, p);
    if (rapid) {
      const banned = await addWarn(ip, `rapid: GET ${p.slice(0, 60)}`);
      if (banned) return res.status(429).json({ error: 'Too many requests' });
    }
  }

  // ── 11. Oversized payload probe ───────────────────────────────────────────
  const cl = parseInt(req.headers['content-length'] || '0', 10);
  const isUpload = p.includes('/upload') || p.includes('/cover');
  if (!isUpload && cl > 2 * 1024 * 1024) {
    const banned = await addWarn(ip, `oversized: ${cl} bytes on ${p.slice(0, 60)}`);
    if (banned) return res.status(413).json({ error: 'Payload too large' });
  }

  next();
}

// ─── Upload file scanner ──────────────────────────────────────────────────────
const BLOCKED_EXTENSIONS = new Set([
  'exe','bat','cmd','com','scr','pif','vbs','vbe','js','jse','ws','wsh',
  'msi','msp','msc','ps1','ps2','psm1','psd1','ps1xml','ps2xml',
  'psc1','psc2','msh','msh1','msh2','mshxml','msh1xml','msh2xml',
  'sh','bash','zsh','csh','ksh','fish','py','pyc','pyw','rb','pl',
  'php','php3','php4','php5','php7','phtml','phar','asp','aspx',
  'jsp','cfm','htaccess','jar','class','war','dll','so','dylib',
]);

const DANGEROUS_MIMES = new Set([
  'application/x-msdownload','application/x-executable',
  'application/x-dosexec','application/x-sh','application/x-shellscript',
  'text/x-shellscript','text/x-php','application/x-php',
  'application/java-archive','application/x-java-class',
]);

const MIME_MAP = {
  jpg: 'image/', jpeg: 'image/', png: 'image/', gif: 'image/',
  webp: 'image/', svg: 'image/', bmp: 'image/',
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

  if (BLOCKED_EXTENSIONS.has(ext))
    return { ok: false, reason: `File extension .${ext} is not allowed` };

  if (DANGEROUS_MIMES.has(mime))
    return { ok: false, reason: `MIME type ${mime} is not allowed` };

  const expectedMimePrefix = MIME_MAP[ext];
  if (expectedMimePrefix && !mime.startsWith(expectedMimePrefix) && mime !== 'application/octet-stream')
    return { ok: false, reason: `MIME mismatch: .${ext} file declared as ${mime}` };

  return { ok: true };
}

// ─── List active bans ─────────────────────────────────────────────────────────
// Merges Redis + in-memory so admins can see and clear ALL active bans.
// Previously in-memory bans (written during Redis outages) were invisible in
// the admin UI but still enforced — impossible to clear without a restart.
async function listActiveBans() {
  const result = [];
  const seen   = new Set();

  try {
    const keys = await redis.scan('sec:ban:*');
    for (const key of keys) {
      const ip  = key.replace(/^sec:ban:/, '');
      const ttl = await redis.ttl(key);
      seen.add(ip);
      result.push({
        ip,
        source:     'redis',
        ttlSeconds: ttl >= 0 ? ttl : null,
        expiresAt:  ttl >= 0 ? new Date(Date.now() + ttl * 1000).toISOString() : null,
      });
    }
  } catch { /* Redis unavailable */ }

  const now = Date.now();
  for (const [ip, exp] of _mem.bans) {
    if (now < exp && !seen.has(ip)) {
      result.push({
        ip,
        source:     'memory',
        ttlSeconds: Math.ceil((exp - now) / 1000),
        expiresAt:  new Date(exp).toISOString(),
      });
    }
  }

  return result.sort((a, b) => a.ip.localeCompare(b.ip));
}

// ─── Manual unban ─────────────────────────────────────────────────────────────
async function unbanIp(ip) {
  try {
    await redis.del(`sec:ban:${ip}`);
    _mem.bans.delete(ip);
    await redis.del(`sec:warn:${ip}`).catch(() => {});
    _mem.warns.delete(ip);
    // ── Cat-4: Reset tarpit on unban ─────────────────────────────────────────
    // When an admin unbans someone, reset their tarpit level too.
    // Otherwise an unbanned IP still gets 120s delays on every request.
    await tarpitReset(ip).catch(() => {});
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────────
// ban and isBanned are now exported so honeypot.js can call them directly
// without duplicating the ban logic.
module.exports = { trafficGuard, scanUpload, unbanIp, listActiveBans, ban, isBanned };
