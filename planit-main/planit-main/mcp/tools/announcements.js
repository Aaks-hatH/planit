const api = require('../client/api');

const tools = [
  {
    name: 'send_announcement',
    description:
      'Send an announcement to guests, staff, or everyone. ' +
      'Messages appear in real-time on recipients\' event pages.',
    inputSchema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'The announcement message to send',
        },
        audience: {
          type: 'string',
          enum: ['all', 'guests', 'staff'],
          description: 'Who to send the announcement to: all, guests only, or staff only',
        },
      },
      required: ['message', 'audience'],
    },
    async execute(params, sessionId) {
      return await api.action(sessionId, 'send_announcement', params);
    },
  },

  {
    name: 'get_announcements',
    description:
      'Get the history of all announcements sent for this event, with timestamps and audience targets.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    async execute(_params, sessionId) {
      return await api.action(sessionId, 'get_announcements', {});
    },
  },
];

module.exports = tools;
