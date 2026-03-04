/**
 * components/SeatingMap.jsx  — v3
 *
 * Visual Seating Chart — SVG editor + live display
 * =========================================================
 *
 * NEW in v3 (on top of v2)
 * ----------
 *  • Guest section open by default — no more hunting for the Guests accordion
 *  • Auto-save before assign — if map has unsaved changes, saves first so the
 *    backend tableId validation doesn't 400.  Shows "Saving…" state in PropsPanel.
 *  • Zone / label objects — drag-and-drop text labels for room sections
 *    (VIP Section, Dance Floor, Entrance, Bar Area, etc.)  Stored in the
 *    objects array as type "zone", rendered as a dashed region + large text.
 *    Backend validator updated separately to allow type "zone".
 *  • Export PNG — downloads a snapshot of the current map canvas
 *  • Table picker shows capacity/fill badge in display mode right panel
 *  • Seat position dots scaled to capacity (not just assigned count) so you
 *    can see empty seats as grey dots
 *  • Better empty state with quick-start hint
 *
 * Props (unchanged from v1/v2)
 *   mode          'editor' | 'display'
 *   objects       seatingMap.objects[]
 *   guestsByTable { [tableId]: [{ id, guestName, guestRole, checkedIn }] }
 *   allGuests     Invite[]
 *   onSave        (objects) => void
 *   focusTableId  string | null
 *   onClose       () => void
 *   isSaving      bool
 */

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  X, Plus, Trash2, Save, ZoomIn, ZoomOut, RotateCcw,
  ChevronDown, Grid3x3, Copy, Undo2, Redo2, Search,
  Download, Tag,
} from 'lucide-react';

const SNAP_PX   = 20;
const MIN_ZOOM  = 0.25;
const MAX_ZOOM  = 4.0;
const ZOOM_STEP = 0.25;
const CANVAS_W  = 1000;
const CANVAS_H  = 700;
const PULSE_MS  = 3000;
const MAX_UNDO  = 40;

const TYPE_META = {
  round: { w: 80,  h: 80,  rx: 40, label: 'Round' },
  rect:  { w: 120, h: 60,  rx: 6,  label: 'Rect'  },
  stage: { w: 180, h: 70,  rx: 6,  label: 'Stage' },
  bar:   { w: 140, h: 50,  rx: 8,  label: 'Bar'   },
  sofa:  { w: 100, h: 50,  rx: 20, label: 'Sofa'  },
  vip:   { w: 90,  h: 90,  rx: 45, label: 'VIP'   },
  zone:  { w: 200, h: 120, rx: 8,  label: 'Zone'  },  // text label / room section
};

const PALETTE = [null, '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'];

const snap  = v => Math.round(v / SNAP_PX) * SNAP_PX;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const uid   = () => `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

function defaultObj(type) {
  const m = TYPE_META[type] || TYPE_META.round;
  return { id: uid(), x: 500, y: 350, type, label: type === 'zone' ? 'Section' : '', rotation: 0, capacity: type === 'zone' ? 0 : 8, color: null, width: m.w, height: m.h };
}

function initials(name = '') {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (name[0] || '?').toUpperCase();
}

function seatPositions(obj, count) {
  const m = TYPE_META[obj.type] || TYPE_META.round;
  const r = Math.max(obj.width || m.w, obj.height || m.h) / 2 + 14;
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2 - Math.PI / 2;
    return { x: obj.x + r * Math.cos(a), y: obj.y + r * Math.sin(a) };
  });
}

// ---------------------------------------------------------------------------
// OccupancyArc
// ---------------------------------------------------------------------------
function OccupancyArc({ obj, assigned, capacity }) {
  if (!capacity || assigned === 0 || obj.type === 'zone') return null;
  const m   = TYPE_META[obj.type] || TYPE_META.round;
  const r   = Math.max(obj.width || m.w, obj.height || m.h) / 2 + 6;
  const pct = Math.min(assigned / capacity, 1);
  const over = assigned > capacity;
  const color = over ? '#f59e0b' : pct >= 1 ? '#10b981' : '#6366f1';

  if (pct >= 1) {
    return <circle cx={obj.x} cy={obj.y} r={r} fill="none" stroke={color} strokeWidth={3} strokeOpacity={0.7} />;
  }

  const a0 = -Math.PI / 2;
  const a1 = a0 + pct * Math.PI * 2;
  const x1 = obj.x + r * Math.cos(a0), y1 = obj.y + r * Math.sin(a0);
  const x2 = obj.x + r * Math.cos(a1), y2 = obj.y + r * Math.sin(a1);
  return (
    <path
      d={`M ${x1} ${y1} A ${r} ${r} 0 ${pct > 0.5 ? 1 : 0} 1 ${x2} ${y2}`}
      fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" strokeOpacity={0.8}
    />
  );
}

// ---------------------------------------------------------------------------
// LiveGuestDots — capacity-aware (shows empty seat slots as grey)
// ---------------------------------------------------------------------------
function LiveGuestDots({ obj, guests, capacity }) {
  if (obj.type === 'zone') return null;
  const total = Math.max(guests.length, Math.min(capacity || 0, 20)); // cap at 20 dots
  if (total === 0) return null;
  const positions = seatPositions(obj, total);
  return (
    <g>
      {Array.from({ length: total }, (_, i) => {
        const g = guests[i];
        const pos = positions[i];
        if (!pos) return null;
        return g ? (
          <g key={g.id || i}>
            <circle cx={pos.x} cy={pos.y} r={9}
              fill={g.checkedIn ? '#dcfce7' : '#f3f4f6'}
              stroke={g.checkedIn ? '#16a34a' : '#9ca3af'}
              strokeWidth={1.5}
              style={g.checkedIn ? { animation: 'guestPulse 2s ease-in-out infinite' } : undefined}
            />
            <text x={pos.x} y={pos.y + 1} textAnchor="middle" dominantBaseline="middle"
              fontSize={6} fontWeight="700" fill={g.checkedIn ? '#166534' : '#6b7280'}>
              {initials(g.guestName)}
            </text>
          </g>
        ) : (
          <circle key={`empty-${i}`} cx={pos.x} cy={pos.y} r={6}
            fill="#374151" stroke="#4b5563" strokeWidth={1} opacity={0.5} />
        );
      })}
    </g>
  );
}

// ---------------------------------------------------------------------------
// TableShape
// ---------------------------------------------------------------------------
function TableShape({ obj, selected, pulsing, guestCount, capacity, isEditor, isOverCapacity, onPointerDown, onClick }) {
  const isZone  = obj.type === 'zone';
  const m       = TYPE_META[obj.type] || TYPE_META.round;
  const w       = obj.width  || m.w;
  const h       = obj.height || m.h;
  const isRound = obj.type === 'round' || obj.type === 'vip';

  if (isZone) {
    const zoneColor = obj.color || '#6366f1';
    const fill = selected ? zoneColor + '33' : zoneColor + '18';
    const stroke = selected ? zoneColor : zoneColor + '88';
    return (
      <g transform={obj.rotation ? `rotate(${obj.rotation},${obj.x},${obj.y})` : undefined}
         style={{ cursor: isEditor ? 'grab' : 'default', userSelect: 'none' }}
         onPointerDown={isEditor ? e => { e.stopPropagation(); onPointerDown?.(e); } : undefined}
         onClick={e => { e.stopPropagation(); onClick?.(); }}>
        <rect x={obj.x - w/2} y={obj.y - h/2} width={w} height={h} rx={m.rx}
          fill={fill} stroke={stroke} strokeWidth={selected ? 2 : 1.5} strokeDasharray="6 4" />
        <text x={obj.x} y={obj.y} textAnchor="middle" dominantBaseline="middle"
          fontSize={16} fontWeight="700" fill={zoneColor} opacity={0.85} pointerEvents="none"
          style={{ userSelect: 'none' }}>
          {obj.label || 'Zone'}
        </text>
      </g>
    );
  }

  const baseFill = obj.color || '#e5e7eb';
  const fill    = pulsing ? '#dcfce7' : selected ? '#6366f1' : isOverCapacity ? '#fef3c7' : baseFill;
  const stroke  = pulsing ? '#16a34a' : selected ? '#4f46e5' : isOverCapacity ? '#f59e0b' : '#9ca3af';
  const strokeW = (selected || pulsing) ? 3 : 1.5;
  const tc      = selected ? '#ffffff' : '#374151';

  return (
    <g transform={obj.rotation ? `rotate(${obj.rotation},${obj.x},${obj.y})` : undefined}
       style={{ cursor: isEditor ? 'grab' : 'default', userSelect: 'none' }}
       onPointerDown={isEditor ? e => { e.stopPropagation(); onPointerDown?.(e); } : undefined}
       onClick={e => { e.stopPropagation(); onClick?.(); }}>
      {isRound
        ? <circle cx={obj.x} cy={obj.y} r={w/2} fill={fill} stroke={stroke} strokeWidth={strokeW}
            style={pulsing ? { animation: 'tablePulse 0.65s ease-in-out infinite alternate' } : undefined} />
        : <rect x={obj.x-w/2} y={obj.y-h/2} width={w} height={h} rx={m.rx} fill={fill} stroke={stroke} strokeWidth={strokeW}
            style={pulsing ? { animation: 'tablePulse 0.65s ease-in-out infinite alternate' } : undefined} />
      }
      {obj.label ? (
        <>
          <text x={obj.x} y={obj.y-4} textAnchor="middle" dominantBaseline="middle" fontSize={11} fontWeight="700" fill={tc} pointerEvents="none">{obj.label}</text>
          {guestCount > 0 && <text x={obj.x} y={obj.y+9} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill={tc} opacity={0.75} pointerEvents="none">{guestCount}{capacity ? `/${capacity}` : ''}</text>}
        </>
      ) : (
        <text x={obj.x} y={obj.y+1} textAnchor="middle" dominantBaseline="middle" fontSize={10} fontWeight="600" fill={tc} opacity={0.7} pointerEvents="none">
          {guestCount > 0 ? `${guestCount}${capacity ? `/${capacity}` : ''}` : m.label}
        </text>
      )}
    </g>
  );
}

// ---------------------------------------------------------------------------
// ResizeHandle
// ---------------------------------------------------------------------------
function ResizeHandle({ obj, onStartResize }) {
  const m = TYPE_META[obj.type] || TYPE_META.round;
  const w = obj.width || m.w, h = obj.height || m.h;
  const corners = [
    { cx: obj.x-w/2, cy: obj.y-h/2, dir: 'nw' },
    { cx: obj.x+w/2, cy: obj.y-h/2, dir: 'ne' },
    { cx: obj.x+w/2, cy: obj.y+h/2, dir: 'se' },
    { cx: obj.x-w/2, cy: obj.y+h/2, dir: 'sw' },
  ];
  return (
    <g>
      {corners.map(({ cx, cy, dir }) => (
        <circle key={dir} cx={cx} cy={cy} r={5} fill="#ffffff" stroke="#6366f1" strokeWidth={2}
          style={{ cursor: `${dir}-resize` }}
          onPointerDown={e => { e.stopPropagation(); onStartResize?.(e, dir); }} />
      ))}
    </g>
  );
}

// ---------------------------------------------------------------------------
// PropsPanel — guest section open by default
// ---------------------------------------------------------------------------
function PropsPanel({ obj, onChange, onDelete, onDuplicate, guestsByTable, allGuests, onAssignGuest, onUnassignGuest, isSavingForAssign }) {
  const [guestSearch, setGuestSearch] = useState('');
  const [showGuests,  setShowGuests]  = useState(true); // open by default

  if (!obj) return (
    <div className="p-4 text-center text-xs text-neutral-500 mt-6 space-y-2">
      <p>Click a table to edit its properties</p>
      <p className="text-neutral-600">or assign guests to it</p>
    </div>
  );

  const isZone   = obj.type === 'zone';
  const seated   = guestsByTable?.[obj.id] || [];
  const unseated = (allGuests || []).filter(g => !g.tableId && g.guestName.toLowerCase().includes(guestSearch.toLowerCase()));
  const isOver   = !isZone && seated.length > (obj.capacity || 0);
  const inp      = "w-full border border-neutral-700 rounded-lg px-3 py-2 text-sm bg-neutral-800 text-white focus:outline-none focus:border-neutral-500";

  return (
    <div className="p-4 space-y-4 overflow-y-auto flex-1">
      {/* Label */}
      <div>
        <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">
          {isZone ? 'Zone Label' : 'Table Label'}
        </label>
        <input value={obj.label} onChange={e => onChange({ ...obj, label: e.target.value })}
          placeholder={isZone ? 'VIP Section, Dance Floor…' : (TYPE_META[obj.type]?.label || 'Table')}
          maxLength={50} className={inp} />
      </div>

      {/* Type — hide for zones */}
      {!isZone && (
        <div>
          <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">Type</label>
          <div className="grid grid-cols-3 gap-1">
            {Object.entries(TYPE_META).filter(([t]) => t !== 'zone').map(([t, m]) => (
              <button key={t} onClick={() => onChange({ ...obj, type: t, width: m.w, height: m.h })}
                className={`px-2 py-1.5 rounded-lg border text-xs font-semibold transition-all ${obj.type === t ? 'bg-white text-neutral-900 border-white' : 'border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-white'}`}>
                {m.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Dimensions */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">W</label>
          <input type="number" min={30} max={400} step={10} value={obj.width || TYPE_META[obj.type]?.w || 80}
            onChange={e => onChange({ ...obj, width: parseInt(e.target.value) || 80 })}
            className="w-full border border-neutral-700 rounded-lg px-2 py-1.5 text-sm bg-neutral-800 text-white focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">H</label>
          <input type="number" min={30} max={400} step={10} value={obj.height || TYPE_META[obj.type]?.h || 80}
            onChange={e => onChange({ ...obj, height: parseInt(e.target.value) || 80 })}
            className="w-full border border-neutral-700 rounded-lg px-2 py-1.5 text-sm bg-neutral-800 text-white focus:outline-none" />
        </div>
      </div>

      {/* Capacity — tables only */}
      {!isZone && (
        <div>
          <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">
            Capacity {isOver && <span className="text-amber-400 normal-case font-normal"> — over by {seated.length - obj.capacity}!</span>}
          </label>
          <input type="number" min={1} max={999} value={obj.capacity}
            onChange={e => onChange({ ...obj, capacity: parseInt(e.target.value) || 1 })} className={inp} />
        </div>
      )}

      {/* Color */}
      <div>
        <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">Color</label>
        <div className="flex gap-1.5 flex-wrap">
          {PALETTE.map((c, i) => (
            <button key={i} onClick={() => onChange({ ...obj, color: c })}
              style={{ background: c || '#e5e7eb' }}
              className={`w-6 h-6 rounded-full border-2 transition-transform ${obj.color === c ? 'border-white scale-125' : 'border-transparent hover:scale-110'}`} />
          ))}
        </div>
      </div>

      {/* Rotation */}
      <div>
        <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">Rotation: {obj.rotation || 0}°</label>
        <input type="range" min={0} max={345} step={15} value={obj.rotation || 0}
          onChange={e => onChange({ ...obj, rotation: parseInt(e.target.value) })} className="w-full" />
      </div>

      {/* Guest assignment — tables only, open by default */}
      {!isZone && allGuests && (
        <div>
          <button onClick={() => setShowGuests(v => !v)}
            className="w-full flex items-center justify-between text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2 hover:text-white transition-colors">
            <span>Guests ({seated.length}{obj.capacity ? `/${obj.capacity}` : ''} seated){isOver ? ' ⚠' : ''}</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showGuests ? 'rotate-180' : ''}`} />
          </button>
          {showGuests && (
            <div className="space-y-2">
              {/* Currently seated */}
              {seated.length > 0 && (
                <div className="space-y-0.5">
                  {seated.filter(Boolean).map(g => (
                    <div key={g.id} className="flex items-center justify-between py-1 text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${g.checkedIn ? 'bg-emerald-400' : 'bg-neutral-600'}`} />
                        <span className="text-neutral-300 truncate max-w-[100px]">{g.guestName}</span>
                        {g.checkedIn && <span className="text-[10px] text-emerald-400 font-semibold">✓</span>}
                      </div>
                      <button onClick={() => onUnassignGuest?.(g.id)} className="text-red-400 hover:text-red-300 font-bold ml-2 shrink-0">✕</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Search & assign */}
              {isSavingForAssign ? (
                <p className="text-xs text-amber-400 text-center py-2">Saving map first…</p>
              ) : (
                <>
                  <input value={guestSearch} onChange={e => setGuestSearch(e.target.value)}
                    placeholder="Search unassigned guests…"
                    className="w-full border border-neutral-700 rounded-lg px-2.5 py-1.5 text-xs bg-neutral-800 text-white placeholder-neutral-500 focus:outline-none" />
                  <div className="max-h-36 overflow-y-auto border border-neutral-700 rounded-lg divide-y divide-neutral-800">
                    {unseated.length === 0
                      ? <p className="text-xs text-neutral-500 text-center py-3">
                          {(allGuests || []).length === 0 ? 'No guests in this event yet' : 'All guests assigned'}
                        </p>
                      : unseated.filter(Boolean).map(g => (
                        <button key={g._id}
                          onClick={() => onAssignGuest?.(g._id, obj.id, obj.label || TYPE_META[obj.type]?.label)}
                          className="w-full text-left px-2.5 py-2 text-xs font-medium text-neutral-300 hover:bg-neutral-800 hover:text-white transition-colors">
                          {g.guestName}
                        </button>
                      ))
                    }
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button onClick={() => onDuplicate?.(obj.id)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-neutral-300 bg-neutral-800 border border-neutral-700 rounded-lg hover:bg-neutral-700 transition-all">
          <Copy className="w-3 h-3" /> Duplicate
        </button>
        <button onClick={() => onDelete(obj.id)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-400 bg-red-900/20 border border-red-800/50 rounded-lg hover:bg-red-900/40 transition-all">
          <Trash2 className="w-3 h-3" /> Remove
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatsBar
// ---------------------------------------------------------------------------
function StatsBar({ objs, guestsByTable }) {
  const tables    = objs.filter(o => o.type !== 'zone');
  const totalCap  = tables.reduce((s, o) => s + (o.capacity || 0), 0);
  const totalAss  = Object.values(guestsByTable || {}).reduce((s, a) => s + a.length, 0);
  const totalIn   = Object.values(guestsByTable || {}).flat().filter(g => g?.checkedIn).length;
  const fillPct   = totalCap ? Math.round((totalAss / totalCap) * 100) : 0;
  return (
    <div className="px-4 py-2.5 border-b border-neutral-800 grid grid-cols-3 gap-2 text-center">
      {[
        ['Tables', tables.length, 'text-white'],
        [`Seated ${fillPct}%`, totalAss, totalAss > totalCap ? 'text-amber-400' : 'text-indigo-400'],
        ['Checked In', totalIn, 'text-emerald-400'],
      ].map(([label, val, cls]) => (
        <div key={label}>
          <p className="text-[10px] text-neutral-500 uppercase tracking-wide leading-tight">{label}</p>
          <p className={`text-sm font-bold ${cls}`}>{val}</p>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
export default function SeatingMap({
  mode         = 'display',
  objects      = [],
  guestsByTable = {},
  allGuests    = [],
  onSave,
  focusTableId = null,
  onClose,
  isSaving     = false,
}) {
  const isEditor = mode === 'editor';

  const [zoom,   setZoom]   = useState(1);
  const [pan,    setPan]    = useState({ x: 0, y: 0 });
  const [objs,   setObjs]   = useState(() => (objects || []).filter(Boolean));
  const [selected, setSelected] = useState(null);
  const [pulsing,  setPulsing]  = useState(null);
  const [showGrid, setShowGrid] = useState(true);
  const [isDirty,  setIsDirty]  = useState(false);
  const [search,   setSearch]   = useState('');
  const [isSavingForAssign, setIsSavingForAssign] = useState(false);

  const svgRef        = useRef(null);
  const dragRef       = useRef(null);
  const panRef        = useRef(null);
  const resizeRef     = useRef(null);
  const isPanningRef  = useRef(false);
  const undoStack     = useRef([]);
  const redoStack     = useRef([]);

  useEffect(() => {
    // Only sync from parent prop when we have no unsaved local changes.
    // This prevents a background re-fetch from wiping the user's in-progress edits.
    if (!isDirty) setObjs((objects || []).filter(Boolean));
  }, [objects]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Debounced auto-save ──────────────────────────────────────────────────
  // Saves 2 s after the last edit so changes are never lost if the editor
  // is closed or the page is navigated away from without hitting Save.
  const autoSaveTimer = useRef(null);
  useEffect(() => {
    if (!isDirty || !isEditor) return;
    clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      onSave?.(objs.filter(Boolean), { silent: true });
      setIsDirty(false);
    }, 2000);
    return () => clearTimeout(autoSaveTimer.current);
  }, [objs, isDirty, isEditor]); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus table
  useEffect(() => {
    if (!focusTableId) return;
    const obj = objs.find(o => o.id === focusTableId);
    if (!obj) return;
    const newZoom = Math.min(2.5, MAX_ZOOM);
    const vpW = svgRef.current?.parentElement?.clientWidth || 800;
    const vpH = svgRef.current?.parentElement?.clientHeight || 500;
    setZoom(newZoom);
    setPan({ x: vpW / 2 - obj.x * newZoom, y: vpH / 2 - obj.y * newZoom });
    setPulsing(focusTableId);
    setSelected(focusTableId);
    const t = setTimeout(() => setPulsing(null), PULSE_MS);
    return () => clearTimeout(t);
  }, [focusTableId]); // eslint-disable-line

  // Undo/Redo keyboard
  useEffect(() => {
    if (!isEditor) return;
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) { e.preventDefault(); doUndo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); doRedo(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isEditor]); // eslint-disable-line

  const pushUndo = (snapshot) => {
    undoStack.current.push(snapshot.filter(Boolean));
    if (undoStack.current.length > MAX_UNDO) undoStack.current.shift();
    redoStack.current = [];
  };
  const doUndo = () => {
    if (!undoStack.current.length) return;
    redoStack.current.push(objs.filter(Boolean).map(o => ({ ...o })));
    const prev = undoStack.current.pop();
    setObjs((prev || []).filter(Boolean)); setIsDirty(true);
  };
  const doRedo = () => {
    if (!redoStack.current.length) return;
    undoStack.current.push(objs.filter(Boolean).map(o => ({ ...o })));
    const next = redoStack.current.pop();
    setObjs((next || []).filter(Boolean)); setIsDirty(true);
  };

  const svgPoint = useCallback((clientX, clientY) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return { x: (clientX - rect.left - pan.x) / zoom, y: (clientY - rect.top - pan.y) / zoom };
  }, [pan, zoom]);

  // Wheel zoom
  const onWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
    const newZoom = clamp(zoom + delta, MIN_ZOOM, MAX_ZOOM);
    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();
    const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
    setZoom(newZoom);
    setPan({ x: cx - (cx - pan.x) * (newZoom / zoom), y: cy - (cy - pan.y) * (newZoom / zoom) });
  }, [zoom, pan]);
  useEffect(() => {
    const el = svgRef.current?.parentElement;
    if (!el) return;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onWheel]);

  const onSvgPointerDown = (e) => {
    if (e.target === svgRef.current || e.target.dataset?.bg) {
      setSelected(null);
      isPanningRef.current = true;
      panRef.current = { startX: e.clientX, startY: e.clientY, origPanX: pan.x, origPanY: pan.y };
      svgRef.current?.setPointerCapture(e.pointerId);
    }
  };

  const onSvgPointerMove = (e) => {
    if (isPanningRef.current && panRef.current) {
      setPan({ x: panRef.current.origPanX + e.clientX - panRef.current.startX, y: panRef.current.origPanY + e.clientY - panRef.current.startY });
    }
    // Snapshot the ref value NOW — before any async setState work —
    // so it can't be nulled by onSvgPointerUp while the updater is queued.
    const drag = dragRef.current;
    if (drag && isEditor) {
      const dragId = drag.id;
      if (dragId) {
        const pt = svgPoint(e.clientX, e.clientY);
        const nx = snap(clamp(pt.x, 0, CANVAS_W)), ny = snap(clamp(pt.y, 0, CANVAS_H));
        setObjs(prev => prev.filter(Boolean).map(o => o.id === dragId ? { ...o, x: nx, y: ny } : o));
      }
    }
    const resize = resizeRef.current;
    if (resize && isEditor) {
      const { id, dir, origW, origH, startPt } = resize;
      if (id) {
        const pt = svgPoint(e.clientX, e.clientY);
        const dx = pt.x - startPt.x, dy = pt.y - startPt.y;
        let newW = origW, newH = origH;
        if (dir.includes('e')) newW = Math.max(30, snap(origW + dx));
        if (dir.includes('w')) newW = Math.max(30, snap(origW - dx));
        if (dir.includes('s')) newH = Math.max(30, snap(origH + dy));
        if (dir.includes('n')) newH = Math.max(30, snap(origH - dy));
        setObjs(prev => prev.filter(Boolean).map(o => o.id === id ? { ...o, width: newW, height: newH } : o));
      }
    }
  };

  const onSvgPointerUp = () => {
    isPanningRef.current = false;
    panRef.current = null;
    if (dragRef.current) { dragRef.current = null; setIsDirty(true); }
    if (resizeRef.current) { resizeRef.current = null; setIsDirty(true); }
  };

  const startDrag = useCallback((e, id) => {
    if (!isEditor || !id) return;
    pushUndo(objs.filter(Boolean).map(o => ({ ...o })));
    dragRef.current = { id };
    setSelected(id);
    svgRef.current?.setPointerCapture(e.pointerId);
  }, [isEditor, objs]); // eslint-disable-line

  const startResize = useCallback((e, id, dir) => {
    if (!isEditor || !id) return;
    pushUndo(objs.filter(Boolean).map(o => ({ ...o })));
    const obj = objs.find(o => o && o.id === id);
    const m = TYPE_META[obj?.type] || TYPE_META.round;
    resizeRef.current = { id, dir, origW: obj?.width || m.w, origH: obj?.height || m.h, startPt: svgPoint(e.clientX, e.clientY) };
    svgRef.current?.setPointerCapture(e.pointerId);
  }, [isEditor, objs, svgPoint]);

  const addTable    = (type)  => { pushUndo(objs.filter(Boolean).map(o => ({ ...o }))); const obj = defaultObj(type); setObjs(p => [...p.filter(Boolean), obj]); setSelected(obj.id); setIsDirty(true); };
  const updateObj   = (upd)   => { setObjs(p => p.filter(Boolean).map(o => o.id === upd.id ? upd : o)); setIsDirty(true); };
  const deleteObj   = (id)    => { pushUndo(objs.filter(Boolean).map(o => ({ ...o }))); setObjs(p => p.filter(Boolean).filter(o => o.id !== id)); if (selected === id) setSelected(null); setIsDirty(true); };
  const duplicateObj = (id)   => { pushUndo(objs.filter(Boolean).map(o => ({ ...o }))); const src = objs.find(o => o && o.id === id); if (!src) return; const c = { ...src, id: uid(), x: snap(src.x + 40), y: snap(src.y + 40), label: src.label ? src.label + ' (2)' : '' }; setObjs(p => [...p.filter(Boolean), c]); setSelected(c.id); setIsDirty(true); };
  const handleSave  = ()      => { onSave?.(objs.filter(Boolean), { silent: false }); setIsDirty(false); };
  const resetView   = ()      => { setZoom(1); setPan({ x: 0, y: 0 }); };

  // Auto-save before assigning so backend tableId validation doesn't 400
  const onAssignGuest = async (inv, tbl, lbl) => {
    if (isDirty) {
      setIsSavingForAssign(true);
      onSave?.(objs.filter(Boolean), { silent: true });
      setIsDirty(false);
      // Brief delay so parent's async save can complete before the assign API call
      await new Promise(r => setTimeout(r, 600));
      setIsSavingForAssign(false);
    }
    window.dispatchEvent(new CustomEvent('seating:assignGuest', { detail: { inviteId: inv, tableId: tbl, tableLabel: lbl } }));
  };
  const onUnassignGuest = (inv) => window.dispatchEvent(new CustomEvent('seating:unassignGuest', { detail: { inviteId: inv } }));

  // Guest search → jump to table
  const handleSearch = (q) => {
    setSearch(q);
    if (!q.trim()) return;
    const ql = q.toLowerCase();
    for (const [tableId, guests] of Object.entries(guestsByTable)) {
      if (guests.find(g => g?.guestName?.toLowerCase().includes(ql))) {
        const obj = objs.find(o => o.id === tableId);
        if (obj) {
          const newZoom = Math.min(2.5, MAX_ZOOM);
          const vpW = svgRef.current?.parentElement?.clientWidth || 800;
          const vpH = svgRef.current?.parentElement?.clientHeight || 500;
          setZoom(newZoom);
          setPan({ x: vpW / 2 - obj.x * newZoom, y: vpH / 2 - obj.y * newZoom });
          setPulsing(tableId); setSelected(tableId);
          setTimeout(() => setPulsing(null), PULSE_MS);
          return;
        }
      }
    }
  };

  // Export canvas as PNG
  const exportPNG = () => {
    const svg = svgRef.current;
    if (!svg) return;
    // Render at canvas native resolution (ignore pan/zoom, render full map)
    const clone = svg.cloneNode(true);
    clone.setAttribute('width', CANVAS_W);
    clone.setAttribute('height', CANVAS_H);
    // Reset the transform group inside the clone
    const g = clone.querySelector('g');
    if (g) g.setAttribute('transform', '');
    const blob = new Blob([clone.outerHTML], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = CANVAS_W; canvas.height = CANVAS_H;
      canvas.getContext('2d').drawImage(img, 0, 0);
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = 'seating-map.png';
      a.click();
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const selectedObj = objs.find(o => o.id === selected) || null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-950">
      <style>{`
        @keyframes tablePulse { from { fill: #bbf7d0; } to { fill: #4ade80; } }
        @keyframes guestPulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
      `}</style>

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-900 border-b border-neutral-800 shrink-0 gap-3">
        <div className="flex items-center gap-3 shrink-0">
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
          <h2 className="text-sm font-bold text-white whitespace-nowrap">{isEditor ? 'Seating Editor' : 'Seating Map'}</h2>
          {isEditor && isDirty && <span className="text-xs text-amber-400 font-medium animate-pulse">● Auto-saving…</span>}
          {isEditor && !isDirty && isSaving && <span className="text-xs text-green-400 font-medium">✓ Saved</span>}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {/* Guest search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-500" />
            <input value={search} onChange={e => handleSearch(e.target.value)}
              placeholder="Find guest…"
              className="pl-6 pr-2 py-1 bg-neutral-800 border border-neutral-700 rounded-lg text-xs text-white placeholder-neutral-500 focus:outline-none w-28" />
          </div>

          <button onClick={() => setZoom(z => clamp(z - ZOOM_STEP, MIN_ZOOM, MAX_ZOOM))} className="p-1.5 rounded-lg bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"><ZoomOut className="w-3.5 h-3.5" /></button>
          <span className="text-xs text-neutral-400 font-mono w-9 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => clamp(z + ZOOM_STEP, MIN_ZOOM, MAX_ZOOM))} className="p-1.5 rounded-lg bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"><ZoomIn className="w-3.5 h-3.5" /></button>
          <button onClick={resetView} className="p-1.5 rounded-lg bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors" title="Reset view"><RotateCcw className="w-3.5 h-3.5" /></button>

          {/* Export */}
          <button onClick={exportPNG} className="p-1.5 rounded-lg bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors" title="Export PNG"><Download className="w-3.5 h-3.5" /></button>

          {isEditor && (<>
            <button onClick={doUndo} disabled={undoStack.current.length === 0} className="p-1.5 rounded-lg bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors disabled:opacity-30" title="Undo (Ctrl+Z)"><Undo2 className="w-3.5 h-3.5" /></button>
            <button onClick={doRedo} disabled={redoStack.current.length === 0} className="p-1.5 rounded-lg bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors disabled:opacity-30" title="Redo (Ctrl+Y)"><Redo2 className="w-3.5 h-3.5" /></button>
            <button onClick={() => setShowGrid(v => !v)} className={`p-1.5 rounded-lg transition-colors ${showGrid ? 'bg-neutral-600 text-white' : 'bg-neutral-800 text-neutral-400 hover:text-white'}`} title="Toggle grid"><Grid3x3 className="w-3.5 h-3.5" /></button>

            {/* Table type buttons */}
            {Object.entries(TYPE_META).filter(([t]) => t !== 'zone').map(([t, m]) => (
              <button key={t} onClick={() => addTable(t)} className="flex items-center gap-1 px-2 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs font-medium rounded-lg transition-colors">
                <Plus className="w-3 h-3" />{m.label}
              </button>
            ))}
            {/* Zone / label button */}
            <button onClick={() => addTable('zone')} className="flex items-center gap-1 px-2 py-1.5 bg-indigo-900/50 hover:bg-indigo-900 border border-indigo-700/50 text-indigo-300 hover:text-white text-xs font-medium rounded-lg transition-colors" title="Add a text zone label (VIP, Dance Floor, etc.)">
              <Tag className="w-3 h-3" /> Zone
            </button>

            <button onClick={handleSave} disabled={!isDirty || isSaving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg disabled:opacity-40 transition-all">
              <Save className="w-3.5 h-3.5" />{isSaving ? 'Saving…' : 'Save Map'}
            </button>
          </>)}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Canvas */}
        <div className="flex-1 overflow-hidden relative bg-neutral-900">
          <svg ref={svgRef} width="100%" height="100%"
            onPointerDown={onSvgPointerDown} onPointerMove={onSvgPointerMove}
            onPointerUp={onSvgPointerUp} onPointerCancel={onSvgPointerUp}
            style={{ touchAction: 'none' }}>
            <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
              <rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="#1a1a1a" rx={4} data-bg="1" />

              {isEditor && showGrid && (
                <g opacity={0.12}>
                  {Array.from({ length: Math.ceil(CANVAS_W / SNAP_PX) }, (_, i) => <line key={`v${i}`} x1={i * SNAP_PX} y1={0} x2={i * SNAP_PX} y2={CANVAS_H} stroke="#6b7280" strokeWidth={0.5} />)}
                  {Array.from({ length: Math.ceil(CANVAS_H / SNAP_PX) }, (_, i) => <line key={`h${i}`} x1={0} y1={i * SNAP_PX} x2={CANVAS_W} y2={i * SNAP_PX} stroke="#6b7280" strokeWidth={0.5} />)}
                </g>
              )}

              <rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="none" stroke="#374151" strokeWidth={1.5} rx={4} />
              <text x={8} y={20} fontSize={11} fill="#4b5563" fontWeight="500">Venue Floor Plan</text>

              {/* Render zone objects behind tables */}
              {objs.filter(o => o?.type === 'zone').map(obj => (
                <g key={obj.id}>
                  <TableShape obj={obj} selected={selected === obj.id} pulsing={false}
                    guestCount={0} capacity={0} isEditor={isEditor} isOverCapacity={false}
                    onPointerDown={e => startDrag(e, obj.id)} onClick={() => setSelected(obj.id === selected ? null : obj.id)} />
                  {isEditor && selected === obj.id && <ResizeHandle obj={obj} onStartResize={(e, dir) => startResize(e, obj.id, dir)} />}
                </g>
              ))}

              {/* Render table objects on top */}
              {objs.filter(o => o && o.type !== 'zone').map(obj => {
                const guests = guestsByTable[obj.id] || [];
                const isOver = guests.length > (obj.capacity || Infinity);
                return (
                  <g key={obj.id}>
                    <OccupancyArc obj={obj} assigned={guests.length} capacity={obj.capacity || 0} />
                    {!isEditor && <LiveGuestDots obj={obj} guests={guests} capacity={obj.capacity || 0} />}
                    <TableShape obj={obj} selected={selected === obj.id} pulsing={pulsing === obj.id}
                      guestCount={guests.length} capacity={obj.capacity} isEditor={isEditor} isOverCapacity={isOver}
                      onPointerDown={e => startDrag(e, obj.id)} onClick={() => setSelected(obj.id === selected ? null : obj.id)} />
                    {isEditor && selected === obj.id && <ResizeHandle obj={obj} onStartResize={(e, dir) => startResize(e, obj.id, dir)} />}
                  </g>
                );
              })}

              {objs.filter(o => o?.type !== 'zone').length === 0 && isEditor && (
                <g>
                  <text x={CANVAS_W / 2} y={CANVAS_H / 2 - 14} textAnchor="middle" dominantBaseline="middle" fontSize={14} fill="#4b5563" fontWeight="500">
                    Use the toolbar to add tables
                  </text>
                  <text x={CANVAS_W / 2} y={CANVAS_H / 2 + 10} textAnchor="middle" dominantBaseline="middle" fontSize={11} fill="#374151">
                    Round · Rect · Stage · Bar · Sofa · VIP  →  then "Save Map"  →  assign guests
                  </text>
                </g>
              )}
            </g>
          </svg>
          <p className="absolute bottom-3 left-3 text-xs text-neutral-600 pointer-events-none select-none">
            Scroll to zoom · Drag background to pan{isEditor ? ' · Drag tables to move · Corners to resize' : ''}
          </p>
        </div>

        {/* ── Editor right panel ── */}
        {isEditor && (
          <div className="w-64 bg-neutral-900 border-l border-neutral-800 flex flex-col overflow-hidden shrink-0">
            <StatsBar objs={objs} guestsByTable={guestsByTable} />
            <div className="px-4 py-2.5 border-b border-neutral-800">
              <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Table Properties</p>
            </div>
            <PropsPanel obj={selectedObj} onChange={updateObj} onDelete={deleteObj} onDuplicate={duplicateObj}
              guestsByTable={guestsByTable} allGuests={allGuests}
              onAssignGuest={onAssignGuest} onUnassignGuest={onUnassignGuest}
              isSavingForAssign={isSavingForAssign} />
            <div className="px-4 py-3 border-t border-neutral-800 shrink-0 space-y-1.5">
              <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Legend</p>
              {[
                ['bg-indigo-500', 'Partially filled'],
                ['bg-emerald-500', 'Fully seated'],
                ['bg-amber-400', 'Over capacity'],
                ['bg-green-300', 'Just arrived'],
              ].map(([bg, label]) => (
                <div key={label} className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${bg} inline-block`} />
                  <span className="text-xs text-neutral-400">{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Display right panel ── */}
        {!isEditor && selected && (
          <div className="w-64 bg-neutral-900 border-l border-neutral-800 flex flex-col overflow-hidden shrink-0">
            <div className="px-4 py-3 border-b border-neutral-800 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">{objs.find(o => o.id === selected)?.label || 'Table'}</p>
                {objs.find(o => o.id === selected)?.type !== 'zone' && (
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {(guestsByTable[selected] || []).filter(g => g?.checkedIn).length} / {(guestsByTable[selected] || []).length} checked in
                    {objs.find(o => o.id === selected)?.capacity ? ` · ${objs.find(o => o.id === selected).capacity} seats` : ''}
                  </p>
                )}
              </div>
              <button onClick={() => setSelected(null)} className="text-neutral-600 hover:text-white transition-colors"><X className="w-3.5 h-3.5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-0.5">
              {!(guestsByTable[selected] || []).length
                ? <p className="text-xs text-neutral-500 text-center py-6">No guests assigned to this table</p>
                : (guestsByTable[selected] || []).filter(Boolean).map(g => (
                  <div key={g.id} className="flex items-center gap-2.5 py-2 border-b border-neutral-800/50 last:border-0">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${g.checkedIn ? 'bg-emerald-900 text-emerald-300' : 'bg-neutral-800 text-neutral-400'}`}>
                      {initials(g.guestName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-neutral-200 truncate">{g.guestName}</p>
                      <p className={`text-[10px] font-semibold ${g.checkedIn ? 'text-emerald-400' : 'text-neutral-600'}`}>{g.checkedIn ? 'Checked in' : 'Not arrived'}</p>
                    </div>
                    {g.checkedIn && <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" style={{ animation: 'guestPulse 2s ease-in-out infinite' }} />}
                  </div>
                ))
              }
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
