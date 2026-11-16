import { useMemo, useState } from 'react';
import {
  X, Search, Wand2, Star, Mic, Shield, Check, Users, MapPin, Loader2, AlertTriangle, Undo2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { eventAPI } from '../services/api';

/**
 * TableAssignmentPanel
 *
 * Bulk "who sits where, and what pass do they get" screen for enterprise check-in.
 * Built for phones first: big tap targets, native selects, one sticky action bar.
 *
 *   1. Tick guests (or "select all shown")
 *   2. Tap a table chip  → they're staged onto that table
 *      …or use "Auto-assign" to fill every unassigned party into open tables
 *   3. Set ticket type (Guest / VIP / Speaker) for the selection
 *   4. Edit a single row's table / seat inline
 *   5. Save once — nothing is written until you press Save
 *
 * Props
 *   eventId        string
 *   invites        Invite[]  (needs _id, guestName, guestRole, adults, children, groupSize,
 *                             tableId, seatNumber, checkedIn)
 *   seatingObjects seatingMap.objects[]
 *   onClose()      
 *   onSaved()      called after a successful save (parent reloads invites + seating)
 *   onOpenSeating() optional — opens the floor-plan editor when there are no tables yet
 */

const ROLES = {
  GUEST:   { label: 'Guest',   icon: Shield, on: 'bg-neutral-900 text-white border-neutral-900', badge: 'bg-neutral-100 text-neutral-600' },
  VIP:     { label: 'VIP',     icon: Star,   on: 'bg-amber-500 text-white border-amber-500',   badge: 'bg-amber-100 text-amber-800' },
  SPEAKER: { label: 'Speaker', icon: Mic,    on: 'bg-purple-600 text-white border-purple-600', badge: 'bg-purple-100 text-purple-800' },
};

const labelOf = (o) =>
  (o.label && String(o.label).trim()) ||
  (o.type ? o.type.charAt(0).toUpperCase() + o.type.slice(1) : 'Table');

const peopleOf = (g) => ((g.adults ?? 1) + (g.children ?? 0)) || g.groupSize || 1;

const PAGE = 60;

export default function TableAssignmentPanel({ eventId, invites, seatingObjects, onClose, onSaved, onOpenSeating }) {
  const [draft, setDraft]       = useState({});          // { [inviteId]: { tableId?, seatNumber?, guestRole? } }
  const [selected, setSelected] = useState(() => new Set());
  const [query, setQuery]       = useState('');
  const [filter, setFilter]     = useState('all');       // all | unassigned | assigned | VIP | SPEAKER
  const [limit, setLimit]       = useState(PAGE);
  const [saving, setSaving]     = useState(false);

  // Tables guests can actually be seated at (no zones/labels, no stage)
  const tables = useMemo(
    () => (seatingObjects || [])
      .filter(o => o.type !== 'zone' && o.type !== 'stage')
      .map(o => ({ id: o.id, label: labelOf(o), capacity: Number(o.capacity) || 0, type: o.type }))
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true })),
    [seatingObjects],
  );
  const tableById = useMemo(() => new Map(tables.map(t => [t.id, t])), [tables]);

  const byId = useMemo(() => new Map(invites.map(g => [g._id, g])), [invites]);

  // Effective value = staged edit if there is one, otherwise what's saved
  const eff = (g) => {
    const d = draft[g._id] || {};
    return {
      tableId:    'tableId'    in d ? d.tableId    : (g.tableId || null),
      seatNumber: 'seatNumber' in d ? d.seatNumber : (g.seatNumber || ''),
      guestRole:  'guestRole'  in d ? d.guestRole  : (g.guestRole || 'GUEST'),
    };
  };

  // People seated per table (after staged edits)
  const usage = useMemo(() => {
    const m = {};
    for (const g of invites) {
      const d = draft[g._id] || {};
      const tid = 'tableId' in d ? d.tableId : g.tableId;
      if (tid) m[tid] = (m[tid] || 0) + peopleOf(g);
    }
    return m;
  }, [invites, draft]);

  const seatedCount = useMemo(
    () => invites.filter(g => eff(g).tableId).length, // eslint-disable-line react-hooks/exhaustive-deps
    [invites, draft],                                   // eslint-disable-line react-hooks/exhaustive-deps
  );

  // ── Staging helpers ─────────────────────────────────────────────────────
  const stage = (ids, patch) => {
    setDraft(prev => {
      const next = { ...prev };
      for (const id of ids) {
        const g = byId.get(id);
        if (!g) continue;
        const merged = { ...(next[id] || {}), ...patch };
        // Moving to a different table (or off a table) invalidates the old seat number
        if ('tableId' in patch && !('seatNumber' in patch)) {
          const before = 'tableId' in (next[id] || {}) ? next[id].tableId : (g.tableId || null);
          if ((patch.tableId || null) !== (before || null)) merged.seatNumber = '';
        }
        // Drop keys that are back to the saved value
        if ('tableId' in merged && (merged.tableId || null) === (g.tableId || null)) delete merged.tableId;
        if ('seatNumber' in merged && (merged.seatNumber || '') === (g.seatNumber || '')) delete merged.seatNumber;
        // Moved back to the original table → restore the original seat too
        if ('tableId' in patch && !('tableId' in merged) && !('seatNumber' in patch)) delete merged.seatNumber;
        if ('guestRole' in merged && merged.guestRole === (g.guestRole || 'GUEST')) delete merged.guestRole;
        if (Object.keys(merged).length) next[id] = merged; else delete next[id];
      }
      return next;
    });
  };

  const changeCount = Object.keys(draft).length;

  // ── Filtering ───────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return invites
      .filter(g => {
        const e = eff(g);
        if (q && !(g.guestName || '').toLowerCase().includes(q)) return false;
        if (filter === 'unassigned') return !e.tableId;
        if (filter === 'assigned')   return !!e.tableId;
        if (filter === 'VIP' || filter === 'SPEAKER') return e.guestRole === filter;
        return true;
      })
      .sort((a, b) => (a.guestName || '').localeCompare(b.guestName || ''));
  }, [invites, draft, query, filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = filtered.slice(0, limit);
  const allShownSelected = shown.length > 0 && shown.every(g => selected.has(g._id));

  const toggle = (id) => setSelected(prev => {
    const n = new Set(prev);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });
  const toggleAllShown = () => setSelected(prev => {
    const n = new Set(prev);
    if (allShownSelected) shown.forEach(g => n.delete(g._id));
    else shown.forEach(g => n.add(g._id));
    return n;
  });

  // ── Bulk actions ────────────────────────────────────────────────────────
  const selectedIds = [...selected];

  const assignSelectedTo = (tableId) => {
    if (!selectedIds.length) return;
    const table = tableById.get(tableId);
    const need = selectedIds.reduce((s, id) => s + peopleOf(byId.get(id)), 0);
    stage(selectedIds, { tableId });
    if (table?.capacity) {
      // usage doesn't include this batch yet — compute what it will be
      const alreadyThere = invites
        .filter(g => eff(g).tableId === tableId && !selected.has(g._id))
        .reduce((s, g) => s + peopleOf(g), 0);
      if (alreadyThere + need > table.capacity) {
        toast(`${table.label} will be over capacity (${alreadyThere + need}/${table.capacity})`, { icon: '⚠️' });
      }
    }
    setSelected(new Set());
  };

  const unassignSelected = () => { stage(selectedIds, { tableId: null }); setSelected(new Set()); };
  const setRoleForSelected = (role) => { stage(selectedIds, { guestRole: role }); };

  // Fill every unassigned party into open tables. Speakers → VIPs → everyone else.
  // Parties are never split. VIP/Speaker parties prefer VIP-type tables.
  const autoAssign = () => {
    if (!tables.length) { toast.error('Add tables in the seating map first'); return; }
    const remaining = {};
    for (const t of tables) remaining[t.id] = t.capacity > 0 ? t.capacity - (usage[t.id] || 0) : Infinity;

    const rank = { SPEAKER: 0, VIP: 1, GUEST: 2 };
    const todo = invites
      .filter(g => !eff(g).tableId)
      .sort((a, b) =>
        (rank[eff(a).guestRole] ?? 2) - (rank[eff(b).guestRole] ?? 2) ||
        peopleOf(b) - peopleOf(a) ||                       // big parties first so they fit
        (a.guestName || '').localeCompare(b.guestName || ''));

    const plan = {};
    let placed = 0, unplaced = 0;
    for (const g of todo) {
      const p = peopleOf(g);
      const wantsVip = eff(g).guestRole !== 'GUEST';
      const fits = tables.filter(t => remaining[t.id] >= p);
      const pick = (wantsVip ? fits.find(t => t.type === 'vip') : fits.find(t => t.type !== 'vip')) || fits[0];
      if (!pick) { unplaced++; continue; }
      plan[g._id] = pick.id;
      remaining[pick.id] -= p;
      placed++;
    }

    if (!placed) {
      toast(unplaced ? 'No table has enough room for the remaining parties' : 'Everyone already has a table');
      return;
    }
    setDraft(prev => {
      const next = { ...prev };
      for (const [id, tableId] of Object.entries(plan)) next[id] = { ...(next[id] || {}), tableId, seatNumber: '' };
      return next;
    });
    toast.success(`Seated ${placed} ${placed === 1 ? 'party' : 'parties'}${unplaced ? ` — ${unplaced} didn’t fit` : ''}. Review, then Save.`);
  };

  // ── Save / close ────────────────────────────────────────────────────────
  const save = async () => {
    if (!changeCount) return;
    setSaving(true);
    try {
      const assignments = Object.entries(draft).map(([inviteId]) => {
        const e = eff(byId.get(inviteId));
        return {
          inviteId,
          tableId:    e.tableId || null,
          tableLabel: e.tableId ? tableById.get(e.tableId)?.label || null : null,
          seatNumber: e.seatNumber ? String(e.seatNumber).trim().slice(0, 20) : null,
          guestRole:  e.guestRole,
        };
      });
      for (let i = 0; i < assignments.length; i += 500) {
        await eventAPI.bulkAssignSeats(eventId, assignments.slice(i, i + 500));
      }
      toast.success(`Saved ${assignments.length} change${assignments.length !== 1 ? 's' : ''}`);
      setDraft({});
      setSelected(new Set());
      onSaved?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not save — nothing was changed');
    } finally {
      setSaving(false);
    }
  };

  const requestClose = () => {
    if (changeCount && !window.confirm(`Discard ${changeCount} unsaved change${changeCount !== 1 ? 's' : ''}?`)) return;
    onClose();
  };

  const chipFill = (t) => {
    const used = usage[t.id] || 0;
    const over = t.capacity > 0 && used > t.capacity;
    const full = t.capacity > 0 && used === t.capacity;
    return { used, over, full };
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex sm:items-center sm:justify-center sm:p-6">
      <div className="bg-white w-full h-full sm:h-[90dvh] sm:max-w-3xl sm:rounded-2xl flex flex-col overflow-hidden shadow-2xl">

        {/* Header */}
        <div
          className="flex-shrink-0 border-b border-neutral-100 px-4 sm:px-6 pb-3"
          style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))' }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-bold text-neutral-900 truncate">Tables &amp; Passes</h2>
              <p className="text-xs text-neutral-500">
                {seatedCount} of {invites.length} guests seated
                {changeCount > 0 && <span className="text-amber-600 font-semibold"> · {changeCount} unsaved</span>}
              </p>
            </div>
            <button
              onClick={requestClose}
              aria-label="Close"
              className="p-3 -mr-2 rounded-xl hover:bg-neutral-100 active:bg-neutral-100 flex-shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {tables.length === 0 ? (
            <div className="mt-3 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-4 text-sm text-neutral-600">
              <p className="font-semibold text-neutral-800 mb-1">No tables yet</p>
              <p className="mb-3">Add tables on the floor plan, then come back here to seat everyone in one go.</p>
              {onOpenSeating && (
                <button
                  onClick={onOpenSeating}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-neutral-900 text-white text-sm font-semibold rounded-xl"
                >
                  <MapPin className="w-4 h-4" /> Open seating map
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Search + auto-assign */}
              <div className="mt-3 flex gap-2">
                <div className="relative flex-1 min-w-0">
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    value={query}
                    onChange={e => { setQuery(e.target.value); setLimit(PAGE); }}
                    placeholder="Search guests"
                    className="w-full border border-neutral-200 rounded-xl pl-9 pr-3 py-2.5 text-base sm:text-sm focus:outline-none focus:border-neutral-400"
                  />
                </div>
                <button
                  onClick={autoAssign}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-semibold text-violet-700 bg-violet-50 border border-violet-200 rounded-xl active:bg-violet-100"
                >
                  <Wand2 className="w-4 h-4" /> Auto-assign
                </button>
              </div>

              {/* Filter chips */}
              <div className="mt-2.5 flex gap-1.5 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-0.5">
                {[
                  ['all', 'All'], ['unassigned', 'No table'], ['assigned', 'Seated'], ['VIP', 'VIP'], ['SPEAKER', 'Speakers'],
                ].map(([k, label]) => (
                  <button
                    key={k}
                    onClick={() => { setFilter(k); setLimit(PAGE); }}
                    className={`flex-shrink-0 px-3.5 py-2 text-xs font-semibold rounded-full border transition-colors ${
                      filter === k ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-600 border-neutral-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Guest list */}
        {tables.length > 0 && (
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <button
              onClick={toggleAllShown}
              className="w-full flex items-center gap-3 px-4 sm:px-6 py-3 text-sm font-semibold text-neutral-600 border-b border-neutral-100 bg-neutral-50 sticky top-0 z-[1]"
            >
              <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${allShownSelected ? 'bg-neutral-900 border-neutral-900' : 'border-neutral-300 bg-white'}`}>
                {allShownSelected && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
              </span>
              Select all shown ({filtered.length})
            </button>

            {filtered.length === 0 && (
              <p className="px-6 py-12 text-center text-sm text-neutral-400">
                {invites.length === 0 ? 'No guests yet — add or import some first.' : 'No guests match.'}
              </p>
            )}

            <ul className="divide-y divide-neutral-100">
              {shown.map(g => {
                const e = eff(g);
                const changed = !!draft[g._id];
                const isSel = selected.has(g._id);
                const role = ROLES[e.guestRole] || ROLES.GUEST;
                const RoleIcon = role.icon;
                const t = e.tableId ? tableById.get(e.tableId) : null;
                const over = t && t.capacity > 0 && (usage[t.id] || 0) > t.capacity;
                return (
                  <li key={g._id} className={`px-4 sm:px-6 py-3 ${isSel ? 'bg-violet-50/60' : ''}`}>
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => toggle(g._id)}
                        aria-label={isSel ? 'Deselect' : 'Select'}
                        className="-ml-2 -mt-1 p-2.5 flex-shrink-0"
                      >
                        <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${isSel ? 'bg-neutral-900 border-neutral-900' : 'border-neutral-300 bg-white'}`}>
                          {isSel && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />}
                        </span>
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-neutral-900 break-words min-w-0">{g.guestName}</p>
                          {changed && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" title="Unsaved" />}
                          {e.guestRole !== 'GUEST' && (
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${role.badge}`}>
                              <RoleIcon className="w-3 h-3" />{role.label}
                            </span>
                          )}
                          {g.checkedIn && (
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-emerald-100 text-emerald-700">In</span>
                          )}
                        </div>
                        <p className="text-xs text-neutral-400 mt-0.5 flex items-center gap-1">
                          <Users className="w-3 h-3" />{peopleOf(g)} {peopleOf(g) === 1 ? 'person' : 'people'}
                        </p>

                        <div className="mt-2 flex gap-2">
                          <select
                            value={e.tableId || ''}
                            onChange={ev => stage([g._id], { tableId: ev.target.value || null })}
                            className={`flex-1 min-w-0 border rounded-xl px-3 py-2.5 text-base sm:text-sm bg-white focus:outline-none focus:border-neutral-400 ${
                              over ? 'border-red-300 text-red-700' : 'border-neutral-200'
                            }`}
                          >
                            <option value="">No table</option>
                            {tables.map(tb => {
                              const used = usage[tb.id] || 0;
                              return (
                                <option key={tb.id} value={tb.id}>
                                  {tb.label}{tb.capacity ? ` · ${used}/${tb.capacity}` : ''}
                                </option>
                              );
                            })}
                          </select>
                          <input
                            value={e.seatNumber}
                            onChange={ev => stage([g._id], { seatNumber: ev.target.value.slice(0, 20) })}
                            disabled={!e.tableId}
                            placeholder="Seat"
                            maxLength={20}
                            className="w-20 flex-shrink-0 border border-neutral-200 rounded-xl px-3 py-2.5 text-base sm:text-sm focus:outline-none focus:border-neutral-400 disabled:bg-neutral-50 disabled:text-neutral-300"
                          />
                        </div>
                        {over && (
                          <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" /> {t.label} is over capacity
                          </p>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {filtered.length > shown.length && (
              <div className="p-4 text-center">
                <button onClick={() => setLimit(l => l + PAGE)} className="px-5 py-2.5 text-sm font-semibold border border-neutral-200 rounded-xl">
                  Show {Math.min(PAGE, filtered.length - shown.length)} more
                </button>
              </div>
            )}
          </div>
        )}

        {/* Sticky action area */}
        {tables.length > 0 && (
          <div
            className="flex-shrink-0 border-t border-neutral-200 bg-white"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            {selectedIds.length > 0 && (
              <div className="px-4 sm:px-6 pt-3 pb-2 space-y-2.5 bg-violet-50/50 border-b border-violet-100">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-neutral-900">{selectedIds.length} selected</p>
                  <div className="flex items-center gap-3">
                    <button onClick={unassignSelected} className="text-xs font-semibold text-red-600 py-1.5">Remove table</button>
                    <button onClick={() => setSelected(new Set())} className="text-xs font-semibold text-neutral-500 py-1.5">Clear</button>
                  </div>
                </div>

                {/* Ticket type */}
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(ROLES).map(([k, r]) => {
                    const Icon = r.icon;
                    const all = selectedIds.every(id => eff(byId.get(id)).guestRole === k);
                    return (
                      <button
                        key={k}
                        onClick={() => setRoleForSelected(k)}
                        className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl border text-xs font-bold uppercase tracking-wide ${
                          all ? r.on : 'bg-white text-neutral-500 border-neutral-200'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />{r.label}
                      </button>
                    );
                  })}
                </div>

                {/* Tap a table to seat the selection there */}
                <div className="flex gap-2 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-1">
                  {tables.map(t => {
                    const { used, over, full } = chipFill(t);
                    return (
                      <button
                        key={t.id}
                        onClick={() => assignSelectedTo(t.id)}
                        className={`flex-shrink-0 px-3.5 py-2.5 rounded-xl border text-sm font-semibold whitespace-nowrap active:scale-95 transition-transform ${
                          over ? 'bg-red-50 border-red-300 text-red-700'
                          : full ? 'bg-neutral-100 border-neutral-200 text-neutral-400'
                          : 'bg-white border-neutral-300 text-neutral-800'
                        }`}
                      >
                        {t.label}
                        {t.capacity > 0 && <span className="ml-1.5 text-xs font-medium opacity-70">{used}/{t.capacity}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="px-4 sm:px-6 py-3 flex gap-2">
              <button
                onClick={() => { setDraft({}); setSelected(new Set()); }}
                disabled={!changeCount || saving}
                className="flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-semibold border border-neutral-200 rounded-xl disabled:opacity-40"
              >
                <Undo2 className="w-4 h-4" /> Discard
              </button>
              <button
                onClick={save}
                disabled={!changeCount || saving}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold bg-neutral-900 text-white rounded-xl disabled:opacity-40 active:bg-black"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {saving ? 'Saving…' : changeCount ? `Save ${changeCount} change${changeCount !== 1 ? 's' : ''}` : 'No changes'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
