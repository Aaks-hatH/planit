const api = require('../client/api');

const tools = [
  {
    name: 'generate_connect_link',
    description:
      'Generate a one-time link for the user to connect their PlanIt event to this Claude session. ' +
      'Call this first if the user is not yet connected, or if they want to switch to a different event. ' +
      'Give the returned URL directly to the user and tell them to open it and enter their Event ID and Organiser Password.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    async execute(_params, sessionId) {
      const result = await api.initConnect(sessionId);
      if (result.error) return result;
      return {
        connectUrl: result.connectUrl,
        message:
          'Share this URL with the user: ' +
          result.connectUrl +
          '\nTell them: "Open that link, enter your Event ID and Organiser Password, then come back and let me know when you\'re done."',
      };
    },
  },

  {
    name: 'check_connection',
    description:
      'Check if Claude is currently connected to a PlanIt event. ' +
      'Call this at the start of any event management conversation before using any other tools. ' +
      'Returns whether the session is authenticated and, if so, the event name and ID.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    async execute(_params, sessionId) {
      return await api.checkSession(sessionId);
    },
  },

  {
    name: 'create_event',
    description:
      'Create a new PlanIt event — works with no prior session, since there\'s nothing to connect to yet. Have a natural ' +
      'conversation to gather the fields, infer whether it should be regular, enterprise, or table-service from the event needs, ' +
      'and include those mode flags. On success this session is automatically authenticated as the new event\'s organiser ' +
      '(check the returned "authenticated" flag), and the response includes a one-time recovery code plus password-reset URL ' +
      'that must be shown to the organiser and explained clearly. Only fall back to generate_connect_link if "authenticated" comes back false.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Event name / title' },
        date: { type: 'string', description: 'Event date in ISO 8601 format (YYYY-MM-DD)' },
        time: { type: 'string', description: 'Event start time in HH:MM (24h) format' },
        timezone: { type: 'string', description: 'IANA timezone string, e.g. America/New_York' },
        organizerName: { type: 'string', description: 'Full name of the event organiser' },
        organizerEmail: { type: 'string', description: 'Email address of the event organiser' },
        organizerPassword: {
          type: 'string',
          description: 'Organiser password (min 6 characters) — kept private, used to manage the event',
          minLength: 6,
        },
        eventPassword: {
          type: 'string',
          description: 'Password guests use to join the event page (optional)',
        },
        description: { type: 'string', description: 'Optional event description' },
        maxGuests: { type: 'number', description: 'Maximum number of guests allowed' },
        location: { type: 'string', description: 'Event venue or location string' },
        isEnterpriseMode: { type: 'boolean', description: 'Use for larger/operational events needing enterprise check-in, staff workflows, security, or higher scale' },
        isTableServiceMode: { type: 'boolean', description: 'Use for restaurant, hospitality, reservations, waitlist, or live floor/table service events' },
        staffPassword: { type: 'string', description: 'Optional staff password/PIN for table-service staff login; minimum 4 characters if provided' },
      },
      required: ['name', 'date', 'time', 'timezone', 'organizerName', 'organizerEmail', 'organizerPassword'],
    },
    async execute(params, sessionId) {
      return await api.action(sessionId, 'create_event', params);
    },
  },

  {
    name: 'get_event',
    description:
      'Get full details of the connected event including settings, guest count, date, location, and configuration. ' +
      'The event ID is taken from the authenticated session — no parameters needed.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    async execute(_params, sessionId) {
      return await api.action(sessionId, 'get_event', {});
    },
  },

  {
    name: 'update_event',
    description:
      'Update event details. Only include fields that should change — omit anything that should stay the same.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'New event name' },
        date: { type: 'string', description: 'New event date (ISO 8601)' },
        time: { type: 'string', description: 'New event time (HH:MM)' },
        timezone: { type: 'string', description: 'New IANA timezone' },
        description: { type: 'string', description: 'New event description' },
        location: { type: 'string', description: 'New event location' },
        maxGuests: { type: 'number', description: 'New maximum guest count' },
      },
      required: [],
    },
    async execute(params, sessionId) {
      return await api.action(sessionId, 'update_event', params);
    },
  },

  {
    name: 'get_event_status',
    description:
      'Live event status: guests checked in, total invited, tables occupied, active staff, time until start. ' +
      'For a full "how\'s it going" summary, pair this with get_checkin_stats rather than using either alone.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    async execute(_params, sessionId) {
      return await api.action(sessionId, 'get_event_status', {});
    },
  },
];

module.exports = tools;
