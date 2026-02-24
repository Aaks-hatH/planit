const cron = require('node-cron');
const mongoose = require('mongoose');
const Event = require('../models/Event');
const Message = require('../models/Message');
const Poll = require('../models/Poll');
const File = require('../models/File');
const EventParticipant = require('../models/EventParticipant');
const Invite = require('../models/Invite');
const UptimeReport = require('../models/UptimeReport');
const Incident = require('../models/Incident');

/**
 * AUTO-CLEANUP SERVICE
 * 
 * Automatically deletes events 7 days after they occur to save database space.
 * Users are warned about this and encouraged to download backups before the event date.
 * 
 * Runs daily at 2 AM
 */

// Helper function to delete all event data including Cloudinary files
async function deleteEventCompletely(event) {
  try {
    console.log(`Starting cleanup for event: ${event.title} (${event._id})`);

    // 1. Delete all files from Cloudinary
    const files = await File.find({ eventId: event._id, isDeleted: false });
    for (const file of files) {
      try {
        await file.deleteFromCloudinary();
        console.log(`Deleted file from Cloudinary: ${file.filename}`);
      } catch (error) {
        console.error(`Failed to delete file ${file.filename} from Cloudinary:`, error);
      }
    }

    // 2. Delete all database records
    await Promise.all([
      Message.deleteMany({ eventId: event._id }),
      Poll.deleteMany({ eventId: event._id }),
      File.deleteMany({ eventId: event._id }),
      EventParticipant.deleteMany({ eventId: event._id }),
      Invite ? Invite.deleteMany({ eventId: event._id }) : Promise.resolve(),
      Event.findByIdAndDelete(event._id)
    ]);

    console.log(`✓ Successfully cleaned up event: ${event.title}`);
    return true;
  } catch (error) {
    console.error(`Failed to cleanup event ${event._id}:`, error);
    return false;
  }
}

// ─── Distributed lock ────────────────────────────────────────────────────────
// With multiple backend instances all sharing the same MongoDB, every server
// would run the cleanup job simultaneously. This lock ensures only one instance
// runs at a time — whichever grabs it first wins, the rest skip silently.
// The lock document expires after 10 minutes via a TTL index so it self-cleans
// even if the winning server crashes mid-job.
const LockSchema = new mongoose.Schema({
  _id:       { type: String },
  expiresAt: { type: Date },
});
LockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const Lock = mongoose.models.CleanupLock || mongoose.model('CleanupLock', LockSchema);

async function withLock(jobName, fn) {
  const lockId = `cleanup:${jobName}`;
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min TTL
  try {
    await Lock.create({ _id: lockId, expiresAt });
  } catch (e) {
    // Duplicate key = another instance already holds the lock
    console.log(`[cleanup] Skipping — another instance is already running "${jobName}"`);
    return;
  }
  try {
    await fn();
  } finally {
    await Lock.deleteOne({ _id: lockId }).catch(() => {});
  }
}


async function cleanupUptimeData() {
  try {
    const now = new Date();

    // Dismissed reports: delete after 7 days (no longer useful)
    const dismissedCutoff = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const dismissedResult = await UptimeReport.deleteMany({
      status: 'dismissed',
      createdAt: { $lt: dismissedCutoff },
    });

    // Confirmed/resolved reports older than 30 days
    const resolvedCutoff = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const confirmedResult = await UptimeReport.deleteMany({
      status: { $in: ['confirmed'] },
      createdAt: { $lt: resolvedCutoff },
    });

    // Stale pending reports older than 30 days (nobody actioned them)
    const stalePendingResult = await UptimeReport.deleteMany({
      status: 'pending',
      createdAt: { $lt: resolvedCutoff },
    });

    // Resolved incidents older than 90 days
    const incidentCutoff = new Date(now - 90 * 24 * 60 * 60 * 1000);
    const incidentResult = await Incident.deleteMany({
      status: 'resolved',
      createdAt: { $lt: incidentCutoff },
    });

    const total = dismissedResult.deletedCount + confirmedResult.deletedCount +
                  stalePendingResult.deletedCount + incidentResult.deletedCount;

    if (total > 0) {
      console.log(`[uptime cleanup] Deleted ${dismissedResult.deletedCount} dismissed reports, ` +
        `${confirmedResult.deletedCount} old confirmed reports, ` +
        `${stalePendingResult.deletedCount} stale pending reports, ` +
        `${incidentResult.deletedCount} old incidents`);
    }
  } catch (error) {
    console.error('[uptime cleanup] Error:', error);
  }
}

// Main cleanup function
async function cleanupOldEvents() {
  try {
    console.log('='.repeat(50));
    console.log('Starting automatic event cleanup job...');
    console.log(new Date().toISOString());
    console.log('='.repeat(50));

    // Calculate cutoff: end of day, 7 days ago.
    // Using end-of-day (23:59:59.999) ensures we catch events set to ANY time
    // on the 7-days-ago date, not just those before 2 AM (when this job runs).
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(23, 59, 59, 999);

    // Find events that occurred 7+ days ago (including cancelled — they should be cleaned up too)
    const oldEvents = await Event.find({
      date: { $lte: sevenDaysAgo }
    });

    console.log(`Found ${oldEvents.length} events to clean up (7+ days old)`);

    if (oldEvents.length === 0) {
      console.log('No events to clean up.');
      return;
    }

    // Delete each event
    let successCount = 0;
    let failCount = 0;

    for (const event of oldEvents) {
      const success = await deleteEventCompletely(event);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
    }

    console.log('='.repeat(50));
    console.log(`Cleanup complete!`);
    console.log(`✓ Successfully deleted: ${successCount} events`);
    if (failCount > 0) {
      console.log(`✗ Failed to delete: ${failCount} events`);
    }
    console.log('='.repeat(50));

  } catch (error) {
    console.error('Error in cleanup job:', error);
  }
}

// Schedule cleanup job to run daily at 2 AM
function startCleanupScheduler() {
  console.log(' Event cleanup scheduler initialized');
  console.log(' Will run daily at 2:00 AM (and immediately on startup)');
  console.log('  Events are deleted 7 days after they occur (any time on that day)');
  console.log('  Cancelled events are also cleaned up after 7 days');
  
  // Run at 2 AM every day: "0 2 * * *"
  cron.schedule('0 2 * * *', () => {
    withLock('daily', async () => {
      await cleanupOldEvents();
      await cleanupUptimeData();
    });
  });

  // Also run on startup to catch events missed while the server was down/sleeping
  withLock('startup', async () => {
    await cleanupOldEvents();
    await cleanupUptimeData();
  });
}

// Manual cleanup function for admin use
async function manualCleanup() {
  console.log('Running manual cleanup...');
  await cleanupOldEvents();
}

module.exports = {
  startCleanupScheduler,
  manualCleanup,
  cleanupOldEvents
};
