/**
 * components/SeatingMap.jsx
 *
 * Visual Seating Chart — SVG editor and read-only display
 * ========================================================
 *
 * This single component handles both the organiser's drag-and-drop editor
 * and the staff-facing read-only map that highlights a guest's table.
 *
 * Props
 * -----
 *   mode          'editor' | 'display'  (default: 'display')
 *   objects       seatingMap.objects[]  — current table layout
 *   guestsByTable { [tableId]: [{ id, guestName, guestRole, checkedIn }] }
 *   allGuests     Invite[] — full guest list (editor mode only)
 *   onSave        (objects) => void  — called when organiser saves (editor)
 *   focusTableId  string | null  — snap map to this table and pulse it green
 *   onClose       () => void
 *   canvasW       number  (default 1000)
 *   canvasH       number  (default 700)
 *   isSaving      bool
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  X, Plus, Trash2, Save, ZoomIn, ZoomOut, RotateCcw,
  ChevronDown, Users, Grid3x3,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const SNAP_PX     = 20;   // grid snap in logical units
const MIN_ZOOM    = 0.25;
const MAX_ZOOM    = 4.0;
const ZOOM_STEP   = 0.25;
const CANVAS_W    = 1000;
const CANVAS_H    = 700;
const PULSE_MS    = 3000; // how long to pulse the focused table

// Table-type visual defaults
const TYPE_META = {
  round: { w: 80,  h: 80,  rx: 40,  label: 'Round'  },
  rect:  { w: 100, h: 60,  rx: 6,   label: 'Rect'   },
  stage: { w: 160, h: 60,  rx: 6,   label: 'Stage'  },
  bar:   { w: 120, h: 50,  rx: 8,   label: 'Bar'    },
};

const PALETTE = [null, '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const snap  = v => Math.round(v / SNAP_PX) * SNAP_PX;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const uid   = () => `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

function defaultObj(type) {
  const m = TYPE_META[type] || TYPE_META.round;
  return { id: uid(), x: 500, y: 350, type, label: '', rotation: 0, capacity: 8, color: null, width: m.w, height: m.h };
}

// ---------------------------------------------------------------------------
// Single table SVG element
// ---------------------------------------------------------------------------
function TableShape({ obj, selected, pulsing, guestCount, isEditor, onPointerDown, onClick }) {
  const m    = TYPE_META[obj.type] || TYPE_META.round;
  const w    = obj.width  || m.w;
  const h    = obj.height || m.h;
  const isRound = obj.type === 'round';

  const baseFill   = obj.color  || '#e5e7eb';
  const fill       = pulsing   ? '#dcfce7' : selected ? '#6366f1' : baseFill;
  const stroke     = pulsing   ? '#16a34a' : selected ? '#4f46e5' : '#9ca3af';
  const strokeW    = (selected || pulsing) ? 3 : 1.5;
  const textColor  = selected  ? '#ffffff' : '#374151';

  return (
    <g
      transform={obj.rotation ? `rotate(${obj.rotation},${obj.x},${obj.y})` : undefined}
      style={{ cursor: isEditor ? 'grab' : 'default', userSelect: 'none' }}
      onPointerDown={isEditor ? e => { e.stopPropagation(); onPointerDown?.(e); } : undefined}
      onClick={e => { e.stopPropagation(); onClick?.(); }}
    >
      {isRound ? (
        <circle
          cx={obj.x} cy={obj.y} r={w / 2}
          fill={fill} stroke={stroke} strokeWidth={strokeW}
          style={pulsing ? { animation: 'tablePulse 0.65s ease-in-out infinite alternate' } : undefined}
        />
      ) : (
        <rect
          x={obj.x - w / 2} y={obj.y - h / 2} width={w} height={h}
          rx={m.rx}
          fill={fill} stroke={stroke} strokeWidth={strokeW}
          style={pulsing ? { animation: 'tablePulse 0.65s ease-in-out infinite alternate' } : undefined}
        />
      )}

      {/* Label text */}
      <text
        x={obj.x} y={obj.y}
        textAnchor="middle" dominantBaseline="middle"
        fontSize={13} fontWeight="600"
        fill={textColor} pointerEvents="none"
        style={{ userSelect: 'none' }}
      >
        {obj.label || m.label}
      </text>

      {/* Guest count badge */}
      {guestCount > 0 && (
        <>
          <circle
            cx={obj.x + w / 2 - 8} cy={obj.y - (isRound ? w / 2 : h / 2) + 8}
            r={11}
            fill="#10b981" stroke="#fff" strokeWidth={1.5}
          />
          <text
            x={obj.x + w / 2 - 8} y={obj.y - (isRound ? w / 2 : h / 2) + 8}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={9} fontWeight="700" fill="#fff"
            pointerEvents="none"
          >
            {guestCount > 99 ? '99+' : guestCount}
          </text>
        </>
      )}

      {/* Pulse ring */}
      {pulsing && (
        <circle
          cx={obj.x} cy={obj.y}
          r={(w / 2) + 14}
          fill="none" stroke="#16a34a" strokeWidth={2.5}
          style={{ animation: 'pulseRing 1s ease-out infinite', opacity: 0.5 }}
        />
      )}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Properties panel (editor only)
// ---------------------------------------------------------------------------
function PropsPanel({ obj, onChange, onDelete, guestsByTable, allGuests, onAssignGuest, onUnassignGuest }) {
  const [guestSearch, setGuestSearch] = useState('');
  const [showGuests, setShowGuests]   = useState(false);

  if (!obj) {
    return (
      <div className="p-4 text-center text-xs text-neutral-400 mt-4">
        Click a table to edit its properties
      </div>
    );
  }

  const seated   = guestsByTable?.[obj.id] || [];
  const unseated = (allGuests || []).filter(g =>
    !g.tableId &&
    g.guestName.toLowerCase().includes(guestSearch.toLowerCase())
  );

  return (
    <div className="p-4 space-y-4 overflow-y-auto flex-1">
      {/* Label */}
      <div>
        <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">Label</label>
        <input
          value={obj.label}
          onChange={e => onChange({ ...obj, label: e.target.value })}
          placeholder={TYPE_META[obj.type]?.label || 'Table'}
          maxLength={50}
          className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-neutral-400"
        />
      </div>

      {/* Type */}
      <div>
        <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">Type</label>
        <div className="grid grid-cols-2 gap-1.5">
          {Object.entries(TYPE_META).map(([t, m]) => (
            <button
              key={t}
              onClick={() => onChange({ ...obj, type: t, width: m.w, height: m.h })}
              className={`px-2 py-1.5 rounded-lg border text-xs font-semibold transition-all
                ${obj.type === t
                  ? 'bg-neutral-900 text-white border-neutral-900'
                  : 'border-neutral-200 text-neutral-600 hover:border-neutral-400'
                }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Capacity */}
      <div>
        <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">Capacity</label>
        <input
          type="number" min={1} max={999}
          value={obj.capacity}
          onChange={e => onChange({ ...obj, capacity: parseInt(e.target.value) || 1 })}
          className="w-full border border-neutral-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
        />
      </div>

      {/* Color */}
      <div>
        <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">Color</label>
        <div className="flex gap-2 flex-wrap">
          {PALETTE.map((c, i) => (
            <button
              key={i}
              onClick={() => onChange({ ...obj, color: c })}
              style={{ background: c || '#e5e7eb' }}
              className={`w-6 h-6 rounded-full border-2 transition-transform
                ${obj.color === c ? 'border-neutral-700 scale-125' : 'border-transparent hover:scale-110'}`}
            />
          ))}
        </div>
      </div>

      {/* Rotation */}
      <div>
        <label className="block text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">
          Rotation: {obj.rotation || 0}°
        </label>
        <input
          type="range" min={0} max={345} step={15}
          value={obj.rotation || 0}
          onChange={e => onChange({ ...obj, rotation: parseInt(e.target.value) })}
          className="w-full"
        />
      </div>

      {/* Guest assignment */}
      {allGuests && (
        <div>
          <button
            onClick={() => setShowGuests(v => !v)}
            className="w-full flex items-center justify-between text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2"
          >
            <span>Guests ({seated.length} seated)</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showGuests ? 'rotate-180' : ''}`} />
          </button>

          {showGuests && (
            <div className="space-y-2">
              {/* Seated */}
              {seated.length > 0 && (
                <div className="space-y-1">
                  {seated.map(g => (
                    <div key={g.id} className="flex items-center justify-between py-1 text-xs">
                      <span className="text-neutral-700 font-medium truncate">{g.guestName}</span>
                      <button
                        onClick={() => onUnassignGuest?.(g.id)}
                        className="text-red-500 hover:text-red-700 font-semibold ml-2 shrink-0"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Search & assign */}
              <input
                value={guestSearch}
                onChange={e => setGuestSearch(e.target.value)}
                placeholder="Search unassigned guests..."
                className="w-full border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none"
              />
              <div className="max-h-32 overflow-y-auto border border-neutral-100 rounded-lg divide-y divide-neutral-50">
                {unseated.length === 0 ? (
                  <p className="text-xs text-neutral-400 text-center py-3">No unassigned guests</p>
                ) : (
                  unseated.map(g => (
                    <button
                      key={g._id}
                      onClick={() => onAssignGuest?.(g._id, obj.id, obj.label || TYPE_META[obj.type]?.label)}
                      className="w-full text-left px-2.5 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                    >
                      {g.guestName}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Delete */}
      <button
        onClick={() => onDelete(obj.id)}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-all"
      >
        <Trash2 className="w-3.5 h-3.5" />
        Remove table
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function SeatingMap({
  mode         = 'display',
  objects      = [],
  guestsByTable = {},
  allGuests    = [],
  onSave,
  focusTableId = null,
  onClose,
  canvasW      = CANVAS_W,
  canvasH      = CANVAS_H,
  isSaving     = false,
}) {
  const isEditor = mode === 'editor';

  // Pan/zoom state
  const [zoom,   setZoom]   = useState(1);
  const [pan,    setPan]    = useState({ x: 0, y: 0 });

  // Editor state
  const [objs,       setObjs]       = useState(objects);
  const [selected,   setSelected]   = useState(null);   // table id
  const [pulsing,    setPulsing]     = useState(null);   // table id
  const [showGrid,   setShowGrid]    = useState(true);
  const [isDirty,    setIsDirty]     = useState(false);

  // Internal refs for drag logic
  const svgRef        = useRef(null);
  const dragRef       = useRef(null);  // { id, startX, startY, origX, origY }
  const panRef        = useRef(null);  // { startX, startY, origPanX, origPanY }
  const isPanningRef  = useRef(false);

  // Sync external objects into local state
  useEffect(() => {
    setObjs(objects);
  }, [objects]);

  // Auto-focus on focusTableId
  useEffect(() => {
    if (!focusTableId) return;

    const obj = objs.find(o => o.id === focusTableId);
    if (!obj) return;

    // Compute zoom and pan so the table fills the viewport centred
    const newZoom = Math.min(2.5, MAX_ZOOM);
    const vpW = svgRef.current?.parentElement?.clientWidth  || 800;
    const vpH = svgRef.current?.parentElement?.clientHeight || 500;

    const newPanX = vpW / 2 - obj.x * newZoom;
    const newPanY = vpH / 2 - obj.y * newZoom;

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
    setPulsing(focusTableId);

    const timer = setTimeout(() => setPulsing(null), PULSE_MS);
    return () => clearTimeout(timer);
  }, [focusTableId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // SVG coordinate helpers
  // ---------------------------------------------------------------------------
  const svgPoint = useCallback((clientX, clientY) => {
    const svg  = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top  - pan.y) / zoom,
    };
  }, [pan, zoom]);

  // ---------------------------------------------------------------------------
  // Wheel — zoom around cursor
  // ---------------------------------------------------------------------------
  const onWheel = useCallback((e) => {
    e.preventDefault();
    const delta   = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
    const newZoom = clamp(zoom + delta, MIN_ZOOM, MAX_ZOOM);

    const svg  = svgRef.current;
    const rect = svg.getBoundingClientRect();
    const cx   = e.clientX - rect.left;
    const cy   = e.clientY - rect.top;

    // Keep the canvas point under cursor fixed
    const newPanX = cx - (cx - pan.x) * (newZoom / zoom);
    const newPanY = cy - (cy - pan.y) * (newZoom / zoom);

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  }, [zoom, pan]);

  useEffect(() => {
    const el = svgRef.current?.parentElement;
    if (!el) return;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onWheel]);

  // ---------------------------------------------------------------------------
  // Pointer events — pan canvas (middle-click or empty-area drag) and drag tables
  // ---------------------------------------------------------------------------
  const onSvgPointerDown = (e) => {
    if (e.target === svgRef.current || e.target.tagName === 'svg' || e.target.tagName === 'rect' && e.target.dataset.bg) {
      setSelected(null);
      if (e.button === 0 || e.pointerType === 'touch') {
        isPanningRef.current = true;
        panRef.current = {
          startX: e.clientX, startY: e.clientY,
          origPanX: pan.x,   origPanY: pan.y,
        };
        svgRef.current?.setPointerCapture(e.pointerId);
      }
    }
  };

  const onSvgPointerMove = (e) => {
    if (isPanningRef.current && panRef.current) {
      const dx = e.clientX - panRef.current.startX;
      const dy = e.clientY - panRef.current.startY;
      setPan({ x: panRef.current.origPanX + dx, y: panRef.current.origPanY + dy });
    }

    if (dragRef.current && isEditor) {
      const pt = svgPoint(e.clientX, e.clientY);
      const nx = snap(clamp(pt.x, 0, canvasW));
      const ny = snap(clamp(pt.y, 0, canvasH));

      setObjs(prev => prev.map(o =>
        o.id === dragRef.current.id ? { ...o, x: nx, y: ny } : o
      ));
    }
  };

  const onSvgPointerUp = () => {
    isPanningRef.current = false;
    panRef.current       = null;
    if (dragRef.current) {
      dragRef.current = null;
      setIsDirty(true);
    }
  };

  const startDrag = useCallback((e, id) => {
    if (!isEditor) return;
    dragRef.current = { id };
    setSelected(id);
    svgRef.current?.setPointerCapture(e.pointerId);
  }, [isEditor]);

  // ---------------------------------------------------------------------------
  // Toolbar actions
  // ---------------------------------------------------------------------------
  const addTable = (type) => {
    const obj = defaultObj(type);
    setObjs(prev => [...prev, obj]);
    setSelected(obj.id);
    setIsDirty(true);
  };

  const updateObj = (updated) => {
    setObjs(prev => prev.map(o => o.id === updated.id ? updated : o));
    setIsDirty(true);
  };

  const deleteObj = (id) => {
    setObjs(prev => prev.filter(o => o.id !== id));
    if (selected === id) setSelected(null);
    setIsDirty(true);
  };

  const handleSave = () => {
    onSave?.(objs);
    setIsDirty(false);
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // ---------------------------------------------------------------------------
  // Guest assignment helpers (editor mode)
  // ---------------------------------------------------------------------------
  const onAssignGuest = (inviteId, tableId, tableLabel) => {
    // Optimistically update local allGuests display — parent handles the API call
    // by responding to the 'assignGuest' event propagated via onSave
    // For now we store the assignment in a side-channel via a custom event
    window.dispatchEvent(new CustomEvent('seating:assignGuest', { detail: { inviteId, tableId, tableLabel } }));
  };

  const onUnassignGuest = (inviteId) => {
    window.dispatchEvent(new CustomEvent('seating:unassignGuest', { detail: { inviteId } }));
  };

  const selectedObj = objs.find(o => o.id === selected) || null;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-950">

      {/* Keyframe styles */}
      <style>{`
        @keyframes tablePulse {
          from { fill: #bbf7d0; }
          to   { fill: #4ade80; }
        }
        @keyframes pulseRing {
          0%   { r: 50px; opacity: 0.6; }
          100% { r: 80px; opacity: 0;   }
        }
      `}</style>

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 bg-neutral-900 border-b border-neutral-800 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
          <h2 className="text-sm font-bold text-white">
            {isEditor ? 'Seating Chart Editor' : 'Seating Map'}
          </h2>
          {isEditor && isDirty && (
            <span className="text-xs text-amber-400 font-medium">Unsaved changes</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <button
            onClick={() => setZoom(z => clamp(z - ZOOM_STEP, MIN_ZOOM, MAX_ZOOM))}
            className="p-1.5 rounded-lg bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs text-neutral-400 font-mono w-10 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom(z => clamp(z + ZOOM_STEP, MIN_ZOOM, MAX_ZOOM))}
            className="p-1.5 rounded-lg bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={resetView}
            className="p-1.5 rounded-lg bg-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-700 transition-colors"
            title="Reset view"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {isEditor && (
            <>
              <button
                onClick={() => setShowGrid(v => !v)}
                className={`p-1.5 rounded-lg transition-colors ${showGrid ? 'bg-neutral-600 text-white' : 'bg-neutral-800 text-neutral-400 hover:text-white'}`}
                title="Toggle grid"
              >
                <Grid3x3 className="w-3.5 h-3.5" />
              </button>

              {/* Add table buttons */}
              {Object.entries(TYPE_META).map(([t, m]) => (
                <button
                  key={t}
                  onClick={() => addTable(t)}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs font-medium rounded-lg transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  {m.label}
                </button>
              ))}

              <button
                onClick={handleSave}
                disabled={!isDirty || isSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg disabled:opacity-40 transition-all"
              >
                <Save className="w-3.5 h-3.5" />
                {isSaving ? 'Saving...' : 'Save Map'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* SVG canvas */}
        <div className="flex-1 overflow-hidden relative bg-neutral-900">
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            onPointerDown={onSvgPointerDown}
            onPointerMove={onSvgPointerMove}
            onPointerUp={onSvgPointerUp}
            onPointerCancel={onSvgPointerUp}
            style={{ touchAction: 'none', cursor: isPanningRef.current ? 'grabbing' : 'default' }}
          >
            <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>

              {/* Canvas background */}
              <rect
                x={0} y={0}
                width={canvasW} height={canvasH}
                fill="#1a1a1a" rx={4}
                data-bg="1"
              />

              {/* Grid (editor only) */}
              {isEditor && showGrid && (
                <g opacity={0.15}>
                  {Array.from({ length: Math.ceil(canvasW / SNAP_PX) }, (_, i) => (
                    <line key={`v${i}`} x1={i * SNAP_PX} y1={0} x2={i * SNAP_PX} y2={canvasH} stroke="#6b7280" strokeWidth={0.5} />
                  ))}
                  {Array.from({ length: Math.ceil(canvasH / SNAP_PX) }, (_, i) => (
                    <line key={`h${i}`} x1={0} y1={i * SNAP_PX} x2={canvasW} y2={i * SNAP_PX} stroke="#6b7280" strokeWidth={0.5} />
                  ))}
                </g>
              )}

              {/* Canvas border */}
              <rect
                x={0} y={0} width={canvasW} height={canvasH}
                fill="none" stroke="#374151" strokeWidth={1.5} rx={4}
              />

              {/* Floor label */}
              <text x={8} y={20} fontSize={11} fill="#4b5563" fontWeight="500">
                Venue Floor Plan
              </text>

              {/* Tables */}
              {objs.map(obj => (
                <TableShape
                  key={obj.id}
                  obj={obj}
                  selected={selected === obj.id}
                  pulsing={pulsing === obj.id}
                  guestCount={(guestsByTable[obj.id] || []).length}
                  isEditor={isEditor}
                  onPointerDown={e => startDrag(e, obj.id)}
                  onClick={() => setSelected(obj.id === selected ? null : obj.id)}
                />
              ))}

              {/* Empty state hint */}
              {objs.length === 0 && isEditor && (
                <text
                  x={canvasW / 2} y={canvasH / 2}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize={14} fill="#4b5563" fontWeight="500"
                >
                  Click "Round", "Rect", "Stage", or "Bar" in the toolbar to add tables
                </text>
              )}
            </g>
          </svg>

          {/* Zoom hint */}
          <p className="absolute bottom-3 left-3 text-xs text-neutral-600 pointer-events-none select-none">
            Scroll to zoom · Drag background to pan
            {isEditor ? ' · Drag tables to move' : ''}
          </p>
        </div>

        {/* Right panel — only in editor mode */}
        {isEditor && (
          <div className="w-64 bg-neutral-900 border-l border-neutral-800 flex flex-col overflow-hidden shrink-0">
            <div className="px-4 py-3 border-b border-neutral-800">
              <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                Table Properties
              </p>
            </div>
            <PropsPanel
              obj={selectedObj}
              onChange={updateObj}
              onDelete={deleteObj}
              guestsByTable={guestsByTable}
              allGuests={allGuests}
              onAssignGuest={onAssignGuest}
              onUnassignGuest={onUnassignGuest}
            />

            {/* Legend */}
            <div className="px-4 py-3 border-t border-neutral-800 shrink-0">
              <p className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Legend</p>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
                  <span className="text-xs text-neutral-400">Guests seated</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-indigo-500 inline-block" />
                  <span className="text-xs text-neutral-400">Selected</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-green-400 inline-block" style={{ animation: 'tablePulse 0.65s ease-in-out infinite alternate' }} />
                  <span className="text-xs text-neutral-400">Guest just scanned</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Right panel in display mode — show guest list for selected table */}
        {!isEditor && selected && (
          <div className="w-64 bg-neutral-900 border-l border-neutral-800 flex flex-col overflow-hidden shrink-0">
            <div className="px-4 py-3 border-b border-neutral-800 flex items-center justify-between">
              <p className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                {objs.find(o => o.id === selected)?.label || 'Table'}
              </p>
              <button onClick={() => setSelected(null)} className="text-neutral-600 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {(guestsByTable[selected] || []).length === 0 ? (
                <p className="text-xs text-neutral-500 text-center py-6">No guests assigned to this table</p>
              ) : (
                (guestsByTable[selected] || []).map(g => (
                  <div key={g.id} className="flex items-center gap-2 py-2 border-b border-neutral-800">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${g.checkedIn ? 'bg-emerald-400' : 'bg-neutral-600'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-neutral-200 truncate">{g.guestName}</p>
                      <p className="text-[10px] text-neutral-500">{g.checkedIn ? 'Checked in' : 'Not yet arrived'}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
