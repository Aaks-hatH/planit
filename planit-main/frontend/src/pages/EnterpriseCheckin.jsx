import { Component, useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  QrCode, UserCheck, Users, X, ArrowLeft, Camera, CameraOff, Plus,
  Keyboard, AlertTriangle, Baby, User, Settings, Lock, Edit2, Trash2,
  Clock, CheckCircle2, Loader2, CheckCircle, Flag, AlertOctagon, XCircle, 
  Mail, Phone, Copy, ExternalLink, Share2, FileText, LogOut, Eye, EyeOff,
  TrendingUp, ScanLine, BarChart2, Info, Upload, Download, Star, Mic, Shield, MapPin, LayoutGrid, Home as HomeIcon, Search, ChevronDown,
} from 'lucide-react';
import { eventAPI } from '../services/api';
import { saveEventMeta, readEventMeta } from '../utils/offlineEvent';
import toast from '../utils/toast';
import ManagerOverrideDialog from '../components/ManagerOverrideDialog';
import SecuritySettingsPanel from '../components/SecuritySettingsPanel';
import socketService from '../services/socket';
import offlineCheckin from '../services/offlineCheckin';
import SecurityAlerts, { useSecurityAlerts } from '../components/SecurityAlerts';
import WalkieTalkieButton from '../components/WalkieTalkieButton';
import SeatingMap from '../components/SeatingMap';
import TableAssignmentPanel from '../components/TableAssignmentPanel';
import { useWalkieTalkie } from '../hooks/useWalkieTalkie';
import SetupWizard from '../components/SetupWizard';
import InstallBanner from '../components/InstallBanner';
import OfflineReadiness from '../components/OfflineReadiness';
import OfflineQueuePanel from '../components/OfflineQueuePanel';
import CheckinToolsMenu from '../components/CheckinToolsMenu';
import Sheet from '../components/ui/Sheet';
import QrScanner from '../components/QrScanner';
import { requestPersistentStorage } from '../utils/persistentStorage';
import { setUpdateBlocker } from '../utils/appUpdate';
import { SkeletonRows, SkeletonPage } from '../components/ui/Feedback';
import { supportMailto, makeRef } from '../utils/friendlyError';

// Guest rows rendered at a time. Thousands of rows at once is what makes the
// list janky; searching still covers the whole list, only rendering is windowed.
const GUEST_PAGE_SIZE = 50;

// Same shape the backend's /checkin-cache builds, so the offline cache can be
// refreshed from the /invites response we already have.
const inviteToSnapshot = async (inv) => {
  const pin = inv.securityPin && String(inv.securityPin).trim();
  return {
    code:       inv.inviteCode,
    name:       inv.guestName,
    email:      inv.guestEmail || '',
    groupSize:  inv.groupSize  || 1,
    adults:     inv.adults     || 1,
    children:   inv.children   || 0,
    checkedIn:  !!inv.checkedIn,
    checkedInAt: inv.checkedInAt || null,
    actualAttendees: inv.actualAttendees || 0,
    hasPin:     !!pin,
    // Only a salted hash is kept on the device so a PIN can be checked with no connection.
    pinHash:    pin ? await offlineCheckin.hashPin(inv.inviteCode, pin) : null,
    isBlocked:  !!inv.isBlocked,
    status:     inv.status     || 'active',
    notes:      inv.notes      || '',
    tableId:    inv.tableId    || null,
    tableLabel: inv.tableLabel || null,
    seatNumber: inv.seatNumber || null,
    tableType:  inv.tableType  || null,
    guestRole:  inv.guestRole  || 'GUEST',
  };
};

// Read-only stand-in for an invite, built from the on-device snapshot.
const snapshotToInvite = (g) => ({
  _id: `cached-${g.code}`,
  inviteCode: g.code,
  guestName: g.name || '',
  guestEmail: g.email || '',
  groupSize: g.groupSize, adults: g.adults, children: g.children,
  checkedIn: g.checkedIn, isBlocked: g.isBlocked, status: g.status,
  notes: g.notes, tableId: g.tableId, tableLabel: g.tableLabel,
  checkedInAt: g.checkedInAt || null,
  seatNumber: g.seatNumber || null,
  guestRole: g.guestRole || 'GUEST',
});

// Simple JWT decode (not for security — only for reading role/username from stored token)
function decodeJWT(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch { return null; }
}

// ── Guest role badge ──────────────────────────────────────────────────────
const ROLE_CONFIG = {
  VIP:     { label: 'VIP',     bg: 'bg-amber-100',   text: 'text-amber-800',   border: 'border-amber-300',   icon: Star  },
  SPEAKER: { label: 'SPEAKER', bg: 'bg-purple-100',  text: 'text-purple-800',  border: 'border-purple-300',  icon: Mic   },
  GUEST:   { label: 'GUEST',   bg: 'bg-neutral-100', text: 'text-neutral-600', border: 'border-neutral-200', icon: Shield },
};

function RoleBadge({ role, size = 'sm' }) {
  const cfg = ROLE_CONFIG[role] || ROLE_CONFIG.GUEST;
  const Icon = cfg.icon;
  const isSm = size === 'sm';
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border font-bold uppercase tracking-wide
      ${cfg.bg} ${cfg.text} ${cfg.border}
      ${isSm ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'}`}>
      <Icon className={isSm ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'} />
      {cfg.label}
    </span>
  );
}



// ═══════════════════════════════════════════════════════════════════════════
// HAPTIC FEEDBACK UTILITIES
// ═══════════════════════════════════════════════════════════════════════════
const triggerHaptic = (pattern) => {
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      console.log('Vibration not supported:', e);
    }
  }
};

const hapticSuccess = () => triggerHaptic(200); // Short vibration for success
const hapticError = () => triggerHaptic([200, 100, 200]); // Double vibration for error
const hapticWarning = () => triggerHaptic([100, 50, 100]); // Quick double for warning

// ═══════════════════════════════════════════════════════════════════════════
// ERROR BOUNDARY
// Without this, any exception while rendering this page unmounts the whole app and the
// door staff are left with a blank black screen and no idea why.
// ═══════════════════════════════════════════════════════════════════════════
class CheckinErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('[checkin] render crash:', error, info?.componentStack); }
  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const detail = `${error?.name || 'Error'}: ${error?.message || String(error)}`;
    const ref = makeRef();
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-6">
        <div className="w-full max-w-md text-center">
          <AlertTriangle className="w-14 h-14 text-amber-400 mx-auto mb-4" />
          <h1 className="text-white text-2xl font-black mb-2">Check-in hit a problem</h1>
          <p className="text-neutral-400 text-sm mb-5">
            Nothing was lost. Guests you admitted offline are saved on this device and will sync automatically.
          </p>
          <p className="text-neutral-300 text-sm mb-1 text-left"><b className="text-white">Why: </b>The check-in screen crashed unexpectedly and we don't know exactly why. It isn't something you did wrong.</p>
          <p className="text-neutral-300 text-sm mb-5 text-left"><b className="text-white">What to do: </b>Reload check-in. If it keeps happening, sign out and back in, then contact support.</p>
          <div className="flex flex-col gap-2">
            <button onClick={() => window.location.reload()} className="w-full bg-white text-neutral-900 font-black rounded-xl py-3">Reload check-in</button>
            <button
              onClick={() => { try { localStorage.removeItem('eventToken'); } catch {} window.location.reload(); }}
              className="w-full bg-neutral-800 text-neutral-200 font-semibold rounded-xl py-3 border border-neutral-700"
            >
              Sign out and log in again
            </button>
            <a
              href={supportMailto({ headline: 'Check-in crashed', ref: ref, details: `Reference: ${ref}\n${detail}\nPage: ${window.location.pathname}\nTime: ${new Date().toISOString()}\nBrowser: ${navigator.userAgent}` })}
              className="w-full text-center text-neutral-300 font-semibold rounded-xl py-3 border border-neutral-700"
            >
              Contact support
            </a>
            <p className="text-neutral-500 text-xs mt-1">Reference {ref}</p>
          </div>
        </div>
      </div>
    );
  }
}

// Reads the stored event token and says whether this device may use the check-in page.
// An expired token is tolerated while OFFLINE: the door must keep scanning, nobody can log in
// again without a connection, and the server re-checks every queued check-in when it syncs.
function readCheckinAuth(expectedEventId) {
  try {
    const token = localStorage.getItem('eventToken');
    if (!token) return { ready: false, role: null };
    const decoded = decodeJWT(token);
    if (!decoded) return { ready: false, role: null };
    if (decoded.role !== 'organizer' && decoded.role !== 'staff') return { ready: false, role: null, reason: 'wrong_role' };
    if (expectedEventId && decoded.eventId && !decoded.isAdminAccess && String(decoded.eventId) !== String(expectedEventId)) {
      return { ready: false, role: null, reason: 'other_event' };
    }
    if (decoded.exp && decoded.exp * 1000 < Date.now()) {
      if (navigator.onLine === false) return { ready: true, role: decoded.role, username: decoded.username, expired: true };
      return { ready: false, role: null, reason: 'expired' };
    }
    return { ready: true, role: decoded.role, username: decoded.username };
  } catch {
    return { ready: false, role: null };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// STAFF LOGIN SCREEN
// ═══════════════════════════════════════════════════════════════════════════
function StaffLoginScreen({ eventId, eventTitle, onLogin, onOrganizer, notice }) {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Say so up front when there is no connection: logging in needs the server, and a staff member who
  // has never logged in on this device must do that once while online.
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' && navigator.onLine === false);
  useEffect(() => {
    const down = () => setOffline(true);
    const up = () => setOffline(false);
    window.addEventListener('offline', down);
    window.addEventListener('online', up);
    return () => { window.removeEventListener('offline', down); window.removeEventListener('online', up); };
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username.trim() || !pin) { setError('Username and PIN are required'); return; }
    setLoading(true);
    setError('');
    try {
      const response = await eventAPI.staffLogin(eventId, username.trim(), pin);
      const { token, role } = response.data;
      // Preserve organiser token before staff login overwrites it — allows restoring on logout
      const existingToken = localStorage.getItem('eventToken');
      if (existingToken) {
        const existingDecoded = decodeJWT(existingToken);
        if (existingDecoded?.role === 'organizer') {
          localStorage.setItem(`_orgToken_${eventId}`, existingToken);
        }
      }
      localStorage.setItem('eventToken', token);
      onLogin({ token, role, username: response.data.username });
    } catch (err) {
      setError(
        !err.response
          ? 'No connection. Staff must log in once while online; after that scanning works offline.'
          : (err.response?.data?.error || 'Invalid username or PIN')
      );
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-6" data-field16="">
      <div className="w-full max-w-sm">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-neutral-800 border border-neutral-700 flex items-center justify-center">
            <ScanLine className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-white text-2xl font-black mb-1">Check-in Staff Login</h1>
          <p className="text-neutral-400 text-sm">{eventTitle || 'Event Check-in'}</p>
        </div>

        {offline && (
          <div role="status" data-testid="login-offline-notice" className="mb-4 bg-amber-900/30 border border-amber-700/60 rounded-xl px-4 py-3">
            <p className="text-sm text-amber-200 font-bold">You're offline</p>
            <p className="text-sm text-amber-200/90 mt-0.5">Staff must log in once while online. After that, scanning works offline on this device. Connect to the internet to log in.</p>
          </div>
        )}
        {notice && (
          <div className="mb-4 bg-amber-900/30 border border-amber-700/60 rounded-xl px-4 py-3">
            <p className="text-sm text-amber-200 font-medium">{notice}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Username</label>
            <input
              type="text"
              value={username}
              onChange={e => { setUsername(e.target.value); setError(''); }}
              placeholder="Your staff username"
              autoFocus
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="w-full bg-neutral-800 border border-neutral-700 text-white rounded-xl px-4 py-3 text-base focus:outline-none focus:border-neutral-500 placeholder-neutral-600"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">PIN</label>
            <div className="relative">
              <input
                type={showPin ? 'text' : 'password'}
                value={pin}
                onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 8)); setError(''); }}
                placeholder="4–8 digit PIN"
                inputMode="numeric"
                className="w-full bg-neutral-800 border border-neutral-700 text-white rounded-xl px-4 py-3 pr-12 text-base font-mono tracking-[0.3em] focus:outline-none focus:border-neutral-500 placeholder-neutral-600"
              />
              <button
                type="button"
                onClick={() => setShowPin(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
              >
                {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-900/40 border border-red-700 rounded-xl px-4 py-3">
              <p className="text-sm text-red-300 font-medium">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username.trim() || pin.length < 4}
            className="w-full bg-white text-neutral-900 font-black rounded-xl py-3 text-base hover:bg-neutral-100 transition-all disabled:opacity-40 disabled:cursor-not-allowed mt-2 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <UserCheck className="w-5 h-5" />}
            {loading ? 'Logging in...' : 'Log In to Check-in'}
          </button>
        </form>

        <p className="text-center text-xs text-neutral-600 mt-6">
          Contact your event organizer if you don't have a staff account
        </p>
        {onOrganizer && (
          <button type="button" onClick={onOrganizer} className="block mx-auto mt-3 text-xs text-neutral-500 underline underline-offset-2 hover:text-neutral-300">
            I'm the organizer — open the event
          </button>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SUCCESS SCREEN
// ═══════════════════════════════════════════════════════════════════════════
function AdmitSuccessScreen({ guest, tableInfo, onDone, onShowMap }) {
  const [countdown, setCountdown] = useState(5);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    hapticSuccess();
  }, []);

  useEffect(() => {
    if (paused) return;
    if (countdown <= 0) { onDone(); return; }
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, paused, onDone]);

  return (
    <div className="fixed inset-0 bg-emerald-600 z-50 flex flex-col items-center overflow-y-auto p-3 sm:p-8">
      <div className="max-w-3xl w-full my-auto bg-white rounded-lg overflow-hidden shadow-2xl">
        {/* Green status bar */}
        <div className="h-3 bg-emerald-600" />
        
        {/* Main content */}
        <div className="p-6 sm:p-12 text-center">
          {/* Checkmark circle */}
          <div className="mb-8">
            <div className="w-24 h-24 sm:w-32 sm:h-32 mx-auto rounded-full border-[6px] sm:border-8 border-emerald-600 flex items-center justify-center">
              <CheckCircle className="w-14 h-14 sm:w-20 sm:h-20 text-emerald-600" strokeWidth={3} />
            </div>
          </div>
          
          {/* Status text */}
          <div className="mb-8">
            <p className="text-sm font-bold text-emerald-600 uppercase tracking-widest mb-3">
               Pass Accepted
            </p>
            <h1 className="text-4xl sm:text-6xl font-bold text-neutral-900 mb-4">
              ADMITTED
            </h1>
            <p className="text-2xl sm:text-3xl font-semibold text-neutral-700 break-words">
              {guest.guestName}
            </p>
            {guest.guestRole && guest.guestRole !== 'GUEST' && (
              <div className="mt-3 flex justify-center">
                <RoleBadge role={guest.guestRole} size="md" />
              </div>
            )}

            {/* ── Table assignment callout ── */}
            {tableInfo && (
              <div className="mt-6 inline-flex flex-wrap justify-center max-w-full items-center gap-3 px-4 sm:px-5 py-3 bg-emerald-50 border-2 border-emerald-300 rounded-xl">
                <MapPin className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <div className="text-left">
                  <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Table Assignment</p>
                  <p className="text-lg font-black text-emerald-900">{tableInfo.label}</p>
                </div>
                {onShowMap && (
                  <button
                    onClick={onShowMap}
                    className="ml-2 px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 transition-all"
                  >
                    Show on Map
                  </button>
                )}
              </div>
            )}
          </div>
          
          {/* Passenger details */}
          <div className="border-t border-neutral-200 pt-8">
            <div className="flex justify-center gap-10 sm:gap-16 text-lg">
              <div>
                <p className="text-neutral-500 font-medium mb-1">Adults</p>
                <p className="text-4xl font-bold text-neutral-900">{guest.adults}</p>
              </div>
              {guest.children > 0 && (
                <div>
                  <p className="text-neutral-500 font-medium mb-1">Children</p>
                  <p className="text-4xl font-bold text-neutral-900">{guest.children}</p>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Footer */}
        <div className="bg-neutral-50 px-5 sm:px-12 py-4 sm:py-6 border-t border-neutral-200 flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
          <p className="text-sm text-neutral-500">
            {paused ? 'Screen paused — tap Done when ready' : `Auto-closing in ${countdown}s...`}
          </p>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden sm:inline text-xs text-neutral-400 font-medium tracking-wide">
              Powered by <span className="font-black text-neutral-600">Planit</span>
            </span>
            <div className="hidden sm:block w-px h-4 bg-neutral-200" />
            <button
              onClick={() => setPaused(v => !v)}
              className="flex-1 sm:flex-none px-4 py-3 sm:py-2 text-sm font-semibold text-neutral-600 border border-neutral-200 rounded-xl hover:bg-neutral-100 transition-all"
            >
              {paused ? 'Resume' : 'Keep Open'}
            </button>
            <button
              onClick={onDone}
              className="flex-1 sm:flex-none px-4 py-3 sm:py-2 text-sm font-semibold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DENY SCREEN
// ═══════════════════════════════════════════════════════════════════════════
function DenyScreen({ reason, message, details, onDone, canOverride, onOverride }) {
  const severityConfig = {
    critical: { bg: 'bg-red-600', text: 'ACCESS DENIED' },
    high: { bg: 'bg-orange-600', text: 'ACCESS DENIED' },
    medium: { bg: 'bg-yellow-500', text: 'VERIFY REQUIRED' },
  };
  const config = severityConfig[details?.severity] || severityConfig.critical;
  const IconComponent = details?.severity === 'medium' ? AlertTriangle : XCircle;

  useEffect(() => {
    if (details?.severity === 'critical' || details?.severity === 'high') {
      hapticError();
    } else {
      hapticWarning();
    }
  }, [details?.severity]);

  return (
    <div className={`fixed inset-0 ${config.bg} z-50 flex flex-col items-center overflow-y-auto p-3 sm:p-8`}>
      <div className="max-w-3xl w-full my-auto bg-white rounded-lg overflow-hidden shadow-2xl">
        {/* Status bar */}
        <div className={`h-3 ${config.bg}`} />
        
        {/* Main content */}
        <div className="p-6 sm:p-12">
          {/* Large X icon */}
          <div className="mb-8 text-center">
            <div className={`w-24 h-24 sm:w-32 sm:h-32 mx-auto rounded-full border-[6px] sm:border-8 ${
              details?.severity === 'critical' ? 'border-red-600' :
              details?.severity === 'high' ? 'border-orange-600' :
              'border-yellow-500'
            } flex items-center justify-center`}>
              <IconComponent className={`w-14 h-14 sm:w-20 sm:h-20 ${
                details?.severity === 'critical' ? 'text-red-600' :
                details?.severity === 'high' ? 'text-orange-600' :
                'text-yellow-500'
              }`} strokeWidth={3} />
            </div>
          </div>
          
          {/* Status text */}
          <div className="text-center mb-8">
            <p className={`text-sm font-bold uppercase tracking-widest mb-3 ${
              details?.severity === 'critical' ? 'text-red-600' :
              details?.severity === 'high' ? 'text-orange-600' :
              'text-yellow-600'
            }`}>
              {details?.severity === 'critical' ? 'Security Alert' :
               details?.severity === 'high' ? 'Entry Blocked' :
               'Verification Required'}
            </p>
            <h1 className="text-3xl sm:text-5xl font-bold text-neutral-900 mb-6 break-words">
              {config.text}
            </h1>
            <p className="text-xl sm:text-2xl font-semibold text-neutral-700 mb-6 sm:mb-8 break-words">
              {message || details?.displayMessage || 'Access denied'}
            </p>
          </div>
          
          {/* BLOCK REASONS - CLEAR AND PROMINENT */}
          <div className="bg-neutral-50 border-2 border-neutral-200 rounded-lg p-4 sm:p-6 mb-6 sm:mb-8">
            <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-4">
              Denial Information
            </p>
            
            <div className="space-y-4">
              {/* Primary Reason */}
              {details?.blockedReason && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-red-600 rounded-full mt-2 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-neutral-900 mb-1">Reason</p>
                    <p className="text-base sm:text-lg text-neutral-700 break-words">
                      {details.blockedReason.replace(/_/g, ' ').toUpperCase()}
                    </p>
                  </div>
                </div>
              )}
              
              {/* Check-in History */}
              {details?.checkedInAt && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-neutral-400 rounded-full mt-2 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-neutral-900 mb-1">Previous Check-In</p>
                    <p className="text-base sm:text-lg text-neutral-700 break-words">
                      {new Date(details.checkedInAt).toLocaleString()}
                    </p>
                    {details.checkedInBy && (
                      <p className="text-sm text-neutral-500 mt-1">
                        By: {details.checkedInBy}
                      </p>
                    )}
                  </div>
                </div>
              )}
              
              {/* Additional Details */}
              {details?.message && details.message !== message && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-neutral-400 rounded-full mt-2 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-neutral-900 mb-1">Details</p>
                    <p className="text-neutral-700">{details.message}</p>
                  </div>
                </div>
              )}
              
              {/* Capacity Info */}
              {details?.currentCapacity !== undefined && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-neutral-400 rounded-full mt-2 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-neutral-900 mb-1">Capacity Status</p>
                    <p className="text-base sm:text-lg text-neutral-700 break-words">
                      {details.currentCapacity} / {details.maxCapacity} attendees
                    </p>
                  </div>
                </div>
              )}
              
              {/* Trust Score */}
              {details?.trustScore !== undefined && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-neutral-400 rounded-full mt-2 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-neutral-900 mb-1">Trust Score</p>
                    <p className="text-base sm:text-lg text-neutral-700 break-words">
                      {details.trustScore} / {details.minimumRequired || 100}
                      {details.trustScore < (details.minimumRequired || 50) && 
                        <span className="text-red-600 ml-2">(Below Minimum)</span>
                      }
                    </p>
                  </div>
                </div>
              )}
              
              {/* Lockdown Reason */}
              {details?.lockdownReason && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-red-600 rounded-full mt-2 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-neutral-900 mb-1">Lockdown Active</p>
                    <p className="text-base sm:text-lg text-neutral-700 break-words">{details.lockdownReason}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Action buttons */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-4">
            <button 
              onClick={onDone} 
              className="flex-1 px-4 sm:px-8 py-4 bg-neutral-200 text-neutral-900 text-lg sm:text-xl font-bold rounded-lg hover:bg-neutral-300 transition-all"
            >
              Close
            </button>
            {canOverride && (
              <button 
                onClick={onOverride} 
                className="flex-1 px-4 sm:px-8 py-4 bg-white text-neutral-900 text-lg sm:text-xl font-bold rounded-lg hover:bg-neutral-100 transition-all border-2 border-neutral-900"
              >
                Manager Override
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// BOARDING PASS — Professional, high-readability
// ═══════════════════════════════════════════════════════════════════════════

const ROLE_ACCENT = {
  VIP:     { bar: '#92400e', bg: '#92400e', textColor: '#ffffff', label: 'VIP'     },
  SPEAKER: { bar: '#1e1b4b', bg: '#1e1b4b', textColor: '#ffffff', label: 'SPEAKER' },
  GUEST:   { bar: '#171717', bg: '#171717', textColor: '#ffffff', label: 'GUEST'   },
};

function BoardingPass({ guest, security, requiresPin, staffNote, onAdmit, onDeny, onPinVerify }) {
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [verifyingPin, setVerifyingPin] = useState(false);
  const [pinVerified, setPinVerified] = useState(false);

  const hasWarnings = security?.warnings?.length > 0 || security?.flags?.length > 0;
  const trustScore  = security?.trustScore ?? 100;
  const role        = guest.guestRole || 'GUEST';
  const accent      = ROLE_ACCENT[role] || ROLE_ACCENT.GUEST;

  const trustColor = trustScore >= 80 ? '#15803d' : trustScore >= 50 ? '#b45309' : '#b91c1c';
  const seatValue  = guest.seatNumber || (guest.tableType ? guest.tableType.toUpperCase() : null);

  const handlePinSubmit = async () => {
    if (!pin.trim()) { setPinError('PIN is required'); return; }
    setVerifyingPin(true);
    setPinError('');
    try {
      await onPinVerify(pin);
      setPinVerified(true);
      setPin('');
    } catch (err) {
      setPinError(err.message || 'Invalid PIN');
    } finally {
      setVerifyingPin(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 z-50 flex items-start justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white w-full max-w-xl my-auto border-2 border-neutral-900 overflow-clip">

        {/* ── ROLE BAND — first thing eyes land on ──────────────────── */}
        <div className="flex items-center justify-between gap-3 px-5 sm:px-8 py-3" style={{ backgroundColor: accent.bg }}>
          <span className="text-xs font-black uppercase tracking-[0.15em] sm:tracking-[0.25em]" style={{ color: accent.textColor, opacity: 0.75 }}>
            Access Pass
          </span>
          <span className="text-sm font-black uppercase tracking-[0.15em] sm:tracking-[0.25em]" style={{ color: accent.textColor }}>
            {accent.label}
          </span>
        </div>

        {/* ── NAME BLOCK — dominant, readable at arm's length ───────── */}
        <div className="px-5 sm:px-8 pt-7 pb-6 border-b-2 border-neutral-900">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-400 mb-2">Attendee Name</p>
          <h2 className="text-4xl sm:text-5xl font-black text-neutral-900 leading-none tracking-tight break-words">
            {guest.guestName}
          </h2>
          {(guest.guestEmail || guest.guestPhone) && (
            <p className="text-sm text-neutral-500 font-mono mt-3 leading-relaxed">
              {guest.guestEmail}
              {guest.guestEmail && guest.guestPhone && <span className="mx-2 text-neutral-300">|</span>}
              {guest.guestPhone}
            </p>
          )}
        </div>

        {/* ── 2×2 DATA GRID — large labels, large values ────────────── */}
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] border-b-2 border-neutral-900">
          {/* Adults */}
          <div className="px-5 sm:px-8 py-5 border-r-2 border-b-2 border-neutral-900">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-400 mb-1.5">Adults</p>
            <p className="text-3xl sm:text-4xl font-black break-words text-neutral-900 leading-none">{guest.adults ?? 1}</p>
          </div>
          {/* Children */}
          <div className="px-5 sm:px-8 py-5 border-b-2 border-neutral-900">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-400 mb-1.5">Children</p>
            <p className="text-3xl sm:text-4xl font-black break-words text-neutral-900 leading-none">{guest.children ?? 0}</p>
          </div>
          {/* Table */}
          <div className="px-5 sm:px-8 py-5 border-r-2 border-neutral-900">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-400 mb-1.5">Table</p>
            <p className={`text-3xl sm:text-4xl font-black break-words leading-none ${guest.tableLabel ? 'text-neutral-900' : 'text-neutral-300'}`}>
              {guest.tableLabel || '—'}
            </p>
          </div>
          {/* Seat */}
          <div className="px-5 sm:px-8 py-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-400 mb-1.5">Seat</p>
            <p className={`text-3xl sm:text-4xl font-black break-words leading-none ${seatValue ? 'text-neutral-900' : 'text-neutral-300'}`}>
              {seatValue || '—'}
            </p>
          </div>
        </div>

        {/* ── CONFIRMATION CODE + TRUST ──────────────────────────────── */}
        <div className="flex items-stretch border-b-2 border-neutral-900">
          <div className="flex-1 min-w-0 px-5 sm:px-8 py-5 border-r-2 border-neutral-900">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-400 mb-1.5">Confirmation Code</p>
            <p className="text-lg sm:text-2xl font-black font-mono tracking-[0.1em] sm:tracking-[0.15em] text-neutral-900 break-all">{guest.inviteCode}</p>
          </div>
          <div className="flex-shrink-0 px-5 sm:px-8 py-5">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-400 mb-1.5">Trust Score</p>
            <p className="text-2xl font-black leading-none" style={{ color: trustColor }}>{trustScore}<span className="text-sm font-bold text-neutral-300 ml-0.5">/100</span></p>
          </div>
        </div>

        {/* ── NOTES ─────────────────────────────────────────────────── */}
        {guest.notes && (
          <div className="px-5 sm:px-8 py-5 border-b-2 border-neutral-900 bg-neutral-50">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-500 mb-2">Notes</p>
            <p className="text-base text-neutral-800 leading-relaxed">{guest.notes}</p>
          </div>
        )}

        {/* ── SECURITY WARNINGS ─────────────────────────────────────── */}
        {hasWarnings && (
          <div className="border-b-2 border-neutral-900">
            <div className="bg-amber-400 px-5 sm:px-8 py-3 flex items-center justify-between">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-neutral-900">Security Alert</p>
              <AlertTriangle className="w-4 h-4 text-neutral-900" />
            </div>
            <div className="divide-y divide-neutral-200">
              {security?.warnings?.map((w, i) => (
                <div key={i} className="px-5 sm:px-8 py-4 border-l-4 border-amber-400 bg-amber-50">
                  <p className="text-sm font-black uppercase tracking-wide text-neutral-900 mb-1">
                    {w.type?.replace(/_/g, ' ')}
                  </p>
                  <p className="text-base text-neutral-700 leading-snug">{w.message}</p>
                </div>
              ))}
              {security?.flags?.map((f, i) => (
                <div key={i} className="px-5 sm:px-8 py-4 border-l-4 border-amber-400 bg-amber-50">
                  <p className="text-sm font-black uppercase tracking-wide text-neutral-900 mb-1">
                    {f.flag?.replace(/_/g, ' ')}
                  </p>
                  {f.notes && <p className="text-base text-neutral-700 leading-snug">{f.notes}</p>}
                  <p className="text-xs text-neutral-500 font-mono mt-1.5">
                    {new Date(f.flaggedAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── PIN VERIFICATION ──────────────────────────────────────── */}
        {requiresPin && guest.hasPin && (
          <div className="border-b-2 border-neutral-900">
            <div className="bg-neutral-900 px-5 sm:px-8 py-3 flex items-center justify-between">
              <p className="text-sm font-black uppercase tracking-[0.18em] text-white">PIN Required</p>
              <Lock className="w-4 h-4 text-neutral-400" />
            </div>
            <div className="px-5 sm:px-8 py-6">
              <p className="text-sm text-neutral-600 mb-4 font-medium">
                Ask the attendee for their security PIN before proceeding.
              </p>
              <div className="flex gap-0">
                <input
                  type="text"
                  value={pin}
                  onChange={e => { setPin(e.target.value.toUpperCase()); setPinError(''); }}
                  placeholder="ENTER PIN"
                  className="flex-1 min-w-0 border-2 border-neutral-900 px-3 sm:px-4 py-3 text-xl font-black font-mono uppercase tracking-[0.2em] focus:outline-none bg-white placeholder-neutral-300"
                  maxLength={6}
                />
                <button
                  onClick={handlePinSubmit}
                  disabled={verifyingPin}
                  className="px-6 py-3 bg-neutral-900 text-white font-black text-xs uppercase tracking-widest hover:bg-neutral-700 transition-colors disabled:opacity-40 border-2 border-neutral-900 border-l-0"
                >
                  {verifyingPin ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify'}
                </button>
              </div>
              {pinError && (
                <p className="text-sm text-red-700 font-bold mt-3">{pinError}</p>
              )}
              {pinVerified && (
                <p className="text-sm font-bold mt-3" style={{ color: '#15803d' }}>
                  PIN Verified — proceed to admit.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── STAFF INSTRUCTIONS ────────────────────────────────────── */}
        {staffNote && (
          <div className="border-b-2 border-neutral-900 bg-neutral-900">
            <div className="px-5 sm:px-8 py-3 flex items-center justify-between border-b border-neutral-700">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-neutral-300">Staff Instructions</p>
              <Info className="w-3.5 h-3.5 text-neutral-400" />
            </div>
            <div className="px-5 sm:px-8 py-4">
              <p className="text-base text-white leading-relaxed font-medium">{staffNote}</p>
            </div>
          </div>
        )}

        {/* ── ACTION BUTTONS ────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sticky bottom-0 bg-white pb-[env(safe-area-inset-bottom)]">
          <button
            onClick={onDeny}
            className="py-6 bg-white text-neutral-900 text-base font-black uppercase tracking-widest border-r-2 border-neutral-900 hover:bg-neutral-100 active:bg-neutral-200 transition-colors"
          >
            Deny Entry
          </button>
          <button
            onClick={onAdmit}
            disabled={requiresPin && guest.hasPin && !pinVerified}
            className="py-6 bg-neutral-900 text-white text-base font-black uppercase tracking-widest hover:bg-neutral-800 active:bg-black transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
          >
            Admit
          </button>
        </div>

      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// QR SCANNER WITH HTML5-QRCODE
// ═══════════════════════════════════════════════════════════════════════════
function QRScanner({ onScan, onClose }) {
  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div
        className="flex items-center justify-between px-4 pb-3 bg-black/80 backdrop-blur-sm border-b border-white/10"
        style={{
          paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))',
          paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
          paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))',
        }}
      >
        <button onClick={onClose} className="text-white flex items-center gap-2 -ml-2 px-3 py-2.5 min-h-[44px] rounded-xl active:bg-white/10 hover:opacity-80">
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>
        <span className="text-white text-sm font-semibold">SCAN QR CODE</span>
        <div className="w-16" />
      </div>

      <div className="flex-1 overflow-auto flex items-center justify-center bg-black">
        <div className="w-full max-w-md px-4 py-4">
          <QrScanner onScan={onScan} />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// INVITE DIALOG WITH LINK COPYING
// ═══════════════════════════════════════════════════════════════════════════
function InviteDialog({ invite, eventId, event, tables = [], onClose, onSave }) {
  const [formData, setFormData] = useState({
    guestName: invite?.guestName || '',
    guestEmail: invite?.guestEmail || '',
    guestPhone: invite?.guestPhone || '',
    guestRole: invite?.guestRole || 'GUEST',
    adults: invite?.adults || 1,
    children: invite?.children || 0,
    notes: invite?.notes || '',
    securityPin: invite?.securityPin || '',
    tableId: invite?.tableId || '',
    seatNumber: invite?.seatNumber || '',
  });
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [createdInvite, setCreatedInvite] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.guestName.trim()) {
      toast.error('Guest name is required');
      return;
    }
    if (!formData.guestEmail.trim()) {
      toast.error('Email is required — it is used for duplicate detection and sending invite links');
      return;
    }
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(formData.guestEmail.trim())) {
      toast.error('Please enter a valid email address');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...formData,
        tableId: formData.tableId || null,
        seatNumber: formData.tableId ? (formData.seatNumber.trim() || null) : null,
      };
      if (invite) {
        await eventAPI.updateInvite(eventId, invite._id, payload);
        toast.success('Invite updated');
        onSave();
      } else {
        const response = await eventAPI.createInvite(eventId, payload);
        const newInvite = response.data.invites?.[0] || response.data.invite || response.data;
        setCreatedInvite(newInvite);
        setShowSuccess(true);
        toast.success('Invite created!');
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save invite');
    } finally {
      setSaving(false);
    }
  };

  const getInviteLink = () => {
    if (!createdInvite) return '';
    const baseUrl = window.location.origin;
    return `${baseUrl}/invite/${createdInvite.inviteCode}`;
  };

  const copyInviteLink = () => {
    const link = getInviteLink();
    navigator.clipboard.writeText(link);
    toast.success('Invite link copied!');
  };

  const getQRCodeUrl = () => {
    if (!createdInvite) return '';
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
    return `${apiBase}/events/invite/${createdInvite.inviteCode}/qr.svg`;
  };

  const field = 'min-h-[48px] sm:min-h-[44px] border border-neutral-200 rounded-xl px-4 py-2.5 bg-white focus:outline-none focus:border-neutral-400';
  const fw = `${field} w-full`;
  const lbl = 'block text-sm font-semibold text-neutral-800 mb-1.5';
  const hint = 'text-sm sm:text-xs text-neutral-500 mt-1.5 leading-snug';

  if (showSuccess && createdInvite) {
    const finish = () => { setShowSuccess(false); setCreatedInvite(null); onSave(); };
    return (
      <Sheet
        open
        onClose={finish}
        title="Invite created"
        subtitle={`Send this link to ${formData.guestName}`}
        size="md"
        footer={(
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <button onClick={finish} className="min-h-[48px] flex-1 rounded-xl bg-neutral-900 px-4 font-semibold text-white hover:bg-black">
              Done
            </button>
            <button
              onClick={() => {
                const link = getInviteLink();
                const guestEmail = formData.guestEmail?.trim();
                const emailBody = `Hi ${formData.guestName},\n\nYou have been personally invited to ${event?.title}.\n\nUse this link to join and access your QR check-in code:\n${link}\n\nWe look forward to seeing you there!`;
                if (navigator.share && !guestEmail) {
                  navigator.share({ title: `Invite to ${event?.title}`, text: `You're invited!`, url: link });
                } else {
                  window.open(`mailto:${guestEmail || ''}?subject=${encodeURIComponent(`You're invited: ${event?.title}`)}&body=${encodeURIComponent(emailBody)}`);
                }
              }}
              className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl border border-neutral-200 px-4 font-semibold hover:bg-neutral-50"
            >
              <Mail className="h-4 w-4" />
              {formData.guestEmail ? 'Send invite email' : 'Share invite'}
            </button>
          </div>
        )}
      >
        <div className="mb-4 rounded-2xl bg-neutral-50 p-5 text-center">
          <CheckCircle className="mx-auto mb-3 h-10 w-10 text-emerald-600" />
          <img src={getQRCodeUrl()} alt="QR code for this invite" className="mx-auto mb-3 h-auto w-44" />
          <p className="font-mono text-lg font-bold tracking-wider">{createdInvite.inviteCode}</p>
        </div>
        <label className={lbl} htmlFor="invite-link">Invite link</label>
        <div className="flex gap-2">
          <input id="invite-link" type="text" value={getInviteLink()} readOnly onFocus={(e) => e.target.select()} className={`${field} min-w-0 flex-1 bg-neutral-50 font-mono text-sm`} />
          <button onClick={copyInviteLink} className="flex min-h-[48px] flex-shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-4 font-semibold text-white hover:bg-blue-700 sm:min-h-[44px]">
            <Copy className="h-4 w-4" />
            Copy
          </button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={invite ? 'Edit invite' : 'Create invite'}
      subtitle="Guest details, role and seating"
      size="lg"
      footer={(
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="min-h-[48px] flex-1 rounded-xl border border-neutral-200 px-4 font-semibold hover:bg-neutral-50">
            Cancel
          </button>
          <button type="submit" form="invite-form" disabled={saving} className="min-h-[48px] flex-1 rounded-xl bg-neutral-900 px-4 font-semibold text-white hover:bg-black disabled:opacity-50">
            {saving ? 'Saving…' : invite ? 'Update' : 'Create'}
          </button>
        </div>
      )}
    >
      <form id="invite-form" onSubmit={handleSubmit} className="space-y-5 pt-1">
        <div>
          <label className={lbl} htmlFor="invite-name">Guest name <span className="text-red-500">*</span></label>
          <input
            id="invite-name"
            type="text"
            value={formData.guestName}
            onChange={(e) => setFormData({ ...formData, guestName: e.target.value })}
            className={fw}
            placeholder="John Smith"
            autoComplete="off"
            required
          />
        </div>

        {/* Role picker */}
        <div>
          <span className={lbl}>Guest role</span>
          <div className="grid grid-cols-3 gap-2">
            {['GUEST', 'VIP', 'SPEAKER'].map(role => {
              const cfg = ROLE_CONFIG[role];
              const Icon = cfg.icon;
              const active = formData.guestRole === role;
              return (
                <button
                  key={role}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setFormData({ ...formData, guestRole: role })}
                  className={`flex min-h-[64px] flex-col items-center justify-center gap-1.5 rounded-xl border-2 text-xs font-bold uppercase tracking-wide transition-all
                    ${active ? `${cfg.bg} ${cfg.text} ${cfg.border} shadow-sm` : 'border-neutral-200 text-neutral-500 hover:border-neutral-300'}`}
                >
                  <Icon className="h-4 w-4" />
                  {role}
                </button>
              );
            })}
          </div>
          <p className={hint}>Shown to staff at check-in and printed on their pass. Defaults to Guest.</p>
        </div>

        {/* Table + seat (only once a floor plan has tables) */}
        {tables.length > 0 && (
          <div>
            <label className={lbl} htmlFor="invite-table">Table <span className="text-xs font-normal text-neutral-500">(optional)</span></label>
            <div className="flex gap-2">
              <select
                id="invite-table"
                value={formData.tableId}
                onChange={(e) => setFormData({ ...formData, tableId: e.target.value, seatNumber: '' })}
                className={`${field} min-w-0 flex-1`}
              >
                <option value="">No table yet</option>
                {[...tables]
                  .map(t => ({ id: t.id, label: (t.label && t.label.trim()) || (t.type ? t.type.charAt(0).toUpperCase() + t.type.slice(1) : 'Table'), capacity: t.capacity }))
                  .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }))
                  .map(t => (
                    <option key={t.id} value={t.id}>{t.label}{t.capacity ? ` · seats ${t.capacity}` : ''}</option>
                  ))}
              </select>
              <input
                type="text"
                aria-label="Seat"
                value={formData.seatNumber}
                onChange={(e) => setFormData({ ...formData, seatNumber: e.target.value.slice(0, 20) })}
                disabled={!formData.tableId}
                placeholder="Seat"
                className={`${field} w-24 flex-shrink-0 disabled:bg-neutral-50 disabled:text-neutral-300`}
              />
            </div>
            <p className={hint}>Shows on the guest&apos;s pass. Seat is optional. Use <span className="font-semibold">Assign</span> to seat many guests at once.</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={lbl} htmlFor="invite-adults">Adults</label>
            <input
              id="invite-adults"
              type="number"
              inputMode="numeric"
              value={formData.adults}
              onChange={(e) => setFormData({ ...formData, adults: parseInt(e.target.value) || 0 })}
              className={fw}
              min="0"
            />
          </div>
          <div>
            <label className={lbl} htmlFor="invite-children">Children</label>
            <input
              id="invite-children"
              type="number"
              inputMode="numeric"
              value={formData.children}
              onChange={(e) => setFormData({ ...formData, children: parseInt(e.target.value) || 0 })}
              className={fw}
              min="0"
            />
          </div>
        </div>

        <div>
          <label className={lbl} htmlFor="invite-email">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            id="invite-email"
            type="email"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            value={formData.guestEmail}
            onChange={(e) => setFormData({ ...formData, guestEmail: e.target.value })}
            className={fw}
            placeholder="john@email.com"
            required
          />
          <p className={`${hint} flex items-start gap-1.5`}>
            <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span>Used for duplicate detection and sending invite links. PlanIt does not auto-send emails. Use the Share button after saving.</span>
          </p>
        </div>

        <div>
          <label className={lbl} htmlFor="invite-phone">Phone <span className="text-xs font-normal text-neutral-500">(optional)</span></label>
          <input
            id="invite-phone"
            type="tel"
            inputMode="tel"
            value={formData.guestPhone}
            onChange={(e) => setFormData({ ...formData, guestPhone: e.target.value })}
            className={fw}
            placeholder="555-1234"
          />
        </div>

        <div>
          <label className={lbl} htmlFor="invite-pin">Security PIN <span className="text-xs font-normal text-neutral-500">(optional)</span></label>
          <input
            id="invite-pin"
            type="text"
            autoCapitalize="characters"
            autoCorrect="off"
            value={formData.securityPin}
            onChange={(e) => setFormData({ ...formData, securityPin: e.target.value.toUpperCase() })}
            className={`${fw} font-mono tracking-widest`}
            placeholder="ABC123"
            maxLength={6}
          />
        </div>

        <div>
          <label className={lbl} htmlFor="invite-notes">Notes <span className="text-xs font-normal text-neutral-500">(staff will see these at the door)</span></label>
          <textarea
            id="invite-notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className={`${fw} resize-none`}
            rows={3}
            placeholder="Special requirements, dietary restrictions, etc."
          />
        </div>
      </form>
    </Sheet>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CSV IMPORT DIALOG
// ═══════════════════════════════════════════════════════════════════════════
function CsvImportDialog({ eventId, onClose, onImported }) {
  const [csvText, setCsvText] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);

  const TEMPLATE = `guestName,guestEmail,guestRole,adults,children,securityPin,notes,table,seat
Jane Smith,jane@example.com,VIP,1,0,,VIP table reserved,Table 1,1
Bob Jones,bob@example.com,SPEAKER,1,0,,Keynote speaker,Table 1,2
Alice Brown,alice@example.com,GUEST,2,1,,Nut allergy,Table 2,`;

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      toast.error('Please upload a .csv file');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setCsvText(ev.target.result || '');
    reader.readAsText(file);
  };

  const handleImport = async () => {
    const trimmed = csvText.trim();
    if (!trimmed) { toast.error('Paste or upload a CSV first'); return; }
    setImporting(true);
    setResult(null);
    try {
      const res = await eventAPI.importGuestsCsv(eventId, trimmed);
      setResult(res.data);
      if (res.data.imported > 0) {
        toast.success(`Imported ${res.data.imported} guest${res.data.imported !== 1 ? 's' : ''}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const rowCls = 'text-sm leading-snug';
  return (
    <Sheet
      open
      onClose={onClose}
      title="Import guests from CSV"
      subtitle="Bulk-add guests with roles, group sizes and notes"
      size="xl"
      footer={result?.imported > 0 ? (
        <button onClick={onImported} className="min-h-[48px] w-full rounded-xl bg-neutral-900 px-4 font-semibold text-white hover:bg-black">
          Done
        </button>
      ) : (
        <div className="flex gap-3">
          <button onClick={onClose} className="min-h-[48px] flex-1 rounded-xl border border-neutral-200 px-4 font-semibold hover:bg-neutral-50">
            Cancel
          </button>
          <button
            onClick={handleImport}
            disabled={importing || !csvText.trim()}
            className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-neutral-900 px-4 font-semibold text-white hover:bg-black disabled:opacity-40"
          >
            {importing ? <><Loader2 className="h-4 w-4 animate-spin" /> Importing…</> : 'Import guests'}
          </button>
        </div>
      )}
    >
      <div className="space-y-5 pt-1">
        {/* Results first, so they are the first thing seen after pressing Import */}
        {result && (
          <div className={`space-y-2 rounded-2xl p-4 ${result.imported > 0 ? 'border border-emerald-200 bg-emerald-50' : 'border border-amber-200 bg-amber-50'}`} role="status">
            <p className="font-bold">{result.imported} imported, {result.skipped} skipped</p>
            {result.errors?.length > 0 && (
              <div className="space-y-1 text-sm text-red-700">
                {result.errors.slice(0, 10).map((e, i) => (
                  <p key={i}>Row {e.row}{e.guestName ? ` (${e.guestName})` : ''}: {e.reason}</p>
                ))}
                {result.errors.length > 10 && <p>…and {result.errors.length - 10} more</p>}
              </div>
            )}
            {result.warnings?.length > 0 && (
              <div className="space-y-1 text-sm text-amber-700">
                {result.warnings.slice(0, 10).map((w, i) => (
                  <p key={i}>Row {w.row}{w.guestName ? ` (${w.guestName})` : ''}: {w.reason}</p>
                ))}
                {result.warnings.length > 10 && <p>…and {result.warnings.length - 10} more</p>}
              </div>
            )}
          </div>
        )}

        {/* File picker */}
        <div>
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
          <button
            onClick={() => fileRef.current?.click()}
            className="flex min-h-[96px] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-neutral-300 px-4 py-5 text-base font-semibold text-neutral-700 transition-all hover:border-neutral-400 hover:bg-neutral-50 active:bg-neutral-100"
          >
            <Upload className="h-6 w-6" />
            Choose a .csv file
          </button>
        </div>

        {/* Paste area */}
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-neutral-800" htmlFor="csv-paste">Or paste CSV content</label>
          <textarea
            id="csv-paste"
            value={csvText}
            onChange={e => setCsvText(e.target.value)}
            rows={6}
            className="w-full resize-none rounded-xl border border-neutral-200 px-4 py-3 font-mono text-sm focus:border-neutral-400 focus:outline-none"
            placeholder={TEMPLATE}
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
          />
        </div>

        {/* Template download */}
        <button
          onClick={() => {
            const blob = new Blob([TEMPLATE], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'guest-import-template.csv'; a.click();
            URL.revokeObjectURL(url);
          }}
          className="flex min-h-[44px] items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900"
        >
          <Download className="h-4 w-4" />
          Download template CSV
        </button>

        {/* Format guide: reference material, collapsed by default so the actions above stay in view */}
        <details className="group rounded-2xl border border-blue-200 bg-blue-50">
          <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between px-4 text-sm font-bold text-blue-900 [&::-webkit-details-marker]:hidden">
            Required CSV format
            <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-3 px-4 pb-4 text-blue-900">
            <p className="break-words font-mono text-xs leading-relaxed text-blue-800">
              guestName, guestEmail, guestRole, adults, children, securityPin, notes, table, seat
            </p>
            <ul className="space-y-1.5 text-blue-800">
              <li className={rowCls}><span className="font-bold">guestName</span>: required</li>
              <li className={rowCls}><span className="font-bold">guestEmail</span>: <span className="font-bold text-red-600">required</span>. Used for duplicate detection and sending invite links.</li>
              <li className={rowCls}><span className="font-bold">guestRole</span>: optional. <code className="rounded bg-blue-100 px-1">GUEST</code>, <code className="rounded bg-blue-100 px-1">VIP</code> or <code className="rounded bg-blue-100 px-1">SPEAKER</code>. Defaults to GUEST.</li>
              <li className={rowCls}><span className="font-bold">adults</span>: optional, defaults to 1</li>
              <li className={rowCls}><span className="font-bold">children</span>: optional, defaults to 0</li>
              <li className={rowCls}><span className="font-bold">securityPin</span>: optional, up to 6 characters</li>
              <li className={rowCls}><span className="font-bold">notes</span>: optional</li>
              <li className={rowCls}><span className="font-bold">table</span>: optional. Must match a table name on your seating map (e.g. <code className="rounded bg-blue-100 px-1">Table 3</code>). Unmatched names import the guest without a table.</li>
              <li className={rowCls}><span className="font-bold">seat</span>: optional, e.g. <code className="rounded bg-blue-100 px-1">4</code> or <code className="rounded bg-blue-100 px-1">A2</code></li>
            </ul>
          </div>
        </details>
      </div>
    </Sheet>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ACTIVITY LOG DIALOG
// ═══════════════════════════════════════════════════════════════════════════
const ACTION_LABELS = {
  invite_created:  { label: 'Guest added',      color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  invite_updated:  { label: 'Guest edited',      color: 'text-blue-700 bg-blue-50 border-blue-200' },
  invite_deleted:  { label: 'Guest removed',     color: 'text-red-700 bg-red-50 border-red-200' },
  guest_import:    { label: 'CSV import',         color: 'text-purple-700 bg-purple-50 border-purple-200' },
  checkin:         { label: 'Checked in',         color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  checkin_override:{ label: 'Override check-in',  color: 'text-amber-700 bg-amber-50 border-amber-200' },
  settings_changed:{ label: 'Settings changed',   color: 'text-neutral-700 bg-neutral-50 border-neutral-200' },
  staff_added:     { label: 'Staff added',         color: 'text-blue-700 bg-blue-50 border-blue-200' },
  staff_removed:   { label: 'Staff removed',       color: 'text-red-700 bg-red-50 border-red-200' },
};

function ActivityLogDialog({ eventId, onClose }) {
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    eventAPI.getActivityLog(eventId)
      .then(res => setLog(res.data.log || []))
      .catch(() => setError('Failed to load activity log'))
      .finally(() => setLoading(false));
  }, [eventId]);

  const filtered = filter === 'all' ? log : log.filter(e => e.action === filter);

  const fmt = (ts) => {
    const d = new Date(ts);
    return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title="Activity log"
      subtitle="Organizer and staff actions for this event"
      size="xl"
      fullHeight
      footer={<button onClick={onClose} className="min-h-[48px] w-full rounded-xl border border-neutral-200 px-4 text-sm font-semibold hover:bg-neutral-50">Close</button>}
    >
      {/* Filters stay pinned while the list scrolls; chips scroll sideways rather than wrapping into a wall */}
      <div className="sticky top-0 z-10 -mx-5 border-b border-neutral-100 bg-white px-5 py-3">
        <div className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {['all', 'checkin', 'invite_created', 'invite_deleted', 'guest_import'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={`min-h-[40px] flex-shrink-0 rounded-full px-4 text-sm font-semibold transition-all
                ${filter === f ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'}`}
            >
              {f === 'all' ? 'All' : ACTION_LABELS[f]?.label || f}
            </button>
          ))}
        </div>
      </div>

      <div className="-mx-5">
        {loading && <SkeletonRows rows={7} />}
        {error && <div className="py-16 text-center text-sm text-red-600">{error}</div>}
        {!loading && !error && filtered.length === 0 && (
          <div className="py-16 text-center text-sm text-neutral-500">No activity yet</div>
        )}
        {!loading && !error && filtered.map((entry, i) => {
          const cfg = ACTION_LABELS[entry.action] || { label: entry.action, color: 'text-neutral-600 bg-neutral-50 border-neutral-200' };
          return (
            <div key={i} className="border-b border-neutral-100 px-5 py-3.5">
              <div className="flex items-center justify-between gap-3">
                <span className={`inline-block rounded border px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${cfg.color}`}>
                  {cfg.label}
                </span>
                <span className="whitespace-nowrap text-xs text-neutral-500">{fmt(entry.timestamp)}</span>
              </div>
              <p className="mt-1.5 break-words text-sm text-neutral-800">{entry.details || entry.target || '—'}</p>
              <p className="mt-0.5 text-xs text-neutral-500">
                <span className="font-semibold text-neutral-700">{entry.actor}</span>
                {entry.actorRole && <span className="ml-1">({entry.actorRole})</span>}
                {entry.target && entry.details && <span className="ml-1">· {entry.target}</span>}
              </p>
            </div>
          );
        })}
      </div>
    </Sheet>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
function EnterpriseCheckinInner() {
  const { eventId: eventIdParam, subdomain } = useParams();
  const navigate = useNavigate();

  // /e/:subdomain/checkin carries no event id in the URL. It used to leave eventId undefined, so
  // nothing ever loaded. Resolve it from the subdomain (and remember it for offline reloads).
  const [eventId, setEventId] = useState(eventIdParam || null);
  const [resolveError, setResolveError] = useState(null);
  const [gateTitle, setGateTitle] = useState('');
  const [gateNotice, setGateNotice] = useState('');

  // Auth / staff gate
  const [authState, setAuthState] = useState(() => readCheckinAuth(eventIdParam || null));

  const [event, setEvent] = useState(null);
  const [invites, setInvites] = useState([]);
  const [stats, setStats] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');   // 'all' | 'waiting' | 'in'
  // The guest list loads separately from the page shell so a big list never
  // holds the whole screen hostage behind a skeleton.
  const [invitesLoading, setInvitesLoading] = useState(true);
  const [invitesError, setInvitesError] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [invitesStale, setInvitesStale] = useState(false);   // showing the on-device copy until fresh data lands
  const freshInvitesRef = useRef(false);
  const invitesRef = useRef([]);          // latest list for socket handlers (their closures are stale)
  const [visibleCount, setVisibleCount] = useState(GUEST_PAGE_SIZE);
  
  const [scanMode, setScanMode] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [currentGuest, setCurrentGuest] = useState(null);
  const [currentSecurity, setCurrentSecurity] = useState(null);
  const [currentStaffNote, setCurrentStaffNote] = useState('');
  const [requiresPin, setRequiresPin] = useState(false);
  const [pinVerified, setPinVerified] = useState(false);
  
  const [showAdmitSuccess, setShowAdmitSuccess] = useState(false);
  const [showDenyScreen, setShowDenyScreen] = useState(false);
  const [denyDetails, setDenyDetails] = useState(null);
  const [admittedGuest, setAdmittedGuest] = useState(null);
  
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);
  const [overrideInvite, setOverrideInvite] = useState(null);
  
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [editingInvite, setEditingInvite] = useState(null);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [showAssignPanel, setShowAssignPanel] = useState(false);
  const [showActivityLog, setShowActivityLog] = useState(false);
  
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const { alerts: secAlerts, addAlert: addSecAlert, addConflicts, dismissAlert: dismissSecAlert, dismissAll: dismissAllSecAlerts } = useSecurityAlerts();
  const [isOffline, setIsOffline]     = useState(!navigator.onLine);
  const isOfflineRef  = useRef(!navigator.onLine);   // timers/handlers read this, state would be stale
  const syncingRef    = useRef(false);
  const pinAttemptsRef = useRef({});                  // offline PIN attempts per ticket
  const [pendingSync, setPendingSync] = useState(0);
  const [cacheReady, setCacheReady]   = useState(false);
  const [cacheInfo, setCacheInfo]     = useState(null);
  const [syncError, setSyncError]     = useState(null);
  isOfflineRef.current = isOffline;

  // ── PWA: sync trigger shared with the readiness chip and queue panel ────────
  const syncNowRef = useRef(null);
  const syncNow = useCallback(() => (syncNowRef.current ? syncNowRef.current() : Promise.resolve()), []);

  // Ask the browser to keep the saved guest list once it exists (Safari / low-storage phones may evict it).
  const haveSavedList = !!cacheInfo?.total;
  useEffect(() => { if (haveSavedList) requestPersistentStorage(); }, [haveSavedList]);

  // A new app version must never reload the page while check-ins are unsynced or a scan is in progress.
  const updateGuardRef = useRef({});
  updateGuardRef.current = {
    pending: pendingSync,
    busy: scanMode || !!currentGuest || showAdmitSuccess || showDenyScreen || showOverrideDialog,
  };
  useEffect(() => {
    setUpdateBlocker('checkin', () => {
      const g = updateGuardRef.current;
      if (g.pending > 0) return `${g.pending} check-in${g.pending !== 1 ? 's' : ''} still need to sync. Update after they sync.`;
      if (g.busy) return 'Finish the current scan, then update.';
      return false;
    });
    return () => setUpdateBlocker('checkin', null);
  }, []);

  // Warn before closing the tab / app while saved check-ins have not reached the server.
  useEffect(() => {
    if (pendingSync <= 0) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; return ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [pendingSync]);

  // ── Seating map state ────────────────────────────────────────────────────
  const [seatingData,    setSeatingData]    = useState(null); // { seatingMap, guestsByTable }
  const [showSeatingMap, setShowSeatingMap] = useState(false);
  const [seatingFocusId, setSeatingFocusId] = useState(null);
  const [seatingIsSaving, setSeatingIsSaving] = useState(false);

  // ── Socket ref (needed by walkie-talkie hook) ────────────────────────────
  const socketRef = useRef(null);
  // State mirror so walkie hook re-renders when socket connects (fixes timing race)
  const [socketObj, setSocketObj] = useState(null);

  // ── Walkie-talkie ────────────────────────────────────────────────────────
  const token = authState.ready ? (localStorage.getItem('eventToken') || '') : '';
  const walkie = useWalkieTalkie(
    socketObj,
    eventId,
    token,
    authState.username || ''
  );

  // Resolve the event id for /e/:subdomain/checkin
  useEffect(() => {
    if (eventIdParam) { setEventId(eventIdParam); return; }
    if (!subdomain) return;
    const key = `checkin_subdomain_${subdomain}`;
    let cancelled = false;
    let haveSaved = false;
    // Saved by an earlier check-in visit, or by the event page / home list (same event, opened another way).
    try { const saved = localStorage.getItem(key) || readEventMeta(subdomain)?.id; if (saved) { haveSaved = true; setEventId(String(saved)); } } catch { /* ignore */ }
    eventAPI.getBySubdomain(subdomain).then(res => {
      if (cancelled) return;
      const id = res.data.event?.id || res.data.event?._id;
      if (!id) { setResolveError('Event not found'); return; }
      try { localStorage.setItem(key, String(id)); } catch { /* ignore */ }
      setEventId(String(id));
    }).catch(err => {
      if (cancelled) return;
      if (err.response?.status === 404) setResolveError('Event not found');
      else if (!haveSaved) setResolveError('Could not reach the server to find this event. Check your connection and try again.');
    });
    return () => { cancelled = true; };
  }, [eventIdParam, subdomain]);

  // Once we know which event this is, re-check the stored token against it (a token left over from a
  // different event, or a guest/participant token, must not open the scanner).
  useEffect(() => {
    if (!eventId) return;
    const next = readCheckinAuth(eventId);
    setAuthState(prev => (prev.ready === next.ready && prev.role === next.role && prev.username === next.username) ? prev : next);
    if (!next.ready) {
      if (next.reason === 'expired') setGateNotice('Your session expired. Log in again with your staff username and PIN.');
      else if (next.reason === 'other_event') setGateNotice('You are logged in to a different event. Log in with the staff account for this one.');
      else if (next.reason === 'wrong_role') setGateNotice('Guest sign-ins cannot scan tickets. Log in with your staff username and PIN.');
    }
  }, [eventId]);

  // Event name for the staff login screen (public endpoint, no token needed)
  useEffect(() => {
    if (!eventId || authState.ready) return;
    eventAPI.getPublicInfo(eventId).then(r => setGateTitle(r.data.event?.title || '')).catch(() => {});
  }, [eventId, authState.ready]);

  useEffect(() => {
    if (eventId && authState.ready) {
      loadAllData();
    }
  }, [eventId, authState.ready]);

  useEffect(() => { setVisibleCount(GUEST_PAGE_SIZE); }, [searchQuery, statusFilter]);
  invitesRef.current = invites;

  // ── Setup wizard: show on first run for organizers, or when they've just
  // added their first guest and the wizard step key indicates they should
  // continue to the QR / settings steps.
  useEffect(() => {
    if (isOffline || loading || invitesLoading || invitesError || authState.role !== 'organizer') return;
    if (localStorage.getItem(`checkin_setup_done_${eventId}`) === 'true') return;
    const pendingStep = localStorage.getItem(`checkin_wizard_step_${eventId}`);
    // Show if no guests yet, OR if they added guests and should continue
    if (invites.length === 0 || pendingStep !== null) {
      setShowSetupWizard(true);
    }
  }, [isOffline, loading, invitesLoading, invitesError, authState.role, invites.length, eventId]);

  // Real-time socket updates + offline cache bootstrap
  useEffect(() => {
    if (!eventId || !authState.ready) return;
    const storedToken = localStorage.getItem('eventToken');
    if (!storedToken) return;

    const socket = socketService.connect(storedToken);
    socketRef.current = socket;
    setSocketObj(socket); // trigger walkie hook with real socket

    if (socket) {
      socket.emit('join_event', eventId);
      socket.on('guest_checked_in', (evt) => {
        // Patch the one guest that changed instead of re-downloading the whole
        // list on every scan by every staff member. Fall back to a full reload
        // only if we don't know this guest yet (e.g. just added elsewhere).
        const code = evt?.inviteCode;
        const known = !!code && invitesRef.current.some(inv => inv.inviteCode === code);
        if (known) {
          setInvites(prev => prev.map(inv => inv.inviteCode !== code ? inv : {
            ...inv,
            checkedIn: true,
            actualAttendees: evt.actualAttendees ?? inv.actualAttendees,
            checkedInAt: evt.checkedInAt ?? inv.checkedInAt,
            checkedInBy: evt.checkedInBy ?? inv.checkedInBy,
          }));
        } else {
          loadInvites();
        }
        loadStats();
      });
      // Security alerts from server antifraud middleware
      socket.on('security_alert', addSecAlert);

      // ── Seating real-time events ────────────────────────────────────────
      socket.on('seating_map_updated', ({ seatingMap }) => {
        setSeatingData(prev => prev ? { ...prev, seatingMap } : { seatingMap, guestsByTable: {} });
      });
      socket.on('seating_assignments_updated', () => {
        loadSeating();
      });
      socket.on('guest_table_updated', ({ inviteId, tableId, tableLabel }) => {
        setInvites(prev => prev.map(i =>
          i._id === inviteId ? { ...i, tableId, tableLabel } : i
        ));
      });
    }

    // ── Offline cache: load from DB immediately, then refresh from server ──
    const refreshCacheInfo = () => offlineCheckin.cacheInfo(eventId).then(setCacheInfo);
    offlineCheckin.loadCacheFromDB(eventId).then(cached => {
      if (cached) {
        setCacheReady(true);
        // Instant paint: show last session's guest list while the fresh one loads.
        if (!freshInvitesRef.current && cached.snapshot?.length) {
          setInvites(cached.snapshot.map(snapshotToInvite));
          setInvitesStale(true);
        }
      }
      refreshCacheInfo();
    });
    // The network refresh of this cache now happens in loadInvites(), from the
    // same /invites response, so we no longer fetch /checkin-cache on mount.

    // ── Count pending offline check-ins ───────────────────────────────────
    offlineCheckin.pendingCount(eventId).then(n => {
      setPendingSync(n);
      // Check-ins saved by an earlier session (app closed while offline) go out as soon as we can reach the server.
      if (n > 0 && navigator.onLine) syncOfflineWork();
    });

    // ── Connectivity listeners ─────────────────────────────────────────────
    // navigator.onLine only knows whether the device has a network interface, not whether the
    // internet works (venue wifi with no uplink, captive portals, dead mobile data). So "offline"
    // is decided by real request failures too, and cleared only by a request that really succeeds.
    async function syncOfflineWork() {
      if (syncingRef.current) return;
      syncingRef.current = true;
      try {
        setSyncError(null);

        // 1) Push queued check-ins FIRST. Refreshing the guest list first would overwrite the
        //    local "already admitted" marks with the server's older copy.
        const results = await offlineCheckin.flushQueue(eventId, (inviteCode, actualAttendees, meta = {}) =>
          eventAPI.checkIn(eventId, inviteCode, {
            actualAttendees,
            pinVerified: !!meta.pinVerified,
            offlineSync: true,
            scannedAt: meta.scannedAt,
          })
        );
        offlineCheckin.pendingCount(eventId).then(n => setPendingSync(n));
        if (results.offline) { setIsOffline(true); return; }

        if (results.authExpired) {
          setSyncError('Your session expired. Log out and back in to sync the saved check-ins (they are safe on this device).');
        } else if (results.failed > 0) {
          setSyncError(`${results.failed} queued check-in${results.failed !== 1 ? 's' : ''} still need another sync attempt.`);
        }
        if (results.synced > 0) { loadInvites(); loadStats(); }
        if (results.conflicts.length > 0) addConflicts(results.conflicts);

        // 2) Then refresh the saved guest list. A success proves the connection is real.
        const cacheOk = await offlineCheckin.refreshCache(eventId, () => eventAPI.getCheckinCache(eventId));
        if (cacheOk) {
          setCacheReady(true);
          setIsOffline(false);
        } else if (offlineCheckin.isNetworkError(offlineCheckin.lastRefreshError)) {
          setIsOffline(true);
        }
        await refreshCacheInfo();
      } catch (err) {
        setSyncError('Offline sync could not finish. PlanIt will retry automatically.');
      } finally {
        syncingRef.current = false;
      }
    }

    syncNowRef.current = syncOfflineWork;

    function handleOnline() {
      setIsOffline(false);       // optimistic; a failed request flips it back
      syncOfflineWork();
    }
    function handleOffline() {
      setIsOffline(true);
    }

    // Light-weight heartbeat. It only does real work when there is something to do: we think we are
    // offline (probe the server), check-ins are waiting, or the saved list is stale. It used to
    // download the entire guest list every 30 seconds on every device.
    const syncTimer = setInterval(async () => {
      if (navigator.onLine === false) return;
      try {
        const [pending, age] = await Promise.all([offlineCheckin.pendingCount(eventId), offlineCheckin.cacheAge(eventId)]);
        if (isOfflineRef.current || pending > 0 || age > 5 * 60 * 1000) syncOfflineWork();
      } catch { /* ignore */ }
    }, 15000);

    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      if (socket) {
        socket.off('guest_checked_in');
        socket.off('security_alert', addSecAlert);
        socket.off('seating_map_updated');
        socket.off('seating_assignments_updated');
        socket.off('guest_table_updated');
      }
      clearInterval(syncTimer);
      syncNowRef.current = null;
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [eventId, authState.ready]);

  // Keyboard shortcuts: S = scan, Escape = close
  useEffect(() => {
    const handler = (e) => {
      // Don't fire if typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 's' || e.key === 'S') {
        if (!scanMode && !currentGuest && !showAdmitSuccess && !showDenyScreen && !showOverrideDialog) {
          resetScan();
          setScanMode(true);
        }
      }
      if (e.key === 'Escape') {
        if (showSeatingMap) { setShowSeatingMap(false); return; }
        if (scanMode) setScanMode(false);
        if (showManual) setShowManual(false);
        if (showSettingsPanel) setShowSettingsPanel(false);
        if (showInviteDialog) { setShowInviteDialog(false); setEditingInvite(null); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [scanMode, currentGuest, showAdmitSuccess, showDenyScreen, showOverrideDialog, showManual, showSettingsPanel, showInviteDialog, showSeatingMap]);

  // ── Seating guest-assignment events dispatched by SeatingMap component ───
  useEffect(() => {
    const onAssign = async (e) => {
      const { inviteId, tableId, tableLabel } = e.detail;
      try {
        await eventAPI.assignGuestTable(eventId, inviteId, tableId, tableLabel);
        setInvites(prev => prev.map(i =>
          i._id === inviteId ? { ...i, tableId, tableLabel } : i
        ));
        await loadSeating();
        toast.success('Guest assigned to table');
      } catch {
        toast.error('Failed to assign guest');
      }
    };
    const onUnassign = async (e) => {
      const { inviteId } = e.detail;
      try {
        await eventAPI.assignGuestTable(eventId, inviteId, null, null);
        setInvites(prev => prev.map(i =>
          i._id === inviteId ? { ...i, tableId: null, tableLabel: null } : i
        ));
        await loadSeating();
        toast.success('Guest unassigned');
      } catch {
        toast.error('Failed to unassign guest');
      }
    };
    window.addEventListener('seating:assignGuest',   onAssign);
    window.addEventListener('seating:unassignGuest', onUnassign);
    return () => {
      window.removeEventListener('seating:assignGuest',   onAssign);
      window.removeEventListener('seating:unassignGuest', onUnassign);
    };
  }, [eventId]);

  const handleStaffLogin = ({ token, role, username }) => {
    // The shared socket may still be connected with a previous token (e.g. the organizer's).
    try { socketService.disconnect(); } catch { /* ignore */ }
    setGateNotice('');
    setLoadError(null);
    setLoading(true);
    setAuthState({ ready: true, role, username });
  };

  const handleStaffLogout = () => {
    // Restore organiser token if it was preserved before a staff test-login
    try { socketService.disconnect(); } catch { /* ignore */ }
    const savedOrgToken = localStorage.getItem(`_orgToken_${eventId}`);
    localStorage.removeItem('eventToken');
    localStorage.removeItem(`_orgToken_${eventId}`);
    if (savedOrgToken) {
      const decoded = decodeJWT(savedOrgToken);
      if (decoded && decoded.exp * 1000 > Date.now()) {
        localStorage.setItem('eventToken', savedOrgToken);
        setAuthState({ ready: true, role: 'organizer', username: decoded.username });
        return;
      }
    }
    setAuthState({ ready: false, role: null });
  };

  const loadAllData = async () => {
    try {
      setLoading(true);
      setLoadError(null);

      // Only the event itself gates the page. It is small, and its 401/403
      // tells us whether this person should be here at all.
      await loadEvent();
      setLoading(false);

      // Everything else streams in on its own. The guest list can be thousands of
      // rows, so it must not block stats, settings or the header.
      loadInvites();
      loadStats();
      loadSettings();
      loadSeating().catch(() => {});
    } catch (error) {
      console.error('Failed to load check-in data:', error);
      const status = error?.response?.status;
      if (status === 401 || status === 403) {
        // Don't send staff to /login (that page is organizer-only and has no staff form for
        // normal events). Show the staff PIN screen again. Anything admitted offline is in
        // IndexedDB and syncs after they log back in.
        try { localStorage.removeItem('eventToken'); } catch { /* ignore */ }
        setGateNotice(error?.response?.data?.error || 'Your session expired or does not cover this event. Log in again.');
        setLoading(false);
        setAuthState({ ready: false, role: null });
        return;
      }
      const errorMsg = error.response?.data?.error || error.message || 'Failed to load check-in data';
      setLoadError(errorMsg);
      toast.error(errorMsg);
      setLoading(false);
    }
  };
  
  const loadEvent = async () => {
    try {
      const response = await eventAPI.getById(eventId);
      const ev = response.data.event || response.data;
      setEvent(ev);
      try { localStorage.setItem(`checkin_event_cache_${eventId}`, JSON.stringify(ev)); } catch { /* quota: fine */ }
      // So the home page can list this event (and its check-in) with no internet.
      saveEventMeta(eventId, { id: eventId, title: ev.title || ev.name, subdomain: ev.subdomain, eventType: ev.eventType || 'standard' });
    } catch (error) {
      // No response at all means a network failure (offline / server unreachable).
      // Door staff still need the scanner, so fall back to the copy saved from
      // the last successful load instead of showing "Failed to Load".
      if (!error.response) {
        try {
          const raw = localStorage.getItem(`checkin_event_cache_${eventId}`);
          if (raw) {
            setEvent(JSON.parse(raw));
            toast('Offline — using saved event data', { icon: '📴' });
            return;
          }
        } catch { /* fall through to the error */ }
        // First time on this device with no saved event copy, but a guest list is saved: the scanner
        // only needs the guest list, so open with a placeholder title instead of a dead end.
        try {
          const info = await offlineCheckin.cacheInfo(eventId);
          if (info && info.total > 0) {
            setEvent({ id: eventId, title: 'Event (offline)' });
            toast('Offline — using the saved guest list', { icon: '📴' });
            return;
          }
        } catch { /* fall through to the error */ }
      }
      console.error('Failed to load event:', error);
      throw error;
    }
  };
  
  const loadInvites = async () => {
    setInvitesLoading(true);
    setInvitesError(null);
    try {
      const response = await eventAPI.getInvites(eventId);
      const list = response.data.invites || response.data || [];
      freshInvitesRef.current = true;
      setInvites(list);
      setInvitesStale(false);

      // Reuse this response to refresh the offline cache instead of downloading
      // the same guest list a second time from /checkin-cache.
      offlineCheckin.refreshCache(eventId, async () => ({
        data: {
          snapshot: await Promise.all(list.map(inviteToSnapshot)),
          total: list.length,
          builtAt: new Date().toISOString(),
        },
      })).then(ok => {
        if (ok) {
          setCacheReady(true);
          offlineCheckin.cacheInfo(eventId).then(setCacheInfo);
        }
      });
    } catch (error) {
      console.error('Failed to load invites:', error);
      // Keep whatever we are already showing (cached copy) rather than blanking the list.
      setInvitesError(error.response?.data?.error || error.message || 'Could not load the guest list');
    } finally {
      setInvitesLoading(false);
    }
  };
  
  const loadStats = async () => {
    try {
      const response = await eventAPI.getCheckInStats(eventId);
      setStats(response.data.stats || response.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setStatsLoading(false);
    }
  };
  
  const loadSettings = async () => {
    try {
      const response = await eventAPI.getCheckInSettings(eventId);
      const next = response.data.settings || response.data || {};
      setSettings(next);
      try { localStorage.setItem(`checkin_settings_cache_${eventId}`, JSON.stringify(next)); } catch { /* ignore */ }
    } catch (error) {
      console.error('Failed to load settings:', error);
      let saved = {};
      if (!error.response) {
        try { saved = JSON.parse(localStorage.getItem(`checkin_settings_cache_${eventId}`) || '{}'); } catch { /* ignore */ }
      }
      setSettings(saved);
    }
  };

  const loadSeating = async () => {
    try {
      const response = await eventAPI.getSeatingMap(eventId);
      setSeatingData(response.data);
    } catch {
      // seating not yet enabled — silently ignore
    }
  };
  
  // ── Offline verification ──────────────────────────────────────────────────
  // Checks the scanned code against the guest list saved on this device. Nothing is marked as
  // admitted here — that only happens when the staff member taps Admit (see admitOffline), so
  // tapping Deny leaves no trace. (It used to queue the check-in at scan time, before Admit/Deny.)
  const scanOffline = async (inviteCode) => {
    if (!offlineCheckin.hasCache()) {
      const saved = await offlineCheckin.loadCacheFromDB(eventId);
      if (saved) setCacheReady(true);
    }
    const haveList = offlineCheckin.hasCache();
    const cached = offlineCheckin.lookupGuest(inviteCode);

    if (!cached) {
      hapticError();
      setDenyDetails({
        reason: 'not_found',
        severity: 'critical',
        message: haveList
          ? 'QR code not found in the offline guest list. Deny entry, or send the guest to the organizer.'
          : 'No guest list is saved on this device. Open check-in once while online to enable offline scanning.',
        displayMessage: haveList ? 'NOT FOUND (OFFLINE)' : 'NO OFFLINE LIST',
      });
      setShowDenyScreen(true);
      return;
    }
    if (cached.isBlocked) {
      hapticError();
      setDenyDetails({
        reason: 'blocked', severity: 'critical',
        message: 'This guest is blocked.', displayMessage: 'BLOCKED',
        guestName: cached.name, inviteCode,
      });
      setShowDenyScreen(true);
      return;
    }
    if (cached.checkedIn) {
      hapticError();
      setDenyDetails({
        reason: 'already_checked_in', severity: 'high',
        message: 'This ticket has already been used.', displayMessage: 'TICKET ALREADY USED',
        guestName: cached.name, inviteCode, requiresOverride: false,
        checkedInAt: cached.checkedInAt || undefined,
        checkedInBy: cached.checkedInBy || undefined,
      });
      setShowDenyScreen(true);
      return;
    }

    // Valid — show the boarding pass; admission is committed by handleAdmit.
    hapticSuccess();
    setCurrentGuest({
      id: inviteCode, inviteCode,
      guestName:  cached.name,
      guestEmail: cached.email     || '',
      groupSize:  cached.groupSize || 1,
      adults:     cached.adults    || 1,
      children:   cached.children  || 0,
      notes:      cached.notes     || '',
      hasPin:     !!cached.hasPin,
      guestRole:  cached.guestRole  || 'GUEST',
      tableId:    cached.tableId    || null,
      tableLabel: cached.tableLabel || null,
      seatNumber: cached.seatNumber || null,
      tableType:  cached.tableType  || null,
      _offlineAdmit: true,
    });
    setCurrentSecurity({ trustScore: 100, warnings: [], flags: [] });
    setCurrentStaffNote(settings?.staffNote || '');
    setRequiresPin(!!(cached.hasPin && settings?.requirePin));
    setPinVerified(false);
  };

  const handleScan = async (code) => {
    if (!code || !code.trim()) {
      toast.error('Invalid code');
      return;
    }

    let inviteCode = code.trim();

    // Extract invite code from full URL or bare code:
    // - https://planitapp.onrender.com/invite/ABC123
    // - /invite/ABC123?ref=email  or  /invite/ABC123#section
    // - ABC123 (bare code, from manual entry or direct click)
    const match = inviteCode.match(/\/invite\/([A-Z0-9]+)(?:[?#]|$)/i);
    if (match) {
      inviteCode = match[1];
    } else {
      inviteCode = inviteCode.replace(/^https?:\/\/[^/]+\/?/i, '');
    }

    inviteCode = inviteCode.toUpperCase().trim();

    setScanMode(false);
    setShowManual(false);
    setManualCode('');

    // ── OFFLINE PATH ────────────────────────────────────────────────────
    if (isOffline || navigator.onLine === false) {
      await scanOffline(inviteCode);
      return;
    }

    // ── ONLINE PATH ─────────────────────────────────────────────────────
    try {
      const response = await eventAPI.verifyScan(eventId, inviteCode);
      const data = response.data;

      if (!data.valid) {
        hapticError();
        setDenyDetails({
          reason: data.reason,
          severity: data.severity || 'critical',
          message: data.message,
          displayMessage: data.displayMessage,
          checkedInAt: data.checkedInAt,
          checkedInBy: data.checkedInBy,
          blockedReason: data.blockedReason,
          requiresOverride: data.requiresOverride,
          inviteCode: data.inviteCode,
          guestName: data.guestName,
          groupSize: data.groupSize,
        });
        setShowDenyScreen(true);
        return;
      }

      hapticSuccess();
      setCurrentGuest(data.guest);
      setCurrentSecurity(data.security);
      setCurrentStaffNote(data.staffNote || '');
      setRequiresPin(data.requiresPin);
      setPinVerified(false);

    } catch (error) {
      // The request never reached the server (no signal, wifi with no internet, timeout, server
      // down). That is exactly when the saved guest list is needed, so fall back to it instead of
      // a dead-end "could not verify" screen. navigator.onLine alone misses all of these cases.
      if (navigator.onLine === false || offlineCheckin.isNetworkError(error)) {
        setIsOffline(true);
        await scanOffline(inviteCode);
        return;
      }

      hapticError();
      const errData = error.response?.data;
      const status  = error.response?.status;

      // ── Structured denial from antifraud/checkin middleware ──
      if (errData && errData.valid === false) {
        setDenyDetails({
          reason:          errData.reason,
          severity:        errData.severity || 'critical',
          message:         errData.message,
          displayMessage:  errData.displayMessage,
          checkedInAt:     errData.checkedInAt,
          checkedInBy:     errData.checkedInBy,
          blockedReason:   errData.blockedReason,
          requiresOverride:errData.requiresOverride,
          inviteCode:      errData.inviteCode,
          guestName:       errData.guestName,
          groupSize:       errData.groupSize,
          currentCapacity: errData.currentCapacity,
          maxCapacity:     errData.maxCapacity,
          trustScore:      errData.trustScore,
          lockedUntil:     errData.lockedUntil,
          lockdownReason:  errData.lockdownReason,
        });

      // ── Auth / access errors ──
      } else if (status === 403 && errData?.requiresApproval) {
        setDenyDetails({
          reason: 'auth_error', severity: 'critical',
          message: 'Your staff session is not authorised for this event. Please log out and log back in with your staff PIN.',
        });
      } else if (status === 401) {
        setDenyDetails({
          reason: 'auth_error', severity: 'critical',
          message: 'Your session has expired. Please log out and log back in.',
        });
      } else if (status === 403) {
        setDenyDetails({
          reason: 'auth_error', severity: 'critical',
          message: errData?.error || 'Access denied. You do not have permission to scan for this event.',
        });
      } else if (status === 404) {
        setDenyDetails({
          reason: 'not_found', severity: 'critical',
          message: 'This QR code was not found. The ticket may have been deleted or belongs to a different event.',
        });
      } else {
        // Network / server error
        setDenyDetails({
          reason: 'error', severity: 'critical',
          message: errData?.error || errData?.message || 'Could not verify this ticket. Please check your connection and try again.',
        });
      }
      setShowDenyScreen(true);
    }
  };

  const handlePinVerify = async (pin) => {
    // Offline (or the server can't be reached): check against the salted hash saved with the guest list.
    const verifyLocally = async () => {
      const code = currentGuest.inviteCode;
      const limit = settings?.maxFailedAttempts || 3;
      if ((pinAttemptsRef.current[code] || 0) >= limit) {
        throw new Error('PIN locked — too many failed attempts. Escalate to the organizer.');
      }
      const ok = await offlineCheckin.verifyPinLocally(code, pin);
      if (ok === null) {
        throw new Error('This PIN cannot be checked offline yet. Reconnect once so the guest list refreshes, or escalate to the organizer.');
      }
      if (!ok) {
        hapticError();
        pinAttemptsRef.current[code] = (pinAttemptsRef.current[code] || 0) + 1;
        const left = Math.max(0, limit - pinAttemptsRef.current[code]);
        throw new Error(left > 0
          ? `Incorrect PIN. ${left} attempt${left !== 1 ? 's' : ''} remaining.`
          : 'PIN locked — too many failed attempts. Escalate to the organizer.');
      }
      hapticSuccess();
      setPinVerified(true);
      toast.success('PIN verified (offline)');
    };

    if (currentGuest?._offlineAdmit || isOffline || navigator.onLine === false) {
      return verifyLocally();
    }

    try {
      const response = await eventAPI.verifyPin(eventId, currentGuest.inviteCode, pin);
      if (response.data.valid) {
        hapticSuccess();
        setPinVerified(true);
        toast.success('PIN verified');
      } else {
        throw new Error(response.data.message || 'Incorrect PIN. Please try again.');
      }
    } catch (error) {
      if (offlineCheckin.isNetworkError(error)) {
        setIsOffline(true);
        return verifyLocally();
      }
      hapticError();
      const errData = error.response?.data;
      const status  = error.response?.status;

      if (status === 401 && errData?.locked) {
        // Too many wrong PINs — escalate to deny screen
        setCurrentGuest(null);
        setDenyDetails({
          reason: 'pin_locked', severity: 'high',
          message: 'Too many incorrect PIN attempts. This ticket is temporarily locked.',
          requiresOverride: settings?.allowManualOverride,
        });
        setShowDenyScreen(true);
        return;
      }

      const msg = errData?.message || error.message || 'Incorrect PIN. Please try again.';
      throw new Error(msg);
    }
  };

  // Admit a guest from the saved list: mark them admitted on this device and queue the check-in for
  // the server. The queue lives in IndexedDB, so it survives a reload or the app being closed.
  const admitOffline = async (guest) => {
    const size = guest.groupSize || 1;
    await offlineCheckin.markCheckedInLocally(guest.inviteCode, size, authState.username, eventId);
    await offlineCheckin.queueCheckin(eventId, guest.inviteCode, size, { pinVerified });
    offlineCheckin.pendingCount(eventId).then(n => setPendingSync(n));
    offlineCheckin.cacheInfo(eventId).then(setCacheInfo);
    setAdmittedGuest({ ...guest, checkedIn: true });
    setCurrentGuest(null);
    setShowAdmitSuccess(true);
  };

  const handleAdmit = async () => {
    if (currentGuest?._offlineAdmit) {
      await admitOffline(currentGuest);
      return;
    }
    try {
      const response = await eventAPI.checkIn(eventId, currentGuest.inviteCode, {
        actualAttendees: currentGuest.groupSize,
        pinVerified,
      });
      const admitted = response.data.invite;
      setAdmittedGuest(admitted);
      setCurrentGuest(null);

      // If the admitted guest has a table and the seating map is enabled, prepare auto-focus
      if (admitted.tableId && seatingData?.seatingMap?.enabled) {
        setSeatingFocusId(admitted.tableId);
      }

      setShowAdmitSuccess(true);
      
      // Immediate refresh for real-time stats (no setTimeout)
      loadInvites();
      loadStats();
    } catch (error) {
      console.error('Check-in error:', error);

      // Connection dropped between scan and Admit: don't lose the admission. Save it on this
      // device (if the guest is in the saved list) and let the queue sync it.
      if (offlineCheckin.isNetworkError(error) && offlineCheckin.lookupGuest(currentGuest.inviteCode)) {
        setIsOffline(true);
        toast('No connection — admitted and saved on this device. It will sync automatically.', { icon: '📴' });
        await admitOffline(currentGuest);
        return;
      }

      const errData = error.response?.data;
      const status  = error.response?.status;
      setCurrentGuest(null);

      // Structured block from antifraud middleware — show DenyScreen, not a toast
      if (errData?.valid === false || status === 403) {
        setDenyDetails({
          reason:          errData?.reason || 'check_in_failed',
          severity:        errData?.severity || 'critical',
          message:         errData?.message || errData?.error || 'Check-in was blocked by the security system.',
          blockedReason:   errData?.blockedReason,
          currentCapacity: errData?.currentCapacity,
          maxCapacity:     errData?.maxCapacity,
          requiresOverride:errData?.requiresOverride,
          lockdownReason:  errData?.lockdownReason,
        });
        setShowDenyScreen(true);
      } else {
        // Network / server error — toast is fine here
        toast.error(errData?.error || errData?.message || 'Check-in failed. Please try again.');
      }
    }
  };

  // Called from AdmitSuccessScreen "Show on Map" button
  const handleShowMap = () => {
    setShowAdmitSuccess(false);
    setShowSeatingMap(true);
    // seatingFocusId already set in handleAdmit
  };
  
  const handleDenyFromBoarding = () => {
    setCurrentGuest(null);
    setDenyDetails({
      reason: 'staff_denied',
      severity: 'medium',
      message: 'Staff denied entry',
      displayMessage: 'Entry denied by security staff',
    });
    setShowDenyScreen(true);
  };
  
  const handleRequestOverride = () => {
    // When coming from DenyScreen (already checked in / blocked),
    // currentGuest is null — reconstruct a minimal invite from denyDetails
    const invite = currentGuest || (denyDetails ? {
      inviteCode: denyDetails.inviteCode,
      guestName: denyDetails.guestName || 'Guest',
      groupSize: denyDetails.groupSize || 1,
      actualAttendees: denyDetails.actualAttendees,
      blockedReason: denyDetails.blockedReason,
    } : null);

    if (!invite) return;

    setOverrideInvite(invite);
    setShowOverrideDialog(true);
    setCurrentGuest(null);
    setShowDenyScreen(false);
  };
  
  const resetScan = () => {
    setShowAdmitSuccess(false);
    setShowDenyScreen(false);
    setCurrentGuest(null);
    setAdmittedGuest(null);
    setDenyDetails(null);
    setPinVerified(false);
    setSeatingFocusId(null);
    setCurrentStaffNote('');
  };

  const handleSaveSeatingMap = async (newObjects) => {
    setSeatingIsSaving(true);
    try {
      await eventAPI.saveSeatingMap(eventId, {
        enabled: true,
        objects: newObjects,
        canvasW: 1000,
        canvasH: 700,
      });
      await loadSeating();
      toast.success('Seating map saved');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save seating map');
    } finally {
      setSeatingIsSaving(false);
    }
  };
  
  const handleDeleteInvite = async (inviteId) => {
    if (!confirm('Delete this invite?')) return;
    try {
      await eventAPI.deleteInvite(eventId, inviteId);
      toast.success('Invite deleted');
      loadInvites();
      loadStats();
    } catch (error) {
      toast.error('Failed to delete invite');
    }
  };
  
  const filtered = invites.filter(invite => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      invite.guestName.toLowerCase().includes(q) ||
      invite.inviteCode.toLowerCase().includes(q) ||
      invite.guestEmail?.toLowerCase().includes(q)
    );
  });

  // Counts for the filter chips reflect the current search, so they always add up to what is on screen.
  const statusCounts = {
    all: filtered.length,
    waiting: filtered.filter((i) => !i.checkedIn).length,
    in: filtered.filter((i) => i.checkedIn).length,
  };
  const byStatus = statusFilter === 'waiting' ? filtered.filter((i) => !i.checkedIn)
    : statusFilter === 'in' ? filtered.filter((i) => i.checkedIn)
    : filtered;

  // Sort: pending guests first, checked-in guests at bottom
  const sorted = [...byStatus].sort((a, b) => {
    if (a.checkedIn && !b.checkedIn) return 1;
    if (!a.checkedIn && b.checkedIn) return -1;
    return 0;
  });

  // Could not work out which event this is (bad subdomain, or offline on a device that never opened it)
  if (resolveError) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <AlertTriangle className="w-14 h-14 text-amber-400 mx-auto mb-4" />
          <h2 className="text-xl font-black text-white mb-2">Can't open check-in</h2>
          <p className="text-sm text-neutral-400 mb-6">{resolveError}</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => navigate('/')} className="px-4 py-2 border border-neutral-700 text-neutral-200 rounded-xl font-semibold hover:bg-neutral-900">Home</button>
            <button onClick={() => window.location.reload()} className="px-4 py-2 bg-white text-neutral-900 rounded-xl font-bold">Retry</button>
          </div>
        </div>
      </div>
    );
  }
  if (!eventId) return <SkeletonPage cards={4} />;   // resolving /e/:subdomain

  // Staff login gate. Staff sign in HERE with the username + PIN the organizer gave them. They used
  // to be bounced to the guest join page, which has no staff option and only issues guest tokens.
  if (!authState.ready) {
    return (
      <StaffLoginScreen
        eventId={eventId}
        eventTitle={gateTitle}
        notice={gateNotice}
        onLogin={handleStaffLogin}
        onOrganizer={() => navigate(subdomain ? `/e/${subdomain}` : `/event/${eventId}`)}
      />
    );
  }

  if (loading) {
    return <SkeletonPage cards={4} />;
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-neutral-900 mb-2">Failed to Load</h2>
          <p className="text-neutral-600 mb-6">{loadError}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => navigate(`/event/${eventId}`)}
              className="px-4 py-2 border border-neutral-200 rounded-xl font-semibold hover:bg-neutral-50"
            >
              Go Back
            </button>
            <button
              onClick={loadAllData}
              className="px-4 py-2 bg-neutral-900 text-white rounded-xl font-semibold hover:bg-black"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const seatingEnabled = seatingData?.seatingMap?.enabled;
  const tableInfoForAdmitted = admittedGuest?.tableId
    ? { id: admittedGuest.tableId, label: admittedGuest.tableLabel || admittedGuest.tableId }
    : null;
  
  return (
    <div className="min-h-screen bg-neutral-50" data-field16="">
      {showAdmitSuccess && admittedGuest && (
        <AdmitSuccessScreen
          guest={admittedGuest}
          tableInfo={tableInfoForAdmitted}
          onDone={resetScan}
          onShowMap={tableInfoForAdmitted ? handleShowMap : undefined}
        />
      )}
      {showDenyScreen && denyDetails && (
        <DenyScreen
          reason={denyDetails.reason}
          message={denyDetails.message}
          details={denyDetails}
          onDone={resetScan}
          canOverride={denyDetails.requiresOverride && settings?.allowManualOverride}
          onOverride={handleRequestOverride}
        />
      )}
      {currentGuest && (
        <BoardingPass
          guest={currentGuest}
          security={currentSecurity}
          requiresPin={requiresPin}
          staffNote={currentStaffNote}
          onAdmit={handleAdmit}
          onDeny={handleDenyFromBoarding}
          onPinVerify={handlePinVerify}
        />
      )}
      {showOverrideDialog && overrideInvite && (
        <ManagerOverrideDialog
          eventId={eventId}
          invite={overrideInvite}
          blockDetails={denyDetails}
          onOverrideSuccess={(result) => {
            setAdmittedGuest(result.invite);
            setShowOverrideDialog(false);
            setShowAdmitSuccess(true);
            loadInvites();
            loadStats();
          }}
          onCancel={() => {
            setShowOverrideDialog(false);
            setOverrideInvite(null);
          }}
        />
      )}
      {scanMode && <QRScanner onScan={handleScan} onClose={() => setScanMode(false)} />}
      {showInviteDialog && (
        <InviteDialog
          invite={editingInvite}
          eventId={eventId}
          event={event}
          tables={(seatingData?.seatingMap?.objects || []).filter(o => o.type !== 'zone' && o.type !== 'stage')}
          onClose={() => {
            setShowInviteDialog(false);
            setEditingInvite(null);
          }}
          onSave={() => {
            setShowInviteDialog(false);
            setEditingInvite(null);
            loadInvites();
            loadStats();
          }}
        />
      )}
      {showSettingsPanel && (
        <SecuritySettingsPanel
          eventId={eventId}
          userRole={authState.role}
          onClose={() => setShowSettingsPanel(false)}
          onSettingsUpdated={() => {
            loadSettings();
            toast.success('Settings updated');
          }}
        />
      )}
      {showAssignPanel && (
        <TableAssignmentPanel
          eventId={eventId}
          invites={invites}
          seatingObjects={seatingData?.seatingMap?.objects || []}
          onClose={() => setShowAssignPanel(false)}
          onSaved={() => { loadInvites(); loadSeating(); }}
          onOpenSeating={() => {
            setShowAssignPanel(false);
            if (!seatingData) setSeatingData({ seatingMap: { enabled: false, objects: [] }, guestsByTable: {} });
            setSeatingFocusId(null);
            setShowSeatingMap(true);
          }}
        />
      )}
      {showCsvImport && (
        <CsvImportDialog
          eventId={eventId}
          onClose={() => setShowCsvImport(false)}
          onImported={() => { setShowCsvImport(false); loadInvites(); loadStats(); }}
        />
      )}
      {showActivityLog && (
        <ActivityLogDialog
          eventId={eventId}
          onClose={() => setShowActivityLog(false)}
        />
      )}

      {/* ── First-run setup wizard (organizer only, no guests, key not set) ── */}
      {showSetupWizard && (
        <SetupWizard
          eventId={eventId}
          event={event}
          invites={invites}
          onClose={() => setShowSetupWizard(false)}
          onOpenAddGuest={() => setShowInviteDialog(true)}
          onOpenCsvImport={() => setShowCsvImport(true)}
        />
      )}

      {/* ── Seating map modal ── */}
      {showSeatingMap && seatingData && (
        <SeatingMap
          mode={authState.role === 'organizer' ? 'editor' : 'display'}
          objects={seatingData.seatingMap?.objects || []}
          guestsByTable={seatingData.guestsByTable || {}}
          allGuests={authState.role === 'organizer' ? invites : []}
          focusTableId={seatingFocusId}
          onSave={handleSaveSeatingMap}
          onClose={() => { setShowSeatingMap(false); setSeatingFocusId(null); }}
          isSaving={seatingIsSaving}
        />
      )}
      
      <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/95 pt-[env(safe-area-inset-top)] shadow-sm backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-3 sm:gap-3 sm:px-6 lg:px-10">
          {authState.role === 'organizer' ? (
            <button onClick={() => navigate(`/event/${eventId}`)} className="-ml-1 flex min-h-[44px] min-w-[44px] flex-shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-neutral-100 active:bg-neutral-200" aria-label="Back to event">
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : (
            // Staff have no event page. An installed app has no address bar, so give them a way home.
            <button onClick={() => navigate('/')} className="-ml-1 flex min-h-[44px] min-w-[44px] flex-shrink-0 items-center justify-center rounded-xl transition-colors hover:bg-neutral-100 active:bg-neutral-200" aria-label="Home">
              <HomeIcon className="h-5 w-5" />
            </button>
          )}

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold leading-tight text-neutral-900">{event?.title || 'Event'}</h1>
            <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
              <p className="flex-shrink-0 text-xs text-neutral-500">Check-in</p>
              {authState.username && (
                <span className={`truncate rounded px-1.5 py-0.5 text-xs font-semibold ${authState.role === 'staff' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {authState.username}
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-shrink-0 items-center gap-2">
            {/* Door-time actions stay one tap away. Everything else is in "More". */}
            {authState.role === 'organizer' && (
              <button
                onClick={() => setShowInviteDialog(true)}
                className="hidden min-h-[44px] items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 sm:flex md:px-3.5"
                title="Add guest"
                aria-label="Add guest"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden md:inline">Add guest</span>
              </button>
            )}
            <button
              onClick={() => setShowManual(v => !v)}
              aria-expanded={showManual}
              aria-label="Type an invite code"
              title="Type an invite code"
              className={`flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-xl border px-0 text-sm font-semibold transition-colors sm:px-3 md:px-3.5 ${showManual ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'}`}
            >
              <Keyboard className="h-4 w-4" />
              <span className="hidden md:inline">Type code</span>
            </button>
            <CheckinToolsMenu
              role={authState.role}
              seatingEnabled={seatingEnabled}
              onAddGuest={() => setShowInviteDialog(true)}
              onImportCsv={() => setShowCsvImport(true)}
              onSettings={() => setShowSettingsPanel(true)}
              onSeating={() => { setSeatingFocusId(null); setShowSeatingMap(true); }}
              onSetupSeating={() => {
                // Ensure seatingData is initialised so the modal renders (first layout for this event)
                if (!seatingData) setSeatingData({ seatingMap: { enabled: false, objects: [] }, guestsByTable: {} });
                setSeatingFocusId(null);
                setShowSeatingMap(true);
              }}
              onAssign={() => setShowAssignPanel(true)}
              onActivityLog={() => setShowActivityLog(true)}
              onLogout={handleStaffLogout}
            />
            <button
              onClick={() => {
                resetScan();
                setScanMode(true);
              }}
              className="hidden min-h-[44px] items-center gap-2 rounded-xl bg-neutral-900 px-5 text-sm font-bold text-white shadow-sm transition-all hover:bg-black sm:flex"
            >
              <Camera className="h-4 w-4" />
              Scan QR
              <span className="ml-1 hidden text-xs font-normal text-white/60 lg:inline">[S]</span>
            </button>
          </div>
        </div>

        {showManual && (
          <div className="border-t border-neutral-100 bg-neutral-50 px-3 py-3 sm:px-6 lg:px-10">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleScan(manualCode);
              }}
              className="mx-auto flex max-w-7xl gap-2"
            >
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                placeholder="Invite code, e.g. AB12CD34"
                aria-label="Invite code"
                className="min-h-[48px] min-w-0 flex-1 rounded-xl border border-neutral-200 bg-white px-4 font-mono text-base tracking-widest focus:border-neutral-400 focus:outline-none sm:max-w-md"
                autoFocus
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                inputMode="text"
              />
              <button type="submit" disabled={!manualCode.trim()} className="min-h-[48px] flex-shrink-0 rounded-xl bg-neutral-900 px-5 text-sm font-semibold text-white transition-all hover:bg-black disabled:opacity-40">
                Verify
              </button>
            </form>
          </div>
        )}
      </header>
      
      <main className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-8 lg:px-10">
        {/* Offline status: a full-width card on phones, a compact one on desktop. Opens the checklist. */}
        <div className="mb-4 flex flex-wrap items-center gap-2 sm:gap-3">
          <OfflineReadiness eventId={eventId} cacheVersion={cacheInfo?.builtAt || cacheInfo?.lastLocalUpdate || 0} onRefresh={syncNow} />
        </div>
        <InstallBanner variant="light" className="mb-4" />
        <OfflineQueuePanel eventId={eventId} pendingCount={pendingSync} onSync={syncNow} />
        {(isOffline || authState.expired) && (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3.5">
            <span className="mt-1.5 h-2 w-2 flex-shrink-0 animate-pulse rounded-full bg-amber-500" />
            <div className="text-sm leading-snug text-amber-900">
              <p className="font-bold">
                {isOffline ? 'Offline mode' : 'Session expired'}. Scanning works from the saved guest list
                {cacheInfo?.total ? ` (${cacheInfo.total} guests)` : ''}.
              </p>
              <p className="mt-1 text-amber-800/90">
                {cacheReady || cacheInfo?.total
                  ? `Admitted guests are saved on this device${pendingSync > 0 ? ` (${pendingSync} waiting to sync)` : ''} and upload automatically when the connection returns.`
                  : 'No guest list is saved on this device yet. Open this page once while online to enable offline scanning.'}
                {authState.expired && ' Log out and back in when you are online so they can sync.'}
              </p>
            </div>
          </div>
        )}

        {/* ── Stats: one headline card with progress, then four small numbers ── */}
        {(() => {
          const totalGroups = stats?.total ?? (invites.length || null);
          const checkedInGroups = stats ? (stats.checkedIn ?? 0) : (invites.length ? invites.filter(i => i.checkedIn).length : null);
          const pct = totalGroups ? Math.min(100, Math.round(((checkedInGroups || 0) / totalGroups) * 100)) : 0;
          const loadingStat = statsLoading || invitesLoading;
          const small = [
            { label: 'Total admitted', value: stats?.totalActualAttendees ?? (invites.length ? invites.filter(i => i.checkedIn).reduce((sum, i) => sum + (i.actualAttendees || i.groupSize || 1), 0) : null), color: 'text-emerald-700' },
            { label: 'Total groups', value: totalGroups, color: 'text-neutral-900' },
            { label: 'Adults expected', value: stats ? (stats.totalExpectedAdults ?? 0) : null, color: 'text-neutral-700' },
            { label: 'Children', value: stats ? (stats.totalExpectedChildren ?? 0) : null, color: 'text-indigo-600' },
          ];
          const Missing = ({ label }) => (loadingStat
            ? <div className="h-9 w-16 animate-pulse rounded-lg bg-neutral-100" aria-label={`${label} loading`} />
            : <div className="text-3xl font-black tabular-nums text-neutral-300" title="Unavailable offline">—</div>);
          return (
            <div className="mb-4 grid grid-cols-2 gap-3 sm:mb-6 sm:grid-cols-6 sm:gap-4">
              <div className="col-span-2 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-neutral-500">Checked in</p>
                    {checkedInGroups === null ? <div className="mt-1"><Missing label="Checked in" /></div> : (
                      <p className="mt-1 flex items-baseline gap-1.5">
                        <span className="text-4xl font-black tabular-nums text-emerald-600">{checkedInGroups}</span>
                        <span className="text-base font-semibold text-neutral-400">/ {totalGroups ?? 0} groups</span>
                      </p>
                    )}
                  </div>
                  {checkedInGroups !== null && <span className="text-2xl font-black tabular-nums text-emerald-600">{pct}%</span>}
                </div>
                <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-neutral-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Check-in progress">
                  <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
              </div>
              {small.map(({ label, value, color }) => (
                <div key={label} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:col-span-1 sm:p-5">
                  {value === null ? <Missing label={label} /> : <div className={`text-3xl font-black tabular-nums ${color}`}>{value}</div>}
                  <div className="mt-1 text-sm font-medium text-neutral-500">{label}</div>
                </div>
              ))}
            </div>
          );
        })()}

        <section aria-label="Guest list" className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div className="space-y-3 border-b border-neutral-100 px-4 pb-3 pt-4 sm:px-6 sm:pt-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold text-neutral-900">Guest list</h2>
              <span className="text-sm tabular-nums text-neutral-500">{sorted.length} {sorted.length === 1 ? 'group' : 'groups'}</span>
            </div>
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
                <input
                  type="search"
                  placeholder="Search name, code or email"
                  aria-label="Search guests"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoComplete="off"
                  enterKeyHint="search"
                  className="min-h-[48px] w-full rounded-xl border border-neutral-200 bg-white pl-10 pr-3 text-base focus:border-neutral-400 focus:outline-none sm:min-h-[44px] sm:text-sm"
                />
              </div>
              {authState.role === 'organizer' && (
                <button onClick={() => setShowInviteDialog(true)} aria-label="Add guest" className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 active:bg-emerald-100 sm:hidden">
                  <Plus className="h-5 w-5" />
                </button>
              )}
            </div>
            <div role="group" aria-label="Filter guests" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
              {[['all', 'All'], ['waiting', 'Waiting'], ['in', 'Admitted']].map(([id, label]) => (
                <button
                  key={id}
                  onClick={() => setStatusFilter(id)}
                  aria-pressed={statusFilter === id}
                  className={`flex min-h-[40px] flex-shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors ${statusFilter === id ? 'border-neutral-900 bg-neutral-900 text-white' : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'}`}
                >
                  {label}
                  <span className={`rounded-full px-1.5 text-xs tabular-nums ${statusFilter === id ? 'bg-white/20 text-white' : 'bg-neutral-100 text-neutral-500'}`}>{statusCounts[id]}</span>
                </button>
              ))}
            </div>
          </div>

          {invitesStale && invitesLoading && (
            <div className="border-b border-neutral-100 bg-neutral-50 px-4 py-2.5 text-sm font-medium text-neutral-500 sm:px-6">
              Showing saved guest list · updating…
            </div>
          )}
          {invitesError && (
            <div className="flex items-center justify-between gap-3 border-b border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800 sm:px-6">
              <span>{invitesError}{invites.length ? ' Showing the last saved list.' : ''}</span>
              <button onClick={loadInvites} className="min-h-[44px] flex-shrink-0 px-2 font-bold underline">Retry</button>
            </div>
          )}

          <div className={`divide-y divide-neutral-100 ${invitesStale ? 'pointer-events-none select-none opacity-70' : ''}`}>
            {invitesLoading && invites.length === 0 ? (
              <SkeletonRows rows={8} />
            ) : sorted.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-neutral-500">
                {invites.length === 0 ? (
                  <div>
                    <p className="mb-4">No guests yet.</p>
                    <button
                      onClick={() => setShowInviteDialog(true)}
                      className="inline-flex min-h-[48px] items-center gap-2 rounded-xl bg-neutral-900 px-5 text-sm font-semibold text-white hover:bg-black"
                    >
                      <Plus className="h-4 w-4" />
                      Add first guest
                    </button>
                  </div>
                ) : (
                  <div>
                    <p>{searchQuery.trim() ? 'No guests match your search.' : statusFilter === 'in' ? 'Nobody has been admitted yet.' : 'Everyone is checked in.'}</p>
                    {(searchQuery.trim() || statusFilter !== 'all') && (
                      <button onClick={() => { setSearchQuery(''); setStatusFilter('all'); }} className="mt-3 min-h-[44px] px-3 text-sm font-semibold text-neutral-800 underline">Clear search and filters</button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              sorted.slice(0, visibleCount).map((invite) => {
                const adults = invite.adults || 1;
                const children = invite.children || 0;
                const total = adults + children;
                const canEdit = authState.role === 'organizer' && !String(invite._id).startsWith('cached-');

                return (
                  <div
                    key={invite._id}
                    className={`px-4 py-3.5 transition-colors hover:bg-neutral-50 sm:px-6 sm:py-4 ${invite.checkedIn ? 'bg-emerald-50/50 hover:bg-emerald-50' : ''}`}
                  >
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div
                        className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-base font-bold ${invite.checkedIn ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}`}
                        aria-hidden="true"
                      >
                        {invite.guestName.charAt(0).toUpperCase()}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="min-w-0 break-words text-base font-semibold leading-snug text-neutral-900">{invite.guestName}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                          <RoleBadge role={invite.guestRole || 'GUEST'} />
                          {invite.tableLabel && (
                            <span className="inline-flex items-center gap-1 rounded-md border border-violet-200 bg-violet-100 px-1.5 py-0.5 text-xs font-bold text-violet-700">
                              <MapPin className="h-3 w-3" />
                              {invite.tableLabel}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-neutral-500">
                          <span className="font-mono font-medium text-neutral-600">{invite.inviteCode}</span>
                          <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" aria-hidden="true" />{adults} adult{adults !== 1 ? 's' : ''}</span>
                          {children > 0 && <span className="flex items-center gap-1"><Baby className="h-3.5 w-3.5 text-blue-400" aria-hidden="true" />{children} child{children !== 1 ? 'ren' : ''}</span>}
                          <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" aria-hidden="true" />{total} total</span>
                        </div>
                      </div>

                      <div className="flex flex-shrink-0 items-center gap-1.5">
                        {invite.checkedIn ? (
                          <div className="text-right">
                            <div className="flex items-center justify-end gap-1 text-sm font-bold text-emerald-600">
                              <CheckCircle2 className="h-4 w-4" />
                              Admitted
                            </div>
                            <p className="mt-0.5 flex items-center justify-end gap-1 text-xs text-neutral-500">
                              <Clock className="h-3 w-3" />
                              {new Date(invite.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        ) : (
                          <>
                            {/* Edit / delete are organizer-only on the server (staff would just get 403s),
                                and cached rows have no server id to act on while offline. On phones they move
                                to their own line below so the row stays readable. */}
                            {canEdit && (
                              <>
                                <button
                                  onClick={() => { setEditingInvite(invite); setShowInviteDialog(true); }}
                                  className="hidden h-10 w-10 items-center justify-center rounded-lg text-neutral-400 transition-all hover:bg-neutral-100 hover:text-neutral-700 sm:flex"
                                  title="Edit"
                                  aria-label={`Edit ${invite.guestName}`}
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteInvite(invite._id)}
                                  className="hidden h-10 w-10 items-center justify-center rounded-lg text-neutral-400 transition-all hover:bg-red-50 hover:text-red-600 sm:flex"
                                  title="Delete"
                                  aria-label={`Delete ${invite.guestName}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleScan(invite.inviteCode)}
                              className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white transition-all hover:bg-black active:bg-black sm:min-h-[40px]"
                            >
                              <UserCheck className="h-4 w-4" />
                              Check in
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Notes matter at the door (allergies, access needs), so show them rather than hiding them in a tooltip */}
                    {invite.notes && (
                      <p className="mt-2.5 line-clamp-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-snug text-amber-900 sm:ml-[3.75rem]">
                        <span className="font-semibold">Note: </span>{invite.notes}
                      </p>
                    )}

                    {invite.checkedIn && invite.tableId && seatingEnabled && (
                      <button
                        onClick={() => { setSeatingFocusId(invite.tableId); setShowSeatingMap(true); }}
                        className="mt-2 flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-violet-700 hover:text-violet-900 sm:ml-[3.75rem]"
                      >
                        <MapPin className="h-4 w-4" /> Show table on map
                      </button>
                    )}

                    {!invite.checkedIn && canEdit && (
                      <div className="-mb-1 mt-1 flex gap-1 pl-[3.75rem] sm:hidden">
                        <button
                          onClick={() => { setEditingInvite(invite); setShowInviteDialog(true); }}
                          className="-ml-3 flex min-h-[44px] items-center gap-2 rounded-xl px-3 text-sm font-semibold text-neutral-600 active:bg-neutral-100"
                        >
                          <Edit2 className="h-4 w-4" /> Edit
                        </button>
                        <button
                          onClick={() => handleDeleteInvite(invite._id)}
                          className="flex min-h-[44px] items-center gap-2 rounded-xl px-3 text-sm font-semibold text-red-600 active:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
            {sorted.length > visibleCount && (
              <div className="px-4 py-4 text-center sm:px-6">
                <button
                  onClick={() => setVisibleCount(c => c + GUEST_PAGE_SIZE)}
                  className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 px-5 text-sm font-bold text-neutral-700 hover:bg-neutral-50 sm:inline-flex sm:w-auto"
                >
                  <ChevronDown className="h-4 w-4" />
                  Show {Math.min(GUEST_PAGE_SIZE, sorted.length - visibleCount)} more · {sorted.length - visibleCount} remaining
                </button>
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-10 pt-6 pb-28 sm:pb-6 flex flex-wrap items-center justify-between gap-2">
        {/* Offline indicator */}
        {isOffline && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-xs font-bold text-amber-700">
              Offline{pendingSync > 0 ? ` — ${pendingSync} check-in${pendingSync !== 1 ? 's' : ''} queued` : ' — using cached guest list'}
            </span>
          </div>
        )}
        {isOffline && cacheInfo && (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800">
            <Clock className="w-3.5 h-3.5 text-neutral-500" />
            <span className="text-xs font-semibold text-neutral-300">
              Cache: {cacheInfo.total} guests · {cacheInfo.builtAt ? new Date(cacheInfo.builtAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'saved'}
            </span>
          </div>
        )}
        {!isOffline && pendingSync > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/30">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-xs font-bold text-blue-700">Syncing {pendingSync} offline check-in{pendingSync !== 1 ? 's' : ''}…</span>
          </div>
        )}
        {syncError && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/30">
            <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
            <span className="text-xs font-bold text-red-700">{syncError}</span>
          </div>
        )}
        {!isOffline && pendingSync === 0 && !syncError && (
          <p className="text-xs text-neutral-400 font-medium tracking-wide">
            Powered by <span className="font-black text-neutral-500">Planit</span>
          </p>
        )}
      </footer>

      <SecurityAlerts
        alerts={secAlerts}
        onDismiss={dismissSecAlert}
        onDismissAll={dismissAllSecAlerts}
      />

      {/* ── Walkie-talkie PTT button — visible to all staff/organizers ── */}
      {authState.ready && (
        <div className={(currentGuest || showAdmitSuccess || showDenyScreen || showAssignPanel) ? 'hidden sm:block' : ''}>
          <WalkieTalkieButton walkie={walkie} />
        </div>
      )}

      {/* ── Mobile: scan is always one tap away, wherever you are in the list ── */}
      {!scanMode && !currentGuest && !showAdmitSuccess && !showDenyScreen && (
        <button
          onClick={() => { resetScan(); setScanMode(true); }}
          aria-label="Scan QR code"
          className="sm:hidden fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-4 z-40 flex min-h-[56px] items-center gap-2.5 pl-5 pr-6 bg-neutral-900 text-white text-base font-bold rounded-2xl shadow-2xl active:scale-95 transition-transform"
        >
          <Camera className="w-5 h-5" />
          Scan QR
        </button>
      )}
    </div>
  );
}

export default function EnterpriseCheckin() {
  return (
    <CheckinErrorBoundary>
      <EnterpriseCheckinInner />
    </CheckinErrorBoundary>
  );
}
