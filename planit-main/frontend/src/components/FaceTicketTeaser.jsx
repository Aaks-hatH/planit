import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ScanFace, X, Sparkles } from 'lucide-react';
import { useWhiteLabel } from '../context/WhiteLabelContext';
import { isTeaserTurn, advanceTeaserRotation } from '../utils/betaTeaserRotation';

const TEASER_ID = 'face-ticket';
const DISMISS_KEY = 'planit_face_ticket_teaser_dismissed_until';
const SNOOZE_DAYS = 7;

// Routes where a self-promo teaser would be noise, not helpful: both beta
// pages (this one and Venue Walk), staff/kiosk operational screens, and
// account/legal pages.
const HIDDEN_PATH_PATTERNS = [
  /^\/beta\/face-ticket/,
  /^\/beta\/venue-walk/,
  /^\/admin/,
  /^\/event\/[^/]+\/(checkin|floor|server|kitchen|table|login|waitlist|wait)/,
  /^\/e\/[^/]+\/(checkin|floor|server|kitchen|table|login|waitlist|wait|rsvp-builder)/,
  /^\/event\/[^/]+\/rsvp-builder/,
  /^\/terms/,
  /^\/privacy/,
  /^\/forgot-password/,
  /^\/429/,
];

function isSnoozed() {
  try {
    const until = localStorage.getItem(DISMISS_KEY);
    return until && Date.now() < Number(until);
  } catch {
    return false;
  }
}

function snooze() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000));
  } catch {}
}

/**
 * FaceTicketTeaser — a small, dismissible floating pill that surfaces the
 * `/beta/face-ticket` experiment across the platform so real users actually
 * find and try it, without interrupting whatever they're doing.
 *
 * Mounted once, globally, in App.jsx (same level as ConsentBanner /
 * ReferralWelcome) rather than per-page, so every route gets it for free
 * and there's a single place to tune where it shows.
 */
export default function FaceTicketTeaser() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { isWL } = useWhiteLabel();
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [closing, setClosing] = useState(false);

  const hidden = isWL || HIDDEN_PATH_PATTERNS.some((re) => re.test(pathname));

  useEffect(() => {
    if (hidden || isSnoozed() || !isTeaserTurn(TEASER_ID)) {
      setVisible(false);
      return;
    }
    const t = setTimeout(() => setVisible(true), 1400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hidden, pathname]);

  if (!visible) return null;

  const dismiss = (e) => {
    e.stopPropagation();
    snooze();
    advanceTeaserRotation(); // hand the slot to the next beta in line
    setClosing(true);
    setTimeout(() => setVisible(false), 220);
  };

  const go = () => {
    snooze(); // seen it, don't keep advertising it once they've engaged
    advanceTeaserRotation();
    navigate('/beta/face-ticket');
  };

  return (
    <div
      className={`fixed bottom-5 left-5 z-40 transition-all duration-200 ${
        closing ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
      }`}
      style={{ maxWidth: expanded ? 300 : undefined }}
    >
      <button
        // Unconditional navigation, not gated behind `expanded`: on a touch
        // device there's no hover to pre-expand this pill, so gating the
        // click on `expanded` meant the first tap only expanded it and a
        // *second* tap was needed to actually navigate — the exact bug
        // Venue Walk's teaser was built to avoid. Hover/touchstart still
        // drives the cosmetic expand; the click itself is unconditional.
        onClick={go}
        onMouseEnter={() => setExpanded(true)}
        onTouchStart={() => setExpanded(true)}
        className="group relative flex items-center gap-2.5 rounded-full border border-[#8B7FFF]/25 bg-[#0a0714]/95 backdrop-blur-sm pl-3 pr-4 py-2.5 shadow-[0_8px_30px_rgba(139,127,255,0.18)] hover:border-[#8B7FFF]/50 transition-colors text-left"
      >
        <span className="relative flex items-center justify-center w-7 h-7 rounded-full bg-[#8B7FFF]/15 shrink-0">
          <ScanFace className="w-3.5 h-3.5 text-[#8B7FFF]" />
          <span className="absolute inset-0 rounded-full bg-[#8B7FFF]/30 animate-ping" />
        </span>

        {expanded ? (
          <span className="flex flex-col pr-1">
            <span className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-[#8B7FFF]">
              <Sparkles className="w-2.5 h-2.5" />
              New &middot; Beta
            </span>
            <span className="text-white text-[13px] font-semibold leading-tight mt-0.5">
              Your face is the ticket
            </span>
            <span className="text-neutral-500 text-[11px] leading-snug mt-0.5">
              Try the on-device face-scan check-in demo
            </span>
          </span>
        ) : (
          <span className="text-white text-[13px] font-semibold whitespace-nowrap">
            Try Face Ticket
          </span>
        )}

        <span
          onClick={dismiss}
          role="button"
          aria-label="Dismiss"
          className="ml-1 shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-neutral-600 hover:text-neutral-300 hover:bg-white/5"
        >
          <X className="w-3 h-3" />
        </span>
      </button>
    </div>
  );
}
