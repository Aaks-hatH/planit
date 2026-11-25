'use strict';

/**
 * joinTarget.js
 * ─────────────
 * Decides where a guest is sent when they click "RSVP" / "Join" on Discover,
 * the public event page, or a white-label home feed.
 *
 *   'rsvp'   → /rsvp/:slug  the guest-facing RSVP page. The default for almost
 *                           every event: /e/:slug (planning, check-in, admin
 *                           tools) stays for organizers and their team.
 *   'space'  → /e/:slug     the live event space (chat, polls, files, agenda).
 *                           For events where guests take part online. Chosen by
 *                           the organizer (landingPage.joinMode = 'space'), or
 *                           used as a safety net when a standard event never
 *                           turned its RSVP page on.
 *   'closed' → nowhere      RSVPs were deliberately closed, or an RSVP-only
 *                           event has no open RSVP page. Never fall back to the
 *                           organizer dashboard for these.
 *
 * Expects a lean event that was selected with: eventType, landingPage.joinMode,
 * rsvpPage.enabled, rsvpPage.accessMode.
 */
function resolveJoinTarget(ev) {
  const rsvpOnly = ev?.eventType === 'rsvpOnly';

  // Organizer explicitly chose the event space (not possible for RSVP-only events,
  // which have no guest-facing space — their /e/ page is the organizer dashboard).
  if (!rsvpOnly && ev?.landingPage?.joinMode === 'space') return 'space';

  if (ev?.rsvpPage?.enabled) {
    return ev.rsvpPage.accessMode === 'closed' ? 'closed' : 'rsvp';
  }
  // RSVP page never turned on: RSVP-only events have nothing to offer guests;
  // standard events keep working exactly as before via the event space.
  return rsvpOnly ? 'closed' : 'space';
}

// Fields a list/landing query must select for resolveJoinTarget to work.
const JOIN_TARGET_SELECT = 'eventType landingPage.joinMode rsvpPage.enabled rsvpPage.accessMode';

// Adds joinTarget and strips the raw inputs so nothing extra leaks to the public.
function withJoinTarget(ev) {
  return { ...ev, joinTarget: resolveJoinTarget(ev), rsvpPage: undefined, landingPage: undefined };
}

module.exports = { resolveJoinTarget, withJoinTarget, JOIN_TARGET_SELECT };
