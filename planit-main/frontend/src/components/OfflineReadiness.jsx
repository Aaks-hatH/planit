import { useState, useEffect, useCallback, useRef } from 'react';
import { CheckCircle2, XCircle, Loader2, WifiOff, ChevronRight, RefreshCw, Download } from 'lucide-react';
import offlineCheckin from '../services/offlineCheckin';
import { requestPersistentStorage, getStorageStatus } from '../utils/persistentStorage';
import { ResponsivePanel } from './ui/Sheet';
import InstallGuide from './InstallGuide';
import { useInstallPrompt } from '../hooks/useInstallPrompt';

const FRESH_MS = 15 * 60 * 1000;

/**
 * OfflineReadiness: a full-width status card (not a tiny chip, which got crushed on phones):
 * Ready (green) / Not ready (red) / Checking (grey). Tap it to open the checklist: a bottom sheet on
 * phones, a popover on desktop. Ready needs ALL four items. Re-checked on online/offline and every 30s.
 * Props: eventId, cacheVersion (any value that changes when the saved list changes), onRefresh (async).
 */
export default function OfflineReadiness({ eventId, cacheVersion, onRefresh }) {
  const [checks, setChecks] = useState(null);       // null = still checking
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const { isInstalled } = useInstallPrompt();
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
  const okCount = (checks || []).filter((c) => c.ok).length;
  const firstBad = (checks || []).find((c) => !c.ok);
  const chip = {
    ready:       { cls: 'bg-emerald-50 text-emerald-900 border-emerald-200', dot: 'bg-emerald-500', text: 'Ready for offline', sub: `All ${checks?.length || 4} checks passed` },
    'not-ready': { cls: 'bg-red-50 text-red-900 border-red-200',             dot: 'bg-red-500',     text: 'Not ready for offline', sub: firstBad ? `Needs attention: ${firstBad.label}` : 'Tap to see what is missing' },
    checking:    { cls: 'bg-neutral-100 text-neutral-700 border-neutral-200', dot: 'bg-neutral-400 animate-pulse', text: 'Checking offline setup\u2026', sub: 'One moment' },
  }[state];

  return (
    <div className="relative w-full sm:w-auto">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        data-testid="offline-ready-chip"
        data-state={state}
        className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors sm:w-auto sm:min-w-[19rem] sm:py-2.5 ${chip.cls}`}
      >
        <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${chip.dot}`} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold leading-tight">{chip.text}</span>
          <span className="mt-0.5 block truncate text-xs opacity-80">{chip.sub}</span>
        </span>
        <ChevronRight className={`h-4 w-4 flex-shrink-0 opacity-60 transition-transform ${open ? 'rotate-90' : ''}`} aria-hidden="true" />
      </button>

      <ResponsivePanel
        open={open}
        onClose={() => setOpen(false)}
        title="Offline readiness"
        subtitle={checks ? `${okCount} of ${checks.length} checks passed. All four must pass to scan with no signal.` : 'Checking this device\u2026'}
        icon={WifiOff}
        align="left"
        widthClass="w-[25rem]"
        footer={(
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-neutral-500">Re-checked every 30 seconds.</p>
            <button onClick={() => evaluate()} className="inline-flex min-h-[44px] flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-neutral-200 px-3.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 sm:min-h-[36px]">
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Check again
            </button>
          </div>
        )}
      >
        {checks === null && <p className="py-4 text-sm text-neutral-500">Checking…</p>}
        <ul className="space-y-3 pb-1">
          {(checks || []).map((c) => (
            <li key={c.id} className={`flex items-start gap-3 rounded-2xl border p-3.5 ${c.ok ? 'border-neutral-200 bg-white' : 'border-red-200 bg-red-50/60'}`}>
              {c.ok
                ? <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" aria-label="Passed" />
                : <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-500" aria-label="Needs attention" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-snug text-neutral-900">{c.label}</p>
                <p className="mt-0.5 text-sm leading-snug text-neutral-600">{c.why}</p>
                {!c.ok && (c.fix || c.id === 'storage') && (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    {c.fix && (
                      <button onClick={() => runFix(c.id)} disabled={busy === c.id} className="inline-flex min-h-[48px] w-full items-center justify-center gap-1.5 rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white hover:bg-black disabled:opacity-60 sm:min-h-[40px] sm:w-auto">
                        {busy === c.id && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}{c.fix}
                      </button>
                    )}
                    {c.id === 'storage' && !isInstalled && (
                      <button onClick={() => { setOpen(false); setGuideOpen(true); }} className="inline-flex min-h-[48px] w-full items-center justify-center gap-1.5 rounded-xl border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 sm:min-h-[40px] sm:w-auto">
                        <Download className="h-4 w-4" aria-hidden="true" /> How to install the app
                      </button>
                    )}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </ResponsivePanel>

      <InstallGuide open={guideOpen} onClose={() => setGuideOpen(false)} />
    </div>
  );
}
