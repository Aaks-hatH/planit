/**
 * PlanIt Watchdog Server
 * ──────────────────────────────────────────────────────────────────────────────
 * A completely independent process that lives on a separate host/dyno.
 * It pings the main PlanIt API continuously and, when the server goes down,
 * it writes an incident directly to the shared MongoDB and fires ntfy alerts —
 * so the public status page updates even though the main server is dead.
 *
 * On recovery it auto-resolves the incident and sends a green "all-clear" ntfy.
 *
 * Deploy this anywhere (Railway, Fly.io, a VPS, a second Render service, etc.)
 * as long as it is NOT on the same server/dyno as the main backend.
 */

require('dotenv').config();
const express  = require('express');
const mongoose = require('mongoose');
const axios    = require('axios');

// ─── Config ───────────────────────────────────────────────────────────────────

const {
  MAIN_SERVER_URL  = 'https://planitapp.onrender.com/api',
  FRONTEND_URL     = 'https://planitapp.onrender.com',
  MONGO_URI,
  NTFY_URL,
  PING_INTERVAL_MS = '30000',
  FAILURE_THRESHOLD = '3',
  PORT             = '4000',
} = process.env;

const PING_MS    = parseInt(PING_INTERVAL_MS, 10);
const THRESHOLD  = parseInt(FAILURE_THRESHOLD, 10);
const PING_URL   = `${MAIN_SERVER_URL}/uptime/ping`;

if (!MONGO_URI) {
  console.error('[watchdog] ❌  MONGO_URI is required. Set it in .env');
  process.exit(1);
}

// ─── Mongoose models (exact copies of the main backend schemas) ───────────────

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
  status:          { type: String, enum: ['pending', 'confirmed', 'dismissed'], default: 'pending' },
  incidentId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Incident', default: null },
  createdAt:       { type: Date, default: Date.now },
});

// Use model() safely — guards against "Cannot overwrite model once compiled" on hot-reload
const Incident     = mongoose.models.Incident     || mongoose.model('Incident',     incidentSchema);
const UptimeReport = mongoose.models.UptimeReport || mongoose.model('UptimeReport', uptimeReportSchema);

// ─── State ────────────────────────────────────────────────────────────────────

const state = {
  consecutiveFailures: 0,
  consecutiveSuccesses: 0,
  isDown:              false,
  activeIncidentId:    null,   // _id of the open watchdog incident in MongoDB
  lastPingMs:          null,
  lastPingAt:          null,
  lastError:           null,
  totalPings:          0,
  totalFailures:       0,
  startedAt:           new Date(),
};

// ─── ntfy ─────────────────────────────────────────────────────────────────────

async function sendNtfy({ title, message, priority = 'high', tags = [], actions = [] }) {
  if (!NTFY_URL) return;
  try {
    const headers = {
      'Title':        title,
      'Priority':     priority,
      'Tags':         tags.join(','),
      'Content-Type': 'text/plain',
    };

    // Add a "Open Status Page" click-action if we have the frontend URL
    if (FRONTEND_URL) {
      headers['Actions'] = `view, Open Status Page, ${FRONTEND_URL}/status`;
    }

    await axios.post(NTFY_URL, message, { headers, timeout: 8000 });
    console.log(`[ntfy] ✉️  Sent: "${title}"`);
  } catch (err) {
    console.error('[ntfy] ⚠️  Failed:', err.message);
  }
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function ensureDbConnected() {
  if (mongoose.connection.readyState === 1) return true;
  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 8000 });
    console.log('[watchdog] ✅  MongoDB connected');
    return true;
  } catch (err) {
    console.error('[watchdog] ❌  MongoDB connect failed:', err.message);
    return false;
  }
}

/**
 * Create an incident + linked report in the DB and return the incident _id.
 * Called when consecutive failure threshold is hit.
 */
async function createDownIncident(errorMsg) {
  const ok = await ensureDbConnected();
  if (!ok) {
    console.error('[watchdog] Cannot write incident — DB unreachable');
    return null;
  }

  try {
    // Create a report first
    const report = await UptimeReport.create({
      description: `[WATCHDOG] External monitor detected API is unreachable. Error: ${errorMsg}`,
      affectedService: 'API',
      status: 'confirmed',
    });

    const now = new Date();
    const incident = await Incident.create({
      title:            '🔴 API Unreachable — Backend Down',
      description:      `The PlanIt backend failed to respond to ${THRESHOLD} consecutive health checks from the external watchdog monitor. Users may be unable to access the application.`,
      severity:         'critical',
      status:           'investigating',
      affectedServices: ['api', 'websocket', 'chat', 'auth', 'database'],
      reportIds:        [report._id],
      timeline: [{
        status:    'investigating',
        message:   `Watchdog detected backend unreachable after ${THRESHOLD} consecutive failures. Last error: ${errorMsg}`,
        createdAt: now,
      }],
    });

    // Link report → incident
    report.incidentId = incident._id;
    await report.save();

    console.log(`[watchdog] 📋  Incident created: ${incident._id}`);
    return incident._id;
  } catch (err) {
    console.error('[watchdog] Failed to create incident in DB:', err.message);
    return null;
  }
}

/**
 * Resolve the open watchdog incident in the DB.
 * Called when the server recovers.
 */
async function resolveDownIncident(incidentId, downtimeMs) {
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
      message: `Backend recovered. Total downtime: ${mins < 1 ? '<1' : mins} minute${mins !== 1 ? 's' : ''}. All systems operational.`,
    });
    await incident.save();
    console.log(`[watchdog] ✅  Incident ${incidentId} resolved (${mins}m downtime)`);
  } catch (err) {
    console.error('[watchdog] Failed to resolve incident:', err.message);
  }
}

// ─── Ping logic ───────────────────────────────────────────────────────────────

let downSince = null;  // timestamp when server first went down

async function pingMainServer() {
  state.totalPings++;
  state.lastPingAt = new Date();

  try {
    const t0  = Date.now();
    const res = await axios.get(PING_URL, {
      timeout: 10000,
      validateStatus: s => s < 500,   // 2xx/4xx = server is up
    });
    const ms = Date.now() - t0;

    state.lastPingMs          = ms;
    state.lastError           = null;
    state.consecutiveFailures = 0;
    state.consecutiveSuccesses++;

    // ── Recovery path ──────────────────────────────────────────────────────
    if (state.isDown) {
      const downtimeMs = Date.now() - (downSince || Date.now());
      const downtimeMins = Math.round(downtimeMs / 60000);
      state.isDown = false;
      downSince    = null;

      console.log(`[watchdog] 🟢  Server RECOVERED after ${downtimeMins}m`);

      // Resolve the open incident in DB
      if (state.activeIncidentId) {
        await resolveDownIncident(state.activeIncidentId, downtimeMs);
        state.activeIncidentId = null;
      }

      // Send recovery ntfy
      await sendNtfy({
        title:    '🟢 PlanIt Recovered',
        message:  `Backend is back online after ${downtimeMins < 1 ? '<1' : downtimeMins} min of downtime. Response time: ${ms}ms. The status page has been updated automatically.`,
        priority: 'high',
        tags:     ['white_check_mark', 'tada'],
      });
    } else {
      // Normal healthy ping — log every 10th to avoid spam
      if (state.totalPings % 10 === 0) {
        console.log(`[watchdog] 💚  Ping OK  ${ms}ms  (ping #${state.totalPings})`);
      }
    }
  } catch (err) {
    state.consecutiveFailures++;
    state.consecutiveSuccesses = 0;
    state.totalFailures++;
    state.lastError  = err.message;
    state.lastPingMs = null;

    console.warn(`[watchdog] 🔴  Ping FAILED (${state.consecutiveFailures}/${THRESHOLD}): ${err.message}`);

    // ── Failure threshold hit — server is officially down ──────────────────
    if (state.consecutiveFailures === THRESHOLD && !state.isDown) {
      state.isDown = true;
      downSince    = Date.now();

      console.error(`[watchdog] 🚨  THRESHOLD HIT — declaring server DOWN`);

      // Write incident to DB (shared with main server's Mongo)
      const incidentId = await createDownIncident(err.message);
      state.activeIncidentId = incidentId;

      // Send urgent ntfy alert
      await sendNtfy({
        title:    `🚨 PlanIt Backend Down`,
        message:  `The PlanIt API has been unreachable for ${THRESHOLD} consecutive checks (every ${PING_MS / 1000}s).\n\nError: ${err.message}\n\nThe status page has been updated. Check your server logs immediately.`,
        priority: 'urgent',
        tags:     ['rotating_light', 'fire'],
      });
    }

    // Repeat ntfy every 10 failures while still down (don't spam every 30s)
    if (state.isDown && state.consecutiveFailures > THRESHOLD && state.consecutiveFailures % 10 === 0) {
      const downMins = Math.round((Date.now() - downSince) / 60000);
      await sendNtfy({
        title:    `⚠️ PlanIt Still Down (${downMins}m)`,
        message:  `Backend has been unreachable for ${downMins} minutes.\n\nFailed pings: ${state.consecutiveFailures}\nLast error: ${err.message}`,
        priority: 'high',
        tags:     ['warning', 'clock'],
      });
    }
  }
}

// ─── Express health server ────────────────────────────────────────────────────
// Lets hosting platforms (Railway, Render, Fly) know the watchdog itself is alive.
// Also gives you a JSON status endpoint to check remotely.

const app = express();
app.use(express.json());

// Root health check — used by the hosting platform's health probe
app.get('/', (req, res) => res.send('PlanIt Watchdog OK'));

// Detailed JSON status — lets YOU check watchdog health from anywhere
app.get('/watchdog/status', (req, res) => {
  const uptimeSeconds = Math.floor((Date.now() - state.startedAt.getTime()) / 1000);
  res.json({
    watchdog:            'running',
    uptimeSeconds,
    startedAt:           state.startedAt,
    mainServer:          state.isDown ? 'DOWN' : 'UP',
    consecutiveFailures: state.consecutiveFailures,
    lastPingMs:          state.lastPingMs,
    lastPingAt:          state.lastPingAt,
    lastError:           state.lastError,
    activeIncidentId:    state.activeIncidentId,
    totalPings:          state.totalPings,
    totalFailures:       state.totalFailures,
    pingIntervalMs:      PING_MS,
    failureThreshold:    THRESHOLD,
    targets: {
      mainServer: PING_URL,
      frontend:   FRONTEND_URL,
      ntfy:       NTFY_URL || '(not set)',
    },
  });
});

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function boot() {
  console.log('');
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║          PlanIt Watchdog  🛡️                  ║');
  console.log('╚══════════════════════════════════════════════╝');
  console.log(`  Monitoring : ${PING_URL}`);
  console.log(`  Frontend   : ${FRONTEND_URL}`);
  console.log(`  Interval   : ${PING_MS / 1000}s`);
  console.log(`  Threshold  : ${THRESHOLD} failures`);
  console.log(`  ntfy       : ${NTFY_URL || '(not configured)'}`);
  console.log('');

  // Pre-connect to MongoDB so first incident creation is fast
  await ensureDbConnected();

  // Start the HTTP server
  app.listen(PORT, () => {
    console.log(`[watchdog] 🌐  Health server → http://0.0.0.0:${PORT}`);
    console.log(`[watchdog] 📊  Status endpoint → http://0.0.0.0:${PORT}/watchdog/status`);
  });

  // Initial ping immediately, then on interval
  await pingMainServer();
  setInterval(pingMainServer, PING_MS);

  console.log(`[watchdog] ✅  Pinging every ${PING_MS / 1000}s — watching for ${THRESHOLD} consecutive failures`);
  console.log('');
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[watchdog] SIGTERM — shutting down gracefully');
  await mongoose.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[watchdog] SIGINT — shutting down');
  await mongoose.disconnect();
  process.exit(0);
});

boot().catch(err => {
  console.error('[watchdog] Fatal boot error:', err);
  process.exit(1);
});
