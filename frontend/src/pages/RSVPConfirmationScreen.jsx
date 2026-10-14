/**
 * frontend/src/pages/RSVPConfirmationScreen.jsx
 *
 * Split out of RSVPPage.jsx and loaded via React.lazy. It's the only place
 * that needs formatDateInTimezone (luxon, ~256kb) and ShareCardModal
 * (canvas share-card generation) — neither of which every guest needs,
 * since most never reach this screen without first submitting. Verified
 * with an esbuild metafile that luxon's only entry point into the RSVPPage
 * bundle was timezoneUtils.js via this component; splitting it out here
 * removes that ~256kb from the initial guest-facing load.
 */
import { useState } from 'react';
import { Calendar, ArrowRight, Share2 } from 'lucide-react';
import { formatDateInTimezone } from '../utils/timezoneUtils';
import ShareCardModal from '../components/ShareCardModal';
import { FONTS, getBgStyle } from '../components/rsvpBlocks/theme';

export default function RSVPConfirmationScreen({ data, rsvpPage, event, accent, bgStyle, fontStyle }) {
  const fonts = FONTS[fontStyle] || FONTS.modern;
  const bg = getBgStyle(bgStyle, accent);
  const isLight = bgStyle === 'light';
  const [showShareCard, setShowShareCard] = useState(false);

  const addToCalendar = () => {
    if (!event.date) return;
    const d = new Date(event.date);
    const fmt = (dt) => dt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const end = new Date(d.getTime() + 2 * 3600000);
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.rawTitle || event.title)}&dates=${fmt(d)}/${fmt(end)}&location=${encodeURIComponent(event.location || '')}`;
    window.open(url, '_blank');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={bg}>
      <div className="w-full max-w-md text-center space-y-6">
        <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto" style={{ background: `${accent}22`, border: `2px solid ${accent}` }}>
          <ArrowRight style={{ color: accent, transform: 'rotate(-45deg)' }} className="w-10 h-10" />
        </div>
        {rsvpPage.confirmationImageUrl && <img src={rsvpPage.confirmationImageUrl} alt="Confirmation" className="w-full max-h-48 object-cover rounded-2xl" />}
        <div>
          <h1 className={`text-3xl mb-3 ${fonts.heading}`} style={{ color: isLight ? '#111' : '#fff' }}>
            {rsvpPage.confirmationTitle || (data.status === 'pending' ? 'Request Submitted' : data.waitlisted ? 'Added to Waitlist' : "You're on the list")}
          </h1>
          {data.waitlisted && <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-3" style={{ background: '#f59e0b22', border: '1px solid #f59e0b44', color: '#f59e0b' }}>Waitlisted</div>}
          {data.isPending && <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-3" style={{ background: '#6366f122', border: '1px solid #6366f144', color: '#a5b4fc' }}>Pending Approval</div>}
          <p className="text-sm leading-relaxed opacity-70" style={{ color: isLight ? '#374151' : undefined }}>
            {rsvpPage.confirmationMessage || (data.status === 'pending' ? 'Your RSVP has been submitted and is awaiting approval from the organizer.' : data.waitlisted ? (rsvpPage.waitlistMessage || "You've been added to the waitlist. We'll notify you if a spot opens up.") : 'Your RSVP has been confirmed. We look forward to seeing you!')}
          </p>
        </div>
        <div className="space-y-2.5">
          {rsvpPage.showAddToCalendar !== false && event.date && (
            <button onClick={addToCalendar} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90" style={{ background: accent, color: '#fff' }}>
              <Calendar className="w-4 h-4" /> Add to Calendar
            </button>
          )}
          {rsvpPage.showEventSpaceButton && event.subdomain && (
            <a href={`/e/${event.subdomain}`} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'inherit' }}>
              {rsvpPage.eventSpaceButtonLabel || 'View Event Details'} <ArrowRight className="w-4 h-4" />
            </a>
          )}
          {rsvpPage.showShareButton !== false && (
            <button onClick={() => setShowShareCard(true)} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'inherit' }}>
              <Share2 className="w-4 h-4" /> Share Event
            </button>
          )}
          {rsvpPage.allowGuestEdit !== false && data.editToken && (
            <a href={`/rsvp/manage/${data.editToken}`} className="block text-center text-xs opacity-50 hover:opacity-70 transition-opacity mt-2">View or edit your RSVP</a>
          )}
        </div>
        {!rsvpPage.hideBranding && <p className="text-xs opacity-30 mt-6">Powered by <a href="/" className="underline hover:opacity-60">PlanIt</a></p>}
      </div>
      <ShareCardModal
        open={showShareCard}
        onClose={() => setShowShareCard(false)}
        eventTitle={event.rawTitle || event.title}
        dateLabel={event.date ? formatDateInTimezone(event.date, event.timezone || 'UTC', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}
        location={event.location}
        guestName={data.guestName}
        url={`${window.location.origin}/rsvp/${event.subdomain}`}
      />
    </div>
  );
}
