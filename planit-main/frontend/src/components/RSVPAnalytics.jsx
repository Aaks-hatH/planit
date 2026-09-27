import { useState, useEffect } from 'react';
import { Eye, CheckCircle2 } from 'lucide-react';
import { rsvpAPI } from '../services/api';

/**
 * frontend/src/components/RSVPAnalytics.jsx
 *
 * The Analytics tab for rsvpOnly events (RSVPEventDashboard.jsx) — just two
 * numbers: how many people opened the RSVP page, and how many submitted an
 * RSVP. Deliberately not the full Analytics.jsx used for standard events
 * (that one shows tasks/budget/chat stats that don't exist in rsvpOnly
 * mode — see RSVPEventDashboard.jsx's file header).
 *
 * "Opened" comes from RSVPPageView (backend/models/RSVPPageView.js) — one
 * deduplicated row per visitor per day, recorded by RSVPPage.jsx after a
 * real guest's browser loads the page. Link-preview crawlers never trigger
 * it, since it only fires from client JS, not the server-rendered meta tags.
 */
export default function RSVPAnalytics({ eventId }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    setLoading(true);
    rsvpAPI.getAnalytics(eventId)
      .then((res) => { if (!cancelled) setData(res.data); })
      .catch(() => { if (!cancelled) setError('Failed to load analytics'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [eventId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-neutral-200 border-t-neutral-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return <p className="text-sm text-neutral-400 text-center py-16">{error || 'No analytics yet.'}</p>;
  }

  const { opens, submissions } = data;
  const rate = opens > 0 ? Math.round((submissions / opens) * 100) : null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="rounded-2xl border border-neutral-200 bg-white p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Eye className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-neutral-900">{opens}</div>
            <div className="text-xs text-neutral-500">Opened the page</div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <div className="text-2xl font-bold text-neutral-900">{submissions}</div>
            <div className="text-xs text-neutral-500">
              Submitted an RSVP{rate !== null ? ` · ${rate}% of opens` : ''}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
