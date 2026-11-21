import { useState, useEffect, useMemo } from 'react';
import { eventAPI } from '../services/api';
import { readReconciliation } from '../utils/doorCountShare';
import DoorCountChart from './DoorCountChart';
import { Card, btn, inputCls } from './DoorCountPanels';

const POLL_MS = 20000;

/** The event this browser is signed in to as an organizer, from the event token
 *  the rest of the app already stores. Staff and guest tokens do not qualify. */
function organizerEvent() {
  try {
    const token = localStorage.getItem('eventToken');
    if (!token) return null;
    const p = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (p.role !== 'organizer' || !p.eventId) return null;
    if (p.exp && p.exp * 1000 < Date.now()) return null;
    return String(p.eventId);
  } catch {
    return null;
  }
}

/**
 * "Compare with check-in scans": walked in (this camera) minus scanned in.
 * Uses the existing check-in stats call when signed in as an organizer, or a
 * number typed by hand. Both sides are counted from the moment comparison
 * starts, so they cover the same window. No new backend routes.
 */
export default function DoorCountReconcile({ walkedIn, reconRef }) {
  const eventId = useMemo(organizerEvent, []);
  const [on, setOn] = useState(false);
  const [walkedBase, setWalkedBase] = useState(0);
  const [scanBase, setScanBase] = useState(null);   // check-in total when comparison started
  const [apiTotal, setApiTotal] = useState(null);
  const [apiError, setApiError] = useState('');
  const [manual, setManual] = useState('');
  const [samples, setSamples] = useState([]);

  const useApi = !!eventId && !apiError;

  useEffect(() => {
    if (!on || !useApi) return undefined;
    let dead = false;
    const read = async () => {
      try {
        const { data } = await eventAPI.getCheckInStats(eventId);
        const st = data.stats || {};
        const total = st.totalActualAttendees ?? st.checkedIn; // people scanned in, not parties
        if (dead || !Number.isFinite(total)) return;
        setApiTotal(total);
        setScanBase((b) => b ?? total);
      } catch (e) {
        if (!dead) setApiError(e?.response?.data?.error || 'Could not read the check-in count.');
      }
    };
    read();
    const id = setInterval(read, POLL_MS);
    return () => { dead = true; clearInterval(id); };
  }, [on, useApi, eventId]);

  const walked = Math.max(0, walkedIn - walkedBase);
  const scanned = useApi
    ? (apiTotal == null || scanBase == null ? null : Math.max(0, apiTotal - scanBase))
    : (manual === '' ? null : Math.max(0, Math.round(+manual) || 0));

  useEffect(() => {
    if (!on || scanned == null) return;
    setSamples((s) => [...s.slice(-499), { t: Date.now(), walked, scanned, diff: walked - scanned }]);
  }, [on, walked, scanned]);

  useEffect(() => { reconRef.current = on ? { source: useApi ? 'check-in stats' : 'manual', samples } : null; }, [on, useApi, samples, reconRef]);

  const restart = () => { setWalkedBase(walkedIn); setScanBase(apiTotal); setManual(''); setSamples([]); };
  const toggle = (v) => { setOn(v); if (v) restart(); };

  return (
    <Card title="Compare with check-in scans">
      <label className="flex items-center gap-3 min-h-[44px] text-sm cursor-pointer">
        <input type="checkbox" checked={on} onChange={(e) => toggle(e.target.checked)} className="w-5 h-5" />
        Compare walked-in with scanned-in
      </label>
      {on && (
        <div className="mt-3 space-y-3">
          {useApi ? (
            <p className="text-xs text-neutral-500">Reading scans from your event&rsquo;s check-in stats every 20 seconds, counted from when you started comparing.</p>
          ) : (
            <>
              {apiError && <p className="text-xs text-amber-300">{apiError} Enter the number by hand instead.</p>}
              {!eventId && !apiError && <p className="text-xs text-neutral-500">Sign in as the event organizer to read scans automatically. Until then, type the number of people scanned in since you started comparing.</p>}
              <label className="block">
                <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 block mb-1.5">People scanned in since comparing began</span>
                <input type="number" min="0" inputMode="numeric" className={inputCls} value={manual} onChange={(e) => setManual(e.target.value)} />
              </label>
            </>
          )}
          <div className="grid grid-cols-3 gap-2 text-center">
            {[['Walked in', walked], ['Scanned in', scanned ?? '-'], ['Difference', scanned == null ? '-' : walked - scanned]].map(([l, v]) => (
              <div key={l}>
                <div className="font-display font-extrabold text-2xl tabular-nums">{v}</div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">{l}</div>
              </div>
            ))}
          </div>
          <p className="text-sm text-neutral-300">{scanned == null ? 'Waiting for a scanned-in number.' : readReconciliation(walked, scanned)}</p>
          <DoorCountChart signed series={samples.map((s) => [s.t, s.diff])} empty="Walked in minus scanned in appears here." />
          <button className={btn} onClick={restart}>Restart comparison</button>
        </div>
      )}
    </Card>
  );
}
