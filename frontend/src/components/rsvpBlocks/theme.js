/**
 * frontend/src/components/rsvpBlocks/theme.js
 *
 * Single source of truth for RSVP page visual tokens. Previously FONTS and
 * getBgStyle were each independently defined in RSVPPageBuilder.jsx and
 * RSVPPage.jsx (the bug this task calls out explicitly). Both the builder's
 * preview and the public page now import from here — there is exactly one
 * place to change a font stack or background treatment.
 */

export const FONTS = {
  modern:  { heading: 'font-bold tracking-tight',             body: 'font-normal',             label: 'Modern',  sub: 'Clean & contemporary' },
  classic: { heading: 'font-serif font-bold',                 body: 'font-serif',               label: 'Classic', sub: 'Timeless serif style' },
  elegant: { heading: 'font-light tracking-widest uppercase', body: 'font-light tracking-wide', label: 'Elegant', sub: 'Light & airy lettering' },
  bold:    { heading: 'font-black tracking-tight',            body: 'font-medium',              label: 'Bold',    sub: 'Heavy & impactful' },
};

export const BG_OPTIONS = [
  { value: 'dark',     label: 'Dark',     sub: 'Deep dark background', preview: '#0a0a12' },
  { value: 'light',    label: 'Light',    sub: 'Clean white / grey',   preview: '#f9fafb' },
  { value: 'gradient', label: 'Gradient', sub: 'Dark with color glow', preview: 'linear-gradient(135deg,#0f0f1a,#1a1035)' },
  { value: 'frosted',  label: 'Frosted',  sub: 'Frosted-glass dark',   preview: 'rgba(15,15,26,0.95)' },
];

export function getBgStyle(style, accent) {
  switch (style) {
    case 'light':    return { background: '#f9fafb', color: '#111827' };
    case 'gradient': return { background: `linear-gradient(135deg, #0f0f1a 0%, ${accent}22 50%, #0f0f1a 100%)`, color: '#fff' };
    case 'frosted':  return { background: 'rgba(15,15,26,0.95)', color: '#fff' };
    default:         return { background: '#0a0a12', color: '#fff' };
  }
}

export const PRESET_COLORS = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#0ea5e9', '#f97316', '#14b8a6', '#a855f7'];

/** Every block type in the library, in the order the "add block" menu shows them. */
export const BLOCK_TYPES = [
  'hero', 'hostCard', 'about', 'tags', 'socialLinks', 'agenda', 'speakerLineup',
  'photoGallery', 'sponsorStrip', 'countdown', 'mapEmbed', 'faq', 'richText',
  'videoEmbed', 'testimonials', 'divider',
];

/** rsvpForm is intentionally excluded from BLOCK_TYPES — it's not addable/removable, see RSVPPageRenderer. */
export const FIXED_TRAILING_BLOCK = 'rsvpForm';

export const LAYOUT_VARIANTS = {
  hero: ['stack', 'split'],
  hostCard: ['row', 'stack'],
  about: ['full', 'twoColumn'],
  tags: ['row'],
  socialLinks: ['row'],
  agenda: ['list', 'timeline'],
  speakerLineup: ['grid', 'row'],
  photoGallery: ['grid', 'carousel'],
  sponsorStrip: ['row', 'grid'],
  countdown: ['inline', 'banner'],
  mapEmbed: ['full', 'split'],
  faq: ['accordion'],
  richText: ['full', 'twoColumn'],
  videoEmbed: ['full', 'split'],
  testimonials: ['row', 'stack'],
  divider: [],
  rsvpForm: [],
};

/** Resolves the effective accent color for one section: its own override, else the page default. */
export function resolveAccent(section, pageAccentColor) {
  return (section?.style?.accentOverride) || pageAccentColor || '#6366f1';
}

const SPACING_CLASS = { compact: 'py-6 md:py-8', default: 'py-10 md:py-14', spacious: 'py-16 md:py-24' };
export function spacingClass(spacing) {
  return SPACING_CLASS[spacing] || SPACING_CLASS.default;
}

const ALIGN_CLASS = { left: 'text-left items-start', center: 'text-center items-center' };
export function alignClass(alignment) {
  return ALIGN_CLASS[alignment] || ALIGN_CLASS.center;
}
