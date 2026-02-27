import { useState, useEffect, useRef, useCallback } from 'react';
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


const NAV_ITEMS = [
  { id: 'dashboard',   label: 'Dashboard',    icon: Monitor },
  { id: 'events',      label: 'Events',       icon: Calendar },
  { id: 'users',       label: 'Users',        icon: Users },
  { id: 'organizers',  label: 'Organizers',   icon: Building2 },
  { id: 'staff',       label: 'Staff',        icon: UserCheck },
  { id: 'employees',   label: 'Team',         icon: Briefcase },
  { id: 'analytics',   label: 'Analytics',    icon: BarChart3 },
  { id: 'fleet',       label: 'Fleet',        icon: Rocket },
  { id: 'security',    label: 'Security',     icon: Shield },
  { id: 'marketing',   label: 'Marketing',    icon: Send },
  { id: 'system',      label: 'System',       icon: Server },
  { id: 'logs',        label: 'Logs',         icon: Terminal },
  { id: 'uptime',      label: 'Uptime',       icon: Radio },
  { id: 'reports',     label: 'Reports',      icon: Inbox },
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

  // Fetch preview HTML via API (handles auth via interceptor, avoids X-Frame-Options)
  useEffect(() => {
    if (!selected) { setPreviewHtml(''); return; }
    setPreviewLoading(true);
    const params = ctaUrl ? `?ctaUrl=${encodeURIComponent(ctaUrl)}` : '';
    api.get(`/admin/marketing/preview/${selected}${params}`, { responseType: 'text' })
      .then(r => setPreviewHtml(typeof r.data === 'string' ? r.data : JSON.stringify(r.data)))
      .catch(() => toast.error('Could not load preview'))
      .finally(() => setPreviewLoading(false));
  }, [selected, ctaUrl]);

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

  const recipientCount = parseRecipients().length;

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div>
        <h2 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
          <Send className="w-5 h-5 text-violet-600" /> Marketing Emails
        </h2>
        <p className="text-sm text-neutral-500 mt-0.5">Send targeted marketing campaigns to prospective PlanIt users. One email per address per day, batched to avoid rate limits.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Left: compose */}
        <div className="space-y-4">

          {/* Template selector */}
          <div className="card p-5">
            <h3 className="text-sm font-bold text-neutral-700 mb-3">Template</h3>
            <div className="space-y-2">
              {templates.map(tpl => (
                <label
                  key={tpl.id}
                  className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-colors ${
                    selected === tpl.id
                      ? 'border-violet-500 bg-violet-50'
                      : 'border-neutral-100 hover:border-neutral-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="template"
                    value={tpl.id}
                    checked={selected === tpl.id}
                    onChange={() => handleTemplateChange(tpl.id)}
                    className="mt-0.5 accent-violet-600"
                  />
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

          {/* Subject and CTA */}
          <div className="card p-5 space-y-3">
            <h3 className="text-sm font-bold text-neutral-700 mb-1">Customise</h3>
            <div>
              <label className="block text-xs font-semibold text-neutral-500 mb-1">Subject line</label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="input text-sm w-full"
                placeholder="Default from template"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-500 mb-1">CTA button URL</label>
              <input
                type="url"
                value={ctaUrl}
                onChange={e => setCtaUrl(e.target.value)}
                className="input text-sm w-full font-mono"
                placeholder="https://planit.app"
              />
              <p className="text-xs text-neutral-400 mt-1">This is the URL the main button in the email points to.</p>
            </div>
          </div>

          {/* Recipient list */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-neutral-700">Recipients</h3>
              {recipientCount > 0 && (
                <span className="text-xs font-semibold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">
                  {recipientCount} valid {recipientCount === 1 ? 'address' : 'addresses'}
                </span>
              )}
            </div>
            <textarea
              value={recipientText}
              onChange={e => setRecipientText(e.target.value)}
              rows={6}
              className="input text-sm w-full font-mono resize-y"
              placeholder={"Paste email addresses here.\nOne per line, or comma/semicolon separated.\n\nExample:\njohn@example.com\njane@example.com, alex@example.com"}
            />
            <p className="text-xs text-neutral-400 mt-1">Maximum 1,000 recipients per send. Invalid addresses are skipped automatically.</p>
          </div>

          {/* Send button + result */}
          <div className="card p-5">
            <button
              onClick={handleSend}
              disabled={sending || !selected || recipientCount === 0}
              className="btn bg-violet-600 hover:bg-violet-700 text-white w-full gap-2 disabled:opacity-50 justify-center"
            >
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

            {result && (
              <p className="text-xs text-neutral-400 mt-3">
                Skipped addresses either already received marketing today or had an invalid format.
                Failed addresses encountered a delivery error. Check backend logs for details.
              </p>
            )}
          </div>
        </div>

        {/* Right: live preview */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold text-neutral-700">Live Preview</h3>
          <p className="text-xs text-neutral-400">Updates when you change template or CTA URL.</p>
          {selected ? (
            <div className="rounded-xl border border-neutral-200 overflow-hidden relative" style={{ height: '700px' }}>
              {previewLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-neutral-50 z-10">
                  <span className="spinner w-5 h-5 border-2 border-neutral-200 border-t-violet-500" />
                </div>
              )}
              <iframe
                key={selected}
                srcDoc={previewHtml}
                title="Email preview"
                className="w-full h-full"
                sandbox="allow-same-origin"
              />
            </div>
          ) : (
            <div className="rounded-xl border border-neutral-100 bg-neutral-50 flex items-center justify-center" style={{ height: '700px' }}>
              <p className="text-sm text-neutral-400">Select a template to see a preview</p>
            </div>
          )}
        </div>
      </div>
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
  const [showCleanup, setShowCleanup] = useState(false);

  useEffect(() => {
    setAuth(!!localStorage.getItem('adminToken'));
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
      setAuth(true);
      toast.success('Welcome back, Admin');
    } catch (e) { toast.error(e.response?.data?.error || 'Login failed'); }
    finally { setLoggingIn(false); }
  };

  const logout = () => { localStorage.removeItem('adminToken'); setAuth(false); toast.success('Logged out'); };

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
          {NAV_ITEMS.map(({ id, label, icon: I }) => (
            <button key={id} onClick={() => { setActiveSection(id); setSelectedEvent(null); }}
              className={`w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-sm font-medium transition-all group ${activeSection === id ? 'bg-white/10 text-white' : 'text-neutral-400 hover:bg-white/5 hover:text-white'}`}
              title={!sidebarOpen ? label : undefined}>
              <I className="w-4 h-4 flex-shrink-0" />
              {sidebarOpen && <span>{label}</span>}
            </button>
          ))}
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

          {activeSection === 'users'      && !selectedEvent && <div className="max-w-7xl mx-auto"><AllUsersPanel /></div>}
          {activeSection === 'organizers' && !selectedEvent && <div className="max-w-7xl mx-auto"><OrganizersPanel /></div>}
          {activeSection === 'staff'      && !selectedEvent && <div className="max-w-7xl mx-auto"><StaffPanel /></div>}
          {activeSection === 'employees'  && !selectedEvent && <div className="max-w-5xl mx-auto"><EmployeesPanel /></div>}
          {activeSection === 'analytics'  && !selectedEvent && <div className="max-w-5xl mx-auto"><AnalyticsPanel stats={stats} /></div>}
          {activeSection === 'fleet'      && !selectedEvent && <FleetControl />}
          {activeSection === 'security'   && !selectedEvent && <SecurityPanel />}
          {activeSection === 'marketing'  && !selectedEvent && <MarketingPanel />}
          {activeSection === 'system'     && !selectedEvent && <div className="max-w-5xl mx-auto"><SystemPanel /></div>}
          {activeSection === 'logs'       && !selectedEvent && <div className="max-w-6xl mx-auto"><LogsPanel /></div>}
          {activeSection === 'uptime'     && !selectedEvent && <div className="max-w-4xl mx-auto"><UptimePanel /></div>}
          {activeSection === 'reports'    && !selectedEvent && <div className="max-w-5xl mx-auto"><BugReportsPanel /></div>}
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
