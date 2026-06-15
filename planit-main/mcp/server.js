require('dotenv').config();

// PlanIt MCP is deployed as a hosted remote MCP server using Streamable HTTP
// (the current standard transport for remote MCP servers) and connected to
// via Claude's "Connect" flow — there is no local/stdio mode.
require('./transport/streamableHttp');
