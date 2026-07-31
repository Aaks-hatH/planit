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
  const [eventType, setEventType] = useState(undefined); // undefined = loading, null = not found

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const res = subdomain ? await eventAPI.getBySubdomain(subdomain) : await eventAPI.getById(eventId);
        if (!cancelled) setEventType(res.data.event?.eventType || 'standard');
      } catch {
        // If this lightweight check fails (e.g. password-protected event
        // returning limited fields, or a transient error), fall back to
        // the standard dashboard rather than blocking the page — EventSpace
        // already has its own real auth/error handling for the actual load.
        if (!cancelled) setEventType('standard');
      }
    };
    check();
    return () => { cancelled = true; };
  }, [subdomain, eventId]);

  if (eventType === undefined) {
    return <div className="min-h-screen flex items-center justify-center bg-[#0a0a12] text-white/60">Loading…</div>;
  }

  return eventType === 'rsvpOnly' ? <RSVPEventDashboard /> : <EventSpace />;
}
