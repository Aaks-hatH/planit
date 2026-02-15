import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  QrCode, UserCheck, Users, Check, Plus, X, ArrowLeft, Camera, CameraOff,
  RefreshCw, Keyboard, ShieldCheck, ShieldAlert, ShieldOff, AlertTriangle,
  Baby, User, Settings, ChevronRight, Lock, Unlock, Eye, EyeOff,
  Clock, Ban, CheckCircle2, Info, Loader2
} from 'lucide-react';
import { eventAPI } from '../services/api';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// ─────────────────────────────────────────────────────────────────────────────
// QR Camera Scanner  (unchanged scanning logic, same as before)
// ─────────────────────────────────────────────────────────────────────────────
function QRCameraScanner({ onScan, onClose }) {
  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const streamRef   = useRef(null);
  const rafRef      = useRef(null);
  const cooldownRef = useRef(false);
  const lastCodeRef = useRef('');
  const jsQRLoaded  = useRef(false);
  const [status, setStatus]     = useState('loading');
  const [errorMsg, setErrorMsg] = useState('');

  const ensureJsQR = useCallback(() => new Promise(resolve => {
    if (window.jsQR) { resolve(window.jsQR); return; }
    if (jsQRLoaded.current) {
      const wait = setInterval(() => { if (window.jsQR) { clearInterval(wait); resolve(window.jsQR); } }, 100);
      return;
    }
    jsQRLoaded.current = true;
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
    s.onload = () => resolve(window.jsQR);
    s.onerror = () => resolve(null);
    document.head.appendChild(s);
  }), []);

  const extractCode = (raw) => {
    if (!raw) return null;
    const t = raw.trim();
    const m = t.match(/\/invite\/([A-Z0-9]{6,14})/i);
    if (m) return m[1].toUpperCase();
    if (/^[A-Z0-9]{6,14}$/i.test(t)) return t.toUpperCase();
    return t.toUpperCase();
  };

  const handleDetected = useCallback((raw) => {
    const code = extractCode(raw);
    if (!code || code === lastCodeRef.current || cooldownRef.current) return;
    lastCodeRef.current = code;
    cooldownRef.current = true;
    setTimeout(() => { cooldownRef.current = false; }, 3000);
    onScan(code);
  }, [onScan]);

  const startScanning = useCallback(async (video, canvas) => {
    const jsQR = await ensureJsQR();
    const hasBD = 'BarcodeDetector' in window;
    let detector = null;
    if (hasBD) { try { detector = new window.BarcodeDetector({ formats: ['qr_code'] }); } catch (_) {} }

    const tick = async () => {
      if (!video || video.readyState < 2) { rafRef.current = requestAnimationFrame(tick); return; }
      const ctx = canvas.getContext('2d');
      canvas.width = video.videoWidth || 640; canvas.height = video.videoHeight || 480;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      if (detector) {
        try { const c = await detector.detect(canvas); if (c.length) handleDetected(c[0].rawValue); } catch (_) {}
      } else if (jsQR) {
        try { const r = jsQR(ctx.getImageData(0,0,canvas.width,canvas.height).data, canvas.width, canvas.height, { inversionAttempts:'dontInvert' }); if (r) handleDetected(r.data); } catch (_) {}
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [ensureJsQR, handleDetected]);

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
  }, []);

  const startCamera = useCallback(async () => {
    setStatus('loading'); setErrorMsg(''); lastCodeRef.current = '';
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      video.setAttribute('playsinline', true);
      await new Promise((res, rej) => { video.onloadedmetadata = res; video.onerror = rej; setTimeout(rej, 10000); });
      await video.play();
      setStatus('ready');
      startScanning(video, canvasRef.current);
    } catch (err) {
      let msg = 'Could not start camera.';
      if (err?.name === 'NotAllowedError') msg = 'Camera access denied. Allow camera permission and try again.';
      else if (err?.name === 'NotFoundError') msg = 'No camera found on this device.';
      else if (err?.name === 'NotReadableError') msg = 'Camera is in use by another app.';
      setStatus('error'); setErrorMsg(msg);
    }
  }, [startScanning]);

  useEffect(() => { startCamera(); return () => stopCamera(); }, []);

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 backdrop-blur-sm z-10 border-b border-white/10">
        <button onClick={() => { stopCamera(); onClose(); }} className="flex items-center gap-2 text-white/80 text-sm hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
          <span className="text-white text-sm font-semibold tracking-wide">SCAN TICKET</span>
        </div>
        <div className="w-16" />
      </div>

      <div className="flex-1 relative overflow-hidden bg-black">
        {status === 'error' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950 px-8 text-center gap-5">
            <CameraOff className="w-14 h-14 text-neutral-600" />
            <div>
              <p className="text-white font-semibold mb-2">Camera Unavailable</p>
              <p className="text-neutral-400 text-sm max-w-sm">{errorMsg}</p>
            </div>
            <button onClick={startCamera} className="flex items-center gap-2 px-5 py-2.5 bg-white text-neutral-900 rounded-xl font-medium text-sm hover:bg-neutral-100">
              <RefreshCw className="w-4 h-4" /> Try Again
            </button>
            <button onClick={() => { stopCamera(); onClose(); }} className="text-neutral-500 text-sm hover:text-neutral-300">
              Use manual entry instead
            </button>
          </div>
        ) : (
          <>
            <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline />
            <canvas ref={canvasRef} className="hidden" />
            <div className="absolute inset-0 flex items-center justify-center">
              {/* Dark vignette */}
              <div className="absolute inset-0" style={{ background:'radial-gradient(ellipse 60% 60% at center, transparent 38%, rgba(0,0,0,0.65) 100%)' }} />
              {/* Scanner frame */}
              <div className="relative w-72 h-72 z-10">
                {['top-0 left-0 border-t-[3px] border-l-[3px] rounded-tl-2xl','top-0 right-0 border-t-[3px] border-r-[3px] rounded-tr-2xl','bottom-0 left-0 border-b-[3px] border-l-[3px] rounded-bl-2xl','bottom-0 right-0 border-b-[3px] border-r-[3px] rounded-br-2xl'].map((c, i) => (
                  <div key={i} className={`absolute w-10 h-10 border-white/90 ${c}`} />
                ))}
                {status === 'ready' && (
                  <div className="absolute left-3 right-3 h-0.5 bg-green-400/90 shadow-lg shadow-green-400/60 rounded-full"
                    style={{ animation: 'scanline 2s ease-in-out infinite', top: '50%' }} />
                )}
              </div>
            </div>
            <div className="absolute bottom-10 inset-x-0 text-center">
              <p className="text-white/80 text-sm tracking-wide">
                {status === 'loading' ? 'Starting camera…' : 'Point camera at guest QR code'}
              </p>
            </div>
          </>
        )}
      </div>
      <style>{`@keyframes scanline{0%{top:8%;opacity:.9}50%{top:92%;opacity:.9}100%{top:8%;opacity:.9}}`}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Guest Profile Card — shown after scan, before admission
// ─────────────────────────────────────────────────────────────────────────────
function GuestProfileCard({ guest, eventTitle, staffNote, onAdmit, onDeny, requiresPin, onPinVerified, loading }) {
  const [pin, setPin]             = useState('');
  const [showPin, setShowPin]     = useState(false);
  const [pinError, setPinError]   = useState('');
  const [pinOk, setPinOk]         = useState(!requiresPin);
  const [verifyingPin, setVerifyingPin] = useState(false);
  const pinRef = useRef(null);

  const totalPeople = (guest.adults || 0) + (guest.children || 0) || guest.groupSize;

  useEffect(() => {
    if (requiresPin && pinRef.current) pinRef.current.focus();
  }, [requiresPin]);

  const handleVerifyPin = async () => {
    if (!pin.trim()) { setPinError('Enter the security PIN'); return; }
    setVerifyingPin(true); setPinError('');
    const result = await onPinVerified(pin.trim());
    setVerifyingPin(false);
    if (result.valid) { setPinOk(true); setPinError(''); }
    else { setPinError(result.message || 'Incorrect PIN'); setPin(''); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden">

        {/* Header strip */}
        <div className={`px-6 py-4 flex items-center gap-3 ${pinOk ? 'bg-neutral-900' : 'bg-neutral-700'}`}>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${pinOk ? 'bg-white/15' : 'bg-white/10'}`}>
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-white/60 uppercase tracking-widest font-semibold">Ticket Verified</p>
            <p className="text-white font-bold truncate">{eventTitle}</p>
          </div>
          <div className="flex-shrink-0">
            <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
          </div>
        </div>

        {/* Guest info */}
        <div className="px-6 pt-5 pb-4">
          <p className="text-xs text-neutral-400 uppercase tracking-widest font-semibold mb-1">Guest</p>
          <h2 className="text-2xl font-black text-neutral-900 mb-1">{guest.guestName}</h2>
          {guest.guestEmail && <p className="text-sm text-neutral-500 mb-1">{guest.guestEmail}</p>}
          {guest.guestPhone && <p className="text-sm text-neutral-500 mb-3">{guest.guestPhone}</p>}

          {/* Party breakdown — the key section */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-neutral-50 rounded-2xl p-3 text-center border border-neutral-200">
              <div className="flex justify-center mb-1"><User className="w-4 h-4 text-neutral-600" /></div>
              <div className="text-2xl font-black text-neutral-900">{guest.adults ?? 1}</div>
              <div className="text-xs text-neutral-500 font-medium">Adult{guest.adults !== 1 ? 's' : ''}</div>
            </div>
            <div className="bg-neutral-50 rounded-2xl p-3 text-center border border-neutral-200">
              <div className="flex justify-center mb-1"><Baby className="w-4 h-4 text-blue-500" /></div>
              <div className="text-2xl font-black text-neutral-900">{guest.children ?? 0}</div>
              <div className="text-xs text-neutral-500 font-medium">Child{guest.children !== 1 ? 'ren' : ''}</div>
            </div>
            <div className="bg-neutral-900 rounded-2xl p-3 text-center">
              <div className="flex justify-center mb-1"><Users className="w-4 h-4 text-white/70" /></div>
              <div className="text-2xl font-black text-white">{totalPeople}</div>
              <div className="text-xs text-white/60 font-medium">Total</div>
            </div>
          </div>

          {guest.plusOnes > 0 && (
            <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-sm text-amber-800">
              <Plus className="w-4 h-4 flex-shrink-0" />
              <span><strong>{guest.plusOnes}</strong> additional guest{guest.plusOnes !== 1 ? 's' : ''} allowed</span>
            </div>
          )}

          {/* Invite code */}
          <div className="mb-4 px-3 py-2 bg-neutral-50 border border-neutral-200 rounded-xl flex items-center justify-between">
            <span className="text-xs text-neutral-400 uppercase tracking-widest">Code</span>
            <span className="font-mono font-bold text-neutral-900 tracking-widest text-sm">{guest.inviteCode}</span>
          </div>

          {/* Staff note */}
          {staffNote && (
            <div className="mb-4 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-800">{staffNote}</p>
            </div>
          )}

          {/* Guest notes */}
          {guest.notes && (
            <div className="mb-4 px-3 py-2.5 bg-yellow-50 border border-yellow-200 rounded-xl flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-yellow-800">{guest.notes}</p>
            </div>
          )}

          {/* PIN challenge */}
          {requiresPin && !pinOk && (
            <div className="mb-4 p-4 bg-neutral-900 rounded-2xl">
              <div className="flex items-center gap-2 mb-3">
                <Lock className="w-4 h-4 text-white/70" />
                <p className="text-sm font-semibold text-white">Security PIN Required</p>
              </div>
              <p className="text-xs text-white/50 mb-3">Ask guest for their personal security PIN</p>
              <div className="relative mb-2">
                <input
                  ref={pinRef}
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={8}
                  value={pin}
                  onChange={e => { setPin(e.target.value); setPinError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleVerifyPin()}
                  className="w-full bg-white/10 border border-white/20 text-white rounded-xl px-4 py-3 font-mono text-center text-xl tracking-[0.4em] placeholder-white/20 focus:outline-none focus:border-white/50 pr-10"
                  placeholder="• • • •"
                />
                <button type="button" onClick={() => setShowPin(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors">
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {pinError && <p className="text-red-400 text-xs mb-2">{pinError}</p>}
              <button onClick={handleVerifyPin} disabled={verifyingPin || !pin.trim()}
                className="w-full py-2.5 bg-white text-neutral-900 rounded-xl font-semibold text-sm hover:bg-neutral-100 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
                {verifyingPin ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Lock className="w-4 h-4" />Verify PIN</>}
              </button>
            </div>
          )}

          {pinOk && requiresPin && (
            <div className="mb-4 px-3 py-2 bg-green-50 border border-green-200 rounded-xl flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <span className="text-sm text-green-800 font-medium">PIN verified</span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="px-6 pb-6 flex gap-3">
          <button onClick={onDeny} disabled={loading}
            className="flex-1 py-4 bg-red-50 border-2 border-red-200 text-red-700 rounded-2xl font-bold text-sm hover:bg-red-100 hover:border-red-300 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            <Ban className="w-5 h-5" /> Deny
          </button>
          <button onClick={() => onAdmit(pinOk)} disabled={loading || (requiresPin && !pinOk)}
            className="flex-[2] py-4 bg-neutral-900 text-white rounded-2xl font-bold text-sm hover:bg-black transition-all disabled:opacity-40 flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle2 className="w-5 h-5" />Admit {totalPeople > 1 ? `${totalPeople} guests` : 'Guest'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Rejection Screen — shown on failed scan
// ─────────────────────────────────────────────────────────────────────────────
function RejectionScreen({ reason, detail, onDismiss }) {
  const configs = {
    not_found:         { icon: ShieldOff,   color: 'bg-red-600',    title: 'INVALID TICKET',       sub: 'QR code not found in system.' },
    wrong_event:       { icon: ShieldAlert, color: 'bg-orange-600', title: 'WRONG EVENT',           sub: 'This ticket is for a different event.' },
    already_checked_in:{ icon: Ban,         color: 'bg-amber-600',  title: 'ALREADY ADMITTED',     sub: 'This ticket has already been used.' },
    default:           { icon: ShieldOff,   color: 'bg-red-600',    title: 'ACCESS DENIED',         sub: 'Contact the organizer.' },
  };
  const cfg = configs[reason] || configs.default;
  const Icon = cfg.icon;

  return (
    <div className="fixed inset-0 bg-neutral-950 z-50 flex flex-col items-center justify-center p-8 text-center">
      <div className={`w-24 h-24 ${cfg.color} rounded-full flex items-center justify-center mb-6 shadow-2xl`}>
        <Icon className="w-12 h-12 text-white" />
      </div>
      <h1 className="text-4xl font-black text-white mb-3 tracking-tight">{cfg.title}</h1>
      <p className="text-white/60 text-lg mb-2">{cfg.sub}</p>
      {detail && <p className="text-white/40 text-sm max-w-xs mb-8">{detail}</p>}
      <button onClick={onDismiss} className="mt-2 px-8 py-3.5 bg-white/10 text-white rounded-2xl font-semibold hover:bg-white/20 transition-colors border border-white/20">
        Scan Next Guest
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Admitted Screen — shown immediately after successful check-in
// ─────────────────────────────────────────────────────────────────────────────
function AdmittedScreen({ invite, onDismiss }) {
  const total = (invite.adults || 0) + (invite.children || 0) || invite.actualAttendees;
  useEffect(() => { const t = setTimeout(onDismiss, 3500); return () => clearTimeout(t); }, []);

  return (
    <div className="fixed inset-0 bg-emerald-600 z-50 flex flex-col items-center justify-center p-8 text-center">
      <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mb-6">
        <Check className="w-14 h-14 text-white" strokeWidth={3} />
      </div>
      <h1 className="text-4xl font-black text-white mb-2">ADMITTED</h1>
      <p className="text-white/90 text-2xl font-bold mb-4">{invite.guestName}</p>
      <div className="flex items-center gap-4 mb-6">
        {(invite.adults > 0) && <div className="text-center"><div className="text-3xl font-black text-white">{invite.adults}</div><div className="text-white/70 text-xs uppercase tracking-wider">Adult{invite.adults !== 1 ? 's' : ''}</div></div>}
        {(invite.children > 0) && <div className="text-center"><div className="text-3xl font-black text-white">{invite.children}</div><div className="text-white/70 text-xs uppercase tracking-wider">Child{invite.children !== 1 ? 'ren' : ''}</div></div>}
        <div className="text-center bg-white/20 px-4 py-2 rounded-2xl"><div className="text-3xl font-black text-white">{total}</div><div className="text-white/70 text-xs uppercase tracking-wider">Total</div></div>
      </div>
      <p className="text-white/50 text-sm">{new Date(invite.checkedInAt).toLocaleTimeString()}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Security Settings Panel (organizer only)
// ─────────────────────────────────────────────────────────────────────────────
function SecuritySettings({ eventId, onClose }) {
  const [settings, setSettings]   = useState(null);
  const [saving, setSaving]       = useState(false);
  const [local, setLocal]         = useState({});

  const auth = () => {
    const t = localStorage.getItem('eventToken');
    return { 'Authorization': `Bearer ${t}`, 'x-event-token': t, 'Content-Type': 'application/json' };
  };

  useEffect(() => {
    fetch(`${API_URL}/events/${eventId}/checkin-settings`, { headers: auth() })
      .then(r => r.json())
      .then(d => { setSettings(d.settings); setLocal(d.settings || {}); })
      .catch(() => toast.error('Could not load settings'));
  }, [eventId]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/events/${eventId}/checkin-settings`, {
        method: 'PATCH', headers: auth(), body: JSON.stringify(local)
      });
      if (!res.ok) throw new Error();
      toast.success('Security settings saved');
      onClose();
    } catch { toast.error('Failed to save settings'); }
    finally { setSaving(false); }
  };

  const toggle = (key) => setLocal(p => ({ ...p, [key]: !p[key] }));
  const set = (key, val) => setLocal(p => ({ ...p, [key]: val }));

  if (!settings) return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-white animate-spin" />
    </div>
  );

  const Toggle = ({ on, onClick, label, description }) => (
    <div className="flex items-start justify-between gap-4 py-4 border-b border-neutral-100 last:border-0">
      <div>
        <p className="text-sm font-semibold text-neutral-900">{label}</p>
        {description && <p className="text-xs text-neutral-500 mt-0.5">{description}</p>}
      </div>
      <button onClick={onClick}
        className={`flex-shrink-0 w-12 h-6 rounded-full transition-all duration-300 relative ${on ? 'bg-neutral-900' : 'bg-neutral-200'}`}>
        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-300 ${on ? 'left-7' : 'left-1'}`} />
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white px-6 pt-6 pb-4 border-b border-neutral-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-neutral-900 rounded-xl flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-white" />
            </div>
            <h3 className="text-lg font-bold text-neutral-900">Security Settings</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-xl transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-6 py-4">
          <Toggle on={!!local.blockCrossEvent} onClick={() => toggle('blockCrossEvent')} label="Block Cross-Event Tickets" description="Reject QR codes that belong to other events. Always recommended." />
          <Toggle on={!!local.requireCodeConfirm} onClick={() => toggle('requireCodeConfirm')} label="Require Code Confirmation" description="Staff must manually confirm the invite code before admitting." />
          <Toggle on={!!local.requirePin} onClick={() => toggle('requirePin')} label="Require Guest Security PIN" description="Guests set a PIN when invited. Staff must verify it at entry." />
          <Toggle on={!!local.allowManualOverride} onClick={() => toggle('allowManualOverride')} label="Allow Manual Override" description="Let staff bypass security checks with organizer approval." />

          <div className="py-4 border-b border-neutral-100">
            <p className="text-sm font-semibold text-neutral-900 mb-1">Max PIN Attempts</p>
            <p className="text-xs text-neutral-500 mb-3">After this many failed PIN attempts, the ticket is flagged.</p>
            <div className="flex items-center gap-3">
              {[2,3,5].map(n => (
                <button key={n} onClick={() => set('maxFailedAttempts', n)}
                  className={`w-12 h-12 rounded-xl font-bold text-sm transition-all ${local.maxFailedAttempts === n ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div className="py-4">
            <p className="text-sm font-semibold text-neutral-900 mb-1">Staff Note</p>
            <p className="text-xs text-neutral-500 mb-3">Shown to staff on every scan. Use for dress code, ID requirements, etc.</p>
            <textarea
              value={local.staffNote || ''}
              onChange={e => set('staffNote', e.target.value)}
              rows={3}
              maxLength={200}
              placeholder="e.g. Check photo ID for all guests. Smart casual dress code enforced."
              className="w-full border border-neutral-200 rounded-xl px-4 py-3 text-sm text-neutral-900 resize-none focus:outline-none focus:border-neutral-400 placeholder-neutral-400"
            />
          </div>
        </div>

        <div className="sticky bottom-0 bg-white px-6 pb-6 pt-3 border-t border-neutral-100">
          <button onClick={save} disabled={saving}
            className="w-full py-4 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-black transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ShieldCheck className="w-4 h-4" />Save Security Settings</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Add Guests Modal — now includes adults / children / security PIN fields
// ─────────────────────────────────────────────────────────────────────────────
function AddGuestsModal({ eventId, onClose, onSuccess }) {
  const [rows, setRows] = useState([{ guestName:'', guestEmail:'', adults:1, children:0, plusOnes:0, securityPin:'', notes:'' }]);
  const [saving, setSaving] = useState(false);

  const update = (idx, field, val) => setRows(r => r.map((g, i) => i === idx ? { ...g, [field]: val } : g));
  const remove = (idx) => setRows(r => r.filter((_, i) => i !== idx));
  const addRow = () => setRows(r => [...r, { guestName:'', guestEmail:'', adults:1, children:0, plusOnes:0, securityPin:'', notes:'' }]);

  const save = async () => {
    const valid = rows.filter(g => g.guestName.trim());
    if (!valid.length) { toast.error('Enter at least one guest name'); return; }
    setSaving(true);
    try {
      const token = localStorage.getItem('eventToken');
      const guests = valid.map(g => ({
        guestName:   g.guestName.trim(),
        guestEmail:  g.guestEmail.trim(),
        adults:      parseInt(g.adults) || 1,
        children:    parseInt(g.children) || 0,
        groupSize:   (parseInt(g.adults) || 1) + (parseInt(g.children) || 0),
        plusOnes:    parseInt(g.plusOnes) || 0,
        securityPin: g.securityPin.trim(),
        notes:       g.notes.trim(),
      }));
      const res = await fetch(`${API_URL}/events/${eventId}/invites`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'x-event-token': token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ guests }),
      });
      if (!res.ok) throw new Error();
      toast.success(`${guests.length} invite${guests.length !== 1 ? 's' : ''} created`);
      onSuccess();
      onClose();
    } catch { toast.error('Failed to create invites'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl w-full max-w-3xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white px-6 pt-6 pb-4 border-b border-neutral-100 flex items-center justify-between">
          <h3 className="text-lg font-bold text-neutral-900">Add Guests</h3>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-xl"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-6 py-4 space-y-4">
          {rows.map((row, idx) => (
            <div key={idx} className="p-4 bg-neutral-50 rounded-2xl border border-neutral-200 space-y-3">
              <div className="flex items-start gap-2">
                <div className="flex-1 grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 block">Guest / Family Name *</label>
                    <input type="text" placeholder="Smith Family" value={row.guestName} onChange={e => update(idx,'guestName',e.target.value)}
                      className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-400" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 block">Email (optional)</label>
                    <input type="email" placeholder="guest@example.com" value={row.guestEmail} onChange={e => update(idx,'guestEmail',e.target.value)}
                      className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-400" />
                  </div>
                </div>
                {rows.length > 1 && (
                  <button onClick={() => remove(idx)} className="mt-5 p-1.5 text-neutral-300 hover:text-red-400 transition-colors flex-shrink-0"><X className="w-4 h-4" /></button>
                )}
              </div>

              <div className="grid grid-cols-4 gap-3">
                {[
                  { label:'Adults', field:'adults', icon:'👤', min:0 },
                  { label:'Children', field:'children', icon:'👶', min:0 },
                  { label:'Plus-Ones', field:'plusOnes', icon:'+1', min:0 },
                ].map(({ label, field, icon, min }) => (
                  <div key={field}>
                    <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 block">{label}</label>
                    <div className="flex items-center border border-neutral-200 rounded-xl overflow-hidden bg-white">
                      <button onClick={() => update(idx, field, Math.max(min, (parseInt(row[field])||0)-1))}
                        className="px-2.5 py-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-50 transition-colors text-lg font-bold">−</button>
                      <span className="flex-1 text-center text-sm font-bold text-neutral-900">{row[field]}</span>
                      <button onClick={() => update(idx, field, (parseInt(row[field])||0)+1)}
                        className="px-2.5 py-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-50 transition-colors text-lg font-bold">+</button>
                    </div>
                  </div>
                ))}
                <div>
                  <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 block">Security PIN</label>
                  <input type="text" inputMode="numeric" maxLength={8} placeholder="Optional" value={row.securityPin} onChange={e => update(idx,'securityPin',e.target.value)}
                    className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm font-mono text-center focus:outline-none focus:border-neutral-400" />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5 block">Staff Notes (optional)</label>
                <input type="text" placeholder="VIP, dietary requirements, accessibility needs…" value={row.notes} onChange={e => update(idx,'notes',e.target.value)}
                  className="w-full border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-neutral-400" />
              </div>

              <div className="text-xs text-neutral-400 flex items-center gap-1">
                <Users className="w-3.5 h-3.5" />
                Total expected: <strong className="text-neutral-600">{(parseInt(row.adults)||0)+(parseInt(row.children)||0)} {(parseInt(row.adults)||0)+(parseInt(row.children)||0) === 1 ? 'person' : 'people'}</strong>
                {parseInt(row.plusOnes) > 0 && <> + {row.plusOnes} plus-one{parseInt(row.plusOnes)!==1?'s':''}</>}
              </div>
            </div>
          ))}
        </div>

        <div className="sticky bottom-0 bg-white px-6 pb-6 pt-3 border-t border-neutral-100 flex gap-3">
          <button onClick={addRow} className="flex items-center gap-2 px-4 py-3 border border-neutral-200 rounded-2xl text-sm font-semibold text-neutral-700 hover:bg-neutral-50 transition-all">
            <Plus className="w-4 h-4" /> Add Row
          </button>
          <button onClick={save} disabled={saving}
            className="flex-1 py-3 bg-neutral-900 text-white rounded-2xl font-bold hover:bg-black transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Create {rows.filter(g=>g.guestName.trim()).length || ''} Invite{rows.filter(g=>g.guestName.trim()).length !== 1?'s':''}</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main EnterpriseCheckin Page
// ─────────────────────────────────────────────────────────────────────────────
export default function EnterpriseCheckin() {
  const { eventId } = useParams();
  const navigate    = useNavigate();

  const [event, setEvent]           = useState(null);
  const [invites, setInvites]       = useState([]);
  const [stats, setStats]           = useState(null);
  const [loading, setLoading]       = useState(true);
  const [scanMode, setScanMode]     = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [searchQuery, setSearch]    = useState('');
  const [showAdd, setShowAdd]       = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Scan flow state machine
  const [scanState, setScanState]   = useState('idle'); // idle | verifying | profile | rejected | admitted
  const [guestProfile, setGuestProfile] = useState(null);
  const [rejectionInfo, setRejectionInfo] = useState(null);
  const [admittedInfo, setAdmittedInfo]   = useState(null);
  const [committing, setCommitting] = useState(false);
  const [pendingCode, setPendingCode] = useState('');
  const [requiresPin, setRequiresPin] = useState(false);

  const auth = () => {
    const t = localStorage.getItem('eventToken');
    return { 'Authorization': `Bearer ${t}`, 'x-event-token': t, 'Content-Type': 'application/json' };
  };

  useEffect(() => { loadData(); }, [eventId]);

  const loadData = async () => {
    try {
      const [evRes, invRes, stRes] = await Promise.all([
        eventAPI.getById(eventId),
        fetch(`${API_URL}/events/${eventId}/invites`, { headers: auth() }).then(r => r.json()),
        fetch(`${API_URL}/events/${eventId}/checkin-stats`, { headers: auth() }).then(r => r.json()),
      ]);
      setEvent(evRes.data.event);
      setInvites(invRes.invites || []);
      setStats(stRes.stats);
    } catch { toast.error('Failed to load check-in data'); }
    finally { setLoading(false); }
  };

  // Step 1: scan or manual entry → verify with backend
  const handleScan = async (code) => {
    const clean = code.trim().toUpperCase();
    if (!clean) return;
    setPendingCode(clean);
    setScanState('verifying');

    try {
      const res = await fetch(`${API_URL}/events/${eventId}/verify-scan/${clean}`, { headers: auth() });
      const data = await res.json();

      if (!res.ok || !data.valid) {
        setRejectionInfo({ reason: data.reason || 'not_found', detail: data.message });
        setScanState('rejected');
        return;
      }

      setGuestProfile({ ...data.guest, eventTitle: data.event?.title });
      setRequiresPin(data.requiresPin);
      setScanState('profile');
    } catch {
      toast.error('Network error — try again');
      setScanState('idle');
    }
  };

  // Step 2 (optional): verify PIN
  const handleVerifyPin = async (pin) => {
    try {
      const res = await fetch(`${API_URL}/events/${eventId}/verify-pin/${pendingCode}`, {
        method: 'POST', headers: auth(), body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      return data;
    } catch { return { valid: false, message: 'Network error' }; }
  };

  // Step 3: commit check-in
  const handleAdmit = async (pinVerified) => {
    setCommitting(true);
    try {
      const res = await fetch(`${API_URL}/events/${eventId}/checkin/${pendingCode}`, {
        method: 'POST', headers: auth(),
        body: JSON.stringify({ pinVerified }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Check-in failed');
        setScanState('idle');
        return;
      }
      setAdmittedInfo(data.invite);
      setScanState('admitted');
      loadData();
    } catch { toast.error('Network error'); setScanState('idle'); }
    finally { setCommitting(false); }
  };

  const handleDeny = () => { setScanState('idle'); setPendingCode(''); setGuestProfile(null); };
  const resetScan  = () => { setScanState('idle'); setPendingCode(''); setGuestProfile(null); setRejectionInfo(null); setAdmittedInfo(null); };

  const filtered = invites.filter(i =>
    !searchQuery ||
    i.guestName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.inviteCode?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
    </div>
  );

  return (
    <div className="min-h-screen bg-neutral-50">

      {/* ── Scan state overlays ── */}
      {scanMode && scanState === 'idle' && (
        <QRCameraScanner onScan={code => { setScanMode(false); handleScan(code); }} onClose={() => setScanMode(false)} />
      )}
      {scanState === 'verifying' && (
        <div className="fixed inset-0 bg-black/70 z-50 flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-12 h-12 text-white animate-spin" />
          <p className="text-white/70 text-sm tracking-wide">Verifying ticket…</p>
        </div>
      )}
      {scanState === 'profile' && guestProfile && (
        <GuestProfileCard
          guest={guestProfile}
          eventTitle={event?.title}
          staffNote={event?.checkinSettings?.staffNote}
          requiresPin={requiresPin}
          onPinVerified={handleVerifyPin}
          onAdmit={handleAdmit}
          onDeny={handleDeny}
          loading={committing}
        />
      )}
      {scanState === 'rejected' && rejectionInfo && (
        <RejectionScreen reason={rejectionInfo.reason} detail={rejectionInfo.detail} onDismiss={resetScan} />
      )}
      {scanState === 'admitted' && admittedInfo && (
        <AdmittedScreen invite={admittedInfo} onDismiss={resetScan} />
      )}
      {showSettings && <SecuritySettings eventId={eventId} onClose={() => setShowSettings(false)} />}
      {showAdd && <AddGuestsModal eventId={eventId} onClose={() => setShowAdd(false)} onSuccess={loadData} />}

      {/* ── Header ── */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(`/event/${eventId}`)} className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-sm font-bold text-neutral-900 truncate max-w-[180px]">{event?.title}</h1>
              <p className="text-xs text-neutral-400">Enterprise Check-in</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setShowSettings(true)} className="p-2 hover:bg-neutral-100 rounded-xl transition-colors" title="Security settings">
              <Settings className="w-4 h-4 text-neutral-500" />
            </button>
            <button onClick={() => setShowManual(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-neutral-600 border border-neutral-200 rounded-xl hover:bg-neutral-50 transition-all">
              <Keyboard className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Manual</span>
            </button>
            <button onClick={() => { resetScan(); setScanMode(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white text-sm font-semibold rounded-xl hover:bg-black transition-all shadow-sm">
              <Camera className="w-4 h-4" /> Scan QR
            </button>
          </div>
        </div>

        {showManual && (
          <div className="border-t border-neutral-100 bg-neutral-50 px-6 py-3">
            <form onSubmit={e => { e.preventDefault(); handleScan(manualCode); setShowManual(false); setManualCode(''); }} className="flex gap-2 max-w-sm">
              <input type="text" value={manualCode} onChange={e => setManualCode(e.target.value.toUpperCase())}
                placeholder="Enter invite code e.g. AB12CD34"
                className="flex-1 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm font-mono tracking-widest focus:outline-none focus:border-neutral-400 bg-white"
                autoFocus />
              <button type="submit" disabled={!manualCode.trim()}
                className="px-4 py-2.5 bg-neutral-900 text-white rounded-xl text-sm font-semibold disabled:opacity-40 hover:bg-black transition-all">
                Verify
              </button>
            </form>
          </div>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6">

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          {[
            { label:'Total Groups',    value: stats?.total ?? 0,               color:'text-neutral-900' },
            { label:'Checked In',      value: stats?.checkedIn ?? 0,           color:'text-emerald-600' },
            { label:'Total Expected',  value: stats?.totalExpectedAttendees ?? 0, color:'text-blue-600' },
            { label:'Adults Expected', value: stats?.totalExpectedAdults ?? 0, color:'text-neutral-600' },
            { label:'Children',        value: stats?.totalExpectedChildren ?? 0,color:'text-indigo-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-2xl border border-neutral-200 p-4">
              <div className={`text-2xl font-black ${color}`}>{value}</div>
              <div className="text-xs text-neutral-500 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Failed scan alert */}
        {stats?.totalFailedScans > 0 && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-800">
              <strong>{stats.totalFailedScans}</strong> failed scan attempt{stats.totalFailedScans !== 1 ? 's' : ''} recorded.
            </p>
          </div>
        )}

        {/* Guest list */}
        <div className="bg-white rounded-2xl border border-neutral-200">
          <div className="px-6 py-4 border-b border-neutral-100 flex items-center gap-3 flex-wrap">
            <h2 className="text-base font-bold text-neutral-900 flex-1">Guest List</h2>
            {invites.length > 5 && (
              <input type="text" placeholder="Search…" value={searchQuery} onChange={e => setSearch(e.target.value)}
                className="border border-neutral-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-neutral-400 w-48" />
            )}
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-neutral-700 border border-neutral-200 rounded-xl hover:bg-neutral-50 transition-all">
              <Plus className="w-4 h-4" /> Add Guests
            </button>
          </div>

          <div className="divide-y divide-neutral-100">
            {filtered.length === 0 ? (
              <div className="text-center py-12 text-neutral-400 text-sm">
                {invites.length === 0 ? 'No guests yet. Add guests to get started.' : 'No guests match your search.'}
              </div>
            ) : filtered.map(invite => {
              const total = (invite.adults || 0) + (invite.children || 0) || invite.groupSize;
              const hasFailed = invite.scanAttempts?.length > 0;

              return (
                <div key={invite._id} className={`flex items-center gap-4 px-6 py-4 hover:bg-neutral-50 transition-colors ${invite.checkedIn ? 'bg-emerald-50/50 hover:bg-emerald-50' : ''}`}>
                  {/* Avatar */}
                  <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold ${invite.checkedIn ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-500'}`}>
                    {invite.guestName.charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-neutral-900">{invite.guestName}</p>
                      {hasFailed && <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full font-semibold">{invite.scanAttempts.length} failed scan{invite.scanAttempts.length !== 1?'s':''}</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-neutral-400 flex-wrap">
                      <span className="font-mono font-medium">{invite.inviteCode}</span>
                      <span className="flex items-center gap-1"><User className="w-3 h-3" />{invite.adults ?? 1}</span>
                      {(invite.children > 0) && <span className="flex items-center gap-1"><Baby className="w-3 h-3 text-blue-400" />{invite.children}</span>}
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />{total} total</span>
                      {invite.securityPin && <span className="flex items-center gap-1 text-amber-600"><Lock className="w-3 h-3" />PIN set</span>}
                    </div>
                  </div>

                  {/* Status */}
                  <div className="flex-shrink-0 text-right">
                    {invite.checkedIn ? (
                      <div>
                        <div className="flex items-center gap-1 text-emerald-600 text-xs font-bold mb-0.5">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Admitted
                        </div>
                        <p className="text-xs text-neutral-400 flex items-center gap-1 justify-end">
                          <Clock className="w-3 h-3" />{new Date(invite.checkedInAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}
                        </p>
                      </div>
                    ) : (
                      <button onClick={() => handleScan(invite.inviteCode)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 text-white text-xs font-semibold rounded-xl hover:bg-black transition-all">
                        <UserCheck className="w-3.5 h-3.5" /> Check In
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
