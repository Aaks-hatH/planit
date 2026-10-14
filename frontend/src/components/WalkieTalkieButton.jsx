/**
 * components/WalkieTalkieButton.jsx
 *
 * Floating push-to-talk button for the staff check-in interface.
 *
 * Props
 * -----
 *   walkie — the object returned by useWalkieTalkie()
 */

import { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Radio, X } from 'lucide-react';

// ---------------------------------------------------------------------------
// Waveform visualiser — draws a simple animated bar chart using the Web Audio
// AnalyserNode from the active MediaStream. Falls back gracefully when there
// is no active stream.
// ---------------------------------------------------------------------------
function Waveform({ stream }) {
  const canvasRef   = useRef(null);
  const animRef     = useRef(null);
  const analyserRef = useRef(null);
  const dataRef     = useRef(null);

  useEffect(() => {
    if (!stream) {
      cancelAnimationFrame(animRef.current);
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    const audioCtx = new AudioContext();
    const source   = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64;
    source.connect(analyser);
    analyserRef.current = analyser;
    dataRef.current     = new Uint8Array(analyser.frequencyBinCount);

    function draw() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx   = canvas.getContext('2d');
      const data  = dataRef.current;
      analyser.getByteFrequencyData(data);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barW = canvas.width / data.length;
      for (let i = 0; i < data.length; i++) {
        const h = (data[i] / 255) * canvas.height;
        ctx.fillStyle = `rgba(16, 185, 129, ${0.4 + (data[i] / 255) * 0.6})`;
        ctx.fillRect(i * barW, canvas.height - h, barW - 1, h);
      }

      animRef.current = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(animRef.current);
      audioCtx.close().catch(() => {});
    };
  }, [stream]);

  return (
    <canvas
      ref={canvasRef}
      width={80}
      height={20}
      style={{ imageRendering: 'pixelated' }}
    />
  );
}

// ---------------------------------------------------------------------------
// Speaker banner — shown when a remote peer is transmitting
// ---------------------------------------------------------------------------
function SpeakerBanner({ speakers }) {
  if (!speakers.length) return null;

  const names = speakers.map(s => s.username).join(', ');
  const label = speakers.length === 1
    ? `${names} is speaking`
    : `${names} are speaking`;

  return (
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2 bg-emerald-700 text-white text-sm font-semibold rounded-xl shadow-lg animate-fade-in pointer-events-none select-none">
      <Radio className="w-4 h-4 shrink-0 animate-pulse" />
      <span>{label}</span>
      <span className="flex gap-0.5 items-end h-4">
        {[0.5, 1, 0.7, 1, 0.5].map((scale, i) => (
          <span
            key={i}
            className="w-1 bg-emerald-300 rounded-sm"
            style={{
              height:    `${scale * 100}%`,
              animation: `waveBar 0.6s ease-in-out ${i * 0.1}s infinite alternate`,
            }}
          />
        ))}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error toast
// ---------------------------------------------------------------------------
function WalkieError({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-28 right-4 z-50 max-w-xs bg-red-900 text-red-100 text-xs font-medium px-4 py-2.5 rounded-xl shadow-xl flex items-start gap-2">
      <MicOff className="w-3.5 h-3.5 mt-0.5 shrink-0" />
      <span className="flex-1">{message}</span>
      <button onClick={onDismiss} className="ml-1 text-red-300 hover:text-white shrink-0">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Peer count badge (shows how many staff are on the walkie channel)
// ---------------------------------------------------------------------------
function PeerBadge({ count }) {
  if (count === 0) return null;
  return (
    <span className="absolute -top-1 -right-1 w-4 h-4 flex items-center justify-center text-[10px] font-black bg-emerald-400 text-neutral-900 rounded-full ring-2 ring-neutral-900 select-none">
      {count > 9 ? '9+' : count}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function WalkieTalkieButton({ walkie }) {
  const {
    isConnected,
    isSpeaking,
    peers,
    activeSpeakers,
    error,
    startPTT,
    stopPTT,
  } = walkie;

  const [localError, setLocalError] = useState(null);
  const holdRef = useRef(false);

  // Mirror hook error into local state so the dismiss button works
  useEffect(() => {
    if (error) setLocalError(error);
  }, [error]);

  // -------------------------------------------------------------------------
  // Pointer events — mouse and touch
  // -------------------------------------------------------------------------
  const onPointerDown = async (e) => {
    e.preventDefault();
    if (holdRef.current) return;
    holdRef.current = true;
    await startPTT();
  };

  const onPointerUp = async (e) => {
    e.preventDefault();
    if (!holdRef.current) return;
    holdRef.current = false;
    await stopPTT();
  };

  // Safety net: if pointer leaves while held, release
  const onPointerLeave = async () => {
    if (!holdRef.current) return;
    holdRef.current = false;
    await stopPTT();
  };

  // -------------------------------------------------------------------------
  // Keyboard shortcut: Space to PTT (only when not in an input)
  // -------------------------------------------------------------------------
  useEffect(() => {
    const onKeyDown = async (e) => {
      if (e.key !== ' ' || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (holdRef.current) return;
      e.preventDefault();
      holdRef.current = true;
      await startPTT();
    };

    const onKeyUp = async (e) => {
      if (e.key !== ' ') return;
      if (!holdRef.current) return;
      holdRef.current = false;
      await stopPTT();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup',   onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup',   onKeyUp);
    };
  }, [startPTT, stopPTT]);

  if (!isConnected) return null;

  return (
    <>
      {/* Speaker banner */}
      <SpeakerBanner speakers={activeSpeakers} />

      {/* Error toast */}
      <WalkieError message={localError} onDismiss={() => setLocalError(null)} />

      {/* Floating PTT button */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-center gap-2 select-none">
        {/* "Hold to talk" label — visible while not speaking */}
        {!isSpeaking && (
          <span className={`text-[10px] font-bold uppercase tracking-widest whitespace-nowrap ${peers.length === 0 ? 'text-amber-400/70' : 'text-neutral-400'}`}>
            {peers.length === 0 ? 'No staff on channel' : 'Hold to talk'}
          </span>
        )}

        {/* Transmitting label + waveform */}
        {isSpeaking && (
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest animate-pulse">
              Transmitting
            </span>
          </div>
        )}

        {/* PTT button */}
        <div className="relative">
          <button
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerLeave}
            onContextMenu={e => e.preventDefault()} // prevent long-press menu on mobile
            aria-label={isSpeaking ? 'Release to stop transmitting' : 'Hold to transmit (Space)'}
            className={[
              'relative w-16 h-16 rounded-full flex items-center justify-center',
              'shadow-lg transition-all duration-100 active:scale-95',
              'ring-4 focus:outline-none cursor-pointer touch-none',
              isSpeaking
                ? 'bg-emerald-500 ring-emerald-300 scale-110 shadow-emerald-500/50 shadow-xl'
                : 'bg-neutral-800 ring-neutral-600 hover:bg-neutral-700 hover:ring-neutral-500',
            ].join(' ')}
          >
            <Mic
              className={[
                'w-7 h-7 transition-colors',
                isSpeaking ? 'text-white' : 'text-neutral-300',
              ].join(' ')}
            />

            {/* Pulse ring while transmitting */}
            {isSpeaking && (
              <span
                className="absolute inset-0 rounded-full bg-emerald-400 opacity-30 animate-ping"
                aria-hidden="true"
              />
            )}
          </button>

          {/* Peer count badge */}
          <PeerBadge count={peers.length} />
        </div>

        {/* Keyboard shortcut hint */}
        {!isSpeaking && (
          <span className="hidden lg:block text-[9px] text-neutral-600 font-mono">
            [Space]
          </span>
        )}
      </div>

      {/* Keyframe styles injected inline — avoids needing a separate CSS file */}
      <style>{`
        @keyframes waveBar {
          from { transform: scaleY(0.3); }
          to   { transform: scaleY(1.0); }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translate(-50%, -6px); }
          to   { opacity: 1; transform: translate(-50%, 0);    }
        }
        .animate-fade-in {
          animation: fade-in 0.15s ease-out both;
        }
      `}</style>
    </>
  );
}
