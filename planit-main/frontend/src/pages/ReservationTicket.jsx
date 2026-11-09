/**
 * ReservationTicket.jsx — Guest Reservation Confirmation Ticket
 *
 * Accessed at /reservation/:cancelToken after booking.
 * Displays a ticket-style confirmation with QR code, reservation details,
 * and a cancel button. Bookmarkable and shareable.
 *
 * Fetch: GET /api/events/public/reserve/confirmation/:cancelToken
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useWhiteLabel } from '../context/WhiteLabelContext';
import {
  UtensilsCrossed, Calendar, Users, Clock, MapPin, Phone,
  CheckCircle, XCircle, AlertCircle, Loader2, QrCode,
  ChevronLeft, Info, Utensils,
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

function fmtDateTime(dt) {
  return new Date(dt).toLocaleString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
    year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}
function fmtTime(dt) {
  return new Date(dt).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' });
}
function fmtDate(dt) {
  return new Date(dt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

const STATUS_LABELS = {
  confirmed: { label: 'Confirmed',  color: '#0a7149', bg: '#d6f7e8',  border: 'rgba(34,197,94,0.3)'  },
  pending:   { label: 'Pending',    color: '#6e5400', bg: '#fff6c2', border: 'rgba(245,158,11,0.3)' },
  seated:    { label: 'Seated',     color: '#2236ff', bg: '#eceeff',border: 'rgba(129,140,248,0.3)'},
  cancelled: { label: 'Cancelled',  color: '#ef4444', bg: '#ffe1de',  border: 'rgba(239,68,68,0.3)'  },
  no_show:   { label: 'No Show',    color: '#6b7280', bg: '#ffffff',border: 'rgba(107,114,128,0.3)'},
};

export default function ReservationTicket() {
  const { cancelToken } = useParams();
  const navigate = useNavigate();

  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelDone, setCancelDone] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  useEffect(() => {
    axios.get(`${API}/events/public/reserve/confirmation/${cancelToken}`)
      .then(r => { setData(r.data); setLoading(false); })
      .catch(e => {
        setError(e.response?.status === 404 ? 'not_found' : 'error');
        setLoading(false);
      });
  }, [cancelToken]);

  const handleCancel = async () => {
    setCancelling(true);
    setCancelError('');
    try {
      await axios.delete(`${API}/events/public/reserve/cancel/${cancelToken}`);
      setCancelDone(true);
      setShowCancelConfirm(false);
      // Refresh to show cancelled status
      const r = await axios.get(`${API}/events/public/reserve/confirmation/${cancelToken}`);
      setData(r.data);
    } catch (e) {
      setCancelError(e.response?.data?.error || 'Could not cancel. Please call us directly.');
    } finally {
      setCancelling(false);
    }
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-amber-700 animate-spin" />
    </div>
  );

  if (error === 'not_found') return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 text-center">
      <UtensilsCrossed className="w-12 h-12 text-neutral-600 mx-auto mb-4" />
      <h1 className="text-2xl font-black text-ink mb-2">Reservation not found</h1>
      <p className="text-neutral-500 text-sm mb-6">This confirmation link may be invalid or expired.</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 text-center">
      <AlertCircle className="w-12 h-12 text-red-700 mx-auto mb-4" />
      <h1 className="text-xl font-black text-ink mb-2">Something went wrong</h1>
      <button onClick={() => window.location.reload()} className="text-amber-700 text-sm hover:underline">Try again</button>
    </div>
  );

  const { reservation: r, restaurantName, accentColor, address, phone, confirmationMessage, cancelCutoffHours } = data;
  const { wl, isWL } = useWhiteLabel();
  const accent = (isWL && wl?.branding?.primaryColor) || accentColor || '#f97316';
  const statusMeta = STATUS_LABELS[r.status] || STATUS_LABELS.confirmed;
  const qrUrl = r.qrToken
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(r.qrToken)}&bgcolor=0a0a0a&color=ffffff&margin=2`
    : null;

  const isCancellable = r.status === 'confirmed' || r.status === 'pending';
  const qrExpired = r.qrExpiresAt && new Date(r.qrExpiresAt) < new Date();

  return (
    <div className="min-h-screen bg-white text-ink">
      {/* Top bar */}
      <div className="border-b border-ink px-4 py-3 flex items-center gap-3">
        {data.subdomain && (
          <a href={`/e/${data.subdomain}/reserve`}
            className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-ink transition-colors">
            <ChevronLeft className="w-4 h-4" />
            <Utensils className="w-3.5 h-3.5" />
            {restaurantName}
          </a>
        )}
      </div>

      <div className="max-w-lg mx-auto px-4 py-8">

        {/* ── Ticket card ── */}
        <div className="rounded-3xl border-2 border-ink overflow-hidden shadow-2xl"
             style={{ background: '#ffffff' }}>

          {/* Header */}
          <div className="relative px-7 pt-7 pb-5 border-b border-ink"
               style={{ background: `linear-gradient(135deg, ${accent}15 0%, transparent 60%)` }}>
            {/* Decorative glow */}
            <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-20 pointer-events-none"
                 style={{ background: accent }} />

            <div className="relative">
              {/* Status + restaurant */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-lg"></span>
                  <span className="text-xs font-bold uppercase tracking-widest" style={{ color: accent }}>
                    Restaurant Reservation
                  </span>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 rounded-full border-2 border-ink"
                  style={{ color: statusMeta.color, background: statusMeta.bg, borderColor: statusMeta.border }}>
                  {statusMeta.label}
                </span>
              </div>

              {/* Guest name */}
              <h1 className="text-3xl font-black text-ink mb-1">{r.partyName}</h1>
              <p className="text-neutral-500">
                {r.status === 'confirmed' ? 'Your reservation is confirmed' :
                 r.status === 'pending'   ? 'Your reservation is pending approval' :
                 r.status === 'seated'    ? 'You have been seated — enjoy!' :
                 r.status === 'cancelled' ? 'This reservation has been cancelled' :
                 'Reservation details'}
              </p>
            </div>
          </div>

          {/* Body */}
          <div className="px-7 py-6 space-y-5">

            {/* Date / time / party */}
            <div className="grid grid-cols-1 gap-4">
              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                     style={{ background: `${accent}15`, border: `1px solid ${accent}30` }}>
                  <Calendar className="w-5 h-5" style={{ color: accent }} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-0.5">Date & Time</p>
                  <p className="text-ink font-semibold">{fmtDate(r.dateTime)}</p>
                  <p className="text-neutral-600 text-sm">{fmtTime(r.dateTime)}</p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                     style={{ background: `${accent}15`, border: `1px solid ${accent}30` }}>
                  <Users className="w-5 h-5" style={{ color: accent }} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-0.5">Party Size</p>
                  <p className="text-ink font-semibold">{r.partySize} {r.partySize === 1 ? 'guest' : 'guests'}</p>
                  {r.occasion && <p className="text-neutral-500 text-sm capitalize">{r.occasion}</p>}
                </div>
              </div>

              {address && (
                <div className="flex gap-4 items-start">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                       style={{ background: `${accent}15`, border: `1px solid ${accent}30` }}>
                    <MapPin className="w-5 h-5" style={{ color: accent }} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-0.5">Location</p>
                    <p className="text-ink font-semibold">{restaurantName}</p>
                    <p className="text-neutral-500 text-sm">{address}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Special requests / dietary */}
            {(r.specialRequests || r.dietaryNeeds) && (
              <div className="rounded-xl p-4 bg-lav border-2 border-ink space-y-2 shadow">
                {r.specialRequests && (
                  <div>
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Special Requests</p>
                    <p className="text-neutral-600 text-sm">{r.specialRequests}</p>
                  </div>
                )}
                {r.dietaryNeeds && (
                  <div>
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-1">Dietary Needs</p>
                    <p className="text-neutral-600 text-sm">{r.dietaryNeeds}</p>
                  </div>
                )}
              </div>
            )}

            {/* Confirmation message */}
            {confirmationMessage && (
              <div className="rounded-xl p-4 flex gap-3"
                   style={{ background: `${accent}10`, border: `1px solid ${accent}25` }}>
                <Info className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: accent }} />
                <p className="text-sm" style={{ color: accent }}>{confirmationMessage}</p>
              </div>
            )}
          </div>

          {/* Ticket perforation line */}
          <div className="relative flex items-center mx-4">
            <div className="absolute -left-8 w-8 h-8 rounded-full bg-white" />
            <div className="flex-1 border-t border-dashed border-ink" />
            <div className="absolute -right-8 w-8 h-8 rounded-full bg-white" />
          </div>

          {/* QR section */}
          <div className="px-7 py-6">
            {r.status === 'cancelled' ? (
              <div className="text-center py-4">
                <XCircle className="w-10 h-10 text-red-700 mx-auto mb-2" />
                <p className="text-neutral-500 text-sm">Reservation cancelled</p>
              </div>
            ) : r.status === 'seated' ? (
              <div className="text-center py-4">
                <CheckCircle className="w-10 h-10 text-emerald-700 mx-auto mb-2" />
                <p className="text-ink font-bold mb-1">You're seated!</p>
                <p className="text-neutral-500 text-sm">Enjoy your meal </p>
              </div>
            ) : qrUrl ? (
              <div className="text-center">
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-4">
                  {qrExpired ? 'QR Code Expired' : 'Show at the host stand'}
                </p>
                <div className={`inline-block p-3 rounded-2xl mb-4 ${qrExpired ? 'opacity-40' : ''}`}
                     style={{ background: '#ffffff', border: `2px solid ${accent}40` }}>
                  <img src={qrUrl} alt="Reservation QR" className="w-36 h-36" />
                </div>
                {qrExpired ? (
                  <p className="text-amber-700 text-xs">QR code has expired. Please speak to the host.</p>
                ) : (
                  <p className="text-neutral-500 text-xs">
                    Valid until {new Date(r.qrExpiresAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-2">
                <QrCode className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
                <p className="text-neutral-500 text-xs">QR code unavailable</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Actions ── */}
        {isCancellable && !cancelDone && (
          <div className="mt-6">
            {showCancelConfirm ? (
              <div className="rounded-2xl border border-red-700 bg-red-50 p-5">
                <p className="text-ink font-bold text-sm mb-1">Cancel this reservation?</p>
                <p className="text-neutral-500 text-xs mb-4">
                  This cannot be undone. Cancellations must be made at least {cancelCutoffHours}h before your booking.
                </p>
                {cancelError && (
                  <p className="text-red-700 text-xs mb-3 flex items-start gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />{cancelError}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={handleCancel} disabled={cancelling}
                    className="py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white rounded-xl text-sm font-bold transition-colors flex items-center justify-center gap-2 border-2 border-ink shadow-hard-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_#0d0e1c] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition">
                    {cancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                    Yes, cancel
                  </button>
                  <button onClick={() => { setShowCancelConfirm(false); setCancelError(''); }}
                    className="py-2.5 bg-lav hover:bg-lav text-neutral-600 rounded-xl text-sm font-semibold transition-colors border-2 border-ink shadow-hard-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_#0d0e1c] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition">
                    Keep reservation
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowCancelConfirm(true)}
                className="w-full py-3 border-2 border-ink hover:border-red-700 hover:text-red-700 text-neutral-500 rounded-xl text-sm font-semibold transition-all shadow-hard-sm hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_#0d0e1c] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition">
                Cancel reservation
              </button>
            )}
          </div>
        )}

        {phone && (
          <p className="text-center text-xs text-neutral-600 mt-6">
            Need help? Call us at{' '}
            <a href={`tel:${phone}`} className="hover:underline" style={{ color: accent }}>{phone}</a>
          </p>
        )}

        {!(isWL && wl?.branding?.hidePoweredBy) && (
          <p className="text-center text-xs text-neutral-800 mt-4">
            Powered by <a href="https://planitapp.onrender.com" className="hover:opacity-70" style={{ color: accent }}>PlanIt</a>
          </p>
        )}
      </div>
    </div>
  );
}
