require('dotenv').config();

// PlanIt MCP is deployed as a hosted remote MCP server (SSE transport) and
// connected to via Claude's "Connect" flow — there is no local/stdio mode.
require('./transport/sse');
