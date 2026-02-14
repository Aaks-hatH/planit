import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, Users, Activity, TrendingUp,
  Trash2, Eye, LogOut, Lock, ArrowLeft,
  MessageSquare, BarChart3, UserX, ChevronRight,
  RefreshCw, ShieldOff
} from 'lucide-react';
import { adminAPI } from '../services/api';
import { formatDate, formatNumber, formatRelativeTime } from '../utils/formatters';
import toast from 'react-hot-toast';

const StatusBadge = ({ status }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
    status === 'active'    ? 'bg-emerald-100 text-emerald-800' :
    status === 'completed' ? 'bg-blue-100 text-blue-800'      :
    status === 'cancelled' ? 'bg-red-100 text-red-800'        :
                             'bg-neutral-100 text-neutral-800'
  }`}>{status}</span>
);

function EventDetail({ event, onBack, onDelete }) {
  const [tab, setTab] = useState('messages');
  const [messages, setMessages] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAll(); }, [event._id]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [msgRes, partRes, pollRes] = await Promise.all([
        adminAPI.getMessages(event._id),
        adminAPI.getParticipants(event._id),
        adminAPI.getPolls(event._id),
      ]);
      setMessages(msgRes.data.messages || []);
      setParticipants(partRes.data.participants || []);
      setPolls(pollRes.data.polls || []);
    } catch { toast.error('Failed to load event data'); }
    finally { setLoading(false); }
  };

  const handleDeleteMessage = async (msgId) => {
    if (!confirm('Delete this message?')) return;
    try {
      await adminAPI.deleteMessage(event._id, msgId);
      setMessages(prev => prev.filter(m => m._id !== msgId));
      toast.success('Message deleted');
    } catch { toast.error('Failed'); }
  };

  const handleRemoveParticipant = async (username) => {
    if (!confirm(`Remove ${username} from this event?`)) return;
    try {
      await adminAPI.removeParticipant(event._id, username);
      setParticipants(prev => prev.filter(p => p.username !== username));
      toast.success('Participant removed');
    } catch { toast.error('Failed'); }
  };

  const handleResetPassword = async (username) => {
    if (!confirm(`Reset account password for ${username}?`)) return;
    try {
      await adminAPI.resetParticipantPassword(event._id, username);
      setParticipants(prev => prev.map(p => p.username === username ? { ...p, hasPassword: false } : p));
      toast.success('Password reset');
    } catch { toast.error('Failed'); }
  };

  const tabs = [
    { id: 'messages',     label: 'Chat',        icon: MessageSquare, count: messages.length },
    { id: 'participants', label: 'Participants', icon: Users,         count: participants.length },
    { id: 'polls',        label: 'Polls',        icon: BarChart3,     count: polls.length },
  ];

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="btn btn-ghost p-1.5"><ArrowLeft className="w-4 h-4" /></button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-neutral-900 truncate">{event.title}</h2>
          <p className="text-xs text-neutral-500">/{event.subdomain} · {event.organizerEmail}</p>
        </div>
        <StatusBadge status={event.status} />
        <a href={`/e/${event.subdomain}`} target="_blank" rel="noopener noreferrer"
          className="btn btn-secondary gap-1.5 text-sm"><Eye className="w-3.5 h-3.5" /> Open</a>
        <button onClick={() => onDelete(event._id)}
          className="btn btn-secondary gap-1.5 text-sm text-red-600 hover:bg-red-50">
          <Trash2 className="w-3.5 h-3.5" /> Delete
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Messages',     value: messages.length,     icon: MessageSquare },
          { label: 'Participants', value: participants.length,  icon: Users },
          { label: 'Polls',        value: polls.length,         icon: BarChart3 },
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

      <div className="card overflow-hidden">
        <div className="flex border-b border-neutral-200">
          {tabs.map(({ id, label, icon: Icon, count }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors ${
                tab === id ? 'border-b-2 border-neutral-900 text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'
              }`}>
              <Icon className="w-4 h-4" />{label}
              <span className="text-xs bg-neutral-100 text-neutral-600 rounded-full px-1.5 py-0.5">{count}</span>
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
          <>
            {tab === 'messages' && (
              <div className="divide-y divide-neutral-100 max-h-[500px] overflow-y-auto">
                {messages.length === 0 ? (
                  <p className="text-sm text-neutral-400 text-center py-12">No messages</p>
                ) : messages.map(msg => (
                  <div key={msg._id} className="flex items-start gap-3 px-5 py-3 hover:bg-neutral-50 group">
                    <div className="w-7 h-7 rounded-full bg-neutral-200 flex items-center justify-center text-xs font-bold text-neutral-600 flex-shrink-0 mt-0.5">
                      {msg.username?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs font-semibold text-neutral-900">{msg.username}</span>
                        <span className="text-xs text-neutral-400">{formatRelativeTime(new Date(msg.createdAt))}</span>
                      </div>
                      <p className="text-sm text-neutral-700 mt-0.5 break-words">{msg.content}</p>
                    </div>
                    <button onClick={() => handleDeleteMessage(msg._id)}
                      className="opacity-0 group-hover:opacity-100 btn btn-ghost p-1 text-red-400 hover:text-red-600 flex-shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {tab === 'participants' && (
              <div className="divide-y divide-neutral-100">
                {participants.length === 0 ? (
                  <p className="text-sm text-neutral-400 text-center py-12">No participants</p>
                ) : participants.map(p => (
                  <div key={p.username} className="flex items-center gap-3 px-5 py-3 hover:bg-neutral-50">
                    <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center text-xs font-bold text-neutral-600">
                      {p.username?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-neutral-900">{p.username}</span>
                        {p.role === 'organizer' && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">organizer</span>
                        )}
                        {p.hasPassword && (
                          <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5" /> has password
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-400">
                        Joined {formatRelativeTime(new Date(p.joinedAt))} · Last seen {formatRelativeTime(new Date(p.lastSeenAt))}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {p.hasPassword && (
                        <button onClick={() => handleResetPassword(p.username)}
                          className="btn btn-ghost p-1.5 text-neutral-400 hover:text-amber-600" title="Reset account password">
                          <ShieldOff className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {p.role !== 'organizer' && (
                        <button onClick={() => handleRemoveParticipant(p.username)}
                          className="btn btn-ghost p-1.5 text-neutral-400 hover:text-red-500" title="Remove participant">
                          <UserX className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === 'polls' && (
              <div className="divide-y divide-neutral-100">
                {polls.length === 0 ? (
                  <p className="text-sm text-neutral-400 text-center py-12">No polls</p>
                ) : polls.map(poll => (
                  <div key={poll._id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <p className="text-sm font-medium text-neutral-900">{poll.question}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${poll.isOpen ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}`}>
                        {poll.isOpen ? 'open' : 'closed'}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {poll.options?.map((opt, i) => {
                        const votes = opt.votes?.length || 0;
                        const total = poll.options.reduce((s, o) => s + (o.votes?.length || 0), 0);
                        const pct = total > 0 ? Math.round((votes / total) * 100) : 0;
                        return (
                          <div key={i} className="flex items-center gap-2">
                            <div className="flex-1 bg-neutral-100 rounded-full h-5 overflow-hidden">
                              <div className="bg-neutral-700 h-full rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs text-neutral-600 w-28 truncate">{opt.text}</span>
                            <span className="text-xs text-neutral-400 w-16 text-right">{votes} ({pct}%)</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loggingIn, setLoggingIn] = useState(false);

  const [stats, setStats] = useState(null);
  const [events, setEvents] = useState([]);
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const ITEMS_PER_PAGE = 15;

  useEffect(() => { checkAuth(); }, []);
  useEffect(() => { if (isAuthenticated) loadDashboard(); }, [isAuthenticated, currentPage, statusFilter]);

  const checkAuth = async () => {
    const token = localStorage.getItem('adminToken');
    if (!token) { setLoading(false); return; }
    try { await adminAPI.getStats(); setIsAuthenticated(true); }
    catch { localStorage.removeItem('adminToken'); }
    finally { setLoading(false); }
  };

  const handleLogin = async (e) => {
    e.preventDefault(); setLoggingIn(true);
    try {
      const res = await adminAPI.login(loginForm);
      localStorage.setItem('adminToken', res.data.token);
      setIsAuthenticated(true);
      toast.success('Logged in');
    } catch (err) { toast.error(err.response?.data?.error || 'Invalid credentials'); }
    finally { setLoggingIn(false); }
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
        adminAPI.getEvents({ page: currentPage, limit: ITEMS_PER_PAGE, status: statusFilter !== 'all' ? statusFilter : undefined }),
      ]);
      setStats(statsRes.data);
      setEvents(eventsRes.data.events || []);
      setTotalPages(eventsRes.data.pagination?.pages || 1);
    } catch (err) {
      if (err.response?.status === 401) { localStorage.removeItem('adminToken'); setIsAuthenticated(false); }
      else toast.error('Failed to load dashboard');
    }
  };

  const handleDeleteEvent = async (eventId) => {
    if (!confirm('Delete this event and ALL its data permanently?')) return;
    try {
      await adminAPI.deleteEvent(eventId);
      toast.success('Event deleted');
      setSelectedEvent(null);
      loadDashboard();
    } catch { toast.error('Failed to delete'); }
  };

  if (loading) return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
      <div className="spinner w-8 h-8 border-4 border-neutral-300 border-t-neutral-600" />
    </div>
  );

  if (!isAuthenticated) return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="card p-8">
          <div className="flex items-center justify-center mb-6">
            <div className="w-12 h-12 rounded-xl bg-neutral-900 flex items-center justify-center">
              <Lock className="w-6 h-6 text-white" />
            </div>
          </div>
          <h1 className="text-xl font-bold text-neutral-900 text-center mb-1">Admin Login</h1>
          <p className="text-sm text-neutral-500 text-center mb-6">PlanIt Management Panel</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Username</label>
              <input type="text" required className="input" placeholder="admin"
                value={loginForm.username} onChange={e => setLoginForm({ ...loginForm, username: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1.5">Password</label>
              <input type="password" required className="input" placeholder="••••••••"
                value={loginForm.password} onChange={e => setLoginForm({ ...loginForm, password: e.target.value })} />
            </div>
            <button type="submit" disabled={loggingIn} className="btn btn-primary w-full py-2.5">
              {loggingIn ? <><span className="spinner w-4 h-4 border-2 border-white/30 border-t-white" /> Logging in...</> : 'Login'}
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
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {selectedEvent && (
              <button onClick={() => setSelectedEvent(null)} className="btn btn-ghost p-1.5 -ml-1.5">
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="w-7 h-7 rounded-lg bg-neutral-900 flex items-center justify-center">
              <Lock className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-base font-bold text-neutral-900">
              {selectedEvent ? selectedEvent.title : 'Admin Panel'}
            </h1>
          </div>
          <button onClick={handleLogout} className="btn btn-secondary gap-2 text-sm">
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {selectedEvent ? (
          <EventDetail event={selectedEvent} onBack={() => setSelectedEvent(null)} onDelete={handleDeleteEvent} />
        ) : (
          <>
            {stats && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {[
                  { label: 'Total Events',  value: stats.totalEvents,       sub: `${stats.activeEvents} active`,                icon: Calendar },
                  { label: 'Participants',  value: stats.totalParticipants, sub: `avg ${stats.averageParticipantsPerEvent}/event`, icon: Users },
                  { label: 'Messages',      value: stats.totalMessages,     sub: `${stats.totalPolls} polls`,                    icon: Activity },
                  { label: 'Last 24h',      value: stats.recentEvents,      sub: 'new events',                                   icon: TrendingUp },
                ].map(({ label, value, sub, icon: Icon }) => (
                  <div key={label} className="card p-5">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium text-neutral-500">{label}</p>
                      <Icon className="w-4 h-4 text-neutral-300" />
                    </div>
                    <p className="text-2xl font-bold text-neutral-900">{formatNumber(value)}</p>
                    <p className="text-xs text-neutral-400 mt-0.5">{sub}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="card">
              <div className="p-5 border-b border-neutral-200 flex items-center justify-between gap-4">
                <h2 className="text-base font-semibold text-neutral-900">Events <span className="text-sm font-normal text-neutral-400">(click to drill in)</span></h2>
                <div className="flex items-center gap-2">
                  <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                    className="input py-1.5 text-sm">
                    <option value="all">All</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  <button onClick={loadDashboard} className="btn btn-ghost p-1.5"><RefreshCw className="w-4 h-4" /></button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-neutral-50">
                    <tr>
                      {['Event', 'Organizer', 'Date', 'Participants', 'Status', ''].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-neutral-100">
                    {events.length === 0 ? (
                      <tr><td colSpan="6" className="px-5 py-12 text-center text-sm text-neutral-400">No events found</td></tr>
                    ) : events.map(event => (
                      <tr key={event._id} className="hover:bg-neutral-50 cursor-pointer" onClick={() => setSelectedEvent(event)}>
                        <td className="px-5 py-3">
                          <p className="text-sm font-medium text-neutral-900">{event.title}</p>
                          <p className="text-xs text-neutral-400">/{event.subdomain}</p>
                        </td>
                        <td className="px-5 py-3">
                          <p className="text-sm text-neutral-900">{event.organizerName}</p>
                          <p className="text-xs text-neutral-400">{event.organizerEmail}</p>
                        </td>
                        <td className="px-5 py-3 text-sm text-neutral-600">{formatDate(event.date)}</td>
                        <td className="px-5 py-3 text-sm text-neutral-600">{event.participants?.length || 0}</td>
                        <td className="px-5 py-3"><StatusBadge status={event.status} /></td>
                        <td className="px-5 py-3 text-right"><ChevronRight className="w-4 h-4 text-neutral-300 ml-auto" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="px-5 py-3 border-t border-neutral-100 flex items-center justify-between">
                  <p className="text-xs text-neutral-500">Page {currentPage} of {totalPages}</p>
                  <div className="flex gap-2">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                      className="btn btn-secondary text-sm py-1.5">Prev</button>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                      className="btn btn-secondary text-sm py-1.5">Next</button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
