/**
 * ServerView.jsx — Read-mostly floor view for servers on shift.
 *
 * Route: /event/:eventId/server  OR  /e/:subdomain/server
 *
 * - Table-service events only (403 gate for regular/enterprise)
 * - Server picks their name from the shift list
 * - Shows full floor map (read-only) + "My Tables" panel
 * - Servers can update table status (occupied, available, cleaning, etc.)
 * - Auto-refreshes every 20s
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Users, Clock, CheckCircle, XCircle, RefreshCw, Lock,
  Utensils, Loader2, X, ChevronDown, Bell, DollarSign, Star,
} from 'lucide-react';
import { eventAPI } from '../services/api';
import toast from 'react-hot-toast';

// ── Shared constants ──────────────────────────────────────────────────────────

const STATUS_META = {
  available:   { label: 'Available',   color: '#22c55e', bg: 'bg-emerald-950/60', border: 'border-emerald-500/40', text: 'text-emerald-400' },
  occupied:    { label: 'Occupied',    color: '#ef4444', bg: 'bg-rose-950/60',    border: 'border-rose-500/40',    text: 'text-rose-400'    },
  reserved:    { label: 'Reserved',    color: '#f59e0b', bg: 'bg-amber-950/60',   border: 'border-amber-500/40',   text: 'text-amber-400'   },
  cleaning:    { label: 'Cleaning',    color: '#8b5cf6', bg: 'bg-violet-950/60',  border: 'border-violet-500/40',  text: 'text-violet-400'  },
  unavailable: { label: 'Unavailable', color: '#525252', bg: 'bg-neutral-900',    border: 'border-neutral-700',    text: 'text-neutral-500' },
};

function fmtDuration(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function estimateRemaining(state, settings) {
  if (!state?.occupiedAt) return null;
  const seatedMs  = Date.now() - new Date(state.occupiedAt).getTime();
  const avgMs     = (settings?.avgDiningMinutes || 75) * 60000;
  return Math.max(0, Math.round((avgMs - seatedMs) / 60000));
}

// ── Floor Map (read-only SVG) ─────────────────────────────────────────────────

function FloorMapReadOnly({ objects, tableStates, myServerName, selectedId, onSelect, zoom, pan }) {
  const svgRef = useRef(null);

  const getState = (id) => tableStates?.find(s => s.tableId === id) || { status: 'available' };

  const renderTable = (obj) => {
    if (obj.type === 'zone') {
      const zw = obj.width || 200, zh = obj.height || 120;
      return (
        <g key={obj.id} transform={`translate(${obj.x - zw / 2}, ${obj.y - zh / 2})`}>
          <rect width={zw} height={zh} rx={8} fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.1)" strokeDasharray="6 4" />
          <text x={zw / 2} y={zh / 2} textAnchor="middle" dominantBaseline="middle" fill="rgba(255,255,255,0.3)" fontSize="14" fontWeight="600">{obj.label || 'Zone'}</text>
        </g>
      );
    }

    const state     = getState(obj.id);
    const sm        = STATUS_META[state.status] || STATUS_META.available;
    const isRound   = obj.type === 'round' || obj.type === 'vip';
    const w         = obj.width  || (isRound ? 80 : 120);
    const h         = obj.height || (isRound ? 80 : 60);
    const isSelected = selectedId === obj.id;
    const isMine    = myServerName && state.serverName === myServerName;
    const remaining = state.status === 'occupied' ? estimateRemaining(state, {}) : null;

    return (
      <g
        key={obj.id}
        transform={`translate(${obj.x}, ${obj.y}) rotate(${obj.rotation || 0})`}
        style={{ cursor: 'pointer' }}
        onClick={() => onSelect(obj.id)}
      >
        {/* Mine highlight ring */}
        {isMine && (isRound
          ? <circle cx={0} cy={0} r={w / 2 + 12} fill="none" stroke="#f97316" strokeWidth={2} opacity={0.5} strokeDasharray="6 3" />
          : <rect x={-w / 2 - 12} y={-h / 2 - 12} width={w + 24} height={h + 24} rx={12} fill="none" stroke="#f97316" strokeWidth={2} opacity={0.5} strokeDasharray="6 3" />
        )}
        {/* Selected ring */}
        {isSelected && (isRound
          ? <circle cx={0} cy={0} r={w / 2 + 8} fill="none" stroke="white" strokeWidth={2} opacity={0.7} />
          : <rect x={-w / 2 - 8} y={-h / 2 - 8} width={w + 16} height={h + 16} rx={10} fill="none" stroke="white" strokeWidth={2} opacity={0.7} />
        )}
        {/* Outer border */}
        {isRound
          ? <circle cx={0} cy={0} r={w / 2 + 3} fill="none" stroke={sm.color} strokeWidth={2.5} opacity={isSelected ? 1 : 0.7} />
          : <rect x={-w / 2 - 3} y={-h / 2 - 3} width={w + 6} height={h + 6} rx={9} fill="none" stroke={sm.color} strokeWidth={2.5} opacity={isSelected ? 1 : 0.7} />
        }
        {/* Fill */}
        {isRound
          ? <circle cx={0} cy={0} r={w / 2} fill={`${sm.color}22`} />
          : <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={6} fill={`${sm.color}22`} />
        }
        <text x={0} y={-4} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="11" fontWeight="700">{obj.label || `T${obj.id.slice(-3)}`}</text>
        <text x={0} y={10} textAnchor="middle" dominantBaseline="middle" fill={sm.color} fontSize="10" fontWeight="500">
          {state.status === 'occupied' ? `${state.partySize || '?'}/${obj.capacity}` : `cap ${obj.capacity}`}
        </text>
        {/* Timer badge */}
        {state.status === 'occupied' && remaining !== null && (
          <g transform={`translate(${w / 2 - 4}, ${-h / 2 + 4})`}>
            <rect x={-16} y={-8} width={32} height={16} rx={8} fill={remaining <= 10 ? '#ef4444' : '#1a1a1a'} />
            <text textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="9" fontWeight="700">{remaining <= 0 ? 'OVER' : `${remaining}m`}</text>
          </g>
        )}
        {/* Server initial badge */}
        {state.serverName && (
          <g transform={`translate(${-w / 2 + 4}, ${-h / 2 + 4})`}>
            <circle cx={0} cy={0} r={8} fill={isMine ? '#f97316' : '#404040'} />
            <text textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="8" fontWeight="800">
              {state.serverName.charAt(0).toUpperCase()}
            </text>
          </g>
        )}
        {/* Guest alert badge */}
        {state.guestAlert && (
          <g transform={`translate(${w / 2 - 4}, ${h / 2 - 4})`}>
            <circle cx={0} cy={0} r={9} fill={state.guestAlert === 'order' ? '#22c55e' : '#f59e0b'} />
            <text textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="8" fontWeight="800">
              {state.guestAlert === 'order' ? '!' : 'S'}
            </text>
          </g>
        )}
      </g>
    );
  };

  return (
    <div className="relative w-full h-full bg-neutral-950 select-none" style={{ touchAction: 'none' }}>
      <svg className="w-full h-full" style={{ display: 'block' }}>
        <defs>
          <pattern id="grid-sv" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-sv)" />
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          {(objects || []).map(renderTable)}
        </g>
      </svg>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 flex gap-3 flex-wrap">
        {Object.entries(STATUS_META).map(([k, v]) => (
          <div key={k} className="flex items-center gap-1.5 text-xs">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: v.color }} />
            <span className="text-neutral-400">{v.label}</span>
          </div>
        ))}
        {myServerName && (
          <div className="flex items-center gap-1.5 text-xs">
            <div className="w-2.5 h-2.5 rounded-full border-2 border-orange-500" />
            <span className="text-orange-400">Your tables</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Table Detail Card (server's view — can update status) ─────────────────────

function ServerTableCard({ obj, state, settings, onUpdate, onClose, eventId, subdomain }) {
  const [saving, setSaving] = useState(false);
  const [billSub, setBillSub] = useState(state?.billSubtotal ?? '');
  const [billTax, setBillTax] = useState(state?.billTax ?? '');
  const sm        = STATUS_META[state?.status || 'available'];
  const occupiedMs = state?.occupiedAt ? Date.now() - new Date(state.occupiedAt).getTime() : null;
  const remaining  = state?.status === 'occupied' ? estimateRemaining(state, settings) : null;

  const guestUrl = (() => {
    const base = window.location.origin;
    if (subdomain) return `${base}/e/${subdomain}/table/${obj.id}`;
    if (eventId) return `${base}/event/${eventId}/table/${obj.id}`;
    return null;
  })();

  const changeStatus = async (status) => {
    setSaving(true);
    try {
      await onUpdate(obj.id, { status });
      toast.success(`Table marked ${STATUS_META[status]?.label}`);
    } catch { toast.error('Failed to update table'); }
    finally { setSaving(false); }
  };

  const guestAction = async (updates, label) => {
    setSaving(true);
    try {
      await onUpdate(obj.id, updates);
      if (label) toast.success(label);
    } catch { toast.error('Failed'); }
    finally { setSaving(false); }
  };

  const sendBill = () => {
    const sub = parseFloat(billSub);
    const tax = parseFloat(billTax);
    if (isNaN(sub) || sub < 0) { toast.error('Enter a valid subtotal'); return; }
    guestAction({ guestScreen: 'bill', billSubtotal: sub, billTax: isNaN(tax) ? 0 : tax, billPaid: false }, 'Bill sent to table');
  };

  const alert = state?.guestAlert;
  const dietary = state?.guestDietary || [];

  return (
    <div className="bg-neutral-900 border-t border-neutral-800 flex-shrink-0" style={{ maxHeight: '60%', overflow: 'auto' }}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
        <div>
          <div className="font-bold text-white">{obj.label || `Table ${obj.id.slice(-3)}`}</div>
          <div className="text-xs text-neutral-500">Capacity {obj.capacity}</div>
        </div>
        <div className="flex items-center gap-2">
          {alert && (
            <span className={`text-xs font-bold px-2 py-1 rounded-full border ${alert === 'order' ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400' : 'bg-amber-950/60 border-amber-500/40 text-amber-400'}`}>
              {alert === 'order' ? 'Ready to Order' : 'Call Server'}
            </span>
          )}
          <span className={`text-xs font-bold px-2 py-1 rounded-full border ${sm.bg} ${sm.border} ${sm.text}`}>{sm.label}</span>
          <button onClick={onClose} className="p-1.5 hover:bg-neutral-800 rounded-lg text-neutral-500 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Timing */}
        {state?.status === 'occupied' && occupiedMs !== null && (
          <div className={`grid grid-cols-2 gap-3 p-3 rounded-xl border ${remaining !== null && remaining <= 10 ? 'bg-rose-950/30 border-rose-800/40' : 'bg-neutral-800/60 border-neutral-700'}`}>
            <div>
              <div className="text-xs text-neutral-500 mb-0.5">Seated for</div>
              <div className="text-lg font-black text-white">{fmtDuration(occupiedMs)}</div>
            </div>
            <div>
              <div className="text-xs text-neutral-500 mb-0.5">Est. remaining</div>
              <div className={`text-lg font-black ${remaining !== null && remaining <= 10 ? 'text-rose-400' : 'text-white'}`}>
                {remaining !== null ? (remaining <= 0 ? 'Overdue' : `~${remaining}m`) : '—'}
              </div>
            </div>
          </div>
        )}

        {/* Party info */}
        {(state?.partyName || state?.partySize > 0) && (
          <div className="space-y-1.5 text-sm">
            {state.partyName && <div className="flex justify-between"><span className="text-neutral-500">Party</span><span className="text-white font-semibold">{state.partyName}</span></div>}
            {state.partySize > 0 && <div className="flex justify-between"><span className="text-neutral-500">Guests</span><span className="text-white font-semibold">{state.partySize}</span></div>}
            {state.serverName && <div className="flex justify-between"><span className="text-neutral-500">Server</span><span className="text-white font-semibold">{state.serverName}</span></div>}
            {state.notes && <div className="flex justify-between gap-4"><span className="text-neutral-500 flex-shrink-0">Notes</span><span className="text-neutral-300 text-right">{state.notes}</span></div>}
          </div>
        )}

        {/* Dietary restrictions from guest */}
        {(dietary.length > 0 || state?.guestDietaryNotes) && (
          <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-800/30 space-y-1.5">
            <div className="text-xs font-bold text-amber-400 uppercase tracking-wider">Guest Dietary</div>
            {dietary.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {dietary.map(d => (
                  <span key={d} className="text-xs px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300">{d}</span>
                ))}
              </div>
            )}
            {state.guestDietaryNotes && <div className="text-xs text-neutral-400">{state.guestDietaryNotes}</div>}
          </div>
        )}

        {/* Guest alert — clear button */}
        {alert && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-800/60 border border-neutral-700">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-400" />
              <span className="text-sm text-white font-semibold">
                {alert === 'order' ? 'Table is ready to order' : 'Table called for server'}
              </span>
            </div>
            <button
              onClick={() => guestAction({ guestAlert: null }, 'Alert cleared')}
              disabled={saving}
              className="text-xs px-3 py-1.5 rounded-lg bg-neutral-700 hover:bg-neutral-600 text-neutral-300 font-semibold disabled:opacity-40"
            >
              Clear
            </button>
          </div>
        )}

        {/* Guest screen controls */}
        <div>
          <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Guest Tablet</div>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[
              { label: 'Show Dining', screen: 'dining' },
              { label: 'Send to Rating', screen: 'rating' },
              { label: 'Reset Idle', screen: 'idle' },
            ].map(({ label, screen }) => (
              <button
                key={screen}
                onClick={() => guestAction({ guestScreen: screen }, `Guest screen: ${label}`)}
                disabled={saving || state?.guestScreen === screen}
                className={`px-2 py-2 rounded-lg text-xs font-semibold border transition-all ${state?.guestScreen === screen ? 'bg-neutral-700 border-neutral-500 text-white' : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:bg-neutral-700 hover:text-white disabled:opacity-40'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Bill inputs */}
          <div className="p-3 rounded-xl bg-neutral-800/60 border border-neutral-700 space-y-2">
            <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1">Send Bill to Table</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-neutral-500 block mb-1">Subtotal ($)</label>
                <input
                  type="number" min="0" step="0.01"
                  value={billSub}
                  onChange={e => setBillSub(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-neutral-900 border border-neutral-700 text-white text-sm rounded-lg px-2 py-1.5 outline-none focus:border-neutral-500"
                />
              </div>
              <div>
                <label className="text-xs text-neutral-500 block mb-1">Tax ($)</label>
                <input
                  type="number" min="0" step="0.01"
                  value={billTax}
                  onChange={e => setBillTax(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-neutral-900 border border-neutral-700 text-white text-sm rounded-lg px-2 py-1.5 outline-none focus:border-neutral-500"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={sendBill}
                disabled={saving}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-white text-neutral-900 hover:bg-neutral-200 disabled:opacity-40 transition-all"
              >
                <DollarSign className="w-3.5 h-3.5" />
                Send Bill
              </button>
              <button
                onClick={() => guestAction({ billPaid: !state?.billPaid }, state?.billPaid ? 'Marked unpaid' : 'Marked paid')}
                disabled={saving || state?.guestScreen !== 'bill'}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all disabled:opacity-40 ${state?.billPaid ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400' : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:bg-neutral-700 hover:text-white'}`}
              >
                <CheckCircle className="w-3.5 h-3.5" />
                {state?.billPaid ? 'Paid' : 'Mark Paid'}
              </button>
            </div>
          </div>

          {/* Guest rating (read-only) */}
          {state?.guestRating && (
            <div className="p-3 rounded-xl bg-neutral-800/60 border border-neutral-700 mt-2">
              <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Guest Rating</div>
              {['food', 'service', 'atmosphere'].map(k => (
                <div key={k} className="flex justify-between items-center mb-1">
                  <span className="text-xs text-neutral-400 capitalize">{k}</span>
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star key={i} className={`w-3 h-3 ${i < state.guestRating[k] ? 'text-amber-400 fill-amber-400' : 'text-neutral-700'}`} />
                    ))}
                  </div>
                </div>
              ))}
              {state.guestRating.comment && <div className="text-xs text-neutral-400 mt-2 pt-2 border-t border-neutral-700">{state.guestRating.comment}</div>}
            </div>
          )}

          {/* Guest tablet link */}
          {guestUrl && (
            <div className="mt-2 p-2 rounded-lg bg-neutral-900 border border-neutral-800">
              <div className="text-xs text-neutral-500 mb-1">Guest tablet URL</div>
              <div className="text-xs text-neutral-400 break-all font-mono">{guestUrl}</div>
            </div>
          )}
        </div>

        {/* Status buttons */}
        <div>
          <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Update Status</div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { status: 'occupied',    label: 'Occupied',    icon: Users },
              { status: 'available',   label: 'Available',   icon: CheckCircle },
              { status: 'cleaning',    label: 'Cleaning',    icon: RefreshCw },
              { status: 'unavailable', label: 'Unavailable', icon: XCircle },
            ].map(({ status, label, icon: Icon }) => {
              const m = STATUS_META[status];
              const isCurrent = (state?.status || 'available') === status;
              return (
                <button
                  key={status}
                  onClick={() => changeStatus(status)}
                  disabled={saving || isCurrent}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border transition-all ${isCurrent ? `${m.bg} ${m.border} ${m.text}` : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:bg-neutral-700 hover:text-white disabled:opacity-40'}`}
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
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

// ── Main ServerView Page ──────────────────────────────────────────────────────

export default function ServerView() {
  const { eventId: eventIdParam, subdomain } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading]         = useState(true);
  const [resolvedEid, setResolvedEid] = useState(eventIdParam || null);
  const [floorData, setFloorData]     = useState(null);
  const [forbidden, setForbidden]     = useState(null); // { message, isEnterprise }
  const [myServer, setMyServer]       = useState('');
  const [selectedId, setSelectedId]   = useState(null);
  const [pan]                         = useState({ x: 20, y: 20 });
  const [zoom]                        = useState(0.85);

  // Resolve subdomain → eventId
  useEffect(() => {
    if (!eventIdParam && subdomain) {
      eventAPI.getBySubdomain(subdomain)
        .then(res => setResolvedEid((res.data.event || res.data)._id || (res.data.event || res.data).id))
        .catch(() => setForbidden({ message: 'Event not found.' }));
    }
  }, [eventIdParam, subdomain]);

  const eid = resolvedEid;

  const loadFloor = useCallback(async () => {
    if (!eid) return;
    try {
      const res = await eventAPI.getTableServiceFloor(eid);
      const data = res.data;
      if (!data.isTableServiceMode) {
        setForbidden({ message: 'This is not a Table Service event.', isEnterprise: !!data.isEnterpriseMode });
        return;
      }
      setFloorData(data);
    } catch (err) {
      const status = err?.response?.status;
      const errData = err?.response?.data || {};
      if (status === 401 || status === 403) {
        localStorage.removeItem('eventToken');
        localStorage.removeItem('username');
        navigate(subdomain ? `/e/${subdomain}/login` : `/event/${eid}/login`);
      } else if (status === 404) {
        setForbidden({
          message: errData.error || 'Event not found.',
          isEnterprise: false,
        });
      } else {
        toast.error('Could not load floor data');
      }
    } finally {
      setLoading(false);
    }
  }, [eid, navigate, subdomain]);

  useEffect(() => {
    if (eid) loadFloor();
  }, [loadFloor, eid]);

  // Auto-refresh every 20s
  useEffect(() => {
    const t = setInterval(loadFloor, 20000);
    return () => clearInterval(t);
  }, [loadFloor]);

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
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to update table');
    }
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="h-screen bg-neutral-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-neutral-400 mx-auto mb-4" />
          <p className="text-neutral-500 text-sm">Loading floor...</p>
        </div>
      </div>
    );
  }

  // ── Forbidden / not table-service ─────────────────────────────────────────
  if (forbidden) {
    return (
      <div className="h-screen bg-neutral-950 flex items-center justify-center p-6">
        <div className="text-center max-w-sm w-full">
          <div className="w-14 h-14 bg-neutral-900 border border-neutral-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock className="w-6 h-6 text-neutral-500" />
          </div>
          <h2 className="text-white font-bold text-lg mb-2">Access Unavailable</h2>
          <p className="text-neutral-500 text-sm mb-6 leading-relaxed">{forbidden.message}</p>
          <button onClick={() => navigate('/')} className="w-full py-2.5 bg-neutral-800 text-neutral-300 rounded-xl text-sm font-semibold hover:bg-neutral-700">Return Home</button>
        </div>
      </div>
    );
  }

  if (!floorData) return null;

  const objects     = floorData.seatingMap?.objects || [];
  const tables      = objects.filter(o => o.type !== 'zone');
  const tableStates = floorData.tableStates || [];
  const settings    = floorData.settings || {};
  const servers     = settings?.servers || [];

  // My tables = tables where my name is the assigned server
  const myTables = myServer
    ? tables.filter(t => {
        const s = tableStates.find(st => st.tableId === t.id);
        return s?.serverName === myServer;
      })
    : [];

  const allOccupied = tables.filter(t => tableStates.find(s => s.tableId === t.id)?.status === 'occupied');

  const selectedObj   = objects.find(o => o.id === selectedId);
  const selectedState = tableStates.find(s => s.tableId === selectedId) || { status: 'available' };

  return (
    <div className="h-screen flex flex-col bg-neutral-950 text-white overflow-hidden">

      {/* Header */}
      <header className="flex-shrink-0 h-14 border-b border-neutral-800 bg-neutral-900/80 flex items-center px-4 gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-7 h-7 bg-white rounded-lg flex items-center justify-center flex-shrink-0">
            <Utensils className="w-4 h-4 text-neutral-900" />
          </div>
          <div className="min-w-0">
            <span className="font-bold text-white text-sm truncate">{floorData.restaurantName || 'Table Service'}</span>
            <span className="hidden sm:inline text-neutral-600 text-xs ml-2">Server View</span>
          </div>
        </div>

        {/* Server picker */}
        <div className="flex-1 flex justify-center">
          <div className="relative">
            <select
              value={myServer}
              onChange={e => { setMyServer(e.target.value); setSelectedId(null); }}
              className="appearance-none bg-neutral-800 border border-neutral-700 text-white text-sm rounded-lg pl-3 pr-8 py-1.5 outline-none focus:border-orange-500/60 cursor-pointer"
            >
              <option value="">-- Select your name --</option>
              {servers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              {servers.length === 0 && <option disabled>No servers configured</option>}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
          </div>
        </div>

        {/* Refresh */}
        <button onClick={loadFloor} className="p-2 hover:bg-neutral-800 rounded-lg text-neutral-500 hover:text-white transition-colors flex-shrink-0">
          <RefreshCw className="w-4 h-4" />
        </button>
      </header>

      {/* Main */}
      <div className="flex-1 flex overflow-hidden">

        {/* Floor */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div className="flex-1 overflow-hidden">
            {objects.length === 0 ? (
              <div className="h-full flex items-center justify-center text-center p-8">
                <div>
                  <Utensils className="w-10 h-10 text-neutral-700 mx-auto mb-3" />
                  <p className="text-neutral-500 text-sm">No floor layout configured yet.</p>
                </div>
              </div>
            ) : (
              <FloorMapReadOnly
                objects={objects}
                tableStates={tableStates}
                myServerName={myServer}
                selectedId={selectedId}
                onSelect={id => setSelectedId(prev => prev === id ? null : id)}
                zoom={zoom}
                pan={pan}
              />
            )}
          </div>

          {/* Selected table card */}
          {selectedObj && (
            <ServerTableCard
              obj={selectedObj}
              state={selectedState}
              settings={settings}
              onUpdate={handleTableUpdate}
              onClose={() => setSelectedId(null)}
              eventId={eid}
              subdomain={subdomain}
            />
            />
          )}
        </div>

        {/* Right panel */}
        <div className="w-72 xl:w-80 flex-shrink-0 border-l border-neutral-800 flex flex-col bg-neutral-900/50">

          {/* My tables */}
          <div className="p-4 border-b border-neutral-800">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-orange-400" />
              <span className="font-bold text-white text-sm">
                {myServer ? `${myServer}'s Tables` : 'My Tables'}
              </span>
              {myTables.length > 0 && (
                <span className="px-2 py-0.5 bg-orange-500/20 border border-orange-500/30 text-orange-400 text-xs font-bold rounded-full">{myTables.length}</span>
              )}
            </div>

            {!myServer ? (
              <p className="text-xs text-neutral-500">Select your name above to see your assigned tables.</p>
            ) : myTables.length === 0 ? (
              <p className="text-xs text-neutral-500">No tables assigned to you yet.</p>
            ) : (
              <div className="space-y-2">
                {myTables.map(t => {
                  const state = tableStates.find(s => s.tableId === t.id) || { status: 'available' };
                  const sm = STATUS_META[state.status] || STATUS_META.available;
                  const remaining = state.status === 'occupied' ? estimateRemaining(state, settings) : null;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setSelectedId(prev => prev === t.id ? null : t.id)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all ${selectedId === t.id ? 'bg-neutral-700 border-neutral-500' : 'bg-neutral-800/40 border-neutral-700 hover:border-neutral-500'}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white text-sm">{t.label || `Table ${t.id.slice(-3)}`}</span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${sm.bg} ${sm.border} ${sm.text}`}>{sm.label}</span>
                      </div>
                      {state.partyName && (
                        <div className="text-xs text-neutral-400 mt-1 flex items-center gap-2">
                          <span>{state.partyName}</span>
                          {state.partySize > 0 && <span><Users className="w-3 h-3 inline" /> {state.partySize}</span>}
                        </div>
                      )}
                      {remaining !== null && (
                        <div className={`text-xs font-semibold mt-1 ${remaining <= 10 ? 'text-rose-400' : 'text-neutral-500'}`}>
                          {remaining <= 0 ? 'Overdue' : `~${remaining}m remaining`}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* All occupied tables summary */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">
              All Occupied ({allOccupied.length})
            </div>
            {allOccupied.length === 0 ? (
              <p className="text-xs text-neutral-600">No tables occupied.</p>
            ) : (
              <div className="space-y-2">
                {allOccupied.map(t => {
                  const state = tableStates.find(s => s.tableId === t.id) || {};
                  const remaining = estimateRemaining(state, settings);
                  const isMine = myServer && state.serverName === myServer;
                  return (
                    <div
                      key={t.id}
                      onClick={() => setSelectedId(prev => prev === t.id ? null : t.id)}
                      className={`px-3 py-2 rounded-xl border cursor-pointer transition-all ${isMine ? 'border-orange-500/40 bg-orange-950/20' : 'border-neutral-800 bg-neutral-800/30 hover:border-neutral-600'}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-white">{t.label || `Table ${t.id.slice(-3)}`}</span>
                        <div className="flex items-center gap-2">
                          {state.serverName && (
                            <span className={`text-xs font-semibold ${isMine ? 'text-orange-400' : 'text-neutral-500'}`}>{state.serverName}</span>
                          )}
                          {remaining !== null && (
                            <span className={`text-xs font-bold ${remaining <= 10 ? 'text-rose-400' : 'text-neutral-500'}`}>
                              {remaining <= 0 ? 'OVER' : `${remaining}m`}
                            </span>
                          )}
                        </div>
                      </div>
                      {state.partyName && (
                        <div className="text-xs text-neutral-500 mt-0.5">
                          {state.partyName}{state.partySize ? ` · ${state.partySize} guests` : ''}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
