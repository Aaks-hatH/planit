/**
 * TableService.jsx — Restaurant & Venue Floor Management (v2)
 *
 * Features:
 *  - Live floor map with real-time table states & remaining-time badges
 *  - Smart auto-assignment engine (best-fit, configurable rules)
 *  - Waitlist with per-party live estimated wait times
 *  - Reservations panel with QR codes
 *  - Extended settings: dining rules, auto-assign policy, server pool, party-size overrides
 *  - Overview tab: occupancy, turn stats, predicted availability
 *
 * Route: /e/:subdomain/floor  OR  /event/:eventId/floor
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Users, Clock, CheckCircle, XCircle, AlertTriangle, Settings, Plus,
  RefreshCw, QrCode, Trash2, Edit2, ChevronRight, Bell, MapPin,
  Coffee, Utensils, Star, LayoutGrid, List, X, Save, Check,
  ArrowRight, Phone, ScanLine, Calendar, Timer, Loader2,
  Zap, TrendingUp, BarChart3, Sparkles, MoveRight, UserCheck,
  AlertCircle, Info, Shuffle,
} from 'lucide-react';
import { eventAPI } from '../services/api';
import toast from 'react-hot-toast';
import SeatingMap from '../components/SeatingMap';

// ── Utilities ─────────────────────────────────────────────────────────────────

const uid = () => `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

const STATUS_META = {
  available:   { label: 'Available',   color: '#22c55e', bg: 'bg-emerald-950/60', border: 'border-emerald-500/40', text: 'text-emerald-400' },
  occupied:    { label: 'Occupied',    color: '#ef4444', bg: 'bg-rose-950/60',    border: 'border-rose-500/40',    text: 'text-rose-400'    },
  reserved:    { label: 'Reserved',    color: '#f59e0b', bg: 'bg-amber-950/60',   border: 'border-amber-500/40',   text: 'text-amber-400'   },
  cleaning:    { label: 'Cleaning',    color: '#8b5cf6', bg: 'bg-violet-950/60',  border: 'border-violet-500/40',  text: 'text-violet-400'  },
  unavailable: { label: 'Unavailable', color: '#525252', bg: 'bg-neutral-900',    border: 'border-neutral-700',    text: 'text-neutral-500' },
};

function fmtDuration(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 1) return '<1m';
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}
function fmtTime(date) {
  if (!date) return '';
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
function fmtDateTime(date) {
  if (!date) return '';
  return new Date(date).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Estimate minutes left at a table based on seating time + avg dining override */
function estimateRemaining(tableState, settings, partySize) {
  if (!tableState?.occupiedAt) return null;
  const overrides = settings?.sizeOverrides || [];
  let avgMin = settings?.avgDiningMinutes || 75;
  if (partySize) {
    const ov = overrides.find(o => partySize >= o.minParty && partySize <= o.maxParty);
    if (ov) avgMin = ov.avgMinutes;
  }
  const seatedMs  = Date.now() - new Date(tableState.occupiedAt).getTime();
  const remaining = avgMin * 60000 - seatedMs;
  return Math.max(0, Math.round(remaining / 60000));
}

/**
 * Core auto-assignment engine.
 * Given a party size and the current floor state, returns the best table id (or null).
 *
 * Rules (applied in priority order based on settings.assignmentRule):
 *   'exact'   — prefer tables whose capacity exactly matches party size; tie-break by longest-occupied
 *   'best_fit'— smallest table that fits (minimise empty seats)
 *   'first_available' — first available table regardless of size
 *
 * Extra rules:
 *   allowOverflow  — whether a group can sit at a table slightly smaller than party size
 *   maxOverflow    — how many % over capacity is allowed (e.g. 0 = strict, 0.2 = 20% over)
 *   preferredZone  — only look within a named zone first (fallback to any zone if none found)
 */
export function findBestTable(partySize, objects, tableStates, settings = {}) {
  const rule         = settings.assignmentRule || 'best_fit';
  const allowOv      = settings.allowOverflow ?? false;
  const maxOvPct     = settings.maxOverflowPct ?? 0;
  const zone         = settings.preferredZone || null;

  const tables = (objects || []).filter(o => o.type !== 'zone');

  const isAvailable = (t) => {
    const s = tableStates?.find(st => st.tableId === t.id);
    return !s || s.status === 'available';
  };

  const fits = (t) => {
    if (partySize <= t.capacity) return true;
    if (allowOv) return partySize <= t.capacity * (1 + maxOvPct);
    return false;
  };

  let candidates = tables.filter(t => isAvailable(t) && fits(t));

  // Zone preference — try preferred zone first, fall back if empty
  if (zone && candidates.length > 0) {
    const inZone = candidates.filter(t => t.zone === zone);
    if (inZone.length > 0) candidates = inZone;
  }

  if (candidates.length === 0) return null;

  if (rule === 'exact') {
    const exact = candidates.filter(t => t.capacity === partySize);
    if (exact.length > 0) return exact[0].id;
  }
  if (rule === 'first_available') return candidates[0].id;

  // best_fit: smallest sufficient table
  candidates.sort((a, b) => a.capacity - b.capacity);
  return candidates[0].id;
}

/**
 * Estimate wait minutes for a given party size.
 * Returns 0 if a table is available now, or the lowest estimated remaining time.
 */
function estimateWaitMinutes(partySize, tableStates, objects, settings) {
  const tables = (objects || []).filter(o => o.type !== 'zone' && o.capacity >= partySize);
  if (!tables.length) return null;

  const availNow = tables.some(t => {
    const s = (tableStates || []).find(st => st.tableId === t.id);
    return !s || s.status === 'available';
  });
  if (availNow) return 0;

  const times = tables
    .map(t => {
      const s = (tableStates || []).find(st => st.tableId === t.id);
      if (!s || s.status !== 'occupied') return null;
      return estimateRemaining(s, settings, s.partySize);
    })
    .filter(t => t !== null);

  if (!times.length) return null;
  return Math.min(...times) + (settings?.cleaningBufferMinutes || 10);
}

// ── Floor Map (SVG canvas) ────────────────────────────────────────────────────

function FloorMap({ objects, tableStates, selectedId, onSelect, zoom, onZoomChange, pan, onPanChange, settings, highlightId }) {
  const isDragging = useRef(false);
  const dragStart  = useRef({ x: 0, y: 0, px: 0, py: 0 });

  const getState = (id) => tableStates?.find(s => s.tableId === id) || { status: 'available' };

  const onWheel = (e) => {
    e.preventDefault();
    onZoomChange(z => Math.max(0.3, Math.min(3, z + (e.deltaY > 0 ? -0.1 : 0.1))));
  };

  const onMouseDown = (e) => {
    if (e.target.closest('.table-hit')) return;
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
  };
  const onMouseMove = (e) => {
    if (!isDragging.current) return;
    onPanChange({ x: dragStart.current.px + (e.clientX - dragStart.current.x), y: dragStart.current.py + (e.clientY - dragStart.current.y) });
  };
  const onMouseUp = () => { isDragging.current = false; };

  const renderTable = (obj) => {
    if (obj.type === 'zone') {
      return (
        <g key={obj.id} transform={`translate(${obj.x - (obj.width || 200) / 2}, ${obj.y - (obj.height || 120) / 2})`}>
          <rect width={obj.width || 200} height={obj.height || 120} rx={8} fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.1)" strokeDasharray="6 4" />
          <text x={(obj.width || 200) / 2} y={(obj.height || 120) / 2} textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.3)" fontSize="14" fontWeight="600">{obj.label || 'Zone'}</text>
        </g>
      );
    }

    const state     = getState(obj.id);
    const sm        = STATUS_META[state.status] || STATUS_META.available;
    const isRound   = obj.type === 'round' || obj.type === 'vip';
    const w = obj.width  || (isRound ? 80 : 120);
    const h = obj.height || (isRound ? 80 : 60);
    const isSel     = selectedId === obj.id;
    const isHL      = highlightId === obj.id;
    const remaining = state.status === 'occupied' ? estimateRemaining(state, settings, state.partySize) : null;
    const urgent    = remaining !== null && remaining <= 10;

    return (
      <g
        key={obj.id}
        transform={`translate(${obj.x}, ${obj.y}) rotate(${obj.rotation || 0})`}
        className="table-hit"
        style={{ cursor: 'pointer' }}
        onClick={() => onSelect(obj.id)}
      >
        {/* Highlight ring (auto-assign suggestion) */}
        {isHL && (isRound
          ? <circle cx={0} cy={0} r={w / 2 + 14} fill="none" stroke="#a78bfa" strokeWidth={3} opacity={0.9} strokeDasharray="6 3">
              <animate attributeName="stroke-dashoffset" from="0" to="-18" dur="0.8s" repeatCount="indefinite" />
            </circle>
          : <rect x={-w / 2 - 14} y={-h / 2 - 14} width={w + 28} height={h + 28} rx={12} fill="none" stroke="#a78bfa" strokeWidth={3} opacity={0.9} strokeDasharray="6 3">
              <animate attributeName="stroke-dashoffset" from="0" to="-18" dur="0.8s" repeatCount="indefinite" />
            </rect>
        )}
        {/* Selection ring */}
        {isSel && (isRound
          ? <circle cx={0} cy={0} r={w / 2 + 8} fill="none" stroke="white" strokeWidth={2} opacity={0.7} />
          : <rect x={-w / 2 - 8} y={-h / 2 - 8} width={w + 16} height={h + 16} rx={10} fill="none" stroke="white" strokeWidth={2} opacity={0.7} />
        )}
        {/* Status glow */}
        {isRound
          ? <circle cx={0} cy={0} r={w / 2 + 3} fill="none" stroke={sm.color} strokeWidth={isSel ? 3 : 2} opacity={0.8} />
          : <rect x={-w / 2 - 3} y={-h / 2 - 3} width={w + 6} height={h + 6} rx={9} fill="none" stroke={sm.color} strokeWidth={isSel ? 3 : 2} opacity={0.8} />
        }
        {/* Table body */}
        {isRound
          ? <circle cx={0} cy={0} r={w / 2} fill={`${sm.color}20`} />
          : <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={6} fill={`${sm.color}20`} />
        }
        {/* Table label */}
        <text x={0} y={-7} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="11" fontWeight="700">{obj.label || `T${obj.id.slice(-3)}`}</text>
        {/* Occupancy / capacity */}
        <text x={0} y={7} textAnchor="middle" dominantBaseline="middle" fill={sm.color} fontSize="10" fontWeight="500">
          {state.status === 'occupied' ? `${state.partySize || '?'} / ${obj.capacity}` : `cap ${obj.capacity}`}
        </text>
        {/* Party name (occupied) */}
        {state.status === 'occupied' && state.partyName && (
          <text x={0} y={19} textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.5)" fontSize="8">
            {state.partyName.slice(0, 12)}{state.partyName.length > 12 ? '…' : ''}
          </text>
        )}
        {/* Time remaining badge */}
        {state.status === 'occupied' && remaining !== null && (
          <g transform={`translate(${(isRound ? w / 2 : w / 2) - 5}, ${(isRound ? -w / 2 : -h / 2) + 5})`}>
            <rect x={-18} y={-9} width={36} height={18} rx={9} fill={urgent ? '#ef4444' : '#1c1c1c'} stroke={urgent ? '#ef444488' : '#333'} strokeWidth={1} />
            <text textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="9" fontWeight="700">{remaining <= 0 ? 'OVER' : `${remaining}m`}</text>
          </g>
        )}
        {/* Reserved badge */}
        {state.status === 'reserved' && (
          <g transform={`translate(${(isRound ? w / 2 : w / 2) - 5}, ${(isRound ? -w / 2 : -h / 2) + 5})`}>
            <rect x={-9} y={-9} width={18} height={18} rx={9} fill="#f59e0b" />
            <text textAnchor="middle" dominantBaseline="middle" fill="black" fontSize="10" fontWeight="800">R</text>
          </g>
        )}
        {/* Cleaning spinner indicator */}
        {state.status === 'cleaning' && (
          <g transform={`translate(${(isRound ? w / 2 : w / 2) - 5}, ${(isRound ? -w / 2 : -h / 2) + 5})`}>
            <circle cx={0} cy={0} r={8} fill="#8b5cf6" />
            <text textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="9" fontWeight="800">✦</text>
          </g>
        )}
      </g>
    );
  };

  return (
    <div
      className="relative w-full h-full overflow-hidden bg-neutral-950 select-none"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      <svg className="w-full h-full" onWheel={onWheel} style={{ cursor: isDragging.current ? 'grabbing' : 'grab' }}>
        <defs>
          <pattern id="floorgrid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#floorgrid)" />
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {(objects || []).map(renderTable)}
        </g>
      </svg>

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1">
        <button onClick={() => onZoomChange(z => Math.min(3, z + 0.2))} className="w-8 h-8 bg-neutral-800 border border-neutral-700 text-white rounded-md flex items-center justify-center text-lg font-bold hover:bg-neutral-700">+</button>
        <button onClick={() => onZoomChange(1)} className="w-8 h-8 bg-neutral-800 border border-neutral-700 text-neutral-400 rounded-md flex items-center justify-center text-xs font-bold hover:bg-neutral-700">{Math.round(zoom * 100)}%</button>
        <button onClick={() => onZoomChange(z => Math.max(0.3, z - 0.2))} className="w-8 h-8 bg-neutral-800 border border-neutral-700 text-white rounded-md flex items-center justify-center text-lg font-bold hover:bg-neutral-700">−</button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 flex gap-3 flex-wrap">
        {Object.entries(STATUS_META).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5 text-xs">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: v.color }} />
            <span className="text-neutral-400">{v.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Table Detail Panel ────────────────────────────────────────────────────────

function TablePanel({ obj, state, settings, onUpdate, onClose, waitlist, onSeatFromWaitlist }) {
  const [form, setForm]   = useState({ partyName: state?.partyName || '', partySize: state?.partySize || 1, serverName: state?.serverName || '', notes: state?.notes || '' });
  const [saving, setSaving] = useState(false);
  const sm        = STATUS_META[state?.status || 'available'];
  const remaining = state?.status === 'occupied' ? estimateRemaining(state, settings, state.partySize) : null;
  const seatedMs  = state?.occupiedAt ? Date.now() - new Date(state.occupiedAt).getTime() : null;
  const urgent    = remaining !== null && remaining <= 10;

  // Compatible waiting parties for this table
  const compatibleParties = useMemo(() =>
    (waitlist || [])
      .filter(p => p.status === 'waiting' || p.status === 'notified')
      .filter(p => p.partySize <= obj.capacity)
      .sort((a, b) => a.partySize - b.partySize), // best-fit first
    [waitlist, obj.capacity]
  );

  const act = async (status, extra = {}) => {
    setSaving(true);
    try { await onUpdate(obj.id, { status, ...form, ...extra }); }
    finally { setSaving(false); }
  };

  return (
    <div className="flex flex-col h-full bg-neutral-900 border-t border-neutral-800">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-800 flex-shrink-0">
        <div>
          <div className="font-bold text-white text-base">{obj.label || `Table ${obj.id.slice(-3)}`}</div>
          <div className="text-xs text-neutral-500">Capacity {obj.capacity} · {obj.type}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${sm.bg} ${sm.border} ${sm.text}`}>{sm.label}</span>
          <button onClick={onClose} className="p-1.5 hover:bg-neutral-800 rounded-lg text-neutral-500 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Timing card */}
        {state?.status === 'occupied' && seatedMs !== null && (
          <div className={`grid grid-cols-2 gap-3 p-4 rounded-xl border ${urgent ? 'bg-rose-950/30 border-rose-800/50' : 'bg-neutral-800/60 border-neutral-700'}`}>
            <div>
              <div className="text-[11px] text-neutral-500 mb-1">Seated for</div>
              <div className="text-xl font-black text-white">{fmtDuration(seatedMs)}</div>
              {state.serverName && <div className="text-xs text-neutral-500 mt-1">Server: {state.serverName}</div>}
            </div>
            <div>
              <div className="text-[11px] text-neutral-500 mb-1">Est. remaining</div>
              <div className={`text-xl font-black ${urgent ? 'text-rose-400' : 'text-white'}`}>
                {remaining === null ? '—' : remaining <= 0 ? 'Overdue' : `~${remaining}m`}
              </div>
              {urgent && <div className="text-xs text-rose-400 mt-1">⚠ Table may be ready soon</div>}
            </div>
          </div>
        )}

        {/* Party details form */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-neutral-500 mb-1.5 uppercase tracking-wider">Party Name</label>
            <input type="text" value={form.partyName} onChange={e => setForm(p => ({ ...p, partyName: e.target.value }))}
              placeholder="Smith party..." className="w-full bg-neutral-800 border border-neutral-700 text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-neutral-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-500 mb-1.5 uppercase tracking-wider">Guests</label>
              <input type="number" min="1" max={Math.max(obj.capacity * 2, 20)} value={form.partySize}
                onChange={e => setForm(p => ({ ...p, partySize: parseInt(e.target.value) || 1 }))}
                className="w-full bg-neutral-800 border border-neutral-700 text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-neutral-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-500 mb-1.5 uppercase tracking-wider">Server</label>
              {settings?.serverPool?.length > 0
                ? <select value={form.serverName} onChange={e => setForm(p => ({ ...p, serverName: e.target.value }))}
                    className="w-full bg-neutral-800 border border-neutral-700 text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-neutral-500">
                    <option value="">— assign —</option>
                    {settings.serverPool.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                : <input type="text" value={form.serverName} onChange={e => setForm(p => ({ ...p, serverName: e.target.value }))}
                    placeholder="Name" className="w-full bg-neutral-800 border border-neutral-700 text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-neutral-500" />
              }
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-500 mb-1.5 uppercase tracking-wider">Notes</label>
            <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="Allergies, birthday, high-chair needed..." rows={2}
              className="w-full bg-neutral-800 border border-neutral-700 text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-neutral-500 resize-none" />
          </div>
          <button onClick={() => act(state?.status || 'occupied')} disabled={saving}
            className="w-full py-2.5 bg-neutral-700 hover:bg-neutral-600 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save details
          </button>
        </div>

        {/* Seat from waitlist — only shown when table is available */}
        {(state?.status === 'available' || state?.status === 'cleaning') && compatibleParties.length > 0 && (
          <div>
            <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5" />Seat from Waitlist
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {compatibleParties.map(party => (
                <button key={party.id} onClick={() => onSeatFromWaitlist(party, obj.id)}
                  className="w-full flex items-center justify-between px-3 py-2.5 bg-neutral-800 hover:bg-emerald-900/30 border border-neutral-700 hover:border-emerald-700/50 rounded-lg transition-all text-left">
                  <div>
                    <span className="text-sm font-semibold text-white">{party.partyName}</span>
                    <span className="ml-2 text-xs text-neutral-500">party of {party.partySize}</span>
                    {party.status === 'notified' && <span className="ml-2 text-xs text-amber-400 font-semibold">notified</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-500">{fmtDuration(Date.now() - new Date(party.addedAt).getTime())} waiting</span>
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Status actions */}
        <div>
          <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Change Status</div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { status: 'occupied',    label: 'Seat Party',     icon: Users },
              { status: 'available',   label: 'Mark Available', icon: CheckCircle },
              { status: 'cleaning',    label: 'Cleaning',       icon: RefreshCw },
              { status: 'reserved',    label: 'Reserved',       icon: Calendar },
              { status: 'unavailable', label: 'Unavailable',    icon: XCircle },
            ].map(({ status, label, icon: Icon }) => {
              const m = STATUS_META[status];
              const cur = (state?.status || 'available') === status;
              return (
                <button key={status} onClick={() => act(status)} disabled={saving || cur}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold border transition-all ${cur ? `${m.bg} ${m.border} ${m.text}` : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:bg-neutral-700 hover:text-white'}`}>
                  <Icon className="w-3.5 h-3.5" />{label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Waitlist Panel ─────────────────────────────────────────────────────────────

function WaitlistPanel({ waitlist, tableStates, objects, settings, onAdd, onUpdate, onRemove, onAutoAssign }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm]       = useState({ partyName: '', partySize: 2, phone: '', notes: '', priority: 'normal' });
  const [adding, setAdding]   = useState(false);
  const [assigningId, setAssigningId] = useState(null);

  const handleAdd = async () => {
    if (!form.partyName.trim()) { toast.error('Party name is required'); return; }
    if (!form.partySize || form.partySize < 1) { toast.error('Party size must be at least 1'); return; }
    setAdding(true);
    try {
      await onAdd(form);
      setForm({ partyName: '', partySize: 2, phone: '', notes: '', priority: 'normal' });
      setShowAdd(false);
    } finally { setAdding(false); }
  };

  const handleAutoAssign = async (party) => {
    const tableId = findBestTable(party.partySize, objects, tableStates, settings);
    if (!tableId) { toast.error(`No available table for a party of ${party.partySize}`); return; }
    setAssigningId(party.id);
    try { await onAutoAssign(party, tableId); }
    finally { setAssigningId(null); }
  };

  const activeWaitlist = (waitlist || []).filter(p => p.status === 'waiting' || p.status === 'notified');

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-neutral-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-neutral-400" />
          <span className="font-semibold text-white text-sm">Waitlist</span>
          {activeWaitlist.length > 0 && (
            <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-bold rounded-full">{activeWaitlist.length}</span>
          )}
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-neutral-900 rounded-lg text-xs font-bold hover:bg-neutral-100">
          <Plus className="w-3.5 h-3.5" />Add party
        </button>
      </div>

      {showAdd && (
        <div className="p-4 border-b border-neutral-800 bg-neutral-950/50 space-y-3 flex-shrink-0">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Party Name *</label>
              <input type="text" value={form.partyName} onChange={e => setForm(p => ({ ...p, partyName: e.target.value }))}
                placeholder="Smith party" className="w-full bg-neutral-800 border border-neutral-700 text-white text-xs rounded-lg px-3 py-2 outline-none focus:border-neutral-500" />
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Party Size *</label>
              <input type="number" min="1" max="50" value={form.partySize} onChange={e => setForm(p => ({ ...p, partySize: parseInt(e.target.value) || 1 }))}
                className="w-full bg-neutral-800 border border-neutral-700 text-white text-xs rounded-lg px-3 py-2 outline-none focus:border-neutral-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input type="tel" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
              placeholder="Phone (optional)" className="w-full bg-neutral-800 border border-neutral-700 text-white text-xs rounded-lg px-3 py-2 outline-none focus:border-neutral-500" />
            <select value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}
              className="w-full bg-neutral-800 border border-neutral-700 text-white text-xs rounded-lg px-3 py-2 outline-none focus:border-neutral-500">
              <option value="normal">Normal</option>
              <option value="vip">VIP</option>
              <option value="accessibility">Accessibility</option>
            </select>
          </div>
          <input type="text" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
            placeholder="Notes (optional)" className="w-full bg-neutral-800 border border-neutral-700 text-white text-xs rounded-lg px-3 py-2 outline-none focus:border-neutral-500" />
          <div className="flex gap-2">
            <button onClick={() => setShowAdd(false)} className="flex-1 py-2 bg-neutral-800 text-neutral-400 rounded-lg text-xs font-semibold hover:bg-neutral-700">Cancel</button>
            <button onClick={handleAdd} disabled={adding} className="flex-1 py-2 bg-white text-neutral-900 rounded-lg text-xs font-bold hover:bg-neutral-100 flex items-center justify-center gap-1">
              {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Add to waitlist'}
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {activeWaitlist.length === 0 ? (
          <div className="text-center py-16 text-neutral-600">
            <Users className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No one waiting</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-800">
            {activeWaitlist.map((party, idx) => {
              const estWait = estimateWaitMinutes(party.partySize, tableStates, objects, settings);
              const tableAvail = findBestTable(party.partySize, objects, tableStates, settings);
              const waitMs   = Date.now() - new Date(party.addedAt).getTime();
              const isVip    = party.priority === 'vip';
              const isAccess = party.priority === 'accessibility';
              return (
                <div key={party.id} className={`p-4 transition-colors ${isVip ? 'bg-amber-950/20 hover:bg-amber-950/30' : 'hover:bg-neutral-800/30'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${isVip ? 'bg-amber-500/30 border border-amber-500/40 text-amber-300' : 'bg-neutral-800 border border-neutral-700 text-neutral-300'}`}>
                        {isVip ? '★' : isAccess ? '♿' : idx + 1}
                      </div>
                      <div>
                        <div className="font-semibold text-white text-sm">{party.partyName}</div>
                        <div className="text-xs text-neutral-500 flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="flex items-center gap-1"><Users className="w-3 h-3" />{party.partySize}</span>
                          {party.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{party.phone}</span>}
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmtDuration(waitMs)}</span>
                        </div>
                        {party.notes && <div className="text-xs text-neutral-600 mt-0.5 italic">{party.notes}</div>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {tableAvail && (
                        <button onClick={() => handleAutoAssign(party)} disabled={!!assigningId} title="Auto-assign best table"
                          className="p-1.5 hover:bg-violet-500/20 text-neutral-500 hover:text-violet-400 rounded-lg transition-colors" title="Auto-seat at best table">
                          {assigningId === party.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                        </button>
                      )}
                      {party.status === 'waiting' && (
                        <button onClick={() => onUpdate(party.id, 'notified')} title="Mark notified"
                          className="p-1.5 hover:bg-amber-500/20 text-neutral-500 hover:text-amber-400 rounded-lg transition-colors"><Bell className="w-3.5 h-3.5" /></button>
                      )}
                      {party.status === 'notified' && (
                        <span className="text-xs text-amber-400 font-semibold px-2 py-0.5 bg-amber-500/10 rounded-full border border-amber-500/20">Notified</span>
                      )}
                      <button onClick={() => onUpdate(party.id, 'seated')} title="Mark seated"
                        className="p-1.5 hover:bg-emerald-500/20 text-neutral-500 hover:text-emerald-400 rounded-lg transition-colors"><CheckCircle className="w-3.5 h-3.5" /></button>
                      <button onClick={() => onRemove(party.id)} title="Remove from list"
                        className="p-1.5 hover:bg-rose-500/20 text-neutral-500 hover:text-rose-400 rounded-lg transition-colors"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                  {/* Wait estimate */}
                  <div className={`mt-2 ml-10 text-xs font-semibold flex items-center gap-1.5 ${
                    estWait === 0 ? 'text-emerald-400' : estWait === null ? 'text-neutral-600' : estWait <= 15 ? 'text-amber-400' : 'text-rose-400'
                  }`}>
                    {estWait === 0 && <><CheckCircle className="w-3 h-3" />Table ready now{tableAvail ? ' — tap ⚡ to auto-seat' : ''}</>}
                    {estWait === null && <><AlertCircle className="w-3 h-3" />No suitable table available</>}
                    {estWait !== null && estWait > 0 && <><Clock className="w-3 h-3" />Est. wait ~{estWait} min</>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Reservations Panel ────────────────────────────────────────────────────────

function ReservationsPanel({ reservations, onAdd, onUpdate, eventId }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm]       = useState({ partyName: '', partySize: 2, phone: '', email: '', dateTime: '', notes: '' });
  const [adding, setAdding]   = useState(false);
  const [showQR, setShowQR]   = useState(null);

  const handleAdd = async () => {
    if (!form.partyName.trim() || !form.dateTime) { toast.error('Party name and date/time required'); return; }
    setAdding(true);
    try { await onAdd(form); setForm({ partyName: '', partySize: 2, phone: '', email: '', dateTime: '', notes: '' }); setShowAdd(false); }
    finally { setAdding(false); }
  };

  const today    = (reservations || []).filter(r => { const d = new Date(r.dateTime); return d.toDateString() === new Date().toDateString() && r.status === 'confirmed'; }).sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));
  const upcoming = (reservations || []).filter(r => { const d = new Date(r.dateTime); return d.toDateString() !== new Date().toDateString() && r.status === 'confirmed' && d > new Date(); }).sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));

  const QRModal = () => {
    if (!showQR) return null;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(showQR.qrToken)}&bgcolor=0a0a0a&color=ffffff&margin=2`;
    return (
      <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setShowQR(null)}>
        <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-6 max-w-xs w-full" onClick={e => e.stopPropagation()}>
          <div className="text-center mb-4">
            <div className="font-bold text-white text-lg">{showQR.partyName}</div>
            <div className="text-sm text-neutral-400">{fmtDateTime(showQR.dateTime)} · Party of {showQR.partySize}</div>
          </div>
          <div className="flex justify-center mb-4">
            <img src={qrUrl} alt="Reservation QR" className="rounded-xl" width="200" height="200" />
          </div>
          <div className="text-center text-xs text-neutral-600 mb-4">Valid until {fmtDateTime(showQR.qrExpiresAt)}</div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => { onUpdate(showQR.id, 'seated'); setShowQR(null); }} className="py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700">Seat Now</button>
            <button onClick={() => { onUpdate(showQR.id, 'no_show'); setShowQR(null); }} className="py-2 bg-neutral-800 text-neutral-400 rounded-lg text-xs font-semibold hover:bg-neutral-700">No Show</button>
          </div>
          <button onClick={() => setShowQR(null)} className="w-full mt-2 py-2 text-neutral-600 text-xs hover:text-neutral-400">Close</button>
        </div>
      </div>
    );
  };

  const Row = ({ r }) => (
    <div className="flex items-center justify-between px-3 py-2.5 hover:bg-neutral-800/40 rounded-xl transition-colors gap-3">
      <div className="min-w-0">
        <div className="font-semibold text-white text-sm truncate">{r.partyName}</div>
        <div className="text-xs text-neutral-500 flex items-center gap-2 mt-0.5">
          <span><Clock className="w-3 h-3 inline mr-0.5" />{fmtTime(r.dateTime)}</span>
          <span><Users className="w-3 h-3 inline mr-0.5" />{r.partySize}</span>
          {r.phone && <span><Phone className="w-3 h-3 inline mr-0.5" />{r.phone}</span>}
        </div>
        {r.notes && <div className="text-xs text-neutral-600 italic mt-0.5">{r.notes}</div>}
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={() => setShowQR(r)} title="Show QR" className="p-1.5 hover:bg-neutral-700 text-neutral-500 hover:text-white rounded-lg"><QrCode className="w-3.5 h-3.5" /></button>
        <button onClick={() => onUpdate(r.id, 'seated')} title="Seat now" className="p-1.5 hover:bg-emerald-500/20 text-neutral-500 hover:text-emerald-400 rounded-lg"><CheckCircle className="w-3.5 h-3.5" /></button>
        <button onClick={() => onUpdate(r.id, 'cancelled')} title="Cancel" className="p-1.5 hover:bg-rose-500/20 text-neutral-500 hover:text-rose-400 rounded-lg"><X className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <QRModal />
      <div className="flex items-center justify-between p-4 border-b border-neutral-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-neutral-400" />
          <span className="font-semibold text-white text-sm">Reservations</span>
          {today.length > 0 && <span className="px-2 py-0.5 bg-blue-500/20 border border-blue-500/30 text-blue-400 text-xs font-bold rounded-full">{today.length} today</span>}
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-neutral-900 rounded-lg text-xs font-bold hover:bg-neutral-100">
          <Plus className="w-3.5 h-3.5" />New
        </button>
      </div>

      {showAdd && (
        <div className="p-4 border-b border-neutral-800 bg-neutral-950/50 space-y-3 flex-shrink-0">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Party Name *</label>
              <input type="text" value={form.partyName} onChange={e => setForm(p => ({ ...p, partyName: e.target.value }))}
                placeholder="Smith party" className="w-full bg-neutral-800 border border-neutral-700 text-white text-xs rounded-lg px-3 py-2 outline-none focus:border-neutral-500" />
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Size *</label>
              <input type="number" min="1" value={form.partySize} onChange={e => setForm(p => ({ ...p, partySize: parseInt(e.target.value) || 1 }))}
                className="w-full bg-neutral-800 border border-neutral-700 text-white text-xs rounded-lg px-3 py-2 outline-none focus:border-neutral-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Date & Time *</label>
            <input type="datetime-local" value={form.dateTime} onChange={e => setForm(p => ({ ...p, dateTime: e.target.value }))}
              className="w-full bg-neutral-800 border border-neutral-700 text-white text-xs rounded-lg px-3 py-2 outline-none focus:border-neutral-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input type="tel" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
              placeholder="Phone" className="w-full bg-neutral-800 border border-neutral-700 text-white text-xs rounded-lg px-3 py-2 outline-none focus:border-neutral-500" />
            <input type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              placeholder="Email" className="w-full bg-neutral-800 border border-neutral-700 text-white text-xs rounded-lg px-3 py-2 outline-none focus:border-neutral-500" />
          </div>
          <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
            placeholder="Notes (optional)" rows={2} className="w-full bg-neutral-800 border border-neutral-700 text-white text-xs rounded-lg px-3 py-2 outline-none focus:border-neutral-500 resize-none" />
          <div className="flex gap-2">
            <button onClick={() => setShowAdd(false)} className="flex-1 py-2 bg-neutral-800 text-neutral-400 rounded-lg text-xs font-semibold hover:bg-neutral-700">Cancel</button>
            <button onClick={handleAdd} disabled={adding} className="flex-1 py-2 bg-white text-neutral-900 rounded-lg text-xs font-bold hover:bg-neutral-100 flex items-center justify-center gap-1">
              {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : <><QrCode className="w-3 h-3" />Create + QR</>}
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {today.length > 0 && (
          <div>
            <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2 px-1">Today</div>
            {today.map(r => <Row key={r.id} r={r} />)}
          </div>
        )}
        {upcoming.length > 0 && (
          <div>
            <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2 px-1">Upcoming</div>
            {upcoming.slice(0, 12).map(r => <Row key={r.id} r={r} />)}
          </div>
        )}
        {today.length === 0 && upcoming.length === 0 && (
          <div className="text-center py-16 text-neutral-600">
            <Calendar className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No reservations</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Overview Panel ────────────────────────────────────────────────────────────

function OverviewPanel({ objects, tableStates, waitlist, settings }) {
  const tables = (objects || []).filter(o => o.type !== 'zone');
  const counts = useMemo(() => {
    const c = { available: 0, occupied: 0, reserved: 0, cleaning: 0, unavailable: 0 };
    tables.forEach(t => {
      const s = tableStates?.find(st => st.tableId === t.id);
      c[s?.status || 'available']++;
    });
    return c;
  }, [tables, tableStates]);

  const totalGuests   = (tableStates || []).filter(s => s.status === 'occupied').reduce((sum, s) => sum + (s.partySize || 0), 0);
  const occupancyPct  = tables.length ? Math.round((counts.occupied / tables.length) * 100) : 0;
  const activeWait    = (waitlist || []).filter(p => p.status === 'waiting' || p.status === 'notified');
  const avgWaitMin    = useMemo(() => {
    if (!activeWait.length) return null;
    const times = activeWait.map(p => estimateWaitMinutes(p.partySize, tableStates, objects, settings)).filter(t => t !== null);
    if (!times.length) return null;
    return Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  }, [activeWait, tableStates, objects, settings]);

  const urgentTables = (tableStates || []).filter(s => {
    if (s.status !== 'occupied') return false;
    const r = estimateRemaining(s, settings, s.partySize);
    return r !== null && r <= 10;
  });

  return (
    <div className="p-5 space-y-5 overflow-y-auto h-full">
      {/* Live Stats */}
      <div>
        <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">Live Stats</div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: 'Available',  value: counts.available,  color: 'text-emerald-400' },
            { label: 'Occupied',   value: counts.occupied,   color: 'text-rose-400'    },
            { label: 'Reserved',   value: counts.reserved,   color: 'text-amber-400'   },
            { label: 'Cleaning',   value: counts.cleaning,   color: 'text-violet-400'  },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-neutral-800 rounded-xl p-4">
              <div className={`text-2xl font-black ${color}`}>{value}</div>
              <div className="text-xs text-neutral-500 font-semibold mt-1">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Occupancy bar */}
      <div className="bg-neutral-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Occupancy</div>
          <span className="text-lg font-black text-white">{occupancyPct}%</span>
        </div>
        <div className="h-2.5 bg-neutral-700 rounded-full overflow-hidden mb-2">
          <div className="h-full rounded-full transition-all duration-700"
            style={{ width: `${occupancyPct}%`, background: occupancyPct > 85 ? '#ef4444' : occupancyPct > 60 ? '#f59e0b' : '#22c55e' }} />
        </div>
        <div className="text-xs text-neutral-600">{counts.occupied} of {tables.length} tables · {totalGuests} guests seated</div>
      </div>

      {/* Waitlist summary */}
      {activeWait.length > 0 && (
        <div className="bg-amber-950/30 border border-amber-800/40 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-bold text-amber-300">{activeWait.length} waiting</span>
          </div>
          {avgWaitMin !== null && (
            <div className="text-xs text-amber-400/70">Avg estimated wait: ~{avgWaitMin} min</div>
          )}
          <div className="mt-3 space-y-1">
            {activeWait.slice(0, 4).map(p => {
              const wait = estimateWaitMinutes(p.partySize, tableStates, objects, settings);
              return (
                <div key={p.id} className="flex items-center justify-between text-xs">
                  <span className="text-neutral-300">{p.partyName} <span className="text-neutral-500">({p.partySize})</span></span>
                  <span className={wait === 0 ? 'text-emerald-400 font-semibold' : wait === null ? 'text-neutral-600' : 'text-amber-400'}>
                    {wait === 0 ? 'Ready now' : wait === null ? 'No table' : `~${wait}m`}
                  </span>
                </div>
              );
            })}
            {activeWait.length > 4 && <div className="text-xs text-neutral-600">+{activeWait.length - 4} more</div>}
          </div>
        </div>
      )}

      {/* Urgent tables */}
      {urgentTables.length > 0 && (
        <div className="bg-rose-950/30 border border-rose-800/40 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span className="text-sm font-bold text-rose-300">{urgentTables.length} table{urgentTables.length > 1 ? 's' : ''} finishing soon</span>
          </div>
          <div className="space-y-1 mt-2">
            {urgentTables.map(s => {
              const tbl = tables.find(t => t.id === s.tableId);
              const r   = estimateRemaining(s, settings, s.partySize);
              return (
                <div key={s.tableId} className="flex items-center justify-between text-xs">
                  <span className="text-neutral-300">{tbl?.label || s.tableId} — {s.partyName || 'party'}</span>
                  <span className={`font-semibold ${r <= 0 ? 'text-rose-400' : 'text-amber-400'}`}>{r <= 0 ? 'Overdue' : `${r}m left`}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Config summary */}
      <div className="bg-neutral-800/60 rounded-xl p-4 space-y-2">
        <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Configuration</div>
        {[
          { label: 'Avg dining time', value: `${settings?.avgDiningMinutes || 75} min` },
          { label: 'Cleaning buffer', value: `${settings?.cleaningBufferMinutes || 10} min` },
          { label: 'Assignment rule', value: { best_fit: 'Best fit', exact: 'Exact match', first_available: 'First available' }[settings?.assignmentRule || 'best_fit'] },
          { label: 'Overflow allowed', value: settings?.allowOverflow ? `Yes (max ${Math.round((settings?.maxOverflowPct || 0) * 100)}%)` : 'No' },
          { label: 'Hours', value: `${settings?.operatingHoursOpen || '11:00'} – ${settings?.operatingHoursClose || '22:00'}` },
        ].map(({ label, value }) => (
          <div key={label} className="flex justify-between text-xs">
            <span className="text-neutral-500">{label}</span>
            <span className="text-neutral-300 font-semibold">{value}</span>
          </div>
        ))}
      </div>

      {settings?.welcomeMessage && (
        <div className="bg-neutral-800/60 border border-neutral-700 rounded-xl p-4">
          <div className="text-xs font-bold text-neutral-500 mb-2">Tonight's Note</div>
          <p className="text-sm text-neutral-300 italic leading-relaxed">{settings.welcomeMessage}</p>
        </div>
      )}
    </div>
  );
}

// ── Settings Modal ────────────────────────────────────────────────────────────

function SettingsModal({ settings, onSave, onClose }) {
  const [form, setForm] = useState({
    restaurantName:             settings?.restaurantName || '',
    avgDiningMinutes:           settings?.avgDiningMinutes || 75,
    cleaningBufferMinutes:      settings?.cleaningBufferMinutes || 10,
    reservationDurationMinutes: settings?.reservationDurationMinutes || 90,
    reservationQrExpiryMinutes: settings?.reservationQrExpiryMinutes || 45,
    operatingHoursOpen:         settings?.operatingHoursOpen || '11:00',
    operatingHoursClose:        settings?.operatingHoursClose || '22:00',
    welcomeMessage:             settings?.welcomeMessage || '',
    // Assignment rules
    assignmentRule:    settings?.assignmentRule || 'best_fit',
    allowOverflow:     settings?.allowOverflow ?? false,
    maxOverflowPct:    settings?.maxOverflowPct ?? 0,
    preferredZone:     settings?.preferredZone || '',
    // Server pool
    serverPoolRaw:     (settings?.serverPool || []).join(', '),
    // Party-size overrides (JSON for simplicity in UI)
    sizeOverrides:     settings?.sizeOverrides || [],
  });
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  const set = (k) => (e) => setForm(p => ({
    ...p,
    [k]: e.target.type === 'checkbox' ? e.target.checked
       : e.target.type === 'number'   ? parseFloat(e.target.value) || 0
       : e.target.value
  }));

  const handleSave = async () => {
    setSaving(true);
    const serverPool = form.serverPoolRaw
      .split(',').map(s => s.trim()).filter(Boolean);
    try { await onSave({ ...form, serverPool }); onClose(); } finally { setSaving(false); }
  };

  const addSizeOverride = () => setForm(p => ({ ...p, sizeOverrides: [...p.sizeOverrides, { minParty: 1, maxParty: 2, avgMinutes: 60 }] }));
  const removeSizeOverride = (i) => setForm(p => ({ ...p, sizeOverrides: p.sizeOverrides.filter((_, idx) => idx !== i) }));
  const updateSizeOverride = (i, k, v) => setForm(p => {
    const ov = [...p.sizeOverrides];
    ov[i] = { ...ov[i], [k]: parseFloat(v) || 0 };
    return { ...p, sizeOverrides: ov };
  });

  const tabs = [
    { id: 'general',    label: 'General'    },
    { id: 'assignment', label: 'Assignment' },
    { id: 'staff',      label: 'Staff'      },
  ];

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-neutral-800 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-white">Table Service Settings</h2>
            <p className="text-xs text-neutral-500 mt-0.5">Configure your restaurant's operational rules</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-neutral-800 flex-shrink-0 px-6">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`py-3 px-4 text-sm font-semibold border-b-2 transition-all ${activeTab === t.id ? 'text-white border-white' : 'text-neutral-500 border-transparent hover:text-neutral-300'}`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {activeTab === 'general' && (<>
            <div>
              <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Restaurant Name</label>
              <input type="text" value={form.restaurantName} onChange={set('restaurantName')}
                placeholder="Taverna Roma..." className="w-full bg-neutral-800 border border-neutral-700 text-white rounded-xl px-4 py-3 outline-none focus:border-neutral-500 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Avg Dining Time (min)</label>
                <input type="number" min="10" max="300" value={form.avgDiningMinutes} onChange={set('avgDiningMinutes')}
                  className="w-full bg-neutral-800 border border-neutral-700 text-white rounded-xl px-4 py-3 outline-none focus:border-neutral-500 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Cleaning Buffer (min)</label>
                <input type="number" min="0" max="60" value={form.cleaningBufferMinutes} onChange={set('cleaningBufferMinutes')}
                  className="w-full bg-neutral-800 border border-neutral-700 text-white rounded-xl px-4 py-3 outline-none focus:border-neutral-500 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Reservation Duration (min)</label>
                <input type="number" min="30" max="300" value={form.reservationDurationMinutes} onChange={set('reservationDurationMinutes')}
                  className="w-full bg-neutral-800 border border-neutral-700 text-white rounded-xl px-4 py-3 outline-none focus:border-neutral-500 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">QR Expiry (min after res.)</label>
                <input type="number" min="5" max="240" value={form.reservationQrExpiryMinutes} onChange={set('reservationQrExpiryMinutes')}
                  className="w-full bg-neutral-800 border border-neutral-700 text-white rounded-xl px-4 py-3 outline-none focus:border-neutral-500 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Opens</label>
                <input type="time" value={form.operatingHoursOpen} onChange={set('operatingHoursOpen')}
                  className="w-full bg-neutral-800 border border-neutral-700 text-white rounded-xl px-4 py-3 outline-none focus:border-neutral-500 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Closes</label>
                <input type="time" value={form.operatingHoursClose} onChange={set('operatingHoursClose')}
                  className="w-full bg-neutral-800 border border-neutral-700 text-white rounded-xl px-4 py-3 outline-none focus:border-neutral-500 text-sm" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Welcome Message (shown in overview)</label>
              <textarea value={form.welcomeMessage} onChange={set('welcomeMessage')}
                placeholder="Good evening — enjoy tonight's service."
                rows={2} className="w-full bg-neutral-800 border border-neutral-700 text-white rounded-xl px-4 py-3 outline-none focus:border-neutral-500 text-sm resize-none" />
            </div>
            {/* Per-party-size dining overrides */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider">Party-Size Dining Overrides</label>
                <button onClick={addSizeOverride} className="text-xs text-neutral-400 hover:text-white flex items-center gap-1"><Plus className="w-3 h-3" />Add</button>
              </div>
              <p className="text-xs text-neutral-600 mb-3">Override the average dining time for specific party sizes (e.g. large groups stay longer).</p>
              {form.sizeOverrides.length === 0 && <p className="text-xs text-neutral-700 italic">No overrides — uses default avg dining time.</p>}
              {form.sizeOverrides.map((ov, i) => (
                <div key={i} className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-neutral-500 w-12 flex-shrink-0">Party</span>
                  <input type="number" min="1" value={ov.minParty} onChange={e => updateSizeOverride(i, 'minParty', e.target.value)}
                    className="w-16 bg-neutral-800 border border-neutral-700 text-white text-xs rounded-lg px-2 py-1.5 outline-none" placeholder="min" />
                  <span className="text-xs text-neutral-600">–</span>
                  <input type="number" min="1" value={ov.maxParty} onChange={e => updateSizeOverride(i, 'maxParty', e.target.value)}
                    className="w-16 bg-neutral-800 border border-neutral-700 text-white text-xs rounded-lg px-2 py-1.5 outline-none" placeholder="max" />
                  <span className="text-xs text-neutral-500 flex-shrink-0">→</span>
                  <input type="number" min="10" value={ov.avgMinutes} onChange={e => updateSizeOverride(i, 'avgMinutes', e.target.value)}
                    className="w-20 bg-neutral-800 border border-neutral-700 text-white text-xs rounded-lg px-2 py-1.5 outline-none" placeholder="min" />
                  <span className="text-xs text-neutral-500">min</span>
                  <button onClick={() => removeSizeOverride(i)} className="text-neutral-600 hover:text-rose-400 ml-auto"><X className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          </>)}

          {activeTab === 'assignment' && (<>
            <div>
              <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Auto-Assignment Rule</label>
              <p className="text-xs text-neutral-600 mb-3">How the ⚡ auto-seat button picks a table for a waiting party.</p>
              {[
                { id: 'best_fit',        label: 'Best Fit',         desc: 'Smallest table that fits the party (minimises empty seats). Recommended.' },
                { id: 'exact',           label: 'Exact Match',      desc: 'Prefer tables whose capacity exactly equals the party size. Falls back to best-fit.' },
                { id: 'first_available', label: 'First Available',  desc: 'Pick the first available table regardless of size.' },
              ].map(opt => (
                <label key={opt.id} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all mb-2 ${form.assignmentRule === opt.id ? 'bg-violet-950/40 border-violet-600/50' : 'bg-neutral-800/50 border-neutral-700 hover:border-neutral-600'}`}>
                  <input type="radio" name="assignmentRule" value={opt.id} checked={form.assignmentRule === opt.id} onChange={set('assignmentRule')} className="mt-0.5 accent-violet-500" />
                  <div>
                    <div className="text-sm font-semibold text-white">{opt.label}</div>
                    <div className="text-xs text-neutral-500 mt-0.5">{opt.desc}</div>
                  </div>
                </label>
              ))}
            </div>

            <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-white">Allow Overflow Seating</div>
                  <div className="text-xs text-neutral-500 mt-0.5">Seat a party at a table slightly under their size (e.g. party of 5 at a table for 4).</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={form.allowOverflow} onChange={set('allowOverflow')} className="sr-only peer" />
                  <div className="w-9 h-5 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:bg-violet-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                </label>
              </div>
              {form.allowOverflow && (
                <div>
                  <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Max Overflow (%)</label>
                  <div className="flex items-center gap-3">
                    <input type="range" min="0" max="0.5" step="0.05" value={form.maxOverflowPct}
                      onChange={e => setForm(p => ({ ...p, maxOverflowPct: parseFloat(e.target.value) }))}
                      className="flex-1 accent-violet-500" />
                    <span className="text-sm font-bold text-white w-10 text-right">{Math.round(form.maxOverflowPct * 100)}%</span>
                  </div>
                  <div className="text-xs text-neutral-600 mt-1">e.g. 25% = party of 5 can sit at a table for 4.</div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Preferred Zone (optional)</label>
              <input type="text" value={form.preferredZone} onChange={set('preferredZone')}
                placeholder="e.g. Patio, Bar, Main Floor..." className="w-full bg-neutral-800 border border-neutral-700 text-white rounded-xl px-4 py-3 outline-none focus:border-neutral-500 text-sm" />
              <p className="text-xs text-neutral-600 mt-1.5">When set, auto-assign will prefer tables in this zone first, then fall back to the full floor if none are available.</p>
            </div>
          </>)}

          {activeTab === 'staff' && (<>
            <div>
              <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Server Pool</label>
              <p className="text-xs text-neutral-600 mb-3">Comma-separated list of server names. When set, the table panel shows a dropdown instead of a free-text field.</p>
              <textarea value={form.serverPoolRaw} onChange={set('serverPoolRaw')}
                placeholder="Alice, Bob, Carlos, Dana..."
                rows={3} className="w-full bg-neutral-800 border border-neutral-700 text-white rounded-xl px-4 py-3 outline-none focus:border-neutral-500 text-sm resize-none" />
              {form.serverPoolRaw && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {form.serverPoolRaw.split(',').map(s => s.trim()).filter(Boolean).map(s => (
                    <span key={s} className="px-2 py-0.5 bg-neutral-700 text-neutral-300 text-xs rounded-full">{s}</span>
                  ))}
                </div>
              )}
            </div>
          </>)}
        </div>

        <div className="p-6 border-t border-neutral-800 flex gap-3 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-3 bg-neutral-800 text-neutral-400 rounded-xl text-sm font-semibold hover:bg-neutral-700">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-3 bg-white text-neutral-900 rounded-xl text-sm font-bold hover:bg-neutral-100 flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" />Save Settings</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TableService() {
  const { eventId, subdomain } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading]             = useState(true);
  const [floorData, setFloorData]         = useState({ seatingMap: { objects: [] }, tableStates: [], settings: {}, reservations: [], waitlist: [], restaurantName: '' });
  const [selectedTableId, setSelectedTableId] = useState(null);
  const [sideTab, setSideTab]             = useState('waitlist');
  const [showSettings, setShowSettings]   = useState(false);
  const [showFloorEditor, setShowFloorEditor] = useState(false);
  const [seatingIsSaving, setSeatingIsSaving] = useState(false);
  const [zoom, setZoom]                   = useState(1);
  const [pan, setPan]                     = useState({ x: 0, y: 0 });
  const [highlightTableId, setHighlightTableId] = useState(null); // auto-assign preview
  const refreshRef                        = useRef(null);

  // Derived
  const eid         = eventId || floorData.eventId;
  const objects     = floorData.seatingMap?.objects || [];
  const tables      = objects.filter(o => o.type !== 'zone');
  const tableStates = floorData.tableStates || [];
  const settings    = floorData.settings || {};

  const selectedObj   = selectedTableId ? objects.find(o => o.id === selectedTableId) : null;
  const selectedState = selectedTableId ? tableStates.find(s => s.tableId === selectedTableId) : null;
  const tableCounts   = useMemo(() => {
    const c = { available: 0, occupied: 0, reserved: 0, cleaning: 0, unavailable: 0 };
    tables.forEach(t => { const s = tableStates.find(st => st.tableId === t.id); c[s?.status || 'available']++; });
    return c;
  }, [tables, tableStates]);

  // Load floor data
  const load = useCallback(async () => {
    try {
      let res;
      if (eventId) {
        res = await eventAPI.get(`/${eventId}/table-service/floor`);
      } else if (subdomain) {
        const ev = await eventAPI.get(`/subdomain/${subdomain}`);
        const id = ev.data.event.id;
        res = await eventAPI.get(`/${id}/table-service/floor`);
        setFloorData(prev => ({ ...prev, eventId: id }));
      }
      if (res) setFloorData(prev => ({ ...prev, ...res.data }));
    } catch (err) {
      toast.error('Failed to load floor data');
    } finally {
      setLoading(false);
    }
  }, [eventId, subdomain]);

  useEffect(() => {
    load();
    // Auto-refresh every 30s
    refreshRef.current = setInterval(load, 30000);
    return () => clearInterval(refreshRef.current);
  }, [load]);

  const handleTableUpdate = async (tableId, stateUpdate) => {
    try {
      const res = await eventAPI.patch(`/${eid}/table-service/table/${tableId}`, stateUpdate);
      setFloorData(prev => ({
        ...prev,
        tableStates: prev.tableStates.some(s => s.tableId === tableId)
          ? prev.tableStates.map(s => s.tableId === tableId ? { ...s, ...res.data.tableState } : s)
          : [...prev.tableStates, res.data.tableState],
      }));
    } catch { toast.error('Failed to update table'); }
  };

  const handleAddToWaitlist = async (form) => {
    try {
      const res = await eventAPI.post(`/${eid}/table-service/waitlist`, form);
      setFloorData(prev => ({ ...prev, waitlist: [...(prev.waitlist || []), res.data.entry] }));
      toast.success(`${form.partyName} added to waitlist`);
    } catch { toast.error('Failed to add to waitlist'); }
  };

  const handleUpdateWaitlist = async (partyId, status) => {
    try {
      await eventAPI.patch(`/${eid}/table-service/waitlist/${partyId}`, { status });
      setFloorData(prev => ({
        ...prev,
        waitlist: (prev.waitlist || []).map(p => p.id === partyId ? { ...p, status } : p),
      }));
    } catch { toast.error('Failed to update waitlist'); }
  };

  const handleRemoveWaitlist = async (partyId) => {
    try {
      await eventAPI.delete(`/${eid}/table-service/waitlist/${partyId}`);
      setFloorData(prev => ({ ...prev, waitlist: (prev.waitlist || []).filter(p => p.id !== partyId) }));
    } catch { toast.error('Failed to remove from waitlist'); }
  };

  /** Auto-assign: seat a waitlist party at the given tableId */
  const handleAutoAssign = async (party, tableId) => {
    const tbl = objects.find(o => o.id === tableId);
    if (!tbl) return;

    setHighlightTableId(tableId);
    try {
      // 1. Seat the table
      await handleTableUpdate(tableId, {
        status:    'occupied',
        partyName: party.partyName,
        partySize: party.partySize,
        notes:     party.notes || '',
      });
      // 2. Remove from waitlist
      await handleUpdateWaitlist(party.id, 'seated');

      toast.success(`✓ ${party.partyName} (${party.partySize}) seated at ${tbl.label || tableId}`);
      setSelectedTableId(tableId);
    } catch {
      toast.error('Auto-assign failed — please try manually');
    } finally {
      setTimeout(() => setHighlightTableId(null), 3000);
    }
  };

  const handleSeatFromWaitlist = async (party, tableId) => {
    await handleAutoAssign(party, tableId);
  };

  const handleAddReservation = async (form) => {
    try {
      const res = await eventAPI.post(`/${eid}/table-service/reservations`, form);
      setFloorData(prev => ({ ...prev, reservations: [...(prev.reservations || []), res.data.reservation] }));
      toast.success('Reservation created');
    } catch { toast.error('Failed to create reservation'); }
  };

  const handleUpdateReservation = async (id, status) => {
    try {
      await eventAPI.patch(`/${eid}/table-service/reservations/${id}`, { status });
      setFloorData(prev => ({
        ...prev,
        reservations: ['seated', 'cancelled', 'no_show'].includes(status)
          ? prev.reservations.filter(r => r.id !== id)
          : prev.reservations.map(r => r.id === id ? { ...r, status } : r),
      }));
    } catch { toast.error('Failed to update reservation'); }
  };

  const handleSaveSettings = async (newSettings) => {
    try {
      await eventAPI.patch(`/${eid}/table-service/settings`, newSettings);
      setFloorData(prev => ({ ...prev, settings: { ...prev.settings, ...newSettings } }));
      toast.success('Settings saved');
    } catch { toast.error('Failed to save settings'); }
  };

  const handleSaveSeatingMap = async (newObjects) => {
    setSeatingIsSaving(true);
    try {
      await eventAPI.patch(`/${eid}/seating`, { objects: newObjects });
      setFloorData(prev => ({ ...prev, seatingMap: { ...prev.seatingMap, objects: newObjects } }));
      setShowFloorEditor(false);
      toast.success('Floor plan saved');
    } catch { toast.error('Failed to save floor plan'); }
    finally { setSeatingIsSaving(false); }
  };

  // "Auto-seat next" — find the next best unmatched party + table
  const handleAutoSeatNext = () => {
    const active = (floorData.waitlist || [])
      .filter(p => p.status === 'waiting' || p.status === 'notified')
      .sort((a, b) => new Date(a.addedAt) - new Date(b.addedAt));

    for (const party of active) {
      const tableId = findBestTable(party.partySize, objects, tableStates, settings);
      if (tableId) {
        handleAutoAssign(party, tableId);
        return;
      }
    }
    toast('No match found — all tables occupied or no suitable capacity', { icon: 'ℹ️' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-neutral-700 border-t-orange-400 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neutral-400 text-sm">Loading floor plan…</p>
        </div>
      </div>
    );
  }

  const activeWaitCount = (floorData.waitlist || []).filter(p => p.status === 'waiting' || p.status === 'notified').length;

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col" style={{ height: '100dvh' }}>

      {/* ── Top Bar ── */}
      <header className="flex-shrink-0 flex items-center gap-4 px-5 h-14 border-b border-neutral-800 bg-neutral-900/80 backdrop-blur-sm">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
            <Utensils className="w-4 h-4 text-orange-400" />
          </div>
          <div className="min-w-0">
            <div className="font-black text-white text-sm truncate">{settings.restaurantName || floorData.restaurantName || 'Floor Manager'}</div>
            <div className="text-xs text-neutral-500 flex items-center gap-2">
              <span className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {tableCounts.available} avail
              </span>
              <span>·</span>
              <span className="text-rose-400">{tableCounts.occupied} occupied</span>
              {activeWaitCount > 0 && <><span>·</span><span className="text-amber-400">{activeWaitCount} waiting</span></>}
            </div>
          </div>
        </div>

        <div className="flex-1" />

        {/* Quick stats bar */}
        <div className="hidden md:flex items-center gap-1">
          {Object.entries({ available: 'emerald', occupied: 'rose', reserved: 'amber', cleaning: 'violet' }).map(([k, c]) => (
            tableCounts[k] > 0 && (
              <div key={k} className={`px-2 py-1 rounded-lg bg-${c}-950/50 border border-${c}-800/40 text-xs font-bold text-${c}-400`}>
                {tableCounts[k]} {k}
              </div>
            )
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {activeWaitCount > 0 && (
            <button onClick={handleAutoSeatNext} title="Auto-seat next best waiting party"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs font-bold transition-colors">
              <Zap className="w-3.5 h-3.5" />Auto-seat next
            </button>
          )}
          <button onClick={() => load()} className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-500 hover:text-white transition-colors" title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => setShowFloorEditor(true)} className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-500 hover:text-white transition-colors" title="Edit floor plan">
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button onClick={() => setShowSettings(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs font-semibold transition-colors">
            <Settings className="w-3.5 h-3.5" />Settings
          </button>
        </div>
      </header>

      {/* ── Main layout ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Floor map area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 relative">
            {objects.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center p-8">
                <div>
                  <LayoutGrid className="w-12 h-12 text-neutral-700 mx-auto mb-4" />
                  <h3 className="text-white font-bold text-lg mb-2">No floor layout yet</h3>
                  <p className="text-neutral-500 text-sm mb-6">Set up your restaurant floor plan to start managing tables.</p>
                  <button onClick={() => setShowFloorEditor(true)} className="px-5 py-3 bg-white text-neutral-900 rounded-xl font-bold text-sm hover:bg-neutral-100">Set Up Floor Plan</button>
                </div>
              </div>
            ) : (
              <FloorMap
                objects={objects}
                tableStates={tableStates}
                selectedId={selectedTableId}
                highlightId={highlightTableId}
                onSelect={(id) => setSelectedTableId(prev => prev === id ? null : id)}
                zoom={zoom}
                onZoomChange={setZoom}
                pan={pan}
                onPanChange={setPan}
                settings={settings}
              />
            )}
          </div>

          {/* Table detail panel */}
          {selectedObj && (
            <div className="flex-shrink-0 border-t border-neutral-800" style={{ height: '48%', minHeight: 300 }}>
              <TablePanel
                obj={selectedObj}
                state={selectedState}
                settings={settings}
                onUpdate={handleTableUpdate}
                onClose={() => setSelectedTableId(null)}
                waitlist={floorData.waitlist || []}
                onSeatFromWaitlist={handleSeatFromWaitlist}
              />
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="w-80 xl:w-96 flex-shrink-0 border-l border-neutral-800 flex flex-col bg-neutral-900/50">
          <div className="flex border-b border-neutral-800 flex-shrink-0">
            {[
              { id: 'waitlist',     label: 'Waitlist',     badge: activeWaitCount },
              { id: 'reservations', label: 'Reservations', badge: (floorData.reservations || []).filter(r => { const d = new Date(r.dateTime); return d.toDateString() === new Date().toDateString() && r.status === 'confirmed'; }).length },
              { id: 'overview',     label: 'Overview',     badge: null },
            ].map(({ id, label, badge }) => (
              <button key={id} onClick={() => setSideTab(id)}
                className={`flex-1 py-3 text-xs font-semibold transition-all border-b-2 ${sideTab === id ? 'text-white border-white' : 'text-neutral-500 border-transparent hover:text-neutral-300'}`}>
                {label}
                {badge > 0 && <span className="ml-1 px-1.5 py-0.5 bg-neutral-700 rounded-full text-[10px] font-bold">{badge}</span>}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-hidden">
            {sideTab === 'waitlist' && (
              <WaitlistPanel
                waitlist={floorData.waitlist || []}
                tableStates={tableStates}
                objects={objects}
                settings={settings}
                onAdd={handleAddToWaitlist}
                onUpdate={handleUpdateWaitlist}
                onRemove={handleRemoveWaitlist}
                onAutoAssign={handleAutoAssign}
              />
            )}
            {sideTab === 'reservations' && (
              <ReservationsPanel
                reservations={floorData.reservations || []}
                onAdd={handleAddReservation}
                onUpdate={handleUpdateReservation}
                eventId={eid}
              />
            )}
            {sideTab === 'overview' && (
              <OverviewPanel
                objects={objects}
                tableStates={tableStates}
                waitlist={floorData.waitlist || []}
                settings={settings}
              />
            )}
          </div>
        </div>
      </div>

      {showSettings && (
        <SettingsModal settings={settings} onSave={handleSaveSettings} onClose={() => setShowSettings(false)} />
      )}

      {showFloorEditor && (
        <SeatingMap
          mode="editor"
          objects={objects}
          guestsByTable={{}}
          allGuests={[]}
          focusTableId={null}
          onSave={handleSaveSeatingMap}
          onClose={() => setShowFloorEditor(false)}
          isSaving={seatingIsSaving}
        />
      )}
    </div>
  );
}
