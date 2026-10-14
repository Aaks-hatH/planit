/**
 * frontend/src/components/tour/RsvpTour.jsx
 *
 * Recreated (inert) mock of RSVPEventDashboard.jsx + the embedded
 * RSVPDashboard guest table. RSVP-only events have no tab bar at all
 * (see the file header comment in RSVPEventDashboard.jsx) \u2014 just the
 * builder card and the guest list \u2014 so this tour is intentionally the
 * shortest of the four.
 */
import {
  ArrowLeft, ExternalLink, LayoutTemplate, ChevronRight, Search, Filter,
  Download, RefreshCw, Check, Clock, X, UserCheck2,
} from 'lucide-react';
import TourEngine from './TourEngine';

const STEPS = [
  { id: 'hdr-title', title: 'RSVP-only event', body: 'This event type is stripped down to just what an RSVP needs \u2014 no chat, tasks, or files. Just the guest form, the guest list, and check-in.' },
  { id: 'hdr-live',  title: 'View live page', body: 'Opens the actual public RSVP page in a new tab \u2014 exactly what your guests see when they open the link.' },
  { id: 'builder',   title: 'RSVP Page Builder', body: 'Tap in here to design the page guests fill out \u2014 drag-and-drop sections, a cover image, and page styling, all without touching code.' },
  { id: 'search',    title: 'Search guests', body: 'Find any guest instantly by name or email once your list starts growing.' },
  { id: 'filter',    title: 'Filter', body: 'Narrow the list down \u2014 by response (attending / maybe / declined), check-in status, or tags you\u2019ve added to guests.' },
  { id: 'export',    title: 'Export', body: 'Download your full guest list as a CSV \u2014 useful for a door list, a caterer headcount, or your own records.' },
  { id: 'refresh',   title: 'Refresh', body: 'Pulls the latest responses \u2014 useful if you\u2019re watching RSVPs come in live before an event.' },
  { id: 'guest-row', title: 'Managing a guest', body: 'Each row shows their response and lets you flip it \u2014 accept, waitlist, or decline \u2014 and check them in with one tap on the day of the event.' },
];

export default function RsvpTour({ onClose }) {
  return (
    <div className="fixed inset-0 z-[290] bg-neutral-50 overflow-y-auto">
      <header className="bg-white/95 backdrop-blur-md border-b border-neutral-200/60 sticky top-0 z-10">
        <div className="max-w-screen-lg mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center flex-shrink-0 opacity-40">
            <ArrowLeft className="w-3.5 h-3.5 text-neutral-600" />
          </div>
          <div data-tour="hdr-title" className="flex-1 min-w-0 cursor-pointer">
            <h1 className="text-sm font-bold text-neutral-900 truncate leading-tight">Neighborhood Block Party</h1>
            <p className="text-[11px] font-semibold text-emerald-600">RSVP Event</p>
          </div>
          <div data-tour="hdr-live" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-neutral-600 border border-neutral-200 bg-white cursor-pointer flex-shrink-0">
            View live page <ExternalLink className="w-3 h-3" />
          </div>
        </div>
      </header>

      <div className="max-w-screen-lg mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
        <div data-tour="builder" className="w-full flex items-center gap-4 p-5 rounded-2xl border border-neutral-200 bg-white cursor-pointer">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <LayoutTemplate className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-neutral-900">RSVP Page Builder</p>
            <p className="text-xs text-neutral-400">Drag-and-drop sections, cover graphic, and page styling</p>
          </div>
          <ChevronRight className="w-[18px] h-[18px] text-neutral-300" />
        </div>

        <div className="bg-white rounded-2xl border border-neutral-200/80 overflow-hidden">
          <div className="p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-4">
              <div data-tour="search" className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl border border-neutral-200 bg-neutral-50 cursor-pointer">
                <Search className="w-3.5 h-3.5 text-neutral-400" />
                <span className="text-sm text-neutral-400">Search by name or email\u2026</span>
              </div>
              <div data-tour="filter" className="w-9 h-9 flex items-center justify-center rounded-xl border border-neutral-200 cursor-pointer">
                <Filter className="w-4 h-4 text-neutral-500" />
              </div>
              <div data-tour="export" className="w-9 h-9 flex items-center justify-center rounded-xl border border-neutral-200 cursor-pointer">
                <Download className="w-4 h-4 text-neutral-500" />
              </div>
              <div data-tour="refresh" className="w-9 h-9 flex items-center justify-center rounded-xl border border-neutral-200 cursor-pointer">
                <RefreshCw className="w-4 h-4 text-neutral-500" />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {[
                { name: 'Jordan Lee',  email: 'jordan@email.com',  resp: 'yes',   checked: true  },
                { name: 'Casey Park',  email: 'casey@email.com',   resp: 'maybe', checked: false },
                { name: 'Riley Smith', email: 'riley@email.com',   resp: 'no',    checked: false },
              ].map((g, idx) => {
                const respMeta = {
                  yes:   { label: 'Attending',     icon: Check, color: 'text-emerald-600 bg-emerald-50' },
                  maybe: { label: 'Maybe',         icon: Clock, color: 'text-amber-600 bg-amber-50' },
                  no:    { label: 'Not Attending', icon: X,     color: 'text-red-500 bg-red-50' },
                }[g.resp];
                const RespIcon = respMeta.icon;
                return (
                  <div key={idx} {...(idx === 0 ? { 'data-tour': 'guest-row' } : {})}
                    className="flex items-center gap-3 px-3.5 py-3 rounded-xl border border-neutral-100 bg-neutral-50/60 cursor-pointer">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-neutral-800 truncate">{g.name}</p>
                      <p className="text-xs text-neutral-400 truncate">{g.email}</p>
                    </div>
                    <span className={`hidden sm:flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full ${respMeta.color}`}>
                      <RespIcon className="w-3 h-3" /> {respMeta.label}
                    </span>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${g.checked ? 'bg-emerald-100 text-emerald-600' : 'bg-neutral-100 text-neutral-400'}`}>
                      <UserCheck2 className="w-3.5 h-3.5" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <TourEngine steps={STEPS} onClose={onClose} accent="#10b981" eyebrow="RSVP Event Tour" />
    </div>
  );
}
