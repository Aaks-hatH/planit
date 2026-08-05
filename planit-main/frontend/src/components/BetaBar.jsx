import { useState, useCallback } from 'react';
import { AlertTriangle, ChevronRight, ClipboardCopy } from 'lucide-react';
import toast from 'react-hot-toast';
import { isBetaDebugEnabled, dumpFeatureLog } from '../utils/betaDiagnostics';

// ═══════════════════════════════════════════════════════════════════════════
// BetaBar — shared collapsible banner for any beta feature
//
// Originally lived only inside VenueWalk.jsx; pulled out here so every beta
// feature (Venue Walk today, whatever's next) gets the same honest framing
// and the same diagnostics affordance for free, instead of each page
// reinventing its own banner and its own copy of "is debug mode on".
//
// `featureId` ties this bar to that feature's local diagnostics ring buffer
// (see utils/betaDiagnostics.js). When debug mode is on (localStorage flag,
// see that file's enable()/disable()), an expanded "Copy diagnostics" button
// appears — it only reads what's already sitting in memory on this device
// and copies it to the clipboard. Nothing is sent anywhere by this
// component; that's a deliberate, separate decision for later.
// ═══════════════════════════════════════════════════════════════════════════
export function BetaBar({ featureId, title, description }) {
  const [expanded, setExpanded] = useState(false);
  const debugOn = isBetaDebugEnabled();

  const handleCopyDiagnostics = useCallback(() => {
    const log = dumpFeatureLog(featureId);
    if (!log.length) {
      toast('Nothing logged yet for this feature — try using it a bit first.');
      return;
    }
    const text = JSON.stringify(log, null, 2);
    navigator.clipboard
      ?.writeText(text)
      .then(() => toast.success(`Copied ${log.length} diagnostic entries`))
      .catch(() => toast.error('Could not copy — check the console instead (window.__planItBeta.dump())'));
  }, [featureId]);

  return (
    <div className="border-b border-amber-400/20 bg-amber-400/[0.06]">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-2 px-4 py-2 text-left"
      >
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span className="text-[11px] font-mono tracking-wide text-amber-300/90 flex-1">
          {title}
        </span>
        {debugOn && (
          <span className="text-[9px] font-mono text-amber-400/70 border border-amber-400/30 rounded px-1 py-0.5 shrink-0">
            DEBUG
          </span>
        )}
        <ChevronRight className={`w-3.5 h-3.5 text-amber-400/60 transition-transform shrink-0 ${expanded ? 'rotate-90' : ''}`} />
      </button>
      {expanded && (
        <div className="px-4 pb-3 -mt-0.5 text-[12px] leading-relaxed text-neutral-400 max-w-2xl">
          {description}
          {debugOn && (
            <button
              onClick={handleCopyDiagnostics}
              className="mt-2 flex items-center gap-1.5 text-[11px] font-mono text-amber-300/80 hover:text-amber-300"
            >
              <ClipboardCopy className="w-3 h-3" />
              Copy diagnostics ({featureId})
            </button>
          )}
        </div>
      )}
    </div>
  );
}
