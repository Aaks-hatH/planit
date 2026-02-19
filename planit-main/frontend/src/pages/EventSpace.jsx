import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Calendar, Users, MessageSquare, BarChart3, FileText,
  Send, Paperclip, X, Download, Trash2, Plus,
  LogOut, ArrowLeft, Copy, Check, Lock, MapPin,
  ChevronRight, Clock, QrCode, CalendarDays,
  Smile, ThumbsUp, Heart, Laugh,
  CheckCircle2, Megaphone, DollarSign, StickyNote, Share2, UserCheck
} from 'lucide-react';
import { eventAPI, chatAPI, pollAPI, fileAPI } from '../services/api';
import socketService from '../services/socket';
import { formatDate, formatRelativeTime, formatFileSize } from '../utils/formatters';
import { MAX_MESSAGE_LENGTH, MAX_FILE_SIZE, ALLOWED_FILE_TYPES } from '../utils/constants';
import toast from 'react-hot-toast';

// NEW COMPONENTS
import Tasks from '../components/Tasks';
import Announcements from '../components/Announcements';
import Expenses from '../components/Expenses';
import Notes from '../components/Notes';
import Analytics from '../components/Analytics';
import Utilities from '../components/Utilities';
import Countdown from '../components/Countdown';
import DeletionWarningBanner from '../components/DeletionWarningBanner';

/* ─── QR Modal ───────────────────────────────────────────────────────────── */
function QRModal({ url, onClose }) {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(url)}`;
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-80 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-neutral-900">QR Code</h3>
          <button onClick={onClose} className="btn btn-ghost p-1"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex justify-center mb-4">
          <img src={qrUrl} alt="QR Code" className="w-60 h-60 border border-neutral-200 rounded-lg" />
        </div>
        <p className="text-xs text-neutral-400 text-center">Scan to join this event</p>
      </div>
    </div>
  );
}

/* ─── Join Gate ──────────────────────────────────────────────────────────── */
function JoinGate({ eventId, onJoined }) {
  const [publicInfo, setPublicInfo] = useState(null);
  const [knownParticipants, setKnownParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [username, setUsername] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [password, setPassword] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [needsAccountPassword, setNeedsAccountPassword] = useState(false);
  const [selectedHasPassword, setSelectedHasPassword] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!eventId) return;
    Promise.all([
      eventAPI.getPublicInfo(eventId),
      eventAPI.getParticipants(eventId),
    ])
      .then(([infoRes, partRes]) => {
        setPublicInfo(infoRes.data.event);
        setKnownParticipants(partRes.data.participants || []);
      })
      .catch(() => navigate('/'))
      .finally(() => setLoading(false));
  }, [eventId]);

  const filteredParticipants = knownParticipants.filter(p =>
    username.trim() === '' || p.username.toLowerCase().includes(username.toLowerCase())
  );

  const handleSelectName = (p) => {
    setUsername(p.username);
    setSelectedHasPassword(p.hasPassword);
    setNeedsAccountPassword(p.hasPassword);
    setShowDropdown(false);
    setError('');
  };

  const handleUsernameChange = (e) => {
    const newUsername = e.target.value;
    setUsername(newUsername);
    
    const existingUser = knownParticipants.find(p => p.username.toLowerCase() === newUsername.trim().toLowerCase());
    setNeedsAccountPassword(existingUser?.hasPassword || false);
    setSelectedHasPassword(existingUser?.hasPassword || false);
    setAccountPassword('');
    setShowDropdown(true);
    setError('');
  };

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!username.trim()) { setError('Please enter your name'); return; }
    setJoining(true); setError('');
    try {
      const payload = { username: username.trim(), accountPassword: accountPassword || undefined };
      if (publicInfo.isPasswordProtected) payload.password = password;

      const res = publicInfo.isPasswordProtected
        ? await eventAPI.verifyPassword(eventId, payload)
        : await eventAPI.join(eventId, payload);

      localStorage.setItem('eventToken', res.data.token);
      localStorage.setItem('username', username.trim());
      onJoined();
    } catch (err) {
      const data = err.response?.data;
      if (data?.requiresAccountPassword) {
        setNeedsAccountPassword(true);
        setError('This name has an account — enter your account password below.');
      } else {
        setError(data?.error || 'Failed to join');
      }
    } finally {
      setJoining(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <span className="spinner w-5 h-5 border-2 border-neutral-200 border-t-neutral-500" />
    </div>
  );
  if (!publicInfo) return null;

  const { yes = 0, maybe = 0, no: noCount = 0 } = publicInfo.rsvpSummary || {};

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      <header className="bg-white border-b border-neutral-100">
        <div className="max-w-lg mx-auto px-6 h-14 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-neutral-900 flex items-center justify-center">
            <Calendar className="w-4 h-4 text-white" />
          </div>
          <span className="logo-text">PlanIt</span>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="card p-8 animate-fade-in">
            <div className="mb-6 pb-6 border-b border-neutral-100">
              <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-2">Event</p>
              <h1 className="text-2xl font-semibold text-neutral-900 mb-3 tracking-tight">{publicInfo.title}</h1>
              <div className="flex flex-col gap-1.5">
                {publicInfo.date && (
                  <div className="flex items-center gap-2 text-sm text-neutral-500">
                    <Calendar className="w-3.5 h-3.5" /><span>{formatDate(publicInfo.date)}</span>
                  </div>
                )}
                {publicInfo.location && (
                  <div className="flex items-center gap-2 text-sm text-neutral-500">
                    <MapPin className="w-3.5 h-3.5" /><span>{publicInfo.location}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-neutral-500">
                  <Users className="w-3.5 h-3.5" /><span>Organized by {publicInfo.organizerName}</span>
                </div>
              </div>
              {(yes + maybe + noCount) > 0 && (
                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-neutral-100">
                  <span className="text-xs text-emerald-600 font-medium">{yes} going</span>
                  <span className="text-xs text-amber-600 font-medium">{maybe} maybe</span>
                  <span className="text-xs text-neutral-400 font-medium">{noCount} not going</span>
                </div>
              )}
              {publicInfo.isPasswordProtected && (
                <div className="flex items-center gap-2 mt-3 px-3 py-2 bg-amber-50 rounded-lg border border-amber-200">
                  <Lock className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                  <span className="text-xs text-amber-700 font-medium">This event requires a password</span>
                </div>
              )}
            </div>

            <>
              <h2 className="text-base font-semibold text-neutral-900 mb-4">Join this event</h2>
                <form onSubmit={handleJoin} className="space-y-4">
                  {/* Name field with dropdown */}
                  <div className="relative">
                    <label className="block text-sm font-medium text-neutral-700 mb-1.5">Your name</label>
                    <input
                      type="text" required className="input" placeholder="Enter your name or select below"
                      value={username}
                      onChange={handleUsernameChange}
                      onFocus={() => setShowDropdown(true)}
                      onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                      autoComplete="off"
                    />
                    {showDropdown && filteredParticipants.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg overflow-hidden">
                        <p className="text-xs text-neutral-400 px-3 pt-2 pb-1">Previously joined</p>
                        {filteredParticipants.map(p => (
                          <button
                            key={p.username} type="button"
                            className="w-full flex items-center justify-between px-3 py-2 hover:bg-neutral-50 text-left"
                            onMouseDown={() => handleSelectName(p)}
                          >
                            <span className="text-sm text-neutral-900">{p.username}</span>
                            {p.hasPassword
                              ? <span className="text-xs text-neutral-400 flex items-center gap-1"><Lock className="w-3 h-3" />has password</span>
                              : <span className="text-xs text-neutral-400">no password</span>
                            }
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {(needsAccountPassword || selectedHasPassword || (username.trim() && !knownParticipants.find(p => p.username.toLowerCase() === username.trim().toLowerCase()))) && (
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1.5">
                        Account password {(needsAccountPassword || selectedHasPassword) ? 
                          <span className="text-xs font-normal text-neutral-400">(for {username})</span> :
                          <span className="text-xs font-normal text-neutral-400">(optional, protects your name)</span>
                        }
                      </label>
                      <input 
                        type="password" 
                        className="input" 
                        placeholder={(needsAccountPassword || selectedHasPassword) ? "Your account password" : "Create a password (min 4 characters)"}
                        value={accountPassword} 
                        onChange={e => setAccountPassword(e.target.value)}
                        minLength={4}
                      />
                      {!(needsAccountPassword || selectedHasPassword) && (
                        <p className="text-xs text-neutral-400 mt-1">This password is only for this event and protects your username</p>
                      )}
                    </div>
                  )}

                  {/* Event password */}
                  {publicInfo.isPasswordProtected && (
                    <div>
                      <label className="block text-sm font-medium text-neutral-700 mb-1.5">Event password</label>
                      <input type="password" required className="input" placeholder="Event password"
                        value={password} onChange={e => setPassword(e.target.value)} />
                    </div>
                  )}

                  {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

                  <button type="submit" disabled={joining} className="btn btn-primary w-full py-2.5">
                    {joining ? <><span className="spinner w-4 h-4 border-2 border-white/30 border-t-white" />Joining...</>
                      : <>Join event<ChevronRight className="w-4 h-4" /></>}
                  </button>
                </form>
              </>
          </div>
          <div className="mt-6 pt-4 border-t border-neutral-100">
            <div className="text-center space-y-3">
              {/* Organizer Login Button - matching the style from the organizer sidebar */}
              <button
                onClick={() => navigate(`/event/${eventId}/login`)}
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 text-sm bg-neutral-900 hover:bg-neutral-700 text-white rounded-lg transition-colors font-medium"
              >
                <Lock className="w-4 h-4" />
                <span>Login as Organizer</span>
              </button>
              <p className="text-xs text-neutral-400">
                Are you the event organizer? Log in to access organizer tools
              </p>
              <p className="text-sm text-neutral-400 pt-2">
                <a href="/" className="hover:text-neutral-600 transition-colors">← Back to home</a>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

/* ─── Avatar ──────────────────────────────────────────────────────────────── */
function Avatar({ name, size = 'sm' }) {
  const colors = ['bg-blue-100 text-blue-700','bg-violet-100 text-violet-700','bg-emerald-100 text-emerald-700','bg-orange-100 text-orange-700','bg-rose-100 text-rose-700','bg-teal-100 text-teal-700'];
  const color = colors[(name?.charCodeAt(0) || 0) % colors.length];
  const sizes = { sm: 'w-7 h-7 text-xs', md: 'w-9 h-9 text-sm', lg: 'w-11 h-11 text-base' };
  return (
    <div className={`${sizes[size]} ${color} rounded-full flex items-center justify-center font-semibold flex-shrink-0`}>
      {name?.charAt(0).toUpperCase() || '?'}
    </div>
  );
}

/* ─── Reaction Bar ────────────────────────────────────────────────────────── */
const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '👏'];
function ReactionBar({ messageId, reactions = [], currentUser, eventId }) {
  const [open, setOpen] = useState(false);
  const grouped = REACTION_EMOJIS.reduce((acc, e) => {
    const count = reactions.filter(r => r.emoji === e).length;
    if (count > 0) acc.push({ emoji: e, count, mine: reactions.some(r => r.emoji === e && r.username === currentUser) });
    return acc;
  }, []);

  const toggle = (emoji) => {
    const mine = reactions.some(r => r.emoji === emoji && r.username === currentUser);
    if (mine) {
      socketService.removeReaction(eventId, messageId, emoji);
    } else {
      socketService.addReaction(eventId, messageId, emoji);
    }
    setOpen(false);
  };

  return (
    <div className="flex items-center gap-1 mt-1 flex-wrap">
      {grouped.map(({ emoji, count, mine }) => (
        <button key={emoji} onClick={() => toggle(emoji)}
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border transition-colors ${
            mine ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white border-neutral-200 text-neutral-700 hover:border-neutral-400'
          }`}>
          <span>{emoji}</span><span>{count}</span>
        </button>
      ))}
      <div className="relative">
        <button onClick={() => setOpen(o => !o)}
          className="flex items-center px-1.5 py-0.5 rounded-full text-xs border border-neutral-200 bg-white text-neutral-400 hover:text-neutral-700 hover:border-neutral-400 transition-colors">
          <Smile className="w-3 h-3" />
        </button>
        {open && (
          <div className="absolute bottom-6 left-0 flex gap-1 bg-white border border-neutral-200 rounded-xl p-2 shadow-lg z-20">
            {REACTION_EMOJIS.map(e => (
              <button key={e} onClick={() => toggle(e)}
                className="text-lg hover:scale-125 transition-transform px-1">
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main EventSpace ─────────────────────────────────────────────────────── */
export default function EventSpace() {
  const { eventId: paramEventId, subdomain } = useParams();
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // ── FIX: Resolve subdomain to eventId ──
  const [eventId, setEventId] = useState(paramEventId || null);
  const [resolving, setResolving] = useState(!paramEventId && subdomain);

  const [needsJoin, setNeedsJoin] = useState(false);
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('chat');
  const [countdown, setCountdown] = useState(null);

  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);

  const [polls, setPolls] = useState([]);
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [newPoll, setNewPoll] = useState({ question: '', options: ['', ''] });

  const [files, setFiles] = useState([]);
  const [uploadingFile, setUploadingFile] = useState(false);

  const [participants, setParticipants] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [rsvps, setRsvps] = useState([]);
  const [rsvpSummary, setRsvpSummary] = useState({ yes: 0, maybe: 0, no: 0 });

  // Agenda
  const [agenda, setAgenda] = useState([]);
  const [showAddAgenda, setShowAddAgenda] = useState(false);
  const [newAgendaItem, setNewAgendaItem] = useState({ title: '', time: '', description: '', duration: '' });

  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const currentUser = localStorage.getItem('username');
  const isOrganizer = event?.organizerName === currentUser;
  const myRsvp = rsvps.find(r => r.username === currentUser)?.status || null;

  useEffect(() => {
    if (event) {
      console.log('=== ORGANIZER DEBUG ===');
      console.log('Current User:', currentUser);
      console.log('Organizer Name:', event.organizerName);
      console.log('Is Organizer:', isOrganizer);
      console.log('Is Enterprise:', event.isEnterpriseMode);
      console.log('Event Data:', event);
    }
  }, [event, currentUser, isOrganizer]);

  // ── FIX: Resolve subdomain to ID if needed ──
  useEffect(() => {
    if (paramEventId) {
      setEventId(paramEventId);
      setResolving(false);
    } else if (subdomain) {
      setResolving(true);
      eventAPI.getBySubdomain(subdomain)
        .then(res => {
          setEventId(res.data.event.id);
          setResolving(false);
        })
        .catch(err => {
          console.error('Failed to resolve subdomain:', err);
          toast.error('Event not found');
          navigate('/');
        });
    } else {
      navigate('/');
    }
  }, [paramEventId, subdomain]);

  useEffect(() => {
    if (!eventId || resolving) return;
    const token = localStorage.getItem('eventToken');
    if (!token) { setNeedsJoin(true); setLoading(false); return; }
    loadEvent();
  }, [eventId, resolving]);

  useEffect(() => {
    if (!event || !eventId) return;
    const token = localStorage.getItem('eventToken');
    if (!token) return;

    socketService.connect(token);
    socketService.joinEvent(eventId);

    socketService.on('new_message', (msg) => { setMessages(prev => [...prev, msg]); scrollToBottom(); });
    socketService.on('message_edited', ({ messageId, content }) => setMessages(prev => prev.map(m => m.id === messageId || m._id === messageId ? { ...m, content, edited: true } : m)));
    socketService.on('message_deleted', ({ messageId }) => setMessages(prev => prev.filter(m => m.id !== messageId && m._id !== messageId)));
    socketService.on('reaction_added', ({ messageId, emoji, username }) => {
      setMessages(prev => prev.map(m => {
        const id = m._id || m.id;
        if (id !== messageId) return m;
        return { ...m, reactions: [...(m.reactions || []), { emoji, username }] };
      }));
    });
    socketService.on('reaction_removed', ({ messageId, emoji, username }) => {
      setMessages(prev => prev.map(m => {
        const id = m._id || m.id;
        if (id !== messageId) return m;
        return { ...m, reactions: (m.reactions || []).filter(r => !(r.emoji === emoji && r.username === username)) };
      }));
    });
    socketService.on('user_typing', ({ username }) => {
      if (username !== currentUser) {
        setTypingUsers(prev => [...new Set([...prev, username])]);
        setTimeout(() => setTypingUsers(prev => prev.filter(u => u !== username)), 3000);
      }
    });
    socketService.on('poll_created', (poll) => setPolls(prev => [poll, ...prev]));
    socketService.on('poll_updated', (updated) => setPolls(prev => prev.map(p => (p._id || p.id) === (updated._id || updated.id) ? updated : p)));
    socketService.on('poll_deleted', ({ pollId }) => setPolls(prev => prev.filter(p => (p._id || p.id) !== pollId)));
    socketService.on('user_joined', ({ username }) => setOnlineUsers(prev => [...new Set([...prev, username])]));
    socketService.on('user_left', ({ username }) => setOnlineUsers(prev => prev.filter(u => u !== username)));
    
    // ── FIX: Listen for new participants joining ──
    socketService.on('participant_joined', ({ participants }) => {
      setParticipants(participants);
    });
    
    // ── FIX: Update RSVP handler to use both rsvps array and summary ──
    socketService.on('rsvp_updated', ({ rsvps, summary }) => {
      if (rsvps) setRsvps(rsvps);
      if (summary) setRsvpSummary(summary);
    });
    
    socketService.on('agenda_updated', ({ agenda }) => setAgenda([...agenda].sort((a, b) => a.order - b.order)));
    socketService.on('files_uploaded', ({ files: newFiles }) => setFiles(prev => [...newFiles, ...prev]));
    socketService.on('file_deleted', ({ fileId }) => setFiles(prev => prev.filter(f => (f._id || f.id) !== fileId)));
    
    // Error handler
    socketService.on('error', (error) => {
      console.error('Socket error:', error);
      if (error.message) {
        toast.error(error.message);
      }
    });

    // Rate limit — message was dropped by the server, show reason to sender only
    socketService.on('rate_limited', ({ message, retryAfterMs }) => {
      toast.error(message, { duration: Math.min(retryAfterMs, 5000) });
      // Restore the message so the user doesn't lose what they typed
      if (socketService._lastSentContent) {
        setMessageInput(socketService._lastSentContent);
        socketService._lastSentContent = null;
      }
    });

    // Rate limit warning — approaching the limit but not yet blocked
    socketService.on('rate_limit_warning', ({ message }) => {
      toast(message, { icon: '⚠️', duration: 3000 });
    });

    return () => { 
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      socketService.leaveEvent(eventId);
      socketService.disconnect();
    };
  }, [event, eventId]);

  // Polling fallback — refreshes messages and polls every 5s when socket is not connected
  useEffect(() => {
    if (!event || !eventId) return;
    const interval = setInterval(() => {
      if (!socketService.isConnected()) {
        chatAPI.getMessages(eventId)
          .then(res => setMessages(res.data.messages || []))
          .catch(() => {});
        pollAPI.getAll(eventId)
          .then(res => setPolls(res.data.polls || []))
          .catch(() => {});
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [event, eventId]);

  // Countdown timer — ticks every second until event starts
  useEffect(() => {
    if (!event?.date) return;
    const tick = () => {
      const diff = new Date(event.date) - new Date();
      if (diff <= 0) { setCountdown(null); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown({ d, h, m, s, diff });
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [event?.date]);

  const loadEvent = async () => {
    try {
      const res = await eventAPI.getById(eventId);
      const ev = res.data.event;
      setEvent(ev);
      setParticipants(ev.participants || []);
      setRsvps(ev.rsvps || []);
      setRsvpSummary(ev.rsvpSummary || { yes: 0, maybe: 0, no: 0 });
      setAgenda(ev.agenda ? [...ev.agenda].sort((a, b) => a.order - b.order) : []);
      await Promise.all([loadMessages(), loadPolls(), loadFiles()]);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.removeItem('eventToken'); localStorage.removeItem('username');
        setNeedsJoin(true);
      } else { toast.error('Failed to load event'); navigate('/'); }
    } finally { setLoading(false); }
  };

  const handleJoined = () => { setNeedsJoin(false); setLoading(true); loadEvent(); };

  const loadMessages = async () => {
    try { const res = await chatAPI.getMessages(eventId); setMessages(res.data.messages || []); scrollToBottom(); } catch {}
  };
  const loadPolls = async () => {
    try { const res = await pollAPI.getAll(eventId); setPolls(res.data.polls || []); } catch {}
  };
  const loadFiles = async () => {
    try { const res = await fileAPI.getAll(eventId); setFiles(res.data.files || []); } catch {}
  };

  const scrollToBottom = () => setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);

  const handleMessageInputChange = (e) => {
    setMessageInput(e.target.value);
    
    // Start typing indicator
    if (socketService.isConnected()) {
      socketService.startTyping(eventId);
      
      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      
      // Stop typing after 2 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        socketService.stopTyping(eventId);
      }, 2000);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageInput.trim() || sendingMessage) return;
    
    const content = messageInput.trim();
    setMessageInput(''); // Clear input immediately for better UX
    setSendingMessage(true);
    
    try {
      // Use socket for real-time messaging
      if (socketService.isConnected()) {
        // Store the content briefly so the rate_limited handler can restore it
        socketService._lastSentContent = content;
        socketService.sendMessage(eventId, content);
      } else {
        // Fallback to HTTP API if socket is disconnected
        await chatAPI.sendMessage(eventId, { content, username: currentUser });
      }
      socketService.stopTyping(eventId);
    } catch (error) {
      toast.error('Failed to send message');
      setMessageInput(content); // Restore message on error
    } finally {
      setSendingMessage(false);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!confirm('Delete this message?')) return;
    try {
      // Use socket for real-time updates
      if (socketService.isConnected()) {
        socketService.deleteMessage(eventId, messageId);
      } else {
        // Fallback to HTTP API if socket is disconnected
        await chatAPI.deleteMessage(eventId, messageId, { username: currentUser });
      }
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleCreatePoll = async (e) => {
    e.preventDefault();
    const validOptions = newPoll.options.filter(o => o.trim());
    if (!newPoll.question.trim() || validOptions.length < 2) { toast.error('Need a question and at least 2 options'); return; }
    try {
      await pollAPI.create(eventId, { question: newPoll.question, options: validOptions });
      setShowCreatePoll(false);
      setNewPoll({ question: '', options: ['', ''] });
    } catch { toast.error('Failed to create poll'); }
  };

  const handleVote = async (pollId, optionIndex) => {
    try { await pollAPI.vote(eventId, pollId, { option: optionIndex, username: currentUser }); }
    catch (err) { toast.error(err.response?.data?.error || 'Failed to vote'); }
  };

  const handleClosePoll = async (pollId) => {
    try { await pollAPI.close(eventId, pollId, { username: currentUser }); }
    catch { toast.error('Failed to close poll'); }
  };

  const handleFileUpload = async (e) => {
    const selected = Array.from(e.target.files);
    if (!selected.length) return;
    for (const file of selected) {
      if (file.size > MAX_FILE_SIZE) { toast.error(`${file.name} is too large`); continue; }
      setUploadingFile(true);
      const fd = new FormData();
      fd.append('files', file);
      fd.append('uploadedBy', currentUser);
      try { await fileAPI.upload(eventId, fd); await loadFiles(); toast.success(`${file.name} uploaded`); }
      catch { toast.error(`Failed to upload ${file.name}`); }
    }
    setUploadingFile(false);
    fileInputRef.current.value = '';
  };

  const handleDownloadFile = async (fileId, filename) => {
    try {
      const res = await fileAPI.download(eventId, fileId);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url; a.setAttribute('download', filename);
      document.body.appendChild(a); a.click(); a.remove();
    } catch { toast.error('Download failed'); }
  };

  const handleDeleteFile = async (fileId) => {
    if (!confirm('Delete this file?')) return;
    try { await fileAPI.delete(eventId, fileId, { username: currentUser }); await loadFiles(); }
    catch { toast.error('Delete failed'); }
  };

  const handleRsvp = async (status) => {
    try {
      await eventAPI.rsvp(eventId, { username: currentUser, status });
      setRsvps(prev => {
        const existing = prev.find(r => r.username === currentUser);
        if (existing) return prev.map(r => r.username === currentUser ? { ...r, status } : r);
        return [...prev, { username: currentUser, status }];
      });
      toast.success(`RSVP: ${status}`);
    } catch { toast.error('Failed to update RSVP'); }
  };

  const handleAddAgendaItem = async (e) => {
    e.preventDefault();
    if (!newAgendaItem.title.trim()) return;
    try {
      await eventAPI.addAgendaItem(eventId, {
        title: newAgendaItem.title,
        time: newAgendaItem.time,
        description: newAgendaItem.description,
        duration: parseInt(newAgendaItem.duration) || 0
      });
      await loadEvent();
      setShowAddAgenda(false);
      setNewAgendaItem({ title: '', time: '', description: '', duration: '' });
      toast.success('Agenda item added');
    } catch { toast.error('Failed to add item'); }
  };

  const handleDeleteAgendaItem = async (itemId) => {
    try { await eventAPI.deleteAgendaItem(eventId, itemId); await loadEvent(); }
    catch { toast.error('Failed to remove item'); }
  };

  const handleCalendarExport = () => {
    if (!event) return;
    const start = new Date(event.date);
    const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    const fmt = (d) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PlanIt//EN',
      'BEGIN:VEVENT',
      `UID:${eventId}@planit`,
      `DTSTART:${fmt(start)}`,
      `DTEND:${fmt(end)}`,
      `SUMMARY:${event.title}`,
      event.description ? `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}` : '',
      event.location ? `LOCATION:${event.location}` : '',
      `URL:${window.location.origin}/event/${eventId}`,
      'END:VEVENT', 'END:VCALENDAR'
    ].filter(Boolean).join('\r\n');

    const blob = new Blob([ics], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `${event.title.replace(/\s+/g, '-').toLowerCase()}.ics`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast.success('Calendar file downloaded');
  };

  const handleCopyLink = () => {
    const shareUrl = `${window.location.origin}/event/${eventId}`;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true); toast.success('Link copied');
    setTimeout(() => setCopied(false), 2000);
  };

  /* ── Gate / Loading ── */
  if (resolving || (loading && !event)) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <span className="spinner w-5 h-5 border-2 border-neutral-200 border-t-neutral-500" />
    </div>
  );
  
  if (needsJoin) return <JoinGate eventId={eventId} onJoined={handleJoined} />;

  if (!event) return null;
  if (needsJoin) return <JoinGate eventId={eventId} onJoined={handleJoined} />;
  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <span className="spinner w-5 h-5 border-2 border-neutral-200 border-t-neutral-500" />
    </div>
  );

  const tabs = [
    { id: 'chat', label: 'Chat', icon: MessageSquare, count: messages.length },
    { id: 'polls', label: 'Polls', icon: BarChart3, count: polls.length },
    { id: 'files', label: 'Files', icon: FileText, count: files.length },
    { id: 'agenda', label: 'Agenda', icon: Clock, count: agenda.length },
    { id: 'people', label: 'People', icon: Users, count: participants.length },
    { id: 'tasks', label: 'Tasks', icon: CheckCircle2 },
    { id: 'announcements', label: 'Announcements', icon: Megaphone },
    { id: 'expenses', label: 'Budget', icon: DollarSign },
    { id: 'notes', label: 'Notes', icon: StickyNote },
    ...(isOrganizer && event?.isEnterpriseMode ? [{ id: 'analytics', label: 'Analytics', icon: BarChart3 }] : []),
    { id: 'utilities', label: 'Share', icon: Share2 },
  ];

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      {/* Deletion Warning Banner - Shows 7-day countdown */}
      <DeletionWarningBanner eventId={eventId} />
      
      {showQR && <QRModal url={`${window.location.origin}/event/${eventId}`} onClose={() => setShowQR(false)} />}

      {/* Header */}
      <header className="bg-white border-b border-neutral-100 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <a href="/" className="btn btn-ghost p-1.5 -ml-1.5 flex-shrink-0"><ArrowLeft className="w-4 h-4" /></a>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-neutral-900 truncate">{event?.title}</h1>
              {countdown ? (
                <p className="text-xs text-neutral-400 truncate">
                  {countdown.d > 0 && `${countdown.d}d `}{String(countdown.h).padStart(2,'0')}:{String(countdown.m).padStart(2,'0')}:{String(countdown.s).padStart(2,'0')} until event
                </p>
              ) : (
                <p className="text-xs text-neutral-400 truncate">{formatDate(event?.date)}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {onlineUsers.length > 0 && (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 rounded-lg border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-dot" />
                <span className="text-xs font-medium text-emerald-700">{onlineUsers.length} online</span>
              </div>
            )}
            <button onClick={() => setShowQR(true)} className="btn btn-secondary px-3 py-1.5 text-xs gap-1.5">
              <QrCode className="w-3.5 h-3.5" /><span className="hidden sm:inline">QR</span>
            </button>
            <button onClick={handleCopyLink} className="btn btn-secondary px-3 py-1.5 text-xs gap-1.5">
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{copied ? 'Copied' : 'Share'}</span>
            </button>
            {isOrganizer && event?.isEnterpriseMode && (
              <button
                onClick={() => navigate(`/event/${eventId}/checkin`)}
                className="btn btn-primary px-3 py-1.5 text-xs gap-1.5"
                title="Enterprise Check-in"
              >
                <UserCheck className="w-3.5 h-3.5" /><span className="hidden sm:inline">Check-in</span>
              </button>
            )}
            <button onClick={() => { localStorage.removeItem('eventToken'); localStorage.removeItem('username'); navigate('/'); }} className="btn btn-secondary px-3 py-1.5 text-xs gap-1.5">
              <LogOut className="w-3.5 h-3.5" /><span className="hidden sm:inline">Leave</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-5xl w-full mx-auto px-6 py-6 flex gap-6">

        {/* Main panel */}
        <div className="flex-1 min-w-0 flex flex-col">
          {event?.isEnterpriseMode && isOrganizer && (
            <div className="mb-4 p-4 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl border border-blue-700 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                    <UserCheck className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-0.5">Enterprise Mode Active</h3>
                    <p className="text-xs text-blue-100">Manage guest invites and check-in for your event</p>
                  </div>
                </div>
                <button 
                  onClick={() => navigate(`/event/${eventId}/checkin`)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white text-blue-600 rounded-lg font-medium text-sm hover:bg-blue-50 transition-colors shadow-sm flex-shrink-0"
                >
                  <UserCheck className="w-4 h-4" />
                  Manage Invites
                </button>
              </div>
            </div>
          )}
          
          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden flex-1 flex flex-col" style={{ boxShadow: 'var(--shadow-sm)' }}>

            {/* Tabs */}
            <div className="flex border-b border-neutral-100 overflow-x-auto scrollbar-hide">
              {tabs.map(({ id, label, icon: Icon, count }) => (
                <button key={id} onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 transition-all duration-150 whitespace-nowrap ${
                    activeTab === id ? 'text-neutral-900 border-neutral-900' : 'text-neutral-500 border-transparent hover:text-neutral-700 hover:bg-neutral-50'
                  }`}>
                  <Icon className="w-4 h-4" />
                  {label}
                  {count > 0 && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${activeTab === id ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-500'}`}>
                      {count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ── Chat ── */}
            {activeTab === 'chat' && (
              <div className="flex flex-col flex-1" style={{ height: 'calc(100vh - 16rem)' }}>
                <div className="flex-1 overflow-y-auto p-5 space-y-5">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-16">
                      <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mb-3"><MessageSquare className="w-5 h-5 text-neutral-400" /></div>
                      <p className="text-sm font-medium text-neutral-600">No messages yet</p>
                      <p className="text-xs text-neutral-400 mt-1">Be the first to say something</p>
                    </div>
                  ) : messages.map((msg) => {
                    const isMine = msg.username === currentUser;
                    const msgId = msg._id || msg.id;
                    return (
                      <div key={msgId} className={`flex gap-2.5 group ${isMine ? 'flex-row-reverse' : ''}`}>
                        <Avatar name={msg.username} />
                        <div className={`max-w-[72%] flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                          <div className={`flex items-baseline gap-2 mb-1 ${isMine ? 'flex-row-reverse' : ''}`}>
                            <span className="text-xs font-medium text-neutral-700">{msg.username}</span>
                            <span className="text-xs text-neutral-400">{formatRelativeTime(msg.createdAt)}</span>
                            {msg.edited && <span className="text-xs text-neutral-300">edited</span>}
                          </div>
                          <div className={`rounded-xl px-3.5 py-2 text-sm leading-relaxed ${isMine ? 'bg-neutral-900 text-white rounded-tr-sm' : 'bg-neutral-100 text-neutral-900 rounded-tl-sm'}`}>
                            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                          </div>
                          <ReactionBar messageId={msgId} reactions={msg.reactions || []} currentUser={currentUser} eventId={eventId} />
                          {(isOrganizer || isMine) && (
                            <button onClick={() => handleDeleteMessage(msgId)}
                              className="text-xs text-neutral-400 hover:text-red-500 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {typingUsers.length > 0 && (
                    <p className="text-xs text-neutral-400 italic pl-9">
                      {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
                    </p>
                  )}
                  <div ref={messagesEndRef} />
                </div>
                <div className="border-t border-neutral-100 p-4">
                  <form onSubmit={handleSendMessage} className="flex gap-2">
                    <input type="text" value={messageInput}
                      onChange={handleMessageInputChange}
                      placeholder="Send a message..." className="input flex-1 text-sm" maxLength={MAX_MESSAGE_LENGTH} />
                    <button type="submit" disabled={!messageInput.trim() || sendingMessage} className="btn btn-primary px-4">
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* ── Polls ── */}
            {activeTab === 'polls' && (
              <div className="flex-1 overflow-y-auto p-5">
                <div className="mb-5">
                  {!showCreatePoll ? (
                    <button onClick={() => setShowCreatePoll(true)} className="btn btn-secondary text-sm gap-1.5">
                      <Plus className="w-4 h-4" /> Create poll
                    </button>
                  ) : (
                    <div className="card p-5 mb-5">
                      <h3 className="text-sm font-semibold text-neutral-900 mb-4">New poll</h3>
                      <form onSubmit={handleCreatePoll} className="space-y-3">
                        <input type="text" value={newPoll.question}
                          onChange={e => setNewPoll({ ...newPoll, question: e.target.value })}
                          placeholder="What's the question?" className="input text-sm" required />
                        {newPoll.options.map((opt, i) => (
                          <div key={i} className="flex gap-2">
                            <input type="text" value={opt}
                              onChange={e => { const opts = [...newPoll.options]; opts[i] = e.target.value; setNewPoll({ ...newPoll, options: opts }); }}
                              placeholder={`Option ${i + 1}`} className="input flex-1 text-sm" />
                            {newPoll.options.length > 2 && (
                              <button type="button" className="btn btn-secondary px-2.5"
                                onClick={() => setNewPoll({ ...newPoll, options: newPoll.options.filter((_, idx) => idx !== i) })}>
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                        {newPoll.options.length < 10 && (
                          <button type="button" className="btn btn-ghost text-sm gap-1"
                            onClick={() => setNewPoll({ ...newPoll, options: [...newPoll.options, ''] })}>
                            <Plus className="w-3.5 h-3.5" /> Add option
                          </button>
                        )}
                        <div className="flex gap-2 pt-1">
                          <button type="submit" className="btn btn-primary text-sm">Create</button>
                          <button type="button" className="btn btn-secondary text-sm"
                            onClick={() => { setShowCreatePoll(false); setNewPoll({ question: '', options: ['', ''] }); }}>
                            Cancel
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>

                {polls.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mb-3"><BarChart3 className="w-5 h-5 text-neutral-400" /></div>
                    <p className="text-sm font-medium text-neutral-600">No polls yet</p>
                  </div>
                ) : polls.map(poll => {
                  const totalVotes = poll.options?.reduce((sum, o) => sum + (o.votes?.length || 0), 0) || 0;
                  const pollId = poll._id || poll.id;
                  return (
                    <div key={pollId} className="card p-5 mb-4">
                      <div className="flex items-start justify-between mb-4">
                        <h3 className="text-sm font-semibold text-neutral-900 pr-3">{poll.question}</h3>
                        <span className={`badge flex-shrink-0 ${poll.status === 'closed' ? 'badge-gray' : 'badge-green'}`}>
                          {poll.status === 'closed' ? 'Closed' : 'Active'}
                        </span>
                      </div>
                      <div className="space-y-2.5">
                        {poll.options?.map((option, i) => {
                          const votes = option.votes?.length || 0;
                          const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                          const userVoted = option.votes?.some(v => v.username === currentUser);
                          return (
                            <button key={i} onClick={() => poll.status === 'active' && handleVote(pollId, i)}
                              disabled={poll.status === 'closed'}
                              className={`w-full text-left p-3.5 rounded-lg border transition-all duration-150 relative overflow-hidden ${
                                userVoted ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 bg-white hover:border-neutral-400 text-neutral-900'
                              } ${poll.status === 'closed' ? 'cursor-default' : 'cursor-pointer'}`}>
                              <div className={`absolute inset-0 transition-all duration-500 ${userVoted ? 'bg-white/10' : 'bg-neutral-100'}`} style={{ width: `${pct}%` }} />
                              <div className="relative flex items-center justify-between">
                                <span className="text-sm font-medium">{option.text}</span>
                                <span className={`text-xs font-medium ml-2 ${userVoted ? 'text-white/80' : 'text-neutral-500'}`}>{pct}%</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-xs text-neutral-400">{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</span>
                        {isOrganizer && poll.status === 'active' && (
                          <button onClick={() => handleClosePoll(pollId)} className="text-xs text-neutral-500 hover:text-neutral-900 font-medium transition-colors">Close poll</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── Files ── */}
            {activeTab === 'files' && (
              <div className="flex-1 overflow-y-auto p-5">
                <div className="mb-5">
                  <input ref={fileInputRef} type="file" multiple onChange={handleFileUpload} className="hidden" accept={ALLOWED_FILE_TYPES.join(',')} />
                  <button onClick={() => fileInputRef.current?.click()} disabled={uploadingFile} className="btn btn-secondary text-sm gap-1.5">
                    <Paperclip className="w-4 h-4" />{uploadingFile ? 'Uploading...' : 'Upload file'}
                  </button>
                </div>
                {files.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mb-3"><FileText className="w-5 h-5 text-neutral-400" /></div>
                    <p className="text-sm font-medium text-neutral-600">No files yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {files.map(file => {
                      const fid = file._id || file.id;
                      return (
                        <div key={fid} className="flex items-center justify-between p-4 bg-white border border-neutral-200 rounded-xl hover:border-neutral-300 transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 bg-neutral-100 rounded-lg flex items-center justify-center flex-shrink-0"><FileText className="w-4 h-4 text-neutral-500" /></div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-neutral-900 truncate">{file.filename}</p>
                              <p className="text-xs text-neutral-400">{formatFileSize(file.size)} · {file.uploadedBy}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 ml-4 flex-shrink-0">
                            <button onClick={() => handleDownloadFile(fid, file.filename)} className="btn btn-secondary p-2"><Download className="w-3.5 h-3.5" /></button>
                            {(isOrganizer || file.uploadedBy === currentUser) && (
                              <button onClick={() => handleDeleteFile(fid)} className="btn btn-danger p-2"><Trash2 className="w-3.5 h-3.5" /></button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── Agenda ── */}
            {activeTab === 'agenda' && (
              <div className="flex-1 overflow-y-auto p-5">
                {isOrganizer && (
                  <div className="mb-5">
                    {!showAddAgenda ? (
                      <button onClick={() => setShowAddAgenda(true)} className="btn btn-secondary text-sm gap-1.5">
                        <Plus className="w-4 h-4" /> Add agenda item
                      </button>
                    ) : (
                      <div className="card p-5 mb-5">
                        <h3 className="text-sm font-semibold text-neutral-900 mb-4">New agenda item</h3>
                        <form onSubmit={handleAddAgendaItem} className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-neutral-600 mb-1">Title</label>
                              <input type="text" className="input text-sm" placeholder="Welcome speech" required
                                value={newAgendaItem.title} onChange={e => setNewAgendaItem(p => ({ ...p, title: e.target.value }))} />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-neutral-600 mb-1">Time</label>
                              <input type="text" className="input text-sm" placeholder="9:00 AM"
                                value={newAgendaItem.time} onChange={e => setNewAgendaItem(p => ({ ...p, time: e.target.value }))} />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-neutral-600 mb-1">Description (optional)</label>
                            <input type="text" className="input text-sm" placeholder="Brief description"
                              value={newAgendaItem.description} onChange={e => setNewAgendaItem(p => ({ ...p, description: e.target.value }))} />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-neutral-600 mb-1">Duration (minutes)</label>
                            <input type="number" className="input text-sm" placeholder="30" min="0"
                              value={newAgendaItem.duration} onChange={e => setNewAgendaItem(p => ({ ...p, duration: e.target.value }))} />
                          </div>
                          <div className="flex gap-2 pt-1">
                            <button type="submit" className="btn btn-primary text-sm">Add</button>
                            <button type="button" className="btn btn-secondary text-sm" onClick={() => setShowAddAgenda(false)}>Cancel</button>
                          </div>
                        </form>
                      </div>
                    )}
                  </div>
                )}

                {agenda.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mb-3"><Clock className="w-5 h-5 text-neutral-400" /></div>
                    <p className="text-sm font-medium text-neutral-600">No agenda yet</p>
                    {isOrganizer && <p className="text-xs text-neutral-400 mt-1">Add items to plan the event schedule</p>}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {agenda.map((item, idx) => (
                      <div key={item.id || idx} className="flex items-start gap-4 p-4 bg-white border border-neutral-200 rounded-xl">
                        {item.time && (
                          <div className="flex-shrink-0 text-right min-w-14">
                            <p className="text-xs font-medium text-neutral-500 font-mono">{item.time}</p>
                            {item.duration > 0 && <p className="text-xs text-neutral-400">{item.duration}m</p>}
                          </div>
                        )}
                        <div className={`flex-1 min-w-0 ${item.time ? 'border-l border-neutral-200 pl-4' : ''}`}>
                          <p className="text-sm font-medium text-neutral-900">{item.title}</p>
                          {item.description && <p className="text-xs text-neutral-500 mt-0.5">{item.description}</p>}
                        </div>
                        {isOrganizer && (
                          <button onClick={() => handleDeleteAgendaItem(item.id)} className="btn btn-ghost p-1.5 text-neutral-400 hover:text-red-500 flex-shrink-0">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── People ── */}
            {activeTab === 'people' && (
              <div className="flex-1 overflow-y-auto p-5">
                <div className="flex items-center gap-4 mb-5 p-4 bg-neutral-50 rounded-xl border border-neutral-200">
                  <div className="flex gap-4 text-sm">
                    <span className="text-emerald-600 font-medium">{rsvpSummary.yes} going</span>
                    <span className="text-amber-600 font-medium">{rsvpSummary.maybe} maybe</span>
                    <span className="text-neutral-400 font-medium">{rsvpSummary.no} not going</span>
                  </div>
                </div>

                {/* My RSVP */}
                <div className="mb-5 p-4 bg-white border border-neutral-200 rounded-xl">
                  <p className="text-xs font-medium text-neutral-500 mb-2">Your RSVP</p>
                  <div className="flex gap-2">
                    {[['yes', 'Going', 'bg-emerald-50 text-emerald-700 border-emerald-300'],
                      ['maybe', 'Maybe', 'bg-amber-50 text-amber-700 border-amber-300'],
                      ['no', 'Not going', 'bg-neutral-100 text-neutral-600 border-neutral-300']
                    ].map(([status, label, active]) => (
                      <button key={status} onClick={() => handleRsvp(status)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
                          myRsvp === status ? active : 'bg-white text-neutral-500 border-neutral-200 hover:border-neutral-400'
                        }`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  {participants.map(p => {
                    const isOnline = onlineUsers.includes(p.username);
                    const isOrg = p.role === 'organizer';
                    const pRsvp = rsvps.find(r => r.username === p.username);
                    return (
                      <div key={p.username} className="flex items-center gap-3 p-3.5 bg-white border border-neutral-200 rounded-xl">
                        <div className="relative">
                          <Avatar name={p.username} size="md" />
                          {isOnline && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-white" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-neutral-900 truncate">{p.username}</p>
                            {isOrg && <span className="badge badge-primary">Organizer</span>}
                            {pRsvp && (
                              <span className={`badge ${pRsvp.status === 'yes' ? 'badge-green' : pRsvp.status === 'maybe' ? 'badge-amber' : 'badge-gray'}`}>
                                {pRsvp.status === 'yes' ? 'Going' : pRsvp.status === 'maybe' ? 'Maybe' : 'Not going'}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-neutral-400">
                            {isOnline ? 'Online now' : `Joined ${formatRelativeTime(p.joinedAt)}`}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── NEW FEATURES ── */}
            {activeTab === 'tasks' && (
              <div className="flex-1 overflow-hidden">
                <Tasks eventId={eventId} socket={socketService} />
              </div>
            )}

            {activeTab === 'announcements' && (
              <div className="flex-1 overflow-hidden">
                <Announcements eventId={eventId} socket={socketService} isOrganizer={isOrganizer} />
              </div>
            )}

            {activeTab === 'expenses' && (
              <div className="flex-1 overflow-hidden">
                <Expenses eventId={eventId} socket={socketService} isOrganizer={isOrganizer} />
              </div>
            )}

            {activeTab === 'notes' && (
              <div className="flex-1 overflow-hidden">
                <Notes eventId={eventId} socket={socketService} />
              </div>
            )}

            {activeTab === 'analytics' && isOrganizer && (
              <div className="flex-1 overflow-hidden">
                <Analytics eventId={eventId} />
              </div>
            )}

            {activeTab === 'utilities' && (
              <div className="flex-1 overflow-hidden">
                <Utilities 
                  eventId={eventId} 
                  subdomain={event.subdomain}
                  isOrganizer={isOrganizer}
                  isEnterpriseMode={event?.isEnterpriseMode}
                />
              </div>
            )}

          </div>
        </div>

        {/* Sidebar */}
        <aside className="hidden lg:block w-64 flex-shrink-0">
          <div className="card p-5 sticky top-20">
            {event?.date && (
              <div className="mb-5">
                <Countdown eventDate={event.date} />
              </div>
            )}
            
            <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-4">Event details</h3>
            <div className="space-y-3.5">
              <div>
                <p className="text-xs text-neutral-400 mb-0.5">Title</p>
                <p className="text-sm font-medium text-neutral-900">{event?.title}</p>
              </div>
              {event?.isEnterpriseMode && (
                <div>
                  <p className="text-xs text-neutral-400 mb-0.5">Event Type</p>
                  <div className="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-50 border border-blue-200 rounded text-xs font-medium text-blue-700">
                    <Users className="w-3 h-3" />
                    Enterprise Mode
                  </div>
                </div>
              )}
              {event?.date && (
                <div>
                  <p className="text-xs text-neutral-400 mb-0.5">Date</p>
                  <p className="text-sm text-neutral-700">{formatDate(event.date)}</p>
                </div>
              )}
              {event?.location && (
                <div>
                  <p className="text-xs text-neutral-400 mb-0.5">Location</p>
                  <p className="text-sm text-neutral-700">{event.location}</p>
                </div>
              )}
              {event?.description && (
                <div>
                  <p className="text-xs text-neutral-400 mb-0.5">Description</p>
                  <p className="text-sm text-neutral-700 leading-relaxed">{event.description}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-neutral-400 mb-0.5">Participants</p>
                <p className="text-sm text-neutral-700">{participants.length} / {event?.maxParticipants || 100}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-400 mb-0.5">RSVP</p>
                <p className="text-sm text-neutral-700">{rsvpSummary.yes} going · {rsvpSummary.maybe} maybe</p>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-neutral-100 space-y-2">

              {/* ── Organizer Tools ── */}
              {isOrganizer && (
                <div className="mb-1">
                  <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-2 px-1">Organizer Tools</p>
                  {event?.isEnterpriseMode && (
                    <button
                      onClick={() => navigate(`/event/${eventId}/checkin`)}
                      className="flex items-center gap-2 w-full px-3 py-2.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium mb-1.5"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Manage Guest Check-in</span>
                    </button>
                  )}
                  <button
                    onClick={() => navigate(`/event/${eventId}/login`)}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs bg-neutral-900 hover:bg-neutral-700 text-white rounded-lg transition-colors"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Organizer Login (new device)</span>
                  </button>
                </div>
              )}

              {/* Share links */}
              {event?.subdomain && (
                <button
                  onClick={() => {
                    const link = `${window.location.origin}/e/${event.subdomain}`;
                    navigator.clipboard.writeText(link);
                    toast.success('Subdomain link copied!');
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-lg text-neutral-600 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">Copy: /e/{event.subdomain}</span>
                </button>
              )}
              <button onClick={handleCopyLink}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-lg text-neutral-600 transition-colors">
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                <span className="truncate">{copied ? 'Copied!' : 'Copy event link'}</span>
              </button>
              <button onClick={handleCalendarExport}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-lg text-neutral-600 transition-colors">
                <Download className="w-3.5 h-3.5" />
                <span>Export to calendar</span>
              </button>
              <button onClick={() => setShowQR(true)}
                className="flex items-center gap-2 w-full px-3 py-2 text-xs bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-lg text-neutral-600 transition-colors">
                <QrCode className="w-3.5 h-3.5" />
                <span>Show event QR code</span>
              </button>
            </div>

            {/* Contact */}
            <div className="mt-4 pt-4 border-t border-neutral-100">
              <p className="text-xs text-neutral-400 mb-1.5">Need help or changes?</p>
              <a
                href="mailto:planit.userhelp@gmail.com"
                className="flex items-center gap-2 w-full px-3 py-2 text-xs bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-lg text-neutral-600 hover:text-neutral-900 transition-colors"
              >
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                <span className="truncate">planit.userhelp@gmail.com</span>
              </a>
              <p className="text-xs text-neutral-400 mt-2 leading-relaxed">
                Contact us for inquiries, changes, or increased event capacity.
              </p>
            </div>

          </div>
        </aside>
      </div>
    </div>
  );
}
