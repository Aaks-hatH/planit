/**
 * backend/services/coverGenerator.js
 *
 * Server-side generated cover graphic system (spec Part 5). Renders a JSX/CSS
 * layout to an SVG string via satori (the same underlying approach Vercel
 * uses for @vercel/og), uploads that SVG to Cloudinary, and tracks it through
 * the existing File model exactly the way other uploaded assets are tracked.
 *
 * ── Why this does NOT reuse backend/routes/files.js's multer upload route ──
 * That route's fileFilter deliberately EXCLUDES image/svg+xml (see the V-05
 * comment in files.js: "SVGs execute JS in browser" / stored-XSS risk for
 * arbitrary user-uploaded files). That fix is correct and must stay in place
 * for the general upload endpoint — it protects against a user uploading an
 * arbitrary attacker-crafted .svg file.
 *
 * This is a different situation: nothing here is a raw file a user submitted.
 * Every SVG produced by this module is built by OUR OWN template JSX, with
 * all dynamic strings (title, host name, org name) passed through satori as
 * plain text content — satori has no HTML/script execution path, it only
 * emits <text> nodes, same as React does for string children. There is no
 * point where a user-supplied string is interpreted as markup. So this
 * module talks to `cloudinary.uploader.upload` directly with resource_type
 * 'image' and the pre-built SVG buffer, bypassing multer/fileFilter entirely
 * — it is not a route a client can POST arbitrary bytes to.
 *
 * If this reasoning ever needs revisiting (e.g. templates start accepting
 * organizer-authored HTML), stop and re-run it past the same scrutiny that
 * produced the original file-upload fix before shipping.
 */

const crypto = require('crypto');
const satori = require('satori').default || require('satori');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const os = require('os');
const path = require('path');
const File = require('../models/File');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

const WIDTH = 1200;
const HEIGHT = 630;

// Fonts: satori needs real font bytes (TTF/OTF/WOFF — it can't use system
// fonts), and needs a separate static file per weight — a single variable
// font file does NOT reliably give you distinct 400/700 rendering through
// satori's layout engine. The path below matches `@fontsource/inter`
// (`npm install @fontsource/inter`), whose `files/` directory ships real
// static per-weight WOFF files. Verified directly against satori: these
// two exact files render both weights correctly.
//   cp node_modules/@fontsource/inter/files/inter-latin-400-normal.woff backend/assets/fonts/Inter-Regular.woff
//   cp node_modules/@fontsource/inter/files/inter-latin-700-normal.woff backend/assets/fonts/Inter-Bold.woff
// Any other source works too as long as it's two real static-weight font
// files (TTF/OTF/WOFF) — Google Fonts' own download for Inter is a variable
// font only, which is why this doesn't just point at fonts.google.com.
let _fontCache = null;
async function loadFonts() {
  if (_fontCache) return _fontCache;
  const regularPath = path.join(__dirname, '../assets/fonts/Inter-Regular.woff');
  const boldPath = path.join(__dirname, '../assets/fonts/Inter-Bold.woff');
  _fontCache = [
    { name: 'Inter', data: fs.readFileSync(regularPath), weight: 400, style: 'normal' },
    { name: 'Inter', data: fs.readFileSync(boldPath), weight: 700, style: 'normal' },
  ];
  return _fontCache;
}

function esc(str) {
  // Defense in depth even though satori text nodes can't execute markup —
  // strip control characters so nothing unexpected reaches the SVG text runs.
  return String(str || '').replace(/[\u0000-\u001f]/g, '').slice(0, 300);
}

/* ── template layouts ─────────────────────────────────────────────────── */
// Each template is a function returning a satori-compatible JSX-like object
// tree (plain objects, since this is plain Node — no JSX transform here).
// h() is a tiny hyperscript helper so templates stay readable.
function h(type, props, ...children) {
  // satori mirrors React's children convention: a single child must be
  // passed as a bare value, not a one-element array, or satori's "more than
  // one child needs explicit display" check misfires even for exactly one
  // child. Collapse accordingly. (Verified against satori@0.x directly —
  // an earlier version of this helper that always wrapped in an array threw
  // on every leaf node until this was fixed.)
  const flat = children.flat().filter((c) => c !== null && c !== undefined && c !== false && c !== '');
  const resolvedChildren = flat.length === 1 ? flat[0] : flat.length === 0 ? undefined : flat;
  return { type, props: { ...props, children: resolvedChildren } };
}

function centeredStack({ title, dateLabel, hostName, accentColor }) {
  return h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', background: `linear-gradient(135deg, #0a0a12 0%, ${accentColor}33 100%)`, padding: 80, textAlign: 'center' } },
    h('div', { style: { fontSize: 60, fontWeight: 700, color: '#fff', lineHeight: 1.15 } }, esc(title)),
    dateLabel && h('div', { style: { fontSize: 28, color: accentColor, marginTop: 24 } }, esc(dateLabel)),
    hostName && h('div', { style: { fontSize: 22, color: 'rgba(255,255,255,0.6)', marginTop: 12 } }, `Hosted by ${esc(hostName)}`)
  );
}

function split({ title, dateLabel, hostName, hostPhotoUrl, accentColor }) {
  return h('div', { style: { display: 'flex', width: '100%', height: '100%', background: '#0a0a12' } },
    h('div', { style: { width: '40%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${accentColor}22` } },
      hostPhotoUrl
        ? h('img', { src: hostPhotoUrl, style: { width: 220, height: 220, borderRadius: '50%', objectFit: 'cover' } })
        : h('div', { style: { width: 220, height: 220, borderRadius: '50%', background: accentColor } })
    ),
    h('div', { style: { width: '60%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 60 } },
      h('div', { style: { fontSize: 52, fontWeight: 700, color: '#fff', lineHeight: 1.15 } }, esc(title)),
      dateLabel && h('div', { style: { fontSize: 26, color: accentColor, marginTop: 20 } }, esc(dateLabel)),
      hostName && h('div', { style: { fontSize: 20, color: 'rgba(255,255,255,0.6)', marginTop: 10 } }, esc(hostName))
    )
  );
}

function minimalWordmark({ title, accentColor }) {
  return h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', background: '#0a0a12' } },
    h('div', { style: { fontSize: 72, fontWeight: 700, letterSpacing: -2, color: '#fff', borderBottom: `4px solid ${accentColor}`, paddingBottom: 20 } }, esc(title))
  );
}

function gradientOrb({ title, dateLabel, accentColor }) {
  // Orb is declared first so it paints first (SVG has no z-index — paint
  // order is document order), text naturally sits on top without needing it.
  return h('div', { style: { position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', width: '100%', height: '100%', background: '#0a0a12', padding: 70, overflow: 'hidden' } },
    h('div', { style: { position: 'absolute', top: -150, right: -150, width: 500, height: 500, borderRadius: '50%', background: `radial-gradient(circle, ${accentColor}aa 0%, transparent 70%)` } }),
    h('div', { style: { fontSize: 58, fontWeight: 700, color: '#fff' } }, esc(title)),
    dateLabel && h('div', { style: { fontSize: 26, color: accentColor, marginTop: 16 } }, esc(dateLabel))
  );
}

const TEMPLATES = {
  'centered-stack': centeredStack,
  'split': split,
  'minimal-wordmark': minimalWordmark,
  'gradient-orb': gradientOrb,
};

/** Deterministic cache key — regenerate only when inputs that affect pixels actually change. */
function coverCacheKey({ template, title, date, hostName, hostPhotoUrl, logoUrl, accentColor }) {
  const raw = JSON.stringify({ template, title, date, hostName, hostPhotoUrl, logoUrl, accentColor });
  return crypto.createHash('sha1').update(raw).digest('hex');
}

/**
 * Generates (or returns the cached) cover for an event.
 * @param {Object} event - needs _id, title, date, organizerName
 * @param {Object} opts - { template, accentColor, hostPhotoUrl, logoUrl }
 * @returns {Promise<{ cloudinaryUrl: string, cloudinaryPublicId: string, cacheKey: string }>}
 */
async function generateCover(event, opts = {}) {
  const template = TEMPLATES[opts.template] ? opts.template : 'centered-stack';
  const accentColor = opts.accentColor || '#6366f1';
  const dateLabel = event.date
    ? new Date(event.date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
    : '';

  const cacheKey = coverCacheKey({
    template, title: event.title, date: event.date, hostName: event.organizerName,
    hostPhotoUrl: opts.hostPhotoUrl, logoUrl: opts.logoUrl, accentColor,
  });

  // Cache lookup: a File record tagged with this cacheKey already exists for this event.
  const existing = await File.findOne({
    eventId: event._id,
    isDeleted: false,
    originalName: `cover-${cacheKey}.svg`,
  });
  if (existing) {
    return { fileId: String(existing._id), cloudinaryUrl: existing.cloudinaryUrl, cloudinaryPublicId: existing.cloudinaryPublicId, cacheKey };
  }

  const fonts = await loadFonts();
  const tree = TEMPLATES[template]({
    title: event.title,
    dateLabel,
    hostName: event.organizerName,
    hostPhotoUrl: opts.hostPhotoUrl,
    accentColor,
  });

  const svg = await satori(tree, { width: WIDTH, height: HEIGHT, fonts });

  // Upload directly — see file header for why this intentionally does not
  // go through routes/files.js's multer/fileFilter pipeline.
  const tmpPath = path.join(os.tmpdir(), `planit-cover-${Date.now()}-${cacheKey}.svg`);
  fs.writeFileSync(tmpPath, svg);
  let result;
  try {
    result = await cloudinary.uploader.upload(tmpPath, {
      folder: 'planit-events/covers',
      resource_type: 'image',
      public_id: `cover-${event._id}-${cacheKey}`,
      overwrite: true,
    });
  } finally {
    try { fs.unlinkSync(tmpPath); } catch (_) {}
  }

  // Clean up any previous cover for this event (regeneration path) before tracking the new one.
  const previous = await File.find({ eventId: event._id, isDeleted: false, originalName: { $regex: '^cover-' } });
  for (const prev of previous) {
    await prev.deleteFromCloudinary();
    prev.isDeleted = true;
    prev.deletedAt = new Date();
    await prev.save();
  }

  const fileDoc = await File.create({
    eventId: event._id,
    filename: `${cacheKey}.svg`,
    originalName: `cover-${cacheKey}.svg`,
    mimetype: 'image/svg+xml',
    size: Buffer.byteLength(svg),
    cloudinaryUrl: result.secure_url,
    cloudinaryPublicId: result.public_id,
    cloudinaryResourceType: 'image',
    uploadedBy: 'system:cover-generator',
  });

  return { fileId: String(fileDoc._id), cloudinaryUrl: fileDoc.cloudinaryUrl, cloudinaryPublicId: fileDoc.cloudinaryPublicId, cacheKey };
}

module.exports = { generateCover, TEMPLATES: Object.keys(TEMPLATES), coverCacheKey };
