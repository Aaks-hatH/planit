/**
 * Streamable HTTP transport — the current standard transport for remote MCP
 * servers (replaces the SSE transport, which was deprecated in the March
 * 2025 MCP spec revision and is no longer accepted for Connectors Directory
 * submissions).
 *
 * A single endpoint, POST/GET/DELETE /mcp, handles the whole lifecycle:
 *   - POST without an Mcp-Session-Id, body = "initialize" -> creates a new
 *     session, returns Mcp-Session-Id header
 *   - POST with Mcp-Session-Id -> routed to that session's transport
 *     (tool calls, list tools, etc.)
 *   - GET with Mcp-Session-Id -> opens the SSE stream used for server-to-
 *     client notifications (resumable via Last-Event-ID)
 *   - DELETE with Mcp-Session-Id -> explicit session termination
 */

const express = require('express');
const cors = require('cors');
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  isInitializeRequest,
} = require('@modelcontextprotocol/sdk/types.js');

const { createSession, removeSession } = require('../auth/session');
const allTools = require('../tools/index');
const toolAnnotations = require('../tools/annotations');
const { PLANIT_SYSTEM_PROMPT } = require('../prompt/system');

const PORT = process.env.PORT || 3100;

const app = express();

// CORS: only allow claude.ai. Mcp-Session-Id must be both an allowed request
// header (client -> server) and an exposed response header (server -> client),
// or browsers/clients can't read it back after the initialize call.
app.use(
  cors({
    origin: ['https://claude.ai', 'https://www.claude.ai'],
    credentials: true,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Mcp-Session-Id', 'mcp-protocol-version'],
    exposedHeaders: ['Mcp-Session-Id'],
  })
);

app.use(express.json());

// Health check for Render
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'planit-mcp' });
});

// sessionId -> { server, transport }
const sessions = new Map();

/**
 * Build an MCP Server instance wired up with all PlanIt tools.
 * `transport` is passed by reference — transport.sessionId is populated by
 * the SDK once the initialize handshake completes, and stays populated for
 * the lifetime of the session, so tool calls can read it lazily.
 */
function buildMcpServer(transport) {
  const server = new Server(
    { name: 'planit-mcp', version: '2.0.0' },
    {
      capabilities: { tools: {} },
      // Surfaced to Claude as part of the initialize response — this is the
      // spec-compliant replacement for the old hand-written SSE "system"
      // event the previous transport used to send.
      instructions: PLANIT_SYSTEM_PROMPT,
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: allTools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
      annotations: toolAnnotations[t.name],
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const sessionId = transport.sessionId;

    const tool = allTools.find((t) => t.name === name);
    if (!tool) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: `Unknown tool: ${name}` }) }],
        isError: true,
      };
    }

    try {
      const result = await tool.execute(args || {}, sessionId);
      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: 'Tool execution failed. Please try again.' }) }],
        isError: true,
      };
    }
  });

  return server;
}

// POST /mcp — initialize, tool calls, list tools, etc.
app.post('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];

  try {
    let transport;

    if (sessionId && sessions.has(sessionId)) {
      transport = sessions.get(sessionId).transport;
    } else if (!sessionId && isInitializeRequest(req.body)) {
      transport = new StreamableHTTPServerTransport({
        // Re-use the existing session-ID helper so generated IDs match the
        // format already expected by auth/token.js and the PlanIt backend.
        sessionIdGenerator: () => createSession(),
        onsessioninitialized: (sid) => {
          sessions.set(sid, { server, transport });
        },
      });

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid) {
          removeSession(sid);
          sessions.delete(sid);
        }
      };

      const server = buildMcpServer(transport);
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return; // already handled
    } else {
      return res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Bad Request: No valid session ID provided' },
        id: null,
      });
    }

    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null,
      });
    }
  }
});

// GET /mcp — SSE stream for server-initiated notifications (resumable)
app.get('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];
  if (!sessionId || !sessions.has(sessionId)) {
    return res.status(400).send('Invalid or missing session ID');
  }
  const { transport } = sessions.get(sessionId);
  await transport.handleRequest(req, res);
});

// DELETE /mcp — explicit session termination
app.delete('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];
  if (!sessionId || !sessions.has(sessionId)) {
    return res.status(400).send('Invalid or missing session ID');
  }
  try {
    const { transport } = sessions.get(sessionId);
    await transport.handleRequest(req, res);
  } catch (err) {
    if (!res.headersSent) res.status(500).send('Error processing session termination');
  }
});

app.listen(PORT, () => {
  console.log(`PlanIt MCP (Streamable HTTP) server running on port ${PORT}`);
});
