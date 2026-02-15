import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Calendar, MapPin, Users, QrCode, Check, X, Clock, Mail,
  Copy, Share2, CheckCircle, AlertCircle, Info, Shield,
  Ticket, IdCard, Phone, ExternalLink, Download
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDateInTimezone } from '../utils/timezoneUtils';

export default function GuestInvite() {
  const { inviteCode } = useParams();
  const navigate = useNavigate();
  const [invite, setInvite] = useState(null);
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRSVP, setShowRSVP] = useState(false);
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
      setShowRSVP(false);
    } catch (error) {
      toast.error('Failed to update RSVP');
    }
  };

  const formatDate = (dateStr, timezone = 'UTC') => {
    if (!dateStr) return '';
    
    try {
      // Use the timezone-aware formatter
      return formatDateInTimezone(dateStr, timezone, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    } catch (error) {
      // Fallback to basic formatting if timezone utils fail
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
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

  const handleShare = async () => {
    const inviteUrl = `${window.location.origin}/invite/${inviteCode}`;
    const shareData = {
      title: `Invitation to ${event.title}`,
      text: `You're invited to ${event.title}${event.date ? ` on ${formatDate(event.date, event.timezone)}` : ''}`,
      url: inviteUrl
    };

    try {
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData);
        toast.success('Shared successfully!');
      } else {
        // Fallback to copy
        await handleCopyLink();
      }
    } catch (error) {
      if (error.name !== 'AbortError') {
        toast.error('Failed to share');
      }
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

  const getStatusColor = (status) => {
    const colors = {
      'pending': 'bg-neutral-100 text-neutral-600',
      'confirmed': 'bg-emerald-50 text-emerald-700 border-emerald-200',
      'declined': 'bg-red-50 text-red-700 border-red-200',
      'checked-in': 'bg-blue-50 text-blue-700 border-blue-200'
    };
    return colors[status] || colors.pending;
  };

  const getStatusLabel = (status) => {
    const labels = {
      'pending': 'Awaiting Response',
      'confirmed': 'Confirmed',
      'declined': 'Declined',
      'checked-in': 'Checked In'
    };
    return labels[status] || status;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <span className="spinner w-5 h-5 border-2 border-neutral-200 border-t-neutral-500" />
      </div>
    );
  }

  if (!invite || !event) {
    return null;
  }

  const inviteUrl = `${window.location.origin}/invite/${inviteCode}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(inviteUrl)}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-neutral-50 to-neutral-100">
      <header className="bg-white border-b border-neutral-200">
        <div className="max-w-2xl mx-auto px-6 h-16 flex items-center">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-neutral-900 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-semibold text-neutral-900">PlanIt</span>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <div className="card p-8 mb-6">
          <div className="text-center mb-6">
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border mb-4 ${getStatusColor(invite.status)}`}>
              {invite.status === 'checked-in' && <Check className="w-3.5 h-3.5" />}
              {getStatusLabel(invite.status)}
            </div>
            <h1 className="text-3xl font-bold text-neutral-900 mb-2">{invite.guestName}</h1>
            <p className="text-neutral-500">You're invited to</p>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200 mb-6">
            <h2 className="text-2xl font-bold text-neutral-900 mb-4">{event.title}</h2>
            
            <div className="space-y-3">
              {event.date && (
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-neutral-900">Date & Time</p>
                    <p className="text-sm text-neutral-600">
                      {formatDate(event.date, event.timezone)}
                    </p>
                    {event.timezone && event.timezone !== 'UTC' && (
                      <p className="text-xs text-neutral-400 mt-0.5">
                        {event.timezone}
                      </p>
                    )}
                  </div>
                </div>
              )}
              
              {event.location && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-neutral-900">Location</p>
                    <p className="text-sm text-neutral-600">{event.location}</p>
                  </div>
                </div>
              )}

              {(invite.adults !== undefined || invite.children !== undefined || invite.groupSize > 1) && (
                <div className="flex items-start gap-3">
                  <Users className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-neutral-900">Group Size</p>
                    <p className="text-sm text-neutral-600">
                      {invite.adults !== undefined && invite.children !== undefined ? (
                        <>
                          {invite.adults} adult{invite.adults !== 1 ? 's' : ''}
                          {invite.children > 0 && <> + {invite.children} child{invite.children !== 1 ? 'ren' : ''}</>}
                          {' '}({invite.adults + invite.children} total)
                        </>
                      ) : (
                        <>
                          {invite.groupSize} {invite.groupSize === 1 ? 'person' : 'people'}
                        </>
                      )}
                      {invite.plusOnes > 0 && <> (+ {invite.plusOnes} optional plus-one{invite.plusOnes !== 1 ? 's' : ''})</>}
                    </p>
                  </div>
                </div>
              )}

              {event.organizerName && (
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-neutral-900">Organized by</p>
                    <p className="text-sm text-neutral-600">{event.organizerName}</p>
                  </div>
                </div>
              )}
            </div>

            {event.description && (
              <div className="mt-4 pt-4 border-t border-blue-200">
                <p className="text-sm text-neutral-700 leading-relaxed">{event.description}</p>
              </div>
            )}
          </div>

          {/* Invite Link Share Section */}
          <div className="mb-6 p-5 bg-white border-2 border-neutral-200 rounded-xl">
            <div className="flex items-center gap-2 mb-3">
              <Ticket className="w-5 h-5 text-blue-600" />
              <h3 className="text-sm font-bold text-neutral-900">Your Invitation Link</h3>
            </div>
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3 mb-3">
              <p className="text-xs text-neutral-500 mb-1">Share this link with others:</p>
              <p className="text-sm font-mono text-neutral-700 break-all">
                {`${window.location.origin}/invite/${inviteCode}`}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleCopyLink}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-neutral-900 text-white rounded-lg hover:bg-black transition-all text-sm font-medium"
              >
                {copied ? (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy Link
                  </>
                )}
              </button>
              <button
                onClick={handleShare}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all text-sm font-medium"
              >
                <Share2 className="w-4 h-4" />
                Share
              </button>
            </div>
          </div>

          {/* Enhanced Guest Information - Airline Style */}
          <div className="mb-6 bg-gradient-to-br from-neutral-900 to-neutral-800 rounded-xl p-6 text-white shadow-lg">
            <div className="flex items-center gap-2 mb-4">
              <IdCard className="w-5 h-5" />
              <h3 className="text-sm font-bold uppercase tracking-wide">Guest Credentials</h3>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs text-neutral-400 mb-1">CONFIRMATION CODE</p>
                <p className="text-lg font-mono font-bold tracking-widest">{invite.code || inviteCode}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-400 mb-1">STATUS</p>
                <p className={`text-sm font-bold uppercase ${
                  invite.status === 'confirmed' ? 'text-emerald-400' :
                  invite.status === 'checked-in' ? 'text-blue-400' :
                  invite.status === 'declined' ? 'text-red-400' : 'text-amber-400'
                }`}>
                  {getStatusLabel(invite.status)}
                </p>
              </div>
            </div>

            <div className="border-t border-neutral-700 pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-400">Guest Name:</span>
                <span className="font-semibold">{invite.guestName}</span>
              </div>
              
              {(invite.adults !== undefined || invite.children !== undefined || invite.groupSize > 1) && (
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Party Size:</span>
                  <span className="font-semibold">
                    {invite.adults !== undefined && invite.children !== undefined ? (
                      `${invite.adults + invite.children} (${invite.adults}A / ${invite.children}C)`
                    ) : (
                      invite.groupSize
                    )}
                  </span>
                </div>
              )}

              {invite.plusOnes > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Plus Ones Allowed:</span>
                  <span className="font-semibold text-emerald-400">+{invite.plusOnes}</span>
                </div>
              )}

              {invite.email && (
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-400">Email:</span>
                  <span className="font-semibold text-xs">{invite.email}</span>
                </div>
              )}

              <div className="flex justify-between text-sm">
                <span className="text-neutral-400">Invitation Type:</span>
                <span className="font-semibold">{invite.checkedIn ? 'ADMITTED' : 'STANDARD ENTRY'}</span>
              </div>
            </div>
          </div>

          {invite.notes && (
            <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs font-medium text-amber-900 mb-1">Special Notes</p>
              <p className="text-sm text-amber-800">{invite.notes}</p>
            </div>
          )}

          {invite.checkedIn ? (
            <div className="text-center p-6 bg-emerald-50 border border-emerald-200 rounded-xl">
              <div className="w-12 h-12 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-3">
                <Check className="w-6 h-6 text-emerald-600" />
              </div>
              <p className="text-sm font-semibold text-emerald-900 mb-1">Already Checked In</p>
              <p className="text-xs text-emerald-700">
                {event.timezone 
                  ? formatDateInTimezone(invite.checkedInAt, event.timezone, {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit'
                    })
                  : new Date(invite.checkedInAt).toLocaleString()
                }
              </p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-blue-600" />
                    Your Check-in QR Code
                  </h3>
                  <button
                    onClick={handleDownloadQR}
                    className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </button>
                </div>
                
                <div 
                  onClick={() => setShowQRFullscreen(true)}
                  className="bg-white p-6 rounded-xl border-2 border-neutral-200 flex flex-col items-center cursor-pointer hover:border-blue-300 transition-all group"
                >
                  <img 
                    src={qrUrl} 
                    alt="QR Code" 
                    className="w-64 h-64 mb-3 group-hover:scale-105 transition-transform"
                  />
                  <div className="text-center">
                    <p className="text-xs text-neutral-500 mb-1 flex items-center justify-center gap-1.5">
                      <QrCode className="w-3.5 h-3.5" />
                      Show this code at the event entrance
                    </p>
                    <p className="text-xl font-mono font-bold text-neutral-900 tracking-widest">{invite.code || inviteCode}</p>
                    <p className="text-xs text-blue-600 mt-2 flex items-center justify-center gap-1">
                      <ExternalLink className="w-3 h-3" />
                      Tap to view fullscreen
                    </p>
                  </div>
                </div>

                {/* Security Notice */}
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-800">
                    <p className="font-semibold mb-1">Security Notice</p>
                    <p>This QR code is unique to your invitation. Do not share it publicly or with unauthorized individuals. Present it only at the official check-in desk.</p>
                  </div>
                </div>
              </div>

              {/* QR Fullscreen Modal */}
              {showQRFullscreen && (
                <div 
                  className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-6"
                  onClick={() => setShowQRFullscreen(false)}
                >
                  <div className="max-w-2xl w-full">
                    <div className="text-center mb-6">
                      <h2 className="text-2xl font-bold text-white mb-2">{event.title}</h2>
                      <p className="text-neutral-400">{invite.guestName}</p>
                    </div>
                    <div className="bg-white p-8 rounded-2xl">
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(inviteUrl)}`}
                        alt="QR Code Fullscreen" 
                        className="w-full max-w-md mx-auto"
                      />
                      <p className="text-3xl font-mono font-bold text-neutral-900 text-center mt-6 tracking-widest">
                        {invite.code || inviteCode}
                      </p>
                    </div>
                    <p className="text-center text-neutral-400 text-sm mt-6">Tap anywhere to close</p>
                  </div>
                </div>
              )}

              {invite.status === 'pending' && (
                <div className="flex gap-3">
                  <button
                    onClick={() => handleRSVP('confirmed')}
                    className="flex-1 btn btn-primary py-3"
                  >
                    <Check className="w-4 h-4" />
                    Accept Invitation
                  </button>
                  <button
                    onClick={() => handleRSVP('declined')}
                    className="flex-1 btn btn-secondary py-3 text-red-600 hover:bg-red-50"
                  >
                    <X className="w-4 h-4" />
                    Decline
                  </button>
                </div>
              )}

              {invite.status === 'confirmed' && (
                <div className="text-center">
                  <p className="text-sm text-neutral-600 mb-3">
                    You've confirmed your attendance. See you there!
                  </p>
                  <button
                    onClick={() => handleRSVP('declined')}
                    className="text-xs text-neutral-400 hover:text-neutral-600"
                  >
                    Can't make it? Decline invitation
                  </button>
                </div>
              )}

              {invite.status === 'declined' && (
                <div className="text-center">
                  <p className="text-sm text-neutral-600 mb-3">
                    You've declined this invitation.
                  </p>
                  <button
                    onClick={() => handleRSVP('confirmed')}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Changed your mind? Accept invitation
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <div className="text-center text-xs text-neutral-400">
          <p>Powered by PlanIt</p>
        </div>
      </main>
    </div>
  );
}
