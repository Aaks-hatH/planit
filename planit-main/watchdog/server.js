require('dotenv').config();
const express  = require('express');
const mongoose = require('mongoose');
const axios    = require('axios');

// ─── Timestamp helper ────────────────────────────────────────────────────────
function ts() {
  return new Date().toISOString();
}

// ─── Config ──────────────────────────────────────────────────────────────────
const {
  MAIN_SERVER_URL   = 'https://planitapp.onrender.com/api',
  FRONTEND_URL      = 'https://planitapp.onrender.com',
  MONGO_URI,
  NTFY_URL,
  PING_INTERVAL_MS  = '30000',
  FAILURE_THRESHOLD = '3',
  PORT              = '4000',
} = process.env;

const PING_MS   = parseInt(PING_INTERVAL_MS,  10);
const THRESHOLD = parseInt(FAILURE_THRESHOLD, 10);
const PING_URL  = `${MAIN_SERVER_URL}/uptime/ping`;

// ─── Startup validation ──────────────────────────────────────────────────────
console.log(`\n[${ts()}] ╔══════════════════════════════════════════╗`);
console.log(`[${ts()}] ║       PlanIt Watchdog  🛡️  — STARTING     ║`);
console.log(`[${ts()}] ╚══════════════════════════════════════════╝`);
console.log(`[${ts()}]   Ping target  : ${PING_URL}`);
console.log(`[${ts()}]   Frontend     : ${FRONTEND_URL}`);
console.log(`[${ts()}]   Interval     : ${PING_MS / 1000}s`);
console.log(`[${ts()}]   Threshold    : ${THRESHOLD} failures`);
console.log(`[${ts()}]   ntfy         : ${NTFY_URL || '⚠️  NOT SET — notifications disabled'}`);
console.log(`[${ts()}]   MONGO_URI    : ${MONGO_URI ? '✅  set' : '❌  NOT SET — incident DB writes will fail'}`);
console.log(`[${ts()}]   Port         : ${PORT}\n`);

if (!MONGO_URI) {
  console.error(`[${ts()}] ❌  FATAL: MONGO_URI is required.\n  Add it to your .env or environment variables and restart.\n  Example: MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/planit`);
  process.exit(1);
}

if (!NTFY_URL) {
  console.warn(`[${ts()}] ⚠️  NTFY_URL is not set. Push notifications will be disabled.`);
  console.warn(`[${ts()}]    To enable: add NTFY_URL=https://ntfy.sh/your-topic to your env.\n`);
}

// ─── Mongoose models (exact copies of main backend schemas) ──────────────────
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

const Incident     = mongoose.models.Incident     || mongoose.model('Incident',     incidentSchema);
const UptimeReport = mongoose.models.UptimeReport || mongoose.model('UptimeReport', uptimeReportSchema);

// UptimeCheck — one doc per ping so the status page bars have real historical data
const uptimeCheckSchema = new mongoose.Schema({
  status:    { type: String, enum: ['up', 'down'], required: true },
  latencyMs: { type: Number, default: null },
  error:     { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
});
uptimeCheckSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 });
const UptimeCheck = mongoose.models.UptimeCheck || mongoose.model('UptimeCheck', uptimeCheckSchema);

// ─── In-memory state ─────────────────────────────────────────────────────────
const state = {
  consecutiveFailures:  0,
  consecutiveSuccesses: 0,
  isDown:               false,
  activeIncidentId:     null,
  lastPingMs:           null,
  lastPingAt:           null,
  lastError:            null,
  totalPings:           0,
  totalFailures:        0,
  startedAt:            new Date(),
};

let downSince = null;

// ─── DB ──────────────────────────────────────────────────────────────────────
async function ensureDbConnected() {
  if (mongoose.connection.readyState === 1) return true;

  console.log(`[${ts()}] [db] Connecting to MongoDB...`);
  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 10000 });
    console.log(`[${ts()}] [db] ✅  MongoDB connected`);
    return true;
  } catch (err) {
    console.error(`[${ts()}] [db] ❌  MongoDB connect failed: ${err.message}`);
    return false;
  }
}

async function createDownIncident(errorMsg) {
  const ok = await ensureDbConnected();
  if (!ok) {
    console.error(`[${ts()}] [incident] Cannot write incident — DB unreachable. Incident will NOT appear on status page until DB recovers.`);
    return null;
  }

  try {
    const report = await UptimeReport.create({
      description:     `[WATCHDOG] External monitor detected API is unreachable after ${THRESHOLD} consecutive failures. Error: ${errorMsg}`,
      affectedService: 'API',
      status:          'confirmed',
    });

    const incident = await Incident.create({
      title:            '🔴 API Unreachable — Backend Down',
      description:      `The PlanIt backend failed to respond to ${THRESHOLD} consecutive health checks from the external watchdog monitor. Users cannot access the application.`,
      severity:         'critical',
      status:           'investigating',
      affectedServices: ['api', 'websocket', 'chat', 'auth', 'database'],
      reportIds:        [report._id],
      timeline: [{
        status:    'investigating',
        message:   `Watchdog detected backend unreachable after ${THRESHOLD} consecutive failures (checked every ${PING_MS / 1000}s). Last error: ${errorMsg}`,
        createdAt: new Date(),
      }],
    });

    report.incidentId = incident._id;
    await report.save();

    console.log(`[${ts()}] [incident] ✅  Incident created in DB: ${incident._id}`);
    return incident._id;
  } catch (err) {
    console.error(`[${ts()}] [incident] ❌  Failed to create incident: ${err.message}`);
    return null;
  }
}

async function resolveDownIncident(incidentId, downtimeMs) {
  const ok = await ensureDbConnected();
  if (!ok) {
    console.error(`[${ts()}] [incident] Cannot resolve incident — DB unreachable`);
    return;
  }

  try {
    const incident = await Incident.findById(incidentId);
    if (!incident) {
      console.warn(`[${ts()}] [incident] Could not find incident ${incidentId} to resolve`);
      return;
    }

    const mins = Math.round(downtimeMs / 60000);
    incident.status          = 'resolved';
    incident.resolvedAt      = new Date();
    incident.downtimeMinutes = mins;
    incident.timeline.push({
      status:  'resolved',
      message: `Backend recovered automatically. Total downtime: ${mins < 1 ? '<1' : mins} minute${mins !== 1 ? 's' : ''}. All systems operational.`,
    });
    await incident.save();
    console.log(`[${ts()}] [incident] ✅  Incident ${incidentId} auto-resolved (${mins}m downtime)`);
  } catch (err) {
    console.error(`[${ts()}] [incident] ❌  Failed to resolve incident: ${err.message}`);
  }
}

// ─── ntfy ────────────────────────────────────────────────────────────────────
async function sendNtfy({ title, message, priority = 'high', tags = [] }) {
  if (!NTFY_URL) {
    console.warn(`[${ts()}] [ntfy] Skipped — NTFY_URL not configured`);
    return;
  }

  console.log(`[${ts()}] [ntfy] Sending: "${title}" to ${NTFY_URL}`);

  try {
    const headers = {
      'Title':        title,
      'Priority':     priority,
      'Tags':         tags.join(','),
      'Content-Type': 'text/plain',
    };
    if (FRONTEND_URL) {
      headers['Actions'] = `view, Open Status Page, ${FRONTEND_URL}/status`;
    }

    const res = await axios.post(NTFY_URL, message, { headers, timeout: 10000 });
    console.log(`[${ts()}] [ntfy] ✅  Sent — HTTP ${res.status}`);
  } catch (err) {
    // Log full details so you can debug ntfy issues
    if (err.response) {
      console.error(`[${ts()}] [ntfy] ❌  Failed — HTTP ${err.response.status}: ${JSON.stringify(err.response.data)}`);
    } else {
      console.error(`[${ts()}] [ntfy] ❌  Failed — ${err.message}`);
    }
  }
}

// ─── Ping logic ──────────────────────────────────────────────────────────────
async function pingMainServer() {
  state.totalPings++;
  state.lastPingAt = new Date();

  try {
    const t0  = Date.now();
    const res = await axios.get(PING_URL, {
      timeout: 10000,
      validateStatus: s => s < 500, // 2xx / 4xx = server is up; 5xx or timeout = down
    });
    const ms  = Date.now() - t0;

    state.lastPingMs          = ms;
    state.lastError           = null;
    state.consecutiveFailures = 0;
    state.consecutiveSuccesses++;

    // Record successful ping for bar chart history (non-blocking)
    UptimeCheck.create({ status: 'up', latencyMs: ms }).catch(() => {});

    // ── Recovery ────────────────────────────────────────────────────────────
    if (state.isDown) {
      const downtimeMs   = Date.now() - (downSince || Date.now());
      const downtimeMins = Math.round(downtimeMs / 60000);
      state.isDown = false;
      downSince    = null;

      console.log(`[${ts()}] 🟢  Server RECOVERED after ${downtimeMins}m — response ${ms}ms`);

      if (state.activeIncidentId) {
        await resolveDownIncident(state.activeIncidentId, downtimeMs);
        state.activeIncidentId = null;
      }

      await sendNtfy({
        title:    'PlanIt Recovered',
        message:  `Backend is back online after ${downtimeMins < 1 ? '<1' : downtimeMins} min of downtime.\nResponse time: ${ms}ms\nThe status page has been updated automatically.`,
        priority: 'high',
        tags:     ['white_check_mark', 'tada'],
      });
    } else {
      // Healthy — log every 10 pings to keep logs readable
      if (state.totalPings % 10 === 0 || state.totalPings <= 3) {
        console.log(`[${ts()}] 💚  Ping OK — ${ms}ms (ping #${state.totalPings})`);
      }
    }

  } catch (err) {
    state.consecutiveFailures++;
    state.consecutiveSuccesses = 0;
    state.totalFailures++;
    state.lastError  = err.message;
    state.lastPingMs = null;

    // Record failed ping for bar chart history (non-blocking)
    UptimeCheck.create({ status: 'down', error: err.message }).catch(() => {});

    console.warn(`[${ts()}] 🔴  Ping FAILED (${state.consecutiveFailures}/${THRESHOLD}): ${err.message}`);

    // ── Threshold hit — server officially down ───────────────────────────────
    if (state.consecutiveFailures === THRESHOLD && !state.isDown) {
      state.isDown = true;
      downSince    = Date.now();

      console.error(`[${ts()}] 🚨  THRESHOLD HIT — declaring server DOWN, writing incident to DB`);

      const incidentId = await createDownIncident(err.message);
      state.activeIncidentId = incidentId;

      await sendNtfy({
        title:    'PlanIt Backend Down',
        message:  `The PlanIt API has been unreachable for ${THRESHOLD} consecutive checks (every ${PING_MS / 1000}s).\n\nError: ${err.message}\n\nIncident ID: ${incidentId || 'DB write failed'}\nStatus page updated automatically.`,
        priority: 'urgent',
        tags:     ['rotating_light', 'fire'],
      });
    }

    // Reminder every 10 failures while still down
    if (state.isDown && state.consecutiveFailures > THRESHOLD && state.consecutiveFailures % 10 === 0) {
      const downMins = Math.round((Date.now() - downSince) / 60000);
      await sendNtfy({
        title:    `PlanIt Still Down (${downMins}m)`,
        message:  `Backend has been unreachable for ${downMins} minutes.\nFailed pings: ${state.consecutiveFailures}\nLast error: ${err.message}`,
        priority: 'high',
        tags:     ['warning', 'clock'],
      });
    }
  }
}

// ─── Express ─────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());

// Allow the frontend to call the watchdog directly from any origin.
// This is a public read-only status endpoint — no auth, no sensitive data.
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Root — used by Render / Railway / Fly health probes
app.get('/', (_req, res) => res.send('PlanIt Watchdog OK'));

// Dedicated ping endpoint so UptimeRobot can monitor the watchdog itself
app.get('/watchdog/ping', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));
app.head('/watchdog/ping', (_req, res) => res.sendStatus(200));

// Full status endpoint — reads incidents from the shared MongoDB so the
// frontend gets real data regardless of whether the main server is reachable.
// Returns the same shape as the main backend's /api/uptime/status so the
// frontend needs no special casing.
app.get('/watchdog/status', async (_req, res) => {
  const dbOk = await ensureDbConnected();

  let activeIncidents = [];
  let recentResolved  = [];

  if (dbOk) {
    try {
      activeIncidents = await Incident.find({ status: { $ne: 'resolved' } })
        .sort({ createdAt: -1 })
        .lean();

      recentResolved = await Incident.find({
        status:     'resolved',
        resolvedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      })
        .sort({ resolvedAt: -1 })
        .limit(10)
        .lean();
    } catch (err) {
      console.error(`[${ts()}] [status] DB query failed: ${err.message}`);
    }
  }

  let overallStatus = 'operational';
  if (state.isDown) {
    overallStatus = 'outage';
  } else if (activeIncidents.some(i => i.severity === 'critical')) {
    overallStatus = 'outage';
  } else if (activeIncidents.length > 0) {
    overallStatus = 'degraded';
  }

  res.json({
    // Same shape as /api/uptime/status so frontend works without changes
    status:          overallStatus,
    dbStatus:        dbOk ? 'connected' : 'disconnected',
    activeIncidents,
    recentResolved,
    checkedAt:       new Date().toISOString(),
    // Extra watchdog-specific fields the frontend can optionally use
    watchdog: {
      mainServer:           state.isDown ? 'DOWN' : 'UP',
      lastPingMs:           state.lastPingMs,
      lastPingAt:           state.lastPingAt,
      lastError:            state.lastError,
      consecutiveFailures:  state.consecutiveFailures,
      totalPings:           state.totalPings,
      uptimeSeconds:        Math.floor((Date.now() - state.startedAt.getTime()) / 1000),
    },
  });
});

// ─── Boot ────────────────────────────────────────────────────────────────────
async function boot() {
  // 1. Connect to DB
  await ensureDbConnected();

  // 2. Start HTTP server
  app.listen(PORT, () => {
    console.log(`[${ts()}] 🌐  Health server → http://0.0.0.0:${PORT}`);
    console.log(`[${ts()}] 📊  Status       → http://0.0.0.0:${PORT}/watchdog/status`);
  });

  // 3. Fire an immediate test ping so you see in logs straight away whether
  //    the watchdog can actually reach the main server.
  console.log(`\n[${ts()}] 🔍  Running startup ping to ${PING_URL} ...`);
  await pingMainServer();

  // 4. Schedule ongoing pings
  setInterval(pingMainServer, PING_MS);
  console.log(`[${ts()}] Watchdog running — pinging every ${PING_MS / 1000}s, threshold ${THRESHOLD} failures\n`);

  // 5. Send startup notification so you know the watchdog is live
  await sendNtfy({
    title:    'Watchdog Started',
    message:  `PlanIt watchdog is online and monitoring ${PING_URL} every ${PING_MS / 1000}s.\nFailure threshold: ${THRESHOLD} consecutive failures.`,
    priority: 'urgent',
    tags:     ['shield', 'white_check_mark'],
  });
}

// ─── Graceful shutdown ────────────────────────────────────────────────────────
async function shutdown(signal) {
  console.log(`\n[${ts()}] ${signal} — shutting down gracefully`);
  try { await mongoose.disconnect(); } catch (_) {}
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

boot().catch(err => {
  console.error(`[${ts()}] ❌  Fatal boot error: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});