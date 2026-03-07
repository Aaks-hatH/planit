'use strict';

/**
 * routes/seating.js
 *
 * Seating map CRUD and guest table-assignment endpoints.
 *
 * Mount in server.js:
 *   app.use('/api/events', seatingRoutes);
 *
 * Endpoints
 * ---------
 *   GET    /:eventId/seating           — get the seating map (checkin access)
 *   PUT    /:eventId/seating           — save the full map (organizer only)
 *   PATCH  /:eventId/seating/guests    — bulk assign / unassign guests (organizer)
 *   PATCH  /:eventId/invites/:inviteId/table — assign one guest to a table
 */

const express = require('express');
const router  = express.Router();
const { body, validationResult } = require('express-validator');
const Event  = require('../models/Event');
const Invite = require('../models/Invite');
const { verifyOrganizer, verifyCheckinAccess } = require('../middleware/auth');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

// --------------------------------------------------------------------------
// GET /:eventId/seating
// Returns the seating map plus a per-table guest summary for display.
// --------------------------------------------------------------------------
router.get('/:eventId/seating', verifyCheckinAccess, async (req, res, next) => {
  try {
    const event = await Event
      .findById(req.params.eventId)
      .select('seatingMap title')
      .lean();

    if (!event) return res.status(404).json({ error: 'Event not found' });

    // Attach guest counts per table so the viewer can show seat-fill indicators
    const invites = await Invite
      .find({ eventId: req.params.eventId, tableId: { $ne: null } })
      .select('tableId tableLabel guestName checkedIn guestRole')
      .lean();

    const guestsByTable = {};
    for (const inv of invites) {
      if (!guestsByTable[inv.tableId]) guestsByTable[inv.tableId] = [];
      guestsByTable[inv.tableId].push({
        id:         inv._id,
        guestName:  inv.guestName,
        guestRole:  inv.guestRole,
        checkedIn:  inv.checkedIn,
      });
    }

    res.json({
      seatingMap:    event.seatingMap || { enabled: false, objects: [] },
      guestsByTable,
    });
  } catch (err) {
    next(err);
  }
});

// --------------------------------------------------------------------------
// PUT /:eventId/seating
// Overwrites the full seating map. Organizer only.
// Body: { enabled: bool, objects: [...], canvasW?, canvasH? }
// --------------------------------------------------------------------------
router.put(
  '/:eventId/seating',
  verifyOrganizer,
  [
    body('enabled').isBoolean().withMessage('enabled must be boolean'),
    body('objects').isArray({ max: 500 }).withMessage('objects must be an array of up to 500 items'),
    body('objects.*.id').isString().trim().notEmpty(),
    body('objects.*.x').isFloat({ min: 0 }).withMessage('x must be a non-negative number'),
    body('objects.*.y').isFloat({ min: 0 }).withMessage('y must be a non-negative number'),
    body('objects.*.type').isIn(['round', 'rect', 'stage', 'bar', 'sofa', 'vip', 'zone', 'auditorium']),
    body('objects.*.label').optional().isString().trim().isLength({ max: 50 }),
    body('objects.*.rotation').optional().isFloat({ min: 0, max: 359 }),
    body('objects.*.capacity').optional().isInt({ min: 0, max: 999 }),
    body('objects.*.color').optional({ nullable: true }).isString(),
    body('objects.*.width').optional().isFloat({ min: 20 }),
    body('objects.*.height').optional().isFloat({ min: 20 }),
    validate,
  ],
  async (req, res, next) => {
    try {
      const { eventId } = req.params;
      const { enabled, objects, canvasW, canvasH } = req.body;

      // Sanitise: strip any unknown properties from each object
      const safeObjects = objects.map(o => ({
        id:       String(o.id).slice(0, 64),
        x:        Number(o.x),
        y:        Number(o.y),
        type:     o.type,
        label:    (o.label || '').trim().slice(0, 50),
        rotation: Number(o.rotation) || 0,
        capacity: o.type === 'zone' ? 0 : (Number(o.capacity) || 8),
        color:    o.color || null,
        width:    Number(o.width)  || 80,
        height:   Number(o.height) || 80,
      }));

      // Check for duplicate ids
      const ids = safeObjects.map(o => o.id);
      if (new Set(ids).size !== ids.length) {
        return res.status(400).json({ error: 'Duplicate table ids in objects array' });
      }

      const event = await Event.findById(eventId);
      if (!event) return res.status(404).json({ error: 'Event not found' });

      // Clear tableId/tableLabel on invites whose table was removed
      const removedIds = (event.seatingMap?.objects || [])
        .map(o => o.id)
        .filter(id => !ids.includes(id));

      if (removedIds.length > 0) {
        await Invite.updateMany(
          { eventId, tableId: { $in: removedIds } },
          { $set: { tableId: null, tableLabel: null } }
        );
      }

      event.seatingMap = {
        enabled:   !!enabled,
        objects:   safeObjects,
        canvasW:   Number(canvasW) || 1000,
        canvasH:   Number(canvasH) || 700,
        updatedAt: new Date(),
        updatedBy: req.user?.username || 'organizer',
      };

      await event.save();

      // Log to activity log
      event.activityLog.push({
        action:    'seating_map_updated',
        actor:     req.user?.username || 'organizer',
        actorRole: 'organizer',
        details:   `Seating map saved with ${safeObjects.length} tables`,
        timestamp: new Date(),
      });
      await event.save();

      // Broadcast to all check-in clients so their maps update in real-time
      const io = req.app.get('io');
      if (io) {
        io.to(`event_${eventId}`).emit('seating_map_updated', {
          seatingMap: event.seatingMap,
        });
      }

      res.json({ message: 'Seating map saved', seatingMap: event.seatingMap });
    } catch (err) {
      next(err);
    }
  }
);

// --------------------------------------------------------------------------
// PATCH /:eventId/seating/guests
// Bulk assign or unassign guests to tables.
// Body: { assignments: [{ inviteId, tableId, tableLabel }] }
//         To unassign pass tableId: null, tableLabel: null
// --------------------------------------------------------------------------
router.patch(
  '/:eventId/seating/guests',
  verifyOrganizer,
  [
    body('assignments').isArray({ min: 1, max: 500 }),
    body('assignments.*.inviteId').isMongoId(),
    body('assignments.*.tableId').optional({ nullable: true }).isString(),
    body('assignments.*.tableLabel').optional({ nullable: true }).isString().isLength({ max: 50 }),
    validate,
  ],
  async (req, res, next) => {
    try {
      const { eventId }   = req.params;
      const { assignments } = req.body;

      const ops = assignments.map(a => ({
        updateOne: {
          filter: { _id: a.inviteId, eventId },
          update: { $set: { tableId: a.tableId || null, tableLabel: a.tableLabel || null } },
        },
      }));

      const result = await Invite.bulkWrite(ops, { ordered: false });

      // Notify clients
      const io = req.app.get('io');
      if (io) {
        io.to(`event_${eventId}`).emit('seating_assignments_updated', { assignments });
      }

      res.json({ message: 'Assignments saved', modified: result.modifiedCount });
    } catch (err) {
      next(err);
    }
  }
);

// --------------------------------------------------------------------------
// PATCH /:eventId/invites/:inviteId/table
// Assign or unassign a single guest to/from a table.
// Body: { tableId: string | null, tableLabel: string | null }
// --------------------------------------------------------------------------
router.patch(
  '/:eventId/invites/:inviteId/table',
  verifyOrganizer,
  [
    body('tableId').optional({ nullable: true }).isString().isLength({ max: 64 }),
    body('tableLabel').optional({ nullable: true }).isString().isLength({ max: 50 }),
    validate,
  ],
  async (req, res, next) => {
    try {
      const { eventId, inviteId } = req.params;
      const { tableId, tableLabel } = req.body;

      const invite = await Invite.findOne({ _id: inviteId, eventId });
      if (!invite) return res.status(404).json({ error: 'Invite not found' });

      // Validate that the tableId exists in the event's seating map (unless null)
      if (tableId) {
        const event = await Event
          .findById(eventId)
          .select('seatingMap.objects')
          .lean();
        const tableExists = event?.seatingMap?.objects?.some(o => o.id === tableId);
        if (!tableExists) {
          return res.status(400).json({ error: 'Table not found in seating map' });
        }
      }

      invite.tableId    = tableId    || null;
      invite.tableLabel = tableLabel || null;
      await invite.save();

      const io = req.app.get('io');
      if (io) {
        io.to(`event_${eventId}`).emit('guest_table_updated', {
          inviteId: invite._id,
          tableId:  invite.tableId,
          tableLabel: invite.tableLabel,
        });
      }

      res.json({ message: 'Table assignment updated', invite });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC WAIT BOARD ROUTES  (no auth required)
// GET  /public/wait/:id/info   — venue branding info
// GET  /public/wait/:id/live   — live waitlist + wait times + table stats
// POST /public/wait/:id/join   — walk-in joins the waitlist
// ─────────────────────────────────────────────────────────────────────────────

function resolveVenue(id) {
  // id can be a mongo ObjectId OR a subdomain string
  const isObjectId = /^[a-f\d]{24}$/i.test(id);
  return isObjectId
    ? Event.findById(id)
    : Event.findOne({ subdomain: id });
}

function isVenueOpen(event) {
  const settings = event.tableServiceSettings || {};
  const open  = settings.operatingHoursOpen  || '00:00';
  const close = settings.operatingHoursClose || '23:59';
  const now   = new Date();
  const pad   = n => String(n).padStart(2, '0');
  const cur   = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return cur >= open && cur <= close;
}

function calcWaitTimes(event) {
  const settings  = event.tableServiceSettings || {};
  const avg       = settings.avgDiningMinutes       || 75;
  const buffer    = settings.cleaningBufferMinutes  || 10;
  const objects   = (event.seatingMap && event.seatingMap.objects) || [];
  const states    = event.tableStates || [];
  const waitlist  = (event.tableServiceWaitlist || []).filter(w => w.status === 'waiting' || w.status === 'notified');

  // Build table availability by capacity
  const tables = objects
    .filter(o => o.type === 'table' || !o.type)
    .map(o => {
      const state = states.find(s => s.tableId === String(o.id || o._id));
      const status = state ? state.status : 'available';
      const cap = o.capacity || o.seats || 2;
      return { cap, status };
    });

  const available = tables.filter(t => t.status === 'available');
  const occupied  = tables.filter(t => t.status === 'occupied');
  const reserved  = tables.filter(t => t.status === 'reserved');

  // For each party-size bucket check if a table can fit them
  const canSeat = (size) => available.some(t => t.cap >= size);

  // Rough wait estimate: parties ahead × avg turn time
  const queueAhead = (size) => waitlist.filter(w => w.partySize <= size).length;

  const estimate = (size) => {
    if (canSeat(size)) return 0;
    const ahead = queueAhead(size);
    return Math.round((ahead + 1) * (avg + buffer));
  };

  return {
    forTwo:   estimate(2),
    forFour:  estimate(4),
    forEight: estimate(8),
    tableStats: {
      total:     tables.length,
      available: available.length,
      occupied:  occupied.length,
      reserved:  reserved.length,
    },
  };
}

// GET /public/wait/:id/info
router.get('/public/wait/:id/info', async (req, res, next) => {
  try {
    const event = await resolveVenue(req.params.id)
      .select('title isTableServiceMode reservationPageSettings tableServiceSettings subdomain')
      .lean();

    if (!event || !event.isTableServiceMode) {
      return res.status(404).json({ error: 'Not found' });
    }

    const rps = event.reservationPageSettings || {};

    if (rps.publicWaitBoardEnabled === false) {
      return res.status(403).json({ error: 'Wait board not active' });
    }

    res.json({
      name:            event.tableServiceSettings?.restaurantName || event.title,
      logoUrl:         rps.logoUrl         || '',
      accentColor:     rps.accentColor     || '#f97316',
      tagline:         rps.headerTagline   || '',
      waitBoardMessage:rps.waitBoardMessage|| '',
      waitBoardTitle:  rps.waitBoardTitle  || '',
      showPoweredBy:   rps.showPoweredBy   !== false,
    });
  } catch (err) { next(err); }
});

// GET /public/wait/:id/live
router.get('/public/wait/:id/live', async (req, res, next) => {
  try {
    const event = await resolveVenue(req.params.id)
      .select('title isTableServiceMode reservationPageSettings tableServiceSettings seatingMap tableStates tableServiceWaitlist')
      .lean();

    if (!event || !event.isTableServiceMode) {
      return res.status(404).json({ error: 'Not found' });
    }

    const rps = event.reservationPageSettings || {};
    if (rps.publicWaitBoardEnabled === false) {
      return res.status(403).json({ error: 'Wait board not active' });
    }

    const { forTwo, forFour, forEight, tableStats } = calcWaitTimes(event);
    const waitlist = (event.tableServiceWaitlist || [])
      .filter(w => w.status === 'waiting' || w.status === 'notified')
      .map(w => ({
        id:        w.id,
        partyName: w.partyName,
        partySize: w.partySize,
        addedAt:   w.addedAt,
        status:    w.status,
      }));

    res.json({
      isOpen:      isVenueOpen(event),
      waitTimes:   { forTwo, forFour, forEight },
      tableStats,
      waitlist,
      name:        event.tableServiceSettings?.restaurantName || event.title,
      logoUrl:     rps.logoUrl      || '',
      accentColor: rps.accentColor  || '#f97316',
      tagline:     rps.headerTagline|| '',
      waitBoardMessage: rps.waitBoardMessage || '',
    });
  } catch (err) { next(err); }
});

// POST /public/wait/:id/join
router.post('/public/wait/:id/join', async (req, res, next) => {
  try {
    const { partyName, phone = '', partySize = 2 } = req.body;

    if (!partyName || !partyName.trim()) {
      return res.status(400).json({ error: 'partyName is required' });
    }
    if (!Number.isInteger(partySize) || partySize < 1 || partySize > 50) {
      return res.status(400).json({ error: 'partySize must be between 1 and 50' });
    }

    const event = await resolveVenue(req.params.id)
      .select('isTableServiceMode reservationPageSettings tableServiceSettings tableServiceWaitlist');

    if (!event || !event.isTableServiceMode) {
      return res.status(404).json({ error: 'Not found' });
    }

    const rps = event.reservationPageSettings || {};
    if (rps.publicWaitBoardEnabled === false) {
      return res.status(403).json({ error: 'Wait board not active' });
    }

    const maxParty = event.tableServiceSettings?.maxPartySizeWalkIn || 20;
    if (partySize > maxParty) {
      return res.status(400).json({ error: `Maximum party size is ${maxParty}` });
    }

    const entry = {
      id:        require('crypto').randomBytes(8).toString('hex'),
      partyName: partyName.trim(),
      partySize,
      phone:     phone.trim(),
      addedAt:   new Date(),
      status:    'waiting',
    };

    event.tableServiceWaitlist.push(entry);
    await event.save();

    // Notify connected floor staff via socket
    const io = req.app.get('io');
    if (io) {
      io.to(`event_${event._id}`).emit('waitlist_updated', { action: 'joined', entry });
    }

    res.status(201).json({ entry });
  } catch (err) { next(err); }
});

module.exports = router;
