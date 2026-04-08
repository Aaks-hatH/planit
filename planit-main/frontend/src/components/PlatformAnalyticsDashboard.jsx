import { useState, useEffect, useCallback } from 'react';
import {
  BarChart3, TrendingUp, TrendingDown, Users, Eye, Clock, MousePointer,
  Globe, Smartphone, Monitor, Tablet, RefreshCw, Download, AlertTriangle,
  ArrowUpRight, ArrowDownRight, Minus, Activity, Zap, Search,
  ChevronDown, ExternalLink, Hash, Target, Radio, Filter,
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
  '/':                  'Home',
  '/about':             'About',
  '/discover':          'Discover',
  '/admin':             'Admin',
  '/dashboard':         'Client Portal',
  '/status':            'Status',
  '/support':           'Support',
  '/help':              'Help',
  '/blog':              'Blog',
  '/white-label':       'White Label',
  '/terms':             'Terms',
  '/privacy':           'Privacy',
};
const labelPage = (p) => PAGE_LABELS[p] || (p.length > 40 ? p.slice(0, 40) + '…' : p);

const GROUP_COLORS = {
  home:        '#6366f1',
  event:       '#10b981',
  admin:       '#f59e0b',
  dashboard:   '#3b82f6',
  blog:        '#8b5cf6',
  discover:    '#06b6d4',
  invite:      '#ec4899',
  reservation: '#f97316',
  'legal/info':'#64748b',
  support:     '#14b8a6',
  util:        '#94a3b8',
  whitelabel:  '#a855f7',
  other:       '#cbd5e1',
};

const DEVICE_ICONS = { desktop: Monitor, mobile: Smartphone, tablet: Tablet, unknown: Globe };

// ─── Sparkline SVG ─────────────────────────────────────────────────────────────
function Sparkline({ data, color = '#6366f1', height = 40, width = 120 }) {
  if (!data || data.length < 2) return <div style={{ width, height }} />;
  const vals  = data.map(d => d.views ?? d.count ?? 0);
  const max   = Math.max(...vals, 1);
  const step  = width / (vals.length - 1);
  const pts   = vals.map((v, i) => `${i * step},${height - (v / max) * (height - 4) - 2}`).join(' ');
  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ─── Bar chart (horizontal) ────────────────────────────────────────────────────
function HBar({ items, valueKey = 'count', labelKey = '_id', color = '#6366f1', maxItems = 10 }) {
  const rows  = items.slice(0, maxItems);
  const max   = Math.max(...rows.map(r => r[valueKey] ?? 0), 1);
  return (
    <div className="space-y-2">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span className="w-32 truncate text-neutral-600 text-xs shrink-0" title={r[labelKey]}>
            {labelPage(r[labelKey] ?? '—')}
          </span>
          <div className="flex-1 bg-neutral-100 rounded-full h-2 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${pct(r[valueKey] ?? 0, max)}%`, background: color }}
            />
          </div>
          <span className="text-xs font-mono text-neutral-500 w-10 text-right shrink-0">
            {fmtNum(r[valueKey])}
          </span>
        </div>
      ))}
      {items.length === 0 && (
        <p className="text-xs text-neutral-400 text-center py-4">No data yet</p>
      )}
    </div>
  );
}

// ─── Daily traffic bar chart ───────────────────────────────────────────────────
function DailyChart({ data }) {
  if (!data || data.length === 0) return <p className="text-xs text-neutral-400 text-center py-8">No data</p>;
  const max = Math.max(...data.map(d => d.views), 1);
  return (
    <div className="flex items-end gap-1 h-32 w-full">
      {data.map((d, i) => {
        const h = Math.max(2, pct(d.views, max));
        const dt = new Date(d.date);
        const label = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-neutral-800 text-white text-[10px] rounded px-1.5 py-0.5 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              {label}: {fmtNum(d.views)} views
            </div>
            <div
              className="w-full rounded-t transition-all duration-300"
              style={{ height: `${h}%`, background: '#6366f1', opacity: 0.7 + 0.3 * (h / 100) }}
            />
          </div>
        );
      })}
    </div>
  );
}

// ─── Hourly heatmap ────────────────────────────────────────────────────────────
function HourlyChart({ data }) {
  const byHour = Array.from({ length: 24 }, (_, h) => {
    const found = data?.find(d => d.hour === h);
    return { hour: h, views: found?.views ?? 0 };
  });
  const max = Math.max(...byHour.map(d => d.views), 1);
  return (
    <div className="flex items-end gap-0.5 h-16">
      {byHour.map((d) => (
        <div key={d.hour} className="flex-1 flex flex-col items-center group relative">
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-neutral-800 text-white text-[10px] rounded px-1.5 py-0.5 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
            {d.hour}:00 — {d.views} views
          </div>
          <div
            className="w-full rounded-sm"
            style={{
              height: `${Math.max(4, pct(d.views, max))}%`,
              background: `rgba(99,102,241,${0.15 + 0.85 * (d.views / max)})`,
            }}
          />
          {d.hour % 6 === 0 && (
            <span className="text-[9px] text-neutral-400 mt-0.5">{d.hour}h</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, trend, icon: Icon, accent = '#6366f1', sparkData }) {
  const TrendIcon = trend > 0 ? ArrowUpRight : trend < 0 ? ArrowDownRight : Minus;
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
            <TrendIcon className="w-3 h-3" />
            {Math.abs(trend)}%
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

// ─── Section wrapper ──────────────────────────────────────────────────────────
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

// ─── Donut chart (CSS-based) ──────────────────────────────────────────────────
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
          const val    = d.count ?? d.views ?? 0;
          const share  = val / total;
          const dash   = share * circ;
          const seg = (
            <circle key={i} cx={CX} cy={CY} r={R}
              fill="none"
              stroke={colorFn ? colorFn(d, i) : `hsl(${(i * 47) % 360},65%,55%)`}
              strokeWidth={STROKE}
              strokeDasharray={`${dash} ${circ - dash}`}
              strokeDashoffset={-offset * circ}
              strokeLinecap="butt"
            />
          );
          offset += share;
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

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function PlatformAnalyticsDashboard() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const [window,  setWindow]  = useState(30);
  const [tab,     setTab]     = useState('overview');

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await platformAnalyticsAPI.getDashboard(window);
      setData(r.data);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load analytics');
    } finally { setLoading(false); }
  }, [window]);

  useEffect(() => { load(); }, [load]);

  const TABS = [
    { id: 'overview',  label: 'Overview'   },
    { id: 'pages',     label: 'Pages'      },
    { id: 'traffic',   label: 'Traffic'    },
    { id: 'audience',  label: 'Audience'   },
    { id: 'errors',    label: 'Errors'     },
  ];

  const WINDOWS = [
    { v: 1,   l: '24h'   },
    { v: 7,   l: '7 days'},
    { v: 30,  l: '30 days'},
    { v: 90,  l: '90 days'},
  ];

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
            <Activity className="w-5 h-5 text-indigo-500" />
            Platform Analytics
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Live tracking across all pages · first-party · no cookies
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Window selector */}
          <div className="flex bg-neutral-100 rounded-xl p-0.5 gap-0.5">
            {WINDOWS.map(w => (
              <button key={w.v}
                onClick={() => setWindow(w.v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  window === w.v
                    ? 'bg-white shadow-sm text-neutral-900'
                    : 'text-neutral-500 hover:text-neutral-700'
                }`}>
                {w.l}
              </button>
            ))}
          </div>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-xs font-medium text-neutral-600 transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Live indicator */}
      <div className="flex items-center gap-2 text-xs text-emerald-600 font-medium">
        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
        Tracker active · collecting data on all pages
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Page Views"     value={fmtNum(s.pageViews)}     trend={s.pageViewsTrend}
          icon={Eye}      accent="#6366f1" sparkData={data?.dailyTraffic} />
        <StatCard label="Unique Visitors" value={fmtNum(s.uniqueVisitors)} trend={s.uniqueVisitorsTrend}
          icon={Users}    accent="#10b981" sparkData={data?.dailyTraffic?.map(d => ({ views: d.uniqueVisitors }))} />
        <StatCard label="Sessions"        value={fmtNum(s.sessions)}       trend={null}
          icon={Activity} accent="#f59e0b" sub={`Bounce rate: ${s.bounceRate ?? '—'}%`} />
        <StatCard label="Avg Session"     value={fmtMs(s.avgSessionMs)}    trend={null}
          icon={Clock}    accent="#3b82f6" sub={`${fmtNum(s.searchQueries)} searches`} />
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-neutral-200 gap-0.5">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}>
            {t.label}
            {t.id === 'errors' && (data?.recentErrors?.length ?? 0) > 0 && (
              <span className="ml-1.5 bg-red-100 text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {data.recentErrors.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ──────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Daily traffic */}
          <Section title="Daily Traffic" icon={BarChart3}>
            <div className="mb-2 flex justify-between text-xs text-neutral-400">
              <span>Page views per day</span>
              <span>Last {window} days</span>
            </div>
            <DailyChart data={data?.dailyTraffic ?? []} />
          </Section>

          {/* Hourly heatmap */}
          <Section title="Traffic by Hour (last 24h)" icon={Hash}>
            <p className="text-xs text-neutral-400 mb-3">When your users are most active</p>
            <HourlyChart data={data?.hourlyTraffic ?? []} />
          </Section>

          {/* Page group breakdown */}
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

          {/* Top pages quick */}
          <Section title="Top Pages" icon={Eye}>
            <HBar items={data?.topPages ?? []} valueKey="views" labelKey="page" color="#6366f1" maxItems={8} />
          </Section>

        </div>
      )}

      {/* ── PAGES TAB ─────────────────────────────────────────────────────── */}
      {tab === 'pages' && (
        <div className="space-y-5">

          {/* Pages table */}
          <Section title="All Pages — Views & Time" icon={Eye}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-neutral-100">
                    <th className="pb-2 text-xs text-neutral-400 font-semibold uppercase tracking-wide pr-4">Page</th>
                    <th className="pb-2 text-xs text-neutral-400 font-semibold uppercase tracking-wide text-right pr-4">Views</th>
                    <th className="pb-2 text-xs text-neutral-400 font-semibold uppercase tracking-wide text-right pr-4">Unique</th>
                    <th className="pb-2 text-xs text-neutral-400 font-semibold uppercase tracking-wide text-right pr-4">Avg Time</th>
                    <th className="pb-2 text-xs text-neutral-400 font-semibold uppercase tracking-wide text-right">Click Pages</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {(data?.topPages ?? []).map((p, i) => {
                    const timeRow = data?.avgTimeOnPage?.find(t => t.page === p.page);
                    const clickRow = data?.topClickPages?.find(c => c.page === p.page);
                    return (
                      <tr key={i} className="hover:bg-neutral-50 transition-colors">
                        <td className="py-2.5 pr-4">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-neutral-300 font-mono w-4">{i + 1}</span>
                            <span className="text-neutral-800 text-xs font-medium truncate max-w-[200px]" title={p.page}>
                              {labelPage(p.page)}
                            </span>
                            <span className="text-neutral-300 text-[10px] font-mono hidden md:inline truncate max-w-[120px]">
                              {p.page}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 pr-4 text-right font-semibold text-neutral-800 tabular-nums">{fmtNum(p.views)}</td>
                        <td className="py-2.5 pr-4 text-right text-neutral-500 tabular-nums">{fmtNum(p.uniqueVisitors)}</td>
                        <td className="py-2.5 pr-4 text-right text-neutral-500">{timeRow ? fmtMs(timeRow.avgMs) : '—'}</td>
                        <td className="py-2.5 text-right text-neutral-500 tabular-nums">{clickRow ? fmtNum(clickRow.clicks) : '—'}</td>
                      </tr>
                    );
                  })}
                  {(data?.topPages ?? []).length === 0 && (
                    <tr><td colSpan={5} className="py-8 text-center text-xs text-neutral-400">No page data yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>

          {/* Avg time on page */}
          <Section title="Avg Time on Page" icon={Clock}
            action={<span className="text-xs text-neutral-400">From page_exit events</span>}>
            <HBar items={(data?.avgTimeOnPage ?? []).map(r => ({ ...r, _id: r.page, count: r.avgMs }))}
              valueKey="count" labelKey="_id" color="#10b981" />
          </Section>

          {/* Feature usage */}
          <Section title="Most Active Pages (Click Activity)" icon={MousePointer}>
            <HBar items={data?.topClickPages ?? []} valueKey="clicks" labelKey="page" color="#f59e0b" />
          </Section>

        </div>
      )}

      {/* ── TRAFFIC TAB ───────────────────────────────────────────────────── */}
      {tab === 'traffic' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Referrers */}
          <Section title="Traffic Sources" icon={Globe}
            action={<span className="text-xs text-neutral-400">Top referrers</span>}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-neutral-100">
                    <th className="pb-2 text-xs text-neutral-400 font-semibold uppercase tracking-wide pr-4">Source</th>
                    <th className="pb-2 text-xs text-neutral-400 font-semibold uppercase tracking-wide text-right">Visits</th>
                    <th className="pb-2 text-xs text-neutral-400 font-semibold uppercase tracking-wide text-right pl-4">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {(data?.referrers ?? []).map((r, i) => {
                    const total = (data?.referrers ?? []).reduce((s, x) => s + x.count, 0) || 1;
                    const isDirect = r.referrer === '(direct)';
                    return (
                      <tr key={i} className="hover:bg-neutral-50">
                        <td className="py-2 pr-4">
                          <div className="flex items-center gap-2">
                            {isDirect
                              ? <Radio className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                              : <ExternalLink className="w-3.5 h-3.5 text-neutral-300 shrink-0" />
                            }
                            <span className="text-xs text-neutral-700 truncate max-w-[180px]">{r.referrer}</span>
                          </div>
                        </td>
                        <td className="py-2 text-right font-semibold text-neutral-800 tabular-nums">{fmtNum(r.count)}</td>
                        <td className="py-2 text-right pl-4">
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
                  {(data?.referrers ?? []).length === 0 && (
                    <tr><td colSpan={3} className="py-6 text-center text-xs text-neutral-400">No referrer data yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>

          {/* UTM campaigns */}
          <Section title="UTM Campaigns" icon={Target}>
            {(data?.utmSources ?? []).length === 0 ? (
              <p className="text-xs text-neutral-400 text-center py-8">No UTM parameters detected yet</p>
            ) : (
              <div className="space-y-2">
                {(data.utmSources).map((u, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-neutral-50 border border-neutral-100">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-neutral-800">{u.source}</div>
                      <div className="text-[11px] text-neutral-400">
                        {[u.medium, u.campaign].filter(Boolean).join(' · ') || 'No medium/campaign'}
                      </div>
                    </div>
                    <span className="text-sm font-bold text-indigo-600 tabular-nums">{fmtNum(u.count)}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Daily chart full width */}
          <div className="lg:col-span-2">
            <Section title="Daily Traffic — Views vs Unique Visitors" icon={TrendingUp}>
              <div className="overflow-x-auto">
                <div className="min-w-[600px]">
                  <div className="flex gap-4 text-xs text-neutral-400 mb-3">
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-1.5 bg-indigo-400 rounded inline-block" /> Page Views
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-1.5 bg-emerald-400 rounded inline-block" /> Unique Visitors
                    </span>
                  </div>
                  <div className="flex items-end gap-1 h-40">
                    {(data?.dailyTraffic ?? []).map((d, i) => {
                      const maxV = Math.max(...(data?.dailyTraffic ?? []).map(x => x.views), 1);
                      const hv   = pct(d.views, maxV);
                      const hu   = pct(d.uniqueVisitors, maxV);
                      const dt   = new Date(d.date);
                      const lbl  = dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                          <div className="absolute bottom-7 left-1/2 -translate-x-1/2 bg-neutral-800 text-white text-[10px] rounded px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-nowrap">
                            {lbl}: {d.views} views · {d.uniqueVisitors} unique
                          </div>
                          <div className="w-full flex gap-0.5 items-end" style={{ height: '120px' }}>
                            <div className="flex-1 bg-indigo-400 rounded-t opacity-80" style={{ height: `${hv}%` }} />
                            <div className="flex-1 bg-emerald-400 rounded-t opacity-80" style={{ height: `${hu}%` }} />
                          </div>
                          {i % Math.max(1, Math.floor((data?.dailyTraffic?.length ?? 1) / 7)) === 0 && (
                            <span className="text-[9px] text-neutral-400">
                              {dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </Section>
          </div>

        </div>
      )}

      {/* ── AUDIENCE TAB ──────────────────────────────────────────────────── */}
      {tab === 'audience' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Devices */}
          <Section title="Device Types" icon={Monitor}>
            <DonutChart
              data={data?.devices ?? []}
              colorFn={(d) => ({ desktop: '#6366f1', mobile: '#10b981', tablet: '#f59e0b', unknown: '#cbd5e1' })[d.device] || '#cbd5e1'}
            />
            <div className="mt-4 grid grid-cols-2 gap-2">
              {(data?.devices ?? []).map((d, i) => {
                const DevIcon = DEVICE_ICONS[d.device] || Globe;
                const total   = (data?.devices ?? []).reduce((s, x) => s + x.count, 0) || 1;
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

          {/* Browsers */}
          <Section title="Browsers" icon={Globe}>
            <DonutChart
              data={data?.browsers ?? []}
              colorFn={(_, i) => ['#6366f1','#10b981','#f59e0b','#3b82f6','#ec4899','#94a3b8'][i % 6]}
            />
            <div className="mt-4">
              <HBar items={(data?.browsers ?? []).map(b => ({ ...b, _id: b.browser }))}
                valueKey="count" labelKey="_id" color="#6366f1" />
            </div>
          </Section>

          {/* Feature usage by page */}
          <Section title="Feature Usage by Page" icon={Zap}
            action={<span className="text-xs text-neutral-400">feature_use events</span>}>
            <HBar items={(data?.featureUsage ?? []).map(f => ({ ...f, _id: f.page }))}
              valueKey="count" labelKey="_id" color="#a855f7" />
          </Section>

          {/* Scroll depth */}
          <Section title="Avg Scroll Depth" icon={Activity}
            action={<span className="text-xs text-neutral-400">% of page scrolled</span>}>
            {(data?.scrollDepths ?? []).length === 0
              ? <p className="text-xs text-neutral-400 text-center py-6">No scroll data yet</p>
              : (
                <div className="space-y-3">
                  {(data.scrollDepths).map((sd, i) => (
                    <div key={i}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-neutral-600 truncate max-w-[200px]">{labelPage(sd.page)}</span>
                        <span className="font-semibold text-neutral-800">{sd.avgDepth}%</span>
                      </div>
                      <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${sd.avgDepth}%`,
                            background: sd.avgDepth >= 75 ? '#10b981' : sd.avgDepth >= 40 ? '#f59e0b' : '#ef4444',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )
            }
          </Section>

        </div>
      )}

      {/* ── ERRORS TAB ────────────────────────────────────────────────────── */}
      {tab === 'errors' && (
        <Section title="Recent JavaScript Errors" icon={AlertTriangle}
          action={
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              (data?.recentErrors?.length ?? 0) > 0
                ? 'bg-red-100 text-red-600'
                : 'bg-emerald-100 text-emerald-600'
            }`}>
              {data?.recentErrors?.length ?? 0} errors
            </span>
          }>
          {(data?.recentErrors ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-emerald-600">
              <div className="w-10 h-10 bg-emerald-50 rounded-2xl flex items-center justify-center">
                <Zap className="w-5 h-5 text-emerald-500" />
              </div>
              <p className="text-sm font-semibold">No errors recorded</p>
              <p className="text-xs text-neutral-400">The platform is running clean</p>
            </div>
          ) : (
            <div className="space-y-3">
              {(data.recentErrors).map((err, i) => {
                const pl = err.payload || {};
                return (
                  <div key={i} className="p-3 rounded-xl border border-red-100 bg-red-50">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-red-800 truncate">
                          {pl.message || 'Unknown error'}
                        </p>
                        {pl.source && (
                          <p className="text-[11px] text-red-500 font-mono mt-0.5 truncate">
                            {pl.source}{pl.line ? `:${pl.line}` : ''}{pl.col ? `:${pl.col}` : ''}
                          </p>
                        )}
                        <p className="text-[11px] text-neutral-400 mt-1">
                          Page: {labelPage(err.page)} · {new Date(err.ts).toLocaleString()}
                        </p>
                      </div>
                      <span className="text-[10px] text-red-400 bg-red-100 px-2 py-0.5 rounded-full shrink-0">
                        error
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>
      )}

      {/* Footer */}
      <div className="text-center text-[11px] text-neutral-300 pb-2">
        Data window: last {window} day{window > 1 ? 's' : ''} ·
        {' '}Tracker uses localStorage (no cookies) ·
        {' '}All payloads AES-256-GCM encrypted at rest
      </div>

    </div>
  );
}
