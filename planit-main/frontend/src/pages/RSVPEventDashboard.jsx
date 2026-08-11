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
 *  - JoinGate (exported from pages/EventSpace.jsx) already implements the
 *    full name/password/approval/waitlist gate. This page used to skip
 *    that gate entirely and just call eventAPI.getBySubdomain/getById
 *    straight away — which meant a password-protected event (or a stale/
 *    missing eventToken) had nowhere to send the organizer: the fetch
 *    would 401/403, get swallowed by a generic catch, and the page would
 *    show "Event not found" instead of ever asking for the password. This
 *    now mirrors EventSpace.jsx's own load sequence exactly: resolve
 *    subdomain → validate the cached token locally → fetch → on 401/403
 *    drop into JoinGate → on success, load once more.
 *
 * NOTE: the Analytics tab was deliberately removed from this page — guests
 * & check-in is the one thing organizers of an RSVP-only event need, and it
 * now renders directly (no tab bar) instead of competing with a second tab.
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
 *
 * THEME NOTE: this shell is light (bg-neutral-50 / white cards), matching
 * EventSpace.jsx — the standard dashboard this page stands in for — and,
 * just as importantly, matching RSVPDashboard.jsx and Analytics.jsx below,
 * which are shared components built entirely with light Tailwind classes
 * (bg-white, text-neutral-900, border-neutral-200, etc). An earlier version
 * of this file used a dark shell (bg-[#0a0a12]/text-white) around those same
 * light components, which is what produced the "white boxes floating on a
 * dark background" look. Don't flip this back to dark without also reworking
 * RSVPDashboard/Analytics, since they're reused as-is inside OrganizerSettings
 * (a light modal) too.
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, LayoutTemplate, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { eventAPI } from '../services/api';
import RSVPDashboard from '../components/RSVPDashboard';
import { JoinGate } from './EventSpace';

export default function RSVPEventDashboard() {
  const { subdomain, eventId: paramEventId } = useParams();
  const navigate = useNavigate();

  const [eventId, setEventId]     = useState(paramEventId || null);
  const [resolving, setResolving] = useState(!paramEventId && !!subdomain);
  const [needsJoin, setNeedsJoin] = useState(false);
  const [event, setEvent]         = useState(null);
  const [loading, setLoading]     = useState(true);

  // ── Step 1: resolve subdomain → eventId (public, no auth needed) ────────
  useEffect(() => {
    if (paramEventId) { setEventId(paramEventId); setResolving(false); return; }
    if (!subdomain) { navigate('/'); return; }

    let cancelled = false;
    let attempts  = 0;
    setResolving(true);

    const tryResolve = () => {
      eventAPI.getBySubdomain(subdomain)
        .then((res) => {
          if (cancelled) return;
          setEventId(res.data.event.id);
          setResolving(false);
        })
        .catch((err) => {
          if (cancelled) return;
          if (err.response?.status === 404) { navigate('/not-found', { replace: true }); return; }
          if (err.response?.status === 429) {
            const retryAfter = err.response.headers?.['retry-after'];
            navigate('/429', { replace: true, state: { retryAfter: retryAfter ? parseInt(retryAfter) : 5, blockedAt: Date.now(), returnTo: window.location.pathname } });
            return;
          }
          attempts++;
          if (attempts < 3) setTimeout(tryResolve, attempts * 2000);
          else navigate('/not-found', { replace: true });
        });
    };
    tryResolve();
    return () => { cancelled = true; };
  }, [paramEventId, subdomain, navigate]);

  // ── Step 2: validate any cached token BEFORE trusting it (same check as
  // EventSpace.jsx — a token for a different event, or an expired one,
  // must never be sent as-is; it just routes straight into JoinGate) ──────
  useEffect(() => {
    if (!eventId || resolving) return;
    const token = localStorage.getItem('eventToken');
    if (!token) { setNeedsJoin(true); setLoading(false); return; }

    try {
      const base64  = token.split('.')[1]?.replace(/-/g, '+').replace(/_/g, '/');
      const decoded = base64 ? JSON.parse(atob(base64)) : null;
      const expired    = decoded?.exp && decoded.exp * 1000 < Date.now();
      const wrongEvent = decoded?.eventId && decoded.eventId !== eventId;
      if (expired || wrongEvent || !decoded) {
        localStorage.removeItem('eventToken'); localStorage.removeItem('username');
        setNeedsJoin(true); setLoading(false);
        return;
      }
    } catch {
      localStorage.removeItem('eventToken'); localStorage.removeItem('username');
      setNeedsJoin(true); setLoading(false);
      return;
    }

    loadEvent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, resolving]);

  // ── Step 3: real (authed) fetch — same fallback rules as EventSpace.jsx ─
  const loadEvent = async (attempt = 0) => {
    try {
      const res = await eventAPI.getById(eventId);
      const ev  = res.data.event;
      if (ev.eventType && ev.eventType !== 'rsvpOnly') {
        // Type changed under us (or we somehow got here for a non-rsvp
        // event) — send the organizer to the real dashboard instead of
        // rendering the wrong shell.
        navigate(subdomain ? `/e/${subdomain}` : `/event/${eventId}`, { replace: true });
        return;
      }
      setEvent(ev);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        localStorage.removeItem('eventToken'); localStorage.removeItem('username');
        setNeedsJoin(true);
      } else if (err.response?.status === 404) {
        toast.error('Event not found');
        navigate('/');
      } else if (err.response?.status === 429) {
        const retryAfter = err.response.headers?.['retry-after'];
        navigate('/429', { state: { retryAfter: retryAfter ? parseInt(retryAfter) : 60, blockedAt: Date.now(), returnTo: window.location.pathname } });
        return;
      } else if (!err.response && attempt < 2) {
        setTimeout(() => loadEvent(attempt + 1), (attempt + 1) * 3000);
        return;
      } else {
        toast.error('Failed to load event — please refresh the page');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleJoined = () => { setNeedsJoin(false); setLoading(true); loadEvent(); };

  if (resolving || loading) {
    return <div className="min-h-screen flex items-center justify-center bg-neutral-50 text-neutral-400 text-sm">Loading…</div>;
  }
  if (needsJoin) {
    return <JoinGate eventId={eventId} onJoined={handleJoined} />;
  }
  if (!event) {
    return <div className="min-h-screen flex items-center justify-center bg-neutral-50 text-neutral-400 text-sm">Event not found.</div>;
  }

  const base = subdomain ? `/e/${subdomain}` : `/event/${paramEventId}`;

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="bg-white/95 backdrop-blur-md border-b border-neutral-200/60 sticky top-0 z-50">
        <div className="max-w-screen-lg mx-auto px-4 sm:px-6 h-14 flex items-center gap-3">
          <button onClick={() => navigate('/')}
            className="w-8 h-8 rounded-lg bg-neutral-100 hover:bg-neutral-200 flex items-center justify-center flex-shrink-0 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5 text-neutral-600" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-neutral-900 truncate leading-tight">{event.title}</h1>
            <p className="text-[11px] font-semibold text-emerald-600">RSVP Event</p>
          </div>
          <a href={`/rsvp/${event.subdomain}`} target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-neutral-600 border border-neutral-200 bg-white hover:bg-neutral-50 hover:border-neutral-300 transition-colors flex-shrink-0">
            View live page <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </header>

      <div className="max-w-screen-lg mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
        {/* Builder — full-page tool, linked out to rather than embedded, see file header */}
        <button
          onClick={() => navigate(`${base}/rsvp-builder`)}
          className="w-full flex items-center gap-4 p-5 rounded-2xl border border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-sm transition-all text-left"
        >
          <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <LayoutTemplate className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-neutral-900">RSVP Page Builder</p>
            <p className="text-xs text-neutral-400">Drag-and-drop sections, cover graphic, and page styling</p>
          </div>
          <ChevronRight className="w-[18px] h-[18px] text-neutral-300" />
        </button>

        {/* Guests & Check-in */}
        <div className="bg-white rounded-2xl border border-neutral-200/80 overflow-hidden">
          <div className="p-4 sm:p-5">
            <RSVPDashboard event={event} eventId={eventId} />
          </div>
        </div>
      </div>
    </div>
  );
}
