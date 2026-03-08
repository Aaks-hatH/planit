import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import LiveWaitBoard from './pages/LiveWaitBoard';
import Home from './pages/Home';
import EventSpace from './pages/EventSpace';
import EnterpriseCheckin from './pages/EnterpriseCheckin';
import TableService from './pages/TableService';
import ServerView from './pages/ServerView';
import GuestInvite from './pages/GuestInvite';
import OrganizerLogin from './pages/OrganizerLogin';
import Admin from './pages/Admin';
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
import InviteBadge from './pages/InviteBadge';
import InviteCard from './pages/InviteCard';
import ReservePage, { ReserveCancelPage } from './pages/ReservePage';
import ReservationTicket from './pages/ReservationTicket';
import GuestTablet from './pages/GuestTablet';

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

// ─── Maintenance banner ───────────────────────────────────────────────────────
// Shown on all pages when s='upcoming' — thin top strip, dismissible per session.
const BANNER_COLORS = {
  s: { bg:'rgba(245,158,11,0.10)', brd:'rgba(245,158,11,0.22)', color:'#fcd34d', dot:'#f59e0b', label:'Scheduled maintenance' },
  i: { bg:'rgba(239,68,68,0.10)',  brd:'rgba(239,68,68,0.22)',  color:'#fca5a5', dot:'#ef4444', label:'Service disruption'    },
  d: { bg:'rgba(249,115,22,0.10)', brd:'rgba(249,115,22,0.22)', color:'#fdba74', dot:'#f97316', label:'Degraded performance'  },
};

function MaintenanceBanner({ info }) {
  const [dismissed, setDismissed] = useState(() => { try { return sessionStorage.getItem('mnt_banner_dismissed') === '1'; } catch { return false; } });
  if (dismissed) return null;

  const cfg = BANNER_COLORS[info.type] || BANNER_COLORS.s;
  const dismiss = () => { try { sessionStorage.setItem('mnt_banner_dismissed', '1'); } catch {} setDismissed(true); };

  const etaStr = info.start ? new Date(info.start).toLocaleString(undefined, { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) : null;

  return (
    <div style={{ position:'fixed', top:0, left:0, right:0, zIndex:9998, display:'flex', alignItems:'center', justifyContent:'center', gap:10, padding:'8px 16px', background:cfg.bg, borderBottom:`1px solid ${cfg.brd}`, fontSize:12, fontWeight:500, color:cfg.color, fontFamily:'system-ui,sans-serif' }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background:cfg.dot, boxShadow:`0 0 6px ${cfg.dot}`, flexShrink:0, animation:'mnt-pulse 2s infinite' }} />
      <span style={{ flex:1, textAlign:'center' }}>
        <strong style={{ fontWeight:700 }}>{cfg.label}</strong>
        {etaStr ? ` — ${etaStr}` : ''}
        {info.message ? ` · ${info.message}` : ''}
        {' '}
        <a href="/status" style={{ color:'inherit', opacity:0.7, fontWeight:600 }}>Details →</a>
      </span>
      <button onClick={dismiss} style={{ background:'none', border:'none', cursor:'pointer', color:cfg.color, opacity:0.5, padding:4, display:'flex', alignItems:'center', lineHeight:1 }} aria-label="Dismiss">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
      <style>{`@keyframes mnt-pulse{0%,100%{opacity:1}50%{opacity:0.25}}`}</style>
    </div>
  );
}

// ─── Maintenance gate ─────────────────────────────────────────────────────────
// Polls GET /maintenance every 30s.
// active=true  → full-page lockout (MaintenancePage)
// upcoming=true → banner only (MaintenanceBanner), app stays usable
// Admin path always bypasses lockout.
function MaintenanceGate({ children }) {
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

  const isAdmin = window.location.pathname.startsWith('/admin');
  if (!checked) return null;

  if (info?.active && !isAdmin) return <MaintenancePage message={info.message} eta={info.eta} type={info.type} />;

  return (
    <>
      {info?.upcoming && !isAdmin && <MaintenanceBanner info={info} />}
      {children}
    </>
  );
}

function App() {
  return (
    <MaintenanceGate>
      <Router>
        <Routes>
        <Route path="/" element={<Home />} />

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
        <Route path="/terms"           element={<Terms />} />
        <Route path="/privacy"         element={<Privacy />} />
        <Route path="/support"         element={<Support />} />
        <Route path="/support/success" element={<SupportSuccess />} />
        <Route path="/support/wall"    element={<WallOfSupporters />} />
        <Route path="/about"           element={<About />} />
        <Route path="/status"          element={<Status />} />
        <Route path="/discover"        element={<Discover />} />
        <Route path="/help"            element={<Help />} />
        <Route path="*"                element={<NotFound />} />
      </Routes>
    </Router>
    </MaintenanceGate>
  );
}

export default App;
