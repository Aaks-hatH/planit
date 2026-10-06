/**
 * frontend/blogPrerender.js
 *
 * Search-engine-ready HTML for the blog.
 *
 * Why this exists: the blog is a React SPA, so the raw HTML a crawler downloads
 * is an empty <div id="root"> with one generic homepage title/description. Google
 * can run JavaScript, but it does so in a second, delayed pass and often skips or
 * postpones it for new/low-authority sites; Bing, DuckDuckGo and the AI crawlers
 * (GPTBot, ClaudeBot, PerplexityBot, ...) mostly don't run it at all. So for those
 * requests, server.js calls into this file and returns the same page with the post
 * already in the HTML: real <title>, description, canonical URL, Open Graph tags,
 * BlogPosting structured data, and the article text itself.
 *
 * Real visitors never get this HTML. They get the normal SPA shell and React
 * renders the page exactly as before, so there's no flash of unstyled content.
 * The text a crawler sees is the same text a visitor sees (same markdown, same
 * title), which is what Google's dynamic-rendering guidance requires.
 *
 * Data comes from the public, side-effect-free endpoints GET /api/blog and
 * GET /api/blog/:slug, cached in memory so a crawler burst never hammers the DB.
 */

const SITE_URL = (process.env.SITE_URL || 'https://planitapp.onrender.com').replace(/\/+$/, '');
const DEFAULT_IMAGE = `${SITE_URL}/planit-og.png`;
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_ENTRIES = 200;

// ── Tiny TTL cache (also shares one in-flight request between concurrent callers) ──
const cache = new Map(); // key -> { expiresAt, promise }

function cached(key, fn) {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.promise;
  if (cache.size >= CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value);
  const promise = Promise.resolve().then(fn);
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, promise });
  // Don't keep failures around — retry on the next crawl.
  promise.then((v) => { if (v && v.error) cache.delete(key); }, () => cache.delete(key));
  return promise;
}

async function getJSON(url) {
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        // The backend bans IPs that send no User-Agent (see shareMeta.js).
        'User-Agent': `PlanIt-Prerender/1.0 (+${SITE_URL})`,
      },
    });
    if (res.status === 404) return { notFound: true };
    if (!res.ok) {
      console.warn(`[blog-prerender] ${url} -> HTTP ${res.status}`);
      return { error: true };
    }
    return { data: await res.json() };
  } catch (err) {
    console.warn(`[blog-prerender] ${url} -> ${err.message}`);
    return { error: true };
  }
}

/** Resolves to { post } | { notFound: true } | { error: true } */
export function fetchPost(apiBase, slug) {
  return cached(`post:${slug}`, async () => {
    const r = await getJSON(`${apiBase}/blog/${encodeURIComponent(slug)}`);
    if (r.notFound || r.error) return r;
    return r.data?.post?.title ? { post: r.data.post } : { notFound: true };
  });
}

/** Resolves to { posts } | { error: true } (newest/featured first, max 50 like the API). */
export function fetchPosts(apiBase) {
  return cached('posts', async () => {
    const r = await getJSON(`${apiBase}/blog?limit=50`);
    if (r.error || r.notFound) return { error: true };
    return { posts: Array.isArray(r.data?.posts) ? r.data.posts : [] };
  });
}

// ── HTML helpers ──────────────────────────────────────────────────────────────
function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function truncate(str, n) {
  const s = String(str || '').trim();
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
}

function jsonLd(obj) {
  // </script> inside a string must not be able to close the tag.
  const json = JSON.stringify(obj).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  return `<script type="application/ld+json">${json}</script>`;
}

function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(`${d}T12:00:00`);
  return Number.isNaN(dt.getTime())
    ? String(d)
    : dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function isoDate(d) {
  if (!d) return undefined;
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? undefined : dt.toISOString();
}

/**
 * Same markdown subset as <Prose> in src/pages/Blog.jsx (## / ### headings,
 * - / * and 1. lists, fenced code, ---, **bold**, *italic*, `code`), so crawlers
 * see the same text structure visitors do. Everything is HTML-escaped first.
 */
export function markdownToHtml(content) {
  const lines = String(content || '').trim().split('\n');
  const out = [];
  let list = [];
  let listType = 'ul';
  let inCode = false;
  let code = [];

  const inline = (t) => esc(t)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>');

  const flush = () => {
    if (!list.length) return;
    out.push(`<${listType}>${list.map((li) => `<li>${inline(li)}</li>`).join('')}</${listType}>`);
    list = [];
  };

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (!inCode) { inCode = true; code = []; }
      else { flush(); out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`); inCode = false; }
      continue;
    }
    if (inCode) { code.push(line); continue; }
    if (line.startsWith('## ')) { flush(); out.push(`<h2>${esc(line.slice(3))}</h2>`); }
    else if (line.startsWith('### ')) { flush(); out.push(`<h3>${esc(line.slice(4))}</h3>`); }
    else if (line.startsWith('- ') || line.startsWith('* ')) { listType = 'ul'; list.push(line.slice(2)); }
    else if (/^\d+\. /.test(line)) { listType = 'ol'; list.push(line.replace(/^\d+\. /, '')); }
    else if (line.trim() === '---') { flush(); out.push('<hr>'); }
    else if (line.trim() === '') { flush(); }
    else { flush(); out.push(`<p>${inline(line)}</p>`); }
  }
  flush();
  return out.join('\n');
}

// Minimal, readable styling for the pre-rendered shell (visitors never see this).
const SHELL_STYLE = 'font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:720px;margin:0 auto;padding:24px;line-height:1.65;color:#1c1917';

function siteNav() {
  return `<nav aria-label="Site"><a href="/">PlanIt</a> · <a href="/blog">Blog</a> · <a href="/discover">Discover</a> · <a href="/help">Help</a> · <a href="/about">About</a></nav>`;
}

function postLinks(posts, { exclude, limit } = {}) {
  const list = (posts || []).filter((p) => p.slug && p.slug !== exclude).slice(0, limit || 50);
  if (!list.length) return '';
  return `<ul>${list.map((p) => `<li><a href="/blog/${esc(p.slug)}">${esc(p.title)}</a>${p.excerpt ? ` — ${esc(truncate(p.excerpt, 140))}` : ''}</li>`).join('')}</ul>`;
}

// ── Page builders ─────────────────────────────────────────────────────────────
function setRoot(html, inner) {
  const re = /<div id="root">\s*<\/div>/i;
  const block = `<div id="root"><div style="${SHELL_STYLE}">${inner}</div></div>`;
  return re.test(html) ? html.replace(re, () => block) : html;
}

function addToHead(html, extra) {
  return html.replace('</head>', () => `    ${extra}\n  </head>`);
}

/**
 * Drop the homepage-only extras index.html ships with: its structured data
 * (FAQ, WebApplication...) and the <noscript> homepage blurb (which has its own
 * <h1>). Blog pages carry their own, and a second homepage <h1> would muddy
 * what the page is about.
 */
function stripGenericJsonLd(html) {
  const out = html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\s*/gi, '');
  const bodyAt = out.search(/<body[\s>]/i);
  if (bodyAt === -1) return out;
  return out.slice(0, bodyAt) + out.slice(bodyAt).replace(/<noscript>[\s\S]*?<\/noscript>\s*/i, '');
}

export function buildPostPage({ html, post, relatedPosts, injectMeta }) {
  const url = `${SITE_URL}/blog/${post.slug}`;
  const title = `${post.title} — PlanIt Blog`;
  const description = truncate(post.excerpt || post.content?.replace(/[#*`>-]/g, ' ').replace(/\s+/g, ' '), 200);
  const published = isoDate(post.publishDate);
  const modified = isoDate(post.updatedAt) || published;

  let out = stripGenericJsonLd(html);
  out = injectMeta(out, { title, description, image: DEFAULT_IMAGE, url, type: 'article' });
  out = addToHead(out, [
    '<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large" />',
    published ? `<meta property="article:published_time" content="${esc(published)}" />` : '',
    modified ? `<meta property="article:modified_time" content="${esc(modified)}" />` : '',
    `<meta property="article:author" content="${esc(post.author || 'PlanIt Team')}" />`,
    post.category ? `<meta property="article:section" content="${esc(post.category)}" />` : '',
    '<meta name="twitter:card" content="summary_large_image" />',
    jsonLd({
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: truncate(post.title, 110),
      description,
      image: [DEFAULT_IMAGE],
      datePublished: published,
      dateModified: modified,
      author: { '@type': 'Organization', name: post.author || 'PlanIt Team', url: SITE_URL },
      publisher: { '@type': 'Organization', name: 'PlanIt', logo: { '@type': 'ImageObject', url: `${SITE_URL}/pwa-512x512.png` } },
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
      articleSection: post.category || undefined,
      keywords: Array.isArray(post.tags) && post.tags.length ? post.tags.join(', ') : undefined,
      timeRequired: post.readTime ? `PT${post.readTime}M` : undefined,
    }),
    jsonLd({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'PlanIt', item: `${SITE_URL}/` },
        { '@type': 'ListItem', position: 2, name: 'Blog', item: `${SITE_URL}/blog` },
        { '@type': 'ListItem', position: 3, name: post.title, item: url },
      ],
    }),
  ].filter(Boolean).join('\n    '));

  const related = postLinks(relatedPosts, { exclude: post.slug, limit: 6 });
  return setRoot(out, `
    ${siteNav()}
    <article>
      <p>${esc(post.category || 'Event Planning')}</p>
      <h1>${esc(post.title)}</h1>
      <p>${esc(post.author || 'PlanIt Team')}${post.publishDate ? ` · <time datetime="${esc(post.publishDate)}">${esc(fmtDate(post.publishDate))}</time>` : ''}${post.readTime ? ` · ${esc(post.readTime)} min read` : ''}</p>
      ${post.excerpt ? `<p><em>${esc(post.excerpt)}</em></p>` : ''}
      ${markdownToHtml(post.content)}
    </article>
    ${related ? `<aside><h2>More from the PlanIt blog</h2>${related}</aside>` : ''}
    <footer><a href="/blog">← All articles</a> · <a href="/">Plan an event free with PlanIt</a></footer>`);
}

export function buildIndexPage({ html, posts, injectMeta }) {
  const url = `${SITE_URL}/blog`;
  const title = 'PlanIt Blog · Ideas and Guides for Event Planners';
  const description = 'Guides, tips, and ideas for planning better events and running smoother venues.';

  let out = stripGenericJsonLd(html);
  out = injectMeta(out, { title, description, image: DEFAULT_IMAGE, url, type: 'website' });
  out = addToHead(out, [
    '<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large" />',
    jsonLd({
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: 'PlanIt Blog',
      url,
      description,
      publisher: { '@type': 'Organization', name: 'PlanIt', url: SITE_URL },
      blogPost: posts.slice(0, 50).map((p) => ({
        '@type': 'BlogPosting', headline: p.title, url: `${SITE_URL}/blog/${p.slug}`, datePublished: isoDate(p.publishDate),
      })),
    }),
  ].join('\n    '));

  return setRoot(out, `
    ${siteNav()}
    <h1>PlanIt Blog</h1>
    <p>${esc(description)}</p>
    ${postLinks(posts)}`);
}

/** 404 for an unknown slug: real status + noindex, SPA shell still boots for humans. */
export function buildNotFoundPage({ html }) {
  return addToHead(html, '<meta name="robots" content="noindex" />');
}
