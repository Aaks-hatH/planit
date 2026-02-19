const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Invite = require('../models/Invite');
const Event = require('../models/Event');
const EventParticipant = require('../models/EventParticipant');
const { verifyEventAccess, verifyOrganizer } = require('../middleware/auth');
const { secrets } = require('../keys');
const {
  detectDuplicates,
  preventReentrancy,
  detectSuspiciousPatterns,
  enforceBlocks,
  enforceTimeWindow,
  enforceCapacity,
  auditLog,
} = require('../middleware/antifraud');

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MANAGER OVERRIDE SYSTEM
 * Complete implementation with authentication, tokens, and audit trails
 * ═══════════════════════════════════════════════════════════════════════════
 */

/**
 * STEP 1: Request Manager Override
 * Manager authenticates and receives a temporary override token
 */
router.post('/:eventId/request-override',
  verifyEventAccess,
  async (req, res, next) => {
    try {
      const { eventId } = req.params;
      const { managerUsername, managerPassword, inviteCode, reason } = req.body;

      // Validate inputs
      if (!managerUsername || !managerPassword) {
        return res.status(400).json({ 
          error: 'Manager credentials required',
          field: 'credentials'
        });
      }

      if (!inviteCode || !reason || reason.trim().length < 10) {
        return res.status(400).json({ 
          error: 'Invite code and detailed reason (min 10 characters) required',
          field: 'reason'
        });
      }

      // Verify event settings allow manual override
      const event = await Event.findById(eventId).select('checkinSettings').lean();
      const settings = event?.checkinSettings || {};
      
      if (!settings.allowManualOverride) {
        return res.status(403).json({ 
          error: 'Manual overrides are not enabled for this event',
          message: 'Contact event organizer to enable override capability'
        });
      }

      // Find the manager's participant record
      const manager = await EventParticipant.findOne({ 
        eventId, 
        username: managerUsername 
      }).select('+password');

      // Verify manager exists
      if (!manager) {
        // Don't reveal whether user exists for security
        return res.status(401).json({ 
          error: 'Invalid manager credentials',
          field: 'credentials'
        });
      }

      // Verify manager has override permissions (organizer role)
      if (manager.role !== 'organizer') {
        return res.status(403).json({ 
          error: 'Insufficient permissions. Only organizers can override security blocks.',
          field: 'permissions'
        });
      }

      // Verify manager has password set
      if (!manager.password || !manager.hasPassword) {
        return res.status(401).json({ 
          error: 'Manager account requires password. Please set up password first.',
          field: 'password_required'
        });
      }

      // Verify password
      const passwordValid = await bcrypt.compare(managerPassword, manager.password);
      if (!passwordValid) {
        // Log failed authentication attempt
        console.log(`[SECURITY] Failed override attempt by ${managerUsername} for ${inviteCode}`);
        
        return res.status(401).json({ 
          error: 'Invalid manager credentials',
          field: 'credentials'
        });
      }

      // Find the invite being overridden
      const invite = await Invite.findOne({ 
        inviteCode: inviteCode.toUpperCase().trim(), 
        eventId 
      });

      if (!invite) {
        return res.status(404).json({ 
          error: 'Invite not found',
          field: 'inviteCode'
        });
      }

      // Generate override token (JWT with 5 minute expiry)
      const overrideToken = jwt.sign(
        {
          eventId,
          inviteCode: inviteCode.toUpperCase().trim(),
          managerUsername,
          reason: reason.trim(),
          type: 'override',
          guestName: invite.guestName,
          blockedReason: invite.blockedReason || 'security_flag',
        },
        secrets.jwt,
        { expiresIn: '5m' } // Token expires in 5 minutes
      );

      // Log the override request in invite's scan attempts
      invite.scanAttempts.push({
        reason: 'override_requested',
        attemptedBy: managerUsername,
        ipAddress: req.ip || req.connection.remoteAddress || '',
        deviceInfo: `Override request: ${reason.substring(0, 100)}`,
      });
      await invite.save();

      // Log to console for audit
      console.log(`[OVERRIDE] Authorized by ${managerUsername} for invite ${inviteCode} - Reason: ${reason}`);

      res.json({
        success: true,
        overrideToken,
        expiresIn: 300, // 5 minutes in seconds
        expiresAt: new Date(Date.now() + 300000).toISOString(),
        message: 'Override authorized by ' + managerUsername,
        managerUsername,
        guestName: invite.guestName,
        originalBlockReason: invite.blockedReason,
      });

    } catch (error) {
      console.error('[OVERRIDE] Request error:', error);
      next(error);
    }
  }
);

/**
 * STEP 2: Verify Override Token (Optional - for UI validation)
 * Validates that the override token is legitimate
 */
router.post('/:eventId/verify-override-token',
  verifyEventAccess,
  async (req, res, next) => {
    try {
      const { eventId } = req.params;
      const { overrideToken, inviteCode } = req.body;

      if (!overrideToken) {
        return res.status(400).json({ error: 'Override token required' });
      }

      // Verify JWT token
      let decoded;
      try {
        decoded = jwt.verify(overrideToken, secrets.jwt);
      } catch (err) {
        if (err.name === 'TokenExpiredError') {
          return res.status(401).json({ 
            valid: false,
            error: 'Override token expired',
            message: 'Token expired. Please request a new override authorization.'
          });
        }
        return res.status(401).json({ 
          valid: false,
          error: 'Invalid override token',
          message: 'Invalid authorization token.'
        });
      }

      // Verify token matches request
      if (decoded.eventId !== eventId) {
        return res.status(403).json({ 
          valid: false,
          error: 'Override token for wrong event' 
        });
      }

      if (inviteCode && decoded.inviteCode !== inviteCode.toUpperCase().trim()) {
        return res.status(403).json({ 
          valid: false,
          error: 'Override token for different invite' 
        });
      }

      if (decoded.type !== 'override') {
        return res.status(403).json({ 
          valid: false,
          error: 'Invalid token type' 
        });
      }

      res.json({
        valid: true,
        managerUsername: decoded.managerUsername,
        reason: decoded.reason,
        guestName: decoded.guestName,
        expiresAt: new Date(decoded.exp * 1000).toISOString(),
        timeRemaining: Math.max(0, decoded.exp - Math.floor(Date.now() / 1000)),
      });

    } catch (error) {
      next(error);
    }
  }
);

/**
 * STEP 3: Execute Check-in with Override
 * Commits the check-in using the override token
 */
router.post('/:eventId/checkin-with-override/:inviteCode',
  verifyEventAccess,
  preventReentrancy,
  enforceCapacity, // Still enforce capacity even with override
  async (req, res, next) => {
    try {
      const { eventId, inviteCode } = req.params;
      const { overrideToken, actualAttendees } = req.body;
      const ip = req.ip || req.connection.remoteAddress || '';
      const staffUser = req.eventAccess?.username || 'staff';

      // Validate override token
      if (!overrideToken) {
        return res.status(400).json({ 
          error: 'Override token required' 
        });
      }

      // Verify JWT token
      let decoded;
      try {
        decoded = jwt.verify(overrideToken, secrets.jwt);
      } catch (err) {
        if (err.name === 'TokenExpiredError') {
          return res.status(401).json({ 
            error: 'Override token expired',
            message: 'Authorization expired. Please request a new override.'
          });
        }
        return res.status(401).json({ 
          error: 'Invalid override token' 
        });
      }

      // Verify token matches this request
      if (decoded.eventId !== eventId || 
          decoded.inviteCode !== inviteCode.toUpperCase().trim() ||
          decoded.type !== 'override') {
        return res.status(403).json({ 
          error: 'Override token mismatch',
          message: 'Token does not match this check-in request.'
        });
      }

      // Find and lock the invite
      const invite = await Invite.findOne({ 
        inviteCode: inviteCode.toUpperCase().trim() 
      });
      
      if (!invite) {
        return res.status(404).json({ error: 'Invite not found' });
      }

      // Verify event ownership
      if (invite.eventId.toString() !== eventId) {
        return res.status(403).json({ 
          error: 'Cross-event ticket',
          message: 'This ticket belongs to a different event. Override denied.'
        });
      }

      // Check if already checked in (override can't undo check-ins)
      if (invite.checkedIn) {
        return res.status(400).json({
          error: 'Already checked in',
          message: 'This ticket was already used. Override cannot reverse check-ins.',
          checkedInAt: invite.checkedInAt,
          checkedInBy: invite.checkedInBy,
        });
      }

      const event = await Event.findById(eventId).select('checkinSettings').lean();
      const settings = event?.checkinSettings || {};

      // Verify overrides are allowed (double-check)
      if (!settings.allowManualOverride) {
        return res.status(403).json({ 
          error: 'Overrides not enabled',
          message: 'Manual overrides have been disabled for this event.'
        });
      }

      // ═══ EXECUTE CHECK-IN WITH OVERRIDE ═══
      const checkInTime = new Date();
      
      invite.checkedIn = true;
      invite.checkedInAt = checkInTime;
      invite.checkedInBy = staffUser;
      invite.status = 'checked-in';
      invite.actualAttendees = (actualAttendees !== undefined && actualAttendees !== null)
        ? parseInt(actualAttendees)
        : (invite.adults + invite.children) || invite.groupSize;

      // Clear blocks (override clears all blocks)
      const wasBlocked = invite.isBlocked;
      const originalBlockReason = invite.blockedReason;
      
      invite.isBlocked = false;
      invite.blockedUntil = null;
      invite.blockedReason = null;
      invite.blockedAt = null;
      invite.blockedBy = null;

      // Add to check-in history with override flag
      invite.checkInHistory.push({
        checkedInAt: checkInTime,
        checkedInBy: staffUser,
        actualAttendees: invite.actualAttendees,
        overrideUsed: true,
        overrideBy: decoded.managerUsername,
        overrideReason: decoded.reason,
        originalBlockReason: originalBlockReason,
      });

      // Add security flag documenting the override
      await invite.addSecurityFlag(
        'manual_override_used', 
        'high', 
        `Override by ${decoded.managerUsername}: ${decoded.reason}. Original issue: ${originalBlockReason || 'security warnings'}`
      );

      // Log override in scan attempts
      invite.scanAttempts.push({
        reason: 'override_executed',
        attemptedBy: decoded.managerUsername + ' (via ' + staffUser + ')',
        ipAddress: ip,
        deviceInfo: `Override executed: ${decoded.reason.substring(0, 100)}`,
      });

      await invite.save();

      // Log to console for audit
      console.log(`[OVERRIDE] EXECUTED - Manager: ${decoded.managerUsername}, Staff: ${staffUser}, Invite: ${inviteCode}, Guest: ${invite.guestName}, Reason: ${decoded.reason}`);

      // Real-time notification with override flag
      const io = req.app.get('io');
      if (io) {
        io.to(`event_${eventId}`).emit('guest_checked_in', {
          inviteCode: invite.inviteCode,
          guestName: invite.guestName,
          adults: invite.adults,
          children: invite.children,
          actualAttendees: invite.actualAttendees,
          checkedInAt: invite.checkedInAt,
          checkedInBy: staffUser,
          overrideUsed: true,
          overrideBy: decoded.managerUsername,
          wasBlocked,
        });
      }

      // Success response
      res.json({
        success: true,
        message: 'Guest checked in successfully with manager override',
        invite: {
          id: invite._id,
          inviteCode: invite.inviteCode,
          guestName: invite.guestName,
          adults: invite.adults,
          children: invite.children,
          groupSize: invite.groupSize,
          actualAttendees: invite.actualAttendees,
          checkedInAt: invite.checkedInAt,
          checkedInBy: staffUser,
          notes: invite.notes,
        },
        override: {
          used: true,
          authorizedBy: decoded.managerUsername,
          reason: decoded.reason,
          executedBy: staffUser,
          wasBlocked,
          originalBlockReason,
        }
      });
      
    } catch (error) {
      console.error('[OVERRIDE] Execution error:', error);
      next(error);
    }
  }
);

/**
 * Get Override History for Event
 * Returns all check-ins that used manager override
 */
router.get('/:eventId/override-history',
  verifyOrganizer,
  async (req, res, next) => {
    try {
      const { eventId } = req.params;
      
      // Find all invites with override history
      const invites = await Invite.find({ 
        eventId,
        'checkInHistory.overrideUsed': true
      }).select('inviteCode guestName checkInHistory securityFlags');

      const overrideHistory = [];

      for (const invite of invites) {
        const overrideCheckIns = invite.checkInHistory.filter(h => h.overrideUsed);
        
        for (const checkIn of overrideCheckIns) {
          overrideHistory.push({
            inviteCode: invite.inviteCode,
            guestName: invite.guestName,
            checkedInAt: checkIn.checkedInAt,
            checkedInBy: checkIn.checkedInBy,
            overrideBy: checkIn.overrideBy,
            overrideReason: checkIn.overrideReason,
            originalBlockReason: checkIn.originalBlockReason,
            actualAttendees: checkIn.actualAttendees,
          });
        }
      }

      // Sort by most recent first
      overrideHistory.sort((a, b) => 
        new Date(b.checkedInAt) - new Date(a.checkedInAt)
      );

      res.json({
        total: overrideHistory.length,
        overrides: overrideHistory,
      });

    } catch (error) {
      next(error);
    }
  }
);

module.exports = router;
