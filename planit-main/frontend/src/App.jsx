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
function MaintenancePage({ message, eta }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const fmtEta = (etaStr) => {
    if (!etaStr) return null;
    try {
      const d = new Date(etaStr);
      if (isNaN(d)) return etaStr;
      const diff = d - now;
      if (diff <= 0) return 'any moment now';
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      if (h > 0) return `~${h}h ${m}m`;
      if (m > 0) return `~${m}m ${s}s`;
      return `~${s}s`;
    } catch { return etaStr; }
  };

  const remaining = eta ? fmtEta(eta) : null;

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#05050f', color: 'white', fontFamily: 'system-ui, sans-serif',
      padding: '2rem', textAlign: 'center',
    }}>
      {/* Grid background */}
      <svg style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }} aria-hidden="true">
        <defs>
          <pattern id="mg" width="64" height="64" patternUnits="userSpaceOnUse">
            <path d="M 64 0 L 0 0 0 64" fill="none" stroke="rgba(255,255,255,0.025)" strokeWidth="1"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#mg)"/>
      </svg>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 480 }}>
        {/* Logo */}
        <div style={{
          width: 64, height: 64, borderRadius: 18, margin: '0 auto 24px',
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </div>

        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)', marginBottom: 8 }}>
          PlanIt
        </div>

        {/* Status pill */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '6px 14px', borderRadius: 999,
          background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)',
          marginBottom: 28,
        }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#f59e0b', boxShadow: '0 0 8px #f59e0b', animation: 'pulse 2s infinite', display: 'inline-block' }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Scheduled Maintenance
          </span>
        </div>

        <h1 style={{ fontSize: 'clamp(1.6rem, 5vw, 2.4rem)', fontWeight: 900, margin: '0 0 16px', lineHeight: 1.1, letterSpacing: -1 }}>
          We'll be right back.
        </h1>

        <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7, margin: '0 0 32px' }}>
          {message || 'PlanIt is undergoing scheduled maintenance. We\'ll be back shortly.'}
        </p>

        {remaining && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            padding: '12px 20px', borderRadius: 14,
            background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
            marginBottom: 32,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Back in </span>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'white', fontVariantNumeric: 'tabular-nums' }}>{remaining}</span>
          </div>
        )}

        {/* Current time */}
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.15)', fontVariantNumeric: 'tabular-nums', letterSpacing: '0.08em' }}>
          {now.toLocaleTimeString()} local time
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
      `}</style>
    </div>
  );
}

// ─── Maintenance gate ─────────────────────────────────────────────────────────
// Polls GET /maintenance every 30s. While active, replaces the entire app with
// the maintenance page. When cleared, the real app loads automatically.
// Admin routes (/admin) are always let through — admin must be able to toggle off.
function MaintenanceGate({ children }) {
  const [info, setInfo] = useState(null);   // null = not in maintenance / loading
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const check = () =>
      fetch('/maintenance').then(r => r.json())
        .then(d => { setInfo(d.active ? d : null); setChecked(true); })
        .catch(() => { setInfo(null); setChecked(true); });

    check();
    const t = setInterval(check, 30_000);
    return () => clearInterval(t);
  }, []);

  // Always let admin through so they can toggle maintenance off
  const isAdmin = window.location.pathname.startsWith('/admin');

  if (!checked) return null;                // avoid flash before first check
  if (info && !isAdmin) return <MaintenancePage message={info.message} eta={info.eta} />;
  return children;
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
