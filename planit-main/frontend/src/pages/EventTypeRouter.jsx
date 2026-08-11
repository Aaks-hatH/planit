/**
 * frontend/src/pages/EventTypeRouter.jsx
 *
 * /e/:subdomain and /event/:eventId are a single URL shared by every event
 * type — the wizard (Home.jsx) already navigates to the same `${base}?new=1`
 * regardless of whether it just created a standard or an rsvpOnly event.
 * This component is what makes that work: a lightweight pre-check that
 * fetches only enough to read eventType, then renders the real dashboard —
 * EventSpace for 'standard'/enterprise, RSVPEventDashboard for 'rsvpOnly'.
 *
 * IMPORTANT: this pre-check must use a PUBLIC, unauthenticated endpoint.
 * It used to call eventAPI.getBySubdomain / getById directly — getById hits
 * GET /events/:eventId, which is behind verifyEventAccess and 401/403s for
 * any password-protected event when the visitor doesn't already have a
 * valid eventToken cached (a brand new browser/session, a cleared token,
 * an organizer opening their own link fresh, etc). That failure was being
 * swallowed and silently treated as eventType 'standard', which is why
 * rsvpOnly events would randomly open into EventSpace instead of
 * RSVPEventDashboard. Both branches below now use routes that never
 * require auth, so the type check itself can't fail for that reason:
 *   - subdomain param → GET /events/subdomain/:subdomain (already public)
 *   - eventId param    → GET /events/public/:eventId (public; now also
 *                         returns eventType, see backend/routes/events.js)
 *
 * This means EventSpace.jsx and RSVPEventDashboard.jsx both still do their
 * own full data fetch on mount (this component's fetch is deliberately
 * separate and minimal) — a small amount of duplicate network work in
 * exchange for not touching EventSpace.jsx's internals at all, and keeping
 * RSVPEventDashboard.jsx a genuinely independent component per the spec.
 */
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { eventAPI } from '../services/api';
import EventSpace from './EventSpace';
import RSVPEventDashboard from './RSVPEventDashboard';

export default function EventTypeRouter() {
  const { subdomain, eventId } = useParams();
  const [eventType, setEventType] = useState(undefined); // undefined = loading

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    const check = () => {
      const req = subdomain ? eventAPI.getBySubdomain(subdomain) : eventAPI.getPublicInfo(eventId);
      req
        .then((res) => {
          if (cancelled) return;
          setEventType(res.data.event?.eventType || 'standard');
        })
        .catch((err) => {
          if (cancelled) return;
          // A real 404 means the event doesn't exist — let the real
          // dashboard's own loader show the proper "not found" state
          // rather than guessing a type for a page that won't load anyway.
          if (err.response?.status === 404) { setEventType('standard'); return; }
          // Network hiccup / cold start — retry briefly instead of
          // guessing wrong and flashing the wrong dashboard.
          if (!err.response && attempts < 3) {
            attempts++;
            setTimeout(check, attempts * 1500);
            return;
          }
          setEventType('standard');
        });
    };
    check();
    return () => { cancelled = true; };
  }, [subdomain, eventId]);

  if (eventType === undefined) {
    return <div className="min-h-screen flex items-center justify-center bg-neutral-50 text-neutral-400 text-sm">Loading…</div>;
  }

  return eventType === 'rsvpOnly' ? <RSVPEventDashboard /> : <EventSpace />;
}
