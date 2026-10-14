import React, { memo, useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Briefcase, Calendar, Check, ExternalLink, GripVertical, Loader2, Mail, MapPin, Maximize2, Plus, RefreshCw,
  Search, Trash2, UserPlus, X, Edit2, ZoomIn, ZoomOut, Globe, Lock, Users, Clock, Download, Crown, Minimize2, Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';
import AddPersonWizard from './AddPersonWizard';
import { ago, when } from './teamShared';
import {
  CARD_W, CARD_H, HEAD_W, HEAD_H, MAX_LEVEL, computeLayout, linkPath, childrenMap, descendantsOf,
  ancestorsOf, planMove, validTargets, initials,
} from './orgChartLogic';

/**
 * Admin -> Careers -> Org chart
 *  - every logged-in employee can view (read-only)
 *  - super admins can edit profiles and drag people between levels / managers
 *  - cards and connector lines are driven by the same animated positions, so lines follow live while dragging
 */

const ACCENT = {
  slate:   { bar: 'bg-slate-500',   soft: 'bg-slate-100 text-slate-700',     border: 'border-slate-300',   wash: 'bg-slate-100/50',   hex: '#64748b' },
  indigo:  { bar: 'bg-indigo-500',  soft: 'bg-indigo-100 text-indigo-700',   border: 'border-indigo-300',  wash: 'bg-indigo-100/40',  hex: '#6366f1' },
  emerald: { bar: 'bg-emerald-500', soft: 'bg-emerald-100 text-emerald-700', border: 'border-emerald-300', wash: 'bg-emerald-100/40', hex: '#10b981' },
  amber:   { bar: 'bg-amber-500',   soft: 'bg-amber-100 text-amber-800',     border: 'border-amber-300',   wash: 'bg-amber-100/40',   hex: '#f59e0b' },
  rose:    { bar: 'bg-rose-500',    soft: 'bg-rose-100 text-rose-700',       border: 'border-rose-300',    wash: 'bg-rose-100/40',    hex: '#f43f5e' },
  sky:     { bar: 'bg-sky-500',     soft: 'bg-sky-100 text-sky-700',         border: 'border-sky-300',     wash: 'bg-sky-100/40',     hex: '#0ea5e9' },
  violet:  { bar: 'bg-violet-500',  soft: 'bg-violet-100 text-violet-700',   border: 'border-violet-300',  wash: 'bg-violet-100/40',  hex: '#8b5cf6' },
  teal:    { bar: 'bg-teal-500',    soft: 'bg-teal-100 text-teal-700',       border: 'border-teal-300',    wash: 'bg-teal-100/40',    hex: '#14b8a6' },
};
const field = 'w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-neutral-900 focus:ring-2 focus:ring-neutral-900/10';

const DEMO_NODES = [
  { _id: 'd1', title: 'Founder & CEO', department: 'Leadership', status: 'filled', level: 0, parentId: null, order: 0, personName: 'Alex Morgan', personEmail: 'alex@example.com', bio: 'Sets direction and keeps the roadmap honest.', skills: ['Strategy', 'Product'], links: [], accent: 'indigo', location: 'New Jersey' },
  { _id: 'd2', title: 'Head of Engineering', department: 'Engineering', status: 'filled', level: 1, parentId: 'd1', order: 0, personName: 'Sam Rivera', personEmail: 'sam@example.com', bio: 'Owns the platform.', skills: ['Node.js', 'React'], links: [], accent: 'sky' },
  { _id: 'd3', title: 'Head of Community', department: 'Community', status: 'filled', level: 1, parentId: 'd1', order: 1, personName: 'Jordan Lee', personEmail: 'jordan@example.com', bio: '', skills: ['Events'], links: [], accent: 'emerald' },
  { _id: 'd4', title: 'Frontend Engineer', department: 'Engineering', status: 'filled', level: 2, parentId: 'd2', order: 0, personName: 'Priya Shah', personEmail: 'priya@example.com', bio: '', skills: ['React'], links: [], accent: 'sky' },
  { _id: 'd5', title: 'Backend Engineer', department: 'Engineering', status: 'open', level: 2, parentId: 'd2', order: 1, description: 'Own APIs and data models.', jobSlug: '', skills: [], links: [], accent: 'sky' },
  { _id: 'd6', title: 'Campus Ambassador', department: 'Community', status: 'open', level: 2, parentId: 'd3', order: 0, description: 'Grow PlanIt on campus.', skills: [], links: [], accent: 'emerald' },
];

/* ── small bits ─────────────────────────────────────────────────────────────── */
function Avatar({ node, size = 40 }) {
  const [bad, setBad] = useState(false);
  const a = ACCENT[node.accent] || ACCENT.slate;
  if (node.status === 'open') {
    return <div style={{ width: size, height: size }} className="flex flex-shrink-0 items-center justify-center rounded-full border-2 border-dashed border-neutral-300 text-neutral-400"><UserPlus style={{ width: size * 0.45, height: size * 0.45 }} /></div>;
  }
  if (node.avatar && !bad) return <img src={node.avatar} alt="" referrerPolicy="no-referrer" onError={() => setBad(true)} style={{ width: size, height: size }} className="flex-shrink-0 rounded-full object-cover" />;
  return <div style={{ width: size, height: size, fontSize: size * 0.36 }} className={`flex flex-shrink-0 items-center justify-center rounded-full font-black text-white ${a.bar}`}>{initials(node.personName)}</div>;
}

const tenure = (d) => {
  if (!d) return '';
  const m = Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / (30.44 * 864e5)));
  return m < 1 ? 'new' : m < 12 ? `${m} mo` : `${Math.floor(m / 12)} yr${m >= 24 ? 's' : ''}`;
};

/* ── the draggable card ─────────────────────────────────────────────────────── */
const Card = memo(function Card({ node, x, y, reports, flags, canEdit, onDown, onOpen, onHover, onAdd }) {
  const a = ACCENT[node.accent] || ACCENT.slate;
  const open = node.status === 'open';
  const { selected, dim, match, isMe, placeholder, hot, ghost, invalid, lead } = flags;
  const dark = lead && !open;
  const seats = open ? Math.max(1, node.seats || 1) : 1;
  const multi = seats > 1;
  return (
    <div
      data-card={node._id}
      onPointerDown={(e) => onDown(e, node)}
      onPointerEnter={() => onHover(node._id)}
      onPointerLeave={() => onHover(null)}
      onClick={() => onOpen(node._id)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpen(node._id); } }}
      role="button" tabIndex={0}
      aria-label={`${open ? 'Open position' : node.personName}, ${node.title}`}
      style={{ boxShadow: multi ? '5px 5px 0 -1px #fff, 5px 5px 0 0 #d4d4d4, 10px 10px 0 -1px #fff, 10px 10px 0 0 #e5e5e5' : undefined, position: 'absolute', left: 0, top: 0, width: CARD_W, height: CARD_H, transform: `translate3d(${x}px, ${y}px, 0)${ghost ? ' scale(1.05) rotate(-1.2deg)' : ''}`, zIndex: ghost ? 50 : hot ? 20 : 10, willChange: 'transform', touchAction: 'manipulation' }}
      className={`group select-none overflow-hidden rounded-2xl border text-left outline-none transition-[box-shadow,opacity,border-color] duration-150
        ${dark ? 'border-neutral-900 bg-neutral-900 text-white' : `bg-white ${open ? 'border-dashed border-neutral-300' : 'border-neutral-200'}`}
        ${canEdit ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${dim ? 'opacity-30' : ''} ${placeholder ? 'opacity-40' : ''}
        ${ghost ? (invalid ? 'border-red-400 shadow-2xl' : 'border-emerald-400 shadow-2xl') : 'shadow-sm hover:shadow-lg'}
        ${selected ? 'ring-2 ring-indigo-500' : ''} ${match ? 'ring-2 ring-amber-400' : ''} ${hot ? 'ring-2 ring-emerald-500 shadow-lg' : ''} focus-visible:ring-2 focus-visible:ring-indigo-500`}
    >
      <div className={`h-1.5 w-full ${open ? 'bg-neutral-200' : dark ? 'bg-indigo-400' : a.bar}`} />
      <div className="flex items-start gap-3 px-3.5 pt-3">
        <Avatar node={node} size={46} />
        <div className="min-w-0 flex-1">
          <div className={`truncate text-[16px] font-black leading-tight ${dark ? 'text-white' : 'text-neutral-900'}`}>{open ? 'Open position' : node.personName}</div>
          <div className={`mt-0.5 line-clamp-2 text-[13px] font-semibold leading-snug ${dark ? 'text-neutral-200' : 'text-neutral-600'}`}>{node.title}</div>
        </div>
        {canEdit && <span data-grip className={`-mr-1 -mt-0.5 flex-shrink-0 cursor-grab rounded p-1 ${dark ? 'text-neutral-500 hover:text-white' : 'text-neutral-300 hover:text-neutral-600'}`} style={{ touchAction: 'none' }} title="Drag"><GripVertical className="h-4 w-4" /></span>}
      </div>
      <div className="absolute inset-x-3.5 bottom-2.5 flex items-center gap-1.5">
        {open
          ? <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">{multi ? `${seats} openings` : 'Hiring'}{typeof node.applicants === 'number' ? ` · ${node.applicants} applied` : ''}</span>
          : lead
            ? <span className="flex items-center gap-1 rounded-full bg-indigo-500/20 px-2.5 py-0.5 text-[11px] font-bold text-indigo-200"><Crown className="h-3 w-3" />Super admin</span>
            : <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">Filled</span>}
        {isMe && <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${dark ? 'bg-white text-neutral-900' : 'bg-neutral-900 text-white'}`}>You</span>}
        {node.department && !lead && <span className="min-w-0 truncate text-[11px] text-neutral-400">{node.department}</span>}
        {reports > 0 && <span className={`ml-auto flex flex-shrink-0 items-center gap-1 text-[12px] font-bold ${dark ? 'text-neutral-300' : 'text-neutral-500'}`}><Users className="h-3.5 w-3.5" />{reports}</span>}
      </div>
      {canEdit && !ghost && !placeholder && (
        <button data-nodrag onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onAdd(node._id); }} title="Add a position that reports here"
          className="absolute -bottom-0 left-1/2 hidden h-6 w-6 -translate-x-1/2 translate-y-1/2 items-center justify-center rounded-full bg-indigo-600 text-white shadow group-hover:flex"><Plus className="h-3.5 w-3.5" /></button>
      )}
    </div>
  );
});

const teamTone = (dept) => {
  const keys = Object.keys(ACCENT); let h = 0;
  for (const ch of String(dept)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return ACCENT[keys[(h % (keys.length - 1)) + 1]];   // skip slate so teams are always coloured
};

/* ── profile drawer ─────────────────────────────────────────────────────────── */
const Lbl = ({ t, children, className = '', hint }) => (
  <label className={`block ${className}`}><span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-neutral-500">{t}</span>{children}{hint && <span className="mt-1 block text-[11px] text-neutral-400">{hint}</span>}</label>
);
const Chip = ({ icon: I, children }) => <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-600"><I className="h-3 w-3" />{children}</span>;

function toForm(n) {
  const base = {
    status: 'open', title: '', department: '', personName: '', personEmail: '', avatar: '', bio: '', location: '', timezone: '',
    accent: 'slate', description: '', jobSlug: '', seats: 1, privatePhone: '', privateNotes: '',
  };
  return {
    ...base, ...n,
    employeeId: n.employeeId || '',
    startDate: n.startDate ? new Date(n.startDate).toISOString().slice(0, 10) : '',
    skills: (n.skills || []).join(', '),
    links: n.links || [],
  };
}

function Drawer({ node, nodes, byId, cmap, canEdit, ctx, onClose, onSelect, onSaved, onDeleted }) {
  const isNew = !!node._new;
  const [editing, setEditing] = useState(isNew);
  const [f, setF] = useState(() => toForm(node));
  const [parent, setParent] = useState(node.parentId || '');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setF(toForm(node)); setParent(node.parentId || ''); setEditing(!!node._new); }, [node._id, node._new]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const a = ACCENT[node.accent] || ACCENT.slate;
  const mgr = node.parentId ? byId.get(node.parentId) : null;
  const reports = cmap.get(node._id) || [];
  const blocked = useMemo(() => (isNew ? new Set() : new Set([node._id, ...descendantsOf(node._id, cmap)])), [node._id, cmap, isNew]);

  const pickEmployee = (id) => {
    const e = (ctx.employees || []).find((x) => x._id === id);
    setF((p) => ({ ...p, employeeId: id, ...(e ? { personName: e.name, personEmail: e.email, avatar: p.avatar || e.avatar || '', department: p.department || e.department || '' } : {}) }));
  };

  const save = async () => {
    if (f.title.trim().length < 2) return toast.error('Give the position a title');
    if (f.status === 'filled' && !f.personName.trim() && !f.employeeId) return toast.error('Add who holds this position, or mark it open');
    const body = { ...f, seats: Math.max(1, Math.min(99, Number(f.seats) || 1)), employeeId: f.employeeId || null, skills: f.skills, startDate: f.startDate || null };
    setBusy(true);
    try {
      await onSaved(node, body, parent || null);
      if (!isNew) setEditing(false);
    } catch (e) { toast.error(e?.response?.data?.error || e.message || 'Could not save'); } finally { setBusy(false); }
  };

  const Row = ({ icon: I, children }) => (children ? <div className="flex items-start gap-2 text-sm text-neutral-700"><I className="mt-0.5 h-4 w-4 flex-shrink-0 text-neutral-400" /><div className="min-w-0 break-words">{children}</div></div> : null);

  return (
    <motion.aside initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      className="fixed inset-y-0 right-0 z-[130] flex w-full max-w-md flex-col border-l border-neutral-200 bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-3">
        <div className="text-xs font-bold uppercase tracking-wider text-neutral-400">{isNew ? 'New position' : editing ? 'Edit profile' : 'Profile'}</div>
        <button onClick={onClose} className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100" aria-label="Close"><X className="h-5 w-5" /></button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        {!editing ? (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <Avatar node={node} size={64} />
              <div className="min-w-0">
                <h3 className="truncate text-xl font-black text-neutral-900">{node.status === 'open' ? 'Open position' : node.personName}</h3>
                <p className="truncate text-sm font-semibold text-neutral-600">{node.title}</p>
                <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${node.status === 'open' ? 'bg-amber-100 text-amber-800' : a.soft}`}>{node.status === 'open' ? 'Hiring' : 'Filled'}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {node.department && <Chip icon={Briefcase}>{node.department}</Chip>}
              {node.status === 'open' && (node.seats || 1) > 1 && <Chip icon={Users}>{node.seats} openings</Chip>}
              {node.status === 'filled' && node.startDate && <Chip icon={Calendar}>Since {new Date(node.startDate).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })} · {tenure(node.startDate)}</Chip>}
            </div>
            {node.status === 'filled' && (
              <div className="space-y-2">
                <Row icon={Mail}>{node.personEmail && <a className="text-indigo-600 hover:underline" href={`mailto:${node.personEmail}`}>{node.personEmail}</a>}</Row>
                <Row icon={MapPin}>{node.location}</Row>
                <Row icon={Clock}>{node.timezone}</Row>
              </div>
            )}
            {node.status === 'filled' && node.hasAccount && (
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm">
                <div className="mb-1 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-neutral-400"><span>Account</span>{node.accountRole && <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-neutral-600 ring-1 ring-neutral-200">{String(node.accountRole).replace(/_/g, ' ')}</span>}</div>
                {node.loginVisible
                  ? <div className="space-y-0.5 text-neutral-700"><div>Last sign-in: <b>{node.lastLogin ? `${when(node.lastLogin)} (${ago(node.lastLogin)})` : 'never'}</b></div>{node.previousLogin && <div className="text-xs text-neutral-500">Before that: {when(node.previousLogin)}</div>}<div className="text-xs text-neutral-500">{node.loginCount || 0} sign-in{node.loginCount === 1 ? '' : 's'} in total</div></div>
                  : <div className="text-xs text-neutral-400">Sign-in activity is visible to this person, their managers and super admins.</div>}
                {node.accountStatus && node.accountStatus !== 'active' && <div className="mt-1 text-xs font-semibold text-red-600">Account {node.accountStatus}</div>}
              </div>
            )}
            {node.status === 'filled' && !node.hasAccount && canEdit && <div className="rounded-xl border border-dashed border-neutral-300 p-3 text-xs text-neutral-500">No login account is linked to this person. Link one under Edit, or add them from the Team page.</div>}
            {node.status === 'filled' && node.bio && <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">{node.bio}</p>}
            {node.status === 'open' && (
              <div className="space-y-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                {node.description ? <p className="whitespace-pre-wrap">{node.description}</p> : <p>This position is vacant.</p>}
                {node.jobSlug && <a href={`/careers/${node.jobSlug}`} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 font-bold text-amber-900 underline">View public listing<ExternalLink className="h-3 w-3" /></a>}
                {typeof node.applicants === 'number' && node.jobSlug && <div className="text-xs font-semibold">{node.applicants} applicant{node.applicants === 1 ? '' : 's'} so far</div>}
              </div>
            )}
            {!!node.skills?.length && <div className="flex flex-wrap gap-1.5">{node.skills.map((s) => <span key={s} className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-600">{s}</span>)}</div>}
            {!!node.links?.length && <div className="space-y-1">{node.links.map((l, i) => <a key={i} href={l.url} target="_blank" rel="noreferrer noopener" className="flex items-center gap-1.5 text-sm text-indigo-600 hover:underline"><Globe className="h-3.5 w-3.5" />{l.label || l.url.replace(/^https?:\/\/(www\.)?/, '')}</a>)}</div>}

            <div>
              <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-neutral-400">Reports to</div>
              {mgr ? <button onClick={() => onSelect(mgr._id)} className="flex w-full items-center gap-2 rounded-xl border border-neutral-200 p-2 text-left hover:bg-neutral-50"><Avatar node={mgr} size={28} /><span className="min-w-0 truncate text-sm font-semibold">{mgr.status === 'open' ? 'Open position' : mgr.personName}<span className="font-normal text-neutral-400"> · {mgr.title}</span></span></button> : <div className="text-sm text-neutral-400">Nobody (top of chart)</div>}
            </div>
            {reports.length > 0 && (
              <div>
                <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-neutral-400">Direct reports ({reports.length})</div>
                <div className="space-y-1.5">{reports.map((r) => <button key={r._id} onClick={() => onSelect(r._id)} className="flex w-full items-center gap-2 rounded-xl border border-neutral-200 p-2 text-left hover:bg-neutral-50"><Avatar node={r} size={28} /><span className="min-w-0 truncate text-sm font-semibold">{r.status === 'open' ? 'Open position' : r.personName}<span className="font-normal text-neutral-400"> · {r.title}</span></span></button>)}</div>
              </div>
            )}
            {canEdit && (node.privatePhone || node.privateNotes) && (
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-sm">
                <div className="mb-1 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-neutral-400"><Lock className="h-3 w-3" />Super admins only</div>
                {node.privatePhone && <div className="text-neutral-700">Phone: {node.privatePhone}</div>}
                {node.privateNotes && <p className="mt-1 whitespace-pre-wrap text-neutral-700">{node.privateNotes}</p>}
              </div>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex gap-1 rounded-xl bg-neutral-100 p-1 sm:col-span-2">
              {['filled', 'open'].map((s) => <button key={s} type="button" onClick={() => set('status', s)} className={`flex-1 rounded-lg py-1.5 text-sm font-bold capitalize transition ${f.status === s ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'}`}>{s === 'open' ? 'Open (hiring)' : 'Filled'}</button>)}
            </div>
            {f.status === 'open' && !isNew && node.status === 'filled' && <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800 sm:col-span-2">Saving as open removes {node.personName}'s profile details from this position.</p>}
            <Lbl t="Position title *" className="sm:col-span-2"><input className={field} value={f.title} maxLength={120} onChange={(e) => set('title', e.target.value)} placeholder="Head of Engineering" /></Lbl>
            <Lbl t="Department"><input className={field} value={f.department} maxLength={80} onChange={(e) => set('department', e.target.value)} /></Lbl>
            <Lbl t="Reports to">
              <select className={field} value={parent} onChange={(e) => setParent(e.target.value)}>
                <option value="">Nobody (top level)</option>
                {nodes.filter((n) => !blocked.has(n._id) && n.level < MAX_LEVEL).map((n) => <option key={n._id} value={n._id}>{'— '.repeat(n.level)}{n.status === 'open' ? 'Open' : n.personName} · {n.title}</option>)}
              </select>
            </Lbl>
            {f.status === 'filled' && (<>
              {!!ctx.employees?.length && <Lbl t="Link to employee account" className="sm:col-span-2" hint="Optional. Autofills the fields below."><select className={field} value={f.employeeId} onChange={(e) => pickEmployee(e.target.value)}><option value="">Not linked</option>{ctx.employees.map((e) => <option key={e._id} value={e._id}>{e.name} · {e.email}</option>)}</select></Lbl>}
              <Lbl t="Name *"><input className={field} value={f.personName} maxLength={100} onChange={(e) => set('personName', e.target.value)} /></Lbl>
              <Lbl t="Email"><input className={field} type="email" value={f.personEmail} maxLength={160} onChange={(e) => set('personEmail', e.target.value)} /></Lbl>
              <Lbl t="Photo URL" className="sm:col-span-2" hint="https image link. Initials are used if empty."><input className={field} value={f.avatar} maxLength={400} onChange={(e) => set('avatar', e.target.value)} /></Lbl>
              <Lbl t="Location"><input className={field} value={f.location} maxLength={100} onChange={(e) => set('location', e.target.value)} /></Lbl>
              <Lbl t="Time zone"><input className={field} value={f.timezone} maxLength={60} onChange={(e) => set('timezone', e.target.value)} placeholder="America/New_York" /></Lbl>
              <Lbl t="Start date"><input className={field} type="date" value={f.startDate} onChange={(e) => set('startDate', e.target.value)} /></Lbl>
              <Lbl t="Skills" hint="Comma separated"><input className={field} value={f.skills} onChange={(e) => set('skills', e.target.value)} /></Lbl>
              <Lbl t="Bio" className="sm:col-span-2"><textarea rows={4} className={field} value={f.bio} maxLength={1200} onChange={(e) => set('bio', e.target.value)} /></Lbl>
              <div className="sm:col-span-2">
                <div className="mb-1 flex items-center justify-between"><span className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Links (max 5)</span>{f.links.length < 5 && <button type="button" onClick={() => set('links', [...f.links, { label: '', url: '' }])} className="flex items-center gap-1 text-xs font-bold text-neutral-700"><Plus className="h-3 w-3" />Add</button>}</div>
                <div className="space-y-2">{f.links.map((l, i) => (
                  <div key={i} className="flex gap-2">
                    <input className={`${field} w-28 flex-shrink-0`} placeholder="Label" value={l.label} onChange={(e) => set('links', f.links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                    <input className={field} placeholder="https://…" value={l.url} onChange={(e) => set('links', f.links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} />
                    <button type="button" onClick={() => set('links', f.links.filter((_, j) => j !== i))} className="rounded p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600"><X className="h-4 w-4" /></button>
                  </div>))}</div>
              </div>
            </>)}
            {f.status === 'open' && (<>
              <Lbl t="Openings" hint="How many people you are hiring for this role. Shows as a stacked card."><input className={field} type="number" min={1} max={99} value={f.seats} onChange={(e) => set('seats', e.target.value)} /></Lbl>
              <div />
              <Lbl t="What is this role for?" className="sm:col-span-2"><textarea rows={4} className={field} value={f.description} maxLength={1500} onChange={(e) => set('description', e.target.value)} /></Lbl>
              <Lbl t="Public job listing" className="sm:col-span-2" hint="Links this box to its /careers page and applicant count.">
                <select className={field} value={f.jobSlug} onChange={(e) => set('jobSlug', e.target.value)}><option value="">None</option>{(ctx.listings || []).map((l) => <option key={l.slug} value={l.slug}>{l.title} ({l.status})</option>)}</select>
              </Lbl>
            </>)}
            <Lbl t="Colour" className="sm:col-span-2">
              <div className="flex flex-wrap gap-2">{Object.entries(ACCENT).map(([k, v]) => <button key={k} type="button" onClick={() => set('accent', k)} aria-label={k} className={`h-7 w-7 rounded-full ${v.bar} ${f.accent === k ? 'ring-2 ring-neutral-900 ring-offset-2' : ''}`} />)}</div>
            </Lbl>
            {f.status === 'filled' && (<>
              <Lbl t="Private phone" hint="Super admins only"><input className={field} value={f.privatePhone} maxLength={30} onChange={(e) => set('privatePhone', e.target.value)} /></Lbl>
              <div />
              <Lbl t="Private notes" className="sm:col-span-2" hint="Super admins only. Never shown to other employees."><textarea rows={3} className={field} value={f.privateNotes} maxLength={1500} onChange={(e) => set('privateNotes', e.target.value)} /></Lbl>
            </>)}
          </div>
        )}
      </div>

      {canEdit && (
        <div className="flex items-center justify-between gap-2 border-t border-neutral-100 bg-neutral-50 px-5 py-3">
          {editing ? (<>
            <button onClick={() => (isNew ? onClose() : setEditing(false))} className="rounded-lg px-3 py-2 text-sm font-semibold text-neutral-600 hover:bg-neutral-100">Cancel</button>
            <button disabled={busy} onClick={save} className="flex items-center gap-2 rounded-lg bg-neutral-900 px-5 py-2 text-sm font-bold text-white hover:bg-neutral-700 disabled:opacity-60">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{isNew ? 'Create' : 'Save'}</button>
          </>) : (<>
            <button onClick={() => onDeleted(node)} className="rounded-lg p-2 text-neutral-400 hover:bg-red-50 hover:text-red-600" title="Delete position"><Trash2 className="h-4 w-4" /></button>
            <div className="flex gap-2">
              {node.status === 'open' && ctx.fillOpen && <button onClick={() => ctx.fillOpen(node)} className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-700"><UserPlus className="h-4 w-4" />Add person</button>}
              <button onClick={() => ctx.duplicate(node._id)} className="flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-white" title="Add another of this role"><Users className="h-4 w-4" />Duplicate</button>
              <button onClick={() => ctx.addUnder(node._id)} className="flex items-center gap-1.5 rounded-lg border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-700 hover:bg-white"><Plus className="h-4 w-4" />Add report</button>
              <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-bold text-white hover:bg-neutral-700"><Edit2 className="h-4 w-4" />Edit</button>
            </div>
          </>)}
        </div>
      )}
    </motion.aside>
  );
}

/* ── main component ─────────────────────────────────────────────────────────── */
export default function OrgChart({ isDemo = false }) {
  const [nodes, setNodes] = useState([]);
  const [canEdit, setCanEdit] = useState(false);
  const [ctx, setCtx] = useState({ me: null, root: false, employees: [], listings: [] });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [draft, setDraft] = useState(null);           // new-position draft
  const [hoverId, setHoverId] = useState(null);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [scale, setScale] = useState(1);
  const [drag, setDrag] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const [busy, setBusy] = useState(false);
  const [wizard, setWizard] = useState(null);          // add-person wizard prefill (fill an open position)
  const [full, setFull] = useState(false);
  const [, force] = useReducer((x) => x + 1, 0);

  const scrollRef = useRef(null);
  const innerRef = useRef(null);
  const animRef = useRef(new Map());
  const nodesRef = useRef([]);
  const scaleRef = useRef(1);
  const revRef = useRef('');
  const sessionRef = useRef(null);
  const dragStateRef = useRef(null);
  const fittedRef = useRef(false);
  const tidiedRef = useRef(false);
  const canEditRef = useRef(false);
  nodesRef.current = nodes; scaleRef.current = scale; canEditRef.current = canEdit;

  /* data */
  const load = useCallback(async (silent) => {
    if (isDemo) { setNodes((p) => (p.length ? p : DEMO_NODES)); setCanEdit(true); setLoading(false); return; }
    try {
      const r = await api.get('/careers/admin/org');
      if (r.data.demo) { setNodes(DEMO_NODES); setCanEdit(true); setLoading(false); return; }
      if (silent && (r.data.rev === revRef.current || sessionRef.current)) { setUpdatedAt(Date.now()); return; }
      revRef.current = r.data.rev;
      setNodes(r.data.nodes); setCanEdit(!!r.data.canEdit);
      setCtx({ me: r.data.me || null, root: !!r.data.root, employees: r.data.employees || [], listings: r.data.listings || [] });
      setErr(''); setUpdatedAt(Date.now());
    } catch (e) { if (!silent) setErr(e?.response?.data?.error || e.message || 'Could not load the org chart'); } finally { setLoading(false); }
  }, [isDemo]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (isDemo) return undefined;
    const t = setInterval(() => { if (!document.hidden && !busy) load(true); }, 12000);
    return () => clearInterval(t);
  }, [isDemo, load, busy]);

  /* provisional nodes while dragging (cards slide aside live) */
  const viewNodes = drag?.lastOk || nodes;
  const layout = useMemo(() => computeLayout(viewNodes), [viewNodes]);
  const layoutRef = useRef(layout); layoutRef.current = layout;
  const byId = useMemo(() => new Map(viewNodes.map((n) => [n._id, n])), [viewNodes]);
  const baseById = useMemo(() => new Map(nodes.map((n) => [n._id, n])), [nodes]);
  const cmap = useMemo(() => childrenMap(nodes), [nodes]);
  const viewCmap = useMemo(() => childrenMap(viewNodes), [viewNodes]);

  /* animation: cards and connector lines read the same animated positions */
  useEffect(() => {
    let raf; let last = performance.now();
    const step = (t) => {
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      const k = 1 - Math.exp(-dt * 16);
      let moving = false;
      const A = animRef.current;
      for (const [id, tp] of layout.pos) {
        let c = A.get(id);
        if (!c) {
          const par = byId.get(id)?.parentId; const pp = par && A.get(par);
          c = { x: pp ? pp.x : tp.x, y: pp ? pp.y : tp.y }; A.set(id, c); moving = true;
        }
        const dx = tp.x - c.x; const dy = tp.y - c.y;
        if (Math.abs(dx) > 0.4 || Math.abs(dy) > 0.4) { c.x += dx * k; c.y += dy * k; moving = true; } else if (dx || dy) { c.x = tp.x; c.y = tp.y; moving = true; }
      }
      for (const id of [...A.keys()]) if (!layout.pos.has(id)) A.delete(id);
      force();
      if (moving) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [layout, byId]);

  /* fit the whole chart into the visible area */
  const fit = useCallback(() => {
    const el = scrollRef.current; if (!el) return;
    const l = layoutRef.current;
    const sc = Math.min((el.clientWidth - 16) / l.width, (el.clientHeight - 16) / l.height, 1);
    setScale(Math.max(0.3, +sc.toFixed(2)));
    el.scrollLeft = 0; el.scrollTop = 0;
  }, []);
  useEffect(() => {
    if (fittedRef.current || !nodes.length || !scrollRef.current) return;
    fittedRef.current = true; fit();
  }, [nodes.length, layout.width, fit]);
  useEffect(() => { const t = setTimeout(fit, 60); return () => clearTimeout(t); }, [full, fit]);

  /* full screen: lock page scroll, Esc leaves (unless a drag or the drawer is using it) */
  useEffect(() => {
    if (!full) return undefined;
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const k = (e) => { if (e.key === 'Escape' && !sessionRef.current) setFull(false); };
    window.addEventListener('keydown', k);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', k); };
  }, [full]);

  /* the person looking at the chart is always on it, and nobody floats without a manager */
  const tidy = useCallback(async (silent) => {
    if (isDemo) return;
    setBusy(true);
    try {
      const r = await api.post('/careers/admin/org/tidy');
      revRef.current = r.data.rev; setNodes(r.data.nodes);
      if (!silent || r.data.created || r.data.adopted) toast.success(r.data.created || r.data.adopted ? 'Added you at the top and connected loose positions' : 'Already tidy');
      setTimeout(fit, 80);
    } catch (e) { if (!silent) toast.error(e?.response?.data?.error || 'Could not tidy the chart'); } finally { setBusy(false); }
  }, [isDemo, fit]);
  useEffect(() => {
    if (tidiedRef.current || isDemo || !canEdit || !nodes.length) return;
    if (nodes.some((n) => !n.parentId && n.level > 0)) { tidiedRef.current = true; tidy(true); }
  }, [canEdit, nodes, isDemo, tidy]);

  /* ── persistence ─────────────────────────────────────────────────────────── */
  const commitPlan = useCallback(async (plan) => {
    const prev = nodesRef.current;
    setNodes(plan.nodes);
    if (isDemo) { toast.success('Moved (sandbox)'); return; }
    setBusy(true);
    try {
      const r = await api.post('/careers/admin/org/layout', { moves: plan.moves });
      revRef.current = r.data.rev; setNodes(r.data.nodes); toast.success('Org chart updated');
    } catch (e) { setNodes(prev); toast.error(e?.response?.data?.error || 'Could not save that move, it was undone'); } finally { setBusy(false); }
  }, [isDemo]);

  /* ── drag & drop ─────────────────────────────────────────────────────────── */
  const resolve = useCallback((px, py, s) => {
    const base = nodesRef.current; const A = animRef.current;
    const me = base.find((n) => n._id === s.id); if (!me) return null;
    const cm = childrenMap(base); const desc = descendantsOf(s.id, cm);
    const prov = dragStateRef.current?.lastOk || base;
    const provMe = prov.find((n) => n._id === s.id) || me;
    const inRect = (id, pad = 0) => { const p = A.get(id); return p && px >= p.x - pad && px <= p.x + CARD_W + pad && py >= p.y - pad && py <= p.y + CARD_H + pad; };
    let hit = null;
    if (s.lock && inRect(s.lock, 22) && !desc.has(s.lock) && s.lock !== s.id) hit = s.lock;
    if (!hit) for (const n of prov) if (n._id !== s.id && !desc.has(n._id) && inRect(n._id)) { hit = n._id; break; }
    s.lock = hit;
    const cxOf = (id) => (A.get(id)?.x ?? 0) + CARD_W / 2;
    if (!hit) return { plan: { ok: false, quiet: true, reason: 'Drop onto a person to make them report to that person', nodes: base, moves: [] }, targetId: null, level: provMe.level };
    const cyOf = (id) => (A.get(id)?.y ?? 0) + CARD_H / 2;
    const sibsOf = (parentId, level) => prov.filter((n) => n._id !== s.id && (parentId ? n.parentId === parentId : (!n.parentId && n.level === level))).sort((a, b) => a.order - b.order);
    let opts; let targetId = null;
    const X = prov.find((n) => n._id === hit);
    if (X.level === provMe.level) {
      const sibs = sibsOf(X.parentId || null, X.level);
      const at = sibs.findIndex((n) => n._id === X._id);
      const after = (px - cxOf(X._id)) + (py - cyOf(X._id)) > 0;
      opts = { parentId: X.parentId || null, level: X.level, index: Math.max(0, at) + (after ? 1 : 0) };
    } else { targetId = X._id; opts = { parentId: X._id, level: X.level + 1 }; }
    const plan = planMove(base, s.id, { ...opts, shiftOnly: s.shift });
    return { plan, targetId, level: opts.level };
  }, []);

  const endDrag = useCallback((commit) => {
    const s = sessionRef.current; if (!s) return;
    cancelAnimationFrame(s.raf);
    window.removeEventListener('pointermove', s.onMove); window.removeEventListener('pointerup', s.onUp);
    window.removeEventListener('pointercancel', s.onCancel); window.removeEventListener('keydown', s.onKey);
    const ds = dragStateRef.current;
    sessionRef.current = null; dragStateRef.current = null;
    if (!s.started) { if (commit) setSelectedId(s.id); return; }
    if (ds) animRef.current.set(s.id, { x: ds.gx, y: ds.gy });   // glide from where it was dropped
    setDrag(null);
    if (commit && ds?.plan?.ok && ds.plan.moves.length) commitPlan(ds.plan);
    else if (commit && ds && !ds.plan?.ok && !ds.plan?.quiet) toast.error(ds.plan?.reason || 'That move is not allowed');
  }, [commitPlan]);

  const onDown = useCallback((e, node) => {
    if (!canEditRef.current || e.button > 0 || sessionRef.current) return;
    if (e.pointerType === 'touch' && !e.target.closest('[data-grip]')) return;
    if (e.target.closest('[data-nodrag]')) return;
    const inner = innerRef.current.getBoundingClientRect(); const sc = scaleRef.current;
    const p = animRef.current.get(node._id); if (!p) return;
    const s = {
      id: node._id, sx: e.clientX, sy: e.clientY, cx: e.clientX, cy: e.clientY, started: false, shift: e.shiftKey, lock: null,
      offX: (e.clientX - inner.left) / sc - p.x, offY: (e.clientY - inner.top) / sc - p.y,
    };
    s.onMove = (ev) => { s.cx = ev.clientX; s.cy = ev.clientY; s.shift = ev.shiftKey; };
    s.onUp = () => endDrag(true);
    s.onCancel = () => endDrag(false);
    s.onKey = (ev) => { if (ev.key === 'Escape') endDrag(false); if (ev.key === 'Shift') s.shift = ev.type === 'keydown'; };
    const tick = () => {
      if (sessionRef.current !== s) return;
      if (!s.started) {
        if (Math.hypot(s.cx - s.sx, s.cy - s.sy) > 5) { s.started = true; s.targets = validTargets(nodesRef.current, s.id); } else { s.raf = requestAnimationFrame(tick); return; }
      }
      const sc2 = scaleRef.current; const sv = scrollRef.current; const sr = sv.getBoundingClientRect();
      const edge = 56; // auto-scroll near the edges
      if (s.cx > sr.right - edge) sv.scrollLeft += 18; else if (s.cx < sr.left + edge) sv.scrollLeft -= 18;
      if (s.cy > sr.bottom - edge) sv.scrollTop += 14; else if (s.cy < sr.top + edge) sv.scrollTop -= 14;
      const ir = innerRef.current.getBoundingClientRect();
      const px = (s.cx - ir.left) / sc2; const py = (s.cy - ir.top) / sc2;
      const r = resolve(px, py, s);
      if (r) {
        const prevOk = dragStateRef.current?.lastOk;
        const next = { id: s.id, gx: px - s.offX, gy: py - s.offY, plan: r.plan, targetId: r.targetId, level: r.level, lastOk: r.plan.ok ? r.plan.nodes : prevOk, targets: s.targets, shift: s.shift };
        dragStateRef.current = next; setDrag(next);
      }
      s.raf = requestAnimationFrame(tick);
    };
    sessionRef.current = s;
    window.addEventListener('pointermove', s.onMove); window.addEventListener('pointerup', s.onUp);
    window.addEventListener('pointercancel', s.onCancel); window.addEventListener('keydown', s.onKey); window.addEventListener('keyup', s.onKey);
    s.raf = requestAnimationFrame(tick);
  }, [endDrag, resolve]);
  useEffect(() => () => { if (sessionRef.current) endDrag(false); }, [endDrag]);

  /* background pan */
  const onPanDown = (e) => {
    if (e.button > 0 || e.target.closest('[data-card]') || e.pointerType === 'touch') return;
    const sv = scrollRef.current; const sx = e.clientX; const sy = e.clientY; const l = sv.scrollLeft; const t = sv.scrollTop;
    const mv = (ev) => { sv.scrollLeft = l - (ev.clientX - sx); sv.scrollTop = t - (ev.clientY - sy); };
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  };

  /* ── actions ─────────────────────────────────────────────────────────────── */
  const open = useCallback((id) => { if (!sessionRef.current) { setDraft(null); setSelectedId(id); } }, []);
  const addUnder = useCallback((parentId) => {
    const par = nodesRef.current.find((n) => n._id === parentId);
    if (par && par.level >= MAX_LEVEL) return toast.error('That is already the lowest level');
    setSelectedId(null);
    setDraft({ _new: true, _id: `new-${Date.now()}`, status: 'open', title: '', parentId: parentId || null, level: par ? par.level + 1 : 0, accent: par?.accent || 'slate', department: par?.department || '' });
  }, []);

  const duplicate = useCallback((id) => {
    const n = nodesRef.current.find((x) => x._id === id); if (!n) return;
    setSelectedId(null);
    setDraft({ _new: true, _id: `new-${Date.now()}`, status: 'open', title: n.title, department: n.department || '', parentId: n.parentId || null, level: n.level, accent: n.accent || 'slate', description: n.description || '', jobSlug: n.jobSlug || '', seats: n.seats || 1 });
  }, []);

  const saveNode = async (node, body, parentId) => {
    if (node._new) {
      if (isDemo) {
        const id = `demo-${Date.now()}`; const par = nodes.find((n) => n._id === parentId);
        setNodes((p) => [...p, { ...body, _id: id, parentId: parentId || null, level: par ? par.level + 1 : 0, order: 99, skills: String(body.skills || '').split(',').map((s) => s.trim()).filter(Boolean) }]);
        toast.success('Created (sandbox)'); setDraft(null); return;
      }
      const r = await api.post('/careers/admin/org', { ...body, parentId });
      toast.success('Position created'); setDraft(null); await load(); setSelectedId(r.data.node._id); return;
    }
    if (isDemo) {
      setNodes((p) => p.map((n) => (n._id === node._id ? { ...n, ...body, skills: String(body.skills || '').split(',').map((s) => s.trim()).filter(Boolean), ...(body.status === 'open' ? { personName: '', personEmail: '' } : {}) } : n)));
    } else {
      await api.put(`/careers/admin/org/${node._id}`, body);
    }
    if ((parentId || null) !== (node.parentId || null)) {
      const par = nodes.find((n) => n._id === parentId);
      const plan = planMove(nodes, node._id, { parentId: parentId || null, level: par ? par.level + 1 : node.level, index: 99 });
      if (!plan.ok) { toast.error(plan.reason || 'That reporting line is not allowed'); await load(); return; }
      await commitPlan(plan);
    } else if (!isDemo) { await load(); }
    toast.success(isDemo ? 'Saved (sandbox)' : 'Profile saved');
  };

  const remove = async (node) => {
    if (!window.confirm(`Delete "${node.title}"${node.status === 'filled' ? ` (${node.personName})` : ''}? Their direct reports move up to the manager above.`)) return;
    if (isDemo) {
      setNodes((p) => p.filter((n) => n._id !== node._id).map((n) => (n.parentId === node._id ? { ...n, parentId: node.parentId } : n)));
      setSelectedId(null); toast.success('Deleted (sandbox)'); return;
    }
    try { const r = await api.delete(`/careers/admin/org/${node._id}`); setNodes(r.data.nodes); revRef.current = r.data.rev; setSelectedId(null); toast.success('Position deleted'); } catch (e) { toast.error(e?.response?.data?.error || 'Delete failed'); }
  };

  const importAll = async () => {
    if (isDemo) return toast.success('Import disabled in sandbox');
    setBusy(true);
    try { const r = await api.post('/careers/admin/org/import'); setNodes(r.data.nodes); revRef.current = r.data.rev; toast.success(r.data.added ? `Added ${r.data.added} from employees and open listings` : 'Everything is already on the chart'); } catch (e) { toast.error(e?.response?.data?.error || 'Import failed'); } finally { setBusy(false); }
  };

  /* ── derived render data ─────────────────────────────────────────────────── */
  const needle = q.trim().toLowerCase();
  const matches = useMemo(() => {
    const m = new Set();
    for (const n of viewNodes) {
      const hay = `${n.personName} ${n.title} ${n.department} ${(n.skills || []).join(' ')} ${n.status === 'open' ? 'open vacant hiring' : ''}`.toLowerCase();
      if ((!needle || hay.includes(needle)) && (filter === 'all' || n.status === filter)) m.add(n._id);
    }
    return m;
  }, [viewNodes, needle, filter]);
  const filtering = !!needle || filter !== 'all';
  const counts = useMemo(() => ({ filled: nodes.filter((n) => n.status === 'filled').length, open: nodes.filter((n) => n.status === 'open').length }), [nodes]);

  const focusId = drag ? drag.id : (hoverId || selectedId);
  const chainSet = useMemo(() => {
    const out = new Set();
    if (!focusId) return out;
    for (const id of [focusId, ...ancestorsOf(focusId, byId)]) { out.add(id); const g = layout.groupOf.get(id); if (g) out.add(g); }
    return out;
  }, [focusId, byId, layout.groupOf]);

  const A = animRef.current;
  const at = (id) => (drag && id === drag.id ? { x: drag.gx, y: drag.gy } : A.get(id) || layout.pos.get(id));
  const edges = [];
  for (const l of layout.links) {
    const isHead = layout.heads.has(l.from);
    const p = at(l.from); const c = at(l.to); if (!p || !c) continue;
    const toHead = layout.heads.has(l.to);
    const pw = isHead ? HEAD_W : CARD_W; const ph = isHead ? HEAD_H : CARD_H;
    const involvesDrag = !!drag && (l.to === drag.id || l.parent === drag.id);
    const hot = !involvesDrag && !!focusId && ((chainSet.has(l.to) && chainSet.has(l.from)) || l.parent === focusId);
    const live = !toHead ? byId.get(l.to) : null;
    const dimmed = filtering && live && !(matches.has(l.to) || matches.has(l.parent));
    edges.push({ id: l.id, d: toHead ? linkPath(p, pw, ph, { x: c.x + (HEAD_W - CARD_W) / 2, y: c.y }, 'bus') : linkPath(p, pw, ph, c, l.mode), involvesDrag, hot, dim: !!dimmed });
  }
  const ghostNode = drag ? byId.get(drag.id) || baseById.get(drag.id) : null;
  const targetNode = drag?.targetId ? byId.get(drag.targetId) : null;
  const hint = !drag ? '' : !drag.plan.ok ? (drag.plan.quiet ? drag.plan.reason : `Not allowed: ${drag.plan.reason}`) : targetNode
    ? `Release to make ${ghostNode?.status === 'open' ? 'this position' : ghostNode?.personName} report to ${targetNode.status === 'open' ? targetNode.title : targetNode.personName}`
    : `Release to reorder${drag.shift ? ' (moving only this person)' : ''}`;

  // tinted band behind each team, from the live positions of its chip and everyone under it
  const bands = [];
  for (const h of layout.heads.values()) {
    const hp = at(h.key); if (!hp) continue;
    let x1 = hp.x; let x2 = hp.x + HEAD_W; let y2 = hp.y + HEAD_H; let count = 0; let open = 0;
    const all = new Set();
    for (const id of h.ids) { all.add(id); for (const d of descendantsOf(id, viewCmap)) all.add(d); }
    for (const id of all) {
      const p = at(id); if (!p) continue;
      x1 = Math.min(x1, p.x); x2 = Math.max(x2, p.x + CARD_W); y2 = Math.max(y2, p.y + CARD_H); count += 1;
      if (byId.get(id)?.status === 'open') open += 1;
    }
    bands.push({ key: h.key, dept: h.dept, x: x1 - 18, y: hp.y - 14, w: x2 - x1 + 36, h: y2 - hp.y + 32, hx: hp.x, hy: hp.y, count, open, tone: teamTone(h.dept) });
  }

  const selected = draft || (selectedId ? nodes.find((n) => n._id === selectedId) : null);
  const rootIds = useMemo(() => new Set(viewNodes.filter((n) => !n.parentId || !byId.has(n.parentId)).filter((n) => n.level === 0).map((n) => n._id)), [viewNodes, byId]);

  if (loading) return <div className="flex items-center justify-center py-24 text-neutral-400"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading org chart…</div>;
  if (err) return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{err} <button onClick={() => { setLoading(true); load(); }} className="ml-2 font-bold underline">Retry</button></div>;

  const tbtn = 'rounded-lg border border-neutral-200 bg-white p-2 text-neutral-600 hover:bg-neutral-50';
  return (
    <div className={full ? 'fixed inset-0 z-[120] flex flex-col gap-2 bg-white p-3 sm:p-4' : 'space-y-3'}>
      <style>{`
        @keyframes orgflow { to { stroke-dashoffset: -28; } }
        @keyframes orgpulse { 0%,100% { r: 4; opacity: .9; } 50% { r: 8; opacity: .25; } }
        .org-flow { stroke-dasharray: 8 6; animation: orgflow .6s linear infinite; }
        .org-port { animation: orgpulse 1.1s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .org-flow, .org-port { animation: none; } }
      `}</style>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search people, roles, skills…" className={`${field} pl-9`} />
        </div>
        <div className="flex rounded-lg bg-neutral-100 p-0.5 text-xs font-bold">
          {[['all', `All ${nodes.length}`], ['filled', `Filled ${counts.filled}`], ['open', `Open ${counts.open}`]].map(([k, l]) => <button key={k} onClick={() => setFilter(k)} className={`rounded-md px-3 py-1.5 ${filter === k ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'}`}>{l}</button>)}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="hidden items-center gap-1.5 text-[11px] font-semibold text-neutral-400 md:flex"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />{isDemo ? 'Sandbox' : `Live${updatedAt ? ' · synced' : ''}`}</span>
          <button onClick={() => setScale((x) => Math.max(0.3, +(x - 0.1).toFixed(2)))} className={tbtn} title="Zoom out"><ZoomOut className="h-4 w-4" /></button>
          <span className="w-10 text-center text-xs font-bold text-neutral-500">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale((x) => Math.min(1.5, +(x + 0.1).toFixed(2)))} className={tbtn} title="Zoom in"><ZoomIn className="h-4 w-4" /></button>
          <button onClick={fit} className={tbtn} title="Fit everything on screen"><Maximize2 className="h-4 w-4" /></button>
          <button onClick={() => load()} className={tbtn} title="Refresh"><RefreshCw className="h-4 w-4" /></button>
          {canEdit && !isDemo && <button onClick={() => tidy(false)} disabled={busy} className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-50" title="Put me at the top and connect any loose positions"><Sparkles className="h-4 w-4" />Tidy</button>}
          {canEdit && <button onClick={importAll} disabled={busy} className="flex items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs font-bold text-neutral-700 hover:bg-neutral-50" title="Add employees and open listings that are not on the chart yet"><Download className="h-4 w-4" />Import</button>}
          {canEdit && <button onClick={() => addUnder(null)} className="flex items-center gap-1.5 rounded-lg bg-neutral-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-neutral-700"><Plus className="h-4 w-4" />Position</button>}
          <button onClick={() => setFull((f) => !f)} className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-700" title={full ? 'Exit full screen (Esc)' : 'Full screen'}>{full ? <><Minimize2 className="h-4 w-4" />Exit</> : <><Maximize2 className="h-4 w-4" />Full screen</>}</button>
        </div>
      </div>

      <p className="text-xs text-neutral-500">
        {canEdit
          ? <><b>Drag</b> a card onto someone to make them report to that person, or onto a teammate to reorder. Hold <kbd className="rounded border border-neutral-300 bg-white px-1">Shift</kbd> to move only that person (their team stays). <kbd className="rounded border border-neutral-300 bg-white px-1">Esc</kbd> cancels. Click a card to open the profile.</>
          : <>Click anyone to see their profile. Only super admins can edit the chart.</>}
      </p>

      <div className={`relative overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50 ${full ? 'min-h-0 flex-1' : ''}`}
        style={full ? undefined : { height: 'max(560px, calc(100vh - 250px))' }}>
        <div ref={scrollRef} onPointerDown={onPanDown} className="h-full w-full overflow-auto" style={{ cursor: drag ? 'grabbing' : undefined, backgroundImage: 'radial-gradient(#d4d4d8 1px, transparent 1px)', backgroundSize: '22px 22px' }}>
          <div style={{ width: layout.width * scale, height: layout.height * scale, margin: '0 auto' }}>
            <div ref={innerRef} style={{ width: layout.width, height: layout.height, transform: `scale(${scale})`, transformOrigin: '0 0', position: 'relative' }}>
              {/* team bands */}
              {bands.map((b) => (
                <div key={b.key} style={{ position: 'absolute', left: b.x, top: b.y, width: b.w, height: b.h, zIndex: 1 }} className={`rounded-3xl border border-dashed ${b.tone.border} ${b.tone.wash}`} />
              ))}

              {/* connector lines (same animated positions as the cards) */}
              <svg width={layout.width} height={layout.height} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible', zIndex: 5 }}>
                {edges.filter((e) => !e.involvesDrag && !e.hot).map((e) => <path key={e.id} d={e.d} fill="none" stroke="#a1a1aa" strokeWidth="2.25" strokeLinejoin="round" opacity={e.dim ? 0.2 : 1} />)}
                {edges.filter((e) => e.hot).map((e) => <path key={e.id} d={e.d} fill="none" stroke="#6366f1" strokeWidth="3.25" className="org-flow" strokeLinecap="round" strokeLinejoin="round" />)}
                {edges.filter((e) => e.involvesDrag).map((e) => <path key={e.id} d={e.d} fill="none" stroke={drag?.plan.ok ? '#10b981' : '#ef4444'} strokeWidth="3.5" className="org-flow" strokeLinecap="round" strokeLinejoin="round" />)}
                {drag && [...(drag.targets || [])].map((id) => { const p = A.get(id); if (!p) return null; const on = id === drag.targetId; return <circle key={id} cx={p.x + CARD_W / 2} cy={p.y + CARD_H} r={on ? 8 : 4.5} fill={on ? '#10b981' : '#6366f1'} className={on ? '' : 'org-port'} />; })}
              </svg>

              {/* team chips */}
              {bands.map((b) => (
                <div key={`chip-${b.key}`} style={{ position: 'absolute', left: b.hx, top: b.hy, width: HEAD_W, height: HEAD_H, zIndex: 8 }}
                  className={`flex items-center gap-2 rounded-full border-2 bg-white px-4 shadow-sm ${b.tone.border}`}>
                  <span className={`h-3 w-3 flex-shrink-0 rounded-full ${b.tone.bar}`} />
                  <span className="min-w-0 flex-1 truncate text-[14px] font-black text-neutral-900">{b.dept}</span>
                  <span className="flex-shrink-0 text-[11px] font-bold text-neutral-500">{b.count}{b.open ? ` · ${b.open} open` : ''}</span>
                </div>
              ))}

              {/* cards */}
              {viewNodes.map((n) => {
                const p = A.get(n._id) || layout.pos.get(n._id);
                if (!p) return null;
                return (
                  <Card key={n._id} node={n} x={p.x} y={p.y} reports={(viewCmap.get(n._id) || []).length}
                    canEdit={canEdit}
                    flags={{ selected: selectedId === n._id, dim: filtering && !matches.has(n._id), match: !!needle && matches.has(n._id), isMe: (!!ctx.me && n.employeeId === ctx.me) || (ctx.root && !!n.owner), lead: rootIds.has(n._id) && n.status === 'filled', placeholder: drag?.id === n._id, hot: drag?.targetId === n._id, ghost: false }}
                    onDown={onDown} onOpen={open} onHover={setHoverId} onAdd={addUnder} />
                );
              })}
              {drag && ghostNode && <Card node={ghostNode} x={drag.gx} y={drag.gy} reports={0} canEdit={false} flags={{ ghost: true, invalid: !drag.plan.ok }} onDown={noop} onOpen={noop} onHover={noop} onAdd={noop} />}

              {!nodes.length && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 text-center">
                  <Users className="h-8 w-8 text-neutral-300" />
                  <p className="max-w-sm text-sm text-neutral-500">{canEdit ? 'No org chart yet. Import your employees and open listings to start, then drag people into place.' : 'The org chart has not been set up yet.'}</p>
                  {canEdit && <div className="flex gap-2"><button onClick={importAll} className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-bold text-white">Import team & open roles</button><button onClick={() => addUnder(null)} className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-bold text-neutral-700">Add manually</button></div>}
                </div>
              )}
            </div>
          </div>
        </div>
        <AnimatePresence>
          {drag && <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`pointer-events-none absolute left-1/2 top-3 z-[60] max-w-[90%] -translate-x-1/2 rounded-full px-4 py-1.5 text-xs font-bold text-white shadow-lg ${drag.plan.ok ? 'bg-emerald-600' : drag.plan.quiet ? 'bg-neutral-700' : 'bg-red-600'}`}>{hint}</motion.div>}
        </AnimatePresence>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-[11px] text-neutral-500">
        <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded border border-neutral-900 bg-neutral-900" />Super admin</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded border border-neutral-300 bg-white" />Filled</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-5 rounded border border-dashed border-neutral-400 bg-white" />Open position</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-6 rounded-full border-2 border-indigo-300 bg-white" />Team</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 bg-neutral-400" />Reports to</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 bg-indigo-500" />Highlighted chain of command</span>
      </div>

      <AnimatePresence>
        {selected && (
          <Drawer key={selected._id} node={selected} nodes={nodes} byId={baseById} cmap={cmap} canEdit={canEdit} ctx={{ ...ctx, addUnder, duplicate, fillOpen: (n) => setWizard({ orgNodeId: n._id, positionTitle: n.title, department: n.department || '', label: `Filling the open position: ${n.title}` }) }}
            onClose={() => { setSelectedId(null); setDraft(null); }} onSelect={(id) => { setDraft(null); setSelectedId(id); }} onSaved={saveNode} onDeleted={remove} />
        )}
      </AnimatePresence>
      {wizard && <AddPersonWizard prefill={wizard} onClose={() => setWizard(null)} onCreated={() => { revRef.current = ''; load(); }} />}
    </div>
  );
}

const noop = () => {};
