const Invite = require('../models/Invite');
const Event = require('../models/Event');

/**
 * ANTI-FRAUD MIDDLEWARE SUITE
 * Comprehensive security checks for enterprise check-in system
 */

/**
 * Duplicate Detection Middleware
 * Detects potential duplicate invites based on guest information
 */
async function detectDuplicates(req, res, next) {
  try {
    const { eventId, inviteCode } = req.params;
    const invite = await Invite.findOne({ inviteCode: inviteCode.toUpperCase().trim(), eventId });
    
    if (!invite) return next();
    
    const event = await Event.findById(eventId).select('checkinSettings').lean();
    const settings = event?.checkinSettings || {};
    
    // Skip if duplicate detection is disabled
    if (!settings.enableDuplicateDetection) return next();
    
    // Skip if already checked in
    if (invite.checkedIn) return next();
    
    // Generate fingerprint for this invite
    const fingerprint = invite.generateDuplicateFingerprint();
    if (!fingerprint) return next(); // Not enough info to check
    
    // Look for other invites with same fingerprint
    const duplicates = await Invite.find({
      eventId,
      duplicateCheckFingerprint: fingerprint,
      _id: { $ne: invite._id },
    }).select('inviteCode guestName checkedIn checkedInAt');
    
    if (duplicates.length === 0) return next();
    
    // Found potential duplicates
    const checkedInDuplicate = duplicates.find(d => d.checkedIn);
    
    if (checkedInDuplicate) {
      // Another invite with same identity already checked in
      if (!settings.allowMultipleTickets) {
        invite.markedAsDuplicate = true;
        invite.duplicateOf = checkedInDuplicate._id;
        await invite.addSecurityFlag('duplicate_detected', 'high', 
          `Matches already checked-in guest: ${checkedInDuplicate.inviteCode}`);
        
        if (settings.autoBlockDuplicates) {
          invite.isBlocked = true;
          invite.blockedReason = 'duplicate_detected';
          invite.blockedAt = new Date();
          await invite.save();
          
          return res.status(403).json({
            valid: false,
            reason: 'duplicate_blocked',
            severity: 'critical',
            message: 'DUPLICATE DETECTED - Same person already checked in',
            inviteCode: invite.inviteCode,
            guestName: invite.guestName,
            groupSize: invite.groupSize,
            duplicateInviteCode: checkedInDuplicate.inviteCode,
            checkedInAt: checkedInDuplicate.checkedInAt,
            requiresOverride: true,
          });
        }
        
        // Warn but allow with manual approval
        req.securityWarnings = req.securityWarnings || [];
        req.securityWarnings.push({
          type: 'duplicate_warning',
          severity: 'high',
          message: 'DUPLICATE DETECTED - Same person already checked in',
          duplicateInviteCode: checkedInDuplicate.inviteCode,
          checkedInAt: checkedInDuplicate.checkedInAt,
        });
        
        await invite.save();
      }
    } else {
      // Multiple pending invites for same person
      req.securityWarnings = req.securityWarnings || [];
      req.securityWarnings.push({
        type: 'multiple_invites',
        severity: 'medium',
        message: `Guest has ${duplicates.length + 1} invite(s) for this event`,
        inviteCodes: [invite.inviteCode, ...duplicates.map(d => d.inviteCode)],
      });
    }
    
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Reentrancy Protection Middleware
 * Prevents simultaneous check-in attempts for the same invite
 */
async function preventReentrancy(req, res, next) {
  try {
    const { eventId, inviteCode } = req.params;
    const sessionId = req.headers['x-session-id'] || req.sessionID || `${Date.now()}-${Math.random()}`;
    const staffUser = req.eventAccess?.username || 'staff';
    
    const invite = await Invite.findOne({ inviteCode: inviteCode.toUpperCase().trim(), eventId });
    if (!invite) return next();
    
    const event = await Event.findById(eventId).select('checkinSettings').lean();
    const settings = event?.checkinSettings || {};
    
    // Skip if reentrancy protection disabled
    if (!settings.enableReentrancyProtection) return next();
    
    // Try to acquire lock
    const lockAcquired = await invite.acquireCheckInLock(staffUser, sessionId);
    
    if (!lockAcquired) {
      return res.status(409).json({
        valid: false,
        reason: 'concurrent_checkin',
        severity: 'high',
        message: 'Another check-in is in progress for this ticket',
        lockedBy: invite.checkInLock.lockedBy,
        lockedAt: invite.checkInLock.lockedAt,
      });
    }
    
    // Store session ID for cleanup
    req.checkInSessionId = sessionId;
    req.checkInInvite = invite;
    
    // Ensure lock is released on response
    const originalSend = res.send;
    res.send = function(...args) {
      if (invite && invite.checkInLock.sessionId === sessionId) {
        invite.releaseCheckInLock().catch(console.error);
      }
      originalSend.apply(res, args);
    };
    
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Rate Limiting & Suspicious Pattern Detection
 * Detects rapid scans, multiple devices, and other suspicious patterns
 */
async function detectSuspiciousPatterns(req, res, next) {
  try {
    const { eventId, inviteCode } = req.params;
    const ip = req.ip || req.connection.remoteAddress || '';
    const deviceInfo = req.headers['user-agent'] || '';
    
    const invite = await Invite.findOne({ inviteCode: inviteCode.toUpperCase().trim(), eventId });
    if (!invite) return next();
    
    const event = await Event.findById(eventId).select('checkinSettings').lean();
    const settings = event?.checkinSettings || {};
    
    // Skip if pattern detection disabled
    if (!settings.enablePatternDetection) return next();
    
    const now = Date.now();
    const recentAttempts = invite.scanAttempts.filter(attempt => {
      const attemptTime = new Date(attempt.attemptedAt).getTime();
      return now - attemptTime < (settings.rapidScanWindowSeconds || 10) * 1000;
    });
    
    // Check for rapid scanning
    if (recentAttempts.length >= (settings.rapidScanThreshold || 3)) {
      await invite.addSecurityFlag('rapid_scans', 'high', 
        `${recentAttempts.length} scans in ${settings.rapidScanWindowSeconds}s`);
      
      req.securityWarnings = req.securityWarnings || [];
      req.securityWarnings.push({
        type: 'rapid_scanning',
        severity: 'high',
        message: `SUSPICIOUS: ${recentAttempts.length} scans in ${settings.rapidScanWindowSeconds} seconds`,
        attempts: recentAttempts.length,
      });
    }
    
    // Check for multiple devices/IPs
    const uniqueIPs = new Set(invite.scanAttempts.map(a => a.ipAddress).filter(Boolean));
    const uniqueDevices = new Set(invite.scanAttempts.map(a => a.deviceInfo).filter(Boolean));
    
    if (uniqueIPs.size >= (settings.multiDeviceThreshold || 3)) {
      await invite.addSecurityFlag('multiple_devices', 'medium', 
        `Scanned from ${uniqueIPs.size} different IPs`);
      
      req.securityWarnings = req.securityWarnings || [];
      req.securityWarnings.push({
        type: 'multiple_devices',
        severity: 'medium',
        message: `Ticket scanned from ${uniqueIPs.size} different locations`,
        ipCount: uniqueIPs.size,
      });
    }
    
    // Update last scan metadata
    invite.lastScanMetadata = {
      scannedAt: new Date(),
      ipAddress: ip,
      deviceInfo,
    };
    await invite.save();
    
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Block Check Middleware
 * Enforces blocks and lockouts
 */
async function enforceBlocks(req, res, next) {
  try {
    const { eventId, inviteCode } = req.params;
    const invite = await Invite.findOne({ inviteCode: inviteCode.toUpperCase().trim(), eventId });
    
    if (!invite) return next();
    
    const event = await Event.findById(eventId).select('checkinSettings').lean();
    const settings = event?.checkinSettings || {};
    
    // Check emergency lockdown
    if (settings.emergencyLockdown) {
      return res.status(403).json({
        valid: false,
        reason: 'emergency_lockdown',
        severity: 'critical',
        message: 'EMERGENCY LOCKDOWN - All check-ins suspended',
        lockdownReason: settings.emergencyLockdownReason,
        lockdownAt: settings.emergencyLockdownAt,
      });
    }
    
    // Check if invite is blocked
    if (invite.isBlocked) {
      // Check if it's a temporary block that has expired
      if (invite.blockedUntil && new Date() > invite.blockedUntil) {
        invite.isBlocked = false;
        invite.blockedUntil = null;
        invite.blockedReason = null;
        await invite.save();
      } else {
        return res.status(403).json({
          valid: false,
          reason: 'blocked',
          severity: 'critical',
          message: 'TICKET BLOCKED - Access denied',
          inviteCode: invite.inviteCode,
          guestName: invite.guestName,
          groupSize: invite.groupSize,
          blockedReason: invite.blockedReason,
          blockedAt: invite.blockedAt,
          blockedBy: invite.blockedBy,
          blockedUntil: invite.blockedUntil,
          requiresOverride: settings.allowManualOverride,
        });
      }
    }
    
    // Check trust score
    if (settings.enableTrustScore) {
      const trustScore = invite.calculateTrustScore();
      
      if (trustScore < settings.minimumTrustScore) {
        if (settings.autoBlockLowTrust) {
          invite.isBlocked = true;
          invite.blockedReason = 'low_trust_score';
          invite.blockedAt = new Date();
          await invite.save();
          
          return res.status(403).json({
            valid: false,
            reason: 'low_trust_score',
            severity: 'high',
            message: 'LOW TRUST SCORE - Manual approval required',
            inviteCode: invite.inviteCode,
            guestName: invite.guestName,
            groupSize: invite.groupSize,
            trustScore,
            minimumRequired: settings.minimumTrustScore,
            requiresOverride: true,
          });
        }
        
        req.securityWarnings = req.securityWarnings || [];
        req.securityWarnings.push({
          type: 'low_trust_score',
          severity: 'high',
          message: `Low trust score: ${trustScore}/${settings.minimumTrustScore}`,
          trustScore,
        });
      }
    }
    
    // Check failed PIN attempts
    const pinAttempts = invite.scanAttempts.filter(a => a.reason === 'wrong_pin').length;
    if (pinAttempts >= settings.maxFailedAttempts) {
      // Calculate lockout expiry
      const lastPinAttempt = invite.scanAttempts
        .filter(a => a.reason === 'wrong_pin')
        .sort((a, b) => new Date(b.attemptedAt) - new Date(a.attemptedAt))[0];
      
      const lockoutExpiry = new Date(lastPinAttempt.attemptedAt);
      lockoutExpiry.setMinutes(lockoutExpiry.getMinutes() + (settings.lockoutMinutes || 15));
      
      if (new Date() < lockoutExpiry) {
        return res.status(403).json({
          valid: false,
          reason: 'pin_locked',
          severity: 'high',
          message: 'TOO MANY FAILED PIN ATTEMPTS - Temporarily locked',
          inviteCode: invite.inviteCode,
          guestName: invite.guestName,
          groupSize: invite.groupSize,
          lockedUntil: lockoutExpiry,
          attemptsRemaining: 0,
          requiresOverride: settings.allowManualOverride,
        });
      }
    }
    
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Time Window Enforcement
 * Ensures check-ins only happen within allowed time window
 */
async function enforceTimeWindow(req, res, next) {
  try {
    const { eventId } = req.params;
    const event = await Event.findById(eventId).select('checkinSettings date').lean();
    const settings = event?.checkinSettings || {};
    
    if (!settings.enableTimeRestrictions) return next();
    
    const now = new Date();
    const eventDate = new Date(event.date);
    
    // Calculate time window
    const windowStartTime = new Date(eventDate);
    windowStartTime.setMinutes(windowStartTime.getMinutes() - (settings.checkInWindowStart || 120));
    
    const windowEndTime = new Date(eventDate);
    windowEndTime.setMinutes(windowEndTime.getMinutes() + (settings.checkInWindowEnd || 30));
    
    if (now < windowStartTime) {
      return res.status(403).json({
        valid: false,
        reason: 'too_early',
        severity: 'medium',
        message: 'Check-in not yet open',
        opensAt: windowStartTime,
      });
    }
    
    if (now > windowEndTime && !settings.allowLateCheckIn) {
      return res.status(403).json({
        valid: false,
        reason: 'too_late',
        severity: 'medium',
        message: 'Check-in window closed',
        closedAt: windowEndTime,
      });
    }
    
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Capacity Enforcement
 * Prevents over-capacity check-ins
 */
async function enforceCapacity(req, res, next) {
  try {
    const { eventId } = req.params;
    const event = await Event.findById(eventId).select('checkinSettings').lean();
    const settings = event?.checkinSettings || {};
    
    if (!settings.enableCapacityLimits || !settings.maxTotalAttendees) return next();
    
    // Count current checked-in attendees
    const checkedInInvites = await Invite.find({ eventId, checkedIn: true });
    const currentAttendees = checkedInInvites.reduce((sum, inv) => sum + (inv.actualAttendees || 0), 0);
    
    if (currentAttendees >= settings.maxTotalAttendees) {
      return res.status(403).json({
        valid: false,
        reason: 'capacity_reached',
        severity: 'high',
        message: 'VENUE AT CAPACITY - No more check-ins allowed',
        currentCapacity: currentAttendees,
        maxCapacity: settings.maxTotalAttendees,
      });
    }
    
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Audit Logging Middleware
 * Logs all scan attempts with detailed information
 */
async function auditLog(req, res, next) {
  try {
    const { eventId, inviteCode } = req.params;
    const ip = req.ip || req.connection.remoteAddress || '';
    const deviceInfo = req.headers['user-agent'] || '';
    const staffUser = req.eventAccess?.username || 'staff';
    
    const event = await Event.findById(eventId).select('checkinSettings').lean();
    const settings = event?.checkinSettings || {};
    
    if (!settings.detailedAuditLogging) return next();
    
    // Store audit info for later logging (after verification result)
    req.auditInfo = {
      eventId,
      inviteCode: inviteCode.toUpperCase().trim(),
      ip: settings.logIPAddresses ? ip : null,
      deviceInfo: settings.logDeviceInfo ? deviceInfo : null,
      staffUser,
      timestamp: new Date(),
    };
    
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  detectDuplicates,
  preventReentrancy,
  detectSuspiciousPatterns,
  enforceBlocks,
  enforceTimeWindow,
  enforceCapacity,
  auditLog,
};
