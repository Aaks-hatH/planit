import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  QrCode, UserCheck, Users, X, ArrowLeft, Camera, CameraOff, Plus,
  Keyboard, AlertTriangle, Baby, User, Settings, Lock, Edit2, Trash2,
  Clock, CheckCircle2, Loader2, CheckCircle, Flag, AlertOctagon, XCircle,
  Mail, Phone, Copy, ExternalLink, Share2, ShieldAlert, Shield
} from 'lucide-react';
import { eventAPI } from '../services/api';
import toast from 'react-hot-toast';
import ManagerOverrideDialog from '../components/ManagerOverrideDialog';
import SecuritySettingsPanel from '../components/SecuritySettingsPanel';

// ─── Haptic feedback ─────────────────────────────────────────────────────────
const triggerHaptic = (pattern) => {
  if ('vibrate' in navigator) {
    try { navigator.vibrate(pattern); } catch (_) {}
  }
};
const hapticSuccess = () => triggerHaptic(200);
const hapticError   = () => triggerHaptic([200, 100, 200]);
const hapticWarning = () => triggerHaptic([100, 50, 100]);

// ─── Shared helpers ───────────────────────────────────────────────────────────
function formatReason(raw) {
  if (!raw) return 'Unknown';
  return raw
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function InfoRow({ label, value, mono = false, accent = false }) {
  return (
    <div className="flex items-start justify-between py-2.5 border-b border-neutral-100 last:border-0">
      <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400 pt-0.5 flex-shrink-0 w-36">
        {label}
      </span>
      <span className={`text-sm text-right flex-1 ${mono ? 'font-mono tracking-wider' : 'font-medium'} ${accent ? 'text-red-600 font-semibold' : 'text-neutral-900'}`}>
        {value}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SUCCESS SCREEN
// ═══════════════════════════════════════════════════════════════════════════
function AdmitSuccessScreen({ guest, onDone }) {
  const [secondsLeft, setSecondsLeft] = useState(4);

  useEffect(() => {
    hapticSuccess();
    const interval = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { clearInterval(interval); onDone(); return 0; }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [onDone]);

  const checkedInTime = guest.checkedInAt
    ? new Date(guest.checkedInAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-6 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl">

        {/* Accent bar */}
        <div className="h-1 bg-emerald-500 w-full" />

        {/* Status header */}
        <div className="px-8 pt-8 pb-6 border-b border-neutral-100">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-600">
              Access Granted
            </span>
            <CheckCircle2 className="w-5 h-5 text-emerald-500" strokeWidth={2} />
          </div>
          <h1 className="text-3xl font-bold text-neutral-900 tracking-tight mt-1">
            {guest.guestName}
          </h1>
          <p className="text-sm text-neutral-400 mt-1 font-mono tracking-widest">
            {guest.inviteCode}
          </p>
        </div>

        {/* Details */}
        <div className="px-8 py-5">
          <InfoRow label="Check-in Time"  value={checkedInTime} />
          <InfoRow label="Adults"         value={guest.adults ?? '—'} />
          {(guest.children > 0) && (
            <InfoRow label="Children"     value={guest.children} />
          )}
          <InfoRow label="Total Admitted" value={guest.actualAttendees ?? guest.groupSize ?? '—'} />
          {guest.checkedInBy && (
            <InfoRow label="Staff"        value={guest.checkedInBy} />
          )}
        </div>

        {/* Footer: PlanIt branding + dismiss */}
        <div className="px-8 pb-7 pt-2">
          <button
            onClick={onDone}
            className="w-full py-3 bg-neutral-900 text-white text-sm font-semibold rounded-xl hover:bg-black transition-colors"
          >
            Done ({secondsLeft})
          </button>
          <p className="text-center text-xs text-neutral-300 mt-4 tracking-wide">
            Powered by{' '}
            <span className="font-semibold text-neutral-400">PlanIt</span>
            {' '}— Enterprise Check-in
          </p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DENY SCREEN
// ═══════════════════════════════════════════════════════════════════════════
function DenyScreen({ reason, message, details, onDone, canOverride, onOverride }) {
  useEffect(() => {
    if (details?.severity === 'critical' || details?.severity === 'high') {
      hapticError();
    } else {
      hapticWarning();
    }
  }, [details?.severity]);

  const severity = details?.severity || 'critical';
  const accentColor =
    severity === 'critical' ? 'bg-red-500' :
    severity === 'high'     ? 'bg-orange-500' :
                              'bg-amber-400';
  const labelColor =
    severity === 'critical' ? 'text-red-600' :
    severity === 'high'     ? 'text-orange-600' :
                              'text-amber-600';
  const statusLabel =
    severity === 'critical' ? 'Access Denied' :
    severity === 'high'     ? 'Entry Blocked' :
                              'Verification Required';

  return (
    <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-6 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-2xl overflow-hidden shadow-2xl">

        {/* Accent bar */}
        <div className={`h-1 w-full ${accentColor}`} />

        {/* Status header */}
        <div className="px-8 pt-8 pb-6 border-b border-neutral-100">
          <div className="flex items-center justify-between mb-1">
            <span className={`text-xs font-bold uppercase tracking-widest ${labelColor}`}>
              {statusLabel}
            </span>
            <XCircle className={`w-5 h-5 ${labelColor}`} strokeWidth={2} />
          </div>
          <h1 className="text-2xl font-bold text-neutral-900 tracking-tight mt-2 leading-snug">
            {details?.guestName || 'Unknown Guest'}
          </h1>
          {details?.inviteCode && (
            <p className="text-sm text-neutral-400 mt-1 font-mono tracking-widest">
              {details.inviteCode}
            </p>
          )}
        </div>

        {/* Denial details */}
        <div className="px-8 py-5">
          {details?.blockedReason && (
            <InfoRow label="Reason"       value={formatReason(details.blockedReason)} accent />
          )}
          {message && (
            <InfoRow label="Details"      value={message} />
          )}
          {details?.checkedInAt && (
            <InfoRow
              label="Previous Entry"
              value={new Date(details.checkedInAt).toLocaleString([], {
                month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            />
          )}
          {details?.checkedInBy && (
            <InfoRow label="Admitted By"  value={details.checkedInBy} />
          )}
          {details?.currentCapacity !== undefined && (
            <InfoRow
              label="Capacity"
              value={`${details.currentCapacity} / ${details.maxCapacity}`}
              accent
            />
          )}
          {details?.trustScore !== undefined && (
            <InfoRow
              label="Trust Score"
              value={`${details.trustScore}${details.minimumRequired ? ` (min. ${details.minimumRequired})` : ''}`}
              accent={details.trustScore < (details.minimumRequired || 50)}
            />
          )}
          {details?.lockdownReason && (
            <InfoRow label="Lockdown"     value={details.lockdownReason} accent />
          )}
          {details?.groupSize && (
            <InfoRow label="Group Size"   value={details.groupSize} />
          )}
        </div>

        {/* Actions */}
        <div className="px-8 pb-7 pt-2 flex gap-3">
          <button
            onClick={onDone}
            className="flex-1 py-3 bg-neutral-100 text-neutral-800 text-sm font-semibold rounded-xl hover:bg-neutral-200 transition-colors"
          >
            Dismiss
          </button>
          {canOverride && (
            <button
              onClick={onOverride}
              className="flex-1 py-3 bg-neutral-900 text-white text-sm font-semibold rounded-xl hover:bg-black transition-colors"
            >
              Manager Override
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// BOARDING PASS — Guest review before admission decision
// ═══════════════════════════════════════════════════════════════════════════
function BoardingPass({ guest, security, requiresPin, onAdmit, onDeny, onPinVerify }) {
  const [pin, setPin]               = useState('');
  const [pinError, setPinError]     = useState('');
  const [verifyingPin, setVerifyingPin] = useState(false);
  const [pinVerified, setPinVerified]   = useState(false);

  const hasWarnings = (security?.warnings?.length ?? 0) > 0 || (security?.flags?.length ?? 0) > 0;
  const trustScore  = security?.trustScore ?? 100;
  const trustColor  =
    trustScore >= 80 ? 'text-emerald-600' :
    trustScore >= 50 ? 'text-amber-600'   :
                       'text-red-600';

  const handlePinSubmit = async () => {
    if (!pin.trim()) { setPinError('PIN required'); return; }
    setVerifyingPin(true);
    setPinError('');
    try {
      await onPinVerify(pin);
      setPinVerified(true);
      setPin('');
    } catch (err) {
      setPinError(err.message || 'Incorrect PIN');
    } finally {
      setVerifyingPin(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-6 backdrop-blur-sm">
      <div className="bg-white w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl max-h-[92vh] flex flex-col">

        {/* Accent bar */}
        <div className={`h-1 w-full flex-shrink-0 ${hasWarnings ? 'bg-amber-400' : 'bg-neutral-900'}`} />

        {/* Header */}
        <div className="px-8 pt-7 pb-5 border-b border-neutral-100 flex-shrink-0">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0 pr-4">
              <span className="text-xs font-bold uppercase tracking-widest text-neutral-400">
                Guest Review
              </span>
              <h2 className="text-2xl font-bold text-neutral-900 mt-1 leading-tight truncate">
                {guest.guestName}
              </h2>
            </div>
            <div className="text-right flex-shrink-0">
              <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400 block mb-1">
                Code
              </span>
              <span className="text-lg font-mono font-bold text-neutral-900 tracking-widest">
                {guest.inviteCode}
              </span>
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-8 py-5 space-y-5">

          {/* Party details */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3">
              Party
            </p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Adults',      value: guest.adults   ?? '—' },
                { label: 'Children',    value: guest.children ?? 0 },
                { label: 'Trust Score', value: trustScore, color: trustColor },
              ].map(({ label, value, color }) => (
                <div key={label} className="border border-neutral-200 rounded-xl p-3 text-center">
                  <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1">{label}</p>
                  <p className={`text-2xl font-bold ${color ?? 'text-neutral-900'}`}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Contact */}
          {(guest.guestEmail || guest.guestPhone) && (
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">
                Contact
              </p>
              <div className="border border-neutral-200 rounded-xl px-4 divide-y divide-neutral-100">
                {guest.guestEmail && (
                  <InfoRow label="Email" value={guest.guestEmail} />
                )}
                {guest.guestPhone && (
                  <InfoRow label="Phone" value={guest.guestPhone} />
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {guest.notes && (
            <div className="border-l-2 border-amber-400 bg-amber-50 rounded-r-xl px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-700 mb-1">
                Staff Note
              </p>
              <p className="text-sm text-amber-900">{guest.notes}</p>
            </div>
          )}

          {/* Security warnings */}
          {hasWarnings && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-amber-600" strokeWidth={2.5} />
                <p className="text-xs font-bold uppercase tracking-wider text-amber-700">
                  Security Flags — Review Before Admitting
                </p>
              </div>
              <div className="space-y-2">
                {security?.warnings?.map((w, i) => (
                  <div key={i} className="border border-amber-200 bg-amber-50 rounded-xl px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-amber-800 mb-0.5">
                      {formatReason(w.type)}
                    </p>
                    <p className="text-sm text-amber-900">{w.message}</p>
                  </div>
                ))}
                {security?.flags?.map((f, i) => (
                  <div key={i} className="border border-amber-200 bg-amber-50 rounded-xl px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-amber-800 mb-0.5">
                      {formatReason(f.flag)}
                    </p>
                    {f.notes && <p className="text-sm text-amber-900">{f.notes}</p>}
                    <p className="text-xs text-amber-600 mt-1">
                      {new Date(f.flaggedAt).toLocaleString([], {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PIN entry */}
          {requiresPin && guest.hasPin && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Lock className="w-4 h-4 text-neutral-700" strokeWidth={2.5} />
                <p className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                  PIN Verification Required
                </p>
              </div>
              <div className="border border-neutral-200 rounded-xl px-4 py-4">
                <p className="text-sm text-neutral-500 mb-3">
                  Ask the guest for their security PIN before admitting.
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={pin}
                    onChange={(e) => { setPin(e.target.value.toUpperCase()); setPinError(''); }}
                    placeholder="PIN"
                    className="flex-1 border border-neutral-300 rounded-xl px-4 py-2.5 text-base font-mono font-bold tracking-widest focus:outline-none focus:border-neutral-500"
                    maxLength={6}
                    disabled={pinVerified}
                  />
                  {!pinVerified ? (
                    <button
                      onClick={handlePinSubmit}
                      disabled={verifyingPin || !pin.trim()}
                      className="px-5 py-2.5 bg-neutral-900 text-white text-sm font-semibold rounded-xl hover:bg-black disabled:opacity-40 transition-colors"
                    >
                      {verifyingPin ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify'}
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 px-4 text-emerald-600 font-semibold text-sm">
                      <CheckCircle2 className="w-4 h-4" /> Verified
                    </div>
                  )}
                </div>
                {pinError && (
                  <p className="text-sm text-red-600 font-medium mt-2">{pinError}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions — always visible */}
        <div className="flex-shrink-0 border-t border-neutral-100 px-8 py-5 flex gap-3 bg-white">
          <button
            onClick={onDeny}
            className="flex-1 py-3.5 border border-neutral-300 text-neutral-700 text-sm font-semibold rounded-xl hover:bg-neutral-50 transition-colors"
          >
            Deny Entry
          </button>
          <button
            onClick={onAdmit}
            disabled={requiresPin && guest.hasPin && !pinVerified}
            className="flex-1 py-3.5 bg-neutral-900 text-white text-sm font-semibold rounded-xl hover:bg-black disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Admit Guest
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// QR SCANNER
// ═══════════════════════════════════════════════════════════════════════════
function QRScanner({ onScan, onClose }) {
  const [error, setError]             = useState(null);
  const html5QrCodeRef                = useRef(null);
  const isMountedRef                  = useRef(true);
  const isStoppingRef                 = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    startScanner();
    return () => { isMountedRef.current = false; stopScanner(); };
  }, []);

  const stopScanner = async () => {
    const scanner = html5QrCodeRef.current;
    if (!scanner || isStoppingRef.current) return;
    isStoppingRef.current = true;
    html5QrCodeRef.current = null;
    try {
      if (scanner.getState() === 2) await scanner.stop();
    } catch (_) {}
    finally { isStoppingRef.current = false; }
  };

  const startScanner = async () => {
    if (!isMountedRef.current) return;
    try {
      setError(null);
      const { Html5Qrcode } = await import('html5-qrcode');
      if (!isMountedRef.current) return;

      const html5QrCode = new Html5Qrcode('qr-reader');
      html5QrCodeRef.current = html5QrCode;

      const config = {
        fps: 10,
        qrbox: { width: 240, height: 240 },
        aspectRatio: 1.0,
        experimentalFeatures: { useBarCodeDetectorIfSupported: true },
      };

      const onSuccess = (decoded) => { stopScanner(); onScan(decoded); };
      const onScanError = () => {};

      try {
        await html5QrCode.start({ facingMode: { exact: 'environment' } }, config, onSuccess, onScanError);
      } catch (_) {
        if (!isMountedRef.current) return;
        try {
          if (html5QrCodeRef.current?.getState() === 2) await html5QrCodeRef.current.stop();
        } catch (_) {}
        const fallback = new Html5Qrcode('qr-reader');
        html5QrCodeRef.current = fallback;
        await fallback.start({ facingMode: 'user' }, config, onSuccess, onScanError);
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      let msg;
      if (err.name === 'NotAllowedError' || err.message?.includes('Permission'))
        msg = 'Camera permission denied. Allow camera access in your browser settings, then try again.';
      else if (err.name === 'NotFoundError')
        msg = 'No camera found on this device.';
      else if (err.name === 'NotReadableError' || err.message?.includes('in use'))
        msg = 'Camera is in use by another application. Close other apps and try again.';
      else if (err.name === 'AbortError' || err.message?.includes('Timeout'))
        msg = 'Camera took too long to start. Close other apps using the camera, then tap Retry.';
      else
        msg = `Could not start camera. ${err.message || 'Check permissions and try again.'}`;
      setError(msg);
    }
  };

  const handleRetry = async () => {
    await stopScanner();
    setTimeout(() => { if (isMountedRef.current) startScanner(); }, 800);
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
        <button onClick={onClose} className="flex items-center gap-2 text-white/80 hover:text-white text-sm font-medium transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <span className="text-white text-xs font-bold uppercase tracking-widest">Scan QR Code</span>
        <div className="w-16" />
      </div>

      <div className="flex-1 relative flex items-center justify-center bg-black">
        {error ? (
          <div className="text-center text-white px-8 max-w-sm mx-auto">
            <CameraOff className="w-12 h-12 mx-auto mb-5 text-neutral-500" strokeWidth={1.5} />
            <p className="text-base font-semibold mb-2">Camera Unavailable</p>
            <p className="text-sm text-neutral-400 mb-8 leading-relaxed">{error}</p>
            <div className="flex flex-col gap-3">
              <button onClick={handleRetry} className="px-6 py-3 bg-white text-black rounded-xl text-sm font-semibold hover:bg-neutral-100 transition-colors">
                Retry
              </button>
              <button onClick={onClose} className="px-6 py-3 bg-neutral-800 text-white rounded-xl text-sm font-semibold hover:bg-neutral-700 transition-colors">
                Close
              </button>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-sm px-6">
            <div id="qr-reader" className="rounded-2xl overflow-hidden shadow-2xl" />
            <p className="text-neutral-400 text-center mt-5 text-xs tracking-wide">
              Position the QR code within the frame to scan
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// INVITE DIALOG
// ═══════════════════════════════════════════════════════════════════════════
function InviteDialog({ invite, eventId, event, onClose, onSave }) {
  const [formData, setFormData] = useState({
    guestName:   invite?.guestName   || '',
    guestEmail:  invite?.guestEmail  || '',
    guestPhone:  invite?.guestPhone  || '',
    adults:      invite?.adults      ?? 1,
    children:    invite?.children    ?? 0,
    notes:       invite?.notes       || '',
    securityPin: invite?.securityPin || '',
  });
  const [saving, setSaving]             = useState(false);
  const [showSuccess, setShowSuccess]   = useState(false);
  const [createdInvite, setCreatedInvite] = useState(null);
  const [copied, setCopied]             = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.guestName.trim()) { toast.error('Guest name is required'); return; }
    setSaving(true);
    try {
      if (invite) {
        await eventAPI.updateInvite(eventId, invite._id, formData);
        toast.success('Invite updated');
        onSave();
      } else {
        const res = await eventAPI.createInvite(eventId, formData);
        const created = res.data.invites?.[0] || res.data.invite || res.data;
        setCreatedInvite(created);
        setShowSuccess(true);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save invite');
    } finally {
      setSaving(false);
    }
  };

  const inviteLink = createdInvite
    ? `${window.location.origin}/invite/${createdInvite.inviteCode}`
    : '';

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) { toast.error('Failed to copy'); }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: `Invite to ${event?.title}`, url: inviteLink });
    } else {
      window.open(`mailto:${formData.guestEmail}?subject=You're Invited&body=${inviteLink}`);
    }
  };

  if (showSuccess && createdInvite) {
    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
        <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
          <div className="h-1 bg-emerald-500" />
          <div className="px-7 pt-7 pb-5 border-b border-neutral-100">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-emerald-600">Invite Created</span>
                <h2 className="text-xl font-bold text-neutral-900 mt-1">{formData.guestName}</h2>
              </div>
              <CheckCircle2 className="w-6 h-6 text-emerald-500 flex-shrink-0" />
            </div>
          </div>

          <div className="px-7 py-5">
            {/* QR code */}
            <div className="flex justify-center mb-5">
              <div className="bg-white border border-neutral-200 rounded-xl p-4 inline-block">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(inviteLink)}`}
                  alt="Invite QR"
                  className="w-44 h-44"
                />
              </div>
            </div>
            <p className="text-center font-mono text-lg font-bold text-neutral-900 tracking-widest mb-5">
              {createdInvite.inviteCode}
            </p>

            {/* Copy link */}
            <div className="flex gap-2 mb-5">
              <input
                type="text"
                value={inviteLink}
                readOnly
                className="flex-1 border border-neutral-200 rounded-xl px-4 py-2.5 text-xs font-mono bg-neutral-50 text-neutral-600 focus:outline-none"
              />
              <button
                onClick={copyLink}
                className="px-4 py-2.5 bg-neutral-900 text-white rounded-xl text-sm font-semibold hover:bg-black transition-colors flex items-center gap-2"
              >
                {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setShowSuccess(false); setCreatedInvite(null); onSave(); }}
                className="flex-1 py-2.5 bg-neutral-900 text-white rounded-xl text-sm font-semibold hover:bg-black transition-colors"
              >
                Done
              </button>
              <button
                onClick={handleShare}
                className="flex-1 py-2.5 border border-neutral-200 rounded-xl text-sm font-semibold hover:bg-neutral-50 transition-colors flex items-center justify-center gap-2 text-neutral-700"
              >
                <Share2 className="w-4 h-4" />
                Share
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-100">
          <h2 className="text-base font-bold text-neutral-900">
            {invite ? 'Edit Invite' : 'New Invite'}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors">
            <X className="w-4 h-4 text-neutral-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">Guest Name *</label>
            <input
              type="text"
              value={formData.guestName}
              onChange={(e) => setFormData({ ...formData, guestName: e.target.value })}
              className="w-full border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-neutral-400"
              placeholder="Full name"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">Adults</label>
              <input type="number" value={formData.adults} onChange={(e) => setFormData({ ...formData, adults: parseInt(e.target.value) || 0 })}
                className="w-full border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-neutral-400" min="0" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">Children</label>
              <input type="number" value={formData.children} onChange={(e) => setFormData({ ...formData, children: parseInt(e.target.value) || 0 })}
                className="w-full border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-neutral-400" min="0" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">Email</label>
            <input type="email" value={formData.guestEmail} onChange={(e) => setFormData({ ...formData, guestEmail: e.target.value })}
              className="w-full border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-neutral-400" placeholder="guest@email.com" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">Phone</label>
            <input type="tel" value={formData.guestPhone} onChange={(e) => setFormData({ ...formData, guestPhone: e.target.value })}
              className="w-full border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-neutral-400" placeholder="+1 555 0100" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">Security PIN <span className="normal-case font-normal text-neutral-400">(optional)</span></label>
            <input type="text" value={formData.securityPin} onChange={(e) => setFormData({ ...formData, securityPin: e.target.value.toUpperCase() })}
              className="w-full border border-neutral-200 rounded-xl px-4 py-2.5 text-sm font-mono tracking-widest focus:outline-none focus:border-neutral-400" placeholder="ABC123" maxLength={6} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1.5">Notes</label>
            <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full border border-neutral-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-neutral-400 resize-none"
              rows={2} placeholder="Dietary requirements, accessibility needs, etc." />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-neutral-200 rounded-xl text-sm font-semibold hover:bg-neutral-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="flex-1 py-2.5 bg-neutral-900 text-white rounded-xl text-sm font-semibold hover:bg-black disabled:opacity-50 transition-colors">
              {saving ? 'Saving...' : invite ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function EnterpriseCheckin() {
  const { eventId } = useParams();
  const navigate    = useNavigate();

  const [event, setEvent]       = useState(null);
  const [invites, setInvites]   = useState([]);
  const [stats, setStats]       = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [scanMode, setScanMode]       = useState(false);
  const [showManual, setShowManual]   = useState(false);
  const [manualCode, setManualCode]   = useState('');
  const [currentGuest, setCurrentGuest]     = useState(null);
  const [currentSecurity, setCurrentSecurity] = useState(null);
  const [requiresPin, setRequiresPin]       = useState(false);
  const [pinVerified, setPinVerified]       = useState(false);

  const [showAdmitSuccess, setShowAdmitSuccess] = useState(false);
  const [showDenyScreen, setShowDenyScreen]     = useState(false);
  const [denyDetails, setDenyDetails]           = useState(null);
  const [admittedGuest, setAdmittedGuest]       = useState(null);

  const [showOverrideDialog, setShowOverrideDialog] = useState(false);
  const [overrideInvite, setOverrideInvite]         = useState(null);

  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [editingInvite, setEditingInvite]       = useState(null);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);

  useEffect(() => { if (eventId) loadAllData(); }, [eventId]);

  const loadAllData = async () => {
    try {
      setLoading(true);
      setLoadError(null);
      await loadEvent();
      await loadInvites();
      await loadStats();
      await loadSettings();
    } catch (error) {
      const msg = error.response?.data?.error || error.message || 'Failed to load check-in data';
      setLoadError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const loadEvent = async () => {
    const res = await eventAPI.getById(eventId);
    setEvent(res.data.event || res.data);
  };

  const loadInvites = async () => {
    try {
      const res = await eventAPI.getInvites(eventId);
      setInvites(res.data.invites || res.data || []);
    } catch (_) { setInvites([]); }
  };

  const loadStats = async () => {
    try {
      const res = await eventAPI.getCheckInStats(eventId);
      setStats(res.data.stats || res.data);
    } catch (_) {}
  };

  const loadSettings = async () => {
    try {
      const res = await eventAPI.getCheckInSettings(eventId);
      setSettings(res.data.settings || res.data || {});
    } catch (_) { setSettings({}); }
  };

  const handleScan = async (code) => {
    if (!code?.trim()) { toast.error('Invalid code'); return; }

    let inviteCode = code.trim();
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

    try {
      const res  = await eventAPI.verifyScan(eventId, inviteCode);
      const data = res.data;

      if (!data.valid) {
        hapticError();
        setDenyDetails({
          reason:         data.reason,
          severity:       data.severity || 'critical',
          message:        data.message,
          displayMessage: data.displayMessage,
          checkedInAt:    data.checkedInAt,
          checkedInBy:    data.checkedInBy,
          blockedReason:  data.blockedReason,
          requiresOverride: data.requiresOverride,
          inviteCode:     data.inviteCode,
          guestName:      data.guestName,
          groupSize:      data.groupSize,
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
      hapticError();
      const errData = error.response?.data;
      if (errData?.valid === false) {
        setDenyDetails({
          reason:         errData.reason,
          severity:       errData.severity || 'critical',
          message:        errData.message,
          displayMessage: errData.displayMessage,
          checkedInAt:    errData.checkedInAt,
          checkedInBy:    errData.checkedInBy,
          blockedReason:  errData.blockedReason,
          requiresOverride: errData.requiresOverride,
          inviteCode:     errData.inviteCode,
          guestName:      errData.guestName,
          groupSize:      errData.groupSize,
        });
      } else {
        setDenyDetails({
          reason:   'error',
          severity: 'critical',
          message:  errData?.message || error.message || 'Scan failed',
        });
      }
      setShowDenyScreen(true);
    }
  };

  const handlePinVerify = async (pin) => {
    try {
      const res = await eventAPI.verifyPin(eventId, currentGuest.inviteCode, pin);
      if (res.data.valid) {
        hapticSuccess();
        setPinVerified(true);
        toast.success('PIN verified');
      } else {
        throw new Error(res.data.message || 'Invalid PIN');
      }
    } catch (err) {
      hapticError();
      throw new Error(err.response?.data?.message || err.message);
    }
  };

  const handleAdmit = async () => {
    try {
      const res = await eventAPI.checkIn(eventId, currentGuest.inviteCode, {
        actualAttendees: currentGuest.groupSize,
        pinVerified,
      });
      setAdmittedGuest(res.data.invite);
      setCurrentGuest(null);
      setShowAdmitSuccess(true);
      loadInvites();
      loadStats();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Check-in failed');
      setCurrentGuest(null);
    }
  };

  const handleDenyFromBoarding = () => {
    setCurrentGuest(null);
    setDenyDetails({
      reason:         'staff_denied',
      severity:       'medium',
      message:        'Entry denied by security staff',
      displayMessage: 'Entry denied by security staff',
    });
    setShowDenyScreen(true);
  };

  const handleRequestOverride = () => {
    const invite = currentGuest || (denyDetails ? {
      inviteCode:    denyDetails.inviteCode,
      guestName:     denyDetails.guestName || 'Guest',
      groupSize:     denyDetails.groupSize || 1,
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
  };

  const handleDeleteInvite = async (inviteId) => {
    if (!confirm('Delete this invite?')) return;
    try {
      await eventAPI.deleteInvite(eventId, inviteId);
      toast.success('Invite deleted');
      loadInvites();
      loadStats();
    } catch (_) { toast.error('Failed to delete invite'); }
  };

  const filtered = invites.filter((inv) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      inv.guestName.toLowerCase().includes(q) ||
      inv.inviteCode.toLowerCase().includes(q) ||
      inv.guestEmail?.toLowerCase().includes(q)
    );
  });

  // ── Loading / error states ────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-neutral-400 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm text-neutral-500">Loading check-in system…</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <AlertTriangle className="w-10 h-10 text-neutral-400 mx-auto mb-4" strokeWidth={1.5} />
          <h2 className="text-lg font-bold text-neutral-900 mb-2">Unable to Load</h2>
          <p className="text-sm text-neutral-500 mb-6">{loadError}</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => navigate(`/event/${eventId}`)} className="px-4 py-2.5 border border-neutral-200 rounded-xl text-sm font-semibold hover:bg-neutral-50 transition-colors">
              Go Back
            </button>
            <button onClick={loadAllData} className="px-4 py-2.5 bg-neutral-900 text-white rounded-xl text-sm font-semibold hover:bg-black transition-colors">
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-neutral-50">

      {/* Overlays */}
      {showAdmitSuccess && admittedGuest && (
        <AdmitSuccessScreen guest={admittedGuest} onDone={resetScan} />
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
          onCancel={() => { setShowOverrideDialog(false); setOverrideInvite(null); }}
        />
      )}
      {scanMode && <QRScanner onScan={handleScan} onClose={() => setScanMode(false)} />}
      {showInviteDialog && (
        <InviteDialog
          invite={editingInvite}
          eventId={eventId}
          event={event}
          onClose={() => { setShowInviteDialog(false); setEditingInvite(null); }}
          onSave={() => { setShowInviteDialog(false); setEditingInvite(null); loadInvites(); loadStats(); }}
        />
      )}
      {showSettingsPanel && (
        <SecuritySettingsPanel
          eventId={eventId}
          onClose={() => setShowSettingsPanel(false)}
          onSettingsUpdated={() => { loadSettings(); toast.success('Settings saved'); }}
        />
      )}

      {/* Header */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate(`/event/${eventId}`)}
              className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4 text-neutral-600" />
            </button>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-neutral-900 truncate max-w-[200px]">
                {event?.title || 'Event'}
              </h1>
              <p className="text-xs text-neutral-400">Enterprise Check-in</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setShowSettingsPanel(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-neutral-600 border border-neutral-200 rounded-xl hover:bg-neutral-50 transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Settings</span>
            </button>
            <button
              onClick={() => { setEditingInvite(null); setShowInviteDialog(true); }}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-neutral-700 border border-neutral-200 rounded-xl hover:bg-neutral-50 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Add Guest</span>
            </button>
            <button
              onClick={() => setShowManual((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-neutral-600 border border-neutral-200 rounded-xl hover:bg-neutral-50 transition-colors"
            >
              <Keyboard className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Manual</span>
            </button>
            <button
              onClick={() => { resetScan(); setScanMode(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white text-sm font-semibold rounded-xl hover:bg-black transition-colors"
            >
              <Camera className="w-4 h-4" />
              Scan QR
            </button>
          </div>
        </div>

        {showManual && (
          <div className="border-t border-neutral-100 bg-neutral-50 px-6 py-3">
            <form
              onSubmit={(e) => { e.preventDefault(); handleScan(manualCode); }}
              className="flex gap-2 max-w-sm"
            >
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                placeholder="Enter invite code"
                className="flex-1 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm font-mono tracking-widest focus:outline-none focus:border-neutral-400 bg-white"
                autoFocus
              />
              <button
                type="submit"
                disabled={!manualCode.trim()}
                className="px-4 py-2.5 bg-neutral-900 text-white rounded-xl text-sm font-semibold disabled:opacity-40 hover:bg-black transition-colors"
              >
                Verify
              </button>
            </form>
          </div>
        )}
      </header>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-6 py-6">

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          {[
            { label: 'Total Groups',     value: stats?.total                ?? invites.length, highlight: false },
            { label: 'Checked In',       value: stats?.checkedIn            ?? 0,              highlight: true  },
            { label: 'Total Expected',   value: stats?.totalExpectedAttendees ?? 0,            highlight: false },
            { label: 'Adults',           value: stats?.totalExpectedAdults  ?? 0,              highlight: false },
            { label: 'Children',         value: stats?.totalExpectedChildren ?? 0,             highlight: false },
          ].map(({ label, value, highlight }) => (
            <div key={label} className="bg-white rounded-2xl border border-neutral-200 p-4">
              <p className={`text-2xl font-black ${highlight ? 'text-emerald-600' : 'text-neutral-900'}`}>
                {value}
              </p>
              <p className="text-xs text-neutral-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Guest list */}
        <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-100 flex items-center gap-3 flex-wrap">
            <h2 className="text-sm font-bold text-neutral-900 flex-1">Guest List</h2>
            {invites.length > 5 && (
              <input
                type="text"
                placeholder="Search guests…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border border-neutral-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-neutral-400 w-48"
              />
            )}
          </div>

          <div className="divide-y divide-neutral-100">
            {filtered.length === 0 ? (
              <div className="py-14 text-center">
                {invites.length === 0 ? (
                  <div>
                    <p className="text-sm text-neutral-400 mb-4">No guests added yet.</p>
                    <button
                      onClick={() => setShowInviteDialog(true)}
                      className="inline-flex items-center gap-2 px-4 py-2.5 bg-neutral-900 text-white text-sm font-semibold rounded-xl hover:bg-black transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add First Guest
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-neutral-400">No guests match your search.</p>
                )}
              </div>
            ) : (
              filtered.map((invite) => {
                const adults   = invite.adults   || 1;
                const children = invite.children || 0;
                const total    = adults + children;

                return (
                  <div
                    key={invite._id}
                    className={`flex items-center gap-4 px-6 py-4 hover:bg-neutral-50 transition-colors ${
                      invite.checkedIn ? 'bg-emerald-50/40' : ''
                    }`}
                  >
                    {/* Avatar */}
                    <div className={`w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${
                      invite.checkedIn
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-neutral-100 text-neutral-500'
                    }`}>
                      {invite.guestName.charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-neutral-900 truncate">
                        {invite.guestName}
                      </p>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <span className="text-xs font-mono text-neutral-400 tracking-wider">
                          {invite.inviteCode}
                        </span>
                        <span className="text-xs text-neutral-400 flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {adults} adult{adults !== 1 ? 's' : ''}
                        </span>
                        {children > 0 && (
                          <span className="text-xs text-neutral-400 flex items-center gap-1">
                            <Baby className="w-3 h-3" />
                            {children} child{children !== 1 ? 'ren' : ''}
                          </span>
                        )}
                        <span className="text-xs text-neutral-300">
                          {total} total
                        </span>
                      </div>
                    </div>

                    {/* Status / actions */}
                    <div className="flex-shrink-0 flex items-center gap-2">
                      {invite.checkedIn ? (
                        <div className="text-right">
                          <div className="flex items-center gap-1.5 text-emerald-600 text-xs font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Admitted
                          </div>
                          <p className="text-xs text-neutral-400 mt-0.5">
                            {new Date(invite.checkedInAt).toLocaleTimeString([], {
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </p>
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => { setEditingInvite(invite); setShowInviteDialog(true); }}
                            className="p-1.5 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteInvite(invite._id)}
                            className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleScan(invite.inviteCode)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 text-white text-xs font-semibold rounded-xl hover:bg-black transition-colors"
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
    </div>
  );
}
