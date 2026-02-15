import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { QrCode, UserCheck, Users, Calendar, MapPin, Download, Plus, X, Check, ArrowLeft } from 'lucide-react';
import { eventAPI } from '../services/api';
import toast from 'react-hot-toast';

export default function EnterpriseCheckin() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [invites, setInvites] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddGuests, setShowAddGuests] = useState(false);
  const [scanMode, setScanMode] = useState(false);
  const [scanInput, setScanInput] = useState('');
  const [newGuests, setNewGuests] = useState([{ guestName: '', guestEmail: '', groupSize: 1, plusOnes: 0 }]);

  useEffect(() => {
    loadData();
  }, [eventId]);

  const loadData = async () => {
    try {
      const [eventRes, invitesRes, statsRes] = await Promise.all([
        eventAPI.getById(eventId),
        fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/events/${eventId}/invites`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('eventToken')}` }
        }).then(r => r.json()),
        fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/events/${eventId}/checkin-stats`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('eventToken')}` }
        }).then(r => r.json())
      ]);
      setEvent(eventRes.data.event);
      setInvites(invitesRes.invites);
      setStats(statsRes.stats);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddGuests = async () => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/events/${eventId}/invites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('eventToken')}`
        },
        body: JSON.stringify({ guests: newGuests.filter(g => g.guestName.trim()) })
      });
      toast.success('Invites created');
      setShowAddGuests(false);
      setNewGuests([{ guestName: '', guestEmail: '', groupSize: 1, plusOnes: 0 }]);
      loadData();
    } catch (error) {
      toast.error('Failed to create invites');
    }
  };

  const handleCheckIn = async (inviteCode) => {
    try {
      await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/events/${eventId}/checkin/${inviteCode}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('eventToken')}`
        }
      });
      toast.success('Guest checked in');
      loadData();
      setScanInput('');
    } catch (error) {
      toast.error(error.message || 'Check-in failed');
    }
  };

  const handleScanSubmit = (e) => {
    e.preventDefault();
    if (scanInput.trim()) {
      handleCheckIn(scanInput.trim().toUpperCase());
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <span className="spinner w-5 h-5 border-2 border-neutral-200 border-t-neutral-500" />
    </div>
  );

  return (
    <div className="min-h-screen bg-neutral-50">
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
          <button onClick={() => setScanMode(!scanMode)} className="btn btn-primary px-4 py-2 text-sm gap-2">
            <QrCode className="w-4 h-4" />
            {scanMode ? 'View List' : 'Scan QR'}
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-6">
        {scanMode ? (
          <div className="card p-8">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto rounded-full bg-blue-50 border-2 border-blue-600 flex items-center justify-center mb-4">
                <QrCode className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-xl font-semibold text-neutral-900 mb-2">Scan Guest QR Code</h2>
              <p className="text-sm text-neutral-500">Enter the code from the guest's QR code</p>
            </div>
            <form onSubmit={handleScanSubmit} className="max-w-md mx-auto">
              <input
                type="text"
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value.toUpperCase())}
                placeholder="Enter invite code"
                className="input text-center text-lg font-mono tracking-wider mb-4"
                autoFocus
              />
              <button type="submit" className="btn btn-primary w-full py-3">
                Check In Guest
              </button>
            </form>
          </div>
        ) : (
          <>
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
                <div className="text-xs text-neutral-500">Total Attendees</div>
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

            <div className="card p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold text-neutral-900">Guest List</h2>
                <button onClick={() => setShowAddGuests(true)} className="btn btn-secondary text-sm gap-2">
                  <Plus className="w-4 h-4" />
                  Add Guests
                </button>
              </div>

              <div className="space-y-2">
                {invites.map(invite => (
                  <div key={invite._id} className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg border border-neutral-200">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        invite.checkedIn ? 'bg-emerald-50 text-emerald-600' : 'bg-neutral-100 text-neutral-400'
                      }`}>
                        {invite.checkedIn ? <Check className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-neutral-900">{invite.guestName}</p>
                        <div className="flex items-center gap-3 text-xs text-neutral-500">
                          <button
                            onClick={() => {
                              const link = `${window.location.origin}/invite/${invite.inviteCode}`;
                              navigator.clipboard.writeText(link);
                              toast.success('Invite link copied');
                            }}
                            className="text-blue-600 hover:text-blue-700 font-medium"
                          >
                            Copy Link
                          </button>
                          <span>Group: {invite.groupSize} {invite.groupSize === 1 ? 'person' : 'people'}</span>
                          {invite.checkedIn && invite.actualAttendees !== invite.groupSize && (
                            <span className="text-amber-600 font-medium">
                              Actually: {invite.actualAttendees}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {invite.checkedIn ? (
                        <span className="text-xs text-emerald-600 font-medium">
                          Checked in {new Date(invite.checkedInAt).toLocaleTimeString()}
                        </span>
                      ) : (
                        <button 
                          onClick={() => handleCheckIn(invite.inviteCode)}
                          className="btn btn-primary text-xs px-3 py-1.5"
                        >
                          Check In
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>

      {showAddGuests && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowAddGuests(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-neutral-900">Add Guests</h3>
              <button onClick={() => setShowAddGuests(false)} className="btn btn-ghost p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 mb-4">
              {newGuests.map((guest, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2">
                  <input
                    type="text"
                    placeholder="Guest/Family name"
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
                    placeholder="Email"
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
                    placeholder="Size"
                    title="Number of people in group/family"
                    className="input text-sm col-span-2"
                    min="1"
                    value={guest.groupSize}
                    onChange={(e) => {
                      const updated = [...newGuests];
                      updated[idx].groupSize = parseInt(e.target.value) || 1;
                      setNewGuests(updated);
                    }}
                  />
                  <input
                    type="number"
                    placeholder="+1"
                    title="Additional plus ones"
                    className="input text-sm col-span-2"
                    value={guest.plusOnes}
                    onChange={(e) => {
                      const updated = [...newGuests];
                      updated[idx].plusOnes = parseInt(e.target.value) || 0;
                      setNewGuests(updated);
                    }}
                  />
                </div>
              ))}
              <p className="text-xs text-neutral-500">
                Size = number of people per family/group, +1 = additional optional guests
              </p>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setNewGuests([...newGuests, { guestName: '', guestEmail: '', groupSize: 1, plusOnes: 0 }])}
                className="btn btn-secondary text-sm"
              >
                Add Another
              </button>
              <button onClick={handleAddGuests} className="btn btn-primary text-sm flex-1">
                Create Invites
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
