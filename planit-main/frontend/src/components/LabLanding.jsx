import { Sparkles, Lock, ChevronRight, ShieldAlert } from 'lucide-react';

/** Shared PlanIt Labs landing layout (hero left, live preview right, three
 *  steps, honest-limits panel) — same structure as the Face Ticket and
 *  Venue Walk landings. */
export default function LabLanding({
  accent = '#8B7FFF',
  headline, body, primary, secondary, footnote, preview, steps, notes,
}) {
  const PIcon = primary.icon;
  const SIcon = secondary?.icon;
  return (
    <div className="max-w-6xl mx-auto px-5 sm:px-8 py-12 sm:py-20">
      <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
        <div>
          <div className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.15em] uppercase mb-5" style={{ color: accent }}>
            <Sparkles className="w-3 h-3" />
            PlanIt Labs &middot; Experimental
          </div>
          <h1 className="font-display font-extrabold text-[2.6rem] sm:text-6xl leading-[1.03] tracking-tight mb-5">{headline}</h1>
          <p className="text-neutral-400 text-base sm:text-lg leading-relaxed max-w-md mb-8">{body}</p>
          <div className="flex flex-col sm:flex-row gap-3 mb-10">
            <button
              onClick={primary.onClick}
              className="group flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold text-sm text-[#05050f] transition-[filter] hover:brightness-110"
              style={{ background: accent }}
            >
              {PIcon && <PIcon className="w-4 h-4" />}
              {primary.label}
              <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </button>
            {secondary && (
              <button
                onClick={secondary.onClick}
                className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-white/15 text-white font-semibold text-sm hover:bg-white/5 transition-colors"
              >
                {SIcon && <SIcon className="w-4 h-4" />}
                {secondary.label}
              </button>
            )}
          </div>
          {footnote && (
            <div className="flex items-center gap-2 text-[12px] text-neutral-500 font-mono">
              <Lock className="w-3.5 h-3.5" />
              {footnote}
            </div>
          )}
        </div>

        <div className="relative">
          <div className="absolute -inset-6 blur-3xl rounded-full" style={{ background: `${accent}1a` }} />
          <div className="relative">{preview}</div>
        </div>
      </div>

      <div className="mt-24 sm:mt-32 grid sm:grid-cols-3 gap-6 sm:gap-8">
        {steps.map((step, i) => (
          <div key={step.title}>
            <div className="flex items-center gap-3 mb-3">
              <span className="font-mono text-xs" style={{ color: accent }}>{String(i + 1).padStart(2, '0')}</span>
              <step.icon className="w-4 h-4 text-neutral-500" />
            </div>
            <h3 className="font-display font-bold text-lg mb-1.5">{step.title}</h3>
            <p className="text-neutral-500 text-sm leading-relaxed">{step.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-20 rounded-xl border border-amber-400/20 bg-amber-400/[0.04] p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-3">
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          <span className="font-display font-bold text-sm">Read before you try it</span>
        </div>
        <ul className="space-y-2 text-sm text-neutral-400 leading-relaxed">
          {notes.map((n, i) => <li key={i}>&bull; {n}</li>)}
        </ul>
      </div>
    </div>
  );
}
