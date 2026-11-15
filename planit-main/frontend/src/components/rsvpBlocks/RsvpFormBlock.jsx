/**
 * frontend/src/components/rsvpBlocks/RsvpFormBlock.jsx
 *
 * The one block in the library with real behavior instead of pure
 * presentation — imported directly by RSVPPageRenderer.jsx (not through
 * BLOCK_COMPONENTS) and always pinned last.
 *
 * This is a line-for-line port of the form state/handlers that used to live
 * directly inside RSVPPage.jsx (validate, handleSubmit, plus-one add/remove,
 * the abuse/verification flow, and the existing seating table-picker for
 * events with seatingMap enabled). Nothing about *how* a submission behaves
 * changed — only where the JSX lives and which visual tokens it pulls from
 * (the shared theme.js instead of RSVPPage.jsx's now-removed local copies).
 *
 * Two modes:
 *  - Live (pageData has real eventId/counts/etc, i.e. rendered from the
 *    public RSVPPage.jsx): fully wired, submits for real.
 *  - Preview (pageData is null/incomplete, i.e. rendered inside the
 *    builder's live preview pane): renders the same layout with the form
 *    disabled, no network calls — organizers see exactly what guests will
 *    see without being able to accidentally submit a real RSVP from the
 *    builder.
 */
import { useState, useRef } from 'react';
import {
  Check, X, Minus, Plus, ChevronDown, ChevronUp, HelpCircle,
  ArrowRight, AlertTriangle, User,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { rsvpAPI } from '../../services/api';
import { trackGAEvent } from '../../services/analytics';
import TurnstileWidget from '../TurnstileWidget';
import GuestSeatPicker from '../GuestSeatPicker';
import { spacingClass, alignClass } from './theme';

function ResponseButton({ active, onClick, icon, label, activeColor, isLight, disabled, note }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className="flex-1 flex items-center justify-center gap-2.5 py-4 rounded-xl border-2 text-sm font-semibold transition-all"
      style={{
        borderColor: active ? activeColor : (isLight ? '#e5e7eb' : 'rgba(255,255,255,0.12)'),
        background: active ? `${activeColor}18` : 'transparent',
        color: active ? activeColor : (isLight ? '#374151' : 'rgba(255,255,255,0.6)'),
        opacity: disabled ? 0.4 : 1,
      }}>
      {icon}<span>{label}</span>
      {note && <span className="text-xs font-normal opacity-60">{note}</span>}
    </button>
  );
}

function CustomQuestion({ question, value, onChange, error, inputCls, textMuted, textMain, accent, isLight }) {
  const { label, type, required, options, placeholder, helpText } = question;
  return (
    <div>
      <label className={`block text-xs font-medium mb-1.5 ${textMuted}`}>{label} {required && <span className="text-red-400">*</span>}</label>
      {helpText && <p className={`text-xs mb-2 ${textMuted}`} style={{ opacity: 0.6 }}>{helpText}</p>}
      {type === 'text' && <input type="text" value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder || ''} className={inputCls} style={error ? { borderColor: '#ef4444' } : {}} />}
      {type === 'textarea' && <textarea value={value || ''} onChange={(e) => onChange(e.target.value)} rows={3} placeholder={placeholder || ''} className={`${inputCls} resize-none`} style={error ? { borderColor: '#ef4444' } : {}} />}
      {type === 'select' && (
        <select value={value || ''} onChange={(e) => onChange(e.target.value)} className={inputCls} style={{ ...(error ? { borderColor: '#ef4444' } : {}), background: isLight ? '#fff' : 'rgba(255,255,255,0.06)' }}>
          <option value="">Select an option…</option>
          {(options || []).map((o, i) => <option key={i} value={o}>{o}</option>)}
        </select>
      )}
      {type === 'radio' && (
        <div className="space-y-2">
          {(options || []).map((o, i) => (
            <label key={i} className="flex items-center gap-3 cursor-pointer group">
              <div className="w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all" style={{ borderColor: value === o ? accent : 'rgba(255,255,255,0.2)' }} onClick={() => onChange(o)}>
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
                <div className="w-4 h-4 rounded border-2 flex items-center justify-center transition-all" style={{ borderColor: selected ? accent : 'rgba(255,255,255,0.2)', background: selected ? accent : 'transparent' }}
                  onClick={() => { const cur = Array.isArray(value) ? value : []; onChange(selected ? cur.filter((x) => x !== o) : [...cur, o]); }}>
                  {selected && <Check className="w-2.5 h-2.5 text-white" />}
                </div>
                <span className={`text-sm ${textMain}`}>{o}</span>
              </label>
            );
          })}
        </div>
      )}
      {type === 'number' && <input type="number" value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder || ''} className={inputCls} style={error ? { borderColor: '#ef4444' } : {}} />}
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}

/** Renders the layout with everything disabled — used inside the builder preview, where there's no real pageData to submit against. */
function PreviewForm({ flatSettings, accent, fonts, isLight, cardBg, textMuted }) {
  return (
    <div className={`rounded-2xl p-5 space-y-4 ${cardBg} opacity-90`}>
      <p className={`text-xs font-bold uppercase tracking-widest ${textMuted}`}>Your Response</p>
      <div className="flex flex-col sm:flex-row gap-2.5">
        {flatSettings?.allowYes !== false && <ResponseButton active={false} onClick={() => {}} icon={<Check className="w-4 h-4" />} label={flatSettings?.yesButtonLabel || 'Attending'} activeColor={accent} isLight={isLight} disabled />}
        {flatSettings?.allowMaybe !== false && <ResponseButton active={false} onClick={() => {}} icon={<HelpCircle className="w-4 h-4" />} label={flatSettings?.maybeButtonLabel || 'Maybe'} activeColor="#f59e0b" isLight={isLight} disabled />}
        {flatSettings?.allowNo !== false && <ResponseButton active={false} onClick={() => {}} icon={<X className="w-4 h-4" />} label={flatSettings?.noButtonLabel || 'Not Attending'} activeColor="#ef4444" isLight={isLight} disabled />}
      </div>
      <p className="text-xs opacity-40 italic">Guests will fill in their details and submit here. This preview is read-only.</p>
    </div>
  );
}

export default function RsvpFormBlock({ pageData, slug, unlockedPw, accent, fonts, isLight, spacing = 'default', align = 'center', onSubmitted }) {
  const flatSettings = pageData?.rsvpPage || {};
  const isLive = !!pageData?.eventId;

  const textMuted = isLight ? 'text-gray-500' : 'text-white/50';
  const textMain = isLight ? 'text-gray-900' : 'text-white';
  const cardBg = isLight ? 'bg-white border border-gray-200' : 'bg-white/[0.04] border border-white/10';
  const inputCls = `w-full px-4 py-3 rounded-xl text-sm border outline-none transition-all ${isLight ? 'bg-white border-gray-200 focus:border-gray-400 text-gray-900' : 'bg-white/[0.06] border-white/10 focus:border-white/30 text-white placeholder-white/30'}`;

  const [response, setResponse] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [plusOnes, setPlusOnes] = useState(0);
  const [plusOneDetails, setPlusOneDetails] = useState([]);
  const [dietary, setDietary] = useState('');
  const [accessibility, setAccessibility] = useState('');
  const [guestNote, setGuestNote] = useState('');
  const [selectedTableId, setSelectedTableId] = useState(null);
  const [customAnswers, setCustomAnswers] = useState({});
  const [fieldErrors, setFieldErrors] = useState({});
  const [expandedSection, setExpandedSection] = useState('info');
  const [abuseStatus, setAbuseStatus] = useState(null);
  const [requiresVerification, setRequiresVerification] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const timingRef = useRef({ pageLoadedAt: Date.now(), formStartedAt: 0, firstInputAt: 0, largestPasteChars: 0, largestPasteElapsedMs: 0 });

  if (!isLive) {
    return (
      <div className={`w-full px-6 md:px-10 ${spacingClass(spacing)} flex flex-col ${alignClass(align)}`}>
        <div className="w-full max-w-lg mx-auto">
          <PreviewForm flatSettings={flatSettings} accent={accent} fonts={fonts} isLight={isLight} cardBg={cardBg} textMuted={textMuted} />
        </div>
      </div>
    );
  }

  const { eventId, counts, spotsLeft, isFull, deadlinePast, seatingChartEnabled, seatingMap, tableOccupancy } = pageData;

  const noteInput = () => { if (!timingRef.current.firstInputAt) timingRef.current.firstInputAt = Date.now(); };
  const notePaste = (e) => {
    const len = e.clipboardData?.getData('text')?.length || 0;
    if (len > timingRef.current.largestPasteChars) {
      timingRef.current.largestPasteChars = len;
      timingRef.current.largestPasteElapsedMs = Date.now() - (timingRef.current.firstInputAt || timingRef.current.pageLoadedAt);
    }
  };

  const validate = () => {
    const errs = {};
    if (!response) errs.response = 'Please select your attendance status.';
    if (!firstName.trim()) errs.firstName = 'First name is required.';
    if (flatSettings.requireLastName && !lastName.trim()) errs.lastName = 'Last name is required.';
    if (flatSettings.requireEmail && !email.trim()) errs.email = 'Email address is required.';
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Please enter a valid email.';
    if (flatSettings.requirePhone && !phone.trim()) errs.phone = 'Phone number is required.';
    (flatSettings.customQuestions || []).forEach((q) => {
      if (q.required && (!customAnswers[q.id] || customAnswers[q.id] === '')) errs[`q_${q.id}`] = 'This field is required.';
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
        const q = (flatSettings.customQuestions || []).find((qq) => qq.id === questionId);
        return { questionId, question: q?.label || '', answer };
      });
      const res = await rsvpAPI.submit(slug, {
        response,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        plusOnes,
        plusOneDetails,
        dietaryRestrictions: dietary,
        accessibilityNeeds: accessibility,
        customAnswers: answersArr,
        guestNote,
        ...(selectedTableId ? { selectedTableId } : {}),
        pagePassword: unlockedPw || undefined,
        _hp: '',
        ...(turnstileToken ? { turnstileToken } : {}),
        behavior: { ...timingRef.current, submittedAt: Date.now(), formStartedAt: timingRef.current.formStartedAt || timingRef.current.pageLoadedAt },
        browserMeta: {
          webdriver: navigator.webdriver === true,
          language: navigator.language || '',
          platform: navigator.platform || '',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
          hardwareConcurrency: navigator.hardwareConcurrency || 0,
          deviceMemory: navigator.deviceMemory || 0,
          plugins: navigator.plugins ? Array.from(navigator.plugins).slice(0, 5).map((p) => p.name) : [],
          userAgent: navigator.userAgent || '',
        },
      });
      trackGAEvent('rsvp_submitted');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      onSubmitted?.({ ...res.data, guestName: `${firstName} ${lastName}`.trim() });
    } catch (err) {
      const data = err.response?.data || {};
      if (data.requiresVerification || data.code === 'VERIFICATION_REQUIRED' || data.code === 'INVALID_VERIFICATION') {
        setRequiresVerification(true);
        setCaptchaResetKey((k) => k + 1);
        setTurnstileToken('');
        setAbuseStatus({ title: data.code === 'INVALID_VERIFICATION' ? 'Invalid Verification' : 'Verification Required', message: data.userMessage || 'Please complete the verification step to continue.' });
        return;
      }
      if (['TRY_AGAIN_LATER', 'ADDITIONAL_REVIEW_REQUIRED', 'SUBMISSION_RECEIVED'].includes(data.code)) {
        setAbuseStatus({ title: 'Please Try Again', message: data.userMessage || "We couldn't complete your request right now. Please try again shortly." });
        return;
      }
      const msg = data.error || 'Failed to submit. Please try again.';
      setAbuseStatus({ title: 'Please Try Again', message: msg });
      toast.error(msg);
    } finally { setSubmitting(false); }
  };

  const setCustomAnswer = (id, value) => {
    setCustomAnswers((prev) => ({ ...prev, [id]: value }));
    if (fieldErrors[`q_${id}`]) setFieldErrors((prev) => { const n = { ...prev }; delete n[`q_${id}`]; return n; });
  };

  const addPlusOne = () => {
    if (plusOnes >= (flatSettings.maxPlusOnes || 5)) return;
    setPlusOnes((n) => n + 1);
    if (flatSettings.requirePlusOneNames) setPlusOneDetails((prev) => [...prev, { firstName: '', lastName: '', dietary: '' }]);
  };
  const removePlusOne = () => {
    if (plusOnes <= 0) return;
    setPlusOnes((n) => n - 1);
    setPlusOneDetails((prev) => prev.slice(0, -1));
  };

  if (deadlinePast) {
    return (
      <div className={`w-full px-6 md:px-10 ${spacingClass(spacing)} flex flex-col ${alignClass(align)}`}>
        <div className="w-full max-w-lg mx-auto flex items-center gap-3 p-4 rounded-2xl" style={{ background: '#ef444422', border: '1px solid #ef444444' }}>
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-400">RSVP deadline has passed</p>
            <p className="text-xs text-red-400/70 mt-0.5">{flatSettings.deadlineMessage || 'This event is no longer accepting RSVPs.'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full px-6 md:px-10 ${spacingClass(spacing)} flex flex-col ${alignClass(align)}`}>
      <form onSubmit={handleSubmit} className="w-full max-w-lg mx-auto space-y-5">
        {isFull && flatSettings.enableWaitlist === false && (
          <div className="flex items-center gap-3 p-4 rounded-2xl" style={{ background: '#f59e0b22', border: '1px solid #f59e0b44' }}>
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <p className="text-sm text-amber-400">This event has reached capacity.</p>
          </div>
        )}

        {/* Response selection */}
        <div className={`rounded-2xl p-5 space-y-4 ${cardBg}`}>
          <p className={`text-xs font-bold uppercase tracking-widest ${textMuted}`}>Your Response</p>
          {fieldErrors.response && <p className="text-xs text-red-400">{fieldErrors.response}</p>}
          <div className="flex flex-col sm:flex-row gap-2.5">
            {flatSettings.allowYes !== false && (
              <ResponseButton
                active={response === 'yes'}
                disabled={isFull && flatSettings.enableWaitlist === false}
                onClick={() => { noteInput(); setResponse('yes'); if (fieldErrors.response) setFieldErrors((p) => ({ ...p, response: '' })); }}
                icon={<Check className="w-4 h-4" />} label={flatSettings.yesButtonLabel || 'Attending'} activeColor={accent} isLight={isLight}
                note={isFull && flatSettings.enableWaitlist !== false ? '(joins waitlist)' : undefined}
              />
            )}
            {flatSettings.allowMaybe !== false && (
              <ResponseButton active={response === 'maybe'} onClick={() => { noteInput(); setResponse('maybe'); if (fieldErrors.response) setFieldErrors((p) => ({ ...p, response: '' })); }} icon={<HelpCircle className="w-4 h-4" />} label={flatSettings.maybeButtonLabel || 'Maybe'} activeColor="#f59e0b" isLight={isLight} />
            )}
            {flatSettings.allowNo !== false && (
              <ResponseButton active={response === 'no'} onClick={() => { noteInput(); setResponse('no'); if (fieldErrors.response) setFieldErrors((p) => ({ ...p, response: '' })); }} icon={<X className="w-4 h-4" />} label={flatSettings.noButtonLabel || 'Not Attending'} activeColor="#ef4444" isLight={isLight} />
            )}
          </div>
        </div>

        {/* Guest information */}
        {response && (
          <div className={`rounded-2xl overflow-hidden ${cardBg}`}>
            <button type="button" className={`w-full flex items-center justify-between p-5 text-left ${isLight ? 'hover:bg-gray-50' : 'hover:bg-white/[0.02]'} transition-colors`} onClick={() => setExpandedSection(expandedSection === 'info' ? '' : 'info')}>
              <span className={`text-xs font-bold uppercase tracking-widest ${textMuted}`}>Your Information</span>
              {expandedSection === 'info' ? <ChevronUp className={`w-4 h-4 ${textMuted}`} /> : <ChevronDown className={`w-4 h-4 ${textMuted}`} />}
            </button>
            {expandedSection === 'info' && (
              <div className="px-5 pb-5 space-y-3">
                <div className={`grid gap-3 ${flatSettings.requireLastName ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${textMuted}`}>First Name {flatSettings.requireFirstName !== false && <span className="text-red-400">*</span>}</label>
                    <input type="text" value={firstName} onChange={(e) => { noteInput(); setFirstName(e.target.value); setFieldErrors((p) => ({ ...p, firstName: '' })); }} placeholder="First name" className={inputCls} style={fieldErrors.firstName ? { borderColor: '#ef4444' } : {}} />
                    {fieldErrors.firstName && <p className="text-xs text-red-400 mt-1">{fieldErrors.firstName}</p>}
                  </div>
                  {flatSettings.requireLastName && (
                    <div>
                      <label className={`block text-xs font-medium mb-1.5 ${textMuted}`}>Last Name <span className="text-red-400">*</span></label>
                      <input type="text" value={lastName} onChange={(e) => { noteInput(); setLastName(e.target.value); setFieldErrors((p) => ({ ...p, lastName: '' })); }} placeholder="Last name" className={inputCls} style={fieldErrors.lastName ? { borderColor: '#ef4444' } : {}} />
                      {fieldErrors.lastName && <p className="text-xs text-red-400 mt-1">{fieldErrors.lastName}</p>}
                    </div>
                  )}
                </div>
                {flatSettings.collectEmail !== false && (
                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${textMuted}`}>Email {flatSettings.requireEmail && <span className="text-red-400">*</span>}</label>
                    <input type="email" value={email} onChange={(e) => { noteInput(); setEmail(e.target.value); setFieldErrors((p) => ({ ...p, email: '' })); }} placeholder="your@email.com" className={inputCls} style={fieldErrors.email ? { borderColor: '#ef4444' } : {}} />
                    {fieldErrors.email && <p className="text-xs text-red-400 mt-1">{fieldErrors.email}</p>}
                  </div>
                )}
                {flatSettings.collectPhone && (
                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${textMuted}`}>Phone {flatSettings.requirePhone && <span className="text-red-400">*</span>}</label>
                    <input type="tel" value={phone} onChange={(e) => { noteInput(); setPhone(e.target.value); setFieldErrors((p) => ({ ...p, phone: '' })); }} placeholder="+1 (555) 000-0000" className={inputCls} style={fieldErrors.phone ? { borderColor: '#ef4444' } : {}} />
                    {fieldErrors.phone && <p className="text-xs text-red-400 mt-1">{fieldErrors.phone}</p>}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Plus-ones */}
        {response && flatSettings.allowPlusOnes && (
          <div className={`rounded-2xl overflow-hidden ${cardBg}`}>
            <button type="button" className={`w-full flex items-center justify-between p-5 text-left ${isLight ? 'hover:bg-gray-50' : 'hover:bg-white/[0.02]'} transition-colors`} onClick={() => setExpandedSection(expandedSection === 'plusones' ? '' : 'plusones')}>
              <div>
                <span className={`text-xs font-bold uppercase tracking-widest ${textMuted}`}>Additional Guests</span>
                {plusOnes > 0 && <span className="ml-2 text-xs font-semibold" style={{ color: accent }}>+{plusOnes}</span>}
              </div>
              {expandedSection === 'plusones' ? <ChevronUp className={`w-4 h-4 ${textMuted}`} /> : <ChevronDown className={`w-4 h-4 ${textMuted}`} />}
            </button>
            {expandedSection === 'plusones' && (
              <div className="px-5 pb-5 space-y-4">
                <div className="flex items-center gap-4">
                  <button type="button" onClick={removePlusOne} disabled={plusOnes <= 0} className="w-9 h-9 rounded-xl flex items-center justify-center border transition-all disabled:opacity-30" style={{ borderColor: 'rgba(255,255,255,0.12)' }}><Minus className="w-4 h-4" /></button>
                  <span className={`text-lg font-bold w-8 text-center ${textMain}`}>{plusOnes}</span>
                  <button type="button" onClick={addPlusOne} disabled={plusOnes >= (flatSettings.maxPlusOnes || 5)} className="w-9 h-9 rounded-xl flex items-center justify-center border transition-all disabled:opacity-30" style={{ borderColor: 'rgba(255,255,255,0.12)', background: `${accent}22` }}><Plus className="w-4 h-4" style={{ color: accent }} /></button>
                  <span className={`text-xs ${textMuted}`}>of {flatSettings.maxPlusOnes || 5} max</span>
                </div>
                {flatSettings.requirePlusOneNames && plusOneDetails.map((po, i) => (
                  <div key={i} className="space-y-2 pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                    <p className={`text-xs font-semibold ${textMuted}`}>Guest {i + 1}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" value={po.firstName} onChange={(e) => { const d = [...plusOneDetails]; d[i] = { ...d[i], firstName: e.target.value }; setPlusOneDetails(d); }} placeholder="First name" className={inputCls} />
                      <input type="text" value={po.lastName} onChange={(e) => { const d = [...plusOneDetails]; d[i] = { ...d[i], lastName: e.target.value }; setPlusOneDetails(d); }} placeholder="Last name" className={inputCls} />
                    </div>
                    {flatSettings.collectPlusOneDietary && (
                      <input type="text" value={po.dietary} onChange={(e) => { const d = [...plusOneDetails]; d[i] = { ...d[i], dietary: e.target.value }; setPlusOneDetails(d); }} placeholder="Dietary requirements" className={inputCls} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Seating chart — existing functionality, preserved as-is for standard/enterprise events with seatingMap enabled */}
        {response === 'yes' && seatingChartEnabled && seatingMap?.objects?.length > 0 && (
          <div className={`rounded-2xl overflow-hidden ${cardBg}`}>
            <button type="button" className={`w-full flex items-center justify-between p-5 text-left ${isLight ? 'hover:bg-gray-50' : 'hover:bg-white/[0.02]'} transition-colors`} onClick={() => setExpandedSection(expandedSection === 'seating' ? '' : 'seating')}>
              <div>
                <span className={`text-xs font-bold uppercase tracking-widest ${textMuted}`}>Choose Your Table</span>
                {selectedTableId && <span className="ml-2 text-xs font-semibold" style={{ color: accent }}>{seatingMap.objects.find((o) => o.id === selectedTableId)?.label || 'Selected'}</span>}
              </div>
              {expandedSection === 'seating' ? <ChevronUp className={`w-4 h-4 ${textMuted}`} /> : <ChevronDown className={`w-4 h-4 ${textMuted}`} />}
            </button>
            {expandedSection === 'seating' && (
              <div className="px-5 pb-5">
                <p className={`text-xs mb-3 ${textMuted}`}>Optional — tap a table to reserve seats for your party. You can also skip this and the organizer will seat you.</p>
                <GuestSeatPicker objects={seatingMap.objects} occupancy={tableOccupancy || {}} canvasW={seatingMap.canvasW} canvasH={seatingMap.canvasH} requestedSeats={1 + (Number(plusOnes) || 0)} selectedId={selectedTableId} onSelect={setSelectedTableId} accent={accent} isLight={isLight} />
              </div>
            )}
          </div>
        )}

        {/* Dietary & accessibility */}
        {response && (flatSettings.collectDietary || flatSettings.collectAccessibility || flatSettings.allowGuestNote) && (
          <div className={`rounded-2xl overflow-hidden ${cardBg}`}>
            <button type="button" className={`w-full flex items-center justify-between p-5 text-left ${isLight ? 'hover:bg-gray-50' : 'hover:bg-white/[0.02]'} transition-colors`} onClick={() => setExpandedSection(expandedSection === 'extra' ? '' : 'extra')}>
              <span className={`text-xs font-bold uppercase tracking-widest ${textMuted}`}>Additional Details</span>
              {expandedSection === 'extra' ? <ChevronUp className={`w-4 h-4 ${textMuted}`} /> : <ChevronDown className={`w-4 h-4 ${textMuted}`} />}
            </button>
            {expandedSection === 'extra' && (
              <div className="px-5 pb-5 space-y-3">
                {flatSettings.collectDietary && (
                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${textMuted}`}>{flatSettings.dietaryLabel || 'Dietary requirements'}</label>
                    <textarea value={dietary} onChange={(e) => { noteInput(); setDietary(e.target.value); }} onPaste={notePaste} rows={2} placeholder="e.g. vegetarian, gluten-free, nut allergy" className={`${inputCls} resize-none`} />
                  </div>
                )}
                {flatSettings.collectAccessibility && (
                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${textMuted}`}>{flatSettings.accessibilityLabel || 'Accessibility needs'}</label>
                    <textarea value={accessibility} onChange={(e) => { noteInput(); setAccessibility(e.target.value); }} onPaste={notePaste} rows={2} placeholder="e.g. wheelchair access, hearing loop" className={`${inputCls} resize-none`} />
                  </div>
                )}
                {flatSettings.allowGuestNote && (
                  <div>
                    <label className={`block text-xs font-medium mb-1.5 ${textMuted}`}>{flatSettings.guestNoteLabel || 'Additional notes'}</label>
                    <textarea value={guestNote} onChange={(e) => { noteInput(); setGuestNote(e.target.value); }} onPaste={notePaste} rows={3} placeholder={flatSettings.guestNotePlaceholder || ''} className={`${inputCls} resize-none`} />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Custom questions */}
        {response && (flatSettings.customQuestions || []).length > 0 && (
          <div className={`rounded-2xl overflow-hidden ${cardBg}`}>
            <button type="button" className={`w-full flex items-center justify-between p-5 text-left ${isLight ? 'hover:bg-gray-50' : 'hover:bg-white/[0.02]'} transition-colors`} onClick={() => setExpandedSection(expandedSection === 'custom' ? '' : 'custom')}>
              <span className={`text-xs font-bold uppercase tracking-widest ${textMuted}`}>More Information</span>
              {expandedSection === 'custom' ? <ChevronUp className={`w-4 h-4 ${textMuted}`} /> : <ChevronDown className={`w-4 h-4 ${textMuted}`} />}
            </button>
            {expandedSection === 'custom' && (
              <div className="px-5 pb-5 space-y-4">
                {[...(flatSettings.customQuestions || [])].sort((a, b) => (a.order || 0) - (b.order || 0)).map((q) => (
                  <CustomQuestion key={q.id} question={q} value={customAnswers[q.id]} onChange={(v) => setCustomAnswer(q.id, v)} error={fieldErrors[`q_${q.id}`]} inputCls={inputCls} textMuted={textMuted} textMain={textMain} accent={accent} isLight={isLight} />
                ))}
              </div>
            )}
          </div>
        )}

        {abuseStatus && (
          <div className={`rounded-2xl p-4 ${isLight ? 'bg-indigo-50 border border-indigo-100 text-indigo-900' : 'bg-indigo-500/10 border border-indigo-400/20 text-indigo-100'}`}>
            <p className="text-sm font-bold mb-1">{abuseStatus.title}</p>
            <p className="text-sm opacity-80">{abuseStatus.message}</p>
          </div>
        )}

        {requiresVerification && (
          <div className={`rounded-2xl p-4 flex flex-col items-center gap-3 ${cardBg}`}>
            <p className={`text-sm ${textMuted}`}>Please complete the verification step to continue.</p>
            <TurnstileWidget onToken={setTurnstileToken} resetKey={captchaResetKey} theme={isLight ? 'light' : 'dark'} />
          </div>
        )}

        <input type="text" name="_hp" tabIndex={-1} className="sr-only" autoComplete="off" onChange={() => {}} />

        {response && (
          <button type="submit" disabled={submitting} className="w-full py-4 rounded-2xl text-sm font-bold transition-all hover:opacity-90 flex items-center justify-center gap-2" style={{ background: accent, color: '#fff', opacity: submitting ? 0.7 : 1 }}>
            {submitting ? (<><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting...</>) : (<>Submit RSVP <ArrowRight className="w-4 h-4" /></>)}
          </button>
        )}

        {flatSettings.showEventSpaceButton && (
          <div className="text-center">
            <a href={`/e/${pageData.subdomain}`} className={`text-xs underline ${textMuted} hover:opacity-80 transition-opacity`}>View event space instead</a>
          </div>
        )}

        <div className="text-center space-y-2 pb-4">
          <p className={`text-xs ${textMuted}`} style={{ opacity: 0.3 }}>
            {!flatSettings.hideBranding && (<>Powered by <a href="/" className="underline hover:opacity-60">PlanIt</a> · </>)}
            <a href={`/e/${pageData.subdomain}`} className="underline hover:opacity-60">Event Space</a>
          </p>
        </div>
      </form>
    </div>
  );
}
