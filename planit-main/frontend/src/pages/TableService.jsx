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
  ArrowRight, Phone, ScanLine, Calendar, Timer, Loader2,
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
  const svgRef = useRef(null);
  const isDragging = useRef(false);
  const dragStart  = useRef({ x: 0, y: 0, px: 0, py: 0 });

  const getState = (id) => tableStates?.find(s => s.tableId === id) || { status: 'available' };

  const onWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    onZoomChange(z => Math.max(0.3, Math.min(3, z + delta)));
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

    const state   = getState(obj.id);
    const sm      = STATUS_META[state.status] || STATUS_META.available;
    const isRound = obj.type === 'round' || obj.type === 'vip';
    const w = obj.width  || (isRound ? 80 : 120);
    const h = obj.height || (isRound ? 80 : 60);
    const isSelected = selectedId === obj.id;
    const remaining  = state.status === 'occupied' ? estimateRemaining(state, {}) : null;

    return (
      <g
        key={obj.id}
        transform={`translate(${obj.x}, ${obj.y}) rotate(${obj.rotation || 0})`}
        className="table-hit"
        style={{ cursor: 'pointer' }}
        onClick={() => onSelect(obj.id)}
      >
        {/* Selection ring */}
        {isSelected && (isRound
          ? <circle cx={0} cy={0} r={w / 2 + 8} fill="none" stroke="white" strokeWidth={2} opacity={0.6} />
          : <rect x={-w / 2 - 8} y={-h / 2 - 8} width={w + 16} height={h + 16} rx={10} fill="none" stroke="white" strokeWidth={2} opacity={0.6} />
        )}
        {/* Status glow */}
        {isRound
          ? <circle cx={0} cy={0} r={w / 2 + 3} fill="none" stroke={sm.color} strokeWidth={2.5} opacity={isSelected ? 1 : 0.7} />
          : <rect x={-w / 2 - 3} y={-h / 2 - 3} width={w + 6} height={h + 6} rx={9} fill="none" stroke={sm.color} strokeWidth={2.5} opacity={isSelected ? 1 : 0.7} />
        }
        {/* Table body */}
        {isRound
          ? <circle cx={0} cy={0} r={w / 2} fill={`${sm.color}22`} />
          : <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={6} fill={`${sm.color}22`} />
        }
        {/* Label */}
        <text x={0} y={-4} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="11" fontWeight="700">{obj.label || `T${obj.id.slice(-3)}`}</text>
        {/* Party size / capacity */}
        <text x={0} y={10} textAnchor="middle" dominantBaseline="middle" fill={sm.color} fontSize="10" fontWeight="500">
          {state.status === 'occupied' ? `${state.partySize || '?'}/${obj.capacity}` : `cap ${obj.capacity}`}
        </text>
        {/* Time remaining badge */}
        {state.status === 'occupied' && remaining !== null && (
          <g transform={`translate(${w / 2 - 4}, ${-h / 2 + 4})`}>
            <rect x={-16} y={-8} width={32} height={16} rx={8} fill={remaining <= 10 ? '#ef4444' : '#1a1a1a'} />
            <text textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="9" fontWeight="700">{remaining <= 0 ? 'OVER' : `${remaining}m`}</text>
          </g>
        )}
        {/* Reserved badge */}
        {state.status === 'reserved' && (
          <g transform={`translate(${w / 2 - 4}, ${-h / 2 + 4})`}>
            <rect x={-8} y={-8} width={16} height={16} rx={8} fill="#f59e0b" />
            <text textAnchor="middle" dominantBaseline="middle" fill="black" fontSize="10" fontWeight="800">R</text>
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
      <svg
        ref={svgRef}
        className="w-full h-full"
        onWheel={onWheel}
        style={{ cursor: isDragging.current ? 'grabbing' : 'grab' }}
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

function TablePanel({ obj, state, settings, onUpdate, onClose }) {
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
              <input
                type="text"
                value={localState.serverName}
                onChange={e => setLocalState(p => ({ ...p, serverName: e.target.value }))}
                placeholder="Server name"
                className="w-full bg-neutral-800 border border-neutral-700 text-white text-sm rounded-lg px-3 py-2.5 outline-none focus:border-neutral-500 transition-colors"
              />
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

function ReservationsPanel({ reservations, onAdd, onUpdate, eventId }) {
  const [showAdd, setShowAdd]   = useState(false);
  const [form, setForm]         = useState({ partyName: '', partySize: 2, phone: '', email: '', dateTime: '', notes: '' });
  const [adding, setAdding]     = useState(false);
  const [showQR, setShowQR]     = useState(null); // reservation object

  const handleAdd = async () => {
    if (!form.partyName.trim() || !form.dateTime) { toast.error('Party name and date/time required'); return; }
    setAdding(true);
    try { await onAdd(form); setForm({ partyName: '', partySize: 2, phone: '', email: '', dateTime: '', notes: '' }); setShowAdd(false); }
    finally { setAdding(false); }
  };

  const upcomingToday = reservations.filter(r => {
    const d = new Date(r.dateTime);
    const now = new Date();
    return d.toDateString() === now.toDateString() && r.status === 'confirmed';
  }).sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));

  const future = reservations.filter(r => {
    const d = new Date(r.dateTime);
    const now = new Date();
    return d.toDateString() !== now.toDateString() && r.status === 'confirmed' && d > now;
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
            <button onClick={() => onUpdate(showQR.id, 'seated')} className="py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700">Seat Now</button>
            <button onClick={() => { onUpdate(showQR.id, 'no_show'); setShowQR(null); }} className="py-2 bg-neutral-800 text-neutral-400 rounded-lg text-xs font-semibold hover:bg-neutral-700">No Show</button>
          </div>
          <button onClick={() => setShowQR(null)} className="w-full mt-2 py-2 text-neutral-600 text-xs hover:text-neutral-400">Close</button>
        </div>
      </div>
    );
  };

  const ReservationRow = ({ r }) => (
    <div className="flex items-center justify-between p-3 hover:bg-neutral-800/40 rounded-xl transition-colors gap-3">
      <div className="min-w-0">
        <div className="font-semibold text-white text-sm truncate">{r.partyName}</div>
        <div className="text-xs text-neutral-500 flex items-center gap-2 mt-0.5">
          <span><Clock className="w-3 h-3 inline mr-0.5" />{fmtTime(r.dateTime)}</span>
          <span><Users className="w-3 h-3 inline mr-0.5" />{r.partySize}</span>
          {r.phone && <span><Phone className="w-3 h-3 inline mr-0.5" />{r.phone}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={() => setShowQR(r)} title="Show QR" className="p-1.5 hover:bg-neutral-700 text-neutral-500 hover:text-white rounded-lg transition-colors"><QrCode className="w-3.5 h-3.5" /></button>
        <button onClick={() => onUpdate(r.id, 'seated')} title="Seat" className="p-1.5 hover:bg-emerald-500/20 text-neutral-500 hover:text-emerald-400 rounded-lg transition-colors"><CheckCircle className="w-3.5 h-3.5" /></button>
        <button onClick={() => onUpdate(r.id, 'cancelled')} title="Cancel" className="p-1.5 hover:bg-rose-500/20 text-neutral-500 hover:text-rose-400 rounded-lg transition-colors"><X className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <QRModal />
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
        {upcomingToday.length === 0 && future.length === 0 && (
          <div className="text-center py-16 text-neutral-600">
            <Calendar className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No reservations</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Settings Modal ────────────────────────────────────────────────────────────

function SettingsModal({ settings, onSave, onClose }) {
  const [form, setForm] = useState({ ...settings });
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.type === 'number' ? parseFloat(e.target.value) : e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(form); onClose(); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-neutral-800">
          <div>
            <h2 className="text-lg font-bold text-white">Table Service Settings</h2>
            <p className="text-xs text-neutral-500 mt-0.5">Configure your restaurant's operational parameters</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div>
            <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Restaurant Name</label>
            <input type="text" value={form.restaurantName || ''} onChange={set('restaurantName')}
              placeholder="Taverna Roma..." className="w-full bg-neutral-800 border border-neutral-700 text-white rounded-xl px-4 py-3 outline-none focus:border-neutral-500 text-sm" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Avg Dining Time (min)</label>
              <input type="number" min="10" max="300" value={form.avgDiningMinutes || 75} onChange={set('avgDiningMinutes')}
                className="w-full bg-neutral-800 border border-neutral-700 text-white rounded-xl px-4 py-3 outline-none focus:border-neutral-500 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Cleaning Buffer (min)</label>
              <input type="number" min="0" max="60" value={form.cleaningBufferMinutes || 10} onChange={set('cleaningBufferMinutes')}
                className="w-full bg-neutral-800 border border-neutral-700 text-white rounded-xl px-4 py-3 outline-none focus:border-neutral-500 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Reservation Duration (min)</label>
              <input type="number" min="30" max="300" value={form.reservationDurationMinutes || 90} onChange={set('reservationDurationMinutes')}
                className="w-full bg-neutral-800 border border-neutral-700 text-white rounded-xl px-4 py-3 outline-none focus:border-neutral-500 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">QR Code Expiry (min after res)</label>
              <input type="number" min="5" max="240" value={form.reservationQrExpiryMinutes || 45} onChange={set('reservationQrExpiryMinutes')}
                className="w-full bg-neutral-800 border border-neutral-700 text-white rounded-xl px-4 py-3 outline-none focus:border-neutral-500 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Opens</label>
              <input type="time" value={form.operatingHoursOpen || '11:00'} onChange={set('operatingHoursOpen')}
                className="w-full bg-neutral-800 border border-neutral-700 text-white rounded-xl px-4 py-3 outline-none focus:border-neutral-500 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Closes</label>
              <input type="time" value={form.operatingHoursClose || '22:00'} onChange={set('operatingHoursClose')}
                className="w-full bg-neutral-800 border border-neutral-700 text-white rounded-xl px-4 py-3 outline-none focus:border-neutral-500 text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">Welcome Message (shown to staff)</label>
            <textarea value={form.welcomeMessage || ''} onChange={set('welcomeMessage')}
              placeholder="Good evening — enjoy tonight's service."
              rows={2} className="w-full bg-neutral-800 border border-neutral-700 text-white rounded-xl px-4 py-3 outline-none focus:border-neutral-500 text-sm resize-none" />
          </div>
        </div>

        <div className="p-6 border-t border-neutral-800 flex gap-3">
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

  const [loading, setLoading]           = useState(true);
  const [floorData, setFloorData]       = useState({ seatingMap: { objects: [] }, tableStates: [], settings: {}, reservations: [], waitlist: [], restaurantName: '' });
  const [selectedTableId, setSelectedTableId] = useState(null);
  const [sideTab, setSideTab]           = useState('waitlist');
  const [showSettings, setShowSettings] = useState(false);
  const [showFloorEditor, setShowFloorEditor] = useState(false);
  const [seatingData, setSeatingData]   = useState(null);
  const [seatingIsSaving, setSeatingIsSaving] = useState(false);

  const [zoom, setZoom] = useState(1);
  const [pan,  setPan]  = useState({ x: 0, y: 0 });

  // Derived
  const eid = eventId; // for API calls
  const objects    = floorData.seatingMap?.objects || [];
  const tables     = objects.filter(o => o.type !== 'zone');
  const tableStates = floorData.tableStates || [];
  const settings   = floorData.settings || {};

  const tableCounts = {
    available: tables.filter(t => { const s = tableStates.find(x => x.tableId === t.id); return !s || s.status === 'available'; }).length,
    occupied:  tables.filter(t => tableStates.find(x => x.tableId === t.id)?.status === 'occupied').length,
    reserved:  tables.filter(t => tableStates.find(x => x.tableId === t.id)?.status === 'reserved').length,
    cleaning:  tables.filter(t => tableStates.find(x => x.tableId === t.id)?.status === 'cleaning').length,
  };

  const selectedObj   = objects.find(o => o.id === selectedTableId) || null;
  const selectedState = tableStates.find(s => s.tableId === selectedTableId) || null;

  const loadFloor = useCallback(async () => {
    try {
      const res = await eventAPI.getTableServiceFloor(eid);
      setFloorData(res.data);
    } catch (err) {
      toast.error('Could not load floor data');
    } finally {
      setLoading(false);
    }
  }, [eid]);

  useEffect(() => {
    loadFloor();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadFloor, 30000);
    return () => clearInterval(interval);
  }, [loadFloor]);

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
    if (status === 'seated') toast.success('Guest seated');
    if (status === 'cancelled') toast.success('Reservation cancelled');
  };

  const handleSaveSettings = async (form) => {
    const res = await eventAPI.updateTableServiceSettings(eid, form);
    setFloorData(prev => ({ ...prev, settings: res.data.settings, restaurantName: res.data.settings.restaurantName || prev.restaurantName }));
    toast.success('Settings saved');
  };

  const handleSaveSeatingMap = async (newObjects) => {
    setSeatingIsSaving(true);
    try {
      await eventAPI.saveSeatingMap(eid, { objects: newObjects });
      setFloorData(prev => ({ ...prev, seatingMap: { ...prev.seatingMap, objects: newObjects } }));
      setShowFloorEditor(false);
      toast.success('Floor layout saved');
    } catch {
      toast.error('Failed to save layout');
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

  return (
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
                onUpdate={handleTableUpdate}
                onClose={() => setSelectedTableId(null)}
              />
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="w-80 xl:w-96 flex-shrink-0 border-l border-neutral-800 flex flex-col bg-neutral-900/50">
          {/* Tabs */}
          <div className="flex border-b border-neutral-800 flex-shrink-0">
            {[
              { id: 'waitlist',     label: 'Waitlist',      badge: floorData.waitlist?.length },
              { id: 'reservations', label: 'Reservations',  badge: floorData.reservations?.filter(r => { const d = new Date(r.dateTime); return d.toDateString() === new Date().toDateString(); }).length },
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
            {sideTab === 'waitlist' && (
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
            {sideTab === 'reservations' && (
              <ReservationsPanel
                reservations={floorData.reservations || []}
                onAdd={handleAddReservation}
                onUpdate={handleUpdateReservation}
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
      {showSettings && (
        <SettingsModal
          settings={settings}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
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
