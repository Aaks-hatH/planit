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
const BlogPost = require('../models/BlogPost');
const WLLead = require('../models/WLLead');

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

// ─── Email scheduling helpers ─────────────────────────────────────────────────
// These run on one backend at a time (distributed lock ensures no duplicate sends).

async function scheduleReminderEmails() {
  try {
    const { sendEventReminder } = require('../services/emailService');
    const hours  = parseInt(process.env.EMAIL_REMINDER_HOURS || '24', 10);
    const now    = new Date();
    const target = new Date(now.getTime() + hours * 60 * 60 * 1000);
    const window = 60 * 60 * 1000; // match events starting within ±30 min of target

    const events = await Event.find({
      status: 'active',
      date: {
        $gte: new Date(target.getTime() - window / 2),
        $lte: new Date(target.getTime() + window / 2),
      },
      organizerEmail: { $exists: true, $ne: '' },
    }).select('title date location organizerName organizerEmail _id').lean();

    for (const event of events) {
      sendEventReminder(event).catch(() => {});
    }
    if (events.length) console.log(`[email] Queued ${events.length} reminder(s) for ~${hours}h window`);
  } catch (err) {
    console.error('[email] Reminder scheduling error:', err.message);
  }
}

async function scheduleThankyouEmails() {
  try {
    const { sendEventThankyou } = require('../services/emailService');
    const now     = new Date();
    const from    = new Date(now.getTime() - 90 * 60 * 1000); // ended up to 90 min ago
    const to      = new Date(now.getTime() - 5  * 60 * 1000); // but at least 5 min ago

    const events = await Event.find({
      status: 'active', // not yet marked completed (cleanup will catch completed ones too)
      date: { $gte: from, $lte: to },
      organizerEmail: { $exists: true, $ne: '' },
    }).select('title date location organizerName organizerEmail _id').lean();

    for (const event of events) {
      sendEventThankyou(event).catch(() => {});
    }
    if (events.length) console.log(`[email] Queued ${events.length} thank-you email(s)`);
  } catch (err) {
    console.error('[email] Thank-you scheduling error:', err.message);
  }
}

// ─── Blog soft-delete purge ───────────────────────────────────────────────────
// Posts are soft-deleted (deleted: true) by the admin CMS rather than hard-
// deleted, allowing accidental-delete recovery. After 30 days they serve no
// purpose and waste storage — purge them permanently.
async function cleanupDeletedBlogPosts() {
  try {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const result = await BlogPost.deleteMany({
      deleted:   true,
      updatedAt: { $lt: cutoff },
    });
    if (result.deletedCount > 0) {
      console.log(`[blog cleanup] Permanently removed ${result.deletedCount} soft-deleted post(s) older than 30 days`);
    }
  } catch (err) {
    console.error('[blog cleanup] Error:', err.message);
  }
}

// ─── WL lead cleanup ──────────────────────────────────────────────────────────
// White-label leads that were converted (became active WL clients) or rejected
// more than 90 days ago are no longer useful. Leads that were never actioned
// are kept for 180 days then purged.
async function cleanupStaleWLLeads() {
  try {
    const now = new Date();

    // Converted / rejected leads older than 90 days
    const actioned = await WLLead.deleteMany({
      status:    { $in: ['converted', 'rejected', 'unsubscribed'] },
      updatedAt: { $lt: new Date(now - 90 * 24 * 60 * 60 * 1000) },
    });

    // Unactioned leads older than 180 days (went cold)
    const stale = await WLLead.deleteMany({
      status:    { $in: ['new', 'contacted', 'negotiating'] },
      createdAt: { $lt: new Date(now - 180 * 24 * 60 * 60 * 1000) },
    });

    const total = actioned.deletedCount + stale.deletedCount;
    if (total > 0) {
      console.log(`[wl-lead cleanup] Removed ${actioned.deletedCount} actioned lead(s), ${stale.deletedCount} stale lead(s)`);
    }
  } catch (err) {
    console.error('[wl-lead cleanup] Error:', err.message);
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
      await cleanupDeletedBlogPosts();
      await cleanupStaleWLLeads();
    });
  });

  // Email reminder job: runs hourly and checks which events start in ~REMINDER_HOURS
  // EMAIL_REMINDER_HOURS defaults to 24; set to 0 to disable reminders entirely
  const reminderHours = parseInt(process.env.EMAIL_REMINDER_HOURS || '24', 10);
  if (reminderHours > 0) {
    cron.schedule('0 * * * *', () => {
      withLock('reminder', scheduleReminderEmails).catch(() => {});
    });
    console.log(`  Reminder emails: ${reminderHours}h before each event (hourly check)`);
  }

  // Thank-you email job: runs every 30 minutes and sends to recently-ended events
  cron.schedule('*/30 * * * *', () => {
    withLock('thankyou', scheduleThankyouEmails).catch(() => {});
  });
  console.log('  Thank-you emails: sent ~30 min after event ends');

  // Also run on startup to catch events missed while the server was down/sleeping
  withLock('startup', async () => {
    await cleanupOldEvents();
    await cleanupUptimeData();
    await cleanupDeletedBlogPosts();
    await cleanupStaleWLLeads();
  });
}

// Manual cleanup function for admin use
async function manualCleanup() {
  console.log('Running manual cleanup...');
  await cleanupOldEvents();
}

// ─── Cloudinary orphan sweep ──────────────────────────────────────────────────
// Lists every asset in planit-covers and planit-files on Cloudinary, cross-
// references against live event IDs and File records in MongoDB, and destroys
// anything that has no matching DB record.
async function cleanupOrphanedCloudinaryAssets() {
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    return { skipped: true, reason: 'Cloudinary not configured', deleted: 0, failed: 0 };
  }

  const cloudinary = require('cloudinary').v2;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  console.log('[cloudinary-sweep] Starting orphan sweep...');

  // ── 1. Build known-good sets from MongoDB ───────────────────────────────
  // All live event IDs (for cover images: public_id = planit-covers/cover-{eventId})
  const allEventIds = new Set(
    (await Event.find({}, '_id').lean()).map(e => e._id.toString())
  );

  // All tracked Cloudinary public IDs from File records
  const knownFilePublicIds = new Set(
    (await File.find({}, 'cloudinaryPublicId').lean())
      .map(f => f.cloudinaryPublicId)
      .filter(Boolean)
  );

  console.log(`[cloudinary-sweep] ${allEventIds.size} live events, ${knownFilePublicIds.size} tracked file assets`);

  let deleted = 0;
  let failed  = 0;
  let scanned = 0;

  // ── Helper: paginate through a Cloudinary folder ────────────────────────
  async function sweepFolder(folder, isOrphan) {
    let nextCursor = null;
    do {
      const opts = { type: 'upload', prefix: folder + '/', max_results: 500, resource_type: 'image' };
      if (nextCursor) opts.next_cursor = nextCursor;

      let result;
      try {
        result = await cloudinary.api.resources(opts);
      } catch (err) {
        // Folder doesn't exist yet — nothing to sweep
        if (err?.error?.http_code === 404) break;
        throw err;
      }

      for (const asset of result.resources || []) {
        scanned++;
        if (isOrphan(asset.public_id)) {
          try {
            await cloudinary.uploader.destroy(asset.public_id, { resource_type: asset.resource_type || 'image' });
            console.log(`[cloudinary-sweep] Deleted orphan: ${asset.public_id}`);
            deleted++;
          } catch (err) {
            console.error(`[cloudinary-sweep] Failed to delete ${asset.public_id}:`, err.message);
            failed++;
          }
        }
      }

      nextCursor = result.next_cursor || null;
    } while (nextCursor);
  }

  // ── 2. Sweep planit-covers ───────────────────────────────────────────────
  // public_id format: planit-covers/cover-{eventId}
  await sweepFolder('planit-covers', (publicId) => {
    const match = publicId.match(/cover-([a-f0-9]{24})$/i);
    if (!match) return true; // unexpected format → orphan
    return !allEventIds.has(match[1]); // no matching event → orphan
  });

  // ── 3. Sweep planit-files (and any other image resource folders) ─────────
  // Cross-reference against known File public IDs
  await sweepFolder('planit-files', (publicId) => !knownFilePublicIds.has(publicId));

  // Also sweep raw and video resource types for planit-files
  async function sweepFolderRaw(folder) {
    for (const resourceType of ['raw', 'video']) {
      let nextCursor = null;
      do {
        const opts = { type: 'upload', prefix: folder + '/', max_results: 500, resource_type: resourceType };
        if (nextCursor) opts.next_cursor = nextCursor;
        let result;
        try { result = await cloudinary.api.resources(opts); }
        catch (err) { if (err?.error?.http_code === 404) break; throw err; }

        for (const asset of result.resources || []) {
          scanned++;
          if (!knownFilePublicIds.has(asset.public_id)) {
            try {
              await cloudinary.uploader.destroy(asset.public_id, { resource_type: resourceType });
              console.log(`[cloudinary-sweep] Deleted orphan (${resourceType}): ${asset.public_id}`);
              deleted++;
            } catch (err) {
              console.error(`[cloudinary-sweep] Failed to delete ${asset.public_id}:`, err.message);
              failed++;
            }
          }
        }
        nextCursor = result.next_cursor || null;
      } while (nextCursor);
    }
  }

  await sweepFolderRaw('planit-files');

  console.log(`[cloudinary-sweep] Done. Scanned: ${scanned}, Deleted: ${deleted}, Failed: ${failed}`);
  return { scanned, deleted, failed };
}

module.exports = {
  startCleanupScheduler,
  manualCleanup,
  cleanupOldEvents,
  cleanupOrphanedCloudinaryAssets,
  cleanupDeletedBlogPosts,
  cleanupStaleWLLeads,
};
