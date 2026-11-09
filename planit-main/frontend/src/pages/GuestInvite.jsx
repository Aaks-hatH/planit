import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Calendar, MapPin, Users, QrCode, Check, X, Clock, Mail,
  Copy, Share2, CheckCircle, AlertCircle, Info, Shield,
  Ticket, Phone, ExternalLink, Download, User, Sparkles,
  Navigation, CalendarPlus, MessageCircle, AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDateInTimezone } from '../utils/timezoneUtils';
import { motion } from 'framer-motion';
import StarBackground from '../components/StarBackground';
import EventCountdown from '../components/EventCountdown';
import GuestAvatarStack from '../components/GuestAvatarStack';
import ShareCardModal from '../components/ShareCardModal';
import { useWhiteLabel } from '../context/WhiteLabelContext';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function GuestInvite() {
  const { wl, isWL } = useWhiteLabel();
  const wlFeatures = isWL ? (wl?.features || {}) : {};
  // Feature flags — default to true (show) if not on a WL domain
  const showSocialShare = !isWL || wlFeatures.showSocialShare !== false;
  const showGuestList   = !isWL || wlFeatures.showGuestList   !== false;
  const showWaitlist    = !isWL || wlFeatures.showWaitlist    !== false;
  const { inviteCode } = useParams();
  const navigate = useNavigate();
  const [invite, setInvite] = useState(null);
  const [event, setEvent] = useState(null);
  const [rsvpInfo, setRsvpInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showQRFullscreen, setShowQRFullscreen] = useState(false);
  const [showShareCard, setShowShareCard] = useState(false);
  const [expired, setExpired] = useState(false);
  const [expiredAt, setExpiredAt] = useState(null);

  useEffect(() => { loadInvite(); }, [inviteCode]);

  const loadInvite = async () => {
    try {
      const response = await fetch(`${API}/events/invite/${inviteCode}`);
      const data = await response.json();
      if (response.status === 410 || data.expired) {
        setExpired(true);
        setExpiredAt(data.expiresAt || null);
        setLoading(false);
        return;
      }
      if (!response.ok) {
        toast.error(data.error || 'Invite not found');
        navigate('/');
        return;
      }
      setInvite(data.invite);
      setEvent(data.event);

      // Load RSVP summary separately (public endpoint, no auth needed)
      if (data.event?.id) {
        loadRsvpInfo(data.event.id);
      }
    } catch (error) {
      toast.error('Failed to load invite');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const loadRsvpInfo = async (eventId) => {
    try {
      const res = await fetch(`${API}/events/${eventId}/rsvp-summary`);
      if (res.ok) setRsvpInfo(await res.json());
    } catch { /* non-critical, fail silently */ }
  };

  const handleRSVP = async (status) => {
    if (rsvpInfo?.deadlinePast) {
      toast.error('The RSVP deadline has passed. No changes can be made.');
      return;
    }
    setRsvpLoading(true);
    try {
      const res = await fetch(`${API}/events/${event.id}/invites/${inviteCode}/rsvp`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to update RSVP');
        return;
      }
      const labels = { yes: "You're going — RSVP confirmed", maybe: "RSVP saved as Maybe", no: "RSVP saved — Not attending" };
      toast.success(labels[status] || 'RSVP updated');
      loadInvite(); // refresh to get updated status
    } catch {
      toast.error('Failed to update RSVP');
    } finally {
      setRsvpLoading(false);
    }
  };

  const handleCopyLink = async () => {
    const inviteUrl = `${window.location.origin}/invite/${inviteCode}`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast.success('Invite link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch { toast.error('Failed to copy link'); }
  };

  const handleDownloadQR = () => {
    const inviteUrl = `${window.location.origin}/invite/${inviteCode}`;
    const qrUrl = `${API}/events/invite/${inviteCode}/qr.svg`;
    const link = document.createElement('a');
    link.href = qrUrl;
    link.download = `${event.title}-${invite.guestName}-QR.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('QR Code downloaded!');
  };

  const addToCalendar = () => {
    if (!event.date) return;
    const startDate = new Date(event.date);
    const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
    const fmt = (d) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${fmt(startDate)}/${fmt(endDate)}&details=${encodeURIComponent(`You're invited! Code: ${inviteCode}`)}&location=${encodeURIComponent(event.location || '')}`;
    window.open(url, '_blank');
  };

  const getDirections = () => {
    if (!event.location) return;
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`, '_blank');
  };

  // Format deadline countdown
  const getDeadlineText = () => {
    if (!rsvpInfo?.deadline) return null;
    const deadline = new Date(rsvpInfo.deadline);
    const now = new Date();
    if (now > deadline) return { text: 'RSVP deadline has passed', urgent: true };
    const diffMs = deadline - now;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (diffDays === 0 && diffHours <= 3) return { text: `RSVP closes in ${diffHours}h`, urgent: true };
    if (diffDays === 0) return { text: `RSVP closes today`, urgent: true };
    if (diffDays === 1) return { text: `RSVP closes tomorrow`, urgent: false };
    return { text: `RSVP by ${deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`, urgent: false };
  };

  const deadlineInfo = getDeadlineText();
  const rsvpClosed = rsvpInfo?.deadlinePast;
  // The database stores 'confirmed'/'declined'/'maybe'; the button values are 'yes'/'no'/'maybe'.
  // Normalise so the selected-button highlight works correctly after a reload.
  const statusToDisplay = { confirmed: 'yes', declined: 'no', maybe: 'maybe', yes: 'yes', no: 'no' };
  const currentRsvpStatus = statusToDisplay[invite?.status] || null;

  // Format invite expiry info
  const getExpiryText = () => {
    if (!invite?.expiresAt) return null;
    const exp = new Date(invite.expiresAt);
    const now = new Date();
    if (now > exp) return { text: 'This invite has expired', urgent: true, expired: true };
    const diffMs = exp - now;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins  = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (diffHours === 0) return { text: `Expires in ${diffMins}m`, urgent: true, expired: false };
    if (diffHours < 3)  return { text: `Expires in ${diffHours}h ${diffMins}m`, urgent: true, expired: false };
    return { text: `Expires ${exp.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`, urgent: false, expired: false };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-ink border-t-neutral-400 rounded-full animate-spin" />
      </div>
    );
  }

  // Expired invite — show a dedicated expired screen
  if (expired) {
    return (
      <div className="min-h-screen relative overflow-hidden flex items-center justify-center" style={{ background: '#ffffff' }}>
        <StarBackground />
        <div className="relative z-10 max-w-md w-full mx-auto px-4 text-center">
          <div className="w-20 h-20 rounded-full bg-red-50 border border-red-700 flex items-center justify-center mx-auto mb-6">
            <Clock className="w-10 h-10 text-red-700" />
          </div>
          <h1 className="text-3xl font-black text-ink mb-3">Invite Expired</h1>
          <p className="text-neutral-500 mb-2">This reservation link is no longer valid.</p>
          {expiredAt && (
            <p className="text-sm text-neutral-600 mb-8">
              Expired on {new Date(expiredAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </p>
          )}
          <p className="text-sm text-neutral-500 mb-8">Please contact the restaurant or event organizer to receive a new invite link.</p>
          <a href="/" className="inline-flex items-center gap-2 px-6 py-3 bg-lav hover:bg-lav border-2 border-ink rounded-xl text-sm font-semibold text-ink transition-all shadow-hard-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_#0d0e1c] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition">
            <Sparkles className="w-4 h-4" /> Back to PlanIt
          </a>
        </div>
      </div>
    );
  }

  if (!invite || !event) return null;

  const inviteUrl = `${window.location.origin}/invite/${inviteCode}`;
  const qrUrl = `${API}/events/invite/${inviteCode}/qr.svg`;

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: '#ffffff' }}>
      <StarBackground fixed={false} starCount={160} />

      <div className="relative z-10">
        {/* Header */}
        <motion.header
          
          
          
          className="border-b border-ink"
          style={{  background: '#ffffff' }}
        >
          <div className="max-w-4xl mx-auto px-6 h-20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-lav border-2 border-ink flex items-center justify-center">
                <Calendar className="w-5 h-5 text-neutral-600" />
              </div>
              <div>
                <span className="text-xl font-black text-ink">PlanIt</span>
                <p className="text-xs text-neutral-500">Event Management</p>
              </div>
            </div>
            {showSocialShare && (<button
              onClick={() => setShowShareCard(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-white border-2 border-ink rounded-xl text-sm font-bold text-neutral-600 transition-all shadow-hard-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_#0d0e1c] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition"
            >
              <Share2 className="w-4 h-4" />
              Share
            </button>)}
          </div>
        </motion.header>

        <motion.main
          
          
          
          className="max-w-4xl mx-auto px-6 py-12"
        >
          <div className="relative">
            {/* Main Ticket */}
            <div className="rounded-3xl border-2 border-ink shadow-2xl overflow-hidden bg-lav text-ink">

              {/* Ticket Header */}
              <div className="relative px-8 pt-8 pb-6 border-b border-ink">
                <div className="absolute top-0 right-0 w-64 h-64 rounded-full bg-lav text-ink" />
                <div className="relative">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-3">
                        {event.isTableServiceMode
                          ? <><span className="text-lg">🍽</span><span className="text-xs font-semibold text-amber-700 uppercase tracking-widest">Restaurant Reservation</span></>
                          : <><Ticket className="w-5 h-5 text-neutral-500" /><span className="text-xs font-semibold text-neutral-500 uppercase tracking-widest">Exclusive Invitation</span></>
                        }
                      </div>
                      <h1 className="text-4xl font-black text-ink mb-2">{invite.guestName}</h1>
                      <p className="text-neutral-500 text-lg mb-4">{event.isTableServiceMode ? 'Your reservation is confirmed' : "You're invited to attend"}</p>
                      {event.date && !event.isTableServiceMode && (
                        <EventCountdown date={event.date} accent="#a3a3a3" compact />
                      )}
                    </div>
                    {invite.checkedIn && (
                      <div className="flex-shrink-0 px-4 py-2 bg-emerald-50 border border-emerald-700 rounded-xl">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-700" />
                          <span className="text-sm font-bold text-emerald-700">{event.isTableServiceMode ? 'SEATED' : 'ADMITTED'}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Expiry badge */}
                  {(() => { const ei = getExpiryText(); return ei ? (
                    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border-2 text-xs font-semibold border-ink ${ei.expired ? 'bg-red-50 border-red-700 text-red-700' : ei.urgent ? 'bg-amber-50 border-amber-700 text-amber-700' : 'bg-lav border-ink text-neutral-500'}`}>
                      <Clock className="w-3.5 h-3.5" />{ei.text}
                    </div>
                  ) : null; })()}
                </div>
              </div>

              {/* Event Details */}
              <div className="px-8 py-8">
                <h2 className="text-3xl font-black text-ink mb-8">{event.title}</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  {event.date && (
                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-lav flex items-center justify-center">
                        <Calendar className="w-6 h-6 text-neutral-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Date and Time</p>
                        <p className="text-ink font-medium">
                          {formatDateInTimezone(event.date, event.timezone || 'UTC', {
                            weekday: 'long', year: 'numeric', month: 'long',
                            day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short'
                          })}
                        </p>
                      </div>
                    </div>
                  )}

                  {event.location && (
                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-lav flex items-center justify-center">
                        <MapPin className="w-6 h-6 text-neutral-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">{event.isTableServiceMode ? 'Restaurant Address' : 'Location'}</p>
                        <p className="text-ink font-medium">{event.location}</p>
                        <button onClick={getDirections} className="text-xs text-blue-700 hover:text-blue-700 font-medium mt-1 flex items-center gap-1">
                          <Navigation className="w-3 h-3" /> Get Directions
                        </button>
                      </div>
                    </div>
                  )}

                  {((invite.adults > 0) || (invite.children > 0)) && (
                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-lav flex items-center justify-center">
                        <Users className="w-6 h-6 text-neutral-500" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Party Size</p>
                        <div className="flex items-center gap-4">
                          {invite.adults > 0 && <span className="text-ink font-medium">{invite.adults} Adult{invite.adults !== 1 ? 's' : ''}</span>}
                          {invite.children > 0 && <span className="text-ink font-medium">{invite.children} Child{invite.children !== 1 ? 'ren' : ''}</span>}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-lav flex items-center justify-center">
                      <Shield className="w-6 h-6 text-neutral-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Invitation Code</p>
                      <p className="text-2xl font-mono font-black text-ink tracking-widest">{inviteCode}</p>
                    </div>
                  </div>
                </div>

                {event.description && (
                  <div className="mb-8 p-4 bg-lav rounded-xl border-2 border-ink shadow">
                    <p className="text-neutral-600 leading-relaxed">{event.description}</p>
                  </div>
                )}

                {/* Custom RSVP message from organizer */}
                {rsvpInfo?.message && (
                  <div className="mb-8 p-4 bg-blue-50 border border-blue-700 rounded-xl">
                    <div className="flex items-start gap-3">
                      <MessageCircle className="w-5 h-5 text-blue-700 flex-shrink-0 mt-0.5" />
                      <p className="text-blue-200/90 text-sm leading-relaxed">{rsvpInfo.message}</p>
                    </div>
                  </div>
                )}

                {invite.notes && (
                  <div className="mb-8 p-4 bg-amber-50 border border-amber-700 rounded-xl">
                    <div className="flex items-start gap-3">
                      <Info className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-1">Special Notes</p>
                        <p className="text-amber-200/90 text-sm leading-relaxed">{invite.notes}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── RSVP Section — only for events, not restaurant reservations ── */}
                {!event.isTableServiceMode && (
                <div className="mb-8 p-6 bg-lav rounded-2xl border-2 border-ink shadow-md">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-emerald-700" />
                      RSVP
                    </h3>
                    {/* Deadline badge */}
                    {deadlineInfo && (
                      <span className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border-2 border-ink ${
                        deadlineInfo.urgent
                          ? 'bg-red-50 border-red-700 text-red-700'
                          : 'bg-amber-50 border-amber-700 text-amber-700'
                      }`}>
                        <Clock className="w-3.5 h-3.5" />
                        {deadlineInfo.text}
                      </span>
                    )}
                  </div>

                  {/* RSVP counts (if organizer hasn't hidden them) */}
                  {rsvpInfo?.showCount && rsvpInfo.total > 0 && (
                    <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                      <div className="flex gap-4 text-sm">
                        <span className="text-emerald-700 font-medium">{rsvpInfo.summary.yes} going</span>
                        <span className="text-amber-700 font-medium">{rsvpInfo.summary.maybe} maybe</span>
                        <span className="text-neutral-500 font-medium">{rsvpInfo.summary.no} not going</span>
                      </div>
                      <GuestAvatarStack count={rsvpInfo.summary.yes} label={`${rsvpInfo.summary.yes} going`} />
                    </div>
                  )}

                  {rsvpClosed ? (
                    <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-700 rounded-xl text-red-700 text-sm">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      The RSVP deadline has passed. No changes can be made.
                    </div>
                  ) : (
                    <>
                      <p className="text-sm text-neutral-500 mb-3">
                        {currentRsvpStatus
                          ? `Your current response: ${currentRsvpStatus === 'yes' ? 'Going' : currentRsvpStatus === 'maybe' ? 'Maybe' : 'Not going'} — you can change this anytime before the deadline.`
                          : 'Let the organizer know if you can make it.'
                        }
                      </p>
                      <div className="flex gap-3 flex-wrap">
                        {[
                          ['yes',   'Going',        'bg-emerald-50 text-emerald-700 border-emerald-700 hover:bg-emerald-50'],
                          ['maybe', 'Maybe',        'bg-amber-50 text-amber-700 border-amber-700 hover:bg-amber-50'],
                          ['no',    "Can't make it", 'bg-red-50 text-red-700 border-red-700 hover:bg-red-50'],
                        ].map(([status, label, cls]) => (
                          <button
                            key={status}
                            onClick={() => handleRSVP(status)}
                            disabled={rsvpLoading}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 font-bold text-sm transition-all disabled:opacity-50 border-ink shadow-hard-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_#0d0e1c] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition ${cls} ${
                              currentRsvpStatus === status ? 'ring-2 ring-ink scale-105' : ''
                            }`}
                          >
                            {rsvpLoading && currentRsvpStatus !== status ? null : label}
                            {currentRsvpStatus === status && <Check className="w-3.5 h-3.5" />}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                )}
                {/* ─────────────────────────────────────────────────────────────── */}

                {/* QR Code */}
                {!invite.checkedIn && (
                  <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-ink flex items-center gap-2">
                        <QrCode className="w-5 h-5" />
                        {event.isTableServiceMode ? 'Your Reservation Pass' : 'Your Entry Pass'}
                      </h3>
                      <button onClick={handleDownloadQR} className="text-sm text-neutral-500 hover:text-ink font-medium flex items-center gap-2 transition-colors">
                        <Download className="w-4 h-4" /> Download
                      </button>
                    </div>

                    <div
                      onClick={() => setShowQRFullscreen(true)}
                      className="group relative bg-white p-8 rounded-2xl cursor-pointer hover:shadow-2xl transition-all"
                    >
                      <div className="flex flex-col items-center">
                        <img src={qrUrl} alt="Entry QR Code" className="w-72 h-auto group-hover:scale-105 transition-transform duration-300" />
                        <div className="mt-6 text-center">
                          <p className="text-sm text-neutral-600 mb-2">{event.isTableServiceMode ? 'Show this to your server when you arrive' : 'Present this code at the entrance'}</p>
                          <p className="text-xs text-blue-600 font-medium flex items-center justify-center gap-1.5 group-hover:text-blue-700">
                            <ExternalLink className="w-3.5 h-3.5" /> Tap for fullscreen view
                          </p>
                        </div>
                      </div>
                      <div className="absolute left-0 right-0 -top-2 h-4 bg-repeat-x opacity-30"
                        style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg width=\"20\" height=\"8\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Ccircle cx=\"4\" cy=\"4\" r=\"3\" fill=\"%23000\"/%3E%3C/svg%3E')" }} />
                    </div>

                    <div className="mt-4 p-3 bg-amber-50 border border-amber-700 rounded-xl flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-200/90 leading-relaxed">
                        <strong className="font-semibold">Keep this private:</strong> This QR code is unique to your invitation. Only show it at the official check-in desk.
                      </p>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {event.date && !event.isTableServiceMode && (
                    <button onClick={addToCalendar} className="flex items-center justify-center gap-2 px-6 py-4 bg-lav hover:bg-lav border-2 border-ink rounded-xl font-semibold text-ink transition-all shadow-hard-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_#0d0e1c] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition">
                      <CalendarPlus className="w-5 h-5" /> Add to Calendar
                    </button>
                  )}
{showSocialShare && (
                  <button onClick={() => setShowShareCard(true)} className="flex items-center justify-center gap-2 px-6 py-4 bg-lav hover:bg-lav border-2 border-ink rounded-xl font-semibold text-ink transition-all shadow-hard-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_#0d0e1c] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition">
                    <Share2 className="w-5 h-5" />
                    Share Invite
                  </button>
)}
                </div>
              </div>

              {/* Ticket Footer */}
              <div className="relative h-8 bg-white border-t border-ink">
                <div className="absolute left-0 right-0 -top-2 h-4 bg-repeat-x opacity-20"
                  style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg width=\"20\" height=\"8\" xmlns=\"http://www.w3.org/2000/svg\"%3E%3Ccircle cx=\"4\" cy=\"4\" r=\"3\" fill=\"%23fff\"/%3E%3C/svg%3E')" }} />
              </div>
            </div>

            {/* Bottom Strip */}
            <div className="mt-6 px-8 py-6 bg-lav rounded-2xl border-2 border-ink shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-neutral-500 mb-1">Powered by</p>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-neutral-500" />
                    <span className="text-lg font-black text-ink">PlanIt</span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-1">Professional Event Management</p>
                </div>
                <a href="/" className="px-6 py-3 bg-lav hover:bg-lav border-2 border-ink rounded-xl text-sm font-semibold text-ink transition-all flex items-center gap-2 shadow-hard-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_#0d0e1c] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition">
                  Create Your Event <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </motion.main>
      </div>

      {/* Fullscreen QR Modal */}
      {showQRFullscreen && (
        <div className="fixed inset-0 bg-ink/60 z-50 flex items-center justify-center p-6" onClick={() => setShowQRFullscreen(false)}>
          <div className="max-w-2xl w-full">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-black text-ink mb-2">{event.title}</h2>
              <p className="text-neutral-500 text-lg">{invite.guestName}</p>
            </div>
            <div className="bg-white p-12 rounded-3xl shadow-2xl">
              <img src={`${API}/events/invite/${inviteCode}/qr.svg`} alt="QR Code Fullscreen" className="w-full max-w-lg mx-auto" />
              <p className="text-4xl font-mono font-black text-neutral-900 text-center mt-8 tracking-[0.3em]">{inviteCode}</p>
            </div>
            <p className="text-center text-neutral-500 text-sm mt-8 flex items-center justify-center gap-2">
              <Info className="w-4 h-4" /> Tap anywhere to close
            </p>
          </div>
        </div>
      )}
      <ShareCardModal
        open={showShareCard}
        onClose={() => setShowShareCard(false)}
        eventTitle={event.title}
        dateLabel={event.date ? formatDateInTimezone(event.date, event.timezone || 'UTC', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}
        location={event.location}
        guestName={invite.guestName}
        goingCount={rsvpInfo?.showCount ? rsvpInfo?.summary?.yes : undefined}
        url={inviteUrl}
      />
    </div>
  );
}
