'use strict';

/*
 * services/teamService.js
 *
 * Shared helpers for the Team page, the org chart and onboarding:
 *   - login recording + summaries (employees and the root super admin)
 *   - org-tree helpers (who manages whom, who can see whose login activity)
 *   - placeOnChart(): put a new employee on the org chart in one step (fill an open position or add a
 *     new box under a manager) so "my manager / my reports" works from day one
 *   - generatePassword(): strong one-time password that satisfies the change-password policy
 */

const crypto   = require('crypto');
const mongoose = require('mongoose');

const OrgNode     = require('../models/OrgNode');
const JobListing  = require('../models/JobListing');
const LoginRecord = require('../models/LoginRecord');
const { realIp }  = require('../middleware/realIp');

const MAX_LEVEL = 9;
const oid = (v) => (v && mongoose.isValidObjectId(String(v)) ? String(v) : null);

// ── Passwords ────────────────────────────────────────────────────────────────
function generatePassword(len = 14) {
  const sets = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnopqrstuvwxyz', '23456789', '!@#$%^&*?-_'];
  const all = sets.join('');
  const out = sets.map((s) => s[crypto.randomInt(s.length)]);   // one of each class guarantees the policy
  while (out.length < len) out.push(all[crypto.randomInt(all.length)]);
  for (let i = out.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [out[i], out[j]] = [out[j], out[i]]; }
  return out.join('');
}

// ── Logins ───────────────────────────────────────────────────────────────────
function deviceLabel(ua = '') {
  const s = String(ua);
  const browser = /Edg\//.test(s) ? 'Edge' : /OPR\/|Opera/.test(s) ? 'Opera' : /Firefox\//.test(s) ? 'Firefox'
    : /Chrome\//.test(s) ? 'Chrome' : /Safari\//.test(s) ? 'Safari' : 'Browser';
  const os = /Windows/.test(s) ? 'Windows' : /iPhone|iPad|iOS/.test(s) ? 'iOS' : /Android/.test(s) ? 'Android'
    : /Mac OS X|Macintosh/.test(s) ? 'macOS' : /Linux/.test(s) ? 'Linux' : '';
  return os ? `${browser} on ${os}` : browser;
}

// Fire-and-forget. A failed history write must never block a login.
function recordLogin(req, { actorId, actorType = 'employee', name = '', email = '', role = '', totp = false }) {
  LoginRecord.create({
    actorId: String(actorId), actorType, name, email, role, totp,
    ip: req ? String(realIp(req) || '').slice(0, 64) : '',
    device: deviceLabel(req?.headers?.['user-agent']),
  }).catch((e) => console.error('[team] login record failed (non-fatal):', e.message));
}

// { lastLogin, previousLogin, loginCount } for the root super admin, from LoginRecord.
async function rootLoginStats() {
  const [rows, count] = await Promise.all([
    LoginRecord.find({ actorId: 'root' }).sort({ at: -1 }).limit(2).lean(),
    LoginRecord.countDocuments({ actorId: 'root' }),
  ]);
  return { lastLogin: rows[0]?.at || null, previousLogin: rows[1]?.at || null, loginCount: count };
}

async function recentLogins(actorId, limit = 15, withIp = false) {
  const rows = await LoginRecord.find({ actorId: String(actorId) }).sort({ at: -1 }).limit(limit).lean();
  return rows.map((r) => ({ at: r.at, device: r.device || '', totp: !!r.totp, ...(withIp ? { ip: r.ip || '' } : {}) }));
}

// ── Org tree helpers ─────────────────────────────────────────────────────────
function treeOf(docs) {
  const byId = new Map(); const kids = new Map();
  for (const d of docs) {
    const id = String(d._id); byId.set(id, d);
    const p = d.parentId ? String(d.parentId) : null;
    if (!kids.has(p)) kids.set(p, []);
    kids.get(p).push(id);
  }
  const subtree = (id) => {                      // every descendant id, not including `id`
    const out = []; const stack = [...(kids.get(String(id)) || [])];
    while (stack.length) { const x = stack.pop(); out.push(x); stack.push(...(kids.get(x) || [])); }
    return out;
  };
  const ancestors = (id) => {                    // nearest manager first
    const out = []; let cur = byId.get(String(id)); let hops = 0;
    while (cur?.parentId && hops++ < 50) { const p = byId.get(String(cur.parentId)); if (!p) break; out.push(String(p._id)); cur = p; }
    return out;
  };
  return { byId, kids, subtree, ancestors, direct: (id) => kids.get(String(id)) || [] };
}

// The viewer's own box: root login -> the owner box, employee -> the box linked to their account.
function nodeOfAdmin(docs, admin) {
  if (!admin) return null;
  const rootLogin = !admin.isEmployee && admin.isAdmin === true;
  if (rootLogin) return docs.find((d) => d.owner) || null;
  const me = oid(admin.employeeId);
  return me ? (docs.find((d) => d.employeeId && String(d.employeeId) === me) || null) : null;
}

// ── Put a new employee on the org chart ──────────────────────────────────────
async function placeOnChart({ emp, orgNodeId, managerNodeId, title, department, by = '' }) {
  const personal = {
    status: 'filled', personName: emp.name, personEmail: emp.email, employeeId: emp._id,
    location: emp.location || '', timezone: emp.timezone || '', startDate: emp.startDate || new Date(), updatedBy: by,
  };
  const prettyRole = String(emp.role || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  // Already on the chart (linked earlier): just keep it in sync, never duplicate.
  const linked = await OrgNode.findOne({ employeeId: emp._id });
  if (linked) {
    if (title) linked.title = title;
    if (department) linked.department = department;
    linked.status = 'filled'; linked.personName = emp.name; linked.personEmail = emp.email; linked.updatedBy = by;
    await linked.save();
    return linked;
  }

  // 1. Fill an open position
  const openId = oid(orgNodeId);
  if (openId) {
    const open = await OrgNode.findById(openId);
    if (open && open.status === 'open') {
      if ((open.seats || 1) > 1) {
        // A multi-opening role keeps hiring: one seat is used, the open box shrinks, the new hire gets their own box.
        open.seats = (open.seats || 1) - 1; open.updatedBy = by; await open.save();
        if (open.jobSlug) await JobListing.updateOne({ slug: open.jobSlug }, { $set: { openings: open.seats } });
        const last = await OrgNode.findOne({ level: open.level }).sort({ order: -1 }).select('order').lean();
        return OrgNode.create({
          ...personal, title: title || open.title, department: department || open.department || '',
          level: open.level, parentId: open.parentId || null, order: (last?.order ?? -1) + 1, accent: open.accent || 'slate',
        });
      }
      Object.assign(open, personal, { title: title || open.title, department: department || open.department || '', seats: 1 });
      await open.save();
      return open;
    }
  }

  // 2. New box under a manager (or under the top box when no manager is chosen)
  let parent = null;
  const mgrId = oid(managerNodeId);
  if (mgrId) parent = await OrgNode.findById(mgrId).select('level').lean();
  if (!parent) parent = await OrgNode.findOne({ parentId: null, level: 0 }).sort({ owner: -1, order: 1 }).select('level').lean();
  const level = parent ? Math.min(MAX_LEVEL, parent.level + 1) : 0;
  if (parent && parent.level >= MAX_LEVEL) { const e = new Error('That manager is already on the lowest level of the chart.'); e.status = 400; throw e; }
  const last = await OrgNode.findOne({ level }).sort({ order: -1 }).select('order').lean();
  return OrgNode.create({
    ...personal, title: title || prettyRole || 'Team member', department: department || emp.department || '',
    level, parentId: parent ? parent._id : null, order: (last?.order ?? -1) + 1,
  });
}

module.exports = {
  oid, MAX_LEVEL, generatePassword, deviceLabel, recordLogin, rootLoginStats, recentLogins,
  treeOf, nodeOfAdmin, placeOnChart,
};
