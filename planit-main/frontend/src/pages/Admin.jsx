import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, Users, Activity, TrendingUp, Database, HardDrive,
  Trash2, Eye, LogOut, Lock, ArrowLeft, Search, Download,
  MessageSquare, BarChart3, UserX, ChevronRight, Shield,
  RefreshCw, ShieldOff, Edit2, Save, X, FileText, Image,
  Clock, Mail, MapPin, User, Settings, AlertTriangle, CheckCircle,
  Server, Zap, DollarSign, Cpu, Info, Upload, FileUp, Trash,
  ExternalLink, Radio, AlertCircle, Plus, ChevronDown, ChevronUp,
  XCircle, Wifi, Terminal, Monitor, Globe, Network, Layers,
  Briefcase, UserCheck, UserPlus, Power, RotateCcw, Archive,
  Hash, BarChart2, PieChart, Inbox, Bell, Package,
  ChevronLeft, Filter, MoreVertical, Send, Eye as EyeIcon,
  Scroll, Gauge, HardDriveDownload, Fingerprint, Building2,
  WifiOff, AlertOctagon, TrendingDown, GitBranch, Boxes,
  Rocket, Timer, Wifi as WifiOn, Cpu as CpuIcon,
  Command, Key, Play, Crosshair,
} from 'lucide-react';
import api, { adminAPI, uptimeAPI, watchdogAPI, routerAPI, bugReportAPI } from '../services/api';
import { SERVICE_CATEGORIES, ALL_SERVICES_FLAT } from '../utils/serviceCategories';
import { formatNumber, formatFileSize } from '../utils/formatters';
import { DateTime } from 'luxon';
import toast from 'react-hot-toast';
import socketService from '../services/socket';

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmt = (date) => {
  if (!date) return '—';
  const dt = DateTime.fromISO(date, { zone: 'UTC' }).toLocal();
  const now = DateTime.local();
  if (dt.hasSame(now, 'day')) return `Today ${dt.toFormat('HH:mm')}`;
  if (dt.hasSame(now.minus({ days: 1 }), 'day')) return `Yesterday ${dt.toFormat('HH:mm')}`;
  return dt.toFormat('MMM dd, yyyy HH:mm');
};
const rel = (date) => date ? DateTime.fromISO(date, { zone: 'UTC' }).toRelative() || '' : '';
const utcToLocal = (d) => d ? DateTime.fromISO(d, { zone: 'UTC' }).toLocal().toFormat("yyyy-MM-dd'T'HH:mm") : '';
const localToUtc = (s) => s ? DateTime.fromISO(s).toUTC().toISO() : '';
const fmtUptime = (s) => {
  if (!s) return '0s';
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return [d && `${d}d`, h && `${h}h`, m && `${m}m`, (!d && !h) && `${s % 60}s`].filter(Boolean).join(' ');
};

// ─── Status Badge ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const map = {
    active:    'bg-emerald-100 text-emerald-800',
    completed: 'bg-blue-100 text-blue-800',
    cancelled: 'bg-red-100 text-red-800',
    draft:     'bg-neutral-100 text-neutral-600',
    up:        'bg-emerald-100 text-emerald-800',
    down:      'bg-red-100 text-red-800',
    connected: 'bg-emerald-100 text-emerald-800',
    disconnected: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${map[status] || 'bg-neutral-100 text-neutral-600'}`}>
      {status}
    </span>
  );
};

// ─── Role Badge ───────────────────────────────────────────────────────────────
const RoleBadge = ({ role }) => {
  const map = {
    super_admin: 'bg-purple-100 text-purple-800',
    admin:       'bg-blue-100 text-blue-800',
    moderator:   'bg-amber-100 text-amber-800',
    support:     'bg-teal-100 text-teal-800',
    analyst:     'bg-indigo-100 text-indigo-800',
    developer:   'bg-cyan-100 text-cyan-800',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${map[role] || 'bg-neutral-100 text-neutral-600'}`}>
      {role?.replace('_', ' ')}
    </span>
  );
};

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, sub, icon: Icon, color = 'blue', trend }) => (
  <div className="card p-5 hover:shadow-lg transition-all group">
    <div className="flex items-start justify-between mb-3">
      <p className="text-xs font-semibold text-neutral-500 uppercase tracking-widest">{label}</p>
      <div className={`w-9 h-9 rounded-xl bg-${color}-50 flex items-center justify-center group-hover:scale-110 transition-transform`}>
        <Icon className={`w-4 h-4 text-${color}-600`} />
      </div>
    </div>
    <p className="text-3xl font-bold text-neutral-900 tracking-tight">
      {typeof value === 'number' ? formatNumber(value) : (value ?? '—')}
    </p>
    {sub && <p className="text-xs text-neutral-400 mt-1">{sub}</p>}
  </div>
);

// ─── Memory Bar ───────────────────────────────────────────────────────────────
const MemBar = ({ label, used, total, color = 'blue' }) => {
  const pct = total > 0 ? Math.round((used / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-neutral-500">{label}</span>
        <span className="font-mono text-neutral-700">{used}MB / {total}MB ({pct}%)</span>
      </div>
      <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
        <div className={`h-full bg-${color}-500 rounded-full transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
};

// ─── Log Line ─────────────────────────────────────────────────────────────────
const SOURCE_BADGE = {
  router:   'bg-violet-800 text-violet-200',
  watchdog: 'bg-sky-800 text-sky-200',
};
function sourceBadgeClass(source) {
  if (!source) return 'bg-neutral-800 text-neutral-400';
  return SOURCE_BADGE[source.toLowerCase()] || 'bg-amber-900 text-amber-200';
}
function sourceDotClass(source) {
  if (!source) return 'bg-neutral-500';
  const k = source.toLowerCase();
  if (k === 'router')   return 'bg-violet-400';
  if (k === 'watchdog') return 'bg-sky-400';
  return 'bg-amber-400';
}

const LogLine = ({ entry }) => {
  const colors  = { error: 'text-red-400', warn: 'text-amber-400', info: 'text-neutral-300' };
  const bgColor = { error: 'bg-red-950/30', warn: 'bg-amber-950/20', info: '' };
  const prefix  = { error: 'ERR', warn: 'WRN', info: 'INF' };
  const t    = DateTime.fromISO(entry.ts).toFormat('HH:mm:ss.SSS');
  const date = DateTime.fromISO(entry.ts).toFormat('MM/dd');
  return (
    <div className={`flex gap-2 text-xs font-mono leading-relaxed py-0.5 hover:bg-white/5 px-2 rounded ${bgColor[entry.level] || ''}`}>
      <span className="text-neutral-600 flex-shrink-0 select-none tabular-nums w-28">{date} {t}</span>
      <span className={`flex-shrink-0 font-bold w-7 ${colors[entry.level] || 'text-neutral-400'}`}>{prefix[entry.level] || 'LOG'}</span>
      {entry.source && (
        <span className={`flex-shrink-0 px-1.5 py-px rounded text-[10px] font-bold uppercase tracking-wide ${sourceBadgeClass(entry.source)}`}>
          {entry.sourceName || entry.source}
        </span>
      )}
      <span className={`break-all ${colors[entry.level] || 'text-neutral-300'}`}>{entry.msg}</span>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT DETAIL (existing, slightly enhanced)
// ═══════════════════════════════════════════════════════════════════════════════
function EventDetail({ event: initialEvent, onBack, onDelete, onUpdate }) {
  const [tab, setTab] = useState('overview');
  const [event, setEvent] = useState(initialEvent);
  const [messages, setMessages] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [polls, setPolls] = useState([]);
  const [files, setFiles] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [search, setSearch] = useState('');

  useEffect(() => { load(); }, [event._id]);

  const load = async () => {
    setLoading(true);
    try {
      const [a, b, c, d, e] = await Promise.all([
        adminAPI.getMessages(event._id).catch(() => ({ data: { messages: [] } })),
        adminAPI.getParticipants(event._id).catch(() => ({ data: { participants: [] } })),
        adminAPI.getPolls(event._id).catch(() => ({ data: { polls: [] } })),
        adminAPI.getFiles(event._id).catch(() => ({ data: { files: [] } })),
        adminAPI.getInvites(event._id).catch(() => ({ data: { invites: [] } })),
      ]);
      setMessages(a.data.messages || []);
      setParticipants(b.data.participants || []);
      setPolls(c.data.polls || []);
      setFiles(d.data.files || []);
      setInvites(e.data.invites || []);
    } catch { toast.error('Load error'); }
    finally { setLoading(false); }
  };

  const save = async () => {
    try {
      await adminAPI.updateEvent(event._id, editForm);
      setEvent({ ...event, ...editForm });
      setEditMode(false);
      toast.success('Event saved');
      onUpdate?.();
    } catch { toast.error('Save failed'); }
  };

  const exportJSON = (type, data) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `${event.subdomain}-${type}-${Date.now()}.json`; a.click();
  };

  const fm = messages.filter(m => !search || m.content?.toLowerCase().includes(search.toLowerCase()) || m.username?.toLowerCase().includes(search.toLowerCase()));
  const fp = participants.filter(p => !search || p.username?.toLowerCase().includes(search.toLowerCase()));

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Info },
    { id: 'messages', label: 'Chat', icon: MessageSquare, count: messages.length },
    { id: 'participants', label: 'Participants', icon: Users, count: participants.length },
    { id: 'polls', label: 'Polls', icon: BarChart3, count: polls.length },
    { id: 'files', label: 'Files', icon: FileText, count: files.length },
    { id: 'invites', label: 'Invites', icon: Mail, count: invites.length },
  ];

  return (
    <div>
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <button onClick={onBack} className="btn btn-ghost p-1.5"><ArrowLeft className="w-4 h-4" /></button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-neutral-900 truncate">{event.title}</h2>
          <p className="text-xs text-neutral-400 font-mono">{event._id} · /{event.subdomain}</p>
        </div>
        <StatusBadge status={event.status} />
        <button onClick={async () => {
          try {
            const r = await adminAPI.getEventAccess(event._id);
            localStorage.setItem('eventToken', r.data.token);
            localStorage.setItem('username', 'ADMIN');
            window.open(`/event/${event._id}`, '_blank');
          } catch { toast.error('Access failed'); }
        }} className="btn btn-secondary text-xs gap-1">
          <ExternalLink className="w-3 h-3" /> View Live
        </button>
        <select value={event.status} onChange={e => adminAPI.updateEventStatus(event._id, e.target.value).then(() => { setEvent({ ...event, status: e.target.value }); toast.success('Status updated'); onUpdate?.(); }).catch(() => toast.error('Failed'))} className="input py-1.5 text-sm">
          {['active', 'completed', 'cancelled', 'draft'].map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        {editMode ? (
          <>
            <button onClick={save} className="btn btn-primary text-sm gap-1"><Save className="w-3 h-3" /> Save</button>
            <button onClick={() => { setEditMode(false); setEditForm({}); }} className="btn btn-secondary text-sm"><X className="w-3 h-3" /></button>
          </>
        ) : (
          <button onClick={() => { setEditMode(true); setEditForm(event); }} className="btn btn-secondary text-sm gap-1"><Edit2 className="w-3 h-3" /> Edit</button>
        )}
        <button onClick={() => onDelete(event._id)} className="btn btn-secondary text-sm text-red-600 hover:bg-red-50 gap-1"><Trash2 className="w-3 h-3" /></button>
      </div>

      {editMode && (
        <div className="card p-5 mb-5 bg-amber-50 border-amber-200">
          <h3 className="text-sm font-bold text-neutral-800 mb-4">Edit Event</h3>
          <div className="grid grid-cols-2 gap-4">
            {[
              { key: 'title', label: 'Title', type: 'text' },
              { key: 'subdomain', label: 'Subdomain', type: 'text' },
              { key: 'location', label: 'Location', type: 'text' },
              { key: 'organizerName', label: 'Organizer', type: 'text' },
              { key: 'organizerEmail', label: 'Email', type: 'email' },
              { key: 'maxParticipants', label: 'Max Capacity', type: 'number' },
            ].map(({ key, label, type }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-neutral-600 mb-1">{label}</label>
                <input type={type} className="input text-sm" value={editForm[key] || ''} onChange={e => setEditForm({ ...editForm, [key]: type === 'number' ? parseInt(e.target.value) : e.target.value })} />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Date</label>
              <input type="datetime-local" className="input text-sm" value={utcToLocal(editForm.date)} onChange={e => setEditForm({ ...editForm, date: localToUtc(e.target.value) })} />
            </div>
            <div className="flex items-center gap-6">
              {[['isPasswordProtected', 'Password Protected'], ['isEnterpriseMode', 'Enterprise Mode']].map(([k, l]) => (
                <label key={k} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={editForm[k] || false} onChange={e => setEditForm({ ...editForm, [k]: e.target.checked })} />
                  {l}
                </label>
              ))}
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={editForm.settings?.isPublic || false}
                  onChange={e => setEditForm({ ...editForm, settings: { ...(editForm.settings || {}), isPublic: e.target.checked } })} />
                Public Listing
              </label>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Theme Color <span className="text-neutral-400 font-normal">(hex, e.g. #6366f1)</span></label>
              <div className="flex items-center gap-2">
                <input type="text" className="input text-sm flex-1" placeholder="#6366f1" value={editForm.themeColor || ''} onChange={e => setEditForm({ ...editForm, themeColor: e.target.value })} />
                {editForm.themeColor && <div className="w-8 h-8 rounded-lg border border-neutral-200 flex-shrink-0" style={{ background: editForm.themeColor }} />}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Tags <span className="text-neutral-400 font-normal">(comma-separated)</span></label>
              <input type="text" className="input text-sm" placeholder="conference, networking, tech" value={(editForm.tags || []).join(', ')} onChange={e => setEditForm({ ...editForm, tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean) })} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-neutral-600 mb-1">Description</label>
              <textarea className="input text-sm" rows={2} value={editForm.description || ''} onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-5">
        {[['Messages', messages.length, MessageSquare], ['Participants', participants.length, Users], ['Polls', polls.length, BarChart3], ['Files', files.length, FileText], ['Invites', invites.length, Mail], ['Checked In', invites.filter(i => i.checkedIn).length, CheckCircle]].map(([l, v, I]) => (
          <div key={l} className="card p-3 flex items-center gap-2">
            <I className="w-4 h-4 text-neutral-400" />
            <div><p className="text-xl font-bold text-neutral-900">{v}</p><p className="text-xs text-neutral-500">{l}</p></div>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="flex border-b border-neutral-200 overflow-x-auto">
          {tabs.map(({ id, label, icon: I, count }) => (
            <button key={id} onClick={() => setTab(id)} className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors ${tab === id ? 'border-b-2 border-neutral-900 text-neutral-900' : 'text-neutral-400 hover:text-neutral-700'}`}>
              <I className="w-3.5 h-3.5" />{label}
              {count !== undefined && <span className="text-xs bg-neutral-100 rounded-full px-1.5">{count}</span>}
            </button>
          ))}
          <button onClick={load} className="ml-auto mr-3 my-2 btn btn-ghost p-1.5"><RefreshCw className="w-3.5 h-3.5" /></button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><div className="spinner w-6 h-6 border-2 border-neutral-300 border-t-neutral-600" /></div>
        ) : (
          <div className="p-5">
            {/* Overview */}
            {tab === 'overview' && (
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-3">Event Info</h3>
                  <dl className="space-y-3">
                    {[
                      [Calendar, 'Date', fmt(event.date)],
                      [MapPin, 'Location', event.location || 'Not set'],
                      [User, 'Organizer', event.organizerName],
                      [Mail, 'Email', event.organizerEmail],
                      [Clock, 'Created', rel(event.createdAt)],
                      [Users, 'Capacity', event.maxParticipants],
                    ].map(([I, l, v]) => (
                      <div key={l} className="flex items-start gap-2.5">
                        <I className="w-4 h-4 text-neutral-400 mt-0.5 flex-shrink-0" />
                        <div><p className="text-xs text-neutral-400">{l}</p><p className="text-sm font-medium text-neutral-900">{v}</p></div>
                      </div>
                    ))}
                  </dl>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-3">Settings</h3>
                  <dl className="space-y-3">
                    {[
                      ['Subdomain', `/${event.subdomain}`],
                      ['Status', event.status],
                      ['Password', event.isPasswordProtected ? '✓ Protected' : '✗ None'],
                      ['Enterprise', event.isEnterpriseMode ? '✓ Enabled' : '✗ Disabled'],
                      ['Public Listing', event.settings?.isPublic ? '✓ Public' : '✗ Private'],
                      ['Chat', event.settings?.allowChat !== false ? '✓ On' : '✗ Off'],
                      ['Polls', event.settings?.allowPolls !== false ? '✓ On' : '✗ Off'],
                      ['File Sharing', event.settings?.allowFileSharing !== false ? '✓ On' : '✗ Off'],
                    ].map(([l, v]) => (
                      <div key={l} className="flex justify-between">
                        <p className="text-xs text-neutral-400">{l}</p>
                        <p className={`text-sm font-medium ${String(v).startsWith('✓') ? 'text-emerald-700' : String(v).startsWith('✗') ? 'text-neutral-400' : 'text-neutral-900'}`}>{v}</p>
                      </div>
                    ))}
                  </dl>

                  {/* Theme */}
                  {(event.themeColor || event.coverImage || event.tags?.length > 0) && (
                    <div className="mt-4">
                      <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-3">Theme</p>
                      <div className="space-y-2">
                        {event.themeColor && (
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full border border-neutral-200" style={{ background: event.themeColor }} />
                            <span className="text-xs font-mono text-neutral-500">{event.themeColor}</span>
                          </div>
                        )}
                        {event.tags?.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {event.tags.map(t => <span key={t} className="text-xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full">{t}</span>)}
                          </div>
                        )}
                        {event.coverImage && (
                          <div className="mt-2 rounded-lg overflow-hidden border border-neutral-200 h-20">
                            <img src={event.coverImage} alt="Cover" className="w-full h-full object-cover" />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {event.description && (
                    <div className="mt-4">
                      <p className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-2">Description</p>
                      <p className="text-sm text-neutral-700 leading-relaxed">{event.description}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Messages */}
            {tab === 'messages' && (
              <div>
                <div className="flex gap-3 mb-4">
                  <div className="flex-1 relative"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" /><input type="text" placeholder="Search messages..." className="input pl-10 text-sm" value={search} onChange={e => setSearch(e.target.value)} /></div>
                  <button onClick={() => exportJSON('messages', messages)} className="btn btn-secondary text-sm gap-1"><Download className="w-3 h-3" /> Export</button>
                </div>
                <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
                  {fm.length === 0 ? <p className="text-sm text-neutral-400 text-center py-12">No messages</p> : fm.map(m => (
                    <div key={m._id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-neutral-50 group border border-neutral-100">
                      <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center text-xs font-bold flex-shrink-0">{m.username?.charAt(0).toUpperCase()}</div>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-semibold text-neutral-900">{m.username}</span>
                        <span className="text-xs text-neutral-400 ml-2">{rel(m.createdAt)}</span>
                        <p className="text-sm text-neutral-700 mt-0.5 break-words">{m.content}</p>
                      </div>
                      <button onClick={() => adminAPI.deleteMessage(event._id, m._id).then(() => { setMessages(p => p.filter(x => x._id !== m._id)); toast.success('Deleted'); }).catch(() => toast.error('Failed'))} className="opacity-0 group-hover:opacity-100 btn btn-ghost p-1.5 text-red-400"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Participants */}
            {tab === 'participants' && (
              <div>
                <div className="flex gap-3 mb-4">
                  <div className="flex-1 relative"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" /><input type="text" placeholder="Search participants..." className="input pl-10 text-sm" value={search} onChange={e => setSearch(e.target.value)} /></div>
                  <button onClick={() => exportJSON('participants', participants)} className="btn btn-secondary text-sm gap-1"><Download className="w-3 h-3" /> Export</button>
                </div>
                <div className="space-y-2">
                  {fp.length === 0 ? <p className="text-sm text-neutral-400 text-center py-12">No participants</p> : fp.map(p => (
                    <div key={p.username} className="flex items-center justify-between p-3 rounded-lg border border-neutral-100 hover:bg-neutral-50 group">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold">{p.username.charAt(0).toUpperCase()}</div>
                        <div>
                          <p className="text-sm font-medium">{p.username}</p>
                          <p className="text-xs text-neutral-400">{p.hasPassword && <Lock className="w-3 h-3 inline mr-1" />}Joined {rel(p.joinedAt)}{p.rsvp && ` · RSVP: ${p.rsvp.status}`}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100">
                        {p.hasPassword && <button onClick={() => adminAPI.resetParticipantPassword(event._id, p.username).then(() => toast.success('Reset')).catch(() => toast.error('Failed'))} className="btn btn-secondary text-xs px-2 py-1"><ShieldOff className="w-3 h-3" /> Reset PW</button>}
                        <button onClick={() => { if (!confirm(`Remove ${p.username}?`)) return; adminAPI.removeParticipant(event._id, p.username).then(() => { setParticipants(x => x.filter(u => u.username !== p.username)); toast.success('Removed'); }).catch(() => toast.error('Failed')); }} className="btn btn-secondary text-xs px-2 py-1 text-red-600"><UserX className="w-3 h-3" /> Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Polls */}
            {tab === 'polls' && (
              <div>
                <div className="flex justify-between mb-4"><p className="text-sm font-semibold">{polls.length} Polls</p><button onClick={() => exportJSON('polls', polls)} className="btn btn-secondary text-sm gap-1"><Download className="w-3 h-3" /> Export</button></div>
                {polls.length === 0 ? <p className="text-sm text-neutral-400 text-center py-12">No polls</p> : polls.map(poll => {
                  const total = poll.options?.reduce((s, o) => s + (o.votes?.length || 0), 0) || 0;
                  return (
                    <div key={poll._id} className="p-4 rounded-lg border border-neutral-200 mb-3 group">
                      <div className="flex justify-between mb-3">
                        <div><p className="text-sm font-medium">{poll.question}</p><p className="text-xs text-neutral-400">{rel(poll.createdAt)} · {total} votes</p></div>
                        <button onClick={() => adminAPI.deletePoll(event._id, poll._id).then(() => { setPolls(p => p.filter(x => x._id !== poll._id)); toast.success('Deleted'); }).catch(() => toast.error('Failed'))} className="opacity-0 group-hover:opacity-100 btn btn-ghost p-1.5 text-red-400"><Trash2 className="w-3 h-3" /></button>
                      </div>
                      {poll.options?.map(opt => { const v = opt.votes?.length || 0; const pct = total > 0 ? Math.round((v / total) * 100) : 0; return (
                        <div key={opt.text} className="mb-1.5">
                          <div className="flex justify-between text-xs mb-0.5"><span>{opt.text}</span><span className="text-neutral-400">{v} ({pct}%)</span></div>
                          <div className="h-1.5 bg-neutral-100 rounded-full"><div className="h-full bg-blue-500 rounded-full" style={{ width: `${pct}%` }} /></div>
                        </div>
                      ); })}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Files */}
            {tab === 'files' && (
              <div>
                <div className="flex justify-between mb-4"><p className="text-sm font-semibold">{files.length} Files {files.length > 0 && `(${formatFileSize(files.reduce((s, f) => s + (f.size || 0), 0))})`}</p><button onClick={() => exportJSON('files', files)} className="btn btn-secondary text-sm gap-1"><Download className="w-3 h-3" /> Export List</button></div>
                {files.length === 0 ? <p className="text-sm text-neutral-400 text-center py-12">No files</p> : files.map(f => (
                  <div key={f._id} className="flex items-center gap-3 p-3 rounded-lg border border-neutral-100 hover:bg-neutral-50 group mb-1">
                    {f.mimetype?.startsWith('image/') ? <Image className="w-4 h-4 text-blue-500 flex-shrink-0" /> : <FileText className="w-4 h-4 text-neutral-400 flex-shrink-0" />}
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{f.filename}</p><p className="text-xs text-neutral-400">{formatFileSize(f.size)} · {f.uploadedBy} · {rel(f.uploadedAt)}</p></div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100">
                      <a href={f.url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary text-xs px-2 py-1"><Download className="w-3 h-3" /></a>
                      <button onClick={() => adminAPI.deleteFile(event._id, f._id).then(() => { setFiles(p => p.filter(x => x._id !== f._id)); toast.success('Deleted'); }).catch(() => toast.error('Failed'))} className="btn btn-secondary text-xs px-2 py-1 text-red-600"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Invites */}
            {tab === 'invites' && (
              <div>
                <div className="flex justify-between mb-4"><p className="text-sm font-semibold">{invites.length} Invites ({invites.filter(i => i.checkedIn).length} checked in)</p><button onClick={() => exportJSON('invites', invites)} className="btn btn-secondary text-sm gap-1"><Download className="w-3 h-3" /> Export</button></div>
                {invites.length === 0 ? <p className="text-sm text-neutral-400 text-center py-12">No invites</p> : invites.map(inv => (
                  <div key={inv._id} className={`p-3 rounded-lg border mb-1.5 group ${inv.checkedIn ? 'bg-emerald-50 border-emerald-200' : 'border-neutral-100'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium">{inv.guestName}</p>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 font-mono">{inv.inviteCode}</span>
                          {inv.checkedIn && <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">✓ In</span>}
                        </div>
                        <p className="text-xs text-neutral-400">{inv.guestEmail} · {inv.groupSize} {inv.groupSize === 1 ? 'person' : 'people'}</p>
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100">
                        {!inv.checkedIn && <button onClick={() => adminAPI.checkInGuest(event._id, inv.inviteCode).then(() => { toast.success('Checked in'); load(); }).catch(() => toast.error('Failed'))} className="btn btn-primary text-xs px-2 py-1">Check In</button>}
                        <button onClick={() => adminAPI.deleteInvite(event._id, inv._id).then(() => { setInvites(p => p.filter(x => x._id !== inv._id)); toast.success('Deleted'); }).catch(() => toast.error('Failed'))} className="btn btn-secondary text-xs px-2 py-1 text-red-600"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// UPTIME PANEL (condensed but full-featured)
// ═══════════════════════════════════════════════════════════════════════════════
const SEVERITY_META = { minor: { label: 'Minor', bg: 'bg-amber-100', text: 'text-amber-700' }, major: { label: 'Major', bg: 'bg-orange-100', text: 'text-orange-700' }, critical: { label: 'Critical', bg: 'bg-red-100', text: 'text-red-700' } };
const STATUS_META = { investigating: { label: 'Investigating', dot: 'bg-red-500' }, identified: { label: 'Identified', dot: 'bg-orange-400' }, monitoring: { label: 'Monitoring', dot: 'bg-amber-400' }, resolved: { label: 'Resolved', dot: 'bg-emerald-500' } };
const tAgo = (d) => { const m = Math.floor((Date.now() - new Date(d)) / 60000); if (m < 1) return 'just now'; if (m < 60) return `${m}m ago`; const h = Math.floor(m / 60); return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`; };

function UptimePanel() {
  const [reports, setReports] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [tab, setTab] = useState('reports');
  const [expanded, setExpanded] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ title: '', description: '', severity: 'minor', initialMessage: '', reportIds: [] });
  const [selServices, setSelServices] = useState([]);
  const [creating, setCreating] = useState(false);
  const [tlTarget, setTlTarget] = useState(null);
  const [tlForm, setTlForm] = useState({ status: 'investigating', message: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);
  const load = async () => {
    setLoading(true);
    try {
      const [r, i] = await Promise.all([uptimeAPI.getReports().catch(() => ({ data: { reports: [] } })), uptimeAPI.getIncidents().catch(() => ({ data: { incidents: [] } }))]);
      setReports(r.data.reports || []);
      setIncidents(i.data.incidents || []);
    } catch {} finally { setLoading(false); }
  };

  const pending = reports.filter(r => r.status === 'pending').length;
  const active  = incidents.filter(i => i.status !== 'resolved').length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold">Uptime & Incidents</h2>
          <p className="text-sm text-neutral-500">{active > 0 ? `${active} active` : 'All clear'} · {pending} pending reports</p>
        </div>
        <div className="flex gap-2">
          <a href="/status" target="_blank" className="btn btn-secondary gap-1 text-sm"><ExternalLink className="w-3.5 h-3.5" /> Status Page</a>
          <button onClick={() => { setCreateForm({ title: '', description: '', severity: 'minor', initialMessage: '', reportIds: [] }); setSelServices([]); setShowCreate(true); }} className="btn btn-primary gap-1 text-sm"><Plus className="w-3.5 h-3.5" /> New Incident</button>
        </div>
      </div>

      <div className="flex gap-1 bg-neutral-100 rounded-xl p-1 w-fit">
        {[['reports', 'Reports', pending], ['incidents', 'Incidents', active]].map(([id, l, c]) => (
          <button key={id} onClick={() => setTab(id)} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${tab === id ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500'}`}>
            {l} {c > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${tab === id ? 'bg-red-100 text-red-600' : 'bg-neutral-200 text-neutral-500'}`}>{c}</span>}
          </button>
        ))}
      </div>

      {loading ? <div className="flex justify-center py-12"><span className="spinner w-6 h-6 border-2 border-neutral-200 border-t-neutral-600" /></div> : (
        <>
          {tab === 'reports' && (
            <div className="space-y-2">
              {reports.length === 0 ? <div className="text-center py-12 text-neutral-400"><Radio className="w-8 h-8 mx-auto mb-2 opacity-30" /><p className="text-sm">No reports</p></div> : reports.map(r => (
                <div key={r._id} className="card p-4 flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${r.status === 'pending' ? 'bg-amber-400 animate-pulse' : 'bg-neutral-300'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs font-medium bg-neutral-100 px-2 py-0.5 rounded-full">{r.affectedService}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${r.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-neutral-100 text-neutral-500'}`}>{r.status}</span>
                      <span className="text-xs text-neutral-400">{tAgo(r.createdAt)}</span>
                    </div>
                    <p className="text-sm text-neutral-800">{r.description}</p>
                  </div>
                  {r.status === 'pending' && (
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => { setCreateForm(f => ({ ...f, reportIds: [r._id], description: r.description, title: `Issue with ${r.affectedService}` })); setSelServices([]); setShowCreate(true); }} className="text-xs px-2 py-1.5 rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 font-medium">Make Incident</button>
                      <button onClick={() => uptimeAPI.updateReport(r._id, { status: 'dismissed' }).then(() => setReports(x => x.map(y => y._id === r._id ? { ...y, status: 'dismissed' } : y))).catch(() => toast.error('Failed'))} className="text-xs px-2 py-1.5 rounded-lg border border-neutral-200 text-neutral-500">Dismiss</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {tab === 'incidents' && (
            <div className="space-y-2">
              {incidents.length === 0 ? <div className="text-center py-12 text-neutral-400"><CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-30" /><p className="text-sm">No incidents</p></div> : incidents.map(inc => {
                const sm = STATUS_META[inc.status] || STATUS_META.investigating;
                const sv = SEVERITY_META[inc.severity] || SEVERITY_META.minor;
                const isEx = expanded === inc._id;
                return (
                  <div key={inc._id} className="card overflow-hidden">
                    <button className="w-full px-5 py-4 flex items-start gap-3 text-left hover:bg-neutral-50" onClick={() => setExpanded(isEx ? null : inc._id)}>
                      <span className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${sm.dot} ${inc.status !== 'resolved' ? 'animate-pulse' : ''}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold">{inc.title}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sv.bg} ${sv.text}`}>{sv.label}</span>
                          <span className="text-xs text-neutral-400 font-medium">{sm.label}</span>
                        </div>
                        <p className="text-xs text-neutral-400 mt-0.5">{tAgo(inc.createdAt)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {inc.status !== 'resolved' && <button onClick={e => { e.stopPropagation(); setTlTarget(inc._id); setTlForm({ status: 'investigating', message: '' }); }} className="text-xs px-2 py-1.5 rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 font-medium">Update</button>}
                        <button onClick={e => { e.stopPropagation(); if (!confirm('Delete incident?')) return; uptimeAPI.deleteIncident(inc._id).then(() => setIncidents(x => x.filter(y => y._id !== inc._id))).catch(() => toast.error('Failed')); }} className="p-1.5 text-neutral-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                        {isEx ? <ChevronUp className="w-4 h-4 text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
                      </div>
                    </button>
                    {isEx && (
                      <div className="px-5 pb-5 border-t border-neutral-100">
                        {inc.description && <p className="text-sm text-neutral-600 mt-4 mb-3">{inc.description}</p>}
                        {inc.timeline?.length > 0 && (
                          <div className="relative pl-4 mt-3">
                            <div className="absolute left-0 top-0 bottom-0 w-px bg-neutral-200" />
                            {[...inc.timeline].reverse().map((u, j) => { const usm = STATUS_META[u.status] || STATUS_META.investigating; return (
                              <div key={j} className="relative mb-3">
                                <span className={`absolute -left-[17px] w-2.5 h-2.5 rounded-full border-2 border-white ${usm.dot}`} />
                                <p className="text-xs font-semibold text-neutral-700">{usm.label} <span className="font-normal text-neutral-400">{tAgo(u.createdAt)}</span></p>
                                <p className="text-sm text-neutral-600 mt-0.5">{u.message}</p>
                              </div>
                            ); })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Create Incident Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4" onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden" style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="px-5 py-4 border-b flex items-center justify-between flex-shrink-0">
              <h3 className="font-bold">Create Incident</h3>
              <button onClick={() => setShowCreate(false)} className="p-1 hover:bg-neutral-100 rounded-lg"><X className="w-4 h-4 text-neutral-400" /></button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2"><label className="block text-xs font-medium text-neutral-600 mb-1">Title *</label><input value={createForm.title} onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. API Delays" className="input w-full text-sm" /></div>
                <div><label className="block text-xs font-medium text-neutral-600 mb-1">Severity</label><select value={createForm.severity} onChange={e => setCreateForm(f => ({ ...f, severity: e.target.value }))} className="input w-full text-sm">{['minor', 'major', 'critical'].map(s => <option key={s} value={s}>{s}</option>)}</select></div>
              </div>
              <div><label className="block text-xs font-medium text-neutral-600 mb-1">Description</label><textarea value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))} rows={2} className="input w-full text-sm resize-none" /></div>
              <div><label className="block text-xs font-medium text-neutral-600 mb-1">Initial Message</label><textarea value={createForm.initialMessage} onChange={e => setCreateForm(f => ({ ...f, initialMessage: e.target.value }))} rows={2} className="input w-full text-sm resize-none" /></div>

              {/* ── Affected Services Picker ── */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-neutral-600">
                    Affected Services
                    <span className="ml-1 text-neutral-400 font-normal">(leave blank = general banner only, no individual features marked down)</span>
                  </label>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setSelServices(ALL_SERVICES_FLAT.map(s => s.key))} className="text-xs text-blue-600 hover:text-blue-800 font-medium">Select all</button>
                    <button type="button" onClick={() => setSelServices([])} className="text-xs text-neutral-500 hover:text-neutral-700 font-medium">Clear</button>
                  </div>
                </div>

                {/* Selected chips */}
                {selServices.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2 p-2 bg-red-50 border border-red-100 rounded-lg">
                    {selServices.map(key => {
                      const svc = ALL_SERVICES_FLAT.find(s => s.key === key);
                      return (
                        <span key={key} className="inline-flex items-center gap-1 text-xs bg-red-500 text-white px-2 py-0.5 rounded-full font-medium">
                          {svc?.name || key}
                          <button type="button" onClick={() => setSelServices(p => p.filter(k => k !== key))} className="hover:opacity-70 ml-0.5">
                            <X className="w-2.5 h-2.5" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Category grid */}
                <div className="border border-neutral-200 rounded-xl overflow-hidden" style={{ maxHeight: '260px', overflowY: 'auto' }}>
                  {SERVICE_CATEGORIES.map(cat => {
                    const catKeys = cat.services.map(s => s.key);
                    const allCatSelected = catKeys.every(k => selServices.includes(k));
                    const someCatSelected = catKeys.some(k => selServices.includes(k));
                    return (
                      <div key={cat.id} className="border-b border-neutral-100 last:border-0">
                        <div className="flex items-center justify-between px-3 py-2 bg-neutral-50 sticky top-0">
                          <button
                            type="button"
                            onClick={() => {
                              if (allCatSelected) setSelServices(p => p.filter(k => !catKeys.includes(k)));
                              else setSelServices(p => [...new Set([...p, ...catKeys])]);
                            }}
                            className="flex items-center gap-2 group"
                          >
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${allCatSelected ? 'bg-neutral-800 border-neutral-800' : someCatSelected ? 'border-neutral-400 bg-neutral-200' : 'border-neutral-300'}`}>
                              {allCatSelected && <svg width="8" height="8" viewBox="0 0 10 10"><polyline points="1.5 5 4 7.5 8.5 2" stroke="white" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                              {someCatSelected && !allCatSelected && <div className="w-1.5 h-1.5 bg-neutral-500 rounded-sm" />}
                            </div>
                            <span className="text-xs font-bold text-neutral-700 uppercase tracking-wide group-hover:text-neutral-900">{cat.label}</span>
                          </button>
                          <span className="text-xs text-neutral-400">{catKeys.filter(k => selServices.includes(k)).length}/{catKeys.length}</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3">
                          {cat.services.map(svc => {
                            const selected = selServices.includes(svc.key);
                            return (
                              <label key={svc.key} className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors border-r border-b border-neutral-50 ${selected ? 'bg-red-50' : 'hover:bg-neutral-50'}`}>
                                <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${selected ? 'bg-red-500 border-red-500' : 'border-neutral-300'}`}>
                                  {selected && <svg width="7" height="7" viewBox="0 0 10 10"><polyline points="1.5 5 4 7.5 8.5 2" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                                </div>
                                <input type="checkbox" className="sr-only" checked={selected} onChange={() => setSelServices(p => selected ? p.filter(k => k !== svc.key) : [...p, svc.key])} />
                                <span className={`text-xs ${selected ? 'text-red-700 font-medium' : 'text-neutral-600'}`}>{svc.name}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {selServices.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                    No services selected — incident will appear in the status banner but won't mark any individual feature as disrupted.
                  </p>
                )}
                {selServices.length > 0 && (
                  <p className="text-xs text-red-600 mt-1.5 font-medium">
                    {selServices.length} feature{selServices.length !== 1 ? 's' : ''} will be marked as disrupted on the public status page.
                  </p>
                )}
              </div>
            </div>
            <div className="px-5 py-4 border-t flex gap-3 flex-shrink-0">
              <button onClick={() => setShowCreate(false)} className="flex-1 btn btn-secondary text-sm">Cancel</button>
              <button onClick={async () => {
                if (!createForm.title.trim()) { toast.error('Title required'); return; }
                setCreating(true);
                try { await uptimeAPI.createIncident({ ...createForm, affectedServices: selServices }); toast.success('Created'); setShowCreate(false); load(); } catch { toast.error('Failed'); } finally { setCreating(false); }
              }} disabled={creating} className="flex-1 btn bg-neutral-900 hover:bg-neutral-800 text-white text-sm gap-2">
                {creating ? <span className="spinner w-4 h-4 border-2 border-white/30 border-t-white" /> : <Plus className="w-4 h-4" />} Create Incident
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Timeline update modal */}
      {tlTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4" onClick={e => e.target === e.currentTarget && setTlTarget(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between"><h3 className="font-bold">Post Update</h3><button onClick={() => setTlTarget(null)} className="p-1 hover:bg-neutral-100 rounded-lg"><X className="w-4 h-4 text-neutral-400" /></button></div>
            <div className="p-5 space-y-4">
              <div><label className="block text-xs font-medium text-neutral-600 mb-1">Status</label><select value={tlForm.status} onChange={e => setTlForm(f => ({ ...f, status: e.target.value }))} className="input w-full text-sm">{Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></div>
              <div><label className="block text-xs font-medium text-neutral-600 mb-1">Message *</label><textarea value={tlForm.message} onChange={e => setTlForm(f => ({ ...f, message: e.target.value }))} rows={3} className="input w-full text-sm resize-none" /></div>
            </div>
            <div className="px-5 py-4 border-t flex gap-3">
              <button onClick={() => setTlTarget(null)} className="flex-1 btn btn-secondary text-sm">Cancel</button>
              <button onClick={async () => {
                if (!tlForm.message.trim()) { toast.error('Message required'); return; }
                try { const r = await uptimeAPI.addTimelineUpdate(tlTarget, tlForm); setIncidents(inc => inc.map(i => i._id === tlTarget ? r.data.incident : i)); setTlTarget(null); toast.success('Updated'); } catch { toast.error('Failed'); }
              }} className={`flex-1 btn text-white text-sm gap-2 ${tlForm.status === 'resolved' ? 'bg-emerald-600 hover:bg-emerald-700 border-emerald-600' : 'bg-neutral-900 hover:bg-neutral-800'}`}>
                {tlForm.status === 'resolved' ? 'Resolve' : 'Post Update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SYSTEM MONITOR PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function SystemPanel() {
  const [sys, setSys] = useState(null);
  const [loading, setLoading] = useState(true);
  const [watchdogData, setWatchdogData] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    // Fire both independently — system stats and watchdog render as they arrive
    adminAPI.getSystem()
      .then(r => { if (r?.data) setSys(r.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
    watchdogAPI.getStatus()
      .then(r => { if (r?.data) setWatchdogData(r.data); })
      .catch(() => {});
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, [load]);

  if (loading && !sys) return <div className="flex justify-center py-24"><div className="spinner w-8 h-8 border-2 border-neutral-300 border-t-neutral-600" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">System Monitor</h2>
          <p className="text-sm text-neutral-500">Live infrastructure metrics · auto-refresh 15s</p>
        </div>
        <button onClick={load} className="btn btn-secondary gap-2 text-sm"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh</button>
      </div>

      {sys && (
        <>
          {/* Process Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Process Uptime', value: fmtUptime(sys.process.uptime), icon: Clock, color: 'blue' },
              { label: 'Node.js', value: sys.process.nodeVersion, icon: GitBranch, color: 'emerald' },
              { label: 'Platform', value: `${sys.process.platform}/${sys.process.arch}`, icon: Server, color: 'violet' },
              { label: 'Environment', value: sys.process.env, icon: Settings, color: 'amber' },
              { label: 'CPU Cores', value: sys.os.cpus, icon: Cpu, color: 'rose' },
              { label: 'Hostname', value: sys.os.hostname, icon: Globe, color: 'cyan' },
              { label: 'PID', value: sys.process.pid, icon: Hash, color: 'indigo' },
              { label: 'DB Status', value: sys.db.state, icon: Database, color: sys.db.state === 'connected' ? 'emerald' : 'red' },
            ].map(({ label, value, icon: I, color }) => (
              <div key={label} className="card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-7 h-7 rounded-lg bg-${color}-50 flex items-center justify-center`}><I className={`w-3.5 h-3.5 text-${color}-600`} /></div>
                  <p className="text-xs font-medium text-neutral-500">{label}</p>
                </div>
                <p className="text-sm font-bold text-neutral-900 truncate">{String(value)}</p>
              </div>
            ))}
          </div>

          {/* Memory */}
          <div className="card p-5">
            <h3 className="text-sm font-bold text-neutral-700 mb-4 flex items-center gap-2"><Cpu className="w-4 h-4" /> Memory Usage</h3>
            <div className="space-y-4">
              <MemBar label="System RAM" used={sys.os.totalMemMB - sys.os.freeMemMB} total={sys.os.totalMemMB} color="blue" />
              <MemBar label="Heap Used" used={sys.process.memoryMB.heapUsed} total={sys.process.memoryMB.heapTotal} color="violet" />
              <MemBar label="RSS (Resident)" used={sys.process.memoryMB.rss} total={sys.process.memoryMB.heapTotal} color="amber" />
            </div>
            <div className="grid grid-cols-4 gap-3 mt-4">
              {[['RSS', sys.process.memoryMB.rss], ['Heap Used', sys.process.memoryMB.heapUsed], ['Heap Total', sys.process.memoryMB.heapTotal], ['External', sys.process.memoryMB.external]].map(([l, v]) => (
                <div key={l} className="text-center p-3 bg-neutral-50 rounded-xl">
                  <p className="text-xs text-neutral-400 mb-1">{l}</p>
                  <p className="text-sm font-bold text-neutral-900">{v} MB</p>
                </div>
              ))}
            </div>
          </div>

          {/* Load Average */}
          <div className="card p-5">
            <h3 className="text-sm font-bold text-neutral-700 mb-4 flex items-center gap-2"><Activity className="w-4 h-4" /> System Load</h3>
            <div className="grid grid-cols-3 gap-4">
              {['1 min', '5 min', '15 min'].map((l, i) => {
                const v = sys.os.loadAvg[i] || 0;
                const pct = Math.min((v / sys.os.cpus) * 100, 100);
                return (
                  <div key={l} className="text-center">
                    <div className="relative w-20 h-20 mx-auto mb-2">
                      <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
                        <circle cx="18" cy="18" r="15.9" fill="none" stroke="#f3f4f6" strokeWidth="3" />
                        <circle cx="18" cy="18" r="15.9" fill="none" stroke={pct > 80 ? '#ef4444' : pct > 60 ? '#f59e0b' : '#22c55e'} strokeWidth="3" strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset="0" strokeLinecap="round" />
                      </svg>
                      <p className="absolute inset-0 flex items-center justify-center text-sm font-bold">{v}</p>
                    </div>
                    <p className="text-xs text-neutral-400">{l}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* DB Collections */}
          <div className="card p-5">
            <h3 className="text-sm font-bold text-neutral-700 mb-4 flex items-center gap-2"><Database className="w-4 h-4" /> Database Collections — <span className={`text-xs font-medium px-2 py-0.5 rounded-full ml-1 ${sys.db.state === 'connected' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{sys.db.state}</span></h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {Object.entries(sys.collections || {}).map(([k, v]) => (
                <div key={k} className="p-3 bg-neutral-50 rounded-xl">
                  <p className="text-xs text-neutral-400 capitalize mb-1">{k}</p>
                  <p className="text-2xl font-bold text-neutral-900">{formatNumber(v)}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-neutral-400 mt-3">DB: {sys.db.name} @ {sys.db.host}</p>
          </div>
        </>
      )}

      {/* Watchdog Data */}
      {watchdogData && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-neutral-700 flex items-center gap-2"><Radio className="w-4 h-4" /> Watchdog Monitor</h3>
            <StatusBadge status={watchdogData.status === 'operational' ? 'up' : 'down'} />
          </div>

          {/* Active incidents from watchdog */}
          {watchdogData.activeIncidents?.filter(i => i.status !== 'resolved').map(inc => (
            <div key={inc._id} className={`mb-3 p-3 rounded-xl border-l-4 ${inc.severity === 'critical' ? 'bg-red-50 border-red-500' : 'bg-amber-50 border-amber-400'}`}>
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-2 h-2 rounded-full animate-pulse ${inc.severity === 'critical' ? 'bg-red-500' : 'bg-amber-400'}`} />
                <p className={`text-xs font-semibold ${inc.severity === 'critical' ? 'text-red-700' : 'text-amber-700'}`}>{inc.title}</p>
              </div>
              {inc.timeline?.length > 0 && (
                <p className="text-xs text-neutral-600 ml-4">{inc.timeline[inc.timeline.length - 1].message}</p>
              )}
            </div>
          ))}

          <div className="space-y-3">
            {watchdogData.watchdog?.services?.map(svc => (
              <div key={svc.name} className={`flex items-center justify-between p-3 rounded-xl ${svc.status === 'down' ? 'bg-red-50 border border-red-200' : 'bg-neutral-50'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${svc.status === 'up' ? 'bg-emerald-400' : 'bg-red-400 animate-pulse'}`} />
                  <div>
                    <p className="text-sm font-medium">{svc.name}</p>
                    <p className="text-xs text-neutral-400">{svc.type}{svc.region ? ` · ${svc.region}` : ''}</p>
                  </div>
                </div>
                <div className="text-right">
                  <StatusBadge status={svc.status} />
                  {svc.lastPingMs ? <p className="text-xs text-neutral-400 mt-1">{svc.lastPingMs}ms</p> : svc.status === 'down' ? <p className="text-xs text-red-400 mt-1">No response</p> : null}
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-3">
            <p className="text-xs text-neutral-400">DB: {watchdogData.dbStatus} · Checked {rel(watchdogData.checkedAt)}</p>
            <button
              onClick={async () => {
                const secret = prompt('Enter MESH_SECRET to send a test ntfy notification:');
                if (!secret) return;
                try {
                  const r = await watchdogAPI.testNtfy(secret);
                  toast.success(`ntfy test sent (HTTP ${r.data.status}) — check your phone`);
                } catch (e) {
                  const msg = e.response?.data?.error || e.message;
                  toast.error(`ntfy test failed: ${msg}`);
                }
              }}
              className="text-xs px-2 py-1 rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-50"
            >
              Test ntfy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FLEET LOGS PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function LogsPanel() {
  const [logs, setLogs]             = useState([]);
  const [sources, setSources]       = useState([]);
  const [filter, setFilter]         = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [search, setSearch]         = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [live, setLive]             = useState(false);
  const [loading, setLoading]       = useState(true);
  const bottomRef = useRef(null);
  const esRef     = useRef(null);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const r = await adminAPI.getFleetLogs();
      setLogs(r.data.logs || []);
      setSources(r.data.sources || []);
    } catch {
      // fallback: local backend only
      try {
        const r = await adminAPI.getLogs('all');
        const backendName = 'Backend';
        setLogs((r.data.logs || []).map(e => ({ ...e, source: 'backend', sourceName: backendName })));
        setSources([{ source: 'backend', name: backendName, ok: true, count: r.data.logs?.length || 0 }]);
      } catch { toast.error('Failed to load logs'); }
    } finally { setLoading(false); }
  };

  useEffect(() => { loadLogs(); }, []);

  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, autoScroll]);

  const startLive = () => {
    if (esRef.current) return;
    const token  = localStorage.getItem('adminToken');
    const apiUrl = import.meta.env?.VITE_API_URL || '';
    const es = new EventSource(`${apiUrl}/api/admin/logs/stream?token=${encodeURIComponent(token)}`, { withCredentials: false });
    esRef.current = es;
    es.onmessage = (e) => {
      try {
        const entry = JSON.parse(e.data);
        const tagged = { ...entry, source: entry.source || 'backend', sourceName: entry.sourceName || 'Backend' };
        setLogs(prev => [...prev.slice(-1999), tagged]);
      } catch {}
    };
    es.onerror = () => { toast.error('Live log stream disconnected'); stopLive(); };
    setLive(true);
  };

  const stopLive = () => { esRef.current?.close(); esRef.current = null; setLive(false); };

  const downloadFull = async () => {
    try {
      const token  = localStorage.getItem('adminToken');
      const apiUrl = import.meta.env?.VITE_API_URL || '';
      const r    = await fetch(`${apiUrl}/api/admin/logs/full`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await r.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a    = document.createElement('a');
      a.href     = URL.createObjectURL(blob);
      a.download = `planit-full-dump-${Date.now()}.json`;
      a.click();
      toast.success('Full system dump downloaded');
    } catch { toast.error('Failed to fetch full dump'); }
  };

  useEffect(() => () => esRef.current?.close(), []);

  const filtered = logs.filter(l => {
    if (filter !== 'all' && l.level !== filter) return false;
    if (sourceFilter !== 'all' && (l.source || 'backend') !== sourceFilter) return false;
    if (search && !l.msg?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const counts = {
    all:   logs.length,
    info:  logs.filter(l => l.level === 'info').length,
    warn:  logs.filter(l => l.level === 'warn').length,
    error: logs.filter(l => l.level === 'error').length,
  };

  const uniqueSources = [...new Set(logs.map(l => l.source || 'backend'))];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold">Fleet Log Console</h2>
          <p className="text-sm text-neutral-500">{counts.all.toLocaleString()} entries · {counts.error} errors · {counts.warn} warnings · {sources.length} source{sources.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={autoScroll ? () => setAutoScroll(false) : () => setAutoScroll(true)} className={`btn text-sm gap-1 ${autoScroll ? 'btn-primary' : 'btn-secondary'}`}>
            {autoScroll ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />} Auto-scroll
          </button>
          <button onClick={live ? stopLive : startLive} className={`btn text-sm gap-2 ${live ? 'bg-red-600 text-white border-red-600 hover:bg-red-700' : 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'}`}>
            {live ? <><Power className="w-3.5 h-3.5" /> Stop Live</> : <><Radio className="w-3.5 h-3.5" /> Go Live</>}
          </button>
          <button onClick={() => {
            const blob = new Blob(
              [filtered.map(l => `[${l.ts}] [${(l.sourceName || l.source || 'backend').toUpperCase()}] [${l.level.toUpperCase()}] ${l.msg}`).join('\n')],
              { type: 'text/plain' }
            );
            const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `fleet-logs-${Date.now()}.txt`; a.click();
          }} className="btn btn-secondary text-sm gap-1"><Download className="w-3.5 h-3.5" /> Export .txt</button>
          <button onClick={downloadFull} className="btn btn-secondary text-sm gap-1"><Download className="w-3.5 h-3.5" /> Full Dump</button>
          <button onClick={loadLogs} className="btn btn-secondary text-sm gap-1"><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
      </div>

      {/* Source status pills */}
      {sources.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {sources.map(s => (
            <div key={s.source} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${s.ok ? 'border-neutral-700 bg-neutral-900' : 'border-red-800 bg-red-950/40'}`}>
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.ok ? sourceDotClass(s.source) : 'bg-red-500'}`} />
              <span className={s.ok ? 'text-neutral-200' : 'text-red-300'}>{s.name}</span>
              {s.ok
                ? <span className="text-neutral-500">{s.count.toLocaleString()} logs</span>
                : <span className="text-red-400 text-[10px]">unreachable</span>
              }
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-neutral-100 rounded-xl p-1">
          {[['all', 'All', counts.all], ['info', 'Info', counts.info], ['warn', 'Warn', counts.warn], ['error', 'Error', counts.error]].map(([id, l, c]) => (
            <button key={id} onClick={() => setFilter(id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${filter === id ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500'}`}>
              {l} <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${filter === id ? (id === 'error' ? 'bg-red-100 text-red-600' : id === 'warn' ? 'bg-amber-100 text-amber-600' : 'bg-neutral-100 text-neutral-600') : 'bg-neutral-200 text-neutral-500'}`}>{c}</span>
            </button>
          ))}
        </div>

        {uniqueSources.length > 1 && (
          <div className="flex gap-1 bg-neutral-100 rounded-xl p-1">
            <button onClick={() => setSourceFilter('all')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${sourceFilter === 'all' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500'}`}>All</button>
            {uniqueSources.map(src => {
              const name = sources.find(s => s.source === src)?.name || src;
              return (
                <button key={src} onClick={() => setSourceFilter(src)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${sourceFilter === src ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500'}`}>
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${sourceDotClass(src)}`} />{name}
                </button>
              );
            })}
          </div>
        )}

        <div className="flex-1 min-w-40 relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input type="text" placeholder="Search all logs..." className="input pl-9 text-sm py-1.5" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {live && (
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> LIVE (backend)
          </div>
        )}
      </div>

      {/* Terminal */}
      <div className="bg-neutral-950 rounded-2xl border border-neutral-800 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-neutral-800 bg-neutral-900">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
          </div>
          <span className="text-xs text-neutral-500 font-mono">fleet logs · all services · sorted by time</span>
          <span className="ml-auto text-xs text-neutral-600">{filtered.length.toLocaleString()} / {counts.all.toLocaleString()}</span>
        </div>
        <div className="h-[560px] overflow-y-auto p-2" onScroll={e => { if (autoScroll) { const el = e.target; setAutoScroll(el.scrollHeight - el.scrollTop - el.clientHeight < 50); } }}>
          {loading
            ? <p className="text-neutral-500 text-xs font-mono p-4">Fetching logs from all fleet services...</p>
            : filtered.length === 0
            ? <p className="text-neutral-500 text-xs font-mono p-4">No logs match filter</p>
            : filtered.map((entry, i) => <LogLine key={`${entry.ts}-${i}`} entry={entry} />)
          }
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMPLOYEES PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function EmployeesPanel() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', role: 'support', department: '', phone: '', notes: '', status: 'active', password: '', startDate: '', permissions: { canDeleteEvents: false, canManageUsers: false, canViewLogs: false, canManageIncidents: true, canExportData: false, canRunCleanup: false } });
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, []);
  const load = async () => {
    setLoading(true);
    try { const r = await adminAPI.getEmployees(); setEmployees(r.data.employees || []); }
    catch { toast.error('Failed to load employees'); }
    finally { setLoading(false); }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', email: '', role: 'support', department: '', phone: '', notes: '', status: 'active', password: '', startDate: '', permissions: { canDeleteEvents: false, canManageUsers: false, canViewLogs: false, canManageIncidents: true, canExportData: false, canRunCleanup: false } });
    setShowModal(true);
  };

  const openEdit = (emp) => {
    setEditing(emp._id);
    setForm({ name: emp.name, email: emp.email, role: emp.role, department: emp.department || '', phone: emp.phone || '', notes: emp.notes || '', status: emp.status, password: '', startDate: emp.startDate || '', permissions: { ...emp.permissions } });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.email.trim()) { toast.error('Name and email required'); return; }
    if (!editing && !form.password.trim()) { toast.error('Password is required for new employees'); return; }
    setSaving(true);
    try {
      if (editing) { await adminAPI.updateEmployee(editing, form); toast.success('Employee updated'); }
      else { await adminAPI.createEmployee(form); toast.success('Employee created'); }
      setShowModal(false);
      load();
    } catch (e) { toast.error(e.response?.data?.error || 'Save failed'); }
    finally { setSaving(false); }
  };

  const del = async (id, name) => {
    if (!confirm(`Remove ${name} from the team?`)) return;
    try { await adminAPI.deleteEmployee(id); setEmployees(p => p.filter(e => e._id !== id)); toast.success('Removed'); }
    catch { toast.error('Delete failed'); }
  };

  const PERMS = [
    ['canDeleteEvents', 'Delete Events'],
    ['canManageUsers', 'Manage Users'],
    ['canViewLogs', 'View Logs'],
    ['canManageIncidents', 'Manage Incidents'],
    ['canExportData', 'Export Data'],
    ['canRunCleanup', 'Run Cleanup'],
  ];

  const ROLES = ['super_admin', 'admin', 'moderator', 'support', 'analyst', 'developer'];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Team & Employees</h2>
          <p className="text-sm text-neutral-500">{employees.length} team member{employees.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={openCreate} className="btn btn-primary gap-2 text-sm"><UserPlus className="w-4 h-4" /> Add Employee</button>
      </div>

      {loading ? <div className="flex justify-center py-12"><div className="spinner w-6 h-6 border-2 border-neutral-300 border-t-neutral-600" /></div> : employees.length === 0 ? (
        <div className="text-center py-20 text-neutral-400">
          <Briefcase className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-base font-medium text-neutral-500 mb-2">No employees yet</p>
          <p className="text-sm">Add your first team member to get started</p>
          <button onClick={openCreate} className="btn btn-primary mt-4 gap-2"><UserPlus className="w-4 h-4" /> Add Employee</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {employees.map(emp => (
            <div key={emp._id} className={`card p-5 hover:shadow-lg transition-all ${emp.status === 'inactive' ? 'opacity-60' : ''}`}>
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold flex-shrink-0 ${emp.role === 'super_admin' ? 'bg-purple-100 text-purple-700' : emp.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-neutral-100 text-neutral-600'}`}>
                  {emp.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-bold text-neutral-900">{emp.name}</p>
                    <RoleBadge role={emp.role} />
                    {emp.status !== 'active' && <StatusBadge status={emp.status} />}
                  </div>
                  <p className="text-xs text-neutral-500 mb-1">{emp.email}</p>
                  {emp.department && <p className="text-xs text-neutral-400">{emp.department}</p>}
                  {emp.startDate && <p className="text-xs text-neutral-400">Since {fmt(emp.startDate)}</p>}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {PERMS.filter(([k]) => emp.permissions?.[k]).map(([k, l]) => (
                      <span key={k} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">{l}</span>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => openEdit(emp)} className="btn btn-secondary p-1.5"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => del(emp._id, emp.name)} className="btn btn-secondary p-1.5 text-red-500 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="px-6 py-5 border-b flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="font-bold text-neutral-900">{editing ? 'Edit Employee' : 'New Employee'}</h3>
                <p className="text-xs text-neutral-500 mt-0.5">{editing ? 'Update team member details' : 'Add a new team member'}</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-neutral-100 rounded-lg"><X className="w-4 h-4 text-neutral-400" /></button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1.5">Full Name *</label>
                  <input className="input w-full text-sm" placeholder="Jane Smith" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1.5">Email *</label>
                  <input type="email" className="input w-full text-sm" placeholder="jane@company.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1.5">Role</label>
                  <select className="input w-full text-sm" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                    {ROLES.map(r => <option key={r} value={r}>{r.replace('_', ' ')}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1.5">Status</label>
                  <select className="input w-full text-sm" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                    {['active', 'inactive', 'suspended'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1.5">Department</label>
                  <input className="input w-full text-sm" placeholder="Engineering" value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1.5">Phone</label>
                  <input className="input w-full text-sm" placeholder="+1 555 000 0000" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1.5">Start Date</label>
                  <input type="date" className="input w-full text-sm" value={form.startDate ? new Date(form.startDate).toISOString().slice(0, 10) : ''} onChange={e => setForm(f => ({ ...f, startDate: e.target.value || undefined }))} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-neutral-600 mb-1.5">
                    {editing ? 'New Password' : 'Password *'}
                    {editing && <span className="text-neutral-400 font-normal ml-1">(leave blank to keep existing)</span>}
                  </label>
                  <input type="password" className="input w-full text-sm" placeholder={editing ? 'Leave blank to keep current' : 'Set login password'} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
                  <p className="text-xs text-neutral-400 mt-1">Employees log in at the admin page using their email + this password.</p>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1.5">Notes</label>
                <textarea className="input w-full text-sm resize-none" rows={2} placeholder="Internal notes..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-2">Permissions</label>
                <div className="grid grid-cols-2 gap-2">
                  {PERMS.map(([k, l]) => (
                    <label key={k} className="flex items-center gap-2.5 p-2.5 rounded-lg border border-neutral-200 cursor-pointer hover:bg-neutral-50 transition-colors">
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${form.permissions[k] ? 'bg-neutral-900 border-neutral-900' : 'border-neutral-300'}`}>
                        {form.permissions[k] && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><polyline points="2 6 5 9 10 3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                      </div>
                      <input type="checkbox" className="sr-only" checked={form.permissions[k]} onChange={e => setForm(f => ({ ...f, permissions: { ...f.permissions, [k]: e.target.checked } }))} />
                      <span className="text-xs text-neutral-700">{l}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t flex gap-3 flex-shrink-0">
              <button onClick={() => setShowModal(false)} className="flex-1 btn btn-secondary text-sm">Cancel</button>
              <button onClick={save} disabled={saving} className="flex-1 btn bg-neutral-900 hover:bg-neutral-800 text-white text-sm gap-2 disabled:opacity-50">
                {saving ? <span className="spinner w-4 h-4 border-2 border-white/30 border-t-white" /> : <Save className="w-4 h-4" />}
                {editing ? 'Update' : 'Create'} Employee
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORGANIZERS PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function OrganizersPanel() {
  const [organizers, setOrganizers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { adminAPI.getOrganizers().then(r => setOrganizers(r.data.organizers || [])).catch(() => toast.error('Failed')).finally(() => setLoading(false)); }, []);

  const filtered = organizers.filter(o => !search || o.email?.toLowerCase().includes(search.toLowerCase()) || o.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div><h2 className="text-lg font-bold">All Organizers</h2><p className="text-sm text-neutral-500">{organizers.length} unique organizers across all events</p></div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input type="text" placeholder="Search organizers..." className="input pl-10 text-sm" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {loading ? <div className="flex justify-center py-12"><div className="spinner w-6 h-6 border-2 border-neutral-300 border-t-neutral-600" /></div> : (
        <div className="card overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  {['Organizer', 'Events', 'Active', 'Participants', 'First Event', 'Last Event', 'Enterprise'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="px-5 py-16 text-center text-sm text-neutral-400">No organizers found</td></tr>
                ) : filtered.map(o => (
                  <tr key={o.email} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold flex-shrink-0">{o.name?.charAt(0)?.toUpperCase() || '?'}</div>
                        <div><p className="text-sm font-medium text-neutral-900">{o.name}</p><p className="text-xs text-neutral-400">{o.email}</p></div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm font-bold text-neutral-900">{o.totalEvents}</td>
                    <td className="px-5 py-4"><span className={`text-sm font-bold ${o.activeEvents > 0 ? 'text-emerald-600' : 'text-neutral-400'}`}>{o.activeEvents}</span></td>
                    <td className="px-5 py-4 text-sm text-neutral-700">{formatNumber(o.totalParticipants)}</td>
                    <td className="px-5 py-4 text-xs text-neutral-500">{rel(o.firstEvent)}</td>
                    <td className="px-5 py-4 text-xs text-neutral-500">{rel(o.lastEvent)}</td>
                    <td className="px-5 py-4">{o.isEnterprise ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full"><Zap className="w-3 h-3" /> Yes</span> : <span className="text-xs text-neutral-400">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STAFF PANEL (all staff across all events)
// ═══════════════════════════════════════════════════════════════════════════════
function StaffPanel() {
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { adminAPI.getAllStaff().then(r => setStaff(r.data.staff || [])).catch(() => toast.error('Failed')).finally(() => setLoading(false)); }, []);

  const filtered = staff.filter(s => !search || s.username?.toLowerCase().includes(search.toLowerCase()) || s.eventTitle?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div><h2 className="text-lg font-bold">All Staff Accounts</h2><p className="text-sm text-neutral-500">{staff.length} staff accounts across all events</p></div>
        <div className="relative"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" /><input type="text" placeholder="Search staff..." className="input pl-10 text-sm" value={search} onChange={e => setSearch(e.target.value)} /></div>
      </div>

      {loading ? <div className="flex justify-center py-12"><div className="spinner w-6 h-6 border-2 border-neutral-300 border-t-neutral-600" /></div> : (
        <div className="card overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>{['Staff Account', 'Event', 'Role', 'Last Seen', 'Has PIN'].map(h => <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.length === 0 ? <tr><td colSpan={5} className="px-5 py-12 text-center text-sm text-neutral-400">No staff found</td></tr> : filtered.map(s => (
                  <tr key={s._id} className="hover:bg-neutral-50">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center text-sm font-bold">{s.username?.charAt(0)?.toUpperCase()}</div>
                        <p className="text-sm font-medium">{s.username}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm text-neutral-800">{s.eventTitle}</p>
                      <p className="text-xs text-neutral-400 font-mono">/{s.eventSubdomain}</p>
                    </td>
                    <td className="px-5 py-4"><span className="text-xs bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full font-semibold">{s.role}</span></td>
                    <td className="px-5 py-4 text-xs text-neutral-500">{s.lastSeenAt ? rel(s.lastSeenAt) : 'Never'}</td>
                    <td className="px-5 py-4">{s.hasPassword ? <span className="text-emerald-500">✓</span> : <span className="text-neutral-300">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ALL USERS PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function AllUsersPanel() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');

  const load = async (p = page, q = search) => {
    setLoading(true);
    try { const r = await adminAPI.getAllParticipants({ page: p, limit: 50, search: q || undefined }); setUsers(r.data.participants || []); setTotal(r.data.total || 0); setPages(r.data.pages || 1); }
    catch { toast.error('Failed'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(1, search); setPage(1); }, [search]);
  useEffect(() => { load(page, search); }, [page]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div><h2 className="text-lg font-bold">All Users / Participants</h2><p className="text-sm text-neutral-500">{formatNumber(total)} total participants across all events</p></div>
        <div className="relative"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" /><input type="text" placeholder="Search by username..." className="input pl-10 text-sm" value={search} onChange={e => setSearch(e.target.value)} /></div>
      </div>

      {loading ? <div className="flex justify-center py-12"><div className="spinner w-6 h-6 border-2 border-neutral-300 border-t-neutral-600" /></div> : (
        <div className="card overflow-hidden shadow-lg">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>{['User', 'Event', 'Joined', 'RSVP', 'Password', 'RSVP Status'].map(h => <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {users.length === 0 ? <tr><td colSpan={6} className="px-5 py-12 text-center text-sm text-neutral-400">No users found</td></tr> : users.map(u => (
                  <tr key={u._id} className="hover:bg-neutral-50">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">{u.username?.charAt(0)?.toUpperCase()}</div>
                        <p className="text-sm font-medium">{u.username}</p>
                      </div>
                    </td>
                    <td className="px-5 py-3"><p className="text-sm text-neutral-800">{u.eventTitle}</p><p className="text-xs text-neutral-400 font-mono">/{u.eventSubdomain}</p></td>
                    <td className="px-5 py-3 text-xs text-neutral-500">{rel(u.joinedAt)}</td>
                    <td className="px-5 py-3">{u.rsvp ? <StatusBadge status={u.rsvp.status} /> : <span className="text-xs text-neutral-300">—</span>}</td>
                    <td className="px-5 py-3">{u.hasPassword ? <Lock className="w-3.5 h-3.5 text-amber-500" /> : <span className="text-neutral-300 text-xs">—</span>}</td>
                    <td className="px-5 py-3 text-xs text-neutral-500">{u.rsvp?.status || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="px-5 py-3 border-t bg-neutral-50 flex items-center justify-between">
              <p className="text-sm text-neutral-500">Page {page} of {pages} · {formatNumber(total)} total</p>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn btn-secondary text-sm py-1.5 disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
                <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} className="btn btn-secondary text-sm py-1.5 disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYTICS PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function AnalyticsPanel({ stats }) {
  const [exportStats, setExportStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { adminAPI.exportStats().then(r => setExportStats(r.data)).catch(() => {}).finally(() => setLoading(false)); }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">Analytics & Insights</h2>
        <p className="text-sm text-neutral-500">Platform-wide statistics and trends</p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Events" value={stats.totalEvents} sub={`${stats.activeEvents} active`} icon={Calendar} color="blue" />
          <StatCard label="Total Participants" value={stats.totalParticipants} sub={`avg ${stats.averageParticipantsPerEvent}/event`} icon={Users} color="emerald" />
          <StatCard label="Total Messages" value={stats.totalMessages} sub={`${stats.totalPolls} polls`} icon={MessageSquare} color="violet" />
          <StatCard label="Storage Used" value={formatFileSize(stats.totalStorage || 0)} sub={`${stats.totalFiles} files`} icon={HardDrive} color="amber" />
          <StatCard label="Last 24h Events" value={stats.recentEvents} sub="new events created" icon={TrendingUp} color="rose" />
          <StatCard label="Avg/Event" value={stats.averageParticipantsPerEvent} sub="participants avg" icon={BarChart2} color="cyan" />
        </div>
      )}

      {loading ? <div className="flex justify-center py-8"><div className="spinner w-6 h-6 border-2 border-neutral-300 border-t-neutral-600" /></div> : exportStats && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Events by Status */}
            <div className="card p-5">
              <h3 className="text-sm font-bold text-neutral-700 mb-4">Events by Status</h3>
              {exportStats.eventsByStatus?.map(({ _id, count }) => {
                const max = Math.max(...exportStats.eventsByStatus.map(x => x.count), 1);
                const pct = Math.round((count / max) * 100);
                const colors = { active: 'bg-emerald-500', completed: 'bg-blue-500', cancelled: 'bg-red-400', draft: 'bg-neutral-300' };
                return (
                  <div key={_id} className="mb-3">
                    <div className="flex justify-between text-xs mb-1"><span className="capitalize text-neutral-600">{_id}</span><span className="font-bold">{count}</span></div>
                    <div className="h-2 bg-neutral-100 rounded-full"><div className={`h-full rounded-full ${colors[_id] || 'bg-neutral-400'}`} style={{ width: `${pct}%` }} /></div>
                  </div>
                );
              })}
            </div>

            {/* Events by Month */}
            <div className="card p-5">
              <h3 className="text-sm font-bold text-neutral-700 mb-4">Events Created (Monthly)</h3>
              <div className="flex items-end gap-1.5 h-32">
                {exportStats.eventsByMonth?.slice(0, 12).reverse().map(({ _id, count }) => {
                  const max = Math.max(...exportStats.eventsByMonth.map(x => x.count), 1);
                  const pct = (count / max) * 100;
                  return (
                    <div key={_id} className="flex-1 flex flex-col items-center gap-1" title={`${_id}: ${count}`}>
                      <div className="w-full bg-blue-500 rounded-t" style={{ height: `${Math.max(pct, 4)}%` }} />
                      <span className="text-[9px] text-neutral-400 rotate-45 origin-left">{_id?.slice(5)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Messages by day */}
          <div className="card p-5">
            <h3 className="text-sm font-bold text-neutral-700 mb-4">Messages (Last 30 Days)</h3>
            <div className="flex items-end gap-0.5 h-24">
              {exportStats.messagesByDay?.slice(0, 30).reverse().map(({ _id, count }) => {
                const max = Math.max(...exportStats.messagesByDay.map(x => x.count), 1);
                const pct = (count / max) * 100;
                return (
                  <div key={_id} className="flex-1" title={`${_id}: ${count}`}>
                    <div className="w-full bg-violet-500 rounded-sm" style={{ height: `${Math.max(pct, 2)}%`, minHeight: '2px' }} />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-neutral-400 mt-1"><span>30 days ago</span><span>Today</span></div>
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN ADMIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
// ─── Bug Reports Panel ────────────────────────────────────────────────────────
function BugReportsPanel() {
  const [reports, setReports]     = useState([]);
  const [total, setTotal]         = useState(0);
  const [counts, setCounts]       = useState({ open: 0, in_progress: 0, resolved: 0, closed: 0 });
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState({ status: '', category: '', severity: '' });
  const [selected, setSelected]   = useState(null);
  const [noteText, setNoteText]   = useState('');
  const [saving, setSaving]       = useState(false);

  async function load() {
    setLoading(true);
    try {
      const params = {};
      if (filter.status)   params.status   = filter.status;
      if (filter.category) params.category = filter.category;
      if (filter.severity) params.severity = filter.severity;
      const { data } = await bugReportAPI.getAll(params);
      setReports(data.reports || []);
      setTotal(data.total || 0);
      setCounts(data.statusCounts || {});
    } catch (err) {
      console.error('Failed to load bug reports:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [filter]);

  async function updateStatus(id, status) {
    try {
      await bugReportAPI.update(id, { status });
      setReports(r => r.map(x => x._id === id ? { ...x, status } : x));
      if (selected?._id === id) setSelected(s => ({ ...s, status }));
      // Refresh counts
      load();
    } catch (err) { console.error(err); }
  }

  async function saveNote() {
    if (!selected) return;
    setSaving(true);
    try {
      await bugReportAPI.update(selected._id, { adminNotes: noteText });
      setSelected(s => ({ ...s, adminNotes: noteText }));
      setReports(r => r.map(x => x._id === selected._id ? { ...x, adminNotes: noteText } : x));
    } catch (err) { console.error(err); }
    setSaving(false);
  }

  async function deleteReport(id) {
    if (!window.confirm('Delete this report permanently?')) return;
    try {
      await bugReportAPI.remove(id);
      setReports(r => r.filter(x => x._id !== id));
      if (selected?._id === id) setSelected(null);
      load();
    } catch (err) { console.error(err); }
  }

  function openDetail(report) {
    setSelected(report);
    setNoteText(report.adminNotes || '');
  }

  const severityColor = { low: 'emerald', medium: 'amber', high: 'orange', critical: 'red' };
  const severityLabel = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' };
  const statusColor   = { open: 'blue', in_progress: 'purple', resolved: 'emerald', closed: 'neutral' };
  const categoryLabel = { bug: 'Bug', error: 'Error', feature: 'Feature', account: 'Account', checkin: 'Check-in', other: 'Other' };

  return (
    <div className="space-y-6 py-6 px-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
            <Inbox className="w-6 h-6" /> Bug Reports
          </h2>
          <p className="text-sm text-neutral-500 mt-0.5">{total} total reports</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 text-sm border border-neutral-200 rounded-xl hover:bg-neutral-50 transition-colors">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Status count cards */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { key: 'open',        label: 'Open',        color: 'blue'    },
          { key: 'in_progress', label: 'In Progress', color: 'purple'  },
          { key: 'resolved',    label: 'Resolved',    color: 'emerald' },
          { key: 'closed',      label: 'Closed',      color: 'neutral' },
        ].map(({ key, label, color }) => (
          <button
            key={key}
            onClick={() => setFilter(f => ({ ...f, status: f.status === key ? '' : key }))}
            className={`card p-4 text-left transition-all hover:shadow-md ${filter.status === key ? `ring-2 ring-${color}-400` : ''}`}
          >
            <p className="text-xs text-neutral-500 font-medium">{label}</p>
            <p className={`text-2xl font-bold text-${color}-600`}>{counts[key] ?? 0}</p>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={filter.category}
          onChange={e => setFilter(f => ({ ...f, category: e.target.value }))}
          className="px-3 py-2 text-sm border border-neutral-200 rounded-xl bg-white focus:outline-none"
        >
          <option value="">All categories</option>
          <option value="bug">Bug</option>
          <option value="error">Error</option>
          <option value="feature">Feature</option>
          <option value="account">Account</option>
          <option value="checkin">Check-in</option>
          <option value="other">Other</option>
        </select>
        <select
          value={filter.severity}
          onChange={e => setFilter(f => ({ ...f, severity: e.target.value }))}
          className="px-3 py-2 text-sm border border-neutral-200 rounded-xl bg-white focus:outline-none"
        >
          <option value="">All severities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
        {(filter.status || filter.category || filter.severity) && (
          <button
            onClick={() => setFilter({ status: '', category: '', severity: '' })}
            className="px-3 py-2 text-xs text-neutral-500 hover:text-neutral-900 border border-dashed border-neutral-300 rounded-xl"
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="flex gap-6">
        {/* Report list */}
        <div className="flex-1 min-w-0 space-y-2">
          {loading ? (
            <div className="text-center py-16 text-neutral-400 text-sm">Loading reports…</div>
          ) : reports.length === 0 ? (
            <div className="text-center py-16 text-neutral-400 text-sm">No reports match your filters</div>
          ) : (
            reports.map(r => (
              <div
                key={r._id}
                onClick={() => openDetail(r)}
                className={`card p-4 cursor-pointer hover:shadow-md transition-all border-l-4 ${
                  r.severity === 'critical' ? 'border-l-red-500' :
                  r.severity === 'high'     ? 'border-l-orange-400' :
                  r.severity === 'medium'   ? 'border-l-amber-400' : 'border-l-emerald-400'
                } ${selected?._id === r._id ? 'ring-2 ring-neutral-900' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-${statusColor[r.status]}-100 text-${statusColor[r.status]}-700`}>
                        {r.status.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-neutral-400">{categoryLabel[r.category] || r.category}</span>
                      <span className={`text-xs font-semibold text-${severityColor[r.severity]}-600`}>
                        {severityLabel[r.severity]}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-neutral-900 truncate">{r.summary}</p>
                    <p className="text-xs text-neutral-500 mt-0.5 flex items-center gap-2">
                      <Mail className="w-3 h-3" />
                      <span className="font-medium text-neutral-700">{r.email}</span>
                      <span>·</span>
                      <span>{r.name}</span>
                      <span>·</span>
                      <span>{new Date(r.createdAt).toLocaleDateString()}</span>
                    </p>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); deleteReport(r._id); }}
                    className="text-neutral-300 hover:text-red-500 transition-colors flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Detail pane */}
        {selected && (
          <div className="w-80 flex-shrink-0">
            <div className="card p-5 sticky top-24 space-y-4">
              <div className="flex items-start justify-between">
                <h3 className="text-sm font-bold text-neutral-900 flex-1 pr-2">{selected.summary}</h3>
                <button onClick={() => setSelected(null)} className="text-neutral-400 hover:text-neutral-700">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1 text-xs">
                <div className="flex gap-2"><span className="text-neutral-400 w-16">Email</span><a href={`mailto:${selected.email}`} className="font-medium text-blue-600 underline">{selected.email}</a></div>
                <div className="flex gap-2"><span className="text-neutral-400 w-16">Name</span><span>{selected.name}</span></div>
                <div className="flex gap-2"><span className="text-neutral-400 w-16">Category</span><span>{categoryLabel[selected.category]}</span></div>
                <div className="flex gap-2"><span className="text-neutral-400 w-16">Severity</span><span className={`font-semibold text-${severityColor[selected.severity]}-600`}>{severityLabel[selected.severity]}</span></div>
                {selected.eventLink && <div className="flex gap-2"><span className="text-neutral-400 w-16">Event</span><a href={selected.eventLink} target="_blank" rel="noreferrer" className="text-blue-600 underline truncate max-w-[180px]">{selected.eventLink}</a></div>}
                {selected.browser && <div className="flex gap-2"><span className="text-neutral-400 w-16">Browser</span><span className="truncate">{selected.browser}</span></div>}
                <div className="flex gap-2"><span className="text-neutral-400 w-16">Submitted</span><span>{new Date(selected.createdAt).toLocaleString()}</span></div>
              </div>

              <div>
                <p className="text-xs font-bold text-neutral-500 mb-1 uppercase tracking-wider">Description</p>
                <p className="text-xs text-neutral-700 leading-relaxed whitespace-pre-wrap">{selected.description}</p>
              </div>

              {/* Status change */}
              <div>
                <p className="text-xs font-bold text-neutral-500 mb-1.5 uppercase tracking-wider">Status</p>
                <div className="flex flex-wrap gap-1.5">
                  {['open', 'in_progress', 'resolved', 'closed'].map(s => (
                    <button
                      key={s}
                      onClick={() => updateStatus(selected._id, s)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                        selected.status === s
                          ? `bg-${statusColor[s]}-600 text-white`
                          : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                      }`}
                    >
                      {s.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Admin notes */}
              <div>
                <p className="text-xs font-bold text-neutral-500 mb-1.5 uppercase tracking-wider">Internal Notes</p>
                <textarea
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  rows={3}
                  placeholder="Notes visible only to admins…"
                  className="w-full text-xs px-3 py-2 border border-neutral-200 rounded-xl focus:outline-none focus:border-neutral-900 resize-none"
                />
                <button
                  onClick={saveNote}
                  disabled={saving}
                  className="mt-1.5 w-full py-1.5 bg-neutral-900 text-white text-xs font-bold rounded-lg hover:bg-neutral-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? 'Saving…' : 'Save Notes'}
                </button>
              </div>

              {/* Email reporter link */}
              <a
                href={`mailto:${selected.email}?subject=Re: ${encodeURIComponent(selected.summary)}&body=Hi ${encodeURIComponent(selected.name)},%0A%0AThank you for reporting this issue. We wanted to let you know...`}
                className="flex items-center justify-center gap-2 w-full py-2 border border-neutral-200 rounded-xl text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors"
              >
                <Mail className="w-3.5 h-3.5" />
                Email Reporter
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


// ─── Command Center ───────────────────────────────────────────────────────────
// CLASSIFIED INFRASTRUCTURE INTERFACE — PALANTIR-CLASS
// ─────────────────────────────────────────────────────────────────────────────

const CC_STYLES = `
  @keyframes cc-scan    { 0%{transform:translateY(-100%)} 100%{transform:translateY(200vh)} }
  @keyframes cc-pulse-r { 0%{transform:scale(1);opacity:.7} 100%{transform:scale(2.4);opacity:0} }
  @keyframes cc-blink   { 0%,100%{opacity:1} 50%{opacity:.15} }
  .cc-scanline  { position:fixed;top:0;left:0;right:0;height:2px;background:linear-gradient(transparent,rgba(139,92,246,.12),transparent);animation:cc-scan 8s linear infinite;pointer-events:none;z-index:1 }
  .cc-grid-bg   { background-image:linear-gradient(rgba(139,92,246,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(139,92,246,.03) 1px,transparent 1px);background-size:40px 40px }
  .cc-blink     { animation:cc-blink 1.2s step-end infinite }
  .cc-mono      { font-variant-numeric:tabular-nums;font-feature-settings:"tnum" }
  .cc-glow-v    { box-shadow:0 0 0 1px rgba(139,92,246,.25),0 0 24px rgba(139,92,246,.07),inset 0 0 16px rgba(139,92,246,.02) }
  .cc-glow-r    { box-shadow:0 0 0 1px rgba(239,68,68,.35),0 0 24px rgba(239,68,68,.1) }
  .cc-glow-g    { box-shadow:0 0 0 1px rgba(34,197,94,.25),0 0 20px rgba(34,197,94,.06) }
  .cc-glow-a    { box-shadow:0 0 0 1px rgba(245,158,11,.3),0 0 20px rgba(245,158,11,.08) }
  .cc-bar       { height:3px;background:rgba(255,255,255,.05);border-radius:2px;overflow:hidden }
  .cc-bar-fill  { height:100%;border-radius:2px;transition:width .9s cubic-bezier(.4,0,.2,1) }
  .cc-tag       { display:inline-flex;align-items:center;padding:1px 7px;border-radius:3px;font-size:9px;font-weight:800;letter-spacing:.1em;text-transform:uppercase }
  .cc-tr:hover  { background:rgba(255,255,255,.022) }
  .cc-spark     { display:flex;align-items:flex-end;gap:1px }
  .cc-spark span{ flex:1;min-width:2px;border-radius:1px 1px 0 0;transition:height .3s }
`;

function CCStat({ label, value, sub, color = 'text-white', glow, onClick }) {
  return (
    <div onClick={onClick}
      className={`rounded-xl border border-white/8 bg-white/[.025] p-3.5 transition-all ${onClick ? 'cursor-pointer hover:bg-white/[.04]' : ''} ${glow || ''}`}>
      <p className="text-[10px] text-neutral-600 uppercase tracking-[.15em] font-bold mb-1.5">{label}</p>
      <p className={`text-2xl font-black cc-mono leading-none ${color}`}>{value ?? '—'}</p>
      {sub && <p className="text-[10px] text-neutral-700 mt-1.5 leading-tight">{sub}</p>}
    </div>
  );
}

function CCThreat({ score }) {
  const lvl   = score < 25 ? 'NOMINAL' : score < 50 ? 'ELEVATED' : score < 75 ? 'HIGH' : 'CRITICAL';
  const color = score < 25 ? '#22c55e' : score < 50 ? '#f59e0b' : score < 75 ? '#ef4444' : '#dc2626';
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex gap-0.5">
        {[...Array(5)].map((_, i) => (
          <div key={i} style={{ width:5, height:14, borderRadius:2, background: i < Math.ceil((score/100)*5) ? color : 'rgba(255,255,255,.08)', transition:'background .5s' }} />
        ))}
      </div>
      <span className="text-[11px] font-black tracking-widest" style={{ color }}>{lvl}</span>
    </div>
  );
}

function CCFunnel({ label, v, total, color }) {
  const pct = total > 0 ? Math.round((v / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-[11px] mb-1">
        <span className="text-neutral-500">{label}</span>
        <span className="font-bold cc-mono text-neutral-300">{(v||0).toLocaleString()} <span className="text-neutral-700">({pct}%)</span></span>
      </div>
      <div className="cc-bar"><div className="cc-bar-fill" style={{ width:`${pct}%`, background:color }} /></div>
    </div>
  );
}

function CCBar({ v, max, color }) {
  const pct = max > 0 ? Math.min(100, Math.round((v/max)*100)) : 0;
  return <div className="cc-bar"><div className="cc-bar-fill" style={{ width:`${pct}%`, background:color }} /></div>;
}

function CommandCenterPanel() {
  const [tab, setTab]           = useState('grid');
  const [live, setLive]         = useState(true);
  const [loading, setLoading]   = useState(true);
  const [refreshAt, setRefreshAt] = useState(null);

  // data
  const [fleet,    setFleet]    = useState(null);
  const [pool,     setPool]     = useState(null);
  const [db,       setDb]       = useState(null);
  const [platform, setPlatform] = useState(null);
  const [security, setSecurity] = useState(null);
  const [runtime,  setRuntime]  = useState(null);
  const [events,   setEvents]   = useState(null);

  // dispatch
  const [dTarget, setDTarget]   = useState('backend');
  const [dCmd,    setDCmd]      = useState('ping');
  const [dParams, setDParams]   = useState('');
  const [dRunning,setDRunning]  = useState(false);
  const [cmdLog,  setCmdLog]    = useState([]);

  // search
  const [sq,  setSq]   = useState('');
  const [sr,  setSr]   = useState(null);
  const [sLoading,setSLoading] = useState(false);

  // bulk
  const [bulk, setBulk] = useState(false);

  const addLog = e => setCmdLog(p => [{ ts: new Date().toISOString(), ...e }, ...p].slice(0, 300));

  const fetchAll = useCallback(async (which = ['fleet','pool','db','platform','security','runtime','events']) => {
    setLoading(true);
    const p = [];
    if (which.includes('fleet'))    p.push(adminAPI.ccGetFleet().then(r => setFleet(r.data)).catch(() => {}));
    if (which.includes('pool'))     p.push(adminAPI.ccGetEmailPool().then(r => setPool(r.data.pool)).catch(() => {}));
    if (which.includes('db'))       p.push(adminAPI.ccGetDb().then(r => setDb(r.data)).catch(() => {}));
    if (which.includes('platform')) p.push(adminAPI.ccGetPlatformMetrics().then(r => setPlatform(r.data)).catch(() => {}));
    if (which.includes('security')) p.push(adminAPI.ccGetSecurityIntel().then(r => setSecurity(r.data)).catch(() => {}));
    if (which.includes('runtime'))  p.push(adminAPI.ccGetWsStats().then(r => setRuntime(r.data)).catch(() => {}));
    if (which.includes('events'))   p.push(adminAPI.ccGetEventIntel().then(r => setEvents(r.data)).catch(() => {}));
    await Promise.allSettled(p);
    setLoading(false);
    setRefreshAt(new Date());
  }, []);

  useEffect(() => {
    fetchAll();
    let t;
    if (live) t = setInterval(() => fetchAll(['fleet','security','runtime']), 30000);
    return () => clearInterval(t);
  }, [fetchAll, live]);

  const CMDS = {
    backend: [
      { id:'ping',        label:'PING',            desc:'Round-trip liveness check' },
      { id:'stats',       label:'STATS SNAPSHOT',  desc:'Full process + memory metrics' },
      { id:'flush-logs',  label:'FLUSH LOGS',      desc:'Clear in-memory log ring-buffer' },
      { id:'gc',          label:'FORCE GC',        desc:'Trigger V8 garbage collection' },
      { id:'cache-clear', label:'CACHE CLEAR',     desc:'Redis cache flush signal' },
    ],
    router: [
      { id:'ping',                 label:'PING',            desc:'Router liveness check' },
      { id:'stats',                label:'STATS',           desc:'Router metrics + email pool' },
      { id:'flush-logs',           label:'FLUSH LOGS',      desc:'Clear router log buffer' },
      { id:'gc',                   label:'FORCE GC',        desc:'GC on router process' },
      { id:'clear-key-suspension', label:'UNSUSPEND KEYS',  desc:'Unsuspend rate-limited email keys' },
      { id:'list-backends',        label:'LIST BACKENDS',   desc:'All registered backend URLs' },
    ],
    watchdog: [
      { id:'ping',   label:'PING',        desc:'Watchdog liveness' },
      { id:'status', label:'FULL STATUS', desc:'All monitored services' },
      { id:'stats',  label:'STATS',       desc:'Watchdog process info' },
    ],
  };

  const dispatch = async () => {
    setDRunning(true);
    let params = {};
    if (dParams.trim()) {
      try { params = JSON.parse(dParams); }
      catch { toast.error('Params must be valid JSON'); setDRunning(false); return; }
    }
    const t0 = Date.now();
    try {
      const r = await adminAPI.ccCommand(dTarget, dCmd, params);
      const ms = Date.now() - t0;
      addLog({ target:dTarget, cmd:dCmd, ok:true,  result:r.data.result, ms });
      toast.success(`${dCmd} ← ${ms}ms`);
    } catch (err) {
      const ms = Date.now() - t0;
      addLog({ target:dTarget, cmd:dCmd, ok:false, error:err.response?.data?.error || err.message, ms });
      toast.error(err.response?.data?.error || 'Command failed');
    }
    setDRunning(false);
  };

  const globalSearch = async () => {
    if (sq.length < 2) return;
    setSLoading(true);
    try { const r = await adminAPI.ccGlobalSearch(sq); setSr(r.data); }
    catch { toast.error('Search failed'); }
    setSLoading(false);
  };

  const bulkOp = async (action, filter, msg) => {
    if (!confirm(msg)) return;
    setBulk(true);
    try {
      const r = await adminAPI.ccBulkEvents(action, filter);
      toast.success(`Done: ${JSON.stringify(r.data.result)}`);
      fetchAll(['events']);
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    setBulk(false);
  };

  // derived
  const online    = fleet?.services?.filter(s => s.ok).length ?? 0;
  const total     = fleet?.services?.length ?? 0;
  const threat    = security ? Math.min(100,
    (security.errLast1h > 10 ? 40 : security.errLast1h * 3) +
    (security.errSpike   ? 25 : 0) +
    ((security.failedLogins?.length || 0) > 5 ? 20 : (security.failedLogins?.length || 0) * 3) +
    (security.suspiciousParticipants?.length > 0 ? 15 : 0)
  ) : 0;

  const TABS = [
    { id:'grid',     ico:'◈', lbl:'GRID'       },
    { id:'intel',    ico:'◉', lbl:'INTEL'      },
    { id:'threat',   ico:'⚠', lbl:'THREAT'     },
    { id:'asset',    ico:'⟁', lbl:'ASSET OPS'  },
    { id:'dispatch', ico:'▶', lbl:'DISPATCH'   },
    { id:'signal',   ico:'◎', lbl:'SIGNAL'     },
    { id:'storage',  ico:'▦', lbl:'STORAGE'    },
    { id:'runtime',  ico:'◌', lbl:'RUNTIME'    },
    { id:'audit',    ico:'≡', lbl:'AUDIT'      },
  ];

  // ─── helpers ────────────────────────────────────────────────────────────────
  const Divider = ({ label }) => (
    <div className="flex items-center gap-3 my-1">
      <span className="text-[10px] font-black tracking-[.2em] text-neutral-700">{label}</span>
      <div className="flex-1 h-px bg-white/[.04]" />
    </div>
  );

  const Panel = ({ children, className = '' }) => (
    <div className={`rounded-xl border border-white/[.07] bg-white/[.022] ${className}`}>{children}</div>
  );

  const PanelHead = ({ children }) => (
    <div className="px-4 py-3 border-b border-white/[.06] flex items-center justify-between">{children}</div>
  );

  const Tag = ({ children, color = 'neutral' }) => {
    const cls = {
      neutral: 'bg-neutral-800 text-neutral-500',
      green:   'bg-emerald-900/50 text-emerald-400 border border-emerald-800/40',
      red:     'bg-red-900/50 text-red-400 border border-red-800/40',
      amber:   'bg-amber-900/40 text-amber-400 border border-amber-800/30',
      violet:  'bg-violet-900/40 text-violet-400 border border-violet-800/30',
    }[color] || 'bg-neutral-800 text-neutral-500';
    return <span className={`cc-tag ${cls}`}>{children}</span>;
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white cc-grid-bg" style={{ fontFamily:"'Fira Code','SF Mono','Cascadia Code',monospace" }}>
      <style>{CC_STYLES}</style>
      <div className="cc-scanline" />

      {/* ══ TOP BAR ══ */}
      <div className="border-b border-violet-500/[.12] bg-black/70 backdrop-blur-lg sticky top-0 z-20">
        <div className="max-w-screen-2xl mx-auto px-5 py-2.5 flex items-center justify-between gap-6">
          {/* Brand */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-7 h-7 rounded-lg border border-violet-500/40 bg-violet-600/15 flex items-center justify-center cc-glow-v">
              <Crosshair className="w-3.5 h-3.5 text-violet-400" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black tracking-[.2em] text-violet-300">PLANIT</span>
              <span className="text-[11px] text-neutral-700 tracking-widest">COMMAND</span>
              <Tag color="red">CLASSIFIED</Tag>
            </div>
          </div>

          {/* Status strip */}
          <div className="flex items-center gap-6 text-[11px]">
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${online===total && total>0?'bg-emerald-400 animate-pulse':'bg-red-500 cc-blink'}`} />
              <span className="text-neutral-600">FLEET</span>
              <span className={`font-black cc-mono ${online===total?'text-emerald-400':'text-red-400'}`}>{online}/{total}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-neutral-700">THREAT</span>
              <CCThreat score={threat} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-neutral-700">SOCKETS</span>
              <span className="font-black text-cyan-400 cc-mono">{runtime?.wsStats?.connected ?? '—'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-neutral-700">MAO</span>
              <span className="font-black text-violet-400 cc-mono">{platform?.maoCount ?? '—'}</span>
            </div>
            {refreshAt && <span className="text-neutral-800 cc-mono text-[10px]">{refreshAt.toLocaleTimeString()}</span>}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setLive(v=>!v)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-black border transition-all ${live?'bg-emerald-900/25 border-emerald-700/40 text-emerald-400':'bg-white/[.04] border-white/10 text-neutral-600'}`}>
              {live?'● LIVE':'○ PAUSED'}
            </button>
            <button onClick={() => fetchAll()} disabled={loading}
              className="px-2.5 py-1 rounded-lg border border-white/10 bg-white/[.04] hover:bg-white/[.07] text-[11px] transition-colors disabled:opacity-40 flex items-center gap-1.5 text-neutral-400">
              <RefreshCw className={`w-3 h-3 ${loading?'animate-spin':''}`} /> SYNC
            </button>
          </div>
        </div>

        {/* Tab rail */}
        <div className="max-w-screen-2xl mx-auto px-5 flex gap-0 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-3.5 py-2.5 text-[10px] font-black tracking-[.15em] border-b-2 transition-all whitespace-nowrap flex items-center gap-1.5 shrink-0
                ${tab===t.id?'border-violet-500 text-violet-300 bg-violet-500/[.04]':'border-transparent text-neutral-700 hover:text-neutral-400 hover:bg-white/[.015]'}`}>
              <span className="text-sm leading-none">{t.ico}</span>{t.lbl}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-5 py-6 space-y-5">

        {/* ═══════════════ GRID ═══════════════ */}
        {tab === 'grid' && (
          <div className="space-y-5">
            {/* Tier-1 stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
              <CCStat label="Fleet" value={`${online}/${total}`} color={online===total?'text-emerald-400':'text-red-400'} glow={online<total?'cc-glow-r':'cc-glow-g'} sub="services online" />
              <CCStat label="WS Live" value={runtime?.wsStats?.connected??'—'} color="text-cyan-400" sub="socket connections" />
              <CCStat label="Errors 1h" value={security?.errLast1h??'—'} color={security?.errSpike?'text-red-400':'text-neutral-300'} glow={security?.errSpike?'cc-glow-r':undefined} sub={security?.errSpike?'⚠ SPIKE':'nominal'} />
              <CCStat label="MAO 30d" value={platform?.maoCount??'—'} color="text-violet-400" sub={`+${platform?.newOrgsThisWeek??0} this week`} />
              <CCStat label="Events Today" value={events?.todayCount??'—'} color="text-amber-400" sub={`${events?.ystdCount??0} yesterday`} />
              <CCStat label="Abandoned" value={events?.abandonedEvents?.length??'—'} color={events?.abandonedEvents?.length>5?'text-red-400':'text-neutral-500'} sub="no check-ins" />
              <CCStat label="Config" value={runtime?`${runtime.configScore}%`:'—'} color={runtime?.configScore>=80?'text-emerald-400':'text-amber-400'} sub="env vars set" />
              <CCStat label="Flagged" value={security?.suspiciousParticipants?.length??'—'} color={security?.suspiciousParticipants?.length>0?'text-amber-400':'text-neutral-600'} sub="suspicious users" />
            </div>

            {/* Fleet cards */}
            <Divider label="NODE STATUS" />
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {loading && !fleet ? (
                [0,1,2].map(i => <div key={i} className="h-44 rounded-xl bg-white/[.03] animate-pulse" />)
              ) : fleet?.services?.map(svc => {
                const ok  = svc.ok;
                const mem = svc.memMB ? Math.round((svc.memMB.heapUsed/(svc.memMB.heapTotal||1))*100) : 0;
                return (
                  <Panel key={svc.service} className={ok?'cc-glow-g border-emerald-900/40':'cc-glow-r border-red-900/40'}>
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${ok?'bg-emerald-400 animate-pulse':'bg-red-500 cc-blink'}`} />
                          <span className="text-sm font-black tracking-wider">{svc.service?.toUpperCase()}</span>
                          <Tag>{svc.type}</Tag>
                        </div>
                        <span className={`text-[11px] font-black tracking-widest ${ok?'text-emerald-400':'text-red-400'}`}>{ok?'ONLINE':'OFFLINE'}</span>
                      </div>
                      {!ok && <p className="text-xs text-red-500/70 mb-2">{svc.error||'unreachable'}</p>}
                      {ok && (
                        <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                          {svc.uptime   != null && <div className="bg-white/[.03] rounded-lg p-2"><p className="text-neutral-700 mb-0.5">UPTIME</p><p className="font-bold text-neutral-300 cc-mono">{fmtUptime(svc.uptime)}</p></div>}
                          {svc.pid      != null && <div className="bg-white/[.03] rounded-lg p-2"><p className="text-neutral-700 mb-0.5">PID</p><p className="font-bold text-neutral-300 cc-mono">{svc.pid}</p></div>}
                          {svc.node              && <div className="bg-white/[.03] rounded-lg p-2"><p className="text-neutral-700 mb-0.5">NODE</p><p className="font-bold text-neutral-300 cc-mono">{svc.node}</p></div>}
                          {svc.errors24h!= null  && <div className="bg-white/[.03] rounded-lg p-2"><p className="text-neutral-700 mb-0.5">ERR/24H</p><p className={`font-black cc-mono ${svc.errors24h>0?'text-red-400':'text-emerald-400'}`}>{svc.errors24h}</p></div>}
                          {svc.liveClients!=null && <div className="bg-white/[.03] rounded-lg p-2"><p className="text-neutral-700 mb-0.5">SSE</p><p className="font-bold text-neutral-300 cc-mono">{svc.liveClients}</p></div>}
                          {svc.backends  !=null  && <div className="bg-white/[.03] rounded-lg p-2"><p className="text-neutral-700 mb-0.5">NODES</p><p className="font-bold text-neutral-300 cc-mono">{svc.backends}</p></div>}
                          {svc.memMB && (
                            <div className="col-span-3 bg-white/[.03] rounded-lg p-2">
                              <div className="flex justify-between mb-1.5"><span className="text-neutral-700">HEAP</span><span className="text-neutral-400 cc-mono">{svc.memMB.heapUsed}/{svc.memMB.heapTotal} MB ({mem}%)</span></div>
                              <CCBar v={mem} max={100} color={mem>85?'#ef4444':mem>65?'#f59e0b':'#22c55e'} />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </Panel>
                );
              })}
            </div>

            {/* Config matrix */}
            {runtime?.config && (
              <>
                <Divider label="CONFIG MATRIX" />
                <Panel>
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[10px] text-neutral-600 tracking-widest font-bold">ENVIRONMENT COVERAGE</span>
                      <span className={`text-sm font-black cc-mono ${runtime.configScore>=80?'text-emerald-400':runtime.configScore>=50?'text-amber-400':'text-red-400'}`}>{runtime.configScore}%</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {runtime.config.map(c => (
                        <Tag key={c.key} color={c.set?'green':'red'}>{c.set?'✓':'✗'} {c.label}</Tag>
                      ))}
                    </div>
                  </div>
                </Panel>
              </>
            )}
          </div>
        )}

        {/* ═══════════════ INTEL ═══════════════ */}
        {tab === 'intel' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <CCStat label="MAO 30d" value={platform?.maoCount} color="text-violet-400" sub={`+${platform?.newOrgsThisWeek??0} this week`} />
              <CCStat label="Total Events" value={platform?.conversionFunnel?.created?.toLocaleString()} color="text-neutral-200" />
              <CCStat label="Completion" value={platform?.conversionFunnel?.created ? `${Math.round((platform.conversionFunnel.completed/platform.conversionFunnel.created)*100)}%` : '—'} color="text-cyan-400" />
              <CCStat label="WoW Growth"
                value={platform?.newOrgsLastWeek>0 ? `${Math.round(((platform.newOrgsThisWeek-platform.newOrgsLastWeek)/platform.newOrgsLastWeek)*100)}%` : `+${platform?.newOrgsThisWeek??0}`}
                color={platform?.newOrgsThisWeek>=platform?.newOrgsLastWeek?'text-emerald-400':'text-red-400'} sub="organiser growth" />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              {/* Events per day chart */}
              <Panel>
                <PanelHead><span className="text-[10px] font-black tracking-[.15em] text-neutral-600">EVENTS CREATED — 30D</span></PanelHead>
                <div className="p-4">
                  {platform?.eventsPerDay?.length ? (() => {
                    const max = Math.max(...platform.eventsPerDay.map(d=>d.count), 1);
                    return (
                      <div className="flex items-end gap-px h-24 w-full group">
                        {platform.eventsPerDay.map((d,i) => (
                          <div key={i} className="flex-1 flex flex-col items-center relative" style={{ height:'100%' }}>
                            <div className="absolute bottom-0 w-full hover:bg-violet-400 transition-colors rounded-t"
                              style={{ height:`${Math.max(4,Math.round((d.count/max)*96))}px`, background:'rgba(139,92,246,.55)' }}
                              title={`${d._id}: ${d.count}`} />
                          </div>
                        ))}
                      </div>
                    );
                  })() : <div className="h-24 flex items-center justify-center text-neutral-700 text-xs">No data</div>}
                  <div className="flex justify-between text-[10px] text-neutral-700 mt-2">
                    <span>{platform?.eventsPerDay?.[0]?._id?.slice(5)}</span>
                    <span>{platform?.eventsPerDay?.at(-1)?._id?.slice(5)}</span>
                  </div>
                </div>
              </Panel>

              {/* Conversion funnel */}
              <Panel>
                <PanelHead><span className="text-[10px] font-black tracking-[.15em] text-neutral-600">CONVERSION FUNNEL</span></PanelHead>
                <div className="p-4 space-y-3.5">
                  {platform?.conversionFunnel && (() => {
                    const { created, hasParticipants, hadCheckin, completed } = platform.conversionFunnel;
                    return [
                      { label:'Events Created',  v:created,        color:'#8b5cf6' },
                      { label:'Got Participants', v:hasParticipants,color:'#6366f1' },
                      { label:'Used Check-in',   v:hadCheckin,     color:'#06b6d4' },
                      { label:'Completed',       v:completed,      color:'#22c55e' },
                    ].map(r => <CCFunnel key={r.label} {...r} total={created} />);
                  })()}
                </div>
              </Panel>
            </div>

            {/* Feature adoption */}
            <Panel>
              <PanelHead><span className="text-[10px] font-black tracking-[.15em] text-neutral-600">FEATURE ADOPTION MATRIX</span></PanelHead>
              <div className="p-4 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
                {platform?.featureAdoption && Object.entries(platform.featureAdoption).map(([feat, { pct, count }]) => (
                  <div key={feat} className="bg-white/[.025] rounded-lg p-3 border border-white/[.05]">
                    <p className="text-[10px] text-neutral-600 uppercase tracking-widest mb-2">{feat}</p>
                    <p className="text-xl font-black cc-mono text-violet-400">{pct}%</p>
                    <p className="text-[10px] text-neutral-700 mb-2">{count} events</p>
                    <CCBar v={pct} max={100} color="#8b5cf6" />
                  </div>
                ))}
              </div>
            </Panel>

            {/* Power users */}
            <Panel>
              <PanelHead><span className="text-[10px] font-black tracking-[.15em] text-neutral-600">POWER USER REGISTRY</span></PanelHead>
              <table className="w-full text-[11px]">
                <thead><tr className="border-b border-white/[.05] bg-white/[.02]">
                  <th className="text-left px-4 py-2.5 text-neutral-600 font-semibold uppercase tracking-wider">Organiser</th>
                  <th className="text-right px-4 py-2.5 text-neutral-600 font-semibold uppercase tracking-wider">Events</th>
                  <th className="text-right px-4 py-2.5 text-neutral-600 font-semibold uppercase tracking-wider">Last Active</th>
                </tr></thead>
                <tbody>
                  {platform?.powerUsers?.map((u,i) => (
                    <tr key={u._id} className="border-b border-white/[.03] cc-tr">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-neutral-700 w-4 cc-mono">{i+1}</span>
                          <div><p className="font-bold text-neutral-300">{u.name||'—'}</p><p className="text-neutral-700 cc-mono">{u._id}</p></div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-black text-violet-400 cc-mono">{u.events}</td>
                      <td className="px-4 py-2.5 text-right text-neutral-700 cc-mono">{u.lastActive?new Date(u.lastActive).toLocaleDateString():'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>

            {/* Status distribution */}
            {platform?.eventsByStatus && (
              <Panel>
                <PanelHead><span className="text-[10px] font-black tracking-[.15em] text-neutral-600">EVENT STATUS DISTRIBUTION</span></PanelHead>
                <div className="p-4 flex flex-wrap gap-3">
                  {platform.eventsByStatus.map(s => {
                    const clr = {active:'text-emerald-400',completed:'text-blue-400',draft:'text-neutral-500',cancelled:'text-red-500'}[s._id]||'text-neutral-400';
                    return (
                      <div key={s._id} className="bg-white/[.025] rounded-lg px-4 py-2.5 border border-white/[.05]">
                        <p className={`text-xl font-black cc-mono ${clr}`}>{s.count}</p>
                        <p className="text-[10px] text-neutral-600 uppercase tracking-wider mt-1">{s._id}</p>
                      </div>
                    );
                  })}
                </div>
              </Panel>
            )}
          </div>
        )}

        {/* ═══════════════ THREAT ═══════════════ */}
        {tab === 'threat' && (
          <div className="space-y-5">
            {/* Threat header */}
            <div className={`rounded-xl border p-4 flex items-center justify-between
              ${threat>=75?'border-red-700/40 bg-red-950/15 cc-glow-r':threat>=50?'border-amber-700/30 bg-amber-950/10 cc-glow-a':'border-emerald-800/25 bg-emerald-950/8 cc-glow-g'}`}>
              <div>
                <p className="text-[10px] text-neutral-600 tracking-[.15em] font-black mb-2">CURRENT THREAT ASSESSMENT</p>
                <CCThreat score={threat} />
                <p className="text-[10px] text-neutral-700 mt-1.5">Score: {threat}/100 · Updated: {refreshAt?.toLocaleTimeString()??'—'}</p>
              </div>
              <button onClick={() => fetchAll(['security'])} className="px-3 py-1.5 border border-white/10 rounded-lg text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors font-bold tracking-wider">RESCAN</button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <CCStat label="Errors 1h" value={security?.errLast1h} color={security?.errSpike?'text-red-400':'text-neutral-300'} glow={security?.errSpike?'cc-glow-r':undefined} sub={security?.errSpike?'⚠ SPIKE DETECTED':'nominal'} />
              <CCStat label="Errors 24h" value={security?.errLast24h} color="text-neutral-500" />
              <CCStat label="Auth Failures" value={security?.failedLogins?.length} color={security?.failedLogins?.length>5?'text-red-400':'text-neutral-400'} sub="in log buffer" />
              <CCStat label="Flagged Users" value={security?.suspiciousParticipants?.length} color={security?.suspiciousParticipants?.length>0?'text-amber-400':'text-neutral-600'} sub="5+ events/24h" />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <Panel>
                <PanelHead><span className="text-[10px] font-black tracking-[.15em] text-neutral-600">TOP ERROR PATTERNS</span></PanelHead>
                <div className="divide-y divide-white/[.03]">
                  {security?.topErrors?.length ? security.topErrors.map((e,i) => (
                    <div key={i} className="px-4 py-2.5 flex items-center justify-between gap-3 cc-tr">
                      <p className="text-[11px] text-neutral-500 cc-mono flex-1 truncate">{e.msg}</p>
                      <Tag color={e.count>10?'red':'neutral'}>{e.count}×</Tag>
                    </div>
                  )) : <p className="px-4 py-4 text-[11px] text-neutral-700">No error patterns</p>}
                </div>
              </Panel>

              <Panel>
                <PanelHead><span className="text-[10px] font-black tracking-[.15em] text-neutral-600">AUTH FAILURE LOG</span></PanelHead>
                <div className="divide-y divide-white/[.03] max-h-48 overflow-y-auto">
                  {security?.failedLogins?.length ? security.failedLogins.slice(0,15).map((e,i) => (
                    <div key={i} className="px-4 py-2 flex items-center justify-between gap-2 cc-tr">
                      <p className="text-[11px] text-red-400/70 cc-mono flex-1 truncate">{e.msg}</p>
                      <span className="text-[10px] text-neutral-700 cc-mono shrink-0">{new Date(e.ts).toLocaleTimeString()}</span>
                    </div>
                  )) : <p className="px-4 py-4 text-[11px] text-neutral-700">No auth failures</p>}
                </div>
              </Panel>
            </div>

            {security?.suspiciousParticipants?.length > 0 && (
              <Panel className="border-amber-800/25 cc-glow-a">
                <PanelHead><span className="text-[10px] font-black tracking-[.15em] text-amber-500">⚠ SUSPICIOUS PARTICIPANT ACTIVITY</span></PanelHead>
                <table className="w-full text-[11px]">
                  <thead><tr className="border-b border-white/[.04] bg-white/[.02]">
                    <th className="text-left px-4 py-2 text-neutral-600 font-semibold uppercase tracking-wider">Username</th>
                    <th className="text-right px-4 py-2 text-neutral-600 font-semibold uppercase tracking-wider">Events (24h)</th>
                  </tr></thead>
                  <tbody>
                    {security.suspiciousParticipants.map((u,i) => (
                      <tr key={i} className="border-b border-white/[.03] cc-tr">
                        <td className="px-4 py-2 cc-mono text-amber-400">{u._id}</td>
                        <td className="px-4 py-2 text-right font-black text-amber-400 cc-mono">{u.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Panel>
            )}

            {security?.largeFiles?.length > 0 && (
              <Panel>
                <PanelHead><span className="text-[10px] font-black tracking-[.15em] text-neutral-600">LARGE FILE UPLOADS — TOP 10</span></PanelHead>
                <table className="w-full text-[11px]">
                  <thead><tr className="border-b border-white/[.04] bg-white/[.02]">
                    <th className="text-left px-4 py-2 text-neutral-600 font-semibold uppercase tracking-wider">File</th>
                    <th className="text-right px-4 py-2 text-neutral-600 font-semibold uppercase tracking-wider">Size</th>
                    <th className="text-right px-4 py-2 text-neutral-600 font-semibold uppercase tracking-wider">Uploaded</th>
                  </tr></thead>
                  <tbody>
                    {security.largeFiles.map((f,i) => (
                      <tr key={i} className="border-b border-white/[.03] cc-tr">
                        <td className="px-4 py-2 text-neutral-400 truncate max-w-xs">{f.name||'unnamed'}</td>
                        <td className="px-4 py-2 text-right cc-mono text-neutral-300">{f.size?`${(f.size/1048576).toFixed(1)} MB`:'—'}</td>
                        <td className="px-4 py-2 text-right text-neutral-700 cc-mono">{f.uploadedAt?new Date(f.uploadedAt).toLocaleDateString():'—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Panel>
            )}

            {security?.busyEvents?.length > 0 && (
              <Panel>
                <PanelHead><span className="text-[10px] font-black tracking-[.15em] text-neutral-600">HIGH-PARTICIPANT EVENTS</span></PanelHead>
                <table className="w-full text-[11px]">
                  <thead><tr className="border-b border-white/[.04] bg-white/[.02]">
                    <th className="text-left px-4 py-2 text-neutral-600 font-semibold uppercase tracking-wider">Event</th>
                    <th className="text-right px-4 py-2 text-neutral-600 font-semibold uppercase tracking-wider">Guests</th>
                    <th className="text-right px-4 py-2 text-neutral-600 font-semibold uppercase tracking-wider">Status</th>
                  </tr></thead>
                  <tbody>
                    {security.busyEvents.map((e,i) => (
                      <tr key={i} className="border-b border-white/[.03] cc-tr">
                        <td className="px-4 py-2">
                          <p className="font-bold text-neutral-300 truncate max-w-xs">{e.title}</p>
                          <p className="text-neutral-700 cc-mono">{e.subdomain}</p>
                        </td>
                        <td className="px-4 py-2 text-right font-black text-neutral-200 cc-mono">{e.participantCount}</td>
                        <td className="px-4 py-2 text-right"><Tag color={e.status==='active'?'green':e.status==='completed'?'violet':'neutral'}>{e.status}</Tag></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Panel>
            )}
          </div>
        )}

        {/* ═══════════════ ASSET OPS ═══════════════ */}
        {tab === 'asset' && (
          <div className="space-y-5">
            {/* Global search */}
            <Panel>
              <PanelHead><span className="text-[10px] font-black tracking-[.15em] text-neutral-600">GLOBAL ASSET SEARCH</span></PanelHead>
              <div className="p-4">
                <div className="flex gap-2 mb-4">
                  <input value={sq} onChange={e=>setSq(e.target.value)} onKeyDown={e=>e.key==='Enter'&&globalSearch()}
                    placeholder="Search participants, events, organisers across all data…"
                    className="flex-1 bg-black border border-white/10 rounded-lg px-3 py-2 text-[11px] text-neutral-200 focus:outline-none focus:border-violet-500 placeholder-neutral-800 cc-mono" />
                  <button onClick={globalSearch} disabled={sLoading||sq.length<2}
                    className="px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-[11px] font-black tracking-widest disabled:opacity-40 transition-colors flex items-center gap-2">
                    {sLoading?<><span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"/>SCANNING</> :<><Search className="w-3 h-3"/>SEARCH</>}
                  </button>
                </div>
                {sr && (
                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                    {[
                      { title:`PARTICIPANTS (${sr.participants?.length})`, items:sr.participants?.map(p=>({ h:p.username, s:`${p.eventTitle} · ${p.checkedIn?'✓ checked in':'not checked in'}` })) },
                      { title:`EVENTS (${sr.events?.length})`, items:sr.events?.map(e=>({ h:e.title, s:`${e.subdomain} · ${e.status} · ${e.participantCount} guests` })) },
                      { title:`ORGANISERS (${sr.organizers?.length})`, items:sr.organizers?.map(o=>({ h:o.name||'—', s:`${o._id} · ${o.events} events` })) },
                    ].map(({ title, items }) => (
                      <div key={title}>
                        <p className="text-[10px] font-black tracking-[.15em] text-neutral-700 mb-2">{title}</p>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {items?.length ? items.map((it,i) => (
                            <div key={i} className="bg-white/[.025] rounded-lg px-3 py-2 text-[11px]">
                              <p className="font-bold text-neutral-300">{it.h}</p>
                              <p className="text-neutral-700 cc-mono">{it.s}</p>
                            </div>
                          )) : <p className="text-neutral-700 text-[11px]">No results</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Panel>

            {/* Check-in velocity */}
            {events?.activeVelocity?.length > 0 && (
              <Panel>
                <PanelHead><span className="text-[10px] font-black tracking-[.15em] text-neutral-600">LIVE CHECK-IN VELOCITY</span></PanelHead>
                <div className="divide-y divide-white/[.03]">
                  {events.activeVelocity.map((e,i) => (
                    <div key={i} className="px-4 py-3 flex items-center gap-4 cc-tr">
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-neutral-300 truncate">{e.title}</p>
                        <p className="text-[10px] text-neutral-700 cc-mono">{e.subdomain}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[11px] font-black text-emerald-400 cc-mono">{e.checkedIn}/{e.total}</p>
                        <p className="text-[10px] text-neutral-700">{e.pct}%</p>
                      </div>
                      <div className="w-20 shrink-0">
                        <CCBar v={e.pct} max={100} color="#22c55e" />
                        {e.last5min>0 && <p className="text-[10px] text-emerald-400 cc-mono mt-1">{e.last5min}/5min ↑</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            )}

            {/* Abandoned events */}
            {events?.abandonedEvents?.length > 0 && (
              <Panel className="border-amber-800/20 cc-glow-a">
                <PanelHead>
                  <span className="text-[10px] font-black tracking-[.15em] text-amber-500">ABANDONED EVENTS ({events.abandonedEvents.length})</span>
                  <button onClick={() => bulkOp('cancel-abandoned',{},'Cancel all abandoned events?')} disabled={bulk}
                    className="text-[11px] px-3 py-1 border border-amber-700/40 rounded-lg text-amber-500 hover:bg-amber-900/20 transition-colors font-black disabled:opacity-40">
                    BULK CANCEL
                  </button>
                </PanelHead>
                <div className="divide-y divide-white/[.03] max-h-52 overflow-y-auto">
                  {events.abandonedEvents.slice(0,20).map((e,i) => (
                    <div key={i} className="px-4 py-2.5 flex items-center justify-between gap-3 cc-tr">
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold text-neutral-400 truncate">{e.title}</p>
                        <p className="text-[10px] text-neutral-700 cc-mono">{e.organizerEmail}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] text-neutral-600 cc-mono">{e.date?new Date(e.date).toLocaleDateString():'—'}</p>
                        <p className="text-[10px] text-neutral-800">{e.participantCount} guests</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            )}

            {/* Bulk ops */}
            <Panel>
              <PanelHead><span className="text-[10px] font-black tracking-[.15em] text-neutral-600">BULK OPERATION CONSOLE</span></PanelHead>
              <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { action:'force-complete-old',  label:'FORCE-COMPLETE OLD',   desc:'Mark active/draft events >7 days past as completed', filter:{days:7}, color:'border-blue-700/40 text-blue-400',  confirm:'Force-complete all stale active events?' },
                  { action:'delete-empty-drafts', label:'DELETE EMPTY DRAFTS',  desc:'Delete draft events >3 days old with zero guests',   filter:{days:3}, color:'border-red-700/40 text-red-400',    confirm:'Delete all empty draft events? Cannot be undone.' },
                  { action:'cancel-abandoned',    label:'CANCEL ABANDONED',     desc:'Cancel active events past their date, no check-ins', filter:{},       color:'border-amber-700/40 text-amber-400', confirm:'Cancel all abandoned events?' },
                ].map(op => (
                  <div key={op.action} className={`rounded-xl border ${op.color} bg-white/[.02] p-3.5`}>
                    <p className="text-[11px] font-black tracking-wider mb-1">{op.label}</p>
                    <p className="text-[10px] text-neutral-600 mb-3 leading-relaxed">{op.desc}</p>
                    <button onClick={() => bulkOp(op.action, op.filter, op.confirm)} disabled={bulk}
                      className="w-full py-1.5 border border-current rounded-lg text-[11px] font-black tracking-wider disabled:opacity-40 hover:bg-white/[.04] transition-colors">
                      {bulk?'EXECUTING…':'EXECUTE'}
                    </button>
                  </div>
                ))}
              </div>
            </Panel>

            {/* Cleanup preview */}
            {events?.cleanupCandidates?.length > 0 && (
              <Panel>
                <PanelHead><span className="text-[10px] font-black tracking-[.15em] text-neutral-600">CLEANUP PREVIEW — {events.cleanupCandidates.length} CANDIDATES</span></PanelHead>
                <div className="divide-y divide-white/[.03] max-h-40 overflow-y-auto">
                  {events.cleanupCandidates.map((e,i) => (
                    <div key={i} className="px-4 py-2 flex items-center justify-between cc-tr">
                      <p className="text-[11px] text-neutral-600 truncate">{e.title}</p>
                      <span className="text-[10px] text-neutral-700 cc-mono shrink-0">{new Date(e.updatedAt).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </Panel>
            )}
          </div>
        )}

        {/* ═══════════════ DISPATCH ═══════════════ */}
        {tab === 'dispatch' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <Panel>
              <PanelHead>
                <span className="text-[10px] font-black tracking-[.15em] text-neutral-500 flex items-center gap-2"><Terminal className="w-3.5 h-3.5 text-violet-400"/>COMMAND DISPATCH</span>
              </PanelHead>
              <div className="p-4 space-y-4">
                <div>
                  <p className="text-[10px] text-neutral-700 tracking-widest uppercase mb-2 font-bold">Target Node</p>
                  <div className="grid grid-cols-3 gap-2">
                    {['backend','router','watchdog'].map(t => (
                      <button key={t} onClick={()=>{setDTarget(t);setDCmd(CMDS[t][0].id);}}
                        className={`py-2 rounded-lg text-[11px] font-black uppercase tracking-widest transition-all ${dTarget===t?'bg-violet-600 text-white':'bg-white/[.04] text-neutral-600 hover:bg-white/[.07] border border-white/[.07]'}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-neutral-700 tracking-widest uppercase mb-2 font-bold">Command</p>
                  <div className="space-y-1.5">
                    {CMDS[dTarget].map(cmd => (
                      <button key={cmd.id} onClick={()=>setDCmd(cmd.id)}
                        className={`w-full text-left p-3 rounded-xl transition-colors ${dCmd===cmd.id?'bg-violet-900/40 border border-violet-500/30':'bg-white/[.025] hover:bg-white/[.05] border border-transparent'}`}>
                        <p className="text-[11px] font-black text-neutral-200 tracking-wider">{cmd.label}</p>
                        <p className="text-[10px] text-neutral-600 mt-0.5">{cmd.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-neutral-700 tracking-widest uppercase mb-2 font-bold">Params <span className="normal-case font-normal text-neutral-800">(optional JSON)</span></p>
                  <textarea value={dParams} onChange={e=>setDParams(e.target.value)} rows={3}
                    placeholder='{ "provider": "brevo" }'
                    className="w-full bg-black border border-white/[.08] rounded-xl px-3 py-2.5 text-[11px] cc-mono text-neutral-300 resize-none focus:outline-none focus:border-violet-500 placeholder-neutral-800" />
                </div>
                <button onClick={dispatch} disabled={dRunning}
                  className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-sm font-black tracking-widest flex items-center justify-center gap-2 transition-colors disabled:opacity-40">
                  {dRunning?<><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>EXECUTING</>:<><Play className="w-4 h-4"/>EXECUTE</>}
                </button>
              </div>
            </Panel>

            <div className="space-y-4">
              {/* Last result */}
              <div className="rounded-xl bg-black border border-white/[.06] p-4 flex-1">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[10px] font-black tracking-widest text-neutral-700">OUTPUT</p>
                  {cmdLog[0] && <span className="text-[10px] text-neutral-700 cc-mono">{cmdLog[0].ms}ms</span>}
                </div>
                {!cmdLog.length
                  ? <p className="text-[11px] text-neutral-800 cc-mono">AWAITING COMMAND…</p>
                  : <>
                    <div className="flex items-center gap-2 mb-3">
                      <Tag color={cmdLog[0].ok?'green':'red'}>{cmdLog[0].ok?'OK':'FAIL'}</Tag>
                      <span className="text-[11px] text-neutral-600 cc-mono">{cmdLog[0].target} / {cmdLog[0].cmd}</span>
                      <span className="text-[10px] text-neutral-700 cc-mono ml-auto">{new Date(cmdLog[0].ts).toLocaleTimeString()}</span>
                    </div>
                    <pre className="text-[11px] cc-mono text-neutral-300 whitespace-pre-wrap overflow-auto max-h-64">
                      {cmdLog[0].ok ? JSON.stringify(cmdLog[0].result,null,2) : cmdLog[0].error}
                    </pre>
                  </>}
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════ SIGNAL (Email Pool) ═══════════════ */}
        {tab === 'signal' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black tracking-[.15em] text-neutral-600">EMAIL SIGNAL POOL</span>
              <button onClick={() => adminAPI.ccGetEmailPool().then(r=>setPool(r.data.pool)).catch(()=>{})}
                className="px-2.5 py-1.5 border border-white/10 rounded-lg text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors flex items-center gap-1.5">
                <RefreshCw className="w-3 h-3"/> REFRESH
              </button>
            </div>
            {!pool
              ? <div className="rounded-xl bg-white/[.025] p-10 text-center text-neutral-700 text-[11px]">Email pool unavailable — ensure ROUTER_URL is configured</div>
              : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {Object.entries(pool).filter(([k])=>k!=='_summary').map(([name,p]) => (
                    <Panel key={name}>
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <p className="text-sm font-black tracking-widest text-neutral-200">{p.provider?.toUpperCase()}</p>
                            <p className="text-[10px] text-neutral-700">{p.totalKeys} key(s) · {(p.monthlyFree||0).toLocaleString()}/mo free</p>
                          </div>
                          <Tag color={p.activeKeys>0?'green':'red'}>{p.activeKeys} ACTIVE</Tag>
                        </div>
                        <div className="space-y-2">
                          {p.keys?.map(k => (
                            <div key={k.index} className={`flex items-center justify-between rounded-lg p-3 ${k.status==='active'?'bg-emerald-900/10 border border-emerald-800/20':'bg-red-900/10 border border-red-800/20'}`}>
                              <div className="flex items-center gap-2">
                                <Key className={`w-3 h-3 ${k.status==='active'?'text-emerald-400':'text-red-400'}`}/>
                                <span className="text-[11px] cc-mono text-neutral-500">{k.keySuffix}</span>
                              </div>
                              <div className="text-right text-[11px]">
                                <p className={`font-black tracking-wider ${k.status==='active'?'text-emerald-400':'text-red-400'}`}>{k.status?.toUpperCase()}</p>
                                {k.resumesAt && <p className="text-neutral-700 cc-mono">{new Date(k.resumesAt).toLocaleTimeString()}</p>}
                                <p className="text-neutral-700 cc-mono">{k.useCount} sends</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        {p.keys?.some(k=>k.status==='suspended') && (
                          <button onClick={async()=>{try{await adminAPI.ccCommand('router','clear-key-suspension',{provider:name});toast.success('Cleared');setTimeout(()=>adminAPI.ccGetEmailPool().then(r=>setPool(r.data.pool)),800);}catch{toast.error('Failed');}}}
                            className="mt-3 w-full py-2 rounded-lg border border-amber-700/40 text-[11px] font-black text-amber-400 hover:bg-amber-900/20 tracking-widest transition-colors">
                            UNSUSPEND {name.toUpperCase()} KEYS
                          </button>
                        )}
                      </div>
                    </Panel>
                  ))}
                  {pool._summary && (
                    <div className="lg:col-span-2 rounded-xl border border-violet-500/20 bg-violet-900/10 p-4 flex items-center justify-between">
                      <p className="text-[11px] text-violet-500 font-black tracking-widest">TOTAL MONTHLY FREE CAPACITY</p>
                      <p className="text-2xl font-black text-violet-300 cc-mono">{(pool._summary.totalMonthlyFree||0).toLocaleString()} emails/mo</p>
                    </div>
                  )}
                </div>
              )}
          </div>
        )}

        {/* ═══════════════ STORAGE (DB Inspector) ═══════════════ */}
        {tab === 'storage' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black tracking-[.15em] text-neutral-600">DATABASE STORAGE MATRIX</span>
              <button onClick={()=>adminAPI.ccGetDb().then(r=>setDb(r.data)).catch(()=>{})}
                className="px-2.5 py-1.5 border border-white/10 rounded-lg text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors flex items-center gap-1.5">
                <RefreshCw className="w-3 h-3"/> REFRESH
              </button>
            </div>
            {!db
              ? <div className="rounded-xl bg-white/[.025] p-10 text-center text-neutral-700 text-[11px]">Loading database…</div>
              : <>
                <div className="grid grid-cols-3 gap-3">
                  <CCStat label="Collections" value={db.collections?.length} />
                  <CCStat label="DB State" value={db.state?.toUpperCase()} color={db.state==='connected'?'text-emerald-400':'text-red-400'} />
                  <CCStat label="Database" value={db.dbName} color="text-violet-300" />
                </div>
                <Panel>
                  <table className="w-full text-[11px]">
                    <thead><tr className="border-b border-white/[.06] bg-white/[.025]">
                      {['Collection','Docs','Data','Indexes','Avg Doc'].map(h=>(
                        <th key={h} className={`${h==='Collection'?'text-left':'text-right'} px-4 py-3 text-neutral-600 font-semibold uppercase tracking-wider`}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {db.collections?.map(c => (
                        <tr key={c.name} className="border-b border-white/[.03] cc-tr">
                          <td className="px-4 py-2.5 cc-mono text-neutral-300">{c.name}</td>
                          <td className="px-4 py-2.5 text-right text-neutral-400 cc-mono">{(c.count||0).toLocaleString()}</td>
                          <td className="px-4 py-2.5 text-right text-neutral-400 cc-mono">{c.sizeMB} MB</td>
                          <td className="px-4 py-2.5 text-right text-neutral-600 cc-mono">{c.indexSizeMB} MB</td>
                          <td className="px-4 py-2.5 text-right text-neutral-700 cc-mono">{c.avgObjSize?`${c.avgObjSize}B`:'—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Panel>
              </>}
          </div>
        )}

        {/* ═══════════════ RUNTIME ═══════════════ */}
        {tab === 'runtime' && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <CCStat label="WS Connections" value={runtime?.wsStats?.connected??'—'} color="text-cyan-400" sub={runtime?.wsStats?.note} />
              <CCStat label="WS Rooms" value={runtime?.wsStats?.rooms??'—'} color="text-cyan-300" />
              <CCStat label="Redis Mode" value={runtime?.redisHealth?.mode?.toUpperCase()??'—'} color={runtime?.redisHealth?.connected?'text-emerald-400':'text-amber-400'} sub={runtime?.redisHealth?.pingOk?`${runtime.redisHealth.pingMs}ms`:'in-memory'} />
              <CCStat label="Config Score" value={runtime?`${runtime.configScore}%`:'—'} color={runtime?.configScore>=80?'text-emerald-400':runtime?.configScore>=50?'text-amber-400':'text-red-400'} />
            </div>

            {runtime?.process && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                <Panel>
                  <PanelHead><span className="text-[10px] font-black tracking-[.15em] text-neutral-600">PROCESS VITALS</span></PanelHead>
                  <div className="p-4 space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-[11px]">
                      {[['PID',runtime.process.pid],['NODE',runtime.process.node],['UPTIME',fmtUptime(runtime.process.uptime)],
                        ['CPU CORES',runtime.process.cpuCount],['LOAD 1m',runtime.process.loadAvg?.[0]],['LOAD 5m',runtime.process.loadAvg?.[1]]
                      ].map(([l,v]) => (
                        <div key={l} className="bg-white/[.025] rounded-lg p-2">
                          <p className="text-neutral-700 text-[10px] uppercase tracking-wider mb-0.5">{l}</p>
                          <p className="font-black text-neutral-300 cc-mono">{v??'—'}</p>
                        </div>
                      ))}
                    </div>
                    <div className="bg-white/[.025] rounded-lg p-3">
                      <div className="flex justify-between text-[11px] mb-1.5">
                        <span className="text-neutral-700">HEAP</span>
                        <span className="text-neutral-400 cc-mono">{runtime.process.memMB.heapUsed}/{runtime.process.memMB.heapTotal} MB</span>
                      </div>
                      <CCBar v={runtime.process.memMB.heapUsed} max={runtime.process.memMB.heapTotal} color="#8b5cf6" />
                    </div>
                    <div className="bg-white/[.025] rounded-lg p-3">
                      <div className="flex justify-between text-[11px] mb-1.5">
                        <span className="text-neutral-700">SYS MEM</span>
                        <span className="text-neutral-400 cc-mono">{runtime.process.totalMemMB-runtime.process.freeMemMB}/{runtime.process.totalMemMB} MB</span>
                      </div>
                      <CCBar v={runtime.process.totalMemMB-runtime.process.freeMemMB} max={runtime.process.totalMemMB} color="#06b6d4" />
                    </div>
                  </div>
                </Panel>

                {runtime.config && (
                  <Panel>
                    <PanelHead><span className="text-[10px] font-black tracking-[.15em] text-neutral-600">ENVIRONMENT CONFIG</span></PanelHead>
                    <div className="p-4 space-y-1.5">
                      {runtime.config.map(c => (
                        <div key={c.key} className={`flex items-center justify-between px-3 py-2 rounded-lg ${c.set?'bg-emerald-900/10 border border-emerald-800/20':'bg-red-900/8 border border-red-800/20'}`}>
                          <span className="text-[11px] text-neutral-400">{c.label}</span>
                          <Tag color={c.set?'green':'red'}>{c.set?'✓ SET':'✗ MISSING'}</Tag>
                        </div>
                      ))}
                    </div>
                  </Panel>
                )}
              </div>
            )}
            <button onClick={()=>fetchAll(['runtime'])} className="px-3 py-2 border border-white/10 rounded-lg text-[11px] text-neutral-600 hover:text-neutral-300 transition-colors flex items-center gap-1.5">
              <RefreshCw className="w-3 h-3"/> REFRESH RUNTIME
            </button>
          </div>
        )}

        {/* ═══════════════ AUDIT ═══════════════ */}
        {tab === 'audit' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black tracking-[.15em] text-neutral-600">COMMAND AUDIT LOG ({cmdLog.length})</span>
              {cmdLog.length>0 && <button onClick={()=>setCmdLog([])} className="text-[11px] text-neutral-700 hover:text-red-400 transition-colors">CLEAR</button>}
            </div>
            {!cmdLog.length
              ? <div className="rounded-xl bg-white/[.02] border border-white/[.04] p-14 text-center text-neutral-800 text-[11px] tracking-widest">NO COMMANDS EXECUTED THIS SESSION</div>
              : <div className="space-y-2">
                {cmdLog.map((e,i) => (
                  <div key={i} className={`rounded-xl border p-4 ${e.ok?'bg-emerald-950/8 border-emerald-800/15':'bg-red-950/8 border-red-800/15'}`}>
                    <div className="flex items-center gap-3 mb-2 text-[11px]">
                      <Tag color={e.ok?'green':'red'}>{e.ok?'OK':'FAIL'}</Tag>
                      <span className="cc-mono text-neutral-500">{e.target} / {e.cmd}</span>
                      <span className="text-neutral-700 cc-mono">{e.ms}ms</span>
                      <span className="ml-auto text-neutral-700 cc-mono">{new Date(e.ts).toLocaleTimeString()}</span>
                    </div>
                    <pre className="text-[11px] cc-mono text-neutral-600 whitespace-pre-wrap overflow-auto max-h-36">
                      {e.ok ? JSON.stringify(e.result,null,2) : e.error}
                    </pre>
                  </div>
                ))}
              </div>}
          </div>
        )}

      </div>
    </div>
  );
}




const NAV_ITEMS = [
  { id: 'dashboard',      label: 'Dashboard',      icon: Monitor },
  { id: 'events',         label: 'Events',         icon: Calendar },
  { id: 'users',          label: 'Users',          icon: Users },
  { id: 'organizers',     label: 'Organizers',     icon: Building2 },
  { id: 'staff',          label: 'Staff',          icon: UserCheck },
  { id: 'employees',      label: 'Team',           icon: Briefcase },
  { id: 'analytics',      label: 'Analytics',      icon: BarChart3 },
  { id: 'fleet',          label: 'Fleet',          icon: Rocket },
  { id: 'security',       label: 'Security',       icon: Shield },
  { id: 'marketing',      label: 'Marketing',      icon: Send },
  { id: 'system',         label: 'System',         icon: Server },
  { id: 'logs',           label: 'Logs',           icon: Terminal },
  { id: 'uptime',         label: 'Uptime',         icon: Radio },
  { id: 'reports',        label: 'Reports',        icon: Inbox },
  { id: 'command-center', label: 'Command Center', icon: Crosshair },
];

// ─── Security Panel ───────────────────────────────────────────────────────────
function SecurityPanel() {
  const [emailTest, setEmailTest]   = useState({ to: '', loading: false, result: null });
  const [emailCfg, setEmailCfg]     = useState(null);

  const handleTestEmail = async (e) => {
    e.preventDefault();
    if (!emailTest.to) return;
    setEmailTest(p => ({ ...p, loading: true, result: null }));
    try {
      await routerAPI.testEmail(emailTest.to);
      setEmailTest(p => ({ ...p, loading: false, result: { ok: true } }));
      toast.success('Test email sent — check your inbox');
    } catch (err) {
      setEmailTest(p => ({ ...p, loading: false, result: { ok: false, msg: err.response?.data?.reason || err.message } }));
      toast.error('Test email failed');
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h2 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
          <Shield className="w-5 h-5 text-indigo-600" /> Security
        </h2>
        <p className="text-sm text-neutral-500 mt-0.5">Traffic protection, email system status, and configuration reference.</p>
      </div>

      {/* Email system */}
      <div className="card p-5 space-y-4">
        <h3 className="text-sm font-bold text-neutral-700 flex items-center gap-2">
          <Mail className="w-4 h-4 text-violet-500" /> Transactional Email
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="bg-neutral-50 rounded-xl p-3">
            <p className="text-xs text-neutral-500 mb-1">Provider</p>
            <p className="font-semibold text-neutral-900">Resend (HTTP API)</p>
          </div>
          <div className="bg-neutral-50 rounded-xl p-3">
            <p className="text-xs text-neutral-500 mb-1">Daily limit per address</p>
            <p className="font-semibold text-neutral-900">3 emails / day (UTC reset)</p>
          </div>
          <div className="bg-neutral-50 rounded-xl p-3">
            <p className="text-xs text-neutral-500 mb-1">Triggers</p>
            <p className="font-semibold text-neutral-900">Create event, Guest invite, Reminder, Thank-you</p>
          </div>
          <div className="bg-neutral-50 rounded-xl p-3">
            <p className="text-xs text-neutral-500 mb-1">Counter store</p>
            <p className="font-semibold text-neutral-900">Redis (or in-memory fallback)</p>
          </div>
        </div>
        <div className="border-t border-neutral-100 pt-3">
          <p className="text-xs font-semibold text-neutral-600 mb-2">Send test email</p>
          <form onSubmit={handleTestEmail} className="flex gap-2">
            <input
              type="email"
              placeholder="recipient@example.com"
              value={emailTest.to}
              onChange={e => setEmailTest(p => ({ ...p, to: e.target.value }))}
              className="input text-sm flex-1"
              required
            />
            <button
              type="submit"
              disabled={emailTest.loading || !import.meta.env.VITE_ROUTER_URL}
              className="btn bg-violet-600 hover:bg-violet-700 text-white text-sm gap-2 disabled:opacity-50"
            >
              {emailTest.loading
                ? <span className="spinner w-4 h-4 border-2 border-white/30 border-t-white" />
                : <Send className="w-4 h-4" />}
              Send test
            </button>
          </form>
          {!import.meta.env.VITE_ROUTER_URL && (
            <p className="text-xs text-neutral-400 mt-1">VITE_ROUTER_URL is not set — cannot reach router mesh.</p>
          )}
          {emailTest.result && (
            <p className={`text-xs mt-1 font-medium ${emailTest.result.ok ? 'text-emerald-600' : 'text-red-600'}`}>
              {emailTest.result.ok ? 'Sent successfully' : `Failed: ${emailTest.result.msg}`}
            </p>
          )}
        </div>
      </div>

      {/* Traffic guard */}
      <div className="card p-5 space-y-3">
        <h3 className="text-sm font-bold text-neutral-700 flex items-center gap-2">
          <ShieldOff className="w-4 h-4 text-red-500" /> Traffic Guard
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div className="bg-neutral-50 rounded-xl p-3">
            <p className="text-xs text-neutral-500 mb-1">Detects</p>
            <p className="text-xs text-neutral-700 leading-5">Rapid identical requests, path fuzzing, known scanner user-agents, oversized payload probes</p>
          </div>
          <div className="bg-neutral-50 rounded-xl p-3">
            <p className="text-xs text-neutral-500 mb-1">Enforcement</p>
            <p className="text-xs text-neutral-700 leading-5">Progressive: warn threshold logged silently, ban threshold = temporary IP block</p>
          </div>
          <div className="bg-neutral-50 rounded-xl p-3">
            <p className="text-xs text-neutral-500 mb-1">Defaults</p>
            <p className="text-xs font-mono text-neutral-700">warn: 25 req/10s · ban: 5 warns · block: 30 min</p>
          </div>
          <div className="bg-neutral-50 rounded-xl p-3">
            <p className="text-xs text-neutral-500 mb-1">Storage</p>
            <p className="text-xs text-neutral-700">Redis (Upstash) with in-memory fallback</p>
          </div>
        </div>
        <div className="text-xs text-neutral-400 bg-neutral-50 rounded-xl p-3 space-y-0.5">
          <p className="font-semibold text-neutral-500 mb-1">Configurable env vars on each backend:</p>
          <p><code className="font-mono">SECURITY_ENABLED</code> — true / false (default: true)</p>
          <p><code className="font-mono">SECURITY_BAN_MINUTES</code> — ban duration (default: 30)</p>
          <p><code className="font-mono">SECURITY_WARN_THRESHOLD</code> — identical req count before warn (default: 25)</p>
          <p><code className="font-mono">SECURITY_BAN_THRESHOLD</code> — warn count before ban (default: 5)</p>
        </div>
      </div>

      {/* Upload scanner */}
      <div className="card p-5 space-y-3">
        <h3 className="text-sm font-bold text-neutral-700 flex items-center gap-2">
          <FileUp className="w-4 h-4 text-amber-500" /> Upload Security
        </h3>
        <p className="text-sm text-neutral-600">All file uploads are scanned before reaching Cloudinary.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="bg-neutral-50 rounded-xl p-3">
            <p className="font-semibold text-neutral-600 mb-1">Blocked extensions</p>
            <p className="font-mono text-neutral-500 leading-5">.exe .bat .sh .ps1 .php .asp .jsp .py .rb .js (as upload) .jar .dll …and 30+ more</p>
          </div>
          <div className="bg-neutral-50 rounded-xl p-3">
            <p className="font-semibold text-neutral-600 mb-1">MIME mismatch detection</p>
            <p className="text-neutral-500 leading-5">Extension vs Content-Type cross-checked. A file claiming to be a JPEG but sending HTML is rejected.</p>
          </div>
        </div>
      </div>

      {/* Redis status */}
      <div className="card p-5 space-y-3">
        <h3 className="text-sm font-bold text-neutral-700 flex items-center gap-2">
          <Database className="w-4 h-4 text-emerald-500" /> Redis (Upstash)
        </h3>
        <p className="text-sm text-neutral-600">Used for email counters, IP ban store, and rate limiting across all features.</p>
        <div className="text-xs text-neutral-400 bg-neutral-50 rounded-xl p-3 space-y-0.5">
          <p className="font-semibold text-neutral-500 mb-1">Set on each backend (and router for email counters):</p>
          <p><code className="font-mono">UPSTASH_REDIS_URL</code> — your Upstash REST endpoint</p>
          <p><code className="font-mono">UPSTASH_REDIS_TOKEN</code> — your Upstash REST token</p>
          <p className="text-neutral-400 mt-1">If not set, the system falls back to in-memory storage automatically. No crash, no error.</p>
        </div>
      </div>
    </div>
  );
}

// ─── Marketing Panel ──────────────────────────────────────────────────────────
function MarketingPanel() {
  const [templates, setTemplates]       = useState([]);
  const [selected, setSelected]         = useState('');
  const [subject, setSubject]           = useState('');
  const [ctaUrl, setCtaUrl]             = useState('https://planit.app');
  const [recipientText, setRecipientText] = useState('');
  const [sending, setSending]           = useState(false);
  const [result, setResult]             = useState(null);
  const [previewHtml, setPreviewHtml]   = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [mode, setMode]                 = useState('send'); // 'send' | 'schedule' | 'scheduled'
  const [sendAt, setSendAt]             = useState('');
  const [campaignLabel, setCampaignLabel] = useState('');
  const [scheduled, setScheduled]       = useState([]);
  const [scheduledLoading, setScheduledLoading] = useState(false);
  const [scheduling, setScheduling]     = useState(false);

  useEffect(() => {
    adminAPI.getMarketingTemplates()
      .then(r => {
        setTemplates(r.data.templates || []);
        if (r.data.templates?.length) {
          const first = r.data.templates[0];
          setSelected(first.id);
          setSubject(first.defaultSubject);
        }
      })
      .catch(() => toast.error('Could not load marketing templates'));
  }, []);

  useEffect(() => {
    if (!selected) { setPreviewHtml(''); return; }
    setPreviewLoading(true);
    const params = ctaUrl ? `?ctaUrl=${encodeURIComponent(ctaUrl)}` : '';
    api.get(`/admin/marketing/preview/${selected}${params}`, { responseType: 'text' })
      .then(r => setPreviewHtml(typeof r.data === 'string' ? r.data : JSON.stringify(r.data)))
      .catch(() => toast.error('Could not load preview'))
      .finally(() => setPreviewLoading(false));
  }, [selected, ctaUrl]);

  const loadScheduled = async () => {
    setScheduledLoading(true);
    try { const r = await adminAPI.getScheduledCampaigns(); setScheduled(r.data.scheduled || []); }
    catch { toast.error('Could not load scheduled campaigns'); }
    finally { setScheduledLoading(false); }
  };

  useEffect(() => { if (mode === 'scheduled') loadScheduled(); }, [mode]);

  const handleTemplateChange = (id) => {
    setSelected(id);
    const tpl = templates.find(t => t.id === id);
    if (tpl) setSubject(tpl.defaultSubject);
    setResult(null);
  };

  const parseRecipients = () =>
    recipientText
      .split(/[\n,;]+/)
      .map(e => e.trim().toLowerCase())
      .filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));

  const handleSend = async () => {
    const recipients = parseRecipients();
    if (!selected) return toast.error('Select a template first');
    if (recipients.length === 0) return toast.error('Enter at least one valid email address');
    if (recipients.length > 1000) return toast.error('Maximum 1,000 recipients per send');

    const confirmed = window.confirm(
      `Send "${templates.find(t => t.id === selected)?.name}" to ${recipients.length} recipient${recipients.length === 1 ? '' : 's'}?`
    );
    if (!confirmed) return;

    setSending(true);
    setResult(null);
    try {
      const r = await adminAPI.sendMarketingCampaign({
        templateId: selected,
        recipients,
        subject:    subject || undefined,
        ctaUrl:     ctaUrl  || undefined,
      });
      setResult(r.data.results);
      toast.success(`Campaign sent: ${r.data.results.sent} delivered`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Send failed');
    }
    setSending(false);
  };

  const handleSchedule = async () => {
    const recipients = parseRecipients();
    if (!selected)            return toast.error('Select a template first');
    if (recipients.length === 0) return toast.error('Enter at least one valid email address');
    if (!sendAt)              return toast.error('Select a send date and time');
    if (new Date(sendAt) <= new Date()) return toast.error('Schedule time must be in the future');

    setScheduling(true);
    try {
      await adminAPI.scheduleMarketingCampaign({
        templateId: selected,
        recipients,
        subject:    subject || undefined,
        ctaUrl:     ctaUrl  || undefined,
        sendAt:     new Date(sendAt).toISOString(),
        label:      campaignLabel || undefined,
      });
      toast.success(`Campaign scheduled for ${new Date(sendAt).toLocaleString()}`);
      setMode('scheduled');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Schedule failed');
    }
    setScheduling(false);
  };

  const cancelScheduled = async (id) => {
    if (!confirm('Cancel this scheduled campaign?')) return;
    try {
      await adminAPI.cancelScheduledCampaign(id);
      toast.success('Campaign cancelled');
      loadScheduled();
    } catch { toast.error('Cancel failed'); }
  };

  const recipientCount = parseRecipients().length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
            <Send className="w-5 h-5 text-violet-600" /> Marketing
          </h2>
          <p className="text-sm text-neutral-500 mt-0.5">Personalized outreach campaigns. One email per address per day, batched to avoid rate limits.</p>
        </div>
        <div className="flex bg-neutral-100 rounded-xl p-1 gap-1">
          {[['send','Send Now'], ['schedule','Schedule'], ['scheduled','Scheduled']].map(([id, label]) => (
            <button key={id} onClick={() => setMode(id)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${mode === id ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {mode === 'scheduled' ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-neutral-600">{scheduled.length} scheduled campaign{scheduled.length !== 1 ? 's' : ''}</p>
            <button onClick={loadScheduled} disabled={scheduledLoading} className="btn btn-secondary text-xs py-1.5 gap-1.5">
              <RefreshCw className={`w-3.5 h-3.5 ${scheduledLoading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
          {scheduled.length === 0 ? (
            <div className="card p-12 text-center">
              <p className="text-neutral-400 text-sm">No scheduled campaigns. Use the Schedule tab to queue a campaign.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {scheduled.map(job => (
                <div key={job.id} className={`card p-5 ${job.status === 'done' ? 'opacity-70' : ''}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                          job.status === 'pending' ? 'bg-blue-100 text-blue-700'
                          : job.status === 'running' ? 'bg-amber-100 text-amber-700'
                          : job.status === 'done' ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-red-100 text-red-700'
                        }`}>{job.status}</span>
                        <p className="text-sm font-semibold text-neutral-900 truncate">{job.label || job.templateId}</p>
                      </div>
                      <p className="text-xs text-neutral-500">
                        {job.recipients.length} recipients &middot; Send at {new Date(job.sendAt).toLocaleString()}
                      </p>
                      {job.results && (
                        <p className="text-xs text-emerald-600 mt-1">
                          Delivered: {job.results.sent} &middot; Skipped: {job.results.skipped} &middot; Failed: {job.results.failed}
                        </p>
                      )}
                      {job.error && <p className="text-xs text-red-500 mt-1">{job.error}</p>}
                    </div>
                    {job.status === 'pending' && (
                      <button onClick={() => cancelScheduled(job.id)} className="flex-shrink-0 text-xs text-red-500 hover:text-red-700 transition-colors font-medium">Cancel</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Left: compose */}
          <div className="space-y-4">
            <div className="card p-5">
              <h3 className="text-sm font-bold text-neutral-700 mb-3">Template</h3>
              <div className="space-y-2">
                {templates.map(tpl => (
                  <label key={tpl.id}
                    className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                      selected === tpl.id ? 'border-violet-500 bg-violet-50' : 'border-neutral-100 hover:border-neutral-200'
                    }`}>
                    <input type="radio" name="template" value={tpl.id} checked={selected === tpl.id}
                      onChange={() => handleTemplateChange(tpl.id)} className="mt-0.5 accent-violet-600" />
                    <div>
                      <p className="text-sm font-semibold text-neutral-900">{tpl.name}</p>
                      <p className="text-xs text-neutral-500 mt-0.5">{tpl.description}</p>
                    </div>
                  </label>
                ))}
                {templates.length === 0 && (
                  <div className="flex justify-center py-6">
                    <span className="spinner w-5 h-5 border-2 border-neutral-200 border-t-neutral-600" />
                  </div>
                )}
              </div>
            </div>

            <div className="card p-5 space-y-3">
              <h3 className="text-sm font-bold text-neutral-700 mb-1">Campaign Settings</h3>
              <div>
                <label className="block text-xs font-semibold text-neutral-500 mb-1">Subject line</label>
                <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
                  className="input text-sm w-full" placeholder="Default from template" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-500 mb-1">CTA button URL</label>
                <input type="url" value={ctaUrl} onChange={e => setCtaUrl(e.target.value)}
                  className="input text-sm w-full font-mono" placeholder="https://planit.app" />
              </div>
              {mode === 'schedule' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-500 mb-1">Send at (your local time)</label>
                    <input type="datetime-local" value={sendAt} onChange={e => setSendAt(e.target.value)}
                      className="input text-sm w-full" min={new Date().toISOString().slice(0, 16)} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-500 mb-1">Campaign label <span className="font-normal text-neutral-400">(optional)</span></label>
                    <input type="text" value={campaignLabel} onChange={e => setCampaignLabel(e.target.value)}
                      className="input text-sm w-full" placeholder="e.g. Q3 Planner Outreach" />
                  </div>
                </>
              )}
            </div>

            <div className="card p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-neutral-700">Recipients</h3>
                {recipientCount > 0 && (
                  <span className="text-xs font-semibold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">
                    {recipientCount.toLocaleString()} valid {recipientCount === 1 ? 'address' : 'addresses'}
                  </span>
                )}
              </div>
              <textarea value={recipientText} onChange={e => setRecipientText(e.target.value)} rows={6}
                className="input text-sm w-full font-mono resize-y"
                placeholder={"Paste email addresses here.\nOne per line, or comma/semicolon separated.\n\nExample:\njohn@example.com\njane@example.com, alex@example.com"} />
              <p className="text-xs text-neutral-400 mt-1">Maximum 1,000 recipients. Invalid addresses skipped automatically.</p>
            </div>

            <div className="card p-5">
              {mode === 'send' ? (
                <>
                  <button onClick={handleSend} disabled={sending || !selected || recipientCount === 0}
                    className="btn bg-violet-600 hover:bg-violet-700 text-white w-full gap-2 disabled:opacity-50 justify-center">
                    {sending
                      ? <><span className="spinner w-4 h-4 border-2 border-white/30 border-t-white" /> Sending campaign...</>
                      : <><Send className="w-4 h-4" /> Send to {recipientCount || 0} {recipientCount === 1 ? 'recipient' : 'recipients'}</>}
                  </button>
                  {result && (
                    <div className="mt-4 grid grid-cols-3 gap-3">
                      <div className="bg-emerald-50 rounded-xl p-3 text-center">
                        <p className="text-xl font-bold text-emerald-700">{result.sent}</p>
                        <p className="text-xs text-emerald-600 mt-0.5">Delivered</p>
                      </div>
                      <div className="bg-neutral-50 rounded-xl p-3 text-center">
                        <p className="text-xl font-bold text-neutral-600">{result.skipped}</p>
                        <p className="text-xs text-neutral-400 mt-0.5">Skipped</p>
                      </div>
                      <div className="bg-red-50 rounded-xl p-3 text-center">
                        <p className="text-xl font-bold text-red-600">{result.failed}</p>
                        <p className="text-xs text-red-400 mt-0.5">Failed</p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <button onClick={handleSchedule} disabled={scheduling || !selected || recipientCount === 0 || !sendAt}
                  className="btn bg-indigo-600 hover:bg-indigo-700 text-white w-full gap-2 disabled:opacity-50 justify-center">
                  {scheduling
                    ? <><span className="spinner w-4 h-4 border-2 border-white/30 border-t-white" /> Scheduling...</>
                    : <><Clock className="w-4 h-4" /> Schedule for {sendAt ? new Date(sendAt).toLocaleString() : '...'}</>}
                </button>
              )}
            </div>
          </div>

          {/* Right: live preview */}
          <div className="space-y-2">
            <h3 className="text-sm font-bold text-neutral-700">Live Preview</h3>
            <p className="text-xs text-neutral-400">Updates on template or CTA URL change. This is the exact email your recipients will receive.</p>
            {selected ? (
              <div className="rounded-xl border border-neutral-200 overflow-hidden relative" style={{ height: '700px' }}>
                {previewLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-neutral-50 z-10">
                    <span className="spinner w-5 h-5 border-2 border-neutral-200 border-t-violet-500" />
                  </div>
                )}
                <iframe key={selected} srcDoc={previewHtml} title="Email preview" className="w-full h-full" sandbox="allow-same-origin" />
              </div>
            ) : (
              <div className="rounded-xl border border-neutral-100 bg-neutral-50 flex items-center justify-center" style={{ height: '700px' }}>
                <p className="text-sm text-neutral-400">Select a template to see a preview</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}



// ─── Fleet Control Panel ──────────────────────────────────────────────────────
function FleetControl() {
  const [status, setStatus]         = useState(null);
  const [loading, setLoading]       = useState(true);
  const [boostForm, setBoostForm]   = useState({ durationMinutes: 60, reason: '', minBackends: '', pinnedEventIds: '' });
  const [boosting, setBoosting]     = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const load = async () => {
    try {
      const r = await routerAPI.getStatus();
      if (r?.data) setStatus(r.data);
    } catch { /* router may not be configured */ }
    setLoading(false);
  };

  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, []);

  const handleBoost = async (e) => {
    e.preventDefault();
    setBoosting(true);
    try {
      const opts = {
        durationMinutes: parseInt(boostForm.durationMinutes) || 60,
        reason:          boostForm.reason || 'Admin boost',
        minBackends:     boostForm.minBackends ? parseInt(boostForm.minBackends) : undefined,
        pinnedEventIds:  boostForm.pinnedEventIds ? boostForm.pinnedEventIds.split(',').map(s => s.trim()).filter(Boolean) : [],
      };
      await routerAPI.activateBoost(opts);
      toast.success('⚡ Boost activated');
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to activate boost');
    }
    setBoosting(false);
  };

  const handleCancelBoost = async () => {
    setCancelling(true);
    try {
      await routerAPI.cancelBoost();
      toast.success('Boost cancelled');
      load();
    } catch { toast.error('Failed to cancel boost'); }
    setCancelling(false);
  };

  if (!import.meta.env.VITE_ROUTER_URL) {
    return (
      <div className="p-8 text-center">
        <Rocket className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-neutral-700 mb-2">Router not configured</h3>
        <p className="text-sm text-neutral-500">Add <code className="bg-neutral-100 px-1 rounded">VITE_ROUTER_URL</code> and <code className="bg-neutral-100 px-1 rounded">VITE_MESH_SECRET</code> to your frontend environment variables.</p>
      </div>
    );
  }

  if (loading) return <div className="p-8 flex justify-center"><span className="spinner w-6 h-6 border-2 border-neutral-200 border-t-neutral-700" /></div>;

  if (!status) {
    return (
      <div className="p-8 text-center">
        <WifiOff className="w-12 h-12 text-red-300 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-neutral-700 mb-2">Router unreachable</h3>
        <p className="text-sm text-neutral-500">Could not connect to the router. Check VITE_ROUTER_URL and VITE_MESH_SECRET.</p>
      </div>
    );
  }

  const boost      = status.boost;
  const scaling    = status.scaling;
  const backends   = status.backends || [];
  const activeList = backends.filter(b => b.active);
  const minutesLeft = boost?.active ? Math.max(0, Math.round((new Date(boost.activeUntil) - Date.now()) / 60000)) : 0;

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-neutral-900 flex items-center gap-2"><Rocket className="w-5 h-5" /> Fleet Control</h2>
          <p className="text-sm text-neutral-500 mt-0.5">Router · {backends.length} backends · uptime {Math.floor((status.uptime || 0) / 3600)}h {Math.floor(((status.uptime || 0) % 3600) / 60)}m</p>
        </div>
        <button onClick={load} className="btn btn-secondary text-xs gap-1.5"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
      </div>

      {/* Boost banner */}
      {boost?.active && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <Zap className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-amber-900 text-sm">Boost Mode Active</p>
            <p className="text-xs text-amber-700 mt-0.5">{boost.reason} · {boost.minBackends} backends minimum · {minutesLeft}m remaining</p>
          </div>
          <button onClick={handleCancelBoost} disabled={cancelling} className="btn text-xs bg-amber-600 hover:bg-amber-700 text-white gap-1.5 disabled:opacity-60">
            {cancelling ? <span className="spinner w-3.5 h-3.5 border border-white/30 border-t-white" /> : <X className="w-3.5 h-3.5" />}
            Cancel boost
          </button>
        </div>
      )}

      {/* Fleet overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-4"><p className="text-xs text-neutral-500 mb-1">Active</p><p className="text-2xl font-bold text-neutral-900">{scaling.activeBackendCount}</p><p className="text-xs text-neutral-400">of {scaling.totalBackends} total</p></div>
        <div className="card p-4"><p className="text-xs text-neutral-500 mb-1">Tripped</p><p className={`text-2xl font-bold ${scaling.trippedCount > 0 ? 'text-red-600' : 'text-neutral-900'}`}>{scaling.trippedCount}</p><p className="text-xs text-neutral-400">circuit breakers</p></div>
        <div className="card p-4"><p className="text-xs text-neutral-500 mb-1">Avg Latency</p><p className="text-2xl font-bold text-neutral-900">{Math.round(activeList.filter(b => b.latencyMs).reduce((s, b) => s + b.latencyMs, 0) / Math.max(1, activeList.filter(b => b.latencyMs).length)) || '—'}<span className="text-sm font-normal text-neutral-400">ms</span></p><p className="text-xs text-neutral-400">active backends</p></div>
        <div className="card p-4"><p className="text-xs text-neutral-500 mb-1">Boost</p><p className={`text-2xl font-bold ${boost?.active ? 'text-amber-600' : 'text-neutral-400'}`}>{boost?.active ? 'ON' : 'OFF'}</p><p className="text-xs text-neutral-400">{boost?.active ? `${minutesLeft}m left` : 'auto-scaling'}</p></div>
      </div>

      {/* Backend cards */}
      <div>
        <h3 className="text-sm font-bold text-neutral-700 mb-3 flex items-center gap-2"><Server className="w-4 h-4" /> Backends</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {backends.map(b => (
            <div key={b.index} className={`card p-4 border-2 transition-colors ${b.circuitTripped ? 'border-red-200 bg-red-50' : b.active ? 'border-emerald-200 bg-emerald-50' : 'border-neutral-100'}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-sm text-neutral-900">{b.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${b.circuitTripped ? 'bg-red-100 text-red-700' : b.active ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}`}>
                  {b.circuitTripped ? 'tripped' : b.active ? 'active' : 'standby'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-neutral-600">
                <span>Latency</span><span className="font-mono font-medium">{b.latencyMs ? `${b.latencyMs}ms` : '—'}</span>
                <span>Requests</span><span className="font-mono font-medium">{(b.requests || 0).toLocaleString()}</span>
                <span>Sockets</span><span className="font-mono font-medium">{b.socketConnections || 0}</span>
                {b.memoryPct != null && <><span>Memory</span><span className="font-mono font-medium">{b.memoryPct}%</span></>}
                {b.coldStart && <><span className="col-span-2 text-amber-600 font-medium">⚠ Cold starting</span></>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Boost form */}
      {!boost?.active && (
        <div className="card p-5">
          <h3 className="text-sm font-bold text-neutral-700 mb-1 flex items-center gap-2"><Zap className="w-4 h-4 text-amber-500" /> Activate Boost Mode</h3>
          <p className="text-xs text-neutral-500 mb-4">Instantly expand the fleet and lock it at full capacity for a set period. Use before large events, announcements, or expected traffic spikes.</p>
          <form onSubmit={handleBoost} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Duration (minutes)</label>
              <input type="number" min="5" max="1440" value={boostForm.durationMinutes}
                onChange={e => setBoostForm(p => ({ ...p, durationMinutes: e.target.value }))}
                className="input text-sm" placeholder="60" />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Min backends to hold active</label>
              <input type="number" min="1" max={backends.length} value={boostForm.minBackends}
                onChange={e => setBoostForm(p => ({ ...p, minBackends: e.target.value }))}
                className="input text-sm" placeholder={`${backends.length} (all)`} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-neutral-600 mb-1">Reason (shown in logs)</label>
              <input type="text" value={boostForm.reason}
                onChange={e => setBoostForm(p => ({ ...p, reason: e.target.value }))}
                className="input text-sm" placeholder="e.g. Saturday conference, product launch" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-neutral-600 mb-1">Pin specific event IDs to backend 0 <span className="text-neutral-400 font-normal">(comma-separated, optional)</span></label>
              <input type="text" value={boostForm.pinnedEventIds}
                onChange={e => setBoostForm(p => ({ ...p, pinnedEventIds: e.target.value }))}
                className="input text-sm font-mono" placeholder="64abc123..., 64def456..." />
              <p className="text-xs text-neutral-400 mt-1">Pinned events always route to backend 0, guaranteed active during boost. Other events distribute across the full fleet.</p>
            </div>
            <div className="sm:col-span-2">
              <button type="submit" disabled={boosting} className="btn bg-amber-500 hover:bg-amber-600 text-white gap-2 disabled:opacity-60">
                {boosting ? <><span className="spinner w-4 h-4 border-2 border-white/30 border-t-white" /> Activating...</> : <><Zap className="w-4 h-4" /> Activate Boost</>}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Scaling log */}
      {status.scalingLog?.length > 0 && (
        <div className="card p-4">
          <h3 className="text-sm font-bold text-neutral-700 mb-3 flex items-center gap-2"><Activity className="w-4 h-4" /> Recent Scaling Events</h3>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {status.scalingLog.map((e, i) => (
              <div key={i} className="flex items-start gap-3 text-xs">
                <span className="text-neutral-400 font-mono flex-shrink-0 w-36">{new Date(e.time).toLocaleTimeString()}</span>
                <span className="font-medium text-neutral-800">{e.action}</span>
                <span className="text-neutral-500 truncate">{e.reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Predictive scaling state (Holt-Winters) */}
      {scaling?.predictive && (
        <div className="card p-4">
          <h3 className="text-sm font-bold text-neutral-700 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-500" /> Predictive Scaling (Holt-Winters)
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
            <div className="bg-neutral-50 rounded-xl p-3">
              <p className="text-xs text-neutral-500 mb-1">Smoothed Level</p>
              <p className="text-xl font-bold text-neutral-900">{scaling.predictive.level}</p>
              <p className="text-xs text-neutral-400">req/window</p>
            </div>
            <div className="bg-neutral-50 rounded-xl p-3">
              <p className="text-xs text-neutral-500 mb-1">Trend</p>
              <p className={`text-xl font-bold ${scaling.predictive.trend > 0 ? 'text-amber-600' : scaling.predictive.trend < 0 ? 'text-emerald-600' : 'text-neutral-900'}`}>
                {scaling.predictive.trend > 0 ? '+' : ''}{scaling.predictive.trend}
              </p>
              <p className="text-xs text-neutral-400">per window</p>
            </div>
            <div className="bg-neutral-50 rounded-xl p-3">
              <p className="text-xs text-neutral-500 mb-1">Forecast</p>
              <p className={`text-xl font-bold ${scaling.predictive.forecast >= scaling.thresholds.scaleUp * (scaling.predictive.headroom || 0.85) ? 'text-amber-600' : 'text-neutral-900'}`}>
                {scaling.predictive.forecast}
              </p>
              <p className="text-xs text-neutral-400">next window</p>
            </div>
            <div className="bg-neutral-50 rounded-xl p-3">
              <p className="text-xs text-neutral-500 mb-1">Ramp Windows</p>
              <p className={`text-xl font-bold ${scaling.predictive.rampCount >= 3 ? 'text-red-500' : 'text-neutral-900'}`}>
                {scaling.predictive.rampCount}
              </p>
              <p className="text-xs text-neutral-400">consecutive rise</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <span>History: {scaling.predictive.historyLen}/30 windows</span>
            <span className="text-neutral-300">·</span>
            <span>Pre-scale threshold: {Math.round((scaling.predictive.headroom || 0.85) * 100)}% of scale-up ({Math.round((scaling.predictive.headroom || 0.85) * scaling.thresholds.scaleUp)} req/window)</span>
            <span className="text-neutral-300">·</span>
            <span>Min ramp: 3 windows</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Admin() {
  const [auth, setAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [activeSection, setActiveSection] = useState('dashboard');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Watchdog state — polled top-level so outage banner shows on any tab
  const [outageStatus, setOutageStatus] = useState(null); // null | 'operational' | 'degraded' | 'outage'
  const [downServices, setDownServices] = useState([]);
  useEffect(() => {
    if (!auth) return;
    const fetchWatchdog = () => watchdogAPI.getStatus()
      .then(r => {
        if (r?.data) {
          setOutageStatus(r.data.status || 'operational');
          setDownServices((r.data.watchdog?.services || []).filter(s => s.status === 'down').map(s => s.name));
        }
      }).catch(() => {});
    fetchWatchdog();
    const t = setInterval(fetchWatchdog, 15000);
    return () => clearInterval(t);
  }, [auth]);

  // Dashboard data
  const [stats, setStats] = useState(null);
  const [events, setEvents] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [cleanupResult, setCleanupResult] = useState(null);
  const [cleanupRunning, setCleanupRunning] = useState(false);
  const [showCleanup, setShowCleanup] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (token) api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setAuth(!!token);
    setLoading(false);
    const fn = () => { setAuth(false); setStats(null); setEvents([]); };
    window.addEventListener('planit:admin-logout', fn);
    return () => window.removeEventListener('planit:admin-logout', fn);
  }, []);

  useEffect(() => {
    if (auth) { loadDashboard(); const t = setInterval(loadDashboard, 30000); return () => clearInterval(t); }
  }, [auth, currentPage, statusFilter]);

  const loadDashboard = async () => {
    try {
      const [sr, er] = await Promise.all([
        adminAPI.getStats(),
        adminAPI.getEvents({ page: currentPage, limit: 20, status: statusFilter === 'all' ? undefined : statusFilter }),
      ]);
      setStats(sr.data);
      setEvents(er.data.events);
      setTotalPages(er.data.pagination.pages);
    } catch (e) { if (e.response?.status === 401) logout(); }
  };

  const login = async (e) => {
    e.preventDefault();
    setLoggingIn(true);
    try {
      const r = await adminAPI.login(loginForm.username, loginForm.password);
      localStorage.setItem('adminToken', r.data.token);
      api.defaults.headers.common['Authorization'] = `Bearer ${r.data.token}`;
      setAuth(true);
      toast.success('Welcome back, Admin');
    } catch (e) { toast.error(e.response?.data?.error || 'Login failed'); }
    finally { setLoggingIn(false); }
  };

  const logout = () => { localStorage.removeItem('adminToken'); delete api.defaults.headers.common['Authorization']; setAuth(false); toast.success('Logged out'); };

  const deleteEvent = async (id) => {
    if (!confirm('Permanently delete this event and ALL data? This cannot be undone!')) return;
    try { await adminAPI.deleteEvent(id); toast.success('Event deleted'); setSelectedEvent(null); loadDashboard(); }
    catch { toast.error('Delete failed'); }
  };

  const runCleanup = async () => {
    setCleanupRunning(true); setCleanupResult(null);
    try { const r = await adminAPI.manualCleanup(); setCleanupResult(r.data); toast.success('Cleanup complete'); loadDashboard(); }
    catch { toast.error('Cleanup failed'); setCleanupResult({ success: false, message: 'Cleanup failed' }); }
    finally { setCleanupRunning(false); }
  };

  if (loading) return <div className="min-h-screen bg-neutral-50 flex items-center justify-center"><div className="spinner w-8 h-8 border-4 border-neutral-300 border-t-neutral-700" /></div>;

  // ── Login Screen ──────────────────────────────────────────────────────────
  if (!auth) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-neutral-900 to-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-2xl mx-auto mb-4">
            <Shield className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Super Admin</h1>
          <p className="text-sm text-slate-400 mt-1">PlanIt Master Control Panel</p>
        </div>
        <div className="card p-7 shadow-2xl border border-white/5 bg-white/5 backdrop-blur-sm">
          <form onSubmit={login} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Username</label>
              <input type="text" required className="input bg-white/10 border-white/10 text-white placeholder-slate-500 focus:border-blue-400" placeholder="admin" value={loginForm.username} onChange={e => setLoginForm({ ...loginForm, username: e.target.value })} autoFocus />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Password</label>
              <input type="password" required className="input bg-white/10 border-white/10 text-white placeholder-slate-500 focus:border-blue-400" placeholder="••••••••" value={loginForm.password} onChange={e => setLoginForm({ ...loginForm, password: e.target.value })} />
            </div>
            <button type="submit" disabled={loggingIn} className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 mt-2">
              {loggingIn ? <><span className="spinner w-4 h-4 border-2 border-white/30 border-t-white" /> Authenticating...</> : <><Shield className="w-4 h-4" /> Sign In</>}
            </button>
          </form>
        </div>
        <div className="text-center mt-5"><a href="/" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">← Back to PlanIt</a></div>
      </div>
    </div>
  );

  // ── Main App ──────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-neutral-100 flex">
      {/* Sidebar */}
      <aside className={`bg-neutral-950 flex-shrink-0 flex flex-col transition-all duration-300 ${sidebarOpen ? 'w-56' : 'w-14'}`} style={{ position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' }}>
        {/* Logo */}
        <div className="h-14 flex items-center gap-3 px-3 border-b border-white/5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
            <Shield className="w-4 h-4 text-white" />
          </div>
          {sidebarOpen && <span className="text-sm font-bold text-white">Admin Panel</span>}
          <button onClick={() => setSidebarOpen(v => !v)} className="ml-auto text-neutral-500 hover:text-white transition-colors">
            {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 space-y-0.5">
          {NAV_ITEMS.map(({ id, label, icon: I }) => {
            const isCc = id === 'command-center';
            return (
              <React.Fragment key={id}>
                {isCc && <div className="mx-2 my-2 border-t border-white/10" />}
                <button onClick={() => { setActiveSection(id); setSelectedEvent(null); }}
                  className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                    activeSection === id
                      ? isCc ? 'bg-violet-900/60 text-violet-300' : 'bg-white/10 text-white'
                      : isCc ? 'text-violet-500 hover:bg-violet-900/30 hover:text-violet-300' : 'text-neutral-400 hover:bg-white/5 hover:text-white'
                  }`}
                  title={!sidebarOpen ? label : undefined}>
                  <I className="w-4 h-4 flex-shrink-0" />
                  {sidebarOpen && <span>{label}</span>}
                </button>
              </React.Fragment>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div className="p-2 border-t border-white/5 space-y-0.5">
          <button onClick={() => { setCleanupResult(null); setShowCleanup(true); }} className="w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:bg-red-900/30 hover:text-red-300 transition-all" title={!sidebarOpen ? 'Cleanup' : undefined}>
            <Trash className="w-4 h-4 flex-shrink-0" />{sidebarOpen && 'Cleanup'}
          </button>
          <button onClick={logout} className="w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-sm font-medium text-neutral-400 hover:bg-white/5 hover:text-white transition-all" title={!sidebarOpen ? 'Logout' : undefined}>
            <LogOut className="w-4 h-4 flex-shrink-0" />{sidebarOpen && 'Logout'}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 bg-white border-b border-neutral-200 flex items-center gap-4 px-6 sticky top-0 z-40 shadow-sm">
          <div className="flex-1">
            <h1 className="text-sm font-bold text-neutral-900">
              {selectedEvent ? selectedEvent.title : NAV_ITEMS.find(n => n.id === activeSection)?.label || 'Dashboard'}
            </h1>
            <p className="text-xs text-neutral-400">
              {selectedEvent ? `Event Management` : 'PlanIt Admin'}
            </p>
          </div>

          {/* Global search */}
          <form onSubmit={async (e) => {
            e.preventDefault();
            if (!searchQuery.trim()) return;
            setSearchLoading(true);
            try {
              const r = await adminAPI.search(searchQuery);
              setSearchResults({ query: searchQuery, ...r.data.results });
            } catch { toast.error('Search failed'); }
            finally { setSearchLoading(false); }
          }} className="flex gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input type="text" placeholder="Global search..." className="input py-1.5 pl-9 text-sm w-48" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
            <button type="submit" disabled={searchLoading} className="btn btn-secondary text-xs py-1.5 px-3 gap-1">
              {searchLoading ? <span className="spinner w-3 h-3 border-2 border-neutral-300 border-t-neutral-600" /> : <Search className="w-3 h-3" />}
            </button>
          </form>

          <button onClick={async () => { try { const r = await adminAPI.exportData('events'); const b = new Blob([JSON.stringify(r.data.data, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `planit-export-${Date.now()}.json`; a.click(); toast.success('Exported'); } catch { toast.error('Export failed'); } }} className="btn btn-secondary text-xs gap-1.5 py-1.5">
            <Download className="w-3.5 h-3.5" /> Export All
          </button>

          {stats && (
            <div className="flex items-center gap-1.5 text-xs text-neutral-500 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-1.5">
              <Activity className="w-3 h-3 text-emerald-500" />
              <span className="font-medium">{formatNumber(stats.totalEvents)}</span> events
              <span className="text-neutral-300">·</span>
              <span className="font-medium">{formatNumber(stats.totalParticipants)}</span> users
            </div>
          )}
        </header>

        {/* Content */}
        <main className="flex-1 p-6 overflow-y-auto">
          {/* Dashboard */}
          {activeSection === 'dashboard' && !selectedEvent && (
            <div className="space-y-6 max-w-7xl mx-auto">

              {/* Outage banner — shown whenever watchdog reports degraded or outage status */}
              {outageStatus && outageStatus !== 'operational' && (
                <button
                  onClick={() => setActiveSection('system')}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors ${outageStatus === 'outage' ? 'bg-red-50 border-red-300 hover:bg-red-100' : 'bg-amber-50 border-amber-300 hover:bg-amber-100'}`}
                >
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 animate-pulse ${outageStatus === 'outage' ? 'bg-red-500' : 'bg-amber-400'}`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${outageStatus === 'outage' ? 'text-red-700' : 'text-amber-700'}`}>
                      {outageStatus === 'outage' ? '⚠ Service Outage Detected' : '⚠ Service Degradation Detected'}
                    </p>
                    {downServices.length > 0 && (
                      <p className={`text-xs mt-0.5 ${outageStatus === 'outage' ? 'text-red-600' : 'text-amber-600'}`}>
                        {downServices.length === 1 ? `${downServices[0]} is not responding` : `${downServices.join(', ')} are not responding`}
                      </p>
                    )}
                  </div>
                  <span className="text-xs font-medium text-neutral-500 flex-shrink-0">View System →</span>
                </button>
              )}

              {stats && (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard label="Total Events"       value={stats.totalEvents}        sub={`${stats.activeEvents} active`}                 icon={Calendar}    color="blue" />
                    <StatCard label="Participants"       value={stats.totalParticipants}  sub={`avg ${stats.averageParticipantsPerEvent}/event`} icon={Users}       color="emerald" />
                    <StatCard label="Messages"          value={stats.totalMessages}      sub={`${stats.totalPolls} polls`}                    icon={MessageSquare} color="violet" />
                    <StatCard label="New (24h)"         value={stats.recentEvents}       sub="events created"                                  icon={TrendingUp}  color="amber" />
                    <StatCard label="Files"             value={stats.totalFiles}         sub={formatFileSize(stats.totalStorage || 0)}         icon={HardDrive}   color="rose" />
                    <StatCard label="Storage"           value={formatFileSize(stats.totalStorage || 0)} sub={`${stats.totalFiles} files`}    icon={Database}    color="cyan" />
                    <StatCard label="Active Events"     value={stats.activeEvents}       sub="currently running"                               icon={Zap}         color="indigo" />
                    <StatCard label="Polls"             value={stats.totalPolls}         sub="total polls created"                             icon={BarChart3}   color="teal" />
                  </div>
                </>
              )}

              {/* Events Table */}
              <div className="card shadow-lg">
                <div className="p-5 border-b border-neutral-200 flex items-center justify-between gap-4 flex-wrap">
                  <h2 className="text-base font-bold text-neutral-900">All Events <span className="text-sm font-normal text-neutral-400">(click to manage)</span></h2>
                  <div className="flex items-center gap-2">
                    <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }} className="input py-1.5 text-sm">
                      {['all', 'active', 'completed', 'cancelled', 'draft'].map(s => <option key={s} value={s}>{s === 'all' ? 'All Statuses' : s}</option>)}
                    </select>
                    <button onClick={loadDashboard} className="btn btn-ghost p-2"><RefreshCw className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-neutral-50 border-b border-neutral-200">
                      <tr>{['Event', 'Organizer', 'Date', 'Participants', 'Mode', 'Status', ''].map(h => <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {events.length === 0 ? (
                        <tr><td colSpan={7} className="px-5 py-16 text-center"><Activity className="w-10 h-10 mx-auto text-neutral-300 mb-3" /><p className="text-sm text-neutral-400">No events found</p></td></tr>
                      ) : events.map(ev => (
                        <tr key={ev._id} className="hover:bg-neutral-50 cursor-pointer transition-colors" onClick={() => setSelectedEvent(ev)}>
                          <td className="px-5 py-3"><p className="text-sm font-semibold text-neutral-900">{ev.title}</p><p className="text-xs text-neutral-400 font-mono">/{ev.subdomain}</p></td>
                          <td className="px-5 py-3"><p className="text-sm text-neutral-900">{ev.organizerName}</p><p className="text-xs text-neutral-400">{ev.organizerEmail}</p></td>
                          <td className="px-5 py-3 text-xs text-neutral-500">{ev.date ? fmt(ev.date) : '—'}</td>
                          <td className="px-5 py-3"><div className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-neutral-400" /><span className="text-sm font-medium">{ev.participants?.length || 0}</span></div></td>
                          <td className="px-5 py-3">{ev.isEnterpriseMode ? <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full flex items-center gap-1 w-fit"><Zap className="w-3 h-3" /> Enterprise</span> : <span className="text-xs text-neutral-400">Standard</span>}</td>
                          <td className="px-5 py-3"><StatusBadge status={ev.status} /></td>
                          <td className="px-5 py-3 text-right"><ChevronRight className="w-4 h-4 text-neutral-400 ml-auto" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {totalPages > 1 && (
                  <div className="px-5 py-3 border-t bg-neutral-50 flex items-center justify-between">
                    <p className="text-sm text-neutral-500">Page {currentPage} of {totalPages}</p>
                    <div className="flex gap-2">
                      <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="btn btn-secondary text-sm py-1.5 disabled:opacity-40">Previous</button>
                      <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="btn btn-secondary text-sm py-1.5 disabled:opacity-40">Next</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Event Detail (when selected) */}
          {selectedEvent && (
            <div className="max-w-5xl mx-auto">
              <EventDetail event={selectedEvent} onBack={() => setSelectedEvent(null)} onDelete={deleteEvent} onUpdate={loadDashboard} />
            </div>
          )}

          {/* Events section (same as dashboard but with event detail support) */}
          {activeSection === 'events' && !selectedEvent && (
            <div className="max-w-7xl mx-auto">
              <div className="card shadow-lg">
                <div className="p-5 border-b border-neutral-200 flex items-center justify-between gap-4 flex-wrap">
                  <h2 className="text-base font-bold">All Events</h2>
                  <div className="flex items-center gap-2">
                    <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }} className="input py-1.5 text-sm">
                      {['all', 'active', 'completed', 'cancelled', 'draft'].map(s => <option key={s} value={s}>{s === 'all' ? 'All Statuses' : s}</option>)}
                    </select>
                    <button onClick={loadDashboard} className="btn btn-ghost p-2"><RefreshCw className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-neutral-50 border-b border-neutral-200">
                      <tr>{['Event', 'Organizer', 'Date', 'Participants', 'Mode', 'Status', ''].map(h => <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wider">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {events.map(ev => (
                        <tr key={ev._id} className="hover:bg-neutral-50 cursor-pointer" onClick={() => setSelectedEvent(ev)}>
                          <td className="px-5 py-3"><p className="text-sm font-semibold">{ev.title}</p><p className="text-xs text-neutral-400 font-mono">/{ev.subdomain}</p></td>
                          <td className="px-5 py-3"><p className="text-sm">{ev.organizerName}</p><p className="text-xs text-neutral-400">{ev.organizerEmail}</p></td>
                          <td className="px-5 py-3 text-xs text-neutral-500">{ev.date ? fmt(ev.date) : '—'}</td>
                          <td className="px-5 py-3 text-sm">{ev.participants?.length || 0}</td>
                          <td className="px-5 py-3">{ev.isEnterpriseMode ? <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-semibold">Enterprise</span> : <span className="text-xs text-neutral-400">Standard</span>}</td>
                          <td className="px-5 py-3"><StatusBadge status={ev.status} /></td>
                          <td className="px-5 py-3 text-right"><ChevronRight className="w-4 h-4 text-neutral-400 ml-auto" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'users'          && !selectedEvent && <div className="max-w-7xl mx-auto"><AllUsersPanel /></div>}
          {activeSection === 'organizers'     && !selectedEvent && <div className="max-w-7xl mx-auto"><OrganizersPanel /></div>}
          {activeSection === 'staff'          && !selectedEvent && <div className="max-w-7xl mx-auto"><StaffPanel /></div>}
          {activeSection === 'employees'      && !selectedEvent && <div className="max-w-5xl mx-auto"><EmployeesPanel /></div>}
          {activeSection === 'analytics'      && !selectedEvent && <div className="max-w-5xl mx-auto"><AnalyticsPanel stats={stats} /></div>}
          {activeSection === 'fleet'          && !selectedEvent && <FleetControl />}
          {activeSection === 'security'       && !selectedEvent && <SecurityPanel />}
          {activeSection === 'marketing'      && !selectedEvent && <div className="max-w-6xl mx-auto"><MarketingPanel /></div>}
          {activeSection === 'system'         && !selectedEvent && <div className="max-w-5xl mx-auto"><SystemPanel /></div>}
          {activeSection === 'logs'           && !selectedEvent && <div className="max-w-6xl mx-auto"><LogsPanel /></div>}
          {activeSection === 'uptime'         && !selectedEvent && <div className="max-w-4xl mx-auto"><UptimePanel /></div>}
          {activeSection === 'reports'        && !selectedEvent && <div className="max-w-5xl mx-auto"><BugReportsPanel /></div>}
          {activeSection === 'command-center' && !selectedEvent && <CommandCenterPanel />}
        </main>
      </div>

      {/* Search Results Modal */}
      {searchResults && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-start justify-center z-50 pt-16 px-4" onClick={() => setSearchResults(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden" style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="font-bold text-neutral-900">Search results for "{searchResults.query}"</h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  {(searchResults.events?.length || 0)} events · {(searchResults.participants?.length || 0)} users · {(searchResults.messages?.length || 0)} messages · {(searchResults.polls?.length || 0)} polls
                </p>
              </div>
              <button onClick={() => setSearchResults(null)} className="p-1.5 hover:bg-neutral-100 rounded-lg"><X className="w-4 h-4 text-neutral-400" /></button>
            </div>
            <div className="overflow-y-auto p-5 space-y-5">
              {/* Events */}
              {searchResults.events?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Events ({searchResults.events.length})</p>
                  <div className="space-y-1.5">
                    {searchResults.events.map(ev => (
                      <button key={ev._id} onClick={() => { setSearchResults(null); setSelectedEvent(ev); setActiveSection('events'); }} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-neutral-50 border border-neutral-100 text-left transition-colors">
                        <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold flex-shrink-0">{ev.title?.charAt(0)}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-neutral-900 truncate">{ev.title}</p>
                          <p className="text-xs text-neutral-400 font-mono">/{ev.subdomain} · {ev.organizerName}</p>
                        </div>
                        <StatusBadge status={ev.status} />
                        <ChevronRight className="w-4 h-4 text-neutral-300 flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* Participants */}
              {searchResults.participants?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Users ({searchResults.participants.length})</p>
                  <div className="space-y-1.5">
                    {searchResults.participants.map(p => (
                      <div key={p._id} className="flex items-center gap-3 p-3 rounded-xl border border-neutral-100 bg-neutral-50">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold flex-shrink-0">{p.username?.charAt(0)?.toUpperCase()}</div>
                        <div>
                          <p className="text-sm font-semibold text-neutral-900">{p.username}</p>
                          <p className="text-xs text-neutral-400">Joined {rel(p.joinedAt)}{p.role ? ` · ${p.role}` : ''}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Messages */}
              {searchResults.messages?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5" /> Messages ({searchResults.messages.length})</p>
                  <div className="space-y-1.5">
                    {searchResults.messages.map(m => (
                      <div key={m._id} className="p-3 rounded-xl border border-neutral-100 bg-neutral-50">
                        <p className="text-xs font-semibold text-neutral-500 mb-0.5">{m.username} · {rel(m.createdAt)}</p>
                        <p className="text-sm text-neutral-800 line-clamp-2">{m.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Polls */}
              {searchResults.polls?.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><BarChart3 className="w-3.5 h-3.5" /> Polls ({searchResults.polls.length})</p>
                  <div className="space-y-1.5">
                    {searchResults.polls.map(p => (
                      <div key={p._id} className="p-3 rounded-xl border border-neutral-100 bg-neutral-50">
                        <p className="text-sm font-medium text-neutral-800">{p.question}</p>
                        <p className="text-xs text-neutral-400 mt-0.5">{p.options?.length || 0} options · {rel(p.createdAt)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* No results */}
              {!searchResults.events?.length && !searchResults.participants?.length && !searchResults.messages?.length && !searchResults.polls?.length && (
                <div className="text-center py-12">
                  <Search className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
                  <p className="text-sm text-neutral-400">No results found for "{searchResults.query}"</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cleanup Modal */}
      {showCleanup && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center"><Trash className="w-5 h-5 text-white" /></div>
              <div><h2 className="font-bold text-white">Manual Cleanup</h2><p className="text-xs text-red-200">Delete events older than 7 days</p></div>
              <button onClick={() => setShowCleanup(false)} className="ml-auto text-white/70 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6">
              {!cleanupResult ? (
                <>
                  <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl mb-5">
                    <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-amber-800">This will permanently delete all events (including cancelled) whose date was <strong>7+ days ago</strong> along with all their data. This cannot be undone.</p>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setShowCleanup(false)} className="flex-1 btn btn-secondary">Cancel</button>
                    <button onClick={runCleanup} disabled={cleanupRunning} className="flex-1 btn bg-red-600 hover:bg-red-700 text-white gap-2 disabled:opacity-60">
                      {cleanupRunning ? <><span className="spinner w-4 h-4 border-2 border-white/30 border-t-white" /> Running...</> : <><Trash className="w-4 h-4" /> Run Cleanup</>}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className={`p-4 rounded-xl mb-4 ${cleanupResult.success ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'}`}>
                    {cleanupResult.success ? <CheckCircle className="w-5 h-5 text-emerald-600 mb-2" /> : <AlertTriangle className="w-5 h-5 text-red-600 mb-2" />}
                    <p className={`text-sm font-semibold ${cleanupResult.success ? 'text-emerald-800' : 'text-red-800'}`}>{cleanupResult.success ? 'Cleanup complete' : 'Cleanup failed'}</p>
                    {cleanupResult.results && <p className="text-sm text-emerald-700 mt-1">Deleted: {cleanupResult.results.deleted} event(s)</p>}
                  </div>
                  <button onClick={() => setShowCleanup(false)} className="btn btn-secondary w-full">Close</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
