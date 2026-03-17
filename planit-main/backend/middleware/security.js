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

// ─── Known scanner / exploit user-agent fragments ─────────────────────────────
// Covers version-agnostic prefixes so new releases are blocked automatically.
const BAD_UA_PATTERNS = [
  // core scanners / vulnerability scanners / fuzzers
  'sqlmap', 'nikto', 'masscan', 'nmap', 'zgrab', 'zmap', 'dirbuster',
  'dirb', 'gobuster', 'wfuzz', 'fuzz', 'fuzzer', 'fuzzing', 'ffuf',
  'acunetix', 'netsparker', 'appscan', 'openvas', 'nessus', 'burpsuite',
  'burst', 'burp', 'arachni', 'wpscan', 'whatweb', 'theharvester', 'fierce',
  'amap', 'venus', 'acunetix', 'scan', 'vscan', 'scanner',

  // bruteforce / auth / credential tools
  'hydra', 'medusa', 'patator', 'crowbar', 'brutus', 'ncrack',

  // HTTP libraries / language clients (version-agnostic)
  'python-requests', 'python-urllib', 'python-urllib3', 'python-httplib',
  'python-requests/', 'python-requests\\/', 'python-requests ', // variations
  'httpx/', 'aiohttp/', 'asyncio', 'urllib/', 'urllib3',
  'libwww-perl', 'lwp-useragent', 'perl', 'go-http-client', 'go-http-client/',
  'golang', 'golang-http', 'java/', 'okhttp/', 'okhttp', 'curl/', 'wget/',
  'libcurl', 'pycurl', 'php/', 'php7', 'php5', 'php-curl', 'php-requests',
  'node-fetch', 'node.js', 'nodejs', 'axios/', 'got/', 'unirest',

  // crawlers / scrapers / bots
  'scrapy/', 'mechanize', 'httpclient', 'crawler', 'spider', 'bot', 'robot',
  'facebookexternalhit', 'facebookcatalog', 'linkedinbot', 'slurp', 'bingbot',
  'googlebot', 'applebot', 'duckduckgo', 'baiduspider', 'yandex',

  // security tools / proxies / scanners
  'fiddler', 'httpry', 'burp-suite', 'burp', 'mitmproxy', 'mitm', 'zaproxy',
  'owasp-zap', 'nessus', 'nuclei', 'nuclei-scan', 'metallica', 'metasploit',

  // misc suspicious fragments
  'scan', 'securityscanner', 'pentest', 'pentester', 'recon', 'recon-ng',
  'blackwidow', 'havij', 'netsparker', 'acunetix', 'uniscan', 'webinspect'
];

// ─── Path patterns that real users never send ─────────────────────────────────
const FUZZ_PATTERNS = [
  // Local file / traversal / LFI / RFI / dotfiles
  /\.\.(\/|\\)/,                            // path traversal
  /%2e%2e|%252e%252e/i,                    // double-encoded ../
  /\/(\.git|\.svn|\.hg|CVS)\/?/i,
  /\/\.env\b/i,
  /\/\.(htaccess|htpasswd|DS_Store|bash_history)\b/i,
  /\/(composer\.json|composer\.lock|package\.json|package-lock\.json)\b/i,
  /\/(config\.php|wp-config\.php|\.user\.ini)\b/i,
  /\/(phpunit|phpmyadmin|pma|adminer|sqladmin|phpmyadmin|\bphpmyadmin\b)/i,
  /\/(phpinfo\.php|info\.php)\b/i,
  /\/(backup|backups|bak|old|archive)\/?/i,
  /\.(bak|old|orig|save|sql|tar|gz|zip|7z|rar)$/i,

  // common webshell / uploader names
  /(cmd|shell|r57|c99|wso|m00t)\.php/i,
  /eval\(|base64_decode\(|system\(|exec\(|passthru\(|shell_exec\(|popen\(/i,

  // SQL injection probes (classic + payload fingerprints)
  /union(\s+all)?\s+select/i,
  /select\s+.*\s+from\s+/i,
  /information_schema/i,
  /concat\(|group_concat\(/i,
  /load_file\(|into\s+outfile/i,
  /(or|and)\s+1\s*=\s*1\b/i,
  /benchmark\(|sleep\(|pg_sleep\(|WAITFOR\s+DELAY/i,
  /xp_cmdshell\b/i,
  /--\s*$/i,                       // SQL comment at end
  /\/\*!\d+/i,                     // MySQL versioned comments

  // XSS / script injection attempts (in path or query)
  /<script\b/i,
  /<iframe\b/i,
  /<svg\b.*onload\b/i,
  /onerror=|onload=|onmouseover=|onfocus=/i,
  /javascript:\s*alert\(/i,
  /prompt\(|confirm\(|console\.log\(/i,
  /document\.cookie/i,

  // common file / config leaks
  /\/etc\/(passwd|shadow|hosts)/i,
  /\/proc\/self\/environ/i,
  /\/wp-admin\/|\/wp-login\.php/i,
  /\/(administrator|administrator\/index\.php|administrator\/components\/com_)/i, // Joomla
  /\/manager\/html\b/i,            // Tomcat manager
  /\/(vendor|node_modules|\.idea|\.vscode)\/?/i,
  /(\.git\/HEAD|\.git\/config|\.git\/index)$/i,

  // file include / remote include attempts
  /(https?:\/\/|ftp:\/\/)[^\s'"]+/i,   // remote URLs in path
  /(\.\.\/|\.\.\\).*(http|ftp|php|data):/i,
  /php:\/\/input/i,

  // dangerous parameters & patterns often used by scanners
  /(\?|&)(cmd|command|exec|system|eval|file|path|phpinfo|download|sql)=/i,
  /(\?|&)(GLOBALS|_REQUEST|_SESSION|_GET|_POST)=/i,
  /(\?|&)(base64|data)=[A-Za-z0-9+\/=]{16,}/i, // big base64 chunks in URL
  /(\?|&)redirect=(http|https):/i, // open redirect probes

  // attempts to access backup / sensitive filenames
  /\/(backup|db_backup|dump|dump.sql|backup\.sql)$/i,
  /\.(sql|env|ini|conf|pem|key|pfx|crt|bak)$/i,

  // scanning / fuzzing payload signatures
  /(dirsearch|dirb|gobuster|ffuf|wfuzz|fuzzer|fuzzing|nuclei|nmap|masscan|zgrab)/i,
  /(\bHEAD\b|\bOPTIONS\b|\bTRACE\b)\s+/i, // unusual method probes in path-like strings

  // attempts to trigger template engines / SSRF / prototype pollution
  /__proto__|constructor\.prototype|prototype\./i,
  /\{\{.*\}\}|\{\%.*\%\}|\<\?php/i,

  // RCE / OS command indicators in URL path/query
  /\b(sh\b|bash\b|pwsh\b|powershell\b|cmd\.exe)\b/i,
  /(curl|wget)\s+http/i,

  // short heuristics to catch typical noisy probes
  /(etc\/passwd|/etc/passwd|/etc/shadow)/i,
  /\/\?.*=/i // generic querystring with suspicious payloads
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
// Use req.ip which is already normalised by Express's trust-proxy logic.
// Never read X-Forwarded-For directly — it is fully spoofable by attackers.
function realIp(req) {
  return req.ip || req.socket?.remoteAddress || '0.0.0.0';
}

// ─── trafficGuard middleware ──────────────────────────────────────────────────
async function trafficGuard(req, res, next) {
  if (!ENABLED) return next();

  // Skip internal mesh calls (they use HMAC auth already)
  if (req.path.startsWith('/api/mesh') || req.path === '/health') return next();

  const ip = realIp(req);

  // Whitelisted IPs bypass all checks — use SECURITY_WHITELIST_IPS env var
  if (WHITELIST_IPS.size > 0 && WHITELIST_IPS.has(ip)) return next();
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

  // M3: Warn on missing / suspiciously short User-Agent (strong bot signal)
  if (!ua || ua.length < 5) {
    const banned = await addWarn(ip, 'missing/empty user-agent');
    if (banned) return res.status(403).json({ error: 'Forbidden' });
  }

  // 3. Path fuzzing — check both raw URL and percent-decoded URL (H1 fix)
  const decodedUrl = (() => { try { return decodeURIComponent(req.url); } catch { return req.url; } })();
  const fuzz = FUZZ_PATTERNS.some(p => p.test(req.url) || p.test(decodedUrl));
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
