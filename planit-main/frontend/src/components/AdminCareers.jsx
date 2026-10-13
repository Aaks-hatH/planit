import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Briefcase, Bell, Check, ChevronDown, Copy, Download, Edit2, ExternalLink, Inbox, Link2, Loader2,
  Lock, Mail, Pause, Play, Plus, RefreshCw, Search, Star, Trash2, Unlock, X, Users, Eye, Clock,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

/**
 * Admin -> Careers
 *
 * Talks to /api/careers/admin/* (verifyAdmin + canViewHiring / canManageHiring).
 *   Applications  pipeline, ratings, notes, CSV export
 *   Listings      add / edit / close / reopen volunteer roles, tracking links per channel
 *   Insights      sources (LinkedIn etc.), funnel, 30-day trend, engagement
 * Global switch pauses ALL applications on the public page.
 */

const STATUSES = ['new', 'reviewing', 'interview', 'trial', 'accepted', 'waitlist', 'rejected', 'withdrawn'];
const STATUS_STYLE = {
  new: 'bg-sky-100 text-sky-700', reviewing: 'bg-amber-100 text-amber-800', interview: 'bg-violet-100 text-violet-700',
  trial: 'bg-indigo-100 text-indigo-700', accepted: 'bg-emerald-100 text-emerald-700', waitlist: 'bg-neutral-200 text-neutral-700',
  rejected: 'bg-red-100 text-red-700', withdrawn: 'bg-neutral-100 text-neutral-500',
};
const CHANNELS = ['linkedin', 'indeed', 'handshake', 'glassdoor', 'wellfound', 'ziprecruiter', 'github', 'devpost', 'discord', 'reddit', 'twitter', 'instagram', 'tiktok', 'youtube', 'facebook', 'school', 'friend'];
const SOURCE_LABEL = { linkedin: 'LinkedIn', indeed: 'Indeed', handshake: 'Handshake', glassdoor: 'Glassdoor', wellfound: 'Wellfound', ziprecruiter: 'ZipRecruiter', github: 'GitHub', devpost: 'Devpost', discord: 'Discord', reddit: 'Reddit', twitter: 'X / Twitter', instagram: 'Instagram', tiktok: 'TikTok', youtube: 'YouTube', facebook: 'Facebook', google: 'Google', school: 'School / club', friend: 'Friend', planit: 'PlanIt', other: 'Other' };

const ago = (d) => {
  if (!d) return '—';
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};
const dt = (d) => (d ? new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const mins = (s) => (s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`);

const DEMO_OVERVIEW = {
  settings: { acceptingApplications: true, pausedMessage: '' }, total: 3, openJobs: 1,
  byStatus: { new: 2, interview: 1 }, bySource: [{ source: 'linkedin', n: 2, shortlisted: 1, avgRating: 4 }, { source: 'discord', n: 1, shortlisted: 0, avgRating: null }],
  perJob: [{ slug: 'frontend-engineer', title: 'Frontend Engineer', n: 3 }],
  series: Array.from({ length: 30 }, (_, i) => ({ date: String(i), n: i % 7 === 0 ? 2 : 0 })),
  funnel: { page_view: { events: 120, visitors: 90 }, role_open: { events: 40, visitors: 30 }, apply_start: { events: 12, visitors: 10 }, apply_submit: { events: 3, visitors: 3 } },
  engagement: { scroll: 78, secondsOnPage: 140, secondsOnForm: 210 },
};

const Pill = ({ children, className = '' }) => <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${className}`}>{children}</span>;

function Stat({ label, value, sub, accent }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-2xl border border-neutral-200 bg-white p-4">
      <div className={`absolute inset-x-0 top-0 h-0.5 ${accent}`} />
      <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">{label}</div>
      <div className="mt-1 text-2xl font-black text-neutral-900">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-neutral-500">{sub}</div>}
    </motion.div>
  );
}

function Bar({ pct, color = 'bg-neutral-900', delay = 0 }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
      <motion.div className={`h-full rounded-full ${color}`} initial={{ width: 0 }} animate={{ width: `${Math.max(2, pct)}%` }} transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }} />
    </div>
  );
}

function Spark({ series }) {
  const max = Math.max(1, ...series.map((s) => s.n));
  const w = 300, h = 56;
  const pts = series.map((s, i) => `${(i / Math.max(1, series.length - 1)) * w},${h - 4 - (s.n / max) * (h - 10)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-14 w-full">
      <defs><linearGradient id="spk" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#171717" stopOpacity="0.18" /><stop offset="1" stopColor="#171717" stopOpacity="0" /></linearGradient></defs>
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill="url(#spk)" />
      <motion.polyline points={pts} fill="none" stroke="#171717" strokeWidth="2" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2 }} />
    </svg>
  );
}

/* ── Listing editor ─────────────────────────────────────────────────────────── */
const BLANK = {
  title: '', team: '', tagline: '', workMode: 'remote', location: 'Remote (anywhere)', hoursPerWeek: '3-6 hrs / week', duration: 'Ongoing, flexible',
  description: '', responsibilities: '', requirements: '', niceToHave: '', perks: '', skills: '', questions: [], compensationNote: '',
  openings: 1, featured: false, sortOrder: 100, deadline: '', status: 'open', slug: '',
};

function toForm(j) {
  if (!j) return { ...BLANK };
  return {
    ...BLANK, ...j,
    responsibilities: (j.responsibilities || []).join('\n'), requirements: (j.requirements || []).join('\n'),
    niceToHave: (j.niceToHave || []).join('\n'), perks: (j.perks || []).join('\n'), skills: (j.skills || []).join(', '),
    deadline: j.deadline ? new Date(j.deadline).toISOString().slice(0, 10) : '', questions: j.questions || [],
  };
}

function Input({ label, children, hint, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-neutral-500">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-neutral-400">{hint}</span>}
    </label>
  );
}
const field = 'w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10';

function ListingEditor({ job, onClose, onSaved, isDemo }) {
  const [f, setF] = useState(() => toForm(job));
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const save = async (statusOverride) => {
    if (f.title.trim().length < 3) { toast.error('Give the role a title'); return; }
    if (isDemo) { toast.success('Saved (sandbox)'); onClose(); return; }
    setBusy(true);
    const payload = { ...f, status: statusOverride || f.status, skills: f.skills.split(',').map((s) => s.trim()).filter(Boolean) };
    try {
      const r = job?._id ? await api.put(`/careers/admin/jobs/${job._id}`, payload) : await api.post('/careers/admin/jobs', payload);
      toast.success(job?._id ? 'Listing updated' : 'Listing created');
      onSaved(r.data.job);
    } catch (e) { toast.error(e?.response?.data?.error || 'Could not save listing'); } finally { setBusy(false); }
  };

  return (
    <motion.div className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div onClick={(e) => e.stopPropagation()} initial={{ y: 30, opacity: 0, scale: 0.98 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 20, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }} className="my-6 w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-neutral-100 px-6 py-4">
          <div>
            <h3 className="text-lg font-black text-neutral-900">{job?._id ? 'Edit listing' : 'New volunteer listing'}</h3>
            <p className="text-xs text-neutral-500">Volunteer roles only. The compensation note is shown to applicants.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100"><X className="h-5 w-5" /></button>
        </div>
        <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
          <Input label="Title *" className="sm:col-span-2"><input className={field} value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Frontend Engineer" /></Input>
          <Input label="Team"><input className={field} value={f.team} onChange={(e) => set('team', e.target.value)} placeholder="Engineering" /></Input>
          <Input label="Work mode">
            <select className={field} value={f.workMode} onChange={(e) => set('workMode', e.target.value)}><option value="remote">Remote</option><option value="hybrid">Hybrid</option><option value="onsite">On-site</option></select>
          </Input>
          <Input label="Tagline" className="sm:col-span-2"><input className={field} value={f.tagline} onChange={(e) => set('tagline', e.target.value)} placeholder="One line that sells the role" maxLength={200} /></Input>
          <Input label="Location"><input className={field} value={f.location} onChange={(e) => set('location', e.target.value)} /></Input>
          <Input label="Hours"><input className={field} value={f.hoursPerWeek} onChange={(e) => set('hoursPerWeek', e.target.value)} /></Input>
          <Input label="Duration"><input className={field} value={f.duration} onChange={(e) => set('duration', e.target.value)} /></Input>
          <Input label="Openings"><input type="number" min={1} className={field} value={f.openings} onChange={(e) => set('openings', e.target.value)} /></Input>
          <Input label="Description" className="sm:col-span-2"><textarea rows={4} className={field} value={f.description} onChange={(e) => set('description', e.target.value)} /></Input>
          <Input label="Responsibilities" hint="One per line" ><textarea rows={4} className={field} value={f.responsibilities} onChange={(e) => set('responsibilities', e.target.value)} /></Input>
          <Input label="Requirements" hint="One per line"><textarea rows={4} className={field} value={f.requirements} onChange={(e) => set('requirements', e.target.value)} /></Input>
          <Input label="Nice to have" hint="One per line"><textarea rows={3} className={field} value={f.niceToHave} onChange={(e) => set('niceToHave', e.target.value)} /></Input>
          <Input label="Perks" hint="One per line"><textarea rows={3} className={field} value={f.perks} onChange={(e) => set('perks', e.target.value)} placeholder="LinkedIn recommendation&#10;Reference letter" /></Input>
          <Input label="Skills" hint="Comma separated, shown as tags" className="sm:col-span-2"><input className={field} value={f.skills} onChange={(e) => set('skills', e.target.value)} placeholder="React, Node.js, Tailwind" /></Input>
          <Input label="Compensation note" className="sm:col-span-2" hint="Leave blank for the default unpaid + possible future revenue share wording."><textarea rows={2} className={field} value={f.compensationNote} onChange={(e) => set('compensationNote', e.target.value)} maxLength={600} /></Input>

          <div className="sm:col-span-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Screening questions (max 5)</span>
              {f.questions.length < 5 && <button type="button" onClick={() => set('questions', [...f.questions, { label: '', required: false }])} className="flex items-center gap-1 text-xs font-bold text-neutral-700 hover:text-neutral-900"><Plus className="h-3 w-3" />Add</button>}
            </div>
            <div className="space-y-2">
              {f.questions.map((q, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input className={field} value={q.label} placeholder="e.g. Link a React project you're proud of" onChange={(e) => set('questions', f.questions.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                  <label className="flex flex-shrink-0 items-center gap-1 text-xs text-neutral-600"><input type="checkbox" checked={q.required} onChange={(e) => set('questions', f.questions.map((x, j) => (j === i ? { ...x, required: e.target.checked } : x)))} />Required</label>
                  <button type="button" onClick={() => set('questions', f.questions.filter((_, j) => j !== i))} className="rounded p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600"><X className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
          </div>

          <Input label="Application deadline" hint="Optional. Role auto-closes after this date."><input type="date" className={field} value={f.deadline} onChange={(e) => set('deadline', e.target.value)} /></Input>
          <Input label="Sort order" hint="Lower shows first"><input type="number" className={field} value={f.sortOrder} onChange={(e) => set('sortOrder', e.target.value)} /></Input>
          <label className="flex items-center gap-2 text-sm font-medium text-neutral-700"><input type="checkbox" checked={f.featured} onChange={(e) => set('featured', e.target.checked)} />Featured (glow + pinned to top)</label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 bg-neutral-50 px-6 py-4">
          <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold text-neutral-600 hover:bg-neutral-100">Cancel</button>
          <div className="flex gap-2">
            <button disabled={busy} onClick={() => save('draft')} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-white">Save as draft</button>
            <button disabled={busy} onClick={() => save('open')} className="flex items-center gap-2 rounded-lg bg-neutral-900 px-5 py-2 text-sm font-bold text-white hover:bg-neutral-700 disabled:opacity-60">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}{job?._id && job.status === 'open' ? 'Save changes' : 'Publish'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Application detail ─────────────────────────────────────────────────────── */
function Row({ k, v }) {
  if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) return null;
  return (
    <div className="flex gap-3 py-1.5 text-sm"><div className="w-32 flex-shrink-0 text-xs font-bold uppercase tracking-wide text-neutral-400">{k}</div><div className="min-w-0 break-words text-neutral-800">{v}</div></div>
  );
}
const Link = ({ href }) => (href ? <a href={href} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-indigo-600 hover:underline">{href.replace(/^https?:\/\/(www\.)?/, '').slice(0, 44)}<ExternalLink className="h-3 w-3" /></a> : null);

function ApplicationPanel({ app, onClose, onChange, onDelete, isDemo }) {
  const [notes, setNotes] = useState(app.adminNotes || '');
  const [tag, setTag] = useState('');
  useEffect(() => setNotes(app.adminNotes || ''), [app._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = async (body) => {
    if (isDemo) { toast.success('Updated (sandbox)'); return; }
    try { const r = await api.patch(`/careers/admin/applications/${app._id}`, body); onChange(r.data.item); } catch (e) { toast.error(e?.response?.data?.error || 'Update failed'); }
  };
  const t = (k) => app.firstTouch?.[k] || app.lastTouch?.[k];

  return (
    <motion.div className="fixed inset-0 z-[110]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <motion.aside initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 300, damping: 34 }} className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-neutral-100 bg-white/95 px-6 py-4 backdrop-blur">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-black text-neutral-900">{app.fullName}</h3>
            <p className="truncate text-xs text-neutral-500">{app.jobTitle} · applied {ago(app.createdAt)}</p>
          </div>
          <div className="flex items-center gap-1">
            <a href={`mailto:${app.email}`} className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100" title="Email"><Mail className="h-4 w-4" /></a>
            <button onClick={onClose} className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100"><X className="h-5 w-5" /></button>
          </div>
        </div>

        <div className="space-y-6 px-6 py-5">
          <div>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {STATUSES.map((s) => (
                <button key={s} onClick={() => patch({ status: s })} className={`rounded-full px-3 py-1 text-xs font-bold capitalize transition ${app.status === s ? `${STATUS_STYLE[s]} ring-2 ring-offset-1 ring-neutral-900/20` : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'}`}>{s}</button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => patch({ rating: app.rating === n ? 0 : n })} aria-label={`${n} stars`}>
                  <Star className={`h-5 w-5 transition ${n <= app.rating ? 'fill-amber-400 text-amber-400' : 'text-neutral-300 hover:text-amber-300'}`} />
                </button>
              ))}
            </div>
          </div>

          <section>
            <h4 className="mb-1 text-[11px] font-black uppercase tracking-widest text-neutral-400">Contact</h4>
            <Row k="Email" v={<a className="text-indigo-600 hover:underline" href={`mailto:${app.email}`}>{app.email}</a>} /><Row k="Phone" v={app.phone} /><Row k="Location" v={app.location} /><Row k="Timezone" v={app.timezone} />
            <Row k="LinkedIn" v={<Link href={app.linkedin} />} /><Row k="GitHub" v={<Link href={app.github} />} /><Row k="Portfolio" v={<Link href={app.portfolio} />} /><Row k="Resume" v={<Link href={app.resumeUrl} />} />
          </section>

          <section>
            <h4 className="mb-1 text-[11px] font-black uppercase tracking-widest text-neutral-400">Fit</h4>
            <Row k="Status" v={[app.currentStatus, app.organization].filter(Boolean).join(' · ')} /><Row k="Experience" v={app.experienceLevel} />
            <Row k="Hours / week" v={app.hoursPerWeek} /><Row k="Can start" v={app.startDate} />
            <Row k="Skills" v={app.skills?.length ? <div className="flex flex-wrap gap-1">{app.skills.map((s) => <Pill key={s} className="bg-neutral-100 text-neutral-700">{s}</Pill>)}</div> : null} />
            {app.whyYou && <div className="mt-2 whitespace-pre-line rounded-xl bg-neutral-50 p-3 text-sm leading-relaxed text-neutral-700"><b className="mb-1 block text-[11px] uppercase tracking-wide text-neutral-400">Why PlanIt</b>{app.whyYou}</div>}
            {app.proudestWork && <div className="mt-2 whitespace-pre-line rounded-xl bg-neutral-50 p-3 text-sm leading-relaxed text-neutral-700"><b className="mb-1 block text-[11px] uppercase tracking-wide text-neutral-400">Proud of</b>{app.proudestWork}</div>}
            {(app.answers || []).map((a) => <div key={a.label} className="mt-2 whitespace-pre-line rounded-xl bg-neutral-50 p-3 text-sm text-neutral-700"><b className="mb-1 block text-[11px] text-neutral-400">{a.label}</b>{a.answer}</div>)}
          </section>

          <section>
            <h4 className="mb-1 text-[11px] font-black uppercase tracking-widest text-neutral-400">Where they came from</h4>
            <Row k="They said" v={<b>{SOURCE_LABEL[app.source] || app.source}{app.sourceDetail ? ` — ${app.sourceDetail}` : ''}</b>} />
            <Row k="We detected" v={app.detectedSource ? (SOURCE_LABEL[app.detectedSource] || app.detectedSource) : 'nothing (no referrer / link tag)'} />
            <Row k="First visit via" v={app.firstTouch?.referrer || app.firstTouch?.ref} /><Row k="Landing" v={app.firstTouch?.landing} />
            <Row k="UTM" v={[t('source'), t('medium'), t('campaign'), t('content')].filter(Boolean).join(' / ')} />
            <Row k="First seen" v={app.firstTouch?.at ? dt(app.firstTouch.at) : ''} />
          </section>

          <section>
            <h4 className="mb-1 text-[11px] font-black uppercase tracking-widest text-neutral-400">Behavior and device</h4>
            <Row k="Scroll depth" v={`${app.scrollDepthMax}%`} /><Row k="On page" v={mins(app.secondsOnPage)} /><Row k="On form" v={mins(app.secondsOnForm)} />
            <Row k="Roles viewed" v={(app.rolesViewed || []).join(', ')} /><Row k="Session page views" v={app.pageViewsInSession} /><Row k="Returning" v={app.returningVisitor ? 'Yes' : 'No'} />
            <Row k="Device" v={`${app.deviceType}${app.platform ? ` · ${app.platform}` : ''}`} /><Row k="Language" v={app.language} /><Row k="Country" v={app.country} />
            <Row k="Screen" v={app.screen?.w ? `${app.screen.w}×${app.screen.h} @${app.screen.dpr}x` : ''} /><Row k="Theme" v={app.colorScheme} /><Row k="IP" v={app.ip} />
            <Row k="Visitor ID" v={<span className="font-mono text-xs">{app.visitorId}</span>} />
            <Row k="User agent" v={<span className="text-xs text-neutral-500">{app.userAgent}</span>} />
          </section>

          <section>
            <h4 className="mb-2 text-[11px] font-black uppercase tracking-widest text-neutral-400">Notes and tags</h4>
            <textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => notes !== (app.adminNotes || '') && patch({ adminNotes: notes })} className={field} placeholder="Private notes (saved when you click away)" />
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {(app.tags || []).map((x) => <Pill key={x} className="bg-neutral-900 text-white">{x}<button className="ml-1" onClick={() => patch({ tags: app.tags.filter((y) => y !== x) })}><X className="h-3 w-3" /></button></Pill>)}
              <input value={tag} onChange={(e) => setTag(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && tag.trim()) { patch({ tags: [...(app.tags || []), tag.trim()] }); setTag(''); } }} placeholder="+ tag" className="w-24 rounded-md border border-dashed border-neutral-300 px-2 py-0.5 text-xs outline-none focus:border-neutral-900" />
            </div>
          </section>

          {app.statusHistory?.length > 1 && (
            <section>
              <h4 className="mb-1 text-[11px] font-black uppercase tracking-widest text-neutral-400">History</h4>
              {[...app.statusHistory].reverse().map((h, i) => <div key={i} className="flex justify-between py-1 text-xs text-neutral-500"><span className="font-semibold capitalize text-neutral-700">{h.status}</span><span>{h.by} · {dt(h.at)}</span></div>)}
            </section>
          )}

          <button onClick={() => onDelete(app)} className="flex items-center gap-2 text-xs font-bold text-red-600 hover:underline"><Trash2 className="h-3.5 w-3.5" />Delete application</button>
        </div>
      </motion.aside>
    </motion.div>
  );
}

/* ── Main panel ─────────────────────────────────────────────────────────────── */
export default function AdminCareers({ isDemo = false }) {
  const [tab, setTab] = useState('applications');
  const [overview, setOverview] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [apps, setApps] = useState({ items: [], total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [filters, setFilters] = useState({ status: 'all', job: 'all', source: 'all', q: '', sort: 'new', page: 1 });
  const [editing, setEditing] = useState(null);       // null | {} (new) | job
  const [openApp, setOpenApp] = useState(null);
  const [linksFor, setLinksFor] = useState(null);
  const [busy, setBusy] = useState('');

  const loadAll = useCallback(async (silent) => {
    if (isDemo) { setOverview(DEMO_OVERVIEW); setLoading(false); return; }
    if (!silent) setLoading(true);
    try {
      const [o, j] = await Promise.all([api.get('/careers/admin/overview'), api.get('/careers/admin/jobs')]);
      setOverview(o.data); setJobs(j.data.jobs || []); setErr('');
    } catch (e) { setErr(e?.response?.data?.error || e.message || 'Failed to load careers'); } finally { setLoading(false); }
  }, [isDemo]);

  const loadApps = useCallback(async () => {
    if (isDemo) return;
    try {
      const params = { ...filters, limit: 30 };
      Object.keys(params).forEach((k) => (params[k] === 'all' || params[k] === '') && delete params[k]);
      const r = await api.get('/careers/admin/applications', { params });
      setApps(r.data);
    } catch (e) { setErr(e?.response?.data?.error || 'Failed to load applications'); }
  }, [filters, isDemo]);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { const t = setTimeout(loadApps, filters.q ? 300 : 0); return () => clearTimeout(t); }, [loadApps, filters.q]);
  useEffect(() => { if (isDemo) return undefined; const t = setInterval(() => { loadAll(true); loadApps(); }, 30000); return () => clearInterval(t); }, [isDemo, loadAll, loadApps]);

  const setF = (k, v) => setFilters((p) => ({ ...p, [k]: v, page: k === 'page' ? v : 1 }));
  const accepting = overview?.settings?.acceptingApplications !== false;

  const toggleAccepting = async () => {
    if (isDemo) { toast.success('Toggled (sandbox)'); return; }
    setBusy('toggle');
    try {
      const r = await api.put('/careers/admin/settings', { acceptingApplications: !accepting });
      setOverview((o) => ({ ...o, settings: r.data.settings }));
      toast.success(r.data.settings.acceptingApplications ? 'Applications are open again' : 'All applications paused');
    } catch (e) { toast.error(e?.response?.data?.error || 'Could not update'); } finally { setBusy(''); }
  };
  const testAlert = async () => {
    if (isDemo) { toast.success('Test alert sent (sandbox)'); return; }
    setBusy('alert');
    try {
      const r = await api.post('/careers/admin/test-alert');
      const c = r.data.channels || {};
      toast.success(`Sent via ${r.data.via} — Discord ${c.discord ? '✓' : '✗'} · ntfy ${c.ntfy ? '✓' : '✗'} · Slack ${c.slack ? '✓' : '✗'}`, { duration: 6000 });
    } catch (e) { toast.error(e?.response?.data?.error || 'Test alert failed'); } finally { setBusy(''); }
  };
  const exportCsv = async () => {
    if (isDemo) { toast.success('Export disabled in sandbox'); return; }
    try {
      const params = { ...filters }; delete params.page; delete params.sort;
      Object.keys(params).forEach((k) => (params[k] === 'all' || params[k] === '') && delete params[k]);
      const r = await api.get('/careers/admin/applications.csv', { params, responseType: 'blob' });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a'); a.href = url; a.download = `planit-applications-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
    } catch (e) { toast.error('Export failed'); }
  };

  const closeJob = async (j) => {
    const reason = window.prompt(`Close "${j.title}"? Optional note shown on the page (e.g. "Position filled"):`, '');
    if (reason === null) return;
    if (isDemo) { toast.success('Closed (sandbox)'); return; }
    try { await api.post(`/careers/admin/jobs/${j._id}/close`, { reason }); toast.success('Listing closed'); loadAll(true); } catch (e) { toast.error(e?.response?.data?.error || 'Failed'); }
  };
  const reopenJob = async (j) => {
    if (isDemo) { toast.success('Reopened (sandbox)'); return; }
    try { await api.post(`/careers/admin/jobs/${j._id}/reopen`); toast.success('Listing reopened'); loadAll(true); } catch (e) { toast.error(e?.response?.data?.error || 'Failed'); }
  };
  const deleteJob = async (j) => {
    if (!window.confirm(`Delete "${j.title}" permanently? Existing applications are kept.`)) return;
    if (isDemo) { toast.success('Deleted (sandbox)'); return; }
    try { await api.delete(`/careers/admin/jobs/${j._id}`); toast.success('Listing deleted'); loadAll(true); } catch (e) { toast.error(e?.response?.data?.error || 'Failed'); }
  };
  const deleteApp = async (a) => {
    if (!window.confirm(`Delete ${a.fullName}'s application permanently?`)) return;
    if (isDemo) { toast.success('Deleted (sandbox)'); return; }
    try { await api.delete(`/careers/admin/applications/${a._id}`); setOpenApp(null); toast.success('Application deleted'); loadApps(); loadAll(true); } catch (e) { toast.error(e?.response?.data?.error || 'Failed'); }
  };
  const copyLink = (j, ch) => {
    const url = `${window.location.origin}/careers/${j.slug}?src=${ch}&utm_source=${ch}&utm_medium=recruiting&utm_campaign=${j.slug}`;
    navigator.clipboard?.writeText(url).then(() => toast.success(`${SOURCE_LABEL[ch] || ch} link copied`));
  };

  const maxSrc = Math.max(1, ...(overview?.bySource || []).map((s) => s.n));
  const funnel = overview?.funnel || {};
  const fSteps = [['page_view', 'Viewed page'], ['role_open', 'Opened a role'], ['apply_start', 'Started form'], ['step_2', 'Reached step 2'], ['step_3', 'Reached step 3'], ['apply_submit', 'Submitted']];
  const fTop = Math.max(1, funnel.page_view?.visitors || 0);

  const tabs = useMemo(() => [['applications', 'Applications', Inbox, overview?.byStatus?.new || 0], ['listings', 'Listings', Briefcase, overview?.openJobs || 0], ['insights', 'Insights', Eye, 0]], [overview]);

  if (loading) return <div className="flex items-center justify-center py-24 text-neutral-400"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading careers…</div>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-black text-neutral-900"><Briefcase className="h-5 w-5" />Careers</h2>
          <p className="text-sm text-neutral-500">Volunteer roles, applications and where candidates come from.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => { loadAll(true); loadApps(); }} className="rounded-lg border border-neutral-200 p-2 text-neutral-500 hover:bg-neutral-50" title="Refresh"><RefreshCw className="h-4 w-4" /></button>
          <button onClick={testAlert} disabled={busy === 'alert'} className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-50"><Bell className="h-4 w-4" />Test alert</button>
          <button onClick={exportCsv} className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-50"><Download className="h-4 w-4" />CSV</button>
          <button onClick={toggleAccepting} disabled={busy === 'toggle'} className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold transition ${accepting ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-amber-500 text-white hover:bg-amber-600'}`}>
            {accepting ? <><Pause className="h-4 w-4" />Applications open · pause</> : <><Play className="h-4 w-4" />Paused · resume</>}
          </button>
        </div>
      </div>

      {err && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</div>}
      {!accepting && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"><b>Applications are paused.</b> Visitors can still read roles but cannot apply.</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total applicants" value={overview?.total ?? 0} accent="bg-neutral-900" />
        <Stat label="New (unreviewed)" value={overview?.byStatus?.new ?? 0} accent="bg-sky-500" />
        <Stat label="Open roles" value={overview?.openJobs ?? 0} accent="bg-emerald-500" />
        <Stat label="In pipeline" value={(overview?.byStatus?.interview || 0) + (overview?.byStatus?.trial || 0)} sub={`${overview?.byStatus?.accepted || 0} accepted`} accent="bg-violet-500" />
      </div>

      <div className="flex gap-1 rounded-xl bg-neutral-100 p-1">
        {tabs.map(([id, label, I, c]) => (
          <button key={id} onClick={() => setTab(id)} className={`relative flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition ${tab === id ? 'text-neutral-900' : 'text-neutral-500 hover:text-neutral-800'}`}>
            {tab === id && <motion.span layoutId="careers-admin-tab" className="absolute inset-0 rounded-lg bg-white shadow-sm" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
            <span className="relative flex items-center gap-2"><I className="h-4 w-4" />{label}{c > 0 && <span className="rounded-full bg-neutral-900 px-1.5 text-[10px] font-bold text-white">{c}</span>}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === 'applications' && (
          <motion.div key="apps" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <div className="relative min-w-[200px] flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" /><input value={filters.q} onChange={(e) => setF('q', e.target.value)} placeholder="Search name, email, school, skill" className={`${field} pl-9`} /></div>
              <select className={`${field} w-auto`} value={filters.status} onChange={(e) => setF('status', e.target.value)}><option value="all">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
              <select className={`${field} w-auto`} value={filters.job} onChange={(e) => setF('job', e.target.value)}><option value="all">All roles</option><option value="general">General</option>{jobs.map((j) => <option key={j._id} value={j.slug}>{j.title}</option>)}</select>
              <select className={`${field} w-auto`} value={filters.source} onChange={(e) => setF('source', e.target.value)}><option value="all">All sources</option>{Object.entries(SOURCE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              <select className={`${field} w-auto`} value={filters.sort} onChange={(e) => setF('sort', e.target.value)}><option value="new">Newest</option><option value="rating">Top rated</option></select>
            </div>
            <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
              {apps.items.length === 0 ? (
                <div className="p-12 text-center text-sm text-neutral-400"><Users className="mx-auto mb-2 h-8 w-8 opacity-30" />No applications match.</div>
              ) : apps.items.map((a, i) => (
                <motion.button key={a._id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i, 10) * 0.025 }} onClick={() => setOpenApp(a)} className="flex w-full items-center gap-3 border-b border-neutral-100 px-4 py-3 text-left transition last:border-0 hover:bg-neutral-50">
                  <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-neutral-900 text-sm font-black text-white">{a.fullName.slice(0, 1).toUpperCase()}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><span className="truncate text-sm font-bold text-neutral-900">{a.fullName}</span>{a.status === 'new' && <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />}</div>
                    <div className="truncate text-xs text-neutral-500">{a.jobTitle} · {a.location || a.email}</div>
                  </div>
                  <div className="hidden items-center gap-1 sm:flex">{[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`h-3 w-3 ${n <= a.rating ? 'fill-amber-400 text-amber-400' : 'text-neutral-200'}`} />)}</div>
                  <Pill className="hidden bg-neutral-100 text-neutral-600 md:inline-flex">{SOURCE_LABEL[a.source] || a.source}</Pill>
                  <Pill className={`${STATUS_STYLE[a.status]} capitalize`}>{a.status}</Pill>
                  <span className="hidden w-16 text-right text-xs text-neutral-400 lg:block">{ago(a.createdAt)}</span>
                </motion.button>
              ))}
            </div>
            {apps.pages > 1 && (
              <div className="flex items-center justify-between text-xs text-neutral-500">
                <span>{apps.total} total</span>
                <div className="flex gap-2"><button disabled={apps.page <= 1} onClick={() => setF('page', apps.page - 1)} className="rounded-lg border px-3 py-1.5 font-bold disabled:opacity-40">Prev</button><span className="py-1.5">{apps.page} / {apps.pages}</span><button disabled={apps.page >= apps.pages} onClick={() => setF('page', apps.page + 1)} className="rounded-lg border px-3 py-1.5 font-bold disabled:opacity-40">Next</button></div>
              </div>
            )}
          </motion.div>
        )}

        {tab === 'listings' && (
          <motion.div key="listings" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
            <button onClick={() => setEditing({})} className="flex items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-neutral-700"><Plus className="h-4 w-4" />Add job listing</button>
            {jobs.length === 0 && <div className="rounded-2xl border border-dashed border-neutral-300 p-12 text-center text-sm text-neutral-400">No listings yet. Add your first volunteer role.</div>}
            {jobs.map((j, i) => (
              <motion.div key={j._id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="rounded-2xl border border-neutral-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-black text-neutral-900">{j.title}</h3>
                      <Pill className={j.openNow ? 'bg-emerald-100 text-emerald-700' : j.status === 'draft' ? 'bg-neutral-100 text-neutral-500' : 'bg-red-100 text-red-700'}>{j.openNow ? 'Open' : j.status === 'draft' ? 'Draft' : 'Closed'}</Pill>
                      {j.featured && <Pill className="bg-amber-100 text-amber-800">Featured</Pill>}
                      <Pill className="bg-neutral-100 text-neutral-600">{j.team}</Pill>
                    </div>
                    <p className="mt-1 text-xs text-neutral-500">{j.hoursPerWeek} · {j.location} · {j.views || 0} views{j.deadline ? ` · closes ${new Date(j.deadline).toLocaleDateString()}` : ''}{j.status === 'closed' && j.closedReason ? ` · ${j.closedReason}` : ''}</p>
                  </div>
                  <div className="text-right"><div className="text-2xl font-black text-neutral-900">{j.applications}</div><div className="text-[11px] text-neutral-400">{j.newApplications > 0 ? `${j.newApplications} new` : 'applicants'}</div></div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button onClick={() => setEditing(j)} className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-bold text-neutral-700 hover:bg-neutral-50"><Edit2 className="h-3.5 w-3.5" />Edit</button>
                  {j.status === 'open' ? (
                    <button onClick={() => closeJob(j)} className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50"><Lock className="h-3.5 w-3.5" />Close</button>
                  ) : (
                    <button onClick={() => reopenJob(j)} className="flex items-center gap-1.5 rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50"><Unlock className="h-3.5 w-3.5" />{j.status === 'draft' ? 'Publish' : 'Reopen'}</button>
                  )}
                  <button onClick={() => setLinksFor(linksFor === j._id ? null : j._id)} className="flex items-center gap-1.5 rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-bold text-neutral-700 hover:bg-neutral-50"><Link2 className="h-3.5 w-3.5" />Tracking links<ChevronDown className={`h-3 w-3 transition ${linksFor === j._id ? 'rotate-180' : ''}`} /></button>
                  <a href={`/careers/${j.slug}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-bold text-neutral-500 hover:text-neutral-900"><ExternalLink className="h-3.5 w-3.5" />View</a>
                  <button onClick={() => deleteJob(j)} className="ml-auto rounded-lg p-1.5 text-neutral-300 hover:bg-red-50 hover:text-red-600" title="Delete"><Trash2 className="h-4 w-4" /></button>
                </div>
                <AnimatePresence>
                  {linksFor === j._id && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="mt-3 rounded-xl bg-neutral-50 p-3">
                        <p className="mb-2 text-xs text-neutral-500">Post the matching link on each site. Every applicant is then attributed to the exact channel, even when the site hides its referrer (LinkedIn app, Handshake, etc.).</p>
                        <div className="flex flex-wrap gap-1.5">{CHANNELS.map((c) => <button key={c} onClick={() => copyLink(j, c)} className="flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px] font-bold text-neutral-700 hover:border-neutral-900"><Copy className="h-3 w-3" />{SOURCE_LABEL[c]}</button>)}</div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </motion.div>
        )}

        {tab === 'insights' && (
          <motion.div key="insights" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-neutral-200 bg-white p-5 lg:col-span-2">
              <div className="mb-1 flex items-center justify-between"><h3 className="text-sm font-black text-neutral-900">Applications, last 30 days</h3><span className="text-xs text-neutral-400">{(overview?.series || []).reduce((a, s) => a + s.n, 0)} total</span></div>
              <Spark series={overview?.series || []} />
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-white p-5">
              <h3 className="mb-4 text-sm font-black text-neutral-900">Where applicants came from</h3>
              {(overview?.bySource || []).length === 0 && <p className="text-sm text-neutral-400">No applications yet.</p>}
              <div className="space-y-3">
                {(overview?.bySource || []).map((s, i) => (
                  <div key={s.source}>
                    <div className="mb-1 flex items-center justify-between text-xs"><span className="font-bold text-neutral-800">{SOURCE_LABEL[s.source] || s.source}</span><span className="text-neutral-500">{s.n} applied · {s.shortlisted} shortlisted{s.avgRating ? ` · ★${s.avgRating}` : ''}</span></div>
                    <Bar pct={(s.n / maxSrc) * 100} delay={i * 0.05} color="bg-gradient-to-r from-neutral-900 to-neutral-600" />
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-white p-5">
              <h3 className="mb-4 text-sm font-black text-neutral-900">Funnel (unique visitors, 30 days)</h3>
              <div className="space-y-3">
                {fSteps.map(([k, l], i) => {
                  const v = funnel[k]?.visitors || 0;
                  return <div key={k}><div className="mb-1 flex justify-between text-xs"><span className="font-bold text-neutral-800">{l}</span><span className="text-neutral-500">{v}{i > 0 && fTop > 0 ? ` · ${Math.round((v / fTop) * 100)}%` : ''}</span></div><Bar pct={(v / fTop) * 100} delay={i * 0.06} color="bg-gradient-to-r from-indigo-500 to-cyan-400" /></div>;
                })}
              </div>
              {funnel.apply_abandon?.visitors > 0 && <p className="mt-4 text-xs text-amber-700">{funnel.apply_abandon.visitors} visitor{funnel.apply_abandon.visitors === 1 ? '' : 's'} left the form mid-way.</p>}
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-white p-5">
              <h3 className="mb-3 text-sm font-black text-neutral-900">Applicant behavior (averages)</h3>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div><div className="text-2xl font-black text-neutral-900">{overview?.engagement?.scroll || 0}%</div><div className="text-[11px] text-neutral-400">scroll depth</div></div>
                <div><div className="flex items-center justify-center gap-1 text-2xl font-black text-neutral-900"><Clock className="h-4 w-4 text-neutral-300" />{mins(overview?.engagement?.secondsOnPage || 0)}</div><div className="text-[11px] text-neutral-400">on page</div></div>
                <div><div className="text-2xl font-black text-neutral-900">{mins(overview?.engagement?.secondsOnForm || 0)}</div><div className="text-[11px] text-neutral-400">filling the form</div></div>
              </div>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-white p-5">
              <h3 className="mb-3 text-sm font-black text-neutral-900">Applicants per role</h3>
              {(overview?.perJob || []).map((j) => <div key={j.slug} className="flex justify-between py-1 text-sm"><span className="truncate text-neutral-700">{j.title}</span><b className="text-neutral-900">{j.n}</b></div>)}
              {(overview?.perJob || []).length === 0 && <p className="text-sm text-neutral-400">Nothing yet.</p>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {editing && <ListingEditor key={editing._id || 'new'} job={editing._id ? editing : null} isDemo={isDemo} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); loadAll(true); }} />}
      </AnimatePresence>
      <AnimatePresence>
        {openApp && <ApplicationPanel key={openApp._id} app={openApp} isDemo={isDemo} onClose={() => setOpenApp(null)} onDelete={deleteApp}
          onChange={(item) => { setOpenApp(item); setApps((p) => ({ ...p, items: p.items.map((x) => (x._id === item._id ? item : x)) })); loadAll(true); }} />}
      </AnimatePresence>
    </div>
  );
}
