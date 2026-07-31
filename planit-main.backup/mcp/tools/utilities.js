const api = require('../client/api');

const tools = [
  {
    name: 'get_budget',
    description:
      'Get the event budget breakdown by category: total budget set, total spent, remaining, ' +
      'and a list of all expenses with amounts and notes.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    async execute(_params, sessionId) {
      return await api.action(sessionId, 'get_budget', {});
    },
  },

  {
    name: 'update_budget',
    description:
      'Add or update a budget entry. Use this to log an expense or update the overall budget amount.',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Budget category (e.g. "Catering", "Venue", "Decorations")' },
        amount: { type: 'number', description: 'Amount in the event\'s currency' },
        notes: { type: 'string', description: 'Optional notes about this budget item' },
      },
      required: ['category', 'amount'],
    },
    async execute(params, sessionId) {
      return await api.action(sessionId, 'update_budget', params);
    },
  },

  {
    name: 'get_tasks',
    description:
      'Get the event task list. Can filter by pending or complete tasks.',
    inputSchema: {
      type: 'object',
      properties: {
        filter: {
          type: 'string',
          enum: ['all', 'pending', 'complete'],
          description: 'Filter tasks by completion status. Defaults to all.',
        },
      },
      required: [],
    },
    async execute(params, sessionId) {
      return await api.action(sessionId, 'get_tasks', params);
    },
  },

  {
    name: 'add_task',
    description:
      'Add a task to the event task list.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Task title or description' },
        dueDate: { type: 'string', description: 'Due date in ISO 8601 format (optional)' },
        assignee: { type: 'string', description: 'Name of person responsible for this task (optional)' },
      },
      required: ['title'],
    },
    async execute(params, sessionId) {
      return await api.action(sessionId, 'add_task', params);
    },
  },

  {
    name: 'complete_task',
    description:
      'Mark a task as complete. Use get_tasks to find the task ID first.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The task\'s unique ID' },
      },
      required: ['taskId'],
    },
    async execute(params, sessionId) {
      return await api.action(sessionId, 'complete_task', params);
    },
  },

  {
    name: 'create_poll',
    description:
      'Create a poll for event guests to vote on. Requires a question and at least two answer options. ' +
      'The poll is sent to guests immediately.',
    inputSchema: {
      type: 'object',
      properties: {
        question: { type: 'string', description: 'The poll question' },
        options: {
          type: 'array',
          description: 'Answer options — minimum 2',
          items: { type: 'string' },
          minItems: 2,
        },
      },
      required: ['question', 'options'],
    },
    async execute(params, sessionId) {
      return await api.action(sessionId, 'create_poll', params);
    },
  },

  {
    name: 'get_poll_results',
    description:
      'Get results for a specific poll: vote counts per option and total responses.',
    inputSchema: {
      type: 'object',
      properties: {
        pollId: { type: 'string', description: 'The poll\'s unique ID' },
      },
      required: ['pollId'],
    },
    async execute(params, sessionId) {
      return await api.action(sessionId, 'get_poll_results', params);
    },
  },
];

module.exports = tools;
