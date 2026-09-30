/**
 * frontend/server.js
 *
 * You're on Render, not Vercel — Render's "Static Site" tier serves files
 * straight off disk with no way to run code per request, so there's no
 * equivalent of Vercel's Edge Middleware/serverless functions to hook into.
 * This file replaces that: it's a small Express server that serves the same
 * Vite build (dist/) a static site would, and additionally gives known
 * link-preview bots (WhatsApp, iMessage, Slack, Discord, etc.) a version of
 * index.html with the real per-page title/description/image baked in.
 *
 * THIS MEANS A DEPLOYMENT CHANGE ON RENDER: the frontend needs to be a
 * "Web Service", not a "Static Site" (Static Sites can't run this file at
 * all). In the Render dashboard for the frontend service:
 *   Build Command:  npm install && npm run build
 *   Start Command:  npm run start
 * (package.json's "start" script now runs `node server.js`.) Everything
 * else — env vars, custom domain, auto-deploy on push — carries over
 * unchanged; you're just switching which Render product runs the same repo.
 *
 * Why this is needed at all: index.html is one static file with one fixed
 * title and one fixed set of og/twitter meta tags. React updates
 * document.title and <meta> tags client-side after main.jsx boots (see
 * App.jsx's <PageTitle/>, RSVPPage.jsx's title effect, Blog.jsx's setMeta
 * calls) — that's enough for a real browser tab, but link-preview crawlers
 * fetch the raw HTML ONCE and never run JavaScript, so they only ever saw
 * the one generic "PlanIt — Free Event Planning..." block that was always
 * in index.html, no matter what page the link actually pointed to.
 *
 * Real visitors are unaffected: this only intercepts requests whose
 * User-Agent matches a known bot, and only for paths that have a resolver
 * in shareMeta.js — everyone else gets the exact same static SPA shell as
 * before, at the same speed. PlanIt branding stays; only the title,
 * description and image become page-specific, same as any other website.
 */
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { matchShareRoute } from './shareMeta.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, 'dist');
const INDEX_HTML_PATH = path.join(DIST_DIR, 'index.html');

const PORT = process.env.PORT || 3000;
const API_BASE = (process.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/+$/, '');

// VITE_API_URL is normally a Vite *build-time* variable baked into the
// client bundle via import.meta.env — but this file is a Node server
// reading it at RUNTIME via process.env, which only works if it's also set
// as a regular environment variable on whatever is running this process
// (e.g. the Render dashboard's Environment tab for this Web Service, not
// just a build arg). If it's missing here, every bot-preview resolve in
// shareMeta.js silently fails (getJSON catches the fetch error and returns
// null) and every page — including RSVP links — quietly falls back to the
// generic homepage tags baked into index.html. That failure was otherwise
// invisible outside of a per-request console.warn, so surface it loudly
// once at boot instead.
if (API_BASE.includes('localhost')) {
  console.warn(
    `[frontend] WARNING: API_BASE resolved to "${API_BASE}" — VITE_API_URL is not set in this ` +
    'process\'s runtime environment. Bot-preview meta injection (shareMeta.js) will fail for ' +
    'every request until VITE_API_URL is set on this service (not just at build time).'
  );
}

// Known link-preview / unfurl bots. If a platform's preview isn't picking up
// the new tags, check the request's User-Agent in Render's logs and add it
// here. Intentionally doesn't try to catch generic search crawlers
// (Googlebot etc.) — those already get index.html's default SEO tags.
const BOT_UA_RE = /(facebookexternalhit|WhatsApp|Twitterbot|Slackbot|TelegramBot|Discordbot|LinkedInBot|SkypeUriPreview|Pinterest|redditbot|Applebot|iMessage|vkShare|Embedly|Iframely|SnapchatAds|Bitrix)/i;

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function setMetaTag(html, attr, key, content) {
  const re = new RegExp(`<meta[^>]*${attr}=["']${key}["'][^>]*>`, 'i');
  const tag = `<meta ${attr}="${key}" content="${escapeHtml(content)}" />`;
  // Function replacers: '$&' / '$1' inside an event title must not be treated as replacement patterns.
  return re.test(html) ? html.replace(re, () => tag) : html.replace('</head>', () => `    ${tag}\n  </head>`);
}

function injectMeta(html, { title, description, image, url, type }) {
  let out = html;
  if (title) {
    out = out.replace(/<title>[\s\S]*?<\/title>/i, () => `<title>${escapeHtml(title)}</title>`);
    out = setMetaTag(out, 'property', 'og:title', title);
    out = setMetaTag(out, 'name', 'twitter:title', title);
  }
  if (description) {
    out = setMetaTag(out, 'name', 'description', description);
    out = setMetaTag(out, 'property', 'og:description', description);
    out = setMetaTag(out, 'name', 'twitter:description', description);
  }
  if (image) {
    out = setMetaTag(out, 'property', 'og:image', image);
    out = setMetaTag(out, 'name', 'twitter:image', image);
  }
  if (type) out = setMetaTag(out, 'property', 'og:type', type);
  if (url) {
    out = setMetaTag(out, 'property', 'og:url', url);
    const canonRe = /<link[^>]*rel=["']canonical["'][^>]*>/i;
    const canonTag = `<link rel="canonical" href="${escapeHtml(url)}" />`;
    out = canonRe.test(out) ? out.replace(canonRe, () => canonTag) : out.replace('</head>', () => `    ${canonTag}\n  </head>`);
  }
  return out;
}

// Bakes the branded title + event brand into the HTML for real visitors so the
// browser tab and the loading screen show the event's name from the first paint
// (read back by src/utils/eventBrand.js via window.__PLANIT_PRELOAD__).
function injectPreload(html, preload) {
  const json = JSON.stringify(preload)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  const tag = `    <script>window.__PLANIT_PRELOAD__=${json};</script>\n  </head>`;
  return html.replace('</head>', () => tag); // function form: '$' in event names must not be treated as a replacement pattern
}

const HUMAN_RESOLVE_TIMEOUT_MS = 1500; // never make a real visitor wait long for a title

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true); // Render sits behind its own proxy/TLS terminator

// Hashed JS/CSS/image assets under dist/assets, etc. — served as-is, long
// cache, exactly like a static site would (Vite fingerprints these
// filenames, so caching them aggressively is always safe).
app.use(express.static(DIST_DIR, { index: false }));

// Everything else falls through to the SPA shell — this is the same
// "rewrite everything to index.html" behavior a static site's rewrite rule
// gives you, plus the bot-only title/description/image swap.
app.get('*', async (req, res, next) => {
  try {
    let html = fs.readFileSync(INDEX_HTML_PATH, 'utf8');

    const ua = req.headers['user-agent'] || '';
    const isBotUA = BOT_UA_RE.test(ua);
    const routeMatch = matchShareRoute(req.path);
    if (isBotUA) {
      console.log('[share-preview debug]', JSON.stringify({
        path: req.path, ua, isBotUA, hasRouteForPath: !!routeMatch, apiBase: API_BASE,
      }));
    }
    // Bots get full share tags for every resolvable route. Real visitors only
    // get the branded <title> + preload blob, and only on routes that opt in.
    const route = routeMatch && (isBotUA || routeMatch.humans) ? routeMatch : null;

    if (route) {
      let meta = null;
      try {
        meta = isBotUA
          ? await route.resolve(API_BASE)
          : await Promise.race([
              route.resolve(API_BASE),
              new Promise((resolve) => setTimeout(() => resolve(null), HUMAN_RESOLVE_TIMEOUT_MS)),
            ]);
        if (isBotUA) console.log('[share-preview debug] resolve result:', JSON.stringify(meta));
      } catch (err) {
        console.error('[share-preview] resolve failed for', req.path, err.message);
      }
      if (meta?.title) {
        const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
        if (isBotUA) {
          html = injectMeta(html, { ...meta, url });
        } else {
          const tab = meta.tabTitle || meta.title;
          html = html.replace(/<title>[\s\S]*?<\/title>/i, () => `<title>${escapeHtml(tab)}</title>`);
        }
        html = injectPreload(html, { path: req.path, title: meta.tabTitle || meta.title, brand: meta.brand || null });
        if (isBotUA) {
          // Short cache — event/RSVP data changes, but a pasted link is often
          // unfurled by more than one app within seconds of the same paste.
          res.set('Cache-Control', 'public, max-age=60');
        } else {
          res.set('Cache-Control', 'no-cache');
        }
        return res.type('html').send(html);
      }
    }

    // Real visitors (and bots on pages with no resolver) get the plain
    // build output — identical to what the static site served before.
    res.set('Cache-Control', 'no-cache');
    res.type('html').send(html);
  } catch (err) { next(err); }
});

app.listen(PORT, () => {
  console.log(`[frontend] serving ${DIST_DIR} on :${PORT}`);
});
