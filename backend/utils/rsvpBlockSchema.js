/**
 * backend/utils/rsvpBlockSchema.js
 *
 * Server-side validation for rsvpPageConfig.sections. This intentionally
 * duplicates the BLOCK_TYPES / LAYOUT_VARIANTS tables in
 * frontend/src/components/rsvpBlocks/theme.js — the frontend can't safely
 * be trusted to enforce this on its own (a client can PATCH the API
 * directly), and the backend can't import a .js file that lives in the
 * Vite frontend tree. Keep these two lists in sync by hand until/unless
 * this becomes a real shared package; a mismatch here fails closed (an
 * unrecognized type/layout is rejected, not silently accepted), so drift
 * shows up immediately as "add block" failing in the builder rather than
 * as a stored-data inconsistency.
 */

const BLOCK_TYPES = [
  'hero', 'hostCard', 'about', 'tags', 'socialLinks', 'agenda', 'speakerLineup',
  'photoGallery', 'sponsorStrip', 'countdown', 'mapEmbed', 'faq', 'richText',
  'videoEmbed', 'testimonials', 'divider',
];

const LAYOUT_VARIANTS = {
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
};

const FIXED_TRAILING_BLOCK = 'rsvpForm';
const FIXED_TRAILING_ID = 'rsvp-form-fixed';
const MAX_SECTIONS = 40;
const VALID_SPACING = ['compact', 'default', 'spacious'];
const VALID_ALIGNMENT = ['left', 'center'];
const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * Validates and normalizes a proposed sections array before it's persisted.
 * Throws a { statusCode, message } style error on the first problem found
 * (fail closed — a partially-invalid payload is rejected wholesale, not
 * partially applied, so the stored config is never a mix of old and new).
 *
 * @returns {Array} the normalized sections array (safe to persist as-is)
 */
function validateSections(sections) {
  if (!Array.isArray(sections)) {
    throw httpError(400, 'sections must be an array.');
  }
  if (sections.length === 0) {
    throw httpError(400, 'sections cannot be empty — the RSVP form block is required.');
  }
  if (sections.length > MAX_SECTIONS) {
    throw httpError(400, `A page can have at most ${MAX_SECTIONS} sections.`);
  }

  const last = sections[sections.length - 1];
  if (last.type !== FIXED_TRAILING_BLOCK || last.id !== FIXED_TRAILING_ID) {
    throw httpError(400, 'The RSVP form block must be present and last — it cannot be reordered, removed, or duplicated.');
  }

  const seenIds = new Set();
  const body = sections.slice(0, -1);

  for (const [i, section] of body.entries()) {
    if (section.type === FIXED_TRAILING_BLOCK) {
      throw httpError(400, `Section ${i}: the RSVP form block can only appear once, as the last section.`);
    }
    if (!BLOCK_TYPES.includes(section.type)) {
      throw httpError(400, `Section ${i}: unknown block type "${section.type}".`);
    }
    if (typeof section.id !== 'string' || !section.id.trim()) {
      throw httpError(400, `Section ${i}: missing id.`);
    }
    if (seenIds.has(section.id)) {
      throw httpError(400, `Section ${i}: duplicate section id "${section.id}".`);
    }
    seenIds.add(section.id);

    const validLayouts = LAYOUT_VARIANTS[section.type] || [];
    if (validLayouts.length > 0 && !validLayouts.includes(section.layout)) {
      throw httpError(400, `Section ${i} (${section.type}): invalid layout "${section.layout}".`);
    }

    const style = section.style || {};
    if (style.spacing && !VALID_SPACING.includes(style.spacing)) {
      throw httpError(400, `Section ${i} (${section.type}): invalid spacing "${style.spacing}".`);
    }
    if (style.alignment && !VALID_ALIGNMENT.includes(style.alignment)) {
      throw httpError(400, `Section ${i} (${section.type}): invalid alignment "${style.alignment}".`);
    }
    if (style.accentOverride && !HEX_COLOR.test(style.accentOverride)) {
      throw httpError(400, `Section ${i} (${section.type}): accentOverride must be a hex color.`);
    }
  }

  return sections;
}

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

module.exports = { BLOCK_TYPES, LAYOUT_VARIANTS, FIXED_TRAILING_BLOCK, FIXED_TRAILING_ID, MAX_SECTIONS, validateSections };
