/**
 * ReservePage.jsx — Public Restaurant Reservation Page
 *
 * Standalone, no auth, fully public.
 * Fetches config from GET /api/events/public/reserve/:subdomain
 * Fetches availability from GET /api/events/public/reserve/:subdomain/availability
 * Submits to POST /api/events/public/reserve/:subdomain
 *
 * Route: /e/:subdomain/reserve
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import {
  Clock, Users, MapPin, Phone, Globe, Instagram, ChevronRight,
  ChevronLeft, Check, X, Calendar, Star, Info, AlertCircle,
  ExternalLink, QrCode, ArrowLeft, Loader2, Facebook,
  UtensilsCrossed, Accessibility, ParkingSquare, ChevronDown,
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// ── tiny helpers ─────────────────────────────────────────────────────────────

function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}
function fmtTime(t) {
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12  = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}
function fmtDateTime(dt) {
  return new Date(dt).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function dayLabel(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const today = todayStr();
  const tom   = addDays(today, 1);
  if (dateStr === today) return 'Today';
  if (dateStr === tom)   return 'Tomorrow';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
function shortDay(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}
function dayNum(dateStr) {
  return new Date(dateStr + 'T12:00:00').getDate();
}

const DAY_KEYS = ['sun','mon','tue','wed','thu','fri','sat'];

function isDayClosed(dateStr, config) {
  if (!config) return false;
  const dayIdx = new Date(dateStr + 'T12:00:00').getDay();
  const key    = DAY_KEYS[dayIdx];
  const dayConf = config.operatingDays?.[key];
  if (dayConf && dayConf.open === false) return true;
  if ((config.blackoutDates || []).includes(dateStr)) return true;
  return false;
}

// ── Status pill ───────────────────────────────────────────────────────────────

function SlotStatus({ status, freeCount, showCount }) {
  if (status === 'full') return <span className="text-rose-400 text-xs font-semibold">Full</span>;
  if (status === 'limited') return (
    <span className="text-amber-400 text-xs font-semibold">
      {showCount && freeCount != null ? `${freeCount} left` : 'Limited'}
    </span>
  );
  if (status === 'unavailable') return null;
  return <span className="text-emerald-400 text-xs font-semibold">Available</span>;
}

// ── Confirmation screen ───────────────────────────────────────────────────────

function ConfirmationScreen({ booking, config, subdomain, onReset }) {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(booking.qrToken)}&bgcolor=0a0a0a&color=ffffff&margin=2`;
  const accent = config.accentColor || '#f97316';

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: config.backgroundStyle === 'light' ? '#f8fafc' : '#09090f' }}>
      <div className="max-w-md w-full">
        {/* Success header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: accent + '22', border: `2px solid ${accent}55` }}>
            <Check className="w-8 h-8" style={{ color: accent }} />
          </div>
          <h1 className="text-2xl font-black mb-2" style={{ color: config.backgroundStyle === 'light' ? '#111' : '#fff' }}>
            {booking.isPending ? 'Request Received!' : 'You\'re booked!'}
          </h1>
          <p className="text-sm" style={{ color: config.backgroundStyle === 'light' ? '#666' : '#999' }}>
            {booking.isPending
              ? 'Your reservation request is pending confirmation. We\'ll be in touch shortly.'
              : 'Your reservation is confirmed. See you soon!'}
          </p>
        </div>

        {/* Booking card */}
        <div className="rounded-2xl border p-6 mb-6" style={{ background: config.backgroundStyle === 'light' ? '#fff' : '#111', borderColor: config.backgroundStyle === 'light' ? '#e5e7eb' : '#222' }}>
          <div className="text-center mb-5">
            <div className="text-lg font-bold" style={{ color: config.backgroundStyle === 'light' ? '#111' : '#fff' }}>{config.name}</div>
            <div className="text-sm mt-1" style={{ color: config.backgroundStyle === 'light' ? '#666' : '#999' }}>
              {fmtDateTime(booking.dateTime)} · Party of {booking.partySize}
            </div>
            <div className="font-semibold mt-1" style={{ color: config.backgroundStyle === 'light' ? '#333' : '#ddd' }}>{booking.partyName}</div>
          </div>

          {!booking.isPending && (
            <div className="flex justify-center mb-4">
              <img src={qrUrl} alt="Reservation QR" className="rounded-xl" width={160} height={160} />
            </div>
          )}

          <div className="text-center text-xs mb-4" style={{ color: config.backgroundStyle === 'light' ? '#999' : '#555' }}>
            {booking.isPending
              ? 'QR code will be sent to you upon confirmation'
              : 'Show this QR code when you arrive'}
          </div>

          {booking.confirmationMessage && (
            <div className="text-sm text-center italic px-2" style={{ color: config.backgroundStyle === 'light' ? '#666' : '#888' }}>
              "{booking.confirmationMessage}"
            </div>
          )}

          {booking.depositRequired && booking.depositAmount > 0 && (
            <div className="mt-4 p-3 rounded-xl text-sm text-center" style={{ background: accent + '15', border: `1px solid ${accent}33`, color: accent }}>
              <strong>Deposit required:</strong> ${booking.depositAmount}
              {booking.depositNote && <div className="mt-1 text-xs opacity-80">{booking.depositNote}</div>}
            </div>
          )}
        </div>

        {/* Cancel link */}
        <div className="text-center text-xs mb-6" style={{ color: config.backgroundStyle === 'light' ? '#999' : '#555' }}>
          Need to cancel?{' '}
          <a href={booking.cancelUrl} className="underline hover:opacity-80" style={{ color: accent }}>
            Cancel reservation
          </a>
          {config.cancelCutoffHours > 0 && ` (up to ${config.cancelCutoffHours}h before)`}
        </div>

        <button onClick={onReset}
          className="w-full py-3 rounded-xl font-semibold text-sm transition-all"
          style={{ background: accent + '20', color: accent, border: `1px solid ${accent}44` }}>
          Make another reservation
        </button>

        {config.showPoweredBy !== false && (
          <div className="text-center text-xs mt-6" style={{ color: config.backgroundStyle === 'light' ? '#ccc' : '#333' }}>
            Powered by <a href="https://planitapp.onrender.com" className="hover:opacity-80" style={{ color: accent }}>PlanIt</a>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Cancel landing page ───────────────────────────────────────────────────────
export function ReserveCancelPage() {
  const { cancelToken } = useParams();
  const [state, setState] = useState('idle'); // idle | loading | success | error
  const [msg, setMsg]     = useState('');

  const handleCancel = async () => {
    setState('loading');
    try {
      await axios.delete(`${API}/events/public/reserve/cancel/${cancelToken}`);
      setState('success');
    } catch (err) {
      setMsg(err.response?.data?.error || 'Something went wrong.');
      setState('error');
    }
  };

  if (state === 'success') return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <Check className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
        <h1 className="text-2xl font-black text-white mb-2">Reservation Cancelled</h1>
        <p className="text-neutral-400 text-sm">Your reservation has been cancelled. We hope to see you another time.</p>
        <a href="/" className="inline-block mt-6 text-sm text-neutral-500 hover:text-neutral-300">← Back to PlanIt</a>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-neutral-800 border border-neutral-700 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <X className="w-8 h-8 text-neutral-400" />
        </div>
        <h1 className="text-2xl font-black text-white mb-2">Cancel Reservation</h1>
        {state === 'error' ? (
          <>
            <p className="text-rose-400 text-sm mb-6">{msg}</p>
            <a href="/" className="text-sm text-neutral-500 hover:text-neutral-300">← Back</a>
          </>
        ) : (
          <>
            <p className="text-neutral-400 text-sm mb-6">Are you sure you want to cancel your reservation? This cannot be undone.</p>
            <button onClick={handleCancel} disabled={state === 'loading'}
              className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 mb-3">
              {state === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
              Yes, cancel my reservation
            </button>
            <a href="/" className="block text-sm text-neutral-500 hover:text-neutral-300">← Keep reservation</a>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ReservePage() {
  const { subdomain } = useParams();

  const [config, setConfig]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  // Booking flow state
  const [step, setStep]         = useState('pick'); // pick | form | confirm
  const [partySize, setPartySize] = useState(2);
  const [dateStr, setDateStr]   = useState(todayStr());
  const [slots, setSlots]       = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [dateOffset, setDateOffset]     = useState(0); // for date strip pagination

  // Form state
  const [form, setForm] = useState({ partyName: '', phone: '', email: '', occasion: '', specialRequests: '', dietaryNeeds: '' });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [booking, setBooking]       = useState(null);

  // FAQ expand
  const [openFaq, setOpenFaq] = useState(null);

  const slotTimerRef = useRef(null);
  const accent = config?.accentColor || '#f97316';
  const isDark = config?.backgroundStyle !== 'light';

  const c = {
    bg:       isDark ? '#09090f' : '#f8fafc',
    card:     isDark ? '#111118' : '#ffffff',
    border:   isDark ? '#1e1e2e' : '#e5e7eb',
    text:     isDark ? '#ffffff' : '#111827',
    muted:    isDark ? '#71717a' : '#6b7280',
    subtle:   isDark ? '#27272a' : '#f3f4f6',
    inputBg:  isDark ? '#18181f' : '#f9fafb',
    inputBdr: isDark ? '#2d2d3d' : '#d1d5db',
  };

  // Load config
  useEffect(() => {
    axios.get(`${API}/events/public/reserve/${subdomain}`)
      .then(r => { setConfig(r.data); setLoading(false); })
      .catch(err => {
        setError(err.response?.status === 404 ? 'not_found' : 'error');
        setLoading(false);
      });
  }, [subdomain]);

  // Load slots whenever date or partySize changes
  const loadSlots = useCallback(async (date, size) => {
    if (!config?.acceptingReservations) return;
    setSlotsLoading(true);
    setSelectedSlot(null);
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const r = await axios.get(`${API}/events/public/reserve/${subdomain}/availability`, { params: { date, partySize: size, tz } });
      setSlots(r.data.slots || []);
    } catch { setSlots([]); }
    finally { setSlotsLoading(false); }
  }, [config, subdomain]);

  useEffect(() => {
    if (!config) return;
    if (slotTimerRef.current) clearTimeout(slotTimerRef.current);
    slotTimerRef.current = setTimeout(() => loadSlots(dateStr, partySize), 150);
    return () => clearTimeout(slotTimerRef.current);
  }, [dateStr, partySize, config, loadSlots]);

  // Build date strip (7 days from today + offset)
  const dates = Array.from({ length: 7 }, (_, i) => addDays(todayStr(), dateOffset + i))
    .filter(d => {
      const maxDate = addDays(todayStr(), config?.maxAdvanceDays || 30);
      return d <= maxDate;
    });

  const validateForm = () => {
    const e = {};
    if (!form.partyName.trim()) e.partyName = 'Name is required';
    if (config.requirePhone && !form.phone.trim()) e.phone = 'Phone is required';
    if (config.requireEmail && !form.email.trim()) e.email = 'Email is required';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email';
    setFormErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    setSubmitting(true);
    try {
      const r = await axios.post(`${API}/events/public/reserve/${subdomain}`, {
        partyName:       form.partyName.trim(),
        partySize,
        phone:           form.phone.trim(),
        email:           form.email.trim(),
        date:            dateStr,
        timeSlot:        selectedSlot,
        occasion:        form.occasion,
        specialRequests: form.specialRequests.trim(),
        dietaryNeeds:    form.dietaryNeeds.trim(),
        tz:              Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      setBooking(r.data);
      setStep('done');
    } catch (err) {
      const msg = err.response?.data?.error || 'Could not complete your reservation. Please try again.';
      setFormErrors({ _submit: msg });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading / error states ────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
    </div>
  );

  if (error === 'not_found') return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-6 text-center">
      <div>
        <UtensilsCrossed className="w-10 h-10 text-neutral-500 mx-auto mb-4" />
        <h1 className="text-2xl font-black text-white mb-2">Restaurant not found</h1>
        <p className="text-neutral-500 text-sm">This reservation page doesn't exist or has been removed.</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-6 text-center">
      <div>
        <AlertCircle className="w-10 h-10 text-rose-400 mx-auto mb-4" />
        <h1 className="text-xl font-black text-white mb-2">Something went wrong</h1>
        <button onClick={() => window.location.reload()} className="text-sm text-orange-400 hover:underline">Try again</button>
      </div>
    </div>
  );

  if (step === 'done' && booking) {
    return <ConfirmationScreen booking={booking} config={config} subdomain={subdomain} onReset={() => { setStep('pick'); setBooking(null); setForm({ partyName:'', phone:'', email:'', occasion:'', specialRequests:'', dietaryNeeds:'' }); }} />;
  }

  const inputClass = `w-full rounded-xl px-4 py-3 text-sm outline-none transition-all`;
  const inputStyle = { background: c.inputBg, border: `1.5px solid ${c.inputBdr}`, color: c.text };
  const inputFocus = (e) => { e.target.style.borderColor = accent; };
  const inputBlur  = (e) => { e.target.style.borderColor = c.inputBdr; };

  return (
    <div className="min-h-screen font-sans leading-relaxed" style={{ background: c.bg, color: c.text }}>

      {/* ── Announcement banner ── */}
      {config.announcementBanner && (
        <div className="text-center text-sm font-semibold py-2.5 px-4" style={{ background: config.announcementBannerColor || '#f59e0b', color: '#000' }}>
          {config.announcementBanner}
        </div>
      )}

      {/* ── Hero ── */}
      <div className="relative overflow-hidden" style={{ minHeight: config.heroImageUrl ? 340 : 220 }}>
        {config.heroImageUrl && (
          <div className="absolute inset-0">
            <img src={config.heroImageUrl} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ background: isDark ? 'linear-gradient(to bottom, rgba(9,9,15,0.4), rgba(9,9,15,0.85))' : 'linear-gradient(to bottom, rgba(0,0,0,0.2), rgba(0,0,0,0.6))' }} />
          </div>
        )}
        <div className="relative z-10 max-w-4xl mx-auto px-6 py-12 flex flex-col items-center text-center">
          {config.logoUrl && <img src={config.logoUrl} alt={config.name} className="w-20 h-20 object-contain rounded-2xl mb-5 shadow-xl" />}
          <h1 className="text-4xl md:text-5xl font-black text-white mb-2 drop-shadow-lg">{config.name}</h1>
          {config.tagline && <p className="text-white/75 text-base mt-2 drop-shadow font-medium max-w-md">{config.tagline}</p>}
          <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
            {config.cuisine && <span className="px-3 py-1 rounded-full text-sm font-semibold text-white/90" style={{ background: accent + '44', border: `1px solid ${accent}66` }}>{config.cuisine}</span>}
            {config.priceRange && <span className="px-3 py-1 rounded-full text-sm font-semibold text-white/90" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}>{config.priceRange}</span>}
            {config.dressCode && <span className="px-3 py-1 rounded-full text-sm font-semibold text-white/90" style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}>{config.dressCode}</span>}
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="max-w-4xl mx-auto px-4 py-8 grid md:grid-cols-3 gap-8">

        {/* ── Left col: info ── */}
        <div className="md:col-span-1 space-y-6">

          {/* Description */}
          {config.description && (
            <div className="rounded-2xl p-5" style={{ background: c.card, border: `1px solid ${c.border}` }}>
              <p className="text-sm leading-relaxed" style={{ color: c.muted }}>{config.description}</p>
            </div>
          )}

          {/* Hours */}
          <div className="rounded-2xl p-5" style={{ background: c.card, border: `1px solid ${c.border}` }}>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4" style={{ color: accent }} />
            <span className="text-sm font-black uppercase tracking-wider">Hours</span>
            </div>
            {config.operatingDays && Object.entries(config.operatingDays).length > 0 ? (
              <div className="space-y-1">
                {['mon','tue','wed','thu','fri','sat','sun'].map(d => {
                  const dc = config.operatingDays[d];
                  const label = { mon:'Monday',tue:'Tuesday',wed:'Wednesday',thu:'Thursday',fri:'Friday',sat:'Saturday',sun:'Sunday' }[d];
                  if (!dc) return null;
                  return (
                    <div key={d} className="flex justify-between text-xs">
                      <span style={{ color: c.muted }}>{label}</span>
                      {dc.open === false
                        ? <span className="text-rose-400 font-semibold">Closed</span>
                        : <span style={{ color: c.text }}>{dc.openTime || config.operatingHoursOpen} – {dc.closeTime || config.operatingHoursClose}</span>
                      }
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-sm" style={{ color: c.text }}>{fmtTime(config.operatingHoursOpen)} – {fmtTime(config.operatingHoursClose)}</div>
            )}
          </div>

          {/* Live wait times */}
          {config.showLiveWaitTime && config.waitTimes && (
            <div className="rounded-2xl p-5" style={{ background: c.card, border: `1px solid ${c.border}` }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-sm font-black uppercase tracking-wider">Current Walk-in Wait</span>
              </div>
              <div className="space-y-2">
                {[
                  { label: 'For 2', val: config.waitTimes.forTwo },
                  { label: 'For 4', val: config.waitTimes.forFour },
                  { label: 'For 6+', val: config.waitTimes.forEight },
                ].map(({ label, val }) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span style={{ color: c.muted }}>{label}</span>
                    <span className={`font-semibold ${val === 0 ? 'text-emerald-400' : val === null ? 'text-neutral-500' : val <= 15 ? 'text-amber-400' : 'text-rose-400'}`}>
                      {val === 0 ? 'Seat now' : val === null ? 'No tables' : `~${val} min`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Info cards */}
          {(config.address || config.phone || config.websiteUrl) && (
            <div className="rounded-2xl p-5 space-y-3" style={{ background: c.card, border: `1px solid ${c.border}` }}>
              {config.address && (
                <a href={config.googleMapsUrl || '#'} target="_blank" rel="noopener noreferrer"
                  className="flex items-start gap-3 text-sm hover:opacity-70 transition-opacity">
                  <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: accent }} />
                  <span style={{ color: c.muted }}>{config.address}</span>
                </a>
              )}
              {config.phone && (
                <a href={`tel:${config.phone}`} className="flex items-center gap-3 text-sm hover:opacity-70 transition-opacity">
                  <Phone className="w-4 h-4 flex-shrink-0" style={{ color: accent }} />
                  <span style={{ color: c.muted }}>{config.phone}</span>
                </a>
              )}
              {config.websiteUrl && (
                <a href={config.websiteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm hover:opacity-70 transition-opacity">
                  <Globe className="w-4 h-4 flex-shrink-0" style={{ color: accent }} />
                  <span style={{ color: c.muted }}>{config.websiteUrl.replace(/^https?:\/\//, '')}</span>
                </a>
              )}
            </div>
          )}

          {/* Extra info */}
          {(config.parkingInfo || config.accessibilityInfo || config.dressCode) && (
            <div className="rounded-2xl p-5 space-y-4" style={{ background: c.card, border: `1px solid ${c.border}` }}>
              {config.parkingInfo && (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <ParkingSquare className="w-3.5 h-3.5" style={{ color: accent }} />
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: c.muted }}>Parking</span>
                  </div>
                  <p className="text-sm" style={{ color: c.muted }}>{config.parkingInfo}</p>
                </div>
              )}
              {config.accessibilityInfo && (
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Accessibility className="w-3.5 h-3.5" style={{ color: accent }} />
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: c.muted }}>Accessibility</span>
                  </div>
                  <p className="text-sm" style={{ color: c.muted }}>{config.accessibilityInfo}</p>
                </div>
              )}
            </div>
          )}

          {/* Social links */}
          {(config.instagramHandle || config.facebookUrl) && (
            <div className="flex gap-3">
              {config.instagramHandle && (
                <a href={`https://instagram.com/${config.instagramHandle}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
                  style={{ background: c.subtle, color: c.muted }}>
                  <Instagram className="w-4 h-4" />@{config.instagramHandle}
                </a>
              )}
              {config.facebookUrl && (
                <a href={config.facebookUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:opacity-80"
                  style={{ background: c.subtle, color: c.muted }}>
                  <Facebook className="w-4 h-4" />Facebook
                </a>
              )}
            </div>
          )}
        </div>

        {/* ── Right col: booking widget ── */}
        <div className="md:col-span-2">
          <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${c.border}` }}>

            {/* Card header */}
            <div className="px-6 py-5" style={{ background: accent + (isDark ? '18' : '10'), borderBottom: `1px solid ${c.border}` }}>
              <h2 className="text-lg font-black mb-3" style={{ color: c.text }}>Reserve a Table</h2>
              {config.acceptingReservations && (
                <div className="flex items-center gap-1 text-xs font-semibold">
                  <span className="flex items-center gap-1.5" style={{ color: step === 'pick' ? accent : c.muted }}>
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black"
                      style={{ background: step === 'pick' ? accent : (step === 'form' ? accent + '33' : c.subtle), color: step === 'pick' ? '#fff' : c.muted }}>1</span>
                    Choose a time
                  </span>
                  <ChevronRight className="w-3 h-3 mx-1" style={{ color: c.muted }} />
                  <span className="flex items-center gap-1.5" style={{ color: step === 'form' ? accent : c.muted }}>
                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black"
                      style={{ background: step === 'form' ? accent : c.subtle, color: step === 'form' ? '#fff' : c.muted }}>2</span>
                    Your details
                  </span>
                </div>
              )}
              {!config.acceptingReservations && (
                <div className="flex items-center gap-2 mt-2">
                  <AlertCircle className="w-4 h-4 text-rose-400" />
                  <span className="text-sm text-rose-400 font-semibold">Online reservations are currently unavailable. Please call us.</span>
                </div>
              )}
            </div>

            {config.acceptingReservations && (
              <div className="p-6 space-y-6" style={{ background: c.card }}>

                {/* Party size */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-3" style={{ color: c.muted }}>Party Size</label>
                  <div className="flex flex-wrap gap-2">
                    {Array.from({ length: (config.maxPartySizePublic || 12) - (config.minPartySizePublic || 1) + 1 }, (_, i) => i + (config.minPartySizePublic || 1)).map(sz => (
                      <button key={sz} onClick={() => setPartySize(sz)}
                        className="w-11 h-11 rounded-xl text-sm font-bold transition-all"
                        style={partySize === sz
                          ? { background: accent, color: '#fff', border: `2px solid ${accent}` }
                          : { background: c.subtle, color: c.muted, border: `2px solid transparent` }
                        }>
                        {sz}
                      </button>
                    ))}
                    {(config.maxPartySizePublic || 12) < 20 && (
                      <button className="px-3 h-11 rounded-xl text-sm font-bold" style={{ background: c.subtle, color: c.muted }}>
                        {(config.maxPartySizePublic || 12)}+
                      </button>
                    )}
                  </div>
                </div>

                {/* Date strip */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-3" style={{ color: c.muted }}>Date</label>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setDateOffset(Math.max(0, dateOffset - 7))} disabled={dateOffset === 0}
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-30 transition-all hover:opacity-70"
                      style={{ background: c.subtle, color: c.text }}>
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <div className="flex-1 grid grid-cols-7 gap-1 overflow-hidden">
                      {dates.map(d => {
                        const closed  = isDayClosed(d, config);
                        const isSel   = d === dateStr;
                        const isToday = d === todayStr();
                        return (
                          <button key={d} onClick={() => !closed && setDateStr(d)} disabled={closed}
                            className="flex flex-col items-center py-2 px-1 rounded-xl transition-all disabled:opacity-30"
                            style={isSel
                              ? { background: accent, color: '#fff' }
                              : { background: c.subtle, color: c.muted }
                            }>
                            <span className="text-[10px] font-semibold">{shortDay(d)}</span>
                            <span className={`text-base font-black mt-0.5`}>{dayNum(d)}</span>
                            {isToday && !isSel && <div className="w-1 h-1 rounded-full mt-0.5" style={{ background: accent }} />}
                          </button>
                        );
                      })}
                    </div>
                    <button onClick={() => setDateOffset(dateOffset + 7)}
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all hover:opacity-70"
                      style={{ background: c.subtle, color: c.text }}>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="text-xs mt-2 font-semibold" style={{ color: c.muted }}>{dayLabel(dateStr)}</div>
                </div>

                {/* Time slots */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-3" style={{ color: c.muted }}>
                    Available Times {slotsLoading && <Loader2 className="w-3 h-3 inline ml-1 animate-spin" />}
                  </label>

                  {!slotsLoading && slots.length === 0 && (
                    <div className="text-center py-8 rounded-xl" style={{ background: c.subtle, color: c.muted }}>
                      <UtensilsCrossed className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm font-semibold">No available times for this date</p>
                      <p className="text-xs mt-1">Try a different date or party size</p>
                    </div>
                  )}

                  {slots.length > 0 && (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {slots.map(slot => {
                        const isFull  = slot.status === 'full';
                        const isUnavail = slot.status === 'unavailable';
                        const isSel   = selectedSlot === slot.time;
                        if (isUnavail) return null;
                        return (
                          <button key={slot.time} onClick={() => !isFull && setSelectedSlot(slot.time)} disabled={isFull}
                            className="py-2.5 rounded-xl text-center transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                            style={isSel
                              ? { background: accent, border: `2px solid ${accent}`, color: '#fff' }
                              : isFull
                              ? { background: c.subtle, border: `2px solid transparent`, color: c.muted }
                              : { background: c.inputBg, border: `2px solid ${c.inputBdr}`, color: c.text }
                            }>
                            <div className="text-sm font-bold">{fmtTime(slot.time)}</div>
                            {config.showAvailabilityStatus && <SlotStatus status={slot.status} freeCount={slot.freeCount} showCount={config.showTableCount} />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Continue button */}
                {selectedSlot && step === 'pick' && (
                  <button onClick={() => setStep('form')}
                    className="w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90"
                    style={{ background: accent, color: '#fff' }}>
                    Continue — {fmtTime(selectedSlot)} for {partySize} <ChevronRight className="w-4 h-4" />
                  </button>
                )}
                {!selectedSlot && step === 'pick' && slots.length > 0 && (
                  <p className="text-xs text-center py-2" style={{ color: c.muted }}>
                    Select a time above to continue
                  </p>
                )}

                {/* Booking form */}
                {step === 'form' && selectedSlot && (
                  <div className="space-y-4 pt-4 border-t" style={{ borderColor: c.border }}>
                    <div className="flex items-center gap-3 mb-2">
                      <button onClick={() => setStep('pick')} className="p-2 rounded-xl hover:opacity-70 transition-opacity" style={{ background: c.subtle, color: c.muted }}>
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <div>
                        <div className="font-bold text-sm" style={{ color: c.text }}>
                          {dayLabel(dateStr)} at {fmtTime(selectedSlot)} · Party of {partySize}
                        </div>
                        <button onClick={() => setStep('pick')} className="text-xs hover:underline" style={{ color: accent }}>Change</button>
                      </div>
                    </div>
                    <h3 className="text-sm font-black uppercase tracking-wider" style={{ color: c.text }}>Your Details</h3>

                    {formErrors._submit && (
                      <div className="flex items-center gap-2 p-3 rounded-xl text-sm" style={{ background: '#fee2e2', color: '#dc2626' }}>
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        {formErrors._submit}
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: c.muted }}>Your Name *</label>
                      <input className={inputClass} style={inputStyle} value={form.partyName}
                        onChange={e => setForm(p => ({ ...p, partyName: e.target.value }))}
                        onFocus={inputFocus} onBlur={inputBlur}
                        placeholder="First & last name" />
                      {formErrors.partyName && <p className="text-rose-400 text-xs mt-1">{formErrors.partyName}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {(config.requirePhone || true) && (
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: c.muted }}>
                            Phone {config.requirePhone ? '*' : ''}
                          </label>
                          <input className={inputClass} style={inputStyle} type="tel" value={form.phone}
                            onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                            onFocus={inputFocus} onBlur={inputBlur}
                            placeholder="+1 555 000 0000" />
                          {formErrors.phone && <p className="text-rose-400 text-xs mt-1">{formErrors.phone}</p>}
                        </div>
                      )}
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: c.muted }}>
                          Email {config.requireEmail ? '*' : ''}
                        </label>
                        <input className={inputClass} style={inputStyle} type="email" value={form.email}
                          onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                          onFocus={inputFocus} onBlur={inputBlur}
                          placeholder="you@email.com" />
                        {formErrors.email && <p className="text-rose-400 text-xs mt-1">{formErrors.email}</p>}
                      </div>
                    </div>

                    {config.allowOccasionSelect && config.occasionOptions?.length > 0 && (
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: c.muted }}>Occasion (optional)</label>
                        <select className={inputClass} style={{ ...inputStyle, appearance: 'none' }}
                          value={form.occasion} onChange={e => setForm(p => ({ ...p, occasion: e.target.value }))}
                          onFocus={inputFocus} onBlur={inputBlur}>
                          <option value="">No special occasion</option>
                          {config.occasionOptions.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                    )}

                    {config.allowDietaryNeeds && (
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: c.muted }}>Dietary Needs (optional)</label>
                        <input className={inputClass} style={inputStyle} value={form.dietaryNeeds}
                          onChange={e => setForm(p => ({ ...p, dietaryNeeds: e.target.value }))}
                          onFocus={inputFocus} onBlur={inputBlur}
                          placeholder="Gluten-free, vegan, nut allergy..." />
                      </div>
                    )}

                    {config.allowSpecialRequests && (
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider mb-1.5" style={{ color: c.muted }}>Special Requests (optional)</label>
                        <textarea className={inputClass} style={{ ...inputStyle, resize: 'none' }} rows={3}
                          value={form.specialRequests}
                          onChange={e => setForm(p => ({ ...p, specialRequests: e.target.value }))}
                          onFocus={inputFocus} onBlur={inputBlur}
                          placeholder="High chair needed, birthday decoration, window seat preference..." />
                      </div>
                    )}

                    {config.depositRequired && config.depositAmount > 0 && (
                      <div className="p-4 rounded-xl text-sm" style={{ background: accent + '15', border: `1px solid ${accent}33`, color: accent }}>
                        <strong>Deposit required:</strong> ${config.depositAmount}
                        {config.depositNote && <p className="mt-1 text-xs opacity-80">{config.depositNote}</p>}
                      </div>
                    )}

                    {(config.cancellationPolicy || config.termsUrl) && (
                      <p className="text-xs leading-relaxed" style={{ color: c.muted }}>
                        {config.cancellationPolicy && <>{config.cancellationPolicy} </>}
                        {config.termsUrl && <a href={config.termsUrl} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: accent }}>Terms</a>}
                        {config.termsUrl && config.privacyUrl && ' · '}
                        {config.privacyUrl && <a href={config.privacyUrl} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: accent }}>Privacy</a>}
                      </p>
                    )}

                    <button onClick={handleSubmit} disabled={submitting}
                      className="w-full py-4 rounded-xl font-black text-base flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-60 mt-2"
                      style={{ background: accent, color: '#fff', boxShadow: `0 4px 24px ${accent}44` }}>
                      {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                      {config.confirmationMode === 'manual' ? 'Request Reservation' : 'Confirm Reservation'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Closed state */}
            {!config.acceptingReservations && (
              <div className="p-8 text-center" style={{ background: c.card }}>
                <UtensilsCrossed className="w-10 h-10 mx-auto mb-3 opacity-30" style={{ color: c.muted }} />
                <p className="text-sm font-semibold mb-1" style={{ color: c.text }}>Online bookings are currently closed</p>
                {config.phone && (
                  <p className="text-sm" style={{ color: c.muted }}>
                    Call us at <a href={`tel:${config.phone}`} className="underline font-semibold" style={{ color: accent }}>{config.phone}</a> to reserve
                  </p>
                )}
              </div>
            )}
          </div>

          {/* FAQ */}
          {config.faqItems?.length > 0 && (
            <div className="mt-6 rounded-2xl overflow-hidden" style={{ border: `1px solid ${c.border}` }}>
              <div className="px-6 py-4 border-b" style={{ background: c.card, borderColor: c.border }}>
                <h3 className="font-bold text-sm" style={{ color: c.text }}>Frequently Asked Questions</h3>
              </div>
              <div style={{ background: c.card }}>
                {config.faqItems.map((item, i) => (
                  <div key={i} className="border-b last:border-0" style={{ borderColor: c.border }}>
                    <button className="w-full flex items-center justify-between px-6 py-4 text-left hover:opacity-70 transition-opacity"
                      onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                      <span className="text-sm font-semibold pr-4" style={{ color: c.text }}>{item.question}</span>
                      <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} style={{ color: c.muted }} />
                    </button>
                    {openFaq === i && (
                      <div className="px-6 pb-4 text-sm leading-relaxed" style={{ color: c.muted }}>{item.answer}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      {config.showPoweredBy !== false && (
        <div className="text-center py-8 text-xs" style={{ color: isDark ? '#333' : '#ccc' }}>
          Powered by <a href="https://planitapp.onrender.com" className="hover:opacity-70" style={{ color: accent }}>PlanIt</a>
        </div>
      )}
    </div>
  );
}
