import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  QrCode, UserCheck, Users, X, ArrowLeft, Camera, CameraOff, Plus,
  Keyboard, AlertTriangle, Baby, User, Settings, Lock, Edit2, Trash2,
  Clock, CheckCircle2, Loader2, CheckCircle, Flag, AlertOctagon, XCircle, 
  Mail, Phone, Copy, ExternalLink, Share2
} from 'lucide-react';
import { eventAPI } from '../services/api';
import toast from 'react-hot-toast';
import ManagerOverrideDialog from '../components/ManagerOverrideDialog';
import SecuritySettingsPanel from '../components/SecuritySettingsPanel';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ENTERPRISE CHECK-IN SYSTEM - COMPLETE VERSION
 * Features:
 * - QR Code Scanning (using html5-qrcode library)
 * - Manual code entry
 * - PIN verification
 * - Security settings panel
 * - Invite link copying with QR code generation
 * - Manager override
 * - Real-time stats
 * - Haptic feedback (vibration)
 * ═══════════════════════════════════════════════════════════════════════════
 */

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
// SUCCESS SCREEN
// ═══════════════════════════════════════════════════════════════════════════
function AdmitSuccessScreen({ guest, onDone }) {
  // Auto-dismiss after 3 seconds
  useEffect(() => {
    hapticSuccess();
    const timer = setTimeout(() => onDone(), 3000);
    return () => clearTimeout(timer);
  }, [onDone]);

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
        <div className="bg-neutral-50 px-12 py-6 border-t border-neutral-200 text-center">
          <p className="text-sm text-neutral-500">Auto-closing in 3 seconds...</p>
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
                className="flex-1 px-8 py-4 bg-yellow-500 text-yellow-900 text-xl font-bold rounded-lg hover:bg-yellow-400 transition-all"
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
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">
                Confirmation Code
              </p>
              <p className="text-2xl font-mono font-bold text-neutral-900">{guest.inviteCode}</p>
            </div>
          </div>
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
              📷 Position QR code within the frame
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
    const link = getInviteLink();
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(link)}`;
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
                if (navigator.share) {
                  navigator.share({ title: `Invite to ${event?.title}`, text: `You're invited!`, url: link });
                } else {
                  window.open(`mailto:${formData.guestEmail}?subject=Event Invite&body=You're invited! ${link}`);
                }
              }}
              className="flex-1 px-4 py-2.5 border border-neutral-200 rounded-xl font-semibold hover:bg-neutral-50 flex items-center justify-center gap-2"
            >
              <Share2 className="w-4 h-4" />
              Share
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
            <label className="block text-sm font-semibold mb-1">Email</label>
            <input
              type="email"
              value={formData.guestEmail}
              onChange={(e) => setFormData({ ...formData, guestEmail: e.target.value })}
              className="w-full border border-neutral-200 rounded-xl px-4 py-2.5 focus:outline-none focus:border-neutral-400"
              placeholder="john@email.com"
            />
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
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function EnterpriseCheckin() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  
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
  
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);

  useEffect(() => {
    if (eventId) {
      loadAllData();
    }
  }, [eventId]);

  const loadAllData = async () => {
    console.log('🔄 Starting to load check-in data...');
    try {
      setLoading(true);
      setLoadError(null);
      
      console.log('📥 Loading event...');
      await loadEvent();
      
      console.log('📥 Loading invites...');
      await loadInvites();
      
      console.log('📥 Loading stats...');
      await loadStats();
      
      console.log('📥 Loading settings...');
      await loadSettings();
      
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
  
  const handleScan = async (code) => {
    if (!code || !code.trim()) {
      toast.error('Invalid code');
      return;
    }

    console.log('📷 Raw QR scan result:', code);

    let inviteCode = code.trim();

    // 🔥 Extract invite code from URL if it's a full URL
    // Handles: 
    // - https://planitapp.onrender.com/invite/ABC123
    // - /invite/ABC123?ref=email
    // - /invite/ABC123#section
    const match = inviteCode.match(/\/invite\/([A-Z0-9]+)(?:[?#]|$)/i);
    if (match) {
      inviteCode = match[1];
      console.log('✅ Extracted invite code from URL:', inviteCode);
    } else {
      // If no /invite/ pattern, remove any protocol and domain
      inviteCode = inviteCode.replace(/^https?:\/\/[^\/]+\/?/i, '');
      console.log('ℹ️ Using cleaned input as invite code:', inviteCode);
    }

    inviteCode = inviteCode.toUpperCase().trim();
    
    setScanMode(false);
    setShowManual(false);
    setManualCode('');
    
    try {
      const response = await eventAPI.verifyScan(eventId, inviteCode);
      const data = response.data;
      
      if (!data.valid) {
        // Trigger error haptic for invalid scan
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
      
      // Trigger success haptic for valid scan
      hapticSuccess();
      
      setCurrentGuest(data.guest);
      setCurrentSecurity(data.security);
      setRequiresPin(data.requiresPin);
      setPinVerified(false);
      
    } catch (error) {
      hapticError();

      // 400 responses from verify-scan contain structured deny data (already_checked_in, blocked, etc)
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
          reason: 'error',
          severity: 'critical',
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
    try {
      const response = await eventAPI.checkIn(eventId, currentGuest.inviteCode, {
        actualAttendees: currentGuest.groupSize,
        pinVerified,
      });
      setAdmittedGuest(response.data.invite);
      setCurrentGuest(null);
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
  
  return (
    <div className="min-h-screen bg-neutral-50">
      {showAdmitSuccess && admittedGuest && <AdmitSuccessScreen guest={admittedGuest} onDone={resetScan} />}
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
          onClose={() => setShowSettingsPanel(false)}
          onSettingsUpdated={() => {
            loadSettings();
            toast.success('Settings updated');
          }}
        />
      )}
      
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(`/event/${eventId}`)} className="p-1.5 hover:bg-neutral-100 rounded-lg transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-sm font-bold text-neutral-900 truncate max-w-[180px]">{event?.title || 'Event'}</h1>
              <p className="text-xs text-neutral-400">Enterprise Check-in</p>
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
            <button
              onClick={() => setShowInviteDialog(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Add Guest</span>
            </button>
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
              className="flex items-center gap-2 px-4 py-2 bg-neutral-900 text-white text-sm font-semibold rounded-xl hover:bg-black transition-all shadow-sm"
            >
              <Camera className="w-4 h-4" />
              Scan QR
            </button>
          </div>
        </div>
        {showManual && (
          <div className="border-t border-neutral-100 bg-neutral-50 px-6 py-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleScan(manualCode);
              }}
              className="flex gap-2 max-w-sm"
            >
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                placeholder="Enter invite code e.g. AB12CD34"
                className="flex-1 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm font-mono tracking-widest focus:outline-none focus:border-neutral-400 bg-white"
                autoFocus
              />
              <button type="submit" disabled={!manualCode.trim()} className="px-4 py-2.5 bg-neutral-900 text-white rounded-xl text-sm font-semibold disabled:opacity-40 hover:bg-black transition-all">
                Verify
              </button>
            </form>
          </div>
        )}
      </header>
      
      <main className="max-w-5xl mx-auto px-6 py-6">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          {[
            { label: 'Total Groups', value: stats?.total ?? invites.length, color: 'text-neutral-900' },
            { label: 'Checked In', value: stats?.checkedIn ?? 0, color: 'text-emerald-600' },
            { label: 'Total Expected', value: stats?.totalExpectedAttendees ?? 0, color: 'text-blue-600' },
            { label: 'Adults Expected', value: stats?.totalExpectedAdults ?? 0, color: 'text-neutral-600' },
            { label: 'Children', value: stats?.totalExpectedChildren ?? 0, color: 'text-indigo-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-2xl border border-neutral-200 p-4">
              <div className={`text-2xl font-black ${color}`}>{value}</div>
              <div className="text-xs text-neutral-500 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
        
        <div className="bg-white rounded-2xl border border-neutral-200">
          <div className="px-6 py-4 border-b border-neutral-100 flex items-center gap-3 flex-wrap">
            <h2 className="text-base font-bold text-neutral-900 flex-1">Guest List</h2>
            {invites.length > 5 && (
              <input
                type="text"
                placeholder="Search…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border border-neutral-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-neutral-400 w-48"
              />
            )}
          </div>
          
          <div className="divide-y divide-neutral-100">
            {filtered.length === 0 ? (
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
              filtered.map((invite) => {
                const adults = invite.adults || 1;
                const children = invite.children || 0;
                const total = adults + children;
                
                return (
                  <div
                    key={invite._id}
                    className={`flex items-center gap-4 px-6 py-4 hover:bg-neutral-50 transition-colors ${
                      invite.checkedIn ? 'bg-emerald-50/50 hover:bg-emerald-50' : ''
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold ${
                        invite.checkedIn ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-100 text-neutral-500'
                      }`}
                    >
                      {invite.guestName.charAt(0).toUpperCase()}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-neutral-900">{invite.guestName}</p>
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
    </div>
  );
}
