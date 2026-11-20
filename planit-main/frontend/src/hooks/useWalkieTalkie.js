/**
 * hooks/useWalkieTalkie.js
 *
 * Staff Walkie-Talkie — WebRTC Push-to-Talk
 *
 * Fixes in this version (on top of the earlier ones):
 *  A. Incoming offers / answers / ICE candidates were silently DROPPED if they
 *     arrived before the PBKDF2 key finished deriving (200k iterations, often
 *     1s+ on phones). The existing staff send their offer the instant you join,
 *     so on a cold page load the handshake usually died and nobody heard anyone.
 *     Every handler now awaits the key, and we don't join the room until the key
 *     is ready.
 *  B. Double join: the "connect" re-join handler and the initial join could both
 *     fire, producing two peer_joined events and two competing offers. There is
 *     now a single join path (joins immediately if connected, otherwise on connect).
 *  C. After a socket reconnect the socket id changes, so old peer connections are
 *     torn down before re-joining.
 *  D. ICE candidates that arrive before the peer connection exists are queued
 *     instead of dropped.
 *  E. Releasing the button while the mic permission prompt / getUserMedia was
 *     still pending used to leave the mic stuck "on". Now the late stream is
 *     discarded.
 *  F. Removed the sampleRate constraint (can trigger OverconstrainedError on
 *     some devices; WebRTC resamples anyway).
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// ICE config: set VITE_TURN_URL, VITE_TURN_USERNAME, VITE_TURN_CREDENTIAL for a
// real TURN service. The free openrelay fallback is unreliable and often dead.
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
      { urls: 'turn:openrelay.metered.ca:80',               username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turn:openrelay.metered.ca:443',              username: 'openrelayproject', credential: 'openrelayproject' },
      { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
    ]),
  ],
  iceCandidatePoolSize: 4,
};

// Key is derived from the eventId (shared by everyone in the event) so every
// participant can decrypt each other's signaling payloads.
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

// Derive once per event per page load, share the promise.
const keyCache = new Map();
function getSignalingKey(eventId) {
  const id = String(eventId);
  if (!keyCache.has(id)) {
    const p = deriveSignalingKey(id);
    p.catch(() => keyCache.delete(id));
    keyCache.set(id, p);
  }
  return keyCache.get(id);
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
  const pendingCandidates = useRef({});   // per-peer ICE candidate queue
  const isSpeakingRef     = useRef(false);
  const wantSpeakingRef   = useRef(false); // true from button-down until button-up
  const silentCtxRef      = useRef(null);
  const silentStreamRef   = useRef(null);
  const eventIdRef        = useRef(eventId);
  const socketRef         = useRef(socket);

  eventIdRef.current = eventId;
  socketRef.current  = socket;

  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);

  // ── Key helper: returns the key, waiting for derivation if needed ─────
  async function getKey() {
    if (keyRef.current) return keyRef.current;
    const k = await getSignalingKey(eventIdRef.current);
    keyRef.current = k;
    return k;
  }

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

  // ── Pre-warm the crypto key as soon as we know the event ──────────────
  useEffect(() => {
    if (!eventId) return;
    keyRef.current = null;
    let cancelled = false;
    getSignalingKey(eventId)
      .then(k => { if (!cancelled) keyRef.current = k; })
      .catch(e => { if (!cancelled) setError(`Crypto init failed: ${e.message}`); });
    return () => { cancelled = true; };
  }, [eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Join / re-join the walkie room (single path) ──────────────────────
  // Joins right away if the socket is connected, otherwise on 'connect'.
  // 'connect' also fires after every reconnect, when our socket id has changed,
  // so stale peer connections are dropped first. We wait for the key BEFORE
  // joining so incoming offers can always be decrypted.
  useEffect(() => {
    if (!socket || !eventId) return;
    let cancelled = false;

    const join = async () => {
      cleanupAllPeers();
      try { await getKey(); } catch { return; }
      if (cancelled || !socket.connected) return;
      socket.emit('walkie:join', { eventId });
      setIsConnected(true);
    };

    if (socket.connected) join();
    socket.on('connect', join);

    return () => {
      cancelled = true;
      socket.off('connect', join);
      if (socket.connected) socket.emit('walkie:leave', { eventId });
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
      initiateOffer(socketId);
    };

    const onPeerLeft = ({ socketId }) => {
      setPeers(prev => prev.filter(p => p.socketId !== socketId));
      setActiveSpeakers(prev => prev.filter(s => s.socketId !== socketId));
      closePeer(socketId);
    };

    const onOffer = async ({ from, fromUsername, encryptedPayload }) => {
      try {
        const key = await getKey();
        const { sdp } = await decrypt(key, encryptedPayload);
        await handleRemoteOffer(from, fromUsername, sdp);
      } catch (e) {
        console.warn('[walkie] offer error:', e.message);
      }
    };

    const onAnswer = async ({ from, encryptedPayload }) => {
      try {
        const key = await getKey();
        const { sdp } = await decrypt(key, encryptedPayload);
        const pc = pcsRef.current[from];
        if (!pc || pc.signalingState !== 'have-local-offer') return;
        await pc.setRemoteDescription({ type: 'answer', sdp });
        await flushCandidates(from);
      } catch (e) {
        console.warn('[walkie] answer error:', e.message);
      }
    };

    const onCandidate = async ({ from, encryptedPayload }) => {
      try {
        const key = await getKey();
        const candidate = await decrypt(key, encryptedPayload);
        const pc = pcsRef.current[from];
        if (!pc || !pc.remoteDescription) {
          // Queue until the peer connection exists AND has a remote description
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
      const sock = socketRef.current;
      if (!sock) return;
      try {
        const key = await getKey();
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
        audio.playsInline = true;
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
        if (pc.signalingState === 'stable' && socketRef.current) {
          pc.createOffer({ iceRestart: true, offerToReceiveAudio: true })
            .then(offer => pc.setLocalDescription(offer))
            .then(async () => {
              const key = await getKey();
              const encryptedPayload = await encrypt(key, { sdp: pc.localDescription.sdp });
              socketRef.current?.emit('walkie:offer', { eventId: eventIdRef.current, to: peerId, encryptedPayload });
            })
            .catch(() => closePeer(peerId));
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
    const sock = socketRef.current;
    if (!sock) return;
    let key;
    try { key = await getKey(); } catch { return; }
    if (pcsRef.current[peerId]) return; // already negotiating with this peer
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
    const sock = socketRef.current;
    if (!sock) return;
    const key = await getKey();
    const pc  = getOrCreatePC(peerId);
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
      await flushCandidates(peerId);
    } catch (e) {
      console.warn('[walkie] handleRemoteOffer failed:', e.message);
    }
  }

  // ── PTT start ─────────────────────────────────────────────────────────
  const startPTT = useCallback(async () => {
    if (isSpeakingRef.current || wantSpeakingRef.current) return;
    wantSpeakingRef.current = true;
    ensureSilentStream(); // resume AudioContext inside the user gesture
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl:  true,
        },
        video: false,
      });

      // Button was released while the mic was still opening (e.g. permission
      // prompt) — discard the stream instead of getting stuck transmitting.
      if (!wantSpeakingRef.current) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }

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
      wantSpeakingRef.current = false;
      const msg = e.name === 'NotAllowedError'
        ? 'Microphone access denied. Allow mic permission in browser settings.'
        : `Could not open mic: ${e.message}`;
      setError(msg);
    }
  }, []);

  // ── PTT stop ──────────────────────────────────────────────────────────
  const stopPTT = useCallback(async () => {
    wantSpeakingRef.current = false;
    if (!isSpeakingRef.current) return;
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
  }, []);

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
    isSpeakingRef.current   = false;
    wantSpeakingRef.current = false;
    setIsSpeaking(false);
    setActiveSpeakers([]);
    setPeers([]);
    pendingCandidates.current = {};
  }

  return { isConnected, isSpeaking, peers, activeSpeakers, error, startPTT, stopPTT };
}

export default useWalkieTalkie;
