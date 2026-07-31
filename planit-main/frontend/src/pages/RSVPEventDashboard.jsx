/**
 * frontend/src/pages/RSVPEventDashboard.jsx
 *
 * The dashboard for eventType: 'rsvpOnly' events. Deliberately a separate
 * component from EventSpace.jsx, not EventSpace with tabs hidden — per the
 * spec, this page's reachable surface is only: the RSVP builder, guest
 * list, basic check-in, and analytics. No seating tab, no table service,
 * no kitchen/wait-board, no event-space chrome.
 *
 * Reuses existing components rather than rebuilding them:
 *  - RSVPDashboard (components/RSVPDashboard.jsx) already implements guest
 *    list + search/filter/check-in (rsvpAPI.checkinSubmission) — this is
 *    the same component OrganizerSettings.jsx already renders elsewhere in
 *    the app, not a new one.
 *  - Analytics (components/Analytics.jsx) — same component EventSpace uses.
 *
 * SCOPE NOTE on the "Builder" tab: RSVPPageBuilder.jsx (Part 4) is already
 * a complete full-page experience with its own header, save-state, and
 * live-preview panel — the same kind of full "own page" that Server/
 * Kitchen/Floor views are elsewhere in this app (each reached via a link
 * from EventSpace, not embedded as an in-page tab). Rather than nest one
 * full page's header inside another (which would produce a stacked double
 * header and duplicate data-loading), the Builder tab here is a card that
 * navigates to the existing `/e/:subdomain/rsvp-builder` route — consistent
 * with how those other full-page tools are already reached, and avoiding a
 * second, subtly different embedded copy of the builder chrome.
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, LayoutTemplate, Users, BarChart3, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { eventAPI } from '../services/api';
import RSVPDashboard from '../components/RSVPDashboard';
import Analytics from '../components/Analytics';

const TABS = [
  { key: 'guests', label: 'Guests & Check-in', icon: Users },
  { key: 'analytics', label: 'Analytics', icon: BarChart3 },
];

export default function RSVPEventDashboard() {
  const { subdomain, eventId: paramEventId } = useParams();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('guests');

  useEffect(() => {
    const load = async () => {
      try {
        const res = subdomain ? await eventAPI.getBySubdomain(subdomain) : await eventAPI.getById(paramEventId);
        setEvent(res.data.event);
      } catch (err) {
        console.error(err);
        toast.error('Could not load this event.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [subdomain, paramEventId]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#0a0a12] text-white/60">Loading…</div>;
  }
  if (!event) {
    return <div className="min-h-screen flex items-center justify-center bg-[#0a0a12] text-white/60">Event not found.</div>;
  }

  const eventId = event.id;
  const base = subdomain ? `/e/${subdomain}` : `/event/${paramEventId}`;

  return (
    <div className="min-h-screen bg-[#0a0a12] text-white">
      <div className="flex items-center gap-3 px-4 sm:px-6 py-4 border-b border-white/10">
        <button onClick={() => navigate('/')} className="opacity-70 hover:opacity-100"><ArrowLeft size={18} /></button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{event.title}</p>
          <p className="text-xs opacity-50">RSVP Event</p>
        </div>
        <a href={`/rsvp/${event.subdomain}`} target="_blank" rel="noreferrer" className="text-xs flex items-center gap-1 opacity-70 hover:opacity-100">
          View live page <ExternalLink size={12} />
        </a>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
        {/* Builder — full-page tool, linked out to rather than embedded, see file header */}
        <button
          onClick={() => navigate(`${base}/rsvp-builder`)}
          className="w-full flex items-center gap-4 p-5 rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20 transition-all text-left"
        >
          <div className="w-11 h-11 rounded-xl bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
            <LayoutTemplate size={20} className="text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">RSVP Page Builder</p>
            <p className="text-xs opacity-50">Drag-and-drop sections, cover graphic, and page styling</p>
          </div>
          <ChevronRight size={18} className="opacity-40" />
        </button>

        {/* Guests & Check-in / Analytics tabs */}
        <div className="flex gap-1 rounded-xl bg-white/[0.03] p-1 w-fit">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${tab === key ? 'bg-white/10' : 'opacity-50 hover:opacity-80'}`}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        <div>
          {tab === 'guests' && <RSVPDashboard event={event} eventId={eventId} />}
          {tab === 'analytics' && <Analytics eventId={eventId} />}
        </div>
      </div>
    </div>
  );
}
