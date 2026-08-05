import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ScanFace, QrCode, Fingerprint, ShieldAlert,
  Camera, CameraOff, RefreshCw, Download, CheckCircle2, XCircle,
  AlertTriangle, Radar, Sparkles, Lock,
  ChevronRight, Ticket, Loader2, ScanLine, Smartphone,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useCameraStream } from '../hooks/useCameraStream';
import {
  loadFaceModels, detectFaceWithDescriptor, quantizeEmbedding, dequantizeEmbedding,
  cosineSimilarity, packTicketPayload, unpackTicketPayload, runLivenessCapture,
  formatConfidence,
} from '../utils/faceTicket';
import StepIndicator from '../components/StepIndicator';
import DemoFeedback from '../components/DemoFeedback';

// Match decision band — the spec suggests tuning around 0.6-0.7 depending on
// the model's score distribution. face-api.js's recognition net tends to sit
// a little lower for genuine matches than some other embedding models, so
// this is calibrated for it specifically rather than copied from elsewhere.
const MATCH_THRESHOLD = 0.58;

// ═══════════════════════════════════════════════════════════════════════════
// SIGNATURE ELEMENT — Embedding Barcode
//
// The literal 128-byte quantized face embedding, rendered as a strip of
// bars. This isn't decoration: it's the actual data that goes into the QR
// code, visualized. Two people's bars never look the same; the same
// person's bars from two different photos look similar but not identical —
// which is exactly the property the matching step is testing for.
// ═══════════════════════════════════════════════════════════════════════════
function EmbeddingBarcode({ bytes, height = 56, tone = 'violet', className = '' }) {
  if (!bytes || !bytes.length) return null;
  const colors = {
    violet: ['#8B7FFF', '#5EEAD4'],
    teal: ['#5EEAD4', '#8B7FFF'],
    rose: ['#FB7185', '#F0B429'],
  }[tone] || ['#8B7FFF', '#5EEAD4'];

  // Bars flex to fill their container's width instead of a fixed pixel
  // width, so 96-128 bars never overflow a narrow phone screen — they just
  // get thinner. min-width keeps them from vanishing entirely on very
  // small viewports (they'll wrap onto invisible overflow instead, which
  // is fine since it's decorative).
  return (
    <div className={`flex items-end gap-[1px] w-full overflow-hidden ${className}`} style={{ height }}>
      {Array.from(bytes).map((b, i) => {
        const t = b / 255;
        const barHeight = Math.max(3, t * height);
        const color = t > 0.5 ? colors[1] : colors[0];
        return (
          <div
            key={i}
            style={{
              height: barHeight,
              flex: '1 1 0',
              minWidth: 1,
              maxWidth: 3,
              background: color,
              opacity: 0.35 + t * 0.65,
              borderRadius: 1,
            }}
          />
        );
      })}
    </div>
  );
}

function DemoBarcode({ height = 56, className = '' }) {
  const [bytes, setBytes] = useState(() => randomBytes());
  useEffect(() => {
    const id = setInterval(() => setBytes(randomBytes()), 1400);
    return () => clearInterval(id);
  }, []);
  return <EmbeddingBarcode bytes={bytes} height={height} className={className} />;
}

function randomBytes() {
  const arr = new Uint8Array(96);
  for (let i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random() * 256);
  return arr;
}

// ═══════════════════════════════════════════════════════════════════════════
// SHARED CHROME
// ═══════════════════════════════════════════════════════════════════════════
function BetaBar() {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border-b border-amber-400/20 bg-amber-400/[0.06]">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-2 px-4 py-2 text-left"
      >
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span className="text-[11px] font-mono tracking-wide text-amber-300/90 flex-1">
          BETA DEMO &mdash; not a production security system
        </span>
        <ChevronRight className={`w-3.5 h-3.5 text-amber-400/60 transition-transform ${expanded ? 'rotate-90' : ''}`} />
      </button>
      {expanded && (
        <div className="px-4 pb-3 -mt-0.5 text-[12px] leading-relaxed text-neutral-400 max-w-2xl">
          This is a proof of concept. A printed photo or a photo on another screen could
          potentially fool a single-frame match if no live person is actually present &mdash;
          the liveness check here is a best-effort beta signal, not spoof-proof. No face
          image or embedding is stored anywhere beyond your current browser tab and the
          QR code itself; nothing is ever sent to a server.
        </div>
      )}
    </div>
  );
}

function PageChrome({ onBack, right, children }) {
  return (
    <div
      className="min-h-screen bg-[#05050f] text-white flex flex-col"
      style={{ paddingTop: 'var(--safe-top, 0px)', paddingBottom: 'var(--safe-bottom, 0px)' }}
    >
      <BetaBar />
      <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-white/[0.06]">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-neutral-400 hover:text-white active:text-white transition-colors text-sm -ml-2 px-2 py-1.5 rounded-lg"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <div className="flex items-center gap-2 font-display font-bold tracking-tight text-sm">
          <ScanFace className="w-4 h-4 text-[#8B7FFF]" />
          Face Ticket
        </div>
        <div className="w-16 flex justify-end">{right}</div>
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LANDING
// ═══════════════════════════════════════════════════════════════════════════
function LandingScreen({ onEnroll, onScan }) {
  return (
    <div className="max-w-6xl mx-auto px-5 sm:px-8 py-12 sm:py-20">
      <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
        <div>
          <div className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.15em] text-[#8B7FFF] uppercase mb-5">
            <Sparkles className="w-3 h-3" />
            PlanIt Labs &middot; Experimental
          </div>
          <h1 className="font-display font-extrabold text-[2.6rem] sm:text-6xl leading-[1.03] tracking-tight mb-5">
            Your face<br />is the ticket.
          </h1>
          <p className="text-neutral-400 text-base sm:text-lg leading-relaxed max-w-md mb-8">
            Take a selfie, get a QR code. At the door, a camera checks that the person
            holding the ticket is the person who enrolled &mdash; entirely on-device.
            No account, no server-side face storage.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mb-10">
            <button
              onClick={onEnroll}
              className="group flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#8B7FFF] text-[#0a0714] font-bold text-sm hover:bg-[#9d92ff] transition-colors"
            >
              <Camera className="w-4 h-4" />
              Get my ticket
              <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </button>
            <button
              onClick={onScan}
              className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-white/15 text-white font-semibold text-sm hover:bg-white/5 transition-colors"
            >
              <ScanLine className="w-4 h-4" />
              Scan a ticket
            </button>
          </div>
          <div className="flex items-center gap-2 text-[12px] text-neutral-500 font-mono">
            <Lock className="w-3.5 h-3.5" />
            Your face never leaves your device
          </div>
        </div>

        <div className="relative">
          <div className="absolute -inset-6 bg-[#8B7FFF]/10 blur-3xl rounded-full" />
          <div className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-5">
              <span className="font-mono text-[10px] tracking-widest text-neutral-500 uppercase">Sample ticket</span>
              <ScanFace className="w-4 h-4 text-neutral-600" />
            </div>
            <div className="flex gap-5">
              <div className="w-28 h-28 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                <QrCode className="w-14 h-14 text-neutral-600" strokeWidth={1} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display font-bold text-lg truncate">Alex Chen</div>
                <div className="text-neutral-500 text-xs mb-3">Founders&rsquo; Night &middot; Seat FT-7042</div>
                <DemoBarcode height={44} />
              </div>
            </div>
            <div className="mt-5 pt-4 border-t border-white/10 flex items-center justify-between font-mono text-[10px] text-neutral-500">
              <span>128 floats \u2192 128 bytes</span>
              <span className="text-teal-400/80">4x smaller</span>
            </div>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="mt-24 sm:mt-32 grid sm:grid-cols-3 gap-6 sm:gap-8">
        {[
          { n: '01', title: 'Enroll', body: 'Your browser generates a face embedding \u2014 a 128-number fingerprint of your face \u2014 and shrinks it to 128 bytes.', icon: Fingerprint },
          { n: '02', title: 'Carry', body: 'The compressed embedding is packed into a QR code that becomes your ticket. That\u2019s the only place it lives.', icon: Ticket },
          { n: '03', title: 'Verify', body: 'At the door, a camera re-generates your embedding and compares it to the one in the QR \u2014 plus a quick liveness check.', icon: Radar },
        ].map((step) => (
          <div key={step.n}>
            <div className="flex items-center gap-3 mb-3">
              <span className="font-mono text-xs text-[#8B7FFF]">{step.n}</span>
              <step.icon className="w-4 h-4 text-neutral-500" />
            </div>
            <h3 className="font-display font-bold text-lg mb-1.5">{step.title}</h3>
            <p className="text-neutral-500 text-sm leading-relaxed">{step.body}</p>
          </div>
        ))}
      </div>

      {/* Disclaimer panel */}
      <div className="mt-20 rounded-xl border border-amber-400/20 bg-amber-400/[0.04] p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-3">
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          <span className="font-display font-bold text-sm">Read before you try it</span>
        </div>
        <ul className="space-y-2 text-sm text-neutral-400 leading-relaxed">
          <li>&bull; This is a proof of concept, not a production security system.</li>
          <li>&bull; A printed photo or a photo shown on another screen could potentially fool a single-frame match if no live person is present.</li>
          <li>&bull; The liveness check (blink + motion) is a best-effort beta signal, not spoof-proof.</li>
          <li>&bull; No face image or embedding is stored anywhere beyond this browser session and the QR code itself.</li>
        </ul>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MODEL LOADING GATE
// ═══════════════════════════════════════════════════════════════════════════
const LOAD_LABELS = {
  engine: 'Starting recognition engine\u2026',
  detector: 'Loading face detector\u2026',
  landmarks: 'Loading landmark model\u2026',
  embedding: 'Loading embedding model\u2026',
  ready: 'Ready',
};

function useFaceModels() {
  const [stage, setStage] = useState('idle');
  const [error, setError] = useState(null);
  const load = useCallback(async () => {
    setStage('engine');
    setError(null);
    try {
      await loadFaceModels((s) => setStage(s));
    } catch (err) {
      console.error('Failed to load face models', err);
      setError('Could not load the on-device face model. Check your connection and retry.');
    }
  }, []);
  return { stage, error, load, ready: stage === 'ready' };
}

function ModelLoadingCard({ stage, error, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      {error ? (
        <>
          <AlertTriangle className="w-10 h-10 text-rose-400 mb-4" />
          <p className="text-sm text-neutral-300 mb-6 max-w-xs">{error}</p>
          <button onClick={onRetry} className="px-5 py-2.5 rounded-lg bg-white text-black text-sm font-semibold">Retry</button>
        </>
      ) : (
        <>
          <Loader2 className="w-8 h-8 text-[#8B7FFF] animate-spin mb-4" />
          <p className="font-mono text-xs text-neutral-400">{LOAD_LABELS[stage] || 'Loading\u2026'}</p>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ENROLL FLOW
// ═══════════════════════════════════════════════════════════════════════════
const ENROLL_STEP_LABELS = ['Take selfie', 'Ticket details', 'Ticket ready'];

function EnrollFlow({ onDone, onComplete }) {
  const [step, setStep] = useState('camera'); // camera -> processing -> details -> ticket
  const enrollStepIdx = step === 'ticket' ? 2 : step === 'details' ? 1 : 0;
  const { videoRef, ready, error: camError, start, stop } = useCameraStream();
  const models = useFaceModels();
  const [captureError, setCaptureError] = useState(null);
  const [capturing, setCapturing] = useState(false);
  const [descriptor, setDescriptor] = useState(null); // Float32Array(128)
  const [quantized, setQuantized] = useState(null);

  const [form, setForm] = useState({
    name: '',
    eventName: 'PlanIt Beta Event',
    seatId: `FT-${Math.floor(1000 + Math.random() * 9000)}`,
  });
  const [ticket, setTicket] = useState(null); // { payload, qrDataUrl, byteLength, trimmed }
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    models.load();
    start();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const capture = async () => {
    if (!models.ready || capturing) return;
    setCapturing(true);
    setCaptureError(null);
    try {
      const result = await detectFaceWithDescriptor(videoRef.current);
      if (!result) {
        setCaptureError('No face detected. Move into better light and center your face in the frame.');
        return;
      }
      const q = quantizeEmbedding(result.descriptor);
      setDescriptor(result.descriptor);
      setQuantized(q);
      stop();
      setStep('details');
    } catch (err) {
      console.error(err);
      setCaptureError('Something went wrong reading your face. Try again.');
    } finally {
      setCapturing(false);
    }
  };

  const generateTicket = async () => {
    if (!form.name.trim()) {
      toast.error('Add a name for your ticket');
      return;
    }
    setGenerating(true);
    try {
      const { json, byteLength, trimmed } = packTicketPayload({
        name: form.name, eventName: form.eventName, seatId: form.seatId, quantized,
      });
      const QRCode = (await import('qrcode')).default;
      const qrDataUrl = await QRCode.toDataURL(json, {
        errorCorrectionLevel: 'H',
        margin: 1,
        width: 480,
        color: { dark: '#0a0714ff', light: '#ffffffff' },
      });
      setTicket({ json, byteLength, trimmed, qrDataUrl });
      setStep('ticket');
    } catch (err) {
      console.error(err);
      toast.error('Could not generate the QR ticket. Try again.');
    } finally {
      setGenerating(false);
    }
  };

  const downloadQR = () => {
    if (!ticket) return;
    const a = document.createElement('a');
    a.href = ticket.qrDataUrl;
    a.download = `face-ticket-${form.seatId}.png`;
    a.click();
  };

  // ── camera step ──
  if (step === 'camera') {
    return (
      <>
      <StepIndicator labels={ENROLL_STEP_LABELS} index={enrollStepIdx} />
      <div className="max-w-md mx-auto px-5 py-10">
        <h2 className="font-display font-bold text-2xl mb-1.5">Take your selfie</h2>
        <p className="text-neutral-500 text-sm mb-6">
          Center your face, good lighting helps. This photo never leaves your browser.
        </p>

        <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-black border border-white/10 mb-4">
          {camError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
              <CameraOff className="w-10 h-10 text-rose-400 mb-3" />
              <p className="text-sm text-neutral-300 mb-4">{camError}</p>
              <button onClick={start} className="px-4 py-2 rounded-lg bg-white text-black text-sm font-semibold">Retry camera</button>
            </div>
          ) : (
            <>
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
              <div className="absolute inset-8 border-2 border-dashed border-white/30 rounded-full pointer-events-none" />
              {!models.ready && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <ModelLoadingCard stage={models.stage} error={models.error} onRetry={models.load} />
                </div>
              )}
            </>
          )}
        </div>

        {captureError && (
          <div className="flex items-start gap-2 text-sm text-amber-300 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2.5 mb-4">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            {captureError}
          </div>
        )}

        <button
          onClick={capture}
          disabled={!ready || !models.ready || capturing}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#8B7FFF] text-[#0a0714] font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#9d92ff] transition-colors"
        >
          {capturing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
          {capturing ? 'Reading your face\u2026' : 'Capture'}
        </button>
      </div>
      </>
    );
  }

  // ── details step ──
  if (step === 'details') {
    return (
      <>
      <StepIndicator labels={ENROLL_STEP_LABELS} index={enrollStepIdx} />
      <div className="max-w-md mx-auto px-5 py-10">
        <div className="flex items-center gap-2 text-teal-300 text-sm mb-1.5">
          <CheckCircle2 className="w-4 h-4" />
          Face captured
        </div>
        <h2 className="font-display font-bold text-2xl mb-1.5">Ticket details</h2>
        <p className="text-neutral-500 text-sm mb-6">Demo info only &mdash; nothing here is verified against a real event.</p>

        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 mb-5">
          <span className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">Your embedding, compressed</span>
          <EmbeddingBarcode bytes={quantized.bytes} height={40} className="mt-3" />
          <div className="mt-2 text-[11px] font-mono text-neutral-600">128 bytes &middot; range [{quantized.min.toFixed(2)}, {quantized.max.toFixed(2)}]</div>
        </div>

        <div className="space-y-4 mb-8">
          <Field label="Name">
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Your name" maxLength={28}
              className="w-full bg-transparent border-b border-white/15 focus:border-[#8B7FFF] outline-none py-2 text-sm" />
          </Field>
          <Field label="Event name">
            <input value={form.eventName} onChange={(e) => setForm((f) => ({ ...f, eventName: e.target.value }))}
              maxLength={32}
              className="w-full bg-transparent border-b border-white/15 focus:border-[#8B7FFF] outline-none py-2 text-sm" />
          </Field>
          <Field label="Seat / ticket ID">
            <input value={form.seatId} onChange={(e) => setForm((f) => ({ ...f, seatId: e.target.value }))}
              maxLength={12}
              className="w-full bg-transparent border-b border-white/15 focus:border-[#8B7FFF] outline-none py-2 text-sm font-mono" />
          </Field>
        </div>

        <button
          onClick={generateTicket}
          disabled={generating}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#8B7FFF] text-[#0a0714] font-bold text-sm disabled:opacity-50"
        >
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
          {generating ? 'Generating QR\u2026' : 'Generate my ticket'}
        </button>
      </div>
      </>
    );
  }

  // ── ticket step ──
  if (step === 'ticket' && ticket) {
    return (
      <>
      <StepIndicator labels={ENROLL_STEP_LABELS} index={enrollStepIdx} />
      <div className="max-w-md mx-auto px-5 py-10">
        <div className="flex items-center gap-2 text-teal-300 text-sm mb-4">
          <Sparkles className="w-4 h-4" />
          Ticket ready
        </div>

        <div className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-6 mb-6">
          <div className="flex items-center justify-between mb-5">
            <span className="font-display font-bold text-lg">{form.eventName}</span>
            <ScanFace className="w-4 h-4 text-neutral-500" />
          </div>
          <div className="bg-white rounded-xl p-3 mb-5 flex items-center justify-center">
            <img src={ticket.qrDataUrl} alt="Face ticket QR code" className="w-full max-w-[280px]" />
          </div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-semibold">{form.name}</div>
              <div className="text-neutral-500 text-xs font-mono">{form.seatId}</div>
            </div>
            <div className="text-right font-mono text-[10px] text-neutral-500">
              <div>{ticket.byteLength} B payload</div>
              <div className="text-teal-400/80">QR level H</div>
            </div>
          </div>
          <EmbeddingBarcode bytes={quantized.bytes} height={32} tone="teal" />
        </div>

        {ticket.trimmed && (
          <div className="flex items-start gap-2 text-xs text-amber-300 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2.5 mb-4">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            Ticket details were shortened slightly to keep the QR code reliably scannable.
          </div>
        )}

        <div className="flex items-center gap-2 text-[12px] text-neutral-500 font-mono mb-6">
          <Lock className="w-3.5 h-3.5" />
          Your face never left this device
        </div>

        {/* Two-device testing instructions. A single device can't scan a QR
            code rendered on its own screen (self-scanning), so anyone
            testing the door-check flow needs a second device in the loop. */}
        <div className="rounded-xl border border-[#8B7FFF]/25 bg-[#8B7FFF]/[0.06] p-4 mb-6">
          <div className="flex items-center gap-2 mb-2.5 text-[#c4bcff]">
            <Smartphone className="w-4 h-4" />
            <span className="font-display font-bold text-sm">Testing this yourself?</span>
          </div>
          <ol className="space-y-1.5 text-xs text-neutral-400 leading-relaxed list-decimal list-inside">
            <li>Grab a second phone or computer &mdash; you can&rsquo;t scan a QR code from the same screen it&rsquo;s displayed on.</li>
            <li>On that second device, open this same page and choose <span className="text-neutral-300 font-medium">Scan a ticket</span>.</li>
            <li>Point its camera at <span className="text-neutral-300 font-medium">this</span> ticket&rsquo;s QR code above.</li>
            <li>When your ticket shows up, tap <span className="text-neutral-300 font-medium">Verify with camera</span> and look into the second device&rsquo;s camera &mdash; that confirms it&rsquo;s really you.</li>
          </ol>
        </div>

        <div className="flex flex-col gap-3">
          <button onClick={downloadQR} className="flex items-center justify-center gap-2 py-3 rounded-xl bg-white text-black font-semibold text-sm">
            <Download className="w-4 h-4" />
            Download QR
          </button>
          <button onClick={onComplete} className="flex items-center justify-center gap-2 py-3 rounded-xl border border-white/15 text-white text-sm font-medium hover:bg-white/5">
            Done
          </button>
        </div>
      </div>
      </>
    );
  }

  return null;
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-mono uppercase tracking-widest text-neutral-500 mb-1">{label}</span>
      {children}
    </label>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SCAN / VERIFY FLOW
// ═══════════════════════════════════════════════════════════════════════════
function QRScanStage({ onDecoded, onCancel }) {
  const containerId = 'face-ticket-qr-reader';
  const scannerRef = useRef(null);
  const mountedRef = useRef(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    mountedRef.current = true;
    startScanner();
    return () => {
      mountedRef.current = false;
      stopScanner();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopScanner = async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    scannerRef.current = null;
    try {
      if (scanner.getState() === 2) await scanner.stop();
    } catch { /* not running, ignore */ }
  };

  const startScanner = async () => {
    try {
      setError(null);
      const { Html5Qrcode } = await import('html5-qrcode');
      if (!mountedRef.current) return;
      const scanner = new Html5Qrcode(containerId);
      scannerRef.current = scanner;

      const config = {
        fps: 12,
        qrbox: (w, h) => {
          const side = Math.floor(Math.min(w, h) * 0.75);
          return { width: side, height: side };
        },
        experimentalFeatures: { useBarCodeDetectorIfSupported: false },
      };

      const onSuccess = (decodedText) => {
        stopScanner();
        try {
          const parsed = unpackTicketPayload(decodedText);
          onDecoded(parsed);
        } catch (err) {
          setError(err.message || 'Could not read this QR code as a Face Ticket.');
        }
      };

      // Camera fallback chain. `exact: 'environment'` fails outright on a
      // lot of Android devices (multiple rear lenses, or a device that only
      // exposes a generic device list rather than facingMode metadata) —
      // that's the intermittent "sometimes doesn't load" behavior. Try the
      // rear camera as a soft preference first, then fall back to whatever
      // camera is available via getCameras(), then finally the front camera
      // as a last resort so the scanner never just dead-ends.
      const attempts = [
        () => scanner.start({ facingMode: 'environment' }, config, onSuccess, () => {}),
        async () => {
          const cameras = await Html5Qrcode.getCameras();
          if (!cameras?.length) throw new Error('NO_CAMERAS');
          const rear = cameras.find((c) => /back|rear|environment/i.test(c.label)) || cameras[0];
          await scanner.start({ deviceId: { exact: rear.id } }, config, onSuccess, () => {});
        },
        () => scanner.start({ facingMode: 'user' }, config, onSuccess, () => {}),
      ];

      let started = false;
      let lastErr = null;
      for (const attempt of attempts) {
        if (!mountedRef.current) return;
        try {
          await attempt();
          started = true;
          break;
        } catch (err) {
          lastErr = err;
          if (err?.name === 'NotAllowedError') break; // permission denied — retrying won't help
        }
      }
      if (!started) throw lastErr || new Error('Could not start the camera.');
    } catch (err) {
      if (!mountedRef.current) return;
      let message = 'Could not start the camera.';
      if (err.name === 'NotAllowedError') message = 'Camera permission denied. Allow access in your browser settings and retry.';
      else if (err.name === 'NotFoundError' || err.message === 'NO_CAMERAS') message = 'No camera found on this device.';
      else if (!window.isSecureContext) message = 'Camera access needs a secure connection (https://).';
      setError(message);
    }
  };

  return (
    <div className="max-w-md mx-auto px-5 py-10">
      <h2 className="font-display font-bold text-2xl mb-1.5">Scan a ticket</h2>
      <p className="text-neutral-500 text-sm mb-6">Point the camera at a Face Ticket QR code.</p>

      {error ? (
        <div className="text-center py-10">
          <XCircle className="w-10 h-10 text-rose-400 mx-auto mb-3" />
          <p className="text-sm text-neutral-300 mb-5">{error}</p>
          <button onClick={startScanner} className="px-5 py-2.5 rounded-lg bg-white text-black text-sm font-semibold">Retry</button>
        </div>
      ) : (
        <>
          {/* Fixed aspect box: html5-qrcode injects its own <video>/<canvas>
              with inline sizing, which on some mobile browsers renders taller
              than the viewport or overflows the rounded corners. Constraining
              the container and forcing the injected video to fill it keeps
              the scanner boxed no matter what size the library picks. */}
          <div
            id={containerId}
            className="qr-reader-box rounded-2xl overflow-hidden border border-white/10 bg-black relative aspect-square w-full [&_video]:!w-full [&_video]:!h-full [&_video]:!object-cover [&_canvas]:!w-full"
          />
          <p className="text-center text-neutral-500 text-xs mt-4">Scanning automatically&hellip;</p>
        </>
      )}

      <button onClick={onCancel} className="w-full mt-6 py-3 rounded-xl border border-white/15 text-sm text-neutral-300 hover:bg-white/5">
        Cancel
      </button>
    </div>
  );
}

function DecodedTicketCard({ ticket, onVerify, onRescan }) {
  return (
    <div className="max-w-md mx-auto px-5 py-10">
      <div className="flex items-center gap-2 text-teal-300 text-sm mb-4">
        <QrCode className="w-4 h-4" />
        Ticket found
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 mb-8">
        <div className="font-display font-bold text-lg">{ticket.name}</div>
        <div className="text-neutral-500 text-sm mb-4">{ticket.eventName} &middot; {ticket.seatId || 'no seat'}</div>
        <EmbeddingBarcode bytes={ticket.quantized.bytes} height={36} />
      </div>
      <button onClick={onVerify} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#8B7FFF] text-[#0a0714] font-bold text-sm mb-3">
        <ScanFace className="w-4 h-4" />
        Verify with camera
      </button>
      <button onClick={onRescan} className="w-full py-3 rounded-xl border border-white/15 text-sm text-neutral-300 hover:bg-white/5">
        Scan a different ticket
      </button>
    </div>
  );
}

function VerifyCameraStage({ onResult, onCancel }) {
  const { videoRef, ready, error: camError, start, stop } = useCameraStream();
  const models = useFaceModels();
  const [phase, setPhase] = useState('camera'); // camera -> liveness -> match -> done
  const [progress, setProgress] = useState(0);
  const [ear, setEar] = useState(null);
  const [issue, setIssue] = useState(null);
  const runningRef = useRef(false);

  useEffect(() => {
    models.load();
    start();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const beginCheck = async () => {
    if (runningRef.current || !models.ready) return;
    runningRef.current = true;
    setIssue(null);
    setPhase('liveness');
    setProgress(0);

    // Everything below this point used to run with no try/catch at all: any
    // thrown error (a WebGL hiccup, a texture read failure, anything) would
    // silently kill this function mid-flight, leaving `phase` frozen on
    // 'liveness' or 'match' forever and `runningRef.current` stuck `true` —
    // which permanently blocks every future tap on "Start check" too, since
    // the guard above bails out early. No error, no visible reaction, just a
    // dead screen. That's the "just says analyzing and doesn't do anything"
    // behavior. This makes sure any failure resets the UI to a retryable
    // state instead of locking it up.
    try {
      const liveness = await runLivenessCapture(videoRef.current, {
        durationMs: 2800,
        onSample: (s) => { setProgress(s.progress); setEar(s.ear); },
      });

      if (liveness.faceCoverage < 0.4) {
        setIssue('Couldn\u2019t get a clear, steady view of your face. Center your face and try again.');
        setPhase('camera');
        return;
      }

      setPhase('match');
      let result = null;
      for (let i = 0; i < 4 && !result; i++) {
        result = await detectFaceWithDescriptor(videoRef.current);
        if (!result) await new Promise((r) => setTimeout(r, 150));
      }

      if (!result) {
        setIssue('Lost sight of your face for the final capture. Try again in better light.');
        setPhase('camera');
        return;
      }

      stop();
      setPhase('done');
      onResult({ liveDescriptor: result.descriptor, liveness });
    } catch (err) {
      console.error('Verification check failed:', err);
      setIssue('Something went wrong during the check. Try again.');
      setPhase('camera');
    } finally {
      runningRef.current = false;
    }
  };

  return (
    <div className="max-w-md mx-auto px-5 py-10">
      <h2 className="font-display font-bold text-2xl mb-1.5">Verify</h2>
      <p className="text-neutral-500 text-sm mb-6">
        {phase === 'camera' && 'Hold your face in frame and blink naturally when checking begins.'}
        {phase === 'liveness' && 'Hold steady \u2014 checking liveness\u2026'}
        {phase === 'match' && 'Capturing your face for matching\u2026'}
      </p>

      <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-black border border-white/10 mb-4">
        {camError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
            <CameraOff className="w-10 h-10 text-rose-400 mb-3" />
            <p className="text-sm text-neutral-300 mb-4">{camError}</p>
            <button onClick={start} className="px-4 py-2 rounded-lg bg-white text-black text-sm font-semibold">Retry camera</button>
          </div>
        ) : (
          <>
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
            <div className="absolute inset-8 border-2 border-dashed border-white/30 rounded-full pointer-events-none" />
            {phase === 'liveness' && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10">
                <div className="h-full bg-[#8B7FFF] transition-all duration-100" style={{ width: `${progress * 100}%` }} />
              </div>
            )}
            {!models.ready && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <ModelLoadingCard stage={models.stage} error={models.error} onRetry={models.load} />
              </div>
            )}
          </>
        )}
      </div>

      {issue && (
        <div className="flex items-start gap-2 text-sm text-amber-300 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2.5 mb-4">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          {issue}
        </div>
      )}

      <button
        onClick={beginCheck}
        disabled={!ready || !models.ready || phase === 'liveness' || phase === 'match'}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#8B7FFF] text-[#0a0714] font-bold text-sm disabled:opacity-40 mb-3"
      >
        {(phase === 'liveness' || phase === 'match') ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radar className="w-4 h-4" />}
        {phase === 'liveness' ? 'Checking\u2026' : phase === 'match' ? 'Capturing\u2026' : 'Start check'}
      </button>
      <button onClick={onCancel} className="w-full py-3 rounded-xl border border-white/15 text-sm text-neutral-300 hover:bg-white/5">
        Cancel
      </button>
    </div>
  );
}

function ConfidenceMeter({ percent, isMatch }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-mono text-[11px] uppercase tracking-widest text-neutral-500">Confidence</span>
        <span className={`font-mono text-sm font-bold ${isMatch ? 'text-teal-300' : 'text-rose-300'}`}>{percent}%</span>
      </div>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${isMatch ? 'bg-teal-400' : 'bg-rose-400'}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function LivenessChip({ label, passed }) {
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium ${
      passed ? 'border-teal-400/25 bg-teal-400/10 text-teal-300' : 'border-white/10 bg-white/[0.03] text-neutral-500'
    }`}>
      {passed ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
      {label}
    </div>
  );
}

function ResultScreen({ ticket, verify, onRescan, onExit }) {
  const liveQuantized = useMemo(() => quantizeEmbedding(verify.liveDescriptor), [verify.liveDescriptor]);
  const storedDescriptor = useMemo(
    () => dequantizeEmbedding(ticket.quantized.bytes, ticket.quantized.min, ticket.quantized.max),
    [ticket]
  );
  const similarity = useMemo(
    () => cosineSimilarity(storedDescriptor, verify.liveDescriptor),
    [storedDescriptor, verify.liveDescriptor]
  );
  const confidence = formatConfidence(similarity);
  const isMatch = similarity >= MATCH_THRESHOLD;

  return (
    <div className="max-w-md mx-auto px-5 py-10">
      <div className={`flex flex-col items-center text-center mb-8 ${isMatch ? '' : ''}`}>
        <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-4 ${
          isMatch ? 'bg-teal-400/15 animate-[pulse_1.4s_ease-in-out_1]' : 'bg-rose-400/15'
        }`}>
          {isMatch ? <CheckCircle2 className="w-10 h-10 text-teal-300" /> : <XCircle className="w-10 h-10 text-rose-300" />}
        </div>
        <h2 className="font-display font-extrabold text-3xl mb-1">{isMatch ? 'Match' : 'No match'}</h2>
        <p className="text-neutral-500 text-sm">{ticket.name} &middot; {ticket.eventName}</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 mb-6 space-y-5">
        <ConfidenceMeter percent={confidence} isMatch={isMatch} />

        <div>
          <span className="font-mono text-[11px] uppercase tracking-widest text-neutral-500 block mb-2">Beta liveness check</span>
          <div className="flex gap-2 flex-wrap">
            <LivenessChip label="Blink detected" passed={verify.liveness.blinkDetected} />
            <LivenessChip label="Natural motion" passed={verify.liveness.motionDetected} />
          </div>
        </div>

        <div>
          <span className="font-mono text-[11px] uppercase tracking-widest text-neutral-500 block mb-2">Ticket vs. live</span>
          <div className="space-y-2">
            <EmbeddingBarcode bytes={ticket.quantized.bytes} height={24} tone="violet" />
            <EmbeddingBarcode bytes={liveQuantized.bytes} height={24} tone="teal" />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-neutral-500 font-mono mb-2">
        <Lock className="w-3.5 h-3.5" />
        Compared entirely on this device
      </div>

      <div className="flex flex-col gap-3 mt-8">
        <button onClick={onRescan} className="flex items-center justify-center gap-2 py-3 rounded-xl bg-white text-black font-semibold text-sm">
          <RefreshCw className="w-4 h-4" />
          Scan another ticket
        </button>
        <button onClick={onExit} className="py-3 rounded-xl border border-white/15 text-sm text-neutral-300 hover:bg-white/5">
          Done
        </button>
      </div>
    </div>
  );
}

const SCAN_STEP_LABELS = ['Scan QR', 'Confirm ticket', 'Verify face', 'Result'];

function ScanFlow({ onDone, onComplete }) {
  const [step, setStep] = useState('qr'); // qr -> decoded -> camera -> result
  const [ticket, setTicket] = useState(null);
  const [verify, setVerify] = useState(null);

  const stepIdx = { qr: 0, decoded: 1, camera: 2, result: 3 }[step] ?? 0;

  let content;
  if (step === 'qr') {
    content = <QRScanStage onDecoded={(t) => { setTicket(t); setStep('decoded'); }} onCancel={onDone} />;
  } else if (step === 'decoded') {
    content = <DecodedTicketCard ticket={ticket} onVerify={() => setStep('camera')} onRescan={() => setStep('qr')} />;
  } else if (step === 'camera') {
    content = <VerifyCameraStage onResult={(v) => { setVerify(v); setStep('result'); }} onCancel={() => setStep('decoded')} />;
  } else if (step === 'result') {
    // A genuine completion — hands off to onComplete (feedback) rather
    // than onDone, which the earlier steps use to cancel back to landing.
    content = (
      <ResultScreen
        ticket={ticket}
        verify={verify}
        onRescan={() => { setTicket(null); setVerify(null); setStep('qr'); }}
        onExit={onComplete}
      />
    );
  } else {
    content = null;
  }

  return (
    <>
      <StepIndicator labels={SCAN_STEP_LABELS} index={stepIdx} />
      {content}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════════
export default function FaceTicket() {
  const navigate = useNavigate();
  const [mode, setMode] = useState('landing'); // landing | enroll | scan | feedback
  const [feedbackLabel, setFeedbackLabel] = useState('');

  const handleBack = () => {
    if (mode === 'landing') navigate('/');
    else setMode('landing');
  };

  // Only real completions land here — cancel/back buttons throughout
  // EnrollFlow/ScanFlow go straight to onDone (back to landing) instead.
  const complete = (label) => {
    setFeedbackLabel(label);
    setMode('feedback');
  };

  return (
    <PageChrome onBack={handleBack}>
      {mode === 'landing' && (
        <LandingScreen onEnroll={() => setMode('enroll')} onScan={() => setMode('scan')} />
      )}
      {mode === 'enroll' && (
        <EnrollFlow
          onDone={() => setMode('landing')}
          onComplete={() => complete('Face Ticket \u2014 Enroll')}
        />
      )}
      {mode === 'scan' && (
        <ScanFlow
          onDone={() => setMode('landing')}
          onComplete={() => complete('Face Ticket \u2014 Scan & Verify')}
        />
      )}
      {mode === 'feedback' && (
        <DemoFeedback demoLabel={feedbackLabel} onExit={() => setMode('landing')} />
      )}
    </PageChrome>
  );
}
