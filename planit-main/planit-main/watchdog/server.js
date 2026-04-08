'use strict';

require('dotenv').config();
const express  = require('express');
const mongoose = require('mongoose');
const axios    = require('axios');
const { meshAuth, meshGet } = require('./mesh');

function ts() { return new Date().toISOString(); }

// ─── Log ring-buffer ──────────────────────────────────────────────────────────
// Captures every console.log/warn/error into an in-memory buffer (last 2000
// entries) so the admin panel can fetch watchdog logs via /mesh/logs.
const WATCHDOG_LOG_BUFFER = [];
const WATCHDOG_LOG_MAX    = 2000;

function pushWatchdogLog(level, args) {
  const entry = {
    ts:     new Date().toISOString(),
    level,
    msg:    args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '),
    source: 'watchdog',
  };
  WATCHDOG_LOG_BUFFER.push(entry);
  if (WATCHDOG_LOG_BUFFER.length > WATCHDOG_LOG_MAX) WATCHDOG_LOG_BUFFER.shift();
}

const _wLog   = console.log.bind(console);
const _wWarn  = console.warn.bind(console);
const _wError = console.error.bind(console);
console.log   = (...a) => { pushWatchdogLog('info',  a); _wLog(...a);   };
console.warn  = (...a) => { pushWatchdogLog('warn',  a); _wWarn(...a);  };
console.error = (...a) => { pushWatchdogLog('error', a); _wError(...a); };

// ─── Config ───────────────────────────────────────────────────────────────────

const BACKEND_URLS_RAW  = process.env.BACKEND_URLS  || process.env.MAIN_SERVER_URL || '';
const ROUTER_URL        = process.env.ROUTER_URL    || '';
const FRONTEND_URL      = process.env.FRONTEND_URL  || 'https://planitapp.onrender.com';
const MONGO_URI         = process.env.MONGO_URI;
const NTFY_URL          = process.env.NTFY_URL;
const NTFY_TOKEN        = process.env.NTFY_TOKEN    || '';
const PING_MS           = parseInt(process.env.PING_INTERVAL_MS  || '60000', 10);
const THRESHOLD         = parseInt(process.env.FAILURE_THRESHOLD || '3',     10);
const PORT              = process.env.PORT           || '4000';
const SERVICE_NAME      = process.env.SERVICE_NAME  || 'watchdog';

// SLO config
// SLO_TARGET_PCT   — the uptime percentage you promise (default 99.5)
// LATENCY_WARN_MS  — p95 latency that triggers a warning alert (default 3000ms)
// LATENCY_CRIT_MS  — p95 latency that triggers a critical alert (default 8000ms)
const SLO_TARGET_PCT   = parseFloat(process.env.SLO_TARGET_PCT  || '99.5');
const LATENCY_WARN_MS  = parseInt(process.env.LATENCY_WARN_MS   || '3000',  10);
const LATENCY_CRIT_MS  = parseInt(process.env.LATENCY_CRIT_MS   || '8000',  10);

// Maintenance window — ISO strings or empty.  When NOW is inside the window,
// all alert notifications are suppressed (checks + incidents still recorded).
// Example:  MAINTENANCE_START=2025-04-01T02:00:00Z  MAINTENANCE_END=2025-04-01T04:00:00Z
const MAINTENANCE_START = process.env.MAINTENANCE_START ? new Date(process.env.MAINTENANCE_START) : null;
const MAINTENANCE_END   = process.env.MAINTENANCE_END   ? new Date(process.env.MAINTENANCE_END)   : null;

function inMaintenanceWindow() {
  if (!MAINTENANCE_START || !MAINTENANCE_END) return false;
  const now = Date.now();
  return now >= MAINTENANCE_START.getTime() && now <= MAINTENANCE_END.getTime();
}

// ─── Build target list ────────────────────────────────────────────────────────

const backendUrls   = BACKEND_URLS_RAW.split(',').map(u => u.trim()).filter(Boolean);
const customLabels  = (process.env.BACKEND_LABELS  || '').split(',').map(s => s.trim()).filter(Boolean);
const customRegions = (process.env.BACKEND_REGIONS || '').split(',').map(s => s.trim()).filter(Boolean);
const FALLBACK_NAMES = ['Alpha','Bravo','Charlie','Delta','Echo','Foxtrot','Golf'];

const targets = [];

backendUrls.forEach((url, i) => {
  targets.push({
    name:    customLabels[i]  || FALLBACK_NAMES[i] || `Server ${i + 1}`,
    region:  customRegions[i] || null,
    url,
    pingUrl: `${url}/api/uptime/ping`, // rate-limit exempt — /api/health is NOT
    type:    'backend',
  });
});

if (ROUTER_URL) {
  targets.push({ name: 'Load Balancer', url: ROUTER_URL, pingUrl: `${ROUTER_URL}/health`, type: 'router' });
}

if (targets.length === 0) {
  console.error(`[${ts()}] FATAL: No targets configured. Set BACKEND_URLS and/or ROUTER_URL.`);
  process.exit(1);
}

if (!MONGO_URI) {
  console.error(`[${ts()}] FATAL: MONGO_URI is required.`);
  process.exit(1);
}

// ─── Startup log ──────────────────────────────────────────────────────────────

console.log(`\n[${ts()}] +==================================================+`);
console.log(`[${ts()}] |     PlanIt Watchdog - ENTERPRISE - STARTING     |`);
console.log(`[${ts()}] +==================================================+`);
console.log(`[${ts()}]   Monitoring ${targets.length} target(s):`);
targets.forEach(t => console.log(`[${ts()}]     [${t.type}] ${t.name} -> ${t.pingUrl}`));
console.log(`[${ts()}]   Interval   : ${PING_MS / 1000}s`);
console.log(`[${ts()}]   Threshold  : ${THRESHOLD} failures`);
console.log(`[${ts()}]   SLO target : ${SLO_TARGET_PCT}%`);
console.log(`[${ts()}]   Lat warn   : ${LATENCY_WARN_MS}ms  crit: ${LATENCY_CRIT_MS}ms`);
console.log(`[${ts()}]   ntfy       : ${NTFY_URL || 'NOT SET - alerts disabled'}`);
console.log(`[${ts()}]   Maintenance: ${MAINTENANCE_START ? `${MAINTENANCE_START.toISOString()} → ${MAINTENANCE_END.toISOString()}` : 'none'}`);
console.log(`[${ts()}]   Port       : ${PORT}\n`);

// ─── Mongoose models ──────────────────────────────────────────────────────────

const timelineUpdateSchema = new mongoose.Schema({
  status:    { type: String, enum: ['investigating','identified','monitoring','resolved'], required: true },
  message:   { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const incidentSchema = new mongoose.Schema({
  title:            { type: String, required: true },
  description:      { type: String, default: '' },
  severity:         { type: String, enum: ['minor','major','critical'], default: 'critical' },
  status:           { type: String, enum: ['investigating','identified','monitoring','resolved'], default: 'investigating' },
  affectedServices: [{ type: String }],
  timeline:         [timelineUpdateSchema],
  resolvedAt:       { type: Date, default: null },
  downtimeMinutes:  { type: Number, default: null },
  reportIds:        [{ type: mongoose.Schema.Types.ObjectId, ref: 'UptimeReport' }],
  createdAt:        { type: Date, default: Date.now },
  updatedAt:        { type: Date, default: Date.now },
});
incidentSchema.pre('save', function (next) { this.updatedAt = new Date(); next(); });

const uptimeReportSchema = new mongoose.Schema({
  description:     { type: String, required: true },
  email:           { type: String, default: '' },
  affectedService: { type: String, default: 'General' },
  status:          { type: String, enum: ['pending','confirmed','dismissed'], default: 'confirmed' },
  incidentId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Incident', default: null },
  createdAt:       { type: Date, default: Date.now },
});

const uptimeCheckSchema = new mongoose.Schema({
  service:   { type: String, required: true },
  status:    { type: String, enum: ['up','down'], required: true },
  latencyMs: { type: Number, default: null },
  error:     { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
});
uptimeCheckSchema.index({ createdAt: 1 }, { expireAfterSeconds: 1296000 }); // 15-day TTL
uptimeCheckSchema.index({ service: 1, createdAt: -1 });                      // query optimisation

const Incident     = mongoose.models.Incident     || mongoose.model('Incident',     incidentSchema);
const UptimeReport = mongoose.models.UptimeReport || mongoose.model('UptimeReport', uptimeReportSchema);
const UptimeCheck  = mongoose.models.UptimeCheck  || mongoose.model('UptimeCheck',  uptimeCheckSchema);

// ─── Per-target in-process state ──────────────────────────────────────────────

const states = {};
targets.forEach(t => {
  states[t.name] = {
    consecutiveFailures:  0,
    consecutiveSuccesses: 0,
    isDown:               false,
    activeIncidentId:     null,
    lastPingMs:           null,
    lastPingAt:           null,
    lastError:            null,
    totalPings:           0,
    totalFailures:        0,
    downSince:            null,
    // Latency ring-buffer — last 100 samples, used for p50/p95/p99
    latencyWindow:        [],   // number[]
    // Latency alert state — avoid spamming ntfy on every slow ping
    latencyAlertFiredAt:  null,
    latencyAlertLevel:    null, // 'warn' | 'crit' | null
  };
});

// ─── Percentile helper ────────────────────────────────────────────────────────

function percentile(sortedArr, p) {
  if (!sortedArr.length) return null;
  const idx = Math.ceil((p / 100) * sortedArr.length) - 1;
  return sortedArr[Math.max(0, idx)];
}

function getLatencyPercentiles(name) {
  const w = [...states[name].latencyWindow].sort((a, b) => a - b);
  return {
    p50: percentile(w, 50),
    p95: percentile(w, 95),
    p99: percentile(w, 99),
    samples: w.length,
  };
}

// ─── SLO  ─────────────────────────────────────────────────────────────────────
// We compute the rolling 30-day error budget on demand from UptimeCheck docs.
// This is only called by /watchdog/slo (not by /watchdog/status) so it never
// blocks the hot status endpoint.

async function computeSLO() {
  const since  = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // One aggregation pipeline — much faster than loading every doc
  const rows = await UptimeCheck.aggregate([
    { $match: { createdAt: { $gte: since } } },
    { $group: {
        _id:    '$service',
        total:  { $sum: 1 },
        upCount:{ $sum: { $cond: [{ $eq: ['$status','up'] }, 1, 0] } },
      }
    },
  ]);

  const result = {};
  rows.forEach(r => {
    const uptimePct     = r.total > 0 ? (r.upCount / r.total) * 100 : 100;
    const errorBudgetPct = 100 - SLO_TARGET_PCT;                  // e.g. 0.5 %
    const consumedPct    = Math.max(0, (100 - uptimePct));        // downtime %
    const budgetRemaining = Math.max(0, errorBudgetPct - consumedPct);
    const burnPct         = errorBudgetPct > 0
      ? Math.min(100, (consumedPct / errorBudgetPct) * 100)
      : (consumedPct > 0 ? 100 : 0);

    result[r._id] = {
      totalChecks:       r.total,
      upChecks:          r.upCount,
      uptimePct:         +uptimePct.toFixed(4),
      sloTarget:         SLO_TARGET_PCT,
      sloMet:            uptimePct >= SLO_TARGET_PCT,
      errorBudgetPct:    +errorBudgetPct.toFixed(4),
      budgetConsumedPct: +consumedPct.toFixed(4),
      budgetRemainingPct:+budgetRemaining.toFixed(4),
      burnPct:           +burnPct.toFixed(1),  // 0–100; 100 = fully burned
    };
  });

  return { slo: result, window: '30d', generatedAt: new Date().toISOString() };
}

// ─── Uptime history (15-day, day-by-day) ─────────────────────────────────────
// Uses an aggregation pipeline rather than loading raw documents — 10-100x
// faster on large collections.

async function computeUptimeHistory() {
  const since = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);

  const rows = await UptimeCheck.aggregate([
    { $match: { createdAt: { $gte: since } } },
    { $group: {
        _id: {
          service: '$service',
          // yyyy-mm-dd key using date parts (avoids string parsing)
          day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        },
        total:   { $sum: 1 },
        upCount: { $sum: { $cond: [{ $eq: ['$status','up'] }, 1, 0] } },
      }
    },
  ]);

  // Build day list (last 15 days oldest-first)
  const days = [];
  for (let i = 14; i >= 0; i--) {
    const dt = new Date();
    dt.setDate(dt.getDate() - i);
    days.push(dt.toISOString().slice(0, 10));
  }

  // Reindex rows  →  byService[svcName][day] = { up, total }
  const byService = {};
  rows.forEach(r => {
    const svc = r._id.service;
    const day = r._id.day;
    if (!byService[svc]) byService[svc] = {};
    byService[svc][day] = { up: r.upCount, total: r.total };
  });

  const result = {};
  Object.entries(byService).forEach(([svc, dayMap]) => {
    const dayData = days.map(day => {
      const d = dayMap[day];
      return d
        ? { date: day, up: d.up, total: d.total, pct: d.total > 0 ? (d.up / d.total) * 100 : null }
        : { date: day, up: null, total: null, pct: null };
    });
    const totalUp     = Object.values(dayMap).reduce((s, d) => s + d.up,    0);
    const totalChecks = Object.values(dayMap).reduce((s, d) => s + d.total, 0);
    result[svc] = {
      days: dayData,
      totalChecks,
      totalUp,
      uptimePct: totalChecks > 0 ? +((totalUp / totalChecks) * 100).toFixed(2) : null,
    };
  });

  return { services: result, generatedAt: new Date().toISOString() };
}

// ─── /watchdog/status response cache ─────────────────────────────────────────
// The status endpoint used to call computeUptimeHistory() on EVERY request.
// With 15 days × 60 pings/hour × 24h = ~21 600 docs per service being loaded
// and iterated in JS, this was the sole cause of the slow / timeout you saw.
//
// Solution: cache the full response payload for 30 seconds.  The in-process
// ping state (states[]) is always live — only the DB-backed history section
// is stale by up to 30 s, which is totally fine for a status page.

let _statusCache    = null;
let _statusCacheAt  = 0;
const STATUS_CACHE_TTL_MS = 30_000; // 30 seconds

// Proactive background refresh — keeps the cache warm so the NEXT request
// is always instant (no cold-cache latency spike at TTL boundary).
async function refreshStatusCache() {
  const dbOk = await ensureDbConnected();

  let activeIncidents = [];
  let recentResolved  = [];
  let uptimeHistory   = null;

  if (dbOk) {
    try {
      [activeIncidents, recentResolved, uptimeHistory] = await Promise.all([
        Incident.find({ status: { $ne: 'resolved' } }).sort({ createdAt: -1 }).lean(),
        Incident.find({
          status:     'resolved',
          resolvedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        }).sort({ resolvedAt: -1 }).limit(10).lean(),
        computeUptimeHistory(),
      ]);
    } catch (err) {
      console.error(`[${ts()}] [cache] DB refresh failed: ${err.message}`);
    }
  }

  const anyDown = Object.values(states).some(s => s.isDown);
  const overallStatus = anyDown ? 'outage'
    : activeIncidents.some(i => i.severity === 'critical') ? 'outage'
    : activeIncidents.length > 0 ? 'degraded'
    : 'operational';

  const services = targets.map(t => {
    const s = states[t.name];
    return {
      name:       t.name,
      region:     t.region || null,
      type:       t.type,
      status:     s.isDown ? 'down' : 'up',
      lastPingMs: s.lastPingMs,
      lastPingAt: s.lastPingAt,
    };
  });

  _statusCache   = {
    status:          overallStatus,
    dbStatus:        dbOk ? 'connected' : 'disconnected',
    activeIncidents,
    recentResolved,
    uptimeHistory,
    checkedAt:       new Date().toISOString(),
    watchdog: {
      mainServer: anyDown ? 'DOWN' : 'UP',
      services,
    },
  };
  _statusCacheAt = Date.now();
}

// ─── DB connection ────────────────────────────────────────────────────────────

async function ensureDbConnected() {
  if (mongoose.connection.readyState === 1) return true;
  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 10000 });
    console.log(`[${ts()}] [db] MongoDB connected`);
    return true;
  } catch (err) {
    console.error(`[${ts()}] [db] MongoDB connect failed: ${err.message}`);
    return false;
  }
}

// ─── Mesh fleet state ─────────────────────────────────────────────────────────

let meshFleetState = null;

function isBackendActive(name) {
  if (!meshFleetState || !meshFleetState.backends) return true;
  const backend = meshFleetState.backends.find(b => b.name === name);
  if (!backend)               return true;
  if (backend.circuitTripped) return true;
  if (backend.alive === false) return true;
  return backend.active === true;
}

async function syncFleetState() {
  if (!ROUTER_URL) return;
  try {
    const result = await meshGet(SERVICE_NAME, `${ROUTER_URL}/mesh/status`, { timeout: 5000 });
    if (result.ok && result.data) {
      meshFleetState = result.data;
      console.log(`[${ts()}] [fleet] Synced - ${meshFleetState.backends?.filter(b => b.active).length ?? '?'} active`);
    }
  } catch (err) {
    console.warn(`[${ts()}] [fleet] Sync failed: ${err.message}`);
  }
}

if (ROUTER_URL) {
  syncFleetState();
  setInterval(syncFleetState, 30_000);
}

// ─── ntfy ─────────────────────────────────────────────────────────────────────

async function sendNtfy({ title, message, priority = 'high', tags = [] }) {
  if (!NTFY_URL) return;
  // Suppress all notifications during a maintenance window
  if (inMaintenanceWindow()) {
    console.log(`[${ts()}] [ntfy] Suppressed during maintenance window: "${title}"`);
    return;
  }
  try {
    const headers = {
      'Title':        title,
      'Priority':     priority,
      'Tags':         tags.join(','),
      'Content-Type': 'text/plain; charset=utf-8',
    };
    if (NTFY_TOKEN)   headers['Authorization'] = `Bearer ${NTFY_TOKEN}`;
    if (FRONTEND_URL) headers['Actions'] = `view, Open Status Page, ${FRONTEND_URL}/status`;
    const res = await axios.post(NTFY_URL, message, { headers, timeout: 10000 });
    console.log(`[${ts()}] [ntfy] Sent: "${title}" (HTTP ${res.status})`);
  } catch (err) {
    const status = err.response?.status;
    const hint = status === 401 ? ' - check NTFY_TOKEN'
               : status === 403 ? ' - access denied'
               : status === 404 ? ' - topic not found'
               : '';
    console.error(`[${ts()}] [ntfy] Failed: ${err.message}${hint}`);
  }
}

// ─── Incident message templates ───────────────────────────────────────────────

function serverRef(target) {
  return target.region ? `the ${target.name} server (${target.region})` : `the ${target.name} server`;
}

function incidentTitle(target) {
  if (target.type === 'router')    return 'Service Disruption - Platform Unavailable';
  if (backendUrls.length === 1)    return 'Service Disruption - API Unavailable';
  return `Service Degradation - the ${target.name} server is unavailable`;
}

function incidentDescription(target) {
  if (target.type === 'router') {
    return 'Our monitoring systems have detected that the PlanIt platform is currently unreachable. ' +
           'Users may be unable to access events, send messages, or use any platform features. ' +
           'Our team has been alerted and is investigating the issue.';
  }
  if (backendUrls.length === 1) {
    return 'Our monitoring systems have detected that the PlanIt API is not responding. ' +
           'Some users may experience difficulty accessing events or using platform features. ' +
           'Our team has been alerted and is actively investigating.';
  }
  return `Our monitoring systems have detected that ${serverRef(target)} is not responding. ` +
         'Users assigned to this server may experience degraded performance or a temporary ' +
         'inability to access their events. Our team is actively investigating. ' +
         'Other platform functions remain operational.';
}

function incidentAffectedServices(target) {
  return target.type === 'router'
    ? ['api','websocket','chat','file-sharing','polls']
    : ['api','websocket','chat'];
}

function investigatingMessage(target, errorMsg) {
  const technical = process.env.INCIDENT_INCLUDE_TECHNICAL === 'true' ? ` (Technical detail: ${errorMsg})` : '';
  if (target.type === 'router') {
    return `Our automated monitoring detected the platform became unreachable at ${new Date().toUTCString()}. ` +
           `Health checks failed ${THRESHOLD} consecutive times over ${Math.round((THRESHOLD * PING_MS) / 60000)} minutes. ` +
           `We are investigating the cause.${technical}`;
  }
  return `Automated monitoring detected that ${serverRef(target)} stopped responding at ${new Date().toUTCString()}. ` +
         `${THRESHOLD} consecutive health checks failed over ${Math.round((THRESHOLD * PING_MS) / 60000)} minutes. ` +
         `Traffic has been redistributed to other servers where possible. We are investigating.${technical}`;
}

function recoveryMessage(target, mins) {
  const duration = mins < 1 ? 'less than a minute' : `${mins} minute${mins !== 1 ? 's' : ''}`;
  if (target.type === 'router') {
    return `The platform has fully recovered and is operating normally. ` +
           `Total disruption duration: ${duration}. We apologise for any inconvenience caused.`;
  }
  return `${serverRef(target)} has recovered and is operating normally. ` +
         `Total disruption duration: ${duration}. All traffic has been restored. ` +
         `We apologise for any inconvenience caused.`;
}

async function createDownIncident(target, errorMsg) {
  const ok = await ensureDbConnected();
  if (!ok) return null;
  try {
    const report = await UptimeReport.create({
      description:     `Automated monitoring detected ${target.name} unreachable after ${THRESHOLD} consecutive health check failures.`,
      affectedService: target.name,
      status:          'confirmed',
    });
    const incident = await Incident.create({
      title:            incidentTitle(target),
      description:      incidentDescription(target),
      severity:         target.type === 'router' ? 'critical' : backendUrls.length === 1 ? 'critical' : 'major',
      status:           'investigating',
      affectedServices: incidentAffectedServices(target),
      reportIds:        [report._id],
      timeline: [{ status: 'investigating', message: investigatingMessage(target, errorMsg) }],
    });
    report.incidentId = incident._id;
    await report.save();
    console.log(`[${ts()}] [incident] Created for ${target.name}: ${incident._id}`);
    return incident._id;
  } catch (err) {
    console.error(`[${ts()}] [incident] Failed to create: ${err.message}`);
    return null;
  }
}

async function resolveDownIncident(target, incidentId, downtimeMs) {
  const ok = await ensureDbConnected();
  if (!ok) return;
  try {
    const incident = await Incident.findById(incidentId);
    if (!incident) return;
    const mins = Math.round(downtimeMs / 60000);
    incident.status          = 'resolved';
    incident.resolvedAt      = new Date();
    incident.downtimeMinutes = mins;
    incident.timeline.push({ status: 'resolved', message: recoveryMessage(target, mins) });
    await incident.save();
    console.log(`[${ts()}] [incident] Resolved for ${target.name} (${mins}m downtime)`);
  } catch (err) {
    console.error(`[${ts()}] [incident] Failed to resolve: ${err.message}`);
  }
}

// ─── Latency anomaly detection ────────────────────────────────────────────────
// Fires ntfy when the rolling p95 crosses the warn/crit threshold.
// Resets the alert when latency comes back down.  Rate-limited to once per 5
// minutes per service to avoid notification spam during a slow-but-not-down event.

const LATENCY_ALERT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

async function checkLatencyAnomaly(target, latencyMs) {
  const s    = states[target.name];
  const perc = getLatencyPercentiles(target.name);
  const p95  = perc.p95;

  if (!p95 || perc.samples < 5) return; // need at least 5 samples before alerting

  const now      = Date.now();
  const cooldown = s.latencyAlertFiredAt ? (now - s.latencyAlertFiredAt) < LATENCY_ALERT_COOLDOWN_MS : false;

  let newLevel = null;
  if (p95 >= LATENCY_CRIT_MS) newLevel = 'crit';
  else if (p95 >= LATENCY_WARN_MS) newLevel = 'warn';

  // Fire alert if level changed or if same level but cooldown expired
  if (newLevel && (newLevel !== s.latencyAlertLevel || !cooldown)) {
    s.latencyAlertFiredAt = now;
    s.latencyAlertLevel   = newLevel;

    const emoji   = newLevel === 'crit' ? '🔴' : '🟡';
    const ref     = target.type === 'router' ? 'Load Balancer' : `the ${target.name} server`;
    await sendNtfy({
      title:    `${emoji} ${target.name} - Latency ${newLevel === 'crit' ? 'Critical' : 'Warning'}`,
      message:  `${ref} is responding slowly.\n\np50: ${perc.p50}ms  p95: ${p95}ms  p99: ${perc.p99}ms\nThreshold: ${newLevel === 'crit' ? LATENCY_CRIT_MS : LATENCY_WARN_MS}ms\n\nThe service is still UP but degraded. Monitor for escalation.`,
      priority: newLevel === 'crit' ? 'urgent' : 'high',
      tags:     newLevel === 'crit' ? ['warning','hourglass'] : ['hourglass'],
    });

    console.warn(`[${ts()}] [latency] ${target.name} ${newLevel.toUpperCase()}: p95=${p95}ms`);
  }

  // Clear alert state when latency recovers
  if (!newLevel && s.latencyAlertLevel) {
    s.latencyAlertLevel   = null;
    s.latencyAlertFiredAt = null;
    console.log(`[${ts()}] [latency] ${target.name} latency normalised (p95=${p95}ms)`);
    await sendNtfy({
      title:   `✅ ${target.name} - Latency Normalised`,
      message: `${target.type === 'router' ? 'Load Balancer' : `The ${target.name} server`} latency has returned to normal levels.\n\np95: ${p95}ms`,
      priority: 'default',
      tags:     ['white_check_mark'],
    });
  }
}

// ─── Core ping loop ───────────────────────────────────────────────────────────

async function pingTarget(target) {
  const s = states[target.name];
  s.totalPings++;
  s.lastPingAt = new Date();

  try {
    const t0 = Date.now();
    const pingResp = await axios.head(target.pingUrl, {
      timeout:        30000, // Render cold-start can take up to 20s
      // Accept any non-5xx response as "up".
      // 429 = rate-limited → server IS alive, rate limiter is responding.
      // 4xx = client error → server IS alive.
      // Only 5xx / network errors = genuinely down.
      validateStatus: code => code < 500,
    });
    const ms = Date.now() - t0;
    if (pingResp.status === 429) {
      console.warn(`[${ts()}] ${target.name} rate-limited (429) — treating as UP`);
    }

    s.lastPingMs          = ms;
    s.lastError           = null;
    s.consecutiveFailures = 0;
    s.consecutiveSuccesses++;

    // Update latency ring-buffer (keep last 100 samples)
    s.latencyWindow.push(ms);
    if (s.latencyWindow.length > 100) s.latencyWindow.shift();

    // Store check (non-blocking)
    UptimeCheck.create({ service: target.name, status: 'up', latencyMs: ms }).catch(() => {});

    // Latency anomaly check (non-blocking)
    checkLatencyAnomaly(target, ms).catch(() => {});

    // Recovery
    if (s.isDown) {
      const downtimeMs = Date.now() - s.downSince;
      const mins       = Math.round(downtimeMs / 60000);
      s.isDown    = false;
      s.downSince = null;

      console.log(`[${ts()}] ${target.name} RECOVERED after ${mins}m - ${ms}ms`);

      if (s.activeIncidentId) {
        await resolveDownIncident(target, s.activeIncidentId, downtimeMs);
        s.activeIncidentId = null;
      }

      const ref = target.type === 'router' ? 'Load Balancer' : `the ${target.name} server`;
      await sendNtfy({
        title:    `${target.name} - Back Online`,
        message:  `${ref} is back online and operating normally.\nDowntime: ${mins < 1 ? '<1' : mins} minute(s)\nResponse time: ${ms}ms\nIncident auto-resolved on status page.`,
        priority: 'high',
        tags:     ['recovered'],
      });

      // A recovery invalidates the cache so the status page reflects it immediately
      _statusCacheAt = 0;
    } else {
      if (s.totalPings % 10 === 0 || s.totalPings <= 2) {
        console.log(`[${ts()}] ${target.name} OK - ${ms}ms (ping #${s.totalPings})`);
      }
    }

  } catch (err) {
    s.consecutiveFailures++;
    s.consecutiveSuccesses = 0;
    s.totalFailures++;
    s.lastError  = err.message;
    s.lastPingMs = null;

    UptimeCheck.create({ service: target.name, status: 'down', error: err.message }).catch(() => {});

    console.warn(`[${ts()}] ${target.name} FAILED (${s.consecutiveFailures}/${THRESHOLD}): ${err.message}`);

    if (s.consecutiveFailures === THRESHOLD && !s.isDown) {
      const isStandby = !isBackendActive(target.name);
      if (isStandby) {
        s.downSince = s.downSince || Date.now();
        console.log(`[${ts()}] [mesh] ${target.name} is STANDBY - suppressing. Escalates at ${THRESHOLD * 2} failures.`);
      } else {
        s.isDown    = true;
        s.downSince = Date.now();
        _statusCacheAt = 0; // bust cache immediately when a service goes down

        console.error(`[${ts()}] ${target.name} DOWN - writing incident to DB`);
        const incidentId   = await createDownIncident(target, err.message);
        s.activeIncidentId = incidentId;

        const downRef = target.type === 'router' ? 'Load Balancer' : `the ${target.name} server`;
        await sendNtfy({
          title:    `${target.name} - Service Disruption`,
          message:  `${downRef} is not responding.\n\nFailed checks: ${THRESHOLD}/${THRESHOLD}\nError: ${err.message}\n\nStatus page has been updated automatically.`,
          priority: 'urgent',
          tags:     ['down'],
        });
      }
    }

    // Standby override — 2× threshold with no recovery = genuine outage
    const OVERRIDE_AT = THRESHOLD * 2;
    if (!s.isDown && s.consecutiveFailures === OVERRIDE_AT) {
      const downMins = s.downSince ? Math.round((Date.now() - s.downSince) / 60000) : 0;
      console.error(`[${ts()}] [mesh] OVERRIDE: ${target.name} escalating after ${s.consecutiveFailures} failures (~${downMins}m)`);

      s.isDown    = true;
      s.downSince = s.downSince || Date.now();
      _statusCacheAt = 0;

      const incidentId   = await createDownIncident(target, err.message);
      s.activeIncidentId = incidentId;

      const downRef2 = target.type === 'router' ? 'Load Balancer' : `the ${target.name} server`;
      await sendNtfy({
        title:    `${target.name} - Service Disruption`,
        message:  `${downRef2} has been unavailable for ~${downMins} minute(s).\n\nInitially classified as standby but ${s.consecutiveFailures} consecutive failures confirm a genuine outage.\nError: ${err.message}\n\nStatus page has been updated automatically.`,
        priority: 'urgent',
        tags:     ['down'],
      });
    }

    // Reminder every 10 failures while confirmed down
    if (s.isDown && s.consecutiveFailures > THRESHOLD && s.consecutiveFailures % 10 === 0) {
      const downMins = Math.round((Date.now() - s.downSince) / 60000);
      const stillRef = target.type === 'router' ? 'Load Balancer' : `the ${target.name} server`;
      await sendNtfy({
        title:    `${target.name} - Still Unavailable (${downMins}m)`,
        message:  `${stillRef} has been unavailable for ${downMins} minutes.\nConsecutive failures: ${s.consecutiveFailures}\nError: ${err.message}\n\nStatus page reflects current outage.`,
        priority: 'high',
        tags:     ['warning'],
      });
    }
  }
}

async function pingAll() {
  targets.forEach((target, i) => {
    setTimeout(() => pingTarget(target), i * 2000);
  });
}

// ─── Express ──────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());

const ALLOWED_ORIGINS = new Set(
  [FRONTEND_URL, process.env.EXTRA_CORS_ORIGIN].filter(Boolean)
);

app.use((_req, res, next) => {
  const origin = _req.headers.origin;
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin',  origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (_req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ─── Public endpoints ─────────────────────────────────────────────────────────

app.get('/',               (_req, res) => res.send('PlanIt Watchdog OK'));
app.get('/watchdog/ping',  (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));
app.head('/watchdog/ping', (_req, res) => res.sendStatus(200));

// ── /watchdog/status  ─────────────────────────────────────────────────────────
// Returns the cached payload instantly (<5ms).  The cache is refreshed in the
// background every STATUS_CACHE_TTL_MS and also busted whenever a service goes
// down or recovers, so the data is always fresh when it actually matters.
app.get('/watchdog/status', async (_req, res) => {
  // Serve from cache if still warm
  if (_statusCache && (Date.now() - _statusCacheAt) < STATUS_CACHE_TTL_MS) {
    res.setHeader('X-Cache', 'HIT');
    res.setHeader('Cache-Control', 'public, max-age=30');
    return res.json(_statusCache);
  }

  // Cache miss (first request, or TTL expired) — refresh synchronously so
  // this request gets a fresh payload.  All subsequent requests within the
  // next 30s will hit the cache.
  res.setHeader('X-Cache', 'MISS');
  await refreshStatusCache().catch(err => {
    console.error(`[${ts()}] [status] Cache refresh error: ${err.message}`);
  });

  res.setHeader('Cache-Control', 'public, max-age=30');
  return res.json(_statusCache || { status: 'unknown', error: 'cache unavailable' });
});

// ── /watchdog/uptime  ─────────────────────────────────────────────────────────
// 15-day day-by-day history.  Separate endpoint so the status page can load
// quickly and this heavier query can be requested lazily by the frontend.
app.get('/watchdog/uptime', async (_req, res) => {
  const dbOk = await ensureDbConnected();
  if (!dbOk) return res.status(503).json({ error: 'DB unavailable' });
  try {
    const result = await computeUptimeHistory();
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.json(result);
  } catch (err) {
    console.error(`[${ts()}] [uptime] ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ── /watchdog/slo  ────────────────────────────────────────────────────────────
// 30-day rolling SLO report for each service.
// Shows uptime %, error budget remaining, and burn rate.
// Used by internal dashboards and the admin panel.
app.get('/watchdog/slo', async (_req, res) => {
  const dbOk = await ensureDbConnected();
  if (!dbOk) return res.status(503).json({ error: 'DB unavailable' });
  try {
    const result = await computeSLO();
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.json(result);
  } catch (err) {
    console.error(`[${ts()}] [slo] ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ── /watchdog/latency  ────────────────────────────────────────────────────────
// Returns the in-process latency ring-buffer percentiles for each service.
// No DB query — instant response from memory.
app.get('/watchdog/latency', (_req, res) => {
  const result = {};
  targets.forEach(t => {
    result[t.name] = {
      ...getLatencyPercentiles(t.name),
      alertLevel: states[t.name].latencyAlertLevel,
      thresholds: { warn: LATENCY_WARN_MS, crit: LATENCY_CRIT_MS },
    };
  });
  res.json({ latency: result, generatedAt: new Date().toISOString() });
});

// ── /watchdog/maintenance  ────────────────────────────────────────────────────
// Returns whether a maintenance window is currently active.
app.get('/watchdog/maintenance', (_req, res) => {
  const active = inMaintenanceWindow();
  res.json({
    active,
    start:     MAINTENANCE_START ? MAINTENANCE_START.toISOString() : null,
    end:       MAINTENANCE_END   ? MAINTENANCE_END.toISOString()   : null,
    checkedAt: new Date().toISOString(),
  });
});

// ─── Mesh logs endpoint ───────────────────────────────────────────────────────
// Returns the full watchdog log buffer. Called by the backend admin log aggregator.
app.get('/mesh/logs', meshAuth(SERVICE_NAME), (_req, res) => {
  res.json({
    source:   'watchdog',
    name:     'Watchdog',
    logs:     WATCHDOG_LOG_BUFFER.slice(),
    total:    WATCHDOG_LOG_BUFFER.length,
    uptime:   Math.floor(process.uptime()),
    ts:       new Date().toISOString(),
  });
});

// ─── Internal / mesh-authenticated endpoints ─────────────────────────────────

// Full internal state — auth required
app.get('/mesh/status', meshAuth(SERVICE_NAME), (_req, res) => {
  res.json({
    service: SERVICE_NAME,
    uptime:  Math.floor(process.uptime()),
    targets: Object.entries(states).map(([name, s]) => ({
      name,
      isDown:              s.isDown,
      consecutiveFailures: s.consecutiveFailures,
      lastPingMs:          s.lastPingMs,
      lastPingAt:          s.lastPingAt,
      totalPings:          s.totalPings,
      totalFailures:       s.totalFailures,
      latency:             getLatencyPercentiles(name),
      latencyAlertLevel:   s.latencyAlertLevel,
    })),
    meshFleetState: meshFleetState ? {
      activeCount: meshFleetState.scaling?.activeBackendCount,
      totalCount:  meshFleetState.scaling?.totalBackends,
      lastSynced:  meshFleetState.timestamp,
    } : null,
    maintenance: { active: inMaintenanceWindow(), start: MAINTENANCE_START, end: MAINTENANCE_END },
    cacheAge:    _statusCacheAt ? Math.round((Date.now() - _statusCacheAt) / 1000) + 's' : 'cold',
    timestamp:   new Date().toISOString(),
  });
});

// ntfy test endpoint — mesh-secret protected
app.post('/watchdog/test-ntfy', async (req, res) => {
  const secret     = req.headers['x-test-secret'] || '';
  const meshSecret = process.env.MESH_SECRET || '';
  if (!meshSecret || secret !== meshSecret) {
    return res.status(401).json({ error: 'Unauthorized — send X-Test-Secret header with MESH_SECRET value' });
  }
  if (!NTFY_URL) {
    return res.status(503).json({ error: 'NTFY_URL is not configured on this watchdog' });
  }
  try {
    const headers = {
      'Title':        'PlanIt ntfy Test',
      'Priority':     'high',
      'Tags':         'test',
      'Content-Type': 'text/plain; charset=utf-8',
    };
    if (NTFY_TOKEN)   headers['Authorization'] = `Bearer ${NTFY_TOKEN}`;
    if (FRONTEND_URL) headers['Actions'] = `view, Open Status Page, ${FRONTEND_URL}/status`;
    const r = await axios.post(NTFY_URL, `PlanIt watchdog ntfy test fired at ${new Date().toUTCString()}.\nIf you received this, notifications are working correctly.`, { headers, timeout: 10000 });
    console.log(`[${ts()}] [ntfy] Test notification sent (HTTP ${r.status})`);
    res.json({ ok: true, status: r.status, ntfyUrl: NTFY_URL, tokenSet: !!NTFY_TOKEN });
  } catch (err) {
    const status = err.response?.status;
    const hint = status === 401 ? 'NTFY_TOKEN missing or wrong'
               : status === 403 ? 'NTFY_TOKEN lacks permission'
               : status === 404 ? 'NTFY_URL topic not found'
               : err.message;
    console.error(`[${ts()}] [ntfy] Test failed: ${hint}`);
    res.status(502).json({ ok: false, error: hint, httpStatus: status });
  }
});

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function boot() {
  await ensureDbConnected();

  app.listen(PORT, () => {
    console.log(`[${ts()}] Watchdog HTTP -> http://0.0.0.0:${PORT}`);
    console.log(`[${ts()}] Status        -> http://0.0.0.0:${PORT}/watchdog/status`);
    console.log(`[${ts()}] SLO           -> http://0.0.0.0:${PORT}/watchdog/slo`);
    console.log(`[${ts()}] Latency       -> http://0.0.0.0:${PORT}/watchdog/latency\n`);
  });

  // Initial ping and cache warm-up
  console.log(`[${ts()}] Running startup pings...`);
  await pingAll();

  // Pre-warm the status cache so the very first HTTP request is instant
  await refreshStatusCache().catch(() => {});

  // Ongoing pings
  setInterval(pingAll, PING_MS);

  // Background cache refresh — runs slightly offset from pings so fresh ping
  // data is available when the cache rebuilds
  setInterval(() => {
    refreshStatusCache().catch(err =>
      console.error(`[${ts()}] [cache] Background refresh error: ${err.message}`)
    );
  }, STATUS_CACHE_TTL_MS);

  console.log(`[${ts()}] Watchdog running - pinging ${targets.length} target(s) every ${PING_MS / 1000}s\n`);

  await sendNtfy({
    title:    'Monitoring Active',
    message:  `PlanIt automated monitoring is online.\nChecking ${targets.length} service(s) every ${PING_MS / 1000}s:\n${targets.map(t => `* ${t.name}`).join('\n')}\n\nYou will be notified immediately of any service disruptions.`,
    priority: 'default',
    tags:     ['monitoring'],
  });
}

process.on('SIGTERM', async () => { try { await mongoose.disconnect(); } catch (_) {} process.exit(0); });
process.on('SIGINT',  async () => { try { await mongoose.disconnect(); } catch (_) {} process.exit(0); });

boot().catch(err => {
  console.error(`[${ts()}] Fatal boot error: ${err.message}`);
  process.exit(1);
});