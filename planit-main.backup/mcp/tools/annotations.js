/**
 * Tool annotations, keyed by tool name.
 *
 * The MCP spec defines four optional hints on every tool:
 *   - readOnlyHint:    tool never modifies its environment
 *   - destructiveHint: tool may perform destructive updates (only meaningful
 *                       when readOnlyHint is false)
 *   - idempotentHint:  calling the tool repeatedly with the same arguments
 *                       has no additional effect (only meaningful when
 *                       readOnlyHint is false)
 *   - openWorldHint:   tool interacts with an "open world" of external
 *                       entities (vs. a closed, fully-enumerable set)
 *
 * Every PlanIt tool proxies to the PlanIt backend, so openWorldHint is true
 * across the board. These annotations are merged into each tool's definition
 * by the transport's ListTools handler — they are hints for the client, not
 * guarantees enforced by the server, but the Connectors Directory review
 * checks that every tool has them set sensibly.
 */

const ANNOTATIONS = {
  // ── Connection ────────────────────────────────────────────────────────
  generate_connect_link: {
    title: 'Generate connection link',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  check_connection: {
    title: 'Check connection status',
    readOnlyHint: true,
    openWorldHint: true,
  },

  // ── Events ────────────────────────────────────────────────────────────
  create_event: {
    title: 'Create event',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  get_event: {
    title: 'Get event details',
    readOnlyHint: true,
    openWorldHint: true,
  },
  update_event: {
    title: 'Update event details',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  get_event_status: {
    title: 'Get live event status',
    readOnlyHint: true,
    openWorldHint: true,
  },

  // ── Guests ────────────────────────────────────────────────────────────
  add_guest: {
    title: 'Add guest',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  import_guests: {
    title: 'Bulk import guests',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  get_guest_list: {
    title: 'Get guest list',
    readOnlyHint: true,
    openWorldHint: true,
  },
  find_guest: {
    title: 'Find guest',
    readOnlyHint: true,
    openWorldHint: true,
  },
  update_guest: {
    title: 'Update guest',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  remove_guest: {
    title: 'Remove guest',
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: true,
  },
  get_checkin_stats: {
    title: 'Get check-in stats',
    readOnlyHint: true,
    openWorldHint: true,
  },

  // ── Seating ───────────────────────────────────────────────────────────
  create_table: {
    title: 'Create table',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  get_tables: {
    title: 'Get tables',
    readOnlyHint: true,
    openWorldHint: true,
  },
  assign_guest_to_table: {
    title: 'Assign guest to table',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  remove_guest_from_table: {
    title: 'Remove guest from table',
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: true,
  },
  get_seating_map: {
    title: 'Get seating map',
    readOnlyHint: true,
    openWorldHint: true,
  },
  suggest_seating: {
    title: 'Suggest seating arrangement',
    readOnlyHint: true,
    openWorldHint: true,
  },

  // ── Check-in / security ──────────────────────────────────────────────
  get_checkin_feed: {
    title: 'Get check-in feed',
    readOnlyHint: true,
    openWorldHint: true,
  },
  manual_checkin: {
    title: 'Check in guest',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  override_checkin: {
    title: 'Override check-in',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  get_security_alerts: {
    title: 'Get security alerts',
    readOnlyHint: true,
    openWorldHint: true,
  },

  // ── Announcements ─────────────────────────────────────────────────────
  send_announcement: {
    title: 'Send announcement',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  get_announcements: {
    title: 'Get announcements',
    readOnlyHint: true,
    openWorldHint: true,
  },

  // ── RSVP ──────────────────────────────────────────────────────────────
  get_rsvp_settings: {
    title: 'Get RSVP settings',
    readOnlyHint: true,
    openWorldHint: true,
  },
  update_rsvp_settings: {
    title: 'Update RSVP settings',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  get_rsvp_responses: {
    title: 'Get RSVP responses',
    readOnlyHint: true,
    openWorldHint: true,
  },

  // ── Table service ─────────────────────────────────────────────────────
  get_waitlist: {
    title: 'Get waitlist',
    readOnlyHint: true,
    openWorldHint: true,
  },
  add_to_waitlist: {
    title: 'Add to waitlist',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  seat_from_waitlist: {
    title: 'Seat from waitlist',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  get_table_occupancy: {
    title: 'Get table occupancy',
    readOnlyHint: true,
    openWorldHint: true,
  },
  update_table_status: {
    title: 'Update table status',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },

  // ── Budget / tasks / polls ────────────────────────────────────────────
  get_budget: {
    title: 'Get budget',
    readOnlyHint: true,
    openWorldHint: true,
  },
  update_budget: {
    title: 'Log expense',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  get_tasks: {
    title: 'Get tasks',
    readOnlyHint: true,
    openWorldHint: true,
  },
  add_task: {
    title: 'Add task',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  complete_task: {
    title: 'Complete task',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  create_poll: {
    title: 'Create poll',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  get_poll_results: {
    title: 'Get poll results',
    readOnlyHint: true,
    openWorldHint: true,
  },
};

module.exports = ANNOTATIONS;
