'use strict';
/**
 * watchdog/uptimeRollup.js — keeps MongoDB small.
 *
 * The watchdog writes one UptimeCheck document per service per ping (every 60 s by
 * default = 1,440 docs per service per day). Nobody needs minute-level history for old
 * days, so this module squashes every COMPLETE past UTC day into ONE UptimeDaily document
 * per service ({ service, day, total, up, latency stats, first/last down }) and then
 * deletes that day's raw checks.
 *
 *   raw UptimeCheck : only today + the last ~2 days are kept (live 1h / 24h graphs need them)
 *   UptimeDaily     : 1 small doc per service per day, kept 365 days
 *
 * Env (all optional):
 *   UPTIME_ROLLUP_ENABLED       'false' turns the scheduler off          (default on)
 *   UPTIME_RAW_KEEP_HOURS       raw checks kept before roll-up, min 25   (default 48)
 *   UPTIME_ROLLUP_INTERVAL_MIN  how often the job runs, min 5            (default 60)
 *
 * Safe to re-run: a day is only rolled up once it is over, the daily doc is written before the
 * raw checks are deleted, and an existing daily doc is never overwritten with smaller numbers.
 *
 * One-off run (e.g. to shrink an already-large database right now):
 *   MONGO_URI=... node uptimeRollup.js --once
 *
 * The same UptimeDaily schema is mirrored in backend/models/UptimeDaily.js (the backend only
 * reads it). Keep the two in sync, exactly like UptimeCheck.
 */

const mongoose = require('mongoose');

const DAY_MS = 24 * 60 * 60 * 1000;
const RAW_KEEP_HOURS  = Math.max(25, parseInt(process.env.UPTIME_RAW_KEEP_HOURS || '48', 10) || 48);
const INTERVAL_MIN    = Math.max(5,  parseInt(process.env.UPTIME_ROLLUP_INTERVAL_MIN || '60', 10) || 60);
const ENABLED         = String(process.env.UPTIME_ROLLUP_ENABLED || 'true').toLowerCase() !== 'false';
const ts = () => new Date().toISOString();

// ─── Schema (mirrored in backend/models/UptimeDaily.js) ──────────────────────
const uptimeDailySchema = new mongoose.Schema({
  service:      { type: String, required: true },
  day:          { type: String, required: true },          // 'YYYY-MM-DD' (UTC)
  total:        { type: Number, default: 0 },              // checks that day
  up:           { type: Number, default: 0 },              // checks that were up
  latencySum:   { type: Number, default: 0 },              // sum of latencyMs of checks that had one
  latencyCount: { type: Number, default: 0 },
  latencyMax:   { type: Number, default: null },
  firstDownAt:  { type: Date,   default: null },
  lastDownAt:   { type: Date,   default: null },
  lastError:    { type: String, default: null },
  dayDate:      { type: Date,   required: true },          // start of the day, drives the TTL
  rolledAt:     { type: Date,   default: Date.now },
}, { versionKey: false, collection: 'uptime_daily' });
uptimeDailySchema.index({ service: 1, day: 1 }, { unique: true });
uptimeDailySchema.index({ dayDate: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 }); // keep 1 year

const UptimeDaily = mongoose.models.UptimeDaily || mongoose.model('UptimeDaily', uptimeDailySchema);

// ─── Roll-up ─────────────────────────────────────────────────────────────────
let running = false;

/**
 * Squash every complete UTC day older than `keepHours` into UptimeDaily and delete the raw checks.
 * Returns { groups, rawDeleted }.
 */
async function rollupOnce(UptimeCheck, { keepHours = RAW_KEEP_HOURS, now = Date.now() } = {}) {
  const cutoffMs = Math.floor((now - keepHours * 3600 * 1000) / DAY_MS) * DAY_MS; // start of a UTC day
  const cutoff   = new Date(cutoffMs);

  const oldest = await UptimeCheck.findOne({ createdAt: { $lt: cutoff } }).sort({ createdAt: 1 }).select('createdAt').lean();
  if (!oldest) return { groups: 0, rawDeleted: 0 };
  const services = await UptimeCheck.distinct('service', { createdAt: { $lt: cutoff } });

  let groups = 0, rawDeleted = 0;
  for (let t = Math.floor(oldest.createdAt.getTime() / DAY_MS) * DAY_MS; t < cutoffMs; t += DAY_MS) {
    const start = new Date(t), end = new Date(t + DAY_MS), day = start.toISOString().slice(0, 10);

    for (const service of services) {
      const range = { service, createdAt: { $gte: start, $lt: end } };
      const [g] = await UptimeCheck.aggregate([
        { $match: range },
        { $group: {
            _id: null,
            total:        { $sum: 1 },
            up:           { $sum: { $cond: [{ $eq: ['$status', 'up'] }, 1, 0] } },
            latencySum:   { $sum: '$latencyMs' },
            latencyCount: { $sum: { $cond: [{ $in: [{ $type: '$latencyMs' }, ['int', 'long', 'double', 'decimal']] }, 1, 0] } },
            latencyMax:   { $max: '$latencyMs' },
            firstDownAt:  { $min: { $cond: [{ $eq: ['$status', 'down'] }, '$createdAt', null] } },
            lastDownAt:   { $max: { $cond: [{ $eq: ['$status', 'down'] }, '$createdAt', null] } },
        } },
      ]);
      if (!g) continue;                                   // nothing for this service that day

      let lastError = null;
      if (g.lastDownAt) {
        const e = await UptimeCheck.findOne({ ...range, status: 'down' }).sort({ createdAt: -1 }).select('error').lean();
        lastError = e?.error ? String(e.error).slice(0, 300) : null;
      }

      const doc = {
        service, day, total: g.total, up: g.up,
        latencySum: g.latencySum || 0, latencyCount: g.latencyCount || 0, latencyMax: g.latencyMax ?? null,
        firstDownAt: g.firstDownAt || null, lastDownAt: g.lastDownAt || null, lastError,
        dayDate: start, rolledAt: new Date(),
      };

      // Write the daily doc FIRST. If one already exists with >= as many checks (earlier run that
      // crashed before deleting, or an admin "fix" applied to it) leave it alone: the filter below
      // then misses, the upsert tries to insert, and the unique index (E11000) tells us so.
      try {
        await UptimeDaily.updateOne({ service, day, total: { $not: { $gte: g.total } } }, { $set: doc }, { upsert: true });
      } catch (err) {
        if (err.code !== 11000) throw err;
      }

      const del = await UptimeCheck.deleteMany(range);
      rawDeleted += del.deletedCount || 0;
      groups += 1;
    }
  }
  return { groups, rawDeleted };
}

/** Single-flight wrapper that logs. */
async function runRollup(UptimeCheck) {
  if (running) return null;
  running = true;
  try {
    const r = await rollupOnce(UptimeCheck);
    if (r.groups) console.log(`[${ts()}] [uptime-rollup] ${r.groups} service-day(s) compacted, ${r.rawDeleted} raw checks deleted`);
    return r;
  } catch (err) {
    console.error(`[${ts()}] [uptime-rollup] failed: ${err.message}`);
    return null;
  } finally { running = false; }
}

/** Start the hourly job (first run 30 s after boot). */
function startUptimeRollup(UptimeCheck) {
  if (!ENABLED) { console.log(`[${ts()}] [uptime-rollup] disabled (UPTIME_ROLLUP_ENABLED=false)`); return; }
  setTimeout(() => runRollup(UptimeCheck), 30 * 1000);
  setInterval(() => runRollup(UptimeCheck), INTERVAL_MIN * 60 * 1000);
  console.log(`[${ts()}] [uptime-rollup] scheduled every ${INTERVAL_MIN} min, raw checks kept ${RAW_KEEP_HOURS}h`);
}

// ─── Readers: one list of per-service-per-day rows, raw + rolled-up ───────────

/** Merge raw-per-day rows and daily docs; if a day exists in both, keep the one with more checks. */
function combineDays(rawRows, dailyRows) {
  const m = new Map();
  const put = (r) => {
    const k = `${r.service}|${r.day}`;
    const cur = m.get(k);
    if (!cur || r.total > cur.total) m.set(k, r);
  };
  rawRows.forEach(put);
  dailyRows.forEach(put);
  return [...m.values()];
}

/**
 * Per-service, per-UTC-day rows since `since`:
 *   { service, day, total, up, latencySum, latencyCount }
 */
async function getDayRows(UptimeCheck, since, match = {}) {
  const sinceDay = since.toISOString().slice(0, 10);
  const raw = await UptimeCheck.aggregate([
    { $match: { ...match, createdAt: { $gte: since } } },
    { $group: {
        _id: { service: '$service', day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } } },
        total:        { $sum: 1 },
        up:           { $sum: { $cond: [{ $eq: ['$status', 'up'] }, 1, 0] } },
        latencySum:   { $sum: '$latencyMs' },
        latencyCount: { $sum: { $cond: [{ $in: [{ $type: '$latencyMs' }, ['int', 'long', 'double', 'decimal']] }, 1, 0] } },
    } },
  ]);
  const rawRows = raw.map(r => ({ service: r._id.service, day: r._id.day, total: r.total, up: r.up, latencySum: r.latencySum || 0, latencyCount: r.latencyCount || 0 }));
  const dailyRows = (await UptimeDaily.find({ ...match, day: { $gte: sinceDay } })
    .select('service day total up latencySum latencyCount').lean())
    .map(d => ({ service: d.service, day: d.day, total: d.total, up: d.up, latencySum: d.latencySum || 0, latencyCount: d.latencyCount || 0 }));
  return combineDays(rawRows, dailyRows);
}

module.exports = { UptimeDaily, rollupOnce, runRollup, startUptimeRollup, combineDays, getDayRows, RAW_KEEP_HOURS };

// ─── CLI: node uptimeRollup.js --once ─────────────────────────────────────────
if (require.main === module) {
  require('dotenv').config();
  (async () => {
    if (!process.env.MONGO_URI) { console.error('MONGO_URI is required'); process.exit(1); }
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
    const UptimeCheck = mongoose.models.UptimeCheck || mongoose.model('UptimeCheck', new mongoose.Schema({
      service: String, status: String, latencyMs: Number, error: String, createdAt: Date,
    }));
    await UptimeDaily.init();
    const r = await rollupOnce(UptimeCheck);
    console.log(`[uptime-rollup] done: ${r.groups} service-day(s) compacted, ${r.rawDeleted} raw checks deleted`);
    await mongoose.disconnect();
  })().catch(e => { console.error(e); process.exit(1); });
}
