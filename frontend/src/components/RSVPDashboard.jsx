import { useState, useEffect, useCallback } from 'react';
import {
  Users, Check, X, Clock, Search, Filter, Download,
  ChevronDown, Star, Trash2, UserCheck,
  RefreshCw, ThumbsUp, ThumbsDown, Edit2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { rsvpAPI } from '../services/api';

const STATUS_META = {
  confirmed:  { label: 'Confirmed',  bg: 'bg-emerald-50',  text: 'text-emerald-700',  border: 'border-emerald-200', dot: 'bg-emerald-500' },
  pending:    { label: 'Pending',    bg: 'bg-indigo-50',   text: 'text-indigo-700',   border: 'border-indigo-200',  dot: 'bg-indigo-500' },
  waitlisted: { label: 'Waitlisted', bg: 'bg-amber-50',    text: 'text-amber-700',    border: 'border-amber-200',   dot: 'bg-amber-500' },
  declined:   { label: 'Declined',   bg: 'bg-red-50',      text: 'text-red-700',      border: 'border-red-200',     dot: 'bg-red-400' },
};

const RESPONSE_META = {
  yes:   { label: 'Attending',     icon: <Check  className="w-3.5 h-3.5" />, color: 'text-emerald-600' },
  maybe: { label: 'Maybe',         icon: <Clock  className="w-3.5 h-3.5" />, color: 'text-amber-600' },
  no:    { label: 'Not Attending', icon: <X      className="w-3.5 h-3.5" />, color: 'text-red-500' },
};

/* ─── Stat strip ──────────────────────────────────────────────────────────── */
// One combined row, reusing the exact same colors as the per-guest status
// badges below (STATUS_META), so "Attending" up top is visibly the same
// color language as the "Confirmed" pill on each row — one system, not two
// disconnected components stacked on top of each other.
function StatChip({ label, value, sub, dot, text }) {
  return (
    <div className="flex-1 min-w-[110px] bg-white border border-neutral-200 rounded-xl px-3.5 py-3">
      <div className="flex items-center gap-1.5 mb-1">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
        <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide truncate">{label}</p>
      </div>
      <p className={`text-2xl font-black leading-none ${text || 'text-neutral-900'}`}>{value ?? '—'}</p>
      {sub && <p className="text-[11px] text-neutral-400 mt-1">{sub}</p>}
    </div>
  );
}

/* ─── Submission row ──────────────────────────────────────────────────────── */
function SubmissionRow({ submission: s, selected, onSelect, onUpdate, onDelete, onCheckin, eventId }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing]   = useState(false);
  const [note, setNote]         = useState(s.organizerNotes || '');
  const [tags, setTags]         = useState((s.tags || []).join(', '));

  const resp = RESPONSE_META[s.response] || RESPONSE_META.yes;

  const saveNote = async () => {
    try {
      const t = tags.split(',').map(t => t.trim()).filter(Boolean);
      await rsvpAPI.updateSubmission(eventId, s._id, { organizerNotes: note, tags: t });
      onUpdate();
      setEditing(false);
      toast.success('Saved.');
    } catch { toast.error('Failed to save.'); }
  };

  const changeStatus = async (newStatus) => {
    if (newStatus === s.status) return;
    try {
      await rsvpAPI.updateSubmission(eventId, s._id, { status: newStatus });
      onUpdate();
      toast.success(`Status updated to ${STATUS_META[newStatus]?.label || newStatus}.`);
    } catch { toast.error('Failed to update.'); }
  };

  const toggleStar = async () => {
    try {
      await rsvpAPI.updateSubmission(eventId, s._id, { starred: !s.starred });
      onUpdate();
    } catch { toast.error('Failed.'); }
  };

  return (
    <>
      <tr className={`border-t border-neutral-100 hover:bg-neutral-50 transition-colors ${selected ? 'bg-indigo-50/40' : ''}`}>
        {/* Checkbox */}
        <td className="px-4 py-3">
          <button type="button" onClick={() => onSelect(s._id)}
            className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${selected ? 'bg-indigo-600 border-indigo-600' : 'border-neutral-300 hover:border-neutral-500'}`}>
            {selected && <Check className="w-2.5 h-2.5 text-white" />}
          </button>
        </td>
        {/* Star */}
        <td className="px-2 py-3">
          <button onClick={toggleStar} className={`transition-colors ${s.starred ? 'text-amber-400' : 'text-neutral-200 hover:text-amber-300'}`}>
            <Star className="w-4 h-4 fill-current" />
          </button>
        </td>
        {/* Name + email */}
        <td className="px-3 py-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-indigo-600">{s.firstName?.[0]}{s.lastName?.[0]}</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-900">{s.firstName} {s.lastName}</p>
              {s.email && <p className="text-xs text-neutral-400">{s.email}</p>}
            </div>
          </div>
        </td>
        {/* Response */}
        <td className="px-3 py-3">
          <span className={`inline-flex items-center gap-1 text-xs font-semibold ${resp.color}`}>
            {resp.icon} {resp.label}
          </span>
          {s.plusOnes > 0 && (
            <span className="ml-1.5 text-xs text-neutral-400">+{s.plusOnes}</span>
          )}
        </td>
        {/* Status — a live segmented control, not a menu hidden behind a "⋮".
            All three actions organizers actually reach for (accept / waitlist /
            decline) sit right here, always visible; the highlighted button
            IS the current status, so there's no separate badge to reconcile
            it against. */}
        <td className="px-3 py-3">
          <div className="inline-flex rounded-lg border border-neutral-200 overflow-hidden flex-shrink-0">
            <button type="button" title="Accept" onClick={() => changeStatus('confirmed')}
              className={`p-1.5 transition-colors ${s.status === 'confirmed' ? 'bg-emerald-500 text-white' : 'text-neutral-300 hover:text-emerald-600 hover:bg-emerald-50'}`}>
              <Check className="w-3.5 h-3.5" />
            </button>
            <button type="button" title="Waitlist" onClick={() => changeStatus('waitlisted')}
              className={`p-1.5 border-l border-neutral-200 transition-colors ${s.status === 'waitlisted' ? 'bg-amber-500 text-white' : 'text-neutral-300 hover:text-amber-600 hover:bg-amber-50'}`}>
              <Clock className="w-3.5 h-3.5" />
            </button>
            <button type="button" title="Decline" onClick={() => changeStatus('declined')}
              className={`p-1.5 border-l border-neutral-200 transition-colors ${s.status === 'declined' ? 'bg-red-500 text-white' : 'text-neutral-300 hover:text-red-500 hover:bg-red-50'}`}>
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {s.status === 'pending' && <p className="text-[10px] text-indigo-500 font-semibold mt-1">Pending</p>}
        </td>
        {/* Check-in */}
        <td className="px-3 py-3">
          {s.response === 'yes' && (
            <button onClick={() => onCheckin(s._id, s.checkedIn)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${s.checkedIn ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'}`}>
              <UserCheck className="w-3.5 h-3.5" />
              {s.checkedIn ? 'Checked In' : 'Check In'}
            </button>
          )}
        </td>
        {/* Date */}
        <td className="px-3 py-3 text-xs text-neutral-400 whitespace-nowrap">
          {new Date(s.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </td>
        {/* Actions — plain, always-visible controls; nothing hidden behind a
            popup menu that a scrollable table could clip. */}
        <td className="px-3 py-3">
          <div className="flex items-center gap-1">
            <button onClick={() => setExpanded(o => !o)} title="Guest details"
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-neutral-100 transition-colors">
              <ChevronDown className={`w-4 h-4 text-neutral-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
            <button onClick={() => onDelete(s._id)} title="Delete"
              className="w-7 h-7 flex items-center justify-center rounded-lg text-neutral-300 hover:text-red-500 hover:bg-red-50 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </td>
      </tr>

      {/* Expanded row */}
      {expanded && (
        <tr className="bg-neutral-50/80">
          <td colSpan={8} className="px-4 pb-4 pt-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs mb-3">
              {s.phone && (
                <div><p className="font-semibold text-neutral-400 mb-0.5">Phone</p><p className="text-neutral-700">{s.phone}</p></div>
              )}
              {s.plusOnes > 0 && (
                <div><p className="font-semibold text-neutral-400 mb-0.5">Additional Guests</p><p className="text-neutral-700">{s.plusOnes}</p></div>
              )}
              {s.dietaryRestrictions && (
                <div className="col-span-2"><p className="font-semibold text-neutral-400 mb-0.5">Dietary</p><p className="text-neutral-700">{s.dietaryRestrictions}</p></div>
              )}
              {s.accessibilityNeeds && (
                <div className="col-span-2"><p className="font-semibold text-neutral-400 mb-0.5">Accessibility</p><p className="text-neutral-700">{s.accessibilityNeeds}</p></div>
              )}
              {s.guestNote && (
                <div className="col-span-4"><p className="font-semibold text-neutral-400 mb-0.5">Guest Note</p><p className="text-neutral-700">{s.guestNote}</p></div>
              )}
              {(s.customAnswers || []).map((a, i) => (
                <div key={i} className="col-span-2">
                  <p className="font-semibold text-neutral-400 mb-0.5">{a.question}</p>
                  <p className="text-neutral-700">{Array.isArray(a.answer) ? a.answer.join(', ') : a.answer}</p>
                </div>
              ))}
            </div>
            {/* Tags */}
            {(s.tags || []).length > 0 && !editing && (
              <div className="flex gap-1.5 mb-2 flex-wrap">
                {s.tags.map(t => (
                  <span key={t} className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium">{t}</span>
                ))}
              </div>
            )}
            {/* Organizer notes */}
            {!editing ? (
              <div className="flex items-start gap-2">
                {s.organizerNotes && (
                  <div className="flex-1 text-xs text-neutral-500 bg-white border border-neutral-200 rounded-lg px-3 py-2">
                    <span className="font-semibold text-neutral-600">Note: </span>{s.organizerNotes}
                  </div>
                )}
                <button onClick={() => setEditing(true)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 px-2.5 py-1.5 bg-indigo-50 rounded-lg transition-colors flex-shrink-0">
                  <Edit2 className="w-3.5 h-3.5" /> Notes / Tags
                </button>
              </div>
            ) : (
              <div className="space-y-2 bg-white border border-neutral-200 rounded-xl p-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 mb-1">Organizer notes</label>
                  <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                    className="w-full px-2 py-1.5 text-xs rounded-lg border border-neutral-200 focus:border-indigo-400 focus:outline-none resize-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-500 mb-1">Tags (comma-separated)</label>
                  <input value={tags} onChange={e => setTags(e.target.value)} placeholder="vip, speaker, sponsor"
                    className="w-full px-2 py-1.5 text-xs rounded-lg border border-neutral-200 focus:border-indigo-400 focus:outline-none" />
                </div>
                <div className="flex gap-2">
                  <button onClick={saveNote} className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition-colors">Save</button>
                  <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-xs text-neutral-500 rounded-lg border border-neutral-200 hover:bg-neutral-50 transition-colors">Cancel</button>
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

/* ─── Main dashboard ──────────────────────────────────────────────────────── */
export default function RSVPDashboard({ event, eventId }) {
  const [submissions, setSubmissions] = useState([]);
  const [stats, setStats]             = useState(null);
  const [loading, setLoading]         = useState(true);
  const [total, setTotal]             = useState(0);
  const [page, setPage]               = useState(1);
  const [pages, setPages]             = useState(1);
  const [selected, setSelected]       = useState(new Set());

  // Filters
  const [search, setSearch]           = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterResponse, setFilterResponse] = useState('');
  const [filterStarred, setFilterStarred]   = useState(false);
  const [sort, setSort]               = useState('-submittedAt');
  const [showFilters, setShowFilters] = useState(false);

  const LIMIT = 50;

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = { page: p, limit: LIMIT, sort };
      if (search)         params.search   = search;
      if (filterStatus)   params.status   = filterStatus;
      if (filterResponse) params.response = filterResponse;
      if (filterStarred)  params.starred  = 'true';

      const [submRes, statsRes] = await Promise.all([
        rsvpAPI.getSubmissions(eventId, params),
        rsvpAPI.getStats(eventId),
      ]);
      setSubmissions(submRes.data.submissions);
      setTotal(submRes.data.total);
      setPages(submRes.data.pages);
      setStats(statsRes.data.summary);
      setSelected(new Set());
    } catch { toast.error('Failed to load submissions.'); }
    finally { setLoading(false); }
  }, [eventId, search, filterStatus, filterResponse, filterStarred, sort]);

  useEffect(() => { if (eventId) load(1); }, [eventId, search, filterStatus, filterResponse, filterStarred, sort]);

  const onSelect = (id) => {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };
  const selectAll = () => {
    if (selected.size === submissions.length) setSelected(new Set());
    else setSelected(new Set(submissions.map(s => s._id)));
  };

  const bulkApprove = async () => {
    if (!selected.size) return;
    try {
      await rsvpAPI.bulkApprove(eventId, [...selected]);
      toast.success(`${selected.size} RSVP${selected.size > 1 ? 's' : ''} approved.`);
      load(page);
    } catch { toast.error('Failed.'); }
  };
  const bulkDecline = async () => {
    if (!selected.size) return;
    try {
      await rsvpAPI.bulkDecline(eventId, [...selected]);
      toast.success(`${selected.size} RSVP${selected.size > 1 ? 's' : ''} declined.`);
      load(page);
    } catch { toast.error('Failed.'); }
  };

  const onDelete = async (id) => {
    if (!confirm('Delete this RSVP? This cannot be undone.')) return;
    try {
      await rsvpAPI.deleteSubmission(eventId, id);
      toast.success('Deleted.');
      load(page);
    } catch { toast.error('Failed to delete.'); }
  };

  const onCheckin = async (id, isCheckedIn) => {
    try {
      if (isCheckedIn) await rsvpAPI.undoCheckin(eventId, id);
      else             await rsvpAPI.checkinSubmission(eventId, id);
      load(page);
    } catch { toast.error('Failed.'); }
  };

  const exportCsv = () => {
    const url = rsvpAPI.exportCsv(eventId);
    const a = document.createElement('a');
    a.href = url;
    const token = localStorage.getItem('eventToken');
    // Pass token via query param for the download link
    a.href = `${url}?token=${token}`;
    a.download = 'rsvps.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const rsvpPageUrl = event?.subdomain ? `${window.location.origin}/rsvp/${event.subdomain}` : '';

  return (
    <div className="space-y-5">

      {/* Stats — one combined strip, always visible at the top, no second layer below it */}
      <div className="flex flex-wrap gap-3">
        <StatChip label="Attending" value={stats?.totalYes} sub={`${stats?.totalAttendees || 0} incl. plus-ones`} dot="bg-emerald-500" text="text-emerald-600" />
        <StatChip label="Maybe" value={stats?.totalMaybe} dot="bg-amber-500" text="text-amber-600" />
        <StatChip label="Pending" value={stats?.pending} dot="bg-indigo-500" text="text-indigo-600" />
        <StatChip label="Waitlisted" value={stats?.waitlisted} dot="bg-amber-400" text="text-amber-500" />
        <StatChip label="Declined" value={stats?.totalNo} dot="bg-red-400" text="text-red-500" />
        <StatChip label="Checked In" value={stats?.checkedIn} sub={`of ${stats?.totalYes || 0} attending`} dot="bg-neutral-700" text="text-neutral-900" />
        <StatChip label="Starred" value={stats?.starred} dot="bg-amber-300" text="text-amber-500" />
      </div>

      {/* RSVP link */}
      {rsvpPageUrl && (
        <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3">
          <p className="text-xs text-indigo-600 flex-1">
            <span className="font-semibold">Public RSVP link: </span>
            <span className="text-indigo-500">{rsvpPageUrl}</span>
          </p>
          <button onClick={() => { navigator.clipboard.writeText(rsvpPageUrl); toast.success('Copied!'); }}
            className="text-xs font-semibold text-indigo-700 hover:text-indigo-800 bg-indigo-100 px-2.5 py-1 rounded-lg transition-colors flex-shrink-0">
            Copy
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email…"
            className="w-full pl-9 pr-4 py-2 rounded-xl text-sm border border-neutral-200 focus:border-indigo-400 focus:outline-none" />
        </div>
        {/* Filter toggle */}
        <button onClick={() => setShowFilters(o => !o)}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm border transition-all ${showFilters ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-neutral-200 text-neutral-600 hover:border-neutral-300'}`}>
          <Filter className="w-4 h-4" /> Filters
          {(filterStatus || filterResponse || filterStarred) && (
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
          )}
        </button>
        {/* Export */}
        <button onClick={exportCsv}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm border border-neutral-200 text-neutral-600 hover:border-neutral-300 transition-all">
          <Download className="w-4 h-4" /> Export CSV
        </button>
        {/* Refresh */}
        <button onClick={() => load(page)} className="w-9 h-9 flex items-center justify-center rounded-xl border border-neutral-200 hover:bg-neutral-50 transition-colors">
          <RefreshCw className={`w-4 h-4 text-neutral-500 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-neutral-50 border border-neutral-200 rounded-xl">
          <div>
            <label className="block text-xs font-semibold text-neutral-500 mb-1 uppercase tracking-wide">Status</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              className="w-full px-2 py-1.5 text-sm rounded-lg border border-neutral-200 focus:border-indigo-400 focus:outline-none">
              <option value="">All statuses</option>
              {Object.entries(STATUS_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-500 mb-1 uppercase tracking-wide">Response</label>
            <select value={filterResponse} onChange={e => setFilterResponse(e.target.value)}
              className="w-full px-2 py-1.5 text-sm rounded-lg border border-neutral-200 focus:border-indigo-400 focus:outline-none">
              <option value="">All responses</option>
              <option value="yes">Attending</option>
              <option value="maybe">Maybe</option>
              <option value="no">Not Attending</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-500 mb-1 uppercase tracking-wide">Sort</label>
            <select value={sort} onChange={e => setSort(e.target.value)}
              className="w-full px-2 py-1.5 text-sm rounded-lg border border-neutral-200 focus:border-indigo-400 focus:outline-none">
              <option value="-submittedAt">Newest first</option>
              <option value="submittedAt">Oldest first</option>
              <option value="firstName">Name A–Z</option>
              <option value="-firstName">Name Z–A</option>
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={filterStarred} onChange={e => setFilterStarred(e.target.checked)} className="rounded w-4 h-4" />
              <span className="text-sm text-neutral-600">Starred only</span>
            </label>
          </div>
        </div>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-indigo-600 text-white rounded-xl">
          <span className="text-sm font-semibold flex-1">{selected.size} selected</span>
          <button onClick={bulkApprove}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-semibold transition-colors">
            <ThumbsUp className="w-3.5 h-3.5" /> Approve
          </button>
          <button onClick={bulkDecline}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs font-semibold transition-colors">
            <ThumbsDown className="w-3.5 h-3.5" /> Decline
          </button>
          <button onClick={() => setSelected(new Set())} className="w-6 h-6 flex items-center justify-center hover:bg-white/20 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Table */}
      <div className="border border-neutral-200 rounded-xl overflow-hidden bg-white">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="w-5 h-5 text-neutral-400 animate-spin" />
          </div>
        ) : submissions.length === 0 ? (
          <div className="text-center py-16 space-y-2">
            <Users className="w-8 h-8 mx-auto text-neutral-200" />
            <p className="text-sm text-neutral-400 font-medium">No RSVPs yet</p>
            {rsvpPageUrl && (
              <p className="text-xs text-neutral-400">Share your RSVP link to start collecting responses.</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead className="bg-neutral-50 border-b border-neutral-100">
                <tr>
                  <th className="px-4 py-2.5">
                    <button type="button" onClick={selectAll}
                      className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${selected.size === submissions.length && submissions.length > 0 ? 'bg-indigo-600 border-indigo-600' : 'border-neutral-300'}`}>
                      {selected.size === submissions.length && submissions.length > 0 && <Check className="w-2.5 h-2.5 text-white" />}
                    </button>
                  </th>
                  <th className="px-2 py-2.5 w-6"></th>
                  <th className="px-3 py-2.5 text-left text-xs font-bold text-neutral-400 uppercase tracking-wide">Guest</th>
                  <th className="px-3 py-2.5 text-left text-xs font-bold text-neutral-400 uppercase tracking-wide">Response</th>
                  <th className="px-3 py-2.5 text-left text-xs font-bold text-neutral-400 uppercase tracking-wide">Status</th>
                  <th className="px-3 py-2.5 text-left text-xs font-bold text-neutral-400 uppercase tracking-wide">Check-in</th>
                  <th className="px-3 py-2.5 text-left text-xs font-bold text-neutral-400 uppercase tracking-wide">Date</th>
                  <th className="px-3 py-2.5 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {submissions.map(s => (
                  <SubmissionRow
                    key={s._id}
                    submission={s}
                    selected={selected.has(s._id)}
                    onSelect={onSelect}
                    onUpdate={() => load(page)}
                    onDelete={onDelete}
                    onCheckin={onCheckin}
                    eventId={eventId}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-neutral-400">{total} total submissions</p>
          <div className="flex gap-1">
            <button disabled={page <= 1} onClick={() => { setPage(p => p - 1); load(page - 1); }}
              className="px-3 py-1.5 text-xs rounded-lg border border-neutral-200 hover:bg-neutral-50 disabled:opacity-40 transition-all">
              Previous
            </button>
            <span className="px-3 py-1.5 text-xs text-neutral-500">
              {page} / {pages}
            </span>
            <button disabled={page >= pages} onClick={() => { setPage(p => p + 1); load(page + 1); }}
              className="px-3 py-1.5 text-xs rounded-lg border border-neutral-200 hover:bg-neutral-50 disabled:opacity-40 transition-all">
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
