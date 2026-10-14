'use strict';

/**
 * routes/careers.js  ->  mounted at /api/careers
 *
 * PUBLIC
 *   GET  /jobs                 open + recently closed volunteer roles, plus the global "accepting" flag
 *   GET  /jobs/:slug           one role (counts a view)
 *   POST /apply                submit an application (rate limited, honeypot, Turnstile, de-duplicated)
 *   POST /funnel               tiny funnel beacon (page_view, role_open, apply_start, step_2, ...)
 *
 * ADMIN (verifyAdmin + canViewHiring / canManageHiring)
 *   GET    /admin/overview             stats: pipeline, sources, funnel, 30-day trend, engagement
 *   GET    /admin/jobs                 all listings incl. drafts + application counts
 *   POST   /admin/jobs                 create listing
 *   PUT    /admin/jobs/:id             edit listing
 *   POST   /admin/jobs/:id/close       close a listing  { reason? }
 *   POST   /admin/jobs/:id/reopen      reopen a listing
 *   DELETE /admin/jobs/:id             delete a listing (applications keep a title snapshot)
 *   GET    /admin/applications         filter + paginate
 *   PATCH  /admin/applications/:id     status / rating / tags / notes
 *   DELETE /admin/applications/:id
 *   GET    /admin/applications.csv     export
 *   PUT    /admin/settings             pause / resume ALL applications
 *   POST   /admin/test-alert           fire a real test to Discord + ntfy (+ Slack)
 */

const express   = require('express');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

const JobListing      = require('../models/JobListing');
const JobApplication  = require('../models/JobApplication');
const CareerEvent     = require('../models/CareerEvent');
const CareersSettings = require('../models/CareersSettings');
const OrgNode         = require('../models/OrgNode');
const Employee        = require('../models/Employee');
const mongoose        = require('mongoose');
const { SOURCES }     = JobApplication;
const { EVENTS }      = CareerEvent;

const { realIp }           = require('../middleware/realIp');
const { verifyAdmin, requirePermission, requireSuperAdminRole } = require('../middleware/auth');
const { verifyTurnstile }  = require('../services/captchaService');
const { recordIdentity }   = require('../services/identityService');
const { audit }            = require('../models/AuditLog');
const notify               = require('../services/careersNotify');

const router = express.Router();

const canView   = requirePermission('canViewHiring');
const canManage = requirePermission('canManageHiring');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VID_RE = /^v_[a-z0-9_]{6,60}$/i;
const SID_RE = /^s_[a-z0-9_]{6,60}$/i;
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function str(v, max = 200) {
  return String(v ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max);
}
function num(v, min, max, fallback = 0) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
function cleanUrl(v, max = 300) {
  let s = str(v, max);
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes('.')) return '';
    return u.toString().slice(0, max);
  } catch { return ''; }
}
function lines(v, maxItems = 20, maxLen = 300) {
  const arr = Array.isArray(v) ? v : String(v ?? '').split('\n');
  return arr.map((x) => str(x, maxLen)).filter(Boolean).slice(0, maxItems);
}
function slugify(t) {
  return String(t || '').toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '')
    .trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 70) || 'role';
}
async function uniqueSlug(base, ignoreId = null) {
  let slug = base, i = 2;
  // eslint-disable-next-line no-await-in-loop
  while (await JobListing.exists({ slug, ...(ignoreId ? { _id: { $ne: ignoreId } } : {}) })) slug = `${base}-${i++}`;
  return slug;
}
function deviceType(ua = '') {
  if (/ipad|tablet|kindle|silk|playbook/i.test(ua)) return 'tablet';
  if (/mobi|iphone|android/i.test(ua)) return 'mobile';
  return ua ? 'desktop' : 'unknown';
}
function cleanTouch(t) {
  if (!t || typeof t !== 'object') return {};
  const at = t.at ? new Date(t.at) : null;
  return {
    source: str(t.source, 60), medium: str(t.medium, 60), campaign: str(t.campaign, 100),
    content: str(t.content, 100), term: str(t.term, 100), ref: str(t.ref, 100),
    referrer: str(t.referrer, 300), landing: str(t.landing, 300),
    at: at && !isNaN(at) ? at : null,
  };
}
function readIds(req, b) {
  const h = req.headers || {};
  const vid = String(h['x-planit-vid'] || req.query?._vid || b?.visitorId || '');
  const sid = String(h['x-planit-sid'] || req.query?._sid || b?.sessionId || '');
  return { vid: VID_RE.test(vid) ? vid : '', sid: SID_RE.test(sid) ? sid : '' };
}

function publicJob(j, now = new Date()) {
  const deadlinePassed = j.deadline && new Date(j.deadline) < now;
  const open = j.status === 'open' && !deadlinePassed;
  return {
    slug: j.slug, title: j.title, team: j.team, tagline: j.tagline,
    type: j.type, workMode: j.workMode, location: j.location,
    hoursPerWeek: j.hoursPerWeek, duration: j.duration,
    description: j.description, responsibilities: j.responsibilities, requirements: j.requirements,
    niceToHave: j.niceToHave, perks: j.perks, skills: j.skills,
    questions: (j.questions || []).map((q) => ({ label: q.label, required: !!q.required })),
    compensationNote: j.compensationNote, openings: j.openings,
    featured: !!j.featured, deadline: j.deadline || null,
    open,
    closedReason: open ? '' : (j.status === 'closed' ? (j.closedReason || '') : (deadlinePassed ? 'Application deadline passed' : '')),
    postedAt: j.createdAt,
  };
}

function csvCell(v) {
  let s = Array.isArray(v) ? v.join('; ') : (v instanceof Date ? v.toISOString() : String(v ?? ''));
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;          // neutralise spreadsheet formula injection
  return `"${s.replace(/"/g, '""')}"`;
}

// ─── Limiters ─────────────────────────────────────────────────────────────────

const applyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 6, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => realIp(req) || 'unknown',
  message: { error: 'Too many applications from this connection. Please try again later.' },
});
const funnelLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 240, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => realIp(req) || 'unknown',
  message: { error: 'slow down' },
});

// ══════════════════════════════════════════════════════════════════════════════
// PUBLIC
// ══════════════════════════════════════════════════════════════════════════════

router.get('/jobs', async (_req, res, next) => {
  try {
    const now = new Date();
    const cutoff = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);   // closed roles stay visible for 45 days
    const [settings, jobs] = await Promise.all([
      CareersSettings.get(),
      JobListing.find({ $or: [{ status: 'open' }, { status: 'closed', closedAt: { $gte: cutoff } }] })
        .sort({ featured: -1, sortOrder: 1, createdAt: -1 }).lean(),
    ]);
    const list = jobs.map((j) => publicJob(j, now)).sort((a, b) => Number(b.open) - Number(a.open));
    res.set('Cache-Control', 'public, max-age=30');
    res.json({
      accepting: !!settings.acceptingApplications,
      pausedMessage: settings.acceptingApplications ? '' : settings.pausedMessage,
      openRoles: list.filter((j) => j.open).length,
      jobs: list,
    });
  } catch (e) { next(e); }
});

router.get('/jobs/:slug', async (req, res, next) => {
  try {
    const job = await JobListing.findOneAndUpdate(
      { slug: str(req.params.slug, 90).toLowerCase(), status: { $in: ['open', 'closed'] } },
      { $inc: { views: 1 } },
      { new: true },
    ).lean();
    if (!job) return res.status(404).json({ error: 'Role not found' });
    const settings = await CareersSettings.get();
    res.json({ accepting: !!settings.acceptingApplications, job: publicJob(job) });
  } catch (e) { next(e); }
});

const urlField = (name) => body(name).optional({ checkFalsy: true })
  .custom((v) => cleanUrl(v) !== '').withMessage(`${name}: please enter a valid link`);
const mustBeTrue = (name, msg) => body(name).custom((v) => v === true || v === 'true').withMessage(msg);

router.post('/apply', applyLimiter, [
  body('fullName').trim().isLength({ min: 2, max: 120 }).withMessage('Please enter your full name'),
  body('email').trim().isEmail().withMessage('A valid email is required').isLength({ max: 200 }),
  body('phone').optional({ checkFalsy: true }).trim().isLength({ max: 40 }),
  body('location').optional({ checkFalsy: true }).trim().isLength({ max: 120 }),
  body('whyYou').trim().isLength({ min: 30, max: 3000 }).withMessage('Tell us a bit more about why you want to join (30+ characters)'),
  body('proudestWork').optional({ checkFalsy: true }).trim().isLength({ max: 2000 }),
  body('source').isIn(SOURCES).withMessage('Please tell us where you found us'),
  body('skills').optional().isArray({ max: 20 }),
  body('hoursPerWeek').optional({ checkFalsy: true }).isInt({ min: 0, max: 80 }),
  urlField('linkedin'), urlField('github'), urlField('portfolio'), urlField('resumeUrl'),
  mustBeTrue('ageConfirmed', 'You must be 16 or older to volunteer'),
  mustBeTrue('ackVolunteer', 'Please confirm you understand this is an unpaid volunteer role'),
  mustBeTrue('ackDataUse', 'Please agree to us storing your application'),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg, errors: errors.array().map((e) => ({ field: e.path, message: e.msg })) });
    }
    const b = req.body || {};

    // Honeypot - bots fill the hidden "company" field. Pretend success, store nothing.
    if (str(b.company, 50)) return res.json({ ok: true, ref: 'PLN-0000' });

    const settings = await CareersSettings.get();
    if (!settings.acceptingApplications) {
      return res.status(403).json({ error: settings.pausedMessage || 'Applications are paused right now.', paused: true });
    }

    const ip = realIp(req) || '';
    const ts = await verifyTurnstile(b.turnstileToken, ip, { failOpen: false, context: 'careers-apply' });
    if (!ts?.ok) return res.status(400).json({ error: 'Verification failed. Please refresh and try again.' });

    // Which role?
    let job = null;
    const jobSlug = str(b.jobSlug, 90).toLowerCase() || 'general';
    if (jobSlug !== 'general') {
      job = await JobListing.findOne({ slug: jobSlug });
      if (!job || !job.isOpenNow()) return res.status(409).json({ error: 'This role is closed and no longer accepting applications.', closed: true });
    }

    // Required custom questions
    const answers = [];
    if (job) {
      const given = Array.isArray(b.answers) ? b.answers : [];
      for (const q of job.questions || []) {
        const a = given.find((x) => x && str(x.label, 240) === q.label);
        const text = str(a?.answer, 1500);
        if (q.required && !text) return res.status(400).json({ error: `Please answer: "${q.label}"` });
        if (text) answers.push({ label: q.label, answer: text });
      }
    }

    const email = str(b.email, 200).toLowerCase();
    const dupe = await JobApplication.exists({ email, jobSlug, status: { $ne: 'withdrawn' } });
    if (dupe) return res.status(409).json({ error: "You've already applied for this role. We'll be in touch!", duplicate: true });

    const ua = str(req.headers['user-agent'], 300);
    const { vid, sid } = readIds(req, b);
    const dev = b.device && typeof b.device === 'object' ? b.device : {};
    const eng = b.engagement && typeof b.engagement === 'object' ? b.engagement : {};
    const source = SOURCES.includes(b.source) ? b.source : 'other';
    const detected = SOURCES.includes(b.detectedSource) ? b.detectedSource : str(b.detectedSource, 40);

    const app = await JobApplication.create({
      jobId: job?._id || null, jobSlug, jobTitle: job?.title || 'General application', jobTeam: job?.team || '',
      fullName: str(b.fullName, 120), email, phone: str(b.phone, 40), location: str(b.location, 120),
      timezone: str(b.timezone, 60), ageConfirmed: true,
      linkedin: cleanUrl(b.linkedin), github: cleanUrl(b.github), portfolio: cleanUrl(b.portfolio), resumeUrl: cleanUrl(b.resumeUrl, 400),
      currentStatus: ['student', 'working', 'between', 'freelance', 'other'].includes(b.currentStatus) ? b.currentStatus : '',
      organization: str(b.organization, 140),
      experienceLevel: ['beginner', 'intermediate', 'advanced', 'expert'].includes(b.experienceLevel) ? b.experienceLevel : '',
      skills: lines(b.skills, 20, 40),
      whyYou: str(b.whyYou, 3000), proudestWork: str(b.proudestWork, 2000),
      hoursPerWeek: b.hoursPerWeek === '' || b.hoursPerWeek == null ? null : num(b.hoursPerWeek, 0, 80, null),
      startDate: str(b.startDate, 40), answers,
      source, sourceDetail: str(b.sourceDetail, 200), detectedSource: detected,
      firstTouch: cleanTouch(b.firstTouch), lastTouch: cleanTouch(b.lastTouch),
      ackVolunteer: true, ackDataUse: true, ackedAt: new Date(),
      ip, country: str(req.headers['cf-ipcountry'] || req.headers['x-vercel-ip-country'] || req.headers['x-country-code'], 8),
      userAgent: ua, deviceType: deviceType(ua),
      language: str(dev.language, 20), platform: str(dev.platform, 40),
      screen: { w: num(dev.screenW, 0, 20000), h: num(dev.screenH, 0, 20000), dpr: num(dev.dpr, 0, 10) },
      viewport: { w: num(dev.viewportW, 0, 20000), h: num(dev.viewportH, 0, 20000) },
      colorScheme: ['dark', 'light'].includes(dev.colorScheme) ? dev.colorScheme : '',
      reducedMotion: !!dev.reducedMotion,
      visitorId: vid, sessionId: sid,
      scrollDepthMax: num(eng.scrollDepthMax, 0, 100), secondsOnPage: num(eng.secondsOnPage, 0, 86400),
      secondsOnForm: num(eng.secondsOnForm, 0, 86400),
      rolesViewed: lines(eng.rolesViewed, 15, 90), pageViewsInSession: num(eng.pageViews, 0, 500),
      returningVisitor: !!eng.returning,
      statusHistory: [{ status: 'new', by: 'applicant', at: new Date() }],
    });

    // Tie this person to the visitor ID so Admin -> PII lookup resolves every earlier visit.
    recordIdentity(req, { source: 'career_application', name: app.fullName, email: app.email, phone: app.phone, feature: 'career_application' });

    if (vid) CareerEvent.create({ event: 'apply_submit', jobSlug, source, visitorId: vid, sessionId: sid, scrollDepth: app.scrollDepthMax, seconds: app.secondsOnPage }).catch(() => {});

    // Alert - fire and forget, never blocks the applicant.
    setImmediate(() => {
      notify.alert({
        title: `New volunteer application: ${app.jobTitle}`,
        content: `${app.fullName} applied${app.location ? ` from ${app.location}` : ''} (via ${app.source}${app.sourceDetail ? `: ${app.sourceDetail}` : ''})`,
        level: 'info',
        applicationId: String(app._id),
        fields: [
          { name: 'Role', value: app.jobTitle, inline: true },
          { name: 'Source', value: app.source + (app.sourceDetail ? ` - ${app.sourceDetail}` : ''), inline: true },
          { name: 'Hours/week', value: app.hoursPerWeek ?? '', inline: true },
          { name: 'Email', value: app.email },
          { name: 'LinkedIn', value: app.linkedin },
          { name: 'GitHub', value: app.github },
          { name: 'Experience', value: [app.experienceLevel, app.currentStatus, app.organization].filter(Boolean).join(' | ') },
          { name: 'Skills', value: app.skills.join(', ') },
          { name: 'Why', value: app.whyYou.slice(0, 280) },
        ],
      }).catch((e) => console.warn('[careers] alert failed:', e.message));
    });

    res.json({ ok: true, ref: `PLN-${String(app._id).slice(-6).toUpperCase()}` });
  } catch (e) { next(e); }
});

router.post('/funnel', funnelLimiter, async (req, res) => {
  try {
    const b = req.body || {};
    if (!EVENTS.includes(b.event)) return res.sendStatus(204);
    const { vid, sid } = readIds(req, b);
    if (!vid) return res.sendStatus(204);
    await CareerEvent.create({
      event: b.event, jobSlug: str(b.jobSlug, 90).toLowerCase(), source: str(b.source, 40),
      visitorId: vid, sessionId: sid, scrollDepth: num(b.scrollDepth, 0, 100), seconds: num(b.seconds, 0, 86400),
    });
  } catch { /* analytics must never error */ }
  res.sendStatus(204);
});

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN
// ══════════════════════════════════════════════════════════════════════════════

const actorName = (req) => req.admin?.name || req.admin?.username || req.admin?.email || 'admin';

router.get('/admin/overview', verifyAdmin, canView, async (_req, res, next) => {
  try {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [settings, byStatus, bySource, perJob, daily, funnel, engagement, total, openJobs] = await Promise.all([
      CareersSettings.get(),
      JobApplication.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
      JobApplication.aggregate([
        { $group: {
          _id: '$source', n: { $sum: 1 },
          shortlisted: { $sum: { $cond: [{ $in: ['$status', ['interview', 'trial', 'accepted']] }, 1, 0] } },
          avgRating: { $avg: { $cond: [{ $gt: ['$rating', 0] }, '$rating', null] } },
        } },
        { $sort: { n: -1 } },
      ]),
      JobApplication.aggregate([{ $group: { _id: '$jobSlug', title: { $first: '$jobTitle' }, n: { $sum: 1 } } }, { $sort: { n: -1 } }]),
      JobApplication.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, n: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      CareerEvent.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: '$event', n: { $sum: 1 }, visitors: { $addToSet: '$visitorId' } } },
        { $project: { n: 1, visitors: { $size: '$visitors' } } },
      ]),
      JobApplication.aggregate([{ $group: { _id: null, scroll: { $avg: '$scrollDepthMax' }, page: { $avg: '$secondsOnPage' }, form: { $avg: '$secondsOnForm' } } }]),
      JobApplication.countDocuments(),
      JobListing.countDocuments({ status: 'open' }),
    ]);

    // Fill missing days so the sparkline has a point for every day.
    const map = Object.fromEntries(daily.map((d) => [d._id, d.n]));
    const series = [];
    for (let i = 29; i >= 0; i--) {
      const key = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      series.push({ date: key, n: map[key] || 0 });
    }

    res.json({
      settings: { acceptingApplications: settings.acceptingApplications, pausedMessage: settings.pausedMessage },
      total, openJobs,
      byStatus: Object.fromEntries(byStatus.map((s) => [s._id, s.n])),
      bySource: bySource.map((s) => ({ source: s._id, n: s.n, shortlisted: s.shortlisted, avgRating: s.avgRating ? Math.round(s.avgRating * 10) / 10 : null })),
      perJob: perJob.map((j) => ({ slug: j._id, title: j.title, n: j.n })),
      series,
      funnel: Object.fromEntries(funnel.map((f) => [f._id, { events: f.n, visitors: f.visitors }])),
      engagement: {
        scroll: Math.round(engagement[0]?.scroll || 0),
        secondsOnPage: Math.round(engagement[0]?.page || 0),
        secondsOnForm: Math.round(engagement[0]?.form || 0),
      },
    });
  } catch (e) { next(e); }
});

// ── Listings ──────────────────────────────────────────────────────────────────

function listingFromBody(b) {
  const status = ['draft', 'open', 'closed'].includes(b.status) ? b.status : 'draft';
  const deadline = b.deadline ? new Date(b.deadline) : null;
  return {
    title: str(b.title, 120), team: str(b.team, 60) || 'General', tagline: str(b.tagline, 200),
    workMode: ['remote', 'hybrid', 'onsite'].includes(b.workMode) ? b.workMode : 'remote',
    location: str(b.location, 120) || 'Remote (anywhere)',
    hoursPerWeek: str(b.hoursPerWeek, 40), duration: str(b.duration, 60),
    description: str(b.description, 6000),
    responsibilities: lines(b.responsibilities), requirements: lines(b.requirements),
    niceToHave: lines(b.niceToHave), perks: lines(b.perks), skills: lines(b.skills, 20, 40),
    questions: (Array.isArray(b.questions) ? b.questions : []).slice(0, 5)
      .map((q) => ({ label: str(q?.label, 240), required: !!q?.required })).filter((q) => q.label),
    compensationNote: str(b.compensationNote, 600) || undefined,
    openings: num(b.openings, 1, 99, 1), featured: !!b.featured, sortOrder: num(b.sortOrder, 0, 9999, 100),
    deadline: deadline && !isNaN(deadline) ? deadline : null,
    status,
  };
}

router.get('/admin/jobs', verifyAdmin, canView, async (_req, res, next) => {
  try {
    const [jobs, counts] = await Promise.all([
      JobListing.find().sort({ status: 1, sortOrder: 1, createdAt: -1 }).lean(),
      JobApplication.aggregate([{ $group: { _id: '$jobSlug', total: { $sum: 1 }, fresh: { $sum: { $cond: [{ $eq: ['$status', 'new'] }, 1, 0] } } } }]),
    ]);
    const cm = Object.fromEntries(counts.map((c) => [c._id, c]));
    res.json({
      jobs: jobs.map((j) => ({ ...j, applications: cm[j.slug]?.total || 0, newApplications: cm[j.slug]?.fresh || 0, openNow: j.status === 'open' && (!j.deadline || new Date(j.deadline) > new Date()) })),
      general: { applications: cm.general?.total || 0, newApplications: cm.general?.fresh || 0 },
    });
  } catch (e) { next(e); }
});

router.post('/admin/jobs', verifyAdmin, canManage, async (req, res, next) => {
  try {
    const data = listingFromBody(req.body || {});
    if (data.title.length < 3) return res.status(400).json({ error: 'Title is required' });
    const slug = await uniqueSlug(slugify(req.body.slug || data.title));
    if (data.status === 'closed') data.closedAt = new Date();
    const job = await JobListing.create({ ...data, slug, createdBy: actorName(req) });
    audit('careers_job_created', { req, actor: req.admin, targetId: String(job._id), targetType: 'job_listing', details: { title: job.title, status: job.status } });
    res.status(201).json({ job });
  } catch (e) { next(e); }
});

router.put('/admin/jobs/:id', verifyAdmin, canManage, async (req, res, next) => {
  try {
    const job = await JobListing.findById(req.params.id);
    if (!job) return res.status(404).json({ error: 'Listing not found' });
    const data = listingFromBody(req.body || {});
    if (data.title.length < 3) return res.status(400).json({ error: 'Title is required' });
    if (data.compensationNote === undefined) delete data.compensationNote;
    if (data.status === 'closed' && job.status !== 'closed') data.closedAt = new Date();
    if (data.status === 'open') { data.closedAt = null; data.closedReason = ''; }
    Object.assign(job, data);
    if (req.body.slug && slugify(req.body.slug) !== job.slug) job.slug = await uniqueSlug(slugify(req.body.slug), job._id);
    await job.save();
    audit('careers_job_updated', { req, actor: req.admin, targetId: String(job._id), targetType: 'job_listing', details: { title: job.title, status: job.status } });
    res.json({ job });
  } catch (e) { next(e); }
});

router.post('/admin/jobs/:id/close', verifyAdmin, canManage, async (req, res, next) => {
  try {
    const job = await JobListing.findByIdAndUpdate(req.params.id,
      { status: 'closed', closedAt: new Date(), closedReason: str(req.body?.reason, 200) }, { new: true });
    if (!job) return res.status(404).json({ error: 'Listing not found' });
    audit('careers_job_closed', { req, actor: req.admin, targetId: String(job._id), targetType: 'job_listing', details: { title: job.title } });
    res.json({ job });
  } catch (e) { next(e); }
});

router.post('/admin/jobs/:id/reopen', verifyAdmin, canManage, async (req, res, next) => {
  try {
    const job = await JobListing.findByIdAndUpdate(req.params.id,
      { status: 'open', closedAt: null, closedReason: '', deadline: null }, { new: true });
    if (!job) return res.status(404).json({ error: 'Listing not found' });
    audit('careers_job_reopened', { req, actor: req.admin, targetId: String(job._id), targetType: 'job_listing', details: { title: job.title } });
    res.json({ job });
  } catch (e) { next(e); }
});

router.delete('/admin/jobs/:id', verifyAdmin, canManage, async (req, res, next) => {
  try {
    const job = await JobListing.findByIdAndDelete(req.params.id);
    if (!job) return res.status(404).json({ error: 'Listing not found' });
    audit('careers_job_deleted', { req, actor: req.admin, targetId: String(job._id), targetType: 'job_listing', details: { title: job.title } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ── Applications ──────────────────────────────────────────────────────────────

function applicationFilter(q) {
  const f = {};
  if (q.status && q.status !== 'all') f.status = String(q.status);
  if (q.job && q.job !== 'all') f.jobSlug = String(q.job);
  if (q.source && q.source !== 'all') f.source = String(q.source);
  if (q.minRating) f.rating = { $gte: num(q.minRating, 0, 5) };
  const term = str(q.q, 80);
  if (term) {
    const rx = new RegExp(esc(term), 'i');
    f.$or = [{ fullName: rx }, { email: rx }, { organization: rx }, { location: rx }, { skills: rx }];
  }
  return f;
}

router.get('/admin/applications.csv', verifyAdmin, canManage, async (req, res, next) => {
  try {
    const rows = await JobApplication.find(applicationFilter(req.query)).sort({ createdAt: -1 }).limit(5000).lean();
    const cols = [
      ['Submitted', 'createdAt'], ['Status', 'status'], ['Rating', 'rating'], ['Role', 'jobTitle'], ['Name', 'fullName'], ['Email', 'email'],
      ['Phone', 'phone'], ['Location', 'location'], ['Timezone', 'timezone'], ['LinkedIn', 'linkedin'], ['GitHub', 'github'],
      ['Portfolio', 'portfolio'], ['Resume', 'resumeUrl'], ['Current status', 'currentStatus'], ['Organization', 'organization'],
      ['Experience', 'experienceLevel'], ['Skills', 'skills'], ['Hours/week', 'hoursPerWeek'], ['Start', 'startDate'],
      ['Why', 'whyYou'], ['Proud of', 'proudestWork'], ['Source', 'source'], ['Source detail', 'sourceDetail'], ['Detected source', 'detectedSource'],
      ['Device', 'deviceType'], ['Country', 'country'], ['Scroll depth %', 'scrollDepthMax'], ['Seconds on page', 'secondsOnPage'],
      ['Seconds on form', 'secondsOnForm'], ['Tags', 'tags'], ['Notes', 'adminNotes'],
    ];
    const out = [cols.map((c) => csvCell(c[0])).join(',')];
    for (const r of rows) out.push(cols.map((c) => csvCell(r[c[1]])).join(','));
    audit('careers_export', { req, actor: req.admin, targetType: 'job_application', details: { rows: rows.length } });
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="planit-applications-${new Date().toISOString().slice(0, 10)}.csv"` });
    res.send(`\uFEFF${out.join('\r\n')}`);
  } catch (e) { next(e); }
});

router.get('/admin/applications', verifyAdmin, canView, async (req, res, next) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(5, parseInt(req.query.limit, 10) || 30));
    const filter = applicationFilter(req.query);
    const sort = req.query.sort === 'rating' ? { rating: -1, createdAt: -1 } : { createdAt: -1 };
    const [items, total] = await Promise.all([
      JobApplication.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
      JobApplication.countDocuments(filter),
    ]);
    res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
  } catch (e) { next(e); }
});

router.patch('/admin/applications/:id', verifyAdmin, canManage, async (req, res, next) => {
  try {
    const app = await JobApplication.findById(req.params.id);
    if (!app) return res.status(404).json({ error: 'Application not found' });
    const b = req.body || {};
    const STATUSES = ['new', 'reviewing', 'interview', 'trial', 'accepted', 'waitlist', 'rejected', 'withdrawn'];
    if (b.status && STATUSES.includes(b.status) && b.status !== app.status) {
      app.status = b.status;
      app.statusHistory.push({ status: b.status, by: actorName(req), at: new Date() });
    }
    if (b.rating !== undefined) app.rating = num(b.rating, 0, 5);
    if (b.adminNotes !== undefined) app.adminNotes = str(b.adminNotes, 4000);
    if (Array.isArray(b.tags)) app.tags = b.tags.map((t) => str(t, 30)).filter(Boolean).slice(0, 10);
    app.lastReviewedAt = new Date();
    await app.save();
    audit('careers_application_updated', { req, actor: req.admin, targetId: String(app._id), targetType: 'job_application', details: { status: app.status, rating: app.rating } });
    res.json({ item: app.toObject() });
  } catch (e) { next(e); }
});

router.delete('/admin/applications/:id', verifyAdmin, canManage, async (req, res, next) => {
  try {
    const app = await JobApplication.findByIdAndDelete(req.params.id);
    if (!app) return res.status(404).json({ error: 'Application not found' });
    audit('careers_application_deleted', { req, actor: req.admin, targetId: String(app._id), targetType: 'job_application', details: { role: app.jobTitle } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ── Global switch + test alert ────────────────────────────────────────────────

router.put('/admin/settings', verifyAdmin, canManage, async (req, res, next) => {
  try {
    const s = await CareersSettings.get();
    if (typeof req.body?.acceptingApplications === 'boolean') s.acceptingApplications = req.body.acceptingApplications;
    if (req.body?.pausedMessage !== undefined) s.pausedMessage = str(req.body.pausedMessage, 300) || s.pausedMessage;
    s.updatedBy = actorName(req);
    await s.save();
    audit('careers_settings_updated', { req, actor: req.admin, targetType: 'careers_settings', details: { acceptingApplications: s.acceptingApplications } });
    res.json({ settings: { acceptingApplications: s.acceptingApplications, pausedMessage: s.pausedMessage } });
  } catch (e) { next(e); }
});

router.post('/admin/test-alert', verifyAdmin, canManage, async (req, res, next) => {
  try {
    const r = await notify.alert({
      title: 'Careers test alert',
      content: `Test fired by ${actorName(req)}. If you can see this on Discord and your phone, new-application alerts are wired up.`,
      level: 'info',
      fields: [{ name: 'Role', value: 'Test role', inline: true }, { name: 'Source', value: 'linkedin', inline: true }],
    });
    res.json(r);
  } catch (e) { next(e); }
});


// ═════════════════════════════════════════════════════════════════════════════
// ORG CHART
//   READ   any logged-in admin / employee (verifyAdmin only, no hiring perm)
//   WRITE  super admin only (requireSuperAdminRole). Demo accounts can never
//          write (they are not super admins) and only ever read an empty chart.
// ═════════════════════════════════════════════════════════════════════════════

const MAX_LEVEL = 9;
const ACCENTS = ['slate', 'indigo', 'emerald', 'amber', 'rose', 'sky', 'violet', 'teal'];
const isSuperReq = (req) => {
  const a = req.admin || {};
  return (!a.isEmployee && a.isAdmin === true) || a.role === 'super_admin';
};
const canSeeApplicants = (req) => isSuperReq(req) || req.admin?.permissions?.canViewHiring === true;
const oid = (v) => (v && mongoose.isValidObjectId(String(v)) ? String(v) : null);

function serializeNode(n, superView, applicants) {
  const o = {
    _id: String(n._id), title: n.title, department: n.department || '', status: n.status,
    level: n.level, parentId: n.parentId ? String(n.parentId) : null, order: n.order || 0,
    personName: n.personName || '', personEmail: n.personEmail || '', employeeId: n.employeeId ? String(n.employeeId) : null,
    avatar: n.avatar || '', bio: n.bio || '', location: n.location || '', timezone: n.timezone || '',
    startDate: n.startDate || null, skills: n.skills || [], links: n.links || [], accent: n.accent || 'slate',
    description: n.description || '', jobSlug: n.jobSlug || '', owner: !!n.owner, seats: n.seats || 1, updatedAt: n.updatedAt,
  };
  if (applicants && n.jobSlug) o.applicants = applicants[n.jobSlug] || 0;
  if (superView) { o.privatePhone = n.privatePhone || ''; o.privateNotes = n.privateNotes || ''; }
  return o;
}

async function loadOrg(req) {
  const superView = isSuperReq(req);
  const docs = await OrgNode.find().sort({ level: 1, order: 1, createdAt: 1 }).lean();
  let applicants = null;
  if (canSeeApplicants(req)) {
    const rows = await JobApplication.aggregate([{ $group: { _id: '$jobSlug', n: { $sum: 1 } } }]);
    applicants = Object.fromEntries(rows.map((r) => [r._id, r.n]));
  }
  const maxT = docs.reduce((m, d) => Math.max(m, new Date(d.updatedAt || 0).getTime()), 0);
  // A box linked to a public listing always shows that listing's opening count (one number, two places).
  const slugs = [...new Set(docs.map((d) => d.jobSlug).filter(Boolean))];
  const openingsBySlug = new Map(slugs.length ? (await JobListing.find({ slug: { $in: slugs } }).select('slug openings').lean()).map((j) => [j.slug, j.openings || 1]) : []);
  const nodes = docs.map((d) => { const o = serializeNode(d, superView, applicants); if (d.jobSlug && d.status === 'open' && openingsBySlug.has(d.jobSlug)) o.seats = openingsBySlug.get(d.jobSlug); return o; });
  return { nodes, rev: `${docs.length}:${maxT}`, canEdit: superView };
}

function nodeFromBody(b, existing) {
  const out = {};
  const has = (k) => Object.prototype.hasOwnProperty.call(b, k);
  if (has('title')) out.title = str(b.title, 120);
  if (has('department')) out.department = str(b.department, 80);
  if (has('status')) out.status = b.status === 'filled' ? 'filled' : 'open';
  if (has('personName')) out.personName = str(b.personName, 100);
  if (has('personEmail')) {
    const e = str(b.personEmail, 160).toLowerCase();
    out.personEmail = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(e) ? e : '';
  }
  if (has('avatar')) out.avatar = cleanUrl(b.avatar, 400);
  if (has('bio')) out.bio = str(b.bio, 1200);
  if (has('location')) out.location = str(b.location, 100);
  if (has('timezone')) out.timezone = str(b.timezone, 60);
  if (has('startDate')) { const d = b.startDate ? new Date(b.startDate) : null; out.startDate = d && !isNaN(d) ? d : null; }
  if (has('skills')) {
    const arr = Array.isArray(b.skills) ? b.skills : String(b.skills || '').split(',');
    out.skills = arr.map((s) => str(s, 30)).filter(Boolean).slice(0, 15);
  }
  if (has('links')) {
    out.links = (Array.isArray(b.links) ? b.links : []).slice(0, 5)
      .map((l) => ({ label: str(l?.label, 40), url: cleanUrl(l?.url, 300) })).filter((l) => l.url);
  }
  if (has('accent')) out.accent = ACCENTS.includes(b.accent) ? b.accent : 'slate';
  if (has('description')) out.description = str(b.description, 1500);
  if (has('jobSlug')) { const s = str(b.jobSlug, 90).toLowerCase(); out.jobSlug = /^[a-z0-9-]*$/.test(s) ? s : ''; }
  if (has('seats')) out.seats = Math.max(1, Math.min(99, Math.round(Number(b.seats)) || 1));
  if (has('privatePhone')) out.privatePhone = str(b.privatePhone, 30);
  if (has('privateNotes')) out.privateNotes = str(b.privateNotes, 1500);
  if (has('employeeId')) out.employeeId = oid(b.employeeId);
  return out;
}

// Vacant positions never keep a person's identity around.
function clearPerson(o) {
  Object.assign(o, { personName: '', personEmail: '', employeeId: null, avatar: '', bio: '', startDate: null, privatePhone: '', privateNotes: '' });
}

// Check parent.level < child.level and no cycles over a full id -> {level,parentId} map.
function validateTree(map) {
  for (const [id, n] of map) {
    if (n.parentId) {
      const p = map.get(n.parentId);
      if (!p) return `A reporting line points at a position that does not exist.`;
      if (p.level >= n.level) return `A person must sit on a lower level than their manager.`;
    }
    let cur = n, hops = 0;
    while (cur && cur.parentId) {
      cur = map.get(cur.parentId);
      if (++hops > 100 || (cur && String(cur._id) === id)) return 'That move would create a reporting loop.';
    }
  }
  return null;
}

router.get('/admin/org', verifyAdmin, async (req, res, next) => {
  try {
    if (req.admin?.isDemo) return res.json({ nodes: [], rev: '0:0', canEdit: false, demo: true });
    const data = await loadOrg(req);
    const extra = { me: req.admin?.employeeId ? String(req.admin.employeeId) : null, root: !req.admin?.isEmployee && req.admin?.isAdmin === true };
    if (data.canEdit) {
      const [emps, jobs] = await Promise.all([
        Employee.find({ status: 'active', role: { $ne: 'demo' }, isDemo: { $ne: true } }).select('name email role department avatar').sort({ name: 1 }).lean(),
        JobListing.find().select('slug title status').sort({ title: 1 }).lean(),
      ]);
      extra.employees = emps.map((e) => ({ _id: String(e._id), name: e.name, email: e.email, role: e.role, department: e.department || '', avatar: e.avatar || '' }));
      extra.listings = jobs.map((j) => ({ slug: j.slug, title: j.title, status: j.status }));
    }
    res.json({ ...data, ...extra });
  } catch (e) { next(e); }
});

// Openings set on an org-chart box flow to its linked public listing (-> JobPosting.totalJobOpenings).
async function syncOpenings(node) {
  if (node.status === 'open' && node.jobSlug) await JobListing.updateOne({ slug: node.jobSlug }, { $set: { openings: node.seats || 1 } });
}

router.post('/admin/org', verifyAdmin, requireSuperAdminRole, async (req, res, next) => {
  try {
    const b = req.body || {};
    const data = nodeFromBody(b);
    if (!data.title || data.title.length < 2) return res.status(400).json({ error: 'Give the position a title' });
    if (data.status === 'open') clearPerson(data);
    if (data.status === 'filled' && !data.personName && data.employeeId) {
      const emp = await Employee.findById(data.employeeId).select('name email').lean();
      if (emp) { data.personName = emp.name; data.personEmail = data.personEmail || emp.email; }
    }
    if (data.status === 'filled' && !data.personName) return res.status(400).json({ error: 'A filled position needs a person' });

    let level = Math.round(num(b.level, 0, MAX_LEVEL, 0));
    let parentId = null;
    if (oid(b.parentId)) {
      const parent = await OrgNode.findById(oid(b.parentId)).select('level').lean();
      if (!parent) return res.status(400).json({ error: 'Manager not found' });
      if (parent.level >= MAX_LEVEL) return res.status(400).json({ error: 'That is already the lowest level' });
      parentId = parent._id; level = parent.level + 1;
    }
    const last = await OrgNode.findOne({ level }).sort({ order: -1 }).select('order').lean();
    const node = await OrgNode.create({ ...data, level, parentId, order: (last?.order ?? -1) + 1, updatedBy: actorName(req) });
    await syncOpenings(node);
    audit('careers_org_created', { req, actor: req.admin, targetId: String(node._id), targetType: 'org_node', details: { title: node.title, status: node.status } });
    res.status(201).json({ node: serializeNode(node.toObject(), true) });
  } catch (e) { next(e); }
});

router.put('/admin/org/:id', verifyAdmin, requireSuperAdminRole, async (req, res, next) => {
  try {
    if (!oid(req.params.id)) return res.status(400).json({ error: 'Bad id' });
    const node = await OrgNode.findById(req.params.id);
    if (!node) return res.status(404).json({ error: 'Position not found' });
    const data = nodeFromBody(req.body || {});
    if ('title' in data && data.title.length < 2) return res.status(400).json({ error: 'Give the position a title' });
    const status = data.status || node.status;
    if (status === 'open') clearPerson(data);
    if (status === 'filled') {
      const empId = 'employeeId' in data ? data.employeeId : node.employeeId;
      let name = 'personName' in data ? data.personName : node.personName;
      if (!name && empId) {
        const emp = await Employee.findById(empId).select('name email').lean();
        if (emp) { data.personName = name = emp.name; if (!(data.personEmail ?? node.personEmail)) data.personEmail = emp.email; }
      }
      if (!name) return res.status(400).json({ error: 'A filled position needs a person' });
    }
    Object.assign(node, data, { updatedBy: actorName(req) });
    await node.save();
    if ('seats' in data || 'jobSlug' in data) await syncOpenings(node);
    audit('careers_org_updated', { req, actor: req.admin, targetId: String(node._id), targetType: 'org_node', details: { title: node.title, status: node.status, fields: Object.keys(data) } });
    res.json({ node: serializeNode(node.toObject(), true) });
  } catch (e) { next(e); }
});

// Bulk reposition: [{ id, level, parentId|null, order }]. All-or-nothing.
router.post('/admin/org/layout', verifyAdmin, requireSuperAdminRole, async (req, res, next) => {
  try {
    const moves = Array.isArray(req.body?.moves) ? req.body.moves.slice(0, 300) : [];
    if (!moves.length) return res.status(400).json({ error: 'Nothing to move' });
    const docs = await OrgNode.find().select('level parentId order').lean();
    const map = new Map(docs.map((d) => [String(d._id), { _id: String(d._id), level: d.level, parentId: d.parentId ? String(d.parentId) : null, order: d.order || 0 }]));
    const touched = new Map();
    for (const m of moves) {
      const id = oid(m?.id);
      if (!id || !map.has(id)) return res.status(400).json({ error: 'A position in that move no longer exists. Refresh and try again.' });
      const cur = map.get(id);
      const level = Math.round(num(m.level, 0, MAX_LEVEL, cur.level));
      const parentId = m.parentId ? oid(m.parentId) : null;
      if (m.parentId && !parentId) return res.status(400).json({ error: 'Bad manager id' });
      const next = { ...cur, level, parentId, order: Math.round(num(m.order, 0, 100000, cur.order)) };
      map.set(id, next); touched.set(id, next);
    }
    const problem = validateTree(map);
    if (problem) return res.status(400).json({ error: problem });
    await OrgNode.bulkWrite([...touched.values()].map((t) => ({
      updateOne: { filter: { _id: t._id }, update: { $set: { level: t.level, parentId: t.parentId, order: t.order, updatedBy: actorName(req) } } },
    })));
    audit('careers_org_layout', { req, actor: req.admin, targetType: 'org_node', details: { moved: touched.size } });
    res.json(await loadOrg(req));
  } catch (e) { next(e); }
});

router.delete('/admin/org/:id', verifyAdmin, requireSuperAdminRole, async (req, res, next) => {
  try {
    if (!oid(req.params.id)) return res.status(400).json({ error: 'Bad id' });
    const node = await OrgNode.findById(req.params.id);
    if (!node) return res.status(404).json({ error: 'Position not found' });
    // Reports move up to the deleted box's manager (always a valid, lower level).
    await OrgNode.updateMany({ parentId: node._id }, { $set: { parentId: node.parentId || null } });
    await node.deleteOne();
    audit('careers_org_deleted', { req, actor: req.admin, targetId: String(node._id), targetType: 'org_node', details: { title: node.title } });
    res.json(await loadOrg(req));
  } catch (e) { next(e); }
});

// Make sure the person looking at the chart has a box at the top of it, and that no position is left
// floating with nobody to report to. Idempotent. Loose positions are attached to the top box, so the
// chart reads as one connected tree (top box -> teams -> roles).
async function tidyOrg(req) {
  const a = req.admin || {};
  const rootLogin = !a.isEmployee && a.isAdmin === true;
  const myEmp = !rootLogin && a.employeeId ? oid(a.employeeId) : null;
  const docs = await OrgNode.find().select('level parentId order owner employeeId').lean();
  let mine = null;
  if (rootLogin) mine = docs.find((d) => d.owner) || null;
  else if (myEmp) mine = docs.find((d) => d.employeeId && String(d.employeeId) === myEmp) || null;

  let created = false;
  if (!mine && (rootLogin || myEmp)) {
    let name = a.name || a.username || '';
    let email = String(a.email || '').toLowerCase();
    if (myEmp) {
      const emp = await Employee.findById(myEmp).select('name email').lean();
      if (emp) { name = emp.name || name; email = String(emp.email || email).toLowerCase(); }
    }
    mine = await OrgNode.create({
      title: 'Super Admin', department: 'Leadership', status: 'filled', level: 0, parentId: null, order: -1, accent: 'indigo',
      personName: str(name, 100) || 'Super Admin',
      personEmail: /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) ? email : '',
      employeeId: myEmp, owner: rootLogin, updatedBy: actorName(req),
    });
    mine = mine.toObject();
    docs.push(mine);
    created = true;
  }

  const tops = docs.filter((d) => !d.parentId && d.level === 0).sort((x, y) => (x.order || 0) - (y.order || 0));
  const target = mine && !mine.parentId && mine.level === 0 ? mine : tops[0];
  let adopted = 0;
  if (target) {
    const loose = docs.filter((d) => !d.parentId && d.level > 0 && String(d._id) !== String(target._id)).map((d) => d._id);
    if (loose.length) {
      await OrgNode.updateMany({ _id: { $in: loose } }, { $set: { parentId: target._id, updatedBy: actorName(req) } });
      adopted = loose.length;
    }
  }
  return { created, adopted };
}

router.post('/admin/org/tidy', verifyAdmin, requireSuperAdminRole, async (req, res, next) => {
  try {
    const r = await tidyOrg(req);
    if (r.created || r.adopted) audit('careers_org_tidied', { req, actor: req.admin, targetType: 'org_node', details: r });
    res.json({ ...r, ...(await loadOrg(req)) });
  } catch (e) { next(e); }
});

// One-click scaffold: active employees + open listings that are not on the chart yet. Idempotent.
router.post('/admin/org/import', verifyAdmin, requireSuperAdminRole, async (req, res, next) => {
  try {
    const existing = await OrgNode.find().select('employeeId jobSlug level').lean();
    const haveEmp = new Set(existing.filter((n) => n.employeeId).map((n) => String(n.employeeId)));
    const haveJob = new Set(existing.filter((n) => n.jobSlug).map((n) => n.jobSlug));
    const [emps, jobs] = await Promise.all([
      Employee.find({ status: 'active', role: { $ne: 'demo' }, isDemo: { $ne: true } }).sort({ createdAt: 1 }).lean(),
      JobListing.find({ status: 'open' }).sort({ sortOrder: 1 }).lean(),
    ]);
    const pretty = (r) => String(r || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const docs = [];
    let top = existing.find((n) => n.level === 0);
    const order = { 0: 0, 1: 0, 2: 0 };
    for (const e of emps) {
      if (haveEmp.has(String(e._id))) continue;
      const level = e.role === 'super_admin' ? 0 : 1;
      const doc = {
        _id: new mongoose.Types.ObjectId(), title: pretty(e.role), department: e.department || '', status: 'filled', level, order: order[level]++,
        personName: e.name, personEmail: e.email, employeeId: e._id, avatar: cleanUrl(e.avatar || '', 400),
        location: e.location || '', timezone: e.timezone || '', startDate: e.startDate || null, updatedBy: actorName(req),
      };
      docs.push(doc);
    }
    const newTop = docs.find((d) => d.level === 0);
    const topId = top?._id || newTop?._id || null;
    for (const d of docs) d.parentId = d.level === 1 ? topId : null;
    for (const j of jobs) {
      if (haveJob.has(j.slug)) continue;
      docs.push({ _id: new mongoose.Types.ObjectId(), title: j.title, department: j.team || '', status: 'open', level: 1, order: order[1]++, parentId: null, seats: j.openings || 1,
        description: str(j.tagline || j.description, 1500), jobSlug: j.slug, updatedBy: actorName(req) });
    }
    if (docs.length) await OrgNode.insertMany(docs);
    await tidyOrg(req);
    audit('careers_org_imported', { req, actor: req.admin, targetType: 'org_node', details: { added: docs.length } });
    res.json({ added: docs.length, ...(await loadOrg(req)) });
  } catch (e) { next(e); }
});

module.exports = router;
