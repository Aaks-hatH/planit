require('dotenv').config();
const express  = require('express');
const mongoose = require('mongoose');
const axios    = require('axios');
const { meshAuth, meshGet } = require('./mesh');

function ts() { return new Date().toISOString(); }


const BACKEND_URLS_RAW = process.env.BACKEND_URLS  || process.env.MAIN_SERVER_URL || '';
const ROUTER_URL       = process.env.ROUTER_URL    || '';
const FRONTEND_URL     = process.env.FRONTEND_URL  || 'https://planitapp.onrender.com';
const MONGO_URI        = process.env.MONGO_URI;
const NTFY_URL         = process.env.NTFY_URL;
const PING_MS          = parseInt(process.env.PING_INTERVAL_MS  || '60000', 10); // 1 min default
const THRESHOLD        = parseInt(process.env.FAILURE_THRESHOLD || '3',     10);
const PORT             = process.env.PORT || '4000';
const SERVICE_NAME     = process.env.SERVICE_NAME || 'watchdog';

// Build the list of targets to monitor
// Each target: { name, url, pingUrl, type }
const targets = [];



const backendUrls    = BACKEND_URLS_RAW.split(',').map(u => u.trim()).filter(Boolean);
const customLabels   = (process.env.BACKEND_LABELS   || '').split(',').map(s => s.trim()).filter(Boolean);
const customRegions  = (process.env.BACKEND_REGIONS  || '').split(',').map(s => s.trim()).filter(Boolean);

// Fallback codenames if BACKEND_LABELS not set
const FALLBACK_NAMES = ['Alpha','Bravo','Charlie','Delta','Echo','Foxtrot','Golf'];

function getBackendLabel(i) {
  return customLabels[i] || FALLBACK_NAMES[i] || `Server ${i + 1}`;
}

function getBackendRegion(i) {
  return customRegions[i] || null;
}

backendUrls.forEach((url, i) => {
  targets.push({
    name:    getBackendLabel(i),
    region:  getBackendRegion(i),   // e.g. "US East (Virginia)" — optional, shown in incidents
    url,
    pingUrl: `${url}/api/health`,
    type:    'backend',
  });
});

// Add load balancer if configured
if (ROUTER_URL) {
  targets.push({
    name:    'Load Balancer',
    url:     ROUTER_URL,
    pingUrl: `${ROUTER_URL}/health`,
    type:    'router',
  });
}

if (targets.length === 0) {
  console.error(`[${ts()}] FATAL: No targets configured. Set BACKEND_URLS and/or ROUTER_URL.`);
  process.exit(1);
}

// ─── Mesh fleet state ─────────────────────────────────────────────────────────
// Synced periodically from the router's /mesh/status endpoint.
// Used to suppress incidents for backends that are intentionally on standby
// (scaled-down by the router's auto-scaling logic) vs genuinely failing.
//
// IMPORTANT: defaults to null. isBackendActive() returns true if fleet state
// is unavailable — we always prefer false positives (spurious alerts) over
// the silent failure that occurs when this is undefined and crashes pingTarget.
let meshFleetState = null;

function isBackendActive(name) {
  // No fleet data yet or no router configured — treat all as active (safe default)
  if (!meshFleetState || !meshFleetState.backends) return true;
  const backend = meshFleetState.backends.find(b => b.name === name);
  // Not in fleet state at all — assume active
  if (!backend) return true;

  // The router confirmed this backend is broken via circuit breaker — always alert
  if (backend.circuitTripped) return true;
  // Router's last keep-alive ping to this backend failed — it knows something's wrong
  if (backend.alive === false) return true;

  // Only truly suppress when: not active AND router believes it's alive AND circuit not tripped.
  // This is the genuine "scaled-down standby" case.
  return backend.active === true;
}

// Sync fleet state from the router every 30 s (if ROUTER_URL is set)
async function syncFleetState() {
  if (!ROUTER_URL) return;
  try {
    const result = await meshGet(SERVICE_NAME, `${ROUTER_URL}/mesh/status`, { timeout: 5000 });
    if (result.ok && result.data) {
      meshFleetState = result.data;
      console.log(`[${ts()}] [fleet] Synced — ${meshFleetState.backends?.filter(b => b.active).length ?? '?'} active backend(s)`);
    }
  } catch (err) {
    console.warn(`[${ts()}] [fleet] Sync failed: ${err.message}`);
  }
}

if (ROUTER_URL) {
  syncFleetState(); // immediate first sync
  setInterval(syncFleetState, 30_000);
}

// ─── Startup log ──────────────────────────────────────────────────────────────
console.log(`\n[${ts()}] ╔══════════════════════════════════════════════════╗`);
console.log(`[${ts()}] ║     PlanIt Watchdog — MULTI-TARGET — STARTING   ║`);
console.log(`[${ts()}] ╚══════════════════════════════════════════════════╝`);
console.log(`[${ts()}]   Monitoring ${targets.length} target(s):`);
targets.forEach(t => console.log(`[${ts()}]     [${t.type}] ${t.name} → ${t.pingUrl}`));
console.log(`[${ts()}]   Interval  : ${PING_MS / 1000}s`);
console.log(`[${ts()}]   Threshold : ${THRESHOLD} failures`);
console.log(`[${ts()}]   ntfy      : ${NTFY_URL || 'NOT SET — alerts disabled'}`);
console.log(`[${ts()}]   MONGO_URI : ${MONGO_URI ? 'set' : 'NOT SET — incidents will not be written to DB'}`);
console.log(`[${ts()}]   Port      : ${PORT}\n`);

if (!MONGO_URI) {
  console.error(`[${ts()}] FATAL: MONGO_URI is required.`);
  process.exit(1);
}

// ─── Mongoose models ──────────────────────────────────────────────────────────
const timelineUpdateSchema = new mongoose.Schema({
  status:    { type: String, enum: ['investigating', 'identified', 'monitoring', 'resolved'], required: true },
  message:   { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const incidentSchema = new mongoose.Schema({
  title:            { type: String, required: true },
  description:      { type: String, default: '' },
  severity:         { type: String, enum: ['minor', 'major', 'critical'], default: 'critical' },
  status:           { type: String, enum: ['investigating', 'identified', 'monitoring', 'resolved'], default: 'investigating' },
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
  status:          { type: String, enum: ['pending', 'confirmed', 'dismissed'], default: 'confirmed' },
  incidentId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Incident', default: null },
  createdAt:       { type: Date, default: Date.now },
});

const uptimeCheckSchema = new mongoose.Schema({
  service:   { type: String, required: true }, // which target this ping is for
  status:    { type: String, enum: ['up', 'down'], required: true },
  latencyMs: { type: Number, default: null },
  error:     { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
});
uptimeCheckSchema.index({ createdAt: 1 }, { expireAfterSeconds: 1296000 }); // 15 day TTL
uptimeCheckSchema.index({ service: 1, createdAt: -1 });

const Incident     = mongoose.models.Incident     || mongoose.model('Incident',     incidentSchema);
const UptimeReport = mongoose.models.UptimeReport || mongoose.model('UptimeReport', uptimeReportSchema);
const UptimeCheck  = mongoose.models.UptimeCheck  || mongoose.model('UptimeCheck',  uptimeCheckSchema);

// ─── Per-target state ─────────────────────────────────────────────────────────
// One state object per target, keyed by target name
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
  };
});

// ─── DB ───────────────────────────────────────────────────────────────────────
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

// ── Incident message templates ────────────────────────────────────────────────
// All user-facing text in incidents must be professional status-page language.
// No internal names, no tech jargon, no mention of "backend" or "router".
//
function incidentTitle(target) {
  if (target.type === 'router') return 'Service Disruption — Platform Unavailable';
  if (backendUrls.length === 1) return 'Service Disruption — API Unavailable';
  // "the Maverick server" — codename is clear, "server" contextualises it for users
  return `Service Degradation — the ${target.name} server is unavailable`;
}

function serverRef(target) {
  // "the Maverick server (US East)" or just "the Maverick server"
  return target.region
    ? `the ${target.name} server (${target.region})`
    : `the ${target.name} server`;
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
  if (target.type === 'router') return ['api', 'websocket', 'chat', 'file-sharing', 'polls'];
  return ['api', 'websocket', 'chat'];
}

function investigatingMessage(target, errorMsg) {
  const technical = process.env.INCIDENT_INCLUDE_TECHNICAL === 'true'
    ? ` (Technical detail: ${errorMsg})`
    : '';
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
      timeline: [{
        status:  'investigating',
        message: investigatingMessage(target, errorMsg),
      }],
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
    incident.timeline.push({
      status:  'resolved',
      message: recoveryMessage(target, mins),
    });
    await incident.save();
    console.log(`[${ts()}] [incident] Resolved for ${target.name} (${mins}m downtime)`);
  } catch (err) {
    console.error(`[${ts()}] [incident] Failed to resolve: ${err.message}`);
  }
}

// ─── ntfy ─────────────────────────────────────────────────────────────────────
async function sendNtfy({ title, message, priority = 'high', tags = [] }) {
  if (!NTFY_URL) return;
  try {
    const headers = {
      'Title':        title,
      'Priority':     priority,
      'Tags':         tags.join(','),
      'Content-Type': 'text/plain',
    };
    if (FRONTEND_URL) headers['Actions'] = `view, Open Status Page, ${FRONTEND_URL}/status`;
    await axios.post(NTFY_URL, message, { headers, timeout: 10000 });
    console.log(`[${ts()}] [ntfy] Sent: "${title}"`);
  } catch (err) {
    console.error(`[${ts()}] [ntfy] Failed: ${err.message}`);
  }
}

// ─── Ping a single target ─────────────────────────────────────────────────────
async function pingTarget(target) {
  const s = states[target.name];
  s.totalPings++;
  s.lastPingAt = new Date();

  try {
    const t0  = Date.now();
    await axios.get(target.pingUrl, {
      timeout:        10000,
      validateStatus: code => code < 500,
    });
    const ms = Date.now() - t0;

    s.lastPingMs          = ms;
    s.lastError           = null;
    s.consecutiveFailures = 0;
    s.consecutiveSuccesses++;

    // Store check history (non-blocking)
    UptimeCheck.create({ service: target.name, status: 'up', latencyMs: ms }).catch(() => {});

    // Recovery
    if (s.isDown) {
      const downtimeMs = Date.now() - s.downSince;
      const mins       = Math.round(downtimeMs / 60000);
      s.isDown    = false;
      s.downSince = null;

      console.log(`[${ts()}] ${target.name} RECOVERED after ${mins}m — ${ms}ms`);

      if (s.activeIncidentId) {
        await resolveDownIncident(target, s.activeIncidentId, downtimeMs);
        s.activeIncidentId = null;
      }

      const ref = target.type === 'router' ? 'Load Balancer' : `the ${target.name} server`;
      await sendNtfy({
        title:    `${target.name} — Back Online`,
        message:  `${ref} is back online and operating normally.\nDowntime: ${mins < 1 ? '<1' : mins} minute(s)\nResponse time: ${ms}ms\nIncident auto-resolved on status page.`,
        priority: 'high',
        tags:     ['white_check_mark', 'tada'],
      });
    } else {
      // Healthy — log every 10 pings to keep logs readable
      if (s.totalPings % 10 === 0 || s.totalPings <= 2) {
        console.log(`[${ts()}] ${target.name} OK — ${ms}ms (ping #${s.totalPings})`);
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

    // Threshold hit — decide whether to declare down or hold for standby check
    if (s.consecutiveFailures === THRESHOLD && !s.isDown) {
      const isStandby = !isBackendActive(target.name);
      if (isStandby) {
        // Record when failures started so the override below has accurate downtime.
        // Do NOT fire an incident yet — backend may legitimately be scaled down.
        s.downSince = s.downSince || Date.now();
        const fleetBackend = meshFleetState && meshFleetState.backends
          ? meshFleetState.backends.find(b => b.name === target.name) : null;
        console.log(`[${ts()}] [mesh] ${target.name} is STANDBY — suppressing for now (circuitTripped=${fleetBackend ? fleetBackend.circuitTripped : 'unknown'}, alive=${fleetBackend ? fleetBackend.alive : 'unknown'}). Will escalate at ${THRESHOLD * 2} failures.`);
      } else {
        s.isDown    = true;
        s.downSince = Date.now();

        console.error(`[${ts()}] ${target.name} DOWN — writing incident to DB`);

        const incidentId   = await createDownIncident(target, err.message);
        s.activeIncidentId = incidentId;

        const downRef = target.type === 'router' ? 'Load Balancer' : 'the ' + target.name + ' server';
        await sendNtfy({
          title:    target.name + ' — Service Disruption',
          message:  downRef + ' is not responding.\n\nFailed checks: ' + THRESHOLD + '/' + THRESHOLD + '\nError: ' + err.message + '\n\nStatus page has been updated automatically.',
          priority: 'urgent',
          tags:     ['rotating_light', 'fire'],
        });
      }
    }

    // Hard override: router pings every 4 min so it may not know a backend is broken
    // until long after the watchdog does. If a standby keeps failing past 2x threshold
    // with zero recovery, it is a genuine outage — escalate unconditionally.
    const OVERRIDE_AT = THRESHOLD * 2;
    if (!s.isDown && s.consecutiveFailures === OVERRIDE_AT) {
      const downMins = s.downSince ? Math.round((Date.now() - s.downSince) / 60000) : 0;
      console.error(`[${ts()}] [mesh] OVERRIDE: ${target.name} has ${s.consecutiveFailures} failures despite STANDBY — escalating (failing ~${downMins}m)`);

      s.isDown    = true;
      s.downSince = s.downSince || Date.now();

      const incidentId   = await createDownIncident(target, err.message);
      s.activeIncidentId = incidentId;

      const downRef2 = target.type === 'router' ? 'Load Balancer' : 'the ' + target.name + ' server';
      await sendNtfy({
        title:    target.name + ' — Service Disruption',
        message:  downRef2 + ' has been unavailable for ~' + downMins + ' minute(s).\n\nInitially classified as standby but ' + s.consecutiveFailures + ' consecutive failures confirm a genuine outage.\nError: ' + err.message + '\n\nStatus page has been updated automatically.',
        priority: 'urgent',
        tags:     ['rotating_light', 'fire'],
      });
    }

    // Reminder every 10 failures while confirmed down
    if (s.isDown && s.consecutiveFailures > THRESHOLD && s.consecutiveFailures % 10 === 0) {
      const downMins = Math.round((Date.now() - s.downSince) / 60000);
      const stillRef = target.type === 'router' ? 'Load Balancer' : 'the ' + target.name + ' server';
      await sendNtfy({
        title:    target.name + ' — Still Unavailable (' + downMins + 'm)',
        message:  stillRef + ' has been unavailable for ' + downMins + ' minutes.\nConsecutive failures: ' + s.consecutiveFailures + '\nError: ' + err.message + '\n\nStatus page reflects current outage.',
        priority: 'high',
        tags:     ['warning', 'clock'],
      });
    }
  }
}

// Ping ALL targets (staggered 2s apart so Render doesn't get hammered at once)
async function pingAll() {
  targets.forEach((target, i) => {
    setTimeout(() => pingTarget(target), i * 2000);
  });
}

// ─── Express ──────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
// Only allow cross-origin requests from the configured frontend — prevents
// other sites from silently harvesting status data via browser requests.
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

app.get('/',                (_req, res) => res.send('PlanIt Watchdog OK'));
app.get('/watchdog/ping',   (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// ─── Mesh: watchdog internal status (auth required) ──────────────────────────
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
    })),
    meshFleetState: meshFleetState ? {
      activeCount: meshFleetState.scaling?.activeBackendCount,
      totalCount:  meshFleetState.scaling?.totalBackends,
      lastSynced:  meshFleetState.timestamp,
    } : null,
    timestamp: new Date().toISOString(),
  });
});
app.head('/watchdog/ping',  (_req, res) => res.sendStatus(200));

// ─── Shared: compute 15-day uptime history from UptimeCheck records ──────────
async function computeUptimeHistory() {
  const since  = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000);
  const checks = await UptimeCheck.find({ createdAt: { $gte: since } })
    .select('service status createdAt -_id')
    .lean();

  // Build day list (last 15 days, oldest first)
  const days = [];
  for (let i = 14; i >= 0; i--) {
    const dt = new Date();
    dt.setDate(dt.getDate() - i);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    days.push(`${y}-${m}-${d}`);
  }

  // Group checks by service → day
  const byService = {};
  checks.forEach(c => {
    const svc = c.service;
    if (!byService[svc]) byService[svc] = {};
    const y = c.createdAt.getFullYear();
    const m = String(c.createdAt.getMonth() + 1).padStart(2, '0');
    const d = String(c.createdAt.getDate()).padStart(2, '0');
    const day = `${y}-${m}-${d}`;
    if (!byService[svc][day]) byService[svc][day] = { up: 0, total: 0 };
    byService[svc][day].total++;
    if (c.status === 'up') byService[svc][day].up++;
  });

  // Build per-service result with 15-day arrays (null for missing days)
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
      days:       dayData,
      totalChecks,
      totalUp,
      uptimePct: totalChecks > 0 ? +((totalUp / totalChecks) * 100).toFixed(2) : null,
    };
  });

  return { services: result, generatedAt: new Date().toISOString() };
}

// Full status — same shape as before so frontend works without changes
app.get('/watchdog/status', async (_req, res) => {
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
      console.error(`[${ts()}] [status] DB query failed: ${err.message}`);
    }
  }

  const anyDown = Object.values(states).some(s => s.isDown);
  const overallStatus = anyDown ? 'outage'
    : activeIncidents.some(i => i.severity === 'critical') ? 'outage'
    : activeIncidents.length > 0 ? 'degraded'
    : 'operational';

  // Build per-service summary for the response — strip internal URLs and
  // raw error strings which would expose infrastructure details publicly.
  const services = targets.map(t => {
    const s = states[t.name];
    return {
      name:      t.name,
      region:    t.region || null,
      type:      t.type,
      status:    s.isDown ? 'down' : 'up',
      lastPingMs: s.lastPingMs,
      lastPingAt: s.lastPingAt,
      // lastError and url intentionally omitted — public endpoint
    };
  });

  res.json({
    status:          overallStatus,
    dbStatus:        dbOk ? 'connected' : 'disconnected',
    activeIncidents,
    recentResolved,
    uptimeHistory,
    checkedAt:       new Date().toISOString(),
    watchdog: {
      // Legacy single-target field — uses router if present, otherwise first backend
      mainServer: anyDown ? 'DOWN' : 'UP',
      // lastError, consecutiveFailures, totalPings, uptimeSeconds intentionally
      // omitted — public endpoint; use /mesh/status (auth-required) for internals
      services,
    },
  });
});

// Per-service 15-day uptime history from UptimeCheck collection
app.get('/watchdog/uptime', async (_req, res) => {
  const dbOk = await ensureDbConnected();
  if (!dbOk) return res.status(503).json({ error: 'DB unavailable' });
  try {
    const result = await computeUptimeHistory();
    res.json(result);
  } catch (err) {
    console.error(`[${ts()}] [uptime] ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ─── Boot ─────────────────────────────────────────────────────────────────────
const startedAt = Date.now();

async function boot() {
  await ensureDbConnected();

  app.listen(PORT, () => {
    console.log(`[${ts()}] Watchdog HTTP → http://0.0.0.0:${PORT}`);
    console.log(`[${ts()}] Status        → http://0.0.0.0:${PORT}/watchdog/status\n`);
  });

  // Immediate startup ping of all targets
  console.log(`[${ts()}] Running startup pings...`);
  await pingAll();

  // Ongoing pings
  setInterval(pingAll, PING_MS);
  console.log(`[${ts()}] Watchdog running — pinging ${targets.length} target(s) every ${PING_MS / 1000}s\n`);

  await sendNtfy({
    title:    ' Monitoring Active',
    message:  `PlanIt automated monitoring is online.\nChecking ${targets.length} service(s) every ${PING_MS / 1000}s:\n${targets.map(t => `• ${t.name}`).join('\n')}\n\nYou will be notified immediately of any service disruptions.`,
    priority: 'default',
    tags:     ['shield', 'white_check_mark'],
  });
}

process.on('SIGTERM', async () => { try { await mongoose.disconnect(); } catch (_) {} process.exit(0); });
process.on('SIGINT',  async () => { try { await mongoose.disconnect(); } catch (_) {} process.exit(0); });

boot().catch(err => {
  console.error(`[${ts()}] Fatal boot error: ${err.message}`);
  process.exit(1);
});
