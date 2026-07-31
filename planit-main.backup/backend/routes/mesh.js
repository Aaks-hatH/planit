'use strict';


const express    = require('express');
const mongoose   = require('mongoose');
const router     = express.Router();
const { meshAuth } = require('../middleware/mesh');

// Process start time — used to calculate uptime and detect cold starts
const PROCESS_START = Date.now();

// Cold start window: first 90 seconds after restart.
// Router uses this to delay routing new traffic to a just-restarted backend.
const COLD_START_WINDOW_MS = 90_000;

// ─── GET /api/mesh/health ─────────────────────────────────────────────────────
// Rich health snapshot. Only accepts requests signed with MESH_SECRET.
// The router calls this during every keepalive ping to get real metrics.
router.get('/health', meshAuth(process.env.BACKEND_LABEL || 'Backend'), (req, res) => {
  const uptimeMs  = Date.now() - PROCESS_START;
  const mem       = process.memoryUsage();
  const dbState   = mongoose.connection.readyState;
  const dbStatus  = ['disconnected', 'connected', 'connecting', 'disconnecting'][dbState] || 'unknown';

  // Read Socket.IO instance if available (set by server.js as app.get('io'))
  const io                = req.app.get('io');
  const socketConnections = io ? io.engine.clientsCount : 0;

  res.json({
    // Identity
    name:    process.env.BACKEND_LABEL  || 'Backend',
    region:  process.env.BACKEND_REGION || null,

    // Status
    status:  dbState === 1 ? 'ok' : 'degraded',
    coldStart: uptimeMs < COLD_START_WINDOW_MS,

    // Resources
    uptimeMs,
    uptimeSec: Math.floor(uptimeMs / 1000),
    memory: {
      heapUsedMB:  Math.round(mem.heapUsed  / 1024 / 1024),
      heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
      rssMB:       Math.round(mem.rss       / 1024 / 1024),
      pct:         Math.round((mem.heapUsed / mem.heapTotal) * 100),
    },

    // Connections
    socketConnections,
    db: dbStatus,

    // Meta
    nodeVersion: process.version,
    ts: new Date().toISOString(),
  });
});

// ─── POST /api/mesh/seen ──────────────────────────────────────────────────────
// Router calls this after successfully registering a backend.
// Backend logs it so you can see in your Render logs when the mesh connected.
router.post('/seen', meshAuth(process.env.BACKEND_LABEL || 'Backend'), (req, res) => {
  const { registeredAs, activeInFleet } = req.body;
  console.log(`[mesh] Confirmed by Router — registered as "${registeredAs}", fleet size: ${activeInFleet}`);
  res.json({ ok: true, name: process.env.BACKEND_LABEL || 'Backend' });
});

// ─── GET /api/mesh/logs ───────────────────────────────────────────────────────
// Returns this backend's full in-memory log ring-buffer.
// Called by the router's /mesh/fleet-logs fan-out so admins can see every
// backend's logs from a single endpoint without setting per-backend env vars.
router.get('/logs', meshAuth(process.env.BACKEND_LABEL || 'Backend'), (req, res) => {
  const name = process.env.BACKEND_LABEL || 'Backend';
  const logs = (global.__adminLogBuffer || []).slice().map(e => ({
    ...e,
    source:     name.toLowerCase().replace(/\s+/g, '-'),
    sourceName: name,
  }));
  res.json({
    source:   name.toLowerCase().replace(/\s+/g, '-'),
    name,
    logs,
    total:    logs.length,
    uptime:   Math.floor(process.uptime()),
    ts:       new Date().toISOString(),
  });
});

module.exports = router;
