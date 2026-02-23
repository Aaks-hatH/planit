import { useState, useEffect } from 'react';
import {
  Settings, X, Users, MessageSquare, BarChart3, FileText,
  Calendar, Save, Lock, Globe, Clock, CheckCircle, AlertTriangle,
  ChevronDown, ChevronUp, Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import { eventAPI } from '../services/api';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// ─── Toggle row component ─────────────────────────────────────────────────────
function Toggle({ label, description, checked, onChange, disabled }) {
  return (
    <div className={`flex items-center justify-between py-3 ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex-1 min-w-0 pr-4">
        <p className="text-sm font-medium text-neutral-900">{label}</p>
        {description && <p className="text-xs text-neutral-500 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        className={`relative flex-shrink-0 w-10 h-5.5 rounded-full transition-colors duration-200 focus:outline-none ${
          checked ? 'bg-neutral-900' : 'bg-neutral-200'
        }`}
        style={{ height: '22px', width: '40px' }}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-transform duration-200 ${
            checked ? 'translate-x-[18px]' : 'translate-x-0'
          }`}
          style={{ width: '18px', height: '18px' }}
        />
      </button>
    </div>
  );
}

// ─── Section component ────────────────────────────────────────────────────────
function Section({ title, icon: Icon, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-neutral-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between w-full px-4 py-3 bg-neutral-50 hover:bg-neutral-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-neutral-500" />
          <span className="text-sm font-semibold text-neutral-700">{title}</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
      </button>
      {open && <div className="px-4 divide-y divide-neutral-100">{children}</div>}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function OrganizerSettings({ eventId, event, onClose, onUpdated }) {
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  // General fields
  const [title, setTitle]               = useState(event?.title || '');
  const [description, setDescription]   = useState(event?.description || '');
  const [location, setLocation]         = useState(event?.location || '');
  const [date, setDate]                 = useState(event?.date ? new Date(event.date).toISOString().slice(0, 16) : '');
  const [maxParticipants, setMaxParticipants] = useState(event?.maxParticipants || 100);
  const [status, setStatus]             = useState(event?.status || 'active');

  // Feature toggles (from event.settings)
  const [allowChat, setAllowChat]           = useState(event?.settings?.allowChat !== false);
  const [allowPolls, setAllowPolls]         = useState(event?.settings?.allowPolls !== false);
  const [allowFileSharing, setAllowFileSharing] = useState(event?.settings?.allowFileSharing !== false);
  const [requireApproval, setRequireApproval]   = useState(event?.settings?.requireApproval === true);
  const [isPublic, setIsPublic]             = useState(event?.settings?.isPublic === true);

  // RSVP settings
  const [rsvpEnabled, setRsvpEnabled]         = useState(event?.settings?.rsvpEnabled !== false);
  const [rsvpAllowMaybe, setRsvpAllowMaybe]   = useState(event?.settings?.rsvpAllowMaybe !== false);
  const [rsvpShowCount, setRsvpShowCount]     = useState(event?.settings?.rsvpShowCount !== false);
  const [rsvpDeadline, setRsvpDeadline]       = useState(
    event?.settings?.rsvpDeadline
      ? new Date(event.settings.rsvpDeadline).toISOString().slice(0, 16)
      : ''
  );
  const [rsvpMessage, setRsvpMessage]         = useState(event?.settings?.rsvpMessage || '');

  const handleSave = async () => {
    setSaving(true);
    try {
      // 1. Update core event fields + feature toggles via PUT /events/:id
      await eventAPI.update(eventId, {
        title:           title.trim() || undefined,
        description:     description,
        location:        location,
        date:            date || undefined,
        maxParticipants: parseInt(maxParticipants) || 100,
        status,
        settings: {
          allowChat,
          allowPolls,
          allowFileSharing,
          requireApproval,
          isPublic,
        },
      });

      // 2. Update RSVP-specific settings via PATCH /events/:id/rsvp-settings
      await eventAPI.updateRsvpSettings(eventId, {
        rsvpEnabled,
        rsvpDeadline:  rsvpDeadline || null,
        rsvpAllowMaybe,
        rsvpShowCount,
        rsvpMessage,
      });

      toast.success('Settings saved');
      onUpdated?.(); // trigger event reload in parent
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-neutral-700" />
            <h2 className="text-base font-semibold text-neutral-900">Event Settings</h2>
          </div>
          <button onClick={onClose} className="btn btn-ghost p-1.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-neutral-100 px-6 gap-1">
          {[
            { id: 'general', label: 'General' },
            { id: 'features', label: 'Features' },
            { id: 'rsvp', label: 'RSVP' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${
                activeTab === tab.id
                  ? 'text-neutral-900 border-neutral-900'
                  : 'text-neutral-500 border-transparent hover:text-neutral-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* ── General tab ── */}
          {activeTab === 'general' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1.5">Event Title</label>
                <input
                  type="text" className="input text-sm" value={title}
                  onChange={e => setTitle(e.target.value)} placeholder="Event title"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1.5">Description</label>
                <textarea
                  className="input text-sm resize-none" rows={3} value={description}
                  onChange={e => setDescription(e.target.value)} placeholder="Event description (optional)"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1.5">Date & Time</label>
                  <input
                    type="datetime-local" className="input text-sm" value={date}
                    onChange={e => setDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1.5">Max Participants</label>
                  <input
                    type="number" className="input text-sm" min={1} max={10000}
                    value={maxParticipants} onChange={e => setMaxParticipants(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1.5">Location</label>
                <input
                  type="text" className="input text-sm" value={location}
                  onChange={e => setLocation(e.target.value)} placeholder="Location (optional)"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1.5">Event Status</label>
                <select
                  className="input text-sm" value={status}
                  onChange={e => setStatus(e.target.value)}
                >
                  <option value="active">Active — event is live</option>
                  <option value="completed">Completed — event has ended</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          )}

          {/* ── Features tab ── */}
          {activeTab === 'features' && (
            <div className="space-y-3">
              <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700">
                  Disabling a feature hides it from all participants immediately. Existing data is preserved.
                </p>
              </div>

              <Section title="Collaboration" icon={MessageSquare}>
                <Toggle
                  label="Chat"
                  description="Real-time messaging between participants"
                  checked={allowChat}
                  onChange={setAllowChat}
                />
                <Toggle
                  label="Polls"
                  description="Create and vote on polls"
                  checked={allowPolls}
                  onChange={setAllowPolls}
                />
                <Toggle
                  label="File Sharing"
                  description="Upload and download files"
                  checked={allowFileSharing}
                  onChange={setAllowFileSharing}
                />
              </Section>

              <Section title="Access Control" icon={Lock}>
                <Toggle
                  label="Require Join Approval"
                  description="New participants must be approved by you before they can join"
                  checked={requireApproval}
                  onChange={setRequireApproval}
                />
                <Toggle
                  label="Public Event"
                  description="Event appears in public listings and can be found by search"
                  checked={isPublic}
                  onChange={setIsPublic}
                />
              </Section>

              <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl">
                <p className="text-xs font-medium text-neutral-700 mb-1">Current participant count</p>
                <p className="text-sm text-neutral-900">
                  {event?.participants?.length || 0} / {maxParticipants} participants
                </p>
                <p className="text-xs text-neutral-400 mt-1">
                  Change max participants in the General tab
                </p>
              </div>
            </div>
          )}

          {/* ── RSVP tab ── */}
          {activeTab === 'rsvp' && (
            <div className="space-y-4">
              <Section title="RSVP Options" icon={CheckCircle} defaultOpen>
                <Toggle
                  label="Enable RSVP"
                  description="Allow participants to RSVP to your event"
                  checked={rsvpEnabled}
                  onChange={setRsvpEnabled}
                />
                <Toggle
                  label='Allow "Maybe" responses'
                  description='Participants can respond with "Maybe" in addition to Yes/No'
                  checked={rsvpAllowMaybe}
                  onChange={setRsvpAllowMaybe}
                  disabled={!rsvpEnabled}
                />
                <Toggle
                  label="Show RSVP count to guests"
                  description="Guests on the invite page can see how many people are going"
                  checked={rsvpShowCount}
                  onChange={setRsvpShowCount}
                  disabled={!rsvpEnabled}
                />
              </Section>

              <div className={!rsvpEnabled ? 'opacity-50 pointer-events-none' : ''}>
                <label className="block text-xs font-medium text-neutral-600 mb-1.5">
                  RSVP Deadline
                  <span className="font-normal text-neutral-400 ml-1">(optional)</span>
                </label>
                <input
                  type="datetime-local" className="input text-sm" value={rsvpDeadline}
                  onChange={e => setRsvpDeadline(e.target.value)}
                />
                <p className="text-xs text-neutral-400 mt-1">
                  After this date, RSVP changes are locked. Guests will see a countdown on their invite page.
                </p>
                {rsvpDeadline && new Date(rsvpDeadline) < new Date() && (
                  <div className="flex items-center gap-1.5 mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    This deadline is in the past — RSVPs are already locked.
                  </div>
                )}
              </div>

              <div className={!rsvpEnabled ? 'opacity-50 pointer-events-none' : ''}>
                <label className="block text-xs font-medium text-neutral-600 mb-1.5">
                  Custom message for guests
                  <span className="font-normal text-neutral-400 ml-1">(optional)</span>
                </label>
                <textarea
                  className="input text-sm resize-none" rows={3}
                  value={rsvpMessage}
                  onChange={e => setRsvpMessage(e.target.value.slice(0, 500))}
                  placeholder="e.g. Please RSVP by Friday so we can finalise catering numbers."
                />
                <p className="text-xs text-neutral-400 mt-1">
                  {rsvpMessage.length}/500 — shown on the guest invite page above the RSVP buttons.
                </p>
              </div>

              {/* RSVP summary */}
              <div className="p-4 bg-neutral-50 border border-neutral-200 rounded-xl">
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Current RSVP status</p>
                <div className="flex gap-5">
                  <div className="text-center">
                    <p className="text-xl font-bold text-emerald-600">{event?.rsvpSummary?.yes || 0}</p>
                    <p className="text-xs text-neutral-500">Going</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-amber-600">{event?.rsvpSummary?.maybe || 0}</p>
                    <p className="text-xs text-neutral-500">Maybe</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-neutral-400">{event?.rsvpSummary?.no || 0}</p>
                    <p className="text-xs text-neutral-500">Not going</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-neutral-300">
                      {(event?.participants?.length || 0) -
                       ((event?.rsvpSummary?.yes || 0) + (event?.rsvpSummary?.maybe || 0) + (event?.rsvpSummary?.no || 0))}
                    </p>
                    <p className="text-xs text-neutral-500">No response</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-100 bg-neutral-50">
          <button onClick={onClose} className="btn btn-secondary text-sm">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn btn-primary text-sm gap-1.5"
          >
            {saving ? (
              <><span className="spinner w-3.5 h-3.5 border-2 border-white/30 border-t-white" />Saving...</>
            ) : (
              <><Save className="w-3.5 h-3.5" />Save Changes</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
