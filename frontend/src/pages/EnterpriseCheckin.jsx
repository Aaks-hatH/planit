import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QrCode, UserCheck, Users, Check, Plus, X, ArrowLeft, Camera, CameraOff, RefreshCw, Keyboard } from 'lucide-react';
import { eventAPI } from '../services/api';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// ─────────────────────────────────────────────────────────────────────────────
// Real QR Camera Scanner
// Uses native BarcodeDetector (Chrome/Edge) or jsQR (loaded from CDN) as fallback
// ─────────────────────────────────────────────────────────────────────────────
function QRCameraScanner({ onScan, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef = useRef(null);
  const cooldownRef = useRef(false);
  const lastCodeRef = useRef('');
  const jsQRLoadedRef = useRef(false);

  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [errorMsg, setErrorMsg] = useState('');

  // Load jsQR from CDN as fallback for browsers without BarcodeDetector
  const ensureJsQR = useCallback(() => {
    return new Promise((resolve) => {
      if (window.jsQR) { resolve(window.jsQR); return; }
      if (jsQRLoadedRef.current) {
        // Wait for it to finish loading
        const wait = setInterval(() => {
          if (window.jsQR) { clearInterval(wait); resolve(window.jsQR); }
        }, 100);
        return;
      }
      jsQRLoadedRef.current = true;
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
      s.onload = () => resolve(window.jsQR);
      s.onerror = () => resolve(null);
      document.head.appendChild(s);
    });
  }, []);

  const extractCode = (raw) => {
    if (!raw) return null;
    const trimmed = raw.trim();
    // Extract invite code from full URL  e.g. https://site.com/invite/AB12CD34
    const match = trimmed.match(/\/invite\/([A-Z0-9]{6,12})/i);
    if (match) return match[1].toUpperCase();
    // If it looks like a raw code (alphanumeric, 6-12 chars)
    if (/^[A-Z0-9]{6,12}$/i.test(trimmed)) return trimmed.toUpperCase();
    // Otherwise pass through as-is
    return trimmed.toUpperCase();
  };

  const handleDetected = useCallback((raw) => {
    const code = extractCode(raw);
    if (!code) return;
    if (code === lastCodeRef.current || cooldownRef.current) return;
    lastCodeRef.current = code;
    cooldownRef.current = true;
    setTimeout(() => { cooldownRef.current = false; }, 2500);
    onScan(code);
  }, [onScan]);

  const startScanning = useCallback(async (video, canvas) => {
    const jsQR = await ensureJsQR();
    const hasBarcodeDetector = 'BarcodeDetector' in window;

    let detector = null;
    if (hasBarcodeDetector) {
      try {
        detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      } catch (_) { /* fallback to jsQR */ }
    }

    const tick = async () => {
      if (!video || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const ctx = canvas.getContext('2d');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      if (detector) {
        try {
          const codes = await detector.detect(canvas);
          if (codes.length > 0) handleDetected(codes[0].rawValue);
        } catch (_) {}
      } else if (jsQR) {
        try {
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const result = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert'
          });
          if (result) handleDetected(result.data);
        } catch (_) {}
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [ensureJsQR, handleDetected]);

  const startCamera = useCallback(async () => {
    setStatus('loading');
    setErrorMsg('');
    lastCodeRef.current = '';

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      streamRef.current = stream;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video) return;

      video.srcObject = stream;
      video.setAttribute('playsinline', true);

      await new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve;
        video.onerror = reject;
        setTimeout(reject, 10000); // 10s timeout
      });

      await video.play();
      setStatus('ready');
      startScanning(video, canvas);
    } catch (err) {
      let msg = 'Could not start camera.';
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        msg = 'Camera access was denied. Please allow camera permission in your browser and try again.';
      } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
        msg = 'No camera found on this device.';
      } else if (err?.name === 'NotReadableError') {
        msg = 'Camera is already in use by another app.';
      } else if (err?.message) {
        msg = err.message;
      }
      setStatus('error');
      setErrorMsg(msg);
    }
  }, [startScanning]);

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/70 backdrop-blur-sm z-10">
        <button
          onClick={() => { stopCamera(); onClose(); }}
          className="flex items-center gap-2 text-white text-sm hover:text-neutral-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to list
        </button>
        <span className="text-white text-sm font-semibold">Scan Guest QR Code</span>
        <div className="w-24" />
      </div>

      {/* Camera / Error area */}
      <div className="flex-1 relative overflow-hidden bg-black">
        {status === 'error' ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900 px-8 text-center gap-4">
            <CameraOff className="w-14 h-14 text-neutral-500" />
            <div>
              <p className="text-white font-semibold mb-1">Camera Unavailable</p>
              <p className="text-neutral-400 text-sm max-w-sm">{errorMsg}</p>
            </div>
            <button
              onClick={startCamera}
              className="mt-2 flex items-center gap-2 px-5 py-2.5 bg-white text-neutral-900 rounded-lg font-medium text-sm hover:bg-neutral-100"
            >
              <RefreshCw className="w-4 h-4" /> Try Again
            </button>
            <button
              onClick={() => { stopCamera(); onClose(); }}
              className="text-neutral-500 text-sm hover:text-neutral-300"
            >
              Use manual code entry instead →
            </button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              muted
              playsInline
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Dark overlay with cut-out */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative w-64 h-64">
                {/* Semi-dark overlay outside scanner box */}
                <div className="absolute -inset-[100vw] bg-black/50" />
                {/* Clear box */}
                <div className="absolute inset-0 bg-transparent" />
                {/* Corner brackets */}
                {[
                  'top-0 left-0 border-t-4 border-l-4 rounded-tl-xl',
                  'top-0 right-0 border-t-4 border-r-4 rounded-tr-xl',
                  'bottom-0 left-0 border-b-4 border-l-4 rounded-bl-xl',
                  'bottom-0 right-0 border-b-4 border-r-4 rounded-br-xl'
                ].map((cls, i) => (
                  <div key={i} className={`absolute w-8 h-8 border-white ${cls}`} />
                ))}
                {/* Animated scan line */}
                {status === 'ready' && (
                  <div
                    className="absolute left-2 right-2 h-0.5 bg-green-400 shadow-lg shadow-green-400/50"
                    style={{ animation: 'scanline 2s ease-in-out infinite', top: '50%' }}
                  />
                )}
              </div>
            </div>

            {/* Bottom hint */}
            <div className="absolute bottom-8 inset-x-0 text-center px-4">
              {status === 'loading' && (
                <p className="text-white/70 text-sm">Starting camera…</p>
              )}
              {status === 'ready' && (
                <p className="text-white/80 text-sm">Point the QR code inside the box</p>
              )}
            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes scanline {
          0%   { top: 10%; opacity: 1; }
          50%  { top: 90%; opacity: 1; }
          100% { top: 10%; opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main EnterpriseCheckin Page
// ─────────────────────────────────────────────────────────────────────────────
export default function EnterpriseCheckin() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [invites, setInvites] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddGuests, setShowAddGuests] = useState(false);
  const [scanMode, setScanMode] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [newGuests, setNewGuests] = useState([{ guestName: '', guestEmail: '', groupSize: 1, plusOnes: 0 }]);
  const [checkingIn, setCheckingIn] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => { loadData(); }, [eventId]);

  const authHeaders = () => {
    const token = localStorage.getItem('eventToken');
    return { 'Authorization': `Bearer ${token}`, 'x-event-token': token, 'Content-Type': 'application/json' };
  };

  const loadData = async () => {
    try {
      const [eventRes, invitesRes, statsRes] = await Promise.all([
        eventAPI.getById(eventId),
        fetch(`${API_URL}/events/${eventId}/invites`, { headers: authHeaders() }).then(r => r.json()),
        fetch(`${API_URL}/events/${eventId}/checkin-stats`, { headers: authHeaders() }).then(r => r.json())
      ]);
      setEvent(eventRes.data.event);
      setInvites(invitesRes.invites || []);
      setStats(statsRes.stats);
    } catch {
      toast.error('Failed to load check-in data');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async (inviteCode) => {
    const code = inviteCode.trim().toUpperCase();
    if (!code) return;
    setCheckingIn(code);
    try {
      const res = await fetch(`${API_URL}/events/${eventId}/checkin/${code}`, {
        method: 'POST',
        headers: authHeaders()
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'Already checked in') {
          toast.error(`Already checked in at ${new Date(data.checkedInAt).toLocaleTimeString()}`);
        } else if (res.status === 404) {
          toast.error(`Code "${code}" not found. Double-check the invite code.`);
        } else {
          toast.error(data.error || 'Check-in failed');
        }
        return;
      }
      toast.success(`✓ ${data.invite?.guestName || 'Guest'} checked in!`);
      setManualCode('');
      setShowManual(false);
      setScanMode(false);
      loadData();
    } catch {
      toast.error('Network error — check your connection and try again.');
    } finally {
      setCheckingIn('');
    }
  };

  const handleAddGuests = async () => {
    const validGuests = newGuests.filter(g => g.guestName.trim());
    if (!validGuests.length) { toast.error('Please enter at least one guest name'); return; }
    try {
      const res = await fetch(`${API_URL}/events/${eventId}/invites`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ guests: validGuests })
      });
      if (!res.ok) throw new Error();
      toast.success(`${validGuests.length} invite${validGuests.length > 1 ? 's' : ''} created`);
      setShowAddGuests(false);
      setNewGuests([{ guestName: '', guestEmail: '', groupSize: 1, plusOnes: 0 }]);
      loadData();
    } catch {
      toast.error('Failed to create invites');
    }
  };

  const filteredInvites = invites.filter(inv =>
    !searchQuery ||
    inv.guestName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inv.inviteCode?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <span className="spinner w-5 h-5 border-2 border-neutral-200 border-t-neutral-500" />
    </div>
  );

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Full-screen camera scanner */}
      {scanMode && (
        <QRCameraScanner
          onScan={(code) => {
            setScanMode(false);
            setTimeout(() => handleCheckIn(code), 100); // slight delay for UI to switch back
          }}
          onClose={() => setScanMode(false)}
        />
      )}

      {/* Header */}
      <header className="bg-white border-b border-neutral-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(`/event/${eventId}`)} className="btn btn-ghost p-1.5">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-sm font-semibold text-neutral-900">{event?.title}</h1>
              <p className="text-xs text-neutral-400">Enterprise Check-in</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowManual(v => !v)}
              className="btn btn-secondary px-3 py-2 text-xs gap-1.5"
              title="Enter code manually"
            >
              <Keyboard className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Manual</span>
            </button>
            <button
              onClick={() => setScanMode(true)}
              className="btn btn-primary px-4 py-2 text-sm gap-2"
            >
              <Camera className="w-4 h-4" />
              Scan QR
            </button>
          </div>
        </div>

        {/* Manual code entry (collapsible) */}
        {showManual && (
          <div className="border-t border-neutral-100 bg-neutral-50 px-6 py-3">
            <form
              onSubmit={(e) => { e.preventDefault(); handleCheckIn(manualCode); }}
              className="flex gap-2 max-w-md"
            >
              <input
                type="text"
                value={manualCode}
                onChange={e => setManualCode(e.target.value.toUpperCase())}
                placeholder="Enter invite code (e.g. AB12CD34)"
                className="input flex-1 font-mono text-sm tracking-wider"
                autoFocus
              />
              <button
                type="submit"
                disabled={!manualCode.trim() || !!checkingIn}
                className="btn btn-primary px-4 text-sm"
              >
                {checkingIn ? <span className="spinner w-4 h-4 border-2 border-white/30 border-t-white" /> : 'Check In'}
              </button>
            </form>
          </div>
        )}
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6">

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
          {[
            { label: 'Total Groups', value: stats?.total ?? 0, color: 'text-neutral-900' },
            { label: 'Checked In', value: stats?.checkedIn ?? 0, color: 'text-emerald-600' },
            { label: 'Actual Attendees', value: stats?.totalActualAttendees ?? 0, color: 'text-blue-600' },
            { label: 'Confirmed', value: stats?.confirmed ?? 0, color: 'text-amber-600' },
            { label: 'Pending', value: stats?.pending ?? 0, color: 'text-neutral-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="card p-4">
              <div className={`text-2xl font-bold ${color}`}>{value}</div>
              <div className="text-xs text-neutral-500">{label}</div>
            </div>
          ))}
        </div>

        {/* Guest List */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4 gap-3">
            <h2 className="text-lg font-semibold text-neutral-900 flex-1">Guest List</h2>
            {invites.length > 5 && (
              <input
                type="text"
                placeholder="Search guests…"
                className="input text-sm max-w-xs"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            )}
            <button onClick={() => setShowAddGuests(true)} className="btn btn-secondary text-sm gap-1.5 flex-shrink-0">
              <Plus className="w-4 h-4" /> Add Guests
            </button>
          </div>

          <div className="space-y-2">
            {filteredInvites.length === 0 ? (
              <div className="text-center py-10 text-neutral-400 text-sm">
                {invites.length === 0
                  ? 'No guests yet. Click "Add Guests" to create invites.'
                  : 'No guests match your search.'}
              </div>
            ) : (
              filteredInvites.map(invite => (
                <div
                  key={invite._id}
                  className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${
                    invite.checkedIn
                      ? 'bg-emerald-50 border-emerald-200'
                      : 'bg-neutral-50 border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                      invite.checkedIn ? 'bg-emerald-100 text-emerald-600' : 'bg-neutral-100 text-neutral-400'
                    }`}>
                      {invite.checkedIn ? <Check className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-900">{invite.guestName}</p>
                      <div className="flex items-center gap-3 text-xs text-neutral-400 flex-wrap mt-0.5">
                        <span className="font-mono">{invite.inviteCode}</span>
                        <span>·</span>
                        <span>{invite.groupSize} {invite.groupSize === 1 ? 'person' : 'people'}</span>
                        {invite.plusOnes > 0 && <span>+{invite.plusOnes}</span>}
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/invite/${invite.inviteCode}`);
                            toast.success('Invite link copied!');
                          }}
                          className="text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Copy Link
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex-shrink-0 ml-3">
                    {invite.checkedIn ? (
                      <div className="text-right">
                        <p className="text-xs font-semibold text-emerald-600">✓ Checked In</p>
                        <p className="text-xs text-neutral-400">{new Date(invite.checkedInAt).toLocaleTimeString()}</p>
                        {invite.actualAttendees !== invite.groupSize && (
                          <p className="text-xs text-amber-600">Actually: {invite.actualAttendees}</p>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => handleCheckIn(invite.inviteCode)}
                        disabled={checkingIn === invite.inviteCode}
                        className="btn btn-primary text-xs px-3 py-1.5 gap-1"
                      >
                        {checkingIn === invite.inviteCode
                          ? <span className="spinner w-3 h-3 border border-white/30 border-t-white" />
                          : <><UserCheck className="w-3.5 h-3.5" /> Check In</>
                        }
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* Add Guests Modal */}
      {showAddGuests && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setShowAddGuests(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-xl max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-neutral-900">Add Guests</h3>
              <button onClick={() => setShowAddGuests(false)} className="btn btn-ghost p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-12 gap-2 mb-1.5 text-xs font-medium text-neutral-500 px-1">
              <span className="col-span-5">Guest / Family Name *</span>
              <span className="col-span-4">Email (optional)</span>
              <span className="col-span-2 text-center">Size</span>
              <span className="col-span-1 text-center">+1s</span>
            </div>

            <div className="space-y-2 mb-4">
              {newGuests.map((guest, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Name"
                    className="input text-sm col-span-5"
                    value={guest.guestName}
                    onChange={e => {
                      const u = [...newGuests];
                      u[idx].guestName = e.target.value;
                      setNewGuests(u);
                    }}
                  />
                  <input
                    type="email"
                    placeholder="email@example.com"
                    className="input text-sm col-span-4"
                    value={guest.guestEmail}
                    onChange={e => {
                      const u = [...newGuests];
                      u[idx].guestEmail = e.target.value;
                      setNewGuests(u);
                    }}
                  />
                  <input
                    type="number"
                    min="1"
                    className="input text-sm col-span-2 text-center"
                    value={guest.groupSize}
                    onChange={e => {
                      const u = [...newGuests];
                      u[idx].groupSize = parseInt(e.target.value) || 1;
                      setNewGuests(u);
                    }}
                  />
                  <div className="col-span-1 flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      className="input text-sm text-center w-full"
                      value={guest.plusOnes}
                      onChange={e => {
                        const u = [...newGuests];
                        u[idx].plusOnes = parseInt(e.target.value) || 0;
                        setNewGuests(u);
                      }}
                    />
                    {newGuests.length > 1 && (
                      <button
                        onClick={() => setNewGuests(newGuests.filter((_, i) => i !== idx))}
                        className="text-neutral-300 hover:text-red-400 transition-colors flex-shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setNewGuests([...newGuests, { guestName: '', guestEmail: '', groupSize: 1, plusOnes: 0 }])}
                className="btn btn-secondary text-sm gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Add Row
              </button>
              <button onClick={handleAddGuests} className="btn btn-primary text-sm flex-1">
                Create {newGuests.filter(g => g.guestName.trim()).length || ''} Invite
                {newGuests.filter(g => g.guestName.trim()).length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
