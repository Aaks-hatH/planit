import { useState, useEffect, useCallback, useRef } from 'react';
import { CheckCircle2, XCircle, Loader2, WifiOff } from 'lucide-react';
import offlineCheckin from '../services/offlineCheckin';
import { requestPersistentStorage, getStorageStatus } from '../utils/persistentStorage';

const FRESH_MS = 15 * 60 * 1000;

/**
 * OfflineReadiness — header chip: Ready (green) / Not ready (red) / Checking (grey).
 * Tap to see the checklist. Ready needs ALL four items. Re-checked on online/offline and every 30s.
 * Props: eventId, cacheVersion (any value that changes when the saved list changes), onRefresh (async).
 */
export default function OfflineReadiness({ eventId, cacheVersion, onRefresh }) {
  const [checks, setChecks] = useState(null);       // null = still checking
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(null);
  const alive = useRef(true);

  const evaluate = useCallback(async () => {
    const out = [];

    // 1) Guest list saved and fresh
    let info = null;
    try { info = await offlineCheckin.cacheInfo(eventId); } catch { /* ignore */ }
    if (!info || !info.total) {
      out.push({ id: 'list', label: 'Guest list saved', ok: false, why: 'No guest list is saved on this device yet.', fix: 'Refresh guest list' });
    } else if (info.ageMs > FRESH_MS) {
      out.push({ id: 'list', label: 'Guest list saved', ok: false, why: `Saved ${Math.round(info.ageMs / 60000)} min ago. It should be under 15 minutes old.`, fix: 'Refresh guest list' });
    } else {
      out.push({ id: 'list', label: 'Guest list saved', ok: true, why: `${info.total} guests, saved ${Math.max(0, Math.round(info.ageMs / 60000))} min ago.` });
    }

    // 2) Service worker controlling this page
    let swOk = false; let swWhy = 'Offline support is not available in this browser.';
    try {
      if ('serviceWorker' in navigator) {
        swOk = !!navigator.serviceWorker.controller;
        swWhy = swOk ? 'Offline helper is running.' : 'The offline helper is not controlling this page yet.';
      }
    } catch { /* ignore */ }
    out.push({ id: 'sw', label: 'Offline helper active', ok: swOk, why: swWhy, fix: swOk || !('serviceWorker' in navigator) ? null : 'Reload page' });

    // 3) App shell in the precache
    let shellOk = false;
    try {
      shellOk = !!(typeof caches !== 'undefined' && await caches.match('/index.html', { ignoreSearch: true }));
    } catch { /* ignore */ }
    out.push({ id: 'shell', label: 'App saved for offline', ok: shellOk, why: shellOk ? 'App files are saved on this device.' : 'App files are not saved yet. Stay online a few seconds and reload.', fix: shellOk ? null : 'Reload page' });

    // 4) Persistent storage
    const st = await getStorageStatus();
    out.push({
      id: 'storage', label: 'Storage protected', ok: st.persisted,
      why: st.persisted ? 'The browser will not delete saved check-in data.'
        : st.supported ? 'The browser may delete saved data if the phone runs low on space. Installing PlanIt to the Home Screen usually fixes this.'
        : 'This browser cannot protect saved data from being cleared.',
      fix: !st.persisted && st.supported ? 'Ask browser to keep data' : null,
    });

    if (alive.current) setChecks(out);
  }, [eventId]);

  useEffect(() => {
    alive.current = true;
    evaluate();
    const t = setInterval(evaluate, 30000);
    const on = () => evaluate();
    window.addEventListener('online', on);
    window.addEventListener('offline', on);
    return () => { alive.current = false; clearInterval(t); window.removeEventListener('online', on); window.removeEventListener('offline', on); };
  }, [evaluate, cacheVersion]);

  async function runFix(id) {
    setBusy(id);
    try {
      if (id === 'list') await onRefresh?.();
      else if (id === 'storage') await requestPersistentStorage();
      else if (id === 'sw' || id === 'shell') { window.location.reload(); return; }
      await evaluate();
    } finally { if (alive.current) setBusy(null); }
  }

  const state = checks === null ? 'checking' : checks.every((c) => c.ok) ? 'ready' : 'not-ready';
  const chip = {
    ready:       { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', text: 'Ready for offline' },
    'not-ready': { cls: 'bg-red-50 text-red-700 border-red-200',             dot: 'bg-red-500',     text: 'Not ready for offline' },
    checking:    { cls: 'bg-neutral-100 text-neutral-600 border-neutral-200', dot: 'bg-neutral-400', text: 'Checking…' },
  }[state];

  return (
    <div className="relative flex-1 sm:flex-none">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        data-testid="offline-ready-chip"
        data-state={state}
        className={`w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-2 px-3 text-xs font-semibold rounded-xl border ${chip.cls}`}
      >
        <span className={`w-2 h-2 rounded-full ${chip.dot}`} />
        <span>{chip.text}</span>
      </button>
      {open && (
        <div className="absolute right-0 left-0 sm:left-auto top-full mt-2 z-30 sm:w-80 rounded-2xl border border-neutral-200 bg-white shadow-xl p-3 text-left">
          <p className="text-xs font-bold text-neutral-900 mb-2 flex items-center gap-1.5"><WifiOff className="w-3.5 h-3.5" /> Offline checklist</p>
          {checks === null && <p className="text-xs text-neutral-500 py-2">Checking…</p>}
          <ul className="space-y-2">
            {(checks || []).map((c) => (
              <li key={c.id} className="flex items-start gap-2">
                {c.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" /> : <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-neutral-900">{c.label}</p>
                  <p className="text-xs text-neutral-500 leading-snug">{c.why}</p>
                  {!c.ok && c.fix && (
                    <button onClick={() => runFix(c.id)} disabled={busy === c.id} className="mt-1.5 min-h-[44px] px-3 text-xs font-semibold rounded-lg bg-neutral-900 text-white disabled:opacity-60 inline-flex items-center gap-1.5">
                      {busy === c.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}{c.fix}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
