/**
 * Session management for the MCP server.
 *
 * PlanIt MCP is a hosted remote server using the SSE transport. Each incoming
 * SSE connection gets a unique session ID, returned via createSession(), which
 * must be passed to every subsequent tool call for that connection.
 *
 * The MCP server itself stores NO tokens — the backend Redis holds
 * `mcp:session:<sessionId>` → JWT. This module only tracks which session IDs
 * are currently live in this process so the transport layer can route messages.
 */

const { v4: uuidv4 } = require('uuid');
const { isValidSessionId, sanitiseSessionId } = require('./token');

// In-memory registry: sessionId → { createdAt }
const sessions = new Map();

/**
 * Create a new session ID and register it.
 * @returns {string} sessionId
 */
function createSession() {
  const sessionId = uuidv4();
  sessions.set(sessionId, { createdAt: Date.now() });
  return sessionId;
}

/**
 * Remove a session from the registry (called when an SSE connection closes).
 * @param {string} sessionId
 */
function removeSession(sessionId) {
  sessions.delete(sessionId);
}

/**
 * Check whether a session ID is registered in this process.
 * @param {string} sessionId
 * @returns {boolean}
 */
function hasSession(sessionId) {
  if (!isValidSessionId(sessionId)) return false;
  return sessions.has(sanitiseSessionId(sessionId)) || sessions.has(sessionId);
}

/**
 * Return all active session IDs.
 * @returns {string[]}
 */
function listSessions() {
  return Array.from(sessions.keys());
}

module.exports = { createSession, removeSession, hasSession, listSessions };
