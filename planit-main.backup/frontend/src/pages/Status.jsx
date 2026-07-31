import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { uptimeAPI, watchdogAPI } from '../services/api';
import { SERVICE_CATEGORIES, ALL_SERVICES_FLAT } from '../utils/serviceCategories';

const ROUTER_URL = (import.meta.env.VITE_ROUTER_URL || '').replace(/\/$/,'');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatUTCDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC', hour12: false,
  }).replace(',', '') + ' UTC';
}

function formatDayLabel(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getDayKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function buildBars(incidents, serviceKey, serverDown = false) {
  const DAYS = 15;
  const dayMap = {};
  if (serverDown) dayMap[getDayKey(new Date())] = 'outage';

  incidents.forEach(inc => {
    const start = new Date(inc.createdAt);
    const end   = inc.resolvedAt ? new Date(inc.resolvedAt) : new Date();
    // If a specific serviceKey is requested, only mark it affected when it's
    // explicitly listed in affectedServices. An empty list means "general /
    // platform-wide" — it still shows in the overall banner but does NOT mark
    // every individual service row as disrupted.
    const affects =
      !serviceKey
        ? true  // overall 15-day bar — always count the incident
        : inc.affectedServices?.length > 0 &&
          inc.affectedServices.some(s =>
            s.toLowerCase().includes(serviceKey.toLowerCase()) ||
            serviceKey.toLowerCase().includes(s.toLowerCase())
          );
    if (!affects) return;
    const cursor = new Date(start); cursor.setHours(0, 0, 0, 0);
    const endDay = new Date(end);   endDay.setHours(23, 59, 59, 999);
    while (cursor <= endDay) {
      const key  = getDayKey(cursor);
      const next = inc.severity === 'critical' ? 'outage' : 'degraded';
      const prev = dayMap[key];
      if (!prev || (prev === 'degraded' && next === 'outage')) dayMap[key] = next;
      cursor.setDate(cursor.getDate() + 1);
    }
  });

  const bars = [];
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
    bars.push({ date: new Date(d), status: dayMap[getDayKey(d)] || 'ok' });
  }
  return bars;
}

// Build uptime bars from UptimeCheck history (per-server)
function buildServerBars(historyDays, isCurrentlyDown) {
  if (!historyDays) {
    const bars = [];
    for (let i = 14; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0);
      bars.push({ date: new Date(d), status: i === 0 && isCurrentlyDown ? 'outage' : 'nodata' });
    }
    return bars;
  }
  return historyDays.map((day, idx) => {
    const date    = new Date(day.date + 'T00:00:00');
    const isToday = idx === historyDays.length - 1;
    if (isToday && isCurrentlyDown) return { date, status: 'outage' };
    if (day.pct === null)  return { date, status: 'nodata' };
    if (day.pct >= 99)     return { date, status: 'ok' };
    if (day.pct >= 80)     return { date, status: 'degraded' };
    return { date, status: 'outage' };
  });
}

function uptimePct(bars) {
  const counted = bars.filter(b => b.status !== 'nodata');
  if (counted.length === 0) return null;
  const ok = counted.filter(b => b.status === 'ok').length;
  return ((ok / counted.length) * 100).toFixed(2);
}

function groupByDate(incidents) {
  const groups = {};
  incidents.forEach(inc => {
    const key = getDayKey(new Date(inc.createdAt));
    if (!groups[key]) groups[key] = [];
    groups[key].push(inc);
  });
  return groups;
}

function last7DayKeys() {
  const keys = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(); d.setDate(d.getDate() - i);
    keys.push(getDayKey(d));
  }
  return keys;
}

function isServiceDisrupted(serviceKey, incidents, online) {
  if (!online) return true;
  return incidents.some(
    inc =>
      inc.status !== 'resolved' &&
      inc.affectedServices?.length > 0 &&
      inc.affectedServices.some(s =>
        s.toLowerCase().includes(serviceKey.toLowerCase()) ||
        serviceKey.toLowerCase().includes(s.toLowerCase())
      )
  );
}

function formatLatency(ms) {
  if (ms === null || ms === undefined) return null;
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function timeAgo(dateStr) {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60000)   return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}

const STATUS_LABEL = {
  investigating: 'Investigating',
  identified:    'Identified',
  monitoring:    'Monitoring',
  resolved:      'Resolved',
};

// ─── Uptime Bar ───────────────────────────────────────────────────────────────

function UptimeBar({ bar, index }) {
  const color =
    bar.status === 'outage'   ? '#ef4444' :
    bar.status === 'degraded' ? '#f97316' :
    bar.status === 'nodata'   ? '#e5e7eb' : '#22c55e';

  const label =
    bar.status === 'outage'   ? 'Outage' :
    bar.status === 'degraded' ? 'Degraded' :
    bar.status === 'nodata'   ? 'No data' : 'Operational';

  return (
    <div
      title={`${formatDayLabel(bar.date)} — ${label}`}
      style={{
        flex: '1 1 0', minWidth: 0, height: '22px',
        backgroundColor: color, borderRadius: '999px',
        cursor: 'default', flexShrink: 0, opacity: 0,
        animation: `barIn 0.3s ease ${index * 0.006}s both`,
      }}
    />
  );
}

// ─── Service Row ──────────────────────────────────────────────────────────────

function ServiceRow({ service, incidents, online }) {
  const bars      = buildBars(incidents, service.key, !online);
  const pct       = uptimePct(bars);
  const disrupted = isServiceDisrupted(service.key, incidents, online);

  return (
    <div style={{ padding: '14px 0', borderBottom: '1px solid #f3f4f6' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {!disrupted ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="12" fill="#22c55e" />
              <polyline points="5 12 10 17 19 8" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="12" fill={!online ? '#ef4444' : '#f97316'} />
              <line x1="12" y1="7" x2="12" y2="14" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="12" cy="17" r="1.2" fill="#fff" />
            </svg>
          )}
          <span style={{ fontSize: '14px', fontWeight: '500', color: '#111827', fontFamily: '"DM Sans", sans-serif' }}>
            {service.name}
          </span>
        </div>
        <span style={{
          fontSize: '12px', fontWeight: '600',
          color: disrupted ? (!online ? '#dc2626' : '#ea580c') : '#16a34a',
          fontFamily: '"DM Sans", sans-serif',
        }}>
          {disrupted ? (!online ? 'Offline' : 'Disrupted') : 'Operational'}
        </span>
      </div>
      <div style={{ display: 'flex', gap: '3px', width: '100%', overflow: 'hidden' }}>
        {bars.map((bar, i) => <UptimeBar key={i} bar={bar} index={i} />)}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px' }}>
        <span style={{ fontSize: '11px', color: '#9ca3af', fontFamily: '"DM Sans", sans-serif' }}>15 days ago</span>
        <span style={{ fontSize: '11px', color: '#9ca3af', fontFamily: '"DM Sans", sans-serif' }}>{pct !== null ? `${pct}% uptime` : '—'}</span>
        <span style={{ fontSize: '11px', color: '#9ca3af', fontFamily: '"DM Sans", sans-serif' }}>Today</span>
      </div>
    </div>
  );
}

// ─── Category Section ─────────────────────────────────────────────────────────

function CategorySection({ category, incidents, online, defaultOpen }) {
  const [expanded, setExpanded] = useState(defaultOpen || false);
  const disruptedCount = category.services.filter(
    s => isServiceDisrupted(s.key, incidents, online)
  ).length;
  const allOk = disruptedCount === 0;

  return (
    <div style={{ borderBottom: '1px solid #e5e7eb' }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{ width: '100%', background: 'none', border: 'none', padding: '16px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', textAlign: 'left', transition: 'background 0.1s' }}
        onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
        onMouseLeave={e => e.currentTarget.style.background = 'none'}
      >
        {allOk ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="12" fill="#22c55e" />
            <polyline points="5 12 10 17 19 8" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="12"
              fill={!online && disruptedCount === category.services.length ? '#ef4444' : '#f97316'}
            />
            <line x1="12" y1="7" x2="12" y2="14" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="12" cy="17" r="1.2" fill="#fff" />
          </svg>
        )}
        <span style={{ flex: 1, fontSize: '15px', fontWeight: '600', color: '#111827', fontFamily: '"DM Sans", sans-serif' }}>
          {category.label}
        </span>
        {!allOk && (
          <span style={{
            fontSize: '12px', fontWeight: '600',
            color: (!online && disruptedCount === category.services.length) ? '#dc2626' : '#ea580c',
            fontFamily: '"DM Sans", sans-serif',
          }}>
            {disruptedCount} {!online ? 'offline' : 'disrupted'}
          </span>
        )}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"
          style={{ flexShrink: 0, transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {expanded && (
        <div style={{ padding: '0 20px 8px 52px', animation: 'expandIn 0.18s ease both' }}>
          {category.services.map(svc => (
            <ServiceRow key={svc.key} service={svc} incidents={incidents} online={online} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Server Health Row — UptimeRobot style ────────────────────────────────────
//
// Layout mirrors the screenshot exactly:
//   Name  |  XX.XXX%                              (dot) Operational
//   [████████████████████████████████████████████████]
//
// No URLs, no pills, no icons, no emojis. Just name, percentage, bars, status.

function ServerHealthRow({ server, uptimeHistory }) {
  const isDown   = server.status === 'down';
  const histDays = uptimeHistory?.services?.[server.name]?.days ?? null;
  const bars     = buildServerBars(histDays, isDown);
  const pct      = uptimeHistory?.services?.[server.name]?.uptimePct ?? null;

  // Label shown next to the name — region if set, otherwise type
  const subLabel = server.region
    ? server.region
    : server.type === 'router' ? 'Load Balancer' : null;

  const statusColor = isDown ? '#e53e3e' : '#38a169';
  const statusText  = isDown ? 'Offline'  : 'Operational';

  return (
    <div style={{
      padding: '18px 0',
      borderBottom: '1px solid #edf2f7',
    }}>
      {/* Top row: name + pct on left, dot + status on right */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '10px',
      }}>
        {/* Left: name, optional sub-label, separator, percentage */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
          <span style={{
            fontSize: '15px', fontWeight: '500', color: '#1a202c',
            fontFamily: '"DM Sans", sans-serif', whiteSpace: 'nowrap',
          }}>
            {server.name}
          </span>
          {subLabel && (
            <>
              <span style={{ color: '#cbd5e0', fontSize: '13px', userSelect: 'none' }}>·</span>
              <span style={{
                fontSize: '13px', color: '#718096',
                fontFamily: '"DM Sans", sans-serif', whiteSpace: 'nowrap',
              }}>
                {subLabel}
              </span>
            </>
          )}
          {pct !== null && (
            <>
              <span style={{ color: '#cbd5e0', fontSize: '13px', userSelect: 'none' }}>|</span>
              <span style={{
                fontSize: '13px', fontWeight: '500',
                color: isDown ? '#e53e3e' : '#38a169',
                fontFamily: '"DM Sans", sans-serif',
              }}>
                {pct}%
              </span>
            </>
          )}
        </div>

        {/* Right: coloured dot + status label */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '7px',
          flexShrink: 0, marginLeft: '16px',
        }}>
          {/* Pulsing dot when up, static when down */}
          <div style={{ position: 'relative', width: '10px', height: '10px', flexShrink: 0 }}>
            <div style={{
              width: '10px', height: '10px', borderRadius: '50%',
              background: statusColor,
            }} />
            {!isDown && (
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                background: statusColor, opacity: 0.35,
                animation: 'pingPulse 2s ease-out infinite',
              }} />
            )}
          </div>
          <span style={{
            fontSize: '14px', fontWeight: '500', color: statusColor,
            fontFamily: '"DM Sans", sans-serif',
          }}>
            {statusText}
          </span>
        </div>
      </div>

      {/* Bars — full width, no gap label row underneath */}
      <div style={{ display: 'flex', gap: '3px', width: '100%' }}>
        {bars.map((bar, i) => <UptimeBar key={i} bar={bar} index={i} />)}
      </div>
    </div>
  );
}

// ─── Infrastructure Section ───────────────────────────────────────────────────

function InfrastructureSection({ servers, uptimeHistory }) {
  if (!servers || servers.length === 0) return null;

  // Router first, then backends in original order (already ordered by BACKEND_LABELS index)
  const sorted = [...servers].sort((a, b) => {
    if (a.type === 'router' && b.type !== 'router') return -1;
    if (a.type !== 'router' && b.type === 'router') return  1;
    return 0;
  });

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: '12px',
      padding: '4px 24px 8px',
    }}>
      {sorted.map((server, i) => (
        <ServerHealthRow key={i} server={server} uptimeHistory={uptimeHistory} />
      ))}
    </div>
  );
}

// ─── Incident Timeline ────────────────────────────────────────────────────────

function IncidentTimeline({ incident }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div style={{ marginBottom: '24px' }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', width: '100%' }}
      >
        <span style={{
          fontSize: '15px', fontWeight: '600', fontFamily: '"DM Sans", sans-serif',
          color: incident.severity === 'critical' ? '#dc2626' : incident.severity === 'major' ? '#ea580c' : '#d97706',
        }}>
          {incident.title}
        </span>
      </button>
      {expanded && incident.timeline && [...incident.timeline].reverse().map((u, i) => (
        <div key={i} style={{ marginTop: '10px' }}>
          <p style={{ fontSize: '14px', color: '#111827', lineHeight: '1.6', fontFamily: '"DM Sans", sans-serif', margin: 0 }}>
            <strong style={{ fontWeight: '700' }}>{STATUS_LABEL[u.status] || u.status}</strong>
            {' — '}{u.message}
          </p>
          <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '2px', fontFamily: '"DM Sans", sans-serif' }}>
            {formatUTCDate(u.createdAt)}
          </p>
        </div>
      ))}
      {!incident.timeline?.length && (
        <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '8px', fontFamily: '"DM Sans", sans-serif' }}>
          <strong>Investigating</strong> — We are currently investigating this issue.
        </p>
      )}
    </div>
  );
}

// ─── Report Modal ─────────────────────────────────────────────────────────────

function ReportModal({ onClose, onSubmit, submitting, success }) {
  const serviceOptions = ['General', ...ALL_SERVICES_FLAT.map(s => s.name)];
  const [form, setForm] = useState({ description: '', email: '', affectedService: 'General' });

  useEffect(() => {
    const onKey = e => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (success) return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', borderRadius: '12px', padding: '40px', textAlign: 'center', maxWidth: '360px', width: '90%', animation: 'modalIn 0.25s ease both' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>✓</div>
        <p style={{ fontSize: '16px', fontWeight: '600', color: '#111827', fontFamily: '"DM Sans", sans-serif' }}>Report received</p>
        <p style={{ fontSize: '14px', color: '#6b7280', marginTop: '6px', fontFamily: '"DM Sans", sans-serif' }}>Thank you for helping us improve reliability.</p>
      </div>
    </div>
  );

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '16px' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '480px', overflow: 'hidden', animation: 'modalIn 0.2s ease both', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ padding: '24px 28px 20px', borderBottom: '1px solid #f3f4f6' }}>
          <h2 style={{ fontSize: '17px', fontWeight: '700', color: '#111827', margin: 0, fontFamily: '"DM Sans", sans-serif' }}>Report an issue</h2>
          <p style={{ fontSize: '13px', color: '#9ca3af', marginTop: '4px', fontFamily: '"DM Sans", sans-serif' }}>Help us identify problems faster</p>
        </div>
        <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: '"DM Sans", sans-serif' }}>Affected area</label>
            <select
              value={form.affectedService}
              onChange={e => setForm(f => ({ ...f, affectedService: e.target.value }))}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', color: '#111827', background: '#f9fafb', outline: 'none', fontFamily: '"DM Sans", sans-serif' }}
            >
              {serviceOptions.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: '"DM Sans", sans-serif' }}>
              Description <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="What are you experiencing?"
              rows={3}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', color: '#111827', background: '#f9fafb', outline: 'none', resize: 'none', boxSizing: 'border-box', fontFamily: '"DM Sans", sans-serif' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: '"DM Sans", sans-serif' }}>
              Email <span style={{ color: '#9ca3af', fontWeight: '400', textTransform: 'none' }}>(optional)</span>
            </label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="you@example.com"
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '14px', color: '#111827', background: '#f9fafb', outline: 'none', boxSizing: 'border-box', fontFamily: '"DM Sans", sans-serif' }}
            />
          </div>
        </div>
        <div style={{ padding: '16px 28px 24px', display: 'flex', gap: '10px' }}>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: '10px', border: '1px solid #e5e7eb', borderRadius: '8px', background: '#fff', color: '#374151', fontSize: '14px', fontWeight: '500', cursor: 'pointer', fontFamily: '"DM Sans", sans-serif' }}
          >Cancel</button>
          <button
            onClick={() => onSubmit(form)}
            disabled={submitting || form.description.trim().length < 5}
            style={{
              flex: 1, padding: '10px', border: 'none', borderRadius: '8px',
              background: form.description.trim().length < 5 ? '#e5e7eb' : '#111827',
              color:      form.description.trim().length < 5 ? '#9ca3af' : '#fff',
              fontSize: '14px', fontWeight: '600',
              cursor: form.description.trim().length < 5 ? 'default' : 'pointer',
              fontFamily: '"DM Sans", sans-serif',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}
          >
            {submitting && (
              <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
            )}
            Submit report
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const AUTO_REPORT_FAILURES = 3;
const AUTO_REPORT_COOLDOWN = 10 * 60 * 1000;

export default function Status() {
  const [data, setData]                   = useState(null);
  const [uptimeHistory, setUptimeHistory] = useState(null);
  const [online, setOnline]               = useState(true);
  const [latency, setLatency]             = useState(null);
  const [showReport, setShowReport]       = useState(false);
  const [submitting, setSubmitting]       = useState(false);
  const [success, setSuccess]             = useState(false);
  const [autoReported, setAutoReported]   = useState(false);
  const [lastFetch, setLastFetch]         = useState(null);
  const [maintenance, setMaintenance]     = useState(null);

  const pingFailsRef   = useRef(0);
  const lastAutoReport = useRef(0);
  const onlineRef      = useRef(true);
  const statusTimerRef = useRef(null);
  const pingTimerRef   = useRef(null);
  const histTimerRef   = useRef(null);

  const fetchUptimeHistory = useCallback(async () => {
    try {
      // Try backend first — it includes admin overrides persisted in MongoDB
      const res = await uptimeAPI.getServerHistory();
      if (res?.data) {
        // Shape matches watchdog: { services: { "Iceman": { days: [...], uptimePct: X } } }
        setUptimeHistory(res.data);
        return;
      }
    } catch { /* fall through to watchdog */ }
    try {
      const res = await watchdogAPI.getUptimeHistory();
      if (res?.data) setUptimeHistory(res.data);
    } catch { /* leave stale */ }
  }, []);

  const fetchStatus = useCallback(async () => {
    // Fire both requests independently — update state as each one resolves
    // so a slow or hung main backend never blocks the watchdog data from rendering.
    const mergeWatchdog = (watchdogData) => {
      if (!watchdogData) return;
      setData(prev => {
        const base = prev || watchdogData;
        return {
          ...base,
          watchdog: {
            ...(base?.watchdog || {}),
            services: watchdogData.watchdog?.services || base?.watchdog?.services || [],
          },
        };
      });
      setLastFetch(new Date());
      if (watchdogData.uptimeHistory) setUptimeHistory(watchdogData.uptimeHistory);
    };

    const mergeMain = (mainData) => {
      if (!mainData) return;
      setData(prev => ({
        ...mainData,
        watchdog: {
          ...(mainData?.watchdog || {}),
          services: prev?.watchdog?.services || mainData?.watchdog?.services || [],
        },
      }));
      setLastFetch(new Date());
    };

    // Both in parallel — each updates independently when it lands
    watchdogAPI.getStatus()
      .then(res => mergeWatchdog(res?.data))
      .catch(() => {});

    uptimeAPI.getStatus()
      .then(res => mergeMain(res?.data))
      .catch(() => {});
  }, []);

  const fetchMaintenance = useCallback(async () => {
    if (!ROUTER_URL) return;
    try {
      const r = await fetch(`${ROUTER_URL}/maintenance`, { cache: 'no-store' });
      const d = await r.json();
      setMaintenance((d.active || d.upcoming) ? d : null);
    } catch { /* non-fatal */ }
  }, []);

  const ping = useCallback(async () => {
    const t = Date.now();
    try {
      await uptimeAPI.ping();
      const ms = Date.now() - t;
      setLatency(ms);
      const wasOffline = !onlineRef.current;
      onlineRef.current = true;
      setOnline(true);
      pingFailsRef.current = 0;
      if (wasOffline) fetchStatus();
    } catch {
      onlineRef.current = false;
      setOnline(false);
      setLatency(null);
      pingFailsRef.current += 1;
      if (
        pingFailsRef.current >= AUTO_REPORT_FAILURES &&
        Date.now() - lastAutoReport.current > AUTO_REPORT_COOLDOWN
      ) {
        lastAutoReport.current = Date.now();
        setAutoReported(true);
        uptimeAPI.submitReport({
          description:     `[AUTO] Status page detected ${AUTO_REPORT_FAILURES} consecutive API ping failures. Backend appears unreachable.`,
          email:           '',
          affectedService: 'API',
        }).catch(() => {});
      }
    }
  }, [fetchStatus]);

  useEffect(() => {
    if (statusTimerRef.current) clearInterval(statusTimerRef.current);
    if (pingTimerRef.current)   clearInterval(pingTimerRef.current);
    if (histTimerRef.current)   clearInterval(histTimerRef.current);

    fetchStatus();
    ping();
    fetchUptimeHistory();
    fetchMaintenance();

    statusTimerRef.current = setInterval(fetchStatus,        30_000);
    pingTimerRef.current   = setInterval(ping,               online ? 15_000 : 5_000);
    histTimerRef.current   = setInterval(fetchUptimeHistory, 5 * 60_000);

    return () => {
      clearInterval(statusTimerRef.current);
      clearInterval(pingTimerRef.current);
      clearInterval(histTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  const handleSubmit = async (form) => {
    setSubmitting(true);
    try {
      await uptimeAPI.submitReport(form);
      setSuccess(true);
      setTimeout(() => { setShowReport(false); setSuccess(false); }, 2200);
    } catch { /* Keep modal open */ }
    finally { setSubmitting(false); }
  };

  // ── Derived ──────────────────────────────────────────────────────────────────
  const allIncidents    = [...(data?.activeIncidents || []), ...(data?.recentResolved || [])];
  const activeIncidents = data?.activeIncidents || [];

  // servers come from watchdog.services — names are exactly what you set in
  // BACKEND_LABELS on the watchdog. Only include entries that have a URL
  // (i.e., they were actually configured and running).
  const servers = (data?.watchdog?.services || []).filter(s => s.name);

  const bannerState =
    !online                    ? 'offline'   :
    activeIncidents.length > 0 ? 'incident'  : 'operational';

  const BANNER = {
    offline:     { bg: '#fef2f2', border: '#fecaca', iconFill: '#ef4444', title: 'Service Unavailable',   sub: 'We cannot reach the PlanIt servers. All services may be affected.' },
    incident:    { bg: '#fff7ed', border: '#fed7aa', iconFill: '#f97316', title: `${activeIncidents.length} Active Incident${activeIncidents.length !== 1 ? 's' : ''}`, sub: 'We are aware of issues affecting some services.' },
    operational: { bg: '#f0fdf4', border: '#bbf7d0', iconFill: '#22c55e', title: 'All Systems Operational', sub: "We're not aware of any issues affecting our systems." },
  }[bannerState];

  const allBars  = buildBars(allIncidents, '', !online);
  const totalPct = uptimePct(allBars);

  const incidentsByDay = groupByDate(allIncidents);
  const dayKeys        = last7DayKeys();

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        @keyframes barIn     { from { opacity:0; transform:scaleY(0.4); } to { opacity:1; transform:scaleY(1); } }
        @keyframes fadeIn    { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes expandIn  { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:translateY(0); } }
        @keyframes modalIn   { from { opacity:0; transform:scale(0.97) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); } }
        @keyframes spin      { to { transform:rotate(360deg); } }
        @keyframes pulse     { 0%,100%{opacity:1;} 50%{opacity:0.4;} }
        @keyframes pingPulse { 0% { transform:scale(1); opacity:0.4; } 70% { transform:scale(2.4); opacity:0; } 100% { transform:scale(2.4); opacity:0; } }
        * { box-sizing:border-box; }
        body { margin:0; }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#f9fafb', fontFamily: '"DM Sans", sans-serif' }}>

        {/* Header */}
        <header style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 50 }}>
          <div style={{ maxWidth: '860px', margin: '0 auto', padding: '0 24px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Link to="/" style={{ fontSize: '14px', color: '#6b7280', textDecoration: 'none', fontWeight: '500' }}>← PlanIt</Link>
            <span style={{ fontSize: '15px', fontWeight: '600', color: '#111827' }}>System Status</span>
            <button
              onClick={() => setShowReport(true)}
              style={{ padding: '7px 14px', border: '1px solid #e5e7eb', borderRadius: '6px', background: '#fff', color: '#374151', fontSize: '13px', fontWeight: '500', cursor: 'pointer', fontFamily: '"DM Sans", sans-serif' }}
              onMouseEnter={e => e.target.style.background = '#f9fafb'}
              onMouseLeave={e => e.target.style.background = '#fff'}
            >
              Report issue
            </button>
          </div>
        </header>

        <main style={{ maxWidth: '860px', margin: '0 auto', padding: '0 24px 80px' }}>

          {/* Scheduled maintenance card */}
          {maintenance && (
            <div style={{
              marginTop: '24px',
              padding: '16px 20px',
              borderRadius: '12px',
              border: `1px solid ${maintenance.active ? '#fecaca' : '#fde68a'}`,
              borderLeft: `4px solid ${maintenance.active ? '#ef4444' : '#f59e0b'}`,
              background: maintenance.active ? '#fef2f2' : '#fffbeb',
              display: 'flex', alignItems: 'flex-start', gap: '14px',
              animation: 'fadeIn 0.3s ease both',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" style={{ flexShrink:0, marginTop:2 }}>
                <circle cx="12" cy="12" r="12" fill={maintenance.active ? '#ef4444' : '#f59e0b'} />
                <line x1="12" y1="7" x2="12" y2="14" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
                <circle cx="12" cy="17" r="1.2" fill="#fff"/>
              </svg>
              <div style={{ flex:1 }}>
                <p style={{ margin:0, fontSize:15, fontWeight:700, color: maintenance.active ? '#dc2626' : '#92400e', fontFamily:'"DM Sans",sans-serif' }}>
                  {maintenance.active ? 'Maintenance In Progress' : 'Scheduled Maintenance'}
                </p>
                {maintenance.message && (
                  <p style={{ margin:'4px 0 0', fontSize:14, color:'#374151', fontFamily:'"DM Sans",sans-serif' }}>
                    {maintenance.message}
                  </p>
                )}
                <div style={{ display:'flex', gap:16, marginTop:6, flexWrap:'wrap' }}>
                  {maintenance.start && (
                    <span style={{ fontSize:12, color:'#6b7280', fontFamily:'"DM Sans",sans-serif' }}>
                      Starts: <strong>{new Date(maintenance.start).toLocaleString(undefined,{weekday:'short',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</strong>
                    </span>
                  )}
                  {maintenance.eta && (
                    <span style={{ fontSize:12, color:'#6b7280', fontFamily:'"DM Sans",sans-serif' }}>
                      Est. back: <strong>{new Date(maintenance.eta).toLocaleString(undefined,{weekday:'short',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</strong>
                    </span>
                  )}
                </div>
              </div>
              <span style={{
                fontSize:11, fontWeight:700, letterSpacing:'0.05em', textTransform:'uppercase',
                padding:'3px 10px', borderRadius:999, flexShrink:0,
                background: maintenance.active ? '#fee2e2' : '#fef3c7',
                color: maintenance.active ? '#dc2626' : '#b45309',
              }}>
                {maintenance.active ? 'Active' : 'Upcoming'}
              </span>
            </div>
          )}

          {/* Auto-report banner */}
          {autoReported && !online && (
            <div style={{ marginTop: '24px', background: '#fef2f2', border: '1px solid #fecaca', borderLeft: '4px solid #ef4444', borderRadius: '8px', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', animation: 'fadeIn 0.3s ease both', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', animation: 'pulse 1.5s infinite', flexShrink: 0 }} />
                <span style={{ fontSize: '14px', fontWeight: '600', color: '#dc2626', fontFamily: '"DM Sans", sans-serif' }}>Unable to reach PlanIt servers</span>
                <span style={{ fontSize: '13px', color: '#6b7280', fontFamily: '"DM Sans", sans-serif' }}>An automatic report has been sent.</span>
              </div>
              <button
                onClick={() => setShowReport(true)}
                style={{ fontSize: '13px', fontWeight: '500', color: '#dc2626', background: 'none', border: '1px solid #fca5a5', borderRadius: '6px', padding: '5px 12px', cursor: 'pointer', fontFamily: '"DM Sans", sans-serif' }}
              >Add details</button>
            </div>
          )}

          {/* Overall status banner */}
          <div style={{ margin: '32px 0 24px', padding: '20px 24px', border: `1px solid ${BANNER.border}`, borderRadius: '12px', background: BANNER.bg, display: 'flex', alignItems: 'flex-start', gap: '14px', animation: 'fadeIn 0.4s ease both' }}>
            {bannerState === 'operational' ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: '2px' }}>
                <circle cx="12" cy="12" r="12" fill="#22c55e" />
                <polyline points="5 12 10 17 19 8" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, marginTop: '2px' }}>
                <circle cx="12" cy="12" r="12" fill={BANNER.iconFill} />
                <line x1="12" y1="7" x2="12" y2="14" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
                <circle cx="12" cy="17" r="1.2" fill="#fff" />
              </svg>
            )}
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '17px', fontWeight: '700', color: '#111827', margin: 0, fontFamily: '"DM Sans", sans-serif' }}>
                {BANNER.title}
              </p>
              <p style={{ fontSize: '14px', color: '#6b7280', margin: '4px 0 0', fontFamily: '"DM Sans", sans-serif' }}>
                {BANNER.sub}
              </p>
              {!online && lastFetch && (
                <p style={{ fontSize: '12px', color: '#9ca3af', margin: '6px 0 0', fontFamily: '"DM Sans", sans-serif' }}>
                  Status data last updated: {lastFetch.toLocaleTimeString()}
                </p>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
              <span style={{ fontSize: '12px', color: '#9ca3af', fontFamily: '"DM Sans", sans-serif' }}>
                {totalPct !== null ? `${totalPct}% uptime (15d)` : '—'}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: online ? '#16a34a' : '#dc2626', fontFamily: '"DM Sans", sans-serif' }}>
                <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: online ? '#22c55e' : '#ef4444', display: 'inline-block', animation: online ? 'none' : 'pulse 1.5s infinite' }} />
                {latency !== null ? `${latency}ms` : online ? 'Checking...' : 'Offline'}
              </span>
            </div>
          </div>

          {/* Active incident cards */}
          {activeIncidents.map(inc => (
            <div key={inc._id} style={{ border: `1px solid ${inc.severity === 'critical' ? '#fecaca' : '#fed7aa'}`, borderLeft: `4px solid ${inc.severity === 'critical' ? '#ef4444' : '#f97316'}`, borderRadius: '8px', background: inc.severity === 'critical' ? '#fef2f2' : '#fff7ed', padding: '16px 20px', marginBottom: '12px', animation: 'fadeIn 0.3s ease both' }}>
              <p style={{ fontSize: '14px', fontWeight: '700', color: inc.severity === 'critical' ? '#dc2626' : '#ea580c', margin: '0 0 4px', fontFamily: '"DM Sans", sans-serif' }}>
                {inc.title}
              </p>
              {inc.timeline?.length > 0 && (() => {
                const last = inc.timeline[inc.timeline.length - 1];
                return (
                  <>
                    <p style={{ fontSize: '13px', color: '#374151', margin: 0, fontFamily: '"DM Sans", sans-serif' }}>
                      <strong>{STATUS_LABEL[last.status]}</strong>{' — '}{last.message}
                    </p>
                    <p style={{ fontSize: '12px', color: '#9ca3af', margin: '4px 0 0', fontFamily: '"DM Sans", sans-serif' }}>
                      {formatUTCDate(last.createdAt)}
                    </p>
                  </>
                );
              })()}
            </div>
          ))}

          {/* ── Server Health ───────────────────────────────────────────────── */}
          {servers.length > 0 && (
            <section style={{ marginBottom: '24px', animation: 'fadeIn 0.4s ease 0.05s both' }}>
              <h2 style={{ fontSize: '13px', fontWeight: '700', color: '#6b7280', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 12px' }}>
                Server Health
              </h2>
              <InfrastructureSection servers={servers} uptimeHistory={uptimeHistory} />
            </section>
          )}

          {/* ── System Status Categories ─────────────────────────────────── */}
          <section style={{ animation: 'fadeIn 0.4s ease 0.1s both' }}>
            <h2 style={{ fontSize: '13px', fontWeight: '700', color: '#6b7280', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 12px' }}>
              System Status
            </h2>
            <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
              {SERVICE_CATEGORIES.map((cat, i) => (
                <CategorySection key={cat.id} category={cat} incidents={allIncidents} online={online} defaultOpen={i === 0} />
              ))}
            </div>
          </section>

          {/* ── Past Incidents ──────────────────────────────────────────────── */}
          <section style={{ marginTop: '48px', animation: 'fadeIn 0.4s ease 0.2s both' }}>
            <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#111827', margin: '0 0 24px' }}>Past Incidents</h2>
            {dayKeys.map(dayKey => {
              const [y, mo, d] = dayKey.split('-').map(Number);
              const dayDate    = new Date(y, mo - 1, d);
              const dayIncs    = incidentsByDay[dayKey] || [];
              return (
                <div key={dayKey} style={{ marginBottom: '32px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '14px' }}>
                    <span style={{ fontSize: '15px', fontWeight: '700', color: '#111827', whiteSpace: 'nowrap' }}>{formatDayLabel(dayDate)}</span>
                    <div style={{ flex: 1, height: '1px', background: '#e5e7eb' }} />
                  </div>
                  {dayIncs.length === 0
                    ? <p style={{ fontSize: '14px', color: '#9ca3af', margin: 0, fontFamily: '"DM Sans", sans-serif' }}>No incidents reported.</p>
                    : dayIncs.map(inc => <IncidentTimeline key={inc._id} incident={inc} />)
                  }
                </div>
              );
            })}
            {allIncidents.length === 0 && (
              <p style={{ fontSize: '14px', color: '#9ca3af' }}>No incidents in the past 7 days.</p>
            )}
          </section>

        </main>
      </div>

      {showReport && (
        <ReportModal
          onClose={() => { setShowReport(false); setSuccess(false); }}
          onSubmit={handleSubmit}
          submitting={submitting}
          success={success}
        />
      )}
    </>
  );
}