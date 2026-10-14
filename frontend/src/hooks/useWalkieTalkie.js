/**
 * hooks/useWalkieTalkie.js
 *
 * Staff Walkie-Talkie — WebRTC Push-to-Talk
 *
 * Fixes vs original:
 *  1. ICE candidate queuing — candidates that arrive before setRemoteDescription
 *     are queued per-peer and flushed once the remote description is set.
 *  2. Crypto key race — if a peer joins before PBKDF2 finishes (200k iterations
 *     can take 300ms+), the peer is queued and the offer is sent once the key
 *     is ready, rather than silently dropped.
 *  3. isSpeaking ref — startPTT/stopPTT use a ref mirror so they never capture
 *     stale closure state regardless of React render timing.
 *  4. AudioContext resumption — browsers suspend AudioContext before a user
 *     gesture; we resume it explicitly before creating the silent stream.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// ICE config: prefer env-var TURN servers (set VITE_TURN_URL, VITE_TURN_USERNAME,
// VITE_TURN_CREDENTIAL in .env for a reliable paid TURN service).
// Falls back to free openrelay servers — fine for demos, unreliable for production.
const TURN_URL        = import.meta.env.VITE_TURN_URL;
const TURN_USERNAME   = import.meta.env.VITE_TURN_USERNAME;
const TURN_CREDENTIAL = import.meta.env.VITE_TURN_CREDENTIAL;

const ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    ...(TURN_URL ? [
      { urls: TURN_URL, username: TURN_USERNAME, credential: TURN_CREDENTIAL },
    ] : [
      // Free fallback — works for same-network; may fail across carrier-grade NAT
      { urls: 'turn:openrelay.metered.ca:80',              username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turn:openrelay.metered.ca:443',             username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
    ]),
  ],
  iceCandidatePoolSize: 4,
};

// Key is derived from the eventId (shared by all peers in the same event room)
// so that every participant can encrypt/decrypt each other's signaling payloads.
// Using the per-user JWT token here would give every user a different key, making
// cross-peer decryption impossible and silently breaking the WebRTC handshake.
async function deriveSignalingKey(eventId) {
  const enc         = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(String(eventId)), { name: 'PBKDF2' }, false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode('planit-walkie-v1'), iterations: 200_000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encrypt(key, obj) {
  const iv        = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(obj));
  const cipher    = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  const out       = new Uint8Array(iv.byteLength + cipher.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(cipher), iv.byteLength);
  return btoa(String.fromCharCode(...out));
}

async function decrypt(key, b64) {
  const raw    = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const iv     = raw.slice(0, 12);
  const cipher = raw.slice(12);
  const plain  = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
  return JSON.parse(new TextDecoder().decode(plain));
}

export function useWalkieTalkie(socket, eventId, token, username) {
  const [isConnected,    setIsConnected]    = useState(false);
  const [isSpeaking,     setIsSpeaking]     = useState(false);
  const [peers,          setPeers]          = useState([]);
  const [activeSpeakers, setActiveSpeakers] = useState([]);
  const [error,          setError]          = useState(null);

  const keyRef            = useRef(null);
  const pcsRef            = useRef({});
  const localStreamRef    = useRef(null);
  const pendingCandidates = useRef({});   // FIX 1: per-peer ICE candidate queue
  const pendingPeers      = useRef([]);   // FIX 2: peers queued until key ready
  const isSpeakingRef     = useRef(false);// FIX 3: ref mirror avoids stale closures
  const silentCtxRef      = useRef(null);
  const silentStreamRef   = useRef(null);
  const eventIdRef        = useRef(eventId);
  const socketRef         = useRef(socket);

  eventIdRef.current = eventId;
  socketRef.current  = socket;

  // Keep isSpeakingRef in sync with state
  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);

  // ── Silent placeholder stream ─────────────────────────────────────────
  function ensureSilentStream() {
    if (silentCtxRef.current) {
      if (silentCtxRef.current.state === 'suspended') {
        silentCtxRef.current.resume().catch(() => {});
      }
      return silentStreamRef.current;
    }
    try {
      const ctx  = new AudioContext();
      const dst  = ctx.createMediaStreamDestination();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0;
      osc.connect(gain);
      gain.connect(dst);
      osc.start();
      ctx.resume().catch(() => {});
      silentCtxRef.current    = ctx;
      silentStreamRef.current = dst.stream;
      return dst.stream;
    } catch {
      return null;
    }
  }

  // ── Crypto key derivation ─────────────────────────────────────────────
  useEffect(() => {
    if (!eventId) return;
    let cancelled = false;
    deriveSignalingKey(eventId)
      .then(k => {
        if (cancelled) return;
        keyRef.current = k;
        // FIX 2: process any peers that arrived before key was ready
        const queued = pendingPeers.current.splice(0);
        queued.forEach(peerId => initiateOffer(peerId));
      })
      .catch(e => setError(`Crypto init failed: ${e.message}`));
    return () => { cancelled = true; };
  }, [eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Re-join walkie room after socket reconnect ────────────────────────
  // Socket.IO fires 'connect' on every successful connection — including
  // reconnects. Without this the walkie room is lost after any network blip
  // because the server drops room membership on disconnect.
  useEffect(() => {
    if (!socket) return;
    const onReconnect = () => {
      if (eventIdRef.current) {
        socket.emit('walkie:join', { eventId: eventIdRef.current });
      }
    };
    socket.on('connect', onReconnect);
    return () => socket.off('connect', onReconnect);
  }, [socket]);

  // ── Join / leave walkie room ──────────────────────────────────────────
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

  // ── Socket event listeners ────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const onPeers = ({ peers: list }) => {
      setPeers(list);
      // Existing peers will send us offers — we just wait
    };

    const onPeerJoined = ({ socketId, username: u }) => {
      setPeers(prev => [...prev.filter(p => p.socketId !== socketId), { socketId, username: u }]);
      if (!keyRef.current) {
        // FIX 2: key not ready yet — queue this peer
        pendingPeers.current.push(socketId);
      } else {
        initiateOffer(socketId);
      }
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
        console.warn('[walkie] offer error:', e.message);
      }
    };

    const onAnswer = async ({ from, encryptedPayload }) => {
      try {
        if (!keyRef.current) return;
        const { sdp } = await decrypt(keyRef.current, encryptedPayload);
        const pc = pcsRef.current[from];
        if (!pc || pc.signalingState !== 'have-local-offer') return;
        await pc.setRemoteDescription({ type: 'answer', sdp });
        // FIX 1: flush candidates that arrived before remote desc was set
        await flushCandidates(from);
      } catch (e) {
        console.warn('[walkie] answer error:', e.message);
      }
    };

    const onCandidate = async ({ from, encryptedPayload }) => {
      try {
        if (!keyRef.current) return;
        const candidate = await decrypt(keyRef.current, encryptedPayload);
        const pc = pcsRef.current[from];
        if (!pc) return;
        if (!pc.remoteDescription) {
          // FIX 1: queue until remote description is available
          if (!pendingCandidates.current[from]) pendingCandidates.current[from] = [];
          pendingCandidates.current[from].push(candidate);
        } else {
          await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e =>
            console.warn('[walkie] addIceCandidate error:', e.message)
          );
        }
      } catch (e) {
        console.warn('[walkie] candidate error:', e.message);
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

  // ── Flush queued ICE candidates once remote desc is set ───────────────
  async function flushCandidates(peerId) {
    const queue = pendingCandidates.current[peerId];
    if (!queue?.length) return;
    const pc = pcsRef.current[peerId];
    if (!pc || !pc.remoteDescription) return;
    pendingCandidates.current[peerId] = [];
    for (const cand of queue) {
      await pc.addIceCandidate(new RTCIceCandidate(cand)).catch(e =>
        console.warn('[walkie] flush candidate error:', e.message)
      );
    }
  }

  // ── RTCPeerConnection factory ─────────────────────────────────────────
  function getOrCreatePC(peerId) {
    if (pcsRef.current[peerId]) return pcsRef.current[peerId];

    const pc = new RTCPeerConnection(ICE_CONFIG);

    pc.onicecandidate = async ({ candidate }) => {
      if (!candidate) return;
      const key  = keyRef.current;
      const sock = socketRef.current;
      if (!key || !sock) return;
      try {
        const encryptedPayload = await encrypt(key, candidate.toJSON());
        sock.emit('walkie:candidate', {
          eventId: eventIdRef.current,
          to:      peerId,
          encryptedPayload,
        });
      } catch (e) {
        console.warn('[walkie] ICE encrypt error:', e.message);
      }
    };

    pc.ontrack = (evt) => {
      let audio = document.querySelector(`[data-walkie="${peerId}"]`);
      if (!audio) {
        audio = document.createElement('audio');
        audio.setAttribute('data-walkie', peerId);
        audio.muted    = false;
        audio.autoplay = true;
        document.body.appendChild(audio);
      }
      audio.srcObject = evt.streams[0];
      audio.play().catch(err => {
        console.warn('[walkie] autoplay blocked, retrying on next gesture:', err.message);
        const retry = () => {
          audio.play().catch(() => {});
          document.removeEventListener('click',      retry);
          document.removeEventListener('touchstart', retry);
          document.removeEventListener('keydown',    retry);
        };
        document.addEventListener('click',      retry, { once: true });
        document.addEventListener('touchstart', retry, { once: true });
        document.addEventListener('keydown',    retry, { once: true });
      });
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        if (pc.signalingState === 'stable') {
          const key  = keyRef.current;
          const sock = socketRef.current;
          if (key && sock) {
            pc.createOffer({ iceRestart: true, offerToReceiveAudio: true })
              .then(offer => pc.setLocalDescription(offer))
              .then(async () => {
                const encryptedPayload = await encrypt(keyRef.current, { sdp: pc.localDescription.sdp });
                socketRef.current?.emit('walkie:offer', { eventId: eventIdRef.current, to: peerId, encryptedPayload });
              })
              .catch(() => closePeer(peerId));
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

    // Silent placeholder so the connection negotiates before PTT is pressed
    const silentStream = ensureSilentStream();
    if (silentStream) {
      const silentTrack = silentStream.getAudioTracks()[0];
      if (silentTrack) pc.addTrack(silentTrack, silentStream);
    }

    pcsRef.current[peerId] = pc;
    return pc;
  }

  // ── Initiate WebRTC offer ─────────────────────────────────────────────
  async function initiateOffer(peerId) {
    const key  = keyRef.current;
    const sock = socketRef.current;
    if (!key || !sock) return;
    const pc = getOrCreatePC(peerId);
    try {
      const offer = await pc.createOffer({ offerToReceiveAudio: true });
      await pc.setLocalDescription(offer);
      const encryptedPayload = await encrypt(key, { sdp: offer.sdp });
      sock.emit('walkie:offer', { eventId: eventIdRef.current, to: peerId, encryptedPayload });
    } catch (e) {
      console.warn('[walkie] offer failed:', e.message);
    }
  }

  // ── Handle incoming offer ─────────────────────────────────────────────
  async function handleRemoteOffer(peerId, _peerUsername, sdp) {
    const key  = keyRef.current;
    const sock = socketRef.current;
    if (!key || !sock) return;
    const pc = getOrCreatePC(peerId);
    try {
      await pc.setRemoteDescription({ type: 'offer', sdp });
      if (localStreamRef.current) {
        const micTrack = localStreamRef.current.getAudioTracks()[0];
        const sender   = pc.getSenders().find(s => s.track?.kind === 'audio');
        if (sender && micTrack) await sender.replaceTrack(micTrack);
      }
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      const encryptedPayload = await encrypt(key, { sdp: answer.sdp });
      sock.emit('walkie:answer', { eventId: eventIdRef.current, to: peerId, encryptedPayload });
      // FIX 1: flush any candidates that arrived before remote desc was set
      await flushCandidates(peerId);
    } catch (e) {
      console.warn('[walkie] handleRemoteOffer failed:', e.message);
    }
  }

  // ── PTT start ─────────────────────────────────────────────────────────
  const startPTT = useCallback(async () => {
    if (isSpeakingRef.current) return; // FIX 3: ref, not stale state
    ensureSilentStream(); // resume AudioContext before getUserMedia
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
      for (const [peerId, pc] of Object.entries(pcsRef.current)) {
        const sender = pc.getSenders().find(s => s.track?.kind === 'audio');
        if (sender) {
          await sender.replaceTrack(micTrack).catch(e =>
            console.warn('[walkie] replaceTrack failed for', peerId, ':', e.message)
          );
        }
      }
      isSpeakingRef.current = true;
      setIsSpeaking(true);
      socketRef.current?.emit('walkie:ptt_start', { eventId: eventIdRef.current });
    } catch (e) {
      const msg = e.name === 'NotAllowedError'
        ? 'Microphone access denied. Allow mic permission in browser settings.'
        : `Could not open mic: ${e.message}`;
      setError(msg);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── PTT stop ──────────────────────────────────────────────────────────
  const stopPTT = useCallback(async () => {
    if (!isSpeakingRef.current) return; // FIX 3: ref, not stale state
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    const silentStream = ensureSilentStream();
    if (silentStream) {
      const silentTrack = silentStream.getAudioTracks()[0];
      for (const pc of Object.values(pcsRef.current)) {
        const sender = pc.getSenders().find(s => s.track?.kind === 'audio');
        if (sender && silentTrack) {
          await sender.replaceTrack(silentTrack).catch(() => {});
        }
      }
    }
    isSpeakingRef.current = false;
    setIsSpeaking(false);
    socketRef.current?.emit('walkie:ptt_stop', { eventId: eventIdRef.current });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cleanup ───────────────────────────────────────────────────────────
  function closePeer(peerId) {
    pcsRef.current[peerId]?.close();
    delete pcsRef.current[peerId];
    delete pendingCandidates.current[peerId];
    document.querySelectorAll(`[data-walkie="${peerId}"]`).forEach(el => el.remove());
  }

  function cleanupAllPeers() {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    Object.keys(pcsRef.current).forEach(closePeer);
    isSpeakingRef.current = false;
    setIsSpeaking(false);
    setActiveSpeakers([]);
    setPeers([]);
    pendingPeers.current      = [];
    pendingCandidates.current = {};
  }

  return { isConnected, isSpeaking, peers, activeSpeakers, error, startPTT, stopPTT };
}

export default useWalkieTalkie;
