import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Users, Mail, Trash2, Copy, Check,
  Clock, RefreshCw, UserX, Download, ClipboardList
} from 'lucide-react';
import { eventAPI } from '../services/api';
import { formatRelativeTime } from '../utils/formatters';
import toast from 'react-hot-toast';

export default function Waitlist() {
  const { eventId } = useParams();
  const navigate = useNavigate();

  const [waitlist, setWaitlist] = useState([]);
  const [eventTitle, setEventTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [removing, setRemoving] = useState(null);
  const [copiedEmails, setCopiedEmails] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);
    try {
      const [wlRes, evRes] = await Promise.all([
        eventAPI.getWaitlist(eventId),
        eventAPI.getEvent(eventId).catch(() => null),
      ]);
      setWaitlist(wlRes.data.waitlist || []);
      if (evRes?.data?.title) setEventTitle(evRes.data.title);
    } catch (err) {
      if (err.response?.status === 401 || err.response?.status === 403) {
        setUnauthorized(true);
      } else {
        toast.error('Failed to load waitlist');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [eventId]);

  useEffect(() => {
    // Verify organizer token exists
    const token = localStorage.getItem('eventToken');
    if (!token) { setUnauthorized(true); setLoading(false); return; }
    load();
  }, [load]);

  const handleRemove = async (username) => {
    setRemoving(username);
    try {
      await eventAPI.leaveWaitlist(eventId, username);
      setWaitlist(prev => prev.filter(w => w.username !== username));
      toast.success(`Removed ${username} from waitlist`);
    } catch {
      toast.error('Failed to remove from waitlist');
    } finally {
      setRemoving(null);
    }
  };

  const copyEmails = () => {
    const emails = waitlist.filter(w => w.email).map(w => w.email).join(', ');
    if (!emails) { toast.error('No email addresses on the waitlist'); return; }
    navigator.clipboard.writeText(emails);
    setCopiedEmails(true);
    toast.success('Email addresses copied to clipboard');
    setTimeout(() => setCopiedEmails(false), 2000);
  };

  const exportCSV = () => {
    const rows = [
      ['Position', 'Name', 'Email', 'Joined At'],
      ...waitlist.map((w, i) => [
        i + 1,
        w.username,
        w.email || '',
        new Date(w.joinedAt).toLocaleString(),
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `waitlist-${eventId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Unauthorized ─────────────────────────────────────────────────────────────
  if (unauthorized) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserX className="w-6 h-6 text-red-500" />
          </div>
          <h2 className="text-base font-semibold text-neutral-900 mb-1">Organizer access required</h2>
          <p className="text-sm text-neutral-500 mb-5">
            You need to be logged in as the event organizer to view the waitlist.
          </p>
          <button
            onClick={() => navigate(`/event/${eventId}/login`)}
            className="btn btn-primary px-5 py-2.5 text-sm"
          >
            Log in as Organizer
          </button>
        </div>
      </div>
    );
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <span className="spinner w-5 h-5 border-2 border-neutral-200 border-t-neutral-500" />
      </div>
    );
  }

  // ── Main ─────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="bg-white border-b border-neutral-100 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-5 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate(`/event/${eventId}`)}
              className="btn btn-ghost p-1.5 -ml-1.5 flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-neutral-900 truncate">
                Waitlist
              </h1>
              {eventTitle && (
                <p className="text-xs text-neutral-400 truncate">{eventTitle}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="btn btn-ghost p-2 text-neutral-500"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            {waitlist.length > 0 && (
              <>
                <button
                  onClick={copyEmails}
                  className="btn btn-secondary px-3 py-1.5 text-xs gap-1.5"
                  title="Copy all emails"
                >
                  {copiedEmails ? <Check className="w-3.5 h-3.5" /> : <Mail className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{copiedEmails ? 'Copied' : 'Copy Emails'}</span>
                </button>
                <button
                  onClick={exportCSV}
                  className="btn btn-secondary px-3 py-1.5 text-xs gap-1.5"
                  title="Export as CSV"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Export CSV</span>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="max-w-3xl mx-auto px-5 py-8">
        {/* Stats bar */}
        <div className="flex items-center gap-4 mb-6">
          <div className="flex items-center gap-2 px-4 py-3 bg-white border border-neutral-200 rounded-xl">
            <Users className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-semibold text-neutral-900">{waitlist.length}</span>
            <span className="text-sm text-neutral-400">waiting</span>
          </div>
          <div className="flex items-center gap-2 px-4 py-3 bg-white border border-neutral-200 rounded-xl">
            <Mail className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-semibold text-neutral-900">
              {waitlist.filter(w => w.email).length}
            </span>
            <span className="text-sm text-neutral-400">with email</span>
          </div>
        </div>

        {/* Empty state */}
        {waitlist.length === 0 ? (
          <div className="bg-white border border-neutral-200 rounded-2xl p-12 text-center">
            <div className="w-12 h-12 bg-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <ClipboardList className="w-6 h-6 text-neutral-400" />
            </div>
            <h3 className="text-sm font-semibold text-neutral-900 mb-1">No one on the waitlist</h3>
            <p className="text-sm text-neutral-400">
              When your event is full, guests can join the waitlist and they'll appear here.
            </p>
          </div>
        ) : (
          <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-[2rem_1fr_1fr_auto] gap-4 px-5 py-3 bg-neutral-50 border-b border-neutral-100">
              <span className="text-xs font-semibold text-neutral-400">#</span>
              <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">Name</span>
              <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">Email</span>
              <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wide">Joined</span>
            </div>

            {/* Rows */}
            <div className="divide-y divide-neutral-100">
              {waitlist.map((entry, idx) => (
                <div
                  key={entry._id || entry.username}
                  className="grid grid-cols-[2rem_1fr_1fr_auto] gap-4 px-5 py-3.5 items-center hover:bg-neutral-50 transition-colors group"
                >
                  {/* Position */}
                  <span className="text-xs font-semibold text-neutral-400 tabular-nums">
                    {idx + 1}
                  </span>

                  {/* Name */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-semibold flex-shrink-0">
                      {entry.username?.charAt(0).toUpperCase() || '?'}
                    </div>
                    <span className="text-sm font-medium text-neutral-900 truncate">
                      {entry.username}
                    </span>
                  </div>

                  {/* Email */}
                  <div className="min-w-0">
                    {entry.email ? (
                      <a
                        href={`mailto:${entry.email}`}
                        className="text-sm text-blue-600 hover:text-blue-700 truncate block"
                      >
                        {entry.email}
                      </a>
                    ) : (
                      <span className="text-sm text-neutral-300">—</span>
                    )}
                  </div>

                  {/* Joined + remove */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="flex items-center gap-1 text-xs text-neutral-400">
                      <Clock className="w-3 h-3" />
                      <span>{formatRelativeTime(entry.joinedAt)}</span>
                    </div>
                    <button
                      onClick={() => handleRemove(entry.username)}
                      disabled={removing === entry.username}
                      className="btn btn-ghost p-1.5 text-neutral-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                      title={`Remove ${entry.username}`}
                    >
                      {removing === entry.username
                        ? <span className="spinner w-3.5 h-3.5 border-2 border-neutral-300 border-t-red-500" />
                        : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer note */}
            <div className="px-5 py-3 bg-neutral-50 border-t border-neutral-100">
              <p className="text-xs text-neutral-400">
                Removing a person from the waitlist is permanent. Use "Copy Emails" to reach out before freeing up spots.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
