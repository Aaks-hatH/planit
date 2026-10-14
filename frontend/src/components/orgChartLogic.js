// Pure helpers for the org chart: layout, move planning and validation.
// No React in here so it can be unit tested with plain node.

export const CARD_W = 268;
export const CARD_H = 124;
export const MAX_LEVEL = 9;
export const HEAD_H = 40;

const GAP_X = 32;          // between sibling subtrees
const GAP_Y = 76;          // card bottom -> next row top (room for the connector bus)
const HEAD_GAP = 30;       // team chip bottom -> its first card
const STACK_GAP = 16;      // between stacked cards
const GROUP_GAP = 64;      // between team columns
const SPINE_X = 30;        // stacked cards are indented so a vertical "spine" line fits on their left
const COL_GAP = 22;
const ROWS_PER_COL = 6;
const ROOT_GAP = 110;
export const PAD = 56;
export const SPINE = SPINE_X;
export const HEAD_W = 236;

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

export const levelLabel = (l) => `Tier ${l + 1}`;
export const teamKey = (parentId, dept) => `team:${parentId}:${dept}`;

/**
 * Top-down flow-chart layout.
 *  - A manager sits centred above their reports; connectors are right-angled lines (a "bus").
 *  - When a manager has several reports from different departments, each department becomes a TEAM
 *    (a labelled chip + tinted band) between the manager and its people.
 *  - Groups of people with no reports of their own are stacked in columns under a vertical "spine",
 *    so 18 open roles never become one 5,000px-wide row.
 * Returns { pos, heads, links, groupOf, width, height }
 *   pos     id -> {x,y}   (cards AND team chips, keyed by node id / team key)
 *   heads   key -> {key, parentId, dept, ids[]}
 *   links   [{ id, from, to, parent, mode: 'bus' | 'spine' }]
 *   groupOf node id -> team key
 */
export function computeLayout(nodes) {
  const cmap = childrenMap(nodes);
  const pos = new Map();
  const heads = new Map();
  const links = [];
  const groupOf = new Map();
  const seen = new Set();
  const measured = new Map();

  const groupsFor = (n) => {
    const kids = (cmap.get(n._id) || []).filter((k) => !seen.has(k._id));
    if (!kids.length) return [];
    const depts = new Set(kids.map((k) => (k.department || '').trim()).filter(Boolean));
    if (kids.length >= 4 && depts.size >= 2) {
      const by = new Map();
      for (const k of kids) { const d = (k.department || '').trim() || 'Other'; if (!by.has(d)) by.set(d, []); by.get(d).push(k); }
      return [...by.entries()].map(([dept, members]) => ({ dept, members, head: true }));
    }
    return [{ dept: '', members: kids, head: false }];
  };

  // ── pass 1: sizes ───────────────────────────────────────────────────────────
  const visiting = new Set();
  const measure = (n) => {
    if (measured.has(n._id)) return measured.get(n._id);
    if (visiting.has(n._id)) return { w: CARD_W, h: CARD_H, groups: [] };
    visiting.add(n._id);
    const gs = groupsFor(n).map((g) => {
      const leaf = g.members.every((m) => !(cmap.get(m._id) || []).length);
      let w; let h; let cols = 1; let blocks = null;
      if (leaf) {
        cols = Math.ceil(g.members.length / ROWS_PER_COL);
        const rows = Math.min(g.members.length, ROWS_PER_COL);
        w = cols * (SPINE_X + CARD_W) + (cols - 1) * COL_GAP;
        h = rows * CARD_H + (rows - 1) * STACK_GAP;
      } else {
        blocks = g.members.map((m) => measure(m));
        w = blocks.reduce((t, b) => t + b.w, 0) + GAP_X * (blocks.length - 1);
        h = Math.max(...blocks.map((b) => b.h));
      }
      const headH = g.head ? HEAD_H + HEAD_GAP : 0;
      return { ...g, leaf, cols, blocks, w: Math.max(w, g.head ? HEAD_W : 0), innerW: w, h: h + headH, headH };
    });
    visiting.delete(n._id);
    const kidsW = gs.reduce((t, g) => t + g.w, 0) + GROUP_GAP * Math.max(0, gs.length - 1);
    const out = { w: Math.max(CARD_W, kidsW), h: CARD_H + (gs.length ? GAP_Y + Math.max(...gs.map((g) => g.h)) : 0), groups: gs, kidsW };
    measured.set(n._id, out);
    return out;
  };

  // ── pass 2: positions + links ───────────────────────────────────────────────
  const place = (n, left, top) => {
    if (seen.has(n._id)) return null;
    seen.add(n._id);
    const m = measure(n);
    let x0 = left + (m.w - m.kidsW) / 2;
    const rowTop = top + CARD_H + GAP_Y;
    const anchors = [];                               // x-centres the manager must span
    for (const g of m.groups) {
      const gx = x0; let anchorId = n._id; let memberTop = rowTop;
      const memberCenters = [];
      let headKey = null;
      if (g.head) {
        headKey = teamKey(n._id, g.dept);
        const hx = gx + (g.w - HEAD_W) / 2;
        pos.set(headKey, { x: hx, y: rowTop });
        heads.set(headKey, { key: headKey, parentId: n._id, dept: g.dept, ids: g.members.map((q) => q._id) });
        links.push({ id: `l:${headKey}`, from: n._id, to: headKey, parent: n._id, mode: 'bus' });
        anchorId = headKey; memberTop = rowTop + HEAD_H + HEAD_GAP;
        anchors.push(hx + HEAD_W / 2);
      }
      if (g.leaf) {
        const rows = Math.min(g.members.length, ROWS_PER_COL);
        const innerLeft = gx + (g.w - g.innerW) / 2;
        g.members.forEach((mem, i) => {
          const col = Math.floor(i / ROWS_PER_COL); const row = i % ROWS_PER_COL;
          seen.add(mem._id);
          const x = innerLeft + col * (SPINE_X + CARD_W + COL_GAP) + SPINE_X;
          pos.set(mem._id, { x, y: memberTop + row * (CARD_H + STACK_GAP) });
          if (headKey) groupOf.set(mem._id, headKey);
          links.push({ id: `l:${mem._id}`, from: anchorId, to: mem._id, parent: n._id, mode: 'spine' });
          memberCenters.push(x + CARD_W / 2);
        });
        void rows;
        if (!g.head) anchors.push((Math.min(...memberCenters) + Math.max(...memberCenters)) / 2);
      } else {
        let cx = gx + (g.w - g.innerW) / 2;
        g.members.forEach((mem, i) => {
          const b = g.blocks[i];
          const c = place(mem, cx, memberTop);
          if (c != null) {
            if (headKey) groupOf.set(mem._id, headKey);
            links.push({ id: `l:${mem._id}`, from: anchorId, to: mem._id, parent: n._id, mode: 'bus' });
            memberCenters.push(c);
          }
          cx += b.w + GAP_X;
        });
        if (!g.head && memberCenters.length) anchors.push((memberCenters[0] + memberCenters[memberCenters.length - 1]) / 2);
      }
      x0 += g.w + GROUP_GAP;
    }
    const center = anchors.length ? (Math.min(...anchors) + Math.max(...anchors)) / 2 : left + m.w / 2;
    pos.set(n._id, { x: center - CARD_W / 2, y: top });
    return center;
  };

  const roots = cmap.get(null) || [];
  let cursor = PAD;
  for (const r of roots) { const m = measure(r); place(r, cursor, PAD); cursor += m.w + ROOT_GAP; }
  for (const n of nodes) if (!seen.has(n._id)) { const m = measure(n); place(n, cursor, PAD); cursor += m.w + ROOT_GAP; }   // cycle safety

  let maxX = 0; let maxY = 0;
  for (const [k, p] of pos) { const w = heads.has(k) ? HEAD_W : CARD_W; const h = heads.has(k) ? HEAD_H : CARD_H; maxX = Math.max(maxX, p.x + w); maxY = Math.max(maxY, p.y + h); }
  return { pos, heads, links, groupOf, width: Math.max(maxX + PAD, 900), height: Math.max(maxY + PAD, 520) };
}

/** Right-angled connector with rounded corners. pts = [[x,y],...] */
export function roundedPath(pts, r = 12) {
  const p = pts.filter((q, i) => i === 0 || q[0] !== pts[i - 1][0] || q[1] !== pts[i - 1][1]);
  if (p.length < 2) return '';
  let d = `M${p[0][0]},${p[0][1]}`;
  for (let i = 1; i < p.length - 1; i++) {
    const [px, py] = p[i - 1]; const [cx, cy] = p[i]; const [nx, ny] = p[i + 1];
    const l1 = Math.hypot(cx - px, cy - py); const l2 = Math.hypot(nx - cx, ny - cy);
    const rr = Math.min(r, l1 / 2, l2 / 2);
    if (rr < 1) { d += ` L${cx},${cy}`; continue; }
    const ax = cx - ((cx - px) / l1) * rr; const ay = cy - ((cy - py) / l1) * rr;
    const bx = cx + ((nx - cx) / l2) * rr; const by = cy + ((ny - cy) / l2) * rr;
    d += ` L${ax},${ay} Q${cx},${cy} ${bx},${by}`;
  }
  const last = p[p.length - 1];
  return `${d} L${last[0]},${last[1]}`;
}

/** Connector between an anchor box (card or team chip) and a child card, from their current (animated) rects. */
export function linkPath(a, aw, ah, c, mode) {
  const ax = a.x + aw / 2; const ay = a.y + ah;
  if (mode === 'spine') {
    const sx = c.x - SPINE_X / 2; const cy = c.y + CARD_H / 2;
    return roundedPath([[ax, ay], [ax, ay + 16], [sx, ay + 16], [sx, cy], [c.x, cy]], 10);
  }
  const cx = c.x + CARD_W / 2; const my = ay + (c.y - ay) / 2;
  return roundedPath([[ax, ay], [ax, my], [cx, my], [cx, c.y]], 14);
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
