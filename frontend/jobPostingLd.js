/**
 * frontend/jobPostingLd.js
 *
 * ONE place that turns a public job listing (the shape GET /api/careers/jobs returns) into
 * Google-for-Jobs structured data. It is imported by BOTH:
 *   - careersPrerender.js (server.js) -> baked into the HTML crawlers download
 *   - src/pages/Careers.jsx           -> injected for visitors / Google's JS rendering pass
 * so the markup Google reads is identical either way. Plain JS, no imports, so Node can load it.
 *
 * Things Google checks (https://developers.google.com/search/docs/appearance/structured-data/job-posting):
 *   - title, description (HTML ok), datePosted, hiringOrganization, and a location:
 *     jobLocation for on-site/hybrid, or jobLocationType TELECOMMUTE + applicantLocationRequirements for remote
 *   - validThrough must be dropped/removed once the role is closed: closed roles return null here
 *   - totalJobOpenings is how "3 openings for this role" is expressed
 * Google does not guarantee a listing appears; this just makes every open role eligible.
 */

const escHtml = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clean = (arr) => (Array.isArray(arr) ? arr : []).map((x) => String(x || '').trim()).filter(Boolean);

// Country (ISO 3166-1 alpha-2) Google should treat the role as located in / open to.
// Roles say "Remote (anywhere)", so list the countries you actually accept applicants from.
export const JOB_COUNTRIES = ['US'];

/** The role body as HTML. Shared by the JSON-LD description and the crawler page so the text matches. */
export function jobDescriptionHtml(job) {
  const parts = [];
  const intro = job.description || job.tagline || job.title;
  if (intro) parts.push(...String(intro).split(/\n{2,}/).map((p) => `<p>${escHtml(p.trim()).replace(/\n/g, '<br>')}</p>`));
  const section = (h, items) => { const l = clean(items); if (l.length) parts.push(`<h3>${h}</h3><ul>${l.map((i) => `<li>${escHtml(i)}</li>`).join('')}</ul>`); };
  section('What you will do', job.responsibilities);
  section('What we are looking for', job.requirements);
  section('Nice to have', job.niceToHave);
  section('Perks', job.perks);
  if (job.compensationNote) parts.push(`<h3>Compensation</h3><p>${escHtml(job.compensationNote)}</p>`);
  return parts.join('');
}

const dateOnly = (d) => { const t = d ? new Date(d) : null; return t && !Number.isNaN(t.getTime()) ? t.toISOString() : undefined; };

/** JobPosting object, or null when the role is closed / past its deadline (closed roles must not carry markup). */
export function buildJobPostingLd(job, siteUrl) {
  if (!job || !job.open || !job.slug || job.slug === 'general') return null;
  const origin = String(siteUrl || '').replace(/\/+$/, '');
  const openings = Math.max(1, Math.min(99, Math.round(Number(job.openings)) || 1));
  const ld = {
    '@context': 'https://schema.org/',
    '@type': 'JobPosting',
    title: job.title,
    description: jobDescriptionHtml(job),
    identifier: { '@type': 'PropertyValue', name: 'PlanIt', value: job.slug },
    datePosted: dateOnly(job.postedAt),
    employmentType: 'VOLUNTEER',
    directApply: true,
    totalJobOpenings: openings,
    url: `${origin}/careers/${job.slug}`,
    hiringOrganization: { '@type': 'Organization', name: 'PlanIt', sameAs: origin, url: origin, logo: `${origin}/pwa-512x512.png` },
  };
  const until = dateOnly(job.deadline);
  if (until) ld.validThrough = until;
  if (job.skills?.length) ld.skills = clean(job.skills).join(', ');
  if (job.workMode === 'remote') {
    ld.jobLocationType = 'TELECOMMUTE';
    ld.applicantLocationRequirements = JOB_COUNTRIES.map((c) => ({ '@type': 'Country', name: c }));
  } else {
    ld.jobLocation = { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: job.location || '', addressCountry: JOB_COUNTRIES[0] } };
    if (job.workMode === 'hybrid') ld.description += '<p>Hybrid role.</p>';
  }
  return ld;
}
