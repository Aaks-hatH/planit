/**
 * frontend/src/components/CloneEventButton.jsx
 *
 * "Clone event" button + modal. Used for standard, enterprise and RSVP-only
 * events. Renders nothing for table service events.
 *
 * Each event has a fixed number of clone uses (2 by default, set on the
 * backend). The organizer picks a date and a slug for every clone; one
 * request can create as many clones as there are uses left.
 *
 * Props
 *   event    the event object (needs timezone, subdomain, eventType, isTableServiceMode)
 *   eventId  the event's _id
 *   variant  'button' (default, full-width button) | 'card' (big row, matches the RSVP dashboard)
 */
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Copy, Plus, X, ExternalLink, ChevronRight, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { eventAPI } from '../services/api';
import { getUserTimezone, localDateTimeToUTC } from '../utils/timezoneUtils';

const SLUG_RE = /^[a-z0-9-]{3,50}$/;
const cleanSlug = (v) => v.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 50);

const emptyRow = () => ({ date: '', slug: '' });

function openUrl(ev) {
  return ev.eventType === 'rsvpOnly'
    ? `/e/${ev.subdomain}/rsvp-dashboard`
    : `/e/${ev.subdomain}`;
}

export default function CloneEventButton({ event, eventId, variant = 'button' }) {
  const [open, setOpen]       = useState(false);
  const [info, setInfo]       = useState(null);   // { used, limit, remaining }
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [rows, setRows]       = useState([emptyRow()]);
  const [title, setTitle]     = useState('');
  const [username, setUsername]   = useState('');
  const [password, setPassword]   = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [busy, setBusy]       = useState(false);
  const [error, setError]     = useState('');
  const [created, setCreated] = useState(null);   // array of created events after success

  if (!event || event.isTableServiceMode) return null;

  const tz = event.timezone || getUserTimezone();
  const remaining = info ? info.remaining : 0;

  const openModal = async () => {
    setOpen(true);
    setError('');
    setCreated(null);
    setRows([emptyRow()]);
    setTitle('');
    setUsername('');
    setPassword('');
    setRecoveryCode('');
    setLoadingInfo(true);
    try {
      const r = await eventAPI.cloneInfo(eventId);
      setInfo(r.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load clone info.');
      setInfo(null);
    } finally {
      setLoadingInfo(false);
    }
  };

  const close = () => { if (!busy) setOpen(false); };

  const setRow = (i, patch) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const validate = () => {
    if (!username.trim()) return 'Enter a username for the new event.';
    if (password.length < 4) return 'Password must be at least 4 characters.';
    const seen = new Set();
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const n = rows.length > 1 ? ` (clone ${i + 1})` : '';
      if (!r.date) return `Pick a date${n}.`;
      const utc = localDateTimeToUTC(r.date, tz);
      if (!utc) return `That date isn't valid${n}.`;
      if (new Date(utc).getTime() < Date.now() - 60 * 60 * 1000) return `Pick a date in the future${n}.`;
      if (!SLUG_RE.test(r.slug)) return `Slug must be 3–50 characters: lowercase letters, numbers and dashes${n}.`;
      if (seen.has(r.slug)) return `"${r.slug}" is used twice — each clone needs its own slug.`;
      seen.add(r.slug);
    }
    return '';
  };

  const submit = async () => {
    const problem = validate();
    if (problem) { setError(problem); return; }
    setError('');
    setBusy(true);
    try {
      const r = await eventAPI.clone(eventId, {
        username: username.trim(),
        accountPassword: password,
        clones: rows.map((row) => ({
          date: localDateTimeToUTC(row.date, tz),
          subdomain: row.slug,
          ...(title.trim() ? { title: title.trim() } : {}),
        })),
      });
      setCreated(r.data.events || (r.data.event ? [r.data.event] : []));
      setRecoveryCode(r.data.recoveryCode || '');
      setPassword('');
      if (r.data.clone) setInfo(r.data.clone);
      if (r.data.failed?.length) {
        toast.error(`${r.data.failed.length} clone${r.data.failed.length > 1 ? 's' : ''} couldn't be created.`);
      } else {
        toast.success(rows.length > 1 ? 'Events cloned!' : 'Event cloned!');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Clone failed.');
      if (err.response?.data?.remaining !== undefined) {
        setInfo({ used: err.response.data.used, limit: err.response.data.limit, remaining: err.response.data.remaining });
      }
    } finally {
      setBusy(false);
    }
  };

  // ── Trigger ────────────────────────────────────────────────────────────────
  const trigger = variant === 'card' ? (
    <button
      type="button"
      onClick={openModal}
      className="w-full flex items-center gap-4 p-5 rounded-2xl border border-neutral-200 bg-white hover:border-neutral-300 hover:shadow-sm transition-all text-left"
    >
      <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
        <Copy className="w-5 h-5 text-indigo-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-neutral-900">Clone Event</p>
        <p className="text-xs text-neutral-400">Copy this event's setup to a new date and link</p>
      </div>
      <ChevronRight className="w-[18px] h-[18px] text-neutral-300" />
    </button>
  ) : (
    <button type="button" onClick={openModal} className="btn btn-secondary text-sm gap-1.5 w-full">
      <Copy className="w-3.5 h-3.5" /> Clone event
    </button>
  );

  // ── Modal ──────────────────────────────────────────────────────────────────
  const modal = open && createPortal(
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4" onClick={close}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <Copy className="w-4 h-4 text-neutral-600" />
            <h3 className="text-base font-semibold text-neutral-900">Clone event</h3>
          </div>
          <button type="button" onClick={close} className="btn btn-ghost p-2"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-6 py-5 overflow-y-auto space-y-4">
          {loadingInfo && (
            <div className="flex justify-center py-6">
              <span className="spinner w-4 h-4 border-2 border-neutral-200 border-t-neutral-500" />
            </div>
          )}

          {/* ── Result ── */}
          {!loadingInfo && created && (
            <div className="space-y-3">
              <p className="text-sm text-neutral-700">
                {created.length > 1 ? 'Your clones are ready.' : 'Your clone is ready.'}
                {' '}Log in with the username and password you just entered.
              </p>
              {recoveryCode && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <p className="text-xs font-medium text-amber-800 mb-1">Recovery code — save it now, it won't be shown again</p>
                  <p className="text-sm font-mono font-semibold text-amber-900 select-all break-all">{recoveryCode}</p>
                </div>
              )}
              {created.map((ev) => (
                <div key={ev.id} className="flex items-center justify-between gap-3 p-3 border border-neutral-200 rounded-xl">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-neutral-900 truncate">{ev.title}</p>
                    <p className="text-xs text-neutral-500 truncate">
                      /e/{ev.subdomain}{ev.date ? ` · ${new Date(ev.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short', timeZone: tz })}` : ''}
                    </p>
                  </div>
                  <a
                    href={openUrl(ev)}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-secondary text-xs gap-1 flex-shrink-0"
                  >
                    Open <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              ))}
              <button type="button" onClick={() => setOpen(false)} className="btn btn-primary text-sm w-full">Done</button>
            </div>
          )}

          {/* ── Out of uses ── */}
          {!loadingInfo && !created && info && remaining === 0 && (
            <p className="text-sm text-neutral-600">
              This event has used all {info.limit} of its clones.
            </p>
          )}

          {/* ── Form ── */}
          {!loadingInfo && !created && info && remaining > 0 && (
            <>
              <p className="text-xs text-neutral-500">
                Copies this event's settings, agenda, checklist and RSVP page to a new date.
                Guests, RSVPs, invites, chat and files are not copied.
                {' '}<span className="font-medium text-neutral-700">{remaining} of {info.limit} clone{info.limit === 1 ? '' : 's'} left.</span>
              </p>

              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1.5">
                  Title <span className="font-normal text-neutral-400">(optional — defaults to the same title)</span>
                </label>
                <input
                  type="text"
                  className="input text-sm"
                  placeholder={event.title}
                  maxLength={200}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="border border-neutral-200 rounded-xl p-3.5 space-y-3">
                <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">Organizer login for the new event</p>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1.5">
                    Username <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    className="input text-sm"
                    maxLength={100}
                    autoComplete="off"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1.5">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    className="input text-sm"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>

              {rows.map((row, i) => (
                <div key={i} className="border border-neutral-200 rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                      {rows.length > 1 ? `Clone ${i + 1}` : 'New event'}
                    </p>
                    {rows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setRows((rs) => rs.filter((_, idx) => idx !== i))}
                        className="text-neutral-400 hover:text-red-500 transition-colors"
                        aria-label="Remove clone"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1.5">
                      Date & time <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="datetime-local"
                      className="input text-sm"
                      value={row.date}
                      onChange={(e) => setRow(i, { date: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-neutral-600 mb-1.5">
                      Slug (link) <span className="text-red-500">*</span>
                    </label>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-neutral-400 flex-shrink-0">/e/</span>
                      <input
                        type="text"
                        className="input text-sm"
                        placeholder={`${event.subdomain || 'my-event'}-2`}
                        value={row.slug}
                        onChange={(e) => setRow(i, { slug: cleanSlug(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>
              ))}

              {rows.length < remaining && (
                <button
                  type="button"
                  onClick={() => setRows((rs) => [...rs, emptyRow()])}
                  className="flex items-center gap-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Add another clone
                </button>
              )}
            </>
          )}

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
          )}
        </div>

        {!loadingInfo && !created && info && remaining > 0 && (
          <div className="px-6 py-4 border-t border-neutral-100 flex gap-2.5 flex-shrink-0">
            <button type="button" onClick={close} disabled={busy} className="btn btn-ghost text-sm flex-1">Cancel</button>
            <button type="button" onClick={submit} disabled={busy} className="btn btn-primary text-sm flex-1 gap-1.5">
              {busy
                ? <><span className="spinner w-3.5 h-3.5 border-2 border-white/40 border-t-white" />Cloning…</>
                : `Create ${rows.length > 1 ? `${rows.length} clones` : 'clone'}`}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );

  return (
    <>
      {trigger}
      {modal}
    </>
  );
}
