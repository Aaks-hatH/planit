/**
 * components/GuestSeatPicker.jsx
 *
 * Lightweight, read-only, clickable seating chart shown to guests during
 * RSVP checkout. Not the organizer's editor (see SeatingMap.jsx) — no auth,
 * no drag/drop, no zoom controls. Just: look at the floor plan, tap an open
 * table, done.
 *
 * Uses the same canvas conventions (1000x700 logical units) and per-type
 * default dimensions as SeatingMap.jsx so a chart built in the organizer
 * editor renders in the same proportions here.
 *
 * Props
 *   objects        seatingMap.objects[] (from GET /rsvp/:event/page)
 *   occupancy       { [tableId]: occupiedSeatCount }
 *   canvasW/canvasH logical canvas size
 *   requestedSeats  1 + plusOnes — how many seats this party needs
 *   selectedId      currently selected table id (or null)
 *   onSelect        (tableId | null) => void
 *   accent          hex accent color
 *   isLight         bg theme flag
 */

const TYPE_META = {
  round: { w: 80,  h: 80,  rx: 40 },
  rect:  { w: 120, h: 60,  rx: 6  },
  stage: { w: 180, h: 70,  rx: 6  },
  bar:   { w: 140, h: 50,  rx: 8  },
  sofa:  { w: 100, h: 50,  rx: 20 },
  vip:   { w: 90,  h: 90,  rx: 45 },
  zone:  { w: 200, h: 120, rx: 8  },
};

export default function GuestSeatPicker({
  objects = [],
  occupancy = {},
  canvasW = 1000,
  canvasH = 700,
  requestedSeats = 1,
  selectedId = null,
  onSelect,
  accent = '#6366f1',
  isLight = false,
}) {
  const seatable = objects.filter(o => o.type !== 'zone' && o.type !== 'stage');
  const backdrop = objects.filter(o => o.type === 'zone' || o.type === 'stage');

  const gridStroke = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';
  const textColor  = isLight ? '#111827' : '#fff';
  const mutedText  = isLight ? '#9ca3af' : 'rgba(255,255,255,0.4)';

  return (
    <div className="space-y-3">
      <div
        className="rounded-xl overflow-hidden border"
        style={{ borderColor: isLight ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.1)' }}
      >
        <svg viewBox={`0 0 ${canvasW} ${canvasH}`} className="w-full h-auto" style={{ background: isLight ? '#fafafa' : '#0d0d16', display: 'block' }}>
          {/* subtle grid */}
          {Array.from({ length: Math.ceil(canvasW / 50) }).map((_, i) => (
            <line key={`gx${i}`} x1={i * 50} y1={0} x2={i * 50} y2={canvasH} stroke={gridStroke} strokeWidth={1} />
          ))}
          {Array.from({ length: Math.ceil(canvasH / 50) }).map((_, i) => (
            <line key={`gy${i}`} x1={0} y1={i * 50} x2={canvasW} y2={i * 50} stroke={gridStroke} strokeWidth={1} />
          ))}

          {/* non-seatable backdrop: stage / zone labels */}
          {backdrop.map(obj => {
            const m = TYPE_META[obj.type] || TYPE_META.rect;
            const w = obj.width || m.w, h = obj.height || m.h;
            return (
              <g key={obj.id} transform={`translate(${obj.x},${obj.y}) rotate(${obj.rotation || 0})`}>
                <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={m.rx}
                  fill={isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)'}
                  stroke={isLight ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.12)'}
                  strokeDasharray={obj.type === 'zone' ? '4 4' : undefined}
                />
                <text textAnchor="middle" dy="0.35em" fontSize={13} fill={mutedText} fontWeight={600}>
                  {obj.label || (obj.type === 'stage' ? 'Stage' : '')}
                </text>
              </g>
            );
          })}

          {/* seatable tables */}
          {seatable.map(obj => {
            const m = TYPE_META[obj.type] || TYPE_META.round;
            const w = obj.width || m.w, h = obj.height || m.h;
            const occ = occupancy[obj.id] || 0;
            const cap = obj.capacity || 0;
            const remaining = cap > 0 ? cap - occ : Infinity;
            const full = cap > 0 && remaining < requestedSeats;
            const selected = obj.id === selectedId;
            const fill = selected ? accent : full ? (isLight ? '#e5e7eb' : 'rgba(255,255,255,0.06)') : (isLight ? '#fff' : 'rgba(255,255,255,0.08)');
            const stroke = selected ? accent : full ? (isLight ? '#d1d5db' : 'rgba(255,255,255,0.1)') : (isLight ? '#d1d5db' : 'rgba(255,255,255,0.25)');

            return (
              <g
                key={obj.id}
                transform={`translate(${obj.x},${obj.y}) rotate(${obj.rotation || 0})`}
                onClick={() => !full && onSelect?.(selected ? null : obj.id)}
                style={{ cursor: full ? 'not-allowed' : 'pointer' }}
              >
                {obj.type === 'round' || obj.type === 'vip' ? (
                  <circle r={w / 2} fill={fill} stroke={stroke} strokeWidth={selected ? 3 : 1.5} />
                ) : (
                  <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={m.rx} fill={fill} stroke={stroke} strokeWidth={selected ? 3 : 1.5} />
                )}
                <text textAnchor="middle" dy="-0.1em" fontSize={13} fontWeight={700}
                  fill={selected ? '#fff' : full ? mutedText : textColor}>
                  {obj.label || 'Table'}
                </text>
                {cap > 0 && (
                  <text textAnchor="middle" dy="1.2em" fontSize={11}
                    fill={selected ? 'rgba(255,255,255,0.85)' : mutedText}>
                    {full ? 'Full' : `${remaining} open`}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="flex items-center gap-4 text-xs" style={{ color: mutedText }}>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: accent }} /> Selected
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full inline-block border" style={{ borderColor: mutedText }} /> Open
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: mutedText, opacity: 0.4 }} /> Full
        </span>
      </div>
    </div>
  );
}
