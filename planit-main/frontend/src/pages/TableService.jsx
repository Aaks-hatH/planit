/**
 * TableService.jsx — Restaurant & Venue Floor Management
 *
 * PlanIt Table Service Mode
 * Full real-time floor management: table states, waitlist, QR reservations, seating map editor.
 * Data persists indefinitely (keepForever = true on all Table Service events).
 *
 * Route: /e/:subdomain/floor  OR  /event/:eventId/floor
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Users, Clock, CheckCircle, XCircle, AlertTriangle, Settings, Plus,
  RefreshCw, QrCode, Trash2, Edit2, ChevronRight, Bell, MapPin,
  Coffee, Utensils, Star, LayoutGrid, List, X, Save, Check,
  ArrowRight, ArrowLeft, Phone, ScanLine, Calendar, Timer, Loader2, Lock,
  ExternalLink, UtensilsCrossed, CameraOff,
} from 'lucide-react';
import { eventAPI } from '../services/api';
import toast from 'react-hot-toast';
import SeatingMap from '../components/SeatingMap';

// ── Utilities ────────────────────────────────────────────────────────────────

const uid = () => `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

const STATUS_META = {
  available:   { label: 'Available',   color: '#22c55e', bg: 'bg-emerald-950/60', border: 'border-emerald-500/40', text: 'text-emerald-400', ring: '#22c55e' },
  occupied:    { label: 'Occupied',    color: '#ef4444', bg: 'bg-rose-950/60',    border: 'border-rose-500/40',    text: 'text-rose-400',    ring: '#ef4444' },
  reserved:    { label: 'Reserved',    color: '#f59e0b', bg: 'bg-amber-950/60',   border: 'border-amber-500/40',   text: 'text-amber-400',   ring: '#f59e0b' },
  cleaning:    { label: 'Cleaning',    color: '#8b5cf6', bg: 'bg-violet-950/60',  border: 'border-violet-500/40',  text: 'text-violet-400',  ring: '#8b5cf6' },
  unavailable: { label: 'Unavailable', color: '#525252', bg: 'bg-neutral-900',    border: 'border-neutral-700',    text: 'text-neutral-500', ring: '#525252' },
};

function fmtDuration(ms) {
  const m = Math.floor(ms / 60000);
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

function estimateRemaining(tableState, settings) {
  if (!tableState?.occupiedAt) return null;
  const seatedMs   = Date.now() - new Date(tableState.occupiedAt).getTime();
  const avgMs      = (settings?.avgDiningMinutes || 75) * 60000;
  const remaining  = avgMs - seatedMs;
  return Math.max(0, Math.round(remaining / 60000));
}

function estimateWaitMinutes(partySize, tableStates, objects, settings) {
  const tables = (objects || []).filter(o => o.type !== 'zone' && o.capacity >= partySize);
  if (!tables.length) return null;
  const availableNow = tables.some(t => {
    const s = (tableStates || []).find(st => st.tableId === t.id);
    return !s || s.status === 'available';
  });
  if (availableNow) return 0;
  const occupiedTimes = tables
    .map(t => (tableStates || []).find(s => s.tableId === t.id))
    .filter(s => s?.status === 'occupied' && s.occupiedAt)
    .map(s => estimateRemaining(s, settings))
    .filter(t => t !== null);
  if (!occupiedTimes.length) return null;
  return Math.min(...occupiedTimes) + (settings?.cleaningBufferMinutes || 10);
}

// ── Floor Map (SVG canvas) ────────────────────────────────────────────────────

function FloorMap({ objects, tableStates, selectedId, onSelect, zoom, onZoomChange, pan, onPanChange }) {
  const svgRef     = useRef(null);
  const dragging   = useRef(false);
  const moved      = useRef(false);
  const dragOrigin = useRef({ x: 0, y: 0, px: 0, py: 0 });

  const getState = (id) => tableStates?.find(s => s.tableId === id) || { status: 'available' };

  /* ── zoom ──────────────────────────────────────────────────────────────── */
  const onWheel = (e) => {
    e.preventDefault();
    onZoomChange(z => Math.max(0.3, Math.min(3, z + (e.deltaY > 0 ? -0.1 : 0.1))));
  };

  /* ── pan ───────────────────────────────────────────────────────────────── */
  const onDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current   = true;
    moved.current      = false;
    dragOrigin.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
  };
  const onMove = (e) => {
    if (!dragging.current) return;
    const dx = e.clientX - dragOrigin.current.x;
    const dy = e.clientY - dragOrigin.current.y;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) moved.current = true;
    onPanChange({ x: dragOrigin.current.px + dx, y: dragOrigin.current.py + dy });
  };
  const onUp = (e) => {
    const wasDrag = moved.current;
    dragging.current = false;
    moved.current    = false;
    if (wasDrag) return; // was a pan, not a tap

    // ── coordinate hit-test: find which table the user tapped ──────────────
    // Convert screen coords → SVG local coords (undo pan+zoom)
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const svgX = (e.clientX - rect.left - pan.x) / zoom;
    const svgY = (e.clientY - rect.top  - pan.y) / zoom;

    for (const obj of (objects || [])) {
      if (obj.type === 'zone') continue;
      const isRound = obj.type === 'round' || obj.type === 'vip';
      const w = (obj.width  || (isRound ? 80 : 120)) / 2 + 12; // half-width + tap padding
      const h = (obj.height || (isRound ? 80 : 60))  / 2 + 12;
      // translate to table-local space, accounting for rotation
      const dx = svgX - obj.x;
      const dy = svgY - obj.y;
      let lx = dx, ly = dy;
      if (obj.rotation) {
        const rad = -(obj.rotation * Math.PI) / 180;
        lx = dx * Math.cos(rad) - dy * Math.sin(rad);
        ly = dx * Math.sin(rad) + dy * Math.cos(rad);
      }
      const hit = isRound
        ? lx * lx + ly * ly <= w * w         // circle
        : Math.abs(lx) <= w && Math.abs(ly) <= h; // rect
      if (hit) { onSelect(obj.id); return; }
    }
  };

  /* ── table rendering (pure visuals — no event handlers needed) ─────────── */
  const renderTable = (obj) => {
    if (obj.type === 'zone') {
      const zw = obj.width || 200, zh = obj.height || 120;
      return (
        <g key={obj.id} transform={`translate(${obj.x - zw/2}, ${obj.y - zh/2})`}>
          <rect width={zw} height={zh} rx={8} fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.1)" strokeDasharray="6 4" />
          <text x={zw/2} y={zh/2} textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.3)" fontSize="14" fontWeight="600">{obj.label || 'Zone'}</text>
        </g>
      );
    }

    const state      = getState(obj.id);
    const sm         = STATUS_META[state.status] || STATUS_META.available;
    const isRound    = obj.type === 'round' || obj.type === 'vip';
    const w          = obj.width  || (isRound ? 80 : 120);
    const h          = obj.height || (isRound ? 80 : 60);
    const isSelected = selectedId === obj.id;
    const remaining  = state.status === 'occupied' ? estimateRemaining(state, {}) : null;

    return (
      <g key={obj.id} transform={`translate(${obj.x}, ${obj.y}) rotate(${obj.rotation || 0})`}
         style={{ cursor: 'pointer' }}>
        {isSelected && (isRound
          ? <circle cx={0} cy={0} r={w/2+8}  fill="none" stroke="white" strokeWidth={2} opacity={0.6} />
          : <rect x={-w/2-8} y={-h/2-8} width={w+16} height={h+16} rx={10} fill="none" stroke="white" strokeWidth={2} opacity={0.6} />
        )}
        {isRound
          ? <circle cx={0} cy={0} r={w/2+3}  fill="none" stroke={sm.color} strokeWidth={2.5} opacity={isSelected ? 1 : 0.7} />
          : <rect x={-w/2-3} y={-h/2-3} width={w+6} height={h+6} rx={9} fill="none" stroke={sm.color} strokeWidth={2.5} opacity={isSelected ? 1 : 0.7} />
        }
        {isRound
          ? <circle cx={0} cy={0} r={w/2} fill={`${sm.color}22`} />
          : <rect x={-w/2} y={-h/2} width={w} height={h} rx={6} fill={`${sm.color}22`} />
        }
        <text x={0} y={-4} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="11" fontWeight="700">{obj.label || `T${obj.id.slice(-3)}`}</text>
        <text x={0} y={10} textAnchor="middle" dominantBaseline="middle" fill={sm.color} fontSize="10" fontWeight="500">
          {state.status === 'occupied' ? `${state.partySize || '?'}/${obj.capacity}` : `cap ${obj.capacity}`}
        </text>
        {state.status === 'occupied' && remaining !== null && (
          <g transform={`translate(${w/2-4}, ${-h/2+4})`}>
            <rect x={-16} y={-8} width={32} height={16} rx={8} fill={remaining <= 10 ? '#ef4444' : '#1a1a1a'} />
            <text textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="9" fontWeight="700">{remaining <= 0 ? 'OVER' : `${remaining}m`}</text>
          </g>
        )}
        {state.status === 'reserved' && (
          <g transform={`translate(${w/2-4}, ${-h/2+4})`}>
            <rect x={-8} y={-8} width={16} height={16} rx={8} fill="#f59e0b" />
            <text textAnchor="middle" dominantBaseline="middle" fill="black" fontSize="10" fontWeight="800">R</text>
          </g>
        )}
      </g>
    );
  };

  return (
    <div className="relative w-full h-full bg-neutral-950 select-none" style={{ touchAction: 'none' }}>
      <svg
        ref={svgRef}
        className="w-full h-full"
        onWheel={onWheel}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={() => { dragging.current = false; moved.current = false; }}
        style={{ cursor: dragging.current ? 'grabbing' : 'grab', display: 'block' }}
      >
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {(objects || []).map(renderTable)}
        </g>
      </svg>

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1">
        <button onClick={() => onZoomChange(z => Math.min(3, z + 0.2))} className="w-8 h-8 bg-neutral-800 border border-neutral-700 text-white rounded-md flex items-center justify-center text-lg font-bold hover:bg-neutral-700 transition-colors">+</button>
        <button onClick={() => onZoomChange(1)} className="w-8 h-8 bg-neutral-800 border border-neutral-700 text-neutral-400 rounded-md flex items-center justify-center text-xs font-bold hover:bg-neutral-700 transition-colors">{Math.round(zoom * 100)}%</button>
        <button onClick={() => onZoomChange(z => Math.max(0.3, z - 0.2))} className="w-8 h-8 bg-neutral-800 border border-neutral-700 text-white rounded-md flex items-center justify-center text-lg font-bold hover:bg-neutral-700 transition-colors">−</button>
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

// ── Table Management Panel ─────────────────────────────────────────────────

function TablePanel({ obj, state, settings, servers, onUpdate, onClose }) {
  const [localState, setLocalState] = useState({ partyName: state?.partyName || '', partySize: state?.partySize || 1, serverName: state?.serverName || '', notes: state?.notes || '' });
  const [saving, setSaving] = useState(false);

  const handleStatusChange = async (status) => {
    setSaving(true);
    try { await onUpdate(obj.id, { status, ...localState }); } finally { setSaving(false); }
  };

  const handleSaveDetails = async () => {
    setSaving(true);
    try { await onUpdate(obj.id, { ...localState, status: state?.status || 'occupied' }); } finally { setSaving(false); }
  };

  const sm         = STATUS_META[state?.status || 'available'];
  const remaining  = state?.status === 'occupied' ? estimateRemaining(state, settings) : null;
  const occupiedMs = state?.occupiedAt ? Date.now() - new Date(state.occupiedAt).getTime() : null;

  return (
    <div className="flex flex-col h-full bg-neutral-900 border-t border-neutral-800">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
        <div>
          <div className="font-bold text-white text-base">{obj.label || `Table ${obj.id.slice(-3)}`}</div>
          <div className="text-xs text-neutral-500 mt-0.5">Capacity {obj.capacity} · {obj.type}</div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${sm.bg} ${sm.border} ${sm.text}`}>{sm.label}</span>
          <button onClick={onClose} className="p-1.5 hover:bg-neutral-800 rounded-lg text-neutral-500 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Timing (occupied) */}
        {state?.status === 'occupied' && occupiedMs !== null && (
          <div className={`grid grid-cols-2 gap-3 p-4 rounded-xl border ${remaining !== null && remaining <= 10 ? 'bg-rose-950/30 border-rose-800/40' : 'bg-neutral-800/60 border-neutral-700'}`}>
            <div>
              <div className="text-xs text-neutral-500 mb-1">Seated for</div>
              <div className="text-xl font-black text-white">{fmtDuration(occupiedMs)}</div>
            </div>
            <div>
              <div className="text-xs text-neutral-500 mb-1">Est. remaining</div>
              <div className={`text-xl font-black ${remaining !== null && remaining <= 10 ? 'text-rose-400' : 'text-white'}`}>
                {remaining !== null ? (remaining <= 0 ? 'Overdue' : `~${remaining}m`) : '—'}
              </div>
            </div>
          </div>
        )}

        {/* Party details */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-neutral-400 mb-1.5 uppercase tracking-wider">Party Name</label>
            <input
              type="text"
              value={localState.partyName}
              onChange={e => setLocalState(p => ({ ...p, partyName: e.target.value }))}
              placeholder="Smith party..."
              className="w-full bg-neutral-800 border border-neutral-700 text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-neutral-500 transition-colors"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-400 mb-1.5 uppercase tracking-wider">Guests</label>
              <input
                type="number"
                min="1"
                max={obj.capacity}
                value={localState.partySize}
                onChange={e => setLocalState(p => ({ ...p, partySize: parseInt(e.target.value) || 1 }))}
                className="w-full bg-neutral-800 border border-neutral-700 text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-neutral-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-400 mb-1.5 uppercase tracking-wider">Server</label>
              {servers && servers.length > 0 ? (
                <select
                  value={localState.serverName}
                  onChange={e => setLocalState(p => ({ ...p, serverName: e.target.value }))}
                  className="w-full bg-neutral-800 border border-neutral-700 text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-neutral-500 transition-colors"
                >
                  <option value="">-- Unassigned --</option>
                  {servers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              ) : (
                <input
                  type="text"
                  value={localState.serverName}
                  onChange={e => setLocalState(p => ({ ...p, serverName: e.target.value }))}
                  placeholder="Server name"
                  className="w-full bg-neutral-800 border border-neutral-700 text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-neutral-500 transition-colors"
                />
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-400 mb-1.5 uppercase tracking-wider">Notes</label>
            <textarea
              value={localState.notes}
              onChange={e => setLocalState(p => ({ ...p, notes: e.target.value }))}
              placeholder="Allergies, special requests..."
              rows={2}
              className="w-full bg-neutral-800 border border-neutral-700 text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-neutral-500 transition-colors resize-none"
            />
          </div>
          <button
            onClick={handleSaveDetails}
            disabled={saving}
            className="w-full py-2.5 bg-neutral-700 hover:bg-neutral-600 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save details
          </button>
        </div>

        {/* Status actions */}
        <div>
          <div className="text-xs font-semibold text-neutral-400 mb-3 uppercase tracking-wider">Change Status</div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { status: 'occupied',    label: 'Seat Party',      icon: Users },
              { status: 'available',   label: 'Mark Available',  icon: CheckCircle },
              { status: 'cleaning',    label: 'Mark Cleaning',   icon: RefreshCw },
              { status: 'reserved',    label: 'Mark Reserved',   icon: Calendar },
              { status: 'unavailable', label: 'Unavailable',     icon: XCircle },
            ].map(({ status, label, icon: Icon }) => {
              const m = STATUS_META[status];
              const isCurrent = (state?.status || 'available') === status;
              return (
                <button
                  key={status}
                  onClick={() => handleStatusChange(status)}
                  disabled={saving || isCurrent}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold border transition-all ${isCurrent ? `${m.bg} ${m.border} ${m.text} opacity-100` : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:bg-neutral-700 hover:text-white'}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Waitlist Panel ────────────────────────────────────────────────────────────

function WaitlistPanel({ waitlist, tableStates, objects, settings, onAdd, onUpdate, onRemove }) {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm]       = useState({ partyName: '', partySize: 2, phone: '', notes: '' });
  const [adding, setAdding]   = useState(false);

  const handleAdd = async () => {
    if (!form.partyName.trim()) { toast.error('Party name required'); return; }
    setAdding(true);
    try { await onAdd(form); setForm({ partyName: '', partySize: 2, phone: '', notes: '' }); setShowAdd(false); }
    finally { setAdding(false); }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-neutral-400" />
          <span className="font-semibold text-white text-sm">Waitlist</span>
          {waitlist.length > 0 && <span className="px-2 py-0.5 bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-bold rounded-full">{waitlist.length}</span>}
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-neutral-900 rounded-lg text-xs font-bold hover:bg-neutral-100 transition-colors">
          <Plus className="w-3.5 h-3.5" />Add party
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="p-4 border-b border-neutral-800 bg-neutral-950/50 space-y-3">
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
          <input type="tel" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
            placeholder="Phone (optional)" className="w-full bg-neutral-800 border border-neutral-700 text-white text-xs rounded-lg px-3 py-2 outline-none focus:border-neutral-500" />
          <div className="flex gap-2">
            <button onClick={() => setShowAdd(false)} className="flex-1 py-2 bg-neutral-800 text-neutral-400 rounded-lg text-xs font-semibold hover:bg-neutral-700">Cancel</button>
            <button onClick={handleAdd} disabled={adding} className="flex-1 py-2 bg-white text-neutral-900 rounded-lg text-xs font-bold hover:bg-neutral-100 flex items-center justify-center gap-1">
              {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Add to list'}
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {waitlist.length === 0 ? (
          <div className="text-center py-16 text-neutral-600">
            <Users className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No one waiting</p>
          </div>
        ) : (
          <div className="divide-y divide-neutral-800">
            {waitlist.map((party, idx) => {
              const estWait = estimateWaitMinutes(party.partySize, tableStates, objects, settings);
              return (
                <div key={party.id} className="p-4 hover:bg-neutral-800/30 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-xs font-bold text-neutral-300 flex-shrink-0">
                        {idx + 1}
                      </div>
                      <div>
                        <div className="font-semibold text-white text-sm">{party.partyName}</div>
                        <div className="text-xs text-neutral-500 flex items-center gap-2 mt-0.5">
                          <span className="flex items-center gap-1"><Users className="w-3 h-3" />{party.partySize}</span>
                          {party.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{party.phone}</span>}
                          <span><Clock className="w-3 h-3 inline mr-0.5" />waiting {fmtDuration(Date.now() - new Date(party.addedAt).getTime())}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {party.status === 'waiting' && (
                        <button onClick={() => onUpdate(party.id, 'notified')} title="Mark notified" className="p-1.5 hover:bg-amber-500/20 text-neutral-500 hover:text-amber-400 rounded-lg transition-colors"><Bell className="w-3.5 h-3.5" /></button>
                      )}
                      {party.status === 'notified' && (
                        <span className="text-xs text-amber-400 font-semibold px-2 py-0.5 bg-amber-500/10 rounded-full border border-amber-500/20">Notified</span>
                      )}
                      <button onClick={() => onUpdate(party.id, 'seated')} title="Mark seated" className="p-1.5 hover:bg-emerald-500/20 text-neutral-500 hover:text-emerald-400 rounded-lg transition-colors"><CheckCircle className="w-3.5 h-3.5" /></button>
                      <button onClick={() => onRemove(party.id)} title="Remove" className="p-1.5 hover:bg-rose-500/20 text-neutral-500 hover:text-rose-400 rounded-lg transition-colors"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                  {/* Est wait time */}
                  <div className={`mt-2 ml-10 text-xs font-semibold ${estWait === 0 ? 'text-emerald-400' : estWait === null ? 'text-neutral-600' : estWait <= 15 ? 'text-amber-400' : 'text-rose-400'}`}>
                    {estWait === 0 ? '✓ Table available now' : estWait === null ? 'No suitable table' : `Est. wait ~${estWait} min`}
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


// ── Seat Table Modal — shown after QR scan succeeds ──────────────────────────
// Lets the host pick the best available table for the scanned reservation.
function SeatTableModal({ reservation, objects, tableStates, settings, onConfirm, onClose }) {
  const [step, setStep]               = useState(1); // 1 = table, 2 = server
  const [selectedTableId, setSelectedTableId] = useState(null);
  const [selectedServer, setSelectedServer]   = useState('');

  const servers = settings?.servers || [];

  // Tables that fit the party, sorted by tightest fit first
  const suitableTables = (objects || [])
    .filter(o => o.type !== 'zone' && o.capacity >= reservation.partySize)
    .map(o => {
      const state = tableStates.find(s => s.tableId === o.id) || { status: 'available' };
      return { ...o, state };
    })
    .filter(t => t.state.status === 'available' || t.state.status === 'reserved')
    .sort((a, b) => a.capacity - b.capacity);

  // Auto-select the best fit
  useEffect(() => {
    if (suitableTables.length > 0 && !selectedTableId) {
      setSelectedTableId(suitableTables[0].id);
    }
  }, []);

  const selected = suitableTables.find(t => t.id === selectedTableId);

  const handleConfirm = () => {
    if (!selectedTableId) return;
    onConfirm(selectedTableId, selected, selectedServer || null);
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-md flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 flex-shrink-0">
          <div>
            <div className="font-bold text-white">Seat Party</div>
            <div className="text-xs text-neutral-500 mt-0.5">{reservation.partyName} · Party of {reservation.partySize}</div>
          </div>
          <div className="flex items-center gap-3">
            {/* Step pills */}
            <div className="flex items-center gap-1.5">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all ${step >= 1 ? 'bg-emerald-600 text-white' : 'bg-neutral-700 text-neutral-400'}`}>1</div>
              <div className="w-4 h-px bg-neutral-700" />
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all ${step >= 2 ? 'bg-emerald-600 text-white' : 'bg-neutral-700 text-neutral-400'}`}>2</div>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-neutral-800 rounded-lg text-neutral-500 hover:text-white"><X className="w-4 h-4" /></button>
          </div>
        </div>

        {/* Reservation summary strip */}
        <div className="px-5 pt-4 pb-2 flex-shrink-0">
          <div className="bg-neutral-800/60 border border-neutral-700 rounded-xl p-3 grid grid-cols-2 gap-2 text-xs">
            {[
              ['Name', reservation.partyName],
              ['Party', `${reservation.partySize} guests`],
              ['Time', fmtDateTime(reservation.dateTime)],
              ...(reservation.phone ? [['Phone', reservation.phone]] : []),
              ...(reservation.specialRequests ? [['Requests', reservation.specialRequests]] : []),
            ].map(([l, v]) => (
              <div key={l}><span className="text-neutral-500">{l}: </span><span className="text-white font-semibold">{v}</span></div>
            ))}
          </div>
        </div>

        {/* ── STEP 1: Table picker ── */}
        {step === 1 && (
          <div className="flex-1 overflow-y-auto px-5 pb-3">
            {suitableTables.length === 0 ? (
              <div className="text-center py-8 text-neutral-500 text-sm">
                No available tables fit a party of {reservation.partySize}.
              </div>
            ) : (
              <>
                <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2 mt-2">Choose a table</div>
                <div className="space-y-2">
                  {suitableTables.map(t => {
                    const isSelected = selectedTableId === t.id;
                    const fit = t.capacity - reservation.partySize;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setSelectedTableId(t.id)}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all ${isSelected ? 'bg-emerald-950/40 border-emerald-500/60' : 'bg-neutral-800/40 border-neutral-700 hover:border-neutral-500'}`}
                      >
                        <div>
                          <div className="font-bold text-white text-sm">{t.label || `Table ${t.id.slice(-3)}`}</div>
                          <div className="text-xs text-neutral-400 mt-0.5">Seats {t.capacity} · {t.type}</div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {fit === 0 && <span className="text-xs font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full">Perfect fit</span>}
                          {fit > 0  && <span className="text-xs font-semibold text-neutral-400">{fit} extra seat{fit > 1 ? 's' : ''}</span>}
                          {isSelected && <Check className="w-4 h-4 text-emerald-400" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── STEP 2: Server assignment ── */}
        {step === 2 && (
          <div className="flex-1 overflow-y-auto px-5 pb-3">
            <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3 mt-2">Assign a server <span className="font-normal text-neutral-600 normal-case">(optional)</span></div>

            {/* Seating at summary */}
            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-950/30 border border-emerald-700/30 rounded-xl mb-4 text-xs">
              <Check className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
              <span className="text-emerald-300 font-semibold">Seating at {selected?.label || `Table ${selectedTableId?.slice(-3)}`}</span>
            </div>

            {servers.length > 0 ? (
              <div className="space-y-2">
                {/* None option */}
                <button
                  onClick={() => setSelectedServer('')}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all ${selectedServer === '' ? 'bg-neutral-700/60 border-neutral-500' : 'bg-neutral-800/40 border-neutral-700 hover:border-neutral-500'}`}
                >
                  <span className="text-sm text-neutral-400 font-medium">No server assigned</span>
                  {selectedServer === '' && <Check className="w-4 h-4 text-neutral-400" />}
                </button>
                {servers.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedServer(s.name)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all ${selectedServer === s.name ? 'bg-blue-950/40 border-blue-500/60' : 'bg-neutral-800/40 border-neutral-700 hover:border-neutral-500'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-neutral-700 border border-neutral-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                        {s.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-semibold text-white text-sm">{s.name}</span>
                    </div>
                    {selectedServer === s.name && <Check className="w-4 h-4 text-blue-400" />}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-neutral-600 text-sm">
                <div className="text-2xl mb-2">👤</div>
                No servers on shift. Add servers in Settings → Servers.
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-4 border-t border-neutral-800 flex gap-3 flex-shrink-0">
          {step === 1 ? (
            <>
              <button onClick={onClose} className="flex-1 py-2.5 bg-neutral-800 text-neutral-400 rounded-xl text-sm font-semibold hover:bg-neutral-700">Cancel</button>
              <button
                onClick={() => setStep(2)}
                disabled={!selectedTableId}
                className="flex-1 py-2.5 bg-white text-neutral-900 rounded-xl text-sm font-bold hover:bg-neutral-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                Next: Assign Server →
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setStep(1)} className="flex-1 py-2.5 bg-neutral-800 text-neutral-400 rounded-xl text-sm font-semibold hover:bg-neutral-700">← Back</button>
              <button
                onClick={handleConfirm}
                className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 flex items-center justify-center gap-2"
              >
                <Users className="w-4 h-4" />
                Confirm Seating
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// QR Scanner Modal — fullscreen pattern, same as EnterpriseCheckin (proven working)
// Scans guest reservation QR, verifies with backend, offers Seat Party action.
// ---------------------------------------------------------------------------
function QRScannerModal({ eventId, objects, tableStates, settings, onClose, onResult, onSeatAtTable }) {
  const [scanResult, setScanResult]   = useState(null); // null | { ok, reservation?, message? }
  const [verifying, setVerifying]     = useState(false);
  const html5QrCodeRef  = useRef(null);
  const isMountedRef    = useRef(true);
  const isStoppingRef   = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    startScanner();
    return () => {
      isMountedRef.current = false;
      stopScanner();
    };
  }, []);

  const stopScanner = async () => {
    const scanner = html5QrCodeRef.current;
    if (!scanner || isStoppingRef.current) return;
    isStoppingRef.current = true;
    html5QrCodeRef.current = null;
    try {
      if (scanner.getState() === 2) await scanner.stop();
    } catch (_) {}
    finally { isStoppingRef.current = false; }
  };

  const startScanner = async () => {
    if (!isMountedRef.current) return;
    setScanResult(null);
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      if (!isMountedRef.current) return;

      const config = {
        fps: 15,
        qrbox: (viewW, viewH) => {
          const side = Math.floor(Math.min(viewW, viewH) * 0.75);
          return { width: side, height: side };
        },
        experimentalFeatures: { useBarCodeDetectorIfSupported: false },
      };

      const onDetected = async (raw) => {
        await stopScanner();
        if (!isMountedRef.current) return;
        setVerifying(true);
        try {
          const res = await eventAPI.verifyReservationQR(eventId, raw);
          setScanResult({ ok: true, reservation: res.data.reservation });
        } catch (e) {
          setScanResult({ ok: false, message: e?.response?.data?.error || 'Invalid or expired QR code.' });
        } finally {
          if (isMountedRef.current) setVerifying(false);
        }
      };

      // Try back camera first, fall back to front
      try {
        const scanner = new Html5Qrcode('ts-qr-reader');
        html5QrCodeRef.current = scanner;
        await scanner.start({ facingMode: { exact: 'environment' } }, config, onDetected, () => {});
      } catch (_) {
        if (!isMountedRef.current) return;
        try {
          const s2 = html5QrCodeRef.current;
          if (s2) { try { if (s2.getState() === 2) await s2.stop(); } catch (_) {} }
        } catch (_) {}
        const fallback = new Html5Qrcode('ts-qr-reader');
        html5QrCodeRef.current = fallback;
        await fallback.start({ facingMode: 'user' }, config, onDetected, () => {});
      }

    } catch (err) {
      if (!isMountedRef.current) return;
      let msg;
      if (err.name === 'NotAllowedError' || err.message?.includes('Permission'))
        msg = 'Camera permission denied. Allow camera access in your browser and try again.';
      else if (err.name === 'NotFoundError')
        msg = 'No camera found on this device.';
      else if (err.name === 'NotReadableError' || err.message?.includes('in use'))
        msg = 'Camera is in use by another app. Close it and retry.';
      else if (err.name === 'AbortError' || err.message?.includes('Timeout'))
        msg = 'Camera took too long to start. Close other apps and retry.';
      else
        msg = `Could not start camera: ${err.message || 'unknown error'}`;
      setScanResult({ ok: false, message: msg, isCameraError: true });
    }
  };

  const handleRetry = async () => {
    await stopScanner();
    setTimeout(() => { if (isMountedRef.current) startScanner(); }, 800);
  };

  const [showSeatModal, setShowSeatModal] = useState(false);

  const handleSeatConfirm = async (tableId, tableObj, serverName) => {
    if (!scanResult?.reservation) return;
    try {
      await eventAPI.updateTableReservation(eventId, scanResult.reservation.id, { status: 'seated' });
      await eventAPI.updateTableState(eventId, tableId, {
        status: 'occupied',
        partyName:  scanResult.reservation.partyName,
        partySize:  scanResult.reservation.partySize,
        notes:      scanResult.reservation.specialRequests || scanResult.reservation.notes || '',
        serverName: serverName || '',
        reservationId: scanResult.reservation.id,
      });
      const serverMsg = serverName ? ` · Server: ${serverName}` : '';
      toast.success(`${scanResult.reservation.partyName} seated at ${tableObj?.label || 'table'}${serverMsg}`);
      onResult?.();
      onSeatAtTable?.();
      onClose();
    } catch { toast.error('Failed to seat party'); }
  };

  const res = scanResult;

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 backdrop-blur-sm border-b border-white/10 flex-shrink-0">
        <button onClick={onClose} className="text-white flex items-center gap-2 hover:opacity-80 text-sm font-medium">
          <ArrowLeft className="w-4 h-4" />Back
        </button>
        <span className="text-white text-sm font-semibold">SCAN GUEST QR</span>
        <div className="w-16" />
      </div>

      {/* Body */}
      <div className="flex-1 relative flex items-center justify-center bg-black overflow-auto">

        {/* Camera error or result overlay */}
        {res ? (
          <div className="text-center text-white p-8 max-w-sm w-full mx-auto">
            {res.isCameraError ? (
              <>
                <CameraOff className="w-16 h-16 mx-auto mb-4 text-rose-400" />
                <p className="text-lg font-bold mb-2">Camera Error</p>
                <p className="text-sm text-neutral-300 mb-8">{res.message}</p>
                <div className="flex flex-col gap-3">
                  <button onClick={handleRetry} className="px-6 py-3 bg-white text-black rounded-xl font-semibold hover:bg-neutral-200">Retry Camera</button>
                  <button onClick={onClose} className="px-6 py-3 bg-neutral-700 text-white rounded-xl font-semibold hover:bg-neutral-600">Close</button>
                </div>
              </>
            ) : res.ok ? (
              <>
                <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-emerald-400" />
                </div>
                <p className="text-xl font-black mb-1">Valid Reservation</p>
                <p className="text-xs text-emerald-400 mb-6">QR code verified ✓</p>
                <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-4 mb-6 text-left space-y-2">
                  {[
                    ['Name',       res.reservation.partyName],
                    ['Party size', res.reservation.partySize],
                    ['Time',       fmtDateTime(res.reservation.dateTime)],
                    ...(res.reservation.notes ? [['Notes', res.reservation.notes]] : []),
                  ].map(([label, val]) => (
                    <div key={label} className="flex justify-between text-sm">
                      <span className="text-neutral-400">{label}</span>
                      <span className="text-white font-semibold text-right max-w-[60%]">{val}</span>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setShowSeatModal(true)} className="py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700">Choose Table</button>
                  <button onClick={onClose} className="py-3 bg-neutral-800 text-white rounded-xl font-semibold hover:bg-neutral-700">Close</button>
                </div>
                {showSeatModal && (
                  <SeatTableModal
                    reservation={res.reservation}
                    objects={objects}
                    tableStates={tableStates}
                    settings={settings}
                    onConfirm={handleSeatConfirm}
                    onClose={() => setShowSeatModal(false)}
                  />
                )}
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-rose-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <XCircle className="w-8 h-8 text-rose-400" />
                </div>
                <p className="text-xl font-black mb-1">Invalid QR Code</p>
                <p className="text-sm text-rose-400 mb-8">{res.message}</p>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={handleRetry} className="py-3 bg-neutral-800 text-white rounded-xl font-semibold hover:bg-neutral-700">Scan Again</button>
                  <button onClick={onClose} className="py-3 bg-neutral-700 text-white rounded-xl font-semibold hover:bg-neutral-600">Close</button>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="w-full max-w-md px-4">
            {verifying ? (
              <div className="text-center text-white py-12">
                <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-orange-400" />
                <p className="text-sm text-neutral-300">Verifying reservation…</p>
              </div>
            ) : (
              <>
                {/* QR reader div — html5-qrcode mounts video here. DO NOT REMOVE. */}
                <div id="ts-qr-reader" className="rounded-2xl overflow-hidden shadow-2xl" />
                <p className="text-white text-center mt-6 text-sm">Position QR code within the frame</p>
                <p className="text-neutral-400 text-center mt-2 text-xs">Scanning automatically when detected</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ReservationsPanel({ reservations, onAdd, onUpdate, onSeatManually, objects, tableStates, settings, eventId }) {
  const [showAdd, setShowAdd]   = useState(false);
  const [form, setForm]         = useState({ partyName: '', partySize: 2, phone: '', email: '', dateTime: '', notes: '' });
  const [adding, setAdding]     = useState(false);
  const [showQR, setShowQR]     = useState(null);   // reservation object
  const [seatTarget, setSeatTarget] = useState(null); // reservation to manually seat

  const handleAdd = async () => {
    if (!form.partyName.trim() || !form.dateTime) { toast.error('Party name and date/time required'); return; }
    setAdding(true);
    try { await onAdd(form); setForm({ partyName: '', partySize: 2, phone: '', email: '', dateTime: '', notes: '' }); setShowAdd(false); }
    finally { setAdding(false); }
  };

  const INACTIVE = new Set(['cancelled', 'seated', 'no_show']);
  const active = reservations.filter(r => !INACTIVE.has(r.status));

  const pending = active
    .filter(r => r.status === 'pending')
    .sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));

  const upcomingToday = active.filter(r => {
    const d = new Date(r.dateTime);
    return d.toDateString() === new Date().toDateString() && r.status !== 'pending';
  }).sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));

  const future = active.filter(r => {
    const d = new Date(r.dateTime);
    return d.toDateString() !== new Date().toDateString() && d > new Date() && r.status !== 'pending';
  }).sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));

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
          <div className="text-center text-xs text-neutral-600 mb-4">
            Valid until {fmtDateTime(showQR.qrExpiresAt)}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => { setSeatTarget(showQR); setShowQR(null); }} className="py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700">Choose Table</button>
            <button onClick={() => { onUpdate(showQR.id, 'no_show'); setShowQR(null); }} className="py-2 bg-neutral-800 text-neutral-400 rounded-lg text-xs font-semibold hover:bg-neutral-700">No Show</button>
          </div>
          <button onClick={() => setShowQR(null)} className="w-full mt-2 py-2 text-neutral-600 text-xs hover:text-neutral-400">Close</button>
        </div>
      </div>
    );
  };

  const ReservationRow = ({ r, isPending = false }) => (
    <div className={`flex items-center justify-between p-3 hover:bg-neutral-800/40 rounded-xl transition-colors gap-3 ${isPending ? 'border border-amber-500/20 bg-amber-950/10 mb-1' : ''}`}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <div className="font-semibold text-white text-sm truncate">{r.partyName}</div>
          {isPending && <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-500/20 border border-amber-500/30 text-amber-400 rounded-full flex-shrink-0">PENDING</span>}
        </div>
        <div className="text-xs text-neutral-500 flex items-center gap-2 mt-0.5">
          <span><Clock className="w-3 h-3 inline mr-0.5" />{fmtTime(r.dateTime)}</span>
          <span><Users className="w-3 h-3 inline mr-0.5" />{r.partySize}</span>
          {r.phone && <span><Phone className="w-3 h-3 inline mr-0.5" />{r.phone}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {isPending ? (
          <>
            <button onClick={() => onUpdate(r.id, 'confirmed')} title="Approve" className="p-1.5 hover:bg-emerald-500/20 text-neutral-500 hover:text-emerald-400 rounded-lg transition-colors"><CheckCircle className="w-3.5 h-3.5" /></button>
            <button onClick={() => onUpdate(r.id, 'cancelled')} title="Decline" className="p-1.5 hover:bg-rose-500/20 text-neutral-500 hover:text-rose-400 rounded-lg transition-colors"><X className="w-3.5 h-3.5" /></button>
          </>
        ) : (
          <>
            <button onClick={() => setShowQR(r)} title="Show QR" className="p-1.5 hover:bg-neutral-700 text-neutral-500 hover:text-white rounded-lg transition-colors"><QrCode className="w-3.5 h-3.5" /></button>
            <button onClick={() => setSeatTarget(r)} title="Seat party" className="p-1.5 hover:bg-emerald-500/20 text-neutral-500 hover:text-emerald-400 rounded-lg transition-colors"><CheckCircle className="w-3.5 h-3.5" /></button>
            <button onClick={() => onUpdate(r.id, 'cancelled')} title="Cancel" className="p-1.5 hover:bg-rose-500/20 text-neutral-500 hover:text-rose-400 rounded-lg transition-colors"><X className="w-3.5 h-3.5" /></button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <QRModal />
      {seatTarget && (
        <SeatTableModal
          reservation={seatTarget}
          objects={objects || []}
          tableStates={tableStates || []}
          settings={settings || {}}
          onConfirm={(tableId, tableObj, serverName) => {
            onSeatManually(seatTarget.id, tableId, tableObj, seatTarget, serverName);
            setSeatTarget(null);
          }}
          onClose={() => setSeatTarget(null)}
        />
      )}
      <div className="flex items-center justify-between p-4 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-neutral-400" />
          <span className="font-semibold text-white text-sm">Reservations</span>
          {upcomingToday.length > 0 && <span className="px-2 py-0.5 bg-blue-500/20 border border-blue-500/30 text-blue-400 text-xs font-bold rounded-full">{upcomingToday.length} today</span>}
        </div>
        <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-neutral-900 rounded-lg text-xs font-bold hover:bg-neutral-100 transition-colors">
          <Plus className="w-3.5 h-3.5" />New
        </button>
      </div>

      {showAdd && (
        <div className="p-4 border-b border-neutral-800 bg-neutral-950/50 space-y-3">
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
          <div className="flex gap-2">
            <button onClick={() => setShowAdd(false)} className="flex-1 py-2 bg-neutral-800 text-neutral-400 rounded-lg text-xs font-semibold hover:bg-neutral-700">Cancel</button>
            <button onClick={handleAdd} disabled={adding} className="flex-1 py-2 bg-white text-neutral-900 rounded-lg text-xs font-bold hover:bg-neutral-100 flex items-center justify-center gap-1">
              {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : <><QrCode className="w-3 h-3" />Create + QR</>}
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3">
        {pending.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2 px-1">
              <div className="text-xs font-bold text-amber-400 uppercase tracking-wider">Pending Approval</div>
              <span className="px-1.5 py-0.5 bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[10px] font-bold rounded-full">{pending.length}</span>
            </div>
            {pending.map(r => <ReservationRow key={r.id} r={r} isPending />)}
          </div>
        )}
        {upcomingToday.length > 0 && (
          <div className="mb-4">
            <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2 px-1">Today</div>
            {upcomingToday.map(r => <ReservationRow key={r.id} r={r} />)}
          </div>
        )}
        {future.length > 0 && (
          <div>
            <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2 px-1">Upcoming</div>
            {future.slice(0, 10).map(r => <ReservationRow key={r.id} r={r} />)}
          </div>
        )}
        {pending.length === 0 && upcomingToday.length === 0 && future.length === 0 && (
          <div className="text-center py-16 text-neutral-600">
            <Calendar className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No reservations</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Settings Modal (full) ──────────────────────────────────────────────────────

const DAY_LABELS = { mon:'Monday', tue:'Tuesday', wed:'Wednesday', thu:'Thursday', fri:'Friday', sat:'Saturday', sun:'Sunday' };
const DAY_KEYS_ORDERED = ['mon','tue','wed','thu','fri','sat','sun'];

function Toggle({ checked, onChange }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only peer" />
      <div className="w-9 h-5 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:bg-orange-500 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
    </label>
  );
}

function SettingsModal({ settings, reservationSettings, onSave, onSaveReserve, onClose, eventId, subdomain, isTableService = true }) {
  const [tab, setTab]       = useState('general');
  const [form, setForm]     = useState({ ...settings });
  const [staffList, setStaffList]       = useState([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffForm, setStaffForm]       = useState({ username: '', pin: '', confirmPin: '' });
  const [staffFormErr, setStaffFormErr] = useState('');
  const [staffAdding, setStaffAdding]   = useState(false);
  const [staffDeleting, setStaffDeleting] = useState(null);
  const [rForm, setRForm]   = useState({
    acceptingReservations:      reservationSettings?.acceptingReservations    ?? false,
    confirmationMode:           reservationSettings?.confirmationMode          || 'auto_confirm',
    heroImageUrl:               reservationSettings?.heroImageUrl              || '',
    logoUrl:                    reservationSettings?.logoUrl                   || '',
    accentColor:                reservationSettings?.accentColor               || '#f97316',
    backgroundStyle:            reservationSettings?.backgroundStyle           || 'dark',
    fontStyle:                  reservationSettings?.fontStyle                 || 'modern',
    headerTagline:              reservationSettings?.headerTagline             || '',
    announcementBannerEnabled:  reservationSettings?.announcementBannerEnabled ?? false,
    announcementBanner:         reservationSettings?.announcementBanner        || '',
    announcementBannerColor:    reservationSettings?.announcementBannerColor   || '#f59e0b',
    publicDescription:          reservationSettings?.publicDescription         || '',
    cuisine:                    reservationSettings?.cuisine                   || '',
    priceRange:                 reservationSettings?.priceRange                || '',
    dressCode:                  reservationSettings?.dressCode                 || '',
    parkingInfo:                reservationSettings?.parkingInfo               || '',
    accessibilityInfo:          reservationSettings?.accessibilityInfo         || '',
    address:                    reservationSettings?.address                   || '',
    phone:                      reservationSettings?.phone                     || '',
    websiteUrl:                 reservationSettings?.websiteUrl                || '',
    instagramHandle:            reservationSettings?.instagramHandle           || '',
    facebookUrl:                reservationSettings?.facebookUrl               || '',
    googleMapsUrl:              reservationSettings?.googleMapsUrl             || '',
    operatingDays:              reservationSettings?.operatingDays             || {},
    slotIntervalMinutes:        reservationSettings?.slotIntervalMinutes       || 30,
    maxAdvanceDays:             reservationSettings?.maxAdvanceDays            || 30,
    minAdvanceHours:            reservationSettings?.minAdvanceHours           || 1,
    cancelCutoffHours:          reservationSettings?.cancelCutoffHours         || 2,
    maxPartySizePublic:         reservationSettings?.maxPartySizePublic        || 12,
    minPartySizePublic:         reservationSettings?.minPartySizePublic        || 1,
    maxReservationsPerDay:      reservationSettings?.maxReservationsPerDay     || 0,
    maxReservationsPerSlot:     reservationSettings?.maxReservationsPerSlot    || 0,
    lastBookingBeforeCloseMinutes: reservationSettings?.lastBookingBeforeCloseMinutes || 30,
    requirePhone:               reservationSettings?.requirePhone              ?? true,
    requireEmail:               reservationSettings?.requireEmail              ?? false,
    allowSpecialRequests:       reservationSettings?.allowSpecialRequests      ?? true,
    allowDietaryNeeds:          reservationSettings?.allowDietaryNeeds         ?? true,
    allowOccasionSelect:        reservationSettings?.allowOccasionSelect       ?? true,
    occasionOptionsRaw:         (reservationSettings?.occasionOptions || ['Birthday','Anniversary','Business Dinner','Date Night','Family Gathering','Other']).join(', '),
    showLiveWaitTime:           reservationSettings?.showLiveWaitTime          ?? true,
    showAvailabilityStatus:     reservationSettings?.showAvailabilityStatus    ?? true,
    showTableCount:             reservationSettings?.showTableCount            ?? false,
    availabilityDisplayMode:    reservationSettings?.availabilityDisplayMode   || 'slots',
    confirmationMessage:        reservationSettings?.confirmationMessage       || '',
    cancellationPolicy:         reservationSettings?.cancellationPolicy        || '',
    depositRequired:            reservationSettings?.depositRequired           ?? false,
    depositAmount:              reservationSettings?.depositAmount             || 0,
    depositNote:                reservationSettings?.depositNote               || '',
    termsUrl:                   reservationSettings?.termsUrl                  || '',
    privacyUrl:                 reservationSettings?.privacyUrl                || '',
    metaTitle:                  reservationSettings?.metaTitle                 || '',
    metaDescription:            reservationSettings?.metaDescription           || '',
    showPoweredBy:              reservationSettings?.showPoweredBy             ?? true,
    faqItemsRaw:                JSON.stringify(reservationSettings?.faqItems || [], null, 2),
    blackoutDatesRaw:           (reservationSettings?.blackoutDates || []).map(b => b.date).join(', '),
  });
  const [saving, setSaving] = useState(false);
  const [serverList, setServerList] = useState(() => (settings?.servers || []));
  const [newServerName, setNewServerName] = useState('');

  const handleAddServer = () => {
    const name = newServerName.trim();
    if (!name) return;
    const id = Math.random().toString(36).slice(2, 10);
    setServerList(prev => [...prev, { id, name }]);
    setNewServerName('');
  };
  const handleRemoveServer = (id) => setServerList(prev => prev.filter(s => s.id !== id));


  const setF  = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value }));
  const setR  = (k) => (e) => setRForm(p => ({ ...p, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value }));
  const setRB = (k, v) => setRForm(p => ({ ...p, [k]: v }));
  const setDay = (day, field, val) => setRForm(p => ({ ...p, operatingDays: { ...(p.operatingDays || {}), [day]: { ...(p.operatingDays?.[day] || {}), [field]: val } } }));

  const inputCls = 'w-full bg-neutral-800 border border-neutral-700 text-white rounded-xl px-3 py-2.5 outline-none focus:border-orange-500/70 text-sm transition-colors';
  const labelCls = 'block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1.5';

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ ...form, servers: serverList });

      // Parse occasional options & blackout dates & FAQ
      const occasionOptions = rForm.occasionOptionsRaw.split(',').map(s => s.trim()).filter(Boolean);
      const blackoutDates   = rForm.blackoutDatesRaw.split(',').map(s => s.trim()).filter(s => /^\d{4}-\d{2}-\d{2}$/.test(s)).map(date => ({ date }));
      let faqItems = [];
      try { faqItems = JSON.parse(rForm.faqItemsRaw || '[]'); } catch (_) {}

      await onSaveReserve({ ...rForm, occasionOptions, blackoutDates, faqItems });
      onClose();
    } finally { setSaving(false); }
  };

  const ALL_TABS = [
    { id: 'general',   label: 'Floor' },
    { id: 'servers',   label: 'Servers',        tsOnly: true },
    { id: 'staff',     label: 'Staff',          tsOnly: true },
    { id: 'reserve',   label: 'Reserve Page',   tsOnly: true },
    { id: 'content',   label: 'Content',        tsOnly: true },
    { id: 'booking',   label: 'Booking Rules',  tsOnly: true },
  ];
  const TABS = ALL_TABS.filter(t => !t.tsOnly || isTableService);

  const SectionHead = ({ title, desc }) => (
    <div className="mb-4">
      <div className="text-sm font-bold text-white">{title}</div>
      {desc && <p className="text-xs text-neutral-500 mt-0.5">{desc}</p>}
    </div>
  );

  // ── Staff management ────────────────────────────────────────────────────
  useEffect(() => {
    if (tab !== 'staff' || !eventId) return;
    setStaffLoading(true);
    eventAPI.getStaff(eventId)
      .then(r => setStaffList(r.data.staff || []))
      .catch(() => toast.error('Failed to load staff'))
      .finally(() => setStaffLoading(false));
  }, [tab, eventId]);

  const handleAddStaff = async () => {
    setStaffFormErr('');
    const { username, pin, confirmPin } = staffForm;
    if (!username.trim()) { setStaffFormErr('Username is required'); return; }
    if (!pin)             { setStaffFormErr('PIN is required'); return; }
    if (!/^\d{4,8}$/.test(pin)) { setStaffFormErr('PIN must be 4–8 digits (numbers only)'); return; }
    if (pin !== confirmPin)     { setStaffFormErr('PINs do not match'); return; }
    setStaffAdding(true);
    try {
      await eventAPI.createStaff(eventId, { username: username.trim(), pin });
      const r = await eventAPI.getStaff(eventId);
      setStaffList(r.data.staff || []);
      setStaffForm({ username: '', pin: '', confirmPin: '' });
      toast.success(`Staff account "${username.trim()}" created`);
    } catch (err) {
      setStaffFormErr(err?.response?.data?.error || 'Failed to create staff account');
    } finally {
      setStaffAdding(false);
    }
  };

  const handleDeleteStaff = async (username) => {
    setStaffDeleting(username);
    try {
      await eventAPI.deleteStaff(eventId, username);
      setStaffList(p => p.filter(s => s.username !== username));
      toast.success(`Removed "${username}"`);
    } catch {
      toast.error('Failed to remove staff account');
    } finally {
      setStaffDeleting(null);
    }
  };

  const loginUrl = subdomain
    ? `${window.location.origin}/e/${subdomain}/login`
    : (eventId ? `${window.location.origin}/event/${eventId}/login` : '');

  const reserveUrl = subdomain ? `${window.location.origin}/e/${subdomain}/reserve` : '';

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-3" onClick={onClose}>
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-white">Settings</h2>
            <p className="text-xs text-neutral-500 mt-0.5">Floor operations & public reservation page</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-neutral-800 rounded-lg text-neutral-500 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-neutral-800 flex-shrink-0 px-4 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`py-3 px-3 text-xs font-bold whitespace-nowrap border-b-2 transition-all flex-shrink-0 ${tab === t.id ? 'text-white border-orange-500' : 'text-neutral-500 border-transparent hover:text-neutral-300'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* ── FLOOR TAB ── */}
          {tab === 'general' && (<>
            <div>
              <label className={labelCls}>Restaurant Name</label>
              <input type="text" value={form.restaurantName || ''} onChange={setF('restaurantName')} placeholder="Taverna Roma..." className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelCls}>Avg Dining Time (min)</label>
                <input type="number" min="10" max="300" value={form.avgDiningMinutes || 75} onChange={setF('avgDiningMinutes')} className={inputCls} /></div>
              <div><label className={labelCls}>Cleaning Buffer (min)</label>
                <input type="number" min="0" max="60" value={form.cleaningBufferMinutes || 10} onChange={setF('cleaningBufferMinutes')} className={inputCls} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelCls}>Reservation Duration (min)</label>
                <input type="number" min="30" max="300" value={form.reservationDurationMinutes || 90} onChange={setF('reservationDurationMinutes')} className={inputCls} /></div>
              <div><label className={labelCls}>QR Expiry (min after res.)</label>
                <input type="number" min="5" max="240" value={form.reservationQrExpiryMinutes || 45} onChange={setF('reservationQrExpiryMinutes')} className={inputCls} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelCls}>Opens</label><input type="time" value={form.operatingHoursOpen || '11:00'} onChange={setF('operatingHoursOpen')} className={inputCls} /></div>
              <div><label className={labelCls}>Closes</label><input type="time" value={form.operatingHoursClose || '22:00'} onChange={setF('operatingHoursClose')} className={inputCls} /></div>
            </div>
            <div><label className={labelCls}>Staff Welcome Message</label>
              <textarea value={form.welcomeMessage || ''} onChange={setF('welcomeMessage')} placeholder="Good evening — enjoy tonight's service." rows={2} className={inputCls + ' resize-none'} /></div>
          </>)}


          {/* ── SERVERS TAB ── */}
          {tab === 'servers' && (<>
            <SectionHead title="On-shift Servers" desc="Add the servers working today. Assign them to tables from the table panel." />
            <div className="space-y-2">
              {serverList.length === 0 ? (
                <div className="text-center py-8 text-neutral-600 text-sm">No servers added yet.</div>
              ) : serverList.map(s => (
                <div key={s.id} className="flex items-center justify-between bg-neutral-800/60 border border-neutral-700 rounded-xl px-4 py-2.5">
                  <span className="text-white text-sm font-semibold">{s.name}</span>
                  <button onClick={() => handleRemoveServer(s.id)} className="p-1.5 hover:bg-rose-500/20 text-neutral-500 hover:text-rose-400 rounded-lg transition-colors"><X className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                value={newServerName}
                onChange={e => setNewServerName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddServer()}
                placeholder="Server name"
                className={inputCls + ' flex-1'}
              />
              <button onClick={handleAddServer} className="px-4 py-2.5 bg-white text-neutral-900 rounded-xl text-sm font-bold hover:bg-neutral-100 flex items-center gap-1.5 flex-shrink-0">
                <Plus className="w-4 h-4" />Add
              </button>
            </div>
            {serverList.length > 0 && (
              <div className="mt-3 p-3 bg-neutral-800/40 border border-neutral-700 rounded-xl text-xs text-neutral-500">
                Share the server view with your team: <span className="text-neutral-300 font-mono">{subdomain ? `${window.location.origin}/e/${subdomain}/server` : (eventId ? `${window.location.origin}/event/${eventId}/server` : '')}</span>
              </div>
            )}
          </>)}

          {/* ── RESERVE PAGE TAB ── */}
          {tab === 'reserve' && (<>
            {/* Master toggle + link */}
            <div className="bg-neutral-800/60 border border-neutral-700 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-white">Accept Online Reservations</div>
                  <div className="text-xs text-neutral-500 mt-0.5">Turn this on to let guests book via your public page</div>
                </div>
                <Toggle checked={rForm.acceptingReservations} onChange={e => setRB('acceptingReservations', e.target.checked)} />
              </div>
              {reserveUrl && (
                <div className="mt-3 flex items-center gap-2 p-2 bg-neutral-900 rounded-lg">
                  <span className="text-xs text-neutral-500 truncate flex-1">{reserveUrl}</span>
                  <a href={reserveUrl} target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:text-orange-300 flex-shrink-0"><ExternalLink className="w-3.5 h-3.5" /></a>
                </div>
              )}
            </div>

            {/* Confirmation mode */}
            <div>
              <SectionHead title="Confirmation Mode" desc="How bookings are confirmed after a guest submits the form." />
              {[
                { id: 'auto_confirm', label: 'Instant Confirmation', desc: 'Reservation is confirmed immediately on submission.' },
                { id: 'manual',       label: 'Manual Approval',     desc: 'Reservation is pending until you approve it in the dashboard.' },
              ].map(opt => (
                <label key={opt.id} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all mb-2 ${rForm.confirmationMode === opt.id ? 'bg-orange-950/30 border-orange-600/50' : 'bg-neutral-800/40 border-neutral-700 hover:border-neutral-600'}`}>
                  <input type="radio" name="confirmMode" value={opt.id} checked={rForm.confirmationMode === opt.id} onChange={() => setRB('confirmationMode', opt.id)} className="mt-0.5 accent-orange-500" />
                  <div><div className="text-sm font-semibold text-white">{opt.label}</div>
                    <div className="text-xs text-neutral-500 mt-0.5">{opt.desc}</div></div>
                </label>
              ))}
            </div>

            {/* Appearance */}
            <div>
              <SectionHead title="Appearance" desc="Control how your public reservation page looks." />
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={labelCls}>Brand Color</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={rForm.accentColor} onChange={e => setRB('accentColor', e.target.value)} className="h-10 w-14 rounded-lg border border-neutral-700 bg-neutral-800 cursor-pointer" />
                      <input type="text" value={rForm.accentColor} onChange={setR('accentColor')} className={inputCls} placeholder="#f97316" />
                    </div>
                  </div>
                  <div><label className={labelCls}>Theme</label>
                    <select value={rForm.backgroundStyle} onChange={setR('backgroundStyle')} className={inputCls}>
                      <option value="dark">Dark</option>
                      <option value="light">Light</option>
                      <option value="auto">Auto (system)</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className={labelCls}>Logo URL</label>
                    <input type="url" value={rForm.logoUrl} onChange={setR('logoUrl')} placeholder="https://..." className={inputCls} /></div>
                  <div><label className={labelCls}>Hero Image URL</label>
                    <input type="url" value={rForm.heroImageUrl} onChange={setR('heroImageUrl')} placeholder="https://..." className={inputCls} /></div>
                </div>
                <div><label className={labelCls}>Tagline</label>
                  <input type="text" value={rForm.headerTagline} onChange={setR('headerTagline')} placeholder="Fine dining in the heart of the city..." className={inputCls} /></div>
                <div className="flex items-center justify-between p-3 bg-neutral-800/40 rounded-xl border border-neutral-700">
                  <div>
                    <div className="text-sm font-semibold text-white">Announcement Banner</div>
                    <div className="text-xs text-neutral-500">Show a coloured banner at the top of the page</div>
                  </div>
                  <Toggle checked={rForm.announcementBannerEnabled} onChange={e => setRB('announcementBannerEnabled', e.target.checked)} />
                </div>
                {rForm.announcementBannerEnabled && (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2"><label className={labelCls}>Banner Text</label>
                      <input type="text" value={rForm.announcementBanner} onChange={setR('announcementBanner')} placeholder="Closed Christmas Eve & Christmas Day" className={inputCls} /></div>
                    <div><label className={labelCls}>Banner Color</label>
                      <input type="color" value={rForm.announcementBannerColor} onChange={e => setRB('announcementBannerColor', e.target.value)} className="h-10 w-full rounded-xl border border-neutral-700 bg-neutral-800 cursor-pointer" /></div>
                  </div>
                )}
                <div className="flex items-center justify-between p-3 bg-neutral-800/40 rounded-xl border border-neutral-700">
                  <div><div className="text-sm font-semibold text-white">Show "Powered by PlanIt"</div></div>
                  <Toggle checked={rForm.showPoweredBy} onChange={e => setRB('showPoweredBy', e.target.checked)} />
                </div>
              </div>
            </div>

            {/* Per-day schedule */}
            <div>
              <SectionHead title="Weekly Schedule" desc="Override default hours per day or mark days as closed. Leave blank to use global hours." />
              <div className="space-y-2">
                {DAY_KEYS_ORDERED.map(day => {
                  const dc = rForm.operatingDays?.[day] || {};
                  return (
                    <div key={day} className="flex items-center gap-3 p-3 bg-neutral-800/40 border border-neutral-700 rounded-xl">
                      <div className="w-20 text-xs font-bold text-neutral-400">{DAY_LABELS[day]}</div>
                      <Toggle checked={dc.open !== false} onChange={e => setDay(day, 'open', e.target.checked)} />
                      {dc.open !== false && (<>
                        <input type="time" value={dc.openTime || ''} onChange={e => setDay(day, 'openTime', e.target.value)}
                          className="flex-1 bg-neutral-900 border border-neutral-700 text-white text-xs rounded-lg px-2 py-1.5 outline-none focus:border-orange-500/70" />
                        <span className="text-neutral-600 text-xs">–</span>
                        <input type="time" value={dc.closeTime || ''} onChange={e => setDay(day, 'closeTime', e.target.value)}
                          className="flex-1 bg-neutral-900 border border-neutral-700 text-white text-xs rounded-lg px-2 py-1.5 outline-none focus:border-orange-500/70" />
                      </>)}
                      {dc.open === false && <span className="text-xs text-rose-400 font-semibold">Closed</span>}
                    </div>
                  );
                })}
              </div>
              <div className="mt-3">
                <label className={labelCls}>Blackout Dates (comma-separated YYYY-MM-DD)</label>
                <input type="text" value={rForm.blackoutDatesRaw} onChange={setR('blackoutDatesRaw')}
                  placeholder="2025-12-24, 2025-12-25" className={inputCls} />
                <p className="text-xs text-neutral-600 mt-1">Dates where reservations are completely blocked.</p>
              </div>
            </div>

            {/* SEO */}
            <div>
              <SectionHead title="SEO / Meta" desc="Controls the browser tab title and description for search engines." />
              <div className="space-y-3">
                <div><label className={labelCls}>Meta Title</label>
                  <input type="text" value={rForm.metaTitle} onChange={setR('metaTitle')} placeholder="Reserve at Taverna Roma" className={inputCls} /></div>
                <div><label className={labelCls}>Meta Description</label>
                  <textarea value={rForm.metaDescription} onChange={setR('metaDescription')} rows={2} placeholder="Book a table at Taverna Roma..." className={inputCls + ' resize-none'} /></div>
              </div>
            </div>
          </>)}

          {/* ── CONTENT TAB ── */}
          {tab === 'content' && (<>
            <SectionHead title="Restaurant Information" desc="Shown on the public reservation page." />
            <div><label className={labelCls}>Public Description</label>
              <textarea value={rForm.publicDescription} onChange={setR('publicDescription')} rows={3} placeholder="A cozy neighbourhood bistro specialising in..." className={inputCls + ' resize-none'} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelCls}>Cuisine Type</label>
                <input type="text" value={rForm.cuisine} onChange={setR('cuisine')} placeholder="Italian, Modern European..." className={inputCls} /></div>
              <div><label className={labelCls}>Price Range</label>
                <select value={rForm.priceRange} onChange={setR('priceRange')} className={inputCls}>
                  <option value="">Not shown</option>
                  <option value="$">$ — Budget</option>
                  <option value="$$">$$ — Moderate</option>
                  <option value="$$$">$$$ — Upscale</option>
                  <option value="$$$$">$$$$ — Fine Dining</option>
                </select>
              </div>
            </div>
            <div><label className={labelCls}>Dress Code</label>
              <input type="text" value={rForm.dressCode} onChange={setR('dressCode')} placeholder="Smart casual, Black tie..." className={inputCls} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelCls}>Address</label>
                <input type="text" value={rForm.address} onChange={setR('address')} placeholder="123 Main St, New York" className={inputCls} /></div>
              <div><label className={labelCls}>Phone (public)</label>
                <input type="tel" value={rForm.phone} onChange={setR('phone')} placeholder="+1 212 555 0100" className={inputCls} /></div>
            </div>
            <div><label className={labelCls}>Parking Information</label>
              <textarea value={rForm.parkingInfo} onChange={setR('parkingInfo')} rows={2} placeholder="Valet available at the front entrance from 6pm..." className={inputCls + ' resize-none'} /></div>
            <div><label className={labelCls}>Accessibility Information</label>
              <textarea value={rForm.accessibilityInfo} onChange={setR('accessibilityInfo')} rows={2} placeholder="Wheelchair accessible entrance on Oak Street..." className={inputCls + ' resize-none'} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelCls}>Website URL</label>
                <input type="url" value={rForm.websiteUrl} onChange={setR('websiteUrl')} placeholder="https://..." className={inputCls} /></div>
              <div><label className={labelCls}>Instagram Handle</label>
                <input type="text" value={rForm.instagramHandle} onChange={setR('instagramHandle')} placeholder="tavernaroma" className={inputCls} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelCls}>Facebook URL</label>
                <input type="url" value={rForm.facebookUrl} onChange={setR('facebookUrl')} placeholder="https://..." className={inputCls} /></div>
              <div><label className={labelCls}>Google Maps URL</label>
                <input type="url" value={rForm.googleMapsUrl} onChange={setR('googleMapsUrl')} placeholder="https://maps.google.com/..." className={inputCls} /></div>
            </div>

            <div className="border-t border-neutral-800 pt-5">
              <SectionHead title="Cancellation Policy & Legal" />
              <div className="space-y-3">
                <div><label className={labelCls}>Cancellation Policy Text</label>
                  <textarea value={rForm.cancellationPolicy} onChange={setR('cancellationPolicy')} rows={3} placeholder="Cancellations must be made at least 24 hours in advance..." className={inputCls + ' resize-none'} /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><label className={labelCls}>Terms URL</label>
                    <input type="url" value={rForm.termsUrl} onChange={setR('termsUrl')} placeholder="https://..." className={inputCls} /></div>
                  <div><label className={labelCls}>Privacy URL</label>
                    <input type="url" value={rForm.privacyUrl} onChange={setR('privacyUrl')} placeholder="https://..." className={inputCls} /></div>
                </div>
                <div className="flex items-center justify-between p-3 bg-neutral-800/40 rounded-xl border border-neutral-700">
                  <div>
                    <div className="text-sm font-semibold text-white">Require Deposit</div>
                    <div className="text-xs text-neutral-500">Show a deposit notice on the booking form</div>
                  </div>
                  <Toggle checked={rForm.depositRequired} onChange={e => setRB('depositRequired', e.target.checked)} />
                </div>
                {rForm.depositRequired && (
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className={labelCls}>Deposit Amount ($)</label>
                      <input type="number" min="0" value={rForm.depositAmount} onChange={setR('depositAmount')} className={inputCls} /></div>
                    <div><label className={labelCls}>Deposit Note</label>
                      <input type="text" value={rForm.depositNote} onChange={setR('depositNote')} placeholder="Charged to card on booking..." className={inputCls} /></div>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-neutral-800 pt-5">
              <SectionHead title="Confirmation Message" desc="Shown on the booking confirmation screen after a guest books." />
              <textarea value={rForm.confirmationMessage} onChange={setR('confirmationMessage')} rows={3}
                placeholder="We look forward to seeing you! Please arrive 5 minutes early."
                className={inputCls + ' resize-none'} />
            </div>

            <div className="border-t border-neutral-800 pt-5">
              <SectionHead title='FAQ' desc='JSON array: [{"question":"Q?","answer":"A."}]. Leave empty for none.' />
              <textarea value={rForm.faqItemsRaw} onChange={setR('faqItemsRaw')} rows={6}
                placeholder={JSON.stringify([{ question: "Can I bring my own cake?", answer: "Yes, a plating fee of $5 applies." }], null, 2)}
                className={inputCls + ' resize-y font-mono text-xs'} />
            </div>
          </>)}

          {/* ── BOOKING RULES TAB ── */}
          {tab === 'booking' && (<>
            <SectionHead title="Party Size" />
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelCls}>Min Party Size</label>
                <input type="number" min="1" max="20" value={rForm.minPartySizePublic} onChange={setR('minPartySizePublic')} className={inputCls} /></div>
              <div><label className={labelCls}>Max Party Size (public)</label>
                <input type="number" min="1" max="100" value={rForm.maxPartySizePublic} onChange={setR('maxPartySizePublic')} className={inputCls} />
                <p className="text-xs text-neutral-600 mt-1">Larger groups must call.</p></div>
            </div>

            <SectionHead title="Booking Window" />
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelCls}>Book Up To (days ahead)</label>
                <input type="number" min="1" max="365" value={rForm.maxAdvanceDays} onChange={setR('maxAdvanceDays')} className={inputCls} /></div>
              <div><label className={labelCls}>Min Notice (hours before)</label>
                <input type="number" min="0" max="72" value={rForm.minAdvanceHours} onChange={setR('minAdvanceHours')} className={inputCls} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelCls}>Time Slot Interval (min)</label>
                <select value={rForm.slotIntervalMinutes} onChange={setR('slotIntervalMinutes')} className={inputCls}>
                  <option value="15">15 min</option>
                  <option value="30">30 min</option>
                  <option value="60">60 min</option>
                  <option value="90">90 min</option>
                  <option value="120">120 min</option>
                </select>
              </div>
              <div><label className={labelCls}>Stop Bookings Before Close (min)</label>
                <input type="number" min="0" max="120" value={rForm.lastBookingBeforeCloseMinutes} onChange={setR('lastBookingBeforeCloseMinutes')} className={inputCls} /></div>
            </div>

            <SectionHead title="Capacity Caps" />
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelCls}>Max Reservations / Day</label>
                <input type="number" min="0" value={rForm.maxReservationsPerDay} onChange={setR('maxReservationsPerDay')} className={inputCls} />
                <p className="text-xs text-neutral-600 mt-1">0 = no cap</p></div>
              <div><label className={labelCls}>Max Reservations / Slot</label>
                <input type="number" min="0" value={rForm.maxReservationsPerSlot} onChange={setR('maxReservationsPerSlot')} className={inputCls} />
                <p className="text-xs text-neutral-600 mt-1">0 = no cap</p></div>
            </div>

            <SectionHead title="Self-Cancellation" />
            <div><label className={labelCls}>Cancel Cutoff (hours before res.)</label>
              <input type="number" min="0" max="168" value={rForm.cancelCutoffHours} onChange={setR('cancelCutoffHours')} className={inputCls} />
              <p className="text-xs text-neutral-600 mt-1">Guests can self-cancel up to this many hours before their booking.</p></div>

            <SectionHead title="Required Guest Fields" />
            <div className="space-y-2">
              {[
                { key: 'requirePhone',         label: 'Require Phone Number' },
                { key: 'requireEmail',         label: 'Require Email Address' },
                { key: 'allowSpecialRequests', label: 'Show Special Requests Field' },
                { key: 'allowDietaryNeeds',    label: 'Show Dietary Needs Field' },
                { key: 'allowOccasionSelect',  label: 'Show Occasion Dropdown' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between p-3 bg-neutral-800/40 rounded-xl border border-neutral-700">
                  <span className="text-sm font-semibold text-white">{label}</span>
                  <Toggle checked={rForm[key]} onChange={e => setRB(key, e.target.checked)} />
                </div>
              ))}
            </div>
            {rForm.allowOccasionSelect && (
              <div><label className={labelCls}>Occasion Options (comma-separated)</label>
                <input type="text" value={rForm.occasionOptionsRaw} onChange={setR('occasionOptionsRaw')}
                  placeholder="Birthday, Anniversary, Business Dinner..." className={inputCls} /></div>
            )}

            <SectionHead title="Availability Display" />
            <div className="space-y-2">
              {[
                { key: 'showLiveWaitTime',      label: 'Show Live Walk-in Wait Times' },
                { key: 'showAvailabilityStatus', label: 'Show Slot Status (Available / Limited / Full)' },
                { key: 'showTableCount',         label: 'Show Exact Available Table Count' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between p-3 bg-neutral-800/40 rounded-xl border border-neutral-700">
                  <span className="text-sm font-semibold text-white">{label}</span>
                  <Toggle checked={rForm[key]} onChange={e => setRB(key, e.target.checked)} />
                </div>
              ))}
            </div>
          </>)}

          {tab === 'staff' && (<>
            {/* Staff login URL */}
            <div className="p-3 bg-neutral-800/60 border border-neutral-700 rounded-xl mb-2">
              <p className="text-xs font-semibold text-neutral-400 uppercase tracking-wide mb-1">Staff Login URL</p>
              <div className="flex items-center gap-2">
                <code className="text-xs text-orange-300 flex-1 truncate">{loginUrl}</code>
                <button onClick={() => { navigator.clipboard.writeText(loginUrl); toast.success('Copied!'); }}
                  className="text-xs px-2 py-1 bg-neutral-700 hover:bg-neutral-600 text-neutral-300 rounded-lg font-semibold flex-shrink-0">Copy</button>
              </div>
              <p className="text-xs text-neutral-600 mt-1.5">Share this link with staff. They log in with their username and PIN.</p>
            </div>

            {/* Existing staff list */}
            <SectionHead title="Staff Accounts" desc="Staff can log in to the floor dashboard using their username and PIN." />
            {staffLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-neutral-500" /></div>
            ) : staffList.length === 0 ? (
              <p className="text-sm text-neutral-600 text-center py-4">No staff accounts yet</p>
            ) : (
              <div className="space-y-1.5 mb-4">
                {staffList.map(s => (
                  <div key={s.username} className="flex items-center justify-between p-3 bg-neutral-800/40 border border-neutral-700 rounded-xl">
                    <div>
                      <p className="text-sm font-semibold text-white">{s.username}</p>
                      <p className="text-xs text-neutral-500">
                        {s.lastSeenAt ? `Last seen ${new Date(s.lastSeenAt).toLocaleDateString()}` : 'Never logged in'}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteStaff(s.username)}
                      disabled={staffDeleting === s.username}
                      className="p-1.5 hover:bg-rose-500/20 text-neutral-500 hover:text-rose-400 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {staffDeleting === s.username
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add new staff */}
            <div className="border-t border-neutral-800 pt-4">
              <SectionHead title="Add Staff Account" />
              <div className="space-y-3">
                <div>
                  <label className={labelCls}>Username</label>
                  <input value={staffForm.username} onChange={e => setStaffForm(p => ({ ...p, username: e.target.value }))}
                    placeholder="e.g. john, server1" className={inputCls} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>PIN (4–8 digits)</label>
                    <input type="password" inputMode="numeric" value={staffForm.pin}
                      onChange={e => setStaffForm(p => ({ ...p, pin: e.target.value }))}
                      placeholder="••••" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Confirm PIN</label>
                    <input type="password" inputMode="numeric" value={staffForm.confirmPin}
                      onChange={e => setStaffForm(p => ({ ...p, confirmPin: e.target.value }))}
                      placeholder="••••" className={inputCls} />
                  </div>
                </div>
                {staffFormErr && (
                  <p className="text-xs text-rose-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />{staffFormErr}
                  </p>
                )}
                <button onClick={handleAddStaff} disabled={staffAdding}
                  className="w-full py-2.5 bg-white text-neutral-900 rounded-xl text-sm font-bold hover:bg-neutral-100 disabled:opacity-50 flex items-center justify-center gap-2">
                  {staffAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" />Add Staff Account</>}
                </button>
              </div>
            </div>
          </>)}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-neutral-800 flex gap-3 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 bg-neutral-800 text-neutral-400 rounded-xl text-sm font-semibold hover:bg-neutral-700">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 bg-white text-neutral-900 rounded-xl text-sm font-bold hover:bg-neutral-100 flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" />Save All Settings</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function TableService() {
  const { eventId: eventIdParam, subdomain } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading]           = useState(true);
  const [resolvedEventId, setResolvedEventId] = useState(eventIdParam || null);
  const [floorData, setFloorData]       = useState({ seatingMap: { objects: [] }, tableStates: [], settings: {}, reservations: [], waitlist: [], restaurantName: '', isTableServiceMode: false, isEnterpriseMode: false });
  const [selectedTableId, setSelectedTableId] = useState(null);
  const [sideTab, setSideTab]           = useState('waitlist');
  const [showSettings, setShowSettings] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [reservationSettings, setReservationSettings] = useState({});
  const [showFloorEditor, setShowFloorEditor] = useState(false);
  const [seatingData, setSeatingData]   = useState(null);
  const [seatingIsSaving, setSeatingIsSaving] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan,  setPan]  = useState({ x: 0, y: 0 });

  // Resolve subdomain → eventId when routed via /e/:subdomain/floor
  useEffect(() => {
    if (!eventIdParam && subdomain) {
      eventAPI.getBySubdomain(subdomain)
        .then(res => {
          const ev = res.data.event || res.data;
          setResolvedEventId(ev._id || ev.id);
        })
        .catch(() => toast.error('Event not found'));
    }
  }, [eventIdParam, subdomain]);

  // Derived
  const eid = resolvedEventId; // for API calls
  const objects    = floorData.seatingMap?.objects || [];
  const tables     = objects.filter(o => o.type !== 'zone');
  const tableStates = floorData.tableStates || [];
  const settings   = floorData.settings || {};
  const isTableService = !!floorData.isTableServiceMode;
  const isEnterprise   = !!floorData.isEnterpriseMode;

  const tableCounts = {
    available: tables.filter(t => { const s = tableStates.find(x => x.tableId === t.id); return !s || s.status === 'available'; }).length,
    occupied:  tables.filter(t => tableStates.find(x => x.tableId === t.id)?.status === 'occupied').length,
    reserved:  tables.filter(t => tableStates.find(x => x.tableId === t.id)?.status === 'reserved').length,
    cleaning:  tables.filter(t => tableStates.find(x => x.tableId === t.id)?.status === 'cleaning').length,
  };

  const selectedObj   = objects.find(o => o.id === selectedTableId) || null;
  const selectedState = tableStates.find(s => s.tableId === selectedTableId) || null;

  const loadFloor = useCallback(async () => {
    if (!eid) return;
    try {
      const res = await eventAPI.getTableServiceFloor(eid);
      setFloorData(res.data);
      setReservationSettings(res.data.reservationPageSettings || {});
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401 || status === 403) {
        localStorage.removeItem('eventToken');
        localStorage.removeItem('username');
        navigate(subdomain ? `/e/${subdomain}/login` : `/event/${eid}/login`);
      } else if (status === 404) {
        const errData = err?.response?.data || {};
        setFloorData(prev => ({
          ...prev,
          _forbidden: true,
          _forbiddenIsEnterprise: !!errData.isEnterpriseMode,
          _forbiddenTitle: errData.eventTitle || '',
          _notFound: true,
        }));
      } else {
        toast.error('Could not load floor data');
      }
    } finally {
      setLoading(false);
    }
  }, [eid, navigate, subdomain]);

  useEffect(() => {
    if (!eid) return;
    loadFloor();
    // Auto-refresh every 30 seconds — paused while floor editor is open
    // to prevent unsaved layout changes from being wiped by a re-fetch
    const interval = setInterval(() => {
      if (!showFloorEditor) loadFloor();
    }, 30000);
    return () => clearInterval(interval);
  }, [loadFloor, eid, showFloorEditor]);

  // Centre the floor on load when objects available
  useEffect(() => {
    if (objects.length > 0 && zoom === 1 && pan.x === 0 && pan.y === 0) {
      setPan({ x: 20, y: 20 });
    }
  }, [objects.length]);

  const handleTableUpdate = async (tableId, updates) => {
    try {
      const res = await eventAPI.updateTableState(eid, tableId, updates);
      setFloorData(prev => {
        const next = { ...prev };
        const idx  = next.tableStates.findIndex(s => s.tableId === tableId);
        if (idx >= 0) next.tableStates[idx] = res.data.tableState;
        else next.tableStates = [...next.tableStates, res.data.tableState];
        return { ...next, tableStates: [...next.tableStates] };
      });
      toast.success(`Table updated`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update table');
    }
  };

  const handleAddToWaitlist = async (form) => {
    const res = await eventAPI.addToTableWaitlist(eid, form);
    setFloorData(prev => ({ ...prev, waitlist: [...prev.waitlist, res.data.entry] }));
    toast.success('Added to waitlist');
  };

  const handleUpdateWaitlist = async (partyId, status) => {
    await eventAPI.updateTableWaitlist(eid, partyId, status);
    setFloorData(prev => ({
      ...prev,
      waitlist: status === 'seated' || status === 'left'
        ? prev.waitlist.filter(w => w.id !== partyId)
        : prev.waitlist.map(w => w.id === partyId ? { ...w, status } : w)
    }));
    if (status === 'seated') toast.success('Party seated');
  };

  const handleRemoveWaitlist = async (partyId) => {
    await eventAPI.removeFromTableWaitlist(eid, partyId);
    setFloorData(prev => ({ ...prev, waitlist: prev.waitlist.filter(w => w.id !== partyId) }));
  };

  const handleAddReservation = async (form) => {
    const res = await eventAPI.createTableReservation(eid, form);
    setFloorData(prev => ({ ...prev, reservations: [...prev.reservations, res.data.reservation] }));
    toast.success('Reservation created');
  };

  const handleUpdateReservation = async (id, status) => {
    await eventAPI.updateTableReservation(eid, id, { status });
    setFloorData(prev => ({
      ...prev,
      reservations: status === 'cancelled' || status === 'seated'
        ? prev.reservations.filter(r => r.id !== id)
        : prev.reservations.map(r => r.id === id ? { ...r, status } : r)
    }));
    if (status === 'cancelled') toast.success('Reservation cancelled');
  };

  // Compound seat: marks reservation as seated AND occupies the chosen table
  const handleSeatManually = async (reservationId, tableId, tableObj, reservation, serverName) => {
    try {
      await eventAPI.updateTableReservation(eid, reservationId, { status: 'seated' });
      await eventAPI.updateTableState(eid, tableId, {
        status:    'occupied',
        partyName: reservation.partyName,
        partySize: reservation.partySize,
        notes:     reservation.specialRequests || reservation.notes || '',
        serverName: serverName || '',
        reservationId,
      });
      setFloorData(prev => ({
        ...prev,
        reservations: prev.reservations.filter(r => r.id !== reservationId),
      }));
      const serverMsg = serverName ? ` · Server: ${serverName}` : '';
      toast.success(`${reservation.partyName} seated at ${tableObj?.label || 'table'}${serverMsg}`);
      loadFloor();
    } catch {
      toast.error('Failed to seat party');
    }
  };

  const handleSaveSettings = async (form) => {
    const res = await eventAPI.updateTableServiceSettings(eid, form);
    setFloorData(prev => ({ ...prev, settings: res.data.settings, restaurantName: res.data.settings.restaurantName || prev.restaurantName }));
    toast.success('Settings saved');
  };

  const handleSaveReservationSettings = async (form) => {
    try {
      const res = await eventAPI.updateReservationPageSettings(eid, form);
      setReservationSettings(res.data.settings || res.data.reservationPageSettings || form);
      toast.success('Reservation settings saved');
    } catch {
      toast.error('Failed to save reservation settings');
    }
  };

  const handleSaveSeatingMap = async (newObjects, { silent = false } = {}) => {
    setSeatingIsSaving(true);
    try {
      const enabled = newObjects.length > 0;
      await eventAPI.saveSeatingMap(eid, { enabled, objects: newObjects });
      setFloorData(prev => ({
        ...prev,
        seatingMap: { ...prev.seatingMap, enabled, objects: newObjects },
      }));
      if (!silent) {
        setShowFloorEditor(false);
        toast.success('Floor layout saved');
      }
    } catch {
      if (!silent) toast.error('Failed to save layout');
    } finally {
      setSeatingIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-screen bg-neutral-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-neutral-400 mx-auto mb-4" />
          <p className="text-neutral-500 text-sm">Loading floor plan...</p>
        </div>
      </div>
    );
  }

  if (floorData._forbidden) {
    const isEnterprise = floorData._forbiddenIsEnterprise;
    const isNotFound   = floorData._notFound;
    const title        = floorData._forbiddenTitle;
    return (
      <div className="h-screen bg-neutral-950 flex items-center justify-center p-6">
        <div className="text-center max-w-md w-full">
          <div className="w-16 h-16 bg-neutral-900 border border-neutral-800 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <Lock className="w-7 h-7 text-neutral-500" />
          </div>
          <h2 className="text-white font-bold text-xl mb-2">
            {isNotFound ? 'Event Not Found' : isEnterprise ? 'Enterprise Event' : 'Floor Plan Unavailable'}
          </h2>
          {title && <p className="text-neutral-400 text-sm mb-1 font-medium">{title}</p>}
          <p className="text-neutral-500 text-sm mb-6 leading-relaxed">
            {isNotFound
              ? 'No event was found with this ID. Check the URL or contact your manager.'
              : isEnterprise
              ? 'This is an enterprise event. The seating map is managed through the Check-In dashboard, not the Table Service floor.'
              : 'This event does not have Table Service mode enabled. The /floor route is only available for Table Service venues.'}
          </p>
          <div className="space-y-2">
            {isEnterprise && (eid || subdomain) && (
              <button
                onClick={() => navigate(eid ? `/event/${eid}/checkin` : `/e/${subdomain}/checkin`)}
                className="w-full py-2.5 bg-white text-neutral-900 rounded-xl text-sm font-bold hover:bg-neutral-100 transition-colors"
              >
                Go to Check-In Dashboard →
              </button>
            )}
            <button
              onClick={() => navigate('/')}
              className="w-full py-2.5 bg-neutral-800 text-neutral-300 rounded-xl text-sm font-semibold hover:bg-neutral-700 transition-colors"
            >
              Return Home
            </button>
          </div>
          <div className="mt-6 p-3 bg-neutral-900 border border-neutral-800 rounded-xl text-left">
            <p className="text-xs text-neutral-500 font-semibold uppercase tracking-wide mb-2">Access Requirements</p>
            <ul className="text-xs text-neutral-500 space-y-1">
              <li>• Event must have Table Service mode enabled</li>
              <li>• Valid organizer or staff token required</li>
              <li>• Enterprise events → use <code className="text-neutral-400">/checkin</code> instead</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }  return (
    <div className="h-screen flex flex-col bg-neutral-950 text-white overflow-hidden">
      {/* ── Header ── */}
      <header className="flex-shrink-0 h-14 border-b border-neutral-800 bg-neutral-900/80 flex items-center px-4 gap-4">
        {/* Logo + name */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
            <Utensils className="w-4 h-4 text-neutral-900" />
          </div>
          <div className="min-w-0">
            <span className="font-bold text-white text-sm truncate">{floorData.restaurantName || 'Table Service'}</span>
            <span className="hidden sm:inline text-neutral-600 text-xs ml-2">Table Service</span>
          </div>
        </div>

        {/* Stats pills */}
        <div className="flex items-center gap-2 flex-1 overflow-x-auto scrollbar-hide">
          {Object.entries(tableCounts).map(([k, v]) => (
            <div key={k} className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${STATUS_META[k]?.bg} ${STATUS_META[k]?.border} ${STATUS_META[k]?.text}`}>
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: STATUS_META[k]?.color }} />
              {v} {STATUS_META[k]?.label}
            </div>
          ))}
          {floorData.waitlist?.length > 0 && (
            <div className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-amber-500/30 bg-amber-950/30 text-amber-400 text-xs font-semibold">
              <Users className="w-3 h-3" />
              {floorData.waitlist.length} waiting
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={loadFloor} title="Refresh" className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-500 hover:text-white transition-colors"><RefreshCw className="w-4 h-4" /></button>
          {isTableService && (subdomain || eid) && (
            <a
              href={subdomain ? `/e/${subdomain}/server` : `/event/${eid}/server`}
              target="_blank" rel="noopener noreferrer"
              title="Server View"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 border border-neutral-700 text-neutral-300 rounded-lg text-xs font-semibold hover:bg-neutral-700 transition-colors"
            >
              <Users className="w-3.5 h-3.5" />Servers
            </a>
          )}
          <button onClick={() => setShowQRScanner(true)} title="Scan Guest QR" className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/20 border border-orange-500/40 text-orange-400 rounded-lg text-xs font-semibold hover:bg-orange-500/30 transition-colors">
            <ScanLine className="w-3.5 h-3.5" />Scan QR
          </button>
          <button onClick={() => setShowFloorEditor(true)} className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 border border-neutral-700 text-neutral-300 rounded-lg text-xs font-semibold hover:bg-neutral-700 transition-colors">
            <LayoutGrid className="w-3.5 h-3.5" />Edit Layout
          </button>
          <button onClick={() => setShowSettings(true)} className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-500 hover:text-white transition-colors"><Settings className="w-4 h-4" /></button>
        </div>
      </header>

      {/* ── Main content ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Floor area */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          {/* Floor map */}
          <div className={`flex-1 overflow-hidden ${selectedObj ? '' : ''}`} style={{ minHeight: selectedObj ? '55%' : '100%' }}>
            {objects.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center p-8">
                <div>
                  <LayoutGrid className="w-12 h-12 text-neutral-700 mx-auto mb-4" />
                  <h3 className="text-white font-bold text-lg mb-2">No floor layout yet</h3>
                  <p className="text-neutral-500 text-sm mb-6">Set up your restaurant floor plan to start managing tables.</p>
                  <button onClick={() => setShowFloorEditor(true)} className="px-5 py-3 bg-white text-neutral-900 rounded-xl font-bold text-sm hover:bg-neutral-100 transition-colors">
                    Set Up Floor Plan
                  </button>
                </div>
              </div>
            ) : (
              <FloorMap
                objects={objects}
                tableStates={tableStates}
                selectedId={selectedTableId}
                onSelect={(id) => setSelectedTableId(prev => prev === id ? null : id)}
                zoom={zoom}
                onZoomChange={setZoom}
                pan={pan}
                onPanChange={setPan}
              />
            )}
          </div>

          {/* Table detail panel */}
          {selectedObj && (
            <div className="flex-shrink-0 border-t border-neutral-800" style={{ height: '45%', minHeight: 280 }}>
              <TablePanel
                obj={selectedObj}
                state={selectedState}
                settings={settings}
                servers={settings?.servers || []}
                onUpdate={handleTableUpdate}
                onClose={() => setSelectedTableId(null)}
              />
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="w-80 xl:w-96 flex-shrink-0 border-l border-neutral-800 flex flex-col bg-neutral-900/50">
          {/* Tabs — table-service only */}
          <div className="flex border-b border-neutral-800 flex-shrink-0">
            {[
              ...(isTableService ? [
                { id: 'waitlist',     label: 'Waitlist',      badge: floorData.waitlist?.length },
                { id: 'reservations', label: 'Reservations',  badge: floorData.reservations?.filter(r => !['cancelled','seated','no_show'].includes(r.status)).length },
              ] : []),
              { id: 'summary',      label: 'Overview',      badge: null },
            ].map(({ id, label, badge }) => (
              <button
                key={id}
                onClick={() => setSideTab(id)}
                className={`flex-1 py-3 text-xs font-semibold transition-all border-b-2 ${sideTab === id ? 'text-white border-white' : 'text-neutral-500 border-transparent hover:text-neutral-300'}`}
              >
                {label}
                {badge > 0 && <span className="ml-1.5 px-1.5 py-0.5 bg-neutral-700 rounded-full text-[10px] font-bold">{badge}</span>}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-hidden">
            {isTableService && sideTab === 'waitlist' && (
              <WaitlistPanel
                waitlist={floorData.waitlist || []}
                tableStates={tableStates}
                objects={objects}
                settings={settings}
                onAdd={handleAddToWaitlist}
                onUpdate={handleUpdateWaitlist}
                onRemove={handleRemoveWaitlist}
              />
            )}
            {isTableService && sideTab === 'reservations' && (
              <ReservationsPanel
                reservations={floorData.reservations || []}
                onAdd={handleAddReservation}
                onUpdate={handleUpdateReservation}
                onSeatManually={handleSeatManually}
                objects={objects}
                tableStates={floorData.tableStates || []}
                settings={settings}
                eventId={eid}
              />
            )}
            {sideTab === 'summary' && (
              <div className="p-5 space-y-4">
                <div>
                  <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">Floor Summary</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-neutral-800 rounded-xl p-4">
                      <div className="text-2xl font-black text-white">{tableCounts.available}</div>
                      <div className="text-xs text-emerald-400 font-semibold mt-1">Available</div>
                    </div>
                    <div className="bg-neutral-800 rounded-xl p-4">
                      <div className="text-2xl font-black text-white">{tableCounts.occupied}</div>
                      <div className="text-xs text-rose-400 font-semibold mt-1">Occupied</div>
                    </div>
                    <div className="bg-neutral-800 rounded-xl p-4">
                      <div className="text-2xl font-black text-white">{tableCounts.reserved}</div>
                      <div className="text-xs text-amber-400 font-semibold mt-1">Reserved</div>
                    </div>
                    <div className="bg-neutral-800 rounded-xl p-4">
                      <div className="text-2xl font-black text-white">{tableCounts.cleaning}</div>
                      <div className="text-xs text-violet-400 font-semibold mt-1">Cleaning</div>
                    </div>
                  </div>
                </div>
                <div className="bg-neutral-800 rounded-xl p-4">
                  <div className="text-xs font-bold text-neutral-500 mb-3">Occupancy</div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-neutral-700 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${tables.length ? (tableCounts.occupied / tables.length) * 100 : 0}%` }} />
                    </div>
                    <span className="text-sm font-bold text-white">
                      {tables.length ? Math.round((tableCounts.occupied / tables.length) * 100) : 0}%
                    </span>
                  </div>
                  <div className="text-xs text-neutral-600 mt-2">{tableCounts.occupied} of {tables.length} tables occupied</div>
                </div>
                {settings.welcomeMessage && (
                  <div className="bg-neutral-800/60 border border-neutral-700 rounded-xl p-4">
                    <div className="text-xs font-bold text-neutral-500 mb-2">Tonight's Note</div>
                    <p className="text-sm text-neutral-300 italic leading-relaxed">{settings.welcomeMessage}</p>
                  </div>
                )}
                <div className="bg-neutral-800/60 rounded-xl p-4 space-y-2">
                  <div className="text-xs font-bold text-neutral-500 mb-2">Configuration</div>
                  {[
                    { label: 'Avg dining time', value: `${settings.avgDiningMinutes || 75} min` },
                    { label: 'Cleaning buffer', value: `${settings.cleaningBufferMinutes || 10} min` },
                    { label: 'Hours', value: `${settings.operatingHoursOpen || '11:00'} – ${settings.operatingHoursClose || '22:00'}` },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between items-center text-xs">
                      <span className="text-neutral-500">{label}</span>
                      <span className="text-neutral-300 font-semibold">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Settings Modal ── */}
      {showQRScanner && (
        <QRScannerModal
          eventId={eid}
          objects={objects}
          tableStates={tableStates}
          settings={settings}
          onClose={() => setShowQRScanner(false)}
          onResult={loadFloor}
          onSeatAtTable={loadFloor}
        />
      )}

      {showSettings && (
        <SettingsModal
          settings={settings}
          reservationSettings={reservationSettings}
          onSave={handleSaveSettings}
          onSaveReserve={handleSaveReservationSettings}
          onClose={() => setShowSettings(false)}
          eventId={eid}
          subdomain={subdomain}
          isTableService={isTableService}
        />
      )}

      {/* ── Floor Layout Editor ── */}
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
