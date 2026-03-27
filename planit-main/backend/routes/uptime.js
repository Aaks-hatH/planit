'use strict';

const express        = require('express');
const router         = express.Router();
const { realIp }     = require('../middleware/realIp');
const mongoose       = require('mongoose');
const axios          = require('axios');
const rateLimit      = require('express-rate-limit');
const Incident       = require('../models/Incident');
const UptimeReport   = require('../models/UptimeReport');
const UptimeCheck    = require('../models/UptimeCheck');
const UptimeOverride = require('../models/UptimeOverride');
const { verifyAdmin } = require('../middleware/auth');

const SERVICE_CATEGORIES = [
  { id: 'main',          label: 'Main Pages',           services: ['homepage','about','support','wall','status','terms','privacy'] },
  { id: 'planning',      label: 'Planning & Events',    services: ['event-creation','event-space','tasks','notes','expenses','countdown','analytics','announcements','utilities'] },
  { id: 'collaboration', label: 'Collaboration',        services: ['chat','storage','polls','invites'] },
  { id: 'checkins',      label: 'Check-ins',            services: ['checkin','enterprise-checkin','manager-override','qr-checkin','guest-checkin'] },
  { id: 'enterprise',    label: 'Enterprise',           services: ['enterprise','security','data-retention','manager-controls','organizer-login'] },
  { id: 'auth',          label: 'Authentication',       services: ['auth','tokens','antifraud','rate-limit'] },
  { id: 'api',           label: 'API & Infrastructure', services: ['api','websocket','jobs','signing'] },
  { id: 'database',      label: 'Database & Storage',   services: ['database','redis','file-storage','media','backups'] },
  { id: 'table-service', label: 'Table Service',        services: ['table-management','waitlist','qr-reservations','floor-map','server-assignment','wait-board','reservation-system','walkin-management'] },
  { id: 'notifications', label: 'Notifications',        services: ['email','push','ntfy','webhooks'] },
];
const ALL_SERVICE_KEYS = SERVICE_CATEGORIES.flatMap(c => c.services);

async function sendNtfy({ title, message, priority = 'high', tags = [] }) {
  const url = process.env.NTFY_URL;
  if (!url) return;
  try {
    const headers = { 'Title': title, 'Priority': priority, 'Tags': tags.join(','), 'Content-Type': 'text/plain' };
    if (process.env.FRONTEND_URL) headers['Actions'] = `view, Open Status Page, ${process.env.FRONTEND_URL}/status`;
    await axios.post(url, message, { headers, timeout: 6000 });
  } catch (err) { console.error('[ntfy] Failed:', err.response?.status || err.message); }
}

const reportRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, max: 3, standardHeaders: true, legacyHeaders: false,
  keyGenerator: (req) => realIp(req),
  handler: (req, res) => res.status(429).json({ error: 'Too many reports. Limit: 3 per hour.', retryAfter: Math.ceil(req.rateLimit.resetTime ? (req.rateLimit.resetTime - Date.now()) / 60000 : 60) + ' minutes' }),
});

const DEDUP_WINDOW_MS = 60 * 60 * 1000, NTFY_THRESHOLD = 10, NTFY_COOLDOWN_MS = 60 * 60 * 1000;
const reportersByService = new Map(), thresholdFiredAt = new Map();

function normaliseService(raw) { return (raw || 'general').trim().toLowerCase().slice(0, 100); }
function isDuplicate(service, ip) {
  const now = Date.now();
  let entry = reportersByService.get(service);
  if (entry && (now - entry.windowStart) > DEDUP_WINDOW_MS) { entry = null; reportersByService.delete(service); thresholdFiredAt.delete(service); }
  if (!entry) { entry = { ips: new Set(), windowStart: now }; reportersByService.set(service, entry); }
  if (entry.ips.has(ip)) return true;
  entry.ips.add(ip); return false;
}
function getReporterCount(service) { const e = reportersByService.get(service); return e ? e.ips.size : 0; }
function shouldFireThresholdAlert(service) {
  if (getReporterCount(service) < NTFY_THRESHOLD) return false;
  const last = thresholdFiredAt.get(service);
  if (last && (Date.now() - last) < NTFY_COOLDOWN_MS) return false;
  thresholdFiredAt.set(service, Date.now()); return true;
}

router.get('/status', async (req, res) => {
  try {
    const activeIncidents = await Incident.find({ status: { $ne: 'resolved' } }).sort({ createdAt: -1 });
    const recentResolved  = await Incident.find({ status: 'resolved', resolvedAt: { $gte: new Date(Date.now() - 7*24*60*60*1000) } }).sort({ resolvedAt: -1 }).limit(10);
    const dbOk = mongoose.connection.readyState === 1;
    let overallStatus = 'operational';
    if (activeIncidents.some(i => i.severity === 'critical')) overallStatus = 'outage';
    else if (activeIncidents.length > 0) overallStatus = 'degraded';
    res.json({ status: overallStatus, dbStatus: dbOk ? 'connected' : 'disconnected', uptimeSeconds: Math.floor(process.uptime()), activeIncidents, recentResolved, checkedAt: new Date().toISOString() });
  } catch (err) { res.status(500).json({ error: 'Failed to fetch status' }); }
});

router.head('/ping', (req, res) => {
  res.set({ 'X-Service': 'planit-backend', 'X-Uptime': Math.floor(process.uptime()).toString(), 'X-DB': mongoose.connection.readyState === 1 ? 'ok' : 'down' });
  res.sendStatus(200);
});
router.get('/ping', (req, res) => res.json({ ok: true, db: mongoose.connection.readyState === 1 ? 'ok' : 'down', uptime: Math.floor(process.uptime()), ts: new Date().toISOString() }));

router.post('/report', reportRateLimit, async (req, res) => {
  try {
    const { description, email, affectedService } = req.body;
    if (!description || description.trim().length < 5) return res.status(400).json({ error: 'Description required (min 5 chars).' });
    const service = normaliseService(affectedService), clientIp = realIp(req);
    if (isDuplicate(service, clientIp)) return res.json({ success: true, duplicate: true, message: "Report already recorded for this service." });
    const report = await UptimeReport.create({ description: description.trim().slice(0,500), email: (email||'').trim().slice(0,200), affectedService: service, status: 'pending' });
    const cnt = getReporterCount(service), isAuto = description.startsWith('[AUTO]');
    sendNtfy({ title: isAuto ? 'AUTO-DETECT: API unreachable' : `Report #${cnt} — ${service}`, message: `${description.trim().slice(0,300)}\n\nUnique reporters this hour: ${cnt}`, priority: isAuto ? 'urgent' : 'default', tags: isAuto ? ['rotating_light'] : ['bar_chart'] }).catch(()=>{});
    if (shouldFireThresholdAlert(service)) sendNtfy({ title: `⚠️ ${cnt} users reporting "${service}"`, message: `${cnt} users reported issues with "${service}" in the last hour.\n\nReview: ${process.env.FRONTEND_URL||''}/admin`, priority: 'high', tags: ['warning'] }).catch(()=>{});
    res.status(201).json({ success: true, reportId: report._id });
  } catch (err) { res.status(500).json({ error: 'Failed to submit report' }); }
});

router.get('/admin/reports',         verifyAdmin, async (req, res) => { try { res.json({ reports: await UptimeReport.find().sort({ createdAt: -1 }).limit(100) }); } catch(e){ res.status(500).json({error:'Failed'}); }});
router.patch('/admin/reports/:id',   verifyAdmin, async (req, res) => { try { const r = await UptimeReport.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true }); if (!r) return res.status(404).json({error:'Not found'}); res.json({report:r}); } catch(e){ res.status(500).json({error:'Failed'}); }});
router.get('/admin/report-volume',   verifyAdmin, (req, res) => { const s=[]; for(const[service,entry]of reportersByService.entries()){ const wAge=Date.now()-entry.windowStart, rem=Math.max(0,DEDUP_WINDOW_MS-wAge); s.push({service,uniqueReporters:entry.ips.size,windowStartedAt:new Date(entry.windowStart).toISOString(),windowResetsIn:Math.ceil(rem/60000)+' minutes',thresholdReached:entry.ips.size>=NTFY_THRESHOLD,lastAlertFiredAt:thresholdFiredAt.has(service)?new Date(thresholdFiredAt.get(service)).toISOString():null}); } res.json({services:s,threshold:NTFY_THRESHOLD,windowMinutes:60}); });

router.get('/admin/incidents', verifyAdmin, async (req, res) => { try { res.json({ incidents: await Incident.find().sort({ createdAt: -1 }).limit(50) }); } catch(e){ res.status(500).json({error:'Failed'}); }});
router.post('/admin/incidents', verifyAdmin, async (req, res) => {
  try {
    const { title, description, severity, affectedServices, reportIds, initialMessage } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title required' });
    const timeline = initialMessage ? [{ status: 'investigating', message: initialMessage.trim() }] : [];
    const incident = await Incident.create({ title: title.trim(), description: (description||'').trim(), severity: severity||'minor', affectedServices: affectedServices||[], timeline, reportIds: reportIds||[] });
    if (reportIds?.length > 0) await UptimeReport.updateMany({ _id: { $in: reportIds } }, { status: 'confirmed', incidentId: incident._id });
    sendNtfy({ title: `Incident Created: ${incident.title}`, message: `Severity: ${incident.severity}\nServices: ${(affectedServices||[]).join(', ')||'General'}\n${initialMessage||''}`, priority: incident.severity==='critical'?'urgent':'high', tags:['memo'] }).catch(()=>{});
    res.status(201).json({ incident });
  } catch(e){ res.status(500).json({error:'Failed to create incident'}); }
});
router.post('/admin/incidents/:id/timeline', verifyAdmin, async (req, res) => {
  try {
    const { status, message } = req.body;
    if (!status || !message) return res.status(400).json({ error: 'Status and message required' });
    const inc = await Incident.findById(req.params.id);
    if (!inc) return res.status(404).json({ error: 'Not found' });
    inc.timeline.push({ status, message: message.trim() });
    inc.status = status;
    if (status === 'resolved') { inc.resolvedAt = new Date(); inc.downtimeMinutes = Math.round((inc.resolvedAt - inc.createdAt) / 60000); }
    await inc.save();
    sendNtfy({ title: `Incident Update: ${status.toUpperCase()}`, message: `${inc.title}\n\n${message.trim()}`, priority: status==='resolved'?'default':'high', tags: status==='resolved'?['white_check_mark']:['memo'] }).catch(()=>{});
    res.json({ incident: inc });
  } catch(e){ res.status(500).json({error:'Failed'}); }
});
router.patch('/admin/incidents/:id',   verifyAdmin, async (req, res) => { try { const { title, description, severity, affectedServices } = req.body; const inc = await Incident.findByIdAndUpdate(req.params.id, { title, description, severity, affectedServices }, { new: true }); if (!inc) return res.status(404).json({error:'Not found'}); res.json({incident:inc}); } catch(e){ res.status(500).json({error:'Failed'}); }});
router.delete('/admin/incidents/:id',  verifyAdmin, async (req, res) => { try { await Incident.findByIdAndDelete(req.params.id); res.json({success:true}); } catch(e){ res.status(500).json({error:'Failed'}); }});

// ─── Core history builders ────────────────────────────────────────────────────

async function buildServerHistory(serverName, days) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows  = await UptimeCheck.aggregate([
    { $match: { service: serverName, createdAt: { $gte: since } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, total: {$sum:1}, upCount: {$sum:{$cond:[{$eq:['$status','up']},1,0]}}, avgLatency: {$avg:'$latencyMs'} } },
    { $sort: { _id: 1 } },
  ]);
  const byDay = {};
  rows.forEach(r => { byDay[r._id] = r; });
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0,0,0,0);
    const dateStr = d.toISOString().slice(0,10);
    const row = byDay[dateStr];
    result.push({ date: dateStr, timestamp: d.getTime(), pct: row ? parseFloat(((row.upCount/row.total)*100).toFixed(4)) : null, upChecks: row?.upCount??null, total: row?.total??null, avgLatency: row ? Math.round(row.avgLatency) : null, override: false, source: 'checks' });
  }
  return result;
}

async function buildServiceHistory(serviceKey, days) {
  const cutoff    = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const incidents = await Incident.find({ createdAt: { $gte: cutoff }, $or: [{ affectedServices: serviceKey }, { affectedServices: { $size: 0 } }] }).sort({ createdAt: 1 });
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0,0,0,0);
    const dEnd = new Date(d); dEnd.setHours(23,59,59,999);
    const dateStr = d.toISOString().slice(0,10);
    const dayIncs = incidents.filter(inc => { const s=new Date(inc.createdAt), e=inc.resolvedAt?new Date(inc.resolvedAt):new Date(); return s<=dEnd&&e>=d; });
    let pct = 100;
    if (dayIncs.length > 0) {
      const downMin = dayIncs.reduce((acc,inc) => { const s=Math.max(new Date(inc.createdAt).getTime(),d.getTime()), e=inc.resolvedAt?Math.min(new Date(inc.resolvedAt).getTime(),dEnd.getTime()):Math.min(Date.now(),dEnd.getTime()); return acc+Math.max(0,(e-s)/60000); }, 0);
      pct = Math.max(0, parseFloat((100-(downMin/1440)*100).toFixed(4)));
    }
    result.push({ date: dateStr, timestamp: d.getTime(), pct, incidents: dayIncs.length, override: false, source: 'incidents' });
  }
  return result;
}

async function loadOverrides(names) {
  const docs = await UptimeOverride.find({ service: { $in: names } });
  const map  = {};
  names.forEach(n => { map[n] = { whole: null, points: {} }; });
  docs.forEach(d => { if (!map[d.service]) map[d.service] = { whole: null, points: {} }; if (!d.date) map[d.service].whole = d; else map[d.service].points[d.date] = d; });
  return map;
}

function applyOverrides(days, entry) {
  if (!entry) return;
  days.forEach(day => {
    const pt = entry.points[day.date];
    if (pt) { day.pct = pt.pct; day.override = true; day.overrideLabel = pt.label; return; }
    if (entry.whole) { day.pct = entry.whole.pct; day.override = true; day.overrideLabel = entry.whole.label; }
  });
}

// ─── GET /admin/server-health-history ────────────────────────────────────────

router.get('/admin/server-health-history', verifyAdmin, async (req, res) => {
  try {
    const days      = Math.min(parseInt(req.query.days || '30', 10), 90);
    const checkSince = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Server names from UptimeCheck (real watchdog pings)
    const serverNames = await UptimeCheck.distinct('service', { createdAt: { $gte: checkSince } });

    // All 40+ logical service keys (always show all, even if no incidents)
    const incidentKeys = await Incident.find({ createdAt: { $gte: checkSince } }).distinct('affectedServices');
    const serviceKeys  = [...new Set(['general', ...ALL_SERVICE_KEYS, ...incidentKeys.filter(Boolean)])];

    const overrideMap = await loadOverrides([...serverNames, ...serviceKeys]);

    // Build server histories (real check data)
    const serverHistory = {};
    for (const name of serverNames) {
      const raw = await buildServerHistory(name, days);
      applyOverrides(raw, overrideMap[name]);
      const valid = raw.filter(d => d.pct !== null);
      serverHistory[name] = {
        days, history: raw,
        avgPct:   valid.length > 0 ? parseFloat((valid.reduce((a,d) => a+d.pct,0)/valid.length).toFixed(4)) : null,
        override: overrideMap[name]?.whole ? { pct: overrideMap[name].whole.pct, label: overrideMap[name].whole.label, setAt: overrideMap[name].whole.setAt } : null,
        source: 'checks',
      };
    }

    // Build service histories (incident-derived)
    const serviceHistory = {};
    for (const key of serviceKeys) {
      const raw = await buildServiceHistory(key, days);
      applyOverrides(raw, overrideMap[key]);
      const sum = raw.reduce((a,d) => a+d.pct,0);
      serviceHistory[key] = {
        days, history: raw,
        avgPct:   parseFloat((sum/raw.length).toFixed(4)),
        override: overrideMap[key]?.whole ? { pct: overrideMap[key].whole.pct, label: overrideMap[key].whole.label, setAt: overrideMap[key].whole.setAt } : null,
        source: 'incidents',
      };
    }

    res.json({ servers: serverHistory, serverNames, services: serviceHistory, serviceKeys, serviceCategories: SERVICE_CATEGORIES, days, generatedAt: new Date().toISOString(), processUptimeSeconds: Math.floor(process.uptime()) });
  } catch (err) {
    console.error('[uptime] history error:', err.message);
    res.status(500).json({ error: 'Failed to build history' });
  }
});

// ─── POST /admin/uptime-override ─────────────────────────────────────────────

router.post('/admin/uptime-override', verifyAdmin, async (req, res) => {
  try {
    const { service, pct, label } = req.body;
    if (!service) return res.status(400).json({ error: 'service required' });
    const n = parseFloat(pct);
    if (isNaN(n) || n < 0 || n > 100) return res.status(400).json({ error: 'pct must be 0–100' });
    await UptimeOverride.findOneAndUpdate({ service, date: null }, { pct: n, label: label||null, setAt: new Date() }, { upsert: true, new: true });
    console.log(`[uptime] Override → DB: service="${service}", pct=${n}`);
    res.json({ success: true, service, pct: n });
  } catch (err) { res.status(500).json({ error: 'Failed to set override' }); }
});

// ─── DELETE /admin/uptime-override/:service ───────────────────────────────────

router.delete('/admin/uptime-override/:service', verifyAdmin, async (req, res) => {
  try {
    const svc = decodeURIComponent(req.params.service);
    await UptimeOverride.deleteMany({ service: svc });
    res.json({ success: true, service: svc });
  } catch (err) { res.status(500).json({ error: 'Failed to clear override' }); }
});

// ─── POST /admin/override-all-uptime ─────────────────────────────────────────

router.post('/admin/override-all-uptime', verifyAdmin, async (req, res) => {
  try {
    const { pct = 100 } = req.body;
    const n = parseFloat(pct);
    if (isNaN(n) || n < 0 || n > 100) return res.status(400).json({ error: 'pct must be 0–100' });

    const activeIncidents = await Incident.find({ status: { $ne: 'resolved' } });
    const now = new Date();
    await Promise.all(activeIncidents.map(inc => {
      inc.status = 'resolved'; inc.resolvedAt = now;
      inc.downtimeMinutes = Math.round((now - inc.createdAt) / 60000);
      inc.timeline.push({ status: 'resolved', message: 'Resolved via admin override — all systems operational.', createdAt: now });
      return inc.save();
    }));

    const affectedSvcs = [...new Set(['general', ...activeIncidents.flatMap(i => i.affectedServices.length ? i.affectedServices : ['general'])])];
    if (affectedSvcs.length > 0) {
      await UptimeOverride.bulkWrite(affectedSvcs.map(svc => ({
        updateOne: { filter: { service: svc, date: null }, update: { $set: { pct: n, label: 'Admin override', setAt: now } }, upsert: true }
      })));
    }

    console.log(`[uptime] Nuclear override: ${activeIncidents.length} incidents resolved, ${affectedSvcs.length} services → ${n}%`);
    res.json({ success: true, incidentsResolved: activeIncidents.length, servicesOverridden: affectedSvcs, pct: n });
  } catch (err) { res.status(500).json({ error: 'Failed to override' }); }
});

// ─── PATCH /admin/server-health-history/:service/:date ───────────────────────
// Edit a single day. :date = YYYY-MM-DD. Persists to MongoDB.

router.patch('/admin/server-health-history/:service/:date', verifyAdmin, async (req, res) => {
  try {
    const service = decodeURIComponent(req.params.service);
    const date    = req.params.date;
    const n       = parseFloat(req.body.pct);
    if (isNaN(n) || n < 0 || n > 100) return res.status(400).json({ error: 'pct must be 0–100' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) && !/^\d{13}$/.test(date)) return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
    // Accept both YYYY-MM-DD and unix-ms (legacy)
    const normalizedDate = /^\d{13}$/.test(date) ? new Date(parseInt(date,10)).toISOString().slice(0,10) : date;
    await UptimeOverride.findOneAndUpdate({ service, date: normalizedDate }, { pct: n, label: req.body.label||null, setAt: new Date() }, { upsert: true, new: true });
    console.log(`[uptime] Point override → DB: ${service} / ${normalizedDate} → ${n}%`);
    res.json({ success: true, service, date: normalizedDate, pct: n });
  } catch (err) { res.status(500).json({ error: 'Failed to save point override' }); }
});

// ─── GET /admin/live-history ──────────────────────────────────────────────────
// Returns fine-grained history for the admin panel live graphs.
// ?window=1h  → last 60 mins, 1 data point per minute
// ?window=24h → last 24 hours, 1 data point per hour
// ?window=7d  → last 7 days, 1 data point per day
// ?window=15d → last 15 days, 1 data point per day (default)

router.get('/admin/live-history', verifyAdmin, async (req, res) => {
  try {
    const win = req.query.window || '15d';

    let since, groupFmt, bucketMs, labelFn;
    if (win === '1h') {
      since    = new Date(Date.now() - 60 * 60 * 1000);
      groupFmt = '%Y-%m-%dT%H:%M';
      bucketMs = 60 * 1000;
      labelFn  = (s) => s.slice(11); // HH:MM
    } else if (win === '24h') {
      since    = new Date(Date.now() - 24 * 60 * 60 * 1000);
      groupFmt = '%Y-%m-%dT%H';
      bucketMs = 60 * 60 * 1000;
      labelFn  = (s) => s.slice(11) + ':00'; // HH:00
    } else if (win === '7d') {
      since    = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      groupFmt = '%Y-%m-%d';
      bucketMs = 24 * 60 * 60 * 1000;
      labelFn  = (s) => s.slice(5); // MM-DD
    } else {
      since    = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
      groupFmt = '%Y-%m-%d';
      bucketMs = 24 * 60 * 60 * 1000;
      labelFn  = (s) => s.slice(5);
    }

    // Build expected bucket list
    const now     = Date.now();
    const buckets = [];
    for (let t = since.getTime(); t <= now; t += bucketMs) {
      const d   = new Date(t);
      let key;
      if (win === '1h')  key = d.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
      else if (win === '24h') key = d.toISOString().slice(0, 13); // YYYY-MM-DDTHH
      else                    key = d.toISOString().slice(0, 10); // YYYY-MM-DD
      buckets.push({ key, ts: t, label: labelFn(key) });
    }

    // Aggregate UptimeCheck by bucket per service
    const rows = await UptimeCheck.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: {
          _id: {
            service: '$service',
            bucket:  { $dateToString: { format: groupFmt, date: '$createdAt', timezone: 'UTC' } },
          },
          total:      { $sum: 1 },
          upCount:    { $sum: { $cond: [{ $eq: ['$status', 'up'] }, 1, 0] } },
          avgLatency: { $avg: '$latencyMs' },
        }
      },
    ]);

    // Re-index by service → bucket
    const bySvc = {};
    rows.forEach(r => {
      const svc = r._id.service;
      if (!bySvc[svc]) bySvc[svc] = {};
      bySvc[svc][r._id.bucket] = { total: r.total, upCount: r.upCount, avgLatency: r.avgLatency };
    });

    // Build per-service history
    const result = {};
    const serverNames = Object.keys(bySvc);
    for (const name of serverNames) {
      const history = buckets.map(b => {
        const row = bySvc[name]?.[b.key];
        return {
          bucket:     b.key,
          ts:         b.ts,
          label:      b.label,
          pct:        row ? parseFloat(((row.upCount / row.total) * 100).toFixed(2)) : null,
          upChecks:   row?.upCount ?? null,
          total:      row?.total ?? null,
          avgLatency: row ? Math.round(row.avgLatency) : null,
        };
      });
      const valid  = history.filter(d => d.pct !== null);
      result[name] = {
        history,
        avgPct:  valid.length ? parseFloat((valid.reduce((a, d) => a + d.pct, 0) / valid.length).toFixed(2)) : null,
        current: history[history.length - 1] ?? null,
      };
    }

    res.json({ servers: result, serverNames, window: win, buckets: buckets.length, generatedAt: new Date().toISOString() });
  } catch (err) {
    console.error('[uptime] live-history error:', err.message);
    res.status(500).json({ error: 'Failed' });
  }
});

// ─── GET /uptime/server-history (PUBLIC) ─────────────────────────────────────
// Used by Status.jsx so admin overrides are reflected on the public status page.
// Returns 15-day server history (UptimeCheck + UptimeOverride).

router.get('/server-history', async (req, res) => {
  try {
    const days  = 15;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const serverNames    = await UptimeCheck.distinct('service', { createdAt: { $gte: since } });
    const overrideMap    = await loadOverrides(serverNames);

    const services = {};
    for (const name of serverNames) {
      const raw = await buildServerHistory(name, days);
      applyOverrides(raw, overrideMap[name]);
      const valid   = raw.filter(d => d.pct !== null);
      const avgPct  = valid.length ? parseFloat((valid.reduce((a, d) => a + d.pct, 0) / valid.length).toFixed(2)) : null;
      services[name] = { days: raw, uptimePct: avgPct };
    }

    res.json({ services, serverNames, days, generatedAt: new Date().toISOString() });
  } catch (err) {
    console.error('[uptime] server-history error:', err.message);
    res.status(500).json({ error: 'Failed' });
  }
});

module.exports = router;