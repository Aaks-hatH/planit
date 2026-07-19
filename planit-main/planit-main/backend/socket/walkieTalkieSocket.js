'use strict';

/**
 * socket/walkieTalkieSocket.js
 *
 * Staff Walkie-Talkie — WebRTC Signaling Relay
 * ============================================
 *
 * This module handles ONLY the signaling half of WebRTC.
 * Audio travels directly peer-to-peer (DTLS-SRTP encrypted by the browser).
 * The server never sees or processes any audio data.
 *
 * Security model
 * --------------
 * - Every socket must already be authenticated via the JWT middleware in
 *   chatSocket.js, which populates socket.user before we see the connection.
 * - Only sockets whose token role is 'staff' or 'organizer' may join a room.
 * - Cross-event access is blocked: the token's eventId must match the requested
 *   room's eventId (admin-access tokens are the only exception).
 * - Signaling payloads are opaque to the server — the client transmits AES-GCM
 *   ciphertext (key derived from the JWT via PBKDF2). The server relays the
 *   blob without inspecting or modifying it.
 * - With the Redis adapter attached, all socket.io room operations (join,
 *   leave, emit-to-room) automatically propagate across all 5 backend instances
 *   without any extra code here.
 *
 * Client -> Server events
 * -----------------------
 *   walkie:join         { eventId }
 *   walkie:leave        { eventId }
 *   walkie:offer        { eventId, to, encryptedPayload }
 *   walkie:answer       { eventId, to, encryptedPayload }
 *   walkie:candidate    { eventId, to, encryptedPayload }
 *   walkie:ptt_start    { eventId }
 *   walkie:ptt_stop     { eventId }
 *
 * Server -> Client events
 * -----------------------
 *   walkie:peers        { peers: [{ socketId, username }] }
 *   walkie:peer_joined  { socketId, username }
 *   walkie:peer_left    { socketId, username }
 *   walkie:offer        { from, fromUsername, encryptedPayload }
 *   walkie:answer       { from, fromUsername, encryptedPayload }
 *   walkie:candidate    { from, fromUsername, encryptedPayload }
 *   walkie:ptt_start    { from, username }
 *   walkie:ptt_stop     { from, username }
 *   walkie:error        { message }
 */

// In-process peer registry: eventId -> Map<socketId, { username, role }>
// This is only used for fast peer-list snapshots sent to newly joining sockets.
// When the Redis adapter is active, socket.io room membership is Redis-backed,
// so this map may not reflect peers on other instances. That is intentional:
// the map is used only to send the initial peer list from this instance's view.
const localPeers = new Map();

function roomName(eventId) {
  return `walkie_staff_${eventId}`;
}

function getLocalPeers(eventId) {
  if (!localPeers.has(eventId)) localPeers.set(eventId, new Map());
  return localPeers.get(eventId);
}

module.exports = function walkieTalkieSocket(io) {

  // chatSocket.js attaches a JWT-verifying io.use() middleware on the default
  // namespace before this module is called, so socket.user is always populated
  // by the time our handlers run.

  io.on('connection', (socket) => {
    if (!socket.user) return; // safety guard; should never happen

    // ------------------------------------------------------------------
    // walkie:join
    // ------------------------------------------------------------------
    socket.on('walkie:join', ({ eventId } = {}) => {
      if (!eventId || !isAuthorized(socket, eventId)) {
        socket.emit('walkie:error', { message: 'Unauthorized' });
        return;
      }

      const room    = roomName(eventId);
      const peers   = getLocalPeers(eventId);
      const { username, role } = socket.user;

      socket.join(room);
      peers.set(socket.id, { username, role });
      socket._walkieEventId = eventId;

      // Tell the joining socket about everyone else visible on this instance
      const peerList = [];
      for (const [sid, info] of peers.entries()) {
        if (sid !== socket.id) peerList.push({ socketId: sid, username: info.username });
      }
      socket.emit('walkie:peers', { peers: peerList });

      // Tell existing peers in the room (across all instances via Redis adapter)
      socket.to(room).emit('walkie:peer_joined', { socketId: socket.id, username });

      console.log(`[walkie] ${username} joined event ${eventId} (local peers: ${peers.size})`);
    });

    // ------------------------------------------------------------------
    // walkie:leave
    // ------------------------------------------------------------------
    socket.on('walkie:leave', ({ eventId } = {}) => {
      if (eventId) leaveRoom(socket, eventId);
    });

    // ------------------------------------------------------------------
    // walkie:offer — forward encrypted SDP offer to a specific peer
    // ------------------------------------------------------------------
    socket.on('walkie:offer', ({ eventId, to, encryptedPayload } = {}) => {
      if (!eventId || !to || !encryptedPayload) return;
      if (!isAuthorized(socket, eventId)) return;
      if (typeof encryptedPayload !== 'string' || encryptedPayload.length > 65536) return;

      io.to(to).emit('walkie:offer', {
        from:            socket.id,
        fromUsername:    socket.user.username,
        encryptedPayload,
      });
    });

    // ------------------------------------------------------------------
    // walkie:answer — forward encrypted SDP answer to a specific peer
    // ------------------------------------------------------------------
    socket.on('walkie:answer', ({ eventId, to, encryptedPayload } = {}) => {
      if (!eventId || !to || !encryptedPayload) return;
      if (!isAuthorized(socket, eventId)) return;
      if (typeof encryptedPayload !== 'string' || encryptedPayload.length > 65536) return;

      io.to(to).emit('walkie:answer', {
        from:            socket.id,
        fromUsername:    socket.user.username,
        encryptedPayload,
      });
    });

    // ------------------------------------------------------------------
    // walkie:candidate — forward encrypted ICE candidate to a specific peer
    // ------------------------------------------------------------------
    socket.on('walkie:candidate', ({ eventId, to, encryptedPayload } = {}) => {
      if (!eventId || !to || !encryptedPayload) return;
      if (!isAuthorized(socket, eventId)) return;
      if (typeof encryptedPayload !== 'string' || encryptedPayload.length > 4096) return;

      io.to(to).emit('walkie:candidate', {
        from:            socket.id,
        fromUsername:    socket.user.username,
        encryptedPayload,
      });
    });

    // ------------------------------------------------------------------
    // walkie:ptt_start — broadcast "this user is now transmitting"
    // ------------------------------------------------------------------
    socket.on('walkie:ptt_start', ({ eventId } = {}) => {
      if (!eventId || !isAuthorized(socket, eventId)) return;
      socket.to(roomName(eventId)).emit('walkie:ptt_start', {
        from:     socket.id,
        username: socket.user.username,
      });
    });

    // ------------------------------------------------------------------
    // walkie:ptt_stop — broadcast "this user stopped transmitting"
    // ------------------------------------------------------------------
    socket.on('walkie:ptt_stop', ({ eventId } = {}) => {
      if (!eventId || !isAuthorized(socket, eventId)) return;
      socket.to(roomName(eventId)).emit('walkie:ptt_stop', {
        from:     socket.id,
        username: socket.user.username,
      });
    });

    // ------------------------------------------------------------------
    // Disconnect — clean up room membership
    // ------------------------------------------------------------------
    socket.on('disconnect', () => {
      const eid = socket._walkieEventId;
      if (eid) leaveRoom(socket, eid);
    });
  });

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  function isAuthorized(socket, eventId) {
    const { role, eventId: tokenEventId, isAdminAccess } = socket.user || {};
    if (role !== 'staff' && role !== 'organizer') return false;
    if (isAdminAccess) return true;
    return tokenEventId?.toString() === eventId.toString();
  }

  function leaveRoom(socket, eventId) {
    const room  = roomName(eventId);
    const peers = getLocalPeers(eventId);

    socket.leave(room);
    peers.delete(socket.id);
    if (peers.size === 0) localPeers.delete(eventId);

    socket.to(room).emit('walkie:peer_left', {
      socketId: socket.id,
      username: socket.user?.username,
    });

    socket._walkieEventId = null;
    console.log(`[walkie] ${socket.user?.username} left event ${eventId}`);
  }
};
