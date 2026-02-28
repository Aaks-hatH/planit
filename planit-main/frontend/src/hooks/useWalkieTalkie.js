/**
 * hooks/useWalkieTalkie.js
 *
 * Staff Walkie-Talkie — WebRTC Push-to-Talk
 * =========================================
 *
 * Encryption layers
 * -----------------
 * Layer 1 — DTLS-SRTP (browser-enforced, zero config)
 *   All audio that travels between peers is encrypted by the WebRTC stack.
 *   There is no way to disable this in modern browsers.
 *
 * Layer 2 — AES-GCM-256 on the signaling channel
 *   SDP offers/answers and ICE candidates contain network topology information.
 *   Before emitting any signaling message, the client encrypts the payload with
 *   a key derived from the event JWT using PBKDF2-SHA-256 (200k iterations).
 *   The server relays the ciphertext opaquely and never sees plaintext SDP.
 *   Only peers who hold a valid token for the same event can decrypt.
 *
 * Usage
 * -----
 *   const walkie = useWalkieTalkie(socket, eventId, token, username);
 *
 *   // walkie.isConnected    — joined the staff room
 *   // walkie.isSpeaking     — local PTT is active
 *   // walkie.activeSpeakers — [{ socketId, username }]
 *   // walkie.peers          — [{ socketId, username }]
 *   // walkie.error          — string or null
 *   // walkie.startPTT()     — call on mousedown / touchstart
 *   // walkie.stopPTT()      — call on mouseup / touchend / touchcancel
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// ---------------------------------------------------------------------------
// WebRTC configuration
// Public STUN servers are fine; we are not routing audio through the server.
// For production, add TURN credentials here if NAT traversal fails for some
// staff networks.
// ---------------------------------------------------------------------------
const ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // Public TURN relay — used only when STUN / direct P2P fails (e.g. symmetric NAT).
    // These are the Metered open TURN servers (no-cost, rate-limited).
    { urls: 'turn:openrelay.metered.ca:80',  username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
  ],
  // iceCandidatePoolSize: 2 pre-gathers candidates before PTT, reducing first-transmission lag
  iceCandidatePoolSize: 2,
};

// ---------------------------------------------------------------------------
// Crypto helpers — all operate on the Web Crypto API (available in all
// modern browsers; no polyfill needed)
// ---------------------------------------------------------------------------

/**
 * Derive an AES-GCM-256 CryptoKey from the JWT event token.
 * The salt is fixed and public; security comes from the high iteration count
 * combined with the token's entropy.
 *
 * @param {string} token — the raw JWT string
 * @returns {Promise<CryptoKey>}
 */
async function deriveSignalingKey(token) {
  const enc = new TextEncoder();

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(token),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name:       'PBKDF2',
      salt:       enc.encode('planit-walkie-v1'),
      iterations: 200_000,
      hash:       'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a serialisable object.
 * Returns a base64 string: 12-byte IV prepended to ciphertext.
 *
 * @param {CryptoKey} key
 * @param {object} obj
 * @returns {Promise<string>} base64
 */
async function encrypt(key, obj) {
  const iv        = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(obj));
  const cipher    = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);

  const out = new Uint8Array(iv.byteLength + cipher.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(cipher), iv.byteLength);

  return btoa(String.fromCharCode(...out));
}

/**
 * Decrypt a base64 string produced by encrypt().
 *
 * @param {CryptoKey} key
 * @param {string} b64
 * @returns {Promise<object>}
 */
async function decrypt(key, b64) {
  const raw      = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const iv       = raw.slice(0, 12);
  const cipher   = raw.slice(12);
  const plain    = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
  return JSON.parse(new TextDecoder().decode(plain));
}

// ---------------------------------------------------------------------------
// Silent audio stream — used as a placeholder track so RTCPeerConnection can
// be fully negotiated before the user holds PTT.
// ---------------------------------------------------------------------------
let _silentStream = null;

function getSilentStream() {
  if (_silentStream) return _silentStream;
  const ctx  = new AudioContext();
  const dst  = ctx.createMediaStreamDestination();
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  gain.gain.value = 0;
  osc.connect(gain);
  gain.connect(dst);
  osc.start();
  _silentStream = dst.stream;
  return _silentStream;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useWalkieTalkie(socket, eventId, token, username) {
  const [isConnected,    setIsConnected]    = useState(false);
  const [isSpeaking,     setIsSpeaking]     = useState(false);
  const [peers,          setPeers]          = useState([]);  // [{ socketId, username }]
  const [activeSpeakers, setActiveSpeakers] = useState([]);  // [{ socketId, username }]
  const [error,          setError]          = useState(null);

  // Stable refs across renders
  const keyRef         = useRef(null);        // CryptoKey
  const pcsRef         = useRef({});          // socketId -> RTCPeerConnection
  const localStreamRef = useRef(null);        // live mic MediaStream during PTT
  const eventIdRef     = useRef(eventId);
  const socketRef      = useRef(socket);

  eventIdRef.current = eventId;
  socketRef.current  = socket;

  // -------------------------------------------------------------------------
  // Derive the signaling key whenever the token changes
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    deriveSignalingKey(token)
      .then(k => { if (!cancelled) keyRef.current = k; })
      .catch(e => setError(`Crypto initialisation failed: ${e.message}`));
    return () => { cancelled = true; };
  }, [token]);

  // -------------------------------------------------------------------------
  // Join / leave the staff room when socket or eventId changes
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!socket || !eventId) return;
    socket.emit('walkie:join', { eventId });
    setIsConnected(true);

    return () => {
      socket.emit('walkie:leave', { eventId });
      setIsConnected(false);
      cleanupAllPeers();
    };
  }, [socket, eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  // -------------------------------------------------------------------------
  // Socket event handlers
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!socket) return;

    const onPeers = ({ peers: list }) => {
      setPeers(list);
      // We are the "callee" for all existing peers; they will offer to us.
      // Nothing to initiate here — we wait for their offers.
    };

    const onPeerJoined = ({ socketId, username: u }) => {
      setPeers(prev => [...prev.filter(p => p.socketId !== socketId), { socketId, username: u }]);
      // We are now the "caller" for the newly joined peer.
      initiateOffer(socketId);
    };

    const onPeerLeft = ({ socketId }) => {
      setPeers(prev => prev.filter(p => p.socketId !== socketId));
      setActiveSpeakers(prev => prev.filter(s => s.socketId !== socketId));
      closePeer(socketId);
    };

    const onOffer = async ({ from, fromUsername, encryptedPayload }) => {
      try {
        if (!keyRef.current) return;
        const { sdp } = await decrypt(keyRef.current, encryptedPayload);
        await handleRemoteOffer(from, fromUsername, sdp);
      } catch (e) {
        console.warn('[walkie] offer decrypt error:', e.message);
      }
    };

    const onAnswer = async ({ from, encryptedPayload }) => {
      try {
        if (!keyRef.current) return;
        const { sdp } = await decrypt(keyRef.current, encryptedPayload);
        const pc = pcsRef.current[from];
        if (pc && pc.signalingState !== 'stable') {
          await pc.setRemoteDescription({ type: 'answer', sdp });
        }
      } catch (e) {
        console.warn('[walkie] answer decrypt error:', e.message);
      }
    };

    const onCandidate = async ({ from, encryptedPayload }) => {
      try {
        if (!keyRef.current) return;
        const candidate = await decrypt(keyRef.current, encryptedPayload);
        const pc = pcsRef.current[from];
        if (pc && pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (e) {
        console.warn('[walkie] candidate decrypt error:', e.message);
      }
    };

    const onPttStart = ({ from, username: u }) => {
      setActiveSpeakers(prev => [
        ...prev.filter(s => s.socketId !== from),
        { socketId: from, username: u },
      ]);
    };

    const onPttStop = ({ from }) => {
      setActiveSpeakers(prev => prev.filter(s => s.socketId !== from));
    };

    const onWalkieError = ({ message: msg }) => setError(msg);

    socket.on('walkie:peers',       onPeers);
    socket.on('walkie:peer_joined', onPeerJoined);
    socket.on('walkie:peer_left',   onPeerLeft);
    socket.on('walkie:offer',       onOffer);
    socket.on('walkie:answer',      onAnswer);
    socket.on('walkie:candidate',   onCandidate);
    socket.on('walkie:ptt_start',   onPttStart);
    socket.on('walkie:ptt_stop',    onPttStop);
    socket.on('walkie:error',       onWalkieError);

    return () => {
      socket.off('walkie:peers',       onPeers);
      socket.off('walkie:peer_joined', onPeerJoined);
      socket.off('walkie:peer_left',   onPeerLeft);
      socket.off('walkie:offer',       onOffer);
      socket.off('walkie:answer',      onAnswer);
      socket.off('walkie:candidate',   onCandidate);
      socket.off('walkie:ptt_start',   onPttStart);
      socket.off('walkie:ptt_stop',    onPttStop);
      socket.off('walkie:error',       onWalkieError);
    };
  }, [socket]); // eslint-disable-line react-hooks/exhaustive-deps

  // -------------------------------------------------------------------------
  // RTCPeerConnection factory
  // -------------------------------------------------------------------------
  function getOrCreatePC(peerId) {
    if (pcsRef.current[peerId]) return pcsRef.current[peerId];

    const pc = new RTCPeerConnection(ICE_CONFIG);

    // Relay encrypted ICE candidates
    pc.onicecandidate = async ({ candidate }) => {
      if (!candidate) return;
      const key    = keyRef.current;
      const socket = socketRef.current;
      if (!key || !socket) return;
      try {
        const encryptedPayload = await encrypt(key, candidate.toJSON());
        socket.emit('walkie:candidate', {
          eventId: eventIdRef.current,
          to:      peerId,
          encryptedPayload,
        });
      } catch (e) {
        console.warn('[walkie] ICE encrypt error:', e.message);
      }
    };

    // Play incoming audio by attaching to a hidden <audio> element.
    // We must call audio.play() explicitly — browsers (especially Chrome/Safari)
    // block the autoplay attribute on dynamically-created elements unless the
    // page has already received a user gesture.  The PTT button press counts as
    // a gesture, so play() reliably succeeds here.
    pc.ontrack = (evt) => {
      const existing = document.querySelector(`[data-walkie="${peerId}"]`);
      if (existing) {
        existing.srcObject = evt.streams[0];
        existing.play().catch(() => {});
        return;
      }
      const audio = document.createElement('audio');
      audio.autoplay   = true;
      audio.muted      = false;
      audio.setAttribute('data-walkie', peerId);
      audio.srcObject  = evt.streams[0];
      document.body.appendChild(audio);
      // Explicitly call play() to satisfy browser autoplay policies
      audio.play().catch((err) => {
        console.warn('[walkie] audio autoplay blocked, retrying on next user gesture:', err.message);
        // Queue a retry on the next click/touch anywhere on the page
        const retry = () => {
          audio.play().catch(() => {});
          document.removeEventListener('click',     retry);
          document.removeEventListener('touchstart', retry);
          document.removeEventListener('keydown',    retry);
        };
        document.addEventListener('click',      retry, { once: true });
        document.addEventListener('touchstart', retry, { once: true });
        document.addEventListener('keydown',    retry, { once: true });
      });
    };

    pc.onconnectionstatechange = () => {
      console.log(`[walkie] peer ${peerId} connectionState → ${pc.connectionState}`);
      if (pc.connectionState === 'failed') {
        console.warn(`[walkie] connection to ${peerId} failed, attempting ICE restart`);
        // Attempt an ICE restart before giving up entirely
        if (pc.signalingState === 'stable') {
          pc.restartIce();
          // Re-offer with ICE restart flag so the remote side renegotiates
          const key    = keyRef.current;
          const socket = socketRef.current;
          if (key && socket) {
            pc.createOffer({ iceRestart: true, offerToReceiveAudio: true })
              .then(offer => pc.setLocalDescription(offer))
              .then(async () => {
                const encryptedPayload = await encrypt(keyRef.current, { sdp: pc.localDescription.sdp });
                socketRef.current?.emit('walkie:offer', { eventId: eventIdRef.current, to: peerId, encryptedPayload });
              })
              .catch(e => {
                console.warn('[walkie] ICE restart offer failed:', e.message);
                closePeer(peerId);
              });
          } else {
            closePeer(peerId);
          }
        } else {
          closePeer(peerId);
        }
      } else if (pc.connectionState === 'closed') {
        closePeer(peerId);
      }
    };

    // Add a silent placeholder so the connection negotiates before PTT is pressed
    const silentTrack = getSilentStream().getAudioTracks()[0];
    if (silentTrack) pc.addTrack(silentTrack, getSilentStream());

    pcsRef.current[peerId] = pc;
    return pc;
  }

  // -------------------------------------------------------------------------
  // Initiate an offer to a newly joined peer
  // -------------------------------------------------------------------------
  async function initiateOffer(peerId) {
    const key    = keyRef.current;
    const socket = socketRef.current;
    if (!key || !socket) return;

    const pc = getOrCreatePC(peerId);

    try {
      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);

      const encryptedPayload = await encrypt(key, { sdp: offer.sdp });
      socket.emit('walkie:offer', {
        eventId: eventIdRef.current,
        to:      peerId,
        encryptedPayload,
      });
    } catch (e) {
      console.warn('[walkie] offer creation failed:', e.message);
    }
  }

  // -------------------------------------------------------------------------
  // Handle an incoming offer (callee side)
  // -------------------------------------------------------------------------
  async function handleRemoteOffer(peerId, _peerUsername, sdp) {
    const key    = keyRef.current;
    const socket = socketRef.current;
    if (!key || !socket) return;

    const pc = getOrCreatePC(peerId);

    try {
      await pc.setRemoteDescription({ type: 'offer', sdp });

      // If PTT is live, swap the silent placeholder for the real mic track
      if (localStreamRef.current) {
        const micTrack = localStreamRef.current.getAudioTracks()[0];
        const sender   = pc.getSenders().find(s => s.track?.kind === 'audio');
        if (sender && micTrack) await sender.replaceTrack(micTrack);
      }

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      const encryptedPayload = await encrypt(key, { sdp: answer.sdp });
      socket.emit('walkie:answer', {
        eventId: eventIdRef.current,
        to:      peerId,
        encryptedPayload,
      });
    } catch (e) {
      console.warn('[walkie] answer creation failed:', e.message);
    }
  }

  // -------------------------------------------------------------------------
  // Start PTT — capture mic and push to all peer connections
  // -------------------------------------------------------------------------
  const startPTT = useCallback(async () => {
    if (isSpeaking) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl:  true,
          sampleRate:       16000,
        },
        video: false,
      });

      localStreamRef.current = stream;
      const micTrack = stream.getAudioTracks()[0];

      // Push live mic to all existing peer connections
      for (const [peerId, pc] of Object.entries(pcsRef.current)) {
        const sender = pc.getSenders().find(s => s.track?.kind === 'audio');
        if (sender) {
          await sender.replaceTrack(micTrack).catch(e => {
            console.warn(`[walkie] replaceTrack failed for ${peerId}:`, e.message);
          });
        }
      }

      setIsSpeaking(true);
      socketRef.current?.emit('walkie:ptt_start', { eventId: eventIdRef.current });

    } catch (e) {
      const msg = e.name === 'NotAllowedError'
        ? 'Microphone access denied. Allow microphone permission in your browser settings.'
        : `Could not open microphone: ${e.message}`;
      setError(msg);
    }
  }, [isSpeaking]);

  // -------------------------------------------------------------------------
  // Stop PTT — revert to silent placeholder on all peer connections
  // -------------------------------------------------------------------------
  const stopPTT = useCallback(async () => {
    if (!isSpeaking) return;

    // Stop all mic tracks immediately
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;

    // Revert all senders to silent placeholder
    const silentTrack = getSilentStream().getAudioTracks()[0];
    for (const pc of Object.values(pcsRef.current)) {
      const sender = pc.getSenders().find(s => s.track?.kind === 'audio');
      if (sender && silentTrack) {
        await sender.replaceTrack(silentTrack).catch(() => {});
      }
    }

    setIsSpeaking(false);
    socketRef.current?.emit('walkie:ptt_stop', { eventId: eventIdRef.current });
  }, [isSpeaking]);

  // -------------------------------------------------------------------------
  // Cleanup helpers
  // -------------------------------------------------------------------------
  function closePeer(peerId) {
    const pc = pcsRef.current[peerId];
    if (pc) {
      pc.close();
      delete pcsRef.current[peerId];
    }
    document.querySelectorAll(`[data-walkie="${peerId}"]`).forEach(el => el.remove());
  }

  function cleanupAllPeers() {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    Object.keys(pcsRef.current).forEach(closePeer);
    setIsSpeaking(false);
    setActiveSpeakers([]);
    setPeers([]);
  }

  return {
    isConnected,
    isSpeaking,
    peers,
    activeSpeakers,
    error,
    startPTT,
    stopPTT,
  };
}

export default useWalkieTalkie;
