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
  ArrowRight, Phone, ScanLine, Calendar, Timer, Loader2, Lock,
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

// ---------------------------------------------------------------------------
// QR Scanner — uses native BarcodeDetector API (Chrome/Edge/Android)
// Staff tap the camera icon, point at a guest's QR code, result auto-confirms
// ---------------------------------------------------------------------------
function QRScannerModal({ eventId, onClose, onResult }) {
  const videoRef  = useRef(null);
  const streamRef = useRef(null);
  const rafRef    = useRef(null);
  const [status, setStatus]   = useState('starting'); // starting | scanning | result | error
  const [result, setResult]   = useState(null);
  const [errMsg, setErrMsg]   = useState('');

  useEffect(() => {
    let detector;
    const start = async () => {
      try {
        if (!('BarcodeDetector' in window)) {
          setErrMsg('QR scanning requires Chrome, Edge, or Android browser. On iOS, use the native camera app to scan.');
          setStatus('error');
          return;
        }
        detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStatus('scanning');
        const scan = async () => {
          if (!videoRef.current || videoRef.current.readyState < 2) { rafRef.current = requestAnimationFrame(scan); return; }
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0) {
              const raw = codes[0].rawValue;
              stopStream();
              setStatus('result');
              // Verify against backend
              try {
                const res = await eventAPI.verifyReservationQR(eventId, raw);
                setResult({ ok: true, reservation: res.data.reservation });
              } catch (e) {
                setResult({ ok: false, message: e?.response?.data?.error || 'Invalid or expired QR code.' });
              }
              return;
            }
          } catch (_) {}
          rafRef.current = requestAnimationFrame(scan);
        };
        rafRef.current = requestAnimationFrame(scan);
      } catch (e) {
        setErrMsg(e.name === 'NotAllowedError' ? 'Camera permission denied. Please allow camera access and try again.' : `Camera error: ${e.message}`);
        setStatus('error');
      }
    };
    start();
    return () => { stopStream(); cancelAnimationFrame(rafRef.current); };
  }, [eventId]);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    cancelAnimationFrame(rafRef.current);
  };

  const handleSeat = async () => {
    if (!result?.reservation) return;
    try {
      await eventAPI.updateTableReservation(eventId, result.reservation.id, { status: 'seated' });
      toast.success(`${result.reservation.partyName} seated!`);
      onResult?.();
      onClose();
    } catch { toast.error('Failed to update reservation'); }
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-4" onClick={onClose}>
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <ScanLine className="w-4 h-4 text-orange-400" />
            <span className="text-sm font-bold text-white">Scan Guest QR</span>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-neutral-800 rounded-lg text-neutral-500 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        {/* Camera / states */}
        {status === 'starting' && (
          <div className="h-64 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-neutral-500" />
          </div>
        )}

        {status === 'scanning' && (
          <div className="relative">
            <video ref={videoRef} className="w-full h-64 object-cover bg-black" playsInline muted />
            {/* Viewfinder overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-44 h-44 border-2 border-orange-400 rounded-xl opacity-80" style={{ boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)' }} />
            </div>
            <p className="text-center text-xs text-neutral-400 py-3">Point camera at guest's QR code</p>
          </div>
        )}

        {status === 'error' && (
          <div className="p-6 text-center">
            <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-3" />
            <p className="text-sm text-neutral-300 mb-4">{errMsg}</p>
            <button onClick={onClose} className="px-4 py-2 bg-neutral-800 text-neutral-300 rounded-lg text-sm font-semibold hover:bg-neutral-700">Close</button>
          </div>
        )}

        {status === 'result' && result && (
          <div className="p-5">
            {result.ok ? (
              <>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-emerald-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Valid Reservation</p>
                    <p className="text-xs text-emerald-400">QR code verified ✓</p>
                  </div>
                </div>
                <div className="bg-neutral-800 rounded-xl p-4 mb-4 space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-400">Name</span>
                    <span className="text-white font-semibold">{result.reservation.partyName}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-400">Party size</span>
                    <span className="text-white font-semibold">{result.reservation.partySize}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-neutral-400">Time</span>
                    <span className="text-white font-semibold">{fmtDateTime(result.reservation.dateTime)}</span>
                  </div>
                  {result.reservation.notes && (
                    <div className="flex justify-between text-sm">
                      <span className="text-neutral-400">Notes</span>
                      <span className="text-white text-right max-w-[60%]">{result.reservation.notes}</span>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={handleSeat} className="py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700">Seat Party</button>
                  <button onClick={onClose} className="py-2.5 bg-neutral-800 text-neutral-300 rounded-xl text-sm font-semibold hover:bg-neutral-700">Close</button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 bg-rose-500/20 rounded-full flex items-center justify-center flex-shrink-0">
                    <XCircle className="w-4 h-4 text-rose-400" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Invalid QR Code</p>
                    <p className="text-xs text-rose-400">{result.message}</p>
                  </div>
                </div>
                <button onClick={onClose} className="w-full py-2.5 bg-neutral-800 text-neutral-300 rounded-xl text-sm font-semibold hover:bg-neutral-700">Close</button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

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
    sendConfirmationEmail:      reservationSettings?.sendConfirmationEmail     ?? true,
    sendReminderEmail:          reservationSettings?.sendReminderEmail         ?? false,
    reminderHoursBefore:        reservationSettings?.reminderHoursBefore       || 24,
    notifyOrganizerOnBooking:   reservationSettings?.notifyOrganizerOnBooking  ?? true,
    notifyOrganizerOnCancel:    reservationSettings?.notifyOrganizerOnCancel   ?? true,
    notifyOrganizerEmail:       reservationSettings?.notifyOrganizerEmail      || '',
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

  const setF  = (k) => (e) => setForm(p => ({ ...p, [k]: e.target.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value }));
  const setR  = (k) => (e) => setRForm(p => ({ ...p, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value }));
  const setRB = (k, v) => setRForm(p => ({ ...p, [k]: v }));
  const setDay = (day, field, val) => setRForm(p => ({ ...p, operatingDays: { ...(p.operatingDays || {}), [day]: { ...(p.operatingDays?.[day] || {}), [field]: val } } }));

  const inputCls = 'w-full bg-neutral-800 border border-neutral-700 text-white rounded-xl px-3 py-2.5 outline-none focus:border-orange-500/70 text-sm transition-colors';
  const labelCls = 'block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1.5';

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({ ...form });

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
    { id: 'reserve',   label: 'Reserve Page',  tsOnly: true },
    { id: 'content',   label: 'Content',       tsOnly: true },
    { id: 'booking',   label: 'Booking Rules', tsOnly: true },
    { id: 'notify',    label: 'Notifications', tsOnly: true },
  ];
  const TABS = ALL_TABS.filter(t => !t.tsOnly || isTableService);

  const SectionHead = ({ title, desc }) => (
    <div className="mb-4">
      <div className="text-sm font-bold text-white">{title}</div>
      {desc && <p className="text-xs text-neutral-500 mt-0.5">{desc}</p>}
    </div>
  );

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
              <SectionHead title="FAQ" desc='JSON array: [{"question":"Q?","answer":"A."}]. Leave empty for none.' />
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

          {/* ── NOTIFICATIONS TAB ── */}
          {tab === 'notify' && (<>
            <SectionHead title="Guest Emails" />
            <div className="space-y-2">
              {[
                { key: 'sendConfirmationEmail', label: 'Send Confirmation Email to Guest' },
                { key: 'sendReminderEmail',     label: 'Send Reminder Email to Guest' },
                { key: 'sendCancellationEmail', label: 'Send Cancellation Confirmation to Guest' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between p-3 bg-neutral-800/40 rounded-xl border border-neutral-700">
                  <span className="text-sm font-semibold text-white">{label}</span>
                  <Toggle checked={rForm[key]} onChange={e => setRB(key, e.target.checked)} />
                </div>
              ))}
            </div>
            {rForm.sendReminderEmail && (
              <div><label className={labelCls}>Reminder Timing</label>
                <select value={rForm.reminderHoursBefore} onChange={setR('reminderHoursBefore')} className={inputCls}>
                  {[2,4,12,24,48,72].map(h => <option key={h} value={h}>{h} hours before</option>)}
                </select>
              </div>
            )}
            <div className="border-t border-neutral-800 pt-5">
              <SectionHead title="Organizer Alerts" />
              <div className="space-y-2 mb-4">
                {[
                  { key: 'notifyOrganizerOnBooking', label: 'Alert me when a new reservation is made' },
                  { key: 'notifyOrganizerOnCancel',  label: 'Alert me when a reservation is cancelled' },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between p-3 bg-neutral-800/40 rounded-xl border border-neutral-700">
                    <span className="text-sm font-semibold text-white">{label}</span>
                    <Toggle checked={rForm[key]} onChange={e => setRB(key, e.target.checked)} />
                  </div>
                ))}
              </div>
              <div><label className={labelCls}>Notification Email (leave blank to use account email)</label>
                <input type="email" value={rForm.notifyOrganizerEmail} onChange={setR('notifyOrganizerEmail')} placeholder="manager@restaurant.com" className={inputCls} /></div>
            </div>
            <div className="border-t border-neutral-800 pt-5">
              <SectionHead title="Post-Booking Message" desc="Shown on the confirmation screen and in the confirmation email." />
              <textarea value={rForm.confirmationMessage} onChange={setR('confirmationMessage')} rows={3}
                placeholder="We look forward to seeing you! Please arrive 5 minutes early. Call us if you need to make any changes."
                className={inputCls + ' resize-none'} />
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
    } catch (err) {
      if (err?.response?.status === 403 || err?.response?.status === 404) {
        const errData = err?.response?.data || {};
        setFloorData(prev => ({
          ...prev,
          _forbidden: true,
          _forbiddenIsEnterprise: !!errData.isEnterpriseMode,
          _forbiddenTitle: errData.eventTitle || '',
          _notFound: err?.response?.status === 404,
        }));
      } else {
        toast.error('Could not load floor data');
      }
    } finally {
      setLoading(false);
    }
  }, [eid]);

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
    if (status === 'seated') toast.success('Guest seated');
    if (status === 'cancelled') toast.success('Reservation cancelled');
  };

  const handleSaveSettings = async (form) => {
    const res = await eventAPI.updateTableServiceSettings(eid, form);
    setFloorData(prev => ({ ...prev, settings: res.data.settings, restaurantName: res.data.settings.restaurantName || prev.restaurantName }));
    toast.success('Settings saved');
  };

  const handleSaveReservationSettings = async (form) => {
    try {
      const res = await eventAPI.updateReservationPageSettings(eid, form);
      setReservationSettings(res.data.reservationSettings || form);
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
                { id: 'reservations', label: 'Reservations',  badge: floorData.reservations?.filter(r => { const d = new Date(r.dateTime); return d.toDateString() === new Date().toDateString(); }).length },
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
          onClose={() => setShowQRScanner(false)}
          onResult={loadFloor}
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
