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

    // Calculate date 7 days ago
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Find events that occurred more than 7 days ago
    const oldEvents = await Event.find({
      date: { $lt: sevenDaysAgo },
      status: { $ne: 'cancelled' } // Don't count cancelled events
    });

    console.log(`Found ${oldEvents.length} events older than 7 days`);

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
  console.log(' Will run daily at 2:00 AM');
  console.log('  Events are deleted 7 days after they occur');
  
  // Run at 2 AM every day: "0 2 * * *"
  cron.schedule('0 2 * * *', () => {
    cleanupOldEvents();
  });

  // Also run immediately on startup (optional - remove if you don't want this)
  // cleanupOldEvents();
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
