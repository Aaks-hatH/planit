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
  Command, Key, Play, Crosshair, Ban, MoreHorizontal,
} from 'lucide-react';
import api, { adminAPI, uptimeAPI, watchdogAPI, routerAPI, bugReportAPI } from '../services/api';
import { SERVICE_CATEGORIES, ALL_SERVICES_FLAT } from '../utils/serviceCategories';
import { formatNumber, formatFileSize } from '../utils/formatters';
import { DateTime } from 'luxon';
import toast from 'react-hot-toast';
import socketService from '../services/socket';
import DemoDashboard from '../components/DemoDashboard';

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
              {[['isPasswordProtected', 'Password Protected'], ['isEnterpriseMode', 'Enterprise Mode'], ['isTableServiceMode', 'Table Service Mode'], ['keepForever', 'Keep Forever (no auto-delete)']].map(([k, l]) => (
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
                      ['Password', event.isPasswordProtected ? 'Protected' : 'None'],
                      ['Enterprise', event.isEnterpriseMode ? 'Enabled' : 'Disabled'],
                      ['Table Service', event.isTableServiceMode ? 'Enabled' : 'Disabled'],
                      ['Keep Forever', event.keepForever ? 'Yes' : 'No'],
                      ['Public Listing', event.settings?.isPublic ? 'Public' : 'Private'],
                      ['Chat', event.settings?.allowChat !== false ? 'On' : 'Off'],
                      ['Polls', event.settings?.allowPolls !== false ? 'On' : 'Off'],
                      ['File Sharing', event.settings?.allowFileSharing !== false ? 'On' : 'Off'],
                    ].map(([l, v]) => (
                      <div key={l} className="flex justify-between">
                        <p className="text-xs text-neutral-400">{l}</p>
                        <p className={`text-sm font-medium ${['Enabled','Protected','Yes','Public','On'].includes(String(v)) ? 'text-emerald-700' : ['Disabled','None','No','Private','Off'].includes(String(v)) ? 'text-neutral-400' : 'text-neutral-900'}`}>{v}</p>
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
                          {inv.checkedIn && <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">In</span>}
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

  // ── Maintenance mode ──
  const [maintenance, setMaintenance]   = useState(null);
  const [maintLoading, setMaintLoading] = useState(true);
  const [maintSaving, setMaintSaving]   = useState(false);
  const [maintForm, setMaintForm]       = useState({ type: 's', message: '', eta: '', start: '' });

  const TYPE_LABELS = { s: 'Scheduled', i: 'Incident', d: 'Degraded' };
  const TYPE_COLORS = {
    s: { pill: 'bg-amber-100 text-amber-700 border-amber-200',  dot: 'bg-amber-500',  card: 'border-amber-400 bg-amber-50',  icon: 'text-amber-600',  iconBg: 'bg-amber-100',  btn: 'bg-amber-500 hover:bg-amber-600' },
    i: { pill: 'bg-red-100 text-red-700 border-red-200',        dot: 'bg-red-500',     card: 'border-red-400 bg-red-50',      icon: 'text-red-600',    iconBg: 'bg-red-100',    btn: 'bg-red-500 hover:bg-red-600'     },
    d: { pill: 'bg-orange-100 text-orange-700 border-orange-200', dot: 'bg-orange-500', card: 'border-orange-400 bg-orange-50', icon: 'text-orange-600', iconBg: 'bg-orange-100', btn: 'bg-orange-500 hover:bg-orange-600' },
  };

  const loadMaintenance = useCallback(async () => {
    try {
      const r = await api.get('/admin/maintenance');
      setMaintenance(r.data);
    } catch (_) {}
    finally { setMaintLoading(false); }
  }, []);

  const doMaintenance = async (action) => {
    setMaintSaving(true);
    try {
      const r = await api.post('/admin/maintenance', {
        action,
        type:    maintForm.type,
        message: maintForm.message || undefined,
        eta:     maintForm.eta     || undefined,
        start:   maintForm.start   || undefined,
      });
      setMaintenance(r.data);
      const msgs = { activate: '⚠ Maintenance active — site locked', schedule: '⏰ Maintenance scheduled — banner live', resolve: '✓ Resolved — site is live' };
      toast.success(msgs[action] || 'Done');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed');
    } finally { setMaintSaving(false); }
  };

  useEffect(() => { loadMaintenance(); }, [loadMaintenance]);

  const load = useCallback(async () => {
    setLoading(true);
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

      {/* ── Maintenance Mode ─────────────────────────────────────────────── */}
      {(() => {
        const isActive   = !!maintenance?.active;
        const isUpcoming = !!maintenance?.upcoming;
        const isOff      = !isActive && !isUpcoming;
        const t          = maintenance?.type || maintForm.type || 's';
        const tc         = TYPE_COLORS[t] || TYPE_COLORS.s;
        return (
          <div className={`rounded-2xl border-2 p-5 transition-all duration-300 ${isActive ? tc.card : isUpcoming ? 'border-neutral-300 bg-neutral-50' : 'border-neutral-200 bg-white'}`}>
            {/* Header row */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isActive ? tc.iconBg : 'bg-neutral-100'}`}>
                  <AlertCircle className={`w-5 h-5 ${isActive ? tc.icon : 'text-neutral-400'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-sm">Maintenance Mode</h3>
                    {isActive && (
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold border ${tc.pill}`}>
                        <span className={`w-1.5 h-1.5 rounded-full animate-pulse inline-block ${tc.dot}`} />
                        {TYPE_LABELS[t]} — ACTIVE
                      </span>
                    )}
                    {isUpcoming && (
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold bg-neutral-100 text-neutral-600 border border-neutral-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 inline-block" />
                        {TYPE_LABELS[maintenance?.type || 's']} — UPCOMING
                      </span>
                    )}
                    {isOff && <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-neutral-100 text-neutral-400">OFF</span>}
                  </div>
                  <p className="text-xs text-neutral-500 leading-relaxed">
                    {isActive   && `Site locked · all public traffic blocked · admin panel stays live`}
                    {isUpcoming && `Banner shown on all pages · site still accessible · activates on schedule`}
                    {isOff      && 'Site is fully live. Enable to show maintenance page or schedule an upcoming banner.'}
                  </p>
                  {(isActive || isUpcoming) && maintenance?.message && (
                    <p className="text-xs text-neutral-600 font-medium mt-2 bg-white rounded-lg px-2 py-1.5 border border-neutral-200">"{maintenance.message}"</p>
                  )}
                  {(isActive || isUpcoming) && maintenance?.by && (
                    <p className="text-xs text-neutral-400 mt-1">Set by {maintenance.by}{maintenance.start ? ` · ${new Date(maintenance.start).toLocaleString()}` : ''}</p>
                  )}
                </div>
              </div>
              {/* Resolve button — only when something is active/upcoming */}
              {(isActive || isUpcoming) && (
                <button
                  onClick={() => doMaintenance('resolve')}
                  disabled={maintSaving}
                  className="flex-shrink-0 px-4 py-2 rounded-xl text-sm font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all disabled:opacity-50"
                >
                  {maintSaving ? 'Saving…' : 'Resolve'}
                </button>
              )}
            </div>

            {/* Config form — always shown when off, hidden when active/upcoming */}
            {isOff && (
              <div className="mt-4 pt-4 border-t border-neutral-100 space-y-3">
                {/* Type selector */}
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 mb-1.5">Type</label>
                  <div className="flex gap-2">
                    {Object.entries(TYPE_LABELS).map(([k, v]) => (
                      <button
                        key={k}
                        onClick={() => setMaintForm(p => ({ ...p, type: k }))}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${maintForm.type === k ? `${TYPE_COLORS[k].pill}` : 'border-neutral-200 text-neutral-400 hover:border-neutral-300'}`}
                      >{v}</button>
                    ))}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-500 mb-1">Message <span className="font-normal text-neutral-400">(optional)</span></label>
                    <input
                      type="text" maxLength={280}
                      value={maintForm.message}
                      onChange={e => setMaintForm(p => ({ ...p, message: e.target.value }))}
                      placeholder={maintForm.type === 'i' ? "Investigating an issue with the API." : maintForm.type === 'd' ? "Experiencing elevated error rates." : "Scheduled maintenance. Back shortly."}
                      className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:border-neutral-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-500 mb-1">ETA <span className="font-normal text-neutral-400">(optional)</span></label>
                    <input
                      type="datetime-local"
                      value={maintForm.eta}
                      onChange={e => setMaintForm(p => ({ ...p, eta: e.target.value }))}
                      className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:border-neutral-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-500 mb-1">Scheduled start <span className="font-normal text-neutral-400">(for upcoming banner)</span></label>
                    <input
                      type="datetime-local"
                      value={maintForm.start}
                      onChange={e => setMaintForm(p => ({ ...p, start: e.target.value }))}
                      className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:border-neutral-400"
                    />
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => doMaintenance('activate')}
                    disabled={maintSaving}
                    className={`px-4 py-2 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 ${TYPE_COLORS[maintForm.type]?.btn || 'bg-amber-500 hover:bg-amber-600'}`}
                  >
                    {maintSaving ? 'Saving…' : 'Enable now'}
                  </button>
                  <button
                    onClick={() => doMaintenance('schedule')}
                    disabled={maintSaving}
                    className="px-4 py-2 rounded-xl text-sm font-bold border border-neutral-200 text-neutral-600 hover:bg-neutral-50 transition-all disabled:opacity-50"
                  >
                    Schedule (banner only)
                  </button>
                  <span className="text-xs text-neutral-400 ml-1">Mesh, watchdog &amp; admin stay live</span>
                </div>
              </div>
            )}
          </div>
        );
      })()}

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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

  // Full permission set matching the Employee model
  const EMPTY_PERMS = {
    canDeleteEvents:      false,
    canEditEvents:        false,
    canManageUsers:       false,
    canViewLogs:          false,
    canViewSystem:        false,
    canManageIncidents:   true,
    canExportData:        false,
    canRunCleanup:        false,
    canSendMarketing:     false,
    canViewMarketing:     false,
    canManageBlocklist:   false,
    canToggleMaintenance: false,
  };

  const EMPTY_FORM = {
    name: '', email: '', role: 'support', department: '', phone: '',
    notes: '', status: 'active', password: '', startDate: '',
    isDemo: false,
    permissions: { ...EMPTY_PERMS },
  };

  const [form, setForm] = useState(EMPTY_FORM);
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
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (emp) => {
    setEditing(emp._id);
    setForm({
      name:        emp.name,
      email:       emp.email,
      role:        emp.role,
      department:  emp.department  || '',
      phone:       emp.phone       || '',
      notes:       emp.notes       || '',
      status:      emp.status,
      password:    '',
      startDate:   emp.startDate   || '',
      isDemo:      emp.isDemo      || false,
      permissions: { ...EMPTY_PERMS, ...emp.permissions },
    });
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

  const togglePerm = (k) => setForm(f => ({ ...f, permissions: { ...f.permissions, [k]: !f.permissions[k] } }));

  // Permissions grouped by area for cleaner UI
  const PERM_GROUPS = [
    {
      label: 'Events',
      perms: [
        ['canEditEvents',   'Edit Events'],
        ['canDeleteEvents', 'Delete Events'],
      ],
    },
    {
      label: 'Users',
      perms: [
        ['canManageUsers', 'Manage Users'],
      ],
    },
    {
      label: 'Operations',
      perms: [
        ['canManageIncidents',   'Manage Incidents'],
        ['canRunCleanup',        'Run Cleanup'],
        ['canToggleMaintenance', 'Toggle Maintenance'],
      ],
    },
    {
      label: 'Data & Logs',
      perms: [
        ['canExportData',  'Export Data'],
        ['canViewLogs',    'View Logs'],
        ['canViewSystem',  'View System Info'],
      ],
    },
    {
      label: 'Marketing',
      perms: [
        ['canViewMarketing', 'View Campaigns'],
        ['canSendMarketing', 'Send Campaigns'],
      ],
    },
    {
      label: 'Security',
      perms: [
        ['canManageBlocklist', 'Manage Blocklist'],
      ],
    },
  ];

  // Flat list for the employee card summary (only granted ones)
  const ALL_PERMS_FLAT = PERM_GROUPS.flatMap(g => g.perms);

  const ROLES = ['super_admin', 'admin', 'moderator', 'support', 'analyst', 'developer', 'demo'];

  const avatarColor = (role) => {
    const map = {
      super_admin: 'bg-purple-100 text-purple-700',
      admin:       'bg-blue-100 text-blue-700',
      moderator:   'bg-amber-100 text-amber-700',
      support:     'bg-teal-100 text-teal-700',
      analyst:     'bg-indigo-100 text-indigo-700',
      developer:   'bg-cyan-100 text-cyan-700',
      demo:        'bg-orange-100 text-orange-700',
    };
    return map[role] || 'bg-neutral-100 text-neutral-600';
  };

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
            <div key={emp._id} className={`card p-5 hover:shadow-lg transition-all ${emp.status !== 'active' ? 'opacity-60' : ''}`}>
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold flex-shrink-0 ${avatarColor(emp.role)}`}>
                  {emp.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="text-sm font-bold text-neutral-900">{emp.name}</p>
                    <RoleBadge role={emp.role} />
                    {emp.isDemo && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                        demo
                      </span>
                    )}
                    {emp.status !== 'active' && <StatusBadge status={emp.status} />}
                  </div>
                  <p className="text-xs text-neutral-500 mb-1">{emp.email}</p>
                  {emp.department && <p className="text-xs text-neutral-400">{emp.department}</p>}
                  {emp.startDate && <p className="text-xs text-neutral-400">Since {fmt(emp.startDate)}</p>}
                  {emp.permissions && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {emp.role === 'super_admin'
                        ? <span className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full font-medium">Full Access</span>
                        : ALL_PERMS_FLAT.filter(([k]) => emp.permissions?.[k]).map(([k, l]) => (
                            <span key={k} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">{l}</span>
                          ))
                      }
                      {emp.isDemo && <span className="text-xs bg-orange-50 text-orange-500 px-2 py-0.5 rounded-full font-medium">Sandbox mode</span>}
                    </div>
                  )}
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

            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Basic info */}
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

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1.5">Notes</label>
                <textarea className="input w-full text-sm resize-none" rows={2} placeholder="Internal notes..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>

              {/* Demo mode toggle */}
              <div className={`rounded-xl border-2 p-4 transition-all ${form.isDemo ? 'border-orange-300 bg-orange-50' : 'border-neutral-200 bg-neutral-50'}`}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <div className="mt-0.5 flex-shrink-0">
                    <div className={`w-9 h-5 rounded-full transition-all relative ${form.isDemo ? 'bg-orange-500' : 'bg-neutral-300'}`}
                      onClick={() => setForm(f => ({ ...f, isDemo: !f.isDemo }))}>
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${form.isDemo ? 'left-4' : 'left-0.5'}`} />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-neutral-800">Sandbox / Demo Account</p>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      All writes are silently intercepted — the account can browse everything but nothing they do is saved.
                      Great for giving friends or investors access to explore.
                    </p>
                  </div>
                </label>
              </div>

              {/* Permissions — grouped */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="text-xs font-medium text-neutral-600">Permissions</label>
                  {form.role === 'super_admin' && (
                    <span className="text-xs text-purple-600 font-medium">super_admin bypasses all permission checks</span>
                  )}
                </div>
                {form.isDemo ? (
                  <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-xs text-orange-700">
                    Permissions are ignored for demo accounts — all write operations are intercepted regardless.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {PERM_GROUPS.map(group => (
                      <div key={group.label}>
                        <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-1.5">{group.label}</p>
                        <div className="grid grid-cols-2 gap-1.5">
                          {group.perms.map(([k, l]) => (
                            <label key={k} className={`flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-all ${form.permissions[k] ? 'border-neutral-900 bg-neutral-900' : 'border-neutral-200 hover:bg-neutral-50'}`}
                              onClick={() => togglePerm(k)}>
                              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all ${form.permissions[k] ? 'bg-white border-white' : 'border-neutral-300'}`}>
                                {form.permissions[k] && <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><polyline points="2 6 5 9 10 3" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                              </div>
                              <input type="checkbox" className="sr-only" checked={!!form.permissions[k]} readOnly />
                              <span className={`text-xs ${form.permissions[k] ? 'text-white font-medium' : 'text-neutral-700'}`}>{l}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
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
                    <td className="px-5 py-4">{s.hasPassword ? <span className="text-emerald-500">Yes</span> : <span className="text-neutral-300">—</span>}</td>
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
  .cc-mono      { font-variant-numeric:tabular-nums;font-feature-settings:"tnum" }
  .cc-glow-v    { border-left:3px solid #7c3aed }
  .cc-glow-r    { border-left:3px solid #dc2626 }
  .cc-glow-g    { border-left:3px solid #16a34a }
  .cc-glow-a    { border-left:3px solid #d97706 }
  .cc-bar       { height:6px;background:#e5e7eb;border-radius:3px;overflow:hidden }
  .cc-bar-fill  { height:100%;border-radius:3px;transition:width .9s cubic-bezier(.4,0,.2,1) }
  .cc-tag       { display:inline-flex;align-items:center;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;letter-spacing:.02em;text-transform:capitalize }
  .cc-tr:hover  { background:#f9fafb }
  .cc-spark     { display:flex;align-items:flex-end;gap:1px }
  .cc-spark span{ flex:1;min-width:2px;border-radius:1px 1px 0 0;transition:height .3s }
  .cc-blink     { animation:none }
  .cc-scanline  { display:none }
`;

function CCStat({ label, value, sub, color = 'text-neutral-900', glow, onClick }) {
  return (
    <div onClick={onClick}
      className={`rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition-all ${onClick ? 'cursor-pointer hover:shadow-md hover:border-violet-300' : ''} ${glow || ''}`}>
      <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">{label}</p>
      <p className={`text-2xl font-bold cc-mono leading-none ${color}`}>{value ?? '—'}</p>
      {sub && <p className="text-xs text-neutral-400 mt-1.5 leading-tight">{sub}</p>}
    </div>
  );
}

function CCThreat({ score }) {
  const lvl   = score < 25 ? 'Nominal' : score < 50 ? 'Elevated' : score < 75 ? 'High' : 'Critical';
  const color = score < 25 ? '#16a34a' : score < 50 ? '#d97706' : score < 75 ? '#dc2626' : '#991b1b';
  const bg    = score < 25 ? '#dcfce7' : score < 50 ? '#fef3c7' : score < 75 ? '#fee2e2' : '#fecaca';
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {[...Array(5)].map((_, i) => (
          <div key={i} style={{ width:5, height:14, borderRadius:2, background: i < Math.ceil((score/100)*5) ? color : '#e5e7eb', transition:'background .5s' }} />
        ))}
      </div>
      <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ color, background:bg }}>{lvl}</span>
    </div>
  );
}

function CCFunnel({ label, v, total, color }) {
  const pct = total > 0 ? Math.round((v / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1.5">
        <span className="text-neutral-600 font-medium">{label}</span>
        <span className="font-semibold cc-mono text-neutral-800">{(v||0).toLocaleString()} <span className="text-neutral-400 font-normal">({pct}%)</span></span>
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
    { id:'grid',     ico: Monitor,   lbl:'Overview'     },
    { id:'intel',    ico: BarChart3, lbl:'Analytics'    },
    { id:'threat',   ico: Shield,    lbl:'Security'     },
    { id:'asset',    ico: Calendar,  lbl:'Events'       },
    { id:'dispatch', ico: Terminal,  lbl:'Dispatch'     },
    { id:'signal',   ico: Mail,      lbl:'Email Pool'   },
    { id:'storage',  ico: Database,  lbl:'Database'     },
    { id:'runtime',  ico: Cpu,       lbl:'Runtime'      },
    { id:'audit',    ico: FileText,  lbl:'Audit Log'    },
  ];

  // ─── helpers ────────────────────────────────────────────────────────────────
  const Divider = ({ label }) => (
    <div className="flex items-center gap-3 my-4">
      <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider whitespace-nowrap">{label}</span>
      <div className="flex-1 h-px bg-neutral-200" />
    </div>
  );

  const Panel = ({ children, className = '' }) => (
    <div className={`rounded-xl border border-neutral-200 bg-white shadow-sm ${className}`}>{children}</div>
  );

  const PanelHead = ({ children }) => (
    <div className="px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50 rounded-t-xl">{children}</div>
  );

  const Tag = ({ children, color = 'neutral' }) => {
    const cls = {
      neutral: 'bg-neutral-100 text-neutral-600',
      green:   'bg-emerald-50 text-emerald-700 border border-emerald-200',
      red:     'bg-red-50 text-red-700 border border-red-200',
      amber:   'bg-amber-50 text-amber-700 border border-amber-200',
      violet:  'bg-violet-50 text-violet-700 border border-violet-200',
    }[color] || 'bg-neutral-100 text-neutral-600';
    return <span className={`cc-tag ${cls}`}>{children}</span>;
  };

  return (
    <div className="min-h-screen bg-neutral-50" style={{ fontFamily:"Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif" }}>
      <style>{CC_STYLES}</style>

      {/* ══ TOP BAR ══ */}
      <div className="border-b border-neutral-200 bg-white sticky top-0 z-20 shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-6 py-3 flex items-center justify-between gap-6">
          {/* Brand */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
              <Command className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="text-sm font-bold text-neutral-900">Command Center</span>
              <span className="ml-2 text-xs text-neutral-400">Planit Platform</span>
            </div>
          </div>

          {/* Status strip */}
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${online===total && total>0 ? 'bg-emerald-500' : 'bg-red-500'}`} />
              <span className="text-neutral-500">Fleet</span>
              <span className={`font-semibold cc-mono ${online===total ? 'text-emerald-600' : 'text-red-600'}`}>{online}/{total}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-neutral-400">Threat Level</span>
              <CCThreat score={threat} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-neutral-400">Live Sockets</span>
              <span className="font-semibold text-violet-600 cc-mono">{runtime?.wsStats?.connected ?? '—'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-neutral-400">Organizers</span>
              <span className="font-semibold text-neutral-400 cc-mono">{platform?.maoCount ?? '—'}</span>
            </div>
            {refreshAt && <span className="text-neutral-700 cc-mono text-xs">Updated {refreshAt.toLocaleTimeString()}</span>}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setLive(v=>!v)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${live ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-neutral-100 border-neutral-300 text-neutral-500'}`}>
              {live ? '● Live' : '○ Paused'}
            </button>
            <button onClick={() => fetchAll()} disabled={loading}
              className="px-3 py-1.5 rounded-lg border border-neutral-300 bg-white hover:bg-neutral-50 text-xs font-medium transition-colors disabled:opacity-40 flex items-center gap-1.5 text-neutral-600">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>
        </div>

        {/* Tab rail */}
        <div className="max-w-screen-2xl mx-auto px-6 flex gap-0 overflow-x-auto border-t border-neutral-100">
          {TABS.map(t => {
            const Icon = t.ico;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-all whitespace-nowrap flex items-center gap-2 shrink-0
                  ${tab===t.id ? 'border-violet-600 text-violet-700 bg-violet-50/50' : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50'}`}>
                <Icon className="w-3.5 h-3.5" />{t.lbl}
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-6 py-6 space-y-6">

        {/* ═══════════════ GRID ═══════════════ */}
        {tab === 'grid' && (
          <div className="space-y-5">
            {/* Tier-1 stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3">
              <CCStat label="Fleet Status" value={`${online}/${total}`} color={online===total?'text-emerald-600':'text-red-600'} glow={online<total?'cc-glow-r':'cc-glow-g'} sub="services online" />
              <CCStat label="Live Sockets" value={runtime?.wsStats?.connected??'—'} color="text-violet-700" sub="connections" />
              <CCStat label="Errors / 1h" value={security?.errLast1h??'—'} color={security?.errSpike?'text-red-600':'text-neutral-700'} glow={security?.errSpike?'cc-glow-r':undefined} sub={security?.errSpike?'Spike detected':'Nominal'} />
              <CCStat label="Organizers" value={platform?.maoCount??'—'} color="text-violet-700" sub={`+${platform?.newOrgsThisWeek??0} this week`} />
              <CCStat label="Events Today" value={events?.todayCount??'—'} color="text-amber-700" sub={`${events?.ystdCount??0} yesterday`} />
              <CCStat label="Abandoned" value={events?.abandonedEvents?.length??'—'} color={events?.abandonedEvents?.length>5?'text-red-600':'text-neutral-500'} sub="no check-ins" />
              <CCStat label="Config Score" value={runtime?`${runtime.configScore}%`:'—'} color={runtime?.configScore>=80?'text-emerald-600':'text-amber-600'} sub="env vars set" />
              <CCStat label="Flagged Users" value={security?.suspiciousParticipants?.length??'—'} color={security?.suspiciousParticipants?.length>0?'text-amber-600':'text-neutral-400'} sub="suspicious" />
            </div>

            {/* Fleet cards */}
            <Divider label="Service Health" />
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {loading && !fleet ? (
                [0,1,2].map(i => <div key={i} className="h-44 rounded-xl bg-neutral-100 animate-pulse" />)
              ) : fleet?.services?.map(svc => {
                const ok  = svc.ok;
                const mem = svc.memMB ? Math.round((svc.memMB.heapUsed/(svc.memMB.heapTotal||1))*100) : 0;
                return (
                  <Panel key={svc.service} className={ok?'cc-glow-g':'cc-glow-r'}>
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-2.5 h-2.5 rounded-full ${ok?'bg-emerald-500':'bg-red-500'}`} />
                          <div>
                            <span className="text-sm font-bold text-neutral-900">{svc.service?.charAt(0).toUpperCase()+svc.service?.slice(1)}</span>
                            <span className="ml-2 text-xs text-neutral-400">{svc.type}</span>
                          </div>
                        </div>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ok?'bg-emerald-50 text-emerald-700':'bg-red-50 text-red-700'}`}>{ok?'Online':'Offline'}</span>
                      </div>
                      {!ok && <p className="text-sm text-red-600 mb-3 bg-red-50 rounded-lg p-2">{svc.error||'Service unreachable'}</p>}
                      {ok && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                          {svc.uptime   != null && <div className="bg-neutral-50 rounded-lg p-2.5"><p className="text-neutral-400 text-xs mb-0.5">Uptime</p><p className="font-semibold text-neutral-400 cc-mono">{fmtUptime(svc.uptime)}</p></div>}
                          {svc.pid      != null && <div className="bg-neutral-50 rounded-lg p-2.5"><p className="text-neutral-400 text-xs mb-0.5">PID</p><p className="font-semibold text-neutral-400 cc-mono">{svc.pid}</p></div>}
                          {svc.node              && <div className="bg-neutral-50 rounded-lg p-2.5"><p className="text-neutral-400 text-xs mb-0.5">Node</p><p className="font-semibold text-neutral-400 cc-mono">{svc.node}</p></div>}
                          {svc.errors24h!= null  && <div className="bg-neutral-50 rounded-lg p-2.5"><p className="text-neutral-400 text-xs mb-0.5">Err/24h</p><p className={`font-semibold cc-mono ${svc.errors24h>0?'text-red-600':'text-emerald-600'}`}>{svc.errors24h}</p></div>}
                          {svc.liveClients!=null && <div className="bg-neutral-50 rounded-lg p-2.5"><p className="text-neutral-400 text-xs mb-0.5">SSE</p><p className="font-semibold text-neutral-400 cc-mono">{svc.liveClients}</p></div>}
                          {svc.backends  !=null  && <div className="bg-neutral-50 rounded-lg p-2.5"><p className="text-neutral-400 text-xs mb-0.5">Nodes</p><p className="font-semibold text-neutral-400 cc-mono">{svc.backends}</p></div>}
                          {svc.memMB && (
                            <div className="col-span-3 bg-neutral-50 rounded-lg p-2.5">
                              <div className="flex justify-between mb-1.5"><span className="text-neutral-500 text-xs">Heap Usage</span><span className="text-neutral-600 text-xs cc-mono">{svc.memMB.heapUsed}/{svc.memMB.heapTotal} MB ({mem}%)</span></div>
                              <CCBar v={mem} max={100} color={mem>85?'#dc2626':mem>65?'#d97706':'#16a34a'} />
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
                <Divider label="Environment Configuration" />
                <Panel>
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm font-semibold text-neutral-700">Environment Coverage</span>
                      <span className={`text-sm font-bold cc-mono px-3 py-1 rounded-lg ${runtime.configScore>=80?'bg-emerald-50 text-emerald-700':runtime.configScore>=50?'bg-amber-50 text-amber-700':'bg-red-50 text-red-700'}`}>{runtime.configScore}%</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {runtime.config.map(c => (
                        <Tag key={c.key} color={c.set?'green':'red'}>{c.set ? 'Set' : 'Missing'}: {c.label}</Tag>
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <CCStat label="Organizers (30d)" value={platform?.maoCount} color="text-violet-700" sub={`+${platform?.newOrgsThisWeek??0} this week`} />
              <CCStat label="Total Events" value={platform?.conversionFunnel?.created?.toLocaleString()} color="text-neutral-700" />
              <CCStat label="Completion Rate" value={platform?.conversionFunnel?.created ? `${Math.round((platform.conversionFunnel.completed/platform.conversionFunnel.created)*100)}%` : '—'} color="text-blue-700" />
              <CCStat label="WoW Org Growth"
                value={platform?.newOrgsLastWeek>0 ? `${Math.round(((platform.newOrgsThisWeek-platform.newOrgsLastWeek)/platform.newOrgsLastWeek)*100)}%` : `+${platform?.newOrgsThisWeek??0}`}
                color={platform?.newOrgsThisWeek>=platform?.newOrgsLastWeek?'text-emerald-600':'text-red-600'} sub="organiser growth" />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              {/* Events per day chart */}
              <Panel>
                <PanelHead><span className="text-sm font-semibold text-neutral-700">Events Created — Last 30 Days</span></PanelHead>
                <div className="p-5">
                  {platform?.eventsPerDay?.length ? (() => {
                    const max = Math.max(...platform.eventsPerDay.map(d=>d.count), 1);
                    return (
                      <div className="flex items-end gap-px h-28 w-full">
                        {platform.eventsPerDay.map((d,i) => (
                          <div key={i} className="flex-1 flex flex-col items-center relative" style={{ height:'100%' }}>
                            <div className="absolute bottom-0 w-full hover:bg-violet-500 transition-colors rounded-t cursor-pointer"
                              style={{ height:`${Math.max(4,Math.round((d.count/max)*112))}px`, background:'#7c3aed' }}
                              title={`${d._id}: ${d.count} events`} />
                          </div>
                        ))}
                      </div>
                    );
                  })() : <div className="h-28 flex items-center justify-center text-neutral-400 text-sm">No data available</div>}
                  <div className="flex justify-between text-xs text-neutral-400 mt-2">
                    <span>{platform?.eventsPerDay?.[0]?._id?.slice(5)}</span>
                    <span>{platform?.eventsPerDay?.at(-1)?._id?.slice(5)}</span>
                  </div>
                </div>
              </Panel>

              {/* Conversion funnel */}
              <Panel>
                <PanelHead><span className="text-sm font-semibold text-neutral-700">Event Conversion Funnel</span></PanelHead>
                <div className="p-5 space-y-4">
                  {platform?.conversionFunnel && (() => {
                    const { created, hasParticipants, hadCheckin, completed } = platform.conversionFunnel;
                    return [
                      { label:'Events Created',    v:created,         color:'#7c3aed' },
                      { label:'Got Participants',  v:hasParticipants, color:'#4f46e5' },
                      { label:'Used Check-in',     v:hadCheckin,      color:'#0891b2' },
                      { label:'Completed',         v:completed,       color:'#16a34a' },
                    ].map(r => <CCFunnel key={r.label} {...r} total={created} />);
                  })()}
                </div>
              </Panel>
            </div>

            {/* Feature adoption */}
            <Panel>
              <PanelHead><span className="text-sm font-semibold text-neutral-700">Feature Adoption</span></PanelHead>
              <div className="p-5 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
                {platform?.featureAdoption && Object.entries(platform.featureAdoption).map(([feat, { pct, count }]) => (
                  <div key={feat} className="bg-neutral-50 rounded-xl p-4 border border-neutral-100">
                    <p className="text-xs text-neutral-500 font-medium capitalize mb-2">{feat}</p>
                    <p className="text-2xl font-bold cc-mono text-violet-700">{pct}%</p>
                    <p className="text-xs text-neutral-400 mb-2">{count} events</p>
                    <CCBar v={pct} max={100} color="#7c3aed" />
                  </div>
                ))}
              </div>
            </Panel>

            {/* Power users */}
            <Panel>
              <PanelHead><span className="text-sm font-semibold text-neutral-700">Top Organizers</span></PanelHead>
              <table className="w-full text-sm">
                <thead><tr className="border-b border-neutral-100 bg-neutral-50">
                  <th className="text-left px-5 py-3 text-neutral-500 font-medium">Organiser</th>
                  <th className="text-right px-5 py-3 text-neutral-500 font-medium">Events</th>
                  <th className="text-right px-5 py-3 text-neutral-500 font-medium">Last Active</th>
                </tr></thead>
                <tbody>
                  {platform?.powerUsers?.map((u,i) => (
                    <tr key={u._id} className="border-b border-neutral-100 cc-tr">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-neutral-700 w-4 cc-mono">{i+1}</span>
                          <div><p className="font-bold text-neutral-800">{u.name||'—'}</p><p className="text-neutral-400 cc-mono">{u._id}</p></div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right font-semibold text-violet-700 cc-mono">{u.events}</td>
                      <td className="px-5 py-3 text-right text-neutral-400 cc-mono">{u.lastActive?new Date(u.lastActive).toLocaleDateString():'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Panel>

            {/* Status distribution */}
            {platform?.eventsByStatus && (
              <Panel>
                <PanelHead><span className="text-sm font-semibold text-neutral-700">Event Status Distribution</span></PanelHead>
                <div className="p-4 flex flex-wrap gap-3">
                  {platform.eventsByStatus.map(s => {
                    const clr = {active:'text-emerald-600',completed:'text-blue-600',draft:'text-neutral-500',cancelled:'text-red-500'}[s._id]||'text-neutral-400';
                    return (
                      <div key={s._id} className="bg-neutral-50 rounded-lg px-5 py-3 border border-neutral-100">
                        <p className={`text-xl font-semibold cc-mono ${clr}`}>{s.count}</p>
                        <p className="text-xs text-neutral-500 mt-1">{s._id}</p>
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
              ${threat>=75?'border-red-300 bg-red-50 cc-glow-r':threat>=50?'border-amber-200 bg-amber-50 cc-glow-a':'border-emerald-200 bg-emerald-50 cc-glow-g'}`}>
              <div>
                <p className="text-xs text-neutral-500 tracking-wide font-semibold mb-2">Current Threat Assessment</p>
                <CCThreat score={threat} />
                <p className="text-xs text-neutral-400 mt-1.5">Score: {threat}/100 · Updated: {refreshAt?.toLocaleTimeString()??'—'}</p>
              </div>
              <button onClick={() => fetchAll(['security'])} className="px-3 py-1.5 border border-neutral-200 rounded-lg text-sm text-neutral-500 hover:text-neutral-700 transition-colors font-medium">Re-scan</button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <CCStat label="Errors 1h" value={security?.errLast1h} color={security?.errSpike?'text-red-600':'text-neutral-700'} glow={security?.errSpike?'cc-glow-r':undefined} sub={security?.errSpike?'SPIKE DETECTED':'nominal'} />
              <CCStat label="Errors 24h" value={security?.errLast24h} color="text-neutral-500" />
              <CCStat label="Auth Failures" value={security?.failedLogins?.length} color={security?.failedLogins?.length>5?'text-red-600':'text-neutral-400'} sub="in log buffer" />
              <CCStat label="Flagged Users" value={security?.suspiciousParticipants?.length} color={security?.suspiciousParticipants?.length>0?'text-amber-600':'text-neutral-600'} sub="5+ events/24h" />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <Panel>
                <PanelHead><span className="text-sm font-semibold text-neutral-700">Top Error Patterns</span></PanelHead>
                <div className="divide-y divide-neutral-100">
                  {security?.topErrors?.length ? security.topErrors.map((e,i) => (
                    <div key={i} className="px-5 py-3 flex items-center justify-between gap-3 cc-tr">
                      <p className="text-sm text-neutral-500 cc-mono flex-1 truncate">{e.msg}</p>
                      <Tag color={e.count>10?'red':'neutral'}>{e.count}×</Tag>
                    </div>
                  )) : <p className="px-4 py-4 text-sm text-neutral-400">No error patterns</p>}
                </div>
              </Panel>

              <Panel>
                <PanelHead><span className="text-sm font-semibold text-neutral-700">Auth Failure Log</span></PanelHead>
                <div className="divide-y divide-neutral-100 max-h-48 overflow-y-auto">
                  {security?.failedLogins?.length ? security.failedLogins.slice(0,15).map((e,i) => (
                    <div key={i} className="px-4 py-2 flex items-center justify-between gap-2 cc-tr">
                      <p className="text-sm text-red-600/70 cc-mono flex-1 truncate">{e.msg}</p>
                      <span className="text-xs text-neutral-500 cc-mono shrink-0">{new Date(e.ts).toLocaleTimeString()}</span>
                    </div>
                  )) : <p className="px-4 py-4 text-sm text-neutral-400">No auth failures</p>}
                </div>
              </Panel>
            </div>

            {security?.suspiciousParticipants?.length > 0 && (
              <Panel className="border-amber-200 cc-glow-a">
                <PanelHead><span className="text-xs font-black tracking-wide text-amber-700">Suspicious Participant Activity</span></PanelHead>
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-neutral-100 bg-neutral-50">
                    <th className="text-left px-4 py-2 text-neutral-600 font-semibold uppercase tracking-wider">Username</th>
                    <th className="text-right px-4 py-2 text-neutral-600 font-semibold uppercase tracking-wider">Events (24h)</th>
                  </tr></thead>
                  <tbody>
                    {security.suspiciousParticipants.map((u,i) => (
                      <tr key={i} className="border-b border-neutral-100 cc-tr">
                        <td className="px-4 py-2 cc-mono text-amber-600">{u._id}</td>
                        <td className="px-4 py-2 text-right font-semibold text-amber-600 cc-mono">{u.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Panel>
            )}

            {security?.largeFiles?.length > 0 && (
              <Panel>
                <PanelHead><span className="text-sm font-semibold text-neutral-700">Large File Uploads — Top 10</span></PanelHead>
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-neutral-100 bg-neutral-50">
                    <th className="text-left px-4 py-2 text-neutral-600 font-semibold uppercase tracking-wider">File</th>
                    <th className="text-right px-4 py-2 text-neutral-600 font-semibold uppercase tracking-wider">Size</th>
                    <th className="text-right px-4 py-2 text-neutral-600 font-semibold uppercase tracking-wider">Uploaded</th>
                  </tr></thead>
                  <tbody>
                    {security.largeFiles.map((f,i) => (
                      <tr key={i} className="border-b border-neutral-100 cc-tr">
                        <td className="px-4 py-2 text-neutral-400 truncate max-w-xs">{f.name||'unnamed'}</td>
                        <td className="px-4 py-2 text-right cc-mono text-neutral-800">{f.size?`${(f.size/1048576).toFixed(1)} MB`:'—'}</td>
                        <td className="px-4 py-2 text-right text-neutral-400 cc-mono">{f.uploadedAt?new Date(f.uploadedAt).toLocaleDateString():'—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Panel>
            )}

            {security?.busyEvents?.length > 0 && (
              <Panel>
                <PanelHead><span className="text-sm font-semibold text-neutral-700">High-Participant Events</span></PanelHead>
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-neutral-100 bg-neutral-50">
                    <th className="text-left px-4 py-2 text-neutral-600 font-semibold uppercase tracking-wider">Event</th>
                    <th className="text-right px-4 py-2 text-neutral-600 font-semibold uppercase tracking-wider">Guests</th>
                    <th className="text-right px-4 py-2 text-neutral-600 font-semibold uppercase tracking-wider">Status</th>
                  </tr></thead>
                  <tbody>
                    {security.busyEvents.map((e,i) => (
                      <tr key={i} className="border-b border-neutral-100 cc-tr">
                        <td className="px-4 py-2">
                          <p className="font-bold text-neutral-700 truncate max-w-xs">{e.title}</p>
                          <p className="text-neutral-400 cc-mono">{e.subdomain}</p>
                        </td>
                        <td className="px-4 py-2 text-right font-semibold text-neutral-600 cc-mono">{e.participantCount}</td>
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
              <PanelHead><span className="text-sm font-semibold text-neutral-700">GLOBAL ASSET Search</span></PanelHead>
              <div className="p-4">
                <div className="flex gap-2 mb-4">
                  <input value={sq} onChange={e=>setSq(e.target.value)} onKeyDown={e=>e.key==='Enter'&&globalSearch()}
                    placeholder="Search participants, events, organisers across all data…"
                    className="flex-1 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm text-neutral-800 focus:outline-none focus:border-violet-500 placeholder-neutral-300 cc-mono" />
                  <button onClick={globalSearch} disabled={sLoading||sq.length<2}
                    className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium disabled:opacity-40 transition-colors flex items-center gap-2">
                    {sLoading?<><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block mr-1"/>Scanning</> :<><Search className="w-3 h-3"/>Search</>}
                  </button>
                </div>
                {sr && (
                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                    {[
                      { title:`Participants (${sr.participants?.length})`, items:sr.participants?.map(p=>({ h:p.username, s:`${p.eventTitle} · ${p.checkedIn?'checked in':'not checked in'}` })) },
                      { title:`Events (${sr.events?.length})`, items:sr.events?.map(e=>({ h:e.title, s:`${e.subdomain} · ${e.status} · ${e.participantCount} guests` })) },
                      { title:`Organizers (${sr.organizers?.length})`, items:sr.organizers?.map(o=>({ h:o.name||'—', s:`${o._id} · ${o.events} events` })) },
                    ].map(({ title, items }) => (
                      <div key={title}>
                        <p className="text-xs font-black tracking-wide text-neutral-700 mb-2">{title}</p>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {items?.length ? items.map((it,i) => (
                            <div key={i} className="bg-neutral-50 rounded-lg px-3 py-2 text-sm">
                              <p className="font-bold text-neutral-800">{it.h}</p>
                              <p className="text-neutral-400 cc-mono">{it.s}</p>
                            </div>
                          )) : <p className="text-neutral-700 text-sm">No results</p>}
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
                <PanelHead><span className="text-sm font-semibold text-neutral-700">LIVE CHECK-IN VELOCITY</span></PanelHead>
                <div className="divide-y divide-neutral-100">
                  {events.activeVelocity.map((e,i) => (
                    <div key={i} className="px-5 py-4 flex items-center gap-4 cc-tr">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-neutral-700 truncate">{e.title}</p>
                        <p className="text-xs text-neutral-500 cc-mono">{e.subdomain}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold text-emerald-600 cc-mono">{e.checkedIn}/{e.total}</p>
                        <p className="text-xs text-neutral-400">{e.pct}%</p>
                      </div>
                      <div className="w-20 shrink-0">
                        <CCBar v={e.pct} max={100} color="#22c55e" />
                        {e.last5min>0 && <p className="text-xs text-emerald-600 cc-mono mt-1">{e.last5min}/5min ↑</p>}
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
                  <span className="text-xs font-black tracking-wide text-amber-700">ABANDONED Events ({events.abandonedEvents.length})</span>
                  <button onClick={() => bulkOp('cancel-abandoned',{},'Cancel all abandoned events?')} disabled={bulk}
                    className="text-sm px-3 py-1 border border-amber-300 rounded-lg text-amber-700 hover:bg-amber-50 transition-colors font-black disabled:opacity-40">
                    BULK CANCEL
                  </button>
                </PanelHead>
                <div className="divide-y divide-neutral-100 max-h-52 overflow-y-auto">
                  {events.abandonedEvents.slice(0,20).map((e,i) => (
                    <div key={i} className="px-5 py-3 flex items-center justify-between gap-3 cc-tr">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-neutral-400 truncate">{e.title}</p>
                        <p className="text-xs text-neutral-500 cc-mono">{e.organizerEmail}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-neutral-500 cc-mono">{e.date?new Date(e.date).toLocaleDateString():'—'}</p>
                        <p className="text-xs text-neutral-700">{e.participantCount} guests</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            )}

            {/* Bulk ops */}
            <Panel>
              <PanelHead><span className="text-sm font-semibold text-neutral-700">Bulk Operations</span></PanelHead>
              <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { action:'force-complete-old',  label:'FORCE-COMPLETE OLD',   desc:'Mark active/draft events >7 days past as completed', filter:{days:7}, color:'border-blue-300 text-blue-600',  confirm:'Force-complete all stale active events?' },
                  { action:'delete-empty-drafts', label:'DELETE EMPTY DRAFTS',  desc:'Delete draft events >3 days old with zero guests',   filter:{days:3}, color:'border-red-300 text-red-600',    confirm:'Delete all empty draft events? Cannot be undone.' },
                  { action:'cancel-abandoned',    label:'CANCEL ABANDONED',     desc:'Cancel active events past their date, no check-ins', filter:{},       color:'border-amber-300 text-amber-600', confirm:'Cancel all abandoned events?' },
                ].map(op => (
                  <div key={op.action} className={`rounded-xl border ${op.color} bg-neutral-50 p-3.5`}>
                    <p className="text-xs font-semibold mb-1">{op.label}</p>
                    <p className="text-xs text-neutral-500 mb-3 leading-relaxed">{op.desc}</p>
                    <button onClick={() => bulkOp(op.action, op.filter, op.confirm)} disabled={bulk}
                      className="w-full py-1.5 border border-current rounded-lg text-xs font-semibold disabled:opacity-40 hover:bg-neutral-100 transition-colors">
                      {bulk?'Executing…':'Execute'}
                    </button>
                  </div>
                ))}
              </div>
            </Panel>

            {/* Cleanup preview */}
            {events?.cleanupCandidates?.length > 0 && (
              <Panel>
                <PanelHead><span className="text-sm font-semibold text-neutral-700">Cleanup Candidates — {events.cleanupCandidates.length} CANDIDATES</span></PanelHead>
                <div className="divide-y divide-neutral-100 max-h-40 overflow-y-auto">
                  {events.cleanupCandidates.map((e,i) => (
                    <div key={i} className="px-4 py-2 flex items-center justify-between cc-tr">
                      <p className="text-sm text-neutral-500 truncate">{e.title}</p>
                      <span className="text-xs text-neutral-500 cc-mono shrink-0">{new Date(e.updatedAt).toLocaleDateString()}</span>
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
                <span className="text-xs font-black tracking-wide text-neutral-500 flex items-center gap-2"><Terminal className="w-3.5 h-3.5 text-violet-700"/>Command Dispatch</span>
              </PanelHead>
              <div className="p-5 space-y-4">
                <div>
                  <p className="text-xs text-neutral-400 tracking-wide uppercase mb-2 font-bold">Target Node</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {['backend','router','watchdog'].map(t => (
                      <button key={t} onClick={()=>{setDTarget(t);setDCmd(CMDS[t][0].id);}}
                        className={`py-2 rounded-lg text-sm font-semibold uppercase tracking-wide transition-all ${dTarget===t?'bg-violet-600 text-white':'bg-neutral-100 text-neutral-600 hover:bg-neutral-100 border border-neutral-200'}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-neutral-400 tracking-wide uppercase mb-2 font-bold">Command</p>
                  <div className="space-y-1.5">
                    {CMDS[dTarget].map(cmd => (
                      <button key={cmd.id} onClick={()=>setDCmd(cmd.id)}
                        className={`w-full text-left p-3 rounded-xl transition-colors ${dCmd===cmd.id?'bg-violet-50 border border-violet-300':'bg-neutral-50 hover:bg-neutral-100 border border-transparent'}`}>
                        <p className="text-sm font-semibold text-neutral-800 tracking-wider">{cmd.label}</p>
                        <p className="text-xs text-neutral-500 mt-0.5">{cmd.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-neutral-400 tracking-wide uppercase mb-2 font-bold">Params <span className="normal-case font-normal text-neutral-800">(optional JSON)</span></p>
                  <textarea value={dParams} onChange={e=>setDParams(e.target.value)} rows={3}
                    placeholder='{ "provider": "brevo" }'
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-sm cc-mono text-neutral-700 resize-none focus:outline-none focus:border-violet-500 placeholder-neutral-300" />
                </div>
                <button onClick={dispatch} disabled={dRunning}
                  className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-40">
                  {dRunning?<><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Executing…</>:<><Play className="w-4 h-4"/>Execute Command</>}
                </button>
              </div>
            </Panel>

            <div className="space-y-4">
              {/* Last result */}
              <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-5 flex-1">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-neutral-700">Command Output</p>
                  {cmdLog[0] && <span className="text-xs text-neutral-500 cc-mono bg-neutral-100 px-2 py-0.5 rounded-full">{cmdLog[0].ms}ms</span>}
                </div>
                {!cmdLog.length
                  ? <p className="text-sm text-neutral-400 cc-mono italic">Awaiting command…</p>
                  : <>
                    <div className="flex items-center gap-2 mb-3">
                      <Tag color={cmdLog[0].ok?'green':'red'}>{cmdLog[0].ok?'Success':'Failed'}</Tag>
                      <span className="text-sm text-neutral-600 cc-mono">{cmdLog[0].target} / {cmdLog[0].cmd}</span>
                      <span className="text-xs text-neutral-400 cc-mono ml-auto">{new Date(cmdLog[0].ts).toLocaleTimeString()}</span>
                    </div>
                    <pre className="text-sm cc-mono text-neutral-700 whitespace-pre-wrap overflow-auto max-h-64 bg-white border border-neutral-200 rounded-lg p-3 mt-2">
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
              <span className="text-sm font-semibold text-neutral-700">Email Signal Pool</span>
              <button onClick={() => adminAPI.ccGetEmailPool().then(r=>setPool(r.data.pool)).catch(()=>{})}
                className="px-2.5 py-1.5 border border-neutral-200 rounded-lg text-sm text-neutral-500 hover:text-neutral-700 transition-colors flex items-center gap-1.5">
                <RefreshCw className="w-3 h-3"/> REFRESH
              </button>
            </div>
            {!pool
              ? <div className="rounded-xl bg-neutral-50 p-10 text-center text-neutral-700 text-sm">Email pool unavailable — ensure ROUTER_URL is configured</div>
              : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {Object.entries(pool).filter(([k])=>k!=='_summary').map(([name,p]) => (
                    <Panel key={name}>
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <p className="text-sm font-black tracking-wide text-neutral-800">{p.provider?.toUpperCase()}</p>
                            <p className="text-xs text-neutral-400">{p.totalKeys} key(s) · {(p.monthlyFree||0).toLocaleString()}/mo free</p>
                          </div>
                          <Tag color={p.activeKeys>0?'green':'red'}>{p.activeKeys} ACTIVE</Tag>
                        </div>
                        <div className="space-y-2">
                          {p.keys?.map(k => (
                            <div key={k.index} className={`flex items-center justify-between rounded-lg p-3 ${k.status==='active'?'bg-emerald-50 border border-emerald-200':'bg-red-50 border border-red-200'}`}>
                              <div className="flex items-center gap-2">
                                <Key className={`w-3 h-3 ${k.status==='active'?'text-emerald-600':'text-red-600'}`}/>
                                <span className="text-sm cc-mono text-neutral-500">{k.keySuffix}</span>
                              </div>
                              <div className="text-right text-sm">
                                <p className={`font-black tracking-wider ${k.status==='active'?'text-emerald-600':'text-red-600'}`}>{k.status?.toUpperCase()}</p>
                                {k.resumesAt && <p className="text-neutral-400 cc-mono">{new Date(k.resumesAt).toLocaleTimeString()}</p>}
                                <p className="text-neutral-400 cc-mono">{k.useCount} sends</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        {p.keys?.some(k=>k.status==='suspended') && (
                          <button onClick={async()=>{try{await adminAPI.ccCommand('router','clear-key-suspension',{provider:name});toast.success('Cleared');setTimeout(()=>adminAPI.ccGetEmailPool().then(r=>setPool(r.data.pool)),800);}catch{toast.error('Failed');}}}
                            className="mt-3 w-full py-2 rounded-lg border border-amber-300 text-sm font-semibold text-amber-600 hover:bg-amber-50 tracking-wide transition-colors">
                            UNSUSPEND {name.toUpperCase()} KEYS
                          </button>
                        )}
                      </div>
                    </Panel>
                  ))}
                  {pool._summary && (
                    <div className="lg:col-span-2 rounded-xl border border-violet-500/20 bg-violet-900/10 p-4 flex items-center justify-between">
                      <p className="text-sm text-violet-700 font-black tracking-wide">Total Monthly Free Capacity</p>
                      <p className="text-2xl font-semibold text-violet-700 cc-mono">{(pool._summary.totalMonthlyFree||0).toLocaleString()} emails/mo</p>
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
              <span className="text-sm font-semibold text-neutral-700">Database Storage</span>
              <button onClick={()=>adminAPI.ccGetDb().then(r=>setDb(r.data)).catch(()=>{})}
                className="px-2.5 py-1.5 border border-neutral-200 rounded-lg text-sm text-neutral-500 hover:text-neutral-700 transition-colors flex items-center gap-1.5">
                <RefreshCw className="w-3 h-3"/> REFRESH
              </button>
            </div>
            {!db
              ? <div className="rounded-xl bg-neutral-50 p-10 text-center text-neutral-700 text-sm">Loading database…</div>
              : <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <CCStat label="Collections" value={db.collections?.length} />
                  <CCStat label="DB State" value={db.state?.toUpperCase()} color={db.state==='connected'?'text-emerald-600':'text-red-600'} />
                  <CCStat label="Database" value={db.dbName} color="text-violet-700" />
                </div>
                <Panel>
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-neutral-200 bg-neutral-50">
                      {['Collection','Docs','Data','Indexes','Avg Doc'].map(h=>(
                        <th key={h} className={`${h==='Collection'?'text-left':'text-right'} px-5 py-4 text-neutral-600 font-semibold uppercase tracking-wider`}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {db.collections?.map(c => (
                        <tr key={c.name} className="border-b border-neutral-100 cc-tr">
                          <td className="px-5 py-3 cc-mono text-neutral-800">{c.name}</td>
                          <td className="px-5 py-3 text-right text-neutral-500 cc-mono">{(c.count||0).toLocaleString()}</td>
                          <td className="px-5 py-3 text-right text-neutral-500 cc-mono">{c.sizeMB} MB</td>
                          <td className="px-5 py-3 text-right text-neutral-500 cc-mono">{c.indexSizeMB} MB</td>
                          <td className="px-5 py-3 text-right text-neutral-400 cc-mono">{c.avgObjSize?`${c.avgObjSize}B`:'—'}</td>
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
              <CCStat label="WS Connections" value={runtime?.wsStats?.connected??'—'} color="text-blue-600" sub={runtime?.wsStats?.note} />
              <CCStat label="WS Rooms" value={runtime?.wsStats?.rooms??'—'} color="text-blue-500" />
              <CCStat label="Redis Mode" value={runtime?.redisHealth?.mode?.toUpperCase()??'—'} color={runtime?.redisHealth?.connected?'text-emerald-600':'text-amber-600'} sub={runtime?.redisHealth?.pingOk?`${runtime.redisHealth.pingMs}ms`:'in-memory'} />
              <CCStat label="Config Score" value={runtime?`${runtime.configScore}%`:'—'} color={runtime?.configScore>=80?'text-emerald-600':runtime?.configScore>=50?'text-amber-600':'text-red-600'} />
            </div>

            {runtime?.process && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                <Panel>
                  <PanelHead><span className="text-sm font-semibold text-neutral-700">Process Vitals</span></PanelHead>
                  <div className="p-4 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                      {[['PID',runtime.process.pid],['NODE',runtime.process.node],['UPTIME',fmtUptime(runtime.process.uptime)],
                        ['CPU CORES',runtime.process.cpuCount],['LOAD 1m',runtime.process.loadAvg?.[0]],['LOAD 5m',runtime.process.loadAvg?.[1]]
                      ].map(([l,v]) => (
                        <div key={l} className="bg-neutral-50 rounded-lg p-2">
                          <p className="text-neutral-500 text-xs uppercase tracking-wider mb-0.5">{l}</p>
                          <p className="font-semibold text-neutral-700 cc-mono">{v??'—'}</p>
                        </div>
                      ))}
                    </div>
                    <div className="bg-neutral-50 rounded-lg p-3">
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="text-neutral-600 font-medium">Heap Memory</span>
                        <span className="text-neutral-500 cc-mono">{runtime.process.memMB.heapUsed}/{runtime.process.memMB.heapTotal} MB</span>
                      </div>
                      <CCBar v={runtime.process.memMB.heapUsed} max={runtime.process.memMB.heapTotal} color="#7c3aed" />
                    </div>
                    <div className="bg-neutral-50 rounded-lg p-3">
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="text-neutral-600 font-medium">System Memory</span>
                        <span className="text-neutral-500 cc-mono">{runtime.process.totalMemMB-runtime.process.freeMemMB}/{runtime.process.totalMemMB} MB</span>
                      </div>
                      <CCBar v={runtime.process.totalMemMB-runtime.process.freeMemMB} max={runtime.process.totalMemMB} color="#0891b2" />
                    </div>
                  </div>
                </Panel>

                {runtime.config && (
                  <Panel>
                    <PanelHead><span className="text-sm font-semibold text-neutral-700">Environment Configuration</span></PanelHead>
                    <div className="p-4 space-y-1.5">
                      {runtime.config.map(c => (
                        <div key={c.key} className={`flex items-center justify-between px-3 py-2 rounded-lg ${c.set?'bg-emerald-50 border border-emerald-200':'bg-red-50 border border-red-200'}`}>
                          <span className="text-sm text-neutral-500">{c.label}</span>
                          <Tag color={c.set?'green':'red'}>{c.set ? 'SET' : 'MISSING'}</Tag>
                        </div>
                      ))}
                    </div>
                  </Panel>
                )}
              </div>
            )}
            <button onClick={()=>fetchAll(['runtime'])} className="px-3 py-2 border border-neutral-200 rounded-lg text-sm text-neutral-500 hover:text-neutral-700 transition-colors flex items-center gap-1.5">
              <RefreshCw className="w-3 h-3"/> Refresh Runtime
            </button>
          </div>
        )}

        {/* ═══════════════ AUDIT ═══════════════ */}
        {tab === 'audit' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-neutral-700">Command Audit Log ({cmdLog.length})</span>
              {cmdLog.length>0 && <button onClick={()=>setCmdLog([])} className="text-sm text-neutral-400 hover:text-red-600 transition-colors">CLEAR</button>}
            </div>
            {!cmdLog.length
              ? <div className="rounded-xl bg-neutral-50 border border-neutral-100 p-14 text-center text-neutral-800 text-sm tracking-wide">No commands executed this session</div>
              : <div className="space-y-2">
                {cmdLog.map((e,i) => (
                  <div key={i} className={`rounded-xl border p-4 ${e.ok?'bg-emerald-50 border-emerald-200':'bg-red-50 border-red-200'}`}>
                    <div className="flex items-center gap-3 mb-2 text-sm">
                      <Tag color={e.ok?'green':'red'}>{e.ok?'OK':'FAIL'}</Tag>
                      <span className="cc-mono text-neutral-500">{e.target} / {e.cmd}</span>
                      <span className="text-neutral-400 cc-mono">{e.ms}ms</span>
                      <span className="ml-auto text-neutral-400 cc-mono">{new Date(e.ts).toLocaleTimeString()}</span>
                    </div>
                    <pre className="text-sm cc-mono text-neutral-600 whitespace-pre-wrap overflow-auto max-h-36 bg-white border border-neutral-200 rounded-lg p-3 mt-2">
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




// ─── Blocklist Panel ──────────────────────────────────────────────────────────
// ─── Blocklist Panel ──────────────────────────────────────────────────────────

// Comprehensive public bad-words list (subset of common offensive terms).
// Words here are matched as substrings — any name/text CONTAINING one of these is blocked.
const PUBLIC_BAD_WORDS = [
  "fuck","shit","ass","bitch","cunt","dick","cock","pussy","whore","slut",
  "nigger","nigga","faggot","fag","retard","kike","spic","chink","gook","wetback",
  "bastard","twat","prick","wanker","asshole","arsehole","bollocks","motherfucker",
  "fucker","fucking","bullshit","jackass","dumbass","douchebag","piss","pissed",
  "crap","damn","hell","boner","dildo","blowjob","handjob","rimjob","cumshot",
  "jizz","cum","spunk","tits","boobs","boob","nipple","vagina","penis","anus",
  "anal","arse","skank","hoe","thot","tranny","shemale","trannyfucker","rape",
  "rapist","pedophile","pedo","molest","molester","necrophile","necro","bestiality",
  "zoophile","incest","racist","nazism","nazi","kkk","hitler","genocide","slavery",
  "terrorist","suicide","kill","murder","stab","shoot","bomb","explode","massacre",
  "gore","decapitate","torture","drugs","cocaine","heroin","meth","crack","fentanyl",
  "opioid","xanax","mdma","ecstasy","lsd","overdose","pimp","porn","porno","xxx",
  "nudes","sexting","onlyfans","escort","hooker","prostitute","brothel",
  "incel","simp","groomer","groom","predator","creep","stalker",
  "loser","idiot","moron","imbecile","stupid","dumb","ugly","freak","garbage",
  "scum","trash","filth","vermin","parasite","cocksucker","shithead","fucktard",
  "dipshit","numbnuts","dingbat","schmuck","prick","knobhead","bellend",
  "minge","fanny","knob","bumhole","shitter","skidmark","rimmer","spunk",
  "spunky","wank","wanking","tosser","twatwaffle","asshat","asswipe",
  "dickhead","dickwad","dickface","dumbfuck","fuckface","fuckwit","fucknugget",
  "shitbag","shitface","shitgibbon","shitstain","shitshow","clusterfuck",
  "goatfucker","sheepfucker","pigfucker","cunting","cuntface","cunthole",
  "cuntrag","twathead","twatlips","nutjob","psycho","maniac","lunatic",
  "crackhead","junkie","druggie","drunkard","alcoholic","deadbeat","loafer",
  "dyke","queer","homo","tranny","shim","it","heshe","crossdresser",
  "kike","spook","coon","darky","wetback","beaner","gook","zipperhead",
  "towelhead","sandnigger","camel jockey","raghead","cracker","honkey","whitey",
  "chink","slope","slant","nip","dago","wop","mick","paddy","kraut","fritz",
  "frenchie","frog","greaser","spic","spick","gringo","halfbreed","mulatto",
  "uppity","thug","ghetto","hood","ratchet","redneck","hillbilly","white trash",
  "trailer trash","bumpkin","hick","yokel","rube","guttersnipe","lowlife",
].map(w => w.toLowerCase());

function blocklistMatchesEntry(input, entryValue, matchType) {
  if (!input || !entryValue) return false;
  const haystack = input.toLowerCase();
  const needle   = entryValue.toLowerCase();
  if (matchType === 'contains') return haystack.includes(needle);
  if (matchType === 'regex') {
    try { return new RegExp(needle, 'i').test(input); } catch { return false; }
  }
  return haystack === needle; // exact
}

// Check a value against the public bad words list (always substring match)
function containsPublicBadWord(value) {
  const v = value.toLowerCase();
  return PUBLIC_BAD_WORDS.find(w => v.includes(w)) || null;
}

function BlocklistPanel() {
  const makeEmpty = () => ({ type: 'name', value: '', reason: '', permanent: true, expiresAt: '', matchType: 'contains' });
  const [entries, setEntries]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [loadError, setLoadError]   = useState(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const [form, setForm]             = useState(makeEmpty);
  const [adding, setAdding]         = useState(false);
  const [showAdd, setShowAdd]       = useState(false);
  const [bulkMode, setBulkMode]     = useState(false);
  const [bulkText, setBulkText]     = useState('');
  const [bulkProgress, setBulkProgress] = useState(null);
  const [search, setSearch]         = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting]     = useState(false);
  const [showPublicList, setShowPublicList] = useState(false);

  const TYPE_META = {
    ip:    { label: 'IP Address',   bgClass: 'bg-red-100',    textClass: 'text-red-700',    badgeClass: 'bg-red-100 text-red-800',    icon: Shield,   desc: 'Blocked at the gateway — every request from this IP is rejected.' },
    event: { label: 'Event',        bgClass: 'bg-amber-100',  textClass: 'text-amber-700',  badgeClass: 'bg-amber-100 text-amber-800',  icon: Calendar, desc: 'Blocks access to a specific event workspace by subdomain.' },
    name:  { label: 'Display Name', bgClass: 'bg-violet-100', textClass: 'text-violet-700', badgeClass: 'bg-violet-100 text-violet-800', icon: UserX,    desc: 'Prevents a username from joining any workspace. Use "contains" to catch variations.' },
  };

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const r = await adminAPI.getBlocklist();
      setEntries(Array.isArray(r?.data?.entries) ? r.data.entries : []);
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Unknown error';
      setLoadError(msg);
      toast.error(`Failed to load blocklist: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    const val = form.value.trim();
    if (!val) { toast.error('Value is required'); return; }
    if (!form.permanent && !form.expiresAt) { toast.error('Expiry date is required for temporary bans'); return; }
    setAdding(true);
    try {
      await adminAPI.addBlock({
        type:      form.type,
        value:     val,
        reason:    form.reason.trim(),
        permanent: !!form.permanent,
        expiresAt: (!form.permanent && form.expiresAt) ? form.expiresAt : null,
        matchType: form.type === 'name' ? (form.matchType || 'contains') : 'exact',
      });
      toast.success(`${TYPE_META[form.type].label} blocked successfully`);
      setForm(makeEmpty());
      setShowAdd(false);
      await load();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to add entry');
    } finally {
      setAdding(false);
    }
  };

  const handleBulkAdd = async () => {
    const words = bulkText
      .split(/[\s,\n]+/)
      .map(w => w.trim().toLowerCase())
      .filter(w => w.length > 0);
    if (words.length === 0) { toast.error('Paste at least one word'); return; }
    setAdding(true);
    setBulkProgress({ done: 0, total: words.length, failed: 0 });
    let failed = 0;
    for (let i = 0; i < words.length; i++) {
      try {
        await adminAPI.addBlock({
          type:      form.type,
          value:     words[i],
          reason:    form.reason.trim() || 'Bulk import',
          permanent: !!form.permanent,
          expiresAt: (!form.permanent && form.expiresAt) ? form.expiresAt : null,
          matchType: form.type === 'name' ? 'contains' : 'exact',
        });
      } catch { failed++; }
      setBulkProgress({ done: i + 1, total: words.length, failed });
    }
    setAdding(false);
    setBulkProgress(null);
    const succeeded = words.length - failed;
    if (succeeded > 0) toast.success(`${succeeded} word${succeeded !== 1 ? 's' : ''} added to blocklist`);
    if (failed > 0) toast.error(`${failed} failed (already blocked?)`);
    setBulkText('');
    setShowAdd(false);
    setBulkMode(false);
    await load();
  };

  const loadPublicList = () => {
    setBulkText(PUBLIC_BAD_WORDS.join('\n'));
    setBulkMode(true);
    setForm(f => ({ ...f, type: 'name', reason: 'Public bad-words list', matchType: 'contains' }));
    setShowAdd(true);
    setShowPublicList(false);
    toast.success(`${PUBLIC_BAD_WORDS.length} words loaded — review and click Add`);
  };

  const confirmAndDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await adminAPI.deleteBlock(confirmDelete.id);
      toast.success('Entry removed');
      setEntries(prev => prev.filter(e => e._id !== confirmDelete.id));
      setConfirmDelete(null);
    } catch {
      toast.error('Failed to remove entry');
    } finally {
      setDeleting(false);
    }
  };

  const filtered = entries.filter(e => {
    if (typeFilter !== 'all' && e.type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!e.value?.toLowerCase().includes(q) && !e.reason?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const counts = { all: entries.length, ip: 0, event: 0, name: 0 };
  entries.forEach(e => { if (counts[e.type] !== undefined) counts[e.type]++; });

  // Live preview: does current form value match any existing entry?
  const liveMatchWarning = (() => {
    if (!form.value.trim() || form.type !== 'name') return null;
    const publicMatch = containsPublicBadWord(form.value.trim());
    if (publicMatch) return `Already in public bad-words list ("${publicMatch}")`;
    const existingMatch = entries.find(e =>
      e.type === 'name' && blocklistMatchesEntry(form.value.trim(), e.value, e.matchType || 'contains')
    );
    if (existingMatch) return `Would be caught by existing entry "${existingMatch.value}"`;
    return null;
  })();

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
            <Ban className="w-5 h-5 text-red-600" /> Blocklist
          </h2>
          <p className="text-sm text-neutral-500 mt-0.5">
            Block IPs, events, or display names. Name blocks use substring matching by default — any name <em>containing</em> a blocked word is rejected.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowPublicList(v => !v)}
            className="btn bg-violet-600 hover:bg-violet-700 text-white gap-2 text-sm"
          >
            <Download className="w-4 h-4" /> Public word list
          </button>
          <button
            type="button"
            onClick={() => { setShowAdd(v => !v); setForm(makeEmpty()); setBulkMode(false); setBulkText(''); }}
            className="btn bg-red-600 hover:bg-red-700 text-white gap-2 text-sm"
          >
            <Plus className="w-4 h-4" /> Add Entry
          </button>
        </div>
      </div>

      {/* Public list preview panel */}
      {showPublicList && (
        <div className="card p-5 border-violet-200 bg-violet-50">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-violet-900">Public Bad-Words List</h3>
              <p className="text-xs text-violet-600 mt-0.5">{PUBLIC_BAD_WORDS.length} terms. All loaded as <strong>name contains</strong> rules — any display name containing one of these words will be blocked automatically.</p>
            </div>
            <button type="button" onClick={() => setShowPublicList(false)} className="text-violet-400 hover:text-violet-700"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex flex-wrap gap-1.5 mb-4 max-h-36 overflow-y-auto p-2 bg-white rounded-xl border border-violet-200">
            {PUBLIC_BAD_WORDS.map(w => (
              <span key={w} className="text-xs font-mono bg-red-50 border border-red-200 text-red-700 px-1.5 py-0.5 rounded">{w}</span>
            ))}
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setShowPublicList(false)} className="btn btn-secondary text-sm">Cancel</button>
            <button type="button" onClick={loadPublicList} className="btn bg-violet-600 hover:bg-violet-700 text-white gap-2 text-sm">
              <Download className="w-4 h-4" /> Load all {PUBLIC_BAD_WORDS.length} words into bulk import
            </button>
          </div>
        </div>
      )}

      {/* Load error banner */}
      {loadError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700 flex-1">Could not load blocklist: <span className="font-mono">{loadError}</span></p>
          <button type="button" onClick={load} className="text-xs font-semibold text-red-600 hover:underline">Retry</button>
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="card p-5 border-red-200 bg-red-50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-neutral-800 flex items-center gap-2">
              <Plus className="w-4 h-4 text-red-600" /> New Blocklist Entry
            </h3>
            <button
              type="button"
              onClick={() => { setBulkMode(v => !v); setBulkText(''); }}
              className={`text-xs font-semibold px-3 py-1 rounded-full border transition-all ${bulkMode ? 'bg-red-600 text-white border-red-600' : 'bg-white text-red-600 border-red-300 hover:border-red-500'}`}
            >
              {bulkMode ? 'Single mode' : 'Bulk import'}
            </button>
          </div>
          <div className="space-y-4">
            {/* Type selector */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {Object.entries(TYPE_META).map(([k, v]) => {
                const Icon = v.icon;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, type: k }))}
                    className={`flex flex-col items-start gap-1.5 p-3 rounded-xl border-2 text-left transition-all ${
                      form.type === k ? 'border-red-500 bg-white shadow-sm' : 'border-neutral-200 bg-white hover:border-neutral-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${form.type === k ? 'text-red-600' : 'text-neutral-400'}`} />
                      <span className={`text-xs font-bold ${form.type === k ? 'text-red-700' : 'text-neutral-600'}`}>{v.label}</span>
                    </div>
                    <p className="text-xs text-neutral-400 leading-4">{v.desc}</p>
                  </button>
                );
              })}
            </div>

            {/* Match type (name only) */}
            {form.type === 'name' && !bulkMode && (
              <div className="flex items-center gap-4 p-3 bg-white rounded-xl border border-neutral-200">
                <span className="text-xs font-bold text-neutral-600">Match mode:</span>
                {[
                  { val: 'contains', label: 'Contains', desc: 'Blocks any name with this word anywhere in it (recommended)' },
                  { val: 'exact',    label: 'Exact',    desc: 'Only blocks this exact string' },
                  { val: 'regex',    label: 'Regex',    desc: 'Custom regex pattern' },
                ].map(({ val, label, desc }) => (
                  <label key={val} className="flex items-center gap-1.5 cursor-pointer group" title={desc}>
                    <input type="radio" name="matchType" value={val}
                      checked={form.matchType === val}
                      onChange={() => setForm(f => ({ ...f, matchType: val }))}
                      className="accent-red-600" />
                    <span className={`text-xs font-semibold ${form.matchType === val ? 'text-red-700' : 'text-neutral-500'}`}>{label}</span>
                  </label>
                ))}
                <p className="text-xs text-neutral-400 ml-auto hidden sm:block">
                  {form.matchType === 'contains' && '"fuck" blocks: fuckyou, omgfuck123, fucking'}
                  {form.matchType === 'exact' && '"fuck" only blocks the exact word "fuck"'}
                  {form.matchType === 'regex' && 'e.g. "f[u@4][c<][k]" blocks leetspeak variations'}
                </p>
              </div>
            )}

            {/* Bulk textarea OR single value+reason */}
            {bulkMode ? (
              <div>
                <label className="block text-xs font-semibold text-neutral-600 mb-1">
                  Words to block <span className="text-red-500">*</span>
                  <span className="ml-2 font-normal text-neutral-400">— paste comma, space, or newline separated</span>
                </label>
                <textarea
                  className="input text-sm font-mono w-full h-36 resize-y"
                  placeholder={"fuck, shit, asshole\nbadword1, badword2\nor one per line"}
                  value={bulkText}
                  onChange={e => setBulkText(e.target.value)}
                />
                {bulkText.trim() && (
                  <p className="text-xs text-neutral-500 mt-1">
                    {bulkText.split(/[\s,\n]+/).filter(w => w.trim()).length} words detected — all added as <strong>contains</strong> matches
                  </p>
                )}
                <div className="mt-3">
                  <label className="block text-xs font-semibold text-neutral-600 mb-1">Reason (applied to all)</label>
                  <input
                    type="text"
                    className="input text-sm"
                    placeholder="e.g. Profanity filter"
                    value={form.reason}
                    onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 mb-1">
                    {form.type === 'ip' ? 'IP Address' : form.type === 'event' ? 'Event subdomain' : 'Word or pattern'}
                    <span className="text-red-500 ml-0.5">*</span>
                  </label>
                  <input
                    type="text"
                    className="input text-sm font-mono"
                    placeholder={form.type === 'ip' ? '192.168.1.1' : form.type === 'event' ? 'my-event-slug' : form.matchType === 'regex' ? 'f[u@4][c<][k]' : 'badword'}
                    value={form.value}
                    onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                  />
                  {liveMatchWarning && (
                    <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 flex-shrink-0" /> {liveMatchWarning}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-600 mb-1">Reason (internal note)</label>
                  <input
                    type="text"
                    className="input text-sm"
                    placeholder="e.g. Profanity, TOS violation"
                    value={form.reason}
                    onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                  />
                </div>
              </div>
            )}

            {/* Duration */}
            <div className="flex items-center gap-6 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={form.permanent}
                  onChange={e => setForm(f => ({ ...f, permanent: e.target.checked, expiresAt: '' }))}
                  className="accent-red-600"
                />
                <span className="text-sm font-medium text-neutral-700">Permanent ban</span>
              </label>
              {!form.permanent && (
                <div className="flex items-center gap-2">
                  <label className="text-xs font-semibold text-neutral-600">Expires at</label>
                  <input
                    type="datetime-local"
                    className="input text-sm py-1.5"
                    value={form.expiresAt}
                    onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))}
                  />
                </div>
              )}
            </div>

            {/* Progress bar (bulk only) */}
            {bulkProgress && (
              <div>
                <div className="flex justify-between text-xs text-neutral-500 mb-1">
                  <span>Adding {bulkProgress.done} / {bulkProgress.total}…</span>
                  {bulkProgress.failed > 0 && <span className="text-red-500">{bulkProgress.failed} failed</span>}
                </div>
                <div className="h-2 bg-neutral-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-red-500 transition-all duration-150"
                    style={{ width: `${Math.round((bulkProgress.done / bulkProgress.total) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => { setShowAdd(false); setForm(makeEmpty()); setBulkMode(false); setBulkText(''); }} className="btn btn-secondary text-sm">Cancel</button>
              <button
                type="button"
                disabled={adding}
                onClick={bulkMode ? handleBulkAdd : handleAdd}
                className="btn bg-red-600 hover:bg-red-700 text-white text-sm gap-2 disabled:opacity-60"
              >
                {adding ? <span className="spinner w-4 h-4 border-2 border-white/30 border-t-white" /> : <Ban className="w-4 h-4" />}
                {bulkMode ? `Add ${bulkText.trim() ? bulkText.split(/[\s,\n]+/).filter(w => w.trim()).length + ' words' : 'words'} to blocklist` : 'Add to blocklist'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { key: 'all',   label: 'Total' },
          { key: 'ip',    label: 'IP Bans' },
          { key: 'event', label: 'Event Blocks' },
          { key: 'name',  label: 'Name Blocks' },
        ].map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTypeFilter(key)}
            className={`card p-4 text-left transition-all hover:shadow-md ${typeFilter === key ? 'ring-2 ring-neutral-900' : ''}`}
          >
            <p className="text-2xl font-bold text-neutral-900">{counts[key]}</p>
            <p className="text-xs text-neutral-500 mt-0.5">{label}</p>
          </button>
        ))}
      </div>

      {/* How matching works info box */}
      <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
        <p className="text-xs font-bold text-blue-800 mb-1.5">How name blocking works</p>
        <p className="text-xs text-blue-700 leading-relaxed">
          Name entries use <strong>contains</strong> matching by default — a blocked word of <code className="font-mono bg-white px-1 rounded border border-blue-200">fuck</code> will block <em>fuckyou</em>, <em>omgfuck123</em>, and <em>fucking</em>. IP and event entries always use exact matching. The backend checks every display name at join time against all entries of type <strong>name</strong>.
        </p>
      </div>

      {/* Search + list */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-neutral-200 flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[160px] max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Search value or reason…"
              className="input pl-9 text-sm py-1.5 w-full"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {['all', 'ip', 'event', 'name'].map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${typeFilter === t ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
              >
                {t === 'all' ? 'All' : TYPE_META[t].label}
              </button>
            ))}
          </div>
          <button type="button" onClick={load} className="btn btn-ghost p-1.5 ml-auto" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <span className="spinner w-6 h-6 border-2 border-neutral-300 border-t-neutral-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Ban className="w-10 h-10 text-neutral-200 mb-3" />
            <p className="text-sm font-semibold text-neutral-500">
              {entries.length === 0 ? 'No blocklist entries yet' : 'No entries match your filter'}
            </p>
            <p className="text-xs text-neutral-400 mt-1">
              {entries.length === 0 ? 'Add an IP, event, or name to start blocking.' : 'Try a different search or filter.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {filtered.map(entry => {
              const meta = TYPE_META[entry.type] || TYPE_META.ip;
              const MetaIcon = meta.icon;
              const isExpired = entry.expiresAt && new Date(entry.expiresAt) < new Date();
              const matchBadge = entry.type === 'name' ? (entry.matchType || 'contains') : null;
              return (
                <div key={entry._id} className={`flex items-start gap-4 px-5 py-4 hover:bg-neutral-50 transition-colors ${isExpired ? 'opacity-50' : ''}`}>
                  <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${meta.bgClass}`}>
                    <MetaIcon className={`w-4 h-4 ${meta.textClass}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <code className="text-sm font-mono font-bold text-neutral-900 break-all">{entry.value}</code>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${meta.badgeClass}`}>
                        {meta.label}
                      </span>
                      {matchBadge && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          matchBadge === 'contains' ? 'bg-violet-100 text-violet-800' :
                          matchBadge === 'regex'    ? 'bg-blue-100 text-blue-800' :
                          'bg-neutral-100 text-neutral-600'
                        }`}>
                          {matchBadge === 'contains' ? 'contains' : matchBadge === 'regex' ? 'regex' : 'exact'}
                        </span>
                      )}
                      {entry.permanent && !isExpired && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">Permanent</span>
                      )}
                      {isExpired && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-neutral-100 text-neutral-500">Expired</span>
                      )}
                      {!entry.permanent && !isExpired && entry.expiresAt && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
                          Expires {rel(entry.expiresAt)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-neutral-400">
                      {entry.reason && <span className="italic">"{entry.reason}"</span>}
                      <span>Added {rel(entry.createdAt)}</span>
                      {entry.addedBy && <span>by {entry.addedBy}</span>}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete({ id: entry._id, value: entry.value })}
                    className="flex-shrink-0 p-1.5 text-neutral-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Remove from blocklist"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Redis tip */}
      <div className="card p-4 bg-neutral-50 border-neutral-200">
        <p className="text-xs font-semibold text-neutral-600 mb-1 flex items-center gap-1.5">
          <Database className="w-3.5 h-3.5" /> Manual Redis ban (alternative)
        </p>
        <p className="text-xs text-neutral-500 leading-relaxed">
          IP bans added here are also written to Redis immediately. You can also ban an IP directly in the Upstash dashboard by creating key{' '}
          <code className="font-mono bg-white border border-neutral-200 rounded px-1">sec:ban:1.2.3.4</code> with value{' '}
          <code className="font-mono bg-white border border-neutral-200 rounded px-1">1</code>.
          No TTL = permanent. Delete the key to unban.
        </p>
      </div>

      {/* Delete confirm modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 px-4" onClick={() => setConfirmDelete(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                <Trash className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-neutral-900 text-sm">Remove from blocklist?</h3>
                <p className="text-xs text-neutral-500 mt-0.5">This will grant immediate access again.</p>
              </div>
            </div>
            <div className="bg-neutral-50 rounded-xl px-4 py-2.5 mb-5">
              <code className="text-sm font-mono font-bold text-neutral-800 break-all">{confirmDelete.value}</code>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setConfirmDelete(null)} className="btn btn-secondary flex-1 text-sm">Cancel</button>
              <button
                type="button"
                onClick={confirmAndDelete}
                disabled={deleting}
                className="btn bg-red-600 hover:bg-red-700 text-white flex-1 text-sm gap-2 disabled:opacity-60"
              >
                {deleting ? <span className="spinner w-4 h-4 border-2 border-white/30 border-t-white" /> : <Trash className="w-4 h-4" />}
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

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
  // ── Template & campaign settings ──
  const [templates, setTemplates]     = useState([]);
  const [selected, setSelected]       = useState('');
  const [subject, setSubject]         = useState('');
  const [ctaUrl, setCtaUrl]           = useState('https://planit.app');
  const [campaignLabel, setCampaignLabel] = useState('');
  const [sendAt, setSendAt]           = useState('');
  const [mode, setMode]               = useState('send'); // 'send' | 'schedule' | 'scheduled'

  // ── Recipients: structured rows with per-person data ──
  // Each row: { id, email, firstName, lastName, company, source, selected }
  const [rows, setRows]               = useState([]);
  const [rowFilter, setRowFilter]     = useState('');

  // ── Search / import ──
  const [importing, setImporting]     = useState(false);
  const [importDone, setImportDone]   = useState(false);

  // ── Manual add ──
  const [manualEmail, setManualEmail] = useState('');

  // ── Send state ──
  const [sending, setSending]         = useState(false);
  const [scheduling, setScheduling]   = useState(false);
  const [result, setResult]           = useState(null);

  // ── Preview ──
  const [previewHtml, setPreviewHtml]   = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  // ── Scheduled campaigns ──
  const [scheduled, setScheduled]         = useState([]);
  const [scheduledLoading, setScheduledLoading] = useState(false);

  // ── Load templates on mount ──
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

  // ── Refresh preview when template or CTA changes ──
  useEffect(() => {
    if (!selected) { setPreviewHtml(''); return; }
    setPreviewLoading(true);
    const params = ctaUrl ? `?ctaUrl=${encodeURIComponent(ctaUrl)}` : '';
    api.get(`/admin/marketing/preview/${selected}${params}`, { responseType: 'text' })
      .then(r => setPreviewHtml(typeof r.data === 'string' ? r.data : JSON.stringify(r.data)))
      .catch(() => toast.error('Could not load preview'))
      .finally(() => setPreviewLoading(false));
  }, [selected, ctaUrl]);

  // ── Load scheduled campaigns ──
  const loadScheduled = async () => {
    setScheduledLoading(true);
    try { const r = await adminAPI.getScheduledCampaigns(); setScheduled(r.data.scheduled || []); }
    catch { toast.error('Could not load scheduled campaigns'); }
    finally { setScheduledLoading(false); }
  };
  useEffect(() => { if (mode === 'scheduled') loadScheduled(); }, [mode]);

  // ── Template change ──
  const handleTemplateChange = (id) => {
    setSelected(id);
    const tpl = templates.find(t => t.id === id);
    if (tpl) setSubject(tpl.defaultSubject);
    setResult(null);
  };

  // ── Import ALL contacts from platform ──
  // Searches with empty string to get everything, then merges with existing rows
  const handleImport = async () => {
    setImporting(true);
    try {
      // Use a broad search to pull all organizers, participants, and users
      const [r1, r2, r3] = await Promise.allSettled([
        adminAPI.ccGlobalSearch(''),
        adminAPI.ccGlobalSearch('a'),
        adminAPI.ccGlobalSearch('e'),
      ]);

      const all = [];
      const addFrom = (result, sourceKey, nameKey, idKey) => {
        if (result.status === 'fulfilled' && result.value.data?.[sourceKey]) {
          result.value.data[sourceKey].forEach(item => {
            if (item.email) all.push({
              email: item.email.trim().toLowerCase(),
              name: item[nameKey] || item.name || item.orgName || '',
              source: sourceKey === 'organizers' ? 'Organizer' : sourceKey === 'participants' ? 'Participant' : 'User',
            });
          });
        }
      };

      [r1, r2, r3].forEach(r => {
        addFrom(r, 'organizers',   'name',     '_id');
        addFrom(r, 'participants', 'username', '_id');
        addFrom(r, 'users',        'name',     '_id');
      });

      // Deduplicate by email
      const seen = new Set();
      const unique = all.filter(p => p.email && !seen.has(p.email) && seen.add(p.email));

      if (unique.length === 0) {
        toast('No contacts found in the platform database.');
        setImporting(false);
        return;
      }

      // Merge with existing rows (don't duplicate)
      setRows(prev => {
        const existingEmails = new Set(prev.map(r => r.email));
        const newRows = unique
          .filter(p => !existingEmails.has(p.email))
          .map(p => {
            const parts = (p.name || '').trim().split(/\s+/);
            return {
              id: Math.random().toString(36).slice(2),
              email: p.email,
              firstName: parts[0] || '',
              lastName: parts.slice(1).join(' ') || '',
              company: '',
              source: p.source,
              selected: true,
            };
          });
        return [...prev, ...newRows];
      });

      toast.success(`Imported ${unique.length} contacts from your platform`);
      setImportDone(true);
    } catch (err) {
      toast.error('Import failed — check your connection');
    }
    setImporting(false);
  };

  // ── Add a single row manually ──
  const addManualRow = () => {
    const email = manualEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast.error('Enter a valid email address');
    if (rows.find(r => r.email === email)) return toast.error('That email is already in the list');
    setRows(prev => [...prev, { id: Math.random().toString(36).slice(2), email, firstName: '', lastName: '', company: '', source: 'Manual', selected: true }]);
    setManualEmail('');
  };

  // ── Paste multiple emails into the table ──
  const handlePaste = (e) => {
    const text = e.clipboardData.getData('text');
    const emails = text.split(/[\n,;]+/).map(s => s.trim().toLowerCase()).filter(s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s));
    if (emails.length < 2) return; // single email — let normal paste handle it
    e.preventDefault();
    setRows(prev => {
      const existing = new Set(prev.map(r => r.email));
      const newRows = emails.filter(e => !existing.has(e)).map(email => ({
        id: Math.random().toString(36).slice(2), email, firstName: '', lastName: '', company: '', source: 'Manual', selected: true,
      }));
      if (newRows.length) toast.success(`Added ${newRows.length} email${newRows.length === 1 ? '' : 's'}`);
      return [...prev, ...newRows];
    });
  };

  // ── Row edit helpers ──
  const updateRow = (id, field, value) => setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  const removeRow = (id) => setRows(prev => prev.filter(r => r.id !== id));
  const toggleRow = (id) => updateRow(id, 'selected', !rows.find(r => r.id === id)?.selected);
  const toggleAll = () => {
    const allSelected = filteredRows.every(r => r.selected);
    const filteredIds = new Set(filteredRows.map(r => r.id));
    setRows(prev => prev.map(r => filteredIds.has(r.id) ? { ...r, selected: !allSelected } : r));
  };
  const clearAll = () => { if (confirm('Remove all recipients?')) setRows([]); setImportDone(false); };

  // ── Filtered rows ──
  const filteredRows = rows.filter(r => {
    if (!rowFilter) return true;
    const q = rowFilter.toLowerCase();
    return r.email.includes(q) || r.firstName.toLowerCase().includes(q) || r.lastName.toLowerCase().includes(q) || r.company.toLowerCase().includes(q);
  });

  const selectedRows = rows.filter(r => r.selected);

  // ── Validate & build recipients payload ──
  const buildPayload = () => selectedRows.map(r => ({
    email: r.email,
    ...(r.firstName && { firstName: r.firstName }),
    ...(r.lastName  && { lastName:  r.lastName  }),
    ...(r.company   && { company:   r.company   }),
  }));

  // ── Send campaign ──
  const handleSend = async () => {
    if (!selected)              return toast.error('Choose a template first');
    if (selectedRows.length === 0) return toast.error('Select at least one recipient');
    if (selectedRows.length > 1000) return toast.error('Maximum 1,000 recipients per send');
    const confirmed = window.confirm(`Send "${templates.find(t => t.id === selected)?.name}" to ${selectedRows.length} recipient${selectedRows.length === 1 ? '' : 's'}?`);
    if (!confirmed) return;
    setSending(true); setResult(null);
    try {
      const r = await adminAPI.sendMarketingCampaign({
        templateId: selected,
        recipients: buildPayload(),
        subject:    subject   || undefined,
        ctaUrl:     ctaUrl    || undefined,
      });
      setResult(r.data.results);
      toast.success(`Campaign sent! ${r.data.results.sent} delivered`);
    } catch (err) { toast.error(err.response?.data?.error || 'Send failed'); }
    setSending(false);
  };

  // ── Schedule campaign ──
  const handleSchedule = async () => {
    if (!selected)              return toast.error('Choose a template first');
    if (selectedRows.length === 0) return toast.error('Select at least one recipient');
    if (!sendAt)                return toast.error('Set a send date and time');
    if (new Date(sendAt) <= new Date()) return toast.error('Send time must be in the future');
    setScheduling(true);
    try {
      await adminAPI.scheduleMarketingCampaign({
        templateId: selected,
        recipients: buildPayload(),
        subject:    subject   || undefined,
        ctaUrl:     ctaUrl    || undefined,
        sendAt:     new Date(sendAt).toISOString(),
        label:      campaignLabel || undefined,
      });
      toast.success(`Campaign scheduled for ${new Date(sendAt).toLocaleString()}`);
      setMode('scheduled');
    } catch (err) { toast.error(err.response?.data?.error || 'Schedule failed'); }
    setScheduling(false);
  };

  const cancelScheduled = async (id) => {
    if (!confirm('Cancel this scheduled campaign?')) return;
    try { await adminAPI.cancelScheduledCampaign(id); toast.success('Cancelled'); loadScheduled(); }
    catch { toast.error('Cancel failed'); }
  };

  // ─────────────────── RENDER ───────────────────
  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
            <Send className="w-5 h-5 text-violet-600" /> Email Campaigns
          </h2>
          <p className="text-sm text-neutral-500 mt-0.5">Build your recipient list, customize the email, and send or schedule your campaign.</p>
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

      {/* ══ SCHEDULED VIEW ══ */}
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
              <Clock className="w-10 h-10 text-neutral-200 mx-auto mb-3" />
              <p className="text-neutral-500 font-medium">No scheduled campaigns</p>
              <p className="text-sm text-neutral-400 mt-1">Switch to "Schedule" to queue a campaign for a future date.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {scheduled.map(job => (
                <div key={job.id} className={`card p-5 ${job.status === 'done' ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold text-neutral-900">{job.label || job.templateId}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          job.status === 'done'    ? 'bg-emerald-50 text-emerald-700' :
                          job.status === 'failed'  ? 'bg-red-50 text-red-700' :
                          job.status === 'sending' ? 'bg-blue-50 text-blue-700' :
                          'bg-amber-50 text-amber-700'}`}>{job.status}</span>
                      </div>
                      <p className="text-sm text-neutral-500">
                        {job.recipientCount ?? job.recipients?.length ?? '?'} recipients ·
                        Scheduled for {new Date(job.sendAt).toLocaleString()}
                      </p>
                    </div>
                    {job.status === 'pending' && (
                      <button onClick={() => cancelScheduled(job.id)} className="btn btn-secondary text-xs py-1.5 text-red-600 hover:bg-red-50 border-red-200 gap-1.5 shrink-0">
                        <X className="w-3.5 h-3.5" /> Cancel
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      ) : (
        /* ══ SEND / SCHEDULE VIEW ══ */
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

          {/* ── LEFT COLUMN ── */}
          <div className="space-y-5">

            {/* STEP 1 – Template */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-6 h-6 rounded-full bg-violet-600 text-white text-xs font-bold flex items-center justify-center shrink-0">1</span>
                <h3 className="font-semibold text-neutral-800">Choose a Template</h3>
              </div>
              <div className="space-y-2">
                {templates.map(tpl => {
                  const isVenue = tpl.id === 'venue';
                  const activeClass = isVenue
                    ? 'border-orange-400 bg-orange-50'
                    : 'border-violet-500 bg-violet-50';
                  return (
                    <label key={tpl.id}
                      className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                        selected === tpl.id ? activeClass : 'border-neutral-100 hover:border-neutral-200 bg-white'}`}>
                      <input type="radio" name="template" value={tpl.id} checked={selected === tpl.id}
                        onChange={() => handleTemplateChange(tpl.id)} className={`mt-0.5 ${isVenue ? 'accent-orange-500' : 'accent-violet-600'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-neutral-900">{tpl.name}</p>
                          {isVenue
                            ? <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">Venue</span>
                            : <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">Events</span>
                          }
                        </div>
                        <p className="text-xs text-neutral-500 mt-0.5">{tpl.description}</p>
                      </div>
                    </label>
                  );
                })}
                {templates.length === 0 && (
                  <div className="flex justify-center py-6">
                    <span className="spinner w-5 h-5 border-2 border-neutral-200 border-t-neutral-600" />
                  </div>
                )}
              </div>
            </div>

            {/* STEP 2 – Campaign Settings */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-6 h-6 rounded-full bg-violet-600 text-white text-xs font-bold flex items-center justify-center shrink-0">2</span>
                <h3 className="font-semibold text-neutral-800">Customize Campaign</h3>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 mb-1">Email subject line</label>
                  <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
                    className="input text-sm w-full" placeholder="Leave blank to use template default" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 mb-1">Button / CTA link</label>
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
                      <label className="block text-xs font-semibold text-neutral-500 mb-1">Campaign name <span className="font-normal text-neutral-400">(optional)</span></label>
                      <input type="text" value={campaignLabel} onChange={e => setCampaignLabel(e.target.value)}
                        className="input text-sm w-full" placeholder="e.g. Q3 Outreach" />
                    </div>
                  </>
                )}
                {/* Personalization tokens info */}
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                  <p className="text-xs font-semibold text-blue-800 mb-1.5">Personalization tokens available in your template:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {['{{first_name}}', '{{last_name}}', '{{company}}', '{{cta_url}}'].map(tag => (
                      <code key={tag} className="bg-white border border-blue-200 px-1.5 py-0.5 rounded text-xs text-blue-700 font-mono">{tag}</code>
                    ))}
                  </div>
                  <p className="text-xs text-blue-600 mt-2">Set these per-recipient in the table on the right. Any row left blank will use a generic fallback.</p>
                </div>
              </div>
            </div>

            {/* STEP 3 – Send button */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <span className="w-6 h-6 rounded-full bg-violet-600 text-white text-xs font-bold flex items-center justify-center shrink-0">3</span>
                <h3 className="font-semibold text-neutral-800">Send Campaign</h3>
              </div>

              {/* Summary */}
              <div className="bg-neutral-50 rounded-xl p-4 mb-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Template</span>
                  <span className="font-medium text-neutral-800">{templates.find(t => t.id === selected)?.name || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Recipients selected</span>
                  <span className={`font-semibold ${selectedRows.length > 0 ? 'text-violet-700' : 'text-neutral-400'}`}>
                    {selectedRows.length} / {rows.length}
                  </span>
                </div>
                {mode === 'schedule' && sendAt && (
                  <div className="flex justify-between">
                    <span className="text-neutral-500">Sends at</span>
                    <span className="font-medium text-neutral-800">{new Date(sendAt).toLocaleString()}</span>
                  </div>
                )}
              </div>

              {mode === 'send' ? (
                <>
                  <button onClick={handleSend} disabled={sending || !selected || selectedRows.length === 0}
                    className="btn bg-violet-600 hover:bg-violet-700 text-white w-full gap-2 justify-center disabled:opacity-50 py-3 text-base font-semibold">
                    {sending
                      ? <><span className="spinner w-4 h-4 border-2 border-white/30 border-t-white" /> Sending…</>
                      : <><Send className="w-4 h-4" /> Send to {selectedRows.length} {selectedRows.length === 1 ? 'recipient' : 'recipients'}</>}
                  </button>
                  {result && (
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="bg-emerald-50 rounded-xl p-3 text-center border border-emerald-100">
                        <p className="text-2xl font-bold text-emerald-700">{result.sent}</p>
                        <p className="text-xs text-emerald-600 mt-0.5 font-medium">Delivered</p>
                      </div>
                      <div className="bg-neutral-50 rounded-xl p-3 text-center border border-neutral-200">
                        <p className="text-2xl font-bold text-neutral-500">{result.skipped}</p>
                        <p className="text-xs text-neutral-400 mt-0.5 font-medium">Skipped</p>
                      </div>
                      <div className="bg-red-50 rounded-xl p-3 text-center border border-red-100">
                        <p className="text-2xl font-bold text-red-600">{result.failed}</p>
                        <p className="text-xs text-red-400 mt-0.5 font-medium">Failed</p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <button onClick={handleSchedule} disabled={scheduling || !selected || selectedRows.length === 0 || !sendAt}
                  className="btn bg-indigo-600 hover:bg-indigo-700 text-white w-full gap-2 justify-center disabled:opacity-50 py-3 text-base font-semibold">
                  {scheduling
                    ? <><span className="spinner w-4 h-4 border-2 border-white/30 border-t-white" /> Scheduling…</>
                    : <><Clock className="w-4 h-4" /> Schedule Campaign</>}
                </button>
              )}
            </div>
          </div>

          {/* ── RIGHT COLUMN: Recipients table ── */}
          <div className="card flex flex-col" style={{ minHeight: '600px' }}>
            {/* Table header */}
            <div className="p-5 border-b border-neutral-100">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-neutral-800">Recipients</h3>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    {rows.length === 0
                      ? 'Import from your platform or add manually below.'
                      : `${selectedRows.length} of ${rows.length} selected · Set first name, last name, and company per row for personalization.`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {rows.length > 0 && (
                    <button onClick={clearAll} className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors">
                      Clear all
                    </button>
                  )}
                  {/* THE import button */}
                  <button onClick={handleImport} disabled={importing}
                    className="btn bg-violet-600 hover:bg-violet-700 text-white text-sm gap-2 disabled:opacity-60 px-4 py-2">
                    {importing
                      ? <><span className="spinner w-4 h-4 border-2 border-white/30 border-t-white" /> Importing…</>
                      : <><Users className="w-4 h-4" /> Import from Platform</>}
                  </button>
                </div>
              </div>

              {/* Search/filter */}
              {rows.length > 0 && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-300" />
                  <input
                    type="text"
                    value={rowFilter}
                    onChange={e => setRowFilter(e.target.value)}
                    placeholder="Filter by email, name, or company…"
                    className="input text-sm w-full pl-9"
                  />
                </div>
              )}
            </div>

            {/* Table body */}
            <div className="flex-1 overflow-y-auto">
              {rows.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-16 text-center px-6">
                  <Users className="w-12 h-12 text-neutral-200 mb-3" />
                  <p className="font-medium text-neutral-500">No recipients yet</p>
                  <p className="text-sm text-neutral-400 mt-1 max-w-xs">Click <strong>Import from Platform</strong> to automatically pull all organizers, users, and participants from your database — or add emails manually below.</p>
                </div>
              ) : filteredRows.length === 0 ? (
                <div className="flex items-center justify-center py-10 text-sm text-neutral-400">No matches for "{rowFilter}"</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-neutral-50 border-b border-neutral-200">
                    <tr>
                      <th className="px-4 py-3 w-8">
                        <input type="checkbox"
                          checked={filteredRows.length > 0 && filteredRows.every(r => r.selected)}
                          onChange={toggleAll}
                          className="accent-violet-600 cursor-pointer" />
                      </th>
                      <th className="px-2 py-3 text-left text-xs font-semibold text-neutral-500 w-44">Email</th>
                      <th className="px-2 py-3 text-left text-xs font-semibold text-neutral-500 w-24">First Name</th>
                      <th className="px-2 py-3 text-left text-xs font-semibold text-neutral-500 w-24">Last Name</th>
                      <th className="px-2 py-3 text-left text-xs font-semibold text-neutral-500">Company</th>
                      <th className="px-2 py-3 text-left text-xs font-semibold text-neutral-500 w-20">Source</th>
                      <th className="px-2 py-3 w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {filteredRows.map(row => (
                      <tr key={row.id} className={`group transition-colors ${row.selected ? 'bg-white' : 'bg-neutral-50 opacity-60'}`}>
                        <td className="px-4 py-2">
                          <input type="checkbox" checked={row.selected} onChange={() => toggleRow(row.id)} className="accent-violet-600 cursor-pointer" />
                        </td>
                        <td className="px-2 py-1.5">
                          <span className="text-xs text-neutral-600 font-mono truncate block max-w-[160px]" title={row.email}>{row.email}</span>
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="text"
                            value={row.firstName}
                            onChange={e => updateRow(row.id, 'firstName', e.target.value)}
                            placeholder="First"
                            className="w-full text-xs border border-transparent hover:border-neutral-200 focus:border-violet-400 rounded-lg px-2 py-1.5 bg-transparent focus:bg-white outline-none transition-colors"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="text"
                            value={row.lastName}
                            onChange={e => updateRow(row.id, 'lastName', e.target.value)}
                            placeholder="Last"
                            className="w-full text-xs border border-transparent hover:border-neutral-200 focus:border-violet-400 rounded-lg px-2 py-1.5 bg-transparent focus:bg-white outline-none transition-colors"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="text"
                            value={row.company}
                            onChange={e => updateRow(row.id, 'company', e.target.value)}
                            placeholder="Company"
                            className="w-full text-xs border border-transparent hover:border-neutral-200 focus:border-violet-400 rounded-lg px-2 py-1.5 bg-transparent focus:bg-white outline-none transition-colors"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                            row.source === 'Organizer'   ? 'bg-violet-50 text-violet-700' :
                            row.source === 'Participant' ? 'bg-blue-50 text-blue-700' :
                            'bg-neutral-100 text-neutral-500'}`}>{row.source}</span>
                        </td>
                        <td className="px-2 py-1.5">
                          <button onClick={() => removeRow(row.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-neutral-300 hover:text-red-500 p-1 rounded">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Manual add row */}
            <div className="p-4 border-t border-neutral-100 bg-neutral-50 rounded-b-xl">
              <div className="flex gap-2">
                <input
                  type="email"
                  value={manualEmail}
                  onChange={e => setManualEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addManualRow()}
                  onPaste={handlePaste}
                  placeholder="Add email manually, or paste a list here…"
                  className="input text-sm flex-1"
                />
                <button onClick={addManualRow} disabled={!manualEmail.trim()}
                  className="btn btn-secondary text-sm gap-1.5 px-3 disabled:opacity-40 shrink-0">
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>
              <p className="text-xs text-neutral-400 mt-1.5">Tip: paste multiple emails (separated by commas, semicolons, or new lines) and they'll all be added at once.</p>
            </div>
          </div>

          {/* ── Preview panel (full width, below both columns) ── */}
          <div className="xl:col-span-2">
            <div className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-neutral-800">Email Preview</h3>
                  <p className="text-xs text-neutral-400 mt-0.5">Live preview of your selected template. Updates when you change the template or CTA link.</p>
                </div>
              </div>
              {selected ? (
                <div className="rounded-xl border border-neutral-200 overflow-hidden relative" style={{ height: '600px' }}>
                  {previewLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-neutral-50 z-10">
                      <span className="spinner w-5 h-5 border-2 border-neutral-200 border-t-violet-500" />
                    </div>
                  )}
                  <iframe key={selected} srcDoc={previewHtml} title="Email preview" className="w-full h-full" sandbox="allow-same-origin" />
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50 flex items-center justify-center" style={{ height: '300px' }}>
                  <div className="text-center">
                    <Mail className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                    <p className="text-sm text-neutral-400">Select a template above to see a preview</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



// ─── Fleet Control Panel ──────────────────────────────────────────────────────
function Tooltip({ text, children }) {
  const [show, setShow] = React.useState(false);
  return (
    <span className="relative inline-flex items-center" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-64 bg-neutral-900 text-white text-xs rounded-xl px-3 py-2 shadow-xl leading-relaxed pointer-events-none">
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-neutral-900" />
        </span>
      )}
    </span>
  );
}

function InfoIcon({ tip }) {
  return (
    <Tooltip text={tip}>
      <Info className="w-3.5 h-3.5 text-neutral-400 hover:text-neutral-600 cursor-help ml-1 flex-shrink-0" />
    </Tooltip>
  );
}

function ScaleActionBadge({ action }) {
  if (!action) return null;
  const map = {
    up:         { label: '↑ Reactive',   cls: 'bg-blue-100 text-blue-700' },
    down:       { label: '↓ Scale Down', cls: 'bg-neutral-100 text-neutral-600' },
    predictive: { label: '~ Predictive', cls: 'bg-indigo-100 text-indigo-700' },
    pid:        { label: 'PID',        cls: 'bg-violet-100 text-violet-700' },
    anomaly:    { label: 'Anomaly',   cls: 'bg-red-100 text-red-700' },
    circadian:  { label: 'Circadian', cls: 'bg-sky-100 text-sky-700' },
    manual:     { label: 'Manual',    cls: 'bg-amber-100 text-amber-700' },
  };
  const m = Object.entries(map).find(([k]) => action.toLowerCase().includes(k));
  if (!m) return null;
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${m[1].cls}`}>{m[1].label}</span>;
}

function MiniBar({ value, max, color = 'bg-indigo-500' }) {
  const pct = Math.min(100, Math.max(0, max > 0 ? (value / max) * 100 : 0));
  return (
    <div className="w-full h-1.5 bg-neutral-200 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function FleetStatCard({ label, value, sub, color, tip }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-1 mb-1">
        <p className="text-xs text-neutral-500">{label}</p>
        {tip && <InfoIcon tip={tip} />}
      </div>
      <p className={`text-2xl font-bold ${color || 'text-neutral-900'}`}>{value}</p>
      {sub && <p className="text-xs text-neutral-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function CircadianWheel({ slots, currentHour, floor }) {
  if (!slots) return null;
  const maxLoad = Math.max(...slots.map(s => s.avgLoad || 0), 1);
  return (
    <div className="space-y-1.5">
      <div className="flex gap-px h-10 items-end">
        {slots.map((s, i) => {
          const h = s.avgLoad ? Math.max(4, (s.avgLoad / maxLoad) * 40) : 4;
          const isCurrent = i === currentHour;
          const isPeak = s.avgLoad >= maxLoad * 0.6;
          return (
            <Tooltip key={i} text={`${String(i).padStart(2,'0')}:00 UTC — avg ${s.avgLoad ?? 'no data'} req/window${s.samples ? `, ${s.samples} samples` : ''}`}>
              <div className={`flex-1 rounded-sm cursor-default transition-all ${isCurrent ? 'bg-indigo-500' : isPeak ? 'bg-amber-400' : s.samples > 0 ? 'bg-neutral-300' : 'bg-neutral-100'}`}
                style={{ height: `${h}px` }} />
            </Tooltip>
          );
        })}
      </div>
      <div className="flex justify-between text-neutral-400" style={{ fontSize: '9px' }}>
        <span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span>
      </div>
      <p className="text-xs text-neutral-500 flex items-center gap-1">
        Current min floor:
        <span className={`font-semibold ml-1 ${floor > 1 ? 'text-sky-700' : 'text-neutral-700'}`}>{floor} backend{floor !== 1 ? 's' : ''}</span>
        {floor > 1 && <span className="text-sky-600 ml-1">· scale-down blocked for this hour</span>}
      </p>
    </div>
  );
}

function SystemCard({ title, icon: Icon, iconColor, active, activeLabel, tip, children }) {
  return (
    <div className={`rounded-2xl border-2 p-4 transition-all ${active ? 'border-indigo-200 bg-indigo-50/60' : 'border-neutral-100 bg-white'}`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-4 h-4 ${iconColor || 'text-indigo-500'}`} />
        <span className="text-xs font-bold text-neutral-700 uppercase tracking-wide">{title}</span>
        {tip && <InfoIcon tip={tip} />}
        {active && <span className="ml-auto text-xs font-semibold text-indigo-600">{activeLabel || 'ACTIVE'}</span>}
      </div>
      {children}
    </div>
  );
}

function FleetControl() {
  const [status, setStatus]           = useState(null);
  const [loading, setLoading]         = useState(true);
  const [boostForm, setBoostForm]     = useState({ durationMinutes: 60, reason: '', minBackends: '', pinnedEventIds: '' });
  const [boosting, setBoosting]       = useState(false);
  const [cancelling, setCancelling]   = useState(false);
  const [logExpanded, setLogExpanded] = useState(false);

  // Manual controls
  const [manualSlider, setManualSlider]       = useState(1);
  const [manualActive, setManualActive]       = useState(false);
  const [effMode, setEffMode]                 = useState('balanced');
  const [applyingScale, setApplyingScale]     = useState(false);
  const [releasingManual, setReleasingManual] = useState(false);

  const load = async () => {
    try {
      const r = await routerAPI.getStatus();
      if (r?.data) {
        setStatus(r.data);
        // Sync UI to current server state
        if (r.data.manual?.active) {
          setManualActive(true);
          setManualSlider(r.data.manual.count);
        } else {
          setManualActive(false);
        }
        if (r.data.manual?.efficiencyMode) setEffMode(r.data.manual.efficiencyMode);
      }
    } catch { }
    setLoading(false);
  };

  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, []);

  const applyManual = async () => {
    setApplyingScale(true);
    try {
      await routerAPI.setScale({ count: manualSlider, efficiencyMode: effMode });
      toast.success(`Pinned to ${manualSlider} backend${manualSlider !== 1 ? 's' : ''} · ${effMode} mode`);
      setManualActive(true);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    setApplyingScale(false);
  };

  const releaseManual = async () => {
    setReleasingManual(true);
    try {
      await routerAPI.setScale({ count: null, efficiencyMode: 'balanced' });
      toast.success('Auto-scaling restored');
      setManualActive(false);
      setEffMode('balanced');
      load();
    } catch { toast.error('Failed'); }
    setReleasingManual(false);
  };

  const handleBoost = async (e) => {
    e.preventDefault();
    setBoosting(true);
    try {
      await routerAPI.activateBoost({
        durationMinutes: parseInt(boostForm.durationMinutes) || 60,
        reason: boostForm.reason || 'Admin boost',
        minBackends: boostForm.minBackends ? parseInt(boostForm.minBackends) : undefined,
        pinnedEventIds: boostForm.pinnedEventIds ? boostForm.pinnedEventIds.split(',').map(s => s.trim()).filter(Boolean) : [],
      });
      toast.success('Boost activated'); load();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    setBoosting(false);
  };

  const handleCancelBoost = async () => {
    setCancelling(true);
    try { await routerAPI.cancelBoost(); toast.success('Boost cancelled'); load(); }
    catch { toast.error('Failed'); }
    setCancelling(false);
  };

  if (!import.meta.env.VITE_ROUTER_URL) return (
    <div className="p-8 text-center">
      <Rocket className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
      <h3 className="text-lg font-bold text-neutral-700 mb-2">Router not configured</h3>
      <p className="text-sm text-neutral-500">Add <code className="bg-neutral-100 px-1 rounded">VITE_ROUTER_URL</code> and <code className="bg-neutral-100 px-1 rounded">VITE_MESH_SECRET</code> to your frontend environment variables.</p>
    </div>
  );

  if (loading) return <div className="p-8 flex justify-center"><span className="spinner w-6 h-6 border-2 border-neutral-200 border-t-neutral-700" /></div>;
  if (!status) return (
    <div className="p-8 text-center">
      <WifiOff className="w-12 h-12 text-red-300 mx-auto mb-4" />
      <h3 className="text-lg font-bold text-neutral-700 mb-2">Router unreachable</h3>
      <p className="text-sm text-neutral-500">Could not connect to the router.</p>
    </div>
  );

  const boost       = status.boost;
  const scaling     = status.scaling;
  const backends    = status.backends || [];
  const activeList  = backends.filter(b => b.active);
  const minutesLeft = boost?.active ? Math.max(0, Math.round((new Date(boost.activeUntil) - Date.now()) / 60000)) : 0;
  const avgLatency  = Math.round(activeList.filter(b => b.latencyMs).reduce((s, b) => s + b.latencyMs, 0) / Math.max(1, activeList.filter(b => b.latencyMs).length)) || null;
  const pid         = scaling?.pid;
  const anomaly     = scaling?.anomaly;
  const cooldown    = scaling?.cooldown;
  const circadian   = scaling?.circadian;
  const pred        = scaling?.predictive;
  const manual      = scaling?.manual || status.manual;
  const effThresh   = manual?.effectiveThresholds || { up: scaling?.thresholds?.scaleUp, down: scaling?.thresholds?.scaleDown };

  return (
    <div className="p-6 space-y-6 max-w-5xl">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
            <Rocket className="w-5 h-5 text-indigo-500" /> Fleet Intelligence
          </h2>
          <p className="text-sm text-neutral-500 mt-0.5">
            {backends.length} backends · uptime {Math.floor((status.uptime||0)/3600)}h {Math.floor(((status.uptime||0)%3600)/60)}m
            {cooldown?.lastAction && <span className="ml-2">· last: <ScaleActionBadge action={cooldown.lastAction} /></span>}
            {manual?.active && <span className="ml-2 text-amber-600 font-medium text-xs">Manual override active</span>}
          </p>
        </div>
        <button onClick={load} className="btn btn-secondary text-xs gap-1.5"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
      </div>

      {/* Manual override banner */}
      {manual?.active && (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <Gauge className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-amber-900 text-sm">Manual Override Active</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Pinned to <strong>{manual.count} backend{manual.count !== 1 ? 's' : ''}</strong> · mode: <strong>{manual.efficiencyMode}</strong> · all auto-scaling paused
            </p>
          </div>
          <button onClick={releaseManual} disabled={releasingManual} className="btn text-xs bg-amber-600 hover:bg-amber-700 text-white gap-1.5 disabled:opacity-60">
            {releasingManual ? <span className="spinner w-3.5 h-3.5 border border-white/30 border-t-white" /> : <RotateCcw className="w-3.5 h-3.5" />}
            Release
          </button>
        </div>
      )}

      {/* Boost banner */}
      {boost?.active && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0"><Zap className="w-5 h-5 text-amber-600" /></div>
          <div className="flex-1">
            <p className="font-semibold text-amber-900 text-sm">Boost Mode Active</p>
            <p className="text-xs text-amber-700 mt-0.5">{boost.reason} · {boost.minBackends} backends minimum · {minutesLeft}m remaining</p>
          </div>
          <button onClick={handleCancelBoost} disabled={cancelling} className="btn text-xs bg-amber-600 hover:bg-amber-700 text-white gap-1.5 disabled:opacity-60">
            {cancelling ? <span className="spinner w-3.5 h-3.5 border border-white/30 border-t-white" /> : <X className="w-3.5 h-3.5" />} Cancel
          </button>
        </div>
      )}

      {/* Top stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <FleetStatCard
          label="Active Backends" value={`${scaling.activeBackendCount}/${scaling.totalBackends}`}
          color={manual?.active ? 'text-amber-600' : 'text-neutral-900'}
          sub={manual?.active ? 'manually pinned' : 'auto-managed'}
          tip="How many backends are currently receiving traffic out of your total provisioned fleet. Auto-scaling adjusts this number based on load."
        />
        <FleetStatCard
          label="Avg Latency" value={avgLatency ? `${avgLatency}ms` : '—'}
          color={avgLatency > 2000 ? 'text-red-600' : avgLatency > 800 ? 'text-amber-600' : 'text-emerald-700'}
          sub="across active backends"
          tip="Average response time from the router to each active backend. Above 800ms is degraded. Above 2000ms is critical and may indicate a backend is overloaded."
        />
        <FleetStatCard
          label="Circuit Breakers" value={scaling.trippedCount}
          color={scaling.trippedCount > 0 ? 'text-red-600' : 'text-neutral-900'}
          sub={scaling.trippedCount > 0 ? 'backends isolated' : 'all clear'}
          tip="A circuit breaker trips after 3 consecutive errors from a backend. Traffic is immediately rerouted away from it. It resets automatically after 2 clean health checks."
        />
        <FleetStatCard
          label="Scale-Down Streak" value={scaling.scaleDownStreak || 0}
          color={scaling.scaleDownStreak >= 3 ? 'text-amber-600' : 'text-neutral-900'}
          sub={`of ${5} needed`}
          tip="How many consecutive 30s windows load has stayed below the scale-down threshold. Scale-down fires when this reaches 5 (2.5 minutes of sustained low traffic)."
        />
      </div>

      {/* ── MANUAL CONTROLS ─────────────────────────────────── */}
      <div className="card p-5 space-y-5">
        <div className="flex items-center gap-2">
          <Gauge className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-bold text-neutral-700">Manual Controls</h3>
          <InfoIcon tip="Override all auto-scaling intelligence. Pin the exact number of backends you want and set the efficiency mode. Release to return to fully automatic operation." />
        </div>

        {/* Backend count slider */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-medium text-neutral-600 flex items-center gap-1">
              Backend Count
              <InfoIcon tip="Drag to pin the fleet to exactly this many backends. All auto-scaling (PID, Holt-Winters, anomaly detection, circadian floor) is paused until you release." />
            </label>
            <span className="text-sm font-bold text-neutral-900 font-mono">
              {manualSlider} / {backends.length}
            </span>
          </div>
          <input
            type="range" min="1" max={backends.length} value={manualSlider}
            onChange={e => setManualSlider(parseInt(e.target.value))}
            className="w-full h-2 rounded-full appearance-none bg-neutral-200 accent-amber-500 cursor-pointer"
          />
          <div className="flex justify-between text-xs text-neutral-400 mt-1">
            <span>1 (min)</span>
            <span>{Math.ceil(backends.length / 2)} (half)</span>
            <span>{backends.length} (all)</span>
          </div>
        </div>

        {/* Efficiency mode */}
        <div>
          <label className="text-xs font-medium text-neutral-600 flex items-center gap-1 mb-2">
            Efficiency Mode
            <InfoIcon tip="Controls how aggressively the auto-scaling reacts when released. Performance scales up early and never scales down. Economy scales up late and scales down fast. Balanced is the default." />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[
              { id: 'economy',     label: 'Economy',     desc: 'Scale up late, down fast', color: 'emerald' },
              { id: 'balanced',    label: 'Balanced',    desc: 'Default behaviour',        color: 'indigo'  },
              { id: 'performance', label: 'Performance', desc: 'Scale up early, stay up',  color: 'violet'  },
            ].map(m => (
              <button key={m.id} onClick={() => setEffMode(m.id)}
                className={`rounded-xl border-2 p-3 text-left transition-all ${effMode === m.id ? `border-${m.color}-300 bg-${m.color}-50` : 'border-neutral-100 hover:border-neutral-200'}`}>
                <p className="text-xs font-semibold text-neutral-800">{m.label}</p>
                <p className="text-xs text-neutral-500 mt-0.5">{m.desc}</p>
                {effMode === m.id && manual?.effectiveThresholds && (
                  <p className="text-xs text-neutral-400 mt-1 font-mono">
                    ↑{effThresh.up} {effThresh.down > 0 ? `↓${effThresh.down}` : 'no ↓'}
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Apply / Release */}
        <div className="flex gap-3">
          <button onClick={applyManual} disabled={applyingScale}
            className="btn bg-amber-500 hover:bg-amber-600 text-white gap-2 disabled:opacity-60 flex-1">
            {applyingScale ? <span className="spinner w-4 h-4 border-2 border-white/30 border-t-white" /> : <Gauge className="w-4 h-4" />}
            Pin to {manualSlider} backend{manualSlider !== 1 ? 's' : ''} · {effMode}
          </button>
          {manual?.active && (
            <button onClick={releaseManual} disabled={releasingManual}
              className="btn btn-secondary gap-2 disabled:opacity-60">
              {releasingManual ? <span className="spinner w-4 h-4 border-2 border-neutral-200 border-t-neutral-700" /> : <RotateCcw className="w-4 h-4" />}
              Release to auto
            </button>
          )}
        </div>
      </div>

      {/* ── INTELLIGENCE SYSTEMS ─────────────────────────────── */}
      <div>
        <h3 className="text-sm font-bold text-neutral-700 mb-3 flex items-center gap-2">
          <Cpu className="w-4 h-4 text-indigo-400" /> Intelligence Systems
          <InfoIcon tip="These four systems run in parallel and vote on scaling decisions every 30 seconds. The highest-priority system that wants to act wins each round." />
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

          {/* Holt-Winters */}
          <SystemCard title="Holt-Winters Predictive" icon={TrendingUp} iconColor="text-indigo-500"
            active={pred?.rampCount >= 3} activeLabel="FORECASTING"
            tip="Double exponential smoothing — tracks a 'level' (current smoothed load) and a 'trend' (rate of change). After 3 consecutive windows of rising trend, it pre-scales before the threshold is hit. This is why you scale up at 9:30 PM instead of 9:34 PM.">
            {pred ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center">
                  {[
                    { label: 'Level', value: pred.level, tip: 'Smoothed current load — less jumpy than raw req/window because it averages recent history.' },
                    { label: 'Trend', value: `${pred.trend > 0 ? '+' : ''}${pred.trend}`, color: pred.trend > 0 ? 'text-amber-600' : pred.trend < 0 ? 'text-emerald-600' : '', tip: 'How fast load is growing per window. Positive = ramping up. Negative = dying down.' },
                    { label: 'Forecast', value: pred.forecast, color: pred.forecast >= effThresh.up * 0.85 ? 'text-amber-600' : '', tip: `Predicted load next window (level + trend). Pre-scale fires at ${Math.round((pred.headroom||0.85)*100)}% of your threshold.` },
                  ].map(s => (
                    <div key={s.label}>
                      <p className="text-xs text-neutral-500 flex items-center justify-center gap-0.5">{s.label}<InfoIcon tip={s.tip} /></p>
                      <p className={`text-lg font-bold ${s.color || 'text-neutral-900'}`}>{s.value}</p>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex justify-between text-xs text-neutral-400 mb-1">
                    <span className="flex items-center gap-1">Ramp windows: {pred.rampCount}<InfoIcon tip="Consecutive windows with positive trend. Pre-scale requires 3+ to avoid reacting to a single noisy spike." /></span>
                    <span>{pred.historyLen}/30 samples</span>
                  </div>
                  <MiniBar value={pred.rampCount} max={5} color={pred.rampCount >= 3 ? 'bg-indigo-500' : 'bg-neutral-300'} />
                </div>
              </div>
            ) : <p className="text-xs text-neutral-400">Warming up…</p>}
          </SystemCard>

          {/* PID */}
          <SystemCard title="PID Controller" icon={Gauge} iconColor="text-violet-500"
            active={pid && Math.abs(pid.lastError) > 3} activeLabel="ADJUSTING"
            tip="Proportional-Integral-Derivative control — the same algorithm used in industrial machinery, thermostats, and aircraft autopilots. It produces a continuous pressure signal instead of a binary on/off. Output > 1.0 triggers a scale-up.">
            {pid ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center">
                  {[
                    { label: 'Setpoint', value: pid.setpoint, tip: `Target load level (${Math.round((scaling?.pid?.gains?.kp||0.08)*100)}% is Kp). When current load exceeds this, the controller starts building pressure to scale up.` },
                    { label: 'Error', value: `${pid.lastError > 0 ? '+' : ''}${pid.lastError}`, color: Math.abs(pid.lastError) > 5 ? 'text-amber-600' : '', tip: 'Current load minus setpoint. Positive = you\'re above the comfort zone. Negative = you\'re well under capacity.' },
                    { label: 'Integral', value: pid.integral, color: Math.abs(pid.integral) > 8 ? 'text-violet-600' : '', tip: 'Accumulated error over time — clamped at ±15 to prevent windup. Resets to 0 after an anomaly so a spike doesn\'t cause the integral to keep triggering scale-ups for minutes afterward.' },
                  ].map(s => (
                    <div key={s.label}>
                      <p className="text-xs text-neutral-500 flex items-center justify-center gap-0.5">{s.label}<InfoIcon tip={s.tip} /></p>
                      <p className={`text-lg font-bold ${s.color || 'text-neutral-900'}`}>{s.value}</p>
                    </div>
                  ))}
                </div>
                <div className="bg-neutral-100 rounded-lg px-2 py-1.5 flex gap-3 text-xs text-neutral-500 font-mono justify-center">
                  <span title="Proportional gain — how hard it reacts to current error">Kp {pid.gains?.kp}</span>
                  <span title="Integral gain — how hard it reacts to accumulated error">Ki {pid.gains?.ki}</span>
                  <span title="Derivative gain — how hard it reacts to rate of change">Kd {pid.gains?.kd}</span>
                </div>
                <MiniBar value={Math.abs(pid.integral) + 15} max={30} color={Math.abs(pid.integral) > 8 ? 'bg-violet-500' : 'bg-neutral-300'} />
              </div>
            ) : <p className="text-xs text-neutral-400">Waiting for data…</p>}
          </SystemCard>

          {/* Anomaly Detection */}
          <SystemCard title="Anomaly Detection (EWMSD)" icon={AlertTriangle} iconColor="text-red-500"
            active={anomaly?.inHold} activeLabel={anomaly?.inHold ? `HOLD ${anomaly.holdSecsLeft}s` : ''}
            tip="Exponentially Weighted Moving Standard Deviation — builds a live statistical model of your 'normal' load. A spike more than 2.5σ from baseline is an anomaly. It scales up immediately on a fast path but doesn't feed the spike into Holt-Winters (which would corrupt the trend model). After the spike, the baseline gradually adapts using a slower alpha so normal post-spike traffic stops looking anomalous.">
            {anomaly ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center">
                  {[
                    { label: 'Baseline', value: anomaly.mean, tip: 'Exponentially weighted average of your recent non-anomalous load. This is what "normal" looks like to the detector.' },
                    { label: 'Std Dev', value: anomaly.std, tip: 'How spread out your normal load variations are. A higher std dev means the detector requires a bigger spike to trigger.' },
                    { label: 'Threshold', value: `${anomaly.zThreshold}σ`, tip: `Any load more than ${anomaly.zThreshold} standard deviations above the baseline is classified as an anomaly. Your 73 req spike was ~6σ — far beyond this.` },
                  ].map(s => (
                    <div key={s.label}>
                      <p className="text-xs text-neutral-500 flex items-center justify-center gap-0.5">{s.label}<InfoIcon tip={s.tip} /></p>
                      <p className="text-lg font-bold text-neutral-900">{s.value}</p>
                    </div>
                  ))}
                </div>
                {anomaly.inHold ? (
                  <div className="bg-red-100 rounded-lg px-3 py-2 text-xs text-red-700 font-medium flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    Post-anomaly hold · scale-down blocked · {anomaly.holdSecsLeft}s left
                    <InfoIcon tip="After a spike, scale-down is blocked briefly so backends don't get removed while traffic is still decaying. This prevents the yo-yo effect." />
                  </div>
                ) : (
                  <div className="bg-neutral-50 rounded-lg px-3 py-2 text-xs text-neutral-500 flex items-center gap-1">
                    Baseline stable · next spike triggers if &gt;{anomaly.zThreshold}σ from mean ({+(anomaly.mean + anomaly.zThreshold * anomaly.std).toFixed(1)} req)
                  </div>
                )}
              </div>
            ) : <p className="text-xs text-neutral-400">Seeding baseline…</p>}
          </SystemCard>

          {/* Circadian */}
          <SystemCard title="Circadian Floor (24h learned)" icon={Clock} iconColor="text-sky-500"
            active={circadian?.floor > 1} activeLabel={circadian?.floor > 1 ? `FLOOR ${circadian.floor}` : ''}
            tip="Watches your traffic every 30 seconds and builds a per-hour-of-day load profile. When the current hour historically runs hot, it sets a minimum replica floor so you never scale all the way down to 1 backend right before your known peak window. Only records non-anomalous windows — a 73 req spike will not corrupt the floor to 5.">
            {circadian ? (
              <CircadianWheel slots={circadian.slots} currentHour={circadian.currentHour} floor={circadian.floor} />
            ) : <p className="text-xs text-neutral-400">Learning traffic pattern…</p>}
          </SystemCard>

        </div>
      </div>

      {/* Cooldown status */}
      {cooldown && (
        <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${cooldown.active ? 'border-amber-200 bg-amber-50' : 'border-neutral-100 bg-neutral-50'}`}>
          <Timer className={`w-4 h-4 flex-shrink-0 ${cooldown.active ? 'text-amber-500' : 'text-neutral-400'}`} />
          <span className="text-sm flex items-center gap-1">
            {cooldown.active
              ? <><span className="text-amber-800">Scale-down locked for <strong>{cooldown.secsLeft}s</strong> — prevents thrashing after a scale-up event</span></>
              : <span className="text-neutral-500">No cooldown active · last action: <strong>{cooldown.lastAction ?? '—'}</strong> · window: {Math.round(cooldown.ms/1000)}s</span>}
            <InfoIcon tip="After any scale-up, scale-down is locked for 2.5 minutes. New backends need ~30-60s to warm up on Render. Without this, the system scales up then immediately back down before the backend is even ready, causing the thrashing in your original logs." />
          </span>
        </div>
      )}

      {/* Backend cards */}
      <div>
        <h3 className="text-sm font-bold text-neutral-700 mb-3 flex items-center gap-2">
          <Server className="w-4 h-4" /> Backends
          <InfoIcon tip="Active backends receive live traffic. Standby backends are healthy but idle. Tripped backends have been isolated by the circuit breaker due to consecutive errors." />
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {backends.map(b => (
            <div key={b.index} className={`card p-4 border-2 transition-all ${b.circuitTripped ? 'border-red-200 bg-red-50' : b.active ? 'border-emerald-200 bg-emerald-50' : 'border-neutral-100'}`}>
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-sm">{b.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${b.circuitTripped ? 'bg-red-100 text-red-700' : b.active ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}`}>
                  {b.circuitTripped ? 'tripped' : b.active ? 'active' : 'standby'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                <span className="text-neutral-400 flex items-center gap-0.5">Latency<InfoIcon tip="Round-trip time from router to this backend. High latency here means the backend is overloaded or waking from sleep." /></span>
                <span className={`font-mono font-semibold ${b.latencyMs > 2000 ? 'text-red-600' : b.latencyMs > 800 ? 'text-amber-600' : 'text-emerald-700'}`}>{b.latencyMs ? `${b.latencyMs}ms` : '—'}</span>
                <span className="text-neutral-400 flex items-center gap-0.5">Window req<InfoIcon tip="Requests received in the current 30s window. This is the primary signal the scaling system uses." /></span>
                <span className="font-mono">{b.windowRequests ?? 0}</span>
                <span className="text-neutral-400 flex items-center gap-0.5">Sockets<InfoIcon tip="Active WebSocket connections. Used instead of req/window when non-zero, since sockets represent persistent load." /></span>
                <span className="font-mono">{b.socketConnections || 0}</span>
                {b.memoryPct != null && (
                  <><span className="text-neutral-400 flex items-center gap-0.5">Memory<InfoIcon tip="Heap memory usage %. Above 85% may indicate a memory leak or the backend needs more capacity." /></span>
                  <span className={`font-mono ${b.memoryPct > 85 ? 'text-red-600' : b.memoryPct > 70 ? 'text-amber-600' : ''}`}>{b.memoryPct}%</span></>
                )}
              </div>
              {b.coldStart && <div className="mt-2 text-xs text-amber-700 bg-amber-50 rounded-lg px-2 py-1">Cold starting — scale-up deferred until ready</div>}
              {b.consecutiveErrors > 0 && (
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-red-500 mb-1">
                    <span>Consecutive errors</span><span>{b.consecutiveErrors}/{scaling?.thresholds?.tripErrors ?? 3}</span>
                  </div>
                  <MiniBar value={b.consecutiveErrors} max={scaling?.thresholds?.tripErrors ?? 3} color="bg-red-400" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Scaling log */}
      {status.scalingLog?.length > 0 && (
        <div className="card p-4">
          <button className="w-full flex items-center justify-between" onClick={() => setLogExpanded(v => !v)}>
            <h3 className="text-sm font-bold text-neutral-700 flex items-center gap-2">
              <Activity className="w-4 h-4" /> Scaling Log
              <span className="text-neutral-400 font-normal">({status.scalingLog.length} events)</span>
              <InfoIcon tip="Every scaling decision made by any system. The badge tells you which system made it. 'b' on the right is the backend count after that action." />
            </h3>
            {logExpanded ? <ChevronUp className="w-4 h-4 text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
          </button>
          {logExpanded && (
            <div className="mt-3 space-y-1 max-h-72 overflow-y-auto">
              {status.scalingLog.map((e, i) => (
                <div key={i} className="flex items-center gap-2 text-xs py-1 border-b border-neutral-50 last:border-0">
                  <span className="text-neutral-400 font-mono w-20 flex-shrink-0">{new Date(e.time).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</span>
                  <ScaleActionBadge action={e.action} />
                  <span className="text-neutral-500 truncate flex-1">{e.reason}</span>
                  <span className="ml-auto text-neutral-400 flex-shrink-0 font-mono">{e.activeBackendCount}b</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Boost form */}
      {!boost?.active && (
        <div className="card p-5">
          <h3 className="text-sm font-bold text-neutral-700 mb-1 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" /> Activate Boost Mode
            <InfoIcon tip="Boost is different from manual override — it expands the fleet to full capacity for a set period, then auto-scaling resumes. Use for events you know are coming. Manual override is for when you want direct control indefinitely." />
          </h3>
          <p className="text-xs text-neutral-500 mb-4">Override auto-scaling and lock the fleet at full capacity for a set period.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Duration (minutes)</label>
              <input type="number" min="5" max="1440" value={boostForm.durationMinutes}
                onChange={e => setBoostForm(p => ({...p, durationMinutes: e.target.value}))}
                className="input text-sm" placeholder="60" />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Min backends</label>
              <input type="number" min="1" max={backends.length} value={boostForm.minBackends}
                onChange={e => setBoostForm(p => ({...p, minBackends: e.target.value}))}
                className="input text-sm" placeholder={`${backends.length} (all)`} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-neutral-600 mb-1">Reason</label>
              <input type="text" value={boostForm.reason}
                onChange={e => setBoostForm(p => ({...p, reason: e.target.value}))}
                className="input text-sm" placeholder="e.g. Saturday conference, product launch" />
            </div>
            <div className="sm:col-span-2">
              <button onClick={handleBoost} disabled={boosting} className="btn bg-amber-500 hover:bg-amber-600 text-white gap-2 disabled:opacity-60">
                {boosting ? <><span className="spinner w-4 h-4 border-2 border-white/30 border-t-white"/> Activating…</> : <><Zap className="w-4 h-4"/> Activate Boost</>}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}




// ─── Mobile "More" nav button ─────────────────────────────────────────────────
const MORE_SECTIONS = ['organizers','staff','employees','analytics','security','blocklist','reports','uptime','command-center'];
function MoreNavButton({ activeSection, setActiveSection }) {
  const [open, setOpen] = React.useState(false);
  const isActive = MORE_SECTIONS.includes(activeSection);
  const labels = {
    organizers: 'Organizers', staff: 'Staff', employees: 'Team',
    analytics: 'Analytics', security: 'Security', blocklist: 'Blocklist',
    reports: 'Reports', uptime: 'Uptime', 'command-center': 'Command',
  };
  const icons = {
    organizers: Building2, staff: UserCheck, employees: Briefcase,
    analytics: BarChart3, security: Shield, blocklist: Ban,
    reports: Inbox, uptime: Radio, 'command-center': Crosshair,
  };
  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
      )}
      <div className="relative flex-1">
        <button
          onClick={() => setOpen(v => !v)}
          className={`flex flex-col items-center gap-0.5 py-2 px-2 w-full transition-colors ${isActive ? 'text-white' : 'text-neutral-500'}`}
        >
          <MoreHorizontal className="w-5 h-5 flex-shrink-0" />
          <span className="text-[9px] font-semibold">More</span>
          {isActive && <span className="w-1 h-1 rounded-full bg-blue-400" />}
        </button>
        {open && (
          <div className="absolute bottom-full right-0 mb-2 w-44 bg-neutral-900 border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-50">
            {MORE_SECTIONS.map(id => {
              const Icon = icons[id] || Settings;
              return (
                <button key={id}
                  onClick={() => { setActiveSection(id); setOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
                    activeSection === id ? 'bg-white/10 text-white' : 'text-neutral-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {labels[id]}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Nav Items ────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'dashboard',      label: 'Dashboard',    icon: Monitor    },
  { id: 'events',         label: 'Events',       icon: Calendar   },
  { id: 'users',          label: 'Users',        icon: Users      },
  { id: 'organizers',     label: 'Organizers',   icon: Building2  },
  { id: 'staff',          label: 'Staff',        icon: UserCheck  },
  { id: 'employees',      label: 'Team',         icon: Briefcase  },
  { id: 'fleet',          label: 'Fleet',        icon: Rocket     },
  { id: 'marketing',      label: 'Marketing',    icon: Send       },
  { id: 'analytics',      label: 'Analytics',    icon: BarChart3  },
  { id: 'security',       label: 'Security',     icon: Shield     },
  { id: 'blocklist',      label: 'Blocklist',    icon: Ban        },
  { id: 'reports',        label: 'Reports',      icon: Inbox      },
  { id: 'uptime',         label: 'Uptime',       icon: Radio      },
  { id: 'system',         label: 'System',       icon: Server     },
  { id: 'command-center', label: 'Command',      icon: Crosshair  },
];

export default function Admin() {
  const [auth, setAuth] = useState(false);
  const [isDemo, setIsDemo] = useState(false);
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
    setIsDemo(localStorage.getItem('adminIsDemo') === 'true');
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
      const demo = r.data.user?.isDemo === true;
      if (demo) localStorage.setItem('adminIsDemo', 'true');
      else localStorage.removeItem('adminIsDemo');
      setIsDemo(demo);
      setAuth(true);
      toast.success(demo ? '👋 Welcome to the PlanIt demo!' : 'Welcome back, Admin');
    } catch (e) { toast.error(e.response?.data?.error || 'Login failed'); }
    finally { setLoggingIn(false); }
  };

  const logout = () => { localStorage.removeItem('adminToken'); localStorage.removeItem('adminIsDemo'); delete api.defaults.headers.common['Authorization']; setAuth(false); setIsDemo(false); toast.success('Logged out'); };

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

  // ── Demo Mode — full fake infrastructure dashboard ─────────────────────────
  if (auth && isDemo) return <DemoDashboard onLogout={logout} />;

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
      <aside className={`hidden md:flex bg-neutral-950 flex-shrink-0 flex-col transition-all duration-300 ${sidebarOpen ? 'w-56' : 'w-14'}`} style={{ position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' }}>
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
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-neutral-900 truncate">
              {selectedEvent ? selectedEvent.title : NAV_ITEMS.find(n => n.id === activeSection)?.label || 'Dashboard'}
            </h1>
            <p className="text-xs text-neutral-400">
              {selectedEvent ? 'Event Management' : 'PlanIt Admin'}
            </p>
          </div>

          {/* Global search — desktop only */}
          <form className="hidden sm:flex gap-2 items-center" onSubmit={async (e) => {
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

          <button className="hidden sm:flex" onClick={async () => { try { const r = await adminAPI.exportData('events'); const b = new Blob([JSON.stringify(r.data.data, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `planit-export-${Date.now()}.json`; a.click(); toast.success('Exported'); } catch { toast.error('Export failed'); } }} className="btn btn-secondary text-xs gap-1.5 py-1.5">
            <Download className="w-3.5 h-3.5" /> Export All
          </button>

          {stats && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-neutral-500 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-1.5">
              <Activity className="w-3 h-3 text-emerald-500" />
              <span className="font-medium">{formatNumber(stats.totalEvents)}</span> events
              <span className="text-neutral-300">·</span>
              <span className="font-medium">{formatNumber(stats.totalParticipants)}</span> users
            </div>
          )}
        </header>

        {/* Content */}
        <main className="flex-1 p-3 sm:p-6 pb-24 md:pb-6 overflow-y-auto">
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
                      {outageStatus === 'outage' ? 'Service Outage Detected' : 'Service Degradation Detected'}
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
                          <td className="px-5 py-3">{ev.isTableServiceMode ? <span className="text-xs font-semibold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full flex items-center gap-1 w-fit">Table Service</span> : ev.isEnterpriseMode ? <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full flex items-center gap-1 w-fit"><Zap className="w-3 h-3" /> Enterprise</span> : <span className="text-xs text-neutral-400">Standard</span>}</td>
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
                          <td className="px-5 py-3">{ev.isTableServiceMode ? <span className="text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full font-semibold">Table Service</span> : ev.isEnterpriseMode ? <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-semibold">Enterprise</span> : <span className="text-xs text-neutral-400">Standard</span>}</td>
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
          {activeSection === 'blocklist'      && !selectedEvent && <BlocklistPanel />}
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
                    <div className="text-sm text-amber-800">
                      <p>This will permanently delete all events (including cancelled) whose date was <strong>7+ days ago</strong> along with all their data.</p>
                      <p className="mt-1">It will also scan Cloudinary for <strong>orphaned images</strong> (cover photos and file uploads with no matching event) and delete them.</p>
                      <p className="mt-1 font-semibold">This cannot be undone.</p>
                    </div>
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
                    {cleanupResult.results && (
                      <p className="text-sm text-emerald-700 mt-1">
                        Events deleted: <strong>{cleanupResult.results.deleted}</strong>
                        {cleanupResult.results.failed > 0 && <span className="text-red-600 ml-2">({cleanupResult.results.failed} failed)</span>}
                      </p>
                    )}
                  </div>
                  {cleanupResult.cloudinary && !cleanupResult.cloudinary.skipped && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl mb-4">
                      <p className="text-sm font-semibold text-blue-800 mb-1">Cloudinary Orphan Sweep</p>
                      <p className="text-sm text-blue-700">Scanned: <strong>{cleanupResult.cloudinary.scanned}</strong> assets</p>
                      <p className="text-sm text-blue-700">Orphans deleted: <strong>{cleanupResult.cloudinary.deleted}</strong></p>
                      {cleanupResult.cloudinary.failed > 0 && (
                        <p className="text-sm text-red-600">Failed to delete: {cleanupResult.cloudinary.failed}</p>
                      )}
                    </div>
                  )}
                  {cleanupResult.cloudinary?.skipped && (
                    <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl mb-4">
                      <p className="text-xs text-neutral-500">Cloudinary sweep skipped — not configured</p>
                    </div>
                  )}
                  <button onClick={() => setShowCleanup(false)} className="btn btn-secondary w-full">Close</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    
      {/* ── Mobile bottom nav ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-neutral-950 border-t border-white/10 flex items-center justify-around px-1 safe-area-pb" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {[
          { id: 'dashboard',  icon: Monitor,   label: 'Home'      },
          { id: 'events',     icon: Calendar,  label: 'Events'    },
          { id: 'users',      icon: Users,     label: 'Users'     },
          { id: 'fleet',      icon: Rocket,    label: 'Fleet'     },
          { id: 'marketing',  icon: Send,      label: 'Marketing' },
          { id: 'system',     icon: Server,    label: 'System'    },
        ].map(({ id, icon: Icon, label }) => (
          <button key={id}
            onClick={() => { setActiveSection(id); setSelectedEvent(null); }}
            className={`flex flex-col items-center gap-0.5 py-2 px-2 min-w-0 flex-1 transition-colors ${
              activeSection === id ? 'text-white' : 'text-neutral-500'
            }`}
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            <span className="text-[9px] font-semibold truncate w-full text-center">{label}</span>
            {activeSection === id && <span className="w-1 h-1 rounded-full bg-blue-400" />}
          </button>
        ))}
        {/* More button → cycles through remaining sections */}
        <MoreNavButton activeSection={activeSection} setActiveSection={(id) => { setActiveSection(id); setSelectedEvent(null); }} />
      </nav>

</div>
  );
}
