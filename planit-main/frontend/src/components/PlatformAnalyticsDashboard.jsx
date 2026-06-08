import { useState, useEffect, useCallback } from 'react';
import {
  BarChart3, TrendingUp, Users, Eye, Clock, MousePointer,
  Globe, Smartphone, Monitor, Tablet, RefreshCw, AlertTriangle,
  Activity, Zap, Hash, Target, Radio, Filter,
  ExternalLink, Shield, Ban, Flag, ChevronDown, ChevronUp,
  ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react';
import { platformAnalyticsAPI } from '../services/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtMs = (ms) => {
  if (!ms || ms <= 0) return '—';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60), rem = s % 60;
  return rem ? `${m}m ${rem}s` : `${m}m`;
};
const fmtNum = (n) => {
  if (n === null || n === undefined) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const PAGE_LABELS = {
  '/': 'Home', '/about': 'About', '/discover': 'Discover',
  '/admin': 'Admin', '/dashboard': 'Client Portal', '/status': 'Status',
  '/support': 'Support', '/help': 'Help', '/blog': 'Blog',
  '/white-label': 'White Label', '/terms': 'Terms', '/privacy': 'Privacy',
};
const labelPage = (p) => PAGE_LABELS[p] || (p?.length > 40 ? p.slice(0, 40) + '…' : (p || '—'));
const GROUP_COLORS = {
  home: '#6366f1', event: '#10b981', admin: '#f59e0b', dashboard: '#3b82f6',
  blog: '#8b5cf6', discover: '#06b6d4', invite: '#ec4899', reservation: '#f97316',
  'legal/info': '#64748b', support: '#14b8a6', util: '#94a3b8', other: '#cbd5e1',
};
const DEVICE_ICONS = { desktop: Monitor, mobile: Smartphone, tablet: Tablet, unknown: Globe };

const spamColor = (s) => s >= 70 ? '#ef4444' : s >= 40 ? '#f97316' : s >= 20 ? '#eab308' : '#22c55e';
const spamLabel = (s) => s >= 70 ? 'High Risk' : s >= 40 ? 'Medium' : s >= 20 ? 'Low' : 'Clean';

// ─── Sub-components ───────────────────────────────────────────────────────────
function Sparkline({ data, color = '#6366f1', height = 40, width = 120 }) {
  if (!data || data.length < 2) return <div style={{ width, height }} />;
  const vals = data.map(d => d.views ?? d.count ?? 0);
  const max  = Math.max(...vals, 1);
  const step = width / (vals.length - 1);
  const pts  = vals.map((v, i) => `${i * step},${height - (v / max) * (height - 4) - 2}`).join(' ');
  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function HBar({ items, valueKey = 'count', labelKey = '_id', color = '#6366f1', maxItems = 10 }) {
  const rows = items.slice(0, maxItems);
  const max  = Math.max(...rows.map(r => r[valueKey] ?? 0), 1);
  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span className="w-32 truncate text-neutral-600 text-xs shrink-0" title={r[labelKey]}>
            {labelPage(r[labelKey] ?? '—')}
          </span>
          <div className="flex-1 bg-neutral-100 rounded-full h-2 overflow-hidden">
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct(r[valueKey] ?? 0, max)}%`, background: color }} />
          </div>
          <span className="text-xs font-mono text-neutral-500 w-10 text-right shrink-0">
            {fmtNum(r[valueKey])}
          </span>
        </div>
      ))}
      {items.length === 0 && <p className="text-xs text-neutral-400 text-center py-4">No data yet</p>}
    </div>
  );
}

function DailyChart({ data }) {
  if (!data || data.length === 0) return <p className="text-xs text-neutral-400 text-center py-8">No data</p>;
  const max = Math.max(...data.map(d => d.views), 1);
  return (
    <div className="flex items-end gap-1 h-32 w-full">
      {data.map((d, i) => {
        const h   = Math.max(2, pct(d.views, max));
        const lbl = new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-neutral-800 text-white text-[10px] rounded px-1.5 py-0.5 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              {lbl}: {fmtNum(d.views)} views
            </div>
            <div className="w-full rounded-t transition-all duration-300"
              style={{ height: `${h}%`, background: '#6366f1', opacity: 0.7 + 0.3 * (h / 100) }} />
          </div>
        );
      })}
    </div>
  );
}

function HourlyChart({ data }) {
  const byHour = Array.from({ length: 24 }, (_, h) => ({ hour: h, views: data?.find(d => d.hour === h)?.views ?? 0 }));
  const max = Math.max(...byHour.map(d => d.views), 1);
  return (
    <div className="flex items-end gap-0.5 h-16">
      {byHour.map((d) => (
        <div key={d.hour} className="flex-1 flex flex-col items-center group relative">
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-neutral-800 text-white text-[10px] rounded px-1.5 py-0.5 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
            {d.hour}:00 — {d.views} views
          </div>
          <div className="w-full rounded-sm"
            style={{ height: `${Math.max(4, pct(d.views, max))}%`, background: `rgba(99,102,241,${0.15 + 0.85 * (d.views / max)})` }} />
          {d.hour % 6 === 0 && <span className="text-[9px] text-neutral-400 mt-0.5">{d.hour}h</span>}
        </div>
      ))}
    </div>
  );
}

function StatCard({ label, value, sub, trend, icon: Icon, accent = '#6366f1', sparkData }) {
  const TrendIcon  = trend > 0 ? ArrowUpRight : trend < 0 ? ArrowDownRight : Minus;
  const trendColor = trend > 0 ? 'text-emerald-600' : trend < 0 ? 'text-red-500' : 'text-neutral-400';
  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: accent + '18' }}>
            <Icon className="w-4 h-4" style={{ color: accent }} />
          </div>
          <span className="text-xs font-medium text-neutral-500 uppercase tracking-wide">{label}</span>
        </div>
        {trend !== null && trend !== undefined && (
          <span className={`flex items-center gap-0.5 text-xs font-semibold ${trendColor}`}>
            <TrendIcon className="w-3 h-3" />{Math.abs(trend)}%
          </span>
        )}
      </div>
      <div className="flex items-end justify-between">
        <div>
          <div className="text-2xl font-bold text-neutral-900 tabular-nums">{value}</div>
          {sub && <div className="text-xs text-neutral-400 mt-0.5">{sub}</div>}
        </div>
        {sparkData && <Sparkline data={sparkData} color={accent} />}
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, children, action }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-neutral-400" />}
          <h3 className="text-sm font-semibold text-neutral-800">{title}</h3>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function DonutChart({ data, colorFn }) {
  if (!data || data.length === 0) return <p className="text-xs text-neutral-400 text-center py-4">No data</p>;
  const total = data.reduce((s, d) => s + (d.count ?? d.views ?? 0), 0) || 1;
  let offset = 0;
  const R = 40, CX = 50, CY = 50, STROKE = 14;
  const circ = 2 * Math.PI * R;
  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 100 100" className="w-24 h-24 shrink-0 -rotate-90">
        {data.map((d, i) => {
          const val = d.count ?? d.views ?? 0;
          const dash = (val / total) * circ;
          const seg = (
            <circle key={i} cx={CX} cy={CY} r={R} fill="none"
              stroke={colorFn ? colorFn(d, i) : `hsl(${(i * 47) % 360},65%,55%)`}
              strokeWidth={STROKE} strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={-offset * circ} strokeLinecap="butt" />
          );
          offset += val / total;
          return seg;
        })}
      </svg>
      <div className="space-y-1.5 min-w-0">
        {data.map((d, i) => {
          const val   = d.count ?? d.views ?? 0;
          const label = d.device ?? d.browser ?? d._id ?? d.group ?? '—';
          const color = colorFn ? colorFn(d, i) : `hsl(${(i * 47) % 360},65%,55%)`;
          return (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
              <span className="text-neutral-600 truncate capitalize">{label}</span>
              <span className="ml-auto font-semibold text-neutral-800 tabular-nums">{pct(val, total)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Events by event table ─────────────────────────────────────────────────────
function EventsTab({ data }) {
  const rows = data?.guestsByEvent ?? [];

  if (rows.length === 0) {
    return (
      <div className="text-center py-16 space-y-3">
        <p className="text-sm font-medium text-neutral-500">No event analytics data yet</p>
        <p className="text-xs text-neutral-400 max-w-md mx-auto leading-relaxed">
          This table fills in when visitors land on an event page (
          <code className="bg-neutral-100 px-1 rounded font-mono">/e/:subdomain</code> or{' '}
          <code className="bg-neutral-100 px-1 rounded font-mono">/rsvp/:slug</code>).
          EventSpace and RSVPPage call{' '}
          <code className="bg-neutral-100 px-1 rounded font-mono">setEventContext(eventId)</code>{' '}
          which tags every tracking event with that event&#39;s ID. If this is empty, verify
          that EventSpace is calling <code className="bg-neutral-100 px-1 rounded font-mono">setEventContext</code> after
          the event loads.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Section
        title="Events — Visitor Activity Leaderboard"
        icon={BarChart3}
        action={<span className="text-xs text-neutral-400">{rows.length} event{rows.length !== 1 ? 's' : ''} tracked</span>}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-neutral-100">
                {['Event ID', 'Sessions', 'Unique Visitors', 'Checked In', 'RSVP Yes', 'Suspected', 'Has PII'].map(h => (
                  <th key={h} className="pb-2 text-xs text-neutral-400 font-semibold uppercase tracking-wide pr-4 last:pr-0">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {rows.map((r, i) => (
                <tr key={i} className="hover:bg-neutral-50 transition-colors">
                  <td className="py-2.5 pr-4">
                    {/* The full MongoDB ObjectId is 24 hex chars. We show last 8 for
                        compactness. The full ID appears on hover (title attribute). */}
                    <div className="flex flex-col gap-0.5">
                      <span
                        className="font-mono text-xs text-indigo-600 cursor-help select-all"
                        title={`Full event ID: ${r.eventId || '—'}`}
                      >
                        {r.eventId ? `…${r.eventId.slice(-8)}` : '—'}
                      </span>
                      <span className="text-[9px] text-neutral-300 font-mono leading-none">hover = full ID</span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-4 font-semibold tabular-nums">{fmtNum(r.sessionCount)}</td>
                  <td className="py-2.5 pr-4 tabular-nums text-neutral-600">{fmtNum(r.uniqueVisitorCount)}</td>
                  <td className="py-2.5 pr-4 tabular-nums">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.checkedInCount > 0 ? 'bg-emerald-50 text-emerald-700' : 'text-neutral-400'}`}>
                      {fmtNum(r.checkedInCount)}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 tabular-nums">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.rsvpYesCount > 0 ? 'bg-blue-50 text-blue-700' : 'text-neutral-400'}`}>
                      {fmtNum(r.rsvpYesCount)}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 tabular-nums">
                    {r.suspectedCount > 0
                      ? <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-xs font-semibold">{fmtNum(r.suspectedCount)}</span>
                      : <span className="text-neutral-300 text-xs">0</span>}
                  </td>
                  <td className="py-2.5 tabular-nums text-neutral-500 text-xs">{fmtNum(r.withPii)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Column legend */}
        <div className="mt-4 pt-4 border-t border-neutral-100 grid grid-cols-2 lg:grid-cols-4 gap-2">
          {[
            { label: 'Event ID',        desc: 'Last 8 chars of MongoDB ObjectId. Hover for full ID.' },
            { label: 'Sessions',        desc: 'All tracking records (views, clicks, scrolls) linked to this event.' },
            { label: 'Unique Visitors', desc: 'Distinct localStorage visitorIds seen on this event's pages.' },
            { label: 'RSVP Yes',        desc: 'Visitors whose RSVP submission had status "yes".' },
          ].map(({ label, desc }) => (
            <div key={label} className="bg-neutral-50 rounded-lg p-2.5">
              <p className="text-[10px] font-bold text-neutral-700 mb-0.5 uppercase tracking-wide">{label}</p>
              <p className="text-[10px] text-neutral-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Form drop analysis */}
      <Section title="RSVP Form — Drop-off by Step" icon={Filter}
        action={<span className="text-xs text-neutral-400">Where people abandon the form</span>}>
        {(data?.formDropAnalysis ?? []).length === 0
          ? <p className="text-xs text-neutral-400 text-center py-6">No form-drop data yet</p>
          : (
            <div className="space-y-3">
              {(data.formDropAnalysis).map((row, i) => {
                const max = Math.max(...(data.formDropAnalysis).map(r => r.count), 1);
                return (
                  <div key={i}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-neutral-600 font-medium">Step {row.step}</span>
                      <span className="font-semibold text-neutral-800">{fmtNum(row.count)} drop-offs</span>
                    </div>
                    <div className="h-2.5 bg-neutral-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct(row.count, max)}%`, background: '#f97316' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )
        }
      </Section>
    </div>
  );
}

// ─── Spam & Security tab ──────────────────────────────────────────────────────
function SpamTab({ data, onRefresh }) {
  const [expandedVisitor, setExpandedVisitor] = useState(null);
  const [flagging, setFlagging] = useState(null);
  const [guestProfile, setGuestProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const suspected = data?.suspectedFakes ?? [];
  const ipHeatmap = data?.ipHeatmap ?? [];

  const handleFlag = async (visitorId, currentlyFlagged) => {
    setFlagging(visitorId);
    try {
      await platformAnalyticsAPI.flagVisitor({
        visitorId,
        isSuspected: !currentlyFlagged,
        reason: currentlyFlagged ? 'Cleared by admin' : 'Manually flagged from platform analytics',
      });
      onRefresh();
    } catch {
      alert('Flag operation failed');
    } finally { setFlagging(null); }
  };

  const loadProfile = async (visitorId) => {
    if (guestProfile?.visitorId === visitorId) { setGuestProfile(null); return; }
    setProfileLoading(true);
    try {
      const r = await platformAnalyticsAPI.getGuestProfile(visitorId);
      setGuestProfile(r.data);
    } catch { alert('Failed to load profile'); }
    finally { setProfileLoading(false); }
  };

  return (
    <div className="space-y-5">

      {/* Summary bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ['Suspected Visitors', suspected.length, '#ef4444'],
          ['High-Risk IPs (24h)', ipHeatmap.filter(r => r.count >= 20).length, '#f97316'],
          ['Medium-Risk IPs', ipHeatmap.filter(r => r.count >= 8 && r.count < 20).length, '#eab308'],
          ['Total Flagged IPs', ipHeatmap.length, '#6366f1'],
        ].map(([l, v, c]) => (
          <div key={l} className="bg-white border border-neutral-200 rounded-2xl p-4 text-center">
            <div className="text-2xl font-bold tabular-nums" style={{ color: c }}>{v}</div>
            <div className="text-xs text-neutral-500 mt-1">{l}</div>
          </div>
        ))}
      </div>

      {/* Suspected fakes */}
      <Section title="Suspected Fake / Bot Visitors" icon={Flag}
        action={
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${suspected.length > 0 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
            {suspected.length} flagged
          </span>
        }>
        {suspected.length === 0
          ? (
            <div className="flex flex-col items-center py-10 gap-2 text-emerald-600">
              <Shield className="w-8 h-8 text-emerald-400" />
              <p className="text-sm font-semibold">No suspected visitors flagged</p>
              <p className="text-xs text-neutral-400">The platform looks clean in this window</p>
            </div>
          )
          : (
            <div className="space-y-2">
              {suspected.map((v, i) => {
                const spam = v.spamRiskSignal ?? 0;
                const isExpanded = expandedVisitor === v.visitorId;
                const piiData = v.pii || {};
                return (
                  <div key={i} className="border border-red-100 bg-red-50 rounded-xl overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => setExpandedVisitor(isExpanded ? null : v.visitorId)}>
                      <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div>
                          <p className="font-mono text-neutral-400 truncate">{v.visitorId?.slice(-12) || '—'}</p>
                          <p className="font-medium text-neutral-800 truncate">{piiData.name || piiData.email || 'Unknown visitor'}</p>
                          {piiData.email && piiData.name && <p className="text-neutral-500 truncate">{piiData.email}</p>}
                        </div>
                        <div>
                          <span className="px-2 py-0.5 rounded-full text-white text-xs font-bold" style={{ background: spamColor(spam) }}>
                            {spam} — {spamLabel(spam)}
                          </span>
                          {v.adminFlagReason && <p className="text-neutral-500 text-[11px] mt-1 truncate">{v.adminFlagReason}</p>}
                        </div>
                        <div>
                          <p className="text-neutral-500">{v.ipCountry || '—'}{v.ipCity ? ` · ${v.ipCity}` : ''}</p>
                          <p className="text-neutral-400 font-mono text-[10px] truncate">{v.ipHash?.slice(0, 16) || '—'}</p>
                        </div>
                        <div>
                          <p className="text-neutral-500">{v.ts ? new Date(v.ts).toLocaleDateString() : '—'}</p>
                          {v.linkedEventId && <p className="text-neutral-400 text-[10px] font-mono">Event: …{v.linkedEventId.slice(-6)}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={e => { e.stopPropagation(); loadProfile(v.visitorId); }}
                          className="btn btn-secondary text-xs px-2 py-1">
                          {profileLoading && guestProfile?.visitorId !== v.visitorId ? '…' : 'Profile'}
                        </button>
                        <button
                          disabled={flagging === v.visitorId}
                          onClick={e => { e.stopPropagation(); handleFlag(v.visitorId, true); }}
                          className="btn btn-secondary text-xs px-2 py-1 text-green-700">
                          {flagging === v.visitorId ? '…' : 'Unflag'}
                        </button>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-neutral-400" /> : <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />}
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="px-4 pb-3 pt-1 bg-white border-t border-red-100 text-xs space-y-1">
                        <div className="grid grid-cols-3 gap-2 text-neutral-600">
                          <span><b>Email:</b> {piiData.email || '—'}</span>
                          <span><b>Name:</b> {piiData.name || '—'}</span>
                          <span><b>Phone:</b> {piiData.phone || '—'}</span>
                          <span><b>RSVP:</b> {v.rsvpStatus || '—'}</span>
                          <span><b>Checked in:</b> {v.checkedIn ? `Yes (${v.checkedInAt ? new Date(v.checkedInAt).toLocaleString() : 'unknown time'})` : 'No'}</span>
                          <span><b>Return visits:</b> {v.guestReturnCount ?? '—'}</span>
                        </div>
                        {v.adminFlagReason && <p className="text-red-600 mt-1"><b>Flag reason:</b> {v.adminFlagReason}</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        }
      </Section>

      {/* Guest profile drawer */}
      {guestProfile && (
        <Section title={`Visitor Cross-Event History — ${guestProfile.visitorId?.slice(-12)}`} icon={Users}
          action={<button onClick={() => setGuestProfile(null)} className="text-xs text-neutral-400 hover:text-neutral-600">Close ✕</button>}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[
              ['Total Events', guestProfile.globalStats?.distinctEvents],
              ['Total Sessions', guestProfile.globalStats?.totalSessions],
              ['Times Flagged', guestProfile.globalStats?.flaggedCount],
              ['Currently Suspected', guestProfile.globalStats?.isSuspected ? 'Yes' : 'No'],
            ].map(([l, v]) => (
              <div key={l} className="bg-neutral-50 rounded-xl p-3 text-center">
                <div className="text-lg font-bold text-neutral-800">{v ?? '—'}</div>
                <div className="text-xs text-neutral-500">{l}</div>
              </div>
            ))}
          </div>
          {guestProfile.pii && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-4 grid grid-cols-3 gap-2 text-xs">
              <span><b>Email:</b> {guestProfile.pii.email || '—'}</span>
              <span><b>Name:</b> {guestProfile.pii.name || '—'}</span>
              <span><b>Phone:</b> {guestProfile.pii.phone || '—'}</span>
            </div>
          )}
          <div className="space-y-2">
            {(guestProfile.allEvents ?? []).map((ev, i) => (
              <div key={i} className="border border-neutral-100 rounded-xl p-3 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-neutral-800">{ev.eventDetails?.title || `Event …${ev.eventId?.slice(-6)}`}</span>
                  <span className="text-neutral-400">{ev.firstSeen ? new Date(ev.firstSeen).toLocaleDateString() : '—'}</span>
                </div>
                <div className="flex gap-3 text-neutral-500 flex-wrap">
                  <span>RSVP: <b>{ev.rsvpStatus || '—'}</b></span>
                  <span>{ev.checkedIn ? '✓ Checked in' : 'Not checked in'}</span>
                  {ev.spamRiskSignal != null && (
                    <span className="px-1.5 py-0.5 rounded-full text-white text-[10px] font-bold"
                      style={{ background: spamColor(ev.spamRiskSignal) }}>
                      Score {ev.spamRiskSignal}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {(ev.timeline ?? []).map((t, j) => (
                    <span key={j} className="text-[10px] px-1.5 py-0.5 bg-neutral-100 rounded font-mono">{t.eventType}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* IP Heatmap */}
      <Section title="IP Address Heatmap — High-Volume Sources (Last 24h)" icon={Shield}
        action={<span className="text-xs text-neutral-400">≥8 requests in 24h</span>}>
        {ipHeatmap.length === 0
          ? <p className="text-xs text-neutral-400 text-center py-6">No high-volume IPs detected</p>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-neutral-100">
                    {['IP Hash (anonymised)', 'Requests', 'Countries', 'Unique Visitors', 'Events Touched', 'Risk'].map(h => (
                      <th key={h} className="pb-2 text-xs text-neutral-400 font-semibold uppercase tracking-wide pr-4 last:pr-0">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {ipHeatmap.map((row, i) => {
                    const risk = row.count >= 50 ? 'high' : row.count >= 20 ? 'medium' : 'low';
                    const riskStyle = risk === 'high' ? 'bg-red-100 text-red-700' : risk === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-neutral-100 text-neutral-600';
                    return (
                      <tr key={i} className="hover:bg-neutral-50">
                        <td className="py-2.5 pr-4 font-mono text-xs text-neutral-600">{row.ipHash?.slice(0, 16)}…</td>
                        <td className="py-2.5 pr-4 font-semibold tabular-nums">{fmtNum(row.count)}</td>
                        <td className="py-2.5 pr-4 text-neutral-500">{(row.countries ?? []).join(', ') || '—'}</td>
                        <td className="py-2.5 pr-4 tabular-nums text-neutral-600">{fmtNum((row.visitorIds ?? []).length)}</td>
                        <td className="py-2.5 pr-4 tabular-nums text-neutral-600">{fmtNum((row.eventIds ?? []).length)}</td>
                        <td className="py-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${riskStyle}`}>{risk}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        }
      </Section>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function PlatformAnalyticsDashboard() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [win,     setWin]     = useState(30);
  const [tab,     setTab]     = useState('overview');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await platformAnalyticsAPI.getDashboard(win);
      setData(r.data);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load analytics');
    } finally { setLoading(false); }
  }, [win]);

  useEffect(() => { load(); }, [load]);

  const TABS = [
    { id: 'overview',  label: 'Overview',          icon: BarChart3  },
    { id: 'pages',     label: 'Pages',              icon: Eye        },
    { id: 'traffic',   label: 'Traffic',            icon: TrendingUp },
    { id: 'audience',  label: 'Audience',           icon: Users      },
    { id: 'events',    label: 'Events',             icon: Activity   },
    { id: 'spam',      label: 'Spam & Security',    icon: Shield     },
    { id: 'errors',    label: 'Errors',             icon: AlertTriangle },
  ];

  const WINDOWS = [{ v: 1, l: '24h' }, { v: 7, l: '7 days' }, { v: 30, l: '30 days' }, { v: 90, l: '90 days' }];

  if (loading && !data) return (
    <div className="flex items-center justify-center h-64 text-neutral-400 gap-3">
      <RefreshCw className="w-5 h-5 animate-spin" />
      <span className="text-sm">Loading analytics…</span>
    </div>
  );
  if (error) return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 text-neutral-400">
      <AlertTriangle className="w-8 h-8 text-amber-400" />
      <p className="text-sm">{error}</p>
      <button onClick={load} className="text-xs text-blue-600 hover:underline">Retry</button>
    </div>
  );

  const s = data?.summary ?? {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-neutral-900 flex items-center gap-2">
            <Activity className="w-5 h-5 text-indigo-500" /> Platform Analytics
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">Live tracking · first-party · no cookies</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-neutral-100 rounded-xl p-0.5 gap-0.5">
            {WINDOWS.map(w => (
              <button key={w.v} onClick={() => setWin(w.v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${win === w.v ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'}`}>
                {w.l}
              </button>
            ))}
          </div>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-xs font-medium text-neutral-600 transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Live indicator + spam alert */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-xs text-emerald-600 font-medium">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          Tracker active · collecting data on all pages
        </div>
        {(data?.suspectedFakes?.length ?? 0) > 0 && (
          <button onClick={() => setTab('spam')}
            className="flex items-center gap-1.5 text-xs text-red-600 font-semibold bg-red-50 px-3 py-1 rounded-full border border-red-100 hover:bg-red-100 transition-colors">
            <Flag className="w-3 h-3" />
            {data.suspectedFakes.length} suspected visitor{data.suspectedFakes.length !== 1 ? 's' : ''} — view in Spam & Security
          </button>
        )}
        {(data?.ipHeatmap?.length ?? 0) > 0 && (
          <button onClick={() => setTab('spam')}
            className="flex items-center gap-1.5 text-xs text-amber-700 font-semibold bg-amber-50 px-3 py-1 rounded-full border border-amber-100 hover:bg-amber-100 transition-colors">
            <Shield className="w-3 h-3" />
            {data.ipHeatmap.length} high-volume IP{data.ipHeatmap.length !== 1 ? 's' : ''} detected
          </button>
        )}
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Page Views"     value={fmtNum(s.pageViews)}      trend={s.pageViewsTrend}
          icon={Eye}      accent="#6366f1" sparkData={data?.dailyTraffic} />
        <StatCard label="Unique Visitors" value={fmtNum(s.uniqueVisitors)} trend={s.uniqueVisitorsTrend}
          icon={Users}    accent="#10b981" sparkData={data?.dailyTraffic?.map(d => ({ views: d.uniqueVisitors }))} />
        <StatCard label="Sessions"        value={fmtNum(s.sessions)}       trend={null}
          icon={Activity} accent="#f59e0b" sub={`Bounce rate: ${s.bounceRate ?? '—'}%`} />
        <StatCard label="Avg Session"     value={fmtMs(s.avgSessionMs)}    trend={null}
          icon={Clock}    accent="#3b82f6" sub={`${fmtNum(s.searchQueries)} searches`} />
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-neutral-200 gap-0 overflow-x-auto">
        {TABS.map(t => {
          const TabIcon = t.icon;
          const badge = t.id === 'errors'
            ? (data?.recentErrors?.length ?? 0)
            : t.id === 'spam'
              ? (data?.suspectedFakes?.length ?? 0) + (data?.ipHeatmap?.length ?? 0)
              : 0;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${tab === t.id ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-neutral-500 hover:text-neutral-800'}`}>
              <TabIcon className="w-3.5 h-3.5" />
              {t.label}
              {badge > 0 && (
                <span className={`ml-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${t.id === 'errors' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>{badge}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── OVERVIEW ──────────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Section title="Daily Traffic" icon={BarChart3}>
            <div className="mb-2 flex justify-between text-xs text-neutral-400">
              <span>Page views per day</span><span>Last {win} days</span>
            </div>
            <DailyChart data={data?.dailyTraffic ?? []} />
          </Section>
          <Section title="Traffic by Hour (last 24h)" icon={Hash}>
            <p className="text-xs text-neutral-400 mb-3">When your users are most active</p>
            <HourlyChart data={data?.hourlyTraffic ?? []} />
          </Section>
          <Section title="Traffic by Section" icon={Target}>
            <div className="space-y-2">
              {(data?.pageGroupBreakdown ?? []).map((g, i) => {
                const total = (data?.pageGroupBreakdown ?? []).reduce((s, x) => s + x.views, 0) || 1;
                const color = GROUP_COLORS[g.group] || GROUP_COLORS.other;
                return (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: color }} />
                    <span className="w-24 capitalize text-neutral-600 text-xs truncate">{g.group}</span>
                    <div className="flex-1 bg-neutral-100 rounded-full h-2 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct(g.views, total)}%`, background: color }} />
                    </div>
                    <span className="text-xs font-mono text-neutral-500 w-10 text-right">{fmtNum(g.views)}</span>
                  </div>
                );
              })}
            </div>
          </Section>
          <Section title="Top Pages" icon={Eye}>
            <HBar items={data?.topPages ?? []} valueKey="views" labelKey="page" color="#6366f1" maxItems={8} />
          </Section>
        </div>
      )}

      {/* ── PAGES ─────────────────────────────────────────────────────────── */}
      {tab === 'pages' && (
        <div className="space-y-5">
          <Section title="All Pages — Views & Time" icon={Eye}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-neutral-100">
                    {['Page', 'Views', 'Unique', 'Avg Time', 'Clicks'].map(h => (
                      <th key={h} className="pb-2 text-xs text-neutral-400 font-semibold uppercase tracking-wide pr-4 last:text-right">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {(data?.topPages ?? []).map((p, i) => {
                    const timeRow  = data?.avgTimeOnPage?.find(t => t.page === p.page);
                    const clickRow = data?.topClickPages?.find(c => c.page === p.page);
                    return (
                      <tr key={i} className="hover:bg-neutral-50">
                        <td className="py-2.5 pr-4">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-neutral-300 font-mono w-4">{i + 1}</span>
                            <span className="text-neutral-800 text-xs font-medium truncate max-w-[200px]">{labelPage(p.page)}</span>
                            <span className="text-neutral-300 text-[10px] font-mono hidden md:inline truncate max-w-[120px]">{p.page}</span>
                          </div>
                        </td>
                        <td className="py-2.5 pr-4 text-right font-semibold tabular-nums">{fmtNum(p.views)}</td>
                        <td className="py-2.5 pr-4 text-right text-neutral-500 tabular-nums">{fmtNum(p.uniqueVisitors)}</td>
                        <td className="py-2.5 pr-4 text-right text-neutral-500">{timeRow ? fmtMs(timeRow.avgMs) : '—'}</td>
                        <td className="py-2.5 text-right text-neutral-500 tabular-nums">{clickRow ? fmtNum(clickRow.clicks) : '—'}</td>
                      </tr>
                    );
                  })}
                  {(data?.topPages ?? []).length === 0 && <tr><td colSpan={5} className="py-8 text-center text-xs text-neutral-400">No page data yet</td></tr>}
                </tbody>
              </table>
            </div>
          </Section>
          <Section title="Avg Time on Page" icon={Clock}>
            <HBar items={(data?.avgTimeOnPage ?? []).map(r => ({ ...r, _id: r.page, count: r.avgMs }))} valueKey="count" labelKey="_id" color="#10b981" />
          </Section>
          <Section title="Most Clicked Pages" icon={MousePointer}>
            <HBar items={data?.topClickPages ?? []} valueKey="clicks" labelKey="page" color="#f59e0b" />
          </Section>
        </div>
      )}

      {/* ── TRAFFIC ───────────────────────────────────────────────────────── */}
      {tab === 'traffic' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Section title="Traffic Sources" icon={Globe}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-neutral-100">
                    {['Source', 'Visits', 'Share'].map(h => (
                      <th key={h} className="pb-2 text-xs text-neutral-400 font-semibold uppercase tracking-wide pr-4 last:pr-0">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {(data?.referrers ?? []).map((r, i) => {
                    const total = (data?.referrers ?? []).reduce((s, x) => s + x.count, 0) || 1;
                    return (
                      <tr key={i} className="hover:bg-neutral-50">
                        <td className="py-2 pr-4">
                          <div className="flex items-center gap-2">
                            {r.referrer === '(direct)' ? <Radio className="w-3.5 h-3.5 text-indigo-400 shrink-0" /> : <ExternalLink className="w-3.5 h-3.5 text-neutral-300 shrink-0" />}
                            <span className="text-xs text-neutral-700 truncate max-w-[180px]">{r.referrer}</span>
                          </div>
                        </td>
                        <td className="py-2 text-right font-semibold tabular-nums">{fmtNum(r.count)}</td>
                        <td className="py-2 pl-4">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 bg-neutral-100 rounded-full h-1.5 overflow-hidden">
                              <div className="h-full rounded-full bg-indigo-400" style={{ width: `${pct(r.count, total)}%` }} />
                            </div>
                            <span className="text-xs text-neutral-400 w-8 text-right">{pct(r.count, total)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {(data?.referrers ?? []).length === 0 && <tr><td colSpan={3} className="py-6 text-center text-xs text-neutral-400">No referrer data yet</td></tr>}
                </tbody>
              </table>
            </div>
          </Section>
          <Section title="UTM Campaigns" icon={Target}>
            {(data?.utmSources ?? []).length === 0
              ? <p className="text-xs text-neutral-400 text-center py-8">No UTM parameters detected yet</p>
              : (data.utmSources).map((u, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-neutral-50 border border-neutral-100 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-neutral-800">{u.source}</div>
                    <div className="text-[11px] text-neutral-400">{[u.medium, u.campaign].filter(Boolean).join(' · ') || 'No medium/campaign'}</div>
                  </div>
                  <span className="text-sm font-bold text-indigo-600 tabular-nums">{fmtNum(u.count)}</span>
                </div>
              ))
            }
          </Section>
          <div className="lg:col-span-2">
            <Section title="Daily Traffic — Views vs Unique Visitors" icon={TrendingUp}>
              <div className="flex items-end gap-1 h-40">
                {(data?.dailyTraffic ?? []).map((d, i) => {
                  const maxV = Math.max(...(data?.dailyTraffic ?? []).map(x => x.views), 1);
                  const lbl  = new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                      <div className="absolute bottom-7 left-1/2 -translate-x-1/2 bg-neutral-800 text-white text-[10px] rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-nowrap">
                        {lbl}: {d.views} views · {d.uniqueVisitors} unique
                      </div>
                      <div className="w-full flex gap-0.5 items-end" style={{ height: '120px' }}>
                        <div className="flex-1 bg-indigo-400 rounded-t opacity-80" style={{ height: `${pct(d.views, maxV)}%` }} />
                        <div className="flex-1 bg-emerald-400 rounded-t opacity-80" style={{ height: `${pct(d.uniqueVisitors, maxV)}%` }} />
                      </div>
                      {i % Math.max(1, Math.floor((data?.dailyTraffic?.length ?? 1) / 7)) === 0 && (
                        <span className="text-[9px] text-neutral-400">{new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </Section>
          </div>
        </div>
      )}

      {/* ── AUDIENCE ──────────────────────────────────────────────────────── */}
      {tab === 'audience' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Section title="Device Types" icon={Monitor}>
            <DonutChart data={data?.devices ?? []} colorFn={(d) => ({ desktop: '#6366f1', mobile: '#10b981', tablet: '#f59e0b', unknown: '#cbd5e1' })[d.device] || '#cbd5e1'} />
            <div className="mt-4 grid grid-cols-2 gap-2">
              {(data?.devices ?? []).map((d, i) => {
                const DevIcon = DEVICE_ICONS[d.device] || Globe;
                const total = (data?.devices ?? []).reduce((s, x) => s + x.count, 0) || 1;
                return (
                  <div key={i} className="flex items-center gap-2 p-2.5 rounded-xl bg-neutral-50">
                    <DevIcon className="w-4 h-4 text-neutral-400" />
                    <div>
                      <div className="text-xs font-semibold capitalize text-neutral-700">{d.device}</div>
                      <div className="text-[11px] text-neutral-400">{fmtNum(d.count)} · {pct(d.count, total)}%</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>
          <Section title="Browsers" icon={Globe}>
            <DonutChart data={data?.browsers ?? []} colorFn={(_, i) => ['#6366f1','#10b981','#f59e0b','#3b82f6','#ec4899','#94a3b8'][i % 6]} />
            <div className="mt-4">
              <HBar items={(data?.browsers ?? []).map(b => ({ ...b, _id: b.browser }))} valueKey="count" labelKey="_id" color="#6366f1" />
            </div>
          </Section>
          <Section title="Feature Usage" icon={Zap}>
            <HBar items={(data?.featureUsage ?? []).map(f => ({ ...f, _id: f.page }))} valueKey="count" labelKey="_id" color="#a855f7" />
          </Section>
          <Section title="Avg Scroll Depth" icon={Activity}>
            {(data?.scrollDepths ?? []).length === 0
              ? <p className="text-xs text-neutral-400 text-center py-6">No scroll data yet</p>
              : (data.scrollDepths).map((sd, i) => (
                <div key={i} className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-neutral-600 truncate max-w-[200px]">{labelPage(sd.page)}</span>
                    <span className="font-semibold text-neutral-800">{sd.avgDepth}%</span>
                  </div>
                  <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${sd.avgDepth}%`, background: sd.avgDepth >= 75 ? '#10b981' : sd.avgDepth >= 40 ? '#f59e0b' : '#ef4444' }} />
                  </div>
                </div>
              ))
            }
          </Section>
        </div>
      )}

      {/* ── EVENTS ────────────────────────────────────────────────────────── */}
      {tab === 'events' && <EventsTab data={data} />}

      {/* ── SPAM & SECURITY ───────────────────────────────────────────────── */}
      {tab === 'spam' && <SpamTab data={data} onRefresh={load} />}

      {/* ── ERRORS ────────────────────────────────────────────────────────── */}
      {tab === 'errors' && (
        <Section title="Recent JavaScript Errors" icon={AlertTriangle}
          action={
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${(data?.recentErrors?.length ?? 0) > 0 ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
              {data?.recentErrors?.length ?? 0} errors
            </span>
          }>
          {(data?.recentErrors ?? []).length === 0
            ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-emerald-600">
                <div className="w-10 h-10 bg-emerald-50 rounded-2xl flex items-center justify-center">
                  <Zap className="w-5 h-5 text-emerald-500" />
                </div>
                <p className="text-sm font-semibold">No errors recorded</p>
                <p className="text-xs text-neutral-400">The platform is running clean</p>
              </div>
            )
            : (data.recentErrors).map((err, i) => {
              const pl = err.payload || {};
              return (
                <div key={i} className="p-3 rounded-xl border border-red-100 bg-red-50 mb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-red-800 truncate">{pl.message || 'Unknown error'}</p>
                      {pl.source && <p className="text-[11px] text-red-500 font-mono mt-0.5 truncate">{pl.source}{pl.line ? `:${pl.line}` : ''}{pl.col ? `:${pl.col}` : ''}</p>}
                      <p className="text-[11px] text-neutral-400 mt-1">Page: {labelPage(err.page)} · {new Date(err.ts).toLocaleString()}</p>
                    </div>
                    <span className="text-[10px] text-red-400 bg-red-100 px-2 py-0.5 rounded-full shrink-0">error</span>
                  </div>
                </div>
              );
            })
          }
        </Section>
      )}

      <div className="text-center text-[11px] text-neutral-300 pb-2">
        Window: last {win} day{win > 1 ? 's' : ''} · localStorage (no cookies) · AES-256-GCM encrypted at rest
      </div>
    </div>
  );
}
