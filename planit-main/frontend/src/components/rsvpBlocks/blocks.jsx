/**
 * frontend/src/components/rsvpBlocks/blocks.jsx
 *
 * One component per block type in the library. Every export is wrapped in
 * React.memo so that editing/reordering one section in the builder does not
 * re-render every other section (Part 3 performance requirement). Each
 * component receives a flat, identical prop contract so RSVPPageRenderer can
 * render any of them generically from the registry at the bottom of this file.
 *
 * Prop contract for every block:
 *   content  — section.content (block-specific shape, see spec Part 2)
 *   layout   — section.layout
 *   spacing  — section.style.spacing
 *   align    — section.style.alignment
 *   accent   — resolved accent color (section override or page default)
 *   fonts    — FONTS[fontStyle] from theme.js
 *   isLight  — boolean, true when the page background is the 'light' variant
 *
 * Images use loading="lazy" throughout per the spec. Below-the-fold mounting
 * is handled one level up by <InViewport> in RSVPPageRenderer.jsx, not here —
 * these components assume they're already worth rendering once mounted.
 */
import React from 'react';
import { spacingClass, alignClass } from './theme';

const Wrap = ({ spacing, align, className = '', children }) => (
  <section className={`w-full px-6 md:px-10 flex flex-col ${spacingClass(spacing)} ${alignClass(align)} ${className}`}>
    <div className="w-full max-w-3xl mx-auto">{children}</div>
  </section>
);

/* ── hero ──────────────────────────────────────────────────────────────── */
// A couple of small inline icons so date/location read as chips rather than
// bare strings — no icon package dependency, just two tiny paths.
const CalendarGlyph = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="3" /><path d="M16 2v4M8 2v4M3 10h18" />
  </svg>
);
const PinGlyph = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" />
  </svg>
);

// Mixes the page accent with a couple of warm, high-energy hues so every
// event — whatever accent color was picked — still lands on a lively,
// sun-bleached gradient rather than a flat tinted-black box. This is the
// hero card's OWN background; it doesn't touch the page-level backgroundStyle.
const heroGradient = (accent) => `
  radial-gradient(circle at 12% 18%, ${accent}80 0%, transparent 42%),
  radial-gradient(circle at 88% 12%, #ffd166a0 0%, transparent 40%),
  radial-gradient(circle at 78% 92%, #ff5d8fa8 0%, transparent 45%),
  radial-gradient(circle at 8% 90%, #14b8a680 0%, transparent 40%),
  linear-gradient(135deg, #120a1e 0%, #1a0f2e 60%, #0e1626 100%)
`;

export const HeroBlock = React.memo(function HeroBlock({ content, layout, spacing, align, accent, fonts }) {
  const { title, subtitle, dateTime, location, coverImageUrl } = content || {};
  const cover = coverImageUrl || null; // resolved cover URL, passed down by renderer after cover-cache lookup
  const dateStr = dateTime ? new Date(dateTime).toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' }) : '';
  // "split" now controls where the overlaid text sits (left vs. centered),
  // not a side-by-side image — the cover graphic and the hero copy are
  // always one merged card, never a picture next to a second text block.
  const leftAlign = layout === 'split';
  const eyebrow = subtitle || (title ? `You're invited to ${title}` : "You're invited");

  return (
    <section className={`w-full ${spacingClass(spacing)} px-4 md:px-10`}>
      <div
        className={`relative max-w-5xl mx-auto overflow-hidden rounded-[2rem] md:rounded-[2.5rem] shadow-2xl ${cover ? 'aspect-[4/5] md:aspect-[16/9]' : 'aspect-[4/5] md:aspect-[21/9]'}`}
        style={cover ? undefined : { background: heroGradient(accent) }}
      >
        {cover && (
          <>
            <img src={cover} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover" />
            {/* scrim so overlaid text stays legible on any generated cover */}
            <div className="absolute inset-0" style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.15) 45%, rgba(0,0,0,0.35) 100%)' }} />
          </>
        )}
        {!cover && (
          <>
            <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full blur-3xl opacity-60" style={{ background: '#ffd166' }} />
            <div className="absolute -bottom-20 -left-10 w-72 h-72 rounded-full blur-3xl opacity-50" style={{ background: accent }} />
          </>
        )}

        <div
          className={`relative z-10 h-full w-full flex flex-col justify-end gap-3 p-6 md:p-12 text-white ${leftAlign ? 'items-start text-left' : 'items-center text-center'}`}
        >
          {eyebrow && (
            <span
              className="inline-flex items-center gap-1.5 uppercase tracking-[0.15em] text-[10px] md:text-xs font-semibold px-3 py-1.5 rounded-full backdrop-blur-md border border-white/25"
              style={{ background: `${accent}33`, color: '#fff' }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: accent }} />
              {eyebrow}
            </span>
          )}
          <h1 className={`text-4xl md:text-7xl leading-[1.05] drop-shadow-[0_2px_12px_rgba(0,0,0,0.45)] ${fonts.heading}`}>
            {title || 'Untitled Event'}
          </h1>
          {(dateStr || location) && (
            <div className={`flex flex-wrap gap-2 mt-1 ${leftAlign ? 'justify-start' : 'justify-center'}`}>
              {dateStr && (
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs md:text-sm bg-white/10 backdrop-blur-md border border-white/20 ${fonts.body}`}>
                  <CalendarGlyph />{dateStr}
                </span>
              )}
              {location && (
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs md:text-sm bg-white/10 backdrop-blur-md border border-white/20 ${fonts.body}`}>
                  <PinGlyph />{location}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
});

/* ── hostCard ──────────────────────────────────────────────────────────── */
export const HostCardBlock = React.memo(function HostCardBlock({ content, layout, spacing, align, fonts }) {
  const hosts = content?.hosts || [];
  if (!hosts.length) return null;
  const row = layout !== 'stack';
  return (
    <Wrap spacing={spacing} align={align}>
      <div className={`flex ${row ? 'flex-row flex-wrap' : 'flex-col'} gap-6 justify-center`}>
        {hosts.map((h, i) => (
          <div key={i} className="flex items-center gap-3">
            {h.avatarUrl ? (
              <img src={h.avatarUrl} alt={h.name} loading="lazy" className="w-12 h-12 rounded-full object-cover" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-sm font-semibold">
                {(h.name || '?').slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="text-left">
              <div className={`${fonts.heading} text-base`}>{h.name}</div>
              {h.role && <div className="text-xs opacity-60">{h.role}</div>}
            </div>
          </div>
        ))}
      </div>
    </Wrap>
  );
});

/* ── about ─────────────────────────────────────────────────────────────── */
export const AboutBlock = React.memo(function AboutBlock({ content, layout, spacing, align, fonts }) {
  if (!content?.bodyText) return null;
  const two = layout === 'twoColumn';
  return (
    <Wrap spacing={spacing} align={align} className={two ? 'md:columns-2 md:gap-10' : ''}>
      <p className={`${fonts.body} leading-relaxed opacity-90 whitespace-pre-wrap`}>{content.bodyText}</p>
    </Wrap>
  );
});

/* ── tags ──────────────────────────────────────────────────────────────── */
export const TagsBlock = React.memo(function TagsBlock({ content, spacing, align, accent }) {
  const tags = content?.tags || content || [];
  if (!Array.isArray(tags) || !tags.length) return null;
  return (
    <Wrap spacing={spacing} align={align}>
      <div className="flex flex-wrap gap-2 justify-center">
        {tags.map((t, i) => (
          <span key={i} className="px-3 py-1 rounded-full text-xs font-medium border" style={{ borderColor: accent, color: accent }}>{t}</span>
        ))}
      </div>
    </Wrap>
  );
});

/* ── socialLinks ───────────────────────────────────────────────────────── */
export const SocialLinksBlock = React.memo(function SocialLinksBlock({ content, spacing, align, accent }) {
  const links = content?.links || [];
  if (!links.length) return null;
  return (
    <Wrap spacing={spacing} align={align}>
      <div className="flex flex-wrap gap-4 justify-center">
        {links.map((l, i) => (
          <a key={i} href={l.url} target="_blank" rel="noreferrer" className="text-sm font-medium underline underline-offset-4" style={{ color: accent }}>
            {l.platform}
          </a>
        ))}
      </div>
    </Wrap>
  );
});

/* ── agenda ────────────────────────────────────────────────────────────── */
export const AgendaBlock = React.memo(function AgendaBlock({ content, layout, spacing, align, accent, fonts }) {
  const items = content?.items || [];
  if (!items.length) return null;
  const timeline = layout === 'timeline';
  return (
    <Wrap spacing={spacing} align={align}>
      <div className={timeline ? 'relative border-l pl-6 flex flex-col gap-8 text-left' : 'flex flex-col gap-5 text-left'} style={timeline ? { borderColor: accent } : undefined}>
        {items.map((it, i) => (
          <div key={i} className="relative">
            {timeline && <span className="absolute -left-[29px] top-1 w-3 h-3 rounded-full" style={{ background: accent }} />}
            <div className="text-xs uppercase tracking-wide opacity-60">{it.time}</div>
            <div className={`${fonts.heading} text-lg`}>{it.title}</div>
            {it.description && <p className="text-sm opacity-75 mt-1">{it.description}</p>}
          </div>
        ))}
      </div>
    </Wrap>
  );
});

/* ── speakerLineup ─────────────────────────────────────────────────────── */
export const SpeakerLineupBlock = React.memo(function SpeakerLineupBlock({ content, layout, spacing, align, fonts }) {
  const speakers = content?.speakers || [];
  if (!speakers.length) return null;
  const grid = layout !== 'row';
  return (
    <Wrap spacing={spacing} align={align}>
      <div className={grid ? 'grid grid-cols-2 md:grid-cols-3 gap-6' : 'flex flex-row flex-wrap gap-6 justify-center'}>
        {speakers.map((s, i) => (
          <div key={i} className="flex flex-col items-center text-center gap-2">
            {s.photoUrl ? (
              <img src={s.photoUrl} alt={s.name} loading="lazy" className="w-20 h-20 rounded-full object-cover" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-white/10" />
            )}
            <div className={`${fonts.heading} text-sm`}>{s.name}</div>
            <div className="text-xs opacity-60">{[s.title, s.org].filter(Boolean).join(' · ')}</div>
          </div>
        ))}
      </div>
    </Wrap>
  );
});

/* ── photoGallery ──────────────────────────────────────────────────────── */
export const PhotoGalleryBlock = React.memo(function PhotoGalleryBlock({ content, layout, spacing, align }) {
  const images = content?.images || [];
  if (!images.length) return null;
  const carousel = layout === 'carousel';
  return (
    <Wrap spacing={spacing} align={align} className="!max-w-none">
      <div className={carousel ? 'flex gap-4 overflow-x-auto snap-x pb-2 max-w-4xl mx-auto' : 'grid grid-cols-2 md:grid-cols-3 gap-3 max-w-4xl mx-auto'}>
        {images.map((img, i) => (
          <img
            key={i}
            src={img.url || img}
            alt={img.alt || ''}
            loading="lazy"
            className={carousel ? 'h-56 w-72 shrink-0 snap-start object-cover rounded-xl' : 'aspect-square object-cover rounded-xl w-full'}
          />
        ))}
      </div>
    </Wrap>
  );
});

/* ── sponsorStrip ──────────────────────────────────────────────────────── */
export const SponsorStripBlock = React.memo(function SponsorStripBlock({ content, layout, spacing, align }) {
  const sponsors = content?.sponsors || [];
  if (!sponsors.length) return null;
  const grid = layout === 'grid';
  return (
    <Wrap spacing={spacing} align={align}>
      <div className={grid ? 'grid grid-cols-3 md:grid-cols-4 gap-6 items-center' : 'flex flex-wrap gap-8 items-center justify-center'}>
        {sponsors.map((s, i) => {
          const img = <img key={i} src={s.logoUrl} alt="" loading="lazy" className="h-8 md:h-10 object-contain opacity-80 hover:opacity-100 transition-opacity" />;
          return s.linkUrl ? <a key={i} href={s.linkUrl} target="_blank" rel="noreferrer">{img}</a> : img;
        })}
      </div>
    </Wrap>
  );
});

/* ── countdown ─────────────────────────────────────────────────────────── */
function useCountdown(target) {
  const [left, setLeft] = React.useState(() => Math.max(0, new Date(target).getTime() - Date.now()));
  React.useEffect(() => {
    const id = setInterval(() => setLeft(Math.max(0, new Date(target).getTime() - Date.now())), 1000);
    return () => clearInterval(id);
  }, [target]);
  const d = Math.floor(left / 86400000);
  const h = Math.floor((left % 86400000) / 3600000);
  const m = Math.floor((left % 3600000) / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return { d, h, m, s };
}
export const CountdownBlock = React.memo(function CountdownBlock({ content, layout, spacing, align, accent, fonts }) {
  const { targetDateTime, label } = content || {};
  const parts = useCountdown(targetDateTime || Date.now());
  if (!targetDateTime) return null;
  const banner = layout === 'banner';
  const Unit = ({ v, l }) => (
    <div className="flex flex-col items-center">
      <span className={`${fonts.heading} text-2xl md:text-3xl tabular-nums`} style={{ color: accent }}>{String(v).padStart(2, '0')}</span>
      <span className="text-[10px] uppercase tracking-wide opacity-60">{l}</span>
    </div>
  );
  return (
    <Wrap spacing={spacing} align={align} className={banner ? 'border-y' : ''}>
      {label && <p className="text-xs uppercase tracking-widest opacity-60 mb-3">{label}</p>}
      <div className="flex gap-6 justify-center">
        <Unit v={parts.d} l="days" /><Unit v={parts.h} l="hrs" /><Unit v={parts.m} l="min" /><Unit v={parts.s} l="sec" />
      </div>
    </Wrap>
  );
});

/* ── mapEmbed ──────────────────────────────────────────────────────────── */
export const MapEmbedBlock = React.memo(function MapEmbedBlock({ content, layout, spacing, align }) {
  const { address, lat, lng, zoom = 14 } = content || {};
  if (!address && !(lat && lng)) return null;
  const q = address ? encodeURIComponent(address) : `${lat},${lng}`;
  const src = `https://www.google.com/maps?q=${q}&z=${zoom}&output=embed`;
  const split = layout === 'split';
  return (
    <Wrap spacing={spacing} align={align} className="!max-w-none">
      <div className={`mx-auto ${split ? 'max-w-2xl' : 'max-w-4xl'} rounded-2xl overflow-hidden`}>
        <iframe title="Event location" src={src} loading="lazy" className="w-full h-72 md:h-96 border-0" />
      </div>
    </Wrap>
  );
});

/* ── faq ───────────────────────────────────────────────────────────────── */
export const FaqBlock = React.memo(function FaqBlock({ content, spacing, align, fonts }) {
  const items = content?.items || [];
  const [open, setOpen] = React.useState(null);
  if (!items.length) return null;
  return (
    <Wrap spacing={spacing} align={align}>
      <div className="flex flex-col divide-y divide-white/10 text-left">
        {items.map((it, i) => (
          <div key={i} className="py-4">
            <button
              type="button"
              onClick={() => setOpen(open === i ? null : i)}
              className={`w-full flex justify-between items-center ${fonts.heading} text-base`}
            >
              <span>{it.question}</span>
              <span className="opacity-50">{open === i ? '−' : '+'}</span>
            </button>
            {open === i && <p className="mt-2 text-sm opacity-75">{it.answer}</p>}
          </div>
        ))}
      </div>
    </Wrap>
  );
});

/* ── richText ──────────────────────────────────────────────────────────── */
export const RichTextBlock = React.memo(function RichTextBlock({ content, layout, spacing, align, fonts }) {
  if (!content?.html) return null;
  const two = layout === 'twoColumn';
  // content.html is produced by the builder's own rich-text editor, not arbitrary
  // user HTML from elsewhere — still passed through a sanitizer before storage
  // server-side (see rsvpPageConfig route) before it ever reaches this render.
  return (
    <Wrap spacing={spacing} align={align} className={two ? 'md:columns-2 md:gap-10' : ''}>
      <div className={`${fonts.body} prose prose-invert max-w-none`} dangerouslySetInnerHTML={{ __html: content.html }} />
    </Wrap>
  );
});

/* ── videoEmbed ────────────────────────────────────────────────────────── */
function toEmbedUrl(url) {
  if (!url) return null;
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/watch\?v=)([\w-]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vim = url.match(/vimeo\.com\/(\d+)/);
  if (vim) return `https://player.vimeo.com/video/${vim[1]}`;
  return url;
}
export const VideoEmbedBlock = React.memo(function VideoEmbedBlock({ content, layout, spacing, align }) {
  const embed = toEmbedUrl(content?.url);
  if (!embed) return null;
  const split = layout === 'split';
  return (
    <Wrap spacing={spacing} align={align} className="!max-w-none">
      <div className={`mx-auto ${split ? 'max-w-2xl' : 'max-w-4xl'} aspect-video rounded-2xl overflow-hidden`}>
        <iframe title="Event video" src={embed} loading="lazy" allowFullScreen className="w-full h-full border-0" />
      </div>
    </Wrap>
  );
});

/* ── testimonials ──────────────────────────────────────────────────────── */
export const TestimonialsBlock = React.memo(function TestimonialsBlock({ content, layout, spacing, align, fonts }) {
  const items = content?.items || [];
  if (!items.length) return null;
  const row = layout === 'row';
  return (
    <Wrap spacing={spacing} align={align}>
      <div className={row ? 'grid grid-cols-1 md:grid-cols-2 gap-6' : 'flex flex-col gap-6'}>
        {items.map((t, i) => (
          <blockquote key={i} className="text-left">
            <p className={`${fonts.body} italic opacity-90`}>&ldquo;{t.quote}&rdquo;</p>
            <footer className="mt-2 text-sm opacity-60">— {t.author}{t.role ? `, ${t.role}` : ''}</footer>
          </blockquote>
        ))}
      </div>
    </Wrap>
  );
});

/* ── divider ───────────────────────────────────────────────────────────── */
export const DividerBlock = React.memo(function DividerBlock({ accent }) {
  return (
    <div className="w-full flex justify-center py-4">
      <div className="w-24 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
    </div>
  );
});

/* ── registry ──────────────────────────────────────────────────────────── */
// rsvpForm is NOT in this registry — RSVPPageRenderer imports RsvpFormBlock
// directly and special-cases it, since it's the one block with real
// stateful submission logic rather than pure presentation.
export const BLOCK_COMPONENTS = {
  hero: HeroBlock,
  hostCard: HostCardBlock,
  about: AboutBlock,
  tags: TagsBlock,
  socialLinks: SocialLinksBlock,
  agenda: AgendaBlock,
  speakerLineup: SpeakerLineupBlock,
  photoGallery: PhotoGalleryBlock,
  sponsorStrip: SponsorStripBlock,
  countdown: CountdownBlock,
  mapEmbed: MapEmbedBlock,
  faq: FaqBlock,
  richText: RichTextBlock,
  videoEmbed: VideoEmbedBlock,
  testimonials: TestimonialsBlock,
  divider: DividerBlock,
};
