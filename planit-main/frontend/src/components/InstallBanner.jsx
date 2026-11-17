import { useState } from 'react';
import { Download, Share, X, PlusSquare } from 'lucide-react';
import { useInstallPrompt } from '../hooks/useInstallPrompt';

/**
 * InstallBanner
 * Shown only when the browser can install PlanIt (Android / desktop Chrome / Edge) or on iOS Safari
 * when not installed. Never when already installed. Mount it only after the person has done
 * something meaningful (staff logged in, ticket loaded and saved), never on a first visit.
 *
 * variant: 'light' (check-in page) | 'dark' (guest ticket)
 */
export default function InstallBanner({ variant = 'light', className = '' }) {
  const { canInstall, showIOSHelp, promptInstall, dismiss } = useInstallPrompt();
  const [busy, setBusy] = useState(false);
  if (!canInstall && !showIOSHelp) return null;

  const dark = variant === 'dark';
  const shell = dark
    ? 'bg-neutral-900/80 border-neutral-700 text-neutral-200'
    : 'bg-white border-neutral-200 text-neutral-800 shadow-sm';
  const sub = dark ? 'text-neutral-400' : 'text-neutral-500';
  const closeCls = dark ? 'text-neutral-400 hover:bg-neutral-800' : 'text-neutral-400 hover:bg-neutral-100';

  async function install() {
    setBusy(true);
    try { await promptInstall(); } finally { setBusy(false); }
  }

  return (
    <div role="region" aria-label="Install PlanIt" className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${shell} ${className}`}>
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${dark ? 'bg-neutral-800' : 'bg-neutral-100'}`}>
        <Download className="w-4 h-4" />
      </div>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-bold">Install PlanIt</p>
        {canInstall ? (
          <p className={`text-xs mt-0.5 ${sub}`}>Opens faster and keeps working with no signal.</p>
        ) : (
          <p className={`text-xs mt-0.5 leading-relaxed ${sub}`}>
            Tap <Share className="inline w-3.5 h-3.5 -mt-0.5 mx-0.5" aria-label="Share" />, then{' '}
            <strong className="font-semibold">Add to Home Screen</strong>{' '}
            <PlusSquare className="inline w-3.5 h-3.5 -mt-0.5" aria-hidden="true" />.
          </p>
        )}
      </div>
      {canInstall && (
        <button
          onClick={install}
          disabled={busy}
          className={`min-h-[44px] px-4 rounded-xl text-sm font-semibold flex-shrink-0 disabled:opacity-60 ${dark ? 'bg-white text-neutral-900 hover:bg-neutral-200' : 'bg-neutral-900 text-white hover:bg-neutral-800'}`}
        >
          Install PlanIt
        </button>
      )}
      <button onClick={dismiss} aria-label="Dismiss" className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl flex-shrink-0 ${closeCls}`}>
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
