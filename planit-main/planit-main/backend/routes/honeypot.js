'use strict';
/*
 * PLANIT PROPRIETARY LICENSE
 * Copyright (c) 2026 Aakshat Hariharan. All rights reserved.
 */

/**
 * routes/honeypot.js
 * ──────────────────
 * 30 deceptive trap routes that no real PlanIT user would ever visit.
 *
 * WHAT HAPPENS ON A HIT (all in parallel, ~5ms total)
 * ─────────────────────────────────────────────────────
 *   1. Full fingerprint logged: IP, UA, path, method, headers, body, query
 *   2. IP permanently banned in Redis (sec:ban:<ip> = 'honeypot', 30-day TTL)
 *   3. IP permanently added to MongoDB Blocklist (permanent: true)
 *   4. Tarpit pushed to max level (future requests from this IP: 120s delays)
 *   5. AbuseIPDB report filed (categories: Port Scan + Web App Attack)
 *   6. ntfy alert sent to your Watchdog topic
 *   7. Believable fake response sent — attacker thinks they found something real,
 *      wastes more time investigating a dead end.
 *
 * WHY ZERO FALSE POSITIVES
 * ─────────────────────────
 * These exact paths do not exist anywhere in PlanIT's real API surface.
 * No event organizer, staff member, or guest navigating the app normally
 * would ever request /.env, /wp-login.php, /phpmyadmin, or /actuator/env.
 *
 * Any hit is either:
 *   a) An automated scanner probing for known vulnerable software — ban.
 *   b) A human deliberately probing for vulnerabilities — ban.
 *   c) Someone who mis-typed a completely wrong URL — they get a believable
 *      page and their real IP still gets banned, but they weren't using the
 *      app anyway.
 *
 * MOUNTING IN server.js
 * ──────────────────────
 *   Mount AFTER trafficGuard (so already-banned IPs get caught first by the
 *   ban check) and BEFORE the /api/* catch-all 404 handler.
 *
 *   const honeypotRoutes = require('./routes/honeypot');
 *   app.use(trafficGuard);
 *   app.use(honeypotRoutes);       ← honeypots
 *   app.use('/api/', apiLimiter);  ← real routes follow
 *
 * ENV VARS (uses existing vars — no new ones needed)
 *   NTFY_URL      Your ntfy push notification URL (already set for bug reports)
 */

const express   = require('express');
const axios     = require('axios');
const Blocklist = require('../models/Blocklist');
const redis     = require('../services/redisClient');
const { realIp: resolveRealIp } = require('../middleware/realIp');
const { reportToAbuseIPDB }     = require('../middleware/abuseipdb');
const { tarpitIncrement }       = require('../middleware/tarpit');

const router = express.Router();

// ─── Configuration ────────────────────────────────────────────────────────────

const REDIS_BAN_TTL_S = 60 * 60 * 24 * 30; // 30-day Redis ban for honeypot hits

// ─── Core: fingerprint + ban + alert ─────────────────────────────────────────

/**
 * Called the moment any honeypot route receives a request.
 * Runs all side effects in parallel to keep response time natural.
 *
 * @param {object} req      Express request
 * @param {string} trapName Identifier for the specific trap that was hit
 */
async function processHoneypotHit(req, trapName) {
  const ip     = resolveRealIp(req);
  const ua     = req.headers['user-agent'] || '';
  const method = req.method;
  const path   = req.originalUrl;
  const ts     = Date.now();

  // ── Build forensic fingerprint ──────────────────────────────────────────────
  // Log everything — this is threat intelligence data.
  const fingerprint = {
    ts,
    trap:       trapName,
    ip,
    method,
    path,
    ua,
    referer:    req.headers['referer']         || null,
    acceptLang: req.headers['accept-language'] || null,
    xff:        req.headers['x-forwarded-for'] || null,
    ct:         req.headers['content-type']    || null,
    cl:         req.headers['content-length']  || null,
    // Truncated body — may contain credentials the attacker was testing
    body: req.body && Object.keys(req.body).length > 0
      ? JSON.stringify(req.body).slice(0, 500)
      : null,
    query: req.query && Object.keys(req.query).length > 0
      ? JSON.stringify(req.query).slice(0, 300)
      : null,
  };

  console.warn(`[honeypot] 🍯 HIT: ${trapName} — IP=${ip} PATH=${method} ${path}`);
  console.warn(`[honeypot] Fingerprint: ${JSON.stringify(fingerprint)}`);

  const reason = `Honeypot hit: ${trapName} (${method} ${path})`;

  // ── Run everything in parallel ──────────────────────────────────────────────
  // allSettled: one failure (e.g. MongoDB write error) doesn't block the rest
  await Promise.allSettled([

    // 1. Redis ban — immediate, 30-day TTL
    redis.set(`sec:ban:${ip}`, 'honeypot', REDIS_BAN_TTL_S),

    // 2. MongoDB permanent blocklist
    Blocklist.create({
      type:      'ip',
      value:     ip,
      reason:    `${reason} UA:${ua.slice(0, 120)}`,
      permanent: true,
      expiresAt: null,
      addedBy:   'honeypot-system',
    }).catch(err => {
      // Duplicate key (IP already in blocklist) is expected — not an error
      if (err.code !== 11000) {
        console.error('[honeypot] Blocklist write failed:', err.message);
      }
    }),

    // 3. Push tarpit to maximum level
    // Call increment 10 times to guarantee level 4 regardless of starting state
    (async () => {
      for (let i = 0; i < 10; i++) {
        await tarpitIncrement(ip).catch(() => {});
      }
    })(),

    // 4. AbuseIPDB report
    reportToAbuseIPDB(
      ip,
      [14, 21], // Port Scan + Web App Attack
      `Automated probe detected by PlanIT honeypot: ${method} ${path} (trap: ${trapName}). UA: ${ua.slice(0, 100)}`
    ),

    // 5. ntfy Watchdog alert
    _sendAlert(fingerprint, trapName),
  ]);
}

async function _sendAlert(fp, trapName) {
  const ntfyUrl = process.env.NTFY_URL;
  if (!ntfyUrl) return;

  const message =
    `🍯 Honeypot triggered: ${trapName}\n` +
    `IP: ${fp.ip}\n` +
    `Request: ${fp.method} ${fp.path}\n` +
    `User-Agent: ${(fp.ua || '(none)').slice(0, 100)}\n` +
    `Time: ${new Date(fp.ts).toISOString()}\n` +
    `Action: IP permanently banned + AbuseIPDB reported`;

  try {
    await axios.post(ntfyUrl, message, {
      headers: {
        'Title':        '🍯 Honeypot Hit — IP Banned',
        'Priority':     'high',
        'Tags':         'warning,honeybee,no_entry',
        'Content-Type': 'text/plain',
      },
      timeout: 5000,
    });
  } catch {
    // Non-critical — a failed alert must never affect the ban
  }
}

// ─── Route handler factory ────────────────────────────────────────────────────

/**
 * Creates an Express handler for a honeypot route.
 *
 * @param {string}   trapName  Identifier logged in the ban reason
 * @param {Function} respFn    Returns { type: 'html'|'text'|'json', status: number, body: any }
 */
function honeypot(trapName, respFn) {
  return async (req, res) => {
    // Fire ban/alert/log — don't await, let it run while we prepare the response
    processHoneypotHit(req, trapName).catch(err =>
      console.error('[honeypot] processHoneypotHit error:', err.message)
    );

    // Add a brief natural-feeling delay (200–900ms) to make automated
    // scanners believe they reached a real endpoint. This wastes more of
    // their time between requests.
    await new Promise(r => setTimeout(r, 200 + Math.floor(Math.random() * 700)));

    if (res.destroyed) return;

    const { type, status, body } = respFn();

    res.status(status);

    if (type === 'html') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8').send(body);
    } else if (type === 'text') {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8').send(body);
    } else if (type === 'xml') {
      res.setHeader('Content-Type', 'text/xml; charset=utf-8').send(body);
    } else {
      res.json(body);
    }
  };
}

// ─── Fake response generators ─────────────────────────────────────────────────
// These look realistic enough that automated scanners spend time processing
// them. A WordPress login page makes the scanner try to authenticate.
// A fake .env with fake credentials makes it try to use them.
// All credentials are obviously fake — they're structurally correct but
// contain values like 'HONEYPOT' that would never work anywhere.

function _fakeWordpressLogin() {
  return `<!DOCTYPE html>
<html lang="en-US"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Log In &lsaquo; PlanIT &#8212; WordPress</title>
<style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:#f0f0f1;padding:40px}
#login{width:320px;margin:0 auto;background:#fff;padding:24px;border-radius:4px;box-shadow:0 1px 3px rgba(0,0,0,.13)}
input{display:block;width:100%;box-sizing:border-box;padding:8px;margin:4px 0 12px;border:1px solid #8c8f94;border-radius:4px}
.button-primary{background:#2271b1;color:#fff;border:none;padding:10px 16px;cursor:pointer;border-radius:4px;width:100%}</style>
</head><body><div id="login">
<h1 style="text-align:center;font-size:20px;margin-bottom:20px">PlanIT</h1>
<form name="loginform" action="/wp-login.php" method="post">
<label>Username or Email<br><input type="text" name="log" autocomplete="username"></label>
<label>Password<br><input type="password" name="pwd" autocomplete="current-password"></label>
<input type="hidden" name="redirect_to" value="/wp-admin/">
<input type="hidden" name="testcookie" value="1">
<input class="button-primary" type="submit" value="Log In">
</form></div></body></html>`;
}

function _fakePhpMyAdmin() {
  return `<!DOCTYPE html>
<html><head><title>phpMyAdmin</title>
<style>body{font-family:sans-serif;background:#f4f4f4;display:flex;justify-content:center;align-items:center;height:100vh;margin:0}
.login-box{background:#fff;padding:30px;border-radius:4px;box-shadow:0 2px 6px rgba(0,0,0,.15);width:300px}
h2{margin:0 0 20px;font-size:18px;color:#333}input{width:100%;box-sizing:border-box;padding:8px;margin-bottom:12px;border:1px solid #ccc;border-radius:3px}
button{width:100%;background:#f90;border:none;padding:10px;border-radius:3px;cursor:pointer;font-weight:bold}</style>
</head><body><div class="login-box">
<h2>phpMyAdmin 5.2.1</h2>
<form method="post" action="index.php">
<input type="text" name="pma_username" placeholder="Username" autocomplete="username">
<input type="password" name="pma_password" placeholder="Password" autocomplete="current-password">
<input type="hidden" name="server" value="1">
<button type="submit">Log in</button>
</form></div></body></html>`;
}

function _fakeEnvFile() {
  // Structurally valid .env syntax with obviously fake/honeypot values.
  // The "canary token" style — values contain 'HONEYPOT' so you'd know
  // immediately if someone actually tried to use these credentials somewhere.
  return [
    `APP_NAME=PlanIT`,
    `APP_ENV=production`,
    `APP_KEY=base64:HONEYPOT${Math.random().toString(36).slice(2).toUpperCase()}==`,
    `APP_DEBUG=false`,
    `APP_URL=https://planitapp.onrender.com`,
    ``,
    `DB_CONNECTION=mysql`,
    `DB_HOST=127.0.0.1`,
    `DB_PORT=3306`,
    `DB_DATABASE=planit_prod`,
    `DB_USERNAME=planit`,
    `DB_PASSWORD=HONEYPOT_NOT_REAL_${Date.now()}`,
    ``,
    `REDIS_HOST=127.0.0.1`,
    `REDIS_PASSWORD=null`,
    `REDIS_PORT=6379`,
    ``,
    `JWT_SECRET=HONEYPOT_JWT_${Date.now()}_DO_NOT_USE`,
    ``,
    `MAIL_HOST=smtp.mailtrap.io`,
    `MAIL_USERNAME=honeypot_canary`,
    `MAIL_PASSWORD=HONEYPOT_MAIL_${Date.now()}`,
    ``,
    `AWS_ACCESS_KEY_ID=AKIAIOSFODNN7HONEYPOT`,
    `AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMIHONEYPOT/K7MDENG/bPxRfiCYKEY`,
    `AWS_DEFAULT_REGION=us-east-1`,
    ``,
    `STRIPE_SECRET=sk_live_HONEYPOT_DO_NOT_USE_${Math.random().toString(36).slice(2)}`,
  ].join('\n');
}

function _fakeGitConfig() {
  return [
    `[core]`,
    `\trepositoryformatversion = 0`,
    `\tfilemode = true`,
    `\tbare = false`,
    `\tlogallrefupdates = true`,
    `[remote "origin"]`,
    `\turl = https://github.com/planit-app/planit-private.git`,
    `\tfetch = +refs/heads/*:refs/remotes/origin/*`,
    `[branch "main"]`,
    `\tremote = origin`,
    `\tmerge = refs/heads/main`,
    `[user]`,
    `\temail = dev@planitapp.com`,
    `\tname = PlanIT Dev`,
  ].join('\n');
}

function _fakeAwsCredentials() {
  return [
    `[default]`,
    `aws_access_key_id = AKIAIOSFODNN7HONEYPOT`,
    `aws_secret_access_key = wJalrXUtnFEMI/K7HONEYPOT/bPxRfiCYEXAMPLEKEY`,
    ``,
    `[planit-deploy]`,
    `aws_access_key_id = AKIAI44QH8DHBEXHONEY`,
    `aws_secret_access_key = je7MtGbClwBF/HONEYPOT/bPxRfiCYEXAMPLEKEY`,
  ].join('\n');
}

// ─── The 30 Honeypot Routes ───────────────────────────────────────────────────
// router.all() catches every HTTP method — scanners try GET, POST, HEAD, etc.

// ── Group 1: WordPress (most probed platform on the internet) ─────────────────
router.all('/wp-login.php',
  honeypot('wp-login', () => ({ type: 'html', status: 200, body: _fakeWordpressLogin() })));

router.all('/wp-admin',
  honeypot('wp-admin', () => ({ type: 'html', status: 200, body: _fakeWordpressLogin() })));

router.all('/wp-admin/',
  honeypot('wp-admin-slash', () => ({ type: 'html', status: 200, body: _fakeWordpressLogin() })));

router.all('/wp-admin/admin-ajax.php',
  honeypot('wp-ajax', () => ({
    type: 'json', status: 200,
    body: { success: false, data: 'Invalid nonce.' },
  })));

router.all('/xmlrpc.php',
  honeypot('xmlrpc', () => ({
    type: 'xml', status: 200,
    body: '<?xml version="1.0"?><methodResponse><fault><value><struct>' +
          '<member><name>faultCode</name><value><int>-32601</int></value></member>' +
          '<member><name>faultString</name><value><string>server error. requested method not specified.</string></value></member>' +
          '</struct></value></fault></methodResponse>',
  })));

// ── Group 2: Database admin tools ─────────────────────────────────────────────
router.all('/phpmyadmin',
  honeypot('phpmyadmin', () => ({ type: 'html', status: 200, body: _fakePhpMyAdmin() })));

router.all('/phpmyadmin/',
  honeypot('phpmyadmin-slash', () => ({ type: 'html', status: 200, body: _fakePhpMyAdmin() })));

router.all('/pma/',
  honeypot('pma', () => ({ type: 'html', status: 200, body: _fakePhpMyAdmin() })));

router.all('/adminer',
  honeypot('adminer', () => ({ type: 'html', status: 200, body: _fakePhpMyAdmin() })));

router.all('/adminer.php',
  honeypot('adminer-php', () => ({ type: 'html', status: 200, body: _fakePhpMyAdmin() })));

// ── Group 3: Secrets and config files ─────────────────────────────────────────
router.all('/.env',
  honeypot('dotenv', () => ({ type: 'text', status: 200, body: _fakeEnvFile() })));

router.all('/.env.local',
  honeypot('dotenv-local', () => ({ type: 'text', status: 200, body: _fakeEnvFile() })));

router.all('/.env.production',
  honeypot('dotenv-prod', () => ({ type: 'text', status: 200, body: _fakeEnvFile() })));

router.all('/.git/config',
  honeypot('git-config', () => ({ type: 'text', status: 200, body: _fakeGitConfig() })));

router.all('/.aws/credentials',
  honeypot('aws-creds', () => ({ type: 'text', status: 200, body: _fakeAwsCredentials() })));

// ── Group 4: PHP webshells ────────────────────────────────────────────────────
router.all('/shell.php',
  honeypot('shell-php', () => ({
    type: 'html', status: 200,
    body: '<html><body><form method="POST"><input name="cmd" placeholder="command"><button>Execute</button></form></body></html>',
  })));

router.all('/c99.php',
  honeypot('c99', () => ({ type: 'html', status: 403, body: '<h1>403 Forbidden</h1><p>Access denied.</p>' })));

router.all('/r57.php',
  honeypot('r57', () => ({ type: 'html', status: 403, body: '<h1>403 Forbidden</h1><p>Access denied.</p>' })));

router.all('/eval.php',
  honeypot('eval-php', () => ({ type: 'html', status: 403, body: '<h1>403 Forbidden</h1>' })));

// ── Group 5: Server admin panels ──────────────────────────────────────────────
router.all('/manager/html',
  honeypot('tomcat-manager', () => ({
    type: 'html', status: 401,
    body: '<html><head><title>Tomcat Manager</title></head><body><h1>401 Unauthorized</h1><p>This request requires HTTP authentication.</p></body></html>',
  })));

router.all('/console',
  honeypot('java-console', () => ({
    type: 'html', status: 200,
    body: '<html><body><h1>WebLogic Administration Console</h1><form><input name="j_username" placeholder="User Name"><input type="password" name="j_password" placeholder="Password"><button>Sign In</button></form></body></html>',
  })));

router.all('/solr/',
  honeypot('solr-admin', () => ({
    type: 'html', status: 200,
    body: '<html><body><h1>Solr Admin</h1><p>Solr 9.4.0. Loading...</p></body></html>',
  })));

router.all('/cpanel',
  honeypot('cpanel', () => ({
    type: 'html', status: 200,
    body: '<html><body><h1>cPanel Login</h1><form><input name="user" placeholder="Username"><input type="password" name="pass" placeholder="Password"><button>Log In</button></form></body></html>',
  })));

// ── Group 6: Fake PlanIT API variants that look plausible to scanners ─────────
router.all('/api/v2/admin',
  honeypot('fake-api-v2-admin', () => ({
    type: 'json', status: 401,
    body: { error: 'Authentication required', endpoint: '/api/v2/admin', docs: '/api/docs' },
  })));

router.all('/api/debug',
  honeypot('fake-api-debug', () => ({
    type: 'json', status: 403,
    body: { error: 'Debug endpoint disabled in production', env: 'production' },
  })));

router.all('/api/config',
  honeypot('fake-api-config', () => ({
    type: 'json', status: 403,
    body: { error: 'Authentication required', message: 'Provide valid admin credentials.' },
  })));

router.all('/api/graphql',
  honeypot('fake-graphql', () => ({
    type: 'json', status: 200,
    body: { data: null, errors: [{ message: 'Not authorized', extensions: { code: 'UNAUTHENTICATED' } }] },
  })));

router.all('/api/swagger.json',
  honeypot('fake-swagger', () => ({
    type: 'json', status: 200,
    body: { openapi: '3.0.0', info: { title: 'PlanIT API', version: '2.0.0' }, paths: {} },
  })));

// ── Group 7: Framework/infrastructure probes ──────────────────────────────────
router.all('/actuator',
  honeypot('spring-actuator', () => ({
    type: 'json', status: 200,
    body: { _links: { self: { href: '/actuator', templated: false }, health: { href: '/actuator/health', templated: false } } },
  })));

router.all('/actuator/env',
  honeypot('spring-actuator-env', () => ({
    type: 'json', status: 200,
    body: {
      activeProfiles: ['production'],
      propertySources: [
        { name: 'systemEnvironment', properties: { HOME: { value: '/home/app' }, PORT: { value: '5000' } } },
      ],
    },
  })));

router.all('/server-status',
  honeypot('apache-status', () => ({
    type: 'html', status: 200,
    body: '<html><body><h1>Apache Server Status</h1><p>ServerVersion: Apache/2.4.57 (Ubuntu)</p><p>ServerMPM: event</p></body></html>',
  })));

module.exports = router;
