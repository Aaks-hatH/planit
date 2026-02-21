import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, Users, Activity, TrendingUp, Database, HardDrive,
  Trash2, Eye, LogOut, Lock, ArrowLeft, Search, Download,
  MessageSquare, BarChart3, UserX, ChevronRight, Shield,
  RefreshCw, ShieldOff, Edit2, Save, X, FileText, Image,
  Clock, Mail, MapPin, User, Settings, AlertTriangle, CheckCircle,
  Server, Zap, DollarSign, Cpu, Info, Upload, FileUp, Trash,
  ExternalLink, Radio, AlertCircle, Plus, ChevronDown, ChevronUp,
  XCircle, Wifi
} from 'lucide-react';
import { adminAPI, uptimeAPI } from '../services/api';
import { formatNumber, formatFileSize } from '../utils/formatters';
import { DateTime } from 'luxon';

// Luxon-based formatters for Admin (timezone-aware)
const formatAdminDate = (date) => {
  if (!date) return 'No date';
  const dt = DateTime.fromISO(date, { zone: 'UTC' }).toLocal();
  const now = DateTime.local();
  if (dt.hasSame(now, 'day')) return `Today at ${dt.toFormat('HH:mm')}`;
  if (dt.hasSame(now.minus({ days: 1 }), 'day')) return `Yesterday at ${dt.toFormat('HH:mm')}`;
  return dt.toFormat('MMM dd, yyyy HH:mm');
};

const formatAdminRelative = (date) => {
  if (!date) return '';
  return DateTime.fromISO(date, { zone: 'UTC' }).toRelative() || '';
};

// Convert UTC stored date → datetime-local input value in browser's local tz
const utcToInputLocal = (utcDate) => {
  if (!utcDate) return '';
  return DateTime.fromISO(utcDate, { zone: 'UTC' }).toLocal().toFormat("yyyy-MM-dd'T'HH:mm");
};

// Convert datetime-local input value (browser local tz) → UTC ISO string for saving
const inputLocalToUTC = (localStr) => {
  if (!localStr) return '';
  return DateTime.fromISO(localStr).toUTC().toISO();
};
import toast from 'react-hot-toast';
import socketService from '../services/socket';

const StatusBadge = ({ status }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
    status === 'active'    ? 'bg-emerald-100 text-emerald-800' :
    status === 'completed' ? 'bg-blue-100 text-blue-800'      :
    status === 'cancelled' ? 'bg-red-100 text-red-800'        :
                             'bg-neutral-100 text-neutral-800'
  }`}>{status}</span>
);

// Enhanced Event Detail with Full Edit Capabilities
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
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => { loadAll(); }, [event._id]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [msgRes, partRes, pollRes, filesRes, invitesRes] = await Promise.all([
        adminAPI.getMessages(event._id).catch(() => ({ data: { messages: [] } })),
        adminAPI.getParticipants(event._id).catch(() => ({ data: { participants: [] } })),
        adminAPI.getPolls(event._id).catch(() => ({ data: { polls: [] } })),
        adminAPI.getFiles(event._id).catch(() => ({ data: { files: [] } })),
        adminAPI.getInvites(event._id).catch(() => ({ data: { invites: [] } })),
      ]);
      setMessages(msgRes.data.messages || []);
      setParticipants(partRes.data.participants || []);
      setPolls(pollRes.data.polls || []);
      setFiles(filesRes.data.files || []);
      setInvites(invitesRes.data.invites || []);
    } catch (err) { 
      console.error('Load error:', err);
      toast.error('Failed to load some event data'); 
    }
    finally { setLoading(false); }
  };

  const handleSaveEdit = async () => {
    try {
      await adminAPI.updateEvent(event._id, editForm);
      setEvent({ ...event, ...editForm });
      setEditMode(false);
      toast.success('Event updated');
      onUpdate?.();
    } catch { toast.error('Failed to update event'); }
  };

  const handleDeleteMessage = async (msgId) => {
    if (!confirm('Delete this message permanently?')) return;
    try {
      await adminAPI.deleteMessage(event._id, msgId);
      setMessages(prev => prev.filter(m => m._id !== msgId));
      toast.success('Message deleted');
    } catch { toast.error('Failed to delete message'); }
  };

  const handleRemoveParticipant = async (username) => {
    if (!confirm(`Remove ${username} from this event?`)) return;
    try {
      await adminAPI.removeParticipant(event._id, username);
      setParticipants(prev => prev.filter(p => p.username !== username));
      toast.success('Participant removed');
    } catch { toast.error('Failed to remove participant'); }
  };

  const handleResetPassword = async (username) => {
    if (!confirm(`Reset account password for ${username}?`)) return;
    try {
      await adminAPI.resetParticipantPassword(event._id, username);
      setParticipants(prev => prev.map(p => 
        p.username === username ? { ...p, hasPassword: false } : p
      ));
      toast.success('Password reset successfully');
    } catch { toast.error('Failed to reset password'); }
  };

  const handleDeletePoll = async (pollId) => {
    if (!confirm('Delete this poll?')) return;
    try {
      await adminAPI.deletePoll(event._id, pollId);
      setPolls(prev => prev.filter(p => p._id !== pollId));
      toast.success('Poll deleted');
    } catch { toast.error('Failed to delete poll'); }
  };

  const handleDeleteFile = async (fileId) => {
    if (!confirm('Delete this file?')) return;
    try {
      await adminAPI.deleteFile(event._id, fileId);
      setFiles(prev => prev.filter(f => f._id !== fileId));
      toast.success('File deleted');
    } catch { toast.error('Failed to delete file'); }
  };

  const handleCheckInGuest = async (inviteCode) => {
    try {
      await adminAPI.checkInGuest(event._id, inviteCode);
      toast.success('Guest checked in');
      loadAll();
    } catch { toast.error('Failed to check in guest'); }
  };

  const handleDeleteInvite = async (inviteId) => {
    if (!confirm('Delete this invite?')) return;
    try {
      await adminAPI.deleteInvite(event._id, inviteId);
      setInvites(prev => prev.filter(i => i._id !== inviteId));
      toast.success('Invite deleted');
    } catch { toast.error('Failed to delete invite'); }
  };

  const handleChangeStatus = async (newStatus) => {
    if (!confirm(`Change event status to "${newStatus}"?`)) return;
    try {
      await adminAPI.updateEventStatus(event._id, newStatus);
      setEvent({ ...event, status: newStatus });
      toast.success(`Status changed to ${newStatus}`);
      onUpdate?.();
    } catch { toast.error('Failed to update status'); }
  };

  const handleExportData = async (type) => {
    try {
      const data = type === 'messages' ? messages :
                   type === 'participants' ? participants :
                   type === 'polls' ? polls :
                   type === 'invites' ? invites : files;
      
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${event.subdomain}-${type}-${Date.now()}.json`;
      a.click();
      toast.success(`Exported ${type}`);
    } catch { toast.error('Export failed'); }
  };

  const filteredMessages = messages.filter(m => 
    !searchTerm || m.content?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.username?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredParticipants = participants.filter(p =>
    !searchTerm || p.username?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const tabs = [
    { id: 'overview',     label: 'Overview',     icon: Info,          count: null },
    { id: 'messages',     label: 'Chat',         icon: MessageSquare, count: messages.length },
    { id: 'participants', label: 'Participants', icon: Users,         count: participants.length },
    { id: 'polls',        label: 'Polls',        icon: BarChart3,     count: polls.length },
    { id: 'files',        label: 'Files',        icon: FileText,      count: files.length },
    { id: 'invites',      label: 'Invites',      icon: Mail,          count: invites.length },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <button onClick={onBack} className="btn btn-ghost p-1.5">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-neutral-900 truncate">{event.title}</h2>
          <p className="text-xs text-neutral-500">
            ID: {event._id} · /{event.subdomain} · {event.organizerEmail}
          </p>
        </div>
        <StatusBadge status={event.status} />
        
        {/* View Event Button */}
        <button
          onClick={async () => {
            try {
              const res = await adminAPI.getEventAccess(event._id);
              localStorage.setItem('eventToken', res.data.token);
              localStorage.setItem('username', 'ADMIN');
              window.open(`/event/${event._id}`, '_blank');
              toast.success('Admin access granted - opened in new tab');
            } catch {
              toast.error('Failed to generate access token');
            }
          }}
          className="btn btn-secondary text-xs gap-1.5 flex items-center"
          title="View this event as admin (bypasses password)"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">View Event</span>
        </button>
        
        {/* Status Change Dropdown */}
        <select 
          value={event.status} 
          onChange={(e) => handleChangeStatus(e.target.value)}
          className="input py-1.5 text-sm"
        >
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="draft">Draft</option>
        </select>

        {editMode ? (
          <>
            <button onClick={handleSaveEdit} className="btn btn-primary gap-1.5 text-sm">
              <Save className="w-3.5 h-3.5" /> Save
            </button>
            <button onClick={() => { setEditMode(false); setEditForm({}); }}
              className="btn btn-secondary gap-1.5 text-sm">
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
          </>
        ) : (
          <button onClick={() => { setEditMode(true); setEditForm(event); }}
            className="btn btn-secondary gap-1.5 text-sm">
            <Edit2 className="w-3.5 h-3.5" /> Edit
          </button>
        )}
        
        <a href={`/e/${event.subdomain}`} target="_blank" rel="noopener noreferrer"
          className="btn btn-secondary gap-1.5 text-sm">
          <Eye className="w-3.5 h-3.5" /> View
        </a>
        <button onClick={() => onDelete(event._id)}
          className="btn btn-secondary gap-1.5 text-sm text-red-600 hover:bg-red-50">
          <Trash2 className="w-3.5 h-3.5" /> Delete
        </button>
      </div>

      {/* Edit Form */}
      {editMode && (
        <div className="card p-6 mb-6 bg-amber-50 border-amber-200">
          <h3 className="text-sm font-semibold text-neutral-900 mb-4">Edit Event Details</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Title</label>
              <input type="text" className="input text-sm" value={editForm.title || ''}
                onChange={e => setEditForm({ ...editForm, title: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Subdomain</label>
              <input type="text" className="input text-sm" value={editForm.subdomain || ''}
                onChange={e => setEditForm({ ...editForm, subdomain: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Date</label>
              <input type="datetime-local" className="input text-sm" 
                value={editForm.date ? utcToInputLocal(editForm.date) : ''}
                onChange={e => setEditForm({ ...editForm, date: inputLocalToUTC(e.target.value) })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Location</label>
              <input type="text" className="input text-sm" value={editForm.location || ''}
                onChange={e => setEditForm({ ...editForm, location: e.target.value })} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-neutral-700 mb-1">Description</label>
              <textarea className="input text-sm" rows="2" value={editForm.description || ''}
                onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Organizer Name</label>
              <input type="text" className="input text-sm" value={editForm.organizerName || ''}
                onChange={e => setEditForm({ ...editForm, organizerName: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Organizer Email</label>
              <input type="email" className="input text-sm" value={editForm.organizerEmail || ''}
                onChange={e => setEditForm({ ...editForm, organizerEmail: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Max Participants</label>
              <input type="number" className="input text-sm" value={editForm.maxParticipants || 100}
                onChange={e => setEditForm({ ...editForm, maxParticipants: parseInt(e.target.value) })} />
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editForm.isPasswordProtected || false}
                  onChange={e => setEditForm({ ...editForm, isPasswordProtected: e.target.checked })} />
                Password Protected
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editForm.isEnterpriseMode || false}
                  onChange={e => setEditForm({ ...editForm, isEnterpriseMode: e.target.checked })} />
                Enterprise Mode
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
        {[
          { label: 'Messages',     value: messages.length,     icon: MessageSquare },
          { label: 'Participants', value: participants.length, icon: Users },
          { label: 'Polls',        value: polls.length,        icon: BarChart3 },
          { label: 'Files',        value: files.length,        icon: FileText },
          { label: 'Invites',      value: invites.length,      icon: Mail },
          { label: 'Checked In',   value: invites.filter(i => i.checkedIn).length, icon: CheckCircle },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="card p-4 flex items-center gap-3">
            <Icon className="w-5 h-5 text-neutral-400" />
            <div>
              <p className="text-xl font-bold text-neutral-900">{value}</p>
              <p className="text-xs text-neutral-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="card overflow-hidden">
        <div className="flex border-b border-neutral-200 overflow-x-auto">
          {tabs.map(({ id, label, icon: Icon, count }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                tab === id ? 'border-b-2 border-neutral-900 text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'
              }`}>
              <Icon className="w-4 h-4" />{label}
              {count !== null && <span className="text-xs bg-neutral-100 text-neutral-600 rounded-full px-1.5 py-0.5">{count}</span>}
            </button>
          ))}
          <button onClick={loadAll} className="ml-auto mr-3 my-2 btn btn-ghost p-1.5" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="spinner w-6 h-6 border-2 border-neutral-300 border-t-neutral-600" />
          </div>
        ) : (
          <div className="p-5">
            {/* Overview Tab */}
            {tab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-xs font-semibold text-neutral-500 uppercase mb-3">Event Info</h3>
                    <div className="space-y-2.5">
                      {[
                        { icon: Calendar, label: 'Date', value: formatAdminDate(event.date) },
                        { icon: MapPin, label: 'Location', value: event.location || 'Not set' },
                        { icon: User, label: 'Organizer', value: event.organizerName },
                        { icon: Mail, label: 'Email', value: event.organizerEmail },
                        { icon: Clock, label: 'Created', value: formatAdminRelative(event.createdAt) },
                        { icon: Users, label: 'Max Capacity', value: event.maxParticipants },
                      ].map(({ icon: Icon, label, value }) => (
                        <div key={label} className="flex items-start gap-2.5">
                          <Icon className="w-4 h-4 text-neutral-400 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-neutral-500">{label}</p>
                            <p className="text-sm text-neutral-900 font-medium truncate">{value}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-neutral-500 uppercase mb-3">Settings</h3>
                    <div className="space-y-2.5">
                      {[
                        { label: 'Password Protected', value: event.isPasswordProtected },
                        { label: 'Enterprise Mode', value: event.isEnterpriseMode },
                        { label: 'Subdomain', value: event.subdomain },
                        { label: 'Status', value: event.status },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex items-center justify-between">
                          <p className="text-xs text-neutral-500">{label}</p>
                          <p className="text-sm text-neutral-900 font-medium">
                            {typeof value === 'boolean' ? (value ? '✓ Yes' : '✗ No') : value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                {event.description && (
                  <div>
                    <h3 className="text-xs font-semibold text-neutral-500 uppercase mb-2">Description</h3>
                    <p className="text-sm text-neutral-700 leading-relaxed">{event.description}</p>
                  </div>
                )}
              </div>
            )}

            {/* Messages Tab */}
            {tab === 'messages' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex-1 max-w-md">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                      <input
                        type="text"
                        placeholder="Search messages..."
                        className="input pl-10 text-sm"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>
                  <button onClick={() => handleExportData('messages')} 
                    className="btn btn-secondary text-sm gap-1.5">
                    <Download className="w-3.5 h-3.5" /> Export
                  </button>
                </div>
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  {filteredMessages.length === 0 ? (
                    <p className="text-sm text-neutral-400 text-center py-12">No messages</p>
                  ) : filteredMessages.map(msg => (
                    <div key={msg._id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-neutral-50 group border border-neutral-100">
                      <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center text-xs font-bold text-neutral-600 flex-shrink-0">
                        {msg.username?.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-semibold text-neutral-900">{msg.username}</span>
                          <span className="text-xs text-neutral-400">{formatAdminRelative(msg.createdAt)}</span>
                        </div>
                        <p className="text-sm text-neutral-700 mt-0.5 break-words">{msg.content}</p>
                        {msg.editedAt && (
                          <p className="text-xs text-neutral-400 mt-1">(edited)</p>
                        )}
                      </div>
                      <button onClick={() => handleDeleteMessage(msg._id)}
                        className="opacity-0 group-hover:opacity-100 btn btn-ghost p-1.5 text-red-400 hover:text-red-600">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Participants Tab */}
            {tab === 'participants' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex-1 max-w-md">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                      <input
                        type="text"
                        placeholder="Search participants..."
                        className="input pl-10 text-sm"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>
                  <button onClick={() => handleExportData('participants')} 
                    className="btn btn-secondary text-sm gap-1.5">
                    <Download className="w-3.5 h-3.5" /> Export
                  </button>
                </div>
                <div className="space-y-2">
                  {filteredParticipants.length === 0 ? (
                    <p className="text-sm text-neutral-400 text-center py-12">No participants</p>
                  ) : filteredParticipants.map(p => (
                    <div key={p.username} className="flex items-center justify-between p-3 rounded-lg border border-neutral-100 hover:bg-neutral-50 group">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold">
                          {p.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-neutral-900">{p.username}</p>
                          <p className="text-xs text-neutral-400">
                            {p.hasPassword && <Lock className="w-3 h-3 inline mr-1" />}
                            Joined {formatAdminRelative(p.joinedAt)}
                            {p.rsvp && <> · RSVP: {p.rsvp.status}</>}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100">
                        {p.hasPassword && (
                          <button onClick={() => handleResetPassword(p.username)}
                            className="btn btn-secondary text-xs px-2 py-1">
                            <ShieldOff className="w-3 h-3" /> Reset Password
                          </button>
                        )}
                        <button onClick={() => handleRemoveParticipant(p.username)}
                          className="btn btn-secondary text-xs px-2 py-1 text-red-600 hover:bg-red-50">
                          <UserX className="w-3 h-3" /> Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Polls Tab */}
            {tab === 'polls' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-neutral-900">
                    {polls.length} {polls.length === 1 ? 'Poll' : 'Polls'}
                  </h3>
                  <button onClick={() => handleExportData('polls')} 
                    className="btn btn-secondary text-sm gap-1.5">
                    <Download className="w-3.5 h-3.5" /> Export
                  </button>
                </div>
                <div className="space-y-3">
                  {polls.length === 0 ? (
                    <p className="text-sm text-neutral-400 text-center py-12">No polls</p>
                  ) : polls.map(poll => {
                    const totalVotes = poll.options?.reduce((sum, opt) => sum + (opt.votes?.length || 0), 0) || 0;
                    return (
                      <div key={poll._id} className="p-4 rounded-lg border border-neutral-200 hover:bg-neutral-50 group">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-neutral-900">{poll.question}</p>
                            <p className="text-xs text-neutral-400 mt-1">
                              Created {formatAdminRelative(poll.createdAt)} · {totalVotes} votes
                            </p>
                          </div>
                          <button onClick={() => handleDeletePoll(poll._id)}
                            className="opacity-0 group-hover:opacity-100 btn btn-ghost p-1.5 text-red-400 hover:text-red-600">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="space-y-1.5">
                          {poll.options?.map(opt => {
                            const votes = opt.votes?.length || 0;
                            const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                            return (
                              <div key={opt.text} className="relative">
                                <div className="flex items-center justify-between text-xs mb-1">
                                  <span className="text-neutral-700">{opt.text}</span>
                                  <span className="text-neutral-500">{votes} ({percentage}%)</span>
                                </div>
                                <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-blue-500 transition-all"
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Files Tab */}
            {tab === 'files' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-neutral-900">
                    {files.length} {files.length === 1 ? 'File' : 'Files'}
                    {files.length > 0 && (
                      <span className="text-neutral-400 font-normal ml-2">
                        ({formatFileSize(files.reduce((sum, f) => sum + (f.size || 0), 0))})
                      </span>
                    )}
                  </h3>
                  <button onClick={() => handleExportData('files')} 
                    className="btn btn-secondary text-sm gap-1.5">
                    <Download className="w-3.5 h-3.5" /> Export List
                  </button>
                </div>
                <div className="space-y-2">
                  {files.length === 0 ? (
                    <p className="text-sm text-neutral-400 text-center py-12">No files</p>
                  ) : files.map(file => (
                    <div key={file._id} className="flex items-center justify-between p-3 rounded-lg border border-neutral-100 hover:bg-neutral-50 group">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {file.mimetype?.startsWith('image/') ? (
                          <Image className="w-5 h-5 text-blue-500 flex-shrink-0" />
                        ) : (
                          <FileText className="w-5 h-5 text-neutral-400 flex-shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-neutral-900 truncate">{file.filename}</p>
                          <p className="text-xs text-neutral-400">
                            {formatFileSize(file.size)} · Uploaded by {file.uploadedBy} · {formatAdminRelative(file.uploadedAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100">
                        <a href={file.url} target="_blank" rel="noopener noreferrer"
                          className="btn btn-secondary text-xs px-2 py-1">
                          <Download className="w-3 h-3" />
                        </a>
                        <button onClick={() => handleDeleteFile(file._id)}
                          className="btn btn-secondary text-xs px-2 py-1 text-red-600 hover:bg-red-50">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Invites Tab */}
            {tab === 'invites' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-neutral-900">
                    {invites.length} {invites.length === 1 ? 'Invite' : 'Invites'}
                    {invites.length > 0 && (
                      <span className="text-neutral-400 font-normal ml-2">
                        ({invites.filter(i => i.checkedIn).length} checked in)
                      </span>
                    )}
                  </h3>
                  <button onClick={() => handleExportData('invites')} 
                    className="btn btn-secondary text-sm gap-1.5">
                    <Download className="w-3.5 h-3.5" /> Export
                  </button>
                </div>
                <div className="space-y-2">
                  {invites.length === 0 ? (
                    <p className="text-sm text-neutral-400 text-center py-12">No invites</p>
                  ) : invites.map(invite => (
                    <div key={invite._id} className={`p-3 rounded-lg border hover:bg-neutral-50 group ${
                      invite.checkedIn ? 'bg-emerald-50 border-emerald-200' : 'border-neutral-100'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-medium text-neutral-900">{invite.guestName}</p>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 font-mono">
                              {invite.inviteCode}
                            </span>
                            {invite.checkedIn && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                                ✓ Checked In
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-neutral-500">
                            {invite.guestEmail && <>{invite.guestEmail} · </>}
                            {invite.groupSize} {invite.groupSize === 1 ? 'person' : 'people'}
                            {invite.plusOnes > 0 && <> (+{invite.plusOnes} plus ones)</>}
                            {invite.checkedIn && <> · {formatAdminRelative(invite.checkedInAt)}</>}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100">
                          {!invite.checkedIn && (
                            <button onClick={() => handleCheckInGuest(invite.inviteCode)}
                              className="btn btn-primary text-xs px-2 py-1">
                              Check In
                            </button>
                          )}
                          <button onClick={() => handleDeleteInvite(invite._id)}
                            className="btn btn-secondary text-xs px-2 py-1 text-red-600 hover:bg-red-50">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// UPTIME PANEL
// ─────────────────────────────────────────────────────────────────

const SEVERITY_META = {
  minor:    { label: 'Minor',    bg: 'bg-amber-100',  text: 'text-amber-700'  },
  major:    { label: 'Major',    bg: 'bg-orange-100', text: 'text-orange-700' },
  critical: { label: 'Critical', bg: 'bg-red-100',    text: 'text-red-700'    },
};
const STATUS_META = {
  investigating: { label: 'Investigating', dot: 'bg-red-500'     },
  identified:    { label: 'Identified',    dot: 'bg-orange-400'  },
  monitoring:    { label: 'Monitoring',    dot: 'bg-amber-400'   },
  resolved:      { label: 'Resolved',      dot: 'bg-emerald-500' },
};

function uptimeTimeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function formatDowntime(mins) {
  if (!mins) return null;
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function UptimePanel() {
  const [reports, setReports] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const [loadingIncidents, setLoadingIncidents] = useState(true);
  const [activeTab, setActiveTab] = useState('reports');
  const [expandedIncident, setExpandedIncident] = useState(null);

  // Create incident form
  const [showCreateIncident, setShowCreateIncident] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '', description: '', severity: 'minor', affectedServices: '', initialMessage: '', reportIds: []
  });
  const [creating, setCreating] = useState(false);

  // Timeline update form
  const [timelineTarget, setTimelineTarget] = useState(null);
  const [tlForm, setTlForm] = useState({ status: 'investigating', message: '' });
  const [tlSubmitting, setTlSubmitting] = useState(false);

  useEffect(() => { loadReports(); loadIncidents(); }, []);

  const loadReports = async () => {
    setLoadingReports(true);
    try {
      const res = await uptimeAPI.getReports();
      setReports(res.data.reports || []);
    } catch { /* silent */ }
    finally { setLoadingReports(false); }
  };

  const loadIncidents = async () => {
    setLoadingIncidents(true);
    try {
      const res = await uptimeAPI.getIncidents();
      setIncidents(res.data.incidents || []);
    } catch { /* silent */ }
    finally { setLoadingIncidents(false); }
  };

  const handleDismissReport = async (id) => {
    try {
      await uptimeAPI.updateReport(id, { status: 'dismissed' });
      setReports(r => r.map(x => x._id === id ? { ...x, status: 'dismissed' } : x));
    } catch { toast.error('Failed to update report'); }
  };

  const handleCreateIncident = async () => {
    if (!createForm.title.trim()) { toast.error('Title required'); return; }
    setCreating(true);
    try {
      const payload = {
        title: createForm.title,
        description: createForm.description,
        severity: createForm.severity,
        affectedServices: createForm.affectedServices ? createForm.affectedServices.split(',').map(s => s.trim()).filter(Boolean) : [],
        initialMessage: createForm.initialMessage,
        reportIds: createForm.reportIds,
      };
      await uptimeAPI.createIncident(payload);
      toast.success('Incident created');
      setShowCreateIncident(false);
      setCreateForm({ title: '', description: '', severity: 'minor', affectedServices: '', initialMessage: '', reportIds: [] });
      loadIncidents();
      loadReports();
    } catch { toast.error('Failed to create incident'); }
    finally { setCreating(false); }
  };

  const handleAddTimeline = async () => {
    if (!tlForm.message.trim()) { toast.error('Message required'); return; }
    setTlSubmitting(true);
    try {
      const res = await uptimeAPI.addTimelineUpdate(timelineTarget, tlForm);
      setIncidents(inc => inc.map(i => i._id === timelineTarget ? res.data.incident : i));
      setTlForm({ status: 'investigating', message: '' });
      setTimelineTarget(null);
      toast.success('Timeline updated');
    } catch { toast.error('Failed to update timeline'); }
    finally { setTlSubmitting(false); }
  };

  const handleDeleteIncident = async (id) => {
    if (!confirm('Delete this incident permanently?')) return;
    try {
      await uptimeAPI.deleteIncident(id);
      setIncidents(i => i.filter(x => x._id !== id));
      toast.success('Incident deleted');
    } catch { toast.error('Failed to delete incident'); }
  };

  const pendingCount = reports.filter(r => r.status === 'pending').length;
  const activeCount = incidents.filter(i => i.status !== 'resolved').length;

  return (
    <div className="space-y-6">
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        .fade-up { animation: fadeUp 0.25s ease both; }
      `}</style>

      {/* Top bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-bold text-neutral-900">Uptime & Incidents</h2>
          <p className="text-sm text-neutral-500 mt-0.5">
            {activeCount > 0 ? `${activeCount} active incident${activeCount > 1 ? 's' : ''}` : 'All systems nominal'} · {pendingCount} pending report{pendingCount !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <a href="/status" target="_blank" rel="noopener noreferrer"
            className="btn btn-secondary gap-2 text-sm">
            <ExternalLink className="w-4 h-4" /> Public Page
          </a>
          <button onClick={() => setShowCreateIncident(true)}
            className="btn btn-primary gap-2 text-sm bg-neutral-900 hover:bg-neutral-800 text-white border-neutral-900">
            <Plus className="w-4 h-4" /> New Incident
          </button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-neutral-100 rounded-xl p-1 w-fit">
        {[
          { id: 'reports',   label: 'Reports',   count: pendingCount  },
          { id: 'incidents', label: 'Incidents', count: activeCount   },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
              activeTab === t.id ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'
            }`}>
            {t.label}
            {t.count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${activeTab === t.id ? 'bg-red-100 text-red-600' : 'bg-neutral-200 text-neutral-500'}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Reports tab */}
      {activeTab === 'reports' && (
        <div className="fade-up">
          {loadingReports ? (
            <div className="flex justify-center py-12">
              <span className="spinner w-6 h-6 border-2 border-neutral-200 border-t-neutral-600" />
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-16 text-neutral-400">
              <Radio className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No reports yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {reports.map((r, i) => (
                <div key={r._id} className={`card p-4 flex items-start gap-4 transition-all fade-up`}
                  style={{ animationDelay: `${i * 0.04}s` }}>
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                    r.status === 'pending' ? 'bg-amber-400 animate-pulse' :
                    r.status === 'confirmed' ? 'bg-red-500' : 'bg-neutral-300'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full">
                        {r.affectedService}
                      </span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        r.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                        r.status === 'confirmed' ? 'bg-red-100 text-red-700' :
                        'bg-neutral-100 text-neutral-400'
                      }`}>{r.status}</span>
                      <span className="text-xs text-neutral-400">{uptimeTimeAgo(r.createdAt)}</span>
                    </div>
                    <p className="text-sm text-neutral-800 mt-1.5 leading-relaxed">{r.description}</p>
                    {r.email && <p className="text-xs text-neutral-400 mt-1">{r.email}</p>}
                  </div>
                  {r.status === 'pending' && (
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => {
                          setCreateForm(f => ({ ...f, reportIds: [r._id], description: r.description }));
                          setShowCreateIncident(true);
                        }}
                        className="text-xs px-3 py-1.5 rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 transition-colors font-medium"
                      >
                        Make Incident
                      </button>
                      <button
                        onClick={() => handleDismissReport(r._id)}
                        className="text-xs px-3 py-1.5 rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-50 transition-colors"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Incidents tab */}
      {activeTab === 'incidents' && (
        <div className="fade-up space-y-3">
          {loadingIncidents ? (
            <div className="flex justify-center py-12">
              <span className="spinner w-6 h-6 border-2 border-neutral-200 border-t-neutral-600" />
            </div>
          ) : incidents.length === 0 ? (
            <div className="text-center py-16 text-neutral-400">
              <CheckCircle className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No incidents on record</p>
            </div>
          ) : incidents.map((inc, i) => {
            const sm = STATUS_META[inc.status] || STATUS_META.investigating;
            const sv = SEVERITY_META[inc.severity] || SEVERITY_META.minor;
            const isExpanded = expandedIncident === inc._id;
            return (
              <div key={inc._id} className="card overflow-hidden fade-up" style={{ animationDelay: `${i * 0.04}s` }}>
                <button className="w-full px-5 py-4 flex items-start gap-3 text-left hover:bg-neutral-50 transition-colors"
                  onClick={() => setExpandedIncident(isExpanded ? null : inc._id)}>
                  <span className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ${sm.dot} ${inc.status !== 'resolved' ? 'animate-pulse' : ''}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-neutral-900">{inc.title}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sv.bg} ${sv.text}`}>{sv.label}</span>
                      <span className="text-xs text-neutral-400 font-medium">{sm.label}</span>
                      {inc.downtimeMinutes && (
                        <span className="text-xs text-neutral-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />{formatDowntime(inc.downtimeMinutes)}
                        </span>
                      )}
                    </div>
                    {inc.affectedServices?.length > 0 && (
                      <p className="text-xs text-neutral-500 mt-0.5">Affects: {inc.affectedServices.join(', ')}</p>
                    )}
                    <p className="text-xs text-neutral-400 mt-0.5">{uptimeTimeAgo(inc.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {inc.status !== 'resolved' && (
                      <button
                        onClick={e => { e.stopPropagation(); setTimelineTarget(inc._id); setTlForm({ status: 'investigating', message: '' }); }}
                        className="text-xs px-3 py-1.5 rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 transition-colors font-medium"
                      >
                        Update
                      </button>
                    )}
                    <button onClick={e => { e.stopPropagation(); handleDeleteIncident(inc._id); }}
                      className="p-1.5 text-neutral-300 hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-neutral-100">
                    {inc.description && (
                      <p className="text-sm text-neutral-600 mt-4 mb-4 leading-relaxed">{inc.description}</p>
                    )}
                    {inc.timeline?.length > 0 && (
                      <div className="relative pl-4 mt-4">
                        <div className="absolute left-0 top-0 bottom-0 w-px bg-neutral-200" />
                        {[...inc.timeline].reverse().map((update, j) => {
                          const usm = STATUS_META[update.status] || STATUS_META.investigating;
                          return (
                            <div key={j} className="relative mb-4 last:mb-0">
                              <span className={`absolute -left-[17px] w-2.5 h-2.5 rounded-full border-2 border-white ${usm.dot}`} />
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-neutral-700">{usm.label}</span>
                                <span className="text-xs text-neutral-400">{uptimeTimeAgo(update.createdAt)}</span>
                              </div>
                              <p className="text-sm text-neutral-600 mt-0.5 leading-relaxed">{update.message}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Incident Modal */}
      {showCreateIncident && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4"
          onClick={e => e.target === e.currentTarget && setShowCreateIncident(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
            style={{ animation: 'fadeUp 0.2s ease both' }}>
            <div className="px-6 py-5 border-b border-neutral-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-neutral-900">Create Incident</h3>
                <p className="text-xs text-neutral-500 mt-0.5">This will appear publicly on the status page</p>
              </div>
              <button onClick={() => setShowCreateIncident(false)} className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors">
                <X className="w-4 h-4 text-neutral-400" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1.5">Title <span className="text-red-400">*</span></label>
                <input value={createForm.title} onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. API Response Delays" className="input w-full text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1.5">Severity</label>
                  <select value={createForm.severity} onChange={e => setCreateForm(f => ({ ...f, severity: e.target.value }))}
                    className="input w-full text-sm">
                    <option value="minor">Minor</option>
                    <option value="major">Major</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1.5">Affected Services</label>
                  <input value={createForm.affectedServices} onChange={e => setCreateForm(f => ({ ...f, affectedServices: e.target.value }))}
                    placeholder="API, Chat (comma-sep)" className="input w-full text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1.5">Description</label>
                <textarea value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Brief summary of the issue..." rows={2} className="input w-full text-sm resize-none" />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1.5">Initial Status Message</label>
                <textarea value={createForm.initialMessage} onChange={e => setCreateForm(f => ({ ...f, initialMessage: e.target.value }))}
                  placeholder="We are investigating reports of..." rows={2} className="input w-full text-sm resize-none" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-neutral-100 flex gap-3">
              <button onClick={() => setShowCreateIncident(false)} className="flex-1 btn btn-secondary text-sm">
                Cancel
              </button>
              <button onClick={handleCreateIncident} disabled={creating}
                className="flex-1 btn bg-neutral-900 hover:bg-neutral-800 text-white text-sm gap-2 disabled:opacity-50">
                {creating ? <span className="spinner w-4 h-4 border-2 border-white/30 border-t-white" /> : <Plus className="w-4 h-4" />}
                Create Incident
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Timeline Update Modal */}
      {timelineTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4"
          onClick={e => e.target === e.currentTarget && setTimelineTarget(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            style={{ animation: 'fadeUp 0.2s ease both' }}>
            <div className="px-6 py-5 border-b border-neutral-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-neutral-900">Post Update</h3>
              <button onClick={() => setTimelineTarget(null)} className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors">
                <X className="w-4 h-4 text-neutral-400" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1.5">New Status</label>
                <select value={tlForm.status} onChange={e => setTlForm(f => ({ ...f, status: e.target.value }))}
                  className="input w-full text-sm">
                  <option value="investigating">Investigating</option>
                  <option value="identified">Identified</option>
                  <option value="monitoring">Monitoring</option>
                  <option value="resolved">Resolved ✓</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1.5">Message <span className="text-red-400">*</span></label>
                <textarea value={tlForm.message} onChange={e => setTlForm(f => ({ ...f, message: e.target.value }))}
                  placeholder="What's the latest..." rows={3} className="input w-full text-sm resize-none" />
              </div>
              {tlForm.status === 'resolved' && (
                <div className="flex items-start gap-2 p-3 bg-emerald-50 rounded-xl text-xs text-emerald-700">
                  <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  Marking as resolved will auto-calculate downtime duration and close the incident.
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-neutral-100 flex gap-3">
              <button onClick={() => setTimelineTarget(null)} className="flex-1 btn btn-secondary text-sm">Cancel</button>
              <button onClick={handleAddTimeline} disabled={tlSubmitting}
                className={`flex-1 btn text-sm text-white gap-2 disabled:opacity-50 ${
                  tlForm.status === 'resolved' ? 'bg-emerald-600 hover:bg-emerald-700 border-emerald-600' : 'bg-neutral-900 hover:bg-neutral-800'
                }`}>
                {tlSubmitting ? <span className="spinner w-4 h-4 border-2 border-white/30 border-t-white" /> : null}
                {tlForm.status === 'resolved' ? 'Mark Resolved' : 'Post Update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Main Admin Component
export default function Admin() {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  
  const [stats, setStats] = useState(null);
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cleanupRunning, setCleanupRunning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState(null);
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [uptimeView, setUptimeView] = useState(false);

  useEffect(() => {
    checkAuth();
    // Listen for the token-expired event fired by the api.js interceptor.
    // Using a custom event instead of window.location.href avoids a full-page
    // reload loop when every request returns 401 due to a mismatched secret.
    const onAdminLogout = () => {
      setIsAuthenticated(false);
      setStats(null);
      setEvents([]);
      setSelectedEvent(null);
    };
    window.addEventListener('planit:admin-logout', onAdminLogout);
    return () => window.removeEventListener('planit:admin-logout', onAdminLogout);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadDashboard();
      // Auto-refresh dashboard every 30 seconds for real-time updates
      const interval = setInterval(() => {
        loadDashboard();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, currentPage, statusFilter]);

  const checkAuth = () => {
    const token = localStorage.getItem('adminToken');
    setIsAuthenticated(!!token);
    setLoading(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoggingIn(true);
    try {
      const res = await adminAPI.login(loginForm.username, loginForm.password);
      localStorage.setItem('adminToken', res.data.token);
      setIsAuthenticated(true);
      toast.success('Logged in successfully');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Login failed');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    setIsAuthenticated(false);
    toast.success('Logged out');
  };

  const loadDashboard = async () => {
    try {
      const [statsRes, eventsRes] = await Promise.all([
        adminAPI.getStats(),
        adminAPI.getEvents({ 
          page: currentPage, 
          limit: 20, 
          status: statusFilter === 'all' ? undefined : statusFilter 
        }),
      ]);
      setStats(statsRes.data);
      setEvents(eventsRes.data.events);
      setTotalPages(eventsRes.data.pagination.pages);
    } catch (error) {
      console.error('Dashboard load error:', error);
      if (error.response?.status === 401) {
        handleLogout();
      }
    }
  };

  const handleDeleteEvent = async (eventId) => {
    if (!confirm('Delete this event and ALL its data permanently? This cannot be undone!')) return;
    try {
      await adminAPI.deleteEvent(eventId);
      toast.success('Event deleted permanently');
      setSelectedEvent(null);
      loadDashboard();
    } catch { toast.error('Failed to delete event'); }
  };

  const handleManualCleanup = async () => {
    setCleanupRunning(true);
    setCleanupResult(null);
    try {
      const res = await adminAPI.manualCleanup();
      setCleanupResult(res.data);
      if (res.data.results.deleted > 0) {
        toast.success(`Cleanup done — ${res.data.results.deleted} event(s) deleted`);
        loadDashboard();
      } else {
        toast.success('Cleanup done — no events needed deleting');
      }
    } catch {
      toast.error('Cleanup failed');
      setCleanupResult({ success: false, message: 'Cleanup failed — check server logs.' });
    } finally {
      setCleanupRunning(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    try {
      const res = await adminAPI.search(searchQuery);
      // Show search results in a modal or new view
      console.log('Search results:', res.data);
      toast.success(`Found ${res.data.results.events.length} events`);
    } catch { toast.error('Search failed'); }
  };

  const handleBulkExport = async () => {
    try {
      const res = await adminAPI.exportData('events');
      const json = JSON.stringify(res.data.data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `planit-events-export-${Date.now()}.json`;
      a.click();
      toast.success('Exported all events');
    } catch { toast.error('Export failed'); }
  };

  if (loading) return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
      <div className="spinner w-8 h-8 border-4 border-neutral-300 border-t-neutral-600" />
    </div>
  );

  if (!isAuthenticated) return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-900 to-neutral-800 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="card p-8 shadow-2xl">
          <div className="flex items-center justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
              <Shield className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 text-center mb-2">Super Admin</h1>
          <p className="text-sm text-neutral-500 text-center mb-6">PlanIt Master Control Panel</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Username</label>
              <input type="text" required className="input" placeholder="admin"
                value={loginForm.username} 
                onChange={e => setLoginForm({ ...loginForm, username: e.target.value })}
                autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Password</label>
              <input type="password" required className="input" placeholder="••••••••"
                value={loginForm.password} 
                onChange={e => setLoginForm({ ...loginForm, password: e.target.value })} />
            </div>
            <button type="submit" disabled={loggingIn} className="btn btn-primary w-full py-3 shadow-lg">
              {loggingIn ? (
                <><span className="spinner w-4 h-4 border-2 border-white/30 border-t-white" /> Authenticating...</>
              ) : (
                <><Shield className="w-4 h-4" /> Login</>
              )}
            </button>
          </form>
          <div className="mt-6 pt-6 border-t border-neutral-200 text-center">
            <a href="/" className="text-xs text-neutral-400 hover:text-neutral-600">← Back to home</a>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Enhanced Header */}
      <header className="bg-gradient-to-r from-neutral-900 to-neutral-800 border-b border-neutral-700 sticky top-0 z-50 shadow-lg">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {selectedEvent && (
              <button onClick={() => setSelectedEvent(null)} className="text-white/80 hover:text-white">
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold text-white">
                  {selectedEvent ? selectedEvent.title : 'Super Admin Panel'}
                </h1>
                <p className="text-xs text-neutral-400">
                  {selectedEvent ? `Event Management` : 'Master Control'}
                </p>
              </div>
            </div>
          </div>
          
          {!selectedEvent && (
            <form onSubmit={handleSearch} className="flex-1 max-w-md mx-6">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search events, messages, users..."
                  className="w-full pl-10 pr-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            </form>
          )}

          <div className="flex items-center gap-3">
            {!selectedEvent && (
              <>
                <button
                  onClick={() => setUptimeView(v => !v)}
                  className={`btn gap-2 text-sm ${uptimeView ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-neutral-800 hover:bg-neutral-700 text-white border-neutral-700'}`}
                  title="Uptime & Incidents"
                >
                  <Radio className="w-4 h-4" /> Uptime
                </button>
                <button onClick={handleBulkExport} className="btn bg-neutral-800 hover:bg-neutral-700 text-white border-neutral-700 gap-2 text-sm">
                  <Download className="w-4 h-4" /> Export All
                </button>
                <button
                  onClick={() => { setCleanupResult(null); setShowCleanupModal(true); }}
                  className="btn bg-red-900 hover:bg-red-800 text-white border-red-700 gap-2 text-sm"
                  title="Manually run the 7-day event cleanup job"
                >
                  <Trash className="w-4 h-4" /> Run Cleanup
                </button>
              </>
            )}
            <button onClick={handleLogout} className="btn bg-neutral-800 hover:bg-neutral-700 text-white border-neutral-700 gap-2 text-sm">
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {selectedEvent ? (
          <EventDetail 
            event={selectedEvent} 
            onBack={() => setSelectedEvent(null)} 
            onDelete={handleDeleteEvent}
            onUpdate={loadDashboard}
          />
        ) : uptimeView ? (
          <UptimePanel />
        ) : (
          <>
            {/* Enhanced Stats Grid */}
            {stats && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {[
                  { 
                    label: 'Total Events', 
                    value: stats.totalEvents, 
                    sub: `${stats.activeEvents} active`,
                    icon: Calendar,
                    color: 'blue'
                  },
                  { 
                    label: 'Participants', 
                    value: stats.totalParticipants, 
                    sub: `avg ${stats.averageParticipantsPerEvent}/event`,
                    icon: Users,
                    color: 'emerald'
                  },
                  { 
                    label: 'Messages', 
                    value: stats.totalMessages, 
                    sub: `${stats.totalPolls} polls`,
                    icon: Activity,
                    color: 'violet'
                  },
                  { 
                    label: 'Last 24h', 
                    value: stats.recentEvents, 
                    sub: 'new events',
                    icon: TrendingUp,
                    color: 'amber'
                  },
                  {
                    label: 'Total Files',
                    value: stats.totalFiles,
                    sub: formatFileSize(stats.totalStorage || 0),
                    icon: HardDrive,
                    color: 'rose'
                  },
                  {
                    label: 'Storage',
                    value: formatFileSize(stats.totalStorage || 0),
                    sub: `${stats.totalFiles} files`,
                    icon: Database,
                    color: 'cyan'
                  },
                ].map(({ label, value, sub, icon: Icon, color }) => (
                  <div key={label} className="card p-5 hover:shadow-lg transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">{label}</p>
                      <div className={`w-8 h-8 rounded-lg bg-${color}-100 flex items-center justify-center`}>
                        <Icon className={`w-4 h-4 text-${color}-600`} />
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-neutral-900 mb-1">{typeof value === 'number' ? formatNumber(value) : value}</p>
                    <p className="text-xs text-neutral-500">{sub}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Events Table */}
            <div className="card shadow-lg">
              <div className="p-5 border-b border-neutral-200 flex items-center justify-between gap-4 flex-wrap">
                <h2 className="text-base font-semibold text-neutral-900">
                  All Events <span className="text-sm font-normal text-neutral-400">(click to manage)</span>
                </h2>
                <div className="flex items-center gap-3">
                  <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                    className="input py-2 text-sm">
                    <option value="all">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="draft">Draft</option>
                  </select>
                  <button onClick={loadDashboard} className="btn btn-ghost p-2" title="Refresh">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-neutral-50 border-b border-neutral-200">
                    <tr>
                      {['Event', 'Organizer', 'Date', 'Participants', 'Mode', 'Status', ''].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-neutral-600 uppercase tracking-wider">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-neutral-100">
                    {events.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="px-5 py-16 text-center">
                          <Activity className="w-12 h-12 mx-auto text-neutral-300 mb-3" />
                          <p className="text-sm text-neutral-400">No events found</p>
                        </td>
                      </tr>
                    ) : events.map(event => (
                      <tr key={event._id} className="hover:bg-neutral-50 cursor-pointer transition-colors" 
                        onClick={() => setSelectedEvent(event)}>
                        <td className="px-5 py-4">
                          <p className="text-sm font-medium text-neutral-900">{event.title}</p>
                          <p className="text-xs text-neutral-400 font-mono">/{event.subdomain}</p>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-sm text-neutral-900">{event.organizerName}</p>
                          <p className="text-xs text-neutral-400">{event.organizerEmail}</p>
                        </td>
                        <td className="px-5 py-4 text-sm text-neutral-600">
                          {event.date ? formatAdminDate(event.date) : 'No date set'}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-neutral-400" />
                            <span className="text-sm font-medium text-neutral-900">
                              {event.participants?.length || 0}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          {event.isEnterpriseMode ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                              <Zap className="w-3 h-3" /> Enterprise
                            </span>
                          ) : (
                            <span className="text-xs text-neutral-400">Standard</span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <StatusBadge status={event.status} />
                        </td>
                        <td className="px-5 py-4 text-right">
                          <ChevronRight className="w-5 h-5 text-neutral-400 ml-auto" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="px-5 py-4 border-t border-neutral-100 flex items-center justify-between bg-neutral-50">
                  <p className="text-sm text-neutral-600">
                    Page {currentPage} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                      disabled={currentPage === 1}
                      className="btn btn-secondary text-sm py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Previous
                    </button>
                    <button 
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                      disabled={currentPage === totalPages}
                      className="btn btn-secondary text-sm py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* Manual Cleanup Modal */}
      {showCleanupModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                <Trash className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Manual Cleanup</h2>
                <p className="text-xs text-red-200">Delete events older than 7 days</p>
              </div>
              <button onClick={() => setShowCleanupModal(false)} className="ml-auto text-white/70 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6">
              {!cleanupResult ? (
                <>
                  <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl mb-6">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-amber-800">
                      <p className="font-semibold mb-1">This will permanently delete:</p>
                      <p>All events (including cancelled) whose date was <strong>7+ days ago</strong>, along with all their messages, files, polls, participants, and invites.</p>
                      <p className="mt-2 text-xs text-amber-600">This is the same job that runs automatically at 2 AM — it cannot be undone.</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setShowCleanupModal(false)}
                      className="btn btn-secondary flex-1"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleManualCleanup}
                      disabled={cleanupRunning}
                      className="btn flex-1 bg-red-600 hover:bg-red-700 text-white gap-2 disabled:opacity-60"
                    >
                      {cleanupRunning ? (
                        <><span className="spinner w-4 h-4 border-2 border-white/30 border-t-white" /> Running...</>
                      ) : (
                        <><Trash className="w-4 h-4" /> Yes, Run Cleanup</>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className={`flex items-start gap-3 p-4 rounded-xl mb-4 ${
                    cleanupResult.success ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'
                  }`}>
                    {cleanupResult.success
                      ? <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      : <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    }
                    <div className={`text-sm ${cleanupResult.success ? 'text-emerald-800' : 'text-red-800'}`}>
                      <p className="font-semibold mb-1">{cleanupResult.success ? 'Cleanup complete!' : 'Cleanup failed'}</p>
                      {cleanupResult.results && (
                        <div className="space-y-0.5">
                          <p>✓ Deleted: <strong>{cleanupResult.results.deleted}</strong> event{cleanupResult.results.deleted !== 1 ? 's' : ''}</p>
                          {cleanupResult.results.failed > 0 && (
                            <p>✗ Failed: <strong>{cleanupResult.results.failed}</strong></p>
                          )}
                          {cleanupResult.results.total === 0 && (
                            <p className="text-emerald-600">No events were old enough to delete.</p>
                          )}
                        </div>
                      )}
                      {!cleanupResult.results && <p>{cleanupResult.message}</p>}
                    </div>
                  </div>

                  {cleanupResult.logs && cleanupResult.logs.length > 0 && (
                    <div className="bg-neutral-900 rounded-xl p-4 mb-4 max-h-48 overflow-y-auto">
                      {cleanupResult.logs.map((log, i) => (
                        <p key={i} className={`text-xs font-mono leading-relaxed ${
                          log.includes('✓') ? 'text-emerald-400' :
                          log.includes('✗') || log.includes('Failed') ? 'text-red-400' :
                          'text-neutral-300'
                        }`}>{log}</p>
                      ))}
                    </div>
                  )}

                  <button
                    onClick={() => setShowCleanupModal(false)}
                    className="btn btn-secondary w-full"
                  >
                    Close
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}