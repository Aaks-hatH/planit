import { useState } from 'react';
import { Share2, ClipboardCopy } from 'lucide-react';
import toast from '../utils/toast';
import { buildShare, shareText } from '../utils/doorCountShare';
import { Card, btn } from './DoorCountPanels';

/**
 * Consent-based "Share anonymous result". It shows the exact text first and
 * only copies it to the clipboard; this page sends nothing. (The existing
 * bug-report route needs an email address and records the sender's IP, so it
 * is not anonymous and was deliberately not used.)
 */
export default function DoorCountShare({ settings, perfRef, labResult }) {
  const [text, setText] = useState(null); // exact text on screen, or null when closed
  const [consent, setConsent] = useState(false);

  const open = () => {
    // Accuracy is included only if the lab measured the preset that is currently applied.
    const row = labResult?.rows.find((r) => r.preset.model === settings.model && r.preset.n === settings.n && r.preset.gate === settings.gateMode);
    const lab = row ? { row, clip: labResult.clip, taps: labResult.taps } : null;
    setText(shareText(buildShare(settings, perfRef.current, lab)));
    setConsent(false);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied. Paste it wherever you choose to share it.');
    } catch {
      toast.error('Could not copy. Select the text above and copy it by hand.');
    }
  };

  return (
    <Card title="Share anonymous result (optional)">
      {!text ? (
        <>
          <p className="text-xs text-neutral-400 mb-3">Help others judge how on-device counting performs. You see exactly what would be shared before anything is copied. It is numbers only: no video, no images, no name.</p>
          <button className={btn} onClick={open}><Share2 className="inline w-4 h-4 mr-2" />Share anonymous result</button>
        </>
      ) : (
        <>
          <p className="text-xs text-neutral-400 mb-2">This is everything that would be shared. Fields shown as null were not measured.</p>
          <pre className="text-xs font-mono bg-black/40 border border-white/10 rounded-lg p-3 overflow-x-auto mb-3 whitespace-pre-wrap break-words">{text}</pre>
          <label className="flex items-start gap-3 min-h-[44px] text-sm cursor-pointer mb-3">
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="w-5 h-5 mt-0.5" />
            I have read this and agree to share these numbers.
          </label>
          <div className="flex gap-2">
            <button className={btn} disabled={!consent} onClick={copy}><ClipboardCopy className="inline w-4 h-4 mr-2" />Copy to clipboard</button>
            <button className={btn} onClick={() => setText(null)}>Close</button>
          </div>
        </>
      )}
    </Card>
  );
}
