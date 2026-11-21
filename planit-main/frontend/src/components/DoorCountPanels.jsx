import { CheckCircle2, AlertTriangle, XCircle, Loader2, Plus, Minus } from 'lucide-react';
import { capacityLevel } from '../utils/doorCount';
import { MODELS } from '../utils/doorCountModel';
import { INTERVALS } from '../utils/doorCountLab';
import { ACCENT } from '../utils/doorCountDraw';

export const btn = 'min-h-[44px] px-4 rounded-lg border border-white/15 text-sm text-neutral-200 hover:bg-white/5 active:bg-white/10 transition-colors disabled:opacity-40';
export const btnPrimary = 'min-h-[44px] px-4 rounded-lg font-bold text-sm text-[#05050f] disabled:opacity-40 hover:brightness-110 transition-[filter]';
export const inputCls = 'w-full min-h-[44px] rounded-lg bg-black/40 border border-white/15 px-3 text-sm text-white';

export function Card({ title, children, className = '' }) {
  return (
    <section className={`rounded-xl border border-white/10 bg-white/[0.03] p-4 ${className}`}>
      {title && <h3 className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 mb-3">{title}</h3>}
      {children}
    </section>
  );
}

const LEVEL_COLOR = ['#3ECF8E', '#F5B942', '#FF5D5D'];

// ─── Counts, capacity, manual corrections ──────────────────────────────────
export function CountersCard({ counts, cap, onCap, onManual }) {
  const occ = counts.in - counts.out;
  const lv = capacityLevel(occ, cap);
  const Big = ({ value, label }) => (
    <div>
      <div className="font-display font-extrabold text-3xl tabular-nums leading-none">{value}</div>
      <div className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 mt-1">{label}</div>
    </div>
  );
  return (
    <Card title="Count">
      <div className="grid grid-cols-2 gap-4 mb-4">
        <Big value={counts.in} label="In" />
        <Big value={counts.out} label="Out" />
        <div>
          <div className="font-display font-extrabold text-3xl tabular-nums leading-none" style={{ color: cap > 0 ? LEVEL_COLOR[lv] : undefined }}>{occ}</div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 mt-1">Inside now</div>
        </div>
        <Big value={counts.peak} label="Peak" />
      </div>

      <div className="h-2.5 rounded-full bg-black/40 border border-white/10 overflow-hidden mb-2" role="progressbar" aria-valuenow={occ} aria-valuemax={cap || undefined} aria-label="Capacity">
        <div className="h-full transition-[width] duration-200" style={{ width: cap > 0 ? `${Math.min(100, (occ / cap) * 100)}%` : 0, background: LEVEL_COLOR[lv] }} />
      </div>
      <label className="flex items-center gap-2 text-sm text-neutral-400 mb-3">
        <span className="flex-1">Capacity limit (0 = off)</span>
        <input type="number" min="0" inputMode="numeric" value={cap || ''} onChange={(e) => onCap(Math.max(0, Math.round(+e.target.value || 0)))} className={`${inputCls} !w-24`} />
      </label>
      {cap > 0 && <p className="text-xs mb-3" style={{ color: LEVEL_COLOR[lv] }}>{occ} of {cap}{lv === 2 ? ': full' : lv === 1 ? ': nearly full' : ''}</p>}

      <p className="text-xs text-neutral-500 mb-2">Correct a miss by hand. Manual corrections count toward in and out and are marked as manual in the export.</p>
      <div className="grid grid-cols-2 gap-2">
        <button className={btn} onClick={() => onManual('in')}><Plus className="inline w-4 h-4 mr-1" />1 in</button>
        <button className={btn} onClick={() => onManual('out')}><Minus className="inline w-4 h-4 mr-1" />1 out</button>
      </div>
    </Card>
  );
}

// ─── Performance ───────────────────────────────────────────────────────────
export function PerformanceCard({ stats, model }) {
  const f = (v, d = 1) => (v == null ? '-' : v.toFixed(d));
  const info = model.info;
  return (
    <Card title="Performance, measured live on this device">
      <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 gap-y-1 text-sm font-mono tabular-nums">
        <span /><span className="text-[10px] text-neutral-500 text-right">last</span><span className="text-[10px] text-neutral-500 text-right">avg</span>
        <span className="text-neutral-400">Display FPS</span><b className="text-right">{f(stats.fps, 0)}</b><b />
        <span className="text-neutral-400">Inference (ms)</span><b className="text-right">{f(stats.inferLast)}</b><b className="text-right">{f(stats.inferAvg)}</b>
        <span className="text-neutral-400">Frame to count (ms)</span><b className="text-right">{f(stats.latLast)}</b><b className="text-right">{f(stats.latAvg)}</b>
      </div>
      <p className="text-xs text-neutral-500 mt-3">
        {model.state === 'ready' && info
          ? `${info.model.full}, ${info.model.size}px, ${info.delegate}. Model ${info.source === 'cache' ? 'read from this device\u2019s cache' : 'downloaded now and cached for next time'}.`
          : model.state === 'loading' ? `${model.message}\u2026` : 'No model loaded.'}
      </p>
      <p className="text-xs text-neutral-600 mt-1">Frame to count is the time from a frame arriving in the page to the count registering. It excludes camera and display delay.</p>
    </Card>
  );
}

// ─── Setup quality check ───────────────────────────────────────────────────
const STATE_ICON = {
  ok: <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />,
  warn: <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />,
  fail: <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />,
  wait: <Loader2 className="w-4 h-4 text-neutral-500 shrink-0 mt-0.5" />,
};

export function SetupCheck({ setup, running }) {
  return (
    <Card title="Setup check">
      {!running ? (
        <p className="text-sm text-neutral-500">Start the camera and this checklist scores the view live, before you count.</p>
      ) : (
        <>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="font-display font-extrabold text-3xl tabular-nums" style={{ color: ACCENT }}>{setup?.score ?? '-'}</span>
            <span className="text-xs text-neutral-500">{setup?.score == null ? 'measuring' : 'out of 100, a rough guide only'}</span>
          </div>
          <ul className="space-y-3">
            {(setup?.checks || []).map((c) => (
              <li key={c.id} className="flex gap-2.5">
                {STATE_ICON[c.state]}
                <div className="min-w-0">
                  <div className="text-sm font-medium">{c.label}</div>
                  <div className="text-xs text-neutral-500">{c.detail}</div>
                  {c.fix && <div className="text-xs text-neutral-300 mt-1">Fix: {c.fix}</div>}
                </div>
              </li>
            ))}
          </ul>
          <p className="text-xs text-neutral-600 mt-3">These limits are starting points and have not been tuned on real door footage. The Accuracy Lab is the real test.</p>
        </>
      )}
      <details className="mt-4 group">
        <summary className="cursor-pointer text-sm text-neutral-400 min-h-[44px] flex items-center">Camera placement guide</summary>
        <ul className="space-y-1.5 text-xs text-neutral-400 leading-relaxed pb-1">
          <li>&bull; Height: mount above head height, roughly 2.5 m (8 ft), so people are not blocked by the person in front.</li>
          <li>&bull; Angle: tilt down about 30 to 45 degrees, or look straight down if you can. Steeper is better than level, and very steep hides faces and shrinks people.</li>
          <li>&bull; Direction: have people walk across the line, not along it. Put the line where they are visible from head to feet.</li>
          <li>&bull; Light: keep the door and windows behind the camera, not in front of it.</li>
          <li>&bull; These are starting suggestions. Check them with the setup check, then measure in the Accuracy Lab.</li>
        </ul>
      </details>
    </Card>
  );
}

// ─── Controls ──────────────────────────────────────────────────────────────
const Seg = ({ value, options, onChange, label }) => (
  <div role="group" aria-label={label} className="grid gap-1 p-1 rounded-lg bg-black/40 border border-white/10" style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}>
    {options.map((o) => (
      <button
        key={o.value} onClick={() => onChange(o.value)} aria-pressed={value === o.value}
        className={`min-h-[40px] rounded-md text-sm font-semibold ${value === o.value ? 'text-[#05050f]' : 'text-neutral-400'}`}
        style={value === o.value ? { background: ACCENT } : undefined}
      >{o.label}</button>
    ))}
  </div>
);

const Row = ({ label, children }) => (
  <div className="mb-4">
    <div className="font-mono text-[10px] uppercase tracking-widest text-neutral-500 mb-1.5">{label}</div>
    {children}
  </div>
);

export function ControlsCard({ settings, patch, roiMode, onRoiMode, onGateChange, onClearRegion }) {
  return (
    <Card title="Settings">
      <Row label="Session or door name">
        <input className={inputCls} placeholder="Front door" value={settings.door} maxLength={60} onChange={(e) => patch({ door: e.target.value })} />
      </Row>
      <Row label="Counting method">
        <Seg label="Counting method" value={settings.gateMode} onChange={(v) => { patch({ gateMode: v }); onGateChange(); }}
          options={[{ value: 'one', label: 'One line' }, { value: 'two', label: 'Two-line gate' }]} />
        <p className="text-xs text-neutral-500 mt-1.5">
          {settings.gateMode === 'two'
            ? 'A count registers only when someone crosses both lines in order. The order gives the direction. Drag the diamond to change spacing.'
            : 'A count registers when someone crosses the line. Drag the dots to move or rotate it.'}
        </p>
        <button className={`${btn} mt-2 w-full`} onClick={() => { patch({ flip: !settings.flip }); onGateChange(); }}>Flip direction (IN is {settings.flip ? 'the other way' : 'the arrow side'})</button>
      </Row>
      <Row label="Model">
        <Seg label="Model" value={settings.model} onChange={(v) => patch({ model: v })}
          options={Object.values(MODELS).map((m) => ({ value: m.id, label: `${m.label} (${m.size}px)` }))} />
        <p className="text-xs text-neutral-500 mt-1.5">Lite0 is faster. Lite2 is larger and may find more people on a weak signal. Test both in the lab.</p>
      </Row>
      <Row label={`Detect every ${settings.n} frames`}>
        <input type="range" min="1" max="6" step="1" value={settings.n} onChange={(e) => patch({ n: +e.target.value })} className="w-full min-h-[44px]" />
        <p className="text-xs text-neutral-500">Lower catches fast walkers but uses more battery. The lab tests {INTERVALS.join(', ')}.</p>
      </Row>
      <Row label={`Confidence ${settings.conf.toFixed(2)}`}>
        <input type="range" min="0.2" max="0.9" step="0.05" value={settings.conf} onChange={(e) => patch({ conf: +e.target.value })} className="w-full min-h-[44px]" />
      </Row>
      <Row label="Detection region">
        <div className="grid grid-cols-2 gap-2">
          <button className={`${btn} ${roiMode ? '!border-amber-400 text-amber-300' : ''}`} onClick={() => onRoiMode(!roiMode)}>{roiMode ? 'Draw on video' : 'Set region'}</button>
          <button className={btn} onClick={onClearRegion} disabled={!settings.roi}>Clear region</button>
        </div>
        <p className="text-xs text-neutral-500 mt-1.5">{settings.roi ? 'Only this part of the picture is searched, which makes people larger to the detector.' : 'The whole picture is searched.'}</p>
      </Row>
      <Row label="Display mode shows">
        <Seg label="Display mode view" value={settings.displayView} onChange={(v) => patch({ displayView: v })}
          options={[{ value: 'privacy', label: 'Privacy view' }, { value: 'video', label: 'Live video' }]} />
        <p className="text-xs text-neutral-500 mt-1.5">
          {settings.displayView === 'privacy'
            ? 'A door-side screen shows dark silhouettes and the count. No identifiable video.'
            : 'Live video will be visible to anyone who can see the screen. Use only where that is acceptable.'}
        </p>
      </Row>
    </Card>
  );
}
