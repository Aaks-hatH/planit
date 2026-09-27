/**
 * frontend/shareMeta.js
 *
 * Single source of truth for "which PlanIt routes get a real, page-specific
 * title/description/image when someone pastes the link into WhatsApp,
 * iMessage, Slack, Discord, etc., and where does that data come from".
 *
 * Add a new page here and server.js's bot-preview middleware picks it up
 * automatically — nothing else needs to change.
 *
 * Two kinds of entries:
 *
 *   DYNAMIC_ROUTES  — pages whose title depends on data in the database
 *                      (an event, an invite, a blog post...). Each entry:
 *                        test:    RegExp matched against the pathname
 *                                 (leading slash, no trailing slash, no
 *                                 query string). First match wins, so more
 *                                 specific patterns must come before more
 *                                 general ones (see /rsvp/manage/ note below).
 *                        resolve: async (match, apiBase) => ({ title, ... })
 *                                 Fetches whatever PUBLIC, side-effect-free
 *                                 backend endpoint has the data, and returns
 *                                 null (never throws past its own try/catch)
 *                                 if there's nothing better to show — the
 *                                 caller falls back to the default PlanIt
 *                                 tags already baked into index.html, so a
 *                                 missing/deleted event never breaks a share.
 *
 *   STATIC_ROUTES   — plain marketing/info pages. No backend call needed,
 *                      just a nicer, page-specific og:title/description
 *                      than the single generic homepage one index.html ships
 *                      with. Keyed by exact pathname (no trailing slash).
 *
 * IMPORTANT: only wire up backend endpoints here that are public
 * (no auth) and don't have side effects (view counters, rate-limited writes,
 * marking something as read, etc.) — this can run once per crawler, and in
 * practice a single pasted link is often unfurled by more than one app
 * (e.g. both the OS-level iMessage preview and a Slack repost of the same
 * link), so treat it like moderately-cached public read traffic.
 */

const DEFAULT_IMAGE = 'https://planitapp.onrender.com/planit-og.png';

// WhatsApp, iMessage, and most link-preview crawlers don't render SVG —
// when og:image fails to decode, several of them drop the ENTIRE preview
// card (title included) rather than just showing no image. Event covers
// come from Cloudinary, which can convert format on the fly via a URL
// transformation segment (e.g. /upload/f_png/...), so an SVG cover is
// rewritten to a real PNG at share-time rather than thrown away in favor
// of generic PlanIt branding — the whole point is showing THIS event's
// image, not an ad for PlanIt.
function shareableImage(url) {
  if (!url) return null;
  const clean = url.split('#')[0];
  const isSvg = /\.svg(\?|$)/i.test(clean.split('?')[0]);
  if (!isSvg) return url;

  // Cloudinary URLs look like:
  //   https://res.cloudinary.com/<cloud>/image/upload/v123/path/file.svg
  // Facebook/WhatsApp's crawler (and others) flatly don't support SVG for
  // og:image — jpg/png/gif/webp only, no exceptions. Cloudinary rasterizes
  // on the fly if we ask for f_png, but some validators sniff the URL's own
  // file extension (not just the response Content-Type) before deciding
  // whether to even fetch it — so this rewrites BOTH the transform flag
  // *and* the trailing extension, giving back a URL that reads as a plain
  // .png the whole way through, e.g.:
  //   .../upload/f_png,q_auto/v123/path/file.png
  // Cloudinary honors the f_png flag regardless of the extension asked
  // for, so this is a safe rename, not just cosmetic.
  const m = clean.match(/^(https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.*)\.svg$/i);
  if (m) return `${m[1]}f_png,q_auto/${m[2]}.png`;

  // Not a Cloudinary URL we know how to transform — can't safely serve
  // this SVG to crawlers, so signal "no usable image" and let the caller
  // fall back to DEFAULT_IMAGE.
  return null;
}

function truncate(str, n) {
  if (!str) return '';
  const s = String(str).trim();
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
}

// "Sat, Jun 14 · The Garden Room" style subtitle used across several resolvers
function dateAndLocation(date, location) {
  const bits = [];
  if (date) {
    try {
      const d = new Date(date);
      if (!Number.isNaN(d.getTime())) {
        bits.push(d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }));
      }
    } catch { /* ignore bad dates, just omit */ }
  }
  if (location) bits.push(location);
  return bits.join(' · ');
}

async function getJSON(url) {
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        // The backend's trafficGuard middleware bans any IP that sends
        // requests with no/empty User-Agent (it looks identical to a
        // scripted probe). Node's built-in fetch doesn't set one by
        // default, and every one of these calls comes from this same
        // frontend server's fixed outbound IP — so without this header,
        // a single burst of crawler re-fetches (WhatsApp alone does ~9
        // in a few seconds) was enough to warn-then-ban this server's
        // own IP, breaking previews for everyone for the next 30 minutes.
        'User-Agent': 'PlanIt-ShareMeta/1.0 (+https://planitapp.onrender.com)',
      },
    });
    if (!res.ok) {
      // Don't swallow this silently — a 500 from the backend and a
      // genuine 404 look identical to the caller otherwise, which makes
      // real backend failures (race conditions, DB hiccups, etc.)
      // invisible in the share-preview debug logs.
      let body = '';
      try { body = (await res.text()).slice(0, 300); } catch { /* ignore */ }
      console.warn(`[share-preview] ${url} -> HTTP ${res.status}${body ? ` — ${body}` : ''}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn(`[share-preview] ${url} -> ${err.message}`); // network/backend hiccup — caller falls back to default tags
    return null;
  }
}

// ── In-flight/short-TTL cache ─────────────────────────────────────────────────
// Link-preview crawlers (WhatsApp especially) re-fetch the same URL several
// times within a few seconds of a single paste. Without this, each of those
// hits triggered its own independent backend call — multiplying load for no
// reason and, worse, multiplying how many "missing UA"/rapid-request warns a
// short burst could rack up. Concurrent callers for the same path now share
// one in-flight promise, and a completed result is reused for a short window
// after that, so a 9-request WhatsApp burst results in exactly ONE backend
// call instead of nine.
const RESOLVE_CACHE_TTL_MS = 20_000;
const _resolveCache = new Map(); // pathname -> { expiresAt, promise }

function cachedResolve(key, fn) {
  const hit = _resolveCache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.promise;

  const promise = Promise.resolve().then(fn);
  _resolveCache.set(key, { expiresAt: Date.now() + RESOLVE_CACHE_TTL_MS, promise });
  // Don't let a thrown rejection poison the cache for the full TTL — clear
  // it immediately so the next request gets a fresh attempt. (route.resolve
  // implementations already catch their own errors and resolve to null, so
  // this is just a safety net.)
  promise.catch(() => _resolveCache.delete(key));
  return promise;
}

/* ── resolvers ──────────────────────────────────────────────────────────── */

async function resolveRsvp([, slug], apiBase) {
  const data = await getJSON(`${apiBase}/rsvp/${encodeURIComponent(slug)}/page`);
  if (!data || data.closed) return null;
  const title = data.title || data.rawTitle;
  if (!title) return null;
  const subtitle = dateAndLocation(data.date, data.location);
  const firstCover = Object.values(data.coverUrlsById || {})[0];
  return {
    title,
    description: truncate([subtitle, data.description].filter(Boolean).join(' — ') || `RSVP to ${title} on PlanIt.`, 200),
    // heroCoverUrl (added backend-side) already accounts for a hero's direct
    // content.coverImageUrl — the path the builder's normal "Upload Cover"
    // flow actually uses — not just the coverImageId->File lookup. Keep the
    // older fields as fallbacks for events that predate that field.
    image: shareableImage(data.heroCoverUrl) || shareableImage(data.rsvpPage?.coverImageUrl) || shareableImage(firstCover) || DEFAULT_IMAGE,
  };
}

async function resolveInvite([, , inviteCode], apiBase) {
  const data = await getJSON(`${apiBase}/events/invite/${encodeURIComponent(inviteCode)}`);
  if (!data?.event?.title) return null;
  const { event, invite } = data;
  const title = invite?.guestName
    ? `You're invited, ${invite.guestName}! — ${event.title}`
    : `You're invited — ${event.title}`;
  const subtitle = dateAndLocation(event.date, event.location);
  return {
    title,
    description: truncate(subtitle || event.description || `An invitation to ${event.title}.`, 200),
  };
}

async function resolveReserve([, subdomain], apiBase) {
  const data = await getJSON(`${apiBase}/events/public/reserve/${encodeURIComponent(subdomain)}`);
  if (!data?.name) return null;
  // Organizers can already set these in Reservation Page Settings — the
  // backend has returned them for a while (see routes/events.js
  // public/reserve/:subdomain) but nothing ever read them back out.
  const title = data.metaTitle || `Reserve a table at ${data.name}`;
  const description = truncate(
    data.metaDescription || data.tagline || data.description || `Book your table at ${data.name} on PlanIt.`,
    200
  );
  return { title, description, image: shareableImage(data.heroImageUrl) || DEFAULT_IMAGE };
}

async function resolveEventWorkspace([, eventId], apiBase) {
  const data = await getJSON(`${apiBase}/events/public/${eventId}`);
  const ev = data?.event;
  if (!ev?.title) return null;
  const subtitle = dateAndLocation(ev.date, ev.location);
  return {
    title: ev.title,
    description: truncate(subtitle || ev.description || `${ev.title} — planned on PlanIt.`, 200),
  };
}

async function resolveBlog([, slug], apiBase) {
  const data = await getJSON(`${apiBase}/blog/${encodeURIComponent(slug)}`);
  const post = data?.post;
  if (!post?.title) return null;
  return {
    title: `${post.title} — PlanIt Blog`,
    description: truncate(post.excerpt || '', 200),
    type: 'article',
  };
}

// Order matters: /rsvp/manage/:token must NOT be swallowed by the RSVP
// pattern below it, so the negative lookahead comes first.
const DYNAMIC_ROUTES = [
  { test: /^\/rsvp\/(?!manage\/)([^/]+)$/, resolve: resolveRsvp },
  { test: /^\/(invite|card|badge)\/([^/]+)$/, resolve: resolveInvite },
  { test: /^\/e\/([^/]+)\/reserve$/, resolve: resolveReserve },
  { test: /^\/event\/([a-f0-9]{24})$/i, resolve: resolveEventWorkspace },
  { test: /^\/blog\/([^/]+)$/, resolve: resolveBlog },
];

// Plain info/marketing pages — no DB call, just better copy than the one
// generic homepage description index.html ships with. Add more any time;
// this list doesn't need to match PAGE_TITLES in App.jsx exactly (that one
// drives the *tab title* for real visitors and already works fine — this
// one only drives *link-preview cards*), but keeping them in sync is good
// practice.
const STATIC_ROUTES = {
  '/': {
    title: 'PlanIt — Free Event Planning & Restaurant Management Software',
    description: 'Create events in seconds — team chat, RSVP, QR check-in, tasks, seating maps, waitlists & live floor management. No account required.',
  },
  '/about': {
    title: 'About PlanIt · Built for Event Planners and Venue Managers',
    description: 'The story behind PlanIt and why it was built for people who run events and restaurants, not just software teams.',
  },
  '/discover': {
    title: 'Discover Events Near You · PlanIt',
    description: 'Browse public events created with PlanIt.',
  },
  '/help': {
    title: 'Help Center and Frequently Asked Questions · PlanIt',
    description: 'Answers to common questions about creating, running, and managing events on PlanIt.',
  },
  '/support': {
    title: 'Contact Support · PlanIt',
    description: 'Get help from the PlanIt team.',
  },
  '/blog': {
    title: 'PlanIt Blog · Ideas and Guides for Event Planners',
    description: 'Guides, tips, and ideas for planning better events and running smoother venues.',
  },
  '/status': {
    title: 'Platform Status and Live Uptime · PlanIt',
    description: 'Live uptime and incident history for the PlanIt platform.',
  },
  '/white-label': {
    title: 'Launch Your Own Branded Event Platform · PlanIt White Label',
    description: 'Run PlanIt under your own brand and domain.',
  },
  '/terms': { title: 'Terms of Service · PlanIt' },
  '/privacy': { title: 'Privacy Policy · PlanIt' },
  '/license': { title: 'Platform License Agreement · PlanIt' },
};

/**
 * Look up share metadata for a path. Returns null if nothing applies (the
 * caller should leave index.html's default tags untouched), otherwise an
 * object with a `resolve(apiBase)` method that fetches/returns the
 * { title, description?, image?, type? } to inject.
 */
export function matchShareRoute(pathname) {
  const clean = (pathname || '/').replace(/\/+$/, '') || '/';

  for (const route of DYNAMIC_ROUTES) {
    const match = clean.match(route.test);
    if (match) return { resolve: (apiBase) => cachedResolve(clean, () => route.resolve(match, apiBase)) };
  }

  const staticEntry = STATIC_ROUTES[clean];
  if (staticEntry) return { resolve: async () => staticEntry };

  return null;
}
