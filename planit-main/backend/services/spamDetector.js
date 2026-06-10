'use strict';

/**
 * services/spamDetector.js
 *
 * Comprehensive spam detection engine for PlanIt.
 * Scores both event creation requests and RSVP submissions.
 *
 * SCORING MODEL
 * ─────────────
 * Each check contributes a weighted penalty to a running score (0–100).
 * Thresholds:
 *   0–29   → clean   (auto-publish, no action)
 *   30–59  → review  (published but flagged for admin attention)
 *   60+    → block   (rejected or held pending admin approval)
 *
 * CHECKS PERFORMED
 * ────────────────
 * EVENT CREATION:
 *   • IP velocity          — too many events from same IP/fingerprint in 24h
 *   • Disposable email     — known throwaway/temp domain list
 *   • Keyword signals      — phishing, adult, scam patterns in title/description
 *   • Suspicious URLs      — URL shorteners, IP-based links in description
 *   • Missing info         — blank descriptions on freshly created events
 *   • Bot-like metadata    — headless UA, curl, scripts, no fingerprint
 *   • Honeypot fields      — hidden form fields filled by bots
 *   • Repeat fingerprint   — same creator fingerprint with many events
 *   • Subdomain patterns   — auto-generated / dictionary-bomb subdomains
 *   • Bulk timing          — dozens of events in same short window from IP
 *
 * RSVP SUBMISSION:
 *   • IP velocity          — too many RSVPs from same IP in 1h
 *   • Disposable email     — throwaway domains
 *   • Keyword signals      — spam/bot content in guest note or name
 *   • Bot-like metadata    — UA patterns matching headless browsers / scrapers
 *   • Honeypot field       — hidden _hp field filled in form
 *   • Name anomalies       — random strings, all-caps, impossible names
 *   • Phone anomalies      — obviously fake numbers (000-000-0000, 1234567890)
 *   • Plus-one abuse       — abnormal plus-one counts on unverified emails
 *   • Duplicate burst      — many RSVPs from same IP to same event
 */

const Event = require('../models/Event');
const RSVPSubmission = require('../models/RSVPSubmission');
const redis = require('./redisClient');

// ─── Configuration ────────────────────────────────────────────────────────────

const THRESHOLDS = {
  review: 30,
  block:  60,
};

// How many events one IP can create in a 24-hour window before score penalty
const IP_EVENT_WINDOW_S    = 24 * 60 * 60; // 24 hours
const IP_EVENT_SOFT_LIMIT  = 3;   // >3 → penalty
const IP_EVENT_HARD_LIMIT  = 8;   // >8 → near-instant block
// Fingerprint window is longer since fingerprints are more stable than IPs
const FP_EVENT_WINDOW_S    = 72 * 60 * 60; // 72 hours
const FP_EVENT_SOFT_LIMIT  = 5;
const FP_EVENT_HARD_LIMIT  = 12;

// RSVP velocity per IP per event
const IP_RSVP_WINDOW_S    = 60 * 60; // 1 hour
const IP_RSVP_SOFT_LIMIT  = 3;
const IP_RSVP_HARD_LIMIT  = 8;

// ─── Disposable / throwaway email domains ─────────────────────────────────────
// Curated list of the most common temp/throwaway domains. Not exhaustive,
// but catches the vast majority of spam RSVP flooding.
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com','guerrillamail.com','guerrillamail.net','guerrillamail.biz',
  'guerrillamail.de','guerrillamail.info','guerrillamail.org','sharklasers.com',
  'guerrillamailblock.com','grr.la','spam4.me','yopmail.com','yopmail.fr',
  'cool.fr.nf','jetable.fr.nf','nospam.ze.tc','nomail.xl.cx','mega.zik.dj',
  'speed.1s.fr','courriel.fr.nf','moncourrier.fr.nf','monemail.fr.nf',
  'monmail.fr.nf','mailnull.com','spamobox.com','spamgourmet.com',
  'spamgourmet.net','spamgourmet.org','spamgourmet.me','dispostable.com',
  'throwam.com','tempr.email','discard.email','tempmailer.com','mailnesia.com',
  'throwaway.email','fakemail.net','fake-email.pp.ua','maildrop.cc',
  'trashmail.at','trashmail.com','trashmail.io','trashmail.me','trashmail.net',
  'trashmail.org','trashmail.xyz','trashmailer.com','trash-mail.at',
  'spamgrap.com','mailcatch.com','temp-mail.org','tempail.com','tempemail.co',
  'tempinbox.com','tempinbox.co.uk','tempemail.com','tempemail.net',
  'throwam.com','throwam.net','tmailinator.com','dispostable.com',
  'mailbucket.org','spaml.de','tempsky.com','getairmail.com',
  'filzmail.com','mailfreeonline.com','owlpic.com','spamfree24.de',
  'spamfree24.eu','spamfree24.info','spamfree24.net','spamfree24.org',
  'spamgap.com','spamobox.com','spam.la','spam.su','spamoff.de',
  'nwytg.net','anonaddy.com','simplelogin.com','33mail.com','spamtrap.ro',
  'nowmymail.com','maildax.me','e4ward.com','binkmail.com',
  'spamevader.com','dodgit.com','objectmail.com','bugmenot.com',
  'spamcannon.com','spamcannon.net','spamevader.com','10minutemail.com',
  '10minutemail.net','20minutemail.com','5minutemail.com','temp-mail.ru',
  'getonemail.com','2prong.com','spamgrab.com','rklips.com','neverbox.com',
  'meltmail.com','mt2015.com','thankyou2010.com','thankyou2010.com',
  'dispostable.com','einrot.com','ericjohnson.ml','ero-tube.org',
  'evopo.com','explodemail.com','express.net.ua','eyepaste.com',
]);

// ─── Spam / phishing / adult keyword patterns ─────────────────────────────────
// Each entry: [regex, score, flagName]
const EVENT_KEYWORD_RULES = [
  // Phishing / credential theft
  [/verif(y|ication)\s*(your|account|email|login)/i,   25, 'phishing_verify'],
  [/click here (to|and) (verify|confirm|claim)/i,        20, 'phishing_click_here'],
  [/enter (your|the) (password|pin|ssn|credit card)/i,   30, 'phishing_credentials'],
  [/your account (has been|will be) (suspended|closed)/i,25, 'phishing_account_suspend'],
  [/(winner|won|winning|lottery|prize).{0,40}(claim|collect)/i, 30, 'lottery_scam'],
  [/\b(bitcoin|crypto|btc|eth)\s*(giveaway|doubl(e|ing)|free|bonus)/i, 35, 'crypto_scam'],
  [/(exclusive|limited)\s*(offer|deal|investment)\s*(for you|today only)/i, 25, 'scam_offer'],
  [/send (money|payment|funds|transfer)/i,               20, 'payment_request'],
  [/(wire transfer|western union|moneygram)/i,           30, 'wire_transfer'],

  // Adult content
  [/\b(xxx|adult|18\+|nsfw|nude|naked|pornhub|onlyfans)\b/i, 40, 'adult_content'],
  [/\b(escort|hookup|cam\s*girl|sex\s*(cam|chat|meet))\b/i,  40, 'adult_content'],

  // MLM / financial spam
  [/(work from home|make money (fast|online|easily)|passive income).{0,40}(today|now|free)/i, 25, 'mlm_spam'],
  [/\$\s*\d{3,}(,\d{3})?\s*(per (day|week|month)|guaranteed)/i, 25, 'income_claim'],
  [/(multilevel|mlm|pyramid scheme|referral (bonus|income))/i, 30, 'mlm_pyramid'],

  // Generic spam signals
  [/(click the link|click below|tap here)\s*to\s*(join|rsvp|claim|get)/i, 15, 'link_bait'],
  [/this (is not|isn.?t) (spam|junk|advertisement)/i,    20, 'spam_denial'],
  [/(unsubscribe|opt(-| )out)\s*(here|below|from this)/i, 15, 'bulk_email_pattern'],
  [/\b(100%|guaranteed|risk(-| )free)\b.{0,30}(free|win|earn|profit)/i, 20, 'false_guarantee'],
];

const RSVP_KEYWORD_RULES = [
  [/\b(buy|sell|offer|deal|discount|promo)\b/i,          15, 'commercial_spam'],
  [/https?:\/\//i,                                        10, 'url_in_note'],
  [/(bit\.ly|tinyurl|t\.co|goo\.gl|ow\.ly|buff\.ly)/i,  20, 'url_shortener_in_note'],
  [/(xxx|adult|porn|sex|nude|cam\s*girl)/i,               35, 'adult_content'],
  [/(casino|gambling|betting|jackpot|poker)/i,            25, 'gambling_spam'],
  [/\b(click|tap|visit)\s*(here|below|link)\b/i,         15, 'link_bait'],
  [/\b(winner|won|prize|claim|reward|lottery)\b/i,        20, 'lottery_spam'],
];

// ─── Suspicious URL patterns in event descriptions ────────────────────────────
const SUSPICIOUS_URL_PATTERNS = [
  /https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/,       // IP-based URL
  /(bit\.ly|tinyurl\.com|t\.co|goo\.gl|ow\.ly|buff\.ly|is\.gd|tiny\.cc|qr\.ae)/i,
  /(rb\.gy|cutt\.ly|shorturl\.at|rebrand\.ly|bl\.ink)/i,
];

// ─── Bot-like user-agent patterns ─────────────────────────────────────────────
const BOT_UA_PATTERNS = [
  /^(curl|wget|python-requests|axios|node-fetch|go-http-client|java\/|okhttp)/i,
  /^$/,                                          // empty UA
  /(headlesschrome|phantomjs|selenium|puppeteer|playwright|nightmarejs)/i,
  /(scrapy|httpclient|libwww-perl|lwp-trivial|masscan|zgrab|nmap)/i,
  /^(PostmanRuntime|insomnia|httpie|rest-client)/i,
];

// ─── Subdomain spam patterns ───────────────────────────────────────────────────
const SUBDOMAIN_SPAM_PATTERNS = [
  /^[a-z]{8,20}\d{3,}$/,            // random-word + digits: "rfjvkbcd123"
  /^test[-_]?\d+$/,                 // test1, test-2, test_123
  /^(asdf|qwerty|zxcv|abcd|aaaa|bbbb|1234)/i,
  /^(free|win|click|buy|earn|cash|prize|crypto|xxx)/i,
  /^.{1,3}$/,                       // way too short
];

// ─── Fake name patterns ────────────────────────────────────────────────────────
const FAKE_NAME_PATTERNS = [
  /^[a-z]{1,2}$/i,                           // "a", "ab" — too short
  /^[aeiou]{4,}$/i,                          // all vowels: "aaaa"
  /^(.)\1{4,}$/,                             // repeated char: "aaaaa"
  /^[^aeiou ]{6,}$/i,                        // no vowels at all (gibberish)
  /^\d+$/,                                   // all numbers
  /^[^a-z0-9 ]+$/i,                          // only special chars
  /(test|asdf|qwer|xxxxxxx|noreply|unknown|anonymous)/i,
];

// ─── Obviously fake phone patterns ────────────────────────────────────────────
const FAKE_PHONE_PATTERNS = [
  /^0{7,}$/,                        // all zeros
  /^1{7,}$/,                        // all ones
  /^(.)\1{8,}$/,                    // any repeated digit 8+ times
  /^(0+1?[-. ]?)?\(?\d{3}\)?[-. ]?\d{4}[-. ]?\1{4}/,  // 1234567890
  /^(555[-. ]?01\d\d)/,             // Hollywood fake (555-01XX)
  /^123[-. ]?456[-. ]?7890/,        // classic fake
  /^000[-. ]?000[-. ]?0000/,        // all zeros formatted
];

// ─── Redis helpers ────────────────────────────────────────────────────────────

async function incrWithExpiry(key, windowSeconds) {
  try {
    const r = redis.getClient ? redis.getClient() : redis;
    if (!r) return 0;
    const multi = r.multi ? r.multi() : null;
    if (multi) {
      multi.incr(key);
      multi.expire(key, windowSeconds);
      const results = await multi.exec();
      return results?.[0]?.[1] ?? results?.[0] ?? 0;
    }
    // Fallback: non-transactional
    const count = await r.incr(key);
    if (count === 1) await r.expire(key, windowSeconds);
    return count;
  } catch {
    return 0;
  }
}

async function getCounter(key) {
  try {
    const r = redis.getClient ? redis.getClient() : redis;
    if (!r) return 0;
    const val = await r.get(key);
    return val ? parseInt(val, 10) : 0;
  } catch {
    return 0;
  }
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function domainOf(email) {
  if (!email || !email.includes('@')) return '';
  return email.split('@').pop().toLowerCase().trim();
}

function isDisposable(email) {
  return DISPOSABLE_DOMAINS.has(domainOf(email));
}

function isBotUA(ua) {
  if (!ua) return true;
  return BOT_UA_PATTERNS.some(p => p.test(ua));
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function verdictFor(score) {
  if (score >= THRESHOLDS.block)  return 'block';
  if (score >= THRESHOLDS.review) return 'review';
  return 'clean';
}

// ─── Core: analyze event creation ─────────────────────────────────────────────

/**
 * analyzeEvent(data)
 *
 * @param {object} data
 *   title, description, subdomain, organizerEmail, organizerName,
 *   ip, userAgent, fingerprint, honeypot (optional hidden field value)
 *
 * @returns {Promise<{ score: number, flags: string[], verdict: string, details: object[] }>}
 */
async function analyzeEvent(data) {
  const {
    title          = '',
    description    = '',
    subdomain      = '',
    organizerEmail = '',
    organizerName  = '',
    ip             = '',
    userAgent      = '',
    fingerprint    = '',
    honeypot       = '',   // hidden field — bots fill it, humans don't
  } = data;

  let score = 0;
  const flags = [];
  const details = [];

  function add(points, flag, reason) {
    score += points;
    flags.push(flag);
    details.push({ flag, points, reason });
  }

  // ── 1. Honeypot ────────────────────────────────────────────────────────────
  if (honeypot && honeypot.trim().length > 0) {
    add(100, 'honeypot_filled', 'Hidden bot-trap field was submitted — automated submission detected');
  }

  // ── 2. Bot user-agent ──────────────────────────────────────────────────────
  if (isBotUA(userAgent)) {
    add(30, 'bot_ua', `User-agent pattern matches known bot/script: "${(userAgent || 'empty').slice(0, 80)}"`);
  }

  // ── 3. Missing fingerprint (strong signal when UA is also generic) ─────────
  if (!fingerprint || fingerprint.trim().length < 8) {
    add(10, 'no_fingerprint', 'No browser fingerprint — possible headless browser or scripted request');
  }

  // ── 4. IP velocity check ───────────────────────────────────────────────────
  if (ip) {
    const ipKey = `spam:evt:ip:${ip}`;
    const ipCount = await incrWithExpiry(ipKey, IP_EVENT_WINDOW_S);
    if (ipCount > IP_EVENT_HARD_LIMIT) {
      add(45, 'ip_velocity_high', `IP created ${ipCount} events in 24 hours (hard limit: ${IP_EVENT_HARD_LIMIT})`);
    } else if (ipCount > IP_EVENT_SOFT_LIMIT) {
      add(20, 'ip_velocity_medium', `IP created ${ipCount} events in 24 hours (soft limit: ${IP_EVENT_SOFT_LIMIT})`);
    }
  }

  // ── 5. Fingerprint velocity check ─────────────────────────────────────────
  if (fingerprint && fingerprint.trim().length >= 8) {
    const fpKey = `spam:evt:fp:${fingerprint}`;
    const fpCount = await incrWithExpiry(fpKey, FP_EVENT_WINDOW_S);
    if (fpCount > FP_EVENT_HARD_LIMIT) {
      add(40, 'fingerprint_velocity_high', `Fingerprint created ${fpCount} events in 72 hours`);
    } else if (fpCount > FP_EVENT_SOFT_LIMIT) {
      add(18, 'fingerprint_velocity_medium', `Fingerprint created ${fpCount} events in 72 hours`);
    }
  }

  // ── 6. Disposable email ────────────────────────────────────────────────────
  if (isDisposable(organizerEmail)) {
    add(30, 'disposable_email', `Organizer email uses known disposable domain: ${domainOf(organizerEmail)}`);
  }

  // ── 7. Keyword signals — title + description ───────────────────────────────
  const combined = `${title} ${description}`;
  for (const [pattern, pts, flag] of EVENT_KEYWORD_RULES) {
    if (pattern.test(combined) && !flags.includes(flag)) {
      add(pts, flag, `Matched spam/scam keyword pattern: ${flag.replace(/_/g, ' ')}`);
    }
  }

  // ── 8. Suspicious URLs in description ─────────────────────────────────────
  for (const pat of SUSPICIOUS_URL_PATTERNS) {
    if (pat.test(description)) {
      add(20, 'suspicious_url', `Description contains suspicious URL pattern (IP-based or URL shortener)`);
      break;
    }
  }

  // ── 9. Suspicious subdomain ────────────────────────────────────────────────
  for (const pat of SUBDOMAIN_SPAM_PATTERNS) {
    if (pat.test(subdomain)) {
      add(15, 'suspicious_subdomain', `Subdomain pattern matches known spam format: "${subdomain}"`);
      break;
    }
  }

  // ── 10. Blank / extremely thin description ────────────────────────────────
  const descLen = (description || '').trim().length;
  if (descLen === 0) {
    add(8, 'no_description', 'Event has no description — common in spam / test events');
  } else if (descLen < 20) {
    add(4, 'thin_description', `Description is very short (${descLen} chars)`);
  }

  // ── 11. Excessive caps in title ────────────────────────────────────────────
  const titleUpper = (title.match(/[A-Z]/g) || []).length;
  const titleAlpha = (title.match(/[a-zA-Z]/g) || []).length;
  if (titleAlpha > 5 && titleUpper / titleAlpha > 0.7) {
    add(12, 'all_caps_title', 'Event title is predominantly uppercase — common spam pattern');
  }

  // ── 12. Excessive punctuation / special chars ──────────────────────────────
  const specialCount = (title.match(/[!@#$%^&*()_+=<>?\/\\|{}~`]/g) || []).length;
  if (specialCount >= 4) {
    add(15, 'excessive_special_chars', `Title contains ${specialCount} special characters — common spam pattern`);
  }

  // ── 13. Title == description (copy-paste spam) ─────────────────────────────
  if (title.trim().length > 10 && title.trim().toLowerCase() === description.trim().toLowerCase()) {
    add(15, 'title_equals_description', 'Title and description are identical — automated content pattern');
  }

  // ── 14. DB cross-check: same IP created many events recently ──────────────
  // Only do this if Redis didn't already catch it (Redis may be unavailable)
  const existingIPCount = await getCounter(`spam:evt:ip:${ip}`);
  if (existingIPCount === 0 && ip) {
    // Redis unavailable — fall back to DB
    try {
      const since = new Date(Date.now() - IP_EVENT_WINDOW_S * 1000);
      const dbCount = await Event.countDocuments({ creatorIp: ip, createdAt: { $gte: since } });
      if (dbCount > IP_EVENT_HARD_LIMIT) {
        add(45, 'ip_velocity_high_db', `IP has ${dbCount} events in DB in last 24h (DB fallback check)`);
      } else if (dbCount > IP_EVENT_SOFT_LIMIT) {
        add(20, 'ip_velocity_medium_db', `IP has ${dbCount} events in DB in last 24h (DB fallback check)`);
      }
    } catch { /* DB check best-effort */ }
  }

  score = clamp(Math.round(score), 0, 100);
  return { score, flags, verdict: verdictFor(score), details };
}

// ─── Core: analyze RSVP submission ────────────────────────────────────────────

/**
 * analyzeRsvp(data)
 *
 * @param {object} data
 *   eventId, firstName, lastName, email, phone, guestNote,
 *   plusOnes, ip, userAgent, honeypot
 *
 * @returns {Promise<{ score: number, flags: string[], verdict: string, details: object[], shouldBlock: boolean }>}
 */
async function analyzeRsvp(data) {
  const {
    eventId    = '',
    firstName  = '',
    lastName   = '',
    email      = '',
    phone      = '',
    guestNote  = '',
    plusOnes   = 0,
    ip         = '',
    userAgent  = '',
    honeypot   = '',
  } = data;

  let score = 0;
  const flags = [];
  const details = [];

  function add(points, flag, reason) {
    score += points;
    flags.push(flag);
    details.push({ flag, points, reason });
  }

  // ── 1. Honeypot ────────────────────────────────────────────────────────────
  if (honeypot && honeypot.trim().length > 0) {
    add(100, 'honeypot_filled', 'Hidden bot-trap field was submitted');
  }

  // ── 2. Bot user-agent ──────────────────────────────────────────────────────
  if (isBotUA(userAgent)) {
    add(25, 'bot_ua', `User-agent matches bot pattern: "${(userAgent || 'empty').slice(0, 80)}"`);
  }

  // ── 3. IP velocity per event ───────────────────────────────────────────────
  if (ip && eventId) {
    const key = `spam:rsvp:ip:${ip}:${eventId}`;
    const count = await incrWithExpiry(key, IP_RSVP_WINDOW_S);
    if (count > IP_RSVP_HARD_LIMIT) {
      add(50, 'rsvp_ip_velocity_high', `IP submitted ${count} RSVPs to this event in 1 hour`);
    } else if (count > IP_RSVP_SOFT_LIMIT) {
      add(20, 'rsvp_ip_velocity_medium', `IP submitted ${count} RSVPs to this event in 1 hour`);
    }
  }

  // ── 4. Disposable email ────────────────────────────────────────────────────
  if (isDisposable(email)) {
    add(30, 'disposable_email', `Uses known disposable email domain: ${domainOf(email)}`);
  }

  // ── 5. Name anomalies ──────────────────────────────────────────────────────
  const fullName = `${firstName} ${lastName}`.trim();
  for (const pat of FAKE_NAME_PATTERNS) {
    if (pat.test(firstName)) {
      add(20, 'suspicious_name', `First name "${firstName}" matches fake/gibberish name pattern`);
      break;
    }
  }
  // Detect random-looking names: very low vowel ratio in full name
  const nameAlpha = (fullName.match(/[a-zA-Z]/g) || []).length;
  const nameVowels = (fullName.match(/[aeiouAEIOU]/g) || []).length;
  if (nameAlpha >= 6 && nameVowels / nameAlpha < 0.1) {
    add(20, 'random_string_name', `Name "${fullName}" has extremely low vowel ratio — likely random string`);
  }

  // ── 6. Phone anomalies ────────────────────────────────────────────────────
  if (phone && phone.replace(/\D/g, '').length >= 7) {
    const digits = phone.replace(/\D/g, '');
    for (const pat of FAKE_PHONE_PATTERNS) {
      if (pat.test(digits)) {
        add(15, 'fake_phone', `Phone number "${phone}" matches known fake pattern`);
        break;
      }
    }
  }

  // ── 7. Keyword signals in note ─────────────────────────────────────────────
  for (const [pattern, pts, flag] of RSVP_KEYWORD_RULES) {
    if (pattern.test(guestNote) && !flags.includes(flag)) {
      add(pts, flag, `Guest note matched spam keyword pattern: ${flag.replace(/_/g, ' ')}`);
    }
  }

  // ── 8. Plus-one abuse on unverified email ─────────────────────────────────
  if (plusOnes > 8 && !email) {
    add(20, 'plusone_abuse', `${plusOnes} plus-ones requested without providing an email`);
  }
  if (plusOnes > 20) {
    add(25, 'plusone_excessive', `${plusOnes} plus-ones is abnormally high`);
  }

  // ── 9. Duplicate burst: same IP, many RSVPs to same event in last minute ──
  if (ip && eventId) {
    const burstKey = `spam:rsvp:burst:${ip}:${eventId}`;
    const burst = await incrWithExpiry(burstKey, 60); // 1 minute window
    if (burst > 3) {
      add(35, 'rsvp_burst', `${burst} RSVPs from this IP to this event in under 60 seconds`);
    }
  }

  score = clamp(Math.round(score), 0, 100);
  const verdict = verdictFor(score);

  return {
    score,
    flags,
    verdict,
    details,
    shouldBlock: verdict === 'block',
  };
}

// ─── Expose helper to update event spam fields after analysis ─────────────────

/**
 * applyEventSpamResult(eventId, result)
 * Persists the spam score, flags, and verdict back to the event document.
 * Called fire-and-forget after saving the event so it never delays the response.
 */
async function applyEventSpamResult(eventId, result) {
  try {
    await Event.updateOne(
      { _id: eventId },
      {
        $set: {
          spamScore:   result.score,
          spamFlags:   result.flags,
          spamVerdict: result.verdict,
        },
      }
    );
  } catch { /* best-effort */ }
}

/**
 * reAnalyzeEvent(eventId)
 * Re-runs spam analysis on an existing event.
 * Used by the admin panel's "Re-analyze" action.
 */
async function reAnalyzeEvent(eventId) {
  const event = await Event.findById(eventId)
    .select('+spamScore +spamFlags +spamVerdict +creatorIp +creatorUserAgent +creatorFingerprint')
    .lean();
  if (!event) throw new Error('Event not found');

  const result = await analyzeEvent({
    title:          event.title || '',
    description:    event.description || '',
    subdomain:      event.subdomain || '',
    organizerEmail: event.organizerEmail || '',
    organizerName:  event.organizerName || '',
    ip:             event.creatorIp || '',
    userAgent:      event.creatorUserAgent || '',
    fingerprint:    event.creatorFingerprint || '',
    honeypot:       '',
  });

  await applyEventSpamResult(eventId, result);
  return result;
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  analyzeEvent,
  analyzeRsvp,
  applyEventSpamResult,
  reAnalyzeEvent,
  verdictFor,
  THRESHOLDS,
  isDisposable,
  isBotUA,
};
