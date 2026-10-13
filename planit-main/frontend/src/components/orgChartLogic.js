// Pure helpers for the org chart: layout, move planning and validation.
// No React in here so it can be unit tested with plain node.

export const CARD_W = 216;
export const CARD_H = 116;
export const GAP_X = 28;
export const LANE_H = 190;
export const PAD_L = 132;
export const PAD_T = 16;
export const PAD_R = 80;
export const MAX_LEVEL = 9;

const LEVEL_NAMES = ['Leadership', 'Directors', 'Leads', 'Team', 'Volunteers'];
export const levelLabel = (l) => `L${l + 1} · ${LEVEL_NAMES[l] || `Level ${l + 1}`}`;

const cmpOrder = (a, b) => (a.order - b.order) || String(a.title).localeCompare(String(b.title));

export function childrenMap(nodes) {
  const ids = new Set(nodes.map((n) => n._id));
  const m = new Map();
  for (const n of nodes) {
    const key = n.parentId && ids.has(n.parentId) && n.parentId !== n._id ? n.parentId : null;
    if (!m.has(key)) m.set(key, []);
    m.get(key).push(n);
  }
  for (const [k, arr] of m) arr.sort(k === null ? (a, b) => (a.level - b.level) || cmpOrder(a, b) : cmpOrder);
  return m;
}

export function descendantsOf(id, cmap) {
  const out = new Set();
  const stack = [id];
  while (stack.length) {
    for (const c of cmap.get(stack.pop()) || []) {
      if (!out.has(c._id)) { out.add(c._id); stack.push(c._id); }
    }
  }
  return out;
}

export function ancestorsOf(id, byId) {
  const out = [];
  let cur = byId.get(id);
  let hops = 0;
  while (cur && cur.parentId && byId.has(cur.parentId) && hops++ < 50) { out.push(cur.parentId); cur = byId.get(cur.parentId); }
  return out;
}

/** Tidy-tree layout. Lane = level, x = parents centred over their children. */
export function computeLayout(nodes, minLanes = 4) {
  const cmap = childrenMap(nodes);
  const pos = new Map();
  const slot = CARD_W + GAP_X;
  const seen = new Set();
  const place = (n, startX) => {
    if (seen.has(n._id)) return 0;
    seen.add(n._id);
    const kids = cmap.get(n._id) || [];
    let center, width;
    if (!kids.length) { width = slot; center = startX + slot / 2; }
    else {
      let cur = startX;
      const centers = [];
      for (const k of kids) {
        const w = place(k, cur);
        if (w) { centers.push(pos.get(k._id).x + CARD_W / 2); cur += w; }
      }
      width = Math.max(cur - startX, slot);
      center = centers.length ? (centers[0] + centers[centers.length - 1]) / 2 : startX + slot / 2;
    }
    pos.set(n._id, { x: center - CARD_W / 2, y: PAD_T + n.level * LANE_H + (LANE_H - CARD_H) / 2 });
    return width;
  };
  let cursor = PAD_L;
  for (const r of cmap.get(null) || []) cursor += place(r, cursor);
  for (const n of nodes) if (!seen.has(n._id)) cursor += place(n, cursor); // cycle safety
  const maxLevel = nodes.reduce((m, n) => Math.max(m, n.level), 0);
  const lanes = Math.min(MAX_LEVEL + 1, Math.max(minLanes, maxLevel + 2));
  return { pos, width: Math.max(cursor + PAD_R, 900), height: PAD_T * 2 + lanes * LANE_H, lanes };
}

const groupOf = (n) => (n.parentId ? `p:${n.parentId}` : `r:${n.level}`);

/**
 * Plan a move. opts: { parentId (string|null|undefined = keep if still valid), level, index, shiftOnly }
 * Returns { ok, reason?, nodes, moves } where moves lists every node whose level/parent/order changed.
 */
export function planMove(nodes, id, opts) {
  const orig = new Map(nodes.map((n) => [n._id, n]));
  const me = orig.get(id);
  if (!me) return { ok: false, reason: 'Missing position', nodes, moves: [] };
  const cmap = childrenMap(nodes);
  const desc = descendantsOf(id, cmap);
  const level = Math.max(0, Math.min(MAX_LEVEL, opts.level));
  let parentId = opts.parentId === undefined ? me.parentId : opts.parentId;
  if (parentId && (parentId === id || desc.has(parentId) || !orig.has(parentId))) return { ok: false, reason: 'Cannot report to themselves or their own team', nodes, moves: [] };
  if (parentId && orig.get(parentId).level >= level) {
    if (opts.parentId === undefined) parentId = null; else return { ok: false, reason: 'Manager must be on a higher level', nodes, moves: [] };
  }
  const delta = level - me.level;
  if (!opts.shiftOnly && delta !== 0) {
    for (const d of desc) if (orig.get(d).level + delta < 0 || orig.get(d).level + delta > MAX_LEVEL) return { ok: false, reason: 'Not enough levels for their team', nodes, moves: [] };
  }
  const next = new Map(nodes.map((n) => [n._id, { ...n }]));
  const n = next.get(id);
  const oldParent = me.parentId && orig.has(me.parentId) ? me.parentId : null;

  if (opts.shiftOnly) {
    for (const c of cmap.get(id) || []) { const cn = next.get(c._id); cn.parentId = oldParent; cn.order = me.order + 0.001 * (1 + (cmap.get(id) || []).indexOf(c)); }
  } else if (delta !== 0) {
    for (const d of desc) next.get(d).level += delta;
  }
  n.parentId = parentId; n.level = level;

  const list = [...next.values()];
  const dest = list.filter((x) => x._id !== id && groupOf(x) === groupOf(n)).sort(cmpOrder);
  const idx = Math.max(0, Math.min(dest.length, opts.index ?? dest.length));
  dest.splice(idx, 0, n);
  dest.forEach((x, i) => { x.order = i; });
  const renorm = (key) => list.filter((x) => groupOf(x) === key).sort(cmpOrder).forEach((x, i) => { x.order = i; });
  renorm(groupOf({ parentId: me.parentId, level: me.level }));
  if (opts.shiftOnly) renorm(oldParent ? `p:${oldParent}` : `r:${me.level}`);

  const out = nodes.map((o) => next.get(o._id));
  const moves = [];
  for (const o of out) {
    const b = orig.get(o._id);
    if (o.level !== b.level || (o.parentId || null) !== (b.parentId || null) || o.order !== b.order) moves.push({ id: o._id, level: o.level, parentId: o.parentId || null, order: o.order });
  }
  return { ok: true, nodes: out, moves };
}

/** Which cards could `dragId` be dropped onto (become their report)? */
export function validTargets(nodes, dragId) {
  const cmap = childrenMap(nodes);
  const desc = descendantsOf(dragId, cmap);
  const me = nodes.find((n) => n._id === dragId);
  const out = new Set();
  for (const t of nodes) {
    if (t._id === dragId || desc.has(t._id) || t.level >= MAX_LEVEL) continue;
    const delta = t.level + 1 - (me?.level ?? 0);
    let fits = true;
    for (const d of desc) { const l = nodes.find((x) => x._id === d).level + delta; if (l < 0 || l > MAX_LEVEL) { fits = false; break; } }
    if (fits) out.add(t._id);
  }
  return out;
}

export const initials = (s) => String(s || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
