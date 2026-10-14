import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ScanFace, Compass, QrCode, Map as MapIcon, X, Sparkles } from 'lucide-react';
import { useWhiteLabel } from '../context/WhiteLabelContext';
import {
  teaserForThisSession, claimTeaserPage, dismissTeaserForever, isTeaserDismissed,
} from '../utils/betaTeaserRotation';

// One floating pill for every PlanIt Labs beta. See utils/betaTeaserRotation.js
// for the (intentionally strict) rules on how rarely it appears.
const TEASERS = {
  'face-ticket': {
    to: '/beta/face-ticket', Icon: ScanFace, tint: '#8B7FFF',
    short: 'Try Face Ticket', title: 'Your face is the ticket',
    sub: 'Try the on-device face-scan check-in demo',
  },
  'venue-walk': {
    to: '/beta/venue-walk', Icon: Compass, tint: '#8B7FFF',
    short: 'Try Venue Walk', title: 'Never lose your table',
    sub: 'Walk the venue once, guide guests with a live arrow',
  },
  'qr-pass': {
    to: '/beta/qr-pass', Icon: QrCode, tint: '#5EEAD4',
    short: 'Try QR Pass', title: 'A ticket that expires',
    sub: 'Signed check-in codes that change every 30 seconds',
  },
  'venue-map': {
    to: '/beta/venue-map', Icon: MapIcon, tint: '#F0B429',
    short: 'Try Venue Map', title: 'Tap where you are',
    sub: 'Get directions to your table from any landmark',
  },
};

// Never advertise on lab pages, staff/kiosk screens, guest-facing flows, or legal/account pages.
const HIDDEN_PATH_PATTERNS = [
  /^\/beta\//,
  /^\/rsvp\//,
  /^\/reservation\//,
  /^\/reserve\//,
  /^\/invite\//,
  /^\/badge\//,
  /^\/card\//,
  /^\/admin/,
  /^\/event\/[^/]+\/(checkin|floor|server|kitchen|table|login|waitlist|wait)/,
  /^\/e\/[^/]+\/(checkin|floor|server|kitchen|table|login|waitlist|wait|rsvp-builder|reserve)/,
  /^\/event\/[^/]+\/rsvp-builder/,
  /^\/terms/,
  /^\/privacy/,
  /^\/forgot-password/,
  /^\/429/,
];

export default function BetaLabsTeaser() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { isWL } = useWhiteLabel();
  const [id, setId] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [closing, setClosing] = useState(false);

  const hidden = isWL || HIDDEN_PATH_PATTERNS.some((re) => re.test(pathname));

  useEffect(() => {
    setId(null);
    setClosing(false);
    setExpanded(false);
    if (hidden) return undefined;
    const candidate = teaserForThisSession();
    if (!candidate || isTeaserDismissed(candidate)) return undefined;
    const t = setTimeout(() => {
      // Only the first eligible page in a session gets to show it.
      if (claimTeaserPage(candidate, pathname)) setId(candidate);
    }, 2500);
    return () => clearTimeout(t);
  }, [hidden, pathname]);

  const cfg = id && TEASERS[id];
  if (!cfg) return null;
  const { Icon, tint } = cfg;

  const retire = (after) => {
    dismissTeaserForever(id); // gone for good on this browser
    setClosing(true);
    setTimeout(() => { setId(null); after?.(); }, 220);
  };

  return (
    <div
      className={`fixed bottom-5 left-5 z-40 transition-all duration-200 ${closing ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}`}
      style={{ maxWidth: expanded ? 300 : undefined }}
    >
      <button
        onClick={() => { dismissTeaserForever(id); navigate(cfg.to); }}
        onMouseEnter={() => setExpanded(true)}
        onTouchStart={() => setExpanded(true)}
        className="group relative flex items-center gap-2.5 rounded-full border bg-[#0a0714]/95 backdrop-blur-sm pl-3 pr-4 py-2.5 text-left transition-colors"
        style={{ borderColor: `${tint}40`, boxShadow: `0 8px 30px ${tint}2e` }}
      >
        <span className="relative flex items-center justify-center w-7 h-7 rounded-full shrink-0" style={{ background: `${tint}26` }}>
          <Icon className="w-3.5 h-3.5" style={{ color: tint }} />
        </span>

        {expanded ? (
          <span className="flex flex-col pr-1">
            <span className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest" style={{ color: tint }}>
              <Sparkles className="w-2.5 h-2.5" />New &middot; Labs
            </span>
            <span className="text-white text-[13px] font-semibold leading-tight mt-0.5">{cfg.title}</span>
            <span className="text-neutral-500 text-[11px] leading-snug mt-0.5">{cfg.sub}</span>
          </span>
        ) : (
          <span className="text-white text-[13px] font-semibold whitespace-nowrap">{cfg.short}</span>
        )}

        <span
          onClick={(e) => { e.stopPropagation(); retire(); }}
          role="button"
          aria-label="Dismiss permanently"
          className="ml-1 shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-neutral-600 hover:text-neutral-300 hover:bg-white/5"
        >
          <X className="w-3 h-3" />
        </span>
      </button>
    </div>
  );
}
