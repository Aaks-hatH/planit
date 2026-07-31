/**
 * frontend/src/components/rsvpBlocks/contentSchema.js
 *
 * Declarative description of each block type's editable `content` fields.
 * One generic editor (BlockContentEditor.jsx) renders from this instead of
 * 16 bespoke hand-built forms — adding a 17th block type later means adding
 * one schema entry, not a new form component.
 *
 * Field `type` values understood by BlockContentEditor:
 *   'text' | 'textarea' | 'datetime' | 'number' | 'url' | 'color' |
 *   'coverPicker' | 'imageUpload' | 'list'
 *
 * For `type: 'list'`, `itemFields` describes each item's own fields (or, for
 * a plain string list like `tags`, itemFields is omitted and each item is
 * edited as a bare text input).
 */

export const BLOCK_LABELS = {
  hero: 'Hero', hostCard: 'Host', about: 'About', tags: 'Tags',
  socialLinks: 'Social Links', agenda: 'Agenda', speakerLineup: 'Speakers',
  photoGallery: 'Photo Gallery', sponsorStrip: 'Sponsors', countdown: 'Countdown',
  mapEmbed: 'Map', faq: 'FAQ', richText: 'Rich Text', videoEmbed: 'Video',
  testimonials: 'Testimonials', divider: 'Divider', rsvpForm: 'RSVP Form',
};

export const CONTENT_SCHEMA = {
  hero: [
    { key: 'title', label: 'Title', type: 'text' },
    { key: 'subtitle', label: 'Subtitle', type: 'text' },
    { key: 'dateTime', label: 'Date & time', type: 'datetime' },
    { key: 'location', label: 'Location', type: 'text' },
    { key: 'coverImageId', label: 'Cover graphic', type: 'coverPicker' },
  ],
  hostCard: [
    { key: 'hosts', label: 'Hosts', type: 'list', itemFields: [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'role', label: 'Role', type: 'text' },
      { key: 'avatarUrl', label: 'Photo', type: 'imageUpload' },
    ] },
  ],
  about: [{ key: 'bodyText', label: 'Body text', type: 'textarea' }],
  tags: [{ key: 'tags', label: 'Tags', type: 'list' }],
  socialLinks: [
    { key: 'links', label: 'Links', type: 'list', itemFields: [
      { key: 'platform', label: 'Platform', type: 'text' },
      { key: 'url', label: 'URL', type: 'url' },
    ] },
  ],
  agenda: [
    { key: 'items', label: 'Agenda items', type: 'list', itemFields: [
      { key: 'time', label: 'Time', type: 'text' },
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'description', label: 'Description', type: 'textarea' },
    ] },
  ],
  speakerLineup: [
    { key: 'speakers', label: 'Speakers', type: 'list', itemFields: [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'org', label: 'Organization', type: 'text' },
      { key: 'photoUrl', label: 'Photo', type: 'imageUpload' },
    ] },
  ],
  photoGallery: [
    { key: 'images', label: 'Photos', type: 'list', itemFields: [
      { key: 'url', label: 'Image', type: 'imageUpload' },
      { key: 'alt', label: 'Alt text', type: 'text' },
    ] },
  ],
  sponsorStrip: [
    { key: 'sponsors', label: 'Sponsors', type: 'list', itemFields: [
      { key: 'logoUrl', label: 'Logo', type: 'imageUpload' },
      { key: 'linkUrl', label: 'Link', type: 'url' },
    ] },
  ],
  countdown: [
    { key: 'targetDateTime', label: 'Target date & time', type: 'datetime' },
    { key: 'label', label: 'Label', type: 'text' },
  ],
  mapEmbed: [
    { key: 'address', label: 'Address', type: 'text' },
    { key: 'zoom', label: 'Zoom level', type: 'number' },
  ],
  faq: [
    { key: 'items', label: 'Questions', type: 'list', itemFields: [
      { key: 'question', label: 'Question', type: 'text' },
      { key: 'answer', label: 'Answer', type: 'textarea' },
    ] },
  ],
  richText: [{ key: 'html', label: 'Content (basic HTML)', type: 'textarea' }],
  videoEmbed: [{ key: 'url', label: 'Video URL (YouTube/Vimeo)', type: 'url' }],
  testimonials: [
    { key: 'items', label: 'Testimonials', type: 'list', itemFields: [
      { key: 'quote', label: 'Quote', type: 'textarea' },
      { key: 'author', label: 'Author', type: 'text' },
      { key: 'role', label: 'Role', type: 'text' },
    ] },
  ],
  divider: [],
};

export function defaultContentFor(type) {
  switch (type) {
    case 'hero': return { title: '', subtitle: '', dateTime: null, location: '', coverImageId: null };
    case 'hostCard': return { hosts: [] };
    case 'about': return { bodyText: '' };
    case 'tags': return { tags: [] };
    case 'socialLinks': return { links: [] };
    case 'agenda': return { items: [] };
    case 'speakerLineup': return { speakers: [] };
    case 'photoGallery': return { images: [] };
    case 'sponsorStrip': return { sponsors: [] };
    case 'countdown': return { targetDateTime: null, label: '' };
    case 'mapEmbed': return { address: '', zoom: 14 };
    case 'faq': return { items: [] };
    case 'richText': return { html: '' };
    case 'videoEmbed': return { url: '' };
    case 'testimonials': return { items: [] };
    case 'divider': return {};
    default: return {};
  }
}

export function defaultLayoutFor(type, LAYOUT_VARIANTS) {
  const variants = LAYOUT_VARIANTS[type] || [];
  return variants[0] || null;
}
