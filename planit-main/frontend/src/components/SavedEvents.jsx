import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { WifiOff, X } from 'lucide-react';
import { listSavedEvents, forgetSavedEvent } from '../utils/offlineEvent';

/**
 * SavedEvents — "Events on this device" for the home page.
 * An installed PlanIt app has no address bar, so this is how people get back to an event (and to
 * check-in) without typing a link. It reads only what this device saved, so it works with no internet.
 */
export default function SavedEvents() {
  const navigate = useNavigate();
  const [events, setEvents] = useState(() => listSavedEvents());
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' && navigator.onLine === false);
  const refresh = useCallback(() => setEvents(listSavedEvents()), []);

  useEffect(() => {
    const down = () => setOffline(true);
    const up = () => setOffline(false);
    window.addEventListener('offline', down);
    window.addEventListener('online', up);
    return () => { window.removeEventListener('offline', down); window.removeEventListener('online', up); };
  }, []);

  if (events.length === 0) return null;

  const base = (m) => (m.subdomain ? `/e/${m.subdomain}` : `/event/${m.id}`);
  const btn = { minHeight: 44, padding: '0 14px', borderRadius: 8, border: '2px solid #fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' };

  return (
    <div data-testid="saved-events" style={{ marginTop: 22, maxWidth: 440 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.85)', marginBottom: 8 }}>
        Events on this device
        {offline && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,.2)', borderRadius: 99, padding: '2px 8px', textTransform: 'none', letterSpacing: 0 }}><WifiOff size={12} /> Offline</span>}
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
        {events.map((m) => (
          <li key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,.14)', borderRadius: 10, padding: '8px 8px 8px 12px' }}>
            <span style={{ flex: 1, minWidth: 0, color: '#fff', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title || m.subdomain || 'Event'}</span>
            <button onClick={() => navigate(base(m))} style={{ ...btn, background: '#fff', color: '#0d0e1c' }}>Open</button>
            <button onClick={() => navigate(`${base(m)}/checkin`)} style={{ ...btn, background: 'transparent', color: '#fff' }}>Check-in</button>
            <button onClick={() => { forgetSavedEvent(m.id); refresh(); }} aria-label={`Remove ${m.title || 'event'} from this list`} style={{ minWidth: 44, minHeight: 44, background: 'transparent', border: 0, color: 'rgba(255,255,255,.75)', cursor: 'pointer' }}><X size={16} /></button>
          </li>
        ))}
      </ul>
    </div>
  );
}
