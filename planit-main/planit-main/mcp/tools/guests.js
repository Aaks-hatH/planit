const api = require('../client/api');

const tools = [
  {
    name: 'add_guest',
    description:
      'Add a single guest to the event guest list. ' +
      'Returns the new guest record including their unique invite link and QR code URL.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Guest full name' },
        email: { type: 'string', description: 'Guest email address (optional)' },
        phone: { type: 'string', description: 'Guest phone number (optional)' },
        notes: { type: 'string', description: 'Internal notes about this guest (optional)' },
        tableId: { type: 'string', description: 'ID of table to pre-assign this guest to (optional)' },
      },
      required: ['name'],
    },
    async execute(params, sessionId) {
      return await api.action(sessionId, 'add_guest', params);
    },
  },

  {
    name: 'import_guests',
    description:
      'Bulk import multiple guests at once. Use this when the user provides a list of names, ' +
      'a CSV, or any collection of guests. Much faster than adding one at a time.',
    inputSchema: {
      type: 'object',
      properties: {
        guests: {
          type: 'array',
          description: 'Array of guest objects to import',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Guest full name' },
              email: { type: 'string', description: 'Email address (optional)' },
              phone: { type: 'string', description: 'Phone number (optional)' },
              notes: { type: 'string', description: 'Internal notes (optional)' },
            },
            required: ['name'],
          },
        },
      },
      required: ['guests'],
    },
    async execute(params, sessionId) {
      return await api.action(sessionId, 'import_guests', params);
    },
  },

  {
    name: 'get_guest_list',
    description:
      'Get the event guest list. Can filter by check-in status. ' +
      'Returns each guest with their name, check-in status, table assignment, and invite link.',
    inputSchema: {
      type: 'object',
      properties: {
        filter: {
          type: 'string',
          enum: ['all', 'checked-in', 'pending', 'no-show'],
          description: 'Filter guests by status. Defaults to all.',
        },
      },
      required: [],
    },
    async execute(params, sessionId) {
      return await api.action(sessionId, 'get_guest_list', params);
    },
  },

  {
    name: 'find_guest',
    description:
      'Search for a specific guest by name, email, or phone number. ' +
      'Use this before updating or checking in a guest when you only have partial information.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search term — name, email address, or phone number',
        },
      },
      required: ['query'],
    },
    async execute(params, sessionId) {
      return await api.action(sessionId, 'find_guest', params);
    },
  },

  {
    name: 'update_guest',
    description:
      'Update a guest\'s details or notes. Only include fields that should change. ' +
      'Use find_guest first to get the guestId if you only have a name.',
    inputSchema: {
      type: 'object',
      properties: {
        guestId: { type: 'string', description: 'The guest\'s unique ID (from get_guest_list or find_guest)' },
        name: { type: 'string', description: 'Updated name' },
        email: { type: 'string', description: 'Updated email' },
        phone: { type: 'string', description: 'Updated phone' },
        notes: { type: 'string', description: 'Updated notes' },
        tableId: { type: 'string', description: 'Updated table assignment ID' },
      },
      required: ['guestId'],
    },
    async execute(params, sessionId) {
      return await api.action(sessionId, 'update_guest', params);
    },
  },

  {
    name: 'remove_guest',
    description:
      'Remove a guest from the event guest list. This also invalidates their invite link and QR code. ' +
      'Use find_guest first to confirm the right person before removing.',
    inputSchema: {
      type: 'object',
      properties: {
        guestId: { type: 'string', description: 'The guest\'s unique ID' },
      },
      required: ['guestId'],
    },
    async execute(params, sessionId) {
      return await api.action(sessionId, 'remove_guest', params);
    },
  },

  {
    name: 'get_checkin_stats',
    description:
      'Get check-in statistics for the event: total invited, checked in, pending, no-show, ' +
      'percentage, and last check-in timestamp.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    async execute(_params, sessionId) {
      return await api.action(sessionId, 'get_checkin_stats', {});
    },
  },
];

module.exports = tools;
