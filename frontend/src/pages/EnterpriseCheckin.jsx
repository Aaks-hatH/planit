import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QrCode, UserCheck, Users, Check, Plus, X, ArrowLeft, Camera, CameraOff, AlertCircle, RefreshCw } from 'lucide-react';
import { eventAPI } from '../services/api';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// ── Real QR Camera Scanner Component ──────────────────────────────────────
function QRCameraScanner({ onScan, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameRef = useRef(null);
  const jsQRRef = useRef(null);

  const [cameraError, setCameraError] = useState(null);
  const [scannerReady, setScannerReady] = useState(false);
  const [lastCode, setLastCode] = useState('');
  const cooldownRef = useRef(false);

  // Load jsQR library dynamically
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
    script.onload = () => { jsQRRef.current = window.jsQR; };
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []);

  const stopCamera = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, []);

  const scanFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      animFrameRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    // Try BarcodeDetector first (native, faster)
    if (window.BarcodeDetector) {
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      detector.detect(canvas).then(barcodes => {
        if (barcodes.length > 0 && !cooldownRef.current) {
          const raw = barcodes[0].rawValue;
          handleDetected(raw);
        }
      }).catch(() => {});
    } else if (jsQRRef.current) {
      // Fallback: jsQR
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQRRef.current(imageData.data, imageData.width, imageData.height);
      if (code && !cooldownRef.current) {
        handleDetected(code.data);
      }
    }

    animFrameRef.current = requestAnimationFrame(scanFrame);
  }, []);

  const handleDetected = (raw) => {
    // Extract just the invite code — either from a full URL or raw code
    let code = raw.trim().toUpperCase();
    // If scanned value is a URL like https://...../invite/XXXXXXXX
    const match = raw.match(/\/invite\/([A-Z0-9]+)$/i);
    if (match) code = match[1].toUpperCase();

    if (code === lastCode) return;
    setLastCode(code);
    cooldownRef.current = true;
    setTimeout(() => { cooldownRef.current = false; }, 3000);

    onScan(code);
  };

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setScannerReady(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
          setScannerReady(true);
          animFrameRef.current = requestAnimationFrame(scanFrame);
        };
      }
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setCameraError('Camera access denied. Please allow camera permissions and try again.');
      } else if (err.name === 'NotFoundError') {
        setCameraError('No camera found on this device.');
      } else {
        setCameraError('Could not access camera: ' + err.message);
      }
    }
  }, [scanFrame]);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 bg-black/80">
        <button onClick={() => { stopCamera(); onClose(); }} className="text-white flex items-center gap-2 text-sm">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <span className="text-white text-sm font-medium">Scan Guest QR Code</span>
        <div className="w-16" />
      </div>

      <div className="flex-1 relative overflow-hidden">
        {cameraError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900 px-8 text-center">
            <CameraOff className="w-12 h-12 text-neutral-400 mb-4" />
            <p className="text-white text-sm mb-2">Camera Unavailable</p>
            <p className="text-neutral-400 text-xs mb-6">{cameraError}</p>
            <button onClick={startCamera} className="btn btn-primary text-sm gap-2 mb-3">
              <RefreshCw className="w-4 h-4" /> Try Again
            </button>
            <button onClick={() => { stopCamera(); onClose(); }} className="text-neutral-400 text-xs">
              Use manual code entry instead
            </button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              muted
              playsInline
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Scanning overlay */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative">
                <div className="w-64 h-64 border-2 border-white/40 rounded-2xl" />
                {/* Corner markers */}
                {['top-0 left-0', 'top-0 right-0', 'bottom-0 left-0', 'bottom-0 right-0'].map((pos, i) => (
                  <div key={i} className={`absolute ${pos} w-8 h-8 border-white border-4 ${
                    pos.includes('top-0 left-0') ? 'rounded-tl-lg border-r-0 border-b-0' :
                    pos.includes('top-0 right-0') ? 'rounded-tr-lg border-l-0 border-b-0' :
                    pos.includes('bottom-0 left-0') ? 'rounded-bl-lg border-r-0 border-t-0' :
                    'rounded-br-lg border-l-0 border-t-0'
                  }`} />
                ))}
                {/* Scan line animation */}
                {scannerReady && (
                  <div className="absolute inset-x-2 top-2 h-0.5 bg-green-400 animate-bounce" style={{ animationDuration: '1.5s' }} />
                )}
              </div>
            </div>

            <div className="absolute bottom-8 left-0 right-0 text-center">
              <p className="text-white text-sm">
                {scannerReady ? 'Point camera at guest QR code' : 'Starting camera…'}
              </p>
              {lastCode && (
                <p className="text-green-400 text-xs mt-1 font-mono">✓ Scanned: {lastCode}</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main EnterpriseCheckin ──────────────────────────────────────────────────
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
  const [newGuests, setNewGuests] = useState([{ guestName: '', guestEmail: '', groupSize: 1, plusOnes: 0 }]);
  const [checkingIn, setCheckingIn] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => { loadData(); }, [eventId]);

  const loadData = async () => {
    try {
      const token = localStorage.getItem('eventToken');
      const headers = { 'Authorization': `Bearer ${token}`, 'x-event-token': token };
      const [eventRes, invitesRes, statsRes] = await Promise.all([
        eventAPI.getById(eventId),
        fetch(`${API_URL}/events/${eventId}/invites`, { headers }).then(r => r.json()),
        fetch(`${API_URL}/events/${eventId}/checkin-stats`, { headers }).then(r => r.json())
      ]);
      setEvent(eventRes.data.event);
      setInvites(invitesRes.invites || []);
      setStats(statsRes.stats);
    } catch (error) {
      toast.error('Failed to load check-in data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddGuests = async () => {
    const validGuests = newGuests.filter(g => g.guestName.trim());
    if (!validGuests.length) { toast.error('Please enter at least one guest name'); return; }
    try {
      const token = localStorage.getItem('eventToken');
      await fetch(`${API_URL}/events/${eventId}/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'x-event-token': token },
        body: JSON.stringify({ guests: validGuests })
      });
      toast.success(`${validGuests.length} invite${validGuests.length > 1 ? 's' : ''} created`);
      setShowAddGuests(false);
      setNewGuests([{ guestName: '', guestEmail: '', groupSize: 1, plusOnes: 0 }]);
      loadData();
    } catch {
      toast.error('Failed to create invites');
    }
  };

  const handleCheckIn = async (inviteCode) => {
    setCheckingIn(inviteCode);
    try {
      const token = localStorage.getItem('eventToken');
      const res = await fetch(`${API_URL}/events/${eventId}/checkin/${inviteCode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'x-event-token': token }
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === 'Already checked in') {
          toast.error(`Already checked in at ${new Date(data.checkedInAt).toLocaleTimeString()}`);
        } else {
          toast.error(data.error || 'Check-in failed');
        }
        return;
      }
      toast.success(`✓ ${data.invite?.guestName || 'Guest'} checked in!`);
      loadData();
      setManualCode('');
      setScanMode(false);
    } catch {
      toast.error('Check-in failed. Please try again.');
    } finally {
      setCheckingIn('');
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (manualCode.trim()) handleCheckIn(manualCode.trim().toUpperCase());
  };

  const filteredInvites = invites.filter(inv =>
    !searchQuery || inv.guestName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    inv.inviteCode?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <span className="spinner w-5 h-5 border-2 border-neutral-200 border-t-neutral-500" />
    </div>
  );

  return (
    <div className="min-h-screen bg-neutral-50">
      {scanMode && (
        <QRCameraScanner
          onScan={(code) => {
            toast.success(`Scanned: ${code}`, { duration: 1500 });
            handleCheckIn(code);
          }}
          onClose={() => setScanMode(false)}
        />
      )}

      <header className="bg-white border-b border-neutral-100">
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
          <button
            onClick={() => setScanMode(true)}
            className="btn btn-primary px-4 py-2 text-sm gap-2"
          >
            <Camera className="w-4 h-4" />
            Scan QR
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6">
        {/* Stats */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          <div className="card p-4">
            <div className="text-2xl font-bold text-neutral-900">{stats?.total || 0}</div>
            <div className="text-xs text-neutral-500">Total Groups</div>
          </div>
          <div className="card p-4">
            <div className="text-2xl font-bold text-emerald-600">{stats?.checkedIn || 0}</div>
            <div className="text-xs text-neutral-500">Checked In</div>
          </div>
          <div className="card p-4">
            <div className="text-2xl font-bold text-blue-600">{stats?.totalActualAttendees || 0}</div>
            <div className="text-xs text-neutral-500">Actual Attendees</div>
          </div>
          <div className="card p-4">
            <div className="text-2xl font-bold text-amber-600">{stats?.confirmed || 0}</div>
            <div className="text-xs text-neutral-500">Confirmed</div>
          </div>
          <div className="card p-4">
            <div className="text-2xl font-bold text-neutral-400">{stats?.pending || 0}</div>
            <div className="text-xs text-neutral-500">Pending</div>
          </div>
        </div>

        {/* Manual code entry */}
        <div className="card p-4 mb-6">
          <p className="text-xs font-medium text-neutral-500 mb-2">Manual Code Entry</p>
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={e => setManualCode(e.target.value.toUpperCase())}
              placeholder="Type invite code (e.g. AB1C2D3E)"
              className="input flex-1 font-mono text-sm tracking-wider"
            />
            <button type="submit" disabled={!manualCode.trim() || !!checkingIn} className="btn btn-primary px-4 text-sm">
              Check In
            </button>
          </form>
        </div>

        {/* Guest List */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-neutral-900">Guest List</h2>
            <button onClick={() => setShowAddGuests(true)} className="btn btn-secondary text-sm gap-2">
              <Plus className="w-4 h-4" />
              Add Guests
            </button>
          </div>

          {/* Search */}
          {invites.length > 5 && (
            <input
              type="text"
              placeholder="Search guests..."
              className="input mb-4 text-sm"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          )}

          <div className="space-y-2">
            {filteredInvites.length === 0 && (
              <div className="text-center py-8 text-neutral-400 text-sm">
                {invites.length === 0 ? 'No guests added yet. Click "Add Guests" to get started.' : 'No guests match your search.'}
              </div>
            )}
            {filteredInvites.map(invite => (
              <div key={invite._id} className={`flex items-center justify-between p-4 rounded-lg border ${
                invite.checkedIn ? 'bg-emerald-50 border-emerald-200' : 'bg-neutral-50 border-neutral-200'
              }`}>
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    invite.checkedIn ? 'bg-emerald-100 text-emerald-600' : 'bg-neutral-100 text-neutral-400'
                  }`}>
                    {invite.checkedIn ? <Check className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-neutral-900">{invite.guestName}</p>
                    <div className="flex items-center gap-3 text-xs text-neutral-500 flex-wrap">
                      <button
                        onClick={() => {
                          const link = `${window.location.origin}/invite/${invite.inviteCode}`;
                          navigator.clipboard.writeText(link);
                          toast.success('Invite link copied!');
                        }}
                        className="text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Copy Link
                      </button>
                      <span className="font-mono text-neutral-400">{invite.inviteCode}</span>
                      <span>Group: {invite.groupSize} {invite.groupSize === 1 ? 'person' : 'people'}</span>
                      {invite.checkedIn && invite.actualAttendees !== invite.groupSize && (
                        <span className="text-amber-600 font-medium">Actually: {invite.actualAttendees}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                  {invite.checkedIn ? (
                    <span className="text-xs text-emerald-600 font-medium whitespace-nowrap">
                      ✓ {new Date(invite.checkedInAt).toLocaleTimeString()}
                    </span>
                  ) : (
                    <button
                      onClick={() => handleCheckIn(invite.inviteCode)}
                      disabled={checkingIn === invite.inviteCode}
                      className="btn btn-primary text-xs px-3 py-1.5"
                    >
                      {checkingIn === invite.inviteCode ? (
                        <span className="spinner w-3 h-3 border border-white/30 border-t-white" />
                      ) : (
                        <><UserCheck className="w-3.5 h-3.5" /> Check In</>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Add Guests Modal */}
      {showAddGuests && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowAddGuests(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-neutral-900">Add Guests</h3>
              <button onClick={() => setShowAddGuests(false)} className="btn btn-ghost p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-12 gap-2 mb-2 text-xs text-neutral-500 font-medium px-1">
              <span className="col-span-4">Name *</span>
              <span className="col-span-4">Email</span>
              <span className="col-span-2">Group size</span>
              <span className="col-span-2">+1s</span>
            </div>

            <div className="space-y-2 mb-4">
              {newGuests.map((guest, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Guest / Family name"
                    className="input text-sm col-span-4"
                    value={guest.guestName}
                    onChange={(e) => {
                      const updated = [...newGuests];
                      updated[idx].guestName = e.target.value;
                      setNewGuests(updated);
                    }}
                  />
                  <input
                    type="email"
                    placeholder="Email (optional)"
                    className="input text-sm col-span-4"
                    value={guest.guestEmail}
                    onChange={(e) => {
                      const updated = [...newGuests];
                      updated[idx].guestEmail = e.target.value;
                      setNewGuests(updated);
                    }}
                  />
                  <input
                    type="number"
                    className="input text-sm col-span-2"
                    min="1"
                    value={guest.groupSize}
                    onChange={(e) => {
                      const updated = [...newGuests];
                      updated[idx].groupSize = parseInt(e.target.value) || 1;
                      setNewGuests(updated);
                    }}
                  />
                  <div className="col-span-2 flex gap-1">
                    <input
                      type="number"
                      className="input text-sm flex-1"
                      min="0"
                      value={guest.plusOnes}
                      onChange={(e) => {
                        const updated = [...newGuests];
                        updated[idx].plusOnes = parseInt(e.target.value) || 0;
                        setNewGuests(updated);
                      }}
                    />
                    {newGuests.length > 1 && (
                      <button
                        onClick={() => setNewGuests(newGuests.filter((_, i) => i !== idx))}
                        className="btn btn-ghost p-1 text-neutral-400 hover:text-red-500"
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
                className="btn btn-secondary text-sm gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Row
              </button>
              <button onClick={handleAddGuests} className="btn btn-primary text-sm flex-1">
                Create {newGuests.filter(g => g.guestName.trim()).length || ''} Invite{newGuests.filter(g => g.guestName.trim()).length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
