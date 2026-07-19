'use strict';

/**
 * discoveryService.js
 * ───────────────────
 * Legal lead discovery via:
 *   1. DuckDuckGo Lite HTML search (public, no TOS violation for research tooling)
 *   2. Scraping only publicly-listed contact pages for email addresses
 *   3. Optional Hunter.io Domain Search (HUNTER_API_KEY env var)
 *   4. Optional Google Custom Search (GOOGLE_CSE_KEY + GOOGLE_CSE_CX env vars)
 *
 * No login walls breached. Only publicly-accessible /contact, /about, homepage scraped.
 */

const axios = require('axios');

const USER_AGENT = 'Mozilla/5.0 (compatible; PlanIt-Discovery/1.0; +https://planitapp.onrender.com)';
const HTTP_TIMEOUT = 12000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractEmails(html) {
  const emailRe = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
  const found = (html.match(emailRe) || [])
    .map(e => e.toLowerCase())
    .filter(e =>
      !e.includes('example.') &&
      !e.includes('@2x') &&
      !e.includes('sentry') &&
      !e.includes('wixpress') &&
      !e.includes('schema') &&
      !e.endsWith('.png') &&
      !e.endsWith('.jpg') &&
      !e.endsWith('.svg')
    );
  return [...new Set(found)];
}

function extractCompanyName(html, url) {
  // Try og:site_name first
  const og = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i);
  if (og && og[1]) return og[1].trim();

  // Try <title>
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (title && title[1]) {
    return title[1].split(/[\|\-–]/)[0].trim().slice(0, 60);
  }

  // Fall back to domain
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, '').split('.')[0];
  } catch { return url; }
}

function extractDescription(html) {
  const meta = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{10,200})["']/i)
    || html.match(/<meta[^>]+content=["']([^"']{10,200})["'][^>]+name=["']description["']/i);
  return meta ? meta[1].trim() : '';
}

function guessRole(html, url) {
  const text = html.toLowerCase();
  if (/event\s*(planner|coordinator|manager|management|agency)/.test(text)) return 'Event Planner';
  if (/wedding\s*(planner|coordinator)/.test(text)) return 'Wedding Planner';
  if (/universi|college|school|campus|academic/.test(text)) return 'Educational Institution';
  if (/church|temple|mosque|synagogue|gurdwara|congregation|worship/.test(text)) return 'Place of Worship';
  if (/charity|non.?profit|ngo|fundrais/.test(text)) return 'Non-Profit / Charity';
  if (/community|association|volunteer/.test(text)) return 'Community Organisation';
  if (/corporate|enterprise|business|company|ltd|llc|inc\./.test(text)) return 'Corporate';
  if (/hotel|venue|hospitality/.test(text)) return 'Venue / Hospitality';
  return 'Organisation';
}

function domainOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

// ─── Search backends ──────────────────────────────────────────────────────────

async function searchDuckDuckGo(q, limit) {
  // DuckDuckGo Lite — plain HTML, easy to parse, no API key required
  const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(q)}`;
  const resp = await axios.get(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
    timeout: HTTP_TIMEOUT,
  });
  const html = resp.data;
  const linkRe = /<a[^>]+class=["']result-link["'][^>]+href=["']([^"']+)["'][^>]*>/gi;
  const urls = [];
  let m;
  while ((m = linkRe.exec(html)) !== null && urls.length < limit) {
    const href = m[1];
    if (href.startsWith('http') && !href.includes('duckduckgo.com')) urls.push(href);
  }
  // Also try the snippet approach
  const snippetRe = /class=["']result-link["'][^>]*href=["']([^"']+)["']/gi;
  while ((m = snippetRe.exec(html)) !== null && urls.length < limit) {
    const href = m[1];
    if (href.startsWith('http') && !href.includes('duckduckgo.com') && !urls.includes(href)) urls.push(href);
  }
  return [...new Set(urls)].slice(0, limit);
}

async function searchGoogleCSE(q, limit) {
  const key = process.env.GOOGLE_CSE_KEY;
  const cx  = process.env.GOOGLE_CSE_CX;
  if (!key || !cx) return [];
  const url = `https://www.googleapis.com/customsearch/v1?key=${key}&cx=${cx}&q=${encodeURIComponent(q)}&num=${Math.min(limit, 10)}`;
  const resp = await axios.get(url, { timeout: HTTP_TIMEOUT });
  return (resp.data.items || []).map(i => i.link);
}

async function searchHunterDomain(domain) {
  const key = process.env.HUNTER_API_KEY;
  if (!key) return [];
  const url = `https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${key}&limit=5`;
  const resp = await axios.get(url, { timeout: HTTP_TIMEOUT });
  return (resp.data?.data?.emails || []).map(e => ({
    email: e.value,
    name: [e.first_name, e.last_name].filter(Boolean).join(' '),
    role: e.position || '',
  }));
}

// ─── Per-URL contact extraction ───────────────────────────────────────────────

const CONTACT_PATHS = ['/contact', '/contact-us', '/about', '/about-us', '/team', '/people', '/info'];

async function scrapeContactsFromUrl(rootUrl, onProgress) {
  const results = [];
  const seenDomain = domainOf(rootUrl);

  // Try homepage first, then likely contact pages
  const urls = [rootUrl, ...CONTACT_PATHS.map(p => {
    try { return new URL(p, rootUrl).href; } catch { return null; }
  }).filter(Boolean)];

  let companyName = '';
  let description = '';
  let role = '';
  let foundEmails = [];

  for (const url of urls) {
    try {
      const resp = await axios.get(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
        timeout: HTTP_TIMEOUT,
        maxRedirects: 4,
      });
      const html = resp.data;
      if (!companyName) companyName = extractCompanyName(html, url);
      if (!description) description = extractDescription(html);
      if (!role) role = guessRole(html, url);
      const emails = extractEmails(html);
      emails.forEach(e => { if (!foundEmails.includes(e)) foundEmails.push(e); });
      if (foundEmails.length > 0) break; // found some, stop
    } catch {}
  }

  // Try Hunter.io for this domain too if no emails found
  if (foundEmails.length === 0 && process.env.HUNTER_API_KEY) {
    try {
      const hunterResults = await searchHunterDomain(seenDomain);
      for (const h of hunterResults) {
        results.push({
          email: h.email,
          name: h.name,
          company: companyName || seenDomain,
          role: h.role || role,
          website: rootUrl,
          description,
          source: 'hunter',
        });
      }
      return results;
    } catch {}
  }

  // Build one lead per email found
  for (const email of foundEmails.slice(0, 3)) {
    results.push({
      email,
      name: '',        // admin will fill this in
      company: companyName || seenDomain,
      role,
      website: rootUrl,
      description,
      source: 'scraped',
    });
  }

  return results;
}

// ─── Main discovery function ──────────────────────────────────────────────────

async function discoverLeads({ query, industry, location, limit, contacted, onProgress, onLead, isStopped }) {
  const q = [query, industry, location, 'contact email'].filter(Boolean).join(' ');
  const limitN = limit || 30;

  onProgress(`🔍 Searching for: "${q}"`);

  // Try Google CSE first (best quality), fall back to DuckDuckGo
  let urls = [];
  try {
    if (process.env.GOOGLE_CSE_KEY && process.env.GOOGLE_CSE_CX) {
      onProgress('Using Google Custom Search…');
      urls = await searchGoogleCSE(q, limitN);
    }
  } catch (e) {
    onProgress(`Google CSE error: ${e.message} — falling back to DuckDuckGo`);
  }

  if (urls.length === 0) {
    try {
      onProgress('Using DuckDuckGo search…');
      urls = await searchDuckDuckGo(q, limitN);
    } catch (e) {
      onProgress(`DuckDuckGo error: ${e.message}`);
    }
  }

  if (urls.length === 0) {
    onProgress('⚠️ No search results found. Try a different query or configure GOOGLE_CSE_KEY.');
    return;
  }

  onProgress(`Found ${urls.length} websites to scan…`);

  const seenDomains = new Set();
  let leadsFound = 0;

  for (let i = 0; i < urls.length; i++) {
    if (isStopped()) break;

    const url = urls[i];
    const domain = domainOf(url);
    if (seenDomains.has(domain)) continue;
    seenDomains.add(domain);

    onProgress(`[${i + 1}/${urls.length}] Scanning ${domain}…`);

    try {
      const leads = await scrapeContactsFromUrl(url, onProgress);
      for (const lead of leads) {
        if (!lead.email) continue;
        const alreadyContacted = contacted.has(lead.email.toLowerCase());
        onLead({ ...lead, alreadyContacted });
        leadsFound++;
      }
      if (leads.length === 0) {
        onProgress(`  → No public emails found on ${domain}`);
      }
    } catch (err) {
      onProgress(`  → Could not scan ${domain}: ${err.message}`);
    }

    // Small delay to be respectful
    if (i < urls.length - 1) await new Promise(r => setTimeout(r, 600));
  }

  onProgress(`✅ Done. Found ${leadsFound} contacts from ${seenDomains.size} sites.`);
}

module.exports = { discoverLeads };
