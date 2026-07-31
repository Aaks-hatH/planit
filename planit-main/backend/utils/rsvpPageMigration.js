/**
 * backend/utils/rsvpPageMigration.js
 *
 * Converts the legacy flat `event.rsvpPage` settings object into the new
 * section-based `event.rsvpPageConfig` shape used by RSVPPageRenderer.jsx.
 *
 * This is intentionally READ-ONLY with respect to `rsvpPage` — it never
 * mutates or deletes the old field. `rsvpPage` stays in the schema exactly
 * as-is so no historical data is lost, and so this function can be re-run
 * safely (it is idempotent: running it twice on the same event produces the
 * same sections array, aside from fresh `id`s if `preserveIds` isn't passed).
 *
 * Usage (one-time backfill, run from a migration script):
 *
 *   const Event = require('../models/Event');
 *   const { migrateFlatConfigToSections } = require('./rsvpPageMigration');
 *
 *   const events = await Event.find({ 'rsvpPageConfig.migratedAt': null });
 *   for (const event of events) {
 *     const config = migrateFlatConfigToSections(event);
 *     event.rsvpPageConfig = { ...config, migratedAt: new Date() };
 *     await event.save();
 *   }
 */

const crypto = require('crypto');

function stableId(prefix, seed) {
  // Deterministic id derived from event id + block type, so re-running the
  // migration against the same event produces the same section ids instead
  // of new ones every time (important once organizers start editing).
  const hash = crypto.createHash('sha1').update(String(seed)).digest('hex').slice(0, 8);
  return `${prefix}_${hash}`;
}

function defaultStyle(overrides = {}) {
  return { spacing: 'default', alignment: 'center', accentOverride: null, ...overrides };
}

/**
 * @param {Object} event - a full Event mongoose document or plain object with
 *   at least: _id, title, description, date, location, organizerName,
 *   rsvpPage (the legacy flat object).
 * @returns {{ accentColor: string, sections: Array }}
 */
function migrateFlatConfigToSections(event) {
  const flat = event.rsvpPage || {};
  const eventId = event._id || event.id || 'unmigrated';
  const sections = [];

  // ── hero ───────────────────────────────────────────────────────────────
  // Built from title/date/location + whatever cover/logo used to exist.
  // coverImageId is left null here — Part 5's generator is what populates a
  // real generated cover; the migration does not fabricate one, since the
  // legacy coverImageUrl was a raw external URL, not a tracked File/cover
  // asset, and mixing the two would violate "no paste-your-own-cover-URL"
  // going forward. The organizer is prompted to pick a template in the
  // builder after migration; until they do, hero renders title/date/location
  // as text over a plain accent-tinted background (see HeroBlock's
  // coverImageId == null fallback).
  sections.push({
    id: stableId('hero', `${eventId}-hero`),
    type: 'hero',
    layout: 'stack',
    style: defaultStyle(),
    content: {
      title: flat.welcomeTitle || event.title || '',
      subtitle: flat.heroTagline || '',
      dateTime: event.date || null,
      location: flat.showEventLocation === false ? '' : (event.location || ''),
      coverImageId: null,
      _legacyCoverImageUrl: flat.coverImageUrl || null, // carried forward for the builder to offer as a starting reference only, never rendered directly
    },
  });

  // ── hostCard ───────────────────────────────────────────────────────────
  // Only added if the legacy config was actually showing host info, and/or
  // an organizer name exists. Legacy schema has no host photo/role field
  // (just organizerName), so this block starts single-entry and minimal.
  if (flat.showHostName !== false && event.organizerName) {
    sections.push({
      id: stableId('hostCard', `${eventId}-host`),
      type: 'hostCard',
      layout: 'row',
      style: defaultStyle({ alignment: 'left' }),
      content: {
        hosts: [{ name: event.organizerName, role: 'Host', avatarUrl: '' }],
      },
    });
  }

  // ── about ──────────────────────────────────────────────────────────────
  const aboutText = flat.welcomeMessage || event.description || '';
  if (aboutText.trim()) {
    sections.push({
      id: stableId('about', `${eventId}-about`),
      type: 'about',
      layout: 'full',
      style: defaultStyle(),
      content: { bodyText: aboutText },
    });
  }

  // ── countdown ──────────────────────────────────────────────────────────
  // Legacy `showCountdown` was a boolean toggle keyed off event.date.
  if (flat.showCountdown && event.date) {
    sections.push({
      id: stableId('countdown', `${eventId}-countdown`),
      type: 'countdown',
      layout: 'inline',
      style: defaultStyle(),
      content: { targetDateTime: event.date, label: 'Time until the event' },
    });
  }

  // ── divider before the form, purely cosmetic, matches old visual rhythm ──
  sections.push({
    id: stableId('divider', `${eventId}-divider-pre-form`),
    type: 'divider',
    layout: null,
    style: defaultStyle(),
    content: {},
  });

  // ── rsvpForm — FIXED, always last, cannot be reordered/removed ─────────
  // All the legacy field-collection settings (requireFirstName,
  // collectDietary, customQuestions, confirmation screen copy, email
  // notification settings, gmailAuth, rate limiting, etc.) are NOT
  // translated into a `content` blob here. They keep living on
  // `event.rsvpPage` untouched and the rsvpForm block reads them from there
  // at render time via its own hook (see RSVPPageRenderer's RsvpFormBlock).
  // This is deliberate: that config is 40+ fields of *form behavior*, not
  // *page layout*, and duplicating it into rsvpPageConfig would create two
  // sources of truth for the same settings. Only the block's presence and
  // position in `sections` is new; its behavior is unchanged, per spec.
  sections.push({
    id: 'rsvp-form-fixed', // always this literal id — the renderer/builder special-case it
    type: 'rsvpForm',
    layout: null,
    style: defaultStyle(),
    content: {},
  });

  return {
    accentColor: flat.accentColor || '#6366f1',
    sections,
  };
}

module.exports = { migrateFlatConfigToSections };
