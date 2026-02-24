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
} from 'lucide-react';
import { adminAPI, uptimeAPI, watchdogAPI } from '../services/api';
import { SERVICE_CATEGORIES } from '../utils/serviceCategories';
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
const LogLine = ({ entry }) => {
  const colors = { error: 'text-red-400', warn: 'text-amber-400', info: 'text-neutral-300' };
  const prefix = { error: '[ERR]', warn: '[WRN]', info: '[INF]' };
  const t = DateTime.fromISO(entry.ts).toFormat('HH:mm:ss.SSS');
  return (
    <div className="flex gap-3 text-xs font-mono leading-relaxed py-0.5 hover:bg-white/5 px-2 rounded">
      <span className="text-neutral-600 flex-shrink-0 select-none">{t}</span>
      <span className={`flex-shrink-0 font-bold ${colors[entry.level] || 'text-neutral-400'}`}>{prefix[entry.level] || '[LOG]'}</span>
      <span className="text-neutral-300 break-all">{entry.msg}</span>
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
                    ].map(([l, v]) => (
                      <div key={l} className="flex justify-between">
                        <p className="text-xs text-neutral-400">{l}</p>
                        <p className="text-sm font-medium text-neutral-900">{v}</p>
                      </div>
                    ))}
                  </dl>
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
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
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
            </div>
            <div className="px-5 py-4 border-t flex gap-3 flex-shrink-0">
              <button onClick={() => setShowCreate(false)} className="flex-1 btn btn-secondary text-sm">Cancel</button>
              <button onClick={async () => {
                if (!createForm.title.trim()) { toast.error('Title required'); return; }
                setCreating(true);
                try { await uptimeAPI.createIncident({ ...createForm, affectedServices: selServices }); toast.success('Created'); setShowCreate(false); load(); } catch { toast.error('Failed'); } finally { setCreating(false); }
              }} disabled={creating} className="flex-1 btn bg-neutral-900 hover:bg-neutral-800 text-white text-sm gap-2">
                {creating ? <span className="spinner w-4 h-4 border-2 border-white/30 border-t-white" /> : <Plus className="w-4 h-4" />} Create
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
    try {
      const [sysRes, wdRes] = await Promise.all([
        adminAPI.getSystem().catch(() => null),
        watchdogAPI.getStatus().catch(() => null),
      ]);
      setSys(sysRes?.data || null);
      setWatchdogData(wdRes?.data || null);
    } catch {} finally { setLoading(false); }
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
          <div className="space-y-3">
            {watchdogData.watchdog?.services?.map(svc => (
              <div key={svc.name} className="flex items-center justify-between p-3 rounded-xl bg-neutral-50">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${svc.status === 'up' ? 'bg-emerald-400' : 'bg-red-400 animate-pulse'}`} />
                  <div>
                    <p className="text-sm font-medium">{svc.name}</p>
                    <p className="text-xs text-neutral-400">{svc.type} {svc.region ? `· ${svc.region}` : ''}</p>
                  </div>
                </div>
                <div className="text-right">
                  <StatusBadge status={svc.status} />
                  {svc.lastPingMs && <p className="text-xs text-neutral-400 mt-1">{svc.lastPingMs}ms</p>}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-neutral-400 mt-3">DB: {watchdogData.dbStatus} · Checked {rel(watchdogData.checkedAt)}</p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LIVE LOGS PANEL
// ═══════════════════════════════════════════════════════════════════════════════
function LogsPanel() {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef(null);
  const esRef = useRef(null);

  const loadLogs = async () => {
    setLoading(true);
    try { const r = await adminAPI.getLogs(500); setLogs(r.data.logs || []); } catch { toast.error('Failed to load logs'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadLogs(); }, []);

  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, autoScroll]);

  const startLive = () => {
    if (esRef.current) return;
    const token = localStorage.getItem('adminToken');
    const apiUrl = import.meta.env?.VITE_API_URL || '';
    const es = new EventSource(`${apiUrl}/api/admin/logs/stream`, { withCredentials: false });
    esRef.current = es;
    es.onmessage = (e) => { try { const entry = JSON.parse(e.data); setLogs(prev => [...prev.slice(-1999), entry]); } catch {} };
    es.onerror   = () => { toast.error('Live log stream disconnected'); stopLive(); };
    setLive(true);
  };

  const stopLive = () => {
    esRef.current?.close(); esRef.current = null;
    setLive(false);
  };

  useEffect(() => () => esRef.current?.close(), []);

  const filtered = logs.filter(l => {
    if (filter !== 'all' && l.level !== filter) return false;
    if (search && !l.msg?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const counts = { all: logs.length, info: logs.filter(l => l.level === 'info').length, warn: logs.filter(l => l.level === 'warn').length, error: logs.filter(l => l.level === 'error').length };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold">Live Log Console</h2>
          <p className="text-sm text-neutral-500">{counts.all} entries · {counts.error} errors · {counts.warn} warnings</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={autoScroll ? () => setAutoScroll(false) : () => setAutoScroll(true)} className={`btn text-sm gap-1 ${autoScroll ? 'btn-primary' : 'btn-secondary'}`}>{autoScroll ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />} Auto-scroll</button>
          <button onClick={live ? stopLive : startLive} className={`btn text-sm gap-2 ${live ? 'bg-red-600 text-white border-red-600 hover:bg-red-700' : 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'}`}>
            {live ? <><Power className="w-3.5 h-3.5" /> Stop Live</> : <><Radio className="w-3.5 h-3.5" /> Go Live</>}
          </button>
          <button onClick={() => { const blob = new Blob([logs.map(l => `[${l.ts}] [${l.level.toUpperCase()}] ${l.msg}`).join('\n')], { type: 'text/plain' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `logs-${Date.now()}.txt`; a.click(); }} className="btn btn-secondary text-sm gap-1"><Download className="w-3.5 h-3.5" /> Export</button>
          <button onClick={loadLogs} className="btn btn-secondary text-sm gap-1"><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-neutral-100 rounded-xl p-1">
          {[['all', 'All', counts.all], ['info', 'Info', counts.info], ['warn', 'Warn', counts.warn], ['error', 'Error', counts.error]].map(([id, l, c]) => (
            <button key={id} onClick={() => setFilter(id)} className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${filter === id ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500'}`}>
              {l} <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${filter === id ? (id === 'error' ? 'bg-red-100 text-red-600' : id === 'warn' ? 'bg-amber-100 text-amber-600' : 'bg-neutral-100 text-neutral-600') : 'bg-neutral-200 text-neutral-500'}`}>{c}</span>
            </button>
          ))}
        </div>
        <div className="flex-1 min-w-40 relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input type="text" placeholder="Filter logs..." className="input pl-9 text-sm py-1.5" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {live && <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> LIVE</div>}
      </div>

      <div className="bg-neutral-950 rounded-2xl border border-neutral-800 overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-neutral-800 bg-neutral-900">
          <div className="flex gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-500/60" /><div className="w-2.5 h-2.5 rounded-full bg-amber-500/60" /><div className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" /></div>
          <span className="text-xs text-neutral-500 font-mono">planit-backend logs</span>
          <span className="ml-auto text-xs text-neutral-600">{filtered.length} / {counts.all}</span>
        </div>
        <div className="h-[500px] overflow-y-auto p-2" onScroll={e => { if (autoScroll) { const el = e.target; setAutoScroll(el.scrollHeight - el.scrollTop - el.clientHeight < 50); } }}>
          {loading ? <p className="text-neutral-500 text-xs font-mono p-4">Loading logs...</p> : filtered.length === 0 ? <p className="text-neutral-500 text-xs font-mono p-4">No logs match filter</p> : filtered.map((entry, i) => <LogLine key={`${entry.ts}-${i}`} entry={entry} />)}
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
  const [form, setForm] = useState({ name: '', email: '', role: 'support', department: '', phone: '', notes: '', status: 'active', permissions: { canDeleteEvents: false, canManageUsers: false, canViewLogs: false, canManageIncidents: true, canExportData: false, canRunCleanup: false } });
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
    setForm({ name: '', email: '', role: 'support', department: '', phone: '', notes: '', status: 'active', permissions: { canDeleteEvents: false, canManageUsers: false, canViewLogs: false, canManageIncidents: true, canExportData: false, canRunCleanup: false } });
    setShowModal(true);
  };

  const openEdit = (emp) => {
    setEditing(emp._id);
    setForm({ name: emp.name, email: emp.email, role: emp.role, department: emp.department || '', phone: emp.phone || '', notes: emp.notes || '', status: emp.status, permissions: { ...emp.permissions } });
    setShowModal(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.email.trim()) { toast.error('Name and email required'); return; }
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
const NAV_ITEMS = [
  { id: 'dashboard',   label: 'Dashboard',    icon: Monitor },
  { id: 'events',      label: 'Events',       icon: Calendar },
  { id: 'users',       label: 'Users',        icon: Users },
  { id: 'organizers',  label: 'Organizers',   icon: Building2 },
  { id: 'staff',       label: 'Staff',        icon: UserCheck },
  { id: 'employees',   label: 'Team',         icon: Briefcase },
  { id: 'analytics',   label: 'Analytics',    icon: BarChart3 },
  { id: 'system',      label: 'System',       icon: Server },
  { id: 'logs',        label: 'Logs',         icon: Terminal },
  { id: 'uptime',      label: 'Uptime',       icon: Radio },
];

export default function Admin() {
  const [auth, setAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [activeSection, setActiveSection] = useState('dashboard');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Dashboard data
  const [stats, setStats] = useState(null);
  const [events, setEvents] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cleanupRunning, setCleanupRunning] = useState(false);
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
          <form onSubmit={async (e) => { e.preventDefault(); if (!searchQuery.trim()) return; try { const r = await adminAPI.search(searchQuery); toast.success(`Found ${r.data.results.events.length} events, ${r.data.results.participants.length} users`); } catch { toast.error('Search failed'); } }} className="flex gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input type="text" placeholder="Global search..." className="input py-1.5 pl-9 text-sm w-48" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
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
          {activeSection === 'system'     && !selectedEvent && <div className="max-w-5xl mx-auto"><SystemPanel /></div>}
          {activeSection === 'logs'       && !selectedEvent && <div className="max-w-6xl mx-auto"><LogsPanel /></div>}
          {activeSection === 'uptime'     && !selectedEvent && <div className="max-w-4xl mx-auto"><UptimePanel /></div>}
        </main>
      </div>

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
