import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Camera, CameraOff, Loader2, ScanFace, Users, Plus, ChevronLeft,
  CheckCircle2, XCircle, AlertTriangle, Trash2, Download, Upload, Settings2,
  QrCode, Search, ArrowRight, Radar, LogIn,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useCameraStream } from '../hooks/useCameraStream';
import FaceModeMobileNotice from '../components/FaceModeMobileNotice';
import StepIndicator from '../components/StepIndicator';
import {
  loadFaceModels, detectFaceWithDescriptor, quantizeEmbedding, runLivenessCapture,
  formatConfidence,
} from '../utils/faceTicket';
import {
  listEvents, getEvent, createEvent, updateEventSettings, deleteEvent,
  addAttendee, removeAttendee, setCheckedIn, matchAgainstRoster,
  packEventTicketPayload, unpackEventTicketPayload, exportEventFile, importEventFile,
  DEFAULT_MATCH_THRESHOLD,
} from '../utils/eventRoster';

// ═══════════════════════════════════════════════════════════════════════════
// Shared bits (small, local copies of the same pattern used in FaceTicket.jsx
// — kept self-contained here rather than exported/imported across pages)
// ═══════════════════════════════════════════════════════════════════════════
const LOAD_LABELS = {
  engine: 'Starting recognition engine\u2026', detector: 'Loading face detector\u2026',
  landmarks: 'Loading landmark model\u2026', embedding: 'Loading embedding model\u2026',
  warmup: 'Warming up on this device\u2026', ready: 'Ready',
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
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      {error ? (
        <>
          <AlertTriangle className="w-9 h-9 text-rose-400 mb-3" />
          <p className="text-sm text-neutral-300 mb-5 max-w-xs">{error}</p>
          <button onClick={onRetry} className="px-5 py-2.5 rounded-lg bg-white text-black text-sm font-semibold">Retry</button>
        </>
      ) : (
        <>
          <Loader2 className="w-7 h-7 text-[#8B7FFF] animate-spin mb-3" />
          <p className="font-mono text-xs text-neutral-400">{LOAD_LABELS[stage] || 'Loading\u2026'}</p>
        </>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-mono uppercase tracking-widest text-neutral-500 mb-1">{label}</span>
      {children}
    </label>
  );
}

function Pill({ tone = 'neutral', children }) {
  const tones = {
    neutral: 'border-white/10 bg-white/[0.03] text-neutral-400',
    teal: 'border-teal-400/25 bg-teal-400/10 text-teal-300',
    amber: 'border-amber-400/25 bg-amber-400/10 text-amber-300',
    violet: 'border-[#8B7FFF]/25 bg-[#8B7FFF]/10 text-[#c4bcff]',
  }[tone];
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-mono uppercase tracking-wide ${tones}`}>{children}</span>;
}

const REQUIRE_QR_OPTIONS = [
  { value: 'never', label: 'Face only', body: 'Never ask for a ticket. If the face check can\u2019t confidently pick one person, check-in just fails and staff sort it out manually.' },
  { value: 'auto', label: 'Face first, ticket if unsure', body: 'No ticket needed for a confident face match. If two guests look similar or confidence is low, ask for the QR ticket to confirm.' },
  { value: 'always', label: 'Face + ticket', body: 'Every check-in needs both a face match and a scanned QR ticket \u2014 two-factor, slower at the door.' },
];

// ═══════════════════════════════════════════════════════════════════════════
// HUB — list of locally-stored events
// ═══════════════════════════════════════════════════════════════════════════
function EventHub({ events, onNew, onOpen, onCheckIn, onDelete, onImport, onExit }) {
  const fileInputRef = useRef(null);

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const event = importEventFile(text);
      toast.success(`Imported "${event.name}"`);
      onImport();
    } catch (err) {
      toast.error(err.message || 'Could not import that file.');
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-5 py-10">
      <button onClick={onExit} className="flex items-center gap-1.5 text-neutral-500 hover:text-white text-xs mb-4 -ml-1">
        <ChevronLeft className="w-3.5 h-3.5" /> Single-ticket Face Ticket
      </button>
      <div className="flex items-center gap-2 text-[#8B7FFF] text-sm mb-1.5">
        <Users className="w-4 h-4" />
        Event mode &middot; beta
      </div>
      <h2 className="font-display font-bold text-2xl mb-1.5">Run an event</h2>
      <p className="text-neutral-500 text-sm mb-8 max-w-md">
        Enroll a roster of faces once, then check guests in with just a look &mdash; no ticket to
        pull up. Everything lives in this browser only: use export/import to move a roster to a
        second device (e.g. the actual check-in laptop at the door).
      </p>

      <div className="flex flex-col sm:flex-row gap-3 mb-10">
        <button onClick={onNew} className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl bg-[#8B7FFF] text-[#0a0714] font-bold text-sm hover:bg-[#9d92ff] transition-colors">
          <Plus className="w-4 h-4" />
          New event
        </button>
        <button onClick={() => fileInputRef.current?.click()} className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl border border-white/15 text-white font-semibold text-sm hover:bg-white/5 transition-colors">
          <Upload className="w-4 h-4" />
          Import event file
        </button>
        <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleImportFile} />
      </div>

      {events.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 py-12 text-center text-neutral-500 text-sm">
          No events on this device yet.
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((ev) => (
            <div key={ev.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-[#8B7FFF]/10 flex items-center justify-center shrink-0">
                <ScanFace className="w-5 h-5 text-[#8B7FFF]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{ev.name}</div>
                <div className="text-xs text-neutral-500 flex items-center gap-2 flex-wrap mt-0.5">
                  <span>{ev.attendeeCount} enrolled</span>
                  <span>&middot;</span>
                  <span>{ev.checkedInCount} checked in</span>
                  <Pill tone={ev.settings?.requireQR === 'always' ? 'amber' : ev.settings?.requireQR === 'never' ? 'teal' : 'violet'}>
                    {REQUIRE_QR_OPTIONS.find((o) => o.value === ev.settings?.requireQR)?.label || 'Face first'}
                  </Pill>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => onCheckIn(ev.id)} disabled={ev.attendeeCount === 0}
                  className="px-3 py-2 rounded-lg bg-white text-black text-xs font-semibold disabled:opacity-30 disabled:cursor-not-allowed">
                  Check in
                </button>
                <button onClick={() => onOpen(ev.id)} className="px-3 py-2 rounded-lg border border-white/15 text-xs text-neutral-300 hover:bg-white/5">
                  Manage
                </button>
                <button onClick={() => onDelete(ev.id)} className="p-2 rounded-lg border border-white/10 text-neutral-500 hover:text-rose-300 hover:border-rose-400/30">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// NEW EVENT — name + door-settings, then straight into roster building
// ═══════════════════════════════════════════════════════════════════════════
function NewEventForm({ onCreated, onCancel }) {
  const [name, setName] = useState('');
  const [requireQR, setRequireQR] = useState('auto');

  const create = () => {
    if (!name.trim()) { toast.error('Give the event a name'); return; }
    const event = createEvent({ name, requireQR });
    if (!event) { toast.error('Could not save the event on this device.'); return; }
    onCreated(event.id);
  };

  return (
    <div className="max-w-md mx-auto px-5 py-10">
      <h2 className="font-display font-bold text-2xl mb-1.5">New event</h2>
      <p className="text-neutral-500 text-sm mb-6">This lives only in this browser until you export it.</p>

      <div className="space-y-6 mb-8">
        <Field label="Event name">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60}
            placeholder="Founders' Night"
            className="w-full bg-transparent border-b border-white/15 focus:border-[#8B7FFF] outline-none py-2 text-sm" />
        </Field>

        <div>
          <span className="block text-[11px] font-mono uppercase tracking-widest text-neutral-500 mb-2.5">Door settings</span>
          <div className="space-y-2.5">
            {REQUIRE_QR_OPTIONS.map((opt) => (
              <button key={opt.value} onClick={() => setRequireQR(opt.value)}
                className={`w-full text-left rounded-xl border p-3.5 transition-colors ${
                  requireQR === opt.value ? 'border-[#8B7FFF]/50 bg-[#8B7FFF]/[0.07]' : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.04]'
                }`}>
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 ${requireQR === opt.value ? 'border-[#8B7FFF] bg-[#8B7FFF]' : 'border-white/25'}`} />
                  <span className="font-semibold text-sm">{opt.label}</span>
                </div>
                <p className="text-xs text-neutral-500 leading-relaxed pl-5.5">{opt.body}</p>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-neutral-600 mt-2">You can change this later from the event\u2019s Manage screen.</p>
        </div>
      </div>

      <button onClick={create} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#8B7FFF] text-[#0a0714] font-bold text-sm mb-3">
        Create & start adding guests
        <ArrowRight className="w-4 h-4" />
      </button>
      <button onClick={onCancel} className="w-full py-3 rounded-xl border border-white/15 text-sm text-neutral-300 hover:bg-white/5">Cancel</button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ADD ATTENDEE — capture face, then name/seat, loop until done
// ═══════════════════════════════════════════════════════════════════════════
const ADD_STEP_LABELS = ['Selfie', 'Details', 'Saved'];

function AddAttendeeFlow({ event, onDone }) {
  const [step, setStep] = useState('camera'); // camera -> details -> saved
  const stepIdx = { camera: 0, details: 1, saved: 2 }[step];
  const { videoRef, ready, error: camError, start, stop } = useCameraStream();
  const models = useFaceModels();
  const [captureError, setCaptureError] = useState(null);
  const [capturing, setCapturing] = useState(false);
  const [quantized, setQuantized] = useState(null);
  const [form, setForm] = useState({ name: '', seatId: '' });
  const [savedCount, setSavedCount] = useState(0);
  const [saving, setSaving] = useState(false);

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
      setQuantized(quantizeEmbedding(result.descriptor));
      stop();
      setStep('details');
    } catch (err) {
      console.error(err);
      setCaptureError(`Something went wrong reading the face${err?.message ? ` (${err.message})` : ''}. Try again.`);
    } finally {
      setCapturing(false);
    }
  };

  const save = () => {
    if (!form.name.trim()) { toast.error('Add a name'); return; }
    setSaving(true);
    const attendee = addAttendee(event.id, { name: form.name, seatId: form.seatId, quantized });
    setSaving(false);
    if (!attendee) { toast.error('Could not save this guest on this device.'); return; }
    setSavedCount((c) => c + 1);
    setStep('saved');
  };

  const addAnother = () => {
    setForm({ name: '', seatId: '' });
    setQuantized(null);
    setCaptureError(null);
    setStep('camera');
    start();
  };

  if (step === 'camera') {
    return (
      <>
        <StepIndicator labels={ADD_STEP_LABELS} index={stepIdx} />
        <div className="max-w-md mx-auto px-5 py-8">
          {savedCount > 0 && (
            <div className="flex items-center gap-2 text-teal-300 text-sm mb-4">
              <CheckCircle2 className="w-4 h-4" />
              {savedCount} guest{savedCount === 1 ? '' : 's'} added so far
            </div>
          )}
          <h2 className="font-display font-bold text-2xl mb-1.5">Guest selfie</h2>
          <p className="text-neutral-500 text-sm mb-4">One face per guest. This never leaves the browser.</p>
          <FaceModeMobileNotice className="mb-4" />

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

          <button onClick={capture} disabled={!ready || !models.ready || capturing}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#8B7FFF] text-[#0a0714] font-bold text-sm disabled:opacity-40 mb-3">
            {capturing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            {capturing ? 'Reading face\u2026' : 'Capture'}
          </button>
          <button onClick={() => onDone(savedCount)} className="w-full py-3 rounded-xl border border-white/15 text-sm text-neutral-300 hover:bg-white/5">
            {savedCount > 0 ? 'Done adding guests' : 'Cancel'}
          </button>
        </div>
      </>
    );
  }

  if (step === 'details') {
    return (
      <>
        <StepIndicator labels={ADD_STEP_LABELS} index={stepIdx} />
        <div className="max-w-md mx-auto px-5 py-8">
          <div className="flex items-center gap-2 text-teal-300 text-sm mb-4">
            <CheckCircle2 className="w-4 h-4" />
            Face captured
          </div>
          <h2 className="font-display font-bold text-2xl mb-6">Guest details</h2>
          <div className="space-y-4 mb-8">
            <Field label="Name">
              <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Guest name" maxLength={40} autoFocus
                className="w-full bg-transparent border-b border-white/15 focus:border-[#8B7FFF] outline-none py-2 text-sm" />
            </Field>
            <Field label="Seat / ticket ID (optional)">
              <input value={form.seatId} onChange={(e) => setForm((f) => ({ ...f, seatId: e.target.value }))}
                maxLength={16} placeholder="FT-7042"
                className="w-full bg-transparent border-b border-white/15 focus:border-[#8B7FFF] outline-none py-2 text-sm font-mono" />
            </Field>
          </div>
          <button onClick={save} disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#8B7FFF] text-[#0a0714] font-bold text-sm disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Save guest
          </button>
        </div>
      </>
    );
  }

  // saved
  return (
    <>
      <StepIndicator labels={ADD_STEP_LABELS} index={stepIdx} />
      <div className="max-w-md mx-auto px-5 py-10 text-center">
        <div className="w-16 h-16 rounded-full bg-teal-400/15 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-teal-300" />
        </div>
        <h2 className="font-display font-bold text-2xl mb-1.5">{form.name} added</h2>
        <p className="text-neutral-500 text-sm mb-8">{savedCount} guest{savedCount === 1 ? '' : 's'} enrolled for {event.name} so far.</p>
        <div className="flex flex-col gap-3">
          <button onClick={addAnother} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#8B7FFF] text-[#0a0714] font-bold text-sm">
            <Plus className="w-4 h-4" />
            Add another guest
          </button>
          <button onClick={() => onDone(savedCount)} className="w-full py-3 rounded-xl border border-white/15 text-sm text-neutral-300 hover:bg-white/5">
            Done for now
          </button>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MANAGE — roster list, settings, export, start check-in
// ═══════════════════════════════════════════════════════════════════════════
function EventManageScreen({ event, onBack, onAddMore, onCheckIn, onRefresh }) {
  const [ticketFor, setTicketFor] = useState(null); // attendee id showing its fallback QR

  const setRequireQR = (value) => {
    updateEventSettings(event.id, { requireQR: value });
    onRefresh();
  };

  const remove = (attendeeId) => {
    removeAttendee(event.id, attendeeId);
    onRefresh();
  };

  return (
    <div className="max-w-2xl mx-auto px-5 py-10">
      <button onClick={onBack} className="flex items-center gap-1.5 text-neutral-400 hover:text-white text-sm mb-6 -ml-1">
        <ChevronLeft className="w-4 h-4" /> All events
      </button>

      <h2 className="font-display font-bold text-2xl mb-1">{event.name}</h2>
      <p className="text-neutral-500 text-sm mb-6">
        {event.attendees.length} enrolled &middot; {event.attendees.filter((a) => a.checkedIn).length} checked in
      </p>

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 mb-6">
        <div className="flex items-center gap-2 mb-3 text-sm font-semibold">
          <Settings2 className="w-4 h-4 text-neutral-400" />
          Door settings
        </div>
        <div className="flex flex-col gap-2">
          {REQUIRE_QR_OPTIONS.map((opt) => (
            <button key={opt.value} onClick={() => setRequireQR(opt.value)}
              className={`text-left rounded-lg border px-3 py-2.5 text-xs transition-colors ${
                event.settings?.requireQR === opt.value ? 'border-[#8B7FFF]/50 bg-[#8B7FFF]/[0.07] text-white' : 'border-white/10 text-neutral-400 hover:bg-white/[0.04]'
              }`}>
              <span className="font-semibold">{opt.label}</span> &mdash; <span className="text-neutral-500">{opt.body}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-8">
        <button onClick={onAddMore} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#8B7FFF] text-[#0a0714] font-bold text-sm">
          <Plus className="w-4 h-4" /> Add guests
        </button>
        <button onClick={() => onCheckIn(event.id)} disabled={event.attendees.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-black font-bold text-sm disabled:opacity-30">
          <LogIn className="w-4 h-4" /> Start check-in
        </button>
        <button onClick={() => exportEventFile(event)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/15 text-sm text-neutral-300 hover:bg-white/5">
          <Download className="w-4 h-4" /> Export event file
        </button>
      </div>

      {event.attendees.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/15 py-12 text-center text-neutral-500 text-sm">
          No guests enrolled yet.
        </div>
      ) : (
        <div className="space-y-2">
          {event.attendees.map((a) => (
            <div key={a.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3.5 flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full shrink-0 ${a.checkedIn ? 'bg-teal-400' : 'bg-white/15'}`} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{a.name}</div>
                <div className="text-[11px] text-neutral-500 font-mono">
                  {a.seatId || 'no seat'} {a.checkedIn ? `\u00b7 checked in ${new Date(a.checkedInAt).toLocaleTimeString()}` : ''}
                </div>
              </div>
              <button onClick={() => setTicketFor(ticketFor === a.id ? null : a.id)} className="p-2 rounded-lg border border-white/10 text-neutral-400 hover:text-[#c4bcff] hover:border-[#8B7FFF]/30">
                <QrCode className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => remove(a.id)} className="p-2 rounded-lg border border-white/10 text-neutral-500 hover:text-rose-300 hover:border-rose-400/30">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {ticketFor && (
        <AttendeeTicketPanel event={event} attendee={event.attendees.find((a) => a.id === ticketFor)} onClose={() => setTicketFor(null)} />
      )}
    </div>
  );
}

function AttendeeTicketPanel({ event, attendee, onClose }) {
  const [qrDataUrl, setQrDataUrl] = useState(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const QRCode = (await import('qrcode')).default;
      const payload = packEventTicketPayload({ eventId: event.id, eventName: event.name, attendee });
      const url = await QRCode.toDataURL(payload, { errorCorrectionLevel: 'H', margin: 1, width: 320, color: { dark: '#0a0714ff', light: '#ffffffff' } });
      if (!cancelled) setQrDataUrl(url);
    })();
    return () => { cancelled = true; };
  }, [event.id, event.name, attendee]);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-[#0a0714] border border-white/10 rounded-2xl p-6 max-w-xs w-full text-center" onClick={(e) => e.stopPropagation()}>
        <p className="font-display font-bold text-lg mb-1">{attendee.name}</p>
        <p className="text-neutral-500 text-xs mb-4">Fallback ticket &middot; used only if face check-in is unsure</p>
        <div className="bg-white rounded-xl p-3 mb-4 flex items-center justify-center min-h-[180px]">
          {qrDataUrl ? <img src={qrDataUrl} alt="Guest QR ticket" className="w-full max-w-[220px]" /> : <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />}
        </div>
        <button onClick={onClose} className="w-full py-2.5 rounded-lg border border-white/15 text-sm text-neutral-300 hover:bg-white/5">Close</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CHECK-IN — face-first, QR fallback only when settings/confidence say so
// ═══════════════════════════════════════════════════════════════════════════
function EventQRScanStage({ event, onDecoded, onCancel }) {
  const containerId = 'face-ticket-event-qr-reader';
  const scannerRef = useRef(null);
  const mountedRef = useRef(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    mountedRef.current = true;
    startScanner();
    return () => { mountedRef.current = false; stopScanner(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopScanner = async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;
    scannerRef.current = null;
    try { if (scanner.getState() === 2) await scanner.stop(); } catch { /* not running */ }
  };

  const startScanner = async () => {
    try {
      setError(null);
      const { Html5Qrcode } = await import('html5-qrcode');
      if (!mountedRef.current) return;
      const scanner = new Html5Qrcode(containerId);
      scannerRef.current = scanner;
      const config = { fps: 12, qrbox: (w, h) => { const s = Math.floor(Math.min(w, h) * 0.75); return { width: s, height: s }; } };
      const onSuccess = (decodedText) => {
        stopScanner();
        try {
          const parsed = unpackEventTicketPayload(decodedText);
          if (parsed.eventId !== event.id) {
            setError('This ticket is for a different event.');
            return;
          }
          onDecoded(parsed);
        } catch (err) {
          setError(err.message || 'Could not read this QR code.');
        }
      };
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
      let started = false, lastErr = null;
      for (const attempt of attempts) {
        if (!mountedRef.current) return;
        try { await attempt(); started = true; break; }
        catch (err) { lastErr = err; if (err?.name === 'NotAllowedError') break; }
      }
      if (!started) throw lastErr || new Error('Could not start the camera.');
    } catch (err) {
      if (!mountedRef.current) return;
      let message = 'Could not start the camera.';
      if (err.name === 'NotAllowedError') message = 'Camera permission denied. Allow access and retry.';
      else if (err.name === 'NotFoundError' || err.message === 'NO_CAMERAS') message = 'No camera found on this device.';
      else if (!window.isSecureContext) message = 'Camera access needs a secure connection (https://).';
      setError(message);
    }
  };

  return (
    <div className="max-w-md mx-auto px-5 py-8">
      <h3 className="font-display font-bold text-xl mb-1.5">Scan their ticket</h3>
      <p className="text-neutral-500 text-sm mb-4">The face check wasn\u2019t confident enough on its own \u2014 confirm with the QR ticket.</p>
      {error ? (
        <div className="text-center py-8">
          <XCircle className="w-9 h-9 text-rose-400 mx-auto mb-3" />
          <p className="text-sm text-neutral-300 mb-4">{error}</p>
          <button onClick={startScanner} className="px-5 py-2.5 rounded-lg bg-white text-black text-sm font-semibold">Retry</button>
        </div>
      ) : (
        <div id={containerId} className="rounded-2xl overflow-hidden border border-white/10 bg-black relative aspect-square w-full [&_video]:!w-full [&_video]:!h-full [&_video]:!object-cover [&_canvas]:!w-full" />
      )}
      <button onClick={onCancel} className="w-full mt-5 py-3 rounded-xl border border-white/15 text-sm text-neutral-300 hover:bg-white/5">Cancel</button>
    </div>
  );
}

/** Manual name/seat search over the roster — the last-resort fallback when
 *  face matching can't confidently pick someone and no ticket is on hand. */
function RosterSearch({ attendees, onPick }) {
  const [q, setQ] = useState('');
  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return [];
    return attendees.filter((a) => a.name.toLowerCase().includes(query) || a.seatId.toLowerCase().includes(query)).slice(0, 6);
  }, [q, attendees]);

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 mb-2">
        <Search className="w-3.5 h-3.5 text-neutral-500" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find by name or seat instead\u2026"
          className="flex-1 bg-transparent outline-none text-sm" />
      </div>
      {results.length > 0 && (
        <div className="space-y-1.5">
          {results.map((a) => (
            <button key={a.id} onClick={() => onPick(a)}
              className="w-full text-left flex items-center justify-between rounded-lg border border-white/10 px-3 py-2 text-sm hover:bg-white/5">
              <span>{a.name} <span className="text-neutral-500 font-mono text-xs">{a.seatId}</span></span>
              {a.checkedIn && <Pill tone="teal">checked in</Pill>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CheckInFlow({ event, onExit, onComplete }) {
  const { videoRef, ready, error: camError, start, stop } = useCameraStream();
  const models = useFaceModels();
  const [phase, setPhase] = useState('camera'); // camera -> liveness -> match -> result -> qr-fallback
  const [progress, setProgress] = useState(0);
  const [issue, setIssue] = useState(null);
  const [outcome, setOutcome] = useState(null); // { attendee, similarity, viaQR }
  const [checkinCount, setCheckinCount] = useState(0);
  const runningRef = useRef(false);
  const requireQR = event.settings?.requireQR || 'auto';

  useEffect(() => {
    models.load();
    start();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const freshEvent = () => getEvent(event.id) || event;

  const runFaceCheck = async () => {
    if (runningRef.current || !models.ready) return;
    runningRef.current = true;
    setIssue(null);
    setPhase('liveness');
    setProgress(0);
    try {
      const liveness = await runLivenessCapture(videoRef.current, {
        durationMs: 2400,
        onSample: (s) => setProgress(s.progress),
      });
      if (liveness.faceCoverage < 0.4) {
        setIssue('Couldn\u2019t get a clear, steady view of a face. Center it and try again.');
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
        setIssue('Lost sight of the face for the final capture. Try again in better light.');
        setPhase('camera');
        return;
      }

      const roster = freshEvent().attendees;
      const match = matchAgainstRoster(result.descriptor, roster, { threshold: DEFAULT_MATCH_THRESHOLD });

      const wantsQR = requireQR === 'always' || (requireQR === 'auto' && !match.confident);

      if (requireQR === 'never' && !match.confident) {
        stop();
        setOutcome({ attendee: null, similarity: match.top?.similarity ?? 0, viaQR: false, noMatch: true });
        setPhase('result');
        return;
      }

      if (wantsQR) {
        stop();
        // Keep the best-guess candidate around so the QR step can show
        // "confirming <name>" context even in 'always' mode where we ask
        // for a ticket regardless of confidence.
        setOutcome({ pendingCandidate: match.top?.attendee || null, pendingSimilarity: match.top?.similarity ?? 0 });
        setPhase('qr-fallback');
        return;
      }

      stop();
      setOutcome({ attendee: match.top.attendee, similarity: match.top.similarity, viaQR: false, noMatch: false });
      setPhase('result');
    } catch (err) {
      console.error('Event check-in failed:', err);
      setIssue('Something went wrong during the check. Try again.');
      setPhase('camera');
    } finally {
      runningRef.current = false;
    }
  };

  const handleQRDecoded = (parsed) => {
    const roster = freshEvent().attendees;
    const attendee = roster.find((a) => a.id === parsed.attendeeId);
    if (!attendee) {
      setIssue('That ticket doesn\u2019t match anyone currently on the roster.');
      setPhase('camera');
      return;
    }
    setOutcome({ attendee, similarity: outcome?.pendingSimilarity ?? null, viaQR: true, noMatch: false });
    setPhase('result');
  };

  const confirmCheckIn = () => {
    if (!outcome?.attendee) return;
    setCheckedIn(event.id, outcome.attendee.id, true);
    setCheckinCount((c) => c + 1);
    toast.success(`${outcome.attendee.name} checked in`);
    resetForNext();
  };

  const resetForNext = () => {
    setOutcome(null);
    setIssue(null);
    setPhase('camera');
    start();
  };

  if (phase === 'qr-fallback') {
    return (
      <div className="max-w-md mx-auto px-5 py-8">
        {outcome?.pendingCandidate && (
          <div className="flex items-center gap-2 text-xs text-neutral-400 mb-1 -mt-2">
            Best guess so far: <span className="text-neutral-200 font-medium">{outcome.pendingCandidate.name}</span>
            <span className="font-mono">{formatConfidence(outcome.pendingSimilarity)}%</span>
          </div>
        )}
        <EventQRScanStage event={event} onDecoded={handleQRDecoded} onCancel={resetForNext} />
      </div>
    );
  }

  if (phase === 'result' && outcome) {
    const alreadyIn = outcome.attendee?.checkedIn;
    return (
      <div className="max-w-md mx-auto px-5 py-8">
        <div className="flex flex-col items-center text-center mb-6">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-3 ${outcome.noMatch ? 'bg-rose-400/15' : 'bg-teal-400/15'}`}>
            {outcome.noMatch ? <XCircle className="w-8 h-8 text-rose-300" /> : <CheckCircle2 className="w-8 h-8 text-teal-300" />}
          </div>
          <h3 className="font-display font-bold text-2xl mb-1">
            {outcome.noMatch ? 'No confident match' : outcome.attendee.name}
          </h3>
          <p className="text-neutral-500 text-sm">
            {outcome.noMatch
              ? 'Nobody on the roster matched confidently.'
              : `${outcome.viaQR ? 'Confirmed via ticket' : 'Face match'}${outcome.similarity != null ? ` \u00b7 ${formatConfidence(outcome.similarity)}% confidence` : ''}`}
          </p>
        </div>

        {alreadyIn && !outcome.noMatch && (
          <div className="flex items-start gap-2 text-sm text-amber-300 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2.5 mb-4">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            Already checked in at {new Date(outcome.attendee.checkedInAt).toLocaleTimeString()}.
          </div>
        )}

        {outcome.noMatch && (
          <RosterSearch attendees={freshEvent().attendees} onPick={(a) => setOutcome({ attendee: a, similarity: null, viaQR: false, noMatch: false })} />
        )}

        {!outcome.noMatch && (
          <div className="flex flex-col gap-3 mt-2">
            <button onClick={confirmCheckIn} className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#8B7FFF] text-[#0a0714] font-bold text-sm">
              <CheckCircle2 className="w-4 h-4" />
              {alreadyIn ? 'Check in again' : 'Confirm check-in'}
            </button>
          </div>
        )}
        <button onClick={resetForNext} className="w-full mt-3 py-3 rounded-xl border border-white/15 text-sm text-neutral-300 hover:bg-white/5">
          {outcome.noMatch ? 'Try again' : 'Not them \u2014 rescan'}
        </button>
      </div>
    );
  }

  // camera / liveness / match
  return (
    <div className="max-w-md mx-auto px-5 py-8">
      <div className="flex items-center justify-between mb-1.5">
        <h3 className="font-display font-bold text-2xl">Check in</h3>
        {checkinCount > 0 && <Pill tone="teal">{checkinCount} checked in this session</Pill>}
      </div>
      <p className="text-neutral-500 text-sm mb-4">
        {phase === 'camera' && 'Have the guest look at the camera and tap Start.'}
        {phase === 'liveness' && 'Hold steady \u2014 checking\u2026'}
        {phase === 'match' && 'Matching against the roster\u2026'}
      </p>
      <FaceModeMobileNotice className="mb-4" />

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

      <button onClick={runFaceCheck} disabled={!ready || !models.ready || phase === 'liveness' || phase === 'match'}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#8B7FFF] text-[#0a0714] font-bold text-sm disabled:opacity-40 mb-3">
        {(phase === 'liveness' || phase === 'match') ? <Loader2 className="w-4 h-4 animate-spin" /> : <Radar className="w-4 h-4" />}
        {phase === 'liveness' ? 'Checking\u2026' : phase === 'match' ? 'Matching\u2026' : 'Start check'}
      </button>
      <button
        onClick={() => (checkinCount > 0 ? onComplete?.() : onExit())}
        className="w-full py-3 rounded-xl border border-white/15 text-sm text-neutral-300 hover:bg-white/5"
      >
        Exit check-in
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════════
export default function FaceTicketEvent({ onExit, onComplete }) {
  const [sub, setSub] = useState('hub'); // hub | new | add | manage | checkin
  const [events, setEvents] = useState(() => listEvents());
  const [activeId, setActiveId] = useState(null);

  const refresh = () => setEvents(listEvents());
  const activeEvent = activeId ? getEvent(activeId) : null;

  const handleDelete = (id) => {
    if (!window.confirm('Delete this event and its whole roster from this device? This can\u2019t be undone.')) return;
    deleteEvent(id);
    refresh();
  };

  if (sub === 'hub') {
    return (
      <EventHub
        events={events}
        onNew={() => setSub('new')}
        onOpen={(id) => { setActiveId(id); setSub('manage'); }}
        onCheckIn={(id) => { setActiveId(id); setSub('checkin'); }}
        onDelete={handleDelete}
        onImport={refresh}
        onExit={onExit}
      />
    );
  }

  if (sub === 'new') {
    return (
      <NewEventForm
        onCreated={(id) => { refresh(); setActiveId(id); setSub('add'); }}
        onCancel={() => setSub('hub')}
      />
    );
  }

  if (sub === 'add' && activeEvent) {
    return (
      <AddAttendeeFlow
        event={activeEvent}
        onDone={() => { refresh(); setSub('manage'); }}
      />
    );
  }

  if (sub === 'manage' && activeEvent) {
    return (
      <EventManageScreen
        event={activeEvent}
        onBack={() => { refresh(); setSub('hub'); }}
        onAddMore={() => setSub('add')}
        onCheckIn={(id) => { setActiveId(id); setSub('checkin'); }}
        onRefresh={refresh}
      />
    );
  }

  if (sub === 'checkin' && activeEvent) {
    return (
      <CheckInFlow
        event={activeEvent}
        onExit={() => { refresh(); setSub('manage'); }}
        onComplete={onComplete}
      />
    );
  }

  // Fallback (e.g. activeEvent got deleted from under us)
  return (
    <EventHub events={events} onNew={() => setSub('new')} onOpen={(id) => { setActiveId(id); setSub('manage'); }}
      onCheckIn={(id) => { setActiveId(id); setSub('checkin'); }} onDelete={handleDelete} onImport={refresh} onExit={onExit} />
  );
}
