import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Calendar, MapPin, Users, QrCode, Check, X, Clock, Mail,
  Copy, Share2, CheckCircle, AlertCircle, Info, Shield,
  Ticket, Phone, ExternalLink, Download, User, Sparkles,
  Navigation, CalendarPlus, MessageCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDateInTimezone } from '../utils/timezoneUtils';
import { motion } from 'framer-motion';
import StarBackground from '../components/StarBackground';

export default function GuestInvite() {
  const { inviteCode } = useParams();
  const navigate = useNavigate();
  const [invite, setInvite] = useState(null);
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showQRFullscreen, setShowQRFullscreen] = useState(false);

  useEffect(() => {
    loadInvite();
  }, [inviteCode]);

  const loadInvite = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/events/invite/${inviteCode}`);
      const data = await response.json();
      if (!response.ok) {
        toast.error(data.error || 'Invite not found');
        navigate('/');
        return;
      }
      setInvite(data.invite);
      setEvent(data.event);
    } catch (error) {
      toast.error('Failed to load invite');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const handleRSVP = async (status) => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/events/${event.id}/invites/${inviteCode}/rsvp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      toast.success(`RSVP updated: ${status}`);
      loadInvite();
    } catch (error) {
      toast.error('Failed to update RSVP');
    }
  };

  const handleCopyLink = async () => {
    const inviteUrl = `${window.location.origin}/invite/${inviteCode}`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast.success('Invite link copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy link');
    }
  };

  const handleDownloadQR = () => {
    const inviteUrl = `${window.location.origin}/invite/${inviteCode}`;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(inviteUrl)}`;
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
    const formatDateForCal = (date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${formatDateForCal(startDate)}/${formatDateForCal(endDate)}&details=${encodeURIComponent(`You're invited! Code: ${inviteCode}`)}&location=${encodeURIComponent(event.location || '')}`;
    window.open(calendarUrl, '_blank');
  };

  const getDirections = () => {
    if (!event.location) return;
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`;
    window.open(mapsUrl, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-neutral-700 border-t-neutral-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (!invite || !event) return null;

  const inviteUrl = `${window.location.origin}/invite/${inviteCode}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(inviteUrl)}`;

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: '#040407' }}>
      {/* StarBackground: the dark theme here is intentional. See /about for a full explanation.
          Short version: if you open your phone at a show or presentation in the dark,
          a white screen blinds everyone nearby. This page stays dark so you never disturb the room. */}
      <StarBackground fixed={false} starCount={160} />

      <div className="relative z-10">
        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="border-b border-neutral-800/40"
          style={{ backdropFilter: 'blur(18px)', background: 'rgba(4,4,7,0.55)' }}
        >
          <div className="max-w-4xl mx-auto px-6 h-20 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-neutral-800 border border-neutral-700 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-neutral-300" />
              </div>
              <div>
                <span className="text-xl font-black text-neutral-100">PlanIt</span>
                <p className="text-xs text-neutral-500">Event Management</p>
              </div>
            </div>
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-2 px-4 py-2 bg-neutral-800/60 hover:bg-neutral-700/60 border border-neutral-700 rounded-xl text-sm font-medium text-neutral-300 transition-all"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Share'}
            </button>
          </div>
        </motion.header>

        <motion.main
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: 'easeOut' }}
          className="max-w-4xl mx-auto px-6 py-12"
        >
          <div className="relative">
            {/* Main Ticket */}
            <div className="bg-gradient-to-br from-neutral-900 to-neutral-950 rounded-3xl border border-neutral-800 shadow-2xl overflow-hidden">

              {/* Ticket Header */}
              <div className="relative px-8 pt-8 pb-6 border-b border-neutral-800/50">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-neutral-800/20 to-transparent rounded-full blur-3xl" />
                <div className="relative">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-3">
                        <Ticket className="w-5 h-5 text-neutral-400" />
                        <span className="text-xs font-semibold text-neutral-500 uppercase tracking-widest">Exclusive Invitation</span>
                      </div>
                      <h1 className="text-4xl font-black text-neutral-100 mb-2">{invite.guestName}</h1>
                      <p className="text-neutral-400 text-lg">You're invited to attend</p>
                    </div>
                    {invite.checkedIn && (
                      <div className="flex-shrink-0 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-400" />
                          <span className="text-sm font-bold text-emerald-400">ADMITTED</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Event Details */}
              <div className="px-8 py-8">
                <h2 className="text-3xl font-black text-neutral-100 mb-8">{event.title}</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  {event.date && (
                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-neutral-800/50 flex items-center justify-center">
                        <Calendar className="w-6 h-6 text-neutral-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Date and Time</p>
                        <p className="text-neutral-200 font-medium">
                          {formatDateInTimezone(event.date, event.timezone || 'UTC', {
                            weekday: 'long', year: 'numeric', month: 'long',
                            day: 'numeric', hour: 'numeric', minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  )}

                  {event.location && (
                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-neutral-800/50 flex items-center justify-center">
                        <MapPin className="w-6 h-6 text-neutral-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Location</p>
                        <p className="text-neutral-200 font-medium">{event.location}</p>
                        <button
                          onClick={getDirections}
                          className="text-xs text-blue-400 hover:text-blue-300 font-medium mt-1 flex items-center gap-1"
                        >
                          <Navigation className="w-3 h-3" />
                          Get Directions
                        </button>
                      </div>
                    </div>
                  )}

                  {((invite.adults !== undefined && invite.adults > 0) || (invite.children !== undefined && invite.children > 0)) && (
                    <div className="flex gap-4">
                      <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-neutral-800/50 flex items-center justify-center">
                        <Users className="w-6 h-6 text-neutral-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Party Size</p>
                        <div className="flex items-center gap-4">
                          {invite.adults > 0 && (
                            <span className="text-neutral-200 font-medium">
                              {invite.adults} Adult{invite.adults !== 1 ? 's' : ''}
                            </span>
                          )}
                          {invite.children > 0 && (
                            <span className="text-neutral-200 font-medium">
                              {invite.children} Child{invite.children !== 1 ? 'ren' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-neutral-800/50 flex items-center justify-center">
                      <Shield className="w-6 h-6 text-neutral-400" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Invitation Code</p>
                      <p className="text-2xl font-mono font-black text-neutral-100 tracking-widest">{inviteCode}</p>
                    </div>
                  </div>
                </div>

                {event.description && (
                  <div className="mb-8 p-4 bg-neutral-800/30 rounded-xl border border-neutral-800">
                    <p className="text-neutral-300 leading-relaxed">{event.description}</p>
                  </div>
                )}

                {invite.notes && (
                  <div className="mb-8 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                    <div className="flex items-start gap-3">
                      <Info className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-amber-400 uppercase tracking-wider mb-1">Special Notes</p>
                        <p className="text-amber-200/90 text-sm leading-relaxed">{invite.notes}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* QR Code */}
                {!invite.checkedIn && (
                  <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-neutral-100 flex items-center gap-2">
                        <QrCode className="w-5 h-5" />
                        Your Entry Pass
                      </h3>
                      <button
                        onClick={handleDownloadQR}
                        className="text-sm text-neutral-400 hover:text-neutral-200 font-medium flex items-center gap-2 transition-colors"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </button>
                    </div>

                    <div
                      onClick={() => setShowQRFullscreen(true)}
                      className="group relative bg-white p-8 rounded-2xl cursor-pointer hover:shadow-2xl hover:shadow-neutral-900/50 transition-all"
                    >
                      <div className="flex flex-col items-center">
                        <img
                          src={qrUrl}
                          alt="Entry QR Code"
                          className="w-72 h-72 group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="mt-6 text-center">
                          <p className="text-sm text-neutral-600 mb-2">Present this code at the entrance</p>
                          <p className="text-xs text-blue-600 font-medium flex items-center justify-center gap-1.5 group-hover:text-blue-700">
                            <ExternalLink className="w-3.5 h-3.5" />
                            Tap for fullscreen view
                          </p>
                        </div>
                      </div>
                      <div className="absolute left-0 right-0 -top-2 h-4 bg-repeat-x opacity-30"
                        style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg width='20' height='8' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='4' cy='4' r='3' fill='%23000'/%3E%3C/svg%3E')" }} />
                    </div>

                    <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-200/90 leading-relaxed">
                        <strong className="font-semibold">Keep this private:</strong> This QR code is unique to your invitation. Only show it at the official check-in desk.
                      </p>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {event.date && (
                    <button
                      onClick={addToCalendar}
                      className="flex items-center justify-center gap-2 px-6 py-4 bg-neutral-800/50 hover:bg-neutral-700/50 border border-neutral-700 rounded-xl font-semibold text-neutral-200 transition-all"
                    >
                      <CalendarPlus className="w-5 h-5" />
                      Add to Calendar
                    </button>
                  )}
                  <button
                    onClick={handleCopyLink}
                    className="flex items-center justify-center gap-2 px-6 py-4 bg-neutral-800/50 hover:bg-neutral-700/50 border border-neutral-700 rounded-xl font-semibold text-neutral-200 transition-all"
                  >
                    {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Share2 className="w-5 h-5" />}
                    {copied ? 'Link Copied!' : 'Share Invite'}
                  </button>
                </div>
              </div>

              {/* Ticket Footer */}
              <div className="relative h-8 bg-neutral-950 border-t border-neutral-800/50">
                <div className="absolute left-0 right-0 -top-2 h-4 bg-repeat-x opacity-20"
                  style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg width='20' height='8' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='4' cy='4' r='3' fill='%23fff'/%3E%3C/svg%3E')" }} />
              </div>
            </div>

            {/* Bottom Strip */}
            <div className="mt-6 px-8 py-6 bg-neutral-900/50 backdrop-blur-sm rounded-2xl border border-neutral-800/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-neutral-500 mb-1">Powered by</p>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-neutral-400" />
                    <span className="text-lg font-black text-neutral-100">PlanIt</span>
                  </div>
                  <p className="text-xs text-neutral-500 mt-1">Professional Event Management</p>
                </div>
                <a
                  href="/"
                  className="px-6 py-3 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-xl text-sm font-semibold text-neutral-200 transition-all flex items-center gap-2"
                >
                  Create Your Event
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </motion.main>
      </div>

      {/* Fullscreen QR Modal */}
      {showQRFullscreen && (
        <div
          className="fixed inset-0 bg-black/98 z-50 flex items-center justify-center p-6 backdrop-blur-sm"
          onClick={() => setShowQRFullscreen(false)}
        >
          <div className="max-w-2xl w-full">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-black text-white mb-2">{event.title}</h2>
              <p className="text-neutral-400 text-lg">{invite.guestName}</p>
            </div>
            <div className="bg-white p-12 rounded-3xl shadow-2xl">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=800x800&data=${encodeURIComponent(inviteUrl)}`}
                alt="QR Code Fullscreen"
                className="w-full max-w-lg mx-auto"
              />
              <p className="text-4xl font-mono font-black text-neutral-900 text-center mt-8 tracking-[0.3em]">
                {inviteCode}
              </p>
            </div>
            <p className="text-center text-neutral-400 text-sm mt-8 flex items-center justify-center gap-2">
              <Info className="w-4 h-4" />
              Tap anywhere to close
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
