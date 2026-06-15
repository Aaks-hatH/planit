/**
 * SSE (Server-Sent Events) transport — used when deployed on Render.
 * Each incoming SSE connection gets a unique session ID.
 */

const express = require('express');
const cors = require('cors');
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { SSEServerTransport } = require('@modelcontextprotocol/sdk/server/sse.js');
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require('@modelcontextprotocol/sdk/types.js');

const { createSession, removeSession } = require('../auth/session');
const allTools = require('../tools/index');
const { PLANIT_SYSTEM_PROMPT } = require('../prompt/system');

const PORT = process.env.PORT || 3100;

const app = express();

// CORS: only allow claude.ai
app.use(
  cors({
    origin: ['https://claude.ai', 'https://www.claude.ai'],
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Mcp-Session-Id'],
  })
);

app.use(express.json());

// Health check for Render
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'planit-mcp' });
});

// Map of sessionId → { server, transport }
const sessions = new Map();

/**
 * Build and return an MCP Server instance wired up with all PlanIt tools.
 */
function buildMcpServer(sessionId) {
  const server = new Server(
    { name: 'planit-mcp', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: allTools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

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

// SSE connection endpoint
app.get('/sse', async (req, res) => {
  const sessionId = createSession();

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Nginx / Render proxy

  // Send session ID to client as first SSE event
  res.write(`data: ${JSON.stringify({ type: 'session', sessionId })}\n\n`);

  // Send system prompt
  res.write(
    `data: ${JSON.stringify({ type: 'system', content: PLANIT_SYSTEM_PROMPT })}\n\n`
  );

  const mcpServer = buildMcpServer(sessionId);
  const transport = new SSEServerTransport('/messages', res);
  await mcpServer.connect(transport);

  sessions.set(sessionId, { server: mcpServer, transport });

  req.on('close', () => {
    removeSession(sessionId);
    sessions.delete(sessionId);
  });
});

// Message endpoint — receives tool call POSTs for an existing SSE session
app.post('/messages', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] || req.query.sessionId;

  if (!sessionId || !sessions.has(sessionId)) {
    return res.status(400).json({ error: 'No active session for this ID.' });
  }

  const { transport } = sessions.get(sessionId);
  await transport.handlePostMessage(req, res);
});

app.listen(PORT, () => {
  console.log(`PlanIt MCP SSE server running on port ${PORT}`);
});
