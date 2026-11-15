/**
 * StepIndicator — small progress bar + label used at the top of each screen
 * in a multi-step demo flow (Venue Walk setup/find, Face Ticket enroll/scan).
 *
 * `labels` is the full ordered list of step names; `index` is the
 * zero-based index of the step currently on screen. Purely presentational —
 * flows own their own step state and just tell this component where they
 * are.
 */
export default function StepIndicator({ labels, index }) {
  if (!labels || !labels.length) return null;
  const clamped = Math.max(0, Math.min(index, labels.length - 1));

  return (
    <div className="max-w-md mx-auto px-5 pt-6">
      <div className="flex items-center gap-1.5 mb-2">
        {labels.map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
              i <= clamped ? 'bg-[#8B7FFF]' : 'bg-white/10'
            }`}
          />
        ))}
      </div>
      <div className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">
        Step {clamped + 1} of {labels.length} &middot; {labels[clamped]}
      </div>
    </div>
  );
}
