/**
 * GuestTablet.jsx — Customer-facing kiosk page for table service.
 *
 * Route: /event/:eventId/table/:tableId  OR  /e/:subdomain/table/:tableId
 *
 * LOCKED DOWN:
 *  - No navigation links or escape routes
 *  - Context menu disabled
 *  - Text selection disabled
 *  - Back/forward gesture blocked
 *  - All interaction scoped to this table only
 *
 * Screen states (controlled by guestScreen field on tableState):
 *   idle    — welcome / tap to begin
 *   dining  — call server, dietary restrictions, ready to order
 *   bill    — bill view + tip calculator (read-only totals, guest picks tip %)
 *   rating  — star ratings + comment, then back to idle
 *
 * Guest can write: guestAlert, guestDietary, guestDietaryNotes, tipPct, guestRating
 * Server controls: guestScreen, billSubtotal, billTax, billPaid
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { eventAPI } from '../services/api';

// ── Constants ─────────────────────────────────────────────────────────────────

const DIETARY_OPTIONS = [
  'Vegetarian', 'Vegan', 'Gluten-Free', 'Nut Allergy',
  'Dairy-Free', 'Shellfish', 'Soy', 'Kosher', 'Halal', 'Low-Sodium',
];

const TIP_PRESETS = [15, 18, 20, 22];

const POLL_MS = 8000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt$(n) {
  if (n == null || isNaN(n)) return '$0.00';
  return `$${Number(n).toFixed(2)}`;
}

function starArr(val, set) {
  return Array.from({ length: 5 }, (_, i) => (
    <button
      key={i}
      onPointerDown={() => set(i + 1)}
      style={{
        background: 'none', border: 'none', padding: '0 4px',
        fontSize: 32, color: i < val ? '#f59e0b' : '#404040',
        cursor: 'pointer', lineHeight: 1,
      }}
    >
      {i < val ? '\u2605' : '\u2606'}
    </button>
  ));
}

// ── Screens ───────────────────────────────────────────────────────────────────

function IdleScreen({ tableName, onBegin }) {
  return (
    <div style={S.centerCol}>
      <div style={S.logo}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 11l19-9-9 19-2-8-8-2z"/>
        </svg>
      </div>
      <div style={{ fontSize: 13, color: '#737373', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12 }}>Table Service</div>
      <div style={{ fontSize: 42, fontWeight: 800, color: '#fff', marginBottom: 8 }}>{tableName}</div>
      <div style={{ fontSize: 15, color: '#525252', marginBottom: 56 }}>Your server will be with you shortly.</div>
      <button style={S.primaryBtn} onPointerDown={onBegin}>Tap to Begin</button>
    </div>
  );
}

function DiningScreen({ tableState, tableObj, onSignal, onSaveDietary, saving }) {
  const [diet, setDiet]   = useState(tableState?.guestDietary || []);
  const [notes, setNotes] = useState(tableState?.guestDietaryNotes || '');
  const [dietOpen, setDietOpen] = useState(false);
  const [dietSaved, setDietSaved] = useState(false);
  const alert = tableState?.guestAlert;

  const toggle = (opt) => setDiet(prev =>
    prev.includes(opt) ? prev.filter(x => x !== opt) : [...prev, opt]
  );

  const handleSaveDiet = async () => {
    await onSaveDietary({ guestDietary: diet, guestDietaryNotes: notes });
    setDietSaved(true);
    setTimeout(() => setDietSaved(false), 2000);
  };

  const alertPending = alert === 'call' || alert === 'order';

  return (
    <div style={{ ...S.page, overflowY: 'auto' }}>
      <div style={S.tableTag}>{tableObj?.label || 'Table'}</div>

      {/* Alert status */}
      {alertPending && (
        <div style={S.alertBanner}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b', animation: 'pulse 1.5s infinite' }} />
          <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: 14 }}>
            {alert === 'call' ? 'Server has been notified — they are on their way.' : 'Order request sent — your server will be right over.'}
          </span>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 28 }}>
        <button
          style={{ ...S.actionBtn, opacity: alertPending || saving ? 0.5 : 1 }}
          disabled={alertPending || saving}
          onPointerDown={() => onSignal('call')}
        >
          <div style={{ fontSize: 28, marginBottom: 8 }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>Call Server</span>
          <span style={{ fontSize: 12, color: '#737373', marginTop: 4 }}>Need assistance</span>
        </button>

        <button
          style={{ ...S.actionBtn, opacity: alertPending || saving ? 0.5 : 1 }}
          disabled={alertPending || saving}
          onPointerDown={() => onSignal('order')}
        >
          <div style={{ fontSize: 28, marginBottom: 8 }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>Ready to Order</span>
          <span style={{ fontSize: 12, color: '#737373', marginTop: 4 }}>Notify your server</span>
        </button>
      </div>

      {/* Dietary restrictions */}
      <div style={S.card}>
        <button
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#fff' }}
          onPointerDown={() => setDietOpen(p => !p)}
        >
          <span style={{ fontWeight: 700, fontSize: 14 }}>Dietary Restrictions</span>
          <span style={{ fontSize: 20, color: '#525252', transform: dietOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>&#8964;</span>
        </button>

        {diet.length > 0 && !dietOpen && (
          <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {diet.map(d => <span key={d} style={S.tag}>{d}</span>)}
          </div>
        )}

        {dietOpen && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              {DIETARY_OPTIONS.map(opt => (
                <button
                  key={opt}
                  onPointerDown={() => toggle(opt)}
                  style={{
                    ...S.dietBtn,
                    background: diet.includes(opt) ? 'rgba(245,158,11,0.15)' : '#1a1a1a',
                    border: `1px solid ${diet.includes(opt) ? '#f59e0b' : '#2a2a2a'}`,
                    color: diet.includes(opt) ? '#f59e0b' : '#a3a3a3',
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Other notes or allergies..."
              rows={2}
              maxLength={200}
              style={S.textarea}
            />
            <button
              style={{ ...S.primaryBtn, marginTop: 10, fontSize: 13, padding: '10px 20px' }}
              onPointerDown={handleSaveDiet}
              disabled={saving}
            >
              {dietSaved ? 'Saved' : 'Save Preferences'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function BillScreen({ tableState }) {
  const sub  = Number(tableState?.billSubtotal) || 0;
  const tax  = Number(tableState?.billTax) || 0;
  const paid = tableState?.billPaid;
  const [tipPct, setTipPct] = useState(tableState?.tipPct || 18);
  const [customTip, setCustomTip] = useState('');
  const [useCustom, setUseCustom] = useState(false);

  const activeTip = useCustom ? (parseFloat(customTip) || 0) : tipPct;
  const tipAmt  = sub * (activeTip / 100);
  const total   = sub + tax + tipAmt;

  return (
    <div style={{ ...S.page, overflowY: 'auto' }}>
      <div style={S.tableTag}>{paid ? 'Paid' : 'Your Bill'}</div>

      {paid && (
        <div style={{ ...S.alertBanner, borderColor: '#22c55e33', background: '#052e1680' }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#22c55e' }} />
          <span style={{ color: '#22c55e', fontWeight: 700, fontSize: 14 }}>Payment confirmed. Thank you for dining with us.</span>
        </div>
      )}

      {/* Bill breakdown */}
      <div style={S.card}>
        <div style={S.billRow}>
          <span style={{ color: '#a3a3a3' }}>Subtotal</span>
          <span style={{ color: '#fff', fontWeight: 600 }}>{fmt$(sub)}</span>
        </div>
        <div style={S.billRow}>
          <span style={{ color: '#a3a3a3' }}>Tax</span>
          <span style={{ color: '#fff', fontWeight: 600 }}>{fmt$(tax)}</span>
        </div>
        <div style={{ ...S.billRow, borderTop: '1px solid #2a2a2a', marginTop: 8, paddingTop: 12 }}>
          <span style={{ color: '#a3a3a3' }}>Tip ({activeTip}%)</span>
          <span style={{ color: '#f59e0b', fontWeight: 600 }}>{fmt$(tipAmt)}</span>
        </div>
        <div style={{ ...S.billRow, marginTop: 4 }}>
          <span style={{ color: '#fff', fontWeight: 800, fontSize: 18 }}>Total</span>
          <span style={{ color: '#fff', fontWeight: 800, fontSize: 22 }}>{fmt$(total)}</span>
        </div>
      </div>

      {/* Tip selector — read-only if paid */}
      {!paid && (
        <div style={S.card}>
          <div style={{ fontSize: 12, color: '#737373', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Tip</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 10 }}>
            {TIP_PRESETS.map(p => (
              <button
                key={p}
                onPointerDown={() => { setUseCustom(false); setTipPct(p); }}
                style={{
                  ...S.tipBtn,
                  background: !useCustom && tipPct === p ? 'rgba(245,158,11,0.15)' : '#1a1a1a',
                  border: `1px solid ${!useCustom && tipPct === p ? '#f59e0b' : '#2a2a2a'}`,
                  color: !useCustom && tipPct === p ? '#f59e0b' : '#a3a3a3',
                }}
              >
                {p}%
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onPointerDown={() => setUseCustom(p => !p)}
              style={{
                ...S.tipBtn,
                flex: 'none',
                background: useCustom ? 'rgba(245,158,11,0.15)' : '#1a1a1a',
                border: `1px solid ${useCustom ? '#f59e0b' : '#2a2a2a'}`,
                color: useCustom ? '#f59e0b' : '#a3a3a3',
              }}
            >
              Custom
            </button>
            {useCustom && (
              <input
                type="number"
                min="0"
                max="100"
                value={customTip}
                onChange={e => setCustomTip(e.target.value)}
                placeholder="%"
                style={{ ...S.textarea, flex: 1, padding: '8px 12px', fontSize: 15, margin: 0 }}
              />
            )}
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: '#525252' }}>
            Tip amount is a suggestion. Your server will process payment.
          </div>
        </div>
      )}
    </div>
  );
}

function RatingScreen({ onSubmit, saving }) {
  const [food, setFood]       = useState(0);
  const [service, setSvc]     = useState(0);
  const [atmosphere, setAtmo] = useState(0);
  const [comment, setComment] = useState('');
  const [done, setDone]       = useState(false);

  const handleSubmit = async () => {
    if (!food || !service || !atmosphere) return;
    await onSubmit({ food, service, atmosphere, comment });
    setDone(true);
  };

  if (done) {
    return (
      <div style={S.centerCol}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#052e16', border: '2px solid #22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 8 }}>Thank You</div>
        <div style={{ fontSize: 14, color: '#525252' }}>Your feedback means a lot to us.</div>
      </div>
    );
  }

  return (
    <div style={{ ...S.page, overflowY: 'auto' }}>
      <div style={S.tableTag}>How was your experience?</div>

      <div style={S.card}>
        {[
          { label: 'Food', val: food, set: setFood },
          { label: 'Service', val: service, set: setSvc },
          { label: 'Atmosphere', val: atmosphere, set: setAtmo },
        ].map(({ label, val, set }) => (
          <div key={label} style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: '#a3a3a3', fontWeight: 600, marginBottom: 6 }}>{label}</div>
            <div style={{ display: 'flex', gap: 0 }}>{starArr(val, set)}</div>
          </div>
        ))}

        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Any additional comments (optional)"
          rows={3}
          maxLength={300}
          style={S.textarea}
        />

        <button
          style={{
            ...S.primaryBtn,
            marginTop: 16,
            opacity: (!food || !service || !atmosphere || saving) ? 0.4 : 1,
          }}
          disabled={!food || !service || !atmosphere || saving}
          onPointerDown={handleSubmit}
        >
          Submit Feedback
        </button>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const S = {
  page: {
    minHeight: '100%',
    padding: '24px 20px 40px',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  centerCol: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    textAlign: 'center',
  },
  logo: {
    width: 52, height: 52,
    borderRadius: 14,
    background: '#1a1a1a',
    border: '1px solid #2a2a2a',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  tableTag: {
    fontSize: 13, fontWeight: 700, color: '#737373',
    textTransform: 'uppercase', letterSpacing: 2,
    marginBottom: 4,
  },
  alertBanner: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '12px 16px',
    borderRadius: 12,
    background: '#2d1c0080',
    border: '1px solid #f59e0b33',
  },
  primaryBtn: {
    background: '#fff',
    color: '#000',
    border: 'none',
    borderRadius: 12,
    padding: '14px 32px',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    width: '100%',
  },
  actionBtn: {
    background: '#141414',
    border: '1px solid #2a2a2a',
    borderRadius: 16,
    padding: '20px 12px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    cursor: 'pointer',
    transition: 'border-color 0.15s',
  },
  card: {
    background: '#141414',
    border: '1px solid #1f1f1f',
    borderRadius: 16,
    padding: 20,
  },
  tag: {
    background: 'rgba(245,158,11,0.1)',
    border: '1px solid rgba(245,158,11,0.3)',
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: 600,
    padding: '3px 8px',
    borderRadius: 6,
  },
  dietBtn: {
    borderRadius: 8,
    padding: '9px 6px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  textarea: {
    width: '100%',
    background: '#0d0d0d',
    border: '1px solid #2a2a2a',
    borderRadius: 10,
    color: '#fff',
    fontSize: 14,
    padding: '10px 12px',
    outline: 'none',
    resize: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  billRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tipBtn: {
    borderRadius: 8,
    padding: '10px 6px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.15s',
    textAlign: 'center',
  },
};

// ── Main Component ────────────────────────────────────────────────────────────

export default function GuestTablet() {
  const { eventId: eventIdParam, subdomain, tableId } = useParams();

  const [eid, setEid]             = useState(eventIdParam || null);
  const [tableState, setTableState] = useState(null);
  const [tableObj, setTableObj]   = useState(null);
  const [venueName, setVenueName] = useState('');
  const [error, setError]         = useState(null);
  const [saving, setSaving]       = useState(false);
  const pollRef                   = useRef(null);
  const lastScreenRef             = useRef(null);

  // Lockdown: block context menu, text selection, back gesture
  useEffect(() => {
    const noCtx = e => e.preventDefault();
    const noSel = () => { document.execCommand && document.execCommand('selectAll', false, null); };
    document.addEventListener('contextmenu', noCtx);
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
    // Block back navigation by pushing a state
    window.history.pushState(null, '', window.location.href);
    const noBack = () => window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', noBack);
    return () => {
      document.removeEventListener('contextmenu', noCtx);
      document.body.style.userSelect = '';
      document.body.style.webkitUserSelect = '';
      window.removeEventListener('popstate', noBack);
    };
  }, []);

  // Resolve subdomain to eventId
  useEffect(() => {
    if (!eventIdParam && subdomain) {
      eventAPI.getBySubdomain(subdomain)
        .then(res => setEid((res.data.event || res.data)._id || (res.data.event || res.data).id))
        .catch(() => setError('Venue not found.'));
    }
  }, [eventIdParam, subdomain]);

  const fetchState = useCallback(async () => {
    if (!eid || !tableId) return;
    try {
      const res = await eventAPI.getGuestTableState(eid, tableId);
      const d = res.data;
      if (!d.table) { setError('Table not found.'); return; }
      setVenueName(d.venueName || '');
      setTableObj(d.table);
      // Map flat guest response back into the shape the screens expect
      setTableState({
        guestScreen:       d.guestScreen,
        guestAlert:        d.guestAlert,
        guestDietary:      d.guestDietary,
        guestDietaryNotes: d.guestDietaryNotes,
        billSubtotal:      d.billSubtotal,
        billTax:           d.billTax,
        billPaid:          d.billPaid,
        tipPct:            d.tipPct,
      });
    } catch {
      // Silently retry on poll failure
    }
  }, [eid, tableId]);

  // Initial load + polling
  useEffect(() => {
    if (!eid) return;
    fetchState();
    pollRef.current = setInterval(fetchState, POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [fetchState, eid]);

  const patchState = useCallback(async (updates) => {
    if (!eid || !tableId) return;
    setSaving(true);
    try {
      const res = await eventAPI.updateGuestTable(eid, tableId, updates);
      const d = res.data;
      setTableState(prev => ({ ...prev, ...d }));
    } catch {
      // fail silently on guest side
    } finally {
      setSaving(false);
    }
  }, [eid, tableId]);

  const handleBegin = () => patchState({ guestScreen: 'dining' });

  const handleSignal = (type) => patchState({ guestAlert: type });

  const handleSaveDietary = (data) => patchState(data);

  const handleRating = async (rating) => {
    await patchState({ guestRating: rating, guestScreen: 'idle' });
  };

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div style={{ height: '100dvh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 15, color: '#525252' }}>{error}</div>
        </div>
      </div>
    );
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (!tableState || !tableObj) {
    return (
      <div style={{ height: '100dvh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 24, height: 24, border: '2px solid #2a2a2a', borderTopColor: '#737373', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  const screen = tableState.guestScreen || 'idle';

  return (
    <div style={{
      height: '100dvh',
      background: '#0a0a0a',
      color: '#fff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Minimal header — no nav */}
      <div style={{
        flexShrink: 0,
        height: 48,
        borderBottom: '1px solid #1a1a1a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#404040', letterSpacing: 1 }}>
          {venueName || 'Table Service'}
        </span>
        <span style={{ fontSize: 12, color: '#2a2a2a', fontWeight: 600 }}>
          {tableObj?.label || ''}
        </span>
      </div>

      {/* Screen content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {screen === 'idle' && (
          <IdleScreen
            tableName={tableObj?.label || 'Your Table'}
            onBegin={handleBegin}
          />
        )}
        {screen === 'dining' && (
          <DiningScreen
            tableState={tableState}
            tableObj={tableObj}
            onSignal={handleSignal}
            onSaveDietary={handleSaveDietary}
            saving={saving}
          />
        )}
        {screen === 'bill' && (
          <BillScreen tableState={tableState} />
        )}
        {screen === 'rating' && (
          <RatingScreen onSubmit={handleRating} saving={saving} />
        )}
      </div>

      {/* Inline keyframes */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
        * { -webkit-tap-highlight-color: transparent; }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
      `}</style>
    </div>
  );
}