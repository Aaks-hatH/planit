const express = require('express');
const router = express.Router();
const Event = require('../models/Event');
const Message = require('../models/Message');
const Poll = require('../models/Poll');
const File = require('../models/File');
const EventParticipant = require('../models/EventParticipant');
const Invite = require('../models/Invite');
const { verifyEventAccess } = require('../middleware/auth');

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * DATA RETENTION API - 7 DAY DELETION WARNING
 * Shows warning in event space when data will be deleted
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * GET deletion warning info for event
 * Call this in EventSpace to show warning banner
 */
router.get('/:eventId/deletion-warning',
  verifyEventAccess,
  async (req, res, next) => {
    try {
      const event = await Event.findById(req.params.eventId)
        .select('title date createdAt');

      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      const eventDate = new Date(event.date);
      const now = new Date();
      
      // Calculate deletion date (7 days after event)
      const deletionDate = new Date(eventDate);
      deletionDate.setDate(deletionDate.getDate() + 7);
      
      // Calculate days until deletion
      const msUntilDeletion = deletionDate - now;
      const daysUntilDeletion = Math.ceil(msUntilDeletion / (1000 * 60 * 60 * 24));
      
      // Event is in the past
      const eventHasPassed = now > eventDate;
      
      // Show warning if event passed and less than 7 days until deletion
      const showWarning = eventHasPassed && daysUntilDeletion > 0 && daysUntilDeletion <= 7;
      
      // Event will be deleted (past deletion date)
      const willBeDeleted = daysUntilDeletion <= 0;

      res.json({
        eventTitle: event.title,
        eventDate: event.date,
        deletionDate: deletionDate,
        daysUntilDeletion: Math.max(0, daysUntilDeletion),
        showWarning,
        willBeDeleted,
        eventHasPassed,
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET complete data export (for downloading before deletion)
 * Returns all event data
 */
router.get('/:eventId/export-all-data',
  verifyEventAccess,
  async (req, res, next) => {
    try {
      const event = await Event.findById(req.params.eventId);
      
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      // Gather ALL data
      const [messages, polls, files, participants, invites] = await Promise.all([
        Message.find({ eventId: req.params.eventId }).lean(),
        Poll.find({ eventId: req.params.eventId }).lean(),
        File.find({ eventId: req.params.eventId }).lean(),
        EventParticipant.find({ eventId: req.params.eventId }).select('-password').lean(),
        Invite.find({ eventId: req.params.eventId }).lean(),
      ]);

      // Complete export package
      const exportData = {
        exportInfo: {
          exportedAt: new Date().toISOString(),
          exportedBy: req.eventAccess?.username || 'user',
          eventId: event._id.toString(),
          eventTitle: event.title,
        },
        
        // Full event data
        event: {
          _id: event._id,
          subdomain: event.subdomain,
          title: event.title,
          description: event.description,
          date: event.date,
          timezone: event.timezone,
          location: event.location,
          organizerName: event.organizerName,
          organizerEmail: event.organizerEmail,
          isEnterpriseMode: event.isEnterpriseMode,
          maxParticipants: event.maxParticipants,
          settings: event.settings,
          checkinSettings: event.checkinSettings,
          status: event.status,
          
          // Event features
          agenda: event.agenda || [],
          tasks: event.tasks || [],
          announcements: event.announcements || [],
          expenses: event.expenses || [],
          budget: event.budget,
          notes: event.notes || [],
          rsvps: event.rsvps || [],
          participants: event.participants || [],
          
          // Timestamps
          createdAt: event.createdAt,
          updatedAt: event.updatedAt,
        },
        
        // Statistics
        statistics: {
          totalMessages: messages.length,
          totalPolls: polls.length,
          totalFiles: files.length,
          totalParticipants: participants.length,
          totalInvites: invites.length,
          totalCheckIns: invites.filter(i => i.checkedIn).length,
        },
        
        // All messages
        messages: messages.map(m => ({
          _id: m._id,
          username: m.username,
          content: m.content,
          isSystemMessage: m.isSystemMessage,
          metadata: m.metadata,
          createdAt: m.createdAt,
          updatedAt: m.updatedAt,
        })),
        
        // All polls
        polls: polls.map(p => ({
          _id: p._id,
          question: p.question,
          options: p.options,
          createdBy: p.createdBy,
          votes: p.votes,
          allowMultiple: p.allowMultiple,
          anonymous: p.anonymous,
          closedAt: p.closedAt,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        })),
        
        // All files (URLs only, actual files stay in Cloudinary)
        files: files.map(f => ({
          _id: f._id,
          filename: f.filename,
          originalName: f.originalName,
          url: f.url,
          publicId: f.publicId,
          cloudinaryUrl: f.cloudinaryUrl,
          size: f.size,
          mimeType: f.mimeType,
          uploadedBy: f.uploadedBy,
          uploadedAt: f.uploadedAt,
          isDeleted: f.isDeleted,
        })),
        
        // All participants
        participants: participants.map(p => ({
          _id: p._id,
          username: p.username,
          role: p.role,
          hasPassword: p.hasPassword,
          joinedAt: p.joinedAt,
          lastSeenAt: p.lastSeenAt,
        })),
        
        // All invites (full check-in data)
        invites: invites.map(i => ({
          _id: i._id,
          inviteCode: i.inviteCode,
          guestName: i.guestName,
          guestEmail: i.guestEmail,
          guestPhone: i.guestPhone,
          adults: i.adults,
          children: i.children,
          groupSize: i.groupSize,
          actualAttendees: i.actualAttendees,
          plusOnes: i.plusOnes,
          securityPin: i.securityPin ? '***' : null, // Don't expose actual PIN
          checkedIn: i.checkedIn,
          checkedInAt: i.checkedInAt,
          checkedInBy: i.checkedInBy,
          status: i.status,
          notes: i.notes,
          
          // Security data
          scanAttempts: i.scanAttempts || [],
          isBlocked: i.isBlocked,
          blockedReason: i.blockedReason,
          blockedAt: i.blockedAt,
          blockedBy: i.blockedBy,
          trustScore: i.trustScore,
          markedAsDuplicate: i.markedAsDuplicate,
          securityFlags: i.securityFlags || [],
          checkInHistory: i.checkInHistory || [],
          
          createdAt: i.createdAt,
          updatedAt: i.updatedAt,
        })),
      };

      // Set headers for download
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `event-${event.title.replace(/[^a-z0-9]/gi, '-')}-${timestamp}.json`;
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      res.json(exportData);

    } catch (error) {
      console.error('Export error:', error);
      next(error);
    }
  }
);

module.exports = router;
