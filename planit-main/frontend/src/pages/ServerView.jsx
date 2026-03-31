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
  Utensils, Loader2, X, ChevronDown, Bell, DollarSign, Star, Copy, Check, Tablet,
  ShoppingCart, Plus, Minus, ClipboardList, Calculator, ChefHat, RotateCcw, AlertTriangle,
} from 'lucide-react';
import { eventAPI } from '../services/api';
import toast from 'react-hot-toast';

// ── Alert helpers ─────────────────────────────────────────────────────────────

const ALERT_LABELS = {
  'call':            { label: 'Needs assistance',     color: '#f59e0b', border: '#f59e0b40', bg: '#2d1c0060' },
  'order':           { label: 'Ready to order',       color: '#22c55e', border: '#22c55e40', bg: '#05231260' },
  'quick:water':     { label: 'Water refill requested', color: '#38bdf8', border: '#38bdf840', bg: '#08233660' },
  'quick:napkins':   { label: 'Napkins requested',    color: '#a78bfa', border: '#a78bfa40', bg: '#1e123660' },
  'quick:menu':      { label: 'Requesting menu',      color: '#fb923c', border: '#fb923c40', bg: '#2d150060' },
  'quick:dessert':   { label: 'Dessert menu requested', color: '#f472b6', border: '#f472b640', bg: '#2d103060' },
};

function AlertPopup({ alert, onGotIt, onDismiss }) {
  if (!alert) return null;
  const meta = ALERT_LABELS[alert.alertType] || ALERT_LABELS['call'];
  const timeAgo = Math.round((Date.now() - alert.arrivedAt) / 1000);
  const timeStr = timeAgo < 60 ? `${timeAgo}s ago` : `${Math.floor(timeAgo / 60)}m ago`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl border shadow-2xl overflow-hidden"
        style={{ background: '#111', borderColor: meta.border, boxShadow: `0 0 60px ${meta.color}20` }}
      >
        {/* Top accent bar */}
        <div style={{ height: 4, background: meta.color }} />

        <div className="p-6">
          {/* Alert type */}
          <div className="flex items-center gap-3 mb-5">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: meta.bg, border: `1px solid ${meta.border}` }}
            >
              <Bell className="w-5 h-5" style={{ color: meta.color }} />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-widest" style={{ color: meta.color }}>
                Table Alert
              </div>
              <div className="text-lg font-black text-white mt-0.5">{meta.label}</div>
            </div>
            <span className="ml-auto text-xs text-neutral-600 font-medium flex-shrink-0">{timeStr}</span>
          </div>

          {/* Details grid */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900 divide-y divide-neutral-800 mb-5">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Table</span>
              <span className="font-black text-white text-base">{alert.tableLabel}</span>
            </div>
            {alert.partyName && (
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Party</span>
                <span className="font-semibold text-white">{alert.partyName}</span>
              </div>
            )}
            {alert.partySize > 0 && (
              <div className="flex items-center justify-between px-4 py-3">
                <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Guests</span>
                <span className="font-semibold text-white">{alert.partySize}</span>
              </div>
            )}
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Server</span>
              <span className="font-semibold" style={{ color: alert.serverName ? '#f97316' : '#525252' }}>
                {alert.serverName || 'Unassigned'}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onGotIt}
              className="flex-1 py-3 rounded-xl font-bold text-sm transition-all"
              style={{ background: meta.color, color: '#000' }}
            >
              Got it — On my way
            </button>
            <button
              onClick={onDismiss}
              className="px-4 py-3 rounded-xl font-bold text-sm bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-all"
            >
              Snooze
            </button>
          </div>
        </div>
      </div>

      {/* Keyframes for pulse ring on map */}
      <style>{`
        @keyframes alertPulse {
          0%   { r: var(--r0); opacity: 0.8; }
          100% { r: var(--r1); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

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
        {/* Guest alert pulse ring */}
        {state.guestAlert && (() => {
          const alertMeta = ALERT_LABELS[state.guestAlert] || ALERT_LABELS['call'];
          const r0 = isRound ? w / 2 + 8 : Math.max(w, h) / 2 + 8;
          const r1 = r0 + 22;
          return (
            <circle
              cx={0} cy={0}
              fill="none"
              stroke={alertMeta.color}
              strokeWidth={3}
              style={{
                '--r0': `${r0}px`,
                '--r1': `${r1}px`,
                animation: 'alertPulse 1.2s ease-out infinite',
              }}
            />
          );
        })()}
        {/* Guest alert badge */}
        {state.guestAlert && (
          <g transform={`translate(${w / 2 - 4}, ${h / 2 - 4})`}>
            <circle cx={0} cy={0} r={9} fill={ALERT_LABELS[state.guestAlert]?.color || '#f59e0b'} />
            <text textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="8" fontWeight="800">
              {state.guestAlert === 'order' ? '!' : state.guestAlert.startsWith('quick:') ? '+' : 'S'}
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

// ── Take Order Modal (server uses this to enter items from the menu) ──────────

const DIETARY_LABELS = { V:'Veg', VG:'Vegan', GF:'GF', NF:'No Nuts', DF:'Dairy-Free', H:'Halal', K:'Kosher' };
const COURSE_ICONS   = { appetizer:'🥗', main:'🍽️', side:'🥄', dessert:'🍰', drink:'🥤', other:'✨' };

function TakeOrderModal({ obj, state, serverName, restaurantMenu, eventId, onClose, onPlaced }) {
  const [activeCat, setActiveCat]   = useState(0);
  const [cart, setCart]             = useState([]); // [{item, qty, specialRequest}]
  const [editingReq, setEditingReq] = useState(null); // itemId being edited
  const [placing, setPlacing]       = useState(false);
  const cats = restaurantMenu?.categories || [];

  const addToCart = (item) => {
    setCart(prev => {
      const ex = prev.find(c => c.item.id === item.id);
      if (ex) return prev.map(c => c.item.id === item.id ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { item, qty: 1, specialRequest: '' }];
    });
  };

  const setQty = (itemId, delta) => {
    setCart(prev => prev.map(c => c.item.id === itemId
      ? { ...c, qty: Math.max(0, c.qty + delta) }
      : c
    ).filter(c => c.qty > 0));
  };

  const setReq = (itemId, val) => {
    setCart(prev => prev.map(c => c.item.id === itemId ? { ...c, specialRequest: val } : c));
  };

  const cartTotal = cart.reduce((s, c) => s + c.item.priceCents * c.qty, 0);

  const placeOrder = async () => {
    if (cart.length === 0) return;
    setPlacing(true);
    try {
      await eventAPI.placeOrder(eventId, obj.id,
        cart.map(c => ({ itemId: c.item.id, qty: c.qty, specialRequest: c.specialRequest })),
        serverName
      );
      toast.success(`Order placed for ${obj.label || 'table'} — kitchen notified`);
      onPlaced();
      onClose();
    } catch {
      toast.error('Failed to place order');
    } finally {
      setPlacing(false);
    }
  };

  const cat = cats[activeCat] || cats[0];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)' }}>
      <div className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border border-neutral-700 shadow-2xl overflow-hidden flex flex-col"
        style={{ background: '#111', maxHeight: '90dvh' }}>

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-orange-950/60 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
            <ShoppingCart className="w-4 h-4 text-orange-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-orange-400">Take Order</p>
            <p className="text-sm font-black text-white">{obj.label} {state?.partyName ? `· ${state.partyName}` : ''}</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-neutral-800 rounded-lg text-neutral-600 hover:text-white"><X className="w-4 h-4" /></button>
        </div>

        {/* Category tabs */}
        {cats.length > 0 && (
          <div className="flex gap-2 px-4 pt-3 pb-2 overflow-x-auto flex-shrink-0" style={{ scrollbarWidth: 'none' }}>
            {cats.map((c, i) => (
              <button key={c.id} onClick={() => setActiveCat(i)}
                className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all border"
                style={{ background: i === activeCat ? '#f97316' : '#1a1a1a', borderColor: i === activeCat ? '#f97316' : '#333', color: i === activeCat ? '#000' : '#888' }}>
                {c.name}
              </button>
            ))}
          </div>
        )}

        {/* Items list */}
        <div className="flex-1 overflow-y-auto px-4 py-2" style={{ scrollbarWidth: 'thin', scrollbarColor: '#333 transparent' }}>
          {cats.length === 0 ? (
            <div className="text-center py-10 text-neutral-600 text-sm">No menu configured yet.</div>
          ) : (
            (cat?.items || []).filter(it => it.available !== false).sort((a,b) => a.ord - b.ord).map(item => {
              const cartEntry = cart.find(c => c.item.id === item.id);
              const inCart    = cartEntry ? cartEntry.qty : 0;
              return (
                <div key={item.id} className="flex items-start gap-3 py-2.5 border-b border-neutral-800/60 last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-bold text-white">{item.name}</span>
                      <span className="text-sm">{COURSE_ICONS[item.courseType]||''}</span>
                    </div>
                    {item.desc && <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">{item.desc}</p>}
                    {item.dietary?.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {item.dietary.map(d => (
                          <span key={d} className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                            style={{ background: '#451a03', color: '#fde68a', border: '1px solid #92400e' }}>
                            {DIETARY_LABELS[d]||d}
                          </span>
                        ))}
                      </div>
                    )}
                    {/* Special request field — shown when in cart */}
                    {inCart > 0 && (
                      <div className="mt-2">
                        {editingReq === item.id ? (
                          <input
                            autoFocus
                            type="text"
                            maxLength={200}
                            placeholder="Special request (optional)"
                            value={cartEntry?.specialRequest || ''}
                            onChange={e => setReq(item.id, e.target.value)}
                            onBlur={() => setEditingReq(null)}
                            className="w-full bg-neutral-900 border border-amber-800/60 text-white text-xs rounded-lg px-2 py-1.5 outline-none"
                          />
                        ) : (
                          <button onClick={() => setEditingReq(item.id)}
                            className="text-xs text-amber-500 hover:text-amber-400 flex items-center gap-1">
                            {cartEntry?.specialRequest
                              ? <><span>⚠️</span><span className="underline">{cartEntry.specialRequest}</span></>
                              : '+ Add special request'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0 flex flex-col items-end gap-2">
                    <span className="text-sm font-bold text-white">${(item.priceCents/100).toFixed(2)}</span>
                    {inCart === 0 ? (
                      <button onClick={() => addToCart(item)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all"
                        style={{ background: '#1a1a1a', border: '1px solid #333', color: '#888' }}>
                        <Plus className="w-3 h-3" /> Add
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => setQty(item.id, -1)} className="w-6 h-6 rounded-md bg-neutral-800 hover:bg-neutral-700 text-white flex items-center justify-center">
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-sm font-black text-orange-400 w-5 text-center">{inCart}</span>
                        <button onClick={() => setQty(item.id, +1)} className="w-6 h-6 rounded-md bg-neutral-800 hover:bg-neutral-700 text-white flex items-center justify-center">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Cart summary + send */}
        <div className="flex-shrink-0 border-t border-neutral-800 p-4">
          {cart.length === 0 ? (
            <p className="text-center text-xs text-neutral-600 py-1">No items added yet</p>
          ) : (
            <>
              <div className="space-y-1 mb-3 max-h-24 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                {cart.map(c => (
                  <div key={c.item.id} className="flex justify-between text-xs">
                    <span className="text-neutral-400">×{c.qty} {c.item.name}{c.specialRequest ? ' ⚠️' : ''}</span>
                    <span className="text-white font-semibold">${((c.item.priceCents * c.qty)/100).toFixed(2)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-sm font-black pt-1 border-t border-neutral-800">
                  <span className="text-white">Subtotal</span>
                  <span className="text-orange-400">${(cartTotal/100).toFixed(2)}</span>
                </div>
              </div>
              <button onClick={placeOrder} disabled={placing}
                className="w-full py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                style={{ background: '#22c55e', color: '#000' }}>
                {placing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ChefHat className="w-4 h-4" />Send to Kitchen</>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Table Detail Card (server's view — can update status) ─────────────────────

function ServerTableCard({ obj, state, settings, onUpdate, onClose, eventId, subdomain, myServer, restaurantMenu, onFloorRefresh }) {
  const [saving, setSaving] = useState(false);
  const [billSub, setBillSub] = useState(state?.billSubtotal ?? '');
  const [billTax, setBillTax] = useState(state?.billTax ?? '');
  const [calcWorking, setCalcWorking] = useState(false);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [billBreakdown, setBillBreakdown] = useState(null);
  const [resetting, setResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
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

  const autoCalcBill = async () => {
    setCalcWorking(true);
    try {
      const res = await eventAPI.calculateBill(eventId, obj.id);
      const bd = res.data.breakdown;
      setBillBreakdown(bd);
      setBillSub(res.data.billSubtotal);
      setBillTax(res.data.billTax);
      toast.success('Bill calculated and sent to table');
      if (onFloorRefresh) onFloorRefresh();
    } catch {
      toast.error('Could not calculate bill — no orders on this table?');
    } finally {
      setCalcWorking(false);
    }
  };

  const sendBill = () => {
    const sub = parseFloat(billSub);
    const tax = parseFloat(billTax);
    if (isNaN(sub) || sub < 0) { toast.error('Enter a valid subtotal'); return; }
    guestAction({ guestScreen: 'bill', billSubtotal: sub, billTax: isNaN(tax) ? 0 : tax, billPaid: false }, 'Bill sent to table');
  };

  const resetTable = async () => {
    setResetting(true);
    try {
      await eventAPI.clearTableOrders(eventId, obj.id);
      await onUpdate(obj.id, {
        status: 'available',
        partyName: '',
        partySize: 0,
        serverName: '',
        notes: '',
        guestAlert: null,
        guestScreen: 'idle',
        billSubtotal: 0,
        billTax: 0,
        billPaid: false,
        occupiedAt: null,
      });
      setBillSub('');
      setBillTax('');
      setBillBreakdown(null);
      setShowResetConfirm(false);
      toast.success(`Table ${obj.label || obj.id.slice(-3)} reset — ready for next party`);
      if (onFloorRefresh) onFloorRefresh();
    } catch {
      toast.error('Failed to reset table');
    } finally {
      setResetting(false);
    }
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

        {/* Active orders for this table */}
        {(state?.orders?.length > 0) && (() => {
          const active = state.orders.filter(o => o.status !== 'cancelled');
          if (!active.length) return null;
          const STATUS_COLOR = { pending:'text-amber-400', acknowledged:'text-blue-400', preparing:'text-orange-400', ready:'text-emerald-400', delivered:'text-neutral-500' };
          const STATUS_LABEL = { pending:'NEW', acknowledged:'Seen', preparing:'Cooking 🔥', ready:'READY ✓', delivered:'Served' };
          return (
            <div>
              <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                <ClipboardList className="w-3.5 h-3.5" /> Current Order
                <span className="ml-auto font-normal text-neutral-600">
                  ${(active.reduce((s,o)=>s+o.priceCents*o.qty,0)/100).toFixed(2)} subtotal
                </span>
              </div>
              <div className="space-y-1.5">
                {active.map(o => (
                  <div key={o.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-800/40 border border-neutral-800">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-white">
                        {o.qty > 1 && <span className="text-amber-400 mr-1">×{o.qty}</span>}{o.itemName}
                      </div>
                      {o.specialRequest && (
                        <div className="text-[10px] text-amber-400 mt-0.5">⚠️ {o.specialRequest}</div>
                      )}
                    </div>
                    <span className={`text-[10px] font-bold uppercase ${STATUS_COLOR[o.status]||'text-neutral-500'}`}>
                      {STATUS_LABEL[o.status]||o.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Take Order button */}
        {restaurantMenu?.categories?.length > 0 && (
          <div>
            <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Take Order</div>
            <button
              onClick={() => setShowOrderModal(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold border transition-all"
              style={{ background: '#1a0a00', border: '1px solid #f9731650', color: '#f97316' }}>
              <ShoppingCart className="w-4 h-4" />
              Open Menu &amp; Place Order
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
            <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1 flex items-center gap-2">
              <DollarSign className="w-3.5 h-3.5" /> Send Bill to Table
            </div>

            {/* Auto-calc from orders */}
            <button onClick={autoCalcBill} disabled={calcWorking}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold border transition-all disabled:opacity-40"
              style={{ background: '#052e16', borderColor: '#15803d', color: '#4ade80' }}>
              {calcWorking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Calculator className="w-3.5 h-3.5" />}
              Auto-Calculate from Orders + Tax + Gratuity
            </button>

            {/* Show breakdown if calculated */}
            {billBreakdown && (
              <div className="rounded-lg bg-neutral-900 border border-neutral-700 p-2 text-[10px] space-y-1">
                {billBreakdown.lineItems?.slice(0,4).map((li,i) => (
                  <div key={i} className="flex justify-between text-neutral-400">
                    <span>×{li.qty} {li.name}</span><span>${li.lineTotal}</span>
                  </div>
                ))}
                {billBreakdown.lineItems?.length > 4 && <div className="text-neutral-600">+ {billBreakdown.lineItems.length-4} more…</div>}
                <div className="flex justify-between text-neutral-400 pt-1 border-t border-neutral-800">
                  <span>Subtotal</span><span>${billBreakdown.subtotal}</span>
                </div>
                <div className="flex justify-between text-neutral-400">
                  <span>Tax ({billBreakdown.taxRate})</span><span>${billBreakdown.taxAmount}</span>
                </div>
                {billBreakdown.autoGratuity && (
                  <div className="flex justify-between text-amber-400/80">
                    <span>Auto-grat ({billBreakdown.autoGratuity.pct})</span><span>${billBreakdown.autoGratuity.amount}</span>
                  </div>
                )}
                <div className="flex justify-between text-white font-black pt-1 border-t border-neutral-800">
                  <span>Total</span><span>${billBreakdown.total}</span>
                </div>
                {billBreakdown.paymentNote && (
                  <div className="text-amber-400/80 pt-1 border-t border-neutral-800">{billBreakdown.paymentNote}</div>
                )}
              </div>
            )}

            {/* Manual override */}
            <div className="text-[10px] text-neutral-600 text-center">— or enter manually —</div>
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
                <label className="text-xs text-neutral-500 block mb-1">Tax + Grat ($)</label>
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
          {showOrderModal && (
            <TakeOrderModal
              obj={obj}
              state={state}
              serverName={myServer || ''}
              restaurantMenu={restaurantMenu}
              eventId={eventId}
              onClose={() => setShowOrderModal(false)}
              onPlaced={() => { if (onFloorRefresh) onFloorRefresh(); }}
            />
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

        {/* Reset Table */}
        <div>
          <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-2">Reset Table</div>
          {!showResetConfirm ? (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold border transition-all"
              style={{ background: '#1a0000', borderColor: '#ef444450', color: '#ef4444' }}
            >
              <RotateCcw className="w-4 h-4" />
              Reset Table for Next Party
            </button>
          ) : (
            <div className="p-3 rounded-xl border space-y-2.5" style={{ background: '#1a050505', borderColor: '#ef444440' }}>
              <div className="flex items-start gap-2 text-xs text-rose-300">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-rose-400" />
                <span>This clears <strong className="text-rose-200">all orders, bill info, and party details</strong> and marks the table Available. This cannot be undone.</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setShowResetConfirm(false)}
                  className="py-2 text-xs font-semibold rounded-lg bg-neutral-800 border border-neutral-700 text-neutral-400 hover:bg-neutral-700 hover:text-white transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={resetTable}
                  disabled={resetting}
                  className="py-2 text-xs font-semibold rounded-lg border transition-all disabled:opacity-40 flex items-center justify-center gap-1.5"
                  style={{ background: '#7f1d1d', borderColor: '#ef4444', color: '#fca5a5' }}
                >
                  {resetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                  {resetting ? 'Resetting…' : 'Yes, Reset'}
                </button>
              </div>
            </div>
          )}
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
  const [forbidden, setForbidden]     = useState(null);
  const [myServer, setMyServer]       = useState('');
  const [selectedId, setSelectedId]   = useState(null);
  const [pan]                         = useState({ x: 20, y: 20 });
  const [zoom]                        = useState(0.85);
  const [copiedUrl, setCopiedUrl]     = useState(null);
  const [urlPanelOpen, setUrlPanelOpen] = useState(false);
  const [alertQueue, setAlertQueue]   = useState([]);
  const [restaurantMenu, setRestaurantMenu] = useState(null);
  const seenAlerts                    = useRef(new Set()); // tracks "tableId::alertType" already queued

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
      setFloorData(prev => {
        // Diff incoming tableStates for new alerts
        const objects = data.seatingMap?.objects || [];
        const incoming = data.tableStates || [];
        const newAlerts = [];
        for (const s of incoming) {
          if (!s.guestAlert) continue;
          const key = `${s.tableId}::${s.guestAlert}`;
          if (seenAlerts.current.has(key)) continue;
          seenAlerts.current.add(key);
          const tableObj = objects.find(o => o.id === s.tableId);
          newAlerts.push({
            tableId:    s.tableId,
            tableLabel: tableObj?.label || s.tableId.slice(-4),
            partyName:  s.partyName  || '',
            partySize:  s.partySize  || 0,
            serverName: s.serverName || '',
            alertType:  s.guestAlert,
            arrivedAt:  Date.now(),
          });
        }
        // Prune seenAlerts for alerts that are now cleared (so they can re-fire if raised again)
        const activeKeys = new Set(incoming.filter(s => s.guestAlert).map(s => `${s.tableId}::${s.guestAlert}`));
        for (const k of seenAlerts.current) {
          if (!activeKeys.has(k)) seenAlerts.current.delete(k);
        }
        if (newAlerts.length > 0) {
          setAlertQueue(q => [...q, ...newAlerts]);
        }
        return data;
      });
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

  // Load menu once — it changes infrequently, no need to re-poll
  useEffect(() => {
    if (!eid) return;
    eventAPI.getMenu(eid).then(r => setRestaurantMenu(r.data.menu)).catch(() => {});
  }, [eid]);

  // Auto-refresh every 5s for near-instant alert detection
  useEffect(() => {
    const t = setInterval(loadFloor, 5000);
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

      {/* Alert popup — shown for the front of the queue */}
      <AlertPopup
        alert={alertQueue[0] || null}
        onGotIt={async () => {
          const a = alertQueue[0];
          if (!a) return;
          // Clear on backend
          try { await handleTableUpdate(a.tableId, { guestAlert: null }); } catch {}
          setAlertQueue(q => q.slice(1));
        }}
        onDismiss={() => setAlertQueue(q => q.slice(1))}
      />

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

        {/* Kitchen display link */}
        <button
          onClick={() => navigate(subdomain ? `/e/${subdomain}/kitchen` : `/event/${eid}/kitchen`)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white transition-all flex-shrink-0"
        >
          <ChefHat className="w-3.5 h-3.5" />
          Kitchen
        </button>

        {/* Active alert count */}
        {tableStates.filter(s => s.guestAlert).length > 0 && (
          <div className="relative flex-shrink-0">
            <Bell className="w-5 h-5 text-amber-400" />
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-amber-500 text-black text-[10px] font-black flex items-center justify-center">
              {tableStates.filter(s => s.guestAlert).length}
            </span>
          </div>
        )}
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
              myServer={myServer}
              restaurantMenu={restaurantMenu}
              onFloorRefresh={loadFloor}
            />
          )}
        </div>

        {/* Right panel */}
        <div className="w-72 xl:w-80 flex-shrink-0 border-l border-neutral-800 flex flex-col bg-neutral-900/50">

          {/* My tables */}
          <div className="flex flex-col border-b border-neutral-800" style={{ maxHeight: '34%' }}>
            <div className="flex items-center gap-2 px-4 pt-4 pb-2 flex-shrink-0">
              <Users className="w-4 h-4 text-orange-400" />
              <span className="font-bold text-white text-sm">
                {myServer ? `${myServer}'s Tables` : 'My Tables'}
              </span>
              {myTables.length > 0 && (
                <span className="px-2 py-0.5 bg-orange-500/20 border border-orange-500/30 text-orange-400 text-xs font-bold rounded-full">{myTables.length}</span>
              )}
            </div>

            <div className="overflow-y-auto flex-1 px-4 pb-4" style={{ scrollbarWidth: 'thin', scrollbarColor: '#404040 transparent' }}>
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
          </div>

          {/* All occupied tables summary */}
          <div className="flex-1 overflow-y-auto p-4" style={{ scrollbarWidth: 'thin', scrollbarColor: '#404040 transparent' }}>
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

          {/* Tablet URLs panel */}
          <div className="border-t border-neutral-800 flex-shrink-0">
            <button
              onClick={() => setUrlPanelOpen(p => !p)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-neutral-800/40 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Tablet className="w-4 h-4 text-neutral-400" />
                <span className="text-sm font-bold text-neutral-300">Tablet URLs</span>
                <span className="text-xs text-neutral-600 font-medium">({tables.length})</span>
              </div>
              <ChevronDown className={`w-4 h-4 text-neutral-500 transition-transform duration-200 ${urlPanelOpen ? 'rotate-180' : ''}`} />
            </button>
            {urlPanelOpen && (
              <div className="overflow-y-auto px-4 pb-3 space-y-2" style={{ maxHeight: 220, scrollbarWidth: 'thin', scrollbarColor: '#404040 transparent' }}>
                {tables.length === 0 ? (
                  <p className="text-xs text-neutral-600 pb-2">No tables configured.</p>
                ) : tables.map(t => {
                  const base = window.location.origin;
                  const url = subdomain
                    ? `${base}/e/${subdomain}/table/${t.id}`
                    : `${base}/event/${eid}/table/${t.id}`;
                  const isCopied = copiedUrl === t.id;
                  return (
                    <div key={t.id} className="bg-neutral-900 border border-neutral-800 rounded-xl p-2.5">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-bold text-white">{t.label || `Table ${t.id.slice(-3)}`}</span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(url).then(() => {
                              setCopiedUrl(t.id);
                              setTimeout(() => setCopiedUrl(null), 2000);
                            });
                          }}
                          className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg border transition-all ${isCopied ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400' : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:text-white hover:border-neutral-500'}`}
                        >
                          {isCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          {isCopied ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                      <p className="text-xs text-neutral-600 font-mono truncate">{url}</p>
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
