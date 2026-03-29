import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { WhiteLabelProvider, useWhiteLabel } from './context/WhiteLabelContext';
import LiveWaitBoard from './pages/LiveWaitBoard';
import Home from './pages/Home';
import EventSpace from './pages/EventSpace';
import EnterpriseCheckin from './pages/EnterpriseCheckin';
import TableService from './pages/TableService';
import ServerView from './pages/ServerView';
import GuestInvite from './pages/GuestInvite';
import OrganizerLogin from './pages/OrganizerLogin';
import Admin from './pages/Admin';
import SecurityDashboard from './pages/SecurityDashboard';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import NotFound from './pages/NotFound';
import Support from './pages/Support';
import SupportSuccess from './pages/SupportSuccess';
import WallOfSupporters from './pages/WallOfSupporters';
import About from './pages/About';
import Status from './pages/Status';
import Discover from './pages/Discover';
import Waitlist from './pages/Waitlist';
import Help from './pages/Help';
import License from './pages/License';
import InviteBadge from './pages/InviteBadge';
import InviteCard from './pages/InviteCard';
import ReferralWelcome from './components/ReferralWelcome';
import ReservePage, { ReserveCancelPage } from './pages/ReservePage';
import ReservationTicket from './pages/ReservationTicket';
import GuestTablet from './pages/GuestTablet';
import WhiteLabelSignup from './pages/WhiteLabelSignup';
import SetupFee from './pages/SetupFee';
import SetupFeeSuccess from './pages/SetupFeeSuccess';
import ClientPortal from './pages/ClientPortal';
import WLHome from './pages/WLHome';
import Blog from './pages/Blog';

// ─── Maintenance page ─────────────────────────────────────────────────────────
// t = 's' scheduled | 'i' incident | 'd' degraded
const ROUTER_URL = (import.meta.env.VITE_ROUTER_URL || '').replace(/\/$/, '');

const MTYPE = {
  s: { pill: 'Scheduled Maintenance', dot: '#f59e0b', pillBg: 'rgba(245,158,11,0.10)', pillBrd: 'rgba(245,158,11,0.25)', heading: "We'll be right back.",  sub: "PlanIt is undergoing scheduled maintenance. We'll be back shortly."  },
  i: { pill: 'Service Disruption',    dot: '#ef4444', pillBg: 'rgba(239,68,68,0.10)',  pillBrd: 'rgba(239,68,68,0.28)',  heading: "We're on it.",          sub: "We're experiencing an unexpected issue. Our team is working on a fix." },
  d: { pill: 'Degraded Performance',  dot: '#f97316', pillBg: 'rgba(249,115,22,0.10)', pillBrd: 'rgba(249,115,22,0.25)', heading: "Some things are slow.", sub: "PlanIt is partially degraded. You may experience intermittent errors."  },
};

function MaintenancePage({ message, eta, type = 's' }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);

  const cfg = MTYPE[type] || MTYPE.s;

  const fmtEta = (etaStr) => {
    if (!etaStr) return null;
    try {
      const d    = new Date(etaStr);
      if (isNaN(d)) return etaStr;
      const diff = d - now;
      if (diff <= 0) return 'any moment now';
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000)   / 1000);
      if (h > 0) return `~${h}h ${m}m`;
      if (m > 0) return `~${m}m ${s}s`;
      return `~${s}s`;
    } catch { return etaStr; }
  };

  const remaining = fmtEta(eta);

  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#05050f', color:'white', fontFamily:'system-ui,sans-serif', padding:'2rem', textAlign:'center' }}>
      {/* Grid */}
      <svg style={{ position:'fixed', inset:0, width:'100%', height:'100%', pointerEvents:'none', zIndex:0 }} aria-hidden="true">
        <defs><pattern id="mg" width="64" height="64" patternUnits="userSpaceOnUse"><path d="M 64 0 L 0 0 0 64" fill="none" stroke="rgba(255,255,255,0.022)" strokeWidth="1"/></pattern></defs>
        <rect width="100%" height="100%" fill="url(#mg)"/>
      </svg>
      {/* Corner brackets */}
      {[['top:28px;left:28px','border-top:1.5px solid rgba(255,255,255,0.12);border-left:1.5px solid rgba(255,255,255,0.12)'],['top:28px;right:28px','border-top:1.5px solid rgba(255,255,255,0.12);border-right:1.5px solid rgba(255,255,255,0.12)'],['bottom:28px;left:28px','border-bottom:1.5px solid rgba(255,255,255,0.12);border-left:1.5px solid rgba(255,255,255,0.12)'],['bottom:28px;right:28px','border-bottom:1.5px solid rgba(255,255,255,0.12);border-right:1.5px solid rgba(255,255,255,0.12)']].map(([pos,brd],i)=>(
        <div key={i} style={{ position:'fixed', width:18, height:18, ...Object.fromEntries(pos.split(';').map(p=>{ const [k,v]=p.split(':'); return [k.trim(),v.trim()]; })), ...Object.fromEntries(brd.split(';').map(p=>{ const [k,...v]=p.split(':'); return [k.trim(),v.join(':').trim()]; })) }} />
      ))}

      <div style={{ position:'relative', zIndex:1, maxWidth:480, width:'100%' }}>
        {/* Logo */}
        <div style={{ width:64, height:64, borderRadius:18, margin:'0 auto 20px', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </div>

        <div style={{ fontSize:11, fontWeight:700, letterSpacing:'0.25em', textTransform:'uppercase', color:'rgba(255,255,255,0.18)', marginBottom:20 }}>PlanIt</div>

        {/* Status pill */}
        <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'6px 14px', borderRadius:999, background:cfg.pillBg, border:`1px solid ${cfg.pillBrd}`, marginBottom:24 }}>
          <span style={{ width:7, height:7, borderRadius:'50%', background:cfg.dot, boxShadow:`0 0 8px ${cfg.dot}`, animation:'mnt-pulse 2s infinite', display:'inline-block' }} />
          <span style={{ fontSize:11, fontWeight:700, color:cfg.dot, letterSpacing:'0.12em', textTransform:'uppercase' }}>{cfg.pill}</span>
        </div>

        <h1 style={{ fontSize:'clamp(1.6rem,5vw,2.4rem)', fontWeight:900, margin:'0 0 14px', lineHeight:1.1, letterSpacing:-1 }}>{cfg.heading}</h1>

        <p style={{ fontSize:15, color:'rgba(255,255,255,0.42)', lineHeight:1.7, margin:'0 0 28px' }}>
          {message || cfg.sub}
        </p>

        {/* ETA */}
        {remaining && (
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'10px 18px', borderRadius:12, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.07)', marginBottom:28 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            <span style={{ fontSize:12, color:'rgba(255,255,255,0.4)' }}>Back in</span>
            <span style={{ fontSize:13, fontWeight:800, color:'white', fontVariantNumeric:'tabular-nums' }}>{remaining}</span>
          </div>
        )}

        {/* Status link */}
        <div style={{ marginBottom:20 }}>
          <a href="/status" style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:12, fontWeight:600, color:'rgba(255,255,255,0.28)', textDecoration:'none', padding:'5px 12px', borderRadius:8, border:'1px solid rgba(255,255,255,0.07)' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            View status page
          </a>
        </div>

        <div style={{ fontSize:11, color:'rgba(255,255,255,0.12)', fontVariantNumeric:'tabular-nums', letterSpacing:'0.08em' }}>{now.toLocaleTimeString()} local time</div>
      </div>

      <style>{`@keyframes mnt-pulse{0%,100%{opacity:1}50%{opacity:0.25}}`}</style>
    </div>
  );
}

// --- Maintenance banner ---
// Shown on all pages when s='upcoming' - slim top bar, dismissible per session.
// Renders in normal document flow (NOT fixed) so it never overlaps page content.
const BANNER_CFG = {
  s: { bg:'#fffbeb', border:'#fde68a', text:'#92400e', dot:'#f59e0b', pill:'#fef3c7', pillText:'#b45309', label:'Scheduled Maintenance' },
  i: { bg:'#fff1f2', border:'#fecdd3', text:'#9f1239', dot:'#f43f5e', pill:'#ffe4e6', pillText:'#be123c', label:'Service Disruption'    },
  d: { bg:'#fff7ed', border:'#fed7aa', text:'#9a3412', dot:'#f97316', pill:'#ffedd5', pillText:'#c2410c', label:'Degraded Performance'  },
};

function MaintenanceBanner({ info }) {
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem('mnt_banner_dismissed') === '1'; } catch { return false; }
  });
  if (dismissed) return null;

  const c = BANNER_CFG[info.type] || BANNER_CFG.s;
  const dismiss = () => { try { sessionStorage.setItem('mnt_banner_dismissed', '1'); } catch {} setDismissed(true); };

  const startStr = info.start
    ? new Date(info.start).toLocaleString(undefined, { weekday:'short', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })
    : null;
  const etaStr = info.eta
    ? new Date(info.eta).toLocaleString(undefined, { hour:'2-digit', minute:'2-digit' })
    : null;

  return (
    <div style={{ width:'100%', background:c.bg, borderBottom:`1px solid ${c.border}`, fontFamily:'system-ui,-apple-system,sans-serif' }}>
      <div style={{ maxWidth:900, margin:'0 auto', padding:'9px 16px', display:'flex', alignItems:'center', gap:10 }}>
        <span style={{ width:7, height:7, borderRadius:'50%', background:c.dot, flexShrink:0, animation:'mnt-blink 2s ease-in-out infinite' }} />
        <span style={{ fontSize:11, fontWeight:700, letterSpacing:'0.04em', textTransform:'uppercase', background:c.pill, color:c.pillText, padding:'2px 8px', borderRadius:999, flexShrink:0 }}>
          {c.label}
        </span>
        <span style={{ fontSize:13, color:c.text, flex:1, minWidth:0 }}>
          {info.message || (startStr ? `Planned for ${startStr}` : 'Upcoming maintenance window')}
          {startStr && !info.message && etaStr ? ` — estimated back by ${etaStr}` : ''}
          {info.message && startStr ? <span style={{ opacity:0.6 }}> · {startStr}{etaStr ? ` – ${etaStr}` : ''}</span> : ''}
        </span>
        <a href="/status" style={{ fontSize:12, fontWeight:600, color:c.pillText, textDecoration:'none', flexShrink:0, opacity:0.8 }}>
          Status page →
        </a>
        <button
          onClick={dismiss}
          aria-label="Dismiss"
          style={{ background:'none', border:'none', cursor:'pointer', color:c.text, opacity:0.4, padding:'2px 4px', display:'flex', alignItems:'center', flexShrink:0, borderRadius:4 }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
          onMouseLeave={e => e.currentTarget.style.opacity = '0.4'}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <style>{"@keyframes mnt-blink{0%,100%{opacity:1}50%{opacity:0.3}}"}</style>
    </div>
  );
}

// ─── Maintenance gate ─────────────────────────────────────────────────────────
// Polls GET /maintenance every 30s.
// active=true  → full-page lockout (MaintenancePage)
// upcoming=true → banner only (MaintenanceBanner), app stays usable
// Admin path always bypasses lockout.
// WL domains ALWAYS bypass — their clients have a paid SLA and shouldn't
// see PlanIt's maintenance page; their own events/platform must stay up.
function MaintenanceGate({ children }) {
  const { isWL } = useWhiteLabel();
  const [info, setInfo]       = useState(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const check = () =>
      fetch(`${ROUTER_URL}/maintenance`, { cache: 'no-store' }).then(r => r.json())
        .then(d => { setInfo((d.active || d.upcoming) ? d : null); setChecked(true); })
        .catch(() => { setInfo(null); setChecked(true); });
    check();
    const t = setInterval(check, 30_000);
    return () => clearInterval(t);
  }, []);

  const path     = window.location.pathname;
  const isAdmin  = path.startsWith('/admin');
  const isStatus = path === '/status';

  // WL domains bypass maintenance entirely — their platform must stay live
  if (isWL) return <>{children}</>;

  if (!checked) return null;

  // Full lockout — admin and status page always bypass so you can still resolve
  if (info?.active && !isAdmin && !isStatus) return <MaintenancePage message={info.message} eta={info.eta} type={info.type} />;

  return (
    <>
      {/* Banner: skip on admin (has its own) and status (has its own maintenance card) */}
      {info?.upcoming && !isAdmin && !isStatus && <MaintenanceBanner info={info} />}
      {children}
    </>
  );
}

// ─── Home route — WL domains get their branded landing, PlanIt gets its own ──
function HomeRoute() {
  const { isWL } = useWhiteLabel();
  return isWL ? <WLHome /> : <Home />;
}

// ─── White-label suspended / blocked page ─────────────────────────────────────
function WLSuspendedPage() {
  const { blockReason, wl } = useWhiteLabel();

  const isExpired      = blockReason === 'expired';
  const isTampered     = blockReason === 'tier_mismatch' || blockReason === 'domain_mismatch' || blockReason === 'invalid_signature';
  const isNetworkError = blockReason === 'network_error';

  const primary = wl?.branding?.primaryColor || '#111827';
  const company = wl?.branding?.companyName || wl?.clientName || '';
  const hidePoweredBy = wl?.branding?.hidePoweredBy || false;

  const title   = isNetworkError ? 'Connection Error'
                : isExpired      ? 'Subscription Expired'
                : isTampered     ? 'License Invalid'
                :                  'Account Suspended';

  const message = isNetworkError
    ? 'Unable to connect to the platform. Please check your connection and try refreshing.'
    : isExpired
    ? 'The subscription for this platform has expired. Please contact the site owner to renew.'
    : isTampered
    ? 'A license validation error was detected. Please contact the site owner.'
    : 'This platform has been temporarily suspended. Please contact the site owner for assistance.';

  // Icon color: network error = amber, tampered = red, else use primary brand color
  const iconBg  = isNetworkError ? '#fef3c7' : isExpired ? '#fef3c7' : '#fee2e2';
  const iconClr = isNetworkError ? '#d97706' : isExpired ? '#d97706' : '#ef4444';

  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#f9fafb', fontFamily:"'Inter',-apple-system,sans-serif", textAlign:'center', padding:'2rem' }}>
      {company && (
        <p style={{ position:'absolute', top:'24px', left:'50%', transform:'translateX(-50%)', fontSize:'0.85rem', fontWeight:600, color:primary, letterSpacing:'-0.01em', opacity:.8 }}>
          {company}
        </p>
      )}
      <div style={{ maxWidth:'420px' }}>
        <div style={{ width:'52px', height:'52px', background:iconBg, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 1.5rem' }}>
          {isNetworkError ? (
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M1 1l20 20M9 9a3 3 0 014.12.12M5.68 5.68A7 7 0 0117 17M2.6 2.6A12 12 0 0119.4 19.4" stroke={iconClr} strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M11 7v5M11 15h.01M21 11a10 10 0 11-20 0 10 10 0 0120 0z" stroke={iconClr} strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          )}
        </div>
        <h1 style={{ fontSize:'1.5rem', fontWeight:700, color:'#111827', margin:'0 0 0.75rem', letterSpacing:'-0.03em' }}>{title}</h1>
        <p style={{ fontSize:'0.9rem', color:'#6b7280', lineHeight:1.7, margin:'0 0 2rem' }}>{message}</p>
        {isNetworkError && (
          <button
            onClick={() => window.location.reload()}
            style={{ display:'inline-flex', alignItems:'center', gap:'6px', padding:'8px 20px', background:primary, color:'#fff', border:'none', borderRadius:'8px', fontSize:'0.875rem', fontWeight:500, cursor:'pointer', marginBottom:'2rem' }}
          >
            Try Again
          </button>
        )}
        {!hidePoweredBy && (
          <p style={{ fontSize:'0.75rem', color:'#d1d5db' }}>Powered by PlanIt</p>
        )}
      </div>
    </div>
  );
}

// ─── White-label theme injector ────────────────────────────────────────────────
// Reads branding from context and applies CSS variables + favicon + title.
function WhiteLabelTheme({ children }) {
  const { wl, isWL, resolved, blocked, blockReason } = useWhiteLabel();

  useEffect(() => {
    if (!isWL || !wl?.branding) return;
    const b = wl.branding;
    const root = document.documentElement;

    // Add data-wl attribute so CSS overrides in index.css activate
    root.setAttribute('data-wl', '1');

    // Inject CSS custom properties
    if (b.primaryColor) root.style.setProperty('--wl-primary', b.primaryColor);
    if (b.accentColor)  root.style.setProperty('--wl-accent',  b.accentColor);
    if (b.fontFamily)   root.style.setProperty('--wl-font',    `'${b.fontFamily}'`);

    // Document title
    const name = b.companyName || wl.clientName;
    if (name) document.title = name;

    // Favicon
    if (b.faviconUrl) {
      let link = document.querySelector("link[rel~='icon']");
      if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
      link.href = b.faviconUrl;
    }

    // Logo — inject a meta tag so any component can read it without context drilling
    if (b.logoUrl) root.setAttribute('data-wl-logo', b.logoUrl);

    // Custom CSS (enterprise only)
    if (b.customCss) {
      const existing = document.getElementById('wl-custom-css');
      if (existing) existing.remove();
      const style = document.createElement('style');
      style.id = 'wl-custom-css';
      style.textContent = b.customCss;
      document.head.appendChild(style);
    }

    return () => {
      root.removeAttribute('data-wl');
      root.removeAttribute('data-wl-logo');
      root.style.removeProperty('--wl-primary');
      root.style.removeProperty('--wl-accent');
      root.style.removeProperty('--wl-font');
      document.getElementById('wl-custom-css')?.remove();
    };
  }, [isWL, wl]);

  // Don't render anything until resolution is done — prevents flash of PlanIt branding
  if (!resolved) return (
    <div style={{ minHeight:'100vh', background:'#05050f', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round">
        <path d="M21 12a9 9 0 11-6.219-8.56" style={{ animation:'spin 1s linear infinite', transformOrigin:'center' }}/>
      </svg>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  // Suspended
  if (isWL && (blocked || blockReason)) return <WLSuspendedPage />;

  return <>{children}</>;
}

// ─── Page Titles ──────────────────────────────────────────────────────────────
// Edit PAGE_TITLES below to change any page's browser tab title.
// Dynamic routes (event workspaces, invites, etc.) are matched by pattern below.
// White-label domains automatically use the client's company name instead —
// see the WL title section in WhiteLabelTheme above (line ~322).
const PAGE_TITLES = {
  '/':                         'Event Planning and Restaurant Management Software · PlanIt',
  '/about':                    'About PlanIt · Built for Event Planners and Venue Managers',
  '/admin':                    'Admin Control Panel · PlanIt',
  '/admin/security':           'Platform Security Dashboard · PlanIt Admin',
  '/dashboard':                'Your White Label Dashboard · PlanIt',
  '/discover':                 'Discover Events Near You · PlanIt',
  '/help':                     'Help Center and Frequently Asked Questions · PlanIt',
  '/license':                  'Platform License Agreement · PlanIt',
  '/privacy':                  'Privacy Policy · PlanIt',
  '/status':                   'Platform Status and Live Uptime · PlanIt',
  '/support':                  'Contact Support · PlanIt',
  '/support/success':          'Support Request Successfully Submitted · PlanIt',
  '/support/wall':             'Wall of Supporters · PlanIt',
  '/terms':                    'Terms of Service · PlanIt',
  '/blog':                     'PlanIt Blog · Ideas and Guides for Event Planners',
  '/white-label':              'Launch Your Own Branded Event Platform · PlanIt White Label',
  '/white-label/setup-fee':    'White Label Setup Payment · PlanIt White Label',
  '/white-label/setup-success': 'Payment Confirmed, You Are Live · PlanIt White Label',
};

// Titles for dynamic routes — matched by pattern in order (first match wins)
const PATTERN_TITLES = [
  [/^\/(e|event)\/[^/]+\/checkin$/,          'Live Attendee Check-In Dashboard · PlanIt'],
  [/^\/(e|event)\/[^/]+\/floor$/,            'Floor Management and Table Service · PlanIt Venue'],
  [/^\/(e|event)\/[^/]+\/server$/,           'Server and Table Assignment View · PlanIt Venue'],
  [/^\/(e|event)\/[^/]+\/table\/[^/]+$/,     'Table Ordering Kiosk · PlanIt Venue'],
  [/^\/(e|event)\/[^/]+\/(login|waitlist)$/, 'Organizer Sign In to Your Event · PlanIt'],
  [/^\/(e|event)\/[^/]+\/wait$/,             'Live Waitlist Board · PlanIt Venue'],
  [/^\/(e|event)\/[^/]+\/reserve$/,          'Reserve Your Spot at This Event · PlanIt'],
  [/^\/(e|event)\/[^/]+$/,                   'Your Event Workspace · PlanIt'],
  [/^\/reserve\/cancel\//,                   'Cancel Your Reservation · PlanIt'],
  [/^\/reservation\//,                       'Your Reservation Ticket · PlanIt'],
  [/^\/invite\//,                            'You Were Personally Invited · PlanIt'],
  [/^\/badge\//,                             'Your Event Entry Badge · PlanIt'],
  [/^\/card\//,                              'Your Invitation Card · PlanIt'],
  [/^\/blog\//,                              null],
];

function PageTitle() {
  const { pathname } = useLocation();
  const { isWL } = useWhiteLabel();

  useEffect(() => {
    // On white-label domains, WhiteLabelTheme (above) sets the title to the
    // client's company name — we don't override it here.
    if (isWL) return;

    // Check exact match first
    if (PAGE_TITLES[pathname]) {
      document.title = PAGE_TITLES[pathname];
      return;
    }

    // Then pattern match
    for (const [pattern, title] of PATTERN_TITLES) {
      if (pattern.test(pathname)) {
        if (title) document.title = title; // null means the page handles it itself
        return;
      }
    }

    // Fallback for anything not listed (e.g. 404)
    document.title = ' 404 Page Not Found · PlanIt';
  }, [pathname, isWL]);

  return null;
}

function App() {
  return (
    <WhiteLabelProvider>
      <WhiteLabelTheme>
        <MaintenanceGate>
          <Router>
            <PageTitle />
            <ReferralWelcome />
            <Routes>
        <Route path="/" element={<HomeRoute />} />

        <Route path="/e/:subdomain"              element={<EventSpace />} />
        <Route path="/event/:eventId"            element={<EventSpace />} />
        <Route path="/event/:eventId/checkin"    element={<EnterpriseCheckin />} />
        <Route path="/e/:subdomain/checkin"      element={<EnterpriseCheckin />} />
        <Route path="/event/:eventId/floor"      element={<TableService />} />
        <Route path="/e/:subdomain/floor"        element={<TableService />} />
        <Route path="/event/:eventId/server"     element={<ServerView />} />
        <Route path="/e/:subdomain/server"       element={<ServerView />} />
        <Route path="/event/:eventId/table/:tableId" element={<GuestTablet />} />
        <Route path="/e/:subdomain/table/:tableId"   element={<GuestTablet />} />
        <Route path="/event/:eventId/login"      element={<OrganizerLogin />} />
        <Route path="/e/:subdomain/login"        element={<OrganizerLogin />} />
        <Route path="/event/:eventId/waitlist"   element={<Waitlist />} />
        <Route path="/e/:subdomain/waitlist"     element={<Waitlist />} />
        <Route path="/event/:eventId/wait"       element={<LiveWaitBoard />} />
        <Route path="/e/:subdomain/wait"         element={<LiveWaitBoard />} />
        <Route path="/e/:subdomain/reserve"      element={<ReservePage />} />
        <Route path="/reserve/cancel/:cancelToken" element={<ReserveCancelPage />} />
        <Route path="/reservation/:cancelToken"  element={<ReservationTicket />} />
        <Route path="/invite/:inviteCode"        element={<GuestInvite />} />
        <Route path="/badge/:inviteCode"         element={<InviteBadge />} />
        <Route path="/card/:inviteCode"          element={<InviteCard />} />

        <Route path="/admin"           element={<Admin />} />
        <Route path="/admin/security"  element={<SecurityDashboard />} />
        <Route path="/dashboard"       element={<ClientPortal />} />
        <Route path="/terms"           element={<Terms />} />
        <Route path="/privacy"         element={<Privacy />} />
        <Route path="/support"         element={<Support />} />
        <Route path="/support/success" element={<SupportSuccess />} />
        <Route path="/support/wall"    element={<WallOfSupporters />} />
        <Route path="/about"           element={<About />} />
        <Route path="/status"          element={<Status />} />
        <Route path="/discover"        element={<Discover />} />
        <Route path="/help"            element={<Help />} />
        <Route path="/blog"            element={<Blog />} />
        <Route path="/blog/:slug"      element={<Blog />} />
        <Route path="/license"         element={<License />} />
        <Route path="/white-label"              element={<WhiteLabelSignup />} />
        <Route path="/white-label/setup-fee"      element={<SetupFee />} />
        <Route path="/white-label/setup-success"  element={<SetupFeeSuccess />} />
        <Route path="*"                element={<NotFound />} />
      </Routes>
    </Router>
        </MaintenanceGate>
      </WhiteLabelTheme>
    </WhiteLabelProvider>
  );
}

export default App;
