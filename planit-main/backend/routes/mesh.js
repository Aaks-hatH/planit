'use strict';
/**
 * PlanIt Backend — Mesh Routes
 * ──────────────────────────────────────────────────────────────────────────────
 * These endpoints are INTERNAL ONLY — protected by mesh auth.
 * They expose richer data than the public /api/health endpoint and allow
 * the router/watchdog to coordinate with this backend.
 *
 * Endpoints:
 *   GET  /api/mesh/health   — rich health snapshot (router pings this every keepalive)
 *   POST /api/mesh/seen     — router confirms it has registered this backend
 *
 * Environment variables read here:
 *   BACKEND_LABEL   = "Maverick"       (this backend's codename)
 *   BACKEND_REGION  = "US East (Virginia)"
 *   MESH_SECRET     = <shared secret>
 */

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

module.exports = router;
