/**
 * ReserveConfirm.jsx — Reservation confirmation / status page
 *
 * Route: /reserve/confirm/:reservationId?t=qrToken
 *
 * Shown after booking and linked from confirmation emails.
 * Also used as the QR scan target for staff check-in.
 */

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle, Clock, XCircle, Calendar, Users, MapPin, Phone, Loader2, AlertCircle } from 'lucide-react';
import { reserveAPI } from '../services/api';

function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}
function fmtTime(d) {
  return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

const STATUS_CONFIG = {
  confirmed: { icon: CheckCircle, color: '#4ade80', label: 'Confirmed', bg: 'rgba(74,222,128,0.15)', border: 'rgba(74,222,128,0.3)' },
  pending:   { icon: Clock,       color: '#fbbf24', label: 'Pending approval', bg: 'rgba(251,191,36,0.15)', border: 'rgba(251,191,36,0.3)' },
  seated:    { icon: CheckCircle, color: '#a78bfa', label: 'Seated',    bg: 'rgba(167,139,250,0.15)', border: 'rgba(167,139,250,0.3)' },
  cancelled: { icon: XCircle,    color: '#f87171', label: 'Cancelled', bg: 'rgba(248,113,113,0.15)', border: 'rgba(248,113,113,0.3)' },
  no_show:   { icon: AlertCircle,color: '#9ca3af', label: 'No-show',   bg: 'rgba(156,163,175,0.1)',  border: 'rgba(156,163,175,0.2)' },
};

export default function ReserveConfirm() {
  const { reservationId } = useParams();
  const [searchParams]   = useSearchParams();
  const qrToken          = searchParams.get('t');

  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelled, setCancelled]   = useState(false);

  useEffect(() => {
    reserveAPI.getConfirmation(reservationId, qrToken)
      .then(res => setData(res.data))
      .catch(err => setError(err.response?.data?.error || 'Reservation not found.'))
      .finally(() => setLoading(false));
  }, [reservationId, qrToken]);

  const handleCancel = async () => {
    if (!window.confirm('Are you sure you want to cancel this reservation?')) return;
    setCancelling(true);
    try {
      await reserveAPI.cancel(data.reservation.cancelToken);
      setCancelled(true);
      setData(prev => ({ ...prev, reservation: { ...prev.reservation, status: 'cancelled' } }));
    } catch (err) {
      alert(err.response?.data?.error || 'Could not cancel. Please call us directly.');
    } finally { setCancelling(false); }
  };

  const accent = data?.accentColor || '#f97316';

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a0a' }}>
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: accent }} />
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#0a0a0a' }}>
      <div className="text-center max-w-sm">
        <div className="text-5xl mb-4">🔍</div>
        <h1 className="text-xl font-black text-white mb-2">Not found</h1>
        <p className="text-white/50 text-sm">{error}</p>
      </div>
    </div>
  );

  const { reservation, restaurantName, subdomain, address, cancellationPolicy, cancelCutoffHours, logoUrl } = data;
  const sc  = STATUS_CONFIG[reservation.status] || STATUS_CONFIG.confirmed;
  const Icon = sc.icon;
  const now  = new Date();
  const resTime = new Date(reservation.dateTime);
  const canCancel = reservation.status === 'confirmed' &&
    (resTime.getTime() - now.getTime()) > (cancelCutoffHours || 2) * 60 * 60 * 1000;

  const qrUrl = reservation.qrToken
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(reservation.qrToken)}&bgcolor=0a0a0a&color=ffffff&margin=2`
    : null;

  return (
    <div className="min-h-screen" style={{ background: '#0a0a0a', color: 'white' }}>
      <div className="max-w-md mx-auto px-4 py-10">

        {/* Restaurant header */}
        <div className="flex items-center gap-3 mb-8">
          {logoUrl && <img src={logoUrl} alt="logo" className="w-10 h-10 rounded-xl object-cover" />}
          <div>
            <div className="font-black text-white">{restaurantName}</div>
            {address && <div className="text-xs text-white/40 flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />{address}</div>}
          </div>
        </div>

        {/* Status card */}
        <div className="rounded-2xl p-6 mb-6 text-center" style={{ background: sc.bg, border: `1px solid ${sc.border}` }}>
          <Icon className="w-12 h-12 mx-auto mb-3" style={{ color: sc.color }} />
          <div className="text-lg font-black text-white mb-0.5">{sc.label}</div>
          <div className="text-white/60 text-sm">
            {reservation.status === 'confirmed' && `Reservation #${reservation.id.slice(-6).toUpperCase()}`}
            {reservation.status === 'pending' && 'We\'ll confirm your booking shortly'}
            {reservation.status === 'seated' && 'Enjoy your meal!'}
            {reservation.status === 'cancelled' && (cancelled ? 'Your reservation has been cancelled.' : 'This reservation has been cancelled.')}
          </div>
        </div>

        {/* Details */}
        {reservation.status !== 'cancelled' && (
          <div className="rounded-2xl p-5 mb-6 space-y-4" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${accent}20` }}>
                <Calendar className="w-4 h-4" style={{ color: accent }} />
              </div>
              <div>
                <div className="text-xs text-white/40 font-semibold uppercase tracking-wide">Date & Time</div>
                <div className="text-white font-bold">{fmtDate(reservation.dateTime)}</div>
                <div className="text-white/70 text-sm">{fmtTime(reservation.dateTime)}</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${accent}20` }}>
                <Users className="w-4 h-4" style={{ color: accent }} />
              </div>
              <div>
                <div className="text-xs text-white/40 font-semibold uppercase tracking-wide">Party</div>
                <div className="text-white font-bold">{reservation.partyName}</div>
                <div className="text-white/70 text-sm">{reservation.partySize} guest{reservation.partySize !== 1 ? 's' : ''}</div>
              </div>
            </div>
            {reservation.notes && (
              <div className="text-xs text-white/50 italic pt-2 border-t border-white/10">{reservation.notes}</div>
            )}
          </div>
        )}

        {/* QR Code */}
        {reservation.status === 'confirmed' && qrUrl && (
          <div className="mb-6 text-center">
            <p className="text-white/50 text-xs mb-3">Show this QR code when you arrive</p>
            <div className="inline-block rounded-2xl overflow-hidden p-3 bg-neutral-900 border border-white/10">
              <img src={qrUrl} alt="Entry QR" width="200" height="200" className="rounded-xl" />
            </div>
            <p className="text-white/30 text-xs mt-2">Valid until {fmtTime(reservation.qrExpiresAt)}</p>
          </div>
        )}

        {/* Cancellation policy */}
        {cancellationPolicy && reservation.status === 'confirmed' && (
          <div className="rounded-xl p-3 mb-5 text-xs text-white/40 leading-relaxed" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <AlertCircle className="w-3.5 h-3.5 inline mr-1.5 mb-0.5" />{cancellationPolicy}
          </div>
        )}

        {/* Self-cancel */}
        {canCancel && !cancelled && (
          <button onClick={handleCancel} disabled={cancelling}
            className="w-full py-3 rounded-xl text-sm font-semibold text-red-400 transition-all hover:bg-red-400/10 disabled:opacity-50"
            style={{ border: '1px solid rgba(248,113,113,0.2)' }}>
            {cancelling ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Cancel reservation'}
          </button>
        )}
        {!canCancel && reservation.status === 'confirmed' && (
          <p className="text-center text-xs text-white/30">
            To cancel, please call us directly — cancellations must be made more than {cancelCutoffHours || 2} hour{cancelCutoffHours !== 1 ? 's' : ''} before your reservation.
          </p>
        )}

        <div className="mt-8 text-center text-xs text-white/20">
          <a href={`/e/${subdomain}/reserve`} className="hover:text-white/40 transition-colors">Make another reservation</a>
          {' · '}
          <a href="https://planit.gg" className="hover:text-white/40 transition-colors">PlanIt</a>
        </div>
      </div>
    </div>
  );
}
