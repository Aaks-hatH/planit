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

  const count = items.length || pendingCount;
  return (
    <div className="mb-4 overflow-hidden rounded-2xl border border-amber-200 bg-amber-50/60" data-testid="queue-panel">
      <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-3 sm:px-4 sm:py-2">
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex min-h-[44px] flex-1 items-center gap-3 text-left">
          <UploadCloud className="h-5 w-5 flex-shrink-0 text-amber-700" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-neutral-900">{count} check-in{count !== 1 ? 's' : ''} waiting to sync</span>
            <span className="block text-xs text-neutral-600">{failing > 0 ? <span className="font-semibold text-red-600">{failing} failed. Tap Sync now to retry.</span> : 'Saved on this device. They upload when you are online.'}</span>
          </span>
          {open ? <ChevronUp className="h-4 w-4 flex-shrink-0 text-neutral-500" /> : <ChevronDown className="h-4 w-4 flex-shrink-0 text-neutral-500" />}
        </button>
        <button onClick={sync} disabled={busy} className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 px-5 text-sm font-semibold text-white hover:bg-black disabled:opacity-60 sm:min-h-[44px] sm:w-auto">
          <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} aria-hidden="true" /> Sync now
        </button>
      </div>
      {open && (
        <ul className="divide-y divide-amber-100 border-t border-amber-100 bg-white">
          {items.map((it) => {
            const name = names[it.inviteCode] || it.inviteCode;
            return (
              <li key={it.id} className="flex items-start gap-3 px-4 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="break-words font-semibold text-neutral-900">{name} <span className="font-mono text-xs font-normal text-neutral-400">{it.inviteCode}</span></p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    Queued {new Date(it.queuedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    {' · '}{it.attempts || 0} attempt{(it.attempts || 0) !== 1 ? 's' : ''}
                  </p>
                  {it.lastError && <p className="mt-1 text-xs text-red-600">Last error: {it.lastError}</p>}
                </div>
                {it.lastError && (
                  <button onClick={sync} disabled={busy} className="min-h-[44px] flex-shrink-0 rounded-lg border border-neutral-200 px-3.5 text-sm font-semibold text-neutral-700 disabled:opacity-60">Retry</button>
                )}
              </li>
            );
          })}
          {items.length === 0 && <li className="px-4 py-3 text-sm text-neutral-500">Nothing queued.</li>}
        </ul>
      )}
    </div>
  );
}
