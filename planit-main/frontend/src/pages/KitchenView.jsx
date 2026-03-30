/**
 * KitchenView.jsx — Chef / Cook display screen
 *
 * Route: /event/:eventId/kitchen  OR  /e/:subdomain/kitchen
 *
 * Shows all active orders across every table in FIFO order.
 * Each ticket shows: table, server, party size, ordered items with status,
 * dietary flags, and special requests — highlighted so nothing is missed.
 *
 * Kitchen staff can update each order item status:
 *   pending → acknowledged → preparing → ready → delivered
 *
 * Auto-refreshes every 8s. Uses polling (no extra socket dependency).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { eventAPI } from '../services/api';

// ── Constants ─────────────────────────────────────────────────────────────────

const POLL_MS = 8000;

const STATUS_META = {
  pending:      { label: 'NEW',       color: '#f59e0b', bg: '#451a03', border: '#92400e' },
  acknowledged: { label: 'SEEN',      color: '#60a5fa', bg: '#172554', border: '#1d4ed8' },
  preparing:    { label: 'COOKING',   color: '#fb923c', bg: '#431407', border: '#c2410c' },
  ready:        { label: 'READY',     color: '#4ade80', bg: '#052e16', border: '#15803d' },
  delivered:    { label: 'DELIVERED', color: '#a3a3a3', bg: '#171717', border: '#404040' },
  cancelled:    { label: 'CANCELLED', color: '#f87171', bg: '#2d0a0a', border: '#991b1b' },
};

const NEXT_STATUS = {
  pending:      'acknowledged',
  acknowledged: 'preparing',
  preparing:    'ready',
  ready:        'delivered',
};

const DIETARY_COLORS = {
  V:  { label: 'Vegetarian', color: '#4ade80' },
  VG: { label: 'Vegan',      color: '#86efac' },
  GF: { label: 'Gluten-Free', color: '#fde68a' },
  NF: { label: 'Nut-Free',   color: '#fca5a5' },
  DF: { label: 'Dairy-Free', color: '#93c5fd' },
  H:  { label: 'Halal',      color: '#c4b5fd' },
  K:  { label: 'Kosher',     color: '#f9a8d4' },
};

const COURSE_ORDER = ['drink', 'appetizer', 'main', 'side', 'dessert', 'other'];

function fmt$(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

function timeAgo(dateStr) {
  const ms = Date.now() - new Date(dateStr).getTime();
  const m  = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ${m % 60}m ago`;
}

// ── Dietary pill ──────────────────────────────────────────────────────────────
function DietPill({ tag }) {
  const meta = DIETARY_COLORS[tag];
  if (!meta) return (
    <span style={{ background: '#292524', border: '1px solid #57534e', color: '#a8a29e', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4 }}>{tag}</span>
  );
  return (
    <span style={{ background: meta.color + '22', border: `1px solid ${meta.color}55`, color: meta.color, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4 }}>
      {meta.label}
    </span>
  );
}

// ── Order Item Row ────────────────────────────────────────────────────────────
function OrderRow({ order, onStatusChange, saving }) {
  const meta    = STATUS_META[order.status] || STATUS_META.pending;
  const nextSt  = NEXT_STATUS[order.status];
  const isUrgent = order.status === 'pending';

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '10px 12px',
      borderRadius: 10,
      background: isUrgent ? '#1c1209' : '#0f0f0f',
      border: `1px solid ${isUrgent ? '#92400e' : '#1c1c1c'}`,
      marginBottom: 6,
      opacity: order.status === 'delivered' ? 0.45 : 1,
      transition: 'opacity 0.2s',
    }}>
      {/* Status badge */}
      <div style={{
        flexShrink: 0, minWidth: 70,
        padding: '4px 7px', borderRadius: 6,
        background: meta.bg, border: `1px solid ${meta.border}`,
        textAlign: 'center',
      }}>
        <div style={{ fontSize: 10, fontWeight: 900, color: meta.color, letterSpacing: 0.5 }}>{meta.label}</div>
      </div>

      {/* Item details */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>
            {order.qty > 1 && <span style={{ color: '#f59e0b', marginRight: 4 }}>×{order.qty}</span>}
            {order.itemName}
          </span>
          <span style={{ fontSize: 11, color: '#525252' }}>{order.courseType}</span>
        </div>

        {/* Dietary flags */}
        {order.dietary?.length > 0 && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 5 }}>
            {order.dietary.map(d => <DietPill key={d} tag={d} />)}
          </div>
        )}

        {/* ⚠️ Special request — highlighted prominently */}
        {order.specialRequest?.trim() && (
          <div style={{
            marginTop: 6,
            padding: '5px 8px',
            borderRadius: 6,
            background: '#3d1f00',
            border: '1px solid #92400e',
            display: 'flex', alignItems: 'flex-start', gap: 6,
          }}>
            <span style={{ fontSize: 14, flexShrink: 0 }}>⚠️</span>
            <span style={{ fontSize: 12, color: '#fde68a', fontWeight: 600, lineHeight: 1.4 }}>
              {order.specialRequest}
            </span>
          </div>
        )}
      </div>

      {/* Advance status button */}
      {nextSt && (
        <button
          onClick={() => onStatusChange(order.id, nextSt)}
          disabled={saving}
          style={{
            flexShrink: 0,
            padding: '6px 11px',
            borderRadius: 8,
            background: '#22c55e',
            border: 'none',
            color: '#000',
            fontSize: 11,
            fontWeight: 800,
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.5 : 1,
            whiteSpace: 'nowrap',
          }}
        >
          {nextSt === 'acknowledged' ? 'Acknowledge' :
           nextSt === 'preparing'    ? 'Start Cooking' :
           nextSt === 'ready'        ? 'Mark Ready' : 'Delivered'}
        </button>
      )}
    </div>
  );
}

// ── Kitchen Ticket (one table's orders) ──────────────────────────────────────
function Ticket({ ticket, eventId, onRefresh }) {
  const [saving, setSaving] = useState(false);

  const handleStatusChange = async (orderId, newStatus) => {
    setSaving(true);
    try {
      await eventAPI.updateOrderStatus(eventId, ticket.tableId, orderId, newStatus);
      await onRefresh();
    } catch {
      // fail silently, next poll will sync
    } finally {
      setSaving(false);
    }
  };

  // Group items by course for clear kitchen reading
  const byCoursetype = {};
  for (const order of ticket.orders) {
    const ct = order.courseType || 'main';
    if (!byCoursetype[ct]) byCoursetype[ct] = [];
    byCoursetype[ct].push(order);
  }
  const courses = COURSE_ORDER.filter(c => byCoursetype[c]);

  const hasUrgent = ticket.orders.some(o => o.status === 'pending');
  const allReady  = ticket.orders.every(o => o.status === 'ready' || o.status === 'delivered');

  return (
    <div style={{
      background: '#111',
      border: `2px solid ${hasUrgent ? '#92400e' : allReady ? '#15803d' : '#262626'}`,
      borderRadius: 16,
      overflow: 'hidden',
      boxShadow: hasUrgent ? '0 0 24px rgba(146,64,14,0.3)' : 'none',
      transition: 'border-color 0.3s',
    }}>
      {/* Ticket header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
        background: hasUrgent ? '#1c1209' : '#161616',
        borderBottom: `1px solid ${hasUrgent ? '#92400e' : '#1c1c1c'}`,
      }}>
        {/* Table name */}
        <div style={{
          width: 42, height: 42, borderRadius: 10, flexShrink: 0,
          background: hasUrgent ? '#451a03' : '#1c1c1c',
          border: `1px solid ${hasUrgent ? '#92400e' : '#333'}`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 9, color: '#737373', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>TBL</span>
          <span style={{ fontSize: 13, color: '#fff', fontWeight: 900, lineHeight: 1 }}>
            {ticket.tableLabel.replace(/^table\s*/i, '') || '?'}
          </span>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>
            {ticket.partyName || ticket.tableLabel}
            {ticket.partySize > 0 && (
              <span style={{ fontSize: 11, color: '#737373', fontWeight: 600, marginLeft: 6 }}>
                {ticket.partySize} guests
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: '#525252', marginTop: 1 }}>
            Server: <span style={{ color: '#f97316', fontWeight: 700 }}>{ticket.serverName || 'Unassigned'}</span>
            <span style={{ marginLeft: 10, color: '#404040' }}>· {timeAgo(ticket.earliestPlacedAt)}</span>
          </div>
        </div>

        {/* Alerts */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {ticket.hasDietary && (
            <div title="Dietary restrictions" style={{
              width: 28, height: 28, borderRadius: 8,
              background: '#3d1f00', border: '1px solid #92400e',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14,
            }}>🌿</div>
          )}
          {ticket.hasSpecial && (
            <div title="Special requests" style={{
              width: 28, height: 28, borderRadius: 8,
              background: '#3d1f00', border: '1px solid #92400e',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14,
            }}>⚠️</div>
          )}
          {allReady && (
            <div style={{
              padding: '4px 8px', borderRadius: 8,
              background: '#052e16', border: '1px solid #15803d',
              fontSize: 10, fontWeight: 900, color: '#4ade80',
            }}>ALL READY</div>
          )}
        </div>
      </div>

      {/* Guest dietary summary — shown at top of ticket if present */}
      {(ticket.guestDietary?.length > 0 || ticket.guestDietaryNotes) && (
        <div style={{
          margin: '10px 12px 0',
          padding: '8px 10px',
          borderRadius: 8,
          background: '#1c1009',
          border: '1px solid #78350f',
        }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }}>
            ⚠️ Guest Dietary Restrictions
          </div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: ticket.guestDietaryNotes ? 5 : 0 }}>
            {ticket.guestDietary.map(d => (
              <span key={d} style={{ background: '#451a03', border: '1px solid #92400e', color: '#fde68a', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 5 }}>{d}</span>
            ))}
          </div>
          {ticket.guestDietaryNotes && (
            <div style={{ fontSize: 11, color: '#fbbf24', fontStyle: 'italic' }}>{ticket.guestDietaryNotes}</div>
          )}
        </div>
      )}

      {/* Order items grouped by course */}
      <div style={{ padding: '10px 12px 12px' }}>
        {courses.map(course => (
          <div key={course} style={{ marginBottom: 8 }}>
            {courses.length > 1 && (
              <div style={{ fontSize: 10, fontWeight: 800, color: '#525252', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 5 }}>
                {course}
              </div>
            )}
            {byCoursetype[course].map(order => (
              <OrderRow
                key={order.id}
                order={order}
                onStatusChange={handleStatusChange}
                saving={saving}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main KitchenView ──────────────────────────────────────────────────────────

export default function KitchenView() {
  const { eventId: eventIdParam, subdomain } = useParams();
  const navigate = useNavigate();

  const [eid, setEid]             = useState(eventIdParam || null);
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const pollRef                   = useRef(null);

  // Resolve subdomain
  useEffect(() => {
    if (!eventIdParam && subdomain) {
      eventAPI.getBySubdomain(subdomain)
        .then(res => setEid((res.data.event || res.data)._id || (res.data.event || res.data).id))
        .catch(() => setError('Venue not found.'));
    }
  }, [eventIdParam, subdomain]);

  const load = useCallback(async () => {
    if (!eid) return;
    try {
      const res = await eventAPI.getKitchenView(eid);
      setData(res.data);
      setLastRefresh(new Date());
      setError(null);
    } catch (err) {
      if (err?.response?.status === 403) {
        setError('Not a table service event.');
      } else if (err?.response?.status === 401) {
        navigate(subdomain ? `/e/${subdomain}/login` : `/event/${eid}/login`);
      } else {
        setError('Could not load kitchen data.');
      }
    } finally {
      setLoading(false);
    }
  }, [eid, navigate, subdomain]);

  useEffect(() => {
    if (eid) load();
  }, [load, eid]);

  useEffect(() => {
    pollRef.current = setInterval(load, POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [load]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ height: '100dvh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 28, height: 28, border: '3px solid #1c1c1c', borderTopColor: '#525252', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ height: '100dvh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>🍳</div>
          <div style={{ fontSize: 15, color: '#737373' }}>{error}</div>
        </div>
      </div>
    );
  }

  const tickets = data?.tickets || [];
  const restaurantName = data?.restaurantName || 'Kitchen';

  const pending    = tickets.filter(t => t.orders.some(o => o.status === 'pending')).length;
  const preparing  = tickets.filter(t => t.orders.some(o => o.status === 'preparing')).length;
  const allReady   = tickets.filter(t => t.orders.every(o => ['ready','delivered'].includes(o.status))).length;

  return (
    <div style={{
      minHeight: '100dvh',
      background: '#0a0a0a',
      color: '#fff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        height: 56, borderBottom: '1px solid #1c1c1c',
        background: 'rgba(10,10,10,0.95)', backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', gap: 16, padding: '0 20px',
      }}>
        <span style={{ fontSize: 20 }}>🍳</span>
        <div>
          <span style={{ fontWeight: 800, fontSize: 15, color: '#fff' }}>{restaurantName}</span>
          <span style={{ fontSize: 12, color: '#525252', marginLeft: 8 }}>Kitchen Display</span>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 10, marginLeft: 'auto', alignItems: 'center' }}>
          {pending > 0 && (
            <div style={{ padding: '4px 10px', borderRadius: 8, background: '#451a03', border: '1px solid #92400e', fontSize: 12, fontWeight: 800, color: '#f59e0b' }}>
              🔔 {pending} new
            </div>
          )}
          {preparing > 0 && (
            <div style={{ padding: '4px 10px', borderRadius: 8, background: '#431407', border: '1px solid #c2410c', fontSize: 12, fontWeight: 800, color: '#fb923c' }}>
              🔥 {preparing} cooking
            </div>
          )}
          {allReady > 0 && (
            <div style={{ padding: '4px 10px', borderRadius: 8, background: '#052e16', border: '1px solid #15803d', fontSize: 12, fontWeight: 800, color: '#4ade80' }}>
              ✅ {allReady} ready
            </div>
          )}
          <div style={{ fontSize: 11, color: '#404040' }}>
            Auto-refreshes · {lastRefresh ? `${Math.round((Date.now() - lastRefresh) / 1000)}s ago` : '—'}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: 16 }}>
        {tickets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#404040', marginBottom: 8 }}>All caught up</div>
            <div style={{ fontSize: 14, color: '#2d2d2d' }}>No active orders. New tickets will appear here automatically.</div>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 14,
          }}>
            {tickets.map(ticket => (
              <Ticket
                key={ticket.tableId}
                ticket={ticket}
                eventId={eid}
                onRefresh={load}
              />
            ))}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
      `}</style>
    </div>
  );
}