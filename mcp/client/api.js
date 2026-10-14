const axios = require('axios');

const client = axios.create({
  baseURL: process.env.PLANIT_API_URL || 'https://planitapp.onrender.com',
  headers: {
    'X-MCP-Secret': process.env.MCP_SERVER_SECRET,
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Normalise axios errors into plain objects
function extractError(err) {
  if (err.response?.data?.error) return { error: err.response.data.error };
  if (err.response?.data?.message) return { error: err.response.data.message };
  if (err.code === 'ECONNREFUSED') return { error: 'Cannot reach PlanIt server. Please try again shortly.' };
  if (err.code === 'ETIMEDOUT') return { error: 'Request timed out. Please try again.' };
  return { error: 'An unexpected error occurred. Please try again.' };
}

module.exports = {
  async initConnect(mcpSessionId) {
    try {
      const res = await client.post('/mcp/connect/init', { mcpSessionId });
      return res.data;
    } catch (err) {
      return extractError(err);
    }
  },

  async checkSession(mcpSessionId) {
    try {
      const res = await client.get('/mcp/session/check', {
        headers: { 'X-MCP-Session-ID': mcpSessionId },
      });
      return res.data;
    } catch (err) {
      return { authenticated: false };
    }
  },

  async action(mcpSessionId, tool, params) {
    try {
      const res = await client.post(
        '/mcp/action',
        { tool, params },
        { headers: { 'X-MCP-Session-ID': mcpSessionId } }
      );
      return res.data;
    } catch (err) {
      return extractError(err);
    }
  },
};
