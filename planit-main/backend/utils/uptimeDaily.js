'use strict';
// Readers/fixers that see BOTH the raw per-minute UptimeCheck docs (recent days) and the
// one-doc-per-day UptimeDaily docs (older days, written by watchdog/uptimeRollup.js).
const UptimeCheck = require('../models/UptimeCheck');
const UptimeDaily = require('../models/UptimeDaily');

const NUM_TYPES = ['int', 'long', 'double', 'decimal'];

/** Merge raw-per-day rows and daily docs; if a day is in both, keep the one with more checks. */
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

/** Per-service, per-UTC-day rows since `since`: { service, day, total, up, latencySum, latencyCount } */
async function getDayRows(since, match = {}) {
  const sinceDay = since.toISOString().slice(0, 10);
  const raw = await UptimeCheck.aggregate([
    { $match: { ...match, createdAt: { $gte: since } } },
    { $group: {
        _id: { service: '$service', day: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } } },
        total:        { $sum: 1 },
        up:           { $sum: { $cond: [{ $eq: ['$status', 'up'] }, 1, 0] } },
        latencySum:   { $sum: '$latencyMs' },
        latencyCount: { $sum: { $cond: [{ $in: [{ $type: '$latencyMs' }, NUM_TYPES] }, 1, 0] } },
    } },
  ]);
  const rawRows = raw.map(r => ({ service: r._id.service, day: r._id.day, total: r.total, up: r.up, latencySum: r.latencySum || 0, latencyCount: r.latencyCount || 0 }));
  const dailyRows = (await UptimeDaily.find({ ...match, day: { $gte: sinceDay } })
    .select('service day total up latencySum latencyCount').lean())
    .map(d => ({ service: d.service, day: d.day, total: d.total, up: d.up, latencySum: d.latencySum || 0, latencyCount: d.latencyCount || 0 }));
  return combineDays(rawRows, dailyRows);
}

/** Distinct service names seen (raw or rolled-up) since `since`. */
async function distinctServices(since) {
  const [a, b] = await Promise.all([
    UptimeCheck.distinct('service', { createdAt: { $gte: since } }),
    UptimeDaily.distinct('service', { day: { $gte: since.toISOString().slice(0, 10) } }),
  ]);
  return [...new Set([...a, ...b])];
}

/**
 * "Fix" rolled-up days: mark every check of the matching daily docs as up and clear the down info.
 * service: string | string[]; fromDay/toDay: 'YYYY-MM-DD' (inclusive, optional).
 * Returns the number of daily docs changed.
 */
async function fixDailyDown({ service, fromDay, toDay }) {
  const filter = { service: Array.isArray(service) ? { $in: service } : service };
  if (fromDay || toDay) { filter.day = {}; if (fromDay) filter.day.$gte = fromDay; if (toDay) filter.day.$lte = toDay; }
  // Daily docs are tiny and few (<= 1/service/day), so a per-doc update is fine and works on any MongoDB version.
  const docs = (await UptimeDaily.find(filter).select('_id total up').lean()).filter(d => d.up < d.total);
  for (const d of docs) {
    await UptimeDaily.updateOne({ _id: d._id }, { $set: { up: d.total, firstDownAt: null, lastDownAt: null, lastError: null } });
  }
  return docs.length;
}

const avgOf = (r) => (r && r.latencyCount ? r.latencySum / r.latencyCount : 0);

module.exports = { combineDays, getDayRows, distinctServices, fixDailyDown, avgOf };
