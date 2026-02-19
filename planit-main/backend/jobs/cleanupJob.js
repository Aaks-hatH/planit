const cron = require('node-cron');
const Event = require('../models/Event');
const Message = require('../models/Message');
const Poll = require('../models/Poll');
const File = require('../models/File');
const EventParticipant = require('../models/EventParticipant');
const Invite = require('../models/Invite');

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
    cleanupOldEvents();
  });

  // Also run on startup to catch events missed while the server was down/sleeping
  cleanupOldEvents();
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
