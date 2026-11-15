/**
 * Turns whatever a person pastes (a full event URL, an /rsvp/ link or a bare
 * name) into the event slug. Same rules the homepage SlugFinder has always used.
 */
export function extractSlug(raw = '') {
  const input = String(raw).trim();
  if (!input) return '';
  let slug = input;
  try {
    const url = new URL(input.startsWith('http') ? input : `https://x.com/${input}`);
    const rsvp = url.pathname.match(/\/rsvp\/([^/?#]+)/);
    const event = url.pathname.match(/\/e\/([^/?#]+)/);
    if (rsvp) slug = rsvp[1];
    else if (event) slug = event[1];
    else slug = url.pathname.replace(/^\/+|\/+$/g, '');
  } catch { /* not a URL: use as typed */ }
  return slug.replace(/^\/?(rsvp\/|e\/)?/, '').replace(/\/+$/, '');
}
