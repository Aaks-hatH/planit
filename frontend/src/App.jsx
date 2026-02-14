import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import EventSpace from './pages/EventSpace';
import Admin from './pages/Admin';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import NotFound from './pages/NotFound';
import Support from './pages/Support';
import SupportSuccess from './pages/SupportSuccess';
import WallOfSupporters from './pages/WallOfSupporters';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        
        {/* ── FIX: Add subdomain route for clean URLs ── */}
        <Route path="/e/:subdomain" element={<EventSpace />} />
        {/* Keep ID route for backward compatibility */}
        <Route path="/event/:eventId" element={<EventSpace />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/support" element={<Support />} />
        <Route path="/support/success" element={<SupportSuccess />} />
        <Route path="/support/wall" element={<WallOfSupporters />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default App;
