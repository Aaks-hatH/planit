import { useState, useMemo } from 'react';
import { ArrowUpDown, CheckCircle2 } from 'lucide-react';
import { MODELS } from '../utils/doorCountModel';
import { TOLERANCE_S } from '../utils/doorCountLab';
import { ACCENT } from '../utils/doorCountDraw';
import { Card, btnPrimary } from './DoorCountPanels';

const pct = (v) => (v == null ? '-' : `${Math.round(v * 100)}%`);
const ms = (v) => (v == null ? '-' : v.toFixed(1));
const signed = (v) => (v > 0 ? `+${v}` : `${v}`);

// Each column: how to read the value, and which direction is "better" for the first click.
const COLUMNS = [
  { key: 'label', label: 'Preset', get: (r) => r.preset.label, first: 'asc' },
  { key: 'tp', label: 'Matched / counted', get: (r) => r.tp, first: 'desc' },
  { key: 'precision', label: 'Precision', get: (r) => r.precision, first: 'desc', show: (r) => pct(r.precision) },
  { key: 'recall', label: 'Recall', get: (r) => r.recall, first: 'desc', show: (r) => pct(r.recall) },
  { key: 'netError', label: 'Net error', get: (r) => Math.abs(r.netError), first: 'asc', show: (r) => signed(r.netError) },
  { key: 'latMean', label: 'Latency mean (ms)', get: (r) => r.latMean, first: 'asc', show: (r) => ms(r.latMean) },
  { key: 'latP95', label: 'Latency p95 (ms)', get: (r) => r.latP95, first: 'asc', show: (r) => ms(r.latP95) },
  { key: 'inferAvg', label: 'Inference avg (ms)', get: (r) => r.inferAvg, first: 'asc', show: (r) => ms(r.inferAvg) },
];

/** result = { rows (ranked, best first), clip, delegates, base, taps, nIn, nOut } */
export default function DoorCountLabResults({ result, stale, onApply }) {
  const [sort, setSort] = useState(null); // { key, dir } or null = ranked order
  const best = result.rows[0];

  const rows = useMemo(() => {
    if (!sort) return result.rows;
    const col = COLUMNS.find((c) => c.key === sort.key);
    const sign = sort.dir === 'asc' ? 1 : -1;
    return [...result.rows].sort((a, b) => {
      const x = col.get(a), y = col.get(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1;   // missing values always last
      if (y == null) return -1;
      return (typeof x === 'string' ? x.localeCompare(y) : x - y) * sign;
    });
  }, [result.rows, sort]);

  const clickHeader = (c) => setSort((s) => (s?.key === c.key ? { key: c.key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: c.key, dir: c.first }));
  const { clip, base, delegates } = result;

  return (
    <Card title="Results, measured on your clip">
      {stale && <p role="status" className="text-sm text-amber-300 mb-3">The gate, confidence, region or labels changed after this run. Run again to measure the current setup.</p>}
      <p className="text-xs text-neutral-400 leading-relaxed mb-3">
        {Math.round(clip.seconds)} s clip at {clip.w}x{clip.h}, {result.taps} labeled crossings ({result.nIn} in, {result.nOut} out).
        A count matches a label if it is the same direction and within {TOLERANCE_S} s, one match each.
        Confidence {base.conf.toFixed(2)}, {base.roi ? 'region set' : 'whole picture'}.
        Ran on {Object.entries(delegates).map(([m, d]) => `${MODELS[m].label} ${d}`).join(', ')}.
      </p>
      {result.taps < 20 && (
        <p className="text-xs text-amber-300 mb-3">
          Only {result.taps} labeled crossings: one miss moves recall by about {Math.round(100 / result.taps)} points. Treat small differences between presets as noise, and label a longer clip to be sure.
        </p>
      )}

      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full text-sm font-mono tabular-nums min-w-[640px]">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-widest text-neutral-500">
              {COLUMNS.map((c) => (
                <th key={c.key} className="py-2 pr-3 font-normal">
                  <button onClick={() => clickHeader(c)} className="min-h-[44px] flex items-center gap-1 text-left" aria-label={`Sort by ${c.label}`}>
                    {c.label}<ArrowUpDown className={`w-3 h-3 ${sort?.key === c.key ? 'text-white' : 'opacity-40'}`} />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isBest = r === best;
              return (
                <tr key={r.preset.id} className="border-t border-white/10" style={isBest ? { background: `${ACCENT}1a` } : undefined}>
                  {COLUMNS.map((c) => (
                    <td key={c.key} className="py-2.5 pr-3 whitespace-nowrap">
                      {c.key === 'label' ? (
                        <span className="flex items-center gap-1.5 font-sans">
                          {isBest && <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: ACCENT }} aria-label="Best preset" />}
                          {r.preset.label}
                        </span>
                      ) : c.key === 'tp' ? `${r.tp} / ${r.counted}`
                        : (c.show ? c.show(r) : c.get(r))}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-xs text-neutral-500 space-y-1">
        <p>Precision: of the counts made, how many matched a label. Recall: of the labeled crossings, how many were counted. Net error: counted in minus out, minus labeled in minus out (negative means undercounting).</p>
        <p>Latency is crop, inference and tracking time from a frame being ready to the count registering. It excludes camera, display and the time a person takes to reach the line. Best is ranked by the F1 score (precision and recall together), then net error, then latency.</p>
      </div>

      <button className={`${btnPrimary} w-full mt-4`} style={{ background: ACCENT }} onClick={() => onApply(best.preset)}>
        Apply best settings: {best.preset.label}
      </button>
    </Card>
  );
}
