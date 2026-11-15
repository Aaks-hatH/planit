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
 * Dietary restrictions require DOUBLE confirmation before any status advance.
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
  V:  { label: 'Vegetarian',  color: '#4ade80' },
  VG: { label: 'Vegan',       color: '#86efac' },
  GF: { label: 'Gluten-Free', color: '#fde68a' },
  NF: { label: 'Nut-Free',    color: '#fca5a5' },
  DF: { label: 'Dairy-Free',  color: '#93c5fd' },
  H:  { label: 'Halal',       color: '#c4b5fd' },
  K:  { label: 'Kosher',      color: '#f9a8d4' },
};

const COURSE_ORDER = ['drink', 'appetizer', 'main', 'side', 'dessert', 'other'];

function timeAgo(dateStr) {
  const ms = Date.now() - new Date(dateStr).getTime();
  const m  = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ${m % 60}m ago`;
}

// ── SVG Icons (replaces all emojis) ──────────────────────────────────────────

function IconWarning({ size = 14, color = '#f59e0b' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  );
}

function IconLeaf({ size = 14, color = '#4ade80' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M6 3C10 3 20 3 21 12C21 20 12 22 8 16"/>
      <path d="M3 21C3 21 6 16 6 11C6 7 3 3 3 3"/>
    </svg>
  );
}

function IconCheck({ size = 14, color = '#4ade80' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

function IconFire({ size = 14, color = '#fb923c' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M12 2C12 2 8 7 8 13C8 16.3 10 18 12 18C14 18 16 16.3 16 13C16 9 14 6 12 2Z"/>
      <path d="M12 18C12 18 9 20 9 22H15C15 20 12 18 12 18Z"/>
    </svg>
  );
}

function IconBell({ size = 14, color = '#f59e0b' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 01-3.46 0"/>
    </svg>
  );
}

function IconKitchen({ size = 20, color = 'rgba(255,255,255,0.55)' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <rect x="2" y="7" width="20" height="15" rx="2"/>
      <path d="M16 7V5a2 2 0 00-4 0v2"/>
      <line x1="12" y1="12" x2="12" y2="16"/>
      <line x1="10" y1="14" x2="14" y2="14"/>
    </svg>
  );
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

// ── Dietary Double-Confirmation Modal ─────────────────────────────────────────
function DietaryConfirmModal({ ticket, order, onConfirm, onCancel }) {
  const [step, setStep] = useState(1);

  const allDietary = [
    ...(ticket.guestDietary || []),
    ...(order?.dietary || []),
  ].filter((v, i, a) => a.indexOf(v) === i);

  const allNotes = [
    ticket.guestDietaryNotes,
    order?.specialRequest,
  ].filter(Boolean);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        background: '#111',
        border: '2px solid #92400e',
        borderRadius: 18,
        maxWidth: 440,
        width: '100%',
        overflow: 'hidden',
        boxShadow: '0 0 40px rgba(146,64,14,0.4)',
      }}>
        {/* Modal header */}
        <div style={{
          padding: '16px 20px',
          background: '#1c1209',
          borderBottom: '1px solid #92400e',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <IconWarning size={18} color="#f59e0b" />
          <div>
            <div style={{ fontSize: 14, fontWeight: 900, color: '#fbbf24', letterSpacing: 0.3 }}>
              {step === 1 ? 'Dietary Restriction Alert' : 'Final Confirmation Required'}
            </div>
            <div style={{ fontSize: 11, color: '#92400e', marginTop: 2 }}>
              Step {step} of 2 — Table {ticket.tableLabel}
            </div>
          </div>
        </div>

        {/* Step progress bar */}
        <div style={{ display: 'flex', gap: 0, height: 3 }}>
          <div style={{ flex: 1, background: '#f59e0b' }} />
          <div style={{ flex: 1, background: step === 2 ? '#f59e0b' : '#2d2d2d', transition: 'background 0.3s' }} />
        </div>

        <div style={{ padding: '18px 20px 20px' }}>
          {step === 1 ? (
            <>
              <p style={{ fontSize: 13, color: '#d1d5db', lineHeight: 1.6, marginBottom: 16, marginTop: 0 }}>
                This order has <strong style={{ color: '#fbbf24' }}>dietary restrictions</strong>.
                Review all requirements below before proceeding.
              </p>

              {allDietary.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#737373', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                    Active Restrictions
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {allDietary.map(d => {
                      const meta = DIETARY_COLORS[d];
                      return (
                        <span key={d} style={{
                          background: meta ? meta.color + '22' : '#292524',
                          border: `1px solid ${meta ? meta.color + '55' : '#57534e'}`,
                          color: meta ? meta.color : '#a8a29e',
                          fontSize: 12, fontWeight: 800,
                          padding: '4px 10px', borderRadius: 6,
                        }}>
                          {meta ? meta.label : d}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {allNotes.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#737373', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                    Special Notes
                  </div>
                  {allNotes.map((note, i) => (
                    <div key={i} style={{
                      padding: '8px 12px', borderRadius: 8,
                      background: '#1c1209', border: '1px solid #78350f',
                      fontSize: 12, color: '#fde68a', lineHeight: 1.5,
                      marginBottom: 6,
                    }}>
                      {note}
                    </div>
                  ))}
                </div>
              )}

              <div style={{
                padding: '10px 12px', borderRadius: 8,
                background: '#0f1f0f', border: '1px solid #15803d',
                fontSize: 12, color: '#86efac', marginBottom: 18,
              }}>
                <strong>Step 1:</strong> Confirm you have read and understood all dietary requirements for this order.
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={onCancel} style={{ flex: 1, padding: '10px', borderRadius: 10, background: '#1c1c1c', border: '1px solid #333', color: '#737373', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  Cancel
                </button>
                <button onClick={() => setStep(2)} style={{ flex: 2, padding: '10px', borderRadius: 10, background: '#78350f', border: '1px solid #92400e', color: '#fbbf24', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
                  I Have Reviewed the Restrictions
                </button>
              </div>
            </>
          ) : (
            <>
              <p style={{ fontSize: 13, color: '#d1d5db', lineHeight: 1.6, marginBottom: 16, marginTop: 0 }}>
                <strong style={{ color: '#fbbf24' }}>Second confirmation required.</strong> By proceeding, you confirm this order will be prepared in full compliance with all dietary restrictions.
              </p>

              {allDietary.length > 0 && (
                <div style={{ padding: '10px 14px', borderRadius: 10, background: '#1c1209', border: '1px solid #92400e', marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#92400e', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>
                    Applying these restrictions
                  </div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {allDietary.map(d => {
                      const meta = DIETARY_COLORS[d];
                      return (
                        <span key={d} style={{ background: '#451a03', border: '1px solid #92400e', color: '#fde68a', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 5 }}>
                          {meta ? meta.label : d}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ padding: '10px 12px', borderRadius: 8, background: '#0f1f0f', border: '1px solid #15803d', fontSize: 12, color: '#86efac', marginBottom: 18, lineHeight: 1.5 }}>
                <strong>Step 2:</strong> Confirm this order will be prepared according to all stated requirements. Cross-contamination risks have been considered.
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setStep(1)} style={{ flex: 1, padding: '10px', borderRadius: 10, background: '#1c1c1c', border: '1px solid #333', color: '#737373', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                  Back
                </button>
                <button onClick={onConfirm} style={{ flex: 2, padding: '10px', borderRadius: 10, background: '#15803d', border: '1px solid #22c55e', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>
                  Confirmed — Proceed
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
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
            {order.qty > 1 && <span style={{ color: '#f59e0b', marginRight: 4 }}>x{order.qty}</span>}
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

        {/* Special request — highlighted, no emoji */}
        {order.specialRequest?.trim() && (
          <div style={{
            marginTop: 6, padding: '5px 8px', borderRadius: 6,
            background: '#3d1f00', border: '1px solid #92400e',
            display: 'flex', alignItems: 'flex-start', gap: 6,
          }}>
            <IconWarning size={13} color="#fbbf24" />
            <span style={{ fontSize: 12, color: '#fde68a', fontWeight: 600, lineHeight: 1.4 }}>
              {order.specialRequest}
            </span>
          </div>
        )}
      </div>

      {/* Advance status button */}
      {nextSt && (
        <button
          onClick={() => onStatusChange(order, nextSt)}
          disabled={saving}
          style={{
            flexShrink: 0, padding: '6px 11px', borderRadius: 8,
            background: '#22c55e', border: 'none', color: '#000',
            fontSize: 11, fontWeight: 800,
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
  const [saving, setSaving]   = useState(false);
  const [pending, setPending] = useState(null); // { order, targetStatus }

  const hasDietaryRestrictions = (order) =>
    (ticket.guestDietary?.length > 0) || (order?.dietary?.length > 0);

  // When chef taps an advance button — gate behind dietary confirm if needed
  const handleAdvanceRequest = (order, newStatus) => {
    if (hasDietaryRestrictions(order)) {
      setPending({ order, targetStatus: newStatus });
    } else {
      commitStatusChange(order.id, newStatus);
    }
  };

  const commitStatusChange = async (orderId, newStatus) => {
    setSaving(true);
    setPending(null);
    try {
      await eventAPI.updateOrderStatus(eventId, ticket.tableId, orderId, newStatus);
      await onRefresh();
    } catch {
      // fail silently — next poll syncs
    } finally {
      setSaving(false);
    }
  };

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
    <>
      {pending && (
        <DietaryConfirmModal
          ticket={ticket}
          order={pending.order}
          targetStatus={pending.targetStatus}
          onConfirm={() => commitStatusChange(pending.order.id, pending.targetStatus)}
          onCancel={() => setPending(null)}
        />
      )}

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
          {/* Table icon */}
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

          {/* Alert icons — SVG, no emojis */}
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            {ticket.hasDietary && (
              <div title="Dietary restrictions present" style={{
                width: 28, height: 28, borderRadius: 8,
                background: '#3d1f00', border: '1px solid #92400e',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <IconLeaf size={13} color="#4ade80" />
              </div>
            )}
            {ticket.hasSpecial && (
              <div title="Special requests present" style={{
                width: 28, height: 28, borderRadius: 8,
                background: '#3d1f00', border: '1px solid #92400e',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <IconWarning size={13} color="#fbbf24" />
              </div>
            )}
            {allReady && (
              <div style={{
                padding: '4px 8px', borderRadius: 8,
                background: '#052e16', border: '1px solid #15803d',
                fontSize: 10, fontWeight: 900, color: '#4ade80',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <IconCheck size={10} color="#4ade80" />
                ALL READY
              </div>
            )}
          </div>
        </div>

        {/* Guest dietary summary */}
        {(ticket.guestDietary?.length > 0 || ticket.guestDietaryNotes) && (
          <div style={{
            margin: '10px 12px 0', padding: '8px 10px', borderRadius: 8,
            background: '#1c1009', border: '1px solid #78350f',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
              <IconWarning size={11} color="#f59e0b" />
              <span style={{ fontSize: 10, fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Guest Dietary Restrictions
              </span>
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
                  onStatusChange={handleAdvanceRequest}
                  saving={saving}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ── Main KitchenView ──────────────────────────────────────────────────────────

export default function KitchenView() {
  const { eventId: eventIdParam, subdomain } = useParams();
  const navigate = useNavigate();

  const [eid, setEid]                 = useState(eventIdParam || null);
  const [data, setData]               = useState(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const pollRef                       = useRef(null);

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
        navigate(subdomain ? `/e/${subdomain}` : `/event/${eid}`);
      } else {
        setError('Could not load kitchen data.');
      }
    } finally {
      setLoading(false);
    }
  }, [eid, navigate, subdomain]);

  useEffect(() => { if (eid) load(); }, [load, eid]);

  useEffect(() => {
    pollRef.current = setInterval(load, POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [load]);

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
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <IconKitchen size={32} color="#525252" />
          </div>
          <div style={{ fontSize: 15, color: '#737373' }}>{error}</div>
        </div>
      </div>
    );
  }

  const tickets        = data?.tickets || [];
  const restaurantName = data?.restaurantName || 'Kitchen';
  const pendingCount   = tickets.filter(t => t.orders.some(o => o.status === 'pending')).length;
  const preparingCount = tickets.filter(t => t.orders.some(o => o.status === 'preparing')).length;
  const allReadyCount  = tickets.filter(t => t.orders.every(o => ['ready','delivered'].includes(o.status))).length;

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
        <IconKitchen size={20} color="rgba(255,255,255,0.45)" />
        <div>
          <span style={{ fontWeight: 800, fontSize: 15, color: '#fff' }}>{restaurantName}</span>
          <span style={{ fontSize: 12, color: '#525252', marginLeft: 8 }}>Kitchen Display</span>
        </div>

        <div style={{ display: 'flex', gap: 10, marginLeft: 'auto', alignItems: 'center' }}>
          {pendingCount > 0 && (
            <div style={{ padding: '4px 10px', borderRadius: 8, background: '#451a03', border: '1px solid #92400e', fontSize: 12, fontWeight: 800, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 5 }}>
              <IconBell size={11} color="#f59e0b" /> {pendingCount} new
            </div>
          )}
          {preparingCount > 0 && (
            <div style={{ padding: '4px 10px', borderRadius: 8, background: '#431407', border: '1px solid #c2410c', fontSize: 12, fontWeight: 800, color: '#fb923c', display: 'flex', alignItems: 'center', gap: 5 }}>
              <IconFire size={11} color="#fb923c" /> {preparingCount} cooking
            </div>
          )}
          {allReadyCount > 0 && (
            <div style={{ padding: '4px 10px', borderRadius: 8, background: '#052e16', border: '1px solid #15803d', fontSize: 12, fontWeight: 800, color: '#4ade80', display: 'flex', alignItems: 'center', gap: 5 }}>
              <IconCheck size={11} color="#4ade80" /> {allReadyCount} ready
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
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <IconCheck size={48} color="#2d2d2d" />
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#404040', marginBottom: 8 }}>All caught up</div>
            <div style={{ fontSize: 14, color: '#2d2d2d' }}>No active orders. New tickets will appear here automatically.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
            {tickets.map(ticket => (
              <Ticket key={ticket.tableId} ticket={ticket} eventId={eid} onRefresh={load} />
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