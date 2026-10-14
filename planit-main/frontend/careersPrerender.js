/**
 * frontend/careersPrerender.js
 *
 * Crawler-ready HTML for /careers and /careers/:slug, so Google for Jobs (and Bing / AI crawlers that
 * never run JavaScript) see every open role, its full description and its JobPosting structured data
 * (including how many openings there are) without waiting on the React app. Same approach and caching as
 * blogPrerender.js; visitors never get this HTML.
 *
 * Data: the public GET /api/careers/jobs list (open roles + roles closed in the last 45 days). The list is
 * used for single roles too, so a crawler burst never bumps the per-role "views" counter.
 */
import { cached, getJSON, esc, truncate, jsonLd, setRoot, addToHead, stripGenericJsonLd, siteNav, SITE_URL, DEFAULT_IMAGE } from './blogPrerender.js';
import { buildJobPostingLd, jobDescriptionHtml } from './jobPostingLd.js';

/** Resolves to { jobs } | { error: true } */
export function fetchJobs(apiBase) {
  return cached('careers:jobs', async () => {
    const r = await getJSON(`${apiBase}/careers/jobs`);
    if (r.error || r.notFound) return { error: true };
    return { jobs: Array.isArray(r.data?.jobs) ? r.data.jobs : [], accepting: r.data?.accepting !== false };
  });
}

const ROBOTS = 'index, follow, max-snippet:-1, max-image-preview:large';
const openingsText = (n) => (n > 1 ? `${n} openings` : '1 opening');

function roleList(jobs) {
  const open = jobs.filter((j) => j.open);
  if (!open.length) return '<p>There are no open volunteer roles right now. Check back soon.</p>';
  return `<ul>${open.map((j) => `<li><a href="/careers/${esc(j.slug)}">${esc(j.title)}</a> — ${esc(j.team || 'General')} · ${esc(j.workMode)} · ${esc(openingsText(j.openings || 1))}${j.tagline ? ` — ${esc(truncate(j.tagline, 140))}` : ''}</li>`).join('')}</ul>`;
}

export function buildCareersIndexPage({ html, jobs, injectMeta }) {
  const url = `${SITE_URL}/careers`;
  const open = jobs.filter((j) => j.open);
  const total = open.reduce((t, j) => t + (j.openings || 1), 0);
  const title = 'Careers · Volunteer with PlanIt';
  const description = open.length
    ? `${total} volunteer position${total === 1 ? '' : 's'} across ${open.length} open role${open.length === 1 ? '' : 's'} at PlanIt. Remote, flexible, unpaid roles in engineering, design, growth and community.`
    : 'Volunteer with PlanIt. Remote, flexible, unpaid roles in engineering, design, growth and community.';

  let out = stripGenericJsonLd(html);
  out = injectMeta(out, { title, description, image: DEFAULT_IMAGE, url, type: 'website' });
  out = addToHead(out, [
    `<meta name="robots" content="${ROBOTS}" />`,
    jsonLd({
      '@context': 'https://schema.org', '@type': 'CollectionPage', name: title, url, description,
      mainEntity: { '@type': 'ItemList', itemListElement: open.map((j, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE_URL}/careers/${j.slug}`, name: j.title })) },
    }),
  ].join('\n    '));
  return setRoot(out, `
    ${siteNav()}
    <h1>Volunteer with PlanIt</h1>
    <p>${esc(description)}</p>
    <h2>Open roles</h2>
    ${roleList(jobs)}`);
}

export function buildJobPage({ html, job, jobs, injectMeta }) {
  const url = `${SITE_URL}/careers/${job.slug}`;
  const openings = Math.max(1, job.openings || 1);
  const title = `${job.title} · Volunteer with PlanIt`;
  const description = truncate(`${job.tagline || job.title}${job.open ? ` ${openingsText(openings)}. ${job.workMode === 'remote' ? 'Remote' : job.location || ''} volunteer role at PlanIt.` : ''}`, 200);
  const ld = buildJobPostingLd(job, SITE_URL);

  let out = stripGenericJsonLd(html);
  out = injectMeta(out, { title, description, image: DEFAULT_IMAGE, url, type: 'website' });
  out = addToHead(out, [
    // A closed role stays reachable for people with the link, but must leave Google's index.
    `<meta name="robots" content="${job.open ? ROBOTS : 'noindex, follow'}" />`,
    ld ? jsonLd(ld) : '',
    jsonLd({
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'PlanIt', item: `${SITE_URL}/` },
        { '@type': 'ListItem', position: 2, name: 'Careers', item: `${SITE_URL}/careers` },
        { '@type': 'ListItem', position: 3, name: job.title, item: url },
      ],
    }),
  ].filter(Boolean).join('\n    '));

  const facts = [job.team, job.workMode, job.location, job.hoursPerWeek, job.duration, job.open ? openingsText(openings) : ''].filter(Boolean);
  const others = jobs.filter((j) => j.open && j.slug !== job.slug);
  return setRoot(out, `
    ${siteNav()}
    <article>
      <p><a href="/careers">← All roles</a></p>
      <h1>${esc(job.title)}</h1>
      ${job.open ? '' : `<p><strong>This role is closed${job.closedReason ? `: ${esc(job.closedReason)}` : ''}.</strong></p>`}
      ${job.tagline ? `<p><em>${esc(job.tagline)}</em></p>` : ''}
      <p>${facts.map(esc).join(' · ')}</p>
      ${jobDescriptionHtml(job)}
      ${job.open ? `<p><a href="/careers/${esc(job.slug)}">Apply for this role</a></p>` : ''}
    </article>
    ${others.length ? `<aside><h2>Other open roles</h2>${roleList(others)}</aside>` : ''}
    <footer><a href="/careers">All PlanIt volunteer roles</a> · <a href="/">PlanIt</a></footer>`);
}
