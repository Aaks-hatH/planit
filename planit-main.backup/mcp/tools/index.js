const events       = require('./events');
const guests       = require('./guests');
const seating      = require('./seating');
const checkin      = require('./checkin');
const announcements = require('./announcements');
const rsvp         = require('./rsvp');
const tableservice = require('./tableservice');
const utilities    = require('./utilities');

// Flat array of all tool objects exported for registration with the MCP SDK
const allTools = [
  ...events,
  ...guests,
  ...seating,
  ...checkin,
  ...announcements,
  ...rsvp,
  ...tableservice,
  ...utilities,
];

module.exports = allTools;
