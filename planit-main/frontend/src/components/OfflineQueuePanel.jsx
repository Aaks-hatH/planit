import { useState, useEffect, useCallback } from 'react';
import { UploadCloud, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import offlineCheckin from '../services/offlineCheckin';

/**
 * OfflineQueuePanel — lists check-ins saved on this device that have not reached the server yet.
 * There is intentionally NO "clear queue" button: dropping items would leave guests un-admitted on the server.
 * Props: eventId, pendingCount, syncing, onSync (async)
 */
export default function OfflineQueuePanel({ eventId, pendingCount, onSync }) {
  const [items, setItems] = useState([]);
  const [names, setNames] = useState({});
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const list = await offlineCheckin.queueItems(eventId);
    // Guest names come from the saved guest list; make sure it is loaded (the page may have just reopened offline).
    if (list.length && !offlineCheckin.hasCache()) { try { await offlineCheckin.loadCacheFromDB(eventId); } catch { /* names fall back to codes */ } }
    const map = {};
    for (const it of list) map[it.inviteCode] = offlineCheckin.lookupGuest(it.inviteCode)?.name || '';
    setNames(map);
    setItems(list);
  }, [eventId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load, pendingCount]);

  async function sync() {
    setBusy(true);
    try { await onSync?.(); } finally { setBusy(false); load(); }
  }

  if (!pendingCount && items.length === 0) return null;
  const failing = items.filter((i) => i.lastError).length;

  return (
    <div className="mb-4 rounded-2xl border border-neutral-200 bg-white shadow-sm" data-testid="queue-panel">
      <div className="flex items-center gap-3 px-4 py-2">
        <UploadCloud className="w-4 h-4 text-neutral-500 flex-shrink-0" />
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex-1 min-h-[44px] flex items-center gap-2 text-left text-sm font-semibold text-neutral-900">
          {items.length || pendingCount} check-in{(items.length || pendingCount) !== 1 ? 's' : ''} waiting to sync
          {failing > 0 && <span className="text-xs font-semibold text-red-600">· {failing} failed</span>}
          {open ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
        </button>
        <button onClick={sync} disabled={busy} className="min-h-[44px] px-4 rounded-xl bg-neutral-900 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-60">
          <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} /> Sync now
        </button>
      </div>
      {open && (
        <ul className="border-t border-neutral-100 divide-y divide-neutral-100">
          {items.map((it) => {
            const name = names[it.inviteCode] || it.inviteCode;
            return (
              <li key={it.id} className="px-4 py-2.5 text-xs flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-neutral-900 truncate">{name} <span className="font-mono text-neutral-400 font-normal">{it.inviteCode}</span></p>
                  <p className="text-neutral-500">
                    Queued {new Date(it.queuedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    {' · '}{it.attempts || 0} attempt{(it.attempts || 0) !== 1 ? 's' : ''}
                  </p>
                  {it.lastError && <p className="text-red-600 mt-0.5">Last error: {it.lastError}</p>}
                </div>
                {it.lastError && (
                  <button onClick={sync} disabled={busy} className="min-h-[44px] px-3 rounded-lg border border-neutral-200 text-xs font-semibold text-neutral-700 disabled:opacity-60">Retry</button>
                )}
              </li>
            );
          })}
          {items.length === 0 && <li className="px-4 py-3 text-xs text-neutral-500">Nothing queued.</li>}
        </ul>
      )}
    </div>
  );
}
