/**
 * frontend/src/components/LandingPageEditor.jsx
 *
 * Organizer editor for the public landing page (/discover/:key). Fully
 * controlled: OrganizerSettings owns the state and saves it with the rest of
 * the settings. Everything typed here is shown publicly.
 */
import { Plus, Trash2, ExternalLink, Info } from 'lucide-react';

export const EMPTY_LANDING = {
  tagline: '', ctaLabel: '', hostBio: '', contactEmail: '',
  showEventSpaceInfo: false,
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

function Counter({ value, max }) {
  return <span className="text-[10px] text-neutral-400 ml-auto">{(value || '').length}/{max}</span>;
}

export default function LandingPageEditor({ value, onChange, isPublic, slug }) {
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
