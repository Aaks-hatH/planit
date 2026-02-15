import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Calendar, MapPin, Users, QrCode, Check, X, Clock, Mail } from 'lucide-react';
import toast from 'react-hot-toast';

export default function GuestInvite() {
  const { inviteCode } = useParams();
  const navigate = useNavigate();
  const [invite, setInvite] = useState(null);
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRSVP, setShowRSVP] = useState(false);

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

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
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
                    <p className="text-sm text-neutral-600">{formatDate(event.date)}</p>
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

              {invite.groupSize > 1 && (
                <div className="flex items-start gap-3">
                  <Users className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-neutral-900">Group Size</p>
                    <p className="text-sm text-neutral-600">
                      {invite.groupSize} {invite.groupSize === 1 ? 'person' : 'people'}
                      {invite.plusOnes > 0 && ` (+ ${invite.plusOnes} optional)`}
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
                {new Date(invite.checkedInAt).toLocaleString()}
              </p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-neutral-900 mb-3 text-center">Your Check-in QR Code</h3>
                <div className="bg-white p-6 rounded-xl border-2 border-neutral-200 flex flex-col items-center">
                  <img 
                    src={qrUrl} 
                    alt="QR Code" 
                    className="w-64 h-64 mb-3"
                  />
                  <p className="text-xs text-neutral-500 mb-1">Show this code at the event entrance</p>
                  <p className="text-lg font-mono font-bold text-neutral-900">{invite.code || inviteCode}</p>
                </div>
              </div>

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
