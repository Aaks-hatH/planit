/**
 * frontend/src/components/LandingPageEditor.jsx
 *
 * Organizer editor for the public landing page (/discover/:key). Fully
 * controlled: OrganizerSettings owns the state and saves it with the rest of
 * the settings. Everything typed here is shown publicly.
 */
import { useState } from 'react';
import { Plus, Trash2, ExternalLink, Info, Copy, Check } from 'lucide-react';

export const EMPTY_LANDING = {
  tagline: '', ctaLabel: '', hostBio: '', contactEmail: '',
  showEventSpaceInfo: false,
  joinMode: 'rsvp',   // 'rsvp' → guests go to the RSVP page · 'space' → guests go to the event space
  highlights: [], sections: [], faqs: [], links: [],
};

export const normalizeLanding = (lp) => ({ ...EMPTY_LANDING, ...(lp || {}) });

const ICONS = [
  ['star', 'Star'], ['clock', 'Time'], ['map', 'Place'], ['ticket', 'Tickets'], ['gift', 'Gift'],
  ['car', 'Parking'], ['utensils', 'Food'], ['heart', 'Heart'], ['shirt', 'Dress code'],
  ['accessibility', 'Accessibility'], ['wifi', 'Wi-Fi'], ['music', 'Music'], ['camera', 'Photos'],
  ['users', 'People'], ['sparkles', 'Special'],
];

const SECTION_IDEAS = ['What to bring', 'Parking and getting there', 'Dress code', 'Accessibility', 'Who should come', 'About the organization'];
const FAQ_IDEAS = ['Is it free?', 'Can I bring a friend?', 'What if I need to cancel?', 'Is food provided?'];

function Block({ title, hint, count, max, children }) {
  return (
    <div className="border border-neutral-200 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-neutral-800">{title}</p>
          {hint && <p className="text-xs text-neutral-500 mt-0.5">{hint}</p>}
        </div>
        {max != null && <span className="text-[11px] text-neutral-400 flex-shrink-0">{count}/{max}</span>}
      </div>
      {children}
    </div>
  );
}

/* ─── Where the public button sends guests ────────────────────────────────── */
function JoinTargetBlock({ v, set, slug, eventType, rsvpEnabled, rsvpAccess }) {
  const [copied, setCopied] = useState('');
  const rsvpOnly = eventType === 'rsvpOnly';
  const mode = rsvpOnly ? 'rsvp' : (v.joinMode === 'space' ? 'space' : 'rsvp');
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const rsvpUrl  = `${origin}/rsvp/${slug}`;
  const spaceUrl = `${origin}/e/${slug}`;
  const rsvpClosed = rsvpEnabled && rsvpAccess === 'closed';

  const copy = async (key, url) => {
    try { await navigator.clipboard.writeText(url); setCopied(key); setTimeout(() => setCopied(''), 1800); } catch { /* ignore */ }
  };

  let warning = null;
  if (mode === 'rsvp') {
    if (rsvpClosed) warning = 'Your RSVP page is set to closed, so the button will say “RSVPs closed”. Reopen it in the RSVP builder when you’re ready.';
    else if (!rsvpEnabled && rsvpOnly) warning = 'Your RSVP page isn’t turned on, so the button will say “RSVPs closed”. Turn it on in the RSVP builder.';
    else if (!rsvpEnabled) warning = 'Your RSVP page isn’t turned on yet, so guests are sent to the event space for now. Turn it on in the RSVP builder and they’ll go to the RSVP page instead.';
  }

  const Option = ({ value, title, tag, body }) => {
    const active = mode === value;
    return (
      <button type="button" role="radio" aria-checked={active} onClick={() => set({ joinMode: value })}
        className={`flex-1 text-left rounded-xl border p-3.5 transition-all ${active ? 'border-neutral-900 bg-neutral-50 ring-1 ring-neutral-900' : 'border-neutral-200 hover:border-neutral-400'}`}>
        <div className="flex items-center gap-2">
          <span className={`grid h-4 w-4 place-items-center rounded-full border ${active ? 'border-neutral-900' : 'border-neutral-300'}`}>
            {active && <span className="h-2 w-2 rounded-full bg-neutral-900" />}
          </span>
          <span className="text-sm font-semibold text-neutral-800">{title}</span>
          {tag && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">{tag}</span>}
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-neutral-500">{body}</p>
      </button>
    );
  };

  const LinkRow = ({ id, label, note, url }) => (
    <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-neutral-700">{label}</p>
        <p className="truncate text-[11px] text-neutral-400" title={url}>{url}</p>
        <p className="text-[11px] text-neutral-500">{note}</p>
      </div>
      <button type="button" onClick={() => copy(id, url)} className="flex flex-none items-center gap-1 rounded-lg border border-neutral-200 px-2.5 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50">
        {copied === id ? <><Check className="w-3.5 h-3.5 text-emerald-600" />Copied</> : <><Copy className="w-3.5 h-3.5" />Copy</>}
      </button>
    </div>
  );

  return (
    <Block title="Where guests go when they click" hint="Controls the main button on Discover and on your public page.">
      {rsvpOnly ? (
        <p className="rounded-lg bg-neutral-50 px-3 py-2.5 text-xs leading-relaxed text-neutral-600">
          This is an RSVP-only event, so guests always go to your RSVP page. Your event link (<span className="font-mono">/e/{slug}</span>) is your organizer dashboard.
        </p>
      ) : (
        <div role="radiogroup" aria-label="Where the join button goes" className="flex flex-col gap-2.5 sm:flex-row">
          <Option value="rsvp" tag="Recommended" title="RSVP page"
            body="Guests reserve a spot on a simple page. Planning, check-in and settings stay with you and your team." />
          <Option value="space" title="Event space"
            body="Guests join the live event space to chat, vote in polls and see updates. Pick this when guests take part online." />
        </div>
      )}

      {warning && (
        <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800">
          <Info className="w-4 h-4 flex-shrink-0 mt-px" />
          <p>{warning} <a href={`/e/${slug}/rsvp-builder`} className="font-semibold underline">Open RSVP builder</a></p>
        </div>
      )}

      <div className="space-y-2 pt-1">
        <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-400">Your links</p>
        {mode === 'rsvp' ? (
          <>
            <LinkRow id="rsvp" label="Guest link — share this" note="Send it in invites, texts and posts. No account needed." url={rsvpUrl} />
            <LinkRow id="space" label="Organizer link — keep this private" note="Planning, check-in, guest list and settings. For you and your team." url={spaceUrl} />
          </>
        ) : (
          <>
            <LinkRow id="space" label="Event space link — share this" note="Guests pick a name and join. Organizers sign in from here too." url={spaceUrl} />
            <LinkRow id="rsvp" label="RSVP page link (optional)" note="Handy if you also want a simple sign-up page." url={rsvpUrl} />
          </>
        )}
      </div>
    </Block>
  );
}

function Counter({ value, max }) {
  return <span className="text-[10px] text-neutral-400 ml-auto">{(value || '').length}/{max}</span>;
}

export default function LandingPageEditor({ value, onChange, isPublic, slug, eventType, rsvpEnabled, rsvpAccess }) {
  const v = value;
  const set = (patch) => onChange({ ...v, ...patch });
  const setItem = (key, idx, patch) => set({ [key]: v[key].map((it, i) => (i === idx ? { ...it, ...patch } : it)) });
  const addItem = (key, blank, max) => { if (v[key].length < max) set({ [key]: [...v[key], blank] }); };
  const removeItem = (key, idx) => set({ [key]: v[key].filter((_, i) => i !== idx) });

  return (
    <div className="space-y-5">
      <div className={`flex gap-2.5 rounded-xl border p-3.5 text-xs leading-relaxed ${isPublic ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <div>
          {isPublic
            ? <>This is your event’s public page. Anything you add here is visible to everyone.{slug && <> <a href={`/discover/${slug}`} target="_blank" rel="noopener noreferrer" className="font-semibold underline inline-flex items-center gap-1">Open it<ExternalLink className="w-3 h-3" /></a> (save first to see changes).</>}</>
            : <>The public page only goes live when <strong>Public Event</strong> is turned on in the Features tab. You can write it now and publish later.</>}
        </div>
      </div>

      <JoinTargetBlock v={v} set={set} slug={slug} eventType={eventType} rsvpEnabled={rsvpEnabled} rsvpAccess={rsvpAccess} />

      {/* Tagline + button */}
      <Block title="Headline and button" hint="A short line under your event title, and what the main button says.">
        <div>
          <div className="flex items-center mb-1.5"><label className="text-xs font-medium text-neutral-600">Tagline</label><Counter value={v.tagline} max={160} /></div>
          <input className="input text-sm rounded-xl" maxLength={160} value={v.tagline} onChange={e => set({ tagline: e.target.value })}
            placeholder="e.g. A free Saturday of hands-on coding for middle schoolers" />
        </div>
        <div>
          <div className="flex items-center mb-1.5"><label className="text-xs font-medium text-neutral-600">Join button text (optional)</label><Counter value={v.ctaLabel} max={40} /></div>
          <input className="input text-sm rounded-xl" maxLength={40} value={v.ctaLabel} onChange={e => set({ ctaLabel: e.target.value })}
            placeholder="e.g. Save my seat" />
        </div>
      </Block>

      {/* Highlights */}
      <Block title="At a glance" hint="Up to 6 quick facts shown as cards at the top: cost, parking, dress code, what's included." count={v.highlights.length} max={6}>
        {v.highlights.map((h, i) => (
          <div key={i} className="flex gap-2 items-start">
            <select className="input text-sm rounded-xl w-32 flex-shrink-0" value={h.icon} onChange={e => setItem('highlights', i, { icon: e.target.value })}>
              {ICONS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
            <div className="flex-1 space-y-1.5 min-w-0">
              <input className="input text-sm rounded-xl" maxLength={60} value={h.title} onChange={e => setItem('highlights', i, { title: e.target.value })} placeholder="Title, e.g. Free entry" />
              <input className="input text-sm rounded-xl" maxLength={160} value={h.text} onChange={e => setItem('highlights', i, { text: e.target.value })} placeholder="Details, e.g. Lunch and snacks included" />
            </div>
            <button type="button" onClick={() => removeItem('highlights', i)} aria-label="Remove" className="btn btn-ghost p-2 text-neutral-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
        {v.highlights.length < 6 && (
          <button type="button" onClick={() => addItem('highlights', { icon: 'star', title: '', text: '' }, 6)} className="btn btn-secondary text-xs gap-1 rounded-xl"><Plus className="w-3.5 h-3.5" />Add a fact</button>
        )}
      </Block>

      {/* Sections */}
      <Block title="Your own sections" hint="Anything you want people to know. Each one gets its own heading on the page." count={v.sections.length} max={8}>
        {v.sections.map((sec, i) => (
          <div key={i} className="rounded-xl bg-neutral-50 border border-neutral-100 p-3 space-y-2">
            <div className="flex gap-2">
              <input className="input text-sm rounded-xl flex-1" maxLength={80} value={sec.title} onChange={e => setItem('sections', i, { title: e.target.value })} placeholder="Heading, e.g. What to bring" />
              <button type="button" onClick={() => removeItem('sections', i)} aria-label="Remove section" className="btn btn-ghost p-2 text-neutral-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
            </div>
            <textarea className="input text-sm rounded-xl min-h-[96px]" maxLength={3000} value={sec.body} onChange={e => setItem('sections', i, { body: e.target.value })} placeholder="Write it however you like. Line breaks are kept." />
            <div className="flex"><Counter value={sec.body} max={3000} /></div>
          </div>
        ))}
        {v.sections.length < 8 && (
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => addItem('sections', { title: '', body: '' }, 8)} className="btn btn-secondary text-xs gap-1 rounded-xl"><Plus className="w-3.5 h-3.5" />Add section</button>
            {SECTION_IDEAS.filter(t => !v.sections.some(s => s.title === t)).slice(0, 4).map(t => (
              <button key={t} type="button" onClick={() => addItem('sections', { title: t, body: '' }, 8)} className="px-2.5 py-1 rounded-full text-xs border border-neutral-200 text-neutral-500 hover:border-neutral-400 hover:text-neutral-700">+ {t}</button>
            ))}
          </div>
        )}
      </Block>

      {/* FAQ */}
      <Block title="Questions and answers" hint="Answer what people always ask, so they don't have to message you." count={v.faqs.length} max={10}>
        {v.faqs.map((f, i) => (
          <div key={i} className="rounded-xl bg-neutral-50 border border-neutral-100 p-3 space-y-2">
            <div className="flex gap-2">
              <input className="input text-sm rounded-xl flex-1" maxLength={160} value={f.q} onChange={e => setItem('faqs', i, { q: e.target.value })} placeholder="Question" />
              <button type="button" onClick={() => removeItem('faqs', i)} aria-label="Remove question" className="btn btn-ghost p-2 text-neutral-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
            </div>
            <textarea className="input text-sm rounded-xl min-h-[64px]" maxLength={800} value={f.a} onChange={e => setItem('faqs', i, { a: e.target.value })} placeholder="Answer" />
          </div>
        ))}
        {v.faqs.length < 10 && (
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => addItem('faqs', { q: '', a: '' }, 10)} className="btn btn-secondary text-xs gap-1 rounded-xl"><Plus className="w-3.5 h-3.5" />Add question</button>
            {FAQ_IDEAS.filter(t => !v.faqs.some(f => f.q === t)).slice(0, 3).map(t => (
              <button key={t} type="button" onClick={() => addItem('faqs', { q: t, a: '' }, 10)} className="px-2.5 py-1 rounded-full text-xs border border-neutral-200 text-neutral-500 hover:border-neutral-400 hover:text-neutral-700">+ {t}</button>
            ))}
          </div>
        )}
      </Block>

      {/* Links */}
      <Block title="Links" hint="Your website, donation page, sponsor, social media. Only http and https links are kept." count={v.links.length} max={6}>
        {v.links.map((l, i) => (
          <div key={i} className="flex gap-2">
            <input className="input text-sm rounded-xl w-36 flex-shrink-0" maxLength={40} value={l.label} onChange={e => setItem('links', i, { label: e.target.value })} placeholder="Label" />
            <input className="input text-sm rounded-xl flex-1 min-w-0" maxLength={300} value={l.url} onChange={e => setItem('links', i, { url: e.target.value })} placeholder="https://" />
            <button type="button" onClick={() => removeItem('links', i)} aria-label="Remove link" className="btn btn-ghost p-2 text-neutral-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
        {v.links.length < 6 && (
          <button type="button" onClick={() => addItem('links', { label: '', url: '' }, 6)} className="btn btn-secondary text-xs gap-1 rounded-xl"><Plus className="w-3.5 h-3.5" />Add link</button>
        )}
      </Block>

      {/* Host */}
      <Block title="About the host" hint="Tell people who is running this. The contact email is shown publicly, so use a shared inbox if you can.">
        <div>
          <div className="flex items-center mb-1.5"><label className="text-xs font-medium text-neutral-600">Short bio</label><Counter value={v.hostBio} max={500} /></div>
          <textarea className="input text-sm rounded-xl min-h-[72px]" maxLength={500} value={v.hostBio} onChange={e => set({ hostBio: e.target.value })} placeholder="e.g. We are a student-run chapter teaching coding to our community." />
        </div>
        <div>
          <label className="text-xs font-medium text-neutral-600 block mb-1.5">Public contact email (optional)</label>
          <input type="email" className="input text-sm rounded-xl" maxLength={120} value={v.contactEmail} onChange={e => set({ contactEmail: e.target.value })} placeholder="hello@yourgroup.org" />
        </div>
      </Block>

      {/* Generic info toggle */}
      <label className="flex items-start gap-3 rounded-xl border border-neutral-200 p-4 cursor-pointer">
        <input type="checkbox" className="mt-0.5" checked={v.showEventSpaceInfo} onChange={e => set({ showEventSpaceInfo: e.target.checked })} />
        <span>
          <span className="block text-sm font-semibold text-neutral-800">Show “Inside the event space”</span>
          <span className="block text-xs text-neutral-500 mt-0.5">A generic block explaining chat, polls and files. Off by default, so your page is only about your event.</span>
        </span>
      </label>
    </div>
  );
}
