import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import EventSpace from './pages/EventSpace';
import EnterpriseCheckin from './pages/EnterpriseCheckin';
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

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />

        <Route path="/e/:subdomain"              element={<EventSpace />} />
        <Route path="/event/:eventId"            element={<EventSpace />} />
        <Route path="/event/:eventId/checkin"    element={<EnterpriseCheckin />} />
        <Route path="/e/:subdomain/checkin"      element={<EnterpriseCheckin />} />
        <Route path="/event/:eventId/login"      element={<OrganizerLogin />} />
        <Route path="/e/:subdomain/login"        element={<OrganizerLogin />} />
        <Route path="/event/:eventId/waitlist"   element={<Waitlist />} />
        <Route path="/e/:subdomain/waitlist"     element={<Waitlist />} />
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
