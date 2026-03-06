import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
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

function App() {
  return (
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
  );
}

export default App;