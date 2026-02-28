import { useState, useEffect, useRef } from 'react';
import {
 Settings, X, Users, MessageSquare, BarChart3, FileText,
 Calendar, Save, Lock, Globe, Clock, CheckCircle, AlertTriangle,
 ChevronDown, ChevronUp, Info, Webhook, Copy, Trash2, Plus, RefreshCw,
 Image, Palette, Tag, Upload, Bell, UserCheck, UserX
} from 'lucide-react';
import toast from 'react-hot-toast';
import { eventAPI, fileAPI } from '../services/api';

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
export default function OrganizerSettings({ eventId, event, onClose, onUpdated, initialTab, pendingCount = 0 }) {
 const [saving, setSaving] = useState(false);
 const [activeTab, setActiveTab] = useState(initialTab || 'general');

 // General fields
 const [title, setTitle] = useState(event?.title || '');
 const [description, setDescription] = useState(event?.description || '');
 const [location, setLocation] = useState(event?.location || '');
 const [date, setDate] = useState(event?.date ? new Date(event.date).toISOString().slice(0, 16) : '');
 const [maxParticipants, setMaxParticipants] = useState(event?.maxParticipants || 100);
 const [status, setStatus] = useState(event?.status || 'active');

 // Feature toggles (from event.settings)
 const [allowChat, setAllowChat] = useState(event?.settings?.allowChat !== false);
 const [allowPolls, setAllowPolls] = useState(event?.settings?.allowPolls !== false);
 const [allowFileSharing, setAllowFileSharing] = useState(event?.settings?.allowFileSharing !== false);
 const [requireApproval, setRequireApproval] = useState(event?.settings?.requireApproval === true);
 const [isPublic, setIsPublic] = useState(event?.settings?.isPublic === true);

 // RSVP settings
 const [rsvpEnabled, setRsvpEnabled] = useState(event?.settings?.rsvpEnabled !== false);
 const [rsvpAllowMaybe, setRsvpAllowMaybe] = useState(event?.settings?.rsvpAllowMaybe !== false);
 const [rsvpShowCount, setRsvpShowCount] = useState(event?.settings?.rsvpShowCount !== false);
 const [rsvpDeadline, setRsvpDeadline] = useState(
 event?.settings?.rsvpDeadline
 ? new Date(event.settings.rsvpDeadline).toISOString().slice(0, 16)
 : ''
 );
 const [rsvpMessage, setRsvpMessage] = useState(event?.settings?.rsvpMessage || '');

 // Integrations / Webhooks
 const [webhooks, setWebhooks] = useState([]);
 const [webhooksLoading, setWebhooksLoading] = useState(false);
 const [newWh, setNewWh] = useState({ url: '', events: [], secret: '' });
 const [addingWh, setAddingWh] = useState(false);
 // Clone
 const [cloneDate, setCloneDate] = useState('');
 const [cloneTitle, setCloneTitle] = useState('');
 const [cloning, setCloning] = useState(false);

 // Theme
 const [coverImage, setCoverImage] = useState(event?.coverImage || null);
 const [themeColor, setThemeColor] = useState(event?.themeColor || null);
 const [tags, setTags] = useState(event?.tags || []);
 const [tagInput, setTagInput] = useState('');
 const [uploadingCover, setUploadingCover] = useState(false);
 const coverInputRef = useRef(null);

 // ── Approval queue state ────────────────────────────────────────────────────
 const [approvalQueue,   setApprovalQueue]   = useState([]);
 const [queueLoading,    setQueueLoading]    = useState(false);
 const [queueActionId,   setQueueActionId]   = useState(null); // username being actioned

 const THEME_COLORS = [
 '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
 '#f59e0b', '#10b981', '#06b6d4', '#3b82f6',
 ];

 const WEBHOOK_EVENT_TYPES = [
 { id: 'participant_joined', label: 'Participant joined' },
 { id: 'rsvp_updated', label: 'RSVP updated' },
 { id: 'checkin', label: 'Guest checked in' },
 { id: 'message_sent', label: 'Message sent' },
 ];

 // ── Supported webhook services ──────────────────────────────────────────────
 const SUPPORTED_SERVICES = [
 {
 id: 'discord',
 name: 'Discord',
 color: 'bg-indigo-50 border-indigo-200 text-indigo-700',
 dotColor: 'bg-indigo-500',
 match: u => u.includes('discord.com/api/webhooks'),
 warning: null, nativeSupport: 'PlanIt automatically formats payloads as Discord embeds — paste your Discord webhook URL and it will work directly.',
 hint: 'discord.com/api/webhooks/…',
 guide: 'Server Settings → Integrations → Webhooks → New Webhook',
 },
 {
 id: 'slack',
 name: 'Slack',
 color: 'bg-purple-50 border-purple-200 text-purple-700',
 dotColor: 'bg-purple-500',
 match: u => u.includes('hooks.slack.com'),
 warning: null,
 hint: 'hooks.slack.com/services/…',
 guide: 'App Directory → Incoming WebHooks → Add to Slack',
 },
 {
 id: 'pipedream',
 name: 'Pipedream',
 color: 'bg-green-50 border-green-200 text-green-700',
 dotColor: 'bg-green-500',
 match: u => u.includes('pipedream.net') || u.includes('pipedream.com'),
 warning: null,
 hint: 'pipedream.net/…',
 guide: 'New Workflow → HTTP Trigger → copy the URL',
 },
 {
 id: 'zapier',
 name: 'Zapier',
 color: 'bg-orange-50 border-orange-200 text-orange-700',
 dotColor: 'bg-orange-500',
 match: u => u.includes('hooks.zapier.com'),
 warning: null,
 hint: 'hooks.zapier.com/hooks/…',
 guide: 'Make a Zap → Webhooks by Zapier → Catch Hook',
 },
 {
 id: 'make',
 name: 'Make.com',
 color: 'bg-violet-50 border-violet-200 text-violet-700',
 dotColor: 'bg-violet-500',
 match: u => u.includes('hook.make.com') || u.includes('hook.integromat.com'),
 warning: null,
 hint: 'hook.make.com/…',
 guide: 'Create Scenario → Webhooks → Custom Webhook',
 },
 {
 id: 'n8n',
 name: 'n8n',
 color: 'bg-red-50 border-red-200 text-red-700',
 dotColor: 'bg-red-500',
 match: u => u.includes('n8n.io') || u.includes('/webhook/'),
 warning: null,
 hint: 'your-n8n.cloud/webhook/…',
 guide: 'New Workflow → Webhook node → copy the URL',
 },
 ];

 const detectService = (url) => {
 if (!url) return null;
 return SUPPORTED_SERVICES.find(s => s.match(url.toLowerCase())) || null;
 };

 const detectedService = detectService(newWh.url);

 useEffect(() => {
 if (activeTab === 'integrations') {
 setWebhooksLoading(true);
 eventAPI.getWebhooks(eventId)
 .then(r => setWebhooks(r.data.webhooks || []))
 .catch(() => {})
 .finally(() => setWebhooksLoading(false));
 }
 }, [activeTab, eventId]);

 // ── Approval queue functions ──────────────────────────────────────────────
 const loadApprovalQueue = async () => {
   setQueueLoading(true);
   try {
     const res = await eventAPI.getApprovalQueue(eventId);
     setApprovalQueue(res.data.queue || []);
   } catch {
     toast.error('Failed to load approval queue');
   } finally { setQueueLoading(false); }
 };

 const handleApprove = async (username) => {
   setQueueActionId(username);
   try {
     await eventAPI.approveParticipant(eventId, username);
     setApprovalQueue(prev => prev.filter(r => r.username !== username));
     toast.success(`${username} approved and can now join.`);
   } catch {
     toast.error('Failed to approve participant');
   } finally { setQueueActionId(null); }
 };

 const handleReject = async (username) => {
   setQueueActionId(username);
   try {
     await eventAPI.rejectParticipant(eventId, username);
     setApprovalQueue(prev => prev.filter(r => r.username !== username));
     toast.success(`${username}'s request rejected.`);
   } catch {
     toast.error('Failed to reject request');
   } finally { setQueueActionId(null); }
 };

 const handleSave = async () => {
 setSaving(true);
 try {
 // 1. Update core event fields + feature toggles via PUT /events/:id
 await eventAPI.update(eventId, {
 title: title.trim() || undefined,
 description: description,
 location: location,
 date: date || undefined,
 maxParticipants: parseInt(maxParticipants) || 100,
 status,
 settings: {
 allowChat,
 allowPolls,
 allowFileSharing,
 requireApproval,
 isPublic,
 },
 coverImage: coverImage || null,
 themeColor: themeColor || null,
 tags: tags,
 });

 // 2. Update RSVP-specific settings via PATCH /events/:id/rsvp-settings
 await eventAPI.updateRsvpSettings(eventId, {
 rsvpEnabled,
 rsvpDeadline: rsvpDeadline || null,
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
 className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col"
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
     { id: 'approvals', label: 'Approvals', badge: pendingCount },
 { id: 'rsvp', label: 'RSVP' },
 { id: 'theme', label: 'Theme' },
 { id: 'integrations', label: 'Integrations' },
 ].map(tab => (
 <button
 key={tab.id}
 onClick={() => { setActiveTab(tab.id); if (tab.id === 'approvals') loadApprovalQueue(); }}
 className={`px-3 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${
 activeTab === tab.id
 ? 'text-neutral-900 border-neutral-900'
 : 'text-neutral-500 border-transparent hover:text-neutral-700'
 }`}
 >
     <span className="relative inline-flex items-center gap-1.5">
       {tab.label}
       {tab.badge > 0 && (
         <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-black bg-red-500 text-white rounded-full">
           {tab.badge > 9 ? '9+' : tab.badge}
         </span>
       )}
     </span>
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
 {/* Approvals tab */}
 {activeTab === 'approvals' && (
  <div className="space-y-4">
   {!requireApproval ? (
    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
     <p className="font-semibold mb-1">Join approval is currently off</p>
     <p className="text-xs">Enable "Require Join Approval" in the Features tab to use this feature.</p>
    </div>
   ) : (
    <>
     <div className="flex items-center justify-between">
      <p className="text-sm font-semibold text-neutral-700">Pending join requests</p>
      <button onClick={loadApprovalQueue} className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-600 transition-colors">
       <RefreshCw className="w-3.5 h-3.5" /> Refresh
      </button>
     </div>
     {queueLoading ? (
      <div className="flex items-center justify-center py-8 text-neutral-400 text-sm">Loading…</div>
     ) : approvalQueue.length === 0 ? (
      <div className="text-center py-10 text-neutral-400 text-sm">
       <p className="text-neutral-300 mb-1">No pending requests</p>
       <p className="text-xs">New requests will appear here automatically</p>
      </div>
     ) : (
      <div className="space-y-2">
       {approvalQueue.map(req => (
        <div key={req.username} className="flex items-center gap-3 p-3.5 bg-neutral-50 border border-neutral-200 rounded-xl">
         <div className="w-9 h-9 rounded-full bg-neutral-200 flex items-center justify-center text-sm font-bold text-neutral-600 flex-shrink-0">
          {req.username.charAt(0).toUpperCase()}
         </div>
         <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-neutral-900 truncate">{req.username}</p>
          {req.message && <p className="text-xs text-neutral-500 mt-0.5 truncate">"{req.message}"</p>}
          <p className="text-[10px] text-neutral-400 mt-0.5">
           {new Date(req.requestedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
         </div>
         <div className="flex gap-2 flex-shrink-0">
          <button onClick={() => handleReject(req.username)} disabled={queueActionId === req.username}
           className="px-2.5 py-1.5 text-xs font-semibold text-neutral-500 border border-neutral-200 rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all disabled:opacity-40">
           Reject
          </button>
          <button onClick={() => handleApprove(req.username)} disabled={queueActionId === req.username}
           className="px-2.5 py-1.5 text-xs font-semibold text-white bg-neutral-900 rounded-lg hover:bg-black transition-all disabled:opacity-40">
           {queueActionId === req.username ? '…' : 'Approve'}
          </button>
         </div>
        </div>
       ))}
      </div>
     )}
    </>
   )}
  </div>
 )}

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

 {/* ── Theme tab ── */}
 {activeTab === 'theme' && (
 <div className="space-y-5">
 {/* Cover image */}
 <div>
 <label className="block text-xs font-medium text-neutral-600 mb-2 flex items-center gap-1.5">
 <Image className="w-3.5 h-3.5" /> Cover Image
 </label>

 {/* Preview */}
 {coverImage && (
 <div className="relative mb-3 rounded-xl overflow-hidden border border-neutral-200 h-32">
 <img src={coverImage} alt="Cover" className="w-full h-full object-cover" />
 <button
 type="button"
 onClick={() => setCoverImage(null)}
 className="absolute top-2 right-2 w-6 h-6 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center transition-colors"
 >
 <X className="w-3 h-3 text-white" />
 </button>
 </div>
 )}

 <input
 ref={coverInputRef}
 type="file"
 accept="image/jpeg,image/png,image/webp,image/gif"
 className="hidden"
 onChange={async (e) => {
 const file = e.target.files?.[0];
 if (!file) return;
 if (file.size > 5 * 1024 * 1024) {
 toast.error('Image must be under 5MB');
 return;
 }
 setUploadingCover(true);
 try {
 const fd = new FormData();
 fd.append('files', file);
 const res = await fileAPI.upload(eventId, fd);
 setCoverImage(res.data.file.url);
 toast.success('Cover uploaded');
 } catch {
 toast.error('Upload failed — check Cloudinary is configured');
 } finally {
 setUploadingCover(false);
 e.target.value = '';
 }
 }}
 />
 <button
 type="button"
 onClick={() => coverInputRef.current?.click()}
 disabled={uploadingCover}
 className="flex items-center gap-2 w-full justify-center py-2.5 text-sm text-neutral-600 border border-dashed border-neutral-300 rounded-xl hover:border-neutral-400 hover:text-neutral-800 transition-colors"
 >
 {uploadingCover
 ? <><span className="spinner w-3.5 h-3.5 border-2 border-neutral-300 border-t-neutral-600" />Uploading…</>
 : <><Upload className="w-3.5 h-3.5" />{coverImage ? 'Replace cover image' : 'Upload cover image'}</>
 }
 </button>
 <p className="text-xs text-neutral-400 mt-1.5">
 Shown on the Discover page and as a banner in your event. Max 5MB, JPG/PNG/WebP.
 </p>
 </div>

 {/* Theme color */}
 <div>
 <label className="block text-xs font-medium text-neutral-600 mb-2 flex items-center gap-1.5">
 <Palette className="w-3.5 h-3.5" /> Theme Color
 </label>
 <div className="flex items-center gap-2 flex-wrap">
 {THEME_COLORS.map(color => (
 <button
 key={color}
 type="button"
 onClick={() => setThemeColor(themeColor === color ? null : color)}
 className="w-8 h-8 rounded-full border-2 transition-all hover:scale-110"
 style={{
 background: color,
 borderColor: themeColor === color ? '#111' : 'transparent',
 boxShadow: themeColor === color ? `0 0 0 2px ${color}` : 'none',
 }}
 />
 ))}
 {themeColor && (
 <button
 type="button"
 onClick={() => setThemeColor(null)}
 className="text-xs text-neutral-400 hover:text-neutral-600 ml-1"
 >
 Clear
 </button>
 )}
 </div>
 <p className="text-xs text-neutral-400 mt-1.5">
 Accent color shown on your event card in Discover.
 </p>
 </div>

 {/* Tags */}
 <div>
 <label className="block text-xs font-medium text-neutral-600 mb-2 flex items-center gap-1.5">
 <Tag className="w-3.5 h-3.5" /> Tags <span className="font-normal text-neutral-400">(up to 5)</span>
 </label>

 <div className="flex flex-wrap gap-2 mb-2">
 {tags.map(tag => (
 <span key={tag} className="flex items-center gap-1 px-2.5 py-1 bg-neutral-100 border border-neutral-200 rounded-full text-xs font-medium text-neutral-700">
 {tag}
 <button
 type="button"
 onClick={() => setTags(t => t.filter(x => x !== tag))}
 className="text-neutral-400 hover:text-neutral-700 transition-colors"
 >
 <X className="w-3 h-3" />
 </button>
 </span>
 ))}
 </div>

 {tags.length < 5 && (
 <div className="flex gap-2">
 <input
 type="text"
 className="input text-sm flex-1"
 placeholder="Add a tag (e.g. Conference, Networking)"
 value={tagInput}
 onChange={e => setTagInput(e.target.value.slice(0, 30))}
 onKeyDown={e => {
 if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
 e.preventDefault();
 const t = tagInput.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '');
 if (t && !tags.includes(t)) setTags(prev => [...prev, t]);
 setTagInput('');
 }
 }}
 />
 <button
 type="button"
 onClick={() => {
 const t = tagInput.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '');
 if (t && !tags.includes(t)) { setTags(prev => [...prev, t]); setTagInput(''); }
 }}
 className="btn btn-secondary text-sm px-3"
 >
 <Plus className="w-3.5 h-3.5" />
 </button>
 </div>
 )}

 <div className="flex flex-wrap gap-1.5 mt-2">
 {['conference', 'networking', 'workshop', 'social', 'sports', 'music', 'tech', 'arts'].filter(t => !tags.includes(t)).slice(0, 6).map(suggestion => (
 <button
 key={suggestion}
 type="button"
 onClick={() => { if (tags.length < 5) setTags(prev => [...prev, suggestion]); }}
 className="px-2 py-0.5 text-xs text-neutral-500 border border-neutral-200 rounded-full hover:bg-neutral-100 transition-colors"
 >
 + {suggestion}
 </button>
 ))}
 </div>
 </div>
 </div>
 )}

 {/* ── Integrations tab ── */}
 {activeTab === 'integrations' && (
 <div className="space-y-5">

 {/* ── Clone event ── */}
 <div className="border border-neutral-200 rounded-xl overflow-hidden">
 <div className="flex items-center gap-2 px-4 py-3 bg-neutral-50 border-b border-neutral-200">
 <RefreshCw className="w-4 h-4 text-neutral-500" />
 <span className="text-sm font-semibold text-neutral-700">Recurring / Clone Event</span>
 </div>
 <div className="px-4 py-4 space-y-3">
 <p className="text-xs text-neutral-500">Copy this event (title, agenda, settings) to a new date. The clone starts fresh with no participants or messages.</p>
 <div>
 <label className="block text-xs font-medium text-neutral-600 mb-1.5">New title <span className="font-normal text-neutral-400">(optional — defaults to same title)</span></label>
 <input type="text" className="input text-sm" placeholder={event?.title} value={cloneTitle} onChange={e => setCloneTitle(e.target.value)} />
 </div>
 <div>
 <label className="block text-xs font-medium text-neutral-600 mb-1.5">New date & time <span className="text-red-500">*</span></label>
 <input type="datetime-local" className="input text-sm" value={cloneDate} onChange={e => setCloneDate(e.target.value)} />
 </div>
 <button
 disabled={!cloneDate || cloning}
 onClick={async () => {
 if (!cloneDate) return;
 setCloning(true);
 try {
 const r = await eventAPI.clone(eventId, { date: cloneDate, title: cloneTitle || undefined });
 toast.success('Event cloned! Opening…');
 setTimeout(() => window.open(`/event/${r.data.event.id}`, '_blank'), 800);
 } catch (err) {
 toast.error(err.response?.data?.error || 'Clone failed');
 } finally { setCloning(false); }
 }}
 className="btn btn-secondary text-sm gap-1.5 w-full"
 >
 {cloning ? <><span className="spinner w-3.5 h-3.5 border-2 border-neutral-300 border-t-neutral-600" />Cloning…</> : <><RefreshCw className="w-3.5 h-3.5" />Clone to new date</>}
 </button>
 </div>
 </div>

 {/* ── Webhooks ── */}
 <div className="border border-neutral-200 rounded-xl overflow-hidden">
 <div className="flex items-center gap-2 px-4 py-3 bg-neutral-50 border-b border-neutral-200">
 <Webhook className="w-4 h-4 text-neutral-500" />
 <span className="text-sm font-semibold text-neutral-700">Webhooks</span>
 <span className="ml-auto text-xs text-neutral-400">{webhooks.length}/5 used</span>
 </div>
 <div className="px-4 py-4 space-y-4">
 <p className="text-xs text-neutral-500">PlanIt will POST a JSON payload to your URL when selected events occur.</p>

 {/* ── Supported services grid ── */}
 <div>
 <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Supported Services</p>
 <div className="grid grid-cols-3 gap-2">
 {SUPPORTED_SERVICES.map(svc => (
 <button
 key={svc.id}
 type="button"
 onClick={() => setNewWh(p => ({ ...p, url: svc.hint }))}
 className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all hover:scale-[1.02] ${svc.color}`}
 >
 <span className={`w-2 h-2 rounded-full flex-shrink-0 ${svc.dotColor}`} />
 <span>{svc.name}</span>
 </button>
 ))}
 </div>
 <p className="text-xs text-neutral-400 mt-1.5">Click a service to see the URL format, or paste your URL directly below.</p>
 </div>

 {/* ── Existing webhooks ── */}
 {webhooksLoading ? (
 <div className="flex justify-center py-4"><span className="spinner w-4 h-4 border-2 border-neutral-200 border-t-neutral-500" /></div>
 ) : webhooks.length > 0 ? (
 <div className="space-y-2">
 <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Active Webhooks</p>
 {webhooks.map(wh => {
 const svc = detectService(wh.url);
 return (
 <div key={wh._id} className="flex items-center justify-between gap-3 px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-lg">
 <div className="min-w-0 flex items-center gap-2">
 <div className="min-w-0">
 <div className="flex items-center gap-1.5">
 {svc && <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${svc.color}`}>{svc.name}</span>}
 <p className="text-xs text-neutral-500 truncate">{wh.url}</p>
 </div>
 <p className="text-xs text-neutral-400 mt-0.5">{wh.events.map(e => WEBHOOK_EVENT_TYPES.find(t => t.id === e)?.label || e).join(', ')}</p>
 </div>
 </div>
 <div className="flex items-center gap-1.5 flex-shrink-0">
 <button
 onClick={async () => {
 await eventAPI.updateWebhook(eventId, wh._id, { active: !wh.active });
 setWebhooks(prev => prev.map(w => w._id === wh._id ? { ...w, active: !w.active } : w));
 }}
 className={`text-xs px-2 py-0.5 rounded-full font-medium border transition-colors ${wh.active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-neutral-100 text-neutral-500 border-neutral-200'}`}
 >{wh.active ? 'Active' : 'Paused'}</button>
 <button
 onClick={async () => {
 await eventAPI.deleteWebhook(eventId, wh._id);
 setWebhooks(prev => prev.filter(w => w._id !== wh._id));
 toast.success('Webhook removed');
 }}
 className="p-1 text-neutral-400 hover:text-red-500 transition-colors"
 ><Trash2 className="w-3.5 h-3.5" /></button>
 </div>
 </div>
 );
 })}
 </div>
 ) : null}

 {/* ── Add webhook form ── */}
 {webhooks.length < 5 && (
 <div className="border border-dashed border-neutral-300 rounded-xl p-4 space-y-3">
 <p className="text-xs font-semibold text-neutral-600">Add Webhook</p>

 {/* URL input with live detection badge */}
 <div className="space-y-1.5">
 <div className="relative">
 <input
 type="url"
 className="input text-sm pr-28"
 placeholder="https://hooks.slack.com/…"
 value={newWh.url}
 onChange={e => setNewWh(p => ({ ...p, url: e.target.value }))}
 />
 {detectedService && (
 <span className={`absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${detectedService.color}`}>
 {detectedService.name} detected
 </span>
 )}
 </div>

 {/* Service-specific guidance */}
 {detectedService && (
 <div className={`rounded-lg border px-3 py-2.5 space-y-1 ${detectedService.color}`}>
 <p className="text-xs font-semibold flex items-center gap-1">
 How to get your {detectedService.name} URL
 </p>
 <p className="text-xs opacity-80">{detectedService.guide}</p>
 {detectedService.warning && (
 <div className="flex items-start gap-1.5 mt-1.5 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5">
 <AlertTriangle className="w-3 h-3 text-amber-600 flex-shrink-0 mt-0.5" />
 <p className="text-xs text-amber-700">{detectedService.warning}</p>
 </div>
 )}
 {detectedService.nativeSupport && (
 <div className="flex items-start gap-1.5 mt-1.5 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-1.5">
 <CheckCircle className="w-3 h-3 text-emerald-600 flex-shrink-0 mt-0.5" />
 <p className="text-xs text-emerald-700">{detectedService.nativeSupport}</p>
 </div>
 )}
 </div>
 )}

 {!detectedService && newWh.url && (
 <p className="text-xs text-neutral-400">Custom endpoint — make sure it accepts POST requests with JSON.</p>
 )}
 </div>

 {/* Trigger event checkboxes */}
 <div className="space-y-1.5">
 <p className="text-xs font-medium text-neutral-600">Trigger on</p>
 <div className="grid grid-cols-2 gap-1.5">
 {WEBHOOK_EVENT_TYPES.map(et => (
 <label key={et.id} className="flex items-center gap-2 cursor-pointer select-none">
 <input
 type="checkbox"
 checked={newWh.events.includes(et.id)}
 onChange={e => setNewWh(p => ({ ...p, events: e.target.checked ? [...p.events, et.id] : p.events.filter(x => x !== et.id) }))}
 className="rounded"
 />
 <span className="text-xs text-neutral-700">{et.label}</span>
 </label>
 ))}
 </div>
 </div>

 {/* Signing secret */}
 <input
 type="text"
 className="input text-sm"
 placeholder="Signing secret (optional — used to verify payloads)"
 value={newWh.secret}
 onChange={e => setNewWh(p => ({ ...p, secret: e.target.value }))}
 />

 <button
 disabled={!newWh.url || newWh.events.length === 0 || addingWh}
 onClick={async () => {
 setAddingWh(true);
 try {
 const r = await eventAPI.createWebhook(eventId, newWh);
 setWebhooks(prev => [...prev, r.data.webhook]);
 setNewWh({ url: '', events: [], secret: '' });
 toast.success('Webhook added');
 } catch (err) {
 toast.error(err.response?.data?.error || 'Failed to add webhook');
 } finally { setAddingWh(false); }
 }}
 className="btn btn-primary text-sm gap-1.5 w-full"
 >
 {addingWh ? <><span className="spinner w-3.5 h-3.5 border-2 border-white/30 border-t-white" />Adding…</> : <><Plus className="w-3.5 h-3.5" />Add Webhook</>}
 </button>
 </div>
 )}
 </div>
 </div>

 </div>
 )}

 </div>{/* ── end scrollable body ── */}

 <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-100 bg-neutral-50 rounded-b-2xl flex-shrink-0">
 <button onClick={onClose} className="btn btn-secondary text-sm">
 Cancel
 </button>
 {activeTab !== 'integrations' && activeTab !== 'approvals' && (
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
 )}
 </div>
 </div>
 </div>
 );
}
