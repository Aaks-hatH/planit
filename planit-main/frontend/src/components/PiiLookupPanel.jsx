import { useState, useMemo } from 'react';
import { DateTime } from 'luxon';
import {
  Search, Fingerprint, Download, ChevronDown, ChevronUp, Clock, MousePointer,
  Eye, LogIn, LogOut, AlertTriangle, ExternalLink, ArrowDownToLine, Activity,
  Smartphone, Monitor, Tablet, Globe, ShieldAlert, Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { platformAnalyticsAPI } from '../services/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const DEVICE_ICON = { desktop: Monitor, mobile: Smartphone, tablet: Tablet, unknown: Globe };

const EVENT_META = {
  session_start:  { label: 'Session started',  icon: LogIn,         color: 'text-emerald-600' },
  session_end:    { label: 'Session ended',    icon: LogOut,        color: 'text-neutral-500' },
  page_view:      { label: 'Opened page',      icon: Eye,           color: 'text-indigo-600' },
  page_exit:      { label: 'Left page',        icon: ArrowDownToLine, color: 'text-neutral-500' },
  click:          { label: 'Clicked',          icon: MousePointer,  color: 'text-amber-600' },
  scroll_depth:   { label: 'Scrolled',         icon: ArrowDownToLine, color: 'text-neutral-500' },
  feature_use:    { label: 'Used feature',     icon: Activity,      color: 'text-violet-600' },
  outbound_link:  { label: 'Outbound link',    icon: ExternalLink,  color: 'text-cyan-600' },
  search:         { label: 'Searched',         icon: Search,        color: 'text-blue-600' },
  error:          { label: 'JS error',         icon: AlertTriangle, color: 'text-red-600' },
};

const fmtMs = (ms) => {
  if (!ms || ms <= 0) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60), r = s % 60;
  if (m < 60) return r ? `${m}m ${r}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
};

// One-line human summary of an event's decrypted payload.
function describe(ev) {
  const d = ev.detail;
  if (d == null) return '';
  if (typeof d === 'string') return d;
  if (d.truncated) return d.preview;
  switch (ev.eventType) {
    case 'click':         return [d.tag, d.text && `"${d.text}"`].filter(Boolean).join(' ');
    case 'scroll_depth':  return d.depth != null ? `${d.depth}%` : (d.pct != null ? `${d.pct}%` : JSON.stringify(d));
    case 'outbound_link': return d.href || '';
    case 'page_view':     return d.path && d.path !== ev.page ? d.path : '';
    case 'feature_use':   return d.feature || d.name || d.action || JSON.stringify(d);
    case 'error':         return d.message || d.msg || JSON.stringify(d);
    default:              return JSON.stringify(d);
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function PiiLookupPanel() {
  const [query, setQuery]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState(null);
  const [error, setError]       = useState(null);
  const [openSessions, setOpen] = useState({});
  const [tzMode, setTzMode]     = useState('local'); // 'local' | 'utc'
  const [hideNoise, setHideNoise] = useState(true);  // hide scroll/exit rows

  const fmtTs = (iso, withDate = true) => {
    if (!iso) return '—';
    let dt = DateTime.fromISO(iso, { zone: 'utc' });
    if (tzMode === 'local') dt = dt.toLocal();
    if (!dt.isValid) return '—';
    return dt.toFormat(withDate ? 'MMM dd, yyyy HH:mm:ss ZZZZ' : 'HH:mm:ss');
  };

  const runLookup = async (e) => {
    e?.preventDefault();
    const q = query.trim();
    if (q.length < 3) { setError('Enter at least 3 characters.'); return; }
    setLoading(true); setError(null); setResult(null); setOpen({});
    try {
      const res = await platformAnalyticsAPI.piiLookup(q);
      setResult(res.data);
      // Auto-open the matched session (or the only session) so the answer is visible immediately.
      const sessions = res.data.sessions || [];
      const auto = sessions.find(s => s.matched) || (sessions.length === 1 ? sessions[0] : null);
      if (auto) setOpen({ [auto.key]: true });
    } catch (err) {
      const status = err?.response?.status;
      setError(
        status === 403 ? (err.response.data?.error || 'You need the canExportData permission to use this tool.')
        : status === 400 ? (err.response.data?.error || 'Invalid search.')
        : status === 503 ? 'The analytics database is unavailable right now.'
        : 'Lookup failed. Please try again.'
      );
    } finally { setLoading(false); }
  };

  const totals = useMemo(() => {
    if (!result) return null;
    const sessions = result.sessions || [];
    const starts = sessions.map(s => new Date(s.start).getTime());
    const ends   = sessions.map(s => new Date(s.end).getTime());
    return {
      sessions: sessions.length,
      events: result.totalEvents || 0,
      first: starts.length ? new Date(Math.min(...starts)).toISOString() : null,
      last:  ends.length   ? new Date(Math.max(...ends)).toISOString()   : null,
    };
  }, [result]);

  const download = (blob, name) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  const exportJSON = async () => {
    if (!result) return;
    download(new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' }), `data-request-${Date.now()}.json`);
    platformAnalyticsAPI.logPiiExport(result.query, 'json').catch(() => {});
    toast.success('Data request package downloaded');
  };

  const exportCSV = async () => {
    if (!result) return;
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['timestamp_utc', 'session_id', 'visitor_id', 'event', 'page', 'time_on_page_ms', 'detail', 'linked_event'];
    const rows = [];
    for (const s of result.sessions || []) {
      for (const ev of s.events) {
        rows.push([ev.ts, s.sessionId, s.visitorId, ev.eventType, ev.page, ev.timeOnPageMs ?? '', describe(ev), ev.linkedEvent?.title || ev.linkedEvent?.id || '']);
      }
    }
    rows.sort((a, b) => (a[0] > b[0] ? 1 : a[0] < b[0] ? -1 : 0)); // ISO timestamps sort chronologically
    const csv = [header, ...rows].map(r => r.map(esc).join(',')).join('\n');
    download(new Blob([csv], { type: 'text/csv' }), `data-request-${Date.now()}.csv`);
    platformAnalyticsAPI.logPiiExport(result.query, 'csv').catch(() => {});
    toast.success('Activity CSV downloaded');
  };

  const matchedByLabel = {
    session_id: 'Session ID', visitor_id: 'Visitor ID',
    email: 'Email address', phone: 'Phone number', name: 'Name',
  };

  return (
    <div className="space-y-5">
      {/* Header + search */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-1">
          <Fingerprint className="w-5 h-5 text-rose-500" />
          <h2 className="text-lg font-bold text-neutral-900">Data Request Lookup</h2>
        </div>
        <p className="text-sm text-neutral-500 mb-4">
          When someone requests their data, paste the <strong>session ID</strong> or <strong>visitor ID</strong> they give you
          (or their <strong>email / phone / name</strong> if they RSVP'd) to see exactly when they opened the site and what they did.
          Every lookup and export is recorded in the audit log.
        </p>
        <form onSubmit={runLookup} className="flex gap-2 flex-wrap">
          <input
            className="input text-sm flex-1 min-w-[240px] font-mono"
            placeholder="s_lx3k2j_a8f2k1md  ·  v_…  ·  name@email.com  ·  +1 555 123 4567"
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
          <button type="submit" disabled={loading} className="btn btn-primary text-sm gap-1.5">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Look up
          </button>
        </form>
        {error && (
          <div className="mt-3 text-xs bg-red-50 text-red-700 border border-red-200 rounded-lg px-3 py-2">{error}</div>
        )}
        <p className="text-[11px] text-neutral-400 mt-3">
          Activity is retained for a limited time (90 days by default) and then deleted automatically, so older requests may return nothing.
          Email / phone / name only match visitors who submitted an RSVP or were checked in; anonymous visitors can only be found by ID.
        </p>
      </div>

      {/* No match */}
      {result && result.visitors.length === 0 && (
        <div className="card p-8 text-center">
          <ShieldAlert className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-neutral-700">No matching activity found</p>
          <p className="text-xs text-neutral-400 mt-1">
            Nothing recorded for “{result.query}”. It may have expired, been mistyped, or belong to a visitor who never submitted contact details.
            {result.piiTruncated && ' (Only the most recent records were searched for contact details.)'}
          </p>
        </div>
      )}

      {/* Results */}
      {result && result.visitors.length > 0 && (
        <>
          {/* Summary bar */}
          <div className="card p-4 flex flex-wrap items-center gap-x-6 gap-y-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-neutral-400 font-bold">Matched by</p>
              <p className="text-sm font-semibold text-neutral-800">{matchedByLabel[result.matchedBy] || '—'}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-neutral-400 font-bold">First seen</p>
              <p className="text-sm font-semibold text-neutral-800">{fmtTs(totals.first)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-neutral-400 font-bold">Last seen</p>
              <p className="text-sm font-semibold text-neutral-800">{fmtTs(totals.last)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-neutral-400 font-bold">Visits / events</p>
              <p className="text-sm font-semibold text-neutral-800">{totals.sessions} / {totals.events}</p>
            </div>
            <div className="ml-auto flex items-center gap-2 flex-wrap">
              <div className="flex rounded-lg border border-neutral-200 overflow-hidden text-xs">
                {['local', 'utc'].map(m => (
                  <button key={m} onClick={() => setTzMode(m)}
                    className={`px-3 py-1.5 font-semibold ${tzMode === m ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-600 hover:bg-neutral-50'}`}>
                    {m === 'local' ? 'My time' : 'UTC'}
                  </button>
                ))}
              </div>
              <button onClick={exportJSON} className="btn btn-secondary text-xs gap-1"><Download className="w-3 h-3" /> JSON</button>
              <button onClick={exportCSV} className="btn btn-secondary text-xs gap-1"><Download className="w-3 h-3" /> CSV</button>
            </div>
          </div>

          {(result.truncated || result.piiTruncated) && (
            <div className="text-xs bg-amber-50 text-amber-800 border border-amber-200 rounded-lg px-3 py-2 flex gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>
                {result.truncated && 'This visitor has more activity than can be shown at once — only the earliest events are included. '}
                {result.piiTruncated && 'Contact-detail search covered only the most recent records.'}
              </span>
            </div>
          )}

          {/* Visitors */}
          {result.visitors.length > 1 && (
            <p className="text-xs text-neutral-500">
              {result.visitors.length} visitor IDs matched this search (e.g. the same person on different browsers/devices).
            </p>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            {result.visitors.map(v => (
              <div key={v.visitorId} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-900 truncate">{v.pii?.name || v.pii?.email || 'Anonymous visitor'}</p>
                    <p className="text-[11px] font-mono text-neutral-400 truncate">{v.visitorId}</p>
                  </div>
                  {v.isSuspected && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">FLAGGED</span>}
                </div>
                {v.pii && (
                  <div className="mt-2 text-xs text-neutral-600 space-y-0.5">
                    {v.pii.email && <p>Email: {v.pii.email}</p>}
                    {v.pii.name  && <p>Name: {v.pii.name}</p>}
                    {v.pii.phone && <p>Phone: {v.pii.phone}</p>}
                  </div>
                )}
                <div className="mt-2 text-xs text-neutral-500 flex flex-wrap gap-x-4 gap-y-1">
                  <span>{v.sessionCount} session{v.sessionCount === 1 ? '' : 's'}</span>
                  <span>{v.eventCount} events</span>
                  {v.devices.length > 0   && <span>{v.devices.join(', ')}</span>}
                  {v.browsers.length > 0  && <span>{v.browsers.join(', ')}</span>}
                  {v.countries.length > 0 && <span>{v.countries.join(', ')}</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Sessions */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-neutral-800">Visits (newest first) <span className="font-normal text-neutral-400 text-xs">— a new visit starts after 30 minutes of inactivity</span></h3>
            <label className="text-xs text-neutral-500 flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={hideNoise} onChange={e => setHideNoise(e.target.checked)} />
              Hide scroll / page-exit rows
            </label>
          </div>
          <div className="space-y-2">
            {result.sessions.map(s => {
              const open = !!openSessions[s.key];
              const DevIcon = DEVICE_ICON[s.deviceType] || Globe;
              const events = hideNoise ? s.events.filter(e => e.eventType !== 'scroll_depth' && e.eventType !== 'page_exit') : s.events;
              const pages = [...new Set(s.events.filter(e => e.eventType === 'page_view').map(e => e.page))];
              return (
                <div key={s.key} className={`card overflow-hidden ${s.matched ? 'ring-2 ring-rose-300' : ''}`}>
                  <button className="w-full text-left p-4 flex items-center gap-3 hover:bg-neutral-50"
                    onClick={() => setOpen(o => ({ ...o, [s.key]: !o[s.key] }))}>
                    <DevIcon className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-neutral-800">
                        {fmtTs(s.start)}
                        {s.matched && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-600 border border-rose-200 align-middle">MATCHED SESSION ID</span>}
                      </p>
                      <p className="text-xs text-neutral-500 truncate">
                        <Clock className="w-3 h-3 inline -mt-0.5 mr-1" />{fmtMs(s.durationMs)} · {s.pageViews} page view{s.pageViews === 1 ? '' : 's'} · {s.events.length} events
                        {s.browser ? ` · ${s.browser}` : ''}{s.ipCountry ? ` · ${s.ipCountry}${s.ipCity ? ' / ' + s.ipCity : ''}` : ''}
                      </p>
                      <p className="text-[11px] font-mono text-neutral-400 truncate">{s.sessionId}{s.visitsInSession > 1 ? `  ·  visit ${s.visit} of ${s.visitsInSession}` : ''}</p>
                    </div>
                    {open ? <ChevronUp className="w-4 h-4 text-neutral-400" /> : <ChevronDown className="w-4 h-4 text-neutral-400" />}
                  </button>

                  {open && (
                    <div className="border-t border-neutral-100 bg-neutral-50/50 px-4 py-3">
                      <div className="text-xs text-neutral-500 mb-3 space-y-0.5">
                        <p>Ended: {fmtTs(s.end)}</p>
                        {s.referrer && <p>Came from: <span className="font-mono">{s.referrer}</span></p>}
                        {(s.utmSource || s.utmMedium || s.utmCampaign) && (
                          <p>Campaign: {[s.utmSource, s.utmMedium, s.utmCampaign].filter(Boolean).join(' / ')}</p>
                        )}
                        {pages.length > 0 && <p>Pages visited: <span className="font-mono">{pages.join('  →  ')}</span></p>}
                      </div>
                      <ol className="relative border-l border-neutral-200 ml-1.5 space-y-2">
                        {events.map((ev, i) => {
                          const meta = EVENT_META[ev.eventType] || { label: ev.eventType, icon: Activity, color: 'text-neutral-500' };
                          const Icon = meta.icon;
                          const desc = describe(ev);
                          return (
                            <li key={i} className="ml-4">
                              <span className="absolute -left-[7px] mt-1 w-3.5 h-3.5 rounded-full bg-white border border-neutral-200 flex items-center justify-center">
                                <Icon className={`w-2 h-2 ${meta.color}`} />
                              </span>
                              <div className="flex flex-wrap items-baseline gap-x-2 text-xs">
                                <span className="font-mono text-neutral-400">{fmtTs(ev.ts, false)}</span>
                                <span className={`font-semibold ${meta.color}`}>{meta.label}</span>
                                <span className="font-mono text-neutral-700">{ev.page}</span>
                                {ev.timeOnPageMs ? <span className="text-neutral-400">({fmtMs(ev.timeOnPageMs)} on page)</span> : null}
                                {ev.linkedEvent && (
                                  <span className="text-indigo-600">· event: {ev.linkedEvent.title || ev.linkedEvent.subdomain || ev.linkedEvent.id}</span>
                                )}
                                {ev.rsvpStatus && <span className="text-emerald-600">· RSVP {ev.rsvpStatus}</span>}
                                {ev.checkedIn && <span className="text-emerald-600">· checked in</span>}
                              </div>
                              {desc && <p className="text-[11px] text-neutral-500 break-all mt-0.5">{desc}</p>}
                            </li>
                          );
                        })}
                      </ol>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
