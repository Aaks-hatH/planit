import { useState, useEffect, useRef } from 'react';
import {
  Settings, Eye, Shield, Mail, Users, Palette, Type,
  Calendar, Lock, Plus, Trash2, GripVertical, ChevronDown,
  ChevronUp, Check, Save, RefreshCw, AlertTriangle,
  ToggleLeft, ToggleRight, ExternalLink, Copy, Sliders,
  MessageSquare, Star, Tag, Clock, FileText, Layers
} from 'lucide-react';
import toast from 'react-hot-toast';
import { rsvpAPI } from '../services/api';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/* ─── Toggle ──────────────────────────────────────────────────────────────── */
function Toggle({ label, description, checked, onChange, disabled }) {
  return (
    <div className={`flex items-start justify-between gap-4 py-3 ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
      <div>
        <p className="text-sm font-medium text-neutral-800">{label}</p>
        {description && <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">{description}</p>}
      </div>
      <button type="button" onClick={() => onChange(!checked)}
        className={`relative flex-shrink-0 w-10 h-5.5 rounded-full transition-all duration-200 ${checked ? 'bg-indigo-600' : 'bg-neutral-200'}`}
        style={{ height: 22, minWidth: 40 }}>
        <span className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 bg-white rounded-full shadow-sm transition-all duration-200 ${checked ? 'translate-x-[18px]' : ''}`}
          style={{ width: 18, height: 18 }} />
      </button>
    </div>
  );
}

/* ─── Section wrapper ─────────────────────────────────────────────────────── */
function Section({ title, icon: Icon, children, defaultOpen = false, accent }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-neutral-200 overflow-hidden">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3.5 bg-neutral-50 hover:bg-neutral-100 transition-colors text-left">
        <div className="flex items-center gap-2.5">
          {Icon && <Icon className="w-4 h-4 text-neutral-500" />}
          <span className="text-sm font-semibold text-neutral-700">{title}</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
      </button>
      {open && <div className="px-4 pb-4 pt-2 divide-y divide-neutral-100 space-y-0">{children}</div>}
    </div>
  );
}

/* ─── Field wrapper ───────────────────────────────────────────────────────── */
function Field({ label, description, children }) {
  return (
    <div className="py-3">
      {label && <label className="block text-xs font-semibold text-neutral-600 mb-1.5 uppercase tracking-wide">{label}</label>}
      {description && <p className="text-xs text-neutral-400 mb-2 leading-relaxed">{description}</p>}
      {children}
    </div>
  );
}

const inputCls = "w-full px-3 py-2 rounded-lg text-sm border border-neutral-200 focus:border-indigo-400 focus:outline-none transition-colors bg-white text-neutral-900";
const textareaCls = `${inputCls} resize-none`;

/* ─── Custom question editor ──────────────────────────────────────────────── */
const QUESTION_TYPES = [
  { value: 'text',     label: 'Short text' },
  { value: 'textarea', label: 'Long text' },
  { value: 'select',   label: 'Dropdown' },
  { value: 'radio',    label: 'Single choice' },
  { value: 'checkbox', label: 'Multiple choice' },
  { value: 'number',   label: 'Number' },
];

function QuestionEditor({ question, onChange, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const needsOptions = ['select', 'radio', 'checkbox'].includes(question.type);

  const addOption = () => onChange({ ...question, options: [...(question.options || []), ''] });
  const updateOption = (i, v) => {
    const opts = [...(question.options || [])]; opts[i] = v; onChange({ ...question, options: opts });
  };
  const removeOption = (i) => {
    const opts = [...(question.options || [])]; opts.splice(i, 1); onChange({ ...question, options: opts });
  };

  return (
    <div className="border border-neutral-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 bg-neutral-50">
        <GripVertical className="w-4 h-4 text-neutral-300 flex-shrink-0 cursor-grab" />
        <input value={question.label} onChange={e => onChange({ ...question, label: e.target.value })}
          placeholder="Question label" className="flex-1 text-sm font-medium bg-transparent border-none outline-none text-neutral-800" />
        <select value={question.type} onChange={e => onChange({ ...question, type: e.target.value })}
          className="text-xs border border-neutral-200 rounded-lg px-2 py-1 bg-white text-neutral-600">
          {QUESTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <button type="button" onClick={() => setExpanded(o => !o)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-neutral-200 transition-colors">
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        <button type="button" onClick={onDelete} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 transition-colors">
          <Trash2 className="w-3.5 h-3.5 text-red-400" />
        </button>
      </div>
      {expanded && (
        <div className="px-3 pb-3 pt-2 space-y-2.5 border-t border-neutral-100">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-neutral-600">
              <input type="checkbox" checked={question.required || false} onChange={e => onChange({ ...question, required: e.target.checked })} className="rounded" />
              Required
            </label>
          </div>
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Placeholder / help text</label>
            <input value={question.placeholder || ''} onChange={e => onChange({ ...question, placeholder: e.target.value })}
              placeholder="Optional placeholder shown inside field" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Help text shown below question</label>
            <input value={question.helpText || ''} onChange={e => onChange({ ...question, helpText: e.target.value })}
              placeholder="Optional explanatory text" className={inputCls} />
          </div>
          {needsOptions && (
            <div>
              <label className="block text-xs font-semibold text-neutral-500 mb-2 uppercase tracking-wide">Options</label>
              <div className="space-y-1.5">
                {(question.options || []).map((o, i) => (
                  <div key={i} className="flex gap-1.5">
                    <input value={o} onChange={e => updateOption(i, e.target.value)}
                      placeholder={`Option ${i + 1}`} className={`flex-1 ${inputCls}`} />
                    <button type="button" onClick={() => removeOption(i)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 transition-colors flex-shrink-0">
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={addOption}
                  className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 transition-colors py-1">
                  <Plus className="w-3.5 h-3.5" /> Add option
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Main component ──────────────────────────────────────────────────────── */
export default function RSVPSettings({ event, eventId, onSettingsChanged }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [dirty, setDirty]       = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    if (!eventId) return;
    rsvpAPI.getSubmissions(eventId, { limit: 0 })
      .then(() => {}) .catch(() => {});
    // Load from event object if available, otherwise fetch
    if (event?.rsvpPage) {
      setSettings({ ...DEFAULT_SETTINGS, ...event.rsvpPage });
      setLoading(false);
    } else {
      setLoading(false);
      setSettings({ ...DEFAULT_SETTINGS });
    }
  }, [eventId, event]);

  const set = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const save = async () => {
    if (!dirty || !settings) return;
    setSaving(true);
    try {
      await rsvpAPI.updateSettings(eventId, settings);
      toast.success('RSVP page settings saved.');
      setDirty(false);
      onSettingsChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save settings.');
    } finally { setSaving(false); }
  };

  const addQuestion = () => {
    const id = `q_${Date.now()}`;
    const newQ = { id, label: '', type: 'text', required: false, options: [], placeholder: '', helpText: '', order: (settings.customQuestions || []).length };
    set('customQuestions', [...(settings.customQuestions || []), newQ]);
  };

  const updateQuestion = (id, q) => {
    set('customQuestions', (settings.customQuestions || []).map(x => x.id === id ? q : x));
  };

  const deleteQuestion = (id) => {
    set('customQuestions', (settings.customQuestions || []).filter(x => x.id !== id));
  };

  const rsvpUrl = event?.subdomain ? `${window.location.origin}/rsvp/${event.subdomain}` : '';

  const copyUrl = () => {
    navigator.clipboard.writeText(rsvpUrl);
    toast.success('RSVP link copied!');
  };

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-neutral-200 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  const TABS = [
    { id: 'general',      label: 'General',       icon: Settings },
    { id: 'appearance',   label: 'Appearance',     icon: Palette },
    { id: 'form',         label: 'Form Fields',    icon: FileText },
    { id: 'questions',    label: 'Questions',      icon: MessageSquare },
    { id: 'confirmation', label: 'Confirmation',   icon: Check },
    { id: 'notifications',label: 'Notifications',  icon: Mail },
    { id: 'security',     label: 'Security',       icon: Shield },
  ];

  return (
    <div className="space-y-4">

      {/* RSVP link & enable */}
      <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-neutral-800">RSVP Page</p>
            <p className="text-xs text-neutral-500 mt-0.5">When enabled, the shared link leads directly to the RSVP form.</p>
          </div>
          <button type="button" onClick={() => set('enabled', !settings.enabled)}
            className={`relative flex-shrink-0 rounded-full transition-all duration-200 ${settings.enabled ? 'bg-indigo-600' : 'bg-neutral-300'}`}
            style={{ width: 48, height: 26 }}>
            <span className={`absolute top-1 bg-white rounded-full shadow transition-all duration-200 ${settings.enabled ? 'left-6' : 'left-1'}`}
              style={{ width: 18, height: 18 }} />
          </button>
        </div>

        {settings.enabled && rsvpUrl && (
          <div className="flex items-center gap-2 bg-white border border-neutral-200 rounded-lg px-3 py-2">
            <span className="text-xs text-neutral-500 flex-1 truncate">{rsvpUrl}</span>
            <button type="button" onClick={copyUrl} className="flex-shrink-0 text-indigo-600 hover:text-indigo-700">
              <Copy className="w-3.5 h-3.5" />
            </button>
            <a href={rsvpUrl} target="_blank" rel="noreferrer" className="flex-shrink-0 text-neutral-400 hover:text-neutral-600">
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        )}
      </div>

      {/* Save button */}
      {dirty && (
        <div className="sticky top-0 z-10 flex justify-end">
          <button onClick={save} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-all shadow-lg"
            style={{ opacity: saving ? 0.7 : 1 }}>
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
        {TABS.map(tab => (
          <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 ${activeTab === tab.id ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100'}`}>
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── GENERAL ── */}
      {activeTab === 'general' && (
        <div className="space-y-4">
          <Section title="Access & Mode" icon={Lock} defaultOpen>
            <Field label="Access Mode">
              <div className="grid grid-cols-3 gap-2">
                {[['open', 'Open', 'Anyone with the link'], ['password', 'Password', 'Requires a password'], ['closed', 'Closed', 'Not accepting RSVPs']].map(([val, label, sub]) => (
                  <button key={val} type="button" onClick={() => set('accessMode', val)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${settings.accessMode === val ? 'border-indigo-500 bg-indigo-50' : 'border-neutral-200 hover:border-neutral-300'}`}>
                    <p className="text-xs font-bold text-neutral-800">{label}</p>
                    <p className="text-xs text-neutral-400 mt-0.5">{sub}</p>
                  </button>
                ))}
              </div>
            </Field>

            {settings.accessMode === 'password' && (
              <Field label="RSVP Password" description="Guests must enter this to access the form.">
                <input type="text" value={settings.rsvpPassword || ''} onChange={e => set('rsvpPassword', e.target.value)}
                  placeholder="Enter a password" className={inputCls} />
              </Field>
            )}

            <Field label="Confirmation Mode" description="How to handle incoming RSVPs.">
              <div className="grid grid-cols-2 gap-2">
                {[['auto_confirm', 'Auto-Confirm', 'RSVPs are confirmed instantly'], ['approval', 'Require Approval', 'You review each RSVP manually']].map(([val, label, sub]) => (
                  <button key={val} type="button" onClick={() => set('confirmationMode', val)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${settings.confirmationMode === val ? 'border-indigo-500 bg-indigo-50' : 'border-neutral-200 hover:border-neutral-300'}`}>
                    <p className="text-xs font-bold text-neutral-800">{label}</p>
                    <p className="text-xs text-neutral-400 mt-0.5">{sub}</p>
                  </button>
                ))}
              </div>
            </Field>
          </Section>

          <Section title="Capacity & Deadline" icon={Users} defaultOpen>
            <Field label="RSVP Deadline" description="After this date, the form closes automatically.">
              <input type="datetime-local" value={settings.deadline ? new Date(settings.deadline).toISOString().slice(0, 16) : ''} onChange={e => set('deadline', e.target.value || null)} className={inputCls} />
            </Field>
            <Field label="Deadline Message" description="Shown when the deadline has passed.">
              <input value={settings.deadlineMessage || ''} onChange={e => set('deadlineMessage', e.target.value)} placeholder="e.g. RSVPs are now closed — see you there!" className={inputCls} />
            </Field>
            <Field label="Capacity Limit" description="Maximum number of 'Attending' RSVPs. Set to 0 for unlimited.">
              <input type="number" min={0} value={settings.capacityLimit || 0} onChange={e => set('capacityLimit', Number(e.target.value))} className={inputCls} />
            </Field>
            <Toggle label="Enable Waitlist" description="When at capacity, additional guests join a waitlist instead of being rejected."
              checked={settings.enableWaitlist !== false} onChange={v => set('enableWaitlist', v)} disabled={!settings.capacityLimit} />
            <Field label="Waitlist Message" description="Shown when a guest is added to the waitlist.">
              <input value={settings.waitlistMessage || ''} onChange={e => set('waitlistMessage', e.target.value)} placeholder="e.g. You're on the waitlist — we'll be in touch." className={inputCls} />
            </Field>
          </Section>

          <Section title="Response Options" icon={Check}>
            <Toggle label="Allow 'Attending'" checked={settings.allowYes !== false} onChange={v => set('allowYes', v)} />
            <Field label="Attending Button Label">
              <input value={settings.yesButtonLabel || 'Attending'} onChange={e => set('yesButtonLabel', e.target.value)} className={inputCls} />
            </Field>
            <Toggle label="Allow 'Maybe'" checked={settings.allowMaybe !== false} onChange={v => set('allowMaybe', v)} />
            <Field label="Maybe Button Label">
              <input value={settings.maybeButtonLabel || 'Maybe'} onChange={e => set('maybeButtonLabel', e.target.value)} className={inputCls} />
            </Field>
            <Toggle label="Allow 'Not Attending'" checked={settings.allowNo !== false} onChange={v => set('allowNo', v)} />
            <Field label="Not Attending Button Label">
              <input value={settings.noButtonLabel || 'Not Attending'} onChange={e => set('noButtonLabel', e.target.value)} className={inputCls} />
            </Field>
          </Section>

          <Section title="Display Options" icon={Eye}>
            <Toggle label="Show guest count" description="Show how many people are attending on the RSVP page."
              checked={settings.showGuestCount !== false} onChange={v => set('showGuestCount', v)} />
            <Toggle label="Show event date" checked={settings.showEventDate !== false} onChange={v => set('showEventDate', v)} />
            <Toggle label="Show event location" checked={settings.showEventLocation !== false} onChange={v => set('showEventLocation', v)} />
            <Toggle label="Show event description" checked={settings.showEventDescription !== false} onChange={v => set('showEventDescription', v)} />
            <Toggle label="Show host name" checked={settings.showHostName !== false} onChange={v => set('showHostName', v)} />
            <Toggle label="Show countdown timer" description="Display a live countdown to the event date."
              checked={settings.showCountdown === true} onChange={v => set('showCountdown', v)} />
            <Toggle label="Show event space link" description="Show a link to enter the event planning space after RSVP."
              checked={settings.showEventSpaceButton === true} onChange={v => set('showEventSpaceButton', v)} />
            <Toggle label="Allow guest to edit RSVP" description="Guests can edit their RSVP via a personal link."
              checked={settings.allowGuestEdit !== false} onChange={v => set('allowGuestEdit', v)} />
            <Field label="Edit cutoff (hours before event)" description="How many hours before the event the guest can no longer edit.">
              <input type="number" min={0} value={settings.editCutoffHours ?? 24} onChange={e => set('editCutoffHours', Number(e.target.value))} className={inputCls} />
            </Field>
          </Section>
        </div>
      )}

      {/* ── APPEARANCE ── */}
      {activeTab === 'appearance' && (
        <div className="space-y-4">
          <Section title="Branding" icon={Palette} defaultOpen>
            <Field label="Accent Color" description="Primary button and highlight color.">
              <div className="flex gap-2 items-center">
                <input type="color" value={settings.accentColor || '#6366f1'} onChange={e => set('accentColor', e.target.value)}
                  className="w-10 h-9 rounded-lg border border-neutral-200 cursor-pointer bg-white p-0.5" />
                <input type="text" value={settings.accentColor || '#6366f1'} onChange={e => set('accentColor', e.target.value)}
                  placeholder="#6366f1" className={`flex-1 ${inputCls}`} />
              </div>
              <div className="flex gap-2 mt-2 flex-wrap">
                {['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#0ea5e9', '#f97316'].map(c => (
                  <button key={c} type="button" onClick={() => set('accentColor', c)}
                    className="w-7 h-7 rounded-lg border-2 transition-all"
                    style={{ background: c, borderColor: settings.accentColor === c ? '#fff' : 'transparent', boxShadow: settings.accentColor === c ? `0 0 0 2px ${c}` : 'none' }} />
                ))}
              </div>
            </Field>
            <Field label="Cover Image URL" description="Wide image shown at the top of the RSVP page.">
              <input value={settings.coverImageUrl || ''} onChange={e => set('coverImageUrl', e.target.value)} placeholder="https://…" className={inputCls} />
            </Field>
            <Field label="Logo URL" description="Your logo shown above the event title.">
              <input value={settings.logoUrl || ''} onChange={e => set('logoUrl', e.target.value)} placeholder="https://…" className={inputCls} />
            </Field>
            <Toggle label="Hide PlanIt branding" description="Remove 'Powered by PlanIt' from the footer."
              checked={settings.hideBranding === true} onChange={v => set('hideBranding', v)} />
          </Section>

          <Section title="Background & Font" icon={Type}>
            <Field label="Background Style">
              <div className="grid grid-cols-2 gap-2">
                {[['dark', 'Dark', 'Deep dark background'], ['light', 'Light', 'Clean white background'], ['gradient', 'Gradient', 'Dark with color accent gradient'], ['frosted', 'Frosted', 'Frosted glass dark']].map(([val, label, sub]) => (
                  <button key={val} type="button" onClick={() => set('backgroundStyle', val)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${settings.backgroundStyle === val ? 'border-indigo-500 bg-indigo-50' : 'border-neutral-200 hover:border-neutral-300'}`}>
                    <p className="text-xs font-bold text-neutral-800">{label}</p>
                    <p className="text-xs text-neutral-400 mt-0.5">{sub}</p>
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Font Style">
              <div className="grid grid-cols-2 gap-2">
                {[['modern', 'Modern', 'Clean sans-serif'], ['classic', 'Classic', 'Serif typography'], ['elegant', 'Elegant', 'Light, spaced lettering'], ['bold', 'Bold', 'Heavy, impactful']].map(([val, label, sub]) => (
                  <button key={val} type="button" onClick={() => set('fontStyle', val)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${settings.fontStyle === val ? 'border-indigo-500 bg-indigo-50' : 'border-neutral-200 hover:border-neutral-300'}`}>
                    <p className="text-xs font-bold text-neutral-800">{label}</p>
                    <p className="text-xs text-neutral-400 mt-0.5">{sub}</p>
                  </button>
                ))}
              </div>
            </Field>
          </Section>

          <Section title="Announcement Banner" icon={Layers}>
            <Toggle label="Enable banner" description="Show a sticky banner at the top of the RSVP page."
              checked={settings.bannerEnabled === true} onChange={v => set('bannerEnabled', v)} />
            <Field label="Banner text">
              <input value={settings.bannerText || ''} onChange={e => set('bannerText', e.target.value)} placeholder="e.g. Spots are filling fast — RSVP now!" className={inputCls} />
            </Field>
            <Field label="Banner color">
              <div className="flex gap-2 items-center">
                <input type="color" value={settings.bannerColor || '#f59e0b'} onChange={e => set('bannerColor', e.target.value)}
                  className="w-10 h-9 rounded-lg border border-neutral-200 cursor-pointer bg-white p-0.5" />
                <input type="text" value={settings.bannerColor || '#f59e0b'} onChange={e => set('bannerColor', e.target.value)} className={`flex-1 ${inputCls}`} />
              </div>
            </Field>
          </Section>

          <Section title="Hero Content" icon={Star}>
            <Field label="Tagline" description="Small label shown above the event title (e.g. 'You're invited').">
              <input value={settings.heroTagline || ''} onChange={e => set('heroTagline', e.target.value)} placeholder="You're invited" className={inputCls} />
            </Field>
            <Field label="Welcome Title" description="Overrides the event title on the RSVP page.">
              <input value={settings.welcomeTitle || ''} onChange={e => set('welcomeTitle', e.target.value)} placeholder="Leave blank to use event title" className={inputCls} />
            </Field>
            <Field label="Welcome Message" description="Shown below the title. Supports multiple paragraphs.">
              <textarea value={settings.welcomeMessage || ''} onChange={e => set('welcomeMessage', e.target.value)} rows={4}
                placeholder="Write a warm welcome message for your guests…" className={textareaCls} />
            </Field>
          </Section>
        </div>
      )}

      {/* ── FORM FIELDS ── */}
      {activeTab === 'form' && (
        <div className="space-y-4">
          <Section title="Guest Information" icon={Users} defaultOpen>
            <Toggle label="Require first name" checked={settings.requireFirstName !== false} onChange={v => set('requireFirstName', v)} />
            <Toggle label="Collect last name" checked={settings.requireLastName === true} onChange={v => set('requireLastName', v)} />
            <Toggle label="Collect email address" checked={settings.collectEmail !== false} onChange={v => set('collectEmail', v)} />
            <Toggle label="Require email address" checked={settings.requireEmail !== false} onChange={v => set('requireEmail', v)}
              disabled={!settings.collectEmail} />
            <Toggle label="Collect phone number" checked={settings.collectPhone === true} onChange={v => set('collectPhone', v)} />
            <Toggle label="Require phone number" checked={settings.requirePhone === true} onChange={v => set('requirePhone', v)}
              disabled={!settings.collectPhone} />
          </Section>

          <Section title="Plus-Ones / Additional Guests" icon={Users}>
            <Toggle label="Allow plus-ones" description="Guests can indicate they're bringing additional people."
              checked={settings.allowPlusOnes === true} onChange={v => set('allowPlusOnes', v)} />
            <Field label="Maximum additional guests per RSVP">
              <input type="number" min={1} max={50} value={settings.maxPlusOnes ?? 5} onChange={e => set('maxPlusOnes', Number(e.target.value))} className={inputCls} />
            </Field>
            <Toggle label="Require plus-one names" description="Collect first and last name for each additional guest."
              checked={settings.requirePlusOneNames === true} onChange={v => set('requirePlusOneNames', v)}
              disabled={!settings.allowPlusOnes} />
            <Toggle label="Collect dietary info per plus-one" description="Ask for dietary requirements for each additional guest."
              checked={settings.collectPlusOneDietary === true} onChange={v => set('collectPlusOneDietary', v)}
              disabled={!settings.allowPlusOnes} />
          </Section>

          <Section title="Additional Fields" icon={FileText}>
            <Toggle label="Collect dietary requirements"
              checked={settings.collectDietary === true} onChange={v => set('collectDietary', v)} />
            <Field label="Dietary field label">
              <input value={settings.dietaryLabel || 'Dietary requirements'} onChange={e => set('dietaryLabel', e.target.value)} className={inputCls} />
            </Field>
            <Toggle label="Collect accessibility needs"
              checked={settings.collectAccessibility === true} onChange={v => set('collectAccessibility', v)} />
            <Field label="Accessibility field label">
              <input value={settings.accessibilityLabel || 'Accessibility needs'} onChange={e => set('accessibilityLabel', e.target.value)} className={inputCls} />
            </Field>
            <Toggle label="Allow guest note / message"
              description="An open-ended field for guests to leave a message."
              checked={settings.allowGuestNote === true} onChange={v => set('allowGuestNote', v)} />
            <Field label="Guest note label">
              <input value={settings.guestNoteLabel || 'Additional notes'} onChange={e => set('guestNoteLabel', e.target.value)} className={inputCls} />
            </Field>
            <Field label="Guest note placeholder">
              <input value={settings.guestNotePlaceholder || ''} onChange={e => set('guestNotePlaceholder', e.target.value)} placeholder="e.g. Any special requests?" className={inputCls} />
            </Field>
          </Section>
        </div>
      )}

      {/* ── CUSTOM QUESTIONS ── */}
      {activeTab === 'questions' && (
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-100">
            <p className="text-xs text-indigo-700 leading-relaxed">
              Add custom questions to collect any information you need from guests — meal preferences, shirt sizes, workshop selections, and more.
            </p>
          </div>

          {(settings.customQuestions || []).map((q, i) => (
            <QuestionEditor
              key={q.id}
              question={q}
              onChange={(updated) => updateQuestion(q.id, updated)}
              onDelete={() => deleteQuestion(q.id)}
            />
          ))}

          <button type="button" onClick={addQuestion}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-neutral-300 text-sm font-semibold text-neutral-500 hover:border-indigo-400 hover:text-indigo-600 transition-all">
            <Plus className="w-4 h-4" /> Add Question
          </button>
        </div>
      )}

      {/* ── CONFIRMATION ── */}
      {activeTab === 'confirmation' && (
        <div className="space-y-4">
          <Section title="Confirmation Screen" icon={Check} defaultOpen>
            <Field label="Confirmation Title" description="Headline shown after a successful RSVP.">
              <input value={settings.confirmationTitle || ''} onChange={e => set('confirmationTitle', e.target.value)} placeholder="You're on the list!" className={inputCls} />
            </Field>
            <Field label="Confirmation Message" description="Message shown below the title. Supports multiple paragraphs.">
              <textarea value={settings.confirmationMessage || ''} onChange={e => set('confirmationMessage', e.target.value)} rows={4}
                placeholder="We're so excited to celebrate with you. Details to follow soon!" className={textareaCls} />
            </Field>
            <Field label="Confirmation Image URL" description="Optional image shown on the confirmation screen.">
              <input value={settings.confirmationImageUrl || ''} onChange={e => set('confirmationImageUrl', e.target.value)} placeholder="https://…" className={inputCls} />
            </Field>
            <Toggle label="Show 'Add to Calendar' button" checked={settings.showAddToCalendar !== false} onChange={v => set('showAddToCalendar', v)} />
            <Toggle label="Show 'Share Event' button" checked={settings.showShareButton !== false} onChange={v => set('showShareButton', v)} />
            <Toggle label="Show link to Event Space" description="A button that takes guests into the planning space."
              checked={settings.showEventSpaceButton === true} onChange={v => set('showEventSpaceButton', v)} />
            <Field label="Event Space button label">
              <input value={settings.eventSpaceButtonLabel || 'View Event Details'} onChange={e => set('eventSpaceButtonLabel', e.target.value)} className={inputCls} />
            </Field>
          </Section>
        </div>
      )}

      {/* ── NOTIFICATIONS ── */}
      {activeTab === 'notifications' && (
        <div className="space-y-4">
          <Section title="Organizer Notifications" icon={Mail} defaultOpen>
            <Toggle label="Notify me on each RSVP" description="Receive an email each time someone RSVPs."
              checked={settings.notifyOrganizerOnRsvp !== false} onChange={v => set('notifyOrganizerOnRsvp', v)} />
            <Field label="Notification email address" description="Defaults to your account email if left blank.">
              <input type="email" value={settings.organizerNotifyEmail || ''} onChange={e => set('organizerNotifyEmail', e.target.value)} placeholder="organizer@example.com" className={inputCls} />
            </Field>
          </Section>

          <Section title="Guest Confirmation Email" icon={Mail}>
            <Toggle label="Send confirmation email to guests" description="Guests receive an email after submitting their RSVP. Requires email collection to be enabled."
              checked={settings.sendGuestConfirmation === true} onChange={v => set('sendGuestConfirmation', v)}
              disabled={!settings.collectEmail} />
            <Field label="Email subject">
              <input value={settings.confirmationEmailSubject || ''} onChange={e => set('confirmationEmailSubject', e.target.value)}
                placeholder="e.g. You're confirmed for [Event Name]!" className={inputCls} />
            </Field>
            <Field label="Email body" description="Plain text message sent to the guest. Keep it friendly and include any key details.">
              <textarea value={settings.confirmationEmailBody || ''} onChange={e => set('confirmationEmailBody', e.target.value)} rows={6}
                placeholder="Hi [First Name],&#10;&#10;We can't wait to see you at [Event Name]…" className={textareaCls} />
            </Field>
          </Section>
        </div>
      )}

      {/* ── SECURITY ── */}
      {activeTab === 'security' && (
        <div className="space-y-4">
          <Section title="Submission Security" icon={Shield} defaultOpen>
            <Field label="Rate limit (submissions per IP per hour)" description="Prevents a single person from flooding your form.">
              <input type="number" min={1} max={100} value={settings.rateLimitPerIp ?? 5} onChange={e => set('rateLimitPerIp', Number(e.target.value))} className={inputCls} />
            </Field>
            <Field label="Duplicate email policy" description="Controls what happens when two RSVPs share the same email address.">
              <select value={settings.duplicateEmailPolicy || 'warn_organizer'} onChange={e => set('duplicateEmailPolicy', e.target.value)}
                className={inputCls}>
                <option value="allow">Allow duplicates</option>
                <option value="warn_organizer">Allow but notify organizer</option>
                <option value="block">Block duplicate emails</option>
              </select>
            </Field>
            <Toggle label="Enable honeypot bot protection" description="Invisible field that catches automated form submissions."
              checked={settings.enableHoneypot !== false} onChange={v => set('enableHoneypot', v)} />
          </Section>

          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <p className="text-xs font-semibold text-amber-700">Security Recommendations</p>
            </div>
            <ul className="text-xs text-amber-600 space-y-1 list-disc list-inside">
              <li>Use password protection for private events</li>
              <li>Enable approval mode for high-priority events</li>
              <li>Keep duplicate email policy set to at least "notify organizer"</li>
              <li>Review the RSVP dashboard regularly for suspicious submissions</li>
            </ul>
          </div>
        </div>
      )}

      {/* Bottom save */}
      {dirty && (
        <div className="pt-2">
          <button onClick={save} disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-all"
            style={{ opacity: saving ? 0.7 : 1 }}>
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      )}
    </div>
  );
}

// Default settings object
const DEFAULT_SETTINGS = {
  enabled: false,
  accessMode: 'open',
  rsvpPassword: '',
  confirmationMode: 'auto_confirm',
  coverImageUrl: '',
  logoUrl: '',
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
  collectPlusOneDietary: false,
  collectDietary: false,
  dietaryLabel: 'Dietary requirements',
  collectAccessibility: false,
  accessibilityLabel: 'Accessibility needs',
  allowGuestNote: false,
  guestNoteLabel: 'Additional notes',
  guestNotePlaceholder: '',
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
