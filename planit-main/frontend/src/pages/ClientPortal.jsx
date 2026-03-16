/**
 * ClientPortal.jsx
 *
 * White-label client self-service dashboard.
 * Served at /dashboard on the client's custom domain.
 *
 * Only renders when:
 *   1. The app is running on a WL domain (isWL === true from context)
 *   2. The WL record has portal.enabled === true
 *
 * Security:
 *   - Token stored in sessionStorage (cleared on tab close, not persisted)
 *   - All API calls include Authorization: Bearer <token>
 *   - Token sent as Origin header so backend can domain-bind it
 *   - Session auto-expires at token TTL (8h), countdown shown
 *   - Re-auth prompt on any 401 response
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useWhiteLabel } from '../context/WhiteLabelContext';

const API = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');
const TOKEN_KEY = 'wl_portal_token';
const TOKEN_TTL = 8 * 60 * 60 * 1000; // 8h in ms

// ─── Icons (inline SVG — no extra deps) ───────────────────────────────────────
const Icon = ({ d, size = 16, stroke = 'currentColor', ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...p}>
    <path d={d} />
  </svg>
);
const IcoPalette  = () => <Icon d="M12 2a10 10 0 100 20 10 10 0 000-20zM2 12h4m12 0h4M12 2v4m0 12v4" />;
const IcoPages    = () => <Icon d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zM14 2v6h6M9 13h6M9 17h4" />;
const IcoToggle   = () => <Icon d="M12 2a10 10 0 100 20 10 10 0 000-20zM9 9h6M9 15h6" />;
const IcoLock     = () => <Icon d="M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2zM7 11V7a5 5 0 0110 0v4" />;
const IcoAudit    = () => <Icon d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />;
const IcoEye      = () => <Icon d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 100 6 3 3 0 000-6z" />;
const IcoEyeOff   = () => <Icon d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24M1 1l22 22" />;
const IcoLogout   = () => <Icon d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />;
const IcoCheck    = () => <Icon d="M20 6L9 17l-5-5" />;
const IcoAlert    = () => <Icon d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01" />;

// ─── Shared UI primitives ──────────────────────────────────────────────────────
function Card({ children, className = '' }) {
  return (
    <div className={`bg-white rounded-xl border border-neutral-200 ${className}`}
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      {children}
    </div>
  );
}

function SectionHeader({ title, subtitle }) {
  return (
    <div className="px-6 py-5 border-b border-neutral-100">
      <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
      {subtitle && <p className="text-xs text-neutral-500 mt-0.5">{subtitle}</p>}
    </div>
  );
}

function Field({ label, children, hint }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-neutral-600 mb-1.5" style={{ letterSpacing: '0.05em', textTransform: 'uppercase', fontSize: '0.67rem' }}>
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-neutral-400 mt-1">{hint}</p>}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = 'text', disabled, maxLength }) {
  return (
    <input
      type={type} value={value} onChange={onChange} placeholder={placeholder}
      disabled={disabled} maxLength={maxLength}
      className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-900 placeholder-neutral-400 outline-none transition-all disabled:opacity-50"
      onFocus={e => { e.target.style.borderColor = '#3b82f6'; e.target.style.background = '#fff'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)'; }}
      onBlur={e => { e.target.style.borderColor = '#e5e5e5'; e.target.style.background = '#fafafa'; e.target.style.boxShadow = 'none'; }}
    />
  );
}

function Textarea({ value, onChange, placeholder, rows = 3, maxLength }) {
  return (
    <textarea
      value={value} onChange={onChange} placeholder={placeholder}
      rows={rows} maxLength={maxLength}
      className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-900 placeholder-neutral-400 outline-none transition-all resize-none"
      onFocus={e => { e.target.style.borderColor = '#3b82f6'; e.target.style.background = '#fff'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)'; }}
      onBlur={e => { e.target.style.borderColor = '#e5e5e5'; e.target.style.background = '#fafafa'; e.target.style.boxShadow = 'none'; }}
    />
  );
}

function Toggle({ value, onChange, label, disabled }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none" style={disabled ? { opacity: 0.4, pointerEvents: 'none' } : {}}>
      <div
        onClick={() => onChange(!value)}
        className="relative flex-shrink-0"
        style={{ width: 40, height: 22 }}
      >
        <div style={{
          width: 40, height: 22, borderRadius: 11,
          background: value ? '#3b82f6' : '#d1d5db',
          transition: 'background 0.2s',
        }} />
        <div style={{
          position: 'absolute', top: 3, left: value ? 21 : 3,
          width: 16, height: 16, borderRadius: '50%', background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          transition: 'left 0.2s',
        }} />
      </div>
      <span className="text-sm text-neutral-700">{label}</span>
    </label>
  );
}

function SaveButton({ onClick, saving, saved }) {
  return (
    <button
      onClick={onClick} disabled={saving}
      className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg text-white transition-all disabled:opacity-60"
      style={{ background: saved ? '#22c55e' : 'linear-gradient(135deg,#3b82f6,#6366f1)', minWidth: 100 }}
    >
      {saving ? (
        <><span className="spinner w-3.5 h-3.5 border-2 border-white/30 border-t-white" />Saving...</>
      ) : saved ? (
        <><IcoCheck />Saved</>
      ) : 'Save changes'}
    </button>
  );
}

function Toast({ msg, type }) {
  if (!msg) return null;
  const colors = { success: '#22c55e', error: '#ef4444', info: '#3b82f6' };
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      padding: '12px 20px', borderRadius: 10, background: colors[type] || '#111',
      color: '#fff', fontSize: '0.875rem', fontWeight: 500,
      boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
      animation: 'fadeIn 0.2s ease-out',
    }}>
      {msg}
    </div>
  );
}

// ─── Section: Branding ────────────────────────────────────────────────────────
function BrandingSection({ data, tier, token, onUpdate, toast }) {
  const [form, setForm] = useState({
    companyName:   data?.companyName   || '',
    primaryColor:  data?.primaryColor  || '#2563eb',
    accentColor:   data?.accentColor   || '#1d4ed8',
    fontFamily:    data?.fontFamily    || 'Inter',
    logoUrl:       data?.logoUrl       || '',
    faviconUrl:    data?.faviconUrl    || '',
    hidePoweredBy: data?.hidePoweredBy || false,
    customCss:     data?.customCss     || '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setSaved(false); };

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch(`${API}/wl-portal/branding`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Save failed');
      onUpdate('branding', j.branding);
      setSaved(true);
      toast('Branding saved', 'success');
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const FONTS = ['Inter', 'DM Sans', 'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Playfair Display', 'Georgia'];

  return (
    <Card>
      <SectionHeader title="Branding" subtitle="Logo, colors, and fonts shown across your platform" />
      <div className="p-6 space-y-5">
        <Field label="Company name" hint="Shown in the browser tab and page headers">
          <Input value={form.companyName} onChange={e => set('companyName', e.target.value)} placeholder="Your Business Name" maxLength={200} />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Primary color">
            <div className="flex items-center gap-2">
              <input type="color" value={form.primaryColor} onChange={e => set('primaryColor', e.target.value)}
                className="w-10 h-9 rounded-lg border border-neutral-200 cursor-pointer p-0.5 bg-neutral-50" />
              <Input value={form.primaryColor} onChange={e => set('primaryColor', e.target.value)} placeholder="#2563eb" maxLength={9} />
            </div>
          </Field>
          <Field label="Accent color">
            <div className="flex items-center gap-2">
              <input type="color" value={form.accentColor} onChange={e => set('accentColor', e.target.value)}
                className="w-10 h-9 rounded-lg border border-neutral-200 cursor-pointer p-0.5 bg-neutral-50" />
              <Input value={form.accentColor} onChange={e => set('accentColor', e.target.value)} placeholder="#1d4ed8" maxLength={9} />
            </div>
          </Field>
        </div>

        <Field label="Font family">
          <select
            value={form.fontFamily} onChange={e => set('fontFamily', e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-900 outline-none"
          >
            {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </Field>

        <Field label="Logo URL" hint="Direct link to your logo image (PNG or SVG recommended)">
          <Input value={form.logoUrl} onChange={e => set('logoUrl', e.target.value)} placeholder="https://..." />
        </Field>

        <Field label="Favicon URL" hint="Direct link to your favicon (.ico or 32×32 PNG)">
          <Input value={form.faviconUrl} onChange={e => set('faviconUrl', e.target.value)} placeholder="https://..." />
        </Field>

        {(tier === 'pro' || tier === 'enterprise') && (
          <Toggle
            value={form.hidePoweredBy}
            onChange={v => set('hidePoweredBy', v)}
            label="Hide 'Powered by PlanIt' badge"
          />
        )}

        {tier === 'enterprise' && (
          <Field label="Custom CSS" hint="Advanced: injected on every page. Use with care.">
            <Textarea
              value={form.customCss}
              onChange={e => set('customCss', e.target.value)}
              placeholder="/* your custom styles */"
              rows={6}
              maxLength={10000}
            />
          </Field>
        )}

        <div className="flex justify-end pt-2">
          <SaveButton onClick={save} saving={saving} saved={saved} />
        </div>
      </div>
    </Card>
  );
}

// ─── Section: Pages ───────────────────────────────────────────────────────────
function PagesSection({ data, branding, token, onUpdate, toast }) {
  const [form, setForm] = useState({
    home: {
      headline:              data?.home?.headline              || '',
      subheadline:           data?.home?.subheadline           || '',
      heroImageUrl:          data?.home?.heroImageUrl          || '',
      ctaText:               data?.home?.ctaText               || '',
      showSearch:            data?.home?.showSearch            !== false,
      tableServiceEventId:   data?.home?.tableServiceEventId   || '',
    },
    events: {
      headline:       data?.events?.headline       || '',
      emptyStateText: data?.events?.emptyStateText || '',
    },
    checkout: {
      headerNote:      data?.checkout?.headerNote      || '',
      successHeadline: data?.checkout?.successHeadline || '',
      successMessage:  data?.checkout?.successMessage  || '',
      footerNote:      data?.checkout?.footerNote      || '',
    },
    contact: {
      email:   data?.contact?.email   || '',
      phone:   data?.contact?.phone   || '',
      address: data?.contact?.address || '',
    },
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tab, setTab] = useState('home');

  const set = (page, k, v) => {
    setForm(f => ({ ...f, [page]: { ...f[page], [k]: v } }));
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch(`${API}/wl-portal/pages`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Save failed');
      onUpdate('pages', j.pages);
      setSaved(true);
      toast('Page content saved', 'success');
      setTimeout(() => setSaved(false), 3000);
    } catch (e) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  const TABS = [
    { id: 'home',        label: 'Home' },
    { id: 'reservation', label: 'Reservation Page' },
    { id: 'events',      label: 'Events' },
    { id: 'checkout',    label: 'Checkout' },
    { id: 'contact',     label: 'Contact' },
  ];

  return (
    <Card>
      <SectionHeader title="Page content" subtitle="Customize text and content shown on each page" />
      <div className="flex border-b border-neutral-100">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-5 py-3 text-xs font-semibold transition-colors ${tab === t.id ? 'text-blue-600 border-b-2 border-blue-500 -mb-px' : 'text-neutral-500 hover:text-neutral-800'}`}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="p-6 space-y-5">
        {tab === 'home' && <>
          <Field label="Main headline" hint="Large text shown at the top of your home page">
            <Input value={form.home.headline} onChange={e => set('home', 'headline', e.target.value)} placeholder="Book your next event" maxLength={200} />
          </Field>
          <Field label="Subheadline">
            <Input value={form.home.subheadline} onChange={e => set('home', 'subheadline', e.target.value)} placeholder="Discover upcoming events and reserve your spot" maxLength={400} />
          </Field>
          <Field label="Hero image URL" hint="Large background or banner image on the home page">
            <Input value={form.home.heroImageUrl} onChange={e => set('home', 'heroImageUrl', e.target.value)} placeholder="https://..." />
          </Field>
          <Field label="Call-to-action button text">
            <Input value={form.home.ctaText} onChange={e => set('home', 'ctaText', e.target.value)} placeholder="Browse events" maxLength={60} />
          </Field>
          <Toggle value={form.home.showSearch} onChange={v => set('home', 'showSearch', v)} label="Show search bar on home page" />
        </>}

        {tab === 'reservation' && <>
          <Field
            label="Linked table service event"
            hint="When set, your home page (/) redirects straight to this event's table service floor instead of showing the events grid. Paste the event subdomain from its URL — e.g. if your event lives at /e/nobu-downtown, enter nobu-downtown."
          >
            <Input
              value={form.home.tableServiceEventId}
              onChange={e => set('home', 'tableServiceEventId', e.target.value.trim())}
              placeholder="e.g. nobu-downtown"
              maxLength={200}
            />
          </Field>
          {form.home.tableServiceEventId && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-100 text-xs text-blue-700">
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="flex-shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
              Guests visiting your home page will be redirected to <strong className="mx-1">/e/{form.home.tableServiceEventId}/floor</strong>. Make sure that event exists and has table service enabled before saving.
            </div>
          )}
          {!form.home.tableServiceEventId && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-neutral-50 border border-neutral-200 text-xs text-neutral-500">
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="flex-shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
              Leave blank to keep the default events grid on your home page.
            </div>
          )}
        </>}

        {tab === 'events' && <>
          <Field label="Events page headline">
            <Input value={form.events.headline} onChange={e => set('events', 'headline', e.target.value)} placeholder="Upcoming events" maxLength={200} />
          </Field>
          <Field label="Empty state text" hint="Shown when there are no upcoming events">
            <Textarea value={form.events.emptyStateText} onChange={e => set('events', 'emptyStateText', e.target.value)} placeholder="No events scheduled right now. Check back soon." maxLength={300} />
          </Field>
        </>}

        {tab === 'checkout' && <>
          <Field label="Header note" hint="Small notice shown above the checkout form (refund policy, etc.)">
            <Textarea value={form.checkout.headerNote} onChange={e => set('checkout', 'headerNote', e.target.value)} placeholder="All sales are final. No refunds." maxLength={500} />
          </Field>
          <Field label="Success headline" hint="Shown after a successful purchase">
            <Input value={form.checkout.successHeadline} onChange={e => set('checkout', 'successHeadline', e.target.value)} placeholder="You're confirmed!" maxLength={200} />
          </Field>
          <Field label="Success message">
            <Textarea value={form.checkout.successMessage} onChange={e => set('checkout', 'successMessage', e.target.value)} placeholder="Check your email for your ticket and details." maxLength={500} />
          </Field>
          <Field label="Footer note" hint="Fine print below the checkout form">
            <Textarea value={form.checkout.footerNote} onChange={e => set('checkout', 'footerNote', e.target.value)} placeholder="Questions? Email us at..." maxLength={300} />
          </Field>
        </>}

        {tab === 'contact' && <>
          <Field label="Contact email" hint="Shown on your platform for customer inquiries">
            <Input type="email" value={form.contact.email} onChange={e => set('contact', 'email', e.target.value)} placeholder="hello@yourbusiness.com" />
          </Field>
          <Field label="Phone number">
            <Input value={form.contact.phone} onChange={e => set('contact', 'phone', e.target.value)} placeholder="+1 555 000 0000" maxLength={40} />
          </Field>
          <Field label="Address">
            <Textarea value={form.contact.address} onChange={e => set('contact', 'address', e.target.value)} placeholder="123 Main St, City, State 00000" maxLength={300} rows={2} />
          </Field>
        </>}

        {/* Live Preview — only show when editing home or reservation tab */}
        {(tab === 'home' || tab === 'reservation') && (
          <div>
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Live Preview</p>
            <div className="rounded-xl border border-neutral-200 overflow-hidden text-sm"
              style={{ fontFamily: `'${branding?.fontFamily || 'Inter'}', sans-serif` }}>
              <div className="flex items-center gap-2 px-4 py-2.5 bg-white border-b border-neutral-100">
                {branding?.logoUrl
                  ? <img src={branding.logoUrl} alt="" style={{ height: 20, objectFit: 'contain' }} onError={e => e.target.style.display = 'none'} />
                  : <div style={{ width: 20, height: 20, borderRadius: 5, background: branding?.primaryColor || '#2563eb', flexShrink: 0 }} />
                }
                <span className="font-bold text-neutral-900 text-xs">{branding?.companyName || 'Your Business'}</span>
              </div>
              <div style={{
                background: form.home.heroImageUrl
                  ? `linear-gradient(rgba(0,0,0,0.45),rgba(0,0,0,0.45)), url(${form.home.heroImageUrl}) center/cover`
                  : `linear-gradient(135deg, ${branding?.primaryColor || '#2563eb'}20, ${branding?.primaryColor || '#2563eb'}06)`,
                padding: '24px 16px',
                textAlign: 'center',
              }}>
                <div className="font-bold mb-1 text-sm" style={{ color: form.home.heroImageUrl ? '#fff' : '#111' }}>
                  {form.home.headline || `Welcome to ${branding?.companyName || 'Your Business'}`}
                </div>
                <div className="text-xs mb-3" style={{ color: form.home.heroImageUrl ? 'rgba(255,255,255,0.8)' : '#666' }}>
                  {form.home.subheadline || 'Browse and book upcoming events.'}
                </div>
                {form.home.tableServiceEventId ? (
                  <div className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                    style={{ background: branding?.primaryColor || '#2563eb' }}>
                    → Redirects to /e/{form.home.tableServiceEventId}/floor
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                    style={{ background: branding?.primaryColor || '#2563eb' }}>
                    {form.home.ctaText || 'Browse events'}
                  </div>
                )}
              </div>
              {(form.contact?.email || form.contact?.phone) && (
                <div className="flex gap-4 px-4 py-2 bg-white border-t border-neutral-100 text-xs"
                  style={{ color: branding?.primaryColor || '#2563eb' }}>
                  {form.contact.email && <span>{form.contact.email}</span>}
                  {form.contact.phone && <span>{form.contact.phone}</span>}
                </div>
              )}
              <div className="flex items-center justify-between px-4 py-2 bg-white border-t border-neutral-100">
                <span className="text-xs text-neutral-400">{branding?.companyName || 'Your Business'}</span>
                {!branding?.hidePoweredBy && <span className="text-xs text-neutral-300">Powered by PlanIt</span>}
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <SaveButton onClick={save} saving={saving} saved={saved} />
        </div>
      </div>
    </Card>
  );
}

// ─── Section: Features ────────────────────────────────────────────────────────
function FeaturesSection({ data, tier, token, onUpdate, toast }) {
  const [features, setFeatures] = useState({
    showGuestList:    data?.showGuestList    !== false,
    showWaitlist:     data?.showWaitlist     !== false,
    showSeatingChart: data?.showSeatingChart || false,
    showSocialShare:  data?.showSocialShare  !== false,
    showReviews:      data?.showReviews      || false,
    allowGuestSignup: data?.allowGuestSignup !== false,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const ITEMS = [
    { key: 'showGuestList',    label: 'Guest list',          hint: 'Show attendee list on event pages' },
    { key: 'showWaitlist',     label: 'Waitlist',            hint: 'Let guests join waitlist for sold-out events' },
    { key: 'showSeatingChart', label: 'Seating chart',       hint: 'Visual seating selection at checkout', proOnly: true },
    { key: 'showSocialShare',  label: 'Social sharing',      hint: 'Share buttons on event pages' },
    { key: 'showReviews',      label: 'Reviews',             hint: 'Post-event review prompts and display' },
    { key: 'allowGuestSignup', label: 'Guest self-checkout', hint: 'Allow ticket purchase without an account' },
  ];

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch(`${API}/wl-portal/features`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(features),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Save failed');
      onUpdate('features', j.features);
      setSaved(true);
      toast('Features saved', 'success');
      setTimeout(() => setSaved(false), 3000);
    } catch (e) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  return (
    <Card>
      <SectionHeader title="Features" subtitle="Turn platform features on or off for your customers" />
      <div className="p-6 space-y-4">
        {ITEMS.map(({ key, label, hint, proOnly }) => {
          const locked = proOnly && tier === 'basic';
          return (
            <div key={key} className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-neutral-800 flex items-center gap-2">
                  {label}
                  {locked && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-medium">Pro+</span>}
                </p>
                <p className="text-xs text-neutral-500 mt-0.5">{hint}</p>
              </div>
              <Toggle
                value={features[key]}
                onChange={v => { setFeatures(f => ({ ...f, [key]: v })); setSaved(false); }}
                label=""
                disabled={locked}
              />
            </div>
          );
        })}
        <div className="flex justify-end pt-2">
          <SaveButton onClick={save} saving={saving} saved={saved} />
        </div>
      </div>
    </Card>
  );
}

// ─── Section: Security ────────────────────────────────────────────────────────
function SecuritySection({ token, toast }) {
  const [form, setForm]     = useState({ current: '', next: '', confirm: '' });
  const [show, setShow]     = useState({ current: false, next: false });
  const [saving, setSaving] = useState(false);
  const [audit, setAudit]   = useState(null);

  useEffect(() => {
    fetch(`${API}/wl-portal/audit`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(r => r.json()).then(setAudit).catch(() => {});
  }, [token]);

  const changePassword = async () => {
    if (form.next !== form.confirm) return toast('New passwords do not match', 'error');
    if (form.next.length < 12) return toast('Password must be at least 12 characters', 'error');
    setSaving(true);
    try {
      const r = await fetch(`${API}/wl-portal/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: form.current, newPassword: form.next }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setForm({ current: '', next: '', confirm: '' });
      toast('Password changed successfully', 'success');
    } catch (e) { toast(e.message, 'error'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <Card>
        <SectionHeader title="Change password" subtitle="Minimum 12 characters" />
        <div className="p-6 space-y-4">
          {[
            { key: 'current', label: 'Current password',  showKey: 'current' },
            { key: 'next',    label: 'New password',       showKey: 'next' },
            { key: 'confirm', label: 'Confirm new password', showKey: 'next' },
          ].map(({ key, label, showKey }) => (
            <Field key={key} label={label}>
              <div className="relative">
                <Input
                  type={show[showKey] ? 'text' : 'password'}
                  value={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder="••••••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShow(s => ({ ...s, [showKey]: !s[showKey] }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                >
                  {show[showKey] ? <IcoEyeOff /> : <IcoEye />}
                </button>
              </div>
            </Field>
          ))}
          <div className="flex justify-end pt-1">
            <button
              onClick={changePassword} disabled={saving || !form.current || !form.next || !form.confirm}
              className="px-4 py-2 text-sm font-medium rounded-lg text-white disabled:opacity-50 transition-all"
              style={{ background: 'linear-gradient(135deg,#3b82f6,#6366f1)' }}
            >
              {saving ? 'Saving...' : 'Update password'}
            </button>
          </div>
        </div>
      </Card>

      {audit && (
        <Card>
          <SectionHeader title="Login history" subtitle="Last 20 sign-in attempts" />
          <div className="divide-y divide-neutral-100">
            {(audit.recentLogins || []).length === 0 && (
              <p className="px-6 py-4 text-sm text-neutral-400">No login history.</p>
            )}
            {(audit.recentLogins || []).map((entry, i) => (
              <div key={i} className="flex items-center justify-between px-6 py-3 text-xs">
                <div className="flex items-center gap-3">
                  <span className={`w-1.5 h-1.5 rounded-full ${entry.success ? 'bg-green-400' : 'bg-red-400'}`} />
                  <span className="text-neutral-600 font-mono">{entry.ip}</span>
                  <span className="text-neutral-400 max-w-xs truncate hidden sm:block">{entry.ua}</span>
                </div>
                <div className="flex items-center gap-3 text-neutral-400">
                  <span className={entry.success ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
                    {entry.success ? 'Success' : 'Failed'}
                  </span>
                  <span>{new Date(entry.ts).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Login screen ─────────────────────────────────────────────────────────────
function LoginScreen({ wl, onLogin }) {
  const [password, setPassword] = useState('');
  const [show, setShow]         = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [locked, setLocked]     = useState(false);
  const inputRef = useRef();

  const primary = wl?.branding?.primaryColor || '#3b82f6';
  const company = wl?.branding?.companyName  || wl?.clientName || 'Client Portal';
  const logo    = wl?.branding?.logoUrl      || null;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const r = await fetch(`${API}/wl-portal/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const j = await r.json();
      if (r.status === 429 || j.locked) {
        setLocked(true);
        setError(j.error || 'Too many attempts. Try again later.');
        return;
      }
      if (!r.ok) {
        setError(j.error || 'Incorrect password.');
        setPassword('');
        inputRef.current?.focus();
        return;
      }
      // Store token in sessionStorage — cleared when tab closes
      const expiry = Date.now() + TOKEN_TTL;
      sessionStorage.setItem(TOKEN_KEY, JSON.stringify({ token: j.token, expiry }));
      onLogin(j.token, j.client);
    } catch {
      setError('Could not connect. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4"
      style={{ fontFamily: `'${wl?.branding?.fontFamily || 'Inter'}', system-ui, sans-serif` }}>
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden"
          style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>

          {/* Header */}
          <div className="px-8 pt-8 pb-6 border-b border-neutral-100 text-center">
            {logo
              ? <img src={logo} alt={company} className="h-10 mx-auto mb-4 object-contain" />
              : (
                <div className="w-10 h-10 rounded-xl mx-auto mb-4 flex items-center justify-center"
                  style={{ background: primary, boxShadow: `0 4px 12px ${primary}40` }}>
                  <IcoLock size={18} stroke="#fff" />
                </div>
              )
            }
            <h1 className="text-lg font-bold text-neutral-900">{company}</h1>
            <p className="text-sm text-neutral-500 mt-0.5">Client dashboard</p>
          </div>

          {/* Form */}
          <form onSubmit={submit} className="px-8 py-6 space-y-4">
            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-700">
                <IcoAlert size={14} stroke="#ef4444" />
                {error}
              </div>
            )}
            <Field label="Password">
              <div className="relative">
                <input
                  ref={inputRef}
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoFocus
                  placeholder="Enter your portal password"
                  className="w-full px-3 py-2.5 pr-10 text-sm rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-900 outline-none transition-all"
                  onFocus={e => { e.target.style.borderColor = primary; e.target.style.background = '#fff'; e.target.style.boxShadow = `0 0 0 3px ${primary}20`; }}
                  onBlur={e => { e.target.style.borderColor = '#e5e5e5'; e.target.style.background = '#fafafa'; e.target.style.boxShadow = 'none'; }}
                />
                <button type="button" onClick={() => setShow(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600">
                  {show ? <IcoEyeOff /> : <IcoEye />}
                </button>
              </div>
            </Field>

            <button type="submit" disabled={loading || locked || !password}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50"
              style={{ background: `linear-gradient(135deg, ${primary}, ${primary}cc)` }}>
              {loading ? <><span className="spinner w-4 h-4 border-2 border-white/30 border-t-white" />Signing in...</> : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center mt-5 text-xs text-neutral-400">
          Forgot your password? Contact your PlanIt account manager.
        </p>
      </div>
    </div>
  );
}

// ─── Main ClientPortal ────────────────────────────────────────────────────────
export default function ClientPortal() {
  const { wl, isWL, resolved } = useWhiteLabel();
  const [token, setToken]    = useState(null);
  const [client, setClient]  = useState(null);
  const [data, setData]      = useState({ branding: {}, pages: {}, features: {} });
  const [section, setSection] = useState('branding');
  const [toast, setToastMsg]  = useState({ msg: '', type: 'info' });
  const [sessionExpiry, setSessionExpiry] = useState(null);
  const [timeLeft, setTimeLeft] = useState('');

  const showToast = (msg, type = 'info') => {
    setToastMsg({ msg, type });
    setTimeout(() => setToastMsg({ msg: '', type: 'info' }), 3500);
  };

  // Restore session from sessionStorage on mount
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(TOKEN_KEY);
      if (!raw) return;
      const { token: t, expiry } = JSON.parse(raw);
      if (expiry < Date.now()) { sessionStorage.removeItem(TOKEN_KEY); return; }
      setToken(t);
      setSessionExpiry(expiry);
    } catch { sessionStorage.removeItem(TOKEN_KEY); }
  }, []);

  // Load /me once token is set
  useEffect(() => {
    if (!token) return;
    fetch(`${API}/wl-portal/me`, { headers: { 'Authorization': `Bearer ${token}` } })
      .then(r => {
        if (r.status === 401) { handleLogout(); return null; }
        return r.json();
      })
      .then(j => {
        if (!j) return;
        setClient(j);
        setData({ branding: j.branding || {}, pages: j.pages || {}, features: j.features || {} });
      })
      .catch(() => {});
  }, [token]);

  // Session countdown
  useEffect(() => {
    if (!sessionExpiry) return;
    const tick = () => {
      const left = sessionExpiry - Date.now();
      if (left <= 0) { handleLogout(); return; }
      const h = Math.floor(left / 3600000);
      const m = Math.floor((left % 3600000) / 60000);
      setTimeLeft(h > 0 ? `${h}h ${m}m` : `${m}m`);
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [sessionExpiry]);

  const handleLogin = (t, c) => {
    setToken(t);
    setClient(c);
    const expiry = Date.now() + TOKEN_TTL;
    setSessionExpiry(expiry);
  };

  const handleLogout = () => {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setClient(null);
    setData({ branding: {}, pages: {}, features: {} });
  };

  const handleUpdate = (key, val) => {
    setData(d => ({ ...d, [key]: val }));
  };

  // Not a WL domain
  if (!resolved) return null;
  if (!isWL) return <div className="min-h-screen flex items-center justify-center bg-neutral-50 text-sm text-neutral-400">Not a white-label domain.</div>;
  if (resolved && isWL && wl && !wl.portalEnabled) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-neutral-50 text-center px-6" style={{ fontFamily: "'Inter',system-ui,sans-serif" }}>
      {wl.branding?.logoUrl
        ? <img src={wl.branding.logoUrl} alt="" style={{ height: 36, marginBottom: 24, objectFit: 'contain' }} />
        : <div style={{ width: 36, height: 36, borderRadius: 10, background: wl.branding?.primaryColor || '#2563eb', marginBottom: 24 }} />}
      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111', marginBottom: 8 }}>Client portal unavailable</h1>
      <p style={{ fontSize: '0.875rem', color: '#6b7280', maxWidth: 340, lineHeight: 1.6 }}>
        The self-service portal hasn't been enabled for this account yet. Please contact the site owner for assistance.
      </p>
    </div>
  );

  // Not logged in
  if (!token) return <LoginScreen wl={wl} onLogin={handleLogin} />;

  const tier = client?.tier || wl?.tier || 'basic';
  const company = client?.branding?.companyName || client?.clientName || 'Portal';

  const NAV = [
    { id: 'branding', label: 'Branding',  Icon: IcoPalette },
    { id: 'pages',    label: 'Pages',     Icon: IcoPages },
    { id: 'features', label: 'Features',  Icon: IcoToggle },
    { id: 'security', label: 'Security & Activity', Icon: IcoLock },
  ];

  return (
    <div className="min-h-screen flex" style={{ background: '#f5f5f5', fontFamily: `'${data.branding?.fontFamily || 'Inter'}', system-ui, sans-serif` }}>

      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-52 flex-shrink-0" style={{ background: '#0a0a0a', borderRight: '1px solid rgba(255,255,255,0.06)', position: 'sticky', top: 0, height: '100vh' }}>
        {/* Logo */}
        <div className="h-14 flex items-center gap-3 px-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {data.branding?.logoUrl
            ? <img src={data.branding.logoUrl} alt={company} className="h-7 object-contain" />
            : <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: data.branding?.primaryColor || '#3b82f6' }}>
                <IcoPalette size={14} stroke="#fff" />
              </div>
          }
          <span className="text-sm font-semibold text-white truncate">{company}</span>
        </div>

        {/* Tier badge */}
        <div className="px-4 py-2.5">
          <span className="text-xs px-2 py-0.5 rounded font-medium"
            style={{ background: tier === 'enterprise' ? '#7c3aed20' : tier === 'pro' ? '#2563eb20' : '#374151', color: tier === 'enterprise' ? '#a78bfa' : tier === 'pro' ? '#93c5fd' : '#9ca3af', textTransform: 'capitalize' }}>
            {tier}
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-1 space-y-0.5">
          {NAV.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setSection(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${section === id ? 'bg-white/10 text-white' : 'text-neutral-500 hover:bg-white/5 hover:text-neutral-300'}`}>
              <Icon size={15} />
              {label}
            </button>
          ))}
        </nav>

        {/* Session info + logout */}
        <div className="p-3 space-y-1" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          {timeLeft && (
            <p className="text-xs text-neutral-600 px-1">Session: {timeLeft}</p>
          )}
          <button onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-neutral-600 hover:bg-white/5 hover:text-neutral-400 transition-all">
            <IcoLogout size={13} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 flex items-center px-6 gap-4 bg-white" style={{ borderBottom: '1px solid #e5e5e5' }}>
          <div>
            <span className="text-sm font-semibold text-neutral-900">
              {NAV.find(n => n.id === section)?.label}
            </span>
          </div>
          <div className="flex-1" />
          {client?.status === 'trial' && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-medium">Trial</span>
          )}
          <button onClick={handleLogout} className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-700 transition-colors md:hidden">
            <IcoLogout size={14} /> Sign out
          </button>
        </header>

        {/* Content */}
        <main className="flex-1 p-6 max-w-2xl w-full mx-auto">
          {section === 'branding' && (
            <BrandingSection data={data.branding} tier={tier} token={token} onUpdate={handleUpdate} toast={showToast} />
          )}
          {section === 'pages' && (
            <PagesSection data={data.pages} branding={data.branding} token={token} onUpdate={handleUpdate} toast={showToast} />
          )}
          {section === 'features' && (
            <FeaturesSection data={data.features} tier={tier} token={token} onUpdate={handleUpdate} toast={showToast} />
          )}
          {section === 'security' && (
            <SecuritySection token={token} toast={showToast} />
          )}


          {/* Billing card */}
          {client?.billing && (
            <div className="mt-5">
              <Card>
                <div className="px-6 py-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-neutral-500 uppercase" style={{ letterSpacing: '0.06em', fontSize: '0.67rem' }}>Billing</p>
                    <p className="text-sm font-medium text-neutral-800 mt-0.5 capitalize">{client.billing.billingStatus || 'Unknown'}</p>
                    {client.billing.nextBillingDate && (
                      <p className="text-xs text-neutral-400 mt-0.5">
                        Next billing: {new Date(client.billing.nextBillingDate).toLocaleDateString()}
                      </p>
                    )}
                    {client.billing.trialEndsAt && (
                      <p className="text-xs text-amber-600 mt-0.5">
                        Trial ends: {new Date(client.billing.trialEndsAt).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-neutral-900">
                      ${((client.billing.monthlyAmount || 0) / 100).toFixed(0)}
                      <span className="text-xs font-normal text-neutral-400">/mo</span>
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </main>
      </div>

      <Toast msg={toast.msg} type={toast.type} />

      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }
        .spinner { border-radius:50%; animation:spin .75s linear infinite; }
        @keyframes spin { to { transform:rotate(360deg); } }
      `}</style>
    </div>
  );
}
