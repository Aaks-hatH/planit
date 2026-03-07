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
  'Pescatarian', 'Egg-Free', 'Diabetic-Friendly', 'Raw/Organic',
];

const TIP_PRESETS = [15, 18, 20, 22];

const POLL_MS = 3000;

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
        fontSize: 32, color: i < val ? '#d97706' : '#d6d3d1',
        cursor: 'pointer', lineHeight: 1,
      }}
    >
      {i < val ? '\u2605' : '\u2606'}
    </button>
  ));
}

// ── Screens ───────────────────────────────────────────────────────────────────

function IdleScreen({ tableName, venueName, onBegin }) {
  return (
    <div style={S.centerCol}>
      <div style={S.logoWrap}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#92400e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 11l19-9-9 19-2-8-8-2z"/>
        </svg>
      </div>
      {venueName && (
        <div style={{ fontSize: 13, color: '#78716c', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>{venueName}</div>
      )}
      <div style={{ fontSize: 13, color: '#a8a29e', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>Table Service</div>
      <div style={{ fontSize: 44, fontWeight: 800, color: '#1c1917', marginBottom: 8, lineHeight: 1.1 }}>{tableName}</div>
      <div style={{ fontSize: 15, color: '#a8a29e', marginBottom: 52 }}>Your server will be with you shortly.</div>
      <button style={S.primaryBtn} onPointerDown={onBegin}>Tap to Begin</button>
      <div style={{ marginTop: 20, fontSize: 11, color: '#d6d3d1', textAlign: 'center', maxWidth: 260, lineHeight: 1.5 }}>
        Payment is processed by your server at the table. This tablet does not handle payments.
      </div>
    </div>
  );
}

// Smart wait time: fewer pending alerts = faster response estimate
function estimateWait(pendingAlertCount) {
  if (pendingAlertCount <= 1) return '1-2 min';
  if (pendingAlertCount <= 3) return '2-4 min';
  if (pendingAlertCount <= 6) return '4-7 min';
  return '7-10 min';
}

const QUICK_REQUESTS = [
  { id: 'water',   label: 'Water Refill' },
  { id: 'napkins', label: 'Napkins' },
  { id: 'menu',    label: 'View Menu' },
  { id: 'dessert', label: 'Dessert Menu' },
];

function DiningScreen({ tableState, tableObj, onSignal, onSaveDietary, saving, pendingAlertCount, menus, accentColor }) {
  const [diet, setDiet]           = useState(tableState?.guestDietary || []);
  const [notes, setNotes]         = useState(tableState?.guestDietaryNotes || '');
  const [dietOpen, setDietOpen]   = useState(false);
  const [dietSaved, setDietSaved] = useState(false);
  const [partySize, setPartySize] = useState(tableState?.partySize || '');
  const [partySaved, setPartySaved] = useState(false);
  const [openMenuIdx, setOpenMenuIdx] = useState(null);
  const alert = tableState?.guestAlert;
  const accent = accentColor || '#d97706';

  const toggle = (opt) => setDiet(prev =>
    prev.includes(opt) ? prev.filter(x => x !== opt) : [...prev, opt]
  );

  const handleSaveDiet = async () => {
    await onSaveDietary({ guestDietary: diet, guestDietaryNotes: notes });
    setDietSaved(true);
    setTimeout(() => setDietSaved(false), 2000);
  };

  const handleSaveParty = async () => {
    const n = parseInt(partySize, 10);
    if (!n || n < 1) return;
    await onSaveDietary({ partySize: n });
    setPartySaved(true);
    setTimeout(() => setPartySaved(false), 2000);
  };

  const alertPending = !!alert;
  const waitEst = estimateWait(pendingAlertCount);

  const getAlertLabel = () => {
    if (alert === 'call') return 'Server notified — on their way.';
    if (alert === 'order') return 'Order request sent — server coming right over.';
    if (typeof alert === 'string' && alert.startsWith('quick:')) {
      const req = QUICK_REQUESTS.find(r => `quick:${r.id}` === alert);
      return req ? `"${req.label}" request sent.` : 'Request sent.';
    }
    return '';
  };

  return (
    <div style={{ ...S.page, overflowY: 'auto' }}>
      <div style={S.tableTag}>{tableObj?.label || 'Table'}</div>

      {alertPending && (
        <div style={S.alertBanner}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#d97706', flexShrink: 0, animation: 'pulse 1.5s infinite' }} />
          <div>
            <div style={{ color: '#92400e', fontWeight: 700, fontSize: 13 }}>{getAlertLabel()}</div>
            <div style={{ color: '#a8a29e', fontSize: 11, marginTop: 2 }}>Est. wait: {waitEst}</div>
          </div>
        </div>
      )}

      {/* Primary action buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 4 }}>
        <button
          style={{ ...S.actionBtn, opacity: alertPending || saving ? 0.45 : 1 }}
          disabled={alertPending || saving}
          onPointerDown={() => onSignal('call')}
        >
          <div style={{ marginBottom: 8 }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#1c1917' }}>Call Server</span>
          <span style={{ fontSize: 11, color: '#a8a29e', marginTop: 3 }}>Need assistance</span>
        </button>

        <button
          style={{ ...S.actionBtn, opacity: alertPending || saving ? 0.45 : 1 }}
          disabled={alertPending || saving}
          onPointerDown={() => onSignal('order')}
        >
          <div style={{ marginBottom: 8 }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#1c1917' }}>Ready to Order</span>
          <span style={{ fontSize: 11, color: '#a8a29e', marginTop: 3 }}>Notify your server</span>
        </button>
      </div>

      {/* Quick requests */}
      <div style={S.card}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#a8a29e', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Quick Requests</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {QUICK_REQUESTS.map(req => {
            const isActive = alert === `quick:${req.id}`;
            return (
              <button
                key={req.id}
                style={{
                  ...S.quickBtn,
                  background: isActive ? '#fef3c7' : '#fafaf9',
                  border: `1px solid ${isActive ? '#d97706' : '#e7e5e4'}`,
                  color: isActive ? '#92400e' : '#57534e',
                  opacity: (alertPending && !isActive) || saving ? 0.4 : 1,
                }}
                disabled={(alertPending && !isActive) || saving}
                onPointerDown={() => onSignal(`quick:${req.id}`)}
              >
                {req.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Party size */}
      <div style={S.card}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#a8a29e', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Party Size</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="number"
            min="1"
            max="20"
            value={partySize}
            onChange={e => setPartySize(e.target.value)}
            placeholder="How many guests?"
            style={{ ...S.input, flex: 1 }}
          />
          <button
            style={{ ...S.secondaryBtn, flexShrink: 0 }}
            onPointerDown={handleSaveParty}
            disabled={saving || !partySize}
          >
            {partySaved ? 'Saved' : 'Confirm'}
          </button>
        </div>
      </div>

      {/* Dietary restrictions */}
      <div style={S.card}>
        <button
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
          onPointerDown={() => setDietOpen(p => !p)}
        >
          <span style={{ fontWeight: 700, fontSize: 14, color: '#1c1917' }}>Dietary Restrictions</span>
          <span style={{ fontSize: 18, color: '#a8a29e', transform: dietOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>&#8964;</span>
        </button>

        {diet.length > 0 && !dietOpen && (
          <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {diet.map(d => <span key={d} style={S.tag}>{d}</span>)}
          </div>
        )}

        {dietOpen && (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              {DIETARY_OPTIONS.map(opt => (
                <button
                  key={opt}
                  onPointerDown={() => toggle(opt)}
                  style={{
                    ...S.dietBtn,
                    background: diet.includes(opt) ? '#fef3c7' : '#fafaf9',
                    border: `1px solid ${diet.includes(opt) ? '#d97706' : '#e7e5e4'}`,
                    color: diet.includes(opt) ? '#92400e' : '#57534e',
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
      {/* Menus */}
      {menus && menus.length > 0 && (
        <div style={S.card}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#a8a29e', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Menus</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {menus.map((menu, i) => {
              const ma = menu.clr || accent;
              const isOpen = openMenuIdx === i;
              return (
                <div key={i} style={{ borderRadius: 12, border: `1px solid ${isOpen ? ma + '55' : '#e7e5e4'}`, overflow: 'hidden', background: '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: isOpen ? ma + '0d' : undefined }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, background: ma + '18', border: `1px solid ${ma}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {menu.t === 'p'
                        ? <svg width="16" height="16" fill="none" stroke={ma} strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
                        : <svg width="16" height="16" fill="none" stroke={ma} strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h10"/></svg>
                      }
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#1c1917', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{menu.n}</div>
                      {menu.c && <div style={{ fontSize: 10, fontWeight: 700, color: ma, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 1 }}>{menu.c}</div>}
                    </div>
                    {(menu.t === 'l' || menu.t === 'p') && menu.u
                      ? <a href={menu.u} target="_blank" rel="noopener noreferrer"
                          style={{ flexShrink: 0, padding: '6px 12px', borderRadius: 8, background: ma, color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
                          {menu.t === 'p' ? 'Open PDF' : 'View'}
                        </a>
                      : menu.t === 'd' && (
                          <button
                            onPointerDown={() => setOpenMenuIdx(isOpen ? null : i)}
                            style={{ flexShrink: 0, padding: '6px 12px', borderRadius: 8, background: isOpen ? ma : 'transparent', color: isOpen ? '#fff' : ma, fontSize: 12, fontWeight: 700, border: `1px solid ${ma}55` }}>
                            {isOpen ? 'Close' : 'Read'}
                          </button>
                        )
                    }
                  </div>
                  {menu.t === 'd' && isOpen && menu.d && (
                    <div style={{ padding: '10px 14px 14px', fontSize: 13, color: '#57534e', lineHeight: 1.6, borderTop: `1px solid ${ma}22`, background: ma + '06' }}>
                      {menu.d.split('\n').map((ln, li) => <p key={li} style={{ margin: li > 0 ? '6px 0 0' : 0 }}>{ln}</p>)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function BillScreen({ tableState }) {
  const sub  = Number(tableState?.billSubtotal) || 0;
  const tax  = Number(tableState?.billTax) || 0;
  const paid = tableState?.billPaid;
  const [tipPct, setTipPct]       = useState(tableState?.tipPct || 18);
  const [customTip, setCustomTip] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [splitBy, setSplitBy]     = useState(1);

  const activeTip  = useCustom ? (parseFloat(customTip) || 0) : tipPct;
  const tipAmt     = sub * (activeTip / 100);
  const total      = sub + tax + tipAmt;
  const perPerson  = splitBy > 1 ? total / splitBy : null;

  return (
    <div style={{ ...S.page, overflowY: 'auto' }}>
      <div style={S.tableTag}>{paid ? 'Paid' : 'Your Bill'}</div>

      {paid && (
        <div style={{ ...S.alertBanner, borderColor: '#bbf7d0', background: '#f0fdf4' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a', flexShrink: 0 }} />
          <span style={{ color: '#15803d', fontWeight: 700, fontSize: 13 }}>Thank you for dining with us. Your server will collect payment at the table.</span>
        </div>
      )}

      {/* Payment note */}
      {!paid && (
        <div style={{ padding: '10px 14px', borderRadius: 10, background: '#fafaf9', border: '1px solid #e7e5e4', fontSize: 12, color: '#78716c', lineHeight: 1.5 }}>
          Your server will bring your check and collect payment at the table. Amounts shown are estimates from your server.
        </div>
      )}

      {/* Bill breakdown */}
      <div style={S.card}>
        <div style={S.billRow}>
          <span style={{ color: '#78716c' }}>Subtotal</span>
          <span style={{ color: '#1c1917', fontWeight: 600 }}>{fmt$(sub)}</span>
        </div>
        <div style={S.billRow}>
          <span style={{ color: '#78716c' }}>Tax</span>
          <span style={{ color: '#1c1917', fontWeight: 600 }}>{fmt$(tax)}</span>
        </div>
        <div style={{ ...S.billRow, borderTop: '1px solid #e7e5e4', marginTop: 8, paddingTop: 12 }}>
          <span style={{ color: '#78716c' }}>Tip ({activeTip}%)</span>
          <span style={{ color: '#d97706', fontWeight: 600 }}>{fmt$(tipAmt)}</span>
        </div>
        <div style={{ ...S.billRow, marginTop: 4 }}>
          <span style={{ color: '#1c1917', fontWeight: 800, fontSize: 18 }}>Total</span>
          <span style={{ color: '#1c1917', fontWeight: 800, fontSize: 22 }}>{fmt$(total)}</span>
        </div>
        {perPerson && (
          <div style={{ ...S.billRow, marginTop: 4, paddingTop: 10, borderTop: '1px solid #e7e5e4' }}>
            <span style={{ color: '#78716c', fontSize: 13 }}>Per person ({splitBy})</span>
            <span style={{ color: '#d97706', fontWeight: 700, fontSize: 16 }}>{fmt$(perPerson)}</span>
          </div>
        )}
      </div>

      {/* Tip selector + split — read-only if paid */}
      {!paid && (
        <>
          <div style={S.card}>
            <div style={{ fontSize: 11, color: '#a8a29e', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Tip Suggestion</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 10 }}>
              {TIP_PRESETS.map(p => (
                <button
                  key={p}
                  onPointerDown={() => { setUseCustom(false); setTipPct(p); }}
                  style={{
                    ...S.tipBtn,
                    background: !useCustom && tipPct === p ? '#fef3c7' : '#fafaf9',
                    border: `1px solid ${!useCustom && tipPct === p ? '#d97706' : '#e7e5e4'}`,
                    color: !useCustom && tipPct === p ? '#92400e' : '#78716c',
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
                  background: useCustom ? '#fef3c7' : '#fafaf9',
                  border: `1px solid ${useCustom ? '#d97706' : '#e7e5e4'}`,
                  color: useCustom ? '#92400e' : '#78716c',
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
                  style={{ ...S.input, flex: 1 }}
                />
              )}
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: '#a8a29e' }}>
              Tip is a suggestion only. Your server handles all payments.
            </div>
          </div>

          <div style={S.card}>
            <div style={{ fontSize: 11, color: '#a8a29e', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Split Bill</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onPointerDown={() => setSplitBy(n => Math.max(1, n - 1))}
                style={{ ...S.tipBtn, width: 40, flexShrink: 0, background: '#fafaf9', border: '1px solid #e7e5e4', color: '#57534e', fontSize: 18 }}
              >-</button>
              <span style={{ flex: 1, textAlign: 'center', fontWeight: 700, fontSize: 16, color: '#1c1917' }}>
                {splitBy === 1 ? 'No split' : `${splitBy} ways`}
              </span>
              <button
                onPointerDown={() => setSplitBy(n => Math.min(20, n + 1))}
                style={{ ...S.tipBtn, width: 40, flexShrink: 0, background: '#fafaf9', border: '1px solid #e7e5e4', color: '#57534e', fontSize: 18 }}
              >+</button>
            </div>
            {perPerson && (
              <div style={{ marginTop: 10, textAlign: 'center', fontSize: 13, color: '#78716c' }}>
                Each person owes <strong style={{ color: '#1c1917' }}>{fmt$(perPerson)}</strong> — let your server know how to split.
              </div>
            )}
          </div>
        </>
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
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#f0fdf4', border: '2px solid #86efac', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <div style={{ fontSize: 24, fontWeight: 800, color: '#1c1917', marginBottom: 8 }}>Thank You</div>
        <div style={{ fontSize: 14, color: '#a8a29e' }}>Your feedback means a lot to us.</div>
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
            <div style={{ fontSize: 13, color: '#78716c', fontWeight: 600, marginBottom: 6 }}>{label}</div>
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
    padding: '20px 18px 40px',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
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
  logoWrap: {
    width: 52, height: 52,
    borderRadius: 14,
    background: '#fef3c7',
    border: '1px solid #fde68a',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  tableTag: {
    fontSize: 11, fontWeight: 700, color: '#a8a29e',
    textTransform: 'uppercase', letterSpacing: 2,
    marginBottom: 4,
  },
  alertBanner: {
    display: 'flex', alignItems: 'flex-start', gap: 10,
    padding: '12px 14px',
    borderRadius: 12,
    background: '#fffbeb',
    border: '1px solid #fde68a',
  },
  primaryBtn: {
    background: '#1c1917',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    padding: '14px 32px',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    width: '100%',
    letterSpacing: 0.2,
  },
  secondaryBtn: {
    background: '#f5f5f4',
    color: '#44403c',
    border: '1px solid #e7e5e4',
    borderRadius: 10,
    padding: '10px 16px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  actionBtn: {
    background: '#fff',
    border: '1px solid #e7e5e4',
    borderRadius: 16,
    padding: '18px 12px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    cursor: 'pointer',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
  },
  quickBtn: {
    borderRadius: 10,
    padding: '10px 8px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.12s',
    textAlign: 'center',
  },
  card: {
    background: '#fff',
    border: '1px solid #e7e5e4',
    borderRadius: 16,
    padding: 18,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  tag: {
    background: '#fef3c7',
    border: '1px solid #fde68a',
    color: '#92400e',
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
    transition: 'all 0.12s',
  },
  input: {
    width: '100%',
    background: '#fafaf9',
    border: '1px solid #e7e5e4',
    borderRadius: 10,
    color: '#1c1917',
    fontSize: 14,
    padding: '10px 12px',
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    background: '#fafaf9',
    border: '1px solid #e7e5e4',
    borderRadius: 10,
    color: '#1c1917',
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
    transition: 'all 0.12s',
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
  const [menus, setMenus]         = useState([]);
  const [accentColor, setAccentColor] = useState('#f97316');
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
      if (d.menus)      setMenus(d.menus);
      if (d.accentColor) setAccentColor(d.accentColor);
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
    await patchState({ guestRating: rating });
  };

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div style={{ height: '100dvh', background: '#fafaf9', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 15, color: '#a8a29e' }}>{error}</div>
        </div>
      </div>
    );
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (!tableState || !tableObj) {
    return (
      <div style={{ height: '100dvh', background: '#fafaf9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 24, height: 24, border: '2px solid #e7e5e4', borderTopColor: '#a8a29e', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  const screen = tableState.guestScreen || 'idle';
  // Count how many alerts are pending across all known states (approximated from tableState)
  // We track pendingAlertCount optimistically from server-reflected state
  const pendingAlertCount = tableState.guestAlert ? 1 : 0;

  // Step indicator for header
  const STEPS = ['idle', 'dining', 'bill', 'rating'];
  const stepIdx = STEPS.indexOf(screen);

  return (
    <div style={{
      height: '100dvh',
      background: '#f5f5f4',
      color: '#1c1917',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Minimal header — no nav */}
      <div style={{
        flexShrink: 0,
        height: 52,
        borderBottom: '1px solid #e7e5e4',
        background: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
      }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#78716c', letterSpacing: 0.5 }}>
          {venueName || 'Table Service'}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Step dots */}
          {screen !== 'idle' && STEPS.slice(1).map((s, i) => (
            <div key={s} style={{
              width: 6, height: 6, borderRadius: '50%',
              background: stepIdx >= i + 1 ? '#1c1917' : '#d6d3d1',
              transition: 'background 0.2s',
            }} />
          ))}
          <span style={{ fontSize: 12, color: '#a8a29e', fontWeight: 600, marginLeft: 4 }}>
            {tableObj?.label || ''}
          </span>
        </div>
      </div>

      {/* Screen content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {screen === 'idle' && (
          <IdleScreen
            tableName={tableObj?.label || 'Your Table'}
            venueName={venueName}
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
            pendingAlertCount={pendingAlertCount}
            menus={menus}
            accentColor={accentColor}
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
        input, textarea { -webkit-user-select: auto !important; user-select: auto !important; }
      `}</style>
    </div>
  );
}
