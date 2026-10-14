import { ArrowLeft, ArrowRight, Eye, Smile, ScanFace, CheckCircle2 } from 'lucide-react';

const ICONS = { left: ArrowLeft, right: ArrowRight, blink: Eye, mouth: Smile, calibrate: ScanFace };

/** Overlay shown on the camera preview while the active liveness challenge runs.
 *  `challenge` is the last payload from runLivenessCapture's onChallenge. */
export default function LivenessPrompt({ challenge }) {
  if (!challenge) return null;
  const Icon = challenge.phase === 'passed' ? CheckCircle2 : (ICONS[challenge.id] || ScanFace);
  const passed = challenge.phase === 'passed';
  return (
    <div className="absolute top-3 left-3 right-3 flex items-center justify-center pointer-events-none">
      <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-full backdrop-blur border text-sm font-semibold ${
        passed ? 'bg-teal-400/20 border-teal-300/40 text-teal-100' : 'bg-black/60 border-white/20 text-white'
      }`}>
        <Icon className="w-5 h-5" />
        <span>{passed ? 'Got it' : challenge.label}</span>
        {challenge.index >= 0 && (
          <span className="font-mono text-[11px] text-white/60">{challenge.index + 1}/{challenge.total}</span>
        )}
      </div>
    </div>
  );
}
