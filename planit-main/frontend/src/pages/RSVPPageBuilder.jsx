/**
 * RSVPPageBuilder.jsx
 * Full-page split-panel RSVP editor.
 * Left side  → settings (spacious, plain-English, always visible)
 * Right side → live preview that updates in real time as you type
 */
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Save, Eye, EyeOff, ExternalLink, Copy,
  Palette, Type, Image, Settings, Shield, Mail,
  MessageSquare, Check, Plus, Trash2, GripVertical,
  ChevronDown, ChevronUp, Info, Sparkles, Monitor,
  Smartphone, Globe, Lock, Users, Calendar, MapPin,
  User, Star, AlertTriangle, X, Clock, RefreshCw,
  ToggleLeft, FileText
} from 'lucide-react';
import toast from 'react-hot-toast';
import { eventAPI, rsvpAPI } from '../services/api';

/* ─── Helpers re-used from RSVPPage ──────────────────────────────────────── */
const FONTS = {
  modern:  { heading: 'font-bold tracking-tight',           body: 'font-normal',        label: 'Modern',  sub: 'Clean & contemporary' },
  classic: { heading: 'font-serif font-bold',               body: 'font-serif',         label: 'Classic', sub: 'Timeless serif style' },
  elegant: { heading: 'font-light tracking-widest uppercase', body: 'font-light tracking-wide', label: 'Elegant', sub: 'Light & airy lettering' },
  bold:    { heading: 'font-black tracking-tight',          body: 'font-medium',        label: 'Bold',    sub: 'Heavy & impactful' },
};

const BG_OPTIONS = [
  { value: 'dark',     label: 'Dark',     sub: 'Deep dark background', preview: '#0a0a12' },
  { value: 'light',    label: 'Light',    sub: 'Clean white / grey',   preview: '#f9fafb' },
  { value: 'gradient', label: 'Gradient', sub: 'Dark with color glow', preview: 'linear-gradient(135deg,#0f0f1a,#1a1035)' },
  { value: 'frosted',  label: 'Frosted',  sub: 'Frosted-glass dark',   preview: 'rgba(15,15,26,0.95)' },
];

function getBgStyle(style, accent) {
  switch (style) {
    case 'light':    return { background: '#f9fafb', color: '#111827' };
    case 'gradient': return { background: `linear-gradient(135deg, #0f0f1a 0%, ${accent}22 50%, #0f0f1a 100%)`, color: '#fff' };
    case 'frosted':  return { background: 'rgba(15,15,26,0.95)', color: '#fff' };
    default:         return { background: '#0a0a12', color: '#fff' };
  }
}

const PRESET_COLORS = ['#6366f1','#f59e0b','#10b981','#ef4444','#8b5cf6','#ec4899','#0ea5e9','#f97316','#14b8a6','#a855f7'];

const DEFAULT_SETTINGS = {
  enabled: false,
  accessMode: 'open',
  rsvpPassword: '',
  confirmationMode: 'auto_confirm',
  coverImageUrl: '',
  logoUrl: '',
  backgroundImageUrl: '',
  accentColor: '#6366f1',
  backgroundStyle: 'dark',
  fontStyle: 'modern',
  bannerText: '',
  bannerColor: '#f59e0b',
  bannerEnabled: false,
  hideBranding: false,
  heroTagline: '',
  welcomeTitle: '',
  welcomeMessage: '',
  deadline: null,
  deadlineMessage: '',
  capacityLimit: 0,
  enableWaitlist: true,
  waitlistMessage: '',
  allowYes: true,
  allowMaybe: true,
  allowNo: true,
  yesButtonLabel: 'Attending',
  maybeButtonLabel: 'Maybe',
  noButtonLabel: 'Not Attending',
  requireFirstName: true,
  requireLastName: false,
  collectEmail: true,
  requireEmail: true,
  collectPhone: false,
  requirePhone: false,
  allowPlusOnes: false,
  maxPlusOnes: 5,
  requirePlusOneNames: false,
  collectDietary: false,
  dietaryLabel: 'Dietary requirements',
  collectAccessibility: false,
  accessibilityLabel: 'Accessibility needs',
  allowGuestNote: false,
  guestNoteLabel: 'Additional notes',
  customQuestions: [],
  confirmationTitle: '',
  confirmationMessage: '',
  confirmationImageUrl: '',
  showEventSpaceButton: false,
  eventSpaceButtonLabel: 'View Event Details',
  showAddToCalendar: true,
  showShareButton: true,
  sendGuestConfirmation: false,
  confirmationEmailSubject: '',
  confirmationEmailBody: '',
  notifyOrganizerOnRsvp: true,
  organizerNotifyEmail: '',
  showGuestCount: true,
  showEventDate: true,
  showEventLocation: true,
  showEventDescription: true,
  showHostName: true,
  showCountdown: false,
  allowGuestEdit: true,
  editCutoffHours: 24,
  rateLimitPerIp: 5,
  duplicateEmailPolicy: 'warn_organizer',
  enableHoneypot: true,
};

/* ─── Small reusable pieces ──────────────────────────────────────────────── */
function Label({ children, htmlFor, tip }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-semibold text-neutral-800 mb-1">
      {children}
      {tip && <span className="ml-1.5 text-xs font-normal text-neutral-400">{tip}</span>}
    </label>
  );
}
function Hint({ children }) {
  return <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed">{children}</p>;
}
function Input({ value, onChange, placeholder, type = 'text', ...rest }) {
  return (
    <input
      type={type}
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3.5 py-2.5 rounded-xl text-sm border border-neutral-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all bg-white text-neutral-900 placeholder-neutral-400"
      {...rest}
    />
  );
}
function Textarea({ value, onChange, placeholder, rows = 3 }) {
  return (
    <textarea
      value={value ?? ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full px-3.5 py-2.5 rounded-xl text-sm border border-neutral-200 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 outline-none transition-all bg-white text-neutral-900 placeholder-neutral-400 resize-none"
    />
  );
}
function Toggle({ checked, onChange, label, hint, disabled }) {
  return (
    <div className={`flex items-start gap-4 py-3 ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
      <div className="flex-1">
        <p className="text-sm font-semibold text-neutral-800">{label}</p>
        {hint && <p className="text-xs text-neutral-400 mt-0.5 leading-relaxed">{hint}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative flex-shrink-0 rounded-full transition-all duration-200 ${checked ? 'bg-indigo-600' : 'bg-neutral-200'}`}
        style={{ width: 44, height: 24 }}
      >
        <span
          className={`absolute top-1 bg-white rounded-full shadow-sm transition-all duration-200 ${checked ? 'left-5' : 'left-1'}`}
          style={{ width: 16, height: 16 }}
        />
      </button>
    </div>
  );
}
function SectionCard({ icon: Icon, title, description, children, defaultOpen = false, accent = '#6366f1' }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 hover:bg-neutral-50 transition-colors text-left"
      >
        <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${accent}15` }}>
          <Icon className="w-4 h-4" style={{ color: accent }} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-neutral-900">{title}</p>
          {description && <p className="text-xs text-neutral-400 mt-0.5">{description}</p>}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
      </button>
      {open && (
        <div className="px-5 pb-5 pt-1 space-y-4 border-t border-neutral-100">
          {children}
        </div>
      )}
    </div>
  );
}

/* ─── Custom Questions editor ─────────────────────────────────────────────── */
const Q_TYPES = [
  { value: 'text',     label: 'Short text answer' },
  { value: 'textarea', label: 'Long text / paragraph' },
  { value: 'select',   label: 'Dropdown — pick one' },
  { value: 'radio',    label: 'Radio — pick one (visible)' },
  { value: 'checkbox', label: 'Checkbox — pick multiple' },
  { value: 'number',   label: 'Number' },
];

function QuestionCard({ q, onChange, onDelete }) {
  const [open, setOpen] = useState(false);
  const needsOptions = ['select','radio','checkbox'].includes(q.type);
  const addOpt = () => onChange({ ...q, options: [...(q.options||[]), ''] });
  const updOpt = (i, v) => { const o=[...(q.options||[])]; o[i]=v; onChange({...q,options:o}); };
  const delOpt = (i) => { const o=[...(q.options||[])]; o.splice(i,1); onChange({...q,options:o}); };

  return (
    <div className="border border-neutral-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-3 bg-neutral-50">
        <GripVertical className="w-4 h-4 text-neutral-300 flex-shrink-0 cursor-grab" />
        <input
          value={q.label}
          onChange={e => onChange({...q,label:e.target.value})}
          placeholder="Your question text…"
          className="flex-1 text-sm font-medium bg-transparent border-none outline-none text-neutral-800 placeholder-neutral-400"
        />
        <select value={q.type} onChange={e => onChange({...q,type:e.target.value})}
          className="text-xs border border-neutral-200 rounded-lg px-2 py-1.5 bg-white text-neutral-600 cursor-pointer">
          {Q_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <button type="button" onClick={() => setOpen(o=>!o)}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-neutral-200 transition-colors">
          {open ? <ChevronUp className="w-3.5 h-3.5"/> : <ChevronDown className="w-3.5 h-3.5"/>}
        </button>
        <button type="button" onClick={onDelete}
          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 transition-colors">
          <Trash2 className="w-3.5 h-3.5 text-red-400"/>
        </button>
      </div>
      {open && (
        <div className="px-4 pb-4 pt-3 space-y-3 border-t border-neutral-100">
          <label className="flex items-center gap-2 cursor-pointer text-sm text-neutral-700">
            <input type="checkbox" checked={q.required||false}
              onChange={e => onChange({...q,required:e.target.checked})}
              className="rounded border-neutral-300" />
            <span>Required — guest must answer this</span>
          </label>
          <div>
            <Label tip="(optional)">Placeholder text shown inside the field</Label>
            <Input value={q.placeholder||''} onChange={v => onChange({...q,placeholder:v})} placeholder="e.g. Your answer here…" />
          </div>
          <div>
            <Label tip="(optional)">Small helper text shown below the question</Label>
            <Input value={q.helpText||''} onChange={v => onChange({...q,helpText:v})} placeholder="e.g. This helps us prepare for the event" />
          </div>
          {needsOptions && (
            <div>
              <Label>Answer options</Label>
              <div className="space-y-2">
                {(q.options||[]).map((o,i) => (
                  <div key={i} className="flex gap-2">
                    <Input value={o} onChange={v => updOpt(i,v)} placeholder={`Option ${i+1}`} />
                    <button type="button" onClick={() => delOpt(i)}
                      className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-red-50 border border-neutral-200 flex-shrink-0 transition-colors">
                      <Trash2 className="w-3.5 h-3.5 text-red-400"/>
                    </button>
                  </div>
                ))}
                <button type="button" onClick={addOpt}
                  className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors py-1">
                  <Plus className="w-4 h-4"/> Add option
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Live preview (mini phone-frame RSVP page) ───────────────────────────── */
function LivePreview({ settings, event, viewMode }) {
  const accent    = settings.accentColor || '#6366f1';
  const bg        = getBgStyle(settings.backgroundStyle || 'dark', accent);
  const isLight   = settings.backgroundStyle === 'light';
  const fonts     = FONTS[settings.fontStyle || 'modern'] || FONTS.modern;
  const textMuted = isLight ? '#6b7280' : 'rgba(255,255,255,0.5)';
  const cardBg    = isLight ? '#fff' : 'rgba(255,255,255,0.05)';
  const cardBorder= isLight ? '#e5e7eb' : 'rgba(255,255,255,0.1)';

  const title = settings.welcomeTitle || event?.title || 'Your Event Name';
  const date  = event?.date ? new Date(event.date).toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' }) : 'Saturday, June 7, 2025';

  const previewStyle = viewMode === 'desktop'
    ? { width: '100%', height: '100%', overflowY: 'auto', borderRadius: 12 }
    : { width: 375, minHeight: 667, margin: '0 auto', borderRadius: 32, overflowY: 'auto', boxShadow: '0 0 0 10px #1a1a2e, 0 0 0 11px #333' };

  return (
    <div style={{ display:'flex', alignItems: viewMode === 'desktop' ? 'flex-start' : 'center', justifyContent:'center', height:'100%', padding: viewMode === 'desktop' ? '0' : '20px 0', overflowY:'auto' }}>
      <div style={{ ...previewStyle, ...bg, position:'relative', flexShrink:0 }}>

        {/* Announcement banner */}
        {settings.bannerEnabled && settings.bannerText && (
          <div style={{ background: settings.bannerColor, color:'#000', padding:'8px 16px', textAlign:'center', fontSize:12, fontWeight:700 }}>
            {settings.bannerText}
          </div>
        )}

        {/* Background image overlay */}
        {settings.backgroundImageUrl && (
          <div style={{
            position:'absolute', inset:0, zIndex:0,
            backgroundImage:`url(${settings.backgroundImageUrl})`,
            backgroundSize:'cover', backgroundPosition:'center',
            opacity:0.15, pointerEvents:'none'
          }} />
        )}

        <div style={{ position:'relative', zIndex:1, padding:'32px 20px 24px', maxWidth:560, margin:'0 auto' }}>

          {/* Logo */}
          {settings.logoUrl && (
            <div style={{ textAlign:'center', marginBottom:20 }}>
              <img src={settings.logoUrl} alt="Logo" style={{ height:40, objectFit:'contain', display:'inline-block' }} />
            </div>
          )}

          {/* Cover image */}
          {settings.coverImageUrl && (
            <div style={{ width:'100%', borderRadius:16, overflow:'hidden', marginBottom:16, aspectRatio:'16/7' }}>
              <img src={settings.coverImageUrl} alt="Cover" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            </div>
          )}

          {/* Tagline */}
          {settings.heroTagline && (
            <p style={{ textAlign:'center', fontSize:10, fontWeight:700, letterSpacing:'0.2em', textTransform:'uppercase', color:textMuted, marginBottom:8 }}>
              {settings.heroTagline}
            </p>
          )}

          {/* Title */}
          <h1 style={{ textAlign:'center', fontSize:26, fontWeight:900, color: isLight ? '#111' : '#fff', marginBottom:8, lineHeight:1.2 }}>
            {title}
          </h1>

          {/* Welcome message */}
          {settings.welcomeMessage && (
            <p style={{ textAlign:'center', fontSize:13, color:textMuted, marginBottom:16, lineHeight:1.6, whiteSpace:'pre-wrap' }}>
              {settings.welcomeMessage}
            </p>
          )}

          {/* Event details card */}
          <div style={{ background:cardBg, border:`1px solid ${cardBorder}`, borderRadius:16, padding:'14px 16px', marginBottom:16, display:'flex', flexDirection:'column', gap:10 }}>
            {settings.showEventDate !== false && (
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <Calendar style={{ width:14, height:14, color:textMuted, flexShrink:0 }} />
                <span style={{ fontSize:13, color: isLight ? '#111' : '#fff' }}>{date}</span>
              </div>
            )}
            {settings.showEventLocation !== false && event?.location && (
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <MapPin style={{ width:14, height:14, color:textMuted, flexShrink:0 }} />
                <span style={{ fontSize:13, color: isLight ? '#111' : '#fff' }}>{event.location}</span>
              </div>
            )}
            {settings.showHostName !== false && event?.organizerName && (
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <User style={{ width:14, height:14, color:textMuted, flexShrink:0 }} />
                <span style={{ fontSize:13, color: isLight ? '#111' : '#fff' }}>Hosted by {event.organizerName}</span>
              </div>
            )}
            {settings.showGuestCount !== false && (
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <Users style={{ width:14, height:14, color:textMuted, flexShrink:0 }} />
                <span style={{ fontSize:13, color: isLight ? '#111' : '#fff' }}>12 attending · 3 maybe</span>
              </div>
            )}
          </div>

          {/* RSVP buttons */}
          <div style={{ display:'flex', gap:8, marginBottom:16 }}>
            {settings.allowYes !== false && (
              <div style={{ flex:1, padding:'14px 8px', borderRadius:12, border:`2px solid ${accent}`, background:`${accent}18`, display:'flex', alignItems:'center', justifyContent:'center', gap:6, fontSize:13, fontWeight:700, color:accent }}>
                <Check style={{ width:14, height:14 }} />
                {settings.yesButtonLabel || 'Attending'}
              </div>
            )}
            {settings.allowMaybe !== false && (
              <div style={{ flex:1, padding:'14px 8px', borderRadius:12, border:`2px solid ${isLight ? '#e5e7eb' : 'rgba(255,255,255,0.15)'}`, display:'flex', alignItems:'center', justifyContent:'center', gap:6, fontSize:13, fontWeight:700, color:textMuted }}>
                {settings.maybeButtonLabel || 'Maybe'}
              </div>
            )}
            {settings.allowNo !== false && (
              <div style={{ flex:1, padding:'14px 8px', borderRadius:12, border:`2px solid ${isLight ? '#e5e7eb' : 'rgba(255,255,255,0.15)'}`, display:'flex', alignItems:'center', justifyContent:'center', gap:6, fontSize:13, fontWeight:700, color:textMuted }}>
                {settings.noButtonLabel || 'Can\'t go'}
              </div>
            )}
          </div>

          {/* Form preview */}
          <div style={{ background:cardBg, border:`1px solid ${cardBorder}`, borderRadius:16, padding:'14px 16px', marginBottom:14 }}>
            <p style={{ fontSize:9, fontWeight:800, letterSpacing:'0.15em', textTransform:'uppercase', color:textMuted, marginBottom:12 }}>Your Information</p>
            <div style={{ display:'flex', gap:8, marginBottom:10 }}>
              <div style={{ flex:1, padding:'10px 12px', borderRadius:10, border:`1px solid ${isLight ? '#e5e7eb' : 'rgba(255,255,255,0.1)'}`, fontSize:12, color:textMuted, background: isLight ? '#f9fafb' : 'rgba(255,255,255,0.03)' }}>First name</div>
              {settings.requireLastName && (
                <div style={{ flex:1, padding:'10px 12px', borderRadius:10, border:`1px solid ${isLight ? '#e5e7eb' : 'rgba(255,255,255,0.1)'}`, fontSize:12, color:textMuted, background: isLight ? '#f9fafb' : 'rgba(255,255,255,0.03)' }}>Last name</div>
              )}
            </div>
            {settings.collectEmail !== false && (
              <div style={{ padding:'10px 12px', borderRadius:10, border:`1px solid ${isLight ? '#e5e7eb' : 'rgba(255,255,255,0.1)'}`, fontSize:12, color:textMuted, background: isLight ? '#f9fafb' : 'rgba(255,255,255,0.03)', marginBottom:10 }}>Email address</div>
            )}
            {settings.collectPhone && (
              <div style={{ padding:'10px 12px', borderRadius:10, border:`1px solid ${isLight ? '#e5e7eb' : 'rgba(255,255,255,0.1)'}`, fontSize:12, color:textMuted, background: isLight ? '#f9fafb' : 'rgba(255,255,255,0.03)', marginBottom:10 }}>Phone number</div>
            )}
          </div>

          {/* Submit button */}
          <div style={{ padding:'14px 20px', borderRadius:14, background:accent, color:'#fff', textAlign:'center', fontSize:13, fontWeight:800, marginBottom:14 }}>
            Submit RSVP →
          </div>

          {/* Branding */}
          {!settings.hideBranding && (
            <p style={{ textAlign:'center', fontSize:10, color:textMuted, opacity:0.5 }}>Powered by PlanIt</p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Main Builder ────────────────────────────────────────────────────────── */
export default function RSVPPageBuilder() {
  const { subdomain, eventId: paramEventId } = useParams();
  const navigate = useNavigate();

  const [event,    setEvent]    = useState(null);
  const [eventId,  setEventId]  = useState(paramEventId || null);
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS });
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [dirty,    setDirty]    = useState(false);
  const [viewMode, setViewMode] = useState('desktop'); // 'desktop' | 'mobile'

  const [gmailConnected,      setGmailConnected]      = useState(false);
  const [gmailEmail,          setGmailEmail]          = useState('');
  const [gmailConnecting,     setGmailConnecting]     = useState(false);
  const [gmailDisconnecting,  setGmailDisconnecting]  = useState(false);

  const ROUTER_URL = import.meta.env.VITE_ROUTER_URL || '';

  /* load event + settings */
  useEffect(() => {
    const load = async () => {
      try {
        // Use rsvpAPI.getPage — handles both ObjectId and subdomain slug
        // (avoids the Mongoose CastError caused by passing a subdomain string
        //  to Event.findById in the old eventAPI.getPublicInfo path)
        const pageRes = await rsvpAPI.getPage(paramEventId || subdomain);
        const eid = pageRes.data.eventId;
        if (!eid) { toast.error('Event not found'); return; }
        setEventId(eid);

        setEvent({
          title:     pageRes.data.rawTitle || pageRes.data.title,
          date:      pageRes.data.date,
          timezone:  pageRes.data.timezone,
          location:  pageRes.data.location,
          subdomain: pageRes.data.subdomain,
        });

        // Fetch organizer-level settings (includes full rsvpPage config)
        const settingsRes = await rsvpAPI.getSettings(eid);
        if (settingsRes.data.rsvpPage) {
          setSettings({ ...DEFAULT_SETTINGS, ...settingsRes.data.rsvpPage });
        }

        // Load Gmail connection status
        try {
          const gmailRes = await rsvpAPI.getGmailStatus(eid);
          setGmailConnected(gmailRes.data.connected === true);
          setGmailEmail(gmailRes.data.email || '');
        } catch { /* non-fatal */ }
      } catch (err) {
        toast.error('Could not load event settings.');
      } finally { setLoading(false); }
    };
    load();
  }, [paramEventId, subdomain]);

  const set = useCallback((key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setDirty(true);
  }, []);

  const connectGmail = () => {
    if (!eventId || !ROUTER_URL) return;
    setGmailConnecting(true);
    const popup = window.open(
      `${ROUTER_URL}/gmail/connect?eventId=${eventId}`,
      'gmail-oauth',
      'width=520,height=640,left=200,top=100'
    );
    const onMessage = (e) => {
      if (e.data?.type === 'GMAIL_OAUTH_SUCCESS') {
        setGmailConnected(true);
        setGmailEmail(e.data.message || '');
        setGmailConnecting(false);
        toast.success('Gmail connected.');
        window.removeEventListener('message', onMessage);
      } else if (e.data?.type === 'GMAIL_OAUTH_ERROR') {
        setGmailConnecting(false);
        toast.error('Gmail connection failed.');
        window.removeEventListener('message', onMessage);
      }
    };
    window.addEventListener('message', onMessage);
    // Fallback if popup closed without postMessage
    const pollClosed = setInterval(() => {
      if (popup?.closed) {
        clearInterval(pollClosed);
        window.removeEventListener('message', onMessage);
        setGmailConnecting(false);
      }
    }, 800);
  };

  const disconnectGmail = async () => {
    if (!eventId) return;
    setGmailDisconnecting(true);
    try {
      await rsvpAPI.disconnectGmail(eventId);
      setGmailConnected(false);
      setGmailEmail('');
      toast.success('Gmail disconnected.');
    } catch {
      toast.error('Failed to disconnect Gmail.');
    } finally { setGmailDisconnecting(false); }
  };

  const save = async () => {
    if (!dirty || !eventId) return;
    setSaving(true);
    try {
      await rsvpAPI.updateSettings(eventId, settings);
      toast.success('RSVP page saved!');
      setDirty(false);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save.');
    } finally { setSaving(false); }
  };

  const addQuestion = () => {
    const id = `q_${Date.now()}`;
    set('customQuestions', [...(settings.customQuestions||[]), { id, label:'', type:'text', required:false, options:[], placeholder:'', helpText:'', order:(settings.customQuestions||[]).length }]);
  };
  const updateQ = (id, q) => set('customQuestions', (settings.customQuestions||[]).map(x => x.id===id ? q : x));
  const deleteQ = (id)     => set('customQuestions', (settings.customQuestions||[]).filter(x => x.id!==id));

  const rsvpUrl = event?.subdomain ? `${window.location.origin}/rsvp/${event.subdomain}` : '';

  const copyUrl = () => {
    navigator.clipboard.writeText(rsvpUrl);
    toast.success('RSVP link copied!');
  };

  const goBack = () => {
    if (event?.subdomain) navigate(`/e/${event.subdomain}`);
    else if (eventId) navigate(`/event/${eventId}`);
    else navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-neutral-200 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  const accent = settings.accentColor || '#6366f1';

  /* ── Settings Panel ──────────────────────────────────────────────────── */
  const SettingsPanel = () => (
    <div className="space-y-4 pb-24">

      {/* ── Enable / Link ── */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-base font-bold text-neutral-900">RSVP Page</p>
            <p className="text-xs text-neutral-400 mt-0.5">When enabled, guests can RSVP directly from a shareable link.</p>
          </div>
          <button
            type="button"
            onClick={() => set('enabled', !settings.enabled)}
            className={`relative flex-shrink-0 rounded-full transition-all duration-200 ${settings.enabled ? 'bg-indigo-600' : 'bg-neutral-300'}`}
            style={{ width: 52, height: 28 }}
          >
            <span className={`absolute top-1 bg-white rounded-full shadow transition-all duration-200 ${settings.enabled ? 'left-6' : 'left-1'}`} style={{ width: 20, height: 20 }} />
          </button>
        </div>

        {settings.enabled && rsvpUrl && (
          <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-xl px-3.5 py-2.5">
            <Globe className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
            <span className="text-xs text-indigo-700 flex-1 truncate font-medium">{rsvpUrl}</span>
            <button type="button" onClick={copyUrl} className="text-indigo-500 hover:text-indigo-700 flex-shrink-0">
              <Copy className="w-3.5 h-3.5" />
            </button>
            <a href={rsvpUrl} target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-600 flex-shrink-0">
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}
      </div>

      {/* ── Appearance ── */}
      <SectionCard icon={Palette} title="Appearance" description="Colors, fonts, background style — how the page looks" defaultOpen accent={accent}>

        {/* Accent color */}
        <div>
          <Label>Accent color</Label>
          <Hint>Used for buttons, highlights, and interactive elements on the page.</Hint>
          <div className="flex gap-2 items-center mt-2">
            <input type="color" value={settings.accentColor||'#6366f1'} onChange={e => set('accentColor', e.target.value)}
              className="w-10 h-10 rounded-xl border border-neutral-200 cursor-pointer bg-white p-0.5 flex-shrink-0" />
            <Input value={settings.accentColor||'#6366f1'} onChange={v => set('accentColor', v)} placeholder="#6366f1" />
          </div>
          <div className="flex gap-2 mt-2.5 flex-wrap">
            {PRESET_COLORS.map(c => (
              <button key={c} type="button" onClick={() => set('accentColor', c)}
                className="w-7 h-7 rounded-lg border-2 transition-all"
                style={{ background:c, borderColor: settings.accentColor===c ? '#fff' : 'transparent', boxShadow: settings.accentColor===c ? `0 0 0 2px ${c}` : 'none' }} />
            ))}
          </div>
        </div>

        {/* Background style */}
        <div>
          <Label>Background style</Label>
          <Hint>The overall look of your page behind all the content.</Hint>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {BG_OPTIONS.map(({ value, label, sub, preview }) => (
              <button key={value} type="button" onClick={() => set('backgroundStyle', value)}
                className={`p-3 rounded-xl border-2 text-left transition-all ${settings.backgroundStyle===value ? 'border-indigo-500' : 'border-neutral-200 hover:border-neutral-300'}`}>
                <div className="w-full h-8 rounded-lg mb-2 border border-white/10" style={{ background:preview }} />
                <p className="text-xs font-bold text-neutral-800">{label}</p>
                <p className="text-[10px] text-neutral-400 mt-0.5">{sub}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Font style */}
        <div>
          <Label>Font / typography style</Label>
          <Hint>Controls how all the text on your RSVP page looks.</Hint>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {Object.entries(FONTS).map(([val, { label, sub }]) => (
              <button key={val} type="button" onClick={() => set('fontStyle', val)}
                className={`p-3 rounded-xl border-2 text-left transition-all ${settings.fontStyle===val ? 'border-indigo-500 bg-indigo-50' : 'border-neutral-200 hover:border-neutral-300'}`}>
                <p className="text-xs font-bold text-neutral-800">{label}</p>
                <p className="text-[10px] text-neutral-400 mt-0.5">{sub}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Hide branding */}
        <div className="border-t border-neutral-100 pt-3">
          <Toggle
            label="Remove 'Powered by PlanIt' footer"
            hint="Hides the PlanIt branding at the bottom of the page for a fully custom look."
            checked={settings.hideBranding===true}
            onChange={v => set('hideBranding', v)}
          />
        </div>
      </SectionCard>

      {/* ── Images ── */}
      <SectionCard icon={Image} title="Images & Logo" description="Add a cover photo, logo, or background image" accent={accent}>
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 flex gap-2">
          <Info className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-indigo-700 leading-relaxed">Paste the full URL of any image hosted online (Imgur, Google Drive, Dropbox public link, your own server, etc.). The URL must start with <code className="font-mono bg-indigo-100 px-1 rounded">https://</code></p>
        </div>

        <div>
          <Label>Cover image URL</Label>
          <Hint>A wide banner image shown at the top of the page, above the event title. Ideal size: 1200 × 630 px.</Hint>
          <Input value={settings.coverImageUrl||''} onChange={v => set('coverImageUrl',v)} placeholder="https://example.com/cover.jpg" />
          {settings.coverImageUrl && (
            <div className="mt-2 rounded-xl overflow-hidden border border-neutral-200 h-28">
              <img src={settings.coverImageUrl} alt="Cover preview" className="w-full h-full object-cover"
                onError={e => { e.target.style.display='none'; }} />
            </div>
          )}
        </div>

        <div>
          <Label>Logo / brand mark URL</Label>
          <Hint>Your logo shown above the event title — great for custom-branded invites. Transparent PNG works best.</Hint>
          <Input value={settings.logoUrl||''} onChange={v => set('logoUrl',v)} placeholder="https://example.com/logo.png" />
          {settings.logoUrl && (
            <div className="mt-2 p-3 bg-neutral-100 rounded-xl flex items-center justify-center h-16">
              <img src={settings.logoUrl} alt="Logo preview" className="max-h-full max-w-full object-contain"
                onError={e => { e.target.style.display='none'; }} />
            </div>
          )}
        </div>

        <div>
          <Label>Background image URL</Label>
          <Hint>Adds a subtle texture or photo behind the entire page. Keep it simple — it's shown at low opacity so the text stays readable.</Hint>
          <Input value={settings.backgroundImageUrl||''} onChange={v => set('backgroundImageUrl',v)} placeholder="https://example.com/bg-texture.jpg" />
        </div>

        <div>
          <Label>Confirmation image URL</Label>
          <Hint>Image shown on the "Thank you / confirmed" screen after someone submits their RSVP.</Hint>
          <Input value={settings.confirmationImageUrl||''} onChange={v => set('confirmationImageUrl',v)} placeholder="https://example.com/thankyou.jpg" />
        </div>
      </SectionCard>

      {/* ── Hero Content ── */}
      <SectionCard icon={Sparkles} title="Page Content" description="Tagline, welcome title, and message text" accent={accent}>
        <div>
          <Label>Tagline</Label>
          <Hint>Small label shown above the event title — like "You're invited" or "Join us". Great for setting the tone.</Hint>
          <Input value={settings.heroTagline||''} onChange={v => set('heroTagline',v)} placeholder="You're invited · Summer Edition 2025" />
        </div>

        <div>
          <Label>Custom page title</Label>
          <Hint>Overrides the event title on this page only. Leave blank to use the event title as-is.</Hint>
          <Input value={settings.welcomeTitle||''} onChange={v => set('welcomeTitle',v)} placeholder="Leave blank to use your event name" />
        </div>

        <div>
          <Label>Welcome message</Label>
          <Hint>Shown below the title. Use this to set the vibe, share dress code, give parking info, or anything else guests should know before RSVPing.</Hint>
          <Textarea value={settings.welcomeMessage||''} onChange={v => set('welcomeMessage',v)}
            placeholder="Write a warm welcome for your guests. You can use multiple paragraphs." rows={4} />
        </div>

        <div>
          <Label>Announcement banner text</Label>
          <Hint>An eye-catching banner pinned to the top of the page — perfect for urgent notices like "Spots almost full!"</Hint>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input value={settings.bannerText||''} onChange={v => set('bannerText',v)} placeholder="e.g. Spots are filling fast — RSVP now!" />
            </div>
            <div className="flex items-center gap-1.5">
              <input type="color" value={settings.bannerColor||'#f59e0b'} onChange={e => set('bannerColor',e.target.value)}
                className="w-10 h-10 rounded-xl border border-neutral-200 cursor-pointer p-0.5" title="Banner color" />
              <Toggle checked={settings.bannerEnabled===true} onChange={v => set('bannerEnabled',v)} label="" />
            </div>
          </div>
        </div>

        <div className="border-t border-neutral-100 pt-3 grid grid-cols-2 gap-3">
          <Toggle label="Show countdown timer" hint="Live countdown to the event date." checked={settings.showCountdown===true} onChange={v => set('showCountdown',v)} />
          <Toggle label="Show guest count" hint="Show how many people are attending." checked={settings.showGuestCount!==false} onChange={v => set('showGuestCount',v)} />
          <Toggle label="Show event date" checked={settings.showEventDate!==false} onChange={v => set('showEventDate',v)} label="Show date & time" />
          <Toggle label="Show location" checked={settings.showEventLocation!==false} onChange={v => set('showEventLocation',v)} label="Show venue / location" />
          <Toggle label="Show host name" checked={settings.showHostName!==false} onChange={v => set('showHostName',v)} label="Show organizer name" />
          <Toggle label="Show description" checked={settings.showEventDescription!==false} onChange={v => set('showEventDescription',v)} label="Show event description" />
        </div>
      </SectionCard>

      {/* ── RSVP Buttons ── */}
      <SectionCard icon={Check} title="RSVP Response Buttons" description="Which options guests can choose, and what they're called" accent={accent}>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Toggle label="'Yes' button" checked={settings.allowYes!==false} onChange={v => set('allowYes',v)} />
            <Input value={settings.yesButtonLabel||'Attending'} onChange={v => set('yesButtonLabel',v)} placeholder="Attending" />
          </div>
          <div>
            <Toggle label="'Maybe' button" checked={settings.allowMaybe!==false} onChange={v => set('allowMaybe',v)} />
            <Input value={settings.maybeButtonLabel||'Maybe'} onChange={v => set('maybeButtonLabel',v)} placeholder="Maybe" />
          </div>
          <div>
            <Toggle label="'No' button" checked={settings.allowNo!==false} onChange={v => set('allowNo',v)} />
            <Input value={settings.noButtonLabel||'Not Attending'} onChange={v => set('noButtonLabel',v)} placeholder="Not Attending" />
          </div>
        </div>
      </SectionCard>

      {/* ── Form Fields ── */}
      <SectionCard icon={FileText} title="Guest Information Fields" description="What info you collect from each person" accent={accent}>
        <Toggle label="Require last name" hint="By default only first name is required." checked={settings.requireLastName===true} onChange={v => set('requireLastName',v)} />
        <Toggle label="Collect email address" hint="Strongly recommended — needed to send confirmation emails." checked={settings.collectEmail!==false} onChange={v => set('collectEmail',v)} />
        <Toggle label="Make email required" hint="If off, guests can skip the email field." checked={settings.requireEmail!==false} onChange={v => set('requireEmail',v)} disabled={settings.collectEmail===false} />
        <Toggle label="Collect phone number" checked={settings.collectPhone===true} onChange={v => set('collectPhone',v)} />
        <Toggle label="Make phone required" checked={settings.requirePhone===true} onChange={v => set('requirePhone',v)} disabled={!settings.collectPhone} />

        <div className="border-t border-neutral-100 pt-3">
          <Toggle label="Allow plus-ones / extra guests" hint="Guests can bring additional people. You set the max number below." checked={settings.allowPlusOnes===true} onChange={v => set('allowPlusOnes',v)} />
          {settings.allowPlusOnes && (
  <>
    <div className="mt-2 grid grid-cols-2 gap-3">
      <div>
        <Label>Max guests per RSVP</Label>
        <Input type="number" value={settings.maxPlusOnes||5} onChange={v => set('maxPlusOnes', Number(v))} placeholder="5" />
      </div>
      <div className="pt-6">
        <Toggle label="Require guest names" checked={settings.requirePlusOneNames===true} onChange={v => set('requirePlusOneNames',v)} />
      </div>
    </div>
    <Toggle label="Collect dietary for plus-ones" hint="Add a dietary restrictions field for each additional guest." checked={settings.collectPlusOneDietary===true} onChange={v => set('collectPlusOneDietary',v)} />
  </>
)}
        </div>

        <div className="border-t border-neutral-100 pt-3">
          <Toggle label="Ask about dietary requirements" hint="Shows a text box for food allergies, vegetarian, vegan, etc." checked={settings.collectDietary===true} onChange={v => set('collectDietary',v)} />
          {settings.collectDietary && (
            <div className="mt-2">
              <Label tip="(optional)">Label for dietary field</Label>
              <Input value={settings.dietaryLabel||'Dietary requirements'} onChange={v => set('dietaryLabel',v)} placeholder="Dietary requirements" />
            </div>
          )}
        </div>

        <div className="border-t border-neutral-100 pt-3">
          <Toggle label="Ask about accessibility needs" hint="Shows a text box for wheelchair access, hearing loops, etc." checked={settings.collectAccessibility===true} onChange={v => set('collectAccessibility',v)} />
          {settings.collectAccessibility && (
            <div className="mt-2">
              <Label tip="(optional)">Label for accessibility field</Label>
              <Input value={settings.accessibilityLabel||'Accessibility needs'} onChange={v => set('accessibilityLabel',v)} placeholder="Accessibility needs" />
            </div>
          )}
        </div>

        <div className="border-t border-neutral-100 pt-3">
          <Toggle label="Add a free-text notes box" hint="Lets guests write any extra message to you." checked={settings.allowGuestNote===true} onChange={v => set('allowGuestNote',v)} />
          {settings.allowGuestNote && (
            <div className="mt-2 space-y-3">
              <div>
                <Label tip="(optional)">Field label</Label>
                <Input value={settings.guestNoteLabel||'Additional notes'} onChange={v => set('guestNoteLabel',v)} placeholder="Additional notes" />
              </div>
              <div>
                <Label tip="(optional)">Placeholder text</Label>
                <Input value={settings.guestNotePlaceholder||''} onChange={v => set('guestNotePlaceholder',v)} placeholder="e.g. Any other info we should know?" />
              </div>
            </div>
          )}
        </div>
      </SectionCard>

      {/* ── Custom Questions ── */}
      <SectionCard icon={MessageSquare} title="Custom Questions" description="Add your own questions to the RSVP form" accent={accent}>
        <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3 text-xs text-neutral-500 leading-relaxed">
          Add as many custom questions as you need — short text, long answers, dropdowns, multiple choice, and more. Guests see them after filling in their name and email.
        </div>
        <div className="space-y-2">
          {(settings.customQuestions||[]).map(q => (
            <QuestionCard key={q.id} q={q} onChange={updated => updateQ(q.id, updated)} onDelete={() => deleteQ(q.id)} />
          ))}
        </div>
        <button type="button" onClick={addQuestion}
          className="flex items-center gap-2 w-full justify-center py-3 rounded-xl border-2 border-dashed border-neutral-200 hover:border-indigo-300 hover:bg-indigo-50 text-sm font-semibold text-neutral-500 hover:text-indigo-600 transition-all">
          <Plus className="w-4 h-4" /> Add a question
        </button>
      </SectionCard>

      {/* ── Capacity & Deadline ── */}
      <SectionCard icon={Users} title="Capacity & Deadline" description="Limit spots and set an RSVP cutoff date" accent={accent}>
        <div>
          <Label>Capacity limit</Label>
          <Hint>Max number of confirmed attendees. Set to 0 for unlimited. Once full, new RSVPs go to the waitlist (if enabled).</Hint>
          <Input type="number" value={settings.capacityLimit||0} onChange={v => set('capacityLimit', Number(v))} placeholder="0 = unlimited" />
        </div>
        <Toggle label="Enable waitlist when full" hint="People who RSVP after capacity is reached are added to a waitlist and notified if a spot opens." checked={settings.enableWaitlist!==false} onChange={v => set('enableWaitlist',v)} />
        {settings.enableWaitlist && (
          <div>
            <Label tip="(optional)">Waitlist message</Label>
            <Input value={settings.waitlistMessage||''} onChange={v => set('waitlistMessage',v)} placeholder="You're on the waitlist! We'll let you know if a spot opens up." />
          </div>
        )}

        <div className="border-t border-neutral-100 pt-3">
          <Label>RSVP deadline</Label>
          <Hint>After this date and time, the form closes and no new RSVPs are accepted.</Hint>
          <input type="datetime-local" value={settings.deadline||''} onChange={e => set('deadline', e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl text-sm border border-neutral-200 focus:border-indigo-400 outline-none transition-all bg-white text-neutral-900" />
          {settings.deadline && (
            <div>
              <Label tip="(optional)">Deadline message</Label>
              <Input value={settings.deadlineMessage||''} onChange={v => set('deadlineMessage',v)} placeholder="Sorry, RSVPs are now closed." />
            </div>
          )}
        </div>

        <div className="border-t border-neutral-100 pt-3">
          <Toggle label="Allow guests to edit their RSVP" hint="Guests get a personal link to change their response." checked={settings.allowGuestEdit!==false} onChange={v => set('allowGuestEdit',v)} />
          {settings.allowGuestEdit !== false && (
            <div className="mt-2">
              <Label tip="hours before event">Stop allowing edits</Label>
              <Hint>How many hours before the event guests can no longer change their RSVP. Set to 0 for no cutoff.</Hint>
              <Input type="number" value={settings.editCutoffHours??24} onChange={v => set('editCutoffHours', Number(v))} placeholder="24" />
            </div>
          )}
        </div>
      </SectionCard>

      {/* ── Confirmation screen ── */}
      <SectionCard icon={Check} title="Confirmation Screen" description="What guests see after they submit their RSVP" accent={accent}>
        <div>
          <Label>Confirmation heading</Label>
          <Hint>The big heading shown after a successful RSVP. Leave blank for the default "You're on the list!"</Hint>
          <Input value={settings.confirmationTitle||''} onChange={v => set('confirmationTitle',v)} placeholder="You're on the list!" />
        </div>
        <div>
          <Label>Confirmation message</Label>
          <Hint>Supporting text shown below the heading. Great for next steps, dress code reminders, etc.</Hint>
          <Textarea value={settings.confirmationMessage||''} onChange={v => set('confirmationMessage',v)}
            placeholder="We can't wait to see you! Keep an eye on your inbox for event updates." rows={3} />
        </div>
        <div className="border-t border-neutral-100 pt-3">
          <Toggle label="Show 'Add to Calendar' button" hint="One-click adds the event to Google Calendar." checked={settings.showAddToCalendar!==false} onChange={v => set('showAddToCalendar',v)} />
          <Toggle label="Show 'Share Event' button" hint="Lets guests copy the RSVP link to share with friends." checked={settings.showShareButton!==false} onChange={v => set('showShareButton',v)} />
          <Toggle label="Show event space link" hint="Adds a button linking to the full event planning space." checked={settings.showEventSpaceButton===true} onChange={v => set('showEventSpaceButton',v)} />
          {settings.showEventSpaceButton && (
            <div className="mt-2">
              <Label>Button label</Label>
              <Input value={settings.eventSpaceButtonLabel||'View Event Details'} onChange={v => set('eventSpaceButtonLabel',v)} placeholder="View Event Details" />
            </div>
          )}
        </div>
      </SectionCard>

      {/* ── Notifications ── */}
      <SectionCard icon={Mail} title="Email Notifications" description="Who gets notified and when" accent={accent}>
        <Toggle label="Notify me when someone RSVPs" hint="You will get an email every time a new RSVP comes in." checked={settings.notifyOrganizerOnRsvp!==false} onChange={v => set('notifyOrganizerOnRsvp',v)} />

        {settings.notifyOrganizerOnRsvp !== false && (
          <div className="space-y-3 mt-1">
            <div>
              <Label>Send notifications to this email</Label>
              <p className="text-[11px] text-neutral-400 mb-1">Leave blank to use the organizer account email.</p>
              <Input value={settings.organizerNotifyEmail||''} onChange={v => set('organizerNotifyEmail',v)} placeholder="you@example.com" />
            </div>

            <div className="border border-neutral-200 rounded-xl p-3 bg-neutral-50">
              <p className="text-xs font-semibold text-neutral-700 mb-0.5">Send notifications from your Gmail</p>
              <p className="text-[11px] text-neutral-400 mb-3">Connect your Gmail account and RSVP notifications will be sent from your own address instead of a shared platform address.</p>

              {gmailConnected ? (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                    <span className="text-xs font-medium text-neutral-700 truncate">{gmailEmail || 'Gmail connected'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={disconnectGmail}
                    disabled={gmailDisconnecting}
                    className="text-[11px] text-red-500 hover:text-red-700 font-medium shrink-0 disabled:opacity-50"
                  >
                    {gmailDisconnecting ? 'Disconnecting...' : 'Disconnect'}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={connectGmail}
                  disabled={gmailConnecting || !ROUTER_URL}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-neutral-300 bg-white text-xs font-semibold text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  {gmailConnecting ? 'Opening...' : 'Connect Gmail'}
                </button>
              )}
            </div>
          </div>
        )}

        <div className="border-t border-neutral-100 pt-3">
          <Toggle label="Send confirmation email to guests" hint="Guests get an email receipt right after they RSVP." checked={settings.sendGuestConfirmation===true} onChange={v => set('sendGuestConfirmation',v)} />
          {settings.sendGuestConfirmation && (
            <div className="space-y-3 mt-2">
              <div>
                <Label>Email subject line</Label>
                <Input value={settings.confirmationEmailSubject||''} onChange={v => set('confirmationEmailSubject',v)} placeholder="Your RSVP is confirmed - see you there!" />
              </div>
              <div>
                <Label>Email body</Label>
                <Textarea value={settings.confirmationEmailBody||''} onChange={v => set('confirmationEmailBody',v)}
                  placeholder="Hi {{firstName}}, thanks for RSVPing to {{eventName}}! We'll see you on {{eventDate}}." rows={4} />
                <Hint>You can use: <code className="font-mono bg-neutral-100 px-1 rounded text-neutral-600">{`{{firstName}}`}</code>, <code className="font-mono bg-neutral-100 px-1 rounded text-neutral-600">{`{{eventName}}`}</code>, <code className="font-mono bg-neutral-100 px-1 rounded text-neutral-600">{`{{eventDate}}`}</code></Hint>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-neutral-100 pt-3">
          <Label>How to handle RSVPs</Label>
          <Hint>Auto-confirm instantly confirms everyone. Manual approval means you approve each RSVP before they are marked as coming.</Hint>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {[['auto_confirm', 'Auto-confirm', 'Instant confirmed'], ['manual_approval', 'Manual approval', 'You review each']].map(([val, lbl, sub]) => (
              <button key={val} type="button" onClick={() => set('confirmationMode', val)}
                className={`p-3 rounded-xl border-2 text-left transition-all ${settings.confirmationMode===val ? 'border-indigo-500 bg-indigo-50' : 'border-neutral-200 hover:border-neutral-300'}`}>
                <p className="text-xs font-bold text-neutral-800">{lbl}</p>
                <p className="text-[10px] text-neutral-400 mt-0.5">{sub}</p>
              </button>
            ))}
          </div>
        </div>
      </SectionCard>

      {/* ── Security ── */}
      <SectionCard icon={Shield} title="Access & Security" description="Control who can see and submit the RSVP form" accent={accent}>
        <div>
          <Label>Who can access this RSVP page?</Label>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {[['open','Public','Anyone with the link'],['password','Password','Requires a code'],['closed','Closed','Nobody (paused)']].map(([val,lbl,sub]) => (
              <button key={val} type="button" onClick={() => set('accessMode', val)}
                className={`p-3 rounded-xl border-2 text-left transition-all ${settings.accessMode===val ? 'border-indigo-500 bg-indigo-50' : 'border-neutral-200 hover:border-neutral-300'}`}>
                <p className="text-xs font-bold text-neutral-800">{lbl}</p>
                <p className="text-[10px] text-neutral-400 mt-0.5">{sub}</p>
              </button>
            ))}
          </div>
        </div>
        {settings.accessMode === 'password' && (
          <div>
            <Label>Password</Label>
            <Hint>Guests must enter this password to see the RSVP form. Share it with your invitees only.</Hint>
            <Input value={settings.rsvpPassword||''} onChange={v => set('rsvpPassword',v)} placeholder="Enter a password" type="text" />
          </div>
        )}
        <div className="border-t border-neutral-100 pt-3">
          <Toggle label="Enable spam protection" hint="Blocks bots from flooding your RSVP form. Leave this on unless you have a specific reason to turn it off." checked={settings.enableHoneypot!==false} onChange={v => set('enableHoneypot',v)} />
          <div className="mt-3">
            <Label>Duplicate email policy</Label>
            <Hint>What happens if the same email address submits more than once.</Hint>
            <select value={settings.duplicateEmailPolicy||'warn_organizer'} onChange={e => set('duplicateEmailPolicy', e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl text-sm border border-neutral-200 focus:border-indigo-400 outline-none transition-all bg-white text-neutral-900 mt-1">
              <option value="warn_organizer">Allow it, but flag it for you</option>
              <option value="block">Block — reject duplicate submissions</option>
              <option value="allow">Allow all — no duplicate checking</option>
            </select>
          </div>
          <div className="mt-3">
            <Label>Rate limit (per IP address)</Label>
            <Hint>Max RSVPs allowed from the same internet connection. Helps prevent abuse.</Hint>
            <Input type="number" value={settings.rateLimitPerIp||5} onChange={v => set('rateLimitPerIp', Number(v))} placeholder="5" />
          </div>
        </div>
      </SectionCard>
    </div>
  );

  /* ── Render ─────────────────────────────────────────────────────────────── */
  return (
    <div className="h-screen flex flex-col bg-neutral-100 overflow-hidden" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>

      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 px-5 py-3 bg-white border-b border-neutral-200 flex-shrink-0 shadow-sm">
        <button onClick={goBack} className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 transition-colors mr-1">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold text-neutral-900 truncate">
            RSVP Page Builder {event?.title ? `— ${event.title}` : ''}
          </h1>
          <p className="text-xs text-neutral-400">Changes show instantly in the preview →</p>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-1 bg-neutral-100 rounded-xl p-1">
          <button onClick={() => setViewMode('desktop')} title="Desktop preview"
            className={`p-2 rounded-lg transition-all ${viewMode==='desktop' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-400 hover:text-neutral-700'}`}>
            <Monitor className="w-4 h-4" />
          </button>
          <button onClick={() => setViewMode('mobile')} title="Mobile preview"
            className={`p-2 rounded-lg transition-all ${viewMode==='mobile' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-400 hover:text-neutral-700'}`}>
            <Smartphone className="w-4 h-4" />
          </button>
        </div>

        {rsvpUrl && (
          <a href={rsvpUrl} target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 text-xs font-semibold text-neutral-600 hover:text-neutral-900 border border-neutral-200 rounded-xl px-3 py-2 transition-colors hover:bg-neutral-50">
            <ExternalLink className="w-3.5 h-3.5" /> Open live page
          </a>
        )}

        <button
          onClick={save}
          disabled={!dirty || saving || !eventId}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all"
          style={{ background: dirty ? accent : '#e5e7eb', color: dirty ? '#fff' : '#9ca3af', cursor: dirty ? 'pointer' : 'not-allowed' }}
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {/* ── Split layout ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left — settings */}
        <div className="w-[440px] xl:w-[520px] flex-shrink-0 overflow-y-auto bg-neutral-100 px-4 py-5 scrollbar-thin scrollbar-thumb-neutral-300">
          <SettingsPanel />
        </div>

        {/* Divider */}
        <div className="w-px bg-neutral-200 flex-shrink-0" />

        {/* Right — live preview */}
        <div className="flex-1 overflow-hidden relative" style={{ background: '#1a1a2e' }}>
          <div className="absolute inset-0 overflow-auto">
            <div className={`${viewMode === 'desktop' ? 'h-full' : 'min-h-full py-8 px-4'}`}>
              <LivePreview settings={settings} event={event} viewMode={viewMode} />
            </div>
          </div>

          {/* Preview label */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/40 backdrop-blur-sm rounded-lg px-2.5 py-1.5 pointer-events-none">
            <Eye className="w-3 h-3 text-white/60" />
            <span className="text-[10px] font-semibold text-white/60 uppercase tracking-wide">Live Preview</span>
          </div>

          {dirty && (
            <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-amber-500/90 backdrop-blur-sm rounded-lg px-2.5 py-1.5 pointer-events-none">
              <span className="text-[10px] font-bold text-white uppercase tracking-wide">Unsaved changes</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
