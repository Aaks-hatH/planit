const api = require('../client/api');

const tools = [
  {
    name: 'create_table',
    description:
      'Create a new table in the seating map. ' +
      'Each table needs a name and capacity. Shape defaults to round if not specified.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Table name or label, e.g. "Table 1" or "VIP Table"' },
        capacity: { type: 'number', description: 'Maximum number of guests the table can seat' },
        shape: {
          type: 'string',
          enum: ['round', 'rectangle'],
          description: 'Table shape — round or rectangle. Defaults to round.',
        },
      },
      required: ['name', 'capacity'],
    },
    async execute(params, sessionId) {
      return await api.action(sessionId, 'create_table', params);
    },
  },

  {
    name: 'get_tables',
    description:
      'Get all tables in the seating layout with their name, capacity, assigned guests, and current occupancy count.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    async execute(_params, sessionId) {
      return await api.action(sessionId, 'get_tables', {});
    },
  },

  {
    name: 'assign_guest_to_table',
    description:
      'Assign a guest to a specific table. Use find_guest and get_tables to get the IDs first if needed.',
    inputSchema: {
      type: 'object',
      properties: {
        guestId: { type: 'string', description: 'The guest\'s unique ID' },
        tableId: { type: 'string', description: 'The table\'s unique ID' },
      },
      required: ['guestId', 'tableId'],
    },
    async execute(params, sessionId) {
      return await api.action(sessionId, 'assign_guest_to_table', params);
    },
  },

  {
    name: 'remove_guest_from_table',
    description:
      'Remove a guest from their currently assigned table. The guest remains on the guest list but becomes unseated.',
    inputSchema: {
      type: 'object',
      properties: {
        guestId: { type: 'string', description: 'The guest\'s unique ID' },
      },
      required: ['guestId'],
    },
    async execute(params, sessionId) {
      return await api.action(sessionId, 'remove_guest_from_table', params);
    },
  },

  {
    name: 'get_seating_map',
    description:
      'Get the complete seating map with all tables and their guest assignments as structured data. ' +
      'Use this to give the organiser an overview of the seating layout.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    async execute(_params, sessionId) {
      return await api.action(sessionId, 'get_seating_map', {});
    },
  },

  {
    name: 'suggest_seating',
    description:
      'Generate a suggested seating arrangement based on current guest count and table capacities. ' +
      'Returns a structured plan — describe it to the user conversationally and ask if they want to apply it.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    async execute(_params, sessionId) {
      return await api.action(sessionId, 'suggest_seating', {});
    },
  },
];

module.exports = tools;
