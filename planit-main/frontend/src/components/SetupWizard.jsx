import { useState, useEffect } from 'react';
import {
  QrCode, UserPlus, Upload, ChevronRight, ChevronLeft,
  X, CheckCircle2, ToggleLeft, ToggleRight, FileText,
  ArrowRight, BookOpen, Lock, Shield, Users,
} from 'lucide-react';
import { eventAPI } from '../services/api';
import toast from 'react-hot-toast';

// ─── Step indicator ───────────────────────────────────────────────────────────
function StepDots({ current, total }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`rounded-full transition-all duration-300 ${
            i === current
              ? 'w-6 h-2 bg-neutral-900'
              : i < current
              ? 'w-2 h-2 bg-neutral-400'
              : 'w-2 h-2 bg-neutral-200'
          }`}
        />
      ))}
    </div>
  );
}

// ─── Step 1: Build your guest list ───────────────────────────────────────────
function Step1({ eventId, onAddManually, onImportCsv, onSkip }) {
  return (
    <div className="flex flex-col h-full">
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-2">Step 1 of 4</p>
        <h2 className="text-2xl font-black text-neutral-900 mb-2">Build your guest list</h2>
        <p className="text-neutral-500 text-sm leading-relaxed">
          Add guests so staff can scan their QR codes at the door.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Add manually card */}
        <button
          onClick={onAddManually}
          className="group flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-neutral-200 hover:border-neutral-900 hover:bg-neutral-50 transition-all text-left"
        >
          <div className="w-12 h-12 rounded-xl bg-neutral-100 group-hover:bg-neutral-900 group-hover:text-white flex items-center justify-center transition-all">
            <UserPlus className="w-6 h-6 text-neutral-700 group-hover:text-white transition-colors" />
          </div>
          <div>
            <p className="font-bold text-neutral-900 text-sm mb-1">Add manually</p>
            <p className="text-xs text-neutral-500 leading-relaxed">Enter each guest's name and email one at a time.</p>
          </div>
        </button>

        {/* Import CSV card */}
        <button
          onClick={onImportCsv}
          className="group flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-neutral-200 hover:border-neutral-900 hover:bg-neutral-50 transition-all text-left"
        >
          <div className="w-12 h-12 rounded-xl bg-neutral-100 group-hover:bg-neutral-900 flex items-center justify-center transition-all">
            <Upload className="w-6 h-6 text-neutral-700 group-hover:text-white transition-colors" />
          </div>
          <div>
            <p className="font-bold text-neutral-900 text-sm mb-1">Import CSV</p>
            <p className="text-xs text-neutral-500 leading-relaxed">Upload a spreadsheet of guests in bulk.</p>
          </div>
        </button>
      </div>

      <p className="text-xs text-neutral-400 bg-neutral-50 rounded-xl p-4 border border-neutral-100 leading-relaxed mb-6">
        <span className="font-semibold text-neutral-600">Tip:</span> You can also sync guests automatically from Stripe, Luma, or Eventbrite — set that up in Settings after adding your first guest.
      </p>

      <div className="mt-auto pt-4 border-t border-neutral-100">
        <button
          onClick={onSkip}
          className="text-sm text-neutral-400 hover:text-neutral-600 underline underline-offset-2 transition-colors"
        >
          Skip for now →
        </button>
      </div>
    </div>
  );
}

// ─── Step 2: The QR invite ────────────────────────────────────────────────────
function Step2({ invites, onNext, onBack }) {
  const apiBase = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/api$/, '');
  const firstInvite = invites[0];

  return (
    <div className="flex flex-col h-full">
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-2">Step 2 of 4</p>
        <h2 className="text-2xl font-black text-neutral-900 mb-2">The QR invite</h2>
        <p className="text-neutral-500 text-sm leading-relaxed">
          Each guest receives a unique QR code. Staff scan it at the door to admit them instantly.
        </p>
      </div>

      {/* QR preview */}
      <div className="flex-1 flex items-center justify-center mb-6">
        {firstInvite ? (
          <div className="text-center">
            <img
              src={`/api/invite/${firstInvite.inviteCode}/qr.svg`}
              alt="Guest QR card"
              className="w-60 h-auto mx-auto rounded-xl shadow-md border border-neutral-100"
            />
            <p className="text-xs text-neutral-400 mt-3 font-mono">{firstInvite.inviteCode}</p>
            <p className="text-xs text-neutral-500 mt-1">
              This is {firstInvite.guestName}'s QR card — sent directly to them.
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 px-8 py-10 rounded-2xl border-2 border-dashed border-neutral-200 bg-neutral-50 w-full max-w-xs text-center">
            <div className="w-14 h-14 rounded-2xl bg-neutral-200 flex items-center justify-center">
              <QrCode className="w-7 h-7 text-neutral-400" />
            </div>
            <div>
              <p className="font-semibold text-neutral-600 text-sm">Your QR card will appear here</p>
              <p className="text-xs text-neutral-400 mt-1">after you add a guest.</p>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-neutral-100">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <button
          onClick={onNext}
          className="flex items-center gap-2 px-5 py-2.5 bg-neutral-900 text-white text-sm font-bold rounded-xl hover:bg-black transition-all"
        >
          Next <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Step 3: Check-in settings ────────────────────────────────────────────────
function Step3({ eventId, onNext, onBack }) {
  const [localSettings, setLocalSettings] = useState({
    requirePin: false,
    allowManualOverride: false,
    staffNote: '',
  });
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await eventAPI.getCheckInSettings(eventId);
        const s = res.data?.settings || res.data || {};
        setLocalSettings({
          requirePin: !!s.requirePin,
          allowManualOverride: !!s.allowManualOverride,
          staffNote: s.staffNote || '',
        });
      } catch {
        // Non-fatal — defaults are fine
      } finally {
        setLoadingSettings(false);
      }
    })();
  }, [eventId]);

  const handleNext = async () => {
    setSaving(true);
    try {
      await eventAPI.updateCheckInSettings(eventId, localSettings);
    } catch {
      toast.error('Could not save settings — you can update them later in Settings.');
    } finally {
      setSaving(false);
      onNext(localSettings);
    }
  };

  const Toggle = ({ checked, onChange }) => (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? 'bg-neutral-900' : 'bg-neutral-200'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-2">Step 3 of 4</p>
        <h2 className="text-2xl font-black text-neutral-900 mb-2">How check-in works</h2>
        <p className="text-neutral-500 text-sm leading-relaxed">
          Configure what staff see and require at the door. You can change these at any time.
        </p>
      </div>

      {loadingSettings ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex-1 space-y-4 mb-6">
          {/* Require PIN */}
          <div className="flex items-start justify-between gap-4 p-4 rounded-xl border border-neutral-200 bg-white">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-neutral-100 flex items-center justify-center flex-shrink-0">
                <Lock className="w-4 h-4 text-neutral-600" />
              </div>
              <div>
                <p className="font-semibold text-neutral-900 text-sm">Require PIN</p>
                <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">
                  Staff must verify a 4-digit PIN at the door.
                </p>
              </div>
            </div>
            <Toggle
              checked={localSettings.requirePin}
              onChange={(v) => setLocalSettings((s) => ({ ...s, requirePin: v }))}
            />
          </div>

          {/* Allow manual override */}
          <div className="flex items-start justify-between gap-4 p-4 rounded-xl border border-neutral-200 bg-white">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-neutral-100 flex items-center justify-center flex-shrink-0">
                <Shield className="w-4 h-4 text-neutral-600" />
              </div>
              <div>
                <p className="font-semibold text-neutral-900 text-sm">Allow manual override</p>
                <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">
                  Managers can admit already-used tickets with a reason.
                </p>
              </div>
            </div>
            <Toggle
              checked={localSettings.allowManualOverride}
              onChange={(v) => setLocalSettings((s) => ({ ...s, allowManualOverride: v }))}
            />
          </div>

          {/* Staff note */}
          <div className="p-4 rounded-xl border border-neutral-200 bg-white">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg bg-neutral-100 flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-neutral-600" />
              </div>
              <div>
                <p className="font-semibold text-neutral-900 text-sm">Staff note</p>
                <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">
                  A message shown to staff on every successful scan — useful for wristband color, table directions, etc.
                </p>
              </div>
            </div>
            <textarea
              value={localSettings.staffNote}
              onChange={(e) => setLocalSettings((s) => ({ ...s, staffNote: e.target.value }))}
              placeholder="e.g. Blue wristband for VIP, direct to Table A"
              rows={2}
              className="w-full text-sm border border-neutral-200 rounded-lg px-3 py-2 focus:outline-none focus:border-neutral-400 resize-none"
            />
          </div>
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-neutral-100">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <button
          onClick={handleNext}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-neutral-900 text-white text-sm font-bold rounded-xl hover:bg-black transition-all disabled:opacity-60"
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              Saving…
            </>
          ) : (
            <>Next <ChevronRight className="w-4 h-4" /></>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Step 4: You're ready ─────────────────────────────────────────────────────
function Step4({ event, invites, checkinSettings, onDone }) {
  return (
    <div className="flex flex-col h-full">
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-neutral-400 mb-2">Step 4 of 4</p>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-black text-neutral-900">Check-in is ready</h2>
        </div>
        <p className="text-neutral-500 text-sm leading-relaxed">
          {event?.title || 'Your event'} is set up and ready for guests.
        </p>
      </div>

      {/* Summary cards */}
      <div className="flex-1 space-y-3 mb-6">
        <div className="flex items-center gap-4 p-4 rounded-xl bg-neutral-50 border border-neutral-100">
          <div className="w-9 h-9 rounded-lg bg-white border border-neutral-200 flex items-center justify-center flex-shrink-0">
            <Users className="w-4 h-4 text-neutral-600" />
          </div>
          <div>
            <p className="text-xs text-neutral-500 font-medium uppercase tracking-wide">Guest list</p>
            <p className="font-bold text-neutral-900">
              {invites.length === 0
                ? 'No guests yet — add them any time'
                : `${invites.length} guest${invites.length !== 1 ? 's' : ''} added`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 p-4 rounded-xl bg-neutral-50 border border-neutral-100">
          <div className="w-9 h-9 rounded-lg bg-white border border-neutral-200 flex items-center justify-center flex-shrink-0">
            <Lock className="w-4 h-4 text-neutral-600" />
          </div>
          <div>
            <p className="text-xs text-neutral-500 font-medium uppercase tracking-wide">PIN requirement</p>
            <p className="font-bold text-neutral-900">
              {checkinSettings?.requirePin ? 'Required at the door' : 'Not required'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 p-4 rounded-xl bg-neutral-50 border border-neutral-100">
          <div className="w-9 h-9 rounded-lg bg-white border border-neutral-200 flex items-center justify-center flex-shrink-0">
            <FileText className="w-4 h-4 text-neutral-600" />
          </div>
          <div>
            <p className="text-xs text-neutral-500 font-medium uppercase tracking-wide">Staff note</p>
            <p className="font-bold text-neutral-900">
              {checkinSettings?.staffNote
                ? `"${checkinSettings.staffNote.slice(0, 60)}${checkinSettings.staffNote.length > 60 ? '…' : ''}"`
                : 'None set'}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3 pt-4 border-t border-neutral-100">
        <button
          onClick={onDone}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-neutral-900 text-white font-bold rounded-xl hover:bg-black transition-all"
        >
          Go to dashboard <ArrowRight className="w-4 h-4" />
        </button>
        <a
          href="https://docs.planitapp.com/checkin-guide"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 px-6 py-2.5 text-sm text-neutral-500 hover:text-neutral-900 border border-neutral-200 rounded-xl transition-all"
        >
          <BookOpen className="w-4 h-4" /> View check-in guide
        </a>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SETUP WIZARD — main export
// ═══════════════════════════════════════════════════════════════════════════════
export default function SetupWizard({
  eventId,
  event,
  invites,
  onClose,
  onOpenAddGuest,
  onOpenCsvImport,
}) {
  const [step, setStep] = useState(0);
  const [savedSettings, setSavedSettings] = useState(null);

  const markDone = () => {
    localStorage.setItem(`checkin_setup_done_${eventId}`, 'true');
  };

  // Step 1 actions
  const handleAddManually = () => {
    markDone();
    onClose();
    onOpenAddGuest();
  };

  const handleImportCsv = () => {
    markDone();
    onClose();
    onOpenCsvImport();
  };

  const handleSkip = () => setStep(1);

  // Step 3 → 4 transition: receive saved settings for summary
  const handleSettingsSaved = (settings) => {
    setSavedSettings(settings);
    setStep(3);
  };

  // Step 4: close
  const handleDone = () => {
    markDone();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Panel */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col"
           style={{ minHeight: 520 }}>

        {/* Header bar */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-neutral-900 flex items-center justify-center">
              <QrCode className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold text-neutral-700">Check-in Setup</span>
          </div>
          <div className="flex items-center gap-4">
            <StepDots current={step} total={4} />
            <button
              onClick={handleDone}
              className="p-1 rounded-lg hover:bg-neutral-100 transition-colors text-neutral-400 hover:text-neutral-700"
              title="Close wizard"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Step content */}
        <div className="flex-1 p-6 flex flex-col">
          {step === 0 && (
            <Step1
              eventId={eventId}
              onAddManually={handleAddManually}
              onImportCsv={handleImportCsv}
              onSkip={handleSkip}
            />
          )}
          {step === 1 && (
            <Step2
              invites={invites}
              onNext={() => setStep(2)}
              onBack={() => setStep(0)}
            />
          )}
          {step === 2 && (
            <Step3
              eventId={eventId}
              onNext={handleSettingsSaved}
              onBack={() => setStep(1)}
            />
          )}
          {step === 3 && (
            <Step4
              event={event}
              invites={invites}
              checkinSettings={savedSettings}
              onDone={handleDone}
            />
          )}
        </div>
      </div>
    </div>
  );
}
