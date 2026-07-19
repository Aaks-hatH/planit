const api = require('../client/api');

const tools = [
  {
    name: 'get_checkin_feed',
    description:
      'Get recent check-in activity: who checked in, when, and by what method (QR scan or manual). ' +
      'Shows the most recent entries first.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Number of recent check-in entries to return. Defaults to 20.',
        },
      },
      required: [],
    },
    async execute(params, sessionId) {
      return await api.action(sessionId, 'get_checkin_feed', params);
    },
  },

  {
    name: 'manual_checkin',
    description:
      'Manually check in a guest when they cannot scan their QR code. ' +
      'Use find_guest first to confirm the guest\'s identity and get their ID.',
    inputSchema: {
      type: 'object',
      properties: {
        guestId: { type: 'string', description: 'The guest\'s unique ID' },
      },
      required: ['guestId'],
    },
    async execute(params, sessionId) {
      return await api.action(sessionId, 'manual_checkin', params);
    },
  },

  {
    name: 'override_checkin',
    description:
      'Manager override to allow entry for a guest who has been flagged or blocked by the security system. ' +
      'Always require the organiser to provide a reason before calling this.',
    inputSchema: {
      type: 'object',
      properties: {
        guestId: { type: 'string', description: 'The guest\'s unique ID' },
        reason: {
          type: 'string',
          description: 'Reason for overriding the security block (required for audit log)',
        },
      },
      required: ['guestId', 'reason'],
    },
    async execute(params, sessionId) {
      return await api.action(sessionId, 'override_checkin', params);
    },
  },

  {
    name: 'get_security_alerts',
    description:
      'Get security alerts and flagged check-in attempts: duplicate scans, blocked guests, ' +
      'suspicious patterns, or out-of-window entries.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    async execute(_params, sessionId) {
      return await api.action(sessionId, 'get_security_alerts', {});
    },
  },
];

module.exports = tools;
