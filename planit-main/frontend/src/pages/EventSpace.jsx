import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Calendar, Users, MessageSquare, BarChart3, FileText,
  Send, Paperclip, X, Download, Trash2, Plus, Sliders,
  LogOut, ArrowLeft, Copy, Check, Lock, MapPin,
  ChevronRight, Clock, QrCode,
  Smile,
  CheckCircle2, Megaphone, DollarSign, StickyNote, Share2, UserCheck, XCircle, ClipboardList,
  Star, Shield, LogIn, UserPlus, HelpCircle
} from 'lucide-react';
import { eventAPI, chatAPI, pollAPI, fileAPI, rsvpAPI } from '../services/api';
import socketService from '../services/socket';
import SecurityAlerts, { useSecurityAlerts } from '../components/SecurityAlerts';
import { formatDate, formatRelativeTime, formatFileSize } from '../utils/formatters';
import { MAX_MESSAGE_LENGTH, MAX_FILE_SIZE, ALLOWED_FILE_TYPES } from '../utils/constants';
import toast from 'react-hot-toast';
import { useWhiteLabel } from '../context/WhiteLabelContext';

import Tasks from '../components/Tasks';
import Announcements from '../components/Announcements';
import Expenses from '../components/Expenses';
import Notes from '../components/Notes';
import Analytics from '../components/Analytics';
import Utilities from '../components/Utilities';
import Countdown from '../components/Countdown';
import DeletionWarningBanner from '../components/DeletionWarningBanner';
import OrganizerSettings from '../components/OrganizerSettings';
import Onboarding from '../components/Onboarding';
import CrossPlatformAd from '../components/CrossPlatformAd';

/* ─── QR Modal ───────────────────────────────────────────────────────────── */
function QRModal({ eventId, onClose }) {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  const qrSrc  = `${apiUrl}/events/${eventId}/qr.svg`;
  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = qrSrc; a.download = `planit-qr-${eventId}.svg`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-80 shadow-2xl border border-neutral-100 animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-neutral-900">Event QR Code</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-neutral-100 flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-neutral-500" />
          </button>
        </div>
        <div className="flex justify-center mb-3 bg-neutral-50 rounded-xl p-4 border border-neutral-100">
          <img src={qrSrc} alt="PlanIt QR Code" className="w-52 h-auto" />
        </div>
        <p className="text-xs text-neutral-400 text-center mb-3">Scan to join · branded for sharing</p>
        <button onClick={handleDownload} className="btn btn-secondary w-full text-xs gap-1.5 rounded-xl">
          <Download className="w-3.5 h-3.5" /> Download SVG
        </button>
      </div>
    </div>
  );
}

/* ─── Join Gate ──────────────────────────────────────────────────────────── */
function JoinGate({ eventId, onJoined }) {
  const [publicInfo, setPublicInfo]               = useState(null);
  const [knownParticipants, setKnownParticipants] = useState([]);
  const [loading, setLoading]                     = useState(true);
  const [joining, setJoining]                     = useState(false);

  // step: 'name' | 'account-password' | 'event-password'
  // Having a step machine means the form never collapses mid-flow.
  const [step, setStep]                 = useState('name');
  const [username, setUsername]         = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [password, setPassword]         = useState('');       // event password
  const [accountPassword, setAccountPassword] = useState(''); // account password
  const [error, setError]               = useState('');
  const [pollToken, setPollToken]       = useState('');   // approval poll token issued at join time
  const justSelectedRef                 = useRef(false);
  const accountPwdRef                   = useRef(null);

  // Full-event state
  const [isFull, setIsFull]         = useState(false);
  const [fullMode, setFullMode]     = useState('waitlist');
  // Waitlist
  const [waitlistName, setWaitlistName]   = useState('');
  const [waitlistEmail, setWaitlistEmail] = useState('');
  const [waitlistDone, setWaitlistDone]   = useState(false);
  const [waitlistJoining, setWaitlistJoining] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!eventId) return;
    eventAPI.getPublicInfo(eventId)
      .then((infoRes) => {
        const info = infoRes.data.event;
        setPublicInfo(info);
        setIsFull(info.participantCount >= info.maxParticipants);
        return eventAPI.getPublicParticipants(eventId)
          .then(partRes => setKnownParticipants(partRes.data.participants || []))
          .catch(() => setKnownParticipants([]));
      })
      .catch(() => navigate('/'))
      .finally(() => setLoading(false));
  }, [eventId]);

  // Focus account password field when we switch to that step
  useEffect(() => {
    if (step === 'account-password') {
      setTimeout(() => accountPwdRef.current?.focus(), 50);
    }
  }, [step]);

  // ── Poll approval status while waiting ─────────────────────────────────────
  // The socket-based approval_approved event only reaches users already inside
  // the event room (which requires a valid token).  Pending users have no token,
  // so they can never receive the socket event.  Instead we poll the lightweight
  // /approval-status endpoint every 4 seconds.  Once approved, the endpoint
  // returns a token and we call onJoined() immediately.
  useEffect(() => {
    if (step !== 'pending-approval' || !eventId || !username) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await eventAPI.checkApprovalStatus(eventId, username, pollToken);
        if (cancelled) return;
        if (res.data?.approved && res.data?.token) {
          localStorage.setItem('eventToken', res.data.token);
          localStorage.setItem('username', username);
          onJoined();
        }
        // If still pending or notRequested, keep waiting
      } catch {
        // Silently ignore errors during polling
      }
    };

    poll(); // Immediate first check
    const interval = setInterval(poll, 4000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [step, eventId, username, pollToken]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredParticipants = knownParticipants.filter(p =>
    username.trim() === '' || p.username.toLowerCase().includes(username.toLowerCase())
  );

  const lookupParticipant = (name) =>
    knownParticipants.find(p => p.username.toLowerCase() === name.trim().toLowerCase());

  const handleSelectName = (p) => {
    setUsername(p.username);
    setShowDropdown(false);
    justSelectedRef.current = true;
    setError('');
    // If they have an account password, jump straight to that step
    if (p.hasPassword) {
      setStep('account-password');
    }
  };

  const handleUsernameChange = (e) => {
    setUsername(e.target.value);
    setStep('name');
    setAccountPassword('');
    setShowDropdown(true);
    setError('');
  };

  const handleNameContinue = (e) => {
    e.preventDefault();
    const name = username.trim();
    if (!name) { setError('Please enter your name'); return; }
    if (isFull) {
      const known = lookupParticipant(name);
      if (!known) { setError('This event is full. Only participants who have already joined can sign in.'); return; }
      if (known.hasPassword) { setStep('account-password'); return; }
    }
    const existing = lookupParticipant(name);
    if (existing?.hasPassword) {
      setStep('account-password');
    } else if (publicInfo.isPasswordProtected) {
      setStep('event-password');
    } else {
      // New user may have typed an optional account password — pass it along
      submitJoin(name, accountPassword, '');
    }
  };

  const handleAccountPasswordContinue = (e) => {
    e.preventDefault();
    if (!accountPassword) { setError('Please enter your account password'); return; }
    if (publicInfo.isPasswordProtected) {
      setStep('event-password');
    } else {
      submitJoin(username.trim(), accountPassword, '');
    }
  };

  const handleEventPasswordContinue = (e) => {
    e.preventDefault();
    if (!password) { setError('Please enter the event password'); return; }
    submitJoin(username.trim(), accountPassword, password);
  };

  const submitJoin = async (name, acctPwd, evtPwd) => {
    setJoining(true); setError('');
    try {
      const payload = { username: name, accountPassword: acctPwd || undefined };
      if (evtPwd) payload.password = evtPwd;
      const res = publicInfo.isPasswordProtected && evtPwd
        ? await eventAPI.verifyPassword(eventId, payload)
        : await eventAPI.join(eventId, payload);

      // ── CRITICAL: Check for approval-required BEFORE saving token/calling onJoined ──
      // The backend now returns 403 for approval-required cases so Axios throws.
      // But if somehow a 202/requiresApproval slips through as a resolved response,
      // this guard ensures we never call onJoined() without a real token.
      if (res.data?.requiresApproval || !res.data?.token) {
        localStorage.setItem('username', name);
        if (res.data?.pollToken) setPollToken(res.data.pollToken);
        setStep('pending-approval');
        setError('');
        setJoining(false);
        return;
      }

      localStorage.setItem('eventToken', res.data.token);
      localStorage.setItem('username', name);
      onJoined();
    } catch (err) {
      const data = err.response?.data;
      if (data?.requiresApproval) {
        // Store the username so the pending-approval polling can use it
        localStorage.setItem('username', name);
        if (data.pollToken) setPollToken(data.pollToken);
        setStep('pending-approval');
        setError('');
      } else if (data?.requiresAccountPassword) {
        setStep('account-password');
        setError('This name is protected. Enter your account password to continue.');
      } else if (data?.error?.toLowerCase().includes('password')) {
        setError(data.error);
        setStep('event-password');
        setPassword('');
      } else {
        setError(data?.error || 'Unable to join. Please try again.');
        setStep('name');
      }
    } finally { setJoining(false); }
  };

  const handleWaitlistJoin = async () => {
    if (!waitlistName.trim()) return;
    setWaitlistJoining(true);
    try {
      await eventAPI.joinWaitlist(eventId, { username: waitlistName.trim(), email: waitlistEmail.trim() });
      setWaitlistDone(true);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to join waitlist');
    } finally { setWaitlistJoining(false); }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#06060c' }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <Calendar className="w-5 h-5" style={{ color: 'rgba(255,255,255,0.4)' }} />
        </div>
        <span className="spinner w-4 h-4 border-2 border-white/10 border-t-white/30" />
      </div>
    </div>
  );
  if (!publicInfo) return null;

  const { yes = 0, maybe = 0, no: noCount = 0 } = publicInfo.rsvpSummary || {};
  const fillPct = publicInfo.maxParticipants
    ? Math.min(100, Math.round((publicInfo.participantCount / publicInfo.maxParticipants) * 100))
    : 0;

  // Derived values used across all steps
  const isNewUser     = step === 'name' && username.trim() && !lookupParticipant(username);
  const isFullBlocked = isFull && step === 'name' && username.trim() && !lookupParticipant(username);

  // Step label map for the progress indicator
  const STEP_LABELS = {
    'name': 1,
    'account-password': 2,
    'event-password': publicInfo?.isPasswordProtected ? 3 : 2,
    'pending-approval': 2,
  };
  const totalSteps = publicInfo?.isPasswordProtected ? 3 : 2;
  const currentStepNum = STEP_LABELS[step] || 1;
  const showStepProgress = step !== 'name';

  // Single inline form — no inner components so React never unmounts/remounts on keystroke
  const joinFormJSX = (
    <div className="space-y-4">

      {/* ── Step progress dots ── */}
      {showStepProgress && step !== 'pending-approval' && (
        <div className="flex items-center gap-1.5 justify-center mb-2">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} className={`rounded-full transition-all duration-300 ${
              i < currentStepNum
                ? 'w-6 h-1.5 bg-neutral-900'
                : 'w-1.5 h-1.5 bg-neutral-300'
            }`} />
          ))}
        </div>
      )}

      {/* ── STEP: name ── */}
      {step === 'name' && (
        <form onSubmit={handleNameContinue} className="space-y-4">
          <div className="relative">
            <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">
              Your Name
            </label>
            <input
              type="text" required className="input rounded-xl"
              placeholder="Enter your name"
              value={username}
              onChange={handleUsernameChange}
              onFocus={() => { if (!justSelectedRef.current) setShowDropdown(true); justSelectedRef.current = false; }}
              onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
              autoComplete="off" autoFocus
            />
            {showDropdown && filteredParticipants.length > 0 && (
              <div className="absolute z-20 w-full mt-1.5 bg-white border border-neutral-200 rounded-xl shadow-2xl overflow-hidden">
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest px-3 pt-2.5 pb-1">Previously joined</p>
                {filteredParticipants.slice(0, 6).map(p => (
                  <button key={p.username} type="button"
                    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-neutral-50 text-left transition-colors"
                    onMouseDown={() => handleSelectName(p)}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-neutral-100 flex items-center justify-center text-xs font-bold text-neutral-600">
                        {p.username.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-neutral-900">{p.username}</span>
                    </div>
                    {p.hasPassword
                      ? <span className="flex items-center gap-1 text-[10px] text-neutral-400"><Lock className="w-2.5 h-2.5" />protected</span>
                      : <span className="text-[10px] text-neutral-300">returning</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Optional account password — only for genuinely new usernames */}
          {isNewUser && !isFullBlocked && (
            <div>
              <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">
                Account Password <span className="normal-case font-normal text-neutral-400">(optional)</span>
              </label>
              <input
                type="password" className="input rounded-xl"
                placeholder="Protect your username (min 4 chars)"
                value={accountPassword}
                onChange={e => setAccountPassword(e.target.value)}
                minLength={4}
                autoComplete="new-password"
              />
              <p className="text-[11px] text-neutral-400 mt-1.5 leading-relaxed">
                Prevents others from posting as <strong className="font-semibold text-neutral-600">{username.trim()}</strong> in future events.
              </p>
            </div>
          )}

          {isFullBlocked && (
            <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <XCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700">This event is full. Only participants who have already joined can sign in.</p>
            </div>
          )}

          {error && step === 'name' && (
            <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-xl">
              <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <button type="submit"
            disabled={joining || !username.trim() || !!isFullBlocked}
            className="w-full h-12 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#111827,#1f2937)' }}>
            {joining
              ? <><span className="spinner w-4 h-4 border-2 border-white/20 border-t-white" />Checking…</>
              : <><UserPlus className="w-4 h-4" />Continue<ChevronRight className="w-4 h-4 ml-auto" /></>}
          </button>
        </form>
      )}

      {/* ── STEP: account password ── */}
      {step === 'account-password' && (
        <form onSubmit={handleAccountPasswordContinue} className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-neutral-50 border border-neutral-200 rounded-xl">
            <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center text-xs font-bold text-neutral-600 flex-shrink-0">
              {username.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-neutral-900 truncate">{username}</p>
              <p className="text-[11px] text-neutral-500">Protected account</p>
            </div>
            <button type="button" onClick={() => { setStep('name'); setAccountPassword(''); setError(''); }}
              className="ml-auto text-xs text-neutral-400 hover:text-neutral-700 transition-colors flex-shrink-0">
              Change
            </button>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">
              Account Password
            </label>
            <input
              ref={accountPwdRef}
              type="password" required className="input rounded-xl"
              placeholder="Enter your account password"
              value={accountPassword}
              onChange={e => { setAccountPassword(e.target.value); setError(''); }}
              autoComplete="current-password"
            />
          </div>

          {error && step === 'account-password' && (
            <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-xl">
              <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <button type="submit" disabled={joining || !accountPassword}
            className="w-full h-12 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#111827,#1f2937)' }}>
            {joining
              ? <><span className="spinner w-4 h-4 border-2 border-white/20 border-t-white" />Verifying…</>
              : <><LogIn className="w-4 h-4" />{publicInfo.isPasswordProtected ? 'Continue' : 'Join Event'}<ChevronRight className="w-4 h-4 ml-auto" /></>}
          </button>
        </form>
      )}

      {/* ── STEP: event password ── */}
      {step === 'event-password' && (
        <form onSubmit={handleEventPasswordContinue} className="space-y-4">
          <div className="flex items-center gap-3 p-3 bg-neutral-50 border border-neutral-200 rounded-xl">
            <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center text-xs font-bold text-neutral-600 flex-shrink-0">
              {username.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-neutral-900 truncate">{username}</p>
            </div>
            <button type="button" onClick={() => { setStep('name'); setPassword(''); setAccountPassword(''); setError(''); }}
              className="ml-auto text-xs text-neutral-400 hover:text-neutral-700 transition-colors flex-shrink-0">
              Change
            </button>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">
              Event Password
            </label>
            <input type="password" required className="input rounded-xl" autoFocus
              placeholder="Enter the event password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              autoComplete="off"
            />
          </div>

          {error && step === 'event-password' && (
            <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-200 rounded-xl">
              <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <button type="submit" disabled={joining || !password}
            className="w-full h-12 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#111827,#1f2937)' }}>
            {joining
              ? <><span className="spinner w-4 h-4 border-2 border-white/20 border-t-white" />Joining…</>
              : <><LogIn className="w-4 h-4" />Join Event<ChevronRight className="w-4 h-4 ml-auto" /></>}
          </button>
        </form>
      )}

      {/* ── STEP: pending approval ── */}
      {step === 'pending-approval' && (
        <div className="text-center py-4 space-y-4">
          {/* Animated pulse ring */}
          <div className="relative w-16 h-16 mx-auto">
            <div className="absolute inset-0 rounded-full bg-amber-100 border-2 border-amber-200 animate-pulse" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Clock className="w-7 h-7 text-amber-500" />
            </div>
          </div>
          <div>
            <p className="font-bold text-neutral-900 mb-1">Awaiting organizer approval</p>
            <p className="text-sm text-neutral-500 leading-relaxed">
              Your request to join as <strong className="text-neutral-700">{username}</strong> has been sent.
              This page will automatically unlock once the organizer approves.
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 py-3 px-4 bg-amber-50 border border-amber-200 rounded-xl">
            <span className="flex gap-0.5">
              <span className="w-1 h-3 bg-amber-400 rounded-full animate-[bounce_1s_ease-in-out_infinite]" style={{animationDelay:'0ms'}}/>
              <span className="w-1 h-3 bg-amber-400 rounded-full animate-[bounce_1s_ease-in-out_infinite]" style={{animationDelay:'150ms'}}/>
              <span className="w-1 h-3 bg-amber-400 rounded-full animate-[bounce_1s_ease-in-out_infinite]" style={{animationDelay:'300ms'}}/>
            </span>
            <span className="text-xs font-semibold text-amber-700">Checking every 4 seconds…</span>
          </div>
          <p className="text-xs text-neutral-400">You'll be taken straight in once approved — no need to refresh.</p>
          <button
            onClick={() => { setStep('name'); setUsername(''); setError(''); }}
            className="text-xs text-neutral-400 hover:text-neutral-700 transition-colors underline underline-offset-2"
          >
            Use a different name
          </button>
        </div>
      )}

    </div>
  );

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(150deg,#06060c 0%,#0d0d1a 45%,#060610 100%)' }}>
      {/* Ambient background glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div className="absolute top-[-15%] left-[8%] w-[700px] h-[700px] rounded-full"
          style={{ background: 'radial-gradient(circle,rgba(99,102,241,0.07) 0%,transparent 70%)' }} />
        <div className="absolute bottom-[-10%] right-[3%] w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle,rgba(139,92,246,0.05) 0%,transparent 70%)' }} />
      </div>

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-6 py-5 max-w-4xl mx-auto w-full">
        <div className="flex items-center gap-2.5">
          {isWL && wl?.branding?.logoUrl
            ? <img src={wl.branding.logoUrl} alt={wl.branding.companyName || wl.clientName || ''} style={{ height: 26, objectFit: 'contain', maxWidth: 120 }} />
            : isWL && wl?.branding?.hidePoweredBy
            ? null
            : (
              <>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <Calendar className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.6)' }} />
                </div>
                <span className="text-sm font-bold tracking-tight" style={{ color: 'rgba(255,255,255,0.7)' }}>
                  {isWL ? (wl?.branding?.companyName || wl?.clientName || '') : 'PlanIt'}
                </span>
              </>
            )
          }
        </div>
        <button onClick={() => navigate('/')} className="text-xs transition-colors"
          style={{ color: 'rgba(255,255,255,0.35)' }}
          onMouseEnter={e => e.currentTarget.style.color = 'rgba(255,255,255,0.65)'}
          onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.35)'}>
          ← Home
        </button>
      </div>

      {/* Center content */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-4 py-6">
        <div className="w-full max-w-[480px] sm:max-w-[540px] animate-fade-in">

          {/* Event hero */}
          <div className="rounded-2xl overflow-hidden mb-3"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(24px)' }}>
            <div className="p-6">
              {/* Status chips */}
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                {isFull && (
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                    style={{ color: '#fbbf24', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.18)' }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse-dot" />Event Full
                  </span>
                )}
                {publicInfo.isPasswordProtected && (
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                    style={{ color: '#a78bfa', background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.18)' }}>
                    <Lock className="w-2.5 h-2.5" />Password Protected
                  </span>
                )}
                {publicInfo.status === 'cancelled' && (
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                    style={{ color: '#f87171', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.18)' }}>
                    Cancelled
                  </span>
                )}
              </div>

              <h1 className="text-[22px] font-bold leading-tight tracking-tight mb-4" style={{ color: 'rgba(255,255,255,0.95)' }}>
                {publicInfo.title}
              </h1>

              <div className="space-y-2">
                {publicInfo.date && (
                  <div className="flex items-center gap-2.5 text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
                    <Calendar className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.25)' }} />
                    {formatDate(publicInfo.date)}
                  </div>
                )}
                {publicInfo.location && (
                  <div className="flex items-center gap-2.5 text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
                    <MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.25)' }} />
                    {publicInfo.location}
                  </div>
                )}
                <div className="flex items-center gap-2.5 text-sm" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  <Users className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.25)' }} />
                  Hosted by <strong className="font-semibold ml-0.5" style={{ color: 'rgba(255,255,255,0.8)' }}>{publicInfo.organizerName}</strong>
                </div>
              </div>

              {/* Capacity bar */}
              <div className="mt-5 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-medium" style={{ color: 'rgba(255,255,255,0.35)' }}>Capacity</span>
                  <span className="text-xs font-semibold" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    {publicInfo.participantCount} / {publicInfo.maxParticipants}
                  </span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                  <div className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${fillPct}%`,
                      background: isFull
                        ? 'linear-gradient(90deg,#f59e0b,#ef4444)'
                        : 'linear-gradient(90deg,#6366f1,#8b5cf6)'
                    }} />
                </div>
                {(yes + maybe + noCount) > 0 && (
                  <div className="flex items-center gap-3 mt-3">
                    <span className="text-xs font-semibold" style={{ color: '#34d399' }}>{yes} going</span>
                    <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
                    <span className="text-xs font-semibold" style={{ color: '#fbbf24' }}>{maybe} maybe</span>
                    {noCount > 0 && <>
                      <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.15)' }}>·</span>
                      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>{noCount} can't go</span>
                    </>}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action card */}
          <div className="rounded-2xl overflow-hidden"
            style={{ background: 'rgba(255,255,255,0.97)', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 28px 72px rgba(0,0,0,0.55)' }}>

            {isFull ? (
              waitlistDone ? (
                /* ── Waitlist success ── */
                <div className="p-8 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                  </div>
                  <h2 className="text-lg font-bold text-neutral-900 mb-1.5">You're on the waitlist!</h2>
                  <p className="text-sm text-neutral-500 leading-relaxed">
                    The organizer will reach out if a spot opens up.
                  </p>
                  <button onClick={() => { setWaitlistDone(false); setFullMode('signin'); setStep('name'); }}
                    className="mt-5 text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors underline underline-offset-2">
                    Already a member? Sign in instead
                  </button>
                </div>
              ) : (
                /* ── Full event: tab toggle ── */
                <div className="p-5">
                  <div className="flex rounded-xl p-1 mb-5" style={{ background: '#f2f2f5' }}>
                    <button onClick={() => { setFullMode('waitlist'); setStep('name'); setError(''); }}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-bold transition-all ${
                        fullMode === 'waitlist' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'
                      }`}>
                      <ClipboardList className="w-3.5 h-3.5" />Waitlist
                    </button>
                    <button onClick={() => { setFullMode('signin'); setStep('name'); setError(''); }}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-bold transition-all ${
                        fullMode === 'signin' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'
                      }`}>
                      <LogIn className="w-3.5 h-3.5" />Already Joined
                    </button>
                  </div>

                  {fullMode === 'waitlist' ? (
                    <div>
                      <div className="flex items-start gap-3 p-3.5 rounded-xl mb-4"
                        style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
                        <Users className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-bold text-amber-800">This event is full</p>
                          <p className="text-xs text-amber-600 mt-0.5">
                            Join the waitlist and you'll be notified if a spot opens.
                          </p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">Your Name</label>
                          <input type="text" className="input rounded-xl" placeholder="Enter your name"
                            value={waitlistName} onChange={e => setWaitlistName(e.target.value)} autoFocus />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-widest mb-1.5">
                            Email <span className="normal-case font-normal text-neutral-400">(optional)</span>
                          </label>
                          <input type="email" className="input rounded-xl" placeholder="your@email.com"
                            value={waitlistEmail} onChange={e => setWaitlistEmail(e.target.value)} />
                        </div>
                        <button onClick={handleWaitlistJoin} disabled={waitlistJoining || !waitlistName.trim()}
                          className="w-full h-11 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-50"
                          style={{ background: 'linear-gradient(135deg,#d97706,#b45309)' }}>
                          {waitlistJoining
                            ? <><span className="spinner w-4 h-4 border-2 border-white/20 border-t-white" />Joining…</>
                            : <><ClipboardList className="w-4 h-4" />Join Waitlist</>
                          }
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm text-neutral-500 mb-4 leading-relaxed">
                        Sign in with the name you used when you joined.
                      </p>
                      {joinFormJSX}
                    </div>
                  )}
                </div>
              )
            ) : (
              /* ── Normal join flow ── */
              <div className="p-6 sm:p-8">
                <div className="mb-5">
                  <h2 className="text-[18px] font-bold text-neutral-900 leading-snug">
                    {step === 'account-password' ? 'Enter your password' :
                     step === 'event-password'   ? 'Event password required' :
                     step === 'pending-approval' ? 'Request sent' :
                     'Join this event'}
                  </h2>
                  <p className="text-sm text-neutral-400 mt-0.5">
                    {step === 'account-password' ? 'Your username is protected with a password' :
                     step === 'event-password'   ? 'This event requires a password to join' :
                     'Enter your name to get access'}
                  </p>
                </div>
                {joinFormJSX}
              </div>
            )}

            {/* Organizer footer */}
            <div className="px-5 py-3.5 border-t border-neutral-100" style={{ background: 'rgba(249,249,252,0.8)' }}>
              <div className="flex items-center justify-between">
                <p className="text-xs text-neutral-400">Are you the organizer?</p>
                <button onClick={() => navigate(`/event/${eventId}/login`)}
                  className="flex items-center gap-1.5 text-xs font-bold text-neutral-700 hover:text-neutral-900 transition-colors">
                  <Lock className="w-3 h-3" />Organizer login <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Avatar ──────────────────────────────────────────────────────────────── */
function Avatar({ name, size = 'sm' }) {
  const palettes = [
    'bg-blue-100 text-blue-700','bg-violet-100 text-violet-700',
    'bg-emerald-100 text-emerald-700','bg-orange-100 text-orange-700',
    'bg-rose-100 text-rose-700','bg-teal-100 text-teal-700',
    'bg-cyan-100 text-cyan-700','bg-pink-100 text-pink-700',
  ];
  const color = palettes[(name?.charCodeAt(0) || 0) % palettes.length];
  const sizes = { sm: 'w-7 h-7 text-xs', md: 'w-9 h-9 text-sm', lg: 'w-11 h-11 text-base' };
  return (
    <div className={`${sizes[size]} ${color} rounded-full flex items-center justify-center font-bold flex-shrink-0 select-none`}>
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
    if (mine) socketService.removeReaction(eventId, messageId, emoji);
    else       socketService.addReaction(eventId, messageId, emoji);
    setOpen(false);
  };
  return (
    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
      {grouped.map(({ emoji, count, mine }) => (
        <button key={emoji} onClick={() => toggle(emoji)}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border transition-all ${
            mine ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white border-neutral-200 text-neutral-700 hover:border-neutral-400'
          }`}>
          <span>{emoji}</span><span>{count}</span>
        </button>
      ))}
      <div className="relative">
        <button onClick={() => setOpen(o => !o)}
          className="flex items-center px-1.5 py-0.5 rounded-full text-xs border border-dashed border-neutral-300 bg-white text-neutral-400 hover:text-neutral-600 hover:border-neutral-400 transition-colors">
          <Smile className="w-3 h-3" />
        </button>
        {open && (
          <div className="absolute bottom-7 left-0 flex gap-1.5 bg-white border border-neutral-200 rounded-2xl p-2.5 shadow-xl z-20">
            {REACTION_EMOJIS.map(e => (
              <button key={e} onClick={() => toggle(e)} className="text-lg hover:scale-125 transition-transform">
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
  const { wl, isWL } = useWhiteLabel();
  const { eventId: paramEventId, subdomain } = useParams();
  const navigate = useNavigate();
  const messagesEndRef   = useRef(null);
  const fileInputRef     = useRef(null);
  const typingTimeoutRef = useRef(null);

  const [eventId, setEventId]     = useState(paramEventId || null);
  const { alerts: secAlerts, addAlert: addSecAlert, dismissAlert: dismissSecAlert, dismissAll: dismissAllSecAlerts } = useSecurityAlerts();
  const [resolving, setResolving] = useState(!paramEventId && subdomain);

  const [needsJoin, setNeedsJoin] = useState(false);
  const [event, setEvent]         = useState(null);
  const [loading, setLoading]     = useState(true);
  const [activeTab, setActiveTab] = useState('chat');
  const [countdown, setCountdown] = useState(null);

  const [messages, setMessages]           = useState([]);
  const [messageInput, setMessageInput]   = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [typingUsers, setTypingUsers]     = useState([]);

  const [polls, setPolls]                 = useState([]);
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [newPoll, setNewPoll]             = useState({ question: '', options: ['', ''] });

  const [files, setFiles]                 = useState([]);
  const [uploadingFile, setUploadingFile] = useState(false);

  const [participants, setParticipants]   = useState([]);
  const [onlineUsers, setOnlineUsers]     = useState([]);
  const [rsvps, setRsvps]                 = useState([]);
  const [rsvpSummary, setRsvpSummary]     = useState({ yes: 0, maybe: 0, no: 0 });
  const [rsvpGuests, setRsvpGuests]       = useState([]);   // RSVP form submissions (external guests)
  const [rsvpGuestsLoaded, setRsvpGuestsLoaded] = useState(false);

  const [agenda, setAgenda]               = useState([]);
  const [showAddAgenda, setShowAddAgenda] = useState(false);
  const [newAgendaItem, setNewAgendaItem] = useState({ title: '', time: '', description: '', duration: '' });

  const [copied, setCopied]               = useState(false);
  const [showQR, setShowQR]               = useState(false);
  const [showSettings, setShowSettings]   = useState(false);
  const [showCasualAd, setShowCasualAd]   = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState(0); // live count of pending join requests
  const [waitlistCount, setWaitlistCount] = useState(0);

  const currentUser = localStorage.getItem('username');
  const isOrganizer = event?.organizerName === currentUser;
  const myRsvp      = rsvps.find(r => r.username === currentUser)?.status || null;

  const [searchParams]    = useSearchParams();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  useEffect(() => {
    if (!event) return;
    const isNewEvent = searchParams.get('new') === '1';
    if (!isNewEvent) return;
    if (event.isEnterpriseMode && !isOrganizer) return;
    const seenKey = `planit_onboarding_${event._id || eventId}`;
    if (!localStorage.getItem(seenKey)) {
      localStorage.setItem(seenKey, '1');
      setShowOnboarding(true);
    }
  }, [event, isOrganizer, searchParams, eventId]);

  // Show casual cross-platform ad 60s after landing in an event space
  useEffect(() => {
    if (!event) return;
    if (localStorage.getItem('xpa_planit_hidden')) return;
    const t = setTimeout(() => setShowCasualAd(true), 60000);
    return () => clearTimeout(t);
  }, [event]);

  useEffect(() => {
    if (isOrganizer && eventId) {
      eventAPI.getWaitlist(eventId).then(r => setWaitlistCount(r.data.count || 0)).catch(() => {});
    }
  }, [event, isOrganizer, eventId]);

  useEffect(() => {
    if (paramEventId) { setEventId(paramEventId); setResolving(false); }
    else if (subdomain) {
      setResolving(true);
      eventAPI.getBySubdomain(subdomain)
        .then(res => {
          const ev = res.data.event;
          // Table service venues: skip the event space entirely
          if (ev.isTableServiceMode) {
            navigate(`/e/${subdomain}/floor`, { replace: true });
            return;
          }
          setEventId(ev.id);
          setResolving(false);
        })
        .catch(() => { navigate('/not-found', { replace: true }); });
    } else { navigate('/'); }
  }, [paramEventId, subdomain]);

  useEffect(() => {
    if (!eventId || resolving) return;
    const token = localStorage.getItem('eventToken');
    if (!token) { setNeedsJoin(true); setLoading(false); return; }

    // Validate the stored token actually belongs to THIS event before trusting it.
    // A token for a different event must not grant access here.
    try {
      const base64 = token.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/');
      const decoded = base64 ? JSON.parse(atob(base64)) : null;
      // Check eventId match and token expiry
      const expired = decoded?.exp && decoded.exp * 1000 < Date.now();
      const wrongEvent = decoded?.eventId && decoded.eventId !== eventId;
      if (expired || wrongEvent || !decoded) {
        localStorage.removeItem('eventToken');
        localStorage.removeItem('username');
        setNeedsJoin(true);
        setLoading(false);
        return;
      }
    } catch {
      localStorage.removeItem('eventToken');
      localStorage.removeItem('username');
      setNeedsJoin(true);
      setLoading(false);
      return;
    }

    loadEvent();
  }, [eventId, resolving]);

  useEffect(() => {
    if (!event || !eventId) return;
    const token = localStorage.getItem('eventToken');
    if (!token) return;

    socketService.connect(token);
    socketService.joinEvent(eventId);

    socketService.on('new_message', (msg) => { setMessages(prev => [...prev, msg]); scrollToBottom(); });
    // Listen for organizer approval decision
    socketService.on('approval_request', ({ username }) => {
      if (isOrganizer) {
        setPendingApprovals(prev => prev + 1);
        toast(`🔔 ${username} is requesting to join`, {
          duration: 6000,
          icon: '👤',
          style: { fontWeight: 600 },
        });
      }
    });
    socketService.on('approval_approved', ({ username: approvedUser, token: newToken }) => {
      const myUsername = localStorage.getItem('username');
      // IMPORTANT: Only act on this if the current user is actually waiting at the
      // join gate (needsJoin=true). If the user is already inside the event
      // (organizer or any other participant), this event is for someone else and
      // we must NOT overwrite our own token — doing so would replace an organizer
      // token with a participant token, breaking all subsequent organizer-only calls.
      if (approvedUser === myUsername && newToken && needsJoin) {
        localStorage.setItem('eventToken', newToken);
        toast.success('Your join request was approved!');
        setNeedsJoin(false);
        setLoading(true);
        loadEvent();
      }
    });
    socketService.on('approval_rejected', ({ username: rejectedUser }) => {
      const myUsername = localStorage.getItem('username');
      // Same guard — only act if this user is actually waiting at the join gate
      if (rejectedUser === myUsername && needsJoin) {
        toast.error('Your join request was declined by the organizer.');
        setStep('name');
        setNeedsJoin(true);
      }
    });
    socketService.on('message_edited', ({ messageId, content }) =>
      setMessages(prev => prev.map(m => m.id === messageId || m._id === messageId ? { ...m, content, edited: true } : m)));
    socketService.on('message_deleted', ({ messageId }) =>
      setMessages(prev => prev.filter(m => m.id !== messageId && m._id !== messageId)));
    socketService.on('reaction_added', ({ messageId, emoji, username }) =>
      setMessages(prev => prev.map(m => {
        const id = m._id || m.id;
        if (id !== messageId) return m;
        return { ...m, reactions: [...(m.reactions || []), { emoji, username }] };
      })));
    socketService.on('reaction_removed', ({ messageId, emoji, username }) =>
      setMessages(prev => prev.map(m => {
        const id = m._id || m.id;
        if (id !== messageId) return m;
        return { ...m, reactions: (m.reactions || []).filter(r => !(r.emoji === emoji && r.username === username)) };
      })));
    socketService.on('user_typing', ({ username }) => {
      if (username !== currentUser) {
        setTypingUsers(prev => [...new Set([...prev, username])]);
        setTimeout(() => setTypingUsers(prev => prev.filter(u => u !== username)), 3000);
      }
    });
    socketService.on('poll_created',  (poll)    => setPolls(prev => [poll, ...prev]));
    socketService.on('poll_updated',  (updated) => setPolls(prev => prev.map(p => (p._id || p.id) === (updated._id || updated.id) ? updated : p)));
    socketService.on('poll_deleted',  ({ pollId }) => setPolls(prev => prev.filter(p => (p._id || p.id) !== pollId)));
    socketService.on('user_joined',   ({ username }) => setOnlineUsers(prev => [...new Set([...prev, username])]));
    socketService.on('user_left',     ({ username }) => setOnlineUsers(prev => prev.filter(u => u !== username)));
    socketService.on('participant_joined', ({ participants }) => setParticipants(participants));
    socketService.on('rsvp_updated', ({ rsvps, summary }) => {
      if (rsvps) setRsvps(rsvps);
      if (summary) setRsvpSummary(summary);
    });
    socketService.on('agenda_updated', ({ agenda }) => setAgenda([...agenda].sort((a, b) => a.order - b.order)));
    socketService.on('files_uploaded', ({ files: newFiles }) => setFiles(prev => [...newFiles, ...prev]));
    socketService.on('file_deleted',   ({ fileId }) => setFiles(prev => prev.filter(f => (f._id || f.id) !== fileId)));
    socketService.on('event_settings_updated', () => loadEvent());
    socketService.on('error', (error) => { if (error.message) toast.error(error.message); });
    socketService.on('rate_limited', ({ message, retryAfterMs }) => {
      toast.error(message, { duration: Math.min(retryAfterMs, 5000) });
      if (socketService._lastSentContent) {
        setMessageInput(socketService._lastSentContent);
        socketService._lastSentContent = null;
      }
    });
    socketService.on('rate_limit_warning', ({ message }) => toast(message, { duration: 3000 }));
    socketService.on('security_alert', addSecAlert);

    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      socketService.off('security_alert', addSecAlert);
      socketService.off('approval_request');
      socketService.leaveEvent(eventId);
      socketService.disconnect();
    };
  }, [event, eventId, needsJoin]); // needsJoin needed so the approval_approved/rejected guards use the latest value

  useEffect(() => {
    if (!event || !eventId) return;
    let delay = 10000;
    let timer;
    const poll = () => {
      if (!socketService.isConnected()) {
        chatAPI.getMessages(eventId).then(res => setMessages(res.data.messages || [])).catch(() => {});
        pollAPI.getAll(eventId).then(res => setPolls(res.data.polls || [])).catch(() => {});
        // back off up to 60s while disconnected to avoid hammering the API
        delay = Math.min(delay * 1.5, 60000);
      } else {
        delay = 10000; // reset when reconnected
      }
      timer = setTimeout(poll, delay);
    };
    timer = setTimeout(poll, delay);
    return () => clearTimeout(timer);
  }, [event, eventId]);

  useEffect(() => {
    if (!event?.date) return;
    const tick = () => {
      const diff = new Date(event.date) - new Date();
      if (diff <= 0) { setCountdown(null); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown({ d, h, m, s });
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [event?.date]);

  // Load RSVP form submissions (external guests who signed up via the public RSVP link)
  const loadRsvpGuests = async (eid) => {
    try {
      const r = await rsvpAPI.getSubmissions(eid || eventId, { limit: 500 });
      setRsvpGuests(r.data.submissions || []);
      setRsvpGuestsLoaded(true);
    } catch {
      // If organizer token isn't available (regular guest viewing), silently skip
      setRsvpGuestsLoaded(true);
    }
  };

  const loadEvent = async () => {
    try {
      const res = await eventAPI.getById(eventId);
      const ev  = res.data.event;

      // Table service venues have no event space — redirect straight to floor
      if (ev.isTableServiceMode) {
        navigate(ev.subdomain ? `/e/${ev.subdomain}/floor` : `/event/${eventId}/floor`, { replace: true });
        return;
      }

      setEvent(ev);
      setParticipants(ev.participants || []);
      setRsvps(ev.rsvps || []);
      setRsvpSummary(ev.rsvpSummary || { yes: 0, maybe: 0, no: 0 });
      setAgenda(ev.agenda ? [...ev.agenda].sort((a, b) => a.order - b.order) : []);
      await Promise.all([loadMessages(), loadPolls(), loadFiles(), loadRsvpGuests(eventId)]);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.removeItem('eventToken'); localStorage.removeItem('username');
        setNeedsJoin(true);
      } else { toast.error('Failed to load event'); navigate('/'); }
    } finally { setLoading(false); }
  };

  const handleJoined = () => { setNeedsJoin(false); setLoading(true); loadEvent(); };

  const loadMessages = async () => {
    try { const r = await chatAPI.getMessages(eventId); setMessages(r.data.messages || []); scrollToBottom(); } catch {}
  };
  const loadPolls  = async () => { try { const r = await pollAPI.getAll(eventId);  setPolls(r.data.polls   || []); } catch {} };
  const loadFiles  = async () => { try { const r = await fileAPI.getAll(eventId);  setFiles(r.data.files   || []); } catch {} };

  const scrollToBottom = () => setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);

  const handleMessageInputChange = (e) => {
    setMessageInput(e.target.value);
    if (socketService.isConnected()) {
      socketService.startTyping(eventId);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => socketService.stopTyping(eventId), 2000);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageInput.trim() || sendingMessage) return;
    const content = messageInput.trim();
    setMessageInput('');
    setSendingMessage(true);
    try {
      if (socketService.isConnected()) { socketService._lastSentContent = content; socketService.sendMessage(eventId, content); }
      else await chatAPI.sendMessage(eventId, { content, username: currentUser });
      socketService.stopTyping(eventId);
    } catch { toast.error('Failed to send message'); setMessageInput(content); }
    finally { setSendingMessage(false); }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!confirm('Delete this message?')) return;
    try {
      if (socketService.isConnected()) socketService.deleteMessage(eventId, messageId);
      else await chatAPI.deleteMessage(eventId, messageId, { username: currentUser });
    } catch { toast.error('Failed to delete'); }
  };

  const handleCreatePoll = async (e) => {
    e.preventDefault();
    const validOptions = newPoll.options.filter(o => o.trim());
    if (!newPoll.question.trim() || validOptions.length < 2) { toast.error('Need a question and at least 2 options'); return; }
    try {
      await pollAPI.create(eventId, { question: newPoll.question, options: validOptions });
      setShowCreatePoll(false); setNewPoll({ question: '', options: ['', ''] });
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
      const fd = new FormData(); fd.append('files', file); fd.append('uploadedBy', currentUser);
      try { await fileAPI.upload(eventId, fd); await loadFiles(); toast.success(`${file.name} uploaded`); }
      catch { toast.error(`Failed to upload ${file.name}`); }
    }
    setUploadingFile(false); fileInputRef.current.value = '';
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
      toast.success('RSVP updated');
    } catch { toast.error('Failed to update RSVP'); }
  };

  const handleAddAgendaItem = async (e) => {
    e.preventDefault();
    if (!newAgendaItem.title.trim()) return;
    try {
      await eventAPI.addAgendaItem(eventId, {
        title: newAgendaItem.title, time: newAgendaItem.time,
        description: newAgendaItem.description, duration: parseInt(newAgendaItem.duration) || 0
      });
      await loadEvent(); setShowAddAgenda(false);
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
    const end   = new Date(start.getTime() + 2 * 60 * 60 * 1000);
    const fmt = d => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const ics = [
      'BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//PlanIt//EN','BEGIN:VEVENT',
      `UID:${eventId}@planit`,`DTSTART:${fmt(start)}`,`DTEND:${fmt(end)}`,
      `SUMMARY:${event.title}`,
      event.description ? `DESCRIPTION:${event.description.replace(/\n/g, '\\n')}` : '',
      event.location ? `LOCATION:${event.location}` : '',
      `URL:${window.location.origin}/event/${eventId}`,
      'END:VEVENT','END:VCALENDAR'
    ].filter(Boolean).join('\r\n');
    const blob = new Blob([ics], { type: 'text/calendar' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href = url;
    a.download = `${event.title.replace(/\s+/g, '-').toLowerCase()}.ics`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    toast.success('Calendar file downloaded');
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/event/${eventId}`);
    setCopied(true); toast.success('Link copied');
    setTimeout(() => setCopied(false), 2000);
  };

  const settings = event?.settings || {};
  // WL feature flags — fall back to true (show everything) when not on a WL domain
  const wlFeatures = wl?.features || {};
  const wlShowGuestList = !isWL || wlFeatures.showGuestList !== false;
  const wlShowWaitlist  = !isWL || wlFeatures.showWaitlist  !== false;

  const tabs = [
    ...(settings.allowChat !== false        ? [{ id: 'chat',          label: 'Chat',    icon: MessageSquare, count: messages.length    }] : []),
    ...(settings.allowPolls !== false       ? [{ id: 'polls',         label: 'Polls',   icon: BarChart3,     count: polls.length       }] : []),
    ...(settings.allowFileSharing !== false ? [{ id: 'files',         label: 'Files',   icon: FileText,      count: files.length       }] : []),
    { id: 'agenda',        label: 'Agenda',   icon: Clock,       count: agenda.length   },
    ...(wlShowGuestList ? [{ id: 'people', label: 'People', icon: Users, count: participants.length + rsvpGuests.filter(g => g.response === 'yes' && g.status === 'confirmed').length }] : []),
    { id: 'tasks',         label: 'Tasks',    icon: CheckCircle2 },
    { id: 'announcements', label: 'Bulletin', icon: Megaphone    },
    { id: 'expenses',      label: 'Budget',   icon: DollarSign   },
    { id: 'notes',         label: 'Notes',    icon: StickyNote   },
    ...(isOrganizer && event?.isEnterpriseMode ? [{ id: 'analytics', label: 'Analytics', icon: BarChart3 }] : []),
    ...((!isWL || wlFeatures.showSocialShare !== false) ? [{ id: 'utilities', label: 'Share', icon: Share2 }] : []),
  ];

  useEffect(() => {
    if (tabs.length > 0 && !tabs.find(t => t.id === activeTab)) setActiveTab(tabs[0].id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.allowChat, settings.allowPolls, settings.allowFileSharing]);

  /* ── Gate / Loading ── */
  if (resolving || (loading && !event)) return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
      <span className="spinner w-5 h-5 border-2 border-neutral-200 border-t-neutral-500" />
    </div>
  );
  if (needsJoin) return <JoinGate eventId={eventId} onJoined={handleJoined} />;
  if (!event)   return null;
  if (loading)  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
      <span className="spinner w-5 h-5 border-2 border-neutral-200 border-t-neutral-500" />
    </div>
  );

  return (
    <>
    {showCasualAd && <CrossPlatformAd trigger="casual" onClose={() => setShowCasualAd(false)} />}
    <div className="min-h-screen flex flex-col" style={{ background: '#f7f7f9' }}>
      <DeletionWarningBanner eventId={eventId} />

      {showQR && <QRModal eventId={eventId} onClose={() => setShowQR(false)} />}
      {showSettings && isOrganizer && (
        <OrganizerSettings eventId={eventId} event={event}
          onClose={() => { setShowSettings(false); setPendingApprovals(0); }}
          onUpdated={() => loadEvent()}
          pendingCount={pendingApprovals} />
      )}
      {showOnboarding && (
        <Onboarding eventId={eventId} subdomain={event?.subdomain}
          isOrganizer={isOrganizer}
          isEnterprise={event?.isEnterpriseMode}
          isVenue={event?.isTableServiceMode}
          onClose={() => setShowOnboarding(false)} />
      )}

      {/* Cover banner */}
      {event?.coverImage && (
        <div className="w-full h-40 md:h-52 overflow-hidden flex-shrink-0 relative">
          <img src={event.coverImage} alt="Event cover" className="w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom,transparent 50%,#f7f7f9 100%)' }} />
        </div>
      )}

      {/* ── Header ── */}
      <header className="bg-white/95 backdrop-blur-md border-b border-neutral-200/60 sticky top-0 z-50">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <a href="/"
              className="w-8 h-8 rounded-lg bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center flex-shrink-0 transition-colors">
              <ArrowLeft className="w-3.5 h-3.5 text-neutral-600" />
            </a>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-neutral-900 truncate leading-tight">{event?.title}</h1>
              {countdown ? (
                <p className="text-[11px] font-semibold text-violet-600 truncate">
                  {countdown.d > 0 && `${countdown.d}d `}{String(countdown.h).padStart(2,'0')}:{String(countdown.m).padStart(2,'0')}:{String(countdown.s).padStart(2,'0')} to go
                </p>
              ) : (
                <p className="text-[11px] text-neutral-400 truncate">{formatDate(event?.date)}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Mobile sidebar toggle */}
            <button onClick={() => setShowMobileSidebar(true)} title="Event info"
              className="lg:hidden w-8 h-8 rounded-lg bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center transition-colors">
              <svg className="w-3.5 h-3.5 text-neutral-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h10M4 18h7" /></svg>
            </button>
            {onlineUsers.length > 0 && (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-bold text-emerald-700"
                style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.15)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-dot" />
                {onlineUsers.length} online
              </div>
            )}
            <button onClick={() => setShowQR(true)} title="QR Code"
              className="w-8 h-8 rounded-lg bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center transition-colors">
              <QrCode className="w-3.5 h-3.5 text-neutral-600" />
            </button>
            <button onClick={handleCopyLink} title="Copy link"
              className="w-8 h-8 rounded-lg bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center transition-colors">
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-neutral-600" />}
            </button>
            {isOrganizer && event?.isEnterpriseMode && (
              <button onClick={() => navigate(`/event/${eventId}/checkin`)}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors">
                <UserCheck className="w-3.5 h-3.5" />Check-in
              </button>
            )}
            {isOrganizer && wlShowWaitlist && (
              <button onClick={() => navigate(`/event/${eventId}/waitlist`)} title="Waitlist"
                className="relative w-8 h-8 rounded-lg bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center transition-colors">
                <ClipboardList className="w-3.5 h-3.5 text-neutral-600" />
                {waitlistCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {waitlistCount > 9 ? '9+' : waitlistCount}
                  </span>
                )}
              </button>
            )}
            <button title="Leave event"
              onClick={() => { localStorage.removeItem('eventToken'); localStorage.removeItem('username'); navigate('/'); }}
              className="w-8 h-8 rounded-lg bg-neutral-100 hover:bg-red-50 flex items-center justify-center transition-colors group">
              <LogOut className="w-3.5 h-3.5 text-neutral-500 group-hover:text-red-500 transition-colors" />
            </button>
            <a href="/help" title="Help Center"
              className="w-8 h-8 rounded-lg bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center transition-colors">
              <HelpCircle className="w-3.5 h-3.5 text-neutral-600" />
            </a>
          </div>
        </div>
      </header>

      {/* Mobile sidebar overlay */}
      {showMobileSidebar && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowMobileSidebar(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-80 max-w-[90vw] bg-white overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-100">
              <span className="text-sm font-bold text-neutral-900">Event Info</span>
              <button onClick={() => setShowMobileSidebar(false)} className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-4 space-y-3">{/* sidebar content injected below */}</div>
          </div>
        </div>
      )}

      <div className="flex-1 max-w-screen-2xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 flex gap-6">
        {/* ── Main panel ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">

          {/* Enterprise banner */}
          {event?.isEnterpriseMode && isOrganizer && (
            <div className="p-4 rounded-2xl flex items-center justify-between gap-4 text-white"
              style={{ background: 'linear-gradient(135deg,#1e3a5f,#1a1a2e)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                  <UserCheck className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Enterprise Mode</h3>
                  <p className="text-xs opacity-50">Manage guest invites and check-in</p>
                </div>
              </div>
              <button onClick={() => navigate(`/event/${eventId}/checkin`)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-white text-neutral-900 rounded-xl font-bold text-xs hover:bg-neutral-100 transition-colors flex-shrink-0">
                <UserCheck className="w-3.5 h-3.5" />Manage
              </button>
            </div>
          )}

          {/* Status banners */}
          {event?.status === 'cancelled' && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 border border-red-200">
              <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-red-800">This event has been cancelled</p>
                <p className="text-xs text-red-600 mt-0.5">New joins and RSVPs are disabled.</p>
              </div>
            </div>
          )}
          {event?.status === 'completed' && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-neutral-100 border border-neutral-200">
              <CheckCircle2 className="w-5 h-5 text-neutral-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-neutral-700">This event has ended</p>
                <p className="text-xs text-neutral-500 mt-0.5">Content is now read-only.</p>
              </div>
            </div>
          )}

          {/* Main content card */}
          <div className="bg-white rounded-2xl border border-neutral-200/80 overflow-hidden flex flex-col min-h-0"
            style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.05)', height: 'calc(100vh - 7rem)' }}>

            {/* ── Tabs ── */}
            <div className="flex border-b border-neutral-100 overflow-x-auto scrollbar-hide flex-shrink-0" style={{ background: '#fafafa' }}>
              {tabs.map(({ id, label, icon: Icon, count }) => (
                <button key={id} onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-1.5 px-3 sm:px-4 py-3 text-xs font-bold whitespace-nowrap transition-all border-b-2 flex-shrink-0 ${
                    activeTab === id
                      ? 'text-neutral-900 border-neutral-900 bg-white'
                      : 'text-neutral-500 border-transparent hover:text-neutral-800 hover:bg-white/60'
                  }`}>
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="hidden xs:inline sm:inline">{label}</span>
                  {count > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold leading-none ${
                      activeTab === id ? 'bg-neutral-900 text-white' : 'bg-neutral-200 text-neutral-500'
                    }`}>
                      {count > 99 ? '99+' : count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ── Chat ── */}
            {activeTab === 'chat' && (
              <div className="flex flex-col flex-1 min-h-0">
                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-16">
                      <div className="w-14 h-14 rounded-2xl bg-neutral-100 flex items-center justify-center mb-3">
                        <MessageSquare className="w-6 h-6 text-neutral-400" />
                      </div>
                      <p className="text-sm font-bold text-neutral-700">No messages yet</p>
                      <p className="text-xs text-neutral-400 mt-1">Be the first to say hello 👋</p>
                    </div>
                  ) : messages.map((msg) => {
                    const isMine = msg.username === currentUser;
                    const msgId  = msg._id || msg.id;
                    return (
                      <div key={msgId} className={`flex gap-2.5 group ${isMine ? 'flex-row-reverse' : ''}`}>
                        <Avatar name={msg.username} />
                        <div className={`max-w-[74%] flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                          <div className={`flex items-center gap-2 mb-1 ${isMine ? 'flex-row-reverse' : ''}`}>
                            <span className="text-xs font-bold text-neutral-700">{msg.username}</span>
                            <span className="text-[10px] text-neutral-400">{formatRelativeTime(msg.createdAt)}</span>
                            {msg.edited && <span className="text-[10px] text-neutral-300 italic">edited</span>}
                          </div>
                          <div className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                            isMine ? 'bg-neutral-900 text-white rounded-tr-sm' : 'bg-neutral-100 text-neutral-900 rounded-tl-sm'
                          }`}>
                            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                          </div>
                          <ReactionBar messageId={msgId} reactions={msg.reactions || []} currentUser={currentUser} eventId={eventId} />
                          {(isOrganizer || isMine) && (
                            <button onClick={() => handleDeleteMessage(msgId)}
                              className="text-[10px] text-neutral-400 hover:text-red-500 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {typingUsers.length > 0 && (
                    <p className="text-xs text-neutral-400 italic pl-9">
                      {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing…
                    </p>
                  )}
                  <div ref={messagesEndRef} />
                </div>
                <div className="border-t border-neutral-100 p-3.5">
                  <form onSubmit={handleSendMessage} className="flex gap-2">
                    <input type="text" value={messageInput} onChange={handleMessageInputChange}
                      placeholder="Send a message…" className="input flex-1 text-sm rounded-xl" maxLength={MAX_MESSAGE_LENGTH} />
                    <button type="submit" disabled={!messageInput.trim() || sendingMessage}
                      className="w-10 h-10 rounded-xl bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 flex items-center justify-center flex-shrink-0 transition-colors">
                      <Send className="w-4 h-4 text-white" />
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
                    <button onClick={() => setShowCreatePoll(true)} className="btn btn-secondary text-sm gap-1.5 rounded-xl">
                      <Plus className="w-4 h-4" />Create poll
                    </button>
                  ) : (
                    <div className="bg-white border border-neutral-200 rounded-2xl p-5 mb-5">
                      <h3 className="text-sm font-bold text-neutral-900 mb-4">New poll</h3>
                      <form onSubmit={handleCreatePoll} className="space-y-3">
                        <input type="text" value={newPoll.question}
                          onChange={e => setNewPoll({ ...newPoll, question: e.target.value })}
                          placeholder="What's your question?" className="input rounded-xl text-sm" required />
                        {newPoll.options.map((opt, i) => (
                          <div key={i} className="flex gap-2">
                            <input type="text" value={opt}
                              onChange={e => { const o = [...newPoll.options]; o[i] = e.target.value; setNewPoll({ ...newPoll, options: o }); }}
                              placeholder={`Option ${i + 1}`} className="input flex-1 text-sm rounded-xl" />
                            {newPoll.options.length > 2 && (
                              <button type="button" className="btn btn-secondary px-2.5 rounded-xl"
                                onClick={() => setNewPoll({ ...newPoll, options: newPoll.options.filter((_, idx) => idx !== i) })}>
                                <X className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        ))}
                        {newPoll.options.length < 10 && (
                          <button type="button" className="btn btn-ghost text-sm gap-1 rounded-xl"
                            onClick={() => setNewPoll({ ...newPoll, options: [...newPoll.options, ''] })}>
                            <Plus className="w-3.5 h-3.5" />Add option
                          </button>
                        )}
                        <div className="flex gap-2 pt-1">
                          <button type="submit" className="btn btn-primary text-sm rounded-xl">Create</button>
                          <button type="button" className="btn btn-secondary text-sm rounded-xl"
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
                    <div className="w-14 h-14 rounded-2xl bg-neutral-100 flex items-center justify-center mb-3">
                      <BarChart3 className="w-6 h-6 text-neutral-400" />
                    </div>
                    <p className="text-sm font-bold text-neutral-700">No polls yet</p>
                    <p className="text-xs text-neutral-400 mt-1">Create one to get the group's opinion</p>
                  </div>
                ) : polls.map(poll => {
                  const totalVotes = poll.options?.reduce((sum, o) => sum + (o.votes?.length || 0), 0) || 0;
                  const pollId = poll._id || poll.id;
                  return (
                    <div key={pollId} className="bg-white border border-neutral-200 rounded-2xl p-5 mb-4">
                      <div className="flex items-start justify-between mb-4">
                        <h3 className="text-sm font-bold text-neutral-900 pr-3 leading-snug">{poll.question}</h3>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide flex-shrink-0 ${
                          poll.status === 'closed' ? 'bg-neutral-100 text-neutral-500' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {poll.status === 'closed' ? 'Closed' : '● Active'}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {poll.options?.map((option, i) => {
                          const votes    = option.votes?.length || 0;
                          const pct      = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
                          const userVoted = option.votes?.some(v => v.username === currentUser);
                          return (
                            <button key={i} onClick={() => poll.status === 'active' && handleVote(pollId, i)}
                              disabled={poll.status === 'closed'}
                              className={`w-full text-left p-3.5 rounded-xl border-2 transition-all duration-150 relative overflow-hidden ${
                                userVoted ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 bg-white hover:border-neutral-400 text-neutral-900'
                              } ${poll.status === 'closed' ? 'cursor-default' : 'cursor-pointer'}`}>
                              <div className={`absolute inset-0 transition-all duration-700 ${userVoted ? 'bg-white/10' : 'bg-neutral-100'}`}
                                style={{ width: `${pct}%` }} />
                              <div className="relative flex items-center justify-between gap-2">
                                <span className="text-sm font-semibold">{option.text}</span>
                                <span className={`text-xs font-bold flex-shrink-0 ${userVoted ? 'text-white/70' : 'text-neutral-400'}`}>{pct}%</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-xs text-neutral-400">{totalVotes} vote{totalVotes !== 1 ? 's' : ''}</span>
                        {isOrganizer && poll.status === 'active' && (
                          <button onClick={() => handleClosePoll(pollId)}
                            className="text-xs text-neutral-500 hover:text-neutral-900 font-bold transition-colors">
                            Close poll
                          </button>
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
                  <button onClick={() => fileInputRef.current?.click()} disabled={uploadingFile}
                    className="btn btn-secondary text-sm gap-1.5 rounded-xl">
                    <Paperclip className="w-4 h-4" />{uploadingFile ? 'Uploading…' : 'Upload file'}
                  </button>
                </div>
                {files.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-neutral-100 flex items-center justify-center mb-3">
                      <FileText className="w-6 h-6 text-neutral-400" />
                    </div>
                    <p className="text-sm font-bold text-neutral-700">No files yet</p>
                    <p className="text-xs text-neutral-400 mt-1">Share documents, images, and more</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {files.map(file => {
                      const fid = file._id || file.id;
                      return (
                        <div key={fid} className="flex items-center justify-between p-4 bg-white border border-neutral-200 rounded-xl hover:border-neutral-300 transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 bg-neutral-100 rounded-xl flex items-center justify-center flex-shrink-0">
                              <FileText className="w-4.5 h-4.5 text-neutral-500" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-neutral-900 truncate">{file.filename}</p>
                              <p className="text-xs text-neutral-400">{formatFileSize(file.size)} · by {file.uploadedBy}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 ml-4 flex-shrink-0">
                            <button onClick={() => handleDownloadFile(fid, file.filename)}
                              className="w-8 h-8 rounded-lg bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center transition-colors">
                              <Download className="w-3.5 h-3.5 text-neutral-600" />
                            </button>
                            {(isOrganizer || file.uploadedBy === currentUser) && (
                              <button onClick={() => handleDeleteFile(fid)}
                                className="w-8 h-8 rounded-lg border border-red-200 hover:bg-red-50 flex items-center justify-center transition-colors">
                                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                              </button>
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
                      <button onClick={() => setShowAddAgenda(true)} className="btn btn-secondary text-sm gap-1.5 rounded-xl">
                        <Plus className="w-4 h-4" />Add agenda item
                      </button>
                    ) : (
                      <div className="bg-white border border-neutral-200 rounded-2xl p-5 mb-5">
                        <h3 className="text-sm font-bold text-neutral-900 mb-4">New agenda item</h3>
                        <form onSubmit={handleAddAgendaItem} className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-bold text-neutral-500 mb-1">Title</label>
                              <input type="text" className="input text-sm rounded-xl" placeholder="Opening remarks" required
                                value={newAgendaItem.title} onChange={e => setNewAgendaItem(p => ({ ...p, title: e.target.value }))} />
                            </div>
                            <div>
                              <label className="block text-xs font-bold text-neutral-500 mb-1">Time</label>
                              <input type="text" className="input text-sm rounded-xl" placeholder="9:00 AM"
                                value={newAgendaItem.time} onChange={e => setNewAgendaItem(p => ({ ...p, time: e.target.value }))} />
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-neutral-500 mb-1">Description (optional)</label>
                            <input type="text" className="input text-sm rounded-xl" placeholder="Brief description"
                              value={newAgendaItem.description} onChange={e => setNewAgendaItem(p => ({ ...p, description: e.target.value }))} />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-neutral-500 mb-1">Duration (min)</label>
                            <input type="number" className="input text-sm rounded-xl" placeholder="30" min="0"
                              value={newAgendaItem.duration} onChange={e => setNewAgendaItem(p => ({ ...p, duration: e.target.value }))} />
                          </div>
                          <div className="flex gap-2 pt-1">
                            <button type="submit" className="btn btn-primary text-sm rounded-xl">Add</button>
                            <button type="button" className="btn btn-secondary text-sm rounded-xl" onClick={() => setShowAddAgenda(false)}>Cancel</button>
                          </div>
                        </form>
                      </div>
                    )}
                  </div>
                )}
                {agenda.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-neutral-100 flex items-center justify-center mb-3">
                      <Clock className="w-6 h-6 text-neutral-400" />
                    </div>
                    <p className="text-sm font-bold text-neutral-700">No agenda yet</p>
                    {isOrganizer && <p className="text-xs text-neutral-400 mt-1">Add items to plan your schedule</p>}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {agenda.map((item, idx) => (
                      <div key={item.id || idx} className="flex items-start gap-4 p-4 bg-white border border-neutral-200 rounded-xl hover:border-neutral-300 transition-colors">
                        {item.time && (
                          <div className="flex-shrink-0 text-right min-w-14">
                            <p className="text-xs font-bold text-neutral-600 font-mono">{item.time}</p>
                            {item.duration > 0 && <p className="text-[10px] text-neutral-400">{item.duration}m</p>}
                          </div>
                        )}
                        <div className={`flex-1 min-w-0 ${item.time ? 'border-l-2 border-neutral-200 pl-4' : ''}`}>
                          <p className="text-sm font-semibold text-neutral-900">{item.title}</p>
                          {item.description && <p className="text-xs text-neutral-500 mt-0.5">{item.description}</p>}
                        </div>
                        {isOrganizer && (
                          <button onClick={() => handleDeleteAgendaItem(item.id)}
                            className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center transition-colors flex-shrink-0">
                            <Trash2 className="w-3.5 h-3.5 text-neutral-400 hover:text-red-500 transition-colors" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── People ── */}
            {activeTab === 'people' && (() => {
              // Merge both attendance sources into one live count
              const rsvpGoing    = rsvpGuests.filter(g => g.response === 'yes' && g.status === 'confirmed');
              const rsvpMaybe    = rsvpGuests.filter(g => g.response === 'maybe');
              const rsvpDeclined = rsvpGuests.filter(g => g.response === 'no');
              const rsvpPending  = rsvpGuests.filter(g => g.status === 'pending');
              const rsvpWaiting  = rsvpGuests.filter(g => g.status === 'waitlisted');

              // Combined "going" = confirmed RSVP guests + event-space participants who RSVPd yes
              const spaceGoingCount = rsvpSummary.yes || 0;
              const totalGoing      = rsvpGoing.length + spaceGoingCount;
              const totalMaybe      = rsvpMaybe.length + (rsvpSummary.maybe || 0);

              return (
              <div className="flex-1 overflow-y-auto p-4">

                {/* ── Live totals bar ── */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                    <span className="text-xs font-bold text-emerald-700">{totalGoing} going</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
                    <span className="text-xs font-bold text-amber-700">{totalMaybe} maybe</span>
                  </div>
                  {rsvpDeclined.length + (rsvpSummary.no || 0) > 0 && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-100 border border-neutral-200 rounded-lg">
                      <span className="text-xs font-bold text-neutral-500">{rsvpDeclined.length + (rsvpSummary.no || 0)} can't go</span>
                    </div>
                  )}
                  {rsvpPending.length > 0 && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg">
                      <span className="text-xs font-bold text-indigo-600">{rsvpPending.length} pending</span>
                    </div>
                  )}
                  {rsvpWaiting.length > 0 && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 border border-orange-200 rounded-lg">
                      <span className="text-xs font-bold text-orange-600">{rsvpWaiting.length} waitlisted</span>
                    </div>
                  )}
                </div>

                {/* ── How it works info banner ── */}
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl flex gap-2.5">
                  <HelpCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-blue-700 leading-relaxed space-y-0.5">
                    <p className="font-bold text-blue-800">Two ways people join this event</p>
                    <p><span className="font-semibold">Event Space Members</span> — joined via invite link or code, can chat and collaborate in real time.</p>
                    <p><span className="font-semibold">RSVP Form Guests</span> — signed up via the public RSVP page link, shown with their form response below.</p>
                    <p className="text-blue-600 mt-1">The "going" total above combines both groups.</p>
                  </div>
                </div>

                {/* ── Your RSVP ── */}
                <div className="mb-4 p-3.5 bg-white border border-neutral-200 rounded-xl">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2.5">Your RSVP (in this event space)</p>
                  <div className="flex gap-2">
                    {[
                      ['yes',   'Going',    myRsvp === 'yes'   ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-neutral-600 border-neutral-200 hover:border-emerald-300'],
                      ['maybe', 'Maybe',    myRsvp === 'maybe' ? 'bg-amber-500 text-white border-amber-500'     : 'bg-white text-neutral-600 border-neutral-200 hover:border-amber-300'],
                      ['no',    "Can't go", myRsvp === 'no'    ? 'bg-neutral-800 text-white border-neutral-800' : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'],
                    ].map(([status, label, cls]) => (
                      <button key={status} onClick={() => handleRsvp(status)}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg border-2 transition-all ${cls}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Event Space Members section ── */}
                <div className="mb-1">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2 px-0.5">
                    Event Space Members
                    <span className="ml-1.5 normal-case font-normal text-neutral-400">({participants.length})</span>
                  </p>
                  <div className="space-y-1.5">
                    {participants.map(p => {
                      const isOnline = onlineUsers.includes(p.username);
                      const isOrg    = p.role === 'organizer';
                      const isGuest  = p.role === 'guest' || !p.role || p.role === 'member';
                      const isPlanner = p.role === 'planner' || p.role === 'co-organizer';
                      const pRsvp    = rsvps.find(r => r.username === p.username);
                      return (
                        <div key={p.username} className="flex items-center gap-3 p-3 bg-white border border-neutral-200 rounded-xl hover:border-neutral-300 transition-colors">
                          <div className="relative flex-shrink-0">
                            <Avatar name={p.username} size="md" />
                            {isOnline && <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-sm font-bold text-neutral-900 truncate">{p.username}</p>

                              {/* Role badge */}
                              {isOrg && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-neutral-900 text-white text-[10px] font-bold">
                                  <Star className="w-2.5 h-2.5" />Organizer
                                </span>
                              )}
                              {isPlanner && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-indigo-100 text-indigo-700 text-[10px] font-bold">
                                  Planner
                                </span>
                              )}
                              {!isOrg && !isPlanner && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-neutral-100 text-neutral-500 text-[10px] font-bold">
                                  Guest
                                </span>
                              )}

                              {/* RSVP status for this space */}
                              {pRsvp ? (
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                                  pRsvp.status === 'yes'   ? 'bg-emerald-50 text-emerald-700' :
                                  pRsvp.status === 'maybe' ? 'bg-amber-50 text-amber-700'     :
                                  'bg-neutral-100 text-neutral-500'
                                }`}>
                                  {pRsvp.status === 'yes' ? '✓ Going' : pRsvp.status === 'maybe' ? '? Maybe' : '✗ Can\'t go'}
                                </span>
                              ) : (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-neutral-50 text-neutral-400">No response</span>
                              )}
                            </div>
                            <p className="text-xs text-neutral-400 mt-0.5">
                              {isOnline ? <span className="text-emerald-600 font-semibold">● Online now</span> : `Joined ${formatRelativeTime(p.joinedAt)}`}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    {participants.length === 0 && (
                      <p className="text-xs text-neutral-400 text-center py-4">No members yet</p>
                    )}
                  </div>
                </div>

                {/* ── RSVP Form Guests section ── */}
                <div className="mt-4">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-2 px-0.5">
                    RSVP Form Guests
                    <span className="ml-1.5 normal-case font-normal text-neutral-400">({rsvpGuests.length} via public RSVP page)</span>
                  </p>
                  {!rsvpGuestsLoaded ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-5 h-5 border-2 border-neutral-200 border-t-indigo-500 rounded-full animate-spin" />
                    </div>
                  ) : rsvpGuests.length === 0 ? (
                    <div className="p-4 bg-neutral-50 border border-dashed border-neutral-200 rounded-xl text-center">
                      <p className="text-xs text-neutral-400 leading-relaxed">
                        No one has signed up via the RSVP page yet.<br />
                        Share your RSVP link to start collecting responses.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {rsvpGuests.map(g => {
                        const name = [g.firstName, g.lastName].filter(Boolean).join(' ') || 'Anonymous';
                        const initials = [g.firstName?.[0], g.lastName?.[0]].filter(Boolean).join('') || '?';
                        const statusCfg = {
                          confirmed:  { dot: 'bg-emerald-500', badge: 'bg-emerald-50 text-emerald-700', label: 'Confirmed' },
                          pending:    { dot: 'bg-indigo-400',  badge: 'bg-indigo-50 text-indigo-700',   label: 'Pending approval' },
                          waitlisted: { dot: 'bg-orange-400',  badge: 'bg-orange-50 text-orange-700',   label: 'Waitlisted' },
                          declined:   { dot: 'bg-red-400',     badge: 'bg-red-50 text-red-700',         label: 'Declined' },
                        }[g.status] || { dot: 'bg-neutral-300', badge: 'bg-neutral-100 text-neutral-500', label: g.status };

                        const respCfg = {
                          yes:   { bg: 'bg-emerald-50 text-emerald-700', label: '✓ Attending' },
                          maybe: { bg: 'bg-amber-50 text-amber-700',     label: '? Maybe' },
                          no:    { bg: 'bg-neutral-100 text-neutral-500', label: '✗ Not attending' },
                        }[g.response] || { bg: 'bg-neutral-100 text-neutral-500', label: g.response };

                        return (
                          <div key={g._id} className="flex items-center gap-3 p-3 bg-white border border-neutral-200 rounded-xl hover:border-neutral-300 transition-colors">
                            {/* Avatar */}
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-400 to-indigo-500 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-bold text-white">{initials}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="text-sm font-bold text-neutral-900 truncate">{name}</p>
                                {/* RSVP form guest role tag */}
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-violet-50 text-violet-700 text-[10px] font-bold border border-violet-100">
                                  RSVP Guest
                                </span>
                                {/* Their response */}
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${respCfg.bg}`}>
                                  {respCfg.label}
                                </span>
                                {/* Approval status */}
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${statusCfg.badge}`}>
                                  {statusCfg.label}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                {g.email && <p className="text-xs text-neutral-400 truncate">{g.email}</p>}
                                {g.plusOnes > 0 && (
                                  <span className="text-[10px] text-neutral-400">+{g.plusOnes} guest{g.plusOnes > 1 ? 's' : ''}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>
              );
            })()}

            {/* ── Feature tabs ── */}
            {activeTab === 'tasks'         && <div className="flex-1 overflow-hidden"><Tasks        eventId={eventId} socket={socketService} /></div>}
            {activeTab === 'announcements' && <div className="flex-1 overflow-hidden"><Announcements eventId={eventId} socket={socketService} isOrganizer={isOrganizer} /></div>}
            {activeTab === 'expenses'      && <div className="flex-1 overflow-hidden"><Expenses      eventId={eventId} socket={socketService} isOrganizer={isOrganizer} /></div>}
            {activeTab === 'notes'         && <div className="flex-1 overflow-hidden"><Notes         eventId={eventId} socket={socketService} /></div>}
            {activeTab === 'analytics' && isOrganizer && <div className="flex-1 overflow-hidden"><Analytics eventId={eventId} /></div>}
            {activeTab === 'utilities' && (
              <div className="flex-1 overflow-hidden">
                <Utilities eventId={eventId} subdomain={event.subdomain} isOrganizer={isOrganizer} isEnterpriseMode={event?.isEnterpriseMode} />
              </div>
            )}
          </div>
        </div>

        {/* ── Sidebar ── */}
        <aside className="hidden lg:block w-72 xl:w-80 flex-shrink-0">
          <div className="sticky top-20 space-y-3">

            {event?.date && (
              <div className="bg-white rounded-2xl border border-neutral-200 p-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
                <Countdown eventDate={event.date} />
              </div>
            )}

            <div className="bg-white rounded-2xl border border-neutral-200 p-5 space-y-4" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <h3 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Event Info</h3>
              {event?.isEnterpriseMode && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-50 border border-indigo-200 rounded-lg text-xs font-bold text-indigo-700">
                  <Shield className="w-3 h-3" />Enterprise
                </div>
              )}
              {event?.date && (
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide">Date</p>
                  <p className="text-sm text-neutral-800 font-semibold">{formatDate(event.date)}</p>
                </div>
              )}
              {event?.location && (
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide">Location</p>
                  <p className="text-sm text-neutral-800 font-semibold">{event.location}</p>
                </div>
              )}
              {event?.description && (
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wide">About</p>
                  <p className="text-sm text-neutral-600 leading-relaxed line-clamp-4">{event.description}</p>
                </div>
              )}
              <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-neutral-50 border border-neutral-100">
                <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide">Members</span>
                <span className="text-sm font-bold text-neutral-900">
                  {participants.length}<span className="text-xs text-neutral-400 font-medium"> / {event?.maxParticipants || 100}</span>
                </span>
              </div>
              {rsvpGuests.length > 0 && (
                <div className="flex items-center justify-between py-2 px-4 rounded-xl bg-violet-50 border border-violet-100">
                  <span className="text-[10px] font-bold text-violet-600 uppercase tracking-wide">RSVP Guests</span>
                  <span className="text-sm font-bold text-violet-700">{rsvpGuests.length}</span>
                </div>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                  {(rsvpSummary.yes || 0) + rsvpGuests.filter(g => g.response === 'yes' && g.status === 'confirmed').length} going
                </span>
                <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
                  {(rsvpSummary.maybe || 0) + rsvpGuests.filter(g => g.response === 'maybe').length} maybe
                </span>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-neutral-200 p-4 space-y-2" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              {isOrganizer && (
                <>
                  <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest px-1 pt-1 pb-0.5">Organizer</p>
                  {event?.isEnterpriseMode && (
                    <button onClick={() => navigate(`/event/${eventId}/checkin`)}
                      className="flex items-center gap-2.5 w-full px-4 py-3 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors font-bold">
                      <UserCheck className="w-3.5 h-3.5 flex-shrink-0" />Guest Check-in
                    </button>
                  )}
                  <button onClick={() => setShowSettings(true)}
                    className="flex items-center gap-2.5 w-full px-4 py-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl transition-colors font-bold relative">
                    <Sliders className="w-3.5 h-3.5 flex-shrink-0" />Event Settings
                    {pendingApprovals > 0 && (
                      <span className="ml-auto flex items-center justify-center w-5 h-5 text-[10px] font-black bg-red-500 text-white rounded-full ring-2 ring-white">
                        {pendingApprovals > 9 ? '9+' : pendingApprovals}
                      </span>
                    )}
                  </button>
                  <button onClick={() => navigate(`/event/${eventId}/login`)}
                    className="flex items-center gap-2.5 w-full px-4 py-3 text-xs bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl transition-colors font-semibold">
                    <Lock className="w-3.5 h-3.5 flex-shrink-0" />Login on new device
                  </button>
                  <div className="border-t border-neutral-100 pt-1 mt-1" />
                </>
              )}
              {event?.subdomain && (
                <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/e/${event.subdomain}`); toast.success('Copied!'); }}
                  className="flex items-center gap-2.5 w-full px-4 py-2.5 text-xs bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-xl text-neutral-600 transition-colors">
                  <Copy className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate font-mono">Copy /e/{event.subdomain}</span>
                </button>
              )}
              <button onClick={handleCopyLink}
                className="flex items-center gap-2.5 w-full px-4 py-2.5 text-xs bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-xl text-neutral-600 transition-colors">
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" /> : <Copy className="w-3.5 h-3.5 flex-shrink-0" />}
                <span>{copied ? 'Copied!' : 'Copy event link'}</span>
              </button>
              <button onClick={handleCalendarExport}
                className="flex items-center gap-2.5 w-full px-4 py-2.5 text-xs bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-xl text-neutral-600 transition-colors">
                <Download className="w-3.5 h-3.5 flex-shrink-0" />Export to calendar
              </button>
              <button onClick={() => setShowQR(true)}
                className="flex items-center gap-2.5 w-full px-4 py-2.5 text-xs bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-xl text-neutral-600 transition-colors">
                <QrCode className="w-3.5 h-3.5 flex-shrink-0" />Show QR code
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-neutral-200 p-5" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
              <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mb-3">Need help?</p>
              <a href="mailto:planit.userhelp@gmail.com"
                className="flex items-center gap-2.5 w-full px-4 py-3 text-xs bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-xl text-neutral-600 hover:text-neutral-900 transition-colors mb-2">
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="truncate">planit.userhelp@gmail.com</span>
              </a>
              <a href="/help"
                className="flex items-center gap-2.5 w-full px-4 py-3 text-xs bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 rounded-xl text-neutral-600 hover:text-neutral-900 transition-colors">
                <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Help Center
              </a>
              <p className="text-[10px] text-neutral-400 mt-3 leading-relaxed">
                Contact us for capacity increases, event changes, or support.
              </p>
            </div>

          </div>
        </aside>
      </div>
    </div>
      <SecurityAlerts
        alerts={secAlerts}
        onDismiss={dismissSecAlert}
        onDismissAll={dismissAllSecAlerts}
      />
    </>
  );
}