/**
 * Token validation helpers.
 * The MCP server itself never validates JWTs — that happens on the backend.
 * These helpers assist with session ID validation on the MCP side.
 */

const MAX_SESSION_ID_LENGTH = 128;

/**
 * Validate that a session ID is a non-empty string within length limits.
 * @param {string} sessionId
 * @returns {boolean}
 */
function isValidSessionId(sessionId) {
  return (
    typeof sessionId === 'string' &&
    sessionId.length > 0 &&
    sessionId.length <= MAX_SESSION_ID_LENGTH
  );
}

/**
 * Sanitise a session ID — strip anything that isn't alphanumeric, hyphen, or underscore.
 * @param {string} sessionId
 * @returns {string}
 */
function sanitiseSessionId(sessionId) {
  return String(sessionId).replace(/[^a-zA-Z0-9\-_]/g, '').slice(0, MAX_SESSION_ID_LENGTH);
}

module.exports = { isValidSessionId, sanitiseSessionId };
