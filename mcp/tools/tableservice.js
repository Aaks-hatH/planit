const api = require('../client/api');

const tools = [
  {
    name: 'get_waitlist',
    description:
      'Get the current table service waitlist: party names, party sizes, estimated wait times, and positions in queue.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    async execute(_params, sessionId) {
      return await api.action(sessionId, 'get_waitlist', {});
    },
  },

  {
    name: 'add_to_waitlist',
    description:
      'Add a walk-in party to the table service waitlist. ' +
      'They will receive a text notification when their table is ready if a phone number is provided.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Party name (usually the surname, e.g. "Smith party")' },
        partySize: { type: 'number', description: 'Number of people in the party' },
        phone: { type: 'string', description: 'Phone number for SMS notification (optional)' },
      },
      required: ['name', 'partySize'],
    },
    async execute(params, sessionId) {
      return await api.action(sessionId, 'add_to_waitlist', params);
    },
  },

  {
    name: 'seat_from_waitlist',
    description:
      'Seat a waiting party at a specific table. ' +
      'Use get_waitlist to get the waitlistId and get_table_occupancy to find a suitable available table.',
    inputSchema: {
      type: 'object',
      properties: {
        waitlistId: { type: 'string', description: 'The waitlist entry ID' },
        tableId: { type: 'string', description: 'The table ID to seat them at' },
      },
      required: ['waitlistId', 'tableId'],
    },
    async execute(params, sessionId) {
      return await api.action(sessionId, 'seat_from_waitlist', params);
    },
  },

  {
    name: 'get_table_occupancy',
    description:
      'Get live occupancy for all tables on the floor: status, party name, party size, server assigned, and notes.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    async execute(_params, sessionId) {
      return await api.action(sessionId, 'get_table_occupancy', {});
    },
  },

  {
    name: 'update_table_status',
    description:
      'Update a table\'s status: available, occupied, reserved, or cleaning.',
    inputSchema: {
      type: 'object',
      properties: {
        tableId: { type: 'string', description: 'The table\'s unique ID (from get_table_occupancy)' },
        status: {
          type: 'string',
          enum: ['available', 'occupied', 'reserved', 'cleaning'],
          description: 'New status for the table',
        },
      },
      required: ['tableId', 'status'],
    },
    async execute(params, sessionId) {
      return await api.action(sessionId, 'update_table_status', params);
    },
  },
];

module.exports = tools;
