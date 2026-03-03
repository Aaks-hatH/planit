import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  QrCode, UserCheck, Users, X, ArrowLeft, Camera, CameraOff, Plus,
  Keyboard, AlertTriangle, Baby, User, Settings, Lock, Edit2, Trash2,
  Clock, CheckCircle2, Loader2, CheckCircle, Flag, AlertOctagon, XCircle, 
  Mail, Phone, Copy, ExternalLink, Share2, FileText, LogOut, Eye, EyeOff,
  TrendingUp, ScanLine, BarChart2, Info, Upload, Star, Mic, Shield, MapPin,
} from 'lucide-react';
import { eventAPI } from '../services/api';
import toast from 'react-hot-toast';
import ManagerOverrideDialog from '../components/ManagerOverrideDialog';
import SecuritySettingsPanel from '../components/SecuritySettingsPanel';
import socketService from '../services/socket';
import offlineCheckin from '../services/offlineCheckin';
import SecurityAlerts, { useSecurityAlerts } from '../components/SecurityAlerts';
import WalkieTalkieButton from '../components/WalkieTalkieButton';
import SeatingMap from '../components/SeatingMap';
import { useWalkieTalkie } from '../hooks/useWalkieTalkie';

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
// STAFF LOGIN SCREEN
// ═══════════════════════════════════════════════════════════════════════════
function StaffLoginScreen({ eventId, eventTitle, onLogin }) {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username.trim() || !pin) { setError('Username and PIN are required'); return; }
    setLoading(true);
    setError('');
    try {
      const response = await eventAPI.staffLogin(eventId, username.trim(), pin);
      const { token, role } = response.data;
      localStorage.setItem('eventToken', token);
      onLogin({ token, role, username: response.data.username });
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid username or PIN');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-neutral-800 border border-neutral-700 flex items-center justify-center">
            <ScanLine className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-white text-2xl font-black mb-1">Check-in Staff Login</h1>
          <p className="text-neutral-400 text-sm">{eventTitle || 'Event Check-in'}</p>
        </div>

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
    <div className="fixed inset-0 bg-emerald-600 z-50 flex flex-col items-center justify-center p-8">
      <div className="max-w-3xl w-full bg-white rounded-lg overflow-hidden shadow-2xl">
        {/* Green status bar */}
        <div className="h-3 bg-emerald-600" />
        
        {/* Main content */}
        <div className="p-12 text-center">
          {/* Checkmark circle */}
          <div className="mb-8">
            <div className="w-32 h-32 mx-auto rounded-full border-8 border-emerald-600 flex items-center justify-center">
              <CheckCircle className="w-20 h-20 text-emerald-600" strokeWidth={3} />
            </div>
          </div>
          
          {/* Status text */}
          <div className="mb-8">
            <p className="text-sm font-bold text-emerald-600 uppercase tracking-widest mb-3">
               Pass Accepted
            </p>
            <h1 className="text-6xl font-bold text-neutral-900 mb-4">
              ADMITTED
            </h1>
            <p className="text-3xl font-semibold text-neutral-700">
              {guest.guestName}
            </p>
            {guest.guestRole && guest.guestRole !== 'GUEST' && (
              <div className="mt-3 flex justify-center">
                <RoleBadge role={guest.guestRole} size="md" />
              </div>
            )}

            {/* ── Table assignment callout ── */}
            {tableInfo && (
              <div className="mt-6 inline-flex items-center gap-3 px-5 py-3 bg-emerald-50 border-2 border-emerald-300 rounded-xl">
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
            <div className="flex justify-center gap-16 text-lg">
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
        <div className="bg-neutral-50 px-12 py-6 border-t border-neutral-200 flex items-center justify-between">
          <p className="text-sm text-neutral-500">
            {paused ? 'Screen paused — tap Done when ready' : `Auto-closing in ${countdown}s...`}
          </p>
          <div className="flex items-center gap-3">
            <span className="text-xs text-neutral-400 font-medium tracking-wide">
              Powered by <span className="font-black text-neutral-600">Planit</span>
            </span>
            <div className="w-px h-4 bg-neutral-200" />
            <button
              onClick={() => setPaused(v => !v)}
              className="px-4 py-2 text-sm font-semibold text-neutral-600 border border-neutral-200 rounded-xl hover:bg-neutral-100 transition-all"
            >
              {paused ? 'Resume' : 'Keep Open'}
            </button>
            <button
              onClick={onDone}
              className="px-4 py-2 text-sm font-semibold bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all"
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
    <div className={`fixed inset-0 ${config.bg} z-50 flex flex-col items-center justify-center p-8`}>
      <div className="max-w-3xl w-full bg-white rounded-lg overflow-hidden shadow-2xl">
        {/* Status bar */}
        <div className={`h-3 ${config.bg}`} />
        
        {/* Main content */}
        <div className="p-12">
          {/* Large X icon */}
          <div className="mb-8 text-center">
            <div className={`w-32 h-32 mx-auto rounded-full border-8 ${
              details?.severity === 'critical' ? 'border-red-600' :
              details?.severity === 'high' ? 'border-orange-600' :
              'border-yellow-500'
            } flex items-center justify-center`}>
              <IconComponent className={`w-20 h-20 ${
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
            <h1 className="text-5xl font-bold text-neutral-900 mb-6">
              {config.text}
            </h1>
            <p className="text-2xl font-semibold text-neutral-700 mb-8">
              {message || details?.displayMessage || 'Access denied'}
            </p>
          </div>
          
          {/* BLOCK REASONS - CLEAR AND PROMINENT */}
          <div className="bg-neutral-50 border-2 border-neutral-200 rounded-lg p-6 mb-8">
            <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-4">
              Denial Information
            </p>
            
            <div className="space-y-4">
              {/* Primary Reason */}
              {details?.blockedReason && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-red-600 rounded-full mt-2 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-bold text-neutral-900 mb-1">Reason</p>
                    <p className="text-lg text-neutral-700">
                      {details.blockedReason.replace(/_/g, ' ').toUpperCase()}
                    </p>
                  </div>
                </div>
              )}
              
              {/* Check-in History */}
              {details?.checkedInAt && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-neutral-400 rounded-full mt-2 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-bold text-neutral-900 mb-1">Previous Check-In</p>
                    <p className="text-lg text-neutral-700">
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
                  <div className="flex-1">
                    <p className="font-bold text-neutral-900 mb-1">Details</p>
                    <p className="text-neutral-700">{details.message}</p>
                  </div>
                </div>
              )}
              
              {/* Capacity Info */}
              {details?.currentCapacity !== undefined && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-neutral-400 rounded-full mt-2 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-bold text-neutral-900 mb-1">Capacity Status</p>
                    <p className="text-lg text-neutral-700">
                      {details.currentCapacity} / {details.maxCapacity} attendees
                    </p>
                  </div>
                </div>
              )}
              
              {/* Trust Score */}
              {details?.trustScore !== undefined && (
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 bg-neutral-400 rounded-full mt-2 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="font-bold text-neutral-900 mb-1">Trust Score</p>
                    <p className="text-lg text-neutral-700">
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
                  <div className="flex-1">
                    <p className="font-bold text-neutral-900 mb-1">Lockdown Active</p>
                    <p className="text-lg text-neutral-700">{details.lockdownReason}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Action buttons */}
          <div className="flex gap-4">
            <button 
              onClick={onDone} 
              className="flex-1 px-8 py-4 bg-neutral-200 text-neutral-900 text-xl font-bold rounded-lg hover:bg-neutral-300 transition-all"
            >
              Close
            </button>
            {canOverride && (
              <button 
                onClick={onOverride} 
                className="flex-1 px-8 py-4 bg-white text-neutral-900 text-xl font-bold rounded-lg hover:bg-neutral-100 transition-all border-2 border-white/80"
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
// BOARDING PASS REVIEW - Airport Style with Warnings
// ═══════════════════════════════════════════════════════════════════════════
function BoardingPass({ guest, security, requiresPin, onAdmit, onDeny, onPinVerify }) {
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [verifyingPin, setVerifyingPin] = useState(false);
  const [pinVerified, setPinVerified] = useState(false);
  
  const hasWarnings = security?.warnings?.length > 0 || security?.flags?.length > 0;
  const trustScore = security?.trustScore || 100;

  const handlePinSubmit = async () => {
    if (!pin.trim()) {
      setPinError('Please enter PIN');
      return;
    }
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
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Status bar - Yellow if warnings, Green if clear */}
        <div className={`h-3 ${hasWarnings ? 'bg-yellow-500' : 'bg-green-600'}`} />
        
        {/* Header */}
        <div className="p-6 border-b border-neutral-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">
                Pass Review
              </p>
              <h2 className="text-3xl font-bold text-neutral-900">{guest.guestName}</h2>
              <div className="mt-2">
                <RoleBadge role={guest.guestRole || 'GUEST'} size="md" />
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">
                Confirmation Code
              </p>
              <p className="text-2xl font-mono font-bold text-neutral-900">{guest.inviteCode}</p>
            </div>
          </div>

          {/* Table assignment banner */}
          {guest.tableId && (
            <div className="mt-4 flex items-center gap-2.5 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
              <MapPin className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <div>
                <p className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Table Assignment</p>
                <p className="text-base font-black text-emerald-900">{guest.tableLabel || guest.tableId}</p>
              </div>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Passenger details */}
          <div className="grid grid-cols-3 gap-4">
            <div className="border border-neutral-200 rounded-lg p-4">
              <p className="text-xs font-bold text-neutral-500 uppercase mb-2">Adults</p>
              <p className="text-4xl font-bold text-neutral-900">{guest.adults}</p>
            </div>
            <div className="border border-neutral-200 rounded-lg p-4">
              <p className="text-xs font-bold text-neutral-500 uppercase mb-2">Children</p>
              <p className="text-4xl font-bold text-neutral-900">{guest.children}</p>
            </div>
            <div className="border border-neutral-200 rounded-lg p-4">
              <p className="text-xs font-bold text-neutral-500 uppercase mb-2">Trust Score</p>
              <p className={`text-4xl font-bold ${
                trustScore >= 80 ? 'text-green-600' : 
                trustScore >= 50 ? 'text-yellow-600' : 
                'text-red-600'
              }`}>{trustScore}</p>
            </div>
          </div>

          {/* Contact info */}
          {(guest.guestEmail || guest.guestPhone) && (
            <div className="border border-neutral-200 rounded-lg p-4">
              <p className="text-xs font-bold text-neutral-500 uppercase mb-3">Contact Information</p>
              <div className="space-y-2">
                {guest.guestEmail && (
                  <p className="text-neutral-700">
                    <span className="font-semibold">Email:</span> {guest.guestEmail}
                  </p>
                )}
                {guest.guestPhone && (
                  <p className="text-neutral-700">
                    <span className="font-semibold">Phone:</span> {guest.guestPhone}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {guest.notes && (
            <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
              <p className="text-xs font-bold text-blue-900 uppercase mb-2">Special Notes</p>
              <p className="text-neutral-700">{guest.notes}</p>
            </div>
          )}

          {/* SECURITY WARNINGS - PROMINENT */}
          {hasWarnings && (
            <div className="bg-yellow-50 border-2 border-yellow-500 rounded-lg p-6">
              <div className="flex items-start gap-3 mb-4">
                <AlertTriangle className="w-6 h-6 text-yellow-700 flex-shrink-0 mt-1" />
                <div>
                  <p className="text-sm font-bold text-yellow-900 uppercase tracking-wider mb-1">
                    Security Alert
                  </p>
                  <p className="text-yellow-800">
                    Review the following warnings before admitting attendee
                  </p>
                </div>
              </div>
              
              <div className="space-y-3">
                {security?.warnings?.map((warning, idx) => (
                  <div key={idx} className="bg-white rounded p-3 border border-yellow-300">
                    <p className="font-bold text-neutral-900 mb-1">
                      {warning.type?.replace(/_/g, ' ').toUpperCase()}
                    </p>
                    <p className="text-neutral-700">{warning.message}</p>
                  </div>
                ))}
                {security?.flags?.map((flag, idx) => (
                  <div key={idx} className="bg-white rounded p-3 border border-yellow-300">
                    <p className="font-bold text-neutral-900 mb-1">
                      {flag.flag?.replace(/_/g, ' ').toUpperCase()}
                    </p>
                    {flag.notes && <p className="text-neutral-700">{flag.notes}</p>}
                    <p className="text-xs text-neutral-500 mt-2">
                      Flagged: {new Date(flag.flaggedAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PIN entry */}
          {requiresPin && guest.hasPin && (
            <div className="bg-red-50 border-2 border-red-500 rounded-lg p-6">
              <div className="flex items-start gap-3 mb-4">
                <Lock className="w-6 h-6 text-red-700 flex-shrink-0 mt-1" />
                <div>
                  <p className="text-sm font-bold text-red-900 uppercase tracking-wider mb-1">
                    PIN Verification Required
                  </p>
                  <p className="text-red-800">
                    This attendee must provide their security PIN
                  </p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <input
                  type="text"
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value.toUpperCase());
                    setPinError('');
                  }}
                  placeholder="Enter PIN"
                  className="flex-1 border-2 border-red-300 rounded-lg px-4 py-3 text-xl font-mono font-bold focus:outline-none focus:border-red-500 bg-white"
                  maxLength={6}
                />
                <button 
                  onClick={handlePinSubmit} 
                  disabled={verifyingPin}
                  className="px-8 py-3 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition-all disabled:opacity-50"
                >
                  {verifyingPin ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify'}
                </button>
              </div>
              {pinError && (
                <p className="text-sm text-red-700 font-semibold mt-2">{pinError}</p>
              )}
              {pinVerified && (
                <p className="text-sm text-green-700 font-semibold mt-2 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" /> PIN Verified
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="border-t border-neutral-200 p-6 flex gap-4 bg-neutral-50">
          <button 
            onClick={onDeny} 
            className="flex-1 px-8 py-4 bg-red-100 text-red-700 text-xl font-bold rounded-lg hover:bg-red-200 transition-all border-2 border-red-300"
          >
            DENY ENTRY
          </button>
          <button 
            onClick={onAdmit} 
            disabled={requiresPin && !pinVerified}
            className="flex-1 px-8 py-4 bg-green-600 text-white text-xl font-bold rounded-lg hover:bg-green-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg"
          >
            ADMIT ATTENDEE
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
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const html5QrCodeRef = useRef(null);
  const isMountedRef = useRef(true);
  const isStoppingRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    startScanner();
    return () => {
      isMountedRef.current = false;
      stopScanner();
    };
  }, []);

  const stopScanner = async () => {
    const scanner = html5QrCodeRef.current;
    if (!scanner || isStoppingRef.current) return;
    isStoppingRef.current = true;
    html5QrCodeRef.current = null;
    try {
      const state = scanner.getState();
      // Only call stop() if actually running (state 2 = SCANNING)
      if (state === 2) {
        await scanner.stop();
      }
    } catch (err) {
      // Swallow — scanner was never running, nothing to stop
    } finally {
      isStoppingRef.current = false;
    }
  };

  const startScanner = async () => {
    if (!isMountedRef.current) return;
    try {
      setScanning(true);
      setError(null);

      const { Html5Qrcode } = await import('html5-qrcode');

      if (!isMountedRef.current) return; // Component unmounted during import

      const html5QrCode = new Html5Qrcode("qr-reader");
      html5QrCodeRef.current = html5QrCode;

      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        experimentalFeatures: { useBarCodeDetectorIfSupported: true }
      };

      const onSuccess = (decodedText) => {
        stopScanner();
        onScan(decodedText);
      };

      const onScanError = () => {
        // Suppress per-frame scan errors — normal while searching for QR
      };

      // First try back camera (environment)
      try {
        await html5QrCode.start(
          { facingMode: { exact: "environment" } },
          config,
          onSuccess,
          onScanError
        );
      } catch (envErr) {
        // AbortError or OverconstrainedError — back camera unavailable or timed out
        // Fall back to any available camera
        if (!isMountedRef.current) return;
        if (html5QrCodeRef.current) {
          try {
            const state = html5QrCode.getState();
            if (state === 2) await html5QrCode.stop();
          } catch (_) {}
        }
        const fallbackScanner = new Html5Qrcode("qr-reader");
        html5QrCodeRef.current = fallbackScanner;
        await fallbackScanner.start(
          { facingMode: "user" }, // Front camera fallback
          config,
          onSuccess,
          onScanError
        );
      }

      if (isMountedRef.current) setScanning(true);

    } catch (err) {
      if (!isMountedRef.current) return;

      let message;
      if (err.name === 'NotAllowedError' || err.message?.includes('Permission')) {
        message = 'Camera permission denied. Tap the camera icon in your browser address bar and allow access, then try again.';
      } else if (err.name === 'NotFoundError' || err.message?.includes('Requested device not found')) {
        message = 'No camera found on this device.';
      } else if (err.name === 'NotReadableError' || err.message?.includes('in use')) {
        message = 'Camera is in use by another app. Close any other apps or tabs using the camera and try again.';
      } else if (err.name === 'AbortError' || err.message?.includes('Timeout') || err.message?.includes('AbortError')) {
        message = 'Camera took too long to start. Close other apps using the camera, then tap Retry.';
      } else if (err.name === 'OverconstrainedError') {
        message = 'Camera settings not supported on this device. Tap Retry to try again.';
      } else {
        message = `Could not start camera. ${err.message || 'Please check permissions and try again.'}`;
      }

      setError(message);
      setScanning(false);
    }
  };

  const handleRetry = async () => {
    await stopScanner();
    // Small delay to let the camera hardware fully release
    setTimeout(() => {
      if (isMountedRef.current) startScanner();
    }, 800);
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 backdrop-blur-sm border-b border-white/10">
        <button onClick={onClose} className="text-white flex items-center gap-2 hover:opacity-80">
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <span className="text-white text-sm font-semibold">SCAN QR CODE</span>
        <div className="w-16" />
      </div>
      
      <div className="flex-1 relative flex items-center justify-center bg-black">
        {error ? (
          <div className="text-center text-white p-8">
            <CameraOff className="w-16 h-16 mx-auto mb-4 text-red-400" />
            <p className="text-lg font-semibold mb-2">Camera Error</p>
            <p className="text-sm text-neutral-300 mb-8 max-w-xs mx-auto">{error}</p>
            <div className="flex flex-col gap-3 max-w-xs mx-auto">
              <button
                onClick={handleRetry}
                className="px-6 py-3 bg-white text-black rounded-xl font-semibold hover:bg-neutral-200"
              >
                Retry Camera
              </button>
              <button
                onClick={onClose}
                className="px-6 py-3 bg-neutral-700 text-white rounded-xl font-semibold hover:bg-neutral-600"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-md px-4">
            {/* QR Reader div - DO NOT REMOVE */}
            <div id="qr-reader" className="rounded-2xl overflow-hidden shadow-2xl"></div>
            <p className="text-white text-center mt-6 text-sm">
               Position QR code within the frame
            </p>
            <p className="text-neutral-400 text-center mt-2 text-xs">
              Scanning automatically when QR code is detected
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// INVITE DIALOG WITH LINK COPYING
// ═══════════════════════════════════════════════════════════════════════════
function InviteDialog({ invite, eventId, event, onClose, onSave }) {
  const [formData, setFormData] = useState({
    guestName: invite?.guestName || '',
    guestEmail: invite?.guestEmail || '',
    guestPhone: invite?.guestPhone || '',
    guestRole: invite?.guestRole || 'GUEST',
    adults: invite?.adults || 1,
    children: invite?.children || 0,
    notes: invite?.notes || '',
    securityPin: invite?.securityPin || '',
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
      if (invite) {
        await eventAPI.updateInvite(eventId, invite._id, formData);
        toast.success('Invite updated');
        onSave();
      } else {
        const response = await eventAPI.createInvite(eventId, formData);
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
    return `${apiBase}/invite/${createdInvite.inviteCode}/qr.svg`;
  };

  if (showSuccess && createdInvite) {
    return (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl" onClick={e => e.stopPropagation()}>
          <div className="text-center mb-6">
            <CheckCircle className="w-16 h-16 text-emerald-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Invite Created!</h2>
            <p className="text-neutral-600">Send this link to {formData.guestName}</p>
          </div>

          {/* QR Code */}
          <div className="bg-neutral-50 rounded-xl p-6 mb-4">
            <img src={getQRCodeUrl()} alt="QR Code" className="w-48 h-48 mx-auto mb-4" />
            <p className="text-center font-mono font-bold text-lg">{createdInvite.inviteCode}</p>
          </div>

          {/* Invite Link */}
          <div className="mb-6">
            <label className="block text-sm font-semibold mb-2">Invite Link</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={getInviteLink()}
                readOnly
                className="flex-1 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm font-mono bg-neutral-50"
              />
              <button
                onClick={copyInviteLink}
                className="px-4 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 flex items-center gap-2"
              >
                <Copy className="w-4 h-4" />
                Copy
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => {
                setShowSuccess(false);
                setCreatedInvite(null);
                onSave();
              }}
              className="flex-1 px-4 py-2.5 bg-neutral-900 text-white rounded-xl font-semibold hover:bg-black"
            >
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
              className="flex-1 px-4 py-2.5 border border-neutral-200 rounded-xl font-semibold hover:bg-neutral-50 flex items-center justify-center gap-2"
            >
              <Mail className="w-4 h-4" />
              {formData.guestEmail ? 'Send Invite Email' : 'Share Invite'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">{invite ? 'Edit' : 'Create'} Invite</h2>
          <button onClick={onClose} className="p-1 hover:bg-neutral-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-1">Guest Name *</label>
            <input
              type="text"
              value={formData.guestName}
              onChange={(e) => setFormData({ ...formData, guestName: e.target.value })}
              className="w-full border border-neutral-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-neutral-400"
              placeholder="John Smith"
              required
            />
          </div>
          {/* Role picker */}
          <div>
            <label className="block text-sm font-semibold mb-1">Guest Role</label>
            <div className="grid grid-cols-3 gap-2">
              {['GUEST', 'VIP', 'SPEAKER'].map(role => {
                const cfg = ROLE_CONFIG[role];
                const Icon = cfg.icon;
                const active = formData.guestRole === role;
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setFormData({ ...formData, guestRole: role })}
                    className={`flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 text-xs font-bold uppercase tracking-wide transition-all
                      ${active
                        ? `${cfg.bg} ${cfg.text} ${cfg.border} shadow-sm`
                        : 'border-neutral-200 text-neutral-400 hover:border-neutral-300'
                      }`}
                  >
                    <Icon className="w-4 h-4" />
                    {role}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-neutral-400 mt-1">Shown to staff at check-in. Defaults to Guest.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold mb-1">Adults</label>
              <input
                type="number"
                value={formData.adults}
                onChange={(e) => setFormData({ ...formData, adults: parseInt(e.target.value) || 0 })}
                className="w-full border border-neutral-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-neutral-400"
                min="0"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Children</label>
              <input
                type="number"
                value={formData.children}
                onChange={(e) => setFormData({ ...formData, children: parseInt(e.target.value) || 0 })}
                className="w-full border border-neutral-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-neutral-400"
                min="0"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">
              Email <span className="text-red-500">*</span>
              <span className="ml-1.5 text-xs font-normal text-neutral-500">(required)</span>
            </label>
            <input
              type="email"
              value={formData.guestEmail}
              onChange={(e) => setFormData({ ...formData, guestEmail: e.target.value })}
              className="w-full border border-neutral-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-neutral-400"
              placeholder="john@email.com"
              required
            />
            <p className="text-xs text-neutral-500 mt-1 flex items-center gap-1">
              <Info className="w-3 h-3 flex-shrink-0" />
              Used for duplicate detection and sending invite links. PlanIt does not auto-send emails — use the Share button after saving.
            </p>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Phone</label>
            <input
              type="tel"
              value={formData.guestPhone}
              onChange={(e) => setFormData({ ...formData, guestPhone: e.target.value })}
              className="w-full border border-neutral-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-neutral-400"
              placeholder="555-1234"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Security PIN (optional)</label>
            <input
              type="text"
              value={formData.securityPin}
              onChange={(e) => setFormData({ ...formData, securityPin: e.target.value.toUpperCase() })}
              className="w-full border border-neutral-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-neutral-400 font-mono"
              placeholder="ABC123"
              maxLength={6}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full border border-neutral-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-neutral-400 resize-none"
              rows={3}
              placeholder="Special requirements, dietary restrictions, etc."
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-neutral-200 rounded-xl font-semibold hover:bg-neutral-50">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 bg-neutral-900 text-white rounded-xl font-semibold hover:bg-black disabled:opacity-50">
              {saving ? 'Saving...' : invite ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
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

  const TEMPLATE = `guestName,guestEmail,guestRole,adults,children,securityPin,notes
Jane Smith,jane@example.com,VIP,1,0,,VIP table reserved
Bob Jones,bob@example.com,SPEAKER,1,0,,Keynote speaker
Alice Brown,alice@example.com,GUEST,2,1,,Nut allergy`;

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

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Import Guests from CSV</h2>
            <p className="text-sm text-neutral-500 mt-0.5">Bulk-add guests with roles, group sizes, and notes</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-neutral-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Format guide */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm space-y-2">
            <p className="font-bold text-blue-900">Required CSV format</p>
            <p className="text-blue-800 font-mono text-xs leading-relaxed break-all">
              guestName, <span className="underline decoration-dotted">guestEmail</span>, guestRole, adults, children, securityPin, notes
            </p>
            <div className="space-y-1 text-xs text-blue-700">
              <p><span className="font-bold">guestName</span> — required</p>
              <p><span className="font-bold">guestEmail</span> — <span className="font-bold text-red-600">required</span>. Used for duplicate detection and sending invite links.</p>
              <p><span className="font-bold">guestRole</span> — optional. Must be <code className="bg-blue-100 px-1 rounded">GUEST</code>, <code className="bg-blue-100 px-1 rounded">VIP</code>, or <code className="bg-blue-100 px-1 rounded">SPEAKER</code>. Defaults to GUEST.</p>
              <p><span className="font-bold">adults</span> — optional, defaults to 1</p>
              <p><span className="font-bold">children</span> — optional, defaults to 0</p>
              <p><span className="font-bold">securityPin</span> — optional, up to 6 chars</p>
              <p><span className="font-bold">notes</span> — optional</p>
            </div>
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
            className="flex items-center gap-2 text-sm text-blue-700 font-semibold hover:text-blue-900"
          >
            <Upload className="w-4 h-4" />
            Download template CSV
          </button>

          {/* File picker */}
          <div>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-neutral-200 rounded-xl py-6 text-sm text-neutral-500 font-medium hover:border-neutral-400 hover:text-neutral-700 transition-all flex flex-col items-center gap-2"
            >
              <Upload className="w-6 h-6" />
              Click to upload a .csv file, or paste below
            </button>
          </div>

          {/* Paste area */}
          <div>
            <label className="block text-sm font-semibold mb-1.5">Or paste CSV content</label>
            <textarea
              value={csvText}
              onChange={e => setCsvText(e.target.value)}
              rows={7}
              className="w-full border border-neutral-200 rounded-xl px-4 py-3 text-xs font-mono focus:outline-none focus:border-neutral-400 resize-none"
              placeholder={TEMPLATE}
              spellCheck={false}
            />
          </div>

          {/* Results */}
          {result && (
            <div className={`rounded-xl p-4 text-sm space-y-2 ${result.imported > 0 ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
              <p className="font-bold">{result.imported} imported, {result.skipped} skipped</p>
              {result.errors?.length > 0 && (
                <div className="space-y-1 text-xs text-red-700">
                  {result.errors.slice(0, 10).map((e, i) => (
                    <p key={i}>Row {e.row}{e.guestName ? ` (${e.guestName})` : ''}: {e.reason}</p>
                  ))}
                  {result.errors.length > 10 && <p>…and {result.errors.length - 10} more</p>}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-neutral-100 flex gap-3">
          {result?.imported > 0 ? (
            <button onClick={onImported} className="flex-1 px-4 py-2.5 bg-neutral-900 text-white rounded-xl font-semibold hover:bg-black">
              Done
            </button>
          ) : (
            <>
              <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-neutral-200 rounded-xl font-semibold hover:bg-neutral-50">
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={importing || !csvText.trim()}
                className="flex-1 px-4 py-2.5 bg-neutral-900 text-white rounded-xl font-semibold hover:bg-black disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {importing ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing…</> : 'Import Guests'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-neutral-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold">Activity Log</h2>
            <p className="text-sm text-neutral-500 mt-0.5">Organizer and staff actions for this event</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-neutral-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        {/* Filter */}
        <div className="px-6 py-3 border-b border-neutral-100 flex gap-2 flex-wrap flex-shrink-0">
          {['all', 'checkin', 'invite_created', 'invite_deleted', 'guest_import'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all
                ${filter === f ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}
            >
              {f === 'all' ? 'All' : ACTION_LABELS[f]?.label || f}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
            </div>
          )}
          {error && (
            <div className="text-center py-16 text-red-500 text-sm">{error}</div>
          )}
          {!loading && !error && filtered.length === 0 && (
            <div className="text-center py-16 text-neutral-400 text-sm">No activity yet</div>
          )}
          {!loading && !error && filtered.map((entry, i) => {
            const cfg = ACTION_LABELS[entry.action] || { label: entry.action, color: 'text-neutral-600 bg-neutral-50 border-neutral-200' };
            return (
              <div key={i} className="flex items-start gap-4 px-6 py-4 border-b border-neutral-50 hover:bg-neutral-50 transition-colors">
                <div className="flex-shrink-0 pt-0.5">
                  <span className={`inline-block px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wide ${cfg.color}`}>
                    {cfg.label}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-neutral-800">{entry.details || entry.target || '—'}</p>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    <span className="font-semibold text-neutral-600">{entry.actor}</span>
                    {entry.actorRole && <span className="ml-1 text-neutral-400">({entry.actorRole})</span>}
                    {entry.target && entry.details && <span className="ml-1">· {entry.target}</span>}
                  </p>
                </div>
                <div className="flex-shrink-0 text-xs text-neutral-400 whitespace-nowrap">
                  {fmt(entry.timestamp)}
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-4 border-t border-neutral-100 flex-shrink-0">
          <button onClick={onClose} className="w-full px-4 py-2.5 border border-neutral-200 rounded-xl font-semibold text-sm hover:bg-neutral-50">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function EnterpriseCheckin() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  
  // Auth / staff gate
  const [authState, setAuthState] = useState(() => {
    const token = localStorage.getItem('eventToken');
    if (!token) return { ready: false, role: null };
    const decoded = decodeJWT(token);
    if (!decoded) return { ready: false, role: null };
    // Check token not expired
    if (decoded.exp && decoded.exp * 1000 < Date.now()) {
      localStorage.removeItem('eventToken');
      return { ready: false, role: null };
    }
    // Must be organizer or staff
    if (decoded.role !== 'organizer' && decoded.role !== 'staff') return { ready: false, role: null };
    return { ready: true, role: decoded.role, username: decoded.username };
  });

  const [event, setEvent] = useState(null);
  const [invites, setInvites] = useState([]);
  const [stats, setStats] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [scanMode, setScanMode] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [currentGuest, setCurrentGuest] = useState(null);
  const [currentSecurity, setCurrentSecurity] = useState(null);
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
  const [showActivityLog, setShowActivityLog] = useState(false);
  
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);
  const { alerts: secAlerts, addAlert: addSecAlert, addConflicts, dismissAlert: dismissSecAlert, dismissAll: dismissAllSecAlerts } = useSecurityAlerts();
  const [isOffline, setIsOffline]     = useState(!navigator.onLine);
  const [pendingSync, setPendingSync] = useState(0);
  const [cacheReady, setCacheReady]   = useState(false);

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

  useEffect(() => {
    if (eventId && authState.ready) {
      loadAllData();
    }
  }, [eventId, authState.ready]);

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
      socket.on('guest_checked_in', () => {
        loadInvites();
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
    offlineCheckin.loadCacheFromDB(eventId).then(cached => {
      if (cached) setCacheReady(true);
    });
    if (offlineCheckin.isOnline()) {
      offlineCheckin.refreshCache(eventId, () => eventAPI.getCheckinCache(eventId)).then(ok => {
        if (ok) setCacheReady(true);
      });
    }

    // ── Count pending offline check-ins ───────────────────────────────────
    offlineCheckin.pendingCount(eventId).then(n => setPendingSync(n));

    // ── Connectivity listeners ─────────────────────────────────────────────
    function handleOnline() {
      setIsOffline(false);
      // Refresh cache first, then flush queue
      offlineCheckin.refreshCache(eventId, () => eventAPI.getCheckinCache(eventId)).then(ok => {
        if (ok) setCacheReady(true);
      });
      offlineCheckin.flushQueue(eventId, (inviteCode, actualAttendees) =>
        eventAPI.checkIn(eventId, inviteCode, { actualAttendees, pinVerified: false })
      ).then(results => {
        if (results.synced > 0) {
          loadInvites();
          loadStats();
        }
        if (results.conflicts.length > 0) {
          addConflicts(results.conflicts);
        }
        offlineCheckin.pendingCount(eventId).then(n => setPendingSync(n));
      });
    }
    function handleOffline() {
      setIsOffline(true);
    }

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
    setAuthState({ ready: true, role, username });
  };

  const handleStaffLogout = () => {
    localStorage.removeItem('eventToken');
    setAuthState({ ready: false, role: null });
  };

  const loadAllData = async () => {
    console.log('[checkin] Starting to load check-in data...');
    try {
      setLoading(true);
      setLoadError(null);
      
      console.log('[checkin] Loading event...');
      await loadEvent();
      
      console.log('[checkin] Loading invites...');
      await loadInvites();
      
      console.log('[checkin] Loading stats...');
      await loadStats();
      
      console.log('[checkin] Loading settings...');
      await loadSettings();

      // Non-blocking — seating may not be enabled yet
      loadSeating().catch(() => {});
      
      console.log('✅ All data loaded successfully');
    } catch (error) {
      console.error('❌ Failed to load data:', error);
      const errorMsg = error.response?.data?.error || error.message || 'Failed to load check-in data';
      setLoadError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };
  
  const loadEvent = async () => {
    try {
      const response = await eventAPI.getById(eventId);
      console.log('Event loaded:', response.data);
      setEvent(response.data.event || response.data);
    } catch (error) {
      console.error('Failed to load event:', error);
      throw error;
    }
  };
  
  const loadInvites = async () => {
    try {
      const response = await eventAPI.getInvites(eventId);
      console.log('Invites loaded:', response.data);
      setInvites(response.data.invites || response.data || []);
    } catch (error) {
      console.error('Failed to load invites:', error);
      setInvites([]);
    }
  };
  
  const loadStats = async () => {
    try {
      const response = await eventAPI.getCheckInStats(eventId);
      console.log('Stats loaded:', response.data);
      setStats(response.data.stats || response.data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };
  
  const loadSettings = async () => {
    try {
      const response = await eventAPI.getCheckInSettings(eventId);
      console.log('Settings loaded:', response.data);
      setSettings(response.data.settings || response.data || {});
    } catch (error) {
      console.error('Failed to load settings:', error);
      setSettings({});
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
  
  const handleScan = async (code) => {
    if (!code || !code.trim()) {
      toast.error('Invalid code');
      return;
    }

    console.log('[checkin] Raw QR scan result:', code);

    let inviteCode = code.trim();

    // Extract invite code from full URL or bare code:
    // - https://planitapp.onrender.com/invite/ABC123
    // - /invite/ABC123?ref=email  or  /invite/ABC123#section
    // - ABC123 (bare code, from manual entry or direct click)
    const match = inviteCode.match(/\/invite\/([A-Z0-9]+)(?:[?#]|$)/i);
    if (match) {
      inviteCode = match[1];
      console.log('✅ Extracted invite code from URL:', inviteCode);
    } else {
      inviteCode = inviteCode.replace(/^https?:\/\/[^/]+\/?/i, '');
      console.log('ℹ️ Using cleaned input as invite code:', inviteCode);
    }

    inviteCode = inviteCode.toUpperCase().trim();

    setScanMode(false);
    setShowManual(false);
    setManualCode('');

    // ── OFFLINE PATH ────────────────────────────────────────────────────
    if (isOffline || !navigator.onLine) {
      const cached = offlineCheckin.lookupGuest(inviteCode);
      if (!cached) {
        hapticError();
        setDenyDetails({
          reason: 'not_found',
          severity: 'critical',
          message: cacheReady
            ? 'QR code not found in offline guest list. Deny entry.'
            : 'No offline guest list cached. Go online and reload to enable offline scanning.',
          displayMessage: cacheReady ? 'NOT FOUND (OFFLINE)' : 'NO CACHE',
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
        });
        setShowDenyScreen(true);
        return;
      }
      // Valid — optimistically admit offline
      hapticSuccess();
      offlineCheckin.markCheckedInLocally(inviteCode, cached.groupSize, authState.username);
      offlineCheckin.queueCheckin(eventId, inviteCode, cached.groupSize);
      offlineCheckin.pendingCount(eventId).then(n => setPendingSync(n));
      setCurrentGuest({
        id: inviteCode, inviteCode,
        guestName:  cached.name,
        guestEmail: cached.email    || '',
        groupSize:  cached.groupSize || 1,
        adults:     cached.adults    || 1,
        children:   cached.children  || 0,
        notes:      cached.notes     || '',
        hasPin:     cached.hasPin,
        tableId:    cached.tableId   || null,
        tableLabel: cached.tableLabel || null,
        _offlineAdmit: true,
      });
      setCurrentSecurity({ trustScore: 100, warnings: [], flags: [] });
      setRequiresPin(cached.hasPin && settings?.requirePin);
      setPinVerified(false);
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
      setRequiresPin(data.requiresPin);
      setPinVerified(false);

    } catch (error) {
      // If connectivity just dropped mid-scan, switch to offline path
      if (!navigator.onLine) {
        setIsOffline(true);
        handleScan(inviteCode);
        return;
      }

      hapticError();
      const errData = error.response?.data;
      if (errData && errData.valid === false) {
        setDenyDetails({
          reason: errData.reason,
          severity: errData.severity || 'critical',
          message: errData.message,
          displayMessage: errData.displayMessage,
          checkedInAt: errData.checkedInAt,
          checkedInBy: errData.checkedInBy,
          blockedReason: errData.blockedReason,
          requiresOverride: errData.requiresOverride,
          inviteCode: errData.inviteCode,
          guestName: errData.guestName,
          groupSize: errData.groupSize,
        });
      } else {
        setDenyDetails({
          reason: 'error', severity: 'critical',
          message: errData?.message || error.message || 'Scan failed',
        });
      }
      setShowDenyScreen(true);
    }
  };

  const handlePinVerify = async (pin) => {
    try {
      const response = await eventAPI.verifyPin(eventId, currentGuest.inviteCode, pin);
      if (response.data.valid) {
        // Trigger success haptic for correct PIN
        hapticSuccess();
        
        setPinVerified(true);
        toast.success('PIN verified');
      } else {
        throw new Error(response.data.message || 'Invalid PIN');
      }
    } catch (error) {
      // Trigger error haptic for wrong PIN
      hapticError();
      
      throw new Error(error.response?.data?.message || error.message);
    }
  };
  
  const handleAdmit = async () => {
    // Offline guests were already queued in handleScan — just advance the UI
    if (currentGuest?._offlineAdmit) {
      setAdmittedGuest({ ...currentGuest, checkedIn: true });
      setCurrentGuest(null);
      setShowAdmitSuccess(true);
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
      toast.error(error.response?.data?.error || 'Check-in failed');
      setCurrentGuest(null);
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

  // Sort: pending guests first, checked-in guests at bottom
  const sorted = [...filtered].sort((a, b) => {
    if (a.checkedIn && !b.checkedIn) return 1;
    if (!a.checkedIn && b.checkedIn) return -1;
    return 0;
  });

  // Staff login gate
  if (!authState.ready) {
    return (
      <StaffLoginScreen
        eventId={eventId}
        eventTitle={event?.title}
        onLogin={handleStaffLogin}
      />
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-neutral-400 mx-auto mb-4" />
          <p className="text-neutral-600">Loading check-in system...</p>
          <p className="text-xs text-neutral-400 mt-2">Check console (F12) if stuck</p>
        </div>
      </div>
    );
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
    <div className="min-h-screen bg-neutral-50">
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
      
      <header className="bg-white border-b border-neutral-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {authState.role === 'organizer' && (
              <button onClick={() => navigate(`/event/${eventId}`)} className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors">
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <h1 className="text-base font-bold text-neutral-900 truncate max-w-[240px]">{event?.title || 'Event'}</h1>
              <div className="flex items-center gap-1.5">
                <p className="text-xs text-neutral-400">Check-in</p>
                {authState.username && (
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${authState.role === 'staff' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {authState.role === 'staff' ? ' ' : ' '}{authState.username}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettingsPanel(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-neutral-600 border border-neutral-200 rounded-xl hover:bg-neutral-50 transition-all"
              title="Security Settings"
            >
              <Settings className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Settings</span>
            </button>

            {/* Seating map button:
                - If map is enabled: show for everyone (organizer gets editor, staff gets display)
                - If map is NOT enabled: show a "Set Up Seating" button ONLY for organizers
                  so they can create the first layout (fixes the chicken-and-egg where the button
                  was only visible after enabling, but enabling required clicking the button) */}
            {seatingEnabled ? (
              <button
                onClick={() => { setSeatingFocusId(null); setShowSeatingMap(true); }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-violet-700 bg-violet-50 border border-violet-200 rounded-xl hover:bg-violet-100 transition-all"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Seating</span>
              </button>
            ) : authState.role === 'organizer' && (
              <button
                onClick={() => {
                  // Ensure seatingData is initialised so the modal renders
                  if (!seatingData) setSeatingData({ seatingMap: { enabled: false, objects: [] }, guestsByTable: {} });
                  setSeatingFocusId(null);
                  setShowSeatingMap(true);
                }}
                title="Create a seating chart for this event"
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-neutral-500 border border-dashed border-neutral-300 rounded-xl hover:border-violet-400 hover:text-violet-600 hover:bg-violet-50 transition-all"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Set Up Seating</span>
              </button>
            )}

            {authState.role === 'organizer' && (
              <>
                <button
                  onClick={() => setShowActivityLog(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-neutral-600 border border-neutral-200 rounded-xl hover:bg-neutral-50 transition-all"
                  title="Activity Log"
                >
                  <BarChart2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Log</span>
                </button>
                <button
                  onClick={() => setShowCsvImport(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-all"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Import CSV</span>
                </button>
                <button
                  onClick={() => setShowInviteDialog(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Add Guest</span>
                </button>
              </>
            )}
            <button
              onClick={() => setShowManual(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-neutral-600 border border-neutral-200 rounded-xl hover:bg-neutral-50 transition-all"
            >
              <Keyboard className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Manual</span>
            </button>
            <button
              onClick={() => {
                resetScan();
                setScanMode(true);
              }}
              className="flex items-center gap-2 px-5 py-2.5 bg-neutral-900 text-white text-sm font-bold rounded-xl hover:bg-black transition-all shadow-sm"
            >
              <Camera className="w-4 h-4" />
              Scan QR
              <span className="hidden lg:inline text-xs text-white/60 font-normal ml-1">[S]</span>
            </button>
            {authState.role === 'staff' && (
              <button
                onClick={handleStaffLogout}
                title="Log out of check-in"
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-neutral-500 border border-neutral-200 rounded-xl hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Log Out</span>
              </button>
            )}
          </div>
        </div>
        {showManual && (
          <div className="border-t border-neutral-100 bg-neutral-50 px-6 py-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleScan(manualCode);
              }}
              className="flex gap-2 max-w-lg"
            >
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                placeholder="Enter invite code e.g. AB12CD34"
                className="flex-1 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm font-mono tracking-widest focus:outline-none focus:border-neutral-400 bg-white"
                autoFocus
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                inputMode="text"
              />
              <button type="submit" disabled={!manualCode.trim()} className="px-4 py-2.5 bg-neutral-900 text-white rounded-xl text-sm font-semibold disabled:opacity-40 hover:bg-black transition-all">
                Verify
              </button>
            </form>
          </div>
        )}
      </header>
      
      <main className="max-w-7xl mx-auto px-6 lg:px-10 py-8">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8">
          {[
            { label: 'Total Groups', value: stats?.total ?? invites.length, color: 'text-neutral-900' },
            { label: 'Checked In', value: stats?.checkedIn ?? 0, color: 'text-emerald-600' },
            { label: 'Total Admitted', value: stats?.totalActualAttendees ?? invites.filter(i => i.checkedIn).reduce((s, i) => s + (i.actualAttendees || i.groupSize || 1), 0), color: 'text-emerald-700' },
            { label: 'Adults Expected', value: stats?.totalExpectedAdults ?? 0, color: 'text-neutral-600' },
            { label: 'Children', value: stats?.totalExpectedChildren ?? 0, color: 'text-indigo-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-2xl border border-neutral-150 p-5 shadow-sm">
              <div className={`text-3xl font-black tabular-nums ${color}`}>{value}</div>
              <div className="text-xs text-neutral-500 mt-1 font-medium">{label}</div>
            </div>
          ))}
        </div>
        
        <div className="bg-white rounded-2xl border border-neutral-150 shadow-sm overflow-hidden">
          {/* Progress bar */}
          {invites.length > 0 && (() => {
            const pct = Math.round(((stats?.checkedIn ?? invites.filter(i => i.checkedIn).length) / invites.length) * 100);
            return (
              <div className="px-8 pt-5 pb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-neutral-500">Check-in progress</span>
                  <span className="text-xs font-bold text-emerald-600">{pct}%</span>
                </div>
                <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })()}
          <div className="px-8 py-5 border-b border-neutral-100 flex items-center gap-4 flex-wrap">
            <h2 className="text-lg font-bold text-neutral-900 flex-1">Guest List</h2>
            <input
              type="text"
              placeholder="Search guests…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-neutral-400 w-56"
            />
          </div>
          
          <div className="divide-y divide-neutral-100">
            {sorted.length === 0 ? (
              <div className="text-center py-12 text-neutral-400 text-sm">
                {invites.length === 0 ? (
                  <div>
                    <p className="mb-4">No guests yet.</p>
                    <button
                      onClick={() => setShowInviteDialog(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white text-sm font-semibold rounded-xl hover:bg-black"
                    >
                      <Plus className="w-4 h-4" />
                      Add First Guest
                    </button>
                  </div>
                ) : (
                  'No guests match your search.'
                )}
              </div>
            ) : (
              sorted.map((invite) => {
                const adults = invite.adults || 1;
                const children = invite.children || 0;
                const total = adults + children;
                
                return (
                  <div
                    key={invite._id}
                    className={`flex items-center gap-5 px-8 py-5 hover:bg-neutral-50 transition-colors ${
                      invite.checkedIn ? 'bg-emerald-50/40 hover:bg-emerald-50' : ''
                    }`}
                  >
                    <div
                      className={`w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center text-sm font-bold ${
                        invite.checkedIn ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-500'
                      }`}
                    >
                      {invite.guestName.charAt(0).toUpperCase()}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-base font-semibold text-neutral-900">{invite.guestName}</p>
                        <RoleBadge role={invite.guestRole || 'GUEST'} />
                        {/* Table assignment badge */}
                        {invite.tableLabel && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-violet-100 text-violet-700 text-[10px] font-bold border border-violet-200">
                            <MapPin className="w-2.5 h-2.5" />
                            {invite.tableLabel}
                          </span>
                        )}
                        {invite.notes && (
                          <span title={invite.notes} className="ml-1 inline-flex items-center justify-center w-4 h-4 rounded bg-neutral-200 text-neutral-500 text-xs font-bold cursor-help" aria-label="Has notes">N</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-neutral-400 flex-wrap">
                        <span className="font-mono font-medium">{invite.inviteCode}</span>
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {adults} adult{adults !== 1 ? 's' : ''}
                        </span>
                        {children > 0 && (
                          <span className="flex items-center gap-1">
                            <Baby className="w-3 h-3 text-blue-400" />
                            {children} child{children !== 1 ? 'ren' : ''}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {total} total
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex-shrink-0 flex items-center gap-2">
                      {invite.checkedIn ? (
                        <div className="text-right">
                          <div className="flex items-center gap-1 text-emerald-600 text-xs font-bold mb-0.5">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Admitted
                          </div>
                          <p className="text-xs text-neutral-400 flex items-center gap-1 justify-end">
                            <Clock className="w-3 h-3" />
                            {new Date(invite.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                          {/* Show on map shortcut for checked-in guests with a table */}
                          {invite.tableId && seatingEnabled && (
                            <button
                              onClick={() => { setSeatingFocusId(invite.tableId); setShowSeatingMap(true); }}
                              className="mt-1 text-[10px] text-violet-600 hover:text-violet-800 font-semibold flex items-center gap-0.5 justify-end"
                            >
                              <MapPin className="w-2.5 h-2.5" /> Show table
                            </button>
                          )}
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setEditingInvite(invite);
                              setShowInviteDialog(true);
                            }}
                            className="p-1.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-all"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteInvite(invite._id)}
                            className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleScan(invite.inviteCode)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 text-white text-xs font-semibold rounded-xl hover:bg-black transition-all"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            Check In
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </main>

      <footer className="max-w-7xl mx-auto px-6 lg:px-10 py-6 flex items-center justify-between">
        {/* Offline indicator */}
        {isOffline && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-xs font-bold text-amber-400">
              Offline{pendingSync > 0 ? ` — ${pendingSync} check-in${pendingSync !== 1 ? 's' : ''} queued` : ' — using cached guest list'}
            </span>
          </div>
        )}
        {!isOffline && pendingSync > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/30">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-xs font-bold text-blue-400">Syncing {pendingSync} offline check-in{pendingSync !== 1 ? 's' : ''}…</span>
          </div>
        )}
        {!isOffline && pendingSync === 0 && (
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
      {authState.ready && <WalkieTalkieButton walkie={walkie} />}
    </div>
  );
}
