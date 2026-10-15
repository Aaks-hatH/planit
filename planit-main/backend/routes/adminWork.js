'use strict';

/*
 * routes/adminWork.js   mounted at /api/admin/work
 *
 * Team -> Tasks     assign work to people; everyone sees and updates their own
 * Team -> GitHub    connect the repo once, link people to GitHub usernames, live pull-request feed
 *
 * Who can do what
 *   tasks     create / edit / delete / see all .... super admin or canAssignTasks
 *             see + change the status of your own .. everyone signed in
 *   github    connect / disconnect / link people ... super admin only
 *             all PRs + who is linked ............... super admin, canAssignTasks or canViewEmployees
 *             your own PRs ........................... everyone signed in
 */

const express  = require('express');
const mongoose = require('mongoose');
const router   = express.Router();

const Employee     = require('../models/Employee');
const EmployeeTask = require('../models/EmployeeTask');
const { verifyAdmin } = require('../middleware/auth');
const perms  = require('../utils/permissions');
const github = require('../services/githubService');
const { audit } = require('../models/AuditLog');

const STATUSES   = ['todo', 'in_progress', 'review', 'done'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

const meId     = (req) => (req.admin.employeeId ? String(req.admin.employeeId) : null);
const meActor  = (req) => meId(req) || (!req.admin.isEmployee && req.admin.isAdmin === true ? 'root' : null);
const meName   = (req) => req.admin.name || req.admin.email || req.admin.username || 'Super Admin';
const isSuper  = (req) => perms.isSuperAdmin(req.admin);
const canAssign = (req) => !req.admin.isDemo && perms.hasPerm(req.admin, 'canAssignTasks');
const seesAllWork = (req) => canAssign(req) || perms.hasPerm(req.admin, 'canViewEmployees');

const deny = (res, msg = 'You do not have access to this.') => res.status(403).json({ error: msg });
const noDemoWrite = (req, res) => (req.admin.isDemo ? (deny(res, 'Demo accounts cannot make changes.'), true) : false);
const validId = (v) => mongoose.isValidObjectId(String(v || ''));
const cleanText = (v, max) => String(v ?? '').trim().slice(0, max);

const shapeTask = (t) => ({
  _id: String(t._id), title: t.title, description: t.description || '', status: t.status, priority: t.priority,
  assigneeId: String(t.assigneeId), assigneeName: t.assigneeName || '', createdByName: t.createdByName || '',
  dueDate: t.dueDate || null, prNumber: t.prNumber || null, completedAt: t.completedAt || null,
  createdAt: t.createdAt, updatedAt: t.updatedAt,
});

// ─────────────────────────────── Tasks ────────────────────────────────────────

// GET /work/people - who a task can be assigned to
router.get('/people', verifyAdmin, async (req, res, next) => {
  try {
    if (!canAssign(req)) return deny(res);
    const rows = await Employee.find({ status: 'active', isDemo: { $ne: true } })
      .select('name role department githubUsername').sort({ name: 1 }).lean();
    res.json({ people: rows.map((e) => ({ _id: String(e._id), name: e.name, role: e.role, department: e.department || '', githubUsername: e.githubUsername || '' })) });
  } catch (e) { next(e); }
});

// GET /work/tasks?scope=mine|all
router.get('/tasks', verifyAdmin, async (req, res, next) => {
  try {
    const all = req.query.scope === 'all' && canAssign(req);
    const me = meId(req);
    if (!all && !me) return res.json({ tasks: [], canAssign: canAssign(req) });   // the env-login root account has no tasks of its own
    const rows = await EmployeeTask.find(all ? {} : { assigneeId: me }).sort({ updatedAt: -1 }).limit(500).lean();
    res.json({ tasks: rows.map(shapeTask), canAssign: canAssign(req) });
  } catch (e) { next(e); }
});

function readTaskFields(body, { partial }) {
  const out = {}; let err = null;
  if (!partial || body.title !== undefined) { out.title = cleanText(body.title, 200); if (!out.title) err = 'Give the task a title.'; }
  if (body.description !== undefined) out.description = cleanText(body.description, 4000);
  if (body.status !== undefined) { if (!STATUSES.includes(body.status)) err = 'Unknown status.'; else out.status = body.status; }
  if (body.priority !== undefined) { if (!PRIORITIES.includes(body.priority)) err = 'Unknown priority.'; else out.priority = body.priority; }
  if (body.dueDate !== undefined) {
    if (!body.dueDate) out.dueDate = null;
    else { const d = new Date(body.dueDate); if (isNaN(d.getTime())) err = 'That due date is not valid.'; else out.dueDate = d; }
  }
  if (body.prNumber !== undefined) {
    if (body.prNumber === null || body.prNumber === '') out.prNumber = null;
    else { const n = Number(body.prNumber); if (!Number.isInteger(n) || n < 1 || n > 1e7) err = 'That pull request number is not valid.'; else out.prNumber = n; }
  }
  return { out, err };
}

// POST /work/tasks
router.post('/tasks', verifyAdmin, async (req, res, next) => {
  try {
    if (noDemoWrite(req, res)) return;
    if (!canAssign(req)) return deny(res, 'You need the Assign Tasks permission to give people tasks.');
    const { out, err } = readTaskFields(req.body, { partial: false });
    if (err) return res.status(400).json({ error: err });
    if (!validId(req.body.assigneeId)) return res.status(400).json({ error: 'Choose who this task is for.' });
    const who = await Employee.findById(req.body.assigneeId).select('name status isDemo').lean();
    if (!who || who.status !== 'active' || who.isDemo) return res.status(400).json({ error: 'That person cannot be assigned tasks.' });

    const task = await EmployeeTask.create({
      ...out, assigneeId: who._id, assigneeName: who.name, createdById: meActor(req), createdByName: meName(req),
      ...(out.status === 'done' ? { completedAt: new Date() } : {}),
    });
    audit('task_created', { req, actor: req.admin, targetId: String(task._id), targetType: 'task', details: { title: task.title, assignee: who.name } });
    res.status(201).json({ task: shapeTask(task) });
  } catch (e) { next(e); }
});

// PATCH /work/tasks/:id - assigners edit anything; the assignee can only move their own task along
router.patch('/tasks/:id', verifyAdmin, async (req, res, next) => {
  try {
    if (noDemoWrite(req, res)) return;
    if (!validId(req.params.id)) return res.status(404).json({ error: 'Task not found.' });
    const task = await EmployeeTask.findById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found.' });

    const assigner = canAssign(req);
    const mine = meId(req) && String(task.assigneeId) === meId(req);
    if (!assigner && !mine) return deny(res, 'This task is not yours.');

    const { out, err } = readTaskFields(req.body, { partial: true });
    if (err) return res.status(400).json({ error: err });
    let patch = out;
    if (!assigner) patch = out.status !== undefined ? { status: out.status } : {};   // assignees: status only

    if (assigner && req.body.assigneeId !== undefined && String(req.body.assigneeId) !== String(task.assigneeId)) {
      if (!validId(req.body.assigneeId)) return res.status(400).json({ error: 'Choose who this task is for.' });
      const who = await Employee.findById(req.body.assigneeId).select('name status isDemo').lean();
      if (!who || who.status !== 'active' || who.isDemo) return res.status(400).json({ error: 'That person cannot be assigned tasks.' });
      patch.assigneeId = who._id; patch.assigneeName = who.name;
    }
    if (patch.status && patch.status !== task.status) patch.completedAt = patch.status === 'done' ? new Date() : null;

    const before = task.status;
    task.set(patch);
    await task.save();
    if (patch.status && patch.status !== before) {
      audit('task_status_changed', { req, actor: req.admin, targetId: String(task._id), targetType: 'task', details: { title: task.title, from: before, to: task.status } });
    }
    res.json({ task: shapeTask(task) });
  } catch (e) { next(e); }
});

// DELETE /work/tasks/:id
router.delete('/tasks/:id', verifyAdmin, async (req, res, next) => {
  try {
    if (noDemoWrite(req, res)) return;
    if (!canAssign(req)) return deny(res, 'You need the Assign Tasks permission to delete tasks.');
    if (!validId(req.params.id)) return res.status(404).json({ error: 'Task not found.' });
    const t = await EmployeeTask.findByIdAndDelete(req.params.id);
    if (!t) return res.status(404).json({ error: 'Task not found.' });
    audit('task_deleted', { req, actor: req.admin, targetId: String(t._id), targetType: 'task', details: { title: t.title, assignee: t.assigneeName } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ─────────────────────────────── GitHub ───────────────────────────────────────

// GET /work/github/status - everyone learns whether it is connected; only super admins see who connected it and the token hint
router.get('/github/status', verifyAdmin, async (req, res, next) => {
  try {
    const s = await github.status();
    if (isSuper(req)) return res.json(s);
    res.json({ connected: s.connected, repo: s.repo });
  } catch (e) { next(e); }
});

// PUT /work/github/connect { repo, token } - checks the token against the repo, then saves it encrypted
router.put('/github/connect', verifyAdmin, async (req, res, next) => {
  try {
    if (noDemoWrite(req, res)) return;
    if (!isSuper(req)) return deny(res, 'Only a super admin can connect GitHub.');
    const s = await github.connect({ repo: req.body.repo, token: req.body.token, by: meName(req) });
    audit('github_connected', { req, actor: req.admin, targetType: 'github', details: { repo: s.repo, tokenOwner: s.tokenOwner } });   // the token itself is never logged
    res.json(s);
  } catch (e) { e.status ? res.status(e.status).json({ error: e.message }) : next(e); }
});

// DELETE /work/github/connect
router.delete('/github/connect', verifyAdmin, async (req, res, next) => {
  try {
    if (noDemoWrite(req, res)) return;
    if (!isSuper(req)) return deny(res, 'Only a super admin can disconnect GitHub.');
    await github.disconnect();
    audit('github_disconnected', { req, actor: req.admin, targetType: 'github' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// PUT /work/github/link/:employeeId { username } - link (or, with an empty username, unlink) a person's GitHub account
router.put('/github/link/:employeeId', verifyAdmin, async (req, res, next) => {
  try {
    if (noDemoWrite(req, res)) return;
    if (!isSuper(req)) return deny(res, 'Only a super admin can link GitHub accounts.');
    if (!validId(req.params.employeeId)) return res.status(404).json({ error: 'Person not found.' });
    const emp = await Employee.findById(req.params.employeeId).select('name');
    if (!emp) return res.status(404).json({ error: 'Person not found.' });

    const raw = cleanText(req.body.username, 60).replace(/^@/, '');
    if (!raw) {
      await Employee.updateOne({ _id: emp._id }, { $unset: { githubUsername: '', githubId: '' } });
      audit('github_unlinked', { req, actor: req.admin, targetId: String(emp._id), targetType: 'employee', details: { name: emp.name } });
      return res.json({ ok: true, githubUsername: '' });
    }
    const u = await github.lookupUser(raw);   // proves the account exists and gives us its permanent id
    const clash = await Employee.findOne({ _id: { $ne: emp._id }, $or: [{ githubId: u.id }, { githubUsername: new RegExp(`^${u.login}$`, 'i') }] }).select('name').lean();
    if (clash) return res.status(400).json({ error: `@${u.login} is already linked to ${clash.name}.` });
    await Employee.updateOne({ _id: emp._id }, { $set: { githubUsername: u.login, githubId: u.id } });
    audit('github_linked', { req, actor: req.admin, targetId: String(emp._id), targetType: 'employee', details: { name: emp.name, github: u.login } });
    res.json({ ok: true, githubUsername: u.login, avatar: u.avatar });
  } catch (e) { e.status ? res.status(e.status).json({ error: e.message }) : next(e); }
});

// GET /work/github/prs - the live feed. Each PR carries the person it belongs to (matched by GitHub id, then username).
router.get('/github/prs', verifyAdmin, async (req, res, next) => {
  try {
    const feed = await github.listPulls();
    const linked = await Employee.find({ githubUsername: { $exists: true, $ne: '' }, status: 'active' }).select('name githubUsername githubId').lean();
    const byId = new Map(linked.filter((e) => e.githubId).map((e) => [e.githubId, e]));
    const byLogin = new Map(linked.map((e) => [String(e.githubUsername).toLowerCase(), e]));

    let prs = feed.prs.map((p) => {
      const e = byId.get(p.author.id) || byLogin.get(p.author.login.toLowerCase());
      return { ...p, employee: e ? { _id: String(e._id), name: e.name } : null };
    });

    const all = seesAllWork(req);
    const me = meId(req);
    if (!all) prs = prs.filter((p) => me && p.employee?._id === me);

    const out = { repo: feed.repo, fetchedAt: feed.fetchedAt, stale: !!feed.stale, warning: feed.warning || null, scope: all ? 'all' : 'mine', prs };

    if (all) {
      const counts = new Map();
      for (const p of prs) if (p.employee) {
        const c = counts.get(p.employee._id) || { open: 0, merged: 0, closed: 0, draft: 0 };
        c[p.state]++; counts.set(p.employee._id, c);
      }
      const roster = await Employee.find({ status: 'active', isDemo: { $ne: true } }).select('name role githubUsername').sort({ name: 1 }).lean();
      out.people = roster.map((e) => ({
        _id: String(e._id), name: e.name, role: e.role, githubUsername: e.githubUsername || '',
        counts: counts.get(String(e._id)) || { open: 0, merged: 0, closed: 0, draft: 0 },
      }));
      out.unmatchedAuthors = [...new Set(prs.filter((p) => !p.employee).map((p) => p.author.login))].slice(0, 50);
    }
    res.json(out);
  } catch (e) {
    if (e.notConnected) return res.json({ connected: false, prs: [] });
    e.status ? res.status(e.status).json({ error: e.message }) : next(e);
  }
});

module.exports = router;
