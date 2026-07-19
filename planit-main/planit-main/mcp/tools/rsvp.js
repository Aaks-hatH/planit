const api = require('../client/api');

const tools = [
  {
    name: 'get_rsvp_settings',
    description:
      'Get the current RSVP page configuration: custom questions, cutoff date, plus-one settings, ' +
      'whether RSVP is enabled, and the RSVP message shown to guests.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    async execute(_params, sessionId) {
      return await api.action(sessionId, 'get_rsvp_settings', {});
    },
  },

  {
    name: 'update_rsvp_settings',
    description:
      'Update RSVP page settings. Only include fields that should change.',
    inputSchema: {
      type: 'object',
      properties: {
        cutoffDate: {
          type: 'string',
          description: 'RSVP deadline in ISO 8601 format (YYYY-MM-DD)',
        },
        maxGuests: {
          type: 'number',
          description: 'Maximum number of RSVPs to accept',
        },
        questions: {
          type: 'array',
          description: 'Custom RSVP questions',
          items: {
            type: 'object',
            properties: {
              text: { type: 'string', description: 'The question text' },
              type: {
                type: 'string',
                enum: ['text', 'multiple_choice', 'dropdown'],
                description: 'Question type',
              },
              options: {
                type: 'array',
                items: { type: 'string' },
                description: 'Answer options for multiple_choice or dropdown questions',
              },
              required: { type: 'boolean', description: 'Whether the question must be answered' },
            },
            required: ['text', 'type'],
          },
        },
        allowPlusOne: {
          type: 'boolean',
          description: 'Whether guests can bring a plus one',
        },
        requireEmail: {
          type: 'boolean',
          description: 'Whether email is required on the RSVP form',
        },
        rsvpEnabled: {
          type: 'boolean',
          description: 'Turn RSVP on or off',
        },
        rsvpMessage: {
          type: 'string',
          description: 'Custom message shown at the top of the RSVP page',
        },
      },
      required: [],
    },
    async execute(params, sessionId) {
      return await api.action(sessionId, 'update_rsvp_settings', params);
    },
  },

  {
    name: 'get_rsvp_responses',
    description:
      'Get RSVP responses from guests. Can filter by confirmed, declined, or all.',
    inputSchema: {
      type: 'object',
      properties: {
        filter: {
          type: 'string',
          enum: ['all', 'confirmed', 'declined'],
          description: 'Filter responses by status. Defaults to all.',
        },
      },
      required: [],
    },
    async execute(params, sessionId) {
      return await api.action(sessionId, 'get_rsvp_responses', params);
    },
  },
];

module.exports = tools;
