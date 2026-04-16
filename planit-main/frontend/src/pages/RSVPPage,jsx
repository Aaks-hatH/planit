import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Calendar, MapPin, Users, Clock, Check, X, Minus,
  ChevronRight, ChevronDown, ChevronUp, Plus, Trash2,
  Lock, AlertTriangle, Share2, Copy, ExternalLink,
  Shield, ArrowRight, User, Mail, Phone, MessageSquare,
  Heart, HelpCircle, Star
} from 'lucide-react';
import toast from 'react-hot-toast';
import { rsvpAPI } from '../services/api';
import { formatDateInTimezone } from '../utils/timezoneUtils';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/* ─── Font style map ──────────────────────────────────────────────────────── */
const FONTS = {
  modern:  { heading: 'font-bold tracking-tight',      body: 'font-normal' },
  classic: { heading: 'font-serif font-bold',           body: 'font-serif' },
  elegant: { heading: 'font-light tracking-widest uppercase', body: 'font-light tracking-wide' },
  bold:    { heading: 'font-black tracking-tight',      body: 'font-medium' },
};

/* ─── Background style map ────────────────────────────────────────────────── */
function getBgStyle(style, accent) {
  switch (style) {
    case 'light':    return { background: '#f9fafb', color: '#111827' };
    case 'gradient': return { background: `linear-gradient(135deg, #0f0f1a 0%, ${accent}22 50%, #0f0f1a 100%)`, color: '#fff' };
    case 'frosted':  return { background: 'rgba(15,15,26,0.95)', color: '#fff', backdropFilter: 'blur(20px)' };
    default:         return { background: '#0a0a12', color: '#fff' };
  }
}

/* ─── Countdown ───────────────────────────────────────────────────────────── */
function Countdown({ date, timezone, accent }) {
  const [parts, setParts] = useState({ d: 0, h: 0, m: 0, s: 0 });
  useEffect(() => {
    const tick = () => {
      const diff = new Date(date) - new Date();
      if (diff <= 0) { setParts({ d: 0, h: 0, m: 0, s: 0 }); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setParts({ d, h, m, s });
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [date]);

  return (
    <div className="flex gap-3 justify-center mt-4">
      {[['d', 'Days'], ['h', 'Hours'], ['m', 'Min'], ['s', 'Sec']].map(([k, label]) => (
        <div key={k} className="text-center">
          <div className="text-2xl font-black tabular-nums" style={{ color: accent }}>
            {String(parts[k]).padStart(2, '0')}
          </div>
          <div className="text-xs opacity-50 uppercase tracking-wider mt-0.5">{label}</div>
        </div>
      ))}
    </div>
  );
}

/* ─── Password gate ───────────────────────────────────────────────────────── */
function PasswordGate({ eventId, accent, bgStyle, fontStyle, onUnlocked }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const fonts = FONTS[fontStyle] || FONTS.modern;

  const submit = async (e) => {
    e.preventDefault();
    if (!pw.trim()) return;
    setLoading(true); setErr('');
    try {
      await rsvpAPI.verifyPassword(eventId, pw.trim());
      sessionStorage.setItem(`rsvp_pw_${eventId}`, pw.trim());
      onUnlocked(pw.trim());
    } catch {
      setErr('Incorrect password. Please try again.');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={getBgStyle(bgStyle, accent)}>
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: `${accent}22`, border: `1px solid ${accent}44` }}>
            <Lock style={{ color: accent }} className="w-7 h-7" />
          </div>
          <h2 className={`text-xl mb-2 ${fonts.heading}`}>This RSVP is password-protected</h2>
          <p className="text-sm opacity-50">Enter the password to view and RSVP to this event.</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <input
            type="password"
            value={pw}
            onChange={e => setPw(e.target.value)}
            placeholder="Enter password"
            className="w-full px-4 py-3 rounded-xl text-sm border outline-none transition-all"
            style={{
              background: 'rgba(255,255,255,0.06)',
              borderColor: err ? '#ef4444' : 'rgba(255,255,255,0.12)',
              color: 'inherit',
            }}
            autoFocus
          />
          {err && <p className="text-xs text-red-400">{err}</p>}
          <button type="submit" disabled={loading} className="w-full py-3 rounded-xl text-sm font-bold transition-all"
            style={{ background: accent, color: '#fff', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Verifying...' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}

/* ─── Confirmation screen ─────────────────────────────────────────────────── */
function ConfirmationScreen({ data, rsvpPage, event, editToken, accent, bgStyle, fontStyle }) {
  const fonts = FONTS[fontStyle] || FONTS.modern;
  const bg = getBgStyle(bgStyle, accent);
  const isLight = bgStyle === 'light';

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/rsvp/${event.subdomain}`);
    toast.success('Link copied!');
  };

  const addToCalendar = () => {
    if (!event.date) return;
    const d = new Date(event.date);
    const fmt = (dt) => dt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const end = new Date(d.getTime() + 2 * 3600000);
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.rawTitle || event.title)}&dates=${fmt(d)}/${fmt(end)}&location=${encodeURIComponent(event.location || '')}`;
    window.open(url, '_blank');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={bg}>
      <div className="w-full max-w-md text-center space-y-6">
        {/* Success icon */}
        <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto"
          style={{ background: `${accent}22`, border: `2px solid ${accent}` }}>
          <Check style={{ color: accent }} className="w-10 h-10" />
        </div>

        {/* Confirmation image */}
        {rsvpPage.confirmationImageUrl && (
          <img src={rsvpPage.confirmationImageUrl} alt="Confirmation" className="w-full max-h-48 object-cover rounded-2xl" />
        )}

        <div>
          <h1 className={`text-3xl mb-3 ${fonts.heading}`} style={{ color: isLight ? '#111' : '#fff' }}>
            {rsvpPage.confirmationTitle || (data.status === 'pending' ? 'Request Submitted' : data.waitlisted ? 'Added to Waitlist' : "You're on the list")}
          </h1>
          {data.waitlisted && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-3"
              style={{ background: '#f59e0b22', border: '1px solid #f59e0b44', color: '#f59e0b' }}>
              Waitlisted
            </div>
          )}
          {data.isPending && (
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-3"
              style={{ background: '#6366f122', border: '1px solid #6366f144', color: '#a5b4fc' }}>
              Pending Approval
            </div>
          )}
          <p className="text-sm leading-relaxed opacity-70" style={{ color: isLight ? '#374151' : undefined }}>
            {rsvpPage.confirmationMessage ||
              (data.status === 'pending'
                ? 'Your RSVP has been submitted and is awaiting approval from the organizer.'
                : data.waitlisted
                ? (rsvpPage.waitlistMessage || "You've been added to the waitlist. We'll notify you if a spot opens up.")
                : 'Your RSVP has been confirmed. We look forward to seeing you!')}
          </p>
        </div>

        {/* Action buttons */}
        <div className="space-y-2.5">
          {rsvpPage.showAddToCalendar !== false && event.date && (
            <button onClick={addToCalendar}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
              style={{ background: accent, color: '#fff' }}>
              <Calendar className="w-4 h-4" /> Add to Calendar
            </button>
          )}
          {rsvpPage.showEventSpaceButton && event.subdomain && (
            <a href={`/e/${event.subdomain}`}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'inherit' }}>
              {rsvpPage.eventSpaceButtonLabel || 'View Event Details'} <ArrowRight className="w-4 h-4" />
            </a>
          )}
          {rsvpPage.showShareButton !== false && (
            <button onClick={copyLink}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'inherit' }}>
              <Share2 className="w-4 h-4" /> Share Event
            </button>
          )}
          {rsvpPage.allowGuestEdit !== false && editToken && (
            <a href={`/rsvp/manage/${editToken}`}
              className="block text-center text-xs opacity-50 hover:opacity-70 transition-opacity mt-2">
              View or edit your RSVP
            </a>
          )}
        </div>

        {/* PlanIt branding */}
        {!rsvpPage.hideBranding && (
          <p className="text-xs opacity-30 mt-6">
            Powered by <a href="/" className="underline hover:opacity-60">PlanIt</a>
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── Main RSVP Form ──────────────────────────────────────────────────────── */
export default function RSVPPage() {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [pageData, setPageData]   = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [pwUnlocked, setPwUnlocked] = useState(false);
  const [unlockedPw, setUnlockedPw] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [response, setResponse]   = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName]   = useState('');
  const [email, setEmail]         = useState('');
  const [phone, setPhone]         = useState('');
  const [plusOnes, setPlusOnes]   = useState(0);
  const [plusOneDetails, setPlusOneDetails] = useState([]);
  const [dietary, setDietary]     = useState('');
  const [accessibility, setAccessibility] = useState('');
  const [guestNote, setGuestNote] = useState('');
  const [customAnswers, setCustomAnswers] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [expandedSection, setExpandedSection] = useState('info');

  useEffect(() => { loadPage(); }, [slug]);

  const loadPage = async () => {
    try {
      const res = await rsvpAPI.getPage(slug);
      setPageData(res.data);
      // Check session-cached password
      if (res.data.requiresPassword) {
        const cached = sessionStorage.getItem(`rsvp_pw_${res.data.eventId}`);
        if (cached) { setPwUnlocked(true); setUnlockedPw(cached); }
      }
    } catch {
      setError('Event not found or RSVP is not available.');
    } finally { setLoading(false); }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a12' }}>
        <div className="w-8 h-8 border-2 border-white/20 border-t-white/80 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !pageData) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a12', color: '#fff' }}>
        <div className="text-center space-y-3">
          <AlertTriangle className="w-10 h-10 mx-auto opacity-40" />
          <p className="text-sm opacity-50">{error || 'RSVP page not found.'}</p>
          <a href="/" className="text-xs underline opacity-30">Return home</a>
        </div>
      </div>
    );
  }

  const { rsvpPage, eventId, subdomain, title, rawTitle, description, date, timezone, location, organizerName, counts, spotsLeft, isFull, deadlinePast } = pageData;
  const accent    = rsvpPage.accentColor || '#6366f1';
  const bgStyle   = rsvpPage.backgroundStyle || 'dark';
  const fontStyle = rsvpPage.fontStyle || 'modern';
  const fonts     = FONTS[fontStyle] || FONTS.modern;
  const bg        = getBgStyle(bgStyle, accent);
  const isLight   = bgStyle === 'light';
  const textMuted = isLight ? 'text-gray-500' : 'text-white/50';
  const textMain  = isLight ? 'text-gray-900' : 'text-white';
  const cardBg    = isLight ? 'bg-white border border-gray-200' : 'bg-white/[0.04] border border-white/10';
  const inputCls  = `w-full px-4 py-3 rounded-xl text-sm border outline-none transition-all ${isLight ? 'bg-white border-gray-200 focus:border-gray-400 text-gray-900' : 'bg-white/[0.06] border-white/10 focus:border-white/30 text-white placeholder-white/30'}`;

  // Password gate
  if (rsvpPage.accessMode === 'password' && !pwUnlocked) {
    return (
      <PasswordGate
        eventId={eventId}
        accent={accent}
        bgStyle={bgStyle}
        fontStyle={fontStyle}
        onUnlocked={(pw) => { setPwUnlocked(true); setUnlockedPw(pw); }}
      />
    );
  }

  // Closed
  if (!rsvpPage.enabled || rsvpPage.accessMode === 'closed') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={bg}>
        <div className="text-center space-y-3 max-w-sm">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
            style={{ background: `${accent}22`, border: `1px solid ${accent}44` }}>
            <X style={{ color: accent }} className="w-6 h-6" />
          </div>
          <h2 className={`text-xl ${fonts.heading}`}>RSVPs are closed</h2>
          <p className={`text-sm ${textMuted}`}>This event is no longer accepting RSVPs.</p>
        </div>
      </div>
    );
  }

  // Submitted
  if (submitted && submitResult) {
    return (
      <ConfirmationScreen
        data={submitResult}
        rsvpPage={rsvpPage}
        event={pageData}
        editToken={submitResult.editToken}
        accent={accent}
        bgStyle={bgStyle}
        fontStyle={fontStyle}
      />
    );
  }

  // ── Validation + submit ──────────────────────────────────────────────────
  const validate = () => {
    const errs = {};
    if (!response) errs.response = 'Please select your attendance status.';
    if (!firstName.trim()) errs.firstName = 'First name is required.';
    if (rsvpPage.requireLastName && !lastName.trim()) errs.lastName = 'Last name is required.';
    if (rsvpPage.requireEmail && !email.trim()) errs.email = 'Email address is required.';
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Please enter a valid email.';
    if (rsvpPage.requirePhone && !phone.trim()) errs.phone = 'Phone number is required.';
    // Custom required questions
    (rsvpPage.customQuestions || []).forEach(q => {
      if (q.required && (!customAnswers[q.id] || customAnswers[q.id] === '')) {
        errs[`q_${q.id}`] = 'This field is required.';
      }
    });
    return errs;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setFieldErrors(errs); return; }
    setSubmitting(true);
    try {
      const answersArr = Object.entries(customAnswers).map(([questionId, answer]) => {
        const q = (rsvpPage.customQuestions || []).find(q => q.id === questionId);
        return { questionId, question: q?.label || '', answer };
      });
      const res = await rsvpAPI.submit(slug, {
        response,
        firstName: firstName.trim(),
        lastName:  lastName.trim(),
        email:     email.trim(),
        phone:     phone.trim(),
        plusOnes,
        plusOneDetails,
        dietaryRestrictions: dietary,
        accessibilityNeeds:  accessibility,
        customAnswers: answersArr,
        guestNote,
        pagePassword: unlockedPw || undefined,
        _hp: '',  // honeypot field — bots fill this, humans don't
      });
      setSubmitResult(res.data);
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to submit. Please try again.';
      toast.error(msg);
    } finally { setSubmitting(false); }
  };

  const setCustomAnswer = (id, value) => {
    setCustomAnswers(prev => ({ ...prev, [id]: value }));
    if (fieldErrors[`q_${id}`]) setFieldErrors(prev => { const n = {...prev}; delete n[`q_${id}`]; return n; });
  };

  const addPlusOne = () => {
    if (plusOnes >= (rsvpPage.maxPlusOnes || 5)) return;
    setPlusOnes(n => n + 1);
    if (rsvpPage.requirePlusOneNames) {
      setPlusOneDetails(prev => [...prev, { firstName: '', lastName: '', dietary: '' }]);
    }
  };
  const removePlusOne = () => {
    if (plusOnes <= 0) return;
    setPlusOnes(n => n - 1);
    setPlusOneDetails(prev => prev.slice(0, -1));
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={bg}>

      {/* Announcement banner */}
      {rsvpPage.bannerEnabled && rsvpPage.bannerText && (
        <div className="sticky top-0 z-20 text-center text-xs font-semibold py-2.5 px-4"
          style={{ background: rsvpPage.bannerColor, color: '#000' }}>
          {rsvpPage.bannerText}
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">

        {/* Header */}
        <div className="text-center space-y-4 pb-2">
          {rsvpPage.logoUrl && (
            <img src={rsvpPage.logoUrl} alt="Logo" className="h-12 object-contain mx-auto" />
          )}
          {rsvpPage.coverImageUrl && (
            <div className="w-full aspect-video rounded-2xl overflow-hidden">
              <img src={rsvpPage.coverImageUrl} alt="Event cover" className="w-full h-full object-cover" />
            </div>
          )}
          {rsvpPage.heroTagline && (
            <p className={`text-xs font-semibold tracking-[0.2em] uppercase ${textMuted}`}>{rsvpPage.heroTagline}</p>
          )}
          <h1 className={`text-3xl sm:text-4xl leading-tight ${fonts.heading}`} style={{ color: isLight ? '#111' : '#fff' }}>
            {rsvpPage.welcomeTitle || title}
          </h1>
          {rsvpPage.welcomeMessage && (
            <p className={`text-sm leading-relaxed max-w-lg mx-auto ${textMuted}`} style={{ whiteSpace: 'pre-wrap' }}>
              {rsvpPage.welcomeMessage}
            </p>
          )}
        </div>

        {/* Event details card */}
        <div className={`rounded-2xl p-4 space-y-2.5 ${cardBg}`}>
          {rsvpPage.showEventDate !== false && date && (
            <div className="flex items-center gap-3">
              <Calendar className={`w-4 h-4 flex-shrink-0 ${textMuted}`} />
              <span className={`text-sm ${textMain}`}>
                {formatDateInTimezone(date, timezone || 'UTC', 'MMMM d, yyyy — h:mm a zzz')}
              </span>
            </div>
          )}
          {rsvpPage.showEventLocation !== false && location && (
            <div className="flex items-center gap-3">
              <MapPin className={`w-4 h-4 flex-shrink-0 ${textMuted}`} />
              <span className={`text-sm ${textMain}`}>{location}</span>
            </div>
          )}
          {rsvpPage.showHostName !== false && organizerName && (
            <div className="flex items-center gap-3">
              <User className={`w-4 h-4 flex-shrink-0 ${textMuted}`} />
              <span className={`text-sm ${textMain}`}>Hosted by {organizerName}</span>
            </div>
          )}
          {rsvpPage.showGuestCount !== false && counts && (
            <div className="flex items-center gap-3">
              <Users className={`w-4 h-4 flex-shrink-0 ${textMuted}`} />
              <span className={`text-sm ${textMain}`}>
                {counts.yes} attending
                {counts.maybe > 0 && ` · ${counts.maybe} maybe`}
                {spotsLeft !== null && spotsLeft <= 20 && (
                  <span className="ml-2 text-amber-400 font-semibold">
                    {spotsLeft === 0 ? 'Full' : `${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} left`}
                  </span>
                )}
              </span>
            </div>
          )}
          {rsvpPage.showEventDescription !== false && description && (
            <p className={`text-sm leading-relaxed pt-1 border-t ${isLight ? 'border-gray-100 text-gray-600' : 'border-white/10 text-white/60'}`}>
              {description}
            </p>
          )}
        </div>

        {/* Countdown */}
        {rsvpPage.showCountdown && date && (
          <div className={`rounded-2xl p-4 text-center ${cardBg}`}>
            <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${textMuted}`}>Event starts in</p>
            <Countdown date={date} timezone={timezone} accent={accent} />
          </div>
        )}

        {/* Deadline warning */}
        {deadlinePast && (
          <div className="flex items-center gap-3 p-4 rounded-2xl" style={{ background: '#ef444422', border: '1px solid #ef444444' }}>
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-400">RSVP deadline has passed</p>
              <p className="text-xs text-red-400/70 mt-0.5">{rsvpPage.deadlineMessage || 'This event is no longer accepting RSVPs.'}</p>
            </div>
          </div>
        )}

        {/* Capacity full warning */}
        {isFull && rsvpPage.enableWaitlist === false && (
          <div className="flex items-center gap-3 p-4 rounded-2xl" style={{ background: '#f59e0b22', border: '1px solid #f59e0b44' }}>
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <p className="text-sm text-amber-400">This event has reached capacity.</p>
          </div>
        )}

        {/* RSVP Form */}
        {!deadlinePast && (
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Response selection */}
            <div className={`rounded-2xl p-5 space-y-4 ${cardBg}`}>
              <p className={`text-xs font-bold uppercase tracking-widest ${textMuted}`}>Your Response</p>
              {fieldErrors.response && (
                <p className="text-xs text-red-400">{fieldErrors.response}</p>
              )}
              <div className="flex flex-col sm:flex-row gap-2.5">
                {rsvpPage.allowYes !== false && (
                  <ResponseButton
                    active={response === 'yes'}
                    disabled={(isFull && rsvpPage.enableWaitlist === false)}
                    onClick={() => { setResponse('yes'); if (fieldErrors.response) setFieldErrors(p => ({...p, response: ''})); }}
                    icon={<Check className="w-4 h-4" />}
                    label={rsvpPage.yesButtonLabel || 'Attending'}
                    activeColor={accent}
                    isLight={isLight}
                    note={isFull && rsvpPage.enableWaitlist !== false ? '(joins waitlist)' : undefined}
                  />
                )}
                {rsvpPage.allowMaybe !== false && (
                  <ResponseButton
                    active={response === 'maybe'}
                    onClick={() => { setResponse('maybe'); if (fieldErrors.response) setFieldErrors(p => ({...p, response: ''})); }}
                    icon={<HelpCircle className="w-4 h-4" />}
                    label={rsvpPage.maybeButtonLabel || 'Maybe'}
                    activeColor="#f59e0b"
                    isLight={isLight}
                  />
                )}
                {rsvpPage.allowNo !== false && (
                  <ResponseButton
                    active={response === 'no'}
                    onClick={() => { setResponse('no'); if (fieldErrors.response) setFieldErrors(p => ({...p, response: ''})); }}
                    icon={<X className="w-4 h-4" />}
                    label={rsvpPage.noButtonLabel || 'Not Attending'}
                    activeColor="#ef4444"
                    isLight={isLight}
                  />
                )}
              </div>
            </div>

            {/* Guest information */}
            {response && (
              <div className={`rounded-2xl overflow-hidden ${cardBg}`}>
                <button type="button"
                  className={`w-full flex items-center justify-between p-5 text-left ${isLight ? 'hover:bg-gray-50' : 'hover:bg-white/[0.02]'} transition-colors`}
                  onClick={() => setExpandedSection(expandedSection === 'info' ? '' : 'info')}>
                  <span className={`text-xs font-bold uppercase tracking-widest ${textMuted}`}>Your Information</span>
                  {expandedSection === 'info' ? <ChevronUp className={`w-4 h-4 ${textMuted}`} /> : <ChevronDown className={`w-4 h-4 ${textMuted}`} />}
                </button>

                {expandedSection === 'info' && (
                  <div className="px-5 pb-5 space-y-3">
                    {/* Name */}
                    <div className={`grid gap-3 ${rsvpPage.requireLastName ? 'grid-cols-2' : 'grid-cols-1'}`}>
                      <div>
                        <label className={`block text-xs font-medium mb-1.5 ${textMuted}`}>
                          First Name {rsvpPage.requireFirstName !== false && <span className="text-red-400">*</span>}
                        </label>
                        <input type="text" value={firstName} onChange={e => { setFirstName(e.target.value); setFieldErrors(p => ({...p, firstName: ''})); }}
                          placeholder="First name" className={inputCls} style={fieldErrors.firstName ? { borderColor: '#ef4444' } : {}} />
                        {fieldErrors.firstName && <p className="text-xs text-red-400 mt-1">{fieldErrors.firstName}</p>}
                      </div>
                      {rsvpPage.requireLastName && (
                        <div>
                          <label className={`block text-xs font-medium mb-1.5 ${textMuted}`}>Last Name <span className="text-red-400">*</span></label>
                          <input type="text" value={lastName} onChange={e => { setLastName(e.target.value); setFieldErrors(p => ({...p, lastName: ''})); }}
                            placeholder="Last name" className={inputCls} style={fieldErrors.lastName ? { borderColor: '#ef4444' } : {}} />
                          {fieldErrors.lastName && <p className="text-xs text-red-400 mt-1">{fieldErrors.lastName}</p>}
                        </div>
                      )}
                    </div>

                    {/* Email */}
                    {rsvpPage.collectEmail !== false && (
                      <div>
                        <label className={`block text-xs font-medium mb-1.5 ${textMuted}`}>
                          Email {rsvpPage.requireEmail && <span className="text-red-400">*</span>}
                        </label>
                        <input type="email" value={email} onChange={e => { setEmail(e.target.value); setFieldErrors(p => ({...p, email: ''})); }}
                          placeholder="your@email.com" className={inputCls} style={fieldErrors.email ? { borderColor: '#ef4444' } : {}} />
                        {fieldErrors.email && <p className="text-xs text-red-400 mt-1">{fieldErrors.email}</p>}
                      </div>
                    )}

                    {/* Phone */}
                    {rsvpPage.collectPhone && (
                      <div>
                        <label className={`block text-xs font-medium mb-1.5 ${textMuted}`}>
                          Phone {rsvpPage.requirePhone && <span className="text-red-400">*</span>}
                        </label>
                        <input type="tel" value={phone} onChange={e => { setPhone(e.target.value); setFieldErrors(p => ({...p, phone: ''})); }}
                          placeholder="+1 (555) 000-0000" className={inputCls} style={fieldErrors.phone ? { borderColor: '#ef4444' } : {}} />
                        {fieldErrors.phone && <p className="text-xs text-red-400 mt-1">{fieldErrors.phone}</p>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Plus-ones */}
            {response && rsvpPage.allowPlusOnes && (
              <div className={`rounded-2xl overflow-hidden ${cardBg}`}>
                <button type="button"
                  className={`w-full flex items-center justify-between p-5 text-left ${isLight ? 'hover:bg-gray-50' : 'hover:bg-white/[0.02]'} transition-colors`}
                  onClick={() => setExpandedSection(expandedSection === 'plusones' ? '' : 'plusones')}>
                  <div>
                    <span className={`text-xs font-bold uppercase tracking-widest ${textMuted}`}>Additional Guests</span>
                    {plusOnes > 0 && (
                      <span className="ml-2 text-xs font-semibold" style={{ color: accent }}>+{plusOnes}</span>
                    )}
                  </div>
                  {expandedSection === 'plusones' ? <ChevronUp className={`w-4 h-4 ${textMuted}`} /> : <ChevronDown className={`w-4 h-4 ${textMuted}`} />}
                </button>
                {expandedSection === 'plusones' && (
                  <div className="px-5 pb-5 space-y-4">
                    <div className="flex items-center gap-4">
                      <button type="button" onClick={removePlusOne} disabled={plusOnes <= 0}
                        className="w-9 h-9 rounded-xl flex items-center justify-center border transition-all disabled:opacity-30"
                        style={{ borderColor: 'rgba(255,255,255,0.12)' }}>
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className={`text-lg font-bold w-8 text-center ${textMain}`}>{plusOnes}</span>
                      <button type="button" onClick={addPlusOne} disabled={plusOnes >= (rsvpPage.maxPlusOnes || 5)}
                        className="w-9 h-9 rounded-xl flex items-center justify-center border transition-all disabled:opacity-30"
                        style={{ borderColor: 'rgba(255,255,255,0.12)', background: `${accent}22` }}>
                        <Plus className="w-4 h-4" style={{ color: accent }} />
                      </button>
                      <span className={`text-xs ${textMuted}`}>of {rsvpPage.maxPlusOnes || 5} max</span>
                    </div>
                    {/* Plus-one details */}
                    {rsvpPage.requirePlusOneNames && plusOneDetails.map((po, i) => (
                      <div key={i} className="space-y-2 pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                        <p className={`text-xs font-semibold ${textMuted}`}>Guest {i + 1}</p>
                        <div className="grid grid-cols-2 gap-2">
                          <input type="text" value={po.firstName} onChange={e => {
                            const d = [...plusOneDetails]; d[i] = {...d[i], firstName: e.target.value}; setPlusOneDetails(d);
                          }} placeholder="First name" className={inputCls} />
                          <input type="text" value={po.lastName} onChange={e => {
                            const d = [...plusOneDetails]; d[i] = {...d[i], lastName: e.target.value}; setPlusOneDetails(d);
                          }} placeholder="Last name" className={inputCls} />
                        </div>
                        {rsvpPage.collectPlusOneDietary && (
                          <input type="text" value={po.dietary} onChange={e => {
                            const d = [...plusOneDetails]; d[i] = {...d[i], dietary: e.target.value}; setPlusOneDetails(d);
                          }} placeholder="Dietary requirements" className={inputCls} />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Dietary & accessibility */}
            {response && (rsvpPage.collectDietary || rsvpPage.collectAccessibility || rsvpPage.allowGuestNote) && (
              <div className={`rounded-2xl overflow-hidden ${cardBg}`}>
                <button type="button"
                  className={`w-full flex items-center justify-between p-5 text-left ${isLight ? 'hover:bg-gray-50' : 'hover:bg-white/[0.02]'} transition-colors`}
                  onClick={() => setExpandedSection(expandedSection === 'extra' ? '' : 'extra')}>
                  <span className={`text-xs font-bold uppercase tracking-widest ${textMuted}`}>Additional Details</span>
                  {expandedSection === 'extra' ? <ChevronUp className={`w-4 h-4 ${textMuted}`} /> : <ChevronDown className={`w-4 h-4 ${textMuted}`} />}
                </button>
                {expandedSection === 'extra' && (
                  <div className="px-5 pb-5 space-y-3">
                    {rsvpPage.collectDietary && (
                      <div>
                        <label className={`block text-xs font-medium mb-1.5 ${textMuted}`}>{rsvpPage.dietaryLabel || 'Dietary requirements'}</label>
                        <textarea value={dietary} onChange={e => setDietary(e.target.value)} rows={2}
                          placeholder="e.g. vegetarian, gluten-free, nut allergy" className={`${inputCls} resize-none`} />
                      </div>
                    )}
                    {rsvpPage.collectAccessibility && (
                      <div>
                        <label className={`block text-xs font-medium mb-1.5 ${textMuted}`}>{rsvpPage.accessibilityLabel || 'Accessibility needs'}</label>
                        <textarea value={accessibility} onChange={e => setAccessibility(e.target.value)} rows={2}
                          placeholder="e.g. wheelchair access, hearing loop" className={`${inputCls} resize-none`} />
                      </div>
                    )}
                    {rsvpPage.allowGuestNote && (
                      <div>
                        <label className={`block text-xs font-medium mb-1.5 ${textMuted}`}>{rsvpPage.guestNoteLabel || 'Additional notes'}</label>
                        <textarea value={guestNote} onChange={e => setGuestNote(e.target.value)} rows={3}
                          placeholder={rsvpPage.guestNotePlaceholder || ''}
                          className={`${inputCls} resize-none`} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Custom questions */}
            {response && (rsvpPage.customQuestions || []).length > 0 && (
              <div className={`rounded-2xl overflow-hidden ${cardBg}`}>
                <button type="button"
                  className={`w-full flex items-center justify-between p-5 text-left ${isLight ? 'hover:bg-gray-50' : 'hover:bg-white/[0.02]'} transition-colors`}
                  onClick={() => setExpandedSection(expandedSection === 'custom' ? '' : 'custom')}>
                  <span className={`text-xs font-bold uppercase tracking-widest ${textMuted}`}>More Information</span>
                  {expandedSection === 'custom' ? <ChevronUp className={`w-4 h-4 ${textMuted}`} /> : <ChevronDown className={`w-4 h-4 ${textMuted}`} />}
                </button>
                {expandedSection === 'custom' && (
                  <div className="px-5 pb-5 space-y-4">
                    {[...(rsvpPage.customQuestions || [])].sort((a, b) => (a.order || 0) - (b.order || 0)).map(q => (
                      <CustomQuestion
                        key={q.id}
                        question={q}
                        value={customAnswers[q.id]}
                        onChange={(v) => setCustomAnswer(q.id, v)}
                        error={fieldErrors[`q_${q.id}`]}
                        inputCls={inputCls}
                        textMuted={textMuted}
                        textMain={textMain}
                        accent={accent}
                        isLight={isLight}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Honeypot field (hidden from real users) */}
            <input type="text" name="_hp" tabIndex={-1} className="sr-only" autoComplete="off"
              onChange={() => {}} />

            {/* Submit */}
            {response && (
              <button type="submit" disabled={submitting}
                className="w-full py-4 rounded-2xl text-sm font-bold transition-all hover:opacity-90 flex items-center justify-center gap-2"
                style={{ background: accent, color: '#fff', opacity: submitting ? 0.7 : 1 }}>
                {submitting ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting...</>
                ) : (
                  <>Submit RSVP <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            )}
          </form>
        )}

        {/* Link to event space */}
        {rsvpPage.showEventSpaceButton && (
          <div className="text-center">
            <a href={`/e/${subdomain}`} className={`text-xs underline ${textMuted} hover:opacity-80 transition-opacity`}>
              View event space instead
            </a>
          </div>
        )}

        {/* PlanIt branding + enter event link */}
        <div className="text-center space-y-2 pb-4">
          <p className={`text-xs ${textMuted}`} style={{ opacity: 0.3 }}>
            {!rsvpPage.hideBranding && (
              <>Powered by <a href="/" className="underline hover:opacity-60">PlanIt</a> · </>
            )}
            <a href={`/e/${subdomain}`} className="underline hover:opacity-60">Event Space</a>
          </p>
        </div>

      </div>
    </div>
  );
}

/* ─── Response button sub-component ──────────────────────────────────────── */
function ResponseButton({ active, onClick, icon, label, activeColor, isLight, disabled, note }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="flex-1 flex items-center justify-center gap-2.5 py-4 rounded-xl border-2 text-sm font-semibold transition-all"
      style={{
        borderColor: active ? activeColor : (isLight ? '#e5e7eb' : 'rgba(255,255,255,0.12)'),
        background:  active ? `${activeColor}18` : 'transparent',
        color:       active ? activeColor : (isLight ? '#374151' : 'rgba(255,255,255,0.6)'),
        opacity:     disabled ? 0.4 : 1,
      }}>
      {icon}
      <span>{label}</span>
      {note && <span className="text-xs font-normal opacity-60">{note}</span>}
    </button>
  );
}

/* ─── Custom question renderer ────────────────────────────────────────────── */
function CustomQuestion({ question, value, onChange, error, inputCls, textMuted, textMain, accent, isLight }) {
  const { id, label, type, required, options, placeholder, helpText } = question;

  return (
    <div>
      <label className={`block text-xs font-medium mb-1.5 ${textMuted}`}>
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {helpText && <p className={`text-xs mb-2 ${textMuted}`} style={{ opacity: 0.6 }}>{helpText}</p>}

      {type === 'text' && (
        <input type="text" value={value || ''} onChange={e => onChange(e.target.value)}
          placeholder={placeholder || ''} className={inputCls} style={error ? { borderColor: '#ef4444' } : {}} />
      )}
      {type === 'textarea' && (
        <textarea value={value || ''} onChange={e => onChange(e.target.value)} rows={3}
          placeholder={placeholder || ''} className={`${inputCls} resize-none`} style={error ? { borderColor: '#ef4444' } : {}} />
      )}
      {type === 'select' && (
        <select value={value || ''} onChange={e => onChange(e.target.value)} className={inputCls}
          style={{ ...(error ? { borderColor: '#ef4444' } : {}), background: isLight ? '#fff' : 'rgba(255,255,255,0.06)' }}>
          <option value="">Select an option…</option>
          {(options || []).map((o, i) => <option key={i} value={o}>{o}</option>)}
        </select>
      )}
      {type === 'radio' && (
        <div className="space-y-2">
          {(options || []).map((o, i) => (
            <label key={i} className="flex items-center gap-3 cursor-pointer group">
              <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all"
                style={{ borderColor: value === o ? accent : 'rgba(255,255,255,0.2)' }}
                onClick={() => onChange(o)}>
                {value === o && <div className="w-2 h-2 rounded-full" style={{ background: accent }} />}
              </div>
              <span className={`text-sm ${textMain}`}>{o}</span>
            </label>
          ))}
        </div>
      )}
      {type === 'checkbox' && (
        <div className="space-y-2">
          {(options || []).map((o, i) => {
            const selected = Array.isArray(value) ? value.includes(o) : false;
            return (
              <label key={i} className="flex items-center gap-3 cursor-pointer group">
                <div className="w-4 h-4 rounded border-2 flex items-center justify-center transition-all"
                  style={{ borderColor: selected ? accent : 'rgba(255,255,255,0.2)', background: selected ? accent : 'transparent' }}
                  onClick={() => {
                    const cur = Array.isArray(value) ? value : [];
                    onChange(selected ? cur.filter(x => x !== o) : [...cur, o]);
                  }}>
                  {selected && <Check className="w-2.5 h-2.5 text-white" />}
                </div>
                <span className={`text-sm ${textMain}`}>{o}</span>
              </label>
            );
          })}
        </div>
      )}
      {type === 'number' && (
        <input type="number" value={value || ''} onChange={e => onChange(e.target.value)}
          placeholder={placeholder || ''} className={inputCls} style={error ? { borderColor: '#ef4444' } : {}} />
      )}
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}
