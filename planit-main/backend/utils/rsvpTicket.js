'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// RSVP → ticket (enterprise events)
//
// When an enterprise event has rsvpPage.issueTicket switched on, every
// confirmed "Attending" RSVP gets a real ticket: an Invite document (the same
// thing organizers create by hand) with a QR code that the enterprise check-in
// door already understands. Guests open it at /invite/:inviteCode.
//
// syncTicket() is the single place that decides what a submission's ticket
// should look like, so it is safe to call after ANY change to a submission
// (new RSVP, approval, edit, decline, delete). It never throws into the RSVP
// flow: a ticket problem must never stop a guest from RSVPing.
// ─────────────────────────────────────────────────────────────────────────────

const crypto = require('crypto');
const Invite = require('../models/Invite');
const RSVPSubmission = require('../models/RSVPSubmission');

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'; // same format as organizer-made invites
const code8 = () => Array.from({ length: 8 }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join('');

async function uniqueCode() {
  for (let i = 0; i < 6; i += 1) {
    const c = code8();
    // eslint-disable-next-line no-await-in-loop
    if (!(await Invite.exists({ inviteCode: c }))) return c;
  }
  throw new Error('Could not generate a unique ticket code.');
}

/** Tickets only exist on enterprise events with the option turned on. */
function ticketsEnabled(event) {
  return !!(event && event.isEnterpriseMode && event.rsvpPage && event.rsvpPage.issueTicket === true);
}

/** A submission earns a ticket when it is a confirmed, undeleted "Attending". */
function earnsTicket(submission) {
  return submission.response === 'yes' && submission.status === 'confirmed' && !submission.deletedAt;
}

const ticketUrlFor = (code) => {
  const base = (process.env.FRONTEND_URL || '').split(',')[0].trim().replace(/\/$/, '');
  return code ? `${base}/invite/${code}` : null;
};

/**
 * Bring a submission's ticket in line with its current state.
 *  - eligible + no ticket  → create one
 *  - eligible + has ticket → refresh name / contact / party size, re-open if it was cancelled
 *  - not eligible + ticket → cancel it (blocked), unless the guest already checked in
 * Returns the ticket code if the guest should have a working ticket, else null.
 */
async function syncTicket(event, submission) {
  try {
    if (!ticketsEnabled(event)) return null;
    const eligible = earnsTicket(submission);
    const plusOnes = Math.max(0, Number(submission.plusOnes) || 0);
    const guestName = [submission.firstName, submission.lastName].filter(Boolean).join(' ').trim() || 'Guest';

    if (submission.inviteCode) {
      const invite = await Invite.findOne({ inviteCode: submission.inviteCode, eventId: event._id });
      if (!invite) {
        // Ticket was deleted by an organizer — forget it so a new one can be issued if still eligible.
        await RSVPSubmission.updateOne({ _id: submission._id }, { $set: { inviteCode: '', inviteId: null } });
        submission.inviteCode = '';
        return eligible ? syncTicket(event, submission) : null;
      }
      if (eligible) {
        if (!invite.checkedIn) {
          invite.guestName = guestName;
          invite.guestEmail = submission.email || '';
          invite.guestPhone = submission.phone || '';
          invite.adults = 1 + plusOnes;
          invite.groupSize = 1 + plusOnes;
          invite.plusOnes = plusOnes;
        }
        if (invite.isBlocked && invite.blockedReason === 'RSVP cancelled') {
          invite.isBlocked = false; invite.blockedReason = undefined; invite.blockedAt = undefined;
          invite.status = 'confirmed';
        }
        await invite.save();
        return invite.inviteCode;
      }
      if (!invite.checkedIn && !invite.isBlocked) {
        invite.isBlocked = true;
        invite.blockedReason = 'RSVP cancelled';
        invite.blockedAt = new Date();
        invite.blockedBy = 'rsvp-sync';
        invite.status = 'blocked';
        await invite.save();
      }
      return null;
    }

    if (!eligible) return null;

    const invite = await Invite.create({
      eventId: event._id,
      inviteCode: await uniqueCode(),
      guestName,
      guestEmail: submission.email || '',
      guestPhone: submission.phone || '',
      guestRole: 'GUEST',
      adults: 1 + plusOnes,
      children: 0,
      groupSize: 1 + plusOnes,
      plusOnes,
      tableId: submission.selectedTableId || null,
      tableLabel: submission.selectedTableLabel || null,
      status: 'confirmed',
      notes: 'Ticket issued from RSVP',
    });
    await RSVPSubmission.updateOne(
      { _id: submission._id },
      { $set: { inviteCode: invite.inviteCode, inviteId: invite._id } }
    );
    submission.inviteCode = invite.inviteCode;
    submission.inviteId = invite._id;
    return invite.inviteCode;
  } catch (err) {
    console.error('[rsvpTicket] syncTicket failed:', err.message);
    return null;
  }
}

/** Give tickets to everyone who already RSVP'd before the option was switched on. */
async function backfillTickets(event, limit = 2000) {
  const subs = await RSVPSubmission.find({
    eventId: event._id, response: 'yes', status: 'confirmed', deletedAt: null,
    $or: [{ inviteCode: '' }, { inviteCode: { $exists: false } }],
  }).limit(limit);
  let issued = 0;
  for (const sub of subs) {
    // eslint-disable-next-line no-await-in-loop
    if (await syncTicket(event, sub)) issued += 1;
  }
  return issued;
}

module.exports = { ticketsEnabled, earnsTicket, syncTicket, backfillTickets, ticketUrlFor };
